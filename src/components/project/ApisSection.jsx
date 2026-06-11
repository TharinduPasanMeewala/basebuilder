import React, { useState, useEffect } from 'react';
import { Plus, Wand2, Trash2, Code, ChevronRight, ChevronDown } from 'lucide-react';
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

const METHOD_COLORS = {
  GET: 'bg-green-500/15 text-green-700 border-green-200',
  POST: 'bg-blue-500/15 text-blue-700 border-blue-200',
  PUT: 'bg-yellow-500/15 text-yellow-700 border-yellow-200',
  PATCH: 'bg-orange-500/15 text-orange-700 border-orange-200',
  DELETE: 'bg-red-500/15 text-red-700 border-red-200',
};

export default function ApisSection({ project, onRefresh }) {
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', method: 'GET', path: '', description: '', module: '', auth_required: true });

  useEffect(() => { loadEndpoints(); }, [project.id]);

  const loadEndpoints = async () => {
    setLoading(true);
    const data = await base44.entities.ApiEndpoint.filter({ project_id: project.id }, 'created_date', 100);
    setEndpoints(data);
    setLoading(false);
  };

  const generateApis = async () => {
    setGenerating(true);
    const entities = await base44.entities.DataEntity.filter({ project_id: project.id });
    const entityNames = entities.map(e => e.name).join(', ');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Design the REST API specification for a ${project.type?.replace(/_/g, ' ')} application called "${project.name}".

Data entities: ${entityNames || 'Not defined yet'}

Generate a comprehensive REST API with CRUD operations for all entities, plus business-logic endpoints. Follow RESTful conventions.`,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          endpoints: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                method: { type: 'string' },
                path: { type: 'string' },
                description: { type: 'string' },
                module: { type: 'string' },
                auth_required: { type: 'boolean' },
                roles: { type: 'array', items: { type: 'string' } },
                tags: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    });

    const eps = result.endpoints || [];
    await base44.entities.ApiEndpoint.bulkCreate(
      eps.map(e => ({ project_id: project.id, ...e, source: 'ai_generated' }))
    );
    await loadEndpoints();
    await base44.entities.Project.update(project.id, { phase: 'review', completeness_score: 80 });
    onRefresh();
    setGenerating(false);
  };

  const toggleExpanded = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));
  const deleteEndpoint = async (id) => {
    await base44.entities.ApiEndpoint.delete(id);
    setEndpoints(e => e.filter(ep => ep.id !== id));
  };

  const saveEndpoint = async () => {
    await base44.entities.ApiEndpoint.create({ project_id: project.id, ...form, source: 'user_defined' });
    setShowDialog(false);
    setForm({ name: '', method: 'GET', path: '', description: '', module: '', auth_required: true });
    await loadEndpoints();
  };

  const grouped = endpoints.reduce((acc, ep) => {
    const mod = ep.module || 'General';
    if (!acc[mod]) acc[mod] = [];
    acc[mod].push(ep);
    return acc;
  }, {});

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground mr-2">API Endpoints</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{endpoints.length}</span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowDialog(true)}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={generateApis} disabled={generating}>
          {generating ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {generating ? 'Generating...' : 'AI Generate'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : endpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Code className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-foreground text-sm mb-1">No API endpoints yet</p>
            <p className="text-muted-foreground text-xs mb-4">Generate REST API specification from your data model</p>
            <Button size="sm" onClick={generateApis} disabled={generating} className="gap-2">
              <Wand2 className="w-3.5 h-3.5" /> Generate APIs
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([module, eps]) => (
              <div key={module}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{module} ({eps.length})</h3>
                <div className="space-y-1.5">
                  {eps.map(ep => (
                    <div key={ep.id} className="bg-card border border-border rounded-lg overflow-hidden">
                      <div
                        className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors group"
                        onClick={() => toggleExpanded(ep.id)}
                      >
                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded border w-16 text-center flex-shrink-0 ${METHOD_COLORS[ep.method] || 'bg-muted text-muted-foreground'}`}>
                          {ep.method}
                        </span>
                        <span className="text-xs font-mono text-foreground font-medium flex-1 truncate">{ep.path}</span>
                        <span className="text-xs text-muted-foreground flex-1 truncate hidden sm:block">{ep.description}</span>
                        {!ep.auth_required && <span className="text-xs text-yellow-600 bg-yellow-500/10 px-1.5 py-0.5 rounded flex-shrink-0">Public</span>}
                        <button onClick={e => { e.stopPropagation(); deleteEndpoint(ep.id); }} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {expanded[ep.id] ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                      {expanded[ep.id] && (
                        <div className="border-t border-border px-3 py-3 space-y-2 bg-muted/20">
                          <p className="text-xs text-foreground">{ep.description}</p>
                          {ep.roles?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-muted-foreground mr-1">Roles:</span>
                              {ep.roles.map(r => <span key={r} className="text-xs bg-muted px-1.5 py-0.5 rounded">{r}</span>)}
                            </div>
                          )}
                          {ep.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {ep.tags.map(t => <span key={t} className="text-xs border border-border px-1.5 py-0.5 rounded text-muted-foreground">{t}</span>)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add API Endpoint</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Endpoint Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Method</Label>
                <Select value={form.method} onValueChange={v => setForm(f => ({ ...f, method: v }))}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['GET','POST','PUT','PATCH','DELETE'].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Path *</Label>
                <Input value={form.path} onChange={e => setForm(f => ({ ...f, path: e.target.value }))} className="mt-1 font-mono" placeholder="/api/v1/resource" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Module</Label>
              <Input value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 resize-none h-16 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveEndpoint} disabled={!form.name || !form.path}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}