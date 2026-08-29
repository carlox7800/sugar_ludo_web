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
  ChevronRight,
  Headphones,
  Send,
  MessageSquare,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { usePlayer } from '@/lib/player-context'
import { db } from '@/lib/firebase'
import { doc, onSnapshot, collection, query, where, getDoc, updateDoc } from 'firebase/firestore'
import { globalLogger } from '@/lib/logger'
import confetti from 'canvas-confetti'
import { 
  MailItem, 
  SupportReply,
  fetchUserInbox, 
  claimMailReward, 
  claimAllRewards, 
  markMailAsRead,
  replySupportMail
} from '@/lib/mail-service'

export function MailScreen({ onBack }: { onBack: () => void }) {
  const { user } = useAuth()
  const { coins, setCoins } = usePlayer()

  const [activeTab, setActiveTab] = useState<'rewards' | 'system' | 'support'>('rewards')
  const [mailList, setMailList] = useState<MailItem[]>([])
  const [selectedMail, setSelectedMail] = useState<MailItem | null>(null)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [replyInput, setReplyInput] = useState('')
  const [isSendingReply, setIsSendingReply] = useState(false)

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
    if (!user?.uid || user?.uid.startsWith('dev_')) return

    // 1. Escuchar el buzón de usuario en tiempo real desde Firestore
    let unsubUser: (() => void) | null = null
    try {
      const userRef = doc(db, 'users', user.uid)
      unsubUser = onSnapshot(
        userRef,
        (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data()
            if (Array.isArray(data.inbox)) {
              setMailList((prev) => {
                const supportFromOrders = prev.filter(m => m.id.startsWith('mail_ord_sup_'))
                const userMails = data.inbox.filter((m: any) => !m.id.startsWith('mail_ord_sup_'))
                return [...supportFromOrders, ...userMails]
              })
              if (selectedMail && !selectedMail.orderId) {
                const refreshed = data.inbox.find((m: any) => m.id === selectedMail.id)
                if (refreshed) setSelectedMail(refreshed)
              }
            }
          }
        },
        (err) => {
          console.debug('[MailScreen] Inbox snapshot notice:', err?.message)
        }
      )
    } catch {}

    // 2. Escuchar mensajes de soporte P2P desde cashier_orders en tiempo real ($0 Spark Plan)
    let unsubOrders: (() => void) | null = null
    try {
      const qOrders = query(
        collection(db, 'cashier_orders'),
        where('playerUid', '==', user.uid)
      )
      unsubOrders = onSnapshot(
        qOrders,
        (snapshot) => {
          const orderSupportMails: MailItem[] = []

          snapshot.forEach((docSnap) => {
            const ord = docSnap.data() as any
            const orderId = docSnap.id
            const orderMessages = Array.isArray(ord.supportMessages) ? ord.supportMessages : []

            if (orderMessages.length > 0) {
              const lastMsg = orderMessages[orderMessages.length - 1]
              
              // Deduplicar replies por id
              const replyMap = new Map<string, SupportReply>()
              orderMessages.forEach((m: any) => {
                const key = m.id || `${m.timestamp}_${m.message}`
                replyMap.set(key, {
                  id: key,
                  sender: m.senderName || (m.senderRole === 'cashier' ? 'Cajero Autorizado' : 'Jugador'),
                  senderRole: (m.senderRole || (m.senderUid === user.uid ? 'player' : 'cashier')) as any,
                  message: m.message,
                  timestamp: m.timestamp || Date.now(),
                  attachmentUrl: m.attachmentUrl
                })
              })

              const replies = Array.from(replyMap.values())
              const isOrderRead = ord.playerReadAt ? ord.playerReadAt >= (lastMsg.timestamp || 0) : (lastMsg.senderUid === user.uid)

              orderSupportMails.push({
                id: `mail_ord_sup_${orderId}`,
                title: `Soporte de Orden #${orderId.slice(0, 8)} (${ord.type === 'withdraw' ? 'Retiro' : 'Depósito'})`,
                sender: lastMsg.senderName || 'Cajero Autorizado',
                date: 'Hoy',
                category: 'support',
                isRead: isOrderRead,
                content: lastMsg.message,
                badge: ord.status === 'completed' ? 'Completado' : 'Soporte P2P',
                orderId: orderId,
                status: ord.status === 'completed' ? 'resolved' : 'pending',
                timestamp: lastMsg.timestamp || Date.now(),
                replies
              })
            }
          })

          setMailList((prev) => {
            const nonOrderMails = prev.filter(m => !m.id.startsWith('mail_ord_sup_'))
            return [...orderSupportMails, ...nonOrderMails]
          })

          if (selectedMail && selectedMail.orderId) {
            const updatedSelected = orderSupportMails.find(m => m.orderId === selectedMail.orderId)
            if (updatedSelected) {
              setSelectedMail(updatedSelected)
            }
          }
        },
        (err) => {
          console.debug('[MailScreen] Orders support snapshot notice:', err?.message)
        }
      )
    } catch {}

    const handleLocalUpdate = () => {
      loadInbox()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('sugar_inbox_updated', handleLocalUpdate)
    }

    return () => {
      if (unsubUser) unsubUser()
      if (unsubOrders) unsubOrders()
      if (typeof window !== 'undefined') {
        window.removeEventListener('sugar_inbox_updated', handleLocalUpdate)
      }
    }
  }, [user?.uid, selectedMail?.id])

  const handleOpenMail = async (mail: MailItem) => {
    markMailAsRead(user?.uid, mail.id)
    setMailList(prev => prev.map(m => m.id === mail.id ? { ...m, isRead: true } : m))
    setSelectedMail(mail)

    if (mail.orderId) {
      try {
        const orderRef = doc(db, 'cashier_orders', mail.orderId)
        await updateDoc(orderRef, {
          playerReadAt: Date.now()
        })
      } catch {}
    }
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

  const handleSendReply = async () => {
    if (!replyInput.trim() || !selectedMail || isSendingReply) return
    setIsSendingReply(true)
    const replyText = replyInput.trim()
    const senderName = user?.displayName || 'Jugador'
    const now = Date.now()
    const newReplyId = `rep_${now}_${Math.random().toString(36).slice(2, 6)}`
    const newReply: SupportReply = {
      id: newReplyId,
      sender: senderName,
      senderRole: 'player',
      message: replyText,
      timestamp: now
    }

    setReplyInput('')

    try {
      // 1. Si está vinculado a una orden P2P, actualizar directamente cashier_orders
      if (selectedMail.orderId) {
        const orderRef = doc(db, 'cashier_orders', selectedMail.orderId)
        const orderSnap = await getDoc(orderRef)
        if (orderSnap.exists()) {
          const ordData = orderSnap.data() || {}
          const currentMsgs = Array.isArray(ordData.supportMessages) ? ordData.supportMessages : []
          await updateDoc(orderRef, {
            supportMessages: [...currentMsgs, {
              id: newReply.id,
              orderId: selectedMail.orderId,
              senderUid: user?.uid || 'usr_player',
              senderName: senderName,
              senderRole: 'player',
              message: replyText,
              timestamp: now
            }],
            lastMessage: replyText,
            lastMessageTime: now,
            hasUnreadPlayerMessage: true,
            playerReadAt: now
          })
        }
      }

      // 2. Sincronizar también con inbox de usuario
      await replySupportMail(
        user?.uid,
        selectedMail.id,
        replyText,
        senderName,
        'player'
      )

      showToast('✉️ ¡Respuesta enviada al cajero con éxito!')
    } catch (e) {
      console.warn('Error sending reply:', e)
      showToast('Error al enviar respuesta')
    } finally {
      setIsSendingReply(false)
    }
  }

  const filteredMails = mailList.filter(m => m.category === activeTab)
  const unreadRewardsCount = mailList.filter(m => m.category === 'rewards' && !m.claimed).length
  const unreadSystemCount = mailList.filter(m => m.category === 'system' && !m.isRead).length
  const unreadSupportCount = mailList.filter(m => m.category === 'support' && !m.isRead).length

  return (
    <section className="animate-slide-in mx-auto flex w-full max-w-5xl flex-col gap-5 p-2 sm:p-4">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[350] animate-in fade-in slide-in-from-top-4 flex items-center justify-center gap-2 rounded-full border border-[var(--candy-magenta)]/40 bg-[oklch(0.1_0.05_250)] px-6 py-3 text-[var(--candy-magenta)] font-display text-sm font-bold shadow-2xl shadow-[var(--candy-magenta)]/20 whitespace-nowrap">
          <Sparkles className="size-4 animate-spin" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="btn-3d flex size-10 items-center justify-center rounded-xl border border-border bg-[oklch(1_0_0/0.05)] text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Volver al Lobby"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold uppercase tracking-wide text-foreground flex items-center gap-2">
              Buzón de Correo <Mail className="size-6 text-[var(--candy-magenta)]" />
            </h1>
            <p className="text-xs text-muted-foreground font-medium hidden sm:block">
              Recibe avisos del sistema, recompensas de torneos y soporte de cajeros P2P.
            </p>
          </div>
        </div>

        {/* Global Action Button */}
        {activeTab === 'rewards' && unreadRewardsCount > 0 && (
          <button
            onClick={handleClaimAll}
            className="btn-3d flex items-center gap-2 rounded-2xl bg-[linear-gradient(145deg,#10b981,#059669)] px-4 py-2 font-display text-xs font-black text-white shadow-lg hover:scale-105 transition-all cursor-pointer"
          >
            <CheckCheck className="size-4" />
            <span>Reclamar Todo ({unreadRewardsCount})</span>
          </button>
        )}
      </div>

      {/* Main Navigation Tabs: 3 TABS (Rewards, System, Support) */}
      <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[oklch(1_0_0/0.03)] p-1.5 border border-border/80">
        <button
          onClick={() => setActiveTab('rewards')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all relative cursor-pointer",
            activeTab === 'rewards'
              ? "bg-[linear-gradient(145deg,var(--candy-magenta),oklch(0.6_0.25_350))] text-white shadow-lg shadow-[var(--candy-magenta)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Gift className="size-4" />
          <span className="hidden sm:inline">Recompensas</span>
          <span className="sm:hidden">Regalos</span>
          {unreadRewardsCount > 0 && (
            <span className="size-5 rounded-full bg-emerald-500 text-[10px] font-black text-white flex items-center justify-center shadow-md">
              {unreadRewardsCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('system')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all relative cursor-pointer",
            activeTab === 'system'
              ? "bg-[linear-gradient(145deg,var(--candy-magenta),oklch(0.6_0.25_350))] text-white shadow-lg shadow-[var(--candy-magenta)]/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Bell className="size-4" />
          <span className="hidden sm:inline">Avisos del Sistema</span>
          <span className="sm:hidden">Sistema</span>
          {unreadSystemCount > 0 && (
            <span className="size-5 rounded-full bg-[var(--candy-cyan)] text-[10px] font-black text-black flex items-center justify-center shadow-md">
              {unreadSystemCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('support')}
          className={cn(
            "flex items-center justify-center gap-2 rounded-xl py-3 font-display text-xs sm:text-sm font-black transition-all relative cursor-pointer",
            activeTab === 'support'
              ? "bg-[linear-gradient(145deg,#06b6d4,#0891b2)] text-white shadow-lg shadow-cyan-500/25"
              : "text-muted-foreground hover:bg-[oklch(1_0_0/0.05)] hover:text-foreground"
          )}
        >
          <Headphones className="size-4" />
          <span className="hidden sm:inline">Soporte & Cajeros</span>
          <span className="sm:hidden">Soporte</span>
          {unreadSupportCount > 0 && (
            <span className="size-5 rounded-full bg-amber-500 text-[10px] font-black text-white flex items-center justify-center shadow-md">
              {unreadSupportCount}
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
              {activeTab === 'support'
                ? 'No tienes consultas o mensajes de cajeros pendientes. Las notificaciones de soporte aparecerán aquí.'
                : 'No tienes mensajes nuevos en esta categoría. Las recompensas y anuncios aparecerán aquí.'}
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
                      : mail.category === 'support'
                      ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
                      : "bg-[var(--candy-cyan)]/20 border-[var(--candy-cyan)]/30 text-[var(--candy-cyan)]"
                  )}>
                    {mail.category === 'rewards' ? (
                      <Gift className="size-6" />
                    ) : mail.category === 'support' ? (
                      <Headphones className="size-6" />
                    ) : (
                      <Bell className="size-6" />
                    )}
                  </div>

                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-sm sm:text-base font-extrabold text-foreground truncate">
                        {mail.title}
                      </h3>
                      {mail.badge && (
                        <span className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-black uppercase border",
                          mail.category === 'support'
                            ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                            : "bg-[var(--candy-gold)]/20 text-[var(--candy-gold)] border-[var(--candy-gold)]/30"
                        )}>
                          {mail.badge}
                        </span>
                      )}
                      {mail.orderId && (
                        <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-mono text-slate-300 border border-white/10">
                          Orden #{mail.orderId.slice(0, 8)}
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
                          className="btn-3d flex items-center gap-1.5 rounded-xl bg-[linear-gradient(145deg,#10b981,#059669)] px-3.5 py-1.5 font-display text-xs font-black text-white shadow-md hover:scale-105 transition-all cursor-pointer"
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

      {/* MODAL DETALLES DEL MENSAJE Y CHAT P2P */}
      {selectedMail && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl border border-cyan-500/40 bg-[#0c101d] shadow-2xl overflow-hidden animate-in zoom-in-95">
            
            {/* Fixed Header */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/90 shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className={cn(
                  "size-10 rounded-xl flex items-center justify-center shrink-0 border",
                  selectedMail.category === 'rewards'
                    ? "bg-[var(--candy-gold)]/20 border-[var(--candy-gold)]/30 text-[var(--candy-gold)]"
                    : selectedMail.category === 'support'
                    ? "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
                    : "bg-[var(--candy-cyan)]/20 border-[var(--candy-cyan)]/30 text-[var(--candy-cyan)]"
                )}>
                  {selectedMail.category === 'rewards' ? (
                    <Gift className="size-5" />
                  ) : selectedMail.category === 'support' ? (
                    <Headphones className="size-5" />
                  ) : (
                    <Bell className="size-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-sm sm:text-base font-black text-white truncate">
                    {selectedMail.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground truncate">
                    De: <strong className="text-white">{selectedMail.sender}</strong> • {selectedMail.date}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {selectedMail.badge && (
                  <span className="rounded-full bg-cyan-500/20 px-2.5 py-0.5 text-[10px] font-black uppercase text-cyan-300 border border-cyan-500/30">
                    {selectedMail.badge}
                  </span>
                )}
                <button
                  onClick={() => setSelectedMail(null)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                  aria-label="Cerrar modal"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {selectedMail.category !== 'support' && (
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {selectedMail.content}
                </p>
              )}

              {/* Support Message Conversation Thread */}
              {selectedMail.category === 'support' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-cyan-300 tracking-wider flex items-center gap-1.5">
                      <MessageSquare className="size-3.5" /> Hilo de Conversación
                    </h4>
                    {selectedMail.orderId && (
                      <span className="text-[10px] text-slate-400 font-mono">
                        #{selectedMail.orderId.slice(0, 10)}
                      </span>
                    )}
                  </div>

                  {/* Unique Deduplicated Replies */}
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {Array.from(new Map((selectedMail.replies || []).map(r => [r.id || `${r.timestamp}_${r.message}`, r])).values()).map((rep) => (
                      <div
                        key={rep.id || `${rep.timestamp}_${rep.message}`}
                        className={cn(
                          "p-3 rounded-2xl text-xs space-y-1",
                          rep.senderRole === 'player'
                            ? "bg-[var(--candy-magenta)]/15 border border-[var(--candy-magenta)]/30 ml-6"
                            : "bg-cyan-500/15 border border-cyan-500/30 mr-6"
                        )}
                      >
                        <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                          <strong className={rep.senderRole === 'player' ? 'text-pink-300' : 'text-cyan-300'}>
                            {rep.sender} {rep.senderRole === 'cashier' ? '(Cajero)' : ''}
                          </strong>
                          <span>{new Date(rep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-foreground whitespace-pre-wrap">{rep.message}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedMail.rewardSC && (
                <div className="rounded-2xl bg-black/40 border border-white/10 p-4 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-semibold">Recompensa Adjunta:</span>
                  <span className="font-display text-base font-black text-[var(--candy-gold)] flex items-center gap-1.5">
                    +{selectedMail.rewardSC} Sugar Coins <img src="/sugar-coin.png" alt="Coin" className="size-4 object-contain" />
                  </span>
                </div>
              )}
            </div>

            {/* Sticky Footer */}
            <div className="p-4 bg-slate-900 border-t border-white/10 space-y-3 shrink-0">
              {selectedMail.category === 'support' && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={replyInput}
                    onChange={(e) => setReplyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendReply()
                      }
                    }}
                    placeholder="Escribe tu respuesta al cajero..."
                    disabled={isSendingReply}
                    className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 disabled:opacity-50"
                  />
                  <button
                    onClick={handleSendReply}
                    disabled={!replyInput.trim() || isSendingReply}
                    className="btn-3d px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Send className="size-3.5" />
                    <span>{isSendingReply ? 'Enviando...' : 'Enviar'}</span>
                  </button>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedMail(null)}
                  className="flex-1 py-2.5 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/20 transition-all text-center cursor-pointer"
                >
                  Cerrar
                </button>

                {selectedMail.rewardSC && !selectedMail.claimed && (
                  <button
                    onClick={() => handleClaimSingle(selectedMail.id)}
                    className="btn-3d flex-1 py-2.5 rounded-xl bg-[linear-gradient(145deg,#10b981,#059669)] font-display text-xs font-black text-white shadow-lg cursor-pointer"
                  >
                    Cobrar Recompensa
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
