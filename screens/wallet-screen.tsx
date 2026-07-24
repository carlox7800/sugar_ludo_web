'use client'

import React from 'react'
import { Wallet, ArrowLeft, ArrowUpRight, ArrowDownLeft, Plus, History } from 'lucide-react'
import { usePlayer } from '@/lib/player-context'

export function WalletScreen({ onBack }: { onBack: () => void }) {
  const { coins, gems } = usePlayer()

  return (
    <section className="animate-slide-in mx-auto flex max-w-3xl flex-col gap-6 p-4">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="btn-3d flex size-10 items-center justify-center rounded-xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </button>
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
          Billetera
        </h2>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Main Balances */}
        <div className="glass glass-hover flex flex-col justify-between rounded-3xl p-6">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Saldo Actual
            </span>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-4xl font-extrabold text-[var(--candy-gold)] neon-gold drop-shadow-md">
                {coins.toLocaleString('es')}
              </span>
              <span className="font-display text-lg font-bold text-muted-foreground">
                Sugar Coins
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="font-display text-2xl font-extrabold text-[var(--candy-violet)]">
                {gems.toLocaleString('es')}
              </span>
              <span className="text-sm font-semibold text-muted-foreground">
                Diamantes
              </span>
            </div>
          </div>

          <div className="mt-8 flex gap-3">
            <button className="btn-3d flex flex-1 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(145deg,oklch(0.82_0.15_200),oklch(0.62_0.22_300))] py-3 text-sm font-bold text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.4),0_4px_12px_oklch(0.62_0.22_300/0.5)]">
              <Plus className="size-4" /> Recargar
            </button>
            <button className="btn-3d flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-[oklch(1_0_0/0.05)] py-3 text-sm font-bold text-foreground">
              <ArrowUpRight className="size-4 text-[var(--candy-magenta)]" /> Retirar
            </button>
          </div>
        </div>

        {/* Quick Actions / Store Preview */}
        <div className="flex flex-col gap-3">
          <div className="glass rounded-3xl p-6 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[var(--candy-orange)]/20">
              <Wallet className="size-6 text-[var(--candy-orange)]" />
            </div>
            <h3 className="mt-3 font-display text-lg font-bold">Oferta del Día</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              +500 Sugar Coins con tu próxima recarga de Diamantes.
            </p>
            <button className="btn-3d mt-4 w-full rounded-xl border border-[var(--candy-orange)] bg-[var(--candy-orange)]/10 py-2.5 text-sm font-bold text-[var(--candy-orange)]">
              Ver Oferta
            </button>
          </div>
        </div>
      </div>

      {/* Mock Transaction History */}
      <div className="mt-2 flex flex-col gap-4">
        <div className="flex items-center gap-2 px-1">
          <History className="size-5 text-[var(--candy-cyan)]" />
          <h3 className="font-display text-lg font-bold">Movimientos Recientes</h3>
        </div>
        
        <div className="flex flex-col gap-3">
          <TransactionItem 
            type="deposit" 
            title="Recompensa Diaria" 
            date="Hoy, 10:42 AM" 
            amount="+50" 
            currency="Sugar Coins" 
            color="var(--candy-cyan)"
          />
          <TransactionItem 
            type="withdrawal" 
            title="Entrada Torneo" 
            date="Ayer, 18:30 PM" 
            amount="-250" 
            currency="Sugar Coins" 
            color="var(--candy-magenta)"
          />
          <TransactionItem 
            type="deposit" 
            title="Compra Tienda" 
            date="21 Jul, 14:15 PM" 
            amount="+1,000" 
            currency="Diamantes" 
            color="var(--candy-violet)"
          />
        </div>
      </div>
    </section>
  )
}

function TransactionItem({ type, title, date, amount, currency, color }: { type: 'deposit' | 'withdrawal', title: string, date: string, amount: string, currency: string, color: string }) {
  return (
    <div className="glass flex items-center justify-between rounded-2xl p-4 transition-colors hover:bg-[oklch(1_0_0/0.03)]">
      <div className="flex items-center gap-4">
        <div 
          className="flex size-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}22`, color: color }}
        >
          {type === 'deposit' ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
        </div>
        <div className="flex flex-col">
          <span className="font-display text-sm font-bold">{title}</span>
          <span className="text-xs text-muted-foreground">{date}</span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-display text-lg font-extrabold" style={{ color }}>{amount}</span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{currency}</span>
      </div>
    </div>
  )
}
