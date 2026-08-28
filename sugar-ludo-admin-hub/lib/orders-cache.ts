import { CashierOrder } from '../types/cashier'

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
