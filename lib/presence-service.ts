
export type TelemetryPlayerState = 
  | 'playersInLobby'
  | 'playersInAITraining'
  | 'playersInOnlineTraining'
  | 'playersInCompetitive'

let currentState: TelemetryPlayerState | null = null
let isInitialized = false

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

// Desactivado hacia Firestore para cumplir estrictamente la cuota Spark $0/mes.
// El estado se mantiene en memoria y se propaga vía BroadcastChannel.
export async function updatePlayerTelemetryState(newState: TelemetryPlayerState) {
  if (typeof window === 'undefined') return
  if (currentState === newState) return

  currentState = newState

  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('sugar_ludo_social_channel')
      channel.postMessage({
        type: 'telemetry_state_changed',
        state: newState,
        timestamp: Date.now()
      })
      channel.close()
    }
  } catch {}
}

export function initPresenceTracker(initialScreen: string = 'lobby', onlineOrigin?: string) {
  if (typeof window === 'undefined' || isInitialized) return
  isInitialized = true

  const initialState = mapScreenToTelemetryState(initialScreen, onlineOrigin)
  updatePlayerTelemetryState(initialState)
}
