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

if (!admin.apps.length) {
  try {
    // Opción 1: Archivo o JSON completo en variable de entorno
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY)
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'sugar-ludo-web.appspot.com'
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
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'sugar-ludo-web.appspot.com'
      })
    } 
    // Opción 3: Entorno de desarrollo local / Google Application Default Credentials
    else {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'sugar-ludo-web'
      })
      console.warn('[FirebaseAdmin] Inicializado con credenciales predeterminadas/desarrollo.')
    }
  } catch (error) {
    console.error('[FirebaseAdmin] Error inicializando Firebase Admin SDK:', error)
  }
}

export const adminDb = admin.firestore()
export const adminAuth = admin.auth()
export const adminStorage = admin.storage()

export { admin }
