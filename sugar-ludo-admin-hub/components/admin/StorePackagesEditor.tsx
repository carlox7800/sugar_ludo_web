'use client'

import React from 'react'
import { CoinPackageConfig } from '../../types/admin-expanded'
import { Coins, Plus, Sparkles, Tag, DollarSign } from 'lucide-react'

interface StorePackagesEditorProps {
  packages: CoinPackageConfig[]
  onUpdatePackage: (id: string, newPrice: number, newCoins: number, newBonus: number) => void
}

export function StorePackagesEditor({ packages, onUpdatePackage }: StorePackagesEditorProps) {
  return (
    <div className="rounded-3xl bg-slate-900/60 border border-white/10 overflow-hidden space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div>
          <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Coins className="size-4 text-cyan-400" /> BÓVEDA DE MONEDAS: PAQUETES REALES DE SUGAR COINS
          </h2>
          <p className="text-[11px] text-slate-400 font-mono">
            Sincronizado con los 5 paquetes oficiales de recarga (Sugar-Ludo/lib/store-service.ts)
          </p>
        </div>
        <span className="text-xs text-slate-400 font-mono font-bold">5 Paquetes de Bóveda</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-3 relative overflow-hidden">
            {pkg.badgeTag && (
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-black uppercase border border-cyan-500/30">
                {pkg.badgeTag}
              </span>
            )}

            <div className="space-y-1">
              <span className="font-bold text-xs text-white block truncate">{pkg.name}</span>
              <p className="text-xs text-cyan-300 font-mono font-black">
                {(pkg.coinsAmount + pkg.bonusCoins).toLocaleString()} SC
              </p>
              <span className="text-[10px] text-slate-500 font-mono block">
                Base: {pkg.coinsAmount} + Bono: {pkg.bonusCoins}
              </span>
            </div>

            <div className="space-y-2 text-xs pt-2 border-t border-white/5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Precio USDT:</span>
                <input
                  type="number"
                  value={pkg.priceUSDT}
                  onChange={(e) => onUpdatePackage(pkg.id, parseFloat(e.target.value) || 0, pkg.coinsAmount, pkg.bonusCoins)}
                  className="w-16 bg-slate-900 border border-white/10 rounded-xl px-2 py-1 text-xs font-mono font-bold text-white text-right"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">SC Base:</span>
                <input
                  type="number"
                  value={pkg.coinsAmount}
                  onChange={(e) => onUpdatePackage(pkg.id, pkg.priceUSDT, parseInt(e.target.value) || 0, pkg.bonusCoins)}
                  className="w-16 bg-slate-900 border border-white/10 rounded-xl px-2 py-1 text-xs font-mono font-bold text-cyan-300 text-right"
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Bono SC:</span>
                <input
                  type="number"
                  value={pkg.bonusCoins}
                  onChange={(e) => onUpdatePackage(pkg.id, pkg.priceUSDT, pkg.coinsAmount, parseInt(e.target.value) || 0)}
                  className="w-16 bg-slate-900 border border-white/10 rounded-xl px-2 py-1 text-xs font-mono font-bold text-emerald-300 text-right"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
