import React from 'react';
import {DESIGN_PRESETS,normalizeDesign,DESIGN_FONTS} from '@/lib/designSystem';
import { Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const colorFields = [
  ['primary_color', 'Primary'], ['accent_color', 'Accent'], ['background_color', 'Background'], ['surface_color', 'Surface'], ['text_color', 'Text'], ['muted_color','Muted'], ['border_color','Borders'], ['sidebar_color','Navigation'], ['sidebar_text','Navigation text']
];
const fonts = DESIGN_FONTS;

export default function BrandStylePanel({ design, onChange, onSave, saving }) {
  const set = (key, value) => onChange({ ...design, [key]: value });
  return <div className="rounded-xl border border-border bg-card p-4 shadow-sm space-y-4">
    <div className="flex items-center gap-2"><Palette className="w-4 h-4 text-primary" /><h3 className="text-sm font-semibold">Brand Styling</h3></div>
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">{DESIGN_PRESETS.map(preset=><button key={preset.id} onClick={()=>onChange(normalizeDesign({...design,...preset,visual_preset:preset.id}))} className={'border rounded-lg p-2.5 text-left '+(design.visual_preset===preset.id?'border-primary':'border-border')}><span className="flex gap-1 mb-1.5">{[preset.sidebar_color,preset.background_color,preset.primary_color].map((color,index)=><i key={index} className="w-3.5 h-3.5 rounded-full border border-black/10" style={{background:color}}/>)}</span><span className="text-xs font-medium">{preset.name}</span></button>)}</div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{colorFields.map(([key, label]) => <div key={key} className="space-y-1"><Label className="text-[11px]">{label}</Label><div className="flex gap-1"><Input type="color" value={design[key]} onChange={e => set(key, e.target.value)} className="w-10 px-1" /><Input value={design[key]} onChange={e => set(key, e.target.value)} className="text-xs" /></div></div>)}</div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><div className="space-y-1"><Label className="text-[11px]">Typography</Label><Select value={design.font_family} onValueChange={v => set('font_family', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{fonts.map(font => <SelectItem key={font} value={font}>{font}</SelectItem>)}</SelectContent></Select></div><div className="space-y-1"><Label className="text-[11px]">Corner Radius</Label><Input type="number" value={design.radius} onChange={e => set('radius', Number(e.target.value))} /></div><div className="space-y-1"><Label className="text-[11px]">Density</Label><Select value={design.density} onValueChange={v => set('density', v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="compact">Compact</SelectItem><SelectItem value="comfortable">Comfortable</SelectItem><SelectItem value="spacious">Spacious</SelectItem></SelectContent></Select></div></div>
    <div className="grid sm:grid-cols-3 gap-3">{[{key:'layout',label:'Navigation',values:['sidebar','topbar']},{key:'dashboard_layout',label:'Composition',values:['analytics','workspace','editorial']},{key:'heading_font',label:'Heading font',values:fonts}].map(field=><label key={field.key} className="text-xs font-medium">{field.label}<select className="w-full mt-1.5 p-2 border border-border rounded-lg bg-background text-xs" value={design[field.key]} onChange={event=>set(field.key,event.target.value)}>{field.values.map(value=><option value={value} key={value}>{value}</option>)}</select></label>)}</div>
    <div className="flex justify-end"><Button size="sm" onClick={onSave} disabled={saving}>{saving ? 'Saving...' : 'Save Brand Style'}</Button></div>
  </div>;
}
