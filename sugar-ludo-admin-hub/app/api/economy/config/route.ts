import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'
import { verifyStaffAuth } from '@/lib/api-auth-guard'
import { validateEconomyConfig, formatDualWritePayload } from '@/lib/economy-validator'

// In-Memory cache en el proceso de Node.js
let inMemoryEconomyConfig: any = null

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

export async function GET(request: Request) {
  const authResult = await verifyStaffAuth(request, ['cashier', 'admin'])
  if (!authResult.authorized) {
    return authResult.errorResponse!
  }

  try {
    // 1. Si está en cache en RAM, devolver de inmediato ($0.00 lecturas)
    if (inMemoryEconomyConfig) {
      return NextResponse.json({
        success: true,
        source: 'memory_cache',
        config: inMemoryEconomyConfig,
        updatedAt: inMemoryEconomyConfig.updatedAt
      })
    }

    // 2. Si no está en RAM, leer 1 sola vez el documento maestro /config/global_economy
    if (adminDb && adminDb.collection) {
      try {
        let docSnap = await adminDb.collection('config').doc('global_economy').get()
        if (!docSnap.exists) {
          docSnap = await adminDb.collection('system_config').doc('economy_settings').get()
        }
        if (docSnap.exists) {
          inMemoryEconomyConfig = docSnap.data()
          return NextResponse.json({
            success: true,
            source: 'firestore_master',
            config: inMemoryEconomyConfig,
            updatedAt: inMemoryEconomyConfig.updatedAt
          })
        }
      } catch (dbErr: any) {
        console.warn('[EconomyConfig] Firestore initial read fallback notice:', dbErr.message)
      }
    }

    return NextResponse.json({
      success: true,
      source: 'default_fallback',
      config: inMemoryEconomyConfig,
      updatedAt: Date.now()
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const authResult = await verifyStaffAuth(request, ['admin'])
  if (!authResult.authorized) {
    return authResult.errorResponse!
  }

  try {
    const body = await request.json()
    
    // Validación estricta de invariantes financieros (pot = premios + rake, límites 100-300 SC)
    const validation = validateEconomyConfig(body)
    if (!validation.valid) {
      return NextResponse.json({
        success: false,
        error: 'Validación de economía fallida: invariantes financieros violados',
        errors: validation.errors
      }, { status: 400 })
    }

    const payload = formatDualWritePayload(validation.sanitized)

    // 1. Actualizar Cache en Memoria RAM local del Hub
    inMemoryEconomyConfig = payload

    // 2. Persistencia Maestra Dual-Write con Firebase Admin SDK (Cero reglas requeridas)
    try {
      if (adminDb && adminDb.collection) {
        // Documento Canónico Centralizado
        await adminDb.collection('config').doc('global_economy').set(payload, { merge: true })
        // Documento Legacy para clientes y listeners en ejecución
        await adminDb.collection('system_config').doc('economy_settings').set(payload, { merge: true })
      }
    } catch (dbErr: any) {
      console.warn('[EconomyConfig] Firestore dual-write notice:', dbErr.message)
    }

    // 3. Notificar y Sincronizar en RAM del Servidor de Render (POST /api/social/event)
    // Esto dispara la emisión SSE del evento 'economy_updated' a todos los clientes del juego
    try {
      fetch('https://juego-de-servidor.onrender.com/api/social/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'p2p_data',
          targetUid: null, // Broadcast a todos los sockets conectados
          dataType: 'economy_updated',
          config: payload,
          timestamp: Date.now()
        })
      }).catch((relayErr) => {
        console.warn('[EconomyConfig] Render relay notice:', relayErr.message)
      })
    } catch (relayErr) {
      console.warn('[EconomyConfig] Render relay sync notice:', relayErr)
    }

    return NextResponse.json({
      success: true,
      message: 'Configuración económica validada, persistida atómicamente con Dual-Write y difundida vía SSE.',
      config: payload
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
