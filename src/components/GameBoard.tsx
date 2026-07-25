import React from 'react';
import { PlayerColor, Token, CellCoord } from '../types';

import { AppTheme } from '../types';
interface GameBoardProps {
  appTheme?: AppTheme;
  tokens: Token[];
  currentTurn: number;
  playableTokenIds: number[];
  onTokenClick: (tokenId: number) => void;
  humanPlayerId: number;
  isZeroIndexed?: boolean;
}

// 52 Perimeter cells in clockwise order starting from Amarillo's start at (6,14) as per specification
export const PERIMETER_CELLS: CellCoord[] = [
  // 0..5
  { row: 6, col: 14 },
  { row: 6, col: 13 },
  { row: 6, col: 12 },
  { row: 6, col: 11 },
  { row: 6, col: 10 },
  { row: 6, col: 9 },
  // 6..11
  { row: 5, col: 8 },
  { row: 4, col: 8 },
  { row: 3, col: 8 },
  { row: 2, col: 8 },
  { row: 1, col: 8 },
  { row: 0, col: 8 },
  // 12
  { row: 0, col: 7 },
  // 13..18
  { row: 0, col: 6 },
  { row: 1, col: 6 },
  { row: 2, col: 6 },
  { row: 3, col: 6 },
  { row: 4, col: 6 },
  { row: 5, col: 6 },
  // 19..24
  { row: 6, col: 5 },
  { row: 6, col: 4 },
  { row: 6, col: 3 },
  { row: 6, col: 2 },
  { row: 6, col: 1 },
  { row: 6, col: 0 },
  // 25
  { row: 7, col: 0 },
  // 26..31
  { row: 8, col: 0 },
  { row: 8, col: 1 },
  { row: 8, col: 2 },
  { row: 8, col: 3 },
  { row: 8, col: 4 },
  { row: 8, col: 5 },
  // 32..37
  { row: 9, col: 6 },
  { row: 10, col: 6 },
  { row: 11, col: 6 },
  { row: 12, col: 6 },
  { row: 13, col: 6 },
  { row: 14, col: 6 },
  // 38
  { row: 14, col: 7 },
  // 39..44
  { row: 14, col: 8 },
  { row: 13, col: 8 },
  { row: 12, col: 8 },
  { row: 11, col: 8 },
  { row: 10, col: 8 },
  { row: 9, col: 8 },
  // 45..50
  { row: 8, col: 9 },
  { row: 8, col: 10 },
  { row: 8, col: 11 },
  { row: 8, col: 12 },
  { row: 8, col: 13 },
  { row: 8, col: 14 },
  // 51
  { row: 7, col: 14 },
];

export const START_OFFSETS: Record<PlayerColor, number> = {
  blue: 1,
  green: 14,
  red: 27,
  yellow: 40,
  purple: 0,
  orange: 0,
};

// Helper to check if a perimeter index is a start cell
export function getStartColorFromIndex(index: number): PlayerColor | null {
  if (index === 1) return 'blue';
  if (index === 14) return 'green';
  if (index === 27) return 'red';
  if (index === 40) return 'yellow';
  return null;
}

// Helper to check if a perimeter index is a safety cell (Stars)
export function isSafeCell(index: number): boolean {
  return [1, 8, 14, 21, 27, 34, 40, 47].includes(index);
}

// Map player colors to their exact hex codes
export const COLOR_HEX: Record<PlayerColor, string> = {
  red: 'var(--color-p-red)',
  green: 'var(--color-p-green)',
  blue: 'var(--color-p-blue)',
  yellow: 'var(--color-p-yellow)',
  purple: '#a855f7',
  orange: '#f97316',
};

// Map player colors to lighter slot backgrounds
export const COLOR_HEX_LIGHT: Record<PlayerColor, string> = {
  red: 'var(--color-red-light)',
  green: 'var(--color-green-light)',
  blue: 'var(--color-blue-light)',
  yellow: 'var(--color-yellow-light)',
  purple: '#f3e8ff',
  orange: '#ffedd5',
};

