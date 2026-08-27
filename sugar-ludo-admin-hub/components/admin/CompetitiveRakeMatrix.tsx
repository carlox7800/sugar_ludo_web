'use client'

import React from 'react'
import { CompetitiveTierRealConfig } from '../../types/admin-expanded'
import { Percent, Users, Coins, Trophy, Flame } from 'lucide-react'

interface CompetitiveRakeMatrixProps {
  matrix: CompetitiveTierRealConfig[]
  onUpdateTier: (
    playerCount: number,
    newEntryFeeSC: number,
    newPrizesSC: number[]
  ) => void
}

export function CompetitiveRakeMatrix({ matrix, onUpdateTier }: CompetitiveRakeMatrixProps) {
  return (
    <div className="rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Trophy className="size-4 text-amber-400" /> MATRIZ DE RAKE Y PREMIOS EN MODO COMPETITIVO (2 A 6 JUGADORES)
          </h2>
          <p className="text-[11px] text-slate-400 font-mono">
            Sincronizado fielmente con ECONOMY_MATRIX de Sugar Ludo • Paridad: 100 SC = $1.00 USDT
          </p>
        </div>

        <div className="flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-950 border border-white/5 text-[11px] font-mono">
          <span className="text-slate-400">Rake Platform:</span>
          <strong className="text-emerald-400">Retenido Automáticamente</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {matrix.map((tier) => {
          const totalPrizeSum = tier.prizesSC.reduce((a, b) => a + b, 0)
          const currentPot = tier.entryFeeSC * tier.playerCount
          const currentHouseRake = currentPot - totalPrizeSum
          const currentRakePct = currentPot > 0 ? ((currentHouseRake / currentPot) * 100).toFixed(1) : '0'

          const handlePrizeChange = (index: number, val: number) => {
            const updatedPrizes = [...tier.prizesSC]
            updatedPrizes[index] = val
            onUpdateTier(tier.playerCount, tier.entryFeeSC, updatedPrizes)
          }

          const handleEntryChange = (val: number) => {
            onUpdateTier(tier.playerCount, val, tier.prizesSC)
          }

          return (
            <div
              key={tier.playerCount}
              className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-3 relative overflow-hidden"
            >
              {/* Top Header */}
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-cyan-400" /> {tier.playerCount} Jugadores
                </span>
                <span className="text-[10px] text-slate-400 font-mono">Mesa {tier.playerCount}J</span>
              </div>

              {/* Costo de Entrada (Buy-in por jugador) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase">Buy-in Entrada (SC)</span>
                  <span className="text-[9px] font-mono text-slate-400">
                    ${(tier.entryFeeSC / 100).toFixed(2)} USDT
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    value={tier.entryFeeSC}
                    onChange={(e) => handleEntryChange(parseInt(e.target.value) || 0)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1 text-xs font-mono font-bold text-cyan-300 text-center"
                  />
                  <span className="text-xs font-bold text-slate-400">SC</span>
                </div>
                <span className="text-[10px] text-slate-500 font-mono block">
                  Pozo Mesa: <strong>{currentPot} SC</strong> (${(currentPot / 100).toFixed(2)} USDT)
                </span>
              </div>

              {/* Premios Asignados a Ganadores */}
              <div className="pt-2 border-t border-white/5 space-y-2 text-xs">
                <span className="text-[10px] text-amber-400 font-bold uppercase block">
                  Premios Asignados
                </span>

                {tier.prizesSC.map((prize, idx) => {
                  const placeLabel = idx === 0 ? '1° Lugar' : idx === 1 ? '2° Lugar' : idx === 2 ? '3° Lugar' : '4° Lugar'
                  const colorClass = idx === 0 ? 'text-amber-300' : idx === 1 ? 'text-slate-300' : idx === 2 ? 'text-amber-600' : 'text-slate-400'

                  return (
                    <div key={idx} className="space-y-0.5">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className={`font-bold ${colorClass}`}>{placeLabel}:</span>
                        <span className="font-mono text-[9px] text-slate-500">
                          ${(prize / 100).toFixed(2)} USDT
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={prize}
                          onChange={(e) => handlePrizeChange(idx, parseInt(e.target.value) || 0)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-2 py-0.5 text-xs font-mono font-bold text-white text-right"
                        />
                        <span className="text-[10px] font-bold text-slate-500">SC</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Rake Resultante Calculado Automáticamente */}
              <div className="p-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/20 space-y-1 text-center">
                <span className="text-[9px] text-emerald-400 font-bold uppercase block">
                  Rake de la Casa (Calculado)
                </span>
                <div className="font-mono font-black text-xs text-emerald-300">
                  {currentHouseRake} SC ({currentRakePct}%)
                </div>
                <span className="text-[9px] font-mono text-slate-400 block">
                  Margen Casa: ${(currentHouseRake / 100).toFixed(2)} USDT
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
