'use client'

import { useState } from 'react'
import { Crown, Sparkles, Zap, Copy, Check } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { PRESET_AVATARS } from './avatar-selector-modal'
import { getSugarId } from '@/lib/friends-service'
import { copyToClipboardSilently } from '@/lib/utils'

export function ProfileCard({ onOpen }: { onOpen?: () => void }) {
  const { user } = useAuth()
  const [copiedId, setCopiedId] = useState(false)

  // Use preset avatars or default
  const getActiveAvatar = () => {
    if (!user) return PRESET_AVATARS[0]
    return PRESET_AVATARS.find(a => a.id === user.photoURL) || PRESET_AVATARS[0]
  }
  const activeAvatar = getActiveAvatar()
  const nickname = user?.nickname || 'Jugador'
  const playerId = getSugarId(user?.uid)

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation()
    copyToClipboardSilently(playerId).then(() => {
      setCopiedId(true)
      setTimeout(() => setCopiedId(false), 2000)
    })
  }

  return (
    <section 
      onClick={onOpen}
      role="button"
      tabIndex={0}
      aria-label="Ver Perfil de Jugador"
      className="glass glass-hover flex flex-col items-center gap-4 rounded-3xl p-6 text-center cursor-pointer"
    >
      {/* Avatar */}
      <div className="relative">
        <div className="absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,oklch(0.7_0.27_350),oklch(0.82_0.15_200),oklch(0.78_0.18_55),oklch(0.62_0.22_300),oklch(0.7_0.27_350))] blur-[2px]" />
        <div 
          className="relative flex size-28 items-center justify-center overflow-hidden rounded-full border-2 border-[oklch(1_0_0/0.3)] shadow-[inset_0_2px_8px_oklch(0_0_0/0.4)] text-[64px]"
          style={{ backgroundColor: `${activeAvatar.color}33`, color: activeAvatar.color }}
        >
          {user?.photoURL?.startsWith('http') || user?.photoURL?.startsWith('data:') ? (
            <img src={user.photoURL} alt="Avatar" className="size-full object-cover rounded-full" />
          ) : (
            activeAvatar.emoji
          )}
        </div>
        <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-[var(--candy-gold)] px-2.5 py-1 font-display text-[11px] font-extrabold text-[oklch(0.25_0.08_60)] shadow-[0_4px_10px_oklch(0.85_0.16_90/0.6)]">
          <Crown className="size-3" strokeWidth={2.6} />
          VIP
        </span>
      </div>

      <div className="mt-2 flex flex-col items-center gap-1">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[var(--candy-cyan)]">
          Bienvenido
        </p>
        <h2 className="font-display text-2xl font-extrabold text-foreground">{nickname}</h2>
        
        {/* Número de ID Único Visible */}
        <button
          onClick={handleCopyId}
          title="Copiar mi ID único de jugador"
          className="flex items-center gap-1.5 px-3 py-1 mt-0.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-white transition-all text-xs font-mono group/id cursor-pointer"
        >
          <span className="text-[10px] uppercase font-bold text-[var(--candy-cyan)]">ID:</span>
          <span className="font-black text-foreground tracking-wider">{playerId}</span>
          {copiedId ? (
            <Check className="size-3 text-emerald-400" />
          ) : (
            <Copy className="size-3 text-muted-foreground/60 group-hover/id:text-white transition-colors" />
          )}
        </button>
      </div>

      {/* Active XP Booster Badge */}
      {(() => {
        const activeBooster = (user as any)?.activeBoosters?.find((b: any) => b && Number(b.expiresAt) > Date.now())
        if (!activeBooster) return null
        const remainingHours = Math.max(0, Math.ceil((Number(activeBooster.expiresAt) - Date.now()) / (3600 * 1000)))
        return (
          <div className="flex items-center gap-1.5 rounded-full border border-[var(--candy-gold)]/50 bg-[var(--candy-gold)]/15 px-3 py-1 text-[11px] font-black text-[var(--candy-gold)] shadow-[0_0_12px_rgba(255,215,0,0.25)] animate-pulse">
            <Zap className="size-3.5 fill-current" />
            <span>XP x{activeBooster.multiplier} Activo (~{remainingHours}h)</span>
          </div>
        )
      })()}

      {/* Status badge */}
      <div className="flex items-center gap-2 rounded-full border border-border bg-[linear-gradient(120deg,oklch(0.7_0.27_350/0.25),oklch(0.62_0.22_300/0.25))] px-4 py-2">
        <Sparkles className="size-4 text-[var(--candy-magenta)]" strokeWidth={2.4} />
        <span className="font-display text-sm font-bold text-foreground">Maestro del Dulce</span>
      </div>

      {/* Mini stats */}
      <div className="mt-1 grid w-full grid-cols-2 gap-3">
        <Stat label="Victorias" value={(user?.totalWins || 0).toString()} accent="var(--candy-cyan)" />
        <Stat label="Racha" value={(user?.winStreak || 0).toString()} accent="var(--candy-orange)" />
      </div>
    </section>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="rounded-2xl border border-border bg-[oklch(1_0_0/0.04)] p-3">
      <p className="font-display text-2xl font-extrabold" style={{ color: accent }}>
        {value}
      </p>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
    </div>
  )
}
