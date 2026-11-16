// Test bộ fallback bằng fetch giả lập – không tốn tiền API.  Chạy: npm test
import assert from 'node:assert/strict';

process.env.CLAUDE_API_KEY = 'x';
process.env.DEEPSEEK_API_KEY = 'x';
process.env.GEMINI_API_KEY = 'x';
process.env.AI_ORDER = 'claude,deepseek,gemini';
process.env.AI_TIMEOUT_MS = '300';

const { generate, _resetState, status } = await import('../lib/fallback.js');

const reply = {
  claude: (t) => ({ content: [{ type: 'text', text: t }], model: 'claude-test' }),
  deepseek: (t) => ({ choices: [{ message: { content: t } }], model: 'deepseek-test' }),
  gemini: (t) => ({ candidates: [{ content: { parts: [{ text: t }] } }] }),
};
const who = (url) => (url.includes('anthropic') ? 'claude' : url.includes('deepseek') ? 'deepseek' : 'gemini');
const ok = (body) => new Response(JSON.stringify(body), { status: 200 });
const fail = (status) => new Response(JSON.stringify({ error: { message: 'giả lập lỗi' } }), { status });
// AbortSignal.timeout dùng timer unref → giữ event loop sống bằng 1 timer phụ
const hang = (signal) => new Promise((_, rej) => {
  const keep = setTimeout(() => {}, 5000);
  signal.addEventListener('abort', () => { clearTimeout(keep); rej(signal.reason); });
});

function mock(plan) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    const p = who(url);
    calls.push(p);
    const step = plan[p];
    if (step === 'hang') return hang(init.signal);
    if (step === 'neterr') throw new TypeError('fetch failed');
    if (typeof step === 'number') return fail(step);
    return ok(reply[p](step));
  };
  return calls;
}

const tests = [];
const test = (name, fn) => tests.push({ name, fn });

test('Claude chạy tốt → dùng Claude', async () => {
  const calls = mock({ claude: 'xin chào' });
  const r = await generate({ prompt: 'hi' });
  assert.equal(r.ok, true); assert.equal(r.provider, 'claude'); assert.deepEqual(calls, ['claude']);
});

test('Claude 500 → chuyển DeepSeek; request sau bỏ qua Claude đang tạm khoá', async () => {
  let calls = mock({ claude: 500, deepseek: 'từ deepseek' });
  let r = await generate({ prompt: 'hi' });
  assert.equal(r.provider, 'deepseek'); assert.equal(r.text, 'từ deepseek'); assert.deepEqual(calls, ['claude', 'deepseek']);
  calls = mock({ claude: 'không nên gọi', deepseek: 'ds' });
  r = await generate({ prompt: 'hi' });
  assert.equal(r.provider, 'deepseek'); assert.deepEqual(calls, ['deepseek']);
  assert.match(r.attempts[0].skipped, /tạm khoá/);
});

test('Claude sai key 401, DeepSeek timeout → Gemini', async () => {
  const calls = mock({ claude: 401, deepseek: 'hang', gemini: 'từ gemini' });
  const r = await generate({ prompt: 'hi' });
  assert.equal(r.provider, 'gemini'); assert.deepEqual(calls, ['claude', 'deepseek', 'gemini']);
  assert.equal(r.attempts[0].kind, 'auth'); assert.equal(r.attempts[1].kind, 'timeout');
});

test('Cả 3 lỗi → ok=false kèm thông báo tiếng Việt', async () => {
  mock({ claude: 429, deepseek: 'neterr', gemini: 503 });
  const r = await generate({ prompt: 'hi' });
  assert.equal(r.ok, false); assert.match(r.error, /Tất cả/);
  assert.deepEqual(r.attempts.map((a) => a.kind), ['rate_limit', 'network', 'server']);
});

test('JSON hỏng ở Claude → chuyển DeepSeek trả JSON đúng', async () => {
  mock({ claude: 'đây không phải json', deepseek: '```json\n{"diem": 9}\n```' });
  const r = await generate({ prompt: 'chấm điểm', json: true });
  assert.equal(r.provider, 'deepseek'); assert.deepEqual(r.data, { diem: 9 });
});

test('Provider chưa có key → bỏ qua', async () => {
  delete process.env.CLAUDE_API_KEY;
  const calls = mock({ deepseek: 'ds' });
  const r = await generate({ prompt: 'hi' });
  assert.equal(r.provider, 'deepseek'); assert.deepEqual(calls, ['deepseek']);
  process.env.CLAUDE_API_KEY = 'x';
});

test('Đổi thứ tự theo từng request (providers)', async () => {
  const calls = mock({ gemini: 'g' });
  const r = await generate({ prompt: 'hi', providers: ['gemini', 'claude'] });
  assert.equal(r.provider, 'gemini'); assert.deepEqual(calls, ['gemini']);
});

let pass = 0;
for (const t of tests) {
  _resetState();
  try { await t.fn(); pass++; console.log('✅', t.name); } catch (e) { console.log('❌', t.name, '\n  ', e.message); }
}
console.log(`\n${pass}/${tests.length} test đạt`);
console.log('status():', JSON.stringify(status()[0]));
process.exit(pass === tests.length ? 0 : 1);
