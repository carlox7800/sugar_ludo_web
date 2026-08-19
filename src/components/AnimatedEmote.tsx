import React from 'react';

export interface AnimatedEmoteProps {
  emoteId?: string;
  emoji?: string;
  size?: number | string;
  className?: string;
}

export const AnimatedEmote: React.FC<AnimatedEmoteProps> = ({
  emoteId = '',
  emoji = '',
  size = 48,
  className = '',
}) => {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;
  const id = emoteId || '';
  const isLol = id === 'emote_lol_bounce' || emoji === '🤣' || emoji === 'lol';
  const isFlame = id === 'emote_on_fire' || emoji === '🔥' || emoji === 'fire';
  const isCry = id === 'emote_sad_cry' || emoji === '😭' || emoji === '🥺' || emoji === 'cry';
  const isLove = id === 'emote_sugar_love' || emoji === '💖' || emoji === '❤️' || emoji === 'love';
  const isTrophy = id === 'emote_trophy_gg' || emoji === '🏆' || emoji === 'gg';

  // 1. RISA EN BUCLE (LOL) - AAA Vector Animated Emote
  if (isLol) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-md">
          {/* Laughing Head */}
          <g className="anim-lol-head origin-center">
            {/* Glowing Face Base */}
            <circle cx="50" cy="50" r="42" fill="url(#lolGrad)" stroke="#d97706" strokeWidth="3" />
            
            {/* Squinting Laughing Eyes (V-shapes) */}
            <path d="M 26 38 L 36 44 L 26 50" fill="none" stroke="#78350f" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M 74 38 L 64 44 L 74 50" fill="none" stroke="#78350f" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            
            {/* Giant Laughing Mouth */}
            <path d="M 25 54 Q 50 88 75 54 Z" fill="#991b1b" stroke="#78350f" strokeWidth="3" />
            {/* Tongue */}
            <path d="M 38 68 Q 50 86 62 68 Q 50 62 38 68 Z" fill="#f43f5e" />
            {/* Upper Teeth */}
            <path d="M 27 55 Q 50 63 73 55 L 70 59 Q 50 67 30 59 Z" fill="#ffffff" />
            
            {/* Rosy Cheeks */}
            <circle cx="24" cy="48" r="7" fill="#f87171" opacity="0.6" />
            <circle cx="76" cy="48" r="7" fill="#f87171" opacity="0.6" />
          </g>

          {/* Shooting Water Tears (Left & Right) */}
          <g className="anim-lol-tear-l origin-center">
            <path d="M 22 42 C 14 36, 6 46, 12 54 C 18 62, 26 52, 22 42 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          </g>
          <g className="anim-lol-tear-r origin-center">
            <path d="M 78 42 C 86 36, 94 46, 88 54 C 82 62, 74 52, 78 42 Z" fill="#38bdf8" stroke="#0284c7" strokeWidth="1.5" />
          </g>

          <defs>
            <radialGradient id="lolGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="60%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 2. EN LLAMAS (ON FIRE) - AAA Flame Multi-layer Particle Emote
  if (isFlame) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          {/* Rising Ember Sparks */}
          <circle cx="35" cy="30" r="3.5" fill="#fde047" className="anim-spark-1" />
          <circle cx="68" cy="24" r="4" fill="#fb923c" className="anim-spark-2" />
          <circle cx="50" cy="18" r="3" fill="#f43f5e" className="anim-spark-3" />

          {/* Outer Blazing Fire Layer */}
          <g className="anim-flame origin-bottom">
            {/* Back Deep Red/Orange Flame */}
            <path 
              d="M 50 8 Q 66 28 78 48 Q 92 68 76 88 Q 58 100 42 94 Q 20 86 22 64 Q 24 44 42 34 Q 46 22 50 8 Z" 
              fill="url(#flameOuter)" 
            />
            {/* Middle Intense Orange/Yellow Flame */}
            <path 
              d="M 50 24 Q 62 38 70 54 Q 78 70 66 84 Q 50 94 38 88 Q 28 80 32 64 Q 36 48 48 38 Z" 
              fill="url(#flameMid)" 
            />
            {/* Inner White/Cyan Core Heat */}
            <path 
              d="M 50 44 Q 58 54 62 66 Q 66 78 56 86 Q 44 90 38 84 Q 34 78 38 68 Q 42 56 50 44 Z" 
              fill="url(#flameCore)" 
            />
          </g>

          <defs>
            <linearGradient id="flameOuter" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#dc2626" />
              <stop offset="60%" stopColor="#ea580c" />
              <stop offset="100%" stopColor="#f97316" />
            </linearGradient>
            <linearGradient id="flameMid" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="70%" stopColor="#facc15" />
              <stop offset="100%" stopColor="#fef08a" />
            </linearGradient>
            <radialGradient id="flameCore" cx="50%" cy="80%" r="60%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="70%" stopColor="#fef9c3" />
              <stop offset="100%" stopColor="#38bdf8" />
            </radialGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 3. LÁGRIMAS EN CASCADA (SAD CRY) - AAA Tear Stream Emote
  if (isCry) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-md">
          {/* Blue Water Puddle at Bottom */}
          <ellipse cx="50" cy="88" rx="34" ry="7" fill="#0284c7" opacity="0.5" className="anim-cry-puddle origin-center" />
          <ellipse cx="50" cy="88" rx="24" ry="4" fill="#38bdf8" opacity="0.8" />

          {/* Sad Face Base */}
          <circle cx="50" cy="46" r="38" fill="url(#cryGrad)" stroke="#0284c7" strokeWidth="2.5" />
          
          {/* Sad Downward Brows & Eyes */}
          <path d="M 26 32 Q 35 34 40 39" fill="none" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M 74 32 Q 65 34 60 39" fill="none" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round" />
          
          {/* Closed Crying Eyes */}
          <path d="M 28 42 Q 35 38 42 42" fill="none" stroke="#0c4a6e" strokeWidth="4" strokeLinecap="round" />
          <path d="M 58 42 Q 65 38 72 42" fill="none" stroke="#0c4a6e" strokeWidth="4" strokeLinecap="round" />

          {/* Trembling Open Sad Mouth */}
          <path d="M 36 68 Q 50 56 64 68 Q 50 78 36 68 Z" fill="#0369a1" stroke="#0c4a6e" strokeWidth="2" />
          
          {/* Animated Waterfalls of Tears */}
          <g className="anim-cry-tear-l">
            <path d="M 32 44 C 28 54, 26 66, 30 78 C 34 66, 36 54, 32 44 Z" fill="#38bdf8" opacity="0.95" />
            <circle cx="31" cy="62" r="3.5" fill="#ffffff" />
          </g>
          <g className="anim-cry-tear-r">
            <path d="M 68 44 C 64 54, 62 66, 66 78 C 70 66, 72 54, 68 44 Z" fill="#38bdf8" opacity="0.95" />
            <circle cx="67" cy="62" r="3.5" fill="#ffffff" />
          </g>

          <defs>
            <radialGradient id="cryGrad" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#bae6fd" />
              <stop offset="60%" stopColor="#7dd3fc" />
              <stop offset="100%" stopColor="#38bdf8" />
            </radialGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 4. SUGAR LOVE (CORAZÓN NEÓN) - AAA Pulsating Heartbeat Emote
  if (isLove) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
          {/* Outer Shockwave Aura */}
          <g className="anim-heartbeat origin-center">
            {/* Heart Silhouette */}
            <path 
              d="M 50 84 C 20 62, 8 42, 14 26 C 20 12, 38 12, 50 26 C 62 12, 80 12, 86 26 C 92 42, 80 62, 50 84 Z" 
              fill="url(#heartGrad)" 
              stroke="#ffffff" 
              strokeWidth="2.5" 
            />
            {/* Inner Gloss Reflection */}
            <path 
              d="M 26 24 C 30 18, 40 18, 44 24 C 38 28, 28 32, 24 40 C 22 34, 22 28, 26 24 Z" 
              fill="#ffffff" 
              opacity="0.75" 
            />
          </g>

          {/* Twinkling Star Sparkles */}
          <g className="anim-glint-1" style={{ transformOrigin: '78px 24px' }}>
            <path d="M 78 18 L 80 24 L 86 24 L 81 28 L 83 34 L 78 30 L 73 34 L 75 28 L 70 24 L 76 24 Z" fill="#fef08a" />
          </g>
          <g className="anim-glint-2" style={{ transformOrigin: '22px 64px' }}>
            <path d="M 22 58 L 24 64 L 30 64 L 25 68 L 27 74 L 22 70 L 17 74 L 19 68 L 14 64 L 20 64 Z" fill="#ffffff" />
          </g>

          <defs>
            <radialGradient id="heartGrad" cx="35%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#ff66aa" />
              <stop offset="45%" stopColor="#ff0066" />
              <stop offset="100%" stopColor="#aa0044" />
            </radialGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 5. COPA GG / VICTORIA ÉPICA - AAA Glowing Golden Trophy Emote
  if (isTrophy) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-lg">
          {/* Rotating Ray Aura in Background */}
          <g className="anim-trophy-rays opacity-40">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
              <line 
                key={angle} 
                x1="50" 
                y1="50" 
                x2={50 + 44 * Math.cos((angle * Math.PI) / 180)} 
                y2={50 + 44 * Math.sin((angle * Math.PI) / 180)} 
                stroke="#facc15" 
                strokeWidth="3" 
                strokeDasharray="4 4" 
              />
            ))}
          </g>

          {/* Trophy Cup */}
          <g className="origin-center">
            {/* Handles */}
            <path d="M 28 32 C 14 32, 14 54, 32 54" fill="none" stroke="#d97706" strokeWidth="5" strokeLinecap="round" />
            <path d="M 72 32 C 86 32, 86 54, 68 54" fill="none" stroke="#d97706" strokeWidth="5" strokeLinecap="round" />
            <path d="M 28 32 C 16 32, 16 52, 32 52" fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />
            <path d="M 72 32 C 84 32, 84 52, 68 52" fill="none" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round" />

            {/* Chalice Body */}
            <path d="M 28 22 L 72 22 L 66 54 C 62 66, 38 66, 34 54 Z" fill="url(#goldTrophy)" stroke="#b45309" strokeWidth="2" />
            
            {/* Rim */}
            <ellipse cx="50" cy="22" rx="22" ry="5" fill="#fde047" stroke="#b45309" strokeWidth="1.5" />
            <ellipse cx="50" cy="22" rx="17" ry="3" fill="#f59e0b" />

            {/* Stem & Base */}
            <path d="M 46 60 L 54 60 L 56 74 L 44 74 Z" fill="url(#goldTrophy)" stroke="#b45309" strokeWidth="1.5" />
            <path d="M 32 74 L 68 74 L 72 84 L 28 84 Z" fill="#78350f" stroke="#b45309" strokeWidth="2" />
            <rect x="34" y="75" width="32" height="7" rx="2" fill="#facc15" />

            {/* Star on Cup */}
            <path d="M 50 36 L 52 42 L 58 42 L 53 46 L 55 52 L 50 48 L 45 52 L 47 46 L 42 42 L 48 42 Z" fill="#ffffff" />
          </g>

          {/* Twinkling Star Glints */}
          <g className="anim-glint-1" style={{ transformOrigin: '32px 20px' }}>
            <circle cx="32" cy="20" r="3" fill="#ffffff" />
          </g>
          <g className="anim-glint-2" style={{ transformOrigin: '68px 24px' }}>
            <circle cx="68" cy="24" r="2.5" fill="#ffffff" />
          </g>

          <defs>
            <linearGradient id="goldTrophy" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="40%" stopColor="#facc15" />
              <stop offset="80%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 6. DEFAULT / FALLBACK EMOJI with Elastic Micro-bounce
  return (
    <span 
      className={`inline-flex items-center justify-center select-none animate-bounce ${className}`} 
      style={{ fontSize: pixelSize, lineHeight: 1 }}
    >
      {emoji || '✨'}
    </span>
  );
};
