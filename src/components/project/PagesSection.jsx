import React, { useState, useEffect } from 'react';
import { Plus, Wand2, Trash2, Layout, Monitor, BarChart3, Table, FileText, Settings } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';

const PAGE_TYPE_ICONS = {
  dashboard: BarChart3, list: Table, detail: FileText, form: FileText,
  report: BarChart3, settings: Settings, kanban: Layout, calendar: Monitor, chart: BarChart3, landing: Monitor, auth: Settings,
};

const PAGE_TYPE_COLORS = {
  dashboard: 'bg-blue-500/15 text-blue-600',
  list: 'bg-green-500/15 text-green-600',
  detail: 'bg-purple-500/15 text-purple-600',
  form: 'bg-orange-500/15 text-orange-600',
  report: 'bg-cyan-500/15 text-cyan-600',
  settings: 'bg-gray-500/15 text-gray-600',
  kanban: 'bg-pink-500/15 text-pink-600',
  calendar: 'bg-yellow-500/15 text-yellow-600',
  chart: 'bg-indigo-500/15 text-indigo-600',
};

export default function PagesSection({ project, onRefresh }) {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', route: '', type: 'list', description: '', module: '' });

  useEffect(() => { loadPages(); }, [project.id]);

  const loadPages = async () => {
    setLoading(true);
    const data = await base44.entities.PageSpec.filter({ project_id: project.id }, 'order_index', 100);
    setPages(data);
    setLoading(false);
  };

  const generatePages = async () => {
    setGenerating(true);
    const [entities, reqs] = await Promise.all([
      base44.entities.DataEntity.filter({ project_id: project.id }),
      base44.entities.Requirement.filter({ project_id: project.id }),
    ]);
    const entityNames = entities.map(e => e.name).join(', ');
    const reqContext = reqs.slice(0, 20).map(r => `- ${r.title}`).join('\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Design the complete page/screen inventory for a ${project.type?.replace(/_/g, ' ')} application called "${project.name}".

Data entities: ${entityNames || 'Not yet defined'}
Key requirements:
${reqContext || 'Generate typical pages for this type of application.'}

Generate 10-20 pages covering all major functionality. Include dashboards, list views, detail views, forms, and reports.`,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          pages: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                route: { type: 'string' },
                type: { type: 'string' },
                description: { type: 'string' },
                module: { type: 'string' },
                roles_access: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    });

    const ps = result.pages || [];
    await base44.entities.PageSpec.bulkCreate(
      ps.map((p, i) => ({ project_id: project.id, ...p, source: 'ai_generated', order_index: i }))
    );
    await loadPages();
    onRefresh();
    setGenerating(false);
  };

  const deletePage = async (id) => {
    await base44.entities.PageSpec.delete(id);
    setPages(p => p.filter(pg => pg.id !== id));
  };

  const savePage = async () => {
    await base44.entities.PageSpec.create({ project_id: project.id, ...form, source: 'user_defined' });
    setShowDialog(false);
    setForm({ name: '', route: '', type: 'list', description: '', module: '' });
    await loadPages();
  };

  const grouped = pages.reduce((acc, page) => {
    const mod = page.module || 'General';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(page);
    return acc;
  }, {});

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground mr-2">UI Pages</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{pages.length} pages</span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowDialog(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Page
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={generatePages} disabled={generating}>
          {generating ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {generating ? 'Generating...' : 'AI Generate'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="grid grid-cols-2 gap-2">{[1,2,3,4].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Layout className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-foreground text-sm mb-1">No pages designed yet</p>
            <p className="text-muted-foreground text-xs mb-4">Generate the UI page inventory from your data model and requirements</p>
            <Button size="sm" onClick={generatePages} disabled={generating} className="gap-2">
              <Wand2 className="w-3.5 h-3.5" /> Generate Pages
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([module, modulePages]) => (
              <div key={module}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{module} ({modulePages.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {modulePages.map(page => {
                    const TypeIcon = PAGE_TYPE_ICONS[page.type] || Layout;
                    const colorClass = PAGE_TYPE_COLORS[page.type] || 'bg-muted text-muted-foreground';
                    return (
                      <div key={page.id} className="bg-card border border-border rounded-lg p-3 group hover:border-primary/30 transition-all">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${colorClass}`}>
                              <TypeIcon className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{page.name}</p>
                              <p className="text-xs text-muted-foreground font-mono truncate">{page.route}</p>
                              {page.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{page.description}</p>}
                            </div>
                          </div>
                          <button onClick={() => deletePage(page.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {page.roles_access?.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {page.roles_access.slice(0, 3).map(role => (
                              <span key={role} className="text-xs bg-muted px-1.5 py-0.5 rounded">{role}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Page</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Page Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" placeholder="e.g. Customer List" />
            </div>
            <div>
              <Label className="text-xs">Route</Label>
              <Input value={form.route} onChange={e => setForm(f => ({ ...f, route: e.target.value }))} className="mt-1 font-mono" placeholder="/customers" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Page Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['dashboard','list','detail','form','report','settings','kanban','calendar','chart'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Module</Label>
                <Input value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className="mt-1" placeholder="Sales" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 resize-none h-16 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={savePage} disabled={!form.name}>Add Page</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}