'use client'

import React from 'react'
import { StoreItemPriceConfig } from '../../types/treasury'
import { Zap, Sparkles, Rocket, Clock, ShieldCheck, Flame } from 'lucide-react'

interface XpMultipliersEditorProps {
  boosters: StoreItemPriceConfig[]
  onUpdateBooster: (id: string, newCoins: number) => void
  doubleXpActive: boolean
  onToggleDoubleXp: (active: boolean) => void
  goldRushMultiplier: number
  onChangeGoldRush: (val: number) => void
  tournamentBonusPct: number
  onChangeTournamentBonus: (val: number) => void
}

export function XpMultipliersEditor({
  boosters,
  onUpdateBooster,
  doubleXpActive,
  onToggleDoubleXp,
  goldRushMultiplier,
  onChangeGoldRush,
  tournamentBonusPct,
  onChangeTournamentBonus
}: XpMultipliersEditorProps) {
  const realBoosters = boosters.filter((b) => b.category === 'booster')

  return (
    <div className="space-y-6">
      {/* 1. Potenciadores Reales de la Tienda */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
            <Zap className="size-4 text-cyan-400" /> POTENCIADORES DE XP REALES (CATÁLOGO OFICIAL)
          </span>
          <span className="text-[10px] font-mono text-slate-400">Precios editables en SC y USDT</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {realBoosters.map((item) => (
            <div key={item.id} className="p-4 rounded-2xl bg-slate-950/90 border border-purple-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-2xl">{item.icon || '⚡'}</span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 font-mono font-bold uppercase">
                  {item.rarity || 'Booster'}
                </span>
              </div>

              <div>
                <h5 className="font-bold text-xs text-white truncate">{item.name}</h5>
                <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{item.description}</p>
              </div>

              <div className="pt-2 border-t border-white/5 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Costo SC:</span>
                  <input
                    type="number"
                    value={item.priceCoins}
                    onChange={(e) => onUpdateBooster(item.id, parseInt(e.target.value) || 0)}
                    className="w-20 bg-slate-900 border border-white/10 rounded-xl px-2 py-1 text-xs font-mono font-bold text-cyan-300 text-right"
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Equivalente:</span>
                  <span className="font-bold text-emerald-400">${item.priceUSDT.toFixed(2)} USDT</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Interruptores Globales de Eventos en Vivo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-white/5">
        {/* Doble XP Switch */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-purple-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-purple-400 font-bold uppercase">
            <span className="flex items-center gap-1.5"><Sparkles className="size-4" /> Doble XP Global</span>
            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${doubleXpActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}`}>
              {doubleXpActive ? 'ACTIVO (2x)' : 'INACTIVO'}
            </span>
          </div>
          <p className="text-[10px] text-slate-400">Multiplica por 2 la experiencia en todas las partidas.</p>
          <button
            onClick={() => onToggleDoubleXp(!doubleXpActive)}
            className={`w-full py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              doubleXpActive ? 'bg-purple-600 hover:bg-purple-500 text-white' : 'bg-white/5 hover:bg-white/10 text-slate-300'
            }`}
          >
            {doubleXpActive ? 'Desactivar Doble XP' : 'Activar Doble XP Global'}
          </button>
        </div>

        {/* Fiebre del Oro */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-400 font-bold uppercase">
            <span className="flex items-center gap-1.5"><Flame className="size-4" /> Fiebre del Oro</span>
            <span className="text-[10px] font-mono text-amber-300 font-bold">{goldRushMultiplier}x</span>
          </div>
          <p className="text-[10px] text-slate-400">Multiplica recompensas de ruleta y cofres diarios.</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              value={goldRushMultiplier}
              onChange={(e) => onChangeGoldRush(parseFloat(e.target.value) || 1)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1 text-xs font-mono font-bold text-amber-300"
            />
            <span className="text-xs font-bold text-slate-400">x</span>
          </div>
        </div>

        {/* Bono Pozo Torneos */}
        <div className="p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 space-y-2">
          <div className="flex items-center justify-between text-xs text-cyan-400 font-bold uppercase">
            <span className="flex items-center gap-1.5"><Rocket className="size-4" /> Inyección a Torneos</span>
            <span className="text-[10px] font-mono text-cyan-300 font-bold">+{tournamentBonusPct}%</span>
          </div>
          <p className="text-[10px] text-slate-400">Porcentaje inyectado por la casa al pozo de torneos.</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={tournamentBonusPct}
              onChange={(e) => onChangeTournamentBonus(parseInt(e.target.value) || 0)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-1 text-xs font-mono font-bold text-cyan-300"
            />
            <span className="text-xs font-bold text-slate-400">%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
