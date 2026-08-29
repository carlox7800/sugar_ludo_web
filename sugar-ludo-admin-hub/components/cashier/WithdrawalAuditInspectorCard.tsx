import React from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Activity,
  History,
  AlertTriangle,
  Award,
  Clock,
  UserCheck
} from 'lucide-react'
import { clsx } from 'clsx'

interface WithdrawalAuditInspectorCardProps {
  playerUid: string
  playerName: string
  amountSugarCoins: number
  amountFiatUSDT: number
  feePercent: number
}

export function WithdrawalAuditInspectorCard({
  playerUid,
  playerName,
  amountSugarCoins,
  amountFiatUSDT,
  feePercent
}: WithdrawalAuditInspectorCardProps) {
  const netUSDT = (amountFiatUSDT * (1 - feePercent / 100)).toFixed(2)
  const feeUSDT = (amountFiatUSDT * (feePercent / 100)).toFixed(2)

  return (
    <div className="p-5 rounded-3xl bg-slate-950/80 border border-white/10 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="size-5 text-emerald-400" />
          <div>
            <h4 className="text-xs font-black text-white uppercase tracking-wider">
              INFORMACIÓN DE LIQUIDACIÓN DE RETIRO
            </h4>
            <p className="text-[10px] text-slate-400 font-mono">
              Verificación y procesamiento de orden para {playerName}
            </p>
          </div>
        </div>

        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-[10px] font-black uppercase tracking-wider">
          Retiro Solicitado
        </span>
      </div>

      {/* Grid de Desglose Financiero Real */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
        {/* Pilar 1: Total Solicitado */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold">Monto en Sugar Coins</span>
            <History className="size-3.5 text-cyan-400" />
          </div>
          <div className="text-sm font-black text-white font-mono">
            {amountSugarCoins.toLocaleString()} SC
          </div>
          <span className="text-[10px] text-slate-500 block font-mono">
            Equivalente: ${amountFiatUSDT.toFixed(2)} USDT
          </span>
        </div>

        {/* Pilar 2: Comisión de Retiro */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold">Comisión de Red ({feePercent}%)</span>
            <Activity className="size-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-black text-amber-300 font-mono">
            ${feeUSDT} USDT
          </div>
          <span className="text-[10px] text-slate-500 block font-mono">
            {(amountSugarCoins * (feePercent / 100)).toLocaleString()} SC de comisión
          </span>
        </div>

        {/* Pilar 3: Liquidación Neta a Transferir */}
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-white/5 space-y-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-[10px] uppercase font-bold">Total Neto a Transferir</span>
            <TrendingUp className="size-3.5 text-emerald-400" />
          </div>
          <div className="text-sm font-black text-emerald-300 font-mono">
            ${netUSDT} USDT
          </div>
          <span className="text-[10px] text-slate-500 block font-mono">
            Monto a enviar a la wallet/banco
          </span>
        </div>
      </div>

      {/* Protocolo de Liquidación */}
      <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 text-[11px] text-cyan-300 space-y-1">
        <p className="font-bold flex items-center gap-1.5">
          <UserCheck className="size-4" />
          <span>Protocolo de Pago Bancario / Cripto:</span>
        </p>
        <p className="text-slate-300 leading-relaxed text-[10px]">
          1. Transfiera exactamente <strong>${netUSDT} USDT / equivalente</strong> a la dirección del jugador.
          <br />
          2. Ingrese el <strong>TxID o comprobante bancario</strong> para confirmar la liquidación.
          <br />
          3. Las Sugar Coins ({amountSugarCoins.toLocaleString()} SC) serán debitadas de forma definitiva.
        </p>
      </div>
    </div>
  )
}
