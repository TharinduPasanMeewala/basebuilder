import { base44 } from '@/api/base44Client';

/**
 * Unified AI invocation for code generation / design refinement.
 * When `useCustom` is true, routes through the user's own OpenAI key (openaiCoding backend function);
 * otherwise uses the built-in Base44 InvokeLLM integration.
 */
export async function invokeCodeAI({ prompt, response_json_schema, file_urls, useCustom }) {
  if (useCustom) {
    const res = await base44.functions.invoke('openaiCoding', { prompt, response_json_schema, file_urls });
    if (response_json_schema) return res.data;
    return res.data?.content ?? '';
  }
  return base44.integrations.Core.InvokeLLM({ prompt, response_json_schema, file_urls });
}

export async function getUserAIPreference() {
  try {
    const user = await base44.auth.me();
    return { useCustomOpenAI: !!user.use_custom_openai, hasOpenAIKey: !!user.openai_api_key };
  } catch {
    return { useCustomOpenAI: false, hasOpenAIKey: false };
  }
}