// Grid coordinate mapping function
export function getCellCoord(color: PlayerColor, step: number): CellCoord {
  if (step === 0) {
    return { row: 0, col: 0 }; // base, handled separately by slot coordination
  }
  if (step === 57) {
    // Goal coordinates (exact centers of the triangles in grid terms)
    if (color === 'green') return { row: 6, col: 7 };  // top triangle
    if (color === 'blue') return { row: 7, col: 8 };   // right triangle
    if (color === 'yellow') return { row: 8, col: 7 }; // bottom triangle
    if (color === 'red') return { row: 7, col: 6 };    // left triangle
  }
  if (step >= 1 && step <= 51) {
    // Perimeter path
    const offset = START_OFFSETS[color];
    const pIndex = (offset + step - 1) % 52;
    return PERIMETER_CELLS[pIndex];
  }
  if (step >= 52 && step <= 56) {
    // Home run path
    const hIndex = step - 52; // 0..4
    if (color === 'green') return { row: 1 + hIndex, col: 7 };  // Top side aisle
    if (color === 'blue') return { row: 7, col: 13 - hIndex };   // Right side aisle
    if (color === 'yellow') return { row: 13 - hIndex, col: 7 }; // Bottom side aisle
    if (color === 'red') return { row: 7, col: 1 + hIndex };    // Left side aisle
  }
  return { row: 0, col: 0 };
}

// Slot coordinates in the player base
export function getBaseSlotCoord(color: PlayerColor, slotId: number): { x: number; y: number } {
  let baseX = 0;
  let baseY = 0;

  if (color === 'green') { baseX = 0; baseY = 0; }
  else if (color === 'blue') { baseX = 450; baseY = 0; }
  else if (color === 'yellow') { baseX = 450; baseY = 450; }
  else if (color === 'red') { baseX = 0; baseY = 450; }

  // 4 slots offset inside base container
  const x = baseX + 40 + (slotId % 2 === 0 ? 55 : 165);
  const y = baseY + 40 + (Math.floor(slotId / 2) === 0 ? 55 : 165);
  return { x, y };
}

