'use client'

import React, { useEffect, useState } from 'react'
import { X, History, Trophy, Swords, Calendar, Clock, Award, Loader2 } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { fetchMatchHistory, MatchRecord } from '@/lib/stats-service'

interface HistoryModalProps {
  isOpen: boolean
  onClose: () => void
}

export function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const { user } = useAuth()
  const [history, setHistory] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isOpen && user?.uid) {
      setLoading(true)
      fetchMatchHistory(user.uid)
        .then((records) => setHistory(records))
        .finally(() => setLoading(false))
    }
  }, [isOpen, user?.uid])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="backdrop-in fixed inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" 
        onClick={onClose} 
      />

      {/* Sheet Panel */}
      <div className="animate-in fade-in zoom-in-95 glass relative z-10 flex w-full max-w-lg max-h-[85dvh] flex-col overflow-hidden rounded-3xl border border-border p-6 shadow-2xl bg-[oklch(0.14_0.03_285/0.96)]">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--candy-cyan)]/20 border border-[var(--candy-cyan)]/30 text-[var(--candy-cyan)]">
              <History className="size-5" />
            </div>
            <div>
              <h3 className="font-display text-xl font-extrabold text-foreground">Historial de Partidas</h3>
              <p className="text-xs text-muted-foreground">Registro de batallas jugadas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto pt-4 space-y-3 pr-1">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
              <Loader2 className="size-8 animate-spin text-[var(--candy-magenta)]" />
              <span className="font-display text-sm">Cargando tu historial...</span>
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
              <Swords className="size-12 opacity-30 text-[var(--candy-cyan)]" />
              <p className="font-display text-base font-bold text-foreground">Aún no hay partidas registradas</p>
              <p className="text-xs max-w-xs text-muted-foreground">Juega una partida de entrenamiento o en línea para comenzar a registrar tu historial.</p>
            </div>
          ) : (
            history.map((record) => {
              const isWin = record.rank === 1
              return (
                <div 
                  key={record.id || Math.random()} 
                  className={`flex flex-col gap-2 rounded-2xl border p-4 transition-all ${
                    isWin 
                      ? 'border-[var(--candy-gold)]/40 bg-[linear-gradient(135deg,oklch(0.85_0.16_90/0.1),transparent)] shadow-[0_0_15px_oklch(0.85_0.16_90/0.08)]' 
                      : 'border-border bg-[oklch(1_0_0/0.03)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex items-center gap-1 rounded-full px-3 py-1 font-display text-xs font-extrabold ${
                        isWin 
                          ? 'bg-[var(--candy-gold)] text-[oklch(0.2_0.08_60)] shadow-md' 
                          : 'bg-white/10 text-white/80'
                      }`}>
                        {isWin ? <Trophy className="size-3.5" /> : null}
                        Posición #{record.rank}
                      </span>
                      <span className="font-display text-xs font-bold text-foreground/90">
                        {record.mode}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 font-display text-xs font-extrabold text-[var(--candy-cyan)]">
                      <Award className="size-3.5" />
                      <span>+{record.xpGained} XP</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t border-white/5">
                    <div className="flex items-center gap-1">
                      <Calendar className="size-3" />
                      <span>{record.dateStr}</span>
                    </div>
                    {record.opponents && record.opponents.length > 0 && (
                      <div className="truncate max-w-[200px]" title={record.opponents.join(', ')}>
                        vs {record.opponents.join(', ')}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
