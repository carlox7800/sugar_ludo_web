'use client'

import { useState } from 'react'
import { ArrowLeft, Volume2, VolumeX, Play, BookOpen, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GameConfig } from '@/src/types'
import { GameGuideModal } from '@/components/game-guide-modal'

const PLAYER_OPTIONS = [2, 3, 4, 5, 6]

const DIFFICULTY_OPTIONS = [
  {
    id: 'facil',
    label: 'Fácil',
    desc: 'Fácil: movimientos aleatorios, ideal para aprender las reglas.',
    accent: 'oklch(0.78 0.2 150)',
    shadow: 'oklch(0.5 0.14 155)',
  },
  {
    id: 'medio',
    label: 'Medio',
    desc: 'Medio: heurística balanceada con prioridad de avance.',
    accent: 'oklch(0.82 0.15 200)',
    shadow: 'oklch(0.5 0.12 210)',
  },
  {
    id: 'inteligente',
    label: 'Inteligente',
    desc: 'Inteligente: estrategia avanzada, bloquea y captura sin piedad.',
    accent: 'oklch(0.7 0.27 350)',
    shadow: 'oklch(0.45 0.2 350)',
  },
] as const

export function AiTraining({ onBack, onStartGame }: { onBack: () => void, onStartGame: (config: GameConfig) => void }) {
  const [players, setPlayers] = useState(4)
  const [difficulty, setDifficulty] = useState<(typeof DIFFICULTY_OPTIONS)[number]['id']>('medio')
  const [muted, setMuted] = useState(false)
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  const handleStart = () => {
    console.log('Botón presionado');
    onStartGame({
      playerCount: players,
      botDifficulty: difficulty === 'facil' ? 'easy' : difficulty === 'medio' ? 'medium' : 'hard',
      humanColor: 'yellow',
      mode: 'ai'
    })
  }

  const activeDifficulty = DIFFICULTY_OPTIONS.find((d) => d.id === difficulty)!

  return (
    <section className="flex flex-col gap-5 md:gap-6">
      {/* Top navigation */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="glass glass-hover flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-5"
          aria-label="Volver al menú principal"
        >
          <span className="btn-3d flex size-10 items-center justify-center rounded-xl bg-[var(--candy-magenta)] shadow-[0_4px_0_oklch(0.45_0.2_350)]">
            <ArrowLeft className="size-5 text-primary-foreground" strokeWidth={2.6} />
          </span>
          <span className="font-display text-base font-extrabold uppercase tracking-wide text-foreground sm:text-lg">
            Entrenamiento con IA
          </span>
        </button>

        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          aria-pressed={muted}
          className="glass glass-hover flex size-12 shrink-0 items-center justify-center rounded-2xl text-[var(--candy-cyan)]"
        >
          {muted ? <VolumeX className="size-5" strokeWidth={2.4} /> : <Volume2 className="size-5" strokeWidth={2.4} />}
        </button>
      </div>

      {/* Central container */}
      <article className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-12 -top-12 size-60 rounded-full bg-[oklch(0.7_0.27_350/0.28)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 size-60 rounded-full bg-[oklch(0.82_0.15_200/0.2)] blur-3xl" />

        <div className="relative flex flex-col gap-5 sm:gap-6">
          {/* Title */}
          <header className="text-center">
            <h2 className="font-display text-3xl font-extrabold tracking-tight text-[var(--candy-magenta)] neon-magenta sm:text-4xl">
              SUGAR LUDO
            </h2>
            <p className="mt-1 font-display text-xs font-bold uppercase tracking-[0.25em] text-[var(--candy-cyan)] neon-cyan">
              Edición Clásica Premium
            </p>
          </header>

          {/* Block 1: player count */}
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground">
              <span className="h-5 w-1.5 rounded-full bg-[var(--candy-magenta)] shadow-[0_0_12px_oklch(0.7_0.27_350/0.9)]" />
              Cantidad de Jugadores
            </legend>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {PLAYER_OPTIONS.map((count) => (
                <PillButton
                  key={count}
                  selected={players === count}
                  onClick={() => setPlayers(count)}
                  accent="oklch(0.7 0.27 350)"
                  shadow="oklch(0.45 0.2 350)"
                >
                  {count} Jug
                </PillButton>
              ))}
            </div>
            <p className="text-center text-sm leading-relaxed text-muted-foreground text-pretty">
              Partida clásica de {players} jugadores (Tú contra {players - 1}{' '}
              {players - 1 === 1 ? 'Bot' : 'Bots'}).
            </p>
          </fieldset>

          {/* Block 2: bot difficulty */}
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground">
              <span className="flex size-5 items-center justify-center rounded-md bg-[var(--candy-cyan)] text-[oklch(0.16_0.03_285)] shadow-[0_0_12px_oklch(0.82_0.15_200/0.9)]">
                <Bot className="size-3.5" strokeWidth={2.8} />
              </span>
              Dificultad de los Bots
            </legend>
            <div className="grid grid-cols-3 gap-3">
              {DIFFICULTY_OPTIONS.map((opt) => (
                <PillButton
                  key={opt.id}
                  selected={difficulty === opt.id}
                  onClick={() => setDifficulty(opt.id)}
                  accent={opt.accent}
                  shadow={opt.shadow}
                >
                  {opt.label}
                </PillButton>
              ))}
            </div>
            <p className="text-center text-sm leading-relaxed text-muted-foreground text-pretty">
              {activeDifficulty.desc}
            </p>
          </fieldset>

          {/* Action buttons */}
          <div className="flex flex-col gap-2 pt-1">
            <button onClick={handleStart} className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.78_0.2_150),oklch(0.72_0.18_160))] py-3 font-display text-lg font-extrabold uppercase tracking-wide text-[oklch(0.18_0.03_285)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.5_0.14_155),0_14px_26px_oklch(0.5_0.14_155/0.55)]">
              <Play className="size-6 fill-current" strokeWidth={1} />
              Comenzar Juego
            </button>
            <button 
              onClick={() => setIsGuideOpen(true)}
              className="btn-3d flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-[oklch(1_0_0/0.06)] py-2.5 font-display text-base font-bold text-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.15)] hover:bg-[oklch(1_0_0/0.1)] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              <BookOpen className="size-5 text-[var(--candy-cyan)]" strokeWidth={2.4} />
              Guía rápida
            </button>
          </div>
        </div>
      </article>

      <GameGuideModal isOpen={isGuideOpen} onClose={() => setIsGuideOpen(false)} />
    </section>
  )
}

function PillButton({
  children,
  selected,
  onClick,
  accent,
  shadow,
}: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
  accent: string
  shadow: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'btn-3d rounded-2xl py-2.5 font-display text-sm sm:text-base font-extrabold transition-colors',
        selected
          ? 'text-[oklch(0.16_0.03_285)]'
          : 'border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground',
      )}
      style={
        selected
          ? {
              background: `linear-gradient(145deg, ${accent}, color-mix(in oklch, ${accent}, black 12%))`,
              boxShadow: `inset 0 2px 0 oklch(1 0 0 / 0.45), 0 5px 0 ${shadow}, 0 10px 20px color-mix(in oklch, ${shadow}, transparent 45%)`,
            }
          : undefined
      }
    >
      {children}
    </button>
  )
}
