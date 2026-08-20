'use client'

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  Users, 
  Search, 
  UserPlus, 
  UserCheck, 
  Swords, 
  Copy, 
  Check, 
  Sparkles, 
  Shield, 
  Flame, 
  Trophy, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  MessageSquare,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { PRESET_AVATARS } from '@/components/avatar-selector-modal'
import { getSocket } from '@/lib/socket'
import { 
  FriendItem, 
  FriendRequestItem, 
  getSugarId, 
  searchUsersInFirestore, 
  sendFriendRequestToUser, 
  fetchUserFriends,
  subscribeToLivePresence,
  subscribeToFriendRequests,
  acceptUserFriendRequest, 
  rejectUserFriendRequest,
  cancelSentFriendRequest,
  sendRealtimeDuelInvite,
  cancelRealtimeDuelInvite,
  subscribeToSentDuelResult,
  initSocialRelayStream
} from '@/lib/friends-service'

function renderAvatar(avatar?: string, className = "size-full object-cover rounded-full") {
  if (!avatar) return '🎲'
  if (avatar.startsWith('http') || avatar.startsWith('data:')) {
    return <img src={avatar} alt="Avatar" className={className} />
  }
  const preset = PRESET_AVATARS.find(a => a.id === avatar)
  if (preset) return preset.emoji
  return avatar
}

