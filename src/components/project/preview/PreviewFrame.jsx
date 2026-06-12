import React, { useState } from 'react';
import { Lock, RotateCw } from 'lucide-react';

// Interactive live mock of the generated app
export default function PreviewFrame({ project, entities, pages, design, editMode, onEditName }) {
  const [activeNav, setActiveNav] = useState('dashboard');

  const navItems = [
    { key: 'dashboard', label: 'Dashboard', icon: '📊' },
    ...entities.slice(0, 6).map((e, i) => ({
      key: `e-${e.id}`, label: e.name, icon: ['📦','🛒','👥','📋','🏷️','📁'][i % 6], entity: e,
    })),
    ...pages.filter(p => !entities.some(e => e.name === p.name)).slice(0, 3).map(p => ({
      key: `p-${p.id}`, label: p.name, icon: '📄',
    })),
  ];

  const active = navItems.find(n => n.key === activeNav) || navItems[0];
  const primary = design.primary || '#2563eb';
  const publishUrl = `${window.location.origin}/projects/${project.id}/published`;

  return (
    <div className="rounded-xl border border-border overflow-hidden shadow-sm bg-white flex flex-col" style={{ minHeight: 480 }}>
      {/* Browser chrome */}
      <div className="bg-zinc-100 border-b border-zinc-200 px-3 py-2 flex items-center gap-2 flex-shrink-0">
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
          <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        </div>
        <div className="flex-1 flex items-center gap-1.5 bg-white border border-zinc-200 rounded-full px-3 py-1 mx-2 min-w-0">
          <Lock className="w-3 h-3 text-green-600 flex-shrink-0" />
          <span className="text-[11px] text-zinc-600 truncate font-mono">{publishUrl}</span>
        </div>
        <RotateCw className="w-3.5 h-3.5 text-zinc-400" />
      </div>

      {/* App body */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className={`w-44 flex-shrink-0 flex flex-col ${design.sidebar_dark ? 'bg-gray-900' : 'bg-white border-r border-gray-200'}`}>
          <div className={`px-3 py-3 border-b ${design.sidebar_dark ? 'border-gray-700/50' : 'border-gray-100'}`}>
            {editMode ? (
              <input
                className={`w-full bg-transparent font-bold text-sm outline-none border-b border-dashed ${design.sidebar_dark ? 'text-white border-gray-500' : 'text-gray-900 border-gray-300'}`}
                value={design.app_name || project.name}
                onChange={e => onEditName(e.target.value)}
              />
            ) : (
              <p className={`font-bold text-sm truncate ${design.sidebar_dark ? 'text-white' : 'text-gray-900'}`}>
                {design.app_name || project.name}
              </p>
            )}
            <p className={`text-[10px] mt-0.5 ${design.sidebar_dark ? 'text-gray-400' : 'text-gray-400'}`}>
              {project.type?.replace(/_/g, ' ')}
            </p>
          </div>
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {navItems.map(item => (
              <button
                key={item.key}
                onClick={() => setActiveNav(item.key)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors text-left ${
                  activeNav === item.key
                    ? 'text-white'
                    : design.sidebar_dark ? 'text-gray-300 hover:bg-gray-800' : 'text-gray-600 hover:bg-gray-100'
                }`}
                style={activeNav === item.key ? { background: primary } : {}}
              >
                <span>{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 bg-gray-50 p-5 overflow-y-auto min-w-0">
          {active?.key === 'dashboard' ? (
            <div>
              <h2 className="text-lg font-bold text-gray-900">Dashboard</h2>
              <p className="text-xs text-gray-500 mb-4">Welcome to {design.app_name || project.name}</p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                {entities.slice(0, 4).map((e, i) => (
                  <div key={e.id} className="bg-white rounded-xl border border-gray-200 p-3.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm mb-2" style={{ background: `${primary}1a` }}>
                      {['📦','🛒','👥','📋'][i % 4]}
                    </div>
                    <p className="text-lg font-bold text-gray-900">{(i + 1) * 12}</p>
                    <p className="text-[10px] text-gray-500 truncate">{e.name}</p>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <h3 className="text-xs font-semibold text-gray-900 mb-3">Recent activity</h3>
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: primary }} />
                    <div className="h-2.5 bg-gray-100 rounded flex-1" style={{ maxWidth: `${70 - i * 15}%` }} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{active?.label}</h2>
                  <p className="text-xs text-gray-500">Manage {active?.label} records</p>
                </div>
                <button className="text-white text-xs font-medium px-3 py-1.5 rounded-lg" style={{ background: primary }}>
                  + Add {active?.label}
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="grid border-b border-gray-100 bg-gray-50 px-4 py-2" style={{ gridTemplateColumns: `repeat(${Math.min((active?.entity?.fields || []).length || 3, 4)}, 1fr) 80px` }}>
                  {(active?.entity?.fields || [{name:'Name'},{name:'Status'},{name:'Date'}]).slice(0, 4).map((f, i) => (
                    <span key={i} className="text-[10px] font-semibold text-gray-500 uppercase truncate">{f.name}</span>
                  ))}
                  <span className="text-[10px] font-semibold text-gray-500 uppercase text-right">Actions</span>
                </div>
                {[1, 2, 3, 4].map(row => (
                  <div key={row} className="grid items-center px-4 py-2.5 border-b border-gray-50 last:border-0" style={{ gridTemplateColumns: `repeat(${Math.min((active?.entity?.fields || []).length || 3, 4)}, 1fr) 80px` }}>
                    {(active?.entity?.fields || [1,2,3]).slice(0, 4).map((_, i) => (
                      <div key={i} className="h-2.5 bg-gray-100 rounded mr-3" style={{ width: `${80 - i * 12}%` }} />
                    ))}
                    <div className="text-right">
                      <span className="text-[10px] font-medium mr-2" style={{ color: primary }}>Edit</span>
                      <span className="text-[10px] font-medium text-red-400">Delete</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}