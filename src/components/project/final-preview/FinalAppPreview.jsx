import React, { useEffect, useRef, useState } from 'react';
import { Image, Loader2, Send, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { invokeCodeAI, getUserAIPreference } from '@/lib/codeAI';
import { Switch } from '@/components/ui/switch';
import CalculatorFinalPreview from './CalculatorFinalPreview';
import GenericFinalPreview from './GenericFinalPreview';

function isCalculator(project, publishState) {
  const text = `${project?.name || ''} ${project?.description || ''} ${publishState?.code?.['🎨 src']?.['App.jsx'] || ''}`.toLowerCase();
  return text.includes('calculator') || text.includes('pressoperator');
}

const defaultTheme = { page: '', shell: '', header: '', display: '', button: '', button_hover: '', border: '', text: '', primary: '', sidebar: '', surface: '' };

export default function FinalAppPreview({ project, publishState, onSaved }) {
  const [localState, setLocalState] = useState(publishState);
  const [theme, setTheme] = useState(defaultTheme);
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'Upload a reference image or describe the design change you want, and I will refine this preview and the generated code.' }]);
  const [input, setInput] = useState('');
  const [files, setFiles] = useState([]);
  const [working, setWorking] = useState(false);
  const [useCustomOpenAI, setUseCustomOpenAI] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    setLocalState(publishState);
    setTheme({ ...defaultTheme, ...(publishState?.preview_theme || {}) });
  }, [publishState]);

  useEffect(() => {
    getUserAIPreference().then(p => setUseCustomOpenAI(p.useCustomOpenAI));
  }, []);

  const uploadFiles = async (selectedFiles) => {
    const incoming = Array.from(selectedFiles || []);
    if (!incoming.length) return;
    setWorking(true);
    const uploaded = [];
    for (const file of incoming) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploaded.push({ name: file.name, url: file_url });
    }
    setFiles(prev => [...prev, ...uploaded]);
    setMessages(prev => [...prev, { role: 'user', content: `Uploaded ${uploaded.map(f => f.name).join(', ')}` }]);
    setWorking(false);
  };

  const persistCode = async (nextState) => {
    const versions = await base44.entities.ProjectVersion.filter({ project_id: project.id, label: 'publish_state' }, '-created_date', 1);
    if (versions[0]) {
      await base44.entities.ProjectVersion.update(versions[0].id, { snapshot: nextState, notes: 'Published App - AI refined' });
    } else {
      await base44.entities.ProjectVersion.create({
        project_id: project.id,
        version_number: 1,
        label: 'publish_state',
        notes: 'Published App - AI refined',
        snapshot: nextState,
        phase: project.phase,
      });
    }
    onSaved?.(nextState);
  };

  const sendMessage = async () => {
    if (!input.trim() && files.length === 0) return;
    const userText = input.trim() || 'Refine the app design using the uploaded reference image.';
    setInput('');
    setWorking(true);
    setMessages(prev => [...prev, { role: 'user', content: userText }]);

    try {
      const result = await invokeCodeAI({ useCustom: useCustomOpenAI,
      prompt: `You are refining a generated app preview and its React code from a user design request.
App: ${project.name}
Description: ${project.description || ''}
User request: ${userText}
Current App.jsx code:
${localState?.code?.['🎨 src']?.['App.jsx'] || ''}

Return a practical visual refinement. If you update code, preserve all existing button behavior and React component validity. For a calculator, keep all calculator functions working. Prefer changing styling/layout only unless the user explicitly asks for behavior changes.`,
      file_urls: files.map(f => f.url),
      response_json_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          preview_theme: {
            type: 'object',
            properties: {
              page: { type: 'string' }, shell: { type: 'string' }, header: { type: 'string' }, display: { type: 'string' }, button: { type: 'string' }, button_hover: { type: 'string' }, border: { type: 'string' }, text: { type: 'string' }, primary: { type: 'string' }, sidebar: { type: 'string' }, surface: { type: 'string' }
            }
          },
          updated_app_jsx: { type: 'string' }
        }
      }
    });

      const nextTheme = { ...theme, ...(result.preview_theme || {}) };
      setTheme(nextTheme);
      let nextState = { ...localState, preview_theme: nextTheme };
      if (result.updated_app_jsx && result.updated_app_jsx.includes('export default')) {
        nextState = { ...nextState, code: { ...nextState.code, '🎨 src': { ...nextState.code['🎨 src'], 'App.jsx': result.updated_app_jsx } } };
      }
      setLocalState(nextState);
      await persistCode(nextState);
      setMessages(prev => [...prev, { role: 'assistant', content: `${result.summary || 'I refined the preview design and updated the generated app code where applicable.'}\n\nSaved to the generated code package.` }]);
      setFiles([]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: `I couldn't save that change: ${e.message}` }]);
    } finally {
      setWorking(false);
    }
  };

  return <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-4">
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/20"><p className="text-xs font-semibold text-foreground">Wrapped Final App Preview</p><p className="text-[11px] text-muted-foreground">Use the app buttons below, or refine it with the AI editor.</p></div>
      {isCalculator(project, localState) ? <CalculatorFinalPreview title={project?.name || 'Calculator'} theme={theme} /> : <GenericFinalPreview project={project} publishState={localState} theme={theme} />}
    </div>

    <aside className="rounded-xl border border-border bg-card overflow-hidden flex flex-col min-h-[620px]">
      <div className="px-4 py-3 border-b border-border bg-muted/20 flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /><div><p className="text-xs font-semibold text-foreground">AI Design Editor</p><p className="text-[11px] text-muted-foreground">Upload reference images and chat to refine preview + code.</p></div></div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m, i) => <div key={i} className={`rounded-lg px-3 py-2 text-xs leading-relaxed ${m.role === 'user' ? 'bg-primary text-primary-foreground ml-8' : 'bg-muted text-foreground mr-8'}`}>{m.content}</div>)}
        {files.length > 0 && <div className="rounded-lg border border-border p-2 text-[11px] text-muted-foreground">Attached: {files.map(f => f.name).join(', ')}</div>}
      </div>
      <div className="border-t border-border p-3 space-y-2">
        <textarea value={input} onChange={e => setInput(e.target.value)} placeholder="Example: make it match this image, use softer shadows, bigger display, rounded buttons..." className="w-full h-20 resize-none rounded-lg border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-ring" />
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={e => uploadFiles(e.target.files)} />
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground cursor-pointer">
            <Switch checked={useCustomOpenAI} onCheckedChange={setUseCustomOpenAI} /> OpenAI
          </label>
          <button onClick={() => fileInputRef.current?.click()} disabled={working} className="h-8 px-3 rounded-md border border-border text-xs flex items-center gap-1.5 hover:bg-muted"><Image className="w-3.5 h-3.5" /> Image</button>
          <button onClick={sendMessage} disabled={working || (!input.trim() && files.length === 0)} className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs flex items-center gap-1.5 ml-auto disabled:opacity-50">{working ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} Apply</button>
        </div>
      </div>
    </aside>
  </div>;
}