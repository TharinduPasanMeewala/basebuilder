import React from 'react';
import { Button } from '@/components/ui/button';

const themes = [
  { label: 'Clean', background: '', color: '', shadow: '' },
  { label: 'Glass', background: 'rgba(255,255,255,.72)', color: '', shadow: '0 18px 45px rgba(15,23,42,.14)' },
  { label: 'Dark', background: '#111827', color: '#f9fafb', shadow: '0 18px 45px rgba(0,0,0,.22)' },
  { label: 'Accent', background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))', shadow: '0 16px 36px hsl(var(--primary) / .28)' },
];

export default function DesignInspector({ selected, settings = {}, onChange, onReset }) {
  if (!selected) return <div className="rounded-xl border border-dashed border-border bg-card/70 p-4 text-xs text-muted-foreground">Turn on Design Mode, then click any visible preview element to edit it.</div>;
  const patch = (changes) => onChange({ ...settings, ...changes });
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-lg space-y-4">
      <div><p className="text-xs text-muted-foreground">Selected</p><h3 className="text-sm font-semibold text-foreground">{selected.label}</h3></div>
      <div className="grid grid-cols-3 gap-2"><Button size="sm" variant="outline" onClick={() => patch({ y: (settings.y || 0) - 10 })}>Up</Button><Button size="sm" variant="outline" onClick={() => patch({ x: (settings.x || 0) - 10 })}>Left</Button><Button size="sm" variant="outline" onClick={() => patch({ x: (settings.x || 0) + 10 })}>Right</Button><Button size="sm" variant="outline" onClick={() => patch({ y: (settings.y || 0) + 10 })}>Down</Button><Button size="sm" variant="outline" onClick={() => patch({ width: Math.max(120, (settings.width || 240) - 20) })}>Narrow</Button><Button size="sm" variant="outline" onClick={() => patch({ width: (settings.width || 240) + 20 })}>Wider</Button></div>
      <div className="grid grid-cols-2 gap-2"><Button size="sm" variant="outline" onClick={() => patch({ height: Math.max(40, (settings.height || 80) - 10) })}>Shorter</Button><Button size="sm" variant="outline" onClick={() => patch({ height: (settings.height || 80) + 10 })}>Taller</Button><Button size="sm" variant="outline" onClick={() => patch({ radius: Math.max(0, (settings.radius ?? 12) - 4) })}>Less round</Button><Button size="sm" variant="outline" onClick={() => patch({ radius: (settings.radius ?? 12) + 4 })}>More round</Button></div>
      <div className="grid grid-cols-2 gap-2">{themes.map(theme => <Button key={theme.label} size="sm" variant="outline" onClick={() => patch(theme)}>{theme.label}</Button>)}</div>
      <Button size="sm" variant="ghost" className="w-full" onClick={onReset}>Reset element</Button>
    </div>
  );
}