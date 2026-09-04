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
import { doc, onSnapshot, getDoc, updateDoc, setDoc, increment, collection } from 'firebase/firestore'
import { ArrowLeft, ArrowDownLeft, ArrowUpRight, ShieldCheck, ShieldAlert, Eye, Clock, CheckCircle2, AlertTriangle, AlertCircle, Wallet, Send, Check, Copy, RefreshCw, Crown } from 'lucide-react'
import { clsx } from 'clsx'
import { OrdersCache } from '../../../../lib/orders-cache'
import { useAdminAuth } from '../../../../lib/admin-auth-context'
import { getWithdrawalSla } from '../../../../lib/sla-calculator'

import { useParams, useRouter } from 'next/navigation'

export default function OrderDetailPage() {
  const router = useRouter()
  const routeParams = useParams()
  const orderId = (routeParams?.id as string) || ''
  const { cashierList, updateCashierFloat } = useAdminAuth()

  const [currentCashierSession, setCurrentCashierSession] = useState<{ uid: string; name: string; email?: string }>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('sugar_cashier_session')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.uid) return parsed
        }
      } catch {}
    }
    return { uid: 'csh_carlosandroid_001', name: 'carlosandroid (Cajero)' }
  })

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('sugar_cashier_session')
        if (saved) {
          const parsed = JSON.parse(saved)
          if (parsed && parsed.uid) {
            const live = cashierList.find(c => c.uid === parsed.uid || (parsed.email && c.email.toLowerCase() === parsed.email.toLowerCase()))
            setCurrentCashierSession(live || parsed)
          }
        } else if (cashierList.length > 0) {
          setCurrentCashierSession(cashierList[0])
        }
      } catch {}
    }
  }, [cashierList])

  const [order, setOrder] = useState<CashierOrder | null>(() => {
    const cached = OrdersCache.get()
    return cached?.find((o) => o.id === orderId) || null
  })
  const [messages, setMessages] = useState<OrderChatMessage[]>([])
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [activeReceiptUrl, setActiveReceiptUrl] = useState<string | undefined>(undefined)
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [notification, setNotificationState] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)

  const setNotification = (val: string | { message: string; type: 'success' | 'error' | 'info' } | null) => {
    if (!val) {
      setNotificationState(null)
      return
    }
    if (typeof val === 'string') {
      const isErr = val.toLowerCase().includes('error') || val.toLowerCase().includes('fallo') || val.toLowerCase().includes('denegad') || val.toLowerCase().includes('insuficiente')
      setNotificationState({ message: val, type: isErr ? 'error' : 'success' })
    } else {
      setNotificationState(val)
    }
    setTimeout(() => setNotificationState(null), 4500)
  }
  const [payoutTxId, setPayoutTxId] = useState('')
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)
  const [isDirectValidationModalOpen, setIsDirectValidationModalOpen] = useState(false)
  const [directTxId, setDirectTxId] = useState('')
  const [copiedHash, setCopiedHash] = useState(false)
  const [disputeReason, setDisputeReason] = useState('')
  const [isEscalating, setIsEscalating] = useState(false)

  const handleEscalateToDispute = async () => {
    if (!order || !disputeReason.trim()) return
    setIsEscalating(true)
    const now = Date.now()
    const reason = disputeReason.trim()

    try {
      // 1. Actualizar orden en Firestore
      const orderRef = doc(db, 'cashier_orders', order.id)
      await updateDoc(orderRef, {
        status: 'disputed',
        disputeReason: reason,
        disputedAt: now,
        disputedBy: currentCashierSession?.name || 'Cajero'
      })

      // 2. Crear caso de disputa en dispute_cases
      const disputeRef = doc(db, 'dispute_cases', order.id)
      await setDoc(disputeRef, {
        id: order.id,
        orderId: order.id,
        orderType: order.type,
        playerUid: order.playerUid || (order as any).userId || 'usr_player',
        playerName: order.playerName || (order as any).userName || 'Jugador Sugar',
        cashierUid: currentCashierSession?.uid || 'csh_001',
        cashierName: currentCashierSession?.name || 'Cajero Oficial',
        amountSugarCoins: order.amountSugarCoins,
        amountFiat: order.amountFiat,
        currency: order.currency,
        reason,
        receiptUrl: order.receiptUrl || '',
        status: 'open',
        createdAt: now
      }, { merge: true })

      // 3. Notificar en chat de orden
      await handleSendMessage(`⚠️ [ORDEN ESCALADA A DISPUTA]: ${reason}. El caso ha sido remitido al Super Admin para arbitraje final.`)

      setOrder((prev) => (prev ? { ...prev, status: 'disputed' } : null))
      setIsDisputeOpen(false)
      setDisputeReason('')
      setNotification('¡Orden escalada a Disputa oficial ante la Administración!')
      setTimeout(() => setNotification(null), 4000)
    } catch (e: any) {
      console.error('[CashierDispute] Error escalando:', e)
      setNotification(`Error al escalar: ${e.message}`)
      setTimeout(() => setNotification(null), 4000)
    } finally {
      setIsEscalating(false)
    }
  }

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
  const isCancelled = order.status === 'cancelled'
  const isWithdraw = order.type === 'withdraw'

  // Saldo flotante real de trabajo del cajero activo
  const cashierTarget = cashierList.find(c => c.uid === currentCashierSession.uid || (currentCashierSession.email && c.email.toLowerCase() === currentCashierSession.email.toLowerCase())) || currentCashierSession
  const cashierFloatCoins = Number((cashierTarget as any).floatBalanceCoins ?? 0)
  const cashierFloatUSDT = Number((cashierTarget as any).floatBalanceUSDT ?? (cashierFloatCoins / 100))

  const [, setTick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  const slaInfo = getWithdrawalSla(order)
  const totalFiatRequestedUSD = Number(order.amountFiat || (Number(order.amountSugarCoins || 0) / 100))
  const isVipOrder = Boolean(slaInfo?.isVip || (order as any).isVip || (order as any).isVipWithdraw || (order.paymentMethod as string) === 'usdt_bep20' || (order.paymentMethod as string) === 'usdt_trc20_vip')
  const withdrawalFeePercent = isVipOrder ? 0.10 : 0.05
  const withdrawalFeeUSD = parseFloat((totalFiatRequestedUSD * withdrawalFeePercent).toFixed(2))
  const netPayoutUSD = parseFloat((totalFiatRequestedUSD - withdrawalFeeUSD).toFixed(2))
  const hasSufficientFloat = cashierFloatUSDT >= netPayoutUSD

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
      senderUid: currentCashierSession.uid,
      senderName: currentCashierSession.name,
      senderRole: 'cashier',
      message: text.trim(),
      timestamp: Date.now(),
      isRead: false,
      ...(attachmentUrl ? { attachmentUrl, attachmentType: 'image' as const } : {})
    }
    setMessages((prev) => [...prev, newMsg])

    // 1. Escritura directa a cashier_orders/{order.id}.supportMessages en Firestore
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
        senderUid: currentCashierSession.uid,
        senderName: currentCashierSession.name,
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

    // 2. Post al backend API
    try {
      fetch(`/api/cashier/orders/${order.id}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text.trim(),
          senderName: currentCashierSession.name,
          senderUid: currentCashierSession.uid,
          senderRole: 'cashier',
          attachmentUrl,
          playerUid: order.playerUid
        })
      }).catch(() => {})
    } catch {}
  }

  const handleApprove = async (verifiedTxId?: string) => {
    const finalRef = verifiedTxId || order.receiptReferenceNumber || `TX-${Date.now().toString(36).toUpperCase()}`
    const depositUSD = Number(order.amountFiat || (order.amountSugarCoins / 100))
    const depositCoins = Number(order.amountSugarCoins || Math.round(depositUSD * 100))

    cashierLogger.action(`Iniciando Validación y Liberación de Depósito`, {
      orderId: order.id,
      amountFiat: depositUSD,
      amountSugarCoins: depositCoins,
      playerUid: order.playerUid,
      referenceNumber: finalRef
    })
    setIsValidating(true)
    
    // 1. LocalStorage & OrdersCache instant optimistic update
    const updatedOrder = {
      ...order,
      status: 'completed' as const,
      completedAt: Date.now(),
      receiptReferenceNumber: finalRef,
      verifiedAt: Date.now()
    }
    OrdersCache.updateOrder(updatedOrder)
    if (typeof window !== 'undefined') {
      const localOrders: CashierOrder[] = JSON.parse(localStorage.getItem('sugar_cashier_orders') || '[]')
      const updated = localOrders.map((o) => (o.id === order.id ? updatedOrder : o))
      localStorage.setItem('sugar_cashier_orders', JSON.stringify(updated))
    }

    try {
      // 2. Llamada exclusiva y autoritativa al backend (runTransaction atómico en servidor)
      const res = await fetch(`/api/cashier/orders/${order.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve_deposit',
          cashierUid: currentCashierSession.uid,
          actorUid: currentCashierSession.uid,
          actorRole: 'cashier',
          txId: finalRef,
          referenceNumber: finalRef
        })
      })
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || 'Error al validar el depósito en el servidor')
      }

      // 3. Inyección del comprobante formal al chat
      const depositNoticeText = `✅ ¡DEPÓSITO VALIDADO CON ÉXITO!

Hola ${order.playerName}, tu recarga ha sido verificada y los fondos ya están acreditados en tu cuenta:
━━━━━━━━━━━━━━━━━━━━
💰 Monto Pagado: ${depositUSD} ${order.currency}
🪙 Crédito Acreditado: +${depositCoins} Sugar Coins (SC)
🔖 Referencia / Hash: ${finalRef}
👨‍💼 Atendido por: ${currentCashierSession.name}
━━━━━━━━━━━━━━━━━━━━
¡Gracias por jugar en Sugar Ludo! Ya puedes disfrutar de tus partidas y salas de juego.`

      await handleSendMessage(depositNoticeText)

      setOrder((prev) => (prev ? { ...prev, status: 'completed', completedAt: Date.now(), receiptReferenceNumber: finalRef } : null))
      setIsDirectValidationModalOpen(false)
      setNotification(`¡Depósito #${order.id.slice(0, 10)} validado y liberado con éxito (+${depositCoins} SC acreditados al jugador)!`)
    } catch (e: any) {
      cashierLogger.error(`Error durante la validación del depósito #${order.id.slice(0, 8)}`, {
        code: e?.code,
        message: e?.message
      })
      setNotification(`Error al validar depósito: ${e?.message || 'Fallo de conexión'}`)
    } finally {
      setIsValidating(false)
    }
  }

  const [isValidatingPayout, setIsValidatingPayout] = useState(false)

  const handleConfirmPayout = async () => {
    const finalPayoutRef = payoutTxId.trim() || `TX-PAYOUT-${Date.now().toString(36).toUpperCase()}`
    setPayoutTxId(finalPayoutRef)

    const totalFiatRequestedUSD = Number(order.amountFiat || (order.amountSugarCoins / 100))
    const isVip = Boolean((order as any).isVip || (order as any).isVipWithdraw || (order.paymentMethod as string) === 'usdt_bep20' || (order.paymentMethod as string) === 'usdt_trc20_vip')
    const feePercent = isVip ? 0.10 : 0.05
    const withdrawalFeeUSD = parseFloat((totalFiatRequestedUSD * feePercent).toFixed(2))
    const netPayoutUSD = parseFloat((totalFiatRequestedUSD - withdrawalFeeUSD).toFixed(2))
    const netPayoutCoins = Math.round(netPayoutUSD * 100)
    const feeCoins = Math.round(withdrawalFeeUSD * 100)

    // Candado crítico de seguridad: Bloquear si no hay saldo flotante suficiente
    if (cashierFloatUSDT < netPayoutUSD) {
      setNotification(`⛔ OPERACIÓN DENEGADA: Saldo insuficiente ($${cashierFloatUSDT.toFixed(2)} USDT disponibles). Se requieren $${netPayoutUSD.toFixed(2)} USDT. Solicita recarga al Administrador.`)
      setIsValidatingPayout(false)
      return
    }

    cashierLogger.action(`Iniciando Liquidación de Retiro`, {
      orderId: order.id,
      playerUid: order.playerUid,
      amountFiat: totalFiatRequestedUSD,
      netPayoutUSD,
      withdrawalFeeUSD,
      payoutTxId: finalPayoutRef
    })
    setIsValidatingPayout(true)

    // 1. LocalStorage & OrdersCache instant optimistic update
    const updatedOrder = {
      ...order,
      status: 'completed' as const,
      completedAt: Date.now(),
      receiptReferenceNumber: finalPayoutRef,
      netPayoutUSD,
      withdrawalFeeUSD,
      settledByCashierUid: currentCashierSession.uid
    }
    OrdersCache.updateOrder(updatedOrder)
    if (typeof window !== 'undefined') {
      const localOrders: CashierOrder[] = JSON.parse(localStorage.getItem('sugar_cashier_orders') || '[]')
      const updated = localOrders.map((o) => (o.id === order.id ? updatedOrder : o))
      localStorage.setItem('sugar_cashier_orders', JSON.stringify(updated))
    }

    try {
      // 2. Ejecutar liquidación atómica en el backend autoritativo (completeWithdrawalOrder en servidor)
      const res = await fetch(`/api/cashier/orders/${order.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete_withdrawal',
          cashierUid: currentCashierSession.uid,
          actorUid: currentCashierSession.uid,
          actorRole: 'cashier',
          payoutTxId: finalPayoutRef
        })
      })
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || 'Error al liquidar el retiro en el servidor')
      }

      // 2.1. Actualizar estado reactivo local del cajero
      const cashierTarget = cashierList.find(c => c.uid === currentCashierSession.uid) || currentCashierSession
      const currentCoins = (cashierTarget as any).floatBalanceCoins ?? 30000
      const currentUSDT = (cashierTarget as any).floatBalanceUSDT ?? (currentCoins / 100)
      const newCoins = Math.max(0, currentCoins - netPayoutCoins)
      const newUSDT = Math.max(0, parseFloat((currentUSDT - netPayoutUSD).toFixed(2)))

      // 2.2. Emitir evento BroadcastChannel para sincronizar otras pestañas y pantallas (0 lecturas)
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const ch = new BroadcastChannel('sugar_ludo_social_channel')
          ch.postMessage({
            type: 'cashier_float_updated',
            cashierUid: currentCashierSession.uid,
            newCoins,
            newUSDT,
            orderId: order.id
          })
          ch.close()
        }
      } catch {}

      // 3. Inyección automática del comprobante de liquidación al chat de soporte
      const payoutNoticeText = `💸 ¡${isVip ? 'RETIRO VIP' : 'RETIRO'} LIQUIDADO Y TRANSFERIDO!

Hola ${order.playerName}, hemos enviado tus fondos a tu cuenta de destino:
━━━━━━━━━━━━━━━━━━━━
💵 Monto Solicitado: $${totalFiatRequestedUSD.toFixed(2)} ${order.currency}
⚡ Modalidad: Retiro ${isVip ? 'VIP (Prioridad Máxima - Comisión 10%)' : 'Estándar (Comisión 5%)'}
🏷️ Comisión Aplicada: -$${withdrawalFeeUSD.toFixed(2)} USD (${Math.round(feePercent * 100)}%)
💰 Monto Neto Transferido: $${netPayoutUSD.toFixed(2)} ${order.currency}
🪙 Sugar Coins Liquidados: -${order.amountSugarCoins} SC
🏦 Destino: ${order.paymentMethod.toUpperCase()} (${(order as any).paymentAddress || order.receiptReferenceNumber || 'Dirección registrada'})
🔗 Hash / TxID Oficial: ${finalPayoutRef}
👨‍💼 Cajero Responsable: ${currentCashierSession.name}
━━━━━━━━━━━━━━━━━━━━
Conserva este mensaje como comprobante formal de la transacción.`

      await handleSendMessage(payoutNoticeText)
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
            <h1 className="font-black text-base text-white tracking-wide flex items-center gap-2 flex-wrap">
              <span>ORDEN #{order.id.slice(0, 8)}</span>
              {slaInfo && (
                <span
                  className={clsx(
                    'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1 shrink-0',
                    slaInfo.isVip
                      ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.25)] font-mono'
                      : 'bg-slate-800 text-slate-300 border-white/10'
                  )}
                >
                  {slaInfo.isVip && <Crown className="size-3 text-amber-400" />}
                  <span>{slaInfo.badgeLabel}</span>
                </span>
              )}
              <span
                className={clsx(
                  'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border shrink-0',
                  isCompleted
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                    : isPaid
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse'
                    : isPending
                    ? isVipOrder
                      ? 'bg-amber-500/35 text-amber-200 border-amber-500/70 shadow-[0_0_12px_rgba(245,158,11,0.35)] animate-pulse font-black'
                      : 'bg-amber-500/30 text-amber-300 border-amber-500/60 shadow-[0_0_10px_rgba(245,158,11,0.3)] animate-pulse'
                    : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                )}
              >
                {order.status === 'paid' ? 'Comprobante Subido' : order.status}
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span>Jugador: <strong className="text-white">{order.playerName}</strong></span>
              <span className="text-cyan-300 bg-cyan-500/10 border border-cyan-500/30 px-1.5 py-0.5 rounded text-[10px] font-bold">
                ID: {order.playerId || (order.playerUid ? `SL-${order.playerUid.substring(0, 6).toUpperCase()}` : 'N/A')}
              </span>
              <span>&bull; {order.currency}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons for Validation / Release & Dispute Escalation */}
        <div className="flex items-center gap-2">
          {isDeposit && !isCompleted && !isCancelled && order.status !== 'disputed' && (
            isPaid ? (
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
            )
          )}

          {!isCompleted && !isCancelled && order.status !== 'disputed' && (
            <button
              onClick={() => setIsDisputeOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
              title="Escalar esta orden a Disputa Oficial ante el Super Admin"
            >
              <ShieldAlert className="size-4 text-rose-400" />
              <span className="hidden sm:inline">Escalar a Disputa</span>
            </button>
          )}
        </div>
      </header>

      {/* Dispute Banner if order is already in dispute */}
      {order.status === 'disputed' && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div className="p-4 rounded-3xl bg-rose-950/85 border border-rose-500 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.3)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono animate-pulse">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/50">
                <ShieldAlert className="size-6 text-rose-400" />
              </div>
              <div>
                <span className="font-black text-white uppercase block text-sm">CASO EN DISPUTA Y ARBITRAJE OFICIAL</span>
                <p className="text-[11px] text-rose-200/90">
                  Motivo: <strong>{(order as any).disputeReason || 'Revisión solicitada por inconsistencia en comprobante o pago'}</strong>.
                  La orden está en revisión de la Administración.
                </p>
              </div>
            </div>
            <span className="px-3 py-1.5 rounded-xl bg-rose-500 text-slate-950 font-black text-xs uppercase tracking-wider">
              En Arbitraje
            </span>
          </div>
        </div>
      )}

      {/* SLA Countdown & Urgency Banner for Withdrawals */}
      {slaInfo && !isCompleted && (
        <div className="max-w-7xl mx-auto w-full px-6 pt-4">
          <div
            className={clsx(
              'p-4 rounded-3xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-mono transition-all',
              slaInfo.isExpired
                ? 'bg-rose-950/85 border-rose-500 text-rose-200 shadow-[0_0_30px_rgba(244,63,94,0.3)] animate-pulse font-black'
                : slaInfo.isUrgent
                ? 'bg-amber-950/85 border-amber-500 text-amber-200 shadow-[0_0_25px_rgba(245,158,11,0.25)] animate-pulse font-bold'
                : slaInfo.isVip
                ? 'bg-gradient-to-r from-amber-950/60 via-purple-950/40 to-slate-900 border-amber-500/60 text-amber-200 shadow-md'
                : 'bg-slate-900/80 border-white/10 text-slate-300'
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={clsx(
                  'p-2.5 rounded-2xl border shrink-0',
                  slaInfo.isExpired
                    ? 'bg-rose-500/20 text-rose-400 border-rose-500/50 animate-bounce'
                    : slaInfo.isVip
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                )}
              >
                {slaInfo.isExpired ? (
                  <AlertTriangle className="size-5 text-rose-400" />
                ) : slaInfo.isVip ? (
                  <Crown className="size-5 text-amber-400" />
                ) : (
                  <Clock className="size-5 text-cyan-400" />
                )}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold uppercase tracking-wider text-white text-xs">
                    {slaInfo.slaTitle}
                  </span>
                  {slaInfo.isVip && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 shadow-sm">
                      Prioridad Máxima
                    </span>
                  )}
                  {slaInfo.isExpired && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse">
                      ¡Atención Atrasada!
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 font-sans">
                  {slaInfo.isExpired
                    ? '⚠️ El plazo de atención garantizado ha vencido. Realiza la transferencia de inmediato para evitar reclamos.'
                    : slaInfo.isUrgent
                    ? '⚡ Quedan menos de 2 horas para el vencimiento del plazo. Liquida este retiro a la brevedad.'
                    : `Plazo de atención comprometido con el usuario: máximo ${slaInfo.maxHours} horas desde la solicitud.`}
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right shrink-0 pl-12 sm:pl-0">
              <span className="text-[10px] uppercase text-slate-400 block font-sans font-bold">Tiempo Restante SLA</span>
              <span className={clsx('text-base font-black font-mono tracking-tight', slaInfo.isExpired ? 'text-rose-400 text-lg' : slaInfo.isVip ? 'text-amber-300 text-lg' : 'text-white')}>
                {slaInfo.formattedTime}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-20 right-6 z-50 p-4 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300 ${
          notification.type === 'error'
            ? 'bg-rose-500 text-white shadow-rose-500/25'
            : notification.type === 'info'
            ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/25'
            : 'bg-emerald-500 text-slate-950 shadow-emerald-500/25'
        }`}>
          {notification.type === 'error' ? (
            <AlertCircle className="size-5 text-white" />
          ) : (
            <CheckCircle2 className="size-5 text-slate-950" />
          )}
          <span>{notification.message}</span>
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

            {/* Reference / Wallet Address Bar with Fast Copy */}
            {(order.receiptReferenceNumber || (order as any).paymentAddress || order.status === 'pending') && (
              <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-white/10 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    {isWithdraw ? '📍 Billetera USDT de Destino (Configurada por el Jugador)' : 'Hash / Referencia Tx'}
                  </span>
                  <span className="font-mono text-emerald-300 text-xs truncate block font-bold mt-0.5">
                    {(order as any).paymentAddress || order.receiptReferenceNumber || 'Sin dirección registrada aún'}
                  </span>
                </div>
                {((order as any).paymentAddress || order.receiptReferenceNumber) && (
                  <button
                    onClick={() => handleCopyHash((order as any).paymentAddress || order.receiptReferenceNumber!)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[11px] font-bold border border-white/10 transition-colors cursor-pointer shrink-0"
                    title={isWithdraw ? "Copiar Billetera de Destino" : "Copiar Hash"}
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
                feePercent={isVipOrder ? 10.0 : 5.0}
              />
            )}

            {/* Payout Action for Cashier on Withdrawals */}
            {isWithdraw && order.status !== 'completed' && (
              <div className="pt-2 space-y-3">
                {!hasSufficientFloat && (
                  <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-xs space-y-2 shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-in fade-in">
                    <div className="flex items-center gap-2 text-rose-400 font-black">
                      <AlertTriangle className="size-4 shrink-0 text-rose-400" />
                      <span className="uppercase tracking-wider">SALDO FLOTANTE INSUFICIENTE</span>
                    </div>
                    <p className="text-rose-200/95 text-xs leading-relaxed font-sans">
                      Tu saldo de trabajo disponible es de <strong className="text-white font-mono bg-rose-900/60 px-1.5 py-0.5 rounded border border-rose-500/30">${cashierFloatUSDT.toFixed(2)} USDT</strong> y este retiro requiere liquidar <strong className="text-rose-300 font-mono bg-rose-900/60 px-1.5 py-0.5 rounded border border-rose-500/30">${netPayoutUSD.toFixed(2)} USDT</strong>.
                      No cuentas con saldo suficiente para pagar este retiro. Debes solicitar recarga al Administrador.
                    </p>
                  </div>
                )}

                <button
                  disabled={!hasSufficientFloat}
                  onClick={() => {
                    if (!hasSufficientFloat) return
                    cashierLogger.click(`Botón Transferir Dinero y Liquidar Retiro (Abrir modal)`)
                    setIsPayoutModalOpen(true)
                  }}
                  className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                    !hasSufficientFloat
                      ? 'bg-slate-800/90 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed shadow-none'
                      : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 shadow-[0_0_25px_rgba(236,72,153,0.35)] cursor-pointer'
                  }`}
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
              {(() => {
                const isModalVip = Boolean((order as any).isVip || (order as any).isVipWithdraw || (order.paymentMethod as string) === 'usdt_bep20' || (order.paymentMethod as string) === 'usdt_trc20_vip')
                const modalFeePercent = isModalVip ? 0.10 : 0.05
                const modalRequestedFiat = Number(order.amountFiat || (order.amountSugarCoins / 100))
                const modalFeeFiat = parseFloat((modalRequestedFiat * modalFeePercent).toFixed(2))
                const modalNetPayoutFiat = parseFloat((modalRequestedFiat - modalFeeFiat).toFixed(2))

                return (
                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 space-y-1.5 font-mono">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Monto Solicitado:</span>
                      <strong className="text-white font-mono">${modalRequestedFiat.toFixed(2)} {order.currency}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Comisión {isModalVip ? 'VIP (10%)' : 'Estándar (5%)'}:</span>
                      <strong className="text-rose-400 font-mono">-${modalFeeFiat.toFixed(2)} {order.currency}</strong>
                    </div>
                    <div className="border-t border-white/10 pt-1.5 flex justify-between items-center text-xs">
                      <span className="text-white font-bold">Monto Neto a Transferir:</span>
                      <strong className="text-pink-300 font-black text-sm font-mono">${modalNetPayoutFiat.toFixed(2)} {order.currency}</strong>
                    </div>
                    <div className="border-t border-white/5 pt-1.5 flex justify-between text-slate-400 text-[10px]">
                      <span>Jugador Destino:</span>
                      <strong className="text-white">{order.playerName}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>Método de Pago:</span>
                      <strong className="text-cyan-300 uppercase">{order.paymentMethod}</strong>
                    </div>
                    <div className="border-t border-white/10 pt-1.5 flex justify-between items-center text-slate-400 text-[10px]">
                      <span>Billetera / Cuenta:</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <strong className="text-emerald-300 font-mono text-[11px] truncate max-w-[170px]">
                          {(order as any).paymentAddress || order.receiptReferenceNumber || 'No especificada'}
                        </strong>
                        {((order as any).paymentAddress || order.receiptReferenceNumber) && (
                          <button
                            type="button"
                            onClick={() => handleCopyHash((order as any).paymentAddress || order.receiptReferenceNumber!)}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-cyan-300 text-[9px] font-bold cursor-pointer transition-colors shrink-0"
                            title="Copiar Billetera"
                          >
                            Copiar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Alerta roja de Saldo Insuficiente en Modal */}
              {!hasSufficientFloat && (
                <div className="p-3.5 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs space-y-1.5 shadow-lg animate-in fade-in">
                  <div className="flex items-center gap-2 font-black text-rose-400">
                    <AlertCircle className="size-4 shrink-0 text-rose-400" />
                    <span className="uppercase tracking-wider">SALDO FLOTANTE INSUFICIENTE</span>
                  </div>
                  <p className="text-[11px] text-rose-200 leading-snug">
                    Tu saldo de trabajo disponible es de <strong className="text-white font-mono">${cashierFloatUSDT.toFixed(2)} USDT</strong>. Se requieren <strong className="text-rose-300 font-mono">${netPayoutUSD.toFixed(2)} USDT</strong> para pagar este retiro. No puedes procesar esta orden. Solicita recarga al Administrador.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block text-[10px] uppercase">
                  Número de Referencia Bancaria / TxID Cripto (Obligatorio) *
                </label>
                <input
                  type="text"
                  required
                  disabled={!hasSufficientFloat}
                  value={payoutTxId}
                  onChange={(e) => setPayoutTxId(e.target.value)}
                  placeholder={hasSufficientFloat ? "Ej. 0x8f9c2a... o REF-9928172" : "Bloqueado por saldo insuficiente"}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none ${
                    !hasSufficientFloat 
                      ? 'border-rose-500/30 opacity-50 cursor-not-allowed text-slate-500' 
                      : 'border-white/10 focus:border-pink-400'
                  }`}
                />
                <p className="text-[10px] text-slate-400">
                  Ingresa el Hash de la transacción o número de comprobante emitido tras realizar la transferencia.
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
                  if (!hasSufficientFloat) {
                    setNotification(`⛔ Saldo insuficiente ($${cashierFloatUSDT.toFixed(2)} USDT). Se requieren $${netPayoutUSD.toFixed(2)} USDT.`)
                    return
                  }
                  if (!payoutTxId.trim()) return
                  cashierLogger.click(`Clic en botón Confirmar Pago Retiro`, {
                    payoutTxId: payoutTxId.trim()
                  })
                  handleConfirmPayout()
                }}
                disabled={!hasSufficientFloat || !payoutTxId.trim() || isValidatingPayout}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                  !hasSufficientFloat || !payoutTxId.trim()
                    ? 'bg-slate-800 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 shadow-[0_0_15px_rgba(236,72,153,0.3)] cursor-pointer'
                }`}
              >
                {isValidatingPayout ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Procesando liquidación...</span>
                  </>
                ) : (
                  <span>Confirmar Pago y Notificar</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Escalate to Dispute Modal */}
      {isDisputeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/50 rounded-3xl p-6 space-y-4 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/40">
                <ShieldAlert className="size-6 text-rose-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Escalar Orden a Disputa Oficial</h3>
                <p className="text-xs text-slate-400 font-mono">Remitir caso al Super Admin para arbitraje</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Motivo de la Disputa:</label>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {['Comprobante inconsistente', 'TxID no verificado', 'Datos de billetera erróneos', 'Sospecha de duplicidad'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDisputeReason(preset)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono transition-all border border-white/5 cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe detalladamente la irregularidad o inconsistencia detectada..."
                rows={3}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-200/90 leading-relaxed font-mono">
              ⚠️ Al escalar, la orden pasará a estado <strong>DISPUTED</strong> y quedará congelada en custodia hasta que el Super Admin dicte la resolución final.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDisputeOpen(false)
                  setDisputeReason('')
                }}
                disabled={isEscalating}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleEscalateToDispute}
                disabled={!disputeReason.trim() || isEscalating}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.4)] flex items-center justify-center gap-1.5"
              >
                {isEscalating ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Escalando...</span>
                  </>
                ) : (
                  <span>Confirmar y Escalar</span>
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
