import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Package, Loader2, FileCode, Database, Server, ShieldCheck, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inspectImportFiles, uploadArchive, uploadDatabaseArchives } from '@/lib/sourceArchives';

export default function ImportArchiveDialog({ open, onClose }) {
  const navigate=useNavigate();
  const [selection,setSelection]=useState({source:null,backups:[]}),[name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[stage,setStage]=useState(''),[percent,setPercent]=useState(0),[created,setCreated]=useState(null);
  const source=selection.source;
  const close=()=>{setSelection({source:null,backups:[]});setName('');setError('');setStage('');setCreated(null);onClose();};
  const select=async files=>{
    if(!files?.length)return;setBusy(true);setError('');setStage('Recognizing app source and database ZIPs…');setPercent(0);
    try{const next=await inspectImportFiles(files,selection);setSelection(next);if(next.source&&!source)setName(next.source.originalName.replace(/\.zip$/i,'').replace(/[-_]/g,' '));setStage('ZIPs ready. Database row counts are verified during standalone restore.');}
    catch(error){setError(error.message);setStage('');}finally{setBusy(false);}
  };
  const create=async()=>{
    setBusy(true);setError('');const progress=(message,value)=>{setStage(message);setPercent(Math.min(100,value||0));};
    try{let project=created;if(!project){const result=await uploadArchive(source,name.trim(),progress);project={id:result.projectId,name:name.trim()};setCreated(project);}await uploadDatabaseArchives(selection.backups,project,progress);close();navigate('/projects/'+project.id+'?section=studio&mode=code');}
    catch(error){setError(error.message);}finally{setBusy(false);}
  };
  return <Dialog open={open} onOpenChange={value=>{if(!value&&!busy)close();}}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex gap-2 items-center"><Package className="w-5 h-5 text-primary" />Import app and database ZIPs</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Select one complete app source ZIP and its database backups together. You can also add database ZIPs to an imported project later.</p>
      <label className={'block border-2 border-dashed rounded-xl p-6 text-center '+(busy?'opacity-60':'cursor-pointer hover:border-primary')}>
        <Upload className="w-7 h-7 mx-auto text-primary mb-2" /><span className="text-sm font-semibold">Choose multiple ZIP files</span><span className="block text-xs text-muted-foreground mt-1">Up to 8 ZIPs · 32 MB each · 128 MB combined</span>
        <input aria-label="Application source and database ZIP files" type="file" multiple accept=".zip,application/zip" className="sr-only" disabled={busy} onChange={event=>{select(Array.from(event.target.files||[]));event.target.value='';}} />
      </label>
      {(source||selection.backups.length>0)&&<div className="space-y-3">
        {source&&<div className="flex items-center gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3"><FileCode className="w-5 h-5 text-primary shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-medium break-all">{source.originalName}</p><p className="text-xs text-muted-foreground">App source · {source.files.length} files · {source.analysis.framework}</p></div><Button size="icon" variant="ghost" aria-label="Remove selected app ZIP" disabled={busy||!!created} onClick={()=>setSelection({...selection,source:null})}><X className="w-4 h-4" /></Button></div>}
        {selection.backups.map((backup,index)=><div key={backup.originalName+index} className="flex items-center gap-3 rounded-xl border border-border p-3"><Database className="w-5 h-5 text-primary shrink-0" /><div className="flex-1 min-w-0"><p className="text-sm font-medium break-all">{backup.originalName}</p><p className="text-xs text-muted-foreground">Database · {backup.summary.table_count} tables · {backup.summary.record_count===null?'rows checked on restore':backup.summary.record_count.toLocaleString()+' declared rows'} · {(backup.summary.expanded_bytes/1024/1024).toFixed(1)} MB expanded</p>{backup.summary.note&&<p className="text-xs text-muted-foreground mt-1">{backup.summary.note}</p>}</div><Button size="icon" variant="ghost" aria-label={'Remove '+backup.originalName} disabled={busy} onClick={()=>setSelection({...selection,backups:selection.backups.filter((_,i)=>i!==index)})}><X className="w-4 h-4" /></Button></div>)}
        {!source&&<p className="text-sm text-amber-600">Add the app source ZIP to create a project. For a database-only upload, open an imported project and choose Add database ZIPs.</p>}
        {source&&<><div className="grid grid-cols-3 gap-3">{[{Icon:FileCode,label:'Pages',value:source.analysis.pages.length},{Icon:Database,label:'Schemas',value:source.analysis.entities.length},{Icon:Server,label:'Functions',value:source.analysis.functions.length}].map(({Icon,label,value})=><div key={label} className="rounded-xl border border-border p-3 bg-muted/30"><Icon className="w-4 h-4 text-primary mb-2" /><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div><label className="text-xs font-medium block">Project name<Input className="mt-1.5" value={name} maxLength={100} onChange={event=>setName(event.target.value)} disabled={busy||!!created} /></label></>}
      </div>}
      <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 text-xs text-muted-foreground leading-relaxed flex gap-2"><ShieldCheck className="w-4 h-4 text-primary shrink-0" /><p>Backups stay private and are included in the standalone download. JSON tables up to 128 MB each and 512 MB per database ZIP are supported. The restore preserves record IDs, skips identical duplicates and stops on conflicting records by default. Account passwords and binary uploads need separate migration. Independent conversion supports Base44 React/Vite apps.</p></div>
      {stage&&<div role="status" className="text-xs text-muted-foreground"><span className="flex items-center gap-2">{busy&&<Loader2 className="w-3 h-3 animate-spin" />}{stage}</span>{busy&&percent>0&&<div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden"><div className="h-full bg-primary transition-all" style={{width:percent+'%'}} /></div>}</div>}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      {created&&error&&<p className="text-xs text-muted-foreground">The app source and completed database uploads are saved. Retry to continue, or open this project and add remaining backups later.<Button variant="link" className="h-auto p-0 ml-2 text-xs" onClick={()=>{const id=created.id;close();navigate('/projects/'+id+'?section=studio&mode=code');}}>Open imported app</Button></p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button className="gap-2" disabled={busy||!source||!name.trim()} onClick={create}>{busy?<Loader2 className="w-4 h-4 animate-spin" />:<Upload className="w-4 h-4" />}{created?'Continue database uploads':'Import selected ZIPs'}</Button></div>
    </DialogContent>
  </Dialog>;
}
