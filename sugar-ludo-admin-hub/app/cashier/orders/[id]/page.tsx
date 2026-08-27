'use client'

import React, { useState, use } from 'react'
import Link from 'next/link'
import { MOCK_ORDERS, MOCK_CHAT_MESSAGES } from '../../../../lib/mock-data'
import { CashierOrder, OrderChatMessage } from '../../../../types/cashier'
import { ReceiptImageViewer } from '../../../../components/receipts/ReceiptImageViewer'
import { OrderChatPanel } from '../../../../components/chat/OrderChatPanel'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ShieldCheck, Eye, Clock, CheckCircle2, AlertTriangle, Wallet } from 'lucide-react'
import { clsx } from 'clsx'

export default function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const orderId = resolvedParams.id

  const initialOrder = MOCK_ORDERS.find((o) => o.id === orderId) || MOCK_ORDERS[0]
  const [order, setOrder] = useState<CashierOrder>(initialOrder)
  const [messages, setMessages] = useState<OrderChatMessage[]>(
    MOCK_CHAT_MESSAGES[orderId] || MOCK_CHAT_MESSAGES[MOCK_ORDERS[0].id] || []
  )
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | undefined>(order.receiptUrl)
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const isDeposit = order.type === 'deposit'
  const isPaid = order.status === 'paid'
  const isCompleted = order.status === 'completed'

  const handleSendMessage = async (text: string, attachmentUrl?: string) => {
    const newMsg: OrderChatMessage = {
      id: `msg_${Date.now()}`,
      orderId: order.id,
      senderUid: 'csh_carlosandroid_001',
      senderName: 'carlosandroid',
      senderRole: 'cashier',
      message: text,
      attachmentUrl,
      attachmentType: attachmentUrl ? 'image' : undefined,
      timestamp: Date.now(),
      isRead: false,
    }
    setMessages((prev) => [...prev, newMsg])
  }

  const handleApprove = () => {
    setOrder((prev) => ({
      ...prev,
      status: 'completed',
      completedAt: Date.now(),
    }))

    // Add automated system message to chat
    const sysMsg: OrderChatMessage = {
      id: `msg_sys_${Date.now()}`,
      orderId: order.id,
      senderUid: 'system',
      senderName: 'Sistema',
      senderRole: 'system',
      message: `🎉 ¡Depósito validado y acreditado con éxito (+${order.amountSugarCoins} SC)!`,
      timestamp: Date.now(),
      isRead: true,
    }
    setMessages((prev) => [...prev, sysMsg])
    setNotification('¡Orden completada atómicamente!')
    setTimeout(() => setNotification(null), 4000)
  }

  const handleViewCustomImage = (url: string) => {
    setActiveReceiptUrl(url)
    setIsReceiptOpen(true)
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/cashier/orders"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="font-black text-base text-white tracking-wide flex items-center gap-2">
              <span>ORDEN #{order.id.slice(0, 8)}</span>
              <span
                className={clsx(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isPaid
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                )}
              >
                {order.status === 'paid' ? 'Comprobante Subido' : order.status}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              Jugador: <strong className="text-white">{order.playerName}</strong> &bull; {order.currency}
            </p>
          </div>
        </div>

        {/* Action Button */}
        {isPaid && (
          <button
            onClick={handleApprove}
            className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
          >
            <ShieldCheck className="size-4" />
            <span>Validar y Liberar Saldo</span>
          </button>
        )}
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="size-5" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Grid: Left Financial Info & Right Chat Panel */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Order Data and Receipt (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Financial Summary Card */}
          <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-5">
            <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Wallet className="size-4 text-cyan-400" /> RESUMEN DE LA LIQUIDACIÓN
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Monto en Dinero Real</span>
                <span className="text-lg font-black text-white font-mono">
                  {order.amountFiat.toLocaleString()} {order.currency}
                </span>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Sugar Coins (SC)</span>
                <span className="text-lg font-black text-cyan-300 font-mono">
                  +{order.amountSugarCoins.toLocaleString()} SC
                </span>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Comisión Cajero</span>
                <span className="text-sm font-black text-emerald-400 font-mono">
                  +{order.cashierCommissionCoins} SC
                </span>
              </div>

              <div className="p-3.5 bg-slate-950/60 rounded-2xl border border-white/5">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Método de Pago</span>
                <span className="text-xs font-bold text-white uppercase tracking-wider block truncate">
                  {order.paymentMethod}
                </span>
              </div>
            </div>

            {/* Receipt Preview Thumbnail */}
            {order.receiptUrl ? (
              <div className="space-y-2 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Comprobante Bancario</span>
                  <button
                    onClick={() => {
                      setActiveReceiptUrl(order.receiptUrl)
                      setIsReceiptOpen(true)
                    }}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs font-bold cursor-pointer"
                  >
                    <Eye className="size-3.5" />
                    <span>Inspeccionar en HD</span>
                  </button>
                </div>

                <div
                  onClick={() => {
                    setActiveReceiptUrl(order.receiptUrl)
                    setIsReceiptOpen(true)
                  }}
                  className="group relative rounded-2xl overflow-hidden border border-white/10 bg-black/40 cursor-pointer aspect-video flex items-center justify-center"
                >
                  <img
                    src={order.receiptUrl}
                    alt="Comprobante"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold text-xs">
                    <Eye className="size-5 text-cyan-300" />
                    <span>Abrir Visor con Zoom</span>
                  </div>
                </div>

                {order.receiptReferenceNumber && (
                  <p className="text-xs text-slate-400 font-mono text-center">
                    Referencia Bancaria: <strong className="text-white">{order.receiptReferenceNumber}</strong>
                  </p>
                )}
              </div>
            ) : (
              <div className="p-6 text-center rounded-2xl bg-white/[0.02] border border-dashed border-white/10 text-xs text-slate-500">
                Esperando que el jugador suba la captura del comprobante bancario...
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Order Chat (7 cols) */}
        <div className="lg:col-span-7 h-[680px]">
          <OrderChatPanel
            orderId={order.id}
            currentUserUid="csh_carlosandroid_001"
            currentUserName="carlosandroid (Cajero)"
            currentUserRole="cashier"
            messages={messages}
            onSendMessage={handleSendMessage}
            onViewImage={handleViewCustomImage}
            isDisputed={order.status === 'disputed'}
            onOpenDisputeModal={() => setIsDisputeOpen(true)}
          />
        </div>
      </main>

      {/* Interactive Receipt Viewer Modal */}
      <ReceiptImageViewer
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
        imageUrl={activeReceiptUrl}
        referenceNumber={order.receiptReferenceNumber}
        bankName={order.paymentMethod}
        amount={`${order.amountFiat.toLocaleString()} ${order.currency}`}
      />
    </div>
  )
}
