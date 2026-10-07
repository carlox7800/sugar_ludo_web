import crypto from 'crypto'

const SCRYPT_KEYLEN = 64
const SCRYPT_COST = 16384 // N
const SCRYPT_BLOCKSIZE = 8 // r
const SCRYPT_PARALLELISM = 1 // p

/**
 * Genera un hash criptográfico robusto de contraseña usando scrypt con sal aleatoria.
 * Formato del hash: scrypt$saltHex$hashHex
 */
export function hashPassword(password: string): string {
  if (!password || typeof password !== 'string') {
    throw new Error('La contraseña proporcionada es inválida o vacía.')
  }
  const salt = crypto.randomBytes(16).toString('hex')
  const derivedKey = crypto.scryptSync(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCKSIZE,
    p: SCRYPT_PARALLELISM
  })
  return `scrypt$${salt}$${derivedKey.toString('hex')}`
}

/**
 * Verifica una contraseña candidata contra un hash almacenado de forma segura
 * usando comparación en tiempo constante (timingSafeEqual) contra ataques de canal lateral.
 */
export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!password || !storedHash || typeof storedHash !== 'string') {
    return false
  }

  // 1. Verificación de hash scrypt canónico
  if (storedHash.startsWith('scrypt$')) {
    const parts = storedHash.split('$')
    if (parts.length !== 3) return false
    const salt = parts[1]
    const originalHashHex = parts[2]

    try {
      const derivedKey = crypto.scryptSync(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
        N: SCRYPT_COST,
        r: SCRYPT_BLOCKSIZE,
        p: SCRYPT_PARALLELISM
      })
      const originalKeyBuffer = Buffer.from(originalHashHex, 'hex')
      if (derivedKey.length !== originalKeyBuffer.length) {
        return false
      }
      return crypto.timingSafeEqual(derivedKey, originalKeyBuffer)
    } catch {
      return false
    }
  }

  // 2. Hash SHA-256 con prefijo sha256$
  if (storedHash.startsWith('sha256$')) {
    const parts = storedHash.split('$')
    if (parts.length !== 3) return false
    const salt = parts[1]
    const originalHash = parts[2]
    const computed = crypto.createHmac('sha256', salt).update(password.normalize('NFKC')).digest('hex')
    try {
      return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(originalHash))
    } catch {
      return false
    }
  }

  return false
}

/**
 * Determina si una cadena dada ya tiene formato de hash seguro (scrypt o sha256)
 */
export function isHashedPassword(value?: string | null): boolean {
  if (!value || typeof value !== 'string') return false
  return value.startsWith('scrypt$') || value.startsWith('sha256$')
}
