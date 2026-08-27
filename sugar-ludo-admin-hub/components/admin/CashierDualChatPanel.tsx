'use client'

import React, { useState, useRef, useEffect } from 'react'
import { StaffChatMessage, CashierManagementProfile } from '../../types/admin-expanded'
import { MessageSquare, Send, Paperclip, ShieldCheck, UserCheck, Radio, Lock, Users } from 'lucide-react'
import { clsx } from 'clsx'

interface CashierDualChatPanelProps {
  cashiers: CashierManagementProfile[]
  messages: StaffChatMessage[]
  onSendMessage: (text: string, recipientUid?: string, attachmentUrl?: string) => void
}

export function CashierDualChatPanel({ cashiers, messages, onSendMessage }: CashierDualChatPanelProps) {
  const [chatMode, setChatMode] = useState<'broadcast' | 'private'>('broadcast')
  const [selectedCashierUid, setSelectedCashierUid] = useState<string>(cashiers[0]?.uid || '')
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, chatMode, selectedCashierUid])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    onSendMessage(inputText.trim(), chatMode === 'private' ? selectedCashierUid : undefined)
    setInputText('')
  }

  const selectedCashier = cashiers.find((c) => c.uid === selectedCashierUid)

  return (
    <div className="flex flex-col h-[560px] rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden">
      {/* Header & Tabs */}
      <div className="p-4 border-b border-white/10 bg-slate-950/80 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <MessageSquare className="size-4" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white uppercase tracking-wider">CANAL DE COMUNICACIÓN STAFF</h3>
              <p className="text-[10px] text-slate-400 font-mono">Difusión masiva o chat privado con cajeros</p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center p-1 bg-slate-900 rounded-xl border border-white/5 text-xs font-bold">
            <button
              onClick={() => setChatMode('broadcast')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
                chatMode === 'broadcast' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              )}
            >
              <Radio className="size-3.5" />
              <span>Difusión Masiva</span>
            </button>
            <button
              onClick={() => setChatMode('private')}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all',
                chatMode === 'private' ? 'bg-pink-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              )}
            >
              <Lock className="size-3.5" />
              <span>Chat Privado</span>
            </button>
          </div>
        </div>

        {/* Private Selector Bar */}
        {chatMode === 'private' && (
          <div className="flex items-center gap-2 pt-2 border-t border-white/5 text-xs">
            <span className="text-slate-400 flex items-center gap-1">
              <Users className="size-3.5 text-pink-400" /> Cajero Destino:
            </span>
            <select
              value={selectedCashierUid}
              onChange={(e) => setSelectedCashierUid(e.target.value)}
              className="flex-1 bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-pink-400"
            >
              {cashiers.map((csh) => (
                <option key={csh.uid} value={csh.uid}>
                  {csh.name} ({csh.shiftStatus === 'on_shift' ? 'En Turno' : 'Fuera'})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {chatMode === 'broadcast' ? (
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 text-[11px] text-center font-semibold">
            📢 Canal de Difusión General: Todos los cajeros conectados reciben estos mensajes.
          </div>
        ) : (
          <div className="p-2.5 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[11px] text-center font-semibold">
            🔒 Canal Privado con: <strong className="text-white">{selectedCashier?.name}</strong>
          </div>
        )}

        {messages.map((msg) => {
          const isAdmin = msg.senderRole === 'super_admin'
          return (
            <div
              key={msg.id}
              className={clsx(
                'flex gap-2.5 max-w-[80%]',
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
                    'p-3 rounded-2xl text-xs leading-relaxed',
                    isAdmin ? 'bg-cyan-950/40 border border-cyan-500/30 text-white rounded-tr-none' : 'bg-slate-800 border border-white/10 text-slate-200 rounded-tl-none'
                  )}
                >
                  <p>{msg.message}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center gap-2">
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={chatMode === 'broadcast' ? 'Enviar comunicado a todos los cajeros...' : `Mensaje privado a ${selectedCashier?.name}...`}
          className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition-all cursor-pointer"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  )
}
