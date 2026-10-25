export const initialHistory = { present: {}, past: [], future: [], saved: '{}', hydrated: false };
export function visualHistory(state, action) {
  if (action.type === 'load') return state.hydrated ? state : { ...initialHistory, present: action.elements || {}, saved: JSON.stringify(action.elements || {}), hydrated: true };
  if (action.type === 'saved') return { ...state, saved: JSON.stringify(action.elements) };
  if (action.type === 'reset') return { ...state, present: JSON.parse(state.saved), past: [], future: [] };
  if (action.type === 'undo') {
    if (!state.past.length) return state;
    return { ...state, present: state.past.at(-1), past: state.past.slice(0, -1), future: [state.present, ...state.future].slice(0, 50) };
  }
  if (action.type === 'redo') {
    if (!state.future.length) return state;
    return { ...state, present: state.future[0], past: [...state.past, state.present].slice(-50), future: state.future.slice(1) };
  }
  if (action.type === 'change') {
    const next = { ...state.present };
    if (action.value === null) delete next[action.id]; else next[action.id] = action.value;
    if (JSON.stringify(next) === JSON.stringify(state.present)) return state;
    return { ...state, present: next, past: [...state.past, state.present].slice(-50), future: [] };
  }
  return state;
}
