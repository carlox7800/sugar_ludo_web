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

    if (!playerSnap.exists) {
      // Si el jugador no existe como doc, crear registro base
      transaction.set(playerRef, {
        uid: order.playerUid,
        displayName: order.playerName || 'Jugador',
        coins: Number(order.amountSugarCoins),
        walletHistory: [{
          id: `tx_${Date.now()}`,
          type: 'deposit',
          amount: Number(order.amountSugarCoins),
          description: `Depósito P2P Aprobado (#${order.id.slice(0, 8)})`,
          timestamp: Date.now(),
          dateStr: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        }],
        createdAt: Date.now(),
        lastActiveAt: Date.now()
      })
    }

    const playerData = playerSnap.exists ? (playerSnap.data() || {}) : {}
    const cashierData = cashierSnap.exists ? (cashierSnap.data() as CashierProfile) : {
      uid: cashierUid,
      name: 'Cajero Autorizado',
      floatBalanceCoins: 50000,
      totalCommissionEarnedCoins: 0,
      totalOrdersCompleted: 0
    }

    const amountCoins = Number(order.amountSugarCoins)
    const commissionCoins = Number(order.cashierCommissionCoins || (amountCoins * 0.02))

    const currentCashierFloat = Number(cashierData.floatBalanceCoins || 50000)
    const previousPlayerCoins = Number(playerData.coins || 0)
    const newPlayerCoins = previousPlayerCoins + amountCoins
    const newCashierFloat = Math.max(0, currentCashierFloat - amountCoins)
    const newCashierCommissions = Number(cashierData.totalCommissionEarnedCoins || 0) + commissionCoins

    const now = Date.now()
    const finalRef = referenceNumber || order.receiptReferenceNumber || `TX-${Date.now().toString(36).toUpperCase()}`

    // 1. Actualizar Orden
    transaction.update(orderRef, {
      status: 'completed',
      receiptReferenceNumber: finalRef,
      completedAt: now,
      verifiedAt: now
    })

    // 2. Acreditar Sugar Coins al Jugador y agregar al historial de transacciones
    if (playerSnap.exists) {
      const existingHistory = Array.isArray(playerData.walletHistory) ? playerData.walletHistory : []
      const newTxEntry = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'deposit',
        amount: amountCoins,
        description: `Depósito P2P Aprobado (#${order.id.slice(0, 8)})`,
        timestamp: now,
        dateStr: new Date().toLocaleDateString('es-ES', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric', 
          hour: '2-digit', 
          minute: '2-digit' 
        })
      }
      const updatedHistory = [newTxEntry, ...existingHistory.filter((t: any) => t.id !== newTxEntry.id)].slice(0, 50)

      transaction.update(playerRef, {
        coins: newPlayerCoins,
        walletHistory: updatedHistory,
        lastActiveAt: now
      })
    }

    // 3. Actualizar Saldo Flotante del Cajero
    if (cashierSnap.exists) {
      transaction.update(cashierRef, {
        floatBalanceCoins: newCashierFloat,
        totalCommissionEarnedCoins: newCashierCommissions,
        totalOrdersCompleted: (cashierData.totalOrdersCompleted || 0) + 1,
        lastActiveAt: now
      })
    } else {
      transaction.set(cashierRef, {
        uid: cashierUid,
        name: 'Cajero Autorizado',
        floatBalanceCoins: newCashierFloat,
        totalCommissionEarnedCoins: newCashierCommissions,
        totalOrdersCompleted: 1,
        lastActiveAt: now
      })
    }

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

/**
 * 3. RESOLUCIÓN ATÓMICA DE DISPUTAS (Arbitraje Super Admin)
 */
