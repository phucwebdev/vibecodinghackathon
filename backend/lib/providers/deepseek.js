import { env } from '../env.js';
import { postJSON, ProviderError, normalizeMessages } from './common.js';

export const deepseek = {
  name: 'deepseek',
  get model() { return env('DEEPSEEK_MODEL', 'deepseek-chat'); },
  isConfigured: () => Boolean(env('DEEPSEEK_API_KEY')),

  async generate({ system, messages, maxTokens, temperature, json, timeoutMs }) {
    const msgs = normalizeMessages(messages);
    // DeepSeek JSON mode yêu cầu prompt có chữ "json"
    const sys = [system, json ? 'Chỉ trả về một đối tượng JSON hợp lệ (json).' : ''].filter(Boolean).join('\n\n');
    const body = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: sys ? [{ role: 'system', content: sys }, ...msgs] : msgs,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    };
    const data = await postJSON(
      `${env('DEEPSEEK_BASE_URL', 'https://api.deepseek.com')}/chat/completions`,
      { Authorization: `Bearer ${env('DEEPSEEK_API_KEY')}` },
      body,
      timeoutMs,
    );
    const text = data?.choices?.[0]?.message?.content || '';
    if (!text.trim()) throw new ProviderError('DeepSeek trả về rỗng', { kind: 'empty' });
    return {
      text,
      model: data.model || this.model,
      usage: { input: data.usage?.prompt_tokens, output: data.usage?.completion_tokens },
    };
  },
};
