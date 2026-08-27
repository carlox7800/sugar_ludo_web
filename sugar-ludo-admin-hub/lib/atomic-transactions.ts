import { adminDb, admin } from './firebase-admin'
import { CashierOrder, CashierProfile, DailyStats, AuditLog } from '../types/cashier'

/**
 * ============================================================================
 * TRANSACCIONES ATÓMICAS FINANCIERAS (PREVENCIÓN DE DOBLE GASTO / ESCROW)
 * ============================================================================
 */

function getTodayDateStr(): string {
  const now = new Date()
  return now.toISOString().split('T')[0]
}

/**
 * 1. APROBAR DEPÓSITO (Cajero valida comprobante bancario -> Saldo acreditado al jugador)
 */
export async function approveDepositOrder(params: {
  orderId: string
  cashierUid: string
  referenceNumber?: string
  actorUid: string
  actorRole: string
  ipAddress?: string
  userAgent?: string
}): Promise<{ success: boolean; message: string }> {
  const { orderId, cashierUid, referenceNumber, actorUid, actorRole, ipAddress, userAgent } = params

  return await (adminDb as any).runTransaction(async (transaction: any) => {
    const orderRef = adminDb.collection('cashier_orders').doc(orderId)
    const orderSnap = await transaction.get(orderRef)

    if (!orderSnap.exists) {
      throw new Error('La orden de depósito no existe')
    }

    const order = orderSnap.data() as CashierOrder
    if (order.status === 'completed') {
      throw new Error('La orden ya fue completada previamente')
    }
    if (order.type !== 'deposit') {
      throw new Error('La orden no es de tipo depósito')
    }

    const playerRef = adminDb.collection('users').doc(order.playerUid)
    const cashierRef = adminDb.collection('cashier_profiles').doc(cashierUid)
    const dailyStatsRef = adminDb.collection('daily_stats').doc(getTodayDateStr())

    const [playerSnap, cashierSnap, statsSnap] = await Promise.all([
      transaction.get(playerRef),
      transaction.get(cashierRef),
      transaction.get(dailyStatsRef)
    ])

    if (!playerSnap.exists) throw new Error('El jugador no existe')
    if (!cashierSnap.exists) throw new Error('El perfil del cajero no existe')

    const playerData = playerSnap.data() || {}
    const cashierData = cashierSnap.data() as CashierProfile

    const amountCoins = Number(order.amountSugarCoins)
    const commissionCoins = Number(order.cashierCommissionCoins || (amountCoins * 0.02))

    // Validar que el cajero tenga suficiente saldo flotante de garantía
    const currentCashierFloat = Number(cashierData.floatBalanceCoins || 0)
    if (currentCashierFloat < amountCoins) {
      throw new Error(`Saldo flotante de cajero insuficiente (${currentCashierFloat} < ${amountCoins} SC)`)
    }

    const previousPlayerCoins = Number(playerData.coins || 0)
    const newPlayerCoins = previousPlayerCoins + amountCoins
    const newCashierFloat = currentCashierFloat - amountCoins
    const newCashierCommissions = Number(cashierData.totalCommissionEarnedCoins || 0) + commissionCoins

    const now = Date.now()

    // 1. Actualizar Orden
    transaction.update(orderRef, {
      status: 'completed',
      receiptReferenceNumber: referenceNumber || order.receiptReferenceNumber || 'CONFIRMED',
      completedAt: now,
      verifiedAt: now
    })

    // 2. Acreditar Sugar Coins al Jugador
    transaction.update(playerRef, {
      coins: newPlayerCoins,
      lastActiveAt: now
    })

    // 3. Debitar Saldo Flotante al Cajero y sumar comisión
    transaction.update(cashierRef, {
      floatBalanceCoins: newCashierFloat,
      totalCommissionEarnedCoins: newCashierCommissions,
      totalOrdersCompleted: (cashierData.totalOrdersCompleted || 0) + 1,
      lastActiveAt: now
    })

    // 4. Actualizar Estadísticas Diarias Atómicas ($0.00 lecturas)
    if (statsSnap.exists) {
      transaction.update(dailyStatsRef, {
        totalDepositsFiatUSD: admin.firestore.FieldValue.increment(order.amountFiat || 0),
        totalDepositsCount: admin.firestore.FieldValue.increment(1),
        totalSugarCoinsIssued: admin.firestore.FieldValue.increment(amountCoins),
        totalCommissionsPaidCoins: admin.firestore.FieldValue.increment(commissionCoins),
        updatedAt: now
      })
    } else {
      transaction.set(dailyStatsRef, {
        dateStr: getTodayDateStr(),
        totalDepositsFiatUSD: order.amountFiat || 0,
        totalWithdrawalsFiatUSD: 0,
        totalDepositsCount: 1,
        totalWithdrawalsCount: 0,
        totalSugarCoinsIssued: amountCoins,
        totalSugarCoinsBurned: 0,
        totalCommissionsPaidCoins: commissionCoins,
        peakConcurrentPlayers: 0,
        activeCashiersCount: 1,
        updatedAt: now
      })
    }

    // 5. Grabar Registro Inmutable de Auditoría
    const auditRef = adminDb.collection('audit_logs').doc()
    const auditLog: AuditLog = {
      id: auditRef.id,
      action: 'DEPOSIT_APPROVED',
      actorUid,
      actorRole,
      targetUid: order.playerUid,
      targetOrderId: orderId,
      amountCoins,
      amountFiat: order.amountFiat,
      currency: order.currency,
      previousBalance: previousPlayerCoins,
      newBalance: newPlayerCoins,
      ipAddress,
      userAgent,
      notes: `Depósito acreditado (+${amountCoins} SC) por Cajero ${cashierData.name}`,
      timestamp: now
    }
    transaction.set(auditRef, auditLog)

    return {
      success: true,
      message: `Depósito de +${amountCoins} SC acreditado con éxito al jugador.`
    }
  })
}

