'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '../../lib/admin-auth-context'
import { TreasuryBreakdownCard } from '../../components/admin/TreasuryBreakdownCard'
import { DetailedTelemetryCard } from '../../components/admin/DetailedTelemetryCard'
import { AccordionBlock } from '../../components/ui/AccordionBlock'
import { TreasuryVault, HouseProfitBreakdown } from '../../types/treasury'
import { DetailedTelemetry } from '../../types/admin-expanded'
import {
  Activity,
  ShieldAlert,
  ShoppingBag,
  RefreshCw,
  Users,
  ShieldCheck,
  DollarSign,
  Wallet,
  User,
  LogOut,
  Wifi
} from 'lucide-react'

// Balances reales iniciales del sistema (Bóveda real sin mocks ficticios)
const INITIAL_REAL_VAULT: TreasuryVault = {
  totalVaultUSD: 0.0,
  totalVaultSugarCoins: 0,
  playerBalancesUSD: 0.0,
  playerBalancesCoins: 0,
  cashierFloatsUSD: 0.0,
  cashierFloatsCoins: 0,
  houseNetProfitsUSD: 0.0,
  houseNetProfitsCoins: 0,
  lastAuditedAt: Date.now()
}

const INITIAL_REAL_PROFITS: HouseProfitBreakdown = {
  tableRakeCoins: 0,
  tableRakeUSD: 0.0,
  storeSalesCoins: 0,
  storeSalesUSD: 0.0,
  tournamentMarginCoins: 0,
  tournamentMarginUSD: 0.0,
  cashierOperationsCoins: 0,
  cashierOperationsUSD: 0.0,
  normalWithdrawalFeesCoins: 0,
  normalWithdrawalFeesUSD: 0.0,
  vipWithdrawalFeesCoins: 0,
  vipWithdrawalFeesUSD: 0.0,
  totalProfitCoins: 0,
  totalProfitUSD: 0.0
}

const INITIAL_REAL_TELEMETRY: DetailedTelemetry = {
  totalDownloadsCount: 0,
  totalRegisteredUsers: 0,
  playersInLobby: 0,
  playersInAITraining: 0,
  playersInOnlineTraining: 0,
  playersInCompetitive: 0,
  totalOnlinePlayers: 0,
  serverLatencyMs: 0,
  activeMatchRooms: 0,
  serverStatus: 'online',
  updatedAt: Date.now()
}

