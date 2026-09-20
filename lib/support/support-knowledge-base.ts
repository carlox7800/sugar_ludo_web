/**
 * SUGAR LUDO - BASE DE CONOCIMIENTO DETERMINISTA (TIER 1 SUPPORT)
 * 
 * Base de conocimiento local indexada de costo $0.00 (sin APIs LLM de pago).
 * Respuestas preconfiguradas con matemática financiera exacta,
 * reglas oficiales de Ludo y protocolos de conectividad.
 */

export interface KnowledgeTopic {
  id: string
  title: string
  shortLabel: string
  category: 'financial' | 'gameplay' | 'connectivity' | 'security'
  iconName: 'Wallet' | 'Coins' | 'Clock' | 'ShieldCheck' | 'Gamepad2' | 'Zap' | 'Wifi' | 'HelpCircle' | 'AlertTriangle'
  summary: string
  content: string
  highlights?: string[]
  relatedTopicIds?: string[]
}

export interface KnowledgeCategory {
  id: 'financial' | 'gameplay' | 'connectivity' | 'security'
  title: string
  description: string
  iconName: 'Wallet' | 'Gamepad2' | 'Wifi' | 'ShieldCheck'
  topicIds: string[]
}

export const SUPPORT_CATEGORIES: KnowledgeCategory[] = [
  {
    id: 'financial',
    title: 'Finanzas, Depósitos y Retiros',
    description: 'Paridad económica, comisiones, tiempos de acreditación y fondos en custodia.',
    iconName: 'Wallet',
    topicIds: ['fin_parity', 'fin_withdraw_fees', 'fin_escrow', 'fin_deposit_steps', 'fin_min_max']
  },
  {
    id: 'gameplay',
    title: 'Reglas y Mecánicas de Ludo',
    description: 'Salida de fichas, capturas, casillas seguras y penalización de dobles.',
    iconName: 'Gamepad2',
    topicIds: ['rule_exit', 'rule_captures', 'rule_three_doubles', 'rule_goal_bonus', 'rule_safe_zones']
  },
  {
    id: 'connectivity',
    title: 'Conexión y Desconexiones',
    description: 'Reconexión automática, temporizador de turnos y bots de salvaguarda.',
    iconName: 'Wifi',
    topicIds: ['conn_disconnect', 'conn_timeout', 'conn_fairplay']
  },
  {
    id: 'security',
    title: 'Seguridad y Cuenta',
    description: 'Protección de saldo, libro mayor inmutable y prevención de fraude.',
    iconName: 'ShieldCheck',
    topicIds: ['sec_balance_protection', 'sec_p2p_cashiers']
  }
]

