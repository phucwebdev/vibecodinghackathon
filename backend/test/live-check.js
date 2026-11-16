// Gọi thật từng provider 1 lần để kiểm tra key còn sống.  Chạy: npm run check
import { loadEnv } from '../lib/env.js';
loadEnv();
const { PROVIDERS } = await import('../lib/fallback.js');

for (const [name, p] of Object.entries(PROVIDERS)) {
  if (!p.isConfigured()) { console.log(`⚪ ${name}: chưa có key`); continue; }
  const t0 = Date.now();
  try {
    const r = await p.generate({
      messages: [{ role: 'user', content: 'Trả lời đúng 1 từ: "OK"' }],
      maxTokens: 20, temperature: 0, timeoutMs: 20000,
    });
    console.log(`🟢 ${name} (${r.model}) ${Date.now() - t0}ms → ${r.text.trim().slice(0, 40)}`);
  } catch (e) {
    console.log(`🔴 ${name}: [${e.kind}] ${e.message.slice(0, 200)}`);
  }
}
