// Serve the Expo web export (dist/) the way Vercel does with this repo's vercel.json:
// filesystem first (with cleanUrls: /menu -> menu.html, /menu.html -> 308 /menu),
// then `rewrites`, then 404.html with status 404. Local verification only.
// Usage: node scripts/serve-vercel-static.mjs [port] [vercel.json path]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.DIST_DIR || 'dist');
const port = Number(process.argv[2] || process.env.PORT || 4173);
const config = JSON.parse(fs.readFileSync(process.argv[3] || 'vercel.json', 'utf8'));
const cleanUrls = config.cleanUrls === true;
const rewrites = (config.rewrites || []).map((r) => ({
  re: new RegExp(`^${r.source.replace(/:(\w+)\*/g, '(?<$1>.*)').replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
  destination: r.destination,
}));
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.woff': 'font/woff' };

const fileFor = (p) => {
  const safe = path.normalize(decodeURIComponent(p)).replace(/^(\.\.[/\\])+/, '');
  const candidates = [safe];
  if (cleanUrls) candidates.push(`${safe.replace(/\/$/, '')}.html`, path.join(safe, 'index.html'));
  else candidates.push(path.join(safe, 'index.html'));
  for (const c of candidates) {
    const f = path.join(root, c);
    if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
};
const send = (res, file, status = 200) => {
  res.writeHead(status, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
};

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let p = url.pathname;
  if (cleanUrls && p.endsWith('.html')) {
    const target = p.replace(/(\/index)?\.html$/, '') || '/';
    res.writeHead(308, { location: target + url.search });
    return res.end();
  }
  let file = fileFor(p);
  if (!file) {
    for (const r of rewrites) {
      const m = p.match(r.re);
      if (m) {
        file = fileFor(r.destination.replace(/\$(\d+)/g, (_, i) => m[i] ?? '').replace(/:(\w+)/g, (_, k) => m.groups?.[k] ?? ''));
        break;
      }
    }
  }
  if (file) return send(res, file);
  const notFound = path.join(root, '404.html');
  if (fs.existsSync(notFound)) return send(res, notFound, 404);
  res.writeHead(404).end('Not found');
}).listen(port, () => console.log(`vercel-like static server on http://localhost:${port} (cleanUrls=${cleanUrls})`));
