import { db } from './firebase'
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  increment,
  where
} from 'firebase/firestore'
import { StaffChatMessage } from '../types/admin-expanded'

export interface PrivateChatMeta {
  cashierUid: string
  cashierName?: string
  lastMessage?: string
  lastTimestamp?: number
  unreadByAdmin: number
  unreadByCashier: number
  updatedAt?: number
}

/**
 * 1. DIFUSIÓN MASIVA (ADMIN -> TODOS LOS CAJEROS)
 */
export function subscribeToBroadcastMessages(
  callback: (messages: StaffChatMessage[]) => void
): () => void {
  try {
    const q = query(
      collection(db, 'staff_broadcast_messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    )
    return onSnapshot(q, (snap) => {
      const seenIds = new Set<string>()
      const msgs: StaffChatMessage[] = []
      snap.docs.forEach((d) => {
        if (!seenIds.has(d.id)) {
          seenIds.add(d.id)
          const data = d.data()
          msgs.push({
            id: d.id,
            senderUid: data.senderUid || 'adm_super',
            senderName: data.senderName || 'Super Admin',
            senderRole: (data.senderRole || 'super_admin') as any,
            message: data.message || '',
            timestamp: data.timestamp || Date.now()
          })
        }
      })
      callback(msgs)
    }, (err) => {
      console.warn('[StaffChat] Error en listener de difusión:', err)
      callback([])
    })
  } catch {
    return () => {}
  }
}

let lastBroadcastTextSent = ''
let lastBroadcastTimestampSent = 0

export async function sendBroadcastMessage(
  adminUid: string,
  adminName: string,
  text: string
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) return

  const now = Date.now()
  // Candado contra doble disparo accidental (mismo texto en menos de 1500ms)
  if (trimmed === lastBroadcastTextSent && now - lastBroadcastTimestampSent < 1500) {
    console.warn('[StaffChat] Descartado envío duplicado de difusión masiva:', trimmed)
    return
  }
  lastBroadcastTextSent = trimmed
  lastBroadcastTimestampSent = now

  await addDoc(collection(db, 'staff_broadcast_messages'), {
    senderUid: adminUid,
    senderName: adminName,
    senderRole: 'super_admin',
    message: trimmed,
    timestamp: now
  })

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      const channel = new BroadcastChannel('sugar_ludo_social_channel')
      channel.postMessage({
        type: 'staff_broadcast_received',
        payload: { text: trimmed, timestamp: now }
      })
      channel.close()
    } catch {}
  }
}

export const CANONICAL_PRIMARY_CASHIER_UID = 'csh_carlosandroid_001'

export function normalizeCashierUid(uid?: string | null): string {
  if (!uid || uid === 'csh_primary' || uid === 'primary' || uid === 'cajero') {
    return CANONICAL_PRIMARY_CASHIER_UID
  }
  return uid.trim()
}

/**
 * 2. CHAT PRIVADO (ADMIN <-> CAJERO ESPECÍFICO)
 */
export function subscribeToCashierPrivateMessages(
  cashierUid: string,
  callback: (messages: StaffChatMessage[]) => void
): () => void {
  const targetUid = normalizeCashierUid(cashierUid)
  if (!targetUid) return () => {}
  try {
    const q = query(
      collection(db, 'staff_private_chats', targetUid, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    )
    return onSnapshot(q, (snap) => {
      const msgs: StaffChatMessage[] = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          senderUid: data.senderUid,
          senderName: data.senderName,
          senderRole: data.senderRole,
          message: data.message,
          timestamp: data.timestamp
        }
      })
      callback(msgs)
    }, (err) => {
      console.warn(`[StaffChat] Error listener privado de ${targetUid}:`, err)
      callback([])
    })
  } catch {
    return () => {}
  }
}

