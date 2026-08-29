'use client'

import React, { useState, useEffect } from 'react'
import { cashierLogger, CashierLogEntry } from '../../lib/cashier-logger'
import { Terminal, X, Copy, Check, Trash2, ShieldAlert } from 'lucide-react'

export function CashierLogPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<CashierLogEntry[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setLogs([...cashierLogger.getLogs()])
    const unsubscribe = cashierLogger.subscribe(() => {
      setLogs([...cashierLogger.getLogs()])
    })
    return () => unsubscribe()
  }, [])

  const handleCopy = () => {
    const text = cashierLogger.exportLogs()
    navigator.clipboard.writeText(text || 'Sin registros de actividad')
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleClear = () => {
    cashierLogger.clear()
    setLogs([])
  }

  const getLevelBadge = (level: CashierLogEntry['level']) => {
    switch (level) {
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      case 'ACTION':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40'
      case 'API':
        return 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
      case 'FIRESTORE':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/40'
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40'
    }
  }

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-slate-900/90 hover:bg-slate-800 text-cyan-400 border border-cyan-500/40 shadow-[0_0_20px_rgba(6,182,212,0.2)] text-xs font-mono font-bold transition-all cursor-pointer backdrop-blur-md"
        title="Ver Consola de Diagnóstico / Logs"
      >
        <Terminal className="size-4 text-cyan-400 animate-pulse" />
        <span className="hidden sm:inline">Consola de Logs</span>
        {logs.some((l) => l.level === 'ERROR') && (
          <span className="size-2 rounded-full bg-rose-500 animate-ping" />
        )}
      </button>

      {/* Logs Modal Window */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-3xl h-[80vh] flex flex-col rounded-3xl bg-slate-950 border border-cyan-500/30 shadow-2xl overflow-hidden font-mono text-xs">
            {/* Header */}
            <div className="px-5 py-3.5 bg-slate-900 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Terminal className="size-4 text-cyan-400" />
                <h3 className="font-bold text-white tracking-wide">
                  CONSOLA DE DIAGNÓSTICO & LOGS (ADMIN / CAJERO)
                </h3>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  {logs.length} eventos
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-sans text-xs font-bold transition-colors cursor-pointer"
                  title="Copiar todos los logs al portapapeles"
                >
                  {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copied ? '¡Copiado!' : 'Copiar Todo'}</span>
                </button>

                <button
                  onClick={handleClear}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 transition-colors cursor-pointer"
                  title="Limpiar Consola"
                >
                  <Trash2 className="size-4" />
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 rounded-xl bg-white/5 hover:bg-white/20 text-slate-400 hover:text-white transition-colors cursor-pointer ml-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Logs Stream Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-[#050811]">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2">
                  <Terminal className="size-8 text-slate-700" />
                  <p>Sin eventos registrados aún en esta sesión.</p>
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl bg-slate-900/60 border border-white/5 space-y-1 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500">{log.timestamp}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${getLevelBadge(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-slate-200 font-semibold truncate flex-1">{log.message}</span>
                    </div>
                    {log.details && (
                      <pre className="text-[10px] text-slate-400 bg-black/50 p-2 rounded-lg overflow-x-auto">
                        {typeof log.details === 'string' ? log.details : JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
