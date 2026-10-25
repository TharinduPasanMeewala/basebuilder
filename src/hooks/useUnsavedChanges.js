import { useEffect } from 'react';
export function confirmWorkspaceNavigation() {
  return window.dispatchEvent(new Event('architect:beforeNavigate', { cancelable: true }));
}
export default function useUnsavedChanges(dirty) {
  useEffect(() => {
    if (!dirty) return;
    const confirm = event => { if (!window.confirm('You have unsaved edits. Leave this editor and discard them?')) event.preventDefault(); };
    const unload = event => { event.preventDefault(); event.returnValue = ''; };
    const link = event => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || anchor.download || anchor.target === '_blank' || anchor.getAttribute('href')?.startsWith('#')) return;
      if (!window.confirm('You have unsaved edits. Leave this editor and discard them?')) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener('architect:beforeNavigate', confirm);
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', link, true);
    return () => { window.removeEventListener('architect:beforeNavigate', confirm); window.removeEventListener('beforeunload', unload); document.removeEventListener('click', link, true); };
  }, [dirty]);
}
