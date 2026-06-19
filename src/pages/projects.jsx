import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import SaraShell from '@/components/sara/SaraShell';
import PageHeader from '@/components/sara/PageHeader';
import EmptyState from '@/components/sara/EmptyState';
import { useSaraContext } from '@/components/sara/useSaraContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function Projects() {
  const ctx = useSaraContext();
  const [name, setName] = useState('');
  const [stats, setStats] = useState({});
  useEffect(() => { loadStats(); }, [ctx.scopedProjects.length]);
  const loadStats = async () => {
    const next = {};
    for (const p of ctx.scopedProjects) {
      const [e, f, a] = await Promise.all([base44.entities.EntityDefinition.filter({ project_id: p.id }), base44.entities.FunctionDefinition.filter({ project_id: p.id }), base44.entities.AgentDefinition.filter({ project_id: p.id })]);
      next[p.id] = { e: e.length, f: f.length, a: a.length };
    }
    setStats(next);
  };
  const create = async () => { await ctx.createProject({ name: name || 'Untitled App', status: 'draft', app_type: 'custom_application' }); setName(''); };
  return <SaraShell><PageHeader eyebrow="Project Management" title="Projects" description="Create multiple apps inside each workspace and track their entities, functions, and agents." action={<Button onClick={create} disabled={!ctx.selectedWorkspace}>New Project</Button>} />
    <div className="bg-card border border-border rounded-2xl p-4 mb-6 flex gap-2 max-w-xl"><Input placeholder="Project name" value={name} onChange={e => setName(e.target.value)} /><Button onClick={create} disabled={!ctx.selectedWorkspace}>Create</Button></div>
    {!ctx.selectedWorkspace ? <EmptyState title="Pick or create a workspace" description="Projects live inside workspaces." /> : ctx.scopedProjects.length === 0 ? <EmptyState title="No projects yet" description="Create your first app project in this workspace." /> : <div className="grid lg:grid-cols-3 gap-4">{ctx.scopedProjects.map(p => <button key={p.id} onClick={() => ctx.setSelectedProjectId(p.id)} className={`text-left bg-card border rounded-2xl p-5 hover:border-primary/40 ${ctx.selectedProject?.id === p.id ? 'border-primary' : 'border-border'}`}><span className="text-xs uppercase tracking-wide text-primary font-semibold">{p.status || 'draft'}</span><h3 className="text-lg font-bold mt-2">{p.name}</h3><p className="text-sm text-muted-foreground mt-1 h-10">{p.description || 'Ready for schemas, functions, agents, and preview data.'}</p><div className="grid grid-cols-3 gap-2 mt-5 text-center text-xs"><span className="bg-muted rounded-lg p-2">{stats[p.id]?.e || 0}<br/>Entities</span><span className="bg-muted rounded-lg p-2">{stats[p.id]?.f || 0}<br/>Functions</span><span className="bg-muted rounded-lg p-2">{stats[p.id]?.a || 0}<br/>Agents</span></div></button>)}</div>}
  </SaraShell>;
}