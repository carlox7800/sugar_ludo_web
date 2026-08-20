'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ArrowLeft, Crown, Check, Clock, UserPlus, Loader2, Copy, Swords, Sparkles, X, Send, Trophy, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { getSugarId, sendP2PData, subscribeToP2PData, fetchUserFriends, sendRealtimeDuelInvite, subscribeToSentDuelResult } from '@/lib/friends-service'
import { FriendItem } from '@/lib/friends-service'

export type LobbyPlayer = {
  uid: string
  name: string
  avatar: string
  avatarColor: string
  level: number
  trophies: number
  isReady: boolean
  isHost: boolean
}

interface BatallaLobbyProps {
  mode: 'host' | 'guest'
  hostUid?: string
  capacity?: number
  onBack: () => void
  onStartGame: (roomCode: string, playersCount: number) => void // Para que el Host cree la sala en el socket, o para que el guest reciba el codigo y se una
}

export function BatallaLobby({ mode, hostUid, capacity = 4, onBack, onStartGame }: BatallaLobbyProps) {
  const { user } = useAuth()
  const [players, setPlayers] = useState<LobbyPlayer[]>([])
  const [targetPlayers, setTargetPlayers] = useState(capacity)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [friends, setFriends] = useState<FriendItem[]>([])
  const [loadingFriends, setLoadingFriends] = useState(false)
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set())
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => {
      setToastMessage(null)
    }, 4000)
  }

  // My local player object
  const me: LobbyPlayer = {
    uid: user?.uid || 'guest',
    name: user?.nickname || user?.displayName || 'Jugador',
    avatar: user?.photoURL || '🎲',
    avatarColor: (user as any)?.rankPoints >= 2000 ? '#facc15' : '#38bdf8',
    level: Number(user?.level || 1),
    trophies: Number((user as any)?.rankPoints !== undefined ? (user as any).rankPoints : (((user as any)?.totalWins || 0) * 25)),
    isReady: mode === 'host', // Host is always ready
    isHost: mode === 'host'
  }

  // Effect: Initialization
  useEffect(() => {
    if (mode === 'host') {
      setPlayers([me])
    } else if (mode === 'guest' && hostUid) {
      setPlayers([me])
      // Emit a join request to the host
      sendP2PData(hostUid, { type: 'lobby_join', player: me })
    }
  }, [mode, hostUid])

  // Effect: P2P Data Listener
  useEffect(() => {
    const unsub = subscribeToP2PData((data) => {
      if (!data || typeof data !== 'object') return

      if (mode === 'host') {
        if (data.type === 'lobby_join' && data.player) {
          setPlayers((prev) => {
            // Prevent duplicates and respect capacity
            if (prev.some(p => p.uid === data.player.uid)) return prev
            if (prev.length >= targetPlayers) return prev
            
            const newPlayers = [...prev, data.player]
            // Broadcast new state to all guests
            newPlayers.filter(p => !p.isHost).forEach(p => {
              sendP2PData(p.uid, { type: 'lobby_state', players: newPlayers, targetPlayers })
            })
            return newPlayers
          })
        } else if (data.type === 'lobby_ready' && data.uid) {
          setPlayers((prev) => {
            const newPlayers = prev.map(p => p.uid === data.uid ? { ...p, isReady: data.isReady } : p)
            // Broadcast new state
            newPlayers.filter(p => !p.isHost).forEach(p => {
              sendP2PData(p.uid, { type: 'lobby_state', players: newPlayers, targetPlayers })
            })
            return newPlayers
          })
        }
      } else if (mode === 'guest') {
        if (data.type === 'lobby_state' && data.players) {
          setPlayers(data.players)
          if (data.targetPlayers) setTargetPlayers(data.targetPlayers)
        } else if (data.type === 'lobby_start' && data.roomCode) {
          // The host started the game!
          onStartGame(data.roomCode, data.playersCount || data.players?.length || targetPlayers)
        }
      }
    })

    return () => unsub()
  }, [mode, targetPlayers, onStartGame])

  const handleToggleReady = () => {
    if (mode === 'host') return // Host is always ready
    
    const myCurrentState = players.find(p => p.uid === me.uid)?.isReady || false
    const newState = !myCurrentState
    
    // Optimistic local update
    setPlayers(prev => prev.map(p => p.uid === me.uid ? { ...p, isReady: newState } : p))
    
    // Send to host
    if (hostUid) {
      sendP2PData(hostUid, { type: 'lobby_ready', uid: me.uid, isReady: newState })
    }
  }

  useEffect(() => {
    const handleSocketCreated = (e: any) => {
      const code = e.detail.roomCode
      if (mode === 'host') {
        players.filter(p => !p.isHost).forEach(p => {
          sendP2PData(p.uid, { type: 'lobby_start', roomCode: code, playersCount: players.length })
        })
      }
    }
    window.addEventListener('p2p_lobby_socket_created', handleSocketCreated)
    return () => window.removeEventListener('p2p_lobby_socket_created', handleSocketCreated)
  }, [players, mode])

  const handleStartHost = () => {
    if (mode !== 'host') return
    // Check if everyone is ready
    if (!allGuestsReady) return
    if (players.length < 2) return

    // Notify parent to create the socket.io room and transition
    onStartGame('CREATE_NOW', players.length)
  }

  const openDrawer = async () => {
    setIsDrawerOpen(true)
    setLoadingFriends(true)
    const list = await fetchUserFriends(user?.uid)
    setFriends(list)
    setLoadingFriends(false)
  }

  const handleInvite = (friend: FriendItem) => {
    if (invitedUids.has(friend.id)) return
    
    // We send a duel invite, but the roomCode tells the guest it's a Lobby
    const { challengeId } = sendRealtimeDuelInvite(user, friend, `LOBBY-${me.uid}`, () => {
      showToast(`No se pudo conectar con ${friend.name}. Verifica que tenga la app abierta.`)
      setInvitedUids(prev => {
        const next = new Set(prev)
        next.delete(friend.id)
        return next
      })
    })
    
    setInvitedUids(prev => new Set(prev).add(friend.id))

    // 1. Cierre automático e instantáneo del panel lateral
    setIsDrawerOpen(false)

    // 2. Escucha reactiva ante rechazo del amigo invitado
    if (challengeId) {
      const unsub = subscribeToSentDuelResult(challengeId, (status) => {
        if (status === 'rejected') {
          showToast(`El jugador ${friend.name} ha rechazado la invitación.`)
          // Permitir re-invitarlo removiéndolo de la lista de pendientes
          setInvitedUids(prev => {
            const next = new Set(prev)
            next.delete(friend.id)
            return next
          })
          unsub()
        }
      })
    }
  }

  const myPlayer = players.find(p => p.uid === me.uid)
  const isMeReady = myPlayer?.isReady || false
  const allGuestsReady = players.length >= 2 && players.every(p => p.isReady)

  return (
    <div className="flex flex-col w-full h-full animate-in fade-in zoom-in-95 relative">
      {/* Toast Notification Flotante */}
      {toastMessage && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 flex items-center justify-center gap-2.5 rounded-full border border-amber-500/50 bg-[oklch(0.12_0.04_260/0.95)] backdrop-blur-md px-6 py-3 text-amber-300 font-display text-xs sm:text-sm font-extrabold shadow-[0_10px_30px_rgba(245,158,11,0.3)] tracking-wide whitespace-nowrap">
          <AlertCircle className="size-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      <div className="bg-card w-full max-w-2xl mx-auto rounded-[2rem] p-6 sm:p-8 border-2 border-[var(--candy-cyan)] shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col items-center gap-6 relative overflow-hidden">
        
        {/* Glow Effects */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-60 rounded-full bg-[var(--candy-cyan)]/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 size-60 rounded-full bg-[var(--candy-magenta)]/20 blur-3xl" />

        <header className="text-center w-full relative z-10 flex flex-col items-center gap-2">
          <div className="flex items-center justify-between w-full mb-2">
             <button
                onClick={onBack}
                className="btn-3d flex items-center gap-2 rounded-xl border border-red-500/50 bg-red-500/10 px-4 py-2 font-display text-xs font-bold uppercase tracking-wider text-red-500 hover:bg-red-500/20 transition-colors shadow-lg active:scale-95"
              >
                <ArrowLeft className="size-4" /> Salir
              </button>
              <div className="bg-white/10 px-4 py-1.5 rounded-full border border-white/20 font-display text-xs font-bold text-white tracking-widest flex items-center gap-2 shadow-inner">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                SALA PRIVADA
              </div>
          </div>
          
          <h2 className="font-display text-3xl sm:text-4xl font-extrabold uppercase text-[var(--candy-cyan)] tracking-wider drop-shadow-sm flex items-center gap-3">
             <Swords className="size-8" /> BATALLA DE AMIGOS
          </h2>
          <p className="font-display text-sm font-bold uppercase tracking-[0.2em] text-[var(--candy-magenta)]">
            {players.length} / {targetPlayers} Jugadores
          </p>

          {mode === 'host' && (
            <div className="mt-2 flex items-center gap-3 bg-[oklch(0_0_0/0.4)] border border-[var(--candy-cyan)]/40 px-4 py-2 rounded-xl">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Código ID:</span>
              <span className="font-mono text-xl font-black text-[var(--candy-cyan)] tracking-widest">{getSugarId(user?.uid).replace('SL-', '')}</span>
            </div>
          )}
        </header>

        {/* Dynamic Seats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full z-10 mt-2">
          {Array.from({ length: targetPlayers }).map((_, i) => {
             const player = players[i]
             if (player) {
               return (
                 <div key={player.uid} className={cn(
                   "relative flex flex-col items-center gap-3 rounded-2xl p-4 border-2 transition-all shadow-xl bg-[oklch(0_0_0/0.5)] backdrop-blur-sm",
                   player.isReady ? "border-emerald-500/60 shadow-[0_0_20px_rgba(16,185,129,0.2)]" : "border-[var(--candy-cyan)]/30"
                 )}>
                   {player.isHost && (
                     <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[var(--candy-gold)] text-black px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md z-20">
                       <Crown className="size-3" /> Anfitrión
                     </div>
                   )}
                   
                   <div className="relative">
                     <div className={cn(
                       "size-16 sm:size-20 rounded-full border-4 shadow-lg overflow-hidden flex items-center justify-center bg-card z-10 relative",
                       player.isReady ? "border-emerald-500" : "border-muted"
                     )}>
                       {player.avatar.startsWith('http') || player.avatar.startsWith('data:') ? (
                         <img src={player.avatar} alt={player.name} className="w-full h-full object-cover" />
                       ) : (
                         <span className="text-3xl">{player.avatar}</span>
                       )}
                     </div>
                     {player.isReady && (
                       <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-1 border-2 border-background z-20 shadow-md">
                         <Check className="size-4" strokeWidth={3} />
                       </div>
                     )}
                   </div>

                   <div className="flex flex-col items-center text-center w-full">
                     <span className="font-display text-sm font-extrabold text-white truncate w-full px-2">{player.name}</span>
                     <span className="text-xs font-bold text-[var(--candy-gold)] flex items-center gap-1">
                       <Trophy className="size-3" /> {player.trophies}
                     </span>
                   </div>

                   <div className={cn(
                     "w-full py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-center mt-1 border",
                     player.isReady ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                   )}>
                     {player.isReady ? '¡Listo!' : 'Esperando...'}
                   </div>
                 </div>
               )
             } else {
               // Empty Seat
               return (
                 <div key={`empty-${i}`} className="flex flex-col items-center justify-center gap-3 rounded-2xl p-4 border-2 border-dashed border-muted-foreground/30 bg-[oklch(1_1_1/0.02)] transition-colors">
                   <div className="size-16 sm:size-20 rounded-full border-2 border-dashed border-muted-foreground/40 flex items-center justify-center bg-black/20">
                     <UserPlus className="size-6 text-muted-foreground/50" />
                   </div>
                   <div className="h-4 w-20 bg-muted-foreground/10 rounded-full mt-2" />
                   {mode === 'host' ? (
                     <button 
                       onClick={openDrawer}
                       className="mt-2 text-xs font-bold uppercase tracking-widest text-[var(--candy-cyan)] hover:text-white transition-colors flex items-center gap-1"
                     >
                       + Invitar Amigo
                     </button>
                   ) : (
                     <span className="mt-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                       Libre
                     </span>
                   )}
                 </div>
               )
             }
          })}
        </div>

        {/* Action Buttons */}
        <div className="w-full flex flex-col items-center gap-4 mt-4 z-10">
          {mode === 'host' ? (
            <button
              onClick={handleStartHost}
              disabled={!allGuestsReady || players.length < 2}
              className={cn(
                "btn-3d flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl py-4 font-display text-lg font-extrabold uppercase tracking-widest shadow-xl transition-all duration-300",
                allGuestsReady && players.length >= 2
                  ? "bg-[linear-gradient(145deg,oklch(0.85_0.16_90),oklch(0.78_0.18_55))] text-[oklch(0.25_0.08_60)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.6_0.15_50),0_14px_26px_oklch(0.6_0.15_50/0.55)] scale-100 hover:scale-105 cursor-pointer"
                  : "bg-muted text-muted-foreground opacity-50 cursor-not-allowed scale-95"
              )}
            >
              ¡COMENZAR PARTIDA! 🚀
            </button>
          ) : (
            <button
              onClick={handleToggleReady}
              className={cn(
                "btn-3d flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl py-4 font-display text-lg font-extrabold uppercase tracking-widest shadow-xl transition-all duration-300",
                !isMeReady
                  ? "bg-[linear-gradient(145deg,oklch(0.7_0.18_190),oklch(0.6_0.15_180))] text-white shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.5_0.12_210)] hover:scale-105 cursor-pointer"
                  : "bg-[linear-gradient(145deg,oklch(0.85_0.16_90),oklch(0.78_0.18_55))] text-[oklch(0.25_0.08_60)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.6_0.15_50)] hover:scale-105 cursor-pointer"
              )}
            >
              {isMeReady ? 'Cancelar Preparación ⏳' : '¡ESTOY LISTO! ✅'}
            </button>
          )}

          {mode === 'host' && (!allGuestsReady && players.length >= 2) && (
            <p className="text-xs font-bold text-[var(--candy-gold)] uppercase tracking-widest animate-pulse flex items-center gap-2">
              <Clock className="size-3" /> Esperando a que los invitados estén listos
            </p>
          )}
          {mode === 'host' && players.length < 2 && (
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
              <UserPlus className="size-3" /> Invita amigos para comenzar
            </p>
          )}
        </div>
      </div>

      {/* Friends Drawer */}
      {isDrawerOpen && (
        <div className="absolute inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm h-full bg-card border-l border-[var(--candy-cyan)]/40 shadow-2xl animate-in slide-in-from-right-full flex flex-col relative overflow-hidden">
             {/* Glow Background Elements */}
            <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-[oklch(0.82_0.15_200/0.15)] blur-3xl" />
            <div className="pointer-events-none absolute -bottom-10 left-0 size-40 rounded-full bg-[oklch(0.7_0.27_350/0.15)] blur-3xl" />

            <header className="p-5 border-b border-white/10 flex items-center justify-between z-10 bg-black/20">
              <h3 className="font-display text-xl font-black text-white flex items-center gap-2">
                <UserPlus className="size-5 text-[var(--candy-cyan)]" /> Invitar Amigos
              </h3>
              <button 
                onClick={() => setIsDrawerOpen(false)}
                className="size-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <X className="size-4" />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 z-10">
              {loadingFriends ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground">
                  <Loader2 className="size-6 animate-spin text-[var(--candy-cyan)]" />
                  <span className="text-xs font-bold uppercase tracking-widest">Buscando en la red P2P...</span>
                </div>
              ) : friends.filter(f => f.status === 'online').length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 gap-3 text-muted-foreground text-center px-4">
                  <Sparkles className="size-8 text-[var(--candy-magenta)]/50" />
                  <span className="text-sm font-bold">No hay amigos en línea</span>
                  <span className="text-xs">Los amigos deben tener la app abierta para recibir invitaciones instantáneas.</span>
                </div>
              ) : (
                friends.filter(f => f.status === 'online').map(friend => {
                  const isInvited = invitedUids.has(friend.id)
                  const isJoined = players.some(p => p.uid === friend.id)
                  return (
                    <div key={friend.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 rounded-full bg-black/40 overflow-hidden border-2 border-[var(--candy-cyan)]">
                           {friend.avatar.startsWith('http') || friend.avatar.startsWith('data:') ? (
                             <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                           ) : (
                             <span className="flex items-center justify-center w-full h-full text-lg">{friend.avatar}</span>
                           )}
                           <div className="absolute bottom-0 right-0 size-3 bg-emerald-500 rounded-full border border-black shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-display text-sm font-bold text-white truncate max-w-[120px]">{friend.name}</span>
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">En Línea</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => handleInvite(friend)}
                        disabled={isInvited || isJoined}
                        className={cn(
                          "px-3 py-1.5 rounded-lg font-display text-xs font-bold uppercase tracking-widest transition-all",
                          isJoined ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/50" :
                          isInvited ? "bg-amber-500/20 text-amber-400 border border-amber-500/50" :
                          "bg-[var(--candy-cyan)] text-black shadow-[0_0_10px_var(--candy-cyan)] hover:scale-105 active:scale-95"
                        )}
                      >
                        {isJoined ? 'En Sala' : isInvited ? 'Enviado' : 'Invitar'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
