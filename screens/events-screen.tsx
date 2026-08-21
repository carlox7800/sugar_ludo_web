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
import { 
  Tournament, 
  fetchActiveTournaments, 
  registerUserInTournament 
} from '@/lib/tournaments-service'

function renderAvatar(avatar?: string, className = "size-full object-cover rounded-full") {
  if (!avatar) return '🎲'
  if (avatar.startsWith('http') || avatar.startsWith('data:')) {
    return <img src={avatar} alt="Avatar" className={className} />
  }
  const preset = PRESET_AVATARS.find(a => a.id === avatar)
  if (preset) return preset.emoji
  return avatar
}

export function EventsScreen({ onBack }: { onBack: () => void }) {
  const { user, deductCoins } = useAuth()
  const { coins, setCoins } = usePlayer()

  const [activeTab, setActiveTab] = useState<'missions' | 'tournaments' | 'leaderboard'>('missions')
  const [missionFilter, setMissionFilter] = useState<'all' | 'daily' | 'weekly'>('all')
  const [missions, setMissions] = useState<Mission[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [registeredTournaments, setRegisteredTournaments] = useState<string[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([])
  const [myRank, setMyRank] = useState<number>(1)
  const [resetTimes, setResetTimes] = useState(getMissionResetTimes())
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Load real missions, tournaments & leaderboard
  useEffect(() => {
    fetchUserMissions(user?.uid, user).then(setMissions).catch(() => {})
    fetchActiveTournaments().then(setTournaments).catch(() => {})
    
    // Check registered tournaments
    if ((user as any)?.registeredTournaments) {
      setRegisteredTournaments((user as any).registeredTournaments)
    } else if (typeof window !== 'undefined') {
      const key = 'sugar_registered_tournaments_' + (user?.uid || 'local')
      const stored = localStorage.getItem(key)
      if (stored) {
        try { setRegisteredTournaments(JSON.parse(stored)) } catch {}
      }
    }

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

  const handleRegisterTournament = async (tour: Tournament) => {
    const res = await registerUserInTournament(user?.uid, tour, coins, deductCoins)
    if (res.success) {
      setCoins(coins - tour.entryFeeSC)
      setRegisteredTournaments(prev => [...prev, tour.id])
      setTournaments(prev => prev.map(t => t.id === tour.id ? { ...t, playersRegistered: t.playersRegistered + 1 } : t))
      showToast(res.message)
      confetti({
        particleCount: 90,
        spread: 60,
        origin: { y: 0.6 }
      })
      setSelectedTournament(null)
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
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Temporada 1</span>
              <span className="font-display text-xs font-black text-foreground">{resetTimes.weeklyFormatted}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[oklch(1_0_0/0.03)] p-1.5 border border-border/80">
        <button
          onClick={() => setActiveTab('missions')}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 rounded-xl font-display text-xs sm:text-sm font-bold transition-all relative",
            activeTab === 'missions'
              ? "bg-[var(--candy-orange)] text-[oklch(0.2_0.05_40)] shadow-md"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Target className="size-4" />
          <span>Misiones</span>
          {claimableCount > 0 && (
            <span className="size-2 rounded-full bg-red-500 animate-pulse" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('tournaments')}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 rounded-xl font-display text-xs sm:text-sm font-bold transition-all",
            activeTab === 'tournaments'
              ? "bg-[var(--candy-magenta)] text-white shadow-md"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Trophy className="size-4" />
          <span>Torneos ({tournaments.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('leaderboard')}
          className={cn(
            "flex items-center justify-center gap-2 py-2.5 rounded-xl font-display text-xs sm:text-sm font-bold transition-all",
            activeTab === 'leaderboard'
              ? "bg-[var(--candy-cyan)] text-[oklch(0.18_0.03_285)] shadow-md"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Crown className="size-4" />
          <span>Ranking Global</span>
        </button>
      </div>

      {/* TAB 1: MISIONES DIARIAS Y SEMANALES */}
      {activeTab === 'missions' && (
        <div className="flex flex-col gap-4 animate-in fade-in">
          {/* Sub-filtros de Misiones */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {(['all', 'daily', 'weekly'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setMissionFilter(filter)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-xl text-xs font-bold font-display uppercase tracking-wider transition-all",
                    missionFilter === filter
                      ? "bg-white/15 text-white border border-white/20"
                      : "text-muted-foreground hover:text-white bg-transparent"
                  )}
                >
                  {filter === 'all' ? 'Todas' : filter === 'daily' ? 'Diarias' : 'Semanales'}
                </button>
              ))}
            </div>

            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
              <Clock className="size-3 text-[var(--candy-orange)]" />
              Reinicio diario en: <strong className="text-foreground">{resetTimes.dailyFormatted}</strong>
            </span>
          </div>

          {/* Lista de Misiones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredMissions.map((mission) => {
              const isCompleted = mission.current >= mission.target
              const progressPct = Math.min(100, Math.round((mission.current / mission.target) * 100))

              return (
                <div
                  key={mission.id}
                  className={cn(
                    "glass relative flex items-center justify-between p-4 rounded-3xl border transition-all shadow-md gap-3",
                    mission.claimed 
                      ? "border-border/60 bg-[oklch(1_0_0/0.02)] opacity-70"
                      : isCompleted
                        ? "border-emerald-500/50 bg-[linear-gradient(135deg,oklch(0.14_0.04_140/0.4),oklch(0.12_0.02_285/0.8))]"
                        : "border-border/80 bg-[oklch(1_0_0/0.04)]"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="size-12 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                      {mission.icon}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider bg-white/10 text-white/80">
                          {mission.category === 'daily' ? 'Diaria' : 'Semanal'}
                        </span>
                        <h3 className="font-display text-sm font-extrabold text-foreground truncate">
                          {mission.title}
                        </h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {mission.description}
                      </p>
                      
                      {/* Barra de progreso */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 w-28 rounded-full bg-black/40 overflow-hidden border border-white/10">
                          <div 
                            className="h-full rounded-full bg-[linear-gradient(90deg,var(--candy-orange),var(--candy-gold))]" 
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground font-mono">
                          {mission.current}/{mission.target}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recompensas y Botón */}
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-display text-xs font-black text-[var(--candy-gold)] flex items-center gap-0.5">
                        +{mission.rewardSC} <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" />
                      </span>
                      <span className="text-[10px] font-extrabold text-[var(--candy-cyan)]">
                        +{mission.rewardXP} XP
                      </span>
                    </div>

                    <div>
                      {mission.claimed ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-muted-foreground">
                          <CheckCircle2 className="size-4" /> Reclamado
                        </span>
                      ) : isCompleted ? (
                        <button
                          onClick={() => handleClaimMission(mission.id)}
                          className="btn-3d flex items-center gap-1.5 rounded-xl bg-[linear-gradient(145deg,#10b981,#059669)] px-4 py-2 font-display text-xs font-black text-white shadow-lg hover:scale-105 transition-all cursor-pointer"
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
            {tournaments.map((tour) => {
              const isRegistered = registeredTournaments.includes(tour.id) || (user as any)?.registeredTournaments?.includes(tour.id)

              return (
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
                      <div className="flex items-center gap-2">
                        {isRegistered && (
                          <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 text-[10px] font-black text-emerald-400">
                            <CheckCircle2 className="size-3" /> Inscrito
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs font-bold text-white/80">
                          <Clock className="size-3.5" /> {tour.endDate}
                        </span>
                      </div>
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
                      className={cn(
                        "btn-3d w-full flex items-center justify-center gap-2 rounded-2xl py-3 font-display text-sm font-black transition-all cursor-pointer shadow-lg",
                        isRegistered
                          ? "bg-white/15 text-white border border-white/20 hover:bg-white/25"
                          : "bg-[linear-gradient(145deg,var(--candy-orange),oklch(0.65_0.20_45))] text-white hover:scale-[1.02]"
                      )}
                    >
                      <Trophy className="size-4" />
                      <span>{isRegistered ? 'Ver Detalles (Inscrito)' : 'Ver Detalles & Inscribirse'}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 3: CLASIFICACIÓN (LEADERBOARD) */}
      {activeTab === 'leaderboard' && (
        <div className="flex flex-col gap-6 animate-in fade-in">
          {/* Tarjeta de Posición del Jugador */}
          {(() => {
            const myUser = leaderboard.find(u => u.isCurrentUser) || {
              rank: myRank,
              name: user?.nickname || 'Tú',
              avatar: user?.photoURL || '🎲',
              avatarColor: '#facc15',
              trophies: Number((user as any)?.rankPoints !== undefined ? (user as any).rankPoints : (((user as any)?.totalWins || 0) * 25)),
              level: Number(user?.level || 1),
              totalWins: Number(user?.totalWins || 0),
              winRate: '0%',
              league: 'Bronce'
            }

            return (
              <div className="glass flex flex-col sm:flex-row items-center justify-between p-5 rounded-3xl border-2 border-[var(--candy-gold)] bg-[linear-gradient(135deg,oklch(0.14_0.04_50/0.6),oklch(0.12_0.02_285/0.9))] shadow-2xl gap-4">
                <div className="flex items-center gap-4">
                  <div className="size-12 rounded-2xl bg-[var(--candy-gold)] text-[oklch(0.2_0.08_60)] flex items-center justify-center font-display text-xl font-black shadow-lg">
                    #{myRank}
                  </div>

                  <div className="size-14 rounded-full border-2 border-[var(--candy-gold)] overflow-hidden bg-black/60 flex items-center justify-center text-3xl shadow-md">
                    {renderAvatar(myUser.avatar)}
                  </div>

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-lg font-black text-white">
                        {myUser.name}
                      </h3>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[var(--candy-gold)]/20 text-[var(--candy-gold)] border border-[var(--candy-gold)]/30">
                        {myUser.league}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Nivel {myUser.level} • {myUser.totalWins} Victorias
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="flex flex-col items-center sm:items-end">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase">Copas de Rango</span>
                    <span className="font-display text-2xl font-black text-[var(--candy-gold)] flex items-center gap-1 drop-shadow-md">
                      {myUser.trophies.toLocaleString()} 🏆
                    </span>
                  </div>
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
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer"
              >
                Cerrar
              </button>
              {registeredTournaments.includes(selectedTournament.id) || (user as any)?.registeredTournaments?.includes(selectedTournament.id) ? (
                <button
                  disabled
                  className="flex-1 py-3 rounded-xl bg-white/10 text-emerald-400 font-display text-xs font-black cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="size-4" /> Ya Estás Inscrito
                </button>
              ) : (
                <button
                  onClick={() => handleRegisterTournament(selectedTournament)}
                  className="btn-3d flex-1 py-3 rounded-xl bg-[linear-gradient(145deg,var(--candy-orange),oklch(0.65_0.20_45))] font-display text-xs font-black text-white shadow-lg hover:scale-105 transition-all cursor-pointer"
                >
                  Inscribirme ({selectedTournament.entryFeeSC} SC)
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
