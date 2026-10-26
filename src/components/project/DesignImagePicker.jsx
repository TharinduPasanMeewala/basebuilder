import React, {useState} from 'react';
import {ImagePlus,Loader2,X} from 'lucide-react';
import {MAX_DESIGN_IMAGES,uploadDesignReference} from '@/lib/designReferences';

export default function DesignImagePicker({images,onChange,disabled,onBusy}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const add=async files=>{
    if(!files.length||busy||disabled)return;
    setError('');if(images.length+files.length>MAX_DESIGN_IMAGES){setError('Attach up to four design images.');return;}
    setBusy(true);onBusy?.(true);const uploaded=[];
    try{for(const file of files)uploaded.push(await uploadDesignReference(file));onChange([...images,...uploaded]);}
    catch(error){if(uploaded.length)onChange([...images,...uploaded]);setError(error.message);}finally{setBusy(false);onBusy?.(false);}
  };
  return <div tabIndex={0} aria-label="Design image drop and paste area" className="space-y-3 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();add(Array.from(event.dataTransfer.files||[]));}} onPaste={event=>{const files=Array.from(event.clipboardData?.files||[]).filter(file=>file.type.startsWith('image/'));if(files.length){event.preventDefault();add(files);}}}>
    <label className={'block rounded-xl border-2 border-dashed border-border bg-muted/20 p-5 text-center '+(disabled||busy?'opacity-60':'cursor-pointer hover:border-primary hover:bg-primary/5')}>
      {busy?<Loader2 className="w-6 h-6 animate-spin text-primary mx-auto mb-2"/>:<ImagePlus className="w-6 h-6 text-primary mx-auto mb-2"/>}<span className="text-sm font-semibold">{busy?'Preparing design images…':'Drop screenshots, paste an image, or browse'}</span><span className="block text-xs text-muted-foreground mt-1">PNG, JPG, WebP · 4 images · 10 MB each · private uploads</span>
      <input type="file" multiple accept="image/png,image/jpeg,image/webp" aria-label="Upload design screenshots" className="sr-only" disabled={disabled||busy||images.length>=MAX_DESIGN_IMAGES} onChange={event=>{add(Array.from(event.target.files||[]));event.target.value='';}}/>
    </label>
    {!!images.length&&<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">{images.map((image,index)=><div key={image.file_uri} className="relative border border-border rounded-lg p-1.5 bg-card"><img src={image.preview_url} alt={image.name} className="aspect-[4/3] w-full object-contain rounded bg-muted/30"/><p className="text-[10px] truncate mt-1" title={image.name}>{image.name}</p><button aria-label={'Remove reference '+image.name} disabled={disabled||busy} onClick={()=>onChange(images.filter((_,i)=>i!==index))} className="absolute right-1 top-1 rounded-full bg-background p-1 shadow border border-border"><X className="w-3 h-3"/></button></div>)}</div>}
    {error&&<p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
