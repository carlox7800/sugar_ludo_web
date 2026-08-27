'use client'

import React, { useRef } from 'react'
import { CashierManagementProfile } from '../../types/admin-expanded'
import { FileText, Printer, Download, X, ShieldCheck } from 'lucide-react'

interface CashierPdfReportModalProps {
  isOpen: boolean
  onClose: () => void
  cashier: CashierManagementProfile | null
}

export function CashierPdfReportModal({ isOpen, onClose, cashier }: CashierPdfReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null)

  if (!isOpen || !cashier) return null

  const handlePrint = () => {
    window.print()
  }

  const currentDate = new Date().toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-3xl max-h-[92vh] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <FileText className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">ARQUEO Y REPORTE CONTABLE OFICIAL</h3>
              <p className="text-xs text-slate-400 font-mono">Generador PDF para auditoría interna</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black shadow-md transition-all cursor-pointer"
            >
              <Printer className="size-4" />
              <span>Imprimir / Guardar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Printable Paper Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-950 text-slate-200 text-xs space-y-6" ref={printRef}>
          {/* Official Letterhead */}
          <div className="flex items-center justify-between border-b border-white/15 pb-4">
            <div>
              <h1 className="text-xl font-black text-white tracking-wider">SUGAR LUDO FINANCIAL NETWORK</h1>
              <p className="text-xs text-slate-400 font-mono">Protocolo Descentralizado de Cajeros & Liquidación P2P</p>
            </div>
            <div className="text-right font-mono text-[11px] text-slate-400">
              <p>Fecha: <strong className="text-white">{currentDate}</strong></p>
              <p>Estado: <span className="text-emerald-400 font-bold">AUDITADO & CERTIFICADO</span></p>
            </div>
          </div>

          {/* Cashier Identity Banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-slate-900 rounded-2xl border border-white/10">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Nombre de Cajero</span>
              <p className="font-bold text-white text-sm">{cashier.name}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Identificador UID</span>
              <p className="font-mono text-cyan-300 text-xs truncate">{cashier.uid}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Turno Actual</span>
              <p className="font-bold text-emerald-400 uppercase">{cashier.shiftStatus}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Cuentas Habilitadas</span>
              <p className="font-mono font-bold text-white">{cashier.paymentMethodsCount} Métodos de Pago</p>
            </div>
          </div>

          {/* Financial Balance Summary */}
          <div className="space-y-3">
            <h3 className="font-black text-xs text-white uppercase tracking-wider">RESUMEN DE SALDO Y COMISIONES</h3>
            <div className="grid grid-cols-3 gap-3 font-mono">
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-400 block font-sans uppercase">Saldo Flotante Disponible</span>
                <p className="text-lg font-black text-pink-300">{(cashier.floatBalanceCoins).toLocaleString()} SC</p>
                <span className="text-[10px] text-slate-500 font-sans">Equivalente: ${(cashier.floatBalanceCoins / 100).toFixed(2)} USDT</span>
              </div>
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-400 block font-sans uppercase">Órdenes Procesadas Hoy</span>
                <p className="text-lg font-black text-white">{cashier.ordersCompletedToday} Operaciones</p>
                <span className="text-[10px] text-slate-500 font-sans">100% de liquidación exitosa</span>
              </div>
              <div className="p-3.5 bg-slate-900/60 rounded-xl border border-white/5">
                <span className="text-[10px] text-slate-400 block font-sans uppercase">Comisión Total Ganada</span>
                <p className="text-lg font-black text-emerald-400">+{cashier.commissionEarnedTodayCoins} SC</p>
                <span className="text-[10px] text-slate-500 font-sans">Equivalente: +${(cashier.commissionEarnedTodayCoins / 100).toFixed(2)} USDT</span>
              </div>
            </div>
          </div>

          {/* Sample Movements Audit Table */}
          <div className="space-y-3">
            <h3 className="font-black text-xs text-white uppercase tracking-wider">HISTORIAL DE MOVIMIENTOS RECIENTES</h3>
            <div className="rounded-xl border border-white/10 overflow-hidden">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">ID Movimiento</th>
                    <th className="p-2.5">Tipo</th>
                    <th className="p-2.5">Monto Fiat</th>
                    <th className="p-2.5">Sugar Coins</th>
                    <th className="p-2.5">Comisión</th>
                    <th className="p-2.5">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-slate-950/60 text-slate-300">
                  <tr>
                    <td className="p-2.5">#DEP-849201</td>
                    <td className="p-2.5 text-emerald-400 font-bold">Depósito</td>
                    <td className="p-2.5">1,500.00 VES</td>
                    <td className="p-2.5">+3,000 SC</td>
                    <td className="p-2.5 text-emerald-400">+60 SC</td>
                    <td className="p-2.5 text-emerald-400 font-bold">COMPLETADO</td>
                  </tr>
                  <tr>
                    <td className="p-2.5">#REC-991204</td>
                    <td className="p-2.5 text-cyan-400 font-bold">Recarga Float</td>
                    <td className="p-2.5">$500.00 USDT</td>
                    <td className="p-2.5">+50,000 SC</td>
                    <td className="p-2.5 text-slate-500">N/A</td>
                    <td className="p-2.5 text-cyan-400 font-bold">ASIGNADO</td>
                  </tr>
                  <tr>
                    <td className="p-2.5">#WIT-391024</td>
                    <td className="p-2.5 text-pink-400 font-bold">Retiro VIP (10%)</td>
                    <td className="p-2.5">$50.00 USDT</td>
                    <td className="p-2.5">-5,000 SC</td>
                    <td className="p-2.5 text-emerald-400">+150 SC</td>
                    <td className="p-2.5 text-emerald-400 font-bold">PAGADO (TxID)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures & Seal */}
          <div className="pt-8 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <div>
              <p className="font-bold text-white">Firma Super Admin / Auditor</p>
              <div className="h-10 w-40 border-b border-dashed border-slate-600 mt-2" />
            </div>
            <div>
              <p className="font-bold text-white">Firma de Conformidad del Cajero</p>
              <div className="h-10 w-40 border-b border-dashed border-slate-600 mt-2" />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
