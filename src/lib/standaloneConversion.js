const textExtensions = /\.(?:[cm]?[jt]sx?|jsonc?|html?|css|scss|md|txt|toml|ya?ml|xml|svg|sql|sh|py|gitignore|dockerignore|env\.example)$/i;
export const safeArchivePath = path => typeof path === 'string' && path.length < 600 && !path.startsWith('/') && !path.includes('\\') && !/^[A-Za-z]:/.test(path) && !path.split('/').some(part => !part || part === '.' || part === '..');
export const isTextPath = path => textExtensions.test(path) || ['Dockerfile','.gitignore','.dockerignore','.env.example'].includes(path.split('/').at(-1));
export const excludedSourcePath = path => path.split('/').some(part => ['node_modules','.git','.DS_Store','__MACOSX'].includes(part)) || /(^|\/)\.env(?:\.|$)/.test(path) && !/\.env\.example$/.test(path) || /\.(?:pem|p12|pfx|key|sqlite|sqlite3|db)$/i.test(path);
function relative(from, target) {
  const parts = from.split('/'); parts.pop(); const destination = target.split('/');
  while (parts.length && destination.length && parts[0] === destination[0]) { parts.shift(); destination.shift(); }
  return (parts.map(() => '..').concat(destination).join('/').replace(/^(?!\.)/, './'));
}
function npmPackage(specifier) {
  const value = specifier.slice(4);
  const match = value.match(/^(@[^/]+\/[^/@]+|[^/@]+)(?:@([^/]+))?(\/.*)?$/);
  if (!match) throw new Error('Unsupported npm import: ' + specifier);
  return { name: match[1], version: match[2] || '*', path: match[1] + (match[3] || '') };
}
export function analyzeSource(files) {
  const map = new Map(files.map(file => [file.path, file.content]));
  const packageText = map.get('package.json');
  if (typeof packageText !== 'string') throw new Error('Select the application root containing package.json.');
  let pkg; try { pkg = JSON.parse(packageText); } catch { throw new Error('package.json is not valid JSON.'); }
  const entities = [], functions = [], actors = [], pages = [], environment = new Set(), sdkImports = new Set();
  for (const file of files) {
    if (/^base44\/entities\/[^/]+\.jsonc?$/.test(file.path) && typeof file.content === 'string') {
      try { entities.push({ path: file.path, schema: JSON.parse(file.content) }); } catch { throw new Error('Invalid entity JSON in ' + file.path); }
    }
    if (/^base44\/functions\/[^/]+\/entry\.[jt]s$/.test(file.path)) functions.push(file.path);
    if (/^base44\/actors\/[^/]+\/entry\.[jt]s$/.test(file.path)) actors.push(file.path);
    if (/^src\/pages\/.*\.[jt]sx?$/.test(file.path)) pages.push(file.path);
    if (typeof file.content !== 'string') continue;
    for (const match of file.content.matchAll(/(?:Deno\.env\.get|secrets\.get)\(["']([A-Z0-9_]+)["']/g)) environment.add(match[1]);
    for (const match of file.content.matchAll(/["'](npm:@base44\/sdk(?:@[^"']+)?|@base44\/sdk(?:\/[^"']+)?)["']/g)) sdkImports.add(match[1]);
  }
  const base44 = !!pkg.dependencies?.['@base44/sdk'] || entities.length > 0 || sdkImports.size > 0;
  return { package: pkg, framework: pkg.dependencies?.react && (pkg.devDependencies?.vite || pkg.dependencies?.vite) ? 'React + Vite' : 'Other',
    base44, entities, functions, actors, pages, environment: [...environment].sort(), sdk_imports: [...sdkImports] };
}
export function convertStandalone(sourceFiles, templates, options = {}) {
  const excluded = [], files = new Map();
  for (const file of sourceFiles) {
    if (!safeArchivePath(file.path)) throw new Error('Unsafe archive path: ' + file.path);
    if (excludedSourcePath(file.path)) { excluded.push(file.path); continue; }
    files.set(file.path, file.content);
  }
  const source = analyzeSource([...files].map(([path, content]) => ({ path, content })));
  if (source.framework !== 'React + Vite' || !source.base44) throw new Error('Automatic independent-backend conversion currently supports Base44 React/Vite source. This project can still be imported, edited and exported unchanged.');
  const report = { format: 'standalone-migration-v1', app_name: options.name || source.package.name, source_files: sourceFiles.length,
    pages: source.pages.length, entity_schemas: source.entities.length, backend_functions: source.functions.length, realtime_actors: source.actors.length,
    data_records_included: false, backend: 'Node.js 24 + SQLite', external_environment: source.environment.filter(name => !['BASE44_APP_ID','APP_URL'].includes(name)),
    excluded_paths: excluded, converted_functions: [], fixes: [], removed_credentials: [], verification: { build: 'not_run', runtime: 'not_run' },
    configuration_required: ['Create standalone user accounts; hosted passwords are not included.', 'Import live database records and files separately.', 'Configure keys or access tokens for external integrations.', 'Configure scheduled jobs and public webhook routes explicitly.'],
  };
  const pkg = structuredClone(source.package);
  const originalPackage = JSON.stringify(pkg, null, 2);
  for (const key of ['dependencies','devDependencies','optionalDependencies']) {
    if (!pkg[key]) continue;
    delete pkg[key]['@base44/sdk']; delete pkg[key]['@base44/vite-plugin']; delete pkg[key].base44;
  }
  pkg.engines = { ...pkg.engines, node: '>=24.12 <25' };
  pkg.scripts = { ...pkg.scripts, dev: 'node --env-file-if-exists=.env standalone/server/dev.mjs', 'dev:frontend': 'vite --host 127.0.0.1',
    start: 'node --env-file-if-exists=.env standalone/server/index.mjs', build: 'vite build', 'test:standalone': 'node --test standalone/tests/*.test.mjs' };
  pkg.dependencies ||= {}; pkg.dependencies.ws = '^8.18.3';
  for (const [path, content] of files) {
    if (typeof content !== 'string' || !/\.[cm]?[jt]sx?$/.test(path)) continue;
    let next = content;
    if (path.startsWith('base44/')) {
      next = next.replace(/\b(const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*(?:KEY|TOKEN|SECRET|PASSWORD|PASS)[A-Za-z0-9_$]*)\s*=\s*(["'])([^"'\n]{12,})\3/gi, (original,kind,name,quote,value) => {
        if (!/^[a-fA-F0-9]{24,}$/.test(value) && !value.startsWith('sk-') && !value.startsWith('re_') && !value.startsWith('ghp_') && !value.startsWith('eyJ')) return original;
        const environment = name === 'EXT_API_KEY' ? 'EMPLOYEE_SOURCE_API_KEY' : name === 'EXTERNAL_API_KEY' ? 'ATTENDANCE_SOURCE_API_KEY' : 'MIGRATED_' + name.toUpperCase();
        report.removed_credentials.push({path,variable:name,environment});
        if (!report.external_environment.includes(environment)) report.external_environment.push(environment);
        return kind + ' ' + name + " = (process.env." + environment + " || '')";
      });
      next = next.replace(/(["'])(npm:[^"'\s]+|base44:runtime(?:\/actors)?)\1/g, (_, quote, specifier) => {
        const target = specifier.startsWith('npm:@base44/sdk') ? 'standalone/server/sdk.mjs'
          : specifier === 'base44:runtime/actors' ? 'standalone/server/actors.mjs'
          : specifier === 'base44:runtime' ? 'standalone/server/context.mjs' : '';
        if (target) return quote + relative(path, target) + quote;
        const dependency = npmPackage(specifier); pkg.dependencies[dependency.name] ||= dependency.version;
        return quote + dependency.path + quote;
      });
      if (source.functions.includes(path) && /\bDeno\.serve\s*\(/.test(next)) {
        next = next.replace(/\bDeno\.serve\s*\(/, 'export default ('); report.converted_functions.push(path);
      }
      next = next.replace(/(["'])https:\/\/(?:sara-global-s4(?:-copy)?\.base44\.app|s4\.saraglobal\.lk)([^"']*)\1/g, (_, quote, suffix) => '(process.env.APP_URL + ' + JSON.stringify(suffix) + ')');
      next = next.replace(/(['"])https:\/\/app\.base44\.com\1/g, "'http://localhost:3000'");
      if (path === 'base44/functions/syncEmployees/entry.ts') {
        next = next.replace(/(['"])https:\/\/base44\.app\/api\/apps\/[^/]+\/entities\/Employee\1/g, "(process.env.EMPLOYEE_SOURCE_URL || '')");
        if (!report.external_environment.includes('EMPLOYEE_SOURCE_URL')) report.external_environment.push('EMPLOYEE_SOURCE_URL');
        report.configuration_required.push('External employee synchronization needs EMPLOYEE_SOURCE_URL or a separate data import.');
      }
      if (path === 'base44/functions/syncPMAttendance/entry.ts') {
        next = next.replace(/const externalClient = createClient\(\{[\s\S]*?\n\}\);/, "const externalClient = { entities: { Attendance: { list: async () => { const url = process.env.ATTENDANCE_SOURCE_URL; if (!url) throw new Error('Configure ATTENDANCE_SOURCE_URL for external attendance synchronization.'); const response = await fetch(url, { headers: process.env.ATTENDANCE_SOURCE_API_KEY ? { [process.env.ATTENDANCE_SOURCE_AUTH_HEADER || 'api_key']: process.env.ATTENDANCE_SOURCE_API_KEY } : {} }); if (!response.ok) throw new Error('External attendance API returned HTTP ' + response.status); const data = await response.json(); const rows = Array.isArray(data) ? data : data.records || data.data; if (!Array.isArray(rows)) throw new Error('External attendance API must return an array of records.'); return rows; } } } };");
        for (const key of ['ATTENDANCE_SOURCE_URL','ATTENDANCE_SOURCE_AUTH_HEADER']) if (!report.external_environment.includes(key)) report.external_environment.push(key);
      }
      next = next.replace(/const resend = new Resend\(Deno\.env\.get\(["']RESEND_API_KEY["']\)\);/, "const resend = { emails: { send: async data => { if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) throw new Error('Configure RESEND_API_KEY and EMAIL_FROM for notification emails.'); return new Resend(process.env.RESEND_API_KEY).emails.send({ ...data, from: process.env.EMAIL_FROM }); } } };");
    }
    if (path === 'base44/actors/S4SheetRoom/entry.ts' && next.includes('    if (!sheet) return conn.reject')) {
      next = next.replace("    if (!sheet) return conn.reject(4004, 'Sheet not found');", "    if (!sheet) return conn.reject(4004, 'Sheet not found');\n    if (sheet.room_id !== this.options.id) return conn.reject(4003, 'Spreadsheet does not belong to this room');");
      report.fixes.push('Bind spreadsheet collaboration to its configured room ID.');
    }
    // Application-owned callback examples become relative URLs in browser source.
    if (path.startsWith('src/') || path.startsWith('browser-extension/') || path.startsWith('canva-app/')) {
      if (path.startsWith('src/') && !path.startsWith('src/canva-app/')) {
        next = next.replace(/https:\/\/(?:sara-global-s4(?:-copy)?\.base44\.app|s4\.saraglobal\.lk)\/login(?:\?[^"'\s`]*)?/gi, '/standalone-login');
        next = next.replace(/https:\/\/(?:sara-global-s4(?:-copy)?\.base44\.app|s4\.saraglobal\.lk)(?=\/)/g, '');
      } else next = next.replace(/https:\/\/(?:sara-global-s4(?:-copy)?\.base44\.app|s4\.saraglobal\.lk)(?=\/)/g, options.publicUrl || 'http://localhost:3000');
    }
    for (const [url, local] of Object.entries(options.assetMap || {})) {
      if (path.startsWith('base44/')) next = next.split(JSON.stringify(url)).join('(process.env.APP_URL + ' + JSON.stringify(local) + ')').split("'" + url + "'").join('(process.env.APP_URL + ' + JSON.stringify(local) + ')');
      else next = next.split(url).join(local);
    }
    files.set(path, next);
  }
  for (const [path,content] of files) if (path.startsWith('browser-extension/') && path.endsWith('/manifest.json') && typeof content === 'string') {
    const manifest = JSON.parse(content), target = new URL(options.publicUrl || 'http://localhost:3000'), pattern = target.protocol + '//' + target.hostname + '/*';
    manifest.host_permissions = [...new Set([...(manifest.host_permissions || []).filter(value => !value.includes('base44.app') && !value.includes('s4.saraglobal.lk')),pattern])];
    for (const script of manifest.content_scripts || []) if (script.js?.some(value => value.includes('content-s4'))) script.matches = [pattern];
    files.set(path,JSON.stringify(manifest,null,2));
  }
  for (const file of templates) files.set(file.path, file.content);
  files.set('migration/original-package.json', originalPackage);
  if (files.has('vite.config.js')) files.set('migration/original-vite.config.txt', files.get('vite.config.js'));
  files.delete('package-lock.json');
  files.set('package.json', JSON.stringify(pkg, null, 2) + '\n');
  files.set('vite.config.js', [
    "import { defineConfig } from 'vite';", "import react from '@vitejs/plugin-react';", "import { fileURLToPath, URL } from 'node:url';",
    "const local = path => fileURLToPath(new URL(path, import.meta.url));",
    "export default defineConfig({ plugins: [react()], resolve: { dedupe: ['react','react-dom'], alias: [",
    " { find: '@base44/sdk/dist/utils/axios-client', replacement: local('./standalone/browser/axios-client.js') },",
    " { find: /^@base44\\/sdk$/, replacement: local('./standalone/browser/sdk.js') },",
    " { find: '@', replacement: local('./src') }",
    "] }, optimizeDeps: { include: ['react','react-dom'] }, server: { proxy: { '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true, ws: true }, '/functions': { target: 'http://127.0.0.1:3000', changeOrigin: true }, '/standalone-login': { target: 'http://127.0.0.1:3000', changeOrigin: true } } } });",
  ].join('\n'));
  const domain = options.domain || 'app.example.com';
  if (!/^[a-zA-Z0-9.-]+$/.test(domain) || !domain.includes('.') || /(^|\.)-|-($|\.)/.test(domain)) throw new Error('Enter a valid custom-domain hostname.');
  files.set('Dockerfile', [
    'FROM node:24-alpine AS build','WORKDIR /app','COPY package*.json ./','RUN npm install','COPY . .','RUN npm run build',
    'FROM node:24-alpine','WORKDIR /app','ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000',
    'COPY --from=build --chown=node:node /app/package*.json ./','COPY --from=build --chown=node:node /app/node_modules ./node_modules',
    'COPY --from=build --chown=node:node /app/dist ./dist','COPY --from=build --chown=node:node /app/base44 ./base44',
    'COPY --from=build --chown=node:node /app/standalone ./standalone','RUN mkdir -p /app/data && chown node:node /app/data','USER node','EXPOSE 3000','CMD ["node","standalone/server/index.mjs"]','',
  ].join('\n'));
  files.set('compose.yaml', [
    'services:','  app:','    build: .','    env_file: .env','    environment:','      HOST: 0.0.0.0','    ports:','      - "127.0.0.1:3000:3000"','    volumes:','      - app_data:/app/data','    restart: unless-stopped',
    '  caddy:','    image: caddy:2-alpine','    profiles: ["domain"]','    depends_on: [app]','    ports:','      - "80:80"','      - "443:443"','      - "443:443/udp"',
    '    volumes:','      - ./standalone/Caddyfile:/etc/caddy/Caddyfile:ro','      - caddy_data:/data','      - caddy_config:/config','    restart: unless-stopped',
    'volumes:','  app_data:','  caddy_data:','  caddy_config:','',
  ].join('\n'));
  files.set('standalone/Caddyfile', domain + ' {\n  encode zstd gzip\n  reverse_proxy app:3000\n}\n');
  files.set('.dockerignore', 'node_modules\ndist\ndata\n.git\n.env\n.env.*\n!.env.example\nmigration\n');
  files.set('.gitignore', String(files.get('.gitignore') || '') + '\nnode_modules/\ndist/\ndata/\n.env\n.env.*\n!.env.example\n');
  const env = ['# Copy this file to .env. Set your own admin credentials before first launch.','PUBLIC_URL=' + (options.publicUrl || 'http://localhost:3000'),'HOST=127.0.0.1','PORT=3000',
    'DATABASE_PATH=data/app.sqlite','UPLOAD_DIR=data/uploads','ADMIN_EMAIL=','ADMIN_PASSWORD=','ADMIN_NAME=Administrator','ALLOW_SIGNUP=false',
    '# AI_PROVIDER: openai, anthropic, gemini, compatible','AI_PROVIDER=','AI_MODEL=','AI_BASE_URL=','AI_API_KEY=','AI_JSON_MODE=true','OPENAI_API_KEY=','ANTHROPIC_API_KEY=','GEMINI_API_KEY=',
    'AI_IMAGE_MODEL=','AI_TRANSCRIPTION_MODEL=whisper-1','RESEND_API_KEY=','EMAIL_FROM=',
    '# Add a comma-separated allowlist only after verifying webhook authentication.','PUBLIC_FUNCTIONS=',
    '# Example app-scoped OAuth token; use the provider type requested by your functions.','CONNECTOR_GOOGLEDRIVE_ACCESS_TOKEN='];
  for (const key of report.external_environment) if (!env.some(line => line.startsWith(key + '='))) env.push(key + '=');
  files.set('.env.example', env.join('\n') + '\n');
  files.set('migration/report.json', JSON.stringify(report, null, 2));
  return { files: [...files].map(([path, content]) => ({ path, content })), report };
}
