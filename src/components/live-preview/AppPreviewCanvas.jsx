import React, { useMemo, useState } from 'react';
import { LayoutDashboard, Table2, FileText, BarChart3, Settings } from 'lucide-react';
import Designable from './Designable';
import DesignInspector from './DesignInspector';

const pageIcon = { dashboard: LayoutDashboard, list: Table2, detail: FileText, form: FileText, report: BarChart3, settings: Settings };
const sampleRows = (entity) => [1, 2, 3].map(i => Object.fromEntries(Object.keys(entity.schema?.properties || {}).slice(0, 4).map(f => [f, `${f.replace(/_/g, ' ')} ${i}`])));
const densityPad = { compact: 'p-4', comfortable: 'p-6', spacious: 'p-8' };
const DEFAULT_STYLE = { primary_color: '#6366f1', accent_color: '#10b981', background_color: '#f8fafc', surface_color: '#ffffff', text_color: '#0f172a', font_family: 'Inter', radius: 16, density: 'comfortable' };

function isCalculatorPage(page) {
  return `${page?.name || ''} ${page?.description || ''} ${page?.route || ''}`.toLowerCase().includes('calculator');
}

function CalculatorPreview({ designSystem }) {
  const buttons = [['C','√','%','CE'], ['7','8','9','+'], ['4','5','6','×'], ['1','2','3','−'], ['0','.','.','=']];
  return <div className="min-h-[480px] flex items-start justify-center bg-[#d9d9dc] p-0">
    <div className="w-full max-w-[650px] bg-[#dedee2] border-[3px] border-[#77777c] rounded-md overflow-hidden shadow-xl">
      <div className="h-16 bg-[#c5c5c9] flex items-center px-4 border-b border-[#b6b6bb]"><h1 className="text-[40px] text-black font-normal flex-1">Calculator</h1><div className="w-12 h-12 mr-3 rounded-md border-2 border-[#808086] bg-[#f3f3f5] text-black text-5xl leading-none flex items-center justify-center">−</div><div className="w-12 h-12 rounded-md border-2 border-[#808086] bg-[#f3f3f5] text-black text-5xl leading-none flex items-center justify-center">×</div></div>
      <div className="p-5 space-y-8"><div className="h-40 bg-[#f7f7f8] border-[3px] border-[#77777c] rounded-md flex items-center justify-end px-6"><span className="text-[120px] leading-none text-black">0</span></div><div className="grid grid-cols-4 gap-4">{buttons.flat().map((b, i) => <button key={b+i} className="h-20 rounded-md border-[3px] border-[#85858b] bg-[#c9c9cd] text-black text-[56px] leading-none flex items-center justify-center">{b}</button>)}</div></div>
    </div>
  </div>;
}

function PageBody({ page, entities, designMode, selectedId, selectElement, designs, designSystem }) {
  if (isCalculatorPage(page)) return <CalculatorPreview designSystem={designSystem} />;
  const linked = entities.find(e => page.description?.toLowerCase().includes(e.name?.toLowerCase())) || entities[0];
  const fields = Object.keys(linked?.schema?.properties || {}).slice(0, 5);
  const radius = designSystem.radius || 16;
  if (page.type === 'dashboard') return <div className="grid grid-cols-2 gap-3">{entities.slice(0,4).map((e,i)=><Designable key={e.id} id={`metric-${e.id}`} label={`${e.display_name || e.name} card`} enabled={designMode} selectedId={selectedId} onSelect={selectElement} settings={designs[`metric-${e.id}`]} className="ai-preview-card border p-4" style={{ borderRadius: radius }}><p className="text-xs opacity-70">{e.display_name || e.name}</p><p className="text-2xl font-bold mt-1">{(i+1)*12}</p></Designable>)}</div>;
  if (page.type === 'form') return <Designable id="form-panel" label="Form panel" enabled={designMode} selectedId={selectedId} onSelect={selectElement} settings={designs['form-panel']} className="space-y-3 border p-4" style={{ borderRadius: radius }}>{fields.map(f=><div key={f}><label className="text-xs font-medium capitalize">{f.replace(/_/g,' ')}</label><div className="h-9 border mt-1" style={{ borderRadius: Math.max(6, radius - 6), background: designSystem.surface_color }} /></div>)}<Designable id="primary-button" label="Primary button" enabled={designMode} selectedId={selectedId} onSelect={selectElement} settings={designs['primary-button']} className="inline-block px-4 py-2 text-sm font-medium" style={{ background: designSystem.primary_color, color: '#fff', borderRadius: Math.max(6, radius - 6) }}>Save</Designable></Designable>;
  return <Designable id="data-table" label="Data table" enabled={designMode} selectedId={selectedId} onSelect={selectElement} settings={designs['data-table']} className="overflow-hidden border" style={{ borderRadius: radius }}><table className="w-full text-sm"><thead style={{ background: `${designSystem.primary_color}14` }}><tr>{fields.map(f=><th key={f} className="text-left p-3 capitalize text-xs">{f.replace(/_/g,' ')}</th>)}</tr></thead><tbody>{sampleRows(linked || {}).map((r,i)=><tr key={i} className="border-t">{fields.map(f=><td key={f} className="p-3 opacity-75">{r[f]}</td>)}</tr>)}</tbody></table></Designable>;
}

