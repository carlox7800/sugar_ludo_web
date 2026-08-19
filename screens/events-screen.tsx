'use client'

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  CalendarDays, 
  Trophy, 
  Target, 
  Flame, 
  Crown, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Award, 
  Medal, 
  ChevronRight, 
  ShieldCheck,
  Gift
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { usePlayer } from '@/lib/player-context'
import confetti from 'canvas-confetti'
import { PRESET_AVATARS } from '@/components/avatar-selector-modal'
import { 
  Mission, 
  LeaderboardUser, 
  fetchUserMissions, 
  claimMissionReward, 
  getLeaderboardData, 
  getMissionResetTimes 
} from '@/lib/missions-service'

function renderAvatar(avatar?: string, className = "size-full object-cover rounded-full") {
  if (!avatar) return '🎲'
  if (avatar.startsWith('http') || avatar.startsWith('data:')) {
    return <img src={avatar} alt="Avatar" className={className} />
  }
  const preset = PRESET_AVATARS.find(a => a.id === avatar)
  if (preset) return preset.emoji
  return avatar
}

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
}

const MOCK_TOURNAMENTS: Tournament[] = [
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
    rules: 'Partidas 4 Jugadores • Sin tiempo de espera • +25% XP extra'
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
    rules: 'Tablero Hexagonal • Reglas Clásicas • Pozo acumulado dinámico'
  }
]

