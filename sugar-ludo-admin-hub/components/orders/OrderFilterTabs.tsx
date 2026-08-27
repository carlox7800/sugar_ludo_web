'use client'

import React from 'react'
import { OrderStatus, OrderType } from '../../types/cashier'
import { clsx } from 'clsx'

export type FilterStatus = 'all' | OrderStatus

interface OrderFilterTabsProps {
  currentStatus: FilterStatus
  onSelectStatus: (status: FilterStatus) => void
  currentType: 'all' | OrderType
  onSelectType: (type: 'all' | OrderType) => void
  counts: Record<string, number>
}

export function OrderFilterTabs({
  currentStatus,
  onSelectStatus,
  currentType,
  onSelectType,
  counts
}: OrderFilterTabsProps) {
  const statusOptions: { id: FilterStatus; label: string; countKey: string }[] = [
    { id: 'all', label: 'Todas las Órdenes', countKey: 'all' },
    { id: 'pending', label: 'Pendientes', countKey: 'pending' },
    { id: 'paid', label: 'Comprobante Subido', countKey: 'paid' },
    { id: 'verified', label: 'En Verificación', countKey: 'verified' },
    { id: 'completed', label: 'Completadas', countKey: 'completed' },
    { id: 'disputed', label: 'En Disputa', countKey: 'disputed' },
  ]

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-2 bg-slate-900/60 border border-white/10 rounded-2xl">
      {/* Type Toggle: Depósitos / Retiros / Todos */}
      <div className="flex items-center p-1 bg-slate-950/80 rounded-xl border border-white/5 text-xs font-bold">
        <button
          onClick={() => onSelectType('all')}
          className={clsx(
            'px-3 py-1.5 rounded-lg transition-all',
            currentType === 'all' ? 'bg-white/15 text-white shadow-sm' : 'text-slate-400 hover:text-white'
          )}
        >
          Todos
        </button>
        <button
          onClick={() => onSelectType('deposit')}
          className={clsx(
            'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1',
            currentType === 'deposit' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'text-slate-400 hover:text-emerald-400'
          )}
        >
          Depósitos
        </button>
        <button
          onClick={() => onSelectType('withdraw')}
          className={clsx(
            'px-3 py-1.5 rounded-lg transition-all flex items-center gap-1',
            currentType === 'withdraw' ? 'bg-pink-500/20 text-pink-300 border border-pink-500/30' : 'text-slate-400 hover:text-pink-400'
          )}
        >
          Retiros
        </button>
      </div>

      {/* Status Badges Scroll Area */}
      <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 text-xs">
        {statusOptions.map((opt) => {
          const isSelected = currentStatus === opt.id
          const count = counts[opt.countKey] || 0
          return (
            <button
              key={opt.id}
              onClick={() => onSelectStatus(opt.id)}
              className={clsx(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer',
                isSelected
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'bg-white/[0.02] text-slate-400 hover:text-slate-200 border border-white/5'
              )}
            >
              <span>{opt.label}</span>
              <span
                className={clsx(
                  'px-1.5 py-0.2 rounded-full text-[10px] font-mono font-black',
                  isSelected ? 'bg-cyan-400 text-slate-950' : 'bg-slate-800 text-slate-400'
                )}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
