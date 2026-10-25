import { createClientFromRequest } from 'npm:@base44/sdk';
import { lookup } from 'node:dns/promises';
const PROVIDER_BASES = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

function normalizeConnection(value, existing = {}) {
  const provider = value.provider || existing.provider;
  if (!['openai', 'anthropic', 'gemini', 'compatible'].includes(provider)) throw new Error('Choose a supported API protocol.');
  const model = String(value.model || '').trim();
  const name = String(value.name || '').trim();
  if (!name || name.length > 80) throw new Error('Enter a connection name (1–80 characters).');
  if (!model || model.length > 200 || /[\r\n]/.test(model)) throw new Error('Enter the exact model ID from your provider.');
  if (provider === 'gemini' && !/^[a-z0-9][a-z0-9._-]*-[a-z0-9._-]+$/.test(model.replace(/^models\//, ''))) throw new Error('Enter a full Gemini model ID, for example gemini-2.5-flash.');
  const base_url = provider === 'compatible' ? String(value.base_url || '').replace(/\/+$/, '') : PROVIDER_BASES[provider];
  validateEndpoint(base_url);
  const sameDestination = provider === existing.provider && base_url === existing.base_url;
  const api_key = typeof value.api_key === 'string' && value.api_key.trim() ? value.api_key.trim() : (sameDestination ? existing.api_key || '' : '');
  if (provider !== 'compatible' && !api_key) throw new Error('An API key is required for this provider.');
  return { name, provider, model, base_url, api_key,
    json_mode: !!value.json_mode, supports_images: !!value.supports_images,
    max_tokens: Math.min(32768, Math.max(256, Math.round(Number(value.max_tokens) || 8192))) };
}

function validateEndpoint(value, allowQuery = false) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid HTTPS API base URL.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || (!allowQuery && url.search) || url.hash ||
      (url.port && url.port !== '443') || !host.includes('.') || /^[\d.]+$/.test(host) ||
      host.includes(':') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
      host.endsWith('.local') || host.endsWith('.internal') || host === 'metadata.google.internal') {
    throw new Error('Use a public HTTPS API hostname without credentials, query parameters, or a custom port. For local models, use an authenticated HTTPS gateway.');
  }
  return url;
}

function isPrivateAddress(address) {
  const value = String(address).toLowerCase();
  if (value.includes(':')) return !/^[23][0-9a-f]{3}:/.test(value); // global IPv6 unicast only
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a,b] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19));
}

