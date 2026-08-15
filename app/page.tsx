'use client'

import { useState, useEffect } from 'react'
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
import { LoginModal } from '@/components/login-modal'
import { NicknameSetupModal } from '@/components/nickname-setup-modal'

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
  const [isNative, setIsNative] = useState(false)
  
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const capacitor = (window as any).Capacitor;
      const isCapacitor = capacitor && (
        (capacitor.isNativePlatform && capacitor.isNativePlatform()) || 
        (capacitor.getPlatform && capacitor.getPlatform() !== 'web')
      );
      const isElectron = window.navigator.userAgent.includes('Electron') || window.location.protocol === 'file:' || window.location.protocol === 'app:'
      setIsNative(!!isCapacitor || !!isElectron)
    }
  }, [])
  
  // Decide initial screen based on PWA environment and Auth
  const [screen, setScreen] = useState<Screen>('landing')
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [onlineGameData, setOnlineGameData] = useState<OnlineGameData | null>(null)
  const [onlineGameOrigin, setOnlineGameOrigin] = useState<Screen>('online-training')
  
  // UI States
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  const [forceWebMode, setForceWebMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sugar_force_web_mode') === 'true'
    }
    return false
  })

  // Auth & Native routing logic
  useEffect(() => {
    // CORTAFUEGOS DE PARTIDA: Durante una partida activa, NUNCA redirigir a landing ni a lobby
    if (screen === 'online-game' || screen === 'game') {
      return
    }

    // REGLA 1: Si se está accediendo desde un navegador web normal y no se ha activado modo web, se fuerza la Landing Page informativa
    if (!isNative && !forceWebMode) {
      setScreen('landing')
      return
    }

    // REGLA 2: Si es la App Instalada (Standalone PWA) o Modo Web Forzado
    if (user) {
      if (user.nickname) {
        // Usuario logueado con nickname -> Ir al Lobby (salvo que ya esté en partida o pantalla específica)
        if (screen === 'landing') {
          setScreen('lobby')
        }
        setIsLoginModalOpen(false)
      }
    } else {
      // Usuario no logueado en App instalada o Modo Web -> Abrir inmediatamente el modal de Login
      setIsLoginModalOpen(true)
    }
  }, [user, screen, isNative, forceWebMode])

  const handleStartGame = (gameConfig: GameConfig) => {
    setConfig(gameConfig)
    setScreen('game')
  }

  const handleMatchFound = (gameData: OnlineGameData, origin: Screen = 'online-training') => {
    setOnlineGameData(gameData)
    setOnlineGameOrigin(origin)
    setScreen('online-game')
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
      setScreen('lobby')
    }} />
  }

  const handleNavigateToLanding = () => {
    setIsSettingsOpen(false)
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sugar_force_web_mode')
    }
    setForceWebMode(false)
    setScreen('landing')
  }

  // Render the active screen (Lobby-related)
  const renderScreen = () => {
    switch (screen) {
      case 'lobby':
        return (
          <div className="grid flex-1 gap-5 lg:gap-6 xl:grid-cols-[340px_1fr]">
            <ProfileCard onOpen={() => setIsProfileOpen(true)} />
            <GameModes 
              onStartTraining={() => setScreen('training')} 
              onStartOnlineTraining={() => setScreen('online-training')} 
              onStartCompetitive={() => setScreen('competitive')}
            />
          </div>
        )
      case 'training':
        return (
          <div className="mx-auto w-full max-w-3xl flex-1">
            <AiTraining onBack={() => setScreen('lobby')} onStartGame={handleStartGame} />
          </div>
        )
      case 'online-training':
        return (
          <div className="mx-auto w-full max-w-3xl flex-1">
            <OnlineTraining 
              onBack={() => setScreen('lobby')} 
              onMatchFound={(data) => handleMatchFound(data, 'online-training')}
            />
          </div>
        )
      case 'competitive':
        return (
          <div className="mx-auto w-full max-w-3xl flex-1">
            <CompetitiveTraining 
              onBack={() => setScreen('lobby')} 
              onMatchFound={(data) => handleMatchFound(data, 'competitive')}
            />
          </div>
        )
      case 'billetera':
        return <WalletScreen onBack={() => setScreen('lobby')} />
      case 'amigos':
        return <FriendsScreen onBack={() => setScreen('lobby')} />
      case 'tienda':
        return <StoreScreen onBack={() => setScreen('lobby')} />
      case 'eventos':
        return <EventsScreen onBack={() => setScreen('lobby')} />
      case 'correo':
        return <MailScreen onBack={() => setScreen('lobby')} />
      case 'coleccion':
        return <CollectionScreen onBack={() => setScreen('lobby')} />
      default:
        return null
    }
  }

  // Offline Game Engine runs independently outside the Lobby layout
  if (screen === 'game' && config) {
    return <GameEngine initialConfig={config} onExit={() => setScreen('training')} />
  }

  // Online Game Engine runs independently outside the Lobby layout
  if (screen === 'online-game' && onlineGameData) {
    return (
      <OnlineGameEngine 
        gameData={onlineGameData} 
        modeType={onlineGameOrigin === 'competitive' ? 'competitive' : 'training'}
        onExit={() => {
          setOnlineGameData(null)
          setScreen(onlineGameOrigin)
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
        <Sidebar currentScreen={screen} onNavigate={(s) => setScreen(s as Screen)} />

        {/* Content area: offset for the fixed sidebar on desktop */}
        <div className="flex min-h-screen flex-col gap-5 px-4 pb-24 pt-4 sm:px-6 md:gap-6 md:pb-6 md:pl-[19.5rem] md:pr-6">
          <TopBar onSettingsOpen={() => setIsSettingsOpen(true)} onStoreOpen={() => setScreen('tienda')} />

          {renderScreen()}
        </div>

        {/* Bottom navigation (mobile) */}
        <MobileNav currentScreen={screen} onNavigate={(s) => setScreen(s as Screen)} />

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
      </main>
    </PlayerProvider>
  )
}

// Envuelve el componente en AuthProvider para poder usar el hook useAuth
export default function Page() {
  return (
    <AuthProvider>
      <PageContent />
    </AuthProvider>
  )
}
