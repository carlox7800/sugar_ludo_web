const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const OUT_DIR = path.join(__dirname, 'out');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

// ================= IN-MEMORY SOCIAL RELAY ($0.00 FIRESTORE) =================
const memoryPresenceMap = new Map(); // uid -> { status, ts }
const sseClients = new Map(); // uid -> Set<http.ServerResponse>
const pendingEvents = new Map(); // uid -> Array<event>

// ================= RATE LIMITING & ANTI-DDOS IN MEMORY ($0.00) =================
const rateLimitStore = new Map(); // ip -> { previousCount, currentCount, windowStart, lastUpdated }
const sseIpConnections = new Map(); // ip -> Set<http.ServerResponse>
const MAX_SSE_PER_IP = 10;
const SOCIAL_EVENT_LIMIT = 60; // 60 req/min
const WINDOW_MS = 60000;

function getClientIp(req) {
  const cfIp = req.headers['cf-connecting-ip'];
  if (cfIp && cfIp.trim().length > 0) return cfIp.trim();
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = forwarded.split(',')[0].trim();
    if (first.length > 0) return first;
  }
  const realIp = req.headers['x-real-ip'];
  if (realIp && realIp.trim().length > 0) return realIp.trim();
  return req.socket.remoteAddress || '127.0.0.1';
}

function checkSocialRateLimit(ip, limit = SOCIAL_EVENT_LIMIT, windowMs = WINDOW_MS) {
  const now = Date.now();
  let entry = rateLimitStore.get(ip);
  if (!entry) {
    entry = { previousCount: 0, currentCount: 1, windowStart: now, lastUpdated: now };
    rateLimitStore.set(ip, entry);
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetTime: Math.ceil((now + windowMs) / 1000),
      retryAfter: 0
    };
  }

  const elapsed = now - entry.windowStart;
  if (elapsed >= 2 * windowMs) {
    entry.previousCount = 0;
    entry.currentCount = 1;
    entry.windowStart = now;
    entry.lastUpdated = now;
    return {
      allowed: true,
      limit,
      remaining: limit - 1,
      resetTime: Math.ceil((now + windowMs) / 1000),
      retryAfter: 0
    };
  }

  if (elapsed >= windowMs) {
    entry.previousCount = entry.currentCount;
    entry.currentCount = 1;
    entry.windowStart = entry.windowStart + windowMs;
    entry.lastUpdated = now;

    const newElapsed = now - entry.windowStart;
    const weight = Math.max(0, 1 - (newElapsed / windowMs));
    const estimated = entry.currentCount + (entry.previousCount * weight);
    const allowed = estimated <= limit;
    return {
      allowed,
      limit,
      remaining: Math.max(0, Math.floor(limit - estimated)),
      resetTime: Math.ceil((entry.windowStart + windowMs) / 1000),
      retryAfter: allowed ? 0 : 10
    };
  }

  const weight = Math.max(0, 1 - (elapsed / windowMs));
  const estimated = entry.currentCount + (entry.previousCount * weight);
  if (estimated >= limit) {
    entry.lastUpdated = now;
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetTime: Math.ceil((entry.windowStart + windowMs) / 1000),
      retryAfter: Math.max(1, Math.min(10, Math.ceil((entry.windowStart + windowMs - now) / 1000)))
    };
  }

  entry.currentCount += 1;
  entry.lastUpdated = now;
  const newEstimated = entry.currentCount + (entry.previousCount * weight);
  return {
    allowed: true,
    limit,
    remaining: Math.max(0, Math.floor(limit - newEstimated)),
    resetTime: Math.ceil((entry.windowStart + windowMs) / 1000),
    retryAfter: 0
  };
}

// Auto-GC periódico cada 5 minutos para respetar los 512 MB de RAM en Render
const rateLimitGcTimer = setInterval(() => {
  const now = Date.now();
  const threshold = now - 120000;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.lastUpdated < threshold) {
      rateLimitStore.delete(key);
    }
  }
}, 300000);
if (rateLimitGcTimer.unref) rateLimitGcTimer.unref();

function clearPendingDuels(uid) {
  if (!uid) return;
  const key = uid.toLowerCase();
  const queue = pendingEvents.get(key);
  if (queue) {
    const filtered = queue.filter(ev => ev.type !== 'duel_invite');
    if (filtered.length > 0) {
      pendingEvents.set(key, filtered);
    } else {
      pendingEvents.delete(key);
    }
  }
}

