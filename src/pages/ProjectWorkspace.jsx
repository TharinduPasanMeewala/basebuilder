import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, FileText, Database, Layout,
  GitBranch, Code, Sparkles, Users, Rocket, Globe, Zap, Package, Eye, History, MonitorPlay
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import PhasesStepper from '@/components/project/PhasesStepper';
import ChatSection from '@/components/project/ChatSection';
import RequirementsSection from '@/components/project/RequirementsSection';
import DatabaseSection from '@/components/project/DatabaseSection';
import PagesSection from '@/components/project/PagesSection';
import WorkflowsSection from '@/components/project/WorkflowsSection';
import ApisSection from '@/components/project/ApisSection';
import BlueprintSection from '@/components/project/BlueprintSection';
import AgentRoundtable from '@/components/project/AgentRoundtable';
import AppDevelopmentSection from '@/components/project/AppDevelopmentSection';
import DeploySection from '@/components/project/DeploySection';
import PublishSection from '@/components/project/PublishSection';
import LivePreviewSection from '@/components/LivePreviewSection';
import VersionsSection from '@/components/project/VersionsSection';
import StudioSection from '@/components/project/StudioSection';

import AIModelPicker from '@/components/project/AIModelPicker';
import { confirmWorkspaceNavigation } from '@/hooks/useUnsavedChanges';

const SECTIONS = [
  { key: 'chat', label: 'AI Chat', icon: MessageSquare },
  { key: 'roundtable', label: 'Roundtable', icon: Users },
  { key: 'requirements', label: 'Requirements', icon: FileText },
  { key: 'database', label: 'Data Model', icon: Database },
  { key: 'pages', label: 'UI/Pages', icon: Layout },
  { key: 'workflows', label: 'Workflows', icon: GitBranch },
  { key: 'apis', label: 'APIs', icon: Code },
  { key: 'studio', label: 'Studio', icon: MonitorPlay },
  { key: 'live-preview', label: 'Live Preview', icon: Eye },
  { key: 'blueprint', label: 'Blueprint', icon: Sparkles },
  { key: 'development', label: 'Development', icon: Rocket },
  { key: 'deploy', label: 'Hosting', icon: Globe },
  { key: 'publish', label: 'Code package', icon: Zap },
  { key: 'versions', label: 'Versions', icon: History },
];

const TYPE_LABELS = {
  saas_product: 'SaaS Product', erp_system: 'ERP System', crm_system: 'CRM System',
  hr_system: 'HR System', inventory_system: 'Inventory', warehouse_system: 'Warehouse',
  accounting_system: 'Accounting', ecommerce_platform: 'E-commerce', internal_tool: 'Internal Tool',
  custom_application: 'Custom App', project_management: 'Project Mgmt',
  service_management: 'Service Mgmt', customer_portal: 'Customer Portal',
};

