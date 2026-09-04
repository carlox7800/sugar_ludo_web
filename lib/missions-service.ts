import { db } from './firebase'
import { collection, getDocs, doc, getDoc, updateDoc, query, orderBy, limit } from 'firebase/firestore'
import { recordWalletTransaction } from './wallet-service'

export interface Mission {
  id: string
  title: string
  description: string
  rewardSC: number
  rewardXP: number
  current: number
  target: number
  category: 'daily' | 'weekly'
  claimed: boolean
  icon: string
}

export interface LeaderboardUser {
  rank: number
  uid: string
  name: string
  avatar: string
  avatarColor: string
  trophies: number
  level: number
  totalWins: number
  winRate: string
  league: string
  isCurrentUser?: boolean
}

export function getMissionResetTimes() {
  const now = new Date()
  // Daily reset at 00:00 UTC
  const tomorrowUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0))
  const dailyRemainingMs = Math.max(0, tomorrowUTC.getTime() - now.getTime())
  
  const dailyHours = Math.floor(dailyRemainingMs / (1000 * 60 * 60))
  const dailyMins = Math.floor((dailyRemainingMs % (1000 * 60 * 60)) / (1000 * 60))
  const dailySecs = Math.floor((dailyRemainingMs % (1000 * 60)) / 1000)

  // Weekly reset on Sunday midnight UTC
  const dayOfWeek = now.getUTCDay()
  const daysUntilSunday = (7 - dayOfWeek) % 7 || 7
  const nextSundayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilSunday, 0, 0, 0))
  const weeklyRemainingMs = Math.max(0, nextSundayUTC.getTime() - now.getTime())
  const weeklyDays = Math.floor(weeklyRemainingMs / (1000 * 60 * 60 * 24))
  const weeklyHours = Math.floor((weeklyRemainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  return {
    dailyFormatted: dailyHours + 'h ' + dailyMins + 'm ' + dailySecs + 's',
    weeklyFormatted: weeklyDays + 'd ' + weeklyHours + 'h restantes',
    dailyKey: now.toISOString().split('T')[0],
    weeklyKey: now.getUTCFullYear() + '-W' + Math.ceil(now.getUTCDate() / 7)
  }
}

export async function fetchUserMissions(userId?: string, userStats?: any): Promise<Mission[]> {
  const { dailyKey, weeklyKey } = getMissionResetTimes()
  let claimedMap: Record<string, boolean> = {}

  // Load claimed state
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sugar_claimed_missions_' + (userId || 'local'))
    if (stored) {
      try { claimedMap = JSON.parse(stored) } catch {}
    }
  }

  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      const snap = await getDoc(userRef)
      if (snap.exists()) {
        const data = snap.data()
        if (data.claimedMissions) {
          claimedMap = { ...claimedMap, ...data.claimedMissions }
        }
      }
    } catch {}
  }

  const wins = Number(userStats?.totalWins || 0)
  const games = Number(userStats?.totalGames || 0)
  const streak = Number(userStats?.winStreak || 0)
  const rankPts = Number(userStats?.rankPoints || 0)

  const missions: Mission[] = [
    {
      id: 'mis_daily_win_' + dailyKey,
      title: 'Victoria Imparable',
      description: 'Gana 2 partidas en Modo Competitivo o Entrenamiento.',
      rewardSC: 150,
      rewardXP: 100,
      current: Math.min(wins, 2),
      target: 2,
      category: 'daily',
      claimed: !!claimedMap['mis_daily_win_' + dailyKey],
      icon: '🏆'
    },
    {
      id: 'mis_daily_play_' + dailyKey,
      title: 'Guerrero del Tablero',
      description: 'Completa 3 partidas en cualquier modo de juego.',
      rewardSC: 200,
      rewardXP: 120,
      current: Math.min(games, 3),
      target: 3,
      category: 'daily',
      claimed: !!claimedMap['mis_daily_play_' + dailyKey],
      icon: '⚔️'
    },
    {
      id: 'mis_daily_rank_' + dailyKey,
      title: 'Cazador de Puntos',
      description: 'Alcanza al menos 50 Copas en la arena.',
      rewardSC: 120,
      rewardXP: 90,
      current: Math.min(rankPts, 50),
      target: 50,
      category: 'daily',
      claimed: !!claimedMap['mis_daily_rank_' + dailyKey],
      icon: '🎯'
    },
    {
      id: 'mis_weekly_champ_' + weeklyKey,
      title: 'Gran Maestro Semanal',
      description: 'Acumula 8 victorias durante la temporada actual.',
      rewardSC: 500,
      rewardXP: 400,
      current: Math.min(wins, 8),
      target: 8,
      category: 'weekly',
      claimed: !!claimedMap['mis_weekly_champ_' + weeklyKey],
      icon: '👑'
    },
    {
      id: 'mis_weekly_streak_' + weeklyKey,
      title: 'Racha Dorada',
      description: 'Consigue una racha invicta de 3 victorias consecutivas.',
      rewardSC: 400,
      rewardXP: 300,
      current: Math.min(streak, 3),
      target: 3,
      category: 'weekly',
      claimed: !!claimedMap['mis_weekly_streak_' + weeklyKey],
      icon: '⚡'
    }
  ]

  return missions
}

