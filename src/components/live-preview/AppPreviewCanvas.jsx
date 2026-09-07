import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import Designable from '@/components/live-preview/Designable';
import PreviewElementInspector from '@/components/live-preview/PreviewElementInspector';
import PreviewScreenNavigation from '@/components/live-preview/PreviewScreenNavigation';
import RuntimePageBody from '@/components/live-preview/RuntimePageBody';
import useVisualDesign from '@/components/live-preview/useVisualDesign';

export default function AppPreviewCanvas({ projectId, projectName, pages, entities, records = [], designMode = false, designSystem, onCreate, onEdit, onDelete, onSave, busy }) {
  const [activeId, setActiveId] = useState(null);
  const [selected, setSelected] = useState(null);
  const layout = useVisualDesign(projectId);
  const screens = [...pages, ...entities.filter(entity => !pages.some(page => page.name.toLowerCase() === entity.name.toLowerCase())).map(entity => ({ id: `entity-${entity.id}`, name: entity.display_name || entity.name, type: 'list', components: [{ data_source: entity.name }] }))];
  if (!screens.length) screens.push({ id: 'dashboard', name: 'Dashboard', type: 'dashboard' });
  const active = screens.find(page => page.id === activeId) || screens[0];
  const settings = id => layout.settings[id] || {};
  const select = (id, label) => setSelected({ id, label });
  const editProps = (suffix, label) => { const id = `${active.id}:${suffix}`; return { id, label, enabled: designMode, selectedId: selected?.id, onSelect: select, settings: settings(id) }; };
  const navigate = id => { setActiveId(id); setSelected(null); };
  const navigateEntity = entity => navigate(screens.find(page => (page.components || []).some(component => component.data_source === entity.name) || page.name.toLowerCase() === entity.name.toLowerCase())?.id);
  const header = settings(`${active.id}:header`);
  const pad = { compact: 'p-3', comfortable: 'p-5', spacious: 'p-8' };
  if (layout.loading) return <p className="p-6 text-sm text-muted-foreground">Loading saved visual edits…</p>;
  if (layout.error) return <p role="alert" className="text-destructive">Could not load visual edits: {layout.error.message}</p>;
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2 text-xs"><select aria-label="Preview screen" className="border rounded-md bg-card p-2 max-w-full" value={active.id} onChange={event => navigate(event.target.value)}>{screens.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select><span className="text-muted-foreground flex-1">{designMode ? 'Click to select · actions paused' : 'Run mode · changes save to preview data'}</span>{(designMode || layout.dirty) && <><span role="status">{layout.dirty ? 'Unsaved visual edits' : 'No unsaved visual edits'}</span><Button size="sm" variant="outline" disabled={!layout.canUndo || layout.save.isPending} onClick={layout.undo}>Undo</Button><Button size="sm" disabled={!layout.dirty || layout.save.isPending} onClick={() => layout.save.mutate()}>{layout.save.isPending ? 'Saving…' : 'Save visual edits'}</Button></>}</div>
    {layout.save.error && <p role="alert" className="text-sm text-destructive">Could not save: {layout.save.error.message}. Your edits are still available; retry Save.</p>}
    <div className={designMode ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_240px] gap-4' : ''}>
      <div className="min-w-0 border rounded-xl overflow-hidden" style={{ background: designSystem.background_color, color: designSystem.text_color, fontFamily: designSystem.font_family }}>
        <div className="border-b px-3 py-2 text-xs opacity-60">Interactive prototype · not an independently deployed app</div>
        <div className="flex min-h-[480px] overflow-auto">
          <PreviewScreenNavigation pages={screens} active={active} onNavigate={navigate} name={projectName} designSystem={designSystem} editProps={{ id: 'sidebar', label: 'Navigation', enabled: designMode, selectedId: selected?.id, onSelect: select, settings: settings('sidebar') }} />
          <main className={`flex-1 min-w-0 space-y-5 ${pad[designSystem.density] || 'p-5'}`}>
            <Designable {...editProps('header', 'Screen heading')}><h2 className="font-bold" style={{ fontSize: header.fontSize ? 'inherit' : '1.5rem' }}>{header.text || active.name}</h2><p className="text-sm opacity-60 mt-1">{header.description || active.description}</p></Designable>
            <RuntimePageBody key={active.id} page={active} entities={entities} records={records} binding={header.entity_name} editProps={editProps} settings={settings} onNavigateEntity={navigateEntity} onCreate={onCreate} onEdit={onEdit} onDelete={onDelete} onSave={onSave} busy={busy} designSystem={designSystem} />
          </main>
        </div>
      </div>
      {designMode && <fieldset disabled={layout.save.isPending} className="min-w-0"><PreviewElementInspector selected={selected} settings={selected ? settings(selected.id) : {}} entities={entities} onChange={next => layout.change(selected.id, next)} onReset={() => layout.change(selected.id, null)} /></fieldset>}
    </div>
  </div>;
}