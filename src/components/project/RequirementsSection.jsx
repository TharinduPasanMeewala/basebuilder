import React, { useState, useEffect } from 'react';
import { Plus, Wand2, Trash2, Check, Filter, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const CATEGORIES = ['functional', 'non_functional', 'business_rule', 'user_story', 'constraint', 'assumption'];
const PRIORITIES = ['critical', 'high', 'medium', 'low'];
const STATUSES = ['draft', 'confirmed', 'rejected', 'deferred'];

const PRIORITY_COLORS = {
  critical: 'bg-red-500/15 text-red-600 border-red-200',
  high: 'bg-orange-500/15 text-orange-600 border-orange-200',
  medium: 'bg-yellow-500/15 text-yellow-600 border-yellow-200',
  low: 'bg-gray-500/15 text-gray-600 border-gray-200',
};

const STATUS_COLORS = {
  draft: 'bg-blue-500/15 text-blue-600 border-blue-200',
  confirmed: 'bg-green-500/15 text-green-600 border-green-200',
  rejected: 'bg-red-500/15 text-red-600 border-red-200',
  deferred: 'bg-gray-500/15 text-gray-600 border-gray-200',
};

export default function RequirementsSection({ project, onRefresh }) {
  const [requirements, setRequirements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterCat, setFilterCat] = useState('all');
  const [filterPri, setFilterPri] = useState('all');
  const [showDialog, setShowDialog] = useState(false);
  const [editReq, setEditReq] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', category: 'functional', priority: 'medium', acceptance_criteria: '', module: '' });

  useEffect(() => { loadRequirements(); }, [project.id]);

  const loadRequirements = async () => {
    setLoading(true);
    const data = await base44.entities.Requirement.filter({ project_id: project.id }, 'order_index', 200);
    setRequirements(data);
    setLoading(false);
  };

  const generateRequirements = async () => {
    setGenerating(true);
    const convos = await base44.entities.Conversation.filter({ project_id: project.id });
    const chatHistory = convos.flatMap(c => c.messages || []).map(m => `${m.role}: ${m.content}`).join('\n\n').slice(0, 8000);

    const prompt = `Based on the following conversation about a ${project.type?.replace(/_/g, ' ')} application called "${project.name}", generate a comprehensive list of requirements.

CONVERSATION HISTORY:
${chatHistory || 'No conversation history yet. Generate typical requirements for a ' + project.type?.replace(/_/g, ' ') + ' application.'}

Generate requirements in the following JSON format:
{
  "requirements": [
    {
      "title": "Requirement title",
      "description": "Detailed description",
      "category": "functional|non_functional|business_rule|user_story|constraint",
      "priority": "critical|high|medium|low",
      "module": "Module name",
      "acceptance_criteria": "How to verify this is met"
    }
  ]
}

Generate 15-25 well-structured requirements covering different categories and modules. For user stories use format: "As a [persona], I want to [action] so that [benefit]"`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      model: 'claude_sonnet_4_6',
      response_json_schema: {
        type: 'object',
        properties: {
          requirements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' },
                priority: { type: 'string' },
                module: { type: 'string' },
                acceptance_criteria: { type: 'string' }
              }
            }
          }
        }
      }
    });

    const reqs = result.requirements || [];
    await base44.entities.Requirement.bulkCreate(
      reqs.map((r, i) => ({
        project_id: project.id,
        ...r,
        status: 'draft',
        source: 'ai_generated',
        order_index: i,
      }))
    );
    await loadRequirements();
    await base44.entities.Project.update(project.id, { phase: 'analysis', completeness_score: 25 });
    onRefresh();
    setGenerating(false);
  };

  const saveRequirement = async () => {
    if (editReq) {
      await base44.entities.Requirement.update(editReq.id, form);
    } else {
      await base44.entities.Requirement.create({ project_id: project.id, ...form, source: 'user_defined', status: 'draft' });
    }
    setShowDialog(false);
    setEditReq(null);
    setForm({ title: '', description: '', category: 'functional', priority: 'medium', acceptance_criteria: '', module: '' });
    await loadRequirements();
  };

  const deleteReq = async (id) => {
    await base44.entities.Requirement.delete(id);
    setRequirements(r => r.filter(req => req.id !== id));
  };

  const updateStatus = async (id, status) => {
    await base44.entities.Requirement.update(id, { status });
    setRequirements(r => r.map(req => req.id === id ? { ...req, status } : req));
  };

  const openEdit = (req) => {
    setEditReq(req);
    setForm({ title: req.title, description: req.description, category: req.category, priority: req.priority, acceptance_criteria: req.acceptance_criteria || '', module: req.module || '' });
    setShowDialog(true);
  };

  const filtered = requirements.filter(r => {
    const matchCat = filterCat === 'all' || r.category === filterCat;
    const matchPri = filterPri === 'all' || r.priority === filterPri;
    return matchCat && matchPri;
  });

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = filtered.filter(r => r.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0 flex-wrap">
        <h2 className="text-sm font-semibold text-foreground mr-2">Requirements</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{requirements.length}</span>
        <div className="flex-1" />
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="h-7 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterPri} onValueChange={setFilterPri}>
          <SelectTrigger className="h-7 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
          onClick={() => { setEditReq(null); setForm({ title: '', description: '', category: 'functional', priority: 'medium', acceptance_criteria: '', module: '' }); setShowDialog(true); }}>
          <Plus className="w-3.5 h-3.5" /> Add
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={generateRequirements} disabled={generating}>
          {generating ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {generating ? 'Generating...' : 'AI Generate'}
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : requirements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Wand2 className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-foreground text-sm mb-1">No requirements yet</p>
            <p className="text-muted-foreground text-xs mb-4">Chat with the AI agents first, then generate requirements from the conversation</p>
            <Button size="sm" onClick={generateRequirements} disabled={generating} className="gap-2">
              <Wand2 className="w-3.5 h-3.5" /> Generate from Chat
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            {Object.entries(grouped).map(([cat, items]) => (
              <div key={cat}>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 capitalize">
                  {cat.replace(/_/g, ' ')} ({items.length})
                </h3>
                <div className="space-y-2">
                  {items.map(req => (
                    <div key={req.id} className="bg-card border border-border rounded-lg p-3 group hover:border-primary/30 transition-all">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="text-sm font-medium text-foreground leading-tight">{req.title}</p>
                            {req.module && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{req.module}</span>}
                          </div>
                          {req.description && <p className="text-xs text-muted-foreground leading-relaxed">{req.description}</p>}
                          {req.acceptance_criteria && (
                            <p className="text-xs text-muted-foreground mt-1 italic">✓ {req.acceptance_criteria}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium capitalize ${PRIORITY_COLORS[req.priority]}`}>{req.priority}</span>
                          <Select value={req.status} onValueChange={v => updateStatus(req.id, v)}>
                            <SelectTrigger className={`h-6 text-xs border px-2 w-auto ${STATUS_COLORS[req.status]}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <button onClick={() => openEdit(req)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all p-1">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteReq(req.id)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editReq ? 'Edit Requirement' : 'Add Requirement'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c.replace(/_/g, ' ')}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Priority</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label className="text-xs">Module</Label>
              <Input value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className="mt-1" placeholder="e.g. Inventory, HR, Finance" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 resize-none h-20 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Acceptance Criteria</Label>
              <Textarea value={form.acceptance_criteria} onChange={e => setForm(f => ({ ...f, acceptance_criteria: e.target.value }))} className="mt-1 resize-none h-16 text-sm" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveRequirement} disabled={!form.title}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}