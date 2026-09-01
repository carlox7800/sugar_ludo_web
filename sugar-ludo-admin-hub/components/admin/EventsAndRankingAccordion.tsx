'use client'

import React, { useState, useEffect } from 'react'
import { RealGameTournamentConfig, SeasonRankingConfig } from '../../types/admin-expanded'
import { Trophy, Crown, Clock, Calendar, RotateCcw, Sparkles, CheckCircle2 } from 'lucide-react'

interface EventsAndRankingAccordionProps {
  tournaments: RealGameTournamentConfig[]
  onUpdateTournament: (
    id: string,
    updates: Partial<RealGameTournamentConfig>
  ) => void
  seasonRanking: SeasonRankingConfig
  onUpdateSeasonRanking: (
    durationDays: number,
    firstSC: number,
    secondSC: number,
    thirdSC: number
  ) => void
  onRestartSeasonCycle?: () => void
}

export function EventsAndRankingAccordion({
  tournaments,
  onUpdateTournament,
  seasonRanking,
  onUpdateSeasonRanking,
  onRestartSeasonCycle
}: EventsAndRankingAccordionProps) {
  // Live Countdown Synchronized with the Game App
  const [liveCountdown, setLiveCountdown] = useState('')
  const [isRestartConfirmOpen, setIsRestartConfirmOpen] = useState(false)

  useEffect(() => {
    const updateCountdown = () => {
      const now = Date.now()
      let remainingMs = 0
      if (seasonRanking.endTimestamp && seasonRanking.endTimestamp > now) {
        remainingMs = seasonRanking.endTimestamp - now
      } else {
        const nowDate = new Date()
        const dayOfWeek = nowDate.getUTCDay()
        const daysUntilSunday = (7 - dayOfWeek) % 7 || 7
        const nextSundayUTC = new Date(Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate() + daysUntilSunday, 0, 0, 0))
        remainingMs = Math.max(0, nextSundayUTC.getTime() - now)
      }

      const d = Math.floor(remainingMs / 86400000)
      const h = Math.floor((remainingMs % 86400000) / 3600000)
      const m = Math.floor((remainingMs % 3600000) / 60000)
      const s = Math.floor((remainingMs % 60000) / 1000)

      setLiveCountdown(d > 0 ? `${d}d ${h}h ${m}m restantes` : `${h}h ${m}m ${s}s restantes`)
    }

    updateCountdown()
    const timer = setInterval(updateCountdown, 1000)
    return () => clearInterval(timer)
  }, [seasonRanking.endTimestamp])

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------------------- */}
      {/* 1. SECCIÓN: CONTROL Y EDICIÓN DE LOS 2 TORNEOS OFICIALES DEL JUEGO    */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="size-4 text-amber-400" /> LOS 2 TORNEOS Y EVENTOS REALES DEL JUEGO
          </h4>
          <span className="text-[10px] font-mono text-slate-400">
            Sincronizado en tiempo real con la app oficial &bull; <strong className="text-cyan-300">tournaments-service.ts</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tournaments.map((tour) => {
            const firstPrizeSC = Math.round((tour.potSC * tour.firstPlacePct) / 100)
            const secondPrizeSC = Math.round((tour.potSC * tour.secondPlacePct) / 100)
            const thirdPrizeSC = Math.round((tour.potSC * tour.thirdPlacePct) / 100)

            return (
              <div
                key={tour.id}
                className="p-5 rounded-2xl bg-slate-950/90 border border-white/10 space-y-4 relative overflow-hidden"
              >
                {/* Top Badge & Duration */}
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-white/10 text-white border border-white/15">
                    {tour.badge}
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-400 flex items-center gap-1">
                    <Clock className="size-3.5 text-cyan-400" />
                    {tour.endDate}
                  </span>
                </div>

                {/* Editable Title & Subtitle */}
                <div className="space-y-2">
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Nombre del Torneo</span>
                    <input
                      type="text"
                      value={tour.title}
                      onChange={(e) => onUpdateTournament(tour.id, { title: e.target.value })}
                      placeholder="Título del Torneo"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-black text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Descripción / Subtítulo</span>
                    <input
                      type="text"
                      value={tour.subtitle}
                      onChange={(e) => onUpdateTournament(tour.id, { subtitle: e.target.value })}
                      placeholder="Descripción del Torneo"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                {/* Editable Pot, Entry Fee, Capacity and Duration */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-white/5 text-xs">
                  <div className="space-y-1">
                    <span className="text-[10px] text-amber-400 font-bold uppercase block">Pozo Total (SC)</span>
                    <input
                      type="number"
                      value={tour.potSC}
                      onChange={(e) => onUpdateTournament(tour.id, { potSC: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                    />
                    <span className="text-[10px] text-slate-500 font-mono block">${(tour.potSC / 100).toFixed(2)} USDT</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-cyan-400 font-bold uppercase block">Entrada (SC)</span>
                    <input
                      type="number"
                      value={tour.entryFeeSC}
                      onChange={(e) => onUpdateTournament(tour.id, { entryFeeSC: parseInt(e.target.value) || 0 })}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-400"
                    />
                    <span className="text-[10px] text-slate-500 font-mono block">${(tour.entryFeeSC / 100).toFixed(2)} USDT</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-emerald-400 font-bold uppercase block">Cupos Máx</span>
                    <input
                      type="number"
                      value={tour.maxPlayers}
                      onChange={(e) => onUpdateTournament(tour.id, { maxPlayers: parseInt(e.target.value) || 32 })}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-emerald-300 focus:outline-none focus:border-emerald-400"
                    />
                    <span className="text-[10px] text-slate-500 font-mono block">{tour.playersRegistered}/{tour.maxPlayers} Jug.</span>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Duración / Estado</span>
                    <input
                      type="text"
                      value={tour.endDate}
                      onChange={(e) => onUpdateTournament(tour.id, { endDate: e.target.value })}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-cyan-400"
                    />
                    <span className="text-[10px] text-slate-500 font-mono block truncate">Badge y Tiempo</span>
                  </div>
                </div>

                {/* Editable Podium Distribution (% & SC para 1°, 2°, 3°) */}
                <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Premios Podio del Pozo ({tour.potSC.toLocaleString()} SC &bull; ${(tour.potSC / 100).toFixed(2)} USDT)
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    {/* 1° Place */}
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg space-y-1">
                      <span className="text-[9px] text-amber-400 font-bold block">🥇 1° Lugar (%)</span>
                      <input
                        type="number"
                        value={tour.firstPlacePct}
                        onChange={(e) => onUpdateTournament(tour.id, { firstPlacePct: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-1.5 py-0.5 text-center text-xs font-mono font-bold text-amber-300"
                      />
                      <span className="font-mono font-black text-white text-[11px] block">
                        {firstPrizeSC.toLocaleString()} SC
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono block">
                        ${(firstPrizeSC / 100).toFixed(2)} USDT
                      </span>
                    </div>

                    {/* 2° Place */}
                    <div className="p-2 bg-slate-400/10 border border-slate-400/20 rounded-lg space-y-1">
                      <span className="text-[9px] text-slate-300 font-bold block">🥈 2° Lugar (%)</span>
                      <input
                        type="number"
                        value={tour.secondPlacePct}
                        onChange={(e) => onUpdateTournament(tour.id, { secondPlacePct: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-slate-400/30 rounded-lg px-1.5 py-0.5 text-center text-xs font-mono font-bold text-slate-200"
                      />
                      <span className="font-mono font-black text-white text-[11px] block">
                        {secondPrizeSC.toLocaleString()} SC
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono block">
                        ${(secondPrizeSC / 100).toFixed(2)} USDT
                      </span>
                    </div>

                    {/* 3° Place */}
                    <div className="p-2 bg-amber-700/10 border border-amber-700/20 rounded-lg space-y-1">
                      <span className="text-[9px] text-amber-500 font-bold block">🥉 3° Lugar (%)</span>
                      <input
                        type="number"
                        value={tour.thirdPlacePct}
                        onChange={(e) => onUpdateTournament(tour.id, { thirdPlacePct: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-amber-700/30 rounded-lg px-1.5 py-0.5 text-center text-xs font-mono font-bold text-amber-400"
                      />
                      <span className="font-mono font-black text-white text-[11px] block">
                        {thirdPrizeSC.toLocaleString()} SC
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono block">
                        ${(thirdPrizeSC / 100).toFixed(2)} USDT
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. SECCIÓN: TEMPORADAS Y RANKING COMPETITIVO POR COPAS                */}
      {/* --------------------------------------------------------------------- */}
      <div className="p-5 rounded-2xl bg-slate-950/90 border border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Crown className="size-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                TEMPORADAS Y RANKING COMPETITIVO POR COPAS (LEADERBOARD)
              </h4>
              <p className="text-[10px] text-slate-400 font-mono">
                Ciclo competitivo sincronizado en vivo entre panel y juego con premios en SC/USDT
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 bg-purple-950/40 border border-purple-500/30 px-3 py-1.5 rounded-xl text-xs">
              <Clock className="size-3.5 text-purple-300 animate-pulse" />
              <span className="font-bold text-white">{seasonRanking.seasonName}</span>
              <span className="text-slate-400">&bull;</span>
              <span className="text-purple-300 font-mono font-bold">{liveCountdown || seasonRanking.timeRemainingFormatted}</span>
            </div>

            {/* Botón para arrancar / reiniciar ciclo de temporada */}
            {onRestartSeasonCycle && (
              <button
                type="button"
                onClick={() => setIsRestartConfirmOpen(true)}
                className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                title="Reiniciar y arrancar un nuevo ciclo competitivo"
              >
                <RotateCcw className="size-3.5" />
                <span>Reiniciar Ciclo Temporada</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal de confirmación para reiniciar temporada */}
        {isRestartConfirmOpen && (
          <div className="p-4 rounded-xl bg-purple-950/60 border border-purple-500/40 space-y-3 animate-in fade-in">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-200">
              <Sparkles className="size-4 text-purple-400" />
              <span>¿Confirmar inicio de un nuevo ciclo de Temporada?</span>
            </div>
            <p className="text-[11px] text-purple-300/80 font-mono">
              Se incrementará el número de temporada a la Temporada {(seasonRanking.seasonNumber || 1) + 1}, se fijará el cronómetro a {seasonRanking.durationDays || 7} días en vivo y se notificará a todos los clientes del juego.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (onRestartSeasonCycle) onRestartSeasonCycle()
                  setIsRestartConfirmOpen(false)
                }}
                className="px-4 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-bold text-xs cursor-pointer shadow-md"
              >
                Sí, Arrancar Nuevo Ciclo 🚀
              </button>
              <button
                type="button"
                onClick={() => setIsRestartConfirmOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 font-bold text-xs cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Season Duration & Podium Reward Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-slate-900 border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 font-bold uppercase block flex items-center gap-1">
              <Calendar className="size-3.5 text-purple-400" /> Duración de Ciclo (Días)
            </span>
            <input
              type="number"
              value={seasonRanking.durationDays}
              onChange={(e) =>
                onUpdateSeasonRanking(
                  parseInt(e.target.value) || 7,
                  seasonRanking.firstPlacePrizeSC,
                  seasonRanking.secondPlacePrizeSC,
                  seasonRanking.thirdPlacePrizeSC
                )
              }
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-purple-300 focus:outline-none focus:border-purple-400"
            />
            <span className="text-[10px] text-slate-500 block">7 días estándar (Semanal)</span>
          </div>

          {/* 1st Place Global Podium */}
          <div className="p-4 rounded-xl bg-slate-900 border border-amber-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-400 font-bold uppercase block flex items-center gap-1">
                <Crown className="size-3.5 text-amber-400" /> Premio 1° Oro
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                ${(seasonRanking.firstPlacePrizeSC / 100).toFixed(2)} USDT
              </span>
            </div>
            <input
              type="number"
              value={seasonRanking.firstPlacePrizeSC}
              onChange={(e) =>
                onUpdateSeasonRanking(
                  seasonRanking.durationDays,
                  parseInt(e.target.value) || 0,
                  seasonRanking.secondPlacePrizeSC,
                  seasonRanking.thirdPlacePrizeSC
                )
              }
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
            />
            <span className="text-[10px] text-slate-500 block">Acreditado al cierre del ciclo</span>
          </div>

          {/* 2nd Place Global Podium */}
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-400/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-300 font-bold uppercase block">
                🥈 Premio 2° Plata
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                ${(seasonRanking.secondPlacePrizeSC / 100).toFixed(2)} USDT
              </span>
            </div>
            <input
              type="number"
              value={seasonRanking.secondPlacePrizeSC}
              onChange={(e) =>
                onUpdateSeasonRanking(
                  seasonRanking.durationDays,
                  seasonRanking.firstPlacePrizeSC,
                  parseInt(e.target.value) || 0,
                  seasonRanking.thirdPlacePrizeSC
                )
              }
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-200 focus:outline-none focus:border-slate-400"
            />
            <span className="text-[10px] text-slate-500 block">Acreditado al cierre del ciclo</span>
          </div>

          {/* 3rd Place Global Podium */}
          <div className="p-4 rounded-xl bg-slate-900 border border-amber-700/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-amber-500 font-bold uppercase block">
                🥉 Premio 3° Bronce
              </span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                ${(seasonRanking.thirdPlacePrizeSC / 100).toFixed(2)} USDT
              </span>
            </div>
            <input
              type="number"
              value={seasonRanking.thirdPlacePrizeSC}
              onChange={(e) =>
                onUpdateSeasonRanking(
                  seasonRanking.durationDays,
                  seasonRanking.firstPlacePrizeSC,
                  seasonRanking.secondPlacePrizeSC,
                  parseInt(e.target.value) || 0
                )
              }
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-500 focus:outline-none focus:border-amber-600"
            />
            <span className="text-[10px] text-slate-500 block">Acreditado al cierre del ciclo</span>
          </div>
        </div>
      </div>
    </div>
  )
}
