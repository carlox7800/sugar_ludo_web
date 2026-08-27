'use client'

import React, { useState, useRef, useEffect } from 'react'
import { StaffChatMessage } from '../../types/admin-expanded'
import { MessageSquare, Send, Paperclip, ShieldCheck, UserCheck } from 'lucide-react'
import { clsx } from 'clsx'

interface StaffChatPanelProps {
  messages: StaffChatMessage[]
  onSendMessage: (text: string, attachmentUrl?: string) => void
}

export function StaffChatPanel({ messages, onSendMessage }: StaffChatPanelProps) {
  const [inputText, setInputText] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return
    onSendMessage(inputText.trim())
    setInputText('')
  }

  const handleSimulateAttachment = () => {
    onSendMessage('Comprobante de recarga de flotante adjunto', 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000')
  }

  return (
    <div className="flex flex-col h-[520px] rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/10 bg-slate-950/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <MessageSquare className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider">CANAL INTERNO STAFF (SUPER ADMIN ↔ CAJEROS)</h3>
            <p className="text-[10px] text-slate-400 font-mono">Coordinación de turnos, confirmación de balances y soporte operativo</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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
                  {msg.attachmentUrl && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <img src={msg.attachmentUrl} alt="Adjunto" className="max-h-28 rounded-lg object-cover" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSimulateAttachment}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors"
          title="Adjuntar comprobante"
        >
          <Paperclip className="size-4" />
        </button>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Escribir mensaje a los cajeros..."
          className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
        />
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="p-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold transition-all"
        >
          <Send className="size-4" />
        </button>
      </form>
    </div>
  )
}
