import React, { useMemo } from 'react';
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
import { getBoardTheme } from '../themes/boardThemes';
import { getTokenTheme } from '../themes/tokenThemes';

interface HexagonalLudoBoardViewProps {
  tokens: HexToken[];
  players: HexPlayer[];
  currentTurnIndex: number;
  playableTokenIds: number[];
  onTokenClick: (tokenId: number) => void;
  humanPlayerId: number;
  appTheme?: 'classic' | 'sugar';
  boardSkinId?: string;
  tokenSkinId?: string;
  explosionData?: { cellIndex: number | string, color: HexPlayerColor } | null;
  rotationOffset?: number;
  isAnimating?: boolean;
  isRolling?: boolean;
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
export function getTokenCoordinates(token: HexToken, allTokensOrMap?: HexToken[] | Map<string, HexToken[]>): { x: number; y: number } {
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

  if (!allTokensOrMap) {
    return basePos;
  }

  // Handle overlapping tokens in O(1) if map provided
  let activeTokensOnCell: HexToken[] = [];
  if (allTokensOrMap instanceof Map) {
    const key = typeof cellIdx === 'string' ? `${token.color}_${cellIdx}` : `cell_${cellIdx}`;
    activeTokensOnCell = allTokensOrMap.get(key) || [];
  } else if (Array.isArray(allTokensOrMap)) {
    activeTokensOnCell = allTokensOrMap.filter((t) => {
      if (t.step === 0 || t.step >= 83) return false;
      const tCellIdx = getCellIndexForToken(t.color, t.step);
      if (tCellIdx !== cellIdx) return false;
      if (typeof cellIdx === 'string' && t.color !== token.color) return false;
      return true;
    });
  }

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
const HexBoardStaticSVG = React.memo(({ rotationOffset, boardSkinId }: { rotationOffset: number, boardSkinId?: string }) => {
  const boardTheme = getBoardTheme(boardSkinId);

  return (
    <g id="hex-static-layer">
          <defs>
            <style>{`
              @keyframes breatheHex {
                0% { transform: scale(1); }
                50% { transform: scale(1.22); }
                100% { transform: scale(1); }
              }
              .breathing-token-hex {
                animation: breatheHex 1.4s ease-in-out infinite;
                will-change: transform;
                transform-origin: center center;
              }
              @keyframes fireworkRingHexHTML {
                0% { transform: scale(0); opacity: 1; border-width: 6px; }
                100% { transform: scale(8); opacity: 0; border-width: 0px; }
              }
              @keyframes fireworkParticleHexHTML {
                0% { transform: translate3d(0, 0, 0) scale(1); opacity: 1; }
                50% { opacity: 1; }
                100% { transform: translate3d(var(--dx), var(--dy), 0) scale(0); opacity: 0; }
              }
            `}</style>
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
            fill={boardSkinId && boardSkinId !== 'board_default' ? boardTheme.svgBg : "#f8fafc"}
            stroke={boardSkinId && boardSkinId !== 'board_default' ? boardTheme.gridStroke : "#cbd5e1"}
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
                        transform={`rotate(${-rotationOffset} ${pos.x} ${pos.y + 1.5})`}
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
                  transform={`rotate(${-rotationOffset} ${pos.x} ${pos.y + 1.5})`}
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
              <g key={`house-${colorKey}`}>
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
  boardSkinId,
  tokenSkinId,
  explosionData,
  rotationOffset,
}) => {
  const activePlayer = players[currentTurnIndex];
  const tokenTheme = getTokenTheme(tokenSkinId);

  // Pre-calculate active tokens on cells to avoid O(N^2) filter inside getTokenCoordinates
  const cellTokensMap = useMemo(() => {
    const map = new Map<string, HexToken[]>();
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.step > 0 && t.step < 83) {
        const cIdx = getCellIndexForToken(t.color, t.step);
        if (cIdx !== 'BASE' && cIdx !== 'GOAL') {
          const key = typeof cIdx === 'string' ? `${t.color}_${cIdx}` : `cell_${cIdx}`;
          let list = map.get(key);
          if (!list) {
            list = [];
            map.set(key, list);
          }
          list.push(t);
        }
      }
    }
    return map;
  }, [tokens]);

  return (
    <div className="relative w-full mx-auto select-none flex items-center justify-center p-0">
      <svg
        viewBox="139 156 722 688"
        className="w-full h-auto block drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)]"
        style={{ touchAction: 'none' }}
      >
          <HexBoardStaticSVG rotationOffset={rotationOffset || 0} boardSkinId={boardSkinId} />

      </svg>

      {/* --- HTML GPU OVERLAY (Fichas Hexágono Aceleradas por GPU a 60 FPS) --- */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {tokens.map((token) => {
          const pos = getTokenCoordinates(token, cellTokensMap);
          const globalId = token.playerId * 4 + token.id;
          const isPlayable = (playableTokenIds.includes(token.id) || playableTokenIds.includes(globalId)) && activePlayer?.color === token.color;
          const tokenInfo = HEX_COLOR_INFO[token.color];
          const isBase = token.step <= 0;

          // Pure GPU Hardware Translation using percentage of 48px token size on 722x688 viewBox board
          const tx = (((pos.x - 139) / 48) * 100) - 50;
          const ty = (((pos.y - 156) / 48) * 100) - 50;

          return (
            <div
              key={`hex-token-${token.color}-${token.id}`}
              className={`absolute top-0 left-0 ${isPlayable ? 'cursor-pointer pointer-events-auto' : 'pointer-events-none'}`}
              style={{
                width: `${(48 / 722) * 100}%`,
                height: `${(48 / 688) * 100}%`,
                transform: `translate3d(${tx}%, ${ty}%, 0)`,
                transition: 'transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                willChange: 'transform',
                zIndex: isPlayable ? 30 : 10,
              }}
              onClick={() => isPlayable && onTokenClick(token.id)}
            >
              <div className={`w-full h-full flex items-center justify-center ${isPlayable && activePlayer?.type === 'human' ? 'breathing-token-hex' : ''}`}>
                <svg 
                  viewBox="-24 -24 48 48" 
                  className="w-full h-full overflow-visible cursor-pointer"
                  style={{ transform: `rotate(${-(rotationOffset || 0)}deg)` }}
                >
                  <g transform={`scale(${isBase ? 0.75 : 0.85})`}>
                    {tokenTheme.style === 'gem' ? (
                      <>
                        <polygon points="0,-18 16,-6 12,16 -12,16 -16,-6" fill={tokenInfo.hexCode} stroke="#ffffff" strokeWidth="2" filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.5))" />
                        <polygon points="0,-18 16,-6 0,0 -16,-6" fill="rgba(255,255,255,0.4)" stroke="#ffffff" strokeWidth="1" />
                        <circle cx={-5} cy={-8} r={1.5} fill="#ffffff" />
                      </>
                    ) : tokenTheme.style === 'candy' ? (
                      <>
                        <circle cx={0} cy={0} r={16} fill={tokenInfo.hexCode} stroke="#ffffff" strokeWidth="2.5" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.4))" />
                        <circle cx={0} cy={0} r={12} fill="none" stroke="#fff0f5" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
                        <circle cx={-6} cy={-6} r={2.5} fill="#ffffff" opacity="0.8" />
                      </>
                    ) : tokenTheme.style === 'gold' ? (
                      <>
                        <circle cx={0} cy={0} r={16} fill="#eab308" stroke="#fef08a" strokeWidth="2.5" filter="drop-shadow(0px 2px 4px rgba(0,0,0,0.5))" />
                        <circle cx={0} cy={0} r={11} fill={tokenInfo.hexCode} stroke="#ca8a04" strokeWidth="1.5" />
                        <circle cx={-5} cy={-5} r={2} fill="#ffffff" opacity="0.8" />
                      </>
                    ) : (
                      <>
                        <circle cx={1.5} cy={2.5} r={16} fill="rgba(0,0,0,0.35)" />
                        <circle cx={0} cy={0} r={16} fill={tokenInfo.hexCode} stroke="var(--color-border)" strokeWidth="2" />
                        <circle cx={0} cy={0} r={10} fill="var(--bg-panel)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" />
                        <circle cx={0} cy={0} r={5} fill={tokenInfo.hexCode} />
                        <circle cx={-5} cy={-5} r={2.5} fill="rgba(255, 255, 255, 0.8)" />
                      </>
                    )}
                  </g>

                  {/* Token Number */}
                  <text
                    x={0}
                    y={0.5}
                    fill="#FFFFFF"
                    fontSize={isBase ? "9" : "10"}
                    fontWeight="bold"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    opacity="0.95"
                  >
                    {token.id + 1}
                  </text>
                </svg>
              </div>
            </div>
          );
        })}
        {/* --- OVERLAY DE EXPLOSIÓN SUPREMA (Fuegos Artificiales GPU HTML) --- */}
        {explosionData && typeof explosionData.cellIndex === 'number' && (() => {
          const loc = getCellLocation(explosionData.cellIndex);
          const pos = getArmCellPos(loc.s, loc.r, loc.c);
          const x = pos.x;
          const y = pos.y;
          const colorHex = HEX_COLOR_INFO[explosionData.color]?.hexCode || '#ff0055';

          return (
            <div className="absolute inset-0 pointer-events-none z-[100] overflow-visible">
              <div 
                className="absolute"
                style={{
                  left: `${((x - 139) / 722) * 100}%`,
                  top: `${((y - 156) / 688) * 100}%`,
                }}
              >
                {/* Ring */}
                <div 
                  className="absolute rounded-full border-solid"
                  style={{
                    borderColor: colorHex,
                    borderWidth: '6px',
                    width: '30px',
                    height: '30px',
                    left: '-15px',
                    top: '-15px',
                    animation: 'fireworkRingHexHTML 0.8s ease-out forwards'
                  }}
                />
                {/* Particles */}
                {Array.from({ length: 16 }).map((_, i) => {
                  const angle = (i * 360) / 16;
                  const rad = angle * Math.PI / 180;
                  const distance = 100 + (i % 2 === 0 ? 60 : 0);
                  const dx = Math.cos(rad) * distance;
                  const dy = Math.sin(rad) * distance + 60;
                  const randomDelay = (i * 17 % 100) / 1000 * 1.5;
                  const size = 10 + (i % 4) * 2;
                  
                  return (
                    <div 
                      key={`spark-${i}`}
                      className="absolute rounded-full"
                      style={{
                        backgroundColor: colorHex,
                        width: `${size}px`,
                        height: `${size}px`,
                        left: `${-size / 2}px`,
                        top: `${-size / 2}px`,
                        animation: `fireworkParticleHexHTML 3.5s cubic-bezier(0.25, 1, 0.5, 1) forwards`,
                        animationDelay: `${randomDelay}s`,
                        '--dx': `${dx}px`,
                        '--dy': `${dy}px`,
                      } as any}
                    />
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export const HexagonalLudoBoardView = React.memo(HexagonalLudoBoardViewComponent, (prevProps, nextProps) => {
  if (prevProps.appTheme !== nextProps.appTheme) return false;
  if (prevProps.currentTurnIndex !== nextProps.currentTurnIndex) return false;
  if (prevProps.humanPlayerId !== nextProps.humanPlayerId) return false;
  if (prevProps.isAnimating !== nextProps.isAnimating) return false;
  if (prevProps.isRolling !== nextProps.isRolling) return false;
  
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

