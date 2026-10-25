import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Loader2, RefreshCw, FileCode, CheckCircle2, ArrowRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { generateCodeFiles } from '@/lib/codegen';
import { codeFromFiles, filesFromCode } from '@/lib/hosting';
import FinalAppPreview from './final-preview/FinalAppPreview';
import HostingSection from './HostingSection';

export default function PublishSection({ project, onRefresh }) {
  const navigate = useNavigate();
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [stage, setStage] = useState('');
  useEffect(() => {
    let active = true;
    base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'publish_state' }, '-updated_date', 1)
      .then(items => active && setRecord(items[0] || null)).catch(err => active && setError(err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [project.id]);
  const generate = async () => {
    if (record?.snapshot?.code && !window.confirm('Regenerate source from your current project specifications? Your current package will be backed up; manual edits will be replaced in the new package.')) return;
    setBusy(true); setError('');
    try {
      setStage('Reading your data models, pages and design…');
      const [entities, pages, requirements, workflows, apis, designs] = await Promise.all([
        base44.entities.DataEntity.filter({ project_id: project.id }), base44.entities.PageSpec.filter({ project_id: project.id }),
        base44.entities.Requirement.filter({ project_id: project.id }), base44.entities.WorkflowSpec.filter({ project_id: project.id }),
        base44.entities.ApiEndpoint.filter({ project_id: project.id }), base44.entities.ProjectDesign.filter({ project_id: project.id }, '-updated_date', 1),
      ]);
      setStage('Generating React source and hosting configuration…');
      const files = generateCodeFiles(project, { entities, pages, requirements, design: designs[0] || {} });
      if (record?.snapshot?.code) {
        await base44.entities.ProjectVersion.create({ project_id: project.id, label: 'source_backup', version_number: Date.now(), notes: 'Source package before regeneration', snapshot: record.snapshot });
      }
      const snapshot = {
        status: 'generated', published_at: new Date().toISOString(), url: window.location.origin + '/projects/' + project.id + '/published',
        entities: entities.length, pages: pages.length, apis: apis.length, workflows: workflows.length,
        tech_stack: { frontend: 'React + Vite', data: 'Browser-local storage', hosting: 'Localhost / Docker / custom domain' },
        code: codeFromFiles(files),
      };
      setStage('Saving source package…');
      const result = record?.id ? await base44.entities.ProjectVersion.update(record.id, { snapshot, notes: 'Generated frontend and hosting package' })
        : await base44.entities.ProjectVersion.create({ project_id: project.id, label: 'publish_state', version_number: 1, notes: 'Generated frontend and hosting package', snapshot, phase: project.phase });
      setRecord(result); setStage('Package saved.'); onRefresh?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  if (loading) return <div className="p-8 flex gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" />Loading code package…</div>;
  return <div className="flex flex-col flex-1 min-w-0 overflow-hidden h-full">
    <div className="flex flex-wrap gap-2 items-center px-4 py-3 border-b border-border bg-card">
      <Package className="w-4 h-4 text-primary" /><h2 className="text-sm font-semibold">Code package</h2>
      {record?.snapshot?.code && <span className="text-xs text-muted-foreground">{filesFromCode(record.snapshot.code).length} source files</span>}
      <div className="flex-1" />
      {record?.snapshot?.code && <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate('/projects/' + project.id + '?section=studio&mode=code')}><FileCode className="w-3.5 h-3.5" />Edit source</Button>}
      <Button size="sm" disabled={busy} className="gap-1.5" onClick={generate}>{busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}{busy ? 'Generating…' : record ? 'Regenerate package' : 'Generate package'}</Button>
    </div>
    <div className="flex-1 overflow-y-auto p-4 space-y-5">
      {error && <p role="alert" className="text-sm text-destructive rounded-xl border border-destructive/20 p-4">{error}</p>}
      {stage && <p role="status" className="text-sm flex gap-2 items-center">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}{stage}</p>}
      {!record?.snapshot?.code ? <div className="rounded-2xl border border-dashed border-border p-10 text-center space-y-3"><Package className="w-10 h-10 mx-auto text-primary" /><h3 className="font-semibold text-lg">Turn your project into runnable source</h3><p className="text-sm text-muted-foreground max-w-xl mx-auto">Generate a React frontend with working browser-local record screens, then refine its source in Studio or download a hosting package.</p><Button disabled={busy} onClick={generate} className="gap-2">Generate source package<ArrowRight className="w-4 h-4" /></Button></div>
      : <FinalAppPreview project={project} publishState={record.snapshot} onSaved={snapshot => setRecord(previous => ({ ...previous, snapshot }))} />}
      <HostingSection project={project} />
    </div>
  </div>;
}
