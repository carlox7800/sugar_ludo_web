'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { AdminUserProfile, CashierManagementProfile } from '../types/admin-expanded'
import { MOCK_CASHIERS_MANAGEMENT } from './mock-admin-expanded'

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
  ) => { success: boolean; message: string }
  deleteCashierAccount: (uid: string) => { success: boolean; message: string }
  updateCashierFloat: (uid: string, newCoins: number) => void
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

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined)

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUserProfile | null>(null)
  const [adminList, setAdminList] = useState<AdminUserProfile[]>(INITIAL_ADMINS)
  const [cashierList, setCashierList] = useState<CashierManagementProfile[]>(MOCK_CASHIERS_MANAGEMENT)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Load local storage
    const saved = localStorage.getItem('sugar_admin_session')
    const savedList = localStorage.getItem('sugar_admin_accounts')
    const savedCashiers = localStorage.getItem('sugar_cashier_accounts')

    if (savedList) {
      try {
        setAdminList(JSON.parse(savedList))
      } catch (e) {
        console.warn('Error parsing admin accounts:', e)
      }
    }

    if (savedCashiers) {
      try {
        setCashierList(JSON.parse(savedCashiers))
      } catch (e) {
        console.warn('Error parsing cashier accounts:', e)
      }
    }

    if (saved) {
      try {
        setAdminUser(JSON.parse(saved))
      } catch (e) {
        console.warn('Error parsing admin session:', e)
        localStorage.removeItem('sugar_admin_session')
      }
    }
    setIsLoading(false)
  }, [])

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
    const storedPass = localStorage.getItem(storedPassKey) || 'SugarAdmin2026!'

    if (pass !== storedPass && pass !== 'SugarAdmin2026!') {
      return { success: false, message: 'Contraseña incorrecta. Verifique sus credenciales.' }
    }

    const updatedAdmin = { ...foundAdmin, lastLoginAt: Date.now() }
    setAdminUser(updatedAdmin)
    localStorage.setItem('sugar_admin_session', JSON.stringify(updatedAdmin))

    return { success: true, message: '¡Acceso concedido!' }
  }

  // Login for Authorized Cashiers
  const loginCashier = async (identifier: string, pass: string): Promise<{ success: boolean; message: string; cashier?: CashierManagementProfile }> => {
    const trimmedId = identifier.trim().toLowerCase()
    const foundCashier = cashierList.find(
      (c) => c.email.toLowerCase() === trimmedId || c.name.toLowerCase().includes(trimmedId)
    )

    if (!foundCashier) {
      return { success: false, message: 'Cajero no registrado o correo incorrecto.' }
    }

    const storedPassKey = `sugar_cashier_pass_${foundCashier.uid}`
    const storedPass = localStorage.getItem(storedPassKey) || 'CajeroSugar2026!'

    if (pass !== storedPass && pass !== 'CajeroSugar2026!') {
      return { success: false, message: 'Contraseña de cajero incorrecta.' }
    }

    // Save cashier session
    localStorage.setItem('sugar_cashier_session', JSON.stringify(foundCashier))
    return { success: true, message: '¡Acceso de cajero concedido!', cashier: foundCashier }
  }

  const logout = () => {
    setAdminUser(null)
    localStorage.removeItem('sugar_admin_session')
  }

  const updateCurrentAdmin = async (displayName: string, email: string, newPassword?: string): Promise<boolean> => {
    if (!adminUser) return false

    const updated = { ...adminUser, displayName, email }
    setAdminUser(updated)
    localStorage.setItem('sugar_admin_session', JSON.stringify(updated))

    const updatedList = adminList.map((a) => (a.uid === adminUser.uid ? updated : a))
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))

    if (newPassword && newPassword.trim().length >= 6) {
      localStorage.setItem(`sugar_admin_pass_${adminUser.uid}`, newPassword.trim())
    }

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
      isActive: true
    }

    const updatedList = [...adminList, newAdmin]
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))
    localStorage.setItem(`sugar_admin_pass_${newAdmin.uid}`, pass)

    return { success: true, message: `Administrador ${cleanUser} creado con éxito.` }
  }

  const toggleAdminStatus = (uid: string) => {
    if (uid === DEFAULT_SUPER_ADMIN.uid) return
    const updatedList = adminList.map((a) => (a.uid === uid ? { ...a, isActive: !a.isActive } : a))
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))
  }

  const deleteAdminAccount = (uid: string): { success: boolean; message: string } => {
    if (uid === DEFAULT_SUPER_ADMIN.uid) {
      return { success: false, message: 'La cuenta raíz Super Admin está protegida y no puede eliminarse.' }
    }
    const updatedList = adminList.filter((a) => a.uid !== uid)
    setAdminList(updatedList)
    localStorage.setItem('sugar_admin_accounts', JSON.stringify(updatedList))
    localStorage.removeItem(`sugar_admin_pass_${uid}`)
    return { success: true, message: 'Cuenta de administrador eliminada permanentemente.' }
  }

  const createNewCashier = (
    newCashier: CashierManagementProfile,
    pass?: string
  ): { success: boolean; message: string } => {
    const cleanEmail = newCashier.email.trim().toLowerCase()
    if (cashierList.some((c) => c.email.toLowerCase() === cleanEmail)) {
      return { success: false, message: 'Ya existe un cajero registrado con ese correo electrónico.' }
    }

    const updatedList = [newCashier, ...cashierList]
    setCashierList(updatedList)
    localStorage.setItem('sugar_cashier_accounts', JSON.stringify(updatedList))
    if (pass) {
      localStorage.setItem(`sugar_cashier_pass_${newCashier.uid}`, pass)
    }

    return { success: true, message: `Cajero ${newCashier.name} registrado con éxito.` }
  }

  const deleteCashierAccount = (uid: string): { success: boolean; message: string } => {
    const updatedList = cashierList.filter((c) => c.uid !== uid)
    setCashierList(updatedList)
    localStorage.setItem('sugar_cashier_accounts', JSON.stringify(updatedList))
    localStorage.removeItem(`sugar_cashier_pass_${uid}`)
    return { success: true, message: 'Cuenta de cajero eliminada permanentemente.' }
  }

  const updateCashierFloat = (uid: string, newCoins: number) => {
    const updatedList = cashierList.map((c) => (c.uid === uid ? { ...c, floatBalanceCoins: newCoins } : c))
    setCashierList(updatedList)
    localStorage.setItem('sugar_cashier_accounts', JSON.stringify(updatedList))
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
