'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { ArrowLeft, Volume2, VolumeX, Sparkles, AlertTriangle, Trophy } from 'lucide-react'
import { recordMatchResult } from '@/lib/stats-service'
import confetti from 'canvas-confetti'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/lib/auth-context'
import { GameBoard } from '@/src/components/GameBoard'
import { PlayerCorner } from '@/src/components/PlayerCorner'
import { Token, Player, PlayerColor } from '@/src/types'
import { globalLogger } from '@/lib/logger'
import { audio } from '@/src/audio'
import { ECONOMY_MATRIX } from '@/components/competitive-training'

import { HexagonalLudoBoardView } from '@/src/components/HexagonalLudoBoardView'
import { HEX_COLORS_ORDER, STAR_CELLS } from '@/src/HexBoardConstants'
import { getCellIndexForToken, hasBarrierAtHex } from '@/src/HexGameEngine'

const SQUARE_COLORS_ORDER: PlayerColor[] = ['yellow', 'red', 'green', 'blue', 'purple', 'orange']

// --- NATIVE 0-INDEXED MULTI-BOARD MATH HELPERS ---
const getTrackSteps = (pCount: number): number => pCount === 6 ? 77 : 51
const getGoalStep = (pCount: number): number => pCount === 6 ? 82 : 56
const getTotalPerimeter = (pCount: number): number => pCount === 6 ? 78 : 52
const getStartOffset = (color: PlayerColor, pCount: number): number => {
  if (pCount === 6) {
    const offsets6: Record<PlayerColor, number> = { blue: 1, green: 14, red: 27, yellow: 40, purple: 53, orange: 66 }
    return offsets6[color] || 0
  }
  const offsets4: Record<PlayerColor, number> = { blue: 1, green: 14, red: 27, yellow: 40, purple: 0, orange: 0 }
  return offsets4[color] || 0
}

const buildFinalRankings = (
  finishedIndices: number[],
  allPlayers: Player[],
  allTokens: Token[],
  goalStep: number
): Player[] => {
  const finishedList = finishedIndices.map((idx) => allPlayers[idx]).filter(Boolean)
  const remainingPlayers = allPlayers.filter((p) => !finishedIndices.includes(p.id))

  remainingPlayers.sort((a, b) => {
    const aTokens = allTokens.filter((t) => t.playerId === a.id)
    const bTokens = allTokens.filter((t) => t.playerId === b.id)

    const aGoalCount = aTokens.filter((t) => t.step === goalStep).length
    const bGoalCount = bTokens.filter((t) => t.step === goalStep).length

    if (aGoalCount !== bGoalCount) {
      return bGoalCount - aGoalCount
    }

    const aProgress = aTokens.reduce((sum, t) => sum + (t.step > 0 ? t.step : 0), 0)
    const bProgress = bTokens.reduce((sum, t) => sum + (t.step > 0 ? t.step : 0), 0)
    return bProgress - aProgress
  })

  return [...finishedList, ...remainingPlayers]
}

export interface OnlineGameData {
  id?: string
  roomId: string
  players: Array<{
    playerId: string
    playerName?: string
    name?: string
    socketId?: string
    isConnected?: boolean
    isBot?: boolean
    slotIndex?: number
    photoURL?: string
    photoUrl?: string
  }>
  myPlayerId: string
}

