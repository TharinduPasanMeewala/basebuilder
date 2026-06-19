import React from 'react';

export default function Designable({ id, label, enabled, selectedId, onSelect, settings = {}, className = '', children }) {
  const selected = selectedId === id;
  const style = enabled ? {
    transform: `translate(${settings.x || 0}px, ${settings.y || 0}px)`,
    width: settings.width ? `${settings.width}px` : undefined,
    minHeight: settings.height ? `${settings.height}px` : undefined,
    borderRadius: settings.radius ? `${settings.radius}px` : undefined,
    background: settings.background || undefined,
    color: settings.color || undefined,
    boxShadow: settings.shadow || undefined,
  } : undefined;

  return (
    <div
      data-design-label={label}
      onClick={enabled ? (event) => { event.stopPropagation(); onSelect(id, label); } : undefined}
      className={`${className} ${enabled ? 'relative cursor-move transition-all hover:ring-2 hover:ring-primary/50' : ''} ${selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
      style={style}
    >
      {enabled && selected && <span className="absolute -top-5 left-0 rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground z-10">{label}</span>}
      {children}
    </div>
  );
}