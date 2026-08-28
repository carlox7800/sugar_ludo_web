'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { CashierOrder, OrderType } from '../../types/cashier'
import { OrderFilterTabs, FilterStatus } from '../../components/orders/OrderFilterTabs'
import { OrderCard } from '../../components/orders/OrderCard'
import { ReceiptImageViewer } from '../../components/receipts/ReceiptImageViewer'
import { CashierAdminChatModal } from '../../components/cashier/CashierAdminChatModal'
import { useAdminAuth } from '../../lib/admin-auth-context'
import { db } from '../../lib/firebase'
import { collection, onSnapshot, query, limit } from 'firebase/firestore'
import { ArrowLeft, CreditCard, Wallet, Search, RefreshCw, CheckCircle, Clock, MessageSquare } from 'lucide-react'

export default function CashierMainDeskPage() {
  const { cashierList } = useAdminAuth()
  const [orders, setOrders] = useState<CashierOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentStatus, setCurrentStatus] = useState<FilterStatus>('all')
  const [currentType, setCurrentType] = useState<'all' | OrderType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState<string | null>(null)
  const [isAdminChatOpen, setIsAdminChatOpen] = useState(false)
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<CashierOrder | null>(null)

  const currentCashier = cashierList[0] || {
    uid: 'csh_primary',
    name: 'Cajero Autorizado',
    floatBalanceCoins: 0
  }

  const fetchOrders = async () => {
    setIsLoading(true)
    try {
      // 1. Cargar desde localStorage como fuente inmediata
      if (typeof window !== 'undefined') {
        const localOrders = JSON.parse(localStorage.getItem('sugar_cashier_orders') || '[]')
        if (localOrders.length > 0) {
          setOrders(localOrders)
        }
      }

      // 2. Cargar desde API
      const res = await fetch('/api/cashier/orders')
      if (res.ok) {
        const data = await res.json()
        if (data.orders && data.orders.length > 0) {
          setOrders(data.orders)
        }
      }
    } catch (e) {
      console.warn('[CashierDesk] Error fetching orders:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchOrders()

    // 1. Escuchar canal BroadcastChannel local
    let channel: BroadcastChannel | null = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('sugar_ludo_social_channel')
        channel.onmessage = (event) => {
          if (event.data?.type === 'p2p_data' && event.data?.dataType === 'new_cashier_order' && event.data?.order) {
            const newOrd = event.data.order as CashierOrder
            setOrders((prev) => {
              const filtered = prev.filter((o) => o.id !== newOrd.id)
              return [newOrd, ...filtered]
            })
            setIsLoading(false)
          }
        }
      }
    } catch {}

    // 2. Suscripción en tiempo real a Firestore
    let unsubscribe: (() => void) | null = null
    try {
      const q = query(collection(db, 'cashier_orders'), limit(50))
      unsubscribe = onSnapshot(q, (snapshot) => {
        const liveOrders: CashierOrder[] = []
        snapshot.forEach((docSnap) => {
          liveOrders.push({ ...docSnap.data(), id: docSnap.id } as CashierOrder)
        })
        if (liveOrders.length > 0 || snapshot.empty) {
          setOrders(liveOrders)
          setIsLoading(false)
        }
      }, (err) => {
        console.debug('[CashierDesk] Firestore onSnapshot notice:', err.message)
      })
    } catch (e) {
      console.warn('[CashierDesk] Listener setup error:', e)
    }

    // 3. Polling activo cada 3 segundos
    const pollInterval = setInterval(() => {
      fetch('/api/cashier/orders')
        .then(res => res.json())
        .then(data => {
          if (data.orders && Array.isArray(data.orders)) {
            setOrders(data.orders)
          }
        })
        .catch(() => {})
    }, 3000)

    // 4. SSE Stream de actualización
    let sseSource: EventSource | null = null
    try {
      if (typeof EventSource !== 'undefined') {
        const sseUrls = [
          'https://sugar-ludo-web.onrender.com/api/social/stream?uid=cashier_orders_desk',
          'http://localhost:3000/api/social/stream?uid=cashier_orders_desk'
        ]
        const isRender = typeof window !== 'undefined' && window.location.hostname.includes('onrender.com')
        sseSource = new EventSource(isRender ? sseUrls[0] : sseUrls[1])
        sseSource.onmessage = (event) => {
          try {
            const evData = JSON.parse(event.data)
            if (evData.type === 'p2p_data' && evData.dataType === 'new_cashier_order' && evData.order) {
              const newOrd = evData.order as CashierOrder
              setOrders((prev) => {
                const filtered = prev.filter((o) => o.id !== newOrd.id)
                return [newOrd, ...filtered]
              })
              setIsLoading(false)
            }
          } catch {}
        }
      }
    } catch {}

    return () => {
      if (channel) channel.close()
      if (unsubscribe) unsubscribe()
      clearInterval(pollInterval)
      if (sseSource) sseSource.close()
    }
  }, [])

  // Filter Logic
  const filteredOrders = orders.filter((o) => {
    if (currentStatus !== 'all' && o.status !== currentStatus) return false
    if (currentType !== 'all' && o.type !== currentType) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        o.id.toLowerCase().includes(q) ||
        o.playerName.toLowerCase().includes(q) ||
        (o.receiptReferenceNumber && o.receiptReferenceNumber.toLowerCase().includes(q))
      )
    }
    return true
  })

  // Counts for tabs
  const counts: Record<string, number> = {
    all: orders.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    paid: orders.filter((o) => o.status === 'paid').length,
    verified: orders.filter((o) => o.status === 'verified').length,
    completed: orders.filter((o) => o.status === 'completed').length,
    disputed: orders.filter((o) => o.status === 'disputed').length,
  }

  const handleApprove = async (orderId: string) => {
    try {
      await fetch(`/api/cashier/orders/${orderId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_deposit',
          cashierUid: currentCashier.uid,
          actorUid: currentCashier.uid,
          actorRole: 'cashier'
        })
      })
    } catch {}

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? { ...o, status: 'completed', completedAt: Date.now() }
          : o
      )
    )
    setNotification(`¡Orden #${orderId.slice(0, 8)} liberada con éxito! Saldo acreditado al jugador.`)
    setTimeout(() => setNotification(null), 4000)
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
            title="Volver a Inicio"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="font-black text-base text-white tracking-wide flex items-center gap-2">
              <CreditCard className="size-5 text-pink-400" /> BANDEJA DE ÓRDENES P2P
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              cajeros.sugarludo.com &bull; Gestión y Liquidación en Tiempo Real
            </p>
          </div>
        </div>

        {/* Action Controls & Float Balance */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAdminChatOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <MessageSquare className="size-4" />
            <span>Chat con Administrador</span>
          </button>

          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 border border-pink-500/30">
            <Wallet className="size-4 text-pink-400" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Saldo Flotante</span>
              <span className="text-sm font-black text-white font-mono">
                {currentCashier.floatBalanceCoins.toLocaleString()} SC
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="size-5" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* Search and Action Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative w-full sm:w-96">
            <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID, jugador o referencia..."
              className="w-full bg-slate-900/80 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
            />
          </div>

          <button
            onClick={fetchOrders}
            disabled={isLoading}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw className={`size-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Refrescar Órdenes</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <OrderFilterTabs
          currentStatus={currentStatus}
          onSelectStatus={setCurrentStatus}
          currentType={currentType}
          onSelectType={setCurrentType}
          counts={counts}
        />

        {/* Orders Grid */}
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center rounded-3xl bg-slate-900/40 border border-white/5 space-y-2">
            <Clock className="size-10 text-slate-600 mb-1" />
            <p className="text-sm font-bold text-white">No hay órdenes con este criterio (0 Casos)</p>
            <p className="text-xs text-slate-500 max-w-sm">
              Las nuevas solicitudes de depósito o retiro de los jugadores aparecerán automáticamente aquí.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onViewReceipt={(ord) => setSelectedReceiptOrder(ord)}
                onApproveOrder={handleApprove}
              />
            ))}
          </div>
        )}
      </main>

      {/* Interactive Receipt Modal */}
      {selectedReceiptOrder && (
        <ReceiptImageViewer
          isOpen={!!selectedReceiptOrder}
          onClose={() => setSelectedReceiptOrder(null)}
          imageUrl={selectedReceiptOrder.receiptUrl}
          referenceNumber={selectedReceiptOrder.receiptReferenceNumber}
          bankName={selectedReceiptOrder.paymentMethod}
          amount={`${selectedReceiptOrder.amountFiat.toLocaleString()} ${selectedReceiptOrder.currency}`}
        />
      )}

      {/* Admin Chat Modal */}
      <CashierAdminChatModal
        isOpen={isAdminChatOpen}
        onClose={() => setIsAdminChatOpen(false)}
        cashierName={currentCashier.name}
      />
    </div>
  )
}
