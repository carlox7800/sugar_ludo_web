---
name: aaa-gaming-landing-engineer
description: Manual y patrones de ingeniería para Landing Pages de videojuegos AAA, fondos vivos a 60 FPS (Canvas/WebGL), botones táctiles 3D, tarjetas Tilt, modales HUD y detección reactiva de plataforma en Next.js.
---

# AAA Gaming Landing Engineer (Sugar Ludo)

Esta habilidad documenta los estándares de diseño, arquitectura gráfica interactiva y patrones de componentes de alto impacto para la creación de portales de aterrizaje (Landing Pages) y centros de descarga con estética de videojuego de calibre AAA.

Diseñado específicamente para proyectos independientes como `sugar-ludo-landing` o despliegues desacoplados con Next.js estático (`output: 'export'`), operando con **cero costo de infraestructura ($0.00 Spark)** y máxima tasa de conversión.

---

## 1. Filosofía y Estándares Visuales AAA Gaming

### 1.1 Paleta de Color "Cyber-Arcade & Luxury Candy"
Para Sugar Ludo, la identidad visual fusiona la emoción de las apuestas de alta competencia con el neón arcade contemporáneo:

* **Backgrounds Profundos**:
  - `bg-[#05020c]` (Void Black primario)
  - `bg-[#0a0518]` (Deep Obsidian para contenedores)
  - `bg-[#130924]` (Surface Glass con opacidad)
* **Acentos Neón de Alto Voltaje**:
  - **Cyan Pulse**: `#00f0ff` (Tecnología, velocidad, instaladores PC)
  - **Neon Magenta / Pink**: `#ff007a` / `#ff2277` (Acción, juego en vivo, instaladores APK)
  - **Cyber Gold**: `#fbbf24` / `#f59e0b` (Torneos, premios reales, cashout)
  - **Emerald Green**: `#10b981` (Disponibilidad, estado en línea, descarga activa)
* **Bordes y Cristal Ultraligero**:
  - `border-white/10` base con hover dinámico a `border-cyan-500/40` o `border-pink-500/40`
  - `backdrop-blur-xl` con saturación al 180% (`backdrop-saturate-180`)

### 1.2 Principio de Rendimiento: "Zero Bloat, 60 FPS"
* **Sin Three.js o dependencias de 600KB**: Los fondos vivos se implementan con la API nativa de **HTML5 Canvas 2D acelerada por hardware** o shaders CSS puros.
* **Respeto a la tasa de refresco**: Animaciones atadas a `requestAnimationFrame` que se pausan automáticamente al minimizar la pestaña (`document.hidden`) o al salir del viewport (`IntersectionObserver`).
* **Optimización Mobile**: Detección de dispositivos de baja potencia o pantallas táctiles para reducir la densidad de partículas a un 35% y apagar efectos de hover pesados.

---

## 2. Arquitectura de Fondos Vivos (Particle & Nebula Canvas)

Un fondo de videojuego debe sentirse vivo y receptivo al usuario sin interferir con la legibilidad del texto ni ralentizar el scroll.

### 2.1 Componente: `ParticleNebulaCanvas.tsx`
Motor de partículas interactivo con constelaciones vectoriales elásticas, gradientes de nebulosa flotante y repulsión reactiva ante el puntero del ratón:

