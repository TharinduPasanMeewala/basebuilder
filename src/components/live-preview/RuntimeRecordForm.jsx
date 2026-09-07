import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import RuntimeRecordFields from '@/components/live-preview/RuntimeRecordFields';

export default function RuntimeRecordForm({ entity, records, record, onSave, onCancel, buttonStyle, buttonLabel = 'Save record' }) {
  const initial = () => record?.record_data || Object.fromEntries(Object.entries(entity.schema?.properties || {}).filter(([, field]) => field.default !== undefined || ['array', 'object'].includes(field.type)).map(([name, field]) => [name, field.default ?? (field.type === 'array' ? [] : {})]));
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError(''); setSuccess(false);
    try {
      const result = { ...data };
      for (const [name, field] of Object.entries(entity.schema?.properties || {})) {
        if (field.type === 'boolean') result[name] = !!result[name];
        if (['object', 'array'].includes(field.type) && typeof result[name] === 'string') result[name] = JSON.parse(result[name]);
        if (result[name] != null && field.type === 'array' && !Array.isArray(result[name])) throw new Error(`${name} must be a JSON array.`);
        if (result[name] != null && field.type === 'object' && (typeof result[name] !== 'object' || Array.isArray(result[name]))) throw new Error(`${name} must be a JSON object.`);
        if (result[name] === '' && !(entity.schema?.required || []).includes(name)) delete result[name];
      }
      for (const name of entity.schema?.required || []) if (result[name] === undefined || result[name] === null || result[name] === '') throw new Error(`${name} is required.`);
      await onSave(entity, result, record);
      if (!record) setData(initial());
      setSuccess(true);
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  if (!Object.keys(entity.schema?.properties || {}).length) return <p className="text-sm opacity-60">Add fields to this data model before creating records.</p>;
  return <form onSubmit={submit} className="space-y-4">
    <fieldset disabled={busy}><RuntimeRecordFields entity={entity} value={data} records={records} onChange={next => { setData(next); setSuccess(false); }} /></fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {success && <p role="status" className="text-sm text-accent">Record saved.</p>}
    <div className="flex justify-end gap-2">{onCancel && <Button type="button" variant="outline" disabled={busy} onClick={onCancel}>Cancel</Button>}<Button type="submit" disabled={busy} style={buttonStyle}>{busy ? 'Saving…' : buttonLabel}</Button></div>
  </form>;
}