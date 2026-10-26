import { base44 } from '@/api/base44Client';

let preferenceCache;
let preferenceAt = 0;
export const AI_CONNECTION_QUERY = ['aiConnections'];
export function resetAIPreference() { preferenceCache = undefined; preferenceAt = 0; }
export function aiError(error) { return error?.response?.data?.error || error?.message || 'The AI request failed.'; }
export async function manageAIConnection(action, data = {}) {
  try {
    const response = await base44.functions.invoke('ai-gateway', { action, ...data });
    if (response.data?.error) throw Object.assign(new Error(response.data.error), { code: response.data.code, help_url: response.data.help_url, provider_status: response.data.provider_status });
    if (['save', 'connect_gemini', 'delete', 'default'].includes(action)) resetAIPreference();
    return response.data;
  } catch (error) {
    const detail = error?.response?.data || error;
    throw Object.assign(new Error(aiError(error)), { code: detail.code, help_url: detail.help_url, provider_status: detail.provider_status });
  }
}
export async function getAIConnections(fresh = false) {
  if (!fresh && preferenceCache && Date.now() - preferenceAt < 15000) return preferenceCache;
  const data = await manageAIConnection('list');
  preferenceCache = data; preferenceAt = Date.now();
  return data;
}
export async function invokeCodeAI({ prompt, response_json_schema, file_urls, useCustom, connection_id, ...options }) {
  if (useCustom === false || connection_id === 'builtin') {
    return base44.integrations.Core.InvokeLLM({ prompt, response_json_schema, file_urls, ...options });
  }
  const preference = await getAIConnections();
  if (connection_id || preference.default_id || preference.legacy_openai) {
    const data = await manageAIConnection('generate', { prompt, response_json_schema, file_urls, connection_id: connection_id || preference.default_id || undefined });
    return response_json_schema ? data : data?.content ?? '';
  }
  if (useCustom === true) throw new Error('Select an AI connection in Settings first.');
  return base44.integrations.Core.InvokeLLM({ prompt, response_json_schema, file_urls, ...options });
}
export async function getUserAIPreference() {
  const data = await getAIConnections();
  const connection = data.connections?.find(item => item.id === data.default_id);
  return { useCustomOpenAI: !!data.default_id || data.legacy_openai, hasOpenAIKey: !!connection || data.legacy_openai,
    connection, connections: data.connections || [], defaultId: data.default_id };
}
