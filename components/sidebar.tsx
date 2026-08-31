import React, { useState, useEffect } from 'react'
import {
  Store,
  Wallet,
  Users,
  Home,
  CalendarDays,
  Mail,
  LayoutGrid,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/lib/auth-context'
import { db } from '@/lib/firebase'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { getUnreadMailCount } from '@/lib/mail-service'
import { subscribeToFriendRequests, subscribeToIncomingDuelInvites } from '@/lib/friends-service'

type NavItem = {
  label: string
  screen: string
  icon: LucideIcon
  badge?: string
  hasGlow?: boolean
}

const BASE_NAV_ITEMS: Omit<NavItem, 'badge'>[] = [
  { label: 'Tienda', screen: 'tienda', icon: Store },
  { label: 'Billetera', screen: 'billetera', icon: Wallet },
  { label: 'Amigos', screen: 'amigos', icon: Users },
  { label: 'Inicio', screen: 'lobby', icon: Home },
  { label: 'Eventos', screen: 'eventos', icon: CalendarDays },
  { label: 'Correo', screen: 'correo', icon: Mail },
  { label: 'Colección', screen: 'coleccion', icon: LayoutGrid },
]

interface SidebarProps {
  currentScreen?: string
  onNavigate?: (screen: string) => void
}

/* ---------- Desktop: fixed left sidebar ---------- */
export function Sidebar({ currentScreen = 'lobby', onNavigate }: SidebarProps) {
  const { user } = useAuth()
  const [unreadInboxCount, setUnreadInboxCount] = useState<number>(0)
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0)
  const [friendsBadgeCount, setFriendsBadgeCount] = useState<number>(0)

  useEffect(() => {
    const updateCount = () => {
      getUnreadMailCount(user?.uid).then(setUnreadInboxCount).catch(() => {})
    }
    updateCount()

    // 1. Escuchar el buzón del usuario en tiempo real desde Firestore ($0 Spark Plan)
    let unsubMail: (() => void) | null = null
    if (user?.uid && !user.uid.startsWith('dev_')) {
      try {
        const userRef = doc(db, 'users', user.uid)
        unsubMail = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data()
            if (Array.isArray(data.inbox)) {
              const unread = data.inbox.filter((m: any) => !m.isRead || (!m.claimed && (m.rewardSC || 0) > 0)).length
              setUnreadInboxCount(unread)
            }
          }
        }, () => {})
      } catch {}
    }

    // 2. Escuchar mensajes no leídos de cajeros en cashier_orders en tiempo real
    let unsubOrders: (() => void) | null = null
    if (user?.uid && !user.uid.startsWith('dev_')) {
      try {
        const qOrders = query(
          collection(db, 'cashier_orders'),
          where('playerUid', '==', user.uid)
        )
        unsubOrders = onSnapshot(qOrders, (snap) => {
          let supportUnread = 0
          snap.forEach((d) => {
            const ord = d.data() as any
            const msgs = Array.isArray(ord.supportMessages) ? ord.supportMessages : []
            if (msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1]
              if (lastMsg.senderUid === user.uid || lastMsg.senderRole === 'player') {
                return
              }
              if (ord.hasUnreadCashierMessage === false) {
                return
              }
              const playerReadAt = Number(ord.playerReadAt || 0)
              const msgTimestamp = Number(lastMsg.timestamp || 0)
              const isRead = playerReadAt >= msgTimestamp
              if (!isRead) {
                supportUnread++
              }
            }
          })
          setUnreadSupportCount(supportUnread)
        }, () => {})
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('sugar_inbox_updated', updateCount)
    }

    // Subscribe to Friend Requests & Challenges (WebSocket)
    let unsubFriends = () => {}
    let unsubChallenges = () => {}
    if (user?.uid) {
      let pendingReqs = 0
      let pendingChallenges = 0

      unsubFriends = subscribeToFriendRequests(user.uid, (received) => {
        pendingReqs = received.length
        setFriendsBadgeCount(pendingReqs + pendingChallenges)
      })

      unsubChallenges = subscribeToIncomingDuelInvites(user.uid, (challenge) => {
        pendingChallenges = challenge ? 1 : 0
        setFriendsBadgeCount(pendingReqs + pendingChallenges)
      })
    }

    return () => {
      if (unsubMail) unsubMail()
      if (unsubOrders) unsubOrders()
      if (typeof window !== 'undefined') {
        window.removeEventListener('sugar_inbox_updated', updateCount)
      }
      unsubFriends()
      unsubChallenges()
    }
  }, [user?.uid])

  const totalUnreadMail = unreadInboxCount + unreadSupportCount

  const navItems: NavItem[] = BASE_NAV_ITEMS.map(item => {
    let badge: string | undefined
    let hasGlow = false
    if (item.screen === 'correo' && totalUnreadMail > 0) {
      badge = totalUnreadMail.toString()
      hasGlow = unreadSupportCount > 0
    } else if (item.screen === 'amigos' && friendsBadgeCount > 0) {
      badge = friendsBadgeCount.toString()
    }
    return { ...item, badge, hasGlow }
  })

  return (
    <aside className="glass fixed inset-y-4 left-4 z-30 hidden w-72 flex-col gap-6 rounded-3xl p-5 md:flex">
      {/* Logo */}
      <div className="flex items-center gap-3 px-1 pt-1">
        <div className="btn-3d flex size-12 items-center justify-center rounded-2xl bg-[var(--candy-magenta)] shadow-[0_6px_0_oklch(0.45_0.2_350),0_10px_20px_oklch(0.7_0.27_350/0.5)]">
          <span className="font-display text-2xl font-extrabold text-primary-foreground">S</span>
        </div>
        <div className="leading-none">
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--candy-magenta)] neon-magenta">
            SUGAR
          </h1>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-[var(--candy-cyan)] neon-cyan">
            LUDO
          </h1>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-2" aria-label="Menú principal">
        {navItems.map((item) => (
          <NavButton 
            key={item.label} 
            item={item} 
            isActive={currentScreen === item.screen}
            onClick={() => onNavigate?.(item.screen)}
          />
        ))}
      </nav>
    </aside>
  )
}

