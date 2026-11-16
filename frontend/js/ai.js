/* Client AI cho frontend – gọi backend (backend tự fallback Claude → DeepSeek → Gemini).
 * Nạp: <script src="js/ai.js" defer></script>
 * Dùng:
 *   const r = await AI.ask('Tóm tắt đoạn này: ...');            // r.ok, r.text, r.provider
 *   const r = await AI.json('Trả về {"diem":number,"nhanXet":string} cho bài: ...'); // r.data
 *   const r = await AI.chat([{role:'user',content:'Chào'}], { system: '...' });
 * Không bao giờ throw: lỗi trả về { ok:false, error:'câu tiếng Việt cho người dùng' }.
 */
(function () {
  // URL backend khi deploy – điền sau khi tạo project Vercel cho thư mục backend/
  var PROD_API = window.AI_API_BASE || 'https://YOUR-BACKEND.vercel.app';
  var isLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || location.protocol === 'file:';
  var BASE = (isLocal ? 'http://localhost:3001' : PROD_API).replace(/\/+$/, '');
  var TIMEOUT_MS = 60000;

  async function call(body) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    try {
      var res = await fetch(BASE + '/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      var data = await res.json().catch(function () { return null; });
      if (!data) return { ok: false, error: 'Máy chủ AI phản hồi không hợp lệ. Vui lòng thử lại.' };
      if (!data.ok && !data.error) data.error = 'Trợ lý AI đang bận. Vui lòng thử lại sau ít phút.';
      return data;
    } catch (e) {
      return {
        ok: false,
        error: e && e.name === 'AbortError'
          ? 'Trợ lý AI phản hồi quá lâu. Vui lòng thử lại.'
          : 'Không kết nối được trợ lý AI. Kiểm tra mạng rồi thử lại.',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  window.AI = {
    base: BASE,
    ask: function (prompt, opts) { return call(Object.assign({ prompt: prompt }, opts)); },
    chat: function (messages, opts) { return call(Object.assign({ messages: messages }, opts)); },
    json: function (prompt, opts) { return call(Object.assign({ prompt: prompt, json: true, temperature: 0.2 }, opts)); },
    health: async function () {
      try { return await (await fetch(BASE + '/api/health')).json(); }
      catch (e) { return { ok: false, error: 'Không kết nối được máy chủ.' }; }
    },
  };
})();
