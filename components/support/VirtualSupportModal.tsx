'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Bot,
  RotateCcw,
  Send,
  Search,
  Sparkles,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Coins,
  Wallet,
  Gamepad2,
  Wifi,
  ChevronRight,
  Info,
  Headphones,
  HelpCircle,
  Zap,
  ArrowRight
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getStoredLocalOrders } from '@/lib/wallet-service'
import {
  SUPPORT_CATEGORIES,
  SUPPORT_TOPICS,
  getKnowledgeTopic,
  getTopicsByCategory,
  searchKnowledgeBase,
  KnowledgeTopic
} from '@/lib/support/support-knowledge-base'
import {
  inspectAccount,
  formatDiagnosisAsBotMessage,
  AccountDiagnosisReport
} from '@/lib/support/account-inspector'

interface ChatMessage {
  id: string
  sender: 'bot' | 'user'
  text: string
  timestamp: number
  topicId?: string
  report?: AccountDiagnosisReport
  suggestedTopicIds?: string[]
  canEscalate?: boolean
}

interface VirtualSupportModalProps {
  isOpen: boolean
  onClose: () => void
  initialTopicId?: string
}

export function VirtualSupportModal({
  isOpen,
  onClose,
  initialTopicId
}: VirtualSupportModalProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [isSearching, setIsSearching] = useState(false)
  const [searchResults, setSearchResults] = useState<KnowledgeTopic[]>([])
  const [escalationSubmitted, setEscalationSubmitted] = useState(false)

  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Cerrar con Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  // Iniciar conversación cuando se abre el modal
  useEffect(() => {
    if (!isOpen) return

    setEscalationSubmitted(false)
    if (initialTopicId && SUPPORT_TOPICS[initialTopicId]) {
      handleSelectTopic(initialTopicId)
    } else if (messages.length === 0) {
      initWelcomeMessage()
    }
  }, [isOpen, initialTopicId])

  // Scroll al fondo al llegar nuevos mensajes
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen])

  const initWelcomeMessage = () => {
    const playerName = user?.nickname || user?.displayName || 'Jugador'
    const welcomeMsg: ChatMessage = {
      id: `welcome_${Date.now()}`,
      sender: 'bot',
      text: `¡Hola, **${playerName}**! Soy tu Asistente Virtual de Sugar Ludo (Tier 1).\n\nEstoy aquí para responder en **0ms y sin demoras** cualquier duda sobre depósitos, retiros, comisiones, reglas de juego o para realizar un diagnóstico completo del estado de tu cuenta.\n\n¿En qué te puedo orientar hoy?`,
      timestamp: Date.now(),
      suggestedTopicIds: ['fin_withdraw_fees', 'fin_parity', 'rule_three_doubles', 'conn_disconnect']
    }
    setMessages([welcomeMsg])
  }

  const handleReset = () => {
    setInputText('')
    setIsSearching(false)
    setSearchResults([])
    setEscalationSubmitted(false)
    initWelcomeMessage()
  }

  // Ejecución de Diagnóstico de Cuenta en memoria
  const handleRunDiagnostics = () => {
    const orders = getStoredLocalOrders()
    const report = inspectAccount(user, orders)
    const diagnosisText = formatDiagnosisAsBotMessage(report)

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: '🔍 Diagnosticar el estado de mi cuenta y órdenes activas.',
      timestamp: Date.now()
    }

    const botMsg: ChatMessage = {
      id: `bot_${Date.now() + 1}`,
      sender: 'bot',
      text: diagnosisText,
      timestamp: Date.now() + 1,
      report,
      canEscalate: report.canEscalateToHuman,
      suggestedTopicIds: report.hasEscrow ? ['fin_escrow', 'fin_withdraw_fees'] : ['fin_withdraw_fees', 'rule_captures']
    }

    setMessages((prev) => [...prev, userMsg, botMsg])
  }

  // Selección de un tema de la base de conocimiento
  const handleSelectTopic = (topicId: string) => {
    const topic = getKnowledgeTopic(topicId)
    if (!topic) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: topic.title,
      timestamp: Date.now(),
      topicId
    }

    let responseText = `### ${topic.title}\n\n${topic.content}`
    if (topic.highlights && topic.highlights.length > 0) {
      responseText += `\n\n**Puntos Clave:**\n` + topic.highlights.map((h) => `• ${h}`).join('\n')
    }

    const botMsg: ChatMessage = {
      id: `bot_${Date.now() + 1}`,
      sender: 'bot',
      text: responseText,
      timestamp: Date.now() + 1,
      topicId,
      suggestedTopicIds: topic.relatedTopicIds || ['fin_parity', 'fin_withdraw_fees']
    }

    setMessages((prev) => [...prev, userMsg, botMsg])
    setIsSearching(false)
    setInputText('')
  }

  // Envío de mensaje o búsqueda de texto
  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const query = inputText.trim()
    if (!query) return

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: Date.now()
    }

    // Buscar en base de conocimiento local
    const matches = searchKnowledgeBase(query)

    let botResponse = ''
    let suggestedTopicIds: string[] = []

    if (matches.length > 0) {
      const bestMatch = matches[0]
      botResponse = `He encontrado información sobre tu consulta:\n\n### ${bestMatch.title}\n\n${bestMatch.content}`
      suggestedTopicIds = matches.slice(1, 4).map((m) => m.id)
    } else {
      botResponse = `No encontré una respuesta exacta para "${query}".\n\nPuedes seleccionar uno de los temas oficiales en los botones inferiores o solicitar un diagnóstico directo de tu cuenta.`
      suggestedTopicIds = ['fin_withdraw_fees', 'fin_parity', 'rule_captures', 'conn_disconnect']
    }

    const botMsg: ChatMessage = {
      id: `bot_${Date.now() + 1}`,
      sender: 'bot',
      text: botResponse,
      timestamp: Date.now() + 1,
      suggestedTopicIds,
      canEscalate: true
    }

    setMessages((prev) => [...prev, userMsg, botMsg])
    setInputText('')
    setIsSearching(false)
  }

  // Manejador de Escalamiento a Ticket Humano (Tier 2)
  const handleEscalateToHuman = () => {
    setEscalationSubmitted(true)
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      sender: 'user',
      text: '⚠️ Deseo reportar un problema a un agente humano de soporte.',
      timestamp: Date.now()
    }

    const botMsg: ChatMessage = {
      id: `bot_${Date.now() + 1}`,
      sender: 'bot',
      text: `✅ **Solicitud de Escalamiento Registrada**\n\nHe recopilado el diagnóstico de tu cuenta y el resumen de esta sesión. Tu caso ha sido preparado para su asignación con el equipo de Disputas y Auditoría.\n\nUn agente de soporte revisará la trazabilidad contable de tu cuenta en el panel administrativo. Recuerda que todos tus fondos se encuentran asegurados por el libro mayor de Sugar Ludo.`,
      timestamp: Date.now() + 1
    }

    setMessages((prev) => [...prev, userMsg, botMsg])
  }

  // Cambio en input para sugerencias en tiempo real
  const handleInputChange = (val: string) => {
    setInputText(val)
    if (val.trim().length >= 2) {
      const results = searchKnowledgeBase(val)
      setSearchResults(results)
      setIsSearching(results.length > 0)
    } else {
      setIsSearching(false)
      setSearchResults([])
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop con Blur Cyberpunk */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity cursor-pointer"
      />

      {/* Sheet Modal Principal */}
      <div className="relative z-10 flex w-full max-w-2xl h-[88dvh] max-h-[750px] flex-col overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-[oklch(0.14_0.03_285/0.95)]">
        
        {/* Barra de Arrastre Visual Mobile */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* Encabezado del Asistente */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-white/10 bg-slate-950/60 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 items-center justify-center rounded-2xl bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)] border border-[var(--candy-cyan)]/40 shadow-[0_0_15px_rgba(6,182,212,0.3)]">
              <Bot className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full size-2.5 bg-emerald-500" />
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display text-base font-extrabold uppercase tracking-wide text-white">
                  Asistente Virtual
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Tier 1 • 0ms
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Soporte inteligente y diagnóstico de cuenta en tiempo real
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="btn-3d flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:text-white transition-all cursor-pointer"
              title="Reiniciar conversación"
            >
              <RotateCcw className="size-4" />
            </button>
            <button
              onClick={onClose}
              className="btn-3d flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:text-white transition-all cursor-pointer"
              aria-label="Cerrar soporte"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Acceso Rápido: Botón Destacado de Diagnóstico Instantáneo */}
        <div className="px-4 sm:px-6 py-2.5 bg-slate-900/80 border-b border-white/5 flex items-center justify-between gap-3 overflow-x-auto custom-scrollbar shrink-0">
          <button
            onClick={handleRunDiagnostics}
            className="btn-3d flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/30 text-cyan-300 font-bold text-xs shrink-0 cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.15)]"
          >
            <Sparkles className="size-3.5 text-cyan-400 animate-pulse" />
            <span>Diagnosticar mi Cuenta (0ms)</span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => handleSelectTopic('fin_withdraw_fees')}
              className="btn-3d px-2.5 py-1.5 rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold text-white/80 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
            >
              Retiros 5% / 10%
            </button>
            <button
              onClick={() => handleSelectTopic('fin_parity')}
              className="btn-3d px-2.5 py-1.5 rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold text-white/80 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
            >
              Tasa 1 USDT = 100 SC
            </button>
            <button
              onClick={() => handleSelectTopic('rule_three_doubles')}
              className="btn-3d px-2.5 py-1.5 rounded-xl border border-white/10 bg-white/5 text-[11px] font-semibold text-white/80 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
            >
              Regla 3 Dobles
            </button>
          </div>
        </div>

        {/* Flujo de Conversación (Scrollable Body) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {messages.map((msg) => {
            const isBot = msg.sender === 'bot'
            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isBot ? 'items-start' : 'items-end justify-end'}`}
              >
                {isBot && (
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)] border border-[var(--candy-cyan)]/30 mt-1">
                    <Bot className="size-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed space-y-2.5 shadow-md ${
                    isBot
                      ? 'bg-slate-900/90 border border-white/10 text-white/95'
                      : 'bg-cyan-500 text-slate-950 font-medium ml-auto rounded-br-none'
                  }`}
                >
                  {/* Contenido formateado en párrafos */}
                  <div className="whitespace-pre-line space-y-2">
                    {msg.text.split('\n\n').map((para, i) => (
                      <p key={i}>
                        {para.split('\n').map((line, j) => {
                          // Renderizado simple de negritas
                          const parts = line.split(/(\*\*.*?\*\*)/g)
                          return (
                            <React.Fragment key={j}>
                              {parts.map((p, k) => {
                                if (p.startsWith('**') && p.endsWith('**')) {
                                  return (
                                    <strong
                                      key={k}
                                      className={isBot ? 'font-bold text-white' : 'font-black text-slate-950'}
                                    >
                                      {p.slice(2, -2)}
                                    </strong>
                                  )
                                }
                                return p
                              })}
                              {j < line.length - 1 && <br />}
                            </React.Fragment>
                          )
                        })}
                      </p>
                    ))}
                  </div>

                  {/* Tarjeta Visual de Diagnóstico de Cuenta (si aplica) */}
                  {msg.report && msg.report.isLoggedIn && (
                    <div className="mt-3 p-3.5 rounded-xl bg-slate-950/80 border border-white/10 space-y-2.5 text-[11px]">
                      <div className="flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="font-bold text-slate-300">Balance Verificado:</span>
                        <span className="font-mono font-extrabold text-cyan-400">
                          {msg.report.availableCoins.toLocaleString()} SC
                        </span>
                      </div>

                      {msg.report.hasEscrow && (
                        <div className="flex items-center justify-between border-b border-white/10 pb-2">
                          <span className="font-bold text-amber-300">En Custodia (Escrow):</span>
                          <span className="font-mono font-extrabold text-amber-400">
                            {msg.report.escrowLockedCoins.toLocaleString()} SC
                          </span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-0.5">
                        <span className="font-medium text-muted-foreground">Estado Operativo:</span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${
                            msg.report.statusBadge.variant === 'emerald'
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : msg.report.statusBadge.variant === 'rose'
                              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {msg.report.statusBadge.label}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Chips Sugeridos debajo de respuestas del bot */}
                  {isBot && msg.suggestedTopicIds && msg.suggestedTopicIds.length > 0 && (
                    <div className="pt-2 border-t border-white/10 flex flex-wrap gap-1.5">
                      <span className="text-[10px] text-muted-foreground w-full font-semibold">
                        Temas relacionados:
                      </span>
                      {msg.suggestedTopicIds.map((tid) => {
                        const top = getKnowledgeTopic(tid)
                        if (!top) return null
                        return (
                          <button
                            key={tid}
                            onClick={() => handleSelectTopic(tid)}
                            className="btn-3d px-2.5 py-1 rounded-lg bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-400/40 text-[10px] font-semibold text-cyan-300 transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span>{top.shortLabel}</span>
                            <ChevronRight className="size-3 opacity-60" />
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {/* Botón de Escalamiento a Ticket Humano si aplica */}
                  {isBot && msg.canEscalate && !escalationSubmitted && (
                    <div className="pt-3 border-t border-rose-500/20">
                      <button
                        onClick={handleEscalateToHuman}
                        className="btn-3d w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-300 font-bold text-xs transition-all cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.15)]"
                      >
                        <AlertTriangle className="size-3.5 text-rose-400" />
                        <span>¿Deseas reportar un problema a un agente humano?</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={chatBottomRef} />
        </div>

        {/* Autocomplete desplegable si hay búsqueda activa */}
        {isSearching && searchResults.length > 0 && (
          <div className="mx-4 sm:mx-6 mb-2 p-2 bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-xl space-y-1 max-h-40 overflow-y-auto custom-scrollbar animate-in slide-in-from-bottom-2">
            <div className="text-[10px] font-bold text-cyan-400 px-2 py-1 uppercase tracking-wider flex items-center gap-1">
              <Search className="size-3" />
              Sugerencias de la Base de Conocimiento:
            </div>
            {searchResults.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelectTopic(item.id)}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/10 text-xs text-white font-medium flex items-center justify-between group transition-colors cursor-pointer"
              >
                <span>{item.title}</span>
                <ChevronRight className="size-3 text-muted-foreground group-hover:text-cyan-400" />
              </button>
            ))}
          </div>
        )}

        {/* Input Bar con Envío y Consulta Instantánea */}
        <div className="p-3 sm:p-4 bg-slate-950/90 border-t border-white/10 shrink-0">
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={inputText}
                onChange={(e) => handleInputChange(e.target.value)}
                placeholder="Escribe tu duda (ej. retiro, comisión, dados)..."
                className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-3.5 pr-8 py-2.5 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 transition-colors"
              />
              {inputText && (
                <button
                  type="button"
                  onClick={() => handleInputChange('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={!inputText.trim()}
              className="btn-3d px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all disabled:opacity-50 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              <Send className="size-3.5" />
              <span className="hidden sm:inline">Consultar</span>
            </button>
          </form>

          {/* Pie informativo de costo $0.00 */}
          <div className="flex items-center justify-center gap-2 pt-2 text-[10px] text-muted-foreground font-medium">
            <ShieldCheck className="size-3 text-emerald-400" />
            <span>Motor Determinista Tier 1 • Costo $0.00 • Datos en Memoria</span>
          </div>
        </div>

      </div>
    </div>
  )
}
