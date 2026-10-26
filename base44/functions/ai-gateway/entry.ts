import { createClientFromRequest } from 'npm:@base44/sdk';
import { lookup } from 'node:dns/promises';
import {normalizeConnection,normalizeGeminiKey,geminiModelChoices,describeProviderError,PROVIDER_BASES,validateEndpoint,isPrivateAddress,buildProviderRequest,extractContent,parseModelJSON} from './protocol.js';

const metadata = record => {
  const { api_key, user_id, ...rest } = record;
  return { ...rest, has_key: !!api_key };
};
async function publicEndpoint(value,allowQuery=false) {
  const url = validateEndpoint(value,allowQuery);
  const addresses = await lookup(url.hostname, { all: true });
  if (!addresses.length || addresses.some(item => isPrivateAddress(item.address))) throw new Error('The API hostname must resolve to a public internet address.');
}
async function throwProviderError(response, connection) {
  let data = {};
  try {
    data = JSON.parse((await response.text()).slice(0, 16000));
  } catch { /* Non-JSON provider bodies use a safe, actionable fallback. */ }
  const detail = describeProviderError(connection.provider, response.status, data, connection.api_key);
  throw Object.assign(new Error(detail.message), detail);
}
async function discoverGeminiModels(apiKey) {
  const connection = { provider: 'gemini', api_key: normalizeGeminiKey(apiKey) };
  await publicEndpoint(PROVIDER_BASES.gemini);
  const models = [], seen = new Set();
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const url = new URL(PROVIDER_BASES.gemini + '/models');
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    const response = await fetch(url.toString(), { method: 'GET', headers: { 'x-goog-api-key': connection.api_key }, redirect: 'manual', signal: AbortSignal.timeout(20000) });
    if (!response.ok) await throwProviderError(response, connection);
    const data = await response.json();
    if (Array.isArray(data.models)) models.push(...data.models.slice(0, 1000));
    pageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
    if (!pageToken) break;
    if (seen.has(pageToken) || pageToken.length > 4096 || page === 4) throw new Error('Google returned an incomplete model list. Retry loading models, or enter a model ID in Advanced options.');
    seen.add(pageToken);
  }
  const choices = geminiModelChoices(models);
  if (!choices.length) throw Object.assign(new Error('Google returned no compatible text models. Check this key’s Gemini API access in AI Studio, or enter a model ID in Advanced options.'), { code: 'GEMINI_NO_MODELS', help_url: 'https://aistudio.google.com/apikey' });
  return choices;
}
async function prepareGeminiImages(connection,values) {
  const urls=Array.isArray(values)?values:[values];if(urls.length>6)throw new Error('Attach at most six images.');
  if(!connection.supports_images)throw new Error('This connection has image input disabled. Enable it in AI Settings for a vision model, or use Built-in AI.');
  let total=0;const images=[];
  for(const url of urls){
    await publicEndpoint(url,true);
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('The reference image could not be opened. Upload it again; temporary image links may have expired.');
    let mime=(response.headers.get('content-type')||'').split(';')[0].trim().toLowerCase();
    if(!['image/png','image/jpeg','image/webp','application/octet-stream'].includes(mime))throw new Error('Gemini references must be PNG, JPG or WebP images.');
    if(Number(response.headers.get('content-length'))>4*1024*1024)throw new Error('Optimize or crop this image to less than 4 MB.');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;total+=value.length;if(size>4*1024*1024||total>12*1024*1024)throw new Error('Use fewer or smaller references (4 MB per image, 12 MB total).');chunks.push(value);}}finally{await reader.cancel();}
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
    const detected=[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)?'image/png':bytes[0]===255&&bytes[1]===216&&bytes[2]===255?'image/jpeg':new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'?'image/webp':'';
    if(!detected||(mime!=='application/octet-stream'&&detected!==mime))throw new Error('The uploaded image does not match its file type. Export a fresh PNG or JPG.');
    mime=detected;
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));images.push({mime_type:mime,data:btoa(binary)});
  }
  return images;
}
async function requestModel(connection, input, verifiedImages = []) {
  await publicEndpoint(connection.base_url);
  const prepared={...input,inline_images:verifiedImages};
  if(connection.provider==='gemini'&&input.file_urls?.length)prepared.inline_images=await prepareGeminiImages(connection,input.file_urls);
  const request = buildProviderRequest(connection, prepared);
  const response = await fetch(request.url, { method: 'POST', headers: request.headers,
    body: JSON.stringify(request.body), redirect: 'manual', signal: AbortSignal.timeout(120000) });
  if (response.status >= 300 && response.status < 400) throw new Error('The AI provider redirected the request. Check the API base URL in Settings.');
  if (!response.ok) await throwProviderError(response, connection);
  const data = await response.json();
  const content = extractContent(connection.provider, data);
  if (!content.trim()) throw new Error('The model returned no text. Choose a text generation model or adjust the request.');
  return input.response_json_schema ? parseModelJSON(content, input.response_json_schema) : content;
}

