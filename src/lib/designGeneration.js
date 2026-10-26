import {base44} from '@/api/base44Client';
import {invokeCodeAI} from '@/lib/codeAI';
import {DESIGN_SCHEMA,DESIGN_QUALITY_PROMPT,normalizeDesign} from '@/lib/designSystem';
import {referenceUrls,savedReferences} from '@/lib/designReferences';

const entitySchema={type:'object',properties:{name:{type:'string'},description:{type:'string'},fields:{type:'array',items:{type:'object',properties:{name:{type:'string'},type:{type:'string',enum:['string','text','number','integer','boolean','date','email','enum']},required:{type:'boolean'},enum_values:{type:'array',items:{type:'string'}}},required:['name','type']}}},required:['name','fields']};
export const DESIGN_PROPOSAL_SCHEMA={type:'object',properties:{summary:{type:'string'},design:DESIGN_SCHEMA,entities:{type:'array',items:entitySchema},pages:{type:'array',items:{type:'object',properties:{name:{type:'string'},description:{type:'string'},route:{type:'string'},type:{type:'string',enum:['dashboard','list','form','report','landing']},entity_name:{type:'string'}},required:['name','type']}}},required:['summary','design','entities','pages']};
export async function generateDesignProposal(project,{entities=[],pages=[],design={},references=[],request='',mode='match',preset='orbit'}={}){
  const urls=await referenceUrls(references);
  const result=await invokeCodeAI({file_urls:urls.length?urls:undefined,prompt:DESIGN_QUALITY_PROMPT+'\n\nProject: '+JSON.stringify({name:project.name,type:project.type,description:project.description})+'\nCurrent models: '+JSON.stringify(entities.map(entity=>({name:entity.name,fields:entity.fields||Object.keys(entity.schema?.properties||{})})))+'\nCurrent screens: '+JSON.stringify(pages.map(page=>({name:page.name,type:page.type,description:page.description})))+'\nCurrent design: '+JSON.stringify(normalizeDesign(design))+'\nPreferred direction: '+preset+'\nReference mode: '+(mode==='match'?'Match the images: preserve their overall layout, palette, proportions, spacing, typography character and visual hierarchy. The reference takes priority over the preferred preset.':'Create an original design inspired by the attached references and preferred direction.')+'\nUser brief: '+String(request||'Create a polished, complete design for this application.').slice(0,5000)+'\nReturn a design plus only MISSING models/pages needed to make the visible UI useful. Use fields visible or strongly implied by the user brief. Do not duplicate current models/screens or import sample records from screenshot text. Every list/form/report page must identify entity_name exactly from current or proposed models. A new project needs an overview dashboard (or landing screen for a marketing-style reference) and relevant working record screens. Include concise reference_summary explaining the image composition when references are attached. Do not claim arbitrary code, integrations, charts of unavailable metrics or unrelated workflows were implemented.',response_json_schema:DESIGN_PROPOSAL_SCHEMA});
  if(!result?.design)throw new Error('The model did not return a usable design. Try again with a clearer brief.');
  return {...result,design:normalizeDesign(result.design)};
}
const key=value=>String(value||'').trim().toLowerCase();
const cleanText=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
export async function applyDesignProposal(project,proposal,{references=[],includeModels=true}={}){
  const [models,legacy,pages,saved]=await Promise.all([base44.entities.DataEntity.filter({project_id:project.id}),base44.entities.EntityDefinition.filter({project_id:project.id}),base44.entities.PageSpec.filter({project_id:project.id}),base44.entities.ProjectDesign.filter({project_id:project.id},'-updated_date',1)]);
  const names=new Set([...models,...legacy].map(model=>key(model.name))),actualNames=new Map([...models,...legacy].map(model=>[key(model.name),model.name])),created={entities:0,pages:0};
  if(includeModels)for(const entity of (proposal.entities||[]).slice(0,12)){
    const name=cleanText(entity.name,60);if(!/^[A-Za-z][A-Za-z0-9_ ]*$/.test(name)||names.has(key(name)))continue;
    const used=new Set();const fields=(entity.fields||[]).slice(0,30).filter(field=>/^[A-Za-z][A-Za-z0-9_]*$/.test(field.name||'')&&!['constructor','prototype','__proto__','id'].includes(field.name)&&!used.has(field.name)&&(used.add(field.name),true)).map(field=>({name:field.name,type:['string','text','number','integer','boolean','date','email','enum'].includes(field.type)?field.type:'string',required:!!field.required,enum_values:Array.isArray(field.enum_values)?field.enum_values.filter(value=>typeof value==='string').slice(0,30):[]}));
    if(!fields.length)continue;
    await base44.entities.DataEntity.create({project_id:project.id,name,description:cleanText(entity.description,500),fields,source:'ai_generated',order_index:models.length+created.entities});names.add(key(name));actualNames.set(key(name),name);created.entities++;
  }
  const pageNames=new Set(pages.map(page=>key(page.name))),routes=new Set(pages.map(page=>page.route));
  const proposed=includeModels?(proposal.pages||[]).slice(0,12):[];
  if(includeModels&&!pages.length&&!proposed.length)proposed.push({name:'Dashboard',type:'dashboard',route:'/'});
  for(const page of proposed){
    const name=cleanText(page.name,80);if(!name||pageNames.has(key(name)))continue;
    const type=['dashboard','list','form','report','landing'].includes(page.type)?page.type:'list',binding=actualNames.get(key(page.entity_name));if(!['dashboard','landing'].includes(type)&&!binding)continue;
    let route=/^\/[A-Za-z0-9/_-]*$/.test(page.route||'')?page.route:'/'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-');if(routes.has(route))route='/'+name.toLowerCase().replace(/[^a-z0-9]+/g,'-');if(routes.has(route))continue;
    await base44.entities.PageSpec.create({project_id:project.id,name,type,route,description:cleanText(page.description,800),components:binding?[{type:type==='form'?'form':'table',name,description:cleanText(page.description,800),data_source:binding}]:[],source:'ai_generated',order_index:pages.length+created.pages});pageNames.add(key(name));routes.add(route);created.pages++;
  }
  const design=normalizeDesign(proposal.design),payload={...design,project_id:project.id,reference_images:savedReferences(references),design_notes:cleanText(proposal.summary||design.design_notes,1800)};
  const record=saved[0]?await base44.entities.ProjectDesign.update(saved[0].id,payload):await base44.entities.ProjectDesign.create(payload);
  const versions=await base44.entities.ProjectVersion.filter({project_id:project.id,label:'design_state'},'-created_date',1),snapshot={...design,primary:design.primary_color,app_name:design.app_name||project.name};
  if(versions[0])await base44.entities.ProjectVersion.update(versions[0].id,{snapshot});else await base44.entities.ProjectVersion.create({project_id:project.id,label:'design_state',version_number:1,notes:'Generated visual design',snapshot});
  return {design:record,...created};
}
