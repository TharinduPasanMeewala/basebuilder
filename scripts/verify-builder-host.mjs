import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const socket = createServer();
await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
const loader = "globalThis.fetch = async (url, init) => Response.json({ url, method: init.method, authorization: init.headers.get('authorization'), appId: init.headers.get('x-app-id'), cookie: init.headers.get('cookie'), body: init.body ? init.body.toString() : '' }); await import(" + JSON.stringify(pathToFileURL(resolve('hosting/serve.mjs')).href) + ");";
const child = spawn(process.execPath, ['--input-type=module', '-e', loader], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port) }, stdio: ['ignore', 'pipe', 'pipe'] });
try {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Builder server did not start')), 10000);
    child.stdout.once('data', () => { clearTimeout(timer); resolve(); }); child.once('error', reject);
  });
  const base = 'http://127.0.0.1:' + port;
  assert.equal((await fetch(base)).status, 200);
  assert.equal((await fetch(base + '/projects/example')).status, 200);
  assert.equal((await fetch(base + '/assets/not-present.js')).status, 404);
  assert.equal((await fetch(base + '/.env')).status, 403);
  assert.equal((await fetch(base + '/private', { method: 'DELETE' })).status, 405);
  const path = '/api/apps/6a2a34f6f3a1ed50ecd8de02/functions/ai-gateway';
  const response = await fetch(base + path, {
    method: 'POST', headers: { Authorization: 'Bearer test-only-token', 'X-App-Id': 'test-app', Cookie: 'unrelated=test', 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'list' }),
  });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.url, 'https://base44.app' + path);
  assert.equal(result.authorization, 'Bearer test-only-token');
  assert.equal(result.appId, 'test-app');
  assert.equal(result.cookie, null);
  assert.equal(result.method, 'POST');
  assert.equal(JSON.parse(result.body).action, 'list');
  console.log('PASS builder production host: SPA routes, static assets, hidden files, HTTP methods, fixed Base44 proxy, authorization and request-body forwarding, cookie isolation');
} finally { child.kill('SIGTERM'); await new Promise(resolve => child.once('close', resolve)); }
