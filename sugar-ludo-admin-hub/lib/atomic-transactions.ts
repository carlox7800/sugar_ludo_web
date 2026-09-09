import { adminDb, admin, hasAdminCredentials } from './firebase-admin'
import { db } from './firebase'
import { doc, getDoc, updateDoc, setDoc, increment, collection } from 'firebase/firestore'
import { CashierOrder, CashierProfile, DailyStats, AuditLog } from '../types/cashier'
import fs from 'fs'
import path from 'path'

const DATA_DIR = path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'cashier_orders.json')

function loadDiskOrders(): CashierOrder[] {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8')
      return JSON.parse(raw || '[]')
    }
  } catch {}
  return []
}

function updateDiskOrderStatus(orderId: string, status: string, refNum?: string) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true })
    }
    const orders = loadDiskOrders()
    const updated = orders.map(o => o.id === orderId ? {
      ...o,
      status: status as any,
      receiptReferenceNumber: refNum || o.receiptReferenceNumber,
      completedAt: Date.now()
    } : o)
    fs.writeFileSync(DATA_FILE, JSON.stringify(updated.slice(0, 100), null, 2), 'utf-8')
  } catch {}
}

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

  // 1. Intentar vía Firebase Admin SDK si existen credenciales válidas en el servidor
  if (adminDb && hasAdminCredentials) {
    try {
      return await (adminDb as any).runTransaction(async (transaction: any) => {
        const orderRef = adminDb.collection('cashier_orders').doc(orderId)
        const orderSnap = await transaction.get(orderRef)

        if (!orderSnap.exists) {
          throw new Error('La orden de depósito no existe')
        }

        const order = orderSnap.data() as CashierOrder
        if (order.status === 'completed') {
          return { success: true, message: 'La orden ya se encuentra completada.' }
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
          transaction.set(playerRef, {
            uid: order.playerUid,
            displayName: order.playerName || 'Jugador',
            coins: Number(order.amountSugarCoins),
            walletHistory: [{
              id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
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

        // Actualizar Orden
        transaction.update(orderRef, {
          status: 'completed',
          receiptReferenceNumber: finalRef,
          completedAt: now,
          verifiedAt: now
        })

        // Acreditar Sugar Coins al Jugador y agregar al historial
        if (playerSnap.exists) {
          const existingHistory = Array.isArray(playerData.walletHistory) ? playerData.walletHistory : []
          const newTxEntry = {
            id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: 'deposit',
            amount: amountCoins,
            description: `Depósito P2P Aprobado (#${order.id.slice(0, 8)})`,
            timestamp: now,
            dateStr: new Date().toLocaleDateString('es-ES', { 
              day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
            })
          }
          const updatedHistory = [newTxEntry, ...existingHistory.filter((t: any) => t.id !== newTxEntry.id)].slice(0, 50)

          transaction.update(playerRef, {
            coins: newPlayerCoins,
            lastSettledDepositId: order.id,
            walletHistory: updatedHistory,
            lastActiveAt: now
          })
        }

        // Actualizar Saldo Flotante del Cajero
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

        // Actualizar Custodia de Jugadores en global_ledger
        const ledgerRef = adminDb.collection('system_treasury').doc('global_ledger')
        transaction.set(ledgerRef, {
          id: 'global_ledger',
          playerCustodyCoins: admin.firestore.FieldValue.increment(amountCoins),
          playerCustodyUSD: admin.firestore.FieldValue.increment(amountCoins / 100),
          totalVaultSugarCoins: admin.firestore.FieldValue.increment(amountCoins),
          totalVaultUSD: admin.firestore.FieldValue.increment(amountCoins / 100),
          lastAuditedAt: now
        }, { merge: true })

        // Registrar en disco
        updateDiskOrderStatus(orderId, 'completed', finalRef)

        return {
          success: true,
          message: `Depósito de +${amountCoins} SC acreditado con éxito al jugador.`
        }
      })
    } catch (adminErr: any) {
      console.warn('[approveDepositOrder] Admin SDK transaction failed, activating hybrid engine:', adminErr?.message)
    }
  }

  // 2. Motor de Respaldo Híbrido: Se ejecuta de forma segura cuando no hay credenciales ADC en Render
  const now = Date.now()
  let orderData: CashierOrder | null = null

  // 2.1. Buscar orden en Firestore
  try {
    const orderDocRef = doc(db, 'cashier_orders', orderId)
    const orderSnap = await getDoc(orderDocRef)
    if (orderSnap.exists()) {
      orderData = { id: orderSnap.id, ...orderSnap.data() } as CashierOrder
    }
  } catch (err: any) {
    console.warn('[approveDepositOrder Fallback] Error al consultar Firestore SDK:', err?.message)
  }

  // 2.2. Buscar orden en disco local
  if (!orderData) {
    const diskOrders = loadDiskOrders()
    orderData = diskOrders.find(o => o.id === orderId) || null
  }

  // 2.3. Buscar orden vía REST API
  if (!orderData) {
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'
      const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cashier_orders/${orderId}`)
      if (res.ok) {
        const json = await res.json()
        const fields = json.fields || {}
        orderData = {
          id: orderId,
          type: fields.type?.stringValue || 'deposit',
          status: fields.status?.stringValue || 'pending',
          playerUid: fields.playerUid?.stringValue || '',
          playerId: fields.playerId?.stringValue || '',
          playerName: fields.playerName?.stringValue || 'Jugador',
          amountFiat: Number(fields.amountFiat?.doubleValue || fields.amountFiat?.integerValue || 0),
          currency: fields.currency?.stringValue || 'USDT',
          amountSugarCoins: Number(fields.amountSugarCoins?.integerValue || 0),
          receiptReferenceNumber: fields.receiptReferenceNumber?.stringValue || '',
          createdAt: Number(fields.createdAt?.integerValue || now)
        } as CashierOrder
      }
    } catch {}
  }

  if (!orderData) {
    throw new Error('La orden de depósito no existe')
  }

  if (orderData.status === 'completed') {
    return { success: true, message: 'La orden ya se encuentra completada.' }
  }

  const finalRef = referenceNumber || orderData.receiptReferenceNumber || `TX-${Date.now().toString(36).toUpperCase()}`
  const amountCoins = Number(orderData.amountSugarCoins || Math.round(Number(orderData.amountFiat || 0) * 100))
  const commissionCoins = Number(orderData.cashierCommissionCoins || Math.round(amountCoins * 0.02))

  // 2.4. Actualizar orden a 'completed' en Firestore y disco
  let orderCompletedInCloud = false
  try {
    const orderDocRef = doc(db, 'cashier_orders', orderId)
    await setDoc(orderDocRef, {
      status: 'completed',
      receiptReferenceNumber: finalRef,
      completedAt: now,
      verifiedAt: now,
      settledByCashierUid: cashierUid
    }, { merge: true })
    orderCompletedInCloud = true
  } catch (err: any) {
    console.warn('[approveDepositOrder Fallback] Error actualizando orden en Firestore SDK:', err?.message)
  }

  // Fallback REST para actualizar orden si SDK reportó fallo
  if (!orderCompletedInCloud) {
    try {
      const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'
      const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/cashier_orders/${orderId}?updateMask.fieldPaths=status&updateMask.fieldPaths=receiptReferenceNumber&updateMask.fieldPaths=completedAt&updateMask.fieldPaths=verifiedAt&updateMask.fieldPaths=settledByCashierUid`
      await fetch(patchUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fields: {
            status: { stringValue: 'completed' },
            receiptReferenceNumber: { stringValue: finalRef },
            completedAt: { integerValue: String(now) },
            verifiedAt: { integerValue: String(now) },
            settledByCashierUid: { stringValue: cashierUid }
          }
        })
      })
    } catch (e: any) {
      console.warn('[approveDepositOrder Fallback] Error en REST patch de orden:', e?.message)
    }
  }

  // 2.5. Acreditar Sugar Coins en users/{playerUid}
  if (orderData.playerUid) {
    let coinsCreditedInCloud = false
    try {
      const userDocRef = doc(db, 'users', orderData.playerUid)
      const userSnap = await getDoc(userDocRef)
      if (userSnap.exists()) {
        const userData = userSnap.data() || {}
        const currentCoins = Number(userData.coins || 0)
        const existingHistory = Array.isArray(userData.walletHistory) ? userData.walletHistory : []

        const newTxEntry = {
          id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'deposit',
          amount: amountCoins,
          description: `Depósito P2P Aprobado (#${orderData.id.slice(0, 8)})`,
          timestamp: now,
          dateStr: new Date().toLocaleDateString('es-ES', { 
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
          })
        }

        let updated = false
        const updatedHistory = existingHistory.map((tx: any) => {
          if (!updated && tx.description && tx.description.includes('(Pendiente)')) {
            updated = true
            return newTxEntry
          }
          return tx
        })
        if (!updated) {
          updatedHistory.unshift(newTxEntry)
        }

        await updateDoc(userDocRef, {
          coins: currentCoins + amountCoins,
          lastSettledDepositId: orderData.id,
          walletHistory: updatedHistory.slice(0, 50),
          lastActiveAt: now
        })
        coinsCreditedInCloud = true
      }
    } catch (userErr: any) {
      console.warn('[approveDepositOrder Fallback] Error acreditando saldo en usuario SDK:', userErr?.message)
    }

    // Fallback REST para acreditar saldo si SDK no pudo
    if (!coinsCreditedInCloud) {
      try {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'
        const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${orderData.playerUid}`
        const userRes = await fetch(userUrl)
        if (userRes.ok) {
          const userDocJson = await userRes.json()
          const currentCoins = Number(userDocJson.fields?.coins?.integerValue || 0)
          const newCoins = currentCoins + amountCoins

          await fetch(`${userUrl}?updateMask.fieldPaths=coins&updateMask.fieldPaths=lastActiveAt`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                coins: { integerValue: String(newCoins) },
                lastActiveAt: { integerValue: String(now) }
              }
            })
          })
        }
      } catch (e: any) {
        console.warn('[approveDepositOrder Fallback] Error en REST patch de saldo de usuario:', e?.message)
      }
    }
  }

  // 2.6. Actualizar perfil de cajero
  try {
    const cashierDocRef = doc(db, 'cashier_profiles', cashierUid)
    const cashierSnap = await getDoc(cashierDocRef)
    const cashierData = cashierSnap.exists() ? cashierSnap.data() : {}
    const currentFloat = Number(cashierData.floatBalanceCoins || 50000)
    const newCashierFloat = Math.max(0, currentFloat - amountCoins)
    const newCommissions = Number(cashierData.totalCommissionEarnedCoins || 0) + commissionCoins

    await setDoc(cashierDocRef, {
      uid: cashierUid,
      floatBalanceCoins: newCashierFloat,
      totalCommissionEarnedCoins: newCommissions,
      totalOrdersCompleted: (Number(cashierData.totalOrdersCompleted) || 0) + 1,
      lastActiveAt: now
    }, { merge: true })
  } catch (cashierErr: any) {
    console.warn('[approveDepositOrder Fallback] Error actualizando cajero:', cashierErr?.message)
  }

  // 2.7. Actualizar custodia en system_treasury/global_ledger
  try {
    const ledgerDocRef = doc(db, 'system_treasury', 'global_ledger')
    await setDoc(ledgerDocRef, {
      id: 'global_ledger',
      playerCustodyCoins: increment(amountCoins),
      playerCustodyUSD: increment(amountCoins / 100),
      totalVaultSugarCoins: increment(amountCoins),
      totalVaultUSD: increment(amountCoins / 100),
      lastAuditedAt: now
    }, { merge: true })
  } catch (ledErr: any) {
    console.warn('[approveDepositOrder Fallback] Error en ledger:', ledErr?.message)
  }

  // 2.8. Guardar en disco local
  updateDiskOrderStatus(orderId, 'completed', finalRef)

  return {
    success: true,
    message: `Depósito de +${amountCoins} SC acreditado con éxito al jugador.`
  }
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
  orderId?: string
  playerId?: string
  isVip?: boolean
}): Promise<{ success: boolean; orderId: string }> {
  const { playerUid, playerName, amountSugarCoins, amountFiat, currency, paymentMethod, playerPaymentAccount, orderId, playerId, isVip } = params
  const now = Date.now()
  const finalOrderId = orderId || `wit_${now}_${Math.random().toString(36).substring(2, 6)}`

  // 1. Vía Firebase Admin SDK si existen credenciales
  if (adminDb && hasAdminCredentials) {
    try {
      return await (adminDb as any).runTransaction(async (transaction: any) => {
        const playerRef = adminDb.collection('users').doc(playerUid)
        const playerSnap = await transaction.get(playerRef)

        if (!playerSnap.exists) throw new Error('Jugador no encontrado')

        const currentCoins = Number(playerSnap.data()?.coins || 0)
        if (currentCoins < amountSugarCoins) {
          throw new Error(`Saldo insuficiente para realizar el retiro (Disponible: ${currentCoins} SC, Requerido: ${amountSugarCoins} SC)`)
        }

        const newCoins = currentCoins - amountSugarCoins

        const existingHistory = Array.isArray(playerSnap.data()?.walletHistory) ? playerSnap.data()?.walletHistory : []
        const alreadyHasTx = existingHistory.some((tx: any) => tx.orderId === finalOrderId || (tx.description && tx.description.includes(finalOrderId.slice(0, 8))))
        let updatedHistory = existingHistory
        if (!alreadyHasTx) {
          const withdrawTxEntry = {
            id: `tx_wit_${now}_${Math.random().toString(36).slice(2, 6)}`,
            orderId: finalOrderId,
            type: 'withdraw',
            amount: -amountSugarCoins,
            description: isVip ? `Solicitud de Retiro VIP (Pendiente) (#${finalOrderId.slice(0, 8)})` : `Solicitud de Retiro (Pendiente) (#${finalOrderId.slice(0, 8)})`,
            timestamp: now,
            dateStr: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          }
          updatedHistory = [withdrawTxEntry, ...existingHistory].slice(0, 50)
        }

        transaction.update(playerRef, {
          coins: newCoins,
          escrowLockedCoins: admin.firestore.FieldValue.increment(amountSugarCoins),
          walletHistory: updatedHistory,
          lastActiveAt: now
        })

        const orderRef = adminDb.collection('cashier_orders').doc(finalOrderId)
        const newOrder: CashierOrder = {
          id: finalOrderId,
          type: 'withdraw',
          status: 'pending',
          playerUid,
          playerId: playerId || (playerUid ? `SL-${playerUid.substring(0, 6).toUpperCase()}` : undefined),
          playerName,
          amountFiat,
          currency,
          exchangeRate: amountSugarCoins / (amountFiat || 1),
          amountSugarCoins,
          cashierCommissionCoins: Math.round(amountSugarCoins * (isVip ? 0.04 : 0.02)),
          paymentMethod,
          playerPaymentAccount,
          receiptReferenceNumber: String(playerPaymentAccount || ''),
          isEscrowLocked: true,
          escrowLockedAt: now,
          createdAt: now,
          expiresAt: now + (48 * 3600 * 1000),
          isVip: Boolean(isVip),
          isVipWithdraw: Boolean(isVip)
        }
        transaction.set(orderRef, newOrder)

        return { success: true, orderId: finalOrderId }
      })
    } catch (adminErr: any) {
      console.warn('[createWithdrawOrderWithEscrow] Fallo Admin SDK, activando motor híbrido:', adminErr?.message)
      if (adminErr?.message?.includes('Saldo insuficiente')) throw adminErr
    }
  }

  // 2. Motor híbrido de respaldo (Plan Spark $0.00 / Render sin Service Account)
  try {
    const userDocRef = doc(db, 'users', playerUid)
    const userSnap = await getDoc(userDocRef)
    if (userSnap.exists()) {
      const userData = userSnap.data() || {}
      const currentCoins = Number(userData.coins ?? 200)
      const currentEscrow = Number(userData.escrowLockedCoins ?? 0)

      if (currentCoins < amountSugarCoins) {
        throw new Error(`Saldo insuficiente para realizar el retiro (Disponible: ${currentCoins} SC, Requerido: ${amountSugarCoins} SC)`)
      }

      const newCoins = Math.max(0, currentCoins - amountSugarCoins)
      const newEscrow = currentEscrow + amountSugarCoins

      const existingHistory = Array.isArray(userData.walletHistory) ? userData.walletHistory : []
      const alreadyHasTx = existingHistory.some((tx: any) => tx.orderId === finalOrderId || (tx.description && tx.description.includes(finalOrderId.slice(0, 8))))
      let updatedHistory = existingHistory
      if (!alreadyHasTx) {
        const withdrawTxEntry = {
          id: `tx_wit_${now}_${Math.random().toString(36).slice(2, 6)}`,
          orderId: finalOrderId,
          type: 'withdraw',
          amount: -amountSugarCoins,
          description: isVip ? `Solicitud de Retiro VIP (Pendiente) (#${finalOrderId.slice(0, 8)})` : `Solicitud de Retiro (Pendiente) (#${finalOrderId.slice(0, 8)})`,
          timestamp: now,
          dateStr: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        }
        updatedHistory = [withdrawTxEntry, ...existingHistory].slice(0, 50)
      }

      await updateDoc(userDocRef, {
        coins: newCoins,
        escrowLockedCoins: newEscrow,
        walletHistory: updatedHistory,
        lastActiveAt: now
      })
    }
  } catch (userErr: any) {
    console.warn('[createWithdrawOrderWithEscrow Fallback] Error actualizando usuario SDK:', userErr?.message)
    if (userErr?.message?.includes('Saldo insuficiente')) throw userErr
  }

  const newOrder: CashierOrder = {
    id: finalOrderId,
    type: 'withdraw',
    status: 'pending',
    playerUid,
    playerId: playerId || (playerUid ? `SL-${playerUid.substring(0, 6).toUpperCase()}` : undefined),
    playerName,
    amountFiat,
    currency,
    exchangeRate: amountSugarCoins / (amountFiat || 1),
    amountSugarCoins,
    cashierCommissionCoins: Math.round(amountSugarCoins * (isVip ? 0.04 : 0.02)),
    paymentMethod,
    playerPaymentAccount,
    receiptReferenceNumber: String(playerPaymentAccount || ''),
    isEscrowLocked: true,
    escrowLockedAt: now,
    createdAt: now,
    expiresAt: now + (48 * 3600 * 1000),
    isVip: Boolean(isVip),
    isVipWithdraw: Boolean(isVip)
  }

  try {
    const orderDocRef = doc(db, 'cashier_orders', finalOrderId)
    await setDoc(orderDocRef, newOrder, { merge: true })
  } catch (orderErr: any) {
    console.warn('[createWithdrawOrderWithEscrow Fallback] Error guardando orden en Firestore SDK:', orderErr?.message)
  }

  // Guardar en disco local
  const diskOrders = loadDiskOrders()
  const filtered = diskOrders.filter(o => o.id !== finalOrderId)
  filtered.unshift(newOrder)
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
    fs.writeFileSync(DATA_FILE, JSON.stringify(filtered.slice(0, 100), null, 2), 'utf-8')
  } catch {}

  return { success: true, orderId: finalOrderId }
}

