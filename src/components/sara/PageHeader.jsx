import React from 'react';

export default function PageHeader({ eyebrow, title, description, action }) {
  return <div className="mb-6 flex flex-col lg:flex-row lg:items-end gap-4">
    <div className="flex-1"><p className="text-xs font-semibold uppercase tracking-widest text-primary mb-2">{eyebrow}</p><h2 className="text-3xl font-bold tracking-tight">{title}</h2><p className="text-muted-foreground mt-2 max-w-2xl">{description}</p></div>
    {action}
  </div>;
}