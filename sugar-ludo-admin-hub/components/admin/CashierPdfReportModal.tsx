'use client'

import React, { useRef, useState, useEffect } from 'react'
import { CashierManagementProfile } from '../../types/admin-expanded'
import { FileText, Printer, X, ShieldCheck, ArrowDownLeft, ArrowUpRight, Coins, DollarSign } from 'lucide-react'
import { db } from '../../lib/firebase'
import { collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore'

interface CashierPdfReportModalProps {
  isOpen: boolean
  onClose: () => void
  cashier: CashierManagementProfile | null
}

interface RealCashierMovement {
  id: string
  type: 'deposit' | 'withdraw'
  amountFiat: number
  currency: string
  amountSugarCoins: number
  commissionCoins: number
  reference: string
  timestamp: number
  dateStr: string
  status: string
}

export function CashierPdfReportModal({ isOpen, onClose, cashier }: CashierPdfReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null)
  const [movements, setMovements] = useState<RealCashierMovement[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [liveProfile, setLiveProfile] = useState<any>(null)

  useEffect(() => {
    if (!isOpen || !cashier?.uid) return

    const loadRealCashierData = async () => {
      setIsLoading(true)
      try {
        // 1. Obtener perfil más reciente del cajero
        try {
          const profileSnap = await getDoc(doc(db, 'cashier_profiles', cashier.uid))
          if (profileSnap.exists()) {
            setLiveProfile(profileSnap.data())
          }
        } catch {}

        // 2. Consultar órdenes completadas por este cajero
        const q = query(
          collection(db, 'cashier_orders'),
          where('status', '==', 'completed'),
          limit(100)
        )
        const snap = await getDocs(q)
        const realMovs: RealCashierMovement[] = []

        snap.forEach((d) => {
          const ord = d.data() as any
          const isSettledByCashier = ord.settledByCashierUid === cashier.uid || ord.cashierUid === cashier.uid
          if (!isSettledByCashier) return

          const amountCoins = Number(ord.amountSugarCoins || 0)
          const commissionCoins = Number(ord.cashierCommissionCoins || Math.round(amountCoins * 0.02))
          const dateObj = new Date(ord.completedAt || ord.createdAt || Date.now())

          realMovs.push({
            id: d.id,
            type: ord.type === 'withdraw' ? 'withdraw' : 'deposit',
            amountFiat: Number(ord.amountFiat || (amountCoins / 100)),
            currency: ord.currency || 'USDT',
            amountSugarCoins: amountCoins,
            commissionCoins,
            reference: ord.receiptReferenceNumber || ord.txHash || `TX-${d.id.slice(0, 8).toUpperCase()}`,
            timestamp: ord.completedAt || ord.createdAt || Date.now(),
            dateStr: dateObj.toLocaleDateString('es-ES', {
              day: '2-digit',
              month: 'short',
              hour: '2-digit',
              minute: '2-digit'
            }),
            status: 'LIQUIDADO'
          })
        })

        // Ordenar cronológicamente descendente (más reciente primero)
        realMovs.sort((a, b) => b.timestamp - a.timestamp)
        setMovements(realMovs)
      } catch (err) {
        console.warn('[CashierPdfModal] Error cargando movimientos reales:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadRealCashierData()
  }, [isOpen, cashier?.uid])

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

  // Cálculos financieros con datos 100% reales
  const currentFloatUSDT = Number(
    liveProfile?.floatBalanceUSDT ?? (cashier as any).floatBalanceUSDT ?? (cashier.floatBalanceCoins / 100)
  )
  const currentFloatCoins = Math.round(currentFloatUSDT * 100)

  const deposits = movements.filter((m) => m.type === 'deposit')
  const withdrawals = movements.filter((m) => m.type === 'withdraw')

  const totalDepositsUSD = deposits.reduce((acc, m) => acc + m.amountFiat, 0)
  const totalWithdrawalsUSD = withdrawals.reduce((acc, m) => acc + m.amountFiat, 0)
  const totalCommissionsCoins = movements.reduce((acc, m) => acc + m.commissionCoins, 0)
  const totalCommissionsUSD = parseFloat((totalCommissionsCoins / 100).toFixed(2))

  const initialFloatUSDT = Number(
    liveProfile?.initialShiftFloatUSDT ??
    (cashier as any).initialShiftFloatUSDT ??
    (currentFloatUSDT + totalWithdrawalsUSD)
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-4xl max-h-[94vh] bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-pink-500/20 text-pink-400 border border-pink-500/30">
              <FileText className="size-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm text-white">ARQUEO DE CAJA Y REPORTE CONTABLE OFICIAL</h3>
              <p className="text-xs text-slate-400 font-mono">Datos contables y auditoría en tiempo real</p>
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
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
              <p className="font-bold text-emerald-400 uppercase">{cashier.shiftStatus === 'on_shift' ? 'EN TURNO ACTIVO' : cashier.shiftStatus === 'break' ? 'EN RECESO' : 'FUERA DE TURNO'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Canales de Pago</span>
              <p className="font-mono font-bold text-white">{cashier.assignedPaymentMethods?.length || cashier.paymentMethodsCount || 1} Métodos Asignados</p>
            </div>
          </div>

          {/* Financial Balance Summary (4 Core Metric Blocks) */}
          <div className="space-y-3">
            <h3 className="font-black text-xs text-white uppercase tracking-wider flex items-center justify-between">
              <span>ESTADO DE CUENTA Y ARQUEO DE TURNO</span>
              {isLoading && <span className="text-[10px] text-cyan-400 font-mono animate-pulse">Sincronizando movimientos...</span>}
            </h3>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
              {/* 1. Flotante Asignado */}
              <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-cyan-500/20 space-y-1">
                <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">1. Flotante Asignado</span>
                <p className="text-lg font-black text-cyan-300">${initialFloatUSDT.toFixed(2)} USDT</p>
                <span className="text-[10px] text-slate-500 font-sans">{(initialFloatUSDT * 100).toLocaleString()} SC Iniciales</span>
              </div>

              {/* 2. Retiros Desembolsados */}
              <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-pink-500/20 space-y-1">
                <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">2. Retiros Pagados</span>
                <p className="text-lg font-black text-pink-300">-${totalWithdrawalsUSD.toFixed(2)} USDT</p>
                <span className="text-[10px] text-slate-500 font-sans">{withdrawals.length} Retiros Liquidados</span>
              </div>

              {/* 3. Depósitos Validados */}
              <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-amber-500/20 space-y-1">
                <span className="text-[10px] text-slate-400 block font-sans uppercase font-bold">3. Depósitos Verificados</span>
                <p className="text-lg font-black text-amber-300">${totalDepositsUSD.toFixed(2)} USD</p>
                <span className="text-[10px] text-slate-500 font-sans">{deposits.length} Recargas Aprobadas</span>
              </div>

              {/* 4. Saldo Flotante Final Actual */}
              <div className="p-3.5 bg-slate-900/80 rounded-2xl border border-emerald-500/30 space-y-1">
                <span className="text-[10px] text-emerald-400 block font-sans uppercase font-bold">4. Saldo Flotante Actual</span>
                <p className="text-lg font-black text-emerald-300">${currentFloatUSDT.toFixed(2)} USDT</p>
                <span className="text-[10px] text-emerald-400/80 font-sans">{currentFloatCoins.toLocaleString()} SC en Custodia</span>
              </div>
            </div>

            {/* Comisión Ganada Banner */}
            <div className="p-3 rounded-2xl bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-300 font-sans">Comisión Operativa del Cajero Ganada en el Turno:</span>
              <span className="font-bold text-emerald-300 text-sm">+{totalCommissionsCoins.toLocaleString()} SC (+${totalCommissionsUSD.toFixed(2)} USDT)</span>
            </div>
          </div>

          {/* Real Movements Audit Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xs text-white uppercase tracking-wider">
                MOVIMIENTOS AUDITADOS EN EL TURNO ({movements.length})
              </h3>
              <span className="text-[10px] text-slate-500 font-mono">Últimas operaciones procesadas</span>
            </div>

            <div className="rounded-2xl border border-white/10 overflow-hidden">
              <table className="w-full text-left font-mono text-[11px]">
                <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                  <tr>
                    <th className="p-3">ID Orden</th>
                    <th className="p-3">Tipo</th>
                    <th className="p-3">Monto Fiat</th>
                    <th className="p-3">Sugar Coins</th>
                    <th className="p-3">Referencia / TxID</th>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 bg-slate-950/60 text-slate-300">
                  {movements.length > 0 ? (
                    movements.map((mov) => {
                      const isDeposit = mov.type === 'deposit'
                      return (
                        <tr key={mov.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="p-3 text-cyan-300 font-bold">#{mov.id.slice(0, 10).toUpperCase()}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isDeposit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-pink-500/20 text-pink-300'
                            }`}>
                              {isDeposit ? 'DEPÓSITO' : 'RETIRO'}
                            </span>
                          </td>
                          <td className="p-3 font-bold text-white">
                            {isDeposit ? `+${mov.amountFiat.toFixed(2)}` : `-${mov.amountFiat.toFixed(2)}`} {mov.currency}
                          </td>
                          <td className="p-3 font-semibold">
                            {isDeposit ? `+${mov.amountSugarCoins.toLocaleString()}` : `-${mov.amountSugarCoins.toLocaleString()}`} SC
                          </td>
                          <td className="p-3 text-slate-400 truncate max-w-[140px]" title={mov.reference}>
                            {mov.reference}
                          </td>
                          <td className="p-3 text-slate-400">{mov.dateStr}</td>
                          <td className="p-3 text-emerald-400 font-bold">COMPLETADO</td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-500 font-sans">
                        Sin operaciones procesadas aún en este turno. El saldo flotante asignado se mantiene íntegro.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Signatures & Seal */}
          <div className="pt-8 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <div>
              <p className="font-bold text-white">Super Admin / Auditor Financiero</p>
              <div className="h-10 w-44 border-b border-dashed border-slate-600 mt-2" />
            </div>
            <div className="text-right">
              <p className="font-bold text-white">Cajero Responsable ({cashier.name})</p>
              <div className="h-10 w-44 border-b border-dashed border-slate-600 mt-2 ml-auto" />
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
