import { db } from './firebase'
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  updateDoc, 
  arrayUnion, 
  query, 
  where, 
  limit,
  onSnapshot 
} from 'firebase/firestore'
import { getSocket } from './socket'

export interface FriendItem {
  id: string
  name: string
  avatar: string
  avatarColor: string
  level: number
  trophies: number
  status: 'online' | 'in_game' | 'busy' | 'offline'
  lastSeen?: string
}

export interface FriendRequestItem {
  id: string
  senderUid: string
  senderName: string
  senderAvatar: string
  senderLevel: number
  senderTrophies: number
  targetUid: string
  targetName: string
  timeAgo: string
  status: 'pending' | 'accepted' | 'rejected'
  createdAt: string
}

export interface DuelChallengeItem {
  id: string
  senderUid: string
  senderName: string
  senderAvatar: string
  senderLevel: number
  senderTrophies: number
  targetUid: string
  targetName: string
  roomCode: string
  status: 'pending' | 'accepted' | 'rejected' | 'canceled'
  createdAt: string
}

export function getSugarId(uid?: string): string {
  if (!uid) return 'SL-PLAYER'
  return 'SL-' + uid.substring(0, 6).toUpperCase()
}

// Convert Firestore UID to a safe WebRTC Peer ID
export function getPeerIdForUser(uid: string): string {
  return 'sugar_' + uid.toLowerCase().replace(/[^a-z0-9]/g, '_')
}

// ================= CAPA 2: CANAL WEBRTC P2P DIRECTO (CERO BASE DE DATOS) =================

let peerInstance: any = null
let currentActiveUid: string | null = null
let currentStatus: 'online' | 'in_game' | 'busy' | 'offline' = 'online'

const livePresenceMap = new Map<string, 'online' | 'in_game' | 'busy' | 'offline'>()
const activePeerConnections = new Map<string, any>()
const incomingInviteCallbacks = new Set<(challenge: DuelChallengeItem | null) => void>()
const presenceUpdateCallbacks = new Set<(presence: Map<string, 'online' | 'in_game' | 'busy' | 'offline'>) => void>()
const duelResultCallbacks = new Map<string, (status: 'pending' | 'accepted' | 'rejected' | 'canceled') => void>()
const customDataCallbacks = new Set<(data: any) => void>()

// Local BroadcastChannel for instant local coordination
let localBroadcastChannel: BroadcastChannel | null = null

function getLocalChannel(): BroadcastChannel | null {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    if (!localBroadcastChannel) {
      localBroadcastChannel = new BroadcastChannel('sugar_ludo_p2p_channel')
      localBroadcastChannel.addEventListener('message', (e) => {
        handleIncomingData(e.data)
      })
    }
    return localBroadcastChannel
  }
  return null
}

function handleIncomingData(data: any) {
  if (!data || typeof data !== 'object') return

  // Generic custom data broadcast
  customDataCallbacks.forEach(cb => cb(data))

  if (data.type === 'presence') {
    if (data.uid && data.status) {
      livePresenceMap.set(data.uid, data.status)
      presenceUpdateCallbacks.forEach(cb => cb(new Map(livePresenceMap)))
    }
  } else if (data.type === 'duel_invite') {
    if (data.challenge && data.challenge.targetUid === currentActiveUid) {
      incomingInviteCallbacks.forEach(cb => cb(data.challenge))
    }
  } else if (data.type === 'duel_response') {
    if (data.challengeId && duelResultCallbacks.has(data.challengeId)) {
      const cb = duelResultCallbacks.get(data.challengeId)
      cb?.(data.status)
    } else {
      duelResultCallbacks.forEach(cb => cb(data.status))
    }
  } else if (data.type === 'duel_cancel') {
    if (data.targetUid === currentActiveUid) {
      incomingInviteCallbacks.forEach(cb => cb(null))
    }
  }
}

