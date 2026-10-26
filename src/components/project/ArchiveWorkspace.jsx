import React, { useEffect, useRef, useState } from 'react';
import { FileCode, Save, Download, Loader2, Search, Plus, RotateCcw, Trash2, Sparkles, Database, Server, Package, Globe, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { archiveCall, downloadArchiveBlob, standaloneArchive, saveDownload, applySourceEdits, inspectDatabaseFile, uploadDatabaseArchives } from '@/lib/sourceArchives';
import DatabaseBackups from '@/components/project/DatabaseBackups';
import { isTextPath, safeArchivePath, excludedSourcePath } from '@/lib/standaloneConversion';
import { normalizeDomain } from '@/lib/hosting';
import { invokeCodeAI } from '@/lib/codeAI';
import useUnsavedChanges from '@/hooks/useUnsavedChanges';

export default function ArchiveWorkspace({ project, mode = 'editor' }) {
  const [archive,setArchive] = useState(null), [selected,setSelected] = useState(''), [draft,setDraft] = useState(''), [saved,setSaved] = useState(''), [hash,setHash] = useState('');
  const [filter,setFilter] = useState(''), [newPath,setNewPath] = useState(''), [request,setRequest] = useState(''), [target,setTarget] = useState('local'), [domain,setDomain] = useState('');
  const [busy,setBusy] = useState('load'), [error,setError] = useState(''), [notice,setNotice] = useState(''), [newFile,setNewFile] = useState(false);
  const [conflictPolicy,setConflictPolicy]=useState('error');
  const sequence = useRef(0), dirty = newFile || draft !== saved;
  useUnsavedChanges(dirty);
  const refresh = async () => {
    const data = await archiveCall('list',{project_id:project.id});setArchive(data);return data;
  };
  useEffect(() => {
    let active=true;
    archiveCall('list',{project_id:project.id}).then(data=>{if(active)setArchive(data);}).catch(error=>active&&setError(error.message)).finally(()=>active&&setBusy(''));
    return()=>{active=false;sequence.current++;};
  },[project.id]);
  const choose = async path => {
    if(dirty&&!window.confirm('Discard unsaved edits before opening another file?'))return;
    const ticket=++sequence.current;
    setSelected(path);setDraft('');setSaved('');setHash('');setNewFile(false);setError('');setNotice('');
    if(!isTextPath(path))return;
    setBusy('read');
    try {const data=await archiveCall('read',{project_id:project.id,path});if(ticket!==sequence.current)return;setDraft(data.content);setSaved(data.content);setHash(data.sha256);}
    catch(error){if(ticket===sequence.current)setError(error.message);}
    finally{if(ticket===sequence.current)setBusy('');}
  };
  const save = async () => {
    if(!selected||!dirty||busy)return;
    setBusy('save');setError('');setNotice('');
    try {
      if(selected.endsWith('.json')){try{JSON.parse(draft);}catch{throw new Error('Fix the JSON syntax before saving this file.');}}
      const result=await archiveCall('save',{project_id:project.id,path:selected,content:draft,base_hash:hash});
      setHash(result.sha256);setSaved(draft);setNewFile(false);await refresh();setNotice('Source file saved. Downloads include this exact version.');
    }catch(error){setError(error.message);}finally{setBusy('');}
  };
  const add = event => {
    event.preventDefault();const path=newPath.trim();
    if(!safeArchivePath(path)||excludedSourcePath(path)||!isTextPath(path)||archive?.files.some(file=>file.path===path)){setError('Enter a unique, safe text-source path such as src/components/NewPanel.jsx.');return;}
    if(dirty&&!window.confirm('Discard unsaved edits before adding a file?'))return;
    setSelected(path);setDraft('');setSaved('');setHash('');setNewFile(true);setNewPath('');setError('');setNotice('');
  };
  const remove = async () => {
    if(!window.confirm('Remove this file from future exports? The original archive remains preserved.'))return;
    setBusy('delete');setError('');
    try {await archiveCall('delete',{project_id:project.id,path:selected,base_hash:hash});setSelected('');setDraft('');setSaved('');setHash('');setNewFile(false);await refresh();setNotice('File removed from the exported project.');}
    catch(error){setError(error.message);}finally{setBusy('');}
  };
  const restore = async () => {
    if(!window.confirm('Restore the original archived version of this file? Saved edits for this file will be replaced.'))return;
    setBusy('restore');setError('');
    try {
      await archiveCall('restore',{project_id:project.id,path:selected});
      const data=await archiveCall('read',{project_id:project.id,path:selected});setDraft(data.content);setSaved(data.content);setHash(data.sha256);setNewFile(false);await refresh();setNotice('Original source restored.');
    }catch(error){setError(error.message);}finally{setBusy('');}
  };
  const ai = async () => {
    if(!request.trim()||!selected)return;
    if(draft.length>120000){setError('This file is too large for one AI edit. Edit it directly or split the module into smaller files first.');return;}
    setBusy('ai');setError('');setNotice('');
    try {
      const result=await invokeCodeAI({
        prompt:'Edit the selected source file in an imported application. Preserve working functionality, imports and APIs. Modify this file only. Return exact, minimal old_text to new_text replacements. Each old_text must match a unique location unless replace_all is true. Do not invent completed changes outside this file.\nProject: '+project.name+'\nSelected file: '+selected+'\nOther paths:\n'+archive.files.slice(0,160).map(file=>file.path).join('\n')+'\nRequest: '+request+'\nComplete selected source:\n'+draft,
        response_json_schema:{type:'object',properties:{summary:{type:'string'},edits:{type:'array',items:{type:'object',properties:{old_text:{type:'string'},new_text:{type:'string'},replace_all:{type:'boolean'}},required:['old_text','new_text']}}},required:['summary','edits']},
      });
      const next=applySourceEdits(draft,result.edits);setDraft(next);setNotice((result.summary||'AI edits prepared.')+' Review the draft, then Save file to include it in exports.');
    }catch(error){setError(error.message);}finally{setBusy('');}
  };
  const download = async standalone => {
    setBusy('export');setError('');setNotice('');
    const slug=(project.name||'app').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'app';
    try {
      if(standalone){
        const hostname=target==='domain'?normalizeDomain(domain):'';
        if(target==='domain'&&!hostname)throw new Error('Enter the domain you want to use.');
        const result=await standaloneArchive(project,hostname,message=>setNotice(message),{conflictPolicy});
        saveDownload(result.blob,slug+'-standalone.zip');
        setNotice('Standalone package prepared: '+result.report.entity_schemas+' schemas, '+result.report.backend_functions+' functions'+(result.report.database_backups?.length?', '+result.report.database_backups.length+' database ZIP(s)':'')+', and an independent Node.js + SQLite runtime. Follow STANDALONE.md and run npm run db:restore for included database backups.');
      }else{saveDownload(await downloadArchiveBlob(project.id),slug+'-source.zip');setNotice('Complete saved source ZIP downloaded, including binary assets.');}
    }catch(error){setError(error.message);}finally{setBusy('');}
  };
  const attachBackups=async files=>{
    if(!files.length)return;setBusy('backup');setError('');setNotice('Inspecting database ZIPs…');
    try{if((archive?.backups?.length||0)+files.length>7)throw new Error('Attach up to 7 database ZIPs per project.');const backups=[];for(const file of files)backups.push(await inspectDatabaseFile(file));await uploadDatabaseArchives(backups,project,message=>setNotice(message));await refresh();setNotice('Database ZIPs attached. Standalone downloads include these backups and the restore command.');}
    catch(error){setError(error.message);await refresh().catch(()=>{});}finally{setBusy('');}
  };
  const removeBackup=async backup=>{
    if(!window.confirm('Remove '+backup.filename+' from future standalone exports?'))return;setBusy('backup');setError('');
    try{await archiveCall('remove_backup',{project_id:project.id,backup_id:backup.id});await refresh();setNotice('Database backup removed from future exports.');}catch(error){setError(error.message);}finally{setBusy('');}
  };
  const keydown=event=>{
    if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();save();}
    if(event.key==='Tab'){event.preventDefault();const start=event.currentTarget.selectionStart,end=event.currentTarget.selectionEnd,input=event.currentTarget;setDraft(draft.slice(0,start)+'  '+draft.slice(end));requestAnimationFrame(()=>input.setSelectionRange(start+2,start+2));}
  };
  const file=archive?.files.find(file=>file.path===selected);
  if(busy==='load')return <div className="p-8 flex gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading complete source archive…</div>;
  return <div className="flex flex-col flex-1 min-w-0 min-h-0 h-full overflow-hidden">
    <div className="flex flex-wrap items-center gap-2 p-3 border-b border-border bg-card">
      <Package className="w-4 h-4 text-primary" /><h2 className="text-sm font-semibold">{mode==='hosting'?'Standalone app export':'Imported source workspace'}</h2>
      <span className="text-xs text-muted-foreground">{archive?.files.length||0} files · {archive?.summary?.pages||0} pages · {archive?.summary?.schemas||0} schemas · {archive?.summary?.functions||0} functions</span>
      <div className="flex-1" /><Button size="sm" variant="outline" disabled={!!busy||dirty||!archive} onClick={()=>download(false)} className="gap-1.5"><Download className="w-3.5 h-3.5" />Source ZIP</Button>
      <Button size="sm" disabled={!!busy||dirty||!archive||!archive.summary.base44||archive.summary.framework!=='React + Vite'} onClick={()=>download(true)} className="gap-1.5">{busy==='export'?<Loader2 className="w-3.5 h-3.5 animate-spin" />:<Server className="w-3.5 h-3.5" />}Standalone ZIP</Button>
    </div>
    <div className="px-4 py-3 border-b border-border bg-muted/20 flex flex-wrap gap-3 items-center text-xs">
      <label className="flex gap-2 items-center"><Monitor className="w-3.5 h-3.5 text-primary" />Export target<select aria-label="Standalone export target" className="border border-border rounded-lg bg-background p-2" value={target} onChange={event=>setTarget(event.target.value)} disabled={!!busy}><option value="local">Localhost</option><option value="domain">Custom domain</option></select></label>
      {target==='domain'&&<label className="flex gap-2 items-center"><Globe className="w-3.5 h-3.5 text-primary" /><Input aria-label="Standalone custom domain" placeholder="app.yourcompany.com" value={domain} onChange={event=>setDomain(event.target.value)} disabled={!!busy} className="h-8 w-56 text-xs" /></label>}
      <span className="text-muted-foreground">Original code and assets stay intact. Saved edits are applied to exports.</span>
    </div>
    {error&&<p role="alert" className="p-3 text-sm text-destructive border-b border-border">{error}{!archive&&<Button size="sm" variant="outline" className="ml-3" onClick={()=>refresh().catch(error=>setError(error.message))}>Retry</Button>}</p>}
    {notice&&<p role="status" className="p-3 text-xs text-primary border-b border-border">{notice}</p>}
    <DatabaseBackups backups={archive?.backups||[]} disabled={!!busy||dirty||!archive} onAdd={attachBackups} onRemove={removeBackup} conflictPolicy={conflictPolicy} onPolicy={setConflictPolicy} />
    {mode==='hosting'?<div className="flex-1 overflow-auto p-6 space-y-5">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6"><div className="flex items-center gap-2 text-primary"><Database className="w-5 h-5" /><h3 className="font-semibold">An independent application backend</h3></div><p className="text-sm text-muted-foreground mt-3 leading-relaxed">For Base44 React/Vite projects, the standalone exporter keeps existing pages, models and backend functions, replaces the platform SDK with a local compatibility layer, and adds Node.js, persistent SQLite, local accounts, file storage, AI-provider adapters and a realtime-room server.</p></div>
      <div className="grid md:grid-cols-2 gap-4"><div className="rounded-xl border border-border p-5"><h3 className="font-semibold text-sm mb-3">Run on localhost</h3><pre className="text-xs bg-slate-950 text-slate-100 p-4 rounded-lg overflow-auto">{'npm install\n# Copy .env.example to .env and set admin credentials\nnpm run build\nnpm start'}</pre><p className="text-xs text-muted-foreground mt-3">Open http://localhost:3000. The database and uploaded files live in the app’s data directory.</p></div><div className="rounded-xl border border-border p-5"><h3 className="font-semibold text-sm mb-3">Host on your domain</h3><pre className="text-xs bg-slate-950 text-slate-100 p-4 rounded-lg overflow-auto">{'docker compose --profile domain up --build -d'}</pre><p className="text-xs text-muted-foreground mt-3">Point DNS to your server, configure PUBLIC_URL and the Caddy hostname, then open ports 80 and 443. Docker volumes preserve the database, uploads and HTTPS certificates.</p></div></div>
      <div className="rounded-xl border border-border p-5 text-sm text-muted-foreground leading-relaxed"><h3 className="font-semibold text-foreground mb-2">Restore attached database ZIPs</h3>Choose Add database ZIPs above, then download the standalone package. After npm install, stop the app server and run <code>npm run db:restore</code> to import every included backup. Identical records are deduplicated; conflicting records stop the whole import unless you explicitly choose newest-record resolution. Existing account passwords, OAuth authorization and binary uploads are separate. Review the restore report and configure integrations before deployment.</div>
    </div>:<div className="flex flex-col md:flex-row flex-1 min-h-0">
      <aside className="w-full md:w-64 flex flex-col max-h-48 md:max-h-none border-b md:border-b-0 md:border-r border-border bg-card shrink-0">
        <div className="p-3 relative"><Search className="w-3.5 h-3.5 absolute left-5 top-6 text-muted-foreground" /><Input aria-label="Find imported source file" placeholder="Find a file…" value={filter} onChange={event=>setFilter(event.target.value)} className="h-9 text-xs pl-7" /></div>
        <div className="flex-1 overflow-y-auto px-2 pb-2">{(archive?.files||[]).filter(file=>file.path.toLowerCase().includes(filter.toLowerCase())).map(file=><button key={file.path} disabled={!!busy} onClick={()=>choose(file.path)} title={file.path} className={'block w-full rounded-md px-3 py-1.5 text-left text-[11px] font-mono break-all disabled:opacity-50 '+(file.path===selected?'bg-primary/10 text-primary font-semibold':'text-muted-foreground hover:bg-muted')}>{file.path}{file.modified?' •':''}</button>)}</div>
        <form className="p-3 border-t border-border flex gap-1" onSubmit={add}><Input aria-label="New imported source file" placeholder="src/NewFile.jsx" value={newPath} onChange={event=>setNewPath(event.target.value)} className="h-8 text-xs" disabled={!!busy} /><Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0" disabled={!!busy} aria-label="Add source file"><Plus className="w-3.5 h-3.5" /></Button></form>
      </aside>
      <div className="flex flex-col flex-1 min-w-0 min-h-0">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border text-xs"><FileCode className="w-3.5 h-3.5 text-primary" /><span className="font-mono flex-1 break-all">{selected||'Select a source file'}</span>{selected&&isTextPath(selected)&&<><span role="status" className={dirty?'text-amber-600':'text-muted-foreground'}>{dirty?'Unsaved draft':'Saved'}</span><Button size="sm" variant="outline" disabled={!!busy||!file?.modified||dirty} onClick={restore} title="Restore original file"><RotateCcw className="w-3 h-3" /></Button><Button size="sm" variant="outline" disabled={!!busy||dirty||newFile} onClick={remove} title="Remove file from exports"><Trash2 className="w-3 h-3" /></Button><Button size="sm" disabled={!!busy||!dirty} onClick={save} className="gap-1.5">{busy==='save'?<Loader2 className="w-3 h-3 animate-spin" />:<Save className="w-3 h-3" />}Save file</Button></>}</div>
        {!selected?<div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">Select an existing source file to modify it. Backend functions, schemas and assets are preserved alongside the frontend.</div>
        :!isTextPath(selected)?<div className="p-8 text-sm text-muted-foreground">This binary asset is preserved in source and standalone ZIP downloads. Text editing is available for source files.</div>
        :<textarea aria-label={'Imported source code for '+selected} value={draft} onChange={event=>{setDraft(event.target.value);setNotice('');}} onKeyDown={keydown} disabled={!!busy} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off" className="flex-1 min-h-[320px] w-full resize-none bg-slate-950 text-slate-100 p-5 font-mono text-xs leading-6 outline-none focus:ring-2 focus:ring-inset focus:ring-primary/50" style={{tabSize:2}} />}
        <div className="border-t border-border bg-card p-3 space-y-2"><label className="text-xs font-semibold flex gap-1.5 items-center"><Sparkles className="w-3.5 h-3.5 text-primary" />Modify this file with your selected AI model</label><div className="flex gap-2"><Input aria-label="Requested AI source change" placeholder="Describe the change to this file…" value={request} onChange={event=>setRequest(event.target.value)} disabled={!!busy||!selected||!isTextPath(selected)} className="text-xs" /><Button disabled={!!busy||!request.trim()||!selected||!isTextPath(selected)} onClick={ai} size="sm" className="shrink-0">{busy==='ai'?<Loader2 className="w-3.5 h-3.5 animate-spin" />:'Prepare edits'}</Button></div><p className="text-[11px] text-muted-foreground">AI changes stay in the draft until you save. Ctrl/Cmd+S saves this file. Save your draft before exporting.</p></div>
      </div>
    </div>}
  </div>;
}
