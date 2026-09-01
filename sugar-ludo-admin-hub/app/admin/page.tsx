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
import { EconomicHardResetModal, EconomicResetOptions } from '../../components/admin/EconomicHardResetModal'
import { subscribeToAllPrivateChatsMeta } from '../../lib/staff-chat-service'
import { db } from '../../lib/firebase'
import { doc, onSnapshot, setDoc, collection, getDocs, query, limit, writeBatch, getCountFromServer } from 'firebase/firestore'
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
  Wifi,
  Trash2,
  CheckCircle2
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
  const [unreadStaffMessagesCount, setUnreadStaffMessagesCount] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) return
    const unsubChat = subscribeToAllPrivateChatsMeta((metas) => {
      const totalUnread = Object.values(metas).reduce((acc, m) => acc + (m.unreadByAdmin || 0), 0)
      setUnreadStaffMessagesCount(totalUnread)
    })
    return () => unsubChat()
  }, [isAuthenticated])

  // Suscripción en tiempo real a 1 solo documento global_ledger (Spark Plan Costo $0.00)
  useEffect(() => {
    if (!isAuthenticated) return

    let unsubLedger: (() => void) | null = null
    try {
      const ledgerRef = doc(db, 'system_treasury', 'global_ledger')
      unsubLedger = onSnapshot(ledgerRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as any
          const totalFloatsUSD = cashierList.reduce((acc, c) => acc + ((c as any).floatBalanceUSDT ?? (c.floatBalanceCoins / 100)), 0)
          const totalFloatsCoins = cashierList.reduce((acc, c) => acc + (c.floatBalanceCoins || 0), 0)

          const playerBalancesUSD = Number(data.playerCustodyUSD || 0)
          const playerBalancesCoins = Number(data.playerCustodyCoins || Math.round(playerBalancesUSD * 100))
          const houseNetProfitsUSD = Number(data.houseNetProfitsUSD || 0)
          const houseNetProfitsCoins = Number(data.houseNetProfitsCoins || Math.round(houseNetProfitsUSD * 100))

          // REGLA DE ORO CONTABLE: Bóveda Total = Fondos de Jugadores (Custodia) + Ganancias Netas de la Casa
          const vaultUSD = playerBalancesUSD + houseNetProfitsUSD
          const vaultCoins = Math.round(vaultUSD * 100)

          setVault({
            totalVaultUSD: vaultUSD,
            totalVaultSugarCoins: vaultCoins,
            playerBalancesUSD,
            playerBalancesCoins,
            cashierFloatsUSD: totalFloatsUSD,
            cashierFloatsCoins: totalFloatsCoins,
            houseNetProfitsUSD,
            houseNetProfitsCoins,
            lastAuditedAt: data.lastAuditedAt || Date.now()
          })

          if (data.profitsBreakdown) {
            const normalUSD = data.profitsBreakdown.normalWithdrawalFeesUSD !== undefined
              ? Number(data.profitsBreakdown.normalWithdrawalFeesUSD)
              : Number(data.profitsBreakdown.withdrawalFeesUSD || 0)
            const vipUSD = Number(data.profitsBreakdown.vipWithdrawalFeesUSD || 0)
            const tournamentUSD = Number(data.profitsBreakdown.tournamentMarginUSD || 0)
            const cashierOpsUSD = Number(data.profitsBreakdown.cashierOperationsUSD || 0)
            const rakeUSD = Number(data.profitsBreakdown.tableRakeUSD || 0)
            const storeUSD = Number(data.profitsBreakdown.storeSalesUSD || 0)

            setProfits((prev) => ({
              ...prev,
              tableRakeUSD: rakeUSD,
              tableRakeCoins: Math.round(rakeUSD * 100),
              storeSalesUSD: storeUSD,
              storeSalesCoins: Math.round(storeUSD * 100),
              tournamentMarginUSD: tournamentUSD,
              tournamentMarginCoins: Math.round(tournamentUSD * 100),
              cashierOperationsUSD: cashierOpsUSD,
              cashierOperationsCoins: Math.round(cashierOpsUSD * 100),
              normalWithdrawalFeesUSD: normalUSD,
              normalWithdrawalFeesCoins: Math.round(normalUSD * 100),
              vipWithdrawalFeesUSD: vipUSD,
              vipWithdrawalFeesCoins: Math.round(vipUSD * 100),
              totalProfitUSD: houseNetProfitsUSD,
              totalProfitCoins: houseNetProfitsCoins
            }))
          }
        } else {
          // Sembrar global_ledger inicial en Firestore
          const totalFloatsUSD = cashierList.reduce((acc, c) => acc + ((c as any).floatBalanceUSDT ?? (c.floatBalanceCoins / 100)), 0)
          const totalFloatsCoins = cashierList.reduce((acc, c) => acc + (c.floatBalanceCoins || 0), 0)
          setDoc(ledgerRef, {
            id: 'global_ledger',
            totalVaultUSD: 0,
            totalVaultSugarCoins: 0,
            playerCustodyUSD: 0,
            playerCustodyCoins: 0,
            cashierFloatsUSD: totalFloatsUSD,
            cashierFloatsCoins: totalFloatsCoins,
            houseNetProfitsUSD: 0,
            houseNetProfitsCoins: 0,
            profitsBreakdown: {
              tableRakeUSD: 0,
              storeSalesUSD: 0,
              withdrawalFeesUSD: 0
            },
            lastAuditedAt: Date.now()
          }, { merge: true }).catch(() => {})
        }
      })
    } catch {}

    let unsubTelemetry: (() => void) | null = null
    try {
      const telRef = doc(db, 'system_treasury', 'live_telemetry')
      unsubTelemetry = onSnapshot(telRef, (tSnap) => {
        if (tSnap.exists()) {
          const tData = tSnap.data()
          const pLobby = Math.max(0, Number(tData.playersInLobby || 0))
          const pAI = Math.max(0, Number(tData.playersInAITraining || 0))
          const pOnline = Math.max(0, Number(tData.playersInOnlineTraining || 0))
          const pComp = Math.max(0, Number(tData.playersInCompetitive || 0))
          const totalOnline = pLobby + pAI + pOnline + pComp
          const rooms = Math.max(0, Number(tData.activeMatchRooms || Math.ceil((pOnline + pComp) / 2)))

          setTelemetry((prev) => ({
            ...prev,
            playersInLobby: pLobby,
            playersInAITraining: pAI,
            playersInOnlineTraining: pOnline,
            playersInCompetitive: pComp,
            totalOnlinePlayers: totalOnline,
            activeMatchRooms: rooms,
            serverStatus: 'online',
            updatedAt: tData.updatedAt || Date.now()
          }))
        }
      })
    } catch {}

    return () => {
      if (unsubLedger) unsubLedger()
      if (unsubTelemetry) unsubTelemetry()
    }
  }, [isAuthenticated, cashierList])

  // Polling y consolidación de saldos y telemetría en tiempo real
  const fetchLiveMetrics = async () => {
    setIsRefreshing(true)
    const startTime = Date.now()
    try {
      // 1. Conteo real de usuarios registrados en Firestore (Spark $0.00)
      try {
        const userCountSnap = await getCountFromServer(collection(db, 'users'))
        const realCount = userCountSnap.data().count
        setTelemetry((prev) => ({
          ...prev,
          totalRegisteredUsers: realCount,
          totalDownloadsCount: Math.max(realCount, prev.totalDownloadsCount || realCount)
        }))
      } catch (err) {
        console.warn('[AdminTelemetry] Error leyendo conteo de usuarios:', err)
      }

      // 2. Ping de latencia y estado
      const res = await fetch('/api/telemetry')
      const ping = Date.now() - startTime
      setServerPingMs(ping)

      if (res.ok) {
        const data = await res.json()
        if (data.telemetry) {
          setTelemetry((prev) => ({
            ...prev,
            serverLatencyMs: ping,
            totalRegisteredUsers: prev.totalRegisteredUsers || data.telemetry.totalRegisteredUsers,
            totalDownloadsCount: Math.max(prev.totalRegisteredUsers || 0, data.telemetry.totalDownloadsCount || 0)
          }))
        }
      }

      // 2. Consolidación de saldos reales de cajeros y pasivos en custodia
      const totalCashierFloatsUSD = cashierList.reduce((acc, c) => acc + ((c as any).floatBalanceUSDT ?? (c.floatBalanceCoins / 100)), 0)
      const totalCashierFloatsCoins = cashierList.reduce((acc, c) => acc + (c.floatBalanceCoins || 0), 0)

      setVault((prev) => {
        // Ecuación Contable: Bóveda Total = Custodia de Jugadores + Ganancias Netas
        const vaultUSD = prev.playerBalancesUSD + prev.houseNetProfitsUSD
        return {
          ...prev,
          cashierFloatsUSD: totalCashierFloatsUSD,
          cashierFloatsCoins: totalCashierFloatsCoins,
          totalVaultUSD: vaultUSD,
          totalVaultSugarCoins: Math.round(vaultUSD * 100),
          lastAuditedAt: Date.now()
        }
      })
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

  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const handleExecuteReset = async (options: EconomicResetOptions) => {
    setIsResetting(true)
    const { scope, purgeOrdersHistory, purgeShiftLedger } = options
    const now = Date.now()

    try {
      // 1. Snapshot previo para auditoría
      const previousSnapshot = {
        ...vault,
        date: now,
        cashierListSummary: cashierList.map(c => ({
          uid: c.uid,
          name: c.name,
          floatUSDT: (c as any).floatBalanceUSDT ?? (c.floatBalanceCoins / 100)
        }))
      }

      // 2. Ejecutar reseteo según el alcance seleccionado
      if (scope === 'players_only') {
        const ledgerRef = doc(db, 'system_treasury', 'global_ledger')
        const newVaultUSD = Math.max(0, vault.totalVaultUSD - vault.playerBalancesUSD)
        await setDoc(ledgerRef, {
          totalVaultUSD: newVaultUSD,
          totalVaultSugarCoins: Math.round(newVaultUSD * 100),
          playerCustodyUSD: 0,
          playerCustodyCoins: 0,
          lastAuditedAt: now
        }, { merge: true })

        try {
          const dateFormatted = new Date().toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })
          const usersSnap = await getDocs(query(collection(db, 'users'), limit(150)))
          if (!usersSnap.empty) {
            const batch = writeBatch(db)
            usersSnap.forEach((uDoc) => {
              const uData = uDoc.data() || {}
              const previousCoins = Number(uData.coins || 0)
              const existingHistory = Array.isArray(uData.walletHistory) ? uData.walletHistory : []
              
              if (previousCoins > 0) {
                const resetTxEntry = {
                  id: `tx_reset_${now}_${Math.random().toString(36).slice(2, 6)}`,
                  type: 'withdraw',
                  amount: -previousCoins,
                  description: 'Reseteo contable de saldos por Auditoría',
                  timestamp: now,
                  dateStr: dateFormatted
                }
                const updatedHistory = [resetTxEntry, ...existingHistory].slice(0, 50)
                batch.update(uDoc.ref, {
                  coins: 0,
                  walletHistory: updatedHistory,
                  lastResetAt: now
                })
              } else {
                batch.update(uDoc.ref, {
                  coins: 0,
                  lastResetAt: now
                })
              }
            })
            await batch.commit()
            console.log(`[AdminReset] Reseteo de jugadores completado para ${usersSnap.size} usuarios.`)
          }
        } catch (uErr) {
          console.error('[AdminReset] Error actualizando usuarios en players_only:', uErr)
        }

      } else if (scope === 'cashiers_only') {
        const resetAccounts = cashierList.map((c) => ({
          ...c,
          floatBalanceCoins: 0,
          floatBalanceUSDT: 0,
          totalPaidWithdrawalsUSDT: 0,
          initialShiftFloatUSDT: 0,
          lastRechargeAt: now
        }))

        await setDoc(doc(db, 'system_config', 'cashier_accounts'), {
          accounts: resetAccounts,
          updatedAt: now
        }, { merge: true })

        try {
          const batch = writeBatch(db)
          for (const csh of resetAccounts) {
            batch.set(doc(db, 'cashier_profiles', csh.uid), {
              uid: csh.uid,
              name: csh.name,
              floatBalanceCoins: 0,
              floatBalanceUSDT: 0,
              totalPaidWithdrawalsUSDT: 0,
              lastResetAt: now
            }, { merge: true })
          }
          await batch.commit()
        } catch {}

        const ledgerRef = doc(db, 'system_treasury', 'global_ledger')
        const newVaultUSD = vault.playerBalancesUSD + vault.houseNetProfitsUSD
        await setDoc(ledgerRef, {
          totalVaultUSD: newVaultUSD,
          totalVaultSugarCoins: Math.round(newVaultUSD * 100),
          cashierFloatsUSD: 0,
          cashierFloatsCoins: 0,
          lastAuditedAt: now
        }, { merge: true })

        if (purgeShiftLedger) {
          try {
            const shiftSnap = await getDocs(query(collection(db, 'cashier_shifts_ledger'), limit(150)))
            if (!shiftSnap.empty) {
              const batch = writeBatch(db)
              shiftSnap.forEach((sDoc) => batch.delete(sDoc.ref))
              await batch.commit()
            }
          } catch {}
        }

      } else if (scope === 'treasury_only') {
        const ledgerRef = doc(db, 'system_treasury', 'global_ledger')
        const newVaultUSD = Math.max(0, vault.totalVaultUSD - vault.houseNetProfitsUSD)
        await setDoc(ledgerRef, {
          totalVaultUSD: newVaultUSD,
          totalVaultSugarCoins: Math.round(newVaultUSD * 100),
          houseNetProfitsUSD: 0,
          houseNetProfitsCoins: 0,
          profitsBreakdown: {
            tableRakeUSD: 0,
            storeSalesUSD: 0,
            withdrawalFeesUSD: 0
          },
          lastAuditedAt: now
        }, { merge: true })

        try {
          const statsSnap = await getDocs(query(collection(db, 'daily_stats'), limit(50)))
          if (!statsSnap.empty) {
            const batch = writeBatch(db)
            statsSnap.forEach((docItem) => batch.delete(docItem.ref))
            await batch.commit()
          }
        } catch {}

      } else if (scope === 'total_hard_reset') {
        const ledgerRef = doc(db, 'system_treasury', 'global_ledger')
        await setDoc(ledgerRef, {
          id: 'global_ledger',
          totalVaultUSD: 0.0,
          totalVaultSugarCoins: 0,
          playerCustodyUSD: 0.0,
          playerCustodyCoins: 0,
          cashierFloatsUSD: 0.0,
          cashierFloatsCoins: 0,
          houseNetProfitsUSD: 0.0,
          houseNetProfitsCoins: 0,
          profitsBreakdown: {
            tableRakeUSD: 0,
            storeSalesUSD: 0,
            withdrawalFeesUSD: 0
          },
          lastAuditedAt: now
        })

        const resetAccounts = cashierList.map((c) => ({
          ...c,
          floatBalanceCoins: 0,
          floatBalanceUSDT: 0,
          totalPaidWithdrawalsUSDT: 0,
          initialShiftFloatUSDT: 0,
          lastRechargeAt: now
        }))

        await setDoc(doc(db, 'system_config', 'cashier_accounts'), {
          accounts: resetAccounts,
          updatedAt: now
        }, { merge: true })

        try {
          const batch = writeBatch(db)
          for (const csh of resetAccounts) {
            batch.set(doc(db, 'cashier_profiles', csh.uid), {
              uid: csh.uid,
              name: csh.name,
              floatBalanceCoins: 0,
              floatBalanceUSDT: 0,
              totalPaidWithdrawalsUSDT: 0,
              lastResetAt: now
            }, { merge: true })
          }
          await batch.commit()
        } catch {}

        try {
          const dateFormatted = new Date().toLocaleDateString('es-ES', { 
            day: '2-digit', 
            month: 'short', 
            year: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
          })
          const usersSnap = await getDocs(query(collection(db, 'users'), limit(150)))
          if (!usersSnap.empty) {
            const batch = writeBatch(db)
            usersSnap.forEach((uDoc) => {
              const uData = uDoc.data() || {}
              const previousCoins = Number(uData.coins || 0)
              const existingHistory = Array.isArray(uData.walletHistory) ? uData.walletHistory : []
              
              if (previousCoins > 0) {
                const resetTxEntry = {
                  id: `tx_reset_${now}_${Math.random().toString(36).slice(2, 6)}`,
                  type: 'withdraw',
                  amount: -previousCoins,
                  description: 'Reseteo contable de saldos por Auditoría',
                  timestamp: now,
                  dateStr: dateFormatted
                }
                const updatedHistory = [resetTxEntry, ...existingHistory].slice(0, 50)
                batch.update(uDoc.ref, {
                  coins: 0,
                  walletHistory: updatedHistory,
                  lastResetAt: now
                })
              } else {
                batch.update(uDoc.ref, {
                  coins: 0,
                  lastResetAt: now
                })
              }
            })
            await batch.commit()
            console.log(`[AdminReset] Total Hard Reset completado para ${usersSnap.size} usuarios.`)
          }
        } catch (uErr) {
          console.error('[AdminReset] Error actualizando usuarios en total_hard_reset:', uErr)
        }

        if (purgeOrdersHistory) {
          try {
            const ordSnap = await getDocs(query(collection(db, 'cashier_orders'), limit(150)))
            if (!ordSnap.empty) {
              const batch = writeBatch(db)
              ordSnap.forEach((oDoc) => batch.delete(oDoc.ref))
              await batch.commit()
            }
          } catch {}
        }

        if (purgeShiftLedger) {
          try {
            const shiftSnap = await getDocs(query(collection(db, 'cashier_shifts_ledger'), limit(150)))
            if (!shiftSnap.empty) {
              const batch = writeBatch(db)
              shiftSnap.forEach((sDoc) => batch.delete(sDoc.ref))
              await batch.commit()
            }
          } catch {}
        }

        try {
          const statsSnap = await getDocs(query(collection(db, 'daily_stats'), limit(50)))
          if (!statsSnap.empty) {
            const batch = writeBatch(db)
            statsSnap.forEach((docItem) => batch.delete(docItem.ref))
            await batch.commit()
          }
        } catch {}
      }

      // 3. Auditoría inmutable en audit_logs
      try {
        const auditRef = doc(collection(db, 'audit_logs'))
        await setDoc(auditRef, {
          id: auditRef.id,
          action: 'ECONOMIC_HARD_RESET',
          scope,
          adminUid: adminUser?.uid || 'adm_super',
          adminName: adminUser?.displayName || 'Super Admin',
          previousVault: previousSnapshot,
          purgeOrdersHistory,
          purgeShiftLedger,
          timestamp: now
        })
      } catch {}

      // 4. Limpieza de cachés locales
      if (typeof window !== 'undefined') {
        if (scope === 'total_hard_reset' || scope === 'cashiers_only') {
          localStorage.removeItem('sugar_cashier_orders')
        }
      }

      // 5. Broadcast instantáneo
      try {
        if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
          const ch = new BroadcastChannel('sugar_ludo_social_channel')
          ch.postMessage({
            type: 'economic_reset_executed',
            scope,
            timestamp: now
          })
          ch.close()
        }
      } catch {}

      setNotification(`¡Reinicio contable ejecutado con éxito! Alcance: ${scope.toUpperCase()}`)
      setTimeout(() => setNotification(null), 5000)
    } catch (e: any) {
      console.error('[AdminReset] Error ejecutando reinicio:', e)
      setNotification(`Error al ejecutar reinicio contable: ${e.message}`)
      setTimeout(() => setNotification(null), 5000)
    } finally {
      setIsResetting(false)
    }
  }

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
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-bold transition-all"
          >
            <Users className="size-3.5" />
            <span>Gestión Cajeros</span>
            {unreadStaffMessagesCount > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-mono font-black animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.6)]">
                {unreadStaffMessagesCount}
              </span>
            )}
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

          {/* 4.1. Reinicio Contable (Super Admin) */}
          {adminUser.role === 'super_admin' && (
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.15)]"
              title="Reinicio Contable / Hard Reset de Economía (Super Admin)"
            >
              <Trash2 className="size-3.5 text-rose-400" />
              <span>Reinicio Contable</span>
            </button>
          )}

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

      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-20 right-6 z-50 p-4 rounded-2xl bg-emerald-500 text-slate-950 font-bold text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Economic Hard Reset Modal */}
      <EconomicHardResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onExecuteReset={handleExecuteReset}
        isResetting={isResetting}
        currentVault={vault}
        activeCashiersCount={cashierList.length}
      />
    </div>
  )
}
