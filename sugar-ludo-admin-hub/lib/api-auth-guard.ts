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

import {
  extractStaffSessionCookie,
  verifyStaffSessionToken,
  buildClearStaffSessionCookie,
  buildClearAdminSessionCookie,
  buildClearCashierSessionCookie,
  getActiveStaffSession,
  getActiveCashierSession,
  getActiveAdminSession,
  ADMIN_SESSION_COOKIE_NAME,
  CASHIER_SESSION_COOKIE_NAME
} from './session-manager.ts'

/**
 * Guardián de seguridad para rutas de API de Sugar Ludo Admin Hub.
 * 1. Verifica prioritariamente la cookie HttpOnly protegida ('sugar_staff_session').
 *    - Aplica expiración estricta por inactividad (15 min cajeros, 30 min admin).
 *    - Aplica control de sesión única concurrente (Single Active Session).
 * 2. Soporte fallback/híbrido para encabezados Authorization Bearer (Firebase Admin JWT).
 */
export async function verifyStaffAuth(
  request: Request,
  allowedRoles?: StaffRole[]
): Promise<AuthVerificationResult> {
  // Deducir dominio de rol esperado a partir de la ruta o de allowedRoles
  const urlPath = request.url ? new URL(request.url, 'http://localhost').pathname : ''
  const isCashierRoute = urlPath.startsWith('/api/cashier')
  const isExplicitCashierRole = allowedRoles && allowedRoles.length === 1 && allowedRoles[0] === 'cashier'
  const roleDomain: 'admin' | 'cashier' = (isCashierRoute || isExplicitCashierRole) ? 'cashier' : 'admin'

  // A) Verificación prioritaria vía Cookie HttpOnly Segura segregada (Fase 1)
  const sessionCookieToken = extractStaffSessionCookie(request, roleDomain)
  if (sessionCookieToken) {
    const sessionRes = verifyStaffSessionToken(sessionCookieToken, roleDomain)
    if (!sessionRes.valid) {
      const clearCookie = roleDomain === 'cashier' ? buildClearCashierSessionCookie() : buildClearAdminSessionCookie()
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          {
            success: false,
            error: sessionRes.message || 'Sesión de Staff expirada o inválida.',
            code: sessionRes.error ? `SESSION_${sessionRes.error.toUpperCase()}` : 'SESSION_INVALID'
          },
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Set-Cookie': clearCookie
            }
          }
        )
      }
    }

    if (sessionRes.payload) {
      const payload = sessionRes.payload

      // Control estricto de sesión única activa (Single Active Session) segregado por rol
      const headerSessionId = (request.headers.get('x-staff-session-id') || request.headers.get('X-Staff-Session-Id') || '').trim()
      const headerStaffUid = (request.headers.get('x-staff-uid') || request.headers.get('X-Staff-Uid') || '').trim()

      const lookupKeys = [payload.uid, headerStaffUid, payload.email].filter((k): k is string => Boolean(k))
      let activeStaffSession: { sessionId: string; updatedAt: number } | undefined
      const getActiveSessionFn = (payload.accountType === 'cashier' || payload.role === 'cashier' || roleDomain === 'cashier')
        ? getActiveCashierSession
        : getActiveAdminSession

      for (const k of lookupKeys) {
        activeStaffSession = getActiveSessionFn(k)
        if (activeStaffSession) break
      }

      const isCookieSuperseded = activeStaffSession && activeStaffSession.sessionId !== payload.sessionId
      const isHeaderSuperseded = activeStaffSession && headerSessionId && activeStaffSession.sessionId !== headerSessionId

      if (isCookieSuperseded || isHeaderSuperseded) {
        const clearCookie = (payload.accountType === 'cashier' || payload.role === 'cashier' || roleDomain === 'cashier')
          ? buildClearCashierSessionCookie()
          : buildClearAdminSessionCookie()
        return {
          authorized: false,
          errorResponse: NextResponse.json(
            {
              success: false,
              error: 'Sesión invalidada: Se ha iniciado sesión desde otro dispositivo o navegador.',
              code: 'SESSION_SUPERSEDED'
            },
            {
              status: 401,
              headers: {
                ...corsHeaders,
                'Set-Cookie': clearCookie
              }
            }
          )
        }
      }

      if (allowedRoles && allowedRoles.length > 0) {
        const hasRole = roleMatches(payload.role, allowedRoles)
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
        user: {
          uid: payload.uid,
          role: payload.role,
          email: payload.email,
          name: payload.name
        }
      }
    }
  }

  // B) Verificación vía Encabezado Authorization Bearer (Fallback / API Clients)
  const headerStaffUid = (request.headers.get('x-staff-uid') || request.headers.get('X-Staff-Uid') || '').trim()
  const headerStaffEmail = (request.headers.get('x-staff-email') || request.headers.get('X-Staff-Email') || '').toLowerCase().trim()
  const headerStaffRole = normalizeStaffRole(request.headers.get('x-staff-role') || request.headers.get('X-Staff-Role') || '')
  const headerSessionId = (request.headers.get('x-staff-session-id') || request.headers.get('X-Staff-Session-Id') || '').trim()

  // Control proactivo: Si el cliente envía identificación de sesión y la misma ya fue superada en el backend
  if (headerSessionId && (headerStaffUid || headerStaffEmail)) {
    const isTargetCashier = roleDomain === 'cashier' || headerStaffRole === 'cashier'
    const getActiveSessionFn = isTargetCashier ? getActiveCashierSession : getActiveAdminSession
    const lookupKeys = [headerStaffUid, headerStaffEmail].filter(Boolean)
    let activeSession: { sessionId: string; updatedAt: number } | undefined
    for (const k of lookupKeys) {
      activeSession = getActiveSessionFn(k)
      if (activeSession) break
    }

    if (activeSession && activeSession.sessionId !== headerSessionId) {
      const clearCookie = isTargetCashier ? buildClearCashierSessionCookie() : buildClearAdminSessionCookie()
      return {
        authorized: false,
        errorResponse: NextResponse.json(
          {
            success: false,
            error: 'Sesión invalidada: Se ha iniciado sesión desde otro dispositivo o navegador.',
            code: 'SESSION_SUPERSEDED'
          },
          {
            status: 401,
            headers: {
              ...corsHeaders,
              'Set-Cookie': clearCookie
            }
          }
        )
      }
    }
  }

  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization')

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          success: false,
          error: 'Acceso no autorizado. Se requiere sesión activa o token Bearer en el encabezado Authorization.',
          code: 'SESSION_INVALID'
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
          (decoded as any)['https://sugarludo.com/role'],
          (decoded as any).staffRole
        ]
        let role = ''
        for (const c of candidates) {
          const n = normalizeStaffRole(c)
          if (n) {
            // Prioriza roles de nivel admin sobre 'cashier' genérico
            if (!role || (role === 'cashier' && n !== 'cashier')) role = n
          }
        }

        let staffUid = (decoded.staffUid as string) || ((decoded as any).claims?.staffUid as string) || headerStaffUid || ''
        const normalizedUid = String(decoded.uid).toLowerCase().trim()
        let userEmail = String(decoded.email || '').toLowerCase().trim() || headerStaffEmail

        // Si el token aún no tiene custom claims de rol, consultar userRecord autoritativo en Firebase Auth
        if (!role && adminAuth && typeof adminAuth.getUser === 'function') {
          try {
            const userRecord = await adminAuth.getUser(decoded.uid)
            if (userRecord) {
              role = normalizeStaffRole(userRecord.customClaims?.role) ||
                     normalizeStaffRole(userRecord.customClaims?.accountType) ||
                     normalizeStaffRole(userRecord.customClaims?.staffRole) || ''
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
                (headerStaffUid && aUid === headerStaffUid.toLowerCase()) ||
                (headerStaffEmail && aEmail === headerStaffEmail) ||
                (aUser && (aUser === normalizedUid || (staffUid && aUser === staffUid.toLowerCase())))
              )
            })

            if (match && match.isActive !== false && normalizeStaffRole(match.role)) {
              role = normalizeStaffRole(match.role)
              if (!staffUid && match.uid) staffUid = match.uid
              if (!userEmail && match.email) userEmail = match.email
            }

          } catch {}

          // B) staff_profiles: el login (/api/staff/auth/session) localiza el perfil por email, doc-id o username,
          // por lo que el guardián debe usar exactamente las mismas claves (antes solo probaba doc(uid)).
          if (!role && adminDb && adminDb.collection) {
            const lookups: Array<() => Promise<any>> = []
            const col = adminDb.collection('staff_profiles')
            if (staffUid) lookups.push(() => col.doc(staffUid).get())
            lookups.push(() => col.doc(decoded.uid).get())
            if (userEmail) lookups.push(() => col.where('email', '==', userEmail).limit(1).get())
            if (headerStaffUid) lookups.push(() => col.where('uid', '==', headerStaffUid).limit(1).get())
            lookups.push(() => col.where('uid', '==', decoded.uid).limit(1).get())
            for (const run of lookups) {
              if (role) break
              try {
                const res = await run()
                const snapDoc = res?.docs ? res.docs[0] : res
                if (snapDoc && snapDoc.exists !== false && (res?.docs ? res.docs.length > 0 : snapDoc.exists)) {
                  const data = snapDoc.data()
                  if (data && data.isActive !== false) {
                    // Pertenecer a staff_profiles con cuenta activa implica Staff autenticado por el login con contraseña;
                    // si el perfil no declara rol válido se concede el nivel mínimo administrativo ('admin'), nunca super_admin.
                    role = normalizeStaffRole(data.role) || normalizeStaffRole(data.accountType) || 'admin'
                    if (!staffUid && data.uid) staffUid = data.uid
                  }
                }
              } catch {}
            }
          }

          // C) cashier_profiles (mismas claves de búsqueda)
          if (!role && adminDb && adminDb.collection) {
            const col = adminDb.collection('cashier_profiles')
            const lookups: Array<() => Promise<any>> = [() => col.doc(staffUid || decoded.uid).get()]
            if (userEmail) lookups.push(() => col.where('email', '==', userEmail).limit(1).get())
            for (const run of lookups) {
              if (role) break
              try {
                const res = await run()
                const snapDoc = res?.docs ? res.docs[0] : res
                if (snapDoc && (res?.docs ? res.docs.length > 0 : snapDoc.exists)) {
                  const cData = snapDoc.data()
                  if (cData?.isActive !== false) role = 'cashier'
                }
              } catch {}
            }
          }
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
              (headerStaffUid && cUid === headerStaffUid.toLowerCase()) ||
              (headerStaffEmail && cEmail === headerStaffEmail) ||
              (cUser === normalizedUid || (staffUid && cUser === staffUid.toLowerCase()))
            )
          })

          if (canonical) {
            role = canonical.role
            staffUid = canonical.uid
            if (!userEmail) userEmail = canonical.email
          }
        }

        // Si se envió un headerStaffRole válido y la identidad está respaldada por una cuenta canónica o de Firestore
        if (!role && headerStaffRole && (staffUid || headerStaffUid)) {
          const targetUid = (staffUid || headerStaffUid).toLowerCase()
          const isCanonical = CANONICAL_STAFF_ACCOUNTS.some(c => c.uid.toLowerCase() === targetUid || (headerStaffEmail && c.email.toLowerCase() === headerStaffEmail))
          if (isCanonical) {
            role = headerStaffRole
            staffUid = staffUid || headerStaffUid
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

  // 2.1 Control de sesión única activa para Staff segregado por rol (Cajeros vs Administradores)
  const lookupKeys = [verifiedUser.uid, headerStaffUid, verifiedUser.email, headerStaffEmail].filter((k): k is string => Boolean(k))
  const isCashierUser = verifiedUser.role === 'cashier' || roleDomain === 'cashier'
  const getActiveSessionFn = isCashierUser ? getActiveCashierSession : getActiveAdminSession

  let activeStaffSession: { sessionId: string; updatedAt: number } | undefined
  for (const k of lookupKeys) {
    activeStaffSession = getActiveSessionFn(k)
    if (activeStaffSession) break
  }

  if (activeStaffSession && headerSessionId && activeStaffSession.sessionId !== headerSessionId) {
    const clearCookie = isCashierUser ? buildClearCashierSessionCookie() : buildClearAdminSessionCookie()
    return {
      authorized: false,
      errorResponse: NextResponse.json(
        {
          success: false,
          error: 'Sesión invalidada: Se ha iniciado sesión desde otro dispositivo o navegador.',
          code: 'SESSION_SUPERSEDED'
        },
        {
          status: 401,
          headers: {
            ...corsHeaders,
            'Set-Cookie': clearCookie
          }
        }
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

/**
 * Autentica una petición de API para staff devolviendo un resultado unificado
 */
export async function authenticateApiStaffRequest(
  request: Request,
  allowedRoles?: StaffRole[]
): Promise<{ authenticated: boolean; account?: AuthenticatedStaffUser; error?: string }> {
  const result = await verifyStaffAuth(request, allowedRoles)
  return {
    authenticated: result.authorized,
    account: result.user,
    error: result.errorResponse ? 'No autorizado o sesión de Staff expirada' : undefined
  }
}

