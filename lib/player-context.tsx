'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface PlayerState {
  coins: number
  gems: number
  level: number
  xp: number
  xpMax: number
  setCoins: (amount: number) => void
  setGems: (amount: number) => void
}

const PlayerContext = createContext<PlayerState | undefined>(undefined)

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const [coins, setCoinsState] = useState(1450)
  const [gems, setGemsState] = useState(45)
  const [level, setLevel] = useState(13)
  const [xp, setXp] = useState(2340)
  const [xpMax, setXpMax] = useState(3000)

  // Initialize from local storage on first mount
  useEffect(() => {
    const savedCoins = localStorage.getItem('sugar_player_coins')
    const savedGems = localStorage.getItem('sugar_player_gems')
    
    if (savedCoins) setCoinsState(parseInt(savedCoins, 10))
    if (savedGems) setGemsState(parseInt(savedGems, 10))
  }, [])

  const setCoins = (amount: number) => {
    setCoinsState(amount)
    localStorage.setItem('sugar_player_coins', amount.toString())
  }

  const setGems = (amount: number) => {
    setGemsState(amount)
    localStorage.setItem('sugar_player_gems', amount.toString())
  }

  return (
    <PlayerContext.Provider
      value={{
        coins,
        gems,
        level,
        xp,
        xpMax,
        setCoins,
        setGems,
      }}
    >
      {children}
    </PlayerContext.Provider>
  )
}

export function usePlayer() {
  const context = useContext(PlayerContext)
  if (context === undefined) {
    throw new Error('usePlayer must be used within a PlayerProvider')
  }
  return context
}
