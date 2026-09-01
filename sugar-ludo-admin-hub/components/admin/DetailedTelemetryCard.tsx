'use client'

import React from 'react'
import { DetailedTelemetry } from '../../types/admin-expanded'
import { Download, Users, Bot, Globe, Trophy, Compass, Wifi, RotateCcw } from 'lucide-react'

interface DetailedTelemetryCardProps {
  telemetry: DetailedTelemetry
  onResetTelemetry?: () => void
}

export function DetailedTelemetryCard({ telemetry, onResetTelemetry }: DetailedTelemetryCardProps) {
  const total = telemetry.totalOnlinePlayers || 1
  const lobbyPct = Math.round((telemetry.playersInLobby / total) * 100)
  const aiPct = Math.round((telemetry.playersInAITraining / total) * 100)
  const onlinePct = Math.round((telemetry.playersInOnlineTraining / total) * 100)
  const compPct = Math.round((telemetry.playersInCompetitive / total) * 100)

  return (
    <div className="p-6 rounded-3xl bg-slate-900/60 border border-white/10 space-y-6">
      {/* Top Banner: Downloads & Latency */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-white/10">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
            <Download className="size-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Descargas Totales Registradas</span>
            <p className="text-2xl font-black text-white font-mono">
              {telemetry.totalDownloadsCount.toLocaleString()} <span className="text-xs font-normal text-slate-400 font-sans">(Android / PWA / Web)</span>
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-slate-950/80 px-4 py-2 rounded-2xl border border-white/5 text-xs">
          <div>
            <span className="text-[10px] text-slate-400 uppercase font-bold block">Usuarios Registrados</span>
            <span className="font-mono font-bold text-white text-sm">{telemetry.totalRegisteredUsers.toLocaleString()}</span>
          </div>
          <div className="h-6 w-px bg-white/10" />
          <div className="flex items-center gap-1.5 text-emerald-400 font-mono font-bold">
            <Wifi className="size-4" />
            <span>{telemetry.serverLatencyMs} ms</span>
          </div>
          {onResetTelemetry && (
            <>
              <div className="h-6 w-px bg-white/10" />
              <button
                type="button"
                onClick={onResetTelemetry}
                className="px-2.5 py-1 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 text-[11px] font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                title="Restablecer contadores de presencia a 0 durante pruebas de QA"
              >
                <RotateCcw className="size-3" />
                <span>Resetear Telemetría</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* 4 Real-time Player States Breakdown */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <Users className="size-4 text-cyan-400" /> CONCURRENCIA EN TIEMPO REAL ({telemetry.totalOnlinePlayers} Jugadores Online)
          </h3>
          <span className="text-[11px] text-slate-400 font-mono">Salas Activas: <strong className="text-cyan-300">{telemetry.activeMatchRooms}</strong></span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          
          {/* 1. In Lobby */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-bold">
              <span className="flex items-center gap-1.5"><Compass className="size-4 text-cyan-400" /> En Lobby / App</span>
              <span className="font-mono text-cyan-300">{lobbyPct}%</span>
            </div>
            <p className="text-2xl font-black text-white font-mono">{telemetry.playersInLobby}</p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-cyan-400 h-full rounded-full" style={{ width: `${lobbyPct}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 block">Explorando tienda, inventario o chat</span>
          </div>

          {/* 2. AI Training */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-bold">
              <span className="flex items-center gap-1.5"><Bot className="size-4 text-purple-400" /> Entrenamiento IA</span>
              <span className="font-mono text-purple-300">{aiPct}%</span>
            </div>
            <p className="text-2xl font-black text-white font-mono">{telemetry.playersInAITraining}</p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-purple-400 h-full rounded-full" style={{ width: `${aiPct}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 block">Partidas locales 4J / 6J offline</span>
          </div>

          {/* 3. Online Training */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-slate-400 font-bold">
              <span className="flex items-center gap-1.5"><Globe className="size-4 text-pink-400" /> Entrenam. Online</span>
              <span className="font-mono text-pink-300">{onlinePct}%</span>
            </div>
            <p className="text-2xl font-black text-white font-mono">{telemetry.playersInOnlineTraining}</p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-pink-400 h-full rounded-full" style={{ width: `${onlinePct}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 block">Salas amistosas 1v1 y chat de voz</span>
          </div>

          {/* 4. Competitive with Bets */}
          <div className="p-4 rounded-2xl bg-slate-950/60 border border-emerald-500/20 space-y-2">
            <div className="flex items-center justify-between text-emerald-400 font-bold">
              <span className="flex items-center gap-1.5"><Trophy className="size-4 text-emerald-400" /> Modo Competitivo</span>
              <span className="font-mono text-emerald-300">{compPct}%</span>
            </div>
            <p className="text-2xl font-black text-emerald-300 font-mono">{telemetry.playersInCompetitive}</p>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full" style={{ width: `${compPct}%` }} />
            </div>
            <span className="text-[10px] text-slate-500 block">Mesas con dinero real y Rake activo</span>
          </div>

        </div>
      </div>
    </div>
  )
}
