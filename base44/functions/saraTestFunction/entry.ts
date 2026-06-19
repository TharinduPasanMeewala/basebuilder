import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const { code, payload } = await req.json();
    const checks = [];
    if (!code?.includes('Deno.serve')) checks.push('Add a Deno.serve handler.');
    if (!code?.includes('Response')) checks.push('Return a Response object.');
    if (/import\\s+\\{?\\s*serve\\s*\\}?\\s+from/.test(code || '')) checks.push('Use Deno.serve instead of importing serve.');
    if (code?.includes('BASE44_SERVICE')) checks.push('Do not use service-token secrets; use createClientFromRequest.');
    return Response.json({
      success: checks.length === 0,
      checks,
      payload_preview: payload || {},
      message: checks.length ? 'Sara found deployment issues to fix.' : 'Looks ready for a Base44 backend function.'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});