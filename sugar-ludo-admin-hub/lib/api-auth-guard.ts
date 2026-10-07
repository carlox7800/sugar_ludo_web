import { NextResponse } from 'next/server.js'
import { adminAuth, adminDb, hasAdminCredentials } from './firebase-admin.ts'
import { db } from './firebase.ts'
import { doc, getDoc } from 'firebase/firestore'

export type StaffRole = 'cashier' | 'admin' | 'super_admin' | 'financial_admin' | 'support_admin'

export interface AuthenticatedStaffUser {
  uid: string
  role: StaffRole | string
  email?: string
  name?: string
}

export interface AuthVerificationResult {
  authorized: boolean
  errorResponse?: NextResponse
  user?: AuthenticatedStaffUser
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

/**
 * Valida si un rol específico cumple con los roles requeridos.
 * Los roles con prefijo admin (admin, super_admin, financial_admin, support_admin)
 * satisfacen el requerimiento cuando se solicita 'admin'.
 */
function roleMatches(userRole: string, allowedRoles: StaffRole[]): boolean {
  const normalizedUserRole = (userRole || '').toLowerCase().trim().replace(/[\s-]+/g, '_')
  const isAdminTier = ['admin', 'super_admin', 'financial_admin', 'support_admin'].includes(normalizedUserRole)
  return allowedRoles.some((allowed) => {
    const normAllowed = allowed.toLowerCase().trim().replace(/[\s-]+/g, '_')
    if (normAllowed === normalizedUserRole) return true
    // Jerarquía: si se permite 'admin' o 'super_admin' o cualquier rol admin-tier,
    // cualquier rol de nivel administrativo tiene acceso completo.
    if ((normAllowed === 'admin' || normAllowed === 'super_admin' || normAllowed === 'financial_admin') && isAdminTier) {
      return true
    }
    return false
  })
}

/**
 * Guardián de seguridad para rutas de API de Sugar Ludo Admin Hub.
 * Extrae y valida el token Bearer del encabezado Authorization.
 * Soporta Firebase Admin Auth (JWT idToken) y tokens de sesión estructurados
 * validados contra Firestore en modo híbrido.
 */
export async function verifyStaffAuth(
  request: Request,
  allowedRoles?: StaffRole[]
): Promise<AuthVerificationResult> {
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          success: false,
          error: 'Acceso no autorizado. Se requiere token Bearer en el encabezado Authorization.'
        },
        { status: 401, headers: corsHeaders }
      )
    }
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        { success: false, error: 'Token de autorización vacío.' },
        { status: 401, headers: corsHeaders }
      )
    }
  }

  let verifiedUser: AuthenticatedStaffUser | null = null

  // 1. Verificación OBLIGATORIA vía Firebase Admin SDK
  if (adminAuth) {
    try {
      const decoded = await adminAuth.verifyIdToken(token)
      if (decoded && decoded.uid) {
        // Si hay claim de rol admin-tier, se prioriza sobre accountType genérico
        let role = (decoded.role as string) || (decoded.accountType as string)
        const normalizedUid = String(decoded.uid).toLowerCase().trim()
        const normalizedEmail = String(decoded.email || '').toLowerCase().trim()

        // Si el token aún no tiene custom claims de rol, consultar perfil formal en Firestore
        if (!role && adminDb && adminDb.collection) {
          try {
            // A) Consultar en system_config/admin_accounts (almacén canónico de administradores)
            const adminAccountsDoc = await adminDb.collection('system_config').doc('admin_accounts').get()
            if (adminAccountsDoc.exists) {
              const accounts = adminAccountsDoc.data()?.accounts || []
              const match = accounts.find((a: any) =>
                (a.uid && a.uid.toLowerCase() === normalizedUid) ||
                (a.email && a.email.toLowerCase() === normalizedEmail)
              )
              if (match && match.isActive !== false && match.role) {
                role = match.role
              }
            }

            // B) Consultar en staff_profiles si aún no se determinó
            if (!role) {
              const staffDoc = await adminDb.collection('staff_profiles').doc(decoded.uid).get()
              if (staffDoc.exists) {
                const data = staffDoc.data()
                if (data?.isActive !== false && data?.role) {
                  role = data.role
                }
              }
            }

            // C) Consultar en cashier_profiles
            if (!role) {
              const cashierDoc = await adminDb.collection('cashier_profiles').doc(decoded.uid).get()
              if (cashierDoc.exists) {
                const cData = cashierDoc.data()
                if (cData?.isActive !== false) {
                  role = 'cashier'
                }
              }
            }
          } catch {}
        }

        // CANDADO DE SEGURIDAD ESTRICTO:
        // Prohibida la escalada de privilegios. Si el usuario no tiene un rol Staff explícito
        // verificado, se rechaza inmediatamente con 403 Prohibido. Jamás asumir super_admin.
        const normalizedRole = (role || '').toLowerCase().trim()
        const validStaffRoles = ['cashier', 'admin', 'super_admin', 'financial_admin', 'support_admin']
        if (!role || !validStaffRoles.includes(normalizedRole)) {
          return {
            authorized: false,
            errorResponse: NextResponse.json(
              {
                success: false,
                error: 'Acceso denegado: El usuario autenticado no posee un rol de Staff autorizado.'
              },
              { status: 403, headers: corsHeaders }
            )
          }
        }

        verifiedUser = {
          uid: decoded.uid,
          role: normalizedRole,
          email: decoded.email,
          name: (decoded.name as string) || (decoded.displayName as string) || 'Staff'
        }
      }
    } catch (err: any) {
      console.warn('[verifyStaffAuth] Fallo en verificación de firma JWT de Firebase Admin:', err.message)
    }
  }

  // 2. Si no se pudo verificar la identidad criptográfica (tokens manipulados o sin firma válida)
  if (!verifiedUser) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          success: false,
          error: 'Acceso denegado: Token de autorización inválido, manipulado o no emitido por Firebase Auth.'
        },
        { status: 401, headers: corsHeaders }
      )
    }
  }

  // 3. Verificación de permisos por rol
  if (allowedRoles && allowedRoles.length > 0) {
    const hasRole = roleMatches(verifiedUser.role, allowedRoles)
    if (!hasRole) {
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          {
            success: false,
            error: `Permisos insuficientes. Se requiere uno de los siguientes roles: ${allowedRoles.join(', ')}`
          },
          { status: 403, headers: corsHeaders }
        )
      }
    }
  }

  return {
    authorized: true,
    user: verifiedUser
  }
}

/**
 * Helper para clientes frontend del Admin Hub:
 * Construye los encabezados Authorization Bearer con el JWT ID Token legítimo de Firebase Auth.
 */
export function getStaffAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    const token = sessionStorage.getItem('sugar_staff_id_token') || localStorage.getItem('sugar_staff_id_token')
    if (token) {
      return {
        Authorization: `Bearer ${token}`
      }
    }
  } catch {}
  return {}
}
