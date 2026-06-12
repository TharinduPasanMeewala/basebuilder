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

    // Analyze the cloned code with AI to extract specs (entities, pages, workflows, requirements)
    const allPaths = [];
    for (const [sec, files] of Object.entries(sections)) {
      for (const fn of Object.keys(files)) allPaths.push(sec.replace('📁 ', '') + '/' + fn);
    }
    let keySource = '';
    const priorityPatterns = [/readme\.md$/i, /package\.json$/, /schema|model|entit/i, /router|routes|app\.(jsx?|tsx?|vue)$/i, /pages?\/|views?\//i];
    const flatFiles = [];
    for (const files of Object.values(sections)) {
      for (const [fn, content] of Object.entries(files)) flatFiles.push({ fn, content });
    }
    flatFiles.sort((a, b) => {
      const score = f => priorityPatterns.findIndex(p => p.test(f.fn));
      const sa = score(a), sb = score(b);
      return (sa === -1 ? 99 : sa) - (sb === -1 ? 99 : sb);
    });
    for (const f of flatFiles) {
      if (keySource.length > 30000) break;
      keySource += `\n--- ${f.fn} ---\n${f.content.slice(0, 4000)}\n`;
    }

    let analysis = { requirements: [], entities: [], pages: [], workflows: [] };
    try {
      analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this GitHub repository ("${repoData.full_name}", language: ${repoData.language || 'unknown'}) and reverse-engineer its specification.

File tree:
${allPaths.slice(0, 250).join('\n')}

Key source files:
${keySource}

Extract:
1. requirements: functional requirements the app implements (title, category one of functional/non_functional/business_rule/user_story, description, priority one of critical/high/medium/low)
2. entities: data models/structures used (name, description, fields [{name, type one of string/number/boolean/date/enum/object/array, required}])
3. pages: UI pages/views/screens (name, type one of dashboard/list/detail/form/report/settings/auth/landing/kanban/calendar/chart, route, description)
4. workflows: processes/automations/build steps (name, description, trigger_type one of entity_create/entity_update/scheduled/manual/api_call/event)

Be thorough — extract everything you can identify from the actual code.`,
        response_json_schema: {
          type: 'object',
          properties: {
            requirements: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, category: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string' } } } },
            entities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, fields: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, required: { type: 'boolean' } } } } } } },
            pages: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, route: { type: 'string' }, description: { type: 'string' } } } },
            workflows: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, trigger_type: { type: 'string' } } } },
          },
        },
      });
    } catch (_e) { /* analysis is best-effort; cloning still succeeds */ }

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

    // Populate spec sections from the AI analysis
    const REQ_CATS = ['functional', 'non_functional', 'business_rule', 'user_story', 'constraint', 'assumption'];
    const REQ_PRIOS = ['critical', 'high', 'medium', 'low'];
    const PAGE_TYPES = ['dashboard', 'list', 'detail', 'form', 'report', 'settings', 'auth', 'landing', 'kanban', 'calendar', 'chart'];
    const WF_TRIGGERS = ['entity_create', 'entity_update', 'entity_delete', 'scheduled', 'manual', 'api_call', 'event'];

    if (analysis.requirements?.length) {
      await base44.entities.Requirement.bulkCreate(analysis.requirements.slice(0, 40).map(r => ({
        project_id: project.id,
        title: String(r.title || '').slice(0, 200),
        category: REQ_CATS.includes(r.category) ? r.category : 'functional',
        description: r.description || '',
        priority: REQ_PRIOS.includes(r.priority) ? r.priority : 'medium',
        status: 'confirmed',
        source: 'imported',
      })));
    }
    if (analysis.entities?.length) {
      await base44.entities.DataEntity.bulkCreate(analysis.entities.slice(0, 30).map(e => ({
        project_id: project.id,
        name: String(e.name || 'Entity').slice(0, 100),
        description: e.description || '',
        fields: (e.fields || []).map(f => ({ name: f.name, type: f.type, required: !!f.required })),
        source: 'ai_generated',
      })));
    }
    if (analysis.pages?.length) {
      await base44.entities.PageSpec.bulkCreate(analysis.pages.slice(0, 30).map(p => ({
        project_id: project.id,
        name: String(p.name || 'Page').slice(0, 100),
        type: PAGE_TYPES.includes(p.type) ? p.type : 'list',
        route: p.route || '',
        description: p.description || '',
        source: 'ai_generated',
      })));
    }
    if (analysis.workflows?.length) {
      await base44.entities.WorkflowSpec.bulkCreate(analysis.workflows.slice(0, 20).map(w => ({
        project_id: project.id,
        name: String(w.name || 'Workflow').slice(0, 100),
        description: w.description || '',
        trigger_type: WF_TRIGGERS.includes(w.trigger_type) ? w.trigger_type : 'manual',
        source: 'ai_generated',
      })));
    }

    return Response.json({
      projectId: project.id,
      fileCount,
      skipped,
      totalKb: Math.round(totalSize / 1024),
      specs: {
        requirements: analysis.requirements?.length || 0,
        entities: analysis.entities?.length || 0,
        pages: analysis.pages?.length || 0,
        workflows: analysis.workflows?.length || 0,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});