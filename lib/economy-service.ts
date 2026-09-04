import { subscribeToP2PData } from './friends-service'
import { db } from './firebase'
import { doc, onSnapshot } from 'firebase/firestore'

export interface EconomyMatrixEntry {
  entry: number
  pot: number
  prizes: number[]
}

export interface EconomyConfig {
  rakePercent: number
  matrix: Record<number, EconomyMatrixEntry>
  coinPackages?: any[]
  updatedAt: number
}

// Matriz base por defecto (Fallback Seguro Inmutable)
export const DEFAULT_ECONOMY_MATRIX: Record<number, EconomyMatrixEntry> = {
  2: { entry: 100, pot: 200, prizes: [150] },
  3: { entry: 120, pot: 360, prizes: [200, 80] },
  4: { entry: 150, pot: 600, prizes: [300, 150] },
  5: { entry: 200, pot: 1000, prizes: [400, 200, 100] },
  6: { entry: 300, pot: 1800, prizes: [600, 450, 250, 100] },
}

let liveEconomyMatrix: Record<number, EconomyMatrixEntry> = { ...DEFAULT_ECONOMY_MATRIX }
let liveCoinPackages: any[] | null = null
let liveSeasonRanking: any = null
let liveTournaments: any[] | null = null
const liveItemPrices = new Map<string, number>()
let liveFees = { normalFee: 5.0, vipFee: 10.0 }
let isInitialized = false

let lastConfig: any = null
const listeners = new Set<() => void>()
let unsubEconomyFirestore: (() => void) | null = null

function startEconomyListener() {
  if (typeof document !== 'undefined' && document.hidden) return
  if (unsubEconomyFirestore) return

  try {
    unsubEconomyFirestore = onSnapshot(doc(db, 'system_config', 'economy_settings'), (snap) => {
      if (snap.exists()) {
        const config = snap.data()
        lastConfig = config
        applyEconomyConfig(config)
      }
    }, (err) => {
      console.warn('[EconomyService] Fallback modo offline para economía:', err.message)
    })
  } catch (e) {
    console.warn('[EconomyService] Error iniciando listener Firestore:', e)
  }
}

export function initEconomyService() {
  if (typeof window === 'undefined' || isInitialized) return
  isInitialized = true

  // 1. Escuchar en TIEMPO REAL desde Firebase Firestore con pausa por visibilidad (Spark $0/mes)
  startEconomyListener()
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (unsubEconomyFirestore) {
          unsubEconomyFirestore()
          unsubEconomyFirestore = null
        }
      } else {
        startEconomyListener()
      }
    })
  }

  // 2. Escuchar evento instantáneo por BroadcastChannel (0 ms)
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('sugar_ludo_social_channel')
      channel.onmessage = (event) => {
        if (event.data?.type === 'economy_settings_updated' && event.data.payload) {
          applyEconomyConfig(event.data.payload)
        }
      }
    }
  } catch {}

  // 3. Escuchar eventos reactivos transmitidos por el canal SSE / Server Relay
  subscribeToP2PData((data: any) => {
    if (data && (data.dataType === 'economy_updated' || data.type === 'economy_updated')) {
      const config = data.config || data
      applyEconomyConfig(config)
    }
  })
}

function applyEconomyConfig(config: any) {
  if (!config) return

  if (config.matrix) {
    liveEconomyMatrix = { ...DEFAULT_ECONOMY_MATRIX, ...config.matrix }
  } else if (Array.isArray(config.competitiveMatrix)) {
    const mat: Record<number, EconomyMatrixEntry> = {}
    config.competitiveMatrix.forEach((t: any) => {
      if (t.playerCount) {
        mat[t.playerCount] = {
          entry: t.entryFeeSC,
          pot: t.potSC,
          prizes: t.prizesSC || []
        }
      }
    })
    liveEconomyMatrix = { ...DEFAULT_ECONOMY_MATRIX, ...mat }
  }

  if (Array.isArray(config.packages)) {
    liveCoinPackages = config.packages
  }

  if (Array.isArray(config.items)) {
    config.items.forEach((it: any) => {
      if (it && it.id && typeof it.priceCoins === 'number') {
        liveItemPrices.set(it.id, it.priceCoins)
      }
    })
  }

  if (config.seasonRanking) {
    liveSeasonRanking = config.seasonRanking
  }

  if (Array.isArray(config.tournaments)) {
    liveTournaments = config.tournaments
  }

  if (typeof config.normalFee === 'number') liveFees.normalFee = config.normalFee
  if (typeof config.vipFee === 'number') liveFees.vipFee = config.vipFee

  // Notificar a componentes suscritos
  listeners.forEach((cb) => cb())
}

export function getLiveEconomyMatrix(): Record<number, EconomyMatrixEntry> {
  initEconomyService()
  return liveEconomyMatrix || DEFAULT_ECONOMY_MATRIX
}

export function getLiveCoinPackages(): any[] | null {
  initEconomyService()
  return liveCoinPackages
}

export function getLiveItemPrice(itemId: string, defaultPrice: number): number {
  initEconomyService()
  return liveItemPrices.has(itemId) ? liveItemPrices.get(itemId)! : defaultPrice
}

export function getLiveWithdrawalFees() {
  initEconomyService()
  return liveFees
}

export function getLiveSeasonRanking(): any {
  initEconomyService()
  return liveSeasonRanking
}

export function getLiveTournaments(): any[] | null {
  initEconomyService()
  return liveTournaments
}

export function subscribeToEconomyUpdates(cb: () => void): () => void {
  initEconomyService()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export function getRawEconomyConfig(): any {
  initEconomyService()
  return lastConfig
}
