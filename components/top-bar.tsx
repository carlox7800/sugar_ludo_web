'use client'

import { Coins, Gem, Plus, Settings } from 'lucide-react'

export function TopBar({ onSettingsOpen }: { onSettingsOpen?: () => void }) {
  return (
    <header className="glass flex flex-wrap items-center gap-4 rounded-3xl p-4">
      {/* Mobile brand mark */}
      <div className="flex items-center gap-2 md:hidden">
        <div className="btn-3d flex size-10 items-center justify-center rounded-xl bg-[var(--candy-magenta)] shadow-[0_5px_0_oklch(0.45_0.2_350)]">
          <span className="font-display text-lg font-extrabold text-primary-foreground">S</span>
        </div>
        <span className="font-display text-lg font-extrabold leading-none tracking-tight text-[var(--candy-magenta)] neon-magenta">
          SUGAR
        </span>
      </div>

      {/* Level + XP */}
      <div className="flex items-center gap-3">
        <div className="relative flex size-14 items-center justify-center">
          <div className="btn-3d flex size-14 items-center justify-center rounded-full bg-[linear-gradient(145deg,oklch(0.62_0.22_300),oklch(0.7_0.27_350))] shadow-[inset_0_2px_0_oklch(1_0_0/0.4),0_6px_16px_oklch(0.62_0.22_300/0.6)]">
            <div className="flex size-11 flex-col items-center justify-center rounded-full bg-[oklch(0.18_0.03_285)]">
              <span className="text-[9px] font-bold uppercase leading-none text-muted-foreground">
                Nvl
              </span>
              <span className="font-display text-xl font-extrabold leading-none text-[var(--candy-cyan)]">
                13
              </span>
            </div>
          </div>
        </div>

        <div className="w-32 sm:w-44">
          <div className="mb-1 flex items-center justify-between">
            <span className="font-display text-xs font-bold text-foreground">XP</span>
            <span className="text-xs font-semibold text-muted-foreground">2,340 / 3,000</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full border border-border bg-[oklch(0.12_0.02_285)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,oklch(0.82_0.15_200),oklch(0.7_0.27_350))] shadow-[0_0_14px_oklch(0.7_0.27_350/0.8)]"
              style={{ width: '78%' }}
            />
          </div>
        </div>
      </div>

      {/* Economy */}
      <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-3">
        <Counter
          icon={Coins}
          value="1,450"
          iconClass="text-[var(--candy-gold)]"
          glow="oklch(0.85 0.16 90 / 0.55)"
        />
        <Counter
          icon={Gem}
          value="45"
          iconClass="text-[var(--candy-violet)]"
          glow="oklch(0.62 0.22 300 / 0.6)"
        />

        <button
          onClick={onSettingsOpen}
          aria-label="Ajustes del Sistema"
          className="btn-3d flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.2),0_5px_12px_oklch(0_0_0/0.35)] hover:text-foreground sm:size-12 sm:rounded-2xl cursor-pointer"
        >
          <Settings className="size-[18px] sm:size-6" strokeWidth={2.2} />
        </button>
      </div>
    </header>
  )
}

function Counter({
  icon: Icon,
  value,
  iconClass,
  glow,
}: {
  icon: typeof Coins
  value: string
  iconClass: string
  glow: string
}) {
  return (
    <div
      className="flex min-w-0 items-center gap-1 rounded-xl border border-border bg-[oklch(0.12_0.02_285/0.7)] py-1 pl-1.5 pr-1 shadow-[inset_0_1px_0_oklch(1_0_0/0.12)] sm:gap-2 sm:rounded-2xl sm:py-1.5 sm:pl-2 sm:pr-1.5"
      style={{ boxShadow: `inset 0 1px 0 oklch(1 0 0 / 0.12), 0 0 20px ${glow}` }}
    >
      <span className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-[oklch(1_0_0/0.06)] sm:size-8 sm:rounded-xl">
        <Icon className={`size-4 sm:size-5 ${iconClass}`} strokeWidth={2.4} />
      </span>
      <span className="min-w-0 text-center font-display text-sm font-extrabold text-foreground sm:min-w-[2.5rem] sm:text-base">
        {value}
      </span>
      <button
        aria-label="Añadir"
        className="btn-3d flex size-6 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(145deg,oklch(0.82_0.15_200),oklch(0.62_0.22_300))] text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.4),0_4px_10px_oklch(0.62_0.22_300/0.5)] sm:size-8 sm:rounded-xl"
      >
        <Plus className="size-3.5 sm:size-4" strokeWidth={3} />
      </button>
    </div>
  )
}
