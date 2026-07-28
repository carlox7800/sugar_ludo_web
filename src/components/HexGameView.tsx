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
  HexGameState,
  HexLog,
} from '../HexGameEngine';
import { HexagonalLudoBoardView } from './HexagonalLudoBoardView';
import { GameControls } from './GameControls';
import { ConsoleLogs } from './ConsoleLogs';
import { globalLogger } from '@/lib/logger';
import { audio } from '../audio';
import { Sparkles, Trophy, ArrowLeft, RotateCcw, Volume2, VolumeX, Zap, ShieldCheck, Award } from 'lucide-react';

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
  const [gameState, setGameState] = useState<HexGameState>(() =>
    createInitialHexState(playerCount, humanColor, botDifficulty)
  );

  useEffect(() => {
    console.log("HexGameView mounted - using modern GameControls!");
  }, []);

  const [timer, setTimer] = useState<number>(10);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(true);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

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
  const [notification, setNotification] = useState<string | null>(null);
  const [explosionData, setExplosionData] = useState<{ cellIndex: number | string; color: HexPlayerColor } | null>(null);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const activePlayer = gameState.players[gameState.currentTurnIndex];

  const getPlayableTokenIdsHex = (pId: number, moves: number[], currentTokens = gameState.tokens): number[] => {
    if (moves.length === 0) return [];
    
    const hasFive = moves.includes(5);
    const hasSumFive = moves.length === 2 && moves[0] + moves[1] === 5;
    
    const playerTokens = currentTokens.filter((t) => t.playerId === pId);
    const playableIds: number[] = [];

    const hasBarrierAt = (perimeterIndex: number) => {
      if (perimeterIndex < 0 || perimeterIndex > 77) return false;
      let totalCount = 0;
      currentTokens.forEach(tk => {
        const tkIdx = getCellIndexForToken(tk.color, tk.step);
        if (typeof tkIdx === 'number' && tkIdx === perimeterIndex) {
          totalCount++;
        }
      });
      return totalCount >= 2;
    };

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
          if (typeof startIdx === 'number' && !hasBarrierAt(startIdx)) {
            playableIds.push(t.id);
          }
        }
      } else if (t.step > 0 && t.step < 84) {
        let canMove = false;
        
        for (const m of moves) {
          if (t.step + m <= 84) {
            let blocked = false;
            for(let stepOffset = 1; stepOffset <= m; stepOffset++) {
               const pathStep = t.step + stepOffset;
               const pIndex = getCellIndexForToken(t.color, pathStep);
               if (typeof pIndex === 'number' && hasBarrierAt(pIndex)) { 
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
          if (t.step + sum <= 84) {
             let blocked = false;
             for(let stepOffset = 1; stepOffset <= sum; stepOffset++) {
               const pathStep = t.step + stepOffset;
               const pIndex = getCellIndexForToken(t.color, pathStep);
               if (typeof pIndex === 'number' && hasBarrierAt(pIndex)) { 
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

  // Turn Transition Handler
  useEffect(() => {
    if (gameState.winner || gameState.isRolling || gameState.isAnimating || !gameState.hasRolled) return;

    if (remainingMoves.length === 0) {
      passTurn();
    } else {
      const playables = getPlayableTokenIdsHex(activePlayer.id, remainingMoves);
      if (playables.length === 0) {
        addLog(`${activePlayer.name} no tiene movimientos válidos.`, 'info', activePlayer.color);
        const passTimeout = setTimeout(() => {
          passTurn();
        }, 1200);
        return () => clearTimeout(passTimeout);
      }
    }
  }, [remainingMoves, gameState.hasRolled, gameState.isRolling, gameState.isAnimating]);

  // Next Turn
  const moveToken = (tokenId: number, moveVal: number, moveIndices: number[]) => {
    if (gameState.isAnimating || gameState.winner) return;

    setGameState((prev) => ({ ...prev, isAnimating: true }));
    
    const token = gameState.tokens.find(
      (t) => t.playerId === activePlayer.id && t.id === tokenId
    );

    if (!token) {
      setGameState((prev) => ({ ...prev, isAnimating: false }));
      return;
    }

    const oldStep = token.step;
    let newStep = oldStep + moveVal;

    if (oldStep === 0) {
      if (moveIndices.length === 2) {
        const d1 = remainingMoves[0];
        const d2 = remainingMoves[1];
        if (d1 === 5 || d1 === 6) {
          newStep = 1 + d2;
        } else {
          newStep = 1 + d1;
        }
      } else {
        newStep = 1;
      }
    }

    // Step-by-step animation logic
    const stepsToTake = newStep - oldStep;
    let currentStepAnim = oldStep;

    const animateNextStep = () => {
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
        setTimeout(animateNextStep, 200); // 200ms per step
      } else {
        // Finished moving, do captures and rules
        setTimeout(() => {
          finalizeMove(newStep);
        }, 200);
      }
    };

    const finalizeMove = (finalStep: number) => {
      let bonusSteps = 0;
      let capturedAny = false;
      let capturedTokensIds: { playerId: number, id: number }[] = [];

      const targetCellIndex = getCellIndexForToken(token.color, finalStep);

      // Check captures
      if (typeof targetCellIndex === 'number') {
        const isStartCell = targetCellIndex === HEX_COLOR_INFO[token.color].startCell;
        const canCaptureOnCell = !STAR_CELLS.includes(targetCellIndex) || (oldStep === 0 && isStartCell);

        if (canCaptureOnCell) {
          gameState.tokens.forEach((otherToken) => {
            if (otherToken.playerId !== activePlayer.id && otherToken.step > 0 && otherToken.step <= 78) {
              const otherCell = getCellIndexForToken(otherToken.color, otherToken.step);
              if (otherCell === targetCellIndex) {
                capturedTokensIds.push({ playerId: otherToken.playerId, id: otherToken.id });
                capturedAny = true;
                setExplosionData({ cellIndex: targetCellIndex, color: otherToken.color });
                setTimeout(() => setExplosionData(null), 3500);
                if (!isMuted) audio.playFireworks();
                showToast(
                  oldStep === 0
                    ? `💥 ¡Expulsión de salida! Ficha enemiga enviada a casa`
                    : `⚔️ ¡Ficha capturada! +25 pasos de bono`
                );
              }
            }
          });
        }
      }

      const playerGoalTokens = gameState.tokens.filter(
        (t) => t.playerId === activePlayer.id && t.step === 84 && t.id !== tokenId
      );
      const hasWon = playerGoalTokens.length + (finalStep === 84 ? 1 : 0) === TOKENS_PER_PLAYER;

      if (finalStep === 84 && !hasWon) {
        bonusSteps += 15;
        if (!isMuted) audio.playGoal();
        showToast('🎉 ¡Ficha en la meta! +15 pasos de bono');
      }

      if (capturedAny) {
        bonusSteps += 25;
      }

      const moveLogMessage = capturedAny
        ? `¡${activePlayer.name} CAPTURÓ una ficha enemiga en la casilla ${targetCellIndex}!`
        : `${activePlayer.name} movió su ficha ${tokenId + 1} a ${
            finalStep === 84 ? '¡LA META!' : `paso ${finalStep}`
          }.`;
          
      globalLogger.log(capturedAny ? 'TOKENS' : 'TOKENS', moveLogMessage, { playerColor: activePlayer.color });

      if (bonusSteps > 0) {
        globalLogger.log('GAME-FLOW', `🎁 ¡Bono de +${bonusSteps} pasos para ${activePlayer.name}!`, { playerColor: activePlayer.color });
      }

      if (hasWon && !gameState.players[activePlayer.id].hasFinished) {
        if (!isMuted) audio.playVictory();
      }

      // Sincronizar dados
      const nextMoves = [...remainingMoves];
      [...moveIndices].sort((a, b) => b - a).forEach(idx => nextMoves.splice(idx, 1));
      
      if (bonusSteps > 0) {
        nextMoves.push(bonusSteps);
      }
      setRemainingMoves(nextMoves);

      setGameState((prev) => {
        const newTokens = prev.tokens.map(t => {
          if (t.playerId === activePlayer.id && t.id === tokenId) {
            return { ...t, step: finalStep };
          }
          if (capturedTokensIds.some(c => c.playerId === t.playerId && c.id === t.id)) {
            return { ...t, step: 0 };
          }
          return t;
        });

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
          if (newRank >= activeCount - 1) {
            let lastPlayer = newPlayers.find(p => p.isActive && !p.hasFinished);
            if (lastPlayer) {
               newPlayers = newPlayers.map(p => 
                 p.id === lastPlayer!.id ? { ...p, hasFinished: true, rank: activeCount } : p
               );
            }
            newWinner = newPlayers.find(p => p.rank === 1) || activePlayer;
            updatedLogs.push({
              id: Math.random().toString(),
              message: `🏁 ¡La partida ha terminado!`,
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              type: 'system',
            });
            globalLogger.log('GAME-FLOW', `🏁 ¡La partida ha terminado!`);
          }
        }

        return {
          ...prev,
          tokens: newTokens,
          isAnimating: false,
          winner: hasWon ? activePlayer : prev.winner,
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
        setTimeout(animateNextStep, 200);
      } else {
        setTimeout(() => finalizeMove(newStep), 200);
      }
    } else {
      animateNextStep();
    }
  };

  const passTurn = () => {
    triggerTurnStart();
    setBarrierLifetimes(prev => {
      const nextLifetimes = { ...prev };
      const cellCounts = {};
      gameState.tokens.forEach(tk => {
        const tkIdx = getCellIndexForToken(tk.color, tk.step);
        if (typeof tkIdx === 'number') {
          cellCounts[tkIdx] = (cellCounts[tkIdx] || 0) + 1;
        }
      });
      gameState.tokens.forEach(tk => {
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

    setGameState((prev) => {
      let nextIdx = prev.currentTurnIndex;
      let nextExtraTurns = extraTurnsCount;

      if (nextExtraTurns > 0) {
        nextExtraTurns -= 1;
      } else if (pendingExtraTurnsRef.current > 0) {
        pendingExtraTurnsRef.current -= 1;
      } else {
        do {
          nextIdx = (nextIdx + 1) % prev.players.length;
        } while (prev.players[nextIdx].hasFinished && nextIdx !== prev.currentTurnIndex);
      }

      setTimeout(() => setExtraTurnsCount(nextExtraTurns), 0);

      return {
        ...prev,
        currentTurnIndex: nextIdx,
        diceValue: null,
        hasRolled: false,
      };
    });

    setDiceValues(null);
    setRemainingMoves([]);
    setMoveSelectorTokenId(null);
    setTimer(10);
  };

  // Roll Dice (2 dice mechanism)
  const handleRollDice = () => {
    if (gameState.isRolling || gameState.hasRolled || gameState.isAnimating || gameState.winner) return;

    setGameState((prev) => ({ ...prev, isRolling: true }));
    if (!isMuted) audio.playDiceRoll();
    setGameState((prev) => ({ ...prev, isRolling: true }));
    setIsGlowActive(false);

    setTimeout(() => {
      const r1 = Math.floor(Math.random() * 6) + 1;
      const r2 = Math.floor(Math.random() * 6) + 1;
      const rolls = [r1, r2];
      const isDouble = r1 === r2;

      if (!isMuted) audio.playTurnAlert();
      setDiceValues(rolls);
      setRemainingMoves([...rolls]);

      setGameState((prev) => {
        const sum = r1 + r2;
        let rollLogMessage = `${activePlayer.name} sacó ${r1} y ${r2} (Total: ${sum})`;
        let typeStr = 'roll';
        
        if (isDouble) {
          consecutiveDoublesCountRef.current += 1;
          
          if (consecutiveDoublesCountRef.current >= 3) {
            consecutiveDoublesCountRef.current = 0;
            pendingExtraTurnsRef.current = 0;
            
            let newTokens = [...prev.tokens];
            if (lastMovedTokenRef.current && lastMovedTokenRef.current.playerId === activePlayer.id) {
              const lastId = lastMovedTokenRef.current.tokenId;
              newTokens = newTokens.map(t => {
                if (t.playerId === activePlayer.id && t.id === lastId && t.step > 0 && t.step < 84) {
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
            globalLogger.log('GAME-FLOW', `🚨 ¡Tercer doble consecutivo! Tu última ficha regresa a la base.`, { playerColor: activePlayer.color });
            
            showToast('🚨 ¡Tercer doble! Ficha a la base.');
            setRemainingMoves([]);
            setTimeout(() => passTurn(), 1500);
            
            return {
              ...prev,
              diceValue: sum,
              tokens: newTokens,
              isRolling: false,
              hasRolled: true,
              logs: [...prev.logs, warningLog],
            };
          }

          pendingExtraTurnsRef.current += 1;
          rollLogMessage = `🎲 ¡${activePlayer.name} sacó doble (${r1},${r2}) y gana tiro extra!`;
          typeStr = 'info';
          showToast('🎲 ¡Doble! Tiras de nuevo');
        } else {
          consecutiveDoublesCountRef.current = 0;
        }
        
        const newLog = {
          id: Math.random().toString(),
          message: rollLogMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: typeStr,
          color: activePlayer.color,
        };

        globalLogger.log('GAME-FLOW', rollLogMessage, { playerColor: activePlayer.color });

        return {
          ...prev,
          diceValue: sum,
          isRolling: false,
          hasRolled: true,
          logs: [...prev.logs, newLog],
        };
      });
      
    }, 400);
  };

  // Human Token Click
  const handleTokenClick = (tokenId: number) => {
    setIsHumanAutoplay(false); // Wake up human player
    if (activePlayer.type !== 'human' || gameState.isAnimating || gameState.isRolling || !gameState.hasRolled) return;

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
    if (gameState.winner || !isActiveBot || gameState.isRolling || gameState.isAnimating) return;

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
              if (token.step + m <= 84) {
                validMoves.push({ tokenId, moveVal: m, indices: [idx] });
              }
            });
            if (remainingMoves.length === 2 && token.step + remainingMoves[0] + remainingMoves[1] <= 84) {
              validMoves.push({ tokenId, moveVal: remainingMoves[0] + remainingMoves[1], indices: [0, 1] });
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
              if (mv.indices.length === 2) {
                const d1 = remainingMoves[0];
                const d2 = remainingMoves[1];
                targetStep = 1 + (d1 === 5 || d1 === 6 ? d2 : d1);
              } else {
                targetStep = 1;
              }
            }

            if (targetStep === 84) score += 100;

            const targetCellIndex = getCellIndexForToken(token.color, targetStep);
            if (typeof targetCellIndex === 'number' && !STAR_CELLS.includes(targetCellIndex)) {
              const hasEnemy = gameState.tokens.some(t => t.playerId !== activePlayer.id && t.step > 0 && t.step <= 78 && getCellIndexForToken(t.color, t.step) === targetCellIndex);
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

  // Restart Game
  const handleReset = () => {
    setGameState(createInitialHexState(playerCount, humanColor, botDifficulty));
    setDiceValues(null);
    setRemainingMoves([]);
    setMoveSelectorTokenId(null);
    setExtraTurnsCount(0);
    setTimer(10);
  };

  // Color Map dictionaries for UI styling
  const turnTitles: Record<HexPlayerColor, string> = {
    purple: 'Morado',
    green: 'Verde',
    blue: 'Azul',
    orange: 'Naranja',
    yellow: 'Amarillo',
    red: 'Rojo',
  };

  const textColors: Record<HexPlayerColor, string> = {
    purple: 'text-purple-500',
    green: 'text-p-green',
    blue: 'text-p-blue',
    orange: 'text-orange-500',
    yellow: 'text-p-yellow',
    red: 'text-p-red',
  };

  const bgColors: Record<HexPlayerColor, string> = {
    purple: 'bg-purple-500',
    green: 'bg-[var(--color-p-green)]',
    blue: 'bg-[var(--color-p-blue)]',
    orange: 'bg-orange-500',
    yellow: 'bg-[var(--color-p-yellow)]',
    red: 'bg-p-red',
  };

  // Dice Dots Renderer
  const renderDiceDots = (value: number, color: HexPlayerColor) => {
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

  return (
    <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 relative">
      {/* Toast Banner (Floating Overlay - Zero Layout Shift) */}
      {notification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2 rounded-2xl border border-[var(--candy-cyan)]/50 bg-[#0f172a]/90 backdrop-blur-md px-6 py-3 text-[var(--candy-cyan)] font-display text-sm font-extrabold shadow-[0_8px_32px_rgba(0,0,0,0.6)] pointer-events-none">
          <Sparkles className="size-4 text-[var(--candy-cyan)]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Left Column: Interactive Hexagonal Board View */}
      <div className="w-full lg:w-3/5 flex flex-col gap-3">
        <HexagonalLudoBoardView
          appTheme={appTheme}
          tokens={gameState.tokens}
          players={gameState.players}
          currentTurnIndex={gameState.currentTurnIndex}
          playableTokenIds={playableTokenIds}
          onTokenClick={handleTokenClick}
          humanPlayerId={gameState.players.findIndex((p) => p.type === 'human')}
          explosionData={explosionData}
        />
      </div>

      {/* Right Column: Unified Game Control Panel & Console Logs */}
      <div className="w-full lg:w-2/5 flex flex-col gap-3 shrink-0">
        {console.log("🔍 [RASTREO-SELECTOR-6J]", { file: 'HexGameView.tsx', component: 'GameControls', activePlayer, isHumanTurnToRoll })}
        <GameControls
          appTheme={appTheme}
          setAppTheme={() => {}}
          isPlaying={true}
          onStartGame={() => {}}
          onRollDice={handleRollDice}
          diceValues={diceValues}
          remainingMoves={remainingMoves}
          isRolling={gameState.isRolling}
          currentTurnPlayer={activePlayer as any}
          hasRolled={gameState.hasRolled}
          timer={timer}
          winnerPlayer={gameState.winner ? (activePlayer as any) : null}
          onResetGame={handleReset}
          isHumanTurnToRoll={isHumanTurnToRoll as boolean}
          isGlowActive={isGlowActive}
        />

        {/* Live Game Logs */}
        <ConsoleLogs
          logs={gameState.logs.map((l) => ({
            id: l.id,
            message: l.message,
            timestamp: l.timestamp,
            type: l.type as any,
            playerColor: l.color as any,
          }))}
          onClear={() => setGameState((prev) => ({ ...prev, logs: [] }))}
          isOpen={isLogsOpen}
          onToggle={() => setIsLogsOpen(!isLogsOpen)}
          mode="game"
        />
      </div>

      {/* Move Selection Modal (2 Dice choosing popup) */}
      {moveSelectorTokenId !== null && (() => {
        const token = gameState.tokens.find((t) => t.playerId === activePlayer.id && t.id === moveSelectorTokenId);
        if (!token) return null;

        const hasBarrierAt = (perimeterIndex: number) => {
          if (perimeterIndex < 0 || perimeterIndex > 77) return false;
          let totalCount = 0;
          gameState.tokens.forEach(tk => {
            const tkIdx = getCellIndexForToken(tk.color, tk.step);
            if (typeof tkIdx === 'number' && tkIdx === perimeterIndex) {
              totalCount++;
            }
          });
          return totalCount >= 2;
        };

        const checkMoveValid = (moveVal: number) => {
          if (token.step === 0) {
            if (moveVal === 5 || moveVal === 6) {
              const startIdx = getCellIndexForToken(token.color, 1);
              if (typeof startIdx === 'number' && hasBarrierAt(startIdx)) return false;
              return true;
            }
            return false;
          } else if (token.step > 0 && token.step < 84) {
            if (token.step + moveVal > 84) return false;
            let blocked = false;
            for(let stepOffset = 1; stepOffset <= moveVal; stepOffset++) {
               const pathStep = token.step + stepOffset;
               const pIndex = getCellIndexForToken(token.color, pathStep);
               if (typeof pIndex === 'number' && hasBarrierAt(pIndex)) { 
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[210] flex items-center justify-center p-4">
            <div className="bg-[oklch(0.16_0.03_285)] border border-[#06b6d4]/40 p-4 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_20px_#06b6d440] flex flex-col gap-3 max-w-[200px] w-full animate-in fade-in zoom-in-95 duration-200">
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
      {gameState.winner && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[oklch(0.7_0.27_350/0.3)] backdrop-blur-xl p-4 cyber-game-panel">
          <div className="bg-[var(--panel-bg,oklch(0.12_0.02_285/0.85))] max-w-md w-full rounded-3xl p-8 border border-[var(--panel-border,oklch(0.7_0.27_350/0.15))] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_60px_oklch(0.7_0.27_350/0.15)] flex flex-col items-center text-center gap-6 animate-in zoom-in duration-300">
            <Trophy className="text-[var(--candy-green,oklch(0.78_0.2_150))] animate-bounce drop-shadow-[0_0_15px_var(--candy-green,oklch(0.78_0.2_150))]" size={64} />
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--candy-magenta,oklch(0.7_0.27_350))] to-[var(--candy-cyan,oklch(0.82_0.15_200))] drop-shadow-[0_0_8px_oklch(0.7_0.27_350/0.5)]">
              ¡{gameState.winner.name} ha GANADO!
            </h2>
            <p className="text-t-primary/80 font-medium">
              Ha completado las 3 fichas en la meta del tablero hexagonal.
            </p>
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
