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

  // 1. Prioridad: Fallback DOM sincrónico tradicional (No requiere permisos de SO ni activa prompts)
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.top = '-9999px'
    textArea.style.left = '-9999px'
    textArea.style.opacity = '0'
    textArea.style.pointerEvents = 'none'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    if (successful) return true
  } catch {}

  // 2. Fallback secundario si execCommand no estuviera disponible
  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}

  return false
}
