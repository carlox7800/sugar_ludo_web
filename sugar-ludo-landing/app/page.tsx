'use client';

import React, { useState } from 'react';
import { 
  Laptop, 
  Smartphone, 
  Globe, 
  Sparkles, 
  Trophy, 
  ShieldCheck, 
  Users, 
  Mic, 
  Flame, 
  ChevronRight, 
  Info,
  CheckCircle2
} from 'lucide-react';
import { ParticleNebulaCanvas } from '@/components/ParticleNebulaCanvas';
import { GamerCTAButton } from '@/components/GamerCTAButton';
import { TiltSpotlightCard } from '@/components/TiltSpotlightCard';
import { GamerHUDModal } from '@/components/GamerHUDModal';
import { usePlatformDetection } from '@/hooks/usePlatformDetection';
import { 
  APP_VERSION, 
  PC_DOWNLOAD_URL, 
  ANDROID_DOWNLOAD_URL, 
  WEB_GAME_URL, 
  PC_FILE_SIZE, 
  ANDROID_FILE_SIZE 
} from '@/lib/constants';

export default function LandingPage() {
  const { isAndroid, primaryCTA } = usePlatformDetection();
  const [modalPlatform, setModalPlatform] = useState<'windows' | 'android' | null>(null);

  const openInstallGuide = (platform: 'windows' | 'android') => {
    setModalPlatform(platform);
  };

  const closeModal = () => {
    setModalPlatform(null);
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col items-center overflow-x-hidden">
      {/* Fondo Vivo Interactivo a 60 FPS */}
      <ParticleNebulaCanvas />

      {/* Barra de Navegación Superior */}
      <nav className="relative z-20 w-full max-w-6xl mx-auto px-5 py-6 flex items-center justify-between">
        {/* Logo 3D 'S' y Título */}
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-600 shadow-[0_0_25px_rgba(255,34,119,0.5)] border border-white/20">
            <span className="text-2xl font-black tracking-tighter text-white drop-shadow">S</span>
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white leading-none">
              SUGAR <span className="text-cyan-400">LUDO</span>
            </h1>
            <span className="text-[10px] font-bold uppercase tracking-widest text-white/50">
              Centro Oficial de Descargas
            </span>
          </div>
        </div>

        {/* Badges de Versión y Acceso Directo Web */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
            <span className="size-2 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-bold text-white/80">v{APP_VERSION} En Vivo</span>
          </div>

          <a
            href={WEB_GAME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-colors cursor-pointer"
          >
            <Globe className="size-3.5" />
            <span>Jugar en Web</span>
          </a>
        </div>
      </nav>

      {/* Sección Hero de Alto Impacto */}
      <main className="relative z-10 w-full max-w-5xl mx-auto px-5 pt-8 pb-16 flex flex-col items-center text-center">
        {/* Pastilla Superior de Anuncio */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-400/10 border border-amber-400/30 mb-6 backdrop-blur-md animate-in fade-in slide-in-from-top-4">
          <Sparkles className="size-4 text-amber-300" />
          <span className="text-xs font-black uppercase tracking-wider text-amber-300">
            Experiencia Standalone 100% Fluida • Cero Retardo
          </span>
        </div>

        {/* Titular Principal */}
        <h2 className="text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white leading-[1.08] max-w-4xl drop-shadow-[0_4px_30px_rgba(0,0,0,0.8)]">
          EL LUDO MÁS <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-pink-500 to-amber-300">COMPETITIVO</span> DEL MUNDO
        </h2>

        {/* Subtítulo */}
        <p className="mt-5 text-base sm:text-xl text-white/70 max-w-2xl font-medium leading-relaxed">
          Instala la aplicación nativa en tu PC o Android para disfrutar de partidas a 60 FPS, chat de voz sin lag y retiros instantáneos.
        </p>

        {/* Controles CTA Dinámicos */}
        <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 w-full max-w-xl">
          {/* Botón Principal (Detecta el sistema operativo) */}
          <GamerCTAButton
            onClick={() => openInstallGuide(primaryCTA.target)}
            variant={primaryCTA.target === 'windows' ? 'cyan' : 'magenta'}
            size="xl"
            icon={primaryCTA.target === 'windows' ? <Laptop className="size-6" /> : <Smartphone className="size-6" />}
            badge={primaryCTA.badge}
            subtext={primaryCTA.subtext}
            className="w-full sm:w-auto min-w-[280px]"
          >
            {primaryCTA.title}
          </GamerCTAButton>

          {/* Botón Alternativo (Para el otro sistema operativo) */}
          <GamerCTAButton
            onClick={() => openInstallGuide(isAndroid ? 'windows' : 'android')}
            variant={isAndroid ? 'cyan' : 'magenta'}
            size="xl"
            icon={isAndroid ? <Laptop className="size-6" /> : <Smartphone className="size-6" />}
            badge={isAndroid ? 'Para tu Computadora' : 'Para tu Teléfono'}
            subtext={isAndroid ? `Instalador PC • ${PC_FILE_SIZE}` : `Paquete APK • ${ANDROID_FILE_SIZE}`}
            className="w-full sm:w-auto min-w-[280px]"
          >
            {isAndroid ? 'Descargar para PC' : 'Descargar APK Android'}
          </GamerCTAButton>
        </div>

        {/* Botón Secundario: Jugar en Navegador sin Descargar */}
        <div className="mt-6">
          <a
            href={WEB_GAME_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/10 text-white/80 hover:text-white border border-white/15 backdrop-blur-md text-xs sm:text-sm font-black uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-md"
          >
            <Globe className="size-4 text-cyan-400" />
            <span>O jugar ahora en el navegador web (sin instalar)</span>
            <ChevronRight className="size-4 text-white/50" />
          </a>
        </div>

        {/* Sellos de Confianza y Seguridad */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-400" />
            <span>Verificado Libre de Malware</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-cyan-400" />
            <span>Firma Digital Oficial</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-pink-400" />
            <span>Cero Publicidad Forzada</span>
          </div>
        </div>

        {/* Vitrina de Características en Tarjetas 3D Tilt */}
        <div className="mt-20 w-full grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
          <TiltSpotlightCard glowColor="cyan">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300">
                <Trophy className="size-6" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide text-white">
                Tablero Hexagonal & 4 Jugadores
              </h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              Elige entre la geometría clásica de 4 posiciones o el revolucionario tablero hexagonal de 6 jugadores, con física de dados tridimensional y atajos tácticos de color.
            </p>
          </TiltSpotlightCard>

          <TiltSpotlightCard glowColor="pink">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-pink-500/20 text-pink-300">
                <Flame className="size-6" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide text-white">
                Retiros Instantáneos & Cajeros
              </h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              Sistema de economía descentralizada con cajeros auditados, comisiones claras y cobros en tiempo real hacia tus billeteras digitales.
            </p>
          </TiltSpotlightCard>

          <TiltSpotlightCard glowColor="purple">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-300">
                <Mic className="size-6" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide text-white">
                Chat de Voz en Vivo
              </h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              Comunícate con tus rivales en audio espacial de ultra-baja latencia sin necesidad de aplicaciones externas como Discord.
            </p>
          </TiltSpotlightCard>

          <TiltSpotlightCard glowColor="amber">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-300">
                <ShieldCheck className="size-6" />
              </div>
              <h3 className="text-xl font-black uppercase tracking-wide text-white">
                Anti-Cheat Criptográfico
              </h3>
            </div>
            <p className="text-sm text-white/70 leading-relaxed">
              Validación determinista en servidores dedicados. Protección total contra manipulación de dados, trampas de memoria o desconexiones forzadas.
            </p>
          </TiltSpotlightCard>
        </div>

        {/* Ficha Técnica de Descargas */}
        <div className="mt-16 w-full max-w-3xl glass-panel rounded-3xl p-6 sm:p-8 text-left border border-white/10">
          <div className="flex items-center gap-3 mb-5 border-b border-white/10 pb-4">
            <Info className="size-5 text-cyan-400" />
            <h4 className="text-base font-black uppercase tracking-wider text-white">
              Ficha Técnica de Versiones Oficiales
            </h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
            <div>
              <span className="font-bold text-cyan-300 uppercase tracking-wider block mb-1">
                💻 Sugar Ludo para PC (Windows)
              </span>
              <ul className="space-y-1 text-white/70">
                <li>• <strong>Versión:</strong> {APP_VERSION} (Estable 64-bit)</li>
                <li>• <strong>Tamaño:</strong> {PC_FILE_SIZE}</li>
                <li>• <strong>Compatibilidad:</strong> Windows 10 / Windows 11</li>
                <li>• <strong>Autenticación:</strong> Google OAuth 2.0 vía Navegador</li>
              </ul>
            </div>

            <div>
              <span className="font-bold text-pink-300 uppercase tracking-wider block mb-1">
                📱 Sugar Ludo para Android (APK)
              </span>
              <ul className="space-y-1 text-white/70">
                <li>• <strong>Versión:</strong> {APP_VERSION} (Build 90208)</li>
                <li>• <strong>Tamaño:</strong> {ANDROID_FILE_SIZE}</li>
                <li>• <strong>Compatibilidad:</strong> Android 8.0 Oreo en adelante</li>
                <li>• <strong>Tipo:</strong> Paquete de instalación directa standalone</li>
              </ul>
            </div>
          </div>
        </div>
      </main>

      {/* Pie de Página */}
      <footer className="relative z-10 w-full border-t border-white/10 py-8 text-center text-xs text-white/40">
        <p>© 2026 Sugar Ludo Arena. Todos los derechos reservados.</p>
        <p className="mt-1 text-[11px]">
          Desarrollado para alta competencia con tecnología Next.js, Electron & Capacitor.
        </p>
      </footer>

      {/* Modal HUD con Guía de Instalación Rápida */}
      {modalPlatform && (
        <GamerHUDModal
          isOpen={true}
          onClose={closeModal}
          platform={modalPlatform}
          version={APP_VERSION}
          downloadUrl={modalPlatform === 'windows' ? PC_DOWNLOAD_URL : ANDROID_DOWNLOAD_URL}
        />
      )}
    </div>
  );
}
