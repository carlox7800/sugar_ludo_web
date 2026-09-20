'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import { cashierLogger } from '../lib/cashier-logger'
import { APP_VERSION_TAG } from '../lib/version'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminHub Error Boundary]', error)
    cashierLogger.error(`Error en interfaz Admin Hub: ${error?.message || String(error)}`, {
      digest: error?.digest,
      stack: error?.stack,
      version: APP_VERSION_TAG,
      url: typeof window !== 'undefined' ? window.location.href : ''
    })
  }, [error])

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-950 text-white p-4 font-mono select-none">
      <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl bg-slate-900 border border-rose-500/30 shadow-[0_0_50px_rgba(244,63,94,0.15)] flex flex-col items-center text-center gap-5">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.25)]">
          <AlertTriangle className="size-8 animate-pulse" />
        </div>

        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-bold text-white tracking-wide flex items-center justify-center gap-2">
            <span>Incidencia en la Plataforma</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/30">
              {APP_VERSION_TAG}
            </span>
          </h2>
          <p className="text-xs text-slate-400 font-sans leading-relaxed">
            Se ha interceptado una excepción en la interfaz. El incidente ha sido registrado en la consola de auditoría.
          </p>
          {error?.digest && (
            <p className="text-[10px] text-slate-500 bg-slate-950 py-1 px-2 rounded-lg border border-white/5 break-all">
              Digest: {error.digest}
            </p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-lg shadow-cyan-600/20 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="size-4" />
            <span>Reintentar</span>
          </button>
          <a
            href="/"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs border border-white/10 transition-all cursor-pointer active:scale-95"
          >
            <Home className="size-4" />
            <span>Ir al Inicio</span>
          </a>
        </div>

        <p className="text-[10px] text-slate-500">
          Tip: Presiona <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-white/10 text-cyan-400">Ctrl + Shift + D</kbd> para inspeccionar los logs en vivo.
        </p>
      </div>
    </div>
  )
}