export async function sendPrivateMessage(params: {
  senderUid: string
  senderName: string
  senderRole: 'super_admin' | 'cashier'
  cashierUid: string
  cashierName?: string
  text: string
}): Promise<void> {
  const { senderUid, senderName, senderRole, cashierUid, cashierName, text } = params
  const targetUid = normalizeCashierUid(cashierUid)
  const now = Date.now()

  // 1. Agregar mensaje a la subcolección
  const msgRef = collection(db, 'staff_private_chats', targetUid, 'messages')
  await addDoc(msgRef, {
    senderUid,
    senderName,
    senderRole,
    message: text.trim(),
    timestamp: now
  })

  // 2. Actualizar metadatos del hilo y sumar no leídos
  const chatMetaRef = doc(db, 'staff_private_chats', targetUid)
  const isFromAdmin = senderRole === 'super_admin'

  await setDoc(chatMetaRef, {
    cashierUid: targetUid,
    cashierName: cashierName || targetUid,
    lastMessage: text.trim(),
    lastTimestamp: now,
    unreadByAdmin: isFromAdmin ? 0 : increment(1),
    unreadByCashier: isFromAdmin ? increment(1) : 0,
    updatedAt: now
  }, { merge: true })
}

export async function markPrivateChatAsReadByAdmin(cashierUid: string): Promise<void> {
  const targetUid = normalizeCashierUid(cashierUid)
  if (!targetUid) return
  try {
    const chatMetaRef = doc(db, 'staff_private_chats', targetUid)
    await setDoc(chatMetaRef, {
      unreadByAdmin: 0,
      updatedAt: Date.now()
    }, { merge: true })
  } catch (err) {
    console.error('[StaffChat] Error en markPrivateChatAsReadByAdmin:', err)
  }
}

export async function markPrivateChatAsReadByCashier(cashierUid: string): Promise<void> {
  const targetUid = normalizeCashierUid(cashierUid)
  if (!targetUid) return
  try {
    const chatMetaRef = doc(db, 'staff_private_chats', targetUid)
    await setDoc(chatMetaRef, {
      unreadByCashier: 0,
      updatedAt: Date.now()
    }, { merge: true })
  } catch (err) {
    console.error('[StaffChat] Error en markPrivateChatAsReadByCashier:', err)
  }
}

/**
 * 3. METADATOS GLOBALES DE CHATS PRIVADOS (PARA BADGES EN NAVBAR Y SELECTORES)
 */
export function subscribeToAllPrivateChatsMeta(
  callback: (metas: Record<string, PrivateChatMeta>) => void
): () => void {
  try {
    const q = query(collection(db, 'staff_private_chats'), limit(50))
    return onSnapshot(q, (snap) => {
      const map: Record<string, PrivateChatMeta> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        const normId = normalizeCashierUid(d.id)
        map[normId] = {
          cashierUid: normId,
          cashierName: data.cashierName,
          lastMessage: data.lastMessage,
          lastTimestamp: data.lastTimestamp,
          unreadByAdmin: Number(data.unreadByAdmin || 0),
          unreadByCashier: Number(data.unreadByCashier || 0),
          updatedAt: data.updatedAt
        }
      })
      callback(map)
    }, (err) => {
      console.warn('[StaffChat] Error en listener de metadatos de chat:', err)
      callback({})
    })
  } catch {
    return () => {}
  }
}

export function subscribeToCashierChatMeta(
  cashierUid: string,
  callback: (meta: PrivateChatMeta | null) => void
): () => void {
  const targetUid = normalizeCashierUid(cashierUid)
  if (!targetUid) return () => {}
  try {
    const docRef = doc(db, 'staff_private_chats', targetUid)
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        callback({
          cashierUid: targetUid,
          cashierName: data.cashierName,
          lastMessage: data.lastMessage,
          lastTimestamp: data.lastTimestamp,
          unreadByAdmin: Number(data.unreadByAdmin || 0),
          unreadByCashier: Number(data.unreadByCashier || 0),
          updatedAt: data.updatedAt
        })
      } else {
        callback(null)
      }
    }, () => {
      callback(null)
    })
  } catch {
    return () => {}
  }
}

/**
 * 4. SEGUIMIENTO DE COMUNICADOS DE DIFUSIÓN NO LEÍDOS POR CAJERO (SINCRONIZADO MULTI-TERMINAL)
 */
export function getCashierLastReadBroadcastTime(cashierUid: string): number {
  const targetUid = normalizeCashierUid(cashierUid)
  if (typeof window === 'undefined' || !targetUid) return 0
  try {
    const val = localStorage.getItem(`sugar_cashier_last_read_broadcast_${targetUid}`)
    return val ? parseInt(val, 10) : 0
  } catch {
    return 0
  }
}