/**
 * Inicializa el nodo WebRTC PeerJS para comunicación P2P directa entre cuentas y dispositivos.
 */
export async function registerSocialSocket(user: any) {
  if (!user?.uid || typeof window === 'undefined') return
  currentActiveUid = user.uid
  getLocalChannel()

  // Sockets matchmaking registration
  const socket = getSocket()
  if (socket.connected) {
    socket.emit('register_identity', { playerId: user.uid })
  } else {
    socket.once('connect', () => {
      socket.emit('register_identity', { playerId: user.uid })
    })
    socket.connect()
  }

  // PeerJS WebRTC Initialization
  const myPeerId = getPeerIdForUser(user.uid)

  if (peerInstance && !peerInstance.destroyed && peerInstance.id === myPeerId) {
    return
  }

  try {
    const { default: Peer } = await import('peerjs')

    if (peerInstance && !peerInstance.destroyed) {
      peerInstance.destroy()
    }

    const peer = new Peer(myPeerId, {
      debug: 0,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' }
        ]
      }
    })

    peerInstance = peer

    peer.on('open', (id) => {
      console.log('✅ WebRTC P2P activo. Peer ID:', id)
      // Broadcast presence on local channel
      const ch = getLocalChannel()
      ch?.postMessage({ type: 'presence', uid: user.uid, status: currentStatus })
    })

    peer.on('connection', (conn) => {
      activePeerConnections.set(conn.peer, conn)

      conn.on('open', () => {
        // Send current presence to newly connected peer
        conn.send({ type: 'presence', uid: user.uid, status: currentStatus })
      })

      conn.on('data', (data) => {
        handleIncomingData(data)
      })

      conn.on('close', () => {
        activePeerConnections.delete(conn.peer)
      })

      conn.on('error', () => {
        activePeerConnections.delete(conn.peer)
      })
    })

    peer.on('error', (err) => {
      console.warn('WebRTC Peer warning:', err?.type || err)
    })
  } catch (e) {
    console.warn('Could not initialize WebRTC PeerJS:', e)
  }
}

/**
 * Notifica cambio de estado en tiempo real (🟢 'online' / 🟠 'in_game') vía WebRTC P2P DataChannels.
 */
export function sendSocialStatusChange(status: 'online' | 'in_game' | 'busy') {
  currentStatus = status
  if (!currentActiveUid) return

  livePresenceMap.set(currentActiveUid, status)
  presenceUpdateCallbacks.forEach(cb => cb(new Map(livePresenceMap)))

  const payload = {
    type: 'presence',
    uid: currentActiveUid,
    status,
    timestamp: Date.now()
  }

  // 1. Broadcast via local channel
  const ch = getLocalChannel()
  ch?.postMessage(payload)

  // 2. Broadcast to all connected P2P peers
  activePeerConnections.forEach((conn) => {
    if (conn && conn.open) {
      try {
        conn.send(payload)
      } catch {}
    }
  })
}

/**
 * Escucha actualizaciones de presencia en tiempo real de amigos vía WebRTC.
 */
export function subscribeToLivePresence(
  onPresenceUpdate: (presence: Map<string, 'online' | 'in_game' | 'busy' | 'offline'>) => void
): () => void {
  presenceUpdateCallbacks.add(onPresenceUpdate)
  onPresenceUpdate(new Map(livePresenceMap))

  return () => {
    presenceUpdateCallbacks.delete(onPresenceUpdate)
  }
}

/**
 * Envía un reto a duelo 1 vs 1 directamente al peer del amigo retado por WebRTC DataChannel.
 */
