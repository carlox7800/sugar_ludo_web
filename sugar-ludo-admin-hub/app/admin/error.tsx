'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[AdminErrorBoundary] Error capturado en /admin:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-lg w-full bg-slate-900 border border-red-500/30 rounded-3xl p-8 shadow-2xl shadow-red-950/40 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
          <AlertTriangle className="size-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-black text-white uppercase tracking-wider">
            Interrupción en Panel Super Admin
          </h2>
          <p className="text-sm text-slate-400">
            Se detectó un fallo inesperado al renderizar las métricas. El sistema protegió la sesión sin cerrar tu cuenta.
          </p>
        </div>

        {error?.message && (
          <div className="p-3.5 bg-black/40 border border-white/10 rounded-2xl text-left text-xs font-mono text-red-300 break-words overflow-auto max-h-32">
            {error.message}
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 transition-all cursor-pointer"
          >
            <RefreshCw className="size-4" /> Reintentar Carga
          </button>
          <Link
            href="/cashier"
            className="w-full sm:w-auto py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 font-semibold text-sm flex items-center justify-center gap-2 transition-all"
          >
            <ArrowLeft className="size-4" /> Hub Cajeros
          </Link>
        </div>
      </div>
    </div>
  )
}
