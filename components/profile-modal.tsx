'use client'

import { useEffect } from 'react'
import { X, Crown, Sparkles, Trophy, Flame, Swords, ShieldAlert, History, Package, Award } from 'lucide-react'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="backdrop-in fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity cursor-pointer" 
      />

      {/* Sheet Panel */}
      <div className="sheet-open glass relative z-10 flex w-full max-w-xl max-h-[90dvh] flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl bg-[oklch(0.14_0.03_285/0.95)]">
        {/* Drag handle visual */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-[var(--candy-magenta)]" />
            <h2 className="font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
              Perfil de Jugador
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-3d flex size-9 items-center justify-center rounded-xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground"
            aria-label="Cerrar modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6">
          {/* Main User Card */}
          <div className="flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-5 text-center sm:text-left">
            <div className="relative shrink-0">
              <div className="absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,oklch(0.7_0.27_350),oklch(0.82_0.15_200),oklch(0.78_0.18_55),oklch(0.62_0.22_300),oklch(0.7_0.27_350))] blur-[2px]" />
              <div className="relative size-24 overflow-hidden rounded-full border-2 border-[oklch(1_0_0/0.3)] shadow-inner">
                <img
                  src="/avatar-ludo.png"
                  alt="Avatar del jugador"
                  className="object-cover w-full h-full"
                />
              </div>
              <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[var(--candy-gold)] px-2.5 py-0.5 font-display text-[10px] font-extrabold text-[oklch(0.25_0.08_60)] shadow-md">
                <Crown className="size-3" strokeWidth={2.6} />
                VIP
              </span>
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <h3 className="font-display text-2xl font-extrabold text-foreground">Jugador Ludo</h3>
                <span className="self-center sm:self-auto rounded-full bg-[var(--candy-magenta)]/20 px-3 py-0.5 font-display text-xs font-bold text-[var(--candy-magenta)] border border-[var(--candy-magenta)]/30">
                  Maestro del Dulce
                </span>
              </div>
              <p className="text-xs font-semibold text-muted-foreground">ID: #849201 • Unido en Mayo 2024</p>

              {/* XP Progress Bar */}
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-[var(--candy-cyan)]">Nivel 13</span>
                  <span className="text-muted-foreground">2,340 / 3,000 XP</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full border border-border bg-[oklch(0.12_0.02_285)]">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,oklch(0.82_0.15_200),oklch(0.7_0.27_350))] shadow-[0_0_10px_oklch(0.7_0.27_350/0.8)]"
                    style={{ width: '78%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="flex flex-col gap-3">
            <h4 className="font-display text-sm font-extrabold uppercase tracking-wide text-foreground flex items-center gap-2">
              <Trophy className="size-4 text-[var(--candy-gold)]" />
              Estadísticas de Carrera
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Victorias" value="128" icon={Trophy} color="var(--candy-cyan)" />
              <StatCard label="Derrotas" value="42" icon={ShieldAlert} color="oklch(0.65 0.22 25)" />
              <StatCard label="Efectividad" value="75.2%" icon={Swords} color="var(--candy-magenta)" />
              <StatCard label="Racha Actual" value="7 🔥" icon={Flame} color="var(--candy-orange)" />
            </div>
          </div>

          {/* Inventory Preview */}
          <div className="flex flex-col gap-3">
            <h4 className="font-display text-sm font-extrabold uppercase tracking-wide text-foreground flex items-center gap-2">
              <Package className="size-4 text-[var(--candy-cyan)]" />
              Inventario & Equipamiento
            </h4>
            <div className="grid grid-cols-3 gap-3">
              <ItemCard name="Tablero Sugar" type="Equipado" active />
              <ItemCard name="Dados Neón" type="Equipado" active />
              <ItemCard name="Corona Dulce" type="En Almacén" />
            </div>
          </div>

          {/* History Button (Próximamente) */}
          <div className="pt-2">
            <button
              disabled
              className="btn-3d relative flex w-full items-center justify-between rounded-2xl border border-border bg-[oklch(1_0_0/0.04)] px-5 py-4 font-display text-base font-bold text-muted-foreground opacity-80 cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <History className="size-5 text-[var(--candy-cyan)]" />
                <span>Historial de Partidas</span>
              </div>
              <span className="rounded-full bg-[var(--candy-orange)]/20 px-3 py-1 font-display text-xs font-extrabold text-[var(--candy-orange)] border border-[var(--candy-orange)]/30">
                Próximamente
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-3 text-center">
      <Icon className="size-5 mb-1" style={{ color }} />
      <span className="font-display text-xl font-extrabold" style={{ color }}>{value}</span>
      <span className="text-[11px] font-semibold text-muted-foreground">{label}</span>
    </div>
  )
}

function ItemCard({ name, type, active }: { name: string; type: string; active?: boolean }) {
  return (
    <div className={`flex flex-col items-center rounded-2xl border p-3 text-center transition-all ${
      active 
        ? 'border-[var(--candy-cyan)]/40 bg-[var(--candy-cyan)]/10 shadow-[0_0_15px_oklch(0.82_0.15_200/0.15)]' 
        : 'border-border bg-[oklch(1_0_0/0.02)]'
    }`}>
      <Award className={`size-6 mb-1 ${active ? 'text-[var(--candy-cyan)]' : 'text-muted-foreground'}`} />
      <span className="font-display text-xs font-bold text-foreground truncate w-full">{name}</span>
      <span className="text-[10px] text-muted-foreground font-semibold">{type}</span>
    </div>
  )
}
