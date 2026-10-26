import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeGeminiKey, normalizeGeminiModel, geminiModelChoices, describeProviderError } from '../base44/functions/ai-gateway/protocol.js';

const load = source => import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const apiRequest = data => new Request('https://app.example.com/functions/ai-gateway', { method: 'POST', body: JSON.stringify(data) });
const listed = (id, extra = {}) => ({ name: 'models/' + id, displayName: id, supportedGenerationMethods: ['generateContent'], outputTokenLimit: 32768, ...extra });

test('Gemini accepts copied keys and resource IDs without guessing or restricting key prefixes', () => {
  assert.equal(normalizeGeminiKey(' export GEMINI_API_KEY="AQ.example-auth-key" '), 'AQ.example-auth-key');
  assert.equal(normalizeGeminiKey("'AIza-example-standard-key'"), 'AIza-example-standard-key');
  assert.equal(normalizeGeminiModel(' models/gemini-9.2-flash '), 'gemini-9.2-flash');
  assert.throws(() => normalizeGeminiKey('{"type":"service_account"}'), /Google AI Studio/);
  assert.throws(() => normalizeGeminiKey('two key values'), /Google AI Studio/);
  assert.throws(() => normalizeGeminiModel('gemini:generateContent?key=hidden'));
});

test('model discovery filters non-builder models, deduplicates IDs and suggests a current stable model', () => {
  const choices = geminiModelChoices([
    listed('gemini-8.1-pro'), listed('gemini-9.2-flash'), listed('gemini-9.2-flash'), listed('gemini-10.1-pro-preview'),
    listed('gemini-9.2-flash-lite'), listed('gemini-9.2-flash-image'), listed('gemini-9.2-tts'),
    listed('gemini-9.2-live', { supportedGenerationMethods: ['bidiGenerateContent'] }),
    listed('embedding-one', { supportedGenerationMethods: ['embedContent'] }), listed('../bad'),
  ]);
  assert.equal(choices[0].id, 'gemini-9.2-flash');
  assert.equal(choices.length, 4);
  assert.equal(choices[0].output_token_limit, 32768);
});

