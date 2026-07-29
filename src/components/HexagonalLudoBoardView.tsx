import React from 'react';
import {
  HexPlayerColor,
  HexToken,
  HexPlayer,
  HEX_COLOR_INFO,
  STAR_CELLS,
  HEX_COLORS_ORDER,
  TOTAL_MAIN_CELLS,
} from '../HexBoardConstants';
import { getCellIndexForToken } from '../HexGameEngine';
import { Sparkles } from 'lucide-react';

interface HexagonalLudoBoardViewProps {
  tokens: HexToken[];
  players: HexPlayer[];
  currentTurnIndex: number;
  playableTokenIds: number[];
  onTokenClick: (tokenId: number) => void;
  humanPlayerId: number;
  appTheme: 'classic' | 'sugar';
  explosionData?: { cellIndex: number | string; color: HexPlayerColor } | null;
}

const CX = 500;
const CY = 500;

// Helper for polar conversion where 0 deg is UP (-90 deg in standard math)
function getPolarPos(r: number, angleDeg: number) {
  const rad = (angleDeg - 90) * (Math.PI / 180);
  return {
    x: CX + r * Math.cos(rad),
    y: CY + r * Math.sin(rad),
  };
}

// Helper to scale polygon points towards their centroid
function getInnerPolygon(points: {x: number, y: number}[], scale: number) {
  const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  return points.map(p => ({
    x: cx + (p.x - cx) * scale,
    y: cy + (p.y - cy) * scale,
  }));
}

// Calculate cell position for an arm (sector s, radial row r 0..5, column c -1, 0, 1)
function getArmCellPos(s: number, r: number, c: number) {
  const angleDeg = -90 + s * 60;
  const rad = (angleDeg - 90) * (Math.PI / 180);
  const perpRad = rad + Math.PI / 2;

  const R = 130 + r * 42; // Radial distance from center
  const perpOffset = c * 42; // Perpendicular offset (column width)

  return {
    x: CX + R * Math.cos(rad) + perpOffset * Math.cos(perpRad),
    y: CY + R * Math.sin(rad) + perpOffset * Math.sin(perpRad),
  };
}

// Map main path cell index 0..77 to (s, r, c)
function getCellLocation(cellIdx: number): { s: number; r: number; c: number } {
  const logicalS = Math.floor(cellIdx / 13);
  const localIdx = cellIdx % 13;
  
  // For CCW, s decreases: 0, 5, 4, 3, 2, 1
  const s = (6 - logicalS) % 6;

  // Swap c to go OUT on c=1 and IN on c=-1
  if (localIdx <= 4) {
    // Right column going outward
    return { s, r: localIdx, c: 1 };
  } else if (localIdx === 5) {
    // Top cap right
    return { s, r: 5, c: 1 };
  } else if (localIdx === 6) {
    // Top cap center
    return { s, r: 5, c: 0 };
  } else if (localIdx === 7) {
    // Top cap left
    return { s, r: 5, c: -1 };
  } else {
    // Left column going inward
    const row = 4 - (localIdx - 8);
    return { s, r: row, c: -1 };
  }
}

// Get 3 Base token slot positions in triangular formation inside house
function getBaseSlotPos(colorKey: HexPlayerColor, tokenSlotIdx: number): { x: number; y: number } {
  const info = HEX_COLOR_INFO[colorKey];
  const s = info.sectorIndex;
  // House angle sits exactly between sector s-1 and s (offset by -30 deg)
  const houseAngle = -90 + s * 60 - 30;

  if (tokenSlotIdx === 0) {
    // Inner slot towards center
    return getPolarPos(220, houseAngle);
  } else if (tokenSlotIdx === 1) {
    // Outer left slot
    return getPolarPos(285, houseAngle - 6.5);
  } else {
    // Outer right slot
    return getPolarPos(285, houseAngle + 6.5);
  }
}

