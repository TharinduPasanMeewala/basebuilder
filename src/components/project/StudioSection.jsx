import { invokeCodeAI } from '@/lib/codeAI';
import {normalizeDesign,DESIGN_SCHEMA,DESIGN_QUALITY_PROMPT} from '@/lib/designSystem';
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MonitorPlay, RefreshCw, Code2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LivePreviewSection from '@/components/LivePreviewSection';
import StudioChat from './studio/StudioChat';
import SourceEditor from './studio/SourceEditor';
import { confirmWorkspaceNavigation } from '@/hooks/useUnsavedChanges';
import { MessageSquare, Brush } from 'lucide-react';

export default function StudioSection({ project, onRefresh }) {
  const queryClient = useQueryClient();
  const [entities, setEntities] = useState([]);
  const [pages, setPages] = useState([]);
  const [design, setDesign] = useState({ app_name: '', primary: '#2563eb', sidebar_dark: true });
  const [designVersionId, setDesignVersionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState(() => project.source_mode === 'archive' || new URLSearchParams(window.location.search).get('mode') === 'code' ? 'code' : 'design');
  const changePanel = next => { if (next !== panel && confirmWorkspaceNavigation()) setPanel(next); };

  useEffect(() => { loadData(); }, [project.id]);

  const loadData = async () => {
    setLoadError('');
    try {
    const [ents, pgs, designs] = await Promise.all([
      base44.entities.DataEntity.filter({ project_id: project.id }),
      base44.entities.PageSpec.filter({ project_id: project.id }),
      base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'design_state' }, '-created_date', 1),
    ]);
    setEntities(ents);
    setPages(pgs);
    if (designs[0]) {
      setDesign(d => ({ ...d, ...designs[0].snapshot }));
      setDesignVersionId(designs[0].id);
    }
    } catch (error) { setLoadError(error.message || 'Could not load the studio.'); }
    finally { setLoading(false); }
  };

  const persistDesign = async (newDesign) => {
    if (designVersionId) {
      await base44.entities.ProjectVersion.update(designVersionId, { snapshot: newDesign });
    } else {
      const created = await base44.entities.ProjectVersion.create({
        project_id: project.id, version_number: 1, label: 'design_state',
        notes: 'Visual design settings', snapshot: newDesign,
      });
      setDesignVersionId(created.id);
    }
  };

  const applyActions = async (actions) => {
    const applied = [];
    let newDesign = design;

    for (const a of actions || []) {
      if (a.action === 'create_entity' && a.entity_name) {
        await base44.entities.DataEntity.create({
          project_id: project.id,
          name: a.entity_name,
          description: a.description || '',
          fields: a.fields || [],
          source: 'ai_generated',
        });
        applied.push(`Created entity "${a.entity_name}"`);
      } else if (a.action === 'update_entity' && a.entity_name) {
        const match = entities.find(e => e.name.toLowerCase() === a.entity_name.toLowerCase());
        if (match) {
          await base44.entities.DataEntity.update(match.id, {
            ...(a.fields?.length ? { fields: a.fields } : {}),
            ...(a.description ? { description: a.description } : {}),
            ...(a.new_name ? { name: a.new_name } : {}),
          });
          applied.push(`Updated entity "${a.entity_name}"`);
        }
      } else if (a.action === 'delete_entity' && a.entity_name) {
        const match = entities.find(e => e.name.toLowerCase() === a.entity_name.toLowerCase());
        if (match) {
          await base44.entities.DataEntity.delete(match.id);
          applied.push(`Deleted entity "${a.entity_name}"`);
        }
      } else if (a.action === 'create_page' && a.page_name) {
        await base44.entities.PageSpec.create({
          project_id: project.id,
          name: a.page_name,
          type: a.page_type || 'list',
          description: a.page_description || '',
          source: 'ai_generated',
        });
        applied.push(`Added page "${a.page_name}"`);
      } else if (a.action === 'delete_page' && a.page_name) {
        const match = pages.find(p => p.name.toLowerCase() === a.page_name.toLowerCase());
        if (match) {
          await base44.entities.PageSpec.delete(match.id);
          applied.push(`Removed page "${a.page_name}"`);
        }
      } else if (a.action === 'set_design' && a.design) {
        newDesign = { ...newDesign, ...a.design, primary_color:a.design.primary_color||a.design.primary||newDesign.primary_color,primary:a.design.primary_color||a.design.primary||newDesign.primary };
        const parts = [];
        if (a.design.app_name) parts.push(`renamed app to "${a.design.app_name}"`);
        if (a.design.primary) parts.push(`brand color → ${a.design.primary}`);
        if (a.design.sidebar_dark !== undefined) parts.push(`sidebar → ${a.design.sidebar_dark ? 'dark' : 'light'}`);
        applied.push(`Design: ${parts.join(', ') || 'updated'}`);
      }
    }

    if (newDesign !== design) {
      setDesign(newDesign);
      await persistDesign(newDesign);
      const saved = await base44.entities.ProjectDesign.filter({ project_id: project.id }, '-updated_date', 1);
      const payload = { ...normalizeDesign(newDesign), project_id: project.id };
      if (saved[0]) await base44.entities.ProjectDesign.update(saved[0].id, payload);
      else await base44.entities.ProjectDesign.create(payload);
    }
    await Promise.all(['dataEntitiesForPreview', 'entityDefinitions', 'pageSpecsForPreview', 'projectDesign'].map(key => queryClient.invalidateQueries({ queryKey: [key, project.id] })));
    return applied;
  };

  const handleSend = async (text, imageUrls = [], roundtable = false) => {
    setMessages(m => [...m, { role: 'user', content: text, images: imageUrls }]);
    setBusy(true);
    try {
      const res = await invokeCodeAI({
        ...(imageUrls.length > 0 ? { file_urls: imageUrls } : {}),
        prompt: `You are an AI app editor for "${design.app_name || project.name}" (${project.type?.replace(/_/g, ' ')}).

You edit the project specifications through the valid actions below. Preserve working models and screens. Never claim an action that is unsupported or was not requested.

Current data entities:
${entities.map(e => `- ${e.name}: ${(e.fields || []).map(f => f.name).join(', ') || 'no fields'}`).join('\n') || '(none)'}

Current pages:
${pages.map(p => `- ${p.name} (${p.type})`).join('\n') || '(none)'}

Current design: ${JSON.stringify(normalizeDesign(design))}

User request: "${text}"

Decide which actions to apply. Valid actions:
- create_entity: entity_name, description, fields [{name, type (string/number/boolean/date/enum), required}]
- update_entity: entity_name (existing), optional new_name, fields (full replacement list), description
- delete_entity: entity_name
- create_page: page_name, page_type (dashboard/list/detail/form/report/settings/kanban/calendar/chart), page_description
- delete_page: page_name
- set_design: design may set primary_color, accent_color, background_color, surface_color, text_color, muted_color, border_color, sidebar_color, sidebar_text, font_family, heading_font, radius, density, layout (sidebar/topbar), dashboard_layout (analytics/workspace/editorial), hero_title, hero_description, hero_cta, sections (hero/metrics/distribution/records/modules), feature_cards. Include only changed fields.

Mapping rules — always act:
- Do not create duplicate entities or pages to repair an existing button. The preview already supports record create/read/update/delete.
- Connect new list or form pages by naming the data entity explicitly in page_description. Create only missing models and pages.
- Apply visual requests through set_design with the supported design tokens and layout. For individual element overrides or a data binding, use the visual screen editor.\n${DESIGN_QUALITY_PROMPT}
- Actions here edit specifications, not arbitrary application code. Explain unsupported behaviors honestly; do not claim workflows or external services are implemented.

${imageUrls.length > 0 ? '\nThe user attached image(s). Recreate their visible design: navigation placement, typography character, colors, hierarchy, panel proportions, hero copy and section order. Apply detailed set_design actions as well as any missing practical models/screens.' : ''}${roundtable ? '\nAlso include a "roundtable" array with brief one-sentence expert comments about this change from relevant agents only (Business Analyst, DB Architect, UI/UX Architect, Backend Architect, QA Architect).' : ''}

Also write a short friendly reply (1-2 sentences) describing what you did.`,
        response_json_schema: {
          type: 'object',
          properties: {
            reply: { type: 'string' },
            roundtable: { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' }, comment: { type: 'string' } } } },
            actions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  action: { type: 'string' },
                  entity_name: { type: 'string' },
                  new_name: { type: 'string' },
                  description: { type: 'string' },
                  fields: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, required: { type: 'boolean' } } } },
                  page_name: { type: 'string' },
                  page_type: { type: 'string' },
                  page_description: { type: 'string' },
                  design: {...DESIGN_SCHEMA,required:[],properties:{...DESIGN_SCHEMA.properties,app_name:{type:'string'},primary:{type:'string'},sidebar_dark:{type:'boolean'}}},
                },
              },
            },
          },
        },
      });

      const applied = await applyActions(res.actions);
      setMessages(m => [...m, { role: 'assistant', content: res.reply || 'Done.', applied, roundtable: res.roundtable || [] }]);
      if (applied.length > 0) {
        await loadData();
        onRefresh?.();
      }
      return true;
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Something went wrong: ${e.message}` }]);
      return false;
    }finally{setBusy(false);}
  };


  if (loadError) return <div role="alert" className="p-6 text-sm text-destructive">{loadError}<button className="ml-3 underline" onClick={loadData}>Retry</button></div>;
  if (loading) {
    return <div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <MonitorPlay className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Builder Studio</h2>
        <span className="flex items-center gap-1 text-[10px] bg-green-500/15 text-green-700 border border-green-300 px-2 py-0.5 rounded-full font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> PROTOTYPE
        </span>
        <div className="flex-1" />
        <div role="tablist" aria-label="Studio mode" className="flex rounded-lg border border-border overflow-hidden">{[{ key: 'design', label: 'Visual editor', Icon: Brush }, { key: 'chat', label: 'AI assistant', Icon: MessageSquare }, { key: 'code', label: 'Code editor', Icon: Code2 }].map(({ key, label, Icon }) => <button key={key} role="tab" aria-selected={panel === key} disabled={project.source_mode === 'archive' && key !== 'code'} title={project.source_mode === 'archive' && key !== 'code' ? 'Imported applications use their original source UI. Edit files here and run the app locally to preview.' : undefined} onClick={() => changePanel(key)} className={'flex items-center gap-1.5 px-3 py-2 text-xs ' + (panel === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')}><Icon className="w-3 h-3" />{label}</button>)}</div>
        <button onClick={loadData} className="text-muted-foreground hover:text-foreground transition-colors" title="Refresh preview">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Split: chat | preview */}
      {panel === 'code' ? <div className="flex-1 min-h-0 overflow-hidden"><SourceEditor project={project} /></div> : <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        {panel === 'chat' && <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-border flex-shrink-0 h-72 md:h-auto bg-card/30 flex flex-col">
          <div className="flex border-b border-border flex-shrink-0">
            {[
              { key: 'chat', label: 'AI Chat', icon: MessageSquare },
              { key: 'design', label: 'Visual Editor', icon: Brush },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => changePanel(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 transition-colors ${
                  panel === key ? 'text-primary font-semibold border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            <StudioChat messages={messages} busy={busy} onSend={handleSend} />
          </div>
        </div>}
        <div className="flex-1 min-w-0 overflow-hidden bg-muted/20">
          <LivePreviewSection key={project.id} project={project} initialDesignMode={panel === 'design'} previewName={design.app_name || project.name} sidebarDark={design.sidebar_dark} />
        </div>
      </div>}
    </div>
  );
}
