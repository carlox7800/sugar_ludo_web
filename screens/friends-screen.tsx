'use client'

import React, { useState } from 'react'
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

export interface Friend {
  id: string
  name: string
  avatar: string
  avatarColor: string
  level: number
  trophies: number
  status: 'online' | 'in_game' | 'offline'
  lastSeen?: string
}

export interface FriendRequest {
  id: string
  name: string
  avatar: string
  avatarColor: string
  level: number
  timeAgo: string
}

const MOCK_FRIENDS: Friend[] = [
  { id: 'usr_101', name: 'CyberCandy_99', avatar: '🍭', avatarColor: 'var(--candy-magenta)', level: 14, trophies: 1250, status: 'online' },
  { id: 'usr_102', name: 'LudoMaster_Pro', avatar: '🎲', avatarColor: 'var(--candy-cyan)', level: 22, trophies: 2180, status: 'in_game' },
  { id: 'usr_103', name: 'SugarQueen_VIP', avatar: '👑', avatarColor: 'var(--candy-gold)', level: 30, trophies: 3400, status: 'online' },
  { id: 'usr_104', name: 'NeonKnight', avatar: '⚡', avatarColor: 'oklch(0.7 0.27 350)', level: 8, trophies: 720, status: 'offline', lastSeen: 'Hace 2 h' },
  { id: 'usr_105', name: 'SweetUnicorn', avatar: '🦄', avatarColor: 'var(--candy-violet)', level: 19, trophies: 1840, status: 'offline', lastSeen: 'Ayer' },
]

const MOCK_REQUESTS: FriendRequest[] = [
  { id: 'req_201', name: 'ChocoGamer_7', avatar: '🍬', avatarColor: 'var(--candy-orange)', level: 11, timeAgo: 'Hace 10 min' },
  { id: 'req_202', name: 'Galactic_Dice', avatar: '🎲', avatarColor: 'var(--candy-cyan)', level: 16, timeAgo: 'Hace 1 hora' },
]

