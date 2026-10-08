export type CashierLogLevel =
  | 'INFO'
  | 'CLICK'
  | 'ACTION'
  | 'API'
  | 'FIRESTORE'
  | 'ERROR'
  | 'BALANCE-AUDIT'
  | 'CASHIER-FLOAT'
  | 'TREASURY-SYNC'
  | 'ERROR-TRACE'

export interface CashierLogEntry {
  id: string
  timestamp: string
  isoTime: string
  level: CashierLogLevel
  message: string
  details?: any
}

import { APP_VERSION_TAG, APP_VERSION } from './version.ts'

const MAX_LOGS = 500
const STORAGE_KEY = 'sugar_cashier_diag_logs'

class CashierLogger {
  private logs: CashierLogEntry[] = []
  private static instance: CashierLogger
  private listeners: Array<() => void> = []
  private isInitialized = false

  private constructor() {
    this.initStorage()
    this.initGlobalHandlers()
  }

  public static getInstance(): CashierLogger {
    if (!CashierLogger.instance) {
      CashierLogger.instance = new CashierLogger()
    }
    return CashierLogger.instance
  }

  private initStorage() {
    if (typeof window === 'undefined' || this.isInitialized) return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          this.logs = parsed.slice(0, MAX_LOGS)
        }
      }
    } catch {}
    this.isInitialized = true
    this.info(`Sesión de diagnóstico iniciada [${APP_VERSION_TAG}]`, {
      version: APP_VERSION,
      versionTag: APP_VERSION_TAG,
      url: typeof window !== 'undefined' ? window.location.href : '',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
    })
  }

  private persist() {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs.slice(0, MAX_LOGS)))
    } catch {}
  }

  private initGlobalHandlers() {
    if (typeof window === 'undefined') return

    window.addEventListener('error', (event) => {
      this.errorTrace(`Error no controlado (JS Window): ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.errorTrace(`Promesa rechazada no controlada`, {
        reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
        stack: event.reason instanceof Error ? event.reason.stack : undefined
      })
    })
  }

  public log(level: CashierLogLevel, message: string, details?: any) {
    const now = new Date()
    const entry: CashierLogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 }),
      isoTime: now.toISOString(),
      level,
      message,
      details
    }
    this.logs.unshift(entry)
    if (this.logs.length > MAX_LOGS) {
      this.logs.pop()
    }
    this.persist()
    this.notify()

    if (level === 'ERROR' || level === 'ERROR-TRACE') {
      console.error(`[StaffDiag] [${level}] ${message}`, details !== undefined ? details : '')
    } else if (level === 'BALANCE-AUDIT' || level === 'CASHIER-FLOAT' || level === 'TREASURY-SYNC') {
      console.info(`[StaffDiag] [${level}] ${message}`, details !== undefined ? details : '')
    } else {
      console.log(`[StaffDiag] [${level}] ${message}`, details !== undefined ? details : '')
    }
  }

  public click(buttonName: string, details?: any) {
    this.log('CLICK', `👉 Clic en botón: ${buttonName}`, details)
  }

  public action(actionName: string, details?: any) {
    this.log('ACTION', `⚡ Acción: ${actionName}`, details)
  }

  public api(endpoint: string, details?: any) {
    this.log('API', `🌐 Red/API: ${endpoint}`, details)
  }

  public firestore(op: string, details?: any) {
    this.log('FIRESTORE', `🔥 Firestore: ${op}`, details)
  }

  public info(message: string, details?: any) {
    this.log('INFO', `ℹ️ ${message}`, details)
  }

  public error(message: string, details?: any) {
    this.log('ERROR', `❌ Error: ${message}`, details)
  }

  // Métodos especializados para observabilidad contable y forense profunda
  public balanceAudit(message: string, details?: any) {
    this.log('BALANCE-AUDIT', `⚖️ [BALANCE-AUDIT] ${message}`, details)
  }

  public cashierFloat(message: string, details?: any) {
    this.log('CASHIER-FLOAT', `💵 [CASHIER-FLOAT] ${message}`, details)
  }

  public treasurySync(message: string, details?: any) {
    this.log('TREASURY-SYNC', `🏛️ [TREASURY-SYNC] ${message}`, details)
  }

  public errorTrace(message: string, errorOrDetails?: any) {
    let payload = errorOrDetails
    if (errorOrDetails instanceof Error) {
      payload = {
        name: errorOrDetails.name,
        message: errorOrDetails.message,
        stack: errorOrDetails.stack
      }
    }
    this.log('ERROR-TRACE', `💥 [ERROR-TRACE] ${message}`, payload)
  }

  public getLogs(): CashierLogEntry[] {
    return this.logs
  }

  public subscribe(listener: () => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener)
    }
  }

  private notify() {
    this.listeners.forEach((l) => l())
  }

  public exportLogs(): string {
    const levelCounts: Record<string, number> = {}
    this.logs.forEach((l) => {
      levelCounts[l.level] = (levelCounts[l.level] || 0) + 1
    })

    const header = [
      `======================================================================`,
      `   SUGAR LUDO - REPORTE DE AUDITORÍA Y OBSERVABILIDAD FORENSE [${APP_VERSION_TAG}]   `,
      `======================================================================`,
      `Fecha de Exportación (ISO): ${new Date().toISOString()}`,
      `Total de Registros: ${this.logs.length} (Capacidad máxima: ${MAX_LOGS})`,
      `Distribución de Eventos:`,
      ...Object.entries(levelCounts).map(([lvl, count]) => `  - [${lvl}]: ${count}`),
      `======================================================================\n`
    ].join('\n')

    const body = this.logs
      .map((l, index) => {
        let detailsStr = ''
        if (l.details !== undefined && l.details !== null) {
          try {
            detailsStr = typeof l.details === 'string'
              ? `\n   Payload:\n${l.details}`
              : `\n   Payload (JSON):\n${JSON.stringify(l.details, null, 2)}`
          } catch {
            detailsStr = `\n   Payload (Raw): ${String(l.details)}`
          }
        }
        return `[#${this.logs.length - index}] [${l.isoTime}] [${l.level.padEnd(13)}] ${l.message}${detailsStr}`
      })
      .join('\n\n----------------------------------------------------------------------\n\n')

    return header + '\n' + body
  }

  public exportLogsJSON(): string {
    return JSON.stringify({
      version: APP_VERSION,
      versionTag: APP_VERSION_TAG,
      exportedAt: new Date().toISOString(),
      totalLogs: this.logs.length,
      logs: this.logs
    }, null, 2)
  }

  public clear() {
    this.logs = []
    this.persist()
    this.notify()
  }
}

export const cashierLogger = CashierLogger.getInstance()

