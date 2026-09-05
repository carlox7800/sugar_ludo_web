import { db } from './firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { recordWalletTransaction } from './wallet-service'

export interface SupportReply {
  id: string
  sender: string
  senderRole: 'player' | 'cashier' | 'support'
  message: string
  timestamp: number
  attachmentUrl?: string
}

export interface MailItem {
  id: string
  title: string
  sender: string
  date: string
  category: 'rewards' | 'system' | 'support'
  isRead: boolean
  claimed?: boolean
  rewardSC?: number
  content: string
  badge?: string
  timestamp: number
  orderId?: string
  status?: 'pending' | 'resolved'
  cashierReadAt?: number
  playerReadAt?: number
  replies?: SupportReply[]
}

export const DEFAULT_INITIAL_MAILS: MailItem[] = [
  {
    id: 'mail_welcome_bonus',
    title: '¡Bono de Bienvenida Oficial!',
    sender: 'Equipo Sugar Ludo',
    date: 'Hoy',
    category: 'rewards',
    isRead: false,
    claimed: false,
    rewardSC: 500,
    badge: 'Regalo VIP',
    content: '¡Te damos la bienvenida al Arena oficial de Sugar Ludo! Recibe este paquete inicial de 500 Sugar Coins para participar en tus primeras partidas competitivas y desbloquear aspectos en la Tienda Oficial.',
    timestamp: Date.now()
  },
  {
    id: 'mail_patch_v852',
    title: 'Notas de Actualización v8.5.2',
    sender: 'Dirección de Desarrollo',
    date: 'Hoy',
    category: 'system',
    isRead: false,
    content: 'Hemos desplegado la versión v8.5.2 con Emotes Animados Vectoriales AAA a 60 FPS, Reacciones de chat en burbujas flotantes, y el motor de Potenciadores XP con multiplicador real en partidas.',
    timestamp: Date.now() - 3600000
  },
  {
    id: 'mail_calibration_prize',
    title: 'Premio por Calibración y Rendimiento',
    sender: 'Soporte Técnico',
    date: 'Ayer',
    category: 'rewards',
    isRead: false,
    claimed: false,
    rewardSC: 200,
    badge: 'Compensación',
    content: 'Gracias por tu preferencia durante la calibración de nuestros servidores y optimizaciones de carga visual en la Tienda. Te enviamos 200 Sugar Coins de agradecimiento.',
    timestamp: Date.now() - 86400000
  },
  {
    id: 'mail_fair_play_tips',
    title: 'Consejos de Seguridad y Juego Limpio',
    sender: 'Seguridad Sugar Ludo',
    date: '16 Ago, 2026',
    category: 'system',
    isRead: true,
    content: 'Recuerda que nunca te solicitaremos tus claves privadas ni información confidencial por canales no oficiales. Juega seguro y disfruta del juego limpio en el Arena.',
    timestamp: Date.now() - 172800000
  }
]

export async function fetchUserInbox(userId?: string): Promise<MailItem[]> {
  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      const snap = await getDoc(userRef)
      if (snap.exists()) {
        const data = snap.data()
        if (Array.isArray(data.inbox) && data.inbox.length > 0) {
          return (data.inbox as MailItem[]).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        }
        // Initialize default inbox for new user in Firestore
        await updateDoc(userRef, { inbox: DEFAULT_INITIAL_MAILS })
        return DEFAULT_INITIAL_MAILS
      }
    } catch (error) {
      console.warn('Error fetching inbox from Firestore:', error)
    }
  }

  // LocalStorage Fallback
  if (typeof window !== 'undefined') {
    const local = localStorage.getItem('sugar_user_inbox')
    if (local) {
      try {
        return JSON.parse(local)
      } catch {}
    }
    localStorage.setItem('sugar_user_inbox', JSON.stringify(DEFAULT_INITIAL_MAILS))
  }
  return DEFAULT_INITIAL_MAILS
}

export async function claimMailReward(
  userId: string | undefined, 
  mailId: string,
  addCoinsDirectFn?: (amount: number) => void
): Promise<{ success: boolean; coinsAdded: number; message: string }> {
  const inbox = await fetchUserInbox(userId)
  const mailIndex = inbox.findIndex(m => m.id === mailId)
  if (mailIndex === -1) {
    return { success: false, coinsAdded: 0, message: 'Correo no encontrado.' }
  }

  const mail = inbox[mailIndex]
  if (mail.claimed) {
    return { success: false, coinsAdded: 0, message: 'Esta recompensa ya fue reclamada.' }
  }

  const reward = Number(mail.rewardSC || 0)
  if (reward <= 0) {
    return { success: false, coinsAdded: 0, message: 'Este correo no contiene recompensas.' }
  }

  // Update in-memory
  inbox[mailIndex].claimed = true
  inbox[mailIndex].isRead = true

  // Record in Firestore or LocalStorage
  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, { inbox })
      await recordWalletTransaction(userId, {
        type: 'bonus',
        amount: reward,
        description: 'Buzon de Recompensas: ' + mail.title
      })
    } catch (e) {
      console.warn('Firestore claim reward error:', e)
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('sugar_user_inbox', JSON.stringify(inbox))
    if (!userId || userId.startsWith('dev_')) {
      const cur = parseInt(localStorage.getItem('sugar_player_coins') || '200', 10)
      localStorage.setItem('sugar_player_coins', (cur + reward).toString())
    }
    window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
  }

  if (addCoinsDirectFn) {
    addCoinsDirectFn(reward)
  }

  return {
    success: true,
    coinsAdded: reward,
    message: 'Has reclamado ' + reward + ' Sugar Coins con exito!'
  }
}

