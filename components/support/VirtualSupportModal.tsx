'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  ArrowLeft,
  Coins,
  Wallet,
  Gamepad2,
  Lock,
  Percent,
  RotateCcw,
  Zap,
  WifiOff,
  ShieldAlert,
  Award,
  MessageSquare,
  HelpCircle,
  FileText,
  Send,
  Loader2,
  Sparkles,
  ExternalLink,
  ChevronRight,
  RefreshCw
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getStoredLocalOrders } from '@/lib/wallet-service'
import {
  AVAILABLE_ISSUES,
  IssueCategory,
  PreValidationIssue,
  PreValidationResult,
  evaluateIssuePreValidation
} from '@/lib/support/pre-validation-engine'
import {
  SupportTicketItem,
  createSupportTicket,
  subscribeToPlayerTickets
} from '@/lib/support/ticket-service'
import { SUPPORT_TOPICS, getKnowledgeTopic } from '@/lib/support/support-knowledge-base'

interface VirtualSupportModalProps {
  isOpen: boolean
  onClose: () => void
  initialTopicId?: string
}

type ModalTab = 'report' | 'my_tickets' | 'guides'
type WizardStep = 'select_category' | 'select_issue' | 'verdict' | 'ticket_form' | 'ticket_success'

export function VirtualSupportModal({
  isOpen,
  onClose,
  initialTopicId
}: VirtualSupportModalProps) {
  const { user } = useAuth()

  // Navegación de pestañas
  const [activeTab, setActiveTab] = useState<ModalTab>('report')

  // Estado del Wizard de Reporte
  const [wizardStep, setWizardStep] = useState<WizardStep>('select_category')
  const [selectedCategory, setSelectedCategory] = useState<IssueCategory>('transactions')
  const [selectedIssue, setSelectedIssue] = useState<PreValidationIssue | null>(null)
  const [preValidationResult, setPreValidationResult] = useState<PreValidationResult | null>(null)

  // Estado del formulario de Ticket
  const [playerNotes, setPlayerNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createdTicket, setCreatedTicket] = useState<SupportTicketItem | null>(null)

  // Lista de Tickets del jugador
  const [myTickets, setMyTickets] = useState<SupportTicketItem[]>([])

  // Cerrar con tecla Escape
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

  // Suscripción en tiempo real a tickets de soporte del jugador
  useEffect(() => {
    if (!isOpen || !user?.uid) return
    const unsub = subscribeToPlayerTickets(user.uid, (tickets) => {
      setMyTickets(tickets)
    })
    return () => unsub()
  }, [isOpen, user?.uid])

  // Reset del wizard al abrir
  useEffect(() => {
    if (!isOpen) return
    if (initialTopicId) {
      // Si se invocó con un tema financiero específico
      if (initialTopicId.startsWith('fin_')) {
        setSelectedCategory('transactions')
        const issue = AVAILABLE_ISSUES.find((i) => i.id === 'wit_delayed' || i.id === 'dep_not_credited')
        if (issue) handleSelectIssue(issue)
      } else {
        setActiveTab('guides')
      }
    } else {
      setWizardStep('select_category')
      setSelectedIssue(null)
      setPreValidationResult(null)
      setPlayerNotes('')
      setCreatedTicket(null)
    }
  }, [isOpen, initialTopicId])

  // Manejador de selección de problema y ejecución de pre-validación
  const handleSelectIssue = (issue: PreValidationIssue) => {
    setSelectedIssue(issue)
    const orders = getStoredLocalOrders()
    const result = evaluateIssuePreValidation(issue.id, user, orders)
    setPreValidationResult(result)
    setWizardStep('verdict')
  }

  // Envío formal del Ticket
  const handleSendTicket = async () => {
    if (!user?.uid || !preValidationResult) return
    setIsSubmitting(true)

    try {
      const ticket = await createSupportTicket({
        playerUid: user.uid,
        playerName: user.nickname || user.displayName || 'Jugador Sugar',
        preValidation: preValidationResult,
        playerNotes
      })

      setCreatedTicket(ticket)
      setWizardStep('ticket_success')
    } catch (err) {
      console.error('[VirtualSupportModal] Error al crear ticket:', err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetWizard = () => {
    setWizardStep('select_category')
    setSelectedIssue(null)
    setPreValidationResult(null)
    setPlayerNotes('')
    setCreatedTicket(null)
  }

  if (!isOpen) return null

  const openTicketsCount = myTickets.filter(
    (t) => t.status === 'open' || t.status === 'investigating'
  ).length

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      {/* Backdrop con Blur Cyber Candy */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md transition-opacity cursor-pointer"
      />

      {/* Modal Card */}
      <div className="relative z-10 flex w-full max-w-2xl h-[88dvh] max-h-[750px] flex-col overflow-hidden rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] bg-[oklch(0.14_0.03_285/0.95)]">
        
        {/* Barra de arrastre móvil */}
        <div className="flex justify-center pt-2.5 pb-1 sm:hidden">
          <div className="h-1.5 w-12 rounded-full bg-white/20" />
        </div>

        {/* Encabezado Principal */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 bg-slate-950/70 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-[var(--candy-cyan)]/20 text-[var(--candy-cyan)] border border-[var(--candy-cyan)]/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-extrabold uppercase tracking-wide text-white">
                Centro de Soporte y Ayuda
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Resolución de incidencias y gestión de tickets oficiales
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="btn-3d flex size-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:text-white transition-all cursor-pointer"
            aria-label="Cerrar soporte"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navegación por Pestañas */}
        <div className="px-4 sm:px-6 pt-3 pb-2 border-b border-white/5 bg-slate-900/60 flex items-center gap-2 shrink-0 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => {
              setActiveTab('report')
              handleResetWizard()
            }}
            className={`btn-3d px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'report'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-white/5 text-muted-foreground hover:text-white border border-white/10'
            }`}
          >
            <ShieldAlert className="size-3.5" />
            <span>Reportar Problema</span>
          </button>

          <button
            onClick={() => setActiveTab('my_tickets')}
            className={`btn-3d px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'my_tickets'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-white/5 text-muted-foreground hover:text-white border border-white/10'
            }`}
          >
            <FileText className="size-3.5" />
            <span>Mis Tickets</span>
            {openTicketsCount > 0 && (
              <span className="size-4.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] flex items-center justify-center ml-0.5">
                {openTicketsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('guides')}
            className={`btn-3d px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
              activeTab === 'guides'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                : 'bg-white/5 text-muted-foreground hover:text-white border border-white/10'
            }`}
          >
            <HelpCircle className="size-3.5" />
            <span>Reglamento y Guías</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* PESTAÑA 1: REPORTAR PROBLEMA (WIZARD GUIADO POR INCIDENCIAS) */}
        {/* ========================================================================= */}
        {activeTab === 'report' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar flex flex-col">
            
            {/* PASO 1: SELECCIONAR CATEGORÍA */}
            {wizardStep === 'select_category' && (
              <div className="space-y-4 animate-in fade-in">
                <div className="text-center sm:text-left space-y-1">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    ¿Qué tipo de problema deseas resolver?
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Selecciona una categoría para iniciar la validación de tu caso:
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {/* Tarjeta 1: Transacciones */}
                  <button
                    onClick={() => {
                      setSelectedCategory('transactions')
                      setWizardStep('select_issue')
                    }}
                    className="btn-3d p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-cyan-500/10 hover:border-cyan-500/40 text-left transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-500/20 text-cyan-400 group-hover:scale-105 transition-transform mb-3">
                      <Wallet className="size-6" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-white group-hover:text-cyan-300">
                        Transacciones P2P
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Depósitos, retiros y saldo retenido en custodia.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-cyan-400 mt-4">
                      <span>Seleccionar</span>
                      <ChevronRight className="size-3.5" />
                    </div>
                  </button>

                  {/* Tarjeta 2: Reglas de Juego */}
                  <button
                    onClick={() => {
                      setSelectedCategory('gameplay')
                      setWizardStep('select_issue')
                    }}
                    className="btn-3d p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-magenta-500/10 hover:border-magenta-500/40 text-left transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="flex size-11 items-center justify-center rounded-xl bg-pink-500/20 text-pink-400 group-hover:scale-105 transition-transform mb-3">
                      <Gamepad2 className="size-6" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-white group-hover:text-pink-300">
                        Reglas y Partidas
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Salida de fichas, dados dobles y desconexiones.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-pink-400 mt-4">
                      <span>Seleccionar</span>
                      <ChevronRight className="size-3.5" />
                    </div>
                  </button>

                  {/* Tarjeta 3: Cuenta y Saldo */}
                  <button
                    onClick={() => {
                      setSelectedCategory('account')
                      setWizardStep('select_issue')
                    }}
                    className="btn-3d p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-amber-500/10 hover:border-amber-500/40 text-left transition-all cursor-pointer flex flex-col justify-between group"
                  >
                    <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 group-hover:scale-105 transition-transform mb-3">
                      <Coins className="size-6" />
                    </div>
                    <div>
                      <h4 className="font-display text-sm font-bold text-white group-hover:text-amber-300">
                        Cuenta y Saldo
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Discrepancia en balance, premios de torneos u otros.
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400 mt-4">
                      <span>Seleccionar</span>
                      <ChevronRight className="size-3.5" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* PASO 2: SELECCIONAR PROBLEMA ESPECÍFICO */}
            {wizardStep === 'select_issue' && (
              <div className="space-y-4 animate-in fade-in">
                <button
                  onClick={() => setWizardStep('select_category')}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="size-3.5" />
                  <span>Volver a categorías</span>
                </button>

                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                    Selecciona tu caso específico
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    El sistema comprobará los datos de tu cuenta para darte una solución inmediata:
                  </p>
                </div>

                <div className="space-y-2">
                  {AVAILABLE_ISSUES.filter((i) => i.category === selectedCategory).map((issue) => (
                    <button
                      key={issue.id}
                      onClick={() => handleSelectIssue(issue)}
                      className="btn-3d w-full p-3.5 rounded-2xl border border-white/10 bg-slate-900/80 hover:bg-slate-800 hover:border-cyan-500/30 text-left transition-all cursor-pointer flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex size-9 items-center justify-center rounded-xl bg-white/5 text-cyan-400 group-hover:bg-cyan-500/20 transition-colors shrink-0">
                          {issue.category === 'transactions' && <Wallet className="size-4" />}
                          {issue.category === 'gameplay' && <Gamepad2 className="size-4" />}
                          {issue.category === 'account' && <Coins className="size-4" />}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white group-hover:text-cyan-300">
                            {issue.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {issue.subtitle}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-muted-foreground group-hover:text-cyan-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* PASO 3: DIAGNÓSTICO Y VEREDICTO DETERMINISTA */}
            {wizardStep === 'verdict' && preValidationResult && (
              <div className="space-y-4 animate-in fade-in flex-1 flex flex-col justify-between">
                <div className="space-y-4">
                  <button
                    onClick={() => setWizardStep('select_issue')}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Elegir otro problema</span>
                  </button>

                  {/* Tarjeta de Veredicto */}
                  <div
                    className={`rounded-2xl p-4 sm:p-5 border space-y-3 ${
                      preValidationResult.canOpenTicket
                        ? 'bg-rose-500/10 border-rose-500/30 text-rose-100'
                        : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-100'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {preValidationResult.canOpenTicket ? (
                        <div className="flex size-9 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 shrink-0 mt-0.5">
                          <AlertTriangle className="size-5" />
                        </div>
                      ) : (
                        <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 shrink-0 mt-0.5">
                          <CheckCircle2 className="size-5" />
                        </div>
                      )}
                      <div>
                        <h4 className="font-display text-sm font-extrabold text-white">
                          {preValidationResult.verdictTitle}
                        </h4>
                        {preValidationResult.ruleArticleReference && (
                          <span className="inline-block mt-0.5 text-[10px] font-semibold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded-full border border-cyan-500/30">
                            {preValidationResult.ruleArticleReference}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-xs leading-relaxed text-slate-200 whitespace-pre-line pl-12">
                      {preValidationResult.verdictExplanation}
                    </div>

                    {preValidationResult.actionableSteps && preValidationResult.actionableSteps.length > 0 && (
                      <div className="pt-2 pl-12 border-t border-white/10 space-y-1">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Recomendaciones:
                        </span>
                        {preValidationResult.actionableSteps.map((step, idx) => (
                          <p key={idx} className="text-[11px] text-slate-300">
                            • {step}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Acciones del Veredicto */}
                <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row gap-2 shrink-0">
                  {preValidationResult.canOpenTicket ? (
                    <button
                      onClick={() => setWizardStep('ticket_form')}
                      className="btn-3d flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-rose-500 hover:bg-rose-400 text-slate-950 font-black text-xs transition-all shadow-[0_0_20px_rgba(244,63,94,0.3)] cursor-pointer"
                    >
                      <ShieldAlert className="size-4" />
                      <span>Abrir Ticket Oficial de Soporte</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={handleResetWizard}
                        className="btn-3d flex-1 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all cursor-pointer"
                      >
                        Entendido, duda resuelta
                      </button>
                      <button
                        onClick={() => setWizardStep('ticket_form')}
                        className="btn-3d py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-white border border-white/10 font-bold text-xs transition-all cursor-pointer"
                      >
                        Mi caso es diferente (Abrir Ticket)
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* PASO 4: FORMULARIO DE TICKET FORMAL */}
            {wizardStep === 'ticket_form' && preValidationResult && (
              <div className="space-y-4 animate-in fade-in flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <button
                    onClick={() => setWizardStep('verdict')}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="size-3.5" />
                    <span>Volver al diagnóstico</span>
                  </button>

                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                      <ShieldAlert className="size-4 text-cyan-400" />
                      Formulario de Apertura de Ticket Oficial
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      Tu solicitud será enviada directamente al panel de auditoría y soporte:
                    </p>
                  </div>

                  {/* Resumen Automático del Sistema */}
                  <div className="p-3.5 rounded-xl bg-slate-900 border border-white/10 space-y-1.5 text-xs">
                    <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
                      Resumen del Caso (Generado por el Sistema):
                    </span>
                    <p className="text-slate-300 text-[11px] leading-relaxed">
                      {preValidationResult.systemSummary}
                    </p>
                  </div>

                  {/* Campo de notas del jugador */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-white">
                      Detalles Adicionales del Jugador:
                    </label>
                    <textarea
                      value={playerNotes}
                      onChange={(e) => setPlayerNotes(e.target.value)}
                      placeholder="Indica cualquier dato adicional (ej. número de referencia bancaria, hora aproximada o lo que consideres importante)..."
                      rows={4}
                      className="w-full bg-slate-900/90 border border-white/10 rounded-xl p-3 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 transition-colors custom-scrollbar"
                    />
                  </div>
                </div>

                <div className="pt-3 border-t border-white/10 flex gap-2">
                  <button
                    onClick={() => setWizardStep('verdict')}
                    disabled={isSubmitting}
                    className="btn-3d py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    Cancelar
                  </button>

                  <button
                    onClick={handleSendTicket}
                    disabled={isSubmitting || !playerNotes.trim()}
                    className="btn-3d flex-1 py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(6,182,212,0.3)]"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Generando Ticket...</span>
                      </>
                    ) : (
                      <>
                        <Send className="size-4" />
                        <span>Confirmar y Enviar Ticket</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* PASO 5: CONSTANCIA OFICIAL DE TICKET ENVIADO */}
            {wizardStep === 'ticket_success' && createdTicket && (
              <div className="space-y-5 animate-in zoom-in-95 flex-1 flex flex-col justify-center items-center text-center p-4">
                <div className="flex size-16 items-center justify-center rounded-3xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                  <ShieldCheck className="size-8" />
                </div>

                <div className="space-y-1.5 max-w-md">
                  <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                    Ticket Registrado Exitosamente
                  </span>
                  <h3 className="font-display text-xl font-extrabold text-white">
                    {createdTicket.ticketNumber}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Tu caso ha sido canalizado con el equipo de soporte y auditoría. Puedes hacer seguimiento de su estado en la pestaña de Mis Tickets.
                  </p>
                </div>

                <div className="w-full max-w-sm p-3.5 rounded-2xl bg-slate-900 border border-white/10 text-xs text-left space-y-2">
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-muted-foreground">Estado Inicial:</span>
                    <span className="font-bold text-amber-400">Abierto / En Revisión</span>
                  </div>
                  <div className="flex justify-between border-b border-white/10 pb-1.5">
                    <span className="text-muted-foreground">Prioridad:</span>
                    <span className="font-bold uppercase text-cyan-400">{createdTicket.priority}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Fecha de Creación:</span>
                    <span className="font-medium text-white">{new Date(createdTicket.createdAt).toLocaleTimeString()}</span>
                  </div>
                </div>

                <div className="flex gap-3 w-full max-w-sm pt-2">
                  <button
                    onClick={() => {
                      setActiveTab('my_tickets')
                    }}
                    className="btn-3d flex-1 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all cursor-pointer"
                  >
                    Ver Mis Tickets
                  </button>
                  <button
                    onClick={onClose}
                    className="btn-3d flex-1 py-3 rounded-xl border border-white/10 bg-white/5 text-muted-foreground hover:text-white font-bold text-xs transition-all cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}

          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 2: MIS TICKETS (BANDEJA DE SEGUIMIENTO EN VIVO) */}
        {/* ========================================================================= */}
        {activeTab === 'my_tickets' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Historial de Tickets Oficiales
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Monitorea el avance de tus reportes y las resoluciones del staff
                </p>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-400">
                {myTickets.length} Caso(s)
              </span>
            </div>

            {myTickets.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="flex size-12 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground mx-auto">
                  <FileText className="size-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white">No tienes tickets abiertos</h4>
                  <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                    Si presentas alguna dificultad o anomalía con una partida o transacción, repórtala en la primera pestaña.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('report')
                    handleResetWizard()
                  }}
                  className="btn-3d px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
                >
                  Reportar un Problema
                </button>
              </div>
            ) : (
              myTickets.map((ticket) => {
                const isOpen = ticket.status === 'open' || ticket.status === 'investigating'
                const isResolvedPlayer = ticket.status === 'resolved_player'

                return (
                  <div
                    key={ticket.id}
                    className="p-4 rounded-2xl border border-white/10 bg-slate-900/90 space-y-3 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-display font-extrabold text-sm text-cyan-400">
                          {ticket.ticketNumber}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {new Date(ticket.createdAt).toLocaleDateString('es-ES', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                          ticket.status === 'open'
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                            : ticket.status === 'investigating'
                            ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            : isResolvedPlayer
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                            : 'bg-slate-500/20 text-slate-400 border-slate-500/30'
                        }`}
                      >
                        {ticket.status === 'open' && 'En Espera de Asignación'}
                        {ticket.status === 'investigating' && 'En Investigación de Auditoría'}
                        {ticket.status === 'resolved_player' && 'Resuelto a Favor del Jugador'}
                        {ticket.status === 'resolved_cashier' && 'Cerrado / Resuelto por Cajero'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs font-bold text-white">
                        {ticket.reason.replace(/\[TKT-.*?\]\s*/, '')}
                      </div>
                      {ticket.playerNotes && (
                        <p className="text-[11px] text-muted-foreground bg-slate-950/60 p-2.5 rounded-xl border border-white/5">
                          "{ticket.playerNotes}"
                        </p>
                      )}
                    </div>

                    {/* Notas de resolución del Administrador */}
                    {ticket.resolutionNotes && (
                      <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-[11px]">
                          <ShieldCheck className="size-3.5" />
                          <span>Dictamen de Auditoría:</span>
                        </div>
                        <p className="text-[11px] text-emerald-200">
                          {ticket.resolutionNotes}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* PESTAÑA 3: REGLAMENTO Y GUÍAS RÁPIDAS */}
        {/* ========================================================================= */}
        {activeTab === 'guides' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar space-y-3">
            <div className="pb-2 border-b border-white/5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Reglamento y Directrices de Sugar Ludo
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Artículos oficiales que rigen las partidas, la economía y el juego limpio
              </p>
            </div>

            <div className="space-y-2.5">
              {Object.values(SUPPORT_TOPICS).map((topic) => (
                <div
                  key={topic.id}
                  className="p-3.5 rounded-2xl border border-white/10 bg-slate-900/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-xs text-white">
                      {topic.title}
                    </span>
                    <span className="text-[10px] font-semibold text-cyan-400 uppercase tracking-wider bg-cyan-950/60 px-2 py-0.5 rounded-md border border-cyan-500/20">
                      {topic.category === 'financial' ? 'Finanzas' : topic.category === 'gameplay' ? 'Reglas' : 'Conexión'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">
                    {topic.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer Informativo Institucional */}
        <div className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center justify-between text-[10px] text-muted-foreground font-medium shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            <span>Soporte Oficial Sugar Ludo • Libro Mayor Inmutable</span>
          </div>

          <span className="text-slate-400">
            {user?.uid ? `ID: ${user.uid.slice(0, 8)}` : 'Sesión Invitado'}
          </span>
        </div>

      </div>
    </div>
  )
}
