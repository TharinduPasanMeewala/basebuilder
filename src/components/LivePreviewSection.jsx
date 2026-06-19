import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, RefreshCw, Trash2, Pencil, Database, RotateCcw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const FIELD_TYPES = ['string', 'text', 'number', 'integer', 'boolean', 'date', 'datetime', 'enum', 'reference'];

function normalizeSchema(entity) {
  const schema = entity.schema || {};
  return {
    properties: schema.properties || {},
    required: Array.isArray(schema.required) ? schema.required : [],
  };
}

function getFieldType(field = {}) {
  if (field.enum) return 'enum';
  if (field.type === 'integer') return 'number';
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

  const entityDefinitions = entitiesQuery.data || [];
  const dataEntities = dataEntitiesQuery.data || [];
  const entities = useMemo(() => {
    if (entityDefinitions.length > 0) return entityDefinitions;
    return dataEntities.map(entity => ({
      id: entity.id,
      name: entity.name,
      display_name: entity.name,
      description: entity.description,
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
  const isLoading = entitiesQuery.isLoading || dataEntitiesQuery.isLoading || recordsQuery.isLoading;

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

  const refreshAll = () => { invalidateEntities(); invalidateRecords(); };

  const renderField = (fieldName, fieldSchema, required) => {
    const type = getFieldType(fieldSchema);
    const common = { id: fieldName, value: formData[fieldName] ?? '', required };

    if (type === 'enum') {
      return <select {...common} onChange={e => handleInputChange(fieldName, e.target.value, type)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"><option value="">Select...</option>{(fieldSchema.enum || []).map(v => <option key={v} value={v}>{v}</option>)}</select>;
    }
    if (type === 'boolean') {
      return <select {...common} value={String(formData[fieldName] ?? '')} onChange={e => handleInputChange(fieldName, e.target.value === 'true', type)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"><option value="">Select...</option><option value="true">Yes</option><option value="false">No</option></select>;
    }
    if (type === 'reference') {
      const related = getReferenceName(fieldSchema);
      const options = recordsByEntity[related] || [];
      return <select {...common} onChange={e => handleInputChange(fieldName, e.target.value, type)} className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"><option value="">Select {related || 'record'}...</option>{options.map(r => <option key={r.id} value={r.id}>{recordLabel(r)}</option>)}</select>;
    }
    return <Input {...common} type={type === 'number' ? 'number' : type === 'date' ? 'date' : type === 'datetime' ? 'datetime-local' : 'text'} onChange={e => handleInputChange(fieldName, e.target.value, type)} placeholder={fieldSchema.description || fieldName} />;
  };

  if (isLoading) return <div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <Database className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Live Data Preview</h2>
        <Badge variant="secondary" className="text-[10px]">{entities.length} entities</Badge>
        <Badge variant="outline" className="text-[10px]">{records.length} records</Badge>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={refreshAll}><RefreshCw className="w-3.5 h-3.5" /> Refresh</Button>
        {records.length > 0 && <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-destructive" onClick={() => resetPreviewData.mutate()} disabled={resetPreviewData.isPending}><RotateCcw className="w-3.5 h-3.5" /> Reset Preview Data</Button>}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {entities.length === 0 ? (
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
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{entity.display_name || entity.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">{entity.description || `${fieldNames.length} fields · ${entityRecords.length} preview records`}</p>
                </div>
                <Button size="sm" className="gap-1.5 flex-shrink-0" onClick={() => openCreateDialog(entity)}><Plus className="w-3.5 h-3.5" /> Add Record</Button>
              </CardHeader>
              <CardContent className="p-0">
                {entityRecords.length === 0 ? <div className="p-8 text-center text-xs text-muted-foreground">No records yet. Add a record to test this entity.</div> : (
                  <div className="overflow-x-auto"><Table><TableHeader><TableRow>{fieldNames.map(name => <TableHead key={name}>{name}{required.includes(name) && <span className="text-destructive ml-1">*</span>}</TableHead>)}<TableHead className="w-24 text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{entityRecords.map(record => <TableRow key={record.id}>{fieldNames.map(name => <TableCell key={name} className="text-sm">{displayValue(record.record_data?.[name], properties[name], records)}</TableCell>)}<TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEditDialog(entity, record)}><Pencil className="w-3.5 h-3.5" /></Button><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => deleteRecord.mutate(record.id)}><Trash2 className="w-3.5 h-3.5" /></Button></TableCell></TableRow>)}</TableBody></Table></div>
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
            {selectedEntity && Object.entries(normalizeSchema(selectedEntity).properties).map(([fieldName, fieldSchema]) => <div key={fieldName} className="space-y-1.5"><Label htmlFor={fieldName} className="text-xs">{fieldName}{normalizeSchema(selectedEntity).required.includes(fieldName) && <span className="text-destructive ml-1">*</span>}</Label>{renderField(fieldName, fieldSchema, normalizeSchema(selectedEntity).required.includes(fieldName))}</div>)}
          </div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button><Button onClick={handleSaveRecord} disabled={createRecord.isPending || updateRecord.isPending}>{createRecord.isPending || updateRecord.isPending ? 'Saving...' : 'Save Record'}</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}