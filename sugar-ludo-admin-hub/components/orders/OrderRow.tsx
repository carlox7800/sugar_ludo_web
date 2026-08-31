'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { CashierOrder } from '../../types/cashier'
import { ArrowDownLeft, ArrowUpRight, MessageSquare, Clock, ShieldCheck, Eye, ChevronDown, ChevronUp, Copy, Check, Crown, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'
import { cashierLogger } from '../../lib/cashier-logger'
import { getWithdrawalSla } from '../../lib/sla-calculator'

interface OrderRowProps {
  order: CashierOrder
  onViewReceipt?: (order: CashierOrder) => void
  onApproveOrder?: (orderId: string) => void
}

export function OrderRow({ order, onViewReceipt, onApproveOrder }: OrderRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [copiedRef, setCopiedRef] = useState(false)
  const [, setTick] = useState(0)

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

  const timeAgo = (() => {
    const diff = Math.max(0, Math.floor((Date.now() - (order.createdAt || Date.now())) / 60000))
    if (diff < 1) return 'ahora'
    if (diff < 60) return `${diff}m`
    const hours = Math.floor(diff / 60)
    return `${hours}h`
  })()

  const handleCopyRef = (e: React.MouseEvent, text: string) => {
    e.stopPropagation()
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text)
      setCopiedRef(true)
      setTimeout(() => setCopiedRef(false), 2000)
    }
  }

  return (
    <div
      className={clsx(
        'group rounded-2xl transition-all duration-200 border overflow-hidden',
        isVip && !isCompleted
          ? 'bg-gradient-to-r from-amber-950/35 via-slate-900/90 to-purple-950/30 border-amber-500/60 shadow-[0_0_18px_rgba(245,158,11,0.15)] hover:border-amber-400'
          : isPending
          ? 'bg-amber-950/20 border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.1)] hover:border-amber-400'
          : isPaid
          ? 'bg-cyan-950/20 border-cyan-500/40 shadow-[0_0_15px_rgba(6,182,212,0.1)] hover:border-cyan-400'
          : 'bg-slate-900/60 border-white/10 hover:border-white/20'
      )}
    >
      {/* Main Horizontal Summary Bar */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 sm:py-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none hover:bg-white/[0.02] transition-colors"
      >
        {/* 1. Tipo, ID y Tiempo */}
        <div className="flex items-center gap-3 min-w-[210px]">
          <div
            className={clsx(
              'p-2 rounded-xl border shrink-0',
              isDeposit
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : isVip
                ? 'bg-gradient-to-br from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]'
                : 'bg-pink-500/10 text-pink-400 border-pink-500/30'
            )}
          >
            {isDeposit ? <ArrowDownLeft className="size-4" /> : isVip ? <Crown className="size-4 text-amber-400" /> : <ArrowUpRight className="size-4" />}
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-mono font-bold text-white text-xs">#{order.id.slice(0, 8)}</span>
              <span className="text-[11px] text-slate-400 font-mono">• {timeAgo}</span>
              {/* VIP / Standard Badge */}
              {slaInfo && (
                <span
                  className={clsx(
                    'px-1.5 py-0.2 rounded text-[9px] font-black uppercase tracking-wider border shrink-0',
                    isVip
                      ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 font-mono'
                      : 'bg-slate-800 text-slate-300 border-white/10'
                  )}
                >
                  {slaInfo.badgeLabel}
                </span>
              )}
            </div>
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">
              {isDeposit ? 'Depósito' : 'Retiro'}
            </span>
          </div>
        </div>

        {/* 2. Jugador & ID */}
        <div className="flex items-center gap-2 min-w-[150px]">
          <div className="flex flex-col">
            <span className="text-xs font-bold text-white truncate max-w-[130px]">
              {order.playerName}
            </span>
            {displayPlayerId && (
              <span className="font-mono text-[10px] font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/25 px-1.5 py-0.2 rounded w-fit">
                {displayPlayerId}
              </span>
            )}
          </div>
        </div>

        {/* 3. SLA Countdown Timer Bar (Withdrawals in progress) */}
        {slaInfo && !isCompleted ? (
          <div
            className={clsx(
              'px-2.5 py-1 rounded-xl border text-[11px] font-mono flex items-center gap-1.5 min-w-[150px]',
              slaInfo.isExpired
                ? 'bg-rose-950/80 border-rose-500/60 text-rose-300 animate-pulse font-black shadow-[0_0_12px_rgba(244,63,94,0.25)]'
                : slaInfo.isUrgent
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 animate-pulse font-bold'
                : isVip
                ? 'bg-amber-950/40 border-amber-500/30 text-amber-200'
                : 'bg-slate-950/60 border-white/5 text-slate-300'
            )}
          >
            {slaInfo.isExpired ? (
              <AlertTriangle className="size-3.5 text-rose-400 shrink-0" />
            ) : (
              <Clock className={clsx('size-3.5 shrink-0', isVip ? 'text-amber-400' : 'text-slate-400')} />
            )}
            <div className="flex flex-col leading-none">
              <span className="text-[9px] uppercase font-sans text-slate-400 font-bold">
                {slaInfo.isExpired ? 'SLA Vencido' : 'Plazo SLA'}
              </span>
              <span className={clsx('text-[10px] font-black', slaInfo.isExpired ? 'text-rose-400' : isVip ? 'text-amber-300' : 'text-slate-200')}>
                {slaInfo.formattedTime}
              </span>
            </div>
          </div>
        ) : null}

        {/* 4. Importes Financieros */}
        <div className="flex items-baseline gap-2 min-w-[160px]">
          <span className="font-mono font-black text-sm text-white">
            {order.amountFiat.toLocaleString()} {order.currency}
          </span>
          <span className="font-mono text-xs font-bold text-cyan-300/90">
            ({isDeposit ? '+' : '-'}{order.amountSugarCoins.toLocaleString()} SC)
          </span>
        </div>

        {/* 5. Badge de Estado */}
        <div className="min-w-[120px]">
          <span
            className={clsx(
              'px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border inline-flex items-center gap-1.5',
              isCompleted
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                : isDisputed
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                : isPaid
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 animate-pulse font-extrabold'
                : isPending
                ? isVip
                  ? 'bg-amber-500/30 text-amber-200 border-amber-500/70 animate-pulse font-black shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                  : 'bg-amber-500/25 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.2)] animate-pulse font-extrabold'
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
            )}
          >
            <span className={clsx('size-1.5 rounded-full', isPaid ? 'bg-cyan-300 animate-ping' : isPending ? 'bg-amber-300' : 'bg-current')} />
            <span>{order.status === 'paid' ? 'Comprobante' : order.status}</span>
          </span>
        </div>

        {/* 5. Acciones y Despliegue */}
        <div className="flex items-center gap-2 shrink-0">
          <Link
            href={`/cashier/orders/${order.id}`}
            onClick={(e) => {
              e.stopPropagation()
              cashierLogger.click(`Fila: Gestionar / Chat orden #${order.id.slice(0, 8)}`)
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-colors"
          >
            <MessageSquare className="size-3.5 text-cyan-400" />
            <span className="hidden md:inline">Chat</span>
          </Link>

          {isPaid && onApproveOrder && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                cashierLogger.click(`Fila: Liberar Saldo #${order.id.slice(0, 8)}`)
                onApproveOrder(order.id)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black shadow-[0_0_12px_rgba(16,185,129,0.25)] transition-all cursor-pointer"
            >
              <ShieldCheck className="size-3.5" />
              <span>Liberar</span>
            </button>
          )}

          {order.receiptUrl && onViewReceipt && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                cashierLogger.click(`Fila: Ver Comprobante #${order.id.slice(0, 8)}`)
                onViewReceipt(order)
              }}
              className="p-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
              title="Ver Comprobante"
            >
              <Eye className="size-3.5" />
            </button>
          )}

          <div className="p-1.5 text-slate-400 hover:text-white transition-colors">
            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
          </div>
        </div>
      </div>

      {/* Secondary Drawer Details (Expandible bajo demanda) */}
      {isExpanded && (
        <div className="px-4 py-3 bg-slate-950/70 border-t border-white/5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400 animate-in fade-in slide-in-from-top-1">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Método: <strong className="text-cyan-300">{methodLabelMap[order.paymentMethod] || order.paymentMethod}</strong>
            </span>
            <span className="text-slate-600">&bull;</span>
            <span>
              Comisión Cajero: <strong className="text-emerald-400 font-mono">+{order.cashierCommissionCoins} SC</strong>
            </span>

            {order.receiptReferenceNumber && (
              <>
                <span className="text-slate-600">&bull;</span>
                <button
                  onClick={(e) => handleCopyRef(e, order.receiptReferenceNumber!)}
                  className="flex items-center gap-1.5 font-mono text-[11px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Copiar Referencia / Hash"
                >
                  <span>Ref: <strong className="text-white">{order.receiptReferenceNumber}</strong></span>
                  {copiedRef ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3 text-slate-400" />}
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-500">
            <Clock className="size-3 text-cyan-400" />
            <span>Ventana de seguridad: 30m</span>
          </div>
        </div>
      )}
    </div>
  )
}
