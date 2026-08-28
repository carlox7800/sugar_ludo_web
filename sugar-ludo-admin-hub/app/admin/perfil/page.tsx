'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '../../../lib/admin-auth-context'
import { RegisterCashierModal } from '../../../components/admin/RegisterCashierModal'
import {
  User,
  Shield,
  KeyRound,
  UserPlus,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Save,
  Lock,
  Mail,
  Users,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  LogOut,
  Trash2,
  AlertTriangle,
  CreditCard,
  Eye,
  EyeOff
} from 'lucide-react'
import { clsx } from 'clsx'

export default function AdminPerfilPage() {
  const router = useRouter()
  const {
    adminUser,
    isAuthenticated,
    isLoading,
    updateCurrentAdmin,
    adminList,
    createNewAdmin,
    toggleAdminStatus,
    deleteAdminAccount,
    cashierList,
    createNewCashier,
    deleteCashierAccount,
    logout
  } = useAdminAuth()

  // Active Management Tab: 'admins' | 'cashiers'
  const [managementTab, setManagementTab] = useState<'admins' | 'cashiers'>('admins')

  // Profile Edit Form State
  const [displayName, setDisplayName] = useState(adminUser?.displayName || '')
  const [email, setEmail] = useState(adminUser?.email || '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // New Admin Form State
  const [newAdminUser, setNewAdminUser] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminDisplayName, setNewAdminDisplayName] = useState('')
  const [newAdminRole, setNewAdminRole] = useState<'super_admin' | 'financial_admin' | 'support_admin'>('financial_admin')
  const [newAdminPass, setNewAdminPass] = useState('')
  const [showNewAdminPass, setShowNewAdminPass] = useState(false)

  // Modal para alta de cajero
  const [isRegisterCashierModalOpen, setIsRegisterCashierModalOpen] = useState(false)

  // Modal de Confirmación de Eliminación Permanente
  const [accountToDelete, setAccountToDelete] = useState<{
    type: 'admin' | 'cashier'
    uid: string
    name: string
  } | null>(null)

  // UI Feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !adminUser)) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, adminUser, router])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  if (isLoading || !isAuthenticated || !adminUser) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-cyan-400 font-mono text-xs">
        Cargando perfil administrativo...
      </div>
    )
  }

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setErrorMessage(null)
    setTimeout(() => setToastMessage(null), 4000)
  }

  const showError = (msg: string) => {
    setErrorMessage(msg)
    setToastMessage(null)
    setTimeout(() => setErrorMessage(null), 4000)
  }

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword && newPassword !== confirmPassword) {
      showError('Las contraseñas no coinciden.')
      return
    }
    if (newPassword && newPassword.length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres.')
      return
    }

    const ok = await updateCurrentAdmin(displayName, email, newPassword || undefined)
    if (ok) {
      setNewPassword('')
      setConfirmPassword('')
      showToast('¡Perfil y credenciales actualizadas con éxito!')
    }
  }

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAdminUser || !newAdminEmail || !newAdminDisplayName || !newAdminPass) {
      showError('Por favor complete todos los campos para el nuevo administrador.')
      return
    }

    const res = await createNewAdmin(
      newAdminUser,
      newAdminEmail,
      newAdminDisplayName,
      newAdminRole,
      newAdminPass
    )

    if (res.success) {
      setNewAdminUser('')
      setNewAdminEmail('')
      setNewAdminDisplayName('')
      setNewAdminPass('')
      showToast(res.message)
    } else {
      showError(res.message)
    }
  }

  const handleConfirmDelete = () => {
    if (!accountToDelete) return
    if (accountToDelete.type === 'admin') {
      const res = deleteAdminAccount(accountToDelete.uid)
      if (res.success) {
        showToast(res.message)
      } else {
        showError(res.message)
      }
    } else {
      const res = deleteCashierAccount(accountToDelete.uid)
      if (res.success) {
        showToast(res.message)
      } else {
        showError(res.message)
      }
    }
    setAccountToDelete(null)
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="font-black text-base text-white tracking-wide flex items-center gap-2">
              <User className="size-5 text-cyan-400" /> PERFIL Y ADMINISTRACIÓN CENTRALIZADA DE CUENTAS
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              admin.sugarludo.com &bull; Altas, Bajas y Control de Credenciales para Admins y Cajeros
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
        >
          <LogOut className="size-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </header>

      {/* Notification Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="size-5" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-red-500 text-white font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <AlertCircle className="size-5" />
          <span>{errorMessage}</span>
        </div>
      )}

      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Col 1: Tarjeta de Perfil Actual y Edición de Mis Credenciales */}
          <div className="lg:col-span-1 space-y-6">
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4 text-center">
              <div className="size-20 rounded-3xl bg-cyan-500/20 border border-cyan-500/30 mx-auto flex items-center justify-center text-cyan-400 text-3xl font-black shadow-lg">
                {adminUser.displayName.charAt(0)}
              </div>

              <div>
                <h3 className="text-base font-black text-white">{adminUser.displayName}</h3>
                <span className="text-xs text-cyan-400 font-mono">@{adminUser.username}</span>
                <span className="block text-[10px] uppercase font-bold text-pink-400 mt-1">
                  Rol: {adminUser.role === 'super_admin' ? 'Super Admin Maestro' : adminUser.role}
                </span>
              </div>

              <div className="pt-3 border-t border-white/5 text-[11px] text-slate-400 font-mono space-y-1 text-left">
                <div className="flex justify-between">
                  <span>ID Sesión:</span>
                  <span className="text-slate-300 font-bold">{adminUser.uid.slice(0, 14)}...</span>
                </div>
                <div className="flex justify-between">
                  <span>Estado:</span>
                  <span className="text-emerald-400 font-bold">Autenticado en línea</span>
                </div>
              </div>
            </div>

            {/* Formulario de Actualización */}
            <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
              <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <KeyRound className="size-4 text-cyan-400" /> EDITAR MIS CREDENCIALES
              </h4>

              <form onSubmit={handleUpdateProfile} className="space-y-3 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-400 font-bold">Nombre para Mostrar</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold">Correo Electrónico</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-400 font-bold">Nueva Contraseña (Opcional)</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Dejar en blanco para conservar actual"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 pr-10 py-2 text-white font-mono placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                      title={showNewPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                    >
                      {showNewPassword ? <EyeOff className="size-4 text-cyan-400" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {newPassword && (
                  <div className="space-y-1">
                    <label className="text-slate-400 font-bold">Confirmar Nueva Contraseña</label>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repita la nueva contraseña"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 pr-10 py-2 text-white font-mono placeholder:text-slate-600"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                        title={showConfirmPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                      >
                        {showConfirmPassword ? <EyeOff className="size-4 text-cyan-400" /> : <Eye className="size-4" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Save className="size-4" />
                  <span>Guardar Cambios</span>
                </button>
              </form>
            </div>
          </div>

          {/* Col 2 & 3: Pestañas de Gestión Centralizada de Cuentas (Admins & Cajeros) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Selector de Pestaña */}
            <div className="p-1.5 rounded-2xl bg-slate-950 border border-white/5 grid grid-cols-2 gap-1 text-xs font-bold">
              <button
                onClick={() => setManagementTab('admins')}
                className={clsx(
                  'py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer',
                  managementTab === 'admins'
                    ? 'bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <Shield className="size-4" />
                <span>Administradores ({adminList.length})</span>
              </button>

              <button
                onClick={() => setManagementTab('cashiers')}
                className={clsx(
                  'py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer',
                  managementTab === 'cashiers'
                    ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <CreditCard className="size-4" />
                <span>Cajeros Autorizados ({cashierList.length})</span>
              </button>
            </div>

            {/* TAB 1: GESTIÓN DE ADMINISTRADORES */}
            {managementTab === 'admins' && (
              <div className="space-y-6">
                {/* Formulario para Crear Nuevo Administrador */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <UserPlus className="size-4 text-purple-400" /> CREAR Y AUTORIZAR NUEVO ADMINISTRADOR
                  </h4>

                  <form onSubmit={handleCreateAdmin} className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold">Usuario (Login)</label>
                      <input
                        type="text"
                        value={newAdminUser}
                        onChange={(e) => setNewAdminUser(e.target.value)}
                        placeholder="ej. auditor.carlos"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold">Correo Electrónico</label>
                      <input
                        type="email"
                        value={newAdminEmail}
                        onChange={(e) => setNewAdminEmail(e.target.value)}
                        placeholder="ej. auditor@sugarludo.com"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold">Nombre Completo</label>
                      <input
                        type="text"
                        value={newAdminDisplayName}
                        onChange={(e) => setNewAdminDisplayName(e.target.value)}
                        placeholder="ej. Carlos Mendoza"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                        required
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-slate-400 font-bold">Rol Administrativo</label>
                      <select
                        value={newAdminRole}
                        onChange={(e: any) => setNewAdminRole(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-bold"
                      >
                        <option value="financial_admin">Admin Financiero / Cajeros</option>
                        <option value="support_admin">Admin de Soporte y Disputas</option>
                        <option value="super_admin">Super Admin (Control Total)</option>
                      </select>
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-slate-400 font-bold">Contraseña Temporal</label>
                      <div className="relative">
                        <input
                          type={showNewAdminPass ? 'text' : 'password'}
                          value={newAdminPass}
                          onChange={(e) => setNewAdminPass(e.target.value)}
                          placeholder="Mínimo 6 caracteres"
                          className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 pr-10 py-2 text-white font-mono"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewAdminPass(!showNewAdminPass)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                          title={showNewAdminPass ? 'Ocultar contraseña' : 'Ver contraseña'}
                        >
                          {showNewAdminPass ? <EyeOff className="size-4 text-purple-400" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      className="sm:col-span-2 py-3 rounded-2xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(168,85,247,0.3)] mt-1"
                    >
                      <UserPlus className="size-4" />
                      <span>Crear Cuenta de Administrador</span>
                    </button>
                  </form>
                </div>

                {/* Lista de Administradores con Bajas / Eliminación */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="size-4 text-purple-400" /> ADMINISTRADORES ACTIVOS ({adminList.length})
                  </h4>

                  <div className="divide-y divide-white/5">
                    {adminList.map((admin) => (
                      <div key={admin.uid} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-300 font-black">
                            {admin.displayName.charAt(0)}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{admin.displayName}</span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-white/5 text-slate-300 font-mono">
                                @{admin.username}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">{admin.email} &bull; <strong className="text-pink-300 uppercase">{admin.role}</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase ${admin.isActive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                            {admin.isActive ? 'Activo' : 'Suspendido'}
                          </span>

                          {admin.uid !== 'adm_super_carlos_001' && (
                            <>
                              <button
                                onClick={() => toggleAdminStatus(admin.uid)}
                                className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                                  admin.isActive ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                }`}
                              >
                                {admin.isActive ? 'Suspender' : 'Reactivar'}
                              </button>

                              <button
                                onClick={() => setAccountToDelete({ type: 'admin', uid: admin.uid, name: admin.displayName })}
                                className="p-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
                                title="Eliminar permanentemente"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: GESTIÓN CENTRALIZADA DE CAJEROS */}
            {managementTab === 'cashiers' && (
              <div className="space-y-6">
                {/* Botón para Abrir Modal de Alta de Cajero */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-pink-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <CreditCard className="size-5 text-pink-400" /> ALTA DE NUEVOS CAJEROS AUTORIZADOS
                    </h4>
                    <p className="text-xs text-slate-400 mt-1">
                      Registra documento de identidad, credenciales y asignación inicial de saldo flotante.
                    </p>
                  </div>

                  <button
                    onClick={() => setIsRegisterCashierModalOpen(true)}
                    className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(236,72,153,0.3)] shrink-0"
                  >
                    <UserPlus className="size-4" />
                    <span>Registrar Nuevo Cajero</span>
                  </button>
                </div>

                {/* Lista de Cajeros con Bajas / Eliminación */}
                <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-4">
                  <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Users className="size-4 text-pink-400" /> CAJEROS EN LA RED ({cashierList.length})
                  </h4>

                  <div className="divide-y divide-white/5">
                    {cashierList.map((csh) => (
                      <div key={csh.uid} className="py-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <img src={csh.avatarUrl || 'https://i.ibb.co/3YBC35Xm/avatar-1786744277377.jpg'} alt={csh.name} className="size-10 rounded-2xl object-cover border border-white/10" />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{csh.name}</span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-pink-500/10 text-pink-300 font-mono font-bold">
                                Flotante: {csh.floatBalanceCoins.toLocaleString()} SC
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400">{csh.email} &bull; <strong className="text-white">${(csh.floatBalanceCoins / 100).toFixed(2)} USDT</strong></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setAccountToDelete({ type: 'cashier', uid: csh.uid, name: csh.name })}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
                          >
                            <Trash2 className="size-3.5" />
                            <span>Eliminar Cajero</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modal de Alta de Cajero */}
      <RegisterCashierModal
        isOpen={isRegisterCashierModalOpen}
        onClose={() => setIsRegisterCashierModalOpen(false)}
        onRegister={(newCashier, pass) => {
          const res = createNewCashier(newCashier, pass)
          if (res.success) {
            showToast(res.message)
          } else {
            showError(res.message)
          }
        }}
      />

      {/* Modal de Confirmación de Eliminación Permanente */}
      {accountToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-red-500/40 shadow-2xl space-y-4 text-center">
            <div className="size-14 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="size-8" />
            </div>

            <h3 className="text-lg font-black text-white">¿Eliminar Cuenta Permanentemente?</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Está a punto de eliminar la cuenta de <strong className="text-white">{accountToDelete.name}</strong> ({accountToDelete.type === 'admin' ? 'Administrador' : 'Cajero'}). Esta acción revocará de inmediato sus accesos al sistema y no se puede deshacer.
            </p>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setAccountToDelete(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition-all cursor-pointer shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              >
                Confirmar Eliminación
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
