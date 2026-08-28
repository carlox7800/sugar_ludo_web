'use client'

import React from 'react'
import Link from 'next/link'
import { CashierOrder } from '../../types/cashier'
import { ArrowDownLeft, ArrowUpRight, MessageSquare, Clock, ShieldCheck, Eye, AlertTriangle } from 'lucide-react'
import { clsx } from 'clsx'

interface OrderCardProps {
  order: CashierOrder
  onViewReceipt?: (order: CashierOrder) => void
  onApproveOrder?: (orderId: string) => void
}

export function OrderCard({ order, onViewReceipt, onApproveOrder }: OrderCardProps) {
  const isDeposit = order.type === 'deposit'
  const isPaid = order.status === 'paid'
  const isCompleted = order.status === 'completed'
  const isDisputed = order.status === 'disputed'

  const methodLabelMap: Record<string, string> = {
    pago_movil: 'Pago Móvil (VES)',
    transferencia: 'Transferencia Bancaria',
    nequi: 'Nequi (COP)',
    bancolombia: 'Bancolombia (COP)',
    mercadopago: 'MercadoPago',
    usdt_trc20: 'USDT (TRC-20)',
    usdt_bep20: 'USDT (BEP-20)',
    binance_pay: 'Binance Pay ID',
    zelle: 'Zelle (USD)',
  }

  const isPending = order.status === 'pending'

  return (
    <div
      className={clsx(
        'group p-5 rounded-3xl transition-all duration-200 space-y-4 hover:shadow-xl',
        isPending
          ? 'bg-amber-950/25 border-2 border-amber-500/70 shadow-[0_0_25px_rgba(245,158,11,0.18)] ring-1 ring-amber-400/40 hover:border-amber-400'
          : 'bg-slate-900/60 border border-white/10 hover:border-white/20'
      )}
    >
      {/* Top Meta Line */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div
            className={clsx(
              'p-2.5 rounded-2xl border shrink-0',
              isDeposit
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : 'bg-pink-500/10 text-pink-400 border-pink-500/30'
            )}
          >
            {isDeposit ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-white text-xs">#{order.id.slice(0, 8)}</span>
              <span
                className={clsx(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isDisputed
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : isPaid
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                    : isPending
                    ? 'bg-amber-500/30 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse font-extrabold'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                )}
              >
                {order.status === 'paid' ? 'Comprobante Subido' : order.status}
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              {isDeposit ? 'Depósito de Fondos' : 'Solicitud de Retiro'}
            </span>
          </div>
        </div>

        {/* Expiration Timer Indicator */}
        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-xl border border-white/5">
          <Clock className="size-3.5 text-cyan-400" />
          <span>30m ventana</span>
        </div>
      </div>

      {/* Financial Core Info */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3.5 bg-slate-950/60 rounded-2xl border border-white/5 text-xs">
        <div>
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Monto Dinero Real</span>
          <span className="text-sm font-black text-white font-mono">
            {order.amountFiat.toLocaleString()} {order.currency}
          </span>
        </div>

        <div>
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Crédito Sugar Coins</span>
          <span className="text-sm font-black text-cyan-300 font-mono">
            +{order.amountSugarCoins.toLocaleString()} SC
          </span>
        </div>

        <div className="col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-400 uppercase font-semibold block">Comisión Cajero</span>
          <span className="text-sm font-black text-emerald-400 font-mono">
            +{order.cashierCommissionCoins} SC
          </span>
        </div>
      </div>

      {/* User & Payment Detail */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
        <div>
          <span>Jugador: <strong className="text-white">{order.playerName}</strong></span>
          <span className="mx-2">&bull;</span>
          <span>Método: <strong className="text-cyan-300">{methodLabelMap[order.paymentMethod] || order.paymentMethod}</strong></span>
        </div>
        {order.receiptReferenceNumber && (
          <div className="font-mono text-[11px] text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">
            Ref: <span className="text-white font-bold">{order.receiptReferenceNumber}</span>
          </div>
        )}
      </div>

      {/* Action Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10">
        <Link
          href={`/cashier/orders/${order.id}`}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-xs font-bold transition-colors"
        >
          <MessageSquare className="size-3.5 text-cyan-400" />
          <span>Gestionar / Chat</span>
        </Link>

        <div className="flex items-center gap-2">
          {order.receiptUrl && onViewReceipt && (
            <button
              onClick={() => onViewReceipt(order)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-colors cursor-pointer"
            >
              <Eye className="size-3.5" />
              <span>Ver Comprobante</span>
            </button>
          )}

          {isPaid && onApproveOrder && (
            <button
              onClick={() => onApproveOrder(order.id)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              <ShieldCheck className="size-4" />
              <span>Liberar Saldo</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
