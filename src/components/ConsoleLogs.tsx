import React, { useEffect, useRef } from 'react';
import { GameLog } from '../types';
import { Terminal, Trash2, X, Copy, ChevronDown, ChevronUp } from 'lucide-react';

interface ConsoleLogsProps {
  logs: GameLog[];
  onClear: () => void;
  isOpen: boolean;
  onToggle: () => void;
  mode?: 'game' | 'debug';
}

export const ConsoleLogs: React.FC<ConsoleLogsProps> = ({
  logs,
  onClear,
  isOpen,
  onToggle,
  mode = 'game',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logs to bottom when a new one arrives
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const displayLogs = logs.filter(log => {
    if (mode === 'debug') {
      return log.message.startsWith('[DADOS]') || log.message.startsWith('[TURNO]');
    }
    return !log.message.startsWith('[DADOS]') && !log.message.startsWith('[TURNO]');
  });

  const handleCopyLogs = () => {
    const text = displayLogs.map(l => `[${l.timestamp}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
  };

  const getLogColorClass = (playerColor?: string) => {
    switch (playerColor) {
      case 'red':
        return 'text-p-red font-medium';
      case 'green':
        return 'text-p-green font-medium';
      case 'blue':
        return 'text-p-blue font-medium';
      case 'yellow':
        return 'text-p-yellow font-medium';
      default:
        return 'text-t-primary';
    }
  };

  return (
    <div className={`w-full max-w-[550px] mx-auto bg-root rounded-2xl shadow-[0_0_30px_rgba(0,242,255,0.05)] overflow-hidden border border-border transition-all duration-300 relative pointer-events-auto ${mode === 'debug' ? 'h-[80vh] flex flex-col' : ''}`}>
      {/* Header Bar */}
      <div
        className={`flex items-center justify-between px-4 py-3 bg-root border-b border-border select-none ${mode === 'game' ? 'cursor-pointer' : ''}`}
        onClick={mode === 'game' ? onToggle : undefined}
      >
        <div className="flex items-center gap-2 text-t-primary">
          <Terminal size={18} className={mode === 'debug' ? 'text-p-yellow' : 'text-p-green'} />
          <span className="font-mono text-sm font-semibold tracking-wide uppercase">
            {mode === 'debug' ? 'Logs del Sistema' : 'Consola de Registro'} ({displayLogs.length})
          </span>
        </div>
        
        <div className="flex items-center gap-4">
          {displayLogs.length > 0 && (
            <>
              {mode === 'debug' && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleCopyLogs(); }}
                  title="Copiar registro"
                  className="p-1 rounded text-t-muted hover:text-p-blue hover:bg-panel transition-colors flex items-center gap-1 text-xs font-bold"
                >
                  <Copy size={15} />
                  <span className="hidden sm:inline">COPIAR</span>
                </button>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onClear(); }}
                title="Limpiar registro"
                className="p-1 rounded text-t-muted hover:text-p-red hover:bg-panel transition-colors flex items-center gap-1 text-xs font-bold"
              >
                <Trash2 size={15} />
                <span className="hidden sm:inline">LIMPIAR</span>
              </button>
            </>
          )}
          {mode === 'debug' ? (
            <button
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              title="Cerrar consola"
              className="p-1 rounded-full text-t-muted hover:text-t-primary hover:bg-panel transition-colors"
            >
              <X size={20} />
            </button>
          ) : (
            isOpen ? (
              <ChevronUp size={18} className="text-t-muted" />
            ) : (
              <ChevronDown size={18} className="text-t-muted" />
            )
          )}
        </div>
      </div>

      {/* Logs Area */}
      {isOpen && (
        <div
          ref={containerRef}
          className={`${mode === 'debug' ? 'flex-grow min-h-0' : 'h-28'} overflow-y-auto p-3 font-mono text-xs leading-relaxed scrollbar-thin scrollbar-thumb-[var(--border-color)] scrollbar-track-transparent bg-[var(--bg-root)] flex flex-col gap-1`}
        >
          {displayLogs.length === 0 ? (
            <div className="text-t-muted text-center py-8 italic">
              {mode === 'debug' ? 'Sin logs del sistema.' : 'Sin eventos registrados aún. ¡Lanza los dados para comenzar!'}
            </div>
          ) : (
            displayLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-1 border-b border-border/30 pb-0.5 last:border-0">
                <span className="text-t-muted/60 select-none shrink-0">[{log.timestamp}]</span>
                <span className={getLogColorClass(log.playerColor)}>{log.message}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
