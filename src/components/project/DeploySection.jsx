import React, { useState, useEffect } from 'react';
import {
  Globe, ShieldCheck, GitMerge, Container, Cloud, ChevronDown, ChevronRight,
  Wand2, Download, CheckCircle2, AlertCircle, Copy, Check, Terminal
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import ReactMarkdown from 'react-markdown';

const HOSTING_ICONS = {
  'AWS': '☁️', 'GCP': '☁️', 'Azure': '☁️', 'Vercel': '▲', 'Netlify': '◆',
  'Railway': '🚂', 'Render': '🎯', 'Fly.io': '✈️', 'DigitalOcean': '🌊',
};

export default function DeploySection({ project, onRefresh }) {
  const [deployPlan, setDeployPlan] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({ hosting: true, cicd: true, env: true, docker: false, checklist: false, security: false });
  const [copied, setCopied] = useState(null);

  useEffect(() => { loadData(); }, [project.id]);

  const loadData = async () => {
    setLoading(true);
    const saved = await base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'deploy_plan' }, '-created_date', 1);
    if (saved.length > 0) setDeployPlan(saved[0].snapshot);
    setLoading(false);
  };

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  const copyToClipboard = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateDeployPlan = async () => {
    setGenerating(true);
    try {
      const [devPlanRecords, blueprints] = await Promise.all([
        base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'dev_plan' }, '-created_date', 1),
        base44.entities.Blueprint.filter({ project_id: project.id }, '-created_date', 1),
      ]);

      const devPlan = devPlanRecords[0]?.snapshot;
      const blueprint = blueprints[0];

      const context = `
Project: "${project.name}" (${project.type?.replace(/_/g, ' ')})
${project.description ? `Description: ${project.description}` : ''}
Tech Stack: ${devPlan?.tech_stack ? JSON.stringify(devPlan.tech_stack).slice(0, 400) : 'Not defined yet'}
Blueprint completeness: ${blueprint?.completeness_score || 0}%
      `.trim();

      const raw = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a DevOps architect. Create a deployment plan for this project.

${context}

Return a JSON object with EXACTLY this structure (no markdown, plain JSON):
{
  "hosting_options": [
    {
      "name": "Vercel",
      "tier": "Recommended",
      "reason": "Why this fits",
      "cost": "$0-20/mo",
      "pros": ["Easy deploy", "Global CDN"],
      "cons": ["Limited backend"]
    }
  ],
  "cicd_pipeline": {
    "provider": "GitHub Actions",
    "stages": [
      {"name": "Test", "steps": ["Install deps", "Run unit tests", "Lint code"], "trigger": "on every push"},
      {"name": "Build", "steps": ["Build Docker image", "Push to registry"], "trigger": "on merge to main"},
      {"name": "Deploy", "steps": ["Deploy to staging", "Run smoke tests", "Deploy to production"], "trigger": "on tag release"}
    ],
    "workflow_yaml": "name: CI/CD\\non:\\n  push:\\n    branches: [main]\\njobs:\\n  deploy:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - uses: actions/checkout@v4\\n      - name: Deploy\\n        run: echo deploy"
  },
  "environment_variables": [
    {"key": "DATABASE_URL", "description": "PostgreSQL connection string", "required": true, "example": "postgresql://user:pass@host:5432/db"},
    {"key": "JWT_SECRET", "description": "Secret for signing JWT tokens", "required": true, "example": "your-secret-key-here"}
  ],
  "docker": {
    "dockerfile": "FROM node:20-alpine\\nWORKDIR /app\\nCOPY package*.json ./\\nRUN npm ci --production\\nCOPY . .\\nRUN npm run build\\nEXPOSE 3000\\nCMD [\\"node\\", \\"dist/index.js\\"]",
    "compose_yaml": "version: \\"3.9\\"\\nservices:\\n  app:\\n    build: .\\n    ports:\\n      - \\"3000:3000\\"\\n    env_file: .env\\n  db:\\n    image: postgres:15\\n    environment:\\n      POSTGRES_DB: appdb"
  },
  "deployment_checklist": [
    {"category": "Pre-Deploy", "items": [{"task": "Run full test suite", "priority": "high"}, {"task": "Update environment variables", "priority": "high"}]},
    {"category": "Deploy", "items": [{"task": "Deploy to staging", "priority": "high"}, {"task": "Smoke test staging", "priority": "high"}]},
    {"category": "Post-Deploy", "items": [{"task": "Monitor error rates", "priority": "medium"}, {"task": "Notify team", "priority": "low"}]}
  ],
  "security_checklist": [
    "Enable HTTPS/SSL on all endpoints",
    "Set secure HTTP headers (HSTS, CSP, X-Frame-Options)",
    "Rotate all secrets before production deploy",
    "Enable rate limiting on public APIs",
    "Configure CORS to allow only trusted origins",
    "Set up dependency vulnerability scanning"
  ],
  "monitoring": "Brief markdown notes on monitoring & observability recommendations"
}