export const SUPPORT_TOPICS: Record<string, KnowledgeTopic> = {
  // --- FINANZAS ---
  fin_parity: {
    id: 'fin_parity',
    title: 'Tasa de Cambio y Paridad Sugar Coins',
    shortLabel: 'Tasa $1 = 100 SC',
    category: 'financial',
    iconName: 'Coins',
    summary: 'La paridad oficial es estricta: 1 USDT = 100 Sugar Coins (1 SC = $0.01 USD).',
    content: `En Sugar Ludo la economía funciona bajo una paridad monetaria transparente y predecible:

• **1 USDT = 100 Sugar Coins (SC)**
• **1 Sugar Coin (SC) = $0.01 USD (1 centavo de dólar)**
• **100 Sugar Coins = $1.00 USD / USDT**
• **1,000 Sugar Coins = $10.00 USD / USDT**

Tanto para compras/depósitos como para retiros a tu billetera cripto o cuenta bancaria, la conversión se calcula sobre este estándar oficial sin cobros ocultos.`,
    highlights: [
      '1 USDT = 100 Sugar Coins',
      '1 SC = $0.01 USD',
      'Sin fluctuaciones especulativas internas'
    ],
    relatedTopicIds: ['fin_withdraw_fees', 'fin_deposit_steps']
  },

  fin_withdraw_fees: {
    id: 'fin_withdraw_fees',
    title: 'Comisiones de Retiro y Tiempos de Entrega (SLA)',
    shortLabel: 'Comisiones de Retiro (5% vs 10%)',
    category: 'financial',
    iconName: 'Clock',
    summary: 'Retiro Estándar: 5% (hasta 72h hábiles) | Retiro VIP: 10% (prioritario < 24h).',
    content: `Al solicitar un retiro de tus ganancias a cuenta bancaria o cripto (USDT), puedes elegir entre dos modalidades de procesamiento:

1. **Retiro Estándar (Recomendado)**:
   • **Comisión**: 5% deducible del monto retirado.
   • **SLA de Liquidación**: Hasta 72 horas hábiles.
   • **Ejemplo**: Si retiras 1,000 SC ($10 USD), recibes $9.50 USD netos en tu método de pago.

2. **Retiro Prioritario VIP**:
   • **Comisión**: 10% deducible del monto retirado.
   • **SLA de Liquidación**: Máximo 24 horas garantizadas con asignación prioritaria en cajeros VIP.
   • **Ejemplo**: Si retiras 1,000 SC ($10 USD), recibes $9.00 USD netos en menos de 24 horas.

El libro mayor registra la deducción exacta y los datos del cajero asignado.`,
    highlights: [
      'Estándar: 5% comisión • SLA 72 horas',
      'VIP: 10% comisión • SLA 24 horas',
      'Deducción transparente reflejada en tu recibo'
    ],
    relatedTopicIds: ['fin_escrow', 'fin_parity']
  },

  fin_escrow: {
    id: 'fin_escrow',
    title: '¿Por qué mi saldo aparece en Custodia (Escrow)?',
    shortLabel: 'Saldo en Custodia (Escrow)',
    category: 'financial',
    iconName: 'Wallet',
    summary: 'El saldo solicitado en retiro se bloquea preventivamente para garantizar que los fondos no se gasten dos veces.',
    content: `Cuando solicitas un retiro de fondos, tus Sugar Coins entran automáticamente en un estado de **Custodia Segura (Escrow)**:

• **Propósito**: Proteger tanto tu balance como al cajero liquidador, evitando el riesgo de doble gasto o saldo negativo accidental mientras la transferencia bancaria o cripto está en camino.
• **Visualización**: Verás tu saldo usable ajustado, pero tus fondos retenidos continúan registrados a tu nombre bajo el campo \`escrowLockedCoins\`.
• **Liberación definitiva**: Una vez que el cajero liquida tu dinero y sube el comprobante formal de pago, las monedas en custodia se queman atómicamente en el libro mayor.
• **Si la orden se cancela**: Si el cajero o tú cancelan la orden por mutuo acuerdo o error de datos, **el 100% de los fondos en custodia regresa inmediatamente a tu saldo disponible**.`,
    highlights: [
      'Garantía anti-doble gasto',
      'Fondos 100% protegidos a tu nombre',
      'Reembolso automático inmediato si la orden se anula'
    ],
    relatedTopicIds: ['fin_withdraw_fees', 'fin_deposit_steps']
  },

  fin_deposit_steps: {
    id: 'fin_deposit_steps',
    title: '¿Cómo realizar un Depósito P2P seguro?',
    shortLabel: 'Cómo Depositar P2P',
    category: 'financial',
    iconName: 'Wallet',
    summary: 'Elige cajero oficial, transfiere el monto exacto, adjunta el comprobante (TxID o referencia) y recibe tus monedas.',
    content: `Para recargar Sugar Coins en tu cuenta a través de la red de cajeros P2P:

1. Ve a la pantalla **Billetera > Comprar Sugar Coins**.
2. Selecciona tu método de pago preferido (Pago Móvil, Transferencia Bancaria o Cripto USDT Binance Pay / TRC20).
3. Introduce el monto a recargar (Mínimo: 500 SC = $5 USD).
4. El sistema te asignará un cajero verificado con sus datos de pago en pantalla.
5. Realiza el pago desde tu banco o wallet y pega el número de referencia bancaria o TxID del hash cripto.
6. El cajero verificará la recepción del dinero y liberará tus Sugar Coins en tu balance (tiempo promedio: 5 a 20 minutos).`,
    highlights: [
      'Verifica siempre el número de referencia exacto',
      'Nunca transfieras a cuentas que no figuren en la orden activa',
      'Soporte monitorea cada transacción en tiempo real'
    ],
    relatedTopicIds: ['fin_parity', 'fin_escrow']
  },

  fin_min_max: {
    id: 'fin_min_max',
    title: 'Límites Mínimos y Máximos de Operación',
    shortLabel: 'Límites de Depósito y Retiro',
    category: 'financial',
    iconName: 'Coins',
    summary: 'Límites operativos por transacción para garantizar la liquidez del ecosistema.',
    content: `Los límites vigentes para transacciones financieras en Sugar Ludo son:

• **Depósito Mínimo**: 500 Sugar Coins ($5.00 USD).
• **Depósito Máximo por orden**: 50,000 Sugar Coins ($500.00 USD).
• **Retiro Mínimo**: 1,000 Sugar Coins ($10.00 USD).
• **Retiro Máximo por orden**: 100,000 Sugar Coins ($1,000.00 USD).

Si deseas operar montos institucionales o calificar para límites ampliados, solicita atención especial a través del panel de soporte.`,
    highlights: [
      'Depósito Mínimo: 500 SC ($5 USD)',
      'Retiro Mínimo: 1,000 SC ($10 USD)',
      'Máximo por retiro regular: 100,000 SC ($1,000 USD)'
    ],
    relatedTopicIds: ['fin_parity', 'fin_withdraw_fees']
  },

  // --- REGLAS DE JUEGO ---
  rule_exit: {
    id: 'rule_exit',
    title: 'Salida de Fichas de la Base (Regla del 5)',
    shortLabel: 'Salida de Fichas (Dado 5)',
    category: 'gameplay',
    iconName: 'Gamepad2',
    summary: 'Necesitas obtener un 5 (o que los dados sumen 5) para sacar una ficha al tablero.',
    content: `En Sugar Ludo se aplica el reglamento clásico de Parcheesi/Ludo competitivo:

• Para poner en juego una ficha que está en la base, debes sacar un dado **5** (o una combinación que sume 5 en caso de tirada múltiple).
• **Obligatoriedad de Salida**: Si tienes fichas disponibles en tu base y sacas un 5, el reglamento te obliga a sacar la ficha a tu casilla de salida antes de realizar movimientos con fichas que ya están en recorrido.
• Tu casilla de salida es una zona segura mientras estés en ella.`,
    highlights: [
      'Dado 5 libera ficha de la base',
      'Salida obligatoria si hay fichas en base',
      'Casilla de salida es zona segura'
    ],
    relatedTopicIds: ['rule_captures', 'rule_three_doubles']
  },

  rule_captures: {
    id: 'rule_captures',
    title: 'Capturas de Fichas y Bono de 20 Casillas',
    shortLabel: 'Capturas (+20 Bono)',
    category: 'gameplay',
    iconName: 'Zap',
    summary: 'Comer una ficha rival la envía a su base y te otorga +20 casillas de bonificación.',
    content: `Capturar fichas enemigas es una de las estrategias clave para dominar la partida:

• **Mecánica de Captura**: Si tu ficha aterriza exactamente en la misma casilla ocupada por una ficha enemiga (fuera de casillas seguras), la ficha del adversario es capturada y enviada de vuelta a su base.
• **Bonificación por Captura (+20)**: Al capturar una ficha enemiga, el juego te premia inmediatamente con un **avance extra de 20 casillas**, el cual puedes aplicar con cualquiera de tus fichas activas que pueda mover esa cantidad.
• Si no hay ninguna ficha que pueda avanzar las 20 casillas sin pasarse de la meta, el bono se consume.`,
    highlights: [
      'Ficha capturada regresa a base enemiga',
      'Premio de +20 casillas de avance libre',
      'No se puede capturar en casillas con Estrella (Seguro)'
    ],
    relatedTopicIds: ['rule_safe_zones', 'rule_goal_bonus']
  },

  rule_three_doubles: {
    id: 'rule_three_doubles',
    title: 'Penalización por 3 Dobles Consecutivos',
    shortLabel: 'Regla de 3 Dobles Seguidos',
    category: 'gameplay',
    iconName: 'AlertTriangle',
    summary: 'Sacar dobles te da tiro extra, pero sacar 3 dobles seguidos castiga tu última ficha.',
    content: `Sugar Ludo premia la suerte pero sanciona el monopolio del turno mediante la regla reglamentaria de Parcheesi:

• **Tiro Extra**: Cada vez que lanzas dados dobles (ej. 1-1, 3-3, 6-6), obtienes el derecho de lanzar nuevamente tras mover tus fichas.
• **Penalización del Tercer Doble**: Si tienes la fortuna de sacar dobles por **tercera vez consecutiva en el mismo turno**, se considera exceso de ventaja:
  - **Consecuencia**: La última ficha que hayas movido durante ese turno es castigada y regresa inmediatamente a tu base (a menos que ya haya entrado al pasillo de meta o zona segura final).
  - Tu turno concluye inmediatamente y pasa al siguiente jugador.`,
    highlights: [
      '1er y 2do doble: Tiro extra concedido',
      '3er doble consecutivo: Última ficha vuelve a base',
      'Fin automático de turno'
    ],
    relatedTopicIds: ['rule_captures', 'rule_exit']
  },

  rule_goal_bonus: {
    id: 'rule_goal_bonus',
    title: 'Llegada a la Meta y Bono de 10 Casillas',
    shortLabel: 'Meta (+10 Bono)',
    category: 'gameplay',
    iconName: 'Gamepad2',
    summary: 'Coronar una ficha en el centro otorga una bonificación de +10 casillas de avance.',
    content: `Para coronar una ficha en el centro de la meta:

• Debes sacar el número exacto de casillas restantes para llegar a la casilla central de tu color. Si el número del dado excede la distancia exacta, la ficha rebotará o el movimiento quedará inhabilitado según el modo.
• **Bonificación por Meta (+10)**: Al ingresar una ficha con éxito a la meta central, recibes un bono de **10 casillas de avance adicional**, aplicable a cualquiera de tus otras fichas en juego.
• El primer jugador en coronar sus 4 fichas en la meta se corona ganador de la partida.`,
    highlights: [
      'Número exacto requerido para entrar',
      'Premio de +10 casillas de avance al coronar',
      'Gana quien corone primero sus 4 fichas'
    ],
    relatedTopicIds: ['rule_captures', 'rule_safe_zones']
  },

  rule_safe_zones: {
    id: 'rule_safe_zones',
    title: 'Casillas Seguras (Estrellas) y Bloqueos',
    shortLabel: 'Casillas Seguras y Estrellas',
    category: 'gameplay',
    iconName: 'ShieldCheck',
    summary: 'Las casillas con símbolo de estrella y las casillas de salida son inmunes a capturas.',
    content: `En el tablero de Sugar Ludo existen casillas especiales protegidas:

• **Casillas con Estrella**: Son zonas neutras de seguridad. Si tu ficha reposa en una casilla con estrella, ningún adversario puede capturarla, incluso si cae en la misma casilla.
• **Casillas de Salida**: Cada color tiene su casilla de salida, la cual también actúa como zona segura para el dueño de ese color.
• **Pasillo de Meta**: El pasillo de acceso directo a la meta es exclusivo de tu color y ninguna ficha enemiga puede ingresar a él.`,
    highlights: [
      'Estrellas = Inmunidad total contra capturas',
      'Pasillo final privado y 100% protegido',
      'Estrategia clave: resguárdate en estrellas'
    ],
    relatedTopicIds: ['rule_captures', 'rule_exit']
  },

  // --- CONECTIVIDAD ---
  conn_disconnect: {
    id: 'conn_disconnect',
    title: '¿Qué sucede si pierdo la conexión a Internet?',
    shortLabel: 'Desconexión y Reconexión',
    category: 'connectivity',
    iconName: 'Wifi',
    summary: 'Reconexión automática instantánea con bot de salvaguarda para no frenar la partida.',
    content: `Sugar Ludo cuenta con una infraestructura de tolerancia a fallos de red móvil y WiFi:

1. **Intento de Reconexión Transparente**: Al detectar micro-cortes, el cliente WebSocket intenta reconectarse en segundo plano sin reiniciar la pantalla de juego.
2. **Ventana de Gracia**: Cuentas con los 15 segundos regulares de tu turno para restablecer tu enlace.
3. **Bot Protector Temporal**: Si tu conexión no regresa a tiempo, la Inteligencia Artificial del sistema toma un turno por ti realizando un tiro seguro (sacar ficha o mover la más adelantada). Esto previene que la sala se quede congelada perjudicando a los otros jugadores.
4. **Retorno Seguro**: Al recuperar tu conexión, retomas el control total de tus fichas sin penalización.`,
    highlights: [
      'Reconexión automática por WebSockets',
      'Bot toma turnos de emergencia para evitar abandono',
      'Recuperas el control de inmediato al volver el internet'
    ],
    relatedTopicIds: ['conn_timeout', 'conn_fairplay']
  },

  conn_timeout: {
    id: 'conn_timeout',
    title: 'Temporizador de Turno y Penalizaciones de Inactividad',
    shortLabel: 'Tiempo de Turno (15s)',
    category: 'connectivity',
    iconName: 'Clock',
    summary: 'Cada jugador dispone de 15 segundos por turno. Si se agota, el sistema actúa de oficio.',
    content: `Para garantizar partidas dinámicas y evitar que jugadores ausentes retengan el juego:

• Cada turno tiene un temporizador visual de **15 segundos**.
• Si el reloj llega a cero sin que toques los dados o selecciones una ficha válida, el sistema efectúa la tirada o el movimiento de forma automática.
• Si un jugador acumula **2 turnos consecutivos en timeout**, se activa el modo "Auto-Play" de salvaguarda hasta que el jugador pulse la pantalla para confirmar su presencia.`,
    highlights: [
      '15 segundos por turno',
      'Tirada automática al vencer el tiempo',
      'Protección activa contra jugadores ausentes (AFK)'
    ],
    relatedTopicIds: ['conn_disconnect', 'conn_fairplay']
  },

  conn_fairplay: {
    id: 'conn_fairplay',
    title: 'Política de Juego Limpio y Abandono Intencional',
    shortLabel: 'Juego Limpio y Abandonos',
    category: 'connectivity',
    iconName: 'ShieldCheck',
    summary: 'Cerrar la aplicación durante una partida monetizada se procesa como rendición legal.',
    content: `En partidas competitivas con monedas en juego:

• Si un jugador abandona la partida o cierra la aplicación intencionalmente sin regresar antes de que termine el juego, sus fichas continuarán bajo control del bot y, en caso de derrota, la cuota de entrada se liquidará a los ganadores según el libro mayor.
• No se permiten reembolsos de cuotas de entrada si la desconexión se debe a problemas de red del proveedor del usuario.
• Las partidas son auditadas por el servidor central para detectar intentos de desconexión manipulada o trampa.`,
    highlights: [
      'Cerrar app = Partida continúa con bot',
      'Premio se entrega legalmente al ganador',
      'Servidor autoritativo anti-trampas'
    ],
    relatedTopicIds: ['conn_disconnect', 'sec_balance_protection']
  },

  // --- SEGURIDAD ---
  sec_balance_protection: {
    id: 'sec_balance_protection',
    title: 'Protección de Saldo y Libro Mayor Inmutable',
    shortLabel: 'Seguridad de Balance',
    category: 'security',
    iconName: 'ShieldCheck',
    summary: 'Tu saldo está protegido por transacciones atómicas y doble contabilidad estricta.',
    content: `La economía de Sugar Ludo opera bajo estrictos protocolos Fintech de grado bancario:

• **Transacciones Atómicas**: Cualquier ingreso, débito, premio de partida o retiro se ejecuta mediante transacciones atómicas que impiden la pérdida de fondos por cortes de conexión.
• **Reglas RBAC**: Ningún cliente web puede modificar su saldo arbitrariamente. Todas las operaciones financieras son validadas por el servidor central.
• **Trazabilidad 100%**: Cada centavo cuenta con un registro en el historial de transacciones con identificador único y comprobante.`,
    highlights: [
      'Cero manipulación client-side',
      'Trazabilidad contable completa',
      'Protección estricta de saldo'
    ],
    relatedTopicIds: ['sec_p2p_cashiers', 'fin_escrow']
  },

  sec_p2p_cashiers: {
    id: 'sec_p2p_cashiers',
    title: 'Seguridad en la Red de Cajeros Verificados',
    shortLabel: 'Cajeros Verificados P2P',
    category: 'security',
    iconName: 'ShieldCheck',
    summary: 'Los cajeros cuentan con depósitos de garantía y monitoreo constante de auditoría.',
    content: `Todos los cajeros oficiales que operan depósitos y retiros en Sugar Ludo han superado un proceso de validación:

• **Depósito de Garantía Flotante**: Cada cajero mantiene un saldo en garantía dentro de la plataforma que respalda las operaciones de los jugadores.
• **Auditoría Continua**: Si un cajero no procesa una orden dentro del SLA o genera una discrepancia, el equipo de auditoría y disputas interviene inmediatamente para liberar los fondos del jugador.
• **Canal Oficial**: Nunca realices pagos a cajeros fuera de la plataforma o mediante chats externos. Toda comunicación debe estar registrada en el sistema.`,
    highlights: [
      'Cajeros respaldados por depósito de garantía',
      'Monitoreo central de auditoría',
      'Protección contra fraudes'
    ],
    relatedTopicIds: ['fin_deposit_steps', 'fin_withdraw_fees']
  }
}