export function OnlineGameEngine({ 
  gameData, 
  onExit,
  modeType
}: { 
  gameData: OnlineGameData
  onExit: () => void 
  modeType?: string
}) {
  const { user } = useAuth()
  const socket = getSocket()

  const myPlayerId = gameData.myPlayerId || user?.uid || socket.id

  const [dynamicPlayers, setDynamicPlayers] = useState(gameData.players || [])

  const myPlayerIndex = useMemo(() => {
    return dynamicPlayers.findIndex((p) => p.playerId === myPlayerId || p.socketId === socket.id)
  }, [dynamicPlayers, myPlayerId, socket.id])

  // Determine if it's a hex game based on player count
  const isHexGame = dynamicPlayers.length > 4
  const currentColorsOrder = isHexGame ? (HEX_COLORS_ORDER as PlayerColor[]) : SQUARE_COLORS_ORDER

  // Map server players to GameBoard Player interface
  const formattedPlayers: Player[] = useMemo(() => {
    return dynamicPlayers.map((p, idx) => {
      const isMe = p.playerId === myPlayerId || p.socketId === socket.id
      
      let rawName = p.playerName || p.name || ''
      let photo = p.photoURL || p.photoUrl
      
      if (rawName.includes('|||')) {
        const parts = rawName.split('|||')
        rawName = parts[0]
        photo = parts[1] || photo
      }
      
      const displayName = rawName || `Jugador ${idx + 1}`

      return {
        id: idx,
        name: isMe ? `${displayName} (Tú)` : displayName,
        color: currentColorsOrder[idx] || 'yellow',
        type: p.isBot ? 'bot' : 'human',
        isActive: p.isConnected !== false,
        photoURL: photo,
      }
    })
  }, [dynamicPlayers, myPlayerId, socket.id, currentColorsOrder])

  const defaultPlayer: Player = {
    id: 0,
    name: 'Jugador 1',
    color: 'yellow',
    type: 'human',
    isActive: true,
  }

  // Initialize tokens for each active player
  const initialTokensList: Token[] = []
  const tokensPerPlayer = isHexGame ? 3 : 4
  formattedPlayers.forEach((p) => {
    for (let tId = 0; tId < tokensPerPlayer; tId++) {
      initialTokensList.push({
        id: tId,
        playerId: p.id,
        color: p.color,
        step: -1, // NATIVE Base = -1
      })
    }
  })

  // Core Play State
  const [tokens, setTokens] = useState<Token[]>(initialTokensList)
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState<string>(
    gameData.players?.[0]?.playerId || ''
  )
  const [diceValues, setDiceValues] = useState<[number, number] | null>(null)
  const [remainingMoves, setRemainingMoves] = useState<number[]>([])
  const [moveSelectorTokenId, setMoveSelectorTokenId] = useState<number | null>(null)
  const [isRolling, setIsRolling] = useState(false)
  const [hasRolled, _setHasRolled] = useState(false)
  const hasRolledRef = useRef(false)
  const setHasRolled = (val: boolean) => {
    hasRolledRef.current = val
    _setHasRolled(val)
  }
  const [isAnimatingMove, setIsAnimatingMove] = useState(false)
  const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null)
  const isAnimatingRef = useRef(false)
  const isGameOverRef = useRef(false)

  // Confetti effect when winner is declared
  useEffect(() => {
    if (winnerPlayer) {
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.6 },
        zIndex: 9999
      });
    }
  }, [winnerPlayer])
  const [explosionData, setExplosionData] = useState<{ cellIndex: number; color: PlayerColor } | null>(null)
  
  // Timer & UI Notifications
  const [turnTimer, setTurnTimer] = useState<number>(10)
  const [notification, setNotification] = useState<string | null>(null)
  const [playerReactions, setPlayerReactions] = useState<Record<string, string>>({})
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false)
  const [audioSettings, setAudioSettings] = useState({
    musicVolume: 0.15,
    sfxVolume: 1.0,
    isMuted: false
  })
  const muted = audioSettings.isMuted
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)

  // Derived state
  const activePlayerIndex = Math.max(
    0,
    gameData.players.findIndex((p) => p.playerId === currentTurnPlayerId)
  )

  const currentTurnPlayer: Player = formattedPlayers[activePlayerIndex] || formattedPlayers[0] || defaultPlayer

  const isActingHost = () => {
    const firstActiveHuman = formattedPlayersRef.current.find(p => p.type !== 'bot' && p.isActive)
    return firstActiveHuman?.id === myPlayerIndex
  }

  const isBotTurn = currentTurnPlayer.type === 'bot'
  const isMyTurn = currentTurnPlayerId === myPlayerId || (isBotTurn && isActingHost())

  // Refs to prevent closure staleness and duplicate timer triggers
  const tokensRef = useRef(tokens)
  tokensRef.current = tokens

  const remainingMovesRef = useRef(remainingMoves)
  remainingMovesRef.current = remainingMoves

  const isMyTurnRef = useRef(isMyTurn)
  isMyTurnRef.current = isMyTurn

  const activePlayerIndexRef = useRef(activePlayerIndex)
  activePlayerIndexRef.current = activePlayerIndex

  const isAnimatingMoveRef = useRef(isAnimatingMove)
  isAnimatingMoveRef.current = isAnimatingMove

  const isRollingRef = useRef(isRolling)
  isRollingRef.current = isRolling

  const isProcessingTimeoutRef = useRef(false)
  const pendingExtraTurnsRef = useRef<number>(0)
  const consecutiveDoublesCountRef = useRef<number>(0)
  const lastMovedTokenGlobalIdRef = useRef<number | null>(null)
  const barrierLifetimesRef = useRef<Record<number, number>>({})
  const finishedPlayerIndicesRef = useRef<number[]>([])
  const lastProcessedMoveRef = useRef<string>('')
  const moveQueueRef = useRef<{ playerId: string; tokenId: number; newPathIndex: number }[]>([])
  const pendingMoveRef = useRef<{ data: any; timeout: NodeJS.Timeout | null }>({ data: null, timeout: null })
  // Prevenir cierre accidental de pestaña (F5 / Cierre)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '' // Requerido por Chrome para mostrar la alerta nativa
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  // Ref so socket handlers always see the latest formattedPlayers without needing it in useEffect deps
  const formattedPlayersRef = useRef<Player[]>(formattedPlayers)
  formattedPlayersRef.current = formattedPlayers
  // Ref so animation closures always read the current muted state (never stale from mount-time capture)
  const mutedRef = useRef<boolean>(muted)
  mutedRef.current = muted
  const [rankings, setRankings] = useState<Player[]>([])
  const recordedMatchRef = useRef<boolean>(false)

  const recordOnlineMatchResult = (finalRankings: Player[]) => {
    if (!user?.uid || recordedMatchRef.current) return
    recordedMatchRef.current = true

    const myIndexInRankings = finalRankings.findIndex((p) => p.id === myPlayerIndex)
    const myRank = myIndexInRankings !== -1 ? myIndexInRankings + 1 : finalRankings.length
    const totalPlayers = gameData.players.length
    const isCompetitive = modeType === 'competitive'
    const modeName = isCompetitive ? `Competitivo (${totalPlayers}J)` : `Entrenamiento Online (${totalPlayers}J)`

    let coinsEarned = 0
    if (isCompetitive) {
      const prizes = ECONOMY_MATRIX[totalPlayers]?.prizes || []
      coinsEarned = prizes[myRank - 1] || 0
    }

    const opponents = formattedPlayersRef.current
      .filter((p) => p.id !== myPlayerIndex)
      .map((p) => p.name.replace(' (Tú)', ''))

    const xpGained = myRank === 1 ? 200 : myRank === 2 ? 100 : 50

    recordMatchResult(user.uid, {
      mode: modeName,
      rank: myRank,
      totalPlayers,
      opponents,
      durationSeconds: 180,
      xpGained,
      coinsEarned,
    }).catch((e) => console.warn('Match record error:', e))
  }

  const updateBarrierLifetimes = (currentTokens: Token[] = tokensRef.current, endingPlayerIdx?: number) => {
    const nextLifetimes: Record<number, number> = { ...barrierLifetimesRef.current }
    const cellCounts: Record<number, number> = {}
    const pCount = gameData.players.length
    const trackSteps = getTrackSteps(pCount)
    const perimeter = getTotalPerimeter(pCount)

    currentTokens.forEach((tk) => {
      if (tk.step >= 0 && tk.step < trackSteps) {
        const tkIdx = (getStartOffset(tk.color, pCount) + tk.step) % perimeter
        cellCounts[tkIdx] = (cellCounts[tkIdx] || 0) + 1
      }
    })

    currentTokens.forEach((t) => {
      const globalId = t.playerId * 4 + t.id
      if (t.step >= 0 && t.step < trackSteps) {
        const tkIdx = (getStartOffset(t.color, pCount) + t.step) % perimeter
        if (cellCounts[tkIdx] >= 2) {
          nextLifetimes[globalId] = nextLifetimes[globalId] || 0
          if (endingPlayerIdx === undefined || t.playerId === endingPlayerIdx) {
            nextLifetimes[globalId] += 1
          }
        } else {
          nextLifetimes[globalId] = 0
        }
      } else {
        nextLifetimes[globalId] = 0
      }
    })
    barrierLifetimesRef.current = nextLifetimes
  }

  const getNextActiveSlot = (currentSlot: number, totalPlayers: number): number => {
    let next = (currentSlot - 1 + totalPlayers) % totalPlayers
    let attempts = 0
    while (finishedPlayerIndicesRef.current.includes(next) && attempts < totalPlayers) {
      next = (next - 1 + totalPlayers) % totalPlayers
      attempts++
    }
    return next
  }

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 4000)
  }

  // ---------------------------------------------------------------------------
  // Ludo Rules Engine Ported from GameEngine.tsx
  // ---------------------------------------------------------------------------

  // Check if a perimeter cell has 2 or more tokens (forming a barrier/bloqueo)
  const hasBarrierAt = (perimeterIndex: number, currentTokens: Token[] = tokensRef.current): boolean => {
    const pCount = gameData.players.length
    const trackSteps = getTrackSteps(pCount)
    const perimeter = getTotalPerimeter(pCount)

    if (perimeterIndex < 0 || perimeterIndex >= perimeter) return false
    let totalCount = 0
    currentTokens.forEach((tk) => {
      if (tk.step >= 0 && tk.step < trackSteps) {
        const tkIdx = (getStartOffset(tk.color, pCount) + tk.step) % perimeter
        if (tkIdx === perimeterIndex) {
          totalCount++
        }
      }
    })
    return totalCount >= 2
  }

  // Validate if a move is legal for a specific token
  const checkMoveValid = (token: Token, moveVal: number, currentTokens: Token[] = tokensRef.current): boolean => {
    const pCount = gameData.players.length
    const trackSteps = getTrackSteps(pCount)
    const goalStep = getGoalStep(pCount)
    const perimeter = getTotalPerimeter(pCount)

    if (token.step === -1) {
      if (moveVal === 5) {
        const startIdx = getStartOffset(token.color, pCount)
        return !hasBarrierAt(startIdx, currentTokens)
      }
      return false
    } else if (token.step >= 0 && token.step < goalStep) {
      const distanceToGoal = goalStep - token.step
      if (moveVal > distanceToGoal) return false
      
      let blocked = false
      const stepsToCheck = Math.min(moveVal, distanceToGoal)
      for (let stepOffset = 1; stepOffset <= stepsToCheck; stepOffset++) {
        const pathStep = token.step + stepOffset
        if (pathStep < trackSteps) {
          const pIndex = (getStartOffset(token.color, pCount) + pathStep) % perimeter
          if (hasBarrierAt(pIndex, currentTokens)) {
            blocked = true
            break
          }
        }
      }
      return !blocked
    }
    return false
  }

  // Compute all playable globalTokenIds for active player given available moves
  const getPlayableTokenIds = (
    playerIdx: number,
    moves: number[],
    currentTokens: Token[] = tokensRef.current
  ): number[] => {
    if (moves.length === 0) return []
    const playerTokens = currentTokens.filter((t) => t.playerId === playerIdx)
    const playableIds: number[] = []
    const pCount = gameData.players.length

    if (isHexGame) {
      const hasFive = moves.includes(5)
      const hasSumFive = moves.length === 2 && moves[0] + moves[1] === 5

      playerTokens.forEach((t) => {
        const globalId = t.playerId * 4 + t.id
        if (t.step < 0) {
          if (hasFive || hasSumFive) {
            const startIdx = getCellIndexForToken(t.color as any, 1)
            if (typeof startIdx === 'number') {
              let myCount = 0
              let enemyCount = 0
              currentTokens.forEach((tk) => {
                const tkIdx = getCellIndexForToken(tk.color as any, tk.step)
                if (typeof tkIdx === 'number' && tkIdx === startIdx) {
                  if (tk.color === t.color) myCount++
                  else enemyCount++
                }
              })
              const isExpellable = myCount === 1 && enemyCount === 1
              const isBlocked = myCount + enemyCount >= 2 && !isExpellable

              if (!isBlocked) {
                playableIds.push(globalId)
              }
            }
          }
        } else if (t.step > 0 && t.step < 83) {
          let canMove = false
          for (const m of moves) {
            if (t.step + m <= 83) {
              let blocked = false
              for (let stepOffset = 1; stepOffset <= m; stepOffset++) {
                const pathStep = t.step + stepOffset
                const pIndex = getCellIndexForToken(t.color as any, pathStep)
                if (typeof pIndex === 'number' && hasBarrierAtHex(pIndex, currentTokens as any)) {
                  blocked = true
                  break
                }
              }
              if (!blocked) {
                canMove = true
                break
              }
            }
          }

          if (!canMove && moves.length === 2) {
            const sum = moves[0] + moves[1]
            if (t.step + sum <= 83) {
              let blocked = false
              for (let stepOffset = 1; stepOffset <= sum; stepOffset++) {
                const pathStep = t.step + stepOffset
                const pIndex = getCellIndexForToken(t.color as any, pathStep)
                if (typeof pIndex === 'number' && hasBarrierAtHex(pIndex, currentTokens as any)) {
                  blocked = true
                  break
                }
              }
              if (!blocked) canMove = true
            }
          }

          if (canMove) {
            playableIds.push(globalId)
          }
        }
      })

      return playableIds
    }

    const trackSteps = getTrackSteps(pCount)
    const goalStep = getGoalStep(pCount)
    const perimeter = getTotalPerimeter(pCount)

    const forcedTokens = playerTokens
      .filter((t) => {
        const globalId = t.playerId * 4 + t.id
        if ((barrierLifetimesRef.current[globalId] || 0) >= 2) {
          if (t.step >= 0 && t.step < trackSteps) {
            const tkIdx = (getStartOffset(t.color, pCount) + t.step) % perimeter
            let totalCount = 0
            currentTokens.forEach((tk) => {
              if (tk.step >= 0 && tk.step < trackSteps) {
                const tkIdx2 = (getStartOffset(tk.color, pCount) + tk.step) % perimeter
                if (tkIdx2 === tkIdx) totalCount++
              }
            })
            return totalCount >= 2
          }
        }
        return false
      })
      .map((t) => t.playerId * 4 + t.id)

    playerTokens.forEach((token) => {
      const globalId = token.playerId * 4 + token.id
      if (token.step === -1) {
        const hasFive = moves.includes(5)
        const hasSumFive = moves.length === 2 && (moves[0] + moves[1] === 5)
        if (hasFive || hasSumFive) {
          const startIdx = getStartOffset(token.color, pCount)
          if (!hasBarrierAt(startIdx, currentTokens)) {
            playableIds.push(globalId)
          }
        }
      } else if (token.step >= 0 && token.step < goalStep) {
        let canMove = false
        // Check single moves
        for (const m of moves) {
          if (checkMoveValid(token, m, currentTokens)) {
            canMove = true
            break
          }
        }
        // Check sum move if 2 moves available
        if (!canMove && moves.length === 2) {
          if (checkMoveValid(token, moves[0] + moves[1], currentTokens)) {
            canMove = true
          }
        }
        if (canMove) {
          playableIds.push(globalId)
        }
      }
    })

    if (forcedTokens.length > 0) {
      const playableForced = playableIds.filter((id) => forcedTokens.includes(id))
      if (playableForced.length > 0) {
        return playableForced
      }
      return []
    }

    return playableIds
  }

  // Playable token IDs for current turn
  const playableTokenIds = (isMyTurn && hasRolled && !isRolling && !isAnimatingMove)
    ? getPlayableTokenIds(activePlayerIndex, remainingMoves, tokens)
    : []

  // Auto-pass turn if no playable moves exist after rolling
  useEffect(() => {
    if (isMyTurn && hasRolled && !isRolling && !isAnimatingMove) {
      if (playableTokenIds.length === 0 && remainingMoves.length > 0) {
        const timeout = setTimeout(() => {
          if (!isProcessingTimeoutRef.current) {
            isProcessingTimeoutRef.current = true
            globalLogger.log('GAME-FLOW', 'No hay movimientos válidos tras lanzar dados. Cediendo turno automático.')
            emitEndTurnIfNeeded([])
          }
        }, 1200)
        return () => clearTimeout(timeout)
      }
    }
  }, [isMyTurn, hasRolled, isRolling, isAnimatingMove, playableTokenIds.length, remainingMoves.length])

  // Helper to emit turn end when no valid moves remain
  const emitEndTurnIfNeeded = (nextMoves: number[], currentTokens: Token[] = tokensRef.current) => {
    const activeIdx = activePlayerIndexRef.current
    const playables = getPlayableTokenIds(activeIdx, nextMoves, currentTokens)

    if (nextMoves.length === 0 || playables.length === 0) {
      const SLOT_TO_COLOR_ID: Record<number, number> = { 0: 0, 1: 2, 2: 1, 3: 3, 4: 4, 5: 5 }
      let nextSlot = getNextActiveSlot(activeIdx, gameData.players.length)

      if (pendingExtraTurnsRef.current > 0 && !finishedPlayerIndicesRef.current.includes(activeIdx)) {
        pendingExtraTurnsRef.current -= 1
        nextSlot = activeIdx
        globalLogger.log('GAME-FLOW', `¡Turno extra! Manteniendo el turno en slot: ${nextSlot}`)
      } else {
        updateBarrierLifetimes(currentTokens, activeIdx)
      }

      const nextColorId = SLOT_TO_COLOR_ID[nextSlot] ?? 0

      isProcessingTimeoutRef.current = false
      globalLogger.log('GAME-FLOW', `Fin de movimientos/fichas válidas. Emitiendo intent_end_turn -> nextSlot: ${nextSlot}`)
      socket.emit('intent_end_turn', {
        roomId: gameData.roomId,
        nextPlayerId: nextColorId,
        nextTurnId: nextColorId,
      })
    }
  }

  // Execute a random valid move for timeout / auto-play
  const executeRandomValidMove = (
    currentMoves: number[] = remainingMovesRef.current,
    currentTokens: Token[] = tokensRef.current
  ) => {
    if (isAnimatingMoveRef.current) return
    if (!isProcessingTimeoutRef.current) return // Abort if user took back control
    
    const activeIdx = activePlayerIndexRef.current
    const playables = getPlayableTokenIds(activeIdx, currentMoves, currentTokens)

    if (playables.length > 0) {
      globalLogger.log('GAME-FLOW', 'Inactividad/Timeout: Ejecutando jugada automática aleatoria.')
      const randomGlobalId = playables[Math.floor(Math.random() * playables.length)]
      const tokenIndex = randomGlobalId % 4
      const playerIndex = Math.floor(randomGlobalId / 4)
      const token = currentTokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex)

      if (token) {
        let chosenMove = -1
        if (token.step === -1) {
          chosenMove = 5
        } else {
          for (const m of currentMoves) {
            if (checkMoveValid(token, m, currentTokens)) {
              chosenMove = m
              break
            }
          }
          if (chosenMove === -1 && currentMoves.length === 2 && checkMoveValid(token, currentMoves[0] + currentMoves[1], currentTokens)) {
            chosenMove = currentMoves[0] + currentMoves[1]
          }
        }

        if (chosenMove !== -1) {
          executeMoveIntent(randomGlobalId, chosenMove)
          return
        }
      }
    }

    globalLogger.log('GAME-FLOW', 'Inactividad: Sin jugadas válidas posibles. Cediendo turno.')
    emitEndTurnIfNeeded([], currentTokens)
  }

  // ---------------------------------------------------------------------------
  // Robust Single-Timer Effect (Prevents duplicate timeouts)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (winnerPlayer) return

    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        // Freeze timer during animations or while rolling dice
        if (isAnimatingMoveRef.current || isRollingRef.current) return prev

        if (prev <= 1) {
          const amIHost = isActingHost()
          const currentIsBot = formattedPlayersRef.current[activePlayerIndexRef.current]?.type === 'bot'
          const shouldIPlay = isMyTurnRef.current || (currentIsBot && amIHost)

          if (shouldIPlay && !isProcessingTimeoutRef.current) {
            isProcessingTimeoutRef.current = true
            if (!hasRolledRef.current && !isRollingRef.current) {
              globalLogger.log('GAME-FLOW', 'Tiempo agotado (Lanzar). Emitiendo intent_roll_dice.')
              handleRollDice()
            } else if (hasRolledRef.current) {
              executeRandomValidMove()
            }
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentTurnPlayerId, winnerPlayer])

  // ---------------------------------------------------------------------------
  // Ambient & Turn Alerts (Audio & Vibration)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    audio.setVolumes(audioSettings.musicVolume, audioSettings.sfxVolume, audioSettings.isMuted)
    if (!audioSettings.isMuted) {
      audio.playBackgroundMusic(true)
    } else {
      audio.playBackgroundMusic(false)
    }
  }, [audioSettings])

  // Master Cleanup on Unmount
  useEffect(() => {
    return () => {
      audio.stopAll()
    }
  }, [])

  useEffect(() => {
    const isHumanTurnToRoll = isMyTurn && !hasRolled && !isRolling && !isAnimatingMove && !winnerPlayer;
    if (isHumanTurnToRoll) {
      if (!muted) {
        audio.playTurnAlert()
        audio.startTurnAlertLoop()
      }
      if (navigator.vibrate) navigator.vibrate(100)
    } else {
      audio.stopTurnAlertLoop()
    }
    return () => audio.stopTurnAlertLoop()
  }, [isMyTurn, hasRolled, isRolling, isAnimatingMove, winnerPlayer, muted])

  // ---------------------------------------------------------------------------
  // Server Socket Event Listeners
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!socket) return

    // 1. Turn Started
    const handleTurnStarted = (data: { playerId: string; activePlayerId?: string }) => {
      const activeId = data.playerId || data.activePlayerId || ''
      globalLogger.log('SOCKET', 'Recibido event_turn_started', { activeId })
      
      if (activeId !== currentTurnPlayerId) {
        consecutiveDoublesCountRef.current = 0
        lastMovedTokenGlobalIdRef.current = null
      }

      setCurrentTurnPlayerId(activeId)
      setTurnTimer(10)
      setHasRolled(false)
      setDiceValues(null)
      setRemainingMoves([])
      setIsRolling(false)
      setIsAnimatingMove(false)
      setMoveSelectorTokenId(null)
      isProcessingTimeoutRef.current = false
      pendingExtraTurnsRef.current = 0
    }

    // 2. Dice Result
    const handleDiceResult = (data: { playerId: string; diceValues?: [number, number]; diceRoll1?: number; diceRoll2?: number }) => {
      const vals: [number, number] = data.diceValues || [
        data.diceRoll1 || Math.floor(Math.random() * 6) + 1,
        data.diceRoll2 || Math.floor(Math.random() * 6) + 1,
      ]

      globalLogger.log('SOCKET', 'Recibido event_dice_result', { playerId: data.playerId, vals })
      
      // Track extra turn strictly for doubles & 3rd double penalty
      let isPenalty = false
      if (vals[0] === vals[1]) {
        consecutiveDoublesCountRef.current += 1
        if (consecutiveDoublesCountRef.current >= 3) {
          isPenalty = true
          pendingExtraTurnsRef.current = 0
          consecutiveDoublesCountRef.current = 0
          showToast('🚫 Penalización por tres dobles consecutivos')
          globalLogger.log('GAME-FLOW', '¡Penalización por 3 dobles consecutivos!')
        } else {
          pendingExtraTurnsRef.current = 1
        }
      } else {
        pendingExtraTurnsRef.current = 0
        consecutiveDoublesCountRef.current = 0
      }

      setIsRolling(true)
      setTimeout(() => {
        setIsRolling(false)
        setDiceValues(vals)
        setRemainingMoves(isPenalty ? [] : [...vals])
        setHasRolled(true)
        setTurnTimer(10)
        globalLogger.log('GAME-FLOW', `Dados recibidos por ${data.playerId}: [${vals[0]}, ${vals[1]}]`)

        if (!isPenalty && vals[0] === vals[1]) {
          showToast('🎲 ¡Turno Extra por Doble!')
        }

        if (isPenalty) {
          if (isMyTurnRef.current) {
            const lastTokenId = lastMovedTokenGlobalIdRef.current
            if (lastTokenId !== null) {
              const tkIndex = lastTokenId % 4
              globalLogger.log('GAME-FLOW', `Enviando última ficha (id: ${tkIndex}) a la base por penalización 3er doble.`)
              socket.emit('intent_move_token', {
                roomId: gameData.roomId,
                playerId: myPlayerId,
                tokenId: tkIndex,
                newPathIndex: -1,
                isBotMove: false,
              })
            } else {
              emitEndTurnIfNeeded([])
            }
          }
          return
        }

        // If timeout auto-roll was triggered, chain auto-move
        if (isMyTurnRef.current && isProcessingTimeoutRef.current) {
          setTimeout(() => {
            executeRandomValidMove([...vals], tokensRef.current)
          }, 500)
        }
      }, 500)
    }

    // Move Queue to process moves sequentially without dropping network events
    const processNextQueuedMove = () => {
      if (isAnimatingMoveRef.current) return
      if (moveQueueRef.current.length === 0) return
      const nextMove = moveQueueRef.current.shift()
      if (nextMove) {
        processTokenMoved(nextMove)
      }
    }

    // 3. Token Moved (with Step-by-Step animation & Rules checking)
    const handleTokenMoved = (data: { playerId: string; tokenId: number; newPathIndex: number }) => {
      globalLogger.log('SOCKET', 'Recibido event_token_moved', data)
      moveQueueRef.current.push(data)
      processNextQueuedMove()
    }

    const processTokenMoved = (data: { playerId: string; tokenId: number; newPathIndex: number }) => {
      if (isAnimatingMoveRef.current) {
        // Re-queue if an animation is currently running
        moveQueueRef.current.unshift(data)
        return
      }

      const moveSignature = `${data.playerId}-${data.tokenId}-${data.newPathIndex}`
      if (lastProcessedMoveRef.current === moveSignature) {
        globalLogger.log('SOCKET', 'Ignorando evento duplicado exacto (prevención de sonido doble).')
        processNextQueuedMove()
        return
      }
      lastProcessedMoveRef.current = moveSignature

      const serverPlayerIdx = gameData.players.findIndex((p) => p.playerId === data.playerId)
      if (serverPlayerIdx < 0) {
        processNextQueuedMove()
        return
      }

      const tokenIndex = data.tokenId
      const currentToken = tokensRef.current.find(
        (t) => t.playerId === serverPlayerIdx && t.id === tokenIndex
      )
      let startStep = currentToken ? currentToken.step : -1
      const targetStep = data.newPathIndex

      // Intercept Penalty return to base (-1)
      if (targetStep === -1) {
        if ('playCapture' in audio) (audio as any).playCapture()
        else audio.playStep()
        setTokens((prev) =>
          prev.map((t) =>
            t.playerId === serverPlayerIdx && t.id === tokenIndex
              ? { ...t, step: -1 }
              : t
          )
        )
        if (isMyTurnRef.current) {
          emitEndTurnIfNeeded([])
        }
        setTimeout(processNextQueuedMove, 100)
        return
      }

      const pCount = gameData.players.length
      const trackSteps = getTrackSteps(pCount)
      const goalStep = getGoalStep(pCount)
      const perimeter = getTotalPerimeter(pCount)

      // Calculate consumed move value vs visual animation steps
      let consumedVal = 0
      let animSteps = 0

      if (startStep < 0) {
        consumedVal = 5
        animSteps = 1 // Direct 1 step from Base (-1) to First Cell (0 or 1)
      } else {
        const diff = targetStep - startStep
        if (diff > 25) {
          // Desync Guard: token was lagging behind due to skipped events.
          // Instantly snap token to expected start position (targetStep - 25 or expected) before animating.
          const syncedStartStep = Math.max(0, targetStep - 25)
          globalLogger.log('TOKENS', `Desfase detectado (${startStep} -> ${targetStep}). Sincronizando posición base instantáneamente a step ${syncedStartStep}.`)
          
          tokensRef.current = tokensRef.current.map((t) =>
            t.playerId === serverPlayerIdx && t.id === tokenIndex
              ? { ...t, step: syncedStartStep }
              : t
          )
          setTokens(tokensRef.current)
          startStep = syncedStartStep
          consumedVal = targetStep - syncedStartStep
          animSteps = consumedVal
        } else {
          consumedVal = diff
          animSteps = diff
        }
      }

      if (consumedVal <= 0 || animSteps <= 0) {
        // Ignora eventos duplicados o ráfagas de red si la ficha ya avanzó
        globalLogger.log('SOCKET', `Ignorando evento duplicado o no válido (consumedVal: ${consumedVal})`)
        if (isMyTurnRef.current && isProcessingTimeoutRef.current) {
          const updatedMoves = [...remainingMovesRef.current]
          if (updatedMoves.length > 0) updatedMoves.shift()
          setRemainingMoves(updatedMoves)
          setTimeout(() => {
            const playables = getPlayableTokenIds(activePlayerIndexRef.current, updatedMoves, tokensRef.current)
            if (updatedMoves.length === 0 || playables.length === 0) {
              emitEndTurnIfNeeded(updatedMoves, tokensRef.current)
            } else {
              executeRandomValidMove(updatedMoves, tokensRef.current)
            }
          }, 300)
        }
        setTimeout(processNextQueuedMove, 50)
        return
      }

      setIsAnimatingMove(true)

      // Step-by-step animation loop (recursive setTimeout avoids browser interval bunching)
      let iteration = 0
      const animateNextStep = () => {
        iteration += 1
        if (iteration <= animSteps) {
          if (!mutedRef.current) audio.playStep()
          const baseFirstCell = isHexGame ? 1 : 0
          const newStep = startStep < 0 ? baseFirstCell : startStep + iteration
          setTokens((prev) =>
            prev.map((t) =>
              t.playerId === serverPlayerIdx && t.id === tokenIndex
                ? { ...t, step: newStep }
                : t
            )
          )
          setTimeout(animateNextStep, 250)
        } else {
          // Animation finished: apply landing rules (captures & goals)
          let updatedMoves = [...remainingMovesRef.current]
          if (consumedVal > 0) {
            const idx = updatedMoves.indexOf(consumedVal)
            if (idx !== -1) {
              updatedMoves.splice(idx, 1)
            } else if (updatedMoves.reduce((a, b) => a + b, 0) === consumedVal) {
              updatedMoves = []
            } else if (updatedMoves.length > 0) {
              updatedMoves.shift()
            }
          }

          let bonusSteps = 0
          let capturedOpponents: { playerId: number; id: number }[] = []

          // Goal Check
          if (targetStep === goalStep) {
            const goalBonus = isHexGame ? 15 : 10
            showToast(`🎉 ¡Ficha en la meta! +${goalBonus} pasos de bono`)
            bonusSteps += goalBonus
            if (!mutedRef.current) audio.playGoal()
          }

          // Capture Check (Perimeter cells)
          if (currentToken) {
            if (isHexGame) {
              const targetCellIndex = getCellIndexForToken(currentToken.color as any, targetStep)
              if (typeof targetCellIndex === 'number') {
                if (targetStep === 1) {
                  const cellTokens = tokensRef.current.filter(
                    (t) => t.step > 0 && t.step <= 76 && getCellIndexForToken(t.color as any, t.step) === targetCellIndex
                  )
                  const myTokens = cellTokens.filter((t) => t.color === currentToken.color)
                  const enemyTokens = cellTokens.filter((t) => t.color !== currentToken.color)

                  if (myTokens.length === 1 && enemyTokens.length === 1) {
                    capturedOpponents = [{ playerId: enemyTokens[0].playerId, id: enemyTokens[0].id }]
                    showToast('💥 ¡Expulsión de salida! Ficha enemiga enviada a casa (+0 bonus)')
                    if (!mutedRef.current) audio.playFireworks()
                    setExplosionData({ cellIndex: targetCellIndex, color: enemyTokens[0].color })
                    setTimeout(() => setExplosionData(null), 3500)
                  }
                } else if (!STAR_CELLS.includes(targetCellIndex)) {
                  const enemyTokens = tokensRef.current.filter(
                    (t) => t.playerId !== serverPlayerIdx && t.step > 0 && t.step <= 76 && getCellIndexForToken(t.color as any, t.step) === targetCellIndex
                  )
                  if (enemyTokens.length === 1) {
                    capturedOpponents = [{ playerId: enemyTokens[0].playerId, id: enemyTokens[0].id }]
                    showToast('⚔️ ¡Ficha capturada! +25 pasos de bono')
                    bonusSteps += 25
                    if (!mutedRef.current) audio.playFireworks()
                    setExplosionData({ cellIndex: targetCellIndex, color: enemyTokens[0].color })
                    setTimeout(() => setExplosionData(null), 3500)
                  }
                }
              }
            } else if (targetStep >= 0 && targetStep < trackSteps) {
              const pIndex = (getStartOffset(currentToken.color, pCount) + targetStep) % perimeter
              const isStartCell = [1, 14, 27, 40, 53, 66].includes(pIndex)
              const isGoldStar = [8, 21, 34, 47, 60, 73].includes(pIndex)

              if (targetStep === 1) {
                const cellTokens = tokensRef.current.filter((t) => {
                  if (t.step < 0 || t.step >= trackSteps) return false
                  const oppPIndex = (getStartOffset(t.color, pCount) + t.step) % perimeter
                  return oppPIndex === pIndex
                })
                const myTokens = cellTokens.filter((t) => t.color === currentToken.color)
                const enemyTokens = cellTokens.filter((t) => t.color !== currentToken.color)

                if (myTokens.length === 1 && enemyTokens.length === 1) {
                  capturedOpponents = [{ playerId: enemyTokens[0].playerId, id: enemyTokens[0].id }]
                  showToast('💥 ¡Expulsión de salida! Ficha enemiga enviada a casa (+0 bonus)')
                  if (!mutedRef.current) audio.playFireworks()
                  setExplosionData({ cellIndex: pIndex + 1, color: enemyTokens[0].color })
                  setTimeout(() => setExplosionData(null), 3500)
                }
              } else if (!isStartCell && !isGoldStar) {
                const opponents = tokensRef.current.filter((t) => {
                  if (t.playerId === serverPlayerIdx || t.step === -1 || t.step === goalStep) return false
                  if (t.step < 0 || t.step >= trackSteps) return false
                  const oppPIndex = (getStartOffset(t.color, pCount) + t.step) % perimeter
                  return oppPIndex === pIndex
                })

                if (opponents.length > 0) {
                  capturedOpponents = opponents.map((o) => ({ playerId: o.playerId, id: o.id }))
                  showToast(`⚔️ ¡Ficha capturada! +20 pasos de bono`)
                  bonusSteps += 20
                  if (!mutedRef.current) audio.playFireworks()
                  setExplosionData({ cellIndex: pIndex + 1, color: opponents[0].color })
                  setTimeout(() => setExplosionData(null), 3500)
                }
              }
            }
          }

          // Apply captured opponents returning to base
          const finalTokens = tokensRef.current.map((t) => {
            if (t.playerId === serverPlayerIdx && t.id === tokenIndex) {
              return { ...t, step: targetStep }
            }
            if (capturedOpponents.some((o) => o.playerId === t.playerId && o.id === t.id)) {
              return { ...t, step: -1 }
            }
            return t
          })

          if (bonusSteps > 0) {
            updatedMoves.push(bonusSteps)
          }

          setTokens(finalTokens)
          setRemainingMoves(updatedMoves)
          setIsAnimatingMove(false)
          isAnimatingMoveRef.current = false
          setTimeout(processNextQueuedMove, 80)

          // Check for Player Win / Completion
          if (targetStep === goalStep) {
            const playerGoalTokens = finalTokens.filter((t) => t.playerId === serverPlayerIdx && t.step === goalStep)
            const requiredTokens = isHexGame ? 3 : 4
            if (playerGoalTokens.length === requiredTokens && !finishedPlayerIndicesRef.current.includes(serverPlayerIdx)) {
              finishedPlayerIndicesRef.current.push(serverPlayerIdx)
              const finishedPlayer = formattedPlayersRef.current[serverPlayerIdx]
              setRankings((prev) => [...prev, finishedPlayer])
              showToast(`🏆 ¡${finishedPlayer.name} completó todas sus fichas!`)

              const totalPlayers = gameData.players.length
              const finishedCount = finishedPlayerIndicesRef.current.length

              const isGameOver =
                (totalPlayers === 2 && finishedCount >= 1) ||
                (totalPlayers === 3 && finishedCount >= 2) ||
                (totalPlayers >= 4 && (finishedCount >= 3 || finishedCount >= totalPlayers - 1))

              if (isGameOver) {
                const finalRankings = buildFinalRankings(
                  finishedPlayerIndicesRef.current,
                  formattedPlayersRef.current,
                  finalTokens,
                  goalStep
                )
                setRankings(finalRankings)
                setWinnerPlayer(finishedPlayer)
                recordOnlineMatchResult(finalRankings)
                globalLogger.log('GAME-FLOW', `¡Partida finalizada! Ganadores: ${finishedPlayer.name}`)
                return
              }
            }
          }

          // Check if turn should advance or continue auto-play
          if (isMyTurnRef.current) {
            const playables = getPlayableTokenIds(activePlayerIndexRef.current, updatedMoves, finalTokens)
            if (updatedMoves.length === 0 || playables.length === 0) {
              emitEndTurnIfNeeded(updatedMoves, finalTokens)
            } else {
              setTurnTimer(10)
              if (isProcessingTimeoutRef.current) {
                // Auto-play next move recursively with 500ms visual delay
                setTimeout(() => {
                  executeRandomValidMove(updatedMoves, finalTokens)
                }, 500)
              }
            }
          }
        }
      }
      
      // Start the loop
      setTimeout(animateNextStep, 50)
    }

    // Disconnection / Reconnection / GameOver Events
    const handlePlayerDisconnected = (data: { playerId: string }) => {
      setDynamicPlayers(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(p => p.playerId === data.playerId)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], isConnected: false, isBot: true }
          let rawName = updated[idx].playerName || updated[idx].name || 'Jugador'
          if (rawName.includes('|||')) rawName = rawName.split('|||')[0]
          showToast(`🔴 ${rawName} desconectado. El servidor lo suplirá.`)
        }
        return updated
      })
    }

    const handlePlayerReconnected = (data: { playerId: string }) => {
      setDynamicPlayers(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(p => p.playerId === data.playerId)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], isConnected: true, isBot: false }
          let rawName = updated[idx].playerName || updated[idx].name || 'Jugador'
          if (rawName.includes('|||')) rawName = rawName.split('|||')[0]
          showToast(`🟢 ${rawName} se reconectó.`)
        }
        return updated
      })
    }

    const handlePlayerExpelled = (data: { playerId: string }) => {
      setDynamicPlayers(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(p => p.playerId === data.playerId)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], isConnected: false, isBot: true }
          let rawName = updated[idx].playerName || updated[idx].name || 'Jugador'
          if (rawName.includes('|||')) rawName = rawName.split('|||')[0]
          showToast(`💀 ${rawName} expulsado por inactividad.`)
        }
        return updated
      })
    }

    const handleGameOverAbandonment = (data: { winnerId: string }) => {
      const winnerIdx = gameData.players.findIndex((p) => p.playerId === data.winnerId)
      const wPlayer = formattedPlayersRef.current[winnerIdx >= 0 ? winnerIdx : 0]
      const winIdx = winnerIdx >= 0 ? winnerIdx : 0
      const finalRankings = buildFinalRankings(
        [winIdx],
        formattedPlayersRef.current,
        tokensRef.current,
        getGoalStep(gameData.players.length)
      )
      setRankings(finalRankings)
      setWinnerPlayer(wPlayer)
      recordOnlineMatchResult(finalRankings)
      showToast(`🏆 ¡Partida finalizada! Ganador: ${wPlayer.name}`)
    }

    const handleStateResynced = (gameState: any) => {
      if (gameState.tokens) setTokens(gameState.tokens)
      if (gameState.currentTurn) setCurrentTurnPlayerId(gameState.currentTurn)
      showToast('🔄 Estado resincronizado.')
    }

    const handleEventChat = (data: { playerId?: string; senderId?: string; message?: string; text?: string }) => {
      const senderId = data.playerId || data.senderId || ''
      const msg = data.message || data.text || ''
      if (!msg) return

      // Translate senderId (UUID/socketId/slotIndex) to seat index (0..5)
      let targetSeatIndex = -1
      if (senderId) {
        targetSeatIndex = (gameData.players || []).findIndex(
          (p) => p.playerId === senderId || p.socketId === senderId || String(p.slotIndex) === String(senderId)
        )
      }

      if (targetSeatIndex === -1 && !isNaN(Number(senderId))) {
        targetSeatIndex = Number(senderId)
      }

      if (targetSeatIndex < 0) return

      setPlayerReactions((prev) => ({ ...prev, [targetSeatIndex]: msg }))
      setTimeout(() => {
        setPlayerReactions((prev) => {
          const newState = { ...prev }
          if (newState[targetSeatIndex] === msg) {
             delete newState[targetSeatIndex]
          }
          return newState
        })
      }, 3500)
    }

    socket.on('event_turn_started', handleTurnStarted)
    socket.on('event_dice_result', handleDiceResult)
    socket.on('event_token_moved', handleTokenMoved)
    socket.on('event_player_disconnected', handlePlayerDisconnected)
    socket.on('event_player_reconnected', handlePlayerReconnected)
    socket.on('event_player_expelled', handlePlayerExpelled)
    socket.on('event_game_over_by_abandonment', handleGameOverAbandonment)
    socket.on('event_state_resynced', handleStateResynced)
    socket.on('event_chat', handleEventChat)
    socket.on('player_reaction', handleEventChat)

    return () => {
      socket.off('event_turn_started', handleTurnStarted)
      socket.off('event_dice_result', handleDiceResult)
      socket.off('event_token_moved', handleTokenMoved)
      socket.off('event_player_disconnected', handlePlayerDisconnected)
      socket.off('event_player_reconnected', handlePlayerReconnected)
      socket.off('event_player_expelled', handlePlayerExpelled)
      socket.off('event_game_over_by_abandonment', handleGameOverAbandonment)
      socket.off('event_state_resynced', handleStateResynced)
      socket.off('event_chat', handleEventChat)
      socket.off('player_reaction', handleEventChat)
    }
  }, [])

  // Send Chat / Emoji Reaction Intent to Backend
  const handleSendReaction = (message: string) => {
    if (!socket || !gameData?.roomId) return
    const playerName = user?.nickname || 'Jugador'
    socket.emit('intent_chat', {
      roomId: gameData.roomId,
      playerId: myPlayerId,
      playerName,
      message,
    })

    // Optimistic local update using myPlayerIndex (seat number)
    const targetSeat = myPlayerIndex >= 0 ? myPlayerIndex : 0
    setPlayerReactions((prev) => ({ ...prev, [targetSeat]: message }))
    setTimeout(() => {
      setPlayerReactions((prev) => {
        const newState = { ...prev }
        if (newState[targetSeat] === message) {
          delete newState[targetSeat]
        }
        return newState
      })
    }, 3500)
  }

  // Roll Dice Action
  const handleRollDice = () => {
    if (!isMyTurnRef.current || hasRolledRef.current || isRollingRef.current || isAnimatingMoveRef.current) return
    setIsRolling(true)
    isRollingRef.current = true
    if (!muted) audio.playDiceRoll()
    globalLogger.log('SOCKET', 'Emitiendo intent_roll_dice', { roomId: gameData.roomId, playerId: myPlayerId })
    socket.emit('intent_roll_dice', {
      roomId: gameData.roomId,
      playerId: myPlayerId,
    })
  }

  // Execute single validated move intent
  const executeMoveIntent = (tokenId: number, moveVal: number) => {
    const tokenIndex = tokenId % 4
    const playerIndex = Math.floor(tokenId / 4)
    const token = tokensRef.current.find((t) => t.playerId === playerIndex && t.id === tokenIndex)
    if (!token) return

    const startStep = token.step
    let targetStep = startStep + moveVal
    const pCount = gameData.players.length
    const goalStep = getGoalStep(pCount)

    if (startStep < 0) {
      targetStep = isHexGame ? 1 : 0
    } else if (targetStep > goalStep) {
      targetStep = goalStep
    }

    globalLogger.log('TOKENS', `Ejecutando movimiento: Ficha ${tokenIndex} hacia step ${targetStep} con valor ${moveVal}`)
    globalLogger.log('SOCKET', 'Emitiendo intent_move_token', { tokenId: tokenIndex, newPathIndex: targetStep })

    lastMovedTokenGlobalIdRef.current = playerIndex * 4 + tokenIndex

    socket.emit('intent_move_token', {
      roomId: gameData.roomId,
      playerId: myPlayerId,
      tokenId: tokenIndex,
      newPathIndex: targetStep,
      isBotMove: false,
    })
  }

  // Handle Token Click from Board (with Dice Choice Modal detection)
  const handleTokenClick = (rawTokenId: number) => {
    if (!isMyTurnRef.current || isAnimatingMoveRef.current || isRollingRef.current || !hasRolled) return
    isProcessingTimeoutRef.current = false

    let tokenId = rawTokenId
    if (isHexGame && rawTokenId < 4) {
      tokenId = activePlayerIndex * 4 + rawTokenId
    }

    if (playableTokenIds.includes(tokenId)) {
      const tokenIndex = tokenId % 4
      const playerIndex = Math.floor(tokenId / 4)
      const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex)
      if (!token) return

      if (token.step < 0) {
        // Base exit
        if (remainingMoves.includes(5)) {
          executeMoveIntent(tokenId, 5)
        } else if (remainingMoves.length === 2 && remainingMoves[0] + remainingMoves[1] === 5) {
          executeMoveIntent(tokenId, 5)
        }
      } else {
        // Track movement: check options
        const validOptions: number[] = []
        const seenVals = new Set<number>()

        remainingMoves.forEach((m) => {
          if (!seenVals.has(m) && checkMoveValid(token, m)) {
            validOptions.push(m)
            seenVals.add(m)
          }
        })

        if (remainingMoves.length === 2 && checkMoveValid(token, remainingMoves[0] + remainingMoves[1])) {
          validOptions.push(remainingMoves[0] + remainingMoves[1])
        }

        if (validOptions.length === 1) {
          executeMoveIntent(tokenId, validOptions[0])
        } else if (validOptions.length > 1) {
          setMoveSelectorTokenId(tokenId)
        }
      }
    }
  }

  const handleConfirmExit = () => {
    audio.stopAll()
    socket.emit('intent_end_turn', {
      roomId: gameData.roomId,
      nextPlayerId: 0,
      nextTurnId: 0,
    })
    onExit()
  }

  return (
    <div className="min-h-screen w-full flex flex-col font-sans cyber-bg text-foreground relative overflow-hidden items-center">
      
      {/* Upper Navigation & Sound controls */}
      <header className="w-full bg-root/80 backdrop-blur-md border-b border-[var(--panel-header-border,oklch(0.82_0.15_200/0.2))] px-4 py-3 flex items-center justify-between sticky top-0 z-50 cyber-game-panel shadow-[0_4px_30px_oklch(0.82_0.15_200/0.05)] shrink-0">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsExitModalOpen(true)}
            className="p-1.5 -ml-2 rounded-xl text-t-muted hover:text-[var(--candy-cyan,oklch(0.82_0.15_200))] hover:bg-[var(--candy-cyan,oklch(0.82_0.15_200))/0.1] transition-colors cursor-pointer"
            title="Volver"
          >
            <ArrowLeft size={22} />
          </button>
          <Sparkles className="text-[var(--candy-magenta,oklch(0.7_0.27_350))] animate-pulse shrink-0 drop-shadow-[0_0_8px_var(--candy-magenta,oklch(0.7_0.27_350))]" size={20} />
          <span className="font-extrabold text-lg text-t-primary tracking-widest font-mono uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{modeType === 'competitive' ? 'Modo Competitivo' : 'Entrenamiento Online'}</span>
        </div>

        <div className="flex items-center gap-3 relative">
          <button
            onClick={() => setIsAudioMenuOpen(!isAudioMenuOpen)}
            className={`p-2 rounded-xl text-t-muted hover:text-t-primary hover:bg-panel transition-colors cursor-pointer flex items-center justify-center border ${isAudioMenuOpen ? 'border-p-cyan bg-panel' : 'border-border'}`}
            title="Ajustes de Sonido"
          >
            {muted ? <VolumeX size={18} className="text-p-red" /> : <Volume2 size={18} className="text-p-green" />}
          </button>
          
          {/* Audio Popover */}
          {isAudioMenuOpen && (
            <div className="absolute top-12 right-0 w-64 bg-surface border border-border rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 z-50 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-t-primary">Mezcla de Audio</span>
                <button
                  onClick={() => setAudioSettings(s => ({ ...s, isMuted: !s.isMuted }))}
                  className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors ${muted ? 'bg-p-red/20 text-p-red border-p-red/50' : 'bg-surface text-t-muted border-border hover:bg-panel'}`}
                >
                  {muted ? 'MUTEADO' : 'MUTEAR'}
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
                    disabled={muted}
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
                    disabled={muted}
                    className="w-full accent-p-green cursor-pointer disabled:opacity-50"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Game Stage */}
      <div className="relative w-full flex-1 flex flex-col items-center justify-center min-h-[600px] z-10">
        
        {/* Center Game Board */}
        <div 
          className="z-10 w-full mx-auto flex items-center justify-center"
          style={{ maxWidth: 'min(700px, calc((100vh - 220px) * 1.05))' }}
        >
          <div className="relative mx-auto w-full">
            {isHexGame ? (
              <HexagonalLudoBoardView
                players={formattedPlayers as any}
                tokens={tokens as any}
                currentTurnIndex={activePlayerIndex}
                playableTokenIds={playableTokenIds}
                humanPlayerId={myPlayerIndex}
                onTokenClick={handleTokenClick}
                explosionData={explosionData}
                appTheme="classic"
              />
            ) : (
              <GameBoard
                tokens={tokens}
                currentTurn={activePlayerIndex}
                playableTokenIds={playableTokenIds}
                onTokenClick={handleTokenClick}
                humanPlayerId={activePlayerIndex}
                appTheme="classic"
                isZeroIndexed={true}
                explosionData={explosionData}
              />
            )}
          </div>
        </div>

        {/* Corners with PlayerCorners */}
        {(() => {
          const activePlayers = formattedPlayers;
          const baseIdx = myPlayerIndex >= 0 ? myPlayerIndex : 0;

          return activePlayers.map((p, index) => {
            const offset = (index - baseIdx + activePlayers.length) % activePlayers.length;
            let pos: 'bottom-left' | 'bottom-right' | 'top-right' | 'top-left' | 'mid-left' | 'mid-right' = 'bottom-left';

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
              const positions: any[] = ['bottom-left', 'bottom-right', 'top-left'];
              pos = positions[offset];
            } else if (activePlayers.length === 2) {
              const positions: any[] = ['bottom-left', 'top-right'];
              pos = positions[offset];
            }

            const isActiveTurn = activePlayerIndex === p.id;
            const isHumanTurnToRoll = isActiveTurn && isMyTurn && !hasRolled && !isRolling && !isAnimatingMove;
            const isLocalUser = p.id === (myPlayerIndex >= 0 ? myPlayerIndex : 0);

            return (
              <PlayerCorner
                key={p.id}
                player={p as any}
                position={pos}
                isActiveTurn={isActiveTurn}
                isHumanTurnToRoll={isHumanTurnToRoll}
                isRolling={isRolling && isActiveTurn}
                hasRolled={hasRolled && isActiveTurn}
                diceValues={isActiveTurn ? diceValues : null}
                remainingMoves={isActiveTurn ? remainingMoves : []}
                onRollDice={handleRollDice}
                timer={isActiveTurn ? turnTimer : 0}
                onSendReaction={isLocalUser ? handleSendReaction : undefined}
                reactionMessage={playerReactions[p.id]}
                isLocalUser={isLocalUser}
              />
            );
          });
        })()}

        {/* Toast Banner (Top Floating Overlay - Zero Layout Shift) */}
        {notification && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2 rounded-2xl border border-[var(--candy-cyan)]/50 bg-[#0f172a]/90 backdrop-blur-md px-6 py-2 text-[var(--candy-cyan)] font-display text-xs md:text-sm font-extrabold shadow-[0_8px_32px_rgba(0,0,0,0.6)] pointer-events-none whitespace-nowrap">
            <Sparkles className="size-4 text-[var(--candy-cyan)] shrink-0 animate-pulse" />
            <span>{notification}</span>
          </div>
        )}
      </div>

      {/* Exit Modal */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass flex flex-col items-center gap-5 rounded-3xl border border-[var(--candy-magenta)] p-8 text-center max-w-sm w-full">
            <AlertTriangle className="size-14 text-[var(--candy-magenta)]" />
            <h2 className="font-display text-xl font-extrabold text-foreground">¿Abandonar la Partida?</h2>
            <p className="text-sm text-muted-foreground font-medium">
              {modeType === 'competitive'
                ? "Si lo hace, abandonará el juego actual y perderá todo su progreso y los fondos comprometidos en la sala."
                : "Si lo hace, abandonará el juego actual y perderá todo su progreso en la sala."}
            </p>
            <div className="flex gap-3 w-full mt-2">
              <button onClick={() => setIsExitModalOpen(false)} className="flex-1 rounded-xl bg-[oklch(1_0_0/0.1)] py-3 font-bold text-foreground hover:bg-[oklch(1_0_0/0.2)]">Seguir Jugando</button>
              <button onClick={handleConfirmExit} className="flex-1 rounded-xl bg-[var(--candy-magenta)] py-3 font-bold text-white hover:opacity-90 shadow-[0_0_15px_var(--candy-magenta)]">Salir</button>
            </div>
          </div>
        </div>
      )}

      {/* Dice Choice Modal Popover (Selector de Dados) */}
      {moveSelectorTokenId !== null && (() => {
        const tokenIndex = moveSelectorTokenId % 4
        const playerIndex = Math.floor(moveSelectorTokenId / 4)
        const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex)
        if (!token) return null

        const options: number[] = []
        const seenVals = new Set<number>()

        remainingMoves.forEach((m) => {
          if (!seenVals.has(m) && checkMoveValid(token, m)) {
            options.push(m)
            seenVals.add(m)
          }
        })

        if (remainingMoves.length === 2) {
          const sum = remainingMoves[0] + remainingMoves[1]
          if (checkMoveValid(token, sum)) {
            options.push(sum)
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
                {options.map((optVal, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setMoveSelectorTokenId(null)
                      executeMoveIntent(moveSelectorTokenId, optVal)
                    }}
                    className="w-12 h-12 bg-[#06b6d4]/15 border border-[#06b6d4] hover:bg-[#06b6d4] hover:text-black text-[#06b6d4] rounded-2xl flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-[0_0_12px_#06b6d4] font-display font-extrabold text-xl"
                  >
                    {optVal}
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
        )
      })()}

      {/* Winner Celebration Modal (Universal Online Podium) */}
      {winnerPlayer !== null && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-[oklch(0.7_0.27_350/0.3)] backdrop-blur-xl p-4 cyber-game-panel">
          <div className="bg-[var(--panel-bg,oklch(0.12_0.02_285/0.85))] max-w-md w-full rounded-3xl p-8 border border-[var(--panel-border,oklch(0.7_0.27_350/0.15))] shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_0_60px_oklch(0.7_0.27_350/0.15)] flex flex-col items-center text-center gap-6 animate-in zoom-in duration-300">
            <Trophy className="text-[var(--candy-green,oklch(0.78_0.2_150))] animate-bounce drop-shadow-[0_0_15px_var(--candy-green,oklch(0.78_0.2_150))]" size={64} />
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[var(--candy-magenta,oklch(0.7_0.27_350))] to-[var(--candy-cyan,oklch(0.82_0.15_200))] drop-shadow-[0_0_8px_oklch(0.7_0.27_350/0.5)] uppercase tracking-wider font-display">
              ¡Partida Finalizada!
            </h2>
            
            <div className="w-full flex flex-col gap-3 mt-2 mb-2">
              {(() => {
                const listToDisplay = rankings.length >= formattedPlayers.length
                  ? rankings
                  : buildFinalRankings(
                      finishedPlayerIndicesRef.current,
                      formattedPlayers,
                      tokens,
                      getGoalStep(gameData.players.length)
                    );
                const pCount = gameData.players.length
                const prizeList = ECONOMY_MATRIX[pCount]?.prizes || []
                return listToDisplay.map((p, idx) => {
                  const prize = modeType === 'competitive' ? (prizeList[idx] || 0) : 0
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-[var(--panel-border,oklch(0.7_0.27_350/0.1))] p-3 rounded-xl border border-[var(--panel-border,oklch(0.7_0.27_350/0.2))]">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl drop-shadow-md">
                          {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '🎖️'}
                        </span>
                        <span className="font-bold text-white/90 text-sm uppercase tracking-wide">
                          {idx + 1}.º LUGAR
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span 
                          className="font-black text-lg drop-shadow-md capitalize" 
                          style={{ color: p.color === 'yellow' ? '#facc15' : p.color === 'red' ? '#f43f5e' : p.color === 'green' ? '#4ade80' : p.color === 'blue' ? '#60a5fa' : '#fff' }}
                        >
                          {p.name}
                        </span>
                        {prize > 0 && (
                          <span className="flex items-center gap-1 font-display text-sm font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/30 drop-shadow-[0_0_8px_rgba(52,211,153,0.3)] ml-1">
                            +{prize} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                });
              })()}
            </div>
            <div className="flex flex-col gap-3 w-full mt-2">
              <button
                onClick={() => {
                  if (socket) socket.emit('intent_leave_room', { roomId: gameData.roomId })
                  onExit()
                }}
                className="w-full py-4 bg-[linear-gradient(145deg,oklch(0.78_0.2_150),color-mix(in_oklch,oklch(0.78_0.2_150),black_12%))] text-[oklch(0.18_0.03_285)] font-black rounded-2xl text-lg hover:brightness-110 active:scale-95 shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.5_0.14_155),0_10px_20px_color-mix(in_oklch,oklch(0.5_0.14_155),transparent_55%)] transition-all cursor-pointer uppercase tracking-wider font-display"
              >
                Volver al Menú
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
