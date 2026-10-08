/**
 * ============================================================================
 * SUGAR LUDO - MÁQUINA DE ESTADOS FINITA, CONCURRENCIA E IDEMPOTENCIA P2P (FASE 2)
 * ============================================================================
 * Reglas estrictas:
 * 1. Transiciones de estado deterministas e inviolables para depósitos y retiros.
 * 2. Bloqueo optimista (Optimistic Locking) con TTL de 10 minutos para evitar
 *    que dos cajeros procesen o liberen la misma orden en paralelo.
 * 3. Idempotencia criptográfica/semántica para proteger débitos/créditos contra
 *    doble clic o reintentos automáticos HTTP.
 * 4. Costo $0.00 en cuota Spark de Firebase Firestore.
 */

import type { CashierOrder, OrderStatus, OrderType } from '../types/cashier.ts'

export const ORDER_LOCK_TTL_MS = 10 * 60 * 1000 // 10 minutos

export class OrderTransitionError extends Error {
  public readonly code: string
  public readonly fromStatus?: OrderStatus
  public readonly toStatus?: OrderStatus

  constructor(message: string, code = 'INVALID_ORDER_TRANSITION', from?: OrderStatus, to?: OrderStatus) {
    super(message)
    this.name = 'OrderTransitionError'
    this.code = code
    this.fromStatus = from
    this.toStatus = to
  }
}

/**
 * Matriz de transiciones permitidas para depósitos.
 * Flujo canónico: pending -> paid (recibo adjunto) -> completed (saldo acreditado)
 */
const ALLOWED_DEPOSIT_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['paid', 'cancelled'],
  assigned: ['paid', 'cancelled'],
  paid: ['completed', 'disputed', 'verified'],
  verified: ['completed', 'disputed'],
  disputed: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}

/**
 * Matriz de transiciones permitidas para retiros.
 * Flujo canónico: pending -> assigned (bloqueado por cajero) -> completed (liquidado)
 */
const ALLOWED_WITHDRAW_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['completed', 'pending', 'disputed', 'cancelled'],
  paid: ['completed', 'disputed'],
  verified: ['completed', 'disputed'],
  disputed: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}

/**
 * Evalúa si una transición de estado es válida según el tipo de orden.
 */
export function isValidOrderTransition(
  type: OrderType,
  from: OrderStatus,
  to: OrderStatus
): boolean {
  const matrix = type === 'deposit' ? ALLOWED_DEPOSIT_TRANSITIONS : ALLOWED_WITHDRAW_TRANSITIONS
  const allowed = matrix[from] || []
  return allowed.includes(to)
}

/**
 * Lanza un error formal si la transición solicitada no está permitida.
 */
export function assertValidOrderTransition(
  type: OrderType,
  from: OrderStatus,
  to: OrderStatus
): void {
  if (!isValidOrderTransition(type, from, to)) {
    throw new OrderTransitionError(
      `Transición de estado inválida para orden tipo '${type}': no se permite cambiar de '${from}' a '${to}'.`,
      'INVALID_ORDER_TRANSITION',
      from,
      to
    )
  }
}

/**
 * Verifica si el bloqueo de una orden sigue activo y vigente según su TTL.
 */
export function isOrderLockActive(
  order: { lockedByCashierUid?: string; lockedAt?: number; lockExpiresAt?: number },
  now = Date.now(),
  ttlMs = ORDER_LOCK_TTL_MS
): boolean {
  if (!order.lockedByCashierUid) return false
  if (order.lockExpiresAt !== undefined) {
    return now < order.lockExpiresAt
  }
  if (order.lockedAt !== undefined) {
    return now - order.lockedAt < ttlMs
  }
  return false
}

/**
 * Evalúa si un cajero específico puede tomar o bloquear una orden.
 */
export function canCashierTakeOrder(
  order: CashierOrder,
  cashierUid: string,
  now = Date.now(),
  ttlMs = ORDER_LOCK_TTL_MS
): { canTake: boolean; reason?: string } {
  if (order.status === 'completed' || order.status === 'cancelled') {
    return { canTake: false, reason: 'ORDER_TERMINATED' }
  }

  const hasActiveLock = isOrderLockActive(order, now, ttlMs)
  if (hasActiveLock) {
    // Si la orden ya está bloqueada por el mismo cajero, se permite refrescar
    if (order.lockedByCashierUid === cashierUid) {
      return { canTake: true }
    }
    // Si está bloqueada por otro cajero y el lock no ha expirado, rechazar con conflicto
    return { canTake: false, reason: 'ORDER_LOCKED_BY_OTHER_CASHIER' }
  }

  // Si no está bloqueada o el lock ya expiró
  return { canTake: true }
}

/**
 * Aplica el bloqueo optimista a una orden asignándola al cajero e incrementando su versión.
 */
export function applyOrderLock(
  order: CashierOrder,
  cashierUid: string,
  cashierName?: string,
  now = Date.now(),
  ttlMs = ORDER_LOCK_TTL_MS
): CashierOrder {
  return {
    ...order,
    status: order.type === 'withdraw' ? 'assigned' : order.status,
    lockedByCashierUid: cashierUid,
    lockedByCashierName: cashierName || order.lockedByCashierName,
    lockedAt: now,
    lockExpiresAt: now + ttlMs,
    orderVersion: (order.orderVersion || 1) + 1
  }
}

/**
 * Libera el bloqueo de una orden devolviéndola al estado pending para que otro cajero pueda atenderla.
 */
export function releaseOrderLock(
  order: CashierOrder,
  cashierUid?: string
): CashierOrder {
  return {
    ...order,
    status: order.type === 'withdraw' ? 'pending' : order.status,
    lockedByCashierUid: undefined,
    lockedByCashierName: undefined,
    lockedAt: undefined,
    lockExpiresAt: undefined,
    orderVersion: (order.orderVersion || 1) + 1
  }
}

/**
 * Valida idempotencia: determina si la orden ya fue procesada con la misma llave.
 */
export function checkIdempotency(
  order: CashierOrder,
  idempotencyKey?: string
): { isDuplicate: boolean; status?: OrderStatus } {
  if (!idempotencyKey || typeof idempotencyKey !== 'string') {
    return { isDuplicate: false }
  }

  if (order.lastIdempotencyKey && order.lastIdempotencyKey === idempotencyKey) {
    return { isDuplicate: true, status: order.status }
  }

  return { isDuplicate: false }
}
