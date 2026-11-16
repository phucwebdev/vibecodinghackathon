import { env } from '../env.js';
import { postJSON, ProviderError, normalizeMessages } from './common.js';

export const claude = {
  name: 'claude',
  get model() { return env('CLAUDE_MODEL', 'claude-sonnet-5-5'); },
  isConfigured: () => Boolean(env('CLAUDE_API_KEY')),

  async generate({ system, messages, maxTokens, temperature, json, timeoutMs }) {
    const sys = [system, json ? 'Chỉ trả về JSON hợp lệ, không kèm giải thích hay ```.' : '']
      .filter(Boolean).join('\n\n');
    const body = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: normalizeMessages(messages),
      ...(sys ? { system: sys } : {}),
    };
    const data = await postJSON(
      'https://api.anthropic.com/v1/messages',
      {
        'x-api-key': env('CLAUDE_API_KEY'),
        'anthropic-version': '2023-06-01',
        // Key dạng sk-ant-usr-... (không gắn workspace) bắt buộc kèm workspace ID
        ...(env('CLAUDE_WORKSPACE_ID') ? { 'anthropic-workspace-id': env('CLAUDE_WORKSPACE_ID') } : {}),
      },
      body,
      timeoutMs,
    );
    const text = (data?.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    if (!text.trim()) throw new ProviderError('Claude trả về rỗng', { kind: 'empty' });
    return {
      text,
      model: data.model || this.model,
      usage: { input: data.usage?.input_tokens, output: data.usage?.output_tokens },
    };
  },
};
