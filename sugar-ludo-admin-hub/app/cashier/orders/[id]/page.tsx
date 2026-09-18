'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { MOCK_ORDERS, MOCK_CHAT_MESSAGES } from '../../../../lib/mock-data'
import { CashierOrder, OrderChatMessage } from '../../../../types/cashier'
import { WithdrawalAuditInspectorCard } from '../../../../components/cashier/WithdrawalAuditInspectorCard'
import { CashierLogPanel } from '../../../../components/cashier/CashierLogPanel'
import { cashierLogger } from '../../../../lib/cashier-logger'
import { db } from '../../../../lib/firebase'
import { doc, onSnapshot, getDoc, updateDoc, setDoc } from 'firebase/firestore'
import { ArrowLeft, Wallet, Check, Copy, Crown, Clock } from 'lucide-react'
import { clsx } from 'clsx'
import { OrdersCache } from '../../../../lib/orders-cache'
import { useAdminAuth } from '../../../../lib/admin-auth-context'
import { getWithdrawalSla } from '../../../../lib/sla-calculator'
import { getStaffAuthHeaders } from '@/lib/auth-headers'

import { OrderHeaderTimer } from './components/OrderHeaderTimer'
import { OrderReceiptViewer } from './components/OrderReceiptViewer'
import { OrderChatStream } from './components/OrderChatStream'
import { OrderActionButtons, PayoutActionButton } from './components/OrderActionButtons'

function deduplicateOrderMessages(messages: OrderChatMessage[], orderId: string): OrderChatMessage[] {
  if (!Array.isArray(messages)) return []
  const clean: OrderChatMessage[] = []
  const seenSignatures = new Set<string>()

  for (const msg of messages) {
    if (!msg) continue
    const text = (msg.message || '').trim()
    const role = msg.senderRole || 'cashier'

    // Si es un comprobante formal o aviso oficial del sistema
    const isOfficialNotice =
      text.includes('VALIDADO CON ÉXITO') ||
      text.includes('LIQUIDADO Y TRANSFERIDO') ||
      text.includes('━━━━━━━━━━━━━━━━━━━━')

    if (isOfficialNotice) {
      // Clave única por orden, rol y cuerpo del comprobante
      const noticeKey = `${msg.orderId || orderId}_${role}_${text}`
      if (seenSignatures.has(noticeKey)) {
        continue // Filtrar comprobante duplicado/triplicado
      }
      seenSignatures.add(noticeKey)
    } else {
      // Para mensajes de chat comunes, filtrar si es idéntico al anterior inmediato dentro de 15 segundos o mismo ID
      const last = clean[clean.length - 1]
      if (
        last &&
        last.message?.trim() === text &&
        last.senderRole === role &&
        Math.abs((msg.timestamp || 0) - (last.timestamp || 0)) < 15000
      ) {
        continue
      }
    }
    clean.push(msg)
  }
  return clean
}