export function sendRealtimeDuelInvite(
  currentUser: any,
  targetFriend: FriendItem,
  roomCode: string
): { success: boolean; challengeId: string } {
  if (!currentUser?.uid) return { success: false, challengeId: '' }

  const challengeId = `duel_${currentUser.uid}_${targetFriend.id}_${Date.now()}`
  const challenge: DuelChallengeItem = {
    id: challengeId,
    senderUid: currentUser.uid,
    senderName: currentUser.nickname || currentUser.displayName || 'Jugador',
    senderAvatar: currentUser.photoURL || '🎲',
    senderLevel: Number(currentUser.level || 1),
    senderTrophies: Number(currentUser.rankPoints !== undefined ? currentUser.rankPoints : ((currentUser.totalWins || 0) * 25)),
    targetUid: targetFriend.id,
    targetName: targetFriend.name,
    roomCode,
    status: 'pending',
    createdAt: new Date().toISOString()
  }

  const payload = {
    type: 'duel_invite',
    challenge
  }

  // 1. Local channel
  const ch = getLocalChannel()
  ch?.postMessage(payload)

  // 2. WebRTC P2P direct connection
  const targetPeerId = getPeerIdForUser(targetFriend.id)

  if (peerInstance && !peerInstance.destroyed) {
    let conn = activePeerConnections.get(targetPeerId)
    if (!conn || !conn.open) {
      conn = peerInstance.connect(targetPeerId, { reliable: true })
      activePeerConnections.set(targetPeerId, conn)

      conn.on('open', () => {
        conn.send(payload)
      })

      conn.on('data', (data: any) => {
        handleIncomingData(data)
      })
    } else {
      conn.send(payload)
    }
  }

  return { success: true, challengeId }
}

/**
 * Escucha retos a duelo entrantes en tiempo real vía WebRTC.
 */
export function subscribeToIncomingDuelInvites(
  currentUid: string,
  onInviteReceived: (challenge: DuelChallengeItem | null) => void
): () => void {
  if (!currentUid) return () => {}

  incomingInviteCallbacks.add(onInviteReceived)

  return () => {
    incomingInviteCallbacks.delete(onInviteReceived)
  }
}

/**
 * Responde a un reto a duelo (Aceptar / Rechazar) directamente por WebRTC DataChannel.
 */
export function respondToRealtimeDuelInvite(
  senderUid: string,
  response: 'accepted' | 'rejected',
  roomCode: string,
  challengeId?: string
) {
  // Limpiar inmediatamente la invitación pendiente local para resetear el badge numérico a 0
  incomingInviteCallbacks.forEach(cb => cb(null))

  const payload = {
    type: 'duel_response',
    challengeId,
    senderUid,
    targetUid: currentActiveUid,
    status: response,
    roomCode,
    respondedAt: new Date().toISOString()
  }

  // 1. Local channel
  const ch = getLocalChannel()
  ch?.postMessage(payload)

  // 2. WebRTC P2P channel
  const senderPeerId = getPeerIdForUser(senderUid)
  let conn = activePeerConnections.get(senderPeerId)

  if (conn && conn.open) {
    try {
      conn.send(payload)
    } catch {}
  } else if (peerInstance && !peerInstance.destroyed) {
    try {
      const newConn = peerInstance.connect(senderPeerId, { reliable: true })
      newConn.on('open', () => {
        newConn.send(payload)
      })
    } catch {}
  }
}

/**
 * Cancela una invitación a duelo enviada y limpia el estado local y remoto.
 */
export function cancelRealtimeDuelInvite(targetFriendUid?: string) {
  incomingInviteCallbacks.forEach(cb => cb(null))

  if (!targetFriendUid) return

  const payload = {
    type: 'duel_cancel',
    targetUid: targetFriendUid,
    senderUid: currentActiveUid
  }

  const ch = getLocalChannel()
  ch?.postMessage(payload)

  const targetPeerId = getPeerIdForUser(targetFriendUid)
  const conn = activePeerConnections.get(targetPeerId)
  if (conn && conn.open) {
    try {
      conn.send(payload)
    } catch {}
  }
}

/**
 * Escucha el resultado de un reto a duelo enviado por el emisor.
 */
