import { db } from './firebase'
import { updateDoc, doc, getDoc } from 'firebase/firestore'

export type TransactionType = 'deposit' | 'withdraw' | 'match_fee' | 'match_prize' | 'bonus'

export interface WalletTransaction {
  id?: string
  type: TransactionType
  amount: number
  description: string
  timestamp?: number
  dateStr?: string
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
