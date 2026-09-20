---
name: igaming-fintech-support-engine
description: Arquitectura de soporte al cliente de 2 niveles (Tier 1 Virtual Assistant + Tier 2 Human Escalation), desacoplamiento de recibos transaccionales y protocolo de asistencia $0.00 para Sugar Ludo.
---

# iGaming & Fintech Intelligent Support Engine (Sugar Ludo)

Este estándar técnico define la separación estricta entre **comprobantes contables de solo lectura (Ledger Receipts)** y el **ecosistema de soporte y resolución de incidencias en 2 niveles (Tier 1 / Tier 2)** para plataformas de juegos con dinero real / Fintech.

---

## 1. Principios Rectores de Arquitectura

1. **Desacoplamiento Contable vs. Soporte:**
   - Un cajero P2P es un operador de liquidez financiera, **no un agente de servicio al cliente**.
   - Los recibos de depósitos o retiros completados son **comprobantes inmutables de solo lectura (Read-Only)**.
   - Queda estrictamente prohibido permitir respuestas de chat abiertas en transacciones finalizadas (`completed`, `cancelled`, `rejected`).

2. **Gobernanza de Costos y Recursos ($0.00 / Spark Plan):**
   - El Asistente Virtual Tier 1 opera de forma **100% determinista y client-side** (árboles de decisión interactivos y base de conocimiento indexada).
   - Cero dependencias de APIs LLM externas de pago por token.
   - Cero consultas adicionales a Firestore: el bot reutiliza el estado ya cargado en memoria (`AuthContext`, `PlayerProvider`, listeners activos de órdenes).

3. **Escalamiento Controlado a Soporte Humano (Tier 2):**
   - Solo se habilita la creación de tickets humanos cuando:
     - Un SLA de orden ha expirado (> 48h depósito / > 72h retiro estándar).
     - Existe un fallo o discrepancia no resuelta por el diagnóstico automático.
     - El jugador manifiesta una disputa formal.
   - La escalación se canaliza a la colección existente `dispute_cases`, gestionada desde el panel administrativo (`/admin/disputas`) bajo roles de staff autenticados.

---

## 2. Taxonomía de Estados y Recibos Transaccionales (Read-Only)

```
[ Transacción ] ──────────► [ Estado Terminal: COMPLETED / CANCELLED ]
                                      │
                                      ▼
                        [ Recibo Oficial de Ledger ]
                        ├─ Badge de Estado Inmutable
                        ├─ Hash de TxID / Referencia Bancaria
                        ├─ Monto Bruto, Comisiones y Neto Liquidado
                        ├─ Timestamp y SLA Cumplido
                        └─ Input de Chat: DESACTIVADO (Solo Lectura)
                                      │
                                      ▼
                        [ Botón CTA Asistente de Soporte ]
                        "¿Dudas con este recibo? Abrir Asistente"
```

---

## 3. Matriz de Flujo del Asistente Virtual (Tier 1)

El motor de árbol de decisión evalúa los siguientes ejes temáticos:

| Eje Temático | Consultas Comunes | Acción Automatizada del Bot |
|---|---|---|
| **Diagnóstico de Cuenta** | "¿Dónde está mi dinero?", "Estado de orden" | Inspecciona en memoria `activeOrders` y explica el estado exacto sin llamadas de red. |
| **Retiros & Escrow** | "¿Por qué mi saldo está bloqueado?", "Tiempo de retiro" | Explica la retención preventiva en custodia y muestra el SLA restante (72h Estándar / 24h VIP). |
| **Depósitos P2P** | "¿Cómo verificar mi TxID?", "Tasa de cambio" | Proporciona tutorial paso a paso con paridad $1\text{ USDT} = 100\text{ SC}$ y métodos válidos. |
| **Reglas del Juego** | "3 dobles seguidos", "Bonus por captura", "Desconexión" | Muestra resumen reglamentario y política de bots en desconexión. |
| **Disputa / Reclamo** | "El cajero no me pagó", "Comprobante rechazado" | Verifica SLA; si califica, compila el resumen y ofrece el botón de **Escalamiento a Ticket Humano**. |

---

## 4. Estructura de Ticket para Escalamiento (Tier 2)

```typescript
export interface SupportTicket {
  ticketId: string;           // tkt_1789...
  playerUid: string;          // UID del jugador
  playerName: string;         // Nombre o Nickname
  category: 'deposit_dispute' | 'withdrawal_delay' | 'gameplay_issue' | 'account_security';
  status: 'open' | 'investigating' | 'resolved';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  relatedOrderId?: string;    // ID de la orden vinculada (si aplica)
  botSummary: string;         // Resumen generado por el árbol de decisión
  initialMessage: string;     // Pregunta/problema del jugador
  createdAt: number;
  updatedAt: number;
}
```

Este ticket se registra en `dispute_cases` y se atiende en `/admin/disputas` por los operadores de soporte, garantizando que el jugador **nunca tenga que repetir su problema**.
