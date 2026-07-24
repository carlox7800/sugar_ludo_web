'use client';
import { useState, useEffect, useRef } from 'react';
import { Player, Token, GameLog, GameConfig, PlayerColor, AppTheme, UserProfile } from './types';
import { GameBoard, getCellCoord, isSafeCell, START_OFFSETS } from './components/GameBoard';
import { GameControls } from './components/GameControls';
import { ConsoleLogs } from './components/ConsoleLogs';
import { audio } from './audio';
import { Volume2, VolumeX, BookOpen, Sparkles, Trophy, ArrowLeft, Settings, X, Palette, Music, Terminal } from 'lucide-react';
import { HexGameView } from './components/HexGameView';

// Clockwise standard colors list
const COLORS_ORDER: PlayerColor[] = ['yellow', 'red', 'green', 'blue'];

const PLAYER_NAMES: Record<PlayerColor, string> = {
  red: 'Rojo',
  green: 'Verde',
  blue: 'Azul',
  yellow: 'Amarillo',
  purple: 'Morado',
  orange: 'Naranja',
};

export default function GameEngine({ initialConfig, onExit }: { initialConfig: GameConfig, onExit: () => void }) {
  // Navigation State
  

  // User Profile
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('sugar_ludo_profile') : null;
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        // ignore
      }
    }
    return { level: 12, xp: 65, xpNeeded: 100, coins: 1250, gems: 45 };
  });

  useEffect(() => {
    if (typeof window !== 'undefined') { localStorage.setItem('sugar_ludo_profile', JSON.stringify(userProfile)); }
  }, [userProfile]);

  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);

  // Game Setup & Mode States
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [appTheme, setAppTheme] = useState<AppTheme>('dark');
  const [config, setConfig] = useState<GameConfig | null>(null);
  useEffect(() => {
    if (initialConfig && !isPlaying) {
      handleStartGame(initialConfig);
    }
  }, [initialConfig]);

  // Core Play State
  const [players, setPlayers] = useState<Player[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [currentTurn, setCurrentTurn] = useState<number>(0); // playerId of active turn
  const [diceValues, setDiceValues] = useState<[number, number] | null>(null);
  const [remainingMoves, setRemainingMoves] = useState<number[]>([]);
  const [moveSelectorTokenId, setMoveSelectorTokenId] = useState<number | null>(null);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [hasRolled, setHasRolled] = useState<boolean>(false);
  const [winner, setWinner] = useState<number | null>(null);
  const [timer, setTimer] = useState<number>(10);
  const [isAnimatingMove, setIsAnimatingMove] = useState<boolean>(false);
  const [barrierLifetimes, setBarrierLifetimes] = useState<Record<number, number>>({});

  // Audio mute helper
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Logs state
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(true);

  // Vibration and Glow States
  const [isGlowActive, setIsGlowActive] = useState<boolean>(false);
  const vibrationIntervalRef = useRef<number | null>(null);
  const botTimeoutRef = useRef<number | null>(null);
  const noMovesTimeoutRef = useRef<number | null>(null);
  const pendingExtraTurnsRef = useRef<number>(0);

  // Add a log to console
  const addLog = (message: string, type: GameLog['type'] = 'info', playerColor?: PlayerColor) => {
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0]; // HH:MM:SS
    const newLog: GameLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp,
      message,
      type,
      playerColor,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  // Setup the Ludo Game
  const handleStartGame = (gameConfig: GameConfig) => {
    setConfig(gameConfig);
    if (gameConfig.playerCount === 5 || gameConfig.playerCount === 6) {
      setIsPlaying(true);
      return;
    }

    const rawHumanIdx = COLORS_ORDER.indexOf(gameConfig.humanColor);
    const humanIdx = rawHumanIdx >= 0 ? rawHumanIdx : 0;

    // Initialize players based on player count and human color selection
    const tempPlayers: Player[] = COLORS_ORDER.map((color, idx) => {
      const isHuman = color === gameConfig.humanColor;
      return {
        id: idx,
        color,
        name: isHuman ? 'Tú' : `Bot ${PLAYER_NAMES[color]}`,
        type: isHuman ? 'human' : 'bot',
        isActive: false, // will set below
      };
    });

    // Determine which players are active using a clockwise pattern from human
    // to keep them adjacent or opposite
    for (let i = 0; i < gameConfig.playerCount; i++) {
      const activeIdx = (humanIdx + i) % 4;
      if (tempPlayers[activeIdx]) {
        tempPlayers[activeIdx].isActive = true;
      }
    }

    // Initialize 4 tokens for each active player
    const tempTokens: Token[] = [];
    tempPlayers.forEach((p) => {
      if (p.isActive) {
        for (let tId = 0; tId < 4; tId++) {
          tempTokens.push({
            id: tId,
            playerId: p.id,
            color: p.color,
            step: 0, // starts in base
          });
        }
      }
    });

    setPlayers(tempPlayers);
    setTokens(tempTokens);
    setWinner(null);
    setDiceValues(null);
    setHasRolled(false);
    setIsAnimatingMove(false);
    setLogs([]);

    // Turn starts with the human player
    setCurrentTurn(humanIdx);
    setTimer(10);
    setIsPlaying(true);

    addLog(`¡Partida iniciada! Modo ${gameConfig.playerCount} jugadores contra Bots (${gameConfig.botDifficulty === 'hard' ? 'Inteligentes' : gameConfig.botDifficulty === 'medium' ? 'Medios' : 'Fáciles'}).`, 'system');
    addLog(`Es el turno de ${tempPlayers[humanIdx].name} (${PLAYER_NAMES[gameConfig.humanColor]}). ¡Lanza el dado!`, 'system', tempPlayers[humanIdx].color);
  };

  // Reset/Restart Game
  const handleResetGame = () => {
    setIsPlaying(false);
    setConfig(null);
    setPlayers([]);
    setTokens([]);
    setWinner(null);
    setDiceValues(null);
    setHasRolled(false);
    setIsAnimatingMove(false);
    setIsGlowActive(false);

    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
    
  };

  // Get active current player
  const activePlayer = players[currentTurn];

  // Helper to find valid movable tokens for a player with current dice value
  const getPlayableTokenIds = (pId: number, moves: number[], currentTokens = tokens): number[] => {
    if (moves.length === 0) return [];
    const hasFive = moves.includes(5);
    const hasSumFive = moves.length === 2 && moves[0] + moves[1] === 5;

    const playerTokens = currentTokens.filter((t) => t.playerId === pId);
    const playableIds: number[] = [];

    const hasBarrierAt = (perimeterIndex: number) => {
      if (perimeterIndex < 0 || perimeterIndex > 51) return false;
      let totalCount = 0;
      currentTokens.forEach(tk => {
        if (tk.step > 0 && tk.step <= 51) {
          const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
          if (tkIdx === perimeterIndex) {
            totalCount++;
          }
        }
      });
      return totalCount >= 2;
    };

    const forcedTokens = playerTokens.filter(t => {
      const globalId = t.playerId * 4 + t.id;
      if ((barrierLifetimes[globalId] || 0) >= 4) {
         if (t.step > 0 && t.step <= 51) {
           const tkIdx = (START_OFFSETS[t.color] + t.step - 1) % 52;
           let totalCount = 0;
           currentTokens.forEach(tk => {
             if (tk.step > 0 && tk.step <= 51) {
               const tkIdx2 = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
               if (tkIdx2 === tkIdx) totalCount++;
             }
           });
           return totalCount >= 2;
         }
      }
      return false;
    }).map(t => t.playerId * 4 + t.id);

    playerTokens.forEach((t) => {
      const globalId = t.playerId * 4 + t.id;
      if (t.step === 0) {
        if (hasFive || hasSumFive) {
          const startIdx = START_OFFSETS[t.color];
          if (!hasBarrierAt(startIdx)) {
            playableIds.push(globalId);
          }
        }
      } else if (t.step > 0 && t.step < 57) {
        // Can it move by ANY of the individual moves?
        let canMove = false;
        for (const m of moves) {
            const distanceToGoal = 57 - t.step;
            if (m > distanceToGoal) continue;
            let blocked = false;
            const stepsToCheck = Math.min(m, distanceToGoal);
            for (let stepOffset = 1; stepOffset <= stepsToCheck; stepOffset++) {
              const pathStep = t.step + stepOffset;
              if (pathStep <= 51) {
                const pIndex = (START_OFFSETS[t.color] + pathStep - 1) % 52;
                if (hasBarrierAt(pIndex)) {
                  blocked = true;
                  break;
                }
              }
            }
            if (!blocked) {
              canMove = true;
              break;
            }
        }
        if (canMove) {
          playableIds.push(globalId);
        }
      }
    });

    if (forcedTokens.length > 0) {
       const playableForced = playableIds.filter(id => forcedTokens.includes(id));
       if (playableForced.length > 0) {
          return playableForced;
       }
       // If forced tokens are blocked, they can't move. They lose their turn.
       return [];
    }

    return playableIds;
  };

  // Playable token IDs for the active player on their turn
  const playableTokenIds = hasRolled && !isRolling && !isAnimatingMove && activePlayer
    ? getPlayableTokenIds(currentTurn, remainingMoves)
    : [];

  // Vibration sync for human turn
  useEffect(() => {
    // Clear any existing interval
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }

    if (isPlaying && activePlayer && activePlayer.type === 'human' && !hasRolled && !isRolling && !isAnimatingMove && !winner) {
      setIsGlowActive(true);
      if (!isMuted) {
        audio.playTurnAlert();
      }

      // Vibrate every 1000ms
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
  }, [currentTurn, hasRolled, isRolling, isPlaying, winner, isMuted]);

  // Handle dice rolling
  const handleRollDice = () => {
    if (isRolling || hasRolled || winner || isAnimatingMove) return;

    // Turn off tactile alert immediately on roll touch
    setIsGlowActive(false);
    if (vibrationIntervalRef.current) {
      clearInterval(vibrationIntervalRef.current);
      vibrationIntervalRef.current = null;
    }

    setIsRolling(true);
    if (!isMuted) {
      audio.playDiceRoll();
    }

    // Roll simulation (spinning values rapidly)
    let rollCounter = 0;
    const interval = setInterval(() => {
      setDiceValues([Math.floor(Math.random() * 6) + 1, Math.floor(Math.random() * 6) + 1]);
      rollCounter++;
      if (rollCounter > 10) {
        clearInterval(interval);
        
        // Final roll result
        const r1 = Math.floor(Math.random() * 6) + 1;
        const r2 = Math.floor(Math.random() * 6) + 1;
        const finalRoll: [number, number] = [r1, r2];
        const isDouble = r1 === r2;
        const sum = r1 + r2;

        addLog(`[DADOS] Jugador: ${activePlayer.color} | Dado 1: ${r1} | Dado 2: ${r2} | ¿Es Doble?: ${isDouble ? 'True' : 'False'}`, 'system');

        setDiceValues(finalRoll);
        setIsRolling(false);
        setHasRolled(true);

        if (isDouble) {
          pendingExtraTurnsRef.current += 1;
          addLog(`🎲 ¡${activePlayer.name} sacó un doble (${r1},${r2}) y gana un tiro extra!`, 'info', activePlayer.color);
        } else {
          addLog(`${activePlayer.name} lanzó los dados y sacó ${r1} y ${r2} (Total: ${sum}).`, 'roll', activePlayer.color);
        }

        setRemainingMoves([...finalRoll]);
        setTimer(10); // Reset timer for move selection

        // Check if there are playable moves
        const moves = getPlayableTokenIds(currentTurn, [r1, r2]);
        if (moves.length === 0) {
          addLog(`${activePlayer.name} no tiene movimientos válidos.`, 'warning', activePlayer.color);
          // Switch turn automatically after a brief delay
          noMovesTimeoutRef.current = window.setTimeout(() => {
            if (pendingExtraTurnsRef.current > 0) {
              pendingExtraTurnsRef.current -= 1;
              advanceTurn(true, tokens);
            } else {
              advanceTurn(false, tokens);
            }
          }, 1200);
        }
      }
    }, 60);
  };

  // Score possible moves for Bot AI heuristics (Smart Bot AI)
  const getBestBotMove = (pId: number, moves: number[], playableIds: number[]): { tokenId: number, moveIndices: number[], moveVal: number } | null => {
    if (playableIds.length === 0 || moves.length === 0) return null;

    const difficulty = config?.botDifficulty || 'medium';
    let bestMove: { tokenId: number, moveIndices: number[], moveVal: number } | null = null;
    let highestScore = -Infinity;

    playableIds.forEach((globalId) => {
      const tokenIndex = globalId % 4;
      const token = tokens.find((t) => t.playerId === pId && t.id === tokenIndex);
      if (!token) return;

      const possibleMoves: { val: number, indices: number[] }[] = [];
      const seenVals = new Set<number>();
      moves.forEach((m, idx) => {
        if (!seenVals.has(m)) {
          possibleMoves.push({ val: m, indices: [idx] });
          seenVals.add(m);
        }
      });
      if (moves.length === 2) {
        possibleMoves.push({ val: moves[0] + moves[1], indices: [0, 1] });
      }

      possibleMoves.forEach((pm) => {
        const moveVal = pm.val;
        const moveIndices = pm.indices;

        let isValid = false;
        if (token.step === 0) {
          if (moveVal === 5) {
            const startIdx = START_OFFSETS[token.color];
            isValid = !tokens.some(tk => {
              if (tk.step > 0 && tk.step <= 51) {
                const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
                return tkIdx === startIdx && tk.color === token.color;
              }
              return false;
            });
          }
        } else if (token.step > 0 && token.step < 57) {
          const distanceToGoal = 57 - token.step;
          if (moveVal > distanceToGoal) {
            isValid = false;
          } else {
            let blocked = false;
            const stepsToCheck = Math.min(moveVal, distanceToGoal);
            for (let stepOffset = 1; stepOffset <= stepsToCheck; stepOffset++) {
              const pathStep = token.step + stepOffset;
              if (pathStep <= 51) {
                const pIndex = (START_OFFSETS[token.color] + pathStep - 1) % 52;
                const counts: Record<string, number> = {};
                tokens.forEach(tk => {
                  if (tk.step > 0 && tk.step <= 51) {
                    const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
                    if (tkIdx === pIndex) {
                      counts[tk.color] = (counts[tk.color] || 0) + 1;
                    }
                  }
                });
                if (Object.values(counts).some(count => count >= 2)) {
                  blocked = true;
                  break;
                }
              }
            }
            isValid = !blocked;
          }
        }

        if (isValid) {
          let score = 0;
          const currentStep = token.step;
          let nextStep = currentStep === 0 ? 1 : currentStep + moveVal;

          if (currentStep === 0) score += 1000;
          if (nextStep === 57) score += 300;
          score += currentStep * 5;

          const pIndex = (START_OFFSETS[token.color] + nextStep - 1) % 52;
          const isStartCell = [1, 14, 27, 40].includes(pIndex);
          const isGoldStar = [8, 21, 34, 47].includes(pIndex);
          
          if (nextStep >= 1 && nextStep <= 51 && !isGoldStar && !isStartCell) {
            const opponents = tokens.filter(
              (tk) => tk.playerId !== pId && tk.step > 0 && tk.step <= 51 &&
              ((START_OFFSETS[tk.color] + tk.step - 1) % 52) === pIndex
            );
            if (opponents.length > 0) {
              score += 500;
            }
          }

          if (difficulty === 'medium') {
            score += Math.random() * 40;
          }

          if (score > highestScore) {
            highestScore = score;
            bestMove = { tokenId: globalId, moveIndices, moveVal };
          }
        }
      });
    });

    return bestMove;
  };

  // Perform a token step-by-step move animation
  const moveToken = (tokenId: number, moveVal: number, moveIndices: number[]) => {
    if (isAnimatingMove || winner) return;

    setIsAnimatingMove(true);
    setTimer(10); // reset timer

    const tokenIndex = tokenId % 4;
    const playerIndex = Math.floor(tokenId / 4);
    const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex);

    if (!token) {
      setIsAnimatingMove(false);
      return;
    }

    const startStep = token.step;
    let currentStep = startStep;
    
    // If starting from base, calculate the correct target step.
    // If you rolled e.g. [6, 2], you use 6 to exit (step 1) and the remaining 2 moves you to step 3.
    // So the target is 1 + (rollValue - 6). But wait, what if they rolled [6, 6]? 1 + 6 = 7.
    // If rollValue is 6 exactly (e.g. [5,1] or [4,2] that sums to 6), targetStep is just 1.
    let targetStep = startStep + moveVal;
    let leftover = 0;
    if (startStep === 0) {
       targetStep = 1;
    } else if (targetStep > 57) {
       leftover = targetStep - 57;
       targetStep = 57;
    }

    // Diagnostic log
    addLog(`Moviendo ficha ${tokenIndex + 1} de ${PLAYER_NAMES[token.color]} hacia casilla ${targetStep}...`, 'move', token.color);

    // Run interval for step-by-step audio + animation
    const stepInterval = setInterval(() => {
      if (currentStep < targetStep) {
        currentStep++;
        
        // Update tokens list state
        setTokens((prev) =>
          prev.map((t) => {
            if (t.playerId === playerIndex && t.id === tokenIndex) {
              return { ...t, step: currentStep };
            }
            return t;
          })
        );

        if (!isMuted) {
          audio.playStep();
        }
      } else {
        clearInterval(stepInterval);
        
        // Step complete, check logic rules (captures, goal, win)
        handleMoveCompletion(playerIndex, tokenIndex, targetStep, moveIndices, leftover);
      }
    }, 240);
  };

  // Execute rules check on landing cell
  const handleMoveCompletion = (pId: number, tId: number, finalStep: number, moveIndices: number[], leftover: number = 0) => {
    const movingToken = tokens.find((t) => t.playerId === pId && t.id === tId);
    if (!movingToken) {
      setIsAnimatingMove(false);
      advanceTurn(false, tokens);
      return;
    }

    let extraTurnGrant = false;
    let capturedOpponents: { playerId: number, id: number }[] = [];
    let bonusSteps = 0;

    // 1. Goal Check
    if (finalStep === 57) {
      if (!isMuted) {
        audio.playGoal();
      }
      addLog(`¡Ficha ${tId + 1} de ${activePlayer.name} entró a la meta final!`, 'goal', activePlayer.color);

      const allReached = tokens
        .filter((t) => t.playerId === pId)
        .every((t) => (t.id === tId ? true : t.step === 57));

      if (allReached) {
        if (!isMuted) {
          audio.playVictory();
        }
        setWinner(pId);
        addLog(`🎉🏆 ¡Felicidades! ${activePlayer.name} ha ganado la partida! 🏆🎉`, 'system', activePlayer.color);
        
        // Award XP and Coins if the winner is human
        if (activePlayer.type === 'human') {
          setUserProfile(prev => {
            const gainedXp = 50;
            const gainedCoins = 100;
            let newXp = prev.xp + gainedXp;
            let newLevel = prev.level;
            let newXpNeeded = prev.xpNeeded;
            
            while (newXp >= newXpNeeded) {
              newXp -= newXpNeeded;
              newLevel += 1;
              newXpNeeded = Math.floor(newXpNeeded * 1.5);
            }
            
            return {
              ...prev,
              level: newLevel,
              xp: newXp,
              xpNeeded: newXpNeeded,
              coins: prev.coins + gainedCoins
            };
          });
        }
        
        setIsAnimatingMove(false);
        return;
      }
      bonusSteps += 10;
    }

    // 2. Capture Check (only on normal perimeter cells)
    if (finalStep >= 1 && finalStep <= 51) {
      const pIndex = (START_OFFSETS[movingToken.color] + finalStep - 1) % 52;
      const isStartCell = [1, 14, 27, 40].includes(pIndex);
      const isGoldStar = [8, 21, 34, 47].includes(pIndex);
      
      const landingCoord = getCellCoord(movingToken.color, finalStep);

      const opponents = tokens.filter((t) => {
        if (t.playerId === pId || t.step === 0 || t.step === 57) return false;
        const otherCoord = getCellCoord(t.color, t.step);
        return otherCoord.row === landingCoord.row && otherCoord.col === landingCoord.col;
      });

      const shouldCapture = (!isGoldStar && !isStartCell);

      if (shouldCapture && opponents.length > 0) {
        if (!isMuted) {
          audio.playCapture();
        }

        capturedOpponents = opponents.map(o => ({ playerId: o.playerId, id: o.id }));

        opponents.forEach((opp) => {
          const oppPlayer = players[opp.playerId];
          addLog(`⚔️ ¡${activePlayer.name} capturó la ficha ${opp.id + 1} de ${oppPlayer.name} y la mandó a la base!`, 'capture', activePlayer.color);
        });

        bonusSteps += 20;
      }
    }

    // Construct an up-to-date tokens array to check for remaining moves
    const updatedTokens = tokens.map(t => {
      if (t.playerId === pId && t.id === tId) {
        return { ...t, step: finalStep };
      }
      if (capturedOpponents.some(o => o.playerId === t.playerId && o.id === t.id)) {
        return { ...t, step: 0 };
      }
      return t;
    });

    // Apply tokens state update
    setTokens(updatedTokens);

    // Calculate new moves array
    const newMoves = [...remainingMoves];
    [...moveIndices].sort((a, b) => b - a).forEach(idx => newMoves.splice(idx, 1));
    
    if (leftover > 0) {
      newMoves.push(leftover);
    }

    if (bonusSteps > 0) {
      newMoves.push(bonusSteps);
      addLog(`🎁 ¡Bono de +${bonusSteps} pasos para ${activePlayer.name}!`, 'info', activePlayer.color);
    }

    if (extraTurnGrant) {
      pendingExtraTurnsRef.current += 1;
    }

    // Apply remaining moves & animation state update
    setRemainingMoves(newMoves);
    setIsAnimatingMove(false);

    if (newMoves.length === 0) {
      if (pendingExtraTurnsRef.current > 0) {
        pendingExtraTurnsRef.current -= 1;
        advanceTurn(true, updatedTokens);
      } else {
        advanceTurn(false, updatedTokens);
      }
    } else {
      const stillPlayable = getPlayableTokenIds(pId, newMoves, updatedTokens);
      if (stillPlayable.length === 0) {
        if (pendingExtraTurnsRef.current > 0) {
          pendingExtraTurnsRef.current -= 1;
          advanceTurn(true, updatedTokens);
        } else {
          advanceTurn(false, updatedTokens);
        }
      }
    }
  };

  // Logic to advance turn or grant extra roll
  const advanceTurn = (extraTurn: boolean, currentTokens = tokens) => {
    addLog(`[TURNO] Estado: ${extraTurn ? 'Turno Extra' : 'Cambio de Turno'} | Jugador: ${players[currentTurn]?.color}`, 'system');
    if (noMovesTimeoutRef.current) {
      clearTimeout(noMovesTimeoutRef.current);
      noMovesTimeoutRef.current = null;
    }
    setDiceValues(null);
    setHasRolled(false);
    setTimer(10);
    if (!extraTurn) {
    }

    if (winner !== null) return;

    if (!extraTurn) {
      setBarrierLifetimes(prev => {
        const nextLifetimes = { ...prev };
        const cellCounts: Record<number, number> = {};
        currentTokens.forEach(tk => {
          if (tk.step > 0 && tk.step <= 51) {
            const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
            cellCounts[tkIdx] = (cellCounts[tkIdx] || 0) + 1;
          }
        });
        
        currentTokens.forEach(t => {
          const globalId = t.playerId * 4 + t.id;
          if (t.step > 0 && t.step <= 51) {
            const tkIdx = (START_OFFSETS[t.color] + t.step - 1) % 52;
            if (cellCounts[tkIdx] >= 2) {
               nextLifetimes[globalId] = (nextLifetimes[globalId] || 0) + 1;
            } else {
               nextLifetimes[globalId] = 0;
            }
          } else {
            nextLifetimes[globalId] = 0;
          }
        });
        return nextLifetimes;
      });
    }

    if (extraTurn) {
      addLog(`¡${activePlayer.name} obtiene tiro adicional!`, 'system', activePlayer.color);
      triggerTurnStart();
    } else {
      moveToNextPlayer();
    }
  };

  // Find next active player
  const moveToNextPlayer = () => {
    let nextTurn = (currentTurn + 1) % 4;
    while (!players[nextTurn]?.isActive) {
      nextTurn = (nextTurn + 1) % 4;
    }
    setCurrentTurn(nextTurn);
    addLog(`Es el turno de ${players[nextTurn].name} (${PLAYER_NAMES[players[nextTurn].color]}).`, 'system', players[nextTurn].color);
  };

  // Run on turn change to initiate turn chimes or bot decisions
  const triggerTurnStart = () => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }
  };

  // 10 Second Timer Loop
  useEffect(() => {
    let interval: number | null = null;

    const shouldRunTimer = isPlaying && !winner && !isRolling && !isAnimatingMove && (!hasRolled || (hasRolled && playableTokenIds.length > 0));
    if (shouldRunTimer) {
      interval = window.setInterval(() => {
        setTimer((prev) => {
          if (prev <= 1) {
            // TIMER EXPIRED! Autoplay!
            handleAutoplay();
            return 10;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, winner, isRolling, isAnimatingMove, currentTurn, hasRolled, diceValues]);

  // Autoplay handler when timer expires or for Bots
  const handleAutoplay = () => {
    if (!activePlayer) return;

    if (!hasRolled && !isRolling) {
      // Auto roll dice
      handleRollDice();
    } else if (hasRolled && !isRolling && !isAnimatingMove) {
      if (remainingMoves.length === 0) return;
      const pTokens = getPlayableTokenIds(currentTurn, remainingMoves);
      if (pTokens.length > 0) {
        const bestMove = getBestBotMove(currentTurn, remainingMoves, pTokens);
        if (bestMove) {
          moveToken(bestMove.tokenId, bestMove.moveVal, bestMove.moveIndices);
        }
      } else {
        if (pendingExtraTurnsRef.current > 0) {
          pendingExtraTurnsRef.current -= 1;
          advanceTurn(true, tokens);
        } else {
          advanceTurn(false, tokens);
        }
      }
    }
  };

  // Trigger Bot decisions automatically on their turn
  useEffect(() => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }

    if (isPlaying && activePlayer && activePlayer.type === 'bot' && !winner && !isAnimatingMove) {
      if (!hasRolled && !isRolling) {
        // Wait 1.0s before Bot rolls the dice
        botTimeoutRef.current = window.setTimeout(() => {
          handleRollDice();
        }, 1100);
      } else if (hasRolled && !isRolling) {
        if (remainingMoves.length === 0) {
          return;
        }
        const pTokens = getPlayableTokenIds(currentTurn, remainingMoves);
        if (pTokens.length > 0) {
          const bestMove = getBestBotMove(currentTurn, remainingMoves, pTokens);
          botTimeoutRef.current = window.setTimeout(() => {
            if (bestMove) {
              moveToken(bestMove.tokenId, bestMove.moveVal, bestMove.moveIndices);
            }
          }, 900);
        } else {
          noMovesTimeoutRef.current = window.setTimeout(() => {
            if (pendingExtraTurnsRef.current > 0) {
              pendingExtraTurnsRef.current -= 1;
              advanceTurn(true, tokens);
            } else {
              advanceTurn(false, tokens);
            }
          }, 800);
        }
      }
    }
  }, [isPlaying, currentTurn, hasRolled, isRolling, isAnimatingMove, winner, remainingMoves]);

  // Handle Token Click from Board (for human player moves)
  const handleTokenClick = (tokenId: number) => {
    if (activePlayer.type !== 'human' || isAnimatingMove || isRolling || !hasRolled) return;

    if (playableTokenIds.includes(tokenId)) {
      const tokenIndex = tokenId % 4;
      const playerIndex = Math.floor(tokenId / 4);
      const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex);
      if (!token) return;

      if (token.step === 0) {
        const idx = remainingMoves.findIndex(m => m === 5);
        if (idx !== -1) {
          moveToken(tokenId, 5, [idx]);
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


  return (
    <div className={`min-h-screen bg-root text-t-primary flex flex-col relative pb-8 font-sans ${appTheme === 'sugar' ? 'theme-sugar' : ''}`}>
      {/* Upper Navigation & Sound controls */}
      <header className="w-full bg-root/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (isPlaying) {
                setIsExitModalOpen(true);
              } else {
                onExit();
              }
            }}
            className="p-1.5 -ml-2 rounded-xl text-t-muted hover:text-t-primary hover:bg-panel transition-colors cursor-pointer"
            title="Volver"
          >
            <ArrowLeft size={22} />
          </button>
          <Sparkles className="text-p-blue animate-pulse shrink-0" size={20} />
          <span className="font-extrabold text-lg text-t-primary tracking-widest font-mono uppercase">Entrenamiento con IA</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 rounded-xl text-t-muted hover:text-t-primary hover:bg-panel transition-colors cursor-pointer flex items-center justify-center border border-border"
            title={isMuted ? 'Activar sonido' : 'Silenciar juego'}
          >
            {isMuted ? <VolumeX size={18} className="text-p-red" /> : <Volume2 size={18} className="text-p-green" />}
          </button>
        </div>
      </header>

      {/* Main Core View Area */}
      <main className="grow flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6 px-4 py-6 w-full max-w-7xl mx-auto">
        {isPlaying ? (
          config && (config.playerCount === 5 || config.playerCount === 6) ? (
            <HexGameView
              playerCount={config.playerCount}
              humanColor={config.humanColor as any}
              botDifficulty={config.botDifficulty}
              onExit={() => {
                setIsPlaying(false);
                onExit();
              }}
              isMuted={isMuted}
              setIsMuted={setIsMuted}
            />
          ) : (
            <>
              {/* Left column: Interactive Game Board */}
              <div className="w-full lg:w-3/5 flex flex-col gap-4">
                <GameBoard
                  appTheme={appTheme}
                  tokens={tokens}
                  currentTurn={currentTurn}
                  playableTokenIds={playableTokenIds}
                  onTokenClick={handleTokenClick}
                  humanPlayerId={players.findIndex((p) => p.type === 'human')}
                />
              </div>

              {/* Right column: Dynamic Live Controls & Logs */}
              <div className="w-full lg:w-2/5 flex flex-col gap-4 shrink-0">
                <GameControls
                  appTheme={appTheme}
                  setAppTheme={setAppTheme}
                  isPlaying={isPlaying}
                  onStartGame={handleStartGame}
                  onRollDice={handleRollDice}
                  diceValues={diceValues}
                  remainingMoves={remainingMoves}
                  isRolling={isRolling}
                  currentTurnPlayer={activePlayer}
                  hasRolled={hasRolled}
                  timer={timer}
                  winnerPlayer={winner !== null ? players[winner] : null}
                  onResetGame={handleResetGame}
                  isHumanTurnToRoll={activePlayer?.type === 'human' && !hasRolled && !isRolling && !isAnimatingMove}
                  isGlowActive={isGlowActive}
                />

                <ConsoleLogs
                  logs={logs}
                  onClear={() => setLogs([])}
                  isOpen={isLogsOpen}
                  onToggle={() => setIsLogsOpen(!isLogsOpen)}
                  mode="game"
                />
              </div>
            </>
          )
        ) : (
          <div className="w-full flex items-center justify-center">
            <GameControls
              appTheme={appTheme}
              setAppTheme={setAppTheme}
              isPlaying={isPlaying}
              onStartGame={handleStartGame}
              onRollDice={handleRollDice}
              diceValues={diceValues}
              remainingMoves={remainingMoves}
              isRolling={isRolling}
              currentTurnPlayer={activePlayer}
              hasRolled={hasRolled}
              timer={timer}
              winnerPlayer={winner !== null ? players[winner] : null}
              onResetGame={handleResetGame}
              isHumanTurnToRoll={activePlayer?.type === 'human' && !hasRolled && !isRolling && !isAnimatingMove}
              isGlowActive={isGlowActive}
            />
          </div>
        )}
      </main>

      {/* Exit Confirmation Modal */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-panel w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-border relative animate-in zoom-in duration-200 text-center flex flex-col gap-4">
            <h2 className="text-xl font-black text-t-primary">¿Estás seguro de que deseas salir?</h2>
            <p className="text-sm text-t-muted">Si abandonas la partida actual, perderás todo tu progreso.</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => setIsExitModalOpen(false)}
                className="flex-1 py-3 rounded-xl border border-border text-t-primary hover:bg-border transition-colors font-bold"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setIsExitModalOpen(false);
                  handleResetGame();
                  setIsPlaying(false);
                }}
                className="flex-1 py-3 rounded-xl bg-p-red text-white hover:bg-red-600 transition-colors font-bold shadow-lg shadow-p-red/20"
              >
                Aceptar / Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logs Modal */}
      {isLogsModalOpen && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-lg animate-in zoom-in duration-200">
            <ConsoleLogs
              logs={logs}
              onClear={() => setLogs([])}
              isOpen={true}
              onToggle={() => setIsLogsModalOpen(false)}
              mode="debug"
            />
          </div>
        </div>
      )}

      {/* Subtle floating branding details */}
      <footer className="text-center text-xs text-t-muted/40 font-mono select-none mt-auto">
        <p>© 2026 SUGAR LUDO • ELEGANT CYBER DARK • WEB AUDIO API + REACT</p>
      </footer>

      {moveSelectorTokenId !== null && (() => {
        const tokenIndex = moveSelectorTokenId % 4;
        const playerIndex = Math.floor(moveSelectorTokenId / 4);
        const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex);
        if (!token) return null;

        const checkMoveValid = (moveVal: number) => {
          if (token.step === 0) {
            if (moveVal === 5) {
              const startIdx = START_OFFSETS[token.color];
              let totalCount = 0;
              tokens.forEach(tk => {
                if (tk.step > 0 && tk.step <= 51) {
                  const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
                  if (tkIdx === startIdx) totalCount++;
                }
              });
              return totalCount < 2;
            }
            return false;
          } else if (token.step > 0 && token.step < 57) {
            const distanceToGoal = 57 - token.step;
            if (moveVal > distanceToGoal) return false;
            let blocked = false;
            const stepsToCheck = Math.min(moveVal, distanceToGoal);
            for (let stepOffset = 1; stepOffset <= stepsToCheck; stepOffset++) {
              const pathStep = token.step + stepOffset;
              if (pathStep <= 51) {
                const pIndex = (START_OFFSETS[token.color] + pathStep - 1) % 52;
                let totalCount = 0;
                tokens.forEach(tk => {
                  if (tk.step > 0 && tk.step <= 51) {
                    const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52;
                    if (tkIdx === pIndex) {
                      totalCount++;
                    }
                  }
                });
                if (totalCount >= 2) {
                  blocked = true;
                  break;
                }
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-panel border border-border p-3 rounded-2xl shadow-xl flex flex-col gap-2 max-w-[160px] w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-t-primary font-bold text-xs text-center font-mono uppercase tracking-wider">Mover</h3>
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
                className="mt-1 text-t-muted hover:text-t-primary text-[10px] font-bold tracking-widest uppercase transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
