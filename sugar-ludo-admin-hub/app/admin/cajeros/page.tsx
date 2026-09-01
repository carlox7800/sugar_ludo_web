'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '../../../lib/admin-auth-context'
import { StaffChatMessage, ProcessedWithdrawalAudit, CashierManagementProfile } from '../../../types/admin-expanded'
import { MOCK_WITHDRAWAL_AUDITS } from '../../../lib/mock-admin-expanded'
import {
  subscribeToBroadcastMessages,
  sendBroadcastMessage,
  subscribeToCashierPrivateMessages,
  sendPrivateMessage,
  subscribeToAllPrivateChatsMeta,
  markPrivateChatAsReadByAdmin,
  PrivateChatMeta
} from '../../../lib/staff-chat-service'
import { FloatRechargeModal } from '../../../components/admin/FloatRechargeModal'
import { CashierPdfReportModal } from '../../../components/admin/CashierPdfReportModal'
import { CashierDualChatPanel } from '../../../components/admin/CashierDualChatPanel'
import { RegisterCashierModal } from '../../../components/admin/RegisterCashierModal'
import { EditCashierModal } from '../../../components/admin/EditCashierModal'
import { db } from '../../../lib/firebase'
import { doc, setDoc, increment, collection, query, where, onSnapshot, limit } from 'firebase/firestore'
import {
  ArrowLeft,
  Users,
  Wallet,
  Plus,
  ShieldCheck,
  CheckCircle2,
  FileText,
  ExternalLink,
  MessageSquare,
  Printer,
  LogOut,
  UserPlus,
  UserCog,
  SlidersHorizontal
} from 'lucide-react'
import { clsx } from 'clsx'

