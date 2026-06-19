import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2, Pencil, Database, RotateCcw, MousePointerClick, Sparkles } from 'lucide-react';
import AppPreviewCanvas from '@/components/live-preview/AppPreviewCanvas';
import BrandStylePanel from '@/components/live-preview/BrandStylePanel';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const FIELD_TYPES = ['string', 'text', 'number', 'integer', 'boolean', 'date', 'datetime', 'enum', 'reference'];
const DEFAULT_BRAND_STYLE = {
  primary_color: '#6366f1',
  accent_color: '#10b981',
  background_color: '#f8fafc',
  surface_color: '#ffffff',
  text_color: '#0f172a',
  font_family: 'Inter',
  radius: 16,
  density: 'comfortable',
};

function normalizeSchema(entity) {
  const schema = entity.schema || {};
  return {
    properties: schema.properties || {},
    required: Array.isArray(schema.required) ? schema.required : [],
  };
}

function getFieldType(field = {}) {
  if (Array.isArray(field.enum) && field.enum.length > 0) return 'enum';
  if (field.type === 'integer') return 'number';
  if (field.format === 'date') return 'date';
  if (field.format === 'date-time' || field.type === 'date-time') return 'datetime';
  if (field.type === 'reference' || field.reference || field.related_entity || field.foreign_key || field.$ref) return 'reference';
  if (FIELD_TYPES.includes(field.type)) return field.type;
  return 'string';
}

function getReferenceName(field = {}) {
  const ref = field.reference || field.related_entity || field.entity || field.foreign_key || field.$ref || '';
  return String(ref).replace('#/definitions/', '').replace('#/$defs/', '').replace(/_id$/i, '');
}

function recordLabel(record) {
  const data = record.record_data || {};
  const value = Object.values(data).find(v => v !== undefined && v !== null && typeof v !== 'object' && String(v).trim() !== '');
  return value ? String(value) : record.id;
}