```tsx
'use client';

import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  baseAlpha: number;
  alpha: number;
}

export const ParticleNebulaCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    // Ajuste de densidad según dispositivo
    const isMobile = width < 768;
    const particleCount = isMobile ? 35 : 85;
    const connectionDistance = isMobile ? 80 : 130;
    const mouseRadius = isMobile ? 90 : 160;

    const mouse = { x: -1000, y: -1000 };

    const colors = ['#00f0ff', '#ff007a', '#7928ca', '#3b82f6'];

    const particles: Particle[] = [];
    for (let i = 0; i < particleCount; i++) {
      const baseAlpha = Math.random() * 0.5 + 0.2;
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.7,
        vy: (Math.random() - 0.5) * 0.7,
        size: Math.random() * 2 + 1,
        color: colors[Math.floor(Math.random() * colors.length)],
        baseAlpha,
        alpha: baseAlpha,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = -1000;
      mouse.y = -1000;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);

    // Bucle de renderizado 60 FPS
    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Render de partículas
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Movimiento base
        p.x += p.vx;
        p.y += p.vy;

        // Rebote en bordes
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        // Repulsión con el cursor
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < mouseRadius) {
          const force = (mouseRadius - dist) / mouseRadius;
          const angle = Math.atan2(dy, dx);
          p.x -= Math.cos(angle) * force * 3;
          p.y -= Math.sin(angle) * force * 3;
          p.alpha = Math.min(1, p.baseAlpha + force * 0.5);
        } else {
          p.alpha = p.baseAlpha;
        }

        // Dibujar partícula
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.restore();

        // 2. Líneas de constelación entre partículas cercanas
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const cdx = p.x - p2.x;
          const cdy = p.y - p2.y;
          const cdist = Math.sqrt(cdx * cdx + cdy * cdy);

          if (cdist < connectionDistance) {
            const lineAlpha = (1 - cdist / connectionDistance) * 0.22;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = '#00f0ff';
            ctx.globalAlpha = lineAlpha;
            ctx.lineWidth = 0.8;
            ctx.stroke();
            ctx.restore();
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Orbes de Nebulosa CSS con desenfoque extremo */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/15 rounded-full blur-[140px] animate-pulse" />
      <div className="absolute top-1/3 -right-40 w-[30rem] h-[30rem] bg-pink-600/15 rounded-full blur-[160px] animate-pulse [animation-delay:3s]" />
      <div className="absolute -bottom-40 left-1/4 w-[32rem] h-[32rem] bg-purple-700/15 rounded-full blur-[180px] animate-pulse [animation-delay:5s]" />

      {/* Canvas de Partículas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Scanline Grid sutil estilo Gaming HUD */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
    </div>
  );
};
```

---

## 3. Botones CTA y Controles Táctiles Gaming AAA

Un botón de descarga o acción en una web de videojuegos no debe verse como un botón plano de SaaS corporativo. Debe simular un pulsador físico de cabina arcade con feedback táctil inmediato, brillo volumétrico e iluminación dinámica.

### 3.1 Anatomía del Botón Gaming 3D
1. **Profundidad Táctil (3D Faceplate)**: Capa inferior con sombra dura isométrica (`box-shadow: 0 6px 0 #...`) que se colapsa en `:active` (`translate-y-1.5`).
2. **Haz de Luz Giratorio (Border Beam / Shimmer)**: Rotación continua de un gradiente cónico que ilumina el perímetro exterior.
3. **Reflejo Angular Superior**: Línea de resplandor blanco semitransparente que simula el bisel de vidrio templado.
4. **Resplandor Neón Pulsante (Aura Glow)**: Difusión de luz trasera (`filter: drop-shadow(...)`).

### 3.2 Componente: `GamerCTAButton.tsx`

