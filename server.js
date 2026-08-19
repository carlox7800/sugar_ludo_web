const http = require('http');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, 'out');
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = '0.0.0.0';

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
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': '*'
      });
      res.end();
      return;
    }

    // 3. SPA File resolution
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
