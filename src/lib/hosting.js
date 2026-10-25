export function normalizeDomain(input = '') {
  const value = input.trim().toLowerCase();
  if (!value) return '';
  let url;
  try { url = new URL(value.includes('://') ? value : 'https://' + value); } catch { throw new Error('Enter a domain such as app.example.com.'); }
  const name = url.hostname;
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port || url.search || url.hash || !['', '/'].includes(url.pathname) ||
    name.length > 253 || !name.includes('.') || /^[\d.]+$/.test(name) || !name.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) {
    throw new Error('Enter a hostname without a port, path, or query, for example app.example.com.');
  }
  return name;
}
export function safeSourcePath(path) {
  return typeof path === 'string' && path.length <= 240 && !path.startsWith('/') &&
    !path.includes('\\') && !path.split('/').some(part => !part || part === '.' || part === '..');
}
const SECTION_PATHS = { '⚙️ config': '', '🎨 src': 'src/', '🎨 frontend/src': 'src/', '🔧 backend/server': 'server/', '🗄️ database': 'database/' };
export function filesFromCode(code = {}) {
  return Object.entries(code).flatMap(([section, files]) => Object.entries(files || {}).map(([name, content]) => ({
    path: (SECTION_PATHS[section] ?? (section + '/')) + name, content: String(content ?? ''),
  }))).filter(file => safeSourcePath(file.path));
}
export function codeFromFiles(files) {
  const config = {}, src = {};
  for (const file of files) {
    if (!safeSourcePath(file.path)) throw new Error('Invalid source file path.');
    if (file.path.startsWith('src/')) src[file.path.slice(4)] = file.content;
    else config[file.path] = file.content;
  }
  return { '⚙️ config': config, '🎨 src': src };
}
export const STATIC_SERVER = `import http from 'node:http';
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
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end('Method not allowed'); }
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end('Invalid URL'); }
  if (pathname.includes('\0') || pathname.split('/').some(part => part.startsWith('.'))) { res.writeHead(403); return res.end('Forbidden'); }
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
`;
export function withHostingFiles(source, project = {}, options = {}) {
  const domain = normalizeDomain(options.domain || '') || 'app.example.com';
  const files = new Map(source.filter(file => safeSourcePath(file.path)).map(file => [file.path, String(file.content || '')]));
  if (!files.has('package.json') || !files.has('index.html')) throw new Error('Generate a frontend package first. package.json and index.html are required.');
  const pkg = JSON.parse(files.get('package.json'));
  pkg.scripts = { ...pkg.scripts, dev: 'vite --host 127.0.0.1', build: 'vite build', preview: 'vite preview --host 127.0.0.1', start: 'node hosting/serve.mjs' };
  pkg.engines = { node: '>=22' };
  files.set('package.json', JSON.stringify(pkg, null, 2));
  files.set('hosting/serve.mjs', STATIC_SERVER);
  files.set('Dockerfile', [
    'FROM node:22-alpine AS build', 'WORKDIR /app', 'COPY package*.json ./', 'RUN npm install',
    'COPY . .', 'RUN npm run build', '', 'FROM node:22-alpine', 'ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000',
    'WORKDIR /app', 'COPY --from=build --chown=node:node /app/dist ./dist', 'COPY --from=build --chown=node:node /app/hosting ./hosting',
    'USER node', 'EXPOSE 3000', 'CMD ["node", "hosting/serve.mjs"]', '',
  ].join('\n'));
  files.set('.dockerignore', 'node_modules\ndist\n.git\n.env\n.env.*\n!.env.example\n');
  files.set('.gitignore', 'node_modules/\ndist/\n.env\n.env.*\n!.env.example\n');
  files.set('compose.yaml', [
    'services:', '  app:', '    build: .', '    ports:', '      - "127.0.0.1:3000:3000"', '    restart: unless-stopped',
    '  caddy:', '    image: caddy:2-alpine', '    profiles: ["domain"]', '    depends_on: [app]',
    '    ports:', '      - "80:80"', '      - "443:443"', '      - "443:443/udp"',
    '    volumes:', '      - ./hosting/Caddyfile:/etc/caddy/Caddyfile:ro', '      - caddy_data:/data', '      - caddy_config:/config',
    '    restart: unless-stopped', 'volumes:', '  caddy_data:', '  caddy_config:', '',
  ].join('\n'));
  files.set('hosting/Caddyfile', domain + ' {\n  encode zstd gzip\n  reverse_proxy app:3000\n}\n');
  files.set('netlify.toml', '[build]\n  command = "npm run build"\n  publish = "dist"\n\n[[redirects]]\n  from = "/*"\n  to = "/index.html"\n  status = 200\n');
  files.set('vercel.json', JSON.stringify({ buildCommand: 'npm run build', outputDirectory: 'dist', rewrites: [{ source: '/((?!assets/).*)', destination: '/index.html' }] }, null, 2));
  files.set('hosting/deployment.json', JSON.stringify({ name: project.name, domain: options.domain || '', target: options.target || 'local', frontend: 'Vite + React',
    data_mode: 'browser-local', prepared_at: new Date().toISOString(), status: 'package_ready' }, null, 2));
  files.set('HOSTING.md', [
    '# ' + (project.name || 'Application') + ' — Hosting',
    '', '## Local development', '', 'Install Node.js 22 or newer, then:', '',
    '    npm install', '    npm run dev', '', 'Open the URL printed by Vite (normally http://localhost:5173).',
    '', '## Local production build', '', '    npm run build', '    npm start', '', 'Open http://localhost:3000. Deep links fall back to index.html. Set PORT to choose another port.',
    'The server binds to 127.0.0.1 by default. Set HOST=0.0.0.0 only when you want other machines to access it.',
    '', '## Docker on localhost', '', '    docker compose up --build -d app', '', 'Open http://localhost:3000.',
    '', '## Custom domain with automatic HTTPS', '',
    '1. Point the DNS A record for ' + domain + ' to the public IPv4 address of your server.',
    '2. Add an AAAA record only if your server has working public IPv6.',
    '3. Allow inbound TCP ports 80 and 443. Install Docker with the Compose plugin.',
    '4. Replace the example hostname in hosting/Caddyfile with a domain you control.',
    '5. Run: docker compose --profile domain up --build -d',
    '6. Open https://' + domain + '. Caddy obtains and renews the certificate after DNS resolves.',
    '', 'Check: docker compose ps', 'Logs: docker compose logs --tail=100 app caddy', 'Stop: docker compose --profile domain down',
    'Keep the Caddy data volumes to preserve certificates.',
    '', '## Static hosting', '', 'Build with npm run build and upload dist/. Netlify and Vercel configuration files include SPA deep-link routing.',
    '', '## Data and backend scope', '',
    'This package contains the generated React frontend. Generated record screens store data in this browser via localStorage.',
    'Browser-local records are scoped to an origin: localhost and your domain have separate data.',
    'It does not migrate the ArchitectAI builder, Base44 authentication, cloud integrations, or workflow execution.',
    'If you need shared data, accounts or API integrations, configure and secure a backend before production use.',
    'AI keys from the builder are never included. Keep API keys in a server-side environment, never in VITE_* variables.',
    '', 'A prepared package is not a deployed site. DNS, server installation and deployment run on infrastructure you control.',
    '',
  ].join('\n'));
  return [...files].map(([path, content]) => ({ path, content }));
}
