/**
 * SUGAR LUDO - SERVICIO DE GESTIÓN DE TICKETS FORMALES (TIER 2)
 * 
 * Gestiona la creación y sincronización de tickets formales con folio único
 * en la colección 'dispute_cases' de Firestore y persistencia local del jugador.
 * Compatible al 100% con la bandeja de arbitraje /admin/disputas del Admin Hub.
 */

import { db } from '../firebase'
import {
  doc,
  setDoc,
  collection,
  query,
  where,
  onSnapshot,
  limit
} from 'firebase/firestore'
import { APP_VERSION } from '../version'
import { globalLogger } from '../logger'
import type { PreValidationResult, IssueDomain } from './pre-validation-engine'

export interface TicketTelemetrySnapshot {
  clientPlatform: 'web' | 'android_capacitor' | 'electron_desktop'
  appVersion: string
  userAgent: string
  lastRoomCode?: string
  recentSocketLogs?: Array<{ timestamp: string; level: string; message: string }>
  accountBalanceAtCreation?: { availableCoins: number; escrowCoins: number }
}

export interface SupportTicketItem {
  id: string
  ticketNumber: string
  orderId: string
  type: 'deposit' | 'withdraw'
  orderType: string
  domain: IssueDomain
  category: string
  playerUid: string
  playerName: string
  cashierUid?: string
  cashierName?: string
  amountFiat: number
  currency: string
  amountSugarCoins: number
  reason: string
  systemSummary: string
  playerNotes: string
  openedBy: 'player'
  openedAt: number
  status: 'open' | 'investigating' | 'resolved_player' | 'resolved_cashier' | 'dismissed' | 'compensated'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  resolvedBy?: string
  resolvedAt?: number
  resolutionNotes?: string
  telemetrySnapshot?: TicketTelemetrySnapshot
  createdAt: number
  updatedAt: number
}

const LOCAL_TICKETS_KEY = 'sugar_player_tickets'

/**
 * Genera un folio legible e inmutable en formato TKT-YYYY-XXXX
 */
export function generateTicketNumber(): string {
  const year = new Date().getFullYear()
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `TKT-${year}-${randomChars}`
}

/**
 * Captura un snapshot instantáneo de telemetría técnica del cliente
 */
export function captureClientTelemetrySnapshot(
  user?: { coins?: number; escrowLockedCoins?: number; inGameCoins?: number },
  lastRoomCode?: string
): TicketTelemetrySnapshot {
  let clientPlatform: 'web' | 'android_capacitor' | 'electron_desktop' = 'web'
  let userAgent = ''

  if (typeof window !== 'undefined') {
    userAgent = navigator?.userAgent || ''
    if ((window as any)?.Capacitor?.isNativePlatform?.()) {
      clientPlatform = 'android_capacitor'
    } else if (userAgent.toLowerCase().includes('electron') || (window as any)?.electronAPI) {
      clientPlatform = 'electron_desktop'
    }
  }

  let recentSocketLogs: Array<{ timestamp: string; level: string; message: string }> = []
  try {
    const allLogs = globalLogger?.getLogs ? globalLogger.getLogs() : []
    const relevant = allLogs.filter(
      (l) => l.level === 'SOCKET' || l.level === 'ERROR' || l.level === 'CRITICAL' || l.level === 'GAME-FLOW'
    )
    recentSocketLogs = relevant.slice(-15).map((l) => ({
      timestamp: l.timestamp,
      level: l.level,
      message: l.message
    }))
  } catch {
    recentSocketLogs = []
  }

  return {
    clientPlatform,
    appVersion: APP_VERSION,
    userAgent,
    ...(lastRoomCode ? { lastRoomCode } : {}),
    recentSocketLogs,
    accountBalanceAtCreation: user
      ? {
          availableCoins: Number(user.coins || 0),
          escrowCoins: Number(user.escrowLockedCoins || user.inGameCoins || 0)
        }
      : undefined
  }
}

/**
 * Limpia recursivamente claves undefined para prevenir errores fatales de Firestore
 */
function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): T {
  const result: any = {}
  for (const [key, val] of Object.entries(obj)) {
    if (val === undefined) continue
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      result[key] = sanitizeFirestorePayload(val)
    } else {
      result[key] = val
    }
  }
  return result
}

/**
 * Obtiene los tickets guardados localmente en el dispositivo
 */
