'use client'

import React from 'react'
import { Mic, MicOff, Headphones, Volume2, VolumeX, X, Sliders, ShieldCheck } from 'lucide-react'
import { useVoiceChat } from '@/lib/voice-context'
import { VoiceSpeakingBadge } from './VoiceSpeakingBadge'
import { cn } from '@/lib/utils'

export interface VoiceParticipant {
  uid: string
  name: string
  avatar?: string
  avatarColor?: string
}

interface VoiceControlPopoverProps {
  isOpen: boolean
  onClose: () => void
  participants: VoiceParticipant[]
}

export function VoiceControlPopover({ isOpen, onClose, participants }: VoiceControlPopoverProps) {
  const {
    isMuted,
    isDeafened,
    isListenerOnly,
    toggleMute,
    toggleDeafen,
    enableMicrophone,
    mutedUsers,
    userVolumes,
    setUserVolume,
    muteUser,
    isSpeakingMap
  } = useVoiceChat()

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        className="relative w-full max-w-sm bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-purple-950/95 border border-cyan-500/30 rounded-3xl p-5 shadow-[0_0_40px_rgba(6,182,212,0.25)] text-white z-10 flex flex-col gap-4 max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
              <Sliders className="size-4" />
            </div>
            <div>
              <h3 className="font-display font-black text-sm text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-pink-300 tracking-wide uppercase">
                Ajustes de Voz HD
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">Control de volumen individual (0-200%)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Master Controls */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Master Mic */}
          <button
            onClick={() => {
              if (isListenerOnly) {
                enableMicrophone()
              } else {
                toggleMute()
              }
            }}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border font-display font-bold text-xs transition-all cursor-pointer shadow-md active:scale-95",
              isListenerOnly
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 hover:bg-cyan-500/30 animate-pulse"
                : isMuted
                ? "bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30"
                : "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 hover:bg-emerald-500/30"
            )}
          >
            {isListenerOnly ? <Mic className="size-4 text-cyan-300" /> : isMuted ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            <span>{isListenerOnly ? 'Activar Mic' : isMuted ? 'Mic Silenciado' : 'Mic Activo'}</span>
          </button>

          {/* Master Deafen */}
          <button
            onClick={toggleDeafen}
            className={cn(
              "flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border font-display font-bold text-xs transition-all cursor-pointer shadow-md active:scale-95",
              isDeafened
                ? "bg-amber-500/20 text-amber-300 border-amber-500/50 hover:bg-amber-500/30"
                : "bg-slate-800/60 text-slate-300 border-white/10 hover:bg-slate-800"
            )}
          >
            <Headphones className="size-4" />
            <span>{isDeafened ? 'Ensordecido' : 'Audio General'}</span>
          </button>
        </div>

        {/* Individual Participants Volume Section */}
        <div className="flex flex-col gap-2.5 flex-1 overflow-y-auto pr-1">
          <div className="flex items-center justify-between text-[11px] font-display font-extrabold text-slate-400 uppercase tracking-wider px-1">
            <span>Amigos en la llamada</span>
            <span className="text-[10px] text-cyan-400 font-semibold flex items-center gap-1">
              <ShieldCheck className="size-3" /> DSP Activo
            </span>
          </div>

          {participants.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-400 bg-black/20 rounded-2xl border border-white/5 p-4">
              Esperando a que tus amigos se unan a la sala de voz...
            </div>
          ) : (
            participants.map((friend) => {
              const isFriendSpeaking = !!isSpeakingMap[friend.uid]
              const isFriendMuted = !!mutedUsers[friend.uid] || isDeafened
              const currentVol = isFriendMuted ? 0 : (userVolumes[friend.uid] ?? 1.3)
              const percentage = Math.round(currentVol * 100)

              return (
                <div
                  key={friend.uid}
                  className="flex flex-col gap-2 p-3 bg-black/40 border border-white/10 rounded-2xl shadow-inner"
                >
                  {/* User row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="relative size-8 rounded-full overflow-hidden border border-cyan-400/40 bg-slate-800 flex items-center justify-center">
                        {friend.avatar?.startsWith('http') ? (
                          <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-sm">{friend.avatar || '🎲'}</span>
                        )}
                        <VoiceSpeakingBadge isSpeaking={isFriendSpeaking} isMuted={isFriendMuted} isListenerOnly={false} />
                      </div>
                      <div>
                        <p className="text-xs font-display font-bold text-white truncate max-w-[130px]">
                          {friend.name}
                        </p>
                        <p className="text-[10px] font-semibold text-slate-400">
                          {isFriendMuted ? '🔇 Silenciado' : isFriendSpeaking ? '🗣️ Hablando' : '🎧 Conectado'}
                        </p>
                      </div>
                    </div>

                    {/* Mute toggle button */}
                    <button
                      onClick={() => muteUser(friend.uid, !mutedUsers[friend.uid])}
                      className={cn(
                        "p-2 rounded-xl border transition-all cursor-pointer active:scale-90",
                        mutedUsers[friend.uid]
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/50 hover:bg-rose-500/30"
                          : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                      )}
                      title={mutedUsers[friend.uid] ? "Reactivar audio" : "Silenciar a este jugador"}
                    >
                      {mutedUsers[friend.uid] ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                    </button>
                  </div>

                  {/* Volume Slider */}
                  <div className="flex items-center gap-2.5 pt-1">
                    <Volume2 className="size-3.5 text-slate-400 shrink-0" />
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      value={userVolumes[friend.uid] ?? 1.0}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value)
                        setUserVolume(friend.uid, val)
                        if (mutedUsers[friend.uid] && val > 0) {
                          muteUser(friend.uid, false)
                        }
                      }}
                      className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-cyan-400 focus:outline-none"
                    />
                    <span className={cn(
                      "text-[10px] font-mono font-bold w-9 text-right shrink-0",
                      percentage > 100 ? "text-cyan-300 font-black" : "text-slate-300"
                    )}>
                      {percentage}%
                    </span>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer note */}
        <p className="text-[10px] text-center text-slate-500 italic">
          El volumen predeterminado incluye +130% de ganancia vocal y cancelación de eco.
        </p>
      </div>
    </div>
  )
}
