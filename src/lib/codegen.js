// Deterministic code generator: builds a deployable Vite + React + Tailwind app
// from a project snapshot. It prefers working product-specific screens over stubs.

function slugify(name) {
  return (name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
}

function componentName(name) {
  return (name || 'Page').replace(/[^a-zA-Z0-9]/g, '') || 'Page';
}

function escapeText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

const ICONS = ['📊', '📦', '🛒', '👥', '⚙️', '📋', '🔧', '📈', '🏷️', '📁'];

function projectText(project, snapshot = {}) {
  return [
    project?.name,
    project?.description,
    project?.type,
    ...(snapshot.pages || []).flatMap(p => [p.name, p.type, p.description, p.route]),
    ...(snapshot.requirements || []).flatMap(r => [r.title, r.description, r.category]),
    ...(snapshot.entities || []).flatMap(e => [e.name, e.description]),
  ].filter(Boolean).join(' ').toLowerCase();
}

function isCalculatorApp(project, snapshot = {}) {
  return /\bcalculator\b|\bcalculate\b|arithmetic|math app/.test(projectText(project, snapshot));
}

function designTokens(design = {}) {
  return {
    primary: design.primary_color || '#6b7280',
    accent: design.accent_color || '#111827',
    background: design.background_color || '#e5e5e8',
    surface: design.surface_color || '#f4f4f5',
    text: design.text_color || '#050505',
    font: design.font_family || 'Arial',
    radius: Number(design.radius || 8),
  };
}

function buildGlobalCss(design = {}) {
  const d = designTokens(design);
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --brand-primary: ${d.primary};
  --brand-accent: ${d.accent};
  --brand-bg: ${d.background};
  --brand-surface: ${d.surface};
  --brand-text: ${d.text};
  --brand-radius: ${d.radius}px;
  --brand-font: '${d.font}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

* { box-sizing: border-box; }
body { margin: 0; font-family: var(--brand-font); background: var(--brand-bg); color: var(--brand-text); }`;
}

function buildTailwindConfig() {
  return `/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--brand-primary)',
          accent: 'var(--brand-accent)',
          bg: 'var(--brand-bg)',
          surface: 'var(--brand-surface)',
          text: 'var(--brand-text)',
        },
      },
      borderRadius: { brand: 'var(--brand-radius)' },
      fontFamily: { brand: ['var(--brand-font)'] },
    },
  },
  plugins: [],
}`;
}

function buildCalculatorPage(appName) {
  const title = escapeText(appName || 'Calculator');
  return `import { useState } from 'react'

