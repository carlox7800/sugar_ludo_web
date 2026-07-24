'use client'

import React, { useState } from 'react'
import { AlertTriangle, UserPlus, Check } from 'lucide-react'

interface NicknameSetupModalProps {
  onConfirm: (nickname: string) => void
}

export function NicknameSetupModal({ onConfirm }: NicknameSetupModalProps) {
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState('')

  const isValid = nickname.length >= 3 && nickname.length <= 20 && /^[a-zA-Z0-9_ ]+$/.test(nickname)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isValid) {
      setError('El apodo debe tener entre 3 y 20 caracteres y solo puede contener letras, números, espacios y _.')
      return
    }
    onConfirm(nickname.trim())
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-background/95 backdrop-blur-xl">
      <div className="animate-in fade-in zoom-in-95 flex w-full max-w-md flex-col items-center">
        
        <div className="mb-6 flex size-20 items-center justify-center rounded-3xl bg-[linear-gradient(145deg,oklch(0.82_0.15_200),oklch(0.7_0.27_350))] shadow-[0_0_30px_oklch(0.7_0.27_350/0.4)]">
          <UserPlus className="size-10 text-primary-foreground" />
        </div>

        <h1 className="font-display text-3xl font-extrabold text-foreground text-center mb-2">Crea tu Identidad</h1>
        <p className="text-muted-foreground text-center mb-8">
          ¿Cómo quieres que te llamen los demás jugadores?
        </p>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-6">
          <div className="relative w-full">
            <input
              type="text"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value)
                setError('')
              }}
              placeholder="Ingresa tu Nickname..."
              maxLength={20}
              className="w-full rounded-2xl border-2 border-[var(--candy-magenta)]/30 bg-[oklch(0_0_0/0.2)] px-6 py-4 font-display text-xl text-center text-foreground outline-none transition-colors focus:border-[var(--candy-magenta)] focus:bg-[oklch(0_0_0/0.4)] placeholder:text-muted-foreground/50"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
              {nickname.length}/20
            </span>
          </div>

          {error && <p className="text-center text-sm font-bold text-[oklch(0.65_0.22_25)]">{error}</p>}

          <div className="rounded-xl border border-[var(--candy-orange)]/40 bg-[var(--candy-orange)]/10 p-4 flex gap-3 items-start">
            <AlertTriangle className="size-5 shrink-0 text-[var(--candy-orange)] mt-0.5" />
            <p className="text-sm font-semibold text-[var(--candy-orange)] leading-relaxed">
              ⚠️ Una vez establecido tu Nickname, solo podrás cambiarlo después de 90 días. Piensa bien tu elección.
            </p>
          </div>

          <button
            type="submit"
            disabled={!isValid || nickname.trim().length < 3}
            className="btn-3d flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--candy-cyan)] py-4 font-display text-lg font-extrabold text-[oklch(0.18_0.03_285)] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_4px_15px_oklch(0.82_0.15_200/0.4)]"
          >
            Confirmar Nickname <Check className="size-5" />
          </button>
        </form>
      </div>
    </div>
  )
}
