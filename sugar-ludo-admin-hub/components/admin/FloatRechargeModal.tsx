'use client'

import React, { useState } from 'react'
import { CashierManagementProfile } from '../../types/admin-expanded'
import { Wallet, X, ArrowUpRight, ShieldCheck, DollarSign } from 'lucide-react'

interface FloatRechargeModalProps {
  isOpen: boolean
  onClose: () => void
  cashier: CashierManagementProfile | null
  onRecharge: (cashierUid: string, amountUSDT: number, notes: string) => void
}

export function FloatRechargeModal({ isOpen, onClose, cashier, onRecharge }: FloatRechargeModalProps) {
  const [amountUSDT, setAmountUSDT] = useState<number>(200)
  const [notes, setNotes] = useState<string>('Asignación de capital flotante para turno')

  if (!isOpen || !cashier) return null

  const amountCoins = Math.round(amountUSDT * 100)
  const currentFloatUSDT = (cashier as any).floatBalanceUSDT ?? (cashier.floatBalanceCoins / 100)

  const handleConfirm = () => {
    onRecharge(cashier.uid, amountUSDT, notes)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-md bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl space-y-4 p-6">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Wallet className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">ASIGNACIÓN DE SALDO FLOTANTE DE TURNO</h3>
              <p className="text-xs text-slate-400">{cashier.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white">
            <X className="size-4" />
          </button>
        </div>

        {/* Current Balance & Adjustment */}
        <div className="p-4 bg-slate-950 rounded-2xl border border-white/5 space-y-3 text-xs">
          <div className="flex items-center justify-between text-slate-400">
            <span>Saldo Flotante Actual:</span>
            <span className="font-mono font-bold text-emerald-300 text-sm">
              ${currentFloatUSDT.toFixed(2)} USDT <span className="text-[11px] text-slate-500 font-normal">({cashier.floatBalanceCoins.toLocaleString()} SC)</span>
            </span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-emerald-300 font-bold uppercase block">Capital a Asignar / Recargar (USDT):</span>
            <input
              type="number"
              step="any"
              value={amountUSDT}
              onChange={(e) => setAmountUSDT(parseFloat(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-emerald-500/40 rounded-xl px-3 py-2 text-base font-black text-emerald-300 font-mono focus:outline-none focus:border-emerald-400"
            />
            <span className="text-[10px] text-slate-500 block">Equivalente Sugar Coins: +{amountCoins.toLocaleString()} SC</span>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Notas Contables / Turno:</span>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(236,72,153,0.3)] transition-all cursor-pointer"
          >
            <ShieldCheck className="size-4" />
            <span>Confirmar y Acreditar</span>
          </button>
        </div>
      </div>
    </div>
  )
}
