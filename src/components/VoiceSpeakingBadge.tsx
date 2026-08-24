'use client'

import React, { memo } from 'react'
import { Mic, MicOff, Headphones } from 'lucide-react'

interface VoiceSpeakingBadgeProps {
  isSpeaking?: boolean
  isMuted?: boolean
  isDeafened?: boolean
  isListenerOnly?: boolean
  className?: string
  size?: 'sm' | 'md'
}

export const VoiceSpeakingBadge: React.FC<VoiceSpeakingBadgeProps> = memo(({
  isSpeaking = false,
  isMuted = false,
  isDeafened = false,
  isListenerOnly = false,
  className = '',
  size = 'md'
}) => {
  const isSmall = size === 'sm'

  if (isSpeaking) {
    return (
      <div 
        className={`flex items-center gap-1 rounded-full bg-[#052e16]/90 border border-emerald-400 px-1.5 py-0.5 shadow-[0_0_12px_rgba(74,222,128,0.7)] animate-in zoom-in duration-150 select-none pointer-events-none ${className}`}
        title="Hablando"
      >
        <Mic className={`${isSmall ? 'size-2.5' : 'size-3.5'} text-emerald-400 animate-pulse`} />
        <div className="flex items-end gap-[1.5px] h-3">
          <span className="w-[2px] bg-emerald-400 rounded-full animate-voice-bar-1" />
          <span className="w-[2px] bg-emerald-300 rounded-full animate-voice-bar-2" />
          <span className="w-[2px] bg-emerald-400 rounded-full animate-voice-bar-3" />
        </div>
      </div>
    )
  }

  if (isDeafened || isListenerOnly) {
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-[#0f172a]/90 border border-sky-400/60 p-1 shadow-[0_0_8px_rgba(56,189,248,0.4)] animate-in zoom-in duration-150 select-none pointer-events-none ${className}`}
        title={isListenerOnly ? "Modo Solo Oyente" : "Audio Ensordecido"}
      >
        <Headphones className={`${isSmall ? 'size-2.5' : 'size-3.5'} text-sky-400`} />
      </div>
    )
  }

  if (isMuted) {
    return (
      <div 
        className={`flex items-center justify-center rounded-full bg-[#450a0a]/90 border border-rose-500/60 p-1 shadow-[0_0_8px_rgba(244,63,94,0.4)] animate-in zoom-in duration-150 select-none pointer-events-none ${className}`}
        title="Micrófono Muteado"
      >
        <MicOff className={`${isSmall ? 'size-2.5' : 'size-3.5'} text-rose-400`} />
      </div>
    )
  }

  return null
})
