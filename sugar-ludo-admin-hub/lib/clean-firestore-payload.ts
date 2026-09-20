/**
 * ============================================================================
 * SANITIZADOR UNIVERSAL DE PAYLOADS PARA CLOUD FIRESTORE
 * ============================================================================
 * Descarta recursivamente cualquier clave con valor `undefined`.
 * Previene la excepción fatal de Cloud Firestore: "Unsupported field value: undefined".
 * Preserva de forma estricta: null, 0, "", false, Arrays, Date y tipos primitivos válidos.
 */

export function cleanFirestorePayload<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) {
      continue
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      result[key] = cleanFirestorePayload(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }
  return result as T
}
