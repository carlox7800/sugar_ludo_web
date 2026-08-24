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
import { LogIn } from 'lucide-react'

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
  const { user, loginWithGoogle, loginDev, setNickname } = useAuth()
  const { leaveVoiceRoom } = useVoiceChat()
  const [isNative, setIsNative] = useState(false)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Pre-warm Store & Collection Assets Cache
      preloadStoreAssets()

      const capacitor = (window as any).Capacitor;
      const isCapacitor = capacitor && (
        (capacitor.isNativePlatform && capacitor.isNativePlatform()) || 
        (capacitor.getPlatform && capacitor.getPlatform() !== 'web')
      );
      const isElectron = window.navigator.userAgent.includes('Electron') || window.location.protocol === 'file:' || window.location.protocol === 'app:'
      setIsNative(!!isCapacitor || !!isElectron)

      // Restore Visual Theme
      const savedTheme = localStorage.getItem('sugar_app_theme')
      if (savedTheme === 'sugar') {
        document.documentElement.classList.add('theme-sugar')
      } else {
        document.documentElement.classList.remove('theme-sugar')
      }
    }
  }, [])
  
  // Decide initial screen based on PWA environment and Auth
  const [screen, setScreen] = useState<Screen>('landing')
  const screenRef = useRef<Screen>('landing')
  const setScreenAndRef = (s: Screen) => {
    globalLogger.nav(screenRef.current, s)
    if (s !== 'online-game' && s !== 'online-training' && (screenRef.current === 'online-game' || screenRef.current === 'online-training')) {
      leaveVoiceRoom(true)
    }
    screenRef.current = s
    setScreen(s)
  }
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [onlineGameData, setOnlineGameData] = useState<OnlineGameData | null>(null)
  const [onlineGameOrigin, setOnlineGameOrigin] = useState<Screen>('lobby')
  
  // UI States
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [incomingChallenge, setIncomingChallenge] = useState<DuelChallengeItem | null>(null)

  const [duelAutoJoinCode, setDuelAutoJoinCode] = useState<string | null>(null)

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
      <main className="cyber-bg min-h-screen w-full flex flex-col items-center justify-center p-6 text-center">
        <div className="flex flex-col items-center max-w-md w-full glass rounded-3xl p-8 border border-[var(--candy-magenta)]/30 shadow-2xl">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--candy-magenta)] shadow-[0_0_20px_rgba(255,34,119,0.5)] mb-4">
            <span className="font-display text-4xl font-extrabold text-white">S</span>
          </div>
          <h1 className="font-display text-3xl font-extrabold text-white tracking-tight mb-2">
            SUGAR <span className="text-[var(--candy-cyan)]">LUDO</span>
          </h1>
          <p className="text-sm text-muted-foreground font-semibold mb-6">
            Bienvenido a la App Oficial. Inicia sesión para entrar al Arena.
          </p>

          <button
            onClick={() => setIsLoginModalOpen(true)}
            className="btn-3d w-full flex items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,var(--candy-magenta),var(--candy-cyan))] py-4 font-display text-lg font-extrabold text-white shadow-lg"
          >
            <LogIn className="size-5" />
            INICIAR SESIÓN
          </button>
        </div>

        <LoginModal 
          isOpen={isLoginModalOpen} 
          onClose={() => setIsLoginModalOpen(false)} 
          onLoginGoogle={handleLoginGoogle}
          onLoginDev={handleLoginDev}
        />
      </main>
    )
  }

  // Main Lobby Layout with PlayerProvider wrapping everything except GameEngine and Landing
  return (
    <PlayerProvider>
      <main className="cyber-bg min-h-screen w-full">
        {/* Fixed left sidebar (desktop) */}
        <Sidebar currentScreen={screen} onNavigate={(s) => setScreenAndRef(s as Screen)} />

        {/* Content area: offset for the fixed sidebar on desktop */}
        <div className="flex min-h-screen flex-col gap-5 px-4 pb-24 pt-4 sm:px-6 md:gap-6 md:pb-6 md:pl-[19.5rem] md:pr-6">
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
