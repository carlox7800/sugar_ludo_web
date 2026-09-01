'use client'

import React, { useState } from 'react'
import {
  X,
  AlertTriangle,
  ShieldAlert,
  Trash2,
  RefreshCw,
  Wallet,
  Users,
  DollarSign,
  Database,
  CheckCircle2,
  Lock
} from 'lucide-react'
import { TreasuryVault } from '../../types/treasury'

export type ResetScope = 'players_only' | 'cashiers_only' | 'treasury_only' | 'total_hard_reset'

export interface EconomicResetOptions {
  scope: ResetScope
  purgeOrdersHistory: boolean
  purgeShiftLedger: boolean
  resetTelemetryMetrics: boolean
}

interface EconomicHardResetModalProps {
  isOpen: boolean
  onClose: () => void
  onExecuteReset: (options: EconomicResetOptions) => Promise<void>
  isResetting: boolean
  currentVault: TreasuryVault
  activeCashiersCount: number
}

const REQUIRED_CONFIRM_KEYWORD = 'REINICIAR ECONOMIA'

export function EconomicHardResetModal({
  isOpen,
  onClose,
  onExecuteReset,
  isResetting,
  currentVault,
  activeCashiersCount
}: EconomicHardResetModalProps) {
  const [selectedScope, setSelectedScope] = useState<ResetScope>('total_hard_reset')
  const [confirmInput, setConfirmInput] = useState('')
  const [purgeOrdersHistory, setPurgeOrdersHistory] = useState(true)
  const [purgeShiftLedger, setPurgeShiftLedger] = useState(true)
  const [resetTelemetryMetrics, setResetTelemetryMetrics] = useState(true)

  if (!isOpen) return null

  const isConfirmed = confirmInput.trim().toUpperCase() === REQUIRED_CONFIRM_KEYWORD

  const handleExecute = async () => {
    if (!isConfirmed || isResetting) return
    await onExecuteReset({
      scope: selectedScope,
      purgeOrdersHistory: selectedScope === 'total_hard_reset' ? purgeOrdersHistory : false,
      purgeShiftLedger: selectedScope === 'total_hard_reset' || selectedScope === 'cashiers_only' ? purgeShiftLedger : false,
      resetTelemetryMetrics
    })
    setConfirmInput('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl bg-slate-900 border border-rose-500/40 rounded-3xl overflow-hidden shadow-[0_0_50px_rgba(244,63,94,0.2)] max-h-[90vh]">
        
        {/* Header de Alerta Crítica */}
        <div className="p-5 border-b border-rose-500/20 bg-rose-950/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
              <ShieldAlert className="size-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-sm text-white uppercase tracking-wider">
                  REINICIO CONTABLE / HARD RESET DE ECONOMÍA
                </h3>
                <span className="text-[9px] px-2 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-bold uppercase tracking-wider border border-rose-500/30">
                  Super Admin
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                Purgado atómico de balances para auditorías limpias y pruebas desde cero
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            disabled={isResetting}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Advertencia Institucional */}
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-200 flex items-start gap-3">
            <AlertTriangle className="size-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-bold text-white">Atención: Esta es una operación destructiva e irreversible.</p>
              <p className="text-[11px] text-rose-200/80 leading-relaxed font-mono">
                Los saldos seleccionados volverán a $0.00 USD (0 SC) y el libro mayor global se sincronizará de forma instantánea con costo $0 en Firestore Spark.
              </p>
            </div>
          </div>

          {/* 1. Selector de Alcance Modular */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
              1. Seleccione el Alcance del Reinicio:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              
              {/* Opción 1: Billeteras */}
              <button
                type="button"
                onClick={() => setSelectedScope('players_only')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedScope === 'players_only'
                    ? 'bg-cyan-500/15 border-cyan-400 text-white shadow-lg shadow-cyan-500/10'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Users className="size-4 text-cyan-400" />
                  <span className="font-bold text-white text-xs">Solo Jugadores</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Pone a 0 SC los balances de usuarios y vacía la Custodia (${currentVault.playerBalancesUSD.toFixed(2)} USD).
                </p>
              </button>

              {/* Opción 2: Cajas */}
              <button
                type="button"
                onClick={() => setSelectedScope('cashiers_only')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedScope === 'cashiers_only'
                    ? 'bg-amber-500/15 border-amber-400 text-white shadow-lg shadow-amber-500/10'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Wallet className="size-4 text-amber-400" />
                  <span className="font-bold text-white text-xs">Solo Cajeros</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Pone a $0 USDT el flotante de los {activeCashiersCount} cajeros activos (${currentVault.cashierFloatsUSD.toFixed(2)} USD en turno).
                </p>
              </button>

              {/* Opción 3: Tesorería */}
              <button
                type="button"
                onClick={() => setSelectedScope('treasury_only')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedScope === 'treasury_only'
                    ? 'bg-emerald-500/15 border-emerald-400 text-white shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <DollarSign className="size-4 text-emerald-400" />
                  <span className="font-bold text-white text-xs">Solo Ganancias Casa</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Lleva a $0 USD las Ganancias Netas (${currentVault.houseNetProfitsUSD.toFixed(2)} USD) y métricas de rake.
                </p>
              </button>

              {/* Opción 4: Hard Reset Total */}
              <button
                type="button"
                onClick={() => setSelectedScope('total_hard_reset')}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  selectedScope === 'total_hard_reset'
                    ? 'bg-rose-500/20 border-rose-400 text-white shadow-lg shadow-rose-500/20 ring-1 ring-rose-400'
                    : 'bg-slate-950 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Database className="size-4 text-rose-400" />
                  <span className="font-bold text-rose-300 text-xs">Hard Reset Total (Cero Absoluto)</span>
                </div>
                <p className="text-[10px] text-slate-400 leading-snug">
                  Lleva a $0.00 Bóveda, Jugadores, Cajeros y Ganancias simultáneamente.
                </p>
              </button>
            </div>
          </div>

          {/* 2. Opciones de Purga Transaccional Opcional */}
          {(selectedScope === 'total_hard_reset' || selectedScope === 'cashiers_only') && (
            <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-white/10 space-y-2.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
                2. Limpieza de Historial Transaccional (Opcional):
              </span>
              <div className="space-y-2">
                {selectedScope === 'total_hard_reset' && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={purgeOrdersHistory}
                      onChange={(e) => setPurgeOrdersHistory(e.target.checked)}
                      className="size-4 rounded accent-rose-500 cursor-pointer"
                    />
                    <span className="text-slate-300 font-mono text-[11px]">
                      Purgar solicitudes de depósito y retiro previas (<code className="text-cyan-300">cashier_orders</code>)
                    </span>
                  </label>
                )}
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={purgeShiftLedger}
                    onChange={(e) => setPurgeShiftLedger(e.target.checked)}
                    className="size-4 rounded accent-rose-500 cursor-pointer"
                  />
                  <span className="text-slate-300 font-mono text-[11px]">
                    Limpiar registros del libro de turnos y arqueos (<code className="text-cyan-300">cashier_shifts_ledger</code>)
                  </span>
                </label>
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={resetTelemetryMetrics}
                    onChange={(e) => setResetTelemetryMetrics(e.target.checked)}
                    className="size-4 rounded accent-cyan-500 cursor-pointer"
                  />
                  <span className="text-slate-300 font-mono text-[11px]">
                    Reiniciar contadores de telemetría y métricas en vivo (<code className="text-cyan-300">system_treasury/live_telemetry</code>)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* 3. Candado de Confirmación por Palabra Clave */}
          <div className="space-y-2 pt-1 border-t border-white/10">
            <label className="text-[10px] font-bold text-slate-400 uppercase block tracking-wider">
              3. Verificación de Seguridad Crítica:
            </label>
            <p className="text-[11px] text-slate-400">
              Para desbloquear la ejecución, escriba exactamente en mayúsculas: <strong className="text-white font-mono">{REQUIRED_CONFIRM_KEYWORD}</strong>
            </p>
            <div className="relative">
              <input
                type="text"
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={REQUIRED_CONFIRM_KEYWORD}
                disabled={isResetting}
                className="w-full bg-slate-950 border border-white/10 focus:border-rose-500 rounded-xl px-4 py-2.5 text-white font-mono text-xs uppercase tracking-wider focus:outline-none transition-all disabled:opacity-50"
              />
              {isConfirmed && (
                <CheckCircle2 className="size-4 text-emerald-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
              )}
            </div>
          </div>
        </div>

        {/* Footer con Botones de Acción */}
        <div className="p-5 border-t border-white/10 bg-slate-950/60 flex items-center justify-between gap-3 text-xs">
          <button
            onClick={onClose}
            disabled={isResetting}
            className="px-5 py-2.5 rounded-xl bg-white/10 text-white font-bold hover:bg-white/15 transition-all cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          
          <button
            onClick={handleExecute}
            disabled={!isConfirmed || isResetting}
            className={`px-6 py-2.5 rounded-xl font-black transition-all flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              isConfirmed && !isResetting
                ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)]'
                : 'bg-white/10 text-slate-500'
            }`}
          >
            {isResetting ? (
              <>
                <RefreshCw className="size-4 animate-spin" />
                <span>Ejecutando Purga Atómica...</span>
              </>
            ) : (
              <>
                <Trash2 className="size-4" />
                <span>Confirmar y Ejecutar Reinicio</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
