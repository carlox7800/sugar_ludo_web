---
name: react-nextjs-architect
description: Arquitectura de componentes en Next.js 16+ App Router, prevención de hydration mismatch (error 418/423), manejo de modales sin error 310, UI optimista y optimización Turbopack.
---

# React & Next.js 16+ Architect (Sugar Ludo)

Esta guía define las directrices de arquitectura modular de frontend para Next.js 16+ (App Router), React 19 y Turbopack en los paneles administrativos y app del juego.

---

## 1. Jerarquía de Componentes y Límite Servidor/Cliente

1. **Diseño Atómico Estructurado:**
   - **Átomos (`components/ui/`):** Botones, Badges, Modales base, Inputs.
   - **Moléculas (`components/molecules/`):** Filtros con barra de búsqueda, tarjetas de métricas individuales.
   - **Organismos (`components/organisms/` / `components/admin/`):** Tablas de órdenes en vivo, panel de chat dual, modal de arqueo de caja.
2. **Regla de Oro de `'use client'`:**
   - Empujar `'use client'` a las hojas del árbol. No marcar páginas completas como cliente si solo un botón o gráfico interactivo requiere estado local.
   - Pasar componentes de servidor como `children` a contenedores cliente para evitar empaquetar código innecesario en el bundle.

---

## 2. Prevención de Hydration Mismatch (Errores #418 y #423)

### 2.1 Causas Comunes
- Acceder a `localStorage`, `sessionStorage`, `window` o `navigator` durante la inicialización de estado de un componente renderizado en SSR.
- Uso de `new Date().toLocaleTimeString()` o fechas relativas en el servidor.
- Generación de IDs no deterministas con `Math.random()`.

### 2.2 Patrones de Solución
- **Para almacenamiento local:** Utilizar `useSyncExternalStore` con un snapshot seguro para SSR en lugar de `useState(() => localStorage.getItem(...))`.
- **Para IDs accesibles:** Usar el hook de React 19 `useId()`.
- **Para componentes 100% cliente:** Usar el patrón `<ClientOnly fallback={<Skeleton />}>{children}</ClientOnly>`.

---

## 3. Manejo de Modales y Diálogos sin Error #310 de React

El **Error #310** ("Rendered fewer hooks than expected") ocurre cuando un componente modal contiene `useState` o `useEffect` después de un retorno condicional temprano (`if (!isOpen) return null;`).

### Patrón Obligatorio: Separación Shell / Content
Dividir el modal en dos componentes:
1. **Shell (Contenedor ligero):** Evalúa la visibilidad sin alterar el orden de hooks.
2. **Content (Componente de contenido):** Se monta únicamente cuando el modal está abierto y ejecuta todos sus hooks de forma incondicional desde el montaje.

```tsx
// Shell: No altera el orden de hooks
export function CashierOrderModal({ isOpen, orderId, onClose }: ModalProps) {
  if (!isOpen || !orderId) return null;
  return <CashierOrderModalContent orderId={orderId} onClose={onClose} />;
}

// Content: Todos los hooks se ejecutan incondicionalmente
function CashierOrderModalContent({ orderId, onClose }: { orderId: string; onClose: () => void }) {
  const [tab, setTab] = useState<'info' | 'chat'>('info');
  const [comment, setComment] = useState('');
  // ... lógica completa
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      {/* Contenido modal */}
    </div>
  );
}
```

---

## 4. UI Optimista y Prevención de Envíos Dobles

1. **Prevención de Envíos Dobles:**
   - Todo botón de acción crítica o formulario financiero debe utilizar `isSubmittingRef` o `useActionState` con `pending` deshabilitando el botón de inmediato.
2. **UI Optimista para Mensajes y Notificaciones:**
   - En el chat de soporte o difusión, el mensaje se añade inmediatamente a la lista con un ID temporal `temp-${uuid}` y estado `pending`, sincronizándose de forma transparente al confirmarse en Firestore.

---

## 5. Gestión de Badges y Notificaciones Multi-Pestaña

Para reflejar avisos numéricos no leídos entre distintas pestañas abiertas sin generar lecturas adicionales de Firestore:
- Usar eventos de `sugar_ludo_social_channel` con `BroadcastChannel` para notificar incrementos y lecturas de mensajes en tiempo real.

---

## 6. Configuración de Turbopack en `next.config.mjs`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', 'clsx', 'tailwind-merge'],
  },
  turbopack: {
    // Reglas de empaquetado ultra-rápido para desarrollo y producción
  },
};

export default nextConfig;
```
