import crypto from 'crypto'

/**
 * ============================================================================
 * SUGAR LUDO - MOTOR DE AUTENTICACIÓN DE DOS FACTORES (TOTP RFC 6238)
 * ============================================================================
 * Implementación criptográfica pura con Node.js crypto (sin librerías externas).
 * Compatible con Google Authenticator, Microsoft Authenticator, Authy y 1Password.
 */

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

/**
 * Codifica un Buffer a Base32
 */
export function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ''

  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i]
    bits += 8

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }

  return output
}

/**
 * Decodifica una cadena Base32 a Buffer
 */
export function base32Decode(base32: string): Buffer {
  const clean = base32.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i])
    if (idx === -1) continue

    value = (value << 5) | idx
    bits += 5

    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }

  return Buffer.from(bytes)
}

/**
 * Genera un secreto aleatorio para TOTP codificado en Base32
 */
export function generateTOTPSecret(byteLength = 20): string {
  const randomBytes = crypto.randomBytes(byteLength)
  return base32Encode(randomBytes)
}

/**
 * Calcula el código TOTP de 6 dígitos para un secreto y timestamp dados (RFC 6238)
 */
export function generateTOTPCode(secretBase32: string, timestampMs = Date.now(), stepSeconds = 30): string {
  const key = base32Decode(secretBase32)
  const counter = Math.floor(timestampMs / 1000 / stepSeconds)

  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigInt64BE(BigInt(counter))

  const hmac = crypto.createHmac('sha1', key)
  hmac.update(counterBuffer)
  const digest = hmac.digest()

  const offset = digest[digest.length - 1] & 0x0f
  const codeInt =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff)

  const otp = codeInt % 1_000_000
  return otp.toString().padStart(6, '0')
}

/**
 * Verifica un código TOTP provisto con tolerancia a desfase de reloj (±1 paso de 30s)
 */
export function verifyTOTPCode(
  providedCode: string,
  secretBase32: string,
  toleranceSteps = 1,
  currentTimestampMs = Date.now()
): boolean {
  if (!providedCode || !secretBase32) return false
  const cleanCode = String(providedCode).trim().replace(/\s+/g, '')
  if (!/^\d{6}$/.test(cleanCode)) return false

  const stepMs = 30 * 1000
  for (let step = -toleranceSteps; step <= toleranceSteps; step++) {
    const checkTime = currentTimestampMs + step * stepMs
    const expected = generateTOTPCode(secretBase32, checkTime)

    const expectedBuf = Buffer.from(expected)
    const providedBuf = Buffer.from(cleanCode)

    if (expectedBuf.length === providedBuf.length && crypto.timingSafeEqual(expectedBuf, providedBuf)) {
      return true
    }
  }

  return false
}

/**
 * Genera la URI otpauth estándar para apps de autenticación (QR)
 */
export function generateTOTPUri(
  accountName: string,
  secretBase32: string,
  issuer = 'SugarLudo'
): string {
  const encIssuer = encodeURIComponent(issuer)
  const encAccount = encodeURIComponent(accountName)
  return `otpauth://totp/${encIssuer}:${encAccount}?secret=${secretBase32}&issuer=${encIssuer}&algorithm=SHA1&digits=6&period=30`
}

/**
 * Genera códigos de recuperación (recovery codes) de un solo uso
 */
export function generateRecoveryCodes(count = 8): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const hex1 = crypto.randomBytes(2).toString('hex').toUpperCase()
    const hex2 = crypto.randomBytes(2).toString('hex').toUpperCase()
    codes.push(`${hex1}-${hex2}`)
  }
  return codes
}
