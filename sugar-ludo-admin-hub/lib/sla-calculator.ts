import { CashierOrder } from '../types/cashier'

export interface SlaInfo {
  isVip: boolean
  maxHours: number
  maxDurationMs: number
  deadline: number
  timeRemainingMs: number
  isExpired: boolean
  isUrgent: boolean
  formattedTime: string
  badgeLabel: string
  slaTitle: string
}

export function isVipWithdrawal(order: Partial<CashierOrder>): boolean {
  if (order.type !== 'withdraw') return false
  return Boolean(
    order.isVip ||
    order.isVipWithdraw ||
    (order.paymentMethod as string) === 'usdt_bep20' ||
    (order.paymentMethod as string) === 'usdt_trc20_vip'
  )
}

export function getWithdrawalSla(order: Partial<CashierOrder>): SlaInfo | null {
  if (order.type !== 'withdraw') return null

  const isVip = isVipWithdrawal(order)
  const maxHours = isVip ? 12 : 48
  const maxDurationMs = maxHours * 60 * 60 * 1000
  const createdAt = Number(order.createdAt || Date.now())
  const deadline = createdAt + maxDurationMs
  const now = Date.now()
  const timeRemainingMs = deadline - now

  const isExpired = timeRemainingMs <= 0
  const isUrgent = timeRemainingMs > 0 && timeRemainingMs <= 2 * 60 * 60 * 1000 // Menos de 2 horas

  const absDiff = Math.abs(timeRemainingMs)
  const hours = Math.floor(absDiff / 3600000)
  const minutes = Math.floor((absDiff % 3600000) / 60000)

  let formattedTime = ''
  if (isExpired) {
    formattedTime = hours > 0 ? `Vencido (-${hours}h ${minutes}m)` : `Vencido (-${minutes}m)`
  } else {
    formattedTime = hours > 0 ? `${hours}h ${minutes}m restantes` : `${minutes}m restantes`
  }

  return {
    isVip,
    maxHours,
    maxDurationMs,
    deadline,
    timeRemainingMs,
    isExpired,
    isUrgent,
    formattedTime,
    badgeLabel: isVip ? 'VIP 12h' : 'Estándar 48h',
    slaTitle: isVip ? 'Atención VIP (Máx 12h)' : 'Atención Estándar (Máx 48h)'
  }
}
