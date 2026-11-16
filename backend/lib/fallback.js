// BỘ FALLBACK AI
// Thử lần lượt từng provider theo AI_ORDER (mặc định claude → deepseek → gemini).
// - Provider chưa có key → bỏ qua.
// - Provider lỗi → tạm khoá (cooldown) để request sau không mất thời gian chờ nó nữa:
//     sai key / hết quota: 10 phút · rate limit: theo retry-after hoặc 30s · lỗi server/timeout/mạng: 20s
// - Yêu cầu JSON mà provider trả JSON hỏng → coi như lỗi, chuyển provider tiếp theo.
// - Có tổng ngân sách thời gian (AI_TOTAL_BUDGET_MS) để người dùng không phải chờ quá lâu.
import { env, envInt } from './env.js';
import { ProviderError } from './providers/common.js';
import { claude } from './providers/claude.js';
import { deepseek } from './providers/deepseek.js';
import { gemini } from './providers/gemini.js';

export const PROVIDERS = { claude, deepseek, gemini };

const cooldownUntil = new Map(); // tên provider → timestamp hết khoá
const lastError = new Map(); // tên provider → { kind, message, at }

const COOLDOWN_MS = {
  auth: 10 * 60_000,
  rate_limit: 30_000,
  timeout: 20_000,
  network: 20_000,
  server: 20_000,
  empty: 0,
  invalid_json: 0,
  bad_request: 0,
  unknown: 10_000,
};

export function providerOrder(override) {
  const raw = Array.isArray(override) && override.length ? override : env('AI_ORDER', 'claude,deepseek,gemini').split(',');
  const seen = new Set();
  return raw
    .map((s) => String(s).trim().toLowerCase())
    .filter((n) => PROVIDERS[n] && !seen.has(n) && seen.add(n));
}

// Bóc JSON từ text (chấp nhận cả ```json ... ``` hoặc có chữ thừa xung quanh)
export function extractJSON(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try { return JSON.parse(t); } catch { /* thử tiếp */ }
  const start = t.search(/[[{]/);
  const end = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'));
  if (start >= 0 && end > start) {
    try { return JSON.parse(t.slice(start, end + 1)); } catch { /* hỏng thật */ }
  }
  throw new ProviderError('Phản hồi không phải JSON hợp lệ', { kind: 'invalid_json' });
}

/**
 * Gọi AI với fallback.
 * @param {object} req
 *   messages: [{role:'user'|'assistant', content}]  (hoặc prompt: '...')
 *   system, maxTokens, temperature, json (bool), providers (mảng ưu tiên riêng)
 * @returns {ok, text, data?, provider, model, ms, attempts}
 */
export async function generate(req) {
  const started = Date.now();
  const budget = envInt('AI_TOTAL_BUDGET_MS', 45_000);
  const perProvider = envInt('AI_TIMEOUT_MS', 20_000);
  const messages = req.messages?.length ? req.messages : [{ role: 'user', content: String(req.prompt || '') }];
  const opts = {
    system: req.system || env('AI_SYSTEM_PROMPT', ''),
    messages,
    maxTokens: Math.min(Number(req.maxTokens) || envInt('AI_MAX_TOKENS', 1024), 8192),
    temperature: Number.isFinite(Number(req.temperature)) ? Number(req.temperature) : 0.7,
    json: Boolean(req.json),
  };

  const attempts = [];
  const order = providerOrder(req.providers);

  for (const name of order) {
    const p = PROVIDERS[name];
    if (!p.isConfigured()) { attempts.push({ provider: name, skipped: 'chưa có API key' }); continue; }

    const until = cooldownUntil.get(name) || 0;
    if (until > Date.now()) {
      attempts.push({ provider: name, skipped: `đang tạm khoá ${Math.ceil((until - Date.now()) / 1000)}s` });
      continue;
    }

    const remaining = budget - (Date.now() - started);
    if (remaining < 2_000) { attempts.push({ provider: name, skipped: 'hết ngân sách thời gian' }); break; }

    const t0 = Date.now();
    try {
      const out = await p.generate({ ...opts, timeoutMs: Math.min(perProvider, remaining) });
      const result = { ok: true, text: out.text, provider: name, model: out.model, usage: out.usage };
      if (opts.json) result.data = extractJSON(out.text);
      attempts.push({ provider: name, ok: true, ms: Date.now() - t0 });
      cooldownUntil.delete(name);
      lastError.delete(name);
      return { ...result, ms: Date.now() - started, attempts };
    } catch (err) {
      const kind = err instanceof ProviderError ? err.kind : 'unknown';
      const cd = Math.max(COOLDOWN_MS[kind] ?? 10_000, err.retryAfterMs || 0);
      if (cd > 0) cooldownUntil.set(name, Date.now() + cd);
      lastError.set(name, { kind, message: err.message, at: new Date().toISOString() });
      attempts.push({ provider: name, ok: false, kind, error: err.message, ms: Date.now() - t0 });
      console.warn(`[ai] ${name} lỗi (${kind}): ${err.message} → thử provider tiếp theo`);
    }
  }

  return {
    ok: false,
    error: 'Tất cả nhà cung cấp AI đều đang lỗi hoặc chưa cấu hình. Vui lòng thử lại sau ít phút.',
    ms: Date.now() - started,
    attempts,
  };
}

// Trạng thái để xem nhanh ở /api/health (không lộ key)
export function status() {
  const now = Date.now();
  return providerOrder().map((name) => {
    const p = PROVIDERS[name];
    const until = cooldownUntil.get(name) || 0;
    return {
      provider: name,
      model: p.model,
      configured: p.isConfigured(),
      coolingDownSec: until > now ? Math.ceil((until - now) / 1000) : 0,
      lastError: lastError.get(name) || null,
    };
  });
}

// Chỉ dùng cho test
export function _resetState() { cooldownUntil.clear(); lastError.clear(); }