export const GameBoard: React.FC<GameBoardProps> = ({
  tokens,
  currentTurn,
  playableTokenIds,
  onTokenClick,
  humanPlayerId,
  appTheme,
  isZeroIndexed = false,
}) => {
  const cellSize = 50;

  // Compute visual coordinates for all tokens, resolving overlaps on the same cell
  const getTokenVisualCoord = (rawToken: Token): { x: number; y: number } => {
    // Normalize step to 1-indexed (Base: 0, Path: 1..51, Goal: 57) for rendering if source is 0-indexed (-1, 0..50, 56)
    const token = isZeroIndexed ? { ...rawToken, step: rawToken.step + 1 } : rawToken;

    if (token.step === 0) {
      return getBaseSlotCoord(token.color, token.id);
    }

    if (token.step === 57) {
      // Offset slightly inside goal triangles
      let baseX = 375;
      let baseY = 375;
      if (token.color === 'green') { baseX = 375; baseY = 335; }  // top
      if (token.color === 'blue') { baseX = 415; baseY = 375; }   // right
      if (token.color === 'yellow') { baseX = 375; baseY = 415; } // bottom
      if (token.color === 'red') { baseX = 335; baseY = 375; }    // left

      // Slot-specific offset in Goal so all 4 tokens are clean
      const dx = (token.id % 2 === 0 ? -12 : 12);
      const dy = (Math.floor(token.id / 2) === 0 ? -12 : 12);
      return { x: baseX + dx, y: baseY + dy };
    }

    // Normal path or home run
    const gridCoord = getCellCoord(token.color, token.step);
    const cx = gridCoord.col * cellSize + cellSize / 2;
    const cy = gridCoord.row * cellSize + cellSize / 2;

    // Find all tokens currently sharing this same grid position (excluding those in base or goal)
    const activeTokensOnCell = tokens.filter((t) => {
      const normStep = isZeroIndexed ? t.step + 1 : t.step;
      if (normStep === 0 || normStep === 57) return false;
      const otherCoord = getCellCoord(t.color, normStep);
      return otherCoord.row === gridCoord.row && otherCoord.col === gridCoord.col;
    });

    if (activeTokensOnCell.length <= 1) {
      return { x: cx, y: cy };
    }

    // Arrange tokens on the same cell in a clean ring
    const indexOnCell = activeTokensOnCell.findIndex((t) => t.playerId === token.playerId && t.id === token.id);
    const count = activeTokensOnCell.length;
    const angle = (indexOnCell / count) * 2 * Math.PI;
    const radius = 10;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    };
  };

  // Helper to render star path (large/centered or small)
  const renderStarPath = (cx: number, cy: number, r: number, color: string) => {
    const points = [];
    for (let i = 0; i < 5; i++) {
      const angleOuter = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const angleInner = angleOuter + Math.PI / 5;
      points.push(`${cx + r * Math.cos(angleOuter)},${cy + r * Math.sin(angleOuter)}`);
      points.push(`${cx + (r / 2) * Math.cos(angleInner)},${cy + (r / 2) * Math.sin(angleInner)}`);
    }
    return <polygon points={points.join(' ')} fill={color} stroke="none" />;
  };

  return (
    <div id="ludo_board_container" className="relative w-full max-w-[550px] mx-auto bg-white rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] border-4 border-[#cbd5e1] p-2 overflow-hidden select-none">
      {/* 15x15 SVG Board */}
      <svg
        viewBox="0 0 750 750"
        className="w-full h-auto rounded-lg bg-white"
        style={{ touchAction: 'none' }}
      >
        {/* Definition of shadows and gradients */}
        <defs>
          <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
            <feDropShadow dx="2" dy="4" stdDeviation="3" floodOpacity="0.6" floodColor="#000000" />
          </filter>
          <radialGradient id="token-red-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ff4d88" />
            <stop offset="60%" stopColor="#ff0055" />
            <stop offset="100%" stopColor="#990033" />
          </radialGradient>
          <radialGradient id="token-green-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="60%" stopColor="#059669" />
            <stop offset="100%" stopColor="#065f46" />
          </radialGradient>
          <radialGradient id="token-blue-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="60%" stopColor="#0284c7" />
            <stop offset="100%" stopColor="#075985" />
          </radialGradient>
          <radialGradient id="token-yellow-grad" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="60%" stopColor="#ca8a04" />
            <stop offset="100%" stopColor="#854d0e" />
          </radialGradient>
        </defs>

        {/* --- GRID CELLS --- */}
        {/* Render all 52 perimeter path cells */}
        {PERIMETER_CELLS.map((cell, idx) => {
          const x = cell.col * cellSize;
          const y = cell.row * cellSize;
          const startColor = getStartColorFromIndex(idx);
          const isSafe = isSafeCell(idx);

          // Determine cell fill color
          let fill = '#e2e8f0';
          if (startColor) {
            fill = COLOR_HEX[startColor];
          }

          return (
            <g key={`cell-${idx}`} filter="url(#shadow)">
              <rect
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={fill}
                stroke="#94a3b8"
                strokeWidth="1.5"
              />
              {/* If it's a starting cell, render a big white star */}
              {startColor && renderStarPath(x + 25, y + 25, 14, '#ef4444')}
              {/* If it's a regular safe cell (not starting), render a golden star */}
              {!startColor && isSafe && renderStarPath(x + 25, y + 25, 12, '#ef4444')}

              {/* Number for the cell (rendered on top) */}
              <text x={x + 25} y={y + 26} fill={startColor ? "#ffffff" : isSafe ? "#ca8a04" : "#94a3b8"} fontSize="14" fontWeight="bold" textAnchor="middle" dominantBaseline="middle" opacity={startColor ? 1 : isSafe ? 0.9 : 0.6}>
                {idx + 1}
              </text>
            </g>
          );
        })}

        {/* --- HOME RUN PASILLOS (H1..H5) --- */}
        {/* Rojo Home Run (Left side: Row 7, Cols 1..5) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const col = 1 + i;
          const x = col * cellSize;
          const y = 7 * cellSize;
          return (
            <g key={`home-red-${i}`}>
              <rect x={x} y={y} width={cellSize} height={cellSize} fill="#ff0055" stroke="#ffffff" strokeWidth="1.5" />
              <text x={x + 25} y={y + 22} fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">H{i+1}</text>
              <circle cx={x + 25} cy={y + 36} r="3" fill="#ffffff" opacity="0.8" />
            </g>
          );
        })}

        {/* Verde Home Run (Top side: Col 7, Rows 1..5) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const row = 1 + i;
          const x = 7 * cellSize;
          const y = row * cellSize;
          return (
            <g key={`home-green-${i}`}>
              <rect x={x} y={y} width={cellSize} height={cellSize} fill="#059669" stroke="#ffffff" strokeWidth="1.5" />
              <text x={x + 25} y={y + 22} fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">H{i+1}</text>
              <circle cx={x + 25} cy={y + 36} r="3" fill="#ffffff" opacity="0.8" />
            </g>
          );
        })}

        {/* Azul Home Run (Right side: Row 7, Cols 9..13) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const col = 13 - i;
          const x = col * cellSize;
          const y = 7 * cellSize;
          return (
            <g key={`home-blue-${i}`}>
              <rect x={x} y={y} width={cellSize} height={cellSize} fill="#0284c7" stroke="#ffffff" strokeWidth="1.5" />
              <text x={x + 25} y={y + 22} fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">H{i+1}</text>
              <circle cx={x + 25} cy={y + 36} r="3" fill="#ffffff" opacity="0.8" />
            </g>
          );
        })}

        {/* Amarillo Home Run (Bottom side: Col 7, Rows 9..13) */}
        {Array.from({ length: 5 }).map((_, i) => {
          const row = 13 - i;
          const x = 7 * cellSize;
          const y = row * cellSize;
          return (
            <g key={`home-yellow-${i}`}>
              <rect x={x} y={y} width={cellSize} height={cellSize} fill="#ca8a04" stroke="#ffffff" strokeWidth="1.5" />
              <text x={x + 25} y={y + 22} fill="#ffffff" fontSize="11" fontWeight="bold" fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">H{i+1}</text>
              <circle cx={x + 25} cy={y + 36} r="3" fill="#ffffff" opacity="0.8" />
            </g>
          );
        })}


        {/* --- BASE QUADRANTS (Esquinas de Base) --- */}
        {/* 1. Green Base (Top-Left) */}
        <g filter="url(#shadow)">
          <rect x={0} y={0} width={300} height={300} fill="#059669" stroke="#047857" strokeWidth="2.5" />
          <rect x={40} y={40} width={220} height={220} rx={15} ry={15} fill="#047857" stroke="#065f46" strokeWidth="1.5" strokeDasharray="3" />
          {Array.from({ length: 4 }).map((_, i) => {
            const coord = getBaseSlotCoord('green', i);
            return (
              <circle key={`slot-green-${i}`} cx={coord.x} cy={coord.y} r={22} fill="rgba(255, 255, 255, 0.2)" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
            );
          })}
        </g>

        {/* 2. Blue Base (Top-Right) */}
        <g filter="url(#shadow)">
          <rect x={450} y={0} width={300} height={300} fill="#0284c7" stroke="#0369a1" strokeWidth="2.5" />
          <rect x={490} y={40} width={220} height={220} rx={15} ry={15} fill="#0369a1" stroke="#075985" strokeWidth="1.5" strokeDasharray="3" />
          {Array.from({ length: 4 }).map((_, i) => {
            const coord = getBaseSlotCoord('blue', i);
            return (
              <circle key={`slot-blue-${i}`} cx={coord.x} cy={coord.y} r={22} fill="rgba(255, 255, 255, 0.2)" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
            );
          })}
        </g>

        {/* 3. Yellow Base (Bottom-Right) */}
        <g filter="url(#shadow)">
          <rect x={450} y={450} width={300} height={300} fill="#ca8a04" stroke="#a16207" strokeWidth="2.5" />
          <rect x={490} y={490} width={220} height={220} rx={15} ry={15} fill="#a16207" stroke="#854d0e" strokeWidth="1.5" strokeDasharray="3" />
          {Array.from({ length: 4 }).map((_, i) => {
            const coord = getBaseSlotCoord('yellow', i);
            return (
              <circle key={`slot-yellow-${i}`} cx={coord.x} cy={coord.y} r={22} fill="rgba(255, 255, 255, 0.2)" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
            );
          })}
        </g>

        {/* 4. Red Base (Bottom-Left) */}
        <g filter="url(#shadow)">
          <rect x={0} y={450} width={300} height={300} fill="#ff0055" stroke="#e11d48" strokeWidth="2.5" />
          <rect x={40} y={490} width={220} height={220} rx={15} ry={15} fill="#e11d48" stroke="#be123c" strokeWidth="1.5" strokeDasharray="3" />
          {Array.from({ length: 4 }).map((_, i) => {
            const coord = getBaseSlotCoord('red', i);
            return (
              <circle key={`slot-red-${i}`} cx={coord.x} cy={coord.y} r={22} fill="rgba(255, 255, 255, 0.2)" stroke="#ffffff" strokeWidth="1.5" opacity="0.8" />
            );
          })}
        </g>


        {/* --- META CENTRAL (Dividida en 4 triángulos) --- */}
        {/* Center triangle goal. Left-Top-Right-Bottom points in (6..8, 6..8) logic squares */}
        <g stroke="#ffffff" strokeWidth="2">
          {/* Left triangle (Red Goal) */}
          <polygon points="300,300 375,375 300,450" fill="#ff0055" stroke="#ffffff" strokeWidth="2" />
          {/* Top triangle (Green Goal) */}
          <polygon points="300,300 375,375 450,300" fill="#059669" stroke="#ffffff" strokeWidth="2" />
          {/* Right triangle (Blue Goal) */}
          <polygon points="450,300 375,375 450,450" fill="#0284c7" stroke="#ffffff" strokeWidth="2" />
          {/* Bottom triangle (Yellow Goal) */}
          <polygon points="300,450 375,375 450,450" fill="#ca8a04" stroke="#ffffff" strokeWidth="2" />
        </g>
        {/* Decorative inner metal boundary for center goal */}
        <circle cx={375} cy={375} r={15} fill="#ffffff" stroke="#cbd5e1" strokeWidth="2" />
        <circle cx={375} cy={375} r={5} fill="#0284c7" />


        {/* --- TOKENS (Fichas) --- */}
        {tokens.map((token) => {
          const { x, y } = getTokenVisualCoord(token);
          const isSelectable = playableTokenIds.includes(token.playerId * 4 + token.id);
          const isHumanToken = token.playerId === humanPlayerId;

          // Define glow style for selectable tokens
          const pulseColor = COLOR_HEX[token.color];
          const isCurrentTurnToken = token.playerId === currentTurn;

          return (
            <g
              key={`token-${token.color}-${token.id}`}
              className={`${isSelectable ? 'cursor-pointer' : 'pointer-events-none'}`}
              style={{
                transform: `translate(${x}px, ${y}px)`,
                transition: 'transform 0.22s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              }}
              onClick={() => isSelectable && onTokenClick(token.playerId * 4 + token.id)}
            >
              {/* Selected pulsing circle effect underneath */}
              {isSelectable && (
                <circle
                  cx={0}
                  cy={0}
                  r={26}
                  fill={pulseColor}
                  opacity="0.4"
                  className="animate-ping"
                  style={{ animationDuration: '1.2s' }}
                />
              )}

              {appTheme === 'sugar' ? (
                <>
                  <path d="M -15 0 L -24 -10 L -24 10 Z" fill={COLOR_HEX[token.color]} opacity="0.9" />
                  <path d="M 15 0 L 24 -10 L 24 10 Z" fill={COLOR_HEX[token.color]} opacity="0.9" />
                  <circle cx={0} cy={0} r={16} fill={COLOR_HEX[token.color]} stroke="rgba(255,255,255,0.9)" strokeWidth="3" filter="drop-shadow(0px 3px 4px var(--shadow-color))" />
                  <circle cx={0} cy={0} r={8} fill="rgba(255,255,255,0.45)" />
                  <circle cx={-4} cy={-4} r={3} fill="rgba(255,255,255,0.8)" />
                </>
              ) : (
                <>
                  <circle cx={0} cy={0} r={16} fill={`url(#token-${token.color}-grad)`} stroke="var(--color-border)" strokeWidth="2" filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.4))" />
                  <circle cx={0} cy={0} r={10} fill="var(--bg-panel)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="1.5" />
                  <circle cx={0} cy={0} r={5} fill={`url(#token-${token.color}-grad)`} />
                  <circle cx={-5} cy={-5} r={2.5} fill="rgba(255, 255, 255, 0.8)" />
                </>
              )}

              {/* Number centered to differentiate same-color tokens */}
              <text
                x={0}
                y={0.5}
                fill="#FFFFFF"
                fontSize="11"
                fontWeight="bold"
                textAnchor="middle"
                dominantBaseline="middle"
                opacity="0.9"
              >
                {token.id + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};
