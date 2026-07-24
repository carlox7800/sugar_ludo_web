'use client'

import React from 'react'
import { ArrowLeft, type LucideIcon } from 'lucide-react'

interface ComingSoonScreenProps {
  icon: LucideIcon
  title: string
  description: string
  accent: string
  badge?: string
  onBack: () => void
}

export function ComingSoonScreen({
  icon: Icon,
  title,
  description,
  accent,
  badge,
  onBack,
}: ComingSoonScreenProps) {
  return (
    <section className="animate-slide-in flex min-h-[70vh] flex-col items-center justify-center p-6 text-center">
      <div className="glass glass-hover relative flex max-w-md flex-col items-center gap-5 rounded-3xl p-8">
        {/* Background ambient light */}
        <div 
          className="pointer-events-none absolute left-1/2 top-1/2 size-48 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-20 blur-[50px]"
          style={{ backgroundColor: accent }}
        />

        {badge && (
          <span className="absolute -top-3 rounded-full bg-[var(--candy-orange)] px-4 py-1 font-display text-[11px] font-extrabold uppercase tracking-wide text-[oklch(0.2_0.05_40)] shadow-[0_0_16px_oklch(0.78_0.18_55/0.8)]">
            {badge}
          </span>
        )}

        <div 
          className="relative flex size-20 items-center justify-center rounded-2xl shadow-inner border border-[oklch(1_0_0/0.1)]"
          style={{ 
            background: `linear-gradient(135deg, ${accent}33, ${accent}11)`,
            boxShadow: `inset 0 2px 10px ${accent}44, 0 8px 30px ${accent}33`
          }}
        >
          <Icon className="size-10" style={{ color: accent }} strokeWidth={2} />
        </div>

        <div>
          <h2 className="font-display text-3xl font-extrabold text-foreground">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>

        <button
          onClick={onBack}
          className="btn-3d mt-4 flex items-center gap-2 rounded-xl border border-border bg-[oklch(1_0_0/0.05)] px-6 py-3 text-sm font-bold text-foreground hover:bg-[oklch(1_0_0/0.08)] transition-all"
        >
          <ArrowLeft className="size-4" />
          Volver al Inicio
        </button>
      </div>
    </section>
  )
}
