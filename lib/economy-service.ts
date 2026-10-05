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

const LOCAL_STORAGE_KEY = 'sugar_global_economy_config'

let liveEconomyMatrix: Record<number, EconomyMatrixEntry> = { ...DEFAULT_ECONOMY_MATRIX }
let liveCoinPackages: any[] | null = null
let liveSeasonRanking: any = null
let liveTournaments: any[] | null = null
const liveItemPrices = new Map<string, number>()
const liveItemAvailability = new Map<string, boolean>()
let liveFees = { normalFee: 5.0, vipFee: 10.0 }
let liveXpConfig = {
  doubleXpActive: false,
  goldRushMultiplier: 1,
  tournamentBonusPct: 0
}
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

  // 0. Carga inicial inmediata desde caché local persistente ($0.00 lecturas Firebase Spark, 0 ms)
  try {
    const cached = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (cached) {
      const parsed = JSON.parse(cached)
      lastConfig = parsed
      applyEconomyConfig(parsed, false)
    }
  } catch (e) {
    console.warn('[EconomyService] Error cargando caché local:', e)
  }

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

  // 2. Escuchar evento instantáneo por BroadcastChannel (0 ms entre pestañas/ventanas)
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('sugar_ludo_social_channel')
      channel.onmessage = (event) => {
        if (event.data?.type === 'economy_settings_updated' && event.data.payload) {
          applyEconomyConfig(event.data.payload, true)
        }
      }
    }
  } catch {}

  // 3. Escuchar eventos reactivos transmitidos por el canal SSE / Server Relay
  subscribeToP2PData((data: any) => {
    if (data && (data.dataType === 'economy_updated' || data.type === 'economy_updated')) {
      const config = data.config || data
      applyEconomyConfig(config, true)
    }
  })
}

function applyEconomyConfig(config: any, persistToCache = true) {
  if (!config) return
  lastConfig = config

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
    liveCoinPackages = config.packages.map((pkg: any) => {
      const usdtCost = pkg.priceUSDT ?? pkg.usdtCost ?? 5
      const baseCoins = pkg.coinsAmount ?? pkg.baseCoins ?? 500
      const bonusCoins = pkg.bonusCoins ?? (pkg.bonusPercent ? Math.round((baseCoins * pkg.bonusPercent) / 100) : 0)
      const totalCoins = pkg.totalCoins ?? (baseCoins + bonusCoins)
      const bonusPercent = pkg.bonusPercent ?? (baseCoins > 0 ? Math.round((bonusCoins / baseCoins) * 100) : 0)
      return {
        ...pkg,
        usdtCost,
        baseCoins,
        bonusCoins,
        bonusPercent,
        totalCoins,
        tag: pkg.badgeTag || pkg.tag
      }
    })
  }

  if (Array.isArray(config.items)) {
    config.items.forEach((it: any) => {
      if (it && it.id) {
        if (typeof it.priceCoins === 'number') {
          liveItemPrices.set(it.id, it.priceCoins)
        }
        if (typeof it.isActive === 'boolean') {
          liveItemAvailability.set(it.id, it.isActive)
        }
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

  if (typeof config.doubleXpActive === 'boolean') liveXpConfig.doubleXpActive = config.doubleXpActive
  if (typeof config.goldRushMultiplier === 'number') liveXpConfig.goldRushMultiplier = config.goldRushMultiplier
  if (typeof config.tournamentBonusPct === 'number') liveXpConfig.tournamentBonusPct = config.tournamentBonusPct

  // Guardar en caché persistente local (Esquema Híbrido Opción B)
  if (persistToCache && typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(config))
    } catch {}
  }

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

export function getLiveItemAvailability(itemId: string, defaultActive = true): boolean {
  initEconomyService()
  return liveItemAvailability.has(itemId) ? liveItemAvailability.get(itemId)! : defaultActive
}

export function getLiveConsumablesPrices(): Record<string, number> {
  initEconomyService()
  const obj: Record<string, number> = {}
  liveItemPrices.forEach((val, key) => {
    obj[key] = val
  })
  return obj
}

export function getLiveXpMultipliers() {
  initEconomyService()
  return liveXpConfig
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
