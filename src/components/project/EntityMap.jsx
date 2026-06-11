import React, { useRef, useState, useEffect, useCallback } from 'react';
import { X, Link, Plus, Trash2, Check, Pencil } from 'lucide-react';

const MODULE_COLORS = [
  { bg: '#6366f1', light: '#eef2ff', border: '#a5b4fc' },
  { bg: '#0ea5e9', light: '#f0f9ff', border: '#7dd3fc' },
  { bg: '#10b981', light: '#ecfdf5', border: '#6ee7b7' },
  { bg: '#f59e0b', light: '#fffbeb', border: '#fcd34d' },
  { bg: '#ef4444', light: '#fef2f2', border: '#fca5a5' },
  { bg: '#8b5cf6', light: '#f5f3ff', border: '#c4b5fd' },
  { bg: '#ec4899', light: '#fdf2f8', border: '#f9a8d4' },
  { bg: '#14b8a6', light: '#f0fdfa', border: '#5eead4' },
];

const REL_LABELS = { one_to_one: '1:1', one_to_many: '1:N', many_to_many: 'N:M' };
const FIELD_TYPES = ['string', 'text', 'number', 'integer', 'boolean', 'date', 'datetime', 'json', 'array', 'file', 'email', 'url', 'enum'];

const NODE_W = 180;
const NODE_H_BASE = 52;
const FIELD_H = 18;
const MAX_FIELDS = 5;

function getNodeHeight(entity) {
  const fieldCount = Math.min(entity.fields?.length || 0, MAX_FIELDS);
  return NODE_H_BASE + fieldCount * FIELD_H + (fieldCount > 0 ? 8 : 0);
}

function layoutNodes(entities) {
  const cols = Math.ceil(Math.sqrt(entities.length));
  const gapX = 260, gapY = 220;
  return entities.map((e, i) => ({
    id: e.id,
    x: 60 + (i % cols) * gapX,
    y: 60 + Math.floor(i / cols) * gapY,
  }));
}

