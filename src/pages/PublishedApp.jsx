import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Globe, ArrowLeft, Database, Layout, Code, GitBranch, FileText, ExternalLink, Copy, Check, ChevronDown, ChevronRight, Terminal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';

export default function PublishedApp() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [publishState, setPublishState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCode, setExpandedCode] = useState({});
  const [copied, setCopied] = useState(null);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [projects, versions] = await Promise.all([
      base44.entities.Project.filter({ id }),
      base44.entities.ProjectVersion.filter({ project_id: id, label: 'publish_state' }, '-created_date', 1),
    ]);
    if (projects[0]) setProject(projects[0]);
    if (versions[0]) setPublishState(versions[0].snapshot);
    setLoading(false);
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleCode = (key) => setExpandedCode(e => ({ ...e, [key]: !e[key] }));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!project || !publishState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <Globe className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-xl font-bold text-foreground">App not published yet</h1>
        <p className="text-muted-foreground text-sm">Go back to the project workspace and click "Build & Publish".</p>
        <Button onClick={() => navigate(`/projects/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Workspace
        </Button>
      </div>
    );
  }

  const stats = [
    { icon: FileText, label: 'Requirements', value: publishState.entities },
    { icon: Database, label: 'Entities', value: publishState.entities },
    { icon: Layout, label: 'Pages', value: publishState.pages },
    { icon: Code, label: 'APIs', value: publishState.apis },
    { icon: GitBranch, label: 'Workflows', value: publishState.workflows },
  ];

  const codeToShow = publishState.code;

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(`/projects/${id}`)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-500/15 rounded-lg flex items-center justify-center">
              <Globe className="w-4 h-4 text-green-600" />
            </div>
            <span className="font-bold text-sm text-foreground">{project.name}</span>
            <span className="flex items-center gap-1 text-[10px] bg-green-500/15 text-green-700 border border-green-300 px-2 py-0.5 rounded-full font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> LIVE
            </span>
          </div>
          <span className="ml-auto text-xs text-muted-foreground hidden sm:block">
            Published {new Date(publishState.published_at).toLocaleDateString()}
          </span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Hero */}
        <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border border-green-400/30 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 bg-green-500/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Globe className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">{project.name}</h1>
          {project.description && (
            <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-4">{project.description}</p>
          )}
          {publishState.tech_stack && (
            <div className="flex flex-wrap gap-2 justify-center">
              {Object.values(publishState.tech_stack).map((t, i) => (
                <span key={i} className="text-xs bg-background/70 border border-border px-3 py-1 rounded-full text-muted-foreground">{t}</span>
              ))}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {stats.map(({ icon: Icon, label, value }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
              <Icon className="w-5 h-5 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold text-foreground">{value ?? 0}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>

        {/* Generated Codebase */}
        {codeToShow && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Generated Codebase</p>
              <span className="text-xs text-muted-foreground ml-auto">Click to expand files</span>
            </div>
            <div className="divide-y divide-border">
              {Object.entries(codeToShow).map(([section, files]) => (
                <div key={section}>
                  <div className="px-5 py-2.5 bg-muted/10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{section}</p>
                  </div>
                  {Object.entries(files).map(([filename, content]) => {
                    const key = `${section}/${filename}`;
                    const isExpanded = expandedCode[key];
                    return (
                      <div key={filename} className="border-t border-border/50">
                        <button
                          onClick={() => toggleCode(key)}
                          className="w-full flex items-center gap-2 px-5 py-3 hover:bg-muted/20 transition-colors text-left"
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                          <code className="text-xs font-mono text-foreground flex-1">{filename}</code>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{content?.length || 0} chars</span>
                        </button>
                        {isExpanded && (
                          <div className="relative bg-muted/10">
                            <button
                              onClick={() => copyText(content, key)}
                              className="absolute top-2 right-4 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground z-10"
                            >
                              {copied === key ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
                              {copied === key ? 'Copied' : 'Copy'}
                            </button>
                            <pre className="px-5 py-3 text-[11px] font-mono text-muted-foreground overflow-x-auto max-h-72 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                              {content}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}