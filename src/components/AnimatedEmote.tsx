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
  const isSalt = id === 'emote_toxic_salt' || emoji === '🧂' || emoji === 'salt';
  const isGhost = id === 'emote_ghost_rip' || emoji === '👻' || emoji === 'ghost';
  const isMindBlown = id === 'emote_mind_blown' || emoji === '🤯' || emoji === 'shock';
  const isRage = id === 'emote_rage_demon' || emoji === '😈' || emoji === 'rage';
  const isCrown = id === 'emote_king_crown' || emoji === '👑' || emoji === 'crown';

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

  // 6. LLUVIA DE SAL (SALT SHAKER) - AAA Toxic Salt Emote
  if (isSalt) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-md">
          {/* Salt Shaker Body */}
          <g className="anim-salt-shaker origin-center">
            {/* Glass Container */}
            <path d="M 38 34 L 62 34 L 68 84 C 68 88, 32 88, 32 84 Z" fill="url(#saltGlass)" stroke="#38bdf8" strokeWidth="2.5" />
            {/* Salt Powder inside */}
            <path d="M 40 48 L 60 48 L 65 82 C 65 85, 35 85, 35 82 Z" fill="#ffffff" opacity="0.9" />
            {/* Metallic Cap */}
            <path d="M 36 22 L 64 22 L 62 34 L 38 34 Z" fill="url(#saltCap)" stroke="#64748b" strokeWidth="2" />
            <circle cx="44" cy="24" r="1.5" fill="#334155" />
            <circle cx="50" cy="24" r="1.5" fill="#334155" />
            <circle cx="56" cy="24" r="1.5" fill="#334155" />
            {/* Smug Face on Glass */}
            <path d="M 42 58 Q 50 66 58 58" fill="none" stroke="#0284c7" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="42" cy="52" r="2" fill="#0284c7" />
            <circle cx="58" cy="52" r="2" fill="#0284c7" />
          </g>

          {/* Falling Salt Crystals */}
          <circle cx="56" cy="62" r="2.5" fill="#ffffff" className="anim-salt-1" filter="drop-shadow(0 0 3px #38bdf8)" />
          <circle cx="62" cy="66" r="3" fill="#ffffff" className="anim-salt-2" filter="drop-shadow(0 0 3px #38bdf8)" />
          <circle cx="52" cy="70" r="2" fill="#ffffff" className="anim-salt-3" filter="drop-shadow(0 0 3px #38bdf8)" />

          <defs>
            <linearGradient id="saltGlass" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.8" />
            </linearGradient>
            <linearGradient id="saltCap" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f1f5f9" />
              <stop offset="50%" stopColor="#94a3b8" />
              <stop offset="100%" stopColor="#475569" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 7. FANTASMA RIP (GHOST) - AAA Ghost Emote
  if (isGhost) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-lg">
          {/* Golden Angelic Halo */}
          <ellipse cx="50" cy="20" rx="22" ry="6" fill="none" stroke="#facc15" strokeWidth="4" className="anim-ghost-halo origin-center" />
          
          {/* Wings */}
          <g className="anim-ghost-wings origin-center opacity-85">
            <path d="M 28 44 C 12 36, 6 52, 22 62 C 26 56, 28 50, 28 44 Z" fill="#bae6fd" stroke="#38bdf8" strokeWidth="1.5" />
            <path d="M 72 44 C 88 36, 94 52, 78 62 C 74 56, 72 50, 72 44 Z" fill="#bae6fd" stroke="#38bdf8" strokeWidth="1.5" />
          </g>

          {/* Ghost Body */}
          <g className="anim-ghost-body origin-center">
            <path 
              d="M 50 26 C 30 26, 26 44, 26 62 C 26 78, 32 84, 38 78 C 44 72, 46 84, 50 80 C 54 84, 56 72, 62 78 C 68 84, 74 78, 74 62 C 74 44, 70 26, 50 26 Z" 
              fill="url(#ghostGrad)" 
              stroke="#38bdf8" 
              strokeWidth="2.5" 
            />
            {/* Cute Soul Eyes */}
            <ellipse cx="42" cy="46" rx="4" ry="6" fill="#0f172a" />
            <ellipse cx="58" cy="46" rx="4" ry="6" fill="#0f172a" />
            <circle cx="43.5" cy="44" r="1.8" fill="#ffffff" />
            <circle cx="59.5" cy="44" r="1.8" fill="#ffffff" />
            {/* Cheeks */}
            <ellipse cx="36" cy="54" rx="3.5" ry="2" fill="#f43f5e" opacity="0.6" />
            <ellipse cx="64" cy="54" rx="3.5" ry="2" fill="#f43f5e" opacity="0.6" />
            {/* Cute Open Mouth */}
            <ellipse cx="50" cy="54" rx="3" ry="4" fill="#0f172a" />
          </g>

          <defs>
            <linearGradient id="ghostGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#38bdf8" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 8. CEREBRO GALÁCTICO (MIND BLOWN) - AAA Shock & Spark Emote
  if (isMindBlown) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-xl">
          {/* Expanding Cosmic Burst Cloud */}
          <g className="anim-mind-burst origin-center">
            <ellipse cx="50" cy="24" rx="34" ry="16" fill="url(#cosmicCloud)" opacity="0.9" />
            <circle cx="28" cy="18" r="6" fill="#f43f5e" />
            <circle cx="72" cy="18" r="6" fill="#38bdf8" />
            <circle cx="50" cy="10" r="8" fill="#facc15" />
            {/* Sparkles */}
            <path d="M 50 4 L 52 10 L 58 10 L 53 14 L 55 20 L 50 16 L 45 20 L 47 14 L 42 10 L 48 10 Z" fill="#ffffff" />
            <path d="M 24 16 L 25 19 L 28 19 L 26 21 L 27 24 L 24 22 L 21 24 L 22 21 L 20 19 L 23 19 Z" fill="#ffffff" />
            <path d="M 76 16 L 77 19 L 80 19 L 78 21 L 79 24 L 76 22 L 73 24 L 74 21 L 72 19 L 75 19 Z" fill="#ffffff" />
          </g>

          {/* Shaking Head Face */}
          <g className="anim-mind-face origin-center">
            {/* Head Base (Cut top) */}
            <path d="M 22 38 Q 18 64 26 78 Q 50 96 74 78 Q 82 64 78 38 Z" fill="url(#mindHeadGrad)" stroke="#d97706" strokeWidth="2.5" />
            {/* Wild Shock Eyes */}
            <circle cx="38" cy="54" r="9" fill="#ffffff" stroke="#78350f" strokeWidth="2" />
            <circle cx="62" cy="54" r="9" fill="#ffffff" stroke="#78350f" strokeWidth="2" />
            <circle cx="38" cy="54" r="3.5" fill="#0f172a" />
            <circle cx="62" cy="54" r="3.5" fill="#0f172a" />
            {/* Wide Open Gasp Mouth */}
            <ellipse cx="50" cy="74" rx="9" ry="12" fill="#78350f" stroke="#451a03" strokeWidth="2" />
            <ellipse cx="50" cy="80" rx="6" ry="4" fill="#f43f5e" />
          </g>

          <defs>
            <radialGradient id="cosmicCloud" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#f43f5e" />
              <stop offset="70%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </radialGradient>
            <radialGradient id="mindHeadGrad" cx="40%" cy="40%" r="60%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="60%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </radialGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 9. FURIA SUGAR (RAGE DEVIL) - AAA Demon Flame Emote
  if (isRage) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-xl">
          {/* Hot Steam Puffs from Nostrils */}
          <path d="M 40 60 Q 24 54 18 42" fill="none" stroke="#fca5a5" strokeWidth="3.5" strokeLinecap="round" className="anim-rage-steam-l" />
          <path d="M 60 60 Q 76 54 82 42" fill="none" stroke="#fca5a5" strokeWidth="3.5" strokeLinecap="round" className="anim-rage-steam-r" />

          {/* Devil Body & Horns */}
          <g className="anim-rage-body origin-center">
            {/* Glowing Red Devil Horns */}
            <path d="M 28 34 Q 14 16 10 6 Q 26 12 36 26 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="2" filter="drop-shadow(0 0 8px #ff0055)" />
            <path d="M 72 34 Q 86 16 90 6 Q 74 12 64 26 Z" fill="#ef4444" stroke="#991b1b" strokeWidth="2" filter="drop-shadow(0 0 8px #ff0055)" />

            {/* Glowing Red Face */}
            <circle cx="50" cy="52" r="38" fill="url(#rageGrad)" stroke="#7f1d1d" strokeWidth="3" />
            
            {/* Angry Slanted Eyebrows */}
            <path d="M 22 38 L 44 46" fill="none" stroke="#450a0a" strokeWidth="5.5" strokeLinecap="round" />
            <path d="M 78 38 L 56 46" fill="none" stroke="#450a0a" strokeWidth="5.5" strokeLinecap="round" />
            
            {/* Fiery Glowing Yellow Eyes */}
            <ellipse cx="34" cy="50" rx="6" ry="7" fill="#facc15" stroke="#7f1d1d" strokeWidth="1.5" />
            <ellipse cx="66" cy="50" rx="6" ry="7" fill="#facc15" stroke="#7f1d1d" strokeWidth="1.5" />
            <ellipse cx="35" cy="50" rx="2.5" ry="5" fill="#450a0a" />
            <ellipse cx="65" cy="50" rx="2.5" ry="5" fill="#450a0a" />

            {/* Gritted Teeth Mouth with Fangs */}
            <path d="M 30 68 Q 50 62 70 68 Q 50 82 30 68 Z" fill="#450a0a" stroke="#7f1d1d" strokeWidth="2" />
            <path d="M 34 68 L 38 74 L 42 68 L 46 74 L 50 68 L 54 74 L 58 68 L 62 74 L 66 68" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          </g>

          <defs>
            <radialGradient id="rageGrad" cx="40%" cy="40%" r="65%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="50%" stopColor="#dc2626" />
              <stop offset="100%" stopColor="#991b1b" />
            </radialGradient>
          </defs>
        </svg>
      </div>
    );
  }

  // 10. CORONA DIAMANTE (CROWN MVP) - AAA Luxury Crown Emote
  if (isCrown) {
    return (
      <div 
        className={`relative inline-flex items-center justify-center select-none ${className}`} 
        style={{ width: pixelSize, height: pixelSize }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible drop-shadow-2xl">
          {/* Floating Crown Body */}
          <g className="anim-crown-float origin-center">
            {/* Velvet Base Cushion */}
            <path d="M 22 74 Q 50 84 78 74 L 76 82 Q 50 92 24 82 Z" fill="#831843" stroke="#ffd700" strokeWidth="1.5" />
            
            {/* Gold Crown Spires */}
            <path 
              d="M 18 70 L 14 36 L 34 52 L 50 20 L 66 52 L 86 36 L 82 70 Q 50 82 18 70 Z" 
              fill="url(#royalCrownGrad)" 
              stroke="#b45309" 
              strokeWidth="2.5" 
            />

            {/* Inlaid Diamond Gems on Tips */}
            <circle cx="14" cy="36" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" className="anim-crown-spark" />
            <circle cx="50" cy="20" r="6.5" fill="#f43f5e" stroke="#ffffff" strokeWidth="2" className="anim-crown-spark" />
            <circle cx="86" cy="36" r="5" fill="#38bdf8" stroke="#ffffff" strokeWidth="1.5" className="anim-crown-spark" />

            {/* Center Golden Jewel Band */}
            <ellipse cx="50" cy="70" rx="26" ry="6" fill="#ffd700" stroke="#b45309" strokeWidth="1.5" />
            <circle cx="34" cy="70" r="3" fill="#10b981" stroke="#ffffff" strokeWidth="0.8" />
            <circle cx="50" cy="71" r="3.5" fill="#38bdf8" stroke="#ffffff" strokeWidth="0.8" />
            <circle cx="66" cy="70" r="3" fill="#f43f5e" stroke="#ffffff" strokeWidth="0.8" />
          </g>

          {/* Twinkling Star Glints */}
          <g className="anim-glint-1" style={{ transformOrigin: '50px 14px' }}>
            <path d="M 50 8 L 52 14 L 58 14 L 53 18 L 55 24 L 50 20 L 45 24 L 47 18 L 42 14 L 48 14 Z" fill="#ffffff" />
          </g>
          <g className="anim-glint-2" style={{ transformOrigin: '84px 30px' }}>
            <circle cx="84" cy="30" r="3" fill="#ffffff" />
          </g>

          <defs>
            <linearGradient id="royalCrownGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="35%" stopColor="#facc15" />
              <stop offset="70%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#ca8a04" />
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
