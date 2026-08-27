'use client'

import React from 'react'
import { RealGameTournamentConfig, SeasonRankingConfig } from '../../types/admin-expanded'
import { Trophy, Crown, Clock, Flame, Users, Calendar, Coins, ShieldCheck } from 'lucide-react'

interface EventsAndRankingAccordionProps {
  tournaments: RealGameTournamentConfig[]
  onUpdateTournament: (
    id: string,
    newPotSC: number,
    newEntrySC: number,
    newDuration: string,
    firstPct: number,
    secondPct: number,
    thirdPct: number
  ) => void
  seasonRanking: SeasonRankingConfig
  onUpdateSeasonRanking: (
    durationDays: number,
    firstSC: number,
    secondSC: number,
    thirdSC: number
  ) => void
}

export function EventsAndRankingAccordion({
  tournaments,
  onUpdateTournament,
  seasonRanking,
  onUpdateSeasonRanking
}: EventsAndRankingAccordionProps) {
  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------------------- */}
      {/* 1. SECCIÓN: LOS 2 EVENTOS / TORNEOS OFICIALES DEL JUEGO               */}
      {/* --------------------------------------------------------------------- */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="size-4 text-amber-400" /> LOS 2 TORNEOS Y EVENTOS REALES DEL JUEGO
          </h4>
          <span className="text-[10px] font-mono text-slate-400">
            Sincronizado con <strong className="text-cyan-300">tournaments-service.ts</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {tournaments.map((tour) => (
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

              {/* Title & Rules */}
              <div>
                <h5 className="text-sm font-black text-white">{tour.title}</h5>
                <p className="text-[11px] text-slate-400 mt-0.5">{tour.subtitle}</p>
                <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-md bg-white/5 text-slate-300 font-mono">
                  {tour.rules}
                </span>
              </div>

              {/* Editable Pot, Entry Fee and Duration */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-white/5 text-xs">
                <div className="space-y-1">
                  <span className="text-[10px] text-amber-400 font-bold uppercase block">Pozo Total (SC)</span>
                  <input
                    type="number"
                    value={tour.potSC}
                    onChange={(e) =>
                      onUpdateTournament(
                        tour.id,
                        parseInt(e.target.value) || 0,
                        tour.entryFeeSC,
                        tour.endDate,
                        tour.firstPlacePct,
                        tour.secondPlacePct,
                        tour.thirdPlacePct
                      )
                    }
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-amber-300"
                  />
                  <span className="text-[10px] text-slate-500 font-mono block">${(tour.potSC / 100).toFixed(2)} USDT</span>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase block">Entrada (SC)</span>
                  <input
                    type="number"
                    value={tour.entryFeeSC}
                    onChange={(e) =>
                      onUpdateTournament(
                        tour.id,
                        tour.potSC,
                        parseInt(e.target.value) || 0,
                        tour.endDate,
                        tour.firstPlacePct,
                        tour.secondPlacePct,
                        tour.thirdPlacePct
                      )
                    }
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-300"
                  />
                  <span className="text-[10px] text-slate-500 font-mono block">${(tour.entryFeeSC / 100).toFixed(2)} USDT</span>
                </div>

                <div className="space-y-1 col-span-2 sm:col-span-1">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Duración / Estado</span>
                  <input
                    type="text"
                    value={tour.endDate}
                    onChange={(e) =>
                      onUpdateTournament(
                        tour.id,
                        tour.potSC,
                        tour.entryFeeSC,
                        e.target.value,
                        tour.firstPlacePct,
                        tour.secondPlacePct,
                        tour.thirdPlacePct
                      )
                    }
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs font-bold text-white"
                  />
                  <span className="text-[10px] text-slate-500 font-mono block">{tour.playersRegistered}/{tour.maxPlayers} Jugadores</span>
                </div>
              </div>

              {/* Podium Distribution (% 1°, 2°, 3°) */}
              <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 space-y-2">
                <span className="text-[10px] text-slate-400 font-bold uppercase block">
                  Distribución de Premios del Pozo ({tour.potSC.toLocaleString()} SC)
                </span>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <span className="text-[9px] text-amber-400 font-bold block">1° Lugar ({tour.firstPlacePct}%)</span>
                    <span className="font-mono font-black text-white text-xs">
                      {Math.round((tour.potSC * tour.firstPlacePct) / 100).toLocaleString()} SC
                    </span>
                  </div>
                  <div className="p-1.5 bg-slate-400/10 border border-slate-400/20 rounded-lg">
                    <span className="text-[9px] text-slate-300 font-bold block">2° Lugar ({tour.secondPlacePct}%)</span>
                    <span className="font-mono font-black text-white text-xs">
                      {Math.round((tour.potSC * tour.secondPlacePct) / 100).toLocaleString()} SC
                    </span>
                  </div>
                  <div className="p-1.5 bg-amber-700/10 border border-amber-700/20 rounded-lg">
                    <span className="text-[9px] text-amber-500 font-bold block">3° Lugar ({tour.thirdPlacePct}%)</span>
                    <span className="font-mono font-black text-white text-xs">
                      {Math.round((tour.potSC * tour.thirdPlacePct) / 100).toLocaleString()} SC
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* 2. SECCIÓN: TEMPORADAS Y RANKING COMPETITIVO POR COPAS                */}
      {/* --------------------------------------------------------------------- */}
      <div className="p-5 rounded-2xl bg-slate-950/90 border border-white/10 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Crown className="size-4" />
            </div>
            <div>
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                TEMPORADAS Y RANKING COMPETITIVO POR COPAS (LEADERBOARD)
              </h4>
              <p className="text-[10px] text-slate-400 font-mono">
                Ciclo competitivo de 7 días (reinicio domingos UTC) con premios en SC/USDT para el podio global
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-purple-950/40 border border-purple-500/30 px-3 py-1.5 rounded-xl text-xs">
            <Clock className="size-3.5 text-purple-300 animate-pulse" />
            <span className="font-bold text-white">{seasonRanking.seasonName}</span>
            <span className="text-slate-400">&bull;</span>
            <span className="text-purple-300 font-mono font-bold">{seasonRanking.timeRemainingFormatted}</span>
          </div>
        </div>

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
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-purple-300"
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
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-300"
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
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-slate-200"
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
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono font-bold text-amber-500"
            />
            <span className="text-[10px] text-slate-500 block">Acreditado al cierre del ciclo</span>
          </div>
        </div>
      </div>
    </div>
  )
}
