import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Calendar, Layers, ArrowRight, MoreHorizontal, Archive } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { base44 } from '@/api/base44Client';

const PHASE_COLORS = {
  discovery: 'bg-blue-500/15 text-blue-600 border-blue-200',
  analysis: 'bg-purple-500/15 text-purple-600 border-purple-200',
  design: 'bg-pink-500/15 text-pink-600 border-pink-200',
  architecture: 'bg-orange-500/15 text-orange-600 border-orange-200',
  review: 'bg-yellow-500/15 text-yellow-600 border-yellow-200',
  generation: 'bg-green-500/15 text-green-600 border-green-200',
  completed: 'bg-emerald-500/15 text-emerald-600 border-emerald-200',
};

const TYPE_LABELS = {
  saas_product: 'SaaS Product',
  erp_system: 'ERP System',
  crm_system: 'CRM System',
  hr_system: 'HR System',
  inventory_system: 'Inventory',
  warehouse_system: 'Warehouse',
  accounting_system: 'Accounting',
  ecommerce_platform: 'E-commerce',
  internal_tool: 'Internal Tool',
  custom_application: 'Custom App',
  project_management: 'Project Mgmt',
  service_management: 'Service Mgmt',
  customer_portal: 'Customer Portal',
};

export default function ProjectCard({ project, onDeleted }) {
  const navigate = useNavigate();

  const handleArchive = async (e) => {
    e.stopPropagation();
    await base44.entities.Project.update(project.id, { status: 'archived' });
    onDeleted?.();
  };

  const score = project.completeness_score || 0;

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      className="group bg-card border border-border rounded-xl p-5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all duration-200 animate-fade-in"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-sm leading-tight truncate group-hover:text-primary transition-colors">
            {project.name}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{TYPE_LABELS[project.type] || project.type}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleArchive} className="text-destructive">
              <Archive className="w-4 h-4 mr-2" /> Archive
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {project.description && (
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2 leading-relaxed">{project.description}</p>
      )}

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-muted-foreground">Completeness</span>
          <span className="text-xs font-semibold text-foreground">{score}%</span>
        </div>
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all duration-500"
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${PHASE_COLORS[project.phase] || 'bg-muted text-muted-foreground border-border'}`}>
            {project.phase}
          </span>
          {project.industry && (
            <span className="text-xs text-muted-foreground">{project.industry}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="w-3 h-3" />
          <span>{new Date(project.created_date).toLocaleDateString()}</span>
        </div>
      </div>
    </div>
  );
}