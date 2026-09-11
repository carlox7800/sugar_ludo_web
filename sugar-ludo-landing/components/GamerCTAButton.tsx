'use client';

import React from 'react';

interface GamerCTAButtonProps {
  title: string;
  subtext: string;
  onClick?: () => void;
  variant: 'cyan' | 'magenta';
  icon: React.ReactNode;
  badge?: string;
  className?: string;
  href?: string;
}

export const GamerCTAButton: React.FC<GamerCTAButtonProps> = ({
  title,
  subtext,
  onClick,
  variant,
  icon,
  badge,
  className = '',
  href,
}) => {
  const isCyan = variant === 'cyan';

  // Configuración de estilo Gamer Premium (Cristal Oscuro + Acento Neón)
  const styles = isCyan
    ? {
        ambientGlow: 'bg-cyan-500/20 group-hover:bg-cyan-400/30',
        cardBg: 'bg-gradient-to-b from-[#0c2035] via-[#081524] to-[#040b13]',
        border: 'border-2 border-cyan-400/60 group-hover:border-cyan-300',
        shadow: 'shadow-[0_10px_30px_rgba(0,240,255,0.22),inset_0_1px_0_rgba(255,255,255,0.25),inset_0_0_20px_rgba(0,240,255,0.12)]',
        hoverShadow: 'group-hover:shadow-[0_12px_38px_rgba(0,240,255,0.38),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_25px_rgba(0,240,255,0.25)]',
        badgeBg: 'bg-[#061726]/95 text-cyan-300 border-cyan-400/70 shadow-[0_0_15px_rgba(0,240,255,0.35)]',
        iconColor: 'text-cyan-400 group-hover:text-cyan-300',
        subtextColor: 'text-cyan-200/80',
        specular: 'from-cyan-400/40 via-white/50 to-transparent',
      }
    : {
        ambientGlow: 'bg-pink-500/20 group-hover:bg-pink-400/30',
        cardBg: 'bg-gradient-to-b from-[#2a0b22] via-[#1a0615] to-[#0d020a]',
        border: 'border-2 border-pink-500/60 group-hover:border-pink-300',
        shadow: 'shadow-[0_10px_30px_rgba(255,0,122,0.22),inset_0_1px_0_rgba(255,255,255,0.25),inset_0_0_20px_rgba(255,0,122,0.12)]',
        hoverShadow: 'group-hover:shadow-[0_12px_38px_rgba(255,0,122,0.38),inset_0_1px_0_rgba(255,255,255,0.4),inset_0_0_25px_rgba(255,0,122,0.25)]',
        badgeBg: 'bg-[#22071a]/95 text-pink-300 border-pink-400/70 shadow-[0_0_15px_rgba(255,0,122,0.35)]',
        iconColor: 'text-pink-400 group-hover:text-pink-300',
        subtextColor: 'text-pink-200/80',
        specular: 'from-pink-400/40 via-white/50 to-transparent',
      };

  const buttonContent = (
    <>
      {/* Reflejo de bisel superior de cristal */}
      <div className={`absolute inset-x-4 top-1 h-[2px] bg-gradient-to-r ${styles.specular} rounded-full blur-[0.5px]`} />

      {/* Shimmer sweep animado al hacer hover */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/20 to-transparent -rotate-45 translate-x-[-150%] group-hover:translate-x-[250%] transition-transform duration-1000 ease-out" />
      </div>

      {/* Contenedor interno simétrico: Ícono a la izquierda + Textos a la derecha */}
      <div className="relative z-10 flex items-center gap-4 px-6 w-full">
        {/* Ícono grande y nítido */}
        <div className={`shrink-0 transition-transform duration-200 group-hover:scale-110 drop-shadow-[0_0_12px_currentColor] ${styles.iconColor}`}>
          {icon}
        </div>

        {/* Textos limpios de dos líneas */}
        <div className="flex flex-col text-left justify-center overflow-hidden">
          <span className="font-black text-lg sm:text-xl uppercase tracking-wider text-white leading-tight drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
            {title}
          </span>
          <span className={`text-xs font-bold tracking-wide mt-0.5 ${styles.subtextColor}`}>
            {subtext}
          </span>
        </div>
      </div>
    </>
  );

  return (
    <div className={`relative inline-block group select-none w-full sm:w-72 md:w-80 h-24 sm:h-28 ${className}`}>
      {/* Insignia flotante superior para plataforma detectada */}
      {badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none whitespace-nowrap">
          <span
            className={`px-3.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md flex items-center gap-1.5 ${styles.badgeBg}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
            {badge}
          </span>
        </div>
      )}

      {/* Halo de luz ambiental posterior */}
      <div className={`absolute -inset-1 rounded-3xl blur-xl transition-all duration-300 ${styles.ambientGlow}`} />

      {/* Pulsador de cristal oscuro con dimensiones 100% fijas e idénticas */}
      {href ? (
        <a
          href={href}
          onClick={onClick}
          className={`relative w-full h-full cursor-pointer flex items-center justify-center transition-all duration-150 rounded-2xl ${styles.cardBg} ${styles.border} ${styles.shadow} ${styles.hoverShadow} active:translate-y-1 active:shadow-none focus:outline-none`}
        >
          {buttonContent}
        </a>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={`relative w-full h-full cursor-pointer flex items-center justify-center transition-all duration-150 rounded-2xl ${styles.cardBg} ${styles.border} ${styles.shadow} ${styles.hoverShadow} active:translate-y-1 active:shadow-none focus:outline-none`}
        >
          {buttonContent}
        </button>
      )}
    </div>
  );
};
