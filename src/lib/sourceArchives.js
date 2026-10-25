import JSZip from 'jszip';
import { base44 } from '@/api/base44Client';
import { analyzeSource, convertStandalone, isTextPath, safeArchivePath, excludedSourcePath } from '@/lib/standaloneConversion';
import { mirrorPublicAssets } from '@/lib/sourceAssets';

export async function archiveCall(action, data = {}) {
  try {
    const response = await base44.functions.invoke('source-archive', { action, ...data });
    if (response.data?.error) throw new Error(response.data.error);
    return response.data;
  } catch (error) { throw new Error(error.response?.data?.error || error.message || 'Source archive request failed.'); }
}
async function boundedEntry(entry) {
  return new Promise((resolve,reject)=>{
    const chunks=[];let size=0,stopped=false;const stream=entry.internalStream('uint8array');
    stream.on('data',chunk=>{if(stopped)return;size+=chunk.length;if(size>12*1024*1024){stopped=true;stream.pause();reject(new Error('An expanded file exceeds 12 MB.'));return;}chunks.push(chunk);});
    stream.on('error',reject);stream.on('end',()=>{if(stopped)return;const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}resolve(bytes);});stream.resume();
  });
}
export async function inspectArchive(file) {
  if (!file || file.size > 15 * 1024 * 1024) throw new Error('Choose a ZIP file smaller than 15 MB.');
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter(entry => !entry.dir);
  if (entries.length > 5000) throw new Error('Import at most 5,000 files.');
  for (const entry of entries) {
    if (!safeArchivePath(entry.unsafeOriginalName || entry.name) || !safeArchivePath(entry.name) || (Number(entry.unixPermissions || 0) & 0o170000) === 0o120000) throw new Error('This ZIP contains an unsafe path or symbolic link.');
  }
  const packagePaths = entries.filter(entry => /(^|\/)package\.json$/.test(entry.name) && !excludedSourcePath(entry.name)).map(entry => entry.name).sort((a,b) => a.split('/').length - b.split('/').length);
  if (!packagePaths.length) throw new Error('No package.json was found. Upload the application’s source ZIP.');
  if (packagePaths.filter(path=>path.split('/').length===packagePaths[0].split('/').length).length>1) throw new Error('This ZIP contains multiple application roots. ZIP one complete application root at a time.');
  const root = packagePaths[0].replace(/package\.json$/, '');
  if (entries.some(entry=>!entry.name.startsWith(root)&&!excludedSourcePath(entry.name))) throw new Error('The ZIP has source files outside the detected application root. Place all app files under one root before importing.');
  const selected = entries.filter(entry => entry.name.startsWith(root) && !excludedSourcePath(entry.name.slice(root.length)));
  const declared = selected.reduce((sum, entry) => sum + Number(entry._data?.uncompressedSize || 0), 0);
  if (declared > 80 * 1024 * 1024 || selected.some(entry => Number(entry._data?.uncompressedSize || 0) > 12 * 1024 * 1024)) throw new Error('Expanded source exceeds the import limits (80 MB total, 12 MB per file).');
  const files = [], clean = new JSZip();let expanded=0;
  for (const entry of selected) {
    const path = entry.name.slice(root.length), bytes = await boundedEntry(entry);expanded+=bytes.length;if(expanded>80*1024*1024)throw new Error('Expanded source exceeds 80 MB.');
    clean.file(path, bytes);
    files.push({ path, content: isTextPath(path) ? new TextDecoder().decode(bytes) : bytes });
  }
  return { zip: clean, files, analysis: analyzeSource(files), excluded: entries.length - selected.length, originalName: file.name, root };
}
export async function uploadArchive(inspected, name, progress = () => {}) {
  progress('Compressing complete source…', 5);
  const bytes = await inspected.zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
  if (bytes.length > 15 * 1024 * 1024) throw new Error('Prepared ZIP exceeds 15 MB.');
  const digest = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2,'0')).join('');
  let text = ''; for (let i=0;i<bytes.length;i+=8192) text += String.fromCharCode(...bytes.subarray(i,i+8192));
  const encoded = btoa(text), parts = [];
  for (let i=0;i<encoded.length;i+=16384) parts.push({ index: parts.length, content: encoded.slice(i,i+16384) });
  const { archive_id } = await archiveCall('begin', { project_name: name, filename: inspected.originalName, sha256: digest, compressed_bytes: bytes.length, part_count: parts.length });
  for (let i=0;i<parts.length;i+=32) {
    await archiveCall('parts', { archive_id, parts: parts.slice(i,i+32) });
    progress('Saving source files and binary assets…', 10 + Math.round((Math.min(i+32,parts.length)/parts.length)*70));
  }
  progress('Verifying checksum and creating project…', 90);
  const result = await archiveCall('finalize', { archive_id }); progress('Import complete', 100); return result;
}
export async function downloadArchiveBlob(projectId) {
  const response = await base44.functions.fetch('/source-archive', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ action:'download', project_id: projectId }) });
  if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Could not download source.'); }
  return response.blob();
}
let templatePromise;
async function templates() {
  templatePromise ||= fetch('/standalone-runtime.json').then(response => { if (!response.ok) throw new Error('Standalone runtime templates could not be loaded.'); return response.json(); }).catch(error => { templatePromise = undefined; throw error; });
  return templatePromise;
}
export async function standaloneArchive(project, domain, progress = () => {}) {
  progress('Loading complete saved source…');
  const zip = await JSZip.loadAsync(await downloadArchiveBlob(project.id));
  const files = [];
  for (const entry of Object.values(zip.files).filter(entry => !entry.dir)) {
    const bytes = await entry.async('uint8array');
    files.push({ path: entry.name, content: isTextPath(entry.name) ? new TextDecoder().decode(bytes) : bytes });
  }
  progress('Converting backend functions and adding an independent runtime…');
  const mirrored=await mirrorPublicAssets(files,progress);
  const converted = convertStandalone(mirrored.files, await templates(), { name:project.name, domain:domain||undefined, publicUrl:domain ? 'https://'+domain : undefined,assetMap:mirrored.assetMap });
  if(mirrored.missing.length){converted.report.missing_public_assets=mirrored.missing;converted.report.configuration_required.push('Some referenced public assets could not be copied. Migrate the listed assets manually.');}
  const reportFile=converted.files.find(file=>file.path==='migration/report.json');if(reportFile)reportFile.content=JSON.stringify(converted.report,null,2);
  const output = new JSZip();
  for (const file of converted.files) output.file(file.path,file.content);
  progress('Preparing standalone ZIP…');
  return { blob:await output.generateAsync({type:'blob',compression:'DEFLATE'}), report:converted.report };
}
export function saveDownload(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function applySourceEdits(source, edits) {
  let next = source;
  if (!Array.isArray(edits) || edits.length > 30) throw new Error('AI returned an invalid edit list.');
  for (const edit of edits) {
    if (typeof edit.old_text !== 'string' || !edit.old_text || typeof edit.new_text !== 'string') throw new Error('AI edits must contain exact old and new text.');
    const count = next.split(edit.old_text).length - 1;
    if (!count || count > 1 && !edit.replace_all) throw new Error('An AI edit did not match one unique location. No draft changes were applied.');
    next = edit.replace_all ? next.split(edit.old_text).join(edit.new_text) : next.replace(edit.old_text, () => edit.new_text);
  }
  return next;
}
