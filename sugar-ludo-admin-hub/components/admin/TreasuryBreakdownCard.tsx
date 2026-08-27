'use client'

import React from 'react'
import { TreasuryVault, HouseProfitBreakdown } from '../../types/treasury'
import { Shield, DollarSign, Wallet, ArrowDownRight, TrendingUp, Sparkles, PieChart, Coins } from 'lucide-react'

interface TreasuryBreakdownCardProps {
  vault: TreasuryVault
  profits: HouseProfitBreakdown
}

export function TreasuryBreakdownCard({ vault, profits }: TreasuryBreakdownCardProps) {
  return (
    <div className="space-y-6">
      {/* 3 Core Pillar Cards: Bóveda Total vs Pasivo de Jugadores vs Ganancias Netas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* 1. Bóveda Total de Respaldo */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-cyan-500/30 space-y-3 relative overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.15)]">
          <div className="flex items-center justify-between text-cyan-400">
            <span className="text-xs font-black uppercase tracking-wider">Bóveda Total de Respaldo</span>
            <Shield className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black text-white font-mono">
              ${vault.totalVaultUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
            </p>
            <p className="text-xs text-cyan-300 font-mono flex items-center gap-1">
              <Coins className="size-3.5" /> {vault.totalVaultSugarCoins.toLocaleString()} SC Circulantes
            </p>
          </div>
          <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400">
            Respaldo $1:1$ garantizado en billetera fría y cuentas bancarias maestras.
          </div>
        </div>

        {/* 2. Fondos en Custodia de Jugadores (Pasivo) */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-amber-500/30 space-y-3 relative overflow-hidden shadow-[0_0_30px_rgba(245,158,11,0.1)]">
          <div className="flex items-center justify-between text-amber-400">
            <span className="text-xs font-black uppercase tracking-wider">Fondos de Jugadores (Custodia)</span>
            <Wallet className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black text-white font-mono">
              ${vault.playerBalancesUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
            </p>
            <p className="text-xs text-amber-300 font-mono flex items-center gap-1">
              <Coins className="size-3.5" /> {vault.playerBalancesCoins.toLocaleString()} SC en Billeteras
            </p>
          </div>
          <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400">
            Pasivo no retirable por la casa. Reservado para cobro de jugadores y cajeros.
          </div>
        </div>

        {/* 3. Ganancias Netas de la Casa (Activo Retirable) */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-emerald-500/30 space-y-3 relative overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.15)]">
          <div className="flex items-center justify-between text-emerald-400">
            <span className="text-xs font-black uppercase tracking-wider">Ganancias Netas Casa (Retirable)</span>
            <TrendingUp className="size-5" />
          </div>
          <div className="space-y-1">
            <p className="text-3xl font-black text-emerald-300 font-mono">
              +${vault.houseNetProfitsUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT
            </p>
            <p className="text-xs text-emerald-400/80 font-mono flex items-center gap-1">
              <Coins className="size-3.5" /> +{vault.houseNetProfitsCoins.toLocaleString()} SC Netos Acumulados
            </p>
          </div>
          <div className="pt-2 border-t border-white/5 text-[11px] text-slate-400">
            Activo líquido disponible para dividendos o reinversión de la plataforma.
          </div>
        </div>

      </div>

      {/* Breakdown by Revenue Streams (Rake, Store, Tournaments, Withdrawal Fees) */}
      <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-5">
        <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
          <PieChart className="size-4 text-cyan-400" /> DESGLOSE DETALLADO DE FUENTES DE INGRESO
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 text-xs">
          
          {/* Rake */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Rake de Mesas</span>
            <p className="text-base font-black text-white font-mono">${profits.tableRakeUSD.toLocaleString()}</p>
            <p className="text-[10px] text-cyan-300 font-mono">+{profits.tableRakeCoins.toLocaleString()} SC</p>
          </div>

          {/* Store */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Tienda Cosméticos</span>
            <p className="text-base font-black text-white font-mono">${profits.storeSalesUSD.toLocaleString()}</p>
            <p className="text-[10px] text-pink-300 font-mono">+{profits.storeSalesCoins.toLocaleString()} SC</p>
          </div>

          {/* Tournaments */}
          <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Margen Torneos</span>
            <p className="text-base font-black text-white font-mono">${profits.tournamentMarginUSD.toLocaleString()}</p>
            <p className="text-[10px] text-purple-300 font-mono">+{profits.tournamentMarginCoins.toLocaleString()} SC</p>
          </div>

          {/* Normal Withdrawal Fees (5%) */}
          <div className="p-4 rounded-2xl bg-cyan-500/5 border border-cyan-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-cyan-300 uppercase font-bold">Fee Retiro Normal (5%)</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">72h</span>
            </div>
            <p className="text-base font-black text-cyan-300 font-mono">${profits.normalWithdrawalFeesUSD.toLocaleString()}</p>
            <p className="text-[10px] text-cyan-400/80 font-mono">+{profits.normalWithdrawalFeesCoins.toLocaleString()} SC</p>
          </div>

          {/* VIP Withdrawal Fees (10%) */}
          <div className="p-4 rounded-2xl bg-pink-500/5 border border-pink-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-pink-300 uppercase font-bold">Fee Retiro VIP (10%)</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-pink-500/20 text-pink-300 font-mono">24h</span>
            </div>
            <p className="text-base font-black text-pink-300 font-mono">${profits.vipWithdrawalFeesUSD.toLocaleString()}</p>
            <p className="text-[10px] text-pink-400/80 font-mono">+{profits.vipWithdrawalFeesCoins.toLocaleString()} SC</p>
          </div>

        </div>
      </div>
    </div>
  )
}
