'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Volume2, VolumeX, Zap, Key, Check, Sparkles, Loader2, Wifi, WifiOff, BookOpen, Trophy } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSocket } from '@/lib/useSocket'
import { useAuth } from '@/lib/auth-context'
import { GameGuideModal } from '@/components/game-guide-modal'

const PLAYER_OPTIONS = [2, 3, 4, 5, 6]

export const ECONOMY_MATRIX: Record<number, { entry: number; pot: number; prizes: number[] }> = {
  2: { entry: 100, pot: 200, prizes: [150] },
  3: { entry: 120, pot: 360, prizes: [200, 80] },
  4: { entry: 150, pot: 600, prizes: [300, 150] },
  5: { entry: 200, pot: 1000, prizes: [400, 200, 100] },
  6: { entry: 300, pot: 1800, prizes: [500, 250, 100] },
}

export function CompetitiveTraining({ 
  onBack, 
  onMatchFound 
}: { 
  onBack: () => void
  onMatchFound?: (gameData: any) => void 
}) {
  const { connect, status, getSocketInstance } = useSocket()
  const { user, deductCoins } = useAuth()

  // Tabs: 'quick' | 'friends'
  const [mainTab, setMainTab] = useState<'quick' | 'friends'>('quick')

  // Player counts
  const [quickPlayers, setQuickPlayers] = useState(4)
  const quickPlayersRef = useRef(quickPlayers)
  useEffect(() => {
    quickPlayersRef.current = quickPlayers
  }, [quickPlayers])

  // UI state
  const [muted, setMuted] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Dev Sandbox State (Only keeping the ref since competitive shouldn't really have sandbox, but for parity)
  const isDevSandboxRef = useRef(false)

  // Auto-connect socket when opening
  useEffect(() => {
    const socket = connect()

    // Register identity
    const playerId = user?.uid || `guest_${Math.floor(Math.random() * 100000)}`
    socket.emit('register_identity', { playerId })

    const handleRoomUpdated = (data: { id?: string; players?: any[] }) => {
      if (data.players) {
        showToast(`Jugadores en sala: ${data.players.length}`)
      }
    }

    const handleMatchFound = (gameData: any) => {
      const receivedCount = gameData.players?.length ?? 0
      if (receivedCount < quickPlayersRef.current && !isDevSandboxRef.current) {
        return // Ignore match if it doesn't meet our requested player count
      }
      setIsSearching(false)
      showToast('¡Partida encontrada! Entrando a la mesa...')
      
      const finalPlayers = [...(gameData.players || [])]

      const enrichedGameData = {
        ...gameData,
        players: finalPlayers,
        roomId: gameData.roomId || gameData.id,
        myPlayerId: user?.uid || socket.id || playerId,
      }

      setTimeout(() => {
        onMatchFound?.(enrichedGameData)
      }, 800)
    }

    const handleRoomError = (data: { message: string }) => {
      setIsSearching(false)
      setErrorMsg(`⚠️ ${data.message || 'Error en la sala'}`)
    }

    socket.on('room_updated', handleRoomUpdated)
    socket.on('match_found', handleMatchFound)
    socket.on('room_error', handleRoomError)

    return () => {
      socket.off('room_updated', handleRoomUpdated)
      socket.off('match_found', handleMatchFound)
      socket.off('room_error', handleRoomError)
    }
  }, [connect, onMatchFound, user])

  const showToast = (msg: string) => {
    setNotification(msg)
    setErrorMsg(null)
    setTimeout(() => setNotification(null), 3500)
  }

  const handleStartQuickMatch = async () => {
    const entryFee = ECONOMY_MATRIX[quickPlayers].entry
    if ((user?.coins ?? 200) < entryFee) {
      setErrorMsg(`¡Saldo insuficiente! Necesitas ${entryFee} Sugar Coins para entrar a esta partida.`)
      return
    }
    
    // Deduct coins as it is competitive
    const success = await deductCoins(entryFee)
    if (!success) {
      setErrorMsg(`¡Error al procesar el cobro de la entrada!`)
      return
    }

    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id || `guest_${Math.floor(Math.random() * 10000)}`
    const playerName = user?.nickname || user?.displayName || 'Jugador'

    setIsSearching(true)
    setErrorMsg(null)
    showToast(`Cobro exitoso (-${entryFee} Sugar Coins). Buscando partida para ${quickPlayers} jugadores...`)

    socket.emit('join_matchmaking', {
      playerId,
      playerName: user?.photoURL ? `${playerName}|||${user.photoURL}` : playerName,
      targetPlayers: quickPlayers,
      mode: 'competitive',
    })
  }

  const handleCancelQuickMatch = () => {
    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id
    setIsSearching(false)
    socket.emit('leave_matchmaking', { playerId })
    // No automatic refund here, depends on server logic if matchmaking is cancelled, 
    // but for this MVP, we assume they lose it or server refunds.
    showToast('Búsqueda cancelada.')
  }

  const currentEconomy = ECONOMY_MATRIX[quickPlayers]

  return (
    <section className="flex flex-col gap-3 md:gap-4 animate-slide-in">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="glass glass-hover flex items-center gap-3 rounded-2xl py-2 pl-2.5 pr-5"
          aria-label="Volver al menú principal"
        >
          <span className="btn-3d flex size-10 items-center justify-center rounded-xl bg-[var(--candy-gold)] shadow-[0_4px_0_oklch(0.55_0.16_50)]">
            <ArrowLeft className="size-5 text-[oklch(0.18_0.03_285)]" strokeWidth={2.6} />
          </span>
          <span className="font-display text-base font-extrabold uppercase tracking-wide text-foreground sm:text-lg">
            Modo Competitivo
          </span>
        </button>

        <div className="flex items-center gap-2">
          {/* Socket Connection Badge */}
          <div className={`flex items-center gap-1.5 rounded-2xl px-3 py-1.5 border font-display text-xs font-bold ${
            status === 'connected' 
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
              : status === 'connecting' || status === 'reconnecting'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}>
            {status === 'connected' ? (
              <Wifi className="size-3.5" />
            ) : status === 'connecting' || status === 'reconnecting' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <WifiOff className="size-3.5" />
            )}
            <span className="capitalize">{status === 'connected' ? 'En Línea' : status === 'connecting' ? 'Conectando...' : 'Desconectado'}</span>
          </div>

          <button
            onClick={() => setMuted((m) => !m)}
            aria-label={muted ? 'Activar sonido' : 'Silenciar'}
            aria-pressed={muted}
            className="glass glass-hover flex size-10 shrink-0 items-center justify-center rounded-2xl text-[var(--candy-gold)]"
          >
            {muted ? <VolumeX className="size-5" strokeWidth={2.4} /> : <Volume2 className="size-5" strokeWidth={2.4} />}
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <article className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-[var(--candy-gold)]/20 shadow-[0_0_40px_var(--candy-gold)]/10">
        {/* Glow Background Elements */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-60 rounded-full bg-[var(--candy-gold)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 size-60 rounded-full bg-[var(--candy-orange)]/15 blur-3xl" />

        <div className="relative flex flex-col gap-4">
          {/* Header Title */}
          <header className="text-center">
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-[var(--candy-gold)] drop-shadow-[0_0_12px_var(--candy-gold)] sm:text-5xl">
              COMPETITIVO
            </h2>
            <p className="mt-1 font-display text-xs sm:text-sm font-bold uppercase tracking-[0.2em] text-[var(--candy-orange)] flex items-center justify-center gap-1.5">
              Compite en salas exclusivas y gana Sugar Coins <img src="/sugar-coin.png" alt="Coin" className="size-4 inline-block object-contain" />
            </p>
          </header>

          {/* Toast Notification */}
          {notification && (
            <div className="animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2 rounded-2xl border border-[var(--candy-gold)]/40 bg-[var(--candy-gold)]/15 p-3.5 text-[var(--candy-gold)] font-display text-sm font-bold shadow-lg">
              <Sparkles className="size-4" />
              <span>{notification}</span>
            </div>
          )}

          {/* Error Notification */}
          {errorMsg && (
            <div className="animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/15 p-3.5 text-red-400 font-display text-sm font-bold shadow-lg">
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Pestañas Superiores principales */}
          <div className="flex rounded-2xl bg-[oklch(1_0_0/0.03)] p-1.5 border border-border/60">
            <button
              onClick={() => {
                setMainTab('quick')
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm sm:text-base font-extrabold transition-all ${
                mainTab === 'quick'
                  ? 'bg-[linear-gradient(145deg,var(--candy-gold),oklch(0.7_0.18_55))] text-[oklch(0.18_0.03_285)] shadow-[0_4px_12px_oklch(0.78_0.18_55/0.4)]'
                  : 'text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground'
              }`}
            >
              <Zap className="size-5 fill-current" />
              Partida Rápida ⚡
            </button>
            
            <button
              disabled
              className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm sm:text-base font-extrabold transition-all text-muted-foreground/50 opacity-60 relative overflow-hidden"
            >
              <Key className="size-5" />
              Batalla Amigos 🔑
              <span className="absolute right-2 top-2 rounded bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 text-[10px] uppercase font-black tracking-wider shadow-[0_0_8px_red]">
                PRÓX.
              </span>
            </button>
          </div>

          {/* TAB 1: PARTIDA RÁPIDA ⚡ */}
          {mainTab === 'quick' && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground">
                  <span className="h-5 w-1.5 rounded-full bg-[var(--candy-gold)] shadow-[0_0_12px_var(--candy-gold)]" />
                  Selector de Jugadores
                </legend>
                
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {PLAYER_OPTIONS.map((count) => (
                    <PillButton
                      key={count}
                      selected={quickPlayers === count}
                      onClick={() => setQuickPlayers(count)}
                      accent="var(--candy-gold)"
                      shadow="oklch(0.6 0.15 50)"
                    >
                      {count} Jug
                    </PillButton>
                  ))}
                </div>
              </fieldset>

              {/* Economy Info Panel */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 bg-[oklch(0_0_0/0.2)] border border-[var(--candy-gold)]/30 rounded-2xl p-3">
                <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-[oklch(1_0_0/0.05)]">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Entrada</span>
                  <span className="font-display text-lg font-black text-red-400 drop-shadow-[0_0_8px_red] flex items-center gap-1">-{currentEconomy.entry} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" /></span>
                </div>
                <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-[oklch(1_0_0/0.05)]">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pozo Total</span>
                  <span className="font-display text-lg font-black text-[var(--candy-gold)] flex items-center gap-1">{currentEconomy.pot} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" /></span>
                </div>
                <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-[oklch(1_0_0/0.05)] col-span-2 sm:col-span-2">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Premios</span>
                  <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
                    {currentEconomy.prizes.filter(prize => prize > 0).map((prize, idx) => (
                      <span key={idx} className={cn("font-display text-sm font-black flex items-center gap-1", idx === 0 ? 'text-emerald-400' : 'text-emerald-400/70')}>
                        {idx + 1}º: +{prize} <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" />
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {!isSearching ? (
                <button
                  onClick={handleStartQuickMatch}
                  className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.85_0.16_90),oklch(0.78_0.18_55))] py-3 font-display text-lg font-extrabold uppercase tracking-wide text-[oklch(0.25_0.08_60)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.6_0.15_50),0_14px_26px_oklch(0.6_0.15_50/0.55)]"
                >
                  <Trophy className="size-6" />
                  ¡COMENZAR PARTIDA! ✨
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    disabled
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--candy-gold)]/20 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-[var(--candy-gold)] border border-[var(--candy-gold)]/40"
                  >
                    <Loader2 className="size-6 animate-spin" />
                    Buscando Contendientes...
                  </button>
                  <button
                    onClick={handleCancelQuickMatch}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground text-center"
                  >
                    Cancelar búsqueda
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="-mt-2">
            <button 
              onClick={() => setIsGuideOpen(true)}
              className="btn-3d flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-[oklch(1_0_0/0.06)] py-2.5 font-display text-base font-bold text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.15)] hover:bg-[oklch(1_0_0/0.1)] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <BookOpen className="size-5 text-[var(--candy-gold)]" strokeWidth={2.4} />
              Guía rápida
            </button>
          </div>

        </div>
      </article>

      <GameGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </section>
  )
}

function PillButton({
  children,
  selected,
  onClick,
  accent,
  shadow,
  disabled = false,
}: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
  accent: string
  shadow: string
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'btn-3d rounded-2xl py-2 font-display text-base font-extrabold transition-colors',
        selected
          ? 'text-[oklch(0.16_0.03_285)]'
          : 'border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground',
        disabled && 'opacity-50 cursor-not-allowed'
      )}
      style={
        selected
          ? {
              background: `linear-gradient(145deg, ${accent}, color-mix(in oklch, ${accent}, black 12%))`,
              boxShadow: `inset 0 2px 0 oklch(1 0 0 / 0.45), 0 5px 0 ${shadow}, 0 10px 20px color-mix(in oklch, ${shadow}, transparent 45%)`,
            }
          : undefined
      }
    >
      {children}
    </button>
  )
}