export function FriendsScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'friends' | 'search' | 'requests'>('friends')

  // Data states
  const [friendsList, setFriendsList] = useState<Friend[]>(MOCK_FRIENDS)
  const [requestsList, setRequestsList] = useState<FriendRequest[]>(MOCK_REQUESTS)
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedMyId, setCopiedMyId] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Challenge modal state
  const [challengingFriend, setChallengingFriend] = useState<Friend | null>(null)

  const myFriendId = user?.uid ? user.uid.substring(0, 8).toUpperCase() : 'SL-884520'

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(myFriendId)
    setCopiedMyId(true)
    setTimeout(() => setCopiedMyId(false), 2000)
    showToast('📋 ¡ID de amigo copiado al portapapeles!')
  }

  const handleAcceptRequest = (req: FriendRequest) => {
    setRequestsList(prev => prev.filter(r => r.id !== req.id))
    const newFriend: Friend = {
      id: req.id,
      name: req.name,
      avatar: req.avatar,
      avatarColor: req.avatarColor,
      level: req.level,
      trophies: 1000,
      status: 'online'
    }
    setFriendsList(prev => [newFriend, ...prev])
    showToast(`✨ ¡Ahora eres amigo de ${req.name}!`)
  }

  const handleRejectRequest = (reqId: string) => {
    setRequestsList(prev => prev.filter(r => r.id !== reqId))
    showToast('Solicitud rechazada.')
  }

  const handleSendFriendRequest = (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    showToast(`📨 Solicitud enviada a "${searchQuery.trim()}"`)
    setSearchQuery('')
  }

  const handleChallenge = (friend: Friend) => {
    setChallengingFriend(friend)
  }

  const onlineCount = friendsList.filter(f => f.status === 'online').length

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
          {requestsList.length > 0 && (
            <span className="size-5 rounded-full bg-rose-500 text-[10px] font-black text-white flex items-center justify-center shadow-md">
              {requestsList.length}
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
                Utiliza la pestaña "Buscar & Añadir" para invitar a tus compañeros con su Nickname o ID.
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
                      className="size-12 rounded-2xl flex items-center justify-center text-2xl border border-white/10 shrink-0 shadow-inner"
                      style={{ backgroundColor: `${friend.avatarColor}20` }}
                    >
                      {friend.avatar}
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
                        {friend.status === 'online' && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                            <span className="size-1.5 rounded-full bg-emerald-400" /> En Línea
                          </span>
                        )}
                        {friend.status === 'in_game' && (
                          <span className="flex items-center gap-1 text-[11px] font-bold text-[var(--candy-orange)]">
                            <span className="size-1.5 rounded-full bg-[var(--candy-orange)]" /> En Partida
                          </span>
                        )}
                        {friend.status === 'offline' && (
                          <span className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground/70">
                            <Clock className="size-3" /> {friend.lastSeen || 'Desconectado'}
                          </span>
                        )}

                        <span className="text-muted-foreground/30 text-xs">•</span>
                        <span className="flex items-center gap-0.5 text-[11px] font-bold text-[var(--candy-gold)]">
                          <Trophy className="size-3" /> {friend.trophies}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <button
                      onClick={() => handleChallenge(friend)}
                      disabled={friend.status === 'offline'}
                      className={cn(
                        "btn-3d flex items-center gap-1.5 rounded-xl px-3 py-2 font-display text-xs font-black transition-all",
                        friend.status === 'online'
                          ? "bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] text-[oklch(0.18_0.03_285)] shadow-md hover:scale-105"
                          : "border border-border bg-white/5 text-muted-foreground/50 opacity-60 cursor-not-allowed"
                      )}
                    >
                      <Swords className="size-3.5" />
                      <span>Retar</span>
                    </button>
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
                <h3 className="font-display text-base font-extrabold text-foreground">Tu Código de Amigo</h3>
                <p className="text-xs text-muted-foreground">Comparte este código para que otros puedan agregarte.</p>
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
          <form onSubmit={handleSendFriendRequest} className="glass flex flex-col gap-4 p-6 rounded-3xl border border-border">
            <h3 className="font-display text-lg font-black text-foreground flex items-center gap-2">
              <UserPlus className="size-5 text-[var(--candy-cyan)]" /> Enviar Solicitud de Amistad
            </h3>
            <p className="text-xs text-muted-foreground -mt-2">
              Escribe el Nickname exacto o el ID de jugador para enviarle una invitación.
            </p>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 size-5 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ej. CyberCandy_99 o SL-884520"
                  className="w-full rounded-2xl border border-border bg-[oklch(0_0_0/0.3)] pl-11 pr-4 py-3.5 font-display text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-[var(--candy-cyan)] transition-colors"
                />
              </div>

              <button
                type="submit"
                className="btn-3d rounded-2xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] px-6 py-3.5 font-display text-sm font-black text-[oklch(0.18_0.03_285)] shadow-lg hover:scale-105 transition-all"
              >
                Enviar Solicitud
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: SOLICITUDES PENDIENTES */}
      {activeTab === 'requests' && (
        <div className="flex flex-col gap-4 animate-in fade-in">
          {requestsList.length === 0 ? (
            <div className="glass rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-border">
              <UserCheck className="size-12 text-muted-foreground/40" />
              <h3 className="font-display text-lg font-bold text-foreground">Sin solicitudes pendientes</h3>
              <p className="text-xs text-muted-foreground max-w-sm">
                Cuando otros jugadores te agreguen, podrás aceptarlos o rechazarlos desde este apartado.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {requestsList.map((req) => (
                <div
                  key={req.id}
                  className="glass flex items-center justify-between p-4 rounded-2xl border border-border/80 bg-[oklch(1_0_0/0.02)] hover:border-[var(--candy-cyan)]/40 transition-all shadow-md"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div 
                      className="size-12 rounded-2xl flex items-center justify-center text-2xl border border-white/10 shrink-0 shadow-inner"
                      style={{ backgroundColor: `${req.avatarColor}20` }}
                    >
                      {req.avatar}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-extrabold text-foreground truncate">
                          {req.name}
                        </span>
                        <span className="rounded-md bg-white/10 px-1.5 py-0.2 font-display text-[10px] font-bold text-muted-foreground">
                          NVL. {req.level}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-0.5">{req.timeAgo}</span>
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
          )}
        </div>
      )}

      {/* DIÁLOGO / MODAL PARA RETAR AMIGO */}
      {challengingFriend && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[3px] animate-in fade-in">
          <div className="glass max-w-sm w-full rounded-3xl p-6 border border-[var(--candy-cyan)] shadow-2xl flex flex-col gap-4 text-center bg-[oklch(0.14_0.03_285/0.97)] backdrop-blur-xl">
            <div 
              className="size-16 rounded-full flex items-center justify-center text-4xl mx-auto shadow-[0_0_20px_rgba(34,221,221,0.3)] border border-white/10"
              style={{ backgroundColor: `${challengingFriend.avatarColor}30` }}
            >
              {challengingFriend.avatar}
            </div>

            <h3 className="font-display text-xl font-black text-white">
              Retar a {challengingFriend.name}
            </h3>

            <p className="text-xs text-muted-foreground">
              Se creará una sala privada y se le enviará una invitación instantánea a su dispositivo.
            </p>

            <div className="flex flex-col gap-2 bg-black/30 rounded-2xl p-3 border border-white/10 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Modo:</span>
                <span className="font-bold text-[var(--candy-cyan)]">Batalla con Amigos</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Jugadores:</span>
                <span className="font-bold text-white">2 Jugadores (Duelo)</span>
              </div>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                onClick={() => setChallengingFriend(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  showToast(`⚔️ ¡Invitación enviada a ${challengingFriend.name}!`)
                  setChallengingFriend(null)
                }}
                className="btn-3d flex-1 py-3 rounded-xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] font-display text-xs font-black text-[oklch(0.18_0.03_285)] shadow-lg"
              >
                Enviar Reto
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
