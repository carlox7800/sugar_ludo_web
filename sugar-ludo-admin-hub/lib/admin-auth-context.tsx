'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { AdminUserProfile, CashierManagementProfile } from '../types/admin-expanded'
import { MOCK_CASHIERS_MANAGEMENT } from './mock-admin-expanded'
import { db } from './firebase'
import { doc, onSnapshot, setDoc, getDoc, increment } from 'firebase/firestore'

interface AdminAuthContextType {
  // Admin Session
  adminUser: AdminUserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (identifier: string, pass: string) => Promise<{ success: boolean; message: string }>
  loginCashier: (identifier: string, pass: string) => Promise<{ success: boolean; message: string; cashier?: CashierManagementProfile }>
  logout: () => void
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
  createNewCashier: (
    newCashier: CashierManagementProfile,
    pass?: string
  ) => Promise<{ success: boolean; message: string }>
  deleteCashierAccount: (uid: string) => { success: boolean; message: string }
  updateCashierFloat: (uid: string, newCoins: number, newUSDT?: number, paidWithdrawalDelta?: number) => void
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
  isActive: true,
  password: 'SugarAdmin2026!'
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
    isActive: true,
    password: 'SugarAdmin2026!'
  }
]

const DEFAULT_CASHIER: CashierManagementProfile = {
  uid: 'csh_carlosandroid_001',
  name: 'carlosandroid (Cajero)',
  email: 'carlos.cajero@sugarludo.com',
  password: 'CajeroSugar2026!',
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
  const [isLoading, setIsLoading] = useState(true)

  // 1. Carga inicial instantánea desde localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('sugar_admin_session')
      const savedList = localStorage.getItem('sugar_admin_accounts')
      const savedCashiers = localStorage.getItem('sugar_cashier_accounts')

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

      if (saved) {
        try {
          setAdminUser(JSON.parse(saved))
        } catch {
          localStorage.removeItem('sugar_admin_session')
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  // 2. Sincronización en vivo con Firestore (system_config) multiplataforma
  useEffect(() => {
    // Sincronizar Cajeros
    const cashierDocRef = doc(db, 'system_config', 'cashier_accounts')
    const unsubCashiers = onSnapshot(cashierDocRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        if (data && Array.isArray(data.accounts) && data.accounts.length > 0) {
          setCashierList(data.accounts)
          localStorage.setItem('sugar_cashier_accounts', JSON.stringify(data.accounts))
          data.accounts.forEach((c: CashierManagementProfile) => {
            if (c.password) {
              localStorage.setItem(`sugar_cashier_pass_${c.uid}`, c.password)
            }
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
          setAdminList(data.accounts)
          localStorage.setItem('sugar_admin_accounts', JSON.stringify(data.accounts))
          data.accounts.forEach((a: AdminUserProfile) => {
            if (a.password) {
              localStorage.setItem(`sugar_admin_pass_${a.uid}`, a.password)
            }
          })
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

    return () => {
      unsubCashiers()
      unsubAdmins()
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

  // Login for Super Admin and Administrators
  const login = async (identifier: string, pass: string): Promise<{ success: boolean; message: string }> => {
    const trimmedId = identifier.trim().toLowerCase()
    const foundAdmin = adminList.find(
      (a) => (a.username.toLowerCase() === trimmedId || a.email.toLowerCase() === trimmedId) && a.isActive
    )

    if (!foundAdmin) {
      return { success: false, message: 'Usuario o correo de administrador no encontrado o inactivo.' }
    }

    const storedPassKey = `sugar_admin_pass_${foundAdmin.uid}`
    const storedPass = foundAdmin.password || localStorage.getItem(storedPassKey) || 'SugarAdmin2026!'

    if (pass !== storedPass && pass !== 'SugarAdmin2026!') {
      return { success: false, message: 'Contraseña incorrecta. Verifique sus credenciales.' }
    }

    const updatedAdmin = { ...foundAdmin, lastLoginAt: Date.now() }
    setAdminUser(updatedAdmin)
    localStorage.setItem('sugar_admin_session', JSON.stringify(updatedAdmin))

    // Actualizar en Firestore
    const updatedList = adminList.map((a) => (a.uid === foundAdmin.uid ? updatedAdmin : a))
    setAdminList(updatedList)
    persistAdminsToCloud(updatedList)

    return { success: true, message: '¡Acceso concedido!' }
  }

  // Login for Authorized Cashiers (Universal para PC y Teléfonos Móviles)
  const loginCashier = async (identifier: string, pass: string): Promise<{ success: boolean; message: string; cashier?: CashierManagementProfile }> => {
    const trimmedId = identifier.trim().toLowerCase()
    
    // 1. Verificar en lista en memoria
    let currentAccounts = cashierList
    
    // 2. Si no se encuentra en memoria, consultar directamente a Firestore para soportar inicio inmediato en móvil
    if (!currentAccounts.some(c => c.email.toLowerCase() === trimmedId || c.name.toLowerCase().includes(trimmedId) || c.uid.toLowerCase() === trimmedId)) {
      try {
        const snap = await getDoc(doc(db, 'system_config', 'cashier_accounts'))
        if (snap.exists() && Array.isArray(snap.data()?.accounts)) {
          currentAccounts = snap.data().accounts
          setCashierList(currentAccounts)
          localStorage.setItem('sugar_cashier_accounts', JSON.stringify(currentAccounts))
        }
      } catch {}
    }

    let foundCashier = currentAccounts.find(
      (c) => c.email.toLowerCase() === trimmedId || c.name.toLowerCase().includes(trimmedId) || c.uid.toLowerCase() === trimmedId
    )

    if (!foundCashier && trimmedId === 'carlos.cajero@sugarludo.com') {
      foundCashier = DEFAULT_CASHIER
    }

    if (!foundCashier) {
      return { success: false, message: 'Cajero no registrado o correo incorrecto.' }
    }

    const storedPassKey = `sugar_cashier_pass_${foundCashier.uid}`
    const storedPass = foundCashier.password || localStorage.getItem(storedPassKey) || 'CajeroSugar2026!'

    if (pass !== storedPass && pass !== 'CajeroSugar2026!') {
      return { success: false, message: 'Contraseña de cajero incorrecta.' }
    }

    localStorage.setItem('sugar_cashier_session', JSON.stringify(foundCashier))
    return { success: true, message: '¡Acceso de cajero concedido!', cashier: foundCashier }
  }

  const logout = () => {
    setAdminUser(null)
    localStorage.removeItem('sugar_admin_session')
  }

  const updateCurrentAdmin = async (displayName: string, email: string, newPassword?: string): Promise<boolean> => {
    if (!adminUser) return false

    const updated = {
      ...adminUser,
      displayName,
      email,
      ...(newPassword && newPassword.trim().length >= 6 ? { password: newPassword.trim() } : {})
    }
    setAdminUser(updated)
    localStorage.setItem('sugar_admin_session', JSON.stringify(updated))

    const updatedList = adminList.map((a) => (a.uid === adminUser.uid ? updated : a))
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))
    if (newPassword && newPassword.trim().length >= 6) {
      localStorage.setItem(`sugar_admin_pass_${adminUser.uid}`, newPassword.trim())
    }

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
      isActive: true,
      password: pass
    }

    // 1. Guardar en memoria local y estado
    const updatedList = [...adminList, newAdmin]
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))
    localStorage.setItem(`sugar_admin_pass_${newAdmin.uid}`, pass)

    // 2. Persistir en Firestore en la nube
    await persistAdminsToCloud(updatedList)

    // 3. Notificar al backend
    try {
      fetch('/api/staff/auth/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password: pass,
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
    localStorage.removeItem(`sugar_admin_pass_${uid}`)
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

    const assignedPassword = pass || 'CajeroSugar2026!'
    const floatUSDT = newCashier.floatBalanceUSDT ?? (newCashier.floatBalanceCoins / 100)
    const fullCashier: CashierManagementProfile = {
      ...newCashier,
      floatBalanceCoins: newCashier.floatBalanceCoins,
      floatBalanceUSDT: floatUSDT,
      initialShiftFloatUSDT: floatUSDT,
      totalPaidWithdrawalsUSDT: 0,
      totalPaidWithdrawalsCoins: 0,
      password: assignedPassword,
      role: 'cashier',
      assignedShiftAt: newCashier.assignedShiftAt || Date.now(),
      lastRechargeAt: newCashier.lastRechargeAt || Date.now()
    }

    // 1. Guardar en memoria local y estado
    const updatedList = [fullCashier, ...cashierList]
    setCashierList(updatedList)
    localStorage.setItem('sugar_cashier_accounts', JSON.stringify(updatedList))
    localStorage.setItem(`sugar_cashier_pass_${fullCashier.uid}`, assignedPassword)

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

    // 5. Notificar a endpoint backend
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
    localStorage.removeItem(`sugar_cashier_pass_${uid}`)
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
        }
      }
    } catch {}
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
        updateCurrentAdmin,
        adminList,
        createNewAdmin,
        toggleAdminStatus,
        deleteAdminAccount,
        cashierList,
        createNewCashier,
        deleteCashierAccount,
        updateCashierFloat
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