function displayValue(value, field, allRecords) {
  if (value === undefined || value === null || value === '') return '—';
  if (getFieldType(field) === 'boolean') return value ? 'Yes' : 'No';
  if (getFieldType(field) === 'reference') {
    const match = allRecords.find(r => r.id === value);
    return match ? recordLabel(match) : String(value);
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default function LivePreviewSection({ project }) {
  const queryClient = useQueryClient();
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [formData, setFormData] = useState({});
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState('app');
  const [designMode, setDesignMode] = useState(false);
  const [showBrandPanel, setShowBrandPanel] = useState(false);
  const [brandStyle, setBrandStyle] = useState(DEFAULT_BRAND_STYLE);
  const [visualEdit, setVisualEdit] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editDraft, setEditDraft] = useState({ label: '', description: '' });

  const entitiesQuery = useQuery({
    queryKey: ['entityDefinitions', project?.id],
    queryFn: () => base44.entities.EntityDefinition.filter({ project_id: project.id }, 'order_index', 100),
    enabled: !!project?.id,
  });

  const dataEntitiesQuery = useQuery({
    queryKey: ['dataEntitiesForPreview', project?.id],
    queryFn: () => base44.entities.DataEntity.filter({ project_id: project.id }, 'order_index', 100),
    enabled: !!project?.id,
  });

  const recordsQuery = useQuery({
    queryKey: ['projectRecords', project?.id],
    queryFn: () => base44.entities.ProjectRecord.filter({ project_id: project.id }, '-created_date', 500),
    enabled: !!project?.id,
  });

  const pagesQuery = useQuery({
    queryKey: ['pageSpecsForPreview', project?.id],
    queryFn: () => base44.entities.PageSpec.filter({ project_id: project.id }, 'order_index', 100),
    enabled: !!project?.id,
  });

  const designQuery = useQuery({
    queryKey: ['projectDesign', project?.id],
    queryFn: async () => {
      const designs = await base44.entities.ProjectDesign.filter({ project_id: project.id }, '-updated_date', 1);
      return designs[0] || null;
    },
    enabled: !!project?.id,
  });

  const entityDefinitions = entitiesQuery.data || [];
  const dataEntities = dataEntitiesQuery.data || [];
  const entities = useMemo(() => {
    if (entityDefinitions.length > 0) return entityDefinitions;
    return dataEntities.map(entity => ({
      id: entity.id,
      name: entity.name,
      display_name: entity.name,
      description: entity.description,
      _source: 'DataEntity',
      _original: entity,
      schema: {
        type: 'object',
        properties: (entity.fields || []).reduce((acc, field) => {
          acc[field.name] = {
            type: field.type === 'integer' ? 'number' : field.type,
            description: field.description,
            enum: field.enum_values,
            reference: field.foreign_key || field.related_entity,
          };
          return acc;
        }, {}),
        required: (entity.fields || []).filter(field => field.required).map(field => field.name),
      },
    }));
  }, [entityDefinitions, dataEntities]);
  const records = recordsQuery.data || [];
  const pages = pagesQuery.data || [];
  const savedDesign = designQuery.data;
  const isLoading = entitiesQuery.isLoading || dataEntitiesQuery.isLoading || recordsQuery.isLoading || pagesQuery.isLoading || designQuery.isLoading;

  useEffect(() => {
    setBrandStyle({ ...DEFAULT_BRAND_STYLE, ...(savedDesign || {}) });
  }, [savedDesign]);

  const recordsByEntity = useMemo(() => {
    return records.reduce((acc, record) => {
      acc[record.entity_name] = acc[record.entity_name] || [];
      acc[record.entity_name].push(record);
      return acc;
    }, {});
  }, [records]);

  const invalidateRecords = () => queryClient.invalidateQueries({ queryKey: ['projectRecords', project.id] });
  const invalidateEntities = () => {
    queryClient.invalidateQueries({ queryKey: ['entityDefinitions', project.id] });
    queryClient.invalidateQueries({ queryKey: ['dataEntitiesForPreview', project.id] });
  };
  const invalidatePages = () => queryClient.invalidateQueries({ queryKey: ['pageSpecsForPreview', project.id] });
  const invalidateDesign = () => queryClient.invalidateQueries({ queryKey: ['projectDesign', project.id] });

  const createRecord = useMutation({
    mutationFn: (record) => base44.entities.ProjectRecord.create(record),
    onSuccess: () => { invalidateRecords(); setIsDialogOpen(false); setFormData({}); setEditingRecord(null); },
  });

  const updateRecord = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProjectRecord.update(id, data),
    onSuccess: () => { invalidateRecords(); setIsDialogOpen(false); setFormData({}); setEditingRecord(null); },
  });

  const deleteRecord = useMutation({
    mutationFn: (id) => base44.entities.ProjectRecord.delete(id),
    onSuccess: invalidateRecords,
  });

  const resetPreviewData = useMutation({
    mutationFn: async () => Promise.all(records.map(record => base44.entities.ProjectRecord.delete(record.id))),
    onSuccess: invalidateRecords,
  });

  const saveBrandStyle = useMutation({
    mutationFn: async () => {
      const payload = { ...brandStyle, project_id: project.id };
      if (savedDesign?.id) return base44.entities.ProjectDesign.update(savedDesign.id, payload);
      return base44.entities.ProjectDesign.create(payload);
    },
    onSuccess: invalidateDesign,
  });

  const generateUiPreview = useMutation({
    mutationFn: async () => {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate UX/UI page designs for this app so they can be shown in a live app preview.\nProject: ${project.name}\nDescription: ${project.description || ''}\nType: ${project.type}\nData models: ${JSON.stringify(entities.map(e => ({ name: e.name, description: e.description, fields: Object.keys(e.schema?.properties || {}) })))}\nExisting pages: ${JSON.stringify(pages.map(p => ({ name: p.name, type: p.type, route: p.route })))}\nCreate practical screens such as dashboard, list, detail, form, report, or settings pages.`,
        response_json_schema: {
          type: 'object',
          properties: {
            pages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' }, route: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' }, module: { type: 'string' }, components: { type: 'array', items: { type: 'object' } }
                }
              }
            }
          }
        }
      });
      const existing = new Set(pages.map(p => p.name?.toLowerCase().trim()));
      const validTypes = ['dashboard','list','detail','form','report','settings','landing','kanban','calendar','chart'];
      const newPages = (result.pages || []).filter(p => p.name && !existing.has(p.name.toLowerCase().trim())).slice(0, 12);
      await Promise.all(newPages.map((page, index) => base44.entities.PageSpec.create({
        project_id: project.id,
        name: page.name,
        route: page.route || `/${page.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        type: validTypes.includes(page.type) ? page.type : 'list',
        description: page.description || '',
        module: page.module || project.name,
        components: Array.isArray(page.components) ? page.components : [],
        source: 'ai_generated',
        order_index: pages.length + index,
      })));
    },
    onSuccess: () => { invalidatePages(); setPreviewMode('app'); },
  });

  const updatePreviewElement = useMutation({
    mutationFn: async ({ target, draft }) => {
      if (target.type === 'entity') {
        if (target.entity._source === 'DataEntity') {
          await base44.entities.DataEntity.update(target.entity.id, { name: draft.label, description: draft.description });
        } else {
          await base44.entities.EntityDefinition.update(target.entity.id, { display_name: draft.label, description: draft.description });
        }
        if (target.entity._source === 'DataEntity' && draft.label !== target.entity.name) {
          const matching = records.filter(record => record.entity_name === target.entity.name);
          await Promise.all(matching.map(record => base44.entities.ProjectRecord.update(record.id, { entity_name: draft.label })));
        }
      }
      if (target.type === 'field') {
        const { entity, fieldName } = target;
        const { properties, required } = normalizeSchema(entity);
        const nextProperties = {};
        Object.entries(properties).forEach(([key, value]) => {
          nextProperties[key === fieldName ? draft.label : key] = key === fieldName ? { ...value, description: draft.description } : value;
        });
        const nextRequired = required.map(key => key === fieldName ? draft.label : key);
        if (entity._source === 'DataEntity') {
          const original = entity._original || {};
          const nextFields = (original.fields || []).map(field => field.name === fieldName ? { ...field, name: draft.label, description: draft.description } : field);
          await base44.entities.DataEntity.update(entity.id, { fields: nextFields });
        } else {
          await base44.entities.EntityDefinition.update(entity.id, { schema: { ...(entity.schema || {}), properties: nextProperties, required: nextRequired } });
        }
        if (draft.label !== fieldName) {
          const matching = records.filter(record => record.entity_name === entity.name);
          await Promise.all(matching.map(record => {
            const data = { ...(record.record_data || {}) };
            data[draft.label] = data[fieldName];
            delete data[fieldName];
            return base44.entities.ProjectRecord.update(record.id, { record_data: data });
          }));
        }
      }
    },
    onSuccess: () => { invalidateEntities(); invalidateRecords(); setEditTarget(null); },
  });

  const openVisualEditor = (target) => {
    if (!visualEdit) return;
    const isField = target.type === 'field';
    setEditTarget(target);
    setEditDraft({
      label: isField ? target.fieldName : (target.entity.display_name || target.entity.name),
      description: isField ? (target.fieldSchema?.description || '') : (target.entity.description || ''),
    });
  };

  const openCreateDialog = (entity) => {
    setSelectedEntity(entity);
    setEditingRecord(null);
    setFormData({});
    setIsDialogOpen(true);
  };

  const openEditDialog = (entity, record) => {
    setSelectedEntity(entity);
    setEditingRecord(record);
    setFormData(record.record_data || {});
    setIsDialogOpen(true);
  };

  const handleInputChange = (fieldName, value, type) => {
    const parsed = type === 'number' ? (value === '' ? '' : Number(value)) : value;
    setFormData(prev => ({ ...prev, [fieldName]: parsed }));
  };

  const handleSaveRecord = () => {
    if (!selectedEntity) return;
    const payload = {
      project_id: project.id,
      entity_definition_id: selectedEntity.id,
      entity_name: selectedEntity.name,
      record_data: formData,
    };
    if (editingRecord) updateRecord.mutate({ id: editingRecord.id, data: payload });
    else createRecord.mutate(payload);
  };

  const refreshAll = () => { invalidateEntities(); invalidateRecords(); invalidatePages(); invalidateDesign(); };

  const renderField = (fieldName, fieldSchema, required) => {
    const type = getFieldType(fieldSchema);
    const value = formData[fieldName];

    if (type === 'enum') {
      return (
        <Select value={value || ''} onValueChange={val => handleInputChange(fieldName, val, type)} required={required}>
          <SelectTrigger id={fieldName}>
            <SelectValue placeholder={`Select ${fieldName.replace(/_/g, ' ')}`} />
          </SelectTrigger>
          <SelectContent>
            {(fieldSchema.enum || []).map(option => <SelectItem key={option} value={option}>{option}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    if (type === 'boolean') {
      return (
        <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2">
          <Switch id={fieldName} checked={!!value} onCheckedChange={checked => handleInputChange(fieldName, checked, type)} />
          <span className="text-sm text-muted-foreground">{value ? 'Yes' : 'No'}</span>
        </div>
      );
    }

    if (type === 'reference') {
      const related = getReferenceName(fieldSchema);
      const options = recordsByEntity[related] || [];
      return (
        <Select value={value || ''} onValueChange={val => handleInputChange(fieldName, val, type)} required={required}>
          <SelectTrigger id={fieldName}>
            <SelectValue placeholder={`Select ${related || 'record'}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map(record => <SelectItem key={record.id} value={record.id}>{recordLabel(record)}</SelectItem>)}
          </SelectContent>
        </Select>
      );
    }

    return (
      <Input
        id={fieldName}
        value={value ?? ''}
        required={required}
        type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'datetime' ? 'datetime-local' : 'text'}
        onChange={e => handleInputChange(fieldName, e.target.value, type)}
        placeholder={fieldSchema.description || fieldName}
      />
    );
  };

  if (isLoading) return <div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <Database className="w-4 h-4 text-primary flex-shrink-0" />
        <h2 className="text-sm font-semibold text-foreground whitespace-nowrap">Live Preview</h2>
        <Badge variant="secondary" className="text-[10px]">{entities.length} entities</Badge>
        <Badge variant="outline" className="text-[10px]">{pages.length} pages</Badge>
        <Badge variant="outline" className="text-[10px]">{records.length} records</Badge>
        <Badge variant="outline" className="text-[10px] whitespace-nowrap">Brand CSS</Badge>
        <div className="flex-1 min-w-4" />
        <div className="flex rounded-md border border-border overflow-hidden">
          <button onClick={() => setPreviewMode('app')} className={`h-7 px-3 text-xs whitespace-nowrap ${previewMode === 'app' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>App Preview</button>
          <button onClick={() => setPreviewMode('data')} className={`h-7 px-3 text-xs whitespace-nowrap border-l border-border ${previewMode === 'data' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:text-foreground'}`}>Data Records</button>
        </div>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => generateUiPreview.mutate()} disabled={generateUiPreview.isPending}><Sparkles className="w-3.5 h-3.5" /> {generateUiPreview.isPending ? 'Generating...' : 'Generate UI Preview'}</Button>
        {previewMode === 'app' && <Button size="sm" variant={showBrandPanel ? 'default' : 'outline'} className="h-7 text-xs gap-1.5" onClick={() => setShowBrandPanel(v => !v)}>Brand Style</Button>}
        {previewMode === 'app' && <Button size="sm" variant={designMode ? 'default' : 'outline'} className="h-7 text-xs gap-1.5" onClick={() => setDesignMode(v => !v)}><MousePointerClick className="w-3.5 h-3.5" /> {designMode ? 'Design On' : 'Design Mode'}</Button>}
        {previewMode === 'data' && <Button size="sm" variant={visualEdit ? 'default' : 'outline'} className="h-7 text-xs gap-1.5" onClick={() => setVisualEdit(v => !v)}><MousePointerClick className="w-3.5 h-3.5" /> {visualEdit ? 'Editing On' : 'Visual Edit'}</Button>}
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={refreshAll}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
        {records.length > 0 && <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-destructive" onClick={() => resetPreviewData.mutate()} disabled={resetPreviewData.isPending}><RotateCcw className="w-3.5 h-3.5" /> Reset Preview Data</Button>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {previewMode === 'app' && showBrandPanel && <BrandStylePanel design={brandStyle} onChange={setBrandStyle} onSave={() => saveBrandStyle.mutate()} saving={saveBrandStyle.isPending} />}
        {previewMode === 'app' ? <AppPreviewCanvas pages={pages} entities={entities} designMode={designMode} designSystem={brandStyle} /> : entities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-xl bg-card/40">
            <Database className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-foreground text-sm mb-1">No entities yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm">Create entities in the Data Model section, then come back here to test them as a mini application.</p>
          </div>
        ) : entities.map(entity => {
          const { properties, required } = normalizeSchema(entity);
          const fieldNames = Object.keys(properties);
          const entityRecords = recordsByEntity[entity.name] || [];
          return (
            <Card key={entity.id} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-4 bg-muted/30 py-4">
                <button
                  type="button"
                  onClick={() => openVisualEditor({ type: 'entity', entity })}
                  className={`min-w-0 text-left rounded-md transition-colors ${visualEdit ? 'ring-1 ring-primary/30 bg-primary/5 px-2 py-1 hover:bg-primary/10 cursor-pointer' : 'cursor-default'}`}
                >
                  <CardTitle className="text-base truncate">{entity.display_name || entity.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{entity.description || `${fieldNames.length} fields · ${entityRecords.length} preview records`}</p>
                </button>
                <Button size="sm" className="gap-1.5 flex-shrink-0" onClick={() => openCreateDialog(entity)}><Plus className="w-3.5 h-3.5" /> Add Record</Button>
              </CardHeader>
              <CardContent className="p-0">
                {entityRecords.length === 0 ? <div className="p-8 text-center text-xs text-muted-foreground">No records yet. Add a record to test this entity.</div> : (
                  <div className="overflow-x-auto"><Table><TableHeader><TableRow>{fieldNames.map(name => <TableHead key={name}><button type="button" onClick={() => openVisualEditor({ type: 'field', entity, fieldName: name, fieldSchema: properties[name] })} className={`rounded px-1 py-0.5 text-left ${visualEdit ? 'ring-1 ring-primary/30 bg-primary/5 hover:bg-primary/10 cursor-pointer' : 'cursor-default'}`}>{name}{required.includes(name) && <span className="text-destructive ml-1">*</span>}</button></TableHead>)}<TableHead className="w-24 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{entityRecords.map(record => <TableRow key={record.id}>{fieldNames.map(name => <TableCell key={name} className="text-sm">{displayValue(record.record_data?.[name], properties[name], records)}</TableCell>)}<TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(entity, record)}><Pencil className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRecord.mutate(record.id)}><Trash2 className="w-3.5 h-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingRecord ? 'Edit' : 'Add'} {selectedEntity?.display_name || selectedEntity?.name} Record</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            {selectedEntity && Object.entries(normalizeSchema(selectedEntity).properties).map(([fieldName, fieldSchema]) => <div key={fieldName} className="space-y-1.5"><Label htmlFor={fieldName} className="text-xs capitalize">{fieldName.replace(/_/g, ' ')}{normalizeSchema(selectedEntity).required.includes(fieldName) && <span className="text-destructive ml-1">*</span>}</Label>{renderField(fieldName, fieldSchema, normalizeSchema(selectedEntity).required.includes(fieldName))}</div>)}
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveRecord} disabled={createRecord.isPending || updateRecord.isPending}>{createRecord.isPending || updateRecord.isPending ? 'Saving...' : 'Save Record'}</Button></div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={open => !open && setEditTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit preview element</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Label</Label>
              <Input value={editDraft.label} onChange={e => setEditDraft(d => ({ ...d, label: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input value={editDraft.description} onChange={e => setEditDraft(d => ({ ...d, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={() => updatePreviewElement.mutate({ target: editTarget, draft: editDraft })} disabled={!editDraft.label || updatePreviewElement.isPending}>{updatePreviewElement.isPending ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}