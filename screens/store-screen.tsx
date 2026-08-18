'use client'

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  Sparkles, 
  Check, 
  Zap, 
  ShoppingBag, 
  ShieldCheck, 
  Crown, 
  Flame, 
  Smile, 
  Clock, 
  Layers, 
  Palette,
  AlertCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { usePlayer } from '@/lib/player-context'
import { 
  COIN_PACKAGES, 
  CUSTOMIZATION_ITEMS, 
  EMOTE_ITEMS, 
  BOOSTER_ITEMS, 
  CoinPackage, 
  StoreItem, 
  UserInventory,
  fetchUserInventory,
  purchaseCoinPackage,
  purchaseStoreItem,
  equipStoreItem
} from '@/lib/store-service'
import confetti from 'canvas-confetti'

export function StoreScreen({ onBack }: { onBack: () => void }) {
  const { user, deductCoins } = useAuth()
  const { coins, setCoins } = usePlayer()

  // Active Main Tab: 'vault' | 'custom' | 'emotes' | 'boosters'
  const [activeTab, setActiveTab] = useState<'vault' | 'custom' | 'emotes' | 'boosters'>('vault')

  // Customization Sub-Tab: 'board' | 'token' | 'dice'
  const [customCategory, setCustomCategory] = useState<'board' | 'token' | 'dice'>('board')

  // Inventory & Equips
  const [inventory, setInventory] = useState<UserInventory>({
    ownedItems: ['board_default', 'token_default', 'dice_default'],
    equipped: { board: 'board_default', token: 'token_default', dice: 'dice_default' },
    activeBoosters: []
  })

  // Selected item for Live Preview
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null)

  // Confirmation Modals
  const [packageToBuy, setPackageToBuy] = useState<CoinPackage | null>(null)
  const [itemToBuy, setItemToBuy] = useState<StoreItem | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Load Inventory
  useEffect(() => {
    fetchUserInventory(user?.uid).then((inv) => {
      setInventory(inv)
    })
  }, [user?.uid])

  // Select initial preview item when category changes
  useEffect(() => {
    if (activeTab === 'custom') {
      const items = CUSTOMIZATION_ITEMS.filter((i) => i.category === customCategory)
      const equippedId = inventory.equipped[customCategory]
      const current = items.find((i) => i.id === equippedId) || items[0]
      setSelectedItem(current)
    } else if (activeTab === 'emotes') {
      setSelectedItem(EMOTE_ITEMS[0])
    } else if (activeTab === 'boosters') {
      setSelectedItem(BOOSTER_ITEMS[0])
    } else {
      setSelectedItem(null)
    }
  }, [activeTab, customCategory, inventory.equipped])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Handle USDT Coin Package Purchase
  const handleConfirmPackagePurchase = async () => {
    if (!packageToBuy) return
    setIsProcessing(true)

    const res = await purchaseCoinPackage(user?.uid || 'guest', packageToBuy.id)
    setIsProcessing(false)
    setPackageToBuy(null)

    if (res.success) {
      setCoins(coins + res.coinsAdded)
      showToast(`🎉 ¡${res.coinsAdded} Sugar Coins acreditadas con éxito!`)
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      })
    } else {
      showToast(`⚠️ ${res.message}`)
    }
  }

  // Handle Sugar Coins Item Purchase
  const handleConfirmItemPurchase = async () => {
    if (!itemToBuy) return
    setIsProcessing(true)

    const res = await purchaseStoreItem(user?.uid || 'guest', itemToBuy, coins, deductCoins)
    setIsProcessing(false)
    setItemToBuy(null)

    if (res.success) {
      // Reload inventory
      const updatedInv = await fetchUserInventory(user?.uid)
      setInventory(updatedInv)
      showToast(`✨ ¡${itemToBuy.name} añadido a tu inventario!`)
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      })
    } else {
      showToast(`⚠️ ${res.message}`)
    }
  }

  // Handle Equip Item
  const handleEquipItem = async (item: StoreItem) => {
    if (item.category !== 'board' && item.category !== 'token' && item.category !== 'dice') return
    await equipStoreItem(user?.uid || 'guest', item.category, item.id)
    setInventory((prev) => ({
      ...prev,
      equipped: {
        ...prev.equipped,
        [item.category]: item.id
      }
    }))
    showToast(`✅ ${item.name} equipado para tus partidas.`)
  }

  const usdtBalance = ((coins || 0) / 100).toFixed(2)

  return (
    <section className="animate-slide-in mx-auto flex w-full max-w-5xl flex-col gap-5 p-2 sm:p-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 flex items-center justify-center gap-2 rounded-full border border-[var(--candy-gold)]/40 bg-[oklch(0.1_0.05_250)] px-6 py-3 text-[var(--candy-gold)] font-display text-sm font-bold shadow-2xl shadow-[var(--candy-gold)]/20 whitespace-nowrap">
          <Sparkles className="size-4 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
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
              Tienda Oficial <ShoppingBag className="size-6 text-[var(--candy-gold)]" />
            </h1>
            <p className="text-xs text-muted-foreground font-medium hidden sm:block">
              Adquiere paquetes de monedas, aspectos exclusivos, emotes y potenciadores.
            </p>
          </div>
        </div>

        {/* Live Resource Balances */}
        <div className="flex items-center gap-2">
          {/* Sugar Coins */}
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--candy-gold)]/40 bg-[oklch(0_0_0/0.4)] px-3 py-1.5 shadow-inner">
            <img src="/sugar-coin.png" alt="Coin" className="size-5 object-contain drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" />
            <span className="font-display text-sm sm:text-base font-black text-[var(--candy-gold)]">
              {coins.toLocaleString()}
            </span>
          </div>

          {/* USDT Balance */}
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-[oklch(0_0_0/0.4)] px-3 py-1.5 shadow-inner">
            <span className="font-display text-xs font-extrabold text-emerald-400">USDT</span>
            <span className="font-display text-sm sm:text-base font-black text-emerald-400">
              ${usdtBalance}
            </span>
          </div>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex rounded-2xl bg-[oklch(0_0_0/0.3)] p-1.5 border border-border/40 gap-1 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab('vault')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 font-display text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap",
            activeTab === 'vault'
              ? "bg-[linear-gradient(145deg,var(--candy-gold),oklch(0.7_0.18_55))] text-[oklch(0.18_0.03_285)] shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          <span className="text-base">💵</span> Bóveda de Monedas
        </button>

        <button
          onClick={() => setActiveTab('custom')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 font-display text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap",
            activeTab === 'custom'
              ? "bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] text-[oklch(0.18_0.03_285)] shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          <Palette className="size-4" /> Aspectos
        </button>

        <button
          onClick={() => setActiveTab('emotes')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 font-display text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap",
            activeTab === 'emotes'
              ? "bg-[linear-gradient(145deg,var(--candy-magenta),oklch(0.65_0.25_350))] text-white shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          <Smile className="size-4" /> Emotes Animados
        </button>

        <button
          onClick={() => setActiveTab('boosters')}
          className={cn(
            "flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 font-display text-xs sm:text-sm font-extrabold transition-all whitespace-nowrap",
            activeTab === 'boosters'
              ? "bg-[linear-gradient(145deg,var(--candy-orange),oklch(0.65_0.20_45))] text-white shadow-md"
              : "text-muted-foreground hover:text-foreground hover:bg-white/5"
          )}
        >
          <Zap className="size-4" /> Potenciadores XP
        </button>
      </div>

      {/* TAB 1: BÓVEDA DE MONEDAS (COMPRA CON USDT) */}
      {activeTab === 'vault' && (
        <div className="flex flex-col gap-4 animate-in fade-in">
          {/* Promo Banner */}
          <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6 border border-[var(--candy-gold)]/40 bg-[linear-gradient(135deg,oklch(0.16_0.04_50/0.8),oklch(0.12_0.02_285/0.9))] shadow-xl">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-center sm:text-left">
                <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--candy-gold)]/20 text-3xl shadow-[0_0_20px_rgba(255,215,0,0.3)]">
                  🍯
                </div>
                <div>
                  <span className="inline-block rounded-md bg-[var(--candy-gold)]/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-[var(--candy-gold)] mb-1">
                    Bono de Bienvenida Activo
                  </span>
                  <h2 className="font-display text-xl sm:text-2xl font-black text-white">
                    ¡Hasta +30% Sugar Coins Extra con USDT!
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Los fondos en Sugar Coins se acreditan instantáneamente en tu cuenta para torneos y compras.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Packages Grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {COIN_PACKAGES.map((pkg) => {
              const isPopular = pkg.tag === 'Más Popular'
              const isBestValue = pkg.tag === 'Mejor Valor'

              return (
                <div
                  key={pkg.id}
                  className={cn(
                    "glass relative flex flex-col justify-between rounded-3xl p-5 border transition-all duration-200 hover:scale-[1.02] shadow-lg",
                    isPopular 
                      ? "border-[var(--candy-gold)] bg-[oklch(0.18_0.05_55/0.3)] shadow-[0_0_25px_rgba(255,215,0,0.15)]"
                      : isBestValue
                      ? "border-[var(--candy-cyan)] bg-[oklch(0.16_0.04_200/0.3)] shadow-[0_0_25px_rgba(0,242,255,0.15)]"
                      : "border-border/60 bg-[oklch(1_0_0/0.02)]"
                  )}
                >
                  {/* Badge */}
                  {pkg.tag && (
                    <div className="absolute top-3 right-3 rounded-full bg-[linear-gradient(135deg,var(--candy-gold),var(--candy-orange))] px-2.5 py-0.5 text-[10px] font-black uppercase text-[oklch(0.18_0.03_285)] shadow-md">
                      {pkg.tag}
                    </div>
                  )}

                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-3xl p-2 rounded-2xl bg-black/30 border border-white/10">{pkg.icon}</span>
                    <div>
                      <h3 className="font-display text-lg font-extrabold text-white">{pkg.name}</h3>
                      <span className="text-xs text-muted-foreground font-semibold">
                        Base: {pkg.baseCoins.toLocaleString()} SC {pkg.bonusPercent > 0 && `(+${pkg.bonusPercent}%)`}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border/40 pt-4 mt-2">
                    <div className="flex items-center gap-1.5">
                      <img src="/sugar-coin.png" alt="Coin" className="size-6 object-contain" />
                      <span className="font-display text-2xl font-black text-[var(--candy-gold)]">
                        {pkg.totalCoins.toLocaleString()}
                      </span>
                    </div>

                    <button
                      onClick={() => setPackageToBuy(pkg)}
                      className="btn-3d flex items-center gap-1 rounded-2xl bg-[linear-gradient(145deg,oklch(0.85_0.16_90),oklch(0.78_0.18_55))] px-4 py-2 font-display text-sm font-black text-[oklch(0.25_0.08_60)] shadow-[0_4px_10px_rgba(255,215,0,0.3)] hover:scale-105"
                    >
                      ${pkg.usdtCost}.00 USDT
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 2: PERSONALIZACIÓN & ASPECTOS */}
      {activeTab === 'custom' && (
        <div className="flex flex-col gap-5 animate-in fade-in">
          {/* Subcategory Pills */}
          <div className="flex rounded-xl bg-[oklch(0_0_0/0.2)] p-1 border border-border/40 w-full sm:w-80 mx-auto">
            <button
              onClick={() => setCustomCategory('board')}
              className={cn(
                "flex-1 py-1.5 rounded-lg font-display text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                customCategory === 'board' ? "bg-[var(--candy-cyan)] text-black shadow-md" : "text-muted-foreground hover:text-foreground"
              )}
            >
              🏁 Tableros
            </button>
            <button
              onClick={() => setCustomCategory('token')}
              className={cn(
                "flex-1 py-1.5 rounded-lg font-display text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                customCategory === 'token' ? "bg-[var(--candy-cyan)] text-black shadow-md" : "text-muted-foreground hover:text-foreground"
              )}
            >
              ⚪ Fichas
            </button>
            <button
              onClick={() => setCustomCategory('dice')}
              className={cn(
                "flex-1 py-1.5 rounded-lg font-display text-xs font-bold transition-all flex items-center justify-center gap-1.5",
                customCategory === 'dice' ? "bg-[var(--candy-cyan)] text-black shadow-md" : "text-muted-foreground hover:text-foreground"
              )}
            >
              🎲 Dados
            </button>
          </div>

          {/* Interactive Live Preview Box */}
          {selectedItem && (
            <div className="glass rounded-3xl p-5 border border-[var(--candy-cyan)]/40 bg-[linear-gradient(135deg,oklch(0.14_0.03_285/0.9),oklch(0.1_0.02_285/0.95))] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-5">
                <div className="size-20 sm:size-24 rounded-2xl bg-black/40 border border-[var(--candy-cyan)]/50 flex items-center justify-center text-4xl sm:text-5xl shadow-[0_0_20px_rgba(0,242,255,0.2)] animate-pulse">
                  {selectedItem.icon}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="rounded-full bg-[var(--candy-cyan)]/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-[var(--candy-cyan)] border border-[var(--candy-cyan)]/40">
                      {selectedItem.rarity}
                    </span>
                    <span className="text-xs text-muted-foreground font-semibold">
                      {selectedItem.category === 'board' ? 'Tablero 3D' : selectedItem.category === 'token' ? 'Fichas de Juego' : 'Dado Personalizado'}
                    </span>
                  </div>
                  <h3 className="font-display text-2xl font-black text-white">{selectedItem.name}</h3>
                  <p className="text-xs sm:text-sm text-slate-300 max-w-md">{selectedItem.description}</p>
                </div>
              </div>

              {/* Action Button */}
              <div>
                {inventory.equipped[customCategory] === selectedItem.id ? (
                  <button disabled className="btn-3d flex items-center gap-2 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-6 py-3 font-display font-black text-sm">
                    <Check className="size-4" /> EQUIPADO
                  </button>
                ) : inventory.ownedItems.includes(selectedItem.id) || selectedItem.priceSC === 0 ? (
                  <button
                    onClick={() => handleEquipItem(selectedItem)}
                    className="btn-3d flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.7_0.15_200))] px-6 py-3 font-display font-black text-sm text-[oklch(0.18_0.03_285)] shadow-[0_4px_12px_rgba(0,242,255,0.3)] hover:scale-105"
                  >
                    EQUIPAR
                  </button>
                ) : (
                  <button
                    onClick={() => setItemToBuy(selectedItem)}
                    className="btn-3d flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,var(--candy-gold),oklch(0.7_0.18_55))] px-6 py-3 font-display font-black text-sm text-[oklch(0.18_0.03_285)] shadow-[0_4px_12px_rgba(255,215,0,0.3)] hover:scale-105"
                  >
                    COMPRAR POR {selectedItem.priceSC} SC
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Grid of Items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {CUSTOMIZATION_ITEMS.filter((i) => i.category === customCategory).map((item) => {
              const isOwned = inventory.ownedItems.includes(item.id) || item.priceSC === 0
              const isEquipped = inventory.equipped[customCategory] === item.id
              const isSelected = selectedItem?.id === item.id

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={cn(
                    "glass relative flex flex-col items-center text-center p-4 rounded-3xl border cursor-pointer transition-all duration-200",
                    isSelected ? "border-[var(--candy-cyan)] bg-[oklch(0.16_0.04_200/0.3)] shadow-[0_0_20px_rgba(0,242,255,0.2)] scale-[1.02]" : "border-border/50 hover:bg-white/5",
                    isEquipped && "ring-2 ring-emerald-400/50"
                  )}
                >
                  {isEquipped && (
                    <div className="absolute top-2.5 left-2.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 px-2 py-0.5 text-[9px] font-black uppercase">
                      Activo
                    </div>
                  )}

                  <div className="size-16 rounded-2xl bg-black/30 border border-white/10 flex items-center justify-center text-3xl mb-3 mt-1 shadow-inner">
                    {item.icon}
                  </div>

                  <h4 className="font-display text-sm font-extrabold text-white truncate w-full mb-1">{item.name}</h4>
                  
                  <div className="mt-2 w-full">
                    {isOwned ? (
                      <span className="text-[11px] font-bold text-emerald-400">Desbloqueado</span>
                    ) : (
                      <span className="font-display text-xs font-black text-[var(--candy-gold)] flex items-center justify-center gap-1">
                        {item.priceSC} <img src="/sugar-coin.png" alt="Coin" className="size-3.5 object-contain" />
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 3: EMOTES ANIMADOS PREMIUM */}
      {activeTab === 'emotes' && (
        <div className="flex flex-col gap-4 animate-in fade-in">
          <div className="glass rounded-3xl p-4 sm:p-5 border border-[var(--candy-magenta)]/30 bg-[linear-gradient(135deg,oklch(0.14_0.04_350/0.4),oklch(0.12_0.02_285/0.8))]">
            <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
              <Smile className="size-5 text-[var(--candy-magenta)]" /> Reacciones Premium para Chat de Partida
            </h2>
            <p className="text-xs text-muted-foreground">
              Desbloquea expresiones animadas con bucles y efectos visuales para interactuar en tus partidas online.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {EMOTE_ITEMS.map((emote) => {
              const isOwned = inventory.ownedItems.includes(emote.id)

              return (
                <div
                  key={emote.id}
                  className="glass flex flex-col justify-between p-5 rounded-3xl border border-border/60 bg-[oklch(1_0_0/0.02)] shadow-lg hover:border-[var(--candy-magenta)]/50 transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="size-16 rounded-2xl bg-black/40 border border-[var(--candy-magenta)]/40 flex items-center justify-center text-4xl shadow-[0_0_15px_rgba(255,34,119,0.2)] animate-bounce">
                      {emote.icon}
                    </div>
                    <div>
                      <span className="rounded-full bg-[var(--candy-magenta)]/20 px-2 py-0.5 text-[9px] font-black uppercase text-[var(--candy-magenta)]">
                        {emote.rarity}
                      </span>
                      <h3 className="font-display text-base font-extrabold text-white mt-1">{emote.name}</h3>
                      <p className="text-xs text-muted-foreground">{emote.description}</p>
                    </div>
                  </div>

                  <div className="border-t border-border/40 pt-3 mt-4 flex items-center justify-between">
                    <div className="flex items-center gap-1 font-display text-sm font-black text-[var(--candy-gold)]">
                      {emote.priceSC} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" />
                    </div>

                    {isOwned ? (
                      <span className="rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 text-xs font-black uppercase">
                        Desbloqueado
                      </span>
                    ) : (
                      <button
                        onClick={() => setItemToBuy(emote)}
                        className="btn-3d rounded-xl bg-[linear-gradient(145deg,var(--candy-magenta),oklch(0.65_0.25_350))] px-4 py-1.5 font-display text-xs font-black text-white shadow-md hover:scale-105"
                      >
                        DESBLOQUEAR
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* TAB 4: POTENCIADORES DE XP (BOOSTERS) */}
      {activeTab === 'boosters' && (
        <div className="flex flex-col gap-4 animate-in fade-in">
          <div className="glass rounded-3xl p-4 sm:p-5 border border-[var(--candy-orange)]/30 bg-[linear-gradient(135deg,oklch(0.14_0.04_45/0.4),oklch(0.12_0.02_285/0.8))]">
            <h2 className="font-display text-lg font-black text-white flex items-center gap-2">
              <Zap className="size-5 text-[var(--candy-orange)]" /> Aceleradores de Nivel
            </h2>
            <p className="text-xs text-muted-foreground">
              Multiplica la experiencia acumulada en tus partidas competitivas y de entrenamiento para subir de rango más rápido.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {BOOSTER_ITEMS.map((booster) => (
              <div
                key={booster.id}
                className="glass flex flex-col justify-between p-5 rounded-3xl border border-border/60 bg-[oklch(1_0_0/0.02)] shadow-lg hover:border-[var(--candy-orange)]/50 transition-all"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-3xl p-2 rounded-2xl bg-black/40 border border-white/10">{booster.icon}</span>
                    <span className="rounded-full bg-[var(--candy-orange)]/20 px-2 py-0.5 text-[10px] font-black uppercase text-[var(--candy-orange)]">
                      {booster.rarity}
                    </span>
                  </div>
                  <h3 className="font-display text-base font-extrabold text-white">{booster.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">{booster.description}</p>
                </div>

                <div className="border-t border-border/40 pt-3 mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-1 font-display text-sm font-black text-[var(--candy-gold)]">
                    {booster.priceSC} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" />
                  </div>

                  <button
                    onClick={() => setItemToBuy(booster)}
                    className="btn-3d rounded-xl bg-[linear-gradient(145deg,var(--candy-orange),oklch(0.65_0.20_45))] px-4 py-1.5 font-display text-xs font-black text-white shadow-md hover:scale-105"
                  >
                    ACTIVAR
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: CONFIRMAR COMPRA DE PAQUETE USDT */}
      {packageToBuy && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[3px] animate-in fade-in">
          <div className="glass max-w-sm w-full rounded-3xl p-6 border border-[var(--candy-gold)] shadow-2xl flex flex-col gap-4 text-center bg-[oklch(0.14_0.03_285/0.97)] backdrop-blur-xl">
            <div className="size-16 rounded-full bg-[var(--candy-gold)]/20 text-4xl flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(255,215,0,0.3)]">
              {packageToBuy.icon}
            </div>

            <h3 className="font-display text-xl font-black text-white">
              Confirmar Adquisición
            </h3>

            <p className="text-xs text-muted-foreground">
              Estás a punto de adquirir el paquete <strong className="text-white">{packageToBuy.name}</strong> por <strong className="text-emerald-400">${packageToBuy.usdtCost}.00 USDT</strong>.
            </p>

            <div className="bg-black/30 rounded-2xl p-3 border border-white/10 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-semibold">Total a Recibir:</span>
              <span className="font-display text-base font-black text-[var(--candy-gold)] flex items-center gap-1">
                +{packageToBuy.totalCoins.toLocaleString()} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" />
              </span>
            </div>

            <div className="flex gap-3 mt-2">
              <button
                disabled={isProcessing}
                onClick={() => setPackageToBuy(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all"
              >
                Cancelar
              </button>
              <button
                disabled={isProcessing}
                onClick={handleConfirmPackagePurchase}
                className="btn-3d flex-1 py-3 rounded-xl bg-[linear-gradient(145deg,var(--candy-gold),oklch(0.7_0.18_55))] font-display text-xs font-black text-[oklch(0.18_0.03_285)] shadow-lg"
              >
                {isProcessing ? 'Procesando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAR COMPRA CON SUGAR COINS */}
      {itemToBuy && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[3px] animate-in fade-in">
          <div className="glass max-w-sm w-full rounded-3xl p-6 border border-[var(--candy-cyan)] shadow-2xl flex flex-col gap-4 text-center bg-[oklch(0.14_0.03_285/0.97)] backdrop-blur-xl">
            <div className="size-16 rounded-full bg-[var(--candy-cyan)]/20 text-4xl flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(0,242,255,0.3)]">
              {itemToBuy.icon}
            </div>

            <h3 className="font-display text-xl font-black text-white">
              Desbloquear Artículo
            </h3>

            <p className="text-xs text-muted-foreground">
              ¿Deseas desbloquear <strong className="text-white">{itemToBuy.name}</strong> por <strong className="text-[var(--candy-gold)]">{itemToBuy.priceSC} Sugar Coins</strong>?
            </p>

            <div className="bg-black/30 rounded-2xl p-3 border border-white/10 flex flex-col gap-1 text-xs">
              <div className="flex justify-between text-muted-foreground">
                <span>Tu saldo actual:</span>
                <span className="text-white font-bold">{coins} SC</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Saldo restante:</span>
                <span className={cn("font-bold", coins >= itemToBuy.priceSC ? "text-emerald-400" : "text-red-400")}>
                  {coins - itemToBuy.priceSC} SC
                </span>
              </div>
            </div>

            {coins < itemToBuy.priceSC && (
              <div className="text-xs text-red-400 font-bold flex items-center justify-center gap-1">
                <AlertCircle className="size-3.5" /> Saldo insuficiente en Sugar Coins
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button
                disabled={isProcessing}
                onClick={() => setItemToBuy(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all"
              >
                Cancelar
              </button>
              <button
                disabled={isProcessing || coins < itemToBuy.priceSC}
                onClick={handleConfirmItemPurchase}
                className="btn-3d flex-1 py-3 rounded-xl bg-[linear-gradient(145deg,var(--candy-cyan),oklch(0.65_0.18_200))] font-display text-xs font-black text-[oklch(0.18_0.03_285)] shadow-lg disabled:opacity-50"
              >
                {isProcessing ? 'Procesando...' : 'Comprar Ahora'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
