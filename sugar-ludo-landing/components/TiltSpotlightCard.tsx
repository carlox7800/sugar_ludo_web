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
    purple: '170, 51, 255',
    amber: '251, 191, 36',
  }[glowColor];

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotX = ((y - centerY) / centerY) * -10;
    const rotY = ((x - centerX) / centerX) * 10;

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
        className={`relative overflow-hidden rounded-3xl border border-white/10 bg-[#0c071d]/85 p-7 backdrop-blur-xl shadow-2xl transition-colors duration-300 hover:border-white/25 ${className}`}
      >
        {/* Spotlight dinámico reactivo al cursor */}
        {isHovered && (
          <div
            className="pointer-events-none absolute -inset-px transition-opacity duration-300 opacity-100"
            style={{
              background: `radial-gradient(350px circle at ${spotlightPos.x}px ${spotlightPos.y}px, rgba(${glowRgb}, 0.2), transparent 80%)`,
            }}
          />
        )}

        {/* Borde neón interior en hover */}
        {isHovered && (
          <div
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{
              border: `1px solid rgba(${glowRgb}, 0.35)`,
              boxShadow: `inset 0 0 20px rgba(${glowRgb}, 0.12)`,
            }}
          />
        )}

        {/* Elevación espacial 3D */}
        <div style={{ transform: 'translateZ(25px)' }} className="relative z-10">
          {children}
        </div>
      </div>
    </div>
  );
};