// Calculate token position in SVG space
export function getTokenCoordinates(token: HexToken, allTokens?: HexToken[]): { x: number; y: number } {
  const cellIdx = getCellIndexForToken(token.color, token.step);

  if (cellIdx === 'BASE') {
    return getBaseSlotPos(token.color, token.id % 3);
  }

  if (cellIdx === 'GOAL') {
    const info = HEX_COLOR_INFO[token.color];
    const s = info.sectorIndex;
    const goalAngle = -90 + s * 60;
    
    // Pyramid formation: 1 token ahead towards vertex, 2 tokens behind spread to sides
    const idx = token.id % 3;
    let radius = 48;
    let angleOffset = 0;
    if (idx === 1) {
      radius = 80;
      angleOffset = -13;
    } else if (idx === 2) {
      radius = 80;
      angleOffset = 13;
    }
    return getPolarPos(radius, goalAngle + angleOffset);
  }

  let basePos = { x: CX, y: CY };

  if (typeof cellIdx === 'string' && cellIdx.startsWith('H')) {
    const info = HEX_COLOR_INFO[token.color];
    const s = info.sectorIndex;
    const hNum = parseInt(cellIdx.replace('H', ''), 10);
    // H1 is row 4, H5 is row 0
    const row = 5 - hNum;
    basePos = getArmCellPos(s, row, 0);
  } else if (typeof cellIdx === 'number') {
    const loc = getCellLocation(cellIdx);
    basePos = getArmCellPos(loc.s, loc.r, loc.c);
  }

  if (!allTokens) {
    return basePos;
  }

  // Handle overlapping tokens
  const activeTokensOnCell = allTokens.filter((t) => {
    if (t.step === 0 || t.step >= 83) return false;
    const tCellIdx = getCellIndexForToken(t.color, t.step);
    if (tCellIdx !== cellIdx) return false;
    
    // Si la celda es un string (pasillo H1-H5 o GOAL), físicamente pertenecen a casas distintas
    if (typeof cellIdx === 'string' && t.color !== token.color) return false;
    
    return true;
  });

  if (activeTokensOnCell.length <= 1) {
    return basePos;
  }

  // Arrange tokens on the same cell in a clean ring or side-by-side
  const indexOnCell = activeTokensOnCell.findIndex((t) => t.color === token.color && t.id === token.id);
  const count = activeTokensOnCell.length;
  
  if (count === 2) {
      const dx = (indexOnCell === 0 ? -6 : 6);
      const dy = (indexOnCell === 0 ? -6 : 6);
      return { x: basePos.x + dx, y: basePos.y + dy };
  } else {
      const angle = (indexOnCell / count) * 2 * Math.PI;
      const radius = 8;
      return {
        x: basePos.x + Math.cos(angle) * radius,
        y: basePos.y + Math.sin(angle) * radius,
      };
  }
}

