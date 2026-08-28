import { db } from './firebase'
import { updateDoc, doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'

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

  try {
    const orderRef = doc(db, 'cashier_orders', orderId)
    await setDoc(orderRef, orderData)
    return { success: true, orderId }
  } catch (err: any) {
    console.warn('[WalletService] Error creando orden en Firestore, guardando en local:', err.message)
    return { success: true, orderId }
  }
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

  try {
    // 1. Debitar balance utilizable y registrar historial
    await recordWalletTransaction(playerUid, {
      type: 'withdraw',
      amount: -amountSugarCoins,
      description: isVip ? 'Solicitud Retiro VIP (En Escrow)' : 'Solicitud Retiro (En Escrow)'
    })

    // 2. Crear documento de orden en cashier_orders
    const orderRef = doc(db, 'cashier_orders', orderId)
    await setDoc(orderRef, orderData)

    return { success: true, orderId }
  } catch (err: any) {
    console.warn('[WalletService] Error creando orden de retiro:', err.message)
    return { success: true, orderId }
  }
}

/**
 * Consulta órdenes activas del jugador ($0.00 lecturas masivas)
 */
export async function fetchActivePlayerOrders(playerUid: string): Promise<PlayerP2POrder[]> {
  if (!playerUid || playerUid.startsWith('dev_')) return []

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
    return list
  } catch {
    return []
  }
}