export function EventsScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { coins, setCoins } = usePlayer()

  const [activeTab, setActiveTab] = useState<'missions' | 'tournaments' | 'leaderboard'>('missions')
  const [missionFilter, setMissionFilter] = useState<'all' | 'daily' | 'weekly'>('all')
  const [missions, setMissions] = useState<Mission[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [myRank, setMyRank] = useState<number>(1)
  const [resetTimes, setResetTimes] = useState(getMissionResetTimes())
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Load real missions & leaderboard
  useEffect(() => {
    fetchUserMissions(user?.uid, user).then(setMissions).catch(() => {})
    getLeaderboardData(user).then((res) => {
      setLeaderboard(res.leaderboard)
      setMyRank(res.myRank)
    }).catch(() => {})

    const timer = setInterval(() => {
      setResetTimes(getMissionResetTimes())
    }, 1000)
    return () => clearInterval(timer)
  }, [user])

  const handleClaimMission = async (missionId: string) => {
    const target = missions.find(m => m.id === missionId)
    if (!target || target.claimed || target.current < target.target) return

    const res = await claimMissionReward(user?.uid, target, (added) => {
      setCoins(coins + added)
    })

    if (res.success) {
      setMissions(prev => prev.map(m => m.id === missionId ? { ...m, claimed: true } : m))
      showToast(res.message)
      confetti({
        particleCount: 90,
        spread: 65,
        origin: { y: 0.6 }
      })
    } else {
      showToast(res.message)
    }
  }

  const filteredMissions = missions.filter(m => missionFilter === 'all' || m.category === missionFilter)
  const claimableCount = missions.filter(m => !m.claimed && m.current >= m.target).length

  return (
    <section className="animate-slide-in mx-auto flex w-full max-w-5xl flex-col gap-5 p-2 sm:p-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 flex items-center justify-center gap-2 rounded-full border border-[var(--candy-orange)]/40 bg-[oklch(0.1_0.05_250)] px-6 py-3 text-[var(--candy-orange)] font-display text-sm font-bold shadow-2xl shadow-[var(--candy-orange)]/20 whitespace-nowrap">
          <Sparkles className="size-4 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar (Homologado con Tienda, Billetera y Amigos) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn-3d flex size-10 items-center justify-center rounded-xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground"
            aria-label="Volver al Lobby"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-foreground flex items-center gap-2">
              Eventos & Misiones <CalendarDays className="size-6 text-[var(--candy-orange)]" />
            </h1>
            <p className="text-xs text-muted-foreground font-medium hidden sm:block">
              Supera desafíos diarios, participa en torneos de temporada y escala en el ranking.
            </p>
          </div>
        </div>

        {/* Season Timer Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--candy-orange)]/40 bg-[oklch(0_0_0/0.4)] px-3 py-1.5 shadow-inner">
            <Clock className="size-4 text-[var(--candy-orange)] animate-pulse" />
            <span className="font-display text-xs sm:text-sm font-black text-[var(--candy-orange)]">
              Temporada 1: {resetTimes.weeklyFormatted}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[oklch(1_0_0/0.03)] p-1.5 border border-border/80">
        <button
          onClick={() => setActiveTab('missions')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all relative",
            activeTab === 'missions'
              ? "bg-[linear-gradient(145deg,var(--candy-orange),oklch(0.65_0.20_45))] text-white shadow-lg shadow-[var(--candy-orange)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Target className="size-4" />
          <span>Misiones</span>
          {claimableCount > 0 && (
            <span className="size-5 rounded-full bg-emerald-500 text-[10px] font-black text-white flex items-center justify-center shadow-md animate-pulse">
              {claimableCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('tournaments')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all",
            activeTab === 'tournaments'
              ? "bg-[linear-gradient(145deg,var(--candy-orange),oklch(0.65_0.20_45))] text-white shadow-lg shadow-[var(--candy-orange)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Trophy className="size-4" />
          <span>Torneos ({MOCK_TOURNAMENTS.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all",
            activeTab === 'leaderboard'
              ? "bg-[linear-gradient(145deg,var(--candy-orange),oklch(0.65_0.20_45))] text-white shadow-lg shadow-[var(--candy-orange)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Crown className="size-4" />
          <span>Clasificación</span>
        </button>
      </div>

      {/* TAB 1: MISIONES */}
      {activeTab === 'missions' && (
        <div className="flex flex-col gap-4 animate-in fade-in">
          {/* Sub-filtros de misiones */}
          <div className="flex gap-2">
            <button
              onClick={() => setMissionFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-xl font-display text-xs font-bold transition-all",
                missionFilter === 'all' ? "bg-white/15 text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Todas
            </button>
            <button
              onClick={() => setMissionFilter('daily')}
              className={cn(
                "px-3 py-1.5 rounded-xl font-display text-xs font-bold transition-all",
                missionFilter === 'daily' ? "bg-[var(--candy-orange)]/20 text-[var(--candy-orange)] border border-[var(--candy-orange)]/30" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Diarias
            </button>
            <button
              onClick={() => setMissionFilter('weekly')}
              className={cn(
                "px-3 py-1.5 rounded-xl font-display text-xs font-bold transition-all",
                missionFilter === 'weekly' ? "bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)] border border-[var(--candy-cyan)]/30" : "text-muted-foreground hover:text-foreground"
              )}
            >
              Semanales
            </button>
          </div>

          {/* Grid de Misiones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredMissions.map((mission) => {
              const isCompleted = mission.current >= mission.target
              const progressPct = Math.min(100, Math.round((mission.current / mission.target) * 100))

              return (
                <div
                  key={mission.id}
                  className={cn(
                    "glass flex flex-col justify-between p-4 sm:p-5 rounded-3xl border transition-all shadow-md gap-4",
                    mission.claimed
                      ? "border-border/40 opacity-60 bg-black/20"
                      : isCompleted
                      ? "border-emerald-500/50 bg-[linear-gradient(135deg,oklch(0.14_0.04_150/0.4),oklch(0.12_0.02_285/0.8))]"
                      : "border-border/80 bg-[oklch(1_0_0/0.02)]"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-3xl p-2 rounded-2xl bg-black/40 border border-white/10 shrink-0">
                      {mission.icon}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-base font-extrabold text-foreground truncate">
                          {mission.title}
                        </h3>
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-black uppercase shrink-0",
                          mission.category === 'daily'
                            ? "bg-[var(--candy-orange)]/20 text-[var(--candy-orange)]"
                            : "bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)]"
                        )}>
                          {mission.category === 'daily' ? 'Diaria' : 'Semanal'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {mission.description}
                      </p>
                    </div>
                  </div>

                  {/* Barra de Progreso y Recompensas */}
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs font-display font-bold">
                      <span className="text-muted-foreground">Progreso:</span>
                      <span className={isCompleted ? "text-emerald-400 font-black" : "text-foreground"}>
                        {mission.current} / {mission.target} ({progressPct}%)
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-black/40 border border-white/5 overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isCompleted
                            ? "bg-[linear-gradient(90deg,#34d399,#10b981)]"
                            : "bg-[linear-gradient(90deg,var(--candy-orange),oklch(0.7_0.2_50))]"
                        )}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>

                    {/* Recompensas y Botón */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/40 mt-1">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 font-display text-xs font-black text-[var(--candy-gold)]">
                          +{mission.rewardSC} <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" />
                        </div>
                        <div className="flex items-center gap-1 font-display text-xs font-bold text-[var(--candy-cyan)]">
                          +{mission.rewardXP} XP
                        </div>
                      </div>

                      {mission.claimed ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400/80">
                          <CheckCircle2 className="size-4" /> Reclamado
                        </span>
                      ) : isCompleted ? (
                        <button
                          onClick={() => handleClaimMission(mission.id)}
                          className="btn-3d flex items-center gap-1.5 rounded-xl bg-[linear-gradient(145deg,#10b981,#059669)] px-4 py-2 font-display text-xs font-black text-white shadow-lg hover:scale-105 transition-all"
                        >
                          <Gift className="size-3.5" />
                          <span>Reclamar</span>
                        </button>
                      ) : (
                        <span className="text-[11px] font-bold text-muted-foreground/60">
                          En Progreso
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 2: TORNEOS DE TEMPORADA */}
      {activeTab === 'tournaments' && (
        <div className="flex flex-col gap-4 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MOCK_TOURNAMENTS.map((tour) => (
              <div
                key={tour.id}
                className="glass relative overflow-hidden flex flex-col justify-between p-6 rounded-3xl border border-border shadow-xl hover:border-[var(--candy-orange)]/50 transition-all"
                style={{ background: tour.bannerGradient }}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-white/15 px-3 py-1 font-display text-[10px] font-black uppercase text-white shadow-inner">
                      {tour.badge}
                    </span>
                    <span className="flex items-center gap-1 text-xs font-bold text-white/80">
                      <Clock className="size-3.5" /> {tour.endDate}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-black text-white drop-shadow-md">
                    {tour.title}
                  </h3>
                  <p className="text-xs text-white/80 leading-relaxed">
                    {tour.subtitle}
                  </p>

                  <div className="rounded-2xl bg-black/40 border border-white/10 p-3.5 flex flex-col gap-2 mt-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-semibold">Pozo de Premios:</span>
                      <span className="font-display text-base font-black text-[var(--candy-gold)] flex items-center gap-1">
                        {tour.potSC.toLocaleString()} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" />
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-semibold">Entrada:</span>
                      <span className="font-display text-xs font-bold text-white">
                        {tour.entryFeeSC} SC
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-semibold">Registrados:</span>
                      <span className="font-display text-xs font-bold text-emerald-400">
                        {tour.playersRegistered} / {tour.maxPlayers} Jugadores
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-2">
                  <button
                    onClick={() => setSelectedTournament(tour)}
                    className="btn-3d w-full flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,var(--candy-orange),oklch(0.65_0.20_45))] py-3 font-display text-sm font-black text-white shadow-lg hover:scale-[1.02] transition-all"
                  >
                    <Trophy className="size-4" />
                    <span>Ver Detalles & Inscribirse</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: CLASIFICACIÓN (LEADERBOARD) */}
      {activeTab === 'leaderboard' && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Tarjeta de Posición del Jugador */}
          {(() => {
            const userTrophies = Number(user?.rankPoints !== undefined ? user.rankPoints : (Number(user?.totalWins || 0) * 25))

            return (
              <div className="glass rounded-2xl p-4 border border-[var(--candy-gold)]/50 bg-[linear-gradient(135deg,oklch(0.18_0.05_55/0.5),oklch(0.12_0.02_285/0.8))] flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                  <div className="size-10 rounded-xl bg-[var(--candy-gold)]/20 border border-[var(--candy-gold)]/40 flex items-center justify-center font-display text-sm font-black text-[var(--candy-gold)]">
                    #{myRank}
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-[var(--candy-gold)] tracking-wider">Tu Posición Global</span>
                    <h3 className="font-display text-sm sm:text-base font-extrabold text-white">{user?.nickname || 'Jugador'}</h3>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 font-display text-sm font-black text-[var(--candy-gold)] bg-black/40 px-3 py-1.5 rounded-xl border border-[var(--candy-gold)]/30">
                  <Trophy className="size-4 text-[var(--candy-gold)]" />
                  <span>{userTrophies.toLocaleString()} Copas</span>
                </div>
              </div>
            )
          })()}

          {/* PODIO TOP 3 (ADAPTATIVO REAL) */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4 items-end pt-6 pb-2">
            {/* Top 2 (Plata) */}
            {leaderboard[1] ? (
              <div className="glass flex flex-col items-center p-3 sm:p-5 rounded-3xl border border-slate-400/40 bg-[linear-gradient(180deg,rgba(148,163,184,0.15),transparent)] text-center relative order-1 animate-in fade-in">
                <span className="absolute -top-4 rounded-full bg-slate-300 text-slate-900 font-display text-xs font-black px-2.5 py-0.5 shadow-md">
                  2° Plata
                </span>
                <div className="size-14 sm:size-16 rounded-full bg-slate-400/20 text-3xl flex items-center justify-center border-2 border-slate-300 shadow-lg mt-2 overflow-hidden">
                  {renderAvatar(leaderboard[1].avatar)}
                </div>
                <h4 className="font-display text-xs sm:text-sm font-extrabold text-white mt-2 truncate w-full flex items-center justify-center gap-1">
                  {leaderboard[1].name}
                  {leaderboard[1].isCurrentUser && (
                    <span className="rounded-full bg-[var(--candy-gold)]/20 text-[9px] font-black uppercase text-[var(--candy-gold)] px-1.5 py-0.2">Tú</span>
                  )}
                </h4>
                <span className="font-display text-xs font-bold text-[var(--candy-gold)] mt-1 flex items-center gap-1">
                  <Trophy className="size-3" /> {leaderboard[1].trophies.toLocaleString()} Copas
                </span>
              </div>
            ) : (
              <div className="glass flex flex-col items-center p-3 sm:p-5 rounded-3xl border border-dashed border-slate-400/25 bg-[oklch(1_0_0/0.02)] text-center relative order-1 opacity-60">
                <span className="absolute -top-4 rounded-full bg-slate-500/40 text-slate-300 font-display text-[10px] font-bold px-2 py-0.5">
                  2° Plata
                </span>
                <div className="size-14 sm:size-16 rounded-full bg-slate-500/10 text-2xl flex items-center justify-center border border-dashed border-slate-400/30 text-muted-foreground mt-2">
                  🥈
                </div>
                <h4 className="font-display text-xs font-bold text-muted-foreground mt-2">
                  Esperando retador
                </h4>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Vacante
                </span>
              </div>
            )}

            {/* Top 1 (Oro - Centro y más alto) */}
            {leaderboard[0] ? (
              <div className="glass flex flex-col items-center p-4 sm:p-6 rounded-3xl border-2 border-[var(--candy-gold)] bg-[linear-gradient(180deg,rgba(255,215,0,0.25),transparent)] text-center relative order-2 scale-105 shadow-[0_0_30px_rgba(255,215,0,0.2)] animate-in fade-in">
                <span className="absolute -top-5 rounded-full bg-[var(--candy-gold)] text-[oklch(0.18_0.03_285)] font-display text-xs font-black px-3 py-1 shadow-lg flex items-center gap-1">
                  <Crown className="size-3.5" /> 1° Oro
                </span>
                <div className="size-16 sm:size-20 rounded-full bg-[var(--candy-gold)]/20 text-4xl flex items-center justify-center border-2 border-[var(--candy-gold)] shadow-[0_0_15px_rgba(255,215,0,0.4)] mt-2 overflow-hidden">
                  {renderAvatar(leaderboard[0].avatar)}
                </div>
                <h4 className="font-display text-sm sm:text-base font-black text-white mt-2 truncate w-full flex items-center justify-center gap-1.5">
                  {leaderboard[0].name}
                  {leaderboard[0].isCurrentUser && (
                    <span className="rounded-full bg-[var(--candy-gold)]/20 text-[9px] font-black uppercase text-[var(--candy-gold)] px-1.5 py-0.2">Tú</span>
                  )}
                </h4>
                <span className="font-display text-sm font-black text-[var(--candy-gold)] mt-1 flex items-center gap-1">
                  <Trophy className="size-3.5" /> {leaderboard[0].trophies.toLocaleString()} Copas
                </span>
                <span className="text-[10px] font-bold text-emerald-400 mt-0.5">
                  {leaderboard[0].league}
                </span>
              </div>
            ) : (
              <div className="glass flex flex-col items-center p-4 sm:p-6 rounded-3xl border border-dashed border-[var(--candy-gold)]/30 bg-[oklch(1_0_0/0.02)] text-center relative order-2 opacity-60">
                <span className="absolute -top-4 rounded-full bg-[var(--candy-gold)]/30 text-[var(--candy-gold)] font-display text-[10px] font-bold px-2 py-0.5">
                  1° Oro
                </span>
                <div className="size-16 sm:size-20 rounded-full bg-[var(--candy-gold)]/10 text-3xl flex items-center justify-center border border-dashed border-[var(--candy-gold)]/30 text-muted-foreground mt-2">
                  👑
                </div>
                <h4 className="font-display text-xs font-bold text-muted-foreground mt-2">
                  Esperando retador
                </h4>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Vacante
                </span>
              </div>
            )}

            {/* Top 3 (Bronce) */}
            {leaderboard[2] ? (
              <div className="glass flex flex-col items-center p-3 sm:p-5 rounded-3xl border border-amber-700/40 bg-[linear-gradient(180deg,rgba(180,83,9,0.15),transparent)] text-center relative order-3 animate-in fade-in">
                <span className="absolute -top-4 rounded-full bg-amber-600 text-white font-display text-xs font-black px-2.5 py-0.5 shadow-md">
                  3° Bronce
                </span>
                <div className="size-14 sm:size-16 rounded-full bg-amber-700/20 text-3xl flex items-center justify-center border-2 border-amber-600 shadow-lg mt-2 overflow-hidden">
                  {renderAvatar(leaderboard[2].avatar)}
                </div>
                <h4 className="font-display text-xs sm:text-sm font-extrabold text-white mt-2 truncate w-full flex items-center justify-center gap-1">
                  {leaderboard[2].name}
                  {leaderboard[2].isCurrentUser && (
                    <span className="rounded-full bg-[var(--candy-gold)]/20 text-[9px] font-black uppercase text-[var(--candy-gold)] px-1.5 py-0.2">Tú</span>
                  )}
                </h4>
                <span className="font-display text-xs font-bold text-[var(--candy-gold)] mt-1 flex items-center gap-1">
                  <Trophy className="size-3" /> {leaderboard[2].trophies.toLocaleString()} Copas
                </span>
              </div>
            ) : (
              <div className="glass flex flex-col items-center p-3 sm:p-5 rounded-3xl border border-dashed border-amber-700/25 bg-[oklch(1_0_0/0.02)] text-center relative order-3 opacity-60">
                <span className="absolute -top-4 rounded-full bg-amber-700/30 text-amber-300 font-display text-[10px] font-bold px-2 py-0.5">
                  3° Bronce
                </span>
                <div className="size-14 sm:size-16 rounded-full bg-amber-700/10 text-2xl flex items-center justify-center border border-dashed border-amber-600/30 text-muted-foreground mt-2">
                  🥉
                </div>
                <h4 className="font-display text-xs font-bold text-muted-foreground mt-2">
                  Esperando retador
                </h4>
                <span className="text-[10px] text-muted-foreground/60 mt-0.5">
                  Vacante
                </span>
              </div>
            )}
          </div>

          {/* LISTA DEL RESTO DEL RANKING (4° en adelante) */}
          <div className="flex flex-col gap-2">
            {leaderboard.length > 3 ? (
              leaderboard.slice(3).map((player) => (
                <div
                  key={player.uid || player.rank}
                  className={cn(
                    "glass flex items-center justify-between p-3.5 sm:p-4 rounded-2xl border transition-all",
                    player.isCurrentUser
                      ? "border-[var(--candy-gold)]/60 bg-[oklch(1_0_0/0.06)] shadow-[0_0_15px_rgba(255,215,0,0.15)] ring-1 ring-[var(--candy-gold)]/40"
                      : "border-border/80 bg-[oklch(1_0_0/0.02)] hover:border-[var(--candy-orange)]/40"
                  )}
                >
                  <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <span className={cn(
                      "font-display text-sm sm:text-base font-black w-6 text-center",
                      player.isCurrentUser ? "text-[var(--candy-gold)]" : "text-muted-foreground"
                    )}>
                      #{player.rank}
                    </span>

                    <div 
                      className="size-10 rounded-xl flex items-center justify-center text-xl border border-white/10 shrink-0 overflow-hidden"
                      style={{ backgroundColor: `${player.avatarColor}20` }}
                    >
                      {renderAvatar(player.avatar)}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-display text-xs sm:text-sm font-extrabold text-foreground truncate flex items-center gap-1.5">
                        {player.name}
                        {player.isCurrentUser && (
                          <span className="rounded-full bg-[var(--candy-gold)]/20 text-[9px] font-black uppercase text-[var(--candy-gold)] px-1.5 py-0.2">Tú</span>
                        )}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {player.league} • Victorias: {player.totalWins} ({player.winRate})
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 font-display text-xs sm:text-sm font-black text-[var(--candy-gold)]">
                    <Trophy className="size-3.5" />
                    <span>{player.trophies.toLocaleString()} Copas</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="glass rounded-2xl p-6 border border-border/40 text-center flex flex-col items-center gap-2 bg-[oklch(1_0_0/0.01)] mt-2">
                <Sparkles className="size-6 text-[var(--candy-gold)] animate-pulse" />
                <h4 className="font-display text-sm font-bold text-foreground">
                  ¡Compite en partidas para clasificar en el Top Global!
                </h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Gana partidas en Modo Competitivo y acumula Copas para subir de liga y asegurar tu puesto en el podio.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DETALLES DEL TORNEO */}
      {selectedTournament && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[3px] animate-in fade-in">
          <div className="glass max-w-md w-full rounded-3xl p-6 border border-[var(--candy-orange)] shadow-2xl flex flex-col gap-4 text-center bg-[oklch(0.14_0.03_285/0.97)] backdrop-blur-xl">
            <div className="size-16 rounded-full bg-[var(--candy-orange)]/20 text-4xl flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(255,119,34,0.3)]">
              🏆
            </div>

            <h3 className="font-display text-xl font-black text-white">
              {selectedTournament.title}
            </h3>

            <p className="text-xs text-muted-foreground">
              {selectedTournament.subtitle}
            </p>

            <div className="flex flex-col gap-2 bg-black/30 rounded-2xl p-4 border border-white/10 text-xs text-left">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reglas:</span>
                <span className="font-bold text-white">{selectedTournament.rules}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Costo de Entrada:</span>
                <span className="font-bold text-[var(--candy-gold)]">{selectedTournament.entryFeeSC} Sugar Coins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tu Saldo:</span>
                <span className="font-bold text-emerald-400">{coins} SC</span>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setSelectedTournament(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all"
              >
                Cerrar
              </button>
              <button
                onClick={() => {
                  showToast(`🏆 ¡Inscrito con éxito en ${selectedTournament.title}!`)
                  setSelectedTournament(null)
                }}
                className="btn-3d flex-1 py-3 rounded-xl bg-[linear-gradient(145deg,var(--candy-orange),oklch(0.65_0.20_45))] font-display text-xs font-black text-white shadow-lg"
              >
                Inscribirme Ahora
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
