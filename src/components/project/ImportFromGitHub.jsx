import React, { useState } from 'react';
import { Github, ArrowRight, Loader2, AlertCircle, Star, FileCode, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useNavigate } from 'react-router-dom';

export default function ImportFromGitHub({ open, onClose }) {
  const navigate = useNavigate();
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [repoData, setRepoData] = useState(null);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleFetch = async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError('');
    setRepoData(null);
    try {
      const res = await base44.functions.invoke('importFromGitHub', { repoUrl: repoUrl.trim() });
      if (res.data?.error) throw new Error(res.data.error);
      setRepoData(res.data);
    } catch (e) {
      setError(e.message || 'Failed to fetch repository');
    }
    setLoading(false);
  };

  const handleImport = async () => {
    if (!repoData) return;
    setCreating(true);
    const description = [
      repoData.description,
      repoData.techHints.length ? `Tech: ${repoData.techHints.join(', ')}` : '',
      repoData.topics.length ? `Topics: ${repoData.topics.join(', ')}` : '',
      repoData.readme ? `\n\nREADME:\n${repoData.readme.slice(0, 500)}` : '',
    ].filter(Boolean).join('\n');

    const project = await base44.entities.Project.create({
      name: repoData.name,
      description: description.slice(0, 1000),
      type: 'custom_application',
      phase: 'discovery',
      status: 'active',
      completeness_score: 0,
      version_count: 1,
    });
    navigate(`/projects/${project.id}`);
  };

  const handleClose = () => {
    setRepoUrl('');
    setRepoData(null);
    setError('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Github className="w-5 h-5" /> Import from GitHub
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter a public GitHub repository URL to analyze it and create a project based on its structure.
          </p>

          <div className="flex gap-2">
            <Input
              placeholder="https://github.com/owner/repo"
              value={repoUrl}
              onChange={e => setRepoUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFetch()}
              className="flex-1 font-mono text-sm"
            />
            <Button onClick={handleFetch} disabled={loading || !repoUrl.trim()} className="gap-1.5 flex-shrink-0">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {loading ? 'Fetching…' : 'Fetch'}
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {repoData && (
            <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3 animate-fade-in">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-foreground text-sm">{repoData.fullName}</p>
                    {repoData.language && (
                      <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">{repoData.language}</span>
                    )}
                  </div>
                  {repoData.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{repoData.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                  <Star className="w-3.5 h-3.5" /> {repoData.stars.toLocaleString()}
                </div>
              </div>

              {repoData.techHints.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {repoData.techHints.map(t => (
                    <span key={t} className="text-[10px] bg-background border border-border px-2 py-0.5 rounded-full text-muted-foreground">{t}</span>
                  ))}
                </div>
              )}

              {repoData.topics.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {repoData.topics.slice(0, 8).map(t => (
                    <span key={t} className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full">{t}</span>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileCode className="w-3.5 h-3.5" />
                <span>{repoData.fileTree.length} files detected</span>
              </div>

              <Button className="w-full gap-2 mt-1" onClick={handleImport} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Github className="w-4 h-4" />}
                {creating ? 'Creating project…' : 'Import as New Project'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}