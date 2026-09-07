import React from 'react';
import { LayoutDashboard, FileText } from 'lucide-react';
import Designable from '@/components/live-preview/Designable';

export default function PreviewScreenNavigation({ pages, active, onNavigate, name, editProps, designSystem }) {
  return <Designable {...editProps} className="w-36 shrink-0 border-r p-3" style={{ background: designSystem.sidebar_dark ? 'hsl(var(--sidebar-bg))' : designSystem.surface_color, color: designSystem.sidebar_dark ? 'hsl(var(--sidebar-fg))' : designSystem.text_color }}>
    <h3 className="font-bold text-sm mb-4 break-words">{name || 'App'}</h3>
    <nav className="space-y-1">{pages.map(page => { const Icon = page.type === 'dashboard' ? LayoutDashboard : FileText; return <button key={page.id} type="button" onClick={() => onNavigate(page.id)} className={`w-full flex items-center gap-2 text-left px-2 py-2 rounded-md text-xs ${page.id === active?.id ? 'font-semibold bg-primary/10' : 'hover:bg-muted'}`} style={page.id === active?.id ? { color: designSystem.primary_color } : undefined}><Icon className="w-3.5 h-3.5 shrink-0" /><span className="break-words">{page.name}</span></button>; })}</nav>
  </Designable>;
}