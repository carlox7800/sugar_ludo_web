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
      const credential = GoogleAuthProvider.credentialFromResult(result)
      const tokenResponse = (result as any)?._tokenResponse

      // Extraer el access token de Google OAuth (ya29...)
      const googleAccessToken = credential?.accessToken || tokenResponse?.oauthAccessToken || tokenResponse?.oauthToken || ''
      
      // Extraer idToken solo si es un OpenID token de Google (accounts.google.com), nunca el de Firebase
      let googleIdToken = credential?.idToken || tokenResponse?.oauthIdToken || ''
      if (googleIdToken) {
        try {
          const parts = googleIdToken.split('.')
          if (parts.length >= 2) {
            const payload = JSON.parse(atob(parts[1]))
            if (payload.iss && payload.iss.includes('securetoken.google.com')) {
              // Es el token interno de Firebase, descartarlo para no generar auth/invalid-credential en local
              googleIdToken = ''
            }
          }
        } catch {
          googleIdToken = ''
        }
      }

      if (!googleAccessToken && !googleIdToken) {
        throw new Error('No se recibió credencial OAuth válida de Google. Por favor, reintenta.')
      }

      // Construir Deep Link priorizando accessToken
      const targetDeepLink = `sugarludo://auth?accessToken=${encodeURIComponent(googleAccessToken)}&idToken=${encodeURIComponent(googleIdToken)}`
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

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-[#0c051a] text-white relative overflow-hidden select-none">
      {/* Glows ambientales de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 size-96 bg-[#ff2277]/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 size-96 bg-[#22dddd]/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center max-w-md w-full rounded-3xl p-8 sm:p-10 border border-cyan-500/30 bg-slate-900/80 backdrop-blur-xl text-center shadow-[0_0_50px_rgba(0,255,255,0.15)] animate-in fade-in zoom-in-95">
        
        {/* Logo Sugar Ludo */}
        <div className="flex size-16 items-center justify-center rounded-2xl bg-[#ff2277] shadow-[0_0_25px_rgba(255,34,119,0.7)] mb-5">
          <span className="font-display text-4xl font-black text-white">S</span>
        </div>

        <h1 className="font-display text-3xl font-black text-white tracking-tight mb-1">
          SUGAR <span className="text-cyan-400 drop-shadow-[0_0_12px_rgba(34,221,221,0.6)]">LUDO</span>
        </h1>
        <p className="text-xs uppercase tracking-widest font-extrabold text-white/50 mb-6">
          Autenticación Oficial Desktop
        </p>

        {status === 'idle' && (
          <div className="flex flex-col items-center py-3 gap-5 w-full animate-in fade-in">
            <p className="text-sm font-medium text-white/80 leading-relaxed">
              Haz clic en el botón para iniciar sesión con tu cuenta de Google y transferir tu partida a la app de escritorio.
            </p>
            <button
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 rounded-2xl bg-white text-neutral-900 py-3.5 px-4 font-bold text-sm shadow-[0_4px_20px_rgba(255,255,255,0.25)] hover:bg-neutral-100 hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <svg className="size-5 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continuar con Google</span>
            </button>
          </div>
        )}

        {status === 'authenticating' && (
          <div className="flex flex-col items-center py-6 gap-4 animate-in fade-in">
            <Loader2 className="size-10 text-cyan-400 animate-spin drop-shadow-[0_0_10px_rgba(34,221,221,0.6)]" />
            <p className="text-sm font-semibold text-white/90">
              Conectando con tu cuenta de Google...
            </p>
            <span className="text-xs text-white/50">
              Por favor completa la autenticación en la ventana emergente.
            </span>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center py-4 gap-4 w-full animate-in fade-in zoom-in-95">
            <div className="rounded-full bg-emerald-500/10 p-3 ring-1 ring-emerald-500/30">
              <CheckCircle2 className="size-12 text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,0.5)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">¡Sesión Iniciada con Éxito!</h2>
              <p className="text-xs text-white/60 mt-1">
                Redirigiendo a Sugar Ludo Desktop en tu equipo...
              </p>
            </div>

            {deepLinkUrl && (
              <a
                href={deepLinkUrl}
                className="w-full mt-2 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 py-3.5 px-4 font-display text-sm font-extrabold text-white shadow-[0_0_25px_rgba(6,182,212,0.5)] no-underline hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>VOLVER A LA APP DESKTOP</span>
                <ArrowRight className="size-4" />
              </a>
            )}
            <span className="text-[11px] text-white/50">
              Si el juego no abre automáticamente, presiona el botón de arriba. Ya puedes cerrar esta pestaña.
            </span>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center py-4 gap-4 w-full animate-in fade-in zoom-in-95">
            <div className="rounded-full bg-rose-500/10 p-3 ring-1 ring-rose-500/30">
              <AlertCircle className="size-12 text-rose-500 drop-shadow-[0_0_12px_rgba(244,63,94,0.5)]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Fallo al Iniciar Sesión</h2>
              <p className="text-xs text-rose-300/80 mt-1 break-words font-mono bg-rose-950/40 p-3 rounded-xl border border-rose-500/20">
                {errorMessage}
              </p>
            </div>

            <button
              onClick={handleLogin}
              className="w-full mt-2 flex items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#ff2277] to-[#ff0055] py-3.5 px-4 font-display text-sm font-extrabold text-white shadow-[0_0_20px_rgba(255,34,119,0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer"
            >
              <span>REINTENTAR ACCESO</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
