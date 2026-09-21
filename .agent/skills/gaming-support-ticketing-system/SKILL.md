---
name: gaming-support-ticketing-system
description: Arquitectura de soporte y ticketing comercial AAA para plataformas iGaming y Fintech con dinero real. Cubre el ciclo de vida completo del ticket (pre-triage determinista, auditoría de telemetría de socket/motor, segregación de dominios de resolución y conciliación contable sin costo $0.00).
---

# Gaming Support & Ticketing System (AAA iGaming / Fintech Standard)

Este estándar define la arquitectura, el ciclo de vida de incidencias y los protocolos de resolución operativa para plataformas de juegos multijugador con dinero real y operaciones de tesorería P2P.

---

## 1. Principios Rectores de la Industria

1. **Segregación Estricta de Dominios Operativos:**
   - **Disputas Financieras / P2P**: Afectan balances, libros mayores y saldos flotantes de cajeros. Requieren acciones atómicas de tesorería (`favor_player`, `favor_cashier`, `release_escrow`).
   - **Reportes de Partidas / Gameplay**: Afectan la experiencia lúdica y percepción de justicia. NO involucran cajeros. Requieren verificación de telemetría (desconexión de socket, timeout de tirada, reglas de dados) y acciones de compensación de cortesía (*Goodwill Token Grant*) o desestimación por reglamento.
   - **Incidencias de Cuenta y Seguridad**: Afectan perfiles, sincronización de saldo o anomalías de autenticación.

2. **Pre-Triage Determinista con Telemetría Local:**
   - Ningún reporte se emite a ciegas. Antes de generar un ticket, el cliente audita su propio estado en memoria:
     - Estado de órdenes activas y SLAs restantes.
     - Telemetría de red reciente (`logger.ts`: reconexiones de socket, caídas de ping).
     - Validación de reglas oficiales (dado 5 obligatorio para salida, penalización por 3 dobles).
   - Si la pre-validación concluye que la experiencia cumplió la regla o está en tiempo normal de atención, se entrega una resolución inmediata (0ms, $0.00) y se desestimula el ticket spam.

3. **Inmutabilidad y Trazabilidad del Folio:**
   - Todo ticket formal recibe un folio de auditoría estándar: `TKT-YYYY-XXXX`.
   - Se almacena en la colección `dispute_cases` y vincula el snapshot técnico del cliente para que el operador en el Admin Hub disponga de evidencia objetiva sin necesidad de interrogar al jugador.

---

## 2. Ciclo de Vida del Ticket (4 Fases)

```
[ JUGADOR ENTRA A SOPORTE ]
            │
            ▼
┌────────────────────────────────────────┐
│ FASE 1: Pre-Triage Determinista        │
│ • Evaluación de Reglas de Juego        │
│ • Cálculo de SLA de Órdenes            │
│ • Inspección de Logs Locales (Socket)  │
└───────────────────┬────────────────────┘
                    │
       ┌────────────┴────────────┐
       ▼                         ▼
[ Duda Resuelta en 0ms ]   [ Anomalía / Demora / Incidencia Real ]
(Reglamento o En Tiempo)         │
                                 ▼
                    ┌────────────────────────────────────────┐
                    │ FASE 2: Captura y Enriquecimiento      │
                    │ • Metadatos de la Orden o Partida      │
                    │ • Snapshot de Telemetría (Ping/Socket) │
                    │ • Notas Específicas del Jugador        │
                    │ • Generación de Folio: TKT-2026-XXXX   │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼
                    ┌────────────────────────────────────────┐
                    │ FASE 3: Enrutamiento en Admin Hub      │
                    │ Pestañas Segregadas:                   │
                    │ ├─ Disputas Financieras P2P            │
                    │ ├─ Reportes de Gameplay / Motor        │
                    │ └─ Cuentas y Casos Generales           │
                    └───────────────────┬────────────────────┘
                                        │
                                        ▼
                    ┌────────────────────────────────────────┐
                    │ FASE 4: Resolución Contextualizada     │
                    │ • Financiero: Mutación Atómica Ledger  │
                    │ • Gameplay: Aclaratoria / Compensación │
                    │ • Cierre Formal y Notificación Buzón   │
                    └────────────────────────────────────────┘
```

---

## 3. Matriz de Dominios y Acciones Permitidas en Admin Hub

| Dominio | Origen | Metadatos Clave | Acciones Exclusivas del Operador |
|---|---|---|---|
| **Disputa Financiera P2P** | Billetera / Cajero | `orderId`, `cashierUid`, `amountFiat`, `amountSugarCoins`, `receiptUrl` | • **Acreditar Jugador**: Libera fondos retenidos al balance del jugador y penaliza flotante del cajero.<br>• **Dictaminar al Cajero**: Cancela orden fraudulenta y libera garantía al cajero.<br>• **Reasignar Orden**: Reasigna a otro cajero activo. |
| **Reporte de Gameplay** | Partida / Motor | `roomCode`, `matchTimestamp`, `telemetrySnapshot` (ping, desconexiones, tiradas) | • **Aclaratoria Oficial**: Responde con cita reglamentaria y cierra como desestimado.<br>• **Compensar Entrada (Goodwill)**: Si la telemetría confirma caída masiva de socket del servidor, abona los SC de la entrada al balance del jugador.<br>• **Cerrar como Desconexión Local**: Si la telemetría evidencia pérdida de red del cliente. |
| **Incidencia de Cuenta** | Perfil / Sistema | `playerUid`, `visibleCoins`, `escrowLockedCoins`, `deviceInfo` | • **Re-conciliar Saldo**: Sincroniza `coins` y `escrowLockedCoins` con el libro mayor.<br>• **Aclarar Estado de Cuenta**: Envía mensaje oficial de soporte al buzón del jugador. |

---

## 4. Estructura del Snapshot de Telemetría

Al generarse un ticket, el cliente web compila un objeto liviano en memoria:

```typescript
export interface TicketTelemetrySnapshot {
  clientPlatform: 'web' | 'android_capacitor' | 'electron_desktop';
  appVersion: string;
  userAgent: string;
  lastRoomCode?: string;
  recentSocketEvents: Array<{
    timestamp: string;
    level: string;
    message: string;
  }>;
  accountState: {
    availableCoins: number;
    escrowCoins: number;
    activeOrdersCount: number;
  };
}
```

Este snapshot permite que el administrador en `/admin/disputas` audite de forma inequívoca si el usuario experimentó micro-cortes locales o si el servidor presentó una interrupción.

---

## 5. Gobernanza de Recursos ($0.00 / Spark Plan)

- **Cero Consultas Adicionales**: Toda la pre-validación de reglas y órdenes se efectúa en memoria RAM reutilizando los estados de `AuthContext` y `PlayerProvider`.
- **Estructura Firestore Unificada**: Todos los tipos de tickets conviven en la colección existente `dispute_cases` sin requerir nuevas colecciones ni reglas adicionales en `firestore.rules`.
- **Límite de Lectura Segura**: El panel de administración y el cliente ejecutan suscripciones con `limit(20)` y desconexión inmediata al pasar la pestaña a segundo plano (`document.hidden`).