```tsx
'use client';

import React from 'react';

interface GamerCTAButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'cyan' | 'magenta' | 'amber';
  size?: 'md' | 'lg' | 'xl';
  icon?: React.ReactNode;
  badge?: string;
  className?: string;
  subtext?: string;
}

export const GamerCTAButton: React.FC<GamerCTAButtonProps> = ({
  children,
  onClick,
  variant = 'cyan',
  size = 'lg',
  icon,
  badge,
  className = '',
  subtext,
}) => {
  // Paletas de color por variante
  const styles = {
    cyan: {
      bg: 'bg-gradient-to-b from-cyan-400 via-cyan-500 to-cyan-600',
      bottomLip: 'bg-cyan-800',
      shadow: 'shadow-[0_8px_0_#0e7490,0_15px_30px_rgba(6,182,212,0.45)]',
      borderBeam: 'from-transparent via-cyan-200 to-transparent',
      glowRing: 'group-hover:shadow-[0_0_35px_rgba(6,182,212,0.6)]',
      badgeBg: 'bg-cyan-950/90 text-cyan-300 border-cyan-400/50',
    },
    magenta: {
      bg: 'bg-gradient-to-b from-pink-500 via-rose-500 to-pink-600',
      bottomLip: 'bg-rose-900',
      shadow: 'shadow-[0_8px_0_#9f1239,0_15px_30px_rgba(244,63,94,0.45)]',
      borderBeam: 'from-transparent via-pink-200 to-transparent',
      glowRing: 'group-hover:shadow-[0_0_35px_rgba(244,63,94,0.6)]',
      badgeBg: 'bg-rose-950/90 text-pink-300 border-pink-400/50',
    },
    amber: {
      bg: 'bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-600',
      bottomLip: 'bg-amber-800',
      shadow: 'shadow-[0_8px_0_#92400e,0_15px_30px_rgba(245,158,11,0.45)]',
      borderBeam: 'from-transparent via-yellow-100 to-transparent',
      glowRing: 'group-hover:shadow-[0_0_35px_rgba(245,158,11,0.6)]',
      badgeBg: 'bg-amber-950/90 text-amber-300 border-amber-400/50',
    },
  }[variant];

  const sizeClasses = {
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
    xl: 'px-10 py-5 text-lg',
  }[size];

  return (
    <div className={`relative inline-block group select-none ${className}`}>
      {/* Badge Flotante Superior (ej. "Recomendado para ti" o "v9.2.8") */}
      {badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span
            className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md shadow-md flex items-center gap-1.5 whitespace-nowrap ${styles.badgeBg}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
            {badge}
          </span>
        </div>
      )}

      {/* Botón Táctil Físico 3D */}
      <button
        onClick={onClick}
        type="button"
        className={`relative w-full cursor-pointer flex flex-col items-center justify-center font-black uppercase tracking-wider text-white transition-all duration-100 rounded-2xl ${styles.bg} ${styles.shadow} ${styles.glowRing} ${sizeClasses} active:translate-y-[6px] active:shadow-[0_2px_0_#0e7490] focus:outline-none`}
      >
        {/* Haz de luz reflectivo superior (Glass Highlight) */}
        <div className="absolute inset-x-3 top-1 h-[2px] bg-white/50 rounded-full blur-[0.5px]" />

        {/* Shimmer sweep en Hover */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/20 to-transparent -rotate-45 translate-x-[-150%] group-hover:translate-x-[250%] transition-transform duration-1000 ease-out" />
        </div>

        {/* Contenido del botón */}
        <div className="flex items-center justify-center gap-3 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]">
          {icon && <span className="text-2xl transition-transform group-hover:scale-110">{icon}</span>}
          <div className="text-center">
            <span className="block leading-tight font-black">{children}</span>
            {subtext && (
              <span className="block text-[11px] font-medium tracking-normal text-white/80 lowercase mt-0.5">
                {subtext}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
};
```

---

## 4. Vitrina de Conversión: Tarjetas 3D Tilt con Spotlight

Presenta las características del juego (Multijugador Real, Retiro Instantáneo, Modo Hexagonal, Tablero Dinámico) con física de inclinación tridimensional que reacciona a la posición del cursor.

### 4.1 Componente: `TiltSpotlightCard.tsx`

```tsx
'use client';

import React, { useRef, useState, MouseEvent } from 'react';

interface TiltSpotlightCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'cyan' | 'pink' | 'purple' | 'amber';
}

export const TiltSpotlightCard: React.FC<TiltSpotlightCardProps> = ({
  children,
  className = '',
  glowColor = 'cyan',
}) => {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [rotate, setRotate] = useState({ x: 0, y: 0 });
  const [spotlightPos, setSpotlightPos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const glowRgb = {
    cyan: '0, 240, 255',
    pink: '255, 0, 122',
    purple: '121, 40, 202',
    amber: '251, 191, 36',
  }[glowColor];

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Calcular inclinación (-12deg a +12deg)
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotX = ((y - centerY) / centerY) * -12;
    const rotY = ((x - centerX) / centerX) * 12;

    setRotate({ x: rotX, y: rotY });
    setSpotlightPos({ x, y });
  };

  const handleMouseEnter = () => setIsHovered(true);

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotate({ x: 0, y: 0 });
  };

  return (
    <div
      style={{ perspective: 1000 }}
      className="relative transition-transform duration-200 ease-out"
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          transform: `rotateX(${rotate.x}deg) rotateY(${rotate.y}deg)`,
          transformStyle: 'preserve-3d',
          transition: isHovered ? 'none' : 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
        }}
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c071d]/80 p-8 backdrop-blur-xl shadow-2xl transition-colors duration-300 hover:border-white/20 ${className}`}
      >
        {/* Linterna Spotlight de Cursor Dinámico */}
        {isHovered && (
          <div
            className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-100"
            style={{
              background: `radial-gradient(400px circle at ${spotlightPos.x}px ${spotlightPos.y}px, rgba(${glowRgb}, 0.18), transparent 80%)`,
            }}
          />
        )}

        {/* Borde reactivo iluminado */}
        {isHovered && (
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              border: `1px solid rgba(${glowRgb}, 0.3)`,
              boxShadow: `inset 0 0 20px rgba(${glowRgb}, 0.1)`,
            }}
          />
        )}

        {/* Contenido interior con elevación Z */}
        <div style={{ transform: 'translateZ(30px)' }} className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
};
```