function NavButton({ item, isActive, onClick }: { item: NavItem; isActive: boolean; onClick: () => void }) {
  const Icon = item.icon
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      aria-label={item.label}
      className={cn(
        'group relative flex items-center gap-3.5 rounded-2xl px-4 py-3 text-left transition-all cursor-pointer select-none',
        isActive
          ? 'bg-[linear-gradient(120deg,oklch(0.7_0.27_350),oklch(0.62_0.22_300))] text-primary-foreground shadow-[0_8px_20px_oklch(0.7_0.27_350/0.4)] ring-1 ring-white/30'
          : 'text-foreground/80 hover:bg-[oklch(1_0_0/0.06)] hover:text-foreground hover:translate-x-1',
      )}
    >
      <span
        className={cn(
          'relative flex size-9 items-center justify-center rounded-xl transition-all',
          isActive
            ? 'bg-white/20 text-white'
            : 'bg-[oklch(1_0_0/0.05)] text-muted-foreground group-hover:bg-[oklch(1_0_0/0.1)] group-hover:text-foreground',
        )}
      >
        <Icon className="size-5" strokeWidth={2.4} />
        {item.hasGlow && (
          <span className="absolute -top-1 -right-1 size-3 rounded-full bg-amber-400 animate-ping" />
        )}
      </span>
      <span className="font-display text-[15px] font-bold">{item.label}</span>

      {item.badge && (
        <span className={cn(
          "ml-auto flex size-6 items-center justify-center rounded-full font-display text-xs font-extrabold shadow-lg animate-pulse",
          item.hasGlow
            ? "bg-amber-400 text-slate-950 shadow-amber-500/50"
            : "bg-[var(--candy-orange)] text-[oklch(0.2_0.05_40)] shadow-[0_0_12px_oklch(0.78_0.18_55/0.9)]"
        )}>
          {item.badge}
        </span>
      )}
    </button>
  )
}

