import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {randomBytes,createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import JSZip from 'jszip';

const exists=path=>access(path).then(()=>true,()=>false);
const remote=await exists('base44/functions/source-archive/entry.ts');
const backend=await readFile(remote?'base44/functions/source-archive/entry.ts':'builder-import/source-archive.ts','utf8');
const converter=await import(pathToFileURL(resolve(remote?'src/lib/standaloneConversion.js':'standalone-conversion.mjs')));
globalThis.__sourceBackupFormat=await import(pathToFileURL(resolve(remote?'src/lib/backupFormat.js':'backup-format.mjs')));
globalThis.__sourceTestZip=JSZip;
globalThis.Deno={env:{get:key=>key==='GITHUB_TOKEN'?'admin-only-test-token':undefined}};
const handler=(await import('data:text/javascript;base64,'+Buffer.from(backend.replace(/import \{ createClientFromRequest \} from 'npm:@base44\/sdk';/, 'const createClientFromRequest=()=>globalThis.__sourceTestClient;').replace(/import JSZip from 'npm:jszip@3.10.1';/,'const JSZip=globalThis.__sourceTestZip;').replace(/import \{ BACKUP_LIMITS, inspectBackupZip \} from '..\/..\/shared\/backup-format.ts';/,'const {BACKUP_LIMITS,inspectBackupZip}=globalThis.__sourceBackupFormat;')).toString('base64'))).default;
function setup() {
  let user={id:'owner-one',email:'one@example.com',role:'user'},serial=0;
  const database={};
  const entities=new Proxy({}, {get:(_,name)=>{
    database[name]||=new Map();const rows=database[name];
    const create=async data=>{const row={...data,id:'test-'+(++serial),created_date:new Date().toISOString(),updated_date:new Date().toISOString()};rows.set(row.id,row);return structuredClone(row);};
    return {
      filter:async(query={},sort,limit=5000,skip=0)=>[...rows.values()].filter(row=>Object.entries(query).every(([key,value])=>value&&typeof value==='object'&&'$in' in value?value.$in.includes(row[key]):row[key]===value)).sort((a,b)=>{if(!sort)return 0;const key=sort.replace(/^-/,'');return (String(a[key]).localeCompare(String(b[key])))*(sort.startsWith('-')?-1:1);}).slice(skip,skip+limit).map(row=>structuredClone(row)),
      create,bulkCreate:async data=>Promise.all(data.map(create)),
      update:async(id,data)=>{const row={...rows.get(id),...data,updated_date:new Date().toISOString()};rows.set(id,row);return structuredClone(row);},delete:async id=>rows.delete(id),
    };
  }});
  globalThis.__sourceTestClient={auth:{me:async()=>user},entities,asServiceRole:{entities}};
  const call=async(action,data={})=>handler(new Request('http://localhost/source-archive',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data})}));
  return {call,entities,database,setUser:next=>{user=next;}};
}
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
async function send(fixture,bytes,metadata={}) {
  const encoded=Buffer.from(bytes).toString('base64'),parts=[];
  for(let i=0;i<encoded.length;i+=16384)parts.push({index:parts.length,content:encoded.slice(i,i+16384)});
  const begin=await fixture.call('begin',{project_name:'Complete source',filename:'source.zip',compressed_bytes:bytes.length,sha256:digest(bytes),part_count:parts.length,...metadata});
  assert.equal(begin.status,200,await begin.clone().text());const {archive_id}=await begin.json();
  for(let i=0;i<parts.length;i+=32)assert.equal((await fixture.call('parts',{archive_id,parts:parts.slice(i,i+32)})).status,200);
  return {archive_id,finalize:await fixture.call('finalize',{archive_id})};
}
const packageText=JSON.stringify({name:'source-fixture',type:'module',dependencies:{react:'^18.2.0','@base44/sdk':'^0.8.0'},devDependencies:{vite:'^6.1.0'}});
test('complete ZIP storage preserves large source and binary bytes, enforces owners, and detects stale edits', async()=>{
  const fixture=setup(),zip=new JSZip(),source='// '+randomBytes(90000).toString('base64')+'\nexport default 1;\n',binary=Uint8Array.from([0,255,128,254,1,0]);
  zip.file('package.json',packageText);zip.file('src/Large.jsx',source);zip.file('public/pixel.png',binary);zip.file('.env','PRIVATE_TEST=excluded');
  const {archive_id,finalize}=await send(fixture,await zip.generateAsync({type:'uint8array',compression:'DEFLATE'}));
  assert.equal(finalize.status,200,await finalize.clone().text());const result=await finalize.json();
  assert.equal(result.summary.file_count,3);assert.equal(result.summary.skipped_files,1);
  const original=await (await fixture.call('read',{archive_id,path:'src/Large.jsx'})).json();assert.equal(original.content,source);
  const saved=await fixture.call('save',{archive_id,path:'src/Large.jsx',base_hash:original.sha256,content:source+'// edited\n'});assert.equal(saved.status,200);
  assert.equal((await fixture.call('save',{archive_id,path:'src/Large.jsx',base_hash:original.sha256,content:'stale'})).status,409);
  fixture.setUser({id:'owner-two',email:'two@example.com',role:'user'});assert.equal((await fixture.call('list',{archive_id})).status,404);
  fixture.setUser({id:'owner-one',email:'one@example.com',role:'user'});
  const output=await JSZip.loadAsync(await (await fixture.call('download',{archive_id})).arrayBuffer());
  assert.deepEqual(await output.file('public/pixel.png').async('uint8array'),binary);assert.equal(await output.file('src/Large.jsx').async('string'),source+'// edited\n');assert.equal(output.file('.env'),null);
  assert.equal((await fixture.call('restore',{archive_id,path:'src/Large.jsx'})).status,200);
  assert.equal((await (await fixture.call('read',{archive_id,path:'src/Large.jsx'})).json()).content,source);
  assert.equal((await fixture.call('save',{archive_id,path:'src/new.js',base_hash:'',content:''})).status,200);
  assert.equal((await (await fixture.call('read',{archive_id,path:'src/new.js'})).json()).content,'');
});
test('archive import rejects unsafe paths, links, checksums and invalid metadata',async()=>{
  const fixture=setup();assert.equal((await fixture.call('begin',{project_name:[]})).status,400);
  for(const link of [false,true]){
    const zip=new JSZip();zip.file('package.json',packageText);zip.file(link?'link.js':'../escape.js','outside',{unixPermissions:link?0o120777:0o100644});
    const {finalize}=await send(fixture,await zip.generateAsync({type:'uint8array',platform:'UNIX'}));assert.equal(finalize.status,400);
  }
  const bytes=new Uint8Array([1,2,3]),begin=await fixture.call('begin',{project_name:'bad hash',compressed_bytes:3,sha256:'0'.repeat(64),part_count:1});const {archive_id}=await begin.json();
  await fixture.call('parts',{archive_id,parts:[{index:0,content:Buffer.from(bytes).toString('base64')}]});assert.equal((await fixture.call('finalize',{archive_id})).status,409);
});
test('GitHub import keeps complete binary source and does not share administrator tokens',async()=>{
  const fixture=setup(),zip=new JSZip();zip.file('org-repo-sha/package.json',packageText);zip.file('org-repo-sha/public/file.bin',Uint8Array.from([255,0,128]));
  const bytes=await zip.generateAsync({type:'uint8array'}),previous=globalThis.fetch;let headers;
  globalThis.fetch=async(url,options)=>{assert.match(url,/api.github.com\/repos\/org\/repo\/zipball$/);headers=options.headers;return new Response(bytes);};
  try{const response=await fixture.call('github',{repo_url:'https://github.com/org/repo'});assert.equal(response.status,200,await response.clone().text());assert.equal(headers.Authorization,undefined);const {archive_id}=await response.json();const output=await JSZip.loadAsync(await (await fixture.call('download',{archive_id})).arrayBuffer());assert.deepEqual(await output.file('public/file.bin').async('uint8array'),Uint8Array.from([255,0,128]));}finally{globalThis.fetch=previous;}
});
test('standalone conversion replaces backend dependencies and recognized credentials while retaining binary assets',()=>{
  const secret='a'.repeat(32),binary=Uint8Array.from([255,0,128]);
  const source=[{path:'package.json',content:packageText},{path:'public/pixel.png',content:binary},{path:'base44/entities/Thing.jsonc',content:'{"name":"Thing","properties":{}}'},{path:'base44/functions/hello/entry.ts',content:"import {createClientFromRequest} from 'npm:@base44/sdk@0.8.0';\nconst API_KEY = '"+secret+"';\nDeno.serve(async()=>Response.json({ok:true}));"},{path:'.env',content:'API_KEY='+secret}];
  const output=converter.convertStandalone(source,[{path:'standalone/server/index.mjs',content:'// own runtime'}],{name:'App'}),map=new Map(output.files.map(file=>[file.path,file.content]));
  assert.equal(JSON.parse(map.get('package.json')).dependencies['@base44/sdk'],undefined);assert.match(map.get('base44/functions/hello/entry.ts'),/export default \(/);assert.equal(map.get('base44/functions/hello/entry.ts').includes(secret),false);assert.equal(map.has('.env'),false);assert.deepEqual(map.get('public/pixel.png'),binary);assert.equal(output.report.removed_credentials.length,1);assert.equal(output.report.data_records_included,false);assert.match(map.get('compose.yaml'),/HOST: 0.0.0.0/);
});
test('private archive entities deny direct client reads and writes',async()=>{
  for(const name of ['SourceArchive','SourceArchivePart','SourceFileOverlay']){
    const schema=JSON.parse(await readFile(remote?'base44/entities/'+name+'.jsonc':'builder-import/'+name+'.jsonc','utf8'));
    for(const operation of ['create','read','update','delete'])assert.equal(schema.rls[operation],false);
  }
});
test('AI source patches insert literal code and reject a partial or ambiguous edit batch',async()=>{
  const source=await readFile(remote?'src/lib/sourceArchives.js':'builder-import/sourceArchives.js','utf8');
  const {applySourceEdits}=await import('data:text/javascript;base64,'+Buffer.from(source.slice(source.indexOf('export function applySourceEdits'))).toString('base64'));
  assert.equal(applySourceEdits('old',[{old_text:'old',new_text:'$& and $$'}]),'$& and $$');
  assert.throws(()=>applySourceEdits('first second',[{old_text:'first',new_text:'changed'},{old_text:'missing',new_text:'bad'}]),/did not match/);
  assert.throws(()=>applySourceEdits('same same',[{old_text:'same',new_text:'ambiguous'}]),/unique location/);
});
test('large database ZIPs attach to the source project privately and download across chunk pages',async()=>{
  const fixture=setup(),source=new JSZip();source.file('package.json',packageText);source.file('base44/entities/Thing.jsonc','{"name":"Thing","properties":{}}');
  const imported=await send(fixture,await source.generateAsync({type:'uint8array'})),project=await imported.finalize.json();
  const database=new JSZip();database.file('entities/Thing.json',JSON.stringify([{id:'original',title:'x'.repeat(13*1024*1024)}]));database.file('manifest.json','{"summary":{"Thing":1}}');
  const bytes=await database.generateAsync({type:'uint8array',compression:'STORE'});
  const attached=await send(fixture,bytes,{project_id:project.projectId,archive_kind:'database',filename:'records.zip'});assert.equal(attached.finalize.status,200,await attached.finalize.clone().text());
  const list=await (await fixture.call('list',{project_id:project.projectId})).json();assert.equal(list.archive_id,project.archive_id);assert.equal(list.backups.length,1);assert.equal(list.backups[0].summary.record_count,1);assert.equal(list.backups[0].summary.counts_verified,false);
  const downloaded=new Uint8Array(await (await fixture.call('download_backup',{archive_id:attached.archive_id})).arrayBuffer());assert.equal(digest(downloaded),digest(bytes));
  fixture.setUser({id:'owner-two',email:'two@example.com',role:'user'});assert.equal((await fixture.call('download_backup',{archive_id:attached.archive_id})).status,404);
  fixture.setUser({id:'owner-one',email:'one@example.com',role:'user'});assert.equal((await fixture.call('remove_backup',{project_id:project.projectId,backup_id:attached.archive_id})).status,200);assert.equal((await (await fixture.call('backups',{project_id:project.projectId})).json()).backups.length,0);
  const unknown=new JSZip();unknown.file('entities/OtherApp.json','[]');const rejected=await send(fixture,await unknown.generateAsync({type:'uint8array'}),{project_id:project.projectId,archive_kind:'database'});assert.equal(rejected.finalize.status,400);
});
test('multi-ZIP selection and standalone export include complete database backups with checksums',async()=>{
  const fixture=setup();globalThis.__sourceTestConverter=converter;
  globalThis.__sourceFrontendClient={functions:{invoke:async(name,data)=>{assert.equal(name,'source-archive');const response=await fixture.call(data.action,data),body=await response.json();if(!response.ok)throw new Error(body.error);return {data:body};},fetch:async(path,options)=>{assert.equal(path,'/source-archive');const data=JSON.parse(options.body);return fixture.call(data.action,data);}}};
  let module=await readFile(remote?'src/lib/sourceArchives.js':'builder-import/sourceArchives.js','utf8');
  module=module.replace("import JSZip from 'jszip';",'const JSZip=globalThis.__sourceTestZip;').replace("import { base44 } from '@/api/base44Client';",'const base44=globalThis.__sourceFrontendClient;').replace(/import \{ analyzeSource, convertStandalone, isTextPath, safeArchivePath, excludedSourcePath \} from '@\/lib\/standaloneConversion';/,'const {analyzeSource,convertStandalone,isTextPath,safeArchivePath,excludedSourcePath}=globalThis.__sourceTestConverter;').replace("import { mirrorPublicAssets } from '@/lib/sourceAssets';",'const mirrorPublicAssets=async files=>({files,assetMap:{},missing:[]});').replace("import { BACKUP_LIMITS, inspectBackupZip } from '@/lib/backupFormat';",'const {BACKUP_LIMITS,inspectBackupZip}=globalThis.__sourceBackupFormat;');
  const frontend=await import('data:text/javascript;base64,'+Buffer.from(module).toString('base64'));
  const file=async(zip,name)=>{const bytes=await zip.generateAsync({type:'nodebuffer'});bytes.name=name;bytes.size=bytes.length;bytes.arrayBuffer=async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);return bytes;};
  const source=new JSZip();source.file('package.json',packageText);source.file('base44/entities/Thing.jsonc','{"name":"Thing","properties":{}}');
  const a=new JSZip(),b=new JSZip();a.file('entities/Thing.json','[{"id":"one","title":"One"}]');b.file('entities/Thing.json','[{"id":"two","title":"Two"}]');
  const sourceFile=await file(source,'app.zip'),first=await file(a,'part-a.zip'),second=await file(b,'part-b.zip');
  const databaseOnly=await frontend.inspectImportFiles([first,second]);assert.equal(databaseOnly.source,null);const selection=await frontend.inspectImportFiles([sourceFile],databaseOnly);assert.equal(selection.backups.length,2);
  await assert.rejects(()=>frontend.inspectImportFiles([sourceFile],selection),/one application source/);
  const created=await frontend.uploadArchive(selection.source,'Multiple ZIPs'),project={id:created.projectId,name:'Multiple ZIPs'};await frontend.uploadDatabaseArchives(selection.backups,project);
  const previous=globalThis.fetch;globalThis.fetch=async path=>{assert.equal(path,'/standalone-runtime.json');return Response.json([{path:'standalone/server/index.mjs',content:'// fixture runtime'}]);};
  try{const result=await frontend.standaloneArchive(project,'',()=>{}),output=await JSZip.loadAsync(await result.blob.arrayBuffer()),manifest=JSON.parse(await output.file('migration/backups.json').async('string'));assert.equal(manifest.backups.length,2);assert.equal(result.report.data_records_included,true);for(const entry of manifest.backups)assert.equal(digest(await output.file(entry.path).async('uint8array')),entry.sha256);assert.ok(JSON.parse(await output.file('package.json').async('string')).scripts['db:restore']);}finally{globalThis.fetch=previous;}
});
