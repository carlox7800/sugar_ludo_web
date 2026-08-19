'use client'

import React, { useState, useEffect } from 'react'
import { 
  ArrowLeft, 
  Mail, 
  MailOpen, 
  Gift, 
  Bell, 
  Sparkles, 
  CheckCircle2, 
  Clock, 
  Trash2, 
  CheckCheck, 
  Info, 
  ShieldCheck, 
  Award,
  ChevronRight
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { usePlayer } from '@/lib/player-context'
import confetti from 'canvas-confetti'
import { 
  MailItem, 
  fetchUserInbox, 
  claimMailReward, 
  claimAllRewards, 
  markMailAsRead 
} from '@/lib/mail-service'

export function MailScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { coins, setCoins } = usePlayer()

  const [activeTab, setActiveTab] = useState<'rewards' | 'system'>('rewards')
  const [mailList, setMailList] = useState<MailItem[]>([])
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  // Load real inbox
  const loadInbox = async () => {
    try {
      const inbox = await fetchUserInbox(user?.uid)
      setMailList(inbox)
    } catch (e) {
      console.warn('Error loading inbox:', e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadInbox()
  }, [user])

  const handleOpenMail = (mail: MailItem) => {
    markMailAsRead(user?.uid, mail.id)
    setMailList(prev => prev.map(m => m.id === mail.id ? { ...m, isRead: true } : m))
    setSelectedMail(mail)
  }

  const handleClaimSingle = async (mailId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const target = mailList.find(m => m.id === mailId)
    if (!target || target.claimed || !target.rewardSC) return

    const res = await claimMailReward(user?.uid, mailId, (added) => {
      setCoins(coins + added)
    })

    if (res.success) {
      setMailList(prev => prev.map(m => m.id === mailId ? { ...m, claimed: true, isRead: true } : m))
      if (selectedMail?.id === mailId) {
        setSelectedMail(prev => prev ? { ...prev, claimed: true, isRead: true } : null)
      }

      showToast(`✨ ¡Reclamado con éxito! +${res.coinsAdded} Sugar Coins`)
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      })
    } else {
      showToast(res.message)
    }
  }

  const handleClaimAll = async () => {
    const res = await claimAllRewards(user?.uid, (added) => {
      setCoins(coins + added)
    })

    if (res.success && res.totalCoins > 0) {
      setMailList(prev => prev.map(m => (m.category === 'rewards' && m.rewardSC) ? { ...m, claimed: true, isRead: true } : m))
      showToast(`🎉 ¡Reclamaste todas las recompensas! +${res.totalCoins} Sugar Coins`)
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      })
    } else {
      showToast('No hay recompensas pendientes para reclamar.')
    }
  }

  const filteredMails = mailList.filter(m => m.category === activeTab)
  const unreadRewardsCount = mailList.filter(m => m.category === 'rewards' && !m.claimed).length
  const unreadSystemCount = mailList.filter(m => m.category === 'system' && !m.isRead).length

  return (
    <section className="animate-slide-in mx-auto flex w-full max-w-5xl flex-col gap-5 p-2 sm:p-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] animate-in fade-in slide-in-from-top-4 flex items-center justify-center gap-2 rounded-full border border-[var(--candy-magenta)]/40 bg-[oklch(0.1_0.05_250)] px-6 py-3 text-[var(--candy-magenta)] font-display text-sm font-bold shadow-2xl shadow-[var(--candy-magenta)]/20 whitespace-nowrap">
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
              Buzón de Correo <Mail className="size-6 text-[var(--candy-magenta)]" />
            </h1>
            <p className="text-xs text-muted-foreground font-medium hidden sm:block">
              Recibe avisos del sistema, recompensas de torneos y regalos de la comunidad.
            </p>
          </div>
        </div>

        {/* Global Action Button */}
        {activeTab === 'rewards' && unreadRewardsCount > 0 && (
          <button
            onClick={handleClaimAll}
            className="btn-3d flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#10b981,#059669)] px-4 py-2 font-display text-xs font-black text-white shadow-lg hover:scale-105 transition-all"
          >
            <CheckCheck className="size-4" />
            <span>Reclamar Todo ({unreadRewardsCount})</span>
          </button>
        )}
      </div>

      {/* Main Navigation Tabs */}
      <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[oklch(1_0_0/0.03)] p-1.5 border border-border/80">
        <button
          onClick={() => setActiveTab('rewards')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all relative",
            activeTab === 'rewards'
              ? "bg-[linear-gradient(145deg,var(--candy-magenta),oklch(0.6_0.25_350))] text-white shadow-lg shadow-[var(--candy-magenta)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Gift className="size-4" />
          <span>Recompensas & Regalos</span>
          {unreadRewardsCount > 0 && (
            <span className="size-5 rounded-full bg-emerald-500 text-[10px] font-black text-white flex items-center justify-center shadow-md">
              {unreadRewardsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all relative",
            activeTab === 'system'
              ? "bg-[linear-gradient(145deg,var(--candy-magenta),oklch(0.6_0.25_350))] text-white shadow-lg shadow-[var(--candy-magenta)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Bell className="size-4" />
          <span>Avisos del Sistema</span>
          {unreadSystemCount > 0 && (
            <span className="size-5 rounded-full bg-[var(--candy-cyan)] text-[10px] font-black text-black flex items-center justify-center shadow-md">
              {unreadSystemCount}
            </span>
          )}
        </button>
      </div>

      {/* LISTA DE MENSAJES */}
      <div className="flex flex-col gap-3 animate-in fade-in">
        {filteredMails.length === 0 ? (
          <div className="glass rounded-3xl p-12 text-center flex flex-col items-center gap-3 border border-border">
            <MailOpen className="size-12 text-muted-foreground/40" />
            <h3 className="font-display text-lg font-bold text-foreground">Tu buzón está vacío</h3>
            <p className="text-xs text-muted-foreground max-w-sm">
              No tienes mensajes nuevos en esta categoría. Las recompensas y anuncios aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredMails.map((mail) => (
              <div
                key={mail.id}
                onClick={() => handleOpenMail(mail)}
                className={cn(
                  "glass flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-md gap-4",
                  !mail.isRead
                    ? "border-[var(--candy-magenta)]/50 bg-[oklch(1_0_0/0.04)] shadow-[0_0_15px_rgba(255,34,119,0.1)]"
                    : "border-border/70 bg-[oklch(1_0_0/0.01)] opacity-80"
                )}
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  <div className={cn(
                    "size-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-inner border",
                    mail.category === 'rewards'
                      ? "bg-[var(--candy-gold)]/20 border-[var(--candy-gold)]/30 text-[var(--candy-gold)]"
                      : "bg-[var(--candy-cyan)]/20 border-[var(--candy-cyan)]/30 text-[var(--candy-cyan)]"
                  )}>
                    {mail.category === 'rewards' ? <Gift className="size-6" /> : <Bell className="size-6" />}
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm sm:text-base font-extrabold text-foreground truncate">
                        {mail.title}
                      </h3>
                      {mail.badge && (
                        <span className="rounded-full bg-[var(--candy-gold)]/20 px-2 py-0.5 text-[10px] font-black uppercase text-[var(--candy-gold)] border border-[var(--candy-gold)]/30">
                          {mail.badge}
                        </span>
                      )}
                      {!mail.isRead && (
                        <span className="size-2 rounded-full bg-[var(--candy-magenta)] animate-ping shrink-0" />
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground/80">{mail.sender}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock className="size-3" /> {mail.date}</span>
                    </div>

                    <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-1">
                      {mail.content}
                    </p>
                  </div>
                </div>

                {/* Actions & Rewards */}
                <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                  {mail.rewardSC && (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 font-display text-sm font-black text-[var(--candy-gold)]">
                        +{mail.rewardSC} <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" />
                      </div>

                      {mail.claimed ? (
                        <span className="flex items-center gap-1 text-xs font-bold text-emerald-400">
                          <CheckCircle2 className="size-4" /> Cobrado
                        </span>
                      ) : (
                        <button
                          onClick={(e) => handleClaimSingle(mail.id, e)}
                          className="btn-3d flex items-center gap-1.5 rounded-xl bg-[linear-gradient(145deg,#10b981,#059669)] px-3.5 py-1.5 font-display text-xs font-black text-white shadow-md hover:scale-105 transition-all"
                        >
                          <Gift className="size-3.5" />
                          <span>Reclamar</span>
                        </button>
                      )}
                    </div>
                  )}

                  {!mail.rewardSC && (
                    <ChevronRight className="size-5 text-muted-foreground/60 hidden sm:block" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DETALLES DEL MENSAJE */}
      {selectedMail && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/40 backdrop-blur-[3px] animate-in fade-in">
          <div className="glass max-w-lg w-full rounded-3xl p-6 border border-[var(--candy-magenta)] shadow-2xl flex flex-col gap-4 text-left bg-[oklch(0.14_0.03_285/0.97)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-4">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "size-12 rounded-2xl flex items-center justify-center text-xl shrink-0 shadow-inner border",
                  selectedMail.category === 'rewards'
                    ? "bg-[var(--candy-gold)]/20 border-[var(--candy-gold)]/30 text-[var(--candy-gold)]"
                    : "bg-[var(--candy-cyan)]/20 border-[var(--candy-cyan)]/30 text-[var(--candy-cyan)]"
                )}>
                  {selectedMail.category === 'rewards' ? <Gift className="size-6" /> : <Bell className="size-6" />}
                </div>

                <div>
                  <h3 className="font-display text-lg font-black text-white">
                    {selectedMail.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    De: <strong className="text-white">{selectedMail.sender}</strong> • {selectedMail.date}
                  </p>
                </div>
              </div>

              {selectedMail.badge && (
                <span className="rounded-full bg-[var(--candy-gold)]/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-[var(--candy-gold)] border border-[var(--candy-gold)]/30">
                  {selectedMail.badge}
                </span>
              )}
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">
              {selectedMail.content}
            </p>

            {selectedMail.rewardSC && (
              <div className="rounded-2xl bg-black/40 border border-white/10 p-4 flex items-center justify-between mt-2">
                <span className="text-xs text-muted-foreground font-semibold">Recompensa Adjunta:</span>
                <span className="font-display text-base font-black text-[var(--candy-gold)] flex items-center gap-1.5">
                  +{selectedMail.rewardSC} Sugar Coins <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" />
                </span>
              </div>
            )}

            <div className="flex gap-3 mt-3">
              <button
                onClick={() => setSelectedMail(null)}
                className="flex-1 py-3 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all text-center"
              >
                Cerrar
              </button>

              {selectedMail.rewardSC && !selectedMail.claimed && (
                <button
                  onClick={() => handleClaimSingle(selectedMail.id)}
                  className="btn-3d flex-1 py-3 rounded-xl bg-[linear-gradient(145deg,#10b981,#059669)] font-display text-xs font-black text-white shadow-lg"
                >
                  Cobrar Recompensa
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
