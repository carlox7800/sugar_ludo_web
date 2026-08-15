'use client'

import { useState, useEffect } from 'react'
import { X, Settings, Volume2, VolumeX, Smartphone, Palette, Copy, Check, LogOut, Info, Download } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { globalLogger } from '@/lib/logger'
import { APP_VERSION } from '@/lib/constants'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  onNavigateToLanding?: () => void
}

export function SettingsModal({ isOpen, onClose, onNavigateToLanding }: SettingsModalProps) {
  const { logout } = useAuth()
  const [isMuted, setIsMuted] = useState(false)
  const [vibration, setVibration] = useState(true)
  const [theme, setTheme] = useState<'dark' | 'sugar'>('dark')
  const [copiedLogs, setCopiedLogs] = useState(false)

  const handleLogout = async () => {
    await logout()
    onClose()
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedMuted = localStorage.getItem('sugar_sound_muted') === 'true'
      setIsMuted(savedMuted)

      const savedVib = localStorage.getItem('sugar_vibration_enabled') !== 'false'
      setVibration(savedVib)

      const savedTheme = (localStorage.getItem('sugar_app_theme') as 'dark' | 'sugar') || 'dark'
      setTheme(savedTheme)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const toggleSound = () => {
    const nextState = !isMuted
    setIsMuted(nextState)
    localStorage.setItem('sugar_sound_muted', String(nextState))
  }

  const toggleVibration = () => {
    const nextState = !vibration
    setVibration(nextState)
    localStorage.setItem('sugar_vibration_enabled', String(nextState))
  }

  const changeTheme = (newTheme: 'dark' | 'sugar') => {
    setTheme(newTheme)
    localStorage.setItem('sugar_app_theme', newTheme)
    if (newTheme === 'sugar') {
      document.documentElement.classList.add('theme-sugar')
    } else {
      document.documentElement.classList.remove('theme-sugar')
    }
  }

  const handleExportLogs = () => {
    const header = `[Sugar Ludo Logs Export]\nTimestamp: ${new Date().toISOString()}\nUser Agent: ${navigator.userAgent}\nTheme: ${theme}\nSound Muted: ${isMuted}\nStatus: System Nominal\n----------------------------------------\n`
    const logs = globalLogger.exportLogs()
    
    // Create a blob and download it instead of just copying to clipboard to allow larger files
    const blob = new Blob([header + logs], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sugar-ludo-logs-${new Date().getTime()}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    setCopiedLogs(true)
    setTimeout(() => setCopiedLogs(false), 2500)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end sm:items-center sm:justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose} 
        className="backdrop-in fixed inset-0 bg-black/70 backdrop-blur-md transition-opacity cursor-pointer" 
      />

      {/* Sheet Panel */}
      <div className="sheet-open glass relative z-10 flex w-full max-w-lg max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl bg-[oklch(0.14_0.03_285/0.95)]">
        {/* Drag handle visual */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1.5 w-12 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header bar */}
        <div className="flex items-center justify-between px-6 py-2 border-b border-border/40">
          <div className="flex items-center gap-2">
            <Settings className="size-5 text-[var(--candy-cyan)]" />
            <h2 className="font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
              Ajustes del Sistema
            </h2>
          </div>
          <button
            onClick={onClose}
            className="btn-3d flex size-9 items-center justify-center rounded-xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground"
            aria-label="Cerrar modal"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          {/* Audio & Vibration Controls */}
          <div className="flex flex-col gap-3">
            <h4 className="font-display text-xs font-extrabold uppercase tracking-wider text-muted-foreground">
              Preferencia de Audio & Respuesta
            </h4>
            
            {/* Sound Toggle */}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-4">
              <div className="flex items-center gap-3">
                <div className={`flex size-10 items-center justify-center rounded-xl ${!isMuted ? 'bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)]' : 'bg-muted/30 text-muted-foreground'}`}>
                  {!isMuted ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-sm font-bold text-foreground">Efectos de Sonido</span>
                  <span className="text-xs text-muted-foreground">Música y sonidos del juego</span>
                </div>
              </div>
              <button
                onClick={toggleSound}
                className={`relative h-7 w-12 rounded-full transition-colors ${!isMuted ? 'bg-[var(--candy-cyan)]' : 'bg-muted'}`}
              >
                <div className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${!isMuted ? 'left-6' : 'left-1'}`} />
              </button>
            </div>

            {/* Vibration Toggle */}
            <div className="flex items-center justify-between rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-4">
              <div className="flex items-center gap-3">
                <div className={`flex size-10 items-center justify-center rounded-xl ${vibration ? 'bg-[var(--candy-magenta)]/20 text-[var(--candy-magenta)]' : 'bg-muted/30 text-muted-foreground'}`}>
                  <Smartphone className="size-5" />
                </div>
                <div className="flex flex-col">
                  <span className="font-display text-sm font-bold text-foreground">Vibración Háptica</span>
                  <span className="text-xs text-muted-foreground">Retroalimentación al tirar dado</span>
                </div>
              </div>
              <button
                onClick={toggleVibration}
                className={`relative h-7 w-12 rounded-full transition-colors ${vibration ? 'bg-[var(--candy-magenta)]' : 'bg-muted'}`}
              >
                <div className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${vibration ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          </div>

          {/* Theme Carousel Selector */}
          <div className="flex flex-col gap-3">
            <h4 className="font-display text-xs font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Palette className="size-4" />
              Tema Visual
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => changeTheme('dark')}
                className={`btn-3d flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all ${
                  theme === 'dark'
                    ? 'border-[var(--candy-cyan)] bg-[var(--candy-cyan)]/15 text-foreground shadow-[0_0_15px_oklch(0.82_0.15_200/0.2)]'
                    : 'border-border bg-[oklch(1_0_0/0.03)] text-muted-foreground'
                }`}
              >
                <span className="font-display text-sm font-bold">Oscuro / Cyber</span>
                <span className="text-[10px] text-muted-foreground">Fondo neón profundo</span>
              </button>
              <button
                onClick={() => changeTheme('sugar')}
                className={`btn-3d flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all ${
                  theme === 'sugar'
                    ? 'border-[var(--candy-magenta)] bg-[var(--candy-magenta)]/15 text-foreground shadow-[0_0_15px_oklch(0.7_0.27_350/0.2)]'
                    : 'border-border bg-[oklch(1_0_0/0.03)] text-muted-foreground'
                }`}
              >
                <span className="font-display text-sm font-bold text-[var(--candy-magenta)]">Sugar Ludo</span>
                <span className="text-[10px] text-muted-foreground">Paleta rosada pastel</span>
              </button>
            </div>
          </div>

          {/* Utilities */}
          <div className="flex flex-col gap-3 pt-1">
            {onNavigateToLanding && (
              <button
                onClick={() => {
                  onClose()
                  onNavigateToLanding()
                }}
                className="btn-3d flex items-center justify-between rounded-2xl border border-[var(--candy-cyan)]/40 bg-[var(--candy-cyan)]/10 px-4 py-3 text-sm font-bold text-[var(--candy-cyan)] hover:bg-[var(--candy-cyan)]/20 transition-all shadow-[0_0_15px_rgba(6,182,212,0.15)]"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)]">
                    <Download className="size-4.5" />
                  </div>
                  <div className="flex flex-col text-left">
                    <span className="font-display text-sm font-bold text-foreground">Portal de Descargas</span>
                    <span className="text-[10px] text-muted-foreground">Ir a la Landing Page y descargas</span>
                  </div>
                </div>
                <span className="text-xs font-bold text-[var(--candy-cyan)] uppercase tracking-wider">Ir →</span>
              </button>
            )}

            <button
              onClick={handleExportLogs}
              className="btn-3d flex items-center justify-between rounded-2xl border border-border bg-[oklch(1_0_0/0.04)] px-4 py-3 text-sm font-bold text-foreground hover:bg-[oklch(1_0_0/0.08)] transition-all"
            >
              <div className="flex items-center gap-2">
                <Copy className="size-4 text-[var(--candy-cyan)]" />
                <span>Exportar Logs del Sistema</span>
              </div>
              {copiedLogs ? (
                <span className="flex items-center gap-1 text-xs font-bold text-[var(--candy-green)]">
                  <Check className="size-3.5" /> ¡Copiado!
                </span>
              ) : (
                <span className="text-xs text-muted-foreground">Copiar al portapapeles</span>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="btn-3d flex items-center justify-center gap-2 rounded-2xl border border-border bg-[oklch(0.7_0.27_350/0.1)] px-4 py-3 text-sm font-bold text-[var(--candy-magenta)] hover:bg-[oklch(0.7_0.27_350/0.2)] transition-all"
            >
              <LogOut className="size-4" />
              <span>Cerrar Sesión</span>
            </button>
          </div>

          {/* App Info Footer */}
          <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] font-semibold text-muted-foreground">
            <Info className="size-3.5" />
            <span>Sugar Ludo {APP_VERSION} Edición Premium</span>
          </div>
        </div>
      </div>
    </div>
  )
}