export async function claimMissionReward(
  userId: string | undefined,
  mission: Mission,
  addCoinsFn?: (coins: number) => void
): Promise<{ success: boolean; message: string }> {
  if (mission.claimed || mission.current < mission.target) {
    return { success: false, message: 'La misión aún no está completada o ya fue cobrada.' }
  }

  let claimedMap: Record<string, boolean> = {}
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sugar_claimed_missions_' + (userId || 'local'))
    if (stored) {
      try { claimedMap = JSON.parse(stored) } catch {}
    }
    claimedMap[mission.id] = true
    localStorage.setItem('sugar_claimed_missions_' + (userId || 'local'), JSON.stringify(claimedMap))
  }

  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      const snap = await getDoc(userRef)
      if (snap.exists()) {
        const data = snap.data()
        const currentXp = Number(data.xp || 0) + mission.rewardXP
        let currentLevel = Number(data.level || 1)
        let newXp = currentXp
        while (newXp >= currentLevel * 300) {
          newXp -= currentLevel * 300
          currentLevel += 1
        }
        await updateDoc(userRef, {
          claimedMissions: { ...(data.claimedMissions || {}), [mission.id]: true },
          xp: newXp,
          level: currentLevel
        })
        await recordWalletTransaction(userId, {
          type: 'bonus',
          amount: mission.rewardSC,
          description: 'Misión cumplida: ' + mission.title
        })
      }
    } catch (e) {
      console.warn('Error claiming mission in Firestore:', e)
    }
  }

  if (addCoinsFn) {
    addCoinsFn(mission.rewardSC)
  }

  return {
    success: true,
    message: '¡Recompensa cobrada! +' + mission.rewardSC + ' SC y +' + mission.rewardXP + ' XP'
  }
}

export async function getLeaderboardData(currentUser?: any): Promise<{ leaderboard: LeaderboardUser[]; myRank: number }> {
  const realUsers: LeaderboardUser[] = []

  try {
    const usersRef = collection(db, 'users')
    let snap
    try {
      const q = query(usersRef, orderBy('rankPoints', 'desc'), limit(50))
      snap = await getDocs(q)
    } catch {
      const qFallback = query(usersRef, limit(50))
      snap = await getDocs(qFallback)
    }
    
    if (!snap.empty) {
      snap.forEach((docSnap) => {
        const d = docSnap.data()
        const games = Number(d.totalGames || 0)
        const wins = Number(d.totalWins || 0)
        const winRate = games > 0 ? Math.round((wins / games) * 100) + '%' : '0%'
        const trophies = Number(d.rankPoints !== undefined ? d.rankPoints : (wins * 25))
        const isCur = currentUser?.uid === docSnap.id

        let league = 'Bronce'
        if (trophies >= 4000) league = 'Maestro Cristal'
        else if (trophies >= 3000) league = 'Diamante'
        else if (trophies >= 2000) league = 'Platino'
        else if (trophies >= 1000) league = 'Oro'
        else if (trophies >= 500) league = 'Plata'

        realUsers.push({
          rank: 0,
          uid: docSnap.id,
          name: d.nickname || d.displayName || 'Jugador_' + docSnap.id.substring(0, 4),
          avatar: d.photoURL || '🎲',
          avatarColor: trophies >= 2000 ? '#facc15' : '#38bdf8',
          trophies,
          level: Number(d.level || 1),
          totalWins: wins,
          winRate,
          league,
          isCurrentUser: isCur
        })
      })
    }
  } catch (e) {
    console.warn('Firestore users fetch:', e)
  }

  // If currentUser is not in list yet (e.g. in offline session or local storage)
  if (currentUser && !realUsers.some(u => u.uid === currentUser.uid)) {
    const myWins = Number(currentUser.totalWins || 0)
    const myTrophies = Number(currentUser.rankPoints !== undefined ? currentUser.rankPoints : (myWins * 25))
    const myGames = Number(currentUser.totalGames || 0)
    const myWinRate = myGames > 0 ? Math.round((myWins / myGames) * 100) + '%' : '0%'
    
    let myLeague = 'Bronce'
    if (myTrophies >= 4000) myLeague = 'Maestro Cristal'
    else if (myTrophies >= 3000) myLeague = 'Diamante'
    else if (myTrophies >= 2000) myLeague = 'Platino'
    else if (myTrophies >= 1000) myLeague = 'Oro'
    else if (myTrophies >= 500) myLeague = 'Plata'

    realUsers.push({
      rank: 0,
      uid: currentUser.uid || 'current_user',
      name: currentUser.nickname || 'Tú (Jugador)',
      avatar: currentUser.photoURL || '👑',
      avatarColor: '#facc15',
      trophies: myTrophies,
      level: Number(currentUser.level || 1),
      totalWins: myWins,
      winRate: myWinRate,
      league: myLeague,
      isCurrentUser: true
    })
  }

  // Sort strictly by real trophies descending (then wins)
  realUsers.sort((a, b) => b.trophies - a.trophies || b.totalWins - a.totalWins)

  // Assign 1, 2, 3... rank position
  realUsers.forEach((u, idx) => {
    u.rank = idx + 1
  })

  const myRankIdx = realUsers.findIndex(u => u.isCurrentUser)
  const myRank = myRankIdx >= 0 ? myRankIdx + 1 : 1

  return {
    leaderboard: realUsers,
    myRank
  }
}