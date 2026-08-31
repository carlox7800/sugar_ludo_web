'use client'

import React, { useState, useEffect } from 'react'
import { cashierLogger, CashierLogEntry, CashierLogLevel } from '../../lib/cashier-logger'
import { Terminal, X, Copy, Check, Trash2, ShieldAlert, Zap, Filter, Search } from 'lucide-react'

export function CashierLogPanel() {
  const [isMounted, setIsMounted] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [logs, setLogs] = useState<CashierLogEntry[]>([])
  const [copied, setCopied] = useState(false)
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    setIsMounted(true)
    setLogs([...cashierLogger.getLogs()])
    const unsubscribe = cashierLogger.subscribe(() => {
      setLogs([...cashierLogger.getLogs()])
    })
    return () => unsubscribe()
  }, [])

  if (!isMounted) return null

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

  const handleTestEvent = () => {
    cashierLogger.click('Botón de Prueba [⚡ Probar]', {
      testTime: new Date().toISOString(),
      status: 'OK',
      note: 'Verificación manual de la consola de diagnóstico en vivo'
    })
    cashierLogger.action('Verificación de Integridad de Logs', {
      sistema: 'Sugar Ludo Admin Hub',
      version: '8.6.9'
    })
  }

  const getLevelBadge = (level: CashierLogLevel) => {
    switch (level) {
      case 'ERROR':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/40'
      case 'CLICK':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40'
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

  const filteredLogs = logs.filter((log) => {
    if (selectedLevel !== 'ALL' && log.level !== selectedLevel) {
      return false
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      const matchMsg = log.message.toLowerCase().includes(q)
      const matchDet = log.details ? JSON.stringify(log.details).toLowerCase().includes(q) : false
      return matchMsg || matchDet
    }
    return true
  })

  const errorCount = logs.filter((l) => l.level === 'ERROR').length

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-2 px-3.5 py-2.5 rounded-2xl bg-slate-900/95 hover:bg-slate-800 text-cyan-400 border border-cyan-500/50 shadow-[0_0_25px_rgba(6,182,212,0.35)] text-xs font-mono font-bold transition-all cursor-pointer backdrop-blur-md hover:scale-105"
        title="Ver Consola de Diagnóstico & Logs"
      >
        <Terminal className="size-4 text-cyan-400 animate-pulse" />
        <span>📋 Consola Logs</span>
        <span className="px-1.5 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px]">
          {logs.length}
        </span>
        {errorCount > 0 && (
          <span className="flex items-center gap-1 px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 text-[10px] border border-rose-500/40 animate-pulse">
            {errorCount} ❌
          </span>
        )}
      </button>

      {/* Logs Modal Window */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-4xl h-[85vh] flex flex-col rounded-3xl bg-slate-950 border border-cyan-500/40 shadow-2xl overflow-hidden font-mono text-xs">
            {/* Header */}
            <div className="px-5 py-3.5 bg-slate-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Terminal className="size-4 text-cyan-400" />
                <div>
                  <h3 className="font-bold text-white tracking-wide text-xs flex items-center gap-2">
                    <span>CONSOLA DE DIAGNÓSTICO EN VIVO (ADMIN & CAJERO)</span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[10px] font-bold">v8.6.9</span>
                  </h3>
                  <p className="text-[10px] text-slate-400">
                    Captura en tiempo real de clics, peticiones API, Firestore y errores
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestEvent}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[11px] font-bold transition-colors cursor-pointer"
                  title="Generar evento de prueba para verificar captura"
                >
                  <Zap className="size-3.5 text-cyan-400" />
                  <span>Probar Registro</span>
                </button>

                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/20 to-teal-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 text-emerald-300 border border-emerald-500/30 font-sans text-xs font-bold transition-colors cursor-pointer"
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

            {/* Filter Toolbar */}
            <div className="px-5 py-2.5 bg-slate-900/60 border-b border-white/5 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              {/* Level Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto">
                <Filter className="size-3.5 text-slate-400 mr-1 shrink-0" />
                {[
                  { id: 'ALL', label: `Todos (${logs.length})` },
                  { id: 'CLICK', label: 'Clics' },
                  { id: 'ACTION', label: 'Acciones' },
                  { id: 'API', label: 'Red / API' },
                  { id: 'FIRESTORE', label: 'Firestore' },
                  { id: 'ERROR', label: `Errores (${errorCount})` }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedLevel(tab.id)}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer shrink-0 ${
                      selectedLevel === tab.id
                        ? 'bg-cyan-500 text-slate-950 shadow-sm'
                        : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Search in logs */}
              <div className="relative">
                <Search className="size-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar en logs..."
                  className="w-44 sm:w-56 bg-slate-950 border border-white/10 rounded-xl pl-8 pr-3 py-1 text-slate-200 placeholder-slate-500 text-[11px] focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Logs Stream Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-2 bg-[#050811]">
              {filteredLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2 text-center p-6">
                  <Terminal className="size-8 text-slate-700" />
                  <p className="text-xs">No hay eventos para los filtros seleccionados.</p>
                  <p className="text-[10px] text-slate-600">
                    Interactúa con botones, validaciones o presiona [Probar Registro].
                  </p>
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className={`p-3 rounded-2xl bg-slate-900/70 border space-y-1.5 transition-colors ${
                      log.level === 'ERROR'
                        ? 'border-rose-500/40 bg-rose-950/20'
                        : 'border-white/5 hover:border-white/15'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] text-slate-500 font-mono">{log.timestamp}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold border ${getLevelBadge(log.level)}`}>
                        {log.level}
                      </span>
                      <span className="text-slate-200 font-semibold flex-1 break-words">{log.message}</span>
                    </div>
                    {log.details !== undefined && (
                      <pre className="text-[10px] text-slate-300 bg-black/60 p-2.5 rounded-xl overflow-x-auto border border-white/5 font-mono whitespace-pre-wrap leading-relaxed">
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

