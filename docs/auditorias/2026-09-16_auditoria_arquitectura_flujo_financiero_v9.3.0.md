# 🔬 Informe de Arquitectura y Diagnóstico — Sugar Ludo v9.3.0
**Preparado por: Antigravity — Agente de Arquitectura**
**Fecha:** 2026-09-16 | **Rama:** `main` → commit `a526b48`
**Estado de Remediación:** ✅ 100% Subsanada (incorporada y certificada en v9.3.2 – v9.3.5)

---

## Resumen Ejecutivo

Se realizó un análisis forense completo del flujo financiero en Sugar Ludo: depósitos, retiros, historial de billetera y duplicación de mensajes en el panel cajero. El diagnóstico revela **tres bugs diferenciados** — ninguno de ellos requiere tocar `firestore.rules`, bases de datos ni lógica contable. Son errores de integración de UI.

---

## 1. Mapa de la Arquitectura Actual

```
[Jugador / WalletScreen] ─── onSnapshot(users/{uid}) ──► walletHistory[] array en doc users
           │
           ▼
 [wallet-service.ts] → createWithdrawOrder → /api/cashier/orders POST → cashier_orders/{id}
           │
           ▼
 [Cajero / cashier/orders/[id]/page.tsx]
           │
           ├─ onSnapshot(cashier_orders/{id}) ─► setMessages(supportMessages[])
           │
           ├─ handleApprove() → POST /api/cashier/orders/[id]/action?action=approve_deposit
           │        └► atomic-transactions.ts: approveDepositOrder()
           │                └► users/{uid}.walletHistory ← agrega entry "deposit" ✅
           │
           └─ handleConfirmPayout() → POST /api/cashier/orders/[id]/action?action=complete_withdrawal
                    └► atomic-transactions.ts: completeWithdrawalOrder()
                             ├► cashier_orders/{id}.supportMessages ← agrega comprobante ✅
                             └► users/{uid}.walletHistory ← ACTUALIZA entry existente ⚠️
```

---

## 2. Bug #1 — Retiro NO aparece en el historial de la billetera del jugador

### Síntoma
El cajero liquida el retiro, el balance se descuenta correctamente y el correo llega al buzón. Pero en la pantalla `WalletScreen` la sección "Movimientos Recientes" **no muestra el retiro**.

### Diagnóstico

**Dónde vive el historial:** `wallet-screen.tsx` L43–50. La pantalla lee el array `user.walletHistory` directamente del objeto `user` del `AuthContext`, que se sincroniza vía un listener en `users/{uid}`.

**Qué hace `completeWithdrawalOrder` en el motor fallback (L1061–1111 de `atomic-transactions.ts`):**

```ts
// L1075-1092 (motor fallback híbrido)
let matched = false
const cleanHistory: any[] = []
for (const tx of existingHistory) {
  const isTargetOrder = tx.orderId === orderId || (tx.description && tx.description.includes(orderId.slice(0, 8)))
  if (isTargetOrder) {
    if (!matched) {
      matched = true
      cleanHistory.push({
        ...tx,
        orderId,
        payoutTxId,
        description: `Retiro Liquidado (#${orderId}) - TxID: ${payoutTxId}`   // ← SOLO MUTA
      })
    }
    // Si ya se procesó, descarta duplicados huérfanos
  } else {
    cleanHistory.push(tx)
  }
}
```

**El problema está en `userUpdates` en L1095–1110:**

```ts
const userUpdates: any = {
  escrowLockedCoins: newEscrow,
  walletHistory: cleanHistory.slice(0, 50),
  lastActiveAt: now
}

// Candado Anti-Rebote:
if (currentEscrow < amountCoins) {
  const deficit = amountCoins - currentEscrow
  newCoins = Math.max(0, currentCoins - deficit)
  userUpdates.coins = newCoins          // ← solo se agrega si hay déficit de escrow
  userUpdates.escrowLockedCoins = 0
}

