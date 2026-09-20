/**
 * SUGAR LUDO - LIVE ACCOUNT INSPECTOR (TIER 1 DIAGNOSTICS)
 * 
 * Función puramente en memoria de costo $0.00 y latencia 0ms.
 * Evalúa el estado de la cuenta, balance de Sugar Coins, monedas en custodia (Escrow)
 * y tiempos de servicio (SLAs) de depósitos y retiros activos sin emitir
 * ninguna lectura de red adicional hacia Firebase Firestore.
 */

export interface DiagnosticOrder {
  id: string
  type: 'deposit' | 'withdraw'
  status: 'pending' | 'assigned' | 'paid' | 'verified' | 'completed' | 'disputed' | 'cancelled'
  amountFiat: number
  currency: string
  amountSugarCoins: number
  paymentMethod: string
  receiptReferenceNumber?: string
  createdAt: number
  elapsedMinutes: number
  slaMinutes: number
  slaRemainingMinutes: number
  isSlaExceeded: boolean
  isVip: boolean
  statusLabel: string
  statusSeverity: 'info' | 'warning' | 'alert' | 'success'
  detailMessage: string
}

export interface AccountDiagnosisReport {
  timestamp: number
  isLoggedIn: boolean
  uid: string | null
  playerName: string
  availableCoins: number
  escrowLockedCoins: number
  totalCoinsBalance: number
  gems: number
  hasEscrow: boolean
  activeOrders: DiagnosticOrder[]
  activeOrdersCount: number
  pendingDepositsCount: number
  pendingWithdrawalsCount: number
  hasSlaExceededOrders: boolean
  overallStatus: 'normal' | 'orders_in_progress' | 'sla_exceeded' | 'not_logged_in'
  statusBadge: {
    label: string
    variant: 'emerald' | 'amber' | 'rose' | 'slate'
  }
  headline: string
  explanation: string
  actionableSteps?: string[]
  canEscalateToHuman: boolean
}

// SLAs Oficiales de la plataforma (en minutos)
export const SLA_STANDARD_WITHDRAW_MINUTES = 72 * 60 // 72 Horas
export const SLA_VIP_WITHDRAW_MINUTES = 24 * 60 // 24 Horas
export const SLA_DEPOSIT_MINUTES = 2 * 60 // 2 Horas

/**
 * Traduce y contextualiza el estado técnico de una orden
 */
function formatOrderStatus(status: string): { label: string; severity: 'info' | 'warning' | 'alert' | 'success' } {
  switch (status) {
    case 'pending':
      return { label: 'Esperando Asignación de Cajero', severity: 'warning' }
    case 'assigned':
      return { label: 'Cajero Asignado / En Proceso', severity: 'info' }
    case 'paid':
      return { label: 'Comprobante Enviado / En Verificación', severity: 'info' }
    case 'verified':
      return { label: 'Verificado por Cajero / Acreditando', severity: 'success' }
    case 'completed':
      return { label: 'Completado y Conciliado', severity: 'success' }
    case 'disputed':
      return { label: 'En Disputa / Auditoría', severity: 'alert' }
    case 'cancelled':
      return { label: 'Cancelado', severity: 'alert' }
    default:
      return { label: status, severity: 'info' }
  }
}

/**
 * Inspecciona el estado de la cuenta local del jugador en 0ms y memoria RAM pura
 */
