import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/firebase-admin'

// In-Memory cache en el proceso de Node.js
let inMemoryEconomyConfig: any = null

export async function GET() {
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
        const docSnap = await adminDb.collection('config').doc('global_economy').get()
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
  try {
    const body = await request.json()
    const payload = {
      ...body,
      updatedAt: Date.now()
    }

    // 1. Actualizar Cache en Memoria RAM local del Hub
    inMemoryEconomyConfig = payload

    // 2. Persistencia Maestra: 1 sola escritura en /config/global_economy en Firestore
    try {
      if (adminDb && adminDb.collection) {
        await adminDb.collection('config').doc('global_economy').set(payload, { merge: true })
      }
    } catch (dbErr: any) {
      console.warn('[EconomyConfig] Firestore set master doc notice:', dbErr.message)
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
      message: 'Configuración económica persistida en Firestore y difundida en tiempo real vía SSE ($0.00 Firestore).',
      config: payload
    })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
