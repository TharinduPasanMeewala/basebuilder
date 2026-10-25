import { useEffect, useReducer } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { initialHistory, visualHistory } from '@/lib/visualHistory';
import useUnsavedChanges from '@/hooks/useUnsavedChanges';

export default function useVisualDesign(projectId) {
  const client = useQueryClient();
  const key = ['visualLayout', projectId];
  const query = useQuery({ queryKey: key, queryFn: async () => (await base44.entities.ProjectVersion.filter({ project_id: projectId, label: 'visual_layout' }, '-updated_date', 1))[0] || null, enabled: !!projectId });
  const [state, dispatch] = useReducer(visualHistory, initialHistory);
  useEffect(() => { if (query.isSuccess) dispatch({ type: 'load', elements: query.data?.snapshot?.elements || {} }); }, [query.isSuccess, query.data]);
  const dirty = JSON.stringify(state.present) !== state.saved;
  useUnsavedChanges(dirty);
  const save = useMutation({
    mutationFn: async elements => {
      const current = (await base44.entities.ProjectVersion.filter({ project_id: projectId, label: 'visual_layout' }, '-updated_date', 1))[0];
      if ((current?.updated_date || '') !== (query.data?.updated_date || '')) throw new Error('This design changed in another session. Keep your edits here and reload the saved version before continuing.');
      const snapshot = { elements };
      return current?.id ? base44.entities.ProjectVersion.update(current.id, { snapshot })
        : base44.entities.ProjectVersion.create({ project_id: projectId, label: 'visual_layout', version_number: 1, notes: 'Preview styles and screen data bindings', snapshot });
    },
    onSuccess: (record, elements) => { client.setQueryData(key, record); dispatch({ type: 'saved', elements }); },
  });
  return { settings: state.present, change: (id, value) => dispatch({ type: 'change', id, value }),
    undo: () => dispatch({ type: 'undo' }), redo: () => dispatch({ type: 'redo' }),
    reset: () => dispatch({ type: 'reset' }), canUndo: !!state.past.length, canRedo: !!state.future.length,
    dirty, save: { ...save, mutate: () => save.mutate(structuredClone(state.present)) },
    loading: query.isLoading || (!state.hydrated && !query.error), error: query.error };
}
