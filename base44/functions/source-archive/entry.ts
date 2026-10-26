import { createClientFromRequest } from 'npm:@base44/sdk';
import JSZip from 'npm:jszip@3.10.1';
import { BACKUP_LIMITS, inspectBackupZip } from '../../shared/backup-format.ts';

const CHUNK = 16384, MAX_ZIP = 32 * 1024 * 1024, MAX_FILES = 5000, MAX_EXPANDED = 96 * 1024 * 1024;
const safePath = value => typeof value === 'string' && value.length < 600 && !value.startsWith('/') && !value.includes('\\') && !/^[A-Za-z]:/.test(value) && !value.split('/').some(part => !part || part === '.' || part === '..');
const excluded = value => value.split('/').some(part => ['node_modules','.git','__MACOSX','.DS_Store'].includes(part)) || /(^|\/)\.env(?:\.|$)/.test(value) && !/\.env\.example$/.test(value) || /\.(?:pem|key|p12|pfx|sqlite3?|db)$/i.test(value);
const textFile = value => /\.(?:[cm]?[jt]sx?|jsonc?|html?|css|scss|md|txt|toml|ya?ml|xml|svg|sql|sh|py|gitignore|dockerignore|env\.example)$/i.test(value) || ['Dockerfile','.gitignore','.dockerignore'].includes(value.split('/').at(-1));
const error = (status, message) => Object.assign(new Error(message), { status });
const hash = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2,'0')).join('');
function decode(value) { const text = atob(value), bytes = new Uint8Array(text.length); for (let i=0;i<text.length;i++) bytes[i]=text.charCodeAt(i); return bytes; }
function encode(bytes) { let text=''; for(let i=0;i<bytes.length;i+=8192) text+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(text); }
async function boundedBytes(entry, maximum = 32 * 1024 * 1024) {
  return new Promise((resolve,reject) => {
    const chunks=[]; let size=0, stopped=false;
    const stream=entry.internalStream('uint8array');
    stream.on('data',chunk=>{ if(stopped)return;size+=chunk.length;if(size>maximum){stopped=true;stream.pause();reject(error(413,'An archive file exceeds the import limit.'));return;}chunks.push(chunk); });
    stream.on('error',reject);stream.on('end',()=>{if(stopped)return;const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length;}resolve(bytes);});stream.resume();
  });
}
function entries(zip) {
  return Object.values(zip.files).filter(entry=>!entry.dir).map(entry=>{
    const original=entry.unsafeOriginalName || entry.name;
    const permissions=typeof entry.unixPermissions==='string'?parseInt(entry.unixPermissions,8):entry.unixPermissions || 0;
    if(!safePath(original) || !safePath(entry.name) || (permissions & 0o170000)===0o120000) throw error(400,'The ZIP contains an unsafe path or symbolic link.');
    return entry;
  });
}
async function inspect(zip) {
  const all=entries(zip); if(all.length>MAX_FILES)throw error(413,'Import at most 5,000 files.');
  let declared=0;for(const entry of all)declared+=Number(entry._data?.uncompressedSize || 0);
  if(declared>MAX_EXPANDED)throw error(413,'Expanded source ZIP exceeds 96 MB.');
  const kept=all.filter(entry=>!excluded(entry.name));const skipped=all.length-kept.length;
  if(!zip.file('package.json'))throw error(400,'The selected application root must contain package.json.');
  const pkg=JSON.parse(new TextDecoder().decode(await boundedBytes(zip.file('package.json'),256*1024)));
  let expanded=0;for(const entry of kept){expanded+=(await boundedBytes(entry)).length;if(expanded>MAX_EXPANDED)throw error(413,'Expanded source ZIP exceeds 96 MB.');}
  const paths=kept.map(entry=>entry.name);
  return { file_count:paths.length, skipped_files:skipped, expanded_bytes:expanded, framework:pkg.dependencies?.react&&(pkg.devDependencies?.vite||pkg.dependencies?.vite)?'React + Vite':'Other',
    base44:!!pkg.dependencies?.['@base44/sdk']||paths.some(path=>path.startsWith('base44/entities/')), pages:paths.filter(path=>/^src\/pages\/.*\.[jt]sx?$/.test(path)).length,
    schemas:paths.filter(path=>/^base44\/entities\/.*\.jsonc?$/.test(path)).length, functions:paths.filter(path=>/^base44\/functions\/[^/]+\/entry\.[jt]s$/.test(path)).length,
    actors:paths.filter(path=>/^base44\/actors\/[^/]+\/entry\.[jt]s$/.test(path)).length, data_records_included:false };
}
export default async function(req) {
  try {
    const client=createClientFromRequest(req), user=await client.auth.me();
    if(!user?.id)return Response.json({error:'Sign in required.'},{status:401});
    const body=await req.json(),action=body.action;
    const models=client.asServiceRole.entities;
    const sourceForProject=async projectId=>{
      if(typeof projectId!=='string'||!projectId)throw error(400,'Choose an imported app project first.');
      const archive=(await models.SourceArchive.filter({owner_id:user.id,project_id:projectId},'-created_date',100)).find(item=>item.archive_kind!=='database'&&item.status==='ready');
      if(!archive)throw error(404,'Source archive not found.');return archive;
    };
    const backupList=async projectId=>(await models.SourceArchive.filter({owner_id:user.id,project_id:projectId,archive_kind:'database',status:'ready'},'created_date',100)).map(item=>({id:item.id,filename:item.filename,sha256:item.sha256,compressed_bytes:item.compressed_bytes,summary:item.summary}));
    const own=async()=> {
      if(!body.archive_id)return sourceForProject(body.project_id);
      const query={owner_id:user.id,id:body.archive_id};
      const archive=(await models.SourceArchive.filter(query,'-created_date',1))[0];
      if(!archive)throw error(404,'Source archive not found.');
      return archive;
    };
    const chunks=async group=>{const all=[];for(let skip=0;;skip+=1000){const page=await models.SourceArchivePart.filter({group_id:group,owner_id:user.id},'part_index',1000,skip);all.push(...page);if(page.length<1000)break;}return all;};
    const join=async(group,count)=> {
      const parts=await chunks(group),byIndex=new Map(parts.map(part=>[part.part_index,part.content]));
      if(byIndex.size!==count || Array.from({length:count},(_,index)=>index).some(index=>!byIndex.has(index)))throw error(409,'Upload is incomplete. Retry the missing chunks.');
      return decode(Array.from({length:count},(_,index)=>byIndex.get(index)).join(''));
    };
    const put=async(group,parts)=> {
      const indexes=parts.map(part=>part?.index);const existing=new Map((await models.SourceArchivePart.filter({group_id:group,owner_id:user.id,part_index:{$in:indexes}},'part_index',100)).map(part=>[part.part_index,part]));
      const create=[];
      for(const part of parts){
        if(!Number.isSafeInteger(part.index)||part.index<0||typeof part.content!=='string'||part.content.length>CHUNK||!/^[A-Za-z0-9+/=]*$/.test(part.content))throw error(400,'Invalid upload chunk.');
        if(existing.has(part.index)){if(existing.get(part.index).content!==part.content)throw error(409,'A chunk differs from the saved upload. Start a new import.');continue;}
        create.push({owner_id:user.id,group_id:group,part_index:part.index,content:part.content});
      }
      if(create.length)await models.SourceArchivePart.bulkCreate(create);
    };
    const saveBytes=async(group,bytes)=> {
      const data=encode(bytes),parts=[];for(let i=0;i<data.length;i+=CHUNK)parts.push({index:parts.length,content:data.slice(i,i+CHUNK)});
      for(let i=0;i<parts.length;i+=32)await put(group,parts.slice(i,i+32));return parts.length;
    };
    const finalize=async(archive)=> {
      const bytes=await join(archive.id,archive.part_count);
      if(bytes.length!==archive.compressed_bytes||await hash(bytes)!==archive.sha256)throw error(409,'Archive checksum failed. Retry this import.');
      const zip=await JSZip.loadAsync(bytes);
      if(archive.archive_kind==='database'){
        const source=await sourceForProject(archive.project_id);let summary;try{summary=await inspectBackupZip(zip,{verifySizes:true});}catch(cause){throw error(400,cause.message);}
        const sourceZip=await JSZip.loadAsync(await join(source.id,source.part_count));
        const schemas=new Set(['User',...Object.keys(sourceZip.files).filter(path=>/^base44\/entities\/[^/]+\.jsonc?$/.test(path)).map(path=>path.split('/').at(-1).replace(/\.jsonc?$/,''))]);
        const unknown=summary.tables.filter(name=>!schemas.has(name));if(unknown.length)throw error(400,'Backup tables do not match this app: '+unknown.slice(0,15).join(', '));
        await models.SourceArchive.update(archive.id,{status:'ready',summary});
        return {projectId:archive.project_id,archive_id:archive.id,summary};
      }
      const summary=await inspect(zip);
      let project=(await client.entities.Project.filter({source_archive_id:archive.id},'-created_date',1))[0];
      if(!project)project=await client.entities.Project.create({name:archive.project_name,type:'custom_application',description:'Imported complete source archive: '+archive.filename,phase:'design',status:'active',completeness_score:0,source_mode:'archive',source_archive_id:archive.id,source_file_count:summary.file_count});
      await models.SourceArchive.update(archive.id,{status:'ready',project_id:project.id,summary});
      await client.entities.ProjectVersion.create({project_id:project.id,label:'source_import',version_number:1,notes:'Complete source imported, including binary assets and backend code',snapshot:{source_mode:'archive',archive_id:archive.id,...summary}});
      return {projectId:project.id,archive_id:archive.id,summary};
    };
    if(action==='begin'){
      const kind=body.archive_kind||'source';if(!['source','database'].includes(kind))throw error(400,'Choose source or database ZIP.');
      if(typeof body.project_name!=='string'||!body.project_name.trim()||body.project_name.length>100||!Number.isSafeInteger(body.part_count)||body.part_count<1||body.part_count>2800||
        !Number.isSafeInteger(body.compressed_bytes)||body.compressed_bytes<1||body.compressed_bytes>MAX_ZIP||!/^[a-f0-9]{64}$/.test(body.sha256||''))throw error(400,'Invalid archive upload metadata.');
      let parent;
      if(kind==='database'){
        parent=await sourceForProject(body.project_id);
        const attached=await models.SourceArchive.filter({owner_id:user.id,project_id:parent.project_id},'-created_date',100);
        const duplicate=attached.find(item=>item.archive_kind==='database'&&item.status==='ready'&&item.sha256===body.sha256);if(duplicate)return Response.json({archive_id:duplicate.id,status:'ready',summary:duplicate.summary,projectId:parent.project_id});
        const active=attached.filter(item=>!['detached','failed'].includes(item.status));
        if(active.length>=BACKUP_LIMITS.archives||active.reduce((total,item)=>total+(item.compressed_bytes||0),0)+body.compressed_bytes>BACKUP_LIMITS.total)throw error(413,'Use at most 8 ZIPs and 128 MB compressed per project.');
      }
      const previous=await models.SourceArchive.filter({owner_id:user.id},'-created_date',101);if(previous.length>=100)throw error(400,'Archive limit reached. Contact the app administrator.');
      const archive=await models.SourceArchive.create({owner_id:user.id,project_name:body.project_name.trim(),filename:String(body.filename||'source.zip').replace(/[\r\n/\\]/g,'_').slice(0,150),
        archive_kind:kind,...(parent?{project_id:parent.project_id,parent_archive_id:parent.id}:{}),status:'uploading',part_count:body.part_count,compressed_bytes:body.compressed_bytes,sha256:body.sha256});
      return Response.json({archive_id:archive.id});
    }
    if(action==='parts'){
      const archive=await own();if(archive.status!=='uploading')throw error(409,'This upload is already finalized.');
      if(!Array.isArray(body.parts)||body.parts.length>32||body.parts.some(part=>part.index>=archive.part_count))throw error(400,'Send at most 32 valid chunks.');
      await put(archive.id,body.parts);return Response.json({success:true});
    }
    if(action==='finalize'){const archive=await own();if(archive.status==='ready')return Response.json({projectId:archive.project_id,archive_id:archive.id,summary:archive.summary});try{return Response.json(await finalize(archive));}catch(cause){await models.SourceArchive.update(archive.id,{status:'failed'}).catch(()=>{});throw cause;}}
    if(action==='github'){
      const match=String(body.repo_url||'').match(/^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?\/?$/);
      if(!match)throw error(400,'Enter a public GitHub repository URL.');
      const token=user.role==='admin'?Deno.env.get('GITHUB_TOKEN'):'';
      const response=await fetch('https://api.github.com/repos/'+match[1]+'/'+match[2]+'/zipball',{headers:{Accept:'application/vnd.github+json','User-Agent':'BaseBuilder',...(token?{Authorization:'Bearer '+token}: {})},signal:AbortSignal.timeout(60000)});
      if(!response.ok)throw error(response.status===404?404:502,'Could not download this GitHub repository.');
      if(Number(response.headers.get('content-length'))>MAX_ZIP)throw error(413,'Repository archive exceeds 32 MB.');
      const reader=response.body.getReader(),download=[];let received=0;
      try{while(true){const {done,value}=await reader.read();if(done)break;received+=value.length;if(received>MAX_ZIP)throw error(413,'Repository archive exceeds 32 MB.');download.push(value);}}finally{await reader.cancel();}
      const bytes=new Uint8Array(received);let offset=0;for(const chunk of download){bytes.set(chunk,offset);offset+=chunk.length;}
      const source=await JSZip.loadAsync(bytes),all=entries(source),prefix=all[0]?.name.split('/')[0]+'/';const zip=new JSZip();
      if(all.length>MAX_FILES)throw error(413,'Import at most 5,000 files.');
      let expanded=0;for(const entry of all){const path=entry.name.startsWith(prefix)?entry.name.slice(prefix.length):entry.name;if(!path||excluded(path))continue;const content=await boundedBytes(entry);expanded+=content.length;if(expanded>MAX_EXPANDED)throw error(413,'Expanded source exceeds 96 MB.');zip.file(path,content);}
      const sanitized=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
      const archive=await models.SourceArchive.create({owner_id:user.id,project_name:String(body.project_name||match[2]).slice(0,100),filename:match[2]+'.zip',archive_kind:'source',status:'uploading',compressed_bytes:sanitized.length,sha256:await hash(sanitized),part_count:1});
      const count=await saveBytes(archive.id,sanitized);const saved=await models.SourceArchive.update(archive.id,{part_count:count});
      return Response.json(await finalize(saved));
    }
    const archive=await own();if(archive.status!=='ready')throw error(409,'Finish the import first.');
    if(action==='download_backup'){
      if(archive.archive_kind!=='database')throw error(400,'Choose a database backup.');
      return new Response(await join(archive.id,archive.part_count),{headers:{'Content-Type':'application/zip','Cache-Control':'no-store'}});
    }
    if(archive.archive_kind==='database')throw error(400,'Database records are restored by the standalone importer, not the source editor.');
    if(action==='backups')return Response.json({backups:await backupList(archive.project_id)});
    if(action==='remove_backup'){
      const backup=(await models.SourceArchive.filter({id:body.backup_id,owner_id:user.id,project_id:archive.project_id,archive_kind:'database'},'-created_date',1))[0];if(!backup)throw error(404,'Database backup not found.');
      await models.SourceArchive.update(backup.id,{status:'detached'});return Response.json({success:true});
    }
    const zip=await JSZip.loadAsync(await join(archive.id,archive.part_count));
    const patches=await models.SourceFileOverlay.filter({archive_id:archive.id,owner_id:user.id},'path',5000);
    const patchMap=new Map(patches.map(patch=>[patch.path,patch]));
    const current=async path=>{
      const patch=patchMap.get(path);
      if(patch?.deleted)throw error(404,'File was deleted.');
      if(patch)return await join(patch.group_id,patch.part_count);
      const entry=zip.file(path);if(!entry||excluded(path))throw error(404,'File not found.');return boundedBytes(entry);
    };
    if(action==='list'){
      const files=new Map(entries(zip).filter(entry=>!excluded(entry.name)).map(entry=>[entry.name,{path:entry.name,size:Number(entry._data?.uncompressedSize||0),text:textFile(entry.name),modified:false}]));
      for(const patch of patches){if(patch.deleted)files.delete(patch.path);else files.set(patch.path,{path:patch.path,size:patch.byte_count,text:true,modified:true});}
      return Response.json({archive_id:archive.id,summary:archive.summary,filename:archive.filename,backups:await backupList(archive.project_id),files:[...files.values()].sort((a,b)=>a.path.localeCompare(b.path))});
    }
    const path=body.path;
    if(['read','save','delete','restore'].includes(action)&&(!safePath(path)||excluded(path)))throw error(400,'Choose a safe source file path. Secret files and build outputs are excluded.');
    if(action==='read'){
      if(!textFile(path))throw error(400,'Binary assets are preserved in ZIP downloads. Text editing is available for source files.');
      const bytes=await current(path);if(bytes.length>1024*1024)throw error(413,'This file is too large for the source editor.');
      return Response.json({path,content:new TextDecoder().decode(bytes),sha256:await hash(bytes),modified:patchMap.has(path)});
    }
    if(action==='restore'){
      const patch=patchMap.get(path);if(patch)await models.SourceFileOverlay.delete(patch.id);
      return Response.json({success:true});
    }
    if(action==='save'||action==='delete'){
      if(!textFile(path))throw error(400,'Use a text source file extension.');
      if(action==='save'&&(typeof body.content!=='string'||new TextEncoder().encode(body.content).length>1024*1024))throw error(413,'Source file exceeds 1 MB.');
      let existingHash='';try{existingHash=await hash(await current(path));}catch(error){if(error.status!==404)throw error;}
      if((body.base_hash||'')!==existingHash)throw error(409,'This file changed in another session. Copy your edits, then reload the saved file.');
      const bytes=new TextEncoder().encode(action==='save'?body.content:''),group='patch-'+crypto.randomUUID();
      const count=action==='save'?await saveBytes(group,bytes):0,sha256=await hash(bytes);
      const latest=(await models.SourceFileOverlay.filter({archive_id:archive.id,path,owner_id:user.id},'-updated_date',1))[0];
      if((latest?.sha256||'')!==(patchMap.get(path)?.sha256||''))throw error(409,'Another editor saved this file. Reload before saving.');
      const data={owner_id:user.id,archive_id:archive.id,path,group_id:group,part_count:count,byte_count:bytes.length,sha256,deleted:action==='delete'};
      if(latest)await models.SourceFileOverlay.update(latest.id,data);else await models.SourceFileOverlay.create(data);
      return Response.json({success:true,sha256});
    }
    if(action==='download'){
      for(const entry of entries(zip))if(excluded(entry.name))zip.remove(entry.name);
      for(const patch of patches){if(patch.deleted)zip.remove(patch.path);else zip.file(patch.path,await join(patch.group_id,patch.part_count));}
      const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});
      return new Response(bytes,{headers:{'Content-Type':'application/zip','Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(archive.filename),'Cache-Control':'no-store'}});
    }
    throw error(400,'Unknown archive action.');
  }catch(error){return Response.json({error:error.message||'Source archive operation failed.'},{status:error.status||500});}
}
