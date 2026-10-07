---
name: aaa-ops-dashboard-security
description: Arquitectura, seguridad y telemetría de dashboards de operación y juegos AAA (Admin Hub y Cajeros). Define estándares de sesiones seguras y RBAC, observabilidad de concurrencia y salud de nodos, y trazabilidad forense para mesas de dinero y operaciones de caja, siempre bajo el plan Spark ($0.00/mes).
---

# AAA Ops Dashboard — Seguridad, Telemetría y Forense (Sugar Ludo)

Úsala al diseñar o modificar: `sugar-ludo-admin-hub` (auth, RBAC, aprovisionamiento de staff), telemetría en vivo (`server.js`, `/api/telemetry`), operaciones de caja (`cashier/*`, `atomic-transactions.ts`) y bitácoras de auditoría.
Consulta SIEMPRE `graphify-out/GRAPH_REPORT.md` antes de ubicar componentes (prohibidas búsquedas en frío).

---

## 1. Sesiones y RBAC (Zero Trust Staff)

1. **Identidad = servidor.** Ningún dato de `localStorage`/`sessionStorage` (`sugar_admin_session`, `sugar_cashier_session`) otorga acceso: son solo caché de UI. Toda API se valida con `verifyStaffAuth` y toda página sensible re-valida contra `/api/staff/auth/me`.
2. **Credenciales:** prohibido contraseñas en claro, hardcodeadas o replicadas en Firestore/localStorage. Solo hash (scrypt/argon2 con sal) en documento server-only (`staff_credentials/{uid}`, `allow read, write: if false`).
3. **Sin fallbacks de privilegio:** un token válido sin claim de rol se **deniega** (nunca `super_admin` por defecto, ni por heurística de email/uid).
4. **Sesión acotada al cliente seguro:**
   - Cookie `__Host-` `HttpOnly; Secure; SameSite=Strict` con ID de sesión opaco (no JWT en JS).
   - Documento `staff_sessions/{sid}`: `uid, role, uaHash, ipPrefix, deviceId, createdAt, lastSeenAt, absoluteExp, revokedAt, tokenVersion`.
   - Caducidad por inactividad (cajero 15 min, admin 30 min) y absoluta (8–12 h). Re-auth para acciones críticas (reset contable, creación de staff, ajuste de float).
   - Revocación inmediata: `revokeRefreshTokens(uid)` + `tokenVersion++` + `checkRevoked=true` en `verifyIdToken`.
5. **No persistencia por enlace:** prohibido propagar tokens por URL/query; el login no se hereda entre navegadores. Una sola sesión activa por cajero (la nueva invalida la anterior).
6. **Matriz RBAC** declarativa (`lib/rbac-matrix.ts`): `acción → roles`. Roles: `super_admin`, `financial_admin`, `support_admin`, `cashier`. Toda ruta declara su acción; test automatizado que falla si hay ruta sin matriz.
7. **Aprovisionamiento:** solo vía endpoints server (`/api/staff/*`) con `verifyStaffAuth(['super_admin'])`, contraseña temporal de un solo uso con `mustChangePassword`, y registro en bitácora inmutable. Revocar = desactivar + revocar sesiones + invalidar tokens, en una transacción.
8. **Defensa en profundidad:** rate-limit (`lib/rate-limiter.ts`) + backoff y bloqueo temporal en login; CORS restringido a orígenes propios; `Cache-Control: no-store` en APIs de staff.

## 2. Observabilidad en tiempo real (concurrencia y salud)

1. **Presencia efímera en memoria** (no Firestore): `telemetry_heartbeat` con TTL; contadores por estado (`lobby`, `ai`, `online`, `competitive`) y tablero (`2p..6p`). Salir de partida limpia el modo de inmediato.
2. **Agregación idempotente:** el dashboard consume un snapshot único (`/api/telemetry/live`) + SSE/BroadcastChannel; sondeo ≥5 s solo como fallback.
3. **Salud de nodos:** ping/latencia mediana, uptime, memoria y salas activas del servidor WS; semáforo (verde/ámbar/rojo) con umbrales configurables y alertas deduplicadas (`alertEventBuffer`).
4. **Series temporales sin costo:** anillos en memoria (60 min a 1 min de resolución) + rollup diario en **un** documento (`telemetry_rollups/{yyyy-MM-dd}`) con ≤1 escritura/hora.
5. **Principio Spark:** ninguna métrica efímera escribe en Firestore por evento.

## 3. Trazabilidad y auditoría forense (mesas de dinero y caja)

1. **Bitácora inmutable** `audit_logs/{id}` (solo Admin SDK): `actorUid, role, action, target, before, after, reqId, ipPrefix, uaHash, sessionId, ts`, encadenada con `prevHash` + `hash = SHA256(prevHash + payload)` (cadena verificable).
2. **Toda acción de staff** (login, logout, alta/baja, float, reset, resolución de disputa, aprobación/rechazo de orden) emite entrada; falla de auditoría ⇒ falla la operación (fail-closed).
3. **Snapshot de telemetría en la orden:** al crear/procesar una orden se congela `playerActivitySnapshot` (última sesión, partidas recientes, modo, dispositivo, eventos de presencia de los últimos N min) para el validador antifraude y para disputas.
4. **Dinero en céntimos enteros**, transacciones atómicas de doble entrada, ledger con `balanceBefore/After`.
5. **Conciliación:** `Σ wallets + Σ floats + bóveda = invariante`; discrepancia ⇒ alerta crítica y bloqueo preventivo de retiros.
6. **Retención:** detalle 30 días; rollups agregados indefinidos (cuota Spark).

## 4. Gobernanza de cuota Spark ($0.00)
- Lecturas: cachés en memoria con TTL, `onSnapshot` solo en documentos únicos de bajo cambio.
- Escrituras: rollups/lotes; auditoría = 1 doc por acción crítica (no por evento de UI).
- Todo diseño nuevo debe incluir estimación de lecturas/escrituras diarias y quedar < 50 % de la cuota gratuita.

## 5. Checklist de revisión (obligatorio por PR)
- [ ] ¿Algún acceso depende de datos del navegador sin validación server?
- [ ] ¿Hay contraseñas/tokens en claro, URL o localStorage?
- [ ] ¿Existe fallback que eleve privilegios?
- [ ] ¿Ruta nueva declarada en la matriz RBAC y con test?
- [ ] ¿Acción crítica auditada (fail-closed) con hash encadenado?
- [ ] ¿Costo Spark estimado y dentro de presupuesto?
- [ ] `npm test` 100 %, `npx tsc --noEmit` 0 errores (raíz y admin-hub).
