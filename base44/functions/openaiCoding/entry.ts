import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const DEFAULT_MODEL = 'gpt-4o-mini';
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = (user.openai_api_key || '').trim();
    if (!apiKey) {
      return Response.json({ error: 'No OpenAI API key configured. Add one in Settings.' }, { status: 400 });
    }

    const { prompt, response_json_schema, file_urls, model } = await req.json();
    if (!prompt) return Response.json({ error: 'prompt is required' }, { status: 400 });

    const urls = Array.isArray(file_urls) ? file_urls : (file_urls ? [file_urls] : []);
    const userParts = [];
    for (const url of urls) userParts.push({ type: 'image_url', image_url: { url } });

    let text = prompt;
    if (response_json_schema) {
      text += '\n\nReturn ONLY valid JSON matching this schema (no markdown fences):\n' + JSON.stringify(response_json_schema);
    }
    userParts.push({ type: 'text', text });

    const messages = [{ role: 'user', content: userParts.length > 1 ? userParts : text }];

    const body = { model: model || DEFAULT_MODEL, messages };
    if (response_json_schema) body.response_format = { type: 'json_object' };

    const aiRes = await fetch(OPENAI_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!aiRes.ok) {
      const err = await aiRes.json().catch(() => ({}));
      return Response.json({ error: err?.error?.message || `OpenAI error ${aiRes.status}` }, { status: 502 });
    }

    const aiData = await aiRes.json();
    const content = aiData.choices?.[0]?.message?.content || '';

    if (response_json_schema) {
      try {
        return Response.json(JSON.parse(content));
      } catch {
        return Response.json({ error: 'OpenAI returned non-JSON output', content }, { status: 502 });
      }
    }
    return Response.json({ content });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});