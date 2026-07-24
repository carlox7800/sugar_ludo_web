'use client'

import React from 'react'
import { Gamepad2, Trophy, Users, ShieldCheck } from 'lucide-react'

interface LandingPageProps {
  onLoginClick: () => void
}

export function LandingPage({ onLoginClick }: LandingPageProps) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center overflow-x-hidden cyber-bg">
      {/* Navbar Minimalista */}
      <nav className="w-full max-w-6xl flex justify-between items-center p-6 lg:p-8 animate-in fade-in slide-in-from-top-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--candy-magenta)] shadow-[0_0_15px_oklch(0.45_0.2_350)]">
            <span className="font-display text-2xl font-extrabold text-primary-foreground">S</span>
          </div>
          <span className="font-display text-2xl font-extrabold tracking-tight text-white drop-shadow-md">
            SUGAR <span className="text-[var(--candy-cyan)]">LUDO</span>
          </span>
        </div>
        <button 
          onClick={onLoginClick}
          className="btn-3d rounded-xl bg-[oklch(1_0_0/0.1)] px-5 py-2 font-display text-sm font-bold text-white border border-[oklch(1_0_0/0.2)] hover:bg-[oklch(1_0_0/0.15)] transition-all"
        >
          INICIAR SESIÓN
        </button>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 w-full max-w-6xl flex flex-col items-center justify-center p-6 text-center mt-10 lg:mt-20 relative">
        {/* Glow Effects */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] bg-[var(--candy-magenta)]/20 rounded-full blur-[100px] pointer-events-none" />
        
        <h1 className="animate-in fade-in slide-in-from-bottom-6 duration-700 font-display text-5xl lg:text-7xl font-extrabold text-white leading-tight mb-6 drop-shadow-2xl z-10">
          Entra a la <span className="text-[var(--candy-magenta)] neon-magenta">Arena Ludo</span> <br />
          más dulce de la red
        </h1>
        
        <p className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-150 text-lg lg:text-xl text-muted-foreground max-w-2xl mb-12 z-10 font-semibold">
          Compite contra jugadores reales, demuestra tu estrategia en las distintas salas y llévate el Pozo de Premios.
        </p>

        <button 
          onClick={onLoginClick}
          className="animate-in fade-in zoom-in-95 duration-700 delay-300 btn-3d rounded-2xl bg-[linear-gradient(135deg,oklch(0.7_0.27_350),oklch(0.82_0.15_200))] px-12 py-5 font-display text-xl font-extrabold text-primary-foreground shadow-[0_0_40px_oklch(0.7_0.27_350/0.5)] transition-all hover:scale-105 z-10 flex items-center gap-3"
        >
          <Gamepad2 className="size-6" /> JUGAR AHORA
        </button>

        {/* Feature Cards Grid */}
        <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-6 mt-24 mb-16 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-500 z-10">
          <FeatureCard 
            icon={Trophy}
            title="Pozo de Premios"
            description="El ganador de la sala se lleva el 100% del pozo acumulado con las entradas."
            color="var(--candy-gold)"
          />
          <FeatureCard 
            icon={Users}
            title="Salas por Nivel"
            description="Elige el costo de entrada de la mesa según tu experiencia y saldo de Sugar Coins."
            color="var(--candy-cyan)"
          />
          <FeatureCard 
            icon={ShieldCheck}
            title="Juego Justo"
            description="Motor de dados aleatorio certificado y modo de entrenamiento contra IA."
            color="var(--candy-magenta)"
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full p-6 text-center border-t border-border/20 z-10">
        <p className="text-xs text-muted-foreground font-semibold">
          © {new Date().getFullYear()} Sugar Ludo v1.7. Juega con responsabilidad.
        </p>
      </footer>
    </div>
  )
}

function FeatureCard({ icon: Icon, title, description, color }: { icon: any, title: string, description: string, color: string }) {
  return (
    <div className="glass flex flex-col items-center p-8 rounded-3xl border border-border/50 text-center hover:bg-[oklch(1_0_0/0.03)] transition-colors">
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
