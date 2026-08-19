'use client'

import React from 'react'
import { Swords, Check, X, Shield, Sparkles } from 'lucide-react'
import { PRESET_AVATARS } from '@/components/avatar-selector-modal'
import { DuelChallengeItem } from '@/lib/friends-service'

function renderAvatar(avatar?: string, className = "size-full object-cover rounded-full") {
  if (!avatar) return '🎲'
  if (avatar.startsWith('http') || avatar.startsWith('data:')) {
    return <img src={avatar} alt="Avatar" className={className} />
  }
  const preset = PRESET_AVATARS.find(a => a.id === avatar)
  if (preset) return preset.emoji
  return avatar
}

interface DuelChallengeModalProps {
  challenge: DuelChallengeItem
  onAccept: (challenge: DuelChallengeItem) => void
  onReject: (challenge: DuelChallengeItem) => void
}

export function DuelChallengeModal({ challenge, onAccept, onReject }: DuelChallengeModalProps) {
  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in zoom-in-95">
      <div className="glass max-w-sm w-full rounded-3xl p-6 border-2 border-[var(--candy-cyan)] shadow-[0_0_50px_rgba(34,221,221,0.4)] flex flex-col gap-4 text-center bg-[oklch(0.14_0.03_285/0.98)] backdrop-blur-2xl">
        
        {/* Animated Icon Badge */}
        <div className="relative mx-auto">
          <div className="size-20 rounded-full flex items-center justify-center text-4xl border-2 border-[var(--candy-cyan)]/60 overflow-hidden bg-black/60 shadow-[0_0_25px_rgba(34,221,221,0.5)]">
            {renderAvatar(challenge.senderAvatar)}
          </div>
          <div className="absolute -bottom-2 -right-2 size-8 rounded-full bg-[linear-gradient(135deg,var(--candy-magenta),var(--candy-orange))] text-white flex items-center justify-center border-2 border-background shadow-lg">
            <Swords className="size-4 animate-bounce" />
          </div>
        </div>

        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--candy-cyan)]/20 border border-[var(--candy-cyan)]/40 text-[var(--candy-cyan)] font-display text-[11px] font-extrabold uppercase tracking-wider mb-2">
            <Sparkles className="size-3 animate-spin" /> ¡Desafío de Duelo 1 vs 1!
          </div>
          <h3 className="font-display text-xl font-black text-white">
            {challenge.senderName} te ha retado
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Nivel {challenge.senderLevel} • {challenge.senderTrophies} Copas 🏆
          </p>
        </div>

        <div className="flex flex-col gap-2 bg-black/40 rounded-2xl p-3.5 border border-white/10 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Modo:</span>
            <span className="font-bold text-[var(--candy-cyan)]">Entrenamiento Online (1 vs 1)</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Código de Sala:</span>
            <span className="font-mono font-black text-white bg-white/10 px-2 py-0.5 rounded-md text-xs">{challenge.roomCode}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <button
            onClick={() => onReject(challenge)}
            className="btn-3d flex items-center justify-center gap-1.5 py-3 rounded-2xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-display text-xs font-bold transition-all"
          >
            <X className="size-4" />
            <span>Rechazar</span>
          </button>

          <button
            onClick={() => onAccept(challenge)}
            className="btn-3d flex items-center justify-center gap-1.5 py-3 rounded-2xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] font-display text-xs font-black text-[oklch(0.18_0.03_285)] shadow-lg shadow-[var(--candy-cyan)]/30 hover:scale-105 transition-all"
          >
            <Swords className="size-4" />
            <span>Aceptar ⚔️</span>
          </button>
        </div>
      </div>
    </div>
  )
}