/* ---------- Mobile: fixed bottom navigation bar ---------- */
export function MobileNav({ currentScreen = 'lobby', onNavigate }: SidebarProps) {
  const { user } = useAuth()
  const [unreadInboxCount, setUnreadInboxCount] = useState<number>(0)
  const [unreadSupportCount, setUnreadSupportCount] = useState<number>(0)
  const [friendsBadgeCount, setFriendsBadgeCount] = useState<number>(0)

  useEffect(() => {
    const updateCount = () => {
      getUnreadMailCount(user?.uid).then(setUnreadInboxCount).catch(() => {})
    }
    updateCount()

    // 1. Escuchar el buzón del usuario en tiempo real desde Firestore ($0 Spark Plan)
    let unsubMail: (() => void) | null = null
    if (user?.uid && !user.uid.startsWith('dev_')) {
      try {
        const userRef = doc(db, 'users', user.uid)
        unsubMail = onSnapshot(userRef, (snap) => {
          if (snap.exists()) {
            const data = snap.data()
            if (Array.isArray(data.inbox)) {
              const unread = data.inbox.filter((m: any) => !m.isRead || (!m.claimed && (m.rewardSC || 0) > 0)).length
              setUnreadInboxCount(unread)
            }
          }
        }, () => {})
      } catch {}
    }

    // 2. Escuchar mensajes no leídos de cajeros en cashier_orders en tiempo real
    let unsubOrders: (() => void) | null = null
    if (user?.uid && !user.uid.startsWith('dev_')) {
      try {
        const qOrders = query(
          collection(db, 'cashier_orders'),
          where('playerUid', '==', user.uid)
        )
        unsubOrders = onSnapshot(qOrders, (snap) => {
          let supportUnread = 0
          snap.forEach((d) => {
            const ord = d.data() as any
            const msgs = Array.isArray(ord.supportMessages) ? ord.supportMessages : []
            if (msgs.length > 0) {
              const lastMsg = msgs[msgs.length - 1]
              if (lastMsg.senderUid === user.uid || lastMsg.senderRole === 'player') {
                return
              }
              if (ord.hasUnreadCashierMessage === false) {
                return
              }
              const playerReadAt = Number(ord.playerReadAt || 0)
              const msgTimestamp = Number(lastMsg.timestamp || 0)
              const isRead = playerReadAt >= msgTimestamp
              if (!isRead) {
                supportUnread++
              }
            }
          })
          setUnreadSupportCount(supportUnread)
        }, () => {})
      } catch {}
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('sugar_inbox_updated', updateCount)
    }

    let unsubFriends = () => {}
    let unsubChallenges = () => {}
    if (user?.uid) {
      let pendingReqs = 0
      let pendingChallenges = 0

      unsubFriends = subscribeToFriendRequests(user.uid, (received) => {
        pendingReqs = received.length
        setFriendsBadgeCount(pendingReqs + pendingChallenges)
      })

      unsubChallenges = subscribeToIncomingDuelInvites(user.uid, (challenge) => {
        pendingChallenges = challenge ? 1 : 0
        setFriendsBadgeCount(pendingReqs + pendingChallenges)
      })
    }

    return () => {
      if (unsubMail) unsubMail()
      if (unsubOrders) unsubOrders()
      if (typeof window !== 'undefined') {
        window.removeEventListener('sugar_inbox_updated', updateCount)
      }
      unsubFriends()
      unsubChallenges()
    }
  }, [user?.uid])

  const totalUnreadMail = unreadInboxCount + unreadSupportCount

  const navItems: NavItem[] = BASE_NAV_ITEMS.map(item => {
    let badge: string | undefined
    let hasGlow = false
    if (item.screen === 'correo' && totalUnreadMail > 0) {
      badge = totalUnreadMail.toString()
      hasGlow = unreadSupportCount > 0
    } else if (item.screen === 'amigos' && friendsBadgeCount > 0) {
      badge = friendsBadgeCount.toString()
    }
    return { ...item, badge, hasGlow }
  })

  return (
    <nav
      aria-label="Menú principal"
      className="fixed inset-x-2 bottom-2 z-40 flex items-center justify-between gap-0.5 rounded-2xl border border-border bg-card px-1 py-1.5 shadow-[inset_0_1px_0_oklch(1_0_0/0.12),0_-4px_24px_oklch(0_0_0/0.5)] md:hidden"
    >
      {navItems.map((item) => {
        const Icon = item.icon
        const isActive = currentScreen === item.screen
        return (
          <button
            key={item.label}
            onClick={() => onNavigate?.(item.screen)}
            aria-current={isActive ? 'page' : undefined}
            aria-label={item.label}
            className={cn(
              'relative flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-lg px-0.5 py-1.5 transition-all',
              isActive
                ? 'bg-[linear-gradient(120deg,oklch(0.7_0.27_350/0.9),oklch(0.62_0.22_300/0.9))] text-primary-foreground shadow-[0_6px_16px_oklch(0.7_0.27_350/0.5)]'
                : 'text-muted-foreground active:bg-[oklch(1_0_0/0.06)]',
            )}
          >
            <div className="relative">
              <Icon className="size-[18px]" strokeWidth={2.4} />
              {item.hasGlow && (
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-amber-400 animate-ping" />
              )}
            </div>
            {item.badge && (
              <span className={cn(
                "absolute right-0.5 top-0 flex size-3.5 items-center justify-center rounded-full font-display text-[9px] font-extrabold animate-pulse",
                item.hasGlow
                  ? "bg-amber-400 text-slate-950"
                  : "bg-[var(--candy-orange)] text-[oklch(0.2_0.05_40)]"
              )}>
                {item.badge}
              </span>
            )}
            <span className="w-full truncate text-center font-display text-[8px] font-bold leading-none">
              {item.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
