import React from 'react';
import { LayoutDashboard, FileText } from 'lucide-react';
import Designable from '@/components/live-preview/Designable';

export default function PreviewScreenNavigation({ pages, active, onNavigate, name, editProps, designSystem }) {
  return <Designable {...editProps} className="bb-nav" style={{background:designSystem.sidebar_color,color:designSystem.sidebar_text}}>
    <div className="bb-logo" title={name||'App'}><span className="bb-mark">{(name||'A').slice(0,1).toUpperCase()}</span><span className="bb-logo-text break-words">{name||'App'}</span></div>
    <div><p className="bb-nav-label">Workspace</p><nav className="bb-nav-items">{pages.map(page=>{const Icon=page.type==='dashboard'?LayoutDashboard:FileText;return <button key={page.id} type="button" title={page.name} aria-label={page.name} aria-current={page.id===active?.id?'page':undefined} onClick={()=>onNavigate(page.id)} className="bb-nav-item"><Icon className="bb-icon"/><span>{page.name}</span></button>;})}</nav></div>
    <div className="bb-nav-foot">{pages.length} screens<br/>Built around your workflow</div>
  </Designable>;
}
