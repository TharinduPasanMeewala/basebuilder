import React, { useEffect, useState } from 'react';
import { ArrowRight, Bot, Code2, Database, FolderKanban } from 'lucide-react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import SaraShell from '@/components/sara/SaraShell';
import PageHeader from '@/components/sara/PageHeader';
import StatCard from '@/components/sara/StatCard';
import EmptyState from '@/components/sara/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSaraContext } from '@/components/sara/useSaraContext';

export default function Dashboard() {
  const ctx = useSaraContext();
  const [name, setName] = useState('');
  const [counts, setCounts] = useState({ entities: 0, functions: 0, agents: 0 });
  useEffect(() => { if (ctx.selectedProject) loadCounts(); }, [ctx.selectedProject?.id]);
  const loadCounts = async () => {
    const project_id = ctx.selectedProject.id;
    const [entities, functions, agents] = await Promise.all([
      base44.entities.EntityDefinition.filter({ project_id }),
      base44.entities.FunctionDefinition.filter({ project_id }),
      base44.entities.AgentDefinition.filter({ project_id }),
    ]);
    setCounts({ entities: entities.length, functions: functions.length, agents: agents.length });
  };
  const start = async () => {
    const workspace = await ctx.createWorkspace({ name: name || 'Sara Workspace', plan: 'free', local_ai_enabled: false, local_ai_provider: 'none' });
    await ctx.createProject({ workspace_id: workspace.id, name: 'My First AI App', status: 'draft', app_type: 'custom_application' });
  };
  return <SaraShell><PageHeader eyebrow="Welcome" title="Build powerful apps with local AI + Base44 power" description="Sara Builder AI is a meta-platform for creating Base44-style apps with AI-assisted schemas, functions, agents, live previews, and export-ready code." />
    {ctx.workspaces.length === 0 ? <EmptyState title="Create your first workspace" description="A workspace keeps your projects, local AI preferences, and Base44-powered generation organized."><div className="max-w-md mx-auto flex gap-2"><Input placeholder="Workspace name" value={name} onChange={e => setName(e.target.value)} /><Button onClick={start}>Start building</Button></div></EmptyState> : <>
      <div className="grid md:grid-cols-4 gap-4 mb-6"><StatCard label="Workspaces" value={ctx.workspaces.length} hint="Top-level containers" /><StatCard label="Projects" value={ctx.projects.length} hint="Apps in progress" /><StatCard label="Entities" value={counts.entities} hint="Schemas in this project" /><StatCard label="AI Agents" value={counts.agents} hint="Sara-compatible assistants" /></div>
      <div className="grid lg:grid-cols-3 gap-4">
        {[['Entity Builder', Database, 'Create schemas visually or from a prompt.', '/entity-builder'], ['Function Studio', Code2, 'Draft and validate Base44 Deno functions.', '/function-studio'], ['Agent Lab', Bot, 'Configure and chat-test AI agents.', '/agent-lab']].map(([title, Icon, desc, to]) => <Link key={title} to={to} className="bg-card border border-border rounded-2xl p-5 hover:border-primary/40 transition-colors"><Icon className="w-7 h-7 text-primary mb-4" /><h3 className="font-bold text-lg">{title}</h3><p className="text-sm text-muted-foreground mt-2 mb-4">{desc}</p><span className="text-sm text-primary font-semibold flex items-center gap-1">Open <ArrowRight className="w-4 h-4" /></span></Link>)}
      </div>
    </>}
  </SaraShell>;
}