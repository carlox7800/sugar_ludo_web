'use client'

import React, { useState } from 'react'
import { Calendar, Clock, X, CheckCircle, Zap, ShieldCheck } from 'lucide-react'

interface ScheduleUpdateModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmSchedule: (scheduledDate: string, scheduledTime: string) => void
}

export function ScheduleUpdateModal({ isOpen, onClose, onConfirmSchedule }: ScheduleUpdateModalProps) {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const defaultDateStr = tomorrow.toISOString().split('T')[0]

  const [date, setDate] = useState(defaultDateStr)
  const [time, setTime] = useState('04:00') // 4:00 AM (mantenimiento usual)

  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirmSchedule(date, time)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Calendar className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white uppercase tracking-wider">PROGRAMAR ACTIVACIÓN DE TIENDA</h3>
              <p className="text-[11px] text-slate-400 font-mono">Definir fecha y hora de aplicación automática</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        {/* Inputs */}
        <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 space-y-4 text-xs">
          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
              <Calendar className="size-3.5 text-cyan-400" /> Fecha de Activación:
            </span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1.5">
              <Clock className="size-3.5 text-pink-400" /> Hora de Activación:
            </span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-pink-400"
            />
          </div>

          <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 text-[11px] text-purple-200">
            Los precios de la tienda, paquetes de SC y comisiones de Rake cambiarán de forma desatendida en la fecha programada.
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-400 hover:to-purple-500 text-white text-xs font-black shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-all cursor-pointer"
          >
            <ShieldCheck className="size-4" />
            <span>Confirmar Programación</span>
          </button>
        </div>

      </div>
    </div>
  )
}