export function inspectAccount(
  user: any | null,
  orders: any[] = [],
  currentTime: number = Date.now()
): AccountDiagnosisReport {
  // 1. Caso: Usuario no autenticado
  if (!user || !user.uid) {
    return {
      timestamp: currentTime,
      isLoggedIn: false,
      uid: null,
      playerName: 'Invitado',
      availableCoins: 0,
      escrowLockedCoins: 0,
      totalCoinsBalance: 0,
      gems: 0,
      hasEscrow: false,
      activeOrders: [],
      activeOrdersCount: 0,
      pendingDepositsCount: 0,
      pendingWithdrawalsCount: 0,
      hasSlaExceededOrders: false,
      overallStatus: 'not_logged_in',
      statusBadge: {
        label: 'No Autenticado',
        variant: 'slate'
      },
      headline: 'Inicia sesión para diagnosticar tu cuenta',
      explanation: 'Para inspeccionar tu balance de Sugar Coins, revisar el estado de órdenes P2P y verificar tus fondos en custodia, por favor inicia sesión con tu cuenta oficial.',
      canEscalateToHuman: false
    }
  }

  // 2. Extraer datos de balance del jugador
  const availableCoins = Math.max(0, Number(user.coins || 0))
  const escrowLockedCoins = Math.max(0, Number(user.escrowLockedCoins || 0))
  const totalCoinsBalance = availableCoins + escrowLockedCoins
  const gems = Math.max(0, Number(user.gems || user.diamonds || 0))
  const hasEscrow = escrowLockedCoins > 0
  const playerName = user.nickname || user.displayName || 'Jugador'

  // 3. Filtrar y diagnosticar órdenes activas (no terminales)
  const userOrders = Array.isArray(orders)
    ? orders.filter(
        (o) =>
          o &&
          (o.playerUid === user.uid || !o.playerUid) &&
          o.status !== 'completed' &&
          o.status !== 'cancelled'
      )
    : []

  const diagnosticOrders: DiagnosticOrder[] = userOrders.map((o) => {
    const isVip = Boolean(o.isVip || o.isVipWithdraw)
    const isWithdraw = o.type === 'withdraw'
    const orderCreatedAt = Number(o.createdAt || currentTime)
    const elapsedMinutes = Math.max(0, Math.floor((currentTime - orderCreatedAt) / (1000 * 60)))

    // Calcular SLA según tipo y categoría
    const slaMinutes = isWithdraw
      ? isVip
        ? SLA_VIP_WITHDRAW_MINUTES
        : SLA_STANDARD_WITHDRAW_MINUTES
      : SLA_DEPOSIT_MINUTES

    const isSlaExceeded = elapsedMinutes > slaMinutes
    const slaRemainingMinutes = Math.max(0, slaMinutes - elapsedMinutes)
    const statusMeta = formatOrderStatus(o.status)

    let detailMessage = ''
    if (isWithdraw) {
      if (isSlaExceeded) {
        detailMessage = `Orden de retiro (${o.amountSugarCoins} SC) ha superado el SLA de ${Math.round(slaMinutes / 60)}h por ${Math.floor((elapsedMinutes - slaMinutes) / 60)}h ${ (elapsedMinutes - slaMinutes) % 60 }m.`
      } else {
        const remainingHours = Math.floor(slaRemainingMinutes / 60)
        const remainingMins = slaRemainingMinutes % 60
        detailMessage = `Retiro ${isVip ? 'VIP (24h)' : 'Estándar (72h)'} en procesamiento. Tiempo restante estimado: ${remainingHours}h ${remainingMins}m.`
      }
    } else {
      if (isSlaExceeded) {
        detailMessage = `Depósito P2P (${o.amountFiat} ${o.currency}) excede tiempo estimado de atención regular.`
      } else {
        detailMessage = `Depósito P2P en proceso de confirmación por el cajero asignado.`
      }
    }

    return {
      id: o.id || 'ord_unknown',
      type: o.type === 'withdraw' ? 'withdraw' : 'deposit',
      status: o.status,
      amountFiat: Number(o.amountFiat || 0),
      currency: o.currency || 'USD',
      amountSugarCoins: Number(o.amountSugarCoins || 0),
      paymentMethod: o.paymentMethod || 'P2P',
      receiptReferenceNumber: o.receiptReferenceNumber,
      createdAt: orderCreatedAt,
      elapsedMinutes,
      slaMinutes,
      slaRemainingMinutes,
      isSlaExceeded,
      isVip,
      statusLabel: statusMeta.label,
      statusSeverity: isSlaExceeded ? 'alert' : statusMeta.severity,
      detailMessage
    }
  })

  const activeOrdersCount = diagnosticOrders.length
  const pendingDepositsCount = diagnosticOrders.filter((o) => o.type === 'deposit').length
  const pendingWithdrawalsCount = diagnosticOrders.filter((o) => o.type === 'withdraw').length
  const hasSlaExceededOrders = diagnosticOrders.some((o) => o.isSlaExceeded)

  // 4. Determinar estado global y mensaje de diagnóstico
  let overallStatus: 'normal' | 'orders_in_progress' | 'sla_exceeded' = 'normal'
  let headline = 'Cuenta 100% Operativa y al Día'
  let explanation = `Tu cuenta no presenta demoras ni retenciones inusuales. Dispones de ${availableCoins.toLocaleString()} Sugar Coins listos para jugar o retirar.`
  let actionableSteps: string[] = []
  let canEscalateToHuman = false

  if (hasSlaExceededOrders) {
    overallStatus = 'sla_exceeded'
    headline = 'Atención: Demora detectada en orden activa'
    explanation = `Hemos detectado que al menos una de tus operaciones P2P ha excedido el tiempo reglamentario de liquidación (SLA). Tus fondos están respaldados y puedes solicitar intervención de un agente humano de soporte.`
    canEscalateToHuman = true
    actionableSteps = [
      'Verifica que el número de referencia bancaria o TxID ingresado sea el correcto.',
      'Si el cajero no responde, utiliza el botón "¿Deseas reportar un problema?" para escalar tu caso directamente al equipo de Disputas.'
    ]
  } else if (activeOrdersCount > 0) {
    overallStatus = 'orders_in_progress'
    headline = `Tienes ${activeOrdersCount} operación(es) P2P en curso`
    
    if (pendingWithdrawalsCount > 0 && hasEscrow) {
      explanation = `Tienes una orden de retiro en proceso con ${escrowLockedCoins.toLocaleString()} SC en custodia de seguridad (Escrow). El cajero está transfiriendo tus fondos dentro del margen normal del SLA.`
    } else if (pendingDepositsCount > 0) {
      explanation = `Tienes un depósito P2P en proceso de validación. Una vez que el cajero confirme la recepción del pago, tus Sugar Coins serán acreditados inmediatamente.`
    } else {
      explanation = `Tus órdenes están avanzando con normalidad bajo el cronograma de atención estándar.`
    }

    actionableSteps = [
      'Mantén tu aplicación abierta o revisa la sección Correo para ver confirmaciones del cajero.',
      'Recuerda que tus monedas en custodia regresan automáticamente si la orden se cancela.'
    ]
  } else if (hasEscrow) {
    // Escrow retenido sin orden local identificada
    headline = `Saldo en Custodia Activo: ${escrowLockedCoins.toLocaleString()} SC`
    explanation = `Tienes ${escrowLockedCoins.toLocaleString()} Sugar Coins en reserva de custodia. Esto ocurre cuando una orden de retiro se envió recientemente o está pendiente de conciliación con el servidor.`
    actionableSteps = [
      'El saldo se liberará a tu cuenta o se liquidará según el estado en el libro mayor.',
      'Si consideras que es un error, puedes escalar una consulta a Soporte.'
    ]
  }

  // 5. Determinar Badge Visual
  let statusBadge: { label: string; variant: 'emerald' | 'amber' | 'rose' | 'slate' } = {
    label: 'Al Día',
    variant: 'emerald'
  }

  if (overallStatus === 'sla_exceeded') {
    statusBadge = { label: 'SLA Excedido', variant: 'rose' }
  } else if (overallStatus === 'orders_in_progress') {
    statusBadge = { label: 'En Proceso', variant: 'amber' }
  }

  return {
    timestamp: currentTime,
    isLoggedIn: true,
    uid: user.uid,
    playerName,
    availableCoins,
    escrowLockedCoins,
    totalCoinsBalance,
    gems,
    hasEscrow,
    activeOrders: diagnosticOrders,
    activeOrdersCount,
    pendingDepositsCount,
    pendingWithdrawalsCount,
    hasSlaExceededOrders,
    overallStatus,
    statusBadge,
    headline,
    explanation,
    actionableSteps,
    canEscalateToHuman
  }
}

