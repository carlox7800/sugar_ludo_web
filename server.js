const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const OUT_DIR = path.join(__dirname, 'out');
const PORT = 3000;

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
  const parsedUrl = url.parse(req.url);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // SPA fallback: serve index.html for non-file paths
  let filePath = path.join(OUT_DIR, pathname);

  // Security: prevent directory traversal
  if (!filePath.startsWith(OUT_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  // Check if path points to a directory → serve index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // If file doesn't exist, serve root index.html (SPA)
  if (!fs.existsSync(filePath)) {
    filePath = path.join(OUT_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  const stat = fs.statSync(filePath);

  // For binary downloads, set Content-Disposition
  const isDownload = ['.exe', '.apk', '.zip'].includes(ext);
  const filename = path.basename(filePath);

  res.writeHead(200, {
    'Content-Type': mimeType,
    'Content-Length': stat.size,
    'Access-Control-Allow-Origin': '*',
    ...(isDownload ? {
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    } : {
      'Cache-Control': 'public, max-age=3600',
    }),
  });

  const stream = fs.createReadStream(filePath);
  stream.on('error', (err) => {
    console.error('Stream error:', err);
    res.end();
  });
  stream.pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n✅ Sugar Ludo Server running at: http://localhost:${PORT}`);
  console.log(`   Serving files from: ${OUT_DIR}\n`);
});
