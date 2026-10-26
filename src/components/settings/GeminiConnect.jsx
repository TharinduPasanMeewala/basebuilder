import React, { useState } from 'react';
import { CheckCircle2, ExternalLink, Eye, EyeOff, Key, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { manageAIConnection } from '@/lib/codeAI';

export default function GeminiConnect({ connection, isDefault, disabled, onBusy, onConnected }) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState([]);
  const [recommended, setRecommended] = useState('');
  const [model, setModel] = useState(connection?.model || '');
  const [name, setName] = useState(connection?.name || 'Google Gemini');
  const [images, setImages] = useState(connection ? !!connection.supports_images : true);
  const [tokens, setTokens] = useState(connection?.max_tokens || 16384);
  const [makeDefault, setMakeDefault] = useState(connection ? isDefault : true);
  const [manual, setManual] = useState(false);
  const [pending, setPending] = useState('');
  const [error, setError] = useState(null);
  const hasKey = !!apiKey.trim() || !!connection?.has_key;
  const locked = !!disabled || !!pending;
  const selected = models.find(item => item.id === model);
  const execute = async (action, operation) => {
    setPending(action); setError(null); onBusy?.(true);
    try { await operation(); }
    catch (failure) { setError(failure); }
    finally { setPending(''); onBusy?.(false); }
  };
  const loadModels = () => execute('models', async () => {
    const result = await manageAIConnection('models', { id: connection?.id, api_key: apiKey });
    setModels(result.models); setRecommended(result.recommended_id); setManual(false);
    const choice = result.models.find(item => item.id === model) || result.models.find(item => item.id === result.recommended_id) || result.models[0];
    setModel(choice.id);
    setTokens(previous => Math.max(256, Math.min(previous, choice.output_token_limit || 32768)));
  });
  const connect = event => {
    event.preventDefault();
    if (locked || !hasKey) return;
    if (!model.trim()) { loadModels(); return; }
    execute('connect', async () => {
      const result = await manageAIConnection('connect_gemini', { id: connection?.id, set_default: makeDefault,
        connection: { name, api_key: apiKey, model, supports_images: images, max_tokens: tokens } });
      setApiKey(''); setShowKey(false);
      await onConnected(result, makeDefault);
    });
  };
  const keyChanged = value => {
    setApiKey(value); setModels([]); setRecommended(''); setModel(''); setError(null);
  };
  return <form onSubmit={connect} className="space-y-5" aria-label="Connect Google Gemini">
    <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed">
      <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-4 w-4 text-primary" />Your key. Your choice of Gemini model.</div>
      <p className="mt-1 text-xs text-muted-foreground">Load Google’s current models, then run a small text, JSON, and image check before saving. The connection can power the whole builder.</p>
    </div>
    <fieldset disabled={locked} className="space-y-5 min-w-0">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="gemini-api-key" className="text-sm font-semibold flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">1</span>Gemini API key</label><a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Get a key in Google AI Studio<ExternalLink className="h-3 w-3" /></a></div>
        <div className="relative"><Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input id="gemini-api-key" type={showKey ? 'text' : 'password'} autoComplete="new-password" spellCheck={false} className="pl-9 pr-11" value={apiKey} onChange={event => keyChanged(event.target.value)} placeholder={connection?.has_key ? 'Saved key available · paste only to replace it' : 'Paste your Gemini API key'} aria-describedby="gemini-key-help" /><Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1 h-8 w-8" onClick={() => setShowKey(value => !value)} aria-label={showKey ? 'Hide API key' : 'Show API key'}>{showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</Button></div>
        <p id="gemini-key-help" className="text-xs text-muted-foreground">{connection?.has_key ? 'Leave this blank to use the saved key. ' : ''}The key stays private and is never included in generated apps.</p>
      </div>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><label htmlFor="gemini-model" className="text-sm font-semibold flex items-center gap-2"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs">2</span>Choose a model</label><Button type="button" size="sm" variant="outline" disabled={!hasKey} className="gap-1.5" onClick={loadModels}><RefreshCw className="h-3.5 w-3.5" />{models.length ? 'Refresh models' : 'Load models'}</Button></div>
        {manual ? <Input id="gemini-model" value={model} onChange={event => { setModel(event.target.value); setError(null); }} placeholder="Exact model ID, with or without models/" /> : <select id="gemini-model" value={model} disabled={!models.length && !connection?.model} onChange={event => { const next = models.find(item => item.id === event.target.value); setModel(event.target.value); setError(null); if (next?.output_token_limit) setTokens(previous => Math.min(previous, next.output_token_limit)); }} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
          {!model && <option value="">Load models to choose from Google’s list</option>}
          {model && !models.some(item => item.id === model) && <option value={model}>{model} · current connection</option>}
          {models.map(item => <option key={item.id} value={item.id}>{item.name}{item.id === recommended ? ' · Suggested' : ''}</option>)}
        </select>}
        {selected && <p className="text-xs text-muted-foreground break-words"><span className="font-mono">{selected.id}</span>{selected.description ? ' — ' + selected.description : ''}</p>}
        {models.length > 0 && <p role="status" className="text-xs text-muted-foreground">Loaded {models.length} text models from Google. Connect &amp; test will confirm this project’s generation access.</p>}
        <p className="text-xs text-muted-foreground">Choose a Flash model for speed, or a Pro model for more demanding tasks. Availability and quota depend on your Google project.</p>
      </div>
      <details className="rounded-xl border border-border p-3 text-xs">
        <summary className="cursor-pointer font-medium">Advanced options</summary>
        <div className="space-y-3 pt-4">
          <label className="block space-y-1.5">Connection name<Input value={name} maxLength={80} onChange={event => setName(event.target.value)} placeholder="Google Gemini" /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={images} onChange={event => setImages(event.target.checked)} />Enable and test image input for screenshot builds</label>
          <label className="flex items-center justify-between gap-3">Maximum output tokens<Input type="number" className="w-28" min={256} max={Math.min(32768, selected?.output_token_limit || 32768)} value={tokens} onChange={event => setTokens(Number(event.target.value))} /></label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={manual} onChange={event => setManual(event.target.checked)} />Enter a model ID manually</label>
          <p className="text-muted-foreground">The Gemini endpoint and JSON response settings are configured automatically.</p>
        </div>
      </details>
      <label className="flex items-start gap-2 text-xs"><input className="mt-0.5" type="checkbox" checked={makeDefault} onChange={event => setMakeDefault(event.target.checked)} /><span>Use Gemini across planning, design, chat, and code generation</span></label>
    </fieldset>
    {pending && <div role="status" className="text-sm flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin shrink-0" />{pending === 'models' ? 'Loading models from Google…' : 'Checking text and JSON' + (images ? ' + image input' : '') + '… This can take a moment.'}</div>}
    {error && <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2"><p className="text-sm text-destructive break-words">{error.message}</p>{error.help_url && <a href={error.help_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">Open Google’s help<ExternalLink className="h-3 w-3" /></a>}<p className="text-xs text-muted-foreground">Your draft is still here. Update it and retry; a failed check keeps your current connection in place.</p></div>}
    <div className="border-t border-border pt-4 space-y-2"><Button type="submit" disabled={locked || !hasKey} className="gap-2">{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{!model.trim() ? 'Load Gemini models' : connection ? 'Update & test Gemini' : 'Connect & test Gemini'}</Button><p className="text-xs text-muted-foreground">Runs a small request using your Google API quota. Saves only after the check passes.</p></div>
  </form>;
}
