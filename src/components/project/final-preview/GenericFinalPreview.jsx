import React, { useState } from 'react';

export default function GenericFinalPreview({ project, publishState }) {
  const pages = Object.keys(publishState?.code?.['🎨 src'] || {}).filter(f => f.startsWith('pages/')).map(f => f.replace('pages/', '').replace('.jsx', ''));
  const [active, setActive] = useState(pages[0] || 'Dashboard');
  const [rows, setRows] = useState([{ id: 1, name: 'Sample record', status: 'Active' }]);
  const addRow = () => setRows(r => [...r, { id: Date.now(), name: `New record ${r.length + 1}`, status: 'Draft' }]);
  return <div className="bg-slate-100 min-h-[620px] flex">
    <aside className="w-56 bg-slate-950 text-white p-4"><h3 className="font-bold mb-4 truncate">{project.name}</h3><nav className="space-y-1">{pages.map(page => <button key={page} onClick={() => setActive(page)} className={`w-full text-left px-3 py-2 rounded-lg text-sm ${active === page ? 'bg-blue-600' : 'hover:bg-white/10'}`}>{page}</button>)}</nav></aside>
    <main className="flex-1 p-6"><h1 className="text-2xl font-bold text-slate-900 mb-1">{active}</h1><p className="text-sm text-slate-500 mb-6">Interactive generated app preview</p><div className="bg-white rounded-2xl border border-slate-200 overflow-hidden"><div className="p-4 border-b flex justify-between"><b className="text-sm">Records</b><button onClick={addRow} className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-xs">+ Add Record</button></div>{rows.map(row => <div key={row.id} className="flex items-center gap-3 p-4 border-b last:border-0"><span className="flex-1 text-sm">{row.name}</span><span className="text-xs bg-slate-100 px-2 py-1 rounded">{row.status}</span><button onClick={() => setRows(r => r.map(item => item.id === row.id ? { ...item, status: item.status === 'Active' ? 'Draft' : 'Active' } : item))} className="text-xs text-blue-600">Edit</button><button onClick={() => setRows(r => r.filter(item => item.id !== row.id))} className="text-xs text-red-500">Delete</button></div>)}</div></main>
  </div>;
}