// Inline field editor panel (rendered as HTML overlay, not SVG)
function EntityEditPanel({ entity, color, onClose, onSave }) {
  const [fields, setFields] = useState(entity.fields ? JSON.parse(JSON.stringify(entity.fields)) : []);
  const [saving, setSaving] = useState(false);

  const addField = () => {
    setFields(f => [...f, { name: '', type: 'string', required: false, description: '' }]);
  };

  const updateField = (i, key, val) => {
    setFields(f => {
      const next = [...f];
      next[i] = { ...next[i], [key]: val };
      return next;
    });
  };

  const removeField = (i) => {
    setFields(f => f.filter((_, idx) => idx !== i));
  };

  const handleSave = async () => {
    setSaving(true);
    await onSave(entity.id, { fields });
    setSaving(false);
  };

  return (
    <div className="absolute top-3 right-3 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[calc(100%-24px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 flex-shrink-0" style={{ background: color?.bg }}>
        <div>
          <p className="text-xs font-bold text-white">{entity.name}</p>
          <p className="text-xs text-white/70">{entity.module || 'General'}</p>
        </div>
        <button onClick={onClose} className="text-white/70 hover:text-white">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Fields editor */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-foreground">Fields</p>
          <button
            onClick={addField}
            className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 font-medium"
          >
            <Plus className="w-3 h-3" /> Add
          </button>
        </div>

        {fields.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">No fields yet. Add one below.</p>
        )}

        <div className="space-y-1.5">
          {fields.map((field, i) => (
            <div key={i} className="bg-muted/40 rounded-lg p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <input
                  value={field.name}
                  onChange={e => updateField(i, 'name', e.target.value)}
                  placeholder="field_name"
                  className="flex-1 text-xs font-mono bg-background border border-border rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-ring"
                />
                <select
                  value={field.type}
                  onChange={e => updateField(i, 'type', e.target.value)}
                  className="text-xs bg-background border border-border rounded px-1 py-1 focus:outline-none"
                  style={{ color: color?.bg }}
                >
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => removeField(i)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!field.required}
                    onChange={e => updateField(i, 'required', e.target.checked)}
                    className="w-3 h-3"
                  />
                  Required
                </label>
                <input
                  value={field.description || ''}
                  onChange={e => updateField(i, 'description', e.target.value)}
                  placeholder="description..."
                  className="flex-1 text-xs bg-background border border-border rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </div>
            </div>
          ))}
        </div>

        {/* Relationships (read-only) */}
        {(entity.relationships || []).length > 0 && (
          <div className="mt-3 pt-3 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">Relationships</p>
            {entity.relationships.map((r, i) => (
              <div key={i} className="flex items-center gap-1.5 py-0.5">
                <Link className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-xs text-foreground">{r.related_entity}</span>
                <span className="text-xs text-muted-foreground ml-auto">{REL_LABELS[r.type] || r.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save button */}
      <div className="px-3 py-2.5 border-t border-border flex-shrink-0">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold text-white rounded-lg py-1.5 transition-opacity disabled:opacity-60"
          style={{ background: color?.bg }}
        >
          {saving ? (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Check className="w-3 h-3" />
          )}
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

export default function EntityMap({ entities, onEntityUpdate }) {
  const svgRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [panStart, setPanStart] = useState(null);
  const [zoom, setZoom] = useState(1);

  // Assign module colors
  const moduleColorMap = {};
  let colorIdx = 0;
  entities.forEach(e => {
    const mod = e.module || 'General';
    if (!(mod in moduleColorMap)) moduleColorMap[mod] = MODULE_COLORS[colorIdx++ % MODULE_COLORS.length];
  });

  useEffect(() => {
    if (entities.length === 0) return;
    const layout = layoutNodes(entities);
    const map = {};
    layout.forEach(n => { map[n.id] = { x: n.x, y: n.y }; });
    setPositions(map);
  }, [entities.map(e => e.id).join(',')]);

  const onNodeMouseDown = useCallback((e, id) => {
    e.stopPropagation();
    const pos = positions[id] || { x: 0, y: 0 };
    setDragging({ id, ox: e.clientX / zoom - pos.x, oy: e.clientY / zoom - pos.y });
    setSelected(id);
  }, [positions, zoom]);

  const onMouseMove = useCallback((e) => {
    if (dragging) {
      setPositions(p => ({ ...p, [dragging.id]: { x: e.clientX / zoom - dragging.ox, y: e.clientY / zoom - dragging.oy } }));
    } else if (panning && panStart) {
      setPan({ x: panStart.px + e.clientX - panStart.mx, y: panStart.py + e.clientY - panStart.my });
    }
  }, [dragging, panning, panStart, zoom]);

  const onMouseUp = useCallback(() => {
    setDragging(null);
    setPanning(false);
    setPanStart(null);
  }, []);

  const onSvgMouseDown = useCallback((e) => {
    if (e.target === svgRef.current || e.target.tagName === 'svg') {
      setPanning(true);
      setPanStart({ mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y });
      setSelected(null);
    }
  }, [pan]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    setZoom(z => Math.min(2, Math.max(0.3, z - e.deltaY * 0.001)));
  }, []);

  // Build edges
  const edges = [];
  entities.forEach(entity => {
    (entity.relationships || []).forEach(rel => {
      const target = entities.find(e => e.name === rel.related_entity);
      if (!target || !positions[entity.id] || !positions[target.id]) return;
      const fromPos = positions[entity.id];
      const toPos = positions[target.id];
      const fromH = getNodeHeight(entity);
      const toH = getNodeHeight(target);
      const key = [entity.id, target.id].sort().join('_');
      if (!edges.find(e => e.key === key)) {
        edges.push({
          key,
          x1: fromPos.x + NODE_W / 2, y1: fromPos.y + fromH / 2,
          x2: toPos.x + NODE_W / 2, y2: toPos.y + toH / 2,
          label: REL_LABELS[rel.type] || rel.type,
        });
      }
    });
  });

  const selectedEntity = entities.find(e => e.id === selected);
  const color = selectedEntity ? (moduleColorMap[selectedEntity.module || 'General'] || MODULE_COLORS[0]) : null;

  if (entities.length === 0) return null;

  return (
    <div className="relative w-full h-full bg-muted/20 overflow-hidden" style={{ cursor: panning ? 'grabbing' : 'grab' }}>
      <svg
        ref={svgRef}
        className="w-full h-full"
        onMouseDown={onSvgMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
        style={{ userSelect: 'none' }}
      >
        <defs>
          <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
          </marker>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" stroke="hsl(214,20%,88%)" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {edges.map(edge => {
            const mx = (edge.x1 + edge.x2) / 2;
            const my = (edge.y1 + edge.y2) / 2;
            return (
              <g key={edge.key}>
                <line x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
                  stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,3" markerEnd="url(#arrowhead)" />
                {edge.label && (
                  <g>
                    <rect x={mx - 14} y={my - 9} width={28} height={16} rx={4} fill="white" stroke="#e2e8f0" strokeWidth="1" />
                    <text x={mx} y={my + 3} textAnchor="middle" fontSize="9" fontFamily="monospace" fill="#64748b" fontWeight="600">{edge.label}</text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {entities.map(entity => {
            const pos = positions[entity.id];
            if (!pos) return null;
            const mod = entity.module || 'General';
            const c = moduleColorMap[mod] || MODULE_COLORS[0];
            const isSelected = selected === entity.id;
            const nodeH = getNodeHeight(entity);
            const visibleFields = (entity.fields || []).slice(0, MAX_FIELDS);

            return (
              <g key={entity.id} transform={`translate(${pos.x},${pos.y})`}
                onMouseDown={e => onNodeMouseDown(e, entity.id)} style={{ cursor: 'grab' }}>
                <rect x={2} y={3} width={NODE_W} height={nodeH} rx={10} fill="rgba(0,0,0,0.08)" />
                <rect width={NODE_W} height={nodeH} rx={10} fill="white"
                  stroke={isSelected ? c.bg : '#e2e8f0'} strokeWidth={isSelected ? 2.5 : 1.5} />
                <rect width={NODE_W} height={32} rx={10} fill={c.bg} />
                <rect y={22} width={NODE_W} height={10} fill={c.bg} />
                <circle cx={16} cy={16} r={9} fill="rgba(255,255,255,0.2)" />
                <text x={16} y={20} textAnchor="middle" fontSize="10" fill="white">⬡</text>
                <text x={32} y={20} fontSize="11" fontWeight="700" fill="white" fontFamily="monospace">
                  {entity.name.length > 16 ? entity.name.slice(0, 15) + '…' : entity.name}
                </text>
                <text x={NODE_W - 6} y={20} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.7)">
                  {mod.length > 10 ? mod.slice(0, 9) + '…' : mod}
                </text>
                {/* Edit hint icon on selected */}
                {isSelected && (
                  <g>
                    <circle cx={NODE_W - 10} cy={10} r={7} fill="rgba(255,255,255,0.3)" />
                    <text x={NODE_W - 10} y={14} textAnchor="middle" fontSize="8" fill="white">✎</text>
                  </g>
                )}
                {visibleFields.map((field, fi) => (
                  <g key={fi} transform={`translate(0,${38 + fi * FIELD_H})`}>
                    <rect x={8} width={NODE_W - 16} height={FIELD_H - 1} rx={2} fill={fi % 2 === 0 ? '#f8fafc' : 'white'} />
                    <text x={14} y={12} fontSize="9" fill="#475569" fontFamily="monospace">{field.name}</text>
                    <text x={NODE_W - 14} y={12} textAnchor="end" fontSize="8" fill={c.bg} fontFamily="monospace">{field.type}</text>
                    {field.required && <text x={NODE_W - 6} y={12} fontSize="9" fill="#ef4444" fontWeight="bold">*</text>}
                  </g>
                ))}
                {(entity.fields?.length || 0) > MAX_FIELDS && (
                  <text x={NODE_W / 2} y={38 + MAX_FIELDS * FIELD_H + 2} textAnchor="middle" fontSize="8" fill="#94a3b8">
                    +{entity.fields.length - MAX_FIELDS} more fields
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Zoom controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-1">
        <button onClick={() => setZoom(z => Math.min(2, z + 0.15))} className="w-7 h-7 bg-card border border-border rounded-md text-sm font-bold text-muted-foreground hover:text-foreground flex items-center justify-center shadow-sm">+</button>
        <button onClick={() => setZoom(1)} className="w-7 h-7 bg-card border border-border rounded-md text-xs text-muted-foreground hover:text-foreground flex items-center justify-center shadow-sm">{Math.round(zoom * 100)}%</button>
        <button onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} className="w-7 h-7 bg-card border border-border rounded-md text-sm font-bold text-muted-foreground hover:text-foreground flex items-center justify-center shadow-sm">−</button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 bg-card/90 backdrop-blur border border-border rounded-lg px-3 py-2 shadow-sm">
        <p className="text-xs font-semibold text-muted-foreground mb-1.5">Modules</p>
        <div className="flex flex-col gap-1">
          {Object.entries(moduleColorMap).map(([mod, c]) => (
            <div key={mod} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: c.bg }} />
              <span className="text-xs text-foreground">{mod}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Inline edit panel */}
      {selectedEntity && (
        <EntityEditPanel
          entity={selectedEntity}
          color={color}
          onClose={() => setSelected(null)}
          onSave={onEntityUpdate}
        />
      )}

      <div className="absolute bottom-4 left-3 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded-md border border-border">
        Click node to edit · Drag to move · Scroll to zoom
      </div>
    </div>
  );
}