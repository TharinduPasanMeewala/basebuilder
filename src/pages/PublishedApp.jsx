import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  Package, ArrowLeft, Copy, Check, ChevronDown, ChevronRight,
  Terminal, Info, Download, FileCode, FileJson, FileCog, File,
  FolderOpen, ExternalLink, Github
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import JSZip from 'jszip';

// Map filenames to a language label for the preview header
function getFileLanguage(filename) {
  if (filename.endsWith('.json')) return 'JSON';
  if (filename.endsWith('.jsx') || filename.endsWith('.js')) return 'JavaScript';
  if (filename.endsWith('.css')) return 'CSS';
  if (filename.endsWith('.html')) return 'HTML';
  if (filename.endsWith('.sql')) return 'SQL';
  if (filename.endsWith('.env') || filename.endsWith('.example')) return 'ENV';
  if (filename.endsWith('.md')) return 'Markdown';
  return 'Code';
}

function getFileIcon(filename) {
  if (filename.endsWith('.json')) return FileJson;
  if (filename.endsWith('.jsx') || filename.endsWith('.js')) return FileCode;
  if (filename.endsWith('.css') || filename.endsWith('.html')) return FileCog;
  return File;
}

// Section folder → real path prefix for zip
const SECTION_PATHS = {
  '⚙️ config': '',
  '🎨 frontend/src': 'src/',
  '🔧 backend/server': 'server/',
  '🗄️ database': 'database/',
};

// Config files to auto-expand with a nice preview
const CONFIG_FILES = ['vite.config.js', 'tailwind.config.js', 'package.json', '.env.example'];

