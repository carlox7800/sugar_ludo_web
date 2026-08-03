'use client'

import { Play, Bot, Globe, Trophy } from 'lucide-react'

export function GameModes({ 
  onStartTraining, 
  onStartOnlineTraining,
  onStartCompetitive
}: { 
  onStartTraining: () => void
  onStartOnlineTraining?: () => void
  onStartCompetitive?: () => void
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center gap-3 px-1">
        <span className="h-6 w-1.5 rounded-full bg-[var(--candy-magenta)] shadow-[0_0_12px_oklch(0.7_0.27_350/0.9)]" />
        <h2 className="font-display text-xl font-extrabold uppercase tracking-wide text-foreground">
          Modos de Juego
        </h2>
      </div>

      {/* Hero card */}
      <article
        onClick={onStartTraining}
        className="glass glass-hover group relative cursor-pointer overflow-hidden rounded-3xl p-6 sm:p-8"
      >
        <div className="pointer-events-none absolute -right-10 -top-10 size-56 rounded-full bg-[oklch(0.7_0.27_350/0.35)] blur-3xl transition-opacity duration-500 group-hover:opacity-80" />
        <div className="pointer-events-none absolute -bottom-16 right-16 size-56 rounded-full bg-[oklch(0.82_0.15_200/0.25)] blur-3xl" />

        <div className="relative flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-md">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-[oklch(1_0_0/0.06)] px-3 py-1 font-display text-xs font-bold text-[var(--candy-cyan)]">
              <Bot className="size-4" strokeWidth={2.4} />
              Recomendado
            </span>
            <h3 className="mt-3 font-display text-3xl font-extrabold leading-tight text-foreground text-balance">
              Entrenamiento con IA
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground text-pretty">
              Juega contra bots inteligentes y mejora tu estrategia antes de saltar a la arena
              competitiva.
            </p>
          </div>

          {/* Big 3D play button */}
          <button
            onClick={onStartTraining}
            aria-label="Jugar Entrenamiento con IA"
            className="btn-3d flex size-24 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,oklch(0.78_0.2_150),oklch(0.72_0.18_160))] shadow-[inset_0_3px_0_oklch(1_0_0/0.5),0_10px_0_oklch(0.5_0.14_155),0_18px_30px_oklch(0.5_0.14_155/0.6)]"
          >
            <Play
              className="size-11 translate-x-0.5 fill-[oklch(0.18_0.03_285)] text-[oklch(0.18_0.03_285)]"
              strokeWidth={1}
            />
          </button>
        </div>
      </article>

      {/* Secondary cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <ModeCard
          icon={Globe}
          title="Entrenamiento Online"
          subtitle="Online"
          accent="oklch(0.82 0.15 200)"
          gradient="oklch(0.82 0.15 200), oklch(0.62 0.22 300)"
          onClick={onStartOnlineTraining}
        />
        <ModeCard
          icon={Trophy}
          title="Competitivo"
          subtitle="Torneos"
          accent="oklch(0.78 0.18 55)"
          gradient="oklch(0.78 0.18 55), oklch(0.7 0.27 350)"
          onClick={onStartCompetitive}
        />
      </div>
    </section>
  )
}

function ModeCard({
  icon: Icon,
  title,
  subtitle,
  accent,
  gradient,
  tag,
  onClick,
}: {
  icon: typeof Globe
  title: string
  subtitle: string
  accent: string
  gradient: string
  tag?: string
  onClick?: () => void
}) {
  return (
    <button onClick={onClick} className="glass glass-hover group relative overflow-hidden rounded-3xl p-5 text-left">
      {tag && (
        <span className="absolute right-4 top-4 rounded-full bg-[var(--candy-orange)] px-3 py-1 font-display text-[11px] font-extrabold uppercase tracking-wide text-[oklch(0.2_0.05_40)] shadow-[0_0_16px_oklch(0.78_0.18_55/0.9)]">
          {tag}
        </span>
      )}

      <div
        className="flex size-14 items-center justify-center rounded-2xl shadow-[inset_0_2px_0_oklch(1_0_0/0.4)]"
        style={{ background: `linear-gradient(145deg, ${gradient})` }}
      >
        <Icon className="size-7 text-primary-foreground" strokeWidth={2.4} />
      </div>

      <h3 className="mt-4 font-display text-xl font-extrabold text-foreground">{title}</h3>
      <p
        className="mt-0.5 font-display text-sm font-bold uppercase tracking-wide"
        style={{ color: accent }}
      >
        {subtitle}
      </p>

      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
        Entrar
        <span className="transition-transform duration-300 group-hover:translate-x-1">→</span>
      </span>
    </button>
  )
}
