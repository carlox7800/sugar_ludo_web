'use client'

import { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Volume2, VolumeX, Sparkles, AlertTriangle } from 'lucide-react'
import { getSocket } from '@/lib/socket'
import { useAuth } from '@/lib/auth-context'
import { GameBoard } from '@/src/components/GameBoard'
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

  // Map server players to GameBoard Player interface with explicit colors
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

  // Ensure there's always at least a fallback player to avoid undefined
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

  // Game state driven by server
  const [tokens, setTokens] = useState<Token[]>(initialTokensList)
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState<string>(
    gameData.players?.[0]?.playerId || ''
  )
  const [diceValues, setDiceValues] = useState<[number, number] | null>(null)
  const [remainingMoves, setRemainingMoves] = useState<number[]>([])
  const [isRolling, setIsRolling] = useState(false)
  const [hasRolled, setHasRolled] = useState(false)
  const [winnerPlayer, setWinnerPlayer] = useState<Player | null>(null)
  
  // Timer & Toast notifications
  const [turnTimer, setTurnTimer] = useState<number>(10)
  const [notification, setNotification] = useState<string | null>(null)
  const [muted, setMuted] = useState(false)
  const [isExitModalOpen, setIsExitModalOpen] = useState(false)

  // Map string currentTurnPlayerId to active player index and object
  const activePlayerIndex = Math.max(
    0,
    gameData.players.findIndex((p) => p.playerId === currentTurnPlayerId)
  )

  const currentTurnPlayer: Player = formattedPlayers[activePlayerIndex] || formattedPlayers[0] || defaultPlayer

  const isMyTurn = currentTurnPlayerId === myPlayerId || (
    gameData.players[activePlayerIndex]?.socketId === socket.id
  )

  // Ref to track latest tokens & remainingMoves without closure staleness
  const tokensRef = useRef(tokens)
  tokensRef.current = tokens

  const remainingMovesRef = useRef(remainingMoves)
  remainingMovesRef.current = remainingMoves

  const isMyTurnRef = useRef(isMyTurn)
  isMyTurnRef.current = isMyTurn

  const activePlayerIndexRef = useRef(activePlayerIndex)
  activePlayerIndexRef.current = activePlayerIndex

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 4000)
  }

  // Calculate playable token IDs based on remainingMoves
  const getPlayableTokenIds = (
    currentTokens: Token[],
    playerIdx: number,
    moves: number[]
  ): number[] => {
    if (moves.length === 0) return []
    const diceSum = moves.reduce((a, b) => a + b, 0)
    const result: number[] = []

    currentTokens.forEach((t) => {
      if (t.playerId !== playerIdx) return
      let isPlayable = false
      if (t.step === 0) {
        // Base exit: requires a 5 or sum = 5
        isPlayable = moves.includes(5) || diceSum === 5
      } else {
        // On track: can move with any single remaining die or sum
        isPlayable = moves.some((m) => t.step + m <= 57) || (t.step + diceSum <= 57)
      }
      if (isPlayable) {
        result.push(t.playerId * 4 + t.id)
      }
    })
    return result
  }

  const playableIds = (isMyTurn && hasRolled && remainingMoves.length > 0)
    ? getPlayableTokenIds(tokens, activePlayerIndex, remainingMoves)
    : []

  // Emit turn end helper
  const checkAndEmitTurnEnd = (nextMoves: number[]) => {
    const activeIdx = activePlayerIndexRef.current
    const currentPlayables = getPlayableTokenIds(tokensRef.current, activeIdx, nextMoves)

    if (nextMoves.length === 0 || currentPlayables.length === 0) {
      const SLOT_TO_COLOR_ID: Record<number, number> = { 0: 0, 1: 2, 2: 1, 3: 3, 4: 4, 5: 5 }
      const nextSlot = (activeIdx + 1) % gameData.players.length
      const nextColorId = SLOT_TO_COLOR_ID[nextSlot] ?? 0

      globalLogger.log('GAME-FLOW', `No quedan movimientos o fichas válidas. Terminando turno -> Siguiente color ID: ${nextColorId}`)
      globalLogger.log('SOCKET', 'Emitiendo intent_end_turn', { nextPlayerId: nextColorId })

      socket.emit('intent_end_turn', {
        roomId: gameData.roomId,
        nextPlayerId: nextColorId,
        nextTurnId: nextColorId,
      })
    } else {
      globalLogger.log('GAME-FLOW', `Turno continua. Dados pendientes: [${nextMoves.join(', ')}]`)
    }
  }

  // Visual turn countdown timer
  useEffect(() => {
    if (winnerPlayer) return

    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) {
          // Timer reached 0
          if (isMyTurn) {
            if (!hasRolled && !isRolling) {
              globalLogger.log('GAME-FLOW', 'Tiempo agotado (Lanzar). Emitiendo lanzamiento automático.')
              handleRollDice()
            } else if (hasRolled) {
              globalLogger.log('GAME-FLOW', 'Tiempo agotado (Mover). Cediendo turno por inactividad.')
              
              const SLOT_TO_COLOR_ID: Record<number, number> = { 0: 0, 1: 2, 2: 1, 3: 3, 4: 4, 5: 5 }
              const nextSlot = (activePlayerIndex + 1) % gameData.players.length
              const nextColorId = SLOT_TO_COLOR_ID[nextSlot] ?? 0
          
              socket.emit('intent_end_turn', {
                roomId: gameData.roomId,
                nextPlayerId: nextColorId,
                nextTurnId: nextColorId,
              })
            }
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [currentTurnPlayerId, winnerPlayer, isMyTurn, hasRolled, isRolling, activePlayerIndex, gameData.players.length, gameData.roomId])

  // Server Socket Event Listeners
  useEffect(() => {
    if (!socket) return

    // 1. Turn Started
    const handleTurnStarted = (data: { playerId: string; activePlayerId?: string }) => {
      const activeId = data.playerId || data.activePlayerId || ''
      globalLogger.log('SOCKET', 'Recibido event_turn_started', { activeId })
      globalLogger.log('GAME-FLOW', `Turno iniciado para jugador: ${activeId}`)
      setCurrentTurnPlayerId(activeId)
      setTurnTimer(10)
      setHasRolled(false)
      setDiceValues(null)
      setRemainingMoves([])
      setIsRolling(false)
    }

    // 2. Dice Result (intent_roll_dice -> event_dice_result)
    const handleDiceResult = (data: { playerId: string; diceValues?: [number, number]; diceRoll1?: number; diceRoll2?: number }) => {
      const vals: [number, number] = data.diceValues || [
        data.diceRoll1 || Math.floor(Math.random() * 6) + 1,
        data.diceRoll2 || Math.floor(Math.random() * 6) + 1,
      ]

      globalLogger.log('SOCKET', 'Recibido event_dice_result', { playerId: data.playerId, vals })
      setIsRolling(true)
      setTimeout(() => {
        setIsRolling(false)
        setDiceValues(vals)
        setRemainingMoves([...vals])
        setHasRolled(true)
        globalLogger.log('GAME-FLOW', `Dado lanzado por ${data.playerId}: [${vals[0]}, ${vals[1]}]`)
      }, 500)
    }

    // 3. Token Moved (intent_move_token -> event_token_moved)
    // Step-by-step animation implementation
    const handleTokenMoved = (data: { playerId: string; tokenId: number; newPathIndex: number }) => {
      globalLogger.log('SOCKET', 'Recibido event_token_moved', data)
      const serverPlayerIdx = gameData.players.findIndex((p) => p.playerId === data.playerId)
      if (serverPlayerIdx < 0) {
        globalLogger.log('ERROR', 'event_token_moved: No se encontró al jugador local', { data })
        return
      }

      const currentToken = tokensRef.current.find(
        (t) => t.playerId === serverPlayerIdx && t.id === data.tokenId
      )
      const startStep = currentToken ? currentToken.step : 0
      const targetStep = data.newPathIndex

      globalLogger.log('TOKENS', `Ficha ${data.tokenId} de jugador índice ${serverPlayerIdx}: animando de ${startStep} a ${targetStep}`)

      // Calculate consumed die value
      let consumedVal = 0
      if (startStep === 0 && targetStep === 1) {
        consumedVal = 5
      } else if (targetStep > startStep) {
        consumedVal = targetStep - startStep
      }

      // Deduct consumed die from remainingMoves
      let updatedMoves = [...remainingMovesRef.current]
      if (consumedVal > 0) {
        const exactIndex = updatedMoves.indexOf(consumedVal)
        if (exactIndex !== -1) {
          updatedMoves.splice(exactIndex, 1)
        } else if (updatedMoves.reduce((a, b) => a + b, 0) === consumedVal) {
          updatedMoves = []
        } else if (updatedMoves.length > 0) {
          updatedMoves.shift()
        }
      } else {
        if (updatedMoves.length > 0) updatedMoves.shift()
      }
      setRemainingMoves(updatedMoves)

      // Step-by-Step Animation (120ms per step)
      if (startStep === 0 || targetStep <= startStep) {
        // Immediate jump from base
        setTokens((prev) =>
          prev.map((t) =>
            t.playerId === serverPlayerIdx && t.id === data.tokenId
              ? { ...t, step: targetStep }
              : t
          )
        )
        if (isMyTurnRef.current) {
          checkAndEmitTurnEnd(updatedMoves)
        }
      } else {
        // Step-by-step walk animation
        let currentStep = startStep
        const stepInterval = setInterval(() => {
          currentStep += 1
          setTokens((prev) =>
            prev.map((t) =>
              t.playerId === serverPlayerIdx && t.id === data.tokenId
                ? { ...t, step: currentStep }
                : t
            )
          )

          if (currentStep >= targetStep) {
            clearInterval(stepInterval)
            if (isMyTurnRef.current) {
              checkAndEmitTurnEnd(updatedMoves)
            }
          }
        }, 120)
      }
    }

    // 4. Player Disconnected
    const handlePlayerDisconnected = (data: { playerId: string }) => {
      const discPlayer = gameData.players.find((p) => p.playerId === data.playerId)
      showToast(`⚠️ Jugador ${discPlayer?.playerName || ''} desconectado.`)
    }

    // 5. Player Reconnected
    const handlePlayerReconnected = (data: { playerId: string }) => {
      const recPlayer = gameData.players.find((p) => p.playerId === data.playerId)
      showToast(`✅ Jugador ${recPlayer?.playerName || ''} se reconectó.`)
    }

    // 6. Player Expelled
    const handlePlayerExpelled = (data: { playerId: string }) => {
      showToast(`🚨 Un jugador fue expulsado por inactividad.`)
    }

    // 7. Game Over by Abandonment
    const handleGameOverAbandonment = (data: { winnerId: string }) => {
      const winnerIdx = gameData.players.findIndex((p) => p.playerId === data.winnerId)
      const wPlayer = formattedPlayers[winnerIdx >= 0 ? winnerIdx : 0]
      setWinnerPlayer(wPlayer)
      showToast(`🏆 ¡Partida finalizada! Ganador: ${wPlayer.name}`)
    }

    // 8. State Resynced
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

  // Action: Roll Dice (emits intent_roll_dice)
  const handleRollDice = () => {
    if (!isMyTurn || hasRolled || isRolling) return
    setIsRolling(true)
    globalLogger.log('SOCKET', 'Emitiendo intent_roll_dice', { roomId: gameData.roomId, playerId: myPlayerId })
    socket.emit('intent_roll_dice', {
      roomId: gameData.roomId,
      playerId: myPlayerId,
    })
  }

  // Action: Token Click (emits ONLY intent_move_token, NO intent_end_turn here)
  const handleTokenClick = (globalTokenId: number) => {
    if (!isMyTurn || !hasRolled || remainingMoves.length === 0) return
    
    // Extraer ID local de ficha
    const tokenId = globalTokenId % 4
    
    const myPlayerIdx = gameData.players.findIndex(p => p.playerId === myPlayerId)
    const clickedToken = tokens.find(t => t.playerId === myPlayerIdx && t.id === tokenId)
    
    if (!clickedToken) {
      globalLogger.log('ERROR', `Ficha no encontrada: globalId=${globalTokenId}, localId=${tokenId}`)
      return
    }
  
    const startStep = clickedToken.step
    let moveVal = 0
    let targetStep = 0

    if (startStep === 0) {
      // Exit base: needs a 5 or sum of 5
      targetStep = 1
      if (remainingMoves.includes(5)) {
        moveVal = 5
      } else {
        moveVal = remainingMoves.reduce((a, b) => a + b, 0)
      }
    } else {
      // Pick best valid move from remainingMoves (single die first, then sum)
      const validSingle = remainingMoves.find(m => startStep + m <= 57)
      if (validSingle) {
        moveVal = validSingle
        targetStep = startStep + moveVal
      } else {
        const diceSum = remainingMoves.reduce((a, b) => a + b, 0)
        if (startStep + diceSum <= 57) {
          moveVal = diceSum
          targetStep = startStep + moveVal
        } else {
          return // invalid move
        }
      }
    }

    if (targetStep > 57) targetStep = 57
    
    globalLogger.log('TOKENS', `Clic en ficha ${tokenId}. Movimiento calculado con valor ${moveVal} hacia step ${targetStep}`)
    globalLogger.log('SOCKET', 'Emitiendo intent_move_token', { tokenId, newPathIndex: targetStep })
    
    // Only emit intent_move_token! Do NOT emit intent_end_turn here!
    socket.emit('intent_move_token', {
      roomId: gameData.roomId,
      playerId: myPlayerId,
      tokenId,
      newPathIndex: targetStep,
      isBotMove: false,
    })
  }

  const handleConfirmExit = () => {
    socket.emit('intent_end_turn', {
      roomId: gameData.roomId,
      nextPlayerId: 0,
      nextTurnId: 0,
    })
    onExit()
  }

  // Auto-skip when no valid moves exist after rolling
  useEffect(() => {
    if (isMyTurn && hasRolled && remainingMoves.length > 0) {
      globalLogger.log('TOKENS', 'Fichas jugables evaluadas', { playableIds, remainingMoves })
      
      if (playableIds.length === 0) {
        globalLogger.log('GAME-FLOW', 'No hay jugadas válidas. Saltando turno automáticamente en 1.5s')
        const autoSkipTimer = setTimeout(() => {
          const SLOT_TO_COLOR_ID: Record<number, number> = { 0: 0, 1: 2, 2: 1, 3: 3, 4: 4, 5: 5 }
          const nextSlot = (activePlayerIndex + 1) % gameData.players.length
          const nextColorId = SLOT_TO_COLOR_ID[nextSlot] ?? 0
      
          socket.emit('intent_end_turn', {
            roomId: gameData.roomId,
            nextPlayerId: nextColorId,
            nextTurnId: nextColorId,
          })
        }, 1500)
        return () => clearTimeout(autoSkipTimer)
      }
    }
  }, [isMyTurn, hasRolled, remainingMoves, playableIds.length, activePlayerIndex, gameData.players.length, gameData.roomId])

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

      {/* Toast Notification Banner */}
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
            playableTokenIds={playableIds}
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
            isHumanTurnToRoll={isMyTurn}
            isGlowActive={isMyTurn && !hasRolled && !isRolling}
            appTheme="dark"
          />
        </div>
      </div>

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
    </div>
  )
}
