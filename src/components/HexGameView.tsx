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
import { ConsoleLogs } from './ConsoleLogs';
import { audio } from '../audio';
import { Sparkles, Trophy, ArrowLeft, RotateCcw, Volume2, VolumeX, Zap, ShieldCheck, Award } from 'lucide-react';

interface HexGameViewProps {
  playerCount: 5 | 6;
  humanColor: HexPlayerColor;
  botDifficulty: 'easy' | 'medium' | 'hard';
  onExit: () => void;
  isMuted: boolean;
  setIsMuted: (muted: boolean) => void;
  appTheme: 'classic' | 'sugar';
}

export const HexGameView: React.FC<HexGameViewProps> = ({
  playerCount,
  humanColor,
  botDifficulty,
  onExit,
  isMuted,
  setIsMuted,
  appTheme,
}) => {
  const [gameState, setGameState] = useState<HexGameState>(() =>
    createInitialHexState(playerCount, humanColor, botDifficulty)
  );

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
  const vibrationIntervalRef = useRef<number | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

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
      if ((barrierLifetimes[globalId] || 0) >= 4) { 
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
      } else if (t.step > 0 && t.step < 87) {
        let canMove = false;
        
        for (const m of moves) {
          if (t.step + m <= 87) {
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
          if (t.step + sum <= 87) {
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
    const newLog: HexLog = {
      id: Math.random().toString(36).substring(2, 9),
      message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type,
      color,
    };
    setGameState((prev) => ({
      ...prev,
      logs: [newLog, ...prev.logs].slice(0, 50),
    }));
  };

  // Turn Timer Effect
  useEffect(() => {
    if (gameState.winner || gameState.isRolling || gameState.isAnimating) return;

    timerRef.current = setInterval(() => {
      setTimer((prev) => {
        if (prev <= 1) {
          passTurn();
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState.currentTurnIndex, gameState.hasRolled, gameState.winner, gameState.isRolling, gameState.isAnimating, extraTurnsCount]);

  // Turn Transition Handler
  useEffect(() => {
    if (gameState.winner || gameState.isRolling || gameState.isAnimating || !gameState.hasRolled) return;

    if (remainingMoves.length === 0) {
      passTurn();
    } else {
      const playables = getPlayableTokenIdsHex(activePlayer.id, remainingMoves);
      if (playables.length === 0) {
        addLog(`Sin movimientos posibles para ${activePlayer.name}.`, 'system');
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
      setGameState((prev) => {
        const newTokens = [...prev.tokens];
        let bonusSteps = 0;
        let capturedAny = false;

        const targetCellIndex = getCellIndexForToken(token.color, finalStep);

        // Check captures
        if (typeof targetCellIndex === 'number' && !STAR_CELLS.includes(targetCellIndex)) {
          newTokens.forEach((otherToken, idx) => {
            if (otherToken.playerId !== activePlayer.id && otherToken.step > 0 && otherToken.step <= 81) {
              const otherCell = getCellIndexForToken(otherToken.color, otherToken.step);
              if (otherCell === targetCellIndex) {
                newTokens[idx] = { ...otherToken, step: 0 };
                capturedAny = true;
                if (!isMuted) audio.playCapture();
                showToast(`⚔️ ¡Ficha capturada! +20 pasos de bono`);
              }
            }
          });
        }

        const playerGoalTokens = newTokens.filter(
          (t) => t.playerId === activePlayer.id && t.step === 87
        );
        const hasWon = playerGoalTokens.length === TOKENS_PER_PLAYER;

        if (hasWon && !isMuted) {
          audio.playVictory();
        }
        
        if (finalStep === 87 && !hasWon) {
          bonusSteps += 15;
          if (!isMuted) audio.playGoal();
          showToast('🎉 ¡Ficha en la meta! +10 pasos de bono');
        }

        if (capturedAny) {
          bonusSteps += 25;
        }

        const moveLogMessage = capturedAny
          ? `¡${activePlayer.name} CAPTURÓ una ficha enemiga en la casilla ${targetCellIndex}!`
          : `${activePlayer.name} movió su ficha ${tokenId + 1} a ${
              finalStep === 87 ? '¡LA META!' : `paso ${finalStep}`
            }.`;
            
        const updatedLogs = [
          {
            id: Math.random().toString(),
            message: moveLogMessage,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: capturedAny ? 'capture' : 'move',
            color: activePlayer.color,
          },
          ...prev.logs,
        ];
        
        if (bonusSteps > 0) {
          updatedLogs.unshift({
            id: Math.random().toString(),
            message: `🎁 ¡Bono de +${bonusSteps} pasos para ${activePlayer.name}!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: 'system',
            color: activePlayer.color,
          });
          
          setTimeout(() => {
            setRemainingMoves(m => [...m, bonusSteps]);
          }, 0);
        }

        return {
          ...prev,
          tokens: newTokens,
          isAnimating: false,
          winner: hasWon ? activePlayer : prev.winner,
          logs: updatedLogs,
        };
      });

      // Update remaining moves
      const nextMoves = [...remainingMoves];
      [...moveIndices].sort((a, b) => b - a).forEach(idx => nextMoves.splice(idx, 1));
      setRemainingMoves(nextMoves);
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
          nextLifetimes[globalId] = (nextLifetimes[globalId] || 0) + 1;
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
        nextIdx = (prev.currentTurnIndex + 1) % prev.players.length;
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
    if (gameState.hasRolled || gameState.isRolling || gameState.isAnimating || gameState.winner) return;

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
          pendingExtraTurnsRef.current += 1;
          rollLogMessage = `🎲 ¡${activePlayer.name} sacó doble (${r1},${r2}) y gana tiro extra!`;
          typeStr = 'info';
        }
        
        const newLog = {
          id: Math.random().toString(),
          message: rollLogMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          type: typeStr,
          color: activePlayer.color,
        };

        return {
          ...prev,
          diceValue: sum,
          isRolling: false,
          hasRolled: true,
          logs: [newLog, ...prev.logs],
        };
      });
      
    }, 400);
  };

  // Human Token Click
  const handleTokenClick = (tokenId: number) => {
    if (activePlayer.type !== 'human' || gameState.isAnimating || gameState.isRolling || !gameState.hasRolled) return;

    if (playableTokenIds.includes(tokenId)) {
      const token = gameState.tokens.find((t) => t.playerId === activePlayer.id && t.id === tokenId);
      if (!token) return;

      if (token.step === 0) {
        const idxSix = remainingMoves.findIndex(m => m === 6);
        const idxFive = remainingMoves.findIndex(m => m === 5);
        if (idxSix !== -1) {
          moveToken(tokenId, 6, [idxSix]);
        } else if (idxFive !== -1) {
          moveToken(tokenId, 5, [idxFive]);
        } else if (remainingMoves.length === 2 && (remainingMoves[0] + remainingMoves[1] === 5 || remainingMoves[0] + remainingMoves[1] === 6)) {
          moveToken(tokenId, remainingMoves[0] + remainingMoves[1], [0, 1]);
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
    if (gameState.winner || activePlayer?.type !== 'human' || gameState.isRolling || gameState.isAnimating) {
      if (activePlayer?.type === 'bot' && !gameState.winner && !gameState.isRolling && !gameState.isAnimating) {
        const botTimeout = setTimeout(() => {
          if (!gameState.hasRolled) {
            handleRollDice();
          } else if (remainingMoves.length > 0) {
            const playables = getPlayableTokenIdsHex(activePlayer.id, remainingMoves);
            if (playables.length > 0) {
              const validMoves: { tokenId: number; moveVal: number; indices: number[] }[] = [];
              playables.forEach((tokenId) => {
                const token = gameState.tokens.find(t => t.playerId === activePlayer.id && t.id === tokenId);
                if (!token) return;

                if (token.step === 0) {
                  const idxSix = remainingMoves.findIndex(m => m === 6);
                  const idxFive = remainingMoves.findIndex(m => m === 5);
                  if (idxSix !== -1) {
                    validMoves.push({ tokenId, moveVal: 6, indices: [idxSix] });
                  } else if (idxFive !== -1) {
                    validMoves.push({ tokenId, moveVal: 5, indices: [idxFive] });
                  } else if (remainingMoves.length === 2 && (remainingMoves[0] + remainingMoves[1] === 5 || remainingMoves[0] + remainingMoves[1] === 6)) {
                    validMoves.push({ tokenId, moveVal: remainingMoves[0] + remainingMoves[1], indices: [0, 1] });
                  }
                } else {
                  remainingMoves.forEach((m, idx) => {
                    if (token.step + m <= 87) {
                      validMoves.push({ tokenId, moveVal: m, indices: [idx] });
                    }
                  });
                  if (remainingMoves.length === 2 && token.step + remainingMoves[0] + remainingMoves[1] <= 87) {
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

                  if (targetStep === 87) score += 100;

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

                moveToken(chosen.tokenId, chosen.moveVal, chosen.indices);
              }
            }
          }
        }, 1000);

        return () => clearTimeout(botTimeout);
      }
    }
  }, [
    activePlayer,
    gameState.hasRolled,
    gameState.isRolling,
    gameState.isAnimating,
    gameState.winner,
    remainingMoves,
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
    <div className="w-full flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4">
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
        />
      </div>

      {/* Right Column: Unified Game Control Panel & Console Logs */}
      <div className="w-full lg:w-2/5 flex flex-col gap-3 shrink-0">
        {/* Unified Control Panel */}
        <div className="w-full rounded-2xl p-4 shadow-[0_0_30px_rgba(0,242,255,0.04)] border flex flex-col gap-3.5 select-none cyber-game-panel bg-[var(--panel-bg,oklch(0.12_0.02_285/0.85))] backdrop-blur-xl border-[var(--panel-border,oklch(0.7_0.27_350/0.15))]">
          {/* Game Mode Title Badge */}
          <div className="flex items-center justify-between border-b border-[var(--panel-header-border,oklch(0.82_0.15_200/0.2))] pb-1.5">
            <div className="flex items-center gap-1.5">
              <Sparkles className="text-[var(--candy-magenta,oklch(0.7_0.27_350))] animate-pulse drop-shadow-[0_0_8px_var(--candy-magenta,oklch(0.7_0.27_350))]" size={15} />
              <span className="text-[11px] font-black text-t-primary uppercase tracking-wider font-mono drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
                Modo Hexagonal ({playerCount} Jugadores)
              </span>
            </div>
            <span className="text-[9px] font-bold text-[var(--candy-cyan,oklch(0.82_0.15_200))] font-mono uppercase tracking-wider bg-[var(--candy-cyan,oklch(0.82_0.15_200))]/10 px-1.5 py-0.5 rounded border border-[var(--candy-cyan,oklch(0.82_0.15_200))]/20 shadow-[0_0_8px_var(--candy-cyan,oklch(0.82_0.15_200))/0.3]">
              {playerCount} Jugadores
            </span>
          </div>

          {/* Live Game Information Header */}
          {!gameState.winner && (
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5 animate-fade-in">
                <span className="text-[9px] text-t-muted font-mono uppercase tracking-wider">Turno Actual</span>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${bgColors[activePlayer.color]} animate-pulse shadow-[0_0_8px_currentColor]`} />
                  <span className={`text-sm font-bold ${textColors[activePlayer.color]} drop-shadow-[0_0_6px_currentColor]`}>
                    {activePlayer.name} ({turnTitles[activePlayer.color]})
                  </span>
                  <span className="text-[9px] px-1.5 py-0.5 bg-panel text-t-muted rounded border border-border font-semibold uppercase font-mono">
                    {activePlayer.type === 'human' ? 'Tú' : 'Bot'}
                  </span>
                </div>
              </div>

              {/* Turn Timer Clock */}
              <div className="flex flex-col items-end gap-1">
                <span className="text-[9px] text-t-muted font-mono uppercase tracking-wider">Tiempo de Turno</span>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-bold font-mono ${timer <= 3 ? 'text-p-red animate-pulse' : 'text-t-primary'}`}>
                    {timer}s
                  </span>
                  <div className="w-14 h-1.5 bg-panel rounded-full overflow-hidden border border-[var(--panel-border,oklch(0.7_0.27_350/0.15))]">
                    <div
                      className={`h-full transition-all duration-1000 shadow-[0_0_8px_currentColor] ${timer <= 3 ? 'bg-[var(--candy-magenta,oklch(0.7_0.27_350))] animate-pulse' : 'bg-[var(--candy-cyan,oklch(0.82_0.15_200))]'}`}
                      style={{ width: `${(timer / 10) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Dice Container & Roll Buttons */}
          {!gameState.winner && (
            <div className="flex items-center justify-center py-2.5 bg-[oklch(0.08_0.02_285)] rounded-xl border border-[var(--panel-border,oklch(0.7_0.27_350/0.12))] gap-5 relative overflow-hidden">
              {isGlowActive && (
                <div className="absolute inset-0 bg-[var(--candy-cyan,oklch(0.82_0.15_200))]/5 animate-pulse pointer-events-none" />
              )}

              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-bold text-t-muted tracking-wider uppercase font-mono">Dados</span>
                <div className="flex gap-2">
                  {[0, 1].map((dieIdx) => {
                    let isUsed = false;
                    if (diceValues) {
                      const rolledCount = diceValues.filter((v, i) => v === diceValues[dieIdx] && i <= dieIdx).length;
                      const remainingCount = remainingMoves.filter(v => v === diceValues[dieIdx]).length;
                      isUsed = rolledCount > remainingCount;
                    }

                    return (
                      <div
                        key={dieIdx}
                        onClick={() => isHumanTurnToRoll && handleRollDice()}
                        className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300 relative ${isUsed ? 'opacity-30 grayscale scale-90' : ''} ${
                          isHumanTurnToRoll
                            ? 'cursor-pointer hover:scale-105 active:scale-95 shadow-[0_0_12px_rgba(0,242,255,0.12)] border border-border'
                            : 'shadow-md border border-border'
                        } ${gameState.isRolling ? 'animate-spin' : ''} ${bgColors[activePlayer.color]} ${
                          isGlowActive ? 'ring-2 ring-[var(--color-p-blue)] ring-offset-1 ring-offset-[var(--bg-root)]' : ''
                        }`}
                      >
                        {diceValues !== null ? (
                          renderDiceDots(diceValues[dieIdx], activePlayer.color)
                        ) : (
                          <span className="text-t-primary/60 font-bold text-xl font-mono">?</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 max-w-[200px]">
                {activePlayer.type === 'human' ? (
                  <>
                    {!gameState.hasRolled && !gameState.isRolling ? (
                      <button
                        onClick={handleRollDice}
                        className="flex items-center justify-center gap-2 py-2.5 px-5 bg-[linear-gradient(145deg,oklch(0.78_0.2_150),color-mix(in_oklch,oklch(0.78_0.2_150),black_12%))] text-[oklch(0.18_0.03_285)] font-extrabold text-sm rounded-2xl shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_5px_0_oklch(0.5_0.14_155),0_10px_20px_color-mix(in_oklch,oklch(0.5_0.14_155),transparent_55%)] hover:brightness-110 active:scale-95 transition-all cursor-pointer font-mono uppercase tracking-wider"
                      >
                        <Zap size={14} className="animate-bounce fill-current" />
                        Lanzar Dado
                      </button>
                    ) : (
                      <span className="text-xs text-p-blue font-semibold italic">
                        {gameState.hasRolled ? 'Selecciona ficha de tablero' : 'Girando...'}
                      </span>
                    )}
                    {!gameState.hasRolled && !gameState.isRolling && (
                      <p className="text-[10px] text-t-muted leading-tight">
                        *Toca los dados o el botón para tirar.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col gap-1 text-left animate-pulse">
                    <span className="text-xs font-bold text-t-primary font-mono">Pensando...</span>
                    <p className="text-[11px] text-t-muted leading-tight">
                      {activePlayer.name} está decidiendo su jugada.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom Utilities */}
          <div className="flex items-center justify-between text-xs text-t-muted font-medium border-t border-border/35 pt-3">
            <div className="flex items-center gap-1 text-t-muted">
              <ShieldCheck size={14} className="text-p-green" />
              <span>Dificultad: <strong className="capitalize text-p-green">{botDifficulty === 'hard' ? 'Inteligente' : botDifficulty === 'medium' ? 'Media' : 'Fácil'}</strong></span>
            </div>
            <button
              onClick={handleReset}
              className="flex items-center gap-1 text-t-muted hover:text-[var(--candy-magenta,oklch(0.7_0.27_350))] transition-colors cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>Reiniciar Partida</span>
            </button>
          </div>
        </div>

        {/* Live Game Logs */}
        <ConsoleLogs
          logs={gameState.logs.map((l) => ({
            id: l.id,
            message: l.message,
            timestamp: l.timestamp,
            type: l.type as any,
            color: l.color as any,
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

        const checkMoveValid = (moveVal: number) => {
          if (token.step === 0) {
            return moveVal === 5 || moveVal === 6;
          } else if (token.step > 0 && token.step < 87) {
            return token.step + moveVal <= 87;
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[210] flex items-center justify-center p-4 cyber-game-panel">
            <div className="bg-[var(--panel-bg,oklch(0.12_0.02_285/0.85))] border border-[var(--panel-border,oklch(0.7_0.27_350/0.15))] p-4 rounded-3xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex flex-col gap-3 max-w-[180px] w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-t-primary font-black text-xs text-center font-mono uppercase tracking-wider drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">Mover</h3>
              </div>
              <div className="flex flex-row flex-wrap justify-center gap-2 mt-1">
                {options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setMoveSelectorTokenId(null);
                      moveToken(moveSelectorTokenId, opt.val, opt.indices);
                    }}
                    className="w-12 h-12 bg-border hover:bg-p-blue/10 hover:border-p-blue border border-border rounded-xl flex items-center justify-center cursor-pointer transition-all active:scale-95"
                  >
                    <span className="font-bold text-lg text-p-blue font-mono">{opt.label}</span>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMoveSelectorTokenId(null)}
                className="mt-1 py-1 text-t-muted hover:text-foreground hover:bg-[oklch(1_0_0/0.05)] rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all text-center cursor-pointer"
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
