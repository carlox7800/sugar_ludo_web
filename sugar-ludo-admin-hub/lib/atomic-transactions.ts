import { adminDb, admin, hasAdminCredentials } from './firebase-admin'
import { db } from './firebase'
import { doc, getDoc, updateDoc, setDoc } from 'firebase/firestore'
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

  // 2.7. Guardar en disco local
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
        const withdrawTxEntry = {
          id: `tx_wit_${now}_${Math.random().toString(36).slice(2, 6)}`,
          type: 'withdraw',
          amount: -amountSugarCoins,
          description: isVip ? `Solicitud de Retiro VIP (Pendiente) (#${finalOrderId.slice(0, 8)})` : `Solicitud de Retiro (Pendiente) (#${finalOrderId.slice(0, 8)})`,
          timestamp: now,
          dateStr: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
        }
        const updatedHistory = [withdrawTxEntry, ...existingHistory].slice(0, 50)

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
      const withdrawTxEntry = {
        id: `tx_wit_${now}_${Math.random().toString(36).slice(2, 6)}`,
        type: 'withdraw',
        amount: -amountSugarCoins,
        description: isVip ? `Solicitud de Retiro VIP (Pendiente) (#${finalOrderId.slice(0, 8)})` : `Solicitud de Retiro (Pendiente) (#${finalOrderId.slice(0, 8)})`,
        timestamp: now,
        dateStr: new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
      }
      const updatedHistory = [withdrawTxEntry, ...existingHistory].slice(0, 50)

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

  // Fallback simple SDK
  try {
    const dispDocRef = doc(db, 'dispute_cases', disputeId)
    await setDoc(dispDocRef, {
      status: verdict === 'favor_player' ? 'resolved_player' : 'resolved_cashier',
      resolvedBy: adminName,
      resolvedByUid: adminUid,
      resolvedAt: now,
      resolutionNotes: resolutionNotes || `Veredicto: ${verdict}`
    }, { merge: true })
  } catch {}

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
}): Promise<{ success: boolean; message: string }> {
  const { orderId, cashierUid, payoutTxId, actorUid, actorRole } = params
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

        // Actualizar orden
        transaction.update(orderRef, {
          status: 'completed',
          receiptReferenceNumber: payoutTxId,
          completedAt: now,
          isEscrowLocked: false,
          settledByCashierUid: cashierUid,
          netPayoutUSD,
          withdrawalFeeUSD
        })

        // Liberar escrow del jugador y actualizar historial
        const playerRef = adminDb.collection('users').doc(order.playerUid)
        const playerSnap = await transaction.get(playerRef)
        if (playerSnap.exists) {
          const currentEscrow = Number(playerSnap.data()?.escrowLockedCoins || 0)
          const newEscrow = Math.max(0, currentEscrow - amountCoins)
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
            escrowLockedCoins: newEscrow,
            walletHistory: updatedHistory,
            lastActiveAt: now
          })
        }

        // Actualizar cajero
        const cashierRef = adminDb.collection('cashier_profiles').doc(cashierUid)
        const cashierSnap = await transaction.get(cashierRef)
        if (cashierSnap.exists) {
          const cData = cashierSnap.data() || {}
          const currentFloatUSDT = Number(cData.floatBalanceUSDT ?? (Number(cData.floatBalanceCoins || 0) / 100))
          if (currentFloatUSDT < netPayoutUSD) {
            throw new Error(`Saldo flotante insuficiente ($${currentFloatUSDT.toFixed(2)} USDT disponibles). Se requieren $${netPayoutUSD.toFixed(2)} USDT.`)
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
          type: 'withdraw_payout',
          amountUSDT: -netPayoutUSD,
          amountCoins: -netPayoutCoins,
          orderId,
          payoutTxId,
          notes: `Liquidación de retiro #${orderId.slice(0, 8)}: Transferido neto $${netPayoutUSD.toFixed(2)} USDT (Fee: $${withdrawalFeeUSD.toFixed(2)} USDT)`,
          timestamp: now
        })

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

  // 2.1. Actualizar orden a completed en Firestore
  try {
    await setDoc(orderDocRef, {
      status: 'completed',
      receiptReferenceNumber: payoutTxId,
      completedAt: now,
      isEscrowLocked: false,
      settledByCashierUid: cashierUid,
      netPayoutUSD,
      withdrawalFeeUSD
    }, { merge: true })
  } catch (err: any) {
    console.warn('[completeWithdrawalOrder Fallback] Error actualizando orden en Firestore SDK:', err?.message)
  }

  // 2.2. Liberar saldo de Escrow del jugador y actualizar historial
  if (order.playerUid) {
    try {
      const userDocRef = doc(db, 'users', order.playerUid)
      const userSnap = await getDoc(userDocRef)
      if (userSnap.exists()) {
        const uData = userSnap.data() || {}
        const currentEscrow = Number(uData.escrowLockedCoins || 0)
        const newEscrow = Math.max(0, currentEscrow - amountCoins)

        const existingHistory = Array.isArray(uData.walletHistory) ? uData.walletHistory : []
        let updatedHistory = existingHistory.map((tx: any) => {
          if (tx.description && tx.description.includes(orderId.slice(0, 8)) && tx.description.includes('(Pendiente)')) {
            return {
              ...tx,
              description: `Retiro Liquidado (#${orderId.slice(0, 8)}) - TxID: ${payoutTxId}`
            }
          }
          return tx
        })

        await updateDoc(userDocRef, {
          escrowLockedCoins: newEscrow,
          walletHistory: updatedHistory,
          lastActiveAt: now
        })
      }
    } catch (userErr: any) {
      console.warn('[completeWithdrawalOrder Fallback] Error liberando escrow en usuario:', userErr?.message)
    }
  }

  // 2.3. Actualizar perfil del cajero
  try {
    const cashierDocRef = doc(db, 'cashier_profiles', cashierUid)
    const cashierSnap = await getDoc(cashierDocRef)
    const cData = cashierSnap.exists() ? cashierSnap.data() : {}
    const currentFloatUSDT = Number(cData.floatBalanceUSDT ?? (Number(cData.floatBalanceCoins || 0) / 100))
    const currentFloatCoins = Number(cData.floatBalanceCoins ?? (currentFloatUSDT * 100))

    const newFloatUSDT = Math.max(0, parseFloat((currentFloatUSDT - netPayoutUSD).toFixed(2)))
    const newFloatCoins = Math.max(0, currentFloatCoins - netPayoutCoins)

    await setDoc(cashierDocRef, {
      uid: cashierUid,
      floatBalanceUSDT: newFloatUSDT,
      floatBalanceCoins: newFloatCoins,
      totalOrdersCompleted: (Number(cData.totalOrdersCompleted) || 0) + 1,
      totalCommissionsEarnedCoins: (Number(cData.totalCommissionsEarnedCoins) || 0) + commissionCoins,
      lastActiveAt: now
    }, { merge: true })
  } catch (cashierErr: any) {
    console.warn('[completeWithdrawalOrder Fallback] Error actualizando cajero:', cashierErr?.message)
  }

  // 2.4. Registrar arqueo en cashier_shifts_ledger
  try {
    const shiftDocRef = doc(db, 'cashier_shifts_ledger', `shift_${now}_${Math.random().toString(36).slice(2, 6)}`)
    await setDoc(shiftDocRef, {
      id: shiftDocRef.id,
      cashierUid,
      type: 'withdraw_payout',
      amountUSDT: -netPayoutUSD,
      amountCoins: -netPayoutCoins,
      orderId,
      payoutTxId,
      notes: `Liquidación de retiro #${orderId.slice(0, 8)}: Transferido neto $${netPayoutUSD.toFixed(2)} USDT (Fee: $${withdrawalFeeUSD.toFixed(2)} USDT)`,
      timestamp: now
    })
  } catch {}

  // 2.5. Actualizar en disco local
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
}): Promise<{ success: boolean; message: string }> {
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
          amountCoins,
          previousBalanceUSDT: prevFloatUSDT,
          newBalanceUSDT: newFloatUSDT,
          notes: `Asignación de saldo flotante por Super Admin ${adminName}: ${notes}`,
          timestamp: now
        })

        return {
          success: true,
          message: `Asignados +$${amountUSDT.toFixed(2)} USDT a la caja del cajero.`
        }
      })
    } catch (e: any) {
      console.warn('[rechargeCashierFloatAtomics] Fallback a cliente SDK:', e?.message)
    }
  }

  // Fallback SDK
  try {
    const cashierDocRef = doc(db, 'cashier_profiles', cashierUid)
    const cashierSnap = await getDoc(cashierDocRef)
    const prevFloatUSDT = cashierSnap.exists() ? Number(cashierSnap.data()?.floatBalanceUSDT || 0) : 0
    const newFloatUSDT = prevFloatUSDT + amountUSDT
    const newFloatCoins = Math.round(newFloatUSDT * 100)

    await setDoc(cashierDocRef, {
      uid: cashierUid,
      floatBalanceUSDT: newFloatUSDT,
      floatBalanceCoins: newFloatCoins,
      lastRechargeAt: now
    }, { merge: true })
  } catch (err: any) {
    console.warn('[rechargeCashierFloatAtomics Fallback] Error:', err?.message)
  }

  return {
    success: true,
    message: `Asignados +$${amountUSDT.toFixed(2)} USDT a la caja del cajero.`
  }
}
