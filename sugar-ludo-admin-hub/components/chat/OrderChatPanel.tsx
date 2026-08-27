'use client'

import React, { useState, useRef, useEffect } from 'react'
import { OrderChatMessage } from '../../types/cashier'
import { OrderChatMessageItem } from './OrderChatMessageItem'
import { Send, Image as ImageIcon, MessageSquare, ShieldAlert, Paperclip, X } from 'lucide-react'

interface OrderChatPanelProps {
  orderId: string
  currentUserUid: string
  currentUserName: string
  currentUserRole: 'player' | 'cashier' | 'admin'
  messages: OrderChatMessage[]
  onSendMessage: (text: string, attachmentUrl?: string) => Promise<void>
  onViewImage?: (imageUrl: string) => void
  isDisputed?: boolean
  onOpenDisputeModal?: () => void
}

export function OrderChatPanel({
  orderId,
  currentUserUid,
  currentUserName,
  currentUserRole,
  messages,
  onSendMessage,
  onViewImage,
  isDisputed,
  onOpenDisputeModal
}: OrderChatPanelProps) {
  const [inputText, setInputText] = useState('')
  const [attachedUrl, setAttachedUrl] = useState<string | null>(null)
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!inputText.trim() && !attachedUrl) || isSending) return

    try {
      setIsSending(true)
      await onSendMessage(inputText.trim(), attachedUrl || undefined)
      setInputText('')
      setAttachedUrl(null)
    } finally {
      setIsSending(false)
    }
  }

  const handleSimulateAttachment = () => {
    // Simulated upload for testing / demo
    const mockReceipt = 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&q=80&w=1000'
    setAttachedUrl(mockReceipt)
  }

  return (
    <div className="flex flex-col h-full bg-slate-900/90 border border-white/10 rounded-3xl overflow-hidden shadow-xl">
      {/* Chat Header */}
      <div className="px-5 py-3.5 border-b border-white/10 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <MessageSquare className="size-4" />
          </div>
          <div>
            <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
              <span>Chat de la Orden #{orderId.slice(0, 8)}</span>
              {isDisputed && (
                <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40">
                  En Mediación
                </span>
              )}
            </h3>
            <p className="text-[10px] text-slate-400">Canal directo P2P con cifrado y auditoría</p>
          </div>
        </div>

        {onOpenDisputeModal && !isDisputed && (
          <button
            onClick={onOpenDisputeModal}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition-colors cursor-pointer"
            title="Solicitar intervención de un administrador"
          >
            <ShieldAlert className="size-3.5" />
            <span>Abrir Disputa</span>
          </button>
        )}
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 text-slate-500 text-xs">
            <MessageSquare className="size-8 text-slate-600 mb-2 opacity-50" />
            <p className="font-semibold text-slate-400">No hay mensajes en esta orden aún.</p>
            <p className="text-[10px]">Usa el chat para coordinar el pago o resolver dudas con el compañero.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <OrderChatMessageItem
              key={msg.id}
              message={msg}
              isCurrentUser={msg.senderUid === currentUserUid}
              onViewImage={onViewImage}
            />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attached Image Preview Pill */}
      {attachedUrl && (
        <div className="px-4 py-2 bg-slate-950/80 border-t border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-cyan-300">
            <ImageIcon className="size-4" />
            <span className="truncate max-w-[200px]">Comprobante adjunto listo</span>
          </div>
          <button
            onClick={() => setAttachedUrl(null)}
            className="p-1 rounded-md text-slate-400 hover:text-white"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* Chat Input Bar */}
      <form onSubmit={handleSend} className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center gap-2">
        <button
          type="button"
          onClick={handleSimulateAttachment}
          className="p-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
          title="Adjuntar captura de comprobante"
        >
          <Paperclip className="size-4" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Escribe un mensaje o referencia bancaria..."
          className="flex-1 bg-slate-800/80 border border-white/10 rounded-2xl px-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400/50"
        />

        <button
          type="submit"
          disabled={isSending || (!inputText.trim() && !attachedUrl)}
          className="p-2.5 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-40 text-slate-950 font-bold transition-all cursor-pointer shadow-md"
        >
          <Send className="size-4 text-black" />
        </button>
      </form>
    </div>
  )
}
