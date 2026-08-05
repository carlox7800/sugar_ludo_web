'use client'

import React, { useState, useEffect } from 'react'
import { ArrowLeft, ArrowUpRight, ArrowDownLeft, History, Copy, Check, Info } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { fetchWalletTransactions, recordWalletTransaction, WalletTransaction } from '@/lib/wallet-service'

export function WalletScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const coins = user ? Number(user.coins || 0) : 0
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  
  useEffect(() => {
    if (user?.uid) {
      fetchWalletTransactions(user.uid).then(setTransactions)
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
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'info' } | null>(null)

  const usdtEquivalent = (coins / 100).toFixed(2)

  const handleCopyAddress = () => {
    navigator.clipboard.writeText('TQa5...MockAddress123...XYZ')
    setIsCopied(true)
    setTimeout(() => setIsCopied(false), 2000)
  }

  const showNotification = (message: string) => {
    setNotification({ message, type: 'success' })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uid) return

    const amount = parseInt(depositAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      setNotification({ message: 'Ingrese un monto válido', type: 'info' })
      return
    }
    
    const coinsToAdd = amount * 100
    await recordWalletTransaction(user.uid, {
      type: 'deposit',
      amount: coinsToAdd,
      description: 'Depósito simulado USDT',
    })
    
    setDepositAmount('')
    setTxId('')
    showNotification(`Depósito acreditado con éxito (+${coinsToAdd} Coins)`)
    
    // Refresh local UI data
    fetchWalletTransactions(user.uid).then(setTransactions)
  }

  const handleWithdrawSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.uid) return

    const amount = parseInt(withdrawAmount, 10)
    if (isNaN(amount) || amount <= 0) {
      setNotification({ message: 'Ingrese un monto válido', type: 'info' })
      return
    }

    const coinsToDeduct = amount * 100
    if (coins < coinsToDeduct) {
      setNotification({ message: 'Saldo insuficiente', type: 'info' })
      setTimeout(() => setNotification(null), 3000)
      return
    }

    await recordWalletTransaction(user.uid, {
      type: 'withdraw',
      amount: -coinsToDeduct,
      description: isVipWithdraw ? 'Retiro VIP' : 'Retiro Estándar',
    })

    setWithdrawAmount('')
    setWithdrawAddress('')
    showNotification(`Retiro procesado con éxito (-${coinsToDeduct} Coins)`)
    
    // Refresh local UI data
    fetchWalletTransactions(user.uid).then(setTransactions)
  }

  return (
    <section className="animate-slide-in mx-auto flex w-full max-w-5xl flex-col gap-6 p-4">
      {/* Header Full Width */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="btn-3d flex size-10 items-center justify-center rounded-xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-5" />
          </button>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
            Billetera
          </h2>
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
            <div className="animate-slide-in flex items-center gap-3 rounded-2xl border border-[var(--candy-cyan)]/30 bg-[var(--candy-cyan)]/10 p-4 text-[var(--candy-cyan)]">
              <Check className="size-5 shrink-0" />
              <span className="font-display text-sm font-bold">{notification.message}</span>
            </div>
          )}

          {/* Content Panels */}
          <div className="min-h-[300px]">
            {activeTab === 'deposit' ? (
              <form onSubmit={handleDepositSubmit} className="flex animate-in fade-in slide-in-from-bottom-2 flex-col gap-5">
                {/* TRC20 Address */}
                <div className="flex flex-col gap-2 rounded-2xl border border-border bg-[oklch(1_0_0/0.02)] p-5">
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    1. Envía USDT a esta Dirección TRC20
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
                    2. Detalles del Pago
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
                
                <button type="submit" className="btn-3d w-full rounded-xl bg-[var(--candy-cyan)] py-4 font-display text-base font-extrabold text-[oklch(0.18_0.03_285)] shadow-[0_4px_12px_oklch(0.82_0.15_200/0.4)]">
                  INFORMAR DEPÓSITO
                </button>
              </form>
            ) : (
              <form onSubmit={handleWithdrawSubmit} className="flex animate-in fade-in slide-in-from-bottom-2 flex-col gap-5">
                <div className="flex flex-col gap-3 rounded-2xl border border-border bg-[oklch(1_0_0/0.02)] p-5">
                  <span className="font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Retirar Fondos
                  </span>
                  <div className="flex flex-col gap-3 mt-1">
                    <div className="relative">
                      <input 
                        type="number"
                        required
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Monto a retirar (USDT)" 
                        className="w-full rounded-xl border border-border bg-[oklch(1_0_0/0.05)] px-4 py-3 text-sm text-foreground outline-none transition-colors focus:border-[var(--candy-magenta)] focus:bg-[oklch(1_0_0/0.1)]"
                      />
                    </div>
                    <div className="relative">
                      <input 
                        type="text" 
                        required
                        value={withdrawAddress}
                        onChange={(e) => setWithdrawAddress(e.target.value)}
                        placeholder="Tu Dirección TRC20" 
                        className="w-full rounded-xl border border-border bg-[oklch(1_0_0/0.05)] px-4 py-3 text-sm font-mono text-foreground outline-none transition-colors focus:border-[var(--candy-magenta)] focus:bg-[oklch(1_0_0/0.1)]"
                      />
                    </div>
                  </div>
                </div>

                {/* VIP Toggle (Settings Modal style) */}
                <div className="flex items-center justify-between rounded-2xl border border-border bg-[oklch(1_0_0/0.03)] p-4">
                  <div className="flex flex-col">
                    <span className="font-display text-sm font-bold text-foreground">Retiro VIP (Max 12h)</span>
                    <span className={`text-xs font-semibold ${isVipWithdraw ? 'text-[var(--candy-magenta)]' : 'text-muted-foreground'}`}>
                      Comisión: {isVipWithdraw ? '10%' : '5%'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsVipWithdraw(!isVipWithdraw)}
                    className={`relative h-7 w-12 rounded-full transition-colors ${isVipWithdraw ? 'bg-[var(--candy-magenta)]' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 size-5 rounded-full bg-white transition-transform ${isVipWithdraw ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>

                <button type="submit" className="btn-3d w-full rounded-xl bg-[var(--candy-magenta)] py-4 font-display text-base font-extrabold text-primary-foreground shadow-[0_4px_12px_oklch(0.7_0.27_350/0.4)]">
                  SOLICITAR RETIRO
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Columna Derecha: Movimientos (Scroll independiente) */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2 px-1">
            <History className="size-5 text-muted-foreground" />
            <h3 className="font-display text-base font-bold text-muted-foreground">Movimientos Recientes</h3>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar max-h-[550px] flex flex-col gap-3">
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
    </section>
  )
}

function TransactionItem({ type, title, date, amount, usdtEquivalent, color }: { type: 'deposit' | 'withdrawal', title: string, date: string, amount: string, usdtEquivalent: string, color: string }) {
  return (
    <div className="glass flex shrink-0 items-center justify-between rounded-2xl p-4 transition-colors hover:bg-[oklch(1_0_0/0.03)] border border-border/50">
      <div className="flex items-center gap-4">
        <div 
          className="flex size-10 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${color}22`, color: color }}
        >
          {type === 'deposit' ? <ArrowDownLeft className="size-5" /> : <ArrowUpRight className="size-5" />}
        </div>
        <div className="flex flex-col">
          <span className="font-display text-sm font-bold">{title}</span>
          <span className="text-[11px] text-muted-foreground">{date}</span>
        </div>
      </div>
      <div className="flex flex-col items-end">
        <span className="font-display text-base font-extrabold" style={{ color }}>{amount} Sugar Coins</span>
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground">
          ({usdtEquivalent} USDT)
        </span>
      </div>
    </div>
  )
}
