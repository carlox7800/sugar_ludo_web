'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { doc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from './firebase'
import { useAuth } from './auth-context'

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
  const { user } = useAuth()
  
  const [coins, setCoinsState] = useState(200)
  const [gems, setGemsState] = useState(0) // Mapped from 'diamonds' in Firestore
  const [level, setLevel] = useState(1)
  const [xp, setXp] = useState(0)
  const [xpMax] = useState(3000)

  useEffect(() => {
    if (user && user.uid && !user.isDev) {
      // Real user logged in via Firebase: subscribe to Firestore user document
      const userRef = doc(db, 'users', user.uid)
      const unsubscribe = onSnapshot(
        userRef, 
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data()
            if (typeof data.coins === 'number') {
              setCoinsState(data.coins)
              if (typeof window !== 'undefined') {
                localStorage.setItem('sugar_player_coins', data.coins.toString())
              }
            }
            if (typeof data.diamonds === 'number') setGemsState(data.diamonds)
            if (typeof data.level === 'number') setLevel(data.level)
            if (typeof data.xp === 'number') setXp(data.xp)
          }
        },
        (error) => {
          console.warn('Firestore player snapshot error (handled):', error.message)
        }
      )

      // Escuchar evento instantáneo de reseteo económico vía BroadcastChannel
      let channel: BroadcastChannel | null = null
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          channel = new BroadcastChannel('sugar_ludo_social_channel')
          channel.onmessage = (event) => {
            if (event.data?.type === 'economic_reset_executed') {
              if (event.data.scope === 'total_hard_reset' || event.data.scope === 'players_only') {
                setCoinsState(0)
                localStorage.setItem('sugar_player_coins', '0')
              }
            }
          }
        }
      } catch {}

      return () => {
        unsubscribe()
        if (channel) channel.close()
      }
    } else {
      // Dev mode or unauthenticated fallback
      const savedCoins = localStorage.getItem('sugar_player_coins')
      const savedGems = localStorage.getItem('sugar_player_gems')
      
      setCoinsState(savedCoins ? parseInt(savedCoins, 10) : 1450)
      setGemsState(savedGems ? parseInt(savedGems, 10) : 45)
      setLevel(13)
      setXp(2340)
    }
  }, [user])

  const setCoins = async (amount: number) => {
    setCoinsState(amount)
    if (user && !user.isDev) {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, { coins: amount })
    } else {
      localStorage.setItem('sugar_player_coins', amount.toString())
    }
  }

  const setGems = async (amount: number) => {
    setGemsState(amount)
    if (user && !user.isDev) {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, { diamonds: amount })
    } else {
      localStorage.setItem('sugar_player_gems', amount.toString())
    }
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
