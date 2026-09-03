---
name: firestore-spark-optimizer
description: Protocolos y técnicas de reducción de lecturas/escrituras para operar bajo la cuota gratuita Spark ($0.00/mes) en Firebase Firestore.
---

# Firestore Spark Optimizer (Sugar Ludo)

Esta guía detalla las técnicas avanzadas para mantener el consumo de Firebase Firestore estrictamente dentro de los límites del Plan Gratuito Spark: **50,000 lecturas/día**, **20,000 escrituras/día**, **1 GB de almacenamiento** y **10 GB/mes de ancho de banda**.

---

## 1. Límites y Realidad Operativa del Plan Spark

Superar las cuotas en el Plan Spark provoca el error inmediato `RESOURCE_EXHAUSTED` (HTTP 429), bloqueando las operaciones hasta el reinicio diario a medianoche (PST).

| Recurso | Límite Gratuito Diario | Estrategia de Mitigación |
| :--- | :--- | :--- |
| **Lecturas** | 50,000 / día | Documentos compuestos, caché IndexedDB, `limit(50)`, un solo listener por vista. |
| **Escrituras** | 20,000 / día | Zero-writes para eventos efímeros, batching con `writeBatch()`, documentos de resumen acumulado. |
| **Escrituras por doc** | 1 / segundo | Desacoplar eventos de interfaz a `BroadcastChannel` o memoria. |

---

## 2. Estrategias de Reducción de Lecturas

### 2.1 Documentos Compuestos (Single-Doc State)
* **Anti-patrón:** Subcolecciones para turnos de partida (`/games/{id}/turns/{turnId}`). 40 turnos $\times$ 4 jugadores = 160 lecturas por partida. Con 250 partidas se agota el 100% de la cuota diaria.
* **Patrón Optimizado:** El estado completo de la partida (posiciones de fichas de los 4 o 6 jugadores, turno actual, dado y temporizador) se almacena en el documento raíz `games/{id}`. Cada jugador mantiene un único listener sobre ese documento.

### 2.2 Desnormalización Estratégica
* Duplicar datos inmutables de consulta frecuente (nombre, avatar y badge del cajero y del jugador) dentro de la orden `cashier_orders/{orderId}` para no requerir lecturas adicionales a `/users/{uid}`.

### 2.3 Consultas de Conteo Eficientes
* Usar `getCountFromServer(q)` en lugar de `getDocs(q)` para métricas globales (ej. Total de órdenes históricas). `getCountFromServer` cobra **1 lectura por cada 1,000 documentos** indexados en lugar de 1 lectura por documento.

---

## 3. Estrategias de Reducción de Escrituras

### 3.1 Cero Escrituras para Estados Efímeros
* **Estrictamente Prohibido escribir en Firestore:**
  - Animaciones de dados o arrastre de fichas.
  - Indicadores de escritura o typing en chats.
  - Chat de partida efímero (usar WebRTC DataChannel o relay en memoria).
  - Presencia en vivo y latencia (usar Firebase RTDB `onDisconnect` o relay en memoria).

### 3.2 Documentos de Acumulación Diaria (Rollup Ledger)
* En lugar de que el panel de administración consulte miles de transacciones para calcular los ingresos del día, se mantiene un documento `system_treasury/daily_summary_YYYY-MM-DD` actualizado mediante `FieldValue.increment()`.
* Cargar el dashboard del admin cuesta **1 sola lectura** en lugar de miles.

---

## 4. Optimización de Listeners (`onSnapshot`)

### 4.1 Reglas de Oro de Suscripción
1. **Límites obligatorios:** Toda consulta en tiempo real debe tener `limit(N)` (ej. `limit(20)` o `limit(50)`).
2. **Ciclo de vida estricto en React:** Siempre almacenar y ejecutar la función de desuscripción devuelta por `onSnapshot` en el cleanup de `useEffect`.
3. **Pausa por visibilidad de pestaña:** Desconectar listeners cuando `document.visibilityState === 'hidden'` y reconectar al enfocar la pestaña.

```typescript
useEffect(() => {
  if (!roomId) return;
  let unsubscribe: (() => void) | null = null;

  const startListener = () => {
    if (document.hidden) return;
    const q = query(collection(db, 'rooms'), where('status', '==', 'open'), limit(20));
    unsubscribe = onSnapshot(q, (snapshot) => {
      // Procesar datos
    });
  };

  const handleVisibility = () => {
    if (document.hidden) {
      if (unsubscribe) { unsubscribe(); unsubscribe = null; }
    } else {
      startListener();
    }
  };

  startListener();
  document.addEventListener('visibilitychange', handleVisibility);

  return () => {
    if (unsubscribe) unsubscribe();
    document.removeEventListener('visibilitychange', handleVisibility);
  };
}, [roomId]);
```

---

## 5. Capa de Mensajería en Memoria (`BroadcastChannel`)

Para sincronización entre pestañas en el mismo navegador (ej. panel de cajero + app de jugador) sin consumir lecturas de Firestore:
```typescript
const socialChannel = new BroadcastChannel('sugar_ludo_social_channel');

export function emitLocalEvent(type: string, payload: any) {
  socialChannel.postMessage({ type, payload, timestamp: Date.now() });
}
```

---

## 6. Paginación por Cursor (`startAfter`) vs Offset

* **Prohibido usar `offset(N)`:** `offset(200)` cobra 220 lecturas de Firestore aunque solo se muestren 20 resultados.
* **Obligatorio usar `startAfter(lastDocSnapshot)`:** Solo se facturan exactamente los documentos retornados en la página solicitada.
