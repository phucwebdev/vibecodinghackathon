# Quản lý cửa hàng

> Theo dõi sản phẩm, tồn kho và doanh thu của cửa hàng – dùng tốt trên điện thoại.
> **Sản phẩm dự thi Chung kết VIBE-CODING 2026 – Đội: …………**

- **Link demo:** https://……….vercel.app
- **Mã nguồn:** https://github.com/……/……
- **Tài khoản demo:** email `demo@……` · mật khẩu `……` – hoặc bấm **Dùng thử không cần tài khoản**

## Tính năng chính (theo đề bài)

| Mã | Yêu cầu của đề | Tính năng | Màn hình |
|---|---|---|---|
| R1 | …… | Tổng quan 3 chỉ số + biểu đồ + danh sách cần chú ý | Tổng quan |
| R2 | …… | Danh sách, tìm kiếm không cần dấu, lọc trạng thái, sắp xếp | Sản phẩm |
| R3 | …… | Thêm / sửa có kiểm tra dữ liệu, chống trùng mã | Thêm mới, Chỉnh sửa |
| R4 | …… | Xóa có xác nhận và hoàn tác | Sản phẩm, Chi tiết |
| R5 | …… | Nhập dữ liệu từ file Excel của BTC, xuất CSV | Tiện ích |
| R6 | …… | Mô hình kinh doanh: giả định có nguồn, 3 kịch bản, hòa vốn, hoàn vốn, kiểm tra ưu đãi có lãi | Kinh doanh |
| R7 | …… | Đăng nhập email / Google, đăng ký, quên mật khẩu, dùng thử | Đăng nhập |
| +  | Thiết bị ngoại vi | Tạo mã QR cho từng mục, quét QR bằng camera | Chi tiết, Tiện ích |

## Công nghệ
- HTML + CSS + JavaScript thuần – không cần build, mở nhanh trên điện thoại, ít điểm hỏng.
- Đăng nhập: Firebase Authentication (email/mật khẩu, Google).
- Lưu dữ liệu: `localStorage` (hoạt động cả khi mất mạng); tùy chọn đồng bộ Firebase Firestore.
- Thư viện qua CDN: SheetJS (đọc Excel), qrcode-generator (tạo QR), html5-qrcode (quét QR). Biểu đồ vẽ bằng SVG tự viết.
- Triển khai: Vercel (static, Framework Preset: Other).

## Cách chạy
1. Tải mã nguồn, mở `index.html` bằng trình duyệt (hoặc Live Server trong VS Code).
2. Quét QR bằng camera cần chạy qua `https` (link Vercel).

## Dữ liệu mẫu
- Nguồn: file dữ liệu mẫu do BTC cung cấp, chuyển sang `data/seed.js` để app có dữ liệu ngay khi mở.
- Mọi số liệu giả lập đều gắn nhãn "Dữ liệu mẫu" / "Mô phỏng" trên giao diện.
- Có thể nhập lại file Excel tại **Tiện ích → Nhập dữ liệu từ Excel**.

## Cấu trúc thư mục
```
index.html          Khung app, bộ icon, nạp script
css/style.css       UI kit: màu, chữ, thành phần giao diện
css/app.css         Bổ sung: biểu đồ, form nhiều cột, trang kinh doanh
js/ui.js            UI kit: điều hướng, thông báo, hộp xác nhận, định dạng
js/config.js        Cấu hình app: tên, màu, menu, lược đồ dữ liệu, giả định kinh doanh
js/core.js          Lớp dữ liệu, định dạng, biểu đồ SVG
js/pages/*.js       Từng trang: home, list, detail, form, business, tools
js/app.js           Khai báo route, chuyển sự kiện tới trang
js/firebase-init.js Khởi tạo Firebase dùng chung
js/auth.js          Đăng nhập Firebase Authentication
js/firebase.js      Đồng bộ Firestore (tùy chọn)
data/seed.js        Dữ liệu mẫu
```

## Bảo mật & ổn định
- Mọi dữ liệu người dùng nhập đều được escape trước khi hiển thị (chống XSS).
- Mật khẩu do Firebase Authentication xử lý, app không lưu mật khẩu.
- Không có khóa bí mật trong mã nguồn (config Firebase web là thông tin công khai).
- Lỗi ở một trang được bắt và hiển thị thông báo thân thiện, không trắng màn hình.

## Ghi công
- Bộ khung giao diện (CSS, hàm tiện ích `ui.js`, bộ cấu hình trang) do đội chuẩn bị trước, tương tự một thư viện UI. Toàn bộ chức năng nghiệp vụ theo đề được xây dựng trong giờ thi.
- Lucian UX/UI Prompt (MIT) – nếu dùng: `#ID tên – dùng ở đâu – đã chỉnh gì`.
- Công cụ AI hỗ trợ sinh mã; đội kiểm tra, chạy thử trên điện thoại và chỉnh sửa.

## Minh chứng
Thư mục `minh-chung/`: ảnh màn hình điện thoại 375px từng luồng chính, trang deploy Vercel, commit cuối GitHub, bản ghi màn hình.
