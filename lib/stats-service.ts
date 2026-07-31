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

export interface MatchRecord {
  id?: string
  mode: string // e.g. "Entrenamiento IA (4J)", "Entrenamiento IA (6J)", "Online"
  rank: number // 1 for 1st place, 2 for 2nd, etc.
  totalPlayers: number
  opponents: string[]
  durationSeconds: number
  xpGained: number
  coinsEarned: number
  timestamp?: any
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

    // 1. Save match history record in subcollection users/{userId}/match_history
    const historyRef = collection(db, 'users', userId, 'match_history')
    const now = new Date()
    const dateStr = now.toLocaleDateString('es-ES', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })

    await addDoc(historyRef, {
      ...matchData,
      xpGained: gainedXp,
      timestamp: serverTimestamp(),
      dateStr,
    })

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
    })
  } catch (error) {
    console.error('Error al registrar resultado de la partida en Firestore:', error)
  }
}

export async function fetchMatchHistory(userId: string): Promise<MatchRecord[]> {
  if (!userId || userId.startsWith('dev_')) return []

  try {
    const historyRef = collection(db, 'users', userId, 'match_history')
    // Eliminamos orderBy y limit de la consulta para evitar que Firebase arroje error exigiendo índice.
    // Al ser una subcolección por usuario con pocos documentos, ordenarlo localmente es eficiente y seguro.
    const snapshot = await getDocs(historyRef)

    const records = snapshot.docs.map((docSnap) => {
      const data = docSnap.data()
      // Manejar el caso de que timestamp sea null (pendiente) o un objeto de Firebase
      let ts = 0
      if (data.timestamp && typeof data.timestamp.toMillis === 'function') {
        ts = data.timestamp.toMillis()
      } else if (data.timestamp) {
        ts = Number(data.timestamp)
      } else {
        ts = Date.now() // Si no hay timestamp (recién creado), usar ahora
      }

      return {
        id: docSnap.id,
        mode: data.mode || 'Partida',
        rank: data.rank || 1,
        totalPlayers: data.totalPlayers || 4,
        opponents: data.opponents || [],
        durationSeconds: data.durationSeconds || 0,
        xpGained: data.xpGained || 0,
        coinsEarned: data.coinsEarned || 0,
        dateStr: data.dateStr || 'Reciente',
        _ts: ts // Guardar temporalmente para ordenar
      }
    })

    // Ordenar descendente (más recientes primero)
    records.sort((a, b) => b._ts - a._ts)

    // Remover la propiedad temporal _ts y devolver solo los primeros 20
    return records.slice(0, 20).map(r => {
      const { _ts, ...rest } = r
      return rest as MatchRecord
    })
  } catch (error) {
    // Usamos console.warn en lugar de console.error para evitar que Next.js despliegue
    // el toast o pantalla roja de error en el entorno del cliente.
    console.warn('Advertencia al obtener el historial de partidas desde Firestore:', error)
    return []
  }
}
