import { db } from './firebase'
import { collection, getDocs, doc, getDoc, updateDoc, arrayUnion, increment } from 'firebase/firestore'
import { recordWalletTransaction } from './wallet-service'
import { getLiveTournaments } from './economy-service'

export interface Tournament {
  id: string
  title: string
  subtitle: string
  badge: string
  potSC: number
  entryFeeSC: number
  endDate: string
  playersRegistered: number
  maxPlayers: number
  bannerGradient: string
  accentColor: string
  rules: string
  isActive?: boolean
}

export const DEFAULT_TOURNAMENTS: Tournament[] = [
  {
    id: 'tour_1',
    title: 'Copa Galáctica Cyber Candy',
    subtitle: 'Torneo oficial de 4 jugadores con eliminatorias directas.',
    badge: 'En Curso',
    potSC: 50000,
    entryFeeSC: 250,
    endDate: 'Termina en 3 días',
    playersRegistered: 128,
    maxPlayers: 256,
    bannerGradient: 'linear-gradient(135deg, oklch(0.7 0.27 350 / 0.4), oklch(0.14 0.04 45 / 0.8))',
    accentColor: 'var(--candy-magenta)',
    rules: 'Partidas 4 Jugadores • Sin tiempo de espera • +25% XP extra',
    isActive: true
  },
  {
    id: 'tour_2',
    title: 'Desafío Relámpago Hexagonal',
    subtitle: 'El campo de batalla más grande: 6 jugadores, 1 solo campeón.',
    badge: 'Inscripción Abierta',
    potSC: 80000,
    entryFeeSC: 500,
    endDate: 'Inicia en 12 horas',
    playersRegistered: 48,
    maxPlayers: 64,
    bannerGradient: 'linear-gradient(135deg, oklch(0.82 0.15 200 / 0.4), oklch(0.12 0.02 285 / 0.8))',
    accentColor: 'var(--candy-cyan)',
    rules: 'Tablero Hexagonal • Reglas Clásicas • Pozo acumulado dinámico',
    isActive: true
  }
]

export async function fetchActiveTournaments(): Promise<Tournament[]> {
  try {
    const tourCol = collection(db, 'tournaments')
    const snap = await getDocs(tourCol)
    
    if (!snap.empty) {
      const list: Tournament[] = []
      snap.forEach(docSnap => {
        const d = docSnap.data()
        if (d.isActive !== false) {
          list.push({
            id: docSnap.id,
            title: d.title || 'Torneo Oficial',
            subtitle: d.subtitle || 'Competencia de temporada',
            badge: d.badge || 'En Curso',
            potSC: Number(d.potSC || 10000),
            entryFeeSC: Number(d.entryFeeSC || 100),
            endDate: d.endDate || 'Próximamente',
            playersRegistered: Number(d.playersRegistered || (Array.isArray(d.participants) ? d.participants.length : 0)),
            maxPlayers: Number(d.maxPlayers || 64),
            bannerGradient: d.bannerGradient || 'linear-gradient(135deg, oklch(0.7 0.27 350 / 0.4), oklch(0.14 0.04 45 / 0.8))',
            accentColor: d.accentColor || 'var(--candy-magenta)',
            rules: d.rules || 'Reglas estándar de Sugar Ludo',
            isActive: d.isActive !== false
          })
        }
      })
      if (list.length > 0) return list
    }
  } catch (error) {
    console.warn('Error fetching tournaments from Firestore, using default catalog:', error)
  }

  // Verificar si hay torneos configurados en la economía en vivo
  try {
    const liveTours = getLiveTournaments()
    if (liveTours && liveTours.length > 0) {
      return liveTours.map((t: any, idx: number) => ({
        id: t.id || `tour_cfg_${idx}`,
        title: t.title || t.name || 'Torneo Oficial',
        subtitle: t.subtitle || 'Torneo configurado por Administración',
        badge: t.badge || 'Inscripción Abierta',
        potSC: Number(t.potSC || t.prizePoolSC || 50000),
        entryFeeSC: Number(t.entryFeeSC || 250),
        endDate: t.endDate || 'Próximamente',
        playersRegistered: Number(t.playersRegistered || 0),
        maxPlayers: Number(t.maxPlayers || 128),
        bannerGradient: t.bannerGradient || 'linear-gradient(135deg, oklch(0.7 0.27 350 / 0.4), oklch(0.14 0.04 45 / 0.8))',
        accentColor: t.accentColor || 'var(--candy-magenta)',
        rules: t.rules || 'Reglas oficiales de torneo Sugar Ludo',
        isActive: t.isActive !== false
      }))
    }
  } catch {}

  return DEFAULT_TOURNAMENTS
}

export async function registerUserInTournament(
  userId: string | undefined,
  tournament: Tournament,
  currentCoins: number,
  deductCoinsFn?: (amount: number) => Promise<boolean>
): Promise<{ success: boolean; message: string }> {
  if (currentCoins < tournament.entryFeeSC) {
    return { success: false, message: 'Saldo insuficiente de Sugar Coins para inscribirte.' }
  }

  // 1. Deduct coins
  if (deductCoinsFn) {
    const ok = await deductCoinsFn(tournament.entryFeeSC)
    if (!ok) return { success: false, message: 'Error al descontar Sugar Coins.' }
  }

  // 2. Persist in user document & tournament document in Firestore
  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, {
        registeredTournaments: arrayUnion(tournament.id)
      })

      const tourRef = doc(db, 'tournaments', tournament.id)
      const tourSnap = await getDoc(tourRef)
      if (tourSnap.exists()) {
        await updateDoc(tourRef, {
          participants: arrayUnion(userId),
          playersRegistered: increment(1)
        })
      }

      await recordWalletTransaction(userId, {
        type: 'withdraw',
        amount: -tournament.entryFeeSC,
        description: `Inscripción a Torneo: ${tournament.title}`
      })
    } catch (e) {
      console.warn('Firestore tournament registration error:', e)
    }
  } else {
    // LocalStorage fallback
    const key = 'sugar_registered_tournaments_' + (userId || 'local')
    let list: string[] = []
    try {
      const stored = localStorage.getItem(key)
      if (stored) list = JSON.parse(stored)
    } catch {}
    if (!list.includes(tournament.id)) {
      list.push(tournament.id)
      localStorage.setItem(key, JSON.stringify(list))
    }
  }

  return {
    success: true,
    message: `🏆 ¡Inscrito con éxito en ${tournament.title}!`
  }
}