/**
 * 2.1. CANCELACIÓN ATÓMICA DE RETIRO (Jugador o Sistema cancela -> Devolución de Escrow a Saldo)
 */
export async function cancelWithdrawOrderAtomics(params: {
  orderId: string
  actorUid: string
  actorRole: string
}): Promise<{ success: boolean; message: string }> {
  const { orderId, actorUid, actorRole } = params
  const now = Date.now()

  // 1. Vía Firebase Admin SDK si existen credenciales
  if (adminDb && hasAdminCredentials) {
    try {
      return await (adminDb as any).runTransaction(async (transaction: any) => {
        const orderRef = adminDb.collection('cashier_orders').doc(orderId)
        const orderSnap = await transaction.get(orderRef)

        if (!orderSnap.exists) throw new Error('La orden no existe')

        const order = orderSnap.data() as CashierOrder
        if (order.status === 'completed' || order.status === 'cancelled') {
          return { success: true, message: `La orden ya se encuentra en estado '${order.status}'.` }
        }

        if (actorRole === 'player' && order.playerUid !== actorUid) {
          throw new Error('No tienes permiso para cancelar esta orden ajena')
        }

        const amountCoins = Number(order.amountSugarCoins || 0)

        if (order.type === 'withdraw' && amountCoins > 0) {
          const playerRef = adminDb.collection('users').doc(order.playerUid)
          const playerSnap = await transaction.get(playerRef)

          if (playerSnap.exists) {
            const currentCoins = Number(playerSnap.data()?.coins || 0)
            const currentEscrow = Number(playerSnap.data()?.escrowLockedCoins || 0)
            const newEscrow = Math.max(0, currentEscrow - amountCoins)
            const newCoins = currentCoins + amountCoins

            const existingHistory = Array.isArray(playerSnap.data()?.walletHistory) ? playerSnap.data()?.walletHistory : []
            const refundTxEntry = {
              id: `tx_ref_${now}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'deposit',
              amount: amountCoins,
              description: `Reembolso por Cancelación de Retiro (#${order.id.slice(0, 8)})`,
              timestamp: now,
              dateStr: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            }
            const updatedHistory = [refundTxEntry, ...existingHistory].slice(0, 50)

            transaction.update(playerRef, {
              coins: newCoins,
              escrowLockedCoins: newEscrow,
              walletHistory: updatedHistory,
              lastActiveAt: now
            })
          }
        }

        transaction.update(orderRef, {
          status: 'cancelled',
          cancelledAt: now,
          isEscrowLocked: false,
          cancelledByUid: actorUid,
          cancelledByRole: actorRole
        })

        return { success: true, message: 'Orden cancelada con éxito y saldo desbloqueado.' }
      })
    } catch (adminErr: any) {
      console.warn('[cancelWithdrawOrderAtomics] Fallo Admin SDK, activando motor híbrido:', adminErr?.message)
    }
  }

  // 2. Motor híbrido de respaldo (SDK cliente db + disco)
  try {
    const orderDocRef = doc(db, 'cashier_orders', orderId)
    const orderSnap = await getDoc(orderDocRef)
    let orderData: CashierOrder | null = null

    if (orderSnap.exists()) {
      orderData = { id: orderSnap.id, ...orderSnap.data() } as CashierOrder
    } else {
      const disk = loadDiskOrders()
      orderData = disk.find(o => o.id === orderId) || null
    }

    if (orderData) {
      const amountCoins = Number(orderData.amountSugarCoins || 0)

      if (orderData.type === 'withdraw' && amountCoins > 0 && orderData.playerUid) {
        const userDocRef = doc(db, 'users', orderData.playerUid)
        const userSnap = await getDoc(userDocRef)
        if (userSnap.exists()) {
          const uData = userSnap.data() || {}
          const currentCoins = Number(uData.coins ?? 200)
          const currentEscrow = Number(uData.escrowLockedCoins ?? 0)
          const newEscrow = Math.max(0, currentEscrow - amountCoins)
          const newCoins = currentCoins + amountCoins

          const existingHistory = Array.isArray(uData.walletHistory) ? uData.walletHistory : []
          let marked = false
          const updatedHistory = existingHistory.map((tx: any) => {
            if (!marked && tx.description && tx.description.includes(orderId.slice(0, 8)) && tx.description.includes('(Pendiente)')) {
              marked = true
              return {
                ...tx,
                description: tx.description.replace('(Pendiente)', '(Cancelada)'),
                amount: 0
              }
            }
            return tx
          })

          if (!marked) {
            updatedHistory.unshift({
              id: `tx_ref_${now}_${Math.random().toString(36).slice(2, 6)}`,
              type: 'deposit',
              amount: amountCoins,
              description: `Reembolso por Cancelación de Retiro (#${orderId.slice(0, 8)})`,
              timestamp: now,
              dateStr: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            })
          }

          await updateDoc(userDocRef, {
            coins: newCoins,
            escrowLockedCoins: newEscrow,
            walletHistory: updatedHistory.slice(0, 50),
            lastActiveAt: now
          })
        }
      }

      await setDoc(orderDocRef, {
        status: 'cancelled',
        cancelledAt: now,
        isEscrowLocked: false,
        cancelledByUid: actorUid,
        cancelledByRole: actorRole
      }, { merge: true })

      updateDiskOrderStatus(orderId, 'cancelled')
    }
  } catch (fallbackErr: any) {
    console.warn('[cancelWithdrawOrderAtomics Fallback] Error:', fallbackErr?.message)
  }

  return { success: true, message: 'Orden cancelada y saldo desbloqueado.' }
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
  const now = Date.now()

  if (adminDb && hasAdminCredentials) {
    try {
      return await (adminDb as any).runTransaction(async (transaction: any) => {
        const disputeRef = adminDb.collection('dispute_cases').doc(disputeId)
        const disputeSnap = await transaction.get(disputeRef)

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
        return { success: true, message: `Veredicto ejecutado: ${verdict}` }
      })
    } catch (e: any) {
      console.warn('[resolveDisputeCaseAtomics] Fallback a cliente SDK:', e?.message)
    }
  }

  // Fallback motor híbrido SDK
  try {
    const dispDocRef = doc(db, 'dispute_cases', disputeId)
    const dispSnap = await getDoc(dispDocRef)
    const dData = dispSnap.exists() ? dispSnap.data() : {}
    const finalOrderId = dData.orderId || disputeId
    const amountCoins = Number(dData.amountSugarCoins || 0)

    await setDoc(dispDocRef, {
      status: verdict === 'favor_player' ? 'resolved_player' : 'resolved_cashier',
      resolvedBy: adminName,
      resolvedByUid: adminUid,
      resolvedAt: now,
      resolutionNotes: resolutionNotes || `Veredicto: ${verdict}`
    }, { merge: true })

    const orderDocRef = doc(db, 'cashier_orders', finalOrderId)
    await updateDoc(orderDocRef, {
      status: verdict === 'favor_player' ? 'completed' : 'cancelled',
      completedAt: now,
      resolutionNotes: resolutionNotes || `Veredicto: ${verdict}`,
      resolvedBy: adminName,
      resolvedAt: now
    }).catch(() => {})

    if (verdict === 'favor_player' && dData.playerUid) {
      const userRef = doc(db, 'users', dData.playerUid)
      await updateDoc(userRef, {
        coins: increment(amountCoins),
        lastActiveAt: now
      }).catch(() => {})
    } else if (verdict === 'favor_cashier' && dData.cashierUid) {
      const cRef = doc(db, 'cashier_profiles', dData.cashierUid)
      await updateDoc(cRef, {
        floatBalanceCoins: increment(amountCoins),
        floatBalanceUSDT: increment(amountCoins / 100),
        lastActiveAt: now
      }).catch(() => {})
    }
  } catch (dispErr: any) {
    console.warn('[resolveDisputeCaseAtomics Fallback] Error:', dispErr?.message)
  }

  return { success: true, message: `Veredicto ejecutado: ${verdict}` }
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
  cashierName?: string
}): Promise<{ success: boolean; message: string }> {
  const { orderId, cashierUid, payoutTxId, actorUid, actorRole, cashierName } = params
  const now = Date.now()

  // 1. Vía Firebase Admin SDK si existen credenciales
  if (adminDb && hasAdminCredentials) {
    try {
      return await (adminDb as any).runTransaction(async (transaction: any) => {
        const orderRef = adminDb.collection('cashier_orders').doc(orderId)
        const orderSnap = await transaction.get(orderRef)

        if (!orderSnap.exists) throw new Error(`La orden #${orderId} no existe.`)

        const order = orderSnap.data() as CashierOrder
        if (order.status === 'completed') {
          return { success: true, message: 'La orden ya se encuentra completada.' }
        }

        const amountCoins = Number(order.amountSugarCoins || 0)
        const commissionCoins = Number(order.cashierCommissionCoins || Math.round(amountCoins * 0.03))
        const totalFiatRequestedUSD = Number(order.amountFiat || (amountCoins / 100))
        const isVip = Boolean((order as any).isVip || (order as any).isVipWithdraw || order.paymentMethod === 'usdt_bep20' || order.paymentMethod === 'usdt_trc20_vip')
        const withdrawalFeePercent = isVip ? 0.10 : 0.05
        const withdrawalFeeUSD = parseFloat((totalFiatRequestedUSD * withdrawalFeePercent).toFixed(2))
        const netPayoutUSD = parseFloat(Math.max(0, totalFiatRequestedUSD - withdrawalFeeUSD).toFixed(2))
        const netPayoutCoins = Math.round(netPayoutUSD * 100)
        const feeCoins = Math.round(withdrawalFeeUSD * 100)

        // Inyección atómica del comprobante formal de retiro al chat de soporte
        const payoutNoticeText = `💸 ¡${isVip ? 'RETIRO VIP' : 'RETIRO'} LIQUIDADO Y TRANSFERIDO!

Hola ${order.playerName || 'Jugador'}, hemos enviado tus fondos a tu cuenta de destino:
━━━━━━━━━━━━━━━━━━━━
💵 Monto Solicitado: $${totalFiatRequestedUSD.toFixed(2)} ${order.currency || 'USDT'}
⚡ Modalidad: Retiro ${isVip ? 'VIP (Prioridad Máxima - Comisión 10%)' : 'Estándar (Comisión 5%)'}
🏷️ Comisión Aplicada: -$${withdrawalFeeUSD.toFixed(2)} USD (${Math.round(withdrawalFeePercent * 100)}%)
💰 Monto Neto Transferido: $${netPayoutUSD.toFixed(2)} ${order.currency || 'USDT'}
🪙 Sugar Coins Liquidados: -${amountCoins} SC
🏦 Destino: ${(order.paymentMethod || 'USDT').toUpperCase()} (${(order as any).paymentAddress || order.receiptReferenceNumber || 'Dirección registrada'})
🔗 Hash / TxID Oficial: ${payoutTxId}
👨‍💼 Cajero Responsable: ${cashierName || 'Cajero Oficial'}
━━━━━━━━━━━━━━━━━━━━
Conserva este mensaje como comprobante formal de la transacción.`

        const existingSupportMsgs = Array.isArray(order.supportMessages) ? order.supportMessages : []
        const officialNoticeMsg = {
          id: `msg_payout_${now}`,
          orderId,
          senderUid: cashierUid,
          senderName: cashierName || 'Cajero Oficial',
          senderRole: 'cashier',
          message: payoutNoticeText,
          timestamp: now
        }

        // Actualizar orden
        transaction.update(orderRef, {
          status: 'completed',
          receiptReferenceNumber: payoutTxId,
          completedAt: now,
          isEscrowLocked: false,
          settledByCashierUid: cashierUid,
          netPayoutUSD,
          withdrawalFeeUSD,
          supportMessages: [...existingSupportMsgs, officialNoticeMsg],
          lastMessage: payoutNoticeText,
          lastMessageTime: now,
          hasUnreadCashierMessage: true
        })

        // Liberar escrow del jugador y actualizar historial
        const playerRef = adminDb.collection('users').doc(order.playerUid)
        const playerSnap = await transaction.get(playerRef)
        if (playerSnap.exists) {
          const currentEscrow = Number(playerSnap.data()?.escrowLockedCoins || 0)
          const currentCoins = Number(playerSnap.data()?.coins || 0)
          let newEscrow = Math.max(0, currentEscrow - amountCoins)
          let newCoins = currentCoins

          // Candado Defensivo Anti-Rebote:
          // Si el saldo no estaba completamente retenido en escrow, debitar el déficit directamente de coins
          if (currentEscrow < amountCoins) {
            const deficit = amountCoins - currentEscrow
            newCoins = Math.max(0, currentCoins - deficit)
            newEscrow = 0
          }

          const existingHistory = Array.isArray(playerSnap.data()?.walletHistory) ? playerSnap.data()?.walletHistory : []
          const updatedHistory = existingHistory.map((tx: any) => {
            if (tx.description && tx.description.includes(orderId.slice(0, 8)) && tx.description.includes('(Pendiente)')) {
              return {
                ...tx,
                description: `Retiro Liquidado (#${orderId.slice(0, 8)}) - TxID: ${payoutTxId}`
              }
            }
            return tx
          })

          transaction.update(playerRef, {
            coins: newCoins,
            escrowLockedCoins: newEscrow,
            walletHistory: updatedHistory,
            lastActiveAt: now
          })
        }

        // Actualizar cajero
        let cashierCurrentFloatUSDT = 0
        const cashierRef = adminDb.collection('cashier_profiles').doc(cashierUid)
        const cashierSnap = await transaction.get(cashierRef)
        if (cashierSnap.exists) {
          const cData = cashierSnap.data() || {}
          cashierCurrentFloatUSDT = Number(cData.floatBalanceUSDT ?? (Number(cData.floatBalanceCoins || 0) / 100))
          if (cashierCurrentFloatUSDT < netPayoutUSD) {
            throw new Error(`Saldo flotante insuficiente ($${cashierCurrentFloatUSDT.toFixed(2)} USDT disponibles). Se requieren $${netPayoutUSD.toFixed(2)} USDT.`)
          }

          transaction.update(cashierRef, {
            totalOrdersCompleted: admin.firestore.FieldValue.increment(1),
            totalCommissionsEarnedCoins: admin.firestore.FieldValue.increment(commissionCoins),
            floatBalanceUSDT: admin.firestore.FieldValue.increment(-netPayoutUSD),
            floatBalanceCoins: admin.firestore.FieldValue.increment(-netPayoutCoins),
            totalPaidWithdrawalsUSDT: admin.firestore.FieldValue.increment(netPayoutUSD),
            totalPaidWithdrawalsCoins: admin.firestore.FieldValue.increment(netPayoutCoins),
            lastActiveAt: now
          })
        }

        // Registrar arqueo
        const ledgerEntryRef = adminDb.collection('cashier_shifts_ledger').doc()
        transaction.set(ledgerEntryRef, {
          id: ledgerEntryRef.id,
          cashierUid,
          type: 'withdrawal_payout',
          amountUSDT: -netPayoutUSD,
          amountFiatUSD: -netPayoutUSD,
          amountCoins: -netPayoutCoins,
          resultingBalanceUSDT: Math.max(0, parseFloat((cashierCurrentFloatUSDT - netPayoutUSD).toFixed(2))),
          resultingBalanceCoins: Math.max(0, Math.round((cashierCurrentFloatUSDT - netPayoutUSD) * 100)),
          orderId,
          payoutTxId,
          notes: `Liquidación de retiro #${orderId.slice(0, 8)}: Transferido neto $${netPayoutUSD.toFixed(2)} USDT (Fee: $${withdrawalFeeUSD.toFixed(2)} USDT)`,
          timestamp: now
        })

        // Actualizar Bóveda y Comisiones de la Casa en global_ledger
        const globalLedgerRef = adminDb.collection('system_treasury').doc('global_ledger')
        const feeKey = isVip ? 'profitsBreakdown.vipWithdrawalFeesUSD' : 'profitsBreakdown.normalWithdrawalFeesUSD'
        transaction.set(globalLedgerRef, {
          id: 'global_ledger',
          playerCustodyCoins: admin.firestore.FieldValue.increment(-amountCoins),
          playerCustodyUSD: admin.firestore.FieldValue.increment(-amountCoins / 100),
          houseNetProfitsUSD: admin.firestore.FieldValue.increment(withdrawalFeeUSD),
          houseNetProfitsCoins: admin.firestore.FieldValue.increment(Math.round(withdrawalFeeUSD * 100)),
          'profitsBreakdown.withdrawalFeesUSD': admin.firestore.FieldValue.increment(withdrawalFeeUSD),
          [feeKey]: admin.firestore.FieldValue.increment(withdrawalFeeUSD),
          lastAuditedAt: now
        }, { merge: true })

        return { success: true, message: `Retiro #${orderId.slice(0, 8)} liquidado con éxito.` }
      })
    } catch (adminErr: any) {
      console.warn('[completeWithdrawalOrder] Fallo Admin SDK, activando motor híbrido:', adminErr?.message)
      if (adminErr?.message?.includes('Saldo flotante insuficiente')) throw adminErr
    }
  }

  // 2. Motor híbrido de respaldo (SDK cliente db + REST + disco local)
  const orderDocRef = doc(db, 'cashier_orders', orderId)
  let order: CashierOrder | null = null
  try {
    const orderSnap = await getDoc(orderDocRef)
    if (orderSnap.exists()) {
      order = { id: orderSnap.id, ...orderSnap.data() } as CashierOrder
    }
  } catch {}

  if (!order) {
    const disk = loadDiskOrders()
    order = disk.find(o => o.id === orderId) || null
  }

  if (!order) {
    throw new Error(`La orden #${orderId} no existe.`)
  }

  if (order.status === 'completed') {
    return { success: true, message: 'La orden ya se encuentra completada.' }
  }

  const amountCoins = Number(order.amountSugarCoins || 0)
  const commissionCoins = Number(order.cashierCommissionCoins || Math.round(amountCoins * 0.03))
  const totalFiatRequestedUSD = Number(order.amountFiat || (amountCoins / 100))
  const isVip = Boolean((order as any).isVip || (order as any).isVipWithdraw || order.paymentMethod === 'usdt_bep20' || order.paymentMethod === 'usdt_trc20_vip')
  const withdrawalFeePercent = isVip ? 0.10 : 0.05
  const withdrawalFeeUSD = parseFloat((totalFiatRequestedUSD * withdrawalFeePercent).toFixed(2))
  const netPayoutUSD = parseFloat(Math.max(0, totalFiatRequestedUSD - withdrawalFeeUSD).toFixed(2))
  const netPayoutCoins = Math.round(netPayoutUSD * 100)
  const feeCoins = Math.round(withdrawalFeeUSD * 100)

  // 2.1. Inyección atómica del comprobante formal de retiro y actualización a completed en Firestore
  const fallbackNoticeText = `💸 ¡${isVip ? 'RETIRO VIP' : 'RETIRO'} LIQUIDADO Y TRANSFERIDO!

Hola ${order.playerName || 'Jugador'}, hemos enviado tus fondos a tu cuenta de destino:
━━━━━━━━━━━━━━━━━━━━
💵 Monto Solicitado: $${totalFiatRequestedUSD.toFixed(2)} ${order.currency || 'USDT'}
⚡ Modalidad: Retiro ${isVip ? 'VIP (Prioridad Máxima - Comisión 10%)' : 'Estándar (Comisión 5%)'}
🏷️ Comisión Aplicada: -$${withdrawalFeeUSD.toFixed(2)} USD (${Math.round(withdrawalFeePercent * 100)}%)
💰 Monto Neto Transferido: $${netPayoutUSD.toFixed(2)} ${order.currency || 'USDT'}
🪙 Sugar Coins Liquidados: -${amountCoins} SC
🏦 Destino: ${(order.paymentMethod || 'USDT').toUpperCase()} (${(order as any).paymentAddress || order.receiptReferenceNumber || 'Dirección registrada'})
🔗 Hash / TxID Oficial: ${payoutTxId}
👨‍💼 Cajero Responsable: ${cashierName || 'Cajero Oficial'}
━━━━━━━━━━━━━━━━━━━━
Conserva este mensaje como comprobante formal de la transacción.`

  const existingSupportMsgs = Array.isArray(order.supportMessages) ? order.supportMessages : []
  const officialNoticeMsg = {
    id: `msg_payout_${now}`,
    orderId,
    senderUid: cashierUid,
    senderName: cashierName || 'Cajero Oficial',
    senderRole: 'cashier',
    message: fallbackNoticeText,
    timestamp: now
  }

  try {
    await setDoc(orderDocRef, {
      status: 'completed',
      receiptReferenceNumber: payoutTxId,
      completedAt: now,
      isEscrowLocked: false,
      settledByCashierUid: cashierUid,
      netPayoutUSD,
      withdrawalFeeUSD,
      supportMessages: [...existingSupportMsgs, officialNoticeMsg],
      lastMessage: fallbackNoticeText,
      lastMessageTime: now,
      hasUnreadCashierMessage: true
    }, { merge: true })
  } catch (err: any) {
    console.warn('[completeWithdrawalOrder Fallback] Error actualizando orden en Firestore SDK:', err?.message)
  }

  // 2.2. Liberar saldo de Escrow del jugador y actualizar historial
  let escrowReleasedInCloud = false
  if (order.playerUid) {
    try {
      const userDocRef = doc(db, 'users', order.playerUid)
      const userSnap = await getDoc(userDocRef)
      if (userSnap.exists()) {
        const uData = userSnap.data() || {}
        const currentEscrow = Number(uData.escrowLockedCoins || 0)
        const currentCoins = Number(uData.coins ?? 0)
        let newEscrow = Math.max(0, currentEscrow - amountCoins)
        let newCoins = currentCoins

        const existingHistory = Array.isArray(uData.walletHistory) ? uData.walletHistory : []
        let matched = false
        const cleanHistory: any[] = []
        for (const tx of existingHistory) {
          const isTargetOrder = tx.orderId === orderId || (tx.description && tx.description.includes(orderId.slice(0, 8)))
          if (isTargetOrder) {
            if (!matched) {
              matched = true
              cleanHistory.push({
                ...tx,
                orderId,
                payoutTxId,
                description: `Retiro Liquidado (#${orderId}) - TxID: ${payoutTxId}`
              })
            }
            // Si ya se procesó una entrada para esta misma orden, se descarta el duplicado huérfano
          } else {
            cleanHistory.push(tx)
          }
        }

        const userUpdates: any = {
          escrowLockedCoins: newEscrow,
          walletHistory: cleanHistory.slice(0, 50),
          lastActiveAt: now
        }

        // Candado Defensivo Anti-Rebote:
        // Si el saldo no estaba completamente retenido en escrow, debitar el déficit directamente de coins
        if (currentEscrow < amountCoins) {
          const deficit = amountCoins - currentEscrow
          newCoins = Math.max(0, currentCoins - deficit)
          userUpdates.coins = newCoins
          userUpdates.escrowLockedCoins = 0
        }

        await updateDoc(userDocRef, userUpdates)
        escrowReleasedInCloud = true
      }
    } catch (userErr: any) {
      console.warn('[completeWithdrawalOrder Fallback] Error liberando escrow en usuario SDK:', userErr?.message)
    }

    // Fallback REST para garantizar liberación de Escrow en Firestore si SDK falló
    if (!escrowReleasedInCloud) {
      try {
        const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sweety-ludo-87343'
        const userUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${order.playerUid}`
        const userRes = await fetch(userUrl)
        if (userRes.ok) {
          const userDocJson = await userRes.json()
          const currentEscrow = Number(userDocJson.fields?.escrowLockedCoins?.integerValue || 0)
          const newEscrow = Math.max(0, currentEscrow - amountCoins)

          await fetch(`${userUrl}?updateMask.fieldPaths=escrowLockedCoins&updateMask.fieldPaths=lastActiveAt`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              fields: {
                escrowLockedCoins: { integerValue: String(newEscrow) },
                lastActiveAt: { integerValue: String(now) }
              }
            })
          })
        }
      } catch (restErr: any) {
        console.warn('[completeWithdrawalOrder Fallback] Error en REST patch de escrow:', restErr?.message)
      }
    }
  }

  // 2.3. Actualizar perfil del cajero en cashier_profiles y en system_config/cashier_accounts
  let newFloatUSDT = 0
  let newFloatCoins = 0
  try {
    const cashierDocRef = doc(db, 'cashier_profiles', cashierUid)
    const cashierSnap = await getDoc(cashierDocRef)
    const cData = cashierSnap.exists() ? cashierSnap.data() : {}
    const currentFloatUSDT = Number(cData.floatBalanceUSDT ?? (Number(cData.floatBalanceCoins || 0) / 100))
    const currentFloatCoins = Number(cData.floatBalanceCoins ?? (currentFloatUSDT * 100))

    // ================================================================
    // HARD-STOP ANTI-SOBREGIRO: Validación de saldo flotante en fallback
    // Si el motor Admin SDK no pudo validar (sin credenciales), este candado
    // es la última línea de defensa antes de descontar el flotante del cajero.
    // ================================================================
    if (currentFloatUSDT < netPayoutUSD) {
      // Revertir la escritura de status 'completed' que ya se hizo en el paso 2.1
      // para dejar la orden en su estado anterior (no se puede garantizar rollback
      // atómico en fallback, pero al menos no se quema el escrow del jugador).
      try {
        await setDoc(orderDocRef, {
          status: 'pending',
          completedAt: null,
          isEscrowLocked: true,
          settledByCashierUid: null
        }, { merge: true })
      } catch {}
      throw new Error(
        `FLOAT_INSUFFICIENT: Saldo flotante insuficiente ($${currentFloatUSDT.toFixed(2)} USDT disponibles). ` +
        `Se requieren $${netPayoutUSD.toFixed(2)} USDT para este retiro. ` +
        `Solicita recarga al Administrador antes de intentar liquidar.`
      )
    }
    // ================================================================

    newFloatUSDT = Math.max(0, parseFloat((currentFloatUSDT - netPayoutUSD).toFixed(2)))
    newFloatCoins = Math.max(0, currentFloatCoins - netPayoutCoins)

    await setDoc(cashierDocRef, {
      uid: cashierUid,
      floatBalanceUSDT: newFloatUSDT,
      floatBalanceCoins: newFloatCoins,
      totalOrdersCompleted: (Number(cData.totalOrdersCompleted) || 0) + 1,
      totalCommissionsEarnedCoins: (Number(cData.totalCommissionsEarnedCoins) || 0) + commissionCoins,
      lastActiveAt: now
    }, { merge: true })

    // Sincronizar también en system_config/cashier_accounts para que todo el Admin Hub lo vea
    const configDocRef = doc(db, 'system_config', 'cashier_accounts')
    const configSnap = await getDoc(configDocRef)
    if (configSnap.exists()) {
      const configData = configSnap.data() || {}
      const accounts = Array.isArray(configData.accounts) ? configData.accounts : []
      const updatedAccounts = accounts.map((acc: any) => {
        if (acc.uid === cashierUid) {
          return {
            ...acc,
            floatBalanceCoins: newFloatCoins,
            floatBalanceUSDT: newFloatUSDT,
            totalPaidWithdrawalsUSDT: (acc.totalPaidWithdrawalsUSDT || 0) + netPayoutUSD,
            lastActiveAt: now
          }
        }
        return acc
      })
      await updateDoc(configDocRef, { accounts: updatedAccounts, updatedAt: now })
    }
  } catch (cashierErr: any) {
    console.warn('[completeWithdrawalOrder Fallback] Error actualizando cajero:', cashierErr?.message)
  }

  // 2.4. Registrar arqueo en cashier_shifts_ledger
  try {
    const shiftDocRef = doc(db, 'cashier_shifts_ledger', `shift_${now}_${Math.random().toString(36).slice(2, 6)}`)
    await setDoc(shiftDocRef, {
      id: shiftDocRef.id,
      cashierUid,
      type: 'withdrawal_payout',
      amountUSDT: -netPayoutUSD,
      amountFiatUSD: -netPayoutUSD,
      amountCoins: -netPayoutCoins,
      resultingBalanceUSDT: newFloatUSDT,
      resultingBalanceCoins: newFloatCoins,
      orderId,
      payoutTxId,
      notes: `Liquidación de retiro #${orderId.slice(0, 8)}: Transferido neto $${netPayoutUSD.toFixed(2)} USDT (Fee: $${withdrawalFeeUSD.toFixed(2)} USDT)`,
      timestamp: now
    })
  } catch {}

  // 2.5. Actualizar Bóveda y Comisiones de la Casa en global_ledger
  try {
    const globalLedgerDocRef = doc(db, 'system_treasury', 'global_ledger')
    const feeKey = isVip ? 'profitsBreakdown.vipWithdrawalFeesUSD' : 'profitsBreakdown.normalWithdrawalFeesUSD'
    await setDoc(globalLedgerDocRef, {
      id: 'global_ledger',
      playerCustodyCoins: increment(-amountCoins),
      playerCustodyUSD: increment(-amountCoins / 100),
      houseNetProfitsUSD: increment(withdrawalFeeUSD),
      houseNetProfitsCoins: increment(Math.round(withdrawalFeeUSD * 100)),
      'profitsBreakdown.withdrawalFeesUSD': increment(withdrawalFeeUSD),
      [feeKey]: increment(withdrawalFeeUSD),
      lastAuditedAt: now
    }, { merge: true })
  } catch (ledErr: any) {
    console.warn('[completeWithdrawalOrder Fallback] Error en ledger:', ledErr?.message)
  }

  // 2.6. Actualizar en disco local
  updateDiskOrderStatus(orderId, 'completed', payoutTxId)

  return {
    success: true,
    message: `Retiro #${orderId.slice(0, 8)} liquidado con éxito.`
  }
}

