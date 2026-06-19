import React from 'react';
import { Sparkles } from 'lucide-react';

export default function EmptyState({ title, description, children }) {
  return <div className="border border-dashed border-border rounded-3xl bg-card/60 p-10 text-center"><div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-4"><Sparkles className="w-7 h-7" /></div><h3 className="text-xl font-bold">{title}</h3><p className="text-muted-foreground max-w-xl mx-auto mt-2 mb-6">{description}</p>{children}</div>;
}