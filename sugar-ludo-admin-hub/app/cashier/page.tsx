'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { CashierOrder, OrderType } from '../../types/cashier'
import { OrderFilterTabs, FilterStatus } from '../../components/orders/OrderFilterTabs'
import { OrderCard } from '../../components/orders/OrderCard'
import { ReceiptImageViewer } from '../../components/receipts/ReceiptImageViewer'
import { CashierAdminChatModal } from '../../components/cashier/CashierAdminChatModal'
import { CashierLogPanel } from '../../components/cashier/CashierLogPanel'
import { cashierLogger } from '../../lib/cashier-logger'
import { useAdminAuth } from '../../lib/admin-auth-context'
import { db } from '../../lib/firebase'
import { collection, onSnapshot, query, limit } from 'firebase/firestore'
import { OrdersCache } from '../../lib/orders-cache'
import { ArrowLeft, CreditCard, Wallet, Search, RefreshCw, CheckCircle, Clock, MessageSquare, LogOut, Coins, Calendar } from 'lucide-react'

export default function CashierMainDeskPage() {
  const { cashierList, logout, adminUser } = useAdminAuth()
  const [orders, setOrders] = useState<CashierOrder[]>(() => OrdersCache.get() || [])
  const [isLoading, setIsLoading] = useState(() => (OrdersCache.get() && OrdersCache.get()!.length > 0 ? false : true))
  const [currentStatus, setCurrentStatus] = useState<FilterStatus>('all')
  const [currentType, setCurrentType] = useState<'all' | OrderType>('all')
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'all'>('today')
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState<string | null>(null)
  const [isAdminChatOpen, setIsAdminChatOpen] = useState(false)
  const [selectedReceiptOrder, setSelectedReceiptOrder] = useState<CashierOrder | null>(null)
  const [activeCashierSession, setActiveCashierSession] = useState<{ uid: string; name: string; floatBalanceCoins: number } | null>(null)

  // Filter Logic
  const filteredOrders = orders.filter((o) => {
    if (currentStatus !== 'all' && o.status !== currentStatus) return false
    if (currentType !== 'all' && o.type !== currentType) return false
    
    // Date / Shift Filtering
    if (dateFilter === 'today') {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      if (o.createdAt < startOfToday.getTime()) return false
    } else if (dateFilter === 'week') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      if (o.createdAt < oneWeekAgo) return false
    }

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

  // Counts for tabs (computed against the selected date scope for clarity)
  const dateScopedOrders = orders.filter((o) => {
    if (dateFilter === 'today') {
      const startOfToday = new Date()
      startOfToday.setHours(0, 0, 0, 0)
      return o.createdAt >= startOfToday.getTime()
    } else if (dateFilter === 'week') {
      const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
      return o.createdAt >= oneWeekAgo
    }
    return true
  })

  const counts: Record<string, number> = {
    all: dateScopedOrders.length,
    pending: dateScopedOrders.filter((o) => o.status === 'pending').length,
    paid: dateScopedOrders.filter((o) => o.status === 'paid').length,
    verified: dateScopedOrders.filter((o) => o.status === 'verified').length,
    completed: dateScopedOrders.filter((o) => o.status === 'completed').length,
    disputed: dateScopedOrders.filter((o) => o.status === 'disputed').length,
  }

  // Resolve current active cashier profile from active session or registered cashiers
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSession = localStorage.getItem('sugar_cashier_session')
        if (savedSession) {
          const parsed = JSON.parse(savedSession)
          if (parsed && parsed.uid) {
            setActiveCashierSession(parsed)
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

  const fetchOrders = async (isManualRefresh = false) => {
    if (isManualRefresh) setIsLoading(true)
    cashierLogger.api(`Consultando órdenes en /api/cashier/orders`, { isManualRefresh })
    try {
      // 1. Instant check from cache
      const cached = OrdersCache.get()
      if (cached && cached.length > 0 && !isManualRefresh) {
        setOrders(cached)
        setIsLoading(false)
        cashierLogger.info(`Órdenes cargadas desde caché de memoria (${cached.length} órdenes)`)
      }

      // 2. Fetch API only if stale or manual refresh
      if (isManualRefresh || OrdersCache.isStale(20000)) {
        const res = await fetch('/api/cashier/orders')
        if (res.ok) {
          const data = await res.json()
          if (data.orders && Array.isArray(data.orders)) {
            setOrders(data.orders)
            OrdersCache.set(data.orders)
            cashierLogger.api(`Fetch /api/cashier/orders exitoso`, { totalOrders: data.orders.length })
          }
        } else {
          cashierLogger.error(`Error HTTP ${res.status} al consultar /api/cashier/orders`)
        }
      }
    } catch (e: any) {
      cashierLogger.error(`Error al consultar /api/cashier/orders`, { message: e?.message })
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    cashierLogger.info(`Bandeja principal de cajero montada`, {
      cajero: currentCashier.name,
      uid: currentCashier.uid,
      float: currentCashier.floatBalanceCoins
    })
    fetchOrders()

    // 1. Local BroadcastChannel for zero-latency peer updates
    let channel: BroadcastChannel | null = null
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel('sugar_ludo_social_channel')
        channel.onmessage = (event) => {
          if (event.data?.type === 'p2p_data' && event.data?.dataType === 'new_cashier_order' && event.data?.order) {
            const newOrd = event.data.order as CashierOrder
            cashierLogger.info(`Nueva orden recibida vía BroadcastChannel local`, { id: newOrd.id, type: newOrd.type })
            setOrders((prev) => {
              const updated = [newOrd, ...prev.filter((o) => o.id !== newOrd.id)]
              OrdersCache.set(updated)
              return updated
            })
            setIsLoading(false)
          }
        }
      }
    } catch {}

    // 2. Realtime subscription to Firestore (Spark Plan Cost $0 with limit)
    let unsubscribe: (() => void) | null = null
    try {
      cashierLogger.firestore(`Iniciando listener onSnapshot en colección cashier_orders (limit 50)`)
      const q = query(collection(db, 'cashier_orders'), limit(50))
      unsubscribe = onSnapshot(q, (snapshot) => {
        const liveOrders: CashierOrder[] = []
        snapshot.forEach((docSnap) => {
          liveOrders.push({ ...docSnap.data(), id: docSnap.id } as CashierOrder)
        })
        cashierLogger.firestore(`Listener onSnapshot recibió actualización de colección`, { totalDocs: liveOrders.length })
        if (liveOrders.length > 0 || snapshot.empty) {
          setOrders(liveOrders)
          OrdersCache.set(liveOrders)
          setIsLoading(false)
        }
      }, (err) => {
        cashierLogger.error(`Error en listener onSnapshot de cashier_orders`, {
          code: err?.code,
          message: err?.message
        })
      })
    } catch (e: any) {
      cashierLogger.error(`Excepción al conectar listener de cashier_orders`, { message: e?.message })
    }

    return () => {
      if (channel) channel.close()
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const handleApprove = async (orderId: string) => {
    cashierLogger.action(`Aprobando depósito rápido desde la bandeja`, { orderId })
    try {
      const res = await fetch(`/api/cashier/orders/${orderId}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_deposit',
          cashierUid: currentCashier.uid,
          actorUid: currentCashier.uid,
          actorRole: 'cashier'
        })
      })
      const actionRes = await res.json()
      if (res.ok) {
        cashierLogger.api(`Respuesta exitosa de approve_deposit rápido`, { actionRes })
      } else {
        cashierLogger.error(`Error en respuesta de approve_deposit rápido`, { actionRes })
      }
    } catch (e: any) {
      cashierLogger.error(`Excepción al ejecutar approve_deposit rápido`, { message: e?.message })
    }

    const updated = orders.map((o) =>
      o.id === orderId
        ? { ...o, status: 'completed' as const, completedAt: Date.now() }
        : o
    )
    setOrders(updated)
    OrdersCache.set(updated)
    setNotification(`¡Orden #${orderId.slice(0, 8)} liberada con éxito! Saldo acreditado al jugador.`)
    setTimeout(() => setNotification(null), 4000)
  }

  const handleLogout = () => {
    cashierLogger.click(`Cerrar Sesión de Cajero`)
    logout()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sugar_cashier_session')
      localStorage.removeItem('sugar_admin_session')
      window.location.href = '/admin'
    }
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-pink-500/10 border border-pink-500/30 text-pink-400">
            <CreditCard className="size-5" />
          </div>
          <div>
            <h1 className="font-black text-base text-white tracking-wide flex items-center gap-2">
              BANDEJA DE ÓRDENES P2P
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              cajeros.sugarludo.com &bull; Turno: <strong className="text-cyan-300">{currentCashier.name}</strong>
            </p>
          </div>
        </div>

        {/* Action Controls, Float Balance & Logout */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsAdminChatOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
          >
            <MessageSquare className="size-4" />
            <span className="hidden sm:inline">Chat con Administrador</span>
          </button>

          {/* Assigned Cashier Float Balance Badge */}
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-amber-500/15 via-yellow-500/15 to-pink-500/15 border border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
            <Coins className="size-4 text-amber-400 animate-pulse" />
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-amber-300 block leading-none">Saldo Flotante</span>
              <span className="text-sm font-black text-white font-mono">
                {currentCashier.floatBalanceCoins.toLocaleString()} SC
              </span>
            </div>
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="Cerrar Sesión de Cajero"
          >
            <LogOut className="size-4" />
            <span className="hidden md:inline">Cerrar Sesión</span>
          </button>
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
        {/* Search and Action Bar with Date Range Selector */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-80">
            <Search className="size-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por ID, jugador o referencia..."
              className="w-full bg-slate-900/80 border border-white/10 rounded-2xl pl-10 pr-4 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 font-sans"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end">
            {/* Shift / Date Range Filter */}
            <div className="flex items-center p-1 bg-slate-900/90 rounded-2xl border border-white/10 text-xs">
              <button
                onClick={() => {
                  cashierLogger.click(`Filtro Rango Fecha: Hoy (Turno)`)
                  setDateFilter('today')
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  dateFilter === 'today'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Hoy (Turno)
              </button>
              <button
                onClick={() => {
                  cashierLogger.click(`Filtro Rango Fecha: 7 Días`)
                  setDateFilter('week')
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  dateFilter === 'week'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                7 Días
              </button>
              <button
                onClick={() => {
                  cashierLogger.click(`Filtro Rango Fecha: Historial Todo`)
                  setDateFilter('all')
                }}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                  dateFilter === 'all'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Historial Todo
              </button>
            </div>

            <button
              onClick={() => {
                cashierLogger.click(`Botón Refrescar Órdenes Manualmente`)
                fetchOrders(true)
              }}
              disabled={isLoading}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className={`size-3.5 text-cyan-400 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refrescar</span>
            </button>
          </div>
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
