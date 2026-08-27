'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { CreditCard, ArrowLeft, ArrowDownLeft, ArrowUpRight, MessageSquare, Clock, ShieldCheck, Wallet, UserCheck } from 'lucide-react'
import { CashierAdminChatModal } from '../../components/cashier/CashierAdminChatModal'

export default function CashierPortalPage() {
  const [isAdminChatOpen, setIsAdminChatOpen] = useState(false)
  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Cashier Navbar */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="font-black text-base text-white tracking-wide flex items-center gap-2">
              <CreditCard className="size-5 text-pink-400" /> PORTAL DE CAJEROS AUTORIZADOS
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">cajeros.sugarludo.com &bull; Bandeja de Órdenes P2P</p>
          </div>
        </div>

        {/* Float Balance Pill and Staff Chat Button */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAdminChatOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <MessageSquare className="size-4" />
            <span>Chat con Administrador</span>
          </button>

          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 border border-pink-500/30 shadow-sm">
            <Wallet className="size-4 text-pink-400" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Saldo Flotante</span>
              <span className="text-sm font-black text-white font-mono">50,000 SC</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Cashier Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-white/10">
          <div className="flex items-center gap-3">
            <span className="size-3 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold text-white uppercase tracking-wider">Estado: Recibiendo Órdenes</span>
          </div>
          <div className="flex items-center gap-6 text-xs font-semibold text-slate-400">
            <span>Comisión Depósitos: <strong className="text-cyan-400">2.0%</strong></span>
            <span>Comisión Retiros: <strong className="text-pink-400">3.0%</strong></span>
            <span>Ganancias Hoy: <strong className="text-emerald-400 font-mono">+1,250 SC</strong></span>
          </div>
        </div>

        {/* Orders Table Container */}
        <div className="rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="size-4 text-cyan-400" /> ÓRDENES ACTIVAS PENDIENTES DE VALIDACIÓN
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
              1 Orden Activa
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {/* Sample Active Order */}
            <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <ArrowDownLeft className="size-6" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-sm text-white">Depósito #DEP-84920</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold uppercase">
                      Comprobante Subido
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Jugador: <strong className="text-white">carlosandroid</strong> &bull; Método: <strong className="text-cyan-300">Pago Móvil (VES)</strong>
                  </p>
                  <p className="text-xs font-mono text-slate-500">Monto: 1,500.00 VES ➔ +3,000 SC (Comisión: +60 SC)</p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 cursor-pointer">
                  <MessageSquare className="size-4 text-cyan-400" /> Chat con Jugador
                </button>
                <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer">
                  <ShieldCheck className="size-4" /> Validar y Liberar
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Admin Chat Modal */}
      <CashierAdminChatModal
        isOpen={isAdminChatOpen}
        onClose={() => setIsAdminChatOpen(false)}
        cashierName="carlosandroid (Cajero)"
      />
    </div>
  )
}
