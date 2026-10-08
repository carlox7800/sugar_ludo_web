'use client'

import React from 'react'
import { OrderChatMessage } from '../../types/cashier'
import { Shield, CreditCard, User, Image as ImageIcon, Eye, Check, CheckCheck, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'

interface OrderChatMessageItemProps {
  message: OrderChatMessage
  isCurrentUser: boolean
  isRead?: boolean
  onViewImage?: (imageUrl: string) => void
}

export function OrderChatMessageItem({ message, isCurrentUser, isRead = false, onViewImage }: OrderChatMessageItemProps) {
  const isSystem = message.senderRole === 'system'
  const isAdmin = message.senderRole === 'admin'
  const isCashier = message.senderRole === 'cashier'

  const formattedTime = new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  const isRefundNotice = Boolean(
    message.message.includes('devueltos a tu saldo disponible') ||
    message.message.includes('reintegrados a tu saldo') ||
    message.message.includes('fondos en garantía fueron devueltos') ||
    message.message.includes('fondos en garantía devueltos') ||
    message.message.includes('DICTAMEN DIRECTIVO - JUGADOR')
  )

  const isFavorableResolution = Boolean(
    !isRefundNotice && (
      message.message.includes('favor del JUGADOR') ||
      message.message.includes('Retiro liquidado formalmente') ||
      message.message.includes('sin deducción de tu saldo flotante') ||
      message.message.includes('DICTAMEN DIRECTIVO - CAJERO') ||
      message.message.includes('Dictamen favorable emitido') ||
      message.message.includes('VALIDADO CON ÉXITO') ||
      message.message.includes('LIQUIDADO Y TRANSFERIDO') ||
      (isAdmin && (message.message.includes('Dictamen favorable') || message.message.includes('acreditado y completado')))
    )
  )

  if (isSystem) {
    return (
      <div className="flex items-center justify-center my-3">
        <div className="px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] font-medium text-center max-w-md shadow-sm">
          {message.message}
        </div>
      </div>
    )
  }

  return (
    <div
      className={clsx(
        'flex gap-2.5 my-2.5 max-w-[85%]',
        isCurrentUser ? 'ml-auto flex-row-reverse' : 'mr-auto'
      )}
    >
      {/* Sender Avatar Badge */}
      <div
        className={clsx(
          'size-7 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold',
          isRefundNotice
            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]'
            : isFavorableResolution
            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
            : isAdmin
            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
            : isCashier
            ? 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
            : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
        )}
      >
        {isRefundNotice ? (
          <RefreshCw className="size-3.5 text-cyan-400" />
        ) : isFavorableResolution ? (
          <Shield className="size-3.5 text-emerald-400" />
        ) : isAdmin ? (
          <Shield className="size-3.5" />
        ) : isCashier ? (
          <CreditCard className="size-3.5" />
        ) : (
          <User className="size-3.5" />
        )}
      </div>

      {/* Message Bubble */}
      <div className="space-y-1">
        <div
          className={clsx(
            'flex items-center gap-2 text-[10px] font-semibold',
            isCurrentUser ? 'justify-end text-slate-400' : 'text-slate-400'
          )}
        >
          <span className={clsx(
            isRefundNotice
              ? 'text-cyan-300 font-extrabold'
              : isFavorableResolution
              ? 'text-emerald-300 font-extrabold'
              : isAdmin
              ? 'text-amber-400 font-bold'
              : isCashier
              ? 'text-pink-300 font-bold'
              : 'text-cyan-300'
          )}>
            {message.senderName}
          </span>
          {isRefundNotice ? (
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-black uppercase border border-cyan-500/40 shadow-sm flex items-center gap-1">
              <RefreshCw className="size-2.5" />
              <span>Garantía Reembolsada</span>
            </span>
          ) : isFavorableResolution ? (
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[9px] font-black uppercase border border-emerald-500/40 shadow-sm">
              Dictamen Favorable
            </span>
          ) : isAdmin ? (
            <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-black uppercase">
              Moderador
            </span>
          ) : null}
        </div>

        <div
          className={clsx(
            'p-3.5 rounded-2xl text-xs leading-relaxed shadow-md relative',
            isCurrentUser
              ? 'bg-gradient-to-br from-cyan-600 to-cyan-700 text-white rounded-tr-none'
              : isRefundNotice
              ? 'bg-slate-900/90 border border-cyan-500/40 text-cyan-100 rounded-tl-none shadow-[0_0_15px_rgba(6,182,212,0.15)]'
              : isFavorableResolution
              ? 'bg-emerald-950/50 border border-emerald-500/40 text-emerald-100 rounded-tl-none shadow-[0_0_15px_rgba(16,185,129,0.15)]'
              : isAdmin
              ? 'bg-amber-950/40 border border-amber-500/30 text-amber-100 rounded-tl-none'
              : 'bg-slate-800/80 border border-white/10 text-slate-200 rounded-tl-none'
          )}
        >
          <p className="whitespace-pre-wrap">{message.message}</p>

          {/* Attachment Preview */}
          {message.attachmentUrl && (
            <div className="mt-2.5 pt-2 border-t border-white/10">
              <div
                onClick={() => onViewImage && onViewImage(message.attachmentUrl!)}
                className="group relative rounded-xl overflow-hidden border border-white/20 bg-black/40 cursor-pointer max-w-xs"
              >
                <img
                  src={message.attachmentUrl}
                  alt="Comprobante Adjunto"
                  className="max-h-36 w-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-[11px] font-bold">
                  <Eye className="size-4 text-cyan-300" />
                  <span>Ver Comprobante</span>
                </div>
              </div>
            </div>
          )}

          {/* Timestamp & WhatsApp Status Checks in bottom-right */}
          <div className={clsx(
            "flex items-center justify-end gap-1 text-[9px] font-mono mt-1.5 select-none",
            isCurrentUser ? "text-cyan-200/80" : "text-slate-400"
          )}>
            <span>{formattedTime}</span>
            {isCurrentUser && (
              isRead ? (
                <CheckCheck className="size-3 text-cyan-200 inline" />
              ) : (
                <Check className="size-3 text-cyan-200/60 inline" />
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
