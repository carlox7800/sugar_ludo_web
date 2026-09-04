export type CashierLogLevel = 'INFO' | 'CLICK' | 'ACTION' | 'API' | 'FIRESTORE' | 'ERROR'

export interface CashierLogEntry {
  id: string
  timestamp: string
  isoTime: string
  level: CashierLogLevel
  message: string
  details?: any
}

import { APP_VERSION_TAG, APP_VERSION } from './version'

const MAX_LOGS = 250
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
      this.error(`Error no controlado (JS): ${event.message}`, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      })
    })

    window.addEventListener('unhandledrejection', (event) => {
      this.error(`Promesa rechazada no controlada`, {
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

    if (level === 'ERROR') {
      console.error(`[CashierLog] [${level}] ${message}`, details !== undefined ? details : '')
    } else {
      console.log(`[CashierLog] [${level}] ${message}`, details !== undefined ? details : '')
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
    const header = `=== LOGS DE AUDITORÍA Y DIAGNÓSTICO (SUGAR LUDO ADMIN HUB) ===\nFecha exportación: ${new Date().toISOString()}\nTotal registros: ${this.logs.length}\n${'='.repeat(62)}\n\n`
    const body = this.logs
      .map((l) => {
        let detailsStr = ''
        if (l.details !== undefined) {
          try {
            detailsStr = typeof l.details === 'string' ? `\n   Detalles: ${l.details}` : `\n   Detalles: ${JSON.stringify(l.details, null, 2)}`
          } catch {
            detailsStr = `\n   Detalles: ${String(l.details)}`
          }
        }
        return `[${l.timestamp}] [${l.level.padEnd(9)}] ${l.message}${detailsStr}`
      })
      .join('\n\n')
    return header + body
  }

  public clear() {
    this.logs = []
    this.persist()
    this.notify()
    this.info('Consola de logs limpiada')
  }
}

export const cashierLogger = CashierLogger.getInstance()

