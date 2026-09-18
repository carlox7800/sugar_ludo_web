/**
 * Helper de cliente para generar los encabezados Authorization Bearer
 * con la sesión activa del Staff (Cajero o Administrador).
 * Seguro para Client Components de React ('use client').
 */
export function getStaffAuthHeaders(overrideRole?: string): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    // 1. Sesión de Administrador
    const adminSession = localStorage.getItem('sugar_admin_session')
    if (adminSession) {
      const parsed = JSON.parse(adminSession)
      if (parsed?.uid) {
        const tokenPayload = {
          uid: parsed.uid,
          role: overrideRole || parsed.role || 'admin',
          email: parsed.email || '',
          name: parsed.displayName || parsed.username || 'Admin',
          timestamp: Date.now()
        }
        const token = btoa(JSON.stringify(tokenPayload))
        return {
          Authorization: `Bearer ${token}`
        }
      }
    }

    // 2. Sesión de Cajero
    const cashierSession = localStorage.getItem('sugar_cashier_session')
    if (cashierSession) {
      const parsed = JSON.parse(cashierSession)
      if (parsed?.uid) {
        const tokenPayload = {
          uid: parsed.uid,
          role: overrideRole || 'cashier',
          email: parsed.email || '',
          name: parsed.name || 'Cajero',
          timestamp: Date.now()
        }
        const token = btoa(JSON.stringify(tokenPayload))
        return {
          Authorization: `Bearer ${token}`
        }
      }
    }
  } catch {}
  return {}
}
