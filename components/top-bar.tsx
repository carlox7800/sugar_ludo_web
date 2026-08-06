'use client'

import { Settings, Plus } from 'lucide-react'
import { usePlayer } from '@/lib/player-context'

export function TopBar({ onSettingsOpen, onStoreOpen }: { onSettingsOpen: () => void; onStoreOpen?: () => void }) {
  const { coins, gems, level, xp, xpMax } = usePlayer()
  const xpPercent = Math.min(100, Math.max(0, (xp / xpMax) * 100))

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (num >= 10000) return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return num.toLocaleString('es');
  };

  return (
    <header className="sticky top-4 z-50 glass flex w-full items-center justify-between rounded-[2rem] border border-border/30 bg-[oklch(1_0_0/0.03)] p-2 pl-4 pr-3 shadow-[inset_0_1px_5px_oklch(1_0_0/0.05)]">
      
      {/* LEFT: Level & XP */}
      <div className="flex items-center gap-2 sm:gap-4 shrink">
        {/* Nivel */}
        <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full bg-background shadow-[0_0_15px_var(--candy-magenta)] border-[3px] border-[var(--candy-magenta)]">
          <div className="flex flex-col items-center justify-center leading-none mt-0.5">
            <span className="font-display text-[9px] font-bold text-white/80">NVL</span>
            <span className="font-display text-lg font-extrabold text-[var(--candy-cyan)]">{level}</span>
          </div>
        </div>
        
        {/* XP Bar */}
        <div className="flex flex-col gap-1.5 w-16 xs:w-24 sm:w-32 md:w-48 shrink">
          <div className="flex justify-between items-center px-1">
            <span className="font-display text-[11px] font-bold text-white">XP</span>
            <span className="font-display text-[10px] sm:text-[11px] font-semibold text-white/80 shrink truncate ml-1">{formatNumber(xp)} / {formatNumber(xpMax)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full border border-[oklch(1_1_1/0.1)] bg-[oklch(0_0_0/0.5)]">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,var(--candy-cyan),var(--candy-magenta))] shadow-[0_0_8px_var(--candy-magenta)]"
              style={{ width: `${xpPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* RIGHT: Currencies & Settings */}
      <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
        
        {/* Coins Pill */}
        <div className="flex items-center gap-1 sm:gap-2 rounded-full border border-border/50 bg-[oklch(0_0_0/0.3)] p-1 pr-1.5 sm:pr-3 shadow-inner min-w-[4.5rem] justify-between">
          <img src="/sugar-coin.png" alt="Sugar Coin" className="size-5 sm:size-7 shrink-0 object-contain drop-shadow-[0_2px_8px_rgba(255,215,0,0.4)]" />
          <span className="font-display text-[10px] sm:text-sm font-extrabold tracking-wide text-foreground truncate">
            {formatNumber(coins)}
          </span>
          <button onClick={onStoreOpen} className="flex shrink-0 ml-0.5 sm:ml-1.5 size-4 sm:size-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a5b4fc,#6366f1)] text-white shadow-[0_2px_5px_rgba(99,102,241,0.5)] transition-transform hover:scale-110">
            <Plus className="size-3 sm:size-4" strokeWidth={3} />
          </button>
        </div>

        {/* Diamonds Pill */}
        <div className="flex items-center gap-1 sm:gap-2 rounded-full border border-border/50 bg-[oklch(0_0_0/0.3)] p-1 pr-1.5 sm:pr-3 shadow-inner min-w-[4.5rem] justify-between">
          <div className="flex size-5 sm:size-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#d946ef,#9333ea)] shadow-[0_2px_8px_rgba(147,51,234,0.4)]">
            <svg viewBox="0 0 24 24" className="size-3 sm:size-4 fill-white" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 12L12 22L22 12L12 2Z" />
            </svg>
          </div>
          <span className="font-display text-[10px] sm:text-sm font-extrabold tracking-wide text-foreground truncate">
            {formatNumber(gems)}
          </span>
          <button onClick={onStoreOpen} className="flex shrink-0 ml-0.5 sm:ml-1.5 size-4 sm:size-6 items-center justify-center rounded-full bg-[linear-gradient(135deg,#a5b4fc,#6366f1)] text-white shadow-[0_2px_5px_rgba(99,102,241,0.5)] transition-transform hover:scale-110">
            <Plus className="size-3 sm:size-4" strokeWidth={3} />
          </button>
        </div>

        {/* Settings button */}
        <button
          onClick={onSettingsOpen}
          className="btn-3d ml-0 sm:ml-1 flex size-9 sm:size-11 shrink-0 items-center justify-center rounded-full border border-[oklch(1_0_0/0.1)] bg-[oklch(1_0_0/0.05)] text-muted-foreground transition-colors hover:text-white shadow-[0_4px_10px_oklch(0_0_0/0.3)]"
          aria-label="Ajustes"
        >
          <Settings className="size-4 sm:size-5" />
        </button>

      </div>
    </header>
  )
}
