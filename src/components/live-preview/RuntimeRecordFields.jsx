import React from 'react';
import { Input } from '@/components/ui/input';

export default function RuntimeRecordFields({ entity, value, onChange, records }) {
  const fields = entity.schema?.properties || {};
  return <div className="space-y-3">{Object.entries(fields).map(([name, field]) => {
    const required = (entity.schema?.required || []).includes(name);
    const id = `runtime-${entity.id}-${name}`;
    const set = next => onChange({ ...value, [name]: next });
    const reference = field.reference || field.foreign_key;
    const options = reference ? records.filter(record => record.entity_name === String(reference).replace(/_id$/, '')) : [];
    let control;
    if (field.type === 'boolean') control = <input id={id} type="checkbox" checked={!!value[name]} onChange={event => set(event.target.checked)} className="h-4 w-4" />;
    else if (field.enum?.length || reference) control = <select id={id} required={required} value={value[name] ?? ''} onChange={event => set(event.target.value)} className="w-full rounded-md border bg-background text-foreground p-2"><option value="">Select…</option>{reference ? options.map(record => <option key={record.id} value={record.id}>{String(Object.values(record.record_data || {}).find(v => typeof v === 'string') || record.id)}</option>) : field.enum.map(option => <option key={option} value={option}>{option}</option>)}</select>;
    else if (['object', 'array'].includes(field.type)) control = <textarea id={id} required={required} value={typeof value[name] === 'string' ? value[name] : JSON.stringify(value[name] ?? (field.type === 'array' ? [] : {}))} onChange={event => set(event.target.value)} className="w-full rounded-md border bg-background text-foreground p-2" placeholder="JSON" />;
    else control = <Input id={id} required={required} type={['number', 'integer'].includes(field.type) ? 'number' : field.format === 'date' || field.type === 'date' ? 'date' : ['datetime', 'date-time'].includes(field.type) || field.format === 'date-time' ? 'datetime-local' : 'text'} step={field.type === 'integer' ? 1 : 'any'} value={value[name] ?? ''} onChange={event => set(['number', 'integer'].includes(field.type) && event.target.value !== '' ? Number(event.target.value) : event.target.value)} />;
    return <div key={name}><label htmlFor={id} className="block text-xs font-medium mb-1 capitalize">{name.replace(/_/g, ' ')}{required && ' *'}</label>{control}{field.description && <p className="text-xs opacity-60 mt-1">{field.description}</p>}</div>;
  })}</div>;
}