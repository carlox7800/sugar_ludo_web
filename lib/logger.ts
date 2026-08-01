export type LogLevel = 'SOCKET' | 'GAME-FLOW' | 'TOKENS' | 'ERROR' | 'SYSTEM' | 'ROLL' | 'CAPTURE' | 'MOVE' | 'AUDIO';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  details?: any;
}

class Logger {
  private logs: LogEntry[] = [];
  private static instance: Logger;

  private constructor() {}

  public static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  public log(level: LogLevel, message: string, details?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      details,
    };
    this.logs.push(entry);
    
    // Solo mostramos ERRORs por consola de forma obligatoria, los demás opcional
    if (level === 'ERROR') {
      console.error(`[${entry.timestamp}] [${level}] ${message}`, details ? details : '');
    } else {
      console.log(`[${entry.timestamp}] [${level}] ${message}`, details ? details : '');
    }
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
  }
}

export const globalLogger = Logger.getInstance();