export default function AppPreviewCanvas({ pages, entities, designMode = false, designSystem = DEFAULT_STYLE }) {
  const [activeId, setActiveId] = useState(pages[0]?.id);
  const [selected, setSelected] = useState(null);
  const [designs, setDesigns] = useState({});
  const active = useMemo(() => pages.find(p => p.id === activeId) || pages[0], [pages, activeId]);
  const selectElement = (id, label) => setSelected({ id, label });
  const updateSelected = (next) => setDesigns(prev => ({ ...prev, [selected.id]: next }));
  const resetSelected = () => { setDesigns(prev => { const copy = { ...prev }; delete copy[selected.id]; return copy; }); };
  const previewStyle = { background: designSystem.background_color, color: designSystem.text_color, fontFamily: designSystem.font_family };
  if (!pages.length) return <div className="rounded-xl border border-dashed border-border bg-card/40 p-10 text-center text-sm text-muted-foreground">No UI pages generated yet. Click Generate UI Preview to create screens from your project specs.</div>;
  return <div className="grid grid-cols-1 xl:grid-cols-[1fr_260px] gap-4" style={previewStyle}><div onClick={() => designMode && setSelected(null)} className="ai-preview-shell rounded-xl border border-border overflow-hidden p-3 min-h-[540px]"><div className="ai-preview-browser rounded-xl border border-border overflow-hidden min-h-[520px]" style={{ background: designSystem.surface_color }}><div className="h-9 border-b border-border flex items-center gap-2 px-3" style={{ background: `${designSystem.primary_color}10` }}><span className="w-3 h-3 rounded-full bg-destructive/70"/><span className="w-3 h-3 rounded-full bg-yellow-500/70"/><span className="w-3 h-3 rounded-full" style={{ background: designSystem.accent_color }}/><span className="ml-3 text-xs opacity-70">AI generated app preview · {designMode ? 'design mode on' : 'brand CSS applied'}</span></div><div className="flex min-h-[480px]"><Designable id="sidebar" label="Sidebar" enabled={designMode} selectedId={selected?.id} onSelect={selectElement} settings={designs.sidebar} className="w-52 p-4" style={{ background: designSystem.primary_color, color: '#fff' }}><h3 className="font-bold text-sm mb-5">{active?.module || 'App'}</h3><nav className="space-y-1">{pages.map(p=>{const Icon=pageIcon[p.type]||LayoutDashboard;return <button key={p.id} onClick={()=>setActiveId(p.id)} className={`w-full flex items-center gap-2 rounded-md px-3 py-2 text-xs text-left transition-all ${active?.id===p.id?'bg-white/20 text-white':'hover:bg-white/10'}`}><Icon className="w-3.5 h-3.5" />{p.name}</button>})}</nav></Designable><main className={`flex-1 ${densityPad[designSystem.density] || 'p-6'}`} style={{ background: designSystem.background_color }}><Designable id="page-header" label="Page header" enabled={designMode} selectedId={selected?.id} onSelect={selectElement} settings={designs['page-header']} className="mb-6"><p className="text-xs font-medium capitalize" style={{ color: designSystem.accent_color }}>{active?.type || 'page'} · {active?.route}</p><h2 className="text-2xl font-bold mt-1">{active?.name}</h2><p className="text-sm opacity-70 mt-1">{active?.description}</p></Designable><PageBody page={active || {}} entities={entities} designMode={designMode} selectedId={selected?.id} selectElement={selectElement} designs={designs} designSystem={designSystem} /></main></div></div></div>{designMode && <DesignInspector selected={selected} settings={selected ? designs[selected.id] : {}} onChange={updateSelected} onReset={resetSelected} />}</div>;
}