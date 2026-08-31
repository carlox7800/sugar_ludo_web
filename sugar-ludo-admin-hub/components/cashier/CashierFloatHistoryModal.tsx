'use client'

import React, { useState, useEffect } from 'react'
import { X, Wallet, ArrowDownLeft, ArrowUpRight, Plus, Copy, Check, Clock, ShieldCheck, RefreshCw, FileText } from 'lucide-react'
import { db } from '../../lib/firebase'
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore'
import { CashierManagementProfile } from '../../types/admin-expanded'
import { CashierOrder } from '../../types/cashier'

export interface CashierLedgerEntry {
  id: string
  cashierUid: string
  cashierName?: string
  type: 'initial_shift' | 'withdrawal_payout' | 'recharge_float'
  orderId?: string
  referenceNumber?: string
  requestedFiatUSD?: number
  feeFiatUSD?: number
  feePercent?: number
  amountFiatUSD: number
  amountCoins: number
  resultingBalanceUSDT: number
  resultingBalanceCoins: number
  timestamp: number
  notes?: string
}

interface CashierFloatHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  cashier: CashierManagementProfile
  orders?: CashierOrder[]
}

export function CashierFloatHistoryModal({ isOpen, onClose, cashier, orders = [] }: CashierFloatHistoryModalProps) {
  const [entries, setEntries] = useState<CashierLedgerEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen || !cashier?.uid) return

    setIsLoading(true)

    // 1. Escuchar registros reales de cashier_shifts_ledger en Firestore ($0 Spark Plan)
    let unsubscribe: (() => void) | null = null
    try {
      const q = query(
        collection(db, 'cashier_shifts_ledger'),
        where('cashierUid', '==', cashier.uid),
        limit(50)
      )

      unsubscribe = onSnapshot(q, (snapshot) => {
        const liveEntries: CashierLedgerEntry[] = []
        snapshot.forEach((docSnap) => {
          liveEntries.push({ id: docSnap.id, ...docSnap.data() } as CashierLedgerEntry)
        })

        // Si existen registros en Firestore, ordenarlos cronológicamente descendente
        if (liveEntries.length > 0) {
          liveEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
          setEntries(liveEntries)
          setIsLoading(false)
          return
        }

        // Si aún no hay registros explícitos en Firestore, sintetizar a partir de órdenes completadas del cajero
        const synthEntries: CashierLedgerEntry[] = []
        const currentFloatUSDT = (cashier as any).floatBalanceUSDT ?? (cashier.floatBalanceCoins / 100)
        const initialShiftUSDT = (cashier as any).initialShiftFloatUSDT ?? 300.0

        // Retiros completados
        const cashierCompletedWithdrawals = orders.filter(
          (o) => o.type === 'withdraw' && o.status === 'completed'
        )

        let runningBalance = currentFloatUSDT

        cashierCompletedWithdrawals.forEach((ord) => {
          const isVip = Boolean((ord as any).isVip || (ord as any).isVipWithdraw || ord.paymentMethod === 'usdt_bep20')
          const feePercent = isVip ? 0.10 : 0.05
          const requestedUSD = Number(ord.amountFiat || (ord.amountSugarCoins / 100))
          const feeUSD = parseFloat((requestedUSD * feePercent).toFixed(2))
          const netPayoutUSD = parseFloat((requestedUSD - feeUSD).toFixed(2))

          synthEntries.push({
            id: `synth_wit_${ord.id}`,
            cashierUid: cashier.uid,
            cashierName: cashier.name,
            type: 'withdrawal_payout',
            orderId: ord.id,
            referenceNumber: ord.receiptReferenceNumber || `TX-PAYOUT-${ord.id.slice(0, 8)}`,
            requestedFiatUSD: requestedUSD,
            feeFiatUSD: feeUSD,
            feePercent: feePercent,
            amountFiatUSD: -netPayoutUSD,
            amountCoins: -Math.round(netPayoutUSD * 100),
            resultingBalanceUSDT: runningBalance,
            resultingBalanceCoins: Math.round(runningBalance * 100),
            timestamp: ord.completedAt || ord.createdAt || Date.now(),
            notes: `Liquidación Retiro #${ord.id.slice(0, 8)} (${ord.paymentMethod.toUpperCase()})`
          })
        })

        // Asignación inicial de turno
        synthEntries.push({
          id: `synth_init_${cashier.uid}`,
          cashierUid: cashier.uid,
          cashierName: cashier.name,
          type: 'initial_shift',
          amountFiatUSD: initialShiftUSDT,
          amountCoins: Math.round(initialShiftUSDT * 100),
          resultingBalanceUSDT: initialShiftUSDT,
          resultingBalanceCoins: Math.round(initialShiftUSDT * 100),
          referenceNumber: `SHIFT-${cashier.uid.slice(-6).toUpperCase()}`,
          timestamp: cashier.assignedShiftAt || Date.now() - 3600000,
          notes: 'Asignación Inicial de Saldo Flotante para el Turno'
        })

        synthEntries.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        setEntries(synthEntries)
        setIsLoading(false)
      }, (err) => {
        console.warn('[FloatHistory] Snapshot notice:', err?.message)
        setIsLoading(false)
      })
    } catch {
      setIsLoading(false)
    }

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [isOpen, cashier, orders])

  if (!isOpen) return null

  const handleCopy = (text: string, id: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  const currentUSDT = (cashier as any).floatBalanceUSDT ?? (cashier.floatBalanceCoins / 100)
  const initialUSDT = (cashier as any).initialShiftFloatUSDT ?? 300.0
  const totalPaidUSDT = (cashier as any).totalPaidWithdrawalsUSDT ?? Math.max(0, initialUSDT - currentUSDT)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl max-h-[90vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-white/10 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
              <Wallet className="size-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-white uppercase tracking-wider flex items-center gap-2">
                HISTORIAL Y ARQUEO DE SALDO FLOTANTE
              </h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Cajero: <strong className="text-cyan-300">{cashier.name}</strong> &bull; UID: {cashier.uid}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Summary Metric Strip */}
        <div className="grid grid-cols-3 gap-3 p-4 bg-slate-950/40 border-b border-white/5 text-center">
          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Flotante Actual</span>
            <span className="text-sm font-black text-emerald-400 font-mono">${currentUSDT.toFixed(2)} USDT</span>
            <span className="text-[9px] text-slate-500 font-mono block">({cashier.floatBalanceCoins.toLocaleString()} SC)</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Asignación de Turno</span>
            <span className="text-sm font-black text-cyan-400 font-mono">${initialUSDT.toFixed(2)} USDT</span>
            <span className="text-[9px] text-slate-500 font-mono block">Capital Inicial</span>
          </div>

          <div className="p-3 rounded-2xl bg-white/5 border border-white/5">
            <span className="text-[10px] text-slate-400 font-bold uppercase block">Retiros Liquidados</span>
            <span className="text-sm font-black text-rose-400 font-mono">-${totalPaidUSDT.toFixed(2)} USDT</span>
            <span className="text-[9px] text-slate-500 font-mono block">Transferido a Jugadores</span>
          </div>
        </div>

        {/* Movements Feed List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {isLoading ? (
            <div className="p-12 text-center text-cyan-400 font-mono text-xs flex items-center justify-center gap-2">
              <RefreshCw className="size-4 animate-spin" />
              <span>Consultando libro contable de caja...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-12 text-center text-slate-500 font-mono text-xs space-y-1">
              <FileText className="size-8 mx-auto text-slate-600 mb-2" />
              <p>No se encontraron movimientos registrados en este turno.</p>
            </div>
          ) : (
            entries.map((entry) => {
              const isPayout = entry.type === 'withdrawal_payout'
              const isRecharge = entry.type === 'recharge_float'
              const isInitial = entry.type === 'initial_shift'

              const dateFormatted = new Date(entry.timestamp).toLocaleDateString('es-ES', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })

              return (
                <div
                  key={entry.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-white/5 hover:border-white/15 transition-all flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isPayout 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : isRecharge 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    }`}>
                      {isPayout ? <ArrowDownLeft className="size-4" /> : isRecharge ? <Plus className="size-4" /> : <ArrowUpRight className="size-4" />}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white text-xs">
                          {isPayout ? 'Retiro Pagado y Liquidado' : isRecharge ? 'Recarga de Saldo Flotante' : 'Asignación de Turno Inicial'}
                        </span>
                        {entry.orderId && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-white/5 text-slate-400 font-mono">
                            #{entry.orderId.slice(0, 8)}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-400 font-mono truncate">
                        {entry.notes || (isPayout ? 'Liquidación de Retiro P2P' : 'Movimiento de Flotante')}
                      </p>

                      <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {dateFormatted}
                        </span>

                        {entry.referenceNumber && (
                          <button
                            onClick={() => handleCopy(entry.referenceNumber!, entry.id)}
                            className="flex items-center gap-1 hover:text-cyan-300 transition-colors cursor-pointer text-[10px]"
                            title="Copiar Referencia"
                          >
                            <span>Ref: {entry.referenceNumber.slice(0, 14)}...</span>
                            {copiedId === entry.id ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Amounts & Resulting Balance */}
                  <div className="text-right shrink-0 space-y-0.5">
                    <span className={`text-sm font-black font-mono block ${isPayout ? 'text-rose-400' : 'text-emerald-400'}`}>
                      {entry.amountFiatUSD > 0 ? `+$${entry.amountFiatUSD.toFixed(2)}` : `-$${Math.abs(entry.amountFiatUSD).toFixed(2)}`} USDT
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 block">
                      Saldo: <strong className="text-white">${(entry.resultingBalanceUSDT ?? currentUSDT).toFixed(2)}</strong>
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-950/60 flex items-center justify-between text-xs">
          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-emerald-400" /> Arqueo en vivo &bull; Costo $0 Spark Firestore
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-bold transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
