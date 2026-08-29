export interface CashierLogEntry {
  timestamp: string
  level: 'INFO' | 'ACTION' | 'API' | 'FIRESTORE' | 'ERROR'
  message: string
  details?: any
}

const MAX_LOGS = 100

class CashierLogger {
  private logs: CashierLogEntry[] = []
  private static instance: CashierLogger
  private listeners: Array<() => void> = []

  private constructor() {}

  public static getInstance(): CashierLogger {
    if (!CashierLogger.instance) {
      CashierLogger.instance = new CashierLogger()
    }
    return CashierLogger.instance
  }

  public log(level: CashierLogEntry['level'], message: string, details?: any) {
    const entry: CashierLogEntry = {
      timestamp: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      level,
      message,
      details
    }
    this.logs.unshift(entry)
    if (this.logs.length > MAX_LOGS) {
      this.logs.pop()
    }
    this.notify()
    if (level === 'ERROR') {
      console.error(`[CashierLog] [${level}] ${message}`, details || '')
    } else {
      console.log(`[CashierLog] [${level}] ${message}`, details || '')
    }
  }

  public info(message: string, details?: any) {
    this.log('INFO', message, details)
  }

  public action(message: string, details?: any) {
    this.log('ACTION', message, details)
  }

  public api(message: string, details?: any) {
    this.log('API', message, details)
  }

  public firestore(message: string, details?: any) {
    this.log('FIRESTORE', message, details)
  }

  public error(message: string, details?: any) {
    this.log('ERROR', message, details)
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
    return this.logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level}] ${l.message} ${
            l.details ? JSON.stringify(l.details) : ''
          }`
      )
      .join('\n')
  }

  public clear() {
    this.logs = []
    this.notify()
  }
}

export const cashierLogger = CashierLogger.getInstance()
