const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'out');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

// ================= IN-MEMORY SOCIAL RELAY ($0.00 FIRESTORE) =================
const memoryPresenceMap = new Map(); // uid -> { status, ts }
const sseClients = new Map(); // uid -> Set<http.ServerResponse>
const pendingEvents = new Map(); // uid -> Array<event>

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
            'Cache-Control': 'no-store'
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
      const uid = (parsedUrl.searchParams.get('uid') || '').toLowerCase();
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      });

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
        });
      }
      return;
    }

    if (pathname === '/api/social/presence') {
      const currentMap = {};
      for (const [k, v] of memoryPresenceMap.entries()) {
        currentMap[k] = v.status;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store'
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

    const headers = {
      'Content-Type': mimeType,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
      ...(isDownload ? {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      } : {
        'Cache-Control': 'public, max-age=3600',
      }),
    };

    // 4. Handle HEAD requests without piping body
    if (req.method === 'HEAD') {
      res.writeHead(200, headers);
      res.end();
      return;
    }

    // 5. Serve File Stream
    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
      }
      res.end();
    });
    stream.pipe(res);

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
