import { db } from './firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { recordWalletTransaction } from './wallet-service'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  rewardSC: number
  rewardXP: number
  current: number
  target: number
  unlocked: boolean
  claimed: boolean
  progress: string
  progressPercent: number
}

export interface AchievementDef {
  id: string
  title: string
  description: string
  icon: string
  rewardSC: number
  rewardXP: number
  target: number
  getValue: (stats: any, ownedItemsCount: number) => number
}

export const BASE_ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'ach_first_win',
    title: 'Primer Triunfo',
    description: 'Gana tu primera partida en cualquier modo de juego.',
    icon: '🥇',
    rewardSC: 100,
    rewardXP: 50,
    target: 1,
    getValue: (s) => Number(s?.totalWins || 0)
  },
  {
    id: 'ach_games_10',
    title: 'Veterano del Tablero',
    description: 'Completa un total de 10 partidas jugadas.',
    icon: '⚔️',
    rewardSC: 200,
    rewardXP: 100,
    target: 10,
    getValue: (s) => Number(s?.totalGames || (Number(s?.totalWins || 0) + Number(s?.totalLosses || 0)))
  },
  {
    id: 'ach_streak_3',
    title: 'Racha Imparable',
    description: 'Consigue una racha de 3 victorias consecutivas.',
    icon: '🔥',
    rewardSC: 300,
    rewardXP: 150,
    target: 3,
    getValue: (s) => Number(s?.winStreak || 0)
  },
  {
    id: 'ach_cups_500',
    title: 'Ascenso a Plata',
    description: 'Alcanza al menos 500 Copas o Puntos de Rango.',
    icon: '🏆',
    rewardSC: 400,
    rewardXP: 200,
    target: 500,
    getValue: (s) => Number(s?.rankPoints !== undefined ? s.rankPoints : (Number(s?.totalWins || 0) * 25))
  },
  {
    id: 'ach_collector_4',
    title: 'Coleccionista Novel',
    description: 'Posee al menos 4 aspectos o ítems en tu arsenal.',
    icon: '💎',
    rewardSC: 250,
    rewardXP: 100,
    target: 4,
    getValue: (_s, ownedCount) => ownedCount
  },
  {
    id: 'ach_wins_10',
    title: 'Maestro de Victorias',
    description: 'Acumula un total de 10 victorias en el juego.',
    icon: '👑',
    rewardSC: 500,
    rewardXP: 250,
    target: 10,
    getValue: (s) => Number(s?.totalWins || 0)
  },
  {
    id: 'ach_level_5',
    title: 'Nivel Superior',
    description: 'Alcanza el Nivel 5 de Jugador.',
    icon: '⚡',
    rewardSC: 350,
    rewardXP: 150,
    target: 5,
    getValue: (s) => Number(s?.level || 1)
  },
  {
    id: 'ach_cups_1000',
    title: 'Liga de Oro',
    description: 'Alcanza las 1,000 Copas en la arena competitiva.',
    icon: '🏛️',
    rewardSC: 600,
    rewardXP: 300,
    target: 1000,
    getValue: (s) => Number(s?.rankPoints !== undefined ? s.rankPoints : (Number(s?.totalWins || 0) * 25))
  }
]

export async function fetchUserAchievements(
  userId?: string, 
  userStats?: any,
  ownedItemsCount: number = 3
): Promise<Achievement[]> {
  let claimedMap: Record<string, boolean> = {}

  // 1. Check local storage fallback
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sugar_claimed_achievements_' + (userId || 'local'))
    if (stored) {
      try { claimedMap = JSON.parse(stored) } catch {}
    }
  }

  // 2. Check Firestore
  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      const snap = await getDoc(userRef)
      if (snap.exists()) {
        const data = snap.data()
        if (data.claimedAchievements) {
          claimedMap = { ...claimedMap, ...data.claimedAchievements }
        }
      }
    } catch (e) {
      console.warn('Error fetching achievements from Firestore:', e)
    }
  }

  // 3. Compute dynamic achievements
  return BASE_ACHIEVEMENTS.map((def) => {
    const rawVal = def.getValue(userStats, ownedItemsCount)
    const current = Math.min(rawVal, def.target)
    const unlocked = current >= def.target
    const claimed = !!claimedMap[def.id]
    const progressPercent = Math.min(100, Math.round((current / def.target) * 100))

    return {
      id: def.id,
      title: def.title,
      description: def.description,
      icon: def.icon,
      rewardSC: def.rewardSC,
      rewardXP: def.rewardXP,
      current,
      target: def.target,
      unlocked,
      claimed,
      progress: `${current}/${def.target}`,
      progressPercent
    }
  })
}

export async function claimAchievementReward(
  userId: string | undefined,
  achievement: Achievement,
  addCoinsFn?: (coins: number) => void
): Promise<{ success: boolean; message: string }> {
  if (achievement.claimed || !achievement.unlocked) {
    return { success: false, message: 'El logro aún está bloqueado o ya fue reclamado.' }
  }

  // 1. Update localStorage
  let claimedMap: Record<string, boolean> = {}
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('sugar_claimed_achievements_' + (userId || 'local'))
    if (stored) {
      try { claimedMap = JSON.parse(stored) } catch {}
    }
    claimedMap[achievement.id] = true
    localStorage.setItem('sugar_claimed_achievements_' + (userId || 'local'), JSON.stringify(claimedMap))
  }

  // 2. Update Firestore
  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      const snap = await getDoc(userRef)
      if (snap.exists()) {
        const data = snap.data()
        const currentXp = Number(data.xp || 0) + achievement.rewardXP
        let currentLevel = Number(data.level || 1)
        let newXp = currentXp

        while (newXp >= currentLevel * 300) {
          newXp -= currentLevel * 300
          currentLevel += 1
        }

        await updateDoc(userRef, {
          claimedAchievements: { ...(data.claimedAchievements || {}), [achievement.id]: true },
          xp: newXp,
          level: currentLevel
        })

        await recordWalletTransaction(userId, {
          type: 'bonus',
          amount: achievement.rewardSC,
          description: 'Logro desbloqueado: ' + achievement.title
        })
      }
    } catch (e) {
      console.warn('Error claiming achievement in Firestore:', e)
    }
  }

  if (addCoinsFn) {
    addCoinsFn(achievement.rewardSC)
  }

  return {
    success: true,
    message: `🎉 ¡Logro reclamado! +${achievement.rewardSC} Sugar Coins y +${achievement.rewardXP} XP`
  }
}
