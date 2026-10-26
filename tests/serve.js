// Mini serveur statique pour les tests E2E : sert public/ comme Firebase Hosting (cleanUrls : /admin -> admin.html).
// Aucune dépendance. Usage : node tests/serve.js [port]
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'public');
const PORT = Number(process.argv[2] || process.env.PORT || 4173);
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.css': 'text/css; charset=utf-8', '.ico': 'image/x-icon',
};

function resolve(urlPath) {
  const clean = path.normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  const candidates = [clean, clean + '.html', path.join(clean, 'index.html')];
  for (const c of candidates) {
    const full = path.join(ROOT, c);
    if (full.startsWith(ROOT) && fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

http.createServer((req, res) => {
  const file = resolve(req.url === '/' ? '/index.html' : req.url);
  if (!file) { res.writeHead(404); res.end('Not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1', () => console.log(`public/ servi sur http://localhost:${PORT}`));
