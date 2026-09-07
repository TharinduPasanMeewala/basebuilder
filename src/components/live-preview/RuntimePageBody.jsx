import React from 'react';
import { Button } from '@/components/ui/button';
import Designable from '@/components/live-preview/Designable';
import RuntimeRecordTable from '@/components/live-preview/RuntimeRecordTable';
import RuntimeRecordForm from '@/components/live-preview/RuntimeRecordForm';
import CalculatorFinalPreview from '@/components/project/final-preview/CalculatorFinalPreview';

export default function RuntimePageBody({ page, entities, records, binding, editProps, settings, onCreate, onEdit, onDelete, onSave, onNavigateEntity, busy, designSystem }) {
  const normalize = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').replace(/s$/, '');
  const sources = (page.components || []).map(component => component.data_source).filter(Boolean);
  const linked = binding ? entities.find(entity => entity.name === binding) : entities.find(entity => sources.some(source => normalize(source) === normalize(entity.name))) || entities.find(entity => normalize(page.name) === normalize(entity.name)) || entities.find(entity => entity.name && `${page.name} ${page.description || ''}`.toLowerCase().includes(entity.name.toLowerCase())) || (entities.length === 1 ? entities[0] : null);
  if (/calculator/i.test(`${page.name} ${page.description || ''}`)) return <Designable {...editProps('content', 'Calculator')}><CalculatorFinalPreview title={page.name} theme={{ page: designSystem.background_color, shell: designSystem.surface_color, text: designSystem.text_color, button: designSystem.primary_color }} /></Designable>;
  if (page.type === 'dashboard') return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{entities.map(entity => <Designable key={entity.id} {...editProps(`metric-${entity.id}`, `${entity.display_name || entity.name} card`)} className="border rounded-xl p-4" style={{ background: designSystem.surface_color }}><button type="button" onClick={() => onNavigateEntity(entity)} className="text-left w-full"><span className="block text-sm opacity-70">{entity.display_name || entity.name}</span><strong className="block text-3xl mt-2">{records.filter(record => record.entity_name === entity.name).length}</strong><span className="text-xs opacity-60">Open records</span></button></Designable>)}{!entities.length && <p className="text-sm opacity-60">No data models yet. Add a model in Data Model to start.</p>}</div>;
  if (!linked) return <div className="p-6 rounded-xl border border-dashed text-sm"><p>This screen has no connected data model.</p><p className="opacity-60 mt-2">In Edit mode, select the screen heading and choose Screen data. No records will be written until a model is connected.</p></div>;
  const rows = records.filter(record => record.entity_name === linked.name);
  const addSettings = settings(`${page.id}:add`);
  const buttonStyle = { background: addSettings.background || designSystem.primary_color, color: addSettings.color, fontSize: addSettings.fontSize, borderRadius: addSettings.radius };
  if (page.type === 'form' || page.type === 'settings') return <Designable {...editProps('content', 'Record form')} className="rounded-xl border p-4" style={{ background: designSystem.surface_color }}><RuntimeRecordForm key={`${page.id}-${linked.id}`} entity={linked} record={page.type === 'settings' ? rows[0] : undefined} records={records} onSave={onSave} buttonStyle={buttonStyle} /></Designable>;
  return <div className="space-y-4">
    <div className="flex items-center justify-between gap-2"><span className="text-xs opacity-60">{rows.length} saved preview records · {linked.display_name || linked.name}</span><Designable {...editProps('add', 'Add record button')}><Button style={buttonStyle} disabled={busy || !Object.keys(linked.schema?.properties || {}).length} onClick={() => onCreate(linked)}>{settings(`${page.id}:add`).text || `Add ${linked.display_name || linked.name}`}</Button></Designable></div>
    {!['list', 'detail'].includes(page.type) && <p className="text-xs opacity-60">{page.type} screen: connected records view. Specialized visualization is not generated yet.</p>}
    <Designable {...editProps('content', 'Records panel')} className="rounded-xl border p-4" style={{ background: designSystem.surface_color }}><RuntimeRecordTable key={`${page.id}-${linked.id}`} entity={linked} records={rows} onEdit={onEdit} onDelete={onDelete} busy={busy} /></Designable>
  </div>;
}