---

## 5. Detección Reactiva de Plataforma (PC vs Android)

La landing page debe adaptarse automáticamente al entorno del visitante para maximizar la conversión con 1 solo clic.

### 5.1 Hook: `usePlatformDetection.ts`
Implementación segura para SSR (sin hydration mismatch) que identifica con precisión el sistema operativo del usuario:

```typescript
'use client';

import { useState, useEffect } from 'react';

export type OperatingSystem = 'windows' | 'android' | 'mac' | 'ios' | 'linux' | 'unknown';

interface PlatformInfo {
  os: OperatingSystem;
  isWindows: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  isDesktop: boolean;
  primaryCTA: {
    title: string;
    subtext: string;
    target: 'windows' | 'android';
    badge: string;
    downloadUrl: string;
  };
}

export function usePlatformDetection(version = '9.2.8'): PlatformInfo {
  const [os, setOs] = useState<OperatingSystem>('unknown');

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();

    if (/android/i.test(userAgent)) {
      setOs('android');
    } else if (/win/i.test(userAgent)) {
      setOs('windows');
    } else if (/macintosh|mac os x/i.test(userAgent)) {
      setOs('mac');
    } else if (/iphone|ipad|ipod/i.test(userAgent)) {
      setOs('ios');
    } else if (/linux/i.test(userAgent)) {
      setOs('linux');
    }
  }, []);

  const isWindows = os === 'windows';
  const isAndroid = os === 'android';
  const isMobile = isAndroid || os === 'ios';
  const isDesktop = isWindows || os === 'mac' || os === 'linux';

  // Configuración de enlaces dinámicos (ajustables a releases oficiales o CDN)
  const windowsDownloadUrl = `/downloads/SugarLudo-Setup-${version}.exe`;
  const androidDownloadUrl = `/downloads/sugar-ludo-v${version}.apk`;

  const primaryCTA = isAndroid
    ? {
        title: 'Descargar para Android',
        subtext: `APK Oficial v${version} • 6.8 MB`,
        target: 'android' as const,
        badge: 'Detectado para tu Teléfono',
        downloadUrl: androidDownloadUrl,
      }
    : {
        title: 'Descargar para Windows',
        subtext: `Instalador PC v${version} • 94 MB`,
        target: 'windows' as const,
        badge: isWindows ? 'Recomendado para tu PC' : 'Versión Desktop',
        downloadUrl: windowsDownloadUrl,
      };

  return {
    os,
    isWindows,
    isAndroid,
    isMobile,
    isDesktop,
    primaryCTA,
  };
}
```

---

## 6. Modales HUD y Guías de Instalación Rápida

Los navegadores y sistemas operativos (Windows SmartScreen y el instalador de paquetes de Android) a veces muestran advertencias por ser software descargado fuera de las tiendas cerradas. Un buen portal gaming disipa las dudas con un **modal HUD futurista** que enseña visualmente los 3 pasos de desbloqueo.

### 6.1 Componente: `GamerHUDModal.tsx`

