# Backend FastAPI – Hệ thống Thẻ Thành Viên 2 Đầu (Doanh Nghiệp & Ngân Hàng)

Backend viết bằng **Python FastAPI**, tích hợp:
1. **AI Fallback 4 tầng:** `Gemini (Key 1)` ➔ `OpenRouter (GPT-4.1 mini → Claude Haiku 5.5 → DeepSeek V4.1 Flash)` ➔ `Gemini (Key 2 dự phòng)` ➔ `Local Rule Engine (Offline)`.
2. **Lưu trữ trực tiếp Firebase Firestore (`vibecoding-c4196`):**
   - Khi **Có mạng**: Đẩy thẳng mọi giao dịch (Đăng ký, Cộng điểm, Chống trùng mã GD, Đổi ưu đãi, Nạp mẫu BTC) lên **Firebase Firestore**.
   - Khi **Mất mạng**: Backend tự động phát hiện mất kết nối tới Firebase và trả cờ `activateLocalStorage: true` để Frontend kích hoạt môi trường `localStorage` tạm thời.
3. **Nghiệp vụ Ngân hàng (Đối soát Offline & Tự động Rollback / Hoàn điểm):**
   - Khi có mạng trở lại, `/api/loyalty/sync` nhận hàng đợi từ `localStorage` đẩy lên Firebase.
   - Nếu hợp lệ: Hạch toán `COMMITTED` lên Firebase.
   - Nếu xung đột (trùng mã giao dịch đã có trên Cloud hoặc không đủ số dư điểm thực tế): Tự động sinh **Bút toán Đảo (`ROLLED_BACK`)**, hoàn trả điểm và hủy voucher lỗi.

---

## 1. Chạy ở máy Local

```bash
cd backend
pip install -r requirements.txt
python main.py
# Hoặc: uvicorn main:app --host 0.0.0.0 --port 3001 --reload
```
- Kiểm tra trạng thái AI & Firebase: `http://localhost:3001/api/health`
- Tài liệu Swagger UI tự động: `http://localhost:3001/docs`
- Chạy bộ kiểm thử tự động: `python test_backend.py`

---

## 2. Deploy lên Render (Root Directory: `backend`)

### Cách 1: Tạo Web Service thủ công trên Render
1. Vào **Render Dashboard → New → Web Service** → Chọn repo `phucwebdev/vibecodinghackathon`.
2. Cấu hình:
   - **Root Directory:** `backend`
   - **Runtime:** `Python 3`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
3. Trong mục **Environment Variables**, thêm:
   - `GEMINI_API_KEY`
   - `OPENROUTER_API_KEY`
   - `GEMINI_API_KEY_2`
   - `CORS_ORIGIN` = `*` (hoặc domain frontend Vercel)

### Cách 2: Dùng Blueprint (`render.yaml`)
- Đã cấu hình sẵn `rootDir: backend` trong `render.yaml` ở thư mục gốc và `backend/render.yaml`.

---

## 3. Deploy lên Vercel (Root Directory: `backend`)

1. Vercel → **Add New Project** → Chọn repo → đặt **Root Directory: `backend`**.
2. File `backend/vercel.json` đã cấu hình sẵn `@vercel/python` trỏ vào `main.py`.
3. Thêm biến môi trường `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY_2` trong **Settings → Environment Variables**.
