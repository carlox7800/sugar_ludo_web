import React, { useState, useEffect, useRef } from 'react';
import {
  HexPlayerColor,
  HexPlayer,
  HexToken,
  HEX_COLOR_INFO,
  STAR_CELLS,
  HEX_COLORS_ORDER,
  TOKENS_PER_PLAYER,
} from '../HexBoardConstants';
import {
  createInitialHexState,
  getCellIndexForToken,
  hasBarrierAtHex,
  HexGameState,
  HexLog,
  calculateHexMoveBonus,
  processHexThreeDoublesPenalty,
  checkHexStartCellExpulsion,
  HEX_BONUS_CAPTURE,
  HEX_BONUS_GOAL,
  MAX_CONSECUTIVE_DOUBLES,
} from '../HexGameEngine';
import { HexagonalLudoBoardView } from './HexagonalLudoBoardView';
import { PlayerCorner } from './PlayerCorner';
import { GameControls } from './GameControls';
import { ConsoleLogs } from './ConsoleLogs';
import { globalLogger } from '@/lib/logger';
import { audio } from '../audio';
import { Sparkles, Trophy, ArrowLeft, RotateCcw, Volume2, VolumeX, Zap, ShieldCheck, Award } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { recordMatchResult } from '@/lib/stats-service';
import confetti from 'canvas-confetti';

interface HexGameViewProps {
  playerCount: 5 | 6;
  humanColor: HexPlayerColor;
  botDifficulty: 'easy' | 'medium' | 'hard';
  onExit: () => void;
  isMuted: boolean;
  appTheme: 'classic' | 'sugar';
}

