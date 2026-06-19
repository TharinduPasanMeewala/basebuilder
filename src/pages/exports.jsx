import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import SaraShell from '@/components/sara/SaraShell';
import PageHeader from '@/components/sara/PageHeader';
import EmptyState from '@/components/sara/EmptyState';
import { useSaraContext } from '@/components/sara/useSaraContext';
import { Button } from '@/components/ui/button';

export default function Exports() {
  const ctx = useSaraContext();
  const [busy, setBusy] = useState(false);
  const download = async () => {
    setBusy(true);
    const res = await base44.functions.invoke('saraExportProject', { projectId: ctx.selectedProject.id });
    const bytes = Uint8Array.from(atob(res.data.base64), c => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    const a = document.createElement('a'); a.href = url; a.download = res.data.fileName; a.click(); URL.revokeObjectURL(url);
    setBusy(false);
  };
  return <SaraShell><PageHeader eyebrow="Export & Deployment" title="Export as Base44 Project" description="Generate a clean ZIP with entities, functions, pages, and agents. The structure is local-AI-friendly and ready for future direct push integrations." action={<Button onClick={download} disabled={!ctx.selectedProject || busy}>{busy ? 'Generating ZIP…' : 'Export ZIP'}</Button>} />
    {!ctx.selectedProject ? <EmptyState title="Select a project" description="Choose a project to export its current app blueprint." /> : <div className="grid lg:grid-cols-3 gap-4"><div className="bg-card border border-border rounded-2xl p-5"><h3 className="font-bold">Base44 Project ZIP</h3><p className="text-sm text-muted-foreground mt-2">Includes /entities, /functions, /agents, and starter /pages.</p></div><div className="bg-card border border-border rounded-2xl p-5"><h3 className="font-bold">Push to Base44</h3><p className="text-sm text-muted-foreground mt-2">Prepared as a future integration once user project push APIs are available.</p></div><div className="bg-card border border-border rounded-2xl p-5"><h3 className="font-bold">Local AI Export</h3><p className="text-sm text-muted-foreground mt-2">Schemas and prompts stay structured for Ollama/WebLLM workflows later.</p></div></div>}
  </SaraShell>;
}