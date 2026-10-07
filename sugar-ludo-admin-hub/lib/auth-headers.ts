import { auth } from './firebase.ts'

function injectStaffSessionMetadata(headers: Record<string, string>, overrideRole?: 'cashier' | 'admin' | string): Record<string, string> {
  if (typeof window === 'undefined') return headers
  try {
    const adminSession = localStorage.getItem('sugar_admin_session')
    if (adminSession) {
      const parsed = JSON.parse(adminSession)
      if (parsed.uid) headers['X-Staff-Uid'] = parsed.uid
      if (parsed.email) headers['X-Staff-Email'] = parsed.email
      if (parsed.role) headers['X-Staff-Role'] = parsed.role
      return headers
    }
    const cashierSession = localStorage.getItem('sugar_cashier_session')
    if (cashierSession) {
      const parsed = JSON.parse(cashierSession)
      if (parsed.uid) headers['X-Staff-Uid'] = parsed.uid
      if (parsed.email) headers['X-Staff-Email'] = parsed.email
      headers['X-Staff-Role'] = 'cashier'
      return headers
    }
  } catch {}
  if (overrideRole) {
    headers['X-Staff-Role'] = overrideRole
  }
  return headers
}

/**
 * Helper de cliente para generar los encabezados Authorization Bearer
 * con el JWT ID Token legítimo de Firebase Auth y metadatos de sesión para el servidor.
 * Criptográficamente verificado en el servidor con Firebase Admin SDK.
 * Seguro para Client Components de React ('use client').
 */
export function getStaffAuthHeaders(overrideRole?: 'cashier' | 'admin' | string): Record<string, string> {
  if (typeof window !== 'undefined') {
    try {
      const token = sessionStorage.getItem('sugar_staff_id_token') || localStorage.getItem('sugar_staff_id_token')
      if (token) {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${token}`
        }
        return injectStaffSessionMetadata(headers, overrideRole)
      }
    } catch {}
  }

  // Si no hay sesión activa en el cliente, no se envían encabezados ficticios.
  return {}
}

/**
 * Helper asíncrono robusto para clientes frontend:
 * 1. Lee el token almacenado en sessionStorage / localStorage.
 * 2. Si aún no está en storage (ej. carrera al montar el componente en refresh),
 *    espera activamente el ID token de auth.currentUser o resuelve de Firebase Auth.
 * 3. Si se obtiene, refresca los storages locales para llamadas subsiguientes.
 */
export async function getStaffAuthHeadersAsync(overrideRole?: 'cashier' | 'admin' | string): Promise<Record<string, string>> {
  // Intentar sincronamente primero
  const syncHeaders = getStaffAuthHeaders(overrideRole)
  if (syncHeaders.Authorization) {
    return syncHeaders
  }

  if (typeof window !== 'undefined') {
    try {
      // Esperar a que Firebase Auth restaure la sesión (evita 401 por carrera) con tope de 4s
      if (auth && typeof (auth as any).authStateReady === 'function') {
        await Promise.race([
          (auth as any).authStateReady(),
          new Promise((resolve) => setTimeout(resolve, 4000))
        ])
      }
      if (auth && auth.currentUser) {
        const freshToken = await auth.currentUser.getIdToken(true)
        if (freshToken) {
          try {
            sessionStorage.setItem('sugar_staff_id_token', freshToken)
            localStorage.setItem('sugar_staff_id_token', freshToken)
          } catch {}
          const headers: Record<string, string> = {
            Authorization: `Bearer ${freshToken}`
          }
          return injectStaffSessionMetadata(headers, overrideRole)
        }
      }
    } catch {}
  }

  return {}
}