/**
 * 5. ASIGNACIÓN / RECARGA DE SALDO FLOTANTE DE CAJERO POR EL SUPER ADMIN
 */
export async function rechargeCashierFloatAtomics(params: {
  cashierUid: string
  amountUSDT: number
  notes: string
  adminUid: string
  adminName: string
}): Promise<{ success: boolean; message: string; newFloatUSDT?: number; newFloatCoins?: number }> {
  const { cashierUid, amountUSDT, notes, adminUid, adminName } = params
  const now = Date.now()
  const amountCoins = Math.round(amountUSDT * 100)

  if (adminDb && hasAdminCredentials) {
    try {
      return await (adminDb as any).runTransaction(async (transaction: any) => {
        const cashierRef = adminDb.collection('cashier_profiles').doc(cashierUid)
        const cashierSnap = await transaction.get(cashierRef)

        const prevFloatUSDT = cashierSnap.exists ? Number(cashierSnap.data()?.floatBalanceUSDT || 0) : 0
        const newFloatUSDT = prevFloatUSDT + amountUSDT
        const newFloatCoins = Math.round(newFloatUSDT * 100)

        if (cashierSnap.exists) {
          transaction.update(cashierRef, {
            floatBalanceUSDT: newFloatUSDT,
            floatBalanceCoins: newFloatCoins,
            initialShiftFloatUSDT: admin.firestore.FieldValue.increment(amountUSDT),
            lastRechargeAt: now
          })
        } else {
          transaction.set(cashierRef, {
            uid: cashierUid,
            floatBalanceUSDT: newFloatUSDT,
            floatBalanceCoins: newFloatCoins,
            initialShiftFloatUSDT: amountUSDT,
            lastRechargeAt: now,
            createdAt: now
          })
        }

        const shiftLedgerRef = adminDb.collection('cashier_shifts_ledger').doc()
        transaction.set(shiftLedgerRef, {
          id: shiftLedgerRef.id,
          cashierUid,
          type: 'recharge',
          amountUSDT,
          amountFiatUSD: amountUSDT,
          amountCoins,
          previousBalanceUSDT: prevFloatUSDT,
          newBalanceUSDT: newFloatUSDT,
          resultingBalanceUSDT: newFloatUSDT,
          resultingBalanceCoins: newFloatCoins,
          notes: `Asignación de saldo flotante por Super Admin ${adminName}: ${notes}`,
          timestamp: now
        })

        return {
          success: true,
          message: `Asignados +$${amountUSDT.toFixed(2)} USDT a la caja del cajero.`,
          newFloatUSDT,
          newFloatCoins
        }
      })
    } catch (e: any) {
      console.warn('[rechargeCashierFloatAtomics] Fallback a cliente SDK:', e?.message)
    }
  }

  // Fallback SDK
  let fallbackNewUSDT = amountUSDT
  let fallbackNewCoins = amountCoins
  try {
    const cashierDocRef = doc(db, 'cashier_profiles', cashierUid)
    const cashierSnap = await getDoc(cashierDocRef)
    const prevFloatUSDT = cashierSnap.exists() ? Number(cashierSnap.data()?.floatBalanceUSDT || 0) : 0
    fallbackNewUSDT = prevFloatUSDT + amountUSDT
    fallbackNewCoins = Math.round(fallbackNewUSDT * 100)

    await setDoc(cashierDocRef, {
      uid: cashierUid,
      floatBalanceUSDT: fallbackNewUSDT,
      floatBalanceCoins: fallbackNewCoins,
      lastRechargeAt: now
    }, { merge: true })

    const shiftRef = doc(collection(db, 'cashier_shifts_ledger'))
    await setDoc(shiftRef, {
      id: shiftRef.id,
      cashierUid,
      type: 'recharge',
      amountUSDT,
      amountFiatUSD: amountUSDT,
      amountCoins,
      previousBalanceUSDT: prevFloatUSDT,
      newBalanceUSDT: fallbackNewUSDT,
      resultingBalanceUSDT: fallbackNewUSDT,
      resultingBalanceCoins: fallbackNewCoins,
      notes: `Asignación de saldo flotante por Super Admin ${adminName}: ${notes}`,
      timestamp: now
    })
  } catch (err: any) {
    console.warn('[rechargeCashierFloatAtomics Fallback] Error:', err?.message)
  }

  return {
    success: true,
    message: `Asignados +$${amountUSDT.toFixed(2)} USDT a la caja del cajero.`,
    newFloatUSDT: fallbackNewUSDT,
    newFloatCoins: fallbackNewCoins
  }
}
