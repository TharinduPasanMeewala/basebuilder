import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {DESIGN_PRESETS,normalizeDesign,designVariables,designSampleRecords,DESIGN_CSS} from '../src/lib/designSystem.js';
import {buildLayoutExport,buildDashboardExport,exportDesign} from '../src/lib/designCodegen.js';
const load=source=>import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
test('visual directions survive normalization, bounds reject CSS injection and square corners remain valid',()=>{
  for(const preset of DESIGN_PRESETS){const design=normalizeDesign({...preset,visual_preset:preset.id});assert.equal(design.primary_color,preset.primary_color);assert.equal(design.layout,preset.layout);assert.equal(designVariables(design)['--bb-nav'],preset.sidebar_color);}
  const input={visual_preset:'noir',primary_color:'red; background:url(https://bad.example)',font_family:'url(x)',radius:0,nav_width:99999,sections:['records','records','script'],feature_cards:[{title:'Useful',description:'Plain text'}],__proto__:{unsafe:true}};
  const result=normalizeDesign(input);assert.equal(result.radius,0);assert.equal(result.nav_width,300);assert.equal(result.primary_color,'#c5ee71');assert.deepEqual(result.sections,['records']);assert.equal(result.unsafe,undefined);assert.equal(result.font_family,'Inter');assert.match(DESIGN_CSS,/@container\(max-width:560px\)/);assert.match(DESIGN_CSS,/prefers-reduced-motion/);
});
test('sample preview records are marked and never included in exported designs',()=>{
  const rows=designSampleRecords([{name:'Clients',schema:{properties:{name:{type:'string'},stage:{type:'string',enum:['New','Won']},budget:{type:'number'}}}}]);assert.equal(rows.length,8);assert.equal(rows.every(row=>row.sample&&row.id.startsWith('design-sample-')),true);assert.equal(rows[1].record_data.stage,'Won');
  const exported=exportDesign({reference_images:[{file_uri:'private/screenshot'}],reference_summary:'Private note',design_notes:'Private request',primary_color:'#123456'});assert.equal(exported.reference_images,undefined);assert.equal(exported.reference_summary,undefined);assert.equal(exported.design_notes,undefined);
  const pages=[{route:'/',label:'Overview'},{route:'/clients',label:'Clients',entity:{name:'Clients'}}];const layout=buildLayoutExport("Sara's <Workspace>",pages,{layout:'topbar',visual_preset:'noir'}),dashboard=buildDashboardExport({name:'Workspace'},pages,{hero_title:'Designed for the team'},()=> 'workspace-clients-records');assert.match(layout,/bb-design/);assert.match(layout,/aria-current/);assert.match(layout,/"layout":"topbar"/);assert.match(dashboard,/localStorage.getItem/);assert.match(dashboard,/Designed for the team/);assert.doesNotMatch(dashboard,/Northwind Studio/);
});
test('private reference uploads validate file types and renew temporary image links',async()=>{
  let signatures=0,uploads=0;
  globalThis.__referenceClient={integrations:{Core:{UploadPrivateFile:async({file})=>{uploads++;assert.match(file.type,/image\/(png|jpeg)/);return {file_uri:'private/reference-one'};},CreateFileSignedUrl:async({file_uri})=>({signed_url:'https://files.example.com/'+file_uri+'?signature='+(++signatures)})}}};
  const source=(await readFile('src/lib/designReferences.js','utf8')).replace("import { base44 } from '@/api/base44Client';",'const base44=globalThis.__referenceClient;');const api=await load(source);
  assert.throws(()=>api.validateDesignImage({type:'image/svg+xml',size:20}),/PNG/);assert.throws(()=>api.validateDesignImage({type:'image/png',size:11*1024*1024}),/10 MB/);
  const oldImage=globalThis.Image,oldDocument=globalThis.document;
  globalThis.Image=class{naturalWidth=1200;naturalHeight=800;set src(value){queueMicrotask(()=>this.onload());}};
  globalThis.document={createElement:()=>({getContext:()=>({fillRect(){},drawImage(){}}),toBlob:callback=>callback(new Blob(['test image'],{type:'image/png'}))})};
  try{const reference=await api.uploadDesignReference(new File(['raw image'],'screen.png',{type:'image/png'}));assert.equal(uploads,1);assert.equal(reference.width,1200);const saved=api.savedReferences([reference]);assert.equal(saved[0].preview_url,undefined);const one=await api.referenceUrls(saved),two=await api.referenceUrls(saved);assert.notEqual(one[0],two[0]);assert.equal(saved[0].file_uri,'private/reference-one');}finally{globalThis.Image=oldImage;globalThis.document=oldDocument;}
});
test('image design proposals carry real image inputs, preserve existing models and apply only requested changes',async()=>{
  const tables={DataEntity:[{id:'existing',name:'Customers',fields:[{name:'name',type:'string'}]}],EntityDefinition:[],PageSpec:[{id:'dashboard',name:'Dashboard',route:'/',type:'dashboard'}],ProjectDesign:[],ProjectVersion:[]};let serial=0,request;
  const model=name=>({filter:async()=>structuredClone(tables[name]),create:async data=>{const row={...data,id:name+'-'+(++serial)};tables[name].push(row);return row;},update:async(id,data)=>{const row=tables[name].find(row=>row.id===id);Object.assign(row,data);return row;}});
  globalThis.__designClient={entities:new Proxy({},{get:(_,name)=>model(name)})};globalThis.__designInvoke=async value=>{request=value;return {summary:'A refined workspace',design:{visual_preset:'grove',primary_color:'#24745a',layout:'topbar',hero_title:'Work, beautifully organized',sections:['hero','metrics','records']},entities:[],pages:[]};};
  let source=await readFile('src/lib/designGeneration.js','utf8');source=source.replace("import {base44} from '@/api/base44Client';",'const base44=globalThis.__designClient;').replace("import {invokeCodeAI} from '@/lib/codeAI';",'const invokeCodeAI=globalThis.__designInvoke;').replace("'@/lib/designSystem'",JSON.stringify(pathToFileURL(resolve('src/lib/designSystem.js')).href)).replace("import {referenceUrls,savedReferences} from '@/lib/designReferences';","const referenceUrls=async refs=>refs.map(()=> 'https://files.example.com/reference.png?fresh=1');const savedReferences=refs=>refs.map(({file_uri,name})=>({file_uri,name}));");
  const service=await load(source),project={id:'project',name:'CRM'},references=[{file_uri:'private/reference',name:'Design.png',preview_url:'expires'}];
  const proposal=await service.generateDesignProposal(project,{references,entities:tables.DataEntity});assert.deepEqual(request.file_urls,['https://files.example.com/reference.png?fresh=1']);assert.match(request.prompt,/relative panel proportions/);assert.match(request.prompt,/Current models/);
  proposal.entities=[{name:'customers',fields:[{name:'replacement',type:'string'}]},{name:'Invoices',fields:[{name:'total',type:'number'},{name:'constructor',type:'string'}]}];proposal.pages=[{name:'Invoices',type:'list',entity_name:'Invoices',route:'/invoices'},{name:'Broken',type:'list',entity_name:'NoSuchModel'}];
  const result=await service.applyDesignProposal(project,proposal,{references});assert.equal(result.entities,1);assert.equal(result.pages,1);assert.equal(tables.DataEntity[0].fields[0].name,'name');assert.deepEqual(tables.DataEntity[1].fields.map(field=>field.name),['total']);assert.equal(tables.PageSpec[1].components[0].data_source,'Invoices');assert.equal(tables.ProjectDesign[0].hero_title,'Work, beautifully organized');assert.equal(tables.ProjectDesign[0].reference_images[0].preview_url,undefined);
  tables.ProjectDesign[0].app_name='Existing brand';await service.applyDesignProposal(project,proposal,{references});assert.equal(tables.ProjectDesign[0].app_name,'Existing brand');assert.equal(tables.DataEntity.length,2);assert.equal(tables.PageSpec.length,2);
  proposal.entities=[{name:'Unrequested',fields:[{name:'name',type:'string'}]}];await service.applyDesignProposal(project,proposal,{includeModels:false});assert.equal(tables.DataEntity.length,2);
});
test('Gemini gateway fetches bounded image bytes without forwarding API credentials to image storage',async()=>{
  const connection={id:'vision',provider:'gemini',base_url:'https://generativelanguage.googleapis.com/v1beta',model:'gemini-test-vision',api_key:'private-test-key',supports_images:true,max_tokens:8192};
  globalThis.__visionClient=()=>({auth:{me:async()=>({id:'owner',ai_connection_id:'vision'})},asServiceRole:{entities:{AIConnection:{filter:async()=>[connection]}}}});
  const source=(await readFile('base44/functions/ai-gateway/entry.ts','utf8')).replace("import { createClientFromRequest } from 'npm:@base44/sdk';",'const createClientFromRequest=globalThis.__visionClient;').replace("import { lookup } from 'node:dns/promises';","const lookup=async()=>[{address:'93.184.216.34'}];").replace("'./protocol.js'",JSON.stringify(pathToFileURL(resolve('base44/functions/ai-gateway/protocol.js')).href));
  const handler=(await load(source)).default,original=globalThis.fetch,png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4z8AAAAMBAQDJ/pLvAAAAAElFTkSuQmCC';let providerCalls=0,badImage=false,genericMime=false;
  globalThis.fetch=async(url,options)=>{
    if(url.startsWith('https://files.example.com/')){assert.equal(options.headers,undefined);assert.equal(options.redirect,'manual');return new Response(badImage?'this is not an image':Buffer.from(png,'base64'),{headers:{'Content-Type':genericMime?'application/octet-stream':'image/png'}});}
    providerCalls++;assert.equal(options.headers['x-goog-api-key'],'private-test-key');const body=JSON.parse(options.body);assert.deepEqual(body.contents[0].parts[0],{inlineData:{mimeType:'image/png',data:png}});return Response.json({candidates:[{content:{parts:[{text:'Read the design'}]}}]});
  };
  const request=()=>new Request('https://app.example.com/functions/ai-gateway',{method:'POST',body:JSON.stringify({action:'generate',prompt:'Rebuild this design',file_urls:['https://files.example.com/screen.png?signature=one']})});
  try{const response=await handler(request());assert.equal(response.status,200);assert.equal((await response.json()).content,'Read the design');genericMime=true;assert.equal((await handler(request())).status,200);badImage=true;assert.equal((await handler(request())).status,400);assert.equal(providerCalls,2);connection.supports_images=false;assert.equal((await handler(request())).status,400);assert.equal(providerCalls,2);}finally{globalThis.fetch=original;}
});
