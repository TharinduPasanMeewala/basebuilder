import {normalizeDesign,designVariables} from './designSystem.js';

export function exportDesign(design){const normalized=normalizeDesign(design);delete normalized.reference_summary;delete normalized.design_notes;return normalized;}
export function buildLayoutExport(name,pages,design){
  const d=exportDesign(design),navigation=pages.map((page,index)=>({path:page.route,label:page.label,index}));
  return `import {Link,useLocation,Outlet} from 'react-router-dom'
import {ProductGlyph} from './ProductSurface.jsx'
const NAME=${JSON.stringify(d.app_name||name)}
const DESIGN=${JSON.stringify(d)}
const VARIABLES=${JSON.stringify(designVariables(d))}
const NAV=${JSON.stringify(navigation)}
export default function Layout(){const {pathname}=useLocation();const active=NAV.find(item=>item.path===pathname)||NAV[0];return <div className="bb-design" data-layout={DESIGN.layout} data-composition={DESIGN.dashboard_layout} style={VARIABLES}><div className="bb-shell" style={{minHeight:'100vh'}}><aside className="bb-nav"><div className="bb-logo"><span className="bb-mark">{NAME.slice(0,1).toUpperCase()}</span><span className="bb-logo-text">{NAME}</span></div><div><p className="bb-nav-label">Workspace</p><nav className="bb-nav-items">{NAV.map(item=><Link key={item.path} to={item.path} className="bb-nav-item" aria-label={item.label} aria-current={pathname===item.path?'page':undefined}><ProductGlyph index={item.index}/><span>{item.label}</span></Link>)}</nav></div><div className="bb-nav-foot">{NAV.length} screens<br/>Your workspace, organized</div></aside><main className="bb-main"><div className="bb-topline"><span className="bb-breadcrumb">Workspace / <strong>{active.label}</strong></span><span className="bb-account"><span className="bb-account-label">{NAME}</span><span className="bb-avatar">{NAME.slice(0,1).toUpperCase()}</span></span></div><div className="bb-content"><Outlet/></div></main></div></div>}
`;
}
export function buildDashboardExport(project,pages,design,storageKey,landing=false){
  const d=exportDesign(design),models=pages.filter(page=>page.entity).map((page,index)=>({id:'model-'+index,name:page.entity.name,description:page.entity.description||'',route:page.route,storageKey:storageKey(project.name,page.entity.name)}));
  return `import {useEffect,useState} from 'react'
import {useNavigate} from 'react-router-dom'
import {ProductDashboard,ProductLanding} from '../components/ProductSurface.jsx'
const DESIGN=${JSON.stringify(d)}
const MODELS=${JSON.stringify(models)}
export default function DashboardPage(){const navigate=useNavigate();const [records,setRecords]=useState([]);const [error,setError]=useState('');useEffect(()=>{const load=()=>{try{const rows=MODELS.flatMap(model=>{const data=JSON.parse(localStorage.getItem(model.storageKey)||'[]');if(!Array.isArray(data))throw new Error('Invalid records');return data.filter(row=>row&&typeof row==='object').map(row=>({id:row.id,entity_name:model.name,record_data:row}));});setRecords(rows);setError('');}catch{setError('Some saved records could not be read. Check browser storage before changing data.');}};load();window.addEventListener('storage',load);return()=>window.removeEventListener('storage',load);},[]);const Surface=${landing?'ProductLanding':'ProductDashboard'};return <><div className="bb-heading"><div><h2>Overview</h2><p>Your workspace at a glance</p></div></div>{error&&<p role="alert">{error}</p>}<Surface design={DESIGN} name={${JSON.stringify(d.app_name||project.name)}} description={${JSON.stringify(project.description||'')}} entities={MODELS} records={records} onNavigate={model=>model?.route&&navigate(model.route)}/></>}
`;
}
