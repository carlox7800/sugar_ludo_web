'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { AdminUserProfile, CashierManagementProfile } from '../types/admin-expanded'
import { MOCK_CASHIERS_MANAGEMENT } from './mock-admin-expanded'
import { db, auth } from './firebase'
import { doc, onSnapshot, setDoc, getDoc, increment } from 'firebase/firestore'
import { signInWithCustomToken, signOut, onAuthStateChanged } from 'firebase/auth'

interface AdminAuthContextType {
  // Admin Session
  adminUser: AdminUserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (identifier: string, pass: string) => Promise<{ success: boolean; message: string }>
  loginCashier: (identifier: string, pass: string) => Promise<{ success: boolean; message: string; cashier?: CashierManagementProfile }>
  logout: (reason?: string) => void
  sessionWarning: string | null
  clearSessionWarning: () => void
  updateCurrentAdmin: (displayName: string, email: string, newPassword?: string) => Promise<boolean>
  
  // Admin Accounts Management
  adminList: AdminUserProfile[]
  createNewAdmin: (
    username: string,
    email: string,
    displayName: string,
    role: 'super_admin' | 'financial_admin' | 'support_admin',
    pass: string
  ) => Promise<{ success: boolean; message: string }>
  toggleAdminStatus: (uid: string) => void
  deleteAdminAccount: (uid: string) => { success: boolean; message: string }
  
  // Centralized Cashier Accounts Management
  cashierList: CashierManagementProfile[]
  activeCashierSession: CashierManagementProfile | null
  setActiveCashierSession: React.Dispatch<React.SetStateAction<CashierManagementProfile | null>>
  createNewCashier: (
    newCashier: CashierManagementProfile,
    pass?: string
  ) => Promise<{ success: boolean; message: string }>
  updateCashierProfile: (
    uid: string,
    updates: Partial<CashierManagementProfile>,
    newPassword?: string
  ) => Promise<{ success: boolean; message: string }>
  deleteCashierAccount: (uid: string) => { success: boolean; message: string }
  updateCashierFloat: (uid: string, newCoins: number, newUSDT?: number, paidWithdrawalDelta?: number) => void
  resetAllCashiersFloat: () => Promise<void>
}

const DEFAULT_SUPER_ADMIN: AdminUserProfile = {
  uid: 'adm_super_carlos_001',
  username: 'superadmin',
  email: 'admin@sugarludo.com',
  displayName: 'Carlos (Super Admin)',
  role: 'super_admin',
  avatarUrl: 'https://i.ibb.co/3YBC35Xm/avatar-1786744277377.jpg',
  createdAt: Date.now() - (90 * 24 * 3600 * 1000),
  lastLoginAt: Date.now(),
  isActive: true
}

const INITIAL_ADMINS: AdminUserProfile[] = [
  DEFAULT_SUPER_ADMIN,
  {
    uid: 'adm_fin_diego_002',
    username: 'diego.finanzas',
    email: 'finanzas@sugarludo.com',
    displayName: 'Diego (Admin Financiero)',
    role: 'financial_admin',
    createdAt: Date.now() - (30 * 24 * 3600 * 1000),
    lastLoginAt: Date.now() - (2 * 3600 * 1000),
    isActive: true
  }
]

