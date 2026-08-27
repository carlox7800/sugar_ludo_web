'use client'

import React, { useState } from 'react'
import { useAdminAuth } from '../../lib/admin-auth-context'
import { Shield, Lock, User, KeyRound, AlertCircle, Sparkles, Loader2, CheckCircle2 } from 'lucide-react'

export function AdminLoginForm() {
  const { login } = useAdminAuth()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!identifier.trim() || !password.trim()) {
      setErrorMsg('Por favor complete todos los campos.')
      return
    }

    setIsLoading(true)
    setErrorMsg(null)

    const res = await login(identifier, password)
    setIsLoading(false)

    if (res.success) {
      setSuccessMsg(res.message)
    } else {
      setErrorMsg(res.message)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#090d16] to-[#04060a] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo & Title */}
        <div className="text-center space-y-2">
          <div className="size-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-pink-500 p-0.5 mx-auto shadow-[0_0_30px_rgba(6,182,212,0.4)] flex items-center justify-center">
            <div className="size-full bg-slate-950 rounded-[22px] flex items-center justify-center">
              <Shield className="size-8 text-cyan-400" />
            </div>
          </div>

          <h1 className="text-2xl font-black text-white tracking-wide">
            ACCESO SUPER ADMIN
          </h1>
          <p className="text-xs text-slate-400 font-mono">
            Sugar Ludo &bull; Hub Administrativo y Control Financiero
          </p>
        </div>

        {/* Login Form Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/80 border border-white/10 shadow-2xl backdrop-blur-xl space-y-5">
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

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-bold uppercase tracking-wider block">
                Usuario o Correo
              </label>
              <div className="relative">
                <User className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="superadmin o admin@sugarludo.com"
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs text-slate-300 font-bold uppercase tracking-wider block">
                Contraseña Maestra
              </label>
              <div className="relative">
                <Lock className="size-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono transition-colors"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_25px_rgba(6,182,212,0.35)] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Verificando Credenciales...</span>
                </>
              ) : (
                <>
                  <KeyRound className="size-4" />
                  <span>Ingresar al Hub Administrativo</span>
                </>
              )}
            </button>
          </form>

          <div className="p-3 rounded-2xl bg-slate-950/60 border border-white/5 text-[11px] text-slate-400 text-center font-mono">
            <span>Acceso seguro protegido por sesión cifrada local y token de administración.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
