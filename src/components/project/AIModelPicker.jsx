import React from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Cpu, Loader2 } from 'lucide-react';
import { AI_CONNECTION_QUERY, getAIConnections, manageAIConnection } from '@/lib/codeAI';

export default function AIModelPicker() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: AI_CONNECTION_QUERY, queryFn: () => getAIConnections(true), staleTime: 15000, retry: 1 });
  const mutation = useMutation({
    mutationFn: id => manageAIConnection('default', { id }),
    onSuccess: () => client.invalidateQueries({ queryKey: AI_CONNECTION_QUERY }),
  });
  const error = mutation.error || query.error;
  return <div className="flex items-center gap-2 min-w-0">
    {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <Cpu className="w-4 h-4 text-primary shrink-0" />}
    <select aria-label="AI model for builder" disabled={query.isLoading || mutation.isPending || !!query.error}
      value={query.data?.default_id || ''} onChange={event => mutation.mutate(event.target.value)}
      className="bg-background border border-border rounded-lg text-xs px-2 py-2 max-w-[180px] sm:max-w-[240px] min-w-0">
      <option value="">Built-in AI</option>
      {(query.data?.connections || []).map(item => <option key={item.id} value={item.id}>{item.name} · {item.model}</option>)}
    </select>
    <Link to="/settings" className="text-xs text-primary hover:underline whitespace-nowrap" title={error?.message}>AI Settings{error ? ' · retry connection' : ''}</Link>
    {error && <span role="alert" className="sr-only">{error.message}</span>}
  </div>;
}
