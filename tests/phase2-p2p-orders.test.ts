import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  ORDER_LOCK_TTL_MS,
  isValidOrderTransition,
  assertValidOrderTransition,
  isOrderLockActive,
  canCashierTakeOrder,
  applyOrderLock,
  releaseOrderLock,
  checkIdempotency,
  OrderTransitionError
} from '../sugar-ludo-admin-hub/lib/order-state-machine.ts'
import type { CashierOrder, OrderStatus } from '../sugar-ludo-admin-hub/types/cashier.ts'

describe('Suite: Fase 2 - Máquina de Estados e Idempotencia en Órdenes P2P', () => {
  describe('1. Matriz de Transiciones de Estados (Depósitos y Retiros)', () => {
    it('debe permitir transiciones válidas en flujo de depósito', () => {
      assert.equal(isValidOrderTransition('deposit', 'pending', 'paid'), true)
      assert.equal(isValidOrderTransition('deposit', 'paid', 'completed'), true)
      assert.equal(isValidOrderTransition('deposit', 'pending', 'cancelled'), true)
      assert.equal(isValidOrderTransition('deposit', 'paid', 'disputed'), true)
      assert.equal(isValidOrderTransition('deposit', 'disputed', 'completed'), true)
      assert.equal(isValidOrderTransition('deposit', 'disputed', 'cancelled'), true)
    })

    it('debe rechazar salto directo de pending a completed en depósitos (falta comprobante/pago)', () => {
      assert.equal(isValidOrderTransition('deposit', 'pending', 'completed'), false)
      assert.throws(
        () => assertValidOrderTransition('deposit', 'pending', 'completed'),
        (err: any) => err instanceof OrderTransitionError && err.code === 'INVALID_ORDER_TRANSITION'
      )
    })

    it('debe rechazar cualquier transición desde estados terminales (completed / cancelled)', () => {
      const terminalStates: OrderStatus[] = ['completed', 'cancelled']
      const targetStates: OrderStatus[] = ['pending', 'assigned', 'paid', 'verified', 'completed', 'disputed', 'cancelled']

      for (const terminal of terminalStates) {
        for (const target of targetStates) {
          assert.equal(isValidOrderTransition('deposit', terminal, target), false)
          assert.equal(isValidOrderTransition('withdraw', terminal, target), false)
          assert.throws(
            () => assertValidOrderTransition('deposit', terminal, target),
            OrderTransitionError
          )
        }
      }
    })

    it('debe permitir transiciones válidas en flujo de retiros', () => {
      assert.equal(isValidOrderTransition('withdraw', 'pending', 'assigned'), true)
      assert.equal(isValidOrderTransition('withdraw', 'assigned', 'completed'), true)
      assert.equal(isValidOrderTransition('withdraw', 'assigned', 'pending'), true) // liberación por timeout o manual
      assert.equal(isValidOrderTransition('withdraw', 'pending', 'cancelled'), true)
      assert.equal(isValidOrderTransition('withdraw', 'assigned', 'disputed'), true)
      assert.equal(isValidOrderTransition('withdraw', 'disputed', 'completed'), true)
      assert.equal(isValidOrderTransition('withdraw', 'disputed', 'cancelled'), true)
    })

    it('debe rechazar liquidación directa de retiro si la orden no está asignada/bloqueada', () => {
      assert.equal(isValidOrderTransition('withdraw', 'pending', 'completed'), false)
      assert.throws(
        () => assertValidOrderTransition('withdraw', 'pending', 'completed'),
        OrderTransitionError
      )
    })
  })

  describe('2. Control de Concurrencia y Bloqueo Optimista (Optimistic Locking & TTL)', () => {
    const baseWithdrawOrder: CashierOrder = {
      id: 'ord_wit_test_001',
      type: 'withdraw',
      status: 'pending',
      playerUid: 'usr_player_99',
      playerName: 'Jugador VIP',
      amountFiat: 50,
      currency: 'USDT',
      exchangeRate: 100,
      amountSugarCoins: 5000,
      cashierCommissionCoins: 150,
      paymentMethod: 'usdt_trc20',
      createdAt: Date.now() - 60000,
      expiresAt: Date.now() + 1800000,
      orderVersion: 1
    }

    it('debe permitir a un cajero tomar una orden libre en pending', () => {
      const evalResult = canCashierTakeOrder(baseWithdrawOrder, 'csh_carlosandroid_001')
      assert.equal(evalResult.canTake, true)
    })

    it('debe bloquear y actualizar versión atómica al aplicar applyOrderLock', () => {
      const now = Date.now()
      const lockedOrder = applyOrderLock(
        baseWithdrawOrder,
        'csh_carlosandroid_001',
        'carlosandroid (Cajero)',
        now
      )

      assert.equal(lockedOrder.status, 'assigned')
      assert.equal(lockedOrder.lockedByCashierUid, 'csh_carlosandroid_001')
      assert.equal(lockedOrder.lockedByCashierName, 'carlosandroid (Cajero)')
      assert.equal(lockedOrder.lockedAt, now)
      assert.equal(lockedOrder.lockExpiresAt, now + ORDER_LOCK_TTL_MS)
      assert.equal(lockedOrder.orderVersion, 2)
    })

    it('debe rechazar con conflicto si otro cajero intenta tomar una orden bloqueada con TTL vigente', () => {
      const now = Date.now()
      const lockedOrder = applyOrderLock(
        baseWithdrawOrder,
        'csh_carlosandroid_001',
        'carlosandroid (Cajero)',
        now
      )

      const evalSecondCashier = canCashierTakeOrder(lockedOrder, 'csh_otro_cajero_002', now + 1000)
      assert.equal(evalSecondCashier.canTake, false)
      assert.equal(evalSecondCashier.reason, 'ORDER_LOCKED_BY_OTHER_CASHIER')
    })

    it('debe permitir al mismo cajero refrescar o mantener su propio bloqueo', () => {
      const now = Date.now()
      const lockedOrder = applyOrderLock(
        baseWithdrawOrder,
        'csh_carlosandroid_001',
        'carlosandroid (Cajero)',
        now
      )

      const evalSameCashier = canCashierTakeOrder(lockedOrder, 'csh_carlosandroid_001', now + 2000)
      assert.equal(evalSameCashier.canTake, true)
    })

    it('debe permitir que otro cajero tome la orden si el TTL de 10 minutos ya expiró', () => {
      const lockedAt = Date.now() - (ORDER_LOCK_TTL_MS + 5000) // Expiró hace 5s
      const expiredLockedOrder: CashierOrder = {
        ...baseWithdrawOrder,
        status: 'assigned',
        lockedByCashierUid: 'csh_carlosandroid_001',
        lockedAt,
        lockExpiresAt: lockedAt + ORDER_LOCK_TTL_MS,
        orderVersion: 2
      }

      assert.equal(isOrderLockActive(expiredLockedOrder, Date.now()), false)
      const evalExpired = canCashierTakeOrder(expiredLockedOrder, 'csh_nuevo_cajero_003', Date.now())
      assert.equal(evalExpired.canTake, true)
    })

    it('debe liberar correctamente la orden con releaseOrderLock y regresar a pending', () => {
      const now = Date.now()
      const lockedOrder = applyOrderLock(
        baseWithdrawOrder,
        'csh_carlosandroid_001',
        'carlosandroid (Cajero)',
        now
      )

      const releasedOrder = releaseOrderLock(lockedOrder, 'csh_carlosandroid_001')
      assert.equal(releasedOrder.status, 'pending')
      assert.equal(releasedOrder.lockedByCashierUid, undefined)
      assert.equal(releasedOrder.lockedAt, undefined)
      assert.equal(releasedOrder.lockExpiresAt, undefined)
      assert.equal(releasedOrder.orderVersion, 3)
    })
  })

  describe('3. Llaves de Idempotencia y Blindaje Anti-Doble Clic', () => {
    const processedOrder: CashierOrder = {
      id: 'ord_dep_001',
      type: 'deposit',
      status: 'completed',
      playerUid: 'usr_player_1',
      playerName: 'Player 1',
      amountFiat: 20,
      currency: 'USD',
      exchangeRate: 100,
      amountSugarCoins: 2000,
      cashierCommissionCoins: 40,
      paymentMethod: 'pago_movil',
      createdAt: Date.now() - 300000,
      expiresAt: Date.now() + 300000,
      lastIdempotencyKey: 'IDEMP_KEY_ABC_123'
    }

    it('debe detectar petición duplicada cuando la llave de idempotencia coincide', () => {
      const result = checkIdempotency(processedOrder, 'IDEMP_KEY_ABC_123')
      assert.equal(result.isDuplicate, true)
      assert.equal(result.status, 'completed')
    })

    it('debe permitir la ejecución si la llave de idempotencia es nueva o diferente', () => {
      const result = checkIdempotency(processedOrder, 'IDEMP_KEY_NEW_456')
      // Aunque esté completed, la llave es distinta (la máquina de estados rechazará por completed)
      assert.equal(result.isDuplicate, false)
    })

    it('debe ignorar validación de duplicado si no se envía llave de idempotencia', () => {
      const result = checkIdempotency(processedOrder, undefined)
      assert.equal(result.isDuplicate, false)
    })
  })
})
