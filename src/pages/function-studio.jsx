import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import SaraShell from '@/components/sara/SaraShell';
import PageHeader from '@/components/sara/PageHeader';
import EmptyState from '@/components/sara/EmptyState';
import { useSaraContext } from '@/components/sara/useSaraContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const STARTER = `import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';\n\nDeno.serve(async (req) => {\n  try {\n    const base44 = createClientFromRequest(req);\n    const user = await base44.auth.me();\n    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });\n    return Response.json({ ok: true });\n  } catch (error) {\n    return Response.json({ error: error.message }, { status: 500 });\n  }\n});`;

export default function FunctionStudio() {
  const ctx = useSaraContext();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name: '', description: '', trigger_type: 'manual', code: STARTER });
  const [result, setResult] = useState(null);
  useEffect(() => { if (ctx.selectedProject) load(); }, [ctx.selectedProject?.id]);
  const load = async () => setItems(await base44.entities.FunctionDefinition.filter({ project_id: ctx.selectedProject.id }, '-created_date', 100));
  const save = async () => { await base44.entities.FunctionDefinition.create({ ...form, workspace_id: ctx.selectedWorkspace.id, project_id: ctx.selectedProject.id, status: 'draft' }); await load(); };
  const test = async () => { const res = await base44.functions.invoke('saraTestFunction', { code: form.code, payload: { hello: 'Sara' } }); setResult(res.data); };
  return <SaraShell><PageHeader eyebrow="Function Studio" title="Write and validate Deno functions" description="Draft functions with Base44 SDK patterns, configure triggers, and run Sara readiness checks before export." action={<Button onClick={save} disabled={!ctx.selectedProject || !form.name}>Save Function</Button>} />
    {!ctx.selectedProject ? <EmptyState title="Select a project" description="Functions are saved to the current project." /> : <div className="grid xl:grid-cols-3 gap-6"><section className="xl:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-3"><Input placeholder="Function name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /><Input placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} /><select className="border border-border bg-background rounded-lg px-3 py-2" value={form.trigger_type} onChange={e => setForm({...form, trigger_type: e.target.value})}><option>manual</option><option>entity_create</option><option>entity_update</option><option>entity_delete</option><option>scheduled</option></select><Textarea className="font-mono text-xs" rows={18} value={form.code} onChange={e => setForm({...form, code: e.target.value})} /><div className="flex gap-2"><Button onClick={test} variant="outline">Test readiness</Button><span className="text-xs text-muted-foreground self-center">Static validation now; deploy-time testing can be plugged in later.</span></div>{result && <pre className="bg-muted rounded-xl p-3 text-xs">{JSON.stringify(result, null, 2)}</pre>}</section><section className="bg-card border border-border rounded-2xl p-4"><h3 className="font-bold mb-3">Saved functions</h3><div className="space-y-2">{items.map(f => <button key={f.id} onClick={() => setForm(f)} className="w-full text-left border border-border rounded-xl p-3"><p className="font-semibold">{f.name}</p><p className="text-xs text-muted-foreground">{f.trigger_type}</p></button>)}</div></section></div>}
  </SaraShell>;
}