import React, { useState } from 'react';
import { Globe, ArrowRight, Loader2, AlertCircle, Sparkles, Layout, Database, Workflow } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const PROJECT_TYPES = ['saas_product','erp_system','crm_system','hr_system','inventory_system','warehouse_system','accounting_system','ecommerce_platform','internal_tool','custom_application','project_management','service_management','customer_portal'];
const PAGE_TYPES = ['dashboard','list','detail','form','report','settings','auth','landing','kanban','calendar','chart'];
const REQ_CATEGORIES = ['functional','non_functional','business_rule','user_story','constraint','assumption'];
const FIELD_TYPES = ['string','text','number','integer','boolean','date','datetime','json','array','email','url','enum'];
const API_METHODS = ['GET','POST','PUT','PATCH','DELETE'];
const TRIGGER_TYPES = ['entity_create','entity_update','entity_delete','scheduled','manual','api_call','event'];
const DENSITIES = ['comfortable','compact','spacious'];

const cleanUrl = (value) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const slugify = (value) => (value || 'page').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
const safe = (items) => Array.isArray(items) ? items : [];
const cleanDesign = (design = {}) => ({
  ...(design.primary_color ? { primary_color: design.primary_color } : {}),
  ...(design.accent_color ? { accent_color: design.accent_color } : {}),
  ...(design.background_color ? { background_color: design.background_color } : {}),
  ...(design.surface_color ? { surface_color: design.surface_color } : {}),
  ...(design.text_color ? { text_color: design.text_color } : {}),
  ...(design.font_family ? { font_family: design.font_family } : {}),
  ...(Number.isFinite(design.radius) ? { radius: design.radius } : {}),
  ...(DENSITIES.includes(design.density) ? { density: design.density } : {}),
});

