import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Sparkles, Wand2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

const SUGGESTIONS = [
  'Add a Customers entity with name, email and phone',
  'Change the brand color to green',
  'Rename the app',
  'Add an Invoices page',
];

export default function StudioChat({ messages, busy, onSend }) {
  const [input, setInput] = useState('');
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy]);

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    onSend(text);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Wand2 className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">AI Editor</p>
            <p className="text-xs text-muted-foreground mb-4 px-4">Describe a change — I'll apply it and the preview updates instantly.</p>
            <div className="space-y-1.5 px-2">
              {SUGGESTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => onSend(s)}
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
              {m.role === 'user'
                ? <p>{m.content}</p>
                : <ReactMarkdown className="prose prose-xs max-w-none [&>p]:my-0.5">{m.content}</ReactMarkdown>}
              {m.applied?.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-0.5">
                  {m.applied.map((a, j) => (
                    <p key={j} className="flex items-center gap-1.5 text-[10px] text-green-600 font-medium">
                      <Sparkles className="w-2.5 h-2.5" /> {a}
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
      <div className="border-t border-border p-2.5 flex gap-2 flex-shrink-0">
        <input
          className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          placeholder="Describe a change…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={busy}
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="bg-primary text-primary-foreground rounded-lg px-3 disabled:opacity-50 hover:bg-primary/90 transition-colors"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}