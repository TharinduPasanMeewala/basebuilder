import { createClientFromRequest } from 'npm:@base44/sdk';
import { lookup } from 'node:dns/promises';
import {normalizeConnection,validateEndpoint,isPrivateAddress,buildProviderRequest,extractContent,parseModelJSON} from './protocol.js';

const metadata = record => {
  const { api_key, user_id, ...rest } = record;
  return { ...rest, has_key: !!api_key };
};
async function publicEndpoint(value,allowQuery=false) {
  const url = validateEndpoint(value,allowQuery);
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
async function prepareGeminiImages(connection,values) {
  const urls=Array.isArray(values)?values:[values];if(urls.length>6)throw new Error('Attach at most six images.');
  if(!connection.supports_images)throw new Error('This connection has image input disabled. Enable it in AI Settings for a vision model, or use Built-in AI.');
  let total=0;const images=[];
  for(const url of urls){
    await publicEndpoint(url,true);
    const response=await fetch(url,{redirect:'manual',signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error('The reference image could not be opened. Upload it again; temporary image links may have expired.');
    const mime=(response.headers.get('content-type')||'').split(';')[0].trim();
    if(!['image/png','image/jpeg','image/webp'].includes(mime))throw new Error('Gemini references must be PNG, JPG or WebP images.');
    if(Number(response.headers.get('content-length'))>4*1024*1024)throw new Error('Optimize or crop this image to less than 4 MB.');
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;total+=value.length;if(size>4*1024*1024||total>12*1024*1024)throw new Error('Use fewer or smaller references (4 MB per image, 12 MB total).');chunks.push(value);}}finally{await reader.cancel();}
    const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}
    const valid=mime==='image/png'?[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n):mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP';
    if(!valid)throw new Error('The uploaded image does not match its file type. Export a fresh PNG or JPG.');
    let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));images.push({mime_type:mime,data:btoa(binary)});
  }
  return images;
}
async function requestModel(connection, input) {
  await publicEndpoint(connection.base_url);
  const prepared={...input,inline_images:[]};
  if(connection.provider==='gemini'&&input.file_urls?.length)prepared.inline_images=await prepareGeminiImages(connection,input.file_urls);
  const request = buildProviderRequest(connection, prepared);
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
