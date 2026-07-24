'use client'

import { useState } from 'react'
import { ArrowLeft, Volume2, VolumeX, Zap, Key, Users, PlusCircle, LogIn, Copy, Check, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const PLAYER_OPTIONS = [2, 3, 4, 5, 6]

export function OnlineTraining({ onBack }: { onBack: () => void }) {
  // Tabs: 'quick' | 'friends'
  const [mainTab, setMainTab] = useState<'quick' | 'friends'>('quick')

  // Sub-tabs for Batalla Amigos: 'create' | 'join'
  const [friendsSubTab, setFriendsSubTab] = useState<'create' | 'join'>('create')

  // Player counts
  const [quickPlayers, setQuickPlayers] = useState(4)
  const [createPlayers, setCreatePlayers] = useState(4)

  // Join Room State
  const [roomCode, setRoomCode] = useState('')

  // UI state
  const [muted, setMuted] = useState(false)
  const [createdRoomCode, setCreatedRoomCode] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setNotification(msg)
    setTimeout(() => setNotification(null), 3000)
  }

  const handleStartQuickMatch = () => {
    showToast(`Buscando partida rápida para ${quickPlayers} jugadores...`)
  }

  const handleCreateRoom = () => {
    const randomCode = `SUGAR-${Math.floor(1000 + Math.random() * 9000)}`
    setCreatedRoomCode(randomCode)
    showToast(`¡Sala creada con éxito! Código: ${randomCode}`)
  }

  const handleCopyCode = () => {
    if (createdRoomCode) {
      navigator.clipboard.writeText(createdRoomCode)
      setCopiedCode(true)
      setTimeout(() => setCopiedCode(false), 2000)
    }
  }

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault()
    if (!roomCode.trim()) return
    showToast(`Conectando a la sala ${roomCode.toUpperCase()}...`)
  }

  return (
    <section className="flex flex-col gap-5 md:gap-6 animate-slide-in">
      {/* Top navigation bar */}
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={onBack}
          className="glass glass-hover flex items-center gap-3 rounded-2xl py-2.5 pl-2.5 pr-5"
          aria-label="Volver al menú principal"
        >
          <span className="btn-3d flex size-10 items-center justify-center rounded-xl bg-[var(--candy-cyan)] shadow-[0_4px_0_oklch(0.5_0.12_210)]">
            <ArrowLeft className="size-5 text-[oklch(0.18_0.03_285)]" strokeWidth={2.6} />
          </span>
          <span className="font-display text-base font-extrabold uppercase tracking-wide text-foreground sm:text-lg">
            Entrenamiento Online
          </span>
        </button>

        <button
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? 'Activar sonido' : 'Silenciar'}
          aria-pressed={muted}
          className="glass glass-hover flex size-12 shrink-0 items-center justify-center rounded-2xl text-[var(--candy-cyan)]"
        >
          {muted ? <VolumeX className="size-5" strokeWidth={2.4} /> : <Volume2 className="size-5" strokeWidth={2.4} />}
        </button>
      </div>

      {/* Main Container Card */}
      <article className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        {/* Glow Background Elements */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-60 rounded-full bg-[oklch(0.82_0.15_200/0.25)] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-16 left-10 size-60 rounded-full bg-[oklch(0.7_0.27_350/0.25)] blur-3xl" />

        <div className="relative flex flex-col gap-6">
          {/* Header Title */}
          <header className="text-center">
            <h2 className="font-display text-4xl font-extrabold tracking-tight text-[var(--candy-cyan)] neon-cyan sm:text-5xl">
              ENTRENAMIENTO ONLINE
            </h2>
            <p className="mt-1 font-display text-sm font-bold uppercase tracking-[0.25em] text-[var(--candy-magenta)] neon-magenta">
              Compite en Vivo con Jugadores
            </p>
          </header>

          {/* Toast Notification */}
          {notification && (
            <div className="animate-in fade-in slide-in-from-top-2 flex items-center justify-center gap-2 rounded-2xl border border-[var(--candy-cyan)]/40 bg-[var(--candy-cyan)]/15 p-3.5 text-[var(--candy-cyan)] font-display text-sm font-bold shadow-lg">
              <Sparkles className="size-4" />
              <span>{notification}</span>
            </div>
          )}

          {/* Pestañas Superiores principales */}
          <div className="flex rounded-2xl bg-[oklch(1_0_0/0.03)] p-1.5 border border-border/60">
            <button
              onClick={() => {
                setMainTab('quick')
                setCreatedRoomCode(null)
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm sm:text-base font-extrabold transition-all ${
                mainTab === 'quick'
                  ? 'bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.7_0.18_190))] text-[oklch(0.18_0.03_285)] shadow-[0_4px_12px_oklch(0.82_0.15_200/0.4)]'
                  : 'text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground'
              }`}
            >
              <Zap className="size-5 fill-current" />
              Partida Rápida ⚡
            </button>
            
            <button
              onClick={() => {
                setMainTab('friends')
                setCreatedRoomCode(null)
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-3 font-display text-sm sm:text-base font-extrabold transition-all ${
                mainTab === 'friends'
                  ? 'bg-[linear-gradient(145deg,var(--candy-magenta),oklch(0.6_0.25_340))] text-white shadow-[0_4px_12px_oklch(0.7_0.27_350/0.4)]'
                  : 'text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground'
              }`}
            >
              <Key className="size-5" />
              Batalla Amigos 🔑
            </button>
          </div>

          {/* TAB 1: PARTIDA RÁPIDA ⚡ */}
          {mainTab === 'quick' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-1 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground">
                  <span className="h-5 w-1.5 rounded-full bg-[var(--candy-cyan)] shadow-[0_0_12px_var(--candy-cyan)]" />
                  Selector de Jugadores
                </legend>
                
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                  {PLAYER_OPTIONS.map((count) => (
                    <PillButton
                      key={count}
                      selected={quickPlayers === count}
                      onClick={() => setQuickPlayers(count)}
                      accent="var(--candy-cyan)"
                      shadow="oklch(0.5 0.12 210)"
                    >
                      {count} Jug
                    </PillButton>
                  ))}
                </div>
                
                <p className="text-center text-sm leading-relaxed text-muted-foreground mt-1">
                  Emparejamiento automático al instante para mesa de {quickPlayers} jugadores online.
                </p>
              </fieldset>

              <button
                onClick={handleStartQuickMatch}
                className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.82_0.15_200),oklch(0.7_0.18_190))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-[oklch(0.18_0.03_285)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.5_0.12_210),0_14px_26px_oklch(0.5_0.12_210/0.55)]"
              >
                ¡COMENZAR PARTIDA! ✨
              </button>
            </div>
          )}

          {/* TAB 2: BATALLA AMIGOS 🔑 */}
          {mainTab === 'friends' && (
            <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2">
              {/* Sub-tabs selector: Crear Sala | Unirse */}
              <div className="flex rounded-xl bg-[oklch(0_0_0/0.2)] p-1 border border-border/40 w-full sm:w-80 mx-auto">
                <button
                  onClick={() => {
                    setFriendsSubTab('create')
                    setCreatedRoomCode(null)
                  }}
                  className={`flex-1 py-2 rounded-lg font-display text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    friendsSubTab === 'create'
                      ? 'bg-[var(--candy-magenta)] text-white shadow-md'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <PlusCircle className="size-4" />
                  Crear Sala 🍰
                </button>
                <button
                  onClick={() => {
                    setFriendsSubTab('join')
                    setCreatedRoomCode(null)
                  }}
                  className={`flex-1 py-2 rounded-lg font-display text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    friendsSubTab === 'join'
                      ? 'bg-[var(--candy-gold)] text-[oklch(0.25_0.08_60)] shadow-md'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <LogIn className="size-4" />
                  Unirse 🔑
                </button>
              </div>

              {/* Sub-tab A: CREAR SALA 🍰 */}
              {friendsSubTab === 'create' && (
                <div className="flex flex-col gap-6 animate-in fade-in">
                  {!createdRoomCode ? (
                    <>
                      <fieldset className="flex flex-col gap-3">
                        <legend className="mb-1 flex items-center gap-2 font-display text-sm font-extrabold uppercase tracking-wide text-foreground">
                          <span className="h-5 w-1.5 rounded-full bg-[var(--candy-magenta)] shadow-[0_0_12px_var(--candy-magenta)]" />
                          Capacidad de la Sala
                        </legend>
                        
                        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                          {PLAYER_OPTIONS.map((count) => (
                            <PillButton
                              key={count}
                              selected={createPlayers === count}
                              onClick={() => setCreatePlayers(count)}
                              accent="var(--candy-magenta)"
                              shadow="oklch(0.45 0.2 350)"
                            >
                              {count} Jug
                            </PillButton>
                          ))}
                        </div>

                        <p className="text-center text-sm text-muted-foreground mt-1">
                          Crea una sala privada para {createPlayers} jugadores e invita a tus amigos con un código.
                        </p>
                      </fieldset>

                      <button
                        onClick={handleCreateRoom}
                        className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.7_0.27_350),oklch(0.6_0.25_340))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-white shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.45_0.2_350),0_14px_26px_oklch(0.45_0.2_350/0.55)]"
                      >
                        <PlusCircle className="size-6" />
                        CREAR SALA 🍰
                      </button>
                    </>
                  ) : (
                    /* Display generated room code */
                    <div className="glass flex flex-col items-center gap-4 rounded-2xl p-6 border border-[var(--candy-magenta)]/30 text-center animate-in zoom-in-95">
                      <span className="font-display text-xs font-extrabold uppercase tracking-widest text-muted-foreground">
                        Código de tu Sala Privada
                      </span>
                      
                      <div className="flex items-center gap-3 rounded-xl bg-[oklch(0_0_0/0.4)] px-6 py-3 border border-[var(--candy-magenta)]">
                        <span className="font-mono text-3xl font-extrabold tracking-widest text-[var(--candy-cyan)]">
                          {createdRoomCode}
                        </span>
                        <button
                          onClick={handleCopyCode}
                          className="flex size-10 items-center justify-center rounded-lg bg-[oklch(1_0_0/0.1)] hover:bg-[oklch(1_0_0/0.2)] transition-colors text-white"
                          title="Copiar código"
                        >
                          {copiedCode ? <Check className="size-5 text-[var(--candy-cyan)]" /> : <Copy className="size-5" />}
                        </button>
                      </div>

                      <p className="text-xs text-muted-foreground">
                        Comparte este código con tus amigos para que ingresen desde el botón "Unirse 🔑".
                      </p>

                      <button
                        onClick={() => setCreatedRoomCode(null)}
                        className="text-xs text-[var(--candy-cyan)] hover:underline font-bold mt-2"
                      >
                        ← Crear otra sala
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Sub-tab B: UNIRSE A SALA 🔑 */}
              {friendsSubTab === 'join' && (
                <form onSubmit={handleJoinRoom} className="flex flex-col gap-5 animate-in fade-in">
                  <div className="flex flex-col gap-2">
                    <label className="font-display text-xs font-extrabold uppercase tracking-wider text-muted-foreground text-center">
                      Ingresa el Código de la Sala
                    </label>
                    <input
                      type="text"
                      required
                      value={roomCode}
                      onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                      placeholder="Ej. SUGAR-8492"
                      className="w-full rounded-2xl border-2 border-[var(--candy-gold)]/40 bg-[oklch(0_0_0/0.3)] px-6 py-4 font-mono text-2xl font-extrabold text-center tracking-widest text-[var(--candy-gold)] outline-none transition-colors focus:border-[var(--candy-gold)] focus:bg-[oklch(0_0_0/0.5)] placeholder:text-muted-foreground/30 uppercase"
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.85_0.16_90),oklch(0.78_0.18_55))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-[oklch(0.25_0.08_60)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.6_0.15_50),0_14px_26px_oklch(0.6_0.15_50/0.55)]"
                  >
                    <LogIn className="size-6" />
                    UNIRSE A SALA 🔑
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </article>
    </section>
  )
}

function PillButton({
  children,
  selected,
  onClick,
  accent,
  shadow,
}: {
  children: React.ReactNode
  selected: boolean
  onClick: () => void
  accent: string
  shadow: string
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'btn-3d rounded-2xl py-3 font-display text-base font-extrabold transition-colors',
        selected
          ? 'text-[oklch(0.16_0.03_285)]'
          : 'border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground',
      )}
      style={
        selected
          ? {
              background: `linear-gradient(145deg, ${accent}, color-mix(in oklch, ${accent}, black 12%))`,
              boxShadow: `inset 0 2px 0 oklch(1 0 0 / 0.45), 0 5px 0 ${shadow}, 0 10px 20px color-mix(in oklch, ${shadow}, transparent 45%)`,
            }
          : undefined
      }
    >
      {children}
    </button>
  )
}
