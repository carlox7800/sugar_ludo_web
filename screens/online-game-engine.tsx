'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { ArrowLeft, Volume2, VolumeX, Sparkles, AlertTriangle, Trophy } from 'lucide-react'
import { recordMatchResult } from '@/lib/stats-service'
import confetti from 'canvas-confetti'
import { getSocket } from '@/lib/socket'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { GameBoard } from '@/src/components/GameBoard'
import { PlayerCorner } from '@/src/components/PlayerCorner'
import { Token, Player, PlayerColor } from '@/src/types'
import { globalLogger } from '@/lib/logger'
import { audio } from '@/src/audio'
import { ECONOMY_MATRIX } from '@/components/competitive-training'

import { HexagonalLudoBoardView } from '@/src/components/HexagonalLudoBoardView'
import { HEX_COLORS_ORDER, STAR_CELLS, HEX_COLOR_INFO, HexPlayerColor } from '@/src/HexBoardConstants'
import { getCellIndexForToken, hasBarrierAtHex } from '@/src/HexGameEngine'

const SQUARE_COLORS_ORDER: PlayerColor[] = ['yellow', 'red', 'green', 'blue', 'purple', 'orange']

// --- NATIVE SWEETY LUDO ANDROID COLOR ID MAP ---
// The server maps incoming IDs to slots like this:
// 0: Red    -> Slot 0
// 1: Yellow -> Slot 2
// 2: Blue   -> Slot 1
// 3: Green  -> Slot 3
// We reverse map from target Slot Index back to the required Android Color ID
const slotToAndroidColorId: Record<number, number> = {
  0: 0,
  1: 2,
  2: 1,
  3: 3,
  4: 4,
  5: 5
}

