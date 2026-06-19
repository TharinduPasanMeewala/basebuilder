import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import SaraShell from '@/components/sara/SaraShell';
import PageHeader from '@/components/sara/PageHeader';
import EmptyState from '@/components/sara/EmptyState';
import { useSaraContext } from '@/components/sara/useSaraContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export default function AgentLab() {
  const ctx = useSaraContext();
  const [agents, setAgents] = useState([]);
  const [form, setForm] = useState({ name: 'Sara Copilot', system_prompt: 'You are a helpful Base44 app-building assistant.', model_provider: 'base44', status: 'draft', tools: [] });
  const [message, setMessage] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (ctx.selectedProject) load(); }, [ctx.selectedProject?.id]);
  const load = async () => setAgents(await base44.entities.AgentDefinition.filter({ project_id: ctx.selectedProject.id }, '-created_date', 100));
  const save = async () => { await base44.entities.AgentDefinition.create({ ...form, workspace_id: ctx.selectedWorkspace.id, project_id: ctx.selectedProject.id }); await load(); };
  const chat = async () => { setBusy(true); const res = await base44.integrations.Core.InvokeLLM({ prompt: `${form.system_prompt}\n\nUser test message: ${message}` }); setReply(res); setBusy(false); };
  return <SaraShell><PageHeader eyebrow="Agent Lab" title="Design Sara-compatible AI agents" description="Configure prompts, tools, model preference, and run a lightweight chat tester. Heavy chat uses Base44 Credits; local providers are modeled for future plug-in support." action={<Button onClick={save} disabled={!ctx.selectedProject || !form.name}>Save Agent</Button>} />
    {!ctx.selectedProject ? <EmptyState title="Select a project" description="Agents are saved to the current project." /> : <div className="grid xl:grid-cols-3 gap-6"><section className="xl:col-span-2 bg-card border border-border rounded-2xl p-5 space-y-3"><Input placeholder="Agent name" value={form.name} onChange={e => setForm({...form, name: e.target.value})} /><Textarea rows={7} placeholder="System prompt" value={form.system_prompt} onChange={e => setForm({...form, system_prompt: e.target.value})} /><div className="flex gap-2"><select className="border border-border bg-background rounded-lg px-3 py-2" value={form.model_provider} onChange={e => setForm({...form, model_provider: e.target.value})}><option>base44</option><option>hybrid</option><option>local</option></select><Input placeholder="Model name (optional)" value={form.model_name || ''} onChange={e => setForm({...form, model_name: e.target.value})} /></div><div className="border border-border rounded-2xl p-4 bg-muted/20"><p className="text-sm font-semibold mb-2">Live chat tester</p><Textarea rows={3} placeholder="Ask the agent something..." value={message} onChange={e => setMessage(e.target.value)} /><Button className="mt-2" onClick={chat} disabled={!message || busy}>{busy ? 'Thinking…' : 'Send test message'}</Button>{reply && <div className="mt-3 bg-card border border-border rounded-xl p-3 text-sm whitespace-pre-wrap">{reply}</div>}</div></section><section className="bg-card border border-border rounded-2xl p-4"><h3 className="font-bold mb-3">Saved agents</h3><div className="space-y-2">{agents.map(a => <button key={a.id} onClick={() => setForm(a)} className="w-full text-left border border-border rounded-xl p-3"><p className="font-semibold">{a.name}</p><p className="text-xs text-muted-foreground">{a.model_provider}</p></button>)}</div></section></div>}
  </SaraShell>;
}