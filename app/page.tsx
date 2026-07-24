'use client'

import { useState } from 'react'
import { Sidebar, MobileNav } from '@/components/sidebar'
import { TopBar } from '@/components/top-bar'
import { ProfileCard } from '@/components/profile-card'
import { GameModes } from '@/components/game-modes'
import { AiTraining } from '@/components/ai-training'
import GameEngine from '@/src/GameEngine'
import { GameConfig } from '@/src/types'

export default function Page() {
  const [view, setView] = useState<'lobby' | 'training' | 'game'>('lobby')
  const [config, setConfig] = useState<GameConfig | null>(null)

  const handleStartGame = (gameConfig: GameConfig) => {
    setConfig(gameConfig)
    setView('game')
  }

  if (view === 'game' && config) {
    return <GameEngine initialConfig={config} onExit={() => setView('training')} />
  }

  return (
    <main className="cyber-bg min-h-screen w-full">
      {/* Fixed left sidebar (desktop) */}
      <Sidebar />

      {/* Content area: offset for the fixed sidebar on desktop */}
      <div className="flex min-h-screen flex-col gap-5 px-4 pb-24 pt-4 sm:px-6 md:gap-6 md:pb-6 md:pl-[19.5rem] md:pr-6">
        <TopBar />

        {view === 'lobby' ? (
          <div className="grid flex-1 gap-5 lg:gap-6 xl:grid-cols-[340px_1fr]">
            <ProfileCard />
            <GameModes onStartTraining={() => setView('training')} />
          </div>
        ) : (
          <div className="mx-auto w-full max-w-3xl flex-1">
            <AiTraining onBack={() => setView('lobby')} onStartGame={handleStartGame} />
          </div>
        )}
      </div>

      {/* Bottom navigation (mobile) */}
      <MobileNav />
    </main>
  )
}