/**
 * Obtiene un tema de conocimiento por su identificador único
 */
export function getKnowledgeTopic(topicId: string): KnowledgeTopic | null {
  return SUPPORT_TOPICS[topicId] || null
}

/**
 * Obtiene todos los temas pertenecientes a una categoría
 */
export function getTopicsByCategory(categoryId: string): KnowledgeTopic[] {
  const category = SUPPORT_CATEGORIES.find((c) => c.id === categoryId)
  if (!category) return []
  return category.topicIds
    .map((id) => SUPPORT_TOPICS[id])
    .filter((t): t is KnowledgeTopic => Boolean(t))
}

/**
 * Búsqueda instantánea y determinista en la base de conocimiento local (0ms / $0.00)
 */
export function searchKnowledgeBase(rawQuery: string): KnowledgeTopic[] {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return []

  const words = query.split(/\s+/).filter((w) => w.length > 1)
  if (words.length === 0) return []

  const results: { topic: KnowledgeTopic; score: number }[] = []

  for (const topic of Object.values(SUPPORT_TOPICS)) {
    let score = 0
    const titleLower = topic.title.toLowerCase()
    const summaryLower = topic.summary.toLowerCase()
    const contentLower = topic.content.toLowerCase()

    for (const word of words) {
      if (titleLower.includes(word)) score += 10
      if (summaryLower.includes(word)) score += 5
      if (contentLower.includes(word)) score += 2
      if (topic.highlights?.some((h) => h.toLowerCase().includes(word))) score += 4
    }

    if (score > 0) {
      results.push({ topic, score })
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .map((item) => item.topic)
    .slice(0, 6)
}