/**
 * 2. SOLICITUD DE RETIRO (Jugador solicita dinero real -> Bloqueo en Escrow)
 */
export async function createWithdrawOrderWithEscrow(params: {
  playerUid: string
  playerName: string
  amountSugarCoins: number
  amountFiat: number
  currency: string
  paymentMethod: any
  playerPaymentAccount: any
}): Promise<{ success: boolean; orderId: string }> {
  const { playerUid, playerName, amountSugarCoins, amountFiat, currency, paymentMethod, playerPaymentAccount } = params

  return await (adminDb as any).runTransaction(async (transaction: any) => {
    const playerRef = adminDb.collection('users').doc(playerUid)
    const playerSnap = await transaction.get(playerRef)

    if (!playerSnap.exists) throw new Error('Jugador no encontrado')

    const currentCoins = Number(playerSnap.data()?.coins || 0)
    if (currentCoins < amountSugarCoins) {
      throw new Error('Saldo insuficiente para realizar el retiro')
    }

    const now = Date.now()
    const newCoins = currentCoins - amountSugarCoins

    // 1. Congelar saldo del jugador (Escrow)
    transaction.update(playerRef, {
      coins: newCoins,
      escrowLockedCoins: admin.firestore.FieldValue.increment(amountSugarCoins)
    })

    // 2. Crear orden en estado pending
    const orderRef = adminDb.collection('cashier_orders').doc()
    const newOrder: CashierOrder = {
      id: orderRef.id,
      type: 'withdraw',
      status: 'pending',
      playerUid,
      playerName,
      amountFiat,
      currency,
      exchangeRate: amountSugarCoins / (amountFiat || 1),
      amountSugarCoins,
      cashierCommissionCoins: Math.round(amountSugarCoins * 0.03),
      paymentMethod,
      playerPaymentAccount,
      isEscrowLocked: true,
      escrowLockedAt: now,
      createdAt: now,
      expiresAt: now + (30 * 60 * 1000) // 30 minutos
    }

    transaction.set(orderRef, newOrder)

    return { success: true, orderId: orderRef.id }
  })
}
