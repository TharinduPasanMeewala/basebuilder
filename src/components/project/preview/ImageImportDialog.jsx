import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';
import { ImagePlus, Loader2, Sparkles, Database, Layout, Check } from 'lucide-react';

export default function ImageImportDialog({ open, onClose, project, onImported }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);

  const handleFile = (f) => {
    if (!f) return;
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setDone(false);
  };

  const analyze = async () => {
    setAnalyzing(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this UI screenshot/mockup of an application. Identify:
1. The pages/screens visible or implied (dashboard, lists, forms, etc.)
2. The data entities being managed, with their fields and types (string, number, boolean, date, enum)

Be specific — extract real field names from tables, forms, and labels visible in the image.`,
        file_urls: [file_url],
        response_json_schema: {
          type: 'object',
          properties: {
            app_purpose: { type: 'string' },
            pages: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { type: 'string', enum: ['dashboard', 'list', 'detail', 'form', 'report', 'settings', 'kanban', 'calendar', 'chart'] },
                  description: { type: 'string' },
                },
              },
            },
            entities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  description: { type: 'string' },
                  fields: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        name: { type: 'string' },
                        type: { type: 'string' },
                        required: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });
      setResult(res);
    } catch (e) {
      alert('Analysis failed: ' + e.message);
    }
    setAnalyzing(false);
  };

  const importAll = async () => {
    setImporting(true);
    try {
      if (result.entities?.length) {
        await base44.entities.DataEntity.bulkCreate(
          result.entities.map(e => ({
            project_id: project.id,
            name: e.name.replace(/[^a-zA-Z0-9 ]/g, ''),
            description: e.description || '',
            fields: e.fields || [],
            source: 'ai_generated',
          }))
        );
      }
      if (result.pages?.length) {
        await base44.entities.PageSpec.bulkCreate(
          result.pages.map(p => ({
            project_id: project.id,
            name: p.name,
            type: p.type || 'list',
            description: p.description || '',
            source: 'ai_generated',
          }))
        );
      }
      setDone(true);
      onImported?.();
    } catch (e) {
      alert('Import failed: ' + e.message);
    }
    setImporting(false);
  };

  const reset = () => {
    setFile(null); setPreviewUrl(null); setResult(null); setDone(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && reset()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <ImagePlus className="w-4 h-4 text-primary" /> Import from Screenshot
          </DialogTitle>
        </DialogHeader>

        {!previewUrl ? (
          <label className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors block">
            <input type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
            <ImagePlus className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Upload a UI screenshot or mockup</p>
            <p className="text-xs text-muted-foreground mt-1">AI will recognize pages, entities & fields automatically</p>
          </label>
        ) : (
          <div className="space-y-4">
            <img src={previewUrl} alt="screenshot" className="rounded-lg border border-border max-h-48 w-full object-contain bg-muted/30" />

            {!result && (
              <Button onClick={analyze} disabled={analyzing} className="w-full gap-2">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {analyzing ? 'Analyzing image…' : 'Analyze with AI'}
              </Button>
            )}

            {result && (
              <div className="space-y-3">
                {result.app_purpose && (
                  <p className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">{result.app_purpose}</p>
                )}
                <div>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                    <Database className="w-3.5 h-3.5 text-primary" /> Entities found ({result.entities?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(result.entities || []).map((e, i) => (
                      <span key={i} className="text-xs bg-green-500/10 text-green-700 border border-green-300/40 px-2 py-0.5 rounded-full">
                        {e.name} ({e.fields?.length || 0} fields)
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
                    <Layout className="w-3.5 h-3.5 text-primary" /> Pages found ({result.pages?.length || 0})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(result.pages || []).map((p, i) => (
                      <span key={i} className="text-xs bg-blue-500/10 text-blue-700 border border-blue-300/40 px-2 py-0.5 rounded-full">
                        {p.name}
                      </span>
                    ))}
                  </div>
                </div>

                {done ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-green-600 font-medium py-2">
                    <Check className="w-4 h-4" /> Added to project!
                  </div>
                ) : (
                  <Button onClick={importAll} disabled={importing} className="w-full gap-2">
                    {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {importing ? 'Importing…' : 'Add all to project'}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}