export default function ProjectWorkspace() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeSection = SECTIONS.some(item => item.key === searchParams.get('section')) ? searchParams.get('section') : 'studio';
  const setActiveSection = section => {
    if (section === activeSection || !confirmWorkspaceNavigation()) return;
    const next = new URLSearchParams(searchParams); next.set('section', section); setSearchParams(next);
  };
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({});

  useEffect(() => {
    loadProject();
  }, [id]);

  useEffect(() => {
    if (project) loadCounts();
  }, [project]);

  const loadProject = async () => {
    setLoading(true);
    setError('');
    try { const p = await base44.entities.Project.filter({ id }); setProject(p?.[0] || null); }
    catch (err) { setError(err.message || 'Could not load this project.'); }
    finally { setLoading(false); }
  };

  const loadCounts = async () => {
    const results = await Promise.allSettled([
      base44.entities.Requirement.filter({ project_id: id }),
      base44.entities.DataEntity.filter({ project_id: id }),
      base44.entities.PageSpec.filter({ project_id: id }),
      base44.entities.WorkflowSpec.filter({ project_id: id }),
      base44.entities.ApiEndpoint.filter({ project_id: id }),
    ]);
    const [reqs, entities, pages, workflows, apis] = results.map(result => result.status === 'fulfilled' ? result.value : []);
    setCounts({
      requirements: reqs.length,
      database: entities.length,
      pages: pages.length,
      workflows: workflows.length,
      apis: apis.length,
    });
  };

  const refreshProject = async () => {
    const p = await base44.entities.Project.filter({ id });
    if (p?.[0]) setProject(p[0]);
    loadCounts();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (error) return <div role="alert" className="p-6 text-sm text-destructive">{error}<Button variant="outline" className="ml-3" onClick={loadProject}>Retry</Button></div>;

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="ghost" onClick={() => confirmWorkspaceNavigation() && navigate('/projects')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects
        </Button>
      </div>
    );
  }

  const score = Math.min(100, Math.max(0, project.completeness_score || 0));

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex-shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => navigate('/projects')}
              className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-foreground text-sm truncate">{project.name}</h1>
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full flex-shrink-0">
                  {TYPE_LABELS[project.type] || project.type}
                </span>
              </div>
              {project.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{project.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${score}%` }} />
              </div>
              <span className="font-medium text-foreground">{score}%</span>
            </div>
            {project.phase === 'completed' && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 text-primary border-primary/30"
                onClick={() => confirmWorkspaceNavigation() && navigate(`/projects/${id}/published`)}
              >
                <Package className="w-3.5 h-3.5" />
                Code Package
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => setActiveSection('blueprint')}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Generate
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3 mb-3"><AIModelPicker /><span className="text-[11px] text-muted-foreground">One model connection across your builder tools</span></div>
        {/* Phase stepper */}
        <PhasesStepper currentPhase={project.phase} onPhaseClick={phase => setActiveSection(({ discovery: 'chat', analysis: 'requirements', design: 'studio', architecture: 'blueprint', review: 'roundtable', generation: 'publish', completed: 'publish' })[phase] || 'studio')} />
      </div>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden min-h-0">
        <nav aria-label="Builder sections" className="hidden lg:flex flex-col w-44 border-r border-border bg-card/50 flex-shrink-0 py-3 px-2 gap-0.5 overflow-y-auto">
          {SECTIONS.map(({ key, label, icon: Icon }) => <button key={key} aria-current={activeSection === key ? 'page' : undefined} onClick={() => setActiveSection(key)}
            className={'flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors ' + (activeSection === key ? 'bg-primary text-primary-foreground font-semibold' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
            <span className="flex items-center gap-2"><Icon className="w-3.5 h-3.5 shrink-0" />{label}</span>
            {counts[key] > 0 && <span className="text-[10px] rounded-full px-1.5 py-0.5 bg-background/15">{counts[key]}</span>}
          </button>)}
        </nav>
        <div className="lg:hidden border-b border-border bg-card p-2 flex gap-3 items-center">
          <label htmlFor="workspace-section" className="text-xs text-muted-foreground shrink-0">Workspace</label>
          <select id="workspace-section" className="w-full rounded-lg bg-background border border-border p-2 text-sm" value={activeSection} onChange={event => setActiveSection(event.target.value)}>
            {SECTIONS.map(section => <option key={section.key} value={section.key}>{section.label}{counts[section.key] ? ' (' + counts[section.key] + ')' : ''}</option>)}
          </select>
        </div>
        <div className="flex flex-1 min-w-0 min-h-0 overflow-hidden">
          <SectionContent key={project.id + ':' + activeSection} section={activeSection} project={project} onRefresh={refreshProject} />
        </div>
      </div>
    </div>
  );
}

function SectionContent({ section, project, onRefresh }) {
  switch (section) {
    case 'chat': return <ChatSection project={project} onRefresh={onRefresh} />;
    case 'requirements': return <RequirementsSection project={project} onRefresh={onRefresh} />;
    case 'database': return <DatabaseSection project={project} onRefresh={onRefresh} />;
    case 'pages': return <PagesSection project={project} onRefresh={onRefresh} />;
    case 'workflows': return <WorkflowsSection project={project} onRefresh={onRefresh} />;
    case 'apis': return <ApisSection project={project} onRefresh={onRefresh} />;
    case 'roundtable': return <AgentRoundtable project={project} />;
    case 'studio': return <StudioSection project={project} onRefresh={onRefresh} />;
    case 'live-preview': return <LivePreviewSection project={project} />;
    case 'blueprint': return <BlueprintSection project={project} onRefresh={onRefresh} />;
    case 'development': return <AppDevelopmentSection project={project} onRefresh={onRefresh} />;
    case 'deploy': return <DeploySection project={project} onRefresh={onRefresh} />;
    case 'publish': return <PublishSection project={project} onRefresh={onRefresh} />;
    case 'versions': return <VersionsSection project={project} onRefresh={onRefresh} />;
    default: return <ChatSection project={project} onRefresh={onRefresh} />;
  }
}