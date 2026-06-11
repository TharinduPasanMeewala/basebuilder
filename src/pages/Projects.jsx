import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter, FolderOpen } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import ProjectCard from '@/components/project/ProjectCard';

const PHASES = ['all', 'discovery', 'analysis', 'design', 'architecture', 'review', 'generation', 'completed'];
const TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'erp_system', label: 'ERP System' },
  { value: 'crm_system', label: 'CRM System' },
  { value: 'saas_product', label: 'SaaS Product' },
  { value: 'hr_system', label: 'HR System' },
  { value: 'inventory_system', label: 'Inventory' },
  { value: 'ecommerce_platform', label: 'E-commerce' },
  { value: 'internal_tool', label: 'Internal Tool' },
  { value: 'custom_application', label: 'Custom App' },
];

export default function Projects() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    const data = await base44.entities.Project.list('-created_date', 100);
    setProjects(data.filter(p => p.status !== 'archived'));
    setLoading(false);
  };

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name?.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const matchPhase = phaseFilter === 'all' || p.phase === phaseFilter;
    const matchType = typeFilter === 'all' || p.type === typeFilter;
    return matchSearch && matchPhase && matchType;
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => navigate('/projects/new')} className="gap-2">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Phase" />
          </SelectTrigger>
          <SelectContent>
            {PHASES.map(p => (
              <SelectItem key={p} value={p}>{p === 'all' ? 'All Phases' : p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-9">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-44 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <FolderOpen className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">
            {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
          </p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {projects.length === 0 ? 'Create your first project to get started' : 'Try adjusting your filters'}
          </p>
          {projects.length === 0 && (
            <Button size="sm" onClick={() => navigate('/projects/new')}>
              <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} onDeleted={loadProjects} />
          ))}
        </div>
      )}
    </div>
  );
}