import React, { useState, useEffect } from 'react';
import { Plus, Wand2, Trash2, GitBranch, ChevronRight, ChevronDown, ArrowRight } from 'lucide-react';
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

const TRIGGER_COLORS = {
  entity_create: 'bg-green-500/15 text-green-600',
  entity_update: 'bg-blue-500/15 text-blue-600',
  entity_delete: 'bg-red-500/15 text-red-600',
  scheduled: 'bg-purple-500/15 text-purple-600',
  manual: 'bg-gray-500/15 text-gray-600',
  api_call: 'bg-orange-500/15 text-orange-600',
  event: 'bg-cyan-500/15 text-cyan-600',
};

export default function WorkflowsSection({ project, onRefresh }) {
  const [workflows, setWorkflows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showDialog, setShowDialog] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', trigger: '', trigger_type: 'entity_create', module: '', steps: [] });

  useEffect(() => { loadWorkflows(); }, [project.id]);

  const loadWorkflows = async () => {
    setLoading(true);
    const data = await base44.entities.WorkflowSpec.filter({ project_id: project.id }, 'created_date', 100);
    setWorkflows(data);
    setLoading(false);
  };

  const generateWorkflows = async () => {
    setGenerating(true);
    const [entities, reqs] = await Promise.all([
      base44.entities.DataEntity.filter({ project_id: project.id }),
      base44.entities.Requirement.filter({ project_id: project.id }),
    ]);
    const entityNames = entities.map(e => e.name).join(', ');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `Design business workflows and automations for a ${project.type?.replace(/_/g, ' ')} application called "${project.name}".

Data entities: ${entityNames || 'Not defined yet'}
Requirements: ${reqs.slice(0, 10).map(r => r.title).join(', ') || 'Not defined yet'}

Generate 6-10 key business workflows including status flows, approval processes, notifications, and automations.`,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          workflows: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                trigger: { type: 'string' },
                trigger_type: { type: 'string' },
                module: { type: 'string' },
                steps: {
                  type: 'array',
                  items: { type: 'object', properties: { order: { type: 'number' }, name: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' }, actions: { type: 'string' } } }
                },
                status_flow: {
                  type: 'array',
                  items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, condition: { type: 'string' } } }
                }
              }
            }
          }
        }
      }
    });

    const wfs = result.workflows || [];
    await base44.entities.WorkflowSpec.bulkCreate(
      wfs.map(w => ({ project_id: project.id, ...w, source: 'ai_generated' }))
    );
    await loadWorkflows();
    await base44.entities.Project.update(project.id, { phase: 'architecture', completeness_score: 65 });
    onRefresh();
    setGenerating(false);
  };

  const toggleExpanded = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const deleteWorkflow = async (id) => {
    await base44.entities.WorkflowSpec.delete(id);
    setWorkflows(w => w.filter(wf => wf.id !== id));
  };

  const saveWorkflow = async () => {
    await base44.entities.WorkflowSpec.create({ project_id: project.id, ...form, source: 'user_defined' });
    setShowDialog(false);
    setForm({ name: '', description: '', trigger: '', trigger_type: 'entity_create', module: '', steps: [] });
    await loadWorkflows();
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground mr-2">Workflows</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{workflows.length}</span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowDialog(true)}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={generateWorkflows} disabled={generating}>
          {generating ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {generating ? 'Generating...' : 'AI Generate'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : workflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <GitBranch className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-foreground text-sm mb-1">No workflows yet</p>
            <p className="text-muted-foreground text-xs mb-4">Generate business workflows, automations, and status flows</p>
            <Button size="sm" onClick={generateWorkflows} disabled={generating} className="gap-2">
              <Wand2 className="w-3.5 h-3.5" /> Generate Workflows
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {workflows.map(wf => (
              <div key={wf.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpanded(wf.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <GitBranch className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{wf.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {wf.module && <span className="text-xs text-muted-foreground">{wf.module}</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TRIGGER_COLORS[wf.trigger_type] || 'bg-muted text-muted-foreground'}`}>
                          {wf.trigger_type?.replace(/_/g, ' ')}
                        </span>
                        {wf.steps?.length > 0 && <span className="text-xs text-muted-foreground">{wf.steps.length} steps</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={e => { e.stopPropagation(); deleteWorkflow(wf.id); }} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expanded[wf.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {expanded[wf.id] && (
                  <div className="border-t border-border px-4 py-3 space-y-3">
                    {wf.description && <p className="text-xs text-muted-foreground">{wf.description}</p>}
                    {wf.trigger && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Trigger</p>
                        <p className="text-xs text-foreground bg-muted/50 px-2 py-1.5 rounded-md">{wf.trigger}</p>
                      </div>
                    )}
                    {wf.steps?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Steps</p>
                        <div className="space-y-1.5">
                          {wf.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">{i + 1}</div>
                              <div className="flex-1">
                                <p className="text-xs font-medium text-foreground">{step.name}</p>
                                {step.description && <p className="text-xs text-muted-foreground">{step.description}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {wf.status_flow?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Status Flow</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {wf.status_flow.map((sf, i) => (
                            <React.Fragment key={i}>
                              <span className="text-xs bg-muted px-2 py-1 rounded font-medium">{sf.from}</span>
                              <ArrowRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                              <span className="text-xs bg-muted px-2 py-1 rounded font-medium">{sf.to}</span>
                              {i < wf.status_flow.length - 1 && <span className="text-muted-foreground">·</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add Workflow</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Workflow Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Trigger Type</Label>
                <Select value={form.trigger_type} onValueChange={v => setForm(f => ({ ...f, trigger_type: v }))}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {['entity_create','entity_update','entity_delete','scheduled','manual','api_call','event'].map(t => (
                      <SelectItem key={t} value={t}>{t.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Module</Label>
                <Input value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-xs">Trigger Description</Label>
              <Input value={form.trigger} onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))} className="mt-1" placeholder="When an order is created..." />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 resize-none h-16 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveWorkflow} disabled={!form.name}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}