export default function OrderDetailPage() {
  const router = useRouter()
  const routeParams = useParams()
  const orderId = (routeParams?.id as string) || ''
  const { cashierList, updateCashierFloat } = useAdminAuth()

  const [liveCashierProfile, setLiveCashierProfile] = useState<{ floatBalanceCoins: number; floatBalanceUSDT: number } | null>(null)

  const [currentCashierSession, setCurrentCashierSession] = useState<{ uid: string; name: string; email?: string; floatBalanceCoins?: number; floatBalanceUSDT?: number }>(() => {
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
            setCurrentCashierSession((prev) => ({
              ...(live || parsed),
              floatBalanceCoins: prev?.floatBalanceCoins || (live || parsed)?.floatBalanceCoins || 0,
              floatBalanceUSDT: prev?.floatBalanceUSDT !== undefined ? prev.floatBalanceUSDT : (live || parsed)?.floatBalanceUSDT
            }))
          }
        } else if (cashierList.length > 0) {
          setCurrentCashierSession((prev) => ({
            ...cashierList[0],
            floatBalanceCoins: prev?.floatBalanceCoins || cashierList[0]?.floatBalanceCoins || 0,
            floatBalanceUSDT: prev?.floatBalanceUSDT !== undefined ? prev.floatBalanceUSDT : (cashierList[0] as unknown as { floatBalanceUSDT?: number })?.floatBalanceUSDT
          }))
        }
      } catch {}
    }
  }, [cashierList])

  // Escuchar saldo flotante real de trabajo desde Firestore (cashier_profiles/{uid})
  useEffect(() => {
    if (!currentCashierSession?.uid) return
    cashierLogger.firestore(`Iniciando listener de saldo flotante en cashier_profiles/${currentCashierSession.uid}`)

    const profileDocRef = doc(db, 'cashier_profiles', currentCashierSession.uid)
    const unsub = onSnapshot(
      profileDocRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data()
          const coins = Number(data.floatBalanceCoins ?? Math.round(Number(data.floatBalanceUSDT || 0) * 100))
          const usdt = Number(data.floatBalanceUSDT ?? (coins / 100))

          setLiveCashierProfile({
            floatBalanceCoins: coins,
            floatBalanceUSDT: usdt
          })
          setCurrentCashierSession((prev) => ({
            ...(prev || {}),
            floatBalanceCoins: coins,
            floatBalanceUSDT: usdt
          }))
          cashierLogger.firestore(`Saldo de perfil actualizado en vivo: $${usdt.toFixed(2)} USDT (${coins} SC)`)
        }
      },
      (err) => {
        cashierLogger.error(`Error en listener de cashier_profiles: ${err?.message}`)
      }
    )

    return () => {
      unsub()
    }
  }, [currentCashierSession?.uid])

  const [order, setOrder] = useState<CashierOrder | null>(() => {
    const cached = OrdersCache.get()?.find((o) => o.id === orderId)
    if (cached) return cached
    const found = MOCK_ORDERS.find((o) => o.id === orderId)
    if (found) return found
    return null
  })

  const [messages, setMessages] = useState<OrderChatMessage[]>(() => {
    return MOCK_CHAT_MESSAGES[orderId] || []
  })

  const [notification, setNotification] = useState<string | null>(null)
  const [copiedHash, setCopiedHash] = useState(false)
  const [isReceiptOpen, setIsReceiptOpen] = useState(false)
  const [activeReceiptUrl, setActiveReceiptUrl] = useState('')
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false)
  const [isDisputeOpen, setIsDisputeOpen] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isValidatingPayout, setIsValidatingPayout] = useState(false)
  const [isEscalating, setIsEscalating] = useState(false)

  // Sincronización en tiempo real de la orden desde Firestore
  useEffect(() => {
    if (!orderId) return

    let unsub: (() => void) | null = null
    const startListener = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (unsub) return

      try {
        const orderDocRef = doc(db, 'cashier_orders', orderId)
        unsub = onSnapshot(
          orderDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const liveData = { id: docSnap.id, ...docSnap.data() } as CashierOrder
              setOrder(liveData)
              OrdersCache.updateOrder(liveData)

              if (Array.isArray(docSnap.data()?.supportMessages)) {
                setMessages(docSnap.data().supportMessages)
              }
            }
          },
          (err) => {
            cashierLogger.error(`Error en onSnapshot de orden ${orderId}: ${err?.message}`)
          }
        )
      } catch {}
    }

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && document.hidden) {
        if (unsub) {
          unsub()
          unsub = null
        }
      } else {
        startListener()
      }
    }

    startListener()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility)
    }

    return () => {
      if (unsub) unsub()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
    }
  }, [orderId])

  const [mounted, setMounted] = useState(false)
  const [, setTick] = useState(0)

  useEffect(() => {
    setMounted(true)
    const timer = setInterval(() => setTick((t) => t + 1), 30000)
    return () => clearInterval(timer)
  }, [])

  if (!order || !mounted) {
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
  const isTerminated = isCompleted || isCancelled
  const isWithdraw = order.type === 'withdraw'

  const cashierFloatUSDT = liveCashierProfile?.floatBalanceUSDT
    ?? Number(currentCashierSession.floatBalanceUSDT
    ?? (cashierList.find(c => c.uid === currentCashierSession.uid)?.floatBalanceUSDT
    ?? ((currentCashierSession.floatBalanceCoins || 0) / 100)))

  const cashierFloatCoins = liveCashierProfile?.floatBalanceCoins
    ?? Number(currentCashierSession.floatBalanceCoins
    ?? Math.round(cashierFloatUSDT * 100))

  const slaInfo = getWithdrawalSla(order)
  const totalFiatRequestedUSD = Number(order.amountFiat || (Number(order.amountSugarCoins || 0) / 100))
  const isVipOrder = Boolean(slaInfo?.isVip || order.isVip || order.isVipWithdraw || (order.paymentMethod as string) === 'usdt_bep20' || (order.paymentMethod as string) === 'usdt_trc20_vip')
  const withdrawalFeePercent = isVipOrder ? 0.10 : 0.05
  const withdrawalFeeUSD = parseFloat((totalFiatRequestedUSD * withdrawalFeePercent).toFixed(2))
  const netPayoutUSD = parseFloat((totalFiatRequestedUSD - withdrawalFeeUSD).toFixed(2))
  const hasSufficientFloat = cashierFloatUSDT >= netPayoutUSD

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

    try {
      const orderDocRef = doc(db, 'cashier_orders', order.id)
      const orderSnap = await getDoc(orderDocRef)
      const snapData = orderSnap.exists() ? (orderSnap.data() as Record<string, unknown>) : null
      const existingMsgs: unknown[] = (snapData && Array.isArray(snapData.supportMessages))
        ? (snapData.supportMessages as unknown[])
        : []

      const cleanMsg: Record<string, unknown> = {
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

      if (!orderSnap.exists()) {
        await setDoc(orderDocRef, {
          ...order,
          supportMessages: [cleanMsg],
          lastMessage: text.trim(),
          lastMessageTime: Date.now(),
          hasUnreadCashierMessage: true
        }, { merge: true })
      } else {
        await updateDoc(orderDocRef, {
          supportMessages: [...existingMsgs, cleanMsg],
          lastMessage: text.trim(),
          lastMessageTime: Date.now(),
          hasUnreadCashierMessage: true
        })
      }
    } catch (fsErr: unknown) {
      const errMsg = fsErr instanceof Error ? fsErr.message : String(fsErr)
      cashierLogger.error(`Error guardando mensaje en cashier_orders/${order.id}`, { message: errMsg })
    }

    try {
      fetch(`/api/cashier/orders/${order.id}/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getStaffAuthHeaders('cashier')
        },
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

    setIsValidating(true)
    const updatedOrder: CashierOrder = {
      ...order,
      status: 'completed',
      completedAt: Date.now(),
      receiptReferenceNumber: finalRef
    }
    OrdersCache.updateOrder(updatedOrder)

    try {
      const res = await fetch(`/api/cashier/orders/${order.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getStaffAuthHeaders('cashier')
        },
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
      setNotification(`¡Depósito #${order.id.slice(0, 10)} validado y liberado con éxito (+${depositCoins} SC acreditados al jugador)!`)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Fallo de conexión'
      setNotification(`Error al validar depósito: ${msg}`)
    } finally {
      setIsValidating(false)
    }
  }

  const handleConfirmPayout = async (payoutTxIdParam: string) => {
    const finalPayoutRef = payoutTxIdParam.trim() || `TX-PAYOUT-${Date.now().toString(36).toUpperCase()}`

    if (cashierFloatUSDT < netPayoutUSD) {
      setNotification(`⛔ OPERACIÓN DENEGADA: Saldo insuficiente ($${cashierFloatUSDT.toFixed(2)} USDT disponibles). Se requieren $${netPayoutUSD.toFixed(2)} USDT.`)
      return
    }

    setIsValidatingPayout(true)
    const updatedOrder: CashierOrder = {
      ...order,
      status: 'completed',
      completedAt: Date.now(),
      receiptReferenceNumber: finalPayoutRef,
      netPayoutUSD,
      withdrawalFeeUSD
    }
    OrdersCache.updateOrder(updatedOrder)

    try {
      const res = await fetch(`/api/cashier/orders/${order.id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getStaffAuthHeaders('cashier')
        },
        body: JSON.stringify({
          action: 'complete_withdrawal',
          cashierUid: currentCashierSession.uid,
          actorUid: currentCashierSession.uid,
          actorRole: 'cashier',
          cashierName: currentCashierSession.name || 'Cajero Oficial',
          payoutTxId: finalPayoutRef
        })
      })
      const result = await res.json()
      if (!result.success) {
        throw new Error(result.error || 'Error al liquidar el retiro en el servidor')
      }

      setOrder((prev) => (prev ? { ...prev, status: 'completed', completedAt: Date.now(), receiptReferenceNumber: finalPayoutRef } : null))
      setNotification(`¡Retiro #${order.id.slice(0, 10)} completado y liquidado con TxID: ${finalPayoutRef}!`)
      setTimeout(() => setNotification(null), 4000)

      const newUSDT = Math.max(0, parseFloat((cashierFloatUSDT - netPayoutUSD).toFixed(2)))
      const newCoins = Math.round(newUSDT * 100)

      setLiveCashierProfile({ floatBalanceCoins: newCoins, floatBalanceUSDT: newUSDT })
      setCurrentCashierSession((prev) => ({ ...(prev || {}), floatBalanceCoins: newCoins, floatBalanceUSDT: newUSDT }))

      try {
        await updateCashierFloat(currentCashierSession.uid, newCoins, newUSDT, netPayoutUSD)
      } catch {}

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

      const destAddress = (order as unknown as { paymentAddress?: string }).paymentAddress || order.receiptReferenceNumber || (typeof order.playerPaymentAccount === 'string' ? order.playerPaymentAccount : order.playerPaymentAccount?.accountNumber) || 'Dirección registrada'

      const payoutNoticeText = `💸 ¡${isVipOrder ? 'RETIRO VIP' : 'RETIRO'} LIQUIDADO Y TRANSFERIDO!

Hola ${order.playerName}, hemos enviado tus fondos a tu cuenta de destino:
━━━━━━━━━━━━━━━━━━━━
💵 Monto Solicitado: $${totalFiatRequestedUSD.toFixed(2)} ${order.currency}
⚡ Modalidad: Retiro ${isVipOrder ? 'VIP (Prioridad Máxima - Comisión 10%)' : 'Estándar (Comisión 5%)'}
🏷️ Comisión Aplicada: -$${withdrawalFeeUSD.toFixed(2)} USD (${Math.round(withdrawalFeePercent * 100)}%)
💰 Monto Neto Transferido: $${netPayoutUSD.toFixed(2)} ${order.currency}
🪙 Sugar Coins Liquidados: -${order.amountSugarCoins} SC
🏦 Destino: ${order.paymentMethod.toUpperCase()} (${destAddress})
🔗 Hash / TxID Oficial: ${finalPayoutRef}
👨‍💼 Cajero Responsable: ${currentCashierSession.name}
━━━━━━━━━━━━━━━━━━━━
Conserva este mensaje como comprobante formal de la transacción.`

      await handleSendMessage(payoutNoticeText)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'No se pudo liquidar la orden'
      setNotification(`⛔ ERROR: ${msg}`)
      OrdersCache.updateOrder(order)
      setOrder(order)
    } finally {
      setIsValidatingPayout(false)
    }
  }

  const handleEscalateToDispute = async (reason: string) => {
    if (!order || !reason.trim()) return
    setIsEscalating(true)
    const now = Date.now()

    try {
      const orderRef = doc(db, 'cashier_orders', order.id)
      await updateDoc(orderRef, {
        status: 'disputed',
        disputeReason: reason,
        disputedAt: now,
        disputedBy: currentCashierSession?.name || 'Cajero'
      })

      const disputeRef = doc(db, 'dispute_cases', order.id)
      await setDoc(disputeRef, {
        id: order.id,
        orderId: order.id,
        orderType: order.type,
        playerUid: order.playerUid || 'usr_player',
        playerName: order.playerName || 'Jugador Sugar',
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

      await handleSendMessage(`⚠️ [ORDEN ESCALADA A DISPUTA]: ${reason}. El caso ha sido remitido al Super Admin para arbitraje final.`)
      setOrder((prev) => (prev ? { ...prev, status: 'disputed' } : null))
      setNotification('¡Orden escalada a Disputa oficial ante la Administración!')
      setTimeout(() => setNotification(null), 4000)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error al escalar'
      setNotification(`Error al escalar: ${msg}`)
    } finally {
      setIsEscalating(false)
    }
  }

  const handleCopyHash = (text: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text)
      setCopiedHash(true)
      setTimeout(() => setCopiedHash(false), 2000)
    }
  }

  const displayMessages = deduplicateOrderMessages(messages, orderId)
  const walletTargetAddress = (order as unknown as { paymentAddress?: string }).paymentAddress || order.receiptReferenceNumber || (typeof order.playerPaymentAccount === 'string' ? order.playerPaymentAccount : order.playerPaymentAccount?.accountNumber) || ''

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
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : isPaid
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 animate-pulse'
                    : order.status === 'disputed'
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/50'
                    : isCancelled
                    ? 'bg-slate-800 text-slate-400 border-white/10'
                    : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
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

        {/* Subcomponente 4A: Botones de Acción en Navbar */}
        <OrderActionButtons
          order={order}
          isDeposit={isDeposit}
          isWithdraw={isWithdraw}
          isPaid={isPaid}
          isCompleted={isCompleted}
          isCancelled={isCancelled}
          cashierFloatUSDT={cashierFloatUSDT}
          netPayoutUSD={netPayoutUSD}
          hasSufficientFloat={hasSufficientFloat}
          isValidating={isValidating}
          isValidatingPayout={isValidatingPayout}
          isEscalating={isEscalating}
          isPayoutModalOpen={isPayoutModalOpen}
          setIsPayoutModalOpen={setIsPayoutModalOpen}
          isDisputeOpen={isDisputeOpen}
          setIsDisputeOpen={setIsDisputeOpen}
          onApprove={handleApprove}
          onConfirmPayout={handleConfirmPayout}
          onEscalateToDispute={handleEscalateToDispute}
          onCopyHash={handleCopyHash}
          onNotify={(msg) => {
            setNotification(msg)
            setTimeout(() => setNotification(null), 4000)
          }}
        />
      </header>

      {/* Subcomponente 1: SLA Countdown, Banners de Urgencia y Disputa */}
      <OrderHeaderTimer
        slaInfo={slaInfo}
        isTerminated={isTerminated}
        orderStatus={order.status}
        disputeReason={(order as unknown as { disputeReason?: string }).disputeReason}
        notification={notification}
      />

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
            {(order.receiptReferenceNumber || walletTargetAddress || order.status === 'pending') && (
              <div className="p-3.5 bg-slate-950/80 rounded-2xl border border-white/10 flex items-center justify-between gap-2 text-xs">
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">
                    {isWithdraw ? '📍 Billetera USDT de Destino (Configurada por el Jugador)' : 'Hash / Referencia Tx'}
                  </span>
                  <span className="font-mono text-emerald-300 text-xs truncate block font-bold mt-0.5">
                    {walletTargetAddress || 'Sin dirección registrada aún'}
                  </span>
                </div>
                {walletTargetAddress && (
                  <button
                    type="button"
                    onClick={() => handleCopyHash(walletTargetAddress)}
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

            {/* Subcomponente 4B: Payout Action for Cashier on Withdrawals */}
            <PayoutActionButton
              isWithdraw={isWithdraw}
              isCompleted={isCompleted}
              hasSufficientFloat={hasSufficientFloat}
              cashierFloatUSDT={cashierFloatUSDT}
              netPayoutUSD={netPayoutUSD}
              onOpenPayout={() => setIsPayoutModalOpen(true)}
            />

            {/* Subcomponente 2: Receipt Preview Thumbnail & HD Modal Viewer */}
            <OrderReceiptViewer
              receiptUrl={order.receiptUrl}
              receiptReferenceNumber={order.receiptReferenceNumber}
              paymentMethod={order.paymentMethod}
              amountFiat={order.amountFiat}
              currency={order.currency}
              isOpen={isReceiptOpen}
              activeReceiptUrl={activeReceiptUrl}
              onOpenModal={(url) => {
                setActiveReceiptUrl(url)
                setIsReceiptOpen(true)
              }}
              onCloseModal={() => setIsReceiptOpen(false)}
            />
          </div>
        </div>

        {/* Subcomponente 3: Right Column Live Order Chat */}
        <OrderChatStream
          orderId={order.id}
          orderStatus={order.status}
          messages={displayMessages}
          playerReadAt={order.playerReadAt}
          currentUserUid={currentCashierSession.uid}
          currentUserName={currentCashierSession.name}
          onSendMessage={handleSendMessage}
          onViewImage={(url) => {
            setActiveReceiptUrl(url)
            setIsReceiptOpen(true)
          }}
          onOpenDisputeModal={() => setIsDisputeOpen(true)}
        />
      </main>

      {/* Auditoría en Vivo y Consola de Diagnóstico */}
      <CashierLogPanel />
    </div>
  )
}