test('Gemini errors give relevant recovery steps and redact keys before truncating provider details', () => {
  const samples = [[400, 'API key expired', 'GEMINI_KEY_INVALID'], [403, 'Permission denied', 'GEMINI_ACCESS_DENIED'],
    [404, 'Model not found', 'GEMINI_MODEL_UNAVAILABLE'], [429, 'Quota exhausted', 'GEMINI_QUOTA'],
    [402, 'Insufficient prepay credits', 'GEMINI_BILLING'], [503, 'Service unavailable', 'GEMINI_UNAVAILABLE']];
  for (const [status, message, expected] of samples) {
    const result = describeProviderError('gemini', status, { error: { message } });
    assert.equal(result.code, expected); assert.match(result.help_url, /^https:\/\/(aistudio\.google\.com|ai\.google\.dev)\//);
  }
  const key = 'secret-' + 'x'.repeat(500);
  const result = describeProviderError('gemini', 403, { error: { message: 'Rejected key ' + key } }, key);
  assert.doesNotMatch(result.message, /secret-xxx/); assert.match(result.message, /\[hidden\]/);
});

async function harness() {
  const state = { user: { id: 'owner', ai_connection_id: 'previous' }, records: [
    { id: 'previous', user_id: 'owner', name: 'Previous', provider: 'openai', model: 'old-model', api_key: 'old-private-key', base_url: 'https://api.openai.com/v1' },
    { id: 'saved-gemini', user_id: 'owner', name: 'Saved', provider: 'gemini', model: 'gemini-9.2-flash', api_key: 'saved-private-key', base_url: 'https://generativelanguage.googleapis.com/v1beta', supports_images: true, json_mode: true },
  ], created: [], updated: [], profileChanges: [] };
  const client = { auth: { me: async () => state.user, updateMe: async values => { state.profileChanges.push(values); Object.assign(state.user, values); } },
    asServiceRole: { entities: { AIConnection: {
      filter: async query => { assert.equal(query.user_id, 'owner'); return state.records; },
      create: async values => { const record = { ...values, id: 'created-' + (state.created.length + 1) }; state.created.push(record); state.records.push(record); return record; },
      update: async (id, values) => { state.updated.push({ id, values }); const record = state.records.find(item => item.id === id); Object.assign(record, values); return record; },
    } } } };
  globalThis.__geminiSetupClient = () => client;
  const source = (await readFile('base44/functions/ai-gateway/entry.ts', 'utf8'))
    .replace("import { createClientFromRequest } from 'npm:@base44/sdk';", 'const createClientFromRequest = globalThis.__geminiSetupClient;')
    .replace("import { lookup } from 'node:dns/promises';", "const lookup = async () => [{ address: '93.184.216.34' }];")
    .replace("'./protocol.js'", JSON.stringify(pathToFileURL(resolve('base44/functions/ai-gateway/protocol.js')).href));
  // Each harness imports a fresh handler, capturing its own mocked client.
  const handler = (await load(source + '\n// ' + Math.random())).default;
  return { state, handler, call: async body => { const response = await handler(apiRequest(body)); return { status: response.status, data: await response.json() }; } };
}

test('model loading paginates privately and never saves a key or changes the selected AI', async () => {
  const { state, call } = await harness(), previous = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (address, options) => {
    const url = new URL(address); requests++;
    assert.equal(url.origin, 'https://generativelanguage.googleapis.com'); assert.equal(url.pathname, '/v1beta/models');
    assert.equal(url.searchParams.get('key'), null); assert.equal(options.headers['x-goog-api-key'], 'saved-private-key'); assert.equal(options.redirect, 'manual');
    if (requests === 1) return Response.json({ models: [listed('gemini-8.1-pro')], nextPageToken: 'next+/=?' });
    assert.equal(url.searchParams.get('pageToken'), 'next+/=?');
    return Response.json({ models: [listed('gemini-9.2-flash'), listed('gemini-9.2-tts')] });
  };
  try {
    const response = await call({ action: 'models', id: 'saved-gemini', api_key: '' });
    assert.equal(response.status, 200); assert.equal(response.data.recommended_id, 'gemini-9.2-flash'); assert.equal(response.data.models.length, 2);
    assert.equal(requests, 2); assert.equal(state.created.length, 0); assert.equal(state.updated.length, 0); assert.equal(state.profileChanges.length, 0);
    assert.doesNotMatch(JSON.stringify(response.data), /saved-private-key|old-private-key/);
  } finally { globalThis.fetch = previous; }
});

test('connect verifies real JSON and image transport before saving and setting the builder default', async () => {
  const { state, call } = await harness(), previous = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (url, options) => {
    requests++; assert.match(url, /\/models\/gemini-9\.2-flash:generateContent$/);
    assert.equal(options.headers['x-goog-api-key'], 'AQ.new-private-key'); assert.equal(state.created.length, 0); assert.equal(state.profileChanges.length, 0);
    const body = JSON.parse(options.body); assert.equal(body.generationConfig.responseMimeType, 'application/json');
    const inline = body.contents[0].parts[0].inlineData; assert.equal(inline.mimeType, 'image/png'); assert.ok(Buffer.from(inline.data, 'base64').length > 32);
    return Response.json({ candidates: [{ content: { parts: [{ text: '{"connected":true}' }] } }] });
  };
  try {
    const response = await call({ action: 'connect_gemini', set_default: true, connection: { api_key: '"AQ.new-private-key"', model: 'models/gemini-9.2-flash', supports_images: true } });
    assert.equal(response.status, 200); assert.equal(requests, 1); assert.equal(state.created.length, 1); assert.equal(state.profileChanges.length, 1);
    assert.equal(state.user.ai_connection_id, response.data.connection.id); assert.equal(state.created[0].last_test_ok, true);
    assert.equal(response.data.connection.model, 'gemini-9.2-flash'); assert.equal(response.data.connection.has_key, true); assert.equal(response.data.connection.api_key, undefined);
    assert.deepEqual(response.data.verified, { text: true, json: true, images: true });
  } finally { globalThis.fetch = previous; }
});

test('failed generation or invalid structured output cannot replace the key, save drafts, or change the default', async () => {
  const { state, call } = await harness(), previous = globalThis.fetch;
  let invalidJSON = false;
  globalThis.fetch = async () => invalidJSON ? Response.json({ candidates: [{ content: { parts: [{ text: '{"connected":"yes"}' }] } }] })
    : Response.json({ error: { message: 'Quota exhausted for draft-private-key' } }, { status: 429 });
  const input = { action: 'connect_gemini', id: 'saved-gemini', set_default: true, connection: { model: 'gemini-9.2-flash', api_key: 'draft-private-key', supports_images: true } };
  try {
    let response = await call(input); assert.equal(response.status, 400); assert.equal(response.data.code, 'GEMINI_QUOTA'); assert.doesNotMatch(response.data.error, /draft-private-key/);
    invalidJSON = true; response = await call(input); assert.equal(response.status, 400); assert.match(response.data.error, /wrong type/);
    assert.equal(state.created.length, 0); assert.equal(state.updated.length, 0); assert.equal(state.profileChanges.length, 0);
    assert.equal(state.records[1].api_key, 'saved-private-key'); assert.equal(state.user.ai_connection_id, 'previous');
  } finally { globalThis.fetch = previous; }
});

test('saved Gemini can reconnect with its private key while ownership checks prevent access to other connections', async () => {
  const { state, call } = await harness(), previous = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async (_, options) => { requests++; assert.equal(options.headers['x-goog-api-key'], 'saved-private-key'); return Response.json({ candidates: [{ content: { parts: [{ text: '{"connected":true}' }] } }] }); };
  try {
    for (const action of ['models', 'connect_gemini']) {
      assert.equal((await call({ action, id: 'someone-else' })).status, 404);
      assert.equal((await call({ action, id: 'previous' })).status, 404);
    }
    assert.equal(requests, 0);
    const response = await call({ action: 'connect_gemini', id: 'saved-gemini', connection: { model: 'gemini-9.2-flash', api_key: '', supports_images: false } });
    assert.equal(response.status, 200); assert.equal(requests, 1); assert.equal(state.created.length, 0); assert.equal(state.updated.length, 1); assert.equal(state.profileChanges.length, 0);
    state.user = null; assert.equal((await call({ action: 'models', api_key: 'new-private-key' })).status, 401); assert.equal(requests, 1);
  } finally { globalThis.fetch = previous; }
});

test('model discovery errors and repeated pages return useful failures without changing any saved connection', async () => {
  const { state, call } = await harness(), previous = globalThis.fetch;
  let mode = 'key', requests = 0;
  globalThis.fetch = async () => { requests++;
    if (mode === 'key') return Response.json({ error: { message: 'API key not valid. draft-private-key' } }, { status: 400 });
    if (mode === 'empty') return Response.json({ models: [listed('gemini-9.2-tts')] });
    return Response.json({ models: [listed('gemini-9.2-flash')], nextPageToken: 'repeated' });
  };
  try {
    let result = await call({ action: 'models', api_key: 'draft-private-key' }); assert.equal(result.data.code, 'GEMINI_KEY_INVALID'); assert.doesNotMatch(result.data.error, /draft-private-key/);
    mode = 'empty'; result = await call({ action: 'models', api_key: 'draft-private-key' }); assert.equal(result.data.code, 'GEMINI_NO_MODELS');
    mode = 'repeat'; result = await call({ action: 'models', api_key: 'draft-private-key' }); assert.equal(result.status, 400); assert.match(result.data.error, /incomplete model list/); assert.equal(requests, 4);
    assert.equal(state.created.length + state.updated.length + state.profileChanges.length, 0);
  } finally { globalThis.fetch = previous; }
});

test('client retains recovery metadata and refreshes the builder preference after a successful Gemini connection', async () => {
  let listCalls = 0, mode = 'ok';
  globalThis.__geminiClient = { functions: { invoke: async (_, body) => {
    if (mode === 'error') throw { response: { data: { error: 'Check the Google key', code: 'GEMINI_KEY_INVALID', help_url: 'https://aistudio.google.com/apikey' } } };
    if (body.action === 'list') { listCalls++; return { data: { connections: [], default_id: listCalls > 1 ? 'gemini' : '' } }; }
    return { data: { connection: { id: 'gemini' } } };
  } } };
  const source = (await readFile('src/lib/codeAI.js', 'utf8')).replace("import { base44 } from '@/api/base44Client';", 'const base44 = globalThis.__geminiClient;');
  const client = await load(source);
  await client.getAIConnections(); await client.getAIConnections(); assert.equal(listCalls, 1);
  await client.manageAIConnection('connect_gemini'); assert.equal((await client.getAIConnections()).default_id, 'gemini'); assert.equal(listCalls, 2);
  mode = 'error';
  await assert.rejects(client.manageAIConnection('models'), error => error.code === 'GEMINI_KEY_INVALID' && error.help_url === 'https://aistudio.google.com/apikey');
});
