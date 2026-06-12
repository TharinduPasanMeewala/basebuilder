import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import JSZip from 'npm:jszip@3.10.1';

const BINARY_EXT = ['png','jpg','jpeg','gif','ico','webp','bmp','woff','woff2','ttf','otf','eot','pdf','zip','gz','tar','mp3','mp4','wav','ogg','mov','avi','exe','dll','so','bin','db','sqlite','jar','class','pyc','lock'];
const SKIP_FILES = ['package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock', 'Cargo.lock', 'poetry.lock'];
const MAX_FILE_SIZE = 40 * 1024;       // 40KB per file (entity field limit)
const MAX_TOTAL_SIZE = 1500 * 1024;    // 1.5MB total
const MAX_FILES = 400;

function isBinary(path) {
  const ext = path.split('.').pop()?.toLowerCase();
  return BINARY_EXT.includes(ext);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { repoUrl, projectName, projectDescription } = await req.json();
    if (!repoUrl) return Response.json({ error: 'repoUrl is required' }, { status: 400 });

    const cleaned = repoUrl.trim().replace(/[?#].*$/, '').replace(/\/+$/, '');
    const match = cleaned.match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return Response.json({ error: 'Invalid GitHub repo URL' }, { status: 400 });
    const owner = match[1];
    const repo = match[2].replace(/\.git$/, '');

    const headers = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'ArchitectAI' };
    const token = Deno.env.get('GITHUB_TOKEN');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Repo metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      const err = await repoRes.json();
      return Response.json({ error: err.message || 'Repo not found' }, { status: repoRes.status });
    }
    const repoData = await repoRes.json();

    // Download the whole repo as a zip archive
    const zipRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/zipball`, { headers, redirect: 'follow' });
    if (!zipRes.ok) return Response.json({ error: 'Failed to download repository archive' }, { status: 502 });
    const zipBuffer = await zipRes.arrayBuffer();
    const zip = await JSZip.loadAsync(zipBuffer);

    // Extract text files, grouped by top-level folder
    const sections = {};
    let totalSize = 0;
    let fileCount = 0;
    let skipped = 0;

    const entries = Object.values(zip.files).filter(f => !f.dir);
    for (const entry of entries) {
      if (fileCount >= MAX_FILES || totalSize >= MAX_TOTAL_SIZE) { skipped++; continue; }
      // Strip the zipball's top folder prefix (owner-repo-sha/)
      const path = entry.name.split('/').slice(1).join('/');
      if (!path || path.startsWith('.git/')) continue;
      if (isBinary(path) || SKIP_FILES.includes(path.split('/').pop())) { skipped++; continue; }

      const content = await entry.async('string');
      if (content.length > MAX_FILE_SIZE || /\u0000/.test(content.slice(0, 1000))) { skipped++; continue; }

      const parts = path.split('/');
      const section = parts.length > 1 ? `📁 ${parts[0]}` : '📁 root';
      const filename = parts.length > 1 ? parts.slice(1).join('/') : path;
      if (!sections[section]) sections[section] = {};
      sections[section][filename] = content;
      totalSize += content.length;
      fileCount++;
    }

    // Create the project + publish_state version holding the cloned codebase
    const project = await base44.entities.Project.create({
      name: projectName || repoData.name,
      description: (projectDescription || repoData.description || '').slice(0, 1000),
      type: 'custom_application',
      phase: 'completed',
      status: 'active',
      completeness_score: 100,
      version_count: 1,
    });

    await base44.entities.ProjectVersion.create({
      project_id: project.id,
      version_number: 1,
      label: 'publish_state',
      notes: `Cloned from ${repoData.full_name}`,
      phase: 'completed',
      snapshot: {
        url: repoData.html_url,
        published_at: new Date().toISOString(),
        score: 100,
        entities: 0,
        pages: 0,
        apis: 0,
        workflows: 0,
        tech_stack: { frontend: repoData.language || 'Unknown', backend: '-', database: '-' },
        github_url: repoData.html_url,
        code: sections,
      },
    });

    return Response.json({ projectId: project.id, fileCount, skipped, totalKb: Math.round(totalSize / 1024) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});