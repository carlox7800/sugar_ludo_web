import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  parseSemver,
  compareSemver,
  isVersionOutdated,
  getClientAppVersion,
  DEFAULT_VERSION_POLICY
} from '../lib/version-checker.ts'

describe('Suite: SemVer & Detección de Versiones (Force Update)', () => {
  it('debe parsear correctamente cadenas de versiones con o sin prefijo v', () => {
    assert.deepEqual(parseSemver('9.5.4'), [9, 5, 4])
    assert.deepEqual(parseSemver('v9.5.4'), [9, 5, 4])
    assert.deepEqual(parseSemver('V10.0.1'), [10, 0, 1])
    assert.deepEqual(parseSemver('8.0'), [8, 0, 0])
    assert.deepEqual(parseSemver(''), [0, 0, 0])
  })

  it('debe comparar versiones semver con exactitud matemática', () => {
    // v1 > v2 => 1
    assert.equal(compareSemver('9.5.4', '9.5.3'), 1)
    assert.equal(compareSemver('10.0.0', '9.5.4'), 1)
    assert.equal(compareSemver('9.6.0', '9.5.9'), 1)

    // v1 < v2 => -1
    assert.equal(compareSemver('9.4.9', '9.5.4'), -1)
    assert.equal(compareSemver('9.5.0', '9.5.4'), -1)
    assert.equal(compareSemver('8.9.9', '9.0.0'), -1)

    // v1 == v2 => 0
    assert.equal(compareSemver('9.5.4', '9.5.4'), 0)
    assert.equal(compareSemver('v9.5.4', '9.5.4'), 0)
  })

  it('debe marcar correctamente como obsoleta cualquier versión inferior a la mínima requerida', () => {
    const minRequired = '9.5.4'
    assert.equal(isVersionOutdated('9.4.9', minRequired), true)
    assert.equal(isVersionOutdated('9.5.0', minRequired), true)
    assert.equal(isVersionOutdated('9.5.3', minRequired), true)
    assert.equal(isVersionOutdated('9.5.4', minRequired), false)
    assert.equal(isVersionOutdated('9.5.5', minRequired), false)
  })

  it('debe reflejar la versión oficial de producción cuando MOCK_TEST_CLIENT_VERSION es null', () => {
    const activeVersion = getClientAppVersion()
    // En modo producción oficial debe reportar '9.5.4'
    assert.equal(activeVersion, '9.5.4')
    // Al contrastar 9.5.4 contra la política mínima (9.5.4), no debe considerarse desfasada
    assert.equal(isVersionOutdated(activeVersion, DEFAULT_VERSION_POLICY.minSupportedVersion), false)
  })

  it('debe contener URLs oficiales de descarga para Android, Windows y Web en la política por defecto', () => {
    assert.ok(DEFAULT_VERSION_POLICY.downloadUrls.android.includes('sugar-ludo-landing.onrender.com'))
    assert.ok(DEFAULT_VERSION_POLICY.downloadUrls.windows.includes('sugar-ludo-landing.onrender.com'))
    assert.ok(DEFAULT_VERSION_POLICY.downloadUrls.web.includes('onrender.com'))
    assert.ok(DEFAULT_VERSION_POLICY.landingUrl.includes('sugar-ludo-landing.onrender.com'))
    assert.equal(DEFAULT_VERSION_POLICY.forceUpdate, true)
  })
})
