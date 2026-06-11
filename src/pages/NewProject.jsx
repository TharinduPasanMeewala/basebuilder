import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

const PROJECT_TYPES = [
  { value: 'erp_system', label: 'ERP System', icon: '🏭', desc: 'Manufacturing, distribution, operations' },
  { value: 'crm_system', label: 'CRM System', icon: '🤝', desc: 'Sales, customers, pipeline management' },
  { value: 'saas_product', label: 'SaaS Product', icon: '🚀', desc: 'Multi-tenant web application' },
  { value: 'hr_system', label: 'HR & Payroll', icon: '👥', desc: 'People management, payroll, attendance' },
  { value: 'inventory_system', label: 'Inventory System', icon: '📦', desc: 'Stock, warehousing, procurement' },
  { value: 'warehouse_system', label: 'WMS', icon: '🏢', desc: 'Warehouse operations and logistics' },
  { value: 'accounting_system', label: 'Accounting', icon: '💰', desc: 'Finance, invoicing, GL, reporting' },
  { value: 'ecommerce_platform', label: 'E-commerce', icon: '🛒', desc: 'Online store, orders, catalog' },
  { value: 'project_management', label: 'Project Management', icon: '📋', desc: 'Tasks, sprints, resource planning' },
  { value: 'service_management', label: 'Service Management', icon: '🛠️', desc: 'Tickets, SLAs, field service' },
  { value: 'customer_portal', label: 'Customer Portal', icon: '🌐', desc: 'Self-service, orders, support' },
  { value: 'internal_tool', label: 'Internal Tool', icon: '⚙️', desc: 'Operations, productivity, automation' },
  { value: 'custom_application', label: 'Custom Application', icon: '✨', desc: 'Unique business requirements' },
];

const INDUSTRIES = [
  'Manufacturing', 'Distribution', 'Retail', 'E-commerce', 'Logistics', 'Warehousing',
  'Finance', 'Healthcare', 'Education', 'Professional Services', 'Construction', 'Hospitality',
  'Technology', 'Non-profit', 'Government', 'Other'
];

export default function NewProject() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const defaultType = searchParams.get('type') || '';

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '',
    description: '',
    type: defaultType,
    industry: '',
  });
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!form.name || !form.type) return;
    setCreating(true);
    const project = await base44.entities.Project.create({
      name: form.name,
      description: form.description,
      type: form.type,
      industry: form.industry,
      phase: 'discovery',
      status: 'active',
      completeness_score: 0,
      version_count: 1,
    });
    navigate(`/projects/${project.id}`);
  };

  const canProceed = step === 1 ? !!form.type : (!!form.name);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Create New Project</h1>
          <p className="text-muted-foreground text-sm mt-2">Our AI agents will guide you through designing your application</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2].map(s => (
            <React.Fragment key={s}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                s < step ? 'bg-accent text-accent-foreground' :
                s === step ? 'bg-primary text-primary-foreground' :
                'bg-muted text-muted-foreground'
              }`}>
                {s < step ? <CheckCircle className="w-4 h-4" /> : s}
              </div>
              {s < 2 && <div className={`h-px w-12 transition-colors ${s < step ? 'bg-accent' : 'bg-border'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
          {step === 1 && (
            <div className="animate-fade-in">
              <h2 className="font-semibold text-foreground mb-1">What are you building?</h2>
              <p className="text-sm text-muted-foreground mb-5">Select the type of application you want to design</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto pr-1">
                {PROJECT_TYPES.map(pt => (
                  <button
                    key={pt.value}
                    onClick={() => setForm(f => ({ ...f, type: pt.value }))}
                    className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                      form.type === pt.value
                        ? 'border-primary bg-primary/8 shadow-sm'
                        : 'border-border hover:border-primary/30 hover:bg-muted/50'
                    }`}
                  >
                    <span className="text-xl mb-1">{pt.icon}</span>
                    <p className={`text-xs font-semibold leading-tight ${form.type === pt.value ? 'text-primary' : 'text-foreground'}`}>{pt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{pt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in space-y-4">
              <div>
                <h2 className="font-semibold text-foreground mb-1">Project Details</h2>
                <p className="text-sm text-muted-foreground">Give your project a name and brief description</p>
              </div>
              <div>
                <Label htmlFor="name" className="text-xs font-medium">Project Name *</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Acme ERP System"
                  className="mt-1.5"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="desc" className="text-xs font-medium">Description <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea
                  id="desc"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Briefly describe your application idea, goals, and target users..."
                  className="mt-1.5 resize-none h-24 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-medium">Target Industry <span className="text-muted-foreground">(optional)</span></Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {INDUSTRIES.map(ind => (
                    <button
                      key={ind}
                      onClick={() => setForm(f => ({ ...f, industry: f.industry === ind ? '' : ind }))}
                      className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                        form.industry === ind
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {ind}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
            <Button
              variant="ghost"
              onClick={() => step === 1 ? navigate('/projects') : setStep(s => s - 1)}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>
            <Button
              onClick={() => step < 2 ? setStep(s => s + 1) : handleCreate()}
              disabled={!canProceed || creating}
              className="gap-2"
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  Creating...
                </>
              ) : step < 2 ? (
                <> Next <ArrowRight className="w-4 h-4" /> </>
              ) : (
                <> <Sparkles className="w-4 h-4" /> Create Project </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}