// -------------------------------------------------------------------------------------------------
// CAPA ESTÁTICA MEMOIZADA (SVG BACKGROUND)
// Esto renderiza el 100% de la geometría, estrellas, casas y pasillos 1 sola vez.
// Elimina el 95% de la carga de reconciliación DOM en GPU móvil durante las partidas.
// -------------------------------------------------------------------------------------------------
const HexBoardStaticSVG = React.memo(() => {
  return (
    <g id="hex-static-layer">
          <defs>
            <style>{`
              @keyframes breatheHex {
                0% { transform: scale(1); }
                50% { transform: scale(1.28); }
                100% { transform: scale(1); }
              }
              .breathing-token-hex {
                animation: breatheHex 1.4s ease-in-out infinite;
              }
              @keyframes fireworkRingHex {
                0% { transform: scale(0); opacity: 1; stroke-width: 12px; }
                100% { transform: scale(8); opacity: 0; stroke-width: 0px; }
              }
              @keyframes fireworkParticleHex {
                0% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
                50% { opacity: 1; }
                100% { transform: translate3d(var(--dx), var(--dy), 0) scale(0); opacity: 0; }
              }
            `}</style>
            <filter id="tokenShadow" filterUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000">
              <feDropShadow dx="2" dy="4" stdDeviation="4" floodOpacity="0.5" />
            </filter>
            <filter id="textOutline" filterUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000">
              <feMorphology in="SourceAlpha" operator="dilate" radius="1.5" result="DILATED" />
              <feFlood floodColor="#000000" floodOpacity="0.6" result="OUTLINE_COLOR" />
              <feComposite in="OUTLINE_COLOR" in2="DILATED" operator="in" result="OUTLINE" />
              <feMerge>
                <feMergeNode in="OUTLINE" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="houseShadow" filterUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodOpacity="0.15" />
            </filter>
            <filter id="baseShadow" filterUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000">
              <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.6" floodColor="#000000" />
            </filter>
            <filter id="innerBaseShadow" filterUnits="userSpaceOnUse" x="-1000" y="-1000" width="3000" height="3000">
              <feDropShadow dx="1" dy="2" stdDeviation="2" floodOpacity="0.4" floodColor="#000000" />
            </filter>
            {/* Gradients for tokens matching the 4-player classic style */}
            <radialGradient id="token-purple-grad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#a78bfa" />
              <stop offset="60%" stopColor="#8b5cf6" />
              <stop offset="100%" stopColor="#581c87" />
            </radialGradient>
            <radialGradient id="token-green-grad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="60%" stopColor="#22c55e" />
              <stop offset="100%" stopColor="#14532d" />
            </radialGradient>
            <radialGradient id="token-blue-grad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="60%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#0c4a6e" />
            </radialGradient>
            <radialGradient id="token-orange-grad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="60%" stopColor="#f97316" />
              <stop offset="100%" stopColor="#7c2d12" />
            </radialGradient>
            <radialGradient id="token-yellow-grad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#fde047" />
              <stop offset="60%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#713f12" />
            </radialGradient>
            <radialGradient id="token-red-grad" cx="30%" cy="30%" r="70%">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="60%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#7f1d1d" />
            </radialGradient>
          </defs>

          {/* Base 12-gon Background perfectly matching outer edges and house bases */}
          <polygon
            points={Array.from({ length: 12 }).map((_, i) => {
              const sector = Math.floor(i / 2);
              const isRightCorner = i % 2 === 1;
              const angle = -90 + sector * 60 + (isRightCorner ? 9.9 : -9.9);
              const p = getPolarPos(366.5, angle);
              return `${p.x},${p.y}`;
            }).join(' ')}
            fill="#f8fafc"
            stroke="#cbd5e1"
            strokeWidth="8"
            strokeLinejoin="round"
          />

          {/* 6 Home Corridors (H1..H5) */}
          {HEX_COLORS_ORDER.map((colorKey) => {
            const info = HEX_COLOR_INFO[colorKey];
            const s = info.sectorIndex;

            return (
              <g key={`corridor-${colorKey}`}>
                {[1, 2, 3, 4, 5].map((hNum) => {
                  const row = 5 - hNum; // H1=row 4, H5=row 0
                  const pos = getArmCellPos(s, row, 0);

                  return (
                    <g key={`hcell-${colorKey}-${hNum}`}>
                      <rect
                        x={pos.x - 21}
                        y={pos.y - 21}
                        width="42"
                        height="42"
                        rx="2"
                        fill={info.hexCode}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        transform={`rotate(${s * 60} ${pos.x} ${pos.y})`}
                      />
                      <text
                        x={pos.x}
                        y={pos.y + 4.5}
                        fill="#ffffff"
                        fontSize="13"
                        fontWeight="900"
                        textAnchor="middle"
                      >
                        H{hNum}
                      </text>
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Main Track Cells (0 to 77) Numbering Overlay */}
          {Array.from({ length: 78 }).map((_, cellIdx) => {
            const loc = getCellLocation(cellIdx);
            const pos = getArmCellPos(loc.s, loc.r, loc.c);
            const isStar = STAR_CELLS.includes(cellIdx);

            const starColorObj = HEX_COLORS_ORDER.map((c) => HEX_COLOR_INFO[c]).find(
              (info) => info.starCell === cellIdx
            );

            const polygonFill = starColorObj ? "#ffffff" : "#f59e0b";
            const polygonStroke = starColorObj ? "#ffffff" : "#b45309";

            return (
              <g key={`track-cell-${cellIdx}`}>
                <rect
                  x={pos.x - 21}
                  y={pos.y - 21}
                  width="42"
                  height="42"
                  rx="2"
                  fill={starColorObj ? starColorObj.hexCode : "#ffffff"}
                  stroke={starColorObj ? "#ffffff" : "#cbd5e1"}
                  strokeWidth="1.5"
                  transform={`rotate(${loc.s * 60} ${pos.x} ${pos.y})`}
                />
                {isStar && (
                  <polygon
                    points={`${pos.x},${pos.y - 15} ${pos.x + 5},${pos.y - 5} ${pos.x + 15},${pos.y - 4} ${pos.x + 7},${pos.y + 5} ${pos.x + 10},${pos.y + 15} ${pos.x},${pos.y + 9} ${pos.x - 10},${pos.y + 15} ${pos.x - 7},${pos.y + 5} ${pos.x - 15},${pos.y - 4} ${pos.x - 5},${pos.y - 5}`}
                    fill={polygonFill}
                    stroke={polygonStroke}
                    strokeWidth="1"
                    transform={`rotate(${loc.s * 60} ${pos.x} ${pos.y})`}
                  />
                )}
                <text
                  x={pos.x}
                  y={pos.y + 4.5}
                  fill={starColorObj ? "#ffffff" : "#94a3b8"}
                  fontSize="13"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {cellIdx}
                </text>
              </g>
            );
          })}

          {/* Central Hexagon split into 6 Goal Slices */}
          <g>
            {HEX_COLORS_ORDER.map((colorKey) => {
              const info = HEX_COLOR_INFO[colorKey];
              const s = info.sectorIndex;
              // Slices align with the arms
              const angle1 = -90 + s * 60 - 30;
              const angle2 = -90 + s * 60 + 30;

              const p1 = getPolarPos(130, angle1);
              const p2 = getPolarPos(130, angle2);

              return (
                <polygon
                  key={`goal-slice-${colorKey}`}
                  points={`${CX},${CY} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                  fill={info.hexCode}
                  stroke="#ffffff"
                  strokeWidth="4"
                  strokeLinejoin="round"
                />
              );
            })}
          </g>

          {/* 6 Triangular Houses (Bases) placed at the corners */}
          {HEX_COLORS_ORDER.map((colorKey) => {
            const info = HEX_COLOR_INFO[colorKey];
            const s = info.sectorIndex;
            const houseAngle = -90 + s * 60 - 30; // Points to the corner adjacent to start cell

            // Triangle vertices
            const vTip = getPolarPos(126, houseAngle);
            const vLeft = getPolarPos(366.5, houseAngle - 20.1);
            const vRight = getPolarPos(366.5, houseAngle + 20.1);

            return (
              <g key={`house-${colorKey}`} filter="url(#baseShadow)">
                {/* House Triangle Background outer */}
                <polygon
                  points={`${vTip.x},${vTip.y} ${vLeft.x},${vLeft.y} ${vRight.x},${vRight.y}`}
                  fill={info.hexCode}
                  stroke={info.darkHex}
                  strokeWidth="3.5"
                  strokeLinejoin="round"
                />
                {/* House Triangle Background inner (dashed) */}
                <polygon
                  points={getInnerPolygon([vTip, vLeft, vRight], 0.78).map(p => `${p.x},${p.y}`).join(' ')}
                  fill={info.darkHex}
                  stroke={info.deepHex || info.hexCode}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeDasharray="4"
                  filter="url(#innerBaseShadow)"
                />
                {/* 3 Token Base Slots in Triangular Formation */}
                {[0, 1, 2].map((slotIdx) => {
                  const pos = getBaseSlotPos(colorKey, slotIdx);
                  return (
                    <circle
                      key={`slot-${colorKey}-${slotIdx}`}
                      cx={pos.x}
                      cy={pos.y}
                      r="18"
                      fill="rgba(255, 255, 255, 0.2)"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                      opacity="0.8"
                    />
                  );
                })}
              </g>
            );
          })}
    </g>
  );
});

const HexagonalLudoBoardViewComponent: React.FC<HexagonalLudoBoardViewProps> = ({
  tokens,
  players,
  currentTurnIndex,
  playableTokenIds,
  onTokenClick,
  appTheme,
  explosionData,
}) => {
  const activePlayer = players[currentTurnIndex];

  return (
    <div className="relative w-full max-w-[650px] mx-auto select-none flex items-center justify-center p-0">
      <svg
        viewBox="139 156 722 688"
        className="w-full h-auto drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
        style={{ touchAction: 'none', maxHeight: 'calc(100vh - 130px)' }}
      >
          <HexBoardStaticSVG />

          {/* Tokens Layer */}
          {tokens.map((token) => {
            const pos = getTokenCoordinates(token, tokens);
            const isPlayable = playableTokenIds.includes(token.id) && activePlayer?.color === token.color;
            const tokenInfo = HEX_COLOR_INFO[token.color];
            const isBase = token.step === 0;

            return (
              <g
                key={`hex-token-${token.color}-${token.id}`}
                onClick={() => {
                  if (isPlayable) {
                    onTokenClick(token.id);
                  }
                }}
                className={`${isPlayable ? 'cursor-pointer' : 'pointer-events-none'}`}
                style={{
                  transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
                  willChange: 'transform',
                  transition: 'transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                }}
              >
                <g className={`${isPlayable && activePlayer?.type === 'human' ? 'breathing-token-hex' : ''}`}>
                  {appTheme === 'sugar' ? (
                    <>
                      <g transform={`scale(${isBase ? 0.75 : 0.85})`}>
                        <path d="M -15 0 L -24 -10 L -24 10 Z" fill={tokenInfo.hexCode} opacity="0.9" />
                        <path d="M 15 0 L 24 -10 L 24 10 Z" fill={tokenInfo.hexCode} opacity="0.9" />
                        <circle cx={0} cy={0} r={16} fill={tokenInfo.hexCode} stroke="rgba(255,255,255,0.9)" strokeWidth="3" filter="drop-shadow(0px 3px 4px var(--shadow-color))" />
                        <circle cx={0} cy={0} r={8} fill="rgba(255,255,255,0.45)" />
                        <circle cx={-4} cy={-4} r={3} fill="rgba(255,255,255,0.8)" />
                      </g>
                    </>
                  ) : (
                    <>
                      <g transform={`scale(${isBase ? 0.75 : 0.85})`}>
                        <circle cx={0} cy={0} r={16} fill={`url(#token-${token.color}-grad)`} stroke="var(--color-border)" strokeWidth="2" filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.4))" />
                        <circle cx={0} cy={0} r={10} fill="var(--bg-panel)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" />
                        <circle cx={0} cy={0} r={5} fill={`url(#token-${token.color}-grad)`} />
                        <circle cx={-5} cy={-5} r={2.5} fill="rgba(255, 255, 255, 0.8)" />
                      </g>
                    </>
                  )}

                  {/* Token Number */}
                  <text
                    x={0}
                    y={0.5}
                    fill="#FFFFFF"
                    fontSize={isBase ? "9" : "10"}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    opacity="0.9"
                  >
                    {token.id + 1}
                  </text>
                </g>
              </g>
            );
          })}

          {/* --- OVERLAY DE EXPLOSIÓN SUPREMA (Fuegos Artificiales Hexagonal) --- */}
          {explosionData && typeof explosionData.cellIndex === 'number' && (() => {
            const loc = getCellLocation(explosionData.cellIndex);
            const pos = getArmCellPos(loc.s, loc.r, loc.c);
            const x = pos.x;
            const y = pos.y;
            const colorHex = HEX_COLOR_INFO[explosionData.color]?.hexCode || '#ff0055';
            
            return (
              <g className="fireworks-overlay" style={{ transformOrigin: `${x}px ${y}px` }}>
                {/* Ring Expansivo */}
                <circle cx={x} cy={y} r={15} fill="none" stroke={colorHex} style={{ animation: 'fireworkRingHex 0.8s ease-out forwards', transformOrigin: `${x}px ${y}px` }} />
                
                {/* Partículas Masivas */}
                {Array.from({ length: 16 }).map((_, i) => {
                  const angle = (i * 360) / 16;
                  const rad = angle * Math.PI / 180;
                  const distance = 100 + (i % 2 === 0 ? 60 : 0);
                  const dx = Math.cos(rad) * distance;
                  const dy = Math.sin(rad) * distance + 60;
                  
                  return (
                    <circle 
                      key={i} 
                      cx={x} cy={y} r={5 + (i % 4)} 
                      fill={colorHex} 
                      style={{
                        animation: `fireworkParticleHex 3.5s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
                        animationDelay: `${Math.random() * 0.15}s`,
                        '--dx': `${dx}px`,
                        '--dy': `${dy}px`,
                        transformOrigin: `${x}px ${y}px`
                      } as any} 
                    />
                  );
                })}
              </g>
            );
          })()}
        </svg>
    </div>
  );
};

export const HexagonalLudoBoardView = React.memo(HexagonalLudoBoardViewComponent, (prevProps, nextProps) => {
  if (prevProps.appTheme !== nextProps.appTheme) return false;
  if (prevProps.currentTurnIndex !== nextProps.currentTurnIndex) return false;
  if (prevProps.humanPlayerId !== nextProps.humanPlayerId) return false;
  
  // Comparar tokens rápidamente
  if (prevProps.tokens.length !== nextProps.tokens.length) return false;
  for (let i = 0; i < prevProps.tokens.length; i++) {
    const pt = prevProps.tokens[i];
    const nt = nextProps.tokens[i];
    if (pt.step !== nt.step || pt.color !== nt.color || pt.playerId !== nt.playerId) return false;
  }
  
  if (prevProps.playableTokenIds.join(',') !== nextProps.playableTokenIds.join(',')) return false;
  
  const prevExp = prevProps.explosionData ? `${prevProps.explosionData.cellIndex}-${prevProps.explosionData.color}` : '';
  const nextExp = nextProps.explosionData ? `${nextProps.explosionData.cellIndex}-${nextProps.explosionData.color}` : '';
  if (prevExp !== nextExp) return false;
  
  return true;
});