export function subscribeToSentDuelResult(
  challengeId: string,
  onResult: (status: 'pending' | 'accepted' | 'rejected' | 'canceled') => void
): () => void {
  duelResultCallbacks.set(challengeId, onResult)

  return () => {
    duelResultCallbacks.delete(challengeId)
  }
}

// ================= CAPA 1: PERSISTENCIA TRANSACCIONAL EN FIRESTORE =================

/**
 * Carga la lista de amigos bajo demanda (1 sola lectura puntual al abrir la sección).
 */
export async function fetchUserFriends(userId?: string): Promise<FriendItem[]> {
  if (!userId || userId.startsWith('dev_')) return []

  const friends: FriendItem[] = []
  try {
    const userDocRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userDocRef)

    if (userSnap.exists()) {
      const data = userSnap.data()
      const friendUids: string[] = Array.isArray(data.friends) ? data.friends : []

      // Cargar detalles de cada amigo en paralelo
      const promises = friendUids.map(async (fUid) => {
        try {
          const fSnap = await getDoc(doc(db, 'users', fUid))
          if (fSnap.exists()) {
            const fd = fSnap.data()
            const wins = Number(fd.totalWins || 0)
            const trophies = Number(fd.rankPoints !== undefined ? fd.rankPoints : (wins * 25))
            const liveStatus = livePresenceMap.get(fUid) || (fd.activityStatus as any) || 'online'

            return {
              id: fUid,
              name: fd.nickname || fd.displayName || 'Amigo_' + fUid.substring(0, 4),
              avatar: fd.photoURL || '🎲',
              avatarColor: trophies >= 2000 ? '#facc15' : '#38bdf8',
              level: Number(fd.level || 1),
              trophies,
              status: liveStatus
            } as FriendItem
          }
        } catch {}
        return null
      })

      const results = await Promise.all(promises)
      results.forEach(f => {
        if (f) friends.push(f)
      })
    }
  } catch (e) {
    console.warn('Error fetching user friends from Firestore:', e)
  }

  return friends
}

/**
 * Buscador quirúrgico con límite estricto (máximo 5 lecturas indexadas).
 */
export async function searchUsersInFirestore(queryText: string, currentUid?: string): Promise<FriendItem[]> {
  const clean = queryText.trim().toLowerCase()
  if (!clean) return []

  const cleanNoPrefix = clean.startsWith('sl-') ? clean.replace('sl-', '') : clean

  try {
    const results: FriendItem[] = []
    const usersRef = collection(db, 'users')

    // Búsqueda quirúrgica directa si es ID exacto
    if (clean.length > 20) {
      try {
        const directSnap = await getDoc(doc(db, 'users', clean))
        if (directSnap.exists() && directSnap.id !== currentUid) {
          const data = directSnap.data()
          const wins = Number(data.totalWins || 0)
          const trophies = Number(data.rankPoints !== undefined ? data.rankPoints : (wins * 25))
          return [{
            id: directSnap.id,
            name: data.nickname || data.displayName || 'Jugador_' + directSnap.id.substring(0, 4),
            avatar: data.photoURL || '🎲',
            avatarColor: trophies >= 2000 ? '#facc15' : '#38bdf8',
            level: Number(data.level || 1),
            trophies,
            status: livePresenceMap.get(directSnap.id) || (data.activityStatus as any) || 'online'
          }]
        }
      } catch {}
    }

    // Consulta con límite estricto de 5 documentos
    const q = query(
      usersRef,
      where('nickname', '>=', clean),
      where('nickname', '<=', clean + '\uf8ff'),
      limit(5)
    )

    let snap = await getDocs(q)

    // Fallback: si no encuentra por nickname exacto, busca con límite 10 general
    if (snap.empty) {
      const qFallback = query(usersRef, limit(15))
      snap = await getDocs(qFallback)
    }

    snap.forEach((d) => {
      if (d.id === currentUid) return
      const data = d.data()
      const nick = (data.nickname || data.displayName || '').toLowerCase()
      const sugarId = getSugarId(d.id).toLowerCase()
      const rawUid = d.id.toLowerCase()

      const matches = 
        nick.includes(clean) || 
        sugarId.includes(clean) || 
        sugarId.includes(cleanNoPrefix) || 
        rawUid.includes(clean) || 
        rawUid.includes(cleanNoPrefix)

      if (matches && results.length < 5) {
        const wins = Number(data.totalWins || 0)
        const trophies = Number(data.rankPoints !== undefined ? data.rankPoints : (wins * 25))
        results.push({
          id: d.id,
          name: data.nickname || data.displayName || 'Jugador_' + d.id.substring(0, 4),
          avatar: data.photoURL || '🎲',
          avatarColor: trophies >= 2000 ? '#facc15' : '#38bdf8',
          level: Number(data.level || 1),
          trophies,
          status: livePresenceMap.get(d.id) || (data.activityStatus as any) || 'online'
        })
      }
    })

    return results
  } catch (e) {
    console.warn('Error searching users in Firestore:', e)
    return []
  }
}

