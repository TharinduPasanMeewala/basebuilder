import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { prompt } = await req.json();
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are Sara Builder AI. Convert this app-builder request into a lean Base44 entity JSON schema. Request: ${prompt}\nReturn entity_name, description, fields, and schema_json. schema_json must be a valid JSON string for a Base44 entity schema with keys name, type, properties, and required. Use only safe JSON Schema primitives and keep relationships as *_id string fields.`,
      response_json_schema: {
        type: 'object',
        properties: {
          entity_name: { type: 'string' },
          description: { type: 'string' },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                required: { type: 'boolean' },
                description: { type: 'string' },
                enum_values: { type: 'string' }
              },
              required: ['name', 'type', 'required', 'description', 'enum_values']
            }
          },
          schema_json: { type: 'string' }
        },
        required: ['entity_name', 'description', 'fields', 'schema_json']
      }
    });
    let schema = {};
    try { schema = JSON.parse(result.schema_json); } catch (_e) { schema = { name: result.entity_name, type: 'object', properties: {}, required: [] }; }
    return Response.json({ ...result, schema });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});