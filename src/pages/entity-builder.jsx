import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import SaraShell from '@/components/sara/SaraShell';
import PageHeader from '@/components/sara/PageHeader';
import EmptyState from '@/components/sara/EmptyState';
import { useSaraContext } from '@/components/sara/useSaraContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const TYPES = ['string', 'number', 'boolean', 'date', 'enum', 'object', 'array'];

export default function EntityBuilder() {
  const ctx = useSaraContext();
  const [defs, setDefs] = useState([]);
  const [mode, setMode] = useState('prompt');
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [fields, setFields] = useState([{ name: 'title', type: 'string', required: true }]);
  const [generating, setGenerating] = useState(false);
  useEffect(() => { if (ctx.selectedProject) load(); }, [ctx.selectedProject?.id]);
  const load = async () => setDefs(await base44.entities.EntityDefinition.filter({ project_id: ctx.selectedProject.id }, '-created_date', 100));
  const schema = useMemo(() => ({ name: name || 'NewEntity', type: 'object', properties: Object.fromEntries(fields.filter(f => f.name).map(f => [f.name, { type: f.type === 'date' ? 'string' : f.type, ...(f.type === 'date' ? { format: 'date' } : {}), ...(f.enum_values ? { enum: f.enum_values.split(',').map(x => x.trim()).filter(Boolean) } : {}) }])), required: fields.filter(f => f.required && f.name).map(f => f.name) }), [name, fields]);
  const addField = () => setFields([...fields, { name: '', type: 'string', required: false }]);
  const generate = async () => { setGenerating(true); const res = await base44.functions.invoke('saraGenerateSchema', { prompt }); setName(res.data.entity_name || 'GeneratedEntity'); setDescription(res.data.description || ''); setFields(res.data.fields || []); setMode('visual'); setGenerating(false); };
  const save = async () => { await base44.entities.EntityDefinition.create({ workspace_id: ctx.selectedWorkspace.id, project_id: ctx.selectedProject.id, name, description, schema, fields, source: mode }); await load(); };
  return <SaraShell><PageHeader eyebrow="Core Feature" title="Entity Builder" description="Create Base44-style entity definitions with prompt mode, visual fields, relationship IDs, and live JSON Schema preview." action={<Button onClick={save} disabled={!ctx.selectedProject || !name}>Save Entity</Button>} />
    {!ctx.selectedProject ? <EmptyState title="Select a project" description="Entity definitions are saved to the current project." /> : <div className="grid xl:grid-cols-2 gap-6"><section className="bg-card border border-border rounded-2xl p-5 space-y-4"><div className="flex gap-2"><Button variant={mode === 'prompt' ? 'default' : 'outline'} onClick={() => setMode('prompt')}>Prompt mode</Button><Button variant={mode === 'visual' ? 'default' : 'outline'} onClick={() => setMode('visual')}>Visual mode</Button></div>{mode === 'prompt' ? <div className="space-y-3"><Textarea rows={8} placeholder="Create an Invoice entity with customer, line items, status, due date..." value={prompt} onChange={e => setPrompt(e.target.value)} /><p className="text-xs text-muted-foreground">This uses Base44 Credits to generate the first schema draft.</p><Button onClick={generate} disabled={!prompt || generating}>{generating ? 'Generating…' : 'Generate Schema'}</Button></div> : <div className="space-y-3"><Input placeholder="Entity name" value={name} onChange={e => setName(e.target.value)} /><Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} />{fields.map((f, i) => <div key={i} className="grid grid-cols-12 gap-2"><Input className="col-span-4" placeholder="field_name" value={f.name || ''} onChange={e => setFields(fields.map((x, idx) => idx === i ? {...x, name: e.target.value} : x))} /><select className="col-span-3 border border-border bg-background rounded-lg px-2" value={f.type || 'string'} onChange={e => setFields(fields.map((x, idx) => idx === i ? {...x, type: e.target.value} : x))}>{TYPES.map(t => <option key={t}>{t}</option>)}</select><label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={!!f.required} onChange={e => setFields(fields.map((x, idx) => idx === i ? {...x, required: e.target.checked} : x))} />Required</label><Input className="col-span-3" placeholder="enum a,b" value={f.enum_values || ''} onChange={e => setFields(fields.map((x, idx) => idx === i ? {...x, enum_values: e.target.value} : x))} /></div>)}<Button variant="outline" onClick={addField}>Add Field</Button></div>}</section><section className="space-y-4"><pre className="bg-slate-950 text-slate-100 rounded-2xl p-5 text-xs overflow-auto max-h-[520px]">{JSON.stringify(schema, null, 2)}</pre><div className="bg-card border border-border rounded-2xl p-4"><h3 className="font-bold mb-3">Saved entities</h3><div className="space-y-2">{defs.map(d => <div key={d.id} className="flex justify-between border border-border rounded-xl px-3 py-2"><span>{d.name}</span><span className="text-xs text-muted-foreground">{Object.keys(d.schema?.properties || {}).length} fields</span></div>)}</div></div></section></div>}
  </SaraShell>;
}