export function getStoredLocalTickets(): SupportTicketItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(LOCAL_TICKETS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Guarda o actualiza un ticket en el almacenamiento local
 */
export function saveLocalTicket(ticket: SupportTicketItem) {
  if (typeof window === 'undefined') return
  try {
    const existing = getStoredLocalTickets()
    const filtered = existing.filter((t) => t.id !== ticket.id)
    filtered.unshift(ticket)
    localStorage.setItem(LOCAL_TICKETS_KEY, JSON.stringify(filtered.slice(0, 30)))
  } catch {}
}

export interface CreateTicketParams {
  playerUid: string
  playerName: string
  preValidation: PreValidationResult
  playerNotes: string
  userBalance?: { coins?: number; escrowLockedCoins?: number; inGameCoins?: number }
  lastRoomCode?: string
}

/**
 * Crea un ticket formal en Firestore 'dispute_cases' y en almacenamiento local
 */
export async function createSupportTicket(params: CreateTicketParams): Promise<SupportTicketItem> {
  const { playerUid, playerName, preValidation, playerNotes, userBalance, lastRoomCode } = params
  const now = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 6)
  const ticketId = `tkt_${now}_${randomSuffix}`
  const ticketNumber = generateTicketNumber()

  const orderId = preValidation.relatedOrderId || 'none'
  const type = preValidation.relatedOrderType === 'withdraw' ? 'withdraw' : 'deposit'
  const domain: IssueDomain = preValidation.domain || (
    preValidation.category === 'transactions' ? 'financial' :
    preValidation.category === 'gameplay' ? 'gameplay' : 'account'
  )

  const telemetry = captureClientTelemetrySnapshot(userBalance, lastRoomCode)

  const ticket: SupportTicketItem = {
    id: ticketId,
    ticketNumber,
    orderId,
    type,
    orderType: preValidation.relatedOrderType || preValidation.category,
    domain,
    category: preValidation.category,
    playerUid,
    playerName: playerName || 'Jugador Sugar',
    cashierUid: preValidation.cashierUid || 'staff_support',
    cashierName: preValidation.cashierName || 'Soporte y Auditoría',
    amountFiat: Number(preValidation.amountFiat || 0),
    currency: preValidation.currency || 'USDT',
    amountSugarCoins: Number(preValidation.amountSugarCoins || 0),
    reason: `[${ticketNumber}] ${preValidation.title}`,
    systemSummary: preValidation.systemSummary || '',
    playerNotes: playerNotes.trim(),
    openedBy: 'player',
    openedAt: now,
    status: 'open',
    priority: preValidation.suggestedPriority || 'normal',
    telemetrySnapshot: telemetry,
    createdAt: now,
    updatedAt: now
  }

  // 1. Guardado optimista en caché local
  saveLocalTicket(ticket)

  // 2. Persistencia en Firestore (colección dispute_cases)
  try {
    const ticketRef = doc(db, 'dispute_cases', ticketId)
    await setDoc(ticketRef, sanitizeFirestorePayload(ticket))
  } catch (err) {
    console.warn('[TicketService] Advertencia al persistir en dispute_cases:', err)
  }

  return ticket
}

/**
 * Escucha en tiempo real los tickets del jugador con pausa automática al ocultar la app ($0.00)
 */
export function subscribeToPlayerTickets(
  playerUid: string,
  onUpdate: (tickets: SupportTicketItem[]) => void
): () => void {
  if (typeof window === 'undefined' || !playerUid) {
    return () => {}
  }

  let unsubscribeSnapshot: (() => void) | null = null

  const startListener = () => {
    if (document.hidden) return
    if (unsubscribeSnapshot) return

    try {
      const q = query(
        collection(db, 'dispute_cases'),
        where('playerUid', '==', playerUid),
        limit(15)
      )

      unsubscribeSnapshot = onSnapshot(
        q,
        (snap) => {
          const liveTickets: SupportTicketItem[] = snap.docs.map((d) => {
            const data = d.data() as any
            const inferredDomain: IssueDomain = data.domain || (
              data.category === 'transactions' || (data.orderId && data.orderId !== 'none') ? 'financial' :
              data.category === 'gameplay' ? 'gameplay' : 'account'
            )

            return {
              id: d.id,
              ticketNumber: data.ticketNumber || `TKT-${d.id.slice(-6).toUpperCase()}`,
              orderId: data.orderId || 'none',
              type: data.type || 'deposit',
              orderType: data.orderType || 'general',
              domain: inferredDomain,
              category: data.category || 'account',
              playerUid: data.playerUid || playerUid,
              playerName: data.playerName || 'Jugador',
              cashierUid: data.cashierUid,
              cashierName: data.cashierName,
              amountFiat: Number(data.amountFiat || 0),
              currency: data.currency || 'USD',
              amountSugarCoins: Number(data.amountSugarCoins || 0),
              reason: data.reason || 'Ticket de Soporte',
              systemSummary: data.systemSummary || '',
              playerNotes: data.playerNotes || '',
              openedBy: data.openedBy || 'player',
              openedAt: Number(data.openedAt || data.createdAt || Date.now()),
              status: data.status || 'open',
              priority: data.priority || 'normal',
              resolvedBy: data.resolvedBy,
              resolvedAt: data.resolvedAt,
              resolutionNotes: data.resolutionNotes,
              telemetrySnapshot: data.telemetrySnapshot,
              createdAt: Number(data.createdAt || Date.now()),
              updatedAt: Number(data.updatedAt || Date.now())
            }
          })

          // Combinar con locales y ordenar por fecha más reciente
          const localTickets = getStoredLocalTickets()
          const combinedMap = new Map<string, SupportTicketItem>()

          localTickets.forEach((t) => combinedMap.set(t.id, t))
          liveTickets.forEach((t) => {
            combinedMap.set(t.id, t)
            saveLocalTicket(t) // Sincronizar actualización local (ej. estado resuelto)
          })

          const sorted = Array.from(combinedMap.values()).sort((a, b) => b.createdAt - a.createdAt)
          onUpdate(sorted)
        },
        () => {
          // Fallback a los almacenados localmente si la conexión falla
          onUpdate(getStoredLocalTickets())
        }
      )
    } catch {
      onUpdate(getStoredLocalTickets())
    }
  }

  const stopListener = () => {
    if (unsubscribeSnapshot) {
      unsubscribeSnapshot()
      unsubscribeSnapshot = null
    }
  }

  const handleVisibilityChange = () => {
    if (document.hidden) {
      stopListener()
    } else {
      startListener()
    }
  }

  // Notificar estado local inicial de inmediato en 0ms
  onUpdate(getStoredLocalTickets())
  startListener()

  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    stopListener()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}
