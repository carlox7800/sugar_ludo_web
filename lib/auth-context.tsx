'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithCredential,
  User as FirebaseUser
} from 'firebase/auth'
import { Capacitor } from '@capacitor/core'
import { FirebaseAuthentication } from '@capacitor-firebase/authentication'
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  serverTimestamp,
  increment 
} from 'firebase/firestore'
import { auth, db, googleProvider } from './firebase'
import { recordWalletTransaction } from './wallet-service'

export interface User {
  uid: string
  displayName: string | null
  email: string | null
  photoURL: string | null
  nickname: string | null
  nicknameUpdatedAt: number | null
  walletAddress?: string | null
  coins?: number
  diamonds?: number
  gems?: number
  inbox?: any[]
  walletHistory?: any[]
  xp?: number
  level?: number
  totalWins?: number
  totalLosses?: number
  totalGames?: number
  rankPoints?: number
  winStreak?: number
  isDev?: boolean
}

interface AuthState {
  user: User | null
  loginWithGoogle: () => Promise<void>
  loginDev: () => void
  logout: () => Promise<void>
  setNickname: (nickname: string) => Promise<void>
  setAvatar: (photoURL: string, deleteUrl?: string) => Promise<void>
  setWalletAddress: (address: string) => Promise<void>
  deductCoins: (amount: number) => Promise<boolean>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    // Listen to Firebase Auth state
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // User is logged in via Firebase
        const userRef = doc(db, 'users', firebaseUser.uid)
        let unsubscribeSnapshot: (() => void) | null = null

        const startUserListener = () => {
          if (typeof document !== 'undefined' && document.hidden) return
          if (unsubscribeSnapshot) return

          unsubscribeSnapshot = onSnapshot(
            userRef,
            (docSnap) => {
              if (docSnap.exists()) {
                const data = docSnap.data()
                const diamondsVal = Number(data.diamonds ?? 0)
                setUser({
                  uid: firebaseUser.uid,
                  displayName: firebaseUser.displayName,
                  email: firebaseUser.email,
                  photoURL: data.photoURL || firebaseUser.photoURL || '1',
                  nickname: data.nickname || null,
                  nicknameUpdatedAt: data.nicknameUpdatedAt || null,
                  walletAddress: data.walletAddress || data.usdtAddress || (typeof window !== 'undefined' ? localStorage.getItem('sugar_user_wallet_address') : null),
                  coins: data.coins ?? 200,
                  diamonds: diamondsVal,
                  gems: diamondsVal,
                  inbox: Array.isArray(data.inbox) ? data.inbox : [],
                  walletHistory: Array.isArray(data.walletHistory) ? data.walletHistory : [],
                  xp: data.xp ?? 0,
                  level: data.level ?? 1,
                  totalWins: data.totalWins ?? 0,
                  totalLosses: data.totalLosses ?? 0,
                  totalGames: data.totalGames ?? 0,
                  rankPoints: data.rankPoints ?? 0,
                  winStreak: data.winStreak ?? 0,
                  isDev: false,
                })
              } else {
                setUser(prev => {
                  if (prev && prev.uid === firebaseUser.uid) {
                    return prev
                  }
                  return null
                })
              }
              setIsLoaded(true)
            },
            (error) => {
              console.warn('Firestore auth snapshot error (handled):', error.message)
              setIsLoaded(true)
            }
          )
        }

        const handleVisibilityChange = () => {
          if (document.hidden) {
            if (unsubscribeSnapshot) {
              unsubscribeSnapshot()
              unsubscribeSnapshot = null
            }
          } else {
            startUserListener()
          }
        }

        startUserListener()
        if (typeof document !== 'undefined') {
          document.addEventListener('visibilitychange', handleVisibilityChange)
        }

