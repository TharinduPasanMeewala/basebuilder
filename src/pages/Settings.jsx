import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Cpu, Plus, Save, Loader2, CheckCircle2, Trash2, Shield, Key, ArrowRight, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AI_CONNECTION_QUERY, getAIConnections, manageAIConnection } from '@/lib/codeAI';

const PRESETS = [
  { name: 'OpenAI', provider: 'openai', base_url: '', hint: 'Exact OpenAI text or vision model ID', json_mode: true },
  { name: 'Anthropic Claude', provider: 'anthropic', base_url: '', hint: 'Exact Claude model ID', json_mode: false },
  { name: 'Google Gemini', provider: 'gemini', base_url: '', hint: 'Exact Gemini text or vision model ID', json_mode: true },
  { name: 'OpenRouter', provider: 'compatible', base_url: 'https://openrouter.ai/api/v1', hint: 'provider/model-id', json_mode: false },
  { name: 'Custom / local model gateway', provider: 'compatible', base_url: '', hint: 'Exact model ID exposed by your endpoint', json_mode: false },
];
const EMPTY = { name: '', provider: 'openai', model: '', base_url: '', api_key: '', json_mode: true, supports_images: false, max_tokens: 8192 };
const MODEL_SUGGESTIONS = {
  openai: ['gpt-5', 'gpt-5-mini', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-5', 'claude-opus-4-1', 'claude-3-7-sonnet-latest', 'claude-3-5-haiku-latest'],
  gemini: ['gemini-3.8-flash'],
};

export default function Settings() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: AI_CONNECTION_QUERY, queryFn: () => getAIConnections(true), retry: 1 });
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [makeDefault, setMakeDefault] = useState(true);
  const patch = change => { setForm(previous => ({ ...previous, ...change })); setNotice(''); };
  const run = async (name, operation) => {
    setBusy(name); setError(''); setNotice('');
    try { await operation(); await queryClient.invalidateQueries({ queryKey: AI_CONNECTION_QUERY }); }
    catch (err) { setError(err.message); }
    finally { setBusy(''); }
  };
  const edit = record => {
    setEditing(record.id); setForm({ ...EMPTY, ...record, api_key: '' });
    setMakeDefault(query.data?.default_id === record.id); setError(''); setNotice('');
  };
  const save = event => {
    event.preventDefault();
    run('save', async () => {
      const result = await manageAIConnection('save', { id: editing || undefined, connection: form, set_default: makeDefault });
      setEditing(result.connection.id); setForm({ ...EMPTY, ...result.connection, api_key: '' });
      setNotice('Connection saved. Test it to verify the key and model access.');
    });
  };
  const connections = query.data?.connections || [];
  return <div className="w-full overflow-y-auto">
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div><div className="flex items-center gap-2 text-primary text-xs font-semibold uppercase tracking-widest mb-2"><Cpu className="w-4 h-4" /> AI connections</div><h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Choose the intelligence behind your builder</h1><p className="text-muted-foreground text-sm mt-2 max-w-2xl">Connect a provider, enter any available model ID, and use it across planning, chat, UI design, and code generation.</p></div>
      </div>
      {(error || query.error) && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{error || query.error.message}<Button variant="ghost" size="sm" onClick={() => query.refetch()}>Retry</Button></div>}
      {notice && <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm flex gap-2"><CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />{notice}</div>}
      <div className="grid lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
        <div className="space-y-3">
          <button disabled={!!busy} onClick={() => run('default', () => manageAIConnection('default', { id: '' }))} className={'w-full text-left border rounded-xl p-4 transition-colors ' + (!query.data?.default_id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:border-primary/40')}>
            <div className="flex items-center justify-between gap-2"><span className="font-semibold text-sm flex gap-2 items-center"><Zap className="w-4 h-4 text-primary" />Built-in AI</span>{!query.data?.default_id && <span className="text-[10px] text-primary font-semibold">DEFAULT</span>}</div>
            <p className="text-xs text-muted-foreground mt-2">Use your Base44 AI integration without adding a key.</p>
          </button>
          {query.isLoading && <p className="text-sm p-4 flex gap-2"><Loader2 className="w-4 h-4 animate-spin" />Loading connections…</p>}
          {connections.map(record => <div key={record.id} className={'rounded-xl border p-4 bg-card ' + (editing === record.id ? 'border-primary' : 'border-border')}>
            <div className="flex items-start gap-2"><button onClick={() => edit(record)} className="text-left flex-1 min-w-0"><p className="font-semibold text-sm truncate">{record.name}</p><p className="text-xs text-muted-foreground font-mono mt-1 break-all">{record.model}</p></button>{query.data?.default_id === record.id && <span className="text-[10px] text-primary font-semibold">DEFAULT</span>}</div>
            <div className="flex items-center gap-2 mt-3"><Button variant="outline" size="sm" disabled={!!busy} onClick={() => run(record.id, async () => {
              const result = await manageAIConnection('test', { id: record.id }); setNotice('Connected to ' + result.model + ' in ' + (result.latency_ms / 1000).toFixed(1) + 's.');
            })}>{busy === record.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test connection'}</Button>
              {query.data?.default_id !== record.id && <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => run('default', () => manageAIConnection('default', { id: record.id }))}>Use</Button>}
              <Button size="icon" variant="ghost" className="w-8 h-8 ml-auto text-muted-foreground hover:text-destructive" aria-label={'Delete ' + record.name} disabled={!!busy} onClick={() => {
                if (!window.confirm('Delete this AI connection?')) return;
                run('delete', async () => { await manageAIConnection('delete', { id: record.id }); if (editing === record.id) { setEditing(null); setForm(EMPTY); } });
              }}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
            {record.last_test_ok && <p className="text-[11px] text-emerald-600 mt-2">Last successful test: {new Date(record.last_tested_at).toLocaleString()}</p>}
          </div>)}
          <Button className="w-full gap-2" variant="outline" onClick={() => { setEditing(null); setForm(EMPTY); setMakeDefault(true); setNotice(''); }}><Plus className="w-4 h-4" />Add connection</Button>
          <div className="rounded-xl bg-muted/40 p-4 text-xs text-muted-foreground leading-relaxed flex gap-2"><Shield className="w-4 h-4 shrink-0 text-primary" /><p>Saved keys are held in server-only records. The builder receives connection details without keys. Keys are excluded from generated code and deployment packages.</p></div>
        </div>
        <form onSubmit={save} className="rounded-2xl border border-border bg-card p-5 sm:p-6 space-y-5 self-start">
          <div className="border-b border-border pb-4"><h2 className="text-lg font-semibold">{editing ? 'Edit connection' : 'Add an AI connection'}</h2><p className="text-xs text-muted-foreground mt-1">Use native OpenAI, Claude or Gemini APIs, or any OpenAI-compatible text model endpoint.</p></div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">{PRESETS.map(preset => <button key={preset.name} type="button" onClick={() => { setEditing(null); setForm({ ...EMPTY, ...preset, model: '' }); }} className="text-xs text-left border border-border rounded-lg p-3 hover:border-primary hover:bg-primary/5">{preset.name}<ArrowRight className="w-3 h-3 mt-2 text-muted-foreground" /></button>)}</div>
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="space-y-1.5 text-xs font-medium">Connection name<Input required maxLength={80} value={form.name} onChange={e => patch({ name: e.target.value })} placeholder="My coding model" /></label>
            <label className="space-y-1.5 text-xs font-medium">API protocol<select value={form.provider} onChange={e => patch({ provider: e.target.value, api_key: '', base_url: '', supports_images: false })} className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"><option value="openai">OpenAI</option><option value="anthropic">Anthropic Messages</option><option value="gemini">Google Gemini</option><option value="compatible">OpenAI-compatible</option></select></label>
          </div>
          {form.provider === 'compatible' && <label className="block space-y-1.5 text-xs font-medium">API base URL<Input required type="url" value={form.base_url} onChange={e => patch({ base_url: e.target.value })} placeholder="https://your-gateway.example.com/v1" /><span className="block text-muted-foreground font-normal">Include the API version path; the gateway appends /chat/completions.</span></label>}
          <label className="block space-y-1.5 text-xs font-medium">Model ID<Input required list="model-id-suggestions" value={form.model} onChange={e => patch({ model: e.target.value })} placeholder={form.hint || 'Enter the exact model ID from your provider'} /><datalist id="model-id-suggestions">{(MODEL_SUGGESTIONS[form.provider] || []).map(id => <option key={id} value={id} />)}</datalist><span className="block text-muted-foreground font-normal">Suggested IDs match the selected protocol. Model IDs stay editable, so newly released and private models work without a builder update.</span></label>
          <label className="block space-y-1.5 text-xs font-medium"><span className="flex gap-1.5 items-center"><Key className="w-3.5 h-3.5" />API key {form.provider === 'compatible' ? '(if required by endpoint)' : ''}</span><Input type="password" autoComplete="new-password" value={form.api_key} onChange={e => patch({ api_key: e.target.value })} placeholder={editing && form.has_key ? 'Leave blank to keep the saved key' : 'Paste your provider API key'} /></label>
          <div className="rounded-xl border border-border p-4 space-y-3 text-xs">
            <label className="flex gap-2 items-center"><input type="checkbox" checked={form.json_mode} onChange={e => patch({ json_mode: e.target.checked })} />Provider supports JSON response mode</label>
            <label className="flex gap-2 items-center"><input type="checkbox" checked={form.supports_images} disabled={form.provider === 'gemini'} onChange={e => patch({ supports_images: e.target.checked })} />Model supports image input (OpenAI / Claude protocols)</label>
            {['anthropic', 'gemini'].includes(form.provider) && <label className="flex items-center justify-between gap-2">Maximum output tokens<Input className="w-28" type="number" min={256} max={32768} value={form.max_tokens} onChange={e => patch({ max_tokens: Number(e.target.value) })} /></label>}
            <label className="flex gap-2 items-center border-t border-border pt-3"><input type="checkbox" checked={makeDefault} onChange={e => setMakeDefault(e.target.checked)} />Use this connection across the builder</label>
          </div>
          <Button type="submit" disabled={!!busy || query.isLoading || !!query.error} className="gap-2">{busy === 'save' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Save connection</Button>
        </form>
      </div>
      <div className="rounded-2xl border border-border bg-card p-5"><h2 className="font-semibold text-sm">Local and open-source models</h2><p className="text-xs text-muted-foreground leading-relaxed mt-2">Ollama, LM Studio, vLLM and other OpenAI-compatible servers can connect through an authenticated public HTTPS gateway. The hosted builder cannot reach localhost on your computer. Enter the gateway URL and its model ID above. Generated apps can be downloaded and run on localhost separately in Deploy → Hosting package.</p></div>
    </div>
  </div>;
}
