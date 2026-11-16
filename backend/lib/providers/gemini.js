import { env } from '../env.js';
import { postJSON, ProviderError, normalizeMessages } from './common.js';

export const gemini = {
  name: 'gemini',
  get model() { return env('GEMINI_MODEL', 'gemini-flash-latest'); },
  isConfigured: () => Boolean(env('GEMINI_API_KEY')),

  async generate({ system, messages, maxTokens, temperature, json, timeoutMs }) {
    const contents = normalizeMessages(messages).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));
    const body = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        ...(json ? { responseMimeType: 'application/json' } : {}),
      },
      ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    };
    const data = await postJSON(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      { 'x-goog-api-key': env('GEMINI_API_KEY') },
      body,
      timeoutMs,
    );
    const cand = data?.candidates?.[0];
    const text = (cand?.content?.parts || []).map((p) => p.text || '').join('');
    if (!text.trim()) {
      const reason = cand?.finishReason || data?.promptFeedback?.blockReason || 'không rõ';
      throw new ProviderError(`Gemini trả về rỗng (${reason})`, { kind: 'empty' });
    }
    return {
      text,
      model: data.modelVersion || this.model,
      usage: { input: data.usageMetadata?.promptTokenCount, output: data.usageMetadata?.candidatesTokenCount },
    };
  },
};
