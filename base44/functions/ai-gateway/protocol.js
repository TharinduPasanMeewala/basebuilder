export const PROVIDER_BASES = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

export function normalizeConnection(value, existing = {}) {
  const provider = value.provider || existing.provider;
  if (!['openai', 'anthropic', 'gemini', 'compatible'].includes(provider)) throw new Error('Choose a supported API protocol.');
  const model = String(value.model || '').trim();
  const name = String(value.name || '').trim();
  if (!name || name.length > 80) throw new Error('Enter a connection name (1–80 characters).');
  if (!model || model.length > 200 || /[\r\n]/.test(model)) throw new Error('Enter the exact model ID from your provider.');
  const base_url = provider === 'compatible' ? String(value.base_url || '').replace(/\/+$/, '') : PROVIDER_BASES[provider];
  validateEndpoint(base_url);
  const sameDestination = provider === existing.provider && base_url === existing.base_url;
  const api_key = typeof value.api_key === 'string' && value.api_key.trim() ? value.api_key.trim() : (sameDestination ? existing.api_key || '' : '');
  if (provider !== 'compatible' && !api_key) throw new Error('An API key is required for this provider.');
  return { name, provider, model, base_url, api_key,
    json_mode: !!value.json_mode, supports_images: !!value.supports_images,
    max_tokens: Math.min(32768, Math.max(256, Math.round(Number(value.max_tokens) || 8192))) };
}

export function validateEndpoint(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Enter a valid HTTPS API base URL.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== '443') || !host.includes('.') || /^[\d.]+$/.test(host) ||
      host.includes(':') || /(^|\.)(localhost|local|internal|test|invalid)$/.test(host) ||
      host.endsWith('.local') || host.endsWith('.internal') || host === 'metadata.google.internal') {
    throw new Error('Use a public HTTPS API hostname without credentials, query parameters, or a custom port. For local models, use an authenticated HTTPS gateway.');
  }
  return url;
}

export function isPrivateAddress(address) {
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

export function buildProviderRequest(connection, { prompt, response_json_schema, file_urls = [] }) {
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 180000) throw new Error('Prompt must contain 1–180,000 characters.');
  const urls = Array.isArray(file_urls) ? file_urls : [file_urls];
  if (urls.length > 6) throw new Error('Attach at most six images.');
  if (urls.length && !connection.supports_images) throw new Error('This connection has image input disabled. Enable it in AI Settings for a vision model, or use Built-in AI.');
  if (urls.length && connection.provider === 'gemini') throw new Error('Image attachments currently require Built-in AI, OpenAI-compatible vision, or Claude. Gemini connections support text prompts.');
  for (const url of urls) validateEndpoint(url);
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

export function extractContent(provider, data) {
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

export function parseModelJSON(content, schema) {
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
