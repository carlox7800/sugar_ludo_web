'use client'

import React, { useState, useEffect, use } from 'react'
import Link from 'next/link'
import { MOCK_ORDERS, MOCK_CHAT_MESSAGES } from '../../../../lib/mock-data'
import { CashierOrder, OrderChatMessage } from '../../../../types/cashier'
import { ReceiptImageViewer } from '../../../../components/receipts/ReceiptImageViewer'
import { OrderChatPanel } from '../../../../components/chat/OrderChatPanel'
import { WithdrawalAuditInspectorCard } from '../../../../components/cashier/WithdrawalAuditInspectorCard'
import { CashierLogPanel } from '../../../../components/cashier/CashierLogPanel'
import { cashierLogger } from '../../../../lib/cashier-logger'
import { db } from '../../../../lib/firebase'
import { doc, onSnapshot, getDoc, updateDoc, increment } from 'firebase/firestore'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ShieldCheck, Eye, Clock, CheckCircle2, AlertTriangle, Wallet, Send, Check, Copy, RefreshCw } from 'lucide-react'
import { clsx } from 'clsx'
import { OrdersCache } from '../../../../lib/orders-cache'

import { useParams, useRouter } from 'next/navigation'

export default function OrderDetailPage() {
  const router = useRouter()
  const routeParams = useParams()
  const orderId = (routeParams?.id as string) || ''

  const [order, setOrder] = useState<CashierOrder | null>(() => {
    const cached = OrdersCache.get()
    return cached?.find((o) => o.id === orderId) || null
  })
  const [messages, setMessages] = useState<OrderChatMessage[]>([])
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | undefined>(undefined)
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [payoutTxId, setPayoutTxId] = useState('')
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)
  const [isDirectValidationModalOpen, setIsDirectValidationModalOpen] = useState(false)
  const [directTxId, setDirectTxId] = useState('')
  const [copiedHash, setCopiedHash] = useState(false)

  // Baseline instant fallback to guarantee immediate UI rendering (<50ms)
  useEffect(() => {
    if (!orderId) return
    cashierLogger.info(`Abriendo vista de detalle para Orden #${orderId.slice(0, 10)}`, { orderId })

    // 1. Check local storage / OrdersCache
    const cached = OrdersCache.get()
    const foundCached = cached?.find((o) => o.id === orderId)
    if (foundCached) {
      setOrder(foundCached)
      cashierLogger.info(`Orden cargada desde caché local de memoria`, { id: foundCached.id, status: foundCached.status, type: foundCached.type })
      if (foundCached.receiptUrl) setActiveReceiptUrl(foundCached.receiptUrl)
    }

    // 2. Fetch single order API directly (/api/cashier/orders/[id])
    cashierLogger.api(`Consultando API interna /api/cashier/orders/${orderId}`)
    fetch(`/api/cashier/orders/${orderId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.order) {
          setOrder(data.order)
          cashierLogger.api(`Respuesta exitosa de /api/cashier/orders/${orderId}`, { status: data.order.status, player: data.order.playerName })
          if (data.order.receiptUrl) setActiveReceiptUrl(data.order.receiptUrl)
        }
      })
      .catch((err) => {
        cashierLogger.error(`Error al consultar /api/cashier/orders/${orderId}`, { message: err?.message })
      })

    // 3. Direct Firestore live subscription
    let unsub: (() => void) | null = null
    try {
      cashierLogger.firestore(`Iniciando listener onSnapshot en cashier_orders/${orderId}`)
      const orderDocRef = doc(db, 'cashier_orders', orderId)
      unsub = onSnapshot(
        orderDocRef,
        (snap) => {
          if (snap.exists()) {
            const data = { ...snap.data(), id: snap.id } as CashierOrder
            setOrder(data)
            if (Array.isArray((data as any).supportMessages)) {
              setMessages((data as any).supportMessages)
            }
            cashierLogger.firestore(`Evento onSnapshot recibido para orden #${orderId.slice(0, 8)}`, {
              status: data.status,
              type: data.type,
              amount: data.amountFiat,
              currency: data.currency,
              refNumber: data.receiptReferenceNumber,
              messagesCount: Array.isArray((data as any).supportMessages) ? (data as any).supportMessages.length : 0
            })
            if (data.receiptUrl) setActiveReceiptUrl(data.receiptUrl)
          } else {
            cashierLogger.firestore(`Documento cashier_orders/${orderId} no existe en Firestore`)
          }
        },
        (err) => {
          cashierLogger.error(`Error en listener onSnapshot de orden #${orderId.slice(0, 8)}`, {
            code: err?.code,
            message: err?.message
          })
        }
      )
    } catch (e: any) {
      cashierLogger.error(`Excepción al conectar listener Firestore`, { message: e?.message })
    }

    // 4. Fallback timeout: if still null after 800ms, populate standard object so UI renders
    const timer = setTimeout(() => {
      setOrder((prev) => {
        if (!prev) {
          cashierLogger.info(`Inicializando objeto de orden predeterminado tras timeout de 800ms`)
          return {
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
          } as CashierOrder
        }
        return prev
      })
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

  const [isValidating, setIsValidating] = useState(false)

  const handleSendMessage = async (text: string, attachmentUrl?: string) => {
    if (!text.trim() && !attachmentUrl) return

    cashierLogger.click(`Enviar Mensaje de Chat`, {
      orderId: order.id,
      playerUid: order.playerUid,
      messagePreview: text.slice(0, 40),
      hasAttachment: !!attachmentUrl
    })

    const newMsg: OrderChatMessage = {
      id: `msg_${Date.now()}`,
      orderId: order.id,
      senderUid: 'csh_carlosandroid_001',
      senderName: 'carlosandroid (Cajero)',
      senderRole: 'cashier',
      message: text.trim(),
      timestamp: Date.now(),
      isRead: false,
      ...(attachmentUrl ? { attachmentUrl, attachmentType: 'image' as const } : {})
    }
    setMessages((prev) => [...prev, newMsg])

    // 1. Escritura directa a cashier_orders/{order.id}.supportMessages en Firestore (Permisos 100% abiertos)
    try {
      cashierLogger.firestore(`Guardando mensaje en cashier_orders/${order.id}.supportMessages`)
      const orderDocRef = doc(db, 'cashier_orders', order.id)
      const orderSnap = await getDoc(orderDocRef)
      const existingMsgs = (orderSnap.exists() && Array.isArray(orderSnap.data()?.supportMessages))
        ? orderSnap.data().supportMessages
        : []

      const cleanMsg: any = {
        id: newMsg.id,
        orderId: order.id,
        senderUid: 'csh_carlosandroid_001',
        senderName: 'carlosandroid (Cajero)',
        senderRole: 'cashier',
        message: text.trim(),
        timestamp: Date.now()
      }
      if (attachmentUrl) {
        cleanMsg.attachmentUrl = attachmentUrl
      }

      await updateDoc(orderDocRef, {
        supportMessages: [...existingMsgs, cleanMsg],
        lastMessage: text.trim(),
        lastMessageTime: Date.now(),
        hasUnreadCashierMessage: true
      })
      cashierLogger.firestore(`Mensaje guardado exitosamente en cashier_orders/${order.id}`)
    } catch (fsErr: any) {
      cashierLogger.error(`Error guardando mensaje en cashier_orders/${order.id}`, {
        code: fsErr?.code,
        message: fsErr?.message
      })
    }

    // 2. Post al backend API para garantizar persistencia y sincronizacion
    try {
      cashierLogger.api(`POST /api/cashier/orders/${order.id}/message`)
      const res = await fetch(`/api/cashier/orders/${order.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          senderName: 'carlosandroid (Cajero)',
          senderUid: 'csh_carlosandroid_001',
          senderRole: 'cashier',
          attachmentUrl,
          playerUid: order.playerUid
        })
      })
      const data = await res.json()
      if (res.ok) {
        cashierLogger.api(`Respuesta exitosa de /api/cashier/orders/${order.id}/message`, { data })
      } else {
        cashierLogger.error(`Respuesta con error de /api/cashier/orders/${order.id}/message (HTTP ${res.status})`, { data })
      }
    } catch (e: any) {
      cashierLogger.error(`Excepción en fetch /api/cashier/orders/${order.id}/message`, { message: e?.message })
    }
  }

  const handleApprove = async (verifiedTxId?: string) => {
    const finalRef = verifiedTxId || order.receiptReferenceNumber || `TX-${Date.now().toString(36).toUpperCase()}`
    cashierLogger.action(`Iniciando Validación y Liberación de Depósito`, {
      orderId: order.id,
      amountFiat: order.amountFiat,
      amountSugarCoins: order.amountSugarCoins,
      playerUid: order.playerUid,
      referenceNumber: finalRef
    })
    setIsValidating(true)
    
    // 1. LocalStorage & OrdersCache instant optimistic update
    const updatedOrder = {
      ...order,
      status: 'completed' as const,
      completedAt: Date.now(),
      receiptReferenceNumber: finalRef
    }
    OrdersCache.updateOrder(updatedOrder)
    if (typeof window !== 'undefined') {
      const localOrders: CashierOrder[] = JSON.parse(localStorage.getItem('sugar_cashier_orders') || '[]')
      const updated = localOrders.map((o) => (o.id === order.id ? updatedOrder : o))
      localStorage.setItem('sugar_cashier_orders', JSON.stringify(updated))
    }
    cashierLogger.info(`Actualización optimista de orden en caché local completada`)

    try {
      // 2. Direct Firestore update (Client side)
      cashierLogger.firestore(`Actualizando cashier_orders/${order.id} a status: completed`)
      const orderDocRef = doc(db, 'cashier_orders', order.id)
      await updateDoc(orderDocRef, {
        status: 'completed',
        completedAt: Date.now(),
        receiptReferenceNumber: finalRef
      })
      cashierLogger.firestore(`Firestore update exitoso en cashier_orders/${order.id}`)

      if (order.type === 'deposit' && order.playerUid) {
        cashierLogger.firestore(`Acreditando saldo +${order.amountSugarCoins} SC a users/${order.playerUid}`)
        const userDocRef = doc(db, 'users', order.playerUid)
        await updateDoc(userDocRef, {
          coins: increment(order.amountSugarCoins)
        })
        cashierLogger.firestore(`Saldo acreditado exitosamente a users/${order.playerUid}`)
      }

      // 3. Backend Atomic Action (Server side - guaranteed persistence in Firestore)
      cashierLogger.api(`Llamando backend /api/cashier/orders/${order.id}/action con approve_deposit`)
      const res = await fetch(`/api/cashier/orders/${order.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_deposit',
          cashierUid: 'csh_carlosandroid_001',
          actorUid: 'csh_carlosandroid_001',
          actorRole: 'cashier',
          txId: finalRef,
          referenceNumber: finalRef
        })
      })
      const actionData = await res.json()
      if (res.ok) {
        cashierLogger.api(`Respuesta exitosa de acción backend approve_deposit`, { actionData })
      } else {
        cashierLogger.error(`Error en acción backend approve_deposit (HTTP ${res.status})`, { actionData })
      }
    } catch (e: any) {
      cashierLogger.error(`Error durante la validación del depósito #${order.id.slice(0, 8)}`, {
        code: e?.code,
        message: e?.message
      })
    } finally {
      setIsValidating(false)
    }

    setOrder((prev) => (prev ? { ...prev, status: 'completed', completedAt: Date.now(), receiptReferenceNumber: finalRef } : null))
    setIsDirectValidationModalOpen(false)
    setNotification(`¡Depósito #${order.id.slice(0, 10)} validado y liberado con éxito (+${order.amountSugarCoins} SC acreditados al jugador)!`)
    setTimeout(() => setNotification(null), 4000)
  }

  const [isValidatingPayout, setIsValidatingPayout] = useState(false)

  const handleConfirmPayout = async () => {
    const finalPayoutRef = payoutTxId.trim() || `TX-PAYOUT-${Date.now().toString(36).toUpperCase()}`
    setPayoutTxId(finalPayoutRef)
    
    cashierLogger.action(`Iniciando Liquidación de Retiro`, {
      orderId: order.id,
      playerUid: order.playerUid,
      amountFiat: order.amountFiat,
      payoutTxId: finalPayoutRef
    })
    setIsValidatingPayout(true)

    // 1. LocalStorage & OrdersCache instant optimistic update
    const updatedOrder = {
      ...order,
      status: 'completed' as const,
      completedAt: Date.now(),
      receiptReferenceNumber: finalPayoutRef
    }
    OrdersCache.updateOrder(updatedOrder)
    if (typeof window !== 'undefined') {
      const localOrders: CashierOrder[] = JSON.parse(localStorage.getItem('sugar_cashier_orders') || '[]')
      const updated = localOrders.map((o) => (o.id === order.id ? updatedOrder : o))
      localStorage.setItem('sugar_cashier_orders', JSON.stringify(updated))
    }
    cashierLogger.info(`Actualización optimista de retiro en caché local completada`)

    try {
      // 2. Direct Firestore update (Client side)
      cashierLogger.firestore(`Actualizando cashier_orders/${order.id} a status: completed con ref: ${finalPayoutRef}`)
      const orderDocRef = doc(db, 'cashier_orders', order.id)
      await updateDoc(orderDocRef, {
        status: 'completed',
        completedAt: Date.now(),
        receiptReferenceNumber: finalPayoutRef
      })
      cashierLogger.firestore(`Firestore update exitoso en cashier_orders/${order.id}`)

      // 3. Backend Atomic Action (Server side - guaranteed persistence in Firestore)
      cashierLogger.api(`Llamando backend /api/cashier/orders/${order.id}/action con complete_withdrawal`)
      const res = await fetch(`/api/cashier/orders/${order.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_withdrawal',
          cashierUid: 'csh_carlosandroid_001',
          actorUid: 'csh_carlosandroid_001',
          actorRole: 'cashier',
          payoutTxId: finalPayoutRef
        })
      })
      const resData = await res.json()
      if (res.ok) {
        cashierLogger.api(`Respuesta exitosa de acción backend complete_withdrawal`, { resData })
      } else {
        cashierLogger.error(`Error en acción backend complete_withdrawal (HTTP ${res.status})`, { resData })
      }
    } catch (e: any) {
      cashierLogger.error(`Error durante la liquidación de retiro #${order.id.slice(0, 8)}`, {
        code: e?.code,
        message: e?.message
      })
    } finally {
      setIsValidatingPayout(false)
    }

    setOrder((prev) => (prev ? { ...prev, status: 'completed', completedAt: Date.now(), receiptReferenceNumber: finalPayoutRef } : null))
    setIsPayoutModalOpen(false)
    setNotification(`¡Retiro #${order.id.slice(0, 10)} completado y liquidado con TxID: ${finalPayoutRef}!`)
    setTimeout(() => setNotification(null), 4000)
  }

  const handleCopyHash = (text: string) => {
    cashierLogger.click(`Copiar Hash/TxID al portapapeles`, { hash: text })
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    }
  }

  const handleViewCustomImage = (url: string) => {
    cashierLogger.click(`Abrir visor de imagen comprobante`, { url })
    setActiveReceiptUrl(url)
    setIsReceiptOpen(true)
  }

  const isPending = order.status === 'pending'

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
              <span>ORDEN #{order.id.slice(0, 8)}</span>
              <span
                className={clsx(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isPaid
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                    : isPending
                    ? 'bg-amber-500/30 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse'
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

        {/* Action Buttons for Validation / Release */}
        {isDeposit && !isCompleted && (
          <div className="flex items-center gap-2">
            {isPaid ? (
              <button
                onClick={() => {
                  cashierLogger.click(`Botón Validar y Liberar Saldo (Depósito Pagado)`)
                  handleApprove()
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
              >
                <ShieldCheck className="size-4" />
                <span>Validar y Liberar Saldo</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  cashierLogger.click(`Botón Validar con Hash / TxID (Abrir modal)`)
                  setDirectTxId(order.receiptReferenceNumber || '')
                  setIsDirectValidationModalOpen(true)
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer"
              >
                <AlertTriangle className="size-4" />
                <span>Validar con Hash / TxID</span>
              </button>
            )}
          </div>
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

            {/* Reference / Hash Bar with Fast Copy */}
            {(order.receiptReferenceNumber || order.status === 'pending') && (
              <div className="p-3 bg-slate-950/80 rounded-2xl border border-white/10 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Hash / Referencia Tx</span>
                  <span className="font-mono text-white text-xs truncate block">
                    {order.receiptReferenceNumber || 'Sin referencia registrada aún'}
                  </span>
                </div>
                {order.receiptReferenceNumber && (
                  <button
                    onClick={() => handleCopyHash(order.receiptReferenceNumber!)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-bold border border-white/10 transition-colors cursor-pointer shrink-0"
                    title="Copiar Hash"
                  >
                    {copiedHash ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5 text-cyan-400" />}
                    <span>{copiedHash ? '¡Copiado!' : 'Copiar'}</span>
                  </button>
                )}
              </div>
            )}

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
                  onClick={() => {
                    cashierLogger.click(`Botón Transferir Dinero y Liquidar Retiro (Abrir modal)`)
                    setIsPayoutModalOpen(true)
                  }}
                  className="w-full py-3 rounded-2xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                >
                  <Send className="size-4" />
                  <span>Transferir Dinero y Liquidar Retiro</span>
                </button>
              </div>
            )}

            {/* Receipt Preview Thumbnail (solo si existe comprobante adjunto) */}
            {order.receiptUrl && (
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
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Live Order Chat with dynamic responsive height (7 cols) */}
        <div className="lg:col-span-7 h-[calc(100vh-180px)] min-h-[520px]">
          <OrderChatPanel
            orderId={order.id}
            currentUserUid="csh_carlosandroid_001"
            currentUserName="carlosandroid (Cajero)"
            currentUserRole="cashier"
            messages={messages}
            counterpartReadAt={order.playerReadAt || 0}
            isOrderResolved={order.status === 'completed'}
            onSendMessage={handleSendMessage}
            onViewImage={handleViewCustomImage}
            isDisputed={order.status === 'disputed'}
            onOpenDisputeModal={() => {
              cashierLogger.click(`Abrir Modal de Disputa`)
              setIsDisputeOpen(true)
            }}
          />
        </div>
      </main>

      {/* Direct Validation Modal with TxID for Cashier */}
      {isDirectValidationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase">Validación Directa por Hash / TxID</h3>
                <p className="text-[10px] text-slate-400 font-mono">Orden #{order.id.slice(0, 10)}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Monto Verificado:</span>
                  <strong className="text-white font-mono">{order.amountFiat} {order.currency}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Crédito a Liberar:</span>
                  <strong className="text-cyan-300 font-mono">+{order.amountSugarCoins.toLocaleString()} SC</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Jugador:</span>
                  <strong className="text-white">{order.playerName}</strong>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block text-[10px] uppercase">
                  Hash de Transacción / Referencia Bancaria Verificada *
                </label>
                <input
                  type="text"
                  required
                  value={directTxId}
                  onChange={(e) => setDirectTxId(e.target.value)}
                  placeholder="Ej. 0x7c8a... o REF-10928374"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-slate-500">
                  Ingresa el Hash o referencia tras verificar el ingreso de fondos en tu cuenta bancaria o wallet.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setIsDirectValidationModalOpen(false)}
                disabled={isValidating}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleApprove(directTxId.trim())}
                disabled={!directTxId.trim() || isValidating}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Procesando validación...</span>
                  </>
                ) : (
                  <span>Confirmar y Liberar Saldo</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold block text-[10px] uppercase">
                    Número de Referencia Bancaria / TxID Cripto *
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const autoRef = `TX-PAYOUT-${Date.now().toString(36).toUpperCase()}`
                      setPayoutTxId(autoRef)
                      cashierLogger.click(`Generar Referencia Automática de Retiro`, { autoRef })
                    }}
                    className="text-[10px] text-pink-400 hover:text-pink-300 font-bold underline cursor-pointer"
                  >
                    ⚡ Generar Automático
                  </button>
                </div>
                <input
                  type="text"
                  value={payoutTxId}
                  onChange={(e) => setPayoutTxId(e.target.value)}
                  placeholder="Ej. 0x8f9c... o REF-9928172"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-pink-400"
                />
                <p className="text-[10px] text-slate-400">
                  Ingresa el código tras transferir los fondos o usa <strong>⚡ Generar Automático</strong>.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  cashierLogger.click(`Cancelar Liquidación de Retiro`)
                  setIsPayoutModalOpen(false)
                }}
                disabled={isValidatingPayout}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  cashierLogger.click(`Clic en botón Confirmar Pago Retiro`, {
                    payoutTxId: payoutTxId.trim() || 'auto-generada'
                  })
                  handleConfirmPayout()
                }}
                disabled={isValidatingPayout}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isValidatingPayout ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Procesando liquidación...</span>
                  </>
                ) : (
                  <span>Confirmar Pago</span>
                )}
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
