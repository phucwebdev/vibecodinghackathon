# Thẻ thành viên 2 đầu (Thành viên & Quầy)

Hệ thống thẻ thành viên số hóa: khách tích điểm khi mua hàng, đổi điểm lấy ưu đãi; nhân viên cộng điểm tại quầy. Bài dự thi Vibe Coding 2026 – Bảng Kỹ thuật – đội AIFUS.

- **Demo:** https://aifus-vibe-coding-2026.vercel.app (mở trên điện thoại hoặc máy tính, không cần tài khoản)
- **Mã thử thống nhất:** `KT-004` (Dũng Phạm) – bấm **Nạp dữ liệu mẫu** ở trang *Thể lệ* trước khi thử.

## Tính năng (theo đề)

| Yêu cầu | Ở đâu trong app |
|---|---|
| Đăng ký bằng tên + số điện thoại, sinh mã thành viên duy nhất, hiện trên thẻ | Chế độ **Thành viên** → *Thẻ* |
| Điểm & 3 hạng Đồng / Bạc / Vàng, thẻ đổi màu theo hạng | *Thẻ* (mốc công bố ở *Thể lệ*) |
| Chế độ Quầy: nhập mã thành viên + số tiền, cộng điểm theo tỉ lệ, cập nhật ngay | Nút **Quầy** trên thanh trên → *Cộng điểm* |
| Chống cộng trùng: mỗi mã giao dịch chỉ cộng 1 lần | *Cộng điểm* (báo lỗi, không cộng) |
| Đổi điểm lấy ưu đãi (3 mức), trừ điểm đúng, ví ưu đãi | *Ưu đãi* |
| Lịch sử biến động điểm (loại, số điểm, thời gian) | *Lịch sử* |
| Nút Nạp dữ liệu mẫu | *Thể lệ* (và màn đăng ký khi chưa có dữ liệu) |
| Thưởng QR: QR trên thẻ + quét bằng camera ở Quầy (hoặc chọn ảnh QR) | *Thẻ*, *Cộng điểm* → **Quét QR** |
| Mở rộng: hiệu ứng khi cộng điểm / lên hạng; thống kê mini | *Cộng điểm*, *Thẻ*, *Thành viên* |
| Mở rộng: quầy xác nhận dùng ưu đãi (quét QR voucher, mỗi mã dùng 1 lần) | *Ưu đãi* (ví) → Quầy → *Dùng ưu đãi* |
| Mở rộng: hai cửa sổ Thành viên + Quầy cập nhật tức thì, rung khi quét | Mở app ở 2 cửa sổ cùng trình duyệt |

## Quy tắc đội công bố

- **10.000đ = 1 điểm** (làm tròn xuống).
- Hạng theo điểm hiện có: **Đồng** dưới 1.000 · **Bạc** 1.000–4.999 · **Vàng** từ 5.000.
- Ưu đãi: Voucher 20.000đ = 500 điểm · Voucher 50.000đ = 1.100 điểm · Quà tặng đặc biệt = 2.000 điểm.

## Công nghệ

- HTML + CSS + JavaScript thuần, không cần build. Giao diện riêng cho điện thoại (`css/mobile.css`) và máy tính (`css/desktop.css`).
- Toàn bộ dữ liệu lưu `localStorage`; thư viện QR đặt sẵn trong `frontend/vendor/` và có service worker nên **chạy được khi mất mạng** sau lần mở đầu.
- Thư viện: `qrcode-generator` (tạo QR), `html5-qrcode` (quét QR bằng camera – cần HTTPS hoặc localhost).

## Cách chạy

```bash
cd frontend
npx serve .        # hoặc mở bằng Live Server; mở trực tiếp index.html cũng chạy (trừ camera)
```

## Dữ liệu mẫu

Nguồn: `Du_lieu_mau_Vibe_Coding_bangA.xlsx` do Ban tổ chức cung cấp (sheet KT_ThanhVien, KT_GiaoDich, KT_UuDai), đã chuyển sang `frontend/data/seed.js`. Tên và số điện thoại là dữ liệu hư cấu. Điểm hiện tại đã gồm giao dịch mẫu nên khi nạp không cộng lại.

## Cấu trúc

```
frontend/
├── index.html
├── css/        style.css (bộ giao diện chung) · loyalty.css · mobile.css · desktop.css · motion.css
├── js/         ui.js (tiện ích giao diện chung) · app.js (toàn bộ nghiệp vụ thẻ thành viên)
├── data/seed.js
├── vendor/     thư viện QR
└── sw.js
```

## Ghi công và phần chuẩn bị trước

- Bộ giao diện chung (`css/style.css`, `css/mobile.css`, `css/desktop.css`, `css/motion.css`, `js/ui.js`, khung `index.html`) được đội chuẩn bị trước giờ thi, không chứa chức năng của đề.
- Toàn bộ nghiệp vụ theo đề (`js/app.js`, `css/loyalty.css`, `data/seed.js`, `sw.js`) làm trong 60 phút thi, có hỗ trợ của công cụ AI.
- Thư mục `backend/` là khung gọi AI chuẩn bị trước, **không dùng** trong sản phẩm này.
