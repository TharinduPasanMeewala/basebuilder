import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, MessageSquare, FileText, Database, Layout,
  GitBranch, Code, Sparkles, ChevronRight, Users, Rocket, Globe, Zap, Package, Eye
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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
import PreviewSection from '@/components/project/PreviewSection';

const SECTIONS = [
  { key: 'chat', label: 'AI Chat', icon: MessageSquare },
  { key: 'roundtable', label: 'Roundtable', icon: Users },
  { key: 'requirements', label: 'Requirements', icon: FileText },
  { key: 'database', label: 'Data Model', icon: Database },
  { key: 'pages', label: 'UI/Pages', icon: Layout },
  { key: 'workflows', label: 'Workflows', icon: GitBranch },
  { key: 'apis', label: 'APIs', icon: Code },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'blueprint', label: 'Blueprint', icon: Sparkles },
  { key: 'development', label: 'Development', icon: Rocket },
  { key: 'deploy', label: 'Deploy', icon: Globe },
  { key: 'publish', label: 'Publish', icon: Zap },
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
  const [activeSection, setActiveSection] = useState('chat');
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
    const p = await base44.entities.Project.filter({ id });
    if (p?.[0]) setProject(p[0]);
    setLoading(false);
  };

  const loadCounts = async () => {
    const [reqs, entities, pages, workflows, apis] = await Promise.all([
      base44.entities.Requirement.filter({ project_id: id }),
      base44.entities.DataEntity.filter({ project_id: id }),
      base44.entities.PageSpec.filter({ project_id: id }),
      base44.entities.WorkflowSpec.filter({ project_id: id }),
      base44.entities.ApiEndpoint.filter({ project_id: id }),
    ]);
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

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-muted-foreground">Project not found</p>
        <Button variant="ghost" onClick={() => navigate('/projects')}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects
        </Button>
      </div>
    );
  }

  const score = project.completeness_score || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-4 mb-3">
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
                onClick={() => navigate(`/projects/${id}/published`)}
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
        {/* Phase stepper */}
        <PhasesStepper currentPhase={project.phase} onPhaseClick={() => {}} />
      </div>

      {/* Section nav + content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Section sidebar */}
        <div className="hidden lg:flex flex-col w-44 border-r border-border bg-card/50 flex-shrink-0 py-3 px-2 gap-0.5">
          {SECTIONS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              className={`flex items-center justify-between px-3 py-2 rounded-md text-xs transition-all ${
                activeSection === key
                  ? 'bg-primary text-primary-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              <div className="flex items-center gap-2">
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{label}</span>
              </div>
              {counts[key] > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeSection === key ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-muted text-muted-foreground'
                }`}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Mobile tabs */}
        <div className="lg:hidden w-full overflow-hidden flex flex-col">
          <div className="flex overflow-x-auto border-b border-border bg-card px-2 py-1 gap-1 flex-shrink-0">
            {SECTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs whitespace-nowrap transition-all ${
                  activeSection === key ? 'bg-primary text-primary-foreground font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-hidden">
            <SectionContent section={activeSection} project={project} onRefresh={refreshProject} />
          </div>
        </div>

        {/* Desktop content */}
        <div className="hidden lg:flex flex-1 overflow-hidden">
          <SectionContent section={activeSection} project={project} onRefresh={refreshProject} />
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
    case 'preview': return <PreviewSection project={project} onRefresh={onRefresh} />;
    case 'blueprint': return <BlueprintSection project={project} onRefresh={onRefresh} />;
    case 'development': return <AppDevelopmentSection project={project} onRefresh={onRefresh} />;
    case 'deploy': return <DeploySection project={project} onRefresh={onRefresh} />;
    case 'publish': return <PublishSection project={project} onRefresh={onRefresh} />;
    default: return <ChatSection project={project} onRefresh={onRefresh} />;
  }
}