import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { repoUrl } = await req.json();
    if (!repoUrl) return Response.json({ error: 'repoUrl is required' }, { status: 400 });

    // Parse owner/repo from URL like https://github.com/owner/repo
    const match = repoUrl.replace(/\/$/, '').match(/github\.com\/([^/]+)\/([^/]+)/);
    if (!match) return Response.json({ error: 'Invalid GitHub repo URL' }, { status: 400 });

    const [, owner, repo] = match;
    const headers = {
      'Accept': 'application/vnd.github+json',
      'User-Agent': 'ArchitectAI',
    };
    const token = Deno.env.get('GITHUB_TOKEN');
    if (token) headers['Authorization'] = `Bearer ${token}`;

    // Fetch repo metadata
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
      const err = await repoRes.json();
      return Response.json({ error: err.message || 'Repo not found or not accessible' }, { status: repoRes.status });
    }
    const repoData = await repoRes.json();

    // Fetch README
    let readme = '';
    const readmeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, { headers });
    if (readmeRes.ok) {
      const readmeData = await readmeRes.json();
      readme = atob(readmeData.content.replace(/\n/g, ''));
    }

    // Fetch top-level file tree (shallow)
    let fileTree = [];
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers });
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      fileTree = (treeData.tree || [])
        .filter(f => f.type === 'blob')
        .map(f => f.path)
        .slice(0, 200);
    }

    // Detect tech stack from file names
    const techHints = [];
    if (fileTree.some(f => f.includes('package.json'))) techHints.push('Node.js/JavaScript');
    if (fileTree.some(f => f.endsWith('.jsx') || f.endsWith('.tsx'))) techHints.push('React');
    if (fileTree.some(f => f.includes('requirements.txt') || f.endsWith('.py'))) techHints.push('Python');
    if (fileTree.some(f => f.endsWith('.go'))) techHints.push('Go');
    if (fileTree.some(f => f.endsWith('.java'))) techHints.push('Java');
    if (fileTree.some(f => f.includes('Dockerfile'))) techHints.push('Docker');
    if (fileTree.some(f => f.includes('tailwind.config'))) techHints.push('Tailwind CSS');
    if (fileTree.some(f => f.includes('prisma') || f.includes('schema.prisma'))) techHints.push('Prisma');

    return Response.json({
      name: repoData.name,
      description: repoData.description || '',
      fullName: repoData.full_name,
      stars: repoData.stargazers_count,
      language: repoData.language,
      topics: repoData.topics || [],
      readme: readme.slice(0, 3000),
      fileTree,
      techHints,
      repoUrl: repoData.html_url,
      defaultBranch: repoData.default_branch,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});