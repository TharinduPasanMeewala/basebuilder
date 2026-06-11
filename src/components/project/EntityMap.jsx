import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Database, X, Link } from 'lucide-react';

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

const REL_LABELS = {
  one_to_one: '1:1',
  one_to_many: '1:N',
  many_to_many: 'N:M',
};

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

export default function EntityMap({ entities }) {
  const svgRef = useRef(null);
  const [positions, setPositions] = useState({});
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(null); // { id, ox, oy }
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

  // Drag node
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

  // Build edges from relationships
  const edges = [];
  entities.forEach(entity => {
    (entity.relationships || []).forEach((rel, ri) => {
      const target = entities.find(e => e.name === rel.related_entity);
      if (!target || !positions[entity.id] || !positions[target.id]) return;
      const fromPos = positions[entity.id];
      const toPos = positions[target.id];
      const fromH = getNodeHeight(entity);
      const toH = getNodeHeight(target);
      const x1 = fromPos.x + NODE_W / 2;
      const y1 = fromPos.y + fromH / 2;
      const x2 = toPos.x + NODE_W / 2;
      const y2 = toPos.y + toH / 2;
      // Avoid duplicate edges
      const key = [entity.id, target.id].sort().join('_');
      if (!edges.find(e => e.key === key)) {
        edges.push({ key, x1, y1, x2, y2, label: REL_LABELS[rel.type] || rel.type, fromName: entity.name, toName: rel.related_entity });
      }
    });
  });

  const selectedEntity = entities.find(e => e.id === selected);
  const color = selectedEntity ? (moduleColorMap[selectedEntity.module || 'General'] || MODULE_COLORS[0]) : null;

  if (entities.length === 0) return null;

  return (
    <div className="relative w-full h-full bg-muted/20 overflow-hidden rounded-none" style={{ cursor: panning ? 'grabbing' : 'grab' }}>
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
                <line
                  x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
                  stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="5,3"
                  markerEnd="url(#arrowhead)"
                />
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
              <g
                key={entity.id}
                transform={`translate(${pos.x},${pos.y})`}
                onMouseDown={e => onNodeMouseDown(e, entity.id)}
                style={{ cursor: 'grab' }}
              >
                {/* Shadow */}
                <rect x={2} y={3} width={NODE_W} height={nodeH} rx={10} fill="rgba(0,0,0,0.08)" />
                {/* Card */}
                <rect
                  width={NODE_W} height={nodeH} rx={10}
                  fill="white"
                  stroke={isSelected ? c.bg : '#e2e8f0'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />
                {/* Header */}
                <rect width={NODE_W} height={32} rx={10} fill={c.bg} />
                <rect y={22} width={NODE_W} height={10} fill={c.bg} />

                {/* Icon */}
                <circle cx={16} cy={16} r={9} fill="rgba(255,255,255,0.2)" />
                <text x={16} y={20} textAnchor="middle" fontSize="10" fill="white">⬡</text>

                {/* Name */}
                <text x={32} y={20} fontSize="11" fontWeight="700" fill="white" fontFamily="monospace">
                  {entity.name.length > 16 ? entity.name.slice(0, 15) + '…' : entity.name}
                </text>

                {/* Module badge */}
                <text x={NODE_W - 6} y={20} textAnchor="end" fontSize="8" fill="rgba(255,255,255,0.7)">
                  {mod.length > 10 ? mod.slice(0, 9) + '…' : mod}
                </text>

                {/* Fields */}
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

      {/* Detail panel */}
      {selectedEntity && (
        <div className="absolute top-3 right-3 w-64 bg-card border border-border rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2.5" style={{ background: color?.bg }}>
            <div>
              <p className="text-xs font-bold text-white">{selectedEntity.name}</p>
              <p className="text-xs text-white/70">{selectedEntity.module || 'General'}</p>
            </div>
            <button onClick={() => setSelected(null)} className="text-white/70 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {selectedEntity.description && (
            <p className="text-xs text-muted-foreground px-3 py-2 border-b border-border">{selectedEntity.description}</p>
          )}
          <div className="px-3 py-2 max-h-48 overflow-y-auto">
            {(selectedEntity.fields || []).map((f, i) => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <span className="text-xs font-mono text-foreground">{f.name}{f.required ? <span className="text-red-500 ml-0.5">*</span> : ''}</span>
                <span className="text-xs font-mono" style={{ color: color?.bg }}>{f.type}</span>
              </div>
            ))}
          </div>
          {(selectedEntity.relationships || []).length > 0 && (
            <div className="px-3 py-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Relationships</p>
              {selectedEntity.relationships.map((r, i) => (
                <div key={i} className="flex items-center gap-1.5 py-0.5">
                  <Link className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="text-xs text-foreground">{r.related_entity}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{REL_LABELS[r.type] || r.type}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="absolute bottom-4 left-3 text-xs text-muted-foreground bg-card/80 px-2 py-1 rounded-md border border-border">
        Drag nodes · Scroll to zoom · Click for details
      </div>
    </div>
  );
}