export default function AdminCajerosManagementPage() {
  const router = useRouter()
  const {
    adminUser,
    isAuthenticated,
    isLoading,
    logout,
    cashierList,
    updateCashierFloat,
    createNewCashier,
    updateCashierProfile
  } = useAdminAuth()

  // Ergonomic View Switcher: 'monitoring' | 'communications'
  const [activeView, setActiveView] = useState<'monitoring' | 'communications'>('monitoring')
  const [communicationsInitialMode, setCommunicationsInitialMode] = useState<'broadcast' | 'private'>('broadcast')

  // Estados de Chat Staff en Tiempo Real
  const [broadcastMessages, setBroadcastMessages] = useState<StaffChatMessage[]>([])
  const [privateMessages, setPrivateMessages] = useState<StaffChatMessage[]>([])
  const [chatMetas, setChatMetas] = useState<Record<string, PrivateChatMeta>>({})
  const [selectedChatCashierUid, setSelectedChatCashierUid] = useState<string>(cashierList[0]?.uid || '')

  const [withdrawalAudits, setWithdrawalAudits] = useState<ProcessedWithdrawalAudit[]>(MOCK_WITHDRAWAL_AUDITS)
  
  // Modals state
  const [isRegisterCashierModalOpen, setIsRegisterCashierModalOpen] = useState(false)
  const [selectedCashierForEdit, setSelectedCashierForEdit] = useState<CashierManagementProfile | null>(null)
  const [selectedCashierForRecharge, setSelectedCashierForRecharge] = useState<any | null>(null)
  const [selectedCashierForPdf, setSelectedCashierForPdf] = useState<any | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !adminUser)) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, adminUser, router])

  // Escuchar órdenes de retiro completadas en tiempo real para auditoría
  useEffect(() => {
    try {
      const q = query(
        collection(db, 'cashier_orders'),
        where('type', '==', 'withdraw'),
        where('status', '==', 'completed'),
        limit(50)
      )
      const unsub = onSnapshot(q, (snap) => {
        if (!snap.empty) {
          const liveAudits: ProcessedWithdrawalAudit[] = snap.docs.map((docSnap) => {
            const data = docSnap.data()
            const amountFiat = Number(data.amountFiat || 0)
            const feePercent = data.isVip ? 10 : 5
            const amountSugarCoins = Number(data.amountSugarCoins || (amountFiat * 100))
            const feeCoins = Number(data.feeCoins || (amountSugarCoins * (feePercent / 100)))
            const netFiatUSDT = Number(data.netFiat || (amountFiat * (1 - feePercent / 100)))

            return {
              id: docSnap.id,
              orderId: docSnap.id,
              cashierUid: data.cashierUid || 'csh_001',
              cashierName: data.cashierName || 'Cajero Oficial',
              playerUid: data.userId || 'usr_player',
              playerName: data.userName || 'Jugador Sugar',
              amountSugarCoins,
              amountFiatUSDT: amountFiat,
              feePercent,
              feeCoins,
              netFiatUSDT,
              walletTxHash: data.txHash || data.paymentProof || `TXID-${docSnap.id.slice(0, 8).toUpperCase()}`,
              receiptProofUrl: data.receiptUrl,
              processedAt: Number(data.completedAt || data.updatedAt || Date.now())
            }
          })
          setWithdrawalAudits(liveAudits)
        }
      })
      return () => unsub()
    } catch {}
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  if (isLoading || !isAuthenticated || !adminUser) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-cyan-400 font-mono text-xs">
        Cargando módulo de cajeros...
      </div>
    )
  }

  const handleRecharge = async (cashierUid: string, amountUSDT: number, notes: string) => {
    const target = cashierList.find((c) => c.uid === cashierUid)
    const amountCoins = Math.round(amountUSDT * 100)
    let newUSDT = amountUSDT
    let newCoins = amountCoins

    if (target) {
      const currentUSDT = (target as any).floatBalanceUSDT ?? (target.floatBalanceCoins / 100)
      newUSDT = currentUSDT + amountUSDT
      newCoins = Math.round(newUSDT * 100)
      updateCashierFloat(cashierUid, newCoins, newUSDT)
    }

    // 1. Sincronizar en global_ledger en Firestore
    try {
      const ledgerRef = doc(db, 'system_treasury', 'global_ledger')
      await setDoc(ledgerRef, {
        id: 'global_ledger',
        cashierFloatsUSD: increment(amountUSDT),
        cashierFloatsCoins: increment(amountCoins),
        lastAuditedAt: Date.now()
      }, { merge: true })
    } catch {}

    // 2. Registrar movimiento en cashier_shifts_ledger
    try {
      const shiftRef = doc(collection(db, 'cashier_shifts_ledger'))
      await setDoc(shiftRef, {
        id: shiftRef.id,
        cashierUid,
        cashierName: target?.name || cashierUid,
        type: 'recharge_float',
        amountFiatUSD: amountUSDT,
        amountCoins,
        resultingBalanceUSDT: newUSDT,
        resultingBalanceCoins: newCoins,
        referenceNumber: `REC-${Date.now().toString(36).toUpperCase()}`,
        adminUid: adminUser?.uid || 'adm_super',
        adminName: adminUser?.displayName || 'Super Admin',
        timestamp: Date.now(),
        createdAt: Date.now(),
        notes: notes || 'Recarga de Saldo Flotante'
      })
    } catch {}

    // Sincronizar en Firestore de forma atómica en el backend
    try {
      await fetch('/api/cashier/orders/recharge/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'recharge_float',
          cashierUid,
          amountUSDT,
          notes,
          adminUid: adminUser?.uid || 'adm_super_001',
          adminName: adminUser?.displayName || 'Super Admin'
        })
      })
    } catch (e) {
      console.warn('[AdminCajeros] Fallback local para recarga de flotante:', e)
    }

    // Notificar en canal de difusión oficial
    if (adminUser) {
      sendBroadcastMessage(
        adminUser.uid,
        adminUser.displayName,
        `💰 Asignación de saldo flotante aprobada: +$${amountUSDT.toFixed(2)} USDT (+${amountCoins.toLocaleString()} SC) asignados a ${target?.name || cashierUid}. Motivo: ${notes}`
      ).catch(() => {})
    }
    setNotification(`¡Asignados +$${amountUSDT.toFixed(2)} USDT (+${amountCoins.toLocaleString()} SC) con éxito!`)
    setTimeout(() => setNotification(null), 4000)
  }

  useEffect(() => {
    if (!selectedChatCashierUid && cashierList.length > 0) {
      setSelectedChatCashierUid(cashierList[0].uid)
    }
  }, [cashierList, selectedChatCashierUid])

  // Escuchar difusión masiva y metadatos de chats privados
  useEffect(() => {
    const unsubBroadcast = subscribeToBroadcastMessages(setBroadcastMessages)
    const unsubMetas = subscribeToAllPrivateChatsMeta(setChatMetas)
    return () => {
      unsubBroadcast()
      unsubMetas()
    }
  }, [])

  // Escuchar chat privado del cajero seleccionado y marcar como leído
  useEffect(() => {
    if (!selectedChatCashierUid) return

    if (activeView === 'communications') {
      markPrivateChatAsReadByAdmin(selectedChatCashierUid)
      setChatMetas((prev) => {
        if (!prev[selectedChatCashierUid] || prev[selectedChatCashierUid].unreadByAdmin === 0) return prev
        return {
          ...prev,
          [selectedChatCashierUid]: {
            ...prev[selectedChatCashierUid],
            unreadByAdmin: 0
          }
        }
      })
    }

    const unsubPrivate = subscribeToCashierPrivateMessages(selectedChatCashierUid, (msgs) => {
      setPrivateMessages(msgs)
      if (activeView === 'communications') {
        markPrivateChatAsReadByAdmin(selectedChatCashierUid)
        setChatMetas((prev) => {
          if (!prev[selectedChatCashierUid] || prev[selectedChatCashierUid].unreadByAdmin === 0) return prev
          return {
            ...prev,
            [selectedChatCashierUid]: {
              ...prev[selectedChatCashierUid],
              unreadByAdmin: 0
            }
          }
        })
      }
    })
    return () => unsubPrivate()
  }, [selectedChatCashierUid, activeView])

  const handleSelectCashier = (uid: string) => {
    setSelectedChatCashierUid(uid)
    markPrivateChatAsReadByAdmin(uid)
    setChatMetas((prev) => {
      if (!prev[uid] || prev[uid].unreadByAdmin === 0) return prev
      return {
        ...prev,
        [uid]: {
          ...prev[uid],
          unreadByAdmin: 0
        }
      }
    })
  }

  const totalUnreadByAdmin = Object.values(chatMetas).reduce((acc, m) => acc + (m.unreadByAdmin || 0), 0)
  const unreadByCashierMap = Object.fromEntries(
    Object.entries(chatMetas).map(([k, v]) => [k, v.unreadByAdmin || 0])
  )

  const handleSendBroadcast = async (text: string) => {
    if (!adminUser) return
    await sendBroadcastMessage(adminUser.uid, adminUser.displayName || 'Super Admin', text)
  }

  const handleSendPrivate = async (text: string, cashierUid: string) => {
    if (!adminUser) return
    const target = cashierList.find((c) => c.uid === cashierUid)
    await sendPrivateMessage({
      senderUid: adminUser.uid,
      senderName: adminUser.displayName || 'Super Admin',
      senderRole: 'super_admin',
      cashierUid,
      cashierName: target?.name || cashierUid,
      text
    })
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <Link
            href="/admin"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div>
            <h1 className="font-black text-base text-white tracking-wide flex items-center gap-2">
              <Users className="size-5 text-pink-400" /> OPERACIÓN Y MONITOREO DE CAJEROS
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              admin.sugarludo.com &bull; Altas, Edición, Balances de Flotante, Arqueo y Chat Interno
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Switcher Ergonómico de Vistas */}
          <div className="p-1 rounded-2xl bg-slate-950 border border-white/5 flex items-center gap-1 text-xs">
            <button
              onClick={() => setActiveView('monitoring')}
              className={clsx(
                'px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                activeView === 'monitoring'
                  ? 'bg-gradient-to-r from-pink-500 to-pink-600 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <Wallet className="size-3.5" />
              <span>Monitoreo & Cajas ({cashierList.length})</span>
            </button>

            <button
              onClick={() => {
                setActiveView('communications')
                if (totalUnreadByAdmin > 0) {
                  setCommunicationsInitialMode('private')
                  const cashierWithUnread = cashierList.find((c) => (unreadByCashierMap[c.uid] || 0) > 0)
                  if (cashierWithUnread) {
                    setSelectedChatCashierUid(cashierWithUnread.uid)
                  }
                } else {
                  setCommunicationsInitialMode('broadcast')
                }
              }}
              className={clsx(
                'relative px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition-all cursor-pointer',
                activeView === 'communications'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              )}
            >
              <MessageSquare className="size-3.5" />
              <span>Comunicaciones Staff</span>
              {totalUnreadByAdmin > 0 && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-black animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.6)]">
                  {totalUnreadByAdmin}
                </span>
              )}
            </button>
          </div>

          {/* Botón Principal: Registrar Nuevo Cajero */}
          <button
            onClick={() => setIsRegisterCashierModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 text-xs font-black transition-all shadow-[0_0_20px_rgba(236,72,153,0.3)] cursor-pointer"
          >
            <UserPlus className="size-4" />
            <span>Registrar Nuevo Cajero</span>
          </button>

          <button
            onClick={handleLogout}
            className="p-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
            title="Cerrar Sesión"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </header>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-pink-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="size-5" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-6">
        {/* VISTA 1: MONITOREO & CAJAS (ANCHO COMPLETO) */}
        {activeView === 'monitoring' && (
          <div className="space-y-6">
            {/* Cashiers List & Shifts */}
            <div className="rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden shadow-xl">
              <div className="p-5 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <Wallet className="size-4 text-cyan-400" /> CAJEROS ACTIVOS Y BALANCES DE FLOTANTE ({cashierList.length})
                  </h2>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Asignación de capital en USDT, control de turnos y edición de credenciales
                  </p>
                </div>

                <button
                  onClick={() => setIsRegisterCashierModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="size-3.5" />
                  <span>Alta de Cajero</span>
                </button>
              </div>

              <div className="divide-y divide-white/5">
                {cashierList.length === 0 ? (
                  <div className="p-12 text-center space-y-3">
                    <Users className="size-12 text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No hay cajeros registrados en el sistema</p>
                    <p className="text-xs text-slate-500 font-mono max-w-md mx-auto">
                      Registra al primer cajero de la red para habilitar la liquidación de retiros P2P.
                    </p>
                    <button
                      onClick={() => setIsRegisterCashierModalOpen(true)}
                      className="px-4 py-2 rounded-xl bg-pink-500 text-slate-950 font-black text-xs transition-all shadow-md cursor-pointer"
                    >
                      + Registrar Primer Cajero
                    </button>
                  </div>
                ) : (
                  cashierList.map((csh) => (
                    <div key={csh.uid} className="p-5 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <img
                          src={csh.avatarUrl || 'https://i.ibb.co/3YBC35Xm/avatar-1786744277377.jpg'}
                          alt={csh.name}
                          className="size-13 rounded-2xl object-cover border border-white/10 shrink-0"
                        />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-white">{csh.name}</h3>
                            <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider', csh.shiftStatus === 'on_shift' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400')}>
                              {csh.shiftStatus === 'on_shift' ? 'En Turno' : 'Fuera de Turno'}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-400 font-mono">
                              UID: {csh.uid}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 font-mono">
                            {csh.email} &bull; Métodos: <strong className="text-white">{csh.paymentMethodsCount || 2} habilitados</strong>
                            {csh.phone && <span> &bull; Tel: <strong className="text-slate-300">{csh.phone}</strong></span>}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto justify-between lg:justify-end">
                        <div className="text-right font-mono pr-4 lg:border-r border-white/10">
                          <span className="text-[10px] text-slate-500 uppercase block">Saldo Flotante Actual</span>
                          <span className="text-base font-black text-emerald-400">
                            ${(((csh as any).floatBalanceUSDT ?? (csh.floatBalanceCoins / 100))).toFixed(2)} USDT
                          </span>
                          <span className="text-[10px] text-slate-400 block font-bold">
                            {csh.floatBalanceCoins.toLocaleString()} SC
                          </span>
                          {(csh as any).totalPaidWithdrawalsUSDT > 0 && (
                            <span className="text-[9px] text-pink-400 block">
                              Pagado Retiros: -${Number((csh as any).totalPaidWithdrawalsUSDT).toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => setSelectedCashierForRecharge(csh)}
                            className="px-3 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Asignar Saldo Flotante"
                          >
                            <Plus className="size-3.5" />
                            <span>Asignar Flotante</span>
                          </button>

                          <button
                            onClick={() => setSelectedCashierForPdf(csh)}
                            className="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Generar Arqueo de Turno en PDF"
                          >
                            <Printer className="size-3.5" />
                            <span>Arqueo Turno</span>
                          </button>

                          <button
                            onClick={() => setSelectedCashierForEdit(csh)}
                            className="px-3 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                            title="Editar Perfil, Datos de Pago y Contraseña"
                          >
                            <UserCog className="size-3.5" />
                            <span>Editar / Clave</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Full-width Processed Withdrawals Audit */}
            <div className="rounded-3xl bg-slate-900/60 border border-white/10 p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                    <FileText className="size-4 text-cyan-400" /> AUDITORÍA DE RETIROS LIQUIDADOS (TXID / COMPROBANTES)
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Historial de retiros de usuarios transferidos con comprobante de pago
                  </p>
                </div>
                <span className="text-[11px] font-mono text-cyan-400 font-bold">
                  {withdrawalAudits.length} liquidaciones auditadas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {withdrawalAudits.length === 0 ? (
                  <div className="col-span-full p-12 text-center space-y-2">
                    <FileText className="size-10 text-slate-700 mx-auto" />
                    <p className="text-xs font-bold text-slate-400">Sin retiros procesados aún</p>
                    <p className="text-[11px] text-slate-600 font-mono">Los comprobantes de retiro aparecerán automáticamente al ser liquidados por los cajeros.</p>
                  </div>
                ) : (
                  withdrawalAudits.map((item) => (
                    <div key={item.id} className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2.5 text-xs hover:border-white/10 transition-colors">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">Retiro #{item.orderId.slice(0, 8)}</span>
                        <span className="font-mono font-black text-pink-300">${item.amountFiatUSDT.toFixed(2)} USDT</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Jugador: <strong className="text-white">{item.playerName}</strong> &bull; Cajero: <strong className="text-pink-300">{item.cashierName}</strong>
                      </div>
                      {item.walletTxHash && (
                        <div className="p-2 rounded-xl bg-slate-900 font-mono text-[10px] text-slate-400 truncate flex items-center justify-between">
                          <span className="truncate">TxID: {item.walletTxHash}</span>
                          <ExternalLink className="size-3.5 text-cyan-400 shrink-0 ml-2" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* VISTA 2: CENTRO DE COMUNICACIONES DE STAFF (ANCHO COMPLETO) */}
        {activeView === 'communications' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <MessageSquare className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white">CENTRO DE COMUNICACIONES Y DIFUSIÓN MASIVA</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Envía anuncios a todos los cajeros activos o comunícate por canal privado individual.
                  </p>
                </div>
              </div>

              <button
                onClick={() => setActiveView('monitoring')}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft className="size-3.5" />
                <span>Volver a Monitoreo</span>
              </button>
            </div>

            <div className="w-full">
              <CashierDualChatPanel
                cashiers={cashierList}
                broadcastMessages={broadcastMessages}
                privateMessages={privateMessages}
                selectedCashierUid={selectedChatCashierUid}
                onSelectCashier={handleSelectCashier}
                onSendBroadcast={handleSendBroadcast}
                onSendPrivate={handleSendPrivate}
                unreadByAdminTotal={totalUnreadByAdmin}
                unreadByCashierMap={unreadByCashierMap}
                initialMode={communicationsInitialMode}
              />
            </div>
          </div>
        )}
      </main>

      {/* Modal: Registro de Nuevo Cajero */}
      <RegisterCashierModal
        isOpen={isRegisterCashierModalOpen}
        onClose={() => setIsRegisterCashierModalOpen(false)}
        onRegister={async (newCashier, pass) => {
          const res = await createNewCashier(newCashier, pass)
          if (res.success) {
            setNotification(res.message)
            setTimeout(() => setNotification(null), 4000)
          }
        }}
      />

      {/* Modal: Edición de Cajero y Recuperación / Cambio de Clave */}
      <EditCashierModal
        isOpen={!!selectedCashierForEdit}
        onClose={() => setSelectedCashierForEdit(null)}
        cashier={selectedCashierForEdit}
        onSave={async (uid, updates, newPass) => {
          const res = await updateCashierProfile(uid, updates, newPass)
          if (res.success) {
            setNotification(res.message)
            setTimeout(() => setNotification(null), 4000)
          }
        }}
      />

      {/* Modal: Asignación / Recarga de Saldo Flotante */}
      <FloatRechargeModal
        isOpen={!!selectedCashierForRecharge}
        onClose={() => setSelectedCashierForRecharge(null)}
        cashier={selectedCashierForRecharge}
        onRecharge={handleRecharge}
      />

      {/* Modal: Arqueo de Turno en PDF */}
      <CashierPdfReportModal
        isOpen={!!selectedCashierForPdf}
        onClose={() => setSelectedCashierForPdf(null)}
        cashier={selectedCashierForPdf}
      />
    </div>
  )
}
