'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '../../../lib/admin-auth-context'
import { StaffChatMessage, ProcessedWithdrawalAudit } from '../../../types/admin-expanded'
import { MOCK_STAFF_CHAT, MOCK_WITHDRAWAL_AUDITS } from '../../../lib/mock-admin-expanded'
import { FloatRechargeModal } from '../../../components/admin/FloatRechargeModal'
import { CashierPdfReportModal } from '../../../components/admin/CashierPdfReportModal'
import { CashierDualChatPanel } from '../../../components/admin/CashierDualChatPanel'
import { db } from '../../../lib/firebase'
import { doc, setDoc, increment, collection } from 'firebase/firestore'
import {
  ArrowLeft,
  Users,
  Wallet,
  Plus,
  ShieldCheck,
  CheckCircle2,
  FileText,
  ExternalLink,
  Clock,
  MessageSquare,
  Printer,
  LogOut,
  User,
  Settings
} from 'lucide-react'
import { clsx } from 'clsx'

export default function AdminCajerosManagementPage() {
  const router = useRouter()
  const { adminUser, isAuthenticated, isLoading, logout, cashierList, updateCashierFloat } = useAdminAuth()

  const [staffChat, setStaffChat] = useState<StaffChatMessage[]>(MOCK_STAFF_CHAT)
  const [withdrawalAudits, setWithdrawalAudits] = useState<ProcessedWithdrawalAudit[]>(MOCK_WITHDRAWAL_AUDITS)
  
  const [selectedCashierForRecharge, setSelectedCashierForRecharge] = useState<any | null>(null)
  const [selectedCashierForPdf, setSelectedCashierForPdf] = useState<any | null>(null)
  const [notification, setNotification] = useState<string | null>(null)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !adminUser)) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, adminUser, router])

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

    // Notify in staff chat
    const newChat: StaffChatMessage = {
      id: `stf_${Date.now()}`,
      senderUid: adminUser.uid,
      senderName: adminUser.displayName,
      senderRole: 'super_admin',
      message: `💰 Asignación de saldo flotante aprobada: +$${amountUSDT.toFixed(2)} USDT (+${amountCoins.toLocaleString()} SC) asignados a ${target?.name || cashierUid}. Motivo: ${notes}`,
      timestamp: Date.now()
    }
    setStaffChat((prev) => [...prev, newChat])
    setNotification(`¡Asignados +$${amountUSDT.toFixed(2)} USDT (+${amountCoins.toLocaleString()} SC) con éxito!`)
    setTimeout(() => setNotification(null), 4000)
  }

  const handleSendStaffMessage = (text: string, recipientUid?: string) => {
    const newChat: StaffChatMessage = {
      id: `stf_${Date.now()}`,
      senderUid: adminUser.uid,
      senderName: adminUser.displayName,
      senderRole: 'super_admin',
      message: recipientUid ? `[Privado a ${cashierList.find(c => c.uid === recipientUid)?.name}]: ${text}` : text,
      timestamp: Date.now()
    }
    setStaffChat((prev) => [...prev, newChat])
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-40">
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
              admin.sugarludo.com &bull; Control de Flotante, Turnos, Arqueo y Chat Interno
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/perfil"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold transition-all"
          >
            <Settings className="size-3.5" />
            <span>Altas y Gestión en Perfil</span>
          </Link>

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
        {/* Cashiers List & Shifts */}
        <div className="rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden">
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <Wallet className="size-4 text-cyan-400" /> CAJEROS ACTIVOS Y BALANCES DE FLOTANTE ({cashierList.length})
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Para registrar nuevos cajeros diríjase a <Link href="/admin/perfil" className="text-pink-400 font-bold underline">Perfil y Cuentas</Link>
            </span>
          </div>

          <div className="divide-y divide-white/5">
            {cashierList.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Users className="size-10 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-slate-300">No hay cajeros registrados en el sistema</p>
                <p className="text-xs text-slate-500 font-mono">
                  Para dar de alta nuevos cajeros, ingrese a{' '}
                  <Link href="/admin/perfil" className="text-pink-400 font-bold underline">
                    Perfil y Cuentas
                  </Link>
                  .
                </p>
              </div>
            ) : (
              cashierList.map((csh) => (
                <div key={csh.uid} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img src={csh.avatarUrl || 'https://i.ibb.co/3YBC35Xm/avatar-1786744277377.jpg'} alt={csh.name} className="size-12 rounded-2xl object-cover border border-white/10" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-sm text-white">{csh.name}</h3>
                        <span className={clsx('px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider', csh.shiftStatus === 'on_shift' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-400')}>
                          {csh.shiftStatus === 'on_shift' ? 'En Turno' : 'Fuera de Turno'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 font-mono">
                        {csh.email} &bull; Métodos: <strong className="text-white">{csh.paymentMethodsCount} configurados</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-right font-mono pr-4 border-r border-white/10">
                      <span className="text-[10px] text-slate-500 uppercase block">Saldo Flotante Actual</span>
                      <span className="text-sm font-black text-emerald-400">
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

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setSelectedCashierForRecharge(csh)}
                        className="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Plus className="size-3.5" />
                        <span>Asignar Flotante</span>
                      </button>

                      <button
                        onClick={() => setSelectedCashierForPdf(csh)}
                        className="px-3.5 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="size-3.5" />
                        <span>Arqueo Turno</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dual Chat Panel + Withdrawals Audit */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left 7 Cols: Dual Staff Chat */}
          <div className="lg:col-span-7">
            <CashierDualChatPanel
              cashiers={cashierList}
              messages={staffChat}
              onSendMessage={handleSendStaffMessage}
            />
          </div>

          {/* Right 5 Cols: Processed Withdrawals Audit */}
          <div className="lg:col-span-5 rounded-3xl bg-slate-900/60 border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                <FileText className="size-4 text-cyan-400" /> AUDITORÍA DE RETIROS (TXID / PROOFS)
              </h3>
            </div>

            <div className="space-y-3">
              {withdrawalAudits.length === 0 ? (
                <div className="p-8 text-center space-y-2">
                  <FileText className="size-8 text-slate-700 mx-auto" />
                  <p className="text-xs font-bold text-slate-400">Sin retiros procesados aún</p>
                  <p className="text-[11px] text-slate-600 font-mono">Los comprobantes de retiro aparecerán automáticamente al ser liquidados.</p>
                </div>
              ) : (
                withdrawalAudits.map((item) => (
                  <div key={item.id} className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white">Retiro #{item.orderId.slice(0, 10)}</span>
                      <span className="font-mono font-black text-pink-300">${item.amountFiatUSDT.toFixed(2)} USDT (Fee {item.feePercent}%)</span>
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
      </main>

      {/* Float Recharge Modal */}
      <FloatRechargeModal
        isOpen={!!selectedCashierForRecharge}
        onClose={() => setSelectedCashierForRecharge(null)}
        cashier={selectedCashierForRecharge}
        onRecharge={handleRecharge}
      />

      {/* PDF Arqueo Report Modal */}
      <CashierPdfReportModal
        isOpen={!!selectedCashierForPdf}
        onClose={() => setSelectedCashierForPdf(null)}
        cashier={selectedCashierForPdf}
      />
    </div>
  )
}