function buildProviderRequest(connection, { prompt, response_json_schema, file_urls = [] }) {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 180000) throw new Error('Prompt must contain 1–180,000 characters.');
  const urls = Array.isArray(file_urls) ? file_urls : [file_urls];
  if (urls.length > 6) throw new Error('Attach at most six images.');
  if (urls.length && !connection.supports_images) throw new Error('This connection has image input disabled. Enable it in AI Settings for a vision model, or use Built-in AI.');
  if (urls.length && connection.provider === 'gemini') throw new Error('Image attachments currently require Built-in AI, OpenAI-compatible vision, or Claude. Gemini connections support text prompts.');
  for (const url of urls) validateEndpoint(url, true);
  let text = prompt;
  if (response_json_schema) text += '\n\nReturn ONLY valid JSON matching this JSON schema. Do not use markdown fences:\n' + JSON.stringify(response_json_schema);
  const headers = { 'Content-Type': 'application/json' };
  const base = connection.base_url.replace(/\/+$/, '');
  let url, body;
  if (connection.provider === 'anthropic') {
    url = base + '/messages';
    headers['x-api-key'] = connection.api_key;
    headers['anthropic-version'] = '2023-06-01';
    body = { model: connection.model, max_tokens: connection.max_tokens || 8192,
      messages: [{ role: 'user', content: [...urls.map(url => ({ type: 'image', source: { type: 'url', url } })), { type: 'text', text }] }] };
  } else if (connection.provider === 'gemini') {
    url = base + '/models/' + encodeURIComponent(connection.model.replace(/^models\//, '')) + ':generateContent';
    headers['x-goog-api-key'] = connection.api_key;
    body = { contents: [{ role: 'user', parts: [{ text }] }], generationConfig: {
      maxOutputTokens: connection.max_tokens || 8192,
      ...(response_json_schema && connection.json_mode ? { responseMimeType: 'application/json' } : {}),
    } };
  } else {
    url = base + '/chat/completions';
    if (connection.api_key) headers.Authorization = 'Bearer ' + connection.api_key;
    body = { model: connection.model, messages: [{ role: 'user', content: urls.length
      ? [...urls.map(url => ({ type: 'image_url', image_url: { url } })), { type: 'text', text }] : text }] };
    if (response_json_schema && connection.json_mode) body.response_format = { type: 'json_object' };
  }
  return { url, headers, body };
}

function extractContent(provider, data) {
  if (provider === 'anthropic') {
    if (data.stop_reason === 'max_tokens') throw new Error('Response was truncated. Increase the output token limit or reduce the request.');
    return (data.content || []).filter(part => part.type === 'text').map(part => part.text).join('\n');
  }
  if (provider === 'gemini') {
    const candidate = data.candidates?.[0];
    if (candidate?.finishReason === 'MAX_TOKENS') throw new Error('Response was truncated. Increase the output token limit or reduce the request.');
    return (candidate?.content?.parts || []).filter(part => !part.thought).map(part => part.text || '').join('\n');
  }
  const choice = data.choices?.[0];
  if (choice?.finish_reason === 'length') throw new Error('Response was truncated. Reduce the request or use a model with a larger output limit.');
  const content = choice?.message?.content;
  return typeof content === 'string' ? content : Array.isArray(content) ? content.map(part => part.text || '').join('\n') : '';
}

function parseModelJSON(content, schema) {
  const cleaned = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let value;
  try { value = JSON.parse(cleaned); } catch { throw new Error('The model returned invalid JSON. Try again or choose a model that supports structured output.'); }
  validateValue(value, schema, '$');
  return value;
}
function validateValue(value, schema = {}, path) {
  if (Array.isArray(schema.enum) && !schema.enum.some(item => JSON.stringify(item) === JSON.stringify(value))) throw new Error('Model output has an invalid value at ' + path);
  const type = schema.type;
  if (Array.isArray(type)) { if (value === null && type.includes('null')) return; return validateValue(value, { ...schema, type: type.find(v => v !== 'null') }, path); }
  if (type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Model output must be an object at ' + path);
    for (const name of schema.required || []) if (!(name in value)) throw new Error('Model output is missing ' + path + '.' + name);
    for (const [name, item] of Object.entries(value)) {
      if (['__proto__', 'prototype', 'constructor'].includes(name)) throw new Error('Unsafe property in model output.');
      if (schema.properties?.[name]) validateValue(item, schema.properties[name], path + '.' + name);
      else if (schema.additionalProperties === false) throw new Error('Unexpected property at ' + path + '.' + name);
    }
  } else if (type === 'array') {
    if (!Array.isArray(value)) throw new Error('Model output must be an array at ' + path);
    value.forEach((item, index) => validateValue(item, schema.items || {}, path + '[' + index + ']'));
  } else if (type === 'integer' ? !Number.isInteger(value) : type && (type === 'null' ? value !== null : typeof value !== type)) throw new Error('Model output has the wrong type at ' + path);
}


const metadata = record => {
  const { api_key, user_id, ...rest } = record;
  return { ...rest, has_key: !!api_key };
};
async function publicEndpoint(value) {
  const url = validateEndpoint(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error('The API hostname must resolve to a public internet address.');
}
// Providers explain a failed request in the response body. Return only the short
// machine message, with the connection's key stripped, so the cause is visible.
async function providerErrorDetail(response, apiKey) {
  const fallback = response.status === 401 || response.status === 403 ? 'Check the API key and model access.'
    : response.status === 404 ? 'Check the API base URL and exact model ID.'
    : response.status === 429 ? 'The provider rate limit or quota was reached.'
    : response.status === 400 ? 'The provider rejected the request format. Check the model ID, JSON mode, and image support in Settings.'
    : 'The provider could not complete this request. Try again.';
  try {
    const text = (await response.text()).slice(0, 4000);
    let message = '';
    try {
      const parsed = JSON.parse(text);
      message = parsed?.error?.message || parsed?.message || parsed?.error?.status || '';
    } catch { /* non-JSON provider body */ }
    message = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 300);
    if (apiKey) message = message.split(apiKey).join('***');
    return message || fallback;
  } catch { return fallback; }
}
async function requestModel(connection, input) {
  await publicEndpoint(connection.base_url);
  const request = buildProviderRequest(connection, input);
  const response = await fetch(request.url, { method: 'POST', headers: request.headers,
    body: JSON.stringify(request.body), redirect: 'manual', signal: AbortSignal.timeout(120000) });
  if (response.status >= 300 && response.status < 400) throw new Error('The AI provider redirected the request. Check the API base URL in Settings.');
  if (!response.ok) throw new Error('AI provider returned HTTP ' + response.status + '. ' + await providerErrorDetail(response, connection.api_key));
  const data = await response.json();
  const content = extractContent(connection.provider, data);
  if (!content.trim()) throw new Error('The model returned no text. Choose a text generation model or adjust the request.');
  return input.response_json_schema ? parseModelJSON(content, input.response_json_schema) : content;
}

export default async function (req) {
  let user;
  try {
    const client = createClientFromRequest(req);
    user = await client.auth.me();
    if (!user?.id) return Response.json({ error: 'Please sign in to manage AI connections.' }, { status: 401 });
    const body = await req.json();
    const action = body.action || 'generate';
    const records = await client.asServiceRole.entities.AIConnection.filter({ user_id: user.id }, '-created_date', 100);
    const find = id => records.find(record => record.id === id);
    if (action === 'list') return Response.json({
      connections: records.map(metadata), default_id: user.ai_connection_id || '',
      legacy_openai: !!user.openai_api_key && !!user.use_custom_openai,
    });
    if (action === 'default') {
      if (body.id && !find(body.id)) return Response.json({ error: 'Connection not found.' }, { status: 404 });
      await client.auth.updateMe({ ai_connection_id: body.id || '', use_custom_openai: false });
      return Response.json({ success: true });
    }
    if (action === 'save') {
      const existing = body.id ? find(body.id) : null;
      if (body.id && !existing) return Response.json({ error: 'Connection not found.' }, { status: 404 });
      if (!existing && records.length >= 20) throw new Error('You can save up to 20 AI connections.');
      const input = normalizeConnection(body.connection || {}, existing || {});
      await publicEndpoint(input.base_url);
      const record = existing
        ? await client.asServiceRole.entities.AIConnection.update(existing.id, { ...input, last_tested_at: '', last_test_ok: false })
        : await client.asServiceRole.entities.AIConnection.create({ ...input, user_id: user.id });
      if (body.set_default) await client.auth.updateMe({ ai_connection_id: record.id, use_custom_openai: false });
      return Response.json({ connection: metadata(record) });
    }
    if (action === 'delete') {
      const record = find(body.id);
      if (!record) return Response.json({ error: 'Connection not found.' }, { status: 404 });
      await client.asServiceRole.entities.AIConnection.delete(record.id);
      if (user.ai_connection_id === record.id) await client.auth.updateMe({ ai_connection_id: '', use_custom_openai: false });
      return Response.json({ success: true });
    }
    const selectedId = body.connection_id || body.id || user.ai_connection_id;
    let connection = find(selectedId);
    if (!connection && !selectedId && user.openai_api_key && user.use_custom_openai) {
      connection = { provider: 'openai', model: 'gpt-4o-mini', base_url: 'https://api.openai.com/v1',
        api_key: user.openai_api_key, supports_images: true, json_mode: true };
    }
    if (!connection) return Response.json({ error: 'Choose an AI connection in Settings, or select Built-in AI.' }, { status: 400 });
    if (action === 'test') {
      const started = Date.now();
      await requestModel(connection, { prompt: 'Reply with the single word: Connected' });
      if (connection.id) await client.asServiceRole.entities.AIConnection.update(connection.id, { last_tested_at: new Date().toISOString(), last_test_ok: true });
      return Response.json({ success: true, latency_ms: Date.now() - started, model: connection.model });
    }
    if (action !== 'generate') throw new Error('Unsupported AI action.');
    const result = await requestModel(connection, body);
    return Response.json(body.response_json_schema ? result : { content: result });
  } catch (error) {
    const message = error.name === 'TimeoutError' || error.name === 'AbortError'
      ? 'The AI request timed out. Try a smaller request or a faster model.' : error.message || 'The AI request failed.';
    return Response.json({ error: message }, { status: user ? 400 : 401 });
  }
}