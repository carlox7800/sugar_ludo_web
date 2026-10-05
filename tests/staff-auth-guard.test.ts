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
})
