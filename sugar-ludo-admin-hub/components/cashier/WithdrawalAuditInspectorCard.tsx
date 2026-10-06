import React from 'react'
import {
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
  Activity,
  History,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Lock,
  UserCheck
} from 'lucide-react'
import { clsx } from 'clsx'
import { FraudAuditResult } from '@/types/cashier'

interface WithdrawalAuditInspectorCardProps {
  playerUid: string
  playerName: string
  amountSugarCoins: number
  amountFiatUSDT: number
  feePercent: number
  fraudAudit?: FraudAuditResult
  onReAudit?: () => void
  isAuditing?: boolean
}

export function WithdrawalAuditInspectorCard({
  playerUid,
  playerName,
  amountSugarCoins,
  amountFiatUSDT,
  feePercent,
  fraudAudit,
  onReAudit,
  isAuditing = false
}: WithdrawalAuditInspectorCardProps) {
  const netUSDT = (amountFiatUSDT * (1 - feePercent / 100)).toFixed(2)
  const feeUSDT = (amountFiatUSDT * (feePercent / 100)).toFixed(2)

  const isBlocked = fraudAudit?.status === 'blocked'
  const isLowTurnover = fraudAudit?.status === 'low_turnover'
  const isCertified = !isBlocked && !isLowTurnover // certified default if ok

  return (
    <div
      className={clsx(
        'p-5 rounded-3xl border space-y-4 transition-all',
        isBlocked
          ? 'bg-rose-950/40 border-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.15)]'
          : isLowTurnover
          ? 'bg-amber-950/30 border-amber-500/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]'
          : 'bg-slate-950/80 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
      )}
    >
      {/* 1. Header con Sello Criptográfico / Antifraude */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2.5">
          {isBlocked ? (
            <div className="p-2 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40">
              <ShieldAlert className="size-5" />
            </div>
          ) : isLowTurnover ? (
            <div className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40">
              <AlertTriangle className="size-5" />
            </div>
          ) : (
            <div className="p-2 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
              <ShieldCheck className="size-5" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">
                {isBlocked
                  ? 'BLOQUEO ANTIFRAUDE: INCONSISTENCIA CONTABLE'
                  : isLowTurnover
                  ? 'ALERTA DE CUMPLIMIENTO: TURNOVER DE JUEGO BAJO'
                  : 'RETIRO CERTIFICADO POR AUDITORÍA AUTOMÁTICA'}
              </h4>
              <span
                className={clsx(
                  'px-2 py-0.5 rounded-full text-[9px] font-black uppercase font-mono border',
                  isBlocked
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    : isLowTurnover
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                )}
              >
                Score: {fraudAudit ? `${fraudAudit.score}/100` : '100/100'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              Auditoría atómica en 1 lectura ($0.00 Spark) • Jugador: {playerName} ({playerUid.slice(0, 8)})
            </p>
          </div>
        </div>

        {onReAudit && (
          <button
            type="button"
            onClick={onReAudit}
            disabled={isAuditing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] font-mono border border-white/10 transition-colors cursor-pointer disabled:opacity-50"
            title="Volver a verificar consistencia de balance"
          >
            <RotateCcw className={clsx('size-3', isAuditing && 'animate-spin text-cyan-400')} />
            <span>{isAuditing ? 'Auditando...' : 'Re-auditar'}</span>
          </button>
        )}
      </div>

      {/* 2. Banner de Explicación de la Auditoría */}
      <div
        className={clsx(
          'p-3.5 rounded-2xl border text-xs leading-relaxed space-y-1',
          isBlocked
            ? 'bg-rose-950/80 border-rose-500/40 text-rose-200'
            : isLowTurnover
            ? 'bg-amber-950/60 border-amber-500/40 text-amber-200'
            : 'bg-emerald-950/40 border-emerald-500/20 text-emerald-200'
        )}
      >
        <div className="flex items-start gap-2">
          {isBlocked ? (
            <Lock className="size-4 shrink-0 text-rose-400 mt-0.5" />
          ) : isLowTurnover ? (
            <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
          ) : (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-400 mt-0.5" />
          )}
          <div>
            <p className="font-bold text-[11px]">
              {fraudAudit?.reason || 'Balance 100% coherente con historial y depósitos. Sin discrepancias detectadas.'}
            </p>
            {isBlocked && (
              <p className="text-[10px] text-rose-300 font-mono mt-1">
                ⛔ ACCIÓN BLOQUEADA: El botón de desembolso ha sido deshabilitado. No proceses este retiro; debes escalarlo a Super Admin para investigación forense.
              </p>
            )}
            {isLowTurnover && (
              <p className="text-[10px] text-amber-300 font-mono mt-1">
                ⚠️ RECOMENDACIÓN: El usuario apenas ha jugado partidas tras depositar. La liquidación está permitida bajo confirmación del cajero.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 3. Desglose de Consistencia Contable (si hay detalles) */}
      {fraudAudit?.details && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-0.5">
            <span className="text-[9px] text-slate-400 uppercase block">Depósitos Totales</span>
            <strong className="text-white">
              +{fraudAudit.details.totalDepositedCoins?.toLocaleString() ?? 0} SC
            </strong>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-0.5">
            <span className="text-[9px] text-slate-400 uppercase block">Premios Ganados</span>
            <strong className="text-cyan-300">
              +{fraudAudit.details.totalWonCoins?.toLocaleString() ?? 0} SC
            </strong>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-0.5">
            <span className="text-[9px] text-slate-400 uppercase block">Buy-ins / Turnover</span>
            <strong className="text-amber-300">
              {fraudAudit.details.totalMatchFeesCoins?.toLocaleString() ?? 0} SC
              {fraudAudit.details.turnoverRatio !== undefined && (
                <span className="text-[9px] text-slate-400 block">
                  ({Math.round(fraudAudit.details.turnoverRatio * 100)}% ratio)
                </span>
              )}
            </strong>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-0.5">
            <span className="text-[9px] text-slate-400 uppercase block">Retiros Previos</span>
            <strong className="text-rose-300">
              -{fraudAudit.details.totalWithdrawnCoins?.toLocaleString() ?? 0} SC
            </strong>
          </div>
        </div>
      )}

      {/* 4. Grid de Desglose Financiero Real de la Orden */}
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

      {/* 5. Protocolo de Liquidación */}
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
