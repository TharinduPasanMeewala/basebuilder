import React, { useState, useEffect } from 'react';
import { Key, Sparkles, Save, Check, Loader2, Eye, EyeOff, ExternalLink, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export default function Settings() {
  const [apiKey, setApiKey] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const user = await base44.auth.me();
      setApiKey(user.openai_api_key || '');
      setUseCustom(!!user.use_custom_openai);
    } catch (e) {
      setError(e.message || 'Failed to load settings');
    }
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await base44.auth.updateMe({ openai_api_key: apiKey.trim(), use_custom_openai: useCustom });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e.message || 'Failed to save settings');
    }
    setSaving(false);
  };

  const clear = () => {
    setApiKey('');
    setUseCustom(false);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-muted-foreground text-sm mt-1">Configure AI providers and platform preferences</p>
      </div>

      {/* ChatGPT / OpenAI for coding */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">ChatGPT API for Coding</p>
            <p className="text-[11px] text-muted-foreground">Use your own OpenAI key for code generation &amp; design refinement</p>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" /> OpenAI API Key
            </label>
            <div className="relative">
              <Input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                className="pr-10 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
              <Shield className="w-3 h-3" /> Get a key at
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                platform.openai.com <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-muted/20">
            <div>
              <p className="text-xs font-semibold text-foreground">Use my OpenAI key by default</p>
              <p className="text-[11px] text-muted-foreground">When on, code generation uses your key. You can still toggle it per generation.</p>
            </div>
            <Switch checked={useCustom} onCheckedChange={setUseCustom} />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex items-center gap-2">
            <Button onClick={save} disabled={saving} size="sm" className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5 text-accent" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving…' : saved ? 'Saved' : 'Save Settings'}
            </Button>
            {apiKey && (
              <Button variant="outline" size="sm" onClick={clear}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 bg-primary/8 border border-primary/20 rounded-xl p-4">
        <div className="flex items-start gap-2">
          <Shield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your API key is stored on your user account and only used server-side when you enable "Use my OpenAI key" during code generation. It is never exposed to other users.
          </p>
        </div>
      </div>
    </div>
  );
}