import React, { useEffect, useState } from 'react';
import { Download, Globe, Monitor, Loader2, CheckCircle2, Copy, Terminal, Package } from 'lucide-react';
import JSZip from 'jszip';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { generateCodeFiles } from '@/lib/codegen';
import { normalizeDomain, filesFromCode, withHostingFiles } from '@/lib/hosting';

export default function HostingSection({ project }) {
  const [target, setTarget] = useState('local');
  const [domain, setDomain] = useState('');
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    let active = true;
    base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'hosting_settings' }, '-updated_date', 1)
      .then(items => { if (active && items[0]) { setRecord(items[0]); setDomain(items[0].snapshot?.domain || ''); setTarget(items[0].snapshot?.target || 'local'); } })
      .catch(err => active && setError(err.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [project.id]);
  const download = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const host = normalizeDomain(domain);
      if (target === 'domain' && !host) throw new Error('Enter a domain you control.');
      const [published, entities, pages, designs, requirements] = await Promise.all([
        base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'publish_state' }, '-updated_date', 1),
        base44.entities.DataEntity.filter({ project_id: project.id }),
        base44.entities.PageSpec.filter({ project_id: project.id }),
        base44.entities.ProjectDesign.filter({ project_id: project.id }, '-updated_date', 1),
        base44.entities.Requirement.filter({ project_id: project.id }),
      ]);
      const source = published[0]?.snapshot?.code ? filesFromCode(published[0].snapshot.code)
        : generateCodeFiles(project, { entities, pages, design: designs[0] || {}, requirements });
      const files = withHostingFiles(source, project, { domain: host, target });
      const zip = new JSZip();
      const slug = (project.name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'app';
      const root = zip.folder(slug);
      files.forEach(file => root.file(file.path, file.content));
      const blob = await zip.generateAsync({ type: 'blob' });
      const snapshot = { target, domain: host, last_prepared_at: new Date().toISOString(), status: 'package_ready' };
      const saved = record?.id ? await base44.entities.ProjectVersion.update(record.id, { snapshot })
        : await base44.entities.ProjectVersion.create({ project_id: project.id, label: 'hosting_settings', version_number: 1, notes: 'Local and custom domain hosting settings', snapshot });
      setRecord(saved);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url; anchor.download = slug + '-' + target + '.zip'; anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice('Hosting package prepared. Follow HOSTING.md inside the ZIP to run it.');
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  const copy = async text => {
    try { await navigator.clipboard.writeText(text); setNotice('Commands copied.'); }
    catch { setError('Could not access the clipboard. Select and copy the commands below.'); }
  };
  const commands = target === 'domain' ? 'docker compose --profile domain up --build -d'
    : target === 'static' ? 'npm install\nnpm run build' : 'npm install\nnpm run build\nnpm start';
  return <section className="rounded-2xl border border-primary/20 bg-card overflow-hidden">
    <div className="p-5 sm:p-6 border-b border-border bg-gradient-to-br from-primary/10 to-transparent">
      <div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest"><Package className="w-4 h-4" />Hosting package</div>
      <h2 className="text-xl font-bold mt-2">Build here. Run where you choose.</h2><p className="text-sm text-muted-foreground mt-2 max-w-2xl">Download your generated app for localhost, a server with your domain, or static hosting.</p>
    </div>
    <div className="p-5 sm:p-6 space-y-5">
      <div className="grid sm:grid-cols-3 gap-3">{[
        { id: 'local', label: 'Localhost', description: 'Run on your computer', Icon: Monitor },
        { id: 'domain', label: 'Custom domain', description: 'Docker + automatic HTTPS', Icon: Globe },
        { id: 'static', label: 'Static hosting', description: 'Vercel, Netlify, or your server', Icon: Package },
      ].map(({ id, label, description, Icon }) => <button key={id} aria-pressed={target === id} disabled={busy} onClick={() => { setTarget(id); setError(''); }} className={'rounded-xl p-4 border text-left transition-colors ' + (target === id ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/40')}><Icon className="w-5 h-5 text-primary mb-3" /><p className="text-sm font-semibold">{label}</p><p className="text-xs text-muted-foreground mt-1">{description}</p></button>)}</div>
      {target === 'domain' && <div className="space-y-3"><label className="block text-xs font-medium">Your domain<Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="app.yourcompany.com" className="mt-1.5 max-w-lg" /></label><div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground space-y-2"><p>1. Point this domain’s DNS A record to your server’s public IPv4 address.</p><p>2. Open ports 80 and 443, install Docker, and extract the package on that server.</p><p>3. Run the command below. Caddy requests the HTTPS certificate after DNS resolves.</p><p>DNS and certificate status must be checked on your server. Preparing a ZIP does not connect or publish the domain.</p></div></div>}
      <div className="rounded-xl bg-slate-950 text-slate-100 overflow-hidden"><div className="flex items-center gap-2 px-4 py-2 border-b border-white/10 text-xs text-slate-400"><Terminal className="w-3.5 h-3.5" />Run inside the extracted project<Button size="sm" variant="ghost" className="ml-auto h-6 text-slate-300" onClick={() => copy(commands)}><Copy className="w-3 h-3 mr-1" />Copy</Button></div><pre className="p-4 text-xs overflow-auto leading-relaxed">{commands}</pre></div>
      <div className="text-xs text-muted-foreground leading-relaxed rounded-xl border border-border p-4"><p className="font-semibold text-foreground mb-1">What’s included</p>Runnable Vite + React source, a production web server with deep-link routing, Docker files, domain HTTPS configuration, and static-host rewrites. Generated record screens use browser-local storage. Shared databases, user accounts, cloud integrations and workflow execution require a configured backend.</div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm flex gap-2 items-center"><CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />{notice}</p>}
      <div className="flex flex-wrap gap-3 items-center"><Button onClick={download} disabled={busy || loading} className="gap-2">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{busy ? 'Preparing package…' : 'Download hosting package'}</Button>{record?.snapshot?.last_prepared_at && <span className="text-xs text-muted-foreground">Last prepared {new Date(record.snapshot.last_prepared_at).toLocaleString()}</span>}</div>
    </div>
  </section>;
}
