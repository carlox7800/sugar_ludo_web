---
name: fintech-treasury-expert
description: Gestión de tesorería, matemática financiera, comisiones 5%/10%, prevención de doble gasto, control de saldo flotante de cajeros y conciliación global en Sugar Ludo.
---

# Fintech & Treasury Expert (Sugar Ludo)

Esta guía define las ecuaciones de solvencia, reglas de doble contabilidad, cálculo exacto de comisiones y algoritmos de conciliación patrimonial para Sugar Ludo.

---

## 1. Ecuaciones Maestras de Solvencia e Invariantes

En toda transacción atómica deben cumplirse estrictamente los siguientes invariantes:

### Invariante 1: Principio de Doble Entrada (Conservación de Valor)
$$\sum \Delta \text{Débitos} = \sum \Delta \text{Créditos} \iff \Delta \text{Activos} = \Delta \text{Pasivos} + \Delta \text{Patrimonio}$$

### Invariante 2: Ecuación Global de Solvencia de la Bóveda
$$\text{Bóveda Total del Sistema (USDT)} = \sum \text{Saldos Jugadores} + \sum \text{Flotantes Cajeros} + \text{Ganancias Netas Plataforma}$$
- **Saldos Jugadores (Pasivo/Custodia):** $\text{Sugar Coins Disponibles} + \text{Sugar Coins en Escrow}$.
- **Flotantes Cajeros (Activo Operativo):** Fondos USDT asignados a cajeros para liquidación P2P.
- **Ganancias Netas Plataforma (Patrimonio):** Rake de mesas + Ventas de tienda cosmética + Margen de torneos + Comisiones de retiro (5% Estándar / 10% VIP).

### Invariante 3: No Sobregiro (Non-Negative Balances)
$$\forall p \in \text{Jugadores}: \text{SaldoDisponible}_p \ge 0 \quad \text{y} \quad \text{EscrowLocked}_p \ge 0$$
$$\forall c \in \text{Cajeros}: \text{SaldoFlotanteUSDT}_c \ge 0$$

---

## 2. Cálculo Exacto de Comisiones y Aritmética de Punto Fijo

Para prevenir fugas por redondeo de punto flotante en JavaScript (IEEE-754), todos los cálculos financieros usan **Puntos Básicos (BPS)** y unidades enteras:
- **Unidad base:** $1.00\text{ USDT} = 100\text{ Céntimos} = 100\text{ Sugar Coins}$.
- **Tarifas en BPS:**
  - Retiro Estándar (hasta 48h): $5\% = 500\text{ BPS}$
  - Retiro VIP (hasta 12h): $10\% = 1000\text{ BPS}$

```typescript
export interface CommissionBreakdown {
  grossAmountCoins: number;
  feeCoins: number;
  netPayoutCoins: number;
  grossAmountUSD: number;
  feeUSD: number;
  netPayoutUSD: number;
  rateBps: number;
}

export function calculateWithdrawalCommission(
  grossAmountCoins: number,
  isVip: boolean
): CommissionBreakdown {
  if (!Number.isInteger(grossAmountCoins) || grossAmountCoins <= 0) {
    throw new Error('El monto bruto debe ser un entero positivo (céntimos/coins)');
  }

  const rateBps = isVip ? 1000 : 500;
  const feeCoins = Math.round((grossAmountCoins * rateBps) / 10000);
  const netPayoutCoins = grossAmountCoins - feeCoins; // Invariante: fee + net === gross

  return {
    grossAmountCoins,
    feeCoins,
    netPayoutCoins,
    grossAmountUSD: grossAmountCoins / 100,
    feeUSD: feeCoins / 100,
    netPayoutUSD: netPayoutCoins / 100,
    rateBps
  };
}
```

---

## 3. Prevención de Doble Gasto y Transacciones Atómicas

1. **Regla Lectura Antes de Escritura (Firestore OCC):**
   - En `adminDb.runTransaction(async (tx) => { ... })`, todas las llamadas `tx.get()` deben ejecutarse antes de cualquier `tx.set()` o `tx.update()`.
2. **Candado de Idempotencia:**
   - Cada orden financiera lleva un `idempotencyKey` determinista (`order_wit_${orderId}_settle`).
   - Si la clave ya existe con estado `COMMITTED`, se retorna el resultado cacheado sin volver a debitar.
3. **Flujo de Escrow en Dos Fases:**
   - **Fase 1 (Retención):** Al solicitar un retiro, el saldo pasa de `coins` a `escrowLockedCoins`. El jugador no puede apostarlo ni retirarlo de nuevo.
   - **Fase 2 (Liquidación / Disputa):**
     * *Liquidación normal:* El cajero transfiere USDT $\rightarrow$ se quema `escrowLockedCoins`, se deduce el flotante del cajero y se acredita la comisión a la plataforma.
     * *Disputa a favor del jugador:* El Super Admin desbloquea el escrow devolviéndolo a `coins`.
     * *Disputa a favor del cajero:* El Super Admin libera el pago y descuenta el escrow.

---

## 4. Control de Saldo Flotante del Cajero y Arqueo de Caja

1. **Guardia Previa de Sobregiro:**
   - Antes de procesar una orden de retiro, verificar atómicamente: `cashier.floatBalanceUSDT >= netPayoutUSD`. Si no alcanza, rechazar con `FLOAT_INSUFFICIENT`.
2. **Ecuación de Cierre de Turno (Arqueo):**
$$\text{Flotante Final} = \text{Flotante Inicial} + \text{Recargas} + \text{Depósitos Recibidos} - \text{Retiros Desembolsados}$$
3. **Historial de Movimientos (`cashier_shifts_ledger`):**
   - Cada recarga, aceptación de depósito o pago de retiro genera una entrada inmutable con `previousFloat` y `newFloat`.

---

## 5. Motor de Conciliación Patrimonial Automática

El sistema ejecuta una auditoría de balance para garantizar que no existan discrepancias entre la bóveda global y la suma de usuarios/cajeros:

```typescript
export async function runTreasuryReconciliation(): Promise<boolean> {
  const ledgerSnap = await adminDb.collection('system_treasury').doc('global_ledger').get();
  const totalVaultUSD = Number(ledgerSnap.data()?.totalVaultUSD || 0);
  const houseNetProfitsUSD = Number(ledgerSnap.data()?.houseNetProfitsUSD || 0);

  // Sumar saldos de jugadores
  const usersSnap = await adminDb.collection('users').get();
  let totalPlayerUSD = 0;
  usersSnap.forEach(d => {
    totalPlayerUSD += (Number(d.data().coins || 0) + Number(d.data().escrowLockedCoins || 0)) / 100;
  });

  // Sumar flotantes de cajeros
  const cashiersSnap = await adminDb.collection('cashier_profiles').get();
  let totalCashierFloatUSD = 0;
  cashiersSnap.forEach(d => {
    totalCashierFloatUSD += Number(d.data().floatBalanceUSDT || 0);
  });

  const totalObligations = totalPlayerUSD + totalCashierFloatUSD + houseNetProfitsUSD;
  const imbalanceUSD = Math.abs(totalVaultUSD - totalObligations);

  if (imbalanceUSD > 0.01) {
    console.error(`[CRITICAL TREASURY ALERT] Desbalance de $${imbalanceUSD.toFixed(2)} USDT detectado`);
    return false;
  }
  return true;
}
```
