'use client'

import React, { useState, useRef, useEffect } from 'react'
import { StaffChatMessage, CashierManagementProfile } from '../../types/admin-expanded'
import { MessageSquare, Send, ShieldCheck, UserCheck, Radio, Lock, Users, Bell, RefreshCw, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'

interface CashierDualChatPanelProps {
  cashiers: CashierManagementProfile[]
  broadcastMessages: StaffChatMessage[]
  privateMessages: StaffChatMessage[]
  selectedCashierUid: string
  onSelectCashier: (uid: string) => void
  onSendBroadcast: (text: string) => Promise<void> | void
  onSendPrivate: (text: string, cashierUid: string) => Promise<void> | void
  unreadByAdminTotal?: number
  unreadByCashierMap?: Record<string, number>
}

export function CashierDualChatPanel({
  cashiers,
  broadcastMessages,
  privateMessages,
  selectedCashierUid,
  onSelectCashier,
  onSendBroadcast,
  onSendPrivate,
  unreadByAdminTotal = 0,
  unreadByCashierMap = {}
}: CashierDualChatPanelProps) {
  const [chatMode, setChatMode] = useState<'broadcast' | 'private'>('broadcast')
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const activeMessages = chatMode === 'broadcast' ? broadcastMessages : privateMessages

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeMessages, chatMode, selectedCashierUid])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = inputText.trim()
    if (!text || isSending) return

    setIsSending(true)
    setSendError(null)

    try {
      if (chatMode === 'broadcast') {
        await onSendBroadcast(text)
      } else {
        const targetUid = selectedCashierUid || (cashiers.length > 0 ? cashiers[0].uid : '')
        if (!selectedCashierUid && cashiers.length > 0) {
          onSelectCashier(cashiers[0].uid)
        }
        await onSendPrivate(text, targetUid)
      }
      setInputText('')
    } catch (err: any) {
      console.error('[CashierDualChatPanel] Error enviando:', err)
      setSendError(`Error al enviar mensaje: ${err.message || 'Sin permisos en Firebase'}`)
      setTimeout(() => setSendError(null), 6000)
    } finally {
      setIsSending(false)
    }
  }

  const selectedCashier = cashiers.find((c) => c.uid === selectedCashierUid) || cashiers[0]

  return (
    <div className="flex flex-col h-[560px] rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden shadow-2xl">
      {/* Header & Tabs */}
      <div className="p-4 border-b border-white/10 bg-slate-950/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">CANAL DE COMUNICACIÓN STAFF</h3>
              <p className="text-[10px] text-slate-400 font-mono">Difusión masiva o chat privado en tiempo real con cajeros</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-white/5 text-xs font-bold">
            <button
              onClick={() => setChatMode('broadcast')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                chatMode === 'broadcast' ? 'bg-cyan-500 text-slate-950 shadow-sm font-black' : 'text-slate-400 hover:text-white'
              )}
            >
              <Radio className="size-3.5" />
              <span>Difusión Masiva</span>
            </button>
            <button
              onClick={() => {
                setChatMode('private')
                // Si hay un cajero con mensajes no leídos, priorizarlo
                const cashierWithUnread = cashiers.find((c) => (unreadByCashierMap[c.uid] || 0) > 0)
                const targetUid = cashierWithUnread ? cashierWithUnread.uid : (selectedCashierUid || (cashiers.length > 0 ? cashiers[0].uid : ''))
                if (targetUid) {
                  onSelectCashier(targetUid)
                }
              }}
              className={clsx(
                'relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer',
                chatMode === 'private' ? 'bg-pink-500 text-white shadow-sm font-black' : 'text-slate-400 hover:text-white'
              )}
            >
              <Lock className="size-3.5" />
              <span>Chat Privado</span>
              {unreadByAdminTotal > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-black animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.6)]">
                  {unreadByAdminTotal}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Private Selector Bar */}
        {chatMode === 'private' && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-xs">
            <span className="text-slate-400 flex items-center gap-1 shrink-0">
              <Users className="size-3.5 text-pink-400" /> Cajero Destino:
            </span>
            <select
              value={selectedCashierUid}
              onChange={(e) => onSelectCashier(e.target.value)}
              className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-pink-400"
            >
              {cashiers.map((csh) => {
                const unreadCount = unreadByCashierMap[csh.uid] || 0
                return (
                  <option key={csh.uid} value={csh.uid}>
                    {csh.name} ({csh.shiftStatus === 'on_shift' ? 'En Turno' : 'Fuera'}) {unreadCount > 0 ? `🚨 [${unreadCount} nuevo]` : ''}
                  </option>
                )
              })}
            </select>
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMode === 'broadcast' ? (
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] text-center font-semibold">
            📢 Canal de Difusión General: Todos los cajeros conectados reciben estos comunicados en vivo.
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[11px] text-center font-semibold flex items-center justify-between">
            <span>🔒 Canal Privado Directo con: <strong className="text-white">{selectedCashier?.name || 'Cajero'}</strong></span>
            {(unreadByCashierMap[selectedCashier?.uid || ''] || 0) > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold animate-pulse">
                {unreadByCashierMap[selectedCashier?.uid || '']} mensaje(s) nuevo(s)
              </span>
            )}
          </div>
        )}

        {activeMessages.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-slate-500 text-xs space-y-1">
            <MessageSquare className="size-6 opacity-30" />
            <p>No hay mensajes en este canal todavía.</p>
            <p className="text-[10px] text-slate-600">Escribe abajo para iniciar la conversación.</p>
          </div>
        ) : (
          activeMessages.map((msg) => {
            const isAdmin = msg.senderRole === 'super_admin'
            return (
              <div
                key={msg.id}
                className={clsx(
                  'flex gap-2.5 max-w-[85%]',
                  isAdmin ? 'ml-auto flex-row-reverse' : 'mr-auto'
                )}
              >
                <div
                  className={clsx(
                    'size-7 rounded-xl flex items-center justify-center text-xs shrink-0 font-bold',
                    isAdmin ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                  )}
                >
                  {isAdmin ? <ShieldCheck className="size-3.5" /> : <UserCheck className="size-3.5" />}
                </div>

                <div className="space-y-1">
                  <div className={clsx('flex items-center gap-2 text-[10px]', isAdmin ? 'justify-end text-cyan-400' : 'text-pink-400')}>
                    <span className="font-bold">{msg.senderName}</span>
                    <span className="text-slate-500 font-mono">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  <div
                    className={clsx(
                      'p-3 rounded-2xl text-xs leading-relaxed break-words',
                      isAdmin ? 'bg-cyan-950/60 border border-cyan-500/30 text-white rounded-tr-none shadow-md' : 'bg-slate-800 border border-white/10 text-slate-200 rounded-tl-none shadow-md'
                    )}
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

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          disabled={isSending}
          placeholder={chatMode === 'broadcast' ? 'Enviar comunicado oficial a todos los cajeros...' : `Mensaje privado a ${selectedCashier?.name || 'Cajero'}...`}
          className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!inputText.trim() || isSending}
          className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition-all cursor-pointer shadow-md flex items-center justify-center min-w-[36px]"
        >
          {isSending ? <RefreshCw className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </form>
    </div>
  )
}
