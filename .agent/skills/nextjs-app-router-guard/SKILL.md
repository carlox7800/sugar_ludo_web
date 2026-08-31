---
name: nextjs-app-router-guard
description: Buenas prácticas y candados técnicos para Next.js 16+ App Router, SSR, prevención de Hydration Mismatches (error 418/423) y compatibilidad Turbopack en el monorepositorio Sugar Ludo.
---

# Next.js App Router & Hydration Guard (Sugar Ludo)

Esta skill establece las directrices obligatorias para el desarrollo en sugar-ludo-web y sugar-ludo-admin-hub.

## 1. Prevención Estricta de Hydration Mismatches (React 18/19 & Next.js 16)
- **Regla de Oro:** El HTML generado en SSR (servidor) debe coincidir exactamente con el render inicial del cliente.
- **Acceso a APIs del Navegador:** localStorage, sessionStorage, window, document, 
avigator y cachés en memoria de cliente NUNCA deben ejecutarse directamente dentro del cuerpo síncrono del componente ni en useState(() => localStorage.getItem(...)).
- **Patrón de Montaje Seguro (isMounted):**
  `	sx
  const [isMounted, setIsMounted] = useState(false)
  useEffect(() => {
    setIsMounted(true)
  }, [])
  // Si depende exclusivamente de datos de cliente/navegador:
  if (!isMounted) return null // o Skeleton idéntico a SSR
  `
- **Textos y Fechas Dinámicas:**
  - En elementos donde la hora, fecha relativa o turnos de sesión puedan diferir ligeramente entre SSR y cliente, usar la propiedad suppressHydrationWarning.

## 2. Directiva 'use client'
- Incluir 'use client' en la cabecera de todo componente o pantalla que use hooks (useState, useEffect, useRef), contextos de React o manejadores de eventos (onClick, onChange).

## 3. Verificación de Compilaciones Limpias (Windows / PowerShell)
- Siempre validar la compilación limpia de ambos proyectos tras cambios significativos:
  - En la app del juego: cmd /c  npm run build (en raíz).
  - En el hub administrativo: cmd /c npm run build (en sugar-ludo-admin-hub/).
- Verificar que no existan advertencias críticas de módulos no encontrados ni errores de TypeScript.
