import React, { useState, useEffect } from 'react';
import { Sparkles, Download, CheckCircle, AlertCircle, Clock, FileText, Database, Layout, GitBranch, Code, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

const SECTIONS_CONFIG = [
  { key: 'requirements', label: 'Requirements', icon: FileText, color: 'text-blue-600', bg: 'bg-blue-500/10' },
  { key: 'database', label: 'Data Model', icon: Database, color: 'text-green-600', bg: 'bg-green-500/10' },
  { key: 'pages', label: 'UI Pages', icon: Layout, color: 'text-purple-600', bg: 'bg-purple-500/10' },
  { key: 'workflows', label: 'Workflows', icon: GitBranch, color: 'text-orange-600', bg: 'bg-orange-500/10' },
  { key: 'apis', label: 'API Endpoints', icon: Code, color: 'text-cyan-600', bg: 'bg-cyan-500/10' },
];

export default function BlueprintSection({ project, onRefresh }) {
  const [blueprint, setBlueprint] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [project.id]);

  const loadData = async () => {
    setLoading(true);
    const [bps, reqs, entities, pages, workflows, apis] = await Promise.all([
      base44.entities.Blueprint.filter({ project_id: project.id }, '-created_date', 1),
      base44.entities.Requirement.filter({ project_id: project.id }),
      base44.entities.DataEntity.filter({ project_id: project.id }),
      base44.entities.PageSpec.filter({ project_id: project.id }),
      base44.entities.WorkflowSpec.filter({ project_id: project.id }),
      base44.entities.ApiEndpoint.filter({ project_id: project.id }),
    ]);
    if (bps.length > 0) setBlueprint(bps[0]);
    setCounts({ requirements: reqs.length, database: entities.length, pages: pages.length, workflows: workflows.length, apis: apis.length });
    setLoading(false);
  };

  const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);
  const filledSections = SECTIONS_CONFIG.filter(s => counts[s.key] > 0).length;
  const completeness = Math.round((filledSections / SECTIONS_CONFIG.length) * 100);

  const generateBlueprint = async () => {
    setGenerating(true);

    const [reqs, entities, pages, workflows, apis] = await Promise.all([
      base44.entities.Requirement.filter({ project_id: project.id }),
      base44.entities.DataEntity.filter({ project_id: project.id }),
      base44.entities.PageSpec.filter({ project_id: project.id }),
      base44.entities.WorkflowSpec.filter({ project_id: project.id }),
      base44.entities.ApiEndpoint.filter({ project_id: project.id }),
    ]);

    const summaryPrompt = `Generate a professional executive summary for a ${project.type?.replace(/_/g, ' ')} application called "${project.name}".
${project.description ? `Description: ${project.description}` : ''}
Requirements count: ${reqs.length}
Entities count: ${entities.length}
Pages count: ${pages.length}
Key modules: ${[...new Set(entities.map(e => e.module).filter(Boolean))].join(', ')}

Write a concise but comprehensive executive summary (3-4 paragraphs) covering: business purpose, key features, technical architecture overview, and expected business value.`;

    const summary = await base44.integrations.Core.InvokeLLM({
      prompt: summaryPrompt,
      model: 'claude_sonnet_4_6',
    });

    const blueprintPackage = {
      app_name: project.name,
      app_type: project.type,
      industry: project.industry,
      description: project.description,
      generated_at: new Date().toISOString(),
      phase: project.phase,
      executive_summary: summary,
      requirements: reqs.map(r => ({
        title: r.title,
        description: r.description,
        category: r.category,
        priority: r.priority,
        module: r.module,
        acceptance_criteria: r.acceptance_criteria,
        status: r.status,
      })),
      data_model: {
        entities: entities.map(e => ({
          name: e.name,
          description: e.description,
          module: e.module,
          fields: e.fields,
          relationships: e.relationships,
          indexes: e.indexes,
        }))
      },
      ui_specification: {
        pages: pages.map(p => ({
          name: p.name,
          route: p.route,
          type: p.type,
          description: p.description,
          module: p.module,
          roles_access: p.roles_access,
          components: p.components,
        }))
      },
      workflows: workflows.map(w => ({
        name: w.name,
        description: w.description,
        trigger_type: w.trigger_type,
        trigger: w.trigger,
        module: w.module,
        steps: w.steps,
        status_flow: w.status_flow,
      })),
      api_specification: {
        endpoints: apis.map(a => ({
          name: a.name,
          method: a.method,
          path: a.path,
          description: a.description,
          module: a.module,
          auth_required: a.auth_required,
          roles: a.roles,
        }))
      },
      statistics: {
        total_requirements: reqs.length,
        total_entities: entities.length,
        total_pages: pages.length,
        total_workflows: workflows.length,
        total_endpoints: apis.length,
        completeness_score: completeness,
      }
    };

    const bp = blueprint
      ? await base44.entities.Blueprint.update(blueprint.id, {
          title: `${project.name} - Application Blueprint`,
          executive_summary: summary,
          package: blueprintPackage,
          completeness_score: completeness,
          sections_included: SECTIONS_CONFIG.filter(s => counts[s.key] > 0).map(s => s.key),
          status: 'final',
        })
      : await base44.entities.Blueprint.create({
          project_id: project.id,
          title: `${project.name} - Application Blueprint`,
          executive_summary: summary,
          package: blueprintPackage,
          completeness_score: completeness,
          sections_included: SECTIONS_CONFIG.filter(s => counts[s.key] > 0).map(s => s.key),
          status: 'final',
        });

    await base44.entities.Project.update(project.id, { phase: 'generation', completeness_score: completeness });
    setBlueprint(bp);
    onRefresh();
    setGenerating(false);
  };

  const downloadBlueprint = () => {
    if (!blueprint?.package) return;
    const json = JSON.stringify(blueprint.package, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name?.replace(/\s+/g, '_')}_blueprint.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <h2 className="text-sm font-semibold text-foreground">Blueprint Generator</h2>
        <div className="flex-1" />
        {blueprint && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={downloadBlueprint}>
            <Download className="w-3.5 h-3.5" /> Export JSON
          </Button>
        )}
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={generateBlueprint} disabled={generating}>
          {generating ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {generating ? 'Generating...' : blueprint ? 'Regenerate' : 'Generate Blueprint'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Readiness check */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Blueprint Readiness</h3>
            <div className="flex items-center gap-2">
              <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all" style={{ width: `${completeness}%` }} />
              </div>
              <span className="text-sm font-bold text-foreground">{completeness}%</span>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SECTIONS_CONFIG.map(section => {
              const count = counts[section.key] || 0;
              const ready = count > 0;
              const Icon = section.icon;
              return (
                <div key={section.key} className={`flex items-center gap-2 p-2.5 rounded-lg border transition-all ${ready ? 'border-accent/30 bg-accent/5' : 'border-border bg-muted/20'}`}>
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 ${ready ? section.bg : 'bg-muted'}`}>
                    <Icon className={`w-3.5 h-3.5 ${ready ? section.color : 'text-muted-foreground'}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{section.label}</p>
                    <p className={`text-xs ${ready ? 'text-accent font-semibold' : 'text-muted-foreground'}`}>
                      {ready ? `${count} items` : 'Empty'}
                    </p>
                  </div>
                  {ready && <CheckCircle className="w-3.5 h-3.5 text-accent flex-shrink-0 ml-auto" />}
                </div>
              );
            })}
          </div>
        </div>

        {blueprint ? (
          <div className="space-y-4 animate-fade-in">
            {/* Executive Summary */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Executive Summary</h3>
                <span className="ml-auto text-xs text-muted-foreground">
                  Generated {new Date(blueprint.updated_date).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {blueprint.executive_summary}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {SECTIONS_CONFIG.map(s => (
                <div key={s.key} className={`rounded-xl p-3 text-center ${s.bg}`}>
                  <p className={`text-2xl font-bold ${s.color}`}>{counts[s.key] || 0}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Blueprint preview */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Blueprint Package (JSON)</span>
                </div>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5" onClick={downloadBlueprint}>
                  <Download className="w-3.5 h-3.5" /> Download
                </Button>
              </div>
              <pre className="p-4 text-xs font-mono overflow-x-auto text-muted-foreground bg-muted/10 max-h-64 overflow-y-auto leading-relaxed">
                {JSON.stringify({ ...blueprint.package, requirements: `[${counts.requirements} items]`, data_model: `{${counts.database} entities}`, ui_specification: `{${counts.pages} pages}`, workflows: `[${counts.workflows} items]`, api_specification: `{${counts.apis} endpoints}` }, null, 2)}
              </pre>
            </div>

            <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Blueprint Ready</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your application blueprint is complete with {totalItems} specification items. Download the JSON package to use with code generators, share with your development team, or import into other platforms.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Generate Your Blueprint</h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
              Compile all your requirements, data models, pages, workflows, and APIs into a complete, exportable application blueprint package.
            </p>
            {completeness < 40 && (
              <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-200 rounded-lg p-3 mb-4 text-left max-w-sm">
                <AlertCircle className="w-4 h-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700">Complete more sections first for a comprehensive blueprint. Use the AI Generate buttons in each section.</p>
              </div>
            )}
            <Button onClick={generateBlueprint} disabled={generating} className="gap-2">
              {generating ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {generating ? 'Generating Blueprint...' : 'Generate Blueprint'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}