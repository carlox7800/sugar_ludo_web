'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Volume2, VolumeX, Zap, Key, PlusCircle, LogIn, Copy, Check, Sparkles, Loader2, Wifi, WifiOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSocket } from '@/lib/useSocket'
import { useAuth } from '@/lib/auth-context'

const PLAYER_OPTIONS = [2, 3, 4, 5, 6]

export function OnlineTraining({ 
  onBack, 
  onMatchFound 
}: { 
  onBack: () => void
  onMatchFound?: (gameData: any) => void 
}) {
  const { connect, status, getSocketInstance } = useSocket()
  const { user } = useAuth()

  // Tabs: 'quick' | 'friends'
  const [mainTab, setMainTab] = useState<'quick' | 'friends'>('quick')

  // Sub-tabs for Batalla Amigos: 'create' | 'join'
  const [friendsSubTab, setFriendsSubTab] = useState<'create' | 'join'>('create')

  // Player counts
  const [quickPlayers, setQuickPlayers] = useState(4)
  const quickPlayersRef = useRef(quickPlayers)
  useEffect(() => {
    quickPlayersRef.current = quickPlayers
  }, [quickPlayers])
  const [createPlayers, setCreatePlayers] = useState(4)

  // Join Room State
  const [roomCode, setRoomCode] = useState('')

  // UI state
  const [muted, setMuted] = useState(false)
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  // Dev Sandbox State
  const [isDevSandbox, setIsDevSandbox] = useState(false)
  const isDevSandboxRef = useRef(false)
  useEffect(() => {
    isDevSandboxRef.current = isDevSandbox
  }, [isDevSandbox])


  // Auto-connect socket when opening Online Training
  useEffect(() => {
    const socket = connect()

    // Register identity
    const playerId = user?.uid || `guest_${Math.floor(Math.random() * 100000)}`
    socket.emit('register_identity', { playerId })

    const handlePrivateRoomCreated = (data: { roomCode?: string; id?: string }) => {
      const code = data.roomCode || data.id || ''
      setCreatedRoomCode(code)
      showToast(`¡Sala ${code} creada con éxito!`)
    }

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
      
      let finalPlayers = [...(gameData.players || [])]

      // DEV SANDBOX INJECTION
      if (isDevSandboxRef.current && finalPlayers.length >= 2) {
        // Ensure there are 6 players by injecting bots
        const botsNeeded = 6 - finalPlayers.length
        for (let i = 0; i < botsNeeded; i++) {
          finalPlayers.push({
            playerId: `dev_bot_${i}`,
            playerName: `Bot ${i + 1}`,
            isBot: true,
            isConnected: true
          })
        }
      }

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
      showToast(`⚠️ ${data.message || 'Error en la sala'}`)
    }

    socket.on('private_room_created', handlePrivateRoomCreated)
    socket.on('room_updated', handleRoomUpdated)
    socket.on('match_found', handleMatchFound)
    socket.on('room_error', handleRoomError)

    return () => {
      socket.off('private_room_created', handlePrivateRoomCreated)
      socket.off('room_updated', handleRoomUpdated)
      socket.off('match_found', handleMatchFound)
      socket.off('room_error', handleRoomError)
    }
  }, [connect, onMatchFound, user])

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3500)
  }

  const handleStartQuickMatch = () => {
    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id || `guest_${Math.floor(Math.random() * 10000)}`
    const playerName = user?.nickname || user?.displayName || 'Jugador'

    setIsSearching(true)
    showToast(`Buscando partida rápida para ${quickPlayers} jugadores...`)

    socket.emit('join_matchmaking', {
      playerId,
      playerName,
      targetPlayers: quickPlayers,
      mode: 'online_training',
    })
  }

  const handleCancelQuickMatch = () => {
    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id
    setIsSearching(false)
    socket.emit('leave_matchmaking', { playerId })
    showToast('Búsqueda cancelada.')
  }

  const handleCreateRoom = () => {
    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id || `guest_${Math.floor(Math.random() * 10000)}`
    const playerName = user?.nickname || user?.displayName || 'Jugador'

    showToast(isDevSandbox ? 'Creando sala Dev Sandbox...' : 'Creando sala privada en el servidor...')
    socket.emit('create_private_room', {
      playerId,
      playerName,
      targetPlayers: isDevSandbox ? 2 : createPlayers, // Force 2 real players for sandbox
    })
  }

  const handleCopyCode = () => {
    if (createdRoomCode) {
      navigator.clipboard.writeText(createdRoomCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomCode.trim()) return

    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id || `guest_${Math.floor(Math.random() * 10000)}`
    const playerName = user?.nickname || user?.displayName || 'Jugador'
    const code = roomCode.trim()
    
    isDevSandboxRef.current = isDevSandbox

    showToast(`Uniéndose a la sala ${code}...`)
    socket.emit('join_private_room', {
      playerId,
      playerName,
      targetPlayers: isDevSandbox ? 2 : createPlayers,
      roomCode: code,
      code: code,
    })
  }

  return (
    <section className="flex flex-col gap-5 md:gap-6 animate-slide-in">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="glass glass-hover flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-5"
          aria-label="Volver al menú principal"
        >
          <span className="btn-3d flex size-10 items-center justify-center rounded-xl bg-[var(--candy-cyan)] shadow-[0_4px_0_oklch(0.5_0.12_210)]">
            <ArrowLeft className="size-5 text-[oklch(0.18_0.03_285)]" strokeWidth={2.6} />
          </span>
          <span className="font-display text-base font-extrabold uppercase tracking-wide text-foreground sm:text-lg">
            Entrenamiento Online
          </span>
        </button>

        <div className="flex items-center gap-2">
          {/* Socket Connection Badge */}
          <div className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 border font-display text-xs font-bold ${
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
            className="glass glass-hover flex size-12 shrink-0 items-center justify-center rounded-2xl text-[var(--candy-cyan)]"
          >
            {muted ? <VolumeX className="size-5" strokeWidth={2.4} /> : <Volume2 className="size-5" strokeWidth={2.4} />}
          </button>
        </div>
      </div>

      {/* Main Container Card */}
      <article className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        {/* Glow Background Elements */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-60 rounded-full bg-[oklch(0.82_0.15_200/0.25)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 size-60 rounded-full bg-[oklch(0.7_0.27_350/0.25)] blur-3xl" />

        <div className="relative flex flex-col gap-6">
          {/* Header Title */}
          <header className="text-center">
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-[var(--candy-cyan)] neon-cyan sm:text-5xl">
              ENTRENAMIENTO ONLINE
            </h2>
            <p className="mt-1 font-display text-sm font-bold uppercase tracking-[0.25em] text-[var(--candy-magenta)] neon-magenta">
              Compite en Vivo con Jugadores
            </p>
          </header>

          {/* Toast Notification */}
          {notification && (
            <div className="animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2 rounded-2xl border border-[var(--candy-cyan)]/40 bg-[var(--candy-cyan)]/15 p-3.5 text-[var(--candy-cyan)] font-display text-sm font-bold shadow-lg">
              <Sparkles className="size-4" />
              <span>{notification}</span>
            </div>
          )}

          {/* Pestañas Superiores principales */}
          <div className="flex rounded-2xl bg-[oklch(1_0_0/0.03)] p-1.5 border border-border/60">
            <button
              onClick={() => {
                setMainTab('quick')
                setCreatedRoomCode(null)
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm sm:text-base font-extrabold transition-all ${
                mainTab === 'quick'
                  ? 'bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.7_0.18_190))] text-[oklch(0.18_0.03_285)] shadow-[0_4px_12px_oklch(0.82_0.15_200/0.4)]'
                  : 'text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground'
              }`}
            >
              <Zap className="size-5 fill-current" />
              Partida Rápida ⚡
            </button>
            
            <button
              onClick={() => {
                setMainTab('friends')
                setCreatedRoomCode(null)
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm sm:text-base font-extrabold transition-all ${
                mainTab === 'friends'
                  ? 'bg-[linear-gradient(145deg,var(--candy-magenta),oklch(0.6_0.25_340))] text-white shadow-[0_4px_12px_oklch(0.7_0.27_350/0.4)]'
                  : 'text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground'
              }`}
            >
              <Key className="size-5" />
              Batalla Amigos 🔑
            </button>
          </div>

          {/* TAB 1: PARTIDA RÁPIDA ⚡ */}
          {mainTab === 'quick' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground">
                  <span className="h-5 w-1.5 rounded-full bg-[var(--candy-cyan)] shadow-[0_0_12px_var(--candy-cyan)]" />
                  Selector de Jugadores
                </legend>
                
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {PLAYER_OPTIONS.map((count) => (
                    <PillButton
                      key={count}
                      selected={quickPlayers === count}
                      onClick={() => setQuickPlayers(count)}
                      accent="var(--candy-cyan)"
                      shadow="oklch(0.5 0.12 210)"
                    >
                      {count} Jug
                    </PillButton>
                  ))}
                </div>
                
                <p className="text-center text-sm leading-relaxed text-muted-foreground mt-1">
                  Emparejamiento automático al instante para mesa de {quickPlayers} jugadores online.
                </p>
              </fieldset>

              {!isSearching ? (
                <button
                  onClick={handleStartQuickMatch}
                  className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.82_0.15_200),oklch(0.7_0.18_190))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-[oklch(0.18_0.03_285)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.5_0.12_210),0_14px_26px_oklch(0.5_0.12_210/0.55)]"
                >
                  ¡COMENZAR PARTIDA! ✨
                </button>
              ) : (
                <div className="flex flex-col gap-3">
                  <button
                    disabled
                    className="flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--candy-cyan)]/20 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-[var(--candy-cyan)] border border-[var(--candy-cyan)]/40"
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

          {/* TAB 2: BATALLA AMIGOS 🔑 */}
          {mainTab === 'friends' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
              {/* Sub-tabs selector: Crear Sala | Unirse */}
              <div className="flex rounded-xl bg-[oklch(0_0_0/0.2)] p-1 border border-border/40 w-full sm:w-80 mx-auto">
                <button
                  onClick={() => {
                    setFriendsSubTab('create')
                    setCreatedRoomCode(null)
                  }}
                  className={`flex-1 py-2 rounded-lg font-display text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    friendsSubTab === 'create'
                      ? 'bg-[var(--candy-magenta)] text-white shadow-md'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <PlusCircle className="size-4" />
                  Crear Sala 🍰
                </button>
                <button
                  onClick={() => {
                    setFriendsSubTab('join')
                    setCreatedRoomCode(null)
                  }}
                  className={`flex-1 py-2 rounded-lg font-display text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    friendsSubTab === 'join'
                      ? 'bg-[var(--candy-gold)] text-[oklch(0.25_0.08_60)] shadow-md'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LogIn className="size-4" />
                  Unirse 🔑
                </button>
              </div>

              {/* Sub-tab A: CREAR SALA 🍰 */}
              {friendsSubTab === 'create' && (
                <div className="flex flex-col gap-6 animate-in fade-in">
                  {!createdRoomCode ? (
                    <>
                      <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground">
                          <span className="h-5 w-1.5 rounded-full bg-[var(--candy-magenta)] shadow-[0_0_12px_var(--candy-magenta)]" />
                          Capacidad de la Sala
                        </legend>
                        
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                          {PLAYER_OPTIONS.map((count) => (
                            <PillButton
                              key={count}
                              selected={createPlayers === count}
                              onClick={() => setCreatePlayers(count)}
                              accent="var(--candy-magenta)"
                              shadow="oklch(0.45 0.2 350)"
                              disabled={isDevSandbox}
                            >
                              {count} Jug
                            </PillButton>
                          ))}
                        </div>

                        <p className="text-center text-sm text-muted-foreground mt-1">
                          {isDevSandbox 
                            ? 'Modo Dev Sandbox activo: La sala iniciará con 2 jugadores reales y el resto serán bots.'
                            : `Crea una sala privada para ${createPlayers} jugadores e invita a tus amigos con un código.`}
                        </p>
                      </fieldset>

                      {/* DEV SANDBOX TOGGLE */}
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--candy-gold)] bg-[var(--candy-gold)]/5 px-4 py-3">
                        <div className="flex flex-col">
                          <span className="font-display text-sm font-bold text-[var(--candy-gold)] flex items-center gap-1">
                            <Sparkles className="size-4" /> Dev Sandbox
                          </span>
                          <span className="text-xs text-muted-foreground">Forzar tablero hexagonal (6 jug) con 2 dispositivos reales</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsDevSandbox(!isDevSandbox)}
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            isDevSandbox ? "bg-[var(--candy-gold)]" : "bg-muted"
                          )}
                        >
                          <span className={cn(
                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                            isDevSandbox ? "translate-x-6" : "translate-x-1"
                          )} />
                        </button>
                      </div>

                      <button
                        onClick={handleCreateRoom}
                        className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.7_0.27_350),oklch(0.6_0.25_340))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-white shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.45_0.2_350),0_14px_26px_oklch(0.45_0.2_350/0.55)]"
                      >
                        <PlusCircle className="size-6" />
                        CREAR SALA 🍰
                      </button>
                    </>
                  ) : (
                    /* Display generated room code */
                    <div className="glass flex flex-col items-center gap-4 rounded-2xl p-6 border border-[var(--candy-magenta)]/30 text-center animate-in zoom-in-95">
                      <span className="font-display text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                        Código de tu Sala Privada
                      </span>
                      
                      {isDevSandbox && (
                        <div className="bg-[var(--candy-gold)]/20 text-[var(--candy-gold)] px-3 py-1 rounded-lg text-xs font-bold mb-2 flex items-center gap-2 border border-[var(--candy-gold)]/50">
                          <Sparkles className="size-3" />
                          Modo Hex Sandbox Activo
                        </div>
                      )}

                      <div className="flex items-center gap-3 rounded-xl bg-[oklch(0_0_0/0.4)] px-6 py-3 border border-[var(--candy-magenta)]">
                        <span className="font-mono text-3xl font-extrabold tracking-widest text-[var(--candy-cyan)]">
                          {createdRoomCode}
                        </span>
                        <button
                          onClick={handleCopyCode}
                          className="flex size-10 items-center justify-center rounded-lg bg-[oklch(1_0_0/0.1)] hover:bg-[oklch(1_0_0/0.2)] transition-colors text-white"
                          title="Copiar código"
                        >
                          {copiedCode ? <Check className="size-5 text-[var(--candy-cyan)]" /> : <Copy className="size-5" />}
                        </button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Comparte este código con tus amigos para que ingresen desde el botón "Unirse 🔑".
                      </p>

                      <button
                        onClick={() => setCreatedRoomCode(null)}
                        className="text-xs text-[var(--candy-cyan)] hover:underline font-bold mt-2"
                      >
                        ← Crear otra sala
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab B: UNIRSE A SALA 🔑 */}
              {friendsSubTab === 'join' && (
                <form onSubmit={handleJoinRoom} className="flex flex-col gap-5 animate-in fade-in">
                  <div className="flex flex-col gap-2">
                    <label className="font-display text-xs font-extrabold uppercase tracking-wider text-muted-foreground text-center">
                      Ingresa el Código de la Sala
                    </label>
                    <input
                      type="text"
                      required
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value)}
                      placeholder="Ej. 123456"
                      className="w-full rounded-2xl border-2 border-[var(--candy-gold)]/40 bg-[oklch(0_0_0/0.3)] px-6 py-4 font-mono text-2xl font-extrabold text-center tracking-widest text-[var(--candy-gold)] outline-none transition-colors focus:border-[var(--candy-gold)] focus:bg-[oklch(0_0_0/0.5)] placeholder:text-muted-foreground/30 uppercase"
                    />
                  </div>

                  {/* DEV SANDBOX TOGGLE IN JOIN */}
                  <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-[var(--candy-gold)] bg-[var(--candy-gold)]/5 px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-display text-sm font-bold text-[var(--candy-gold)] flex items-center gap-1">
                        <Sparkles className="size-4" /> Dev Sandbox
                      </span>
                      <span className="text-xs text-muted-foreground">Únete a una sala Hex (6 jug) forzada</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsDevSandbox(!isDevSandbox)}
                      className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                        isDevSandbox ? "bg-[var(--candy-gold)]" : "bg-muted"
                      )}
                    >
                      <span className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        isDevSandbox ? "translate-x-6" : "translate-x-1"
                      )} />
                    </button>
                  </div>

                  <button
                    type="submit"
                    className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.85_0.16_90),oklch(0.78_0.18_55))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-[oklch(0.25_0.08_60)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.6_0.15_50),0_14px_26px_oklch(0.6_0.15_50/0.55)]"
                  >
                    <LogIn className="size-6" />
                    UNIRSE A SALA 🔑
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </article>
    </section>
  )
}

function PillButton({
  children,
  selected,
  onClick,
  accent,
  shadow,
}: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
  accent: string
  shadow: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'btn-3d rounded-2xl py-3 font-display text-base font-extrabold transition-colors',
        selected
          ? 'text-[oklch(0.16_0.03_285)]'
          : 'border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground',
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
