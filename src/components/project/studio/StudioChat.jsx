import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Wand2, ImagePlus, X, Users } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { base44 } from '@/api/base44Client';

const SUGGESTIONS = [
  'Add a Customers entity with name, email and phone',
  'Change the brand color to green',
  'Add an Invoices page',
];

export default function StudioChat({ messages, busy, onSend }) {
  const [input, setInput] = useState('');
  const [images, setImages] = useState([]); // [{url, name}]
  const [uploading, setUploading] = useState(false);
  const [roundtable, setRoundtable] = useState(false);
  const endRef = useRef(null);
  const fileRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploading(true);
    const uploaded = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      uploaded.push({ url: file_url, name: file.name });
    }
    setImages(imgs => [...imgs, ...uploaded]);
    setUploading(false);
    e.target.value = '';
  };

  const send = () => {
    const text = input.trim();
    if ((!text && images.length === 0) || busy || uploading) return;
    setInput('');
    const urls = images.map(i => i.url);
    setImages([]);
    onSend(text || 'Get ideas from the attached image(s) and apply them.', urls, roundtable);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Wand2 className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">AI Editor</p>
            <p className="text-xs text-muted-foreground mb-4 px-4">Describe a change or upload a screenshot — I'll apply it and the preview updates instantly.</p>
            <div className="space-y-1.5 px-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => onSend(s, [], roundtable)}
                  disabled={busy}
                  className="w-full text-left text-xs bg-muted/40 hover:bg-primary/10 hover:text-primary border border-border rounded-lg px-3 py-2 transition-colors text-muted-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
              m.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 border border-border text-foreground'
            }`}>
              {m.images?.length > 0 && (
                <div className="flex gap-1.5 flex-wrap mb-1.5">
                  {m.images.map((url, j) => (
                    <img key={j} src={url} alt="attachment" className="w-16 h-16 object-cover rounded-lg border border-white/20" />
                  ))}
                </div>
              )}
              {m.content && (m.role === 'user'
                ? <p>{m.content}</p>
                : <ReactMarkdown className="prose prose-xs max-w-none [&>p]:my-0.5">{m.content}</ReactMarkdown>)}
              {m.applied?.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-0.5">
                  {m.applied.map((a, j) => (
                    <p key={j} className="flex items-center gap-1.5 text-[10px] text-green-600 font-medium">
                      <Sparkles className="w-2.5 h-2.5" /> {a}
                    </p>
                  ))}
                </div>
              )}
              {m.roundtable?.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-1">
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-primary"><Users className="w-2.5 h-2.5" /> Agent Roundtable</p>
                  {m.roundtable.map((r, j) => (
                    <p key={j} className="text-[10px] text-muted-foreground">
                      <span className="font-semibold text-foreground">{r.agent}:</span> {r.comment}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> Applying changes…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Pending image attachments */}
      {images.length > 0 && (
        <div className="flex gap-2 flex-wrap px-2.5 pt-2 border-t border-border">
          {images.map((img, i) => (
            <div key={i} className="relative">
              <img src={img.url} alt={img.name} className="w-12 h-12 object-cover rounded-lg border border-border" />
              <button
                onClick={() => setImages(imgs => imgs.filter((_, j) => j !== i))}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className={`p-2.5 flex items-center gap-1.5 flex-shrink-0 ${images.length > 0 ? '' : 'border-t border-border'}`}>
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy || uploading}
          className="text-muted-foreground hover:text-primary transition-colors p-1.5 disabled:opacity-50 flex-shrink-0"
          title="Upload image for ideas"
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
        </button>
        <button
          onClick={() => setRoundtable(r => !r)}
          className={`p-1.5 rounded-md transition-colors flex-shrink-0 ${roundtable ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-primary'}`}
          title={roundtable ? 'Agent Roundtable: ON — experts will review each edit' : 'Agent Roundtable: OFF'}
        >
          <Users className="w-4 h-4" />
        </button>
        <input
          className="flex-1 min-w-0 bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Describe a change…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={busy}
        />
        <button
          onClick={send}
          disabled={busy || uploading || (!input.trim() && images.length === 0)}
          className="bg-primary text-primary-foreground rounded-lg px-3 py-2 disabled:opacity-50 hover:bg-primary/90 transition-colors flex-shrink-0"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}