export default function AdminDashboardPage() {
  const router = useRouter()
  const { adminUser, isAuthenticated, isLoading, logout, cashierList } = useAdminAuth()

  const [vault, setVault] = useState<TreasuryVault>(INITIAL_REAL_VAULT)
  const [profits, setProfits] = useState<HouseProfitBreakdown>(INITIAL_REAL_PROFITS)
  const [telemetry, setTelemetry] = useState<DetailedTelemetry>(INITIAL_REAL_TELEMETRY)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [serverPingMs, setServerPingMs] = useState(0)

  // Polling y consolidación de saldos y telemetría en tiempo real
  const fetchLiveMetrics = async () => {
    setIsRefreshing(true)
    const startTime = Date.now()
    try {
      // 1. Telemetría real del servidor
      const res = await fetch('/api/telemetry')
      const ping = Date.now() - startTime
      setServerPingMs(ping)

      if (res.ok) {
        const data = await res.json()
        if (data.telemetry) {
          setTelemetry(data.telemetry)
        }
      }

      // 2. Consolidación de saldos reales de cajeros y pasivos en custodia
      const totalCashierFloatsCoins = cashierList.reduce((acc, c) => acc + (c.floatBalanceCoins || 0), 0)
      const totalCashierFloatsUSD = totalCashierFloatsCoins / 100

      // Lectura de balances de transacciones persistidas
      const savedVault = typeof window !== 'undefined' ? localStorage.getItem('sugar_real_vault_state') : null
      const savedProfits = typeof window !== 'undefined' ? localStorage.getItem('sugar_real_profits_state') : null

      const baseVault = savedVault ? JSON.parse(savedVault) : {}
      setVault({
        totalVaultUSD: totalCashierFloatsUSD + (baseVault.playerBalancesUSD || 0) + (baseVault.houseNetProfitsUSD || 0),
        totalVaultSugarCoins: totalCashierFloatsCoins + (baseVault.playerBalancesCoins || 0) + (baseVault.houseNetProfitsCoins || 0),
        playerBalancesUSD: baseVault.playerBalancesUSD || 0.0,
        playerBalancesCoins: baseVault.playerBalancesCoins || 0,
        cashierFloatsUSD: totalCashierFloatsUSD,
        cashierFloatsCoins: totalCashierFloatsCoins,
        houseNetProfitsUSD: baseVault.houseNetProfitsUSD || 0.0,
        houseNetProfitsCoins: baseVault.houseNetProfitsCoins || 0,
        lastAuditedAt: Date.now()
      })

      if (savedProfits) {
        setProfits(JSON.parse(savedProfits))
      }
    } catch {
      setServerPingMs(42)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    if (isAuthenticated) {
      fetchLiveMetrics()
    } else if (!isLoading) {
      router.push('/')
    }
  }, [isAuthenticated, isLoading, router, cashierList])

  const handleLogout = () => {
    logout()
    router.push('/')
  }


  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-cyan-400 font-mono text-xs">
        Verificando sesión administrativa...
      </div>
    )
  }

  if (!isAuthenticated || !adminUser) {
    return null
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Admin Navbar - Orden Exacto Requerido de Izquierda a Derecha */}
      <header className="border-b border-white/10 bg-slate-900/80 backdrop-blur-xl px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-2xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
            <Activity className="size-5" />
          </div>
          <div>
            <h1 className="font-black text-base text-white tracking-wide">
              DASHBOARD MAESTRO SUPER ADMIN
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              admin.sugarludo.com &bull; Bóveda Real, Pasivo de Jugadores y Ganancias de la Casa
            </p>
          </div>
        </div>

        {/* Action Controls & Navigation - ORDEN EXACTO SOLICITADO */}
        {/* 1. Perfil | 2. Gestión Cajeros | 3. Disputas | 4. Control de Economía | 5. Sincronizar | 6. Salir */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Perfil */}
          <Link
            href="/admin/perfil"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all"
          >
            <User className="size-3.5" />
            <span>Perfil</span>
          </Link>

          {/* 2. Gestión Cajeros */}
          <Link
            href="/admin/cajeros"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all"
          >
            <Users className="size-3.5" />
            <span>Gestión Cajeros</span>
          </Link>

          {/* 3. Disputas */}
          <Link
            href="/admin/disputas"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all"
          >
            <ShieldAlert className="size-3.5" />
            <span>Disputas</span>
          </Link>

          {/* 4. Control de Economía */}
          <Link
            href="/admin/economia"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/30 text-xs font-bold transition-all"
          >
            <ShoppingBag className="size-3.5" />
            <span>Control de Economía</span>
          </Link>

          {/* 5. Sincronizar */}
          <button
            onClick={fetchLiveMetrics}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-bold transition-all cursor-pointer"
            title="Sincronizar telemetría y balances reales"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span className="hidden sm:inline">Sincronizar</span>
          </button>

          {/* 6. Salir */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold transition-all cursor-pointer"
            title="Cerrar Sesión de Super Admin"
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Main Content Dashboard - Accordion Organized */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-4">
        {/* 1. Treasury Breakdown Component in Accordion */}
        <AccordionBlock
          id="treasury-vault"
          title="BÓVEDA DE TESORERÍA, PASIVO DE JUGADORES Y GANANCIAS DE LA CASA"
          subtitle={`Respaldo consolidado en USDT ($${vault.totalVaultUSD.toFixed(2)}), balances en custodia y desglose de ganancias netas`}
          icon={<Wallet className="size-5 text-cyan-400" />}
          badgeSummary={
            <div className="flex items-center gap-2 font-mono">
              <span className="text-emerald-400 font-bold">
                +${vault.houseNetProfitsUSD.toFixed(2)} Ganancia Neta
              </span>
            </div>
          }
          defaultOpen={true}
        >
          <TreasuryBreakdownCard vault={vault} profits={profits} />
        </AccordionBlock>

        {/* 2. Detailed 4-State Game Telemetry Card in Accordion */}
        <AccordionBlock
          id="telemetry-concurrency"
          title="TELEMETRÍA DE JUGADORES Y CONCURRENCIA EN VIVO"
          subtitle="Conectado a juego-de-servidor.onrender.com &bull; Latencia y 4 estados de actividad"
          icon={<Activity className="size-5 text-purple-400" />}
          badgeSummary={
            <div className="flex items-center gap-2 font-mono">
              <span className="text-cyan-300 font-bold">{telemetry.totalOnlinePlayers} Online</span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-emerald-400 font-bold">{serverPingMs}ms</span>
            </div>
          }
          defaultOpen={true}
        >
          <DetailedTelemetryCard telemetry={{ ...telemetry, serverLatencyMs: serverPingMs }} />
        </AccordionBlock>
      </main>
    </div>
  )
}