/**
 * Genera el texto conversacional amigable para el Asistente Virtual
 */
export function formatDiagnosisAsBotMessage(report: AccountDiagnosisReport): string {
  if (!report.isLoggedIn) {
    return `Hola. No he detectado una sesión activa. Por favor inicia sesión para que pueda inspeccionar tu balance y órdenes en tiempo real.`
  }

  const parts: string[] = []

  parts.push(`🔍 **Diagnóstico Instantáneo de Cuenta**`)
  parts.push(`👤 **Jugador**: ${report.playerName}`)
  parts.push(`💰 **Saldo Disponible**: ${report.availableCoins.toLocaleString()} SC ($${(report.availableCoins / 100).toFixed(2)} USD)`)

  if (report.hasEscrow) {
    parts.push(`🔒 **En Custodia (Escrow)**: ${report.escrowLockedCoins.toLocaleString()} SC ($${(report.escrowLockedCoins / 100).toFixed(2)} USD)`)
  }

  parts.push(``)
  parts.push(`📌 **Estado General**: ${report.headline}`)
  parts.push(`${report.explanation}`)

  if (report.activeOrders.length > 0) {
    parts.push(``)
    parts.push(`📋 **Detalle de Órdenes Activas**:`)
    report.activeOrders.forEach((o, i) => {
      const typeLabel = o.type === 'withdraw' ? 'Retiro' : 'Depósito'
      const flag = o.isSlaExceeded ? '⚠️' : '⏳'
      parts.push(
        `${i + 1}. ${flag} **${typeLabel} #${o.id.slice(0, 8)}**: ${o.amountSugarCoins.toLocaleString()} SC (${o.amountFiat} ${o.currency}) - *${o.statusLabel}*`
      )
      parts.push(`   └ ${o.detailMessage}`)
    })
  }

  if (report.actionableSteps && report.actionableSteps.length > 0) {
    parts.push(``)
    parts.push(`💡 **Recomendaciones**:`)
    report.actionableSteps.forEach((step) => {
      parts.push(`• ${step}`)
    })
  }

  return parts.join('\n')
}