// A real structured-output request checks the features used by the builder.
// This server-owned one-pixel PNG also verifies screenshot input when enabled.
async function testGemini(connection) {
  const images = connection.supports_images ? [{ mime_type: 'image/png', data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC' }] : [];
  const result = await requestModel(connection, { prompt: 'This is a connection check. Reply only with {"connected":true}. No explanation is needed.',
    response_json_schema: { type: 'object', properties: { connected: { type: 'boolean' } }, required: ['connected'] } }, images);
  if (result.connected !== true) throw new Error('The model replied, but did not pass the builder’s structured-output check. Retry or select another text model.');
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
    if (action === 'models' || action === 'connect_gemini') {
      const existing = body.id ? find(body.id) : null;
      if (body.id && (!existing || existing.provider !== 'gemini')) return Response.json({ error: 'Gemini connection not found.' }, { status: 404 });
      if (action === 'models') {
        const key = normalizeGeminiKey(String(body.api_key || '').trim() || existing?.api_key);
        const models = await discoverGeminiModels(key);
        return Response.json({ models, recommended_id: models[0].id });
      }
      if (!existing && records.length >= 20) throw new Error('You can save up to 20 AI connections.');
      const input = normalizeConnection({ ...body.connection, name: body.connection?.name?.trim() || 'Google Gemini', provider: 'gemini', json_mode: true }, existing || {});
      const started = Date.now();
      await testGemini(input);
      const values = { ...input, last_test_ok: true, last_tested_at: new Date().toISOString() };
      const record = existing ? await client.asServiceRole.entities.AIConnection.update(existing.id, values)
        : await client.asServiceRole.entities.AIConnection.create({ ...values, user_id: user.id });
      if (body.set_default) await client.auth.updateMe({ ai_connection_id: record.id, use_custom_openai: false });
      return Response.json({ connection: metadata(record), latency_ms: Date.now() - started, verified: { text: true, json: true, images: input.supports_images } });
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
      try {
        if (connection.provider === 'gemini') await testGemini(connection);
        else await requestModel(connection, { prompt: 'Reply with the single word: Connected' });
      } catch (error) {
        if (connection.id) await client.asServiceRole.entities.AIConnection.update(connection.id, { last_tested_at: new Date().toISOString(), last_test_ok: false });
        throw error;
      }
      if (connection.id) await client.asServiceRole.entities.AIConnection.update(connection.id, { last_tested_at: new Date().toISOString(), last_test_ok: true });
      return Response.json({ success: true, latency_ms: Date.now() - started, model: connection.model });
    }
    if (action !== 'generate') throw new Error('Unsupported AI action.');
    const result = await requestModel(connection, body);
    return Response.json(body.response_json_schema ? result : { content: result });
  } catch (error) {
    const message = error.name === 'TimeoutError' || error.name === 'AbortError'
      ? 'The AI request timed out. Try a smaller request or a faster model.' : error.message || 'The AI request failed.';
    return Response.json({ error: message, ...(error.code ? { code: error.code } : {}), ...(error.help_url ? { help_url: error.help_url } : {}), ...(error.provider_status ? { provider_status: error.provider_status } : {}) }, { status: user ? 400 : 401 });
  }
}
