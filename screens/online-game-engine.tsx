'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Volume2, VolumeX, Sparkles, AlertTriangle } from 'lucide-react'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/lib/auth-context'
import { GameBoard, START_OFFSETS } from '@/src/components/GameBoard'
import { GameControls } from '@/src/components/GameControls'
import { Token, Player, PlayerColor } from '@/src/types'
import { globalLogger } from '@/lib/logger'

const COLORS_ORDER: PlayerColor[] = ['yellow', 'red', 'green', 'blue', 'purple', 'orange']

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
  const formattedPlayers: Player[] = (gameData.players || []).map((p, idx) => {
    const isMe = p.playerId === myPlayerId || p.socketId === socket.id
    return {
      id: idx,
      name: isMe ? `${p.playerName || p.name || 'Tú'} (Tú)` : (p.playerName || p.name || `Jugador ${idx + 1}`),
      color: COLORS_ORDER[idx] || 'yellow',
      type: isMe ? 'human' : (p.isBot ? 'bot' : 'human'),
      isActive: true,
    }
  })

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
        step: 0, // Base
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

  const isProcessingTimeoutRef = useRef(false)
  const pendingExtraTurnsRef = useRef<number>(0)
  const barrierLifetimesRef = useRef<Record<number, number>>({})
  const finishedPlayerIndicesRef = useRef<number[]>([])
  const [rankings, setRankings] = useState<Player[]>([])

  const updateBarrierLifetimes = (currentTokens: Token[] = tokensRef.current) => {
    const nextLifetimes: Record<number, number> = { ...barrierLifetimesRef.current }
    const cellCounts: Record<number, number> = {}
    currentTokens.forEach((tk) => {
      if (tk.step > 0 && tk.step <= 51) {
        const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52
        cellCounts[tkIdx] = (cellCounts[tkIdx] || 0) + 1
      }
    })

    currentTokens.forEach((t) => {
      const globalId = t.playerId * 4 + t.id
      if (t.step > 0 && t.step <= 51) {
        const tkIdx = (START_OFFSETS[t.color] + t.step - 1) % 52
        if (cellCounts[tkIdx] >= 2) {
          nextLifetimes[globalId] = (nextLifetimes[globalId] || 0) + 1
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
    if (perimeterIndex < 0 || perimeterIndex > 51) return false
    let totalCount = 0
    currentTokens.forEach((tk) => {
      if (tk.step > 0 && tk.step <= 51) {
        const tkIdx = (START_OFFSETS[tk.color] + tk.step - 1) % 52
        if (tkIdx === perimeterIndex) {
          totalCount++
        }
      }
    })
    return totalCount >= 2
  }

  // Validate if a move is legal for a specific token
  const checkMoveValid = (token: Token, moveVal: number, currentTokens: Token[] = tokensRef.current): boolean => {
    if (token.step === 0) {
      if (moveVal === 5) {
        const startIdx = START_OFFSETS[token.color]
        return !hasBarrierAt(startIdx, currentTokens)
      }
      return false
    } else if (token.step > 0 && token.step < 57) {
      const distanceToGoal = 57 - token.step
      if (moveVal > distanceToGoal) return false
      
      let blocked = false
      const stepsToCheck = Math.min(moveVal, distanceToGoal)
      for (let stepOffset = 1; stepOffset <= stepsToCheck; stepOffset++) {
        const pathStep = token.step + stepOffset
        if (pathStep <= 51) {
          const pIndex = (START_OFFSETS[token.color] + pathStep - 1) % 52
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

    const forcedTokens = playerTokens
      .filter((t) => {
        const globalId = t.playerId * 4 + t.id
        if ((barrierLifetimesRef.current[globalId] || 0) >= 4) {
          if (t.step > 0 && t.step <= 51) {
            const tkIdx = (START_OFFSETS[t.color] + t.step - 1) % 52
            let totalCount = 0
            currentTokens.forEach((tk) => {
              if (tk.step > 0 && tk.step <= 51) {
                const tkIdx2 = (START_OFFSETS[tk.color] + tk.step - 1) % 52
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
      if (token.step === 0) {
        const hasFive = moves.includes(5)
        const hasSumFive = moves.length === 2 && (moves[0] + moves[1] === 5)
        if (hasFive || hasSumFive) {
          const startIdx = START_OFFSETS[token.color]
          if (!hasBarrierAt(startIdx, currentTokens)) {
            playableIds.push(globalId)
          }
        }
      } else if (token.step > 0 && token.step < 57) {
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
        globalLogger.log('GAME-FLOW', `¡Ficha(s) forzada(s) por barrera de 4 turnos!: ${playableForced.join(', ')}`)
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
        updateBarrierLifetimes(currentTokens)
      }

      const nextColorId = SLOT_TO_COLOR_ID[nextSlot] ?? 0

      globalLogger.log('GAME-FLOW', `Fin de movimientos/fichas válidas. Emitiendo intent_end_turn -> nextSlot: ${nextSlot}`)
      socket.emit('intent_end_turn', {
        roomId: gameData.roomId,
        nextPlayerId: nextColorId,
        nextTurnId: nextColorId,
      })
    }
  }

  // ---------------------------------------------------------------------------
  // Robust Single-Timer Effect (Prevents duplicate timeouts)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (winnerPlayer) return

    isProcessingTimeoutRef.current = false
    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          if (isMyTurnRef.current && !isProcessingTimeoutRef.current) {
            isProcessingTimeoutRef.current = true
            if (!hasRolled && !isRolling) {
              globalLogger.log('GAME-FLOW', 'Tiempo agotado (Lanzar). Emitiendo intent_roll_dice.')
              handleRollDice()
            } else if (hasRolled) {
              if (playableTokenIds.length > 0) {
                globalLogger.log('GAME-FLOW', 'Tiempo agotado (Mover). Ejecutando jugada automática aleatoria.')
                const randomGlobalId = playableTokenIds[Math.floor(Math.random() * playableTokenIds.length)]
                const tokenIndex = randomGlobalId % 4
                const playerIndex = Math.floor(randomGlobalId / 4)
                const token = tokensRef.current.find((t) => t.playerId === playerIndex && t.id === tokenIndex)

                if (token) {
                  let chosenMove = -1
                  if (token.step === 0) {
                    chosenMove = 5
                  } else {
                    for (const m of remainingMovesRef.current) {
                      if (checkMoveValid(token, m)) {
                        chosenMove = m
                        break
                      }
                    }
                    if (chosenMove === -1 && remainingMovesRef.current.length === 2 && checkMoveValid(token, remainingMovesRef.current[0] + remainingMovesRef.current[1])) {
                      chosenMove = remainingMovesRef.current[0] + remainingMovesRef.current[1]
                    }
                  }

                  if (chosenMove !== -1) {
                    executeMoveIntent(randomGlobalId, chosenMove)
                  } else {
                    emitEndTurnIfNeeded([])
                  }
                } else {
                  emitEndTurnIfNeeded([])
                }
              } else {
                globalLogger.log('GAME-FLOW', 'Tiempo agotado (Mover) sin jugadas válidas. Cediendo turno.')
                emitEndTurnIfNeeded([])
              }
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
      
      setCurrentTurnPlayerId(activeId)
      setTurnTimer(10)
      setHasRolled(false)
      setDiceValues(null)
      setRemainingMoves([])
      setIsRolling(false)
      setIsAnimatingMove(false)
      setMoveSelectorTokenId(null)
      isProcessingTimeoutRef.current = false
    }

    // 2. Dice Result
    const handleDiceResult = (data: { playerId: string; diceValues?: [number, number]; diceRoll1?: number; diceRoll2?: number }) => {
      const vals: [number, number] = data.diceValues || [
        data.diceRoll1 || Math.floor(Math.random() * 6) + 1,
        data.diceRoll2 || Math.floor(Math.random() * 6) + 1,
      ]

      globalLogger.log('SOCKET', 'Recibido event_dice_result', { playerId: data.playerId, vals })
      
      // Track extra turn for doubles
      if (vals[0] === vals[1]) {
        pendingExtraTurnsRef.current += 1
      }

      setIsRolling(true)
      setTimeout(() => {
        setIsRolling(false)
        setDiceValues(vals)
        setRemainingMoves([...vals])
        setHasRolled(true)
        globalLogger.log('GAME-FLOW', `Dados recibidos por ${data.playerId}: [${vals[0]}, ${vals[1]}]`)
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
      const startStep = currentToken ? currentToken.step : 0
      const targetStep = data.newPathIndex

      setIsAnimatingMove(true)

      // Calculate consumed move value
      let consumedVal = 0
      if (startStep === 0 && targetStep === 1) {
        consumedVal = 5
      } else if (targetStep > startStep) {
        consumedVal = targetStep - startStep
      }

      // Step-by-step animation loop (120ms per step)
      let currentStep = startStep
      const stepInterval = setInterval(() => {
        if (currentStep < targetStep) {
          currentStep += 1
          setTokens((prev) =>
            prev.map((t) =>
              t.playerId === serverPlayerIdx && t.id === tokenIndex
                ? { ...t, step: currentStep }
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
          if (targetStep === 57) {
            showToast('🎉 ¡Ficha en la meta! +10 pasos de bono')
            bonusSteps += 10
          }

          // Capture Check (Perimeter cells)
          if (targetStep >= 1 && targetStep <= 51 && currentToken) {
            const pIndex = (START_OFFSETS[currentToken.color] + targetStep - 1) % 52
            const isStartCell = [1, 14, 27, 40].includes(pIndex)
            const isGoldStar = [8, 21, 34, 47].includes(pIndex)

            if (!isStartCell && !isGoldStar) {
              const opponents = tokensRef.current.filter((t) => {
                if (t.playerId === serverPlayerIdx || t.step === 0 || t.step === 57) return false
                const oppPIndex = (START_OFFSETS[t.color] + t.step - 1) % 52
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
              return { ...t, step: 0 }
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
          if (targetStep === 57) {
            const playerGoalTokens = finalTokens.filter((t) => t.playerId === serverPlayerIdx && t.step === 57)
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

          // Check if turn should advance
          if (isMyTurnRef.current) {
            emitEndTurnIfNeeded(updatedMoves, finalTokens)
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
    const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex)
    if (!token) return

    const startStep = token.step
    let targetStep = startStep + moveVal
    if (startStep === 0) {
      targetStep = 1
    } else if (targetStep > 57) {
      targetStep = 57
    }

    globalLogger.log('TOKENS', `Ejecutando movimiento: Ficha ${tokenIndex} hacia step ${targetStep} con valor ${moveVal}`)
    globalLogger.log('SOCKET', 'Emitiendo intent_move_token', { tokenId: tokenIndex, newPathIndex: targetStep })

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
    if (!isMyTurn || isAnimatingMove || isRolling || !hasRolled) return

    if (playableTokenIds.includes(tokenId)) {
      const tokenIndex = tokenId % 4
      const playerIndex = Math.floor(tokenId / 4)
      const token = tokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex)
      if (!token) return

      if (token.step === 0) {
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

      {/* Toast Banner */}
      {notification && (
        <div className="animate-in fade-in slide-in-from-top-2 mx-auto flex items-center justify-center gap-2 rounded-2xl border border-[var(--candy-cyan)]/40 bg-[var(--candy-cyan)]/15 px-5 py-3 text-[var(--candy-cyan)] font-display text-sm font-bold shadow-lg">
          <Sparkles className="size-4" />
          <span>{notification}</span>
        </div>
      )}

      {/* Visual Game Board & Controls */}
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="relative w-full max-w-2xl aspect-square glass rounded-3xl p-4 flex items-center justify-center">
          <GameBoard
            tokens={tokens}
            currentTurn={activePlayerIndex}
            playableTokenIds={playableTokenIds}
            onTokenClick={handleTokenClick}
            humanPlayerId={activePlayerIndex}
            appTheme="dark"
          />
        </div>

        {/* Action Controls */}
        <div className="w-full max-w-md">
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
      </div>

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
