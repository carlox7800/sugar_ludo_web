'use client'

import React, { useState, useRef } from 'react'
import { X, Check, Upload, Loader2, Image as ImageIcon } from 'lucide-react'
import { processAndUploadToImgBB } from '@/lib/imgbb-upload'

interface AvatarSelectorModalProps {
  isOpen: boolean
  onClose: () => void
  currentAvatar: string | null
  onSelect: (avatarIdOrUrl: string, deleteUrl?: string) => void
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
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement | null>(null)

  if (!isOpen) return null

  const isCustomUrl = currentAvatar?.startsWith('http') || currentAvatar?.startsWith('data:')

  const handleConfirm = () => {
    if (selectedId) {
      onSelect(selectedId)
      onClose()
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setIsUploading(true)
      setUploadError(null)

      const { imageUrl, deleteUrl } = await processAndUploadToImgBB(file)
      onSelect(imageUrl, deleteUrl)
      onClose()
    } catch (err: any) {
      console.error('Error al procesar/subir imagen:', err)
      setUploadError(err.message || 'Fallo al subir la imagen. Intenta de nuevo.')
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div 
        className="backdrop-in fixed inset-0 bg-black/80 backdrop-blur-sm" 
        onClick={() => !isUploading && onClose()} 
      />
      
      <div className="animate-in fade-in zoom-in-95 glass relative z-10 flex w-full max-w-md flex-col overflow-hidden rounded-3xl border border-border p-6 shadow-2xl">
        <button
          onClick={onClose}
          disabled={isUploading}
          className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-50"
        >
          <X className="size-5" />
        </button>

        <div className="mb-5 text-center">
          <h3 className="font-display text-2xl font-extrabold text-foreground">Elige tu Avatar</h3>
          <p className="text-sm text-muted-foreground mt-1">Selecciona un icono o sube tu propia foto</p>
        </div>

        {/* Input file oculto */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileChange} 
        />

        {/* Botón de Cargar desde Galería */}
        <div className="mb-6">
          <button
            type="button"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
            className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl border border-[var(--candy-cyan)]/40 bg-[oklch(0.82_0.15_200/0.12)] hover:bg-[oklch(0.82_0.15_200/0.2)] py-3 font-display text-sm font-extrabold text-[var(--candy-cyan)] shadow-[0_0_15px_oklch(0.82_0.15_200/0.2)] transition-all active:scale-95 disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="size-5 animate-spin" />
                <span>Subiendo a ImgBB...</span>
              </>
            ) : (
              <>
                <ImageIcon className="size-5" />
                <span>Cargar desde Galería (PC / Móvil)</span>
                <Upload className="size-4 opacity-70 ml-auto" />
              </>
            )}
          </button>
          
          {uploadError && (
            <p className="mt-2 text-center text-xs font-bold text-rose-400">
              ⚠️ {uploadError}
            </p>
          )}

          {isCustomUrl && !isUploading && (
            <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-white/5 p-2">
              <div className="size-8 rounded-full overflow-hidden border border-white/20">
                <img src={currentAvatar!} alt="Avatar actual" className="size-full object-cover" />
              </div>
              <span className="text-xs font-semibold text-white/80">Foto personalizada activa</span>
            </div>
          )}
        </div>

        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
          <span className="relative bg-[oklch(0.14_0.03_285)] px-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">O elige un Preset</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          {PRESET_AVATARS.map((avatar) => (
            <button
              key={avatar.id}
              disabled={isUploading}
              onClick={() => setSelectedId(avatar.id)}
              className={`group flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-3 transition-all ${
                selectedId === avatar.id && !isCustomUrl
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
          disabled={isUploading}
          className="btn-3d flex w-full items-center justify-center gap-2 rounded-xl bg-[linear-gradient(145deg,oklch(0.82_0.15_200),oklch(0.7_0.27_350))] py-3.5 font-display text-lg font-extrabold text-primary-foreground shadow-[0_4px_12px_oklch(0.7_0.27_350/0.4)] disabled:opacity-50"
        >
          Confirmar Preset <Check className="size-5" />
        </button>
      </div>
    </div>
  )
}
