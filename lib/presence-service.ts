
export type TelemetryPlayerState = 
  | 'playersInLobby'
  | 'playersInAITraining'
  | 'playersInOnlineTraining'
  | 'playersInCompetitive'

let currentState: TelemetryPlayerState | null = null
let currentMode: '2p' | '4p' | '6p' = '4p'
let isInitialized = false
let heartbeatTimer: any = null

function getSessionId(): string {
  if (typeof window === 'undefined') return 'server_session'
  try {
    let sid = sessionStorage.getItem('sugar_telemetry_sid')
    if (!sid) {
      sid = `ses_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      sessionStorage.setItem('sugar_telemetry_sid', sid)
    }
    return sid
  } catch {
    return `ses_${Date.now()}`
  }
}

export function mapScreenToTelemetryState(screen: string, onlineOrigin?: string): TelemetryPlayerState {
  if (screen === 'training' || screen === 'game') {
    return 'playersInAITraining'
  }
  if (screen === 'competitive') {
    return 'playersInCompetitive'
  }
  if (screen === 'online-training') {
    return 'playersInOnlineTraining'
  }
  if (screen === 'online-game') {
    return onlineOrigin === 'competitive' ? 'playersInCompetitive' : 'playersInOnlineTraining'
  }
  return 'playersInLobby'
}

function sendServerHeartbeat(state: TelemetryPlayerState, mode: '2p' | '4p' | '6p' = '4p') {
  if (typeof window === 'undefined') return
  try {
    const sid = getSessionId()
    const payload = JSON.stringify({
      type: 'telemetry_heartbeat',
      sessionId: sid,
      state,
      mode,
      latencyMs: 35,
      timestamp: Date.now()
    })

    // 1. Enviar a server.js vía /api/social/event (o fallback a dominio Render en app nativa)
    const isNative = typeof window !== 'undefined' && (
      window.location.protocol === 'file:' || 
      window.location.protocol === 'capacitor:' || 
      window.location.hostname.includes('capacitor')
    )
    const socialUrl = isNative ? 'https://sugar-ludo-web.onrender.com/api/social/event' : '/api/social/event'

    if (navigator.sendBeacon && !isNative) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon(socialUrl, blob)
    } else {
      fetch(socialUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
        mode: isNative ? 'cors' : 'same-origin'
      }).catch(() => {})
    }

    // 2. Despacho directo al Admin Hub para telemetría en tiempo real sin latencia
    const isDev = typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    const adminHubUrl = (typeof process !== 'undefined' && process.env && (process.env as any).NEXT_PUBLIC_ADMIN_HUB_URL)
      ? (process.env as any).NEXT_PUBLIC_ADMIN_HUB_URL
      : (isDev ? 'http://localhost:3001' : 'https://sugar-ludo-admin-hub.onrender.com')

    fetch(`${adminHubUrl}/api/telemetry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      mode: 'cors'
    }).catch(() => {})
  } catch {}
}

// Despacho en memoria hacia server.js ($0.00 Firestore)
// El estado se mantiene en la RAM del servidor y se propaga vía BroadcastChannel local.
export async function updatePlayerTelemetryState(newState: TelemetryPlayerState, mode?: '2p' | '4p' | '6p') {
  if (typeof window === 'undefined') return
  if (mode) currentMode = mode
  if (currentState === newState && !mode) return

  currentState = newState

  // 1. BroadcastChannel local (pestañas del mismo navegador)
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('sugar_ludo_social_channel')
      channel.postMessage({
        type: 'telemetry_state_changed',
        state: newState,
        mode: currentMode,
        timestamp: Date.now()
      })
      channel.close()
    }
  } catch {}

  // 2. Despacho a servidor Node.js en memoria ($0.00 / Spark Compliant)
  sendServerHeartbeat(newState, currentMode)
}

export function initPresenceTracker(initialScreen: string = 'lobby', onlineOrigin?: string, mode?: '2p' | '4p' | '6p') {
  if (typeof window === 'undefined' || isInitialized) return
  isInitialized = true

  const initialState = mapScreenToTelemetryState(initialScreen, onlineOrigin)
  updatePlayerTelemetryState(initialState, mode)

  // Heartbeat periódico cada 25 segundos para mantener sesión viva en RAM
  if (!heartbeatTimer) {
    heartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden && currentState) {
        sendServerHeartbeat(currentState, currentMode)
        try {
          if ('BroadcastChannel' in window) {
            const ch = new BroadcastChannel('sugar_ludo_social_channel')
            ch.postMessage({
              type: 'telemetry_state_changed',
              state: currentState,
              mode: currentMode,
              timestamp: Date.now()
            })
            ch.close()
          }
        } catch {}
      }
    }, 25000)
  }

  // Reactivar latido cuando el usuario regresa a la pestaña
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && currentState) {
        sendServerHeartbeat(currentState, currentMode)
      }
    })
  }
}