/**
 * Envía una solicitud de amistad guardándola en Firestore.
 */
export async function sendFriendRequestToUser(
  currentUser: any,
  targetUser: FriendItem
): Promise<{ success: boolean; message: string }> {
  if (!currentUser?.uid) {
    return { success: false, message: 'Debes iniciar sesión para enviar solicitudes.' }
  }
  if (currentUser.uid === targetUser.id) {
    return { success: false, message: 'No puedes enviarte una solicitud a ti mismo.' }
  }

  try {
    const reqId = `${currentUser.uid}_${targetUser.id}`
    const reqRef = doc(db, 'friend_requests', reqId)
    
    await setDoc(reqRef, {
      id: reqId,
      senderUid: currentUser.uid,
      senderName: currentUser.nickname || currentUser.displayName || 'Jugador',
      senderAvatar: currentUser.photoURL || '🎲',
      senderLevel: Number(currentUser.level || 1),
      senderTrophies: Number(currentUser.rankPoints !== undefined ? currentUser.rankPoints : ((currentUser.totalWins || 0) * 25)),
      targetUid: targetUser.id,
      targetName: targetUser.name,
      status: 'pending',
      createdAt: new Date().toISOString()
    })

    return { success: true, message: '¡Solicitud de amistad enviada con éxito!' }
  } catch (e: any) {
    console.error('Error sending friend request to Firestore:', e)
    return { success: false, message: 'Error al enviar solicitud: ' + (e?.message || 'Permiso denegado') }
  }
}

/**
 * Escucha solicitudes de amistad pendientes con límite ligero.
 */
export function subscribeToFriendRequests(
  currentUid: string,
  onUpdate: (received: FriendRequestItem[], sent: FriendRequestItem[]) => void
): () => void {
  if (!currentUid) return () => {}

  const reqsCollection = collection(db, 'friend_requests')
  const unsubscribe = onSnapshot(reqsCollection, (snapshot) => {
    const received: FriendRequestItem[] = []
    const sent: FriendRequestItem[] = []

    snapshot.forEach((d) => {
      const data = d.data()
      const item: FriendRequestItem = {
        id: d.id,
        senderUid: data.senderUid,
        senderName: data.senderName || 'Jugador',
        senderAvatar: data.senderAvatar || '🎲',
        senderLevel: Number(data.senderLevel || 1),
        senderTrophies: Number(data.senderTrophies || 0),
        targetUid: data.targetUid,
        targetName: data.targetName || 'Jugador',
        timeAgo: 'Reciente',
        status: data.status || 'pending',
        createdAt: data.createdAt || ''
      }

      if (data.targetUid === currentUid && data.status === 'pending') {
        received.push(item)
      } else if (data.senderUid === currentUid && data.status === 'pending') {
        sent.push(item)
      }
    })

    onUpdate(received, sent)
  }, (error) => {
    console.warn('Friend requests snapshot error:', error)
  })

  return unsubscribe
}

