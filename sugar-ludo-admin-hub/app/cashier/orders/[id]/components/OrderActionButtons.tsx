'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { ShieldCheck, AlertTriangle, ShieldAlert, Send, RefreshCw, AlertCircle } from 'lucide-react'
import { CashierOrder } from '@/types/cashier'
import { cashierLogger } from '@/lib/cashier-logger'

export interface OrderActionButtonsProps {
  order: CashierOrder
  isDeposit: boolean
  isWithdraw: boolean
  isPaid: boolean
  isCompleted: boolean
  isCancelled: boolean
  cashierFloatUSDT: number
  netPayoutUSD: number
  hasSufficientFloat: boolean
  isValidating: boolean
  isValidatingPayout: boolean
  isEscalating: boolean
  isPayoutModalOpen?: boolean
  setIsPayoutModalOpen?: (open: boolean) => void
  isDisputeOpen?: boolean
  setIsDisputeOpen?: (open: boolean) => void
  isDirectValidationModalOpen?: boolean
  setIsDirectValidationModalOpen?: (open: boolean) => void
  onApprove: (verifiedTxId?: string) => Promise<void>
  onConfirmPayout: (payoutTxId: string) => Promise<void>
  onEscalateToDispute: (reason: string) => Promise<void>
  onCopyHash: (text: string) => void
  onNotify: (msg: string) => void
}

