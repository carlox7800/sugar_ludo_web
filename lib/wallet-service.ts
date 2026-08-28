import { db } from './firebase'
import { updateDoc, doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'
import { broadcastLocalMessage } from './friends-service'

export type TransactionType = 'deposit' | 'withdraw' | 'match_fee' | 'match_prize' | 'bonus'

export interface WalletTransaction {
  id?: string
  type: TransactionType
  amount: number
  description: string
  timestamp?: number
  dateStr?: string
}

export interface PlayerP2POrder {
  id: string
  type: 'deposit' | 'withdraw'
  status: 'pending' | 'assigned' | 'paid' | 'verified' | 'completed' | 'disputed' | 'cancelled'
  playerUid: string
  playerName: string
  amountFiat: number
  currency: string
  amountSugarCoins: number
  paymentMethod: string
  receiptReferenceNumber?: string
  createdAt: number
}

const LOCAL_ORDERS_KEY = 'sugar_cashier_orders'

function saveLocalOrder(order: PlayerP2POrder) {
  if (typeof window === 'undefined') return
  try {
    const existing = JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]')
    const filtered = existing.filter((o: PlayerP2POrder) => o.id !== order.id)
    filtered.unshift(order)
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(filtered.slice(0, 50)))
  } catch {}
}

export function getStoredLocalOrders(): PlayerP2POrder[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(LOCAL_ORDERS_KEY) || '[]')
  } catch {
    return []
  }
}

export async function recordWalletTransaction(userId: string, tx: Omit<WalletTransaction, 'id' | 'timestamp' | 'dateStr'>, skipCoinUpdate = false) {
  if (!userId || userId.startsWith('dev_')) return

  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) return

    const userData = userSnap.data()
    
    // Preparar el nuevo historial
    const now = new Date()
    const newTx: WalletTransaction = {
      ...tx,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      dateStr: now.toLocaleDateString('es-ES', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }

    let history: WalletTransaction[] = userData.walletHistory || []
    // Agregar al principio
    history.unshift(newTx)
    // Mantener solo los últimos 50 movimientos
    if (history.length > 50) {
      history = history.slice(0, 50)
    }

    const updates: any = { walletHistory: history }

    if (!skipCoinUpdate) {
      const currentCoins = Number(userData.coins || 0)
      updates.coins = currentCoins + tx.amount
    }

    await updateDoc(userRef, updates)
  } catch (error) {
    console.error('Error saving wallet transaction:', error)
  }
}

export async function fetchWalletTransactions(userId: string): Promise<WalletTransaction[]> {
  if (!userId || userId.startsWith('dev_')) return []
  
  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (userSnap.exists()) {
      const data = userSnap.data()
      return data.walletHistory || []
    }
    
    return []
  } catch (error) {
    console.error('Error fetching wallet transactions:', error)
    return []
  }
}

/**
 * Crea una orden real de depósito P2P en 'pending' sin acreditar monedas de inmediato
 */
export async function createDepositOrder(params: {
  playerUid: string
  playerName: string
  amountFiat: number
  currency: string
  receiptReferenceNumber: string
}): Promise<{ success: boolean; orderId: string }> {
  const { playerUid, playerName, amountFiat, currency, receiptReferenceNumber } = params
  const orderId = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const amountSugarCoins = Math.round(amountFiat * 100)

  const orderData: PlayerP2POrder = {
    id: orderId,
    type: 'deposit',
    status: 'pending',
    playerUid,
    playerName: playerName || 'Jugador',
    amountFiat,
    currency,
    amountSugarCoins,
    paymentMethod: 'usdt_trc20',
    receiptReferenceNumber,
    createdAt: Date.now()
  }

  // 1. Guardar en localStorage y emitir por canales locales/SSE/HTTP a cajeros
  saveLocalOrder(orderData)
  try {
    broadcastLocalMessage({
      type: 'p2p_data',
      dataType: 'new_cashier_order',
      order: orderData,
      timestamp: Date.now()
    })
  } catch {}

  // Post directo al Hub de Cajeros (puerto 3001 en local y servidor Render)
  try {
    const hubEndpoints = [
      'http://localhost:3001/api/cashier/orders',
      'https://juego-de-servidor.onrender.com/api/cashier/orders'
    ]
    hubEndpoints.forEach((url) => {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
        mode: 'cors'
      }).catch(() => {})
    })
  } catch {}

  // 2. Registrar en movimientos recientes con el monto real +amountSugarCoins pero sin alterar balance (skipCoinUpdate = true)
  try {
    await recordWalletTransaction(playerUid, {
      type: 'deposit',
      amount: amountSugarCoins,
      description: 'Solicitud de Depósito (Pendiente)'
    }, true)
  } catch (histErr) {
    console.warn('[WalletService] Error registrando historial:', histErr)
  }

  // 3. Persistir en Firestore con timeout seguro para no bloquear la UI
  try {
    const orderRef = doc(db, 'cashier_orders', orderId)
    await Promise.race([
      setDoc(orderRef, orderData),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ])
  } catch (err: any) {
    console.warn('[WalletService] Firestore setDoc timeout notice:', err?.message)
  }

  return { success: true, orderId }
}

