import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export default function useVisualDesign(projectId) {
  const client = useQueryClient();
  const key = ['visualLayout', projectId];
  const query = useQuery({ queryKey: key, queryFn: async () => (await base44.entities.ProjectVersion.filter({ project_id: projectId, label: 'visual_layout' }, '-updated_date', 1))[0] || null, enabled: !!projectId });
  const [settings, setSettings] = useState({});
  const [history, setHistory] = useState([]);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setSettings(query.data?.snapshot?.elements || {}); }, [query.data, dirty]);
  const change = (id, value) => {
    setHistory(previous => [...previous.slice(-29), settings]);
    setSettings(previous => { const next = { ...previous }; if (value === null) delete next[id]; else next[id] = value; return next; });
    setDirty(true);
  };
  const undo = () => { if (!history.length) return; setSettings(history[history.length - 1]); setHistory(previous => previous.slice(0, -1)); setDirty(true); };
  const save = useMutation({
    mutationFn: async () => {
      const snapshot = { elements: settings };
      return query.data?.id
        ? base44.entities.ProjectVersion.update(query.data.id, { snapshot })
        : base44.entities.ProjectVersion.create({ project_id: projectId, label: 'visual_layout', version_number: 1, notes: 'Preview element styles and screen data bindings', snapshot });
    },
    onSuccess: record => { client.setQueryData(key, record); setDirty(false); setHistory([]); },
  });
  useEffect(() => {
    const warn = event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  return { settings, change, undo, canUndo: history.length > 0, dirty, save, loading: query.isLoading, error: query.error };
}