export async function claimAllRewards(
  userId: string | undefined,
  addCoinsDirectFn?: (amount: number) => void
): Promise<{ success: boolean; totalCoins: number; count: number }> {
  const inbox = await fetchUserInbox(userId)
  let totalCoins = 0
  let count = 0

  inbox.forEach(mail => {
    if (!mail.claimed && (mail.rewardSC || 0) > 0) {
      mail.claimed = true
      mail.isRead = true
      totalCoins += Number(mail.rewardSC)
      count++
    }
  })

  if (count === 0) {
    return { success: false, totalCoins: 0, count: 0 }
  }

  // Persist
  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, { inbox })
      await recordWalletTransaction(userId, {
        type: 'bonus',
        amount: totalCoins,
        description: 'Reclamo total de buzon (' + count + ' recompensas)'
      })
    } catch (e) {
      console.warn('Firestore claim all error:', e)
    }
  }

  if (typeof window !== 'undefined') {
    localStorage.setItem('sugar_user_inbox', JSON.stringify(inbox))
    if (!userId || userId.startsWith('dev_')) {
      const cur = parseInt(localStorage.getItem('sugar_player_coins') || '200', 10)
      localStorage.setItem('sugar_player_coins', (cur + totalCoins).toString())
    }
    window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
  }

  if (addCoinsDirectFn) {
    addCoinsDirectFn(totalCoins)
  }

  return { success: true, totalCoins, count }
}

export async function markMailAsRead(userId: string | undefined, mailId: string): Promise<void> {
  const inbox = await fetchUserInbox(userId)
  const cleanId = mailId.replace(/^mail_ord_sup_/, '').replace(/^mail_sup_/, '')
  let updatedAny = false

  inbox.forEach(m => {
    const mCleanId = m.id.replace(/^mail_ord_sup_/, '').replace(/^mail_sup_/, '')
    if (m.id === mailId || mCleanId === cleanId || (m.orderId && (m.orderId === mailId || m.orderId === cleanId))) {
      if (!m.isRead) {
        m.isRead = true
        updatedAny = true
      }
    }
  })

  if (updatedAny) {
    if (userId && !userId.startsWith('dev_')) {
      try {
        const userRef = doc(db, 'users', userId)
        await updateDoc(userRef, { inbox })
      } catch (err) {
        console.warn('[MailService] Error actualizando inbox en Firestore:', err)
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('sugar_user_inbox', JSON.stringify(inbox))
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
    }
  } else {
    // Si era un mensaje cargado de cashier_orders, notificar de todos modos para sincronizar
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
    }
  }
}

export async function markAllMailsAsRead(userId: string | undefined): Promise<void> {
  const inbox = await fetchUserInbox(userId)
  inbox.forEach(m => { m.isRead = true })
  if (userId && !userId.startsWith('dev_')) {
    try {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, { inbox })
    } catch {}
  }
  if (typeof window !== 'undefined') {
    localStorage.setItem('sugar_user_inbox', JSON.stringify(inbox))
    window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
  }
}

/**
 * purgeOrphanInboxItems: Marca TODOS los elementos de user.inbox como isRead=true y claimed=true
 * en Firestore. Elimina cualquier entrada que causara el badge fantasma invisible.
 * También resetea el localStorage y dispara actualización del Sidebar.
 */
export async function purgeOrphanInboxItems(userId: string | undefined): Promise<void> {
  try {
    if (userId && !userId.startsWith('dev_')) {
      const userRef = doc(db, 'users', userId)
      const snap = await getDoc(userRef)
      if (snap.exists()) {
        const data = snap.data()
        const inbox = Array.isArray(data.inbox) ? data.inbox : []
        // Marcar todo como leído y reclamado para que no sume al contador
        const purged = inbox.map((m: any) => ({ ...m, isRead: true, claimed: true }))
        await updateDoc(userRef, { inbox: purged })
        if (typeof window !== 'undefined') {
          localStorage.setItem('sugar_user_inbox', JSON.stringify(purged))
          window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
        }
        return
      }
    }
    // Dev fallback: limpiar localStorage directamente
    if (typeof window !== 'undefined') {
      localStorage.removeItem('sugar_user_inbox')
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
    }
  } catch (e) {
    console.warn('[MailService] Error en purgeOrphanInboxItems:', e)
  }
}

const HIDDEN_MAILS_KEY = 'sugar_hidden_mails'

