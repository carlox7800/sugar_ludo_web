'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { 
  ArrowLeft, 
  Mail, 
  MailOpen, 
  Gift, 
  Bell, 
  Sparkles, 
  Check,
  CheckCircle2, 
  Clock, 
  Trash2, 
  CheckCheck, 
  CheckSquare,
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
  replySupportMail,
  deleteMailsBatch,
  getHiddenMails,
  purgeOrphanInboxItems
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
  const [isMounted, setIsMounted] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Auto-scroll to latest message when chat modal is open or new message arrives
  useEffect(() => {
    if (selectedMail && selectedMail.category === 'support') {
      const timer = setTimeout(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 60)
      return () => clearTimeout(timer)
    }
  }, [selectedMail?.replies?.length, selectedMail?.id])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3500)
  }

  const handleToggleSelect = (mailId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setSelectedIds((prev) =>
      prev.includes(mailId) ? prev.filter((id) => id !== mailId) : [...prev, mailId]
    )
  }

  const handleSelectAll = () => {
    const currentTabMails = filteredMails.map((m) => m.id)
    const allSelected = currentTabMails.length > 0 && currentTabMails.every((id) => selectedIds.includes(id))
    if (allSelected) {
      // Deseleccionar los de esta pestaña
      setSelectedIds((prev) => prev.filter((id) => !currentTabMails.includes(id)))
    } else {
      // Seleccionar todos los de esta pestaña
      const combined = Array.from(new Set([...selectedIds, ...currentTabMails]))
      setSelectedIds(combined)
    }
  }

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return
    const idsToDelete = [...selectedIds]
    await deleteMailsBatch(user?.uid, idsToDelete)
    setMailList((prev) => prev.filter((m) => !idsToDelete.includes(m.id)))
    setSelectedIds([])
    setIsSelectionMode(false)
    showToast(`🗑️ ${idsToDelete.length} ${idsToDelete.length === 1 ? 'mensaje eliminado' : 'mensajes eliminados'}`)
  }

  const handleClearReadOrClaimed = async () => {
    // Mails de la pestaña activa que ya están leídos o cobrados
    const eligibleToDelete = filteredMails
      .filter((m) => {
        if (m.category === 'rewards') return m.claimed === true
        return m.isRead === true
      })
      .map((m) => m.id)

    if (eligibleToDelete.length === 0) {
      showToast('No hay mensajes leídos o cobrados para limpiar en esta pestaña.')
      return
    }

    await deleteMailsBatch(user?.uid, eligibleToDelete)
    setMailList((prev) => prev.filter((m) => !eligibleToDelete.includes(m.id)))
    setSelectedIds((prev) => prev.filter((id) => !eligibleToDelete.includes(id)))
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
    }
    showToast(`🧹 Se limpiaron ${eligibleToDelete.length} ${eligibleToDelete.length === 1 ? 'mensaje archivado' : 'mensajes archivados'}`)
  }

  const handlePurgeOrphans = async () => {
    // Purga agresiva: marca como leídos/reclamados TODOS los elementos de user.inbox en Firestore
    // incluidos huérfanos invisibles que producen el badge fantasma
    await purgeOrphanInboxItems(user?.uid)
    setMailList([])
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
    }
    showToast('🧹 Buzón purgado completamente. Todos los registros marcados como leídos.')
  }

  // Load real inbox
  const loadInbox = async () => {
    try {
      const inbox = await fetchUserInbox(user?.uid)
      const hidden = new Set(getHiddenMails())
      const filtered = inbox.filter(m => !hidden.has(m.id))
      setMailList(filtered.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)))
    } catch (e) {
      console.warn('Error loading inbox:', e)
    } finally {
      setIsLoading(false)
    }
  }

  // 1. Sincronizar el buzón de usuario desde el contexto principal AuthContext ($0 Spark Plan)
  useEffect(() => {
    if (!user?.uid || user?.uid.startsWith('dev_')) return
    if (Array.isArray(user.inbox)) {
      const hidden = new Set(getHiddenMails())
      setMailList((prev) => {
        const supportFromOrders = prev.filter(m => m.id.startsWith('mail_ord_sup_') && !hidden.has(m.id))
        const supportOrderIds = new Set(supportFromOrders.map(m => m.orderId).filter(Boolean))
        const userMails = user.inbox!.filter((m: any) => 
          !m.id.startsWith('mail_ord_sup_') && 
          (!m.orderId || !supportOrderIds.has(m.orderId)) && 
          !hidden.has(m.id)
        )
        const combined = [...supportFromOrders, ...userMails]
        return combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      })
      if (selectedMail && !selectedMail.orderId) {
        const refreshed = user.inbox.find((m: any) => m.id === selectedMail.id)
        if (refreshed) setSelectedMail(refreshed)
      }
    }
  }, [user?.inbox, selectedMail?.id])

  // 2. Escuchar mensajes de soporte P2P desde cashier_orders con limit(20) y pausa por visibilidad
  useEffect(() => {
    loadInbox()
    if (!user?.uid || user?.uid.startsWith('dev_')) return

    let unsubOrders: (() => void) | null = null

    const startOrdersListener = () => {
      if (typeof document !== 'undefined' && document.hidden) return
      if (unsubOrders) return

      try {
        const qOrders = query(
          collection(db, 'cashier_orders'),
          where('playerUid', '==', user.uid),
          limit(20)
        )
        unsubOrders = onSnapshot(
          qOrders,
          (snapshot) => {
            const orderSupportMails: MailItem[] = []
            const hidden = new Set(getHiddenMails())

            snapshot.forEach((docSnap) => {
              const ord = docSnap.data() as any
              const orderId = docSnap.id
              const mailKey = `mail_ord_sup_${orderId}`
              const isHidden = hidden.has(mailKey) || hidden.has(`mail_sup_${orderId}`) || hidden.has(orderId)

              // Auto-saneamiento: Si una orden está oculta o huérfana pero aún figura como no leída en Firestore, limpiarla
              if (isHidden && ord.hasUnreadCashierMessage !== false) {
                try {
                  const orderRef = doc(db, 'cashier_orders', orderId)
                  updateDoc(orderRef, {
                    hasUnreadCashierMessage: false,
                    playerReadAt: Date.now()
                  }).catch(() => {})
                } catch {}
              }

              if (isHidden) return

              const orderMessages = Array.isArray(ord.supportMessages) ? ord.supportMessages : []

              if (orderMessages.length > 0) {
                const lastMsg = orderMessages[orderMessages.length - 1]
                
                // Deduplicar replies por id
                const replyMap = new Map<string, SupportReply>()
                orderMessages.forEach((m: any) => {
                  const key = m.id || `${m.timestamp}_${m.message}`
                  const sRole = m.senderRole === 'cashier' ? 'cashier' : (m.senderRole === 'player' ? 'player' : (m.role === 'cashier' ? 'cashier' : 'player'))
                  replyMap.set(key, {
                    id: key,
                    sender: m.senderName || (sRole === 'cashier' ? (ord.cashierName || 'Cajero Autorizado') : 'Jugador'),
                    senderRole: sRole as any,
                    message: m.message || '',
                    timestamp: Number(m.timestamp || 0),
                    attachmentUrl: m.attachmentUrl
                  } as any)
                })
                const replies = Array.from(replyMap.values()).sort((a, b) => a.timestamp - b.timestamp)

                const playerReadAt = Number(ord.playerReadAt || 0)
                const lastMsgTime = Number(lastMsg.timestamp || 0)
                const isUnreadByPlayer = (lastMsg.senderRole === 'cashier' || lastMsg.senderUid !== user.uid) && 
                  (ord.hasUnreadCashierMessage !== false) &&
                  (playerReadAt < lastMsgTime)

                orderSupportMails.push({
                  id: mailKey,
                  type: 'support',
                  category: 'support',
                  title: `💬 Soporte Orden #${orderId.slice(0, 8)}`,
                  sender: ord.cashierName || 'Cajero Oficial',
                  date: new Date(lastMsgTime || Date.now()).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }),
                  preview: lastMsg.message || 'Mensaje de soporte',
                  content: lastMsg.message || '',
                  isRead: !isUnreadByPlayer,
                  claimed: true,
                  timestamp: lastMsgTime,
                  orderId,
                  orderStatus: ord.status,
                  replies
                })
              }
            })

            setMailList((prev) => {
              const orderIdsInSupport = new Set(orderSupportMails.map(m => m.orderId).filter(Boolean))
              const nonOrderMails = prev.filter(m => 
                !m.id.startsWith('mail_ord_sup_') && 
                (!m.orderId || !orderIdsInSupport.has(m.orderId)) && 
                !hidden.has(m.id)
              )
              const combined = [...orderSupportMails, ...nonOrderMails]

              // Si el usuario tiene soporte sin leer y no tiene recompensas pendientes, redirigir automáticamente a la pestaña de Soporte
              const hasUnreadSupport = orderSupportMails.some(m => !m.isRead)
              const hasUnreadRewards = combined.some(m => m.category === 'rewards' && !m.claimed)
              if (hasUnreadSupport && !hasUnreadRewards) {
                setActiveTab((current) => current === 'rewards' ? 'support' : current)
              }

              return combined.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
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

    const handleLocalUpdate = () => {
      loadInbox()
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('sugar_inbox_updated', handleLocalUpdate)
    }

    return () => {
      if (unsubOrders) unsubOrders()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility)
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('sugar_inbox_updated', handleLocalUpdate)
      }
    }
  }, [user?.uid, selectedMail?.id])

  // Sync real-time read timestamp to Firestore whenever chat modal is open
  useEffect(() => {
    if (selectedMail && selectedMail.orderId) {
      try {
        const orderRef = doc(db, 'cashier_orders', selectedMail.orderId)
        updateDoc(orderRef, {
          playerReadAt: Date.now(),
          hasUnreadCashierMessage: false
        }).catch(() => {})
      } catch {}
    }
  }, [selectedMail?.id, selectedMail?.replies?.length])

  const handleOpenMail = async (mail: MailItem) => {
    markMailAsRead(user?.uid, mail.id)
    if (mail.orderId) {
      markMailAsRead(user?.uid, `mail_sup_${mail.orderId}`)
      markMailAsRead(user?.uid, `mail_ord_sup_${mail.orderId}`)
      markMailAsRead(user?.uid, mail.orderId)
    }
    setMailList(prev => prev.map(m => (m.id === mail.id || (mail.orderId && m.orderId === mail.orderId)) ? { ...m, isRead: true } : m))
    setSelectedMail(mail)

    if (mail.orderId) {
      try {
        const orderRef = doc(db, 'cashier_orders', mail.orderId)
        await updateDoc(orderRef, {
          playerReadAt: Date.now(),
          hasUnreadCashierMessage: false
        })
      } catch (err) {
        console.warn('[MailScreen] Error updating playerReadAt:', err)
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sugar_inbox_updated'))
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

    // Actualización optimista inmediata en UI local
    setSelectedMail(prev => {
      if (!prev) return null
      const currentReplies = Array.isArray(prev.replies) ? prev.replies : []
      return {
        ...prev,
        replies: [...currentReplies, newReply]
      }
    })
    setMailList(prev => prev.map(m => {
      if (m.id === selectedMail.id || (selectedMail.orderId && m.orderId === selectedMail.orderId)) {
        const cur = Array.isArray(m.replies) ? m.replies : []
        return { ...m, replies: [...cur, newReply] }
      }
      return m
    }))

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
    } catch (e) {
      console.warn('Error sending reply:', e)
    } finally {
      setIsSendingReply(false)
    }
  }

  const filteredMails = mailList
    .filter(m => m.category === activeTab)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
  const unreadRewardsCount = mailList.filter(m => m.category === 'rewards' && !m.claimed).length
  const unreadSystemCount = mailList.filter(m => m.category === 'system' && !m.isRead).length
  const unreadSupportCount = mailList.filter(m => m.category === 'support' && !m.isRead).length

  return (
    <section className="animate-slide-in mx-auto flex w-full max-w-5xl flex-col gap-5 p-2 sm:p-4">
      {/* Toast Notification (solo para recompensas) */}
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
          onClick={() => {
            setActiveTab('rewards')
            setSelectedIds([])
          }}
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
          onClick={() => {
            setActiveTab('system')
            setSelectedIds([])
          }}
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
          onClick={() => {
            setActiveTab('support')
            setSelectedIds([])
          }}
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

      {/* BARRA DE HERRAMIENTAS DE GESTIÓN Y LIMPIEZA */}
      {filteredMails.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 rounded-2xl bg-white/[0.02] border border-border/60">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (isSelectionMode) {
                  setSelectedIds([])
                  setIsSelectionMode(false)
                } else {
                  setIsSelectionMode(true)
                }
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
                isSelectionMode
                  ? "bg-[var(--candy-magenta)] text-white shadow-md"
                  : "bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white"
              )}
            >
              <CheckSquare className="size-3.5" />
              <span>{isSelectionMode ? 'Cancelar Selección' : 'Seleccionar Mensajes'}</span>
            </button>

            {isSelectionMode && (
              <button
                onClick={handleSelectAll}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
              >
                <span>
                  {filteredMails.every((m) => selectedIds.includes(m.id))
                    ? 'Deseleccionar Todos'
                    : 'Seleccionar Todos'}
                </span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isSelectionMode && selectedIds.length > 0 && (
              <button
                onClick={handleDeleteSelected}
                className="btn-3d flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black shadow-md shadow-rose-900/30 transition-all cursor-pointer animate-in zoom-in-95"
              >
                <Trash2 className="size-3.5" />
                <span>Eliminar ({selectedIds.length})</span>
              </button>
            )}

            {!isSelectionMode && (
              <button
                onClick={handleClearReadOrClaimed}
                title={
                  activeTab === 'rewards'
                    ? 'Limpiar recompensas ya cobradas'
                    : 'Limpiar notificaciones ya leídas'
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-300 bg-white/5 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-all cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">
                  {activeTab === 'rewards' ? 'Limpiar Cobrados' : 'Limpiar Leídos'}
                </span>
                <span className="sm:hidden">Limpiar</span>
              </button>
            )}
          </div>
        </div>
      )}

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
            <button
              onClick={handlePurgeOrphans}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition-all cursor-pointer"
              title="Borrar todos los registros de inbox en Firestore para resetear el badge del menú lateral"
            >
              <Trash2 className="size-3.5" />
              <span>Limpiar Todo (Resetear Badge)</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredMails.map((mail) => {
              const isSelected = selectedIds.includes(mail.id)
              return (
                <div
                  key={mail.id}
                  onClick={() => {
                    if (isSelectionMode) {
                      handleToggleSelect(mail.id)
                    } else {
                      handleOpenMail(mail)
                    }
                  }}
                  className={cn(
                    "glass flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 sm:p-5 rounded-2xl border transition-all cursor-pointer shadow-md gap-4 relative",
                    isSelected
                      ? "border-[var(--candy-magenta)] bg-[var(--candy-magenta)]/10 ring-1 ring-[var(--candy-magenta)]/40"
                      : !mail.isRead
                      ? "border-[var(--candy-magenta)]/50 bg-[oklch(1_0_0/0.04)] shadow-[0_0_15px_rgba(255,34,119,0.1)]"
                      : "border-border/70 bg-[oklch(1_0_0/0.01)] opacity-80 hover:opacity-100"
                  )}
                >
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    {/* Checkbox de Selección */}
                    {isSelectionMode && (
                      <button
                        type="button"
                        onClick={(e) => handleToggleSelect(mail.id, e)}
                        className={cn(
                          "size-6 rounded-lg border flex items-center justify-center transition-all shrink-0 cursor-pointer",
                          isSelected
                            ? "bg-[var(--candy-magenta)] border-[var(--candy-magenta)] text-white shadow-sm"
                            : "border-slate-500 bg-white/5 hover:border-slate-300"
                        )}
                        aria-label="Seleccionar mensaje"
                      >
                        {isSelected && <Check className="size-4 stroke-[3]" />}
                      </button>
                    )}

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

                    {!mail.rewardSC && !isSelectionMode && (
                      <ChevronRight className="size-5 text-muted-foreground/60 hidden sm:block" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DETALLES DEL MENSAJE Y CHAT P2P (Renderizado via Portal para centrado absoluto) */}
      {selectedMail && isMounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-md animate-in fade-in">
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

                  {/* Unique Deduplicated Replies con WhatsApp Checks */}
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {(() => {
                      let activeReplies = Array.isArray(selectedMail.replies) && selectedMail.replies.length > 0 
                        ? selectedMail.replies 
                        : []
                      if (activeReplies.length === 0 && selectedMail.content) {
                        activeReplies = [{
                          id: `init_${selectedMail.timestamp}`,
                          sender: selectedMail.sender || 'Cajero Oficial',
                          senderRole: 'cashier',
                          message: selectedMail.content,
                          timestamp: selectedMail.timestamp || Date.now()
                        }]
                      }
                      return Array.from(new Map(activeReplies.map(r => [r.id || `${r.timestamp}_${r.message}`, r])).values()).map((rep) => {
                        const isMe = rep.senderRole === 'player'
                        const isReadByCashier = Boolean(
                          selectedMail.status === 'resolved' || 
                          selectedMail.badge === 'Completado' ||
                          ((selectedMail as any).cashierReadAt && (selectedMail as any).cashierReadAt > rep.timestamp)
                        )

                      return (
                        <div
                          key={rep.id || `${rep.timestamp}_${rep.message}`}
                          className={cn(
                            "p-3 rounded-2xl text-xs space-y-1 relative shadow-sm max-w-[85%]",
                            isMe
                              ? "bg-[linear-gradient(135deg,rgba(236,72,153,0.35),rgba(236,72,153,0.2))] border border-pink-500/40 ml-auto rounded-tr-none text-white"
                              : "bg-slate-800/90 border border-white/10 mr-auto rounded-tl-none text-slate-100"
                          )}
                        >
                          {!isMe && (
                            <div className="text-[10px] font-bold text-cyan-300 mb-0.5">
                              {rep.sender} (Cajero)
                            </div>
                          )}

                          <p className="whitespace-pre-wrap leading-relaxed pb-2.5 pr-2">
                            {rep.message}
                          </p>

                          {/* Timestamp & Checks en la esquina inferior derecha */}
                          <div className={cn(
                            "flex items-center justify-end gap-1 text-[9px] font-mono select-none mt-1",
                            isMe ? "text-pink-200/80" : "text-slate-400"
                          )}>
                            <span>{new Date(rep.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            {isMe && (
                              isReadByCashier ? (
                                <CheckCheck className="size-3 text-cyan-300 inline" />
                              ) : (
                                <Check className="size-3 text-pink-200/60 inline" />
                              )
                            )}
                          </div>
                        </div>
                      )
                    })})()}
                    <div ref={chatEndRef} />
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
                    <span>{isSendingReply ? '...' : 'Enviar'}</span>
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
        </div>,
        document.body
      )}
    </section>
  )
}
