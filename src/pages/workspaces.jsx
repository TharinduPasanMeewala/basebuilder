import React, { useState } from 'react';
import SaraShell from '@/components/sara/SaraShell';
import PageHeader from '@/components/sara/PageHeader';
import EmptyState from '@/components/sara/EmptyState';
import { useSaraContext } from '@/components/sara/useSaraContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { base44 } from '@/api/base44Client';

export default function Workspaces() {
  const ctx = useSaraContext();
  const [form, setForm] = useState({ name: '', plan: 'free', local_ai_provider: 'none', local_ai_enabled: false });
  const create = async () => { await ctx.createWorkspace(form); setForm({ name: '', plan: 'free', local_ai_provider: 'none', local_ai_enabled: false }); };
  const update = async (w, data) => { await base44.entities.Workspace.update(w.id, data); await ctx.load(); };
  return <SaraShell><PageHeader eyebrow="Workspace Management" title="Workspaces" description="Create, switch, and configure workspace-level plan and local AI preferences." action={<Button onClick={create} disabled={!form.name}>Create Workspace</Button>} />
    <div className="bg-card border border-border rounded-2xl p-4 mb-6 grid md:grid-cols-4 gap-3"><Input placeholder="Workspace name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /><select className="border border-border bg-background rounded-lg px-3" value={form.plan} onChange={e => setForm({...form, plan: e.target.value})}><option>free</option><option>starter</option><option>pro</option><option>enterprise</option></select><select className="border border-border bg-background rounded-lg px-3" value={form.local_ai_provider} onChange={e => setForm({...form, local_ai_provider: e.target.value, local_ai_enabled: e.target.value !== 'none'})}><option>none</option><option>ollama</option><option>webllm</option><option>custom</option></select><Input placeholder="Local AI endpoint" onChange={e => setForm({...form, local_ai_endpoint: e.target.value})} /></div>
    {ctx.workspaces.length === 0 ? <EmptyState title="No workspaces yet" description="Create a workspace to start building projects." /> : <div className="grid lg:grid-cols-2 gap-4">{ctx.workspaces.map(w => <div key={w.id} className={`border rounded-2xl p-5 bg-card ${ctx.selectedWorkspace?.id === w.id ? 'border-primary' : 'border-border'}`}><div className="flex justify-between gap-4"><div><h3 className="font-bold text-lg">{w.name}</h3><p className="text-sm text-muted-foreground">{w.description || 'No description yet'}</p></div><Button variant="outline" onClick={() => ctx.setSelectedWorkspaceId(w.id)}>Switch</Button></div><div className="grid sm:grid-cols-2 gap-3 mt-4"><select className="border border-border bg-background rounded-lg px-3 py-2" value={w.plan || 'free'} onChange={e => update(w, { plan: e.target.value })}><option>free</option><option>starter</option><option>pro</option><option>enterprise</option></select><select className="border border-border bg-background rounded-lg px-3 py-2" value={w.local_ai_provider || 'none'} onChange={e => update(w, { local_ai_provider: e.target.value, local_ai_enabled: e.target.value !== 'none' })}><option>none</option><option>ollama</option><option>webllm</option><option>custom</option></select></div></div>)}</div>}
  </SaraShell>;
}