export function getHiddenMails(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(HIDDEN_MAILS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function hideMailLocal(mailId: string) {
  if (typeof window === 'undefined') return
  try {
    const current = getHiddenMails()
    if (!current.includes(mailId)) {
      current.push(mailId)
      localStorage.setItem(HIDDEN_MAILS_KEY, JSON.stringify(current))
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
    }
  } catch {}
}

export function hideMailsBatchLocal(mailIds: string[]) {
  if (typeof window === 'undefined' || !mailIds.length) return
  try {
    const current = new Set(getHiddenMails())
    mailIds.forEach(id => current.add(id))
    localStorage.setItem(HIDDEN_MAILS_KEY, JSON.stringify(Array.from(current)))
    window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
  } catch {}
}

export async function deleteMailsBatch(userId: string | undefined, mailIds: string[]): Promise<void> {
  if (!mailIds.length) return
  
  // 1. Ocultar localmente (sirve tanto para mensajes de orden P2P como para mensajes regulares)
  hideMailsBatchLocal(mailIds)

  // 2. Si hay mensajes vinculados a órdenes de soporte P2P, actualizar cashier_orders en Firestore
  const orderIdsToMark = mailIds
    .map(id => id.startsWith('mail_ord_sup_') ? id.replace('mail_ord_sup_', '') : (id.startsWith('mail_sup_') ? id.replace('mail_sup_', '') : null))
    .filter(Boolean) as string[]

  if (orderIdsToMark.length > 0 && userId && !userId.startsWith('dev_')) {
    orderIdsToMark.forEach(async (orderId) => {
      try {
        const orderRef = doc(db, 'cashier_orders', orderId)
        await updateDoc(orderRef, {
          hasUnreadCashierMessage: false,
          playerReadAt: Date.now()
        })
      } catch (err) {
        console.debug('[MailService] Error actualizando cashier_orders al borrar:', err)
      }
    })
  }

  // 3. Remover de user.inbox cualquier mensaje regular o mensaje legado de soporte (mail_sup_ / orderId)
  let inbox = await fetchUserInbox(userId)
  const initialLength = inbox.length
  const idSet = new Set(mailIds)
  const orderIdSet = new Set(orderIdsToMark)

  inbox = inbox.filter(m => {
    if (idSet.has(m.id)) return false
    if (m.orderId && orderIdSet.has(m.orderId)) return false
    if (m.id && orderIdsToMark.some(oid => m.id.includes(oid))) return false
    return true
  })

  if (inbox.length !== initialLength) {
    if (userId && !userId.startsWith('dev_')) {
      try {
        const userRef = doc(db, 'users', userId)
        await updateDoc(userRef, { inbox })
      } catch {}
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('sugar_user_inbox', JSON.stringify(inbox))
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
    }
  }
}

export async function deleteMail(userId: string | undefined, mailId: string): Promise<void> {
  await deleteMailsBatch(userId, [mailId])
}

export async function getUnreadMailCount(userId?: string): Promise<number> {
  const inbox = await fetchUserInbox(userId)
  return inbox.filter(m => !m.isRead || (!m.claimed && (m.rewardSC || 0) > 0)).length
}

export async function sendSupportMail(
  userId: string,
  mailData: {
    title: string
    sender: string
    content: string
    orderId?: string
    badge?: string
  }
): Promise<boolean> {
  try {
    const inbox = await fetchUserInbox(userId)
    const newMail: MailItem = {
      id: `mail_sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: mailData.title,
      sender: mailData.sender,
      date: 'Hoy',
      category: 'support',
      isRead: false,
      content: mailData.content,
      badge: mailData.badge || 'Soporte P2P',
      orderId: mailData.orderId,
      status: 'pending',
      timestamp: Date.now(),
      replies: []
    }

    const updated = [newMail, ...inbox]

    if (userId && !userId.startsWith('dev_')) {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, { inbox: updated })
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('sugar_user_inbox', JSON.stringify(updated))
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
    }

    return true
  } catch (e) {
    console.warn('Error sending support mail:', e)
    return false
  }
}

export async function replySupportMail(
  userId: string | undefined,
  mailId: string,
  replyText: string,
  senderName: string,
  senderRole: 'player' | 'cashier' | 'support' = 'player',
  attachmentUrl?: string
): Promise<boolean> {
  try {
    const inbox = await fetchUserInbox(userId)
    const target = inbox.find(m => m.id === mailId)
    if (!target) return false

    const reply: SupportReply = {
      id: `rep_${Date.now()}`,
      sender: senderName,
      senderRole,
      message: replyText,
      timestamp: Date.now(),
      attachmentUrl
    }

    if (!target.replies) target.replies = []
    target.replies.push(reply)
    target.isRead = true

    if (userId && !userId.startsWith('dev_')) {
      const userRef = doc(db, 'users', userId)
      await updateDoc(userRef, { inbox })
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('sugar_user_inbox', JSON.stringify(inbox))
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
    }

    return true
  } catch (e) {
    console.warn('Error replying to support mail:', e)
    return false
  }
}