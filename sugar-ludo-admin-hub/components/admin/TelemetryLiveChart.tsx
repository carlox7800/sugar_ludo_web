'use client'

import React from 'react'
import { GameTelemetry } from '../../types/treasury'
import { Activity, Server, Users, Zap, Wifi } from 'lucide-react'

interface TelemetryLiveChartProps {
  telemetry: GameTelemetry
}

export function TelemetryLiveChart({ telemetry }: TelemetryLiveChartProps) {
  const total = telemetry.totalPlayersOnline || 1
  const offlinePct = Math.round((telemetry.offlineMatchesCount / total) * 100)
  const onlineTrainingPct = Math.round((telemetry.onlineTrainingPlayersCount / total) * 100)
  const competitivePct = Math.round((telemetry.competitivePlayersCount / total) * 100)

  return (
    <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="size-4 text-cyan-400" /> TELEMETRÍA DE JUGADORES Y SERVIDOR EN VIVO
          </h2>
          <p className="text-[11px] text-slate-400 font-mono">
            Monitoreo en tiempo real de salas de juego multijugador y latencia de Socket.IO
          </p>
        </div>

        {/* Server Ping Badge */}
        <div className="flex items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-2xl border border-white/5 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-bold text-white uppercase">juego-de-servidor</span>
          </div>
          <div className="h-4 w-px bg-white/10" />
          <div className="flex items-center gap-1 text-emerald-400 font-mono font-bold">
            <Wifi className="size-3.5" />
            <span>{telemetry.serverLatencyMs} ms</span>
          </div>
        </div>
      </div>

      {/* Mode Distribution Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Offline Mode */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Modo Offline (4J / 6J)</span>
            <span className="text-cyan-400 font-mono font-bold">{offlinePct}%</span>
          </div>
          <p className="text-2xl font-black text-white font-mono">{telemetry.offlineMatchesCount}</p>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-cyan-400 h-full rounded-full transition-all duration-500" style={{ width: `${offlinePct}%` }} />
          </div>
          <span className="text-[10px] text-slate-500 block">Partidas locales en dispositivo ($0.00 ancho de banda)</span>
        </div>

        {/* Online Training */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Entrenamiento Online</span>
            <span className="text-pink-400 font-mono font-bold">{onlineTrainingPct}%</span>
          </div>
          <p className="text-2xl font-black text-white font-mono">{telemetry.onlineTrainingPlayersCount}</p>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-pink-400 h-full rounded-full transition-all duration-500" style={{ width: `${onlineTrainingPct}%` }} />
          </div>
          <span className="text-[10px] text-slate-500 block">Salas de práctica y amistosas 1v1</span>
        </div>

        {/* Competitive Mode */}
        <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Modo Competitivo (SC)</span>
            <span className="text-emerald-400 font-mono font-bold">{competitivePct}%</span>
          </div>
          <p className="text-2xl font-black text-white font-mono">{telemetry.competitivePlayersCount}</p>
          <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
            <div className="bg-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${competitivePct}%` }} />
          </div>
          <span className="text-[10px] text-slate-500 block">Mesas con arbitraje autoritativo y Rake activo</span>
        </div>

      </div>
    </div>
  )
}
