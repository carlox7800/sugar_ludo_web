'use client'

import { useState, useEffect } from 'react'
import { Sidebar, MobileNav } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { ProfileCard } from '@/components/profile-card'
import { GameModes } from '@/components/game-modes'
import { AiTraining } from '@/components/ai-training'
import { OnlineTraining } from '@/components/online-training'
import { ProfileModal } from '@/components/profile-modal'
import { SettingsModal } from '@/components/settings-modal'
import GameEngine from '@/src/GameEngine'
import { GameConfig } from '@/src/types'

// Screens
import { WalletScreen } from '@/screens/wallet-screen'
import { FriendsScreen } from '@/screens/friends-screen'
import { StoreScreen } from '@/screens/store-screen'
import { EventsScreen } from '@/screens/events-screen'
import { MailScreen } from '@/screens/mail-screen'
import { CollectionScreen } from '@/screens/collection-screen'
import { LandingPage } from '@/screens/landing-page'

// Contexts & Modals
import { PlayerProvider } from '@/lib/player-context'
import { AuthProvider, useAuth } from '@/lib/auth-context'
import { LoginModal } from '@/components/login-modal'
import { NicknameSetupModal } from '@/components/nickname-setup-modal'

export type Screen =
  | 'landing'
  | 'lobby'
  | 'training'
  | 'online-training'
  | 'game'
  | 'tienda'
  | 'billetera'
  | 'amigos'
  | 'eventos'
  | 'correo'
  | 'coleccion'

function PageContent() {
  const { user, loginWithGoogle, loginDev, setNickname } = useAuth()
  
  // Decide initial screen based on auth
  const [screen, setScreen] = useState<Screen>('landing')
  const [config, setConfig] = useState<GameConfig | null>(null)
  
  // UI States
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)

  // Auth routing logic
  useEffect(() => {
    if (user) {
      if (!user.nickname) {
        // Logged in but needs nickname
        setIsLoginModalOpen(false)
      } else {
        // Logged in and has nickname
        if (screen === 'landing') {
          setScreen('lobby')
        }
      }
    } else {
      // Not logged in
      setScreen('landing')
    }
  }, [user, screen])

  const handleStartGame = (gameConfig: GameConfig) => {
    setConfig(gameConfig)
    setScreen('game')
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
            <OnlineTraining onBack={() => setScreen('lobby')} />
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

  // Landing Page (Isolated)
  if (screen === 'landing') {
    return (
      <>
        <LandingPage onLoginClick={() => setIsLoginModalOpen(true)} />
        <LoginModal 
          isOpen={isLoginModalOpen} 
          onClose={() => setIsLoginModalOpen(false)} 
          onLoginGoogle={handleLoginGoogle}
          onLoginDev={handleLoginDev}
        />
      </>
    )
  }

  // Game Engine runs independently outside the Lobby layout
  if (screen === 'game' && config) {
    return <GameEngine initialConfig={config} onExit={() => setScreen('training')} />
  }

  // Main Lobby Layout with PlayerProvider wrapping everything except GameEngine and Landing
  return (
    <PlayerProvider>
      <main className="cyber-bg min-h-screen w-full">
        {/* Fixed left sidebar (desktop) */}
        <Sidebar currentScreen={screen} onNavigate={(s) => setScreen(s as Screen)} />

        {/* Content area: offset for the fixed sidebar on desktop */}
        <div className="flex min-h-screen flex-col gap-5 px-4 pb-24 pt-4 sm:px-6 md:gap-6 md:pb-6 md:pl-[19.5rem] md:pr-6">
          <TopBar onSettingsOpen={() => setIsSettingsOpen(true)} />

          {renderScreen()}
        </div>

        {/* Bottom navigation (mobile) */}
        <MobileNav currentScreen={screen} onNavigate={(s) => setScreen(s as Screen)} />

        {/* Modals */}
        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
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