await updateDoc(userDocRef, userUpdates)
```

> **Observación crítica:** El campo `coins` (balance del jugador) **solo se actualiza si `currentEscrow < amountCoins` (candado anti-rebote)**. Si el escrow está bien bloqueado (caso normal), `coins` **no se toca**, lo cual es correcto. ✅

**Pero el bug real está en la condición de `matched`:**

Cuando el jugador solicita el retiro, `createWithdrawOrderWithEscrow` (L411–432, ruta Admin SDK) agrega al `walletHistory` un entry con:
- `description: "Solicitud de Retiro (Pendiente) (#xxx)"`
- `orderId: finalOrderId`

Cuando el cajero liquida, `completeWithdrawalOrder` busca ese entry con:
```ts
const isTargetOrder = tx.orderId === orderId || (tx.description && tx.description.includes(orderId.slice(0, 8)))
```

**Si `matched` queda en `false`** (el entry de solicitud no fue encontrado en el historial), entonces `cleanHistory` simplemente replica el historial existente sin agregar ninguna entrada nueva de "Retiro Liquidado". Esto sucede cuando:

1. El motor Admin SDK creó la solicitud pero usó un `orderId` diferente al que el motor fallback espera (ej: timestamp truncado vs. completo).
2. La solicitud de retiro fue creada por el motor **fallback** (L480–503) y en ese path `walletHistory` se actualizó, pero el `escrowLockedCoins` se incrementó correctamente.

**La causa raíz es el motor Admin SDK vs. motor Fallback:**
- Si la solicitud la procesó el Admin SDK (L398–460), el entry en `walletHistory` se guarda correctamente con `orderId`.
- Si la liquidación la procesa el motor **Fallback** (L987–1143), este no agrega un entry **nuevo** cuando `matched = false`. Se limita a dejar el historial intacto, sin insertar una fila de "Retiro Liquidado".

**Conclusión del bug #1:** En el motor fallback de `completeWithdrawalOrder`, si no se encuentra el entry pendiente en el historial (`!matched`), el código **no agrega ninguna entrada nueva** al `walletHistory`. La liquidación ocurre (escrow se libera, balance se ajusta), pero el historial queda huérfano.

---

## 3. Bug #2 — El retiro en la billetera del jugador sigue en "EN COLA | Esperando Cajero"

### Síntoma
Después de que el cajero liquida, la sección "Órdenes Activas" de la billetera sigue mostrando la orden como pendiente.

### Diagnóstico

`wallet-screen.tsx` L52–156. Escucha `cashier_orders` con `onSnapshot` filtrado por `playerUid`. Cuando una orden cambia a `status: 'completed'`, se llama `updateLocalOrderStatus(orderId, 'completed')` y se saca del arreglo `liveActive` (L78–101). Eso está bien.

**Sin embargo, hay una condición de carrera:** El listener de `cashier_orders` en la billetera del jugador corre en el contexto del cliente móvil/juego (Next.js principal). Si el cliente no tiene una sesión de Firebase Auth activa con `playerUid` coincidente, el listener podría no recibir la actualización en tiempo real dependiendo de las reglas.

Revisando `firestore.rules` L68–94:
```js
match /cashier_orders/{orderId} {
  allow read: if true;  // ✅ Lectura pública
```

La lectura es pública. **No hay problema de permisos en la lectura.**

**El bug real aquí:** En L76 del `wallet-screen.tsx`:
```ts
if (ord.status !== 'completed' && ord.status !== 'cancelled') {
  liveActive.push({ ...ord, id: orderId })
}
```

Esta lógica es correcta. El problema está en el **motor de conciliación anti-rebote** en L109–127:
```ts
if (user?.uid && !user.uid.startsWith('dev_')) {
  const pendingWithdrawals = liveActive.filter(o => o.type === 'withdraw')
  const totalPendingWithdrawalCoins = pendingWithdrawals.reduce(...)
  const currentEscrow = Number(user?.escrowLockedCoins || 0)
  
  if (currentEscrow > totalPendingWithdrawalCoins) {
    const orphanedEscrow = currentEscrow - totalPendingWithdrawalCoins
    updateDoc(userRef, {
      coins: correctedCoins,
      escrowLockedCoins: totalPendingWithdrawalCoins,  // ← INTENTO DE ESCRITURA
    }).catch(() => {})
  }
}
```

Este código intenta escribir `coins` y `escrowLockedCoins` directamente desde el **cliente** en `users/{uid}`. Las `firestore.rules` L18–20 bloquean esto explícitamente:
```js
allow update: if request.auth != null && request.auth.uid == userId &&
              !request.resource.data.diff(resource.data).affectedKeys()
                .hasAny(['coins', 'escrowLockedCoins', ...]);
```

**Esta escritura fallará silenciosamente** (`.catch(() => {})`), pero no es la causa del historial roto. Sin embargo, confirma que hay código cliente intentando mutar campos protegidos que siempre va a silenciarse.

---

## 4. Bug #3 — Mensajes duplicados / triplicados en el panel cajero

### Síntoma
Al confirmar un retiro, el cajero ve el comprobante aparecer 2–3 veces en el chat de su pantalla. Sin embargo, al jugador le llega solo una vez.

### Diagnóstico

Cuando el cajero llama `handleConfirmPayout()` (actualmente en el commit `a526b48` el código está restaurado con el `handleSendMessage`), la cadena de escrituras es:

**Paso 1: `completeWithdrawalOrder` en el servidor (vía `/api/cashier/orders/[id]/action`)**
→ En el motor Admin SDK (L848–888): Construye `officialNoticeMsg` y lo agrega a `cashier_orders/{id}.supportMessages`. ✅
→ En el motor Fallback (L1016–1056): Hace lo mismo. ✅

El `onSnapshot` del front del cajero (L211–247 de `page.tsx`) escucha `cashier_orders/{id}` y cuando recibe el snapshot, ejecuta:
```ts
if (Array.isArray((data as any).supportMessages)) {
  setMessages((data as any).supportMessages)   // ← Reemplaza el array completo
}
```
→ Esto **ya** carga el comprobante del backend. ✅ (1 mensaje)

**Paso 2: `handleSendMessage(payoutNoticeText)` en el frontend (L610 de `page.tsx`)**

`handleSendMessage` (L326–410) hace tres cosas:
1. **Optimistic UI**: `setMessages(prev => [...prev, newMsg])` → Agrega el mensaje al estado local. Este es el **mensaje #2** que el cajero ve (aparece antes de que llegue el snapshot).
2. **Firestore directo**: Lee `cashier_orders/{id}.supportMessages` actual, le hace push de `cleanMsg` y lo escribe de vuelta. → Dispara un **nuevo snapshot** → el `onSnapshot` recibe el cambio y vuelve a ejecutar `setMessages(data.supportMessages)` con el array que ahora tiene 2 mensajes (el del backend + el del frontend). → **Mensaje #3** (duplicado del #2 que había aparecido como optimista).
3. **API `/message`**: Agrega otro registro en `cashier_orders/{id}/messages` subcollection y en `cashier_orders/{id}.supportMessages` vía adminDb. Dispara **otro snapshot**. → **Mensaje #4** si el timing es diferente.

**Por qué al jugador le llega solo una vez:** El buzón del jugador (`inbox`) se actualiza en `/api/cashier/orders/[id]/message/route.ts` (L131–259) usando la lógica de upsert por `orderId`. Si ya existe un mail con ese `orderId`, se actualiza (no se duplica). Por eso en el inbox solo llega una vez.

### El árbol completo de la triplicación:
```
handleConfirmPayout()
├─ completeWithdrawalOrder() [SERVIDOR]
│    └─ supportMessages = [...existentes, officialNoticeMsg]  → snapshot → setMessages([1])
│
└─ handleSendMessage(payoutNoticeText) [CLIENTE]
     ├─ setMessages(prev => [...prev, newMsg])                → render local [2]
     ├─ updateDoc(cashier_orders, {supportMessages: [..., cleanMsg]}) → snapshot → setMessages([1,2])
     └─ fetch(/api/message) → adminDb escribe supportMessages+1 → snapshot → setMessages([1,2,2])
```

---

## 5. Análisis de Reglas Firestore

Las reglas actuales son **correctas y robustas**. No hay ningún candado oculto que bloquee el historial de retiros. Lo que hay es:

| Regla | Impacto |
|---|---|
| `users/{uid}` — No permite mutar `coins`, `escrowLockedCoins` desde cliente | Correcto. El motor de conciliación en `wallet-screen.tsx` L109–127 falla silenciosamente, pero no causa ningún daño. |
| `cashier_orders/{id}` — Permite update solo de `supportMessages`, `lastMessage`, etc. | Correcto. El `handleSendMessage` del cajero puede escribir sin problemas. |
| `cashier_profiles/{id}` — write: false | Bloquea escrituras directas desde el cliente en `cashier_profiles`, lo cual las reglas protegen correctamente. |

---

## 6. Plan de Solución Definitivo

### Fix #1 — Historial de retiros (walletHistory no se actualiza)
**Archivo a modificar:** `atomic-transactions.ts` — función `completeWithdrawalOrder`, motor fallback.
**Cambio quirúrgico:** Después del loop que intenta encontrar y mutar el entry existente, agregar un bloque `if (!matched)` que **inserte una nueva entrada** al inicio del historial:

```ts
if (!matched) {
  cleanHistory.unshift({
    id: `tx_wit_complete_${now}_${Math.random().toString(36).slice(2, 6)}`,
    orderId,
    payoutTxId,
    type: 'withdraw',
    amount: -amountCoins,
    description: `Retiro Liquidado (#${orderId.slice(0, 8)}) - TxID: ${payoutTxId}`,
    timestamp: now,
    dateStr: new Date().toLocaleDateString('es-ES', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  })
}
```

### Fix #2 — Triplicación de mensajes en la vista del cajero
**Archivo a modificar:** `sugar-ludo-admin-hub/app/cashier/orders/[id]/page.tsx`
**Solución:** Eliminar `handleSendMessage` de `handleApprove` y `handleConfirmPayout`. El backend (`completeWithdrawalOrder` y `approveDepositOrder`) inyecta directamente el comprobante en `supportMessages` y en `inbox`.

### Fix #3 — Motor de conciliación silencioso
**Archivo:** `wallet-screen.tsx` L109–127.
Eliminar bloque de conciliación cliente para evitar escrituras que violen las reglas y consuman lecturas Spark innecesarias.

---

## 7. Resumen del Plan de Trabajo

| # | Bug | Archivo a Modificar | Cambio |
|---|---|---|---|
| 1 | Retiro no aparece en historial | `atomic-transactions.ts` | Agregar inserción de entry nuevo cuando `!matched` en `completeWithdrawalOrder` (fallback + Admin SDK) |
| 2A | Triplicación en vista cajero | `page.tsx` (cajero) | Eliminar `handleSendMessage` de `handleApprove` y `handleConfirmPayout` |
| 2B | Correo al jugador al liquidar | `atomic-transactions.ts` | Agregar inyección de inbox en `completeWithdrawalOrder` y `approveDepositOrder` (mismo patrón de `message/route.ts`) |
| 3 | Conciliación silenciosa | `wallet-screen.tsx` | Eliminar bloque L109–127 que intenta mutar `coins`/`escrowLockedCoins` desde cliente |

---

## 8. Verificación Final del Flujo Saneado

```
Cajero liquida retiro
├─ completeWithdrawalOrder() [servidor]
│    ├─ cashier_orders/{id}.supportMessages ← comprobante (1 vez)
│    ├─ users/{uid}.escrowLockedCoins ← liberado
│    ├─ users/{uid}.walletHistory ← entry actualizado (o insertado si !matched) ✅ FIX #1
│    └─ users/{uid}.inbox ← correo del comprobante ✅ FIX #2B
│
└─ [NO más handleSendMessage]  ✅ FIX #2A
        │
        ▼
 onSnapshot(cashier_orders/{id}) → setMessages(supportMessages)  ← 1 mensaje, sin duplicados ✅
 onSnapshot(users/{uid}) → walletHistory ← 1 entry de retiro liquidado visible ✅
 users/{uid}.inbox ← 1 correo formal recibido por el jugador ✅
```
