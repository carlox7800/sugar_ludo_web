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
  // Config state
  const [playerCount, setPlayerCount] = useState<2 | 3 | 4 | 5 | 6>(4);
  const [botDifficulty, setBotDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [showGuideModal, setShowGuideModal] = useState(false);

  // Trigger setup submit
  const handleStart = () => {
    let availableColors: PlayerColor[] = ['red', 'green', 'blue', 'yellow'];
    if (playerCount === 5 || playerCount === 6) {
      availableColors = ['purple', 'orange', 'blue', 'yellow', 'green', 'red'];
      if (playerCount === 5) {
        // Just as an example, drop one color for 5 players, or keep 5. We'll use the first 5 in initialization anyway.
        availableColors = availableColors.slice(0, 5);
      }
    }
    const validColors = availableColors;
    
    // Si la partida es de menos de 4 jugadores, podríamos limitar los colores disponibles
    // pero para simplicidad, cualquier color puede ser usado por el humano.
    const randomColor = validColors[Math.floor(Math.random() * validColors.length)];

    onStartGame({
      playerCount,
      humanColor: randomColor,
      botDifficulty,
    });
  };

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

  if (!isPlaying) {
    // START SCREEN / GAME CONFIGURATION
    return (
      <div className="w-full max-w-[550px] mx-auto bg-root rounded-3xl p-6 shadow-[0_0_50px_rgba(0,242,255,0.06)] border border-border flex flex-col gap-6 animate-fade-in select-none">
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-widest text-p-blue font-mono uppercase drop-shadow-[0_0_8px_rgba(0,242,255,0.3)]">
            Sugar Ludo
          </h1>
          <p className="text-[10px] text-t-muted mt-1.5 uppercase tracking-widest font-semibold font-mono">
            Edición Clásica Premium
          </p>
        </div>

        {/* 1. Player Count Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-t-muted">Selección de cantidad de jugadores</label>
          <div className="flex flex-wrap gap-2">
            {[2, 3, 4, 5, 6].map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setPlayerCount(count as any)}
                className={`py-2 px-3 rounded-xl border-2 font-bold text-sm transition-all duration-200 cursor-pointer flex-1 min-w-[30%] ${
                  playerCount === count
                    ? 'border-p-blue bg-[var(--color-p-blue)]/10 text-p-blue shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                    : 'border-border text-t-muted hover:bg-panel hover:text-t-primary'
                }`}
              >
                {count} Jug
              </button>
            ))}
          </div>
          <p className="text-[10px] text-t-muted">
            {playerCount === 2 && 'Partida de 2 jugadores (Tú contra 1 Bot).'}
            {playerCount === 3 && 'Partida de 3 jugadores (Tú contra 2 Bots).'}
            {playerCount === 4 && 'Partida clásica de 4 jugadores (Tú contra 3 Bots).'}
            {playerCount === 5 && 'Tablero Hexagonal de 5 jugadores (Tú contra 4 Bots).'}
            {playerCount === 6 && 'Tablero Hexagonal de 6 jugadores (Tú contra 5 Bots).'}
          </p>
        </div>

        {/* 3. Bot Difficulty Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-t-muted">Dificultad de los Bots</label>
          <div className="grid grid-cols-3 gap-2">
            {(['easy', 'medium', 'hard'] as const).map((diff) => {
              const labelMap = { easy: 'Fácil', medium: 'Medio', hard: 'Inteligente' };
              return (
                <button
                  key={diff}
                  type="button"
                  onClick={() => setBotDifficulty(diff)}
                  className={`py-2 px-3 rounded-xl border-2 font-bold text-xs transition-all cursor-pointer ${
                    botDifficulty === diff
                      ? 'border-[var(--color-p-green)] bg-[var(--color-p-green)]/10 text-p-green shadow-[0_0_15px_rgba(0,255,149,0.15)]'
                      : 'border-border text-t-muted hover:bg-panel hover:text-t-primary'
                  }`}
                >
                  {labelMap[diff]}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-t-muted">
            {botDifficulty === 'easy' && 'Fácil: Los bots mueven fichas casi al azar.'}
            {botDifficulty === 'medium' && 'Medio: Heurística balanceada con prioridad de avance.'}
            {botDifficulty === 'hard' && 'Inteligente: Capturan activamente, huyen del peligro y calculan cada paso.'}
          </p>
        </div>

        {/* 4. Start Game Button */}
        <button
          onClick={handleStart}
          className="w-full flex items-center justify-center gap-2 py-3.5 bg-[var(--color-p-blue)] text-[var(--bg-root)] rounded-2xl font-bold text-lg shadow-[0_0_20px_rgba(0,242,255,0.3)] hover:shadow-[0_0_25px_rgba(0,242,255,0.5)] hover:bg-[#33f5ff] active:scale-[0.98] transition-all cursor-pointer"
        >
          <Play size={20} fill="currentColor" />
          Comenzar Juego
        </button>

        {/* Small Rules Cheat Sheet */}
        <button
          onClick={() => setShowGuideModal(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-[var(--color-p-blue)]/5 text-[var(--color-p-blue)] rounded-xl font-bold text-sm border border-p-blue/20 hover:bg-[var(--color-p-blue)]/10 active:scale-[0.98] transition-all cursor-pointer"
        >
          <HelpCircle size={16} />
          Guía rápida
        </button>

        {/* Modal for Guide */}
        {showGuideModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-panel border border-border rounded-2xl w-full max-w-sm overflow-hidden flex flex-col shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-4 border-b border-border/50 bg-root/50">
                <div className="flex items-center gap-2 text-p-blue font-bold">
                  <HelpCircle size={18} />
                  <span>Guía Rápida</span>
                </div>
                <button 
                  onClick={() => setShowGuideModal(false)}
                  className="p-1.5 rounded-lg text-t-muted hover:text-t-primary hover:bg-border/50 transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>
              <div className="p-5 flex flex-col gap-3 text-sm text-t-muted leading-relaxed">
                <p>
                  Saca un <strong className="text-p-blue">6</strong> para liberar fichas de tu base.
                </p>
                <p>
                  Avanza por el tablero y entra a la meta de tu color.
                </p>
                <p>
                  ¡Cuidado! Caer en una casilla que no sea <strong className="text-p-blue">segura (estrella ✦)</strong> eliminará la ficha enemiga y te dará tiro extra.
                </p>
              </div>
              <div className="p-4 border-t border-border/50">
                <button 
                  onClick={() => setShowGuideModal(false)}
                  className="w-full py-2.5 bg-p-blue text-white font-bold rounded-xl shadow-lg hover:bg-[#33f5ff] active:scale-95 transition-all cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

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
    <div className="w-full max-w-[550px] mx-auto bg-root rounded-3xl p-5 shadow-[0_0_40px_rgba(0,242,255,0.05)] border border-border flex flex-col gap-4 select-none">
      
      {/* 1. Winner Celebration overlay */}
      {winnerPlayer && (
        <div className="bg-[var(--color-p-green)]/5 border border-[var(--color-p-green)]/20 rounded-2xl p-4 flex flex-col items-center text-center gap-2 animate-pulse">
          <Award size={40} className="text-p-green drop-shadow-[0_0_8px_var(--color-p-green)]" />
          <h2 className="text-xl font-bold text-p-green">¡Tenemos un Ganador!</h2>
          <p className="text-sm text-t-primary">
            El jugador <strong className={textColors[winnerPlayer.color]}>{winnerPlayer.name}</strong> ({turnTitles[winnerPlayer.color]}) ha ganado la partida!
          </p>
          <button
            onClick={onResetGame}
            className="mt-2 flex items-center gap-1.5 py-2 px-5 bg-[var(--color-p-green)] text-[var(--bg-root)] font-bold rounded-xl shadow-[0_0_15px_rgba(0,255,149,0.3)] hover:bg-[#33ffb5] cursor-pointer text-sm transition-all"
          >
            <RotateCcw size={15} />
            Jugar de Nuevo
          </button>
        </div>
      )}

      {/* 2. Live Game Information Header */}
      {!winnerPlayer && (
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-t-muted font-mono uppercase tracking-wider">Turno Actual</span>
            <div className="flex items-center gap-2">
              <div className={`w-3.5 h-3.5 rounded-full ${bgColors[currentTurnPlayer.color]} animate-pulse shadow-[0_0_8px_currentColor]`} />
              <span className={`text-base font-bold ${textColors[currentTurnPlayer.color]}`}>
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
              <div className="w-16 h-2 bg-panel rounded-full overflow-hidden border border-border">
                <div
                  className={`h-full transition-all duration-1000 ${timer <= 3 ? 'bg-p-red animate-pulse shadow-[0_0_8px_var(--color-p-red)]' : 'bg-[var(--color-p-blue)] shadow-[0_0_8px_var(--color-p-blue)]'}`}
                  style={{ width: `${(timer / 10) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Dice Container & Roll Buttons */}
      {!winnerPlayer && (
        <div className="flex items-center justify-center py-4 bg-[var(--bg-root)] rounded-2xl border border-border gap-8 relative overflow-hidden">
          {/* Subtle background glow for user action */}
          {isGlowActive && (
            <div className="absolute inset-0 bg-[var(--color-p-blue)]/5 animate-pulse pointer-events-none" />
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
                    className="py-2.5 px-5 bg-[var(--color-p-blue)] text-[var(--bg-root)] font-bold text-sm rounded-xl shadow-[0_0_15px_rgba(0,242,255,0.2)] hover:bg-[#33f5ff] hover:shadow-[0_0_20px_rgba(0,242,255,0.4)] active:scale-98 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Zap size={14} className="animate-bounce" />
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
          <span>Dificultad: <strong className="capitalize text-p-green">{botDifficulty === 'hard' ? 'Inteligente' : botDifficulty === 'medium' ? 'Media' : 'Fácil'}</strong></span>
        </div>
        <button
          onClick={onResetGame}
          className="flex items-center gap-1 text-t-muted hover:text-p-red transition-colors cursor-pointer"
        >
          <RotateCcw size={13} />
          <span>Reiniciar Partida</span>
        </button>
      </div>
    </div>
  );
};
