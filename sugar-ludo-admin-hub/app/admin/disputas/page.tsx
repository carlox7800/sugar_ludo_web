'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '../../../lib/admin-auth-context'
import { MOCK_DISPUTE_CASES as MOCK_DISPUTES } from '../../../lib/mock-treasury'
import { DisputeCase } from '../../../types/treasury'
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Eye,
  MessageSquare,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  User,
  LogOut
} from 'lucide-react'
import { clsx } from 'clsx'

export default function DisputasAdminPage() {
  const router = useRouter()
  const { adminUser, isAuthenticated, isLoading, logout } = useAdminAuth()

  const [disputes, setDisputes] = useState<DisputeCase[]>(MOCK_DISPUTES)
  const [notification, setNotification] = useState<string | null>(null)

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
        Cargando módulo de arbitraje y disputas...
      </div>
    )
  }

  const handleResolvePlayer = async (disputeId: string) => {
    if (!adminUser) return
    setDisputes((prev) =>
      prev.map((d) =>
        d.id === disputeId
          ? {
              ...d,
              status: 'resolved_player',
              resolvedBy: adminUser.displayName,
              resolvedAt: Date.now(),
              resolutionNotes: 'Dictamen favorable para el jugador. Fondos acreditados.'
            }
          : d
      )
    )
    setNotification('Dictamen ejecutado: Saldo acreditado al jugador atómicamente.')

    try {
      await fetch('/api/disputes/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId,
          verdict: 'favor_player',
          adminUid: adminUser.uid,
          adminName: adminUser.displayName
        })
      })
    } catch (e) {
      console.warn('[Disputas] API sync error:', e)
    }

    setTimeout(() => setNotification(null), 4000)
  }

  const handleResolveCashier = async (disputeId: string) => {
    if (!adminUser) return
    setDisputes((prev) =>
      prev.map((d) =>
        d.id === disputeId
          ? {
              ...d,
              status: 'resolved_cashier',
              resolvedBy: adminUser.displayName,
              resolvedAt: Date.now(),
              resolutionNotes: 'Dictamen a favor del cajero. Fondos desbloqueados de garantía.'
            }
          : d
      )
    )
    setNotification('Dictamen ejecutado: Orden cancelada y saldo de garantía liberado al cajero.')

    try {
      await fetch('/api/disputes/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disputeId,
          verdict: 'favor_cashier',
          adminUid: adminUser.uid,
          adminName: adminUser.displayName
        })
      })
    } catch (e) {
      console.warn('[Disputas] API sync error:', e)
    }

    setTimeout(() => setNotification(null), 4000)
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
              <ShieldAlert className="size-5 text-amber-400" /> MEDIACIÓN Y RESOLUCIÓN DE DISPUTAS
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              admin.sugarludo.com &bull; Arbitraje Financiero y Veredicto Atómico
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/perfil"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Mi Perfil"
          >
            <User className="size-4" />
          </Link>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="size-5" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        <div className="rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="size-4 text-amber-400" /> CASOS DE DISPUTA ACTIVOS ({disputes.length})
            </h2>
          </div>

          <div className="divide-y divide-white/5">
            {disputes.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <ShieldCheck className="size-12 text-emerald-500/60 mx-auto" />
                <p className="text-sm font-bold text-white">No hay disputas activas en este momento (0 Casos)</p>
                <p className="text-xs text-slate-400 font-mono">
                  Todas las órdenes P2P y transacciones se encuentran en estado normal y sin mediación pendiente.
                </p>
              </div>
            ) : (
              disputes.map((caseItem) => {
                const isResolved = caseItem.status.startsWith('resolved')

                return (
                  <div key={caseItem.id} className="p-6 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-bold text-white">Caso #{caseItem.id}</span>
                        <span
                          className={clsx(
                            'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                            caseItem.status === 'open'
                              ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          )}
                        >
                          {caseItem.status === 'open' ? 'En Mediación' : 'Dictamen Resuelto'}
                        </span>
                      </div>

                      <div className="text-right font-mono">
                        <span className="text-xs text-slate-400 block">Monto en Disputa:</span>
                        <span className="text-sm font-black text-pink-400">
                          {caseItem.amountSugarCoins.toLocaleString()} SC (${(caseItem.amountSugarCoins / 100).toFixed(2)} USDT)
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                        <span className="text-slate-500 font-bold uppercase block text-[10px]">Partes Involucradas</span>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Jugador:</span>
                            <span className="text-white font-bold">{caseItem.playerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Cajero Asignado:</span>
                            <span className="text-pink-300 font-bold">{caseItem.cashierName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Orden Vinculada:</span>
                            <span className="font-mono text-slate-300">#{caseItem.orderId}</span>
                          </div>
                        </div>
                      </div>

                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                        <span className="text-slate-500 font-bold uppercase block text-[10px]">Motivo del Reclamo</span>
                        <p className="text-slate-300 leading-relaxed">{caseItem.reason}</p>
                        {caseItem.evidenceReceiptUrl && (
                          <div className="pt-2">
                            <a
                              href={caseItem.evidenceReceiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 font-bold underline"
                            >
                              <ExternalLink className="size-3.5" />
                              <span>Ver Comprobante Adjunto</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Veredicto de Resolución */}
                    {isResolved ? (
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold">
                          <CheckCircle className="size-4" />
                          <span>Dictamen Emitido por {caseItem.resolvedBy}</span>
                        </div>
                        <p className="text-slate-300">{caseItem.resolutionNotes}</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                        <button
                          onClick={() => handleResolveCashier(caseItem.id)}
                          className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all cursor-pointer"
                        >
                          Dictaminar a Favor del Cajero
                        </button>
                        <button
                          onClick={() => handleResolvePlayer(caseItem.id)}
                          className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 text-xs font-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer"
                        >
                          Acreditar al Jugador (Dictamen Favorable)
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
