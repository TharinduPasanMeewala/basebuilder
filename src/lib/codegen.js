import { withHostingFiles } from '@/lib/hosting';
import {normalizeDesign,DESIGN_CSS} from './designSystem.js';
import {buildLayoutExport,buildDashboardExport} from './designCodegen.js';
import productSurfaceSource from '@/components/live-preview/ProductSurface.jsx?raw';

// Deterministic code generator: builds a deployable Vite + React + Tailwind app
// from a project snapshot. It prefers working product-specific screens over stubs.

function slugify(name) {
  return (name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
}

function componentName(name) {
  const value = (name || 'Page').replace(/[^a-zA-Z0-9]/g, '') || 'Page';
  return /^[A-Za-z]/.test(value) ? value : 'Page' + value;
}

function escapeText(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

function escapeHtml(value) { return String(value || '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }

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
  const d=normalizeDesign(design);
  return {primary:d.primary_color,accent:d.accent_color,background:d.background_color,surface:d.surface_color,text:d.text_color,font:d.font_family,radius:d.radius};
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
body { margin: 0; font-family: var(--brand-font); background: var(--brand-bg); color: var(--brand-text); }
${DESIGN_CSS}`;
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
  const title = JSON.stringify(String(appName || 'Calculator'));
  return `import { useState } from 'react'

const TITLE = ${title}
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
          <h1 className="text-[50px] leading-none font-normal text-black flex-1">{TITLE}</h1>
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
    { path: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${escapeHtml(appName)}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>` },
    { path: 'src/main.jsx', content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)` },
    { path: 'src/index.css', content: buildGlobalCss(design) },
    { path: 'src/App.jsx', content: buildCalculatorPage(appName) },
    { path: 'README.md', content: `# ${escapeText(appName)}\n\nA generated working calculator app with a classic desktop calculator design.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` },
  ];
}

function buildEntityPage(entity, projectName = 'app') {
  const fields = (entity.fields || []).filter(field => field.name && !['__proto__', 'prototype', 'constructor', 'id'].includes(field.name)).slice(0, 30);
  if (!fields.length) fields.push({ name: 'name', type: 'string', required: true });
  return `import { useEffect, useState } from 'react'
const TITLE = ${JSON.stringify(entity.name || 'Records')}
const FIELDS = ${JSON.stringify(fields)}
const KEY = ${JSON.stringify(slugify(projectName) + '-' + slugify(entity.name) + '-records')}
const emptyForm = () => Object.fromEntries(FIELDS.map(field => [field.name, field.type === 'boolean' ? false : '']))
export default function EntityPage() {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem(KEY) || '[]'); if (!Array.isArray(saved)) throw new Error(); setItems(saved); }
    catch { setError('Saved data could not be read. Check your browser storage before adding records.'); }
  }, [])
  function persist(next) {
    try { localStorage.setItem(KEY, JSON.stringify(next)); setItems(next); setError(''); return true; }
    catch { setError('Could not save data in this browser. Check available storage.'); return false; }
  }
  function save(event) {
    event.preventDefault()
    const data = Object.fromEntries(FIELDS.map(field => [field.name, ['number','integer'].includes(field.type) && form[field.name] !== '' ? Number(form[field.name]) : form[field.name]]))
    const next = editing ? items.map(item => item.id === editing ? { ...data, id: editing } : item) : [...items, { ...data, id: crypto.randomUUID() }]
    if (persist(next)) { setShowForm(false); setEditing(null); setForm(emptyForm()); }
  }
  function exportData() {
    const url = URL.createObjectURL(new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = KEY + '.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const visible = items.filter(item => FIELDS.some(field => String(item[field.name] ?? '').toLowerCase().includes(search.toLowerCase())))
  return <section className="p-4 sm:p-6 space-y-5">
    <header className="flex flex-wrap gap-3 items-center justify-between"><div><h1 className="text-2xl font-bold">{TITLE}</h1><p className="text-sm opacity-60 mt-1">{items.length} records stored in this browser</p></div><div className="flex gap-2"><button onClick={exportData} className="border rounded-brand px-3 py-2 text-sm">Export data</button><button onClick={() => { setEditing(null); setForm(emptyForm()); setShowForm(true); }} className="bg-brand-primary text-white rounded-brand px-4 py-2 text-sm">+ Add record</button></div></header>
    {error && <p role="alert" className="text-red-700 bg-red-50 border border-red-200 p-3 rounded-brand text-sm">{error}</p>}
    <input aria-label={'Search ' + TITLE} placeholder="Search records…" value={search} onChange={event => setSearch(event.target.value)} className="border rounded-brand px-3 py-2 text-sm w-full sm:max-w-sm bg-brand-surface" />
    {visible.length === 0 ? <div className="border border-dashed rounded-brand p-12 text-center text-sm opacity-60">{items.length ? 'No matching records.' : 'No records yet. Add your first record to get started.'}</div>
    : <div className="bg-brand-surface border rounded-brand overflow-x-auto"><table className="w-full min-w-[480px] text-sm"><thead className="border-b"><tr>{FIELDS.map(field => <th key={field.name} className="text-left px-4 py-3 font-medium opacity-60">{field.name}</th>)}<th className="text-right px-4 py-3">Actions</th></tr></thead><tbody>{visible.map(item => <tr key={item.id} className="border-b last:border-0">{FIELDS.map(field => <td key={field.name} className="px-4 py-3">{field.type === 'boolean' ? (item[field.name] ? 'Yes' : 'No') : String(item[field.name] ?? '')}</td>)}<td className="text-right px-4 py-3 whitespace-nowrap"><button onClick={() => { setEditing(item.id); setForm({ ...emptyForm(), ...item }); setShowForm(true); }} className="text-brand-primary mr-3">Edit</button><button onClick={() => window.confirm('Delete this record?') && persist(items.filter(row => row.id !== item.id))} className="text-red-600">Delete</button></td></tr>)}</tbody></table></div>}
    {showForm && <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"><form role="dialog" aria-modal="true" aria-label={editing ? 'Edit record' : 'New record'} onSubmit={save} className="bg-brand-surface rounded-brand shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-auto space-y-4"><h2 className="font-bold text-lg">{editing ? 'Edit record' : 'New record'}</h2>{FIELDS.map(field => {
      const values = field.enum_values || field.enum || []
      return <label key={field.name} className="block text-sm space-y-1"><span>{field.name}{field.required ? ' *' : ''}</span>{field.type === 'boolean' ? <input className="ml-3" type="checkbox" checked={!!form[field.name]} onChange={event => setForm(previous => ({ ...previous, [field.name]: event.target.checked }))} />
      : values.length ? <select className="w-full bg-brand-bg border rounded-brand p-2" required={!!field.required} value={form[field.name] ?? ''} onChange={event => setForm(previous => ({ ...previous, [field.name]: event.target.value }))}><option value="">Select…</option>{values.map(value => <option key={value} value={value}>{value}</option>)}</select>
      : <input className="w-full bg-brand-bg border rounded-brand p-2" required={!!field.required} type={['number','integer'].includes(field.type) ? 'number' : field.type === 'date' ? 'date' : field.type === 'email' ? 'email' : 'text'} step={field.type === 'integer' ? 1 : 'any'} value={form[field.name] ?? ''} onChange={event => setForm(previous => ({ ...previous, [field.name]: event.target.value }))} />}</label>
    })}<div className="flex gap-2 pt-2"><button type="submit" className="bg-brand-primary text-white px-4 py-2 rounded-brand">Save record</button><button type="button" onClick={() => setShowForm(false)} className="border px-4 py-2 rounded-brand">Cancel</button></div></form></div>}
  </section>
}
`;
}

function generateRawCodeFiles(project, snapshot = {}) {
  if (isCalculatorApp(project, snapshot)) return buildCalculatorFiles(project, snapshot);

  const entities = (snapshot.entities || []).slice(0, 8);
  const appName = snapshot.project?.name || project.name;
  const pageFiles = [{ compName: 'Dashboard', route: '/', label: 'Dashboard', icon: '📊' }];
  entities.forEach((e, i) => {
    const compName = componentName(e.name);
    if (!compName || pageFiles.some(p => p.compName === compName)) return;
    pageFiles.push({ compName, route: `/${compName.toLowerCase()}`, label: e.name, icon: ICONS[(i + 1) % ICONS.length], entity: e });
  });

  const layout = buildLayoutExport(appName,pageFiles,snapshot.design||{});

  const appJsx = `import { BrowserRouter, Routes, Route } from 'react-router-dom'\nimport Layout from './components/Layout.jsx'\n${pageFiles.map(p => `import ${p.compName}Page from './pages/${p.compName}.jsx'`).join('\n')}\n\nexport default function App() {\n  return <BrowserRouter><Routes><Route element={<Layout />}>\n${pageFiles.map(p => `    <Route path="${p.route}" element={<${p.compName}Page />} />`).join('\n')}\n  </Route></Routes></BrowserRouter>\n}`;

  const dashboard = buildDashboardExport(project,pageFiles,snapshot.design||{},(projectName,entityName)=>slugify(projectName)+'-'+slugify(entityName)+'-records',(snapshot.pages||[])[0]?.type==='landing');

  const files = [
    { path: 'package.json', content: JSON.stringify({ name: slugify(appName), version: '1.0.0', type: 'module', scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' }, dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', 'react-router-dom': '^6.26.0' }, devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.0.0', tailwindcss: '^3.4.0', autoprefixer: '^10.4.17', postcss: '^8.4.35' } }, null, 2) },
    { path: 'vite.config.js', content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })` },
    { path: 'tailwind.config.js', content: buildTailwindConfig() },
    { path: 'postcss.config.js', content: `export default {\n  plugins: { tailwindcss: {}, autoprefixer: {} },\n}` },
    { path: 'index.html', content: `<!DOCTYPE html>\n<html lang="en">\n  <head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${escapeHtml(appName)}</title></head>\n  <body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body>\n</html>` },
    { path: 'src/main.jsx', content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>)` },
    { path: 'src/index.css', content: buildGlobalCss(snapshot.design || {}) },
    { path: 'src/App.jsx', content: appJsx },
    { path: 'src/components/Layout.jsx', content: layout },
    { path: 'src/components/ProductSurface.jsx', content: productSurfaceSource },
    { path: 'src/pages/Dashboard.jsx', content: dashboard },
    { path: 'README.md', content: `# ${escapeText(appName)}\n\nGenerated by ArchitectAI.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n` },
  ];

  pageFiles.filter(p => p.entity).forEach(p => files.push({ path: `src/pages/${p.compName}.jsx`, content: buildEntityPage(p.entity, appName) }));
  return files;
}

export function generateCodeFiles(project, snapshot = {}) {
  return withHostingFiles(generateRawCodeFiles(project, snapshot), project);
}