export function FriendsScreen({ 
  onBack, 
  onStartDuel 
}: { 
  onBack: () => void
  onStartDuel?: (roomCode: string) => void 
}) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'requests'>('friends')
  const [requestSubTab, setRequestSubTab] = useState<'received' | 'sent'>('received')

  // Data states
  const [friendsList, setFriendsList] = useState<FriendItem[]>([])
  const [receivedRequests, setReceivedRequests] = useState<FriendRequestItem[]>([])
  const [sentRequests, setSentRequests] = useState<FriendRequestItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<FriendItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [copiedMyId, setCopiedMyId] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Challenge modal state
  const [challengingFriend, setChallengingFriend] = useState<FriendItem | null>(null)
  const [duelRoomCode, setDuelRoomCode] = useState<string>('')
  const [isSendingChallenge, setIsSendingChallenge] = useState(false)
  const [isWaitingResponse, setIsWaitingResponse] = useState(false)
  const [activeChallengeId, setActiveChallengeId] = useState<string | null>(null)

  const myFriendId = getSugarId(user?.uid)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Load friends on-mount & subscribe to live WebSocket presence and requests
  useEffect(() => {
    if (!user?.uid) return

    // Carga puntual de amigos bajo demanda (1 sola lectura)
    fetchUserFriends(user.uid).then((list) => {
      initSocialRelayStream(user.uid)
      setFriendsList(list)
    }).catch(() => {})

    // Presencia en vivo vía WebSockets y Relay In-Memory (0 lecturas Firestore)
    const unsubPresence = subscribeToLivePresence((presenceMap) => {
      setFriendsList(prev => prev.map(f => {
        const live = presenceMap.get(f.id)
        return live ? { ...f, status: live } : f
      }))
    })

    // Solicitudes de amistad
    const unsubRequests = subscribeToFriendRequests(user.uid, (received, sent) => {
      setReceivedRequests(received)
      setSentRequests(sent)
    })

    return () => {
      unsubPresence()
      unsubRequests()
    }
  }, [user])

  // Listen to sent duel challenge result via WebSockets
  useEffect(() => {
    if (!activeChallengeId) return

    const unsub = subscribeToSentDuelResult(activeChallengeId, (status) => {
      if (status === 'accepted') {
        showToast(`⚔️ ¡${challengingFriend?.name || 'El rival'} aceptó el reto! Conectando a la mesa...`)
        setChallengingFriend(null)
        setIsWaitingResponse(false)
        setActiveChallengeId(null)
      } else if (status === 'rejected') {
        showToast(`❌ ${challengingFriend?.name || 'El rival'} rechazó el duelo.`)
        setChallengingFriend(null)
        setIsWaitingResponse(false)
        setActiveChallengeId(null)
      } else if (status === 'canceled') {
        setChallengingFriend(null)
        setIsWaitingResponse(false)
        setActiveChallengeId(null)
      }
    })

    return () => unsub()
  }, [activeChallengeId, challengingFriend, duelRoomCode, onStartDuel])

  const handleCopyId = () => {
    navigator.clipboard.writeText(myFriendId)
    setCopiedMyId(true)
    setTimeout(() => setCopiedMyId(false), 2000)
    showToast('📋 ¡ID de amigo copiado al portapapeles!')
  }

  const handleAcceptRequest = async (req: FriendRequestItem) => {
    if (!user?.uid) return
    const res = await acceptUserFriendRequest(user.uid, req)
    showToast(res.message)
  }

  const handleRejectRequest = async (reqId: string) => {
    const res = await rejectUserFriendRequest(reqId)
    showToast(res.message)
  }

  const handleCancelSentRequest = async (reqId: string) => {
    const res = await cancelSentFriendRequest(reqId)
    showToast(res.message)
  }

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    setIsSearching(true)
    const results = await searchUsersInFirestore(searchQuery.trim(), user?.uid)
    setSearchResults(results)
    setIsSearching(false)
    if (results.length === 0) {
      showToast('🔍 No se encontraron usuarios con ese código o nombre.')
    }
  }

  const handleSendRequestToSearched = async (targetUser: FriendItem) => {
    const res = await sendFriendRequestToUser(user, targetUser)
    showToast(res.message)
  }

  const handleChallenge = (friend: FriendItem) => {
    setDuelRoomCode('Creando...')
    setIsWaitingResponse(false)
    setActiveChallengeId(null)
    setChallengingFriend(friend)
  }

  const handleSendDuel = () => {
    if (!challengingFriend || !user) return
    setIsWaitingResponse(true)
    setIsSendingChallenge(true)

    const socket = getSocket()
    const playerId = user.uid
    const playerName = user.photoURL ? `${user.nickname || 'Jugador'}|||${user.photoURL}` : (user.nickname || 'Jugador')

    const onRoomCreated = (data: { roomCode?: string; id?: string }) => {
      socket.off('private_room_created', onRoomCreated)
      const officialCode = data.roomCode || data.id || ''
      setDuelRoomCode(officialCode)

      const res = sendRealtimeDuelInvite(user, challengingFriend, officialCode, () => {
        setIsSendingChallenge(false)
        setIsWaitingResponse(false)
        showToast(`No se pudo conectar con ${challengingFriend.name}. Asegúrate de que tenga el juego abierto.`)
      })
      setIsSendingChallenge(false)
      if (res.success && res.challengeId) {
        setActiveChallengeId(res.challengeId)
        showToast(`⚔️ ¡Invitación enviada a ${challengingFriend.name}! Esperando respuesta...`)

        // Timeout de seguridad de 15s si el amigo no contesta
        setTimeout(() => {
          setIsWaitingResponse((prev) => {
            if (prev) {
              showToast(`El jugador ${challengingFriend.name} no respondió a tiempo.`)
              setActiveChallengeId(null)
              setChallengingFriend(null)
              return false
            }
            return false
          })
        }, 15000)
      } else {
        setIsWaitingResponse(false)
        showToast('No se pudo enviar el reto a duelo.')
      }
    }

    socket.once('private_room_created', onRoomCreated)

    // Si el socket no está conectado, conectar primero
    if (!socket.connected) {
      socket.connect()
    }

    socket.emit('create_private_room', {
      playerId,
      playerName,
      targetPlayers: 2
    })
  }

  const handleCancelDuel = () => {
    if (challengingFriend?.id) {
      cancelRealtimeDuelInvite(challengingFriend.id)
    }
    setChallengingFriend(null)
    setIsWaitingResponse(false)
    setActiveChallengeId(null)
  }

  const onlineCount = friendsList.filter(f => f.status === 'online').length
  const totalPending = receivedRequests.length

  return (
    <section className="animate-slide-in mx-auto flex w-full max-w-5xl flex-col gap-5 p-2 sm:p-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 flex items-center justify-center gap-2 rounded-full border border-[var(--candy-cyan)]/40 bg-[oklch(0.1_0.05_250)] px-6 py-3 text-[var(--candy-cyan)] font-display text-sm font-bold shadow-2xl shadow-[var(--candy-cyan)]/20 whitespace-nowrap">
          <Sparkles className="size-4 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar (Homologado con Tienda y Billetera) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn-3d flex size-10 items-center justify-center rounded-xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground"
            aria-label="Volver al Lobby"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-foreground flex items-center gap-2">
              Amigos del Arena <Users className="size-6 text-[var(--candy-cyan)]" />
            </h1>
            <p className="text-xs text-muted-foreground font-medium hidden sm:block">
              Conecta con otros jugadores, consulta estados en tiempo real y reta a partidas privadas.
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 shadow-inner">
            <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
            <span className="font-display text-xs sm:text-sm font-bold text-emerald-400">
              {onlineCount} En Línea
            </span>
          </div>

          <div className="flex items-center gap-2 rounded-2xl border border-[var(--candy-cyan)]/30 bg-[oklch(0_0_0/0.4)] px-3 py-1.5 shadow-inner">
            <span className="font-display text-xs sm:text-sm font-bold text-[var(--candy-cyan)]">
              {friendsList.length} Total
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[oklch(1_0_0/0.03)] p-1.5 border border-border/80">
        <button
          onClick={() => setActiveTab('friends')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all",
            activeTab === 'friends'
              ? "bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] text-[oklch(0.18_0.03_285)] shadow-lg shadow-[var(--candy-cyan)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Users className="size-4" />
          <span>Mis Amigos ({friendsList.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('search')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all",
            activeTab === 'search'
              ? "bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] text-[oklch(0.18_0.03_285)] shadow-lg shadow-[var(--candy-cyan)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Search className="size-4" />
          <span>Buscar & Añadir</span>
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all relative",
            activeTab === 'requests'
              ? "bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] text-[oklch(0.18_0.03_285)] shadow-lg shadow-[var(--candy-cyan)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <UserPlus className="size-4" />
          <span>Solicitudes</span>
          {totalPending > 0 && (
            <span className="size-5 rounded-full bg-rose-500 text-[10px] font-black text-white flex items-center justify-center shadow-md animate-pulse">
              {totalPending}
            </span>
          )}
        </button>
      </div>

      {/* TAB 1: LISTA DE AMIGOS */}
      {activeTab === 'friends' && (
        <div className="flex flex-col gap-3 animate-in fade-in">
          {friendsList.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-border">
              <Users className="size-12 text-muted-foreground/40" />
              <h3 className="font-display text-lg font-bold text-foreground">Aún no tienes amigos agregados</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Utiliza la pestaña "Buscar & Añadir" para invitar a tus compañeros con su Nickname o Sugar ID.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {friendsList.map((friend) => (
                <div
                  key={friend.id}
                  className="glass flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-[oklch(1_0_0/0.02)] hover:border-[var(--candy-cyan)]/40 transition-all shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="size-12 rounded-2xl flex items-center justify-center text-2xl border border-white/10 shrink-0 overflow-hidden shadow-inner bg-black/40"
                    >
                      {renderAvatar(friend.avatar)}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-extrabold text-foreground truncate">
                          {friend.name}
                        </span>
                        <span className="rounded-md bg-white/10 px-1.5 py-0.2 font-display text-[10px] font-bold text-muted-foreground">
                          NVL. {friend.level}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        {friend.status === 'in_game' ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--candy-orange)]">
                            <span className="size-1.5 rounded-full bg-[var(--candy-orange)] animate-pulse" /> En Partida
                          </span>
                        ) : friend.status === 'busy' ? (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-rose-400">
                            <span className="size-1.5 rounded-full bg-rose-400" /> Ocupado
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> En Línea
                          </span>
                        )}
                        <span className="text-muted-foreground/30 text-xs">•</span>
                        <span className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--candy-gold)]">
                          <Trophy className="size-3" /> {friend.trophies} Copas
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {friend.status === 'in_game' ? (
                      <button
                        disabled
                        className="btn-3d flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 font-display text-xs font-bold text-amber-400 opacity-60 cursor-not-allowed"
                        title="El jugador se encuentra jugando una partida"
                      >
                        <Clock className="size-3.5" />
                        <span>En Partida</span>
                      </button>
                    ) : friend.status === 'busy' ? (
                      <button
                        disabled
                        className="btn-3d flex items-center gap-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2 font-display text-xs font-bold text-rose-400 opacity-60 cursor-not-allowed"
                        title="El jugador no recibe retos"
                      >
                        <Shield className="size-3.5" />
                        <span>Ocupado</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleChallenge(friend)}
                        className="btn-3d flex items-center gap-1.5 rounded-xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] px-3.5 py-2 font-display text-xs font-black text-[oklch(0.18_0.03_285)] shadow-md hover:scale-105 transition-all"
                      >
                        <Swords className="size-3.5" />
                        <span>Retar ⚔️</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BUSCAR & AÑADIR */}
      {activeTab === 'search' && (
        <div className="flex flex-col gap-5 animate-in fade-in">
          {/* Mi ID Card */}
          <div className="glass flex flex-col sm:flex-row items-center justify-between p-5 rounded-3xl border border-[var(--candy-cyan)]/30 bg-[linear-gradient(135deg,oklch(0.14_0.04_200/0.4),oklch(0.12_0.02_285/0.8))] gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="size-12 rounded-2xl bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)] flex items-center justify-center shrink-0">
                <Shield className="size-6" />
              </div>
              <div>
                <h3 className="font-display text-base font-extrabold text-foreground">Tu Sugar ID Oficial</h3>
                <p className="text-xs text-muted-foreground">Comparte este código con tus amigos para que puedan encontrarte de inmediato.</p>
              </div>
            </div>

            <div className="flex items-center gap-3 rounded-2xl bg-black/40 border border-white/10 px-4 py-2">
              <span className="font-mono text-xl font-extrabold tracking-widest text-[var(--candy-cyan)]">
                {myFriendId}
              </span>
              <button
                onClick={handleCopyId}
                className="btn-3d flex size-8 items-center justify-center rounded-lg bg-[oklch(1_0_0/0.1)] hover:bg-[var(--candy-cyan)] hover:text-black text-white transition-colors"
                title="Copiar ID"
              >
                {copiedMyId ? <Check className="size-4" /> : <Copy className="size-4" />}
              </button>
            </div>
          </div>

          {/* Formulario de Búsqueda */}
          <form onSubmit={handleSearchSubmit} className="glass flex flex-col gap-4 p-6 rounded-3xl border border-border">
            <h3 className="font-display text-lg font-black text-foreground flex items-center gap-2">
              <UserPlus className="size-5 text-[var(--candy-cyan)]" /> Buscar Jugadores en Firestore
            </h3>
            <p className="text-xs text-muted-foreground -mt-2">
              Escribe el Nickname o el Sugar ID (ej. {myFriendId}) para buscar en la base de datos oficial.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej. carlox o SL-753UXM"
                  className="w-full rounded-2xl border border-border bg-[oklch(0_0_0/0.3)] pl-11 pr-4 py-3.5 font-display text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[var(--candy-cyan)] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={isSearching}
                className="btn-3d rounded-2xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] px-6 py-3.5 font-display text-sm font-black text-[oklch(0.18_0.03_285)] shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                <Search className="size-4" />
                <span>{isSearching ? 'Buscando...' : 'Buscar Jugador'}</span>
              </button>
            </div>
          </form>

          {/* Resultados de Búsqueda */}
          {searchResults.length > 0 && (
            <div className="flex flex-col gap-3 animate-in fade-in">
              <h4 className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Resultados Encontrados ({searchResults.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {searchResults.map((result) => {
                  const isFriend = friendsList.some(f => f.id === result.id)
                  const isPendingSent = sentRequests.some(r => r.targetUid === result.id)

                  return (
                    <div
                      key={result.id}
                      className="glass flex items-center justify-between p-4 rounded-2xl border border-[var(--candy-cyan)]/40 bg-[oklch(1_0_0/0.03)] shadow-md"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="size-11 rounded-2xl flex items-center justify-center text-xl border border-white/10 shrink-0 overflow-hidden bg-black/40">
                          {renderAvatar(result.avatar)}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-display text-sm font-extrabold text-foreground truncate">
                              {result.name}
                            </span>
                            <span className="rounded-md bg-white/10 px-1.5 py-0.2 font-display text-[10px] font-bold text-muted-foreground">
                              NVL. {result.level}
                            </span>
                          </div>
                          <span className="font-mono text-[11px] text-[var(--candy-cyan)]">
                            {getSugarId(result.id)} • {result.trophies} Copas
                          </span>
                        </div>
                      </div>

                      {isFriend ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-3 py-2 font-display text-xs font-bold text-emerald-400 opacity-80 cursor-default shrink-0 ml-2"
                        >
                          <CheckCircle2 className="size-3.5" />
                          <span>Amigo</span>
                        </button>
                      ) : isPendingSent ? (
                        <button
                          disabled
                          className="flex items-center gap-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 px-3 py-2 font-display text-xs font-bold text-amber-400 opacity-90 cursor-default shrink-0 ml-2 animate-in fade-in"
                        >
                          <Clock className="size-3.5" />
                          <span>Solicitud Enviada</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSendRequestToSearched(result)}
                          className="btn-3d flex items-center gap-1.5 rounded-xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] px-3.5 py-2 font-display text-xs font-black text-[oklch(0.18_0.03_285)] shadow-md hover:scale-105 transition-all shrink-0 ml-2"
                        >
                          <UserPlus className="size-3.5" />
                          <span>Agregar</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SOLICITUDES PENDIENTES */}
      {activeTab === 'requests' && (
        <div className="flex flex-col gap-4 animate-in fade-in">
          {/* Sub-tabs: Recibidas / Enviadas */}
          <div className="flex gap-2">
            <button
              onClick={() => setRequestSubTab('received')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-display text-xs font-bold transition-all flex items-center gap-1.5",
                requestSubTab === 'received'
                  ? "bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)] border border-[var(--candy-cyan)]/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Recibidas</span>
              {receivedRequests.length > 0 && (
                <span className="size-4 rounded-full bg-rose-500 text-[9px] font-black text-white flex items-center justify-center">
                  {receivedRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setRequestSubTab('sent')}
              className={cn(
                "px-3.5 py-1.5 rounded-xl font-display text-xs font-bold transition-all flex items-center gap-1.5",
                requestSubTab === 'sent'
                  ? "bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)] border border-[var(--candy-cyan)]/40"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Enviadas ({sentRequests.length})</span>
            </button>
          </div>

          {/* LISTA DE RECIBIDAS */}
          {requestSubTab === 'received' && (
            receivedRequests.length === 0 ? (
              <div className="glass rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-border">
                <UserCheck className="size-12 text-muted-foreground/40" />
                <h3 className="font-display text-lg font-bold text-foreground">Sin solicitudes recibidas</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Cuando otros jugadores te agreguen por tu Sugar ID o Nickname, aparecerán aquí en tiempo real.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {receivedRequests.map((req) => (
                  <div
                    key={req.id}
                    className="glass flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-[oklch(1_0_0/0.02)] hover:border-[var(--candy-cyan)]/40 transition-all shadow-md animate-in fade-in"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-12 rounded-2xl flex items-center justify-center text-2xl border border-white/10 shrink-0 overflow-hidden bg-black/40">
                        {renderAvatar(req.senderAvatar)}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-extrabold text-foreground truncate">
                            {req.senderName}
                          </span>
                          <span className="rounded-md bg-white/10 px-1.5 py-0.2 font-display text-[10px] font-bold text-muted-foreground">
                            NVL. {req.senderLevel}
                          </span>
                        </div>
                        <span className="text-[11px] text-[var(--candy-cyan)] font-mono">
                          {getSugarId(req.senderUid)} • {req.senderTrophies} Copas
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <button
                        onClick={() => handleRejectRequest(req.id)}
                        className="btn-3d flex items-center justify-center size-9 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-all"
                        title="Rechazar"
                      >
                        <XCircle className="size-5" />
                      </button>
                      <button
                        onClick={() => handleAcceptRequest(req)}
                        className="btn-3d flex items-center gap-1.5 rounded-xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] px-4 py-2 font-display text-xs font-black text-[oklch(0.18_0.03_285)] shadow-md hover:scale-105 transition-all"
                      >
                        <CheckCircle2 className="size-4" />
                        <span>Aceptar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          )}

          {/* LISTA DE ENVIADAS */}
          {requestSubTab === 'sent' && (
            sentRequests.length === 0 ? (
              <div className="glass rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-border">
                <Clock className="size-12 text-muted-foreground/40" />
                <h3 className="font-display text-lg font-bold text-foreground">Sin solicitudes enviadas pendientes</h3>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Las invitaciones que envíes a otros jugadores se listarán aquí hasta que sean aceptadas.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {sentRequests.map((req) => (
                  <div
                    key={req.id}
                    className="glass flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-[oklch(1_0_0/0.02)] transition-all shadow-md"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 rounded-2xl flex items-center justify-center text-xl border border-white/10 shrink-0 bg-black/40">
                        👤
                      </div>

                      <div className="flex flex-col min-w-0">
                        <span className="font-display text-sm font-extrabold text-foreground truncate">
                          Para: {req.targetName}
                        </span>
                        <span className="text-[11px] text-amber-400 flex items-center gap-1 font-semibold">
                          <Clock className="size-3" /> Esperando respuesta
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCancelSentRequest(req.id)}
                      className="btn-3d px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 hover:bg-rose-500/20 hover:text-rose-400 text-xs font-bold text-muted-foreground transition-all shrink-0 ml-2"
                    >
                      Cancelar
                    </button>
                  </div>
                ))}
              </div>
            )
          )}
        </div>
      )}

      {/* DIÁLOGO / MODAL PARA RETAR AMIGO (EMISOR) */}
      {challengingFriend && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[4px] animate-in fade-in">
          <div className="glass max-w-sm w-full rounded-3xl p-6 border-2 border-[var(--candy-cyan)]/70 shadow-2xl flex flex-col gap-4 text-center bg-[oklch(0.14_0.03_285/0.98)] backdrop-blur-xl">
            <div className="size-16 rounded-full flex items-center justify-center text-4xl mx-auto shadow-[0_0_20px_rgba(34,221,221,0.3)] border border-white/10 overflow-hidden bg-black/40">
              {renderAvatar(challengingFriend.avatar)}
            </div>

            <div>
              <h3 className="font-display text-xl font-black text-white">
                {isWaitingResponse ? `Esperando a ${challengingFriend.name}...` : `Retar a Duelo a ${challengingFriend.name}`}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isWaitingResponse 
                  ? 'Se envió la invitación en tiempo real a su pantalla.' 
                  : 'Se generará una sala privada para este duelo 1 vs 1.'}
              </p>
            </div>

            <div className="flex flex-col gap-2 bg-black/40 rounded-2xl p-3.5 border border-white/10 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Modo:</span>
                <span className="font-bold text-[var(--candy-cyan)]">Entrenamiento Online (1 vs 1)</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Código de Sala:</span>
                <span className="font-mono font-black text-white bg-white/10 px-2 py-0.5 rounded-md text-xs">{duelRoomCode}</span>
              </div>
            </div>

            {isWaitingResponse ? (
              <div className="flex flex-col gap-3 mt-2">
                <div className="flex items-center justify-center gap-2 text-xs font-bold text-[var(--candy-cyan)] animate-pulse">
                  <Sparkles className="size-4 animate-spin" /> Esperando respuesta del rival...
                </div>
                <button
                  onClick={handleCancelDuel}
                  className="btn-3d w-full py-3 rounded-xl border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-display text-xs font-bold transition-all"
                >
                  Cancelar Reto
                </button>
              </div>
            ) : (
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setChallengingFriend(null)}
                  className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all"
                >
                  Cerrar
                </button>
                <button
                  onClick={handleSendDuel}
                  disabled={isSendingChallenge}
                  className="btn-3d flex-1 py-3 rounded-xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] font-display text-xs font-black text-[oklch(0.18_0.03_285)] shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-1.5"
                >
                  <Swords className="size-4" />
                  <span>{isSendingChallenge ? 'Enviando...' : 'Enviar Reto ⚔️'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