// --- NATIVE 0-INDEXED MULTI-BOARD MATH HELPERS ---
const getTrackSteps = (isHex: boolean): number => isHex ? 77 : 51
const getGoalStep = (isHex: boolean): number => isHex ? 82 : 56
const getTotalPerimeter = (isHex: boolean): number => isHex ? 78 : 52
const getStartOffset = (color: PlayerColor, isHex: boolean): number => {
  if (isHex) {
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
  const [dynamicPlayers, setDynamicPlayers] = useState(() => {
    const players = gameData.players || []
    return [...players].sort((a, b) => {
      const aVal = a.slotIndex !== undefined ? a.slotIndex : (a.colorId !== undefined ? a.colorId : a.playerId)
      const bVal = b.slotIndex !== undefined ? b.slotIndex : (b.colorId !== undefined ? b.colorId : b.playerId)
      if (aVal < bVal) return -1
      if (aVal > bVal) return 1
      return 0
    })
  })
  const myPlayerIndex = useMemo(() => {
    return dynamicPlayers.findIndex((p) => p.playerId === myPlayerId || p.socketId === socket.id)
  }, [dynamicPlayers, myPlayerId, socket.id])

  // Determine if it's a hex game based on player count or game configuration
  const isHexGame = gameData.maxPlayers === 6 || (gameData as any).boardType === 'hex' || dynamicPlayers.length > 4
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
  const [currentTurnPlayerId, setCurrentTurnPlayerId] = useState<string>('')
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
      const timer = setTimeout(() => {
        confetti({
          particleCount: 150,
          spread: 100,
          origin: { y: 0.6 },
          zIndex: 9999,
          useWorker: true
        });
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [winnerPlayer])
  const [explosionData, setExplosionData] = useState<{ cellIndex: number; color: PlayerColor } | null>(null)
  
  // Timer & UI Notifications
  const [turnTimer, setTurnTimer] = useState<number>(30)
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

  const activePlayerIndex = currentTurnPlayerId ? Math.max(
    0,
    dynamicPlayers.findIndex((p, idx) => 
      p.playerId === currentTurnPlayerId || 
      String(idx) === String(currentTurnPlayerId) || 
      (p as any).colorId !== undefined && String((p as any).colorId) === String(currentTurnPlayerId)
    )
  ) : -1

  const currentTurnPlayer: Player = (activePlayerIndex >= 0 ? formattedPlayers[activePlayerIndex] : null) || formattedPlayers[0] || defaultPlayer

  const isMyTurn = currentTurnPlayerId !== '' && activePlayerIndex === myPlayerIndex

  // Refs to prevent closure staleness and duplicate timer triggers
  const tokensRef = useRef(tokens)
  tokensRef.current = tokens

  const remainingMovesRef = useRef(remainingMoves)
  remainingMovesRef.current = remainingMoves

  const currentTurnPlayerIdRef = useRef(currentTurnPlayerId)
  currentTurnPlayerIdRef.current = currentTurnPlayerId

  const isMyTurnRef = useRef(isMyTurn)
  isMyTurnRef.current = isMyTurn

  const myPlayerIdRef = useRef(myPlayerId)
  myPlayerIdRef.current = myPlayerId

  const activePlayerIndexRef = useRef(activePlayerIndex)
  activePlayerIndexRef.current = activePlayerIndex

  const isAnimatingMoveRef = useRef(isAnimatingMove)
  isAnimatingMoveRef.current = isAnimatingMove

  const isRollingRef = useRef(isRolling)
  isRollingRef.current = isRolling

  const isProcessingTimeoutRef = useRef(false)
  const pendingExtraTurnsRef = useRef<number>(0)

  const lastMovedTokenGlobalIdRef = useRef<number | null>(null)
  const barrierLifetimesRef = useRef<Record<number, number>>({})
  const finishedPlayerIndicesRef = useRef<number[]>([])
  const moveQueueRef = useRef<{ playerId: string; tokenId: number; newPathIndex: number; isPenalty?: boolean; captureCell?: number }[]>([])
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
    const totalPlayers = dynamicPlayers.length
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
    const pCount = dynamicPlayers.length
    const trackSteps = getTrackSteps(isHexGame)
    const perimeter = getTotalPerimeter(isHexGame)

    currentTokens.forEach((tk) => {
      if (tk.step >= 0 && tk.step < trackSteps) {
        const tkIdx = (getStartOffset(tk.color, isHexGame) + tk.step) % perimeter
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

  const getNextActivePlayerIndex = (currentIndex: number, totalPlayers: number): number => {
    const requiredTokens = isHexGame ? 3 : 4
    const goalStep = getGoalStep(isHexGame)

    if (isHexGame) {
      const visualSequence: PlayerColor[] = ['purple', 'red', 'yellow', 'orange', 'blue', 'green']
      const currentColor = formattedPlayers[currentIndex]?.color || 'purple'
      const startSeqIndex = visualSequence.indexOf(currentColor)

      if (startSeqIndex !== -1) {
        for (let i = 1; i <= visualSequence.length; i++) {
          const checkSeqIdx = (startSeqIndex + i) % visualSequence.length
          const targetColor = visualSequence[checkSeqIdx]
          const targetPlayer = formattedPlayers.find((p) => p.color === targetColor)

          if (targetPlayer) {
            const pGoalTokens = tokensRef.current.filter((t) => t.playerId === targetPlayer.id && t.step === goalStep)
            const isActuallyFinished = pGoalTokens.length >= requiredTokens
            if (!isActuallyFinished) {
              return targetPlayer.id
            }
          }
        }
      }
    }

    if (!isHexGame) {
      const visualSequence: PlayerColor[] = ['blue', 'green', 'red', 'yellow']
      const currentColor = formattedPlayers[currentIndex]?.color || 'yellow'
      const startSeqIndex = visualSequence.indexOf(currentColor)

      if (startSeqIndex !== -1) {
        for (let i = 1; i <= visualSequence.length; i++) {
          const checkSeqIdx = (startSeqIndex + i) % visualSequence.length
          const targetColor = visualSequence[checkSeqIdx]
          const targetPlayer = formattedPlayers.find((p) => p.color === targetColor)

          if (targetPlayer) {
            const pGoalTokens = tokensRef.current.filter((t) => t.playerId === targetPlayer.id && t.step === goalStep)
            const isActuallyFinished = pGoalTokens.length >= requiredTokens
            if (!isActuallyFinished) {
              return targetPlayer.id
            }
          }
        }
      }
    }

    let nextIndex = (currentIndex - 1 + totalPlayers) % totalPlayers
    let attempts = 0
    
    while (attempts < totalPlayers) {
      const pGoalTokens = tokensRef.current.filter(t => t.playerId === nextIndex && t.step === goalStep)
      const isActuallyFinished = pGoalTokens.length >= requiredTokens
      
      if (isActuallyFinished) {
        nextIndex = (nextIndex - 1 + totalPlayers) % totalPlayers
        attempts++
      } else {
        break
      }
    }
    return nextIndex
  }

  // Sincronizar dinámicamente los jugadores terminados leyendo únicamente las fichas en meta en tiempo real
  useEffect(() => {
    const requiredTokens = isHexGame ? 3 : 4
    const goalStep = getGoalStep(isHexGame)
    const currentFinished: number[] = []
    
    for (let pIdx = 0; pIdx < formattedPlayers.length; pIdx++) {
      const pGoalTokens = tokens.filter(t => t.playerId === pIdx && t.step === goalStep)
      if (pGoalTokens.length >= requiredTokens) {
        currentFinished.push(pIdx)
      }
    }
    finishedPlayerIndicesRef.current = currentFinished
  }, [tokens, isHexGame, formattedPlayers.length])

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 4000)
  }

  // ---------------------------------------------------------------------------
  // Ludo Rules Engine Ported from GameEngine.tsx
  // ---------------------------------------------------------------------------

  // Check if a perimeter cell has 2 or more tokens (forming a barrier/bloqueo)
  const hasBarrierAt = (perimeterIndex: number, currentTokens: Token[] = tokensRef.current): boolean => {
    const pCount = dynamicPlayers.length
    const trackSteps = getTrackSteps(isHexGame)
    const perimeter = getTotalPerimeter(isHexGame)

    if (perimeterIndex < 0 || perimeterIndex >= perimeter) return false
    let totalCount = 0
    currentTokens.forEach((tk) => {
      if (tk.step >= 0 && tk.step < trackSteps) {
        const tkIdx = (getStartOffset(tk.color, isHexGame) + tk.step) % perimeter
        if (tkIdx === perimeterIndex) {
          totalCount++
        }
      }
    })
    return totalCount >= 2
  }

  // Validate if a move is legal for a specific token
  const checkMoveValid = (token: Token, moveVal: number, currentTokens: Token[] = tokensRef.current): boolean => {
    const trackSteps = getTrackSteps(isHexGame)
    const goalStep = getGoalStep(isHexGame)
    const perimeter = getTotalPerimeter(isHexGame)

    const isBase = isHexGame ? token.step <= 0 : token.step < 0
    if (isBase) {
      if (moveVal === 5) {
        if (isHexGame) {
          const startIdx = getCellIndexForToken(token.color as any, 1)
          if (typeof startIdx === 'number') {
            let myCount = 0
            let enemyCount = 0
            currentTokens.forEach((tk) => {
              const tkIdx = getCellIndexForToken(tk.color as any, tk.step)
              if (typeof tkIdx === 'number' && tkIdx === startIdx) {
                if (tk.color === token.color) myCount++
                else enemyCount++
              }
            })
            const isExpellable = myCount === 1 && enemyCount === 1
            return !(myCount + enemyCount >= 2 && !isExpellable)
          }
          return true
        } else {
          const startIdx = getStartOffset(token.color, isHexGame)
          return !hasBarrierAt(startIdx, currentTokens)
        }
      }
      return false
    } else if (token.step >= (isHexGame ? 1 : 0) && token.step < goalStep) {
      const distanceToGoal = goalStep - token.step
      if (moveVal > distanceToGoal) return false
      
      let blocked = false
      const stepsToCheck = Math.min(moveVal, distanceToGoal)
      for (let stepOffset = 1; stepOffset <= stepsToCheck; stepOffset++) {
        const pathStep = token.step + stepOffset
        if (isHexGame) {
          const pIndex = getCellIndexForToken(token.color as any, pathStep)
          if (typeof pIndex === 'number' && hasBarrierAtHex(pIndex, currentTokens as any)) {
            blocked = true
            break
          }
        } else {
          if (pathStep < trackSteps) {
            const pIndex = (getStartOffset(token.color, isHexGame) + pathStep) % perimeter
            if (hasBarrierAt(pIndex, currentTokens)) {
              blocked = true
              break
            }
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

    if (isHexGame) {
      const hasFive = moves.includes(5)
      const hasSumFive = moves.length === 2 && moves[0] + moves[1] === 5

      playerTokens.forEach((t) => {
        const globalId = t.playerId * 4 + t.id
        if (t.step <= 0) {
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

    const trackSteps = getTrackSteps(isHexGame)
    const goalStep = getGoalStep(isHexGame)
    const perimeter = getTotalPerimeter(isHexGame)

    const forcedTokens = playerTokens
      .filter((t) => {
        const globalId = t.playerId * 4 + t.id
        if ((barrierLifetimesRef.current[globalId] || 0) >= 2) {
          if (t.step >= 0 && t.step < trackSteps) {
            const tkIdx = (getStartOffset(t.color, isHexGame) + t.step) % perimeter
            let totalCount = 0
            currentTokens.forEach((tk) => {
              if (tk.step >= 0 && tk.step < trackSteps) {
                const tkIdx2 = (getStartOffset(tk.color, isHexGame) + tk.step) % perimeter
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
          const startIdx = getStartOffset(token.color, isHexGame)
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

    if (activeIdx !== myPlayerIndex) {
      globalLogger.log('GAME-FLOW', `Omite emitir intent_end_turn: no es mi turno (activeIdx: ${activeIdx}, myPlayerIndex: ${myPlayerIndex})`)
      return
    }

    const playables = getPlayableTokenIds(activeIdx, nextMoves, currentTokens)

    if (nextMoves.length === 0 || playables.length === 0) {
      let nextPlayerIndex = getNextActivePlayerIndex(activeIdx, dynamicPlayers.length)

      if (pendingExtraTurnsRef.current > 0 && !finishedPlayerIndicesRef.current.includes(activeIdx)) {
        pendingExtraTurnsRef.current -= 1
        nextPlayerIndex = activeIdx
        globalLogger.log('GAME-FLOW', `¡Turno extra! Manteniendo el turno en el mismo jugador.`)
      } else {
        updateBarrierLifetimes(currentTokens, activeIdx)
      }

      isProcessingTimeoutRef.current = false
      
      // Traducir nuestro índice local al ID nativo de Android esperado por el servidor
      const targetSlot = dynamicPlayers[nextPlayerIndex]?.slotIndex ?? nextPlayerIndex
      const androidColorId = slotToAndroidColorId[targetSlot] ?? targetSlot
      
      const targetPlayerId = dynamicPlayers[nextPlayerIndex]?.playerId || dynamicPlayers[nextPlayerIndex]?.id || nextPlayerIndex
      
      globalLogger.log('GAME-FLOW', `Fin de movimientos/fichas válidas. Emitiendo intent_end_turn -> UUID: ${targetPlayerId}, (Slot: ${targetSlot}, ColorID: ${androidColorId})`)
      socket.emit('intent_end_turn', {
        roomId: gameData.roomId,
        nextPlayerId: androidColorId,
        nextTurnId: androidColorId,
        explicitNetworkId: targetPlayerId
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
      // Shuffle playables to pick randomly and try all candidates
      const shuffledPlayables = [...playables].sort(() => Math.random() - 0.5)
      
      for (const randomGlobalId of shuffledPlayables) {
        const tokenIndex = randomGlobalId % 4
        const playerIndex = Math.floor(randomGlobalId / 4)
        const token = currentTokens.find((t) => t.playerId === playerIndex && t.id === tokenIndex)

        if (token) {
          let chosenMove = -1
          if (token.step === -1) {
            const hasFive = currentMoves.includes(5)
            const hasSumFive = currentMoves.length === 2 && (currentMoves[0] + currentMoves[1] === 5)
            if (hasFive || hasSumFive) {
              chosenMove = 5
            }
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
            globalLogger.log('GAME-FLOW', `Inactividad/Timeout: Jugando ficha ${tokenIndex} con valor ${chosenMove}.`)
            executeMoveIntent(randomGlobalId, chosenMove)
            return
          }
        }
      }
    }

    globalLogger.log('GAME-FLOW', 'Inactividad: Sin jugadas válidas posibles. Cediendo turno.')
    emitEndTurnIfNeeded([], currentTokens)
  }

  // ---------------------------------------------------------------------------
  // Visual Countdown Timer Effect (Server-Authoritative event_turn_timeout handles gameplay action)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (winnerPlayer) return

    const interval = setInterval(() => {
      setTurnTimer((prev) => {
        // Freeze timer display during animations or rolling dice
        if (isAnimatingMoveRef.current || isRollingRef.current) return prev
        if (prev === 1 && isMyTurnRef.current && !isProcessingTimeoutRef.current) {
          // Client safety backup timeout if server event is delayed
          setTimeout(() => {
            if (isMyTurnRef.current && !isProcessingTimeoutRef.current) {
              isProcessingTimeoutRef.current = true
              if (!hasRolledRef.current && !isRollingRef.current) {
                globalLogger.log('GAME-FLOW', 'Timeout de seguridad (Lanzar). Emitiendo intent_roll_dice.')
                handleRollDice()
              } else if (hasRolledRef.current) {
                globalLogger.log('GAME-FLOW', 'Timeout de seguridad (Mover). Ejecutando jugada aleatoria.')
                executeRandomValidMove()
              }
            }
          }, 1500)
        }
        return prev > 0 ? prev - 1 : 0
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
    const handleTurnStarted = (data: { playerId: string; activePlayerId?: string; turnDurationSeconds?: number }) => {
      const activeId = data.playerId || data.activePlayerId || ''
      const duration = data.turnDurationSeconds || 30
      globalLogger.log('SOCKET', 'Recibido event_turn_started', { activeId, turnDurationSeconds: duration })

      // BUG FIX v8.0.7 & v8.0.9: When the turn genuinely changes to a DIFFERENT player,
      // clear any stale pending extra turns so doubles don't accidentally bleed over.
      if (activeId !== currentTurnPlayerIdRef.current) {
        pendingExtraTurnsRef.current = 0
        lastMovedTokenGlobalIdRef.current = null
      }

      currentTurnPlayerIdRef.current = activeId
      setCurrentTurnPlayerId(activeId)
      setTurnTimer(duration)
      setHasRolled(false)
      setDiceValues(null)
      setRemainingMoves([])
      setIsRolling(false)
      setIsAnimatingMove(false)
      setMoveSelectorTokenId(null)
      isProcessingTimeoutRef.current = false
    }

    // 1b. Server Authoritative Turn Timeout Handler (v8.0.10)
    const handleTurnTimeout = (data: { playerId: string; reason?: string }) => {
      globalLogger.log('SOCKET', 'Recibido event_turn_timeout', data)
      const targetId = data.playerId
      const myId = myPlayerIdRef.current || myPlayerId

      if (targetId === myId) {
        if (!isProcessingTimeoutRef.current) {
          isProcessingTimeoutRef.current = true
          if (!hasRolledRef.current && !isRollingRef.current) {
            globalLogger.log('GAME-FLOW', 'Timeout recibido del servidor (Lanzar). Emitiendo intent_roll_dice.')
            handleRollDice()
          } else if (hasRolledRef.current) {
            globalLogger.log('GAME-FLOW', 'Timeout recibido del servidor (Mover). Ejecutando jugada aleatoria.')
            executeRandomValidMove()
          }
        }
      }
    }

    // 2. Dice Result
    const handleDiceResult = (data: { playerId: string; diceValues?: [number, number]; diceRoll1?: number; diceRoll2?: number }) => {
      const vals: [number, number] = data.diceValues || [
        data.diceRoll1 || Math.floor(Math.random() * 6) + 1,
        data.diceRoll2 || Math.floor(Math.random() * 6) + 1,
      ]

      globalLogger.log('SOCKET', 'Recibido event_dice_result', { playerId: data.playerId, vals })
      
      // BUG FIX v8.0.6: Sync isRollingRef so the timer freeze works correctly during animation
      setIsRolling(true)
      isRollingRef.current = true
      setTimeout(() => {
        setIsRolling(false)
        isRollingRef.current = false
        setDiceValues(vals)
        setRemainingMoves([...vals])
        setHasRolled(true)
        // setTurnTimer(30) // REMOVED: Enforce strict 15s absolute timer
        globalLogger.log('GAME-FLOW', `Dados recibidos por ${data.playerId}: [${vals[0]}, ${vals[1]}]`)

        // BUG FIX v8.0.7: Register pending extra turn when doubles are rolled (R9)
        // WITHOUT this, pendingExtraTurnsRef is always 0 and emitEndTurnIfNeeded
        // always advances to the next player even on doubles.
        if (vals[0] === vals[1]) {
          pendingExtraTurnsRef.current += 1
          showToast('🎲 ¡Turno Extra por Doble!')
          globalLogger.log('GAME-FLOW', `Doble detectado [${vals[0]},${vals[1]}]. Turno extra registrado (pendingExtraTurns: ${pendingExtraTurnsRef.current})`)
        }

        // Only chain auto-move if this was a timeout-triggered roll (not human-initiated)
        if (isMyTurnRef.current && data.playerId === myPlayerId && isProcessingTimeoutRef.current) {
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
    const handleTokenMoved = (data: { playerId: string; tokenId: number; newPathIndex: number; isPenalty?: boolean; captureCell?: number }) => {
      globalLogger.log('SOCKET', 'Recibido event_token_moved', data)
      moveQueueRef.current.push(data)
      processNextQueuedMove()
    }

    const processTokenMoved = (data: { playerId: string; tokenId: number; newPathIndex: number; isPenalty?: boolean; captureCell?: number }) => {
      if (isAnimatingMoveRef.current) {
        // Re-queue if an animation is currently running
        moveQueueRef.current.unshift(data)
        return
      }

      const serverPlayerIdx = dynamicPlayers.findIndex((p) => p.playerId === data.playerId)
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

      // Intercept Penalty / Capture return to base (-1)
      if (targetStep === -1) {
        if ('playCapture' in audio) (audio as any).playCapture()
        else audio.playStep()
        
        // Fase 4 / v8.2.8: Identificar si fue penalización por la bandera autoritativa o por el contexto
        const activePlayerIdx = dynamicPlayers.findIndex(p => p.playerId === currentTurnPlayerIdRef.current)
        const isPenalty = data.isPenalty === true || (serverPlayerIdx === activePlayerIdx)

        // Calcular casilla de colisión para activar la explosión visual
        let cellIndex: number | null = null
        if (data.captureCell !== undefined && data.captureCell >= 0) {
          const capStep = data.captureCell
          const attackerPlayer = activePlayerIdx >= 0 ? formattedPlayersRef.current[activePlayerIdx] : null
          const attackerColor = attackerPlayer?.color || 'yellow'

          if (isHexGame) {
            const idx = getCellIndexForToken(attackerColor as any, capStep)
            cellIndex = typeof idx === 'number' ? idx : capStep
          } else {
            const perimeter = getTotalPerimeter(isHexGame)
            const pIdx = (getStartOffset(attackerColor, isHexGame) + capStep) % perimeter
            cellIndex = pIdx + 1 // UI uses 1-based index (1..52) for explosion
          }
        } else if (startStep >= 0) {
          if (isHexGame) {
            const idx = getCellIndexForToken(currentToken?.color as any, startStep)
            cellIndex = typeof idx === 'number' ? idx : startStep
          } else {
            const perimeter = getTotalPerimeter(isHexGame)
            const pIdx = (getStartOffset(currentToken?.color || 'yellow', isHexGame) + startStep) % perimeter
            cellIndex = pIdx + 1
          }
        }

        // Efecto visual de explosión (para AMBOS: capturas y penalizaciones)
        if (cellIndex !== null) {
          if (!mutedRef.current) audio.playFireworks()
          setExplosionData({ cellIndex: cellIndex, color: currentToken?.color || 'red' })
          setTimeout(() => setExplosionData(null), 3500)
        }

        if (isPenalty) {
          showToast('🚫 ¡Penalización por 3 dobles consecutivos! Ficha devuelta a la base')
          globalLogger.log('GAME-FLOW', '¡Penalización por 3 dobles consecutivos recibida del servidor!')
        } else {
          showToast(`⚔️ ¡Ficha capturada! +${isHexGame ? 25 : 20} pasos de bonificación`)
        }

        tokensRef.current = tokensRef.current.map((t) =>
          t.playerId === serverPlayerIdx && t.id === tokenIndex
            ? { ...t, step: -1 }
            : t
        )
        setTokens(tokensRef.current)

        if (isMyTurnRef.current && serverPlayerIdx === myPlayerIndex) {
          // Empty remaining moves local state on penalty and clear extra turns so turn advances
          setRemainingMoves([])
          pendingExtraTurnsRef.current = 0
          emitEndTurnIfNeeded([])
        }
        setTimeout(processNextQueuedMove, 50)
        return
      }

      const trackSteps = getTrackSteps(isHexGame)
      const goalStep = getGoalStep(isHexGame)
      const perimeter = getTotalPerimeter(isHexGame)

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
      isAnimatingMoveRef.current = true

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
          setTimeout(animateNextStep, 220)
        } else {
          // Finished animating all steps - Apply rules, bonuses, and captures
          let bonusSteps = 0
          let capturedOpponents: { playerId: number; id: number }[] = []

          // Deduct consumed move value
          let updatedMoves = [...remainingMovesRef.current]
          if (consumedVal > 0) {
            const idx = updatedMoves.indexOf(consumedVal)
            if (idx !== -1) {
              updatedMoves.splice(idx, 1)
            } else if (updatedMoves.length === 2 && (updatedMoves[0] + updatedMoves[1] === consumedVal)) {
              updatedMoves = []
            } else if (updatedMoves.length > 0) {
              updatedMoves.shift()
            }
          }

          // Goal Check
          if (targetStep === goalStep) {
            const goalBonus = isHexGame ? 15 : 10
            showToast(`🎉 ¡Ficha en la meta! +${goalBonus} pasos de bono`)
            bonusSteps += goalBonus
            if (!mutedRef.current) audio.playGoal()
          }

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

                  if (enemyTokens.length > 0 && (myTokens.length >= 1 || cellTokens.length >= 2)) {
                    capturedOpponents = enemyTokens.map(e => ({ playerId: e.playerId, id: e.id }))
                    if (!mutedRef.current) audio.playFireworks()
                    setExplosionData({ cellIndex: targetCellIndex, color: enemyTokens[0].color })
                    setTimeout(() => setExplosionData(null), 3500)
                    showToast('⚔️ ¡Ficha enemiga expulsada de salida!')
                  }
                } else if (!STAR_CELLS.includes(targetCellIndex)) {
                  const enemyTokens = tokensRef.current.filter(
                    (t) => t.playerId !== serverPlayerIdx && t.step > 0 && t.step <= 76 && getCellIndexForToken(t.color as any, t.step) === targetCellIndex
                  )
                  if (enemyTokens.length > 0) {
                    capturedOpponents = enemyTokens.map(e => ({ playerId: e.playerId, id: e.id }))
                    if (!mutedRef.current) audio.playFireworks()
                    setExplosionData({ cellIndex: targetCellIndex, color: enemyTokens[0].color })
                    setTimeout(() => setExplosionData(null), 3500)
                    showToast('⚔️ ¡Ficha capturada! +25 pasos de bono')
                    bonusSteps += 25
                  }
                }
              }
            } else if (targetStep >= 0 && targetStep < trackSteps) {
              const pIndex = (getStartOffset(currentToken.color, isHexGame) + targetStep) % perimeter
              const isGoldStar = [1, 8, 14, 21, 27, 34, 40, 47].includes(pIndex)

              if (targetStep === 0) {
                // Salida a casilla propia
                const cellTokens = tokensRef.current.filter((t) => {
                  if (t.step < 0 || t.step >= trackSteps) return false
                  const oppPIndex = (getStartOffset(t.color, isHexGame) + t.step) % perimeter
                  return oppPIndex === pIndex
                })
                const myTokens = cellTokens.filter((t) => t.playerId === serverPlayerIdx)
                const enemyTokens = cellTokens.filter((t) => t.playerId !== serverPlayerIdx)
                if (enemyTokens.length > 0 && (myTokens.length >= 1 || cellTokens.length >= 2)) {
                  capturedOpponents = enemyTokens.map(e => ({ playerId: e.playerId, id: e.id }))
                  if (!mutedRef.current) audio.playFireworks()
                  setExplosionData({ cellIndex: pIndex + 1, color: enemyTokens[0].color })
                  setTimeout(() => setExplosionData(null), 3500)
                  showToast('⚔️ ¡Ficha enemiga expulsada de salida!')
                }
              } else if (!isGoldStar) {
                const opponents = tokensRef.current.filter((t) => {
                  if (t.playerId === serverPlayerIdx || t.step === -1 || t.step === goalStep) return false
                  if (t.step < 0 || t.step >= trackSteps) return false
                  const oppPIndex = (getStartOffset(t.color, isHexGame) + t.step) % perimeter
                  return oppPIndex === pIndex
                })

                if (opponents.length > 0) {
                  capturedOpponents = opponents.map(e => ({ playerId: e.playerId, id: e.id }))
                  if (!mutedRef.current) audio.playFireworks()
                  setExplosionData({ cellIndex: pIndex + 1, color: opponents[0].color })
                  setTimeout(() => setExplosionData(null), 3500)
                  showToast(`⚔️ ¡Ficha capturada! +20 pasos de bono`)
                  bonusSteps += 20
                }
              }
            }
          }

          // Apply current token's new position AND send captured opponent tokens directly to base (-1)
          const finalTokens = tokensRef.current.map((t) => {
            if (t.playerId === serverPlayerIdx && t.id === tokenIndex) {
              return { ...t, step: targetStep }
            }
            if (capturedOpponents.some(c => c.playerId === t.playerId && c.id === t.id)) {
              return { ...t, step: -1 }
            }
            return t
          })

          if (bonusSteps > 0) {
            updatedMoves.push(bonusSteps)
          }

          tokensRef.current = finalTokens
          setTokens(finalTokens)
          setRemainingMoves(updatedMoves)
          setIsAnimatingMove(false)
          isAnimatingMoveRef.current = false
          setTimeout(processNextQueuedMove, 80)

          // Check for Player Win / Completion
          const requiredTokens = isHexGame ? 3 : 4
          const currentFinishedIndices: number[] = []
          for (let pIdx = 0; pIdx < formattedPlayersRef.current.length; pIdx++) {
            const pGoalTokens = finalTokens.filter((t) => t.playerId === pIdx && t.step === goalStep)
            if (pGoalTokens.length >= requiredTokens) {
              currentFinishedIndices.push(pIdx)
            }
          }

          if (currentFinishedIndices.includes(serverPlayerIdx)) {
            const finishedPlayer = formattedPlayersRef.current[serverPlayerIdx]
            if (!finishedPlayerIndicesRef.current.includes(serverPlayerIdx)) {
              finishedPlayerIndicesRef.current.push(serverPlayerIdx)
              setRankings((prev) => [...prev, finishedPlayer])
              showToast(`🏆 ¡${finishedPlayer.name} completó todas sus fichas!`)
            }

            const totalPlayers = dynamicPlayers.length
            const finishedCount = currentFinishedIndices.length

            const isGameOver =
              (totalPlayers === 2 && finishedCount >= 1) ||
              (totalPlayers === 3 && finishedCount >= 2) ||
              (totalPlayers === 4 && finishedCount >= 3) ||
              (totalPlayers === 5 && finishedCount >= 3) ||
              (totalPlayers === 6 && finishedCount >= 4)

            if (isGameOver) {
              const finalRankings = buildFinalRankings(
                currentFinishedIndices,
                formattedPlayersRef.current,
                finalTokens,
                goalStep
              )
              setRankings(finalRankings)
              const firstWinner = finalRankings[0] || finishedPlayer
              setWinnerPlayer(firstWinner)
              recordOnlineMatchResult(finalRankings)
              globalLogger.log('GAME-FLOW', `¡Partida finalizada! Ganador: ${firstWinner.name}`)
              return
            }
          }

          // Check if turn should advance or continue auto-play
          if (isMyTurnRef.current && serverPlayerIdx === myPlayerIndex) {
            const playables = getPlayableTokenIds(activePlayerIndexRef.current, updatedMoves, finalTokens)
            if (updatedMoves.length === 0 || playables.length === 0) {
              emitEndTurnIfNeeded(updatedMoves, finalTokens)
            } else {
              // setTurnTimer(30) // REMOVED: Enforce strict 15s absolute timer
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

    const handleSocketConnect = () => {
      if (!socket.connected) {
        try {
          socket.connect()
        } catch {}
      }
      if (gameData?.roomId && myPlayerId) {
        globalLogger.log('SOCKET', 'Socket conectado/reconectado. Reasociando a sala:', gameData.roomId)
        socket.emit('join_room', {
          roomId: gameData.roomId,
          playerId: myPlayerId,
          playerName: user?.nickname || 'Jugador'
        })
      }
    }

    socket.on('connect', handleSocketConnect)
    window.addEventListener('online', handleSocketConnect)

    if (socket.connected && gameData?.roomId && myPlayerId) {
      handleSocketConnect()
    }

    const handlePlayerReconnected = (data: { playerId: string }) => {
      setDynamicPlayers(prev => {
        const updated = [...prev]
        const idx = updated.findIndex(p => p.playerId === data.playerId)
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], isConnected: true, isBot: false }
          let rawName = updated[idx].playerName || updated[idx].name || 'Jugador'
          if (rawName.includes('|||')) rawName = rawName.split('|||')[0]
          if (data.playerId === myPlayerId) {
            showToast('🟢 ¡Te has reconectado a la partida!')
          } else {
            showToast(`🟢 ${rawName} se reconectó.`)
          }
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
        }
        return updated
      })
    }

    const handleGameOverAbandonment = (data: { winnerId: string; reason?: string; isSelfExpelled?: boolean }) => {
      const isMeWinner = data.winnerId === myPlayerId
      const winnerIdx = dynamicPlayers.findIndex((p) => p.playerId === data.winnerId)
      const wPlayer = formattedPlayersRef.current[winnerIdx >= 0 ? winnerIdx : 0]
      const winIdx = winnerIdx >= 0 ? winnerIdx : 0
      const finalRankings = buildFinalRankings(
        [winIdx],
        formattedPlayersRef.current,
        tokensRef.current,
        getGoalStep(isHexGame)
      )

      // Mostrar el aviso diferenciado según quién fue desconectado
      if (data.isSelfExpelled || (!isMeWinner && data.reason === 'inactivity')) {
        showToast('Has sido desconectado por inactividad')
      } else if (data.reason === 'inactivity') {
        showToast('El jugador rival fue desconectado por inactividad')
      } else {
        showToast('El rival ha abandonado la partida')
      }

      // Pausa de 3.5 segundos para lectura con calma antes de desplegar el podio
      setTimeout(() => {
        setRankings(finalRankings)
        setWinnerPlayer(wPlayer)
        recordOnlineMatchResult(finalRankings)
      }, 3500)
    }

    const handleRoomExpired = (data: { roomId?: string; reason?: string; isSelfExpelled?: boolean }) => {
      const rivalIdx = dynamicPlayers.findIndex((p) => p.playerId !== myPlayerId)
      const wPlayer = formattedPlayersRef.current[rivalIdx >= 0 ? rivalIdx : 0]
      const winIdx = rivalIdx >= 0 ? rivalIdx : 0
      const finalRankings = buildFinalRankings(
        [winIdx],
        formattedPlayersRef.current,
        tokensRef.current,
        getGoalStep(isHexGame)
      )

      showToast('Has sido desconectado por inactividad')
      setTimeout(() => {
        setRankings(finalRankings)
        setWinnerPlayer(wPlayer)
        recordOnlineMatchResult(finalRankings)
      }, 3500)
    }

    const handleStateResynced = (gameState: any) => {
      try {
        if (gameState.tokens && Array.isArray(gameState.tokens)) {
          const enriched = gameState.tokens.map((tk: any) => {
            const player = formattedPlayersRef.current[tk.playerId] || formattedPlayers[tk.playerId]
            const tokenColor = tk.color || player?.color || currentColorsOrder[tk.playerId] || 'yellow'
            return {
              id: tk.id,
              playerId: tk.playerId,
              color: tokenColor,
              step: typeof tk.step === 'number' ? tk.step : -1
            }
          })
          setTokens(enriched)
          tokensRef.current = enriched
        }
        if (gameState.currentTurn) {
          setCurrentTurnPlayerId(gameState.currentTurn)
          currentTurnPlayerIdRef.current = gameState.currentTurn
        }
        setIsRolling(false)
        isRollingRef.current = false
        setIsAnimatingMove(false)
        isAnimatingMoveRef.current = false
        setMoveSelectorTokenId(null)
        showToast('🔄 Partida sincronizada.')
      } catch (err) {
        console.error('Error procesando event_state_resynced:', err)
      }
    }

    const handleEventChat = (data: { playerId?: string; senderId?: string; message?: string; text?: string }) => {
      const senderId = data.playerId || data.senderId || ''
      const msg = data.message || data.text || ''
      if (!msg) return

      // Translate senderId (UUID/socketId/slotIndex) to seat index (0..5)
      let targetSeatIndex = -1
      if (senderId) {
        targetSeatIndex = dynamicPlayers.findIndex(
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
    socket.on('event_turn_timeout', handleTurnTimeout)
    socket.on('event_dice_result', handleDiceResult)
    socket.on('event_token_moved', handleTokenMoved)
    socket.on('event_player_disconnected', handlePlayerDisconnected)
    socket.on('event_player_reconnected', handlePlayerReconnected)
    socket.on('event_player_expelled', handlePlayerExpelled)
    socket.on('event_game_over_by_abandonment', handleGameOverAbandonment)
    socket.on('event_room_expired', handleRoomExpired)
    socket.on('event_state_resynced', handleStateResynced)
    socket.on('event_chat', handleEventChat)
    socket.on('player_reaction', handleEventChat)

    return () => {
      socket.off('connect', handleSocketConnect)
      window.removeEventListener('online', handleSocketConnect)
      socket.off('event_turn_started', handleTurnStarted)
      socket.off('event_turn_timeout', handleTurnTimeout)
      socket.off('event_dice_result', handleDiceResult)
      socket.off('event_token_moved', handleTokenMoved)
      socket.off('event_player_disconnected', handlePlayerDisconnected)
      socket.off('event_player_reconnected', handlePlayerReconnected)
      socket.off('event_player_expelled', handlePlayerExpelled)
      socket.off('event_game_over_by_abandonment', handleGameOverAbandonment)
      socket.off('event_room_expired', handleRoomExpired)
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
    // BUG FIX v8.0.6: Reset timeout flag so human roll is never confused with auto-roll
    isProcessingTimeoutRef.current = false
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
    const goalStep = getGoalStep(isHexGame)

    if (startStep <= (isHexGame ? 0 : -1)) {
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
    // BUG FIX v8.0.6: Use hasRolledRef.current (live ref) not hasRolled (stale closure)
    if (!isMyTurnRef.current || isAnimatingMoveRef.current || isRollingRef.current || !hasRolledRef.current) return
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

      const isBase = isHexGame ? token.step <= 0 : token.step < 0
      if (isBase) {
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
    
    // Si era nuestro turno al salir, intentamos pasar el turno limpiamente
    if (isMyTurnRef.current) {
      const activeIdx = activePlayerIndexRef.current
      const nextPlayerIndex = getNextActivePlayerIndex(activeIdx, dynamicPlayers.length)

      // Traducir nuestro índice local al ID nativo de Android
      const targetSlot = dynamicPlayers[nextPlayerIndex]?.slotIndex ?? nextPlayerIndex
      const androidColorId = slotToAndroidColorId[targetSlot] ?? targetSlot

      const targetPlayerId = dynamicPlayers[nextPlayerIndex]?.playerId || dynamicPlayers[nextPlayerIndex]?.id || nextPlayerIndex

      socket.emit('intent_end_turn', {
        roomId: gameData.roomId,
        nextPlayerId: androidColorId,
        nextTurnId: androidColorId,
        explicitNetworkId: targetPlayerId
      })
    }
    
    // Limpieza autoritativa en el servidor al abandonar la partida
    if (socket) {
      socket.emit('intent_leave_room', { 
        roomId: gameData.roomId, 
        playerId: myPlayerId 
      })
      socket.emit('leave_matchmaking', { 
        playerId: myPlayerId 
      })
    }
    
    onExit()
  }

  return (
    <div className="h-[100dvh] md:h-auto md:min-h-screen w-full flex flex-col font-sans cyber-bg text-foreground relative overflow-hidden items-center">
      
      {/* Upper Navigation & Sound controls */}
      <header className="w-full bg-root/80 backdrop-blur-md border-b border-[var(--panel-header-border,oklch(0.82_0.15_200/0.2))] px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between sticky top-0 z-50 cyber-game-panel shadow-[0_4px_30px_oklch(0.82_0.15_200/0.05)] shrink-0">
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
              <div className="flex justify-between items-center bg-gray-800/80 p-2 rounded">
                <span className="text-gray-300 font-bold">Modo</span>
                <span className="text-p-blue font-bold">Online Síncrono</span>
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
      <div className="relative w-full flex-1 flex flex-col items-center justify-center min-h-0 md:min-h-[600px] z-10 overflow-hidden">
        
        {/* Center Game Board */}
        {(() => {
          const myColor = formattedPlayers[myPlayerIndex >= 0 ? myPlayerIndex : 0]?.color || 'yellow';
          let rotationOffset = 0;
          if (isHexGame) {
            const hexInfo = HEX_COLOR_INFO[myColor as HexPlayerColor];
            const sectorIndex = hexInfo ? hexInfo.sectorIndex : 4;
            rotationOffset = 300 - sectorIndex * 60;
          } else {
            switch (myColor) {
              case 'red': rotationOffset = 0; break;
              case 'green': rotationOffset = -90; break;
              case 'blue': rotationOffset = 180; break;
              case 'yellow': rotationOffset = 90; break;
            }
          }

          return (
            <div 
              className={cn(
                "z-10 mx-auto flex items-center justify-center",
                "w-full max-w-[100vw] px-1 md:px-0",
                isHexGame ? "aspect-square max-w-[var(--board-max)]" : "max-w-[var(--board-max)]"
              )}
              style={{ '--board-max': 'min(700px, calc((100dvh - 160px) * 0.96))' } as React.CSSProperties}
            >
              <div 
                className="relative mx-auto w-full flex items-center justify-center"
                style={{
                  transform: `rotate(${rotationOffset}deg)`,
                  transformOrigin: 'center center',
                }}
              >
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
                    rotationOffset={rotationOffset}
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
                    rotationOffset={rotationOffset}
                  />
                )}
              </div>
            </div>
          );
        })()}

        {/* Corners with PlayerCorners */}
        {(() => {
          const activePlayers = formattedPlayers;
          const baseIdx = myPlayerIndex >= 0 ? myPlayerIndex : 0;

          return activePlayers.map((p, index) => {
            const offset = (index - baseIdx + activePlayers.length) % activePlayers.length;
            let pos: 'bottom-left' | 'bottom-right' | 'top-right' | 'top-left' | 'mid-left' | 'mid-right' = 'bottom-left';

            if (isHexGame) {
              const HEX_COLORS_ORDER = ['purple', 'red', 'yellow', 'orange', 'blue', 'green'];
              const myColor = activePlayers[baseIdx]?.color || 'orange';
              const mySeatIndex = HEX_COLORS_ORDER.indexOf(myColor);
              const playerSeatIndex = HEX_COLORS_ORDER.indexOf(p.color);
              const seatOffset = (playerSeatIndex - mySeatIndex + 6) % 6;
              const hexPositions: ('bottom-left' | 'bottom-right' | 'mid-right' | 'top-right' | 'top-left' | 'mid-left')[] = [
                'bottom-left',   // seatOffset 0 (Usuario Local)
                'bottom-right',  // seatOffset 1
                'mid-right',     // seatOffset 2
                'top-right',     // seatOffset 3
                'top-left',      // seatOffset 4
                'mid-left'       // seatOffset 5
              ];
              pos = hexPositions[seatOffset] || 'bottom-left';
            } else {
              // Tablero cuadrado online (perspectiva dinámica local: mi casa siempre abajo a la izquierda)
              const SQUARE_SEAT_ORDER: PlayerColor[] = ['yellow', 'red', 'green', 'blue']
              const myColor = (formattedPlayers[baseIdx]?.color || 'yellow') as PlayerColor
              const mySeatIndex = SQUARE_SEAT_ORDER.indexOf(myColor)
              const playerSeatIndex = SQUARE_SEAT_ORDER.indexOf(p.color as PlayerColor)
              const seatOffset = (playerSeatIndex - (mySeatIndex >= 0 ? mySeatIndex : 0) + 4) % 4

              const squarePositions: ('bottom-left' | 'top-left' | 'top-right' | 'bottom-right')[] = [
                'bottom-left',   // seatOffset 0 (Usuario Local)
                'top-left',      // seatOffset 1
                'top-right',     // seatOffset 2
                'bottom-right'   // seatOffset 3
              ]
              pos = squarePositions[seatOffset] || 'bottom-left'
            }

            const isActiveTurn = activePlayerIndex >= 0 && activePlayerIndex === p.id && currentTurnPlayerId !== '';
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
                      getGoalStep(isHexGame)
                    );
                const pCount = dynamicPlayers.length
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
