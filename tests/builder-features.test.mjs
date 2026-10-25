import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeConnection, validateEndpoint, isPrivateAddress, buildProviderRequest, extractContent, parseModelJSON } from '../base44/functions/ai-gateway/protocol.js';
import { normalizeDomain, safeSourcePath, withHostingFiles, filesFromCode, codeFromFiles } from '../src/lib/hosting.js';
import { initialHistory, visualHistory } from '../src/lib/visualHistory.js';

const connection = { name: 'My model', provider: 'openai', model: 'exact-model-id', api_key: 'test-key', base_url: 'https://api.openai.com/v1', json_mode: true, supports_images: true };
test('OpenAI protocol carries the selected model and server-side key', () => {
  const request = buildProviderRequest(connection, { prompt: 'Hello', response_json_schema: { type: 'object' } });
  assert.equal(request.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(request.body.model, 'exact-model-id');
  assert.equal(request.headers.Authorization, 'Bearer test-key');
  assert.deepEqual(request.body.response_format, { type: 'json_object' });
});
test('Compatible APIs do not require JSON mode or an API key', () => {
  const request = buildProviderRequest({ ...connection, provider: 'compatible', api_key: '', json_mode: false }, { prompt: 'Hello', response_json_schema: {} });
  assert.equal(request.body.response_format, undefined);
  assert.equal(request.headers.Authorization, undefined);
});
test('Claude and Gemini use their native protocols', () => {
  const claude = buildProviderRequest({ ...connection, provider: 'anthropic', base_url: 'https://api.anthropic.com/v1' }, { prompt: 'Hi' });
  assert.equal(claude.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(claude.headers['x-api-key'], 'test-key');
  const gemini = buildProviderRequest({ ...connection, provider: 'gemini', base_url: 'https://generativelanguage.googleapis.com/v1beta', model: 'models/my-model' }, { prompt: 'Hi' });
  assert.equal(gemini.url, 'https://generativelanguage.googleapis.com/v1beta/models/my-model:generateContent');
  assert.equal(gemini.headers['x-goog-api-key'], 'test-key');
});
test('Unsupported model image input fails explicitly', () => {
  assert.throws(() => buildProviderRequest({ ...connection, supports_images: false }, { prompt: 'Hi', file_urls: ['https://example.com/image.png'] }), /image input disabled/);
  assert.throws(() => buildProviderRequest({ ...connection, provider: 'gemini' }, { prompt: 'Hi', file_urls: ['https://example.com/image.png'] }), /Gemini connections support text/);
});
test('Keys are retained only for the same provider and destination', () => {
  const same = normalizeConnection({ ...connection, api_key: '' }, connection);
  assert.equal(same.api_key, 'test-key');
  const moved = normalizeConnection({ ...connection, provider: 'compatible', base_url: 'https://different.example.com/v1', api_key: '' }, connection);
  assert.equal(moved.api_key, '');
});
test('Public HTTPS URL validation blocks private and credential-bearing URLs', () => {
  for (const url of ['http://example.com/v1', 'https://127.0.0.1', 'https://localhost', 'https://a.internal/v1', 'https://user:password@example.com/v1', 'https://example.com:8443/v1']) assert.throws(() => validateEndpoint(url));
  for (const address of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '::1', '::ffff:127.0.0.1', 'fc00::1']) assert.equal(isPrivateAddress(address), true);
  assert.equal(isPrivateAddress('93.184.216.34'), false);
});
test('Structured output rejects invalid shapes before builder actions', () => {
  const schema = { type: 'object', properties: { pages: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } } }, required: ['pages'] };
  assert.deepEqual(parseModelJSON('{"pages":[{"name":"Home"}]}', schema), { pages: [{ name: 'Home' }] });
  assert.throws(() => parseModelJSON('{"pages":"wrong"}', schema), /array/);
  assert.throws(() => parseModelJSON('{"pages":[{}]}', schema), /missing/);
  assert.throws(() => parseModelJSON('not json', schema), /invalid JSON/);
  assert.throws(() => parseModelJSON('{"__proto__":{}}', { type: 'object' }), /Unsafe/);
});
test('Truncated AI responses are reported rather than applied', () => {
  assert.throws(() => extractContent('openai', { choices: [{ finish_reason: 'length' }] }), /truncated/);
  assert.throws(() => extractContent('anthropic', { stop_reason: 'max_tokens' }), /truncated/);
});
test('Undo and redo preserve the complete edit history', () => {
  let state = visualHistory(initialHistory, { type: 'load', elements: {} });
  state = visualHistory(state, { type: 'change', id: 'title', value: { text: 'First' } });
  state = visualHistory(state, { type: 'change', id: 'title', value: { text: 'Second' } });
  state = visualHistory(state, { type: 'undo' }); assert.equal(state.present.title.text, 'First');
  state = visualHistory(state, { type: 'redo' }); assert.equal(state.present.title.text, 'Second');
  state = visualHistory(state, { type: 'undo' });
  state = visualHistory(state, { type: 'change', id: 'title', value: { text: 'Branch' } }); assert.equal(state.future.length, 0);
});
test('An acknowledged save does not discard later edits', () => {
  let state = visualHistory(initialHistory, { type: 'load', elements: {} });
  const submitted = { title: { text: 'Saved' } };
  state = visualHistory(state, { type: 'change', id: 'title', value: { text: 'Later' } });
  state = visualHistory(state, { type: 'saved', elements: submitted });
  assert.equal(state.present.title.text, 'Later'); assert.notEqual(JSON.stringify(state.present), state.saved);
  state = visualHistory(state, { type: 'reset' }); assert.deepEqual(state.present, submitted);
});
test('Hosting exports contain runnable commands and safe domain configuration', () => {
  const files = withHostingFiles([{ path: 'package.json', content: '{"scripts":{},"type":"module"}' }, { path: 'index.html', content: '<html></html>' }], { name: 'Demo' }, { domain: 'https://app.example.com/' });
  const map = Object.fromEntries(files.map(file => [file.path, file.content]));
  assert.equal(JSON.parse(map['package.json']).scripts.start, 'node hosting/serve.mjs');
  assert.match(map['hosting/Caddyfile'], /^app.example.com \{/);
  assert.match(map['compose.yaml'], /profiles: \["domain"\]/);
  assert.match(map['HOSTING.md'], /browser via localStorage/);
  assert.ok(map['netlify.toml']); assert.ok(map['vercel.json']); assert.ok(map['Dockerfile']);
  assert.equal(normalizeDomain('APP.Example.com'), 'app.example.com');
  assert.throws(() => normalizeDomain('example.com/path'));
  assert.equal(safeSourcePath('../secrets'), false);
  assert.equal(safeSourcePath('/etc/passwd'), false);
  assert.deepEqual(filesFromCode(codeFromFiles(files)), files);
});
test('AI credentials are denied to client entity operations', async () => {
  const schema = JSON.parse(await readFile('base44/entities/AIConnection.jsonc', 'utf8'));
  assert.deepEqual(schema.rls, { create: false, read: false, update: false, delete: false });
  assert.deepEqual(schema.properties.api_key.rls, { read: false, write: false });
});
test('Gateway enforces ownership and omits secrets from connection lists', async () => {
  let user = { id: 'owner', ai_connection_id: 'own' };
  const records = [{ ...connection, id: 'own', user_id: 'owner' }];
  const client = { auth: { me: async () => user, updateMe: async values => Object.assign(user, values) },
    asServiceRole: { entities: { AIConnection: {
      filter: async filter => { assert.equal(filter.user_id, 'owner'); return records; },
      delete: async id => { assert.equal(id, 'own'); },
    } } } };
  globalThis.__gatewayTestClient = () => client;
  const source = (await readFile('base44/functions/ai-gateway/entry.ts', 'utf8'))
    .replace("import { createClientFromRequest } from 'npm:@base44/sdk';", 'const createClientFromRequest = globalThis.__gatewayTestClient;')
    .replace("import { lookup } from 'node:dns/promises';", "const lookup = async () => [{ address: '93.184.216.34' }];")
    .replace("'./protocol.js'", JSON.stringify(pathToFileURL(resolve('base44/functions/ai-gateway/protocol.js')).href));
  const { default: handler } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
  const request = data => new Request('https://app.example.com/functions/ai-gateway', { method: 'POST', body: JSON.stringify(data) });
  const list = await (await handler(request({ action: 'list' }))).json();
  assert.equal(list.connections[0].api_key, undefined); assert.equal(list.connections[0].has_key, true);
  assert.equal((await handler(request({ action: 'delete', id: 'someone-elses-record' }))).status, 404);
  assert.equal((await handler(request({ action: 'default', id: 'someone-elses-record' }))).status, 404);
  assert.equal((await handler(request({ action: 'generate', connection_id: 'someone-elses-record', prompt: 'Hi' }))).status, 400);
  user = null; assert.equal((await handler(request({ action: 'list' }))).status, 401);
  delete globalThis.__gatewayTestClient;
});
