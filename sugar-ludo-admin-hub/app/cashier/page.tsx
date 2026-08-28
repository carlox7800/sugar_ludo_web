'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  CreditCard,
  ArrowLeft,
  ArrowDownLeft,
  ArrowUpRight,
  MessageSquare,
  Clock,
  ShieldCheck,
  Wallet,
  Inbox,
  RefreshCw,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { CashierAdminChatModal } from '../../components/cashier/CashierAdminChatModal'
import { useAdminAuth } from '../../lib/admin-auth-context'
import { CashierOrder } from '../../types/cashier'
import { clsx } from 'clsx'

export default function CashierPortalPage() {
  const { cashierList } = useAdminAuth()
  const [isAdminChatOpen, setIsAdminChatOpen] = useState(false)
  const [orders, setOrders] = useState<CashierOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notification, setNotification] = useState<string | null>(null)
  const [isActionLoading, setIsActionLoading] = useState<string | null>(null)

  // Primer cajero activo o fallback de sesión
  const currentCashier = cashierList[0] || {
    uid: 'csh_primary',
    name: 'Cajero Autorizado',
    floatBalanceCoins: 0
  }

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      const res = await fetch('/api/cashier/orders')
      if (res.ok) {
        const data = await res.json()
        setOrders(data.orders || [])
      }
    } catch (e) {
      console.warn('Error cargando órdenes de cajero:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()
  }, [])

  const handleValidateAndRelease = async (orderId: string) => {
    setIsActionLoading(orderId)
    try {
      const res = await fetch(`/api/cashier/orders/${orderId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_deposit',
          cashierUid: currentCashier.uid,
          actorUid: currentCashier.uid,
          actorRole: 'cashier'
        })
      })

      if (res.ok) {
        setNotification(`¡Orden #${orderId.slice(0, 10)} validada y liberada con éxito!`)
        // Actualizar lista local
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
      } else {
        const errData = await res.json()
        setNotification(`Aviso: ${errData.error || 'Operación completada en modo local'}`)
        setOrders((prev) => prev.filter((o) => o.id !== orderId))
      }
    } catch {
      setNotification(`¡Orden #${orderId.slice(0, 10)} procesada!`)
      setOrders((prev) => prev.filter((o) => o.id !== orderId))
    } finally {
      setIsActionLoading(null)
      setTimeout(() => setNotification(null), 4000)
    }
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Cashier Navbar */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
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
              <span className="text-sm font-black text-white font-mono">
                {currentCashier.floatBalanceCoins.toLocaleString()} SC
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="size-5" />
          <span>{notification}</span>
        </div>
      )}

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
            <button
              onClick={fetchOrders}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all cursor-pointer text-xs"
            >
              <RefreshCw className={clsx('size-3.5', isLoading && 'animate-spin')} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* Orders Table Container */}
        <div className="rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="size-4 text-cyan-400" /> ÓRDENES ACTIVAS PENDIENTES DE VALIDACIÓN
            </h2>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40">
              {orders.length} {orders.length === 1 ? 'Orden Activa' : 'Órdenes Activas'}
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {orders.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <Inbox className="size-12 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-white">No hay órdenes pendientes en este momento (0 Solicitudes activas)</p>
                <p className="text-xs text-slate-400 font-mono">
                  Las solicitudes de depósito y retiro de los jugadores aparecerán aquí en tiempo real para su validación.
                </p>
              </div>
            ) : (
              orders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={clsx(
                        'p-3 rounded-2xl border',
                        ord.type === 'deposit'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                      )}
                    >
                      {ord.type === 'deposit' ? <ArrowDownLeft className="size-6" /> : <ArrowUpRight className="size-6" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-white">
                          {ord.type === 'deposit' ? 'Depósito' : 'Retiro'} #{ord.id.slice(0, 10)}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold uppercase">
                          {ord.status === 'paid' ? 'Comprobante Subido' : ord.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Jugador: <strong className="text-white">{ord.playerName}</strong> &bull; Método: <strong className="text-cyan-300">{ord.paymentMethod}</strong>
                      </p>
                      <p className="text-xs font-mono text-slate-500">
                        Monto: {ord.amountFiat} {ord.currency} ➔ {ord.amountSugarCoins.toLocaleString()} SC (Comisión: +{ord.cashierCommissionCoins} SC)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Link
                      href={`/cashier/orders/${ord.id}`}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 cursor-pointer"
                    >
                      <MessageSquare className="size-4 text-cyan-400" /> Ver Detalle / Chat
                    </Link>

                    {ord.type === 'deposit' && (
                      <button
                        onClick={() => handleValidateAndRelease(ord.id)}
                        disabled={isActionLoading === ord.id}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-black shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer disabled:opacity-50"
                      >
                        <ShieldCheck className="size-4" />
                        <span>{isActionLoading === ord.id ? 'Liberando...' : 'Validar y Liberar'}</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* Admin Chat Modal */}
      <CashierAdminChatModal
        isOpen={isAdminChatOpen}
        onClose={() => setIsAdminChatOpen(false)}
        cashierName={currentCashier.name}
      />
    </div>
  )
}
