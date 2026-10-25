import ArchiveWorkspace from '@/components/project/ArchiveWorkspace';
import React, { useEffect, useRef, useState } from 'react';
import { Search, FileCode, Save, Plus, Loader2, RotateCcw, Package, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateCodeFiles } from '@/lib/codegen';
import { filesFromCode, codeFromFiles, safeSourcePath } from '@/lib/hosting';
import useUnsavedChanges from '@/hooks/useUnsavedChanges';

function GeneratedSourceEditor({ project }) {
  const [record, setRecord] = useState(null);
  const [files, setFiles] = useState([]);
  const [saved, setSaved] = useState('[]');
  const [selected, setSelected] = useState('');
  const [filter, setFilter] = useState('');
  const [newPath, setNewPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const area = useRef(null);
  const dirty = JSON.stringify(files) !== saved;
  useUnsavedChanges(dirty);
  useEffect(() => {
    let active = true;
    base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'publish_state' }, '-updated_date', 1)
      .then(items => {
        if (!active) return;
        setRecord(items[0] || null);
        const source = filesFromCode(items[0]?.snapshot?.code || {});
        setFiles(source); setSaved(JSON.stringify(source));
        setSelected(source.find(file => file.path === 'src/App.jsx')?.path || source[0]?.path || '');
      }).catch(err => active && setError(err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [project.id]);
  const createPackage = async () => {
    setBusy(true); setError('');
    try {
      const [entities, pages, designs, requirements] = await Promise.all([
        base44.entities.DataEntity.filter({ project_id: project.id }), base44.entities.PageSpec.filter({ project_id: project.id }),
        base44.entities.ProjectDesign.filter({ project_id: project.id }, '-updated_date', 1), base44.entities.Requirement.filter({ project_id: project.id }),
      ]);
      const source = generateCodeFiles(project, { entities, pages, design: designs[0] || {}, requirements });
      setFiles(source); setSelected('src/App.jsx');
      setNotice('Source package created from your project. Save to include it in downloads.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (busy || !dirty) return;
    setBusy(true); setError(''); setNotice('');
    try {
      for (const file of files) {
        if (!safeSourcePath(file.path)) throw new Error('Invalid file path: ' + file.path);
        if (file.path.endsWith('.json')) { try { JSON.parse(file.content); } catch { throw new Error('Fix invalid JSON in ' + file.path + ' before saving.'); } }
      }
      const latest = (await base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'publish_state' }, '-updated_date', 1))[0];
      if ((latest?.updated_date || '') !== (record?.updated_date || '')) throw new Error('The saved package changed in another session. Copy your edits before refreshing to load the latest version.');
      const snapshot = { ...(record?.snapshot || {}), code: codeFromFiles(files), source_updated_at: new Date().toISOString(), published_at: record?.snapshot?.published_at || new Date().toISOString(), status: 'generated' };
      const result = record?.id ? await base44.entities.ProjectVersion.update(record.id, { snapshot, notes: 'Source code edited in Studio' })
        : await base44.entities.ProjectVersion.create({ project_id: project.id, label: 'publish_state', version_number: 1, notes: 'Source code created in Studio', snapshot });
      setRecord(result); setSaved(JSON.stringify(files)); setNotice('Source saved. Deploy downloads include these edits. Run the package build before hosting.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const current = files.find(file => file.path === selected);
  const visible = files.filter(file => file.path.toLowerCase().includes(filter.toLowerCase()));
  const change = content => { setFiles(previous => previous.map(file => file.path === selected ? { ...file, content } : file)); setNotice(''); };
  const add = event => {
    event.preventDefault(); const path = newPath.trim();
    if (!safeSourcePath(path) || files.some(file => file.path === path)) { setError('Enter a unique relative file path without "..", for example src/components/Header.jsx.'); return; }
    setFiles(previous => [...previous, { path, content: '' }]); setSelected(path); setNewPath(''); setError('');
  };
  const keydown = event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); save(); }
    if (event.key === 'Tab' && current) {
      event.preventDefault(); const input = event.currentTarget, start = input.selectionStart, end = input.selectionEnd;
      change(current.content.slice(0, start) + '  ' + current.content.slice(end));
      requestAnimationFrame(() => input.setSelectionRange(start + 2, start + 2));
    }
  };
  if (loading) return <div className="p-8 flex gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading source files…</div>;
  return <div className="flex flex-col h-full min-h-0 bg-background">
    <div className="flex flex-wrap gap-2 items-center px-4 py-3 border-b border-border">
      <FileCode className="w-4 h-4 text-primary" /><h3 className="font-semibold text-sm">Source editor</h3><span role="status" className={'text-xs ' + (dirty ? 'text-amber-600' : 'text-muted-foreground')}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span><div className="flex-1" />
      <Button size="sm" variant="outline" disabled={busy || !dirty} className="gap-1.5" onClick={() => { if (window.confirm('Discard all unsaved source changes?')) { setFiles(JSON.parse(saved)); setNotice('Unsaved changes discarded.'); } }}><RotateCcw className="w-3.5 h-3.5" />Discard</Button>
      <Button size="sm" disabled={busy || !dirty} onClick={save} className="gap-1.5">{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}Save source</Button>
    </div>
    {error && <p role="alert" className="p-3 text-sm text-destructive border-b border-border">{error}</p>}
    {notice && <p role="status" className="p-3 text-xs text-emerald-700 border-b border-border flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" />{notice}</p>}
    {!files.length ? <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3"><Package className="w-10 h-10 text-primary" /><h3 className="font-semibold">Start with your project’s source</h3><p className="text-sm text-muted-foreground max-w-md">Create a runnable React package from the current data models, pages and brand style. Edit it here, then download it from Deploy.</p><Button onClick={createPackage} disabled={busy}>{busy ? 'Creating…' : 'Create source package'}</Button></div>
    : <div className="flex flex-col md:flex-row flex-1 min-h-0">
      <aside className="md:w-60 shrink-0 border-b md:border-b-0 md:border-r border-border bg-card flex flex-col max-h-48 md:max-h-none">
        <div className="p-3 relative"><Search className="w-3.5 h-3.5 absolute left-5 top-6 text-muted-foreground" /><Input aria-label="Find source file" value={filter} onChange={e => setFilter(e.target.value)} className="pl-7 h-9 text-xs" placeholder="Find a file…" /></div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">{visible.map(file => <button key={file.path} onClick={() => setSelected(file.path)} className={'block w-full text-left text-xs font-mono rounded-md px-3 py-2 break-all ' + (selected === file.path ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted')}>{file.path}{JSON.parse(saved).find(item => item.path === file.path)?.content !== file.content ? ' •' : ''}</button>)}</div>
        <form onSubmit={add} className="p-3 border-t border-border flex gap-1"><Input aria-label="New source file path" value={newPath} onChange={e => setNewPath(e.target.value)} placeholder="src/NewFile.jsx" className="text-xs h-8" /><Button type="submit" variant="outline" size="icon" className="h-8 w-8 shrink-0" aria-label="Add source file"><Plus className="w-3.5 h-3.5" /></Button></form>
      </aside>
      <div className="flex flex-col flex-1 min-w-0 min-h-[320px]">
        <div className="px-4 py-2 border-b border-border text-xs flex flex-wrap gap-2 font-mono"><span className="flex-1 break-all">{selected}</span><span className="text-muted-foreground">{current?.content.split('\n').length || 0} lines · Ctrl/Cmd+S</span></div>
        {current ? <textarea ref={area} aria-label={'Source code for ' + selected} value={current.content} onChange={e => change(e.target.value)} onKeyDown={keydown} disabled={busy} spellCheck={false} autoCapitalize="off" autoComplete="off" autoCorrect="off" className="flex-1 min-h-[360px] w-full resize-none bg-slate-950 text-slate-100 p-5 font-mono text-xs leading-6 outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50 whitespace-pre" style={{ tabSize: 2 }} wrap="off" /> : <p className="p-6 text-sm text-muted-foreground">Select a source file.</p>}
      </div>
    </div>}
  </div>;
}

export default function SourceEditor(props) { return props.project.source_mode === 'archive' ? <ArchiveWorkspace {...props} /> : <GeneratedSourceEditor {...props} />; }
