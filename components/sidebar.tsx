'use client'

import {
  Store,
  Wallet,
  Users,
  Home,
  CalendarDays,
  Mail,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  screen: string
  icon: LucideIcon
  badge?: string
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Tienda', screen: 'tienda', icon: Store },
  { label: 'Billetera', screen: 'billetera', icon: Wallet },
  { label: 'Amigos', screen: 'amigos', icon: Users },
  { label: 'Inicio', screen: 'lobby', icon: Home },
  { label: 'Eventos', screen: 'eventos', icon: CalendarDays },
  { label: 'Correo', screen: 'correo', icon: Mail, badge: '2' },
  { label: 'Colección', screen: 'coleccion', icon: LayoutGrid },
]

interface SidebarProps {
  currentScreen?: string
  onNavigate?: (screen: string) => void
}

/* ---------- Desktop: fixed left sidebar ---------- */
export function Sidebar({ currentScreen = 'lobby', onNavigate }: SidebarProps) {
  return (
    <aside className="glass fixed inset-y-4 left-4 z-30 hidden w-72 flex-col gap-6 rounded-3xl p-5 md:flex">
      {/* Logo */}
      <div className="flex items-center gap-3 px-1 pt-1">
        <div className="btn-3d flex size-12 items-center justify-center rounded-2xl bg-[var(--candy-magenta)] shadow-[0_6px_0_oklch(0.45_0.2_350),0_10px_20px_oklch(0.7_0.27_350/0.5)]">
          <span className="font-display text-2xl font-extrabold text-primary-foreground">S</span>
        </div>
        <div className="leading-none">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--candy-magenta)] neon-magenta">
            SUGAR
          </h1>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--candy-cyan)] neon-cyan">
            LUDO
          </h1>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-2 overflow-y-auto" aria-label="Menú principal">
        {NAV_ITEMS.map((item) => (
          <NavButton 
            key={item.label} 
            item={item} 
            isActive={currentScreen === item.screen}
            onClick={() => onNavigate?.(item.screen)}
          />
        ))}
      </nav>

      <div className="mt-auto rounded-2xl border border-border bg-[oklch(1_0_0/0.04)] p-4">
        <p className="font-display text-sm font-bold text-foreground">Pase Dulce</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Desbloquea recompensas exclusivas cada semana.
        </p>
        <button className="btn-3d mt-3 w-full rounded-xl bg-[var(--candy-gold)] py-2 font-display text-sm font-bold text-[oklch(0.25_0.08_60)] shadow-[0_4px_0_oklch(0.6_0.14_80)]">
          Reclamar
        </button>
      </div>
    </aside>
  )
}

function NavButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'group relative flex items-center gap-3 rounded-2xl px-4 py-3 text-left transition-all duration-300',
        isActive
          ? 'bg-[linear-gradient(120deg,oklch(0.7_0.27_350/0.9),oklch(0.62_0.22_300/0.9))] text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.35),0_8px_22px_oklch(0.7_0.27_350/0.45)]'
          : 'text-muted-foreground hover:bg-[oklch(1_0_0/0.06)] hover:text-foreground',
      )}
    >
      <span
        className={cn(
          'flex size-9 items-center justify-center rounded-xl transition-all',
          isActive
            ? 'bg-[oklch(1_0_0/0.2)] text-primary-foreground'
            : 'bg-[oklch(1_0_0/0.05)] text-[var(--candy-cyan)] group-hover:bg-[oklch(1_0_0/0.1)]',
        )}
      >
        <Icon className="size-5" strokeWidth={2.4} />
      </span>
      <span className="font-display text-[15px] font-bold">{item.label}</span>

      {item.badge && (
        <span className="ml-auto flex size-6 items-center justify-center rounded-full bg-[var(--candy-orange)] font-display text-xs font-extrabold text-[oklch(0.2_0.05_40)] shadow-[0_0_12px_oklch(0.78_0.18_55/0.9)]">
          {item.badge}
        </span>
      )}
    </button>
  )
}

/* ---------- Mobile: fixed bottom navigation bar ---------- */
export function MobileNav({ currentScreen = 'lobby', onNavigate }: SidebarProps) {
  return (
    <nav
      aria-label="Menú principal"
      className="fixed inset-x-2 bottom-2 z-40 flex items-center justify-between gap-0.5 rounded-2xl border border-border bg-card px-1 py-1.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.12),0_-4px_24px_oklch(0_0_0/0.5)] md:hidden"
    >
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = currentScreen === item.screen
        return (
          <button
            key={item.label}
            onClick={() => onNavigate?.(item.screen)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 transition-all',
              isActive
                ? 'bg-[linear-gradient(120deg,oklch(0.7_0.27_350/0.9),oklch(0.62_0.22_300/0.9))] text-primary-foreground shadow-[0_6px_16px_oklch(0.7_0.27_350/0.5)]'
                : 'text-muted-foreground active:bg-[oklch(1_0_0/0.06)]',
            )}
          >
            <Icon className="size-[18px]" strokeWidth={2.4} />
            {item.badge && (
              <span className="absolute right-0.5 top-0 flex size-3.5 items-center justify-center rounded-full bg-[var(--candy-orange)] font-display text-[9px] font-extrabold text-[oklch(0.2_0.05_40)]">
                {item.badge}
              </span>
            )}
            <span className="w-full truncate text-center font-display text-[8px] font-bold leading-none">
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
