import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Sparkles, TrendingUp, FolderOpen, CheckCircle, Clock, ArrowRight, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ProjectCard from '@/components/project/ProjectCard';

const STATS_CONFIG = [
  { label: 'Total Projects', icon: FolderOpen, color: 'text-primary', bg: 'bg-primary/10', key: 'total' },
  { label: 'In Progress', icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-500/10', key: 'active' },
  { label: 'Completed', icon: CheckCircle, color: 'text-accent', bg: 'bg-accent/10', key: 'completed' },
  { label: 'Blueprints Generated', icon: Sparkles, color: 'text-purple-600', bg: 'bg-purple-500/10', key: 'blueprints' },
];

const QUICK_STARTS = [
  { label: 'ERP System', type: 'erp_system', icon: '🏭', desc: 'Manufacturing & distribution' },
  { label: 'CRM Platform', type: 'crm_system', icon: '🤝', desc: 'Sales & customer management' },
  { label: 'SaaS Product', type: 'saas_product', icon: '🚀', desc: 'Multi-tenant web application' },
  { label: 'HR System', type: 'hr_system', icon: '👥', desc: 'People & payroll management' },
  { label: 'E-commerce', type: 'ecommerce_platform', icon: '🛒', desc: 'Online store back-office' },
  { label: 'Internal Tool', type: 'internal_tool', icon: '⚙️', desc: 'Operations & productivity' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [blueprints, setBlueprints] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [projs, bps] = await Promise.all([
      base44.entities.Project.filter({ status: 'active' }, '-created_date', 6),
      base44.entities.Blueprint.list('-created_date', 50),
    ]);
    setProjects(projs);
    setBlueprints(bps);
    setLoading(false);
  };

  const stats = {
    total: projects.length,
    active: projects.filter(p => !['completed', 'archived'].includes(p.status)).length,
    completed: projects.filter(p => p.phase === 'completed').length,
    blueprints: blueprints.length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Design software through AI-powered conversations</p>
        </div>
        <Button onClick={() => navigate('/projects/new')} className="gap-2 shadow-sm">
          <Plus className="w-4 h-4" />
          New Project
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {STATS_CONFIG.map(s => (
          <div key={s.key} className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.bg}`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats[s.key]}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent Projects */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Recent Projects</h2>
            <button onClick={() => navigate('/projects')} className="text-xs text-primary hover:underline flex items-center gap-1">
              View all <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {[1,2,3,4].map(i => (
                <div key={i} className="h-36 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-xl p-10 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-sm mb-1">Start your first project</h3>
              <p className="text-muted-foreground text-xs mb-4">Describe your software idea and our AI will design it for you</p>
              <Button size="sm" onClick={() => navigate('/projects/new')}>
                <Plus className="w-3.5 h-3.5 mr-1.5" /> Create Project
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {projects.map(p => (
                <ProjectCard key={p.id} project={p} onDeleted={loadData} />
              ))}
            </div>
          )}
        </div>

        {/* Quick Start */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">Quick Start Templates</h2>
          <div className="space-y-2">
            {QUICK_STARTS.map(qs => (
              <button
                key={qs.type}
                onClick={() => navigate(`/projects/new?type=${qs.type}`)}
                className="w-full flex items-center gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
              >
                <span className="text-xl">{qs.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{qs.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{qs.desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>

          {/* AI Hint */}
          <div className="mt-4 bg-primary/8 border border-primary/20 rounded-xl p-4">
            <div className="flex items-start gap-2">
              <Zap className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-primary mb-1">AI-Powered Design</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  7 specialized AI agents collaborate to design your application — from requirements to a complete development blueprint.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}