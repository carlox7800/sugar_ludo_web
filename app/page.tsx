'use client'

import { useState, useEffect, useRef } from 'react'
import { Sidebar, MobileNav } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { ProfileCard } from '@/components/profile-card'
import { GameModes } from '@/components/game-modes'
import { AiTraining } from '@/components/ai-training'
import { OnlineTraining } from '@/components/online-training'
import { CompetitiveTraining } from '@/components/competitive-training'
import { ProfileModal } from '@/components/profile-modal'
import { SettingsModal } from '@/components/settings-modal'
import GameEngine from '@/src/GameEngine'
import { GameConfig } from '@/src/types'
import { OnlineGameEngine, OnlineGameData } from '@/screens/online-game-engine'
import { LogIn, Loader2, Sparkles, Dices, Trophy } from 'lucide-react'

// Screens
import { WalletScreen } from '@/screens/wallet-screen'
import { FriendsScreen } from '@/screens/friends-screen'
import { StoreScreen } from '@/screens/store-screen'
import { EventsScreen } from '@/screens/events-screen'
import { MailScreen } from '@/screens/mail-screen'
import { CollectionScreen } from '@/screens/collection-screen'
import { LandingPage } from '@/screens/landing-page'

// Contexts, Hooks & Modals
import { PlayerProvider } from '@/lib/player-context'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { VoiceProvider, useVoiceChat } from '@/lib/voice-context'
import { LoginModal } from '@/components/login-modal'
import { NicknameSetupModal } from '@/components/nickname-setup-modal'
import { DuelChallengeModal } from '@/components/duel-challenge-modal'
import { getSocket } from '@/lib/socket'
import { globalLogger } from '@/lib/logger'
import { preloadStoreAssets } from '@/lib/store-service'
import { 
  DuelChallengeItem, 
  registerSocialSocket,
  sendSocialStatusChange,
  subscribeToIncomingDuelInvites, 
  respondToRealtimeDuelInvite,
  clearIncomingDuelInvite
} from '@/lib/friends-service'
import { initPresenceTracker, updatePlayerTelemetryState, mapScreenToTelemetryState } from '@/lib/presence-service'

export type Screen =
  | 'landing'
  | 'lobby'
  | 'training'
  | 'online-training'
  | 'competitive'
  | 'online-game'
  | 'game'
  | 'tienda'
  | 'billetera'
  | 'amigos'
  | 'eventos'
  | 'correo'
  | 'coleccion'

