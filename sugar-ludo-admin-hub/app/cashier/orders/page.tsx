'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { CashierOrder, OrderType } from '../../../types/cashier'
import { CashierManagementProfile } from '../../../types/admin-expanded'
import { OrderFilterTabs, FilterStatus } from '../../../components/orders/OrderFilterTabs'
import { OrderCard } from '../../../components/orders/OrderCard'
import { OrderRow } from '../../../components/orders/OrderRow'
import { ReceiptImageViewer } from '../../../components/receipts/ReceiptImageViewer'
import { useAdminAuth } from '../../../lib/admin-auth-context'
import { db } from '../../../lib/firebase'
import { collection, onSnapshot, query, limit } from 'firebase/firestore'
import { ArrowLeft, CreditCard, Wallet, Search, RefreshCw, CheckCircle, Clock, LayoutList, LayoutGrid } from 'lucide-react'

export default function CashierOrdersPage() {
  const { cashierList } = useAdminAuth()
  const [orders, setOrders] = useState<CashierOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentStatus, setCurrentStatus] = useState<FilterStatus>('pending')
  const [currentType, setCurrentType] = useState<'all' | OrderType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list')
  const [isMounted, setIsMounted] = useState(false)

  const [activeCashierSession, setActiveCashierSession] = useState<CashierManagementProfile | null>(null)

  useEffect(() => {
    setIsMounted(true)
    try {
      const saved = localStorage.getItem('sugar_cashier_view_mode')
      if (saved === 'grid' || saved === 'list') {
        setViewMode(saved)
      }
    } catch {}
  }, [])

  const handleToggleViewMode = (mode: 'list' | 'grid') => {
    setViewMode(mode)
    try {
      localStorage.setItem('sugar_cashier_view_mode', mode)
    } catch {}
  }

  // Resolve current active cashier profile
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSession = localStorage.getItem('sugar_cashier_session')
        if (savedSession) {
          const parsed = JSON.parse(savedSession)
          if (parsed && parsed.uid) {
            const live = cashierList.find((c) => c.uid === parsed.uid || (parsed.email && c.email.toLowerCase() === parsed.email.toLowerCase()))
            setActiveCashierSession(live || parsed)
            return
          }
        }
      } catch {}
    }
    if (cashierList && cashierList.length > 0) {
      setActiveCashierSession(cashierList[0])
    }
  }, [cashierList])

  const currentCashier = activeCashierSession || cashierList[0] || {
    uid: 'csh_primary',
    name: 'Cajero Autorizado',
    floatBalanceCoins: 30000
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
      console.warn('Error fetching orders:', e)
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
          if (event.data?.type === 'cashier_float_updated') {
            const { cashierUid, newCoins, newUSDT } = event.data
            setActiveCashierSession((prev: any) => {
              if (!prev || prev.uid === cashierUid) {
                return {
                  ...(prev || {}),
                  floatBalanceCoins: newCoins,
                  floatBalanceUSDT: newUSDT !== undefined ? newUSDT : newCoins / 100
                }
              }
              return prev
            })
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
        console.warn('[CashierOrders] Firestore onSnapshot notice:', err.message)
      })
    } catch (e) {
      console.warn('[CashierOrders] Listener setup error:', e)
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

    // 4. SSE Stream
    let sseSource: EventSource | null = null
    try {
      if (typeof EventSource !== 'undefined') {
        sseSource = new EventSource('http://localhost:3000/api/social/stream?uid=cashier_orders_list')
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

  // Receipt Modal State
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<CashierOrder | null>(null)

  // Filter Logic
  const filteredOrders = orders.filter((o) => {
    if (currentStatus !== 'all' && o.status !== currentStatus) return false
    if (currentType !== 'all' && o.type !== currentType) return false
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      return (
        o.id.toLowerCase().includes(q) ||
        (o.playerId && o.playerId.toLowerCase().includes(q)) ||
        (o.playerUid && o.playerUid.toLowerCase().includes(q)) ||
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
            href="/cashier"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
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

        {/* Float Balance Pill (USDT Principal + SC Secundario) */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-cyan-500/15 border border-emerald-500/40 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
          <Wallet className="size-4 text-emerald-400 animate-pulse" />
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-emerald-300 block leading-none">Saldo Flotante</span>
            <div className="flex items-baseline gap-1.5 justify-end">
              <span className="text-sm font-black text-white font-mono" suppressHydrationWarning>
                ${((currentCashier as any).floatBalanceUSDT ?? (currentCashier.floatBalanceCoins / 100)).toFixed(2)} USDT
              </span>
              <span className="text-[10px] font-bold text-slate-400 font-mono" suppressHydrationWarning>
                ({currentCashier.floatBalanceCoins.toLocaleString()} SC)
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
              className="w-full bg-slate-900/80 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
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

        {/* Filter Tabs & View Switcher Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex-1">
            <OrderFilterTabs
              currentStatus={currentStatus}
              onSelectStatus={setCurrentStatus}
              currentType={currentType}
              onSelectType={setCurrentType}
              counts={counts}
            />
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 p-1 bg-slate-900/80 rounded-2xl border border-white/10 shrink-0 self-end md:self-center">
            <button
              onClick={() => handleToggleViewMode('list')}
              title="Vista Lista Compacta"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                (!isMounted || viewMode === 'list')
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutList className="size-3.5" />
              <span className="hidden sm:inline">Lista</span>
            </button>
            <button
              onClick={() => handleToggleViewMode('grid')}
              title="Vista Cuadrícula Slim"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                (isMounted && viewMode === 'grid')
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="size-3.5" />
              <span className="hidden sm:inline">Tarjetas</span>
            </button>
          </div>
        </div>

        {/* Orders List / Grid */}
        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-center rounded-3xl bg-slate-900/40 border border-white/5 space-y-2">
            <Clock className="size-10 text-slate-600 mb-1" />
            <p className="text-sm font-bold text-white">No hay órdenes con este criterio (0 Casos)</p>
            <p className="text-xs text-slate-500 max-w-sm">
              Las nuevas solicitudes de depósito o retiro de los jugadores aparecerán automáticamente aquí.
            </p>
          </div>
        ) : isMounted && viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onViewReceipt={(ord) => setSelectedReceiptOrder(ord)}
                onApproveOrder={handleApprove}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredOrders.map((order) => (
              <OrderRow
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
    </div>
  )
}
