import { auth } from './firebase.ts'

/**
 * Helper de cliente para generar los encabezados Authorization Bearer
 * con el JWT ID Token legítimo de Firebase Auth.
 * Criptográficamente verificado en el servidor con Firebase Admin SDK.
 * Seguro para Client Components de React ('use client').
 */
export function getStaffAuthHeaders(_overrideRole?: 'cashier' | 'admin' | string): Record<string, string> {
  if (typeof window !== 'undefined') {
    try {
      const token = sessionStorage.getItem('sugar_staff_id_token') || localStorage.getItem('sugar_staff_id_token')
      if (token) {
        return {
          Authorization: `Bearer ${token}`
        }
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
export async function getStaffAuthHeadersAsync(_overrideRole?: 'cashier' | 'admin' | string): Promise<Record<string, string>> {
  // Intentar sincronamente primero
  const syncHeaders = getStaffAuthHeaders(_overrideRole)
  if (syncHeaders.Authorization) {
    return syncHeaders
  }

  if (typeof window !== 'undefined') {
    try {
      // Si Firebase Auth ya tiene currentUser o está inicializándose
      if (auth && auth.currentUser) {
        const freshToken = await auth.currentUser.getIdToken()
        if (freshToken) {
          try {
            sessionStorage.setItem('sugar_staff_id_token', freshToken)
            localStorage.setItem('sugar_staff_id_token', freshToken)
          } catch {}
          return {
            Authorization: `Bearer ${freshToken}`
          }
        }
      }
    } catch {}
  }

  return {}
}