export default function CloneWebsiteDialog({ open, onClose }) {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const analyzeWebsite = async () => {
    const websiteUrl = cleanUrl(url);
    if (!websiteUrl) return;
    setLoading(true);
    setError('');
    setAnalysis(null);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        model: 'gemini_3_flash',
        add_context_from_internet: true,
        prompt: `Analyze this public website and design a similar application blueprint inside ArchitectAI: ${websiteUrl}

Create a practical app spec inspired by the site's visible purpose, pages, navigation, features, user actions, data needs, and visual design. Include matching page structure, core functions/workflows, likely data models, API endpoints, and brand styling. Do not return scraped private data; infer reusable app architecture.

Return concise, implementation-ready JSON only.`,
        response_json_schema: {
          type: 'object',
          properties: {
            project_name: { type: 'string' },
            description: { type: 'string' },
            project_type: { type: 'string' },
            industry: { type: 'string' },
            design: { type: 'object', properties: {
              primary_color: { type: 'string' }, accent_color: { type: 'string' }, background_color: { type: 'string' }, surface_color: { type: 'string' }, text_color: { type: 'string' }, font_family: { type: 'string' }, radius: { type: 'number' }, density: { type: 'string' }
            }},
            requirements: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, category: { type: 'string' }, priority: { type: 'string' }, module: { type: 'string' } } } },
            data_entities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, module: { type: 'string' }, fields: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, type: { type: 'string' }, required: { type: 'boolean' }, description: { type: 'string' } } } } } } },
            pages: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, route: { type: 'string' }, type: { type: 'string' }, description: { type: 'string' }, module: { type: 'string' }, components: { type: 'array', items: { type: 'object' } } } } },
            workflows: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, trigger: { type: 'string' }, trigger_type: { type: 'string' }, module: { type: 'string' } } } },
            api_endpoints: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, method: { type: 'string' }, path: { type: 'string' }, description: { type: 'string' }, module: { type: 'string' } } } }
          }
        }
      });
      setAnalysis({ ...result, source_url: websiteUrl });
    } catch (e) {
      setError(e.message || 'Could not analyze this website');
    }
    setLoading(false);
  };

  const createProject = async () => {
    if (!analysis) return;
    setCreating(true);
    setError('');
    try {
      const project = await base44.entities.Project.create({
        name: analysis.project_name || 'Website Clone Project',
        description: `${analysis.description || 'AI-generated app blueprint from a website URL.'}\n\nSource website: ${analysis.source_url}`,
        type: PROJECT_TYPES.includes(analysis.project_type) ? analysis.project_type : 'custom_application',
        industry: analysis.industry || '',
        phase: 'design',
        status: 'active',
        completeness_score: 65,
        version_count: 1,
        tags: ['website-clone', analysis.source_url],
      });

      const reqs = safe(analysis.requirements).slice(0, 30).map((r, i) => base44.entities.Requirement.create({
        project_id: project.id,
        title: r.title || `Website requirement ${i + 1}`,
        description: r.description || '',
        category: REQ_CATEGORIES.includes(r.category) ? r.category : 'functional',
        priority: ['critical','high','medium','low'].includes(r.priority) ? r.priority : 'medium',
        module: r.module || 'Website Clone',
        status: 'draft',
        source: 'ai_generated',
        order_index: i,
      }));

      const entities = safe(analysis.data_entities).slice(0, 20).map((e, i) => base44.entities.DataEntity.create({
        project_id: project.id,
        name: e.name || `Entity${i + 1}`,
        description: e.description || '',
        module: e.module || 'Website Clone',
        fields: safe(e.fields).map(f => ({ name: f.name, type: FIELD_TYPES.includes(f.type) ? f.type : 'string', required: !!f.required, description: f.description || '' })).filter(f => f.name),
        relationships: [],
        indexes: [],
        source: 'ai_generated',
        order_index: i,
      }));

      const pages = safe(analysis.pages).slice(0, 24).map((p, i) => base44.entities.PageSpec.create({
        project_id: project.id,
        name: p.name || `Page ${i + 1}`,
        route: p.route?.startsWith('/') ? p.route : `/${slugify(p.name || `page-${i + 1}`)}`,
        type: PAGE_TYPES.includes(p.type) ? p.type : 'landing',
        description: p.description || '',
        module: p.module || 'Website Clone',
        components: safe(p.components),
        roles_access: [],
        source: 'ai_generated',
        order_index: i,
      }));

      const workflows = safe(analysis.workflows).slice(0, 15).map((w) => base44.entities.WorkflowSpec.create({
        project_id: project.id,
        name: w.name || 'Website workflow',
        description: w.description || '',
        trigger: w.trigger || 'User action',
        trigger_type: TRIGGER_TYPES.includes(w.trigger_type) ? w.trigger_type : 'manual',
        module: w.module || 'Website Clone',
        source: 'ai_generated',
      }));

      const apis = safe(analysis.api_endpoints).slice(0, 20).map((a) => base44.entities.ApiEndpoint.create({
        project_id: project.id,
        name: a.name || 'Website API',
        method: API_METHODS.includes(a.method) ? a.method : 'GET',
        path: a.path?.startsWith('/') ? a.path : `/api/${slugify(a.name || 'endpoint')}`,
        description: a.description || '',
        module: a.module || 'Website Clone',
        auth_required: true,
        roles: ['admin'],
        source: 'ai_generated',
      }));

      await Promise.all([...reqs, ...entities, ...pages, ...workflows, ...apis]);
      await base44.entities.ProjectDesign.create({ project_id: project.id, ...cleanDesign(analysis.design) });
      navigate(`/projects/${project.id}`);
    } catch (e) {
      setError(e.message || 'Could not create project from website');
      setCreating(false);
    }
  };

  const close = () => {
    setUrl(''); setAnalysis(null); setError(''); setLoading(false); setCreating(false); onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Globe className="w-5 h-5" /> Clone Website from URL</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Paste a public website URL. AI will read it and create a similar app blueprint with pages, functions, data models, and design styling.</p>
          <div className="flex gap-2"><Input placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && analyzeWebsite()} className="font-mono text-sm" /><Button onClick={analyzeWebsite} disabled={loading || creating || !url.trim()} className="gap-1.5 flex-shrink-0">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}{loading ? 'Reading…' : 'Analyze'}</Button></div>
          {error && <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 flex-shrink-0" />{error}</div>}
          {analysis && <div className="bg-muted/40 border border-border rounded-xl p-4 space-y-3 animate-fade-in"><div><p className="font-semibold text-foreground text-sm">{analysis.project_name || 'Website Clone Project'}</p><p className="text-xs text-muted-foreground mt-1 line-clamp-3">{analysis.description}</p></div><div className="grid grid-cols-3 gap-2 text-center"><div className="bg-background border border-border rounded-lg p-2"><Layout className="w-4 h-4 text-primary mx-auto mb-1" /><p className="text-lg font-bold">{safe(analysis.pages).length}</p><p className="text-[10px] text-muted-foreground">Pages</p></div><div className="bg-background border border-border rounded-lg p-2"><Database className="w-4 h-4 text-primary mx-auto mb-1" /><p className="text-lg font-bold">{safe(analysis.data_entities).length}</p><p className="text-[10px] text-muted-foreground">Models</p></div><div className="bg-background border border-border rounded-lg p-2"><Workflow className="w-4 h-4 text-primary mx-auto mb-1" /><p className="text-lg font-bold">{safe(analysis.workflows).length}</p><p className="text-[10px] text-muted-foreground">Functions</p></div></div><Button className="w-full gap-2" onClick={createProject} disabled={creating}>{creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{creating ? 'Creating project…' : 'Create Similar App Project'}</Button></div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}