export async function markBroadcastAsReadByCashier(cashierUid: string): Promise<void> {
  const targetUid = normalizeCashierUid(cashierUid)
  if (!targetUid) return
  const now = Date.now()

  // 1. Guardar localmente de inmediato para reactividad a 0ms
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`sugar_cashier_last_read_broadcast_${targetUid}`, now.toString())
      window.dispatchEvent(new CustomEvent('sugar_broadcast_read', { detail: { cashierUid: targetUid, timestamp: now } }))
      
      if ('BroadcastChannel' in window) {
        const ch = new BroadcastChannel('sugar_ludo_social_channel')
        ch.postMessage({ type: 'cashier_broadcast_read', cashierUid: targetUid, timestamp: now })
        ch.close()
      }
    } catch {}
  }

  // 2. Persistir en Firestore para sincronización estricta entre terminales y dispositivos ($0.00 Spark)
  try {
    const chatMetaRef = doc(db, 'staff_private_chats', targetUid)
    await setDoc(chatMetaRef, {
      cashierUid: targetUid,
      lastReadBroadcastAt: now,
      updatedAt: now
    }, { merge: true })
  } catch (err) {
    console.debug('[StaffChat] Error sincronizando lastReadBroadcastAt en Firestore:', err)
  }
}

export function subscribeToBroadcastUnreadCount(
  cashierUid: string,
  callback: (unreadCount: number) => void
): () => void {
  const targetUid = normalizeCashierUid(cashierUid)
  if (!targetUid) return () => {}
  try {
    let lastSnapDocs: any[] = []
    let cachedCloudLastRead = getCashierLastReadBroadcastTime(targetUid)

    const recompute = () => {
      const localLastRead = getCashierLastReadBroadcastTime(targetUid)
      const effectiveLastRead = Math.max(localLastRead, cachedCloudLastRead)
      let count = 0
      lastSnapDocs.forEach((d) => {
        const data = typeof d.data === 'function' ? d.data() : d
        const ts = Number(data.timestamp || 0)
        if (ts > effectiveLastRead) {
          count++
        }
      })
      callback(count)
    }

    // 1. Escuchar eventos locales en la ventana
    const onBroadcastRead = (e: any) => {
      const eventUid = normalizeCashierUid(e?.detail?.cashierUid)
      if (!e?.detail || eventUid === targetUid) {
        if (e?.detail?.timestamp) {
          cachedCloudLastRead = Math.max(cachedCloudLastRead, Number(e.detail.timestamp))
        }
        recompute()
      }
    }

    // 2. Escuchar BroadcastChannel entre pestañas locales
    let channel: BroadcastChannel | null = null
    if (typeof window !== 'undefined') {
      window.addEventListener('sugar_broadcast_read', onBroadcastRead)
      if ('BroadcastChannel' in window) {
        try {
          channel = new BroadcastChannel('sugar_ludo_social_channel')
          channel.onmessage = (ev) => {
            const evUid = normalizeCashierUid(ev.data?.cashierUid)
            if (ev.data?.type === 'cashier_broadcast_read' && evUid === targetUid) {
              cachedCloudLastRead = Math.max(cachedCloudLastRead, Number(ev.data.timestamp || 0))
              recompute()
            }
          }
        } catch {}
      }
    }

    // 3. Escuchar en tiempo real el documento del cajero en Firestore (sincroniza terminales externas)
    const chatMetaRef = doc(db, 'staff_private_chats', targetUid)
    const unsubMeta = onSnapshot(chatMetaRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        const cloudTime = Number(data?.lastReadBroadcastAt || 0)
        if (cloudTime > 0) {
          cachedCloudLastRead = Math.max(cachedCloudLastRead, cloudTime)
          if (typeof window !== 'undefined') {
            try {
              localStorage.setItem(`sugar_cashier_last_read_broadcast_${targetUid}`, cachedCloudLastRead.toString())
            } catch {}
          }
          recompute()
        }
      }
    }, () => {})

    // 4. Escuchar mensajes de difusión
    const q = query(
      collection(db, 'staff_broadcast_messages'),
      orderBy('timestamp', 'desc'),
      limit(50)
    )
    const unsubBroadcast = onSnapshot(q, (snap) => {
      lastSnapDocs = snap.docs
      recompute()
    }, () => {
      callback(0)
    })

    return () => {
      unsubBroadcast()
      unsubMeta()
      if (channel) channel.close()
      if (typeof window !== 'undefined') {
        window.removeEventListener('sugar_broadcast_read', onBroadcastRead)
      }
    }
  } catch {
    return () => {}
  }
}
