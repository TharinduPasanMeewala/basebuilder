import React,{useEffect,useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {base44} from '@/api/base44Client';
import DesignGeneratorDialog from '@/components/project/DesignGeneratorDialog';

export default function ImageImportDialog({open,onClose,project,onImported}){
  const client=useQueryClient(),[data,setData]=useState({entities:[],pages:[],design:{}}),[error,setError]=useState('');
  useEffect(()=>{let active=true;if(open){setError('');Promise.all([base44.entities.DataEntity.filter({project_id:project.id}),base44.entities.PageSpec.filter({project_id:project.id}),base44.entities.ProjectDesign.filter({project_id:project.id},'-updated_date',1)]).then(([entities,pages,designs])=>{if(active)setData({entities,pages,design:designs[0]||{}});}).catch(error=>{if(active)setError(error.message);});}return()=>{active=false;};},[open,project.id]);
  return <><DesignGeneratorDialog open={open} onClose={onClose} project={project} {...data} onApplied={async()=>{await Promise.all(['dataEntitiesForPreview','pageSpecsForPreview','projectDesign'].map(key=>client.invalidateQueries({queryKey:[key,project.id]})));onImported?.();}}/>{open&&error&&<p role="alert" className="text-destructive text-sm">{error}</p>}</>;
}
