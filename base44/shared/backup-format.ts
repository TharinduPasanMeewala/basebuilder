export const BACKUP_LIMITS = { compressed:32*1024*1024, expanded:512*1024*1024, file:128*1024*1024, record:8*1024*1024, files:2000, archives:8, total:128*1024*1024 };
export const safeBackupPath = value => typeof value==='string' && value.length<600 && !value.startsWith('/') && !value.includes('\\') && !/^[A-Za-z]:/.test(value) && !value.split('/').some(part=>!part||part==='.'||part==='..');
export function backupEntries(zip) {
  const files=Object.values(zip.files).filter(entry=>!entry.dir);
  if(files.length>BACKUP_LIMITS.files)throw new Error('Database backups support up to 2,000 files.');
  for(const entry of files){const mode=typeof entry.unixPermissions==='string'?parseInt(entry.unixPermissions,8):entry.unixPermissions||0;if(!safeBackupPath(entry.name)||!safeBackupPath(entry.unsafeOriginalName||entry.name)||(mode&0o170000)===0o120000)throw new Error('The backup contains an unsafe path or symbolic link.');}
  const data=files.filter(entry=>/(^|\/)entities\/[A-Za-z][A-Za-z0-9_]{0,99}\.json$/.test(entry.name));
  if(!data.length)throw new Error('Choose a JSON database backup with entities/EntityName.json files.');
  const roots=new Set(data.map(entry=>entry.name.slice(0,entry.name.lastIndexOf('entities/'))));
  if(roots.size!==1)throw new Error('A database ZIP must contain one entities directory.');
  const root=[...roots][0],allowed=new Set(data.map(entry=>entry.name));
  for(const entry of files)if(!allowed.has(entry.name)&&entry.name!==root+'manifest.json'&&!/\.(?:md|txt)$/i.test(entry.name)&&!/(^|\/)(?:\.DS_Store|__MACOSX)(?:\/|$)/.test(entry.name))throw new Error('Unsupported database backup file: '+entry.name+'. Use JSON table backups.');
  let expanded=0;
  const tables=data.map(entry=>{const name=entry.name.slice((root+'entities/').length,-5),size=Number(entry._data?.uncompressedSize||0);if(name.startsWith('Runtime'))throw new Error('Reserved database table: '+name);if(size>BACKUP_LIMITS.file)throw new Error('A database table exceeds 128 MB.');expanded+=size;return {name,entry,bytes:size};});
  if(expanded>BACKUP_LIMITS.expanded)throw new Error('Expanded database backup exceeds 512 MB.');
  return {root,tables,expanded,manifest:zip.file(root+'manifest.json')};
}
export async function* entryChunks(entry,maximum=BACKUP_LIMITS.file) {
  let size=0,closed=false;
  const stream=entry.internalStream('uint8array');
  const readable=new ReadableStream({start(controller){stream.on('data',chunk=>{stream.pause();if(closed)return;size+=chunk.length;if(size>maximum){closed=true;controller.error(new Error('Expanded database file exceeds its limit.'));return;}controller.enqueue(chunk);});stream.on('end',()=>{if(!closed){closed=true;controller.close();}});stream.on('error',error=>{if(!closed){closed=true;controller.error(error);}});},pull(){if(!closed)stream.resume();},cancel(){closed=true;stream.pause();}});
  for await(const chunk of readable)yield chunk;
}
export async function smallEntry(entry,maximum=1024*1024) {
  const chunks=[];let size=0;for await(const chunk of entryChunks(entry,maximum)){chunks.push(chunk);size+=chunk.length;}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export async function inspectBackupZip(zip,{verifySizes=false}={}) {
  const layout=backupEntries(zip);let manifest={};
  if(layout.manifest){try{manifest=JSON.parse(await smallEntry(layout.manifest));}catch{throw new Error('The database manifest is not valid JSON.');}}
  const counts={};let declared=0,complete=true;
  for(const table of layout.tables){const count=manifest.summary?.[table.name];if(Number.isSafeInteger(count)&&count>=0){counts[table.name]=count;declared+=count;}else complete=false;}
  if(verifySizes){let expanded=0;for(const table of layout.tables)for await(const chunk of entryChunks(table.entry)){expanded+=chunk.length;if(expanded>BACKUP_LIMITS.expanded)throw new Error('Expanded database backup exceeds 512 MB.');}}
  return {kind:'database',table_count:layout.tables.length,tables:layout.tables.map(table=>table.name).sort(),expanded_bytes:layout.expanded,record_count:complete?declared:null,counts,counts_verified:false,backup_timestamp:typeof manifest.timestamp==='string'?manifest.timestamp:null,note:typeof manifest.note==='string'?manifest.note.slice(0,1000):'',has_user_records:layout.tables.some(table=>table.name==='User'),has_binary_files:false};
}
// Read one record at a time. Table JSON never has to fit in memory as an array.
export async function* backupRecords(entry) {
  const decoder=new TextDecoder('utf-8',{fatal:true});let begun=false,ended=false,active=false,depth=0,quoted=false,escape=false,expectValue=true,allowEnd=true,pieces=[],bytes=0;
  async function* parse(text) {
    let start=active?0:-1;
    for(let i=0;i<text.length;i++){
      const char=text[i];
      if(!active){
        if(/\s/.test(char))continue;
        if(ended)throw new Error('Unexpected data after the table array.');
        if(!begun){if(char!=='[')throw new Error('Entity JSON must contain an array of record objects.');begun=true;continue;}
        if(char===']'&&allowEnd){ended=true;continue;}
        if(!expectValue){if(char!==',')throw new Error('Missing comma between database records.');expectValue=true;allowEnd=false;continue;}
        if(char!=='{')throw new Error('Database rows must be JSON objects.');
        active=true;depth=1;quoted=false;escape=false;start=i;continue;
      }
      if(quoted){if(escape)escape=false;else if(char==='\\')escape=true;else if(char==='"')quoted=false;}
      else if(char==='"')quoted=true;
      else if(char==='{'||char==='[')depth++;
      else if(char==='}'||char===']')depth--;
      if(depth===0){
        pieces.push(text.slice(start,i+1));bytes+=i+1-start;if(bytes>BACKUP_LIMITS.record)throw new Error('A database record exceeds 8 MB.');
        let row;try{row=JSON.parse(pieces.join(''));}catch{throw new Error('A database record contains invalid JSON.');}
        if(!row||Array.isArray(row)||typeof row.id!=='string'||!row.id||row.id.length>240)throw new Error('Each database record must have a valid original string ID.');
        pieces=[];bytes=0;active=false;expectValue=false;allowEnd=true;start=-1;yield row;
      }
    }
    if(active){pieces.push(text.slice(start));bytes+=text.length-start;if(bytes>BACKUP_LIMITS.record)throw new Error('A database record exceeds 8 MB.');}
  }
  for await(const chunk of entryChunks(entry))yield* parse(decoder.decode(chunk,{stream:true}));
  yield* parse(decoder.decode());
  if(!begun||!ended||active)throw new Error('The database table JSON is incomplete.');
}
