import { db } from './firebase'
import { doc, setDoc, increment } from 'firebase/firestore'

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

export async function updatePlayerTelemetryState(newState: TelemetryPlayerState) {
  if (typeof window === 'undefined') return
  if (currentState === newState) return

  const oldState = currentState
  currentState = newState

  try {
    const docRef = doc(db, 'system_treasury', 'live_telemetry')
    const updatePayload: Record<string, any> = {
      updatedAt: Date.now(),
      serverStatus: 'online'
    }

    if (oldState) {
      updatePayload[oldState] = increment(-1)
    }
    updatePayload[newState] = increment(1)

    await setDoc(docRef, updatePayload, { merge: true })
  } catch (err) {
    console.warn('[Presence] Error actualizando telemetría en Firestore:', err)
  }
}

export function initPresenceTracker(initialScreen: string = 'lobby', onlineOrigin?: string) {
  if (typeof window === 'undefined' || isInitialized) return
  isInitialized = true

  const initialState = mapScreenToTelemetryState(initialScreen, onlineOrigin)
  updatePlayerTelemetryState(initialState)

  const handleUnload = () => {
    if (currentState) {
      try {
        const docRef = doc(db, 'system_treasury', 'live_telemetry')
        setDoc(docRef, {
          [currentState]: increment(-1),
          updatedAt: Date.now()
        }, { merge: true }).catch(() => {})
      } catch {}
    }
  }

  window.addEventListener('beforeunload', handleUnload)
}