function PageContent() {
  const { user, isLoaded, loginWithGoogle, loginDev, setNickname } = useAuth()
  const { leaveVoiceRoom } = useVoiceChat()
  
  // Detección síncrona inmediata de clientes nativos (Capacitor Android y Electron Desktop)
  // Esto erradica el parpadeo de 1 frame de la Landing Page en clientes nativos
  const [isNative, setIsNative] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const capacitor = (window as any).Capacitor
    const isCapacitor = capacitor && (
      (capacitor.isNativePlatform && capacitor.isNativePlatform()) || 
      (capacitor.getPlatform && capacitor.getPlatform() !== 'web')
    )
    const isElectron = !!(window as any).electronAuth || 
      window.navigator.userAgent.includes('Electron') || 
      window.location.protocol === 'file:' || 
      window.location.protocol === 'app:'
    return !!isCapacitor || !!isElectron
  })

  // Control de duración mínima del Splash Screen AAA (1.8 segundos con barra de progreso)
  const [isSplashDone, setIsSplashDone] = useState(false)
  const [splashProgress, setSplashProgress] = useState(15)

  useEffect(() => {
    const startTime = Date.now()
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(100, Math.floor((elapsed / 1800) * 100))
      setSplashProgress(Math.max(15, progress))
      if (elapsed >= 1800) {
        clearInterval(interval)
        setIsSplashDone(true)
      }
    }, 40)
    return () => clearInterval(interval)
  }, [])
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Pre-warm Store & Collection Assets Cache
      preloadStoreAssets()

      const capacitor = (window as any).Capacitor;
      const isCapacitor = capacitor && (
        (capacitor.isNativePlatform && capacitor.isNativePlatform()) || 
        (capacitor.getPlatform && capacitor.getPlatform() !== 'web')
      );
      const isElectron = !!(window as any).electronAuth || window.navigator.userAgent.includes('Electron') || window.location.protocol === 'file:' || window.location.protocol === 'app:'
      setIsNative(!!isCapacitor || !!isElectron)

      // Restore Visual Theme
      const savedTheme = localStorage.getItem('sugar_app_theme')
      if (savedTheme === 'sugar') {
        document.documentElement.classList.add('theme-sugar')
      } else {
        document.documentElement.classList.remove('theme-sugar')
      }
      initPresenceTracker('landing')
    }
  }, [])
  
  // Decide initial screen based on PWA environment and Auth
  const [screen, setScreen] = useState<Screen>('landing')
  const screenRef = useRef<Screen>('landing')
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [onlineGameData, setOnlineGameData] = useState<OnlineGameData | null>(null)
  const [onlineGameOrigin, setOnlineGameOrigin] = useState<Screen>('lobby')

  const setScreenAndRef = (s: Screen) => {
    globalLogger.nav(screenRef.current, s)
    if (s !== 'online-game' && s !== 'online-training' && (screenRef.current === 'online-game' || screenRef.current === 'online-training')) {
      leaveVoiceRoom(true)
    }
    screenRef.current = s
    setScreen(s)
    updatePlayerTelemetryState(mapScreenToTelemetryState(s, onlineGameOrigin))
  }
  
  // UI States
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [incomingChallenge, setIncomingChallenge] = useState<DuelChallengeItem | null>(null)

  const [duelAutoJoinCode, setDuelAutoJoinCode] = useState<string | null>(null)

  // Escucha de tecla ESC (Desktop Electron y navegador) para desplegar modal propio Cyber Candy
  useEffect(() => {
    if (typeof window === 'undefined') return

    // 1. Escucha de evento IPC en Desktop Electron
    const electronAuth = (window as any).electronAuth
    if (electronAuth?.onEscapePressed) {
      electronAuth.onEscapePressed(() => {
        setIsExitModalOpen(prev => !prev)
      })
    }

    // 2. Escucha de tecla ESC en ventana general
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Si hay modales secundarios abiertos, permitimos cerrarlos primero
        setIsExitModalOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  // Escucha de Deep Link para activar spinner inmediato de inicio de sesión
  useEffect(() => {
    if (typeof window === 'undefined') return
    const electronAuth = (window as any).electronAuth
    if (electronAuth?.onDeepLinkToken) {
      electronAuth.onDeepLinkToken(() => {
        setIsLoggingIn(true)
      })
    }
  }, [])

  const [forceWebMode, setForceWebMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sugar_force_web_mode') === 'true'
    }
    return false
  })

  // Register on social WebSocket & initialize stream once per user
  useEffect(() => {
    if (!user?.uid) return
    globalLogger.auth(`Usuario activo en sesión: ${user.nickname || user.displayName || user.uid}`, { uid: user.uid })
    registerSocialSocket(user)
  }, [user?.uid])

  // Synchronize presence on status / screen change
  useEffect(() => {
    if (!user?.uid) return
    const isPlaying = screen === 'game' || screen === 'online-game' || screen === 'training' || screen === 'competitive'
    sendSocialStatusChange(isPlaying ? 'in_game' : 'online')
  }, [user?.uid, screen])

  // Listen to incoming duel challenges in real time via WebSockets
  useEffect(() => {
    if (!user?.uid) return
    const unsub = subscribeToIncomingDuelInvites(user.uid, (challenge) => {
      if (challenge) {
        globalLogger.social(`Modal de reto activado en pantalla`, challenge)
      }
      setIncomingChallenge(challenge)
    })
    return () => unsub()
  }, [user])

  // Listener global de match_found para entrada simultánea e instantánea al tablero
  useEffect(() => {
    const socket = getSocket()
    const handleGlobalMatchFound = (gameData: any) => {
      globalLogger.socket(`match_found global recibido en page.tsx`, {
        roomId: gameData.roomId || gameData.id,
        playersCount: gameData.players?.length
      })
      clearIncomingDuelInvite()
      setIncomingChallenge(null)
      setDuelAutoJoinCode(null)
      const currentScreen = screenRef.current
      const finalPlayers = [...(gameData.players || [])]
      const enrichedGameData: OnlineGameData = {
        ...gameData,
        players: finalPlayers,
        roomId: gameData.roomId || gameData.id,
        myPlayerId: user?.uid || socket.id,
      }
      setOnlineGameData(enrichedGameData)
      // Use ref to read current screen value — avoids stale closure bug
      setOnlineGameOrigin(currentScreen === 'amigos' ? 'amigos' : (currentScreen === 'online-training' ? 'online-training' : 'lobby'))
      setScreenAndRef('online-game')
    }

    socket.on('match_found', handleGlobalMatchFound)
    return () => {
      socket.off('match_found', handleGlobalMatchFound)
    }
  }, [user])

  // Auth & Native routing logic
  useEffect(() => {
    // CORTAFUEGOS DE PARTIDA: Durante una partida activa, NUNCA redirigir a landing ni a lobby
    if (screen === 'online-game' || screen === 'game') {
      return
    }

    // REGLA 1: Si se está accediendo desde un navegador web normal y no se ha activado modo web, se fuerza la Landing Page informativa
    if (!isNative && !forceWebMode) {
      setScreenAndRef('landing')
      return
    }

    // REGLA 2: Si es la App Instalada (Standalone PWA) o Modo Web Forzado
    if (user) {
      if (user.nickname) {
        // Usuario logueado con nickname -> Ir al Lobby (salvo que ya esté en partida o pantalla específica)
        if (screen === 'landing') {
          setScreenAndRef('lobby')
        }
        setIsLoginModalOpen(false)
      }
    } else {
      // Usuario no logueado en App instalada o Modo Web -> Abrir inmediatamente el modal de Login
      setIsLoginModalOpen(true)
    }
  }, [user, screen, isNative, forceWebMode])

  const handleStartGame = (gameConfig: GameConfig) => {
    globalLogger.log('GAME-FLOW', `Iniciando partida offline clásica (${gameConfig.playerCount} jugadores)`, gameConfig)
    setConfig(gameConfig)
    setScreenAndRef('game')
  }

  const handleMatchFound = (gameData: OnlineGameData, origin: Screen = 'online-training') => {
    globalLogger.log('GAME-FLOW', `Iniciando partida online (${gameData.players?.length} jugadores)`, {
      roomId: gameData.roomId,
      origin
    })
    setOnlineGameData(gameData)
    setOnlineGameOrigin(origin)
    setScreenAndRef('online-game')
  }

  const handleAcceptDuel = (challenge: DuelChallengeItem) => {
    globalLogger.social(`Jugador aceptó reto 1 vs 1`, challenge)
    respondToRealtimeDuelInvite(challenge.senderUid, 'accepted', challenge.roomCode, challenge.id)
    clearIncomingDuelInvite()
    setIncomingChallenge(null)
    // Capture current screen synchronously from ref
    const originAtAccept = screenRef.current === 'amigos' ? 'amigos' : 'lobby'
    setOnlineGameOrigin(originAtAccept)

    const rawCode = challenge.roomCode.trim()

    // Si es una invitación al Lobby P2P de espera previa, redirigir a online-training como invitado
    if (rawCode.startsWith('LOBBY-')) {
      globalLogger.nav(`Redirigiendo a BatallaLobby como invitado para: ${rawCode}`)
      setDuelAutoJoinCode(rawCode)
      setScreenAndRef('online-training')
      return
    }

    setDuelAutoJoinCode(null)

    // Unirse directamente a la sala en el socket del servidor usando el código exacto
    const socket = getSocket()
    const playerId = user?.uid || socket.id || `guest_${Math.floor(Math.random() * 10000)}`
    const playerName = user?.photoURL ? `${user.nickname || 'Jugador'}|||${user.photoURL}` : (user?.nickname || 'Jugador')

    const emitJoin = () => {
      globalLogger.socket(`Emitiendo join_private_room para reto`, {
        roomCode: rawCode,
        playerId,
        playerName
      })

      socket.emit('register_identity', { playerId })

      socket.emit('join_private_room', {
        playerId,
        playerName,
        targetPlayers: 2,
        roomCode: rawCode,
        code: rawCode,
      })
    }

    if (socket.connected) {
      emitJoin()
    } else {
      globalLogger.socket(`Socket desconectado al aceptar reto, conectando primero...`)
      socket.once('connect', () => {
        emitJoin()
      })
      socket.connect()
    }
  }

  const handleRejectDuel = (challenge: DuelChallengeItem) => {
    globalLogger.social(`Jugador rechazó reto 1 vs 1`, challenge)
    respondToRealtimeDuelInvite(challenge.senderUid, 'rejected', challenge.roomCode, challenge.id)
    clearIncomingDuelInvite()
    setIncomingChallenge(null)
  }

  const handleLoginGoogle = () => {
    loginWithGoogle()
  }

  const handleLoginDev = () => {
    loginDev()
  }

  const handleNicknameConfirm = (nickname: string) => {
    setNickname(nickname)
  }

  // 0. SPLASH SCREEN AAA INTERACTIVO CON TEMÁTICA DE DADOS Y TABLERO
  // Garantiza 1.8s de experiencia de marca y que Firebase Auth resuelva en segundo plano sin parpadeos
  if (!isLoaded || !isSplashDone) {
    return (
      <main className="cyber-bg min-h-screen w-full flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden relative pt-safe pb-safe">
        {/* Glows ambientales de fondo */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 size-80 bg-[var(--candy-magenta)]/25 rounded-full blur-[100px] pointer-events-none animate-pulse" />
        <div className="absolute bottom-1/3 left-1/2 -translate-x-1/2 translate-y-1/2 size-72 bg-[var(--candy-cyan)]/20 rounded-full blur-[90px] pointer-events-none" />

        <div className="flex flex-col items-center max-w-sm w-full z-10 animate-in fade-in zoom-in-95 duration-500">
          
          {/* Emblema Central con Dados Flotantes 3D */}
          <div className="relative mb-8">
            <div className="flex size-24 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--candy-magenta)] via-[#ff0077] to-[var(--candy-cyan)] shadow-[0_0_40px_rgba(255,34,119,0.7)] transform hover:scale-105 transition-transform duration-500">
              <span className="font-display text-6xl font-extrabold text-white drop-shadow-[0_4px_12px_rgba(0,0,0,0.5)]">S</span>
            </div>
            
            {/* Ícono de Dados Flotante Decorativo */}
            <div className="absolute -top-3 -right-3 size-10 rounded-2xl bg-[#1a0f2e] border border-[var(--candy-gold)]/60 flex items-center justify-center shadow-[0_0_15px_rgba(255,204,34,0.6)] animate-bounce duration-1000">
              <Dices className="size-5 text-[var(--candy-gold)]" />
            </div>

            {/* Ícono de Trofeo Decorativo */}
            <div className="absolute -bottom-2 -left-3 size-9 rounded-xl bg-[#1a0f2e] border border-[var(--candy-cyan)]/60 flex items-center justify-center shadow-[0_0_12px_rgba(34,221,221,0.5)]">
              <Trophy className="size-4 text-[var(--candy-cyan)]" />
            </div>
            
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-[var(--candy-cyan)] via-[var(--candy-magenta)] to-[var(--candy-gold)] opacity-30 blur-md -z-10 animate-spin duration-3000" />
          </div>

          {/* Título de la Franquicia */}
          <h1 className="font-display text-4xl sm:text-5xl font-extrabold text-white tracking-tight mb-2 drop-shadow-2xl">
            SUGAR <span className="text-[var(--candy-cyan)] drop-shadow-[0_0_20px_rgba(34,221,221,0.7)]">LUDO</span>
          </h1>

          <p className="text-xs uppercase tracking-[0.25em] font-extrabold text-white/70 mb-8 flex items-center gap-2">
            <Sparkles className="size-3 text-[var(--candy-gold)] animate-pulse" />
            <span>Cyber Candy Arena</span>
            <Sparkles className="size-3 text-[var(--candy-gold)] animate-pulse" />
          </p>

          {/* Barra de Progreso Temporizada (0% a 100%) */}
          <div className="w-full max-w-xs flex flex-col items-center gap-2">
            <div className="w-full h-2.5 rounded-full bg-white/10 border border-white/10 p-0.5 overflow-hidden backdrop-blur-md shadow-inner">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-[var(--candy-magenta)] via-[var(--candy-cyan)] to-[var(--candy-gold)] transition-all duration-75 ease-out shadow-[0_0_10px_rgba(34,221,221,0.8)]"
                style={{ width: `${splashProgress}%` }}
              />
            </div>
            <div className="flex justify-between w-full px-1 text-[11px] font-mono text-white/60 font-semibold">
              <span className="flex items-center gap-1.5">
                <Loader2 className="size-3 animate-spin text-[var(--candy-cyan)]" />
                Cargando Arena...
              </span>
              <span>{splashProgress}%</span>
            </div>
          </div>

        </div>
      </main>
    )
  }

  // Si está logueado pero falta el nick, forzamos esa pantalla por encima de todo
  if (user && !user.nickname) {
    return <NicknameSetupModal onConfirm={handleNicknameConfirm} />
  }

  // Render web-browser portal strictly if NOT native and NOT forceWebMode
  if (!isNative && !forceWebMode) {
    return <LandingPage onContinueInBrowser={() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('sugar_force_web_mode', 'true')
      }
      setForceWebMode(true)
      setScreenAndRef('lobby')
    }} />
  }

  const handleNavigateToLanding = () => {
    setScreenAndRef('landing')
  }

  // Render the active screen (Lobby-related)
  const renderScreen = () => {
    switch (screen) {
      case 'lobby':
        return (
          <div className="grid flex-1 gap-5 lg:gap-6 xl:grid-cols-[340px_1fr]">
            <ProfileCard onOpen={() => setIsProfileOpen(true)} />
            <GameModes 
              onStartTraining={() => setScreenAndRef('training')} 
              onStartOnlineTraining={() => setScreenAndRef('online-training')} 
              onStartCompetitive={() => setScreenAndRef('competitive')}
            />
          </div>
        )
      case 'training':
        return (
          <div className="mx-auto w-full max-w-3xl flex-1">
            <AiTraining onBack={() => setScreenAndRef('lobby')} onStartGame={handleStartGame} />
          </div>
        )
      case 'online-training':
        return (
          <div className="mx-auto w-full max-w-3xl flex-1">
            <OnlineTraining 
              onBack={() => {
                setDuelAutoJoinCode(null)
                setScreenAndRef('lobby')
              }} 
              autoJoinCode={duelAutoJoinCode}
              onMatchFound={(data) => {
                setDuelAutoJoinCode(null)
                handleMatchFound(data, 'online-training')
              }}
            />
          </div>
        )
      case 'competitive':
        return (
          <div className="mx-auto w-full max-w-3xl flex-1">
            <CompetitiveTraining 
              onBack={() => setScreenAndRef('lobby')} 
              onMatchFound={(data) => handleMatchFound(data, 'competitive')}
            />
          </div>
        )
      case 'billetera':
        return <WalletScreen onBack={() => setScreenAndRef('lobby')} />
      case 'amigos':
        return (
          <FriendsScreen 
            onBack={() => setScreenAndRef('lobby')} 
            onStartDuel={() => {
              setDuelAutoJoinCode(null)
            }} 
          />
        )
      case 'tienda':
        return <StoreScreen onBack={() => setScreenAndRef('lobby')} />
      case 'eventos':
        return <EventsScreen onBack={() => setScreenAndRef('lobby')} />
      case 'correo':
        return <MailScreen onBack={() => setScreenAndRef('lobby')} />
      case 'coleccion':
        return <CollectionScreen onBack={() => setScreenAndRef('lobby')} onNavigate={(s) => setScreenAndRef(s as Screen)} />
      default:
        return null
    }
  }

  // Offline Game Engine runs independently outside the Lobby layout
  if (screen === 'game' && config) {
    return <GameEngine initialConfig={config} onExit={() => setScreenAndRef('training')} />
  }

  // Online Game Engine runs independently outside the Lobby layout
  if (screen === 'online-game' && onlineGameData) {
    return (
      <OnlineGameEngine 
        gameData={onlineGameData} 
        modeType={onlineGameOrigin === 'competitive' ? 'competitive' : 'training'}
        onExit={() => {
          clearIncomingDuelInvite()
          setIncomingChallenge(null)
          setOnlineGameData(null)
          setDuelAutoJoinCode(null)
          leaveVoiceRoom(true)
          const targetScreen = (onlineGameOrigin === 'amigos') ? 'amigos' : (onlineGameOrigin === 'competitive' ? 'competitive' : (onlineGameOrigin === 'online-training' ? 'online-training' : 'lobby'))
          setOnlineGameOrigin('lobby')
          setScreenAndRef(targetScreen)
        }} 
      />
    )
  }

  // Native App / Web Mode Screen for Non-Logged User
  if (!user && (isNative || forceWebMode)) {
    return (
      <main className="cyber-bg min-h-screen w-full flex flex-col items-center justify-center p-6 text-center pt-safe pb-safe select-none">
        <div className="flex flex-col items-center max-w-md w-full glass rounded-3xl p-8 border border-[var(--candy-cyan)]/30 shadow-[0_0_40px_rgba(34,221,221,0.15)] animate-in fade-in zoom-in-95">
          {/* Logo Sugar Ludo */}
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--candy-magenta)] shadow-[0_0_25px_rgba(255,34,119,0.6)] mb-4">
            <span className="font-display text-4xl font-extrabold text-white">S</span>
          </div>

          <h1 className="font-display text-3xl font-extrabold text-white tracking-tight mb-2">
            SUGAR <span className="text-[var(--candy-cyan)]">LUDO</span>
          </h1>
          <p className="text-sm text-white/70 font-medium mb-6">
            Bienvenido a la Arena Oficial. Inicia sesión para jugar y competir.
          </p>

          {isLoggingIn ? (
            <div className="flex flex-col items-center py-6 gap-4 animate-in fade-in">
              <Loader2 className="size-10 text-[var(--candy-cyan)] animate-spin" />
              <p className="font-display text-base font-bold text-white tracking-wide">
                Iniciando sesión en Sugar Ludo...
              </p>
              <p className="text-xs text-white/60 font-medium">
                Sincronizando tus datos y balance...
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3.5 w-full animate-in fade-in">
              <button
                onClick={() => {
                  setIsLoggingIn(true)
                  handleLoginGoogle()
                }}
                className="btn-3d w-full flex items-center justify-center gap-3 rounded-2xl bg-white text-neutral-900 py-3.5 px-4 font-display text-sm font-bold shadow-lg hover:bg-neutral-100 transition-all cursor-pointer"
              >
                <svg className="size-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continuar con Google</span>
              </button>

              {process.env.NODE_ENV !== 'production' && (
                <button
                  onClick={handleLoginDev}
                  className="btn-3d w-full flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 py-2.5 px-4 font-display text-xs font-semibold text-white/80 hover:bg-white/10 transition-all cursor-pointer"
                >
                  <span>Acceso Desarrollador (Pruebas)</span>
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    )
  }

  // Main Lobby Layout with PlayerProvider wrapping everything except GameEngine and Landing
  return (
    <PlayerProvider>
      <main className="cyber-bg min-h-screen w-full">
        {/* Fixed left sidebar (desktop) */}
        <Sidebar currentScreen={screen} onNavigate={(s) => setScreenAndRef(s as Screen)} />

        {/* Content area: offset for the fixed sidebar on desktop, with safe areas for mobile */}
        <div className="flex min-h-screen flex-col gap-5 px-4 pb-[max(6rem,calc(5.5rem+env(safe-area-inset-bottom,0px)))] pt-safe pt-2 sm:px-6 md:gap-6 md:pb-6 md:pl-[19.5rem] md:pr-6">
          {screen === 'lobby' && (
            <TopBar onSettingsOpen={() => setIsSettingsOpen(true)} onStoreOpen={() => setScreenAndRef('tienda')} />
          )}

          {renderScreen()}
        </div>

        {/* Bottom navigation (mobile) */}
        <MobileNav currentScreen={screen} onNavigate={(s) => setScreenAndRef(s as Screen)} />

        {/* Modals */}
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)} 
          onNavigateToLanding={handleNavigateToLanding}
        />
        <LoginModal 
          isOpen={isLoginModalOpen} 
          onClose={() => setIsLoginModalOpen(false)} 
          onLoginGoogle={handleLoginGoogle}
          onLoginDev={handleLoginDev}
        />

        {/* Modal de Desafío a Duelo Entrante en Tiempo Real */}
        {incomingChallenge && (
          <DuelChallengeModal 
            challenge={incomingChallenge}
            onAccept={handleAcceptDuel}
            onReject={handleRejectDuel}
          />
        )}

        {/* Modal Propio Cyber Candy para Confirmación de Salida con Escape */}
        {isExitModalOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
            <div 
              className="fixed inset-0 bg-black/80 backdrop-blur-md animate-in fade-in"
              onClick={() => setIsExitModalOpen(false)}
            />
            <div className="relative z-10 flex flex-col items-center max-w-sm w-full glass rounded-3xl p-6 border border-[var(--candy-magenta)]/50 shadow-[0_0_40px_rgba(255,34,119,0.3)] text-center animate-in zoom-in-95">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-[var(--candy-magenta)] shadow-[0_0_20px_rgba(255,34,119,0.6)] mb-3.5">
                <span className="font-display text-3xl font-extrabold text-white">S</span>
              </div>
              <h2 className="font-display text-xl font-black text-white tracking-wide mb-1">
                ¿DESEAS SALIR DEL JUEGO?
              </h2>
              <p className="text-xs text-white/70 font-medium mb-5">
                Se cerrará la aplicación oficial de Sugar Ludo.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={() => setIsExitModalOpen(false)}
                  className="btn-3d flex-1 rounded-2xl border border-white/20 bg-white/10 py-3 font-display text-xs font-extrabold text-white hover:bg-white/20 transition-all cursor-pointer"
                >
                  CANCELAR
                </button>
                <button
                  onClick={() => {
                    const electronAuth = (typeof window !== 'undefined' ? (window as any).electronAuth : null)
                    if (electronAuth?.quitApp) {
                      electronAuth.quitApp()
                    } else if (typeof window !== 'undefined') {
                      window.close()
                    }
                  }}
                  className="btn-3d flex-1 rounded-2xl bg-[linear-gradient(135deg,var(--candy-magenta),#ff0055)] py-3 font-display text-xs font-extrabold text-white shadow-lg cursor-pointer"
                >
                  SALIR DEL JUEGO
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </PlayerProvider>
  )
}

// Envuelve el componente en AuthProvider y VoiceProvider
export default function Page() {
  return (
    <AuthProvider>
      <VoiceProvider>
        <PageContent />
      </VoiceProvider>
    </AuthProvider>
  )
}