        return () => {
          if (unsubscribeSnapshot) unsubscribeSnapshot()
          if (typeof document !== 'undefined') {
            document.removeEventListener('visibilitychange', handleVisibilityChange)
          }
        }
      } else {
        // Not logged in via Firebase Auth, check if there's a Dev user in localStorage
        const savedUser = localStorage.getItem('sugar_auth_user')
        if (savedUser) {
          try {
            const parsed = JSON.parse(savedUser)
            if (parsed.isDev) {
              setUser(parsed)
            } else {
              setUser(prev => (prev?.isDev ? null : prev))
            }
          } catch {
            setUser(null)
          }
        } else {
          // Prevent eviction if user was actively logged in and Auth state flickered
          setUser(prev => {
            if (prev) {
              console.warn('Firebase Auth state reported null for user, preserving active session:', prev.uid)
              return prev
            }
            return null
          })
        }
        setIsLoaded(true)
      }
    })

    return () => unsubscribeAuth()
  }, [])

  const saveDevUser = (newUser: User | null) => {
    setUser(newUser)
    if (newUser) {
      localStorage.setItem('sugar_auth_user', JSON.stringify(newUser))
    } else {
      localStorage.removeItem('sugar_auth_user')
    }
  }

  const loginWithGoogle = async () => {
    try {
      const isNative = typeof window !== 'undefined' && Capacitor.isNativePlatform()

      let firebaseUser: FirebaseUser | null = null

      if (isNative) {
        // En Android/iOS nativo: Abre el selector de cuentas del sistema operativo
        console.log('[Auth] Ejecutando FirebaseAuthentication.signInWithGoogle() nativo...')
        const result = await FirebaseAuthentication.signInWithGoogle()
        console.log('[Auth] Resultado recibido de FirebaseAuthentication:', JSON.stringify(result))

        if (result?.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(result.credential.idToken)
          const userCredential = await signInWithCredential(auth, credential)
          firebaseUser = userCredential.user
        } else {
          throw new Error(`Google Nativo no devolvió idToken (Resultado: ${JSON.stringify(result)})`)
        }
      } else {
        // En Web / Desktop
        const result = await signInWithPopup(auth, googleProvider)
        firebaseUser = result.user
      }

      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid)
        const docSnap = await getDoc(userRef)

        if (!docSnap.exists()) {
          // New user default state in Firestore
          const newUserData = {
            nickname: null,
            nicknameUpdatedAt: null,
            photoURL: '1',
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            createdAt: serverTimestamp(),
            coins: 200,
            diamonds: 0,
            level: 1,
            xp: 0,
            unlockedSkins: ['classic'],
            selectedSkin: 'classic',
            totalWins: 0,
            totalLosses: 0,
            totalGames: 0,
            rankPoints: 0,
          }
          await setDoc(userRef, newUserData)
        }

        // Clear any dev user session from local storage
        localStorage.removeItem('sugar_auth_user')
      }
    } catch (error: any) {
      console.error('[Auth] Error initiating Google Login:', error)
      const errorMsg = error?.message || error?.code || (typeof error === 'string' ? error : JSON.stringify(error))
      throw new Error(errorMsg || 'Fallo desconocido al conectar con Google')
    }
  }

  const loginDev = () => {
    const devUser: User = {
      uid: 'dev_user_999',
      displayName: 'Dev Tester',
      email: 'dev@sugar.com',
      photoURL: '1',
      nickname: null,
      nicknameUpdatedAt: null,
      isDev: true,
    }
    saveDevUser(devUser)
  }

  const logout = async () => {
    if (user?.isDev) {
      saveDevUser(null)
    } else {
      if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
        try {
          await FirebaseAuthentication.signOut()
        } catch (e) {
          console.warn('Native signOut warning:', e)
        }
      }
      await signOut(auth)
      setUser(null)
    }
  }

  const setNickname = async (nickname: string) => {
    if (!user) return
    const timestamp = Date.now()

    if (user.isDev) {
      const updatedUser = { ...user, nickname, nicknameUpdatedAt: timestamp }
      saveDevUser(updatedUser)
    } else {
      const userRef = doc(db, 'users', user.uid)
      await updateDoc(userRef, {
        nickname,
        nicknameUpdatedAt: timestamp,
      })
    }
  }

  const setAvatar = async (photoURL: string, deleteUrl?: string) => {
    if (!user) return

    if (user.isDev) {
      const updatedUser = { ...user, photoURL }
      saveDevUser(updatedUser)
    } else {
      const userRef = doc(db, 'users', user.uid)
      
      // Intentar borrado silencioso de imagen anterior en ImgBB si existe
      try {
        const userDoc = await getDoc(userRef)
        if (userDoc.exists()) {
          const oldDeleteUrl = userDoc.data().avatarDeleteUrl
          if (oldDeleteUrl) {
            fetch(oldDeleteUrl).catch(() => {})
          }
        }
      } catch (e) {
        console.warn('No se pudo borrar avatar anterior:', e)
      }

      await updateDoc(userRef, {
        photoURL,
        ...(deleteUrl ? { avatarDeleteUrl: deleteUrl } : {}),
      })
    }
  }

  const setWalletAddress = async (address: string) => {
    if (!user) return
    const cleanAddress = address.trim()

    if (user.isDev) {
      const updatedUser = { ...user, walletAddress: cleanAddress }
      saveDevUser(updatedUser)
    } else {
      try {
        const userRef = doc(db, 'users', user.uid)
        await updateDoc(userRef, {
          walletAddress: cleanAddress,
          usdtAddress: cleanAddress
        })
      } catch (err) {
        console.warn('Error actualizando walletAddress en Firestore:', err)
      }
    }

    setUser((prev) => (prev ? { ...prev, walletAddress: cleanAddress } : null))
    if (typeof window !== 'undefined') {
      localStorage.setItem('sugar_user_wallet_address', cleanAddress)
    }
  }

  const deductCoins = async (amount: number): Promise<boolean> => {
    if (!user) return false
    if ((user.coins ?? 200) < amount) return false

    if (user.isDev) {
      const updatedUser = { ...user, coins: (user.coins ?? 200) - amount }
      saveDevUser(updatedUser)
      return true
    } else {
      try {
        const userRef = doc(db, 'users', user.uid)
        await updateDoc(userRef, {
          coins: (user.coins ?? 200) - amount
        })
        
        await recordWalletTransaction(user.uid, {
          type: 'match_fee',
          amount: -amount,
          description: 'Entrada Mesa Competitiva'
        }, true) // skipCoinUpdate = true

        return true
      } catch (error) {
        console.error('Error al debitar monedas:', error)
        return false
      }
    }
  }

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
        setWalletAddress,
        deductCoins,
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
