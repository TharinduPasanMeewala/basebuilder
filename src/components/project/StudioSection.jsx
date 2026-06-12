import React, { useState, useEffect } from 'react';
import { MonitorPlay, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import PreviewFrame from './preview/PreviewFrame';
import StudioChat from './studio/StudioChat';
import VisualEditor from './studio/VisualEditor';
import { MessageSquare, Brush } from 'lucide-react';

export default function StudioSection({ project, onRefresh }) {
  const [entities, setEntities] = useState([]);
  const [pages, setPages] = useState([]);
  const [design, setDesign] = useState({ app_name: '', primary: '#2563eb', sidebar_dark: true });
  const [designVersionId, setDesignVersionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [panel, setPanel] = useState('chat');

  useEffect(() => { loadData(); }, [project.id]);

  const loadData = async () => {
    setLoading(true);
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
    setLoading(false);
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
        newDesign = { ...newDesign, ...a.design };
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
    }
    return applied;
  };

  const handleSend = async (text, imageUrls = [], roundtable = false) => {
    setMessages(m => [...m, { role: 'user', content: text, images: imageUrls }]);
    setBusy(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        ...(imageUrls.length > 0 ? { file_urls: imageUrls } : {}),
        prompt: `You are an AI app editor for "${design.app_name || project.name}" (${project.type?.replace(/_/g, ' ')}).

YOU HAVE FULL PERMISSION to modify this app. You are NOT a support assistant — you are the editor itself. NEVER refuse, NEVER tell the user to contact technical support, and NEVER say you can't update the app. Every change request MUST be translated into one or more of the valid actions below.

Current data entities:
${entities.map(e => `- ${e.name}: ${(e.fields || []).map(f => f.name).join(', ') || 'no fields'}`).join('\n') || '(none)'}

Current pages:
${pages.map(p => `- ${p.name} (${p.type})`).join('\n') || '(none)'}

Current design: app_name="${design.app_name || project.name}", primary color=${design.primary}, sidebar=${design.sidebar_dark ? 'dark' : 'light'}

User request: "${text}"

Decide which actions to apply. Valid actions:
- create_entity: entity_name, description, fields [{name, type (string/number/boolean/date/enum), required}]
- update_entity: entity_name (existing), optional new_name, fields (full replacement list), description
- delete_entity: entity_name
- create_page: page_name, page_type (dashboard/list/detail/form/report/settings/kanban/calendar/chart), page_description
- delete_page: page_name
- set_design: design {app_name, primary (hex color), sidebar_dark (boolean)} — include only fields to change

Mapping rules — always act:
- "Add invoice functionality" / "fix the add button for X" → create_entity for X (with sensible fields) if it doesn't exist, plus a create_page (type "form" or "list") for it.
- Any feature request → model it as entities + pages that represent that feature.
- Only return an empty actions list for pure greetings or questions, never for change requests.

${imageUrls.length > 0 ? '\nThe user attached image(s). Analyze them carefully for UI and feature ideas — entities, fields, pages, colors, app name — and turn those ideas into actions.' : ''}${roundtable ? '\nAlso include a "roundtable" array with brief one-sentence expert comments about this change from relevant agents only (Business Analyst, DB Architect, UI/UX Architect, Backend Architect, QA Architect).' : ''}

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
                  design: { type: 'object', properties: { app_name: { type: 'string' }, primary: { type: 'string' }, sidebar_dark: { type: 'boolean' } } },
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
    } catch (e) {
      setMessages(m => [...m, { role: 'assistant', content: `Something went wrong: ${e.message}` }]);
    }
    setBusy(false);
  };

  const handleDesignChange = async (partial) => {
    const newDesign = { ...design, ...partial };
    setDesign(newDesign);
    await persistDesign(newDesign);
  };

  const handleAskDesigner = (prompt) => {
    setPanel('chat');
    handleSend(`As a professional UI/UX designer: ${prompt}`, [], true);
  };

  if (loading) {
    return <div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <MonitorPlay className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Studio — Live Edit</h2>
        <span className="flex items-center gap-1 text-[10px] bg-green-500/15 text-green-700 border border-green-300 px-2 py-0.5 rounded-full font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
        </span>
        <div className="flex-1" />
        <button onClick={loadData} className="text-muted-foreground hover:text-foreground transition-colors" title="Refresh preview">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Split: chat | preview */}
      <div className="flex flex-1 overflow-hidden flex-col md:flex-row">
        <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-border flex-shrink-0 h-72 md:h-auto bg-card/30 flex flex-col">
          <div className="flex border-b border-border flex-shrink-0">
            {[
              { key: 'chat', label: 'AI Chat', icon: MessageSquare },
              { key: 'design', label: 'Visual Editor', icon: Brush },
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPanel(key)}
                className={`flex-1 flex items-center justify-center gap-1.5 text-[11px] py-2 transition-colors ${
                  panel === key ? 'text-primary font-semibold border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3 h-3" /> {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            {panel === 'chat'
              ? <StudioChat messages={messages} busy={busy} onSend={handleSend} />
              : <VisualEditor design={design} onChange={handleDesignChange} onAskDesigner={handleAskDesigner} busy={busy} />}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-muted/20">
          <PreviewFrame
            project={project}
            entities={entities}
            pages={pages}
            design={design}
            editMode={false}
            onEditName={() => {}}
          />
        </div>
      </div>
    </div>
  );
}