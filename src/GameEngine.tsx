'use client';
import { useState, useEffect, useRef } from 'react';
import { Player, Token, GameLog, GameConfig, PlayerColor, AppTheme, UserProfile } from './types';
import { GameBoard, getCellCoord, isSafeCell, START_OFFSETS } from './components/GameBoard';
import { GameControls } from './components/GameControls';
import { ConsoleLogs } from './components/ConsoleLogs';
import { audio } from './audio';
import { globalLogger } from '@/lib/logger';
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
  const [notification, setNotification] = useState<string | null>(null);

  // Audio settings
  const [audioSettings, setAudioSettings] = useState({ musicVolume: 0.25, sfxVolume: 1.0, isMuted: false });
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState<boolean>(false);
  const isMuted = audioSettings.isMuted;

  // Logs state
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [isLogsModalOpen, setIsLogsModalOpen] = useState<boolean>(false);
  const [isLogsOpen, setIsLogsOpen] = useState<boolean>(true);
  const [explosionData, setExplosionData] = useState<{ cellIndex: number, color: PlayerColor } | null>(null);
  const [isHumanAutoplay, setIsHumanAutoplay] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  // Vibration, Glow and Winner Refs
  const [isGlowActive, setIsGlowActive] = useState<boolean>(false);
  const winnerRef = useRef<number | null>(null);
  const vibrationIntervalRef = useRef<number | null>(null);
  const botTimeoutRef = useRef<number | null>(null);
  const noMovesTimeoutRef = useRef<number | null>(null);
  const pendingExtraTurnsRef = useRef<number>(0);
  const consecutiveDoublesCountRef = useRef<number>(0);
  const lastMovedTokenRef = useRef<{ playerId: number; tokenId: number } | null>(null);

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
    
    // Log globally
    const globalTypeMap: Record<string, any> = {
      system: 'SYSTEM',
      info: 'GAME-FLOW',
      roll: 'ROLL',
      capture: 'CAPTURE',
      move: 'MOVE',
      warning: 'GAME-FLOW',
      win: 'GAME-FLOW',
    };
    globalLogger.log(globalTypeMap[type] || 'GAME-FLOW', message, { playerColor });
  };

  // Setup the Ludo Game
  const handleStartGame = (gameConfig: GameConfig) => {
    setConfig(gameConfig);
    if (gameConfig.playerCount === 5 || gameConfig.playerCount === 6) {
      setIsPlaying(true);
      return;
    }

    // Pick a random human color/position from COLORS_ORDER
    const randomHumanIdx = Math.floor(Math.random() * COLORS_ORDER.length);
    const assignedHumanColor = COLORS_ORDER[randomHumanIdx];

    // Initialize players based on player count and random human color selection
    const tempPlayers: Player[] = COLORS_ORDER.map((color, idx) => {
      const isHuman = color === assignedHumanColor;
      return {
        id: idx,
        color,
        name: isHuman ? 'Tú' : `Bot ${PLAYER_NAMES[color]}`,
        type: isHuman ? 'human' : 'bot',
        isActive: false, // will set below
      };
    });

    // Determine which players are active using a pattern starting from human
    for (let i = 0; i < gameConfig.playerCount; i++) {
      const activeIdx = (randomHumanIdx + i) % 4;
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
    winnerRef.current = null;
    setWinner(null);
    setDiceValues(null);
    setHasRolled(false);
    setIsAnimatingMove(false);
    setLogs([]);

    // Turn starts with the human player
    setCurrentTurn(randomHumanIdx);
    setTimer(10);
    setIsPlaying(true);

    addLog(`¡Partida iniciada! Modo ${gameConfig.playerCount} jugadores contra Bots (${gameConfig.botDifficulty === 'hard' ? 'Inteligentes' : gameConfig.botDifficulty === 'medium' ? 'Medios' : 'Fáciles'}).`, 'system');
    addLog(`Es el turno de ${tempPlayers[randomHumanIdx].name} (${PLAYER_NAMES[assignedHumanColor]}). ¡Lanza el dado!`, 'system', tempPlayers[randomHumanIdx].color);
  };

  // Reset/Restart Game
  const handleResetGame = () => {
    setIsPlaying(false);
    setConfig(null);
    setPlayers([]);
    setTokens([]);
    winnerRef.current = null;
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

  const handleRestartGame = () => {
    if (config) {
      handleStartGame(config);
    } else {
      handleResetGame();
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
      if ((barrierLifetimes[globalId] || 0) >= 2) {
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
          let myCount = 0;
          let enemyCount = 0;
          currentTokens.forEach(tk => {
             if (tk.step > 0 && tk.step <= 51 && ((START_OFFSETS[tk.color] + tk.step - 1) % 52) === startIdx) {
                if (tk.color === t.color) myCount++;
                else enemyCount++;
             }
          });
          const isExpellable = (myCount === 1 && enemyCount === 1);
          const isBlocked = (myCount + enemyCount >= 2) && !isExpellable;

          if (!isBlocked) {
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
       // If forced tokens are blocked, they can't move. Fallback to normal moves
       return playableIds;
    }

    return playableIds;
  };

  const playableTokenIds = hasRolled && !isRolling && !isAnimatingMove && activePlayer?.type === 'human'
    ? getPlayableTokenIds(currentTurn, remainingMoves)
    : [];

  // Vibration & Glow sync for human turn
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
  }, [currentTurn, hasRolled, isRolling, isPlaying, winner, isMuted, activePlayer, isAnimatingMove]);

  // Ambient Drone Music Sync
  useEffect(() => {
    // Send volume updates to audio engine
    audio.setVolumes(audioSettings.musicVolume, audioSettings.sfxVolume, audioSettings.isMuted);

    if (isPlaying) {
      audio.playBackgroundMusic(!audioSettings.isMuted);
    } else {
      audio.playBackgroundMusic(false);
    }
    
    return () => {
      audio.playBackgroundMusic(false);
    }
  }, [audioSettings, isPlaying]);

  // Handle dice rolling
  const handleRollDice = () => {
    if (isRolling || hasRolled || winner || winnerRef.current !== null || isAnimatingMove) return;

    // Turn off tactile alert immediately on roll touch
    setIsGlowActive(false);
    audio.stopTurnAlertLoop();
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
          consecutiveDoublesCountRef.current += 1;
          
          if (consecutiveDoublesCountRef.current >= 3) {
            consecutiveDoublesCountRef.current = 0;
            pendingExtraTurnsRef.current = 0;
            
            let newTokens = [...tokens];
            if (lastMovedTokenRef.current && lastMovedTokenRef.current.playerId === activePlayer.id) {
              const lastId = lastMovedTokenRef.current.tokenId;
              const lastToken = tokens.find(t => t.playerId === activePlayer.id && t.id === lastId);
              
              if (lastToken && lastToken.step > 0 && lastToken.step < 57) {
                const cellIndex = (START_OFFSETS[lastToken.color] + lastToken.step - 1) % 52;
                setExplosionData({ cellIndex, color: activePlayer.color });
                setTimeout(() => setExplosionData(null), 3500);
                if (!isMuted) audio.playFireworks();
              }

              newTokens = newTokens.map(t => {
                if (t.playerId === activePlayer.id && t.id === lastId && t.step > 0 && t.step < 57) {
                  return { ...t, step: 0 };
                }
                return t;
              });
            }
            
            setTokens(newTokens);
            addLog(`🚨 ¡Tercer doble consecutivo! Tu última ficha regresa a la base.`, 'warning', activePlayer.color);
            showToast('🚨 ¡Tercer doble! Ficha a la base.');
            
            setRemainingMoves([]);
            setTimeout(() => advanceTurn(false, newTokens), 1500);
            return;
          }

          pendingExtraTurnsRef.current += 1;
          addLog(`🎲 ¡${activePlayer.name} sacó un doble (${r1},${r2}) y gana un tiro extra!`, 'info', activePlayer.color);
          showToast('🎲 ¡Turno Extra por Doble!');
        } else {
          consecutiveDoublesCountRef.current = 0;
          addLog(`${activePlayer.name} lanzó los dados y sacó ${r1} y ${r2} (Total: ${sum}).`, 'roll', activePlayer.color);
        }

        setRemainingMoves([...finalRoll]);
        setTimer(10); // Reset timer for move selection

        // Check if there are playable moves
        const moves = getPlayableTokenIds(currentTurn, [r1, r2]);
        if (moves.length === 0) {
          addLog(`${activePlayer.name} no tiene movimientos válidos.`, 'info', activePlayer.color);
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

      // Allow combined sum of 5 exclusively to exit from base (solves bot freezing on 1,4 or 2,3)
      if (token.step === 0 && moves.length === 2 && (moves[0] + moves[1] === 5)) {
        possibleMoves.push({ val: 5, indices: [0, 1] });
      }

      possibleMoves.forEach((pm) => {
        const moveVal = pm.val;
        const moveIndices = pm.indices;

        let isValid = false;
        if (token.step === 0) {
          if (moveVal === 5) {
            const startIdx = START_OFFSETS[token.color];
            let myCount = 0;
            let enemyCount = 0;
            tokens.forEach(tk => {
               if (tk.step > 0 && tk.step <= 51 && ((START_OFFSETS[tk.color] + tk.step - 1) % 52) === startIdx) {
                  if (tk.color === token.color) myCount++;
                  else enemyCount++;
               }
            });
            const isExpellable = (myCount === 1 && enemyCount === 1);
            const isBlocked = (myCount + enemyCount >= 2) && !isExpellable;
            isValid = !isBlocked;
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
    if (isAnimatingMove || winner || winnerRef.current !== null) return;

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
      if (winnerRef.current !== null) {
        clearInterval(stepInterval);
        setIsAnimatingMove(false);
        return;
      }

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
      showToast('🎉 ¡Ficha en la meta! +10 pasos de bono');

      const allReached = tokens
        .filter((t) => t.playerId === pId)
        .every((t) => (t.id === tId ? true : t.step === 57));

      if (allReached) {
        if (!isMuted) {
          audio.playVictory();
        }
        showToast(`🏁 ¡${activePlayer.name} ha llegado a la meta!`);
        
        const finishedPlayers = players.filter(p => p.hasFinished).length;
        const newRank = finishedPlayers + 1;
        
        setPlayers(prev => prev.map(p => p.id === pId ? { ...p, hasFinished: true, rank: newRank } : p));
        addLog(`🎉 ¡${activePlayer.name} ha finalizado en la posición #${newRank}!`, 'system', activePlayer.color);

        const activePlayersCount = players.filter(p => p.isActive).length;
        if (newRank >= activePlayersCount - 1) {
          setPlayers(prev => {
             let lastPlayer = prev.find(p => p.isActive && !p.hasFinished && p.id !== pId);
             return prev.map(p => {
               if (lastPlayer && p.id === lastPlayer.id) return { ...p, hasFinished: true, rank: activePlayersCount };
               if (p.id === pId) return { ...p, hasFinished: true, rank: newRank };
               return p;
             });
          });
          
          const wId = players.find(p => p.rank === 1)?.id ?? pId;
          winnerRef.current = wId;
          setWinner(wId);
          addLog(`🏁 ¡La partida ha terminado!`, 'system');
          
          if (activePlayer.type === 'human' && newRank === 1) {
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
              return { ...prev, level: newLevel, xp: newXp, xpNeeded: newXpNeeded, coins: prev.coins + gainedCoins };
            });
          }
        }
        
        // Remove remaining moves because this player is done
        setRemainingMoves([]);
        setIsAnimatingMove(false);
        advanceTurn(false, tokens);
        return;
      }
      bonusSteps += 10;
    }

    // 1.5. Expulsion Check (Moving out of base)
    if (finalStep === 1) {
      const pIndex = START_OFFSETS[movingToken.color];
      const cellTokens = tokens.filter(t => t.step > 0 && t.step <= 51 && ((START_OFFSETS[t.color] + t.step - 1) % 52) === pIndex);
      const myTokens = cellTokens.filter(t => t.color === movingToken.color);
      const enemyTokens = cellTokens.filter(t => t.color !== movingToken.color);
      
      if (myTokens.length === 1 && enemyTokens.length === 1) {
        capturedOpponents.push({ playerId: enemyTokens[0].playerId, id: enemyTokens[0].id });
        showToast('💥 ¡Ficha enemiga expulsada de la salida!');
        if (!isMuted) {
          audio.playFireworks();
        }
        setExplosionData({ cellIndex: pIndex + 1, color: enemyTokens[0].color });
        setTimeout(() => setExplosionData(null), 3500);
      }
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
          audio.playFireworks();
        }

        capturedOpponents = opponents.map(o => ({ playerId: o.playerId, id: o.id }));
        showToast(`⚔️ ¡Ficha capturada! +20 pasos de bono`);
        setExplosionData({ cellIndex: pIndex + 1, color: opponents[0].color });
        setTimeout(() => setExplosionData(null), 3500);

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
    lastMovedTokenRef.current = { playerId: pId, tokenId: tId };

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

    if (winner !== null || winnerRef.current !== null) return;

    if (!extraTurn) {
      consecutiveDoublesCountRef.current = 0;
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
               nextLifetimes[globalId] = prev[globalId] || 0;
               if (t.playerId === currentTurn) {
                 nextLifetimes[globalId] += 1;
               }
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

    const activePlayerTokens = currentTokens.filter(t => t.playerId === currentTurn);
    const hasPlayerFinished = activePlayerTokens.length === 4 && activePlayerTokens.every(t => t.step === 57);

    if (extraTurn && !hasPlayerFinished) {
      addLog(`¡${activePlayer.name} obtiene tiro adicional!`, 'system', activePlayer.color);
      triggerTurnStart();
    } else {
      moveToNextPlayer(currentTokens);
    }
  };

  // Find next active player
  const moveToNextPlayer = (currentTokens: Token[] = tokens) => {
    let nextTurn = (currentTurn - 1 + players.length) % players.length;
    
    const isPlayerFinished = (pId: number) => {
       if (players[pId]?.hasFinished) return true;
       const pTokens = currentTokens.filter(t => t.playerId === pId);
       return pTokens.length === 4 && pTokens.every(t => t.step === 57);
    };

    while (!players[nextTurn]?.isActive || isPlayerFinished(nextTurn)) {
      nextTurn = (nextTurn - 1 + players.length) % players.length;
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
    setIsHumanAutoplay(false);
  };

  // 10 Second Timer Loop
  useEffect(() => {
    let interval: number | null = null;

    const shouldRunTimer = isPlaying && !winner && !isRolling && !isAnimatingMove && !isHumanAutoplay && (!hasRolled || (hasRolled && playableTokenIds.length > 0));
    if (shouldRunTimer) {
      interval = window.setInterval(() => {
        setTimer((prev) => {
          return prev <= 1 ? 0 : prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, winner, isRolling, isAnimatingMove, currentTurn, hasRolled, diceValues, playableTokenIds.length, isHumanAutoplay]);

  useEffect(() => {
    if (timer === 0 && isPlaying && !winner) {
      setIsHumanAutoplay(true);
      setTimer(10);
    }
  }, [timer, isPlaying, winner]);

  // Continuous Turn Alert Sound for Human Player
  useEffect(() => {
    const isHumanTurnToRoll = isPlaying && activePlayer && activePlayer.type === 'human' && !isHumanAutoplay && !hasRolled && !isRolling && winner === null;
    if (isHumanTurnToRoll && !isMuted) {
      audio.startTurnAlertLoop();
    } else {
      audio.stopTurnAlertLoop();
    }
    return () => {
      audio.stopTurnAlertLoop();
    };
  }, [isPlaying, activePlayer, isHumanAutoplay, hasRolled, isRolling, winner, isMuted]);

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

  // Trigger Bot/Autoplay decisions automatically on their turn
  useEffect(() => {
    if (botTimeoutRef.current) {
      clearTimeout(botTimeoutRef.current);
      botTimeoutRef.current = null;
    }

    const isActiveBot = activePlayer && (activePlayer.type === 'bot' || (activePlayer.type === 'human' && isHumanAutoplay));
    if (isPlaying && isActiveBot && !winner && winnerRef.current === null && !isAnimatingMove) {
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
        }
      }
    }
  }, [isPlaying, currentTurn, hasRolled, isRolling, isAnimatingMove, winner, remainingMoves, isHumanAutoplay]);

  // Handle Token Click from Board (for human player moves)
  const handleTokenClick = (tokenId: number) => {
    setIsHumanAutoplay(false); // Wake up human player
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
    <div className={`min-h-screen w-full flex flex-col font-sans cyber-bg ${appTheme === 'sugar' ? 'theme-sugar' : ''}`}>
      {/* Upper Navigation & Sound controls */}
      <header className="w-full bg-root/80 backdrop-blur-md border-b border-[var(--panel-header-border,oklch(0.82_0.15_200/0.2))] px-4 py-3 flex items-center justify-between sticky top-0 z-50 cyber-game-panel shadow-[0_4px_30px_oklch(0.82_0.15_200/0.05)]">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              if (isPlaying) {
                setIsExitModalOpen(true);
              } else {
                onExit();
              }
            }}
            className="p-1.5 -ml-2 rounded-xl text-t-muted hover:text-[var(--candy-cyan,oklch(0.82_0.15_200))] hover:bg-[var(--candy-cyan,oklch(0.82_0.15_200))/0.1] transition-colors cursor-pointer"
            title="Volver"
          >
            <ArrowLeft size={22} />
          </button>
          <Sparkles className="text-[var(--candy-magenta,oklch(0.7_0.27_350))] animate-pulse shrink-0 drop-shadow-[0_0_8px_var(--candy-magenta,oklch(0.7_0.27_350))]" size={20} />
          <span className="font-extrabold text-lg text-t-primary tracking-widest font-mono uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Entrenamiento con IA</span>
        </div>

        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
            className={`p-2 rounded-xl text-t-muted hover:text-t-primary hover:bg-panel transition-colors cursor-pointer flex items-center justify-center border ${isAudioMenuOpen ? 'border-p-cyan bg-panel' : 'border-border'}`}
            title="Ajustes de Sonido"
          >
            {isMuted ? <VolumeX size={18} className="text-p-red" /> : <Volume2 size={18} className="text-p-green" />}
          </button>
          
          {/* Audio Popover */}
          {isAudioMenuOpen && (
            <div className="absolute top-12 right-0 w-64 bg-surface border border-border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 z-50 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-t-primary">Mezcla de Audio</span>
                <button
                  onClick={() => setAudioSettings(s => ({ ...s, isMuted: !s.isMuted }))}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${isMuted ? 'bg-p-red/20 text-p-red border-p-red/50' : 'bg-surface text-t-muted border-border hover:bg-panel'}`}
                >
                  {isMuted ? 'MUTEADO' : 'MUTEAR'}
                </button>
              </div>
              
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-t-muted">
                    <span>Música (Tam Lin)</span>
                    <span>{Math.round(audioSettings.musicVolume * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    value={audioSettings.musicVolume}
                    onChange={(e) => setAudioSettings(s => ({ ...s, musicVolume: parseFloat(e.target.value) }))}
                    disabled={isMuted}
                    className="w-full accent-p-cyan cursor-pointer disabled:opacity-50"
                  />
                </div>
                
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-t-muted">
                    <span>Efectos SFX</span>
                    <span>{Math.round(audioSettings.sfxVolume * 100)}%</span>
                  </div>
                  <input 
                    type="range" min="0" max="1" step="0.05" 
                    value={audioSettings.sfxVolume}
                    onChange={(e) => setAudioSettings(s => ({ ...s, sfxVolume: parseFloat(e.target.value) }))}
                    disabled={isMuted}
                    className="w-full accent-p-green cursor-pointer disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Toast Banner (Floating Overlay - Zero Layout Shift) */}
      {notification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2 rounded-2xl border border-[var(--candy-cyan)]/50 bg-[#0f172a]/90 backdrop-blur-md px-6 py-3 text-[var(--candy-cyan)] font-display text-sm font-extrabold shadow-[0_8px_32px_rgba(0,0,0,0.6)] pointer-events-none">
          <Sparkles className="size-4 text-[var(--candy-cyan)]" />
          <span>{notification}</span>
        </div>
      )}

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
              appTheme={appTheme}
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
                  explosionData={explosionData}
                />
              </div>

              {/* Right column: Dynamic Live Controls & Logs */}
              <div className="w-full lg:w-2/5 flex flex-col gap-4 shrink-0">
                <GameControls
                  appTheme={appTheme}
                  setAppTheme={setAppTheme}
                  isPlaying={isPlaying}
                  onStartGame={handleStartGame}
                  onRollDice={() => { setIsHumanAutoplay(false); handleRollDice(); }}
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
        ) : null}
      </main>

      {/* Exit Confirmation Modal */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md cyber-game-panel">
          <div className="w-full max-w-sm rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-[var(--panel-border,oklch(0.7_0.27_350/0.15))] relative animate-in zoom-in duration-200 text-center flex flex-col gap-4 bg-[var(--panel-bg,oklch(0.12_0.02_285/0.85))]">
            <h2 className="text-xl font-black text-t-primary drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]">¿Estás seguro de que deseas salir?</h2>
            <p className="text-sm text-t-muted">Si abandonas la partida actual, perderás todo tu progreso.</p>
            <div className="flex items-center gap-3 mt-2">
              <button
                onClick={() => setIsExitModalOpen(false)}
                className="flex-1 py-3 rounded-2xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground transition-colors font-bold shadow-[inset_0_1px_0_oklch(1_0_0/0.15)]"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setIsExitModalOpen(false);
                  handleResetGame();
                  setIsPlaying(false);
                  onExit();
                }}
                className="flex-1 py-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.7_0.27_350),color-mix(in_oklch,oklch(0.7_0.27_350),black_12%))] text-[oklch(0.16_0.03_285)] font-extrabold shadow-[inset_0_2px_0_oklch(1_0_0/0.45),0_5px_0_oklch(0.45_0.2_350),0_10px_20px_color-mix(in_oklch,oklch(0.45_0.2_350),transparent_45%)] hover:brightness-110 active:scale-95 transition-all"
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
            <div className="bg-[oklch(0.16_0.03_285)] border border-[#06b6d4]/40 p-4 rounded-3xl shadow-2xl flex flex-col gap-3 max-w-[200px] w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-white font-extrabold text-sm text-center font-display uppercase tracking-wider">Mover Ficha</h3>
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
                className="mt-1 text-slate-400 hover:text-white text-xs font-bold tracking-widest uppercase transition-colors text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        );
      })()}

      {/* Winner Celebration Modal (Universal Offline Podium) */}
      {winner !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[oklch(0.7_0.27_350/0.3)] backdrop-blur-xl p-4 cyber-game-panel">
          <div className="bg-[var(--panel-bg,oklch(0.12_0.02_285/0.85))] max-w-md w-full rounded-3xl p-8 border border-[var(--panel-border,oklch(0.7_0.27_350/0.15))] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_60px_oklch(0.7_0.27_350/0.15)] flex flex-col items-center text-center gap-6 animate-in zoom-in duration-300">
            <Trophy className="text-[var(--candy-green,oklch(0.78_0.2_150))] animate-bounce drop-shadow-[0_0_15px_var(--candy-green,oklch(0.78_0.2_150))]" size={64} />
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--candy-magenta,oklch(0.7_0.27_350))] to-[var(--candy-cyan,oklch(0.82_0.15_200))] drop-shadow-[0_0_8px_oklch(0.7_0.27_350/0.5)] uppercase tracking-wider font-display">
              ¡Partida Finalizada!
            </h2>
            
            <div className="w-full flex flex-col gap-3 mt-2 mb-2">
              {players
                .filter(p => p.hasFinished)
                .sort((a, b) => (a.rank || 99) - (b.rank || 99))
                .map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between bg-[var(--panel-border,oklch(0.7_0.27_350/0.1))] p-3 rounded-xl border border-[var(--panel-border,oklch(0.7_0.27_350/0.2))]">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl drop-shadow-md">
                        {idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}
                      </span>
                      <span className="font-bold text-white/90 text-sm uppercase tracking-wide">
                        {idx + 1}.º LUGAR
                      </span>
                    </div>
                    <span 
                      className="font-black text-lg drop-shadow-md capitalize" 
                      style={{ color: p.color === 'yellow' ? '#facc15' : p.color === 'red' ? '#f43f5e' : p.color === 'green' ? '#4ade80' : p.color === 'blue' ? '#60a5fa' : '#fff' }}
                    >
                      {p.name}
                    </span>
                  </div>
                ))}
            </div>
            <div className="flex flex-col gap-3 w-full mt-2">
              <button
                onClick={handleRestartGame}
                className="w-full flex items-center justify-center gap-2 py-4 bg-[linear-gradient(145deg,oklch(0.78_0.2_150),color-mix(in_oklch,oklch(0.78_0.2_150),black_12%))] text-[oklch(0.18_0.03_285)] font-black rounded-2xl text-lg hover:brightness-110 active:scale-95 shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.5_0.14_155),0_10px_20px_color-mix(in_oklch,oklch(0.5_0.14_155),transparent_55%)] transition-all cursor-pointer uppercase tracking-wider font-display"
              >
                Jugar de Nuevo
              </button>
              <button
                onClick={() => {
                  handleResetGame();
                  onExit();
                }}
                className="w-full py-3.5 rounded-2xl border border-white/20 bg-[oklch(1_0_0/0.05)] text-white font-bold hover:bg-[oklch(1_0_0/0.1)] shadow-[inset_0_1px_0_oklch(1_0_0/0.15)] transition-all cursor-pointer text-sm tracking-wide uppercase"
              >
                Volver al Menú
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
