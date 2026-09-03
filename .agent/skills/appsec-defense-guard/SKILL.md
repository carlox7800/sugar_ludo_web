---
name: appsec-defense-guard
description: Protocolos de seguridad ofensiva/defensiva, protección de balance, reglas Firestore RBAC, anti-tampering y anti-cheat en Sugar Ludo.
---

# AppSec Defense Guard (Sugar Ludo)

Esta guía establece los estándares de seguridad web, protección contra manipulaciones de cliente (anti-tampering), blindaje de saldos y reglas estrictas de Firestore para el ecosistema Sugar Ludo.

---

## 1. Arquitectura "Zero Trust Client" y Server-Authoritative

El cliente (navegador, app Android o app de escritorio) se considera **100% hostil e inseguro**.
1. **El cliente NUNCA calcula estados definitivos:**
   - No calcula resultados de dados.
   - No determina victorias o clasificaciones finales.
   - No incrementa ni deduce saldos directamente.
2. **Arquitectura basada en Intenciones (Intent-Based):**
   - El cliente solo despacha intenciones (`REQUEST_DICE_ROLL`, `SUBMIT_MOVE_INTENT`).
   - El backend valida el turno, la temporización, el estado actual de la máquina de estados y despacha el evento confirmado.
3. **Protección contra DevTools / Memory Manipulation:**
   - La alteración de variables en `window`, `localStorage` o `sessionStorage` solo afecta el render local del usuario.
   - Si una acción local no coincide con la máquina de estados del servidor, el servidor responde con `INVALID_STATE` y emite un `FORCE_RECONCILE`.

---

## 2. Blindaje Financiero y Protección de Saldos

1. **Escritura Directa Bloqueada en Firestore:**
   - Las colecciones `/wallets/{uid}`, `/transactions/{txId}`, `/system_treasury/*` y `/audit_logs/*` tienen `allow write: if false;` en las reglas de seguridad de cliente.
   - Solo el servidor backend mediante el Firebase Admin SDK autenticado puede modificar balances o registrar transacciones.
2. **Transacciones Atómicas de Doble Entrada:**
   - Todo movimiento de saldo se realiza dentro de `adminDb.runTransaction()` con verificación previa de saldo disponible (`balance >= amount`).
   - Registro inmutable en el ledger de auditoría con `balanceBefore`, `balanceAfter`, `referenceId` y `serverTimestamp()`.
3. **Manejo de Moneda en Céntimos Enteros:**
   - Toda cifra monetaria se almacena como entero (ej. `amountCents: 1000` para $10.00 USDT / 1,000 Sugar Coins) para evitar errores de precisión IEEE-754.

---

## 3. Reglas de Seguridad de Firestore (RBAC & Validación de Esquema)

### 3.1 Roles y Custom Claims
Los roles (`super_admin`, `cashier`, `player`) se gestionan exclusivamente mediante **Firebase Auth Custom Claims** en el backend:
```typescript
await adminAuth.setCustomUserClaims(uid, { role: 'super_admin' });
```

### 3.2 Matriz de Permisos en `firestore.rules`
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuthenticated() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    function hasRole(role) {
      return isAuthenticated() && request.auth.token.role == role;
    }
    function isSuperAdmin() {
      return hasRole('super_admin');
    }
    function isCashier() {
      return hasRole('cashier') || isSuperAdmin();
    }

    // 1. Usuarios: el usuario no puede alterar su rol ni su saldo
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow create: if isOwner(userId) && 
                       request.resource.data.role == 'player' &&
                       !('balance' in request.resource.data);
      allow update: if (isOwner(userId) && 
                       !request.resource.data.diff(resource.data).affectedKeys()
                         .hasAny(['role', 'balance', 'coins', 'isBanned', 'isFrozen'])) 
                    || isSuperAdmin();
      allow delete: if isSuperAdmin();
    }

    // 2. Billeteras y Transacciones: 100% blindadas contra SDKs cliente
    match /wallets/{userId} {
      allow read: if isOwner(userId) || isCashier();
      allow write: if false; // Solo Admin SDK
    }
    match /transactions/{txId} {
      allow read: if isAuthenticated() && (resource.data.userId == request.auth.uid || isCashier());
      allow write: if false; // Inmutable desde el cliente
    }

    // 3. Órdenes de Cajero P2P
    match /cashier_orders/{orderId} {
      allow read: if isAuthenticated() && (
        resource.data.userId == request.auth.uid || 
        resource.data.cashierId == request.auth.uid || 
        isCashier()
      );
      allow create: if isAuthenticated() && 
                       request.resource.data.userId == request.auth.uid &&
                       request.resource.data.amount is int &&
                       request.resource.data.status == 'pending';
      allow update: if isAuthenticated() && (
        (isOwner(resource.data.userId) && 
         request.resource.data.diff(resource.data).affectedKeys().hasOnly(['status', 'cancelledAt']) &&
         resource.data.status == 'pending' && request.resource.data.status == 'cancelled') ||
        (isCashier() && request.auth.uid == resource.data.cashierId) ||
        isSuperAdmin()
      );
    }

    // 4. Tesorería y Auditoría
    match /system_treasury/{docId} {
      allow read, write: if isSuperAdmin();
    }
    match /audit_logs/{docId} {
      allow read: if isSuperAdmin();
      allow write: if false; // Solo Admin SDK
    }
  }
}
```

---

## 4. Mecanismos Anti-Cheat: Dado Criptográfico Provably Fair

Para partidas competitivas con saldo, el dado se calcula bajo el modelo **Commit-Reveal**:
1. **Compromiso previo:** El servidor genera un `serverSeed` aleatorio (CSPRNG), calcula `commitHash = SHA256(serverSeed + nonce)` y se lo envía a los clientes antes de iniciar la ronda.
2. **Entropía del cliente:** El cliente envía su `clientSeed`.
3. **Cálculo verificable:**
   ```typescript
   import crypto from 'crypto';

   export function calculateProvablyFairDice(serverSeed: string, clientSeed: string, nonce: number): number {
     const message = `${clientSeed}:${nonce}`;
     const hmac = crypto.createHmac('sha256', serverSeed).update(message).digest('hex');
     const decimalValue = parseInt(hmac.substring(0, 8), 16);
     return (decimalValue % 6) + 1;
   }
   ```
4. **Auditoría final:** Al concluir la partida, el servidor revela el `serverSeed` para que cualquier jugador verifique que los resultados fueron matemáticamente inalterables.

---

## 5. Seguridad Web (XSS, CSRF, CSP & Prototype Pollution)

1. **Cabeceras CSP Estrictas en `middleware.ts`:**
   - Generación de `x-nonce` criptográfico por solicitud para scripts.
   - `frame-ancestors 'none'` para evitar clickjacking.
   - `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin`.
2. **Sanitización de Texto y URLs:**
   - Prohibido el uso de `dangerouslySetInnerHTML` sin pasar por `DOMPurify`.
   - Validación estricta de URLs de avatares/enlaces externos permitiendo solo protocolos `https:`.
3. **Protección contra Prototype Pollution:**
   - Usar esquemas `zod` estrictos (`.strict()`) para descartar claves arbitrarias en el payload JSON.
   - Usar `Map` o `Object.create(null)` para colecciones dinámicas de sesiones/jugadores en memoria.
