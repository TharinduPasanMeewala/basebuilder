import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, Package, Loader2, FileCode, Database, Server, ShieldCheck } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { inspectArchive, uploadArchive } from '@/lib/sourceArchives';

export default function ImportArchiveDialog({ open, onClose }) {
  const navigate = useNavigate();
  const [source, setSource] = useState(null), [name,setName] = useState(''), [busy,setBusy] = useState(false), [error,setError] = useState(''), [stage,setStage] = useState(''), [percent,setPercent] = useState(0);
  const select = async file => {
    if (!file) return;
    setBusy(true);setError('');setSource(null);setStage('Inspecting ZIP…');setPercent(0);
    try { const data = await inspectArchive(file);setSource(data);setName(file.name.replace(/\.zip$/i,'').replace(/[-_]/g,' '));setStage('Source ready to import'); }
    catch (error) { setError(error.message);setStage(''); }
    finally { setBusy(false); }
  };
  const create = async () => {
    setBusy(true);setError('');
    try { const result = await uploadArchive(source,name.trim(),(message,value)=>{setStage(message);setPercent(Math.min(100,value));});onClose();navigate('/projects/'+result.projectId+'?section=studio&mode=code'); }
    catch (error) { setError(error.message); }
    finally { setBusy(false); }
  };
  return <Dialog open={open} onOpenChange={value=>{if(!value&&!busy){setSource(null);setError('');onClose();}}}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex gap-2 items-center"><Package className="w-5 h-5 text-primary" />Import an existing app</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground">Bring in a complete source ZIP, edit its real files, and prepare a standalone app for localhost or your own domain.</p>
      <label className={'block border-2 border-dashed rounded-xl p-7 text-center '+(busy?'opacity-60':'cursor-pointer hover:border-primary')}>
        <Upload className="w-7 h-7 mx-auto text-primary mb-2" /><span className="text-sm font-semibold">Choose application ZIP</span><span className="block text-xs text-muted-foreground mt-1">Up to 15 MB compressed · 5,000 files · source and binary assets</span>
        <input type="file" accept=".zip,application/zip" className="sr-only" disabled={busy} onChange={event=>select(event.target.files?.[0])} />
      </label>
      {source && <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">{[{Icon:FileCode,label:'Pages',value:source.analysis.pages.length},{Icon:Database,label:'Schemas',value:source.analysis.entities.length},{Icon:Server,label:'Backend functions',value:source.analysis.functions.length}].map(({Icon,label,value})=><div key={label} className="rounded-xl border border-border p-3 bg-muted/30"><Icon className="w-4 h-4 text-primary mb-2" /><p className="text-xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></div>)}</div>
        <p className="text-xs text-muted-foreground">{source.files.length} files · {source.analysis.framework}{source.analysis.base44?' · Base44 dependencies detected':''}{source.analysis.actors.length?' · '+source.analysis.actors.length+' realtime actor(s)':''}</p>
        {source.excluded>0&&<p className="text-xs text-muted-foreground">{source.excluded} dependency, build, or secret-file entries excluded.</p>}
        <label className="text-xs font-medium block">Project name<Input className="mt-1.5" value={name} maxLength={100} onChange={event=>setName(event.target.value)} disabled={busy} /></label>
        <div className="rounded-xl bg-primary/5 border border-primary/15 p-4 text-xs text-muted-foreground leading-relaxed flex gap-2"><ShieldCheck className="w-4 h-4 text-primary shrink-0" /><p>The import preserves source, schemas, functions and assets. Database records, user passwords and connected-service credentials need a separate migration. Independent backend conversion currently supports Base44 React/Vite apps.</p></div>
      </div>}
      {stage&&<div role="status" className="text-xs text-muted-foreground"><span className="flex items-center gap-2">{busy&&<Loader2 className="w-3 h-3 animate-spin" />}{stage}</span>{busy&&percent>0&&<div className="h-1.5 bg-muted rounded-full mt-2 overflow-hidden"><div className="h-full bg-primary transition-all" style={{width:percent+'%'}} /></div>}</div>}
      {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button className="gap-2" disabled={busy||!source||!name.trim()} onClick={create}>{busy?<Loader2 className="w-4 h-4 animate-spin" />:<Upload className="w-4 h-4" />}Import complete source</Button></div>
    </DialogContent>
  </Dialog>;
}
