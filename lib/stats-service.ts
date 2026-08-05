import { db } from './firebase'
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore'
import { recordWalletTransaction } from './wallet-service'

export interface MatchRecord {
  id?: string
  mode: string // e.g. "Entrenamiento IA (4J)", "Entrenamiento IA (6J)", "Online"
  rank: number // 1 for 1st place, 2 for 2nd, etc.
  totalPlayers: number
  opponents: string[]
  durationSeconds: number
  xpGained: number
  coinsEarned: number
  timestamp?: number
  dateStr?: string
}

export async function recordMatchResult(userId: string, matchData: Omit<MatchRecord, 'id' | 'timestamp' | 'dateStr'>) {
  if (!userId || userId.startsWith('dev_')) return

  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) return

    const userData = userSnap.data()
    const currentXp = Number(userData.xp || 0)
    const currentLevel = Number(userData.level || 1)
    const currentWins = Number(userData.totalWins || 0)
    const currentLosses = Number(userData.totalLosses || 0)
    const currentGames = Number(userData.totalGames || 0)
    const currentRankPoints = Number(userData.rankPoints || 0)
    const currentWinStreak = Number(userData.winStreak || 0)
    const currentCoins = Number(userData.coins || 200)

    const isWin = matchData.rank === 1
    const newWins = currentWins + (isWin ? 1 : 0)
    const newLosses = currentLosses + (isWin ? 0 : 1)
    const newGames = currentGames + 1
    const newWinStreak = isWin ? currentWinStreak + 1 : 0
    const newCoins = currentCoins + matchData.coinsEarned

    // XP calculation: +150 for win, +40 for playing
    const gainedXp = matchData.xpGained || (isWin ? 150 : 40)
    let newXp = currentXp + gainedXp
    let newLevel = currentLevel
    
    // Level up check: XP needed for Level N is N * 300
    while (newXp >= newLevel * 300) {
      newXp -= newLevel * 300
      newLevel += 1
    }

    // Rank Points: +25 for win, -10 for loss (min 0)
    const gainedRankPoints = isWin ? 25 : -10
    const newRankPoints = Math.max(0, currentRankPoints + gainedRankPoints)

    const now = new Date()
    const dateStr = now.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    const newMatchRecord: MatchRecord = {
      ...matchData,
      id: Math.random().toString(36).substring(2, 9),
      xpGained: gainedXp,
      timestamp: Date.now(),
      dateStr,
    }

    let history: MatchRecord[] = userData.matchHistory || []
    history.unshift(newMatchRecord)
    if (history.length > 30) {
      history = history.slice(0, 30)
    }

    // 2. Update user profile document in Firestore
    await updateDoc(userRef, {
      xp: newXp,
      level: newLevel,
      totalWins: newWins,
      totalLosses: newLosses,
      totalGames: newGames,
      rankPoints: newRankPoints,
      winStreak: newWinStreak,
      coins: newCoins,
      matchHistory: history,
    })

    // 3. Record wallet transaction if coins were earned
    if (matchData.coinsEarned > 0) {
      await recordWalletTransaction(userId, {
        type: 'match_prize',
        amount: matchData.coinsEarned,
        description: `Premio: ${matchData.rank}º Lugar (${matchData.mode})`
      }, true) // skipCoinUpdate = true
    }
  } catch (error) {
    console.error('Error al registrar resultado de la partida en Firestore:', error)
  }
}

export async function fetchMatchHistory(userId: string): Promise<MatchRecord[]> {
  if (!userId || userId.startsWith('dev_')) return []

  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (userSnap.exists()) {
      const data = userSnap.data()
      return data.matchHistory || []
    }
    
    return []
  } catch (error) {
    console.warn('Advertencia al obtener el historial de partidas:', error)
    return []
  }
}
