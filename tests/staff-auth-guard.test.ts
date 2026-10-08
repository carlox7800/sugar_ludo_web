import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { verifyStaffAuth } from '../sugar-ludo-admin-hub/lib/api-auth-guard.ts'
import { getStaffAuthHeaders } from '../sugar-ludo-admin-hub/lib/auth-headers.ts'

describe('Suite: Endurecimiento de Seguridad & Staff Auth Guard (v9.6.0)', () => {
  it('debe rechazar con 401 cualquier petición sin encabezado Authorization', async () => {
    const req = new Request('https://admin.sugarludo.com/api/economy/config', {
      method: 'POST',
      headers: {}
    })

    const result = await verifyStaffAuth(req, ['admin'])
    assert.equal(result.authorized, false)
    assert.ok(result.errorResponse)
    assert.equal(result.errorResponse.status, 401)

    const body = await result.errorResponse.json()
    assert.equal(body.success, false)
    assert.ok(body.error.includes('token Bearer') || body.error.includes('no autorizado'))
  })

  it('debe rechazar con 401 peticiones con token Bearer vacío o sin prefijo correcto', async () => {
    const req1 = new Request('https://admin.sugarludo.com/api/economy/config', {
      headers: { Authorization: 'Basic dXNlcjpwYXNz' }
    })
    const res1 = await verifyStaffAuth(req1, ['admin'])
    assert.equal(res1.authorized, false)
    assert.equal(res1.errorResponse?.status, 401)

    const req2 = new Request('https://admin.sugarludo.com/api/economy/config', {
      headers: { Authorization: 'Bearer   ' }
    })
    const res2 = await verifyStaffAuth(req2, ['admin'])
    assert.equal(res2.authorized, false)
    assert.equal(res2.errorResponse?.status, 401)
  })

  it('CANDADO CRÍTICO: debe rechazar tajantemente con 401 tokens falsos codificados en Base64', async () => {
    // Payload falso que antes era aceptado por el decodificador Base64
    const fakePayload = {
      uid: 'adm_super_carlos_001',
      role: 'super_admin',
      email: 'admin@sugarludo.com',
      timestamp: Date.now()
    }
    const fakeToken = Buffer.from(JSON.stringify(fakePayload)).toString('base64')

    const req = new Request('https://admin.sugarludo.com/api/economy/config', {
      method: 'POST',
      headers: { Authorization: `Bearer ${fakeToken}` }
    })

    const result = await verifyStaffAuth(req, ['admin'])
    assert.equal(result.authorized, false, 'Un token falso en base64 no debe ser autorizado')
    assert.ok(result.errorResponse)
    assert.equal(result.errorResponse.status, 401)

    const body = await result.errorResponse.json()
    assert.equal(body.success, false)
    assert.ok(body.error.includes('denegado') || body.error.includes('inválido'))
  })

  it('CANDADO CRÍTICO: debe rechazar con 401 tokens manipulados o firmas corruptas', async () => {
    const corruptedJwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJhdHRhY2tlciIsInJvbGUiOiJzdXBlcl9hZG1pbiJ9.corruptedSignature'
    const req = new Request('https://admin.sugarludo.com/api/admin/treasury/reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${corruptedJwt}` }
    })

    const result = await verifyStaffAuth(req, ['admin'])
    assert.equal(result.authorized, false)
    assert.equal(result.errorResponse?.status, 401)
  })

  it('debe garantizar que getStaffAuthHeaders() nunca genere tokens falsos por defecto sin sesión activa', () => {
    const headers = getStaffAuthHeaders('admin')
    // Sin sesión activa en almacenamiento, debe retornar objeto vacío y nunca un fallback inseguro
    assert.deepEqual(headers, {})
  })

  it('FASE 0 HARDENING: debe generar hashes scrypt robustos y verificar contraseñas con timingSafeEqual', async () => {
    const { hashPassword, verifyPassword, isHashedPassword } = await import('../sugar-ludo-admin-hub/lib/password-hasher.ts')
    const pass = 'MiClaveSegura2026!#'
    const hash = hashPassword(pass)

    assert.ok(hash.startsWith('scrypt$'), 'El hash generado debe usar formato scrypt')
    assert.ok(isHashedPassword(hash), 'Debe identificarse como hash seguro')
    assert.notEqual(hash, pass, 'El hash nunca debe ser igual a la contraseña en texto plano')

    // Verificación exitosa
    assert.equal(verifyPassword(pass, hash), true, 'La contraseña correcta debe validar en true')

    // Rechazo de contraseña incorrecta
    assert.equal(verifyPassword('OtraClaveErronea', hash), false, 'Contraseña errónea debe validar en false')

    // Rechazo ante entradas vacías o corruptas
    assert.equal(verifyPassword('', hash), false)
    assert.equal(verifyPassword(pass, ''), false)
    assert.equal(verifyPassword(pass, 'hashInvalido'), false)
  })

  it('FASE 0 HARDENING: debe generar sales únicas para cada llamada a hashPassword (anti-rainbow tables)', async () => {
    const { hashPassword } = await import('../sugar-ludo-admin-hub/lib/password-hasher.ts')
    const pass = 'ClaveComun123!'
    const hash1 = hashPassword(pass)
    const hash2 = hashPassword(pass)

    assert.notEqual(hash1, hash2, 'Dos llamadas a hashPassword con la misma clave deben generar hashes distintos debido a la sal criptográfica')
  })

  it('CANONICAL STAFF: debe contener las cuentas oficiales requeridas del sistema', async () => {
    const { CANONICAL_STAFF_ACCOUNTS } = await import('../sugar-ludo-admin-hub/lib/api-auth-guard.ts')
    assert.ok(Array.isArray(CANONICAL_STAFF_ACCOUNTS))
    assert.ok(CANONICAL_STAFF_ACCOUNTS.length >= 3)

    const superAdmin = CANONICAL_STAFF_ACCOUNTS.find(a => a.email === 'admin@sugarludo.com')
    assert.ok(superAdmin, 'Debe existir la cuenta de Super Admin')
    assert.equal(superAdmin.role, 'super_admin')
    assert.equal(superAdmin.username, 'superadmin')

    const financialAdmin = CANONICAL_STAFF_ACCOUNTS.find(a => a.email === 'finanzas@sugarludo.com')
    assert.ok(financialAdmin, 'Debe existir la cuenta de Admin Financiero')
    assert.equal(financialAdmin.role, 'financial_admin')

    const cashier = CANONICAL_STAFF_ACCOUNTS.find(a => a.role === 'cashier')
    assert.ok(cashier, 'Debe existir la cuenta de Cajero oficial')
  })

  it('ROLES: normalizeStaffRole acepta variantes legítimas y rechaza roles desconocidos', async () => {
    const { normalizeStaffRole } = await import('../sugar-ludo-admin-hub/lib/api-auth-guard.ts')
    assert.equal(normalizeStaffRole('Super Admin'), 'super_admin')
    assert.equal(normalizeStaffRole('superadmin'), 'super_admin')
    assert.equal(normalizeStaffRole('SUPER-ADMIN'), 'super_admin')
    assert.equal(normalizeStaffRole('financial admin'), 'financial_admin')
    assert.equal(normalizeStaffRole('cashier'), 'cashier')
    assert.equal(normalizeStaffRole('player'), '')
    assert.equal(normalizeStaffRole(undefined), '')
    assert.equal(normalizeStaffRole(''), '')
  })

  it('SESSION HEADERS: getStaffAuthHeaders propaga correctamente overrideRole si no hay almacenamiento', async () => {
    const { getStaffAuthHeaders } = await import('../sugar-ludo-admin-hub/lib/auth-headers.ts')
    // Sin token almacenado, no debe emitir token Authorization
    const headers = getStaffAuthHeaders('admin')
    assert.equal(headers.Authorization, undefined)
  })

  it('AISLAMIENTO DE SESIÓN: sesión de cajero no debe invalidar sesión de admin en mismo navegador', async () => {
    const {
      registerActiveAdminSession,
      registerActiveCashierSession,
      getActiveAdminSession,
      getActiveCashierSession,
      isStaffSessionSuperseded,
      ADMIN_SESSION_COOKIE_NAME,
      CASHIER_SESSION_COOKIE_NAME,
      buildAdminSessionCookie,
      buildCashierSessionCookie,
      extractStaffSessionCookie
    } = await import('../sugar-ludo-admin-hub/lib/session-manager.ts')

    const operatorUid = 'adm_carlos_operator_001'
    const adminSess1 = 'sess_admin_tab1'
    const cashierSess1 = 'sess_cashier_tab2'

    // 1. Iniciar sesión como Admin en pestaña 1
    registerActiveAdminSession(operatorUid, adminSess1)
    assert.equal(getActiveAdminSession(operatorUid)?.sessionId, adminSess1)
    assert.equal(isStaffSessionSuperseded(operatorUid, adminSess1, 'admin'), false)

    // 2. Iniciar sesión como Cajero en pestaña 2
    registerActiveCashierSession(operatorUid, cashierSess1)
    assert.equal(getActiveCashierSession(operatorUid)?.sessionId, cashierSess1)
    assert.equal(isStaffSessionSuperseded(operatorUid, cashierSess1, 'cashier'), false)

    // 3. La sesión de Admin en pestaña 1 NO debe ser invalidada por la de Cajero
    assert.equal(isStaffSessionSuperseded(operatorUid, adminSess1, 'admin'), false, 'Sesión de Admin debe permanecer válida')
    assert.equal(getActiveAdminSession(operatorUid)?.sessionId, adminSess1)

    // 4. Si el cajero abre otra terminal de cajero (cashierSess2), la previa de cajero se invalida
    const cashierSess2 = 'sess_cashier_terminal_B'
    registerActiveCashierSession(operatorUid, cashierSess2)
    assert.equal(isStaffSessionSuperseded(operatorUid, cashierSess1, 'cashier'), true, 'Sesión previa de cajero debe marcarse superseded')
    assert.equal(isStaffSessionSuperseded(operatorUid, cashierSess2, 'cashier'), false, 'Nueva sesión de cajero debe estar activa')

    // 5. Pero la sesión de Admin permanece INTACTA
    assert.equal(isStaffSessionSuperseded(operatorUid, adminSess1, 'admin'), false, 'Sesión de Admin debe permanecer intacta tras nuevo login de cajero')

    // 6. Validar nombres de cookies segregadas
    const adminCookie = buildAdminSessionCookie('token_admin_xyz')
    const cashierCookie = buildCashierSessionCookie('token_cashier_abc')
    assert.ok(adminCookie.startsWith(`${ADMIN_SESSION_COOKIE_NAME}=`))
    assert.ok(cashierCookie.startsWith(`${CASHIER_SESSION_COOKIE_NAME}=`))

    // 7. Simular cabecera Cookie con ambas sesiones coexistiendo
    const multiCookieHeader = `${ADMIN_SESSION_COOKIE_NAME}=token_admin_xyz; ${CASHIER_SESSION_COOKIE_NAME}=token_cashier_abc`
    const fakeAdminReq = new Request('https://admin.sugarludo.com/api/admin/treasury', {
      headers: { cookie: multiCookieHeader }
    })
    const fakeCashierReq = new Request('https://admin.sugarludo.com/api/cashier/orders', {
      headers: { cookie: multiCookieHeader }
    })

    assert.equal(extractStaffSessionCookie(fakeAdminReq, 'admin'), 'token_admin_xyz')
    assert.equal(extractStaffSessionCookie(fakeCashierReq, 'cashier'), 'token_cashier_abc')
  })
})



