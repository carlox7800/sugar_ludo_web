'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '../lib/admin-auth-context'
import { APP_VERSION_TAG } from '../lib/version'
import {
  Shield,
  CreditCard,
  Lock,
  User,
  KeyRound,
  AlertCircle,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react'
import { clsx } from 'clsx'

export default function HubLandingPage() {
  const router = useRouter()
  const { login, loginCashier, isAuthenticated, adminUser } = useAdminAuth()

  // Mode Selector: 'admin' | 'cashier'
  const [accessMode, setAccessMode] = useState<'admin' | 'cashier'>('admin')
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Por favor complete todos los campos.')
      return
    }

    setIsLoading(true)
    setErrorMsg(null)

    if (accessMode === 'admin') {
      const res = await login(identifier, password)
      setIsLoading(false)
      if (res.success) {
        setSuccessMsg('¡Sesión iniciada! Redirigiendo a Dashboard...')
        setTimeout(() => router.push('/admin'), 600)
      } else {
        setErrorMsg(res.message)
      }
    } else {
      const res = await loginCashier(identifier, password)
      setIsLoading(false)
      if (res.success) {
        setSuccessMsg('¡Acceso concedido! Redirigiendo al portal de cajero...')
        setTimeout(() => router.push('/cashier'), 600)
      } else {
        setErrorMsg(res.message)
      }
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#090d16] to-[#04060a]">
      {/* Top Header */}
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-gradient-to-tr from-cyan-500 to-pink-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]">
            <Shield className="size-6 text-white" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-wider bg-clip-text text-transparent bg-gradient-to-r from-cyan-300 via-white to-pink-400">
              SUGAR LUDO
            </h1>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">
              Hub Maestro & Red de Cajeros
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
            Servidor Online
          </span>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-cyan-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="size-4" /> Plataforma Administrativa Centralizada
          </div>
          <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
            Control Financiero & Operación de Cajeros
          </h2>
          <p className="text-slate-400 max-w-md mx-auto text-xs sm:text-sm">
            Selecciona tu rol para ingresar al panel de control correspondiente.
          </p>
        </div>

        {/* Dual Access Card with Integrated Selector */}
        <div className="w-full max-w-md p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-white/10 shadow-2xl backdrop-blur-xl space-y-6">
          {/* Role Mode Selector */}
          <div className="p-1.5 rounded-2xl bg-slate-950 border border-white/5 grid grid-cols-2 gap-1 text-xs font-bold">
            <button
              onClick={() => {
                setAccessMode('admin')
                setErrorMsg(null)
              }}
              className={clsx(
                'py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer',
                accessMode === 'admin'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Shield className="size-4" />
              <span>Super Admin</span>
            </button>

            <button
              onClick={() => {
                setAccessMode('cashier')
                setErrorMsg(null)
              }}
              className={clsx(
                'py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer',
                accessMode === 'cashier'
                  ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <CreditCard className="size-4" />
              <span>Cajero Autorizado</span>
            </button>
          </div>

          {/* Feedback Messages */}
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center gap-2.5 text-xs text-red-400 font-bold animate-in fade-in">
              <AlertCircle className="size-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-400 font-bold animate-in fade-in">
              <CheckCircle2 className="size-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider block">
                {accessMode === 'admin' ? 'Usuario o Correo de Administrador' : 'Correo de Cajero Autorizado'}
              </label>
              <div className="relative">
                <User className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={accessMode === 'admin' ? 'superadmin o admin@sugarludo.com' : 'carlos.cajero@sugarludo.com'}
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-slate-300 font-bold uppercase tracking-wider block">
                Contraseña
              </label>
              <div className="relative">
                <Lock className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-10 pr-11 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="size-4 text-cyan-400" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className={clsx(
                'w-full py-3 rounded-2xl text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg disabled:opacity-50',
                accessMode === 'admin'
                  ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.3)]'
                  : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.3)]'
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <KeyRound className="size-4" />
                  <span>Ingresar a {accessMode === 'admin' ? 'Panel Super Admin' : 'Portal de Cajeros'}</span>
                </>
              )}
            </button>
          </form>

          <div className="p-2 rounded-xl bg-slate-950/60 border border-white/5 text-[10px] text-slate-400 text-center font-mono leading-tight">
            {accessMode === 'admin' ? (
              <span>Credenciales: <strong className="text-cyan-300">superadmin</strong> / <strong className="text-cyan-300">SugarAdmin2026!</strong></span>
            ) : (
              <span>Credenciales: <strong className="text-pink-300">carlos.cajero@sugarludo.com</strong> / <strong className="text-pink-300">CajeroSugar2026!</strong></span>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 p-6 text-center text-xs text-slate-500">
        Sugar Ludo Decentralized Cashier Hub &bull; Protocolo Seguro de Liquidación Financiera &bull; {APP_VERSION_TAG}
      </footer>
    </div>
  )
}