export const OrderActionButtons: React.FC<OrderActionButtonsProps> = ({
  order,
  isDeposit,
  isWithdraw,
  isPaid,
  isCompleted,
  isCancelled,
  cashierFloatUSDT,
  netPayoutUSD,
  hasSufficientFloat,
  isValidating,
  isValidatingPayout,
  isEscalating,
  isPayoutModalOpen: controlledPayoutOpen,
  setIsPayoutModalOpen: controlledSetPayoutOpen,
  isDisputeOpen: controlledDisputeOpen,
  setIsDisputeOpen: controlledSetDisputeOpen,
  isDirectValidationModalOpen: controlledDirectOpen,
  setIsDirectValidationModalOpen: controlledSetDirectOpen,
  onApprove,
  onConfirmPayout,
  onEscalateToDispute,
  onCopyHash,
  onNotify
}) => {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    setMounted(true)
  }, [])

  const [internalDirectOpen, setInternalDirectOpen] = useState(false)
  const isDirectValidationModalOpen = controlledDirectOpen !== undefined ? controlledDirectOpen : internalDirectOpen
  const setIsDirectValidationModalOpen = controlledSetDirectOpen || setInternalDirectOpen
  const [directTxId, setDirectTxId] = useState('')

  const [internalPayoutOpen, setInternalPayoutOpen] = useState(false)
  const isPayoutModalOpen = controlledPayoutOpen !== undefined ? controlledPayoutOpen : internalPayoutOpen
  const setIsPayoutModalOpen = controlledSetPayoutOpen || setInternalPayoutOpen
  const [payoutTxId, setPayoutTxId] = useState('')

  const [internalDisputeOpen, setInternalDisputeOpen] = useState(false)
  const isDisputeOpen = controlledDisputeOpen !== undefined ? controlledDisputeOpen : internalDisputeOpen
  const setIsDisputeOpen = controlledSetDisputeOpen || setInternalDisputeOpen
  const [disputeReason, setDisputeReason] = useState('')

  const handleOpenDirectValidation = () => {
    cashierLogger.click(`Botón Validar con Hash / TxID (Abrir modal)`)
    setDirectTxId(order.receiptReferenceNumber || '')
    setIsDirectValidationModalOpen(true)
  }

  const handleOpenPayout = () => {
    if (!hasSufficientFloat) return
    cashierLogger.click(`Botón Transferir Dinero y Liquidar Retiro (Abrir modal)`)
    setIsPayoutModalOpen(true)
  }

  const handleOpenDispute = () => {
    cashierLogger.click(`Abrir Modal de Disputa`)
    setIsDisputeOpen(true)
  }

  const handleConfirmDirectApprove = async () => {
    await onApprove(directTxId.trim())
    setIsDirectValidationModalOpen(false)
  }

  const handleExecutePayout = async () => {
    if (!hasSufficientFloat) {
      onNotify(`⛔ Saldo insuficiente ($${cashierFloatUSDT.toFixed(2)} USDT). Se requieren $${netPayoutUSD.toFixed(2)} USDT.`)
      return
    }
    if (!payoutTxId.trim()) return
    cashierLogger.click(`Clic en botón Confirmar Pago Retiro`, { payoutTxId: payoutTxId.trim() })
    await onConfirmPayout(payoutTxId.trim())
    setIsPayoutModalOpen(false)
  }

  const handleExecuteDispute = async () => {
    if (!disputeReason.trim()) return
    await onEscalateToDispute(disputeReason.trim())
    setIsDisputeOpen(false)
    setDisputeReason('')
  }

  return (
    <>
      {/* 1. Header Action Buttons */}
      <div className="flex items-center gap-2">
        {isDeposit && !isCompleted && !isCancelled && order.status !== 'disputed' && (
          isPaid ? (
            <button
              type="button"
              onClick={() => {
                cashierLogger.click(`Botón Validar y Liberar Saldo (Depósito Pagado)`)
                onApprove()
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 text-xs font-black shadow-[0_0_25px_rgba(16,185,129,0.4)] transition-all cursor-pointer"
            >
              <ShieldCheck className="size-4" />
              <span>Validar y Liberar Saldo</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleOpenDirectValidation}
              className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer"
            >
              <AlertTriangle className="size-4" />
              <span>Validar con Hash / TxID</span>
            </button>
          )
        )}

        {!isCompleted && !isCancelled && order.status !== 'disputed' && (
          <button
            type="button"
            onClick={handleOpenDispute}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 text-xs font-bold transition-all cursor-pointer shadow-sm"
            title="Escalar esta orden a Disputa Oficial ante el Super Admin"
          >
            <ShieldAlert className="size-4 text-rose-400" />
            <span className="hidden sm:inline">Escalar a Disputa</span>
          </button>
        )}
      </div>

      {/* 2. Direct Validation Modal with TxID for Cashier */}
      {isDirectValidationModalOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-md my-auto max-h-[90vh] overflow-y-auto p-6 rounded-3xl bg-slate-900 border border-amber-500/40 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
                <AlertTriangle className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase">Validación Directa por Hash / TxID</h3>
                <p className="text-[10px] text-slate-400 font-mono">Orden #{order.id.slice(0, 10)}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 space-y-1">
                <div className="flex justify-between text-slate-400">
                  <span>Monto Verificado:</span>
                  <strong className="text-white font-mono">{order.amountFiat} {order.currency}</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Crédito a Liberar:</span>
                  <strong className="text-cyan-300 font-mono">+{order.amountSugarCoins.toLocaleString()} SC</strong>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Jugador:</span>
                  <strong className="text-white">{order.playerName}</strong>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-slate-300 font-bold block text-[10px] uppercase">
                  Hash de Transacción / Referencia Bancaria Verificada *
                </label>
                <input
                  type="text"
                  required
                  value={directTxId}
                  onChange={(e) => setDirectTxId(e.target.value)}
                  placeholder="Ej. 0x7c8a... o REF-10928374"
                  className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-slate-500">
                  Ingresa el Hash o referencia tras verificar el ingreso de fondos en tu cuenta bancaria o wallet.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsDirectValidationModalOpen(false)}
                disabled={isValidating}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDirectApprove}
                disabled={!directTxId.trim() || isValidating}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition-all shadow-[0_0_15px_rgba(245,158,11,0.3)] disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                {isValidating ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Procesando validación...</span>
                  </>
                ) : (
                  <span>Confirmar y Liberar Saldo</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 3. Payout Confirmation Modal for Cashier */}
      {isPayoutModalOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-md my-auto max-h-[90vh] overflow-y-auto p-6 rounded-3xl bg-slate-900 border border-pink-500/30 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-white/10 pb-3">
              <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400">
                <Send className="size-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase">Confirmar Liquidación de Retiro</h3>
                <p className="text-[10px] text-slate-400 font-mono">Orden #{order.id.slice(0, 10)}</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              {(() => {
                const isModalVip = Boolean(order.isVip || order.isVipWithdraw || (order.paymentMethod as string) === 'usdt_bep20' || (order.paymentMethod as string) === 'usdt_trc20_vip')
                const modalFeePercent = isModalVip ? 0.10 : 0.05
                const modalRequestedFiat = Number(order.amountFiat || (order.amountSugarCoins / 100))
                const modalFeeFiat = parseFloat((modalRequestedFiat * modalFeePercent).toFixed(2))
                const modalNetPayoutFiat = parseFloat((modalRequestedFiat - modalFeeFiat).toFixed(2))
                const walletAddress = (order as any).paymentAddress || order.receiptReferenceNumber || (typeof order.playerPaymentAccount === 'string' ? order.playerPaymentAccount : order.playerPaymentAccount?.accountNumber) || 'No especificada'

                return (
                  <div className="p-3.5 bg-slate-950 rounded-2xl border border-white/5 space-y-1.5 font-mono">
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Monto Solicitado:</span>
                      <strong className="text-white font-mono">${modalRequestedFiat.toFixed(2)} {order.currency}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px]">
                      <span>Comisión {isModalVip ? 'VIP (10%)' : 'Estándar (5%)'}:</span>
                      <strong className="text-rose-400 font-mono">-${modalFeeFiat.toFixed(2)} {order.currency}</strong>
                    </div>
                    <div className="border-t border-white/10 pt-1.5 flex justify-between items-center text-xs">
                      <span className="text-white font-bold">Monto Neto a Transferir:</span>
                      <strong className="text-pink-300 font-black text-sm font-mono">${modalNetPayoutFiat.toFixed(2)} {order.currency}</strong>
                    </div>
                    <div className="border-t border-white/5 pt-1.5 flex justify-between text-slate-400 text-[10px]">
                      <span>Jugador Destino:</span>
                      <strong className="text-white">{order.playerName}</strong>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[10px]">
                      <span>Método de Pago:</span>
                      <strong className="text-cyan-300 uppercase">{order.paymentMethod}</strong>
                    </div>
                    <div className="border-t border-white/10 pt-1.5 flex justify-between items-center text-slate-400 text-[10px]">
                      <span>Billetera / Cuenta:</span>
                      <div className="flex items-center gap-1.5 min-w-0">
                        <strong className="text-emerald-300 font-mono text-[11px] truncate max-w-[170px]">
                          {walletAddress}
                        </strong>
                        {walletAddress !== 'No especificada' && (
                          <button
                            type="button"
                            onClick={() => onCopyHash(walletAddress)}
                            className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-cyan-300 text-[9px] font-bold cursor-pointer transition-colors shrink-0"
                            title="Copiar Billetera"
                          >
                            Copiar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })()}

              {/* Alerta roja de Saldo Insuficiente en Modal */}
              {!hasSufficientFloat && !isValidatingPayout && (
                <div className="p-3.5 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-rose-300 text-xs space-y-1.5 shadow-lg animate-in fade-in">
                  <div className="flex items-center gap-2 font-black text-rose-400">
                    <AlertCircle className="size-4 shrink-0 text-rose-400" />
                    <span className="uppercase tracking-wider">SALDO FLOTANTE INSUFICIENTE</span>
                  </div>
                  <p className="text-[11px] text-rose-200 leading-snug">
                    Tu saldo de trabajo disponible es de <strong className="text-white font-mono">${cashierFloatUSDT.toFixed(2)} USDT</strong>. Se requieren <strong className="text-rose-300 font-mono">${netPayoutUSD.toFixed(2)} USDT</strong> para pagar este retiro. No puedes procesar esta orden. Solicita recarga al Administrador.
                  </p>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold block text-[10px] uppercase">
                  Número de Referencia Bancaria / TxID Cripto (Obligatorio) *
                </label>
                <input
                  type="text"
                  required
                  disabled={!hasSufficientFloat || isValidatingPayout}
                  value={payoutTxId}
                  onChange={(e) => setPayoutTxId(e.target.value)}
                  placeholder={hasSufficientFloat ? "Ej. 0x8f9c2a... o REF-9928172" : "Bloqueado por saldo insuficiente"}
                  className={`w-full bg-slate-950 border rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none ${
                    !hasSufficientFloat 
                      ? 'border-rose-500/30 opacity-50 cursor-not-allowed text-slate-500' 
                      : 'border-white/10 focus:border-pink-400'
                  }`}
                />
                <p className="text-[10px] text-slate-400">
                  Ingresa el Hash de la transacción o número de comprobante emitido tras realizar la transferencia.
                </p>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  cashierLogger.click(`Cancelar Liquidación de Retiro`)
                  setIsPayoutModalOpen(false)
                }}
                disabled={isValidatingPayout}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecutePayout}
                disabled={!hasSufficientFloat || !payoutTxId.trim() || isValidatingPayout}
                className={`flex-1 py-2.5 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
                  (!hasSufficientFloat || !payoutTxId.trim()) && !isValidatingPayout
                    ? 'bg-slate-800 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 shadow-[0_0_15px_rgba(236,72,153,0.3)] cursor-pointer'
                }`}
              >
                {isValidatingPayout ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Procesando liquidación...</span>
                  </>
                ) : (
                  <span>Confirmar Pago y Notificar</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* 4. Escalate to Dispute Modal */}
      {isDisputeOpen && mounted && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in">
          <div className="relative w-full max-w-md my-auto max-h-[90vh] overflow-y-auto bg-slate-900 border border-rose-500/50 rounded-3xl p-6 space-y-4 shadow-[0_0_30px_rgba(244,63,94,0.3)]">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-500/20 border border-rose-500/40">
                <ShieldAlert className="size-6 text-rose-400 animate-pulse" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Escalar Orden a Disputa Oficial</h3>
                <p className="text-xs text-slate-400 font-mono">Remitir caso al Super Admin para arbitraje</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300">Motivo de la Disputa:</label>
              <div className="flex flex-wrap gap-1.5 pb-1">
                {['Comprobante inconsistente', 'TxID no verificado', 'Datos de billetera erróneos', 'Sospecha de duplicidad'].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setDisputeReason(preset)}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono transition-all border border-white/5 cursor-pointer"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <textarea
                value={disputeReason}
                onChange={(e) => setDisputeReason(e.target.value)}
                placeholder="Describe detalladamente la irregularidad o inconsistencia detectada..."
                rows={3}
                className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-rose-400"
              />
            </div>

            <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-200/90 leading-relaxed font-mono">
              ⚠️ Al escalar, la orden pasará a estado <strong>DISPUTED</strong> y quedará congelada en custodia hasta que el Super Admin dicte la resolución final.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsDisputeOpen(false)
                  setDisputeReason('')
                }}
                disabled={isEscalating}
                className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleExecuteDispute}
                disabled={!disputeReason.trim() || isEscalating}
                className="flex-1 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 disabled:opacity-40 text-slate-950 font-black text-xs transition-all cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.4)] flex items-center justify-center gap-1.5"
              >
                {isEscalating ? (
                  <>
                    <RefreshCw className="size-3.5 animate-spin" />
                    <span>Escalando...</span>
                  </>
                ) : (
                  <span>Confirmar y Escalar</span>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export interface PayoutActionButtonProps {
  isWithdraw: boolean
  isCompleted: boolean
  hasSufficientFloat: boolean
  cashierFloatUSDT: number
  netPayoutUSD: number
  onOpenPayout: () => void
}

export const PayoutActionButton: React.FC<PayoutActionButtonProps> = ({
  isWithdraw,
  isCompleted,
  hasSufficientFloat,
  cashierFloatUSDT,
  netPayoutUSD,
  onOpenPayout
}) => {
  if (!isWithdraw || isCompleted) return null

  return (
    <div className="pt-2 space-y-3">
      {!hasSufficientFloat && (
        <div className="p-4 rounded-2xl bg-rose-950/90 border border-rose-500/50 text-xs space-y-2 shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-in fade-in">
          <div className="flex items-center gap-2 text-rose-400 font-black">
            <AlertTriangle className="size-4 shrink-0 text-rose-400" />
            <span className="uppercase tracking-wider">SALDO FLOTANTE INSUFICIENTE</span>
          </div>
          <p className="text-rose-200/95 text-xs leading-relaxed font-sans">
            Tu saldo de trabajo disponible es de <strong className="text-white font-mono bg-rose-900/60 px-1.5 py-0.5 rounded border border-rose-500/30">${cashierFloatUSDT.toFixed(2)} USDT</strong> y este retiro requiere liquidar <strong className="text-rose-300 font-mono bg-rose-900/60 px-1.5 py-0.5 rounded border border-rose-500/30">${netPayoutUSD.toFixed(2)} USDT</strong>.
            No cuentas con saldo suficiente para pagar este retiro. Debes solicitar recarga al Administrador.
          </p>
        </div>
      )}

      <button
        type="button"
        disabled={!hasSufficientFloat}
        onClick={onOpenPayout}
        className={`w-full py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
          !hasSufficientFloat
            ? 'bg-slate-800/90 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed shadow-none'
            : 'bg-gradient-to-r from-pink-500 to-pink-600 hover:from-pink-400 hover:to-pink-500 text-slate-950 shadow-[0_0_25px_rgba(236,72,153,0.35)] cursor-pointer'
        }`}
      >
        <Send className="size-4" />
        <span>Transferir Dinero y Liquidar Retiro</span>
      </button>
    </div>
  )
}
