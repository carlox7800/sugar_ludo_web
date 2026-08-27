/**
 * ============================================================================
 * SUGAR LUDO - ESQUEMAS FINANCIEROS Y DE CAJEROS DESCENTRALIZADOS
 * ============================================================================
 */

export type OrderType = 'deposit' | 'withdraw'

export type OrderStatus =
  | 'pending'     // Orden creada por el jugador, esperando asignación/pago
  | 'assigned'    // Asignada a un cajero específico
  | 'paid'        // Jugador (en depósito) o Cajero (en retiro) marcó como pagado con comprobante
  | 'verified'    // Fondos confirmados en la cuenta bancaria de destino
  | 'completed'   // Saldo acreditado atómicamente y orden cerrada con éxito
  | 'disputed'    // En mediación por auditor/super_admin por discrepancia
  | 'cancelled'   // Cancelada por expiración de tiempo o por el usuario antes de pagar

export type PaymentMethodType = 
  | 'pago_movil'      // Venezuela (Bs)
  | 'transferencia'   // Bancaria local (COP, ARS, MXN, USD)
  | 'nequi'           // Colombia
  | 'bancolombia'     // Colombia
  | 'mercadopago'     // Argentina / México
  | 'usdt_trc20'      // Cripto USDT (TRON)
  | 'usdt_bep20'      // Cripto USDT (BSC)
  | 'binance_pay'     // Binance Pay ID
  | 'zelle'           // USD Zelle

export interface PaymentAccount {
  id: string
  method: PaymentMethodType
  bankName: string
  accountNumber: string
  accountHolder: string
  idDocument: string
  phone?: string
  email?: string
  qrCodeUrl?: string
  isActive: boolean
}

export interface CashierOrder {
  id: string
  type: OrderType
  status: OrderStatus
  
  // Datos del Jugador
  playerUid: string
  playerName: string
  playerAvatar?: string
  playerPhone?: string

  // Datos del Cajero Asignado
  cashierUid?: string
  cashierName?: string
  cashierAvatar?: string

  // Montos y Conversión
  amountFiat: number
  currency: string          // 'USD', 'VES', 'COP', 'USDT', etc.
  exchangeRate: number      // Tasa de cambio aplicada al momento de crear la orden
  amountSugarCoins: number  // Monto equivalente en Sugar Coins (SC)
  cashierCommissionCoins: number // Comisión en SC ganada por el cajero

  // Método de Pago y Cuentas
  paymentMethod: PaymentMethodType
  cashierPaymentAccount?: PaymentAccount  // Cuenta donde deposita el jugador (en depósito)
  playerPaymentAccount?: PaymentAccount   // Cuenta donde recibe el jugador (en retiro)

  // Comprobantes de Pago
  receiptUrl?: string
  receiptReferenceNumber?: string
  receiptUploadedAt?: number

  // Control de Retención (Escrow)
  isEscrowLocked?: boolean
  escrowLockedAt?: number

  // Marcas de Tiempo
  createdAt: number
  assignedAt?: number
  paidAt?: number
  completedAt?: number
  expiresAt: number

  // Mediación y Disputas
  disputeReason?: string
  disputeOpenedBy?: string
  disputeResolvedBy?: string
  disputeResolutionNotes?: string
}

export interface CashierProfile {
  uid: string
  name: string
  email: string
  avatarUrl?: string
  role: 'cashier' | 'super_admin' | 'auditor'
  isActive: boolean
  isOnline: boolean
  
  // Billetera y Respaldo Financiero
  floatBalanceCoins: number      // Saldo de garantía disponible en Sugar Coins
  escrowLockedCoins: number      // Saldo retenido temporalmente en órdenes activas
  totalCommissionEarnedCoins: number // Ganancias históricas acumuladas
  
  // Límites Operativos
  minDepositFiat: number
  maxDepositFiat: number
  minWithdrawFiat: number
  maxWithdrawFiat: number
  maxConcurrentOrders: number
  
  // Comisiones por defecto
  depositCommissionPct: number   // ej. 2.0 (%)
  withdrawCommissionPct: number  // ej. 3.0 (%)

  // Cuentas Bancarias Registradas
  paymentAccounts: PaymentAccount[]

  // Estadísticas de Desempeño
  totalOrdersCompleted: number
  avgCompletionTimeMinutes: number
  ratingScore: number           // 1.0 a 5.0
  
  lastActiveAt: number
  createdAt: number
}

export interface DailyStats {
  dateStr: string                // YYYY-MM-DD
  totalDepositsFiatUSD: number
  totalWithdrawalsFiatUSD: number
  totalDepositsCount: number
  totalWithdrawalsCount: number
  totalSugarCoinsIssued: number
  totalSugarCoinsBurned: number
  totalCommissionsPaidCoins: number
  peakConcurrentPlayers: number
  activeCashiersCount: number
  updatedAt: number
}

export interface OrderChatMessage {
  id: string
  orderId: string
  senderUid: string
  senderName: string
  senderRole: 'player' | 'cashier' | 'admin' | 'system'
  message: string
  attachmentUrl?: string
  attachmentType?: 'image' | 'pdf'
  timestamp: number
  isRead: boolean
}

export interface AuditLog {
  id: string
  action: 
    | 'DEPOSIT_APPROVED'
    | 'WITHDRAW_PAID'
    | 'WITHDRAW_COMPLETED'
    | 'DISPUTE_OPENED'
    | 'DISPUTE_RESOLVED'
    | 'FLOAT_ADJUSTED'
    | 'CASHIER_CREATED'
    | 'CASHIER_STATUS_CHANGED'
  actorUid: string
  actorRole: string
  targetUid: string
  targetOrderId?: string
  amountCoins?: number
  amountFiat?: number
  currency?: string
  previousBalance?: number
  newBalance?: number
  ipAddress?: string
  userAgent?: string
  notes?: string
  timestamp: number
}
