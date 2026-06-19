import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import SaraShell from '@/components/sara/SaraShell';
import PageHeader from '@/components/sara/PageHeader';
import EmptyState from '@/components/sara/EmptyState';
import { useSaraContext } from '@/components/sara/useSaraContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Preview() {
  const ctx = useSaraContext();
  const [entities, setEntities] = useState([]);
  const [selected, setSelected] = useState(null);
  const [records, setRecords] = useState([]);
  const [form, setForm] = useState({});
  useEffect(() => { if (ctx.selectedProject) loadEntities(); }, [ctx.selectedProject?.id]);
  useEffect(() => { if (selected) loadRecords(); }, [selected?.id]);
  const loadEntities = async () => { const e = await base44.entities.EntityDefinition.filter({ project_id: ctx.selectedProject.id }, '-created_date', 100); setEntities(e); setSelected(e[0] || null); };
  const loadRecords = async () => setRecords(await base44.entities.ProjectRecord.filter({ project_id: ctx.selectedProject.id, entity_definition_id: selected.id, status: 'active' }, '-created_date', 100));
  const props = Object.keys(selected?.schema?.properties || {});
  const save = async () => { await base44.entities.ProjectRecord.create({ workspace_id: ctx.selectedWorkspace.id, project_id: ctx.selectedProject.id, entity_definition_id: selected.id, data: form, status: 'active' }); setForm({}); await loadRecords(); };
  const remove = async (r) => { await base44.entities.ProjectRecord.update(r.id, { status: 'archived' }); await loadRecords(); };
  return <SaraShell><PageHeader eyebrow="Runtime Simulator" title="Live Preview" description="Render dynamic forms and tables from EntityDefinition records, then store preview data in ProjectRecord without creating large runtime schemas." />
    {!ctx.selectedProject ? <EmptyState title="Select a project" description="The preview simulator needs a current project." /> : entities.length === 0 ? <EmptyState title="No entities to preview" description="Create an entity first, then Sara can render forms and tables automatically." /> : <div className="grid xl:grid-cols-4 gap-6"><aside className="bg-card border border-border rounded-2xl p-3 space-y-2">{entities.map(e => <button key={e.id} onClick={() => setSelected(e)} className={`w-full text-left px-3 py-2 rounded-xl ${selected?.id === e.id ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}>{e.name}</button>)}</aside><section className="xl:col-span-3 space-y-4"><div className="bg-card border border-border rounded-2xl p-5"><h3 className="font-bold mb-3">New {selected?.name}</h3><div className="grid md:grid-cols-2 gap-3">{props.map(p => <Input key={p} placeholder={p} value={form[p] || ''} onChange={e => setForm({...form, [p]: e.target.value})} />)}</div><Button className="mt-4" onClick={save}>Create preview record</Button></div><div className="bg-card border border-border rounded-2xl overflow-auto"><table className="w-full text-sm"><thead className="bg-muted"><tr>{props.map(p => <th key={p} className="text-left p-3">{p}</th>)}<th className="p-3 text-right">Actions</th></tr></thead><tbody>{records.map(r => <tr key={r.id} className="border-t border-border">{props.map(p => <td key={p} className="p-3">{String(r.data?.[p] ?? '')}</td>)}<td className="p-3 text-right"><Button size="sm" variant="outline" onClick={() => remove(r)}>Delete</Button></td></tr>)}</tbody></table>{records.length === 0 && <p className="text-center text-muted-foreground p-8">No preview records yet.</p>}</div></section></div>}
  </SaraShell>;
}