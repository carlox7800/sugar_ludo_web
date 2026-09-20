/**
 * ============================================================================
 * SUGAR LUDO — SERVICE WORKER PWA DE ALTO RENDIMIENTO (v9.4.7)
 * ============================================================================
 * Diseñado para aceleración móvil, carga instantánea de assets pesados y
 * resiliencia offline sin interferir en llamadas en tiempo real ni APIs.
 *
 * CANDADOS TÉCNICOS ESTRICTOS:
 * 1. NUNCA intercepta ni cachea peticiones a /api/* ni /api/social/stream (SSE).
 * 2. NUNCA intercepta Firebase Firestore, Auth, Storage ni WebSockets.
 * 3. Auto-purga de cachés de versiones anteriores en cada ciclo de activación.
 */

const CACHE_NAME = 'sugar-ludo-v9.4.7';

// Activos críticos pre-cacheados en la instalación
const PRECACHE_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/apple-icon.png',
  '/icon.svg',
  '/placeholder-logo.png'
];

// Dominios e IPs de infraestructura externa exentos de Service Worker
const EXCLUDED_HOSTS = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'fcm.googleapis.com',
  'apis.google.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[SW] Advertencia al pre-cachear activos:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('sugar-ludo-') && key !== CACHE_NAME) {
            console.log('[SW] Purgando caché obsoleta:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Candado: Solo procesar peticiones HTTP/HTTPS con método GET
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // 2. Candado: Excluir rutas de API, health checks y eventos en tiempo real (SSE)
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname === '/health' ||
    url.pathname === '/healthz' ||
    url.pathname === '/ping'
  ) {
    return;
  }

  // 3. Candado: Excluir infraestructura de Firebase y Google APIs
  if (EXCLUDED_HOSTS.some((host) => url.hostname.includes(host))) {
    return;
  }

  // 4. Estrategia Network-First para navegación HTML (garantiza código fresco tras despliegues)
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          const fallback = await caches.match('/');
          return fallback || new Response('Sugar Ludo Offline', { headers: { 'Content-Type': 'text/html' } });
        })
    );
    return;
  }

  // 5. Estrategia Stale-While-Revalidate / Cache-First para assets estáticos y fuentes
  const isStaticAsset =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.jpeg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.ico') ||
    url.pathname.endsWith('.woff') ||
    url.pathname.endsWith('.woff2') ||
    url.pathname.endsWith('.ttf') ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com';

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        }).catch(() => {
          // Ignorar fallos de red silenciosamente si ya hay caché
        });

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