/**
 * Crea una orden real de retiro P2P congelando el saldo en Escrow
 */
export async function createWithdrawOrder(params: {
  playerUid: string
  playerName: string
  amountFiat: number
  currency: string
  paymentAddress: string
  isVip: boolean
}): Promise<{ success: boolean; orderId: string }> {
  const { playerUid, playerName, amountFiat, currency, paymentAddress, isVip } = params
  const orderId = `wit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`
  const amountSugarCoins = Math.round(amountFiat * 100)

  const orderData: PlayerP2POrder = {
    id: orderId,
    type: 'withdraw',
    status: 'pending',
    playerUid,
    playerName: playerName || 'Jugador',
    amountFiat,
    currency,
    amountSugarCoins,
    paymentMethod: 'usdt_trc20',
    receiptReferenceNumber: paymentAddress,
    createdAt: Date.now()
  }

  // 1. Guardar en localStorage y emitir por canales locales/SSE/HTTP a cajeros
  saveLocalOrder(orderData)
  try {
    broadcastLocalMessage({
      type: 'p2p_data',
      dataType: 'new_cashier_order',
      order: orderData,
      timestamp: Date.now()
    })
  } catch {}

  // Post directo al Hub de Cajeros (puerto 3001 en local y servidor Render)
  try {
    const hubEndpoints = [
      'http://localhost:3001/api/cashier/orders',
      'https://juego-de-servidor.onrender.com/api/cashier/orders'
    ]
    hubEndpoints.forEach((url) => {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
        mode: 'cors'
      }).catch(() => {})
    })
  } catch {}

  // 2. Debitar balance utilizable y registrar historial
  try {
    await recordWalletTransaction(playerUid, {
      type: 'withdraw',
      amount: -amountSugarCoins,
      description: 'Solicitud de Retiro (Pendiente)'
    })
  } catch (histErr) {
    console.warn('[WalletService] Error debitando monedas:', histErr)
  }

  // 3. Persistir en Firestore con timeout seguro
  try {
    const orderRef = doc(db, 'cashier_orders', orderId)
    await Promise.race([
      setDoc(orderRef, orderData),
      new Promise((resolve) => setTimeout(resolve, 2500))
    ])
  } catch (err: any) {
    console.warn('[WalletService] Firestore setDoc timeout notice:', err?.message)
  }

  return { success: true, orderId }
}

/**
 * Consulta órdenes activas del jugador ($0.00 lecturas masivas)
 */
export async function fetchActivePlayerOrders(playerUid: string): Promise<PlayerP2POrder[]> {
  if (!playerUid || playerUid.startsWith('dev_')) {
    return getStoredLocalOrders().filter((o) => o.status !== 'completed' && o.status !== 'cancelled')
  }

  try {
    const q = query(
      collection(db, 'cashier_orders'),
      where('playerUid', '==', playerUid),
      where('status', 'in', ['pending', 'assigned', 'paid', 'disputed'])
    )
    const snap = await getDocs(q)
    const list: PlayerP2POrder[] = []
    snap.forEach((d) => {
      list.push(d.data() as PlayerP2POrder)
    })

    if (list.length > 0) return list

    // Fallback a local
    return getStoredLocalOrders().filter((o) => o.playerUid === playerUid && o.status !== 'completed' && o.status !== 'cancelled')
  } catch {
    return getStoredLocalOrders().filter((o) => o.playerUid === playerUid && o.status !== 'completed' && o.status !== 'cancelled')
  }
}
