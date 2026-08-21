'use client'
 
import { useEffect } from 'react'
import { Sparkles, RefreshCw } from 'lucide-react'
import { globalLogger } from '@/lib/logger'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Next.js Client Error Boundary caught error:', error)
    globalLogger.log('ERROR', `Error en interfaz (Error Boundary): ${error?.message || String(error)}`, {
      digest: error?.digest,
      stack: error?.stack
    })
  }, [error])

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#0d071b] text-foreground p-6 select-none cyber-bg">
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full text-center gap-5 p-8 rounded-3xl bg-[oklch(0.12_0.02_285/0.95)] backdrop-blur-xl border border-[var(--panel-border,oklch(0.7_0.27_350/0.3))] shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-in fade-in zoom-in">
        <div className="w-16 h-16 rounded-2xl bg-[var(--candy-cyan,oklch(0.82_0.15_200))/0.15] border border-[var(--candy-cyan,oklch(0.82_0.15_200))/0.4] flex items-center justify-center text-[var(--candy-cyan,oklch(0.82_0.15_200))] shadow-[0_0_20px_var(--candy-cyan,oklch(0.82_0.15_200))]">
          <Sparkles className="w-8 h-8 animate-pulse" />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-xl md:text-2xl font-black font-display text-white tracking-wide">
            Restableciendo Partida
          </h2>
          <p className="text-xs md:text-sm text-t-muted font-medium">
            Se detectó un cambio en tu conexión. Toca el botón para reanudar la mesa de juego de inmediato.
          </p>
        </div>

        <button
          onClick={() => reset()}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-2xl bg-gradient-to-r from-[var(--candy-cyan,oklch(0.82_0.15_200))] to-[var(--candy-magenta,oklch(0.65_0.28_340))] text-white font-extrabold text-sm md:text-base shadow-[0_0_25px_var(--candy-cyan,oklch(0.82_0.15_200))/0.4] hover:opacity-95 active:scale-95 transition-all cursor-pointer"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Reanudar Mesa</span>
        </button>
      </div>
    </div>
  )
}
