'use client'

import React, { useState } from 'react'
import { X, Check } from 'lucide-react'

interface AvatarSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  currentAvatar: string | null
  onSelect: (avatarId: string) => void
}

export const PRESET_AVATARS = [
  { id: '1', emoji: '🍭', name: 'Candy King', color: 'var(--candy-magenta)' },
  { id: '2', emoji: '🎲', name: 'Dice Master', color: 'var(--candy-cyan)' },
  { id: '3', emoji: '👑', name: 'Sugar Crown', color: 'var(--candy-gold)' },
  { id: '4', emoji: '🦄', name: 'Neon Unicorn', color: 'var(--candy-violet)' },
  { id: '5', emoji: '🍬', name: 'Sweet Ludo', color: 'var(--candy-orange)' },
  { id: '6', emoji: '⚡', name: 'Cyber Flash', color: 'oklch(0.7 0.27 350)' }, // custom pink
]

export function AvatarSelectorModal({ isOpen, onClose, currentAvatar, onSelect }: AvatarSelectorModalProps) {
  const [selectedId, setSelectedId] = useState<string | null>(currentAvatar || '1')

  if (!isOpen) return null

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div 
        className="backdrop-in fixed inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={onClose} 
      />
      
      <div className="animate-in fade-in zoom-in-95 glass relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground"
        >
          <X className="size-5" />
        </button>

        <div className="mb-6 text-center">
          <h3 className="font-display text-2xl font-extrabold text-foreground">Elige tu Avatar</h3>
          <p className="text-sm text-muted-foreground mt-1">Selecciona el icono que te representará</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {PRESET_AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              onClick={() => setSelectedId(avatar.id)}
              className={`group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-all ${
                selectedId === avatar.id 
                  ? 'border-[var(--candy-cyan)] bg-[oklch(1_0_0/0.1)] shadow-[0_0_20px_var(--candy-cyan)]'
                  : 'border-transparent bg-[oklch(1_0_0/0.05)] hover:bg-[oklch(1_0_0/0.08)]'
              }`}
            >
              <div 
                className="flex size-14 items-center justify-center rounded-full shadow-inner text-3xl"
                style={{ backgroundColor: `${avatar.color}33`, color: avatar.color }}
              >
                {avatar.emoji}
              </div>
              <span className="font-display text-[10px] font-bold uppercase tracking-wider text-muted-foreground group-hover:text-foreground truncate w-full text-center">
                {avatar.name}
              </span>
            </button>
          ))}
        </div>

        <button
          onClick={handleConfirm}
          className="btn-3d flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(145deg,oklch(0.82_0.15_200),oklch(0.7_0.27_350))] py-3.5 font-display text-lg font-extrabold text-primary-foreground shadow-[0_4px_12px_oklch(0.7_0.27_350/0.4)]"
        >
          Confirmar Avatar <Check className="size-5" />
        </button>
      </div>
    </div>
  )
}