/**
 * Acepta una solicitud de amistad y escribe la relación mutua en Firestore.
 */
export async function acceptUserFriendRequest(
  currentUid: string,
  requestItem: FriendRequestItem
): Promise<{ success: boolean; message: string }> {
  try {
    const now = new Date().toISOString()

    // 1. Agregar emisor al usuario actual (receptor)
    const myDoc = doc(db, 'users', currentUid)
    await updateDoc(myDoc, {
      friends: arrayUnion(requestItem.senderUid)
    })

    // 2. Agregar receptor al emisor (escritura mutua directa)
    try {
      const senderDoc = doc(db, 'users', requestItem.senderUid)
      await updateDoc(senderDoc, {
        friends: arrayUnion(currentUid)
      })
    } catch {}

    // 3. Crear relación en friendships para respaldo
    try {
      await setDoc(doc(db, 'friendships', `${currentUid}_${requestItem.senderUid}`), {
        id: `${currentUid}_${requestItem.senderUid}`,
        forUid: currentUid,
        friendUid: requestItem.senderUid,
        createdAt: now
      })
      await setDoc(doc(db, 'friendships', `${requestItem.senderUid}_${currentUid}`), {
        id: `${requestItem.senderUid}_${currentUid}`,
        forUid: requestItem.senderUid,
        friendUid: currentUid,
        createdAt: now
      })
    } catch {}

    // 4. Eliminar solicitud de friend_requests
    try {
      const reqDoc = doc(db, 'friend_requests', requestItem.id)
      await deleteDoc(reqDoc)
    } catch {}

    return { success: true, message: `¡Ahora eres amigo de ${requestItem.senderName}!` }
  } catch (e: any) {
    console.error('Error accepting friend request in friendships:', e)
    return { success: false, message: 'Error al aceptar solicitud: ' + (e?.message || '') }
  }
}

export async function rejectUserFriendRequest(
  requestId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const reqDoc = doc(db, 'friend_requests', requestId)
    await deleteDoc(reqDoc)
    return { success: true, message: 'Solicitud rechazada.' }
  } catch (e: any) {
    console.error('Error rejecting friend request:', e)
    return { success: false, message: 'Error al rechazar solicitud.' }
  }
}

export async function cancelSentFriendRequest(
  requestId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const reqDoc = doc(db, 'friend_requests', requestId)
    await deleteDoc(reqDoc)
    return { success: true, message: 'Solicitud cancelada.' }
  } catch (e: any) {
    console.error('Error canceling friend request:', e)
    return { success: false, message: 'Error al cancelar solicitud.' }
  }
}

// ================= CAPA 3: GENERIC P2P DATA (LOBBIES Y M�S) =================
export function sendP2PData(targetUid: string, payload: any) {
  const targetPeerId = getPeerIdForUser(targetUid)
  
  // Local channel (if same device testing)
  const ch = getLocalChannel()
  ch?.postMessage(payload)

  let conn = activePeerConnections.get(targetPeerId)
  if (conn && conn.open) {
    try { conn.send(payload) } catch {}
  } else if (peerInstance && !peerInstance.destroyed) {
    try {
      const newConn = peerInstance.connect(targetPeerId, { reliable: true })
      newConn.on('open', () => { newConn.send(payload) })
      // Keep track of this new connection
      activePeerConnections.set(targetPeerId, newConn)
      newConn.on('data', handleIncomingData)
      newConn.on('close', () => activePeerConnections.delete(targetPeerId))
      newConn.on('error', () => activePeerConnections.delete(targetPeerId))
    } catch {}
  }
}

export function subscribeToP2PData(cb: (data: any) => void): () => void {
  customDataCallbacks.add(cb)
  return () => customDataCallbacks.delete(cb)
}

