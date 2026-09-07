import React from 'react';

export default function Designable({ id, label, enabled, selectedId, onSelect, settings = {}, className = '', style: baseStyle, children }) {
  const selected = selectedId === id;
  const style = {
    ...baseStyle,
    transform: `translate(${settings.x || 0}px, ${settings.y || 0}px)`,
    width: settings.width ? `${settings.width}px` : undefined,
    minHeight: settings.height ? `${settings.height}px` : undefined,
    borderRadius: settings.radius !== undefined ? `${settings.radius}px` : baseStyle?.borderRadius,
    padding: settings.padding !== undefined ? `${settings.padding}px` : baseStyle?.padding,
    fontSize: settings.fontSize ? `${settings.fontSize}px` : baseStyle?.fontSize,
    background: settings.background || baseStyle?.background,
    color: settings.color || baseStyle?.color,
    boxShadow: settings.shadow || baseStyle?.boxShadow,
  };

  return (
    <div
      data-design-label={label}
      data-design-id={id}
      onClickCapture={enabled ? (event) => { if (event.target.closest('[data-design-id]') !== event.currentTarget) return; event.preventDefault(); event.stopPropagation(); onSelect(id, label); } : undefined}
      className={`${className} ${enabled ? 'relative cursor-move transition-all hover:ring-2 hover:ring-primary/50' : ''} ${enabled && selected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
      style={style}
    >
      {enabled && selected && <span className="absolute -top-5 left-0 rounded bg-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground z-10">{label}</span>}
      <div inert={enabled ? '' : undefined} style={{ display: 'contents' }}>{children}</div>
    </div>
  );
}