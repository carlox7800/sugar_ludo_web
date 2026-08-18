'use client'

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  LayoutGrid, 
  Sparkles, 
  Check, 
  CheckCircle2, 
  Lock, 
  Trophy, 
  Flame, 
  Crown, 
  ShieldCheck, 
  Palette, 
  Smile, 
  Award, 
  Store,
  Zap,
  Dice5
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { 
  CUSTOMIZATION_ITEMS, 
  EMOTE_ITEMS, 
  StoreItem, 
  UserInventory, 
  fetchUserInventory, 
  equipStoreItem 
} from '@/lib/store-service'
import confetti from 'canvas-confetti'

export interface Achievement {
  id: string
  title: string
  description: string
  icon: string
  rewardSC: number
  unlocked: boolean
  progress: string
}

const MOCK_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'ach_1',
    title: 'Primer Triunfo',
    description: 'Gana tu primera partida en cualquier modo de juego.',
    icon: '🥇',
    rewardSC: 100,
    unlocked: true,
    progress: '1/1'
  },
  {
    id: 'ach_2',
    title: 'Verdugo del Arena',
    description: 'Captura un total de 50 fichas enemigas.',
    icon: '⚔️',
    rewardSC: 300,
    unlocked: true,
    progress: '50/50'
  },
  {
    id: 'ach_3',
    title: 'Rey de los 6 Jugadores',
    description: 'Gana 5 partidas en el tablero Hexagonal.',
    icon: '👑',
    rewardSC: 500,
    unlocked: false,
    progress: '3/5'
  },
  {
    id: 'ach_4',
    title: 'Coleccionista Maestro',
    description: 'Posee al menos 8 aspectos en tu arsenal.',
    icon: '💎',
    rewardSC: 400,
    unlocked: false,
    progress: '4/8'
  },
  {
    id: 'ach_5',
    title: 'Racha Imparable',
    description: 'Consigue una racha de 5 victorias consecutivas.',
    icon: '🔥',
    rewardSC: 600,
    unlocked: false,
    progress: '2/5'
  }
]

