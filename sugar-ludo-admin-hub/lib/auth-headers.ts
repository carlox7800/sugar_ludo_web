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
