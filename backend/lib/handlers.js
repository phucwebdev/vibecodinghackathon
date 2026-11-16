// Handler dùng chung: server local và Vercel Functions đều gọi vào đây.
// Ngày thi: thêm route logic theo đề ở cuối file (hoặc tách lib/routes/*.js).
import { generate, status } from './fallback.js';
import { cors, sendJSON, readBody } from './http.js';

const MAX_INPUT_CHARS = 40_000;

export async function chatHandler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.end();
  if (req.method !== 'POST') return sendJSON(res, 405, { ok: false, error: 'Chỉ hỗ trợ POST' });

  try {
    const body = await readBody(req);
    const messages = Array.isArray(body.messages) ? body.messages : null;
    const prompt = typeof body.prompt === 'string' ? body.prompt : '';
    if (!messages?.length && !prompt.trim()) {
      return sendJSON(res, 400, { ok: false, error: 'Thiếu nội dung: gửi "prompt" hoặc "messages".' });
    }
    const totalChars = (body.system || '').length + prompt.length
      + (messages || []).reduce((n, m) => n + String(m?.content || '').length, 0);
    if (totalChars > MAX_INPUT_CHARS) {
      return sendJSON(res, 413, { ok: false, error: 'Nội dung quá dài, vui lòng rút gọn.' });
    }

    const result = await generate({
      messages, prompt,
      system: body.system,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
      json: body.json,
      providers: body.providers,
    });
    return sendJSON(res, result.ok ? 200 : 503, result);
  } catch (err) {
    console.error('[chat]', err);
    return sendJSON(res, err.status || 500, { ok: false, error: err.status ? err.message : 'Lỗi máy chủ, vui lòng thử lại.' });
  }
}

export async function healthHandler(req, res) {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.end();
  return sendJSON(res, 200, { ok: true, time: new Date().toISOString(), providers: status() });
}

// Bảng route: thêm route mới ở đây là chạy được cả local lẫn (sau khi tạo file api/...) trên Vercel
export const routes = {
  '/api/ai/chat': chatHandler,
  '/api/health': healthHandler,
};
