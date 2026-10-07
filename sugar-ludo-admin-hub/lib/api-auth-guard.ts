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
 * Normaliza cualquier variante de rol ('Super Admin', 'superadmin', 'super-admin', 'FINANCIAL ADMIN')
 * a un StaffRole canónico. Devuelve '' si no es un rol Staff reconocido.
 */
export function normalizeStaffRole(raw: unknown): StaffRole | '' {
  if (typeof raw !== 'string') return ''
  const r = raw.toLowerCase().trim().replace(/[\s-]+/g, '_')
  const aliases: Record<string, StaffRole> = {
    cashier: 'cashier',
    cajero: 'cashier',
    admin: 'admin',
    administrador: 'admin',
    super_admin: 'super_admin',
    superadmin: 'super_admin',
    financial_admin: 'financial_admin',
    financialadmin: 'financial_admin',
    support_admin: 'support_admin',
    supportadmin: 'support_admin'
  }
  return aliases[r] || ''
}

// Cuentas canónicas oficiales del sistema para Staff y Administración
export const CANONICAL_STAFF_ACCOUNTS: Array<{
  uid: string
  username: string
  email: string
  role: StaffRole
  name: string
}> = [
  {
    uid: 'adm_super_carlos_001',
    username: 'superadmin',
    email: 'admin@sugarludo.com',
    role: 'super_admin',
    name: 'Carlos (Super Admin)'
  },
  {
    uid: 'adm_fin_diego_002',
    username: 'diego.finanzas',
    email: 'finanzas@sugarludo.com',
    role: 'financial_admin',
    name: 'Diego (Admin Financiero)'
  },
  {
    uid: 'csh_carlosandroid_001',
    username: 'carlosandroid',
    email: 'carlos.cajero@sugarludo.com',
    role: 'cashier',
    name: 'carlosandroid (Cajero)'
  }
]

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
        // Extraer rol de todos los posibles contenedores de claims en el token JWT
        // Se normaliza cada candidato y se descartan valores no reconocidos (ej. 'Super Admin', 'superadmin'),
        // de modo que un claim con formato distinto no bloquee la resolución por perfil.
        const candidates = [
          decoded.role,
          decoded.accountType,
          (decoded as any).claims?.role,
          (decoded as any).claims?.accountType,
          (decoded as any)['https://sugarludo.com/role']
        ]
        let role = ''
        for (const c of candidates) {
          const n = normalizeStaffRole(c)
          if (n) {
            // Prioriza roles de nivel admin sobre 'cashier' genérico
            if (!role || (role === 'cashier' && n !== 'cashier')) role = n
          }
        }

        let staffUid = (decoded.staffUid as string) || ((decoded as any).claims?.staffUid as string) || ''
        const normalizedUid = String(decoded.uid).toLowerCase().trim()
        let userEmail = String(decoded.email || '').toLowerCase().trim()

        // Si el token aún no tiene custom claims de rol, consultar userRecord autoritativo en Firebase Auth
        if (!role && adminAuth && typeof adminAuth.getUser === 'function') {
          try {
            const userRecord = await adminAuth.getUser(decoded.uid)
            if (userRecord) {
              role = normalizeStaffRole(userRecord.customClaims?.role) ||
                     normalizeStaffRole(userRecord.customClaims?.accountType) || ''
              if (userRecord.customClaims?.staffUid) {
                staffUid = userRecord.customClaims.staffUid
              }
              if (!userEmail && userRecord.email) {
                userEmail = String(userRecord.email).toLowerCase().trim()
              }
            }
          } catch {}
        }

        // Si aún no se determinó el rol, consultar perfil formal en Firestore (adminDb o db client SDK)
        if (!role) {
          try {
            // A) Consultar en system_config/admin_accounts (almacén canónico de administradores)
            let accounts: any[] = []
            if (adminDb && adminDb.collection) {
              const adminAccountsDoc = await adminDb.collection('system_config').doc('admin_accounts').get()
              if (adminAccountsDoc.exists) {
                accounts = adminAccountsDoc.data()?.accounts || []
              }
            }
            if (accounts.length === 0 && db) {
              const clientSnap = await getDoc(doc(db, 'system_config', 'admin_accounts'))
              if (clientSnap.exists()) {
                accounts = clientSnap.data()?.accounts || []
              }
            }

            const match = accounts.find((a: any) => {
              const aUid = String(a.uid || '').toLowerCase().trim()
              const aEmail = String(a.email || '').toLowerCase().trim()
              const aUser = String(a.username || '').toLowerCase().trim()
              return (
                (aUid && aUid === normalizedUid) ||
                (staffUid && aUid === staffUid.toLowerCase()) ||
                (userEmail && aEmail === userEmail) ||
                (aUser && (aUser === normalizedUid || (staffUid && aUser === staffUid.toLowerCase())))
              )
            })

            if (match && match.isActive !== false && normalizeStaffRole(match.role)) {
              role = normalizeStaffRole(match.role)
              if (!staffUid && match.uid) staffUid = match.uid
            }

            // B) Consultar en staff_profiles si aún no se determinó
            if (!role && adminDb && adminDb.collection) {
              const staffDoc = await adminDb.collection('staff_profiles').doc(decoded.uid).get()
              if (staffDoc.exists) {
                const data = staffDoc.data()
                if (data?.isActive !== false && normalizeStaffRole(data?.role)) {
                  role = normalizeStaffRole(data?.role)
                }
              }
            }

            // C) Consultar en cashier_profiles
            if (!role && adminDb && adminDb.collection) {
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

        // 3. Fallback canónico: Si es una cuenta de staff del sistema canónico oficial
        if (!role) {
          const canonical = CANONICAL_STAFF_ACCOUNTS.find((c) => {
            const cUid = c.uid.toLowerCase()
            const cEmail = c.email.toLowerCase()
            const cUser = c.username.toLowerCase()
            return (
              (cUid === normalizedUid) ||
              (staffUid && cUid === staffUid.toLowerCase()) ||
              (userEmail && cEmail === userEmail) ||
              (cUser === normalizedUid || (staffUid && cUser === staffUid.toLowerCase()))
            )
          })

          if (canonical) {
            role = canonical.role
            if (!staffUid) staffUid = canonical.uid
          }
        }

        // Si se resolvió el rol y no estaba en customClaims de Firebase Auth,
        // sincronizar claims en background para futuras peticiones ultra-rápidas
        if (role && adminAuth && typeof adminAuth.setCustomUserClaims === 'function' && !decoded.role) {
          adminAuth.setCustomUserClaims(decoded.uid, {
            role,
            staffUid: staffUid || decoded.uid,
            isActive: true
          }).catch(() => {})
        }

        // CANDADO DE SEGURIDAD ESTRICTO:
        // Prohibida la escalada de privilegios. Si el usuario no tiene un rol Staff explícito
        // verificado, se rechaza inmediatamente con 403 Prohibido. Jamás asumir super_admin.
        const normalizedRole = normalizeStaffRole(role)
        if (!normalizedRole) {
          console.warn('[verifyStaffAuth] 403: rol Staff no resuelto', {
            tokenUid: decoded.uid,
            tokenEmail: userEmail || null,
            staffUid: staffUid || null,
            rawRole: role || null,
            hasAdminDb: Boolean(adminDb)
          })
          return {
            authorized: false,
            errorResponse: NextResponse.json(
              {
                success: false,
                error: 'Acceso denegado: El usuario autenticado no posee un rol de Staff autorizado.',
                reason: 'staff_role_unresolved'
              },
              { status: 403, headers: corsHeaders }
            )
          }
        }

        verifiedUser = {
          uid: staffUid || decoded.uid,
          role: normalizedRole,
          email: userEmail || decoded.email,
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
