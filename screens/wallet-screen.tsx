'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, History, Copy, Check, Info, Wallet, Clock, ShieldCheck, AlertCircle, X, Trash2, CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { usePlayer } from '@/lib/player-context'
import { ProfileModal } from '@/components/profile-modal'
import { db } from '@/lib/firebase'
import { doc, onSnapshot, collection, query, where, getDoc, updateDoc, limit } from 'firebase/firestore'
import { globalLogger } from '@/lib/logger'
import { getSugarId } from '@/lib/friends-service'
import { copyToClipboardSilently } from '@/lib/utils'
import {
  fetchWalletTransactions,
  createDepositOrder,
  createWithdrawOrder,
  fetchActivePlayerOrders,
  getStoredLocalOrders,
  cancelPlayerOrder,
  updateLocalOrderStatus,
  WalletTransaction,
  PlayerP2POrder
} from '@/lib/wallet-service'

export function WalletScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { coins, setCoins } = usePlayer()
  const [copiedPlayerId, setCopiedPlayerId] = useState(false)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [activeOrders, setActiveOrders] = useState<PlayerP2POrder[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cancellingOrderId, setCancellingOrderId] = useState<string | null>(null)
  
  const refreshData = () => {
    if (user?.uid) {
      fetchWalletTransactions(user.uid).then(setTransactions)
    } else {
      const local = getStoredLocalOrders()
      setActiveOrders(local.filter(o => o.status !== 'completed' && o.status !== 'cancelled'))
    }
  }

  // 1. Sincronizar historial y balance directamente desde AuthContext ($0 Spark Plan)
  useEffect(() => {
    if (!user?.uid) return
    if (user.walletHistory && Array.isArray(user.walletHistory)) {
      setTransactions(user.walletHistory)
    }
    if (typeof user.coins === 'number') {
      setCoins(user.coins)
    }
  }, [user?.walletHistory, user?.coins])

  // 2. Escuchar órdenes activas del jugador con limit(20) y pausa por visibilidad
  useEffect(() => {
    refreshData()
    if (!user?.uid) return

    let unsubOrders: (() => void) | null = null

    const startOrdersListener = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (unsubOrders) return

      try {
        const q = query(
          collection(db, 'cashier_orders'),
          where('playerUid', '==', user.uid),
          limit(20)
        )
        unsubOrders = onSnapshot(q, async (snapshot) => {
          const liveActive: PlayerP2POrder[] = []
          
          for (const docSnap of snapshot.docs) {
            const ord = docSnap.data() as PlayerP2POrder
            const orderId = docSnap.id
            
            if (ord.status !== 'completed' && ord.status !== 'cancelled') {
              liveActive.push({ ...ord, id: orderId })
            } else if (ord.status === 'completed') {
              updateLocalOrderStatus(orderId, 'completed')

              if (ord.type === 'deposit') {
                const creditedKey = `sugar_notified_${orderId}`
                const alreadyNotified = typeof window !== 'undefined' && localStorage.getItem(creditedKey)
                
                if (!alreadyNotified) {
                  if (typeof window !== 'undefined') {
                    localStorage.setItem(creditedKey, 'true')
                  }
                  const amountCoins = Number(ord.amountSugarCoins || (ord.amountFiat * 100))
                  showNotification(`✨ ¡Tu depósito de ${ord.amountFiat} ${ord.currency} (+${amountCoins} SC) ha sido validado y acreditado con éxito!`, 'success')
                }
              }
            }
          }
          setActiveOrders(liveActive)
        }, (err) => {
          console.debug('[WalletScreen] Orders snapshot notice:', err?.message)
        })
      } catch {}
    }

    const handleVisibility = () => {
      if (document.hidden) {
        if (unsubOrders) {
          unsubOrders()
          unsubOrders = null
        }
      } else {
        startOrdersListener()
      }
    }

    startOrdersListener()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility)
    }

    return () => {
      if (unsubOrders) unsubOrders()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
    }
  }, [user?.uid])

  // Tab State
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdraw'>('deposit')

  // Form States (Deposit)
  const [depositAmount, setDepositAmount] = useState('')
  const [txId, setTxId] = useState('')

  // Form States (Withdraw)
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawAddress, setWithdrawAddress] = useState('')
  const [isVipWithdraw, setIsVipWithdraw] = useState(false)

  // UI States
  const [isCopied, setIsCopied] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'info' | 'error' } | null>(null)

  const usdtEquivalent = (coins / 100).toFixed(2)

  const handleCopyAddress = () => {
    copyToClipboardSilently('TQa5...MockAddress123...XYZ').then(() => {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    })
  }

  const showNotification = (message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type })
    setTimeout(() => setNotification(null), 4500)
  }

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uid) return

    const amount = parseInt(depositAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      showNotification('Ingrese un monto válido mayor a 0', 'error')
      return
    }

    if (!txId.trim()) {
      showNotification('Ingrese el comprobante / Hash TxID', 'error')
      return
    }

    setIsSubmitting(true)
    globalLogger.wallet(`Iniciando solicitud de depósito: ${amount} USDT / +${amount * 100} SC`, { txId: txId.trim() })
    try {
      const res = await createDepositOrder({
        playerUid: user.uid,
        playerName: user.nickname || user.displayName || 'Jugador',
        amountFiat: amount,
        currency: 'USDT',
        receiptReferenceNumber: txId.trim()
      })

      if (res.success) {
        globalLogger.wallet(`Depósito registrado con éxito: #${res.orderId}`, res)
        setDepositAmount('')
        setTxId('')
        showNotification(`Solicitud #${res.orderId.slice(0, 10)} enviada al cajero. Se acreditará al validar.`, 'success')
        refreshData()
      } else {
        globalLogger.error(`Error en respuesta al registrar depósito:`, res)
      }
    } catch (err: any) {
      globalLogger.error(`Excepción al registrar depósito:`, { message: err?.message })
      showNotification('Error al registrar la solicitud de depósito', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uid) return

    const amount = parseInt(withdrawAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      showNotification('Ingrese un monto válido', 'error')
      return
    }

    const coinsToDeduct = amount * 100
    if (coins < coinsToDeduct) {
      showNotification('Saldo insuficiente de Sugar Coins', 'error')
      return
    }

    const targetWalletAddress = user?.walletAddress?.trim() || (typeof window !== 'undefined' ? localStorage.getItem('sugar_user_wallet_address')?.trim() : '')
    if (!targetWalletAddress) {
      showNotification('Debes configurar tu dirección de billetera en tu Perfil antes de solicitar un retiro', 'error')
      setIsProfileOpen(true)
      return
    }

    setIsSubmitting(true)
    globalLogger.wallet(`Iniciando solicitud de retiro: ${amount} USDT / -${coinsToDeduct} SC`, { address: targetWalletAddress })
    try {
      const res = await createWithdrawOrder({
        playerUid: user.uid,
        playerName: user.nickname || user.displayName || 'Jugador',
        amountFiat: amount,
        currency: 'USDT',
        paymentAddress: targetWalletAddress,
        isVip: isVipWithdraw
      })

      if (res.success) {
        globalLogger.wallet(`Retiro registrado con éxito: #${res.orderId}`, res)
        setWithdrawAmount('')
        showNotification(`Solicitud de retiro enviada (-${coinsToDeduct} SC retenidos en espera de validación).`, 'success')
        refreshData()
      } else {
        globalLogger.error(`Error en respuesta al registrar retiro:`, res)
      }
    } catch (err: any) {
      globalLogger.error(`Excepción al procesar retiro:`, { message: err?.message })
      showNotification('Error al procesar la solicitud de retiro', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancelOrder = async (orderId: string) => {
    if (!user?.uid || cancellingOrderId) return
    setCancellingOrderId(orderId)
    globalLogger.wallet(`Cancelando solicitud de orden: #${orderId}`)
    
    // Remoción optimista de la orden activa y actualización inmediata en el historial visual
    setActiveOrders((prev) => prev.filter((o) => o.id !== orderId))
    setTransactions((prev) => {
      let updated = false
      return prev.map((tx) => {
        if (!updated && tx.description && tx.description.includes('(Pendiente)')) {
          updated = true
          return {
            ...tx,
            description: tx.description.replace('(Pendiente)', '(Cancelada)'),
            amount: 0
          }
        }
        return tx
      })
    })

    try {
      const res = await cancelPlayerOrder(user.uid, orderId)
      if (res.success) {
        globalLogger.wallet(`Orden cancelada con éxito: #${orderId}`)
        showNotification('Solicitud cancelada con éxito', 'info')
        refreshData()
      } else {
        showNotification(res.message || 'Error al cancelar la solicitud', 'error')
        refreshData()
      }
    } catch (err: any) {
      globalLogger.error(`Excepción al cancelar orden: #${orderId}`, { message: err?.message })
      showNotification('Error al cancelar la solicitud', 'error')
      refreshData()
    } finally {
      setCancellingOrderId(null)
    }
  }

  return (
    <section className="animate-slide-in mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
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
              Billetera Oficial <Wallet className="size-6 text-emerald-400" />
            </h1>
            <p className="text-xs text-muted-foreground font-medium hidden sm:block">
              Gestiona tus depósitos, retiros USDT y consulta tu balance de Sugar Coins.
            </p>
          </div>
        </div>

        {/* Player Unique ID Pill */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              const myId = getSugarId(user?.uid)
              copyToClipboardSilently(myId).then(() => {
                setCopiedPlayerId(true)
                setTimeout(() => setCopiedPlayerId(false), 2000)
              })
            }}
            title="Copiar mi ID único para cajeros y soporte"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-[oklch(1_0_0/0.05)] hover:bg-[oklch(1_0_0/0.1)] border border-border text-xs font-mono transition-all cursor-pointer shadow-sm group"
          >
            <span className="text-[10px] uppercase font-bold text-[var(--candy-cyan)]">Mi ID:</span>
            <span className="font-black text-foreground">{getSugarId(user?.uid)}</span>
            {copiedPlayerId ? (
              <Check className="size-3.5 text-emerald-400" />
            ) : (
              <Copy className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </button>
        </div>
      </div>

      {/* Grid Layout para Desktop */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr]">
        
        {/* Columna Izquierda: Operaciones */}
        <div className="flex flex-col gap-6">
          
          {/* Main Balance */}
          <div className="glass flex flex-col items-center justify-center rounded-3xl p-8 text-center shadow-[inset_0_2px_15px_oklch(1_0_0/0.05),0_10px_30px_oklch(0_0_0/0.25)] relative overflow-hidden">
            <div className="absolute top-0 right-0 h-32 w-32 rounded-full bg-[var(--candy-gold)]/10 blur-[40px]" />
            
            <span className="text-sm font-bold uppercase tracking-widest text-muted-foreground z-10">
              Balance Disponible
            </span>
            
            <div className="mt-3 flex items-center justify-center gap-3 z-10">
              <img src="/sugar-coin.png" alt="Sugar Coin" className="size-10 sm:size-12 object-contain drop-shadow-[0_4px_12px_rgba(255,215,0,0.5)]" />
              <span className="font-display text-5xl font-extrabold text-foreground drop-shadow-lg">
                {coins.toLocaleString('es')}
              </span>
            </div>
            
            <div className="mt-2 rounded-full border border-[var(--candy-cyan)]/20 bg-[var(--candy-cyan)]/10 px-4 py-1 z-10">
              <span className="font-display text-sm font-bold text-[var(--candy-cyan)]">
                ≈ {usdtEquivalent} USDT
              </span>
            </div>
          </div>

          {/* Tab Selector */}
          <div className="flex rounded-2xl bg-[oklch(1_0_0/0.03)] p-1 border border-border">
            <button
              onClick={() => setActiveTab('deposit')}
              className={`flex-1 rounded-xl py-2.5 font-display text-sm font-bold transition-all ${
                activeTab === 'deposit' 
                  ? 'bg-[var(--candy-cyan)] text-[oklch(0.18_0.03_285)] shadow-[0_4px_10px_oklch(0.82_0.15_200/0.4)]' 
                  : 'text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground'
              }`}
            >
              DEPOSITAR
            </button>
            <button
              onClick={() => setActiveTab('withdraw')}
              className={`flex-1 rounded-xl py-2.5 font-display text-sm font-bold transition-all ${
                activeTab === 'withdraw' 
                  ? 'bg-[var(--candy-magenta)] text-primary-foreground shadow-[0_4px_10px_oklch(0.7_0.27_350/0.4)]' 
                  : 'text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground'
              }`}
            >
              RETIRAR
            </button>
          </div>

          {/* Notification Toast */}
          {notification && (
            <div className={`animate-slide-in flex items-center gap-3 rounded-2xl border p-4 text-sm font-bold ${
              notification.type === 'error'
                ? 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                : 'border-[var(--candy-cyan)]/30 bg-[var(--candy-cyan)]/10 text-[var(--candy-cyan)]'
            }`}>
              {notification.type === 'error' ? <AlertCircle className="size-5 shrink-0" /> : <Check className="size-5 shrink-0" />}
              <span className="font-display">{notification.message}</span>
            </div>
          )}

          {/* Content Panels */}
          <div className="min-h-[300px]">
            {activeTab === 'deposit' ? (
              <form onSubmit={handleDepositSubmit} className="flex animate-in fade-in slide-in-from-bottom-2 flex-col gap-5">
                {/* TRC20 Address */}
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-[oklch(1_0_0/0.02)] p-5">
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    1. Envía USDT a esta Dirección TRC20 Oficial
                  </span>
                  <div className="mt-1 flex items-center justify-between rounded-xl bg-[oklch(0_0_0/0.2)] p-3 border border-border/50">
                    <span className="font-mono text-sm tracking-tight text-foreground truncate mr-3">
                      TQa5...MockAddress123...XYZ
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyAddress}
                      className="flex shrink-0 items-center justify-center rounded-lg bg-[oklch(1_0_0/0.1)] p-2 transition-colors hover:bg-[oklch(1_0_0/0.2)]"
                    >
                      {isCopied ? <Check className="size-4 text-[var(--candy-cyan)]" /> : <Copy className="size-4 text-muted-foreground" />}
                    </button>
                  </div>
                </div>

                {/* Deposit Details */}
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-[oklch(1_0_0/0.02)] p-5">
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    2. Informar Comprobante para Validación
                  </span>
                  <div className="flex flex-col gap-3 mt-1">
                    <div className="relative">
                      <input 
                        type="number"
                        required
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Monto enviado (USDT)" 
                        className="w-full rounded-xl border border-border bg-[oklch(1_0_0/0.05)] px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-[var(--candy-cyan)] focus:bg-[oklch(1_0_0/0.1)]"
                      />
                    </div>
                    <div className="relative">
                      <input 
                        type="text" 
                        required
                        value={txId}
                        onChange={(e) => setTxId(e.target.value)}
                        placeholder="Hash / TxID de la transacción" 
                        className="w-full rounded-xl border border-border bg-[oklch(1_0_0/0.05)] px-4 py-3 text-sm font-mono text-foreground outline-none transition-colors focus:border-[var(--candy-cyan)] focus:bg-[oklch(1_0_0/0.1)]"
                      />
                    </div>
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-3d w-full rounded-xl bg-[var(--candy-cyan)] py-4 font-display text-base font-extrabold text-[oklch(0.18_0.03_285)] shadow-[0_4px_12px_oklch(0.82_0.15_200/0.4)] disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'ENVIANDO...' : 'Realizar Depósito'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleWithdrawSubmit} className="flex animate-in fade-in slide-in-from-bottom-2 flex-col gap-5">
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-[oklch(1_0_0/0.02)] p-5">
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Retirar Fondos
                  </span>

                  {/* Estado de Billetera Configurada */}
                  {user?.walletAddress ? (
                    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between shadow-inner">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="size-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="size-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-white">Billetera de Destino Registrada</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-500/30 text-emerald-300 font-bold uppercase">
                              USDT TRC-20
                            </span>
                          </div>
                          <p className="text-xs font-mono text-emerald-200 truncate font-semibold">
                            {user.walletAddress}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsProfileOpen(true)}
                        className="text-[11px] text-emerald-300 hover:text-white font-bold underline shrink-0 cursor-pointer ml-2"
                      >
                        Cambiar en Perfil
                      </button>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2.5 shadow-inner">
                      <div className="flex items-center gap-2 text-amber-300">
                        <AlertCircle className="size-4 shrink-0" />
                        <span className="font-bold text-xs">Billetera de Retiro No Registrada</span>
                      </div>
                      <p className="text-[11px] text-amber-200/90 leading-snug">
                        Para tu seguridad y rapidez operativa, debes registrar tu dirección USDT en tu Perfil una sola vez antes de solicitar retiros.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsProfileOpen(true)}
                        className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-xs font-black transition-colors cursor-pointer shadow-md"
                      >
                        Configurar Billetera en mi Perfil
                      </button>
                    </div>
                  )}

                  {/* Input de Monto a Retirar */}
                  <div className="flex flex-col gap-2 mt-1">
                    <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider">
                      MONTO A RETIRAR EN USDT
                    </label>
                    <div className="relative">
                      <input 
                        type="number"
                        required
                        disabled={!user?.walletAddress}
                        min="5"
                        step="1"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder={user?.walletAddress ? "Ej: 50, 100, 200..." : "Bloqueado (configura tu billetera primero)"} 
                        className={`w-full rounded-xl border px-4 py-3.5 text-base font-mono font-black outline-none transition-colors ${
                          !user?.walletAddress 
                            ? 'bg-slate-900/50 border-white/5 text-slate-500 opacity-50 cursor-not-allowed'
                            : 'border-border bg-[oklch(1_0_0/0.05)] text-foreground focus:border-[var(--candy-magenta)] focus:bg-[oklch(1_0_0/0.1)]'
                        }`}
                      />
                      {withdrawAmount && user?.walletAddress && (
                        <span className="absolute right-4 top-3.5 text-xs font-bold text-muted-foreground font-mono">
                          = {Number(withdrawAmount) * 100} SC
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* VIP Toggle (Settings Modal style) */}
                <div className={`flex items-center justify-between rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-4 transition-opacity ${!user?.walletAddress ? 'opacity-50' : ''}`}>
                  <div className="flex flex-col">
                    <span className="font-display text-sm font-bold text-foreground">Retiro VIP (Prioridad Máxima)</span>
                    <span className={`text-xs font-semibold ${isVipWithdraw ? 'text-[var(--candy-magenta)]' : 'text-muted-foreground'}`}>
                      Comisión: {isVipWithdraw ? '10%' : '5%'} (Llegada en minutos)
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!user?.walletAddress}
                    onClick={() => setIsVipWithdraw(!isVipWithdraw)}
                    className={`relative h-7 w-12 rounded-full transition-colors ${!user?.walletAddress ? 'cursor-not-allowed bg-muted' : isVipWithdraw ? 'bg-[var(--candy-magenta)] cursor-pointer' : 'bg-muted cursor-pointer'}`}
                  >
                    <div className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${isVipWithdraw ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !user?.walletAddress}
                  className={`btn-3d w-full rounded-xl py-4 font-display text-base font-extrabold transition-all ${
                    !user?.walletAddress
                      ? 'bg-slate-800/80 text-slate-500 border border-white/5 opacity-50 cursor-not-allowed shadow-none'
                      : 'bg-[var(--candy-magenta)] text-primary-foreground shadow-[0_4px_12px_oklch(0.7_0.27_350/0.4)] cursor-pointer'
                  }`}
                >
                  {isSubmitting ? 'PROCESANDO...' : 'Realizar Retiro'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Columna Derecha: Órdenes P2P Activas + Historial */}
        <div className="flex flex-col gap-5">
          {/* Órdenes P2P Activas en Proceso */}
          {activeOrders.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1 text-amber-300">
                <Clock className="size-4 animate-spin" />
                <h3 className="font-display text-sm font-bold uppercase tracking-wider">Órdenes en Validación (P2P)</h3>
              </div>
              <div className="flex flex-col gap-2">
                {activeOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="glass flex items-center justify-between p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300">
                        {ord.type === 'deposit' ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-foreground">
                            {ord.type === 'deposit' ? 'Depósito' : 'Retiro'} #{ord.id.slice(0, 8)}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-[10px] uppercase">
                            {ord.status === 'pending' ? 'En Cola' : ord.status}
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {ord.amountFiat} {ord.currency} ➔ {ord.amountSugarCoins.toLocaleString()} SC
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-amber-300/80 font-semibold text-right leading-tight hidden sm:block">
                        Esperando<br />Cajero
                      </span>
                      <button
                        type="button"
                        disabled={cancellingOrderId === ord.id}
                        onClick={() => handleCancelOrder(ord.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
                          cancellingOrderId === ord.id
                            ? 'bg-rose-500/10 text-rose-300/60 border-rose-500/20 cursor-not-allowed opacity-75'
                            : 'bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border-rose-500/30 active:scale-95'
                        }`}
                        title="Cancelar solicitud"
                      >
                        {cancellingOrderId === ord.id ? (
                          <>
                            <Loader2 className="size-3 animate-spin text-rose-300" />
                            <span>Cancelando...</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="size-3" />
                            <span>Cancelar</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historial de Movimientos */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <History className="size-5 text-muted-foreground" />
              <h3 className="font-display text-base font-bold text-muted-foreground">Movimientos Recientes</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[450px] flex flex-col gap-3">
              {transactions.length === 0 ? (
                <div className="text-center text-muted-foreground p-8 font-display text-sm">
                  No hay movimientos recientes
                </div>
              ) : (
                transactions.map(tx => (
                  <TransactionItem 
                    key={tx.id}
                    type={tx.amount > 0 ? 'deposit' : 'withdrawal'}
                    title={tx.description}
                    date={tx.dateStr || 'Reciente'}
                    amount={`${tx.amount > 0 ? '+' : ''}${tx.amount}`}
                    usdtEquivalent={Math.abs(tx.amount / 100).toFixed(2)}
                    color={tx.amount > 0 ? (tx.type === 'match_prize' ? 'var(--candy-gold)' : 'var(--candy-cyan)') : 'var(--candy-magenta)'}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </section>
  )
}

function TransactionItem({ type, title, date, amount, usdtEquivalent, color }: { type: 'deposit' | 'withdrawal', title: string, date: string, amount: string, usdtEquivalent: string, color: string }) {
  const isCancelled = title.toLowerCase().includes('cancelad')
  const displayColor = isCancelled ? 'var(--muted-foreground)' : color

  return (
    <div className={`glass flex shrink-0 items-center justify-between rounded-2xl p-4 transition-colors hover:bg-[oklch(1_0_0/0.03)] border ${
      isCancelled ? 'border-rose-500/20 bg-rose-500/5' : 'border-border/50'
    }`}>
      <div className="flex items-center gap-4">
        <div 
          className="flex size-10 items-center justify-center rounded-xl"
          style={{ 
            backgroundColor: isCancelled ? 'rgba(244, 63, 94, 0.15)' : `${color}22`, 
            color: isCancelled ? '#f43f5e' : color 
          }}
        >
          {isCancelled ? (
            <XCircle className="size-5 text-rose-400" />
          ) : (
            type === 'deposit' ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />
          )}
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className={`font-display text-sm font-bold ${isCancelled ? 'text-muted-foreground line-through decoration-rose-500/50' : 'text-foreground'}`}>
              {title}
            </span>
            {isCancelled && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-500/20 text-rose-300 font-extrabold text-[9px] uppercase tracking-wider">
                Cancelada
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">{date}</span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-display text-base font-extrabold" style={{ color: displayColor }}>
          {isCancelled ? '0 SC' : `${amount} Sugar Coins`}
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
          {isCancelled ? '(Anulada)' : `(${usdtEquivalent} USDT)`}
        </span>
      </div>
    </div>
  )
}