export const HexGameView: React.FC<HexGameViewProps> = ({
  playerCount,
  humanColor,
  botDifficulty,
  onExit,
  isMuted,
  appTheme,
}) => {
  const { user } = useAuth();
  const [gameState, setGameState] = useState<HexGameState>(() =>
    createInitialHexState(playerCount, humanColor, botDifficulty)
  );

  useEffect(() => {
    // mounted
  }, []);

  const [timer, setTimer] = useState<number>(10);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Confetti effect when game ends
  useEffect(() => {
    if (gameState.winner) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        zIndex: 9999
      });
    }
  }, [gameState.winner]);

  // 2-Dice Specific State
  const [diceValues, setDiceValues] = useState<[number, number] | null>(null);
    const [remainingMoves, setRemainingMoves] = useState<number[]>([]);
  const [moveSelectorTokenId, setMoveSelectorTokenId] = useState<number | null>(null);
  const [isGlowActive, setIsGlowActive] = useState<boolean>(false);
  const [extraTurnsCount, setExtraTurnsCount] = useState<number>(0);
  const [barrierLifetimes, setBarrierLifetimes] = useState<Record<string, number>>({});
  const pendingExtraTurnsRef = useRef<number>(0);
  const botTimeoutRef = useRef<number | null>(null);
  const [isHumanAutoplay, setIsHumanAutoplay] = useState<boolean>(false);
  const consecutiveDoublesCountRef = useRef<number>(0);
  const lastMovedTokenRef = useRef<{ playerId: number; tokenId: number } | null>(null);
  const vibrationIntervalRef = useRef<number | null>(null);
  const winnerRef = useRef<HexPlayer | null>(null);
  const isAnimatingMoveRef = useRef<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [explosionData, setExplosionData] = useState<{ cellIndex: number | string; color: HexPlayerColor } | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const activePlayer = gameState.players[gameState.currentTurnIndex];
  const currentTurn = activePlayer?.id;

  const getPlayableTokenIdsHex = (pId: number, moves: number[], currentTokens = gameState.tokens): number[] => {
    if (moves.length === 0) return [];
    
    const hasFive = moves.includes(5);
    const hasSumFive = moves.length === 2 && moves[0] + moves[1] === 5;
    
    const playerTokens = currentTokens.filter((t) => t.playerId === pId);
    const playableIds: number[] = [];

    
    const forcedTokens = playerTokens.filter(t => {
      const globalId = `${t.playerId}-${t.id}`;
      if ((barrierLifetimes[globalId] || 0) >= 2) { 
         const tkIdx = getCellIndexForToken(t.color, t.step);
         if (typeof tkIdx === 'number') {
           let totalCount = 0;
           currentTokens.forEach(tk => {
             const tkIdx2 = getCellIndexForToken(tk.color, tk.step);
             if (tkIdx2 === tkIdx) totalCount++;
           });
           return totalCount >= 2;
         }
      }
      return false;
    }).map(t => `${t.playerId}-${t.id}`);

    playerTokens.forEach((t) => {
      if (t.step === 0) {
        if (hasFive || hasSumFive) {
          const startIdx = getCellIndexForToken(t.color, 1);
          if (typeof startIdx === 'number') {
            let myCount = 0;
            let enemyCount = 0;
            currentTokens.forEach(tk => {
               const tkIdx = getCellIndexForToken(tk.color, tk.step);
               if (typeof tkIdx === 'number' && tkIdx === startIdx) {
                  if (tk.color === t.color) myCount++;
                  else enemyCount++;
               }
            });
            const isExpellable = (myCount === 1 && enemyCount === 1);
            const isBlocked = (myCount + enemyCount >= 2) && !isExpellable;

            if (!isBlocked) {
              playableIds.push(t.id);
            }
          }
        }
      } else if (t.step > 0 && t.step < 83) {
        let canMove = false;
        
        for (const m of moves) {
          if (t.step + m <= 83) {
            let blocked = false;
            for(let stepOffset = 1; stepOffset <= m; stepOffset++) {
               const pathStep = t.step + stepOffset;
               const pIndex = getCellIndexForToken(t.color, pathStep);
               if (typeof pIndex === 'number' && hasBarrierAtHex(pIndex, currentTokens)) { 
                 blocked = true; 
                 break; 
               }
            }
            if (!blocked) {
               canMove = true; 
               break;
            }
          }
        }

        if (!canMove && moves.length === 2) {
          const sum = moves[0] + moves[1];
          if (t.step + sum <= 83) {
             let blocked = false;
             for(let stepOffset = 1; stepOffset <= sum; stepOffset++) {
               const pathStep = t.step + stepOffset;
               const pIndex = getCellIndexForToken(t.color, pathStep);
               if (typeof pIndex === 'number' && hasBarrierAtHex(pIndex, currentTokens)) { 
                 blocked = true; 
                 break; 
               }
             }
             if (!blocked) canMove = true;
          }
        }
        
        if (canMove) {
          playableIds.push(t.id);
        }
      }
    });

    if (forcedTokens.length > 0) { 
       const playableForced = playableIds.filter(id => forcedTokens.includes(`${pId}-${id}`));
       if (playableForced.length > 0) {
          return playableForced;
       }
       return [];
    }

    return playableIds;
  };

  const playableTokenIds = getPlayableTokenIdsHex(
    activePlayer?.id ?? 0,
    remainingMoves
  );

  const isHumanTurnToRoll =
    activePlayer?.type === 'human' &&
    !gameState.hasRolled &&
    !gameState.isRolling &&
    !gameState.isAnimating &&
    !gameState.winner;

  // Add Log Helper
  const addLog = (message: string, type: HexLog['type'], color?: HexPlayerColor) => {
    const globalTypeMap: Record<string, any> = {
      'system': 'GAME-FLOW', 'move': 'TOKENS', 'roll': 'GAME-FLOW', 'capture': 'TOKENS', 'win': 'GAME-FLOW', 'info': 'GAME-FLOW', 'warning': 'GAME-FLOW'
    };
    globalLogger.log(globalTypeMap[type] || 'GAME-FLOW', message, { playerColor: color });

    const newLog: HexLog = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type,
      color,
    };
    setGameState((prev) => ({
      ...prev,
      logs: [...prev.logs, newLog].slice(-50),
    }));
  };

  // Ambient BGM Sync Effect
  useEffect(() => {
    if (!isMuted) {
      audio.playBackgroundMusic(true);
    } else {
      audio.playBackgroundMusic(false);
    }
  }, [isMuted]);

  const triggerTurnStart = () => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
    setIsHumanAutoplay(false);
  };

  // Turn Timer Effect
  useEffect(() => {
    let interval: number | null = null;
    const shouldRunTimer = !gameState.winner && !gameState.isRolling && !gameState.isAnimating && !isHumanAutoplay && (!gameState.hasRolled || (gameState.hasRolled && playableTokenIds.length > 0));
    
    if (shouldRunTimer) {
      interval = window.setInterval(() => {
        setTimer((prev) => prev <= 1 ? 0 : prev - 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [gameState.currentTurnIndex, gameState.hasRolled, gameState.winner, gameState.isRolling, gameState.isAnimating, extraTurnsCount, playableTokenIds.length, isHumanAutoplay]);

  useEffect(() => {
    if (timer === 0 && !gameState.winner) {
      setIsHumanAutoplay(true);
      setTimer(10);
    }
  }, [timer, gameState.winner]);

  // Next Turn
  const moveToken = (tokenId: number, moveVal: number, moveIndices: number[]) => {
    if (gameState.isAnimating || gameState.winner || winnerRef.current !== null || isAnimatingMoveRef.current) return;

    isAnimatingMoveRef.current = true;
    setGameState((prev) => ({ ...prev, isAnimating: true }));
    setTimer(10); // TRASPLANTE 4J: Reinicio síncrono del timer
    
    const token = gameState.tokens.find(
      (t) => t.playerId === activePlayer.id && t.id === tokenId
    );

    if (!token) {
      isAnimatingMoveRef.current = false;
      setGameState((prev) => ({ ...prev, isAnimating: false }));
      return;
    }

    const oldStep = token.step;
    let newStep = oldStep + moveVal;

    if (oldStep === 0) {
      newStep = 1;
    }

    // Step-by-step animation logic
    const stepsToTake = newStep - oldStep;
    let currentStepAnim = oldStep;

    const animateNextStep = () => {
      if (winnerRef.current !== null) {
        isAnimatingMoveRef.current = false;
        setGameState(prev => ({ ...prev, isAnimating: false }));
        return;
      }
      currentStepAnim++;
      
      if (!isMuted) audio.playStep();

      setGameState((prev) => {
        const newTokens = prev.tokens.map((t) => {
          if (t.playerId === activePlayer.id && t.id === tokenId) {
            return { ...t, step: currentStepAnim };
          }
          return t;
        });
        return { ...prev, tokens: newTokens };
      });

      if (currentStepAnim < newStep) {
        setTimeout(animateNextStep, 250); // 250ms per step (allows 220ms CSS transition to finish)
      } else {
        // Finished moving, do captures and rules
        setTimeout(() => {
          finalizeMove(newStep);
        }, 250);
      }
    };

    const finalizeMove = (finalStep: number) => {
      let bonusSteps = 0;
      let capturedAny = false;
      let isExpulsion = false;
      let capturedTokensIds: { playerId: number, id: number }[] = [];

      const targetCellIndex = getCellIndexForToken(token.color, finalStep);

      // Check captures
      if (typeof targetCellIndex === 'number') {
        if (finalStep === 1) {
          const cellTokens = gameState.tokens.filter(t => t.step > 0 && t.step <= 76 && getCellIndexForToken(t.color, t.step) === targetCellIndex);
          const myTokens = cellTokens.filter(t => t.color === token.color);
          const enemyTokens = cellTokens.filter(t => t.color !== token.color);
          
          if (myTokens.length === 1 && enemyTokens.length === 1) {
            capturedTokensIds.push({ playerId: enemyTokens[0].playerId, id: enemyTokens[0].id });
            isExpulsion = true;
            setExplosionData({ cellIndex: targetCellIndex, color: enemyTokens[0].color });
            setTimeout(() => setExplosionData(null), 3500);
            if (!isMuted) audio.playFireworks();
            showToast(`💥 ¡Expulsión de salida! Ficha enemiga enviada a casa (+0 bonus)`);
          }
        } else if (!STAR_CELLS.includes(targetCellIndex)) {
          const enemyTokens = gameState.tokens.filter(t => t.playerId !== activePlayer.id && t.step > 0 && t.step <= 76 && getCellIndexForToken(t.color, t.step) === targetCellIndex);
          if (enemyTokens.length === 1) {
            capturedTokensIds.push({ playerId: enemyTokens[0].playerId, id: enemyTokens[0].id });
            capturedAny = true;
            setExplosionData({ cellIndex: targetCellIndex, color: enemyTokens[0].color });
            setTimeout(() => setExplosionData(null), 3500);
            if (!isMuted) audio.playFireworks();
            showToast(`⚔️ ¡Ficha capturada! +25 pasos de bono`);
          }
        }
      }

      const playerGoalTokens = gameState.tokens.filter(
        (t) => t.playerId === activePlayer.id && t.step === 83 && t.id !== tokenId
      );
      const hasWon = playerGoalTokens.length + (finalStep === 83 ? 1 : 0) === TOKENS_PER_PLAYER;

      if (finalStep === 83 && !hasWon) {
        bonusSteps += 15;
        if (!isMuted) audio.playGoal();
        showToast('🎉 ¡Ficha en la meta! +15 pasos de bono');
      }

      if (capturedAny) {
        bonusSteps += 25;
      }

      const moveLogMessage = capturedAny
        ? `¡${activePlayer.name} CAPTURÓ una ficha enemiga en la casilla ${targetCellIndex}!`
        : isExpulsion
        ? `¡${activePlayer.name} EXPULSÓ una ficha enemiga de la salida!`
        : `${activePlayer.name} movió su ficha ${tokenId + 1} a ${
            finalStep === 83 ? '¡LA META!' : `paso ${finalStep}`
          }.`;
          
      globalLogger.log('TOKENS', moveLogMessage, { playerColor: activePlayer.color });

      if (bonusSteps > 0) {
        globalLogger.log('GAME-FLOW', `🎁 ¡Bono de +${bonusSteps} pasos para ${activePlayer.name}!`, { playerColor: activePlayer.color });
      }

      if (hasWon && !gameState.players[activePlayer.id].hasFinished) {
        if (!isMuted) audio.playVictory();
        showToast(`🏁 ¡${activePlayer.name} ha llegado a la meta!`);
      }

      // Sincronizar dados
      const nextMoves = [...remainingMoves];
      [...moveIndices].sort((a, b) => b - a).forEach(idx => nextMoves.splice(idx, 1));
      
      if (bonusSteps > 0) {
        nextMoves.push(bonusSteps);
      }
      setRemainingMoves(nextMoves);

      const newTokens = gameState.tokens.map(t => {
        if (t.playerId === activePlayer.id && t.id === tokenId) {
          return { ...t, step: finalStep };
        }
        if (capturedTokensIds.some(c => c.playerId === t.playerId && c.id === t.id)) {
          return { ...t, step: 0 };
        }
        return t;
      });

      if (nextMoves.length === 0) {
        if (pendingExtraTurnsRef.current > 0) {
          pendingExtraTurnsRef.current -= 1;
          advanceTurn(true, newTokens);
        } else {
          advanceTurn(false, newTokens);
        }
      } else {
        const playables = getPlayableTokenIdsHex(activePlayer.id, nextMoves, newTokens);
        if (playables.length === 0) {
          if (pendingExtraTurnsRef.current > 0) {
            pendingExtraTurnsRef.current -= 1;
            advanceTurn(true, newTokens);
          } else {
            advanceTurn(false, newTokens);
          }
        }
      }

      setGameState((prev) => {
        let newPlayers = [...prev.players];
        let newWinner = prev.winner;
        let updatedLogs = [...prev.logs];

        updatedLogs.push({
          id: Math.random().toString(),
          message: moveLogMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: capturedAny ? 'capture' : 'move',
          color: activePlayer.color,
        });

        if (bonusSteps > 0) {
          updatedLogs.push({
            id: Math.random().toString(),
            message: `🎁 ¡Bono de +${bonusSteps} pasos para ${activePlayer.name}!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'system',
            color: activePlayer.color,
          });
        }
        
        if (hasWon && !prev.players[activePlayer.id].hasFinished) {
          const finishedPlayers = prev.players.filter(p => p.hasFinished).length;
          const newRank = finishedPlayers + 1;
          
          newPlayers = newPlayers.map(p => 
            p.id === activePlayer.id ? { ...p, hasFinished: true, rank: newRank } : p
          );
          
          updatedLogs.push({
            id: Math.random().toString(),
            message: `🎉 ¡${activePlayer.name} ha finalizado en la posición #${newRank}!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'system',
            color: activePlayer.color,
          });
          globalLogger.log('GAME-FLOW', `🎉 ¡${activePlayer.name} ha finalizado en la posición #${newRank}!`, { playerColor: activePlayer.color });


          const activeCount = prev.players.filter(p => p.isActive).length;
          let requiredFinishers = 1;
          if (activeCount === 6 || activeCount === 4) requiredFinishers = 3;
          if (activeCount === 3) requiredFinishers = 2;
          if (activeCount === 2) requiredFinishers = 1;

          if (newRank >= requiredFinishers || newRank >= activeCount - 1) {
            let lastPlayer = newPlayers.find(p => p.isActive && !p.hasFinished);
            if (lastPlayer && newRank >= activeCount - 1) {
               newPlayers = newPlayers.map(p => 
                 p.id === lastPlayer!.id ? { ...p, hasFinished: true, rank: activeCount } : p
               );
            }
            newWinner = newPlayers.find(p => p.rank === 1) || activePlayer;
            winnerRef.current = newWinner;
            updatedLogs.push({
              id: Math.random().toString(),
              message: `🏁 ¡La partida ha terminado!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'system',
            });
            globalLogger.log('GAME-FLOW', `🏁 ¡La partida ha terminado!`);
          }
        }

        isAnimatingMoveRef.current = false;

        return {
          ...prev,
          tokens: newTokens,
          players: newPlayers,
          isAnimating: false,
          winner: newWinner !== null ? newWinner : prev.winner,
          logs: updatedLogs,
        };
      });
    };

    // Start animation if it's a board move, otherwise direct jump for base exit
    if (oldStep === 0) {
      // Exiting base is a single jump to cell 1
      if (!isMuted) audio.playStep();
      setGameState((prev) => {
        const newTokens = prev.tokens.map((t) => {
          if (t.playerId === activePlayer.id && t.id === tokenId) {
            return { ...t, step: 1 };
          }
          return t;
        });
        return { ...prev, tokens: newTokens };
      });
      // If moveVal was a combo (e.g. 5 + 3 = 4 steps total), animate the remaining 3 steps
      if (newStep > 1) {
        currentStepAnim = 1;
        setTimeout(animateNextStep, 250);
      } else {
        setTimeout(() => finalizeMove(newStep), 250);
      }
    } else {
      animateNextStep();
    }
  };

  const advanceTurn = (extraTurn: boolean, currentTokens = gameState.tokens) => {
    triggerTurnStart();
    const activePlayer = gameState.players[gameState.currentTurnIndex];
    globalLogger.log('SYSTEM', `[TURNO] Estado: ${extraTurn ? 'Turno Extra' : 'Cambio de Turno'} | Jugador: ${activePlayer.color}`);

    setDiceValues(null);
    setRemainingMoves([]);
    setMoveSelectorTokenId(null);
    setTimer(10);
    
    if (gameState.winner !== null || winnerRef.current !== null) return;

    if (!extraTurn) {
      consecutiveDoublesCountRef.current = 0;
      setBarrierLifetimes(prev => {
        const nextLifetimes = { ...prev };
        const cellCounts: Record<number, number> = {};
        currentTokens.forEach(tk => {
          const tkIdx = getCellIndexForToken(tk.color, tk.step);
          if (typeof tkIdx === 'number') {
            cellCounts[tkIdx] = (cellCounts[tkIdx] || 0) + 1;
          }
        });
        currentTokens.forEach(tk => {
          const globalId = `${tk.playerId}-${tk.id}`;
          const tkIdx = getCellIndexForToken(tk.color, tk.step);
          if (typeof tkIdx === 'number' && cellCounts[tkIdx] >= 2) {
            nextLifetimes[globalId] = prev[globalId] || 0;
            if (tk.playerId === gameState.players[gameState.currentTurnIndex].id) {
               nextLifetimes[globalId] += 1;
            }
          } else {
            nextLifetimes[globalId] = 0;
          }
        });
        return nextLifetimes;
      });
    }

    setGameState((prev) => {
      let nextIdx = prev.currentTurnIndex;

      if (!extraTurn || prev.players[nextIdx].hasFinished) {
        do {
          nextIdx = (nextIdx + 1) % prev.players.length;
        } while (prev.players[nextIdx].hasFinished && nextIdx !== prev.currentTurnIndex);
      }

      const nextPlayer = prev.players[nextIdx];

      if (extraTurn) {
        globalLogger.log('SYSTEM', `¡${activePlayer.name} obtiene tiro adicional!`, { playerColor: activePlayer.color });
      } else {
        globalLogger.log('SYSTEM', `Es el turno de ${nextPlayer.name}.`, { playerColor: nextPlayer.color });
      }

      return {
        ...prev,
        currentTurnIndex: nextIdx,
        diceValue: null,
        hasRolled: false,
      };
    });
  };

  // Roll Dice (2 dice mechanism)
  const handleRollDice = () => {
    if (gameState.isRolling || gameState.hasRolled || gameState.isAnimating || gameState.winner || winnerRef.current !== null) return;

    audio.stopTurnAlertLoop();
    setGameState((prev) => ({ ...prev, isRolling: true }));
    if (!isMuted) audio.playDiceRoll();
    setIsGlowActive(false);

    setTimeout(() => {
      const r1 = Math.floor(Math.random() * 6) + 1;
      const r2 = Math.floor(Math.random() * 6) + 1;
      const rolls = [r1, r2];
      const isDouble = r1 === r2;

      setDiceValues(rolls);
      setRemainingMoves([...rolls]);

      const sum = r1 + r2;
      let rollLogMessage = `${activePlayer.name} sacó ${r1} y ${r2} (Total: ${sum})`;
      let typeStr = 'roll';
      let thirdDouble = false;
      
      if (isDouble) {
        consecutiveDoublesCountRef.current += 1;
        
        if (consecutiveDoublesCountRef.current >= 3) {
          consecutiveDoublesCountRef.current = 0;
          pendingExtraTurnsRef.current = 0;
          thirdDouble = true;
          
          globalLogger.log('GAME-FLOW', `🚨 ¡Tercer doble consecutivo! Tu última ficha regresa a la base.`, { playerColor: activePlayer.color });
          showToast('🚨 ¡Tercer doble! Ficha a la base.');
        } else {
          pendingExtraTurnsRef.current += 1;
          rollLogMessage = `🎲 ¡${activePlayer.name} sacó doble (${r1},${r2}) y gana tiro extra!`;
          typeStr = 'info';
          showToast('🎲 ¡Doble! Tiras de nuevo');
        }
      } else {
        consecutiveDoublesCountRef.current = 0;
      }
      
      if (!thirdDouble) {
        globalLogger.log('GAME-FLOW', rollLogMessage, { playerColor: activePlayer.color });
      }

      setGameState((prev) => {
        if (thirdDouble) {
          let newTokens = [...prev.tokens];
          if (lastMovedTokenRef.current && lastMovedTokenRef.current.playerId === activePlayer.id) {
            const lastId = lastMovedTokenRef.current.tokenId;
            const lastToken = prev.tokens.find(t => t.playerId === activePlayer.id && t.id === lastId);

            if (lastToken && lastToken.step > 0 && lastToken.step < 83) {
              const targetCellIndex = getCellIndexForToken(lastToken.color, lastToken.step);
              if (typeof targetCellIndex === 'number' || typeof targetCellIndex === 'string') {
                setExplosionData({ cellIndex: targetCellIndex, color: activePlayer.color });
                setTimeout(() => setExplosionData(null), 3500);
                if (!isMuted) audio.playFireworks();
              }
            }

            newTokens = newTokens.map(t => {
              if (t.playerId === activePlayer.id && t.id === lastId && t.step > 0 && t.step < 83) {
                return { ...t, step: 0 };
              }
              return t;
            });
          }
          
          const warningLog = {
            id: Math.random().toString(),
            message: `🚨 ¡Tercer doble consecutivo! Tu última ficha regresa a la base.`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'warning' as const,
            color: activePlayer.color,
          };
          
          setRemainingMoves([]);
          setTimeout(() => advanceTurn(false), 1500);
          
          return {
            ...prev,
            diceValue: sum,
            tokens: newTokens,
            isRolling: false,
            hasRolled: true,
            logs: [...prev.logs, warningLog],
          };
        }

        const newLog = {
          id: Math.random().toString(),
          message: rollLogMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: typeStr as any,
          color: activePlayer.color,
        };

        return {
          ...prev,
          diceValue: sum,
          isRolling: false,
          hasRolled: true,
          logs: [...prev.logs, newLog],
        };
      });

      if (!thirdDouble) {
        const playables = getPlayableTokenIdsHex(activePlayer.id, rolls);
        if (playables.length === 0) {
          addLog(`${activePlayer.name} no tiene movimientos válidos.`, 'info', activePlayer.color);
          setTimeout(() => {
            if (pendingExtraTurnsRef.current > 0) {
              pendingExtraTurnsRef.current -= 1;
              advanceTurn(true);
            } else {
              advanceTurn(false);
            }
          }, 1200);
        }
      }
      
    }, 400);
  };

  // Human Token Click
  const handleTokenClick = (tokenId: number) => {
    setIsHumanAutoplay(false); // Wake up human player
    if (activePlayer.type !== 'human' || gameState.isAnimating || gameState.isRolling || !gameState.hasRolled || isAnimatingMoveRef.current) return;

    if (playableTokenIds.includes(tokenId)) {
      const token = gameState.tokens.find((t) => t.playerId === activePlayer.id && t.id === tokenId);
      if (!token) return;

      if (token.step === 0) {
        const idxFive = remainingMoves.findIndex(m => m === 5);
        if (idxFive !== -1) {
          moveToken(tokenId, 5, [idxFive]);
        } else if (remainingMoves.length === 2 && remainingMoves[0] + remainingMoves[1] === 5) {
          moveToken(tokenId, 5, [0, 1]);
        }
      } else {
        if (remainingMoves.length === 1) {
          moveToken(tokenId, remainingMoves[0], [0]);
        } else {
          setMoveSelectorTokenId(tokenId);
        }
      }
    }
  };

  // AI Bot Turn Execution Effect
  useEffect(() => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }

    const isActiveBot = activePlayer?.type === 'bot' || (activePlayer?.type === 'human' && isHumanAutoplay);
    if (gameState.winner || winnerRef.current !== null || !isActiveBot || gameState.isRolling || gameState.isAnimating) return;

    if (!gameState.hasRolled) {
      botTimeoutRef.current = window.setTimeout(() => {
        handleRollDice();
      }, 1100);
    } else if (remainingMoves.length > 0) {
      const playables = getPlayableTokenIdsHex(activePlayer.id, remainingMoves);
      if (playables.length > 0) {
        const validMoves: { tokenId: number; moveVal: number; indices: number[] }[] = [];
        playables.forEach((tokenId) => {
          const token = gameState.tokens.find(t => t.playerId === activePlayer.id && t.id === tokenId);
          if (!token) return;

          if (token.step === 0) {
            const idxFive = remainingMoves.findIndex(m => m === 5);
            if (idxFive !== -1) {
              validMoves.push({ tokenId, moveVal: 5, indices: [idxFive] });
            } else if (remainingMoves.length === 2 && remainingMoves[0] + remainingMoves[1] === 5) {
              validMoves.push({ tokenId, moveVal: 5, indices: [0, 1] });
            }
          } else {
            remainingMoves.forEach((m, idx) => {
              if (token.step + m <= 83) {
                let blocked = false;
                for (let stepOffset = 1; stepOffset <= m; stepOffset++) {
                  const pathStep = token.step + stepOffset;
                  const pIndex = getCellIndexForToken(token.color, pathStep);
                  if (typeof pIndex === 'number' && hasBarrierAtHex(pIndex, gameState.tokens)) {
                    blocked = true;
                    break;
                  }
                }
                if (!blocked) {
                  validMoves.push({ tokenId, moveVal: m, indices: [idx] });
                }
              }
            });
            if (remainingMoves.length === 2 && token.step + remainingMoves[0] + remainingMoves[1] <= 83) {
              let blocked = false;
              const sum = remainingMoves[0] + remainingMoves[1];
              for (let stepOffset = 1; stepOffset <= sum; stepOffset++) {
                const pathStep = token.step + stepOffset;
                const pIndex = getCellIndexForToken(token.color, pathStep);
                if (typeof pIndex === 'number' && hasBarrierAtHex(pIndex, gameState.tokens)) {
                  blocked = true;
                  break;
                }
              }
              if (!blocked) {
                validMoves.push({ tokenId, moveVal: sum, indices: [0, 1] });
              }
            }
          }
        });

        if (validMoves.length > 0) {
          let chosen = validMoves[0];
          let maxScore = -1;

          validMoves.forEach((mv) => {
            let score = 10;
            const token = gameState.tokens.find(t => t.playerId === activePlayer.id && t.id === mv.tokenId);
            if (!token) return;

            if (token.step === 0) score += 50;

            let targetStep = token.step + mv.moveVal;
            if (token.step === 0) {
              targetStep = 1;
            }

            if (targetStep === 83) score += 100;

            const targetCellIndex = getCellIndexForToken(token.color, targetStep);
            if (typeof targetCellIndex === 'number' && !STAR_CELLS.includes(targetCellIndex)) {
              const hasEnemy = gameState.tokens.some(t => t.playerId !== activePlayer.id && t.step > 0 && t.step <= 76 && getCellIndexForToken(t.color, t.step) === targetCellIndex);
              if (hasEnemy) score += 80;
            }

            if (score > maxScore) {
              maxScore = score;
              chosen = mv;
            }
          });

          botTimeoutRef.current = window.setTimeout(() => {
            moveToken(chosen.tokenId, chosen.moveVal, chosen.indices);
          }, 900);
        }
      }
    }
  }, [
    activePlayer,
    gameState.hasRolled,
    gameState.isRolling,
    gameState.isAnimating,
    gameState.winner,
    remainingMoves,
    isHumanAutoplay,
  ]);

  // Turn alert vibration & sound sync for Human Turn
  useEffect(() => {
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }

    if (activePlayer && activePlayer.type === 'human' && !gameState.hasRolled && !gameState.isRolling && !gameState.isAnimating && !gameState.winner) {
      setIsGlowActive(true);
      if (!isMuted) {
        audio.playTurnAlert();
      }

      vibrationIntervalRef.current = window.setInterval(() => {
        if (navigator.vibrate) {
          navigator.vibrate(100);
        }
      }, 1000);
    } else {
      setIsGlowActive(false);
    }

    return () => {
      if (vibrationIntervalRef.current) {
        clearInterval(vibrationIntervalRef.current);
        vibrationIntervalRef.current = null;
      }
    };
  }, [gameState.currentTurnIndex, gameState.hasRolled, gameState.isRolling, gameState.winner, isMuted]);

  // Continuous Turn Alert Sound for Human Player
  useEffect(() => {
    const activePlayer = gameState.players[gameState.currentTurnIndex];
    const isHumanTurnToRoll = activePlayer && activePlayer.type === 'human' && !isHumanAutoplay && !gameState.hasRolled && !gameState.isRolling && gameState.winner === null;
    if (isHumanTurnToRoll && !isMuted) {
      audio.startTurnAlertLoop();
    } else {
      audio.stopTurnAlertLoop();
    }
    return () => {
      audio.stopTurnAlertLoop();
    };
  }, [gameState.players, gameState.currentTurnIndex, isHumanAutoplay, gameState.hasRolled, gameState.isRolling, gameState.winner, isMuted]);

  // Restart Game
  const handleReset = () => {
    winnerRef.current = null;
    setGameState(createInitialHexState(playerCount, humanColor, botDifficulty));
    setDiceValues(null);
    setRemainingMoves([]);
    setMoveSelectorTokenId(null);
    setExtraTurnsCount(0);
    setTimer(10);
  };

  return (
    <div className="w-full flex-1 flex flex-col items-center text-white relative overflow-hidden">
      {/* Toast Banner (Floating Overlay - Zero Layout Shift) */}
      {notification && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2 rounded-2xl border border-[var(--candy-cyan)]/50 bg-[#0f172a]/90 backdrop-blur-md px-6 py-3 text-[var(--candy-cyan)] font-display text-sm font-extrabold shadow-[0_8px_32px_rgba(0,0,0,0.6)] pointer-events-none">
          <Sparkles className="size-4 text-[var(--candy-cyan)]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Main Game Stage */}
      <div className="relative w-full flex-1 flex flex-col items-center justify-center min-h-[600px] z-10">
        
        {/* Center Game Board */}
        <div 
          className="z-10 w-full mx-auto flex items-center justify-center"
          style={{ maxWidth: 'min(700px, calc((100vh - 220px) * 1.05))' }}
        >
          <div className="relative mx-auto w-full">
            <HexagonalLudoBoardView
              appTheme={appTheme}
              tokens={gameState.tokens}
              players={gameState.players}
              currentTurnIndex={gameState.currentTurnIndex}
              playableTokenIds={playableTokenIds}
              onTokenClick={handleTokenClick}
              humanPlayerId={gameState.players.findIndex(p => p.type === 'human')}
              explosionData={explosionData}
            />
          </div>
        </div>

        {/* Corners with PlayerCorners */}
        {/* Corners with PlayerCorners */}
        {(() => {
           const activePlayers = gameState.players.filter(p => p.isActive);
           const humanIdx = activePlayers.findIndex(p => p.type === 'human');
           
           return activePlayers.map((p, index) => {
             let pos: 'bottom-left' | 'bottom-right' | 'top-right' | 'top-left' | 'mid-left' | 'mid-right' = 'bottom-left';
             
             if (p.type === 'human') {
               pos = 'bottom-left';
             } else {
               const baseIdx = humanIdx >= 0 ? humanIdx : 0;
               const offset = (index - baseIdx + activePlayers.length) % activePlayers.length;
               
               if (activePlayers.length === 6) {
                 const positions: any[] = ['bottom-left', 'bottom-right', 'mid-right', 'top-right', 'top-left', 'mid-left'];
                 pos = positions[offset];
               } else if (activePlayers.length === 5) {
                 const positions: any[] = ['bottom-left', 'bottom-right', 'top-right', 'top-left', 'mid-left'];
                 pos = positions[offset];
               } else if (activePlayers.length === 4) {
                 const positions: any[] = ['bottom-left', 'bottom-right', 'top-right', 'top-left'];
                 pos = positions[offset];
               } else if (activePlayers.length === 3) {
                 pos = offset === 1 ? 'bottom-right' : 'top-left';
               } else if (activePlayers.length === 2) {
                 pos = offset === 1 ? 'top-right' : 'bottom-left';
               }
             }

             return (
               <PlayerCorner
                 key={p.id}
                 player={p as any}
                 position={pos}
                 isActiveTurn={currentTurn === p.id}
                 isHumanTurnToRoll={currentTurn === p.id && p.type === 'human' && !gameState.hasRolled && !gameState.isRolling && !gameState.isAnimating}
                 isLocalUser={p.type === 'human'}
                 isRolling={gameState.isRolling}
                 hasRolled={gameState.hasRolled}
                 diceValues={diceValues}
                 remainingMoves={remainingMoves}
                 onRollDice={() => { setIsHumanAutoplay(false); handleRollDice(); }}
                 timer={timer}
               />
             );
           });
        })()}

        {/* Minimalist Log Ticker */}
        {gameState.logs.length > 0 && (
          <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 z-50 pointer-events-none w-full text-center px-4">
            <span className="text-white/50 text-[10px] font-medium tracking-widest uppercase drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] animate-pulse">
              {gameState.logs[gameState.logs.length - 1].message}
            </span>
          </div>
        )}
      </div>

      {/* Move Selection Modal (2 Dice choosing popup) */}
      {moveSelectorTokenId !== null && (() => {
        const token = gameState.tokens.find((t) => t.playerId === activePlayer.id && t.id === moveSelectorTokenId);
        if (!token) return null;

        const checkMoveValid = (moveVal: number) => {
          if (token.step === 0) {
            if (moveVal === 5 || moveVal === 6) {
              const startIdx = getCellIndexForToken(token.color, 1);
              if (typeof startIdx === 'number') {
                let myCount = 0;
                let enemyCount = 0;
                gameState.tokens.forEach(tk => {
                   const tkIdx = getCellIndexForToken(tk.color, tk.step);
                   if (typeof tkIdx === 'number' && tkIdx === startIdx) {
                      if (tk.color === token.color) myCount++;
                      else enemyCount++;
                   }
                });
                const isExpellable = (myCount === 1 && enemyCount === 1);
                const isBlocked = (myCount + enemyCount >= 2) && !isExpellable;
                return !isBlocked;
              }
            }
            return false;
          } else if (token.step > 0 && token.step < 83) {
            if (token.step + moveVal > 83) return false;
            let blocked = false;
            for(let stepOffset = 1; stepOffset <= moveVal; stepOffset++) {
               const pathStep = token.step + stepOffset;
               const pIndex = getCellIndexForToken(token.color, pathStep);
               if (typeof pIndex === 'number' && hasBarrierAtHex(pIndex, gameState.tokens)) { 
                 blocked = true; 
                 break; 
               }
            }
            return !blocked;
          }
          return false;
        };

        const options: { label: string, val: number, indices: number[] }[] = [];
        const seenValues = new Set<number>();

        remainingMoves.forEach((m, idx) => {
          if (!seenValues.has(m)) {
            if (checkMoveValid(m)) {
              options.push({ label: m.toString(), val: m, indices: [idx] });
              seenValues.add(m);
            }
          }
        });

        if (remainingMoves.length === 2 && token.step > 0) {
          const sum = remainingMoves[0] + remainingMoves[1];
          if (checkMoveValid(sum)) {
            options.push({ label: sum.toString(), val: sum, indices: [0, 1] });
          }
        }

        return (
          <div className="fixed inset-0 bg-black/80 sm:backdrop-blur-sm z-[210] flex items-center justify-center p-4 transition-opacity" style={{ willChange: 'opacity' }}>
            <div className="bg-[oklch(0.16_0.03_285)] border border-[#06b6d4]/40 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_20px_#06b6d440] flex flex-col gap-3 max-w-[200px] w-full animate-in fade-in zoom-in-95 duration-200" style={{ willChange: 'transform, opacity' }}>
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-white font-extrabold text-sm text-center font-display uppercase tracking-wider drop-shadow-[0_0_8px_rgba(0,242,255,0.4)]">Mover Ficha</h3>
                <p className="text-xs text-slate-400 font-medium">Elige el dado:</p>
              </div>
              <div className="flex flex-row flex-wrap justify-center gap-2 mt-1">
                {options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setMoveSelectorTokenId(null);
                      moveToken(moveSelectorTokenId, opt.val, opt.indices);
                    }}
                    className="w-12 h-12 bg-[#06b6d4]/15 border border-[#06b6d4] hover:bg-[#06b6d4] hover:text-black text-[#06b6d4] rounded-2xl flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-[0_0_12px_#06b6d4] font-display font-extrabold text-xl"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMoveSelectorTokenId(null)}
                className="mt-1 py-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all text-center cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        );
      })()}

      {/* Winner Celebration Modal */}
      {gameState.winner !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 sm:backdrop-blur-md p-4 transition-opacity" style={{ willChange: 'opacity' }}>
          <div className="bg-[var(--panel-bg,oklch(0.12_0.02_285/0.85))] max-w-md w-full rounded-3xl p-8 border border-[var(--panel-border,oklch(0.7_0.27_350/0.15))] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_60px_oklch(0.7_0.27_350/0.15)] flex flex-col items-center text-center gap-6 animate-in zoom-in duration-300" style={{ willChange: 'transform, opacity' }}>
            <Trophy className="text-[var(--candy-green,oklch(0.78_0.2_150))] animate-bounce drop-shadow-[0_0_15px_var(--candy-green,oklch(0.78_0.2_150))]" size={64} />
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--candy-magenta,oklch(0.7_0.27_350))] to-[var(--candy-cyan,oklch(0.82_0.15_200))] drop-shadow-[0_0_8px_oklch(0.7_0.27_350/0.5)]">
              ¡PARTIDA FINALIZADA!
            </h2>
            
            <div className="w-full flex flex-col gap-3 mt-2 mb-2">
              {gameState.players
                .filter(p => p.hasFinished)
                .sort((a, b) => (a.rank || 99) - (b.rank || 99))
                .map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between bg-[var(--panel-border,oklch(0.7_0.27_350/0.1))] p-3 rounded-xl border border-[var(--panel-border,oklch(0.7_0.27_350/0.2))]">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl drop-shadow-md">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                      </span>
                      <span className="font-bold text-t-primary/90 text-sm uppercase tracking-wide">
                        {idx + 1}.º LUGAR
                      </span>
                    </div>
                    <span 
                      className="font-black text-lg drop-shadow-md" 
                      style={{ color: HEX_COLOR_INFO[p.color].hex }}
                    >
                      {p.name}
                    </span>
                  </div>
                ))}
            </div>
            <div className="flex flex-col gap-3 w-full mt-2">
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-4 bg-[linear-gradient(145deg,oklch(0.78_0.2_150),color-mix(in_oklch,oklch(0.78_0.2_150),black_12%))] text-[oklch(0.18_0.03_285)] font-black rounded-2xl text-lg hover:brightness-110 active:scale-95 shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.5_0.14_155),0_10px_20px_color-mix(in_oklch,oklch(0.5_0.14_155),transparent_55%)] transition-all cursor-pointer uppercase tracking-wider font-display"
              >
                Jugar de Nuevo
              </button>
              <button
                onClick={onExit}
                className="w-full py-3.5 rounded-2xl border border-border bg-[oklch(1_0_0/0.05)] text-foreground font-bold hover:bg-[oklch(1_0_0/0.1)] shadow-[inset_0_1px_0_oklch(1_0_0/0.15)] transition-all cursor-pointer text-sm tracking-wide uppercase"
              >
                Volver al Menú
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
