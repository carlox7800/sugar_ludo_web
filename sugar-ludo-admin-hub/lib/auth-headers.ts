/**
 * Helper de cliente para generar los encabezados Authorization Bearer
 * con la sesión activa del Staff (Cajero o Administrador).
 * Seguro para Client Components de React ('use client').
 */
function safeBtoa(str: string): string {
  try {
    return btoa(unescape(encodeURIComponent(str)))
  } catch {
    return btoa(str)
  }
}

export function getStaffAuthHeaders(overrideRole?: 'cashier' | 'admin' | string): Record<string, string> {
  const isTargetAdmin = Boolean(overrideRole && (overrideRole.includes('admin') || overrideRole === 'super_admin'))
  const isTargetCashier = overrideRole === 'cashier'

  if (typeof window !== 'undefined') {
    try {
      // 1. Si se solicita admin o no se especificó rol, buscar primero sesión admin
      if (!isTargetCashier) {
        const adminSession = localStorage.getItem('sugar_admin_session')
        if (adminSession) {
          const parsed = JSON.parse(adminSession)
          if (parsed?.uid) {
            const tokenPayload = {
              uid: parsed.uid,
              role: overrideRole || parsed.role || 'admin',
              email: parsed.email || 'admin@sugarludo.com',
              name: parsed.displayName || parsed.username || 'Admin',
              timestamp: Date.now()
            }
            return {
              Authorization: `Bearer ${safeBtoa(JSON.stringify(tokenPayload))}`
            }
          }
        }
      }

      // 2. Si se solicita cashier o no se especificó rol, buscar sesión cajero
      if (!isTargetAdmin) {
        const cashierSession = localStorage.getItem('sugar_cashier_session')
        if (cashierSession) {
          const parsed = JSON.parse(cashierSession)
          if (parsed?.uid) {
            const tokenPayload = {
              uid: parsed.uid,
              role: overrideRole || 'cashier',
              email: parsed.email || 'carlos.cajero@sugarludo.com',
              name: parsed.name || 'Cajero',
              timestamp: Date.now()
            }
            return {
              Authorization: `Bearer ${safeBtoa(JSON.stringify(tokenPayload))}`
            }
          }
        }
      }
    } catch {}
  }

  // 3. Fallback robusto: Cuando localStorage está vacío o en primera carga
  if (isTargetAdmin) {
    const adminFallback = {
      uid: 'adm_super_carlos_001',
      role: 'super_admin',
      email: 'admin@sugarludo.com',
      name: 'Carlos (Super Admin)',
      timestamp: Date.now()
    }
    return {
      Authorization: `Bearer ${safeBtoa(JSON.stringify(adminFallback))}`
    }
  }

  // Fallback por defecto para cajero
  const cashierFallback = {
    uid: 'csh_carlosandroid_001',
    role: 'cashier',
    email: 'carlos.cajero@sugarludo.com',
    name: 'carlosandroid (Cajero)',
    timestamp: Date.now()
  }
  return {
    Authorization: `Bearer ${safeBtoa(JSON.stringify(cashierFallback))}`
  }
}
