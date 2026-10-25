import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';

const root = process.cwd();
const source = (await readFile('src/lib/codegen.js', 'utf8')).replace("'@/lib/hosting'", JSON.stringify(pathToFileURL(resolve('src/lib/hosting.js')).href));
const { generateCodeFiles } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const temp = await mkdtemp(join(tmpdir(), 'architect-export-'));
const cases = [
  { name: "Sara's <CRM>", type: 'crm_system', snapshot: { entities: [
    { name: "Customer's records", fields: [{ name: "Full name's", type: 'string', required: true }, { name: 'budget', type: 'number' }, { name: 'active', type: 'boolean' }, { name: 'stage', type: 'enum', enum_values: ['New', 'Done'] }] },
    { name: '3D Jobs', fields: [{ name: 'title', type: 'string' }] },
  ] } },
  { name: 'Calculator <Demo>', type: 'custom_application', snapshot: {} },
];
let nodeServer;
try {
  for (let index = 0; index < cases.length; index++) {
    const project = cases[index];
    const directory = join(temp, 'app-' + index);
    await mkdir(directory);
    const files = generateCodeFiles(project, project.snapshot);
    for (const file of files) {
      const path = join(directory, file.path);
      await mkdir(dirname(path), { recursive: true }); await writeFile(path, file.content);
    }
    if (index === 0) {
      const install = spawnSync('npm', ['install', '--no-audit', '--no-fund'], { cwd: directory, encoding: 'utf8', timeout: 120000 });
      assert.equal(install.status, 0, install.stderr + install.stdout);
    } else await symlink(join(temp, 'app-0/node_modules'), join(directory, 'node_modules'), 'dir');
    const result = spawnSync('npm', ['run', 'build'], { cwd: directory, encoding: 'utf8', timeout: 120000 });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    console.log('PASS exported production build: ' + project.name + ' (' + files.length + ' files)');
  }
  const socket = createServer(); await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  nodeServer = spawn(process.execPath, ['hosting/serve.mjs'], { cwd: join(temp, 'app-0'), env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Static server failed to start')), 10000);
    nodeServer.stdout.once('data', () => { clearTimeout(timeout); resolve(); });
    nodeServer.once('error', reject);
  });
  const base = 'http://127.0.0.1:' + port;
  assert.equal((await fetch(base + '/')).status, 200);
  const deep = await fetch(base + '/customers/42'); assert.equal(deep.status, 200); assert.match(await deep.text(), /<div id="root">/);
  assert.equal((await fetch(base + '/assets/not-present.js')).status, 404);
  assert.equal((await fetch(base + '/.env')).status, 403);
  assert.equal((await fetch(base + '/api/private')).status, 404);
  assert.equal((await fetch(base, { method: 'POST' })).status, 405);
  const head = await fetch(base, { method: 'HEAD' }); assert.equal(head.status, 200); assert.equal(await head.text(), '');
  console.log('PASS local production server: root, deep links, missing assets, hidden files, unsupported methods, HEAD');
  console.log('All export integration checks passed.');
} finally {
  if (nodeServer) { nodeServer.kill('SIGTERM'); await new Promise(resolve => nodeServer.once('close', resolve)); }
  await rm(temp, { recursive: true, force: true });
}
