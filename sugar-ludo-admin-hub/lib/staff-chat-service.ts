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
      const msgs: StaffChatMessage[] = snap.docs.map((d) => {
        const data = d.data()
        return {
          id: d.id,
          senderUid: data.senderUid || 'adm_super',
          senderName: data.senderName || 'Super Admin',
          senderRole: (data.senderRole || 'super_admin') as any,
          message: data.message || '',
          timestamp: data.timestamp || Date.now()
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

export async function sendBroadcastMessage(
  adminUid: string,
  adminName: string,
  text: string
): Promise<void> {
  const now = Date.now()
  await addDoc(collection(db, 'staff_broadcast_messages'), {
    senderUid: adminUid,
    senderName: adminName,
    senderRole: 'super_admin',
    message: text.trim(),
    timestamp: now
  })
}

/**
 * 2. CHAT PRIVADO (ADMIN <-> CAJERO ESPECÍFICO)
 */
export function subscribeToCashierPrivateMessages(
  cashierUid: string,
  callback: (messages: StaffChatMessage[]) => void
): () => void {
  if (!cashierUid) return () => {}
  try {
    const q = query(
      collection(db, 'staff_private_chats', cashierUid, 'messages'),
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
      console.warn(`[StaffChat] Error listener privado de ${cashierUid}:`, err)
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
  const now = Date.now()

  // 1. Agregar mensaje a la subcolección
  const msgRef = collection(db, 'staff_private_chats', cashierUid, 'messages')
  await addDoc(msgRef, {
    senderUid,
    senderName,
    senderRole,
    message: text.trim(),
    timestamp: now
  })

  // 2. Actualizar metadatos del hilo y sumar no leídos
  const chatMetaRef = doc(db, 'staff_private_chats', cashierUid)
  const isFromAdmin = senderRole === 'super_admin'

  await setDoc(chatMetaRef, {
    cashierUid,
    cashierName: cashierName || cashierUid,
    lastMessage: text.trim(),
    lastTimestamp: now,
    unreadByAdmin: isFromAdmin ? 0 : increment(1),
    unreadByCashier: isFromAdmin ? increment(1) : 0,
    updatedAt: now
  }, { merge: true })
}

export async function markPrivateChatAsReadByAdmin(cashierUid: string): Promise<void> {
  if (!cashierUid) return
  try {
    const chatMetaRef = doc(db, 'staff_private_chats', cashierUid)
    await updateDoc(chatMetaRef, {
      unreadByAdmin: 0
    })
  } catch {}
}

export async function markPrivateChatAsReadByCashier(cashierUid: string): Promise<void> {
  if (!cashierUid) return
  try {
    const chatMetaRef = doc(db, 'staff_private_chats', cashierUid)
    await updateDoc(chatMetaRef, {
      unreadByCashier: 0
    })
  } catch {}
}

/**
 * 3. METADATOS GLOBALES DE CHATS PRIVADOS (PARA BADGES EN NAVBAR Y SELECTORES)
 */
export function subscribeToAllPrivateChatsMeta(
  callback: (metas: Record<string, PrivateChatMeta>) => void
): () => void {
  try {
    const collRef = collection(db, 'staff_private_chats')
    return onSnapshot(collRef, (snap) => {
      const map: Record<string, PrivateChatMeta> = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        map[d.id] = {
          cashierUid: d.id,
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
  if (!cashierUid) return () => {}
  try {
    const docRef = doc(db, 'staff_private_chats', cashierUid)
    return onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data()
        callback({
          cashierUid: docSnap.id,
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
