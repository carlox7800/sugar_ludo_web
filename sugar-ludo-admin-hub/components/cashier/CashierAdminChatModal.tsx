'use client'

import React, { useState, useEffect } from 'react'
import { MessageSquare, X, Send, ShieldCheck, UserCheck } from 'lucide-react'

interface ChatMsg {
  id: string
  sender: string
  text: string
  time: string
  isAdmin: boolean
}

interface CashierAdminChatModalProps {
  isOpen: boolean
  onClose: () => void
  cashierName: string
}

const STORAGE_KEY = 'sugar_cashier_admin_chat_messages'

export function CashierAdminChatModal({ isOpen, onClose, cashierName }: CashierAdminChatModalProps) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [inputText, setInputText] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        try {
          setMessages(JSON.parse(saved))
          return
        } catch {}
      }
    }
    // Mensaje de bienvenida inicial del sistema
    setMessages([
      {
        id: '1',
        sender: 'Super Admin',
        text: `Hola ${cashierName || 'Cajero'}. Tu turno está activo en el protocolo P2P. Cualquier incidencia con pagos, comprobantes o liquidaciones nos escribes por este canal directo.`,
        time: '09:00 AM',
        isAdmin: true
      }
    ])
  }, [cashierName])

  const saveMessages = (msgs: ChatMsg[]) => {
    setMessages(msgs)
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-50)))
      } catch {}
    }
  }

  if (!isOpen) return null

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputText.trim()) return

    const newMsg: ChatMsg = {
      id: Date.now().toString(),
      sender: cashierName || 'Cajero Autorizado',
      text: inputText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isAdmin: false
    }

    const updated = [...messages, newMsg]
    saveMessages(updated)
    setInputText('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-lg h-[540px] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <MessageSquare className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">CHAT CON SUPER ADMIN</h3>
              <p className="text-[11px] text-slate-400 font-mono">Canal oficial de soporte y auditoría</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-950/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 max-w-[85%] ${msg.isAdmin ? 'mr-auto' : 'ml-auto flex-row-reverse'}`}
            >
              <div
                className={`size-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 ${
                  msg.isAdmin ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-pink-500/20 text-pink-300 border border-pink-500/40'
                }`}
              >
                {msg.isAdmin ? <ShieldCheck className="size-3.5" /> : <UserCheck className="size-3.5" />}
              </div>

              <div className="space-y-1">
                <div className={`flex items-center gap-2 text-[10px] ${msg.isAdmin ? 'text-cyan-400' : 'justify-end text-pink-400'}`}>
                  <span className="font-bold">{msg.sender}</span>
                  <span className="text-slate-500 font-mono">{msg.time}</span>
                </div>
                <div
                  className={`p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.isAdmin
                      ? 'bg-slate-800 border border-white/10 text-slate-200 rounded-tl-none'
                      : 'bg-gradient-to-r from-pink-600 to-pink-700 text-white rounded-tr-none'
                  }`}
                >
                  <p>{msg.text}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Escribir al Super Admin..."
            className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400 font-sans"
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
    </div>
  )
}
