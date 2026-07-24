'use client'

import { useState } from 'react'
import { Sidebar, MobileNav } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { ProfileCard } from '@/components/profile-card'
import { GameModes } from '@/components/game-modes'
import { AiTraining } from '@/components/ai-training'
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
import { PlayerProvider } from '@/lib/player-context'

export type Screen =
  | 'lobby'
  | 'training'
  | 'game'
  | 'tienda'
  | 'billetera'
  | 'amigos'
  | 'eventos'
  | 'correo'
  | 'coleccion'

export default function Page() {
  const [screen, setScreen] = useState<Screen>('lobby')
  const [config, setConfig] = useState<GameConfig | null>(null)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const handleStartGame = (gameConfig: GameConfig) => {
    setConfig(gameConfig)
    setScreen('game')
  }

  // Render the active screen
  const renderScreen = () => {
    switch (screen) {
      case 'lobby':
        return (
          <div className="grid flex-1 gap-5 lg:gap-6 xl:grid-cols-[340px_1fr]">
            <ProfileCard onOpen={() => setIsProfileOpen(true)} />
            <GameModes onStartTraining={() => setScreen('training')} />
          </div>
        )
      case 'training':
        return (
          <div className="mx-auto w-full max-w-3xl flex-1">
            <AiTraining onBack={() => setScreen('lobby')} onStartGame={handleStartGame} />
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

  // Game Engine runs independently outside the Lobby layout
  if (screen === 'game' && config) {
    return <GameEngine initialConfig={config} onExit={() => setScreen('training')} />
  }

  // Main Lobby Layout with PlayerProvider wrapping everything except GameEngine
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
