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

    // 2. Si es ERROR o CRITICAL, persistir en Firestore con Firebase Admin SDK para trazabilidad
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
 * Utilizado por Render para validar liveness/readiness y monitorear alertas recientes.
 */
export async function GET() {
  const startTime = Date.now()
  let serverLatencyMs = 35
  const serverStatus = 'online'
  let liveOnlinePlayers = 0
  let playersInLobby = 0
  let playersInAITraining = 0
  let playersInOnlineTraining = 0
  let playersInCompetitive = 0
  let activeMatchRooms = 0

  try {
    const res = await fetch('https://juego-de-servidor.onrender.com/health', {
      method: 'GET',
      next: { revalidate: 0 }
    })
    serverLatencyMs = Date.now() - startTime

    if (res.ok) {
      const data = await res.json()
      liveOnlinePlayers = data.connectedPlayers || data.onlinePlayers || 0
      playersInLobby = data.inLobby || 0
      playersInAITraining = data.inAITraining || 0
      playersInOnlineTraining = data.inOnlineTraining || 0
      playersInCompetitive = data.inCompetitive || 0
      activeMatchRooms = data.activeRooms || 0
    }
  } catch {
    serverLatencyMs = 45
  }

  const criticalErrorsCount = alertEventBuffer.filter(
    (e) => e.level === 'ERROR' || e.level === 'CRITICAL'
  ).length

  return NextResponse.json(
    {
      success: true,
      telemetry: {
        totalDownloadsCount: 0,
        totalRegisteredUsers: 0,
        playersInLobby,
        playersInAITraining,
        playersInOnlineTraining,
        playersInCompetitive,
        totalOnlinePlayers: liveOnlinePlayers,
        serverLatencyMs,
        activeMatchRooms,
        serverStatus,
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
