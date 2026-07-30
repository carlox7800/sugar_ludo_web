import React, { useState, useEffect } from 'react';
import { Player, PlayerColor, GameConfig } from '../types';
import { Play, RotateCcw, Volume2, ShieldCheck, Award, Zap, HelpCircle } from 'lucide-react';
import { COLOR_HEX } from './GameBoard';

import { AppTheme } from '../types';
interface GameControlsProps {
  appTheme?: AppTheme;
  setAppTheme?: (theme: AppTheme) => void;
  isPlaying: boolean;
  onStartGame: (config: GameConfig) => void;
  onRollDice: () => void;
  diceValues: [number, number] | null;
  remainingMoves: number[];
  isRolling: boolean;
  currentTurnPlayer: Player;
  hasRolled: boolean;
  timer: number;
  winnerPlayer: Player | null;
  onResetGame: () => void;
  isHumanTurnToRoll: boolean;
  isGlowActive: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  isPlaying,
  onStartGame,
  onRollDice,
  diceValues,
  remainingMoves,
  isRolling,
  currentTurnPlayer,
  hasRolled,
  timer,
  winnerPlayer,
  onResetGame,
  isHumanTurnToRoll,
  isGlowActive,
  appTheme,
  setAppTheme,
}) => {


  // Render dice dots based on rolled value
  const renderDiceDots = (value: number, color: PlayerColor) => {
    const isDarkDots = color === 'yellow';
    const dotColor = isDarkDots ? 'bg-gray-800' : 'bg-white';

    const dotPositions: Record<number, string[]> = {
      1: ['col-start-2 row-start-2'],
      2: ['col-start-1 row-start-1', 'col-start-3 row-start-3'],
      3: ['col-start-1 row-start-1', 'col-start-2 row-start-2', 'col-start-3 row-start-3'],
      4: [
        'col-start-1 row-start-1',
        'col-start-3 row-start-1',
        'col-start-1 row-start-3',
        'col-start-3 row-start-3',
      ],
      5: [
        'col-start-1 row-start-1',
        'col-start-3 row-start-1',
        'col-start-2 row-start-2',
        'col-start-1 row-start-3',
        'col-start-3 row-start-3',
      ],
      6: [
        'col-start-1 row-start-1',
        'col-start-3 row-start-1',
        'col-start-1 row-start-2',
        'col-start-3 row-start-2',
        'col-start-1 row-start-3',
        'col-start-3 row-start-3',
      ],
    };

    const activeDots = dotPositions[value] || [];

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-1.5 w-12 h-12 p-2">
        {activeDots.map((pos, idx) => (
          <div key={idx} className={`w-2.5 h-2.5 rounded-full ${dotColor} ${pos} shadow-inner`} />
        ))}
      </div>
    );
  };



  // ACTIVE IN-GAME CONTROLLER PANEL
  const turnTitles: Record<PlayerColor, string> = {
    red: 'Rojo',
    green: 'Verde',
    blue: 'Azul',
    yellow: 'Amarillo',
    purple: 'Morado',
    orange: 'Naranja',
  };

  const textColors: Record<PlayerColor, string> = {
    red: 'text-p-red',
    green: 'text-p-green',
    blue: 'text-p-blue',
    yellow: 'text-p-yellow',
    purple: 'text-purple-500',
    orange: 'text-orange-500',
  };

  const bgColors: Record<PlayerColor, string> = {
    red: 'bg-p-red',
    green: 'bg-[var(--color-p-green)]',
    blue: 'bg-[var(--color-p-blue)]',
    yellow: 'bg-[var(--color-p-yellow)]',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="w-full max-w-[550px] mx-auto rounded-3xl p-5 shadow-[0_0_40px_rgba(0,242,255,0.05)] border flex flex-col gap-4 select-none cyber-game-panel bg-[var(--panel-bg,oklch(0.12_0.02_285/0.85))] backdrop-blur-xl border-[var(--panel-border,oklch(0.7_0.27_350/0.15))]">
      

      {/* 2. Live Game Information Header */}
      {!winnerPlayer && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-t-muted font-mono uppercase tracking-wider">Turno Actual</span>
            <div className="flex items-center gap-2">
              <div className={`w-3.5 h-3.5 rounded-full ${bgColors[currentTurnPlayer.color]} animate-pulse shadow-[0_0_8px_currentColor]`} />
              <span className={`text-base font-bold ${textColors[currentTurnPlayer.color]} drop-shadow-[0_0_6px_currentColor]`}>
                {currentTurnPlayer.name} ({turnTitles[currentTurnPlayer.color]})
              </span>
              <span className="text-[10px] px-2 py-0.5 bg-panel text-t-muted rounded border border-border font-semibold uppercase font-mono">
                {currentTurnPlayer.type === 'human' ? 'Tú' : 'Bot'}
              </span>
            </div>
          </div>

          {/* Turn timer clock */}
          <div className="flex flex-col items-end gap-1">
            <span className="text-[10px] text-t-muted font-mono uppercase tracking-wider">Tiempo de Turno</span>
            <div className="flex items-center gap-1.5">
              <span className={`text-sm font-bold font-mono ${timer <= 3 ? 'text-p-red animate-pulse' : 'text-t-primary'}`}>
                {timer}s
              </span>
              {/* Circular or horizontal timer track bar */}
              <div className="w-16 h-2 bg-panel rounded-full overflow-hidden border border-[var(--panel-border,oklch(0.7_0.27_350/0.15))]">
                <div
                  className={`h-full transition-all duration-1000 shadow-[0_0_8px_currentColor] ${timer <= 3 ? 'bg-[var(--candy-magenta,oklch(0.7_0.27_350))] animate-pulse' : 'bg-[var(--candy-cyan,oklch(0.82_0.15_200))]'}`}
                  style={{ width: `${(timer / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Dice Container & Roll Buttons */}
      {!winnerPlayer && (
        <div className="flex items-center justify-center py-4 bg-[oklch(0.08_0.02_285)] rounded-2xl border border-[var(--panel-border,oklch(0.7_0.27_350/0.12))] gap-8 relative overflow-hidden">
          {/* Subtle background glow for user action */}
          {isGlowActive && (
            <div className="absolute inset-0 bg-[var(--candy-cyan,oklch(0.82_0.15_200))]/5 animate-pulse pointer-events-none" />
          )}

          <div className="flex flex-col items-center gap-1">
            <span className="text-[10px] font-bold text-t-muted tracking-wider uppercase font-mono">Dado</span>
            
            <div className="flex gap-3">
              {[0, 1].map((dieIdx) => {
                const hasBeenUsed = diceValues !== null && !remainingMoves.includes(diceValues[dieIdx]);
                // Wait, if roll was [5, 5] and remaining is [5], we need to know which one was used.
                // It's safer to count occurrences.
                let isUsed = false;
                if (diceValues) {
                   const rolledCount = diceValues.filter((v, i) => v === diceValues[dieIdx] && i <= dieIdx).length;
                   const remainingCount = remainingMoves.filter(v => v === diceValues[dieIdx]).length;
                   // If rolledCount > remainingCount, this specific instance is used.
                   // Example: roll [5, 5]. dieIdx 0 -> rolledCount 1. remaining [5] -> remainingCount 1. 1 > 1 false.
                   // dieIdx 1 -> rolledCount 2. remaining [5] -> remainingCount 1. 2 > 1 true. -> used!
                   isUsed = rolledCount > remainingCount;
                }
                
                return (
                <div
                  key={dieIdx}
                  onClick={() => isHumanTurnToRoll && !isRolling && !hasRolled && onRollDice()}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 relative ${isUsed ? 'opacity-30 grayscale scale-90' : ''} ${
                    isHumanTurnToRoll && !isRolling && !hasRolled
                      ? 'cursor-pointer hover:scale-105 active:scale-95 shadow-[0_0_15px_rgba(0,242,255,0.15)] border border-border'
                      : 'shadow-md border border-border'
                  } ${isRolling ? 'animate-spin' : ''} ${bgColors[currentTurnPlayer.color]} ${
                    isGlowActive ? 'ring-4 ring-[var(--color-p-blue)] ring-offset-2 ring-offset-[var(--bg-root)]' : ''
                  }`}
                >
                  { diceValues !== null ? (
                    renderDiceDots(diceValues[dieIdx], currentTurnPlayer.color)
                  ) : (
                    <span className="text-t-primary/60 font-bold text-xl font-mono">?</span>
                  )}
                </div>
              );
            })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5 max-w-[200px]">
            {isHumanTurnToRoll ? (
              <>
                {!hasRolled && !isRolling ? (
                  <button
                    onClick={onRollDice}
                    className="flex items-center justify-center gap-2 py-2.5 px-5 bg-[linear-gradient(145deg,oklch(0.78_0.2_150),color-mix(in_oklch,oklch(0.78_0.2_150),black_12%))] text-[oklch(0.18_0.03_285)] font-extrabold text-sm rounded-2xl shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_5px_0_oklch(0.5_0.14_155),0_10px_20px_color-mix(in_oklch,oklch(0.5_0.14_155),transparent_55%)] hover:brightness-110 active:scale-95 transition-all cursor-pointer font-mono uppercase tracking-wider"
                  >
                    <Zap size={14} className="animate-bounce fill-current" />
                    Lanzar Dado
                  </button>
                ) : (
                  <span className="text-xs text-p-blue font-semibold italic">
                    {hasRolled ? 'Selecciona ficha de tablero' : 'Girando...'}
                  </span>
                )}
                {!hasRolled && !isRolling && (
                  <p className="text-[10px] text-t-muted leading-tight">
                    *Toca el dado o el botón para tirar.
                  </p>
                )}
              </>
            ) : (
              <div className="flex flex-col gap-1 text-left">
                <span className="text-xs font-bold text-t-primary font-mono">Pensando...</span>
                <p className="text-[11px] text-t-muted leading-tight">
                  {currentTurnPlayer.name} está decidiendo su jugada.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. Bottom Utilities (Settings Reset) */}
      <div className="flex items-center justify-between text-xs text-t-muted font-medium border-t border-border/35 pt-3">
        <div className="flex items-center gap-1 text-t-muted">
          <ShieldCheck size={14} className="text-p-green" />
          <span>Partida en curso</span>
        </div>
        <button
          onClick={onResetGame}
          className="flex items-center gap-1 text-t-muted hover:text-[var(--candy-magenta,oklch(0.7_0.27_350))] transition-colors cursor-pointer"
        >
          <RotateCcw size={13} />
          <span>Reiniciar Partida</span>
        </button>
      </div>
    </div>
  );
};
