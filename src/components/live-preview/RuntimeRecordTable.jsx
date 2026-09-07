import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function RuntimeRecordTable({ entity, records, onEdit, onDelete, busy }) {
  const [search, setSearch] = useState('');
  const [detail, setDetail] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const [error, setError] = useState('');
  const fields = Object.keys(entity.schema?.properties || {});
  const filtered = records.filter(record => JSON.stringify(record.record_data).toLowerCase().includes(search.toLowerCase()));
  const display = value => value == null || value === '' ? '—' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  const remove = async () => { setError(''); try { await onDelete(pendingDelete.id); setPendingDelete(null); } catch (error) { setError(error.message); } };
  return <div className="space-y-3">
    <Input aria-label={`Search ${entity.name}`} placeholder={`Search ${entity.display_name || entity.name}…`} value={search} onChange={event => setSearch(event.target.value)} />
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-muted/40"><tr>{fields.map(field => <th key={field} className="p-3 text-left capitalize whitespace-nowrap">{field.replace(/_/g, ' ')}</th>)}<th className="p-3 text-right">Actions</th></tr></thead><tbody>{filtered.map(record => <tr key={record.id} className="border-t">{fields.map(field => <td key={field} className="p-3 max-w-48 truncate">{display(record.record_data?.[field])}</td>)}<td className="p-2"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => setDetail(record)}>View</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => onEdit(entity, record)}>Edit</Button><Button size="sm" variant="ghost" disabled={busy} className="text-destructive" onClick={() => setPendingDelete(record)}>Delete</Button></div></td></tr>)}</tbody></table>{!filtered.length && <p className="p-6 text-center text-sm opacity-60">{records.length ? 'No matching records.' : 'No records yet. Add your first record.'}</p>}</div>
    <Dialog open={!!detail} onOpenChange={open => !open && setDetail(null)}><DialogContent className="max-h-[80vh] overflow-auto"><DialogHeader><DialogTitle>{entity.display_name || entity.name} details</DialogTitle></DialogHeader><dl className="space-y-3">{Object.entries(detail?.record_data || {}).map(([field, value]) => <div key={field}><dt className="text-xs text-muted-foreground capitalize">{field.replace(/_/g, ' ')}</dt><dd className="text-sm whitespace-pre-wrap break-words">{display(value)}</dd></div>)}</dl></DialogContent></Dialog>
    <Dialog open={!!pendingDelete} onOpenChange={open => !busy && !open && setPendingDelete(null)}><DialogContent><DialogHeader><DialogTitle>Delete this record?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">This removes the saved preview record and cannot be undone.</p>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setPendingDelete(null)}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? 'Deleting…' : 'Delete'}</Button></div></DialogContent></Dialog>
  </div>;
}