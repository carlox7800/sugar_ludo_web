
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

    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' })
      navigator.sendBeacon('/api/social/event', blob)
    } else {
      fetch('/api/social/event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      }).catch(() => {})
    }
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
