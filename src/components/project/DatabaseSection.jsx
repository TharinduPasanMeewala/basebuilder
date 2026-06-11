import React, { useState, useEffect } from 'react';
import { Plus, Wand2, Trash2, ChevronRight, ChevronDown, Database, Link } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

const FIELD_TYPES = ['string', 'text', 'number', 'integer', 'boolean', 'date', 'datetime', 'json', 'array', 'file', 'email', 'url', 'enum'];

export default function DatabaseSection({ project, onRefresh }) {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expanded, setExpanded] = useState({});
  const [showDialog, setShowDialog] = useState(false);
  const [editEntity, setEditEntity] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', module: '', fields: [] });
  const { toast } = useToast();

  useEffect(() => { loadEntities(); }, [project.id]);

  const loadEntities = async () => {
    setLoading(true);
    const data = await base44.entities.DataEntity.filter({ project_id: project.id }, 'order_index', 100);
    setEntities(data);
    setLoading(false);
  };

  const generateEntities = async () => {
    setGenerating(true);
    try {
      const [convos, reqs] = await Promise.all([
        base44.entities.Conversation.filter({ project_id: project.id }),
        base44.entities.Requirement.filter({ project_id: project.id }),
      ]);
      const chatContext = convos.flatMap(c => c.messages || []).map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 4000);
      const reqContext = reqs.map(r => `- ${r.title}: ${r.description}`).join('\n').slice(0, 2000);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design the complete database schema for a ${project.type?.replace(/_/g, ' ')} application called "${project.name}".

Context from requirements:
${reqContext || 'No requirements yet - generate a typical schema for this type of application.'}

Chat context:
${chatContext || 'No chat context.'}

Generate a comprehensive data model with 8-15 entities. Each entity MUST have at least 4-8 fields. Include all necessary fields, relationships, and indexes.`,
        model: 'claude_sonnet_4_6',
        response_json_schema: {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  module: { type: 'string' },
                  fields: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        required: { type: 'boolean' },
                        description: { type: 'string' },
                        is_indexed: { type: 'boolean' },
                        is_unique: { type: 'boolean' },
                        foreign_key: { type: 'string' }
                      }
                    }
                  },
                  relationships: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        related_entity: { type: 'string' },
                        type: { type: 'string' },
                        description: { type: 'string' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      });

      const ents = result?.entities || [];
      if (ents.length === 0) {
        toast({ title: 'No entities generated', description: 'The AI did not return any entities. Try adding more requirements first.', variant: 'destructive' });
        return;
      }

      // Create entities one by one to avoid bulk payload size issues
      for (let i = 0; i < ents.length; i++) {
        const e = ents[i];
        await base44.entities.DataEntity.create({
          project_id: project.id,
          name: e.name || `Entity${i + 1}`,
          description: e.description || '',
          module: e.module || '',
          fields: Array.isArray(e.fields) ? e.fields : [],
          relationships: Array.isArray(e.relationships) ? e.relationships : [],
          source: 'ai_generated',
          order_index: i,
        });
      }

      await loadEntities();
      await base44.entities.Project.update(project.id, { phase: 'design', completeness_score: 50 });
      onRefresh();
      toast({ title: `${ents.length} entities generated`, description: 'Your data model has been created successfully.' });
    } catch (e) {
      console.error('Entity generation failed:', e);
      toast({ title: 'Generation failed', description: e.message || 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const toggleExpanded = (id) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  const deleteEntity = async (id) => {
    await base44.entities.DataEntity.delete(id);
    setEntities(e => e.filter(ent => ent.id !== id));
  };

  const openAdd = () => {
    setEditEntity(null);
    setForm({ name: '', description: '', module: '', fields: [] });
    setShowDialog(true);
  };

  const addField = () => {
    setForm(f => ({ ...f, fields: [...f.fields, { name: '', type: 'string', required: false, description: '' }] }));
  };

  const updateField = (idx, key, val) => {
    setForm(f => {
      const fields = [...f.fields];
      fields[idx] = { ...fields[idx], [key]: val };
      return { ...f, fields };
    });
  };

  const removeField = (idx) => {
    setForm(f => ({ ...f, fields: f.fields.filter((_, i) => i !== idx) }));
  };

  const saveEntity = async () => {
    if (editEntity) {
      await base44.entities.DataEntity.update(editEntity.id, form);
    } else {
      await base44.entities.DataEntity.create({ project_id: project.id, ...form, source: 'user_defined' });
    }
    setShowDialog(false);
    await loadEntities();
  };

  const TYPE_COLORS = {
    string: 'text-blue-500', text: 'text-blue-400', number: 'text-green-500', integer: 'text-green-600',
    boolean: 'text-yellow-500', date: 'text-purple-500', datetime: 'text-purple-600',
    json: 'text-orange-500', array: 'text-orange-400', file: 'text-red-400', email: 'text-cyan-500',
    url: 'text-cyan-600', enum: 'text-pink-500',
  };

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground mr-2">Data Model</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{entities.length} entities</span>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={openAdd}>
          <Plus className="w-3.5 h-3.5" /> Add Entity
        </Button>
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={generateEntities} disabled={generating}>
          {generating ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {generating ? 'Generating...' : 'AI Generate'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : entities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-3">
              <Database className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-foreground text-sm mb-1">No entities yet</p>
            <p className="text-muted-foreground text-xs mb-4">Generate your data model from requirements and conversations</p>
            <Button size="sm" onClick={generateEntities} disabled={generating} className="gap-2">
              <Wand2 className="w-3.5 h-3.5" /> Generate Data Model
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {entities.map(entity => (
              <div key={entity.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div
                  className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => toggleExpanded(entity.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Database className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{entity.name}</p>
                      <p className="text-xs text-muted-foreground">{entity.module || 'General'} · {entity.fields?.length || 0} fields</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {entity.relationships?.length > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Link className="w-3 h-3" /> {entity.relationships.length}
                      </span>
                    )}
                    <button onClick={e => { e.stopPropagation(); deleteEntity(entity.id); }} className="text-muted-foreground hover:text-destructive p-1 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {expanded[entity.id] ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
                {expanded[entity.id] && (
                  <div className="border-t border-border">
                    {entity.description && (
                      <p className="text-xs text-muted-foreground px-4 py-2 border-b border-border bg-muted/20">{entity.description}</p>
                    )}
                    {entity.fields?.length > 0 && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border bg-muted/30">
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Field Name</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Type</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Required</th>
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {entity.fields.map((field, i) => (
                              <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                                <td className="px-4 py-2 font-mono font-medium text-foreground">{field.name}</td>
                                <td className="px-4 py-2"><span className={`font-mono font-medium ${TYPE_COLORS[field.type] || 'text-foreground'}`}>{field.type}</span></td>
                                <td className="px-4 py-2">{field.required ? <span className="text-red-500 font-bold">*</span> : <span className="text-muted-foreground">—</span>}</td>
                                <td className="px-4 py-2 text-muted-foreground">{field.description}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {entity.relationships?.length > 0 && (
                      <div className="px-4 py-3 bg-muted/10 border-t border-border">
                        <p className="text-xs font-medium text-muted-foreground mb-2">Relationships</p>
                        <div className="flex flex-wrap gap-2">
                          {entity.relationships.map((rel, i) => (
                            <span key={i} className="inline-flex items-center gap-1 text-xs bg-muted px-2 py-1 rounded-md">
                              <Link className="w-3 h-3 text-primary" />
                              <span className="font-medium">{rel.related_entity}</span>
                              <span className="text-muted-foreground">({rel.type?.replace(/_/g, ' ')})</span>
                            </span>
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
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editEntity ? 'Edit Entity' : 'Add Entity'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Entity Name *</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="mt-1 font-mono" placeholder="e.g. Customer, SalesOrder" />
            </div>
            <div>
              <Label className="text-xs">Module</Label>
              <Input value={form.module} onChange={e => setForm(f => ({ ...f, module: e.target.value }))} className="mt-1" placeholder="e.g. Sales, HR, Inventory" />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="mt-1 resize-none h-16 text-sm" />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Fields</Label>
                <Button type="button" size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={addField}>
                  <Plus className="w-3 h-3" /> Add Field
                </Button>
              </div>
              {form.fields.map((field, i) => (
                <div key={i} className="grid grid-cols-12 gap-1.5 mb-2 items-start">
                  <Input value={field.name} onChange={e => updateField(i, 'name', e.target.value)} placeholder="field_name" className="col-span-4 h-8 text-xs font-mono" />
                  <select
                    value={field.type}
                    onChange={e => updateField(i, 'type', e.target.value)}
                    className="col-span-3 h-8 text-xs border border-input rounded-md bg-background px-2"
                  >
                    {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Input value={field.description} onChange={e => updateField(i, 'description', e.target.value)} placeholder="description" className="col-span-4 h-8 text-xs" />
                  <button onClick={() => removeField(i)} className="col-span-1 text-muted-foreground hover:text-destructive h-8 flex items-center justify-center">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancel</Button>
            <Button onClick={saveEntity} disabled={!form.name}>Save Entity</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}