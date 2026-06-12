import React, { useState, useEffect } from 'react';
import { History, Save, RotateCcw, Loader2, Trash2, Clock, FileText, Database, Layout, GitBranch, Code, Check, Github, Rocket, ExternalLink } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { generateCodeFiles } from '@/lib/codegen';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// Labels reserved for internal app state — hidden from version history
const RESERVED_LABELS = ['publish_state', 'design_state', 'dev_plan', 'deploy_plan'];

const SPEC_ENTITIES = [
  { key: 'requirements', entity: 'Requirement', label: 'Requirements', icon: FileText },
  { key: 'entities', entity: 'DataEntity', label: 'Entities', icon: Database },
  { key: 'pages', entity: 'PageSpec', label: 'Pages', icon: Layout },
  { key: 'workflows', entity: 'WorkflowSpec', label: 'Workflows', icon: GitBranch },
  { key: 'apis', entity: 'ApiEndpoint', label: 'APIs', icon: Code },
];

function stripRecord(r) {
  const { id, created_date, updated_date, created_by_id, created_by, ...rest } = r;
  return rest;
}

export default function VersionsSection({ project, onRefresh }) {
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showSave, setShowSave] = useState(false);
  const [label, setLabel] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [confirmRestore, setConfirmRestore] = useState(null);
  const [justRestored, setJustRestored] = useState(null);

  useEffect(() => { loadVersions(); }, [project.id]);

  const loadVersions = async () => {
    setLoading(true);
    const all = await base44.entities.ProjectVersion.filter({ project_id: project.id }, '-created_date', 100);
    setVersions(all.filter(v => !RESERVED_LABELS.includes(v.label)));
    setLoading(false);
  };

  const saveVersion = async () => {
    setSaving(true);
    const [reqs, ents, pgs, wfs, apis] = await Promise.all(
      SPEC_ENTITIES.map(s => base44.entities[s.entity].filter({ project_id: project.id }))
    );
    const snapshot = {
      project: { name: project.name, description: project.description, phase: project.phase, completeness_score: project.completeness_score },
      requirements: reqs.map(stripRecord),
      entities: ents.map(stripRecord),
      pages: pgs.map(stripRecord),
      workflows: wfs.map(stripRecord),
      apis: apis.map(stripRecord),
    };
    const maxNum = versions.reduce((m, v) => Math.max(m, v.version_number || 0), 0);
    await base44.entities.ProjectVersion.create({
      project_id: project.id,
      version_number: maxNum + 1,
      label: label || `Version ${maxNum + 1}`,
      notes,
      snapshot,
      phase: project.phase,
    });
    await base44.entities.Project.update(project.id, { version_count: maxNum + 1 });
    setShowSave(false);
    setLabel('');
    setNotes('');
    setSaving(false);
    loadVersions();
    onRefresh?.();
  };

  const restoreVersion = async (version) => {
    setRestoringId(version.id);
    setConfirmRestore(null);
    const snap = version.snapshot || {};

    // Delete all current spec records, then recreate from snapshot
    for (const s of SPEC_ENTITIES) {
      const current = await base44.entities[s.entity].filter({ project_id: project.id });
      await Promise.all(current.map(r => base44.entities[s.entity].delete(r.id)));
      const records = snap[s.key] || [];
      if (records.length > 0) {
        await base44.entities[s.entity].bulkCreate(
          records.map(r => ({ ...r, project_id: project.id }))
        );
      }
    }

    // Restore project phase/score
    if (snap.project) {
      await base44.entities.Project.update(project.id, {
        phase: snap.project.phase,
        completeness_score: snap.project.completeness_score || 0,
      });
    }

    setRestoringId(null);
    setJustRestored(version.id);
    setTimeout(() => setJustRestored(null), 3000);
    onRefresh?.();
  };

  const publishVersion = async (version) => {
    setPublishingId(version.id);
    try {
      const files = generateCodeFiles(project, version.snapshot || {});
      const res = await base44.functions.invoke('pushToGitHub', {
        projectName: project.name,
        files,
        isPrivate: false,
      });
      if (res.data?.repoUrl) {
        await base44.entities.ProjectVersion.update(version.id, {
          snapshot: { ...version.snapshot, github_url: res.data.repoUrl },
        });
        await loadVersions();
      }
    } catch (e) {
      alert('Publish failed: ' + (e.response?.data?.error || e.message));
    }
    setPublishingId(null);
  };

  const deleteVersion = async (id) => {
    if (!window.confirm('Delete this version permanently?')) return;
    await base44.entities.ProjectVersion.delete(id);
    loadVersions();
  };

  const countsOf = (snap) => SPEC_ENTITIES.map(s => ({ ...s, count: (snap?.[s.key] || []).length }));

  if (loading) {
    return <div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <History className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Version History</h2>
        <span className="text-xs text-muted-foreground">({versions.length})</span>
        <div className="flex-1" />
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={() => setShowSave(true)}>
          <Save className="w-3.5 h-3.5" /> Save Version
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {versions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <History className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground text-sm mb-1">No versions saved yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mb-4">
              Save a snapshot of your project before making big changes — you can restore it anytime if something breaks.
            </p>
            <Button size="sm" onClick={() => setShowSave(true)} className="gap-1.5">
              <Save className="w-3.5 h-3.5" /> Save First Version
            </Button>
          </div>
        ) : (
          <div className="relative pl-6 space-y-3">
            {/* Timeline line */}
            <div className="absolute left-2 top-2 bottom-2 w-px bg-border" />
            {versions.map((v) => (
              <div key={v.id} className="relative">
                <span className="absolute -left-[1.45rem] top-4 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">v{v.version_number}</span>
                        <h3 className="text-sm font-semibold text-foreground truncate">{v.label}</h3>
                        {justRestored === v.id && (
                          <span className="flex items-center gap-1 text-[10px] text-green-600 font-semibold"><Check className="w-3 h-3" /> Restored</span>
                        )}
                      </div>
                      {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(v.created_date).toLocaleString()}
                        {v.phase && <span className="ml-1 capitalize">· {v.phase} phase</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => setConfirmRestore(v)}
                        disabled={restoringId !== null || publishingId !== null}
                      >
                        {restoringId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                        {restoringId === v.id ? 'Restoring…' : 'Restore'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs gap-1.5"
                        onClick={() => publishVersion(v)}
                        disabled={restoringId !== null || publishingId !== null}
                      >
                        {publishingId === v.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Rocket className="w-3.5 h-3.5" />}
                        {publishingId === v.id ? 'Publishing…' : v.snapshot?.github_url ? 'Re-publish' : 'Publish'}
                      </Button>
                      <button
                        onClick={() => deleteVersion(v.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1"
                        disabled={restoringId !== null || publishingId !== null}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {countsOf(v.snapshot).map(({ key, label: l, icon: Icon, count }) => (
                      <span key={key} className="flex items-center gap-1 text-[10px] bg-muted border border-border px-2 py-0.5 rounded-full text-muted-foreground">
                        <Icon className="w-3 h-3" /> {count} {l}
                      </span>
                    ))}
                  </div>
                  {v.snapshot?.github_url && (
                    <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-border">
                      <a href={v.snapshot.github_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-[11px] text-primary hover:underline font-medium">
                        <Github className="w-3.5 h-3.5" /> GitHub Repo <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <a href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(v.snapshot.github_url)}`} target="_blank" rel="noreferrer">
                        <img src="https://vercel.com/button" alt="Deploy with Vercel" className="h-6" />
                      </a>
                      <a href={`https://app.netlify.com/start/deploy?repository=${encodeURIComponent(v.snapshot.github_url)}`} target="_blank" rel="noreferrer">
                        <img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify" className="h-6" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save dialog */}
      <Dialog open={showSave} onOpenChange={setShowSave}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Save className="w-4 h-4 text-primary" /> Save Project Version
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Version label</label>
              <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Before adding inventory module" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1 block">Notes (optional)</label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="What's in this version?" rows={3} />
            </div>
            <p className="text-[11px] text-muted-foreground bg-muted/40 rounded-lg p-2.5">
              Saves a full snapshot: requirements, data model, pages, workflows and APIs.
            </p>
            <Button onClick={saveVersion} disabled={saving} className="w-full gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving snapshot…' : 'Save Version'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore confirm dialog */}
      <Dialog open={!!confirmRestore} onOpenChange={v => !v && setConfirmRestore(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <RotateCcw className="w-4 h-4 text-destructive" /> Restore "{confirmRestore?.label}"?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This will <strong className="text-foreground">replace all current</strong> requirements, entities, pages, workflows and APIs with the snapshot from v{confirmRestore?.version_number}. Consider saving the current state as a version first.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmRestore(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1 gap-1.5" onClick={() => restoreVersion(confirmRestore)}>
              <RotateCcw className="w-3.5 h-3.5" /> Restore
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}