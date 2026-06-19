import React, { useMemo, useState } from 'react';
import { LayoutDashboard, Table2, FileText, BarChart3, Settings } from 'lucide-react';

const pageIcon = { dashboard: LayoutDashboard, list: Table2, detail: FileText, form: FileText, report: BarChart3, settings: Settings };

function sampleRows(entity) {
  const fields = Object.keys(entity.schema?.properties || {}).slice(0, 4);
  return [1, 2, 3].map(i => Object.fromEntries(fields.map(f => [f, `${f.replace(/_/g, ' ')} ${i}`])));
}

function PageBody({ page, entities }) {
  const linked = entities.find(e => page.description?.toLowerCase().includes(e.name?.toLowerCase())) || entities[0];
  const fields = Object.keys(linked?.schema?.properties || {}).slice(0, 5);
  if (page.type === 'dashboard') return <div className="grid grid-cols-2 gap-3">{entities.slice(0,4).map((e,i)=><div key={e.id} className="rounded-xl border border-border bg-card p-4"><p className="text-xs text-muted-foreground">{e.display_name || e.name}</p><p className="text-2xl font-bold text-foreground mt-1">{(i+1)*12}</p></div>)}</div>;
  if (page.type === 'form') return <div className="space-y-3">{fields.map(f=><div key={f}><label className="text-xs font-medium capitalize">{f.replace(/_/g,' ')}</label><div className="h-9 rounded-md border border-input bg-background mt-1" /></div>)}<button className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm">Save</button></div>;
  return <div className="overflow-hidden rounded-xl border border-border"><table className="w-full text-sm"><thead className="bg-muted/50"><tr>{fields.map(f=><th key={f} className="text-left p-3 capitalize text-xs">{f.replace(/_/g,' ')}</th>)}</tr></thead><tbody>{sampleRows(linked || {}).map((r,i)=><tr key={i} className="border-t border-border">{fields.map(f=><td key={f} className="p-3 text-muted-foreground">{r[f]}</td>)}</tr>)}</tbody></table></div>;
}

export default function AppPreviewCanvas({ pages, entities }) {
  const [activeId, setActiveId] = useState(pages[0]?.id);
  const active = useMemo(() => pages.find(p => p.id === activeId) || pages[0], [pages, activeId]);
  if (!pages.length) return <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">No UI pages generated yet. Click Generate UI Preview to create screens from your project specs.</div>;
  return <div className="rounded-xl border border-border overflow-hidden bg-background shadow-sm min-h-[520px]"><div className="h-9 bg-muted/40 border-b border-border flex items-center gap-2 px-3"><span className="w-3 h-3 rounded-full bg-destructive/70"/><span className="w-3 h-3 rounded-full bg-yellow-500/70"/><span className="w-3 h-3 rounded-full bg-accent/70"/><span className="ml-3 text-xs text-muted-foreground">AI generated app preview</span></div><div className="flex min-h-[480px]"><aside className="w-52 bg-sidebar text-sidebar-foreground p-4"><h3 className="font-bold text-white text-sm mb-5">{active?.module || 'App'}</h3><nav className="space-y-1">{pages.map(p=>{const Icon=pageIcon[p.type]||LayoutDashboard;return <button key={p.id} onClick={()=>setActiveId(p.id)} className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-left ${active?.id===p.id?'bg-sidebar-active text-white':'hover:bg-sidebar-hover'}`}><Icon className="w-3.5 h-3.5" />{p.name}</button>})}</nav></aside><main className="flex-1 p-6 bg-background"><div className="mb-6"><p className="text-xs text-primary font-medium capitalize">{active?.type || 'page'} · {active?.route}</p><h2 className="text-2xl font-bold text-foreground mt-1">{active?.name}</h2><p className="text-sm text-muted-foreground mt-1">{active?.description}</p></div><PageBody page={active || {}} entities={entities} /></main></div></div>;
}