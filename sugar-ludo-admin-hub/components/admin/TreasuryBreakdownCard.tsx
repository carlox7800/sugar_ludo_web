'use client'

import React from 'react'
import { TreasuryVault, HouseProfitBreakdown } from '../../types/treasury'
import { Shield, DollarSign, Wallet, ArrowDownRight, TrendingUp, Sparkles, PieChart, Coins } from 'lucide-react'

interface TreasuryBreakdownCardProps {
  vault: TreasuryVault
  profits: HouseProfitBreakdown
}

export function TreasuryBreakdownCard({ vault, profits }: TreasuryBreakdownCardProps) {
  // Desglose de ubicación física de la custodia de jugadores
  const inCashiersUSD = vault.cashierFloatsUSD
  const inCentralUSD = Math.max(0, vault.playerBalancesUSD - inCashiersUSD)
  const cashierPercent = vault.playerBalancesUSD > 0 ? Math.min(100, Math.round((inCashiersUSD / vault.playerBalancesUSD) * 100)) : 0
  const centralPercent = 100 - cashierPercent

  return (
    <div className="space-y-6">
      {/* 3 Core Pillar Cards: Bóveda Total vs Pasivo de Jugadores vs Ganancias Netas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* 1. Bóveda Total de Respaldo */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-cyan-500/30 space-y-3 relative overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col justify-between">
          <div className="space-y-3">
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
          </div>

          <div className="pt-3 border-t border-white/5 space-y-2">
            <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-200/90 font-mono">
              <span className="text-cyan-400 font-bold block mb-0.5">Ecuación Contable Real:</span>
              ${vault.playerBalancesUSD.toFixed(2)} (Custodia) + ${vault.houseNetProfitsUSD.toFixed(2)} (Ganancias) = ${vault.totalVaultUSD.toFixed(2)} USDT
            </div>
            <p className="text-[11px] text-slate-400">
              Respaldo total garantizado en el ecosistema sin duplicación de saldos operativos.
            </p>
          </div>
        </div>

        {/* 2. Fondos en Custodia de Jugadores (Pasivo con Desglose de Ubicación) */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-amber-500/30 space-y-3 relative overflow-hidden shadow-[0_0_30px_rgba(245,158,11,0.1)] flex flex-col justify-between">
          <div className="space-y-3">
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
          </div>

          {/* Desglose de Ubicación Física de los Fondos */}
          <div className="pt-3 border-t border-white/5 space-y-2">
            <div className="space-y-1.5 text-[11px] font-mono">
              <div className="flex items-center justify-between">
                <span className="text-slate-300 flex items-center gap-1">
                  🏦 <span className="font-semibold text-slate-400">Cuenta Matriz (Central):</span>
                </span>
                <span className="font-bold text-white">${inCentralUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-pink-300 flex items-center gap-1">
                  💼 <span className="font-semibold text-pink-400/90">En Red de Cajeros (Flotante):</span>
                </span>
                <span className="font-bold text-pink-300">${inCashiersUSD.toLocaleString('en-US', { minimumFractionDigits: 2 })} USDT</span>
              </div>

              {/* Barra de Distribución Proporcional */}
              {vault.playerBalancesUSD > 0 && (
                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex mt-1">
                  <div style={{ width: `${centralPercent}%` }} className="bg-amber-400 transition-all" title={`Cuenta Central: ${centralPercent}%`} />
                  <div style={{ width: `${cashierPercent}%` }} className="bg-pink-500 transition-all" title={`En Cajeros: ${cashierPercent}%`} />
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Traslado interno: El saldo en cajeros es dinero custodiado asignado temporalmente para retiros.
            </p>
          </div>
        </div>

        {/* 3. Ganancias Netas de la Casa (Activo Retirable) */}
        <div className="p-6 rounded-3xl bg-slate-900/80 border border-emerald-500/30 space-y-3 relative overflow-hidden shadow-[0_0_30px_rgba(16,185,129,0.15)] flex flex-col justify-between">
          <div className="space-y-3">
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
          </div>

          <div className="pt-3 border-t border-white/5 space-y-2 text-[11px] text-slate-400">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono text-[11px]">
              Activo 100% líquido libre de custodia, generado por comisiones y rake.
            </div>
            <p className="text-[10px] leading-tight">
              Disponible para dividendos, reinversión o retiros corporativos de la directiva.
            </p>
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
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-bold">hasta 48h</span>
            </div>
            <p className="text-base font-black text-cyan-300 font-mono">${profits.normalWithdrawalFeesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-cyan-400/80 font-mono">+{profits.normalWithdrawalFeesCoins.toLocaleString()} SC</p>
          </div>

          {/* VIP Withdrawal Fees (10%) */}
          <div className="p-4 rounded-2xl bg-pink-500/5 border border-pink-500/20 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-pink-300 uppercase font-bold">Fee Retiro VIP (10%)</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-pink-500/20 text-pink-300 font-mono font-bold">hasta 12h</span>
            </div>
            <p className="text-base font-black text-pink-300 font-mono">${profits.vipWithdrawalFeesUSD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            <p className="text-[10px] text-pink-400/80 font-mono">+{profits.vipWithdrawalFeesCoins.toLocaleString()} SC</p>
          </div>

        </div>
      </div>
    </div>
  )
}