export function CollectionScreen({ onBack, onNavigate }: { onBack: () => void, onNavigate?: (screen: string) => void }) {
  const { user } = useAuth()

  const [activeTab, setActiveTab] = useState<'board' | 'token' | 'dice' | 'emote' | 'achievements'>('board')
  const [inventory, setInventory] = useState<UserInventory>({
    ownedItems: ['board_default', 'token_default', 'dice_default', 'emote_lol_bounce'],
    equipped: { board: 'board_default', token: 'token_default', dice: 'dice_default' },
    activeBoosters: []
  })
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Cargar inventario del usuario
  useEffect(() => {
    fetchUserInventory(user?.uid).then((inv) => {
      setInventory(inv)
    })
  }, [user?.uid])

  // Filtrar ítems según pestaña
  const boards = CUSTOMIZATION_ITEMS.filter(i => i.category === 'board')
  const tokens = CUSTOMIZATION_ITEMS.filter(i => i.category === 'token')
  const dices = CUSTOMIZATION_ITEMS.filter(i => i.category === 'dice')
  const emotes = EMOTE_ITEMS

  // Actualizar ítem seleccionado para preview
  useEffect(() => {
    if (activeTab === 'board') {
      const equippedId = inventory.equipped.board
      setSelectedItem(boards.find(b => b.id === equippedId) || boards[0])
    } else if (activeTab === 'token') {
      const equippedId = inventory.equipped.token
      setSelectedItem(tokens.find(t => t.id === equippedId) || tokens[0])
    } else if (activeTab === 'dice') {
      const equippedId = inventory.equipped.dice
      setSelectedItem(dices.find(d => d.id === equippedId) || dices[0])
    } else if (activeTab === 'emote') {
      setSelectedItem(emotes[0])
    } else {
      setSelectedItem(null)
    }
  }, [activeTab, inventory.equipped])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleEquip = async (item: StoreItem) => {
    if (item.category !== 'board' && item.category !== 'token' && item.category !== 'dice') return
    await equipStoreItem(user?.uid || 'guest', item.category, item.id)
    const updated = await fetchUserInventory(user?.uid)
    setInventory(updated)
    showToast(`✨ ¡${item.name} equipado en tu arsenal!`)
    confetti({
      particleCount: 70,
      spread: 50,
      origin: { y: 0.6 }
    })
  }

  const allItemsCount = boards.length + tokens.length + dices.length + emotes.length
  const ownedCount = inventory.ownedItems.length

  return (
    <section className="animate-slide-in mx-auto flex w-full max-w-5xl flex-col gap-5 p-2 sm:p-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 flex items-center justify-center gap-2 rounded-full border border-[var(--candy-violet)]/40 bg-[oklch(0.1_0.05_250)] px-6 py-3 text-[var(--candy-violet)] font-display text-sm font-bold shadow-2xl shadow-[var(--candy-violet)]/20 whitespace-nowrap">
          <Sparkles className="size-4 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar (Homologado con Tienda, Billetera, Amigos y Eventos) */}
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
              Colección & Arsenal <LayoutGrid className="size-6 text-[var(--candy-violet)]" />
            </h1>
            <p className="text-xs text-muted-foreground font-medium hidden sm:block">
              Personaliza tus aspectos, equipa tableros, fichas y dados exclusivos y consulta tus logros.
            </p>
          </div>
        </div>

        {/* Arsenal Progress Badge */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--candy-violet)]/40 bg-[oklch(0_0_0/0.4)] px-3 py-1.5 shadow-inner">
            <Sparkles className="size-4 text-[var(--candy-violet)]" />
            <span className="font-display text-xs sm:text-sm font-black text-[var(--candy-violet)]">
              {ownedCount}/{allItemsCount} Desbloqueados
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="grid grid-cols-5 gap-1.5 sm:gap-2 rounded-2xl bg-[oklch(1_0_0/0.03)] p-1.5 border border-border/80">
        <button
          onClick={() => setActiveTab('board')}
          className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[11px] sm:text-xs font-black transition-all",
            activeTab === 'board'
              ? "bg-[linear-gradient(145deg,var(--candy-violet),oklch(0.55_0.22_300))] text-white shadow-lg shadow-[var(--candy-violet)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Palette className="size-3.5 sm:size-4" />
          <span>Tableros</span>
        </button>

        <button
          onClick={() => setActiveTab('token')}
          className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[11px] sm:text-xs font-black transition-all",
            activeTab === 'token'
              ? "bg-[linear-gradient(145deg,var(--candy-violet),oklch(0.55_0.22_300))] text-white shadow-lg shadow-[var(--candy-violet)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <ShieldCheck className="size-3.5 sm:size-4" />
          <span>Fichas</span>
        </button>

        <button
          onClick={() => setActiveTab('dice')}
          className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[11px] sm:text-xs font-black transition-all",
            activeTab === 'dice'
              ? "bg-[linear-gradient(145deg,var(--candy-violet),oklch(0.55_0.22_300))] text-white shadow-lg shadow-[var(--candy-violet)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Dice5 className="size-3.5 sm:size-4" />
          <span>Dados</span>
        </button>

        <button
          onClick={() => setActiveTab('emote')}
          className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[11px] sm:text-xs font-black transition-all",
            activeTab === 'emote'
              ? "bg-[linear-gradient(145deg,var(--candy-violet),oklch(0.55_0.22_300))] text-white shadow-lg shadow-[var(--candy-violet)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Smile className="size-3.5 sm:size-4" />
          <span>Emotes</span>
        </button>

        <button
          onClick={() => setActiveTab('achievements')}
          className={cn(
            "flex flex-col sm:flex-row items-center justify-center gap-1.5 rounded-xl py-2.5 font-display text-[11px] sm:text-xs font-black transition-all",
            activeTab === 'achievements'
              ? "bg-[linear-gradient(145deg,var(--candy-violet),oklch(0.55_0.22_300))] text-white shadow-lg shadow-[var(--candy-violet)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Trophy className="size-3.5 sm:size-4" />
          <span>Logros</span>
        </button>
      </div>

      {/* CONTENIDO PRINCIPAL SEGÚN PESTAÑA */}
      {activeTab !== 'achievements' ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 animate-in fade-in">
          {/* Grid de Ítems */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(activeTab === 'board' ? boards : activeTab === 'token' ? tokens : activeTab === 'dice' ? dices : emotes).map((item) => {
              const isOwned = inventory.ownedItems.includes(item.id)
              const isEquipped = 
                (item.category === 'board' && inventory.equipped.board === item.id) ||
                (item.category === 'token' && inventory.equipped.token === item.id) ||
                (item.category === 'dice' && inventory.equipped.dice === item.id)
              const isSelected = selectedItem?.id === item.id

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    "glass flex flex-col justify-between p-4 rounded-3xl border transition-all cursor-pointer shadow-md gap-3",
                    isSelected
                      ? "border-[var(--candy-violet)] bg-[oklch(1_0_0/0.05)] shadow-[0_0_20px_rgba(168,85,247,0.2)]"
                      : "border-border/80 bg-[oklch(1_0_0/0.02)] hover:border-[var(--candy-violet)]/40"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div 
                      className="size-14 rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-inner border border-white/10"
                      style={{ backgroundColor: `${item.accentColor}20` }}
                    >
                      {item.icon}
                    </div>

                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <h3 className="font-display text-sm font-extrabold text-foreground truncate">
                          {item.name}
                        </h3>
                        <span className={cn(
                          "rounded-full px-2 py-0.2 text-[9px] font-black uppercase shrink-0",
                          item.rarity === 'legendary' ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" :
                          item.rarity === 'epic' ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" :
                          item.rarity === 'rare' ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" :
                          "bg-white/10 text-muted-foreground"
                        )}>
                          {item.rarity}
                        </span>
                      </div>

                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  {/* Acciones de Equipar / Estado */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {isEquipped ? '✨ En Uso' : isOwned ? 'En Inventario' : 'No adquirido'}
                    </span>

                    {isEquipped ? (
                      <span className="flex items-center gap-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-black text-emerald-400">
                        <CheckCircle2 className="size-3.5" /> Equipado
                      </span>
                    ) : isOwned ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEquip(item)
                        }}
                        className="btn-3d flex items-center gap-1 rounded-xl bg-[linear-gradient(145deg,var(--candy-violet),oklch(0.55_0.22_300))] px-3.5 py-1.5 font-display text-xs font-black text-white shadow-md hover:scale-105 transition-all"
                      >
                        <Check className="size-3.5" />
                        <span>Equipar</span>
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onNavigate ? onNavigate('tienda') : showToast('Disponible en la Tienda Oficial')
                        }}
                        className="btn-3d flex items-center gap-1 rounded-xl border border-[var(--candy-gold)]/40 bg-[var(--candy-gold)]/10 px-3 py-1 font-display text-xs font-bold text-[var(--candy-gold)] hover:bg-[var(--candy-gold)]/20 transition-all"
                      >
                        <Store className="size-3.5" />
                        <span>Ver en Tienda</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Panel Lateral: Previsualización 3D e Información */}
          {selectedItem && (
            <div className="glass flex flex-col justify-between p-5 rounded-3xl border border-[var(--candy-violet)]/40 bg-[linear-gradient(180deg,oklch(0.14_0.04_300/0.4),oklch(0.12_0.02_285/0.8))] shadow-xl">
              <div className="flex flex-col gap-4 text-center">
                <span className="font-display text-xs font-black uppercase tracking-widest text-[var(--candy-violet)]">
                  Previsualización de Arsenal
                </span>

                {/* Preview Avatar / Icon Box */}
                <div 
                  className="size-28 rounded-3xl flex items-center justify-center text-6xl mx-auto shadow-[0_0_30px_rgba(168,85,247,0.3)] border border-white/20 animate-pulse"
                  style={{ backgroundColor: `${selectedItem.accentColor}30` }}
                >
                  {selectedItem.icon}
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="font-display text-xl font-black text-white">
                    {selectedItem.name}
                  </h3>
                  <span className="text-xs font-bold uppercase text-[var(--candy-gold)]">
                    Rareza {selectedItem.rarity}
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {selectedItem.description}
                </p>
              </div>

              {/* Botón de Acción Principal en Preview */}
              <div className="pt-4 border-t border-white/10 mt-4">
                {inventory.ownedItems.includes(selectedItem.id) ? (
                  <button
                    onClick={() => handleEquip(selectedItem)}
                    className="btn-3d w-full flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,var(--candy-violet),oklch(0.55_0.22_300))] py-3 font-display text-sm font-black text-white shadow-lg hover:scale-[1.02] transition-all"
                  >
                    <Check className="size-4" />
                    <span>Equipar este Aspecto</span>
                  </button>
                ) : (
                  <button
                    onClick={() => onNavigate ? onNavigate('tienda') : showToast('Disponible en la Tienda')}
                    className="btn-3d w-full flex items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(145deg,var(--candy-gold),oklch(0.65_0.16_60))] py-3 font-display text-sm font-black text-[oklch(0.2_0.05_40)] shadow-lg hover:scale-[1.02] transition-all"
                  >
                    <Store className="size-4" />
                    <span>Adquirir en la Tienda</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* PESTAÑA: LOGROS & MEDALLAS */
        <div className="flex flex-col gap-3 animate-in fade-in">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {MOCK_ACHIEVEMENTS.map((ach) => (
              <div
                key={ach.id}
                className={cn(
                  "glass flex items-center justify-between p-4 sm:p-5 rounded-3xl border transition-all shadow-md gap-4",
                  ach.unlocked
                    ? "border-[var(--candy-gold)]/50 bg-[linear-gradient(135deg,oklch(0.14_0.04_50/0.4),oklch(0.12_0.02_285/0.8))]"
                    : "border-border/60 bg-[oklch(1_0_0/0.02)] opacity-70"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-14 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-center text-3xl shrink-0 shadow-inner">
                    {ach.icon}
                  </div>

                  <div className="flex flex-col min-w-0">
                    <h3 className="font-display text-base font-extrabold text-foreground truncate">
                      {ach.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ach.description}
                    </p>
                    <span className="text-[10px] font-bold text-muted-foreground/60 mt-1">
                      Progreso: {ach.progress}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  {ach.unlocked ? (
                    <span className="flex items-center gap-1 rounded-xl bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-black text-emerald-400">
                      <CheckCircle2 className="size-3.5" /> Logrado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-xl bg-white/10 px-3 py-1 text-xs font-bold text-muted-foreground">
                      <Lock className="size-3" /> Bloqueado
                    </span>
                  )}
                  <span className="font-display text-xs font-black text-[var(--candy-gold)] flex items-center gap-1">
                    +{ach.rewardSC} <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
