/**
 * SUGAR LUDO - MOTOR DE PRE-VALIDACIÓN DETERMINISTA DE INCIDENCIAS
 * 
 * Comprueba las incidencias reportadas por el jugador contra:
 * 1. El reglamento oficial del juego (salida obligatoria con 5, penalización por 3 dobles, bonos).
 * 2. El estado contable en memoria (órdenes activas, SLAs de depósitos/retiros, saldo en custodia).
 * 
 * Filtra tickets innecesarios y certifica anomalías reales para habilitar
 * el escalamiento a Ticket Formal (Tier 2).
 */

import { inspectAccount } from './account-inspector.ts'
import type { DiagnosticOrder, AccountDiagnosisReport } from './account-inspector.ts'

/**
 * Genera un folio legible e inmutable en formato TKT-YYYY-XXXX
 */
export function generateTicketNumber(): string {
  const year = new Date().getFullYear()
  const randomChars = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `TKT-${year}-${randomChars}`
}

export type IssueCategory = 'transactions' | 'gameplay' | 'account'
export type IssueDomain = 'financial' | 'gameplay' | 'account'

export interface PreValidationIssue {
  id: string
  category: IssueCategory
  title: string
  subtitle: string
  iconName: string
}

export interface PreValidationResult {
  issueId: string
  domain: IssueDomain
  category: IssueCategory
  title: string
  verdictTitle: string
  verdictExplanation: string
  ruleArticleReference?: string
  canOpenTicket: boolean
  requiresPlayerNotes: boolean
  suggestedPriority: 'low' | 'normal' | 'high' | 'urgent'
  systemSummary: string
  actionableSteps?: string[]
  relatedOrderId?: string
  relatedOrderType?: 'deposit' | 'withdraw'
  amountSugarCoins?: number
  amountFiat?: number
  currency?: string
  cashierUid?: string
  cashierName?: string
}

export const AVAILABLE_ISSUES: PreValidationIssue[] = [
  // --- TRANSACCIONES Y PAGOS P2P ---
  {
    id: 'dep_not_credited',
    category: 'transactions',
    title: 'Depósito P2P no acreditado',
    subtitle: 'Transferencia realizada pendiente de acreditación en balance',
    iconName: 'ArrowDownCircle'
  },
  {
    id: 'wit_delayed',
    category: 'transactions',
    title: 'Retiro bancario o cripto demorado',
    subtitle: 'Solicitud de retiro que superó el tiempo estimado de atención',
    iconName: 'Clock'
  },
  {
    id: 'escrow_funds_locked',
    category: 'transactions',
    title: 'Saldo en custodia preventiva (Escrow)',
    subtitle: 'Monedas retenidas por orden en curso o pendiente de liberación',
    iconName: 'Lock'
  },
  {
    id: 'fee_calculation_query',
    category: 'transactions',
    title: 'Consulta sobre comisiones y paridad',
    subtitle: 'Comisión de retiro (5% Estándar / 10% VIP) o tasa 1 USDT = 100 SC',
    iconName: 'Percent'
  },

  // --- PARTIDAS EN VIVO Y JUGABILIDAD ---
  {
    id: 'conn_dropped_match',
    category: 'gameplay',
    title: 'Desconexión de red o pérdida de sala',
    subtitle: 'Interrupción durante una partida con auditoría de telemetría',
    iconName: 'WifiOff'
  },
  {
    id: 'rule_exit_six',
    category: 'gameplay',
    title: 'Regla de salida de fichas (Dado 5 vs 6)',
    subtitle: 'Requisitos del reglamento para liberar fichas de la base',
    iconName: 'HelpCircle'
  },
  {
    id: 'rule_doubles_penalty',
    category: 'gameplay',
    title: 'Penalización por 3 dobles consecutivos',
    subtitle: 'Ficha devuelta a la base por tres tiradas dobles seguidas',
    iconName: 'RotateCcw'
  },
  {
    id: 'rule_bonuses',
    category: 'gameplay',
    title: 'Bonificaciones de casillas (+20 / +10)',
    subtitle: 'Avances adicionales por capturas de rivales y coronación en meta',
    iconName: 'Zap'
  },

  // --- CUENTA, SALDO Y SEGURIDAD ---
  {
    id: 'balance_discrepancy',
    category: 'account',
    title: 'Discrepancia en balance de Sugar Coins',
    subtitle: 'Diferencia observada entre movimientos y saldo visible',
    iconName: 'ShieldAlert'
  },
  {
    id: 'tournament_reward_missing',
    category: 'account',
    title: 'Recompensa de torneo no recibida',
    subtitle: 'Premio ganado en evento o torneo pendiente en correo',
    iconName: 'Award'
  },
  {
    id: 'general_complaint',
    category: 'account',
    title: 'Otra incidencia o consulta técnica',
    subtitle: 'Reporte personalizado para revisión del equipo de soporte',
    iconName: 'MessageSquare'
  }
]

