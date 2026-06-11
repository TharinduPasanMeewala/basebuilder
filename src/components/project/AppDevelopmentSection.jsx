import React, { useState, useEffect } from 'react';
import {
  Rocket, Code2, Layers, GitBranch, Calendar, CheckCircle2,
  Download, Wand2, FileCode, Package, Server, Smartphone, Clock, ChevronDown, ChevronRight
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';

const PHASE_COLORS = {
  'Setup & Foundation': 'bg-blue-500/15 text-blue-700 border-blue-200',
  'Core Features': 'bg-purple-500/15 text-purple-700 border-purple-200',
  'Advanced Features': 'bg-orange-500/15 text-orange-700 border-orange-200',
  'Testing & Deployment': 'bg-green-500/15 text-green-700 border-green-200',
};

export default function AppDevelopmentSection({ project, onRefresh }) {
  const [devPlan, setDevPlan] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({ techStack: true, sprint: true, structure: false, checklist: false });

  useEffect(() => { loadData(); }, [project.id]);

  const loadData = async () => {
    setLoading(true);
    const [bps, savedPlans] = await Promise.all([
      base44.entities.Blueprint.filter({ project_id: project.id }, '-created_date', 1),
      base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'dev_plan' }, '-created_date', 1),
    ]);
    if (bps.length > 0) setBlueprint(bps[0]);
    if (savedPlans.length > 0) setDevPlan(savedPlans[0].snapshot);
    setLoading(false);
  };

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  const generatePlan = async () => {
    setGenerating(true);
    try {
      const [reqs, entities, pages, workflows, apis] = await Promise.all([
        base44.entities.Requirement.filter({ project_id: project.id }),
        base44.entities.DataEntity.filter({ project_id: project.id }),
        base44.entities.PageSpec.filter({ project_id: project.id }),
        base44.entities.WorkflowSpec.filter({ project_id: project.id }),
        base44.entities.ApiEndpoint.filter({ project_id: project.id }),
      ]);

      const context = `
Project: "${project.name}" (${project.type?.replace(/_/g, ' ')})
${project.description ? `Description: ${project.description}` : ''}
Requirements: ${reqs.length} (${reqs.filter(r => r.priority === 'critical').length} critical)
Data Entities: ${entities.map(e => e.name).join(', ') || 'none'}
UI Pages: ${pages.map(p => p.name).join(', ') || 'none'}
Workflows: ${workflows.map(w => w.name).join(', ') || 'none'}
API Endpoints: ${apis.length}
Modules: ${[...new Set(entities.map(e => e.module).filter(Boolean))].join(', ') || 'not defined'}
      `.trim();

      const raw = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a senior software architect. Create a comprehensive app development plan for the following project.

${context}

Return a JSON object with EXACTLY this structure:
{
  "tech_stack": {
    "frontend": [{"name":"React","reason":"Component-based UI","version":"18+"}],
    "backend": [{"name":"Node.js","reason":"API server","version":"20+"}],
    "database": [{"name":"PostgreSQL","reason":"Relational data","version":"15+"}],
    "infrastructure": [{"name":"Docker","reason":"Containerization","version":"latest"}],
    "key_libraries": [{"name":"Prisma","category":"ORM","purpose":"Database access"}]
  },
  "sprints": [
    {
      "number": 1,
      "name": "Sprint name",
      "phase": "Setup & Foundation",
      "duration_weeks": 2,
      "goal": "Sprint goal",
      "tasks": ["Task 1", "Task 2", "Task 3"]
    }
  ],
  "file_structure": "src/\\n  components/\\n    ...",
  "development_checklist": [
    {"category": "Infrastructure", "items": [{"task": "Setup CI/CD", "priority": "high", "estimated_hours": 4}]}
  ],
  "implementation_notes": "Key architectural decisions and gotchas as markdown text"
}

Generate 4-6 sprints covering the full project. Be specific and practical.`,
        model: 'claude_sonnet_4_6',
      });

      let plan = null;
      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        plan = JSON.parse(cleaned.slice(start, end + 1));
      } catch (e) {
        console.error('Dev plan parse failed:', e);
        plan = { error: 'Could not parse plan. Please try again.', raw_response: raw.slice(0, 500) };
      }

      // Save as a ProjectVersion snapshot
      const existing = await base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'dev_plan' }, '-created_date', 1);
      if (existing.length > 0) {
        await base44.entities.ProjectVersion.update(existing[0].id, { snapshot: plan, notes: 'App Development Plan' });
      } else {
        await base44.entities.ProjectVersion.create({
          project_id: project.id,
          version_number: 1,
          label: 'dev_plan',
          notes: 'App Development Plan',
          snapshot: plan,
          phase: project.phase,
        });
      }

      await base44.entities.Project.update(project.id, { phase: 'completed', completeness_score: 100 });
      setDevPlan(plan);
      onRefresh();
    } catch (e) {
      console.error('Dev plan generation failed:', e);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPlan = () => {
    if (!devPlan) return;
    const json = JSON.stringify(devPlan, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name?.replace(/\s+/g, '_')}_dev_plan.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  const hasBlueprintData = blueprint != null;

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <Rocket className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">App Development Plan</h2>
        <div className="flex-1" />
        {devPlan && !devPlan.error && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={downloadPlan}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        )}
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={generatePlan} disabled={generating}>
          {generating
            ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            : <Wand2 className="w-3.5 h-3.5" />}
          {generating ? 'Generating...' : devPlan ? 'Regenerate' : 'Generate Plan'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* Blueprint source card */}
        <div className={`flex items-center gap-3 p-3 rounded-xl border ${hasBlueprintData ? 'bg-accent/5 border-accent/20' : 'bg-yellow-500/5 border-yellow-200'}`}>
          <CheckCircle2 className={`w-5 h-5 flex-shrink-0 ${hasBlueprintData ? 'text-accent' : 'text-yellow-500'}`} />
          <div>
            <p className="text-xs font-semibold text-foreground">
              {hasBlueprintData ? 'Blueprint Available' : 'No Blueprint Yet'}
            </p>
            <p className="text-xs text-muted-foreground">
              {hasBlueprintData
                ? `Using "${blueprint.title}" — ${blueprint.completeness_score || 0}% completeness`
                : 'Generate a blueprint first in the Blueprint tab for a more accurate plan.'}
            </p>
          </div>
        </div>

        {!devPlan ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Rocket className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Generate Your Development Plan</h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
              Get a complete tech stack recommendation, sprint plan, file structure, and development checklist tailored to your application blueprint.
            </p>
            <Button onClick={generatePlan} disabled={generating} className="gap-2">
              {generating
                ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : <Rocket className="w-4 h-4" />}
              {generating ? 'Generating Plan...' : 'Generate Development Plan'}
            </Button>
          </div>
        ) : devPlan.error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive">
            {devPlan.error}
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">

            {/* Tech Stack */}
            <Section
              title="Tech Stack"
              icon={<Layers className="w-4 h-4 text-primary" />}
              expanded={expanded.techStack}
              onToggle={() => toggle('techStack')}
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { key: 'frontend', label: 'Frontend', icon: <Smartphone className="w-3.5 h-3.5" />, color: 'text-blue-600' },
                  { key: 'backend', label: 'Backend', icon: <Server className="w-3.5 h-3.5" />, color: 'text-green-600' },
                  { key: 'database', label: 'Database', icon: <Package className="w-3.5 h-3.5" />, color: 'text-orange-600' },
                  { key: 'infrastructure', label: 'Infrastructure', icon: <Code2 className="w-3.5 h-3.5" />, color: 'text-purple-600' },
                ].map(({ key, label, icon, color }) => (
                  devPlan.tech_stack?.[key]?.length > 0 && (
                    <div key={key} className="bg-muted/30 rounded-lg p-3">
                      <div className={`flex items-center gap-1.5 text-xs font-semibold mb-2 ${color}`}>
                        {icon} {label}
                      </div>
                      <div className="space-y-1.5">
                        {devPlan.tech_stack[key].map((item, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="text-xs font-semibold text-foreground min-w-0">{item.name}</span>
                            {item.version && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground flex-shrink-0">{item.version}</span>}
                            <span className="text-xs text-muted-foreground truncate">{item.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                ))}
              </div>
              {devPlan.tech_stack?.key_libraries?.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Key Libraries</p>
                  <div className="flex flex-wrap gap-2">
                    {devPlan.tech_stack.key_libraries.map((lib, i) => (
                      <div key={i} className="flex items-center gap-1.5 bg-muted px-2.5 py-1.5 rounded-lg">
                        <span className="text-xs font-semibold text-foreground">{lib.name}</span>
                        <span className="text-xs text-muted-foreground">{lib.purpose || lib.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            {/* Sprint Plan */}
            <Section
              title={`Sprint Plan (${devPlan.sprints?.length || 0} sprints)`}
              icon={<Calendar className="w-4 h-4 text-primary" />}
              expanded={expanded.sprint}
              onToggle={() => toggle('sprint')}
            >
              <div className="space-y-3">
                {devPlan.sprints?.map((sprint, i) => (
                  <div key={i} className="border border-border rounded-lg overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3 bg-muted/20">
                      <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {sprint.number || i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">{sprint.name}</p>
                        <p className="text-xs text-muted-foreground">{sprint.goal}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PHASE_COLORS[sprint.phase] || 'bg-muted text-muted-foreground border-border'}`}>
                          {sprint.phase}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" /> {sprint.duration_weeks}w
                        </span>
                      </div>
                    </div>
                    {sprint.tasks?.length > 0 && (
                      <ul className="px-4 py-2 space-y-1 bg-card">
                        {sprint.tasks.map((task, j) => (
                          <li key={j} className="flex items-start gap-2 text-xs text-muted-foreground py-0.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary/50 flex-shrink-0 mt-1.5" />
                            {task}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
              {devPlan.sprints?.length > 0 && (
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                  <Clock className="w-3.5 h-3.5" />
                  Total estimated: {devPlan.sprints.reduce((sum, s) => sum + (s.duration_weeks || 2), 0)} weeks
                </div>
              )}
            </Section>

            {/* File Structure */}
            {devPlan.file_structure && (
              <Section
                title="Recommended File Structure"
                icon={<FileCode className="w-4 h-4 text-primary" />}
                expanded={expanded.structure}
                onToggle={() => toggle('structure')}
              >
                <pre className="text-xs font-mono text-muted-foreground bg-muted/30 rounded-lg p-3 overflow-x-auto leading-relaxed whitespace-pre-wrap">
                  {devPlan.file_structure}
                </pre>
              </Section>
            )}

            {/* Development Checklist */}
            {devPlan.development_checklist?.length > 0 && (
              <Section
                title="Development Checklist"
                icon={<CheckCircle2 className="w-4 h-4 text-primary" />}
                expanded={expanded.checklist}
                onToggle={() => toggle('checklist')}
              >
                <div className="space-y-4">
                  {devPlan.development_checklist.map((cat, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-foreground mb-2">{cat.category}</p>
                      <div className="space-y-1.5">
                        {cat.items?.map((item, j) => (
                          <div key={j} className="flex items-center gap-3 py-1.5 px-3 bg-muted/20 rounded-lg">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.priority === 'high' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                            <span className="text-xs text-foreground flex-1">{item.task}</span>
                            {item.estimated_hours && (
                              <span className="text-xs text-muted-foreground flex-shrink-0">{item.estimated_hours}h</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Implementation Notes */}
            {devPlan.implementation_notes && (
              <Section
                title="Implementation Notes"
                icon={<GitBranch className="w-4 h-4 text-primary" />}
                expanded={expanded.notes}
                onToggle={() => toggle('notes')}
              >
                <div className="prose prose-sm max-w-none text-sm text-foreground leading-relaxed">
                  <ReactMarkdown>{devPlan.implementation_notes}</ReactMarkdown>
                </div>
              </Section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, icon, expanded, onToggle, children }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
      >
        {icon}
        <span className="text-sm font-semibold text-foreground flex-1">{title}</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-4 pb-4 border-t border-border pt-3">{children}</div>}
    </div>
  );
}