'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export interface User {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  nickname: string | null
  nicknameUpdatedAt: number | null
}

interface AuthState {
  user: User | null
  loginWithGoogle: () => void
  loginDev: () => void
  logout: () => void
  setNickname: (nickname: string) => void
  setAvatar: (photoURL: string) => void
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    const savedUser = localStorage.getItem('sugar_auth_user')
    if (savedUser) {
      setUser(JSON.parse(savedUser))
    }
    setIsLoaded(true)
  }, [])

  const saveUser = (newUser: User | null) => {
    setUser(newUser)
    if (newUser) {
      localStorage.setItem('sugar_auth_user', JSON.stringify(newUser))
    } else {
      localStorage.removeItem('sugar_auth_user')
    }
  }

  const loginWithGoogle = () => {
    // Placeholder for real Firebase integration
    const mockUser: User = {
      uid: 'google_user_123',
      displayName: 'Jugador Google',
      email: 'jugador@gmail.com',
      photoURL: null, // Will use default or ask
      nickname: null,
      nicknameUpdatedAt: null,
    }
    saveUser(mockUser)
  }

  const loginDev = () => {
    const mockUser: User = {
      uid: 'dev_user_999',
      displayName: 'Dev Tester',
      email: 'dev@sugar.com',
      photoURL: '1', // Default avatar ID
      nickname: null, // Let them set it up
      nicknameUpdatedAt: null,
    }
    saveUser(mockUser)
  }

  const logout = () => {
    saveUser(null)
  }

  const setNickname = (nickname: string) => {
    if (user) {
      const updatedUser = { 
        ...user, 
        nickname, 
        nicknameUpdatedAt: Date.now() 
      }
      saveUser(updatedUser)
    }
  }

  const setAvatar = (photoURL: string) => {
    if (user) {
      const updatedUser = {
        ...user,
        photoURL
      }
      saveUser(updatedUser)
    }
  }

  // Prevent hydration mismatch by not rendering until loaded
  if (!isLoaded) return null

  return (
    <AuthContext.Provider
      value={{
        user,
        loginWithGoogle,
        loginDev,
        logout,
        setNickname,
        setAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
