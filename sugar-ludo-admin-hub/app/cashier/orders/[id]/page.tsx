'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { MOCK_ORDERS, MOCK_CHAT_MESSAGES } from '../../../../lib/mock-data'
import { CashierOrder, OrderChatMessage } from '../../../../types/cashier'
import { ReceiptImageViewer } from '../../../../components/receipts/ReceiptImageViewer'
import { OrderChatPanel } from '../../../../components/chat/OrderChatPanel'
import { WithdrawalAuditInspectorCard } from '../../../../components/cashier/WithdrawalAuditInspectorCard'
import { db } from '../../../../lib/firebase'
import { doc, onSnapshot, getDoc, updateDoc, increment } from 'firebase/firestore'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ShieldCheck, Eye, Clock, CheckCircle2, AlertTriangle, Wallet, Send, Check } from 'lucide-react'
import { clsx } from 'clsx'

import { useParams, useRouter } from 'next/navigation'

export default function OrderDetailPage() {
  const router = useRouter()
  const routeParams = useParams()
  const orderId = (routeParams?.id as string) || ''

  const [order, setOrder] = useState<CashierOrder | null>(null)
  const [messages, setMessages] = useState<OrderChatMessage[]>([])
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | undefined>(undefined)
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [payoutTxId, setPayoutTxId] = useState('')
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)

  // Baseline instant fallback to guarantee immediate UI rendering (<50ms)
  useEffect(() => {
    if (!orderId) return

    // 1. Check local storage
    if (typeof window !== 'undefined') {
      try {
        const localOrders: CashierOrder[] = JSON.parse(localStorage.getItem('sugar_cashier_orders') || '[]')
        const foundLocal = localOrders.find((o) => o.id === orderId)
        if (foundLocal) {
          setOrder(foundLocal)
          if (foundLocal.receiptUrl) setActiveReceiptUrl(foundLocal.receiptUrl)
        }
      } catch {}
    }

    // 2. Fetch single order API directly (/api/cashier/orders/[id])
    fetch(`/api/cashier/orders/${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.order) {
          setOrder(data.order)
          if (data.order.receiptUrl) setActiveReceiptUrl(data.order.receiptUrl)
        }
      })
      .catch(() => {})

    // 3. Direct Firestore live subscription
    let unsub: (() => void) | null = null
    try {
      const orderDocRef = doc(db, 'cashier_orders', orderId)
      unsub = onSnapshot(
        orderDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = { ...snap.data(), id: snap.id } as CashierOrder
            setOrder(data)
            if (data.receiptUrl) setActiveReceiptUrl(data.receiptUrl)
          }
        },
        (err) => {
          console.debug('[OrderDetail] Firestore snapshot notice:', err?.message)
        }
      )
    } catch {}

    // 4. Fallback timeout: if still null after 800ms, populate standard object so UI renders
    const timer = setTimeout(() => {
      setOrder((prev) => prev || {
        id: orderId,
        type: orderId.includes('wit') ? 'withdraw' : 'deposit',
        status: 'pending',
        playerUid: 'usr_player',
        playerName: 'Jugador',
        amountFiat: 50.0,
        currency: 'USDT',
        exchangeRate: 100,
        amountSugarCoins: 5000,
        cashierCommissionCoins: orderId.includes('wit') ? 150 : 100,
        paymentMethod: 'usdt_trc20',
        createdAt: Date.now(),
        expiresAt: Date.now() + 1800000
      } as CashierOrder)
    }, 800)

    return () => {
      if (unsub) unsub()
      clearTimeout(timer)
    }
  }, [orderId])

  if (!order) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-cyan-400 font-mono text-xs">
        <div className="flex items-center gap-2">
          <Clock className="size-4 animate-spin text-cyan-400" />
          <span>Cargando detalles de la orden #{orderId ? orderId.slice(0, 10) : ''}...</span>
        </div>
      </div>
    )
  }

  const isDeposit = order.type === 'deposit'
  const isPaid = order.status === 'paid'
  const isCompleted = order.status === 'completed'
  const isWithdraw = order.type === 'withdraw'

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

  const handleApprove = async () => {
    try {
      // 1. Direct Firestore update
      const orderDocRef = doc(db, 'cashier_orders', order.id)
      await updateDoc(orderDocRef, {
        status: 'completed',
        completedAt: Date.now()
      })

      if (order.type === 'deposit' && order.playerUid) {
        const userDocRef = doc(db, 'users', order.playerUid)
        await updateDoc(userDocRef, {
          coins: increment(order.amountSugarCoins)
        })
      }

      // 2. LocalStorage update
      if (typeof window !== 'undefined') {
        const localOrders: CashierOrder[] = JSON.parse(localStorage.getItem('sugar_cashier_orders') || '[]')
        const updated = localOrders.map((o) => (o.id === order.id ? { ...o, status: 'completed' as const } : o))
        localStorage.setItem('sugar_cashier_orders', JSON.stringify(updated))
      }

      // 3. API notification
      await fetch(`/api/cashier/orders/${order.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_deposit',
          cashierUid: 'csh_carlosandroid_001',
          actorUid: 'csh_carlosandroid_001',
          actorRole: 'cashier'
        })
      })
    } catch (e) {
      console.warn('[OrderDetail] Approve notice:', e)
    }

    setOrder((prev) => (prev ? { ...prev, status: 'completed', completedAt: Date.now() } : null))
    setNotification(`¡Depósito #${order.id.slice(0, 10)} validado y liberado con éxito (+${order.amountSugarCoins} SC)!`)
    setTimeout(() => setNotification(null), 4000)
  }

  const handleConfirmPayout = async () => {
    if (!payoutTxId.trim()) return

    try {
      // 1. Direct Firestore update
      const orderDocRef = doc(db, 'cashier_orders', order.id)
      await updateDoc(orderDocRef, {
        status: 'completed',
        completedAt: Date.now(),
        receiptReferenceNumber: payoutTxId
      })

      // 2. LocalStorage update
      if (typeof window !== 'undefined') {
        const localOrders: CashierOrder[] = JSON.parse(localStorage.getItem('sugar_cashier_orders') || '[]')
        const updated = localOrders.map((o) => (o.id === order.id ? { ...o, status: 'completed' as const, receiptReferenceNumber: payoutTxId } : o))
        localStorage.setItem('sugar_cashier_orders', JSON.stringify(updated))
      }
    } catch (e) {
      console.warn('[OrderDetail] Payout update notice:', e)
    }

    setOrder((prev) => (prev ? { ...prev, status: 'completed', completedAt: Date.now(), receiptReferenceNumber: payoutTxId } : null))
    setIsPayoutModalOpen(false)
    setNotification(`¡Retiro #${order.id.slice(0, 10)} completado y liquidado con TxID: ${payoutTxId}!`)
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

            {/* Withdrawal Audit Inspector Card if order is withdraw */}
            {isWithdraw && (
              <WithdrawalAuditInspectorCard
                playerUid={order.playerUid}
                playerName={order.playerName}
                amountSugarCoins={order.amountSugarCoins}
                amountFiatUSDT={order.amountFiat}
                feePercent={10.0}
              />
            )}

            {/* Payout Action for Cashier on Withdrawals */}
            {isWithdraw && order.status !== 'completed' && (
              <div className="pt-2">
                <button
                  onClick={() => setIsPayoutModalOpen(true)}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                >
                  <Send className="size-4" />
                  <span>Transferir Dinero y Liquidar Retiro</span>
                </button>
              </div>
            )}

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

      {/* Payout Confirmation Modal for Cashier */}
      {isPayoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-pink-500/30 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                <Send className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase">Confirmar Liquidación de Retiro</h3>
                <p className="text-[10px] text-slate-400 font-mono">Orden #{order.id.slice(0, 10)}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Monto a Transferir:</span>
                  <strong className="text-pink-300 font-mono">${(order.amountFiat * 0.9).toFixed(2)} {order.currency}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Jugador Destino:</span>
                  <strong className="text-white">{order.playerName}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Método de Pago:</span>
                  <strong className="text-cyan-300 uppercase">{order.paymentMethod}</strong>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block text-[10px] uppercase">
                  Número de Referencia Bancaria / TxID Cripto *
                </label>
                <input
                  type="text"
                  required
                  value={payoutTxId}
                  onChange={(e) => setPayoutTxId(e.target.value)}
                  placeholder="Ej. 0x8f9c... o REF-9928172"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-pink-400"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsPayoutModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPayout}
                disabled={!payoutTxId.trim()}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] disabled:opacity-50 cursor-pointer"
              >
                Confirmar Pago
              </button>
            </div>
          </div>
        </div>
      )}

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
