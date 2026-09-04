import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Copiado al portapapeles universal, seguro y 100% silencioso.
 * Evita que el navegador o WebView dispare alertas invasivas del sistema ("Acceder a otras aplicaciones y servicios").
 */
export async function copyToClipboardSilently(text: string): Promise<boolean> {
  if (typeof window === 'undefined' || !text) return false

  // 1. Prioridad: DOM nativo visible en viewport pero 100% transparente para evitar rechazo de foco
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', '')
    // Mantener dentro del viewport para evitar que el navegador rechace el comando de foco
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '1px'
    textArea.style.height = '1px'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.style.opacity = '0.01'
    textArea.style.zIndex = '-9999'
    textArea.style.pointerEvents = 'none'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    textArea.setSelectionRange(0, text.length)
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    if (successful) return true
  } catch {}

  // 2. Solo intentar navigator.clipboard si la API de permisos indica que ya está concedido o no requiere prompt
  try {
    if (typeof navigator !== 'undefined' && 'clipboard' in navigator && navigator.clipboard?.writeText) {
      // Verificar permisos si la API de query está disponible para no detonar el modal del navegador
      if (typeof (navigator as any).permissions?.query === 'function') {
        try {
          const perm = await (navigator as any).permissions.query({ name: 'clipboard-write' })
          if (perm.state === 'granted') {
            await navigator.clipboard.writeText(text)
            return true
          }
          // Si está en 'prompt' o 'denied', no forzar navigator.clipboard para no mostrar modal molesto
          return false
        } catch {
          // Si permissions.query falla, no forzamos navigator.clipboard en producción
          return false
        }
      }
    }
  } catch {}

  return false
}