const buttons = [
  ['C', 'sqrt', '%', 'CE'],
  ['7', '8', '9', '+'],
  ['4', '5', '6', '×'],
  ['1', '2', '3', '−'],
  ['0', '.', '.', '='],
]

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export default function CalculatorPage() {
  const [display, setDisplay] = useState('0')
  const [stored, setStored] = useState(null)
  const [operator, setOperator] = useState(null)
  const [fresh, setFresh] = useState(true)
  const [minimized, setMinimized] = useState(false)

  function calculate(left, op, right) {
    if (op === '+') return left + right
    if (op === '−') return left - right
    if (op === '×') return left * right
    return right
  }

  function format(value) {
    if (!Number.isFinite(value)) return 'Error'
    return String(Number(value.toFixed(10)))
  }

  function clearAll() {
    setDisplay('0')
    setStored(null)
    setOperator(null)
    setFresh(true)
  }

  function clearEntry() {
    setDisplay('0')
    setFresh(true)
  }

  function pressNumber(key) {
    if (key === '.' && display.includes('.') && !fresh) return
    if (fresh) {
      setDisplay(key === '.' ? '0.' : key)
      setFresh(false)
      return
    }
    setDisplay(display === '0' && key !== '.' ? key : display + key)
  }

  function pressOperator(nextOperator) {
    const current = toNumber(display)
    if (stored !== null && operator && !fresh) {
      const result = calculate(stored, operator, current)
      setStored(result)
      setDisplay(format(result))
    } else {
      setStored(current)
    }
    setOperator(nextOperator)
    setFresh(true)
  }

  function equals() {
    if (stored === null || !operator) return
    const result = calculate(stored, operator, toNumber(display))
    setDisplay(format(result))
    setStored(null)
    setOperator(null)
    setFresh(true)
  }

  function pressSpecial(key) {
    if (key === 'C') clearAll()
    else if (key === 'CE') clearEntry()
    else if (key === 'sqrt') {
      const result = Math.sqrt(Math.max(0, toNumber(display)))
      setDisplay(format(result))
      setFresh(true)
    } else if (key === '%') {
      setDisplay(format(toNumber(display) / 100))
      setFresh(true)
    } else if (key === '=') equals()
    else pressOperator(key)
  }

  function press(key) {
    if (/^[0-9.]$/.test(key)) pressNumber(key)
    else pressSpecial(key)
  }

  return (
    <main className="min-h-screen flex items-start justify-center bg-[#d9d9dc] p-0 sm:p-8">
      <section className="w-full max-w-[680px] bg-[#dedee2] border-4 border-[#77777c] rounded-md overflow-hidden shadow-2xl">
        <header className="h-[86px] bg-[#c5c5c9] flex items-center px-5 border-b border-[#b6b6bb]">
          <h1 className="text-[50px] leading-none font-normal text-black flex-1">${title}</h1>
          <button onClick={() => setMinimized(v => !v)} className="w-16 h-16 mr-3 rounded-md border-2 border-[#808086] bg-[#f3f3f5] text-black text-6xl leading-none flex items-center justify-center shadow-inner">−</button>
          <button onClick={clearAll} className="w-16 h-16 rounded-md border-2 border-[#808086] bg-[#f3f3f5] text-black text-6xl leading-none flex items-center justify-center shadow-inner">×</button>
        </header>

        {!minimized && (
          <div className="p-5 sm:p-6 space-y-10">
            <div className="h-[226px] bg-[#f7f7f8] border-4 border-[#77777c] rounded-md flex items-center justify-end px-6">
              <output className="text-[150px] leading-none font-normal text-black tabular-nums truncate">{display}</output>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {buttons.flat().map((key, index) => (
                <button
                  key={key + index}
                  onClick={() => press(key)}
                  className="h-[102px] rounded-md border-4 border-[#85858b] bg-[#c9c9cd] hover:bg-[#d5d5d9] active:bg-[#b9b9be] text-black text-[74px] leading-none font-normal shadow-sm transition-colors flex items-center justify-center"
                  aria-label={key === 'sqrt' ? 'square root' : key}
                >
                  {key === 'sqrt' ? '√' : key}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}`;
}

function buildCalculatorFiles(project, snapshot = {}) {
  const appName = snapshot.project?.name || project.name || 'Calculator';
  const design = snapshot.design || {};
  return [
    { path: 'package.json', content: JSON.stringify({ name: slugify(appName), version: '1.0.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0' }, devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.0.0', tailwindcss: '^3.4.0', autoprefixer: '^10.4.17', postcss: '^8.4.35' } }, null, 2) },
    { path: 'vite.config.js', content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })` },
    { path: 'tailwind.config.js', content: buildTailwindConfig() },
    { path: 'postcss.config.js', content: `export default {\n  plugins: { tailwindcss: {}, autoprefixer: {} },\n}` },
    { path: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${escapeText(appName)}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>` },
    { path: 'src/main.jsx', content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)` },
    { path: 'src/index.css', content: buildGlobalCss(design) },
    { path: 'src/App.jsx', content: buildCalculatorPage(appName) },
    { path: 'README.md', content: `# ${escapeText(appName)}\n\nA generated working calculator app with a classic desktop calculator design.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` },
  ];
}

function buildEntityPage(entity) {
  const name = componentName(entity.name);
  const fieldNames = (entity.fields || []).slice(0, 5).map(f => (f.name || '').replace(/['"`\\]/g, '').trim()).filter(Boolean);
  const fields = fieldNames.length > 0 ? fieldNames : ['name'];
  const emptyForm = '{' + fields.map(f => `'${f}': ''`).join(', ') + '}';
  const headers = fields.map(f => `              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${f}</th>`).join('\n');
  const cells = fields.map(f => `                  <td className="px-4 py-3 text-sm text-gray-700">{String(item['${f}'] ?? '')}</td>`).join('\n');
  const formInputs = fields.map(f => `            <div>\n              <label className="block text-sm font-medium text-gray-700 mb-1">${f}</label>\n              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form['${f}'] || ''} onChange={e => setForm(p => ({...p, '${f}': e.target.value}))} />\n            </div>`).join('\n');

  return `import { useState, useEffect } from 'react'

const KEY = '${slugify(entity.name)}-records'

export default function ${name}Page() {
  const [items, setItems] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(${emptyForm})
  const [editing, setEditing] = useState(null)

  useEffect(() => {
    setItems(JSON.parse(localStorage.getItem(KEY) || '[]'))
  }, [])

  function persist(next) {
    setItems(next)
    localStorage.setItem(KEY, JSON.stringify(next))
  }

  function save() {
    if (editing) persist(items.map(i => i.id === editing ? { ...form, id: editing } : i))
    else persist([...items, { ...form, id: Date.now().toString(36) }])
    setShowForm(false); setEditing(null); setForm(${emptyForm})
  }

  function remove(id) {
    if (!confirm('Delete this record?')) return
    persist(items.filter(i => i.id !== id))
  }

  function edit(item) {
    setForm({ ...item }); setEditing(item.id); setShowForm(true)
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">${entity.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage ${entity.name} records</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditing(null); setForm(${emptyForm}) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">+ Add ${entity.name}</button>
      </div>
      {showForm && <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"><div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"><h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Edit' : 'New'} ${entity.name}</h2><div className="space-y-4">\n${formInputs}\n</div><div className="flex gap-3 mt-6"><button onClick={save} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save</button><button onClick={() => { setShowForm(false); setEditing(null) }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button></div></div></div>}
      {items.length === 0 ? <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl"><p className="text-gray-400 text-sm">No ${entity.name} records yet.</p><button onClick={() => setShowForm(true)} className="mt-3 text-blue-600 text-sm font-medium hover:underline">Add the first one</button></div> : <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto"><table className="w-full min-w-[480px]"><thead className="bg-gray-50 border-b border-gray-200"><tr>\n${headers}\n<th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map(item => <tr key={item.id} className="hover:bg-gray-50 transition-colors">\n${cells}\n<td className="px-4 py-3 text-right whitespace-nowrap"><button onClick={() => edit(item)} className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3">Edit</button><button onClick={() => remove(item.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button></td></tr>)}</tbody></table></div>}
    </div>
  )
}`;
}

export function generateCodeFiles(project, snapshot = {}) {
  if (isCalculatorApp(project, snapshot)) return buildCalculatorFiles(project, snapshot);

  const entities = (snapshot.entities || []).slice(0, 8);
  const appName = snapshot.project?.name || project.name;
  const pageFiles = [{ compName: 'Dashboard', route: '/', label: 'Dashboard', icon: '📊' }];
  entities.forEach((e, i) => {
    const compName = componentName(e.name);
    if (!compName || pageFiles.some(p => p.compName === compName)) return;
    pageFiles.push({ compName, route: `/${compName.toLowerCase()}`, label: e.name, icon: ICONS[(i + 1) % ICONS.length], entity: e });
  });

  const layout = `import { useState } from 'react'\nimport { Link, useLocation, Outlet } from 'react-router-dom'\n\nconst NAV = [\n${pageFiles.map(p => `  { path: '${p.route}', label: '${p.label}', icon: '${p.icon}' },`).join('\n')}\n]\n\nexport default function Layout() {\n  const { pathname } = useLocation()\n  const [open, setOpen] = useState(false)\n  return (\n    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">\n      <div className="md:hidden flex items-center justify-between bg-gray-900 px-4 py-3"><span className="text-white font-bold text-sm">${escapeText(appName)}</span><button onClick={() => setOpen(!open)} className="text-gray-300 text-xl">☰</button></div>\n      <aside className={open ? 'block md:flex md:w-60 bg-gray-900 md:flex-col flex-shrink-0' : 'hidden md:flex md:w-60 bg-gray-900 md:flex-col flex-shrink-0'}>\n        <div className="hidden md:block px-5 py-5 border-b border-gray-700/50"><h1 className="text-white font-bold text-base truncate">${escapeText(appName)}</h1></div>\n        <nav className="px-3 py-4 space-y-1">{NAV.map(item => <Link key={item.path} to={item.path} onClick={() => setOpen(false)} className={pathname === item.path ? 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium bg-blue-600 text-white' : 'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:bg-gray-800 hover:text-white'}><span>{item.icon}</span><span>{item.label}</span></Link>)}</nav>\n      </aside>\n      <main className="flex-1 overflow-auto"><Outlet /></main>\n    </div>\n  )\n}`;

  const appJsx = `import { BrowserRouter, Routes, Route } from 'react-router-dom'\nimport Layout from './components/Layout.jsx'\n${pageFiles.map(p => `import ${p.compName}Page from './pages/${p.compName}.jsx'`).join('\n')}\n\nexport default function App() {\n  return <BrowserRouter><Routes><Route element={<Layout />}>\n${pageFiles.map(p => `    <Route path="${p.route}" element={<${p.compName}Page />} />`).join('\n')}\n  </Route></Routes></BrowserRouter>\n}`;

  const dashboard = `import { Link } from 'react-router-dom'\n\nconst LINKS = [\n${pageFiles.slice(1).map(p => `  { path: '${p.route}', label: '${p.label}', icon: '${p.icon}' },`).join('\n')}\n]\n\nexport default function DashboardPage() {\n  return <div className="p-4 sm:p-6 max-w-5xl"><h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Dashboard</h1><p className="text-gray-500 text-sm mb-6">Welcome to ${escapeText(appName)}</p><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{LINKS.map(l => <Link to={l.path} key={l.path} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700"><span className="text-2xl">{l.icon}</span><span className="flex-1">{l.label}</span><span className="text-gray-400">→</span></Link>)}</div></div>\n}`;

  const files = [
    { path: 'package.json', content: JSON.stringify({ name: slugify(appName), version: '1.0.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', 'react-router-dom': '^6.26.0' }, devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.0.0', tailwindcss: '^3.4.0', autoprefixer: '^10.4.17', postcss: '^8.4.35' } }, null, 2) },
    { path: 'vite.config.js', content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })` },
    { path: 'tailwind.config.js', content: buildTailwindConfig() },
    { path: 'postcss.config.js', content: `export default {\n  plugins: { tailwindcss: {}, autoprefixer: {} },\n}` },
    { path: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeText(appName)}</title></head>\n  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>\n</html>` },
    { path: 'src/main.jsx', content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)` },
    { path: 'src/index.css', content: buildGlobalCss(snapshot.design || {}) },
    { path: 'src/App.jsx', content: appJsx },
    { path: 'src/components/Layout.jsx', content: layout },
    { path: 'src/pages/Dashboard.jsx', content: dashboard },
    { path: 'README.md', content: `# ${escapeText(appName)}\n\nGenerated by ArchitectAI.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` },
  ];

  pageFiles.filter(p => p.entity).forEach(p => files.push({ path: `src/pages/${p.compName}.jsx`, content: buildEntityPage(p.entity) }));
  return files;
}