'use client'

import React, { useState, useEffect, useRef } from 'react'
import { MessageSquare, X, Send, ShieldCheck, UserCheck, RefreshCw, AlertCircle, Radio, Lock } from 'lucide-react'
import { StaffChatMessage } from '../../types/admin-expanded'
import {
  subscribeToCashierPrivateMessages,
  sendPrivateMessage,
  markPrivateChatAsReadByCashier,
  subscribeToBroadcastMessages,
  markBroadcastAsReadByCashier
} from '../../lib/staff-chat-service'

interface CashierAdminChatModalProps {
  isOpen: boolean
  onClose: () => void
  cashierUid: string
  cashierName: string
  initialTab?: 'broadcast' | 'private'
  unreadBroadcastCount?: number
  unreadPrivateCount?: number
  onReadBroadcast?: () => void
  onReadPrivate?: () => void
}

export function CashierAdminChatModal({
  isOpen,
  onClose,
  cashierUid,
  cashierName,
  initialTab = 'private',
  unreadBroadcastCount = 0,
  unreadPrivateCount = 0,
  onReadBroadcast,
  onReadPrivate
}: CashierAdminChatModalProps) {
  // 1. Todos los hooks SIEMPRE al inicio del componente (nunca después de retornos condicionales)
  const [activeTab, setActiveTab] = useState<'broadcast' | 'private'>(initialTab)
  const [localUnreadBroadcast, setLocalUnreadBroadcast] = useState(unreadBroadcastCount)
  const [localUnreadPrivate, setLocalUnreadPrivate] = useState(unreadPrivateCount)
  const [privateMessages, setPrivateMessages] = useState<StaffChatMessage[]>([])
  const [broadcastMessages, setBroadcastMessages] = useState<StaffChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const isSubmittingRef = useRef(false)

  // Sincronizar unreads de props al abrir o cambiar initialTab
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
      setLocalUnreadBroadcast(unreadBroadcastCount)
      setLocalUnreadPrivate(unreadPrivateCount)
    }
  }, [isOpen, initialTab, unreadBroadcastCount, unreadPrivateCount])

  const handleTabChange = (tab: 'broadcast' | 'private') => {
    setActiveTab(tab)
    if (tab === 'broadcast') {
      setLocalUnreadBroadcast(0)
      markBroadcastAsReadByCashier(cashierUid)
      onReadBroadcast?.()
    } else {
      setLocalUnreadPrivate(0)
      markPrivateChatAsReadByCashier(cashierUid)
      onReadPrivate?.()
    }
  }

  useEffect(() => {
    if (!isOpen || !cashierUid) return

    // Marcar como leído el canal activo
    if (activeTab === 'broadcast') {
      setLocalUnreadBroadcast(0)
      markBroadcastAsReadByCashier(cashierUid)
      onReadBroadcast?.()
    } else {
      setLocalUnreadPrivate(0)
      markPrivateChatAsReadByCashier(cashierUid)
      onReadPrivate?.()
    }

    const unsubPrivate = subscribeToCashierPrivateMessages(cashierUid, (liveMsgs) => {
      setPrivateMessages(liveMsgs)
      if (activeTab === 'private') {
        setLocalUnreadPrivate(0)
        markPrivateChatAsReadByCashier(cashierUid)
        onReadPrivate?.()
      }
    })

    const unsubBroadcast = subscribeToBroadcastMessages((liveBroadcasts) => {
      setBroadcastMessages(liveBroadcasts)
      if (activeTab === 'broadcast') {
        setLocalUnreadBroadcast(0)
        markBroadcastAsReadByCashier(cashierUid)
        onReadBroadcast?.()
      }
    })

    return () => {
      unsubPrivate()
      unsubBroadcast()
    }
  }, [isOpen, cashierUid, activeTab, onReadBroadcast, onReadPrivate])

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [privateMessages, broadcastMessages, activeTab, isOpen])

  // 2. Render condicional estrictamente después de todos los hooks de React
  if (!isOpen) return null

  const currentMessages = activeTab === 'broadcast' ? broadcastMessages : privateMessages

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const textToSend = inputText.trim()
    if (!textToSend || isSending || isSubmittingRef.current) return

    isSubmittingRef.current = true
    setIsSending(true)
    setInputText('') // Limpieza inmediata para evitar doble click
    setSendError(null)

    try {
      await sendPrivateMessage({
        senderUid: cashierUid || 'csh_001',
        senderName: cashierName || 'Cajero Oficial',
        senderRole: 'cashier',
        cashierUid: cashierUid || 'csh_001',
        cashierName: cashierName || 'Cajero Oficial',
        text: textToSend
      })
    } catch (err: any) {
      console.error('[CashierChatModal] Error al enviar mensaje:', err)
      setInputText(textToSend)
      setSendError(`Error al enviar mensaje: ${err.message || 'Sin permisos en Firebase'}`)
      setTimeout(() => setSendError(null), 6000)
    } finally {
      setIsSending(false)
      isSubmittingRef.current = false
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-lg h-[560px] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">COMUNICACIONES CON ADMINISTRACIÓN</h3>
              <p className="text-[11px] text-slate-400 font-mono">
                Canal oficial en vivo &bull; Turno: <strong className="text-cyan-300">{cashierName}</strong>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tabs: Difusión Oficial vs Chat Privado con Badges Numéricos Precisos */}
        <div className="grid grid-cols-2 p-1.5 bg-slate-950/90 border-b border-white/10 gap-1.5 text-xs font-bold">
          <button
            type="button"
            onClick={() => handleTabChange('broadcast')}
            className={`relative py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'broadcast'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Radio className="size-3.5 text-purple-300" />
            <span>Difusión Oficial</span>
            {localUnreadBroadcast > 0 && activeTab !== 'broadcast' && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-black animate-pulse shadow-md">
                {localUnreadBroadcast}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleTabChange('private')}
            className={`relative py-2 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'private'
                ? 'bg-cyan-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Lock className="size-3.5 text-cyan-300" />
            <span>Chat Privado</span>
            {localUnreadPrivate > 0 && activeTab !== 'private' && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-black animate-pulse shadow-md">
                {localUnreadPrivate}
              </span>
            )}
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/40">
          {currentMessages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs text-center p-4 space-y-2">
              {activeTab === 'broadcast' ? (
                <>
                  <Radio className="size-8 opacity-30 text-purple-400" />
                  <p className="font-bold text-slate-400">Sin comunicados de difusión recientes</p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Cuando el Super Admin envíe anuncios o circulares operativas a todos los cajeros, aparecerán aquí.
                  </p>
                </>
              ) : (
                <>
                  <MessageSquare className="size-8 opacity-30 text-cyan-400" />
                  <p className="font-bold text-slate-400">Canal privado con la Administración</p>
                  <p className="text-[11px] text-slate-500 max-w-xs">
                    Cualquier consulta sobre órdenes, comprobantes o liquidaciones, escribe tu mensaje aquí abajo.
                  </p>
                </>
              )}
            </div>
          ) : (
            currentMessages.map((msg) => {
              const isAdmin = msg.senderRole === 'super_admin'
              const isBroadcast = activeTab === 'broadcast'

              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 max-w-[85%] ${
                    isBroadcast
                      ? 'w-full max-w-full'
                      : isAdmin
                      ? 'mr-auto'
                      : 'ml-auto flex-row-reverse'
                  }`}
                >
                  <div
                    className={`size-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                      isBroadcast
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                        : isAdmin
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                        : 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                    }`}
                  >
                    {isBroadcast ? (
                      <Radio className="size-3.5" />
                    ) : isAdmin ? (
                      <ShieldCheck className="size-3.5" />
                    ) : (
                      <UserCheck className="size-3.5" />
                    )}
                  </div>

                  <div className="space-y-1 flex-1">
                    <div
                      className={`flex items-center gap-2 text-[10px] ${
                        isBroadcast
                          ? 'text-purple-300'
                          : isAdmin
                          ? 'text-cyan-400'
                          : 'justify-end text-pink-400'
                      }`}
                    >
                      <span className="font-bold">
                        {isBroadcast ? '📢 COMUNICADO GENERAL' : msg.senderName}
                      </span>
                      <span className="text-slate-500 font-mono">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} &bull;{' '}
                        {new Date(msg.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                      </span>
                    </div>

                    <div
                      className={`p-3 rounded-2xl text-xs leading-relaxed break-words shadow-md ${
                        isBroadcast
                          ? 'bg-purple-950/40 border border-purple-500/30 text-purple-100 rounded-tl-none'
                          : isAdmin
                          ? 'bg-slate-800 border border-white/10 text-slate-200 rounded-tl-none'
                          : 'bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-tr-none'
                      }`}
                    >
                      <p>{msg.message}</p>
                    </div>
                  </div>
                </div>
              )
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Error Alert */}
        {sendError && (
          <div className="px-3 py-1.5 bg-rose-500/20 border-t border-rose-500/30 text-rose-300 text-[11px] font-mono flex items-center gap-1.5">
            <AlertCircle className="size-3.5 shrink-0 text-rose-400" />
            <span className="truncate">{sendError}</span>
          </div>
        )}

        {/* Input: Activo en chat privado, y con botón de cambiar en difusión */}
        {activeTab === 'private' ? (
          <form onSubmit={handleSend} className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              disabled={isSending}
              placeholder="Escribir mensaje privado al Super Admin..."
              className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isSending}
              className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition-all cursor-pointer shadow-md flex items-center justify-center min-w-[36px]"
            >
              {isSending ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        ) : (
          <div className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="text-slate-400 text-[11px]">Canal de solo lectura para anuncios oficiales de administración</span>
            <button
              type="button"
              onClick={() => setActiveTab('private')}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
            >
              <Lock className="size-3" />
              <span>Responder por Privado</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
