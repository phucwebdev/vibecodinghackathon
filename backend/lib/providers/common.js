// Lỗi chuẩn hoá cho mọi provider để bộ fallback quyết định: thử tiếp / tạm khoá provider bao lâu.
export class ProviderError extends Error {
  constructor(message, { status = 0, kind = 'unknown', retryAfterMs = 0 } = {}) {
    super(message);
    this.status = status;
    // kind: auth | rate_limit | timeout | network | server | bad_request | empty | invalid_json | unknown
    this.kind = kind;
    this.retryAfterMs = retryAfterMs;
  }
}

export function kindFromStatus(status) {
  if (status === 401 || status === 403) return 'auth';
  if (status === 402) return 'auth'; // hết tiền / hết quota (DeepSeek trả 402)
  if (status === 429) return 'rate_limit';
  if (status === 408) return 'timeout';
  if (status >= 500) return 'server';
  if (status >= 400) return 'bad_request';
  return 'unknown';
}

// fetch JSON có timeout + chuẩn hoá lỗi
export async function postJSON(url, headers, body, timeoutMs) {
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw new ProviderError(`Hết thời gian chờ (${timeoutMs}ms)`, { kind: 'timeout' });
    }
    throw new ProviderError(`Lỗi mạng: ${err?.cause?.code || err?.message || err}`, { kind: 'network' });
  }

  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* body không phải JSON */ }

  if (!res.ok) {
    const msg = data?.error?.message || data?.message || text.slice(0, 300) || res.statusText;
    const ra = Number(res.headers.get('retry-after'));
    // Lỗi cấu hình key (VD thiếu workspace) → coi như lỗi auth để tạm khoá lâu
    const cfgErr = res.status === 400 && /api key|workspace/i.test(msg);
    throw new ProviderError(`HTTP ${res.status}: ${msg}`, {
      status: res.status,
      kind: cfgErr ? 'auth' : kindFromStatus(res.status),
      retryAfterMs: Number.isFinite(ra) && ra > 0 ? ra * 1000 : 0,
    });
  }
  return data;
}

// Chuẩn hoá messages đầu vào: [{role:'user'|'assistant', content:'...'}]
export function normalizeMessages(messages) {
  return messages
    .filter((m) => m && typeof m.content === 'string' && m.content.trim())
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content }));
}
