'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAdminAuth } from '../../../lib/admin-auth-context'
import { db } from '../../../lib/firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { MOCK_REAL_STORE_CATALOG } from '../../../lib/mock-treasury'
import {
  MOCK_REAL_COMPETITIVE_MATRIX,
  MOCK_COIN_PACKAGES,
  MOCK_REAL_GAME_TOURNAMENTS,
  MOCK_SEASON_RANKING
} from '../../../lib/mock-admin-expanded'
import { StoreItemPriceConfig } from '../../../types/treasury'
import {
  CompetitiveTierRealConfig,
  CoinPackageConfig,
  RealGameTournamentConfig,
  SeasonRankingConfig
} from '../../../types/admin-expanded'
import { CompetitiveRakeMatrix } from '../../../components/admin/CompetitiveRakeMatrix'
import { StorePackagesEditor } from '../../../components/admin/StorePackagesEditor'
import { EmotesPriceEditor } from '../../../components/admin/EmotesPriceEditor'
import { XpMultipliersEditor } from '../../../components/admin/XpMultipliersEditor'
import { EventsAndRankingAccordion } from '../../../components/admin/EventsAndRankingAccordion'
import { ScheduleUpdateModal } from '../../../components/admin/ScheduleUpdateModal'
import { AccordionBlock } from '../../../components/ui/AccordionBlock'
import { ArrowLeft, ShoppingBag, Coins, Percent, Save, CheckCircle, Flame, Tag, Calendar, Zap, Search, SlidersHorizontal, Sparkles, Smile, Trophy, Crown, Clock, User, LogOut } from 'lucide-react'
import { clsx } from 'clsx'

