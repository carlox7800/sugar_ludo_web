'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { ArrowLeft, Volume2, VolumeX, Sparkles, AlertTriangle } from 'lucide-react'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/lib/auth-context'
import { GameBoard } from '@/src/components/GameBoard'
import { GameControls } from '@/src/components/GameControls'
import { Token, Player, PlayerColor } from '@/src/types'
import { globalLogger } from '@/lib/logger'
import { audio } from '@/src/audio'

const COLORS_ORDER: PlayerColor[] = ['yellow', 'red', 'green', 'blue', 'purple', 'orange']

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
  }>
  myPlayerId: string
}

export function OnlineGameEngine({ 
  gameData, 
  onExit 
}: { 
  gameData: OnlineGameData
  onExit: () => void 
}) {
  const { user } = useAuth()
  const socket = getSocket()

  const myPlayerId = gameData.myPlayerId || user?.uid || socket.id

  // Map server players to GameBoard Player interface
  const formattedPlayers: Player[] = useMemo(() => {
    return (gameData.players || []).map((p, idx) => {
      const isMe = p.playerId === myPlayerId || p.socketId === socket.id
      return {
        id: idx,
        name: isMe ? `${p.playerName || p.name || 'Tú'} (Tú)` : (p.playerName || p.name || `Jugador ${idx + 1}`),
        color: COLORS_ORDER[idx] || 'yellow',
        type: isMe ? 'human' : (p.isBot ? 'bot' : 'human'),
        isActive: p.isConnected !== false,
      }
    })
  }, [gameData.players, myPlayerId, socket.id])

  const defaultPlayer: Player = {
    id: 0,
    name: 'Jugador 1',
    color: 'yellow',
    type: 'human',
    isActive: true,
  }

  // Initialize 4 tokens for each active player
  const initialTokensList: Token[] = []
  formattedPlayers.forEach((p) => {
    for (let tId = 0; tId < 4; tId++) {
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
  const [hasRolled, setHasRolled] = useState(false)
  const [isAnimatingMove, setIsAnimatingMove] = useState(false)
  const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null)
  
  // Timer & UI Notifications
  const [turnTimer, setTurnTimer] = useState<number>(10)
  const [notification, setNotification] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)

  // Derived state
  const activePlayerIndex = Math.max(
    0,
    gameData.players.findIndex((p) => p.playerId === currentTurnPlayerId)
  )

  const currentTurnPlayer: Player = formattedPlayers[activePlayerIndex] || formattedPlayers[0] || defaultPlayer

  const isMyTurn = currentTurnPlayerId === myPlayerId || (
    gameData.players[activePlayerIndex]?.socketId === socket.id
  )

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
  const [rankings, setRankings] = useState<Player[]>([])

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
    let next = (currentSlot + 1) % totalPlayers
    let attempts = 0
    while (finishedPlayerIndicesRef.current.includes(next) && attempts < totalPlayers) {
      next = (next + 1) % totalPlayers
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
          if (isMyTurnRef.current && !isProcessingTimeoutRef.current) {
            isProcessingTimeoutRef.current = true
            if (!hasRolled && !isRollingRef.current) {
              globalLogger.log('GAME-FLOW', 'Tiempo agotado (Lanzar). Emitiendo intent_roll_dice.')
              handleRollDice()
            } else if (hasRolled) {
              executeRandomValidMove()
            }
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentTurnPlayerId, winnerPlayer, hasRolled, isRolling])

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

    // 3. Token Moved (with Step-by-Step animation & Rules checking)
    const handleTokenMoved = (data: { playerId: string; tokenId: number; newPathIndex: number }) => {
      globalLogger.log('SOCKET', 'Recibido event_token_moved', data)
      const serverPlayerIdx = gameData.players.findIndex((p) => p.playerId === data.playerId)
      if (serverPlayerIdx < 0) return

      const tokenIndex = data.tokenId
      const currentToken = tokensRef.current.find(
        (t) => t.playerId === serverPlayerIdx && t.id === tokenIndex
      )
      const startStep = currentToken ? currentToken.step : -1
      const targetStep = data.newPathIndex

      // Intercept Penalty return to base (-1)
      if (targetStep === -1) {
        audio.playCapture()
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
        return
      }

      const pCount = gameData.players.length
      const trackSteps = getTrackSteps(pCount)
      const goalStep = getGoalStep(pCount)
      const perimeter = getTotalPerimeter(pCount)

      // Calculate consumed move value vs visual animation steps
      let consumedVal = 0
      let animSteps = 0

      if (startStep === -1) {
        consumedVal = 5
        animSteps = 1 // Direct 1 step from Base (-1) to First Cell (0)
      } else {
        consumedVal = targetStep - startStep
        animSteps = targetStep - startStep
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
        return
      }

      setIsAnimatingMove(true)

      // Step-by-step animation loop (120ms per step)
      let iteration = 0
      const stepInterval = setInterval(() => {
        iteration += 1
        if (iteration <= animSteps) {
          const newStep = startStep === -1 ? 0 : startStep + iteration
          setTokens((prev) =>
            prev.map((t) =>
              t.playerId === serverPlayerIdx && t.id === tokenIndex
                ? { ...t, step: newStep }
                : t
            )
          )
        } else {
          clearInterval(stepInterval)

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
            showToast('🎉 ¡Ficha en la meta! +10 pasos de bono')
            bonusSteps += 10
          }

          // Capture Check (Perimeter cells)
          if (targetStep >= 0 && targetStep < trackSteps && currentToken) {
            const pIndex = (getStartOffset(currentToken.color, pCount) + targetStep) % perimeter
            const isStartCell = [1, 14, 27, 40, 53, 66].includes(pIndex)
            const isGoldStar = [8, 21, 34, 47, 60, 73].includes(pIndex)

            if (!isStartCell && !isGoldStar) {
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

          // Check for Player Win / Completion
          if (targetStep === goalStep) {
            const playerGoalTokens = finalTokens.filter((t) => t.playerId === serverPlayerIdx && t.step === goalStep)
            if (playerGoalTokens.length === 4 && !finishedPlayerIndicesRef.current.includes(serverPlayerIdx)) {
              finishedPlayerIndicesRef.current.push(serverPlayerIdx)
              const finishedPlayer = formattedPlayers[serverPlayerIdx]
              setRankings((prev) => [...prev, finishedPlayer])
              showToast(`🏆 ¡${finishedPlayer.name} completó todas sus fichas!`)

              const totalPlayers = gameData.players.length
              const finishedCount = finishedPlayerIndicesRef.current.length

              const isGameOver =
                (totalPlayers <= 3 && finishedCount >= 1) ||
                (totalPlayers >= 4 && finishedCount >= 3) ||
                (finishedCount >= totalPlayers - 1)

              if (isGameOver) {
                setWinnerPlayer(finishedPlayer)
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
      }, 240)
    }

    // Disconnection / Reconnection / GameOver Events
    const handlePlayerDisconnected = (data: { playerId: string }) => {
      const p = gameData.players.find((pl) => pl.playerId === data.playerId)
      showToast(`⚠️ Jugador ${p?.playerName || ''} desconectado.`)
    }

    const handlePlayerReconnected = (data: { playerId: string }) => {
      const p = gameData.players.find((pl) => pl.playerId === data.playerId)
      showToast(`✅ Jugador ${p?.playerName || ''} se reconectó.`)
    }

    const handlePlayerExpelled = () => {
      showToast(`🚨 Jugador expulsado por inactividad.`)
    }

    const handleGameOverAbandonment = (data: { winnerId: string }) => {
      const winnerIdx = gameData.players.findIndex((p) => p.playerId === data.winnerId)
      const wPlayer = formattedPlayers[winnerIdx >= 0 ? winnerIdx : 0]
      setWinnerPlayer(wPlayer)
      showToast(`🏆 ¡Partida finalizada! Ganador: ${wPlayer.name}`)
    }

    const handleStateResynced = (gameState: any) => {
      if (gameState.tokens) setTokens(gameState.tokens)
      if (gameState.currentTurn) setCurrentTurnPlayerId(gameState.currentTurn)
      showToast('🔄 Estado resincronizado.')
    }

    socket.on('event_turn_started', handleTurnStarted)
    socket.on('event_dice_result', handleDiceResult)
    socket.on('event_token_moved', handleTokenMoved)
    socket.on('event_player_disconnected', handlePlayerDisconnected)
    socket.on('event_player_reconnected', handlePlayerReconnected)
    socket.on('event_player_expelled', handlePlayerExpelled)
    socket.on('event_game_over_by_abandonment', handleGameOverAbandonment)
    socket.on('event_state_resynced', handleStateResynced)

    return () => {
      socket.off('event_turn_started', handleTurnStarted)
      socket.off('event_dice_result', handleDiceResult)
      socket.off('event_token_moved', handleTokenMoved)
      socket.off('event_player_disconnected', handlePlayerDisconnected)
      socket.off('event_player_reconnected', handlePlayerReconnected)
      socket.off('event_player_expelled', handlePlayerExpelled)
      socket.off('event_game_over_by_abandonment', handleGameOverAbandonment)
      socket.off('event_state_resynced', handleStateResynced)
    }
  }, [socket, gameData.players, formattedPlayers])

  // Roll Dice Action
  const handleRollDice = () => {
    if (!isMyTurn || hasRolled || isRolling) return
    setIsRolling(true)
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

    if (startStep === -1) {
      targetStep = 0
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
  const handleTokenClick = (tokenId: number) => {
    if (!isMyTurnRef.current || isAnimatingMoveRef.current || isRollingRef.current || !hasRolled) return
    isProcessingTimeoutRef.current = false

    if (playableTokenIds.includes(tokenId)) {
      const tokenIndex = tokenId % 4
      const playerIndex = Math.floor(tokenId / 4)
      const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex)
      if (!token) return

      if (token.step === -1) {
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
    socket.emit('intent_end_turn', {
      roomId: gameData.roomId,
      nextPlayerId: 0,
      nextTurnId: 0,
    })
    onExit()
  }

  return (
    <div className="flex min-h-screen flex-col bg-[oklch(0.12_0.03_285)] text-foreground p-3 sm:p-6 gap-4">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setIsExitModalOpen(true)}
          className="btn-3d flex items-center gap-2 rounded-2xl border border-border bg-[oklch(1_0_0/0.05)] px-4 py-2 text-sm font-bold text-foreground hover:bg-[oklch(1_0_0/0.1)]"
        >
          <ArrowLeft className="size-4" />
          <span>Salir de la Mesa</span>
        </button>

        {/* Turn Status & Timer Badge */}
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-display text-sm font-extrabold border ${
            isMyTurn 
              ? 'border-[var(--candy-cyan)] bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)] shadow-[0_0_12px_var(--candy-cyan)]' 
              : 'border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground'
          }`}>
            <span>{isMyTurn ? '¡ES TU TURNO! ⚡' : `Turno de ${currentTurnPlayer.name}`}</span>
            <span className="ml-2 font-mono text-base text-foreground">{turnTimer}s</span>
          </div>

          <button
            onClick={() => setMuted((m) => !m)}
            className="flex size-10 items-center justify-center rounded-2xl border border-border bg-[oklch(1_0_0/0.05)] text-[var(--candy-cyan)]"
          >
            {muted ? <VolumeX className="size-5" /> : <Volume2 className="size-5" />}
          </button>
        </div>
      </div>

      {/* Toast Banner (Floating Overlay - Zero Layout Shift) */}
      {notification && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2 rounded-2xl border border-[var(--candy-cyan)]/50 bg-[#0f172a]/90 backdrop-blur-md px-6 py-3 text-[var(--candy-cyan)] font-display text-sm font-extrabold shadow-[0_8px_32px_rgba(0,0,0,0.6)] pointer-events-none">
          <Sparkles className="size-4 text-[var(--candy-cyan)]" />
          <span>{notification}</span>
        </div>
      )}

      {/* Visual Game Board & Controls */}
      <main className="w-full max-w-7xl mx-auto flex flex-1 flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
        {/* Left Column: Game Board */}
        <div className="w-full lg:w-3/5 flex flex-col items-center justify-center">
          <div className="relative w-full max-w-2xl aspect-square glass rounded-3xl p-4 flex items-center justify-center">
            <GameBoard
              tokens={tokens}
              currentTurn={activePlayerIndex}
              playableTokenIds={playableTokenIds}
              onTokenClick={handleTokenClick}
              humanPlayerId={activePlayerIndex}
              appTheme="dark"
              isZeroIndexed={true}
            />
          </div>
        </div>

        {/* Right Column: Action Controls */}
        <div className="w-full lg:w-2/5 max-w-md flex flex-col gap-4 shrink-0">
          <GameControls
            isPlaying={true}
            onStartGame={() => {}}
            onRollDice={handleRollDice}
            diceValues={diceValues}
            remainingMoves={remainingMoves}
            isRolling={isRolling}
            currentTurnPlayer={currentTurnPlayer}
            hasRolled={hasRolled}
            timer={turnTimer}
            winnerPlayer={winnerPlayer}
            onResetGame={onExit}
            isHumanTurnToRoll={isMyTurn && !hasRolled && !isRolling && !isAnimatingMove}
            isGlowActive={isMyTurn && !hasRolled && !isRolling}
            appTheme="dark"
          />
        </div>
      </main>

      {/* Exit Modal */}
      {isExitModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="glass flex flex-col items-center gap-5 rounded-3xl border border-[var(--candy-magenta)] p-8 text-center max-w-sm w-full">
            <AlertTriangle className="size-14 text-[var(--candy-magenta)]" />
            <h2 className="font-display text-xl font-extrabold text-foreground">¿Abandonar la Partida?</h2>
            <p className="text-sm text-muted-foreground font-medium">Si sales ahora, el servidor te marcará como desconectado y el juego continuará sin ti.</p>
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
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[oklch(0.16_0.03_285)] border border-[var(--candy-cyan)]/40 p-4 rounded-3xl shadow-2xl flex flex-col gap-3 max-w-[200px] w-full animate-in fade-in zoom-in-95 duration-200">
              <div className="flex flex-col items-center gap-1">
                <h3 className="text-foreground font-extrabold text-sm text-center font-display uppercase tracking-wider">Mover Ficha</h3>
                <p className="text-xs text-muted-foreground font-medium">Elige el dado:</p>
              </div>
              <div className="flex flex-row flex-wrap justify-center gap-2 mt-1">
                {options.map((optVal, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setMoveSelectorTokenId(null)
                      executeMoveIntent(moveSelectorTokenId, optVal)
                    }}
                    className="w-12 h-12 bg-[var(--candy-cyan)]/15 border border-[var(--candy-cyan)] hover:bg-[var(--candy-cyan)] hover:text-black text-[var(--candy-cyan)] rounded-2xl flex items-center justify-center cursor-pointer transition-all active:scale-95 shadow-[0_0_12px_var(--candy-cyan)] font-display font-extrabold text-xl"
                  >
                    {optVal}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setMoveSelectorTokenId(null)}
                className="mt-1 text-muted-foreground hover:text-foreground text-xs font-bold tracking-widest uppercase transition-colors text-center"
              >
                Cancelar
              </button>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
