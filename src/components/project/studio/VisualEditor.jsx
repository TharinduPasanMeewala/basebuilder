import React, { useState } from 'react';
import { Palette, Type, PanelLeft, Sparkles, Wand2 } from 'lucide-react';

const SWATCHES = ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#ea580c', '#0891b2', '#db2777', '#171717'];

const DESIGNER_PROMPTS = [
  'Suggest a professional color palette for this app type and apply the best primary color',
  'Make the design more modern and minimal',
  'Review the pages and improve the overall UI/UX structure',
];

export default function VisualEditor({ design, onChange, onAskDesigner, busy }) {
  const [name, setName] = useState(design.app_name || '');

  return (
    <div className="h-full overflow-y-auto p-3 space-y-4">
      {/* App name */}
      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5">
          <Type className="w-3 h-3 text-primary" /> App Name
        </label>
        <input
          className="w-full bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={name}
          placeholder="App name"
          onChange={e => setName(e.target.value)}
          onBlur={() => name.trim() && name !== design.app_name && onChange({ app_name: name.trim() })}
          onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        />
      </div>

      {/* Brand color */}
      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5">
          <Palette className="w-3 h-3 text-primary" /> Brand Color
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {SWATCHES.map(c => (
            <button
              key={c}
              onClick={() => onChange({ primary: c })}
              className={`w-7 h-7 rounded-lg border-2 transition-transform hover:scale-110 ${design.primary === c ? 'border-foreground scale-110' : 'border-transparent'}`}
              style={{ background: c }}
              title={c}
            />
          ))}
          <label className="w-7 h-7 rounded-lg border border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary transition-colors" title="Custom color">
            <input
              type="color"
              value={design.primary || '#2563eb'}
              onChange={e => onChange({ primary: e.target.value })}
              className="opacity-0 absolute w-0 h-0"
            />
            <span className="text-[10px] text-muted-foreground">+</span>
          </label>
        </div>
      </div>

      {/* Sidebar theme */}
      <div>
        <label className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1.5">
          <PanelLeft className="w-3 h-3 text-primary" /> Sidebar Theme
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[{ label: 'Dark', dark: true }, { label: 'Light', dark: false }].map(opt => (
            <button
              key={opt.label}
              onClick={() => onChange({ sidebar_dark: opt.dark })}
              className={`text-xs py-2 rounded-lg border transition-colors ${
                design.sidebar_dark === opt.dark
                  ? 'bg-primary text-primary-foreground border-primary font-semibold'
                  : 'bg-muted/40 border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* AI Designer */}
      <div className="border-t border-border pt-3">
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground mb-1">
          <Wand2 className="w-3 h-3 text-primary" /> UI/UX Designer Agent
        </p>
        <p className="text-[10px] text-muted-foreground mb-2">Let the professional designer agent review and improve your app.</p>
        <div className="space-y-1.5">
          {DESIGNER_PROMPTS.map(p => (
            <button
              key={p}
              onClick={() => onAskDesigner(p)}
              disabled={busy}
              className="w-full flex items-start gap-1.5 text-left text-[11px] bg-muted/40 hover:bg-primary/10 hover:text-primary border border-border rounded-lg px-2.5 py-2 transition-colors text-muted-foreground disabled:opacity-50"
            >
              <Sparkles className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}