export async function resolveDisputeCaseAtomics(params: {
  disputeId: string
  verdict: 'favor_player' | 'favor_cashier'
  adminUid: string
  adminName: string
  resolutionNotes?: string
}): Promise<{ success: boolean; message: string }> {
  const { disputeId, verdict, adminUid, adminName, resolutionNotes } = params

  return await (adminDb as any).runTransaction(async (transaction: any) => {
    const disputeRef = adminDb.collection('dispute_cases').doc(disputeId)
    const disputeSnap = await transaction.get(disputeRef)

    const now = Date.now()

    if (disputeSnap.exists) {
      const disputeData = disputeSnap.data() || {}
      const orderRef = adminDb.collection('cashier_orders').doc(disputeData.orderId || disputeId)
      const playerRef = adminDb.collection('users').doc(disputeData.playerUid)
      const cashierRef = adminDb.collection('cashier_profiles').doc(disputeData.cashierUid)

      const [playerSnap, cashierSnap] = await Promise.all([
        transaction.get(playerRef),
        transaction.get(cashierRef)
      ])

      const amountCoins = Number(disputeData.amountSugarCoins || 0)

      if (verdict === 'favor_player') {
        if (playerSnap.exists) {
          const currentCoins = Number(playerSnap.data()?.coins || 0)
          transaction.update(playerRef, { coins: currentCoins + amountCoins })
        }
        if (cashierSnap.exists) {
          const currentFloat = Number(cashierSnap.data()?.floatBalanceCoins || 0)
          transaction.update(cashierRef, { floatBalanceCoins: Math.max(0, currentFloat - amountCoins) })
        }
        transaction.update(disputeRef, {
          status: 'resolved_player',
          resolvedBy: adminName,
          resolvedByUid: adminUid,
          resolvedAt: now,
          resolutionNotes: resolutionNotes || 'Dictamen favorable emitido para el jugador. Fondos acreditados.'
        })
        transaction.update(orderRef, { status: 'completed', completedAt: now })
      } else {
        // Favor del cajero
        if (cashierSnap.exists) {
          const currentFloat = Number(cashierSnap.data()?.floatBalanceCoins || 0)
          transaction.update(cashierRef, { floatBalanceCoins: currentFloat + amountCoins })
        }
        transaction.update(disputeRef, {
          status: 'resolved_cashier',
          resolvedBy: adminName,
          resolvedByUid: adminUid,
          resolvedAt: now,
          resolutionNotes: resolutionNotes || 'Dictamen favorable emitido para el cajero. Fondos de garantía liberados.'
        })
        transaction.update(orderRef, { status: 'cancelled', completedAt: now })
      }
    }

    return {
      success: true,
      message: `Veredicto atómico ejecutado: ${verdict === 'favor_player' ? 'Acreditado al Jugador' : 'Liberado al Cajero'}.`
    }
  })
}

/**
 * 4. COMPLETAR LIQUIDACIÓN DE RETIRO (Cajero envía fondos fiat/USDT y liquida la orden)
 */
export async function completeWithdrawalOrder(params: {
  orderId: string
  cashierUid: string
  payoutTxId: string
  actorUid: string
  actorRole: 'admin' | 'cashier'
}): Promise<{ success: boolean; message: string }> {
  const { orderId, cashierUid, payoutTxId, actorUid, actorRole } = params
  const now = Date.now()

  return await (adminDb as any).runTransaction(async (transaction: any) => {
    const orderRef = adminDb.collection('cashier_orders').doc(orderId)
    const orderSnap = await transaction.get(orderRef)

    if (!orderSnap.exists) {
      throw new Error(`La orden #${orderId} no existe.`)
    }

    const order = orderSnap.data() as CashierOrder
    if (order.status === 'completed') {
      return { success: true, message: 'La orden ya se encuentra completada.' }
    }

    const amountCoins = Number(order.amountSugarCoins || 0)
    const commissionCoins = Number(order.cashierCommissionCoins || Math.round(amountCoins * 0.03))

    // 1. Actualizar orden a completed
    transaction.update(orderRef, {
      status: 'completed',
      receiptReferenceNumber: payoutTxId,
      completedAt: now,
      isEscrowLocked: false,
      settledByCashierUid: cashierUid
    })

    // 2. Acreditar comisión y liberar saldo al cajero
    const cashierRef = adminDb.collection('cashier_profiles').doc(cashierUid)
    const cashierSnap = await transaction.get(cashierRef)
    if (cashierSnap.exists) {
      transaction.update(cashierRef, {
        totalOrdersCompleted: admin.firestore.FieldValue.increment(1),
        totalCommissionsEarnedCoins: admin.firestore.FieldValue.increment(commissionCoins),
        lastActiveAt: now
      })
    }

    // 3. Registrar auditoría
    const auditRef = adminDb.collection('audit_logs').doc()
    const auditLog: AuditLog = {
      id: auditRef.id,
      action: 'WITHDRAW_COMPLETED',
      actorUid,
      actorRole,
      targetUid: order.playerUid,
      targetOrderId: orderId,
      amountCoins,
      amountFiat: order.amountFiat,
      currency: order.currency,
      notes: `Liquidación de retiro completada con TxID/Ref: ${payoutTxId}`,
      timestamp: now
    }
    transaction.set(auditRef, auditLog)

    return {
      success: true,
      message: `Retiro #${orderId.slice(0, 8)} liquidado con éxito.`
    }
  })
}
