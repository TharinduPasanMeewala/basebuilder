import React, { useState, useEffect } from 'react';
import { Eye, Pencil, Check, Copy, ExternalLink, ImagePlus, Loader2, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PreviewFrame from './preview/PreviewFrame';
import ImageImportDialog from './preview/ImageImportDialog';

const COLORS = ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#ea580c', '#0891b2', '#db2777', '#4f46e5'];

export default function PreviewSection({ project, onRefresh }) {
  const [entities, setEntities] = useState([]);
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [design, setDesign] = useState({ app_name: '', primary: '#2563eb', sidebar_dark: true });
  const [designVersionId, setDesignVersionId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showImageImport, setShowImageImport] = useState(false);

  const publishUrl = `${window.location.origin}/projects/${project.id}/published`;

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
      setDesign({ app_name: '', primary: '#2563eb', sidebar_dark: true, ...designs[0].snapshot });
      setDesignVersionId(designs[0].id);
    }
    setLoading(false);
  };

  const saveDesign = async () => {
    setSaving(true);
    if (designVersionId) {
      await base44.entities.ProjectVersion.update(designVersionId, { snapshot: design });
    } else {
      const created = await base44.entities.ProjectVersion.create({
        project_id: project.id,
        version_number: 1,
        label: 'design_state',
        notes: 'Visual design settings',
        snapshot: design,
      });
      setDesignVersionId(created.id);
    }
    setSaving(false);
    setEditMode(false);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(publishUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0 flex-wrap">
        <Eye className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">App Preview</h2>
        <div className="flex-1" />
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setShowImageImport(true)}>
          <ImagePlus className="w-3.5 h-3.5" /> Import from Screenshot
        </Button>
        {editMode ? (
          <Button size="sm" className="h-7 text-xs gap-1.5" onClick={saveDesign} disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Save Design
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setEditMode(true)}>
            <Pencil className="w-3.5 h-3.5" /> Visual Edit
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Publish URL bar */}
        <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-2.5">
          <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0 animate-pulse" />
          <span className="text-xs font-mono text-muted-foreground truncate flex-1">{publishUrl}</span>
          <button onClick={copyUrl} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <a href={publishUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline flex-shrink-0">
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
        </div>

        {/* Visual edit toolbar */}
        {editMode && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">Brand color:</span>
              <div className="flex gap-1.5">
                {COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setDesign(d => ({ ...d, primary: c }))}
                    className={`w-6 h-6 rounded-full transition-transform ${design.primary === c ? 'ring-2 ring-offset-2 ring-foreground scale-110' : 'hover:scale-110'}`}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-foreground">Sidebar:</span>
              <button
                onClick={() => setDesign(d => ({ ...d, sidebar_dark: true }))}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${design.sidebar_dark ? 'bg-gray-900 text-white border-gray-900' : 'bg-background text-muted-foreground border-border'}`}
              >Dark</button>
              <button
                onClick={() => setDesign(d => ({ ...d, sidebar_dark: false }))}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${!design.sidebar_dark ? 'bg-white text-gray-900 border-gray-400 font-medium' : 'bg-background text-muted-foreground border-border'}`}
              >Light</button>
            </div>
            <span className="text-[11px] text-muted-foreground ml-auto">💡 Click the app name in the sidebar to rename it</span>
          </div>
        )}

        {/* Live preview frame */}
        {entities.length === 0 && pages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-border rounded-xl">
            <Eye className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <h3 className="font-semibold text-foreground text-sm mb-1">Nothing to preview yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">Define data entities and pages first — or import them instantly from a screenshot.</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowImageImport(true)}>
              <ImagePlus className="w-3.5 h-3.5" /> Import from Screenshot
            </Button>
          </div>
        ) : (
          <PreviewFrame
            project={project}
            entities={entities}
            pages={pages}
            design={design}
            editMode={editMode}
            onEditName={(name) => setDesign(d => ({ ...d, app_name: name }))}
          />
        )}
      </div>

      <ImageImportDialog
        open={showImageImport}
        onClose={() => setShowImageImport(false)}
        project={project}
        onImported={() => { loadData(); onRefresh?.(); }}
      />
    </div>
  );
}