const DEFAULT_CASHIER: CashierManagementProfile = {
  uid: 'csh_carlosandroid_001',
  name: 'carlosandroid (Cajero)',
  email: 'carlos.cajero@sugarludo.com',
  avatarUrl: 'https://i.ibb.co/3YBC35Xm/avatar-1786744277377.jpg',
  shiftStatus: 'on_shift',
  floatBalanceCoins: 30000,
  assignedShiftAt: Date.now(),
  lastRechargeAt: Date.now(),
  ordersCompletedToday: 0,
  commissionEarnedTodayCoins: 0,
  paymentMethodsCount: 2,
  phone: '+58 412-0000000',
  idDocument: 'V-12345678',
  role: 'cashier'
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUserProfile | null>(null)
  const [adminList, setAdminList] = useState<AdminUserProfile[]>(INITIAL_ADMINS)
  const [cashierList, setCashierList] = useState<CashierManagementProfile[]>(MOCK_CASHIERS_MANAGEMENT)
  const [activeCashierSession, setActiveCashierSession] = useState<CashierManagementProfile | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('sugar_cashier_session')
        if (saved) return JSON.parse(saved)
      } catch {}
    }
    return null
  })
  const [isLoading, setIsLoading] = useState(true)
  const [sessionWarning, setSessionWarning] = useState<string | null>(null)

  const clearSessionWarning = () => setSessionWarning(null)

  // 1. Carga inicial instantánea desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sugar_admin_session')
      const savedList = localStorage.getItem('sugar_admin_accounts')
      const savedCashiers = localStorage.getItem('sugar_cashier_accounts')
      const savedCashier = localStorage.getItem('sugar_cashier_session')

      if (savedList) {
        try {
          setAdminList(JSON.parse(savedList))
        } catch {}
      }

      if (savedCashiers) {
        try {
          const parsed = JSON.parse(savedCashiers)
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCashierList(parsed)
          }
        } catch {}
      }

      if (savedCashier) {
        try {
          setActiveCashierSession(JSON.parse(savedCashier))
        } catch {}
      }

      if (saved) {
        try {
          setAdminUser(JSON.parse(saved))
        } catch {
          localStorage.removeItem('sugar_admin_session')
        }
      }
      // Purgar cualquier residuo legacy de contraseñas almacenadas en localStorage
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i)
        if (key && (key.startsWith('sugar_cashier_pass_') || key.startsWith('sugar_admin_pass_'))) {
          localStorage.removeItem(key)
        }
      }
    } finally {
      setIsLoading(false)
    }

    // Mantener sincronizado el JWT ID Token legítimo de Firebase Auth
    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const token = await user.getIdToken()
          sessionStorage.setItem('sugar_staff_id_token', token)
          localStorage.setItem('sugar_staff_id_token', token)
        } catch {}
      } else {
        sessionStorage.removeItem('sugar_staff_id_token')
        localStorage.removeItem('sugar_staff_id_token')
      }
    })

    return () => unsubAuth()
  }, [])

  // 1.1 Control estricto de Inactividad (15 min cajeros, 30 min administradores) - Fase 1
  useEffect(() => {
    if (typeof window === 'undefined') return

    const hasAdmin = !!adminUser
    const hasCashier = !!localStorage.getItem('sugar_cashier_session')
    if (!hasAdmin && !hasCashier) return

    const timeoutMs = (!hasAdmin && hasCashier) ? 15 * 60 * 1000 : 30 * 60 * 1000

    let timeoutId: any = null
    const handleTimeout = () => {
      logout('Tu sesión se cerró por inactividad prolongada por motivos de seguridad.')
    }

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = setTimeout(handleTimeout, timeoutMs)
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    activityEvents.forEach((event) => {
      window.addEventListener(event, resetTimer, { passive: true })
    })

    resetTimer()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
      activityEvents.forEach((event) => {
        window.removeEventListener(event, resetTimer)
      })
    }
  }, [adminUser])

  // 1.2 Detección de sesión única concurrente (intra-browser BroadcastChannel)
  useEffect(() => {
    if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return
    try {
      const channel = new BroadcastChannel('sugar_ludo_social_channel')
      channel.onmessage = (event) => {
        if (event.data?.type === 'cashier_new_session_started') {
          const { cashierUid, sessionId } = event.data
          if (
            activeCashierSession &&
            activeCashierSession.uid === cashierUid &&
            activeCashierSession.sessionId &&
            activeCashierSession.sessionId !== sessionId
          ) {
            logout('Sesión invalidada: Se ha iniciado sesión desde otro dispositivo o navegador.')
          }
        }
      }
      return () => channel.close()
    } catch {}
  }, [activeCashierSession])

  // 2. Sincronización en vivo con Firestore (system_config) multiplataforma
  useEffect(() => {
    // Sincronizar Cajeros
    const cashierDocRef = doc(db, 'system_config', 'cashier_accounts')
    const unsubCashiers = onSnapshot(cashierDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (data && Array.isArray(data.accounts) && data.accounts.length > 0) {
          // Sanitizar para asegurar que ninguna contraseña en texto plano quede en cliente
          const sanitizedAccounts = data.accounts.map((c: any) => {
            const { password, ...rest } = c
            return rest as CashierManagementProfile
          })
          setCashierList(sanitizedAccounts)
          localStorage.setItem('sugar_cashier_accounts', JSON.stringify(sanitizedAccounts))

          setActiveCashierSession((prev) => {
            if (!prev) return prev
            const matched = sanitizedAccounts.find((c) => c.uid === prev.uid || (prev.email && c.email?.toLowerCase() === prev.email.toLowerCase()))
            if (matched) {
              const updated = {
                ...matched,
                uid: prev.uid,
                name: prev.name || matched.name,
                email: prev.email || matched.email,
                sessionId: prev.sessionId || (matched as any).sessionId
              }
              try {
                localStorage.setItem('sugar_cashier_session', JSON.stringify(updated))
              } catch {}
              return updated
            }
            return prev
          })
          return
        }
      }

      // Solo sembrar si explícitamente el documento no existe en absoluto y tenemos cuentas predeterminadas
      if (!snap.exists()) {
        try {
          const localSaved = typeof window !== 'undefined' ? localStorage.getItem('sugar_cashier_accounts') : null
          let initialAccounts = [DEFAULT_CASHIER]
          if (localSaved) {
            const parsed = JSON.parse(localSaved)
            if (Array.isArray(parsed) && parsed.length > 0) {
              initialAccounts = parsed
            }
          }
          setDoc(cashierDocRef, {
            accounts: initialAccounts,
            updatedAt: Date.now()
          }, { merge: true }).catch(() => {})
        } catch {}
      }
    }, (err) => {
      console.warn('[AdminAuth] Listener error cajeros:', err)
    })

    // Sincronizar Administradores
    const adminDocRef = doc(db, 'system_config', 'admin_accounts')
    const unsubAdmins = onSnapshot(adminDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (data && Array.isArray(data.accounts) && data.accounts.length > 0) {
          // Sanitizar para asegurar que ninguna contraseña en texto plano quede en cliente
          const sanitizedAdmins = data.accounts.map((a: any) => {
            const { password, ...rest } = a
            return rest as AdminUserProfile
          })
          setAdminList(sanitizedAdmins)
          localStorage.setItem('sugar_admin_accounts', JSON.stringify(sanitizedAdmins))
          return
        }
      }

      if (!snap.exists()) {
        try {
          setDoc(adminDocRef, {
            accounts: INITIAL_ADMINS,
            updatedAt: Date.now()
          }, { merge: true }).catch(() => {})
        } catch {}
      }
    }, (err) => {
      console.warn('[AdminAuth] Listener error administradores:', err)
    })

    let ch: BroadcastChannel | null = null
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        ch = new BroadcastChannel('sugar_ludo_social_channel')
        ch.onmessage = (event) => {
          const d = event.data
          if (d && (d.type === 'economic_reset_executed' || d.type === 'cashier_accounts_reset')) {
            if (d.scope === 'total_hard_reset' || d.scope === 'cashiers_only' || d.type === 'cashier_accounts_reset') {
              setCashierList((prev) => {
                const reset = prev.map((c) => ({
                  ...c,
                  floatBalanceCoins: 0,
                  floatBalanceUSDT: 0,
                  totalPaidWithdrawalsUSDT: 0,
                  initialShiftFloatUSDT: 0,
                  lastResetAt: Date.now()
                }))
                localStorage.setItem('sugar_cashier_accounts', JSON.stringify(reset))
                return reset
              })
            }
          }
        }
      } catch {}
    }

    return () => {
      unsubCashiers()
      unsubAdmins()
      if (ch) ch.close()
    }
  }, [])

  // Guardar Cajeros en Firestore de forma atómica y universal
  const persistCashiersToCloud = async (accounts: CashierManagementProfile[]) => {
    try {
      const cashierDocRef = doc(db, 'system_config', 'cashier_accounts')
      await setDoc(cashierDocRef, {
        accounts,
        updatedAt: Date.now()
      }, { merge: true })
    } catch (e) {
      console.error('[AdminAuth] Error al persistir cajeros en Firestore:', e)
    }
  }

  // Guardar Administradores en Firestore de forma atómica
  const persistAdminsToCloud = async (accounts: AdminUserProfile[]) => {
    try {
      const adminDocRef = doc(db, 'system_config', 'admin_accounts')
      await setDoc(adminDocRef, {
        accounts,
        updatedAt: Date.now()
      }, { merge: true })
    } catch (e) {
      console.error('[AdminAuth] Error al persistir administradores en Firestore:', e)
    }
  }

  // Login for Super Admin and Administrators con Firebase Auth
  const login = async (identifier: string, pass: string): Promise<{ success: boolean; message: string }> => {
    const trimmedId = identifier.trim().toLowerCase()

    try {
      // 1. Validar en backend autoritativo y obtener Custom Token
      const res = await fetch('/api/staff/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmedId,
          password: pass,
          role: 'admin'
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, message: data.error || 'Credenciales de administrador incorrectas o no autorizadas.' }
      }

      // 2. Autenticar en Firebase Auth del cliente y persistir JWT idToken
      if (data.customToken) {
        const userCred = await signInWithCustomToken(auth, data.customToken)
        const idToken = await userCred.user.getIdToken(true)
        sessionStorage.setItem('sugar_staff_id_token', idToken)
        localStorage.setItem('sugar_staff_id_token', idToken)
      }

      const foundAdmin = adminList.find(
        (a) => (a.username.toLowerCase() === trimmedId || a.email.toLowerCase() === trimmedId) && a.isActive
      ) || {
        uid: data.profile?.uid || 'adm_super_carlos_001',
        username: trimmedId.split('@')[0],
        email: data.profile?.email || 'admin@sugarludo.com',
        displayName: data.profile?.displayName || 'Administrador',
        role: data.profile?.role || 'super_admin',
        createdAt: Date.now(),
        lastLoginAt: Date.now(),
        isActive: true
      }

      const updatedAdmin = { ...foundAdmin, lastLoginAt: Date.now() }
      setAdminUser(updatedAdmin)
      localStorage.setItem('sugar_admin_session', JSON.stringify(updatedAdmin))

      return { success: true, message: '¡Acceso concedido!' }
    } catch (e: any) {
      return { success: false, message: e.message || 'Error al conectar con el servidor de autenticación.' }
    }
  }

  // Login for Authorized Cashiers con Firebase Auth
  const loginCashier = async (identifier: string, pass: string): Promise<{ success: boolean; message: string; cashier?: CashierManagementProfile }> => {
    const trimmedId = identifier.trim().toLowerCase()

    try {
      // 1. Validar en backend autoritativo y obtener Custom Token
      const res = await fetch('/api/staff/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmedId,
          password: pass,
          role: 'cashier'
        })
      })

      const data = await res.json()
      if (!res.ok || !data.success) {
        return { success: false, message: data.error || 'Credenciales de cajero incorrectas o no autorizadas.' }
      }

      // 2. Autenticar en Firebase Auth del cliente y persistir JWT idToken
      if (data.customToken) {
        const userCred = await signInWithCustomToken(auth, data.customToken)
        const idToken = await userCred.user.getIdToken(true)
        sessionStorage.setItem('sugar_staff_id_token', idToken)
        localStorage.setItem('sugar_staff_id_token', idToken)
      }

      const authProfile = data.profile || {}
      let foundCashier = cashierList.find(
        (c) => (authProfile.uid && c.uid?.toLowerCase() === authProfile.uid.toLowerCase()) ||
               (c.email && c.email.toLowerCase() === trimmedId) ||
               (c.uid && c.uid.toLowerCase() === trimmedId)
      )

      if (foundCashier) {
        foundCashier = {
          ...foundCashier,
          uid: authProfile.uid || foundCashier.uid,
          email: authProfile.email || foundCashier.email,
          name: authProfile.displayName || foundCashier.name,
          sessionId: data.sessionId || (foundCashier as any).sessionId
        }
      } else {
        foundCashier = {
          ...DEFAULT_CASHIER,
          uid: authProfile.uid || DEFAULT_CASHIER.uid,
          email: authProfile.email || DEFAULT_CASHIER.email,
          name: authProfile.displayName || DEFAULT_CASHIER.name,
          sessionId: data.sessionId
        }
      }

      setActiveCashierSession(foundCashier)
      localStorage.setItem('sugar_cashier_session', JSON.stringify(foundCashier))

      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        try {
          const ch = new BroadcastChannel('sugar_ludo_social_channel')
          ch.postMessage({
            type: 'cashier_new_session_started',
            cashierUid: foundCashier.uid,
            sessionId: data.sessionId
          })
          ch.close()
        } catch {}
      }

      return { success: true, message: '¡Acceso de cajero concedido!', cashier: foundCashier }
    } catch (e: any) {
      return { success: false, message: e.message || 'Error al conectar con el servidor de autenticación.' }
    }
  }

  const logout = (reason?: string) => {
    try {
      fetch('/api/staff/auth/logout', { method: 'POST' }).catch(() => {})
    } catch {}
    signOut(auth).catch(() => {})
    sessionStorage.removeItem('sugar_staff_id_token')
    localStorage.removeItem('sugar_staff_id_token')
    setAdminUser(null)
    setActiveCashierSession(null)
    localStorage.removeItem('sugar_admin_session')
    localStorage.removeItem('sugar_cashier_session')
    if (reason) {
      setSessionWarning(reason)
    }
  }

  const updateCurrentAdmin = async (displayName: string, email: string, newPassword?: string): Promise<boolean> => {
    if (!adminUser) return false

    const updated = {
      ...adminUser,
      displayName,
      email
    }
    setAdminUser(updated)
    localStorage.setItem('sugar_admin_session', JSON.stringify(updated))

    const updatedList = adminList.map((a) => (a.uid === adminUser.uid ? updated : a))
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))

    await persistAdminsToCloud(updatedList)
    return true
  }

  const createNewAdmin = async (
    username: string,
    email: string,
    displayName: string,
    role: 'super_admin' | 'financial_admin' | 'support_admin',
    pass: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanUser = username.trim().toLowerCase()
    const cleanEmail = email.trim().toLowerCase()

    if (!pass || pass.trim().length < 6) {
      return { success: false, message: 'La contraseña del administrador debe tener al menos 6 caracteres.' }
    }

    if (adminList.some((a) => a.username.toLowerCase() === cleanUser || a.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: 'Ya existe un administrador con ese usuario o correo.' }
    }

    const newAdmin: AdminUserProfile = {
      uid: `adm_${Date.now()}`,
      username: cleanUser,
      email: cleanEmail,
      displayName: displayName.trim(),
      role,
      createdAt: Date.now(),
      lastLoginAt: 0,
      isActive: true
    }

    // 1. Guardar en memoria local y estado (sin contraseñas en texto plano)
    const updatedList = [...adminList, newAdmin]
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))

    // 2. Persistir en Firestore en la nube
    await persistAdminsToCloud(updatedList)

    // 3. Notificar al backend (el backend calcula el hash scrypt de forma segura)
    try {
      fetch('/api/staff/auth/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: pass.trim(),
          displayName: displayName.trim(),
          username: cleanUser,
          role,
          accountType: 'admin'
        })
      }).catch(() => {})
    } catch {}

    return { success: true, message: `Administrador ${cleanUser} creado y sincronizado en la red.` }
  }

  const toggleAdminStatus = (uid: string) => {
    if (uid === DEFAULT_SUPER_ADMIN.uid) return
    const updatedList = adminList.map((a) => (a.uid === uid ? { ...a, isActive: !a.isActive } : a))
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))
    persistAdminsToCloud(updatedList)
  }

  const deleteAdminAccount = (uid: string): { success: boolean; message: string } => {
    if (uid === DEFAULT_SUPER_ADMIN.uid) {
      return { success: false, message: 'La cuenta raíz Super Admin está protegida y no puede eliminarse.' }
    }
    const updatedList = adminList.filter((a) => a.uid !== uid)
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))
    persistAdminsToCloud(updatedList)

    try {
      fetch('/api/staff/auth/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, role: 'admin', accountType: 'admin' })
      }).catch(() => {})
    } catch {}

    return { success: true, message: 'Cuenta de administrador eliminada permanentemente.' }
  }

  // Alta de Cajero con Persistencia Global en Firestore
  const createNewCashier = async (
    newCashier: CashierManagementProfile,
    pass?: string
  ): Promise<{ success: boolean; message: string }> => {
    const cleanEmail = newCashier.email.trim().toLowerCase()
    if (cashierList.some((c) => c.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: 'Ya existe un cajero registrado con ese correo electrónico.' }
    }

    if (!pass || pass.trim().length < 6) {
      return { success: false, message: 'Debe ingresar una contraseña válida de al menos 6 caracteres para el cajero.' }
    }

    const assignedPassword = pass.trim()
    const floatUSDT = newCashier.floatBalanceUSDT ?? (newCashier.floatBalanceCoins / 100)
    const fullCashier: CashierManagementProfile = {
      ...newCashier,
      floatBalanceCoins: newCashier.floatBalanceCoins,
      floatBalanceUSDT: floatUSDT,
      initialShiftFloatUSDT: floatUSDT,
      totalPaidWithdrawalsUSDT: 0,
      totalPaidWithdrawalsCoins: 0,
      role: 'cashier',
      assignedShiftAt: newCashier.assignedShiftAt || Date.now(),
      lastRechargeAt: newCashier.lastRechargeAt || Date.now()
    }

    // 1. Guardar en memoria local y estado (sin almacenar contraseñas en plain text)
    const updatedList = [fullCashier, ...cashierList]
    setCashierList(updatedList)
    localStorage.setItem('sugar_cashier_accounts', JSON.stringify(updatedList))

    // 2. Persistir en Firestore en la nube para acceso universal desde cualquier dispositivo
    await persistCashiersToCloud(updatedList)

    // 3. Crear también perfil individual en cashier_profiles
    try {
      await setDoc(doc(db, 'cashier_profiles', fullCashier.uid), fullCashier, { merge: true })
    } catch {}

    // 4. Actualizar el saldo flotante en global_ledger si es capital nuevo
    try {
      const ledgerRef = doc(db, 'system_treasury', 'global_ledger')
      await setDoc(ledgerRef, {
        id: 'global_ledger',
        cashierFloatsUSD: increment(floatUSDT),
        cashierFloatsCoins: increment(fullCashier.floatBalanceCoins),
        lastAuditedAt: Date.now()
      }, { merge: true })
    } catch {}

    // 5. Notificar a endpoint backend (el backend calcula el hash criptográfico scrypt)
    try {
      fetch('/api/staff/auth/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: assignedPassword,
          displayName: fullCashier.name,
          username: cleanEmail.split('@')[0],
          role: 'cashier',
          accountType: 'cashier',
          initialFloatCoins: fullCashier.floatBalanceCoins,
          phone: fullCashier.phone,
          idDocument: fullCashier.idDocument
        })
      }).catch(() => {})
    } catch {}

    return { success: true, message: `Cajero ${fullCashier.name} registrado con balance de ${fullCashier.floatBalanceCoins.toLocaleString()} SC ($${floatUSDT.toFixed(2)} USDT) sincronizado en la nube.` }
  }

  const deleteCashierAccount = (uid: string): { success: boolean; message: string } => {
    const updatedList = cashierList.filter((c) => c.uid !== uid)
    setCashierList(updatedList)
    localStorage.setItem('sugar_cashier_accounts', JSON.stringify(updatedList))
    persistCashiersToCloud(updatedList)

    try {
      fetch('/api/staff/auth/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid, role: 'cashier', accountType: 'cashier' })
      }).catch(() => {})
    } catch {}

    return { success: true, message: 'Cuenta de cajero eliminada permanentemente.' }
  }

  // Modificar Datos y Credenciales de Cajero
  const updateCashierProfile = async (
    uid: string,
    updates: Partial<CashierManagementProfile>,
    newPassword?: string
  ): Promise<{ success: boolean; message: string }> => {
    let updatedCashier: CashierManagementProfile | null = null

    const updatedList = cashierList.map((c) => {
      if (c.uid === uid) {
        updatedCashier = {
          ...c,
          ...updates
        }
        return updatedCashier
      }
      return c
    })

    if (!updatedCashier) {
      return { success: false, message: 'Cajero no encontrado.' }
    }

    setCashierList(updatedList)
    localStorage.setItem('sugar_cashier_accounts', JSON.stringify(updatedList))

    // Persistir en Firestore en system_config/cashier_accounts
    await persistCashiersToCloud(updatedList)

    // Persistir en cashier_profiles/{uid}
    try {
      const cashierProfileRef = doc(db, 'cashier_profiles', uid)
      await setDoc(cashierProfileRef, {
        uid,
        name: (updatedCashier as CashierManagementProfile).name,
        email: (updatedCashier as CashierManagementProfile).email,
        phone: (updatedCashier as CashierManagementProfile).phone,
        idDocument: (updatedCashier as CashierManagementProfile).idDocument,
        assignedPaymentMethods: (updatedCashier as CashierManagementProfile).assignedPaymentMethods,
        paymentMethodsCount: (updatedCashier as CashierManagementProfile).assignedPaymentMethods?.length || (updatedCashier as CashierManagementProfile).paymentMethodsCount,
        updatedAt: Date.now()
      }, { merge: true })
    } catch (e) {
      console.warn('[AdminAuth] Error actualizando cashier_profiles:', e)
    }

    // Si se solicitó cambio de contraseña, enviar al backend seguro para hashing con scrypt
    if (newPassword && newPassword.trim().length >= 6) {
      try {
        fetch('/api/staff/auth/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: (updatedCashier as CashierManagementProfile).email,
            password: newPassword.trim(),
            displayName: (updatedCashier as CashierManagementProfile).name,
            role: 'cashier',
            accountType: 'cashier'
          })
        }).catch(() => {})
      } catch {}
    }

    // Actualizar sesión activa local si coincide
    try {
      const savedSession = localStorage.getItem('sugar_cashier_session')
      if (savedSession) {
        const parsed = JSON.parse(savedSession)
        if (parsed.uid === uid) {
          localStorage.setItem('sugar_cashier_session', JSON.stringify(updatedCashier))
        }
      }
    } catch {}

    // Notificar por BroadcastChannel
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const ch = new BroadcastChannel('sugar_ludo_social_channel')
        ch.postMessage({
          type: 'cashier_profile_updated',
          uid,
          cashier: updatedCashier
        })
        ch.close()
      }
    } catch {}

    return { success: true, message: `Datos y credenciales de ${(updatedCashier as CashierManagementProfile).name} actualizados exitosamente.` }
  }

  // Recarga y Asignación de Saldo Flotante en Vivo
  const updateCashierFloat = async (uid: string, newCoins: number, newUSDT?: number, paidWithdrawalDelta?: number) => {
    const finalUSDT = newUSDT !== undefined ? newUSDT : newCoins / 100
    const updatedList = cashierList.map((c) => {
      if (c.uid === uid) {
        return {
          ...c,
          floatBalanceCoins: newCoins,
          floatBalanceUSDT: finalUSDT,
          totalPaidWithdrawalsUSDT: paidWithdrawalDelta ? ((c.totalPaidWithdrawalsUSDT || 0) + paidWithdrawalDelta) : c.totalPaidWithdrawalsUSDT,
          lastRechargeAt: Date.now()
        }
      }
      return c
    })
    setCashierList(updatedList)
    localStorage.setItem('sugar_cashier_accounts', JSON.stringify(updatedList))
    await persistCashiersToCloud(updatedList)

    // Actualizar también en cashier_profiles
    try {
      const cashierRef = doc(db, 'cashier_profiles', uid)
      await setDoc(cashierRef, {
        uid,
        floatBalanceCoins: newCoins,
        floatBalanceUSDT: finalUSDT,
        lastActiveAt: Date.now(),
        ...(paidWithdrawalDelta ? { totalPaidWithdrawalsUSDT: increment(paidWithdrawalDelta) } : {})
      }, { merge: true })
    } catch {}

    // Actualizar sesión activa en localStorage si coincide
    try {
      const savedSession = localStorage.getItem('sugar_cashier_session')
      if (savedSession) {
        const parsed = JSON.parse(savedSession)
        if (parsed.uid === uid) {
          const updatedSession = { ...parsed, floatBalanceCoins: newCoins, floatBalanceUSDT: finalUSDT }
          localStorage.setItem('sugar_cashier_session', JSON.stringify(updatedSession))
          setActiveCashierSession((prev) => (prev && prev.uid === uid ? { ...prev, floatBalanceCoins: newCoins, floatBalanceUSDT: finalUSDT } : prev))
        }
      }
    } catch {}
  }

  const resetAllCashiersFloat = async () => {
    const now = Date.now()
    const resetAccounts = cashierList.map((c) => ({
      ...c,
      floatBalanceCoins: 0,
      floatBalanceUSDT: 0,
      totalPaidWithdrawalsUSDT: 0,
      initialShiftFloatUSDT: 0,
      lastResetAt: now
    }))
    setCashierList(resetAccounts)
    localStorage.setItem('sugar_cashier_accounts', JSON.stringify(resetAccounts))
    const savedSession = localStorage.getItem('sugar_cashier_session')
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession)
        parsed.floatBalanceCoins = 0
        parsed.floatBalanceUSDT = 0
        localStorage.setItem('sugar_cashier_session', JSON.stringify(parsed))
      } catch {}
    }
    await persistCashiersToCloud(resetAccounts)
  }

  return (
    <AdminAuthContext.Provider
      value={{
        adminUser,
        isAuthenticated: !!adminUser,
        isLoading,
        login,
        loginCashier,
        logout,
        sessionWarning,
        clearSessionWarning,
        updateCurrentAdmin,
        adminList,
        createNewAdmin,
        toggleAdminStatus,
        deleteAdminAccount,
        cashierList,
        activeCashierSession,
        setActiveCashierSession,
        createNewCashier,
        updateCashierProfile,
        deleteCashierAccount,
        updateCashierFloat,
        resetAllCashiersFloat
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}
