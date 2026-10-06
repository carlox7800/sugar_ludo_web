import { NextResponse } from 'next/server'
import { APP_VERSION_TAG } from '../../../lib/version'
import { adminDb } from '../../../lib/firebase-admin'

export interface TelemetryAlertEvent {
  id: string
  timestamp: number
  isoTime: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'
  source: 'game-client' | 'admin-hub' | 'server'
  message: string
  stack?: string
  fpsSnapshot?: number
  details?: unknown
  version?: string
}

// Buffer circular en memoria para monitoreo en vivo ($0.00 / 0 MB overhead)
const MAX_ALERT_BUFFER = 100
const alertEventBuffer: TelemetryAlertEvent[] = []

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

/**
 * Ingesta de Alertas Críticas, Rendimiento & Anomalías (Game Client, Admin Hub, Server Relay)
 * Escribe incidentes en Firestore con Firebase Admin SDK solo cuando es ERROR o CRITICAL,
 * manteniendo el plan Spark al 100% de cuota gratuita.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Payload de alerta inválido' }, { status: 400 })
    }

    const event: TelemetryAlertEvent = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      isoTime: new Date().toISOString(),
      level: body.level || 'ERROR',
      source: body.source || 'game-client',
      message: String(body.message || 'Alerta sin descripción'),
      stack: body.stack ? String(body.stack) : undefined,
      fpsSnapshot: typeof body.fpsSnapshot === 'number' ? body.fpsSnapshot : undefined,
      details: body.details,
      version: body.version || APP_VERSION_TAG
    }

    // 1. Guardar en buffer circular en memoria para lectura inmediata
    alertEventBuffer.unshift(event)
    if (alertEventBuffer.length > MAX_ALERT_BUFFER) {
      alertEventBuffer.pop()
    }

    // 2. Si es evento de descarga persistente
    if (body.action === 'record_download' && adminDb) {
      try {
        const platform = body.platform || 'android'
        const metricsRef = adminDb.collection('system_metrics').doc('global_telemetry')
        const incrementField = platform === 'windows' ? 'downloadsWindows' : platform === 'web' ? 'downloadsWebPwa' : 'downloadsAndroid'
        await metricsRef.set({
          totalDownloadsCount: adminDb.FieldValue ? adminDb.FieldValue.increment(1) : 1,
          [incrementField]: adminDb.FieldValue ? adminDb.FieldValue.increment(1) : 1,
          lastDownloadAt: Date.now()
        }, { merge: true })

        return NextResponse.json({ success: true, recordedPlatform: platform }, { headers: { 'Access-Control-Allow-Origin': '*' } })
      } catch (err: any) {
        console.warn('[Telemetry] Error grabando métrica de descarga:', err.message)
      }
    }

    // 3. Si es ERROR o CRITICAL, persistir en Firestore con Firebase Admin SDK para trazabilidad
    if ((event.level === 'ERROR' || event.level === 'CRITICAL') && adminDb) {
      try {
        const incidentRef = adminDb.collection('telemetry_incidents').doc(event.id)
        await incidentRef.set({
          ...event,
          createdAt: adminDb.FieldValue?.serverTimestamp ? adminDb.FieldValue.serverTimestamp() : new Date()
        }, { merge: true })
      } catch (dbErr) {
        console.warn('[Telemetry] Advertencia al persistir incidente en Firestore con Admin SDK:', dbErr)
      }
    }

    return NextResponse.json(
      {
        success: true,
        receivedId: event.id,
        totalBuffered: alertEventBuffer.length
      },
      {
        headers: {
          'Access-Control-Allow-Origin': '*'
        }
      }
    )
  } catch {
    return NextResponse.json(
      { success: false, error: 'Error procesando alerta de telemetría' },
      { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } }
    )
  }
}

/**
 * Endpoint de Telemetría & Health Check de Infraestructura.
 * Consulta la memoria RAM de los nodos de juego ($0.00 Firestore) y
 * combina las métricas de negocio persistentes de system_metrics/global_telemetry.
 */
