# Backend – AI có fallback

Gọi AI theo thứ tự **Claude → DeepSeek → Gemini**. Provider đầu lỗi thì tự chuyển sang provider sau, người dùng không thấy lỗi.
Viết bằng Node thuần (>= 18), **không cần `npm install`**.

## Chạy ở máy

```bash
cd backend
node server.js        # hoặc: npm start
```
Mở http://localhost:3001/api/health để xem trạng thái từng provider.

Kiểm tra key còn sống: `npm run check` · Test logic fallback (không tốn tiền API): `npm test`

## API

### `POST /api/ai/chat`
```json
{
  "prompt": "Câu hỏi...",                       // hoặc "messages": [{ "role": "user", "content": "..." }]
  "system": "Vai trò của AI (không bắt buộc)",
  "json": false,                                // true → AI trả JSON, kết quả nằm ở "data"
  "maxTokens": 1024,
  "temperature": 0.7,
  "providers": ["gemini", "claude"]             // đổi thứ tự cho riêng request này (không bắt buộc)
}
```
Thành công (200):
```json
{ "ok": true, "text": "...", "data": {}, "provider": "deepseek", "model": "deepseek-chat", "ms": 1840,
  "attempts": [{ "provider": "claude", "ok": false, "kind": "timeout" }, { "provider": "deepseek", "ok": true }] }
```
Tất cả đều lỗi (503): `{ "ok": false, "error": "câu thông báo tiếng Việt", "attempts": [...] }`

### `GET /api/health`
Trạng thái từng provider: đã có key chưa, đang tạm khoá bao lâu, lỗi gần nhất. Không bao giờ trả về key.

## Cơ chế fallback

| Tình huống | Xử lý |
|---|---|
| Chưa có key | Bỏ qua provider đó |
| Sai key / hết tiền (401, 402, 403) | Chuyển provider sau, tạm khoá 10 phút |
| Quá giới hạn (429) | Chuyển provider sau, tạm khoá theo `retry-after` (mặc định 30 giây) |
| Lỗi server / mạng / quá 20 giây | Chuyển provider sau, tạm khoá 20 giây |
| Yêu cầu JSON nhưng AI trả JSON hỏng | Chuyển provider sau |
| Cả 3 đều lỗi | Trả 503 + câu thông báo tiếng Việt cho người dùng |

Tổng thời gian tối đa cho một yêu cầu: `AI_TOTAL_BUDGET_MS` (45 giây).

## Deploy lên Vercel

1. Vercel → **Add New Project** → chọn repo này → **Root Directory: `backend`**, Framework Preset: **Other**, không có build command.
2. **Settings → Environment Variables**: thêm từng dòng trong `.env` (`CLAUDE_API_KEY`, `DEEPSEEK_API_KEY`, `GEMINI_API_KEY`, `CLAUDE_WORKSPACE_ID`, …).
3. Deploy → copy URL (VD `https://aifus-api.vercel.app`) → dán vào `PROD_API` trong `frontend/js/ai.js`.
4. Sau khi có domain frontend, đặt `CORS_ORIGIN=https://<frontend>.vercel.app` để chặn web khác dùng ké key.

## Thêm logic theo đề

- Viết hàm xử lý trong `lib/handlers.js` (hoặc `lib/routes/*.js`), gọi `generate({ prompt, system, json: true })` từ `lib/fallback.js`.
- Thêm vào bảng `routes` (để chạy local) và tạo file `api/<ten>.js` export handler đó (để chạy trên Vercel).

## Cấu trúc

```
backend/
├── api/                 # Vercel Functions (mỗi file = 1 endpoint)
│   ├── ai/chat.js
│   └── health.js
├── lib/
│   ├── fallback.js      # lõi fallback + tạm khoá provider
│   ├── handlers.js      # xử lý request, dùng chung local & Vercel
│   ├── http.js          # CORS, đọc body, trả JSON
│   ├── env.js           # đọc .env
│   └── providers/       # claude.js · deepseek.js · gemini.js
├── test/
├── server.js            # server chạy ở máy
├── .env                 # KEY BÍ MẬT – không commit
└── .env.example
```
