'use client'

import React, { useState, useEffect } from 'react'
import {
  Download,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Sparkles,
  Smartphone,
  Laptop,
  Globe,
  Loader2,
  CheckCircle2
} from 'lucide-react'
import {
  VersionCheckResult,
  checkAppVersion
} from '@/lib/version-checker'

interface ForceUpdateModalProps {
  versionInfo: VersionCheckResult
  onRecheckSuccess?: () => void
}

type RuntimePlatform = 'android' | 'desktop' | 'web'

export function ForceUpdateModal({
  versionInfo,
  onRecheckSuccess
}: ForceUpdateModalProps) {
  const [isRechecking, setIsRechecking] = useState(false)
  const [currentInfo, setCurrentInfo] = useState<VersionCheckResult>(versionInfo)
  const [platform, setPlatform] = useState<RuntimePlatform>('web')

  // Detectar plataforma en tiempo de ejecución (Capacitor Android, Electron PC o Navegador Web)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const capacitor = (window as any).Capacitor
    const isCapacitor = capacitor && (
      (typeof capacitor.isNativePlatform === 'function' && capacitor.isNativePlatform()) ||
      (typeof capacitor.getPlatform === 'function' && capacitor.getPlatform() !== 'web')
    )

    const isElectron = !!(window as any).electronAuth ||
      window.navigator.userAgent.includes('Electron') ||
      window.location.protocol === 'file:' ||
      window.location.protocol === 'app:'

    if (isCapacitor) {
      setPlatform('android')
    } else if (isElectron) {
      setPlatform('desktop')
    } else {
      setPlatform('web')
    }
  }, [])

  // CANDADO INFRANQUEABLE: Bloquear tecla Escape y clicks en fondo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    document.body.style.overflow = 'hidden'

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      document.body.style.overflow = ''
    }
  }, [])

  // Manejador de re-comprobación manual
  const handleRecheck = async () => {
    setIsRechecking(true)
    try {
      const res = await checkAppVersion(true)
      setCurrentInfo(res)
      if (!res.isForceUpdate && onRecheckSuccess) {
        onRecheckSuccess()
      }
    } catch (err) {
      console.warn('[ForceUpdateModal] Error al re-comprobar versión:', err)
    } finally {
      setTimeout(() => setIsRechecking(false), 600)
    }
  }

  // Manejador de descarga adaptativo a la plataforma
  const handleDownload = () => {
    const { downloadUrls, landingUrl } = currentInfo
    const fallbackLanding = landingUrl || 'https://sugar-ludo-landing.onrender.com'

    if (platform === 'android') {
      const targetUrl = downloadUrls.android || `${fallbackLanding}/#download`
      if (typeof window !== 'undefined') {
        window.open(targetUrl, '_blank')
      }
    } else if (platform === 'desktop') {
      const targetUrl = downloadUrls.windows || `${fallbackLanding}/#download`
      if (typeof window !== 'undefined') {
        window.open(targetUrl, '_blank')
      }
    } else {
      // En Web se fuerza la recarga completa para invalidar caches
      if (typeof window !== 'undefined') {
        window.location.reload()
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 select-none"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="force-update-title"
    >
      {/* Fondo Infranqueable con Desenfoque Extremo */}
      <div className="fixed inset-0 bg-black/90 backdrop-blur-2xl animate-in fade-in duration-300" />

      {/* Tarjeta Modal Cyber Candy AAA */}
      <div className="relative z-10 flex flex-col items-center max-w-md w-full glass rounded-3xl p-6 sm:p-8 border border-[var(--candy-magenta)]/60 shadow-[0_0_60px_rgba(255,34,119,0.35)] text-center animate-in zoom-in-95 duration-300">
        
        {/* Glow Superior */}
        <div className="absolute -top-12 size-32 bg-[var(--candy-magenta)]/30 rounded-full blur-3xl pointer-events-none" />

        {/* Icono Principal de Alerta */}
        <div className="relative flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-[var(--candy-magenta)] via-pink-600 to-rose-700 shadow-[0_0_30px_rgba(255,34,119,0.7)] mb-5 animate-pulse">
          <ShieldAlert className="size-10 text-white" />
          <div className="absolute -bottom-1 -right-1 size-7 rounded-full bg-amber-400 border-2 border-slate-950 flex items-center justify-center shadow-md">
            <AlertTriangle className="size-4 text-slate-950 stroke-[3]" />
          </div>
        </div>

        {/* Título Principal */}
        <h2
          id="force-update-title"
          className="font-display text-2xl font-black text-white tracking-wide mb-2 uppercase leading-tight"
        >
          Actualización Obligatoria
        </h2>

        {/* Mensaje Explicativo iGaming */}
        <p className="text-sm text-slate-300 font-medium mb-5 leading-relaxed">
          Para garantizar la <strong className="text-white font-bold">integridad de tus partidas en tiempo real</strong>, la seguridad de tu saldo y la sincronización con los servidores oficiales, es necesario instalar la versión más reciente.
        </p>

        {/* Comparador Visual de Versiones */}
        <div className="w-full grid grid-cols-2 gap-3 mb-5 p-3 rounded-2xl bg-black/40 border border-white/10">
          <div className="flex flex-col items-center p-2 rounded-xl bg-rose-500/10 border border-rose-500/30">
            <span className="text-[10px] uppercase font-bold text-rose-300 tracking-wider mb-0.5">Instalada</span>
            <span className="font-mono text-sm font-extrabold text-rose-400">
              v{currentInfo.currentVersion}
            </span>
            <span className="text-[9px] text-rose-300/70 font-semibold">(Obsoleta)</span>
          </div>

          <div className="flex flex-col items-center p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
            <span className="text-[10px] uppercase font-bold text-emerald-300 tracking-wider mb-0.5">Requerida</span>
            <span className="font-mono text-sm font-extrabold text-emerald-400">
              v{currentInfo.minSupportedVersion}
            </span>
            <span className="text-[9px] text-emerald-300/70 font-semibold">(Oficial)</span>
          </div>
        </div>

        {/* Resumen de Mejoras */}
        {currentInfo.changelog && (
          <div className="w-full mb-6 p-3 rounded-xl bg-white/5 border border-white/5 text-left">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--candy-cyan)] mb-1">
              <Sparkles className="size-3.5" />
              <span>Novedades de la versión:</span>
            </div>
            <p className="text-xs text-slate-300 leading-normal">
              {currentInfo.changelog}
            </p>
          </div>
        )}

        {/* Acciones Principales */}
        <div className="flex flex-col gap-3 w-full">
          {/* Botón Principal Adaptativo de Descarga */}
          <button
            onClick={handleDownload}
            className="btn-3d w-full flex items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-[var(--candy-magenta)] via-pink-600 to-rose-600 py-3.5 px-4 font-display text-sm font-extrabold text-white shadow-[0_4px_20px_rgba(255,34,119,0.5)] hover:brightness-110 active:scale-95 transition-all cursor-pointer"
          >
            {platform === 'android' && <Smartphone className="size-5" />}
            {platform === 'desktop' && <Laptop className="size-5" />}
            {platform === 'web' && <Globe className="size-5" />}

            <span>
              {platform === 'android' && `DESCARGAR APK OFICIAL (v${currentInfo.minSupportedVersion})`}
              {platform === 'desktop' && `DESCARGAR INSTALADOR PC (v${currentInfo.minSupportedVersion})`}
              {platform === 'web' && 'RECARGAR PARA ACTUALIZAR'}
            </span>
            <Download className="size-4 ml-0.5 stroke-[2.5]" />
          </button>

          {/* Botón Secundario: Reintentar Comprobación */}
          <div className="flex gap-2 w-full">
            <button
              onClick={handleRecheck}
              disabled={isRechecking}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 py-2.5 px-3 font-display text-xs font-bold text-white hover:bg-white/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`size-3.5 ${isRechecking ? 'animate-spin text-[var(--candy-cyan)]' : ''}`} />
              <span>{isRechecking ? 'Verificando...' : 'Reintentar Verificación'}</span>
            </button>

            {/* Enlace alternativo a Landing Portal */}
            <button
              onClick={() => {
                const url = currentInfo.landingUrl || 'https://sugar-ludo-landing.onrender.com'
                if (typeof window !== 'undefined') {
                  window.open(url, '_blank')
                }
              }}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-white/15 bg-white/5 py-2.5 px-3 font-display text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
            >
              <span>Sitio Web</span>
              <ExternalLink className="size-3 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Candado de Seguridad Notorio */}
        <p className="mt-5 text-[10px] text-slate-400 flex items-center justify-center gap-1">
          <span>🔒 Verificación oficial criptográfica · Servidor Sugar Ludo v{currentInfo.minSupportedVersion}</span>
        </p>
      </div>
    </div>
  )
}
