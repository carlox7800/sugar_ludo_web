export type LogLevel = 
  | 'SOCKET' 
  | 'GAME-FLOW' 
  | 'TOKENS' 
  | 'ERROR' 
  | 'SYSTEM' 
  | 'ROLL' 
  | 'CAPTURE' 
  | 'MOVE' 
  | 'AUDIO'
  | 'UI-NAV'
  | 'SOCIAL-SSE'
  | 'AUTH'
  | 'ECONOMY';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: any;
}

const MAX_LOG_ENTRIES = 1000;
const SESSION_STORAGE_KEY = 'sugar_global_logs_buffer';

class Logger {
  private logs: LogEntry[] = [];
  private static instance: Logger;
  private isInitialized = false;

  private constructor() {
    this.initStorage();
    this.initGlobalHandlers();
  }

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  private initStorage() {
    if (typeof window !== 'undefined' && !this.isInitialized) {
      try {
        const stored = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            this.logs = parsed.slice(-MAX_LOG_ENTRIES);
          }
        }
      } catch (e) {
        // Fallback silencioso
      }
      this.isInitialized = true;
    }
  }

  private persistTimer: any = null;

  private schedulePersist() {
    if (typeof window === 'undefined') return;
    if (this.persistTimer) return;

    this.persistTimer = setTimeout(() => {
      this.persistTimer = null;
      this.persist();
    }, 1500);
  }

  private persist() {
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.logs.slice(-MAX_LOG_ENTRIES)));
      } catch (e) {
        // Ignorar límites de cuota si se excede
      }
    }
  }

  private initGlobalHandlers() {
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => {
        if (this.persistTimer) {
          clearTimeout(this.persistTimer);
          this.persistTimer = null;
        }
        this.persist();
      });

      window.addEventListener('error', (event) => {
        this.log('ERROR', `Error no controlado: ${event.message}`, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        });
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.log('ERROR', `Promesa rechazada no controlada`, {
          reason: event.reason instanceof Error ? event.reason.message : String(event.reason),
          stack: event.reason instanceof Error ? event.reason.stack : undefined
        });
      });
    }
  }

  public log(level: LogLevel, message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    };
    this.logs.push(entry);
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs.shift();
    }

    this.schedulePersist();
    
    // Solo mostramos ERRORs por consola de forma obligatoria, los demás opcional
    if (level === 'ERROR') {
      console.error(`[${entry.timestamp}] [${level}] ${message}`, details ? details : '');
    } else {
      console.log(`[${entry.timestamp}] [${level}] ${message}`, details ? details : '');
    }
  }

  public nav(fromScreen: string, toScreen: string, details?: any) {
    this.log('UI-NAV', `Navegación: ${fromScreen} ➔ ${toScreen}`, details);
  }

  public social(message: string, details?: any) {
    this.log('SOCIAL-SSE', message, details);
  }

  public socket(message: string, details?: any) {
    this.log('SOCKET', message, details);
  }

  public auth(message: string, details?: any) {
    this.log('AUTH', message, details);
  }

  public economy(message: string, details?: any) {
    this.log('ECONOMY', message, details);
  }

  public error(message: string, details?: any) {
    this.log('ERROR', message, details);
  }

  public getLogs(): LogEntry[] {
    return this.logs;
  }

  public exportLogs(): string {
    return this.logs
      .map(
        (l) =>
          `[${l.timestamp}] [${l.level}] ${l.message} ${
            l.details ? JSON.stringify(l.details) : ''
          }`
      )
      .join('\n');
  }

  public clear() {
    this.logs = [];
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }
}

export const globalLogger = Logger.getInstance();