/**
 * Evalúa deterministamente una incidencia contra el estado de cuenta y las reglas
 */
export function evaluateIssuePreValidation(
  issueId: string,
  user: any | null,
  orders: any[] = [],
  currentTime: number = Date.now()
): PreValidationResult {
  const diagnosis = inspectAccount(user, orders, currentTime)
  const playerName = diagnosis.playerName

  const rawResult: Omit<PreValidationResult, 'domain'> = (() => {
    switch (issueId) {
    // ------------------------------------------------------------------------
    // 1. REGLA: Salida con dado 6
    // ------------------------------------------------------------------------
    case 'rule_exit_six':
      return {
        issueId,
        category: 'gameplay',
        title: 'Salida de Fichas (Dado 5 vs Dado 6)',
        verdictTitle: 'Reglamento Oficial: La salida se realiza con dado 5',
        verdictExplanation: `En Sugar Ludo se aplica el reglamento clásico de Parcheesi/Ludo competitivo:\n\n• **Dado 5**: Es el ÚNICO dado que permite liberar una ficha de tu base al tablero. Si tienes fichas en base y sacas un 5, el juego te obliga reglamentariamente a sacarla.\n• **Dado 6**: Otorga un tiro adicional y permite avanzar fichas que ya están en recorrido, pero **NO** libera fichas de la base.\n\nEl sistema funcionó de manera 100% correcta de acuerdo con las reglas oficiales.`,
        ruleArticleReference: 'Reglamento Oficial Sugar Ludo - Artículo 4: Salida de Fichas',
        canOpenTicket: false,
        requiresPlayerNotes: false,
        suggestedPriority: 'low',
        systemSummary: 'Consulta de reglamento: Duda sobre salida de fichas con dado 6. Explicado requisito oficial de dado 5.',
        actionableSteps: [
          'Para liberar fichas de tu base necesitas sacar un 5 (o dados que sumen 5).',
          'El dado 6 te brinda tiro extra para mover fichas que ya están en juego.'
        ]
      }

    // ------------------------------------------------------------------------
    // 2. REGLA: 3 Dobles Consecutivos
    // ------------------------------------------------------------------------
    case 'rule_doubles_penalty':
      return {
        issueId,
        category: 'gameplay',
        title: 'Penalización por 3 Dobles Consecutivos',
        verdictTitle: 'Reglamento Oficial: Penalización por 3 dobles seguidos',
        verdictExplanation: `Sugar Ludo premia la suerte pero sanciona el monopolio continuo del turno:\n\n• Si sacas dados dobles (ej. 2-2, 5-5), obtienes un tiro extra.\n• **Penalización del 3er Doble**: Si obtienes dobles por **tercera vez consecutiva en el mismo turno**, la última ficha que hayas movido regresa automáticamente a tu base (salvo que ya esté en el pasillo de meta protegido).\n\nEsto no es un error de sistema ni desconexión, sino la aplicación estricta de la regla oficial de Parcheesi.`,
        ruleArticleReference: 'Reglamento Oficial Sugar Ludo - Artículo 7: Regla de Tres Dobles',
        canOpenTicket: false,
        requiresPlayerNotes: false,
        suggestedPriority: 'low',
        systemSummary: 'Consulta de reglamento: Penalización por 3 dobles consecutivos explicada conforme al reglamento oficial.',
        actionableSteps: [
          'Recuerda que sacar 3 dobles en el mismo turno castiga tu última ficha movida.',
          'Esta regla aplica a todos los jugadores por igual para mantener la competitividad.'
        ]
      }

    // ------------------------------------------------------------------------
    // 3. REGLA: Bonos de Captura (+20) y Meta (+10)
    // ------------------------------------------------------------------------
    case 'rule_bonuses':
      return {
        issueId,
        category: 'gameplay',
        title: 'Bonificaciones de Avance (+20 por Captura / +10 por Meta)',
        verdictTitle: 'Reglamento Oficial: Bonos automáticos de casillas',
        verdictExplanation: `• **Bono por Captura (+20)**: Comer una ficha rival la envía a su base y te otorga 20 casillas de bonificación aplicables a cualquiera de tus fichas válidas.\n• **Bono por Coronación (+10)**: Introducir una ficha a la meta central te recompensa con 10 casillas de avance adicional.\n• Si ninguna de tus fichas puede avanzar el total del bono sin sobrepasar la meta, el bono se consume automáticamente.`,
        ruleArticleReference: 'Reglamento Oficial Sugar Ludo - Artículo 5: Bonos y Capturas',
        canOpenTicket: false,
        requiresPlayerNotes: false,
        suggestedPriority: 'low',
        systemSummary: 'Consulta de reglamento: Mecánica de bonos de 20 casillas por captura y 10 casillas por meta explicada.',
        actionableSteps: [
          'Asegúrate de tener fichas disponibles que puedan recorrer la distancia del bono.',
          'Las casillas con estrella son zonas seguras donde no es posible realizar capturas.'
        ]
      }

    // ------------------------------------------------------------------------
    // 4. TRANSACCIÓN: Depósito no acreditado
    // ------------------------------------------------------------------------
    case 'dep_not_credited': {
      const activeDeposit = diagnosis.activeOrders.find((o) => o.type === 'deposit')

      if (activeDeposit) {
        if (activeDeposit.isSlaExceeded) {
          return {
            issueId,
            category: 'transactions',
            title: 'Depósito P2P con Demora Detectada',
            verdictTitle: 'Anomalía Confirmada: Depósito fuera de tiempo de atención',
            verdictExplanation: `Hemos verificado tu orden de depósito **#${activeDeposit.id.slice(0, 8)}** por un monto de **${activeDeposit.amountSugarCoins.toLocaleString()} SC** (${activeDeposit.amountFiat} ${activeDeposit.currency}).\n\nEl tiempo transcurrido (${activeDeposit.elapsedMinutes} min) ha superado el tiempo estimado de atención regular. Puedes abrir un ticket formal de inmediato para que el equipo de auditoría contacte al cajero o acredite tus fondos.`,
            canOpenTicket: true,
            requiresPlayerNotes: true,
            suggestedPriority: 'urgent',
            systemSummary: `Depósito #${activeDeposit.id} excede tiempo regular. Monto: ${activeDeposit.amountSugarCoins} SC (${activeDeposit.amountFiat} ${activeDeposit.currency}). Transcurrido: ${activeDeposit.elapsedMinutes}m. Estado: ${activeDeposit.statusLabel}.`,
            relatedOrderId: activeDeposit.id,
            relatedOrderType: 'deposit',
            amountSugarCoins: activeDeposit.amountSugarCoins,
            amountFiat: activeDeposit.amountFiat,
            currency: activeDeposit.currency,
            actionableSteps: [
              'Genera el ticket formal a continuación.',
              'Ten a mano el número de referencia bancaria o hash TxID que transferiste.'
            ]
          }
        }

        const remainingMins = Math.max(1, activeDeposit.slaRemainingMinutes)
        return {
          issueId,
          category: 'transactions',
          title: 'Depósito en Proceso Regular de Validación',
          verdictTitle: 'Tu orden está en tiempo normal de procesamiento',
          verdictExplanation: `Tu orden de depósito **#${activeDeposit.id.slice(0, 8)}** (${activeDeposit.amountSugarCoins.toLocaleString()} SC) está siendo atendida por el cajero asignado.\n\n• **Tiempo transcurrido**: ${activeDeposit.elapsedMinutes} minutos.\n• **Estado**: ${activeDeposit.statusLabel}.\n• **Tiempo regular de validación**: Los cajeros verifican la acreditación bancaria en un promedio de 15 a 30 minutos.\n\nTu dinero está respaldado por el libro mayor. Si el cajero no libera la orden en los próximos minutos, el sistema habilitará el botón de ticket con prioridad alta.`,
          canOpenTicket: activeDeposit.elapsedMinutes >= 30, // Habilitar si lleva más de 30 minutos aunque no venza el SLA formal
          requiresPlayerNotes: true,
          suggestedPriority: activeDeposit.elapsedMinutes >= 30 ? 'high' : 'normal',
          systemSummary: `Depósito #${activeDeposit.id} en verificación. Transcurrido: ${activeDeposit.elapsedMinutes}m. Estado: ${activeDeposit.statusLabel}.`,
          relatedOrderId: activeDeposit.id,
          relatedOrderType: 'deposit',
          amountSugarCoins: activeDeposit.amountSugarCoins,
          amountFiat: activeDeposit.amountFiat,
          currency: activeDeposit.currency,
          actionableSteps: [
            'Revisa tu aplicación bancaria para confirmar que el dinero salió exitosamente.',
            'Si el cajero solicita comprobante, puedes adjuntarlo en la sección Correo.'
          ]
        }
      }

      // No se detectó orden activa de depósito
      return {
        issueId,
        category: 'transactions',
        title: 'Depósito sin Orden Activa Detectada',
        verdictTitle: 'No detectamos una orden de depósito abierta en este momento',
        verdictExplanation: `No tienes órdenes de depósito pendientes en tu sesión actual.\n\n• Si ya transferiste dinero pero no habías creado la orden en la app, por favor ve a **Billetera > Comprar Sugar Coins** y genera la orden con el monto transferido.\n• Si ya tenías una orden y fue rechazada o cancelada, puedes abrir un ticket formal aportando el número de referencia bancaria.`,
        canOpenTicket: true,
        requiresPlayerNotes: true,
        suggestedPriority: 'high',
        systemSummary: 'Depósito reportado sin orden activa en memoria local. Jugador aportará referencia o comprobante.',
        actionableSteps: [
          'Verifica si la orden aparece en tu Historial de Billetera.',
          'Si realizaste un pago directo a un cajero, proporciona el número de referencia en el formulario de ticket.'
        ]
      }
    }

    // ------------------------------------------------------------------------
    // 5. TRANSACCIÓN: Retiro demorado
    // ------------------------------------------------------------------------
    case 'wit_delayed': {
      const activeWithdraw = diagnosis.activeOrders.find((o) => o.type === 'withdraw')

      if (activeWithdraw) {
        if (activeWithdraw.isSlaExceeded) {
          return {
            issueId,
            category: 'transactions',
            title: 'Retiro Fuera de Tiempo Estimado (SLA Excedido)',
            verdictTitle: 'Anomalía Confirmada: Retiro excede el plazo reglamentario',
            verdictExplanation: `Hemos verificado tu orden de retiro **#${activeWithdraw.id.slice(0, 8)}** por **${activeWithdraw.amountSugarCoins.toLocaleString()} SC** (${activeWithdraw.amountFiat} ${activeWithdraw.currency}).\n\n• Modalidad: **${activeWithdraw.isVip ? 'Prioritaria VIP (24h)' : 'Estándar (72h)'}**.\n• Tu orden ha superado el plazo establecido de liquidación.\n\nTus fondos se encuentran 100% resguardados en custodia. Puedes abrir un ticket formal en este momento para que el equipo de auditoría libere el pago o reasigne la orden con máxima urgencia.`,
            canOpenTicket: true,
            requiresPlayerNotes: true,
            suggestedPriority: 'urgent',
            systemSummary: `Retiro #${activeWithdraw.id} con SLA superado (${activeWithdraw.isVip ? 'VIP 24h' : 'Estándar 72h'}). Monto: ${activeWithdraw.amountSugarCoins} SC. Tiempo: ${Math.floor(activeWithdraw.elapsedMinutes / 60)}h ${activeWithdraw.elapsedMinutes % 60}m.`,
            relatedOrderId: activeWithdraw.id,
            relatedOrderType: 'withdraw',
            amountSugarCoins: activeWithdraw.amountSugarCoins,
            amountFiat: activeWithdraw.amountFiat,
            currency: activeWithdraw.currency,
            actionableSteps: [
              'Genera el ticket formal a continuación.',
              'El equipo de finanzas auditará el estado con el cajero asignado.'
            ]
          }
        }

        const remainingHours = Math.floor(activeWithdraw.slaRemainingMinutes / 60)
        const remainingMins = activeWithdraw.slaRemainingMinutes % 60
        return {
          issueId,
          category: 'transactions',
          title: 'Retiro en Proceso dentro del Plazo Reglamentario',
          verdictTitle: 'Tu retiro avanza con normalidad dentro del tiempo prometido',
          verdictExplanation: `Tu orden de retiro **#${activeWithdraw.id.slice(0, 8)}** está en proceso de dispersión financiera por el cajero oficial.\n\n• **Modalidad**: ${activeWithdraw.isVip ? 'Retiro VIP (Garantía < 24h)' : 'Retiro Estándar (Plazo hasta 72h hábiles)'}.\n• **Tiempo restante estimado**: ${remainingHours} horas y ${remainingMins} minutos.\n• **Saldo en Custodia**: Tus ${activeWithdraw.amountSugarCoins.toLocaleString()} SC están resguardados en Escrow y no se perderán bajo ninguna circunstancia.\n\nSi el plazo vence sin haberse liquidado la transferencia, el sistema habilitará el botón de ticket formal inmediatamente.`,
          canOpenTicket: false,
          requiresPlayerNotes: false,
          suggestedPriority: 'normal',
          systemSummary: `Retiro #${activeWithdraw.id} dentro de SLA (${remainingHours}h restantes). Jugador informado.`,
          relatedOrderId: activeWithdraw.id,
          relatedOrderType: 'withdraw',
          amountSugarCoins: activeWithdraw.amountSugarCoins,
          amountFiat: activeWithdraw.amountFiat,
          currency: activeWithdraw.currency,
          actionableSteps: [
            'Los retiros se transfieren en días hábiles de acuerdo con los horarios bancarios.',
            'Recibirás un comprobante oficial de pago en tu buzón una vez liquidado.'
          ]
        }
      }

      // No hay retiro activo
      return {
        issueId,
        category: 'transactions',
        title: 'Retiro sin Orden Activa Detectada',
        verdictTitle: 'No detectamos una orden de retiro abierta en este momento',
        verdictExplanation: `No tienes órdenes de retiro activas registradas en tu sesión.\n\n• Si tu orden anterior fue completada, por favor revisa el comprobante formal en la sección **Correo**.\n• Si consideras que se te debitaron monedas sin haber creado un retiro, abre un ticket formal con los detalles.`,
        canOpenTicket: true,
        requiresPlayerNotes: true,
        suggestedPriority: 'normal',
        systemSummary: 'Consulta de retiro demorado sin orden activa en memoria local.',
        actionableSteps: [
          'Consulta el historial de transacciones en la pantalla Billetera.',
          'Si notas una deducción no reconocida, crea un ticket de revisión contable.'
        ]
      }
    }

    // ------------------------------------------------------------------------
    // 6. TRANSACCIÓN: Saldo en Custodia (Escrow)
    // ------------------------------------------------------------------------
    case 'escrow_funds_locked': {
      if (diagnosis.hasEscrow) {
        const activeWithdraw = diagnosis.activeOrders.find((o) => o.type === 'withdraw')

        if (activeWithdraw) {
          return {
            issueId,
            category: 'transactions',
            title: 'Saldo en Custodia por Retiro Activo',
            verdictTitle: 'Tus monedas están en custodia segura para tu retiro',
            verdictExplanation: `Tienes **${diagnosis.escrowLockedCoins.toLocaleString()} Sugar Coins** retenidos en custodia preventiva (Escrow) debido a tu orden de retiro **#${activeWithdraw.id.slice(0, 8)}**.\n\n• **¿Por qué ocurre?**: El sistema aparta las monedas temporalmente para garantizar que no se gasten en partidas mientras el cajero transfiere tu dinero a tu cuenta bancaria o wallet.\n• **Garantía Total**: Si la orden se cancela por cualquier motivo, **el 100% de tus monedas regresa automáticamente a tu saldo disponible** de forma inmediata.`,
            canOpenTicket: false,
            requiresPlayerNotes: false,
            suggestedPriority: 'low',
            systemSummary: `Saldo en custodia (${diagnosis.escrowLockedCoins} SC) respaldado por retiro activo #${activeWithdraw.id}. Explicada función de Escrow.`,
            relatedOrderId: activeWithdraw.id,
            relatedOrderType: 'withdraw',
            amountSugarCoins: activeWithdraw.amountSugarCoins,
            actionableSteps: [
              'No te preocupes: tus monedas están completamente aseguradas.',
              'Al recibir tu dinero en el banco, el cajero concluirá la orden en el sistema.'
            ]
          }
        }

        // Hay escrow pero no se encontró la orden local
        return {
          issueId,
          category: 'transactions',
          title: 'Saldo en Custodia Pendiente de Sincronización',
          verdictTitle: 'Detección de saldo en reserva',
          verdictExplanation: `Tienes **${diagnosis.escrowLockedCoins.toLocaleString()} Sugar Coins** registrados en custodia.\n\nEsto puede deberse a una orden de retiro procesada en otro dispositivo o pendiente de conciliación con el libro mayor. Puedes abrir un ticket formal para que el administrador verifique y libere tus fondos si no corresponden a una orden activa.`,
          canOpenTicket: true,
          requiresPlayerNotes: true,
          suggestedPriority: 'high',
          systemSummary: `Saldo en custodia (${diagnosis.escrowLockedCoins} SC) sin orden activa local asociada. Solicitada conciliación.`,
          amountSugarCoins: diagnosis.escrowLockedCoins,
          actionableSteps: [
            'Si cancelaste un retiro recientemente, el saldo se desbloquea en pocos minutos.',
            'Si el bloqueo persiste, pulsa el botón de apertura de ticket.'
          ]
        }
      }

      return {
        issueId,
        category: 'transactions',
        title: 'Comprobación de Saldo en Custodia',
        verdictTitle: 'No tienes fondos en custodia (Escrow)',
        verdictExplanation: `Tu cuenta se encuentra al día. Tienes **${diagnosis.availableCoins.toLocaleString()} Sugar Coins** 100% disponibles para jugar o retirar, y 0 monedas retenidas en custodia.`,
        canOpenTicket: false,
        requiresPlayerNotes: false,
        suggestedPriority: 'low',
        systemSummary: 'Comprobación de custodia: Balance al día con 0 monedas en Escrow.',
        actionableSteps: [
          'Todos tus fondos están completamente líquidos y disponibles.'
        ]
      }
    }

    // ------------------------------------------------------------------------
    // 7. TRANSACCIÓN: Duda sobre comisiones (5% vs 10%)
    // ------------------------------------------------------------------------
    case 'fee_calculation_query':
      return {
        issueId,
        category: 'transactions',
        title: 'Esquema de Comisiones Oficiales de Retiro',
        verdictTitle: 'Comisión transparente según la modalidad elegida',
        verdictExplanation: `En Sugar Ludo el jugador elige la velocidad de liquidación de sus fondos:\n\n1. **Retiro Estándar**: Comisión del **5%** (Plazo hasta 72h hábiles). Ejemplo: Retiras 1,000 SC ($10 USD) y recibes $9.50 netos.\n2. **Retiro Prioritario VIP**: Comisión del **10%** (Plazo prioritario < 24h garantizadas). Ejemplo: Retiras 1,000 SC ($10 USD) y recibes $9.00 netos.\n\nLa comisión financia la operatividad y liquidez de la red de cajeros verificados. No existen costos ocultos adicionales.`,
        ruleArticleReference: 'Política de Tesorería - Sección 3: Tarifas de Retiro',
        canOpenTicket: false,
        requiresPlayerNotes: false,
        suggestedPriority: 'low',
        systemSummary: 'Consulta informativa sobre comisiones de retiro (5% Estándar / 10% VIP) respondida exitosamente.',
        actionableSteps: [
          'Puedes verificar el desglose de comisiones antes de confirmar cualquier retiro en la Billetera.'
        ]
      }

    // ------------------------------------------------------------------------
    // 8. JUGABILIDAD: Desconexión durante partida
    // ------------------------------------------------------------------------
    case 'conn_dropped_match':
      return {
        issueId,
        category: 'gameplay',
        title: 'Desconexión de Red y Política de Juego Limpio',
        verdictTitle: 'Sistema de tolerancia a fallos y salvaguarda',
        verdictExplanation: `Al detectarse un micro-corte de red:\n\n• El sistema ofrece una ventana de gracia para reconectar automáticamente sin reiniciar la partida.\n• Si el turno expira (15s), un bot de salvaguarda realiza un tiro seguro para no congelar la partida a los demás jugadores.\n• **Política de Torneo**: Si la desconexión se debe a fallas del proveedor local del usuario, la partida continúa con el bot y no califica para reembolso. Si consideras que se trató de una caída general del servidor de Sugar Ludo, puedes reportar el caso aportando la hora aproximada.`,
        canOpenTicket: true,
        requiresPlayerNotes: true,
        suggestedPriority: 'normal',
        systemSummary: 'Reporte de desconexión en partida. Jugador solicita revisión por posible interrupción de servidor.',
        actionableSteps: [
          'Verifica la estabilidad de tu conexión WiFi o datos móviles antes de ingresar a salas competitivas.',
          'Si hubo una desconexión masiva de la sala, abre el ticket formal con la hora de la partida.'
        ]
      }

    // ------------------------------------------------------------------------
    // 9. CUENTA: Discrepancia de Balance
    // ------------------------------------------------------------------------
    case 'balance_discrepancy':
      return {
        issueId,
        category: 'account',
        title: 'Revisión Contable de Balance',
        verdictTitle: 'Auditoría de saldo disponible y movimientos recientes',
        verdictExplanation: `Tu balance registrado en este dispositivo es de **${diagnosis.availableCoins.toLocaleString()} Sugar Coins** (y ${diagnosis.escrowLockedCoins.toLocaleString()} SC en custodia).\n\nCada jugada, comisión, depósito y retiro se registra de forma atómica en el libro mayor de Sugar Ludo. Si observas una discrepancia entre tu historial de partidas y tu balance actual, abre un ticket formal para que el departamento contable concilie tus movimientos.`,
        canOpenTicket: true,
        requiresPlayerNotes: true,
        suggestedPriority: 'high',
        systemSummary: `Jugador ${playerName} (${user?.uid}) solicita conciliación de balance. Saldo visible: ${diagnosis.availableCoins} SC, Escrow: ${diagnosis.escrowLockedCoins} SC.`,
        amountSugarCoins: diagnosis.availableCoins,
        actionableSteps: [
          'Revisa tu Historial en la Billetera para ver las últimas partidas o compras.',
          'Si persiste la diferencia, detalla en el ticket el monto aproximado que falta.'
        ]
      }

    // ------------------------------------------------------------------------
    // 10. CUENTA: Premio de Torneo no recibido
    // ------------------------------------------------------------------------
    case 'tournament_reward_missing':
      return {
        issueId,
        category: 'account',
        title: 'Reclamo de Premio de Torneo o Evento',
        verdictTitle: 'Verificación de Recompensas de Competición',
        verdictExplanation: `Los premios de torneos y copas se acreditan automáticamente en tu sección **Correo** al concluir la tabla clasificatoria del evento.\n\n• Si el torneo terminó y no recibiste el correo con el botón de reclamar monedas, abre un ticket formal indicando el nombre del torneo y tu puesto aproximado.`,
        canOpenTicket: true,
        requiresPlayerNotes: true,
        suggestedPriority: 'normal',
        systemSummary: `Reclamo de recompensa de torneo no recibida por jugador ${playerName} (${user?.uid}).`,
        actionableSteps: [
          'Comprueba la pestaña "Premios" en tu sección Correo.',
          'Si el torneo finalizó hace más de 1 hora, genera el ticket formal.'
        ]
      }

    // ------------------------------------------------------------------------
    // 11. GENERAL / OTRO
    // ------------------------------------------------------------------------
    default:
      return {
        issueId,
        category: 'account',
        title: 'Consulta General o Incidencia No Listada',
        verdictTitle: 'Atención personalizada del equipo de soporte',
        verdictExplanation: `Si tu situación no se encuentra clasificada en las opciones anteriores, puedes abrir un ticket formal de soporte directamente. Describe con claridad lo sucedido para que un agente de auditoría o administración lo atienda.`,
        canOpenTicket: true,
        requiresPlayerNotes: true,
        suggestedPriority: 'normal',
        systemSummary: `Consulta general abierta por ${playerName} (${user?.uid}).`,
        actionableSteps: [
          'Describe tu situación con el mayor detalle posible en el formulario.',
          'Un operador responderá a través del panel de soporte.'
        ]
      }
    }
  })()

  const domain: IssueDomain =
    rawResult.category === 'transactions'
      ? 'financial'
      : rawResult.category === 'gameplay'
      ? 'gameplay'
      : 'account'

  return {
    ...rawResult,
    domain
  }
}
