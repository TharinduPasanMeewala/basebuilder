import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Boxes, Bot, Code2, Database, Eye, FileArchive, FolderKanban, Home, Layers, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSaraContext } from './useSaraContext';

const NAV = [
  ['/', Home, 'Dashboard'], ['/workspaces', Boxes, 'Workspaces'], ['/projects', FolderKanban, 'Projects'],
  ['/entity-builder', Database, 'Entity Builder'], ['/function-studio', Code2, 'Function Studio'],
  ['/agent-lab', Bot, 'Agent Lab'], ['/preview', Eye, 'Preview'], ['/exports', FileArchive, 'Exports'],
];

export default function SaraShell({ children }) {
  const { pathname } = useLocation();
  const ctx = useSaraContext();
  const quickProject = async () => {
    if (!ctx.selectedWorkspace) await ctx.createWorkspace({ name: 'My Workspace', plan: 'free', local_ai_provider: 'none' });
    await ctx.createProject({ name: 'Untitled App', status: 'draft', app_type: 'internal_tool' });
  };
  return <div className="min-h-screen bg-background text-foreground lg:flex">
    <aside className="lg:w-72 border-r border-border bg-card/80 lg:min-h-screen">
      <div className="p-5 border-b border-border"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-2xl bg-primary text-primary-foreground grid place-items-center"><Sparkles className="w-5 h-5" /></div><div><h1 className="font-bold text-lg">Sara Builder AI</h1><p className="text-xs text-muted-foreground">Build powerful apps with local AI + Base44 power</p></div></div></div>
      <nav className="p-3 grid gap-1">{NAV.map(([to, Icon, label]) => <Link key={to} to={to} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${pathname === to ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}><Icon className="w-4 h-4" />{label}</Link>)}</nav>
    </aside>
    <main className="flex-1 min-w-0">
      <header className="sticky top-0 z-10 bg-background/85 backdrop-blur border-b border-border px-4 py-3 flex flex-wrap items-center gap-3">
        <select value={ctx.selectedWorkspace?.id || ''} onChange={e => ctx.setSelectedWorkspaceId(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm"><option value="">No workspace</option>{ctx.workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        <select value={ctx.selectedProject?.id || ''} onChange={e => ctx.setSelectedProjectId(e.target.value)} className="bg-card border border-border rounded-lg px-3 py-2 text-sm"><option value="">No project</option>{ctx.scopedProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        <div className="flex-1" />
        <span className="text-xs bg-accent/10 text-accent border border-accent/20 px-3 py-1.5 rounded-full">Using Base44 Credits only for AI generation</span>
        <span className="text-sm text-muted-foreground hidden sm:inline">{ctx.user?.full_name || ctx.user?.email}</span>
        <Button size="sm" onClick={quickProject} className="gap-2"><Plus className="w-4 h-4" />New Project</Button>
      </header>
      <div className="p-4 lg:p-6">{children}</div>
    </main>
  </div>;
}