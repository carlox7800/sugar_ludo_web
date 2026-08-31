'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  ShieldCheck,
  Lock,
  Mail,
  User,
  CreditCard,
  Phone,
  FileText,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  AlertTriangle,
  KeyRound
} from 'lucide-react'
import { CashierManagementProfile } from '../../types/admin-expanded'

interface EditCashierModalProps {
  isOpen: boolean
  onClose: () => void
  cashier: CashierManagementProfile | null
  onSave: (uid: string, updates: Partial<CashierManagementProfile>, newPassword?: string) => Promise<void>
}

export function EditCashierModal({ isOpen, onClose, cashier, onSave }: EditCashierModalProps) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [idDocument, setIdDocument] = useState('')
  const [shiftStatus, setShiftStatus] = useState<'on_shift' | 'off_shift' | 'break'>('on_shift')

  // Payment Methods
  const [hasPagoMovil, setHasPagoMovil] = useState(true)
  const [hasBankTransfer, setHasBankTransfer] = useState(true)
  const [hasCryptoUSDT, setHasCryptoUSDT] = useState(true)

  // Password Reset / Change
  const [changePassword, setChangePassword] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (cashier) {
      setName(cashier.name || '')
      setEmail(cashier.email || '')
      setPhone(cashier.phone || '+58 412 000 0000')
      setIdDocument(cashier.idDocument || 'V-00000000')
      setShiftStatus(cashier.shiftStatus || 'on_shift')
      
      const methods = cashier.assignedPaymentMethods || []
      setHasPagoMovil(methods.length === 0 || methods.some(m => m.toLowerCase().includes('pago') || m.toLowerCase().includes('móvil')))
      setHasBankTransfer(methods.length === 0 || methods.some(m => m.toLowerCase().includes('transferencia') || m.toLowerCase().includes('banco')))
      setHasCryptoUSDT(methods.length === 0 || methods.some(m => m.toLowerCase().includes('usdt') || m.toLowerCase().includes('cripto') || m.toLowerCase().includes('binance')))
      
      setChangePassword(false)
      setNewPassword('')
      setConfirmPassword('')
      setError(null)
    }
  }, [cashier, isOpen])

  if (!isOpen || !cashier) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!name.trim() || !email.trim()) {
      setError('El nombre y el correo electrónico son obligatorios.')
      return
    }

    if (changePassword) {
      if (!newPassword.trim()) {
        setError('Por favor ingrese la nueva contraseña.')
        return
      }
      if (newPassword.trim().length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.')
        return
      }
      if (newPassword.trim() !== confirmPassword.trim()) {
        setError('Las contraseñas no coinciden.')
        return
      }
    }

    const assignedPaymentMethods: string[] = []
    if (hasPagoMovil) assignedPaymentMethods.push('Pago Móvil (VES)')
    if (hasBankTransfer) assignedPaymentMethods.push('Transferencia Bancaria')
    if (hasCryptoUSDT) assignedPaymentMethods.push('Binance Pay / USDT BEP-20')

    setIsSaving(true)

    try {
      await onSave(
        cashier.uid,
        {
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          idDocument: idDocument.trim(),
          shiftStatus,
          assignedPaymentMethods,
          paymentMethodsCount: assignedPaymentMethods.length
        },
        changePassword ? newPassword.trim() : undefined
      )
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Error al guardar cambios.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-6 max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-3">
            <img
              src={cashier.avatarUrl || 'https://i.ibb.co/3YBC35Xm/avatar-1786744277377.jpg'}
              alt={cashier.name}
              className="size-11 rounded-2xl object-cover border border-white/10"
            />
            <div>
              <h3 className="font-black text-sm text-white uppercase tracking-wider">EDITAR CAJERO Y CREDENCIALES</h3>
              <p className="text-[10px] text-slate-400 font-mono">
                UID: <strong className="text-cyan-300">{cashier.uid}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1">
          {/* Datos Personales */}
          <div className="space-y-3">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              1. Información Personal y de Contacto
            </span>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase block">Nombre de Cajero *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej. Carlos (Cajero Oficial)"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase block">Correo de Acceso *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="cajero@sugarludo.com"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase block">Teléfono / WhatsApp</label>
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+58 412 000 0000"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-400 font-bold uppercase block">Documento / Cédula</label>
                <input
                  type="text"
                  value={idDocument}
                  onChange={(e) => setIdDocument(e.target.value)}
                  placeholder="V-12345678"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Métodos de Pago Asignados */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
              2. Métodos de Pago Habilitados para Operar
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-white/5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={hasPagoMovil}
                  onChange={(e) => setHasPagoMovil(e.target.checked)}
                  className="accent-pink-500 rounded"
                />
                <span className="text-white">Pago Móvil</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-white/5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={hasBankTransfer}
                  onChange={(e) => setHasBankTransfer(e.target.checked)}
                  className="accent-pink-500 rounded"
                />
                <span className="text-white">Transf. Bancaria</span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-slate-950 border border-white/5 cursor-pointer text-[11px]">
                <input
                  type="checkbox"
                  checked={hasCryptoUSDT}
                  onChange={(e) => setHasCryptoUSDT(e.target.checked)}
                  className="accent-pink-500 rounded"
                />
                <span className="text-white">USDT Cripto</span>
              </label>
            </div>
          </div>

          {/* Recuperación / Cambio de Contraseña */}
          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <KeyRound className="size-3.5 text-cyan-400" /> 3. Seguridad y Contraseña
              </span>
              <label className="flex items-center gap-1.5 text-[11px] text-cyan-300 font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={changePassword}
                  onChange={(e) => setChangePassword(e.target.checked)}
                  className="accent-cyan-500 rounded"
                />
                <span>Restablecer Contraseña</span>
              </label>
            </div>

            {changePassword ? (
              <div className="p-3 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-2.5 animate-in fade-in">
                <p className="text-[10px] text-slate-400">
                  Ingresa la nueva clave para que el cajero pueda iniciar sesión con ella de inmediato.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 uppercase font-mono block">Nueva Contraseña</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 pr-8"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                      >
                        {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] text-slate-400 uppercase font-mono block">Confirmar Contraseña</label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repetir contraseña"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 font-mono italic">
                Contraseña actual protegida. Marca la casilla si el cajero olvidó su clave o deseas cambiarla.
              </p>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 font-black transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSaving ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Save className="size-4" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