export default function EconomiaAdminPage() {
  const router = useRouter()
  const { adminUser, isAuthenticated, isLoading, logout } = useAdminAuth()

  // 100% Catálogo Real del Juego
  const [items, setItems] = useState<StoreItemPriceConfig[]>(MOCK_REAL_STORE_CATALOG)
  
  // Matriz Real del Modo Competitivo (Sugar-Ludo/components/competitive-training.tsx)
  const [competitiveMatrix, setCompetitiveMatrix] = useState<CompetitiveTierRealConfig[]>(MOCK_REAL_COMPETITIVE_MATRIX)
  const [packages, setPackages] = useState<CoinPackageConfig[]>(MOCK_COIN_PACKAGES)
  
  // Real Game Tournaments & Season Ranking State
  const [tournaments, setTournaments] = useState<RealGameTournamentConfig[]>(MOCK_REAL_GAME_TOURNAMENTS)
  const [seasonRanking, setSeasonRanking] = useState<SeasonRankingConfig>(MOCK_SEASON_RANKING)

  // XP and Event Multipliers State
  const [goldRushMultiplier, setGoldRushMultiplier] = useState(2.0)
  const [doubleXpActive, setDoubleXpActive] = useState(false)
  const [tournamentBonusPct, setTournamentBonusPct] = useState(10)
  
  // Withdrawal Fees State (Con tiempos reales corregidos: 48h Normal y 12h VIP)
  const [normalFee, setNormalFee] = useState(5.0)
  const [vipFee, setVipFee] = useState(10.0)

  // Search & Catalog Filter State
  const [catalogFilterTab, setCatalogFilterTab] = useState<'all' | 'currency' | 'cosmetics' | 'emotes' | 'boosters'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Mode and Modals State
  const [applyMode, setApplyMode] = useState<'realtime' | 'scheduled'>('realtime')
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false)
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
        Cargando control de economía...
      </div>
    )
  }

  const handlePriceChange = (id: string, newCoins: number) => {
    setItems((prev: StoreItemPriceConfig[]) =>
      prev.map((it: StoreItemPriceConfig) =>
        it.id === id
          ? { ...it, priceCoins: newCoins, priceUSDT: Number((newCoins / 100).toFixed(2)) }
          : it
      )
    )
  }

  const handleUpdateCompetitiveTier = (
    playerCount: number,
    newEntryFeeSC: number,
    newPrizesSC: number[]
  ) => {
    setCompetitiveMatrix((prev) =>
      prev.map((tier) => {
        if (tier.playerCount === playerCount) {
          const potSC = newEntryFeeSC * playerCount
          const prizeSum = newPrizesSC.reduce((a, b) => a + b, 0)
          const houseRakeSC = potSC - prizeSum
          const rakePercent = potSC > 0 ? Number(((houseRakeSC / potSC) * 100).toFixed(1)) : 0
          return {
            ...tier,
            entryFeeSC: newEntryFeeSC,
            potSC,
            prizesSC: newPrizesSC,
            houseRakeSC,
            rakePercent
          }
        }
        return tier
      })
    )
  }

  const handleUpdatePackage = (id: string, newPrice: number, newCoins: number, newBonus: number) => {
    setPackages((prev: CoinPackageConfig[]) =>
      prev.map((pkg: CoinPackageConfig) =>
        pkg.id === id
          ? { ...pkg, priceUSDT: newPrice, coinsAmount: newCoins, bonusCoins: newBonus }
          : pkg
      )
    )
  }

  const handleUpdateTournament = (
    id: string,
    updates: Partial<RealGameTournamentConfig>
  ) => {
    setTournaments((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    )
  }

  const handleRestartSeasonCycle = async () => {
    const nextSeasonNum = (seasonRanking.seasonNumber || 1) + 1
    const durationDays = seasonRanking.durationDays || 7
    const now = Date.now()
    const endTimestamp = now + durationDays * 86400000

    const updatedSeason: SeasonRankingConfig = {
      ...seasonRanking,
      seasonNumber: nextSeasonNum,
      seasonName: `Temporada ${nextSeasonNum} - Galáctica`,
      seasonStartedAt: now,
      endTimestamp,
      isActive: true
    }

    setSeasonRanking(updatedSeason)

    try {
      const docRef = doc(db, 'system_config', 'economy_settings')
      await setDoc(docRef, { seasonRanking: updatedSeason, updatedAt: now }, { merge: true })
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('sugar_ludo_social_channel')
        channel.postMessage({
          type: 'economy_settings_updated',
          payload: { seasonRanking: updatedSeason, updatedAt: now }
        })
        channel.close()
      }
      setNotification(`¡Arrancó la Temporada ${nextSeasonNum}! Ciclo de ${durationDays} días iniciado en vivo.`)
      setTimeout(() => setNotification(null), 4000)
    } catch (e: any) {
      console.error('[Economia] Error reiniciando ciclo de temporada:', e)
    }
  }

  const handleUpdateSeasonRanking = (
    durationDays: number,
    firstSC: number,
    secondSC: number,
    thirdSC: number
  ) => {
    setSeasonRanking((prev) => ({
      ...prev,
      durationDays,
      firstPlacePrizeSC: firstSC,
      secondPlacePrizeSC: secondSC,
      thirdPlacePrizeSC: thirdSC
    }))
  }

  // Cargar configuración guardada al montar
  useEffect(() => {
    const loadSavedEconomy = async () => {
      // 1. Intentar cargar directamente desde Firestore (system_config/economy_settings)
      try {
        const snap = await getDoc(doc(db, 'system_config', 'economy_settings'))
        if (snap.exists()) {
          const cfg = snap.data()
          if (cfg.items) setItems(cfg.items)
          if (cfg.competitiveMatrix) setCompetitiveMatrix(cfg.competitiveMatrix)
          if (cfg.packages) setPackages(cfg.packages)
          if (cfg.tournaments) setTournaments(cfg.tournaments)
          if (cfg.seasonRanking) setSeasonRanking(cfg.seasonRanking)
          if (cfg.goldRushMultiplier) setGoldRushMultiplier(cfg.goldRushMultiplier)
          if (cfg.doubleXpActive !== undefined) setDoubleXpActive(cfg.doubleXpActive)
          if (cfg.tournamentBonusPct) setTournamentBonusPct(cfg.tournamentBonusPct)
          if (cfg.normalFee) setNormalFee(cfg.normalFee)
          if (cfg.vipFee) setVipFee(cfg.vipFee)
          return
        }
      } catch (err) {
        console.warn('Fallback a API local de economía:', err)
      }

      // 2. Fallback a API
      try {
        const res = await fetch('/api/economy/config')
        if (res.ok) {
          const data = await res.json()
          if (data.config) {
            if (data.config.items) setItems(data.config.items)
            if (data.config.competitiveMatrix) setCompetitiveMatrix(data.config.competitiveMatrix)
            if (data.config.packages) setPackages(data.config.packages)
            if (data.config.tournaments) setTournaments(data.config.tournaments)
            if (data.config.seasonRanking) setSeasonRanking(data.config.seasonRanking)
            if (data.config.goldRushMultiplier) setGoldRushMultiplier(data.config.goldRushMultiplier)
            if (data.config.doubleXpActive !== undefined) setDoubleXpActive(data.config.doubleXpActive)
            if (data.config.tournamentBonusPct) setTournamentBonusPct(data.config.tournamentBonusPct)
            if (data.config.normalFee) setNormalFee(data.config.normalFee)
            if (data.config.vipFee) setVipFee(data.config.vipFee)
          }
        }
      } catch (err) {
        console.warn('Usando configuración base:', err)
      }
    }
    if (isAuthenticated) {
      loadSavedEconomy()
    }
  }, [isAuthenticated])

  const handleSave = async () => {
    if (applyMode === 'scheduled') {
      setIsScheduleModalOpen(true)
      return
    }

    const payload = {
      items,
      competitiveMatrix,
      packages,
      tournaments,
      seasonRanking,
      goldRushMultiplier,
      doubleXpActive,
      tournamentBonusPct,
      normalFee,
      vipFee,
      updatedAt: Date.now()
    }

    // 1. Guardar en localStorage para persistencia local del navegador
    localStorage.setItem('sugar_global_economy_config', JSON.stringify(payload))

    // 2. Guardar DIRECTAMENTE en Firebase Firestore (system_config/economy_settings)
    try {
      const configDocRef = doc(db, 'system_config', 'economy_settings')
      await setDoc(configDocRef, payload, { merge: true })
      console.log('[EconomiaAdmin] Configuración guardada en Firestore exitosamente.')
    } catch (e) {
      console.error('[EconomiaAdmin] Error guardando en Firestore:', e)
    }

    // 3. Notificar por BroadcastChannel para sincronización inmediata (0 ms) en el juego
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        const channel = new BroadcastChannel('sugar_ludo_social_channel')
        channel.postMessage({
          type: 'economy_settings_updated',
          payload
        })
        channel.close()
      }
    } catch {}

    // 4. Transmitir por API global
    try {
      await fetch('/api/economy/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      setNotification('✨ ¡Precios del catálogo, comisiones y modo competitivo guardados y sincronizados en TIEMPO REAL!')
    } catch {
      setNotification('✨ ¡Configuración guardada en la base de datos con éxito!')
    }
    setTimeout(() => setNotification(null), 4500)
  }

  const handleConfirmSchedule = (date: string, time: string) => {
    const payload = {
      items,
      competitiveMatrix,
      packages,
      tournaments,
      seasonRanking,
      goldRushMultiplier,
      doubleXpActive,
      tournamentBonusPct,
      normalFee,
      vipFee,
      scheduledFor: `${date} ${time}`,
      updatedAt: Date.now()
    }
    localStorage.setItem('sugar_scheduled_economy_config', JSON.stringify(payload))
    setNotification(`¡Actualización programada con éxito para el ${date} a las ${time} hrs!`)
    setTimeout(() => setNotification(null), 5000)
  }

  // Segmentación del catálogo real
  const boardsList = items.filter((i) => i.category === 'board')
  const tokensList = items.filter((i) => i.category === 'token')
  const diceList = items.filter((i) => i.category === 'dice')
  const emotesList = items.filter((i) => i.category === 'emote')
  const boostersList = items.filter((i) => i.category === 'booster')

  const filteredCosmetics = items.filter((item) => {
    if (searchQuery.trim()) {
      return item.name.toLowerCase().includes(searchQuery.toLowerCase())
    }
    return true
  })

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
              <ShoppingBag className="size-5 text-pink-400" /> CONTROL DE ECONOMÍA
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">
              admin.sugarludo.com &bull; Modo Competitivo (Buy-in / Premios / Rake), Comisiones y Catálogo Real
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

      {/* Main Container - 3 Grandes Acordeones Modulares */}
      <main className="flex-1 p-6 max-w-7xl mx-auto w-full space-y-5">
        {/* Top Mode Selector & Save Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/60 border border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-400 font-bold uppercase">Modo de Aplicación:</span>
            <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-white/5 text-xs font-bold">
              <button
                onClick={() => setApplyMode('realtime')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  applyMode === 'realtime' ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Zap className="size-3.5" />
                <span>Tiempo Real</span>
              </button>
              <button
                onClick={() => setApplyMode('scheduled')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  applyMode === 'scheduled' ? 'bg-purple-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="size-3.5" />
                <span>Programada</span>
              </button>
            </div>
          </div>

          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer"
          >
            <Save className="size-4" />
            <span>Guardar y Aplicar</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* ACORDEÓN 1: REGLAS ECONÓMICAS, RAKE Y COMISIONES                          */}
        {/* ========================================================================= */}
        <AccordionBlock
          id="economic-rules"
          title="REGLAS ECONÓMICAS, RAKE Y COMISIONES"
          subtitle="Modo Competitivo (Buy-in / Premios en SC) y porcentajes de cobro por retiro de fondos"
          icon={<Percent className="size-5 text-emerald-400" />}
          badgeSummary={
            <div className="flex items-center gap-2 font-mono">
              <span className="text-emerald-400 font-bold">2J a 6J Configurado</span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-pink-300 font-bold">Retiros: 5% (48h) / 10% (12h)</span>
            </div>
          }
          defaultOpen={true}
        >
          <div className="space-y-6">
            {/* Matriz de Rake y Premios en Modo Competitivo (2 a 6 Jugadores) */}
            <CompetitiveRakeMatrix
              matrix={competitiveMatrix}
              onUpdateTier={handleUpdateCompetitiveTier}
            />

            {/* Comisiones por Retiro (Tiempos reales: hasta 48h y hasta 12h) */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Percent className="size-4 text-pink-400" /> COMISIONES POR RETIRO DE FONDOS (WITHDRAWAL FEES)
                </h3>
                <span className="text-[10px] font-mono text-slate-400">Tiempos oficiales de procesamiento</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Normal Fee - 48h */}
                <div className="p-4 rounded-xl bg-slate-900 border border-cyan-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs text-cyan-400 font-bold">
                    <span className="flex items-center gap-1.5"><Clock className="size-3.5" /> Retiro Normal (Hasta 48 Horas)</span>
                    <span className="font-mono text-cyan-300">{normalFee}% Fee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={normalFee}
                      onChange={(e) => setNormalFee(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-base font-black text-white font-mono"
                    />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Procesamiento en horario regular bancario. Plazo máximo de liberación: <strong>48 horas</strong>.
                  </p>
                </div>

                {/* VIP Fee - 12h */}
                <div className="p-4 rounded-xl bg-slate-900 border border-pink-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs text-pink-400 font-bold">
                    <span className="flex items-center gap-1.5"><Zap className="size-3.5" /> Retiro VIP / Express (Hasta 12 Horas)</span>
                    <span className="font-mono text-pink-300">{vipFee}% Fee</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={vipFee}
                      onChange={(e) => setVipFee(parseFloat(e.target.value) || 0)}
                      className="w-24 bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-base font-black text-white font-mono"
                    />
                    <span className="text-xs font-bold text-slate-400">%</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Prioridad máxima en cola de cajeros. Plazo de liquidación garantizado: <strong>hasta 12 horas</strong>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AccordionBlock>

        {/* ========================================================================= */}
        {/* ACORDEÓN 2: EVENTOS Y PREMIOS DE RANKING / TEMPORADAS (REAL DEL JUEGO)    */}
        {/* ========================================================================= */}
        <AccordionBlock
          id="real-events-ranking"
          title="🏆 EVENTOS Y PREMIOS DE RANKING / TEMPORADAS"
          subtitle="Configuración de los 2 Torneos oficiales activos y bolsa de premios del Ranking Semanal por Copas"
          icon={<Trophy className="size-5 text-amber-400" />}
          badgeSummary={
            <div className="flex items-center gap-2 font-mono">
              <span className="text-amber-400 font-bold">2 Torneos Activos</span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-purple-300 font-bold">Temporada 1</span>
            </div>
          }
          defaultOpen={true}
        >
          <EventsAndRankingAccordion
            tournaments={tournaments}
            onUpdateTournament={handleUpdateTournament}
            seasonRanking={seasonRanking}
            onUpdateSeasonRanking={handleUpdateSeasonRanking}
            onRestartSeasonCycle={handleRestartSeasonCycle}
          />
        </AccordionBlock>

        {/* ========================================================================= */}
        {/* ACORDEÓN 3: CATÁLOGO GENERAL DE LA TIENDA (100% REAL DEL JUEGO)           */}
        {/* ========================================================================= */}
        <AccordionBlock
          id="store-catalog"
          title="CATÁLOGO GENERAL DE LA TIENDA"
          subtitle="Bóveda de Monedas, Aspectos (Tableros, Fichas, Dados 3D), Emotes y Boosters reales"
          icon={<ShoppingBag className="size-5 text-cyan-400" />}
          badgeSummary={
            <div className="flex items-center gap-2 font-mono">
              <span className="text-cyan-300 font-bold">{packages.length} Paquetes</span>
              <span className="text-slate-500">&bull;</span>
              <span className="text-pink-300 font-bold">{items.length} Items Reales</span>
            </div>
          }
          defaultOpen={true}
        >
          <div className="space-y-6">
            {/* Filter Tabs and Search Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-2 bg-slate-950 rounded-2xl border border-white/5">
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto text-xs font-bold">
                <button
                  onClick={() => setCatalogFilterTab('all')}
                  className={clsx('px-3.5 py-1.5 rounded-xl transition-all cursor-pointer', catalogFilterTab === 'all' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white')}
                >
                  Todo el Catálogo
                </button>
                <button
                  onClick={() => setCatalogFilterTab('currency')}
                  className={clsx('px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer', catalogFilterTab === 'currency' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white')}
                >
                  <Coins className="size-3.5" /> Bóveda SC ({packages.length})
                </button>
                <button
                  onClick={() => setCatalogFilterTab('cosmetics')}
                  className={clsx('px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer', catalogFilterTab === 'cosmetics' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'text-slate-400 hover:text-white')}
                >
                  <Tag className="size-3.5" /> Aspectos 3D ({boardsList.length + tokensList.length + diceList.length})
                </button>
                <button
                  onClick={() => setCatalogFilterTab('emotes')}
                  className={clsx('px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer', catalogFilterTab === 'emotes' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-slate-400 hover:text-white')}
                >
                  <Smile className="size-3.5" /> Emotes ({emotesList.length})
                </button>
                <button
                  onClick={() => setCatalogFilterTab('boosters')}
                  className={clsx('px-3.5 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer', catalogFilterTab === 'boosters' ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-400 hover:text-white')}
                >
                  <Sparkles className="size-3.5" /> Boosters XP ({boostersList.length})
                </button>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="size-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar item en el catálogo..."
                  className="w-full bg-slate-900 border border-white/10 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* 1. BÓVEDA DE MONEDAS: 5 PAQUETES REALES */}
            {(catalogFilterTab === 'all' || catalogFilterTab === 'currency') && (
              <StorePackagesEditor packages={packages} onUpdatePackage={handleUpdatePackage} />
            )}

            {/* 2. ASPECTOS: TABLEROS, FICHAS Y DADOS 3D REALES */}
            {(catalogFilterTab === 'all' || catalogFilterTab === 'cosmetics') && (
              <div className="space-y-4">
                {/* Tableros Reales */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-3">
                  <h4 className="text-xs font-black text-cyan-400 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="size-4" /> TABLEROS OFICIALES ({boardsList.length})
                  </h4>
                  <div className="divide-y divide-white/5">
                    {boardsList.map((item) => (
                      <div key={item.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.icon || '🏁'}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{item.name}</span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-cyan-500/10 text-cyan-300 font-mono uppercase font-bold">
                                {item.rarity}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">{item.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">Precio SC:</span>
                          <input
                            type="number"
                            value={item.priceCoins}
                            onChange={(e) => handlePriceChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-20 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-cyan-300 text-right"
                          />
                          <span className="text-xs font-mono font-bold text-white w-14 text-right">${item.priceUSDT.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Fichas / Skins Reales */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-3">
                  <h4 className="text-xs font-black text-pink-400 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="size-4" /> SKINS DE FICHAS ({tokensList.length})
                  </h4>
                  <div className="divide-y divide-white/5">
                    {tokensList.map((item) => (
                      <div key={item.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.icon || '⚪'}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{item.name}</span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-pink-500/10 text-pink-300 font-mono uppercase font-bold">
                                {item.rarity}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">{item.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">Precio SC:</span>
                          <input
                            type="number"
                            value={item.priceCoins}
                            onChange={(e) => handlePriceChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-20 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-pink-300 text-right"
                          />
                          <span className="text-xs font-mono font-bold text-white w-14 text-right">${item.priceUSDT.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dados 3D Reales */}
                <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-3">
                  <h4 className="text-xs font-black text-amber-400 uppercase tracking-wider flex items-center gap-2">
                    <Tag className="size-4" /> DADOS 3D CON EFECTOS ({diceList.length})
                  </h4>
                  <div className="divide-y divide-white/5">
                    {diceList.map((item) => (
                      <div key={item.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{item.icon || '🎲'}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white">{item.name}</span>
                              <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/10 text-amber-300 font-mono uppercase font-bold">
                                {item.rarity}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400">{item.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-slate-400">Precio SC:</span>
                          <input
                            type="number"
                            value={item.priceCoins}
                            onChange={(e) => handlePriceChange(item.id, parseInt(e.target.value) || 0)}
                            className="w-20 bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-amber-300 text-right"
                          />
                          <span className="text-xs font-mono font-bold text-white w-14 text-right">${item.priceUSDT.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* 3. EMOTES: 5 BASE GRATUITOS + 5 PREMIUM DE PAGO */}
            {(catalogFilterTab === 'all' || catalogFilterTab === 'emotes') && (
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Smile className="size-4 text-amber-400" /> EMOTES ANIMADOS (5 BASE GRATUITOS + 5 PREMIUM DE PAGO)
                </h4>
                <EmotesPriceEditor emotes={emotesList} onUpdateEmote={handlePriceChange} />
              </div>
            )}

            {/* 4. POTENCIADORES DE EXPERIENCIA (BOOSTERS REALES) */}
            {(catalogFilterTab === 'all' || catalogFilterTab === 'boosters') && (
              <div className="p-5 rounded-2xl bg-slate-950/80 border border-white/5 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Sparkles className="size-4 text-purple-400" /> POTENCIADORES DE XP & EVENTOS GLOBALES
                </h4>
                <XpMultipliersEditor
                  boosters={boostersList}
                  onUpdateBooster={handlePriceChange}
                  doubleXpActive={doubleXpActive}
                  onToggleDoubleXp={setDoubleXpActive}
                  goldRushMultiplier={goldRushMultiplier}
                  onChangeGoldRush={setGoldRushMultiplier}
                  tournamentBonusPct={tournamentBonusPct}
                  onChangeTournamentBonus={setTournamentBonusPct}
                />
              </div>
            )}
          </div>
        </AccordionBlock>
      </main>

      {/* Schedule Update Modal */}
      <ScheduleUpdateModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        onConfirmSchedule={handleConfirmSchedule}
      />
    </div>
  )
}
