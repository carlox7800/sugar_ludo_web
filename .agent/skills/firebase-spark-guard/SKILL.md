---
name: firebase-spark-guard
description: Reglas de oro y candados de consumo para mantener estrictamente el Plan Gratuito Spark (.00/mes) en Firebase Firestore en Sugar Ludo.
---

# Firebase Spark (.00) Guard (Sugar Ludo)

Esta skill garantiza que la arquitectura mantenga costo cero absoluto sin superar las cuotas del Spark Plan (50,000 lecturas/día, 20,000 escrituras/día).

## 1. Reglas de Consulta a Firestore
- **Límites Obligatorios:** NUNCA realizar consultas abiertas sin límite. Toda consulta onSnapshot o getDocs debe incluir limit(...) (ej. limit(50)).
- **Subscripciones Restringidas:** Un solo listener onSnapshot por vista activa. Siempre limpiar la suscripción en el return de useEffect.
- **Cero Consultas en Bucle:** Jamás hacer polling repetitivo sobre Firestore.

## 2. Capa de Mensajería en Memoria / Relay Social
- Para eventos en tiempo real entre jugadores (retos, invitaciones de amigos, presencia online, actualización de órdenes en red local), usar siempre:
  1. BroadcastChannel local (sugar_ludo_social_channel).
  2. Endpoints de servidor en memoria (/api/social/event / SSE).
- **No escribir en Firestore** para eventos efímeros que no requieran persistencia financiera o de cuenta.

## 3. Caché Local y Actualización Optimista
- Utilizar OrdersCache y localStorage para hidratar la UI de forma instantánea antes de esperar respuestas remotas.
- Las órdenes P2P deben actualizar su estado localmente de inmediato al emitir o recibir eventos.
