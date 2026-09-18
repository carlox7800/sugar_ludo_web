'use client'

import React from 'react'
import { AlertTriangle, Crown, Clock, ShieldAlert, CheckCircle2 } from 'lucide-react'
import { clsx } from 'clsx'
import { OrderStatus } from '@/types/cashier'
import { SlaInfo } from '@/lib/sla-calculator'

export interface OrderHeaderTimerProps {
  slaInfo: SlaInfo | null
  isTerminated: boolean
  orderStatus: OrderStatus
  disputeReason?: string
  notification: string | null
}

export const OrderHeaderTimer: React.FC<OrderHeaderTimerProps> = ({
  slaInfo,
  isTerminated,
  orderStatus,
  disputeReason,
  notification
}) => {
  return (
    <>
      {/* Dispute Banner if order is already in dispute */}
      {orderStatus === 'disputed' && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div className="p-4 rounded-3xl bg-rose-950/85 border border-rose-500 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.3)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono animate-pulse">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/50">
                <ShieldAlert className="size-6 text-rose-400" />
              </div>
              <div>
                <span className="font-black text-white uppercase block text-sm">CASO EN DISPUTA Y ARBITRAJE OFICIAL</span>
                <p className="text-[11px] text-rose-200/90">
                  Motivo: <strong>{disputeReason || 'Revisión solicitada por inconsistencia en comprobante o pago'}</strong>.
                  La orden está en revisión de la Administración.
                </p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-rose-500 text-slate-950 font-black text-xs uppercase tracking-wider">
              En Arbitraje
            </span>
          </div>
        </div>
      )}

      {/* SLA Countdown & Urgency Banner for Withdrawals */}
      {slaInfo && !isTerminated && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div
            className={clsx(
              'p-4 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono transition-all',
              slaInfo.isExpired
                ? 'bg-rose-950/85 border-rose-500 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.3)] animate-pulse font-black'
                : slaInfo.isUrgent
                ? 'bg-amber-950/85 border-amber-500 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.25)] animate-pulse font-bold'
                : slaInfo.isVip
                ? 'bg-gradient-to-r from-amber-950/60 via-purple-950/40 to-slate-900 border-amber-500/60 text-amber-200 shadow-md'
                : 'bg-slate-900/80 border-white/10 text-slate-300'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  'p-2.5 rounded-2xl border shrink-0',
                  slaInfo.isExpired
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-bounce'
                    : slaInfo.isVip
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                )}
              >
                {slaInfo.isExpired ? (
                  <AlertTriangle className="size-5 text-rose-400" />
                ) : slaInfo.isVip ? (
                  <Crown className="size-5 text-amber-400" />
                ) : (
                  <Clock className="size-5 text-cyan-400" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold uppercase tracking-wider text-white text-xs">
                    {slaInfo.slaTitle}
                  </span>
                  {slaInfo.isVip && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-sm">
                      Prioridad Máxima
                    </span>
                  )}
                  {slaInfo.isExpired && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse">
                      ¡Atención Atrasada!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  {slaInfo.isExpired
                    ? '⚠️ El plazo de atención garantizado ha vencido. Realiza la transferencia de inmediato para evitar reclamos.'
                    : slaInfo.isUrgent
                    ? '⚡ Quedan menos de 2 horas para el vencimiento del plazo. Liquida este retiro a la brevedad.'
                    : `Plazo de atención comprometido con el usuario: máximo ${slaInfo.maxHours} horas desde la solicitud.`}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0 pl-12 sm:pl-0">
              <span className="text-[10px] uppercase text-slate-400 block font-sans font-bold">Tiempo Restante SLA</span>
              <span className={clsx('text-base font-black font-mono tracking-tight', slaInfo.isExpired ? 'text-rose-400 text-lg' : slaInfo.isVip ? 'text-amber-300 text-lg' : 'text-white')}>
                {slaInfo.formattedTime}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="size-5" />
          <span>{notification}</span>
        </div>
      )}
    </>
  )
}
