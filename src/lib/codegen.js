// Deterministic code generator: builds a deployable Vite + React + Tailwind app
// from a project version snapshot. Entity pages use localStorage so the deployed
// demo is fully interactive (CRUD works without a backend).

function slugify(name) {
  return (name || 'app').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28);
}

const ICONS = ['📊', '📦', '🛒', '👥', '⚙️', '📋', '🔧', '📈', '🏷️', '📁'];

function buildEntityPage(entity) {
  const name = entity.name.replace(/[^a-zA-Z0-9]/g, '');
  const fieldNames = (entity.fields || []).slice(0, 5).map(f => f.name).filter(Boolean);
  const fields = fieldNames.length > 0 ? fieldNames : ['name'];
  const emptyForm = '{' + fields.map(f => `${f}: ''`).join(', ') + '}';
  const headers = fields.map(f => `              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">${f}</th>`).join('\n');
  const cells = fields.map(f => `                  <td className="px-4 py-3 text-sm text-gray-700">{String(item.${f} ?? '')}</td>`).join('\n');
  const formInputs = fields.map(f => `            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">${f}</label>
              <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.${f} || ''} onChange={e => setForm(p => ({...p, ${f}: e.target.value}))} />
            </div>`).join('\n');

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
    if (editing) {
      persist(items.map(i => i.id === editing ? { ...form, id: editing } : i))
    } else {
      persist([...items, { ...form, id: Date.now().toString(36) }])
    }
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
        <button onClick={() => { setShowForm(true); setEditing(null); setForm(${emptyForm}) }} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
          + Add ${entity.name}
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900 mb-4">{editing ? 'Edit' : 'New'} ${entity.name}</h2>
            <div className="space-y-4">
${formInputs}
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={save} className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700">Save</button>
              <button onClick={() => { setShowForm(false); setEditing(null) }} className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl">
          <p className="text-gray-400 text-sm">No ${entity.name} records yet.</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-blue-600 text-sm font-medium hover:underline">Add the first one</button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto">
          <table className="w-full min-w-[480px]">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
${headers}
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-gray-50 transition-colors">
${cells}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button onClick={() => edit(item)} className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-3">Edit</button>
                    <button onClick={() => remove(item.id)} className="text-red-500 hover:text-red-700 text-xs font-medium">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}`;
}

export function generateCodeFiles(project, snapshot = {}) {
  const entities = (snapshot.entities || []).slice(0, 8);
  const appName = snapshot.project?.name || project.name;

  const pageFiles = [{ compName: 'Dashboard', route: '/', label: 'Dashboard', icon: '📊' }];
  entities.forEach((e, i) => {
    const compName = e.name.replace(/[^a-zA-Z0-9]/g, '');
    if (!compName || pageFiles.some(p => p.compName === compName)) return;
    pageFiles.push({ compName, route: `/${compName.toLowerCase()}`, label: e.name, icon: ICONS[(i + 1) % ICONS.length], entity: e });
  });

  const layout = `import { useState } from 'react'
import { Link, useLocation, Outlet } from 'react-router-dom'

const NAV = [
${pageFiles.map(p => `  { path: '${p.route}', label: '${p.label}', icon: '${p.icon}' },`).join('\n')}
]

export default function Layout() {
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-50">
      <div className="md:hidden flex items-center justify-between bg-gray-900 px-4 py-3">
        <span className="text-white font-bold text-sm">${appName}</span>
        <button onClick={() => setOpen(!open)} className="text-gray-300 text-xl">☰</button>
      </div>
      <aside className={\`\${open ? 'block' : 'hidden'} md:flex md:w-60 bg-gray-900 md:flex-col flex-shrink-0\`}>
        <div className="hidden md:block px-5 py-5 border-b border-gray-700/50">
          <h1 className="text-white font-bold text-base truncate">${appName}</h1>
        </div>
        <nav className="px-3 py-4 space-y-1">
          {NAV.map(item => (
            <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
              className={\`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors \${pathname === item.path ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}\`}>
              <span>{item.icon}</span><span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>
      <main className="flex-1 overflow-auto"><Outlet /></main>
    </div>
  )
}`;

  const appJsx = `import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout.jsx'
${pageFiles.map(p => `import ${p.compName}Page from './pages/${p.compName}.jsx'`).join('\n')}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
${pageFiles.map(p => `          <Route path="${p.route}" element={<${p.compName}Page />} />`).join('\n')}
        </Route>
      </Routes>
    </BrowserRouter>
  )
}`;

  const dashboard = `import { Link } from 'react-router-dom'

const LINKS = [
${pageFiles.slice(1).map(p => `  { path: '${p.route}', label: '${p.label}', icon: '${p.icon}' },`).join('\n')}
]

export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-6 max-w-5xl">
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-gray-500 text-sm mb-6">Welcome to ${appName}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {LINKS.map(l => (
          <Link to={l.path} key={l.path} className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all text-sm font-medium text-gray-700">
            <span className="text-2xl">{l.icon}</span>
            <span className="flex-1">{l.label}</span>
            <span className="text-gray-400">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}`;

  const files = [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: slugify(appName),
        version: '1.0.0',
        type: 'module',
        scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
        dependencies: { react: '^18.2.0', 'react-dom': '^18.2.0', 'react-router-dom': '^6.26.0' },
        devDependencies: { '@vitejs/plugin-react': '^4.2.1', vite: '^5.0.0', tailwindcss: '^3.4.0', autoprefixer: '^10.4.17', postcss: '^8.4.35' },
      }, null, 2),
    },
    { path: 'vite.config.js', content: `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\n\nexport default defineConfig({ plugins: [react()] })` },
    { path: 'tailwind.config.js', content: `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{js,jsx}'],\n  theme: { extend: {} },\n  plugins: [],\n}` },
    { path: 'postcss.config.js', content: `export default {\n  plugins: { tailwindcss: {}, autoprefixer: {} },\n}` },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>\n<html lang="en">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>${appName}</title>\n  </head>\n  <body>\n    <div id="root"></div>\n    <script type="module" src="/src/main.jsx"></script>\n  </body>\n</html>`,
    },
    { path: 'vercel.json', content: JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2) },
    { path: 'src/main.jsx', content: `import React from 'react'\nimport ReactDOM from 'react-dom/client'\nimport App from './App.jsx'\nimport './index.css'\n\nReactDOM.createRoot(document.getElementById('root')).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>,\n)` },
    { path: 'src/index.css', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\nbody { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }` },
    { path: 'src/App.jsx', content: appJsx },
    { path: 'src/components/Layout.jsx', content: layout },
    { path: 'src/pages/Dashboard.jsx', content: dashboard },
    { path: 'README.md', content: `# ${appName}\n\nGenerated by ArchitectAI.\n\n## Run locally\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Deploy\n\nOne-click deploy to Vercel or Netlify.\n` },
  ];

  pageFiles.filter(p => p.entity).forEach(p => {
    files.push({ path: `src/pages/${p.compName}.jsx`, content: buildEntityPage(p.entity) });
  });

  return files;
}