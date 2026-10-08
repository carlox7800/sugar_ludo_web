import { CashierOrder } from '../types/cashier'
import { db } from './firebase'
import { collection, query, limit, onSnapshot } from 'firebase/firestore'
import { cashierLogger } from './cashier-logger'

interface CachedOrdersState {
  orders: CashierOrder[]
  timestamp: number
}

// Module-level singleton that persists across Next.js client router transitions
let memoryCache: CachedOrdersState | null = null

export const OrdersCache = {
  get: (): CashierOrder[] | null => {
    if (!memoryCache) {
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('sugar_cashier_orders')
          if (raw) {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed) && parsed.length > 0) {
              memoryCache = { orders: parsed, timestamp: Date.now() - 5000 }
              return parsed
            }
          }
        } catch {}
      }
      return null
    }
    return memoryCache.orders
  },

  set: (orders: CashierOrder[]) => {
    memoryCache = {
      orders,
      timestamp: Date.now()
    }
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('sugar_cashier_orders', JSON.stringify(orders))
      } catch {}
    }
  },

  updateOrder: (order: CashierOrder) => {
    const current = OrdersCache.get() || []
    const updated = [order, ...current.filter((o) => o.id !== order.id)]
    OrdersCache.set(updated)
    return updated
  },

  isStale: (maxAgeMs: number = 30000): boolean => {
    if (!memoryCache) return true
    return Date.now() - memoryCache.timestamp > maxAgeMs
  },

  invalidate: () => {
    memoryCache = null
  }
}

/**
 * SINGLETON SUBSCRIPTION MANAGER (SPARK PLAN $0.00 COST GUARD)
 * Mantiene un único listener onSnapshot de Firestore en cashier_orders
 * compartido entre todos los componentes y pestañas mediante Reference Counting.
 * Se desuscribe automáticamente si la pestaña se oculta (Page Visibility API)
 * o si no quedan componentes activos.
 */
type OrdersDataCallback = (orders: CashierOrder[]) => void
type OrdersErrorCallback = (error: any) => void

interface SubscriberEntry {
  id: string
  onData: OrdersDataCallback
  onError?: OrdersErrorCallback
}

let activeFirestoreUnsubscribe: (() => void) | null = null
const activeSubscribers = new Map<string, SubscriberEntry>()
let isVisibilityListenerAttached = false

function startFirestoreListenerIfNeeded() {
  if (typeof window === 'undefined') return
  if (typeof document !== 'undefined' && document.hidden) return
  if (activeFirestoreUnsubscribe) return
  if (activeSubscribers.size === 0) return

  try {
    cashierLogger.firestore('Iniciando listener onSnapshot SINGLETON en cashier_orders (limit 20)')
    const q = query(collection(db, 'cashier_orders'), limit(20))
    activeFirestoreUnsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const liveOrders: CashierOrder[] = []
        snapshot.forEach((docSnap) => {
          liveOrders.push({ ...docSnap.data(), id: docSnap.id } as CashierOrder)
        })
        cashierLogger.firestore('Singleton onSnapshot recibió actualización de colección', { totalDocs: liveOrders.length })
        OrdersCache.set(liveOrders)
        activeSubscribers.forEach((sub) => {
          try {
            sub.onData(liveOrders)
          } catch (cbErr) {
            console.error('[OrdersSingleton] Error en callback de suscriptor:', cbErr)
          }
        })
      },
      (err) => {
        cashierLogger.error('Error en listener singleton de cashier_orders', {
          code: err?.code,
          message: err?.message
        })
        activeSubscribers.forEach((sub) => {
          if (sub.onError) {
            try {
              sub.onError(err)
            } catch {}
          }
        })
      }
    )
  } catch (err: any) {
    cashierLogger.error('Excepción al conectar listener singleton de cashier_orders', { message: err?.message })
  }
}

function stopFirestoreListenerIfIdle() {
  if (activeFirestoreUnsubscribe) {
    cashierLogger.firestore('Desconectando listener onSnapshot SINGLETON de cashier_orders (0 suscriptores o pestaña oculta)')
    try {
      activeFirestoreUnsubscribe()
    } catch {}
    activeFirestoreUnsubscribe = null
  }
}

function handlePageVisibility() {
  if (typeof document === 'undefined') return
  if (document.hidden) {
    stopFirestoreListenerIfIdle()
  } else {
    startFirestoreListenerIfNeeded()
  }
}

export function subscribeToLiveOrdersSingleton(
  onData: OrdersDataCallback,
  onError?: OrdersErrorCallback
): () => void {
  if (typeof window === 'undefined') return () => {}

  const subId = `sub_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  activeSubscribers.set(subId, { id: subId, onData, onError })

  // 1. Entregar de inmediato caché previa si existe (0ms)
  const cached = OrdersCache.get()
  if (cached && cached.length > 0) {
    try {
      onData(cached)
    } catch {}
  }

  // 2. Adjuntar Page Visibility API una sola vez globalmente
  if (!isVisibilityListenerAttached && typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', handlePageVisibility)
    isVisibilityListenerAttached = true
  }

  // 3. Iniciar listener de Firestore si es el primer suscriptor y la página es visible
  startFirestoreListenerIfNeeded()

  return () => {
    activeSubscribers.delete(subId)
    if (activeSubscribers.size === 0) {
      stopFirestoreListenerIfIdle()
    }
  }
}

