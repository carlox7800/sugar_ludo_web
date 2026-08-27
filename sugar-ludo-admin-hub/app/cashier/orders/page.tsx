'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { MOCK_ORDERS } from '../../../lib/mock-data'
import { CashierOrder, OrderType } from '../../../types/cashier'
import { OrderFilterTabs, FilterStatus } from '../../../components/orders/OrderFilterTabs'
import { OrderCard } from '../../../components/orders/OrderCard'
import { ReceiptImageViewer } from '../../../components/receipts/ReceiptImageViewer'
import { ArrowLeft, CreditCard, Wallet, Search, RefreshCw, CheckCircle, Clock } from 'lucide-react'

export default function CashierOrdersPage() {
  const [orders, setOrders] = useState<CashierOrder[]>(MOCK_ORDERS)
  const [currentStatus, setCurrentStatus] = useState<FilterStatus>('all')
  const [currentType, setCurrentType] = useState<'all' | OrderType>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [notification, setNotification] = useState<string | null>(null)

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

  const handleApprove = (orderId: string) => {
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

        {/* Float Balance Pill */}
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-gradient-to-r from-pink-500/10 via-purple-500/10 to-cyan-500/10 border border-pink-500/30">
          <Wallet className="size-4 text-pink-400" />
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block leading-none">Saldo Flotante</span>
            <span className="text-sm font-black text-white font-mono">50,000 SC</span>
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
            onClick={() => setOrders([...MOCK_ORDERS])}
            className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold border border-white/10 transition-colors cursor-pointer"
          >
            <RefreshCw className="size-3.5 text-cyan-400" />
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
          <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-slate-900/40 border border-white/5 space-y-2">
            <Clock className="size-10 text-slate-600 mb-1" />
            <p className="text-sm font-bold text-white">No hay órdenes con este criterio</p>
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
    </div>
  )
}
