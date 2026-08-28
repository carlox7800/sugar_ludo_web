'use client'

import React, { useState } from 'react'
import { UserPlus, X, ShieldCheck, Upload, Eye, EyeOff, Lock, Mail, CreditCard, DollarSign } from 'lucide-react'
import { CashierManagementProfile } from '../../types/admin-expanded'

interface RegisterCashierModalProps {
  isOpen: boolean
  onClose: () => void
  onRegister: (newCashier: CashierManagementProfile, pass?: string) => void
}

export function RegisterCashierModal({ isOpen, onClose, onRegister }: RegisterCashierModalProps) {
  const [fullName, setFullName] = useState('')
  const [idDocument, setIdDocument] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [initialFloat, setInitialFloat] = useState(25000)
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSimulateIdUpload = () => {
    setIdPhotoUrl('https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000')
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!fullName.trim() || !idDocument.trim() || !email.trim() || !password.trim()) {
      setError('Por favor completa todos los campos requeridos.')
      return
    }

    const newCashier: CashierManagementProfile = {
      uid: `csh_${Date.now()}`,
      name: `${fullName.trim()} (Cajero Oficial)`,
      email: email.trim(),
      avatarUrl: 'https://i.ibb.co/3YBC35Xm/avatar-1786744277377.jpg',
      shiftStatus: 'on_shift',
      floatBalanceCoins: initialFloat,
      assignedShiftAt: Date.now(),
      lastRechargeAt: Date.now(),
      ordersCompletedToday: 0,
      commissionEarnedTodayCoins: 0,
      paymentMethodsCount: 2
    }

    onRegister(newCashier, password.trim())
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <UserPlus className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white uppercase tracking-wider">REGISTRO Y ALTA DE NUEVO CAJERO</h3>
              <p className="text-[11px] text-slate-400 font-mono">Credenciales institucionales y asignación de float</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase block">Nombre y Apellido *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej. Pedro Gómez"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase block">Documento de Identidad / Cédula *</label>
              <input
                type="text"
                required
                value={idDocument}
                onChange={(e) => setIdDocument(e.target.value)}
                placeholder="Ej. V-28.492.193"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase block">Correo Electrónico / Contacto *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="pedro.cajero@sugarludo.com"
                className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-bold uppercase block">Contraseña Inicial de Acceso *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 pr-10 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1 cursor-pointer"
                  title={showPassword ? 'Ocultar contraseña' : 'Ver contraseña'}
                >
                  {showPassword ? <EyeOff className="size-4 text-pink-400" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Initial Float Assignment */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[10px] text-pink-300 font-bold uppercase block">Saldo Flotante Inicial Asignado (SC)</label>
              <span className="text-[11px] font-mono text-slate-400 font-bold">${(initialFloat / 100).toFixed(2)} USDT</span>
            </div>
            <input
              type="number"
              value={initialFloat}
              onChange={(e) => setInitialFloat(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-pink-300 focus:outline-none focus:border-pink-400"
            />
          </div>

          {/* ID Document Photo Upload */}
          <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase">Foto / Captura de Cédula de Identidad</span>
              {idPhotoUrl && <span className="text-[10px] text-emerald-400 font-bold">Cargada con éxito</span>}
            </div>

            {idPhotoUrl ? (
              <div className="flex items-center justify-between p-2 bg-slate-900 rounded-xl border border-white/10">
                <span className="text-[11px] text-slate-300 truncate max-w-[240px]">documento_identidad_validado.jpg</span>
                <button
                  type="button"
                  onClick={() => setIdPhotoUrl(null)}
                  className="text-rose-400 text-xs hover:underline cursor-pointer"
                >
                  Quitar
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSimulateIdUpload}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-white/15 text-slate-300 text-xs font-semibold cursor-pointer transition-colors"
              >
                <Upload className="size-4 text-cyan-400" />
                <span>Adjuntar Fotografía del Documento</span>
              </button>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all cursor-pointer"
            >
              <ShieldCheck className="size-4" />
              <span>Registrar y Activar Cajero</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
