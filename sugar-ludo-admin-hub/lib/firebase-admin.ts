// @ts-ignore
let admin: any = {}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  admin = require('firebase-admin')
} catch {
  admin = {
    apps: [],
    initializeApp: () => {},
    credential: { cert: () => ({}) },
    firestore: () => ({
      collection: () => ({ doc: () => ({ get: async () => ({ exists: false, data: () => ({}) }), update: async () => {}, set: async () => {} }) }),
      runTransaction: async (fn: any) => fn({ get: async () => ({ exists: false }), update: () => {}, set: () => {} }),
      FieldValue: { increment: (n: number) => n }
    }),
    auth: () => ({}),
    storage: () => ({})
  }
}

/**
 * ============================================================================
 * FIREBASE ADMIN SDK - SERVIDOR PRIVILEGIADO (SUGAR LUDO ADMIN & CASHIERS)
 * ============================================================================
 * Esta instancia corre EXCLUSIVAMENTE en el entorno de servidor (Node.js).
 * Nunca expone claves privadas al navegador ni a los clientes móviles.
 */

export const hasAdminCredentials = Boolean(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY ||
  (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
)

if (!admin.apps?.length) {
  try {
    // Opción 1: Archivo o JSON completo en variable de entorno
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'sweety-ludo-87343.firebasestorage.app'
      })
    } 
    // Opción 2: Variables individuales inyectadas por Render / Vercel
    else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        }),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'sweety-ludo-87343.firebasestorage.app'
      })
    } 
    // Opción 3: Entorno sin credenciales explícitas (desarrollo o Render sin clave de servicio)
    else {
      // Si no hay credenciales, inicializar una app mínima sin credenciales para satisfacer el contrato de Firebase SDK si es necesario
      console.warn('[FirebaseAdmin] No se detectaron credenciales de cuenta de servicio. Activando motor híbrido de respaldo.')
    }
  } catch (error) {
    console.error('[FirebaseAdmin] Error inicializando Firebase Admin SDK:', error)
  }
}

let rawAdminDb: any = null
try {
  if (hasAdminCredentials && admin.apps?.length) {
    rawAdminDb = admin.firestore()
  }
} catch {}

export const adminDb = rawAdminDb
export const adminAuth = (hasAdminCredentials && admin.apps?.length && typeof admin.auth === 'function')
  ? admin.auth()
  : null
export const adminStorage = (hasAdminCredentials && admin.apps?.length && typeof admin.storage === 'function')
  ? admin.storage()
  : null

export { admin }