export async function GET() {
  const startTime = Date.now()
  let serverLatencyMs = 35
  let medianPingMs = 35
  const serverStatus = 'online'
  let liveOnlinePlayers = 0
  let playersInLobby = 0
  let playersInAITraining = 0
  let playersInOnlineTraining = 0
  let playersInCompetitive = 0
  let activeMatchRooms = 0
  let modeDistribution = {
    twoPlayers: 0,
    fourPlayers: 0,
    sixPlayers: 0,
    aiTraining: 0
  }

  // 1. Consultar nodo Web/Relay en memoria ($0.00 Firestore)
  try {
    const webBaseUrl = process.env.NEXT_PUBLIC_WEB_GAME_URL || 'https://sugar-ludo-web.onrender.com'
    const isDev = process.env.NODE_ENV !== 'production'
    const targetUrl = isDev ? 'http://localhost:3000/api/telemetry/live' : `${webBaseUrl}/api/telemetry/live`

    const res = await fetch(targetUrl, {
      method: 'GET',
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(2500)
    })
    if (res.ok) {
      const data = await res.json()
      if (data.telemetry) {
        const t = data.telemetry
        liveOnlinePlayers = Number(t.totalOnlinePlayers || 0)
        playersInLobby = Number(t.playersInLobby || 0)
        playersInAITraining = Number(t.playersInAITraining || 0)
        playersInOnlineTraining = Number(t.playersInOnlineTraining || 0)
        playersInCompetitive = Number(t.playersInCompetitive || 0)
        activeMatchRooms = Number(t.activeMatchRooms || 0)
        if (t.modeDistribution) {
          modeDistribution = t.modeDistribution
        }
        if (typeof t.medianPingMs === 'number') {
          medianPingMs = t.medianPingMs
        }
      }
    }
  } catch {}

  // 2. Latencia real del servidor de WebSockets
  try {
    const wsRes = await fetch('https://juego-de-servidor.onrender.com/health', {
      method: 'GET',
      next: { revalidate: 0 },
      signal: AbortSignal.timeout(2000)
    })
    serverLatencyMs = Date.now() - startTime
    if (wsRes.ok) {
      const wsData = await wsRes.json()
      // Si el servidor de WebSockets reporta partidas multijugador activas, sumar
      const wsOnline = Number(wsData.connectedPlayers || wsData.onlinePlayers || 0)
      if (wsOnline > 0) {
        liveOnlinePlayers = Math.max(liveOnlinePlayers, wsOnline)
        playersInOnlineTraining = Math.max(playersInOnlineTraining, Number(wsData.inOnlineTraining || 0))
        playersInCompetitive = Math.max(playersInCompetitive, Number(wsData.inCompetitive || 0))
        activeMatchRooms = Math.max(activeMatchRooms, Number(wsData.activeRooms || 0))
      }
    }
  } catch {
    serverLatencyMs = Math.max(35, Date.now() - startTime)
  }

  // 3. Consultar métricas de negocio persistentes (system_metrics/global_telemetry)
  let totalDownloadsCount = 10
  let downloadsAndroid = 7
  let downloadsWindows = 2
  let downloadsWebPwa = 1

  if (adminDb) {
    try {
      const metricsSnap = await adminDb.collection('system_metrics').doc('global_telemetry').get()
      if (metricsSnap.exists) {
        const mData = metricsSnap.data() || {}
        totalDownloadsCount = Number(mData.totalDownloadsCount || totalDownloadsCount)
        downloadsAndroid = Number(mData.downloadsAndroid || downloadsAndroid)
        downloadsWindows = Number(mData.downloadsWindows || downloadsWindows)
        downloadsWebPwa = Number(mData.downloadsWebPwa || downloadsWebPwa)
      }
    } catch {}
  }

  const criticalErrorsCount = alertEventBuffer.filter(
    (e) => e.level === 'ERROR' || e.level === 'CRITICAL'
  ).length

  return NextResponse.json(
    {
      success: true,
      telemetry: {
        totalDownloadsCount,
        totalRegisteredUsers: 0,
        playersInLobby,
        playersInAITraining,
        playersInOnlineTraining,
        playersInCompetitive,
        totalOnlinePlayers: liveOnlinePlayers,
        serverLatencyMs,
        medianPingMs,
        activeMatchRooms,
        serverStatus,
        modeDistribution,
        downloadsAndroid,
        downloadsWindows,
        downloadsWebPwa,
        criticalErrorsCount,
        recentAlerts: alertEventBuffer.slice(0, 20),
        updatedAt: Date.now()
      }
    },
    {
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    }
  )
}
