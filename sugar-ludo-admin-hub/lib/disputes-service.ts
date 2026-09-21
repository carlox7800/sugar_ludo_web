/**
 * SUGAR LUDO ADMIN HUB - SERVICIO DE CONTEO Y NOTIFICACIONES DE DISPUTAS PENDIENTES
 * 
 * Monitorea en tiempo real los casos de soporte y disputas en estado pendiente ('open' o 'investigating').
 * Al resolverse un ticket con dictamen ('resolved_player', 'resolved_cashier', 'dismissed', 'compensated'),
 * el contador se actualiza inmediatamente en 0ms.
 * Cuenta con pausa reactiva al ocultar la pestaña para mantener costo estricto $0.00 en Spark.
 */

import { db } from './firebase.ts'
import { collection, query, onSnapshot, limit } from 'firebase/firestore'

export interface PendingDisputesSummary {
  financial: number
  gameplay: number
  account: number
  total: number
}

/**
 * Determina de forma unificada si un estatus de ticket requiere atención pendiente
 */
export function isPendingDisputeStatus(status: string | undefined | null): boolean {
  if (!status) return true
  return status === 'open' || status === 'investigating'
}

/**
 * Clasifica una lista de disputas en conteos de casos estrictamente pendientes por dominio
 */
export function calculatePendingDisputesCounts(disputes: Array<{ domain?: string; category?: string; orderId?: string; status?: string }>): PendingDisputesSummary {
  let financial = 0
  let gameplay = 0
  let account = 0

  for (const item of disputes) {
    if (!isPendingDisputeStatus(item.status)) {
      continue
    }

    const rawCategory = item.category || (item.orderId && item.orderId !== 'none' ? 'transactions' : 'account')
    const domain =
      item.domain ||
      (rawCategory === 'transactions' || (item.orderId && item.orderId !== 'none')
        ? 'financial'
        : rawCategory === 'gameplay'
        ? 'gameplay'
        : 'account')

    if (domain === 'financial') {
      financial++
    } else if (domain === 'gameplay') {
      gameplay++
    } else {
      account++
    }
  }

  return {
    financial,
    gameplay,
    account,
    total: financial + gameplay + account
  }
}

/**
 * Suscribe a los contadores de tickets pendientes en tiempo real
 */
export function subscribeToPendingDisputesCount(
  callback: (summary: PendingDisputesSummary) => void
): () => void {
  if (typeof window === 'undefined') return () => {}

  let unsubSnapshot: (() => void) | null = null

  const startListener = () => {
    if (document.hidden) return
    if (unsubSnapshot) return

    try {
      const q = query(collection(db, 'dispute_cases'), limit(100))
      unsubSnapshot = onSnapshot(
        q,
        (snap) => {
          const rawItems = snap.docs.map((d) => d.data() as any)
          const summary = calculatePendingDisputesCounts(rawItems)
          callback(summary)
        },
        (err) => {
          console.warn('[DisputesService] Error en snapshot de disputas pendientes:', err)
        }
      )
    } catch (err) {
      console.warn('[DisputesService] Error inicializando listener:', err)
    }
  }

  const stopListener = () => {
    if (unsubSnapshot) {
      unsubSnapshot()
      unsubSnapshot = null
    }
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopListener()
    } else {
      startListener()
    }
  }

  startListener()
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    stopListener()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}
