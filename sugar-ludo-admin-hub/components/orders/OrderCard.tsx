'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { CashierOrder } from '../../types/cashier'
import { ArrowDownLeft, ArrowUpRight, MessageSquare, Clock, ShieldCheck, Eye, AlertTriangle, Crown } from 'lucide-react'
import { clsx } from 'clsx'
import { cashierLogger } from '../../lib/cashier-logger'
import { getWithdrawalSla } from '../../lib/sla-calculator'

interface OrderCardProps {
  order: CashierOrder
  onViewReceipt?: (order: CashierOrder) => void
  onApproveOrder?: (orderId: string) => void
}

export function OrderCard({ order, onViewReceipt, onApproveOrder }: OrderCardProps) {
  const [, setTick] = useState(0)

  // Tick cada 30s para refrescar reloj regresivo de SLA
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  const slaInfo = getWithdrawalSla(order)
  const isDeposit = order.type === 'deposit'
  const isPaid = order.status === 'paid'
  const isCompleted = order.status === 'completed'
  const isDisputed = order.status === 'disputed'
  const isPending = order.status === 'pending'
  const isVip = slaInfo?.isVip ?? false

  const methodLabelMap: Record<string, string> = {
    pago_movil: 'Pago Móvil (VES)',
    transferencia: 'Transferencia Bancaria',
    nequi: 'Nequi (COP)',
    bancolombia: 'Bancolombia (COP)',
    mercadopago: 'MercadoPago',
    usdt_trc20: 'USDT (TRC-20)',
    usdt_trc20_vip: 'USDT VIP (TRC-20)',
    usdt_bep20: 'USDT (BEP-20)',
    binance_pay: 'Binance Pay ID',
    zelle: 'Zelle (USD)',
  }

  const displayPlayerId = order.playerId || (order.playerUid ? `SL-${order.playerUid.substring(0, 6).toUpperCase()}` : '')

  return (
    <div
      className={clsx(
        'group p-4 rounded-2xl transition-all duration-200 space-y-3 hover:shadow-xl border relative overflow-hidden',
        isVip && !isCompleted
          ? 'bg-gradient-to-br from-amber-950/35 via-slate-900/90 to-purple-950/30 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.18)] hover:border-amber-400'
          : isPending
          ? 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.12)] hover:border-amber-400'
          : isPaid
          ? 'bg-cyan-950/20 border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.12)] hover:border-cyan-400'
          : 'bg-slate-900/60 border-white/10 hover:border-white/20'
      )}
    >
      {/* Top Meta Line */}
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={clsx(
              'p-2 rounded-xl border shrink-0',
              isDeposit
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isVip
                ? 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.3)]'
                : 'bg-pink-500/10 text-pink-400 border-pink-500/30'
            )}
          >
            {isDeposit ? <ArrowDownLeft className="size-4" /> : isVip ? <Crown className="size-4 text-amber-400" /> : <ArrowUpRight className="size-4" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-white text-xs">#{order.id.slice(0, 8)}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold">• {isDeposit ? 'Depósito' : 'Retiro'}</span>
              {/* VIP / SLA Badge */}
              {slaInfo && (
                <span
                  className={clsx(
                    'px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider border shrink-0',
                    isVip
                      ? 'bg-gradient-to-r from-amber-500/25 to-yellow-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.25)] font-mono'
                      : 'bg-slate-800/80 text-slate-300 border-white/10'
                  )}
                >
                  {slaInfo.badgeLabel}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400 truncate">
              <span className="font-bold text-white truncate">{order.playerName}</span>
              {displayPlayerId && (
                <span className="font-mono text-[10px] text-cyan-300 font-bold bg-cyan-500/10 border border-cyan-500/25 px-1 rounded">
                  {displayPlayerId}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <span
          className={clsx(
            'px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0',
            isCompleted
              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
              : isDisputed
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              : isPaid
              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse font-extrabold'
              : isPending
              ? isVip
                ? 'bg-amber-500/30 text-amber-200 border-amber-500/70 animate-pulse font-black'
                : 'bg-amber-500/25 text-amber-300 border-amber-500/60 animate-pulse font-extrabold'
              : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
          )}
        >
          {order.status === 'paid' ? 'Comprobante' : order.status}
        </span>
      </div>

      {/* SLA Countdown Clock Bar for Active Withdrawals */}
      {slaInfo && !isCompleted && (
        <div
          className={clsx(
            'flex items-center justify-between px-3 py-1.5 rounded-xl border text-xs font-mono transition-all',
            slaInfo.isExpired
              ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.25)] font-black'
              : slaInfo.isUrgent
              ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 animate-pulse shadow-[0_0_15px_rgba(245,158,11,0.2)] font-bold'
              : isVip
              ? 'bg-amber-950/40 border-amber-500/30 text-amber-200 shadow-sm'
              : 'bg-slate-950/60 border-white/5 text-slate-300'
          )}
        >
          <div className="flex items-center gap-1.5">
            {slaInfo.isExpired ? (
              <AlertTriangle className="size-3.5 text-rose-400 shrink-0 animate-bounce" />
            ) : (
              <Clock className={clsx('size-3.5 shrink-0', isVip ? 'text-amber-400' : 'text-slate-400')} />
            )}
            <span className="text-[10px] font-sans font-bold uppercase tracking-wider">
              {slaInfo.isExpired ? 'SLA Vencido:' : 'Plazo SLA:'}
            </span>
          </div>
          <span className={clsx('text-[11px] font-black', slaInfo.isExpired ? 'text-rose-400' : isVip ? 'text-amber-300' : 'text-white')}>
            {slaInfo.formattedTime}
          </span>
        </div>
      )}

      {/* Financial Numbers Bar (Slim 1-line strip) */}
      <div className="flex items-center justify-between px-3 py-2 bg-slate-950/60 rounded-xl border border-white/5 text-xs">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase">Monto</span>
          <span className="text-sm font-black text-white font-mono">
            {order.amountFiat.toLocaleString()} {order.currency}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 block uppercase">Equivalente</span>
          <span className="text-xs font-black text-cyan-300 font-mono">
            {isDeposit ? '+' : '-'}{order.amountSugarCoins.toLocaleString()} SC
          </span>
        </div>
        <div className="text-right pl-2 border-l border-white/5">
          <span className="text-[10px] text-slate-400 block uppercase">Comisión</span>
          <span className="text-xs font-black text-emerald-400 font-mono">
            +{order.cashierCommissionCoins} SC
          </span>
        </div>
      </div>

      {/* Method & Ref */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
        <span className="truncate">
          Método: <strong className="text-cyan-300">{methodLabelMap[order.paymentMethod] || order.paymentMethod}</strong>
        </span>
        {order.receiptReferenceNumber && (
          <span className="font-mono text-slate-300 truncate max-w-[120px] bg-white/5 px-1.5 py-0.5 rounded">
            Ref: {order.receiptReferenceNumber}
          </span>
        )}
      </div>

      {/* Action Buttons Bar */}
      <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
        <Link
          href={`/cashier/orders/${order.id}`}
          onClick={() => {
            cashierLogger.click(`Gestionar / Chat para orden #${order.id.slice(0, 8)}`, {
              id: order.id,
              type: order.type,
              status: order.status,
              player: order.playerName
            })
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-colors"
        >
          <MessageSquare className="size-3.5 text-cyan-400" />
          <span>Chat / Gestión</span>
        </Link>

        <div className="flex items-center gap-1.5">
          {order.receiptUrl && onViewReceipt && (
            <button
              onClick={() => {
                cashierLogger.click(`Ver Comprobante de orden #${order.id.slice(0, 8)}`)
                onViewReceipt(order)
              }}
              className="p-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
              title="Ver Comprobante"
            >
              <Eye className="size-3.5" />
            </button>
          )}

          {isPaid && onApproveOrder && (
            <button
              onClick={() => {
                cashierLogger.click(`Liberar Saldo directo para orden #${order.id.slice(0, 8)}`)
                onApproveOrder(order.id)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black shadow-[0_0_15px_rgba(16,185,129,0.25)] transition-all cursor-pointer"
            >
              <ShieldCheck className="size-3.5" />
              <span>Liberar Saldo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
