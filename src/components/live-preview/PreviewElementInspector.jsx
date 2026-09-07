import React from 'react';
import DesignInspector from '@/components/live-preview/DesignInspector';
import { Input } from '@/components/ui/input';

export default function PreviewElementInspector({ selected, settings = {}, onChange, onReset, entities }) {
  const patch = value => onChange({ ...settings, ...value });
  if (!selected) return <p className="p-4 text-sm text-muted-foreground">Choose a screen, then click its heading, content, button, or navigation to select it. Switch to Run to use the app.</p>;
  return <div className="space-y-3 min-w-0">
    <DesignInspector selected={selected} settings={settings} onChange={onChange} onReset={onReset} />
    <div className="border rounded-xl p-4 bg-card text-card-foreground space-y-3">
      {selected.id.endsWith(':header') && <><label className="block text-xs">Screen title<Input value={settings.text ?? ''} placeholder="Use original title" onChange={event => patch({ text: event.target.value })} /></label><label className="block text-xs">Description<Input value={settings.description ?? ''} placeholder="Use original description" onChange={event => patch({ description: event.target.value })} /></label><label className="block text-xs">Screen data<select className="w-full mt-1 rounded-md border bg-background p-2" value={settings.entity_name || ''} onChange={event => patch({ entity_name: event.target.value })}><option value="">Automatic matching</option>{entities.map(entity => <option key={entity.id} value={entity.name}>{entity.display_name || entity.name}</option>)}</select></label></>}
      {selected.id.endsWith(':add') && <label className="block text-xs">Button label<Input value={settings.text ?? ''} placeholder="Add record" onChange={event => patch({ text: event.target.value })} /></label>}
      <div className="grid grid-cols-2 gap-2">{[{ key: 'background', label: 'Background' }, { key: 'color', label: 'Text color' }].map(({ key, label }) => <label key={key} className="text-xs">{label}<Input value={settings[key] || ''} placeholder="#hex or CSS color" onChange={event => patch({ [key]: event.target.value })} /></label>)}</div>
      <div className="grid grid-cols-2 gap-2">{[{ key: 'padding', label: 'Padding' }, { key: 'fontSize', label: 'Text size' }].map(({ key, label }) => <label key={key} className="text-xs">{label}<Input type="number" min="0" max="96" value={settings[key] ?? ''} onChange={event => patch({ [key]: event.target.value === '' ? undefined : Math.min(96, Math.max(0, Number(event.target.value))) })} /></label>)}</div>
    </div>
  </div>;
}