function broadcastToSSE(targetUid, eventData) {
  const json = JSON.stringify(eventData);
  if (targetUid) {
    const key = targetUid.toLowerCase();
    const clients = sseClients.get(key);
    let delivered = false;
    if (clients && clients.size > 0) {
      for (const clientRes of clients) {
        try {
          clientRes.write(`data: ${json}\n\n`);
          delivered = true;
        } catch {}
      }
    }
    // Only queue if not delivered in real-time and it's a new duel invite
    if (!delivered && eventData.type === 'duel_invite') {
      let queue = pendingEvents.get(key);
      if (!queue) {
        queue = [];
        pendingEvents.set(key, queue);
      }
      queue.push(eventData);
      if (queue.length > 10) queue.shift();
    }
  } else {
    // Broadcast to all active SSE clients
    for (const [uid, clients] of sseClients.entries()) {
      for (const clientRes of clients) {
        try {
          clientRes.write(`data: ${json}\n\n`);
        } catch {}
      }
    }
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.apk':  'application/vnd.android.package-archive',
  '.exe':  'application/octet-stream',
  '.zip':  'application/zip',
  '.webmanifest': 'application/manifest+json',
};

const server = http.createServer((req, res) => {
  try {
    const hostHeader = req.headers.host || 'localhost';
    const parsedUrl = new URL(req.url, `http://${hostHeader}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    // 1. Healthcheck endpoints for Render / Cloud Probes
    if (pathname === '/health' || pathname === '/healthz' || pathname === '/ping' || pathname === '/api/health') {
      res.writeHead(200, {
        'Content-Type': 'text/plain',
        'Cache-Control': 'no-store, no-cache',
        'Access-Control-Allow-Origin': '*'
      });
      res.end('OK');
      return;
    }

    // 2. CORS Preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      res.end();
      return;
    }

    // 3. IN-MEMORY SOCIAL RELAY ENDPOINTS ($0.00 FIRESTORE)
    if (pathname === '/api/social/event' && req.method === 'POST') {
      const clientIp = getClientIp(req);
      const rl = checkSocialRateLimit(clientIp);
      if (!rl.allowed) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(rl.retryAfter),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetTime)
        });
        res.end(JSON.stringify({
          success: false,
          error: 'Demasiadas solicitudes. Límite de tasa excedido para eventos sociales.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rl.retryAfter
        }));
        return;
      }

      let bodyStr = '';
      req.on('data', chunk => { bodyStr += chunk; });
      req.on('end', () => {
        try {
          const payload = JSON.parse(bodyStr || '{}');
          if (payload.type === 'presence' && payload.uid) {
            memoryPresenceMap.set(payload.uid, {
              status: payload.status,
              ts: Date.now()
            });
            // Broadcast presence change to all clients
            broadcastToSSE(null, payload);
          } else if (payload.type === 'presence_query') {
            // No action needed; will return presence in response
          } else if (payload.type === 'duel_invite' && payload.challenge) {
            const targetUid = payload.challenge.targetUid;
            broadcastToSSE(targetUid, payload);
          } else if (payload.type === 'duel_ack' && payload.targetUid) {
            broadcastToSSE(payload.targetUid, payload);
          } else if (payload.type === 'duel_response' && payload.senderUid) {
            clearPendingDuels(payload.senderUid);
            clearPendingDuels(payload.targetUid);
            broadcastToSSE(payload.senderUid, payload);
          } else if (payload.type === 'duel_cancel' && payload.targetUid) {
            clearPendingDuels(payload.targetUid);
            clearPendingDuels(payload.senderUid);
            broadcastToSSE(payload.targetUid, payload);
          } else if (payload.type === 'p2p_data' && payload.targetUid) {
            broadcastToSSE(payload.targetUid, payload);
          }

          const currentMap = {};
          for (const [k, v] of memoryPresenceMap.entries()) {
            currentMap[k] = v.status;
          }

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
            'X-RateLimit-Limit': String(rl.limit),
            'X-RateLimit-Remaining': String(rl.remaining),
            'X-RateLimit-Reset': String(rl.resetTime)
          });
          res.end(JSON.stringify({ success: true, presence: currentMap }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ success: false, error: err.message }));
        }
      });
      return;
    }

    if (pathname === '/api/social/stream') {
      const clientIp = getClientIp(req);
      let ipClients = sseIpConnections.get(clientIp);
      if (!ipClients) {
        ipClients = new Set();
        sseIpConnections.set(clientIp, ipClients);
      }
      if (ipClients.size >= MAX_SSE_PER_IP) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Retry-After': '30'
        });
        res.end(JSON.stringify({
          success: false,
          error: 'Límite de conexiones simultáneas en tiempo real excedido para esta IP.',
          code: 'SSE_LIMIT_EXCEEDED',
          retryAfter: 30
        }));
        return;
      }

      const uid = (parsedUrl.searchParams.get('uid') || '').toLowerCase();
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

      ipClients.add(res);

      if (uid) {
        let clients = sseClients.get(uid);
        if (!clients) {
          clients = new Set();
          sseClients.set(uid, clients);
        }
        clients.add(res);

        // Send initial presence map
        const currentMap = {};
        for (const [k, v] of memoryPresenceMap.entries()) {
          currentMap[k] = v.status;
        }
        res.write(`data: ${JSON.stringify({ type: 'presence_batch', presence: currentMap })}\n\n`);

        // Send pending events if any
        const queue = pendingEvents.get(uid);
        if (queue && queue.length > 0) {
          for (const ev of queue) {
            res.write(`data: ${JSON.stringify(ev)}\n\n`);
          }
          pendingEvents.delete(uid);
        }

        req.on('close', () => {
          clients.delete(res);
          if (clients.size === 0) {
            sseClients.delete(uid);
          }
          ipClients.delete(res);
          if (ipClients.size === 0) {
            sseIpConnections.delete(clientIp);
          }
        });
      } else {
        req.on('close', () => {
          ipClients.delete(res);
          if (ipClients.size === 0) {
            sseIpConnections.delete(clientIp);
          }
        });
      }
      return;
    }

    if (pathname === '/api/social/presence') {
      const clientIp = getClientIp(req);
      const rl = checkSocialRateLimit(clientIp);
      if (!rl.allowed) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Retry-After': String(rl.retryAfter),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(rl.resetTime)
        });
        res.end(JSON.stringify({
          success: false,
          error: 'Demasiadas solicitudes. Límite de tasa excedido.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: rl.retryAfter
        }));
        return;
      }

      const currentMap = {};
      for (const [k, v] of memoryPresenceMap.entries()) {
        currentMap[k] = v.status;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
        'X-RateLimit-Limit': String(rl.limit),
        'X-RateLimit-Remaining': String(rl.remaining),
        'X-RateLimit-Reset': String(rl.resetTime)
      });
      res.end(JSON.stringify({ success: true, presence: currentMap }));
      return;
    }

    // 4. SPA File resolution
    let filePath = path.join(OUT_DIR, pathname);

    // Security: prevent directory traversal
    if (!filePath.startsWith(OUT_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      res.end('Forbidden');
      return;
    }

    // Directory check → serve index.html
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    // SPA fallback: if file doesn't exist, serve root index.html
    if (!fs.existsSync(filePath)) {
      filePath = path.join(OUT_DIR, 'index.html');
    }

    // If out directory is missing or index.html missing
    if (!fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<!DOCTYPE html><html><body><h1>Sugar Ludo</h1><p>Starting...</p></body></html>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
    const stat = fs.statSync(filePath);

    // For binary downloads, set Content-Disposition
    const isDownload = ['.exe', '.apk', '.zip'].includes(ext);
    const filename = path.basename(filePath);

    // Determinar política de caché HTTP granular
    let cacheControl = 'public, max-age=86400'; // Default 1 día
    const isHtml = ext === '.html' || filePath.endsWith('index.html');
    const isNextStatic = pathname.startsWith('/_next/static/');
    const isPwaFile = pathname === '/manifest.json' || pathname === '/sw.js';
    const isHeavyMedia = ['.mp3', '.audio', '.woff', '.woff2', '.ttf', '.png', '.jpg', '.jpeg', '.svg', '.webp', '.ico'].includes(ext);

    if (isDownload) {
      cacheControl = 'no-store';
    } else if (isHtml) {
      // HTML y SPA fallback: siempre frescos para garantizar bundles actualizados tras despliegues
      cacheControl = 'no-cache, no-store, must-revalidate';
    } else if (isNextStatic) {
      // Next.js static chunks (con hash de contenido inmutable)
      cacheControl = 'public, max-age=31536000, immutable';
    } else if (isPwaFile) {
      // Manifest y Service Worker: revalidación inmediata
      cacheControl = 'public, max-age=0, must-revalidate';
    } else if (isHeavyMedia) {
      // Assets pesados (música, sprites, fuentes): 30 días de caché con SWR
      cacheControl = 'public, max-age=2592000, stale-while-revalidate=86400';
    }

    const headers = {
      'Content-Type': mimeType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': cacheControl,
      ...(isDownload ? { 'Content-Disposition': `attachment; filename="${filename}"` } : {})
    };

    // 4. Handle HEAD requests without piping body
    if (req.method === 'HEAD') {
      headers['Content-Length'] = stat.size;
      res.writeHead(200, headers);
      res.end();
      return;
    }

    // 5. Serve File Stream con compresión streaming para texto (.html, .js, .css, .json, .svg)
    const isCompressible = ['.html', '.js', '.css', '.json', '.svg', '.webmanifest'].includes(ext);
    const acceptEncoding = req.headers['accept-encoding'] || '';

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end();
    });

    if (isCompressible && /\bgzip\b/.test(acceptEncoding)) {
      headers['Content-Encoding'] = 'gzip';
      res.writeHead(200, headers);
      stream.pipe(zlib.createGzip()).pipe(res);
    } else if (isCompressible && /\bdeflate\b/.test(acceptEncoding)) {
      headers['Content-Encoding'] = 'deflate';
      res.writeHead(200, headers);
      stream.pipe(zlib.createDeflate()).pipe(res);
    } else {
      headers['Content-Length'] = stat.size;
      res.writeHead(200, headers);
      stream.pipe(res);
    }

  } catch (error) {
    console.error('Request handler error:', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
    }
    res.end('Internal Server Error');
  }
});

// Configure cloud reverse proxy timeouts
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

server.on('error', (err) => {
  console.error('❌ Sugar Ludo Server Error:', err);
});

server.listen(PORT, HOST, () => {
  console.log(`\n✅ Sugar Ludo Server running at: http://${HOST}:${PORT}`);
  console.log(`   Serving files from: ${OUT_DIR}\n`);
});