Be specific to the project's tech stack. Provide 2-3 hosting options.`,
      });

      let plan = null;
      try {
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const start = cleaned.indexOf('{');
        const end = cleaned.lastIndexOf('}');
        plan = JSON.parse(cleaned.slice(start, end + 1));
      } catch (e) {
        plan = { error: 'Could not parse deployment plan. Please try again.' };
      }

      const existing = await base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'deploy_plan' }, '-created_date', 1);
      if (existing.length > 0) {
        await base44.entities.ProjectVersion.update(existing[0].id, { snapshot: plan, notes: 'Deployment Plan' });
      } else {
        await base44.entities.ProjectVersion.create({
          project_id: project.id,
          version_number: 1,
          label: 'deploy_plan',
          notes: 'Deployment Plan',
          snapshot: plan,
          phase: project.phase,
        });
      }

      setDeployPlan(plan);
      onRefresh();
    } catch (e) {
      console.error('Deploy plan generation failed:', e);
    } finally {
      setGenerating(false);
    }
  };

  const downloadPlan = () => {
    if (!deployPlan) return;
    const json = JSON.stringify(deployPlan, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name?.replace(/\s+/g, '_')}_deploy_plan.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex items-center justify-center flex-1"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>;
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50 flex-shrink-0">
        <Globe className="w-4 h-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">Deployment Plan</h2>
        <div className="flex-1" />
        {deployPlan && !deployPlan.error && (
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={downloadPlan}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
        )}
        <Button size="sm" className="h-7 text-xs gap-1.5" onClick={generateDeployPlan} disabled={generating}>
          {generating
            ? <div className="w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
            : <Wand2 className="w-3.5 h-3.5" />}
          {generating ? 'Generating...' : deployPlan ? 'Regenerate' : 'Generate Plan'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!deployPlan ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-4">
              <Globe className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-2">Generate Your Deployment Plan</h3>
            <p className="text-sm text-muted-foreground max-w-md leading-relaxed mb-6">
              Get hosting recommendations, CI/CD pipeline config, environment variables, Dockerfile, security checklist, and deployment steps tailored to your tech stack.
            </p>
            <Button onClick={generateDeployPlan} disabled={generating} className="gap-2">
              {generating
                ? <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                : <Globe className="w-4 h-4" />}
              {generating ? 'Generating...' : 'Generate Deployment Plan'}
            </Button>
          </div>
        ) : deployPlan.error ? (
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-sm text-destructive flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" /> {deployPlan.error}
          </div>
        ) : (
          <div className="space-y-4 animate-fade-in">

            {/* Hosting Options */}
            {deployPlan.hosting_options?.length > 0 && (
              <Section title="Hosting Options" icon={<Cloud className="w-4 h-4 text-primary" />} expanded={expanded.hosting} onToggle={() => toggle('hosting')}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {deployPlan.hosting_options.map((opt, i) => (
                    <div key={i} className={`border rounded-xl p-3 ${opt.tier === 'Recommended' ? 'border-accent/40 bg-accent/5' : 'border-border bg-card'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-lg">{HOSTING_ICONS[opt.name] || '🖥️'}</span>
                        <span className="text-sm font-semibold text-foreground">{opt.name}</span>
                        {opt.tier === 'Recommended' && (
                          <span className="ml-auto text-xs bg-accent/15 text-accent border border-accent/30 px-1.5 py-0.5 rounded-full font-medium">★ Recommended</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{opt.reason}</p>
                      {opt.cost && <p className="text-xs font-semibold text-foreground mb-2">{opt.cost}</p>}
                      <div className="space-y-1">
                        {opt.pros?.map((p, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-xs text-green-700">
                            <CheckCircle2 className="w-3 h-3 flex-shrink-0" /> {p}
                          </div>
                        ))}
                        {opt.cons?.map((c, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <span className="w-3 h-3 flex-shrink-0 text-center leading-none">−</span> {c}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* CI/CD Pipeline */}
            {deployPlan.cicd_pipeline && (
              <Section title={`CI/CD Pipeline (${deployPlan.cicd_pipeline.provider})`} icon={<GitMerge className="w-4 h-4 text-primary" />} expanded={expanded.cicd} onToggle={() => toggle('cicd')}>
                <div className="space-y-2 mb-4">
                  {deployPlan.cicd_pipeline.stages?.map((stage, i) => (
                    <div key={i} className="border border-border rounded-lg overflow-hidden">
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/20">
                        <div className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</div>
                        <span className="text-xs font-semibold text-foreground">{stage.name}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground italic">{stage.trigger}</span>
                      </div>
                      <ul className="px-3 py-2 space-y-1">
                        {stage.steps?.map((step, j) => (
                          <li key={j} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="w-1 h-1 rounded-full bg-primary/40 flex-shrink-0" /> {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                {deployPlan.cicd_pipeline.workflow_yaml && (
                  <CodeBlock
                    label="workflow.yml"
                    code={deployPlan.cicd_pipeline.workflow_yaml}
                    onCopy={() => copyToClipboard(deployPlan.cicd_pipeline.workflow_yaml, 'cicd')}
                    copied={copied === 'cicd'}
                  />
                )}
              </Section>
            )}

            {/* Environment Variables */}
            {deployPlan.environment_variables?.length > 0 && (
              <Section title="Environment Variables" icon={<Terminal className="w-4 h-4 text-primary" />} expanded={expanded.env} onToggle={() => toggle('env')}>
                <div className="space-y-1.5">
                  {deployPlan.environment_variables.map((env, i) => (
                    <div key={i} className="flex items-start gap-3 px-3 py-2.5 bg-muted/20 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-xs font-mono font-semibold text-foreground">{env.key}</code>
                          {env.required && <span className="text-[10px] bg-red-500/10 text-red-600 px-1 py-0.5 rounded border border-red-200">required</span>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{env.description}</p>
                        {env.example && <code className="text-[10px] text-muted-foreground font-mono"># e.g. {env.example}</code>}
                      </div>
                      <button
                        onClick={() => copyToClipboard(`${env.key}=`, `env-${i}`)}
                        className="text-muted-foreground hover:text-foreground flex-shrink-0 p-1"
                      >
                        {copied === `env-${i}` ? <Check className="w-3.5 h-3.5 text-accent" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => copyToClipboard(
                    deployPlan.environment_variables.map(e => `${e.key}=`).join('\n'),
                    'env-all'
                  )}
                  className="mt-2 text-xs text-primary hover:underline flex items-center gap-1"
                >
                  {copied === 'env-all' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  Copy all as .env template
                </button>
              </Section>
            )}

            {/* Docker */}
            {deployPlan.docker && (
              <Section title="Docker Configuration" icon={<Container className="w-4 h-4 text-primary" />} expanded={expanded.docker} onToggle={() => toggle('docker')}>
                <div className="space-y-3">
                  {deployPlan.docker.dockerfile && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">Dockerfile</p>
                      <CodeBlock
                        label="Dockerfile"
                        code={deployPlan.docker.dockerfile}
                        onCopy={() => copyToClipboard(deployPlan.docker.dockerfile, 'dockerfile')}
                        copied={copied === 'dockerfile'}
                      />
                    </div>
                  )}
                  {deployPlan.docker.compose_yaml && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1.5">docker-compose.yml</p>
                      <CodeBlock
                        label="docker-compose.yml"
                        code={deployPlan.docker.compose_yaml}
                        onCopy={() => copyToClipboard(deployPlan.docker.compose_yaml, 'compose')}
                        copied={copied === 'compose'}
                      />
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Deployment Checklist */}
            {deployPlan.deployment_checklist?.length > 0 && (
              <Section title="Deployment Checklist" icon={<CheckCircle2 className="w-4 h-4 text-primary" />} expanded={expanded.checklist} onToggle={() => toggle('checklist')}>
                <div className="space-y-4">
                  {deployPlan.deployment_checklist.map((cat, i) => (
                    <div key={i}>
                      <p className="text-xs font-semibold text-foreground mb-2">{cat.category}</p>
                      <div className="space-y-1.5">
                        {cat.items?.map((item, j) => (
                          <div key={j} className="flex items-center gap-3 px-3 py-1.5 bg-muted/20 rounded-lg">
                            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${item.priority === 'high' ? 'bg-red-500' : item.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                            <span className="text-xs text-foreground">{item.task}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Security Checklist */}
            {deployPlan.security_checklist?.length > 0 && (
              <Section title="Security Checklist" icon={<ShieldCheck className="w-4 h-4 text-primary" />} expanded={expanded.security} onToggle={() => toggle('security')}>
                <div className="space-y-1.5">
                  {deployPlan.security_checklist.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-muted/20 rounded-lg">
                      <ShieldCheck className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                      <span className="text-xs text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* Monitoring */}
            {deployPlan.monitoring && (
              <Section title="Monitoring & Observability" icon={<Globe className="w-4 h-4 text-primary" />} expanded={expanded.monitoring} onToggle={() => toggle('monitoring')}>
                <div className="prose prose-sm max-w-none text-sm text-foreground">
                  <ReactMarkdown>{deployPlan.monitoring}</ReactMarkdown>
                </div>
              </Section>
            )}

          </div>
        )}
      </div>
    </div>
  );
}

function CodeBlock({ label, code, onCopy, copied }) {
  return (
    <div className="bg-muted/30 rounded-lg overflow-hidden border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/50">
        <span className="text-[10px] font-mono text-muted-foreground">{label}</span>
        <button onClick={onCopy} className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground">
          {copied ? <Check className="w-3 h-3 text-accent" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono text-muted-foreground overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
        {code}
      </pre>
    </div>
  );
}

function Section({ title, icon, expanded, onToggle, children }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/30 transition-colors text-left">
        {icon}
        <span className="text-sm font-semibold text-foreground flex-1">{title}</span>
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
      </button>
      {expanded && <div className="px-4 pb-4 border-t border-border pt-3">{children}</div>}
    </div>
  );
}