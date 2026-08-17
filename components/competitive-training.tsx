'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Volume2, VolumeX, Zap, Key, Check, Sparkles, Loader2, Wifi, WifiOff, BookOpen, Trophy, PlusCircle, LogIn, Copy } from 'lucide-react'
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
  6: { entry: 300, pot: 1800, prizes: [600, 450, 250, 100] },
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

  // Sub-tabs for Batalla Amigos
  const [friendsSubTab, setFriendsSubTab] = useState<'create' | 'join'>('create')

  // UI state
  const [muted, setMuted] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Join/Create Room State
  const [roomCode, setRoomCode] = useState('')
  const [createPlayers, setCreatePlayers] = useState(4)
  const createPlayersRef = useRef(createPlayers)
  useEffect(() => {
    createPlayersRef.current = createPlayers
  }, [createPlayers])
  
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  const [joinConfirmation, setJoinConfirmation] = useState<{
    isOpen: boolean;
    cost: number;
    baseCode: string;
    capacity: number;
    rawCode: string;
  } | null>(null)

  // Private Match State
  const isPrivateMatchRef = useRef(false)
  const hasLobbyIntentRef = useRef(false)

  // Dev Sandbox State (Only keeping the ref since competitive shouldn't really have sandbox, but for parity)
  const isDevSandboxRef = useRef(false)

  const [lobbyData, setLobbyData] = useState<{ roomId: string; players: any[]; targetPlayers: number } | null>(null)
  const entryCostRef = useRef(0)
  const targetPlayersRef = useRef(4)
  const [lobbyTimer, setLobbyTimer] = useState(60)

  // Lobby Timer Effect
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isSearching || lobbyData) {
      interval = setInterval(() => {
        setLobbyTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval)
            const socket = getSocketInstance()
            const playerId = user?.uid || socket.id
            socket.emit('leave_matchmaking', { playerId })
            hasLobbyIntentRef.current = false
            setIsSearching(false)
            setLobbyData(null)
            setCreatedRoomCode(null)
            entryCostRef.current = 0
            showToast('⏳ Tiempo de espera agotado.')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else {
      setLobbyTimer(60)
    }
    return () => clearInterval(interval)
  }, [isSearching, lobbyData, getSocketInstance, user])

  // Auto-connect socket when opening
  useEffect(() => {
    const socket = connect()

    // Register identity & clean up any prior matchmaking queue authoritatively
    const playerId = user?.uid || `guest_${Math.floor(Math.random() * 100000)}`
    socket.emit('leave_matchmaking', { playerId })
    socket.emit('register_identity', { playerId })

    const handlePrivateRoomCreated = (data: { roomCode?: string; id?: string }) => {
      if (!hasLobbyIntentRef.current) return
      const baseCode = data.roomCode || data.id || ''
      const code = `${baseCode}-${createPlayersRef.current}`
      setCreatedRoomCode(code)
      setLobbyData({ roomId: code, players: [{ playerId, playerName: user?.photoURL ? `${user?.nickname || 'Jugador'}|||${user?.photoURL}` : (user?.nickname || 'Jugador') }], targetPlayers: createPlayersRef.current })
      showToast(`¡Sala ${code} creada con éxito!`)
    }

    const handleRoomUpdated = (data: { id?: string; players?: any[] }) => {
      if (!hasLobbyIntentRef.current) return
      if (data.players) {
        setLobbyData((prev) => ({
          roomId: prev?.roomId && prev.roomId !== 'Buscando...' && prev.roomId !== 'Creando...' ? prev.roomId : (data.id || 'Buscando...'),
          players: data.players,
          targetPlayers: targetPlayersRef.current
        }))
        showToast(`Jugadores en sala: ${data.players.length}`)
      }
    }

    const handleMatchFound = (gameData: any) => {
      if (!hasLobbyIntentRef.current) return
      const receivedCount = gameData.players?.length ?? 0
      if (!isPrivateMatchRef.current && receivedCount < quickPlayersRef.current && !isDevSandboxRef.current) {
        return // Ignore match if it doesn't meet our requested player count
      }
      setIsSearching(false)
      setLobbyTimer(60)
      
      // REALIZAR COBRO DE SUGAR COINS AQUÍ (Diferido)
      if (entryCostRef.current > 0 && deductCoins) {
        deductCoins(entryCostRef.current)
        entryCostRef.current = 0
      }

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
      hasLobbyIntentRef.current = false
      setIsSearching(false)
      setLobbyData(null)
      setCreatedRoomCode(null)
      setLobbyTimer(60)
      entryCostRef.current = 0
      setErrorMsg(`⚠️ ${data.message || 'Error en la sala'}`)
    }

    socket.on('private_room_created', handlePrivateRoomCreated)
    socket.on('room_updated', handleRoomUpdated)
    socket.on('match_found', handleMatchFound)
    socket.on('room_error', handleRoomError)

    return () => {
      hasLobbyIntentRef.current = false
      socket.emit('leave_matchmaking', { playerId })
      socket.off('private_room_created', handlePrivateRoomCreated)
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
    isPrivateMatchRef.current = false
    const entryFee = ECONOMY_MATRIX[quickPlayers].entry
    if ((user?.coins ?? 200) < entryFee) {
      setErrorMsg(`¡Saldo insuficiente! Necesitas ${entryFee} Sugar Coins para entrar a esta partida.`)
      return
    }
    
    hasLobbyIntentRef.current = true
    // Defer coin deduction
    entryCostRef.current = entryFee
    targetPlayersRef.current = quickPlayers

    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id || `guest_${Math.floor(Math.random() * 10000)}`
    const playerName = user?.nickname || user?.displayName || 'Jugador'

    setIsSearching(true)
    setErrorMsg(null)
    setLobbyData({ roomId: 'Buscando...', players: [{ playerId, playerName: user?.photoURL ? `${playerName}|||${user?.photoURL}` : playerName }], targetPlayers: quickPlayers })
    showToast(`Buscando partida para ${quickPlayers} jugadores... (Costo: ${entryFee} SC)`)

    socket.emit('join_matchmaking', {
      playerId,
      playerName: user?.photoURL ? `${playerName}|||${user.photoURL}` : playerName,
      targetPlayers: quickPlayers,
      mode: 'competitive',
    })
  }

  const handleCancelQuickMatch = () => {
    hasLobbyIntentRef.current = false
    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id
    setIsSearching(false)
    setLobbyData(null)
    setCreatedRoomCode(null)
    setLobbyTimer(60)
    entryCostRef.current = 0
    socket.emit('leave_matchmaking', { playerId })
    showToast('Búsqueda cancelada.')
  }

  const handleCreateRoom = () => {
    const eco = ECONOMY_MATRIX[createPlayers]
    if (user && (user.coins ?? 0) < eco.entry) {
      setErrorMsg(`No tienes suficientes Sugar Coins. Necesitas ${eco.entry} SC.`)
      setTimeout(() => setErrorMsg(null), 3000)
      return
    }

    hasLobbyIntentRef.current = true
    // Defer coin deduction
    entryCostRef.current = eco.entry
    targetPlayersRef.current = createPlayers

    isPrivateMatchRef.current = true
    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id || `guest_${Math.floor(Math.random() * 10000)}`
    const playerName = user?.nickname || user?.displayName || 'Jugador'

    showToast('Creando sala privada competitiva...')
    setLobbyData({ roomId: 'Creando...', players: [{ playerId, playerName: user?.photoURL ? `${playerName}|||${user?.photoURL}` : playerName }], targetPlayers: createPlayers })
    socket.emit('create_private_room', {
      playerId,
      playerName: user?.photoURL ? `${playerName}|||${user.photoURL}` : playerName,
      targetPlayers: createPlayers,
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
    const rawCode = roomCode.trim()
    if (!rawCode) return

    const parts = rawCode.split('-')
    const baseCode = parts[0]
    const capacityStr = parts[1]
    
    const capacity = parseInt(capacityStr, 10) || 4 
    const eco = ECONOMY_MATRIX[capacity] || ECONOMY_MATRIX[4]
    const cost = eco.entry

    setJoinConfirmation({
      isOpen: true,
      cost,
      baseCode,
      capacity,
      rawCode
    })
  }

  const confirmJoin = () => {
    if (!joinConfirmation) return
    const { cost, baseCode, capacity, rawCode } = joinConfirmation
    
    if (user && (user.coins ?? 0) < cost) {
       setErrorMsg(`No tienes suficientes Sugar Coins. Necesitas ${cost} SC.`)
       setJoinConfirmation(null)
       return
    }
    
    hasLobbyIntentRef.current = true
    // Defer coin deduction
    entryCostRef.current = cost
    targetPlayersRef.current = capacity

    isPrivateMatchRef.current = true
    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id || `guest_${Math.floor(Math.random() * 10000)}`
    const playerName = user?.nickname || user?.displayName || 'Jugador'

    setIsSearching(true)
    setErrorMsg(null)
    setJoinConfirmation(null)
    showToast(`Uniéndose a la sala ${rawCode}...`)
    
    setLobbyData({ roomId: rawCode, players: [{ playerId, playerName: user?.photoURL ? `${playerName}|||${user?.photoURL}` : playerName }], targetPlayers: capacity })
    socket.emit('join_private_room', {
      playerId,
      playerName: user?.photoURL ? `${playerName}|||${user.photoURL}` : playerName,
      targetPlayers: capacity,
      roomCode: baseCode,
      code: baseCode,
    })
  }

  const handleBackToMenu = () => {
    hasLobbyIntentRef.current = false
    const socket = getSocketInstance()
    const playerId = user?.uid || socket.id
    if (socket) {
      socket.emit('leave_matchmaking', { playerId })
    }
    onBack()
  }

  const currentEconomy = ECONOMY_MATRIX[quickPlayers]

  return (
    <section className="flex flex-col gap-3 md:gap-4 animate-slide-in">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={handleBackToMenu}
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
            <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[200] animate-in fade-in slide-in-from-top-4 flex items-center justify-center gap-2 rounded-full border border-[var(--candy-gold)]/40 bg-[oklch(0.1_0.05_250)] px-6 py-3 text-[var(--candy-gold)] font-display text-sm font-bold shadow-2xl shadow-[var(--candy-gold)]/20 whitespace-nowrap">
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
              onClick={() => {
                setMainTab('friends')
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm sm:text-base font-extrabold transition-all ${
                mainTab === 'friends'
                  ? 'bg-[linear-gradient(145deg,var(--candy-gold),oklch(0.7_0.18_55))] text-[oklch(0.18_0.03_285)] shadow-[0_4px_12px_oklch(0.78_0.18_55/0.4)]'
                  : 'text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground'
              }`}
            >
              <Key className="size-5" />
              Batalla Amigos 🔑
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
                  <div className={cn(
                    "w-full items-center justify-center",
                    currentEconomy.prizes.filter(prize => prize > 0).length >= 4
                      ? "grid grid-cols-2 gap-x-2 gap-y-0.5"
                      : "flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
                  )}>
                    {currentEconomy.prizes.filter(prize => prize > 0).map((prize, idx) => (
                      <span key={idx} className={cn("font-display text-xs sm:text-sm font-black flex items-center justify-center gap-1 whitespace-nowrap", idx === 0 ? 'text-emerald-400' : 'text-emerald-400/80')}>
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

          {/* TAB 2: BATALLA AMIGOS 🔑 */}
          {mainTab === 'friends' && (
            <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
              {/* Sub-tabs selector: Crear Sala | Unirse */}
              <div className="flex rounded-xl bg-[oklch(0_0_0/0.2)] p-1 border border-border/40 w-full sm:w-80 mx-auto">
                <button
                  onClick={() => {
                    setFriendsSubTab('create')
                    setCreatedRoomCode(null)
                  }}
                  className={`flex-1 py-2 rounded-lg font-display text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    friendsSubTab === 'create'
                      ? 'bg-[var(--candy-orange)] text-white shadow-md'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <PlusCircle className="size-4" />
                  Crear Sala 🏆
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

              {/* Sub-tab A: CREAR SALA 🏆 */}
              {friendsSubTab === 'create' && (
                <div className="flex flex-col gap-6 animate-in fade-in">
                  {!createdRoomCode ? (
                    <>
                      <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground">
                          <span className="h-5 w-1.5 rounded-full bg-[var(--candy-orange)] shadow-[0_0_12px_var(--candy-orange)]" />
                          Capacidad de la Sala Privada
                        </legend>
                        
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                          {PLAYER_OPTIONS.map((count) => (
                            <PillButton
                              key={count}
                              selected={createPlayers === count}
                              onClick={() => setCreatePlayers(count)}
                              accent="var(--candy-orange)"
                              shadow="oklch(0.55 0.16 50)"
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
                          <span className="font-display text-lg font-black text-red-400 drop-shadow-[0_0_8px_red] flex items-center gap-1">-{ECONOMY_MATRIX[createPlayers].entry} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" /></span>
                        </div>
                        <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-[oklch(1_0_0/0.05)]">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pozo Total</span>
                          <span className="font-display text-lg font-black text-[var(--candy-gold)] flex items-center gap-1">{ECONOMY_MATRIX[createPlayers].pot} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" /></span>
                        </div>
                        <div className="flex flex-col gap-1 items-center justify-center p-2 rounded-xl bg-[oklch(1_0_0/0.05)] col-span-2 sm:col-span-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Premios</span>
                          <div className={cn(
                            "w-full items-center justify-center",
                            ECONOMY_MATRIX[createPlayers].prizes.filter(prize => prize > 0).length >= 4
                              ? "grid grid-cols-2 gap-x-2 gap-y-0.5"
                              : "flex flex-wrap items-center justify-center gap-x-4 gap-y-1"
                          )}>
                            {ECONOMY_MATRIX[createPlayers].prizes.filter(prize => prize > 0).map((prize, idx) => (
                              <span key={idx} className={cn("font-display text-xs sm:text-sm font-black flex items-center justify-center gap-1 whitespace-nowrap", idx === 0 ? 'text-emerald-400' : 'text-emerald-400/80')}>
                                {idx + 1}º: +{prize} <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" />
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={handleCreateRoom}
                        className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.7_0.25_40),oklch(0.6_0.20_35))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-white shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.45_0.2_35),0_14px_26px_oklch(0.45_0.2_35/0.55)]"
                      >
                        <PlusCircle className="size-6" />
                        CREAR SALA COMPETITIVA 🏆
                      </button>
                    </>
                  ) : (
                    /* Display generated room code */
                    <div className="glass flex flex-col items-center gap-4 rounded-2xl p-6 border border-[var(--candy-orange)]/30 text-center animate-in zoom-in-95">
                      <span className="font-display text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                        Código de tu Sala Privada
                      </span>
                      
                      <div className="flex items-center gap-3 rounded-xl bg-[oklch(0_0_0/0.4)] px-6 py-3 border border-[var(--candy-orange)]">
                        <span className="font-mono text-3xl font-extrabold tracking-widest text-[var(--candy-gold)]">
                          {createdRoomCode}
                        </span>
                        <button
                          onClick={handleCopyCode}
                          className="flex size-10 items-center justify-center rounded-lg bg-[oklch(1_0_0/0.1)] hover:bg-[oklch(1_0_0/0.2)] transition-colors text-white"
                          title="Copiar código"
                        >
                          {copiedCode ? <Check className="size-5 text-[var(--candy-gold)]" /> : <Copy className="size-5" />}
                        </button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Comparte este código con tus amigos para que ingresen desde el botón "Unirse 🔑".
                      </p>

                      <button
                        onClick={() => setCreatedRoomCode(null)}
                        className="text-xs text-[var(--candy-gold)] hover:underline font-bold mt-2"
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
                      placeholder="Ej. 123456-4"
                      className="w-full rounded-2xl border-2 border-[var(--candy-gold)]/40 bg-[oklch(0_0_0/0.3)] px-6 py-4 font-mono text-2xl font-extrabold text-center tracking-widest text-[var(--candy-gold)] outline-none transition-colors focus:border-[var(--candy-gold)] focus:bg-[oklch(0_0_0/0.5)] placeholder:text-muted-foreground/30 uppercase"
                    />
                  </div>

                  {/* Economy Note para Join */}
                  <div className="text-center text-xs text-muted-foreground">
                    <p>Nota: Al unirte, el servidor verificará el cobro de Sugar Coins según la configuración del anfitrión.</p>
                  </div>

                  <button
                    type="submit"
                    className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.85_0.16_90),oklch(0.78_0.18_55))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-[oklch(0.25_0.08_60)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.6_0.15_50),0_14px_26px_oklch(0.6_0.15_50/0.55)]"
                  >
                    <LogIn className="size-6" />
                    ENTRAR A LA SALA 🚀
                  </button>
                </form>
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

      <GameGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} showEconomy={true} />

      {/* Join Confirmation Modal */}
      {joinConfirmation?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="glass flex flex-col gap-5 rounded-3xl p-6 sm:p-8 max-w-md w-full border border-[var(--candy-gold)]/30 shadow-[0_0_40px_var(--candy-gold)]/20 animate-in zoom-in-95">
            <header className="text-center">
              <h3 className="font-display text-2xl font-extrabold text-[var(--candy-gold)] drop-shadow-md">
                Confirmar Ingreso
              </h3>
            </header>
            
            <p className="text-center font-display text-sm sm:text-base text-foreground">
              Esta partida tiene un costo de entrada de <strong className="text-red-400">{joinConfirmation.cost} Sugar Coins</strong>.
              ¿Deseas confirmar tu participación y unirte a la sala?
            </p>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setJoinConfirmation(null)}
                className="flex-1 rounded-2xl border-2 border-[var(--candy-gold)]/30 py-3 font-display font-bold text-foreground hover:bg-[oklch(1_0_0/0.05)] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={confirmJoin}
                className="btn-3d flex-1 rounded-2xl bg-[linear-gradient(145deg,oklch(0.85_0.16_90),oklch(0.78_0.18_55))] py-3 font-display font-extrabold text-[oklch(0.25_0.08_60)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.6_0.15_50),0_14px_26px_oklch(0.6_0.15_50/0.55)]"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING LOBBY MODAL */}
      {(isSearching || lobbyData) && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in zoom-in-95">
          <div className="bg-panel w-full max-w-sm rounded-[2rem] p-6 sm:p-8 border border-[var(--candy-gold)]/30 shadow-2xl flex flex-col items-center gap-6">
            <header className="text-center w-full">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold uppercase text-[var(--candy-gold)] tracking-wider drop-shadow-md">
                {isPrivateMatchRef.current ? `Batalla de Amigos` : `Partida Rápida`}
              </h2>
              <p className="mt-1 font-display text-xs font-bold uppercase tracking-[0.2em] text-[var(--candy-orange)]">
                {lobbyData?.targetPlayers || targetPlayersRef.current} Jugadores
              </p>
            </header>

            {/* Room Code Card (Only for Private Rooms) */}
            {isPrivateMatchRef.current && lobbyData?.roomId && lobbyData.roomId !== 'Buscando...' && lobbyData.roomId !== 'Creando...' && (
              <div className="w-full bg-[oklch(0_0_0/0.4)] rounded-2xl border border-[var(--candy-gold)]/30 p-4 flex flex-col items-center gap-2 relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-[var(--candy-gold)] to-transparent opacity-50" />
                <span className="text-[10px] sm:text-xs font-bold uppercase text-muted-foreground tracking-widest">
                  Código de Invitación
                </span>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-3xl sm:text-4xl font-extrabold tracking-widest text-[var(--candy-gold)]">
                    {lobbyData.roomId}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(lobbyData.roomId)
                      setCopiedCode(true)
                      setTimeout(() => setCopiedCode(false), 2000)
                    }}
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[oklch(1_0_0/0.1)] hover:bg-[var(--candy-gold)] hover:text-black transition-all text-white shadow-md active:scale-95"
                    title="Copiar código"
                  >
                    {copiedCode ? <Check className="size-5" /> : <Copy className="size-5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Avatars List */}
            <div className="flex flex-col gap-3 w-full mt-2">
              {Array.from({ length: lobbyData?.targetPlayers || targetPlayersRef.current || 4 }).map((_, i) => {
                  const player = lobbyData?.players?.[i]
                  let name = player?.playerName || ''
                  if (name.includes('|||')) {
                    const parts = name.split('|||')
                    name = parts[0]
                  }

                  return (
                    <div key={i} className={cn(
                      "flex items-center w-full rounded-xl px-4 py-3 border transition-colors",
                      player ? "border-[var(--candy-gold)]/40 bg-[var(--candy-gold)]/10" : "border-dashed border-white/10 bg-white/5"
                    )}>
                      <div className="flex items-center gap-3 truncate w-full">
                        {player ? (
                           <>
                             <div className="size-2 shrink-0 rounded-full bg-[var(--candy-gold)] shadow-[0_0_8px_var(--candy-gold)]" />
                             <span className="font-display text-sm font-bold text-white truncate">
                               {name} <span className="text-muted-foreground ml-1">• NVL. 2</span>
                             </span>
                           </>
                        ) : (
                           <>
                             <Loader2 className="size-4 text-white/30 animate-spin shrink-0" />
                             <span className="font-display text-sm font-bold text-muted-foreground truncate">
                               Esperando jugador...
                             </span>
                           </>
                        )}
                      </div>
                    </div>
                  )
              })}
            </div>

            {/* Timer */}
            <div className="mt-4 flex flex-col items-center gap-1">
              <span className="font-mono text-4xl font-extrabold text-white tracking-widest drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                00:{lobbyTimer.toString().padStart(2, '0')}
              </span>
              <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">
                Tiempo Restante
              </span>
            </div>

            {/* Cancel Button */}
            <button
              onClick={handleCancelQuickMatch}
              className="mt-4 w-full max-w-[240px] btn-3d rounded-xl border border-red-500/50 bg-red-500/10 py-3 font-display text-sm font-bold uppercase tracking-wider text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-colors shadow-lg active:scale-95"
            >
              Cancelar y Salir
            </button>
          </div>
        </div>
      )}
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