export default function PublishedApp() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [publishState, setPublishState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedCode, setExpandedCode] = useState({});
  const [copied, setCopied] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [uploadingDrive, setUploadingDrive] = useState(false);
  const [driveUrl, setDriveUrl] = useState(null);
  const [pushingGitHub, setPushingGitHub] = useState(false);
  const [githubUrl, setGithubUrl] = useState(null);

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    const [projects, versions] = await Promise.all([
      base44.entities.Project.filter({ id }),
      base44.entities.ProjectVersion.filter({ project_id: id, label: 'publish_state' }, '-created_date', 1),
    ]);
    if (projects[0]) setProject(projects[0]);
    if (versions[0]) {
      const snap = versions[0].snapshot;
      setPublishState(snap);
      // Auto-expand config files
      if (snap?.code) {
        const auto = {};
        Object.entries(snap.code).forEach(([section, files]) => {
          Object.keys(files).forEach(filename => {
            if (CONFIG_FILES.includes(filename)) auto[`${section}/${filename}`] = true;
          });
        });
        setExpandedCode(auto);
      }
      if (snap?.drive_url) setDriveUrl(snap.drive_url);
      if (snap?.github_url) setGithubUrl(snap.github_url);
    }
    setLoading(false);
  };

  const copyText = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleCode = (key) => setExpandedCode(e => ({ ...e, [key]: !e[key] }));

  const downloadZip = async () => {
    if (!codeToShow) return;
    setDownloading(true);
    const zip = new JSZip();
    const projectSlug = project.name.replace(/\s+/g, '-').toLowerCase();
    const root = zip.folder(projectSlug);

    Object.entries(codeToShow).forEach(([section, files]) => {
      const pathPrefix = SECTION_PATHS[section] ?? `${section}/`;
      Object.entries(files).forEach(([filename, content]) => {
        const fullPath = pathPrefix + filename;
        // Create nested folders as needed
        const parts = fullPath.split('/');
        if (parts.length > 1) {
          const dir = parts.slice(0, -1).join('/');
          root.folder(dir);
        }
        root.file(fullPath, content || '');
      });
    });

    // Add a README
    root.file('README.md', `# ${project.name}\n\n${project.description || ''}\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Deploy\n\nDeploy to Vercel, Netlify, or Railway.\n`);

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectSlug}.zip`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloading(false);
  };

  const pushToGitHub = async () => {
    if (!codeToShow) return;
    setPushingGitHub(true);
    try {
      const files = [];
      Object.entries(codeToShow).forEach(([section, sectionFiles]) => {
        const pathPrefix = SECTION_PATHS[section] ?? `${section}/`;
        Object.entries(sectionFiles).forEach(([filename, content]) => {
          files.push({ path: pathPrefix + filename, content: content || '' });
        });
      });
      // Add README
      files.push({ path: 'README.md', content: `# ${project.name}\n\n${project.description || ''}\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` });

      const res = await base44.functions.invoke('pushToGitHub', {
        projectName: project.name,
        files,
        isPrivate: false,
      });
      if (res.data?.repoUrl) {
        setGithubUrl(res.data.repoUrl);
        // Persist github URL
        const versions = await base44.entities.ProjectVersion.filter(
          { project_id: id, label: 'publish_state' }, '-created_date', 1
        );
        if (versions[0]) {
          await base44.entities.ProjectVersion.update(versions[0].id, {
            snapshot: { ...publishState, github_url: res.data.repoUrl }
          });
        }
      }
    } catch (e) {
      alert('GitHub push failed: ' + e.message);
    }
    setPushingGitHub(false);
  };

  const uploadToDrive = async () => {
    if (!codeToShow) return;
    setUploadingDrive(true);
    try {
      const files = [];
      Object.entries(codeToShow).forEach(([section, sectionFiles]) => {
        const pathPrefix = SECTION_PATHS[section] ?? `${section}/`;
        Object.entries(sectionFiles).forEach(([filename, content]) => {
          files.push({ path: pathPrefix + filename, content: content || '' });
        });
      });
      const res = await base44.functions.invoke('uploadToDrive', {
        projectName: project.name,
        files,
      });
      if (res.data?.folderUrl) {
        setDriveUrl(res.data.folderUrl);
        // Persist drive URL in snapshot
        const versions = await base44.entities.ProjectVersion.filter(
          { project_id: id, label: 'publish_state' }, '-created_date', 1
        );
        if (versions[0]) {
          await base44.entities.ProjectVersion.update(versions[0].id, {
            snapshot: { ...publishState, drive_url: res.data.folderUrl }
          });
        }
      }
    } catch (e) {
      alert('Drive upload failed: ' + e.message);
    }
    setUploadingDrive(false);
  };

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
        <Package className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-xl font-bold text-foreground">Code not generated yet</h1>
        <p className="text-muted-foreground text-sm">Go back to the project workspace and click "Generate Code".</p>
        <Button onClick={() => navigate(`/projects/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Workspace
        </Button>
      </div>
    );
  }

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
            <div className="w-7 h-7 bg-primary/15 rounded-lg flex items-center justify-center">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <span className="font-bold text-sm text-foreground">{project.name}</span>
            <span className="text-[10px] bg-blue-500/15 text-blue-700 border border-blue-300 px-2 py-0.5 rounded-full font-semibold">
              📦 CODE PACKAGE
            </span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {driveUrl && (
              <a href={driveUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5" /> View in Drive
                </Button>
              </a>
            )}
            {githubUrl && (
              <a href={githubUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5">
                  <Github className="w-3.5 h-3.5" /> GitHub
                </Button>
              </a>
            )}
            <span className="text-xs text-muted-foreground hidden sm:block">
              Generated {new Date(publishState.published_at).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Hero */}
        <div className="bg-gradient-to-br from-primary/8 to-primary/3 border border-primary/20 rounded-2xl p-6 text-center">
          <div className="w-16 h-16 bg-primary/15 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Package className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1">{project.name}</h1>
          <p className="text-xs text-blue-600 font-semibold mb-3">📦 Generated Code Package</p>
          {project.description && (
            <p className="text-sm text-muted-foreground max-w-lg mx-auto mb-4">{project.description}</p>
          )}
          {publishState.tech_stack && (
            <div className="flex flex-wrap gap-2 justify-center mb-4">
              {Object.values(publishState.tech_stack).map((t, i) => (
                <span key={i} className="text-xs bg-background/70 border border-border px-3 py-1 rounded-full text-muted-foreground">{t}</span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 justify-center mb-4">
            <Button onClick={downloadZip} disabled={downloading} className="gap-2">
              <Download className="w-4 h-4" />
              {downloading ? 'Preparing ZIP…' : 'Download ZIP'}
            </Button>
            <Button variant="outline" onClick={uploadToDrive} disabled={uploadingDrive} className="gap-2">
              <FolderOpen className="w-4 h-4" />
              {uploadingDrive ? 'Uploading…' : driveUrl ? 'Re-upload to Drive' : 'Save to Google Drive'}
            </Button>
            <Button variant="outline" onClick={pushToGitHub} disabled={pushingGitHub} className="gap-2">
              <Github className="w-4 h-4" />
              {pushingGitHub ? 'Pushing…' : githubUrl ? 'Re-push to GitHub' : 'Push to GitHub'}
            </Button>
          </div>

          {/* Deploy buttons — shown once GitHub repo exists */}
          {githubUrl && (
            <div className="flex flex-wrap gap-3 justify-center mb-3">
              <a
                href={`https://vercel.com/new/clone?repository-url=${encodeURIComponent(githubUrl)}`}
                target="_blank"
                rel="noreferrer"
              >
                <img src="https://vercel.com/button" alt="Deploy with Vercel" className="h-8" />
              </a>
              <a
                href={`https://app.netlify.com/start/deploy?repository=${encodeURIComponent(githubUrl)}`}
                target="_blank"
                rel="noreferrer"
              >
                <img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify" className="h-8" />
              </a>
            </div>
          )}

          {!githubUrl && (
            <p className="text-xs text-muted-foreground mb-3">
              Push to GitHub first to unlock one-click deploy to Vercel & Netlify.
            </p>
          )}

          {driveUrl && (
            <a href={driveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
              <ExternalLink className="w-3 h-3" /> Open folder in Google Drive
            </a>
          )}
          {githubUrl && (
            <a href={githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline ml-4">
              <Github className="w-3 h-3" /> View repository on GitHub
            </a>
          )}

          <div className="bg-blue-500/10 border border-blue-200 rounded-xl p-3 text-left max-w-lg mx-auto mt-4">
            <p className="text-xs font-semibold text-blue-800 mb-1 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> How to run this app</p>
            <ol className="text-xs text-blue-700 space-y-0.5 list-decimal list-inside">
              <li>Download ZIP and extract into a local folder</li>
              <li>Run <code className="font-mono bg-blue-100 px-1 rounded">npm install</code></li>
              <li>Run <code className="font-mono bg-blue-100 px-1 rounded">npm run dev</code> to preview locally</li>
              <li>Deploy to <strong>Vercel</strong>, <strong>Netlify</strong>, or your own domain</li>
            </ol>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Entities', value: publishState.entities },
            { label: 'Pages', value: publishState.pages },
            { label: 'APIs', value: publishState.apis },
            { label: 'Workflows', value: publishState.workflows },
          ].map(({ label, value }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
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
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-muted-foreground hidden sm:block">Config files auto-expanded</span>
                <Button size="sm" className="h-7 text-xs gap-1.5" onClick={downloadZip} disabled={downloading}>
                  <Download className="w-3.5 h-3.5" /> {downloading ? 'Preparing…' : 'Download ZIP'}
                </Button>
              </div>
            </div>
            <div className="divide-y divide-border">
              {Object.entries(codeToShow).map(([section, files]) => (
                <div key={section}>
                  <div className="px-5 py-2.5 bg-muted/10 flex items-center gap-2">
                    <FolderOpen className="w-3.5 h-3.5 text-muted-foreground" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{section}</p>
                  </div>
                  {Object.entries(files).map(([filename, content]) => {
                    const key = `${section}/${filename}`;
                    const isExpanded = expandedCode[key];
                    const isConfig = CONFIG_FILES.includes(filename);
                    const lang = getFileLanguage(filename);
                    const FileIcon = getFileIcon(filename);
                    return (
                      <div key={filename} className="border-t border-border/50">
                        <button
                          onClick={() => toggleCode(key)}
                          className={`w-full flex items-center gap-2 px-5 py-3 hover:bg-muted/20 transition-colors text-left ${isConfig ? 'bg-primary/3' : ''}`}
                        >
                          {isExpanded
                            ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />}
                          <FileIcon className="w-3.5 h-3.5 text-primary/70 flex-shrink-0" />
                          <code className="text-xs font-mono text-foreground flex-1">{filename}</code>
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground font-medium mr-2">{lang}</span>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{(content?.length || 0).toLocaleString()} chars</span>
                        </button>
                        {isExpanded && (
                          <div className="relative bg-zinc-950">
                            {/* File info bar */}
                            <div className="flex items-center gap-2 px-5 py-2 border-b border-white/5">
                              <span className="text-[10px] font-mono text-zinc-400">{filename}</span>
                              <span className="text-[10px] text-zinc-600 ml-auto mr-2">{lang}</span>
                              <button
                                onClick={() => copyText(content, key)}
                                className="flex items-center gap-1 text-[10px] text-zinc-400 hover:text-white transition-colors"
                              >
                                {copied === key ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
                                {copied === key ? 'Copied!' : 'Copy'}
                              </button>
                            </div>
                            <pre className="px-5 py-4 text-[11px] font-mono text-zinc-300 overflow-x-auto max-h-96 overflow-y-auto leading-relaxed whitespace-pre">
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