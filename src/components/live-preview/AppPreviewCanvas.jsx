import React, { useEffect, useRef, useState } from 'react';
import { Monitor, Tablet, Smartphone, Undo2, Redo2, Save, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Designable from '@/components/live-preview/Designable';
import PreviewElementInspector from '@/components/live-preview/PreviewElementInspector';
import PreviewScreenNavigation from '@/components/live-preview/PreviewScreenNavigation';
import RuntimePageBody from '@/components/live-preview/RuntimePageBody';
import useVisualDesign from '@/components/live-preview/useVisualDesign';
import {normalizeDesign,designVariables,DESIGN_CSS} from '@/lib/designSystem';

export default function AppPreviewCanvas({ projectId, projectName, projectDescription='', pages, entities, records = [], designMode = false, designSystem = {}, onCreate, onEdit, onDelete, onSave, busy }) {
  const theme=normalizeDesign(designSystem);
  const [activeId, setActiveId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [device, setDevice] = useState(0);
  const root = useRef(null);
  const layout = useVisualDesign(projectId);
  const screens = [...pages, ...entities.filter(entity => !pages.some(page => page.name.toLowerCase() === entity.name.toLowerCase())).map(entity => ({ id: 'entity-' + entity.id, name: entity.display_name || entity.name, type: 'list', components: [{ data_source: entity.name }] }))];
  if (!screens.length) screens.push({ id: 'dashboard', name: 'Dashboard', type: 'dashboard' });
  const active = screens.find(page => page.id === activeId) || screens[0];
  const settings = id => layout.settings[id] || {};
  const select = (id, label) => setSelected({ id, label });
  const editProps = (suffix, label) => { const id = active.id + ':' + suffix; return { id, label, enabled: designMode, selectedId: selected?.id, onSelect: select, settings: settings(id) }; };
  const navigate = id => { setActiveId(id); setSelected(null); };
  const navigateEntity = entity => navigate(screens.find(page => (page.components || []).some(component => component.data_source === entity.name) || page.name.toLowerCase() === entity.name.toLowerCase())?.id);
  const header = settings(active.id + ':header');
  useEffect(() => {
    if (!designMode) return;
    const keydown = event => {
      if (!root.current?.contains(document.activeElement)) return;
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === 's') { event.preventDefault(); if (layout.dirty && !layout.save.isPending) layout.save.mutate(); return; }
      const isInput = /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || event.target.isContentEditable;
      if (isInput || layout.save.isPending) return;
      if (command && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? layout.redo() : layout.undo(); }
      if (command && event.key.toLowerCase() === 'y') { event.preventDefault(); layout.redo(); }
    };
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  }, [designMode, layout]);
  if (layout.loading) return <p className="p-6 text-sm text-muted-foreground">Loading saved visual edits…</p>;
  if (layout.error) return <p role="alert" className="text-destructive">Could not load visual edits: {layout.error.message}</p>;
  return <div ref={root} tabIndex={-1} className="space-y-3 outline-none">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <select aria-label="Preview screen" className="border border-border rounded-lg bg-card p-2 max-w-full" value={active.id} onChange={event => navigate(event.target.value)}>{screens.map(page => <option key={page.id} value={page.id}>{page.name}</option>)}</select>
      <div className="flex border border-border rounded-lg overflow-hidden" aria-label="Preview width">{[{ width: 0, label: 'Fit', Icon: Monitor }, { width: 768, label: 'Tablet', Icon: Tablet }, { width: 390, label: 'Mobile', Icon: Smartphone }].map(({ width, label, Icon }) => <button key={label} title={label + (width ? ' · ' + width + 'px' : '')} aria-label={label + ' preview'} aria-pressed={device === width} onClick={() => setDevice(width)} className={'px-2.5 py-2 flex items-center gap-1.5 ' + (device === width ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}><Icon className="w-3.5 h-3.5" /><span className="hidden sm:inline">{label}</span></button>)}</div>
      <span className="text-muted-foreground flex-1">{designMode ? 'Select an element to edit' : 'Run mode'}</span>
      {(designMode || layout.dirty) && <>
        <span role="status" className={layout.dirty ? 'text-amber-600' : 'text-muted-foreground'}>{layout.dirty ? 'Unsaved edits' : 'Saved'}</span>
        <Button size="sm" variant="outline" title="Undo · Ctrl/Cmd+Z" aria-label="Undo visual edit" disabled={!layout.canUndo || layout.save.isPending} onClick={layout.undo}><Undo2 className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="outline" title="Redo · Ctrl/Cmd+Shift+Z" aria-label="Redo visual edit" disabled={!layout.canRedo || layout.save.isPending} onClick={layout.redo}><Redo2 className="w-3.5 h-3.5" /></Button>
        <Button size="sm" variant="outline" title="Discard unsaved visual edits" aria-label="Discard visual edits" disabled={!layout.dirty || layout.save.isPending} onClick={() => window.confirm('Discard unsaved visual edits?') && layout.reset()}><RotateCcw className="w-3.5 h-3.5" /></Button>
        <Button size="sm" disabled={!layout.dirty || layout.save.isPending} onClick={() => layout.save.mutate()} className="gap-1.5"><Save className="w-3.5 h-3.5" />{layout.save.isPending ? 'Saving…' : 'Save visual edits'}</Button>
      </>}
    </div>
    {layout.save.error && <p role="alert" className="text-sm text-destructive">Could not save: {layout.save.error.message}</p>}
    <div className={designMode ? 'grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_260px] gap-4' : ''}>
      <div className="min-w-0 overflow-x-auto bg-muted/40 rounded-xl p-2">
        <div className="bb-design border border-border rounded-xl overflow-hidden mx-auto" data-layout={theme.layout} data-composition={theme.dashboard_layout} data-preview-width={device || 'auto'} style={{...designVariables(theme),width:device||'100%',maxWidth:'100%'}}>
          <style>{DESIGN_CSS}</style>
          <div className="bb-shell">
            <PreviewScreenNavigation pages={screens} active={active} onNavigate={navigate} name={theme.app_name||projectName} designSystem={theme} editProps={{ id: 'sidebar', label: 'Navigation', enabled: designMode, selectedId: selected?.id, onSelect: select, settings: settings('sidebar') }} />
            <main className="bb-main">
              <div className="bb-topline"><span className="bb-breadcrumb">Workspace <span aria-hidden="true"> / </span><strong>{active.name}</strong></span><span className="bb-account"><span className="bb-account-label">{theme.app_name||projectName}</span><span className="bb-avatar">{(theme.app_name||projectName||'W').slice(0,1).toUpperCase()}</span></span></div>
              <div className="bb-content"><Designable {...editProps('header', 'Screen heading')} className="bb-heading"><div><h2 style={{fontSize:header.fontSize?'inherit':undefined}}>{header.text||active.name}</h2><p>{header.description||active.description||'Your work, organized in one place.'}</p></div></Designable>
              <RuntimePageBody key={active.id} page={active} entities={entities} records={records} binding={header.entity_name} editProps={editProps} settings={settings} onNavigateEntity={navigateEntity} onCreate={onCreate} onEdit={onEdit} onDelete={onDelete} onSave={onSave} busy={busy} designSystem={theme} projectName={projectName} projectDescription={projectDescription}/>
              </div>
            </main>
          </div>
        </div>
      </div>
      {designMode && <fieldset disabled={layout.save.isPending} className="min-w-0"><PreviewElementInspector selected={selected} settings={selected ? settings(selected.id) : {}} entities={entities} onChange={next => selected && layout.change(selected.id, next)} onReset={() => selected && layout.change(selected.id, null)} /></fieldset>}
    </div>
  </div>;
}
