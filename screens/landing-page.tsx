'use client'

import React, { useState } from 'react'
import { Trophy, Users, ShieldCheck, Monitor, Smartphone, Sparkles, Globe } from 'lucide-react'

interface LandingPageProps {
  onContinueInBrowser?: () => void
}

export function LandingPage({ onContinueInBrowser }: LandingPageProps = {}) {
  // Clases base para los botones
  const baseButtonClass = "btn-3d w-full sm:w-1/2 flex items-center justify-center gap-3 rounded-2xl px-6 py-4 font-display text-base font-extrabold text-primary-foreground transition-all"
  
  // Clases específicas de estilos
  const activePcClass = "bg-[linear-gradient(135deg,var(--candy-cyan),#0088ff)] shadow-[0_0_30px_rgba(34,221,221,0.4)] hover:scale-105 cursor-pointer"
  const activeAndroidClass = "bg-[linear-gradient(135deg,var(--candy-magenta),#ff0077)] shadow-[0_0_30px_rgba(255,34,119,0.4)] hover:scale-105 cursor-pointer"

  return (
    <div className="min-h-screen w-full flex flex-col items-center overflow-x-hidden cyber-bg text-foreground">
      {/* Navbar Minimalista (Sin botón de Login ni Jugar) */}
      <nav className="w-full max-w-6xl flex justify-between items-center p-6 lg:p-8 animate-in fade-in slide-in-from-top-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--candy-magenta)] shadow-[0_0_15px_rgba(255,34,119,0.4)]">
            <span className="font-display text-2xl font-extrabold text-primary-foreground">S</span>
          </div>
          <span className="font-display text-2xl font-extrabold tracking-tight text-white drop-shadow-md">
            SUGAR <span className="text-[var(--candy-cyan)]">LUDO</span>
          </span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-1.5 backdrop-blur-md">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-display text-xs font-bold text-white/80 uppercase tracking-wider">
            Portal Oficial de Descarga
          </span>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 w-full max-w-6xl flex flex-col items-center justify-center p-6 text-center mt-6 lg:mt-12 relative">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-[var(--candy-magenta)]/20 rounded-full blur-[110px] pointer-events-none" />
        
        <div className="inline-flex items-center gap-2 rounded-full border border-[var(--candy-gold)]/40 bg-[var(--candy-gold)]/10 px-5 py-2 mb-6 animate-in fade-in slide-in-from-bottom-4">
          <Sparkles className="size-4 text-[var(--candy-gold)]" />
          <span className="font-display text-xs sm:text-sm font-extrabold text-[var(--candy-gold)] uppercase tracking-widest">
            Experiencia Standalone 100% Fluida
          </span>
        </div>

        <h1 className="animate-in fade-in slide-in-from-bottom-6 duration-700 font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6 drop-shadow-2xl z-10">
          Descarga e Instala <br />
          <span className="text-[var(--candy-magenta)] neon-magenta">Sugar Ludo</span> en tu equipo
        </h1>
        
        <p className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 text-base sm:text-lg lg:text-xl text-muted-foreground max-w-2xl mb-10 z-10 font-semibold leading-relaxed">
          Para garantizar partidas estables sin recargas accidentales ni marcos de navegador, Sugar Ludo funciona exclusivamente como aplicación instalable para PC y Android.
        </p>

        {/* CTA Installation Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 w-full max-w-xl z-10 animate-in fade-in zoom-in-95 duration-700 delay-300">
          
          {/* Windows / PC Button */}
          <a 
            href="/SugarLudo-Setup.exe" 
            target="_blank"
            rel="noopener noreferrer"
            download="SugarLudo-Setup.exe"
            className={`${baseButtonClass} ${activePcClass}`}
          >
            <Monitor className="size-6 shrink-0" />
            <div className="flex flex-col items-start text-left">
              <span className="text-xs opacity-80 font-bold uppercase tracking-wider">
                Descargar para
              </span>
              <span className="text-sm font-black">
                Windows / Mac
              </span>
            </div>
          </a>

          {/* Android Button */}
          <a 
            href="/SugarLudo.apk" 
            target="_blank"
            rel="noopener noreferrer"
            download="SugarLudo.apk"
            className={`${baseButtonClass} ${activeAndroidClass}`}
          >
            <Smartphone className="size-6 shrink-0" />
            <div className="flex flex-col items-start text-left">
              <span className="text-xs opacity-80 font-bold uppercase tracking-wider">
                Descargar para
              </span>
              <span className="text-sm font-black">
                Android (APK)
              </span>
            </div>
          </a>
        </div>

        {/* Web Direct Play Button */}
        {onContinueInBrowser && (
          <div className="mt-4 w-full max-w-xl z-10 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-400">
            <button
              onClick={onContinueInBrowser}
              className="w-full flex items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/5 hover:bg-white/10 px-6 py-3.5 backdrop-blur-md transition-all hover:scale-[1.02] cursor-pointer group"
            >
              <Globe className="size-5 text-[var(--candy-cyan)] group-hover:rotate-12 transition-transform" />
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white tracking-wide">
                  Continuar en el Navegador
                </span>
                <span className="rounded-full bg-[var(--candy-cyan)]/20 border border-[var(--candy-cyan)]/30 px-2 py-0.5 text-[10px] font-extrabold text-[var(--candy-cyan)] uppercase tracking-wider">
                  Modo Web / Pruebas
                </span>
              </div>
            </button>
          </div>
        )}

        {/* Feature Cards Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 mb-16 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500 z-10">
          <FeatureCard 
            icon={Trophy}
            title="Pozo de Premios"
            description="El ganador de la sala se lleva el 100% del pozo acumulado con las entradas de Sugar Coins."
            color="#ffcc22"
          />
          <FeatureCard 
            icon={Users}
            title="Multijugador Online"
            description="Compite en salas públicas y privadas de 2, 3, 4, 5 y 6 jugadores con motor autoritativo."
            color="#22dddd"
          />
          <FeatureCard 
            icon={ShieldCheck}
            title="Ventana Independiente"
            description="Cero interrupciones: al instalarse abre en ventana limpia sin barras de dirección."
            color="#ff2277"
          />
        </div>
      </main>





      {/* Footer */}
      <footer className="w-full p-6 text-center border-t border-border/20 z-10">
        <p className="text-xs text-muted-foreground font-semibold">
          © {new Date().getFullYear()} Sugar Ludo — Aplicación Oficial PWA.
        </p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) {
  return (
    <div className="glass flex flex-col items-center p-8 rounded-3xl border border-border/50 text-center hover:bg-[rgba(255,255,255,0.03)] transition-colors">
      <div 
        className="size-14 rounded-2xl flex items-center justify-center mb-4 shadow-inner"
        style={{ backgroundColor: `${color}22`, color: color, border: `1px solid ${color}44` }}
      >
        <Icon className="size-7" />
      </div>
      <h3 className="font-display text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  )
}
