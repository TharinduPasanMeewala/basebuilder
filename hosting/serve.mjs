import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve(process.env.STATIC_DIR || 'dist');
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json' };
const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end('Invalid URL'); }
  if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); return res.end('Forbidden'); }

  if (pathname.startsWith('/api/')) {
    // Fixed upstream: browser credentials are forwarded only to Base44.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers)) {
        if (['authorization', 'content-type', 'accept', 'x-app-id', 'x-functions-version', 'base44-functions-version'].includes(name) || name.startsWith('x-base44-')) {
          if (value) headers.set(name, Array.isArray(value) ? value.join(',') : value);
        }
      }
      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 20 * 1024 * 1024) { res.writeHead(413); return res.end('Request too large'); }
        chunks.push(chunk);
      }
      const upstream = await fetch('https://base44.app' + req.url, {
        method: req.method, headers, signal: controller.signal, redirect: 'manual',
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : Buffer.concat(chunks),
      });
      res.statusCode = upstream.status;
      for (const name of ['content-type', 'location', 'retry-after']) {
        const value = upstream.headers.get(name); if (value) res.setHeader(name, value);
      }
      res.setHeader('Cache-Control', 'no-store');
      if (req.method === 'HEAD') return res.end();
      const reader = upstream.body?.getReader();
      if (reader) for (;;) {
        const item = await reader.read(); if (item.done) break;
        if (!res.write(Buffer.from(item.value))) await new Promise(resolve => res.once('drain', resolve));
      }
      return res.end();
    } catch {
      if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Could not reach the Base44 backend. Check internet access and try again.' }));
    } finally { clearTimeout(timeout); }
  }

  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end('Method not allowed'); }
  let file = resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + sep)) { res.writeHead(403); return res.end('Forbidden'); }
  try {
    let info = await stat(file).catch(() => null);
    if (info?.isDirectory()) { file = resolve(file, 'index.html'); info = await stat(file).catch(() => null); }
    if (!info?.isFile()) {
      if (extname(pathname) || pathname.startsWith('/api/')) { res.writeHead(404); return res.end('Not found'); }
      file = resolve(root, 'index.html'); info = await stat(file).catch(() => null);
    }
    if (!info?.isFile()) { res.writeHead(503); return res.end('Build the app with npm run build first.'); }
    res.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Content-Length': info.size,
      'Cache-Control': extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600' });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).on('error', () => res.destroy()).pipe(res);
  } catch { res.writeHead(500); res.end('Unable to serve this request.'); }
});
server.listen(port, host, () => console.log('App ready on http://' + host + ':' + port));
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => server.close(() => process.exit(0)));
