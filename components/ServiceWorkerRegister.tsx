'use client'

import { useEffect } from 'react'

/**
 * Registrador diferido de Service Worker para PWA.
 * Se suscribe en el evento 'load' de la ventana para no competir con el
 * First Contentful Paint (FCP) ni con los recursos críticos de la carga inicial.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }

    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          // Si hay un nuevo service worker esperando, invocar skipWaiting
          registration.onupdatefound = () => {
            const installingWorker = registration.installing
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[SW] Nueva versión de Sugar Ludo disponible.')
                }
              }
            }
          }
        })
        .catch((error) => {
          console.warn('[SW] Error al registrar Service Worker:', error)
        })
    }

    if (document.readyState === 'complete') {
      registerSW()
    } else {
      window.addEventListener('load', registerSW, { once: true })
      return () => window.removeEventListener('load', registerSW)
    }
  }, [])

  return null
}
