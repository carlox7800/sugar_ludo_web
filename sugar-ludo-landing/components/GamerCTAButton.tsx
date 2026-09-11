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
  href?: string;
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
  href,
}) => {
  const styles = {
    cyan: {
      bg: 'bg-gradient-to-b from-cyan-400 via-cyan-500 to-cyan-600',
      shadow: 'shadow-[0_8px_0_#0e7490,0_15px_30px_rgba(6,182,212,0.45)]',
      activeShadow: 'active:shadow-[0_2px_0_#0e7490]',
      glowRing: 'group-hover:shadow-[0_0_35px_rgba(6,182,212,0.6)]',
      badgeBg: 'bg-cyan-950/90 text-cyan-300 border-cyan-400/50',
    },
    magenta: {
      bg: 'bg-gradient-to-b from-pink-500 via-rose-500 to-pink-600',
      shadow: 'shadow-[0_8px_0_#9f1239,0_15px_30px_rgba(244,63,94,0.45)]',
      activeShadow: 'active:shadow-[0_2px_0_#9f1239]',
      glowRing: 'group-hover:shadow-[0_0_35px_rgba(244,63,94,0.6)]',
      badgeBg: 'bg-rose-950/90 text-pink-300 border-pink-400/50',
    },
    amber: {
      bg: 'bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-600',
      shadow: 'shadow-[0_8px_0_#92400e,0_15px_30px_rgba(245,158,11,0.45)]',
      activeShadow: 'active:shadow-[0_2px_0_#92400e]',
      glowRing: 'group-hover:shadow-[0_0_35px_rgba(245,158,11,0.6)]',
      badgeBg: 'bg-amber-950/90 text-amber-300 border-amber-400/50',
    },
  }[variant];

  const sizeClasses = {
    md: 'px-6 py-3 text-sm',
    lg: 'px-8 py-4 text-base',
    xl: 'px-10 py-5 text-lg',
  }[size];

  const content = (
    <>
      {/* Reflejo de vidrio biselado superior */}
      <div className="absolute inset-x-3 top-1 h-[2px] bg-white/60 rounded-full blur-[0.5px]" />

      {/* Shimmer sweep animado */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/25 to-transparent -rotate-45 translate-x-[-150%] group-hover:translate-x-[250%] transition-transform duration-1000 ease-out" />
      </div>

      {/* Contenido interactivo */}
      <div className="flex items-center justify-center gap-3 relative z-10 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)]">
        {icon && <span className="text-2xl transition-transform group-hover:scale-110">{icon}</span>}
        <div className="text-center">
          <span className="block leading-tight font-black">{children}</span>
          {subtext && (
            <span className="block text-[11px] font-medium tracking-normal text-white/90 lowercase mt-0.5">
              {subtext}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className={`relative inline-block group select-none ${className}`}>
      {badge && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <span
            className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border backdrop-blur-md shadow-md flex items-center gap-1.5 whitespace-nowrap ${styles.badgeBg}`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
            {badge}
          </span>
        </div>
      )}

      {href ? (
        <a
          href={href}
          onClick={onClick}
          className={`relative w-full cursor-pointer flex flex-col items-center justify-center font-black uppercase tracking-wider text-white transition-all duration-100 rounded-2xl ${styles.bg} ${styles.shadow} ${styles.activeShadow} ${styles.glowRing} ${sizeClasses} active:translate-y-[6px] focus:outline-none`}
        >
          {content}
        </a>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className={`relative w-full cursor-pointer flex flex-col items-center justify-center font-black uppercase tracking-wider text-white transition-all duration-100 rounded-2xl ${styles.bg} ${styles.shadow} ${styles.activeShadow} ${styles.glowRing} ${sizeClasses} active:translate-y-[6px] focus:outline-none`}
        >
          {content}
        </button>
      )}
    </div>
  );
};
