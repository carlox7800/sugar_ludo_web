import { subscribeToP2PData } from './friends-service'

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

// In-Memory RAM Cache en el cliente de juego ($0.00 Firestore)
let liveEconomyMatrix: Record<number, EconomyMatrixEntry> = { ...DEFAULT_ECONOMY_MATRIX }
let liveCoinPackages: any[] | null = null
let isInitialized = false

const listeners = new Set<() => void>()

export function initEconomyService() {
  if (typeof window === 'undefined' || isInitialized) return
  isInitialized = true

  // Escuchar eventos reactivos transmitidos por el canal SSE / Server Relay
  subscribeToP2PData((data: any) => {
    if (data && (data.dataType === 'economy_updated' || data.type === 'economy_updated')) {
      const config = data.config || data
      if (config.matrix) {
        liveEconomyMatrix = { ...DEFAULT_ECONOMY_MATRIX, ...config.matrix }
      }
      if (config.coinPackages) {
        liveCoinPackages = config.coinPackages
      }
      // Notificar a componentes suscritos
      listeners.forEach((cb) => cb())
    }
  })
}

export function getLiveEconomyMatrix(): Record<number, EconomyMatrixEntry> {
  initEconomyService()
  return liveEconomyMatrix || DEFAULT_ECONOMY_MATRIX
}

export function getLiveCoinPackages(): any[] | null {
  initEconomyService()
  return liveCoinPackages
}

export function subscribeToEconomyUpdates(cb: () => void): () => void {
  initEconomyService()
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}
