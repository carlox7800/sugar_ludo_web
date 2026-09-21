'use client'

import React, { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '../../../lib/admin-auth-context'
import { getStaffAuthHeaders } from '../../../lib/auth-headers'
import { db } from '../../../lib/firebase'
import { collection, onSnapshot, query, limit } from 'firebase/firestore'
import { DisputeCase } from '../../../types/treasury'
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle,
  XCircle,
  Eye,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  User,
  LogOut,
  RefreshCw,
  Wallet,
  Gamepad2,
  Coins,
  Search,
  Filter,
  Clock,
  Laptop,
  Smartphone,
  Monitor,
  X,
  Gift,
  FileText,
  ChevronRight,
  Info
} from 'lucide-react'
import { clsx } from 'clsx'
import { calculatePendingDisputesCounts } from '../../../lib/disputes-service'

type DomainTab = 'financial' | 'gameplay' | 'account'
type StatusFilter = 'all' | 'open' | 'investigating' | 'resolved'

export default function DisputasAdminPage() {
  const router = useRouter()
  const { adminUser, isAuthenticated, isLoading, logout } = useAdminAuth()

  const [disputes, setDisputes] = useState<DisputeCase[]>([])
  const [activeTab, setActiveTab] = useState<DomainTab>('financial')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const [notification, setNotification] = useState<string | null>(null)
  const [resolvingId, setResolvingId] = useState<string | null>(null)

  // Drawer de inspección de telemetría
  const [telemetryModalCase, setTelemetryModalCase] = useState<DisputeCase | null>(null)

  // Modal de resolución con nota personalizada
  const [actionModal, setActionModal] = useState<{
    dispute: DisputeCase
    verdict: 'favor_player' | 'favor_cashier' | 'clarification' | 'dismiss' | 'compensate_goodwill'
    title: string
    defaultNote: string
    coinsAmount?: number
  } | null>(null)
  const [customNote, setCustomNote] = useState('')
  const [compensationAmount, setCompensationAmount] = useState(50)

  useEffect(() => {
    if (!isLoading && (!isAuthenticated || !adminUser)) {
      router.push('/')
    }
  }, [isLoading, isAuthenticated, adminUser, router])

  // Suscripción en tiempo real a casos de disputa en Firestore
  useEffect(() => {
    if (!isAuthenticated) return

    try {
      const q = query(collection(db, 'dispute_cases'), limit(100))
      const unsub = onSnapshot(
        q,
        (snap) => {
          const liveDisputes: DisputeCase[] = snap.docs.map((d) => {
            const data = d.data()
            const rawCategory = data.category || (data.orderId && data.orderId !== 'none' ? 'transactions' : 'account')
            const rawDomain: 'financial' | 'gameplay' | 'account' =
              data.domain ||
              (rawCategory === 'transactions' || (data.orderId && data.orderId !== 'none')
                ? 'financial'
                : rawCategory === 'gameplay'
                ? 'gameplay'
                : 'account')

            return {
              id: d.id,
              ticketNumber: data.ticketNumber || (d.id.startsWith('tkt_') ? `TKT-${d.id.slice(-6).toUpperCase()}` : `#${d.id.slice(0, 8)}`),
              orderId: data.orderId || 'none',
              type: (data.orderType || data.type || 'deposit') as 'deposit' | 'withdraw',
              domain: rawDomain,
              category: rawCategory,
              priority: data.priority || 'normal',
              playerUid: data.playerUid || 'usr_player',
              playerName: data.playerName || 'Jugador Sugar',
              cashierUid: data.cashierUid || 'staff_support',
              cashierName: data.cashierName || 'Soporte Oficial',
              amountFiat: Number(data.amountFiat || Number(data.amountSugarCoins || 0) / 100),
              currency: data.currency || 'USDT',
              amountSugarCoins: Number(data.amountSugarCoins || 0),
              reason: data.reason || 'Incidencia reportada por usuario',
              systemSummary: data.systemSummary,
              playerNotes: data.playerNotes,
              openedBy: (data.openedBy || 'player') as 'player' | 'cashier',
              openedAt: Number(data.createdAt || data.openedAt || Date.now()),
              evidenceReceiptUrl: data.receiptUrl || data.evidenceReceiptUrl,
              status: (data.status || 'open') as any,
              resolvedBy: data.resolvedBy,
              resolvedAt: data.resolvedAt,
              resolutionNotes: data.resolutionNotes,
              telemetrySnapshot: data.telemetrySnapshot
            }
          })
          setDisputes(liveDisputes)
        },
        (err) => {
          console.warn('[Disputas] Error en listener de dispute_cases:', err)
        }
      )

      return () => unsub()
    } catch {}
  }, [isAuthenticated])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  // Filtrado reactivo por dominio, estatus y búsqueda
  const filteredDisputes = useMemo(() => {
    return disputes.filter((item) => {
      // 1. Dominio
      if (item.domain !== activeTab) return false

      // 2. Estatus
      if (statusFilter === 'open' && item.status !== 'open') return false
      if (statusFilter === 'investigating' && item.status !== 'investigating') return false
      if (
        statusFilter === 'resolved' &&
        item.status !== 'resolved_player' &&
        item.status !== 'resolved_cashier' &&
        item.status !== 'compensated' &&
        item.status !== 'dismissed'
      )
        return false

      // 3. Búsqueda por texto (Folio, ID, Jugador, Orden)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchFolio = item.ticketNumber?.toLowerCase().includes(q)
        const matchId = item.id.toLowerCase().includes(q)
        const matchPlayer = item.playerName.toLowerCase().includes(q) || item.playerUid.toLowerCase().includes(q)
        const matchOrder = item.orderId.toLowerCase().includes(q)
        const matchReason = item.reason.toLowerCase().includes(q)
        return matchFolio || matchId || matchPlayer || matchOrder || matchReason
      }

      return true
    })
  }, [disputes, activeTab, statusFilter, searchQuery])

  // Contadores reactivos de tickets estrictamente pendientes por dominio
  const domainPendingCounts = useMemo(() => {
    return calculatePendingDisputesCounts(disputes)
  }, [disputes])

  // Apertura de modal de dictamen
  const openActionModal = (
    dispute: DisputeCase,
    verdict: 'favor_player' | 'favor_cashier' | 'clarification' | 'dismiss' | 'compensate_goodwill'
  ) => {
    let title = ''
    let defaultNote = ''

    if (verdict === 'favor_player') {
      title = 'Dictaminar a Favor del Jugador (Acreditar Saldo)'
      defaultNote = 'Dictamen favorable emitido por el Super Admin. Fondos acreditados al balance del jugador.'
    } else if (verdict === 'favor_cashier') {
      title = 'Dictaminar a Favor del Cajero (Desbloquear Garantía)'
      defaultNote = 'Dictamen favorable para el cajero. Fondos de garantía liberados de la orden.'
    } else if (verdict === 'clarification') {
      title = 'Emitir Aclaratoria Oficial de Soporte'
      defaultNote = 'El equipo de auditoría revisó el caso. Se aplicó el reglamento oficial vigente de la plataforma.'
    } else if (verdict === 'dismiss') {
      title = 'Desestimar Reporte (Auditoría Técnica)'
      defaultNote = 'Incidencia desestimada tras contrastar la telemetría del cliente y los eventos del motor en vivo.'
    } else if (verdict === 'compensate_goodwill') {
      title = 'Compensación de Cortesía (Goodwill Sugar Coins)'
      defaultNote = 'Compensación de cortesía acreditada al jugador por inconveniente técnico temporal.'
    }

    setActionModal({ dispute, verdict, title, defaultNote, coinsAmount: 50 })
    setCustomNote(defaultNote)
    setCompensationAmount(50)
  }

  // Ejecución del veredicto
  const handleExecuteVerdict = async () => {
    if (!adminUser || !actionModal || resolvingId) return
    const { dispute, verdict } = actionModal
    setResolvingId(dispute.id)

    try {
      const res = await fetch('/api/disputes/resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getStaffAuthHeaders('admin')
        },
        body: JSON.stringify({
          disputeId: dispute.id,
          verdict,
          playerUid: dispute.playerUid,
          adminUid: adminUser.uid,
          adminName: adminUser.displayName || 'Super Admin',
          resolutionNotes: customNote.trim() || actionModal.defaultNote,
          compensationCoins: verdict === 'compensate_goodwill' ? compensationAmount : undefined
        })
      })

      const data = await res.json()
      if (res.ok && data.success) {
        setNotification(`✅ ${data.message || 'Dictamen ejecutado exitosamente.'}`)
        setActionModal(null)
      } else {
        setNotification(`❌ Error: ${data.error || 'No se pudo procesar dictamen'}`)
      }
    } catch (e: any) {
      setNotification(`❌ Error de conexión: ${e.message}`)
    } finally {
      setResolvingId(null)
      setTimeout(() => setNotification(null), 4500)
    }
  }

  if (isLoading || !isAuthenticated || !adminUser) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-cyan-400 font-mono text-xs">
        Cargando módulo de soporte y arbitraje multi-dominio...
      </div>
    )
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
              <ShieldAlert className="size-5 text-cyan-400" /> CENTRO DE SOPORTE, TELEMETRÍA Y ARBITRAJE
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              admin.sugarludo.com &bull; Resolución Multi-Dominio Segregada y Telemetría Técnica en Vivo
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/admin/perfil"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            title="Mi Perfil"
          >
            <User className="size-4" />
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
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-cyan-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle className="size-5" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-5">
        
        {/* Pestañas de Segregación Operativa por Dominio */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-white/10 pb-3">
          <button
            onClick={() => setActiveTab('financial')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'financial'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.35)]'
                : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <Wallet className="size-4" />
            <span>Disputas Financieras P2P</span>
            <span
              className={clsx(
                'px-2.5 py-0.5 rounded-full text-[10px] font-black transition-all flex items-center gap-1.5',
                domainPendingCounts.financial > 0
                  ? 'bg-amber-400 text-slate-950 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.8)] ring-2 ring-amber-400/40'
                  : 'bg-white/10 text-slate-400 border border-white/5'
              )}
            >
              {domainPendingCounts.financial > 0 && (
                <span className="size-1.5 rounded-full bg-slate-950 animate-ping" />
              )}
              <span>{domainPendingCounts.financial}</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('gameplay')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'gameplay'
                ? 'bg-pink-500 text-slate-950 shadow-[0_0_20px_rgba(236,72,153,0.35)]'
                : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <Gamepad2 className="size-4" />
            <span>Reportes de Partidas / Gameplay</span>
            <span
              className={clsx(
                'px-2.5 py-0.5 rounded-full text-[10px] font-black transition-all flex items-center gap-1.5',
                domainPendingCounts.gameplay > 0
                  ? 'bg-pink-400 text-slate-950 animate-pulse shadow-[0_0_12px_rgba(244,114,182,0.8)] ring-2 ring-pink-400/40'
                  : 'bg-white/10 text-slate-400 border border-white/5'
              )}
            >
              {domainPendingCounts.gameplay > 0 && (
                <span className="size-1.5 rounded-full bg-slate-950 animate-ping" />
              )}
              <span>{domainPendingCounts.gameplay}</span>
            </span>
          </button>

          <button
            onClick={() => setActiveTab('account')}
            className={`px-4 py-2.5 rounded-2xl text-xs font-extrabold flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'account'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.35)]'
                : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
            }`}
          >
            <Coins className="size-4" />
            <span>Incidencias Técnicas / Cuenta</span>
            <span
              className={clsx(
                'px-2.5 py-0.5 rounded-full text-[10px] font-black transition-all flex items-center gap-1.5',
                domainPendingCounts.account > 0
                  ? 'bg-amber-300 text-slate-950 animate-pulse shadow-[0_0_12px_rgba(252,211,77,0.8)] ring-2 ring-amber-300/40'
                  : 'bg-white/10 text-slate-400 border border-white/5'
              )}
            >
              {domainPendingCounts.account > 0 && (
                <span className="size-1.5 rounded-full bg-slate-950 animate-ping" />
              )}
              <span>{domainPendingCounts.account}</span>
            </span>
          </button>
        </div>

        {/* Barra de Búsqueda y Filtros de Estado */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-white/10">
          <div className="relative w-full sm:w-80">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por Folio (TKT-...), Usuario u Orden..."
              className="w-full bg-slate-950/80 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
          </div>

          <div className="flex items-center gap-1.5 self-end sm:self-auto overflow-x-auto w-full sm:w-auto">
            {(['all', 'open', 'investigating', 'resolved'] as StatusFilter[]).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  statusFilter === st
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                    : 'bg-white/5 text-slate-400 hover:text-white border border-white/5'
                }`}
              >
                <span>
                  {st === 'all' && 'Todos'}
                  {st === 'open' && 'Abiertos'}
                  {st === 'investigating' && 'En Investigación'}
                  {st === 'resolved' && 'Resueltos'}
                </span>
                {st === 'open' && domainPendingCounts[activeTab] > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 text-[9px] font-black animate-pulse">
                    {domainPendingCounts[activeTab]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Contenedor de Casos */}
        <div className="rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle className="size-4 text-cyan-400" />
              <span>
                {activeTab === 'financial' && 'Arbitraje de Órdenes P2P y Escrow'}
                {activeTab === 'gameplay' && 'Auditoría de Salas y Telemetría de Motor'}
                {activeTab === 'account' && 'Aclaratorias y Ajustes de Cuenta'}
              </span>
              <span className="text-slate-400 font-mono">
                ({filteredDisputes.length} Registros • <span className={domainPendingCounts[activeTab] > 0 ? 'text-amber-400 font-bold' : 'text-slate-400'}>{domainPendingCounts[activeTab]} Pendientes</span>)
              </span>
            </h2>
          </div>

          <div className="divide-y divide-white/5">
            {filteredDisputes.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <ShieldCheck className="size-12 text-emerald-500/60 mx-auto" />
                <p className="text-sm font-bold text-white">No se encontraron tickets en esta categoría</p>
                <p className="text-xs text-slate-400 font-mono">
                  No hay incidencias que coincidan con los filtros y la pestaña seleccionada.
                </p>
              </div>
            ) : (
              filteredDisputes.map((caseItem) => {
                const isResolved =
                  caseItem.status === 'resolved_player' ||
                  caseItem.status === 'resolved_cashier' ||
                  caseItem.status === 'compensated' ||
                  caseItem.status === 'dismissed'

                return (
                  <div key={caseItem.id} className="p-5 sm:p-6 space-y-4 hover:bg-white/[0.01] transition-colors">
                    {/* Header de la tarjeta */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-sm font-extrabold text-cyan-400">
                          {caseItem.ticketNumber || caseItem.id}
                        </span>
                        <span
                          className={clsx(
                            'px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border',
                            caseItem.status === 'open' && 'bg-amber-500/10 text-amber-300 border-amber-500/30',
                            caseItem.status === 'investigating' && 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
                            caseItem.status === 'resolved_player' && 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
                            caseItem.status === 'resolved_cashier' && 'bg-slate-500/10 text-slate-300 border-slate-500/30',
                            caseItem.status === 'compensated' && 'bg-purple-500/10 text-purple-300 border-purple-500/30',
                            caseItem.status === 'dismissed' && 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                          )}
                        >
                          {caseItem.status === 'open' && 'Abierto'}
                          {caseItem.status === 'investigating' && 'En Investigación'}
                          {caseItem.status === 'resolved_player' && 'A Favor de Jugador'}
                          {caseItem.status === 'resolved_cashier' && 'A Favor de Cajero'}
                          {caseItem.status === 'compensated' && 'Compensado (Goodwill)'}
                          {caseItem.status === 'dismissed' && 'Desestimado'}
                        </span>

                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(caseItem.openedAt).toLocaleString('es-ES', {
                            dateStyle: 'short',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {caseItem.amountSugarCoins > 0 && (
                          <div className="text-right font-mono">
                            <span className="text-xs text-slate-400 block">Monto Implicado:</span>
                            <span className="text-sm font-black text-pink-400">
                              {caseItem.amountSugarCoins.toLocaleString()} SC (
                              ${(caseItem.amountSugarCoins / 100).toFixed(2)} USDT)
                            </span>
                          </div>
                        )}

                        {/* Botón de inspección de telemetría */}
                        {caseItem.telemetrySnapshot && (
                          <button
                            onClick={() => setTelemetryModalCase(caseItem)}
                            className="px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="size-3.5" />
                            <span>Ver Telemetría</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Contenido en cuadrícula */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      {/* Información del Jugador y Contexto */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                        <span className="text-slate-500 font-bold uppercase block text-[10px]">
                          Datos del Solicitante
                        </span>
                        <div className="space-y-1">
                          <div className="flex justify-between">
                            <span className="text-slate-400">Jugador:</span>
                            <span className="text-white font-bold">{caseItem.playerName}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">UID Jugador:</span>
                            <span className="font-mono text-slate-300 text-[11px]">{caseItem.playerUid}</span>
                          </div>
                          {caseItem.orderId && caseItem.orderId !== 'none' && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Orden Vinculada:</span>
                              <span className="font-mono text-cyan-400">#{caseItem.orderId}</span>
                            </div>
                          )}
                          {caseItem.cashierName && caseItem.cashierName !== 'staff_support' && (
                            <div className="flex justify-between">
                              <span className="text-slate-400">Cajero Asignado:</span>
                              <span className="text-pink-300 font-bold">{caseItem.cashierName}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Motivo del Reclamo y Diagnóstico Automático */}
                      <div className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                        <span className="text-slate-500 font-bold uppercase block text-[10px]">
                          Detalle de la Incidencia
                        </span>
                        <p className="text-slate-200 font-semibold">{caseItem.reason}</p>
                        {caseItem.playerNotes && (
                          <p className="text-slate-400 text-[11px] italic bg-black/40 p-2 rounded-xl border border-white/5">
                            "{caseItem.playerNotes}"
                          </p>
                        )}
                        {caseItem.systemSummary && (
                          <div className="text-[10px] text-cyan-300 font-mono bg-cyan-950/40 p-2 rounded-xl border border-cyan-500/20">
                            Pre-triage: {caseItem.systemSummary}
                          </div>
                        )}
                        {caseItem.evidenceReceiptUrl && (
                          <div className="pt-1">
                            <a
                              href={caseItem.evidenceReceiptUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-[11px] text-cyan-400 hover:text-cyan-300 font-bold underline"
                            >
                              <ExternalLink className="size-3.5" />
                              <span>Ver Comprobante Adjunto</span>
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bloque de Dictamen Resuelto o Botones de Acción */}
                    {isResolved ? (
                      <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs space-y-1">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold">
                          <CheckCircle className="size-4" />
                          <span>Dictamen Oficial Emitido por {caseItem.resolvedBy}</span>
                          {caseItem.resolvedAt && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              ({new Date(caseItem.resolvedAt).toLocaleString()})
                            </span>
                          )}
                        </div>
                        <p className="text-slate-300 leading-relaxed">{caseItem.resolutionNotes}</p>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-white/5">
                        {/* ACCIONES PARA DOMINIO FINANCIERO P2P */}
                        {caseItem.domain === 'financial' && (
                          <>
                            <button
                              disabled={resolvingId === caseItem.id}
                              onClick={() => openActionModal(caseItem, 'favor_cashier')}
                              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <ShieldCheck className="size-3.5 text-slate-400" />
                              <span>Dictaminar a Favor del Cajero</span>
                            </button>
                            <button
                              disabled={resolvingId === caseItem.id}
                              onClick={() => openActionModal(caseItem, 'favor_player')}
                              className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 disabled:opacity-50 text-slate-950 text-xs font-black transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle className="size-3.5" />
                              <span>Acreditar al Jugador</span>
                            </button>
                          </>
                        )}

                        {/* ACCIONES PARA DOMINIO GAMEPLAY / MOTOR */}
                        {caseItem.domain === 'gameplay' && (
                          <>
                            <button
                              disabled={resolvingId === caseItem.id}
                              onClick={() => openActionModal(caseItem, 'dismiss')}
                              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <XCircle className="size-3.5" />
                              <span>Desestimar Reporte</span>
                            </button>
                            <button
                              disabled={resolvingId === caseItem.id}
                              onClick={() => openActionModal(caseItem, 'compensate_goodwill')}
                              className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Gift className="size-3.5" />
                              <span>Compensar Cortesía (Goodwill SC)</span>
                            </button>
                            <button
                              disabled={resolvingId === caseItem.id}
                              onClick={() => openActionModal(caseItem, 'clarification')}
                              className="px-4 py-2 rounded-xl bg-pink-500 hover:bg-pink-400 text-slate-950 text-xs font-black transition-all shadow-[0_0_15px_rgba(236,72,153,0.3)] cursor-pointer flex items-center gap-1.5"
                            >
                              <FileText className="size-3.5" />
                              <span>Emitir Aclaratoria Oficial</span>
                            </button>
                          </>
                        )}

                        {/* ACCIONES PARA DOMINIO CUENTA / SALDO */}
                        {caseItem.domain === 'account' && (
                          <>
                            <button
                              disabled={resolvingId === caseItem.id}
                              onClick={() => openActionModal(caseItem, 'dismiss')}
                              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <XCircle className="size-3.5" />
                              <span>Desestimar Incidencia</span>
                            </button>
                            <button
                              disabled={resolvingId === caseItem.id}
                              onClick={() => openActionModal(caseItem, 'compensate_goodwill')}
                              className="px-3.5 py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <Gift className="size-3.5" />
                              <span>Compensar Saldo</span>
                            </button>
                            <button
                              disabled={resolvingId === caseItem.id}
                              onClick={() => openActionModal(caseItem, 'clarification')}
                              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition-all cursor-pointer flex items-center gap-1.5"
                            >
                              <CheckCircle className="size-3.5" />
                              <span>Emitir Resolución</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>

      {/* ========================================================================= */}
      {/* MODAL 1: INSPECTOR DE TELEMETRÍA TÉCNICA DEL CLIENTE */}
      {/* ========================================================================= */}
      {telemetryModalCase && telemetryModalCase.telemetrySnapshot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-cyan-500/30 rounded-3xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(6,182,212,0.2)]">
            {/* Header del Modal */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                  <Monitor className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white">
                    Auditoría de Telemetría Técnica en Vivo
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    Caso: {telemetryModalCase.ticketNumber} &bull; Jugador: {telemetryModalCase.playerName}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setTelemetryModalCase(null)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="size-5" />
              </button>
            </div>

            {/* Contenido del Snapshot de Telemetría */}
            <div className="p-5 overflow-y-auto space-y-4 custom-scrollbar flex-1 text-xs">
              {/* Metadatos de Plataforma y Versión */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Plataforma</span>
                  <div className="flex items-center gap-1.5 font-bold text-cyan-300">
                    {telemetryModalCase.telemetrySnapshot.clientPlatform === 'android_capacitor' ? (
                      <Smartphone className="size-4" />
                    ) : telemetryModalCase.telemetrySnapshot.clientPlatform === 'electron_desktop' ? (
                      <Laptop className="size-4" />
                    ) : (
                      <Monitor className="size-4" />
                    )}
                    <span className="capitalize">
                      {telemetryModalCase.telemetrySnapshot.clientPlatform.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Versión Cliente</span>
                  <div className="font-mono font-bold text-white">
                    v{telemetryModalCase.telemetrySnapshot.appVersion}
                  </div>
                </div>

                {telemetryModalCase.telemetrySnapshot.lastRoomCode && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1 col-span-2 sm:col-span-1">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Sala de Partida</span>
                    <div className="font-mono font-bold text-pink-400">
                      #{telemetryModalCase.telemetrySnapshot.lastRoomCode}
                    </div>
                  </div>
                )}
              </div>

              {/* Balance al momento del reporte */}
              {telemetryModalCase.telemetrySnapshot.accountBalanceAtCreation && (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-white/5 flex items-center justify-between">
                  <span className="text-slate-400">Saldo del Jugador al Crear el Ticket:</span>
                  <div className="font-mono space-x-2">
                    <span className="text-cyan-400 font-bold">
                      {telemetryModalCase.telemetrySnapshot.accountBalanceAtCreation.availableCoins.toLocaleString()} SC Disp.
                    </span>
                    <span className="text-amber-400 font-bold">
                      ({telemetryModalCase.telemetrySnapshot.accountBalanceAtCreation.escrowCoins.toLocaleString()} SC Custodia)
                    </span>
                  </div>
                </div>
              )}

              {/* Buffer de Logs de Sockets y Eventos Críticos */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                  Buffer de Logs Recientes (Socket, Motor y Errores):
                </span>
                <div className="p-3 rounded-2xl bg-black/80 border border-white/10 font-mono text-[11px] space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar">
                  {telemetryModalCase.telemetrySnapshot.recentSocketLogs &&
                  telemetryModalCase.telemetrySnapshot.recentSocketLogs.length > 0 ? (
                    telemetryModalCase.telemetrySnapshot.recentSocketLogs.map((log, idx) => (
                      <div key={idx} className="flex items-start gap-2 border-b border-white/5 pb-1">
                        <span className="text-slate-500 shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase shrink-0 ${
                            log.level === 'CRITICAL' || log.level === 'ERROR'
                              ? 'bg-rose-500/20 text-rose-400'
                              : log.level === 'SOCKET'
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          {log.level}
                        </span>
                        <span className="text-slate-300 break-all">{log.message}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-slate-500 italic py-4 text-center">
                      No se registraron excepciones o anomalías de red previas al reporte.
                    </div>
                  )}
                </div>
              </div>

              {/* User Agent */}
              <div className="p-2.5 rounded-xl bg-slate-950/60 border border-white/5 text-[10px] font-mono text-slate-500 break-all">
                UA: {telemetryModalCase.telemetrySnapshot.userAgent || 'N/A'}
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-slate-950/80 flex justify-end">
              <button
                onClick={() => setTelemetryModalCase(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-all cursor-pointer"
              >
                Cerrar Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONFIRMACIÓN DE DICTAMEN CON NOTA PERSONALIZABLE */}
      {/* ========================================================================= */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/20 rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <ShieldAlert className="size-4 text-cyan-400" />
                <span>{actionModal.title}</span>
              </h3>
              <button
                onClick={() => setActionModal(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-950 border border-white/5 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Folio:</span>
                  <span className="font-mono text-cyan-400 font-bold">{actionModal.dispute.ticketNumber}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Jugador:</span>
                  <span className="text-white font-bold">{actionModal.dispute.playerName}</span>
                </div>
              </div>

              {actionModal.verdict === 'compensate_goodwill' && (
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-purple-300">
                    Monto de Compensación en Sugar Coins (SC):
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    value={compensationAmount}
                    onChange={(e) => setCompensationAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white font-mono focus:border-purple-400 focus:outline-none"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-slate-300">
                  Fundamento / Nota Oficial de Auditoría (Visible para el Jugador):
                </label>
                <textarea
                  value={customNote}
                  onChange={(e) => setCustomNote(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-950 border border-white/10 rounded-xl p-2.5 text-xs text-white focus:border-cyan-400 focus:outline-none custom-scrollbar"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-white/10">
              <button
                disabled={resolvingId === actionModal.dispute.id}
                onClick={() => setActionModal(null)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                disabled={resolvingId === actionModal.dispute.id}
                onClick={handleExecuteVerdict}
                className="flex-1 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.3)]"
              >
                {resolvingId === actionModal.dispute.id ? (
                  <RefreshCw className="size-3.5 animate-spin" />
                ) : (
                  <CheckCircle className="size-3.5" />
                )}
                <span>Ejecutar Dictamen</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
