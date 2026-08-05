'use client'

import { useEffect } from 'react'
import { X, BookOpen, Flag, ShieldAlert, Zap, Target } from 'lucide-react'

interface GameGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export function GameGuideModal({ isOpen, onClose }: GameGuideModalProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="backdrop-in fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity cursor-pointer" 
      />

      {/* Sheet Panel */}
      <div className="sheet-open glass relative z-10 flex w-full max-w-2xl max-h-[90dvh] flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl bg-[oklch(0.14_0.03_285/0.95)]">
        {/* Drag handle visual */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-border/40">
          <div className="flex items-center gap-3">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)]">
              <BookOpen className="size-5" />
            </div>
            <h2 className="font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
              Guía Rápida de Juego
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-3d flex size-9 items-center justify-center rounded-xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground"
            aria-label="Cerrar guía"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-8 custom-scrollbar">
          
          <div className="text-center mb-2">
            <h3 className="font-display text-2xl font-extrabold text-[var(--candy-magenta)] neon-magenta mb-2">
              REGLAMENTO OFICIAL
            </h3>
            <p className="text-sm text-muted-foreground">
              Todo lo que necesitas saber para dominar Sugar Ludo.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {/* Sec 1: Salida */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-green-500/20 text-green-400">
                  <Flag className="size-5" />
                </div>
                <h4 className="font-display text-sm font-extrabold uppercase text-foreground">
                  Salida de Fichas
                </h4>
              </div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
                <li>Necesitas sacar un <strong>5</strong> (o que los dados sumen 5) para sacar una ficha de tu base.</li>
                <li>Si tienes fichas en base y sacas un 5, el juego te obligará a sacarlas.</li>
                <li>El recorrido completo abarca 57 casillas (Modo 4p) o 83 casillas (Modo 5-6p).</li>
              </ul>
            </div>

            {/* Sec 2: Capturas */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-red-500/20 text-red-400">
                  <Target className="size-5" />
                </div>
                <h4 className="font-display text-sm font-extrabold uppercase text-foreground">
                  Capturas y Bonos
                </h4>
              </div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
                <li>Si caes en la misma casilla que un rival, lo <strong>capturas</strong> y lo devuelves a su base.</li>
                <li>Por cada captura, recibes una bonificación de <strong>+20 pasos</strong> (4p) o <strong>+25 pasos</strong> (5-6p) para mover otra ficha.</li>
                <li>Las casillas con <strong>Estrellas</strong> son seguras; no puedes capturar en ellas.</li>
              </ul>
            </div>

            {/* Sec 3: Reglas Especiales */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-yellow-500/20 text-yellow-400">
                  <ShieldAlert className="size-5" />
                </div>
                <h4 className="font-display text-sm font-extrabold uppercase text-foreground">
                  Castigos y Barreras
                </h4>
              </div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
                <li>Dos fichas del mismo color en la misma casilla forman una <strong>barrera</strong> impasable.</li>
                <li>Si sacas <strong>3 dobles consecutivos</strong>, tu última ficha movida será <strong>castigada</strong> regresando a la base.</li>
                <li>Si un rival saca ficha y tú estás en su casilla de salida, tu ficha es destruida.</li>
              </ul>
            </div>

            {/* Sec 4: Victoria */}
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-5">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)]">
                  <Zap className="size-5" />
                </div>
                <h4 className="font-display text-sm font-extrabold uppercase text-foreground">
                  Meta y Victoria
                </h4>
              </div>
              <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
                <li>Debes llegar a la casilla final con número exacto; si te pasas, rebotarás.</li>
                <li>Al coronar una ficha en la meta, recibes un bono de <strong>+10 pasos</strong> (4p) o <strong>+15 pasos</strong> (5-6p).</li>
                <li>El primer jugador en llevar todas sus fichas a la meta, ¡Gana la partida!</li>
              </ul>
            </div>
          </div>

          {/* Sec 5: Economía Competitiva */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[var(--candy-gold)] bg-[var(--candy-gold)]/10 p-5 mt-2">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--candy-gold)]/20 text-[var(--candy-gold)]">
                <Target className="size-5" />
              </div>
              <h4 className="font-display text-sm font-extrabold uppercase text-[var(--candy-gold)]">
                Economía Competitiva
              </h4>
            </div>
            <p className="text-sm text-foreground font-bold flex items-center gap-1 flex-wrap">
              En el Modo Competitivo compites por Sugar Coins <img src="/sugar-coin.png" alt="Coin" className="size-4 inline-block object-contain" />. La entrada se cobra al iniciar y los premios se reparten según el puesto:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-[var(--candy-gold)]/30 text-[var(--candy-gold)]">
                    <th className="py-2 pr-2">Jugadores</th>
                    <th className="py-2 px-2 text-red-400">Entrada</th>
                    <th className="py-2 px-2">Pozo</th>
                    <th className="py-2 pl-2">Premios (1º, 2º, 3º)</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b border-border/30">
                    <td className="py-2 pr-2 font-bold text-foreground">2 Jug</td>
                    <td className="py-2 px-2 text-red-400 font-bold flex items-center gap-0.5">-100 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" /></td>
                    <td className="py-2 px-2 font-bold text-foreground">-200 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 inline-block object-contain" /></td>
                    <td className="py-2 pl-2"><span className="text-emerald-400 font-bold">+150</span></td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2 pr-2 font-bold text-foreground">3 Jug</td>
                    <td className="py-2 px-2 text-red-400 font-bold flex items-center gap-0.5">-120 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" /></td>
                    <td className="py-2 px-2 font-bold text-foreground">-360 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 inline-block object-contain" /></td>
                    <td className="py-2 pl-2"><span className="text-emerald-400 font-bold">+200</span>, <span className="text-emerald-400/80 font-bold">+80</span></td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2 pr-2 font-bold text-foreground">4 Jug</td>
                    <td className="py-2 px-2 text-red-400 font-bold flex items-center gap-0.5">-150 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" /></td>
                    <td className="py-2 px-2 font-bold text-foreground">-600 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 inline-block object-contain" /></td>
                    <td className="py-2 pl-2"><span className="text-emerald-400 font-bold">+300</span>, <span className="text-emerald-400/80 font-bold">+150</span></td>
                  </tr>
                  <tr className="border-b border-border/30">
                    <td className="py-2 pr-2 font-bold text-foreground">5 Jug</td>
                    <td className="py-2 px-2 text-red-400 font-bold flex items-center gap-0.5">-200 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" /></td>
                    <td className="py-2 px-2 font-bold text-foreground">-1000 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 inline-block object-contain" /></td>
                    <td className="py-2 pl-2"><span className="text-emerald-400 font-bold">+400</span>, <span className="text-emerald-400/80 font-bold">+200</span>, <span className="text-emerald-400/60 font-bold">+100</span></td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2 font-bold text-foreground">6 Jug</td>
                    <td className="py-2 px-2 text-red-400 font-bold flex items-center gap-0.5">-300 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" /></td>
                    <td className="py-2 px-2 font-bold text-foreground">-1800 <img src="/sugar-coin.png" alt="Coin" className="size-3.5 inline-block object-contain" /></td>
                    <td className="py-2 pl-2"><span className="text-emerald-400 font-bold">+500</span>, <span className="text-emerald-400/80 font-bold">+250</span>, <span className="text-emerald-400/60 font-bold">+100</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Cierre */}
          <button
            onClick={onClose}
            className="mt-4 w-full rounded-2xl bg-[var(--candy-cyan)] py-3 font-display text-sm font-extrabold uppercase tracking-widest text-primary-foreground shadow-[0_4px_0_oklch(0.5_0.12_210)] transition-transform active:translate-y-1 active:shadow-none"
          >
            ¡ENTENDIDO!
          </button>
        </div>
      </div>
    </div>
  )
}