```tsx
'use client';

import React, { useEffect } from 'react';

interface GamerHUDModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform: 'windows' | 'android';
  version?: string;
  downloadUrl: string;
}

export const GamerHUDModal: React.FC<GamerHUDModalProps> = ({
  isOpen,
  onClose,
  platform,
  version = '9.2.8',
  downloadUrl,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isWin = platform === 'windows';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-8">
      {/* Backdrop con Blur y Dim */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity duration-300"
      />

      {/* Contenedor HUD Cyberpunk */}
      <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-500/40 bg-[#0a0518]/95 p-6 sm:p-8 shadow-[0_0_50px_rgba(0,240,255,0.25)] backdrop-blur-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        {/* Acentos de esquinas biseladas Cyberpunk (L-Shapes) */}
        <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-cyan-400 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-cyan-400 pointer-events-none" />

        {/* Encabezado HUD */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isWin ? 'bg-cyan-500/20 text-cyan-300' : 'bg-pink-500/20 text-pink-300'}`}>
              <span className="text-xl">{isWin ? '💻' : '📱'}</span>
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-wider text-white">
                Guía de Instalación Rápida
              </h3>
              <p className="text-xs text-white/50">
                Sugar Ludo v{version} • {isWin ? 'Windows Setup' : 'Paquete APK Directo'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="cursor-pointer text-white/50 hover:text-white transition-colors p-2 rounded-xl hover:bg-white/10"
          >
            ✕
          </button>
        </div>

        {/* Pasos Interactivos */}
        <div className="grid gap-4 mb-8">
          {isWin ? (
            <>
              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-full bg-cyan-500 text-black font-black flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Descarga el Instalador</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Guarda el archivo <code>SugarLudo-Setup-{version}.exe</code> en tu computadora.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30">
                <div className="w-8 h-8 rounded-full bg-cyan-400 text-black font-black flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-cyan-300 text-sm">Aviso de Windows Defender / SmartScreen</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Al ser un software independiente nuevo, haz clic en <strong>"Más información"</strong> y luego en <strong>"Ejecutar de todas formas"</strong>.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-full bg-cyan-500 text-black font-black flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Inicia Sesión con Google</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Tu navegador abrirá la validación OAuth segura y te devolverá instantáneamente a la app.
                  </p>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-full bg-pink-500 text-white font-black flex items-center justify-center shrink-0">
                  1
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Descarga el Archivo APK</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Descarga directa del paquete firmado <code>sugar-ludo-v{version}.apk</code> (6.8 MB).
                  </p>
                </div>
              </div>
              <div className="flex gap-4 p-4 rounded-2xl bg-pink-950/30 border border-pink-500/30">
                <div className="w-8 h-8 rounded-full bg-pink-400 text-black font-black flex items-center justify-center shrink-0">
                  2
                </div>
                <div>
                  <h4 className="font-bold text-pink-300 text-sm">Autorizar Orígenes Desconocidos</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Si tu navegador solicita confirmación, pulsa <strong>"Descargar de todos modos"</strong> y activa la casilla para permitir instalar aplicaciones de esta fuente.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                <div className="w-8 h-8 rounded-full bg-pink-500 text-white font-black flex items-center justify-center shrink-0">
                  3
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">Instalar y Abrir</h4>
                  <p className="text-xs text-white/70 mt-0.5">
                    Abre el archivo descargado, toca "Instalar" y entra a jugar en vivo.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Botón de Acción Principal y Sellos de Confianza */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 text-xs text-emerald-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Verificado Libre de Virus • Binario Oficial</span>
          </div>

          <a
            href={downloadUrl}
            download
            className={`w-full sm:w-auto px-8 py-3.5 rounded-2xl font-black uppercase tracking-wider text-black text-center shadow-lg transition-transform active:scale-95 ${
              isWin ? 'bg-cyan-400 hover:bg-cyan-300 shadow-cyan-500/30' : 'bg-pink-500 hover:bg-pink-400 text-white shadow-pink-500/30'
            }`}
          >
            Iniciar Descarga Ahora
          </a>
        </div>
      </div>
    </div>
  );
};
```

---

## 7. Tailwind Keyframes y Configuración Estática

Para habilitar los efectos visuales AAA en `sugar-ludo-landing`, agrega estas utilidades y keyframes en `tailwind.config.js`:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      animation: {
        'shimmer': 'shimmer 2.5s linear infinite',
        'border-beam': 'border-beam calc(var(--duration)*1s) infinite linear',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          from: { backgroundPosition: '0 0' },
          to: { backgroundPosition: '-200% 0' },
        },
        'border-beam': {
          '100%': { 'offset-distance': '100%' },
        },
      },
    },
  },
  plugins: [],
};
```

---

## 8. Candados Técnicos y Arquitectura Spark $0.00

1. **Desacople Absoluto de Firestore**:
   - La landing page NO debe importar la SDK de Firestore ni inicializar clientes Firebase.
   - Todo el contenido (métricas de partidas, versiones, changelog, preguntas frecuentes) es estático o precargado en tiempo de compilación (`SSG`).
   - Cero lecturas y cero escrituras en Firestore = **Consumo exacto de $0.00 en cuota Spark**.
2. **Distribución de Binarios**:
   - Los archivos `.exe` y `.apk` se alojan en **GitHub Releases** o en el directorio `/downloads` de hosting estático (Cloudflare Pages, Vercel o Render Static).
3. **Cero Hydration Mismatch**:
   - Todos los componentes con efectos de mouse o `window` deben tener `'use client'` y montar la lógica interactiva dentro de un `useEffect` con verificación de montaje.
