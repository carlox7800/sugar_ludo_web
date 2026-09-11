'use client'

import React, { useState, useEffect } from 'react'
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'
import { CheckCircle2, AlertCircle, Loader2, ArrowRight, Smartphone } from 'lucide-react'

export default function AuthDesktopPage() {
  const [status, setStatus] = useState<'idle' | 'authenticating' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [deepLinkUrl, setDeepLinkUrl] = useState<string | null>(null)

  const handleLogin = async () => {
    setStatus('authenticating')
    setErrorMessage(null)
    try {
      const result = await signInWithPopup(auth, googleProvider)
      const user = result.user
      const idToken = await user.getIdToken()

      const targetDeepLink = `sugarludo://auth?idToken=${encodeURIComponent(idToken)}`
      setDeepLinkUrl(targetDeepLink)
      setStatus('success')

      // Redirección automática inmediata al esquema registrado
      window.location.href = targetDeepLink
    } catch (err: any) {
      console.error('[AuthDesktop] Error autenticando:', err)
      setStatus('error')
      setErrorMessage(err?.message || 'Error al autenticar con Google')
    }
  }

  // Auto-iniciar login con Google al cargar la página en el navegador del sistema
  useEffect(() => {
    handleLogin()
  }, [])

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 cyber-bg text-foreground">
      <div className="flex flex-col items-center max-w-md w-full glass rounded-3xl p-8 border border-[var(--candy-cyan)]/30 text-center shadow-2xl animate-in fade-in zoom-in-95">
        
        {/* Logo Sugar Ludo */}
        <div className="flex size-16 items-center justify-center rounded-2xl bg-[var(--candy-magenta)] shadow-[0_0_25px_rgba(255,34,119,0.6)] mb-6">
          <span className="font-display text-4xl font-extrabold text-white">S</span>
        </div>

        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mb-2">
          SUGAR <span className="text-[var(--candy-cyan)]">LUDO</span>
        </h1>
        <p className="text-xs uppercase tracking-widest font-extrabold text-white/60 mb-6">
          Autenticación Oficial Desktop
        </p>

        {status === 'authenticating' && (
          <div className="flex flex-col items-center py-6 gap-4">
            <Loader2 className="size-10 text-[var(--candy-cyan)] animate-spin" />
            <p className="text-sm font-semibold text-white/90">
              Conectando con tu cuenta de Google...
            </p>
            <span className="text-xs text-muted-foreground">
              Por favor completa la autenticación en la ventana emergente.
            </span>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center py-4 gap-4 animate-in fade-in zoom-in-95">
            <CheckCircle2 className="size-12 text-emerald-400" />
            <div>
              <h2 className="text-lg font-bold text-white">¡Sesión Iniciada con Éxito!</h2>
              <p className="text-xs text-muted-foreground mt-1">
                Redirigiendo a Sugar Ludo Desktop en tu equipo...
              </p>
            </div>

            {deepLinkUrl && (
              <a
                href={deepLinkUrl}
                className="btn-3d w-full mt-3 flex items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,var(--candy-cyan),#0088ff)] py-3.5 font-display text-sm font-extrabold text-white shadow-lg cursor-pointer"
              >
                <span>VOLVER A LA APP DESKTOP</span>
                <ArrowRight className="size-4" />
              </a>
            )}
            <span className="text-[11px] text-white/50">
              Ya puedes cerrar esta pestaña del navegador.
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center py-4 gap-4 animate-in fade-in zoom-in-95">
            <AlertCircle className="size-12 text-rose-500" />
            <div>
              <h2 className="text-lg font-bold text-white">Fallo al Iniciar Sesión</h2>
              <p className="text-xs text-rose-300/80 mt-1 break-words font-mono">
                {errorMessage}
              </p>
            </div>

            <button
              onClick={handleLogin}
              className="btn-3d w-full mt-3 flex items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(135deg,var(--candy-magenta),#ff0077)] py-3.5 font-display text-sm font-extrabold text-white shadow-lg cursor-pointer"
            >
              <span>REINTENTAR ACCESO</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
