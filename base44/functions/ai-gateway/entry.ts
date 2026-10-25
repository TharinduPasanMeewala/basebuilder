import { createClientFromRequest } from 'npm:@base44/sdk';
import { lookup } from 'node:dns/promises';
import { normalizeConnection, validateEndpoint, isPrivateAddress, buildProviderRequest, extractContent, parseModelJSON } from './protocol.js';

const metadata = record => {
  const { api_key, user_id, ...rest } = record;
  return { ...rest, has_key: !!api_key };
};
async function publicEndpoint(value) {
  const url = validateEndpoint(value);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error('The API hostname must resolve to a public internet address.');
}
async function requestModel(connection, input) {
  await publicEndpoint(connection.base_url);
  const request = buildProviderRequest(connection, input);
  const response = await fetch(request.url, { method: 'POST', headers: request.headers,
    body: JSON.stringify(request.body), redirect: 'error', signal: AbortSignal.timeout(120000) });
  if (!response.ok) {
    // Provider error bodies can echo credentials and prompts. Never return them.
    const detail = response.status === 401 || response.status === 403 ? 'Check the API key and model access.'
      : response.status === 404 ? 'Check the API base URL and exact model ID.'
      : response.status === 429 ? 'The provider rate limit or quota was reached.'
      : response.status === 400 ? 'This model rejected the request format. Check JSON mode and image support in Settings.'
      : 'The provider could not complete this request. Try again.';
    throw new Error('AI provider returned HTTP ' + response.status + '. ' + detail);
  }
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
