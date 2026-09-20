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
  limit,
  orderBy
} from 'firebase/firestore'
import { PreValidationResult } from './pre-validation-engine'

export interface SupportTicketItem {
  id: string
  ticketNumber: string
  orderId: string
  type: 'deposit' | 'withdraw'
  orderType: string
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
  status: 'open' | 'investigating' | 'resolved_player' | 'resolved_cashier'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  resolvedBy?: string
  resolvedAt?: number
  resolutionNotes?: string
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
}

/**
 * Crea un ticket formal en Firestore 'dispute_cases' y en almacenamiento local
 */
export async function createSupportTicket(params: CreateTicketParams): Promise<SupportTicketItem> {
  const { playerUid, playerName, preValidation, playerNotes } = params
  const now = Date.now()
  const randomSuffix = Math.random().toString(36).substring(2, 6)
  const ticketId = `tkt_${now}_${randomSuffix}`
  const ticketNumber = generateTicketNumber()

  const orderId = preValidation.relatedOrderId || 'none'
  const type = preValidation.relatedOrderType === 'withdraw' ? 'withdraw' : 'deposit'

  const ticket: SupportTicketItem = {
    id: ticketId,
    ticketNumber,
    orderId,
    type,
    orderType: preValidation.relatedOrderType || preValidation.category,
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
    createdAt: now,
    updatedAt: now
  }

  // 1. Guardado optimista en caché local
  saveLocalTicket(ticket)

  // 2. Persistencia en Firestore (colección dispute_cases)
  try {
    const ticketRef = doc(db, 'dispute_cases', ticketId)
    await setDoc(ticketRef, ticket)
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
            return {
              id: d.id,
              ticketNumber: data.ticketNumber || `TKT-${d.id.slice(-6).toUpperCase()}`,
              orderId: data.orderId || 'none',
              type: data.type || 'deposit',
              orderType: data.orderType || 'general',
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
