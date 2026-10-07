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
})



