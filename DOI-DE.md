# ĐỔI ĐỀ TRONG 15 PHÚT – hướng dẫn cho đội (xóa file này trước khi nộp)

Template = UI kit + app mẫu "Quản lý cửa hàng" chạy đủ luồng. **Phần lớn chỉ cần sửa `js/config.js` và `data/seed.js`**; trang Danh sách, Thêm/Sửa, Chi tiết, Nhập Excel tự sinh theo cấu hình.

## Thứ tự làm (ai làm gì)

| Phút | Việc | File | Người |
|---|---|---|---|
| 0–3 | Đọc đề, chốt bảng R1…Rn, chốt thực thể chính + các trường | — | Cả đội |
| 3–8 | `appName`, `tagline`, `theme`, `brandIcon`, `entity`, `fields`, `statuses`, `menu` | `js/config.js` | Người 1 |
| 3–8 | Mở file Excel BTC ở **Tiện ích → Nhập dữ liệu** → bấm "Dùng dữ liệu này" → **Tải file seed.js** → chép đè `data/seed.js` | `data/seed.js` | Người 2 |
| 8–12 | `stats`, `chart`, `attention` cho trang Tổng quan | `js/config.js` | Người 1 |
| 8–40 | **Tính năng lõi riêng của đề** → trang mới trong `js/pages/` | `js/pages/*.js` | Người 3, 4 |
| 8–15 | `<title>`, `<meta description>`, favicon trong `index.html` | `index.html` | Người 2 |
| 15–20 | Bảng Kinh tế: sửa `business.assumptions` (+ nguồn). Bảng Kỹ thuật: xóa `kinh-doanh` khỏi `menu` | `js/config.js` | Người 2 |
| 40–50 | Chạy 4 bài test UX trên điện thoại thật, sửa lỗi | — | Cả đội |
| 50–60 | README, ảnh minh chứng, commit cuối | `README.md` | Người 1 |

> Đổi `storageKey` khi đổi đề, nếu không app sẽ đọc lại dữ liệu cũ đã lưu trong trình duyệt.

## Chọn màu (`theme`)
`xanh-duong` giáo dục/công nghệ · `teal` y tế · `xanh-la` nông nghiệp/môi trường · `navy` tài chính/kinh tế · `cam` du lịch/ẩm thực · `tim` sáng tạo. Cả 6 màu đã đạt tương phản chữ trắng ≥ 4.5:1.

## Kiểu trường (`fields[].type`)
`text` · `textarea` · `number` (có `unit`) · `money` · `date` · `select` (có `options`) · `status` (dùng `statuses`) · `tel` · `email`
Thuộc tính: `required`, `unique`, `min`, `max`, `placeholder`, `hint`, `table` (cột bảng máy tính), `card` (hiện trên thẻ điện thoại), `aliases` (tên cột Excel có thể gặp – viết không dấu).

## Thêm một trang riêng cho đề (VD: "Đặt lịch")
1. Tạo `js/pages/dat-lich.js`:
```js
(function () {
  var esc = UI.esc, icon = UI.icon;
  App.pages.booking = {
    title: 'Đặt lịch',
    render: function () { return '<section class="page-head"><h2 class="h3">Đặt lịch</h2></section>' + '...'; },
    mount: function (view) { /* chạy sau khi vẽ (nạp QR, biểu đồ...) */ },
    leave: function () { /* rời trang (tắt camera...) */ },
    on: {
      click: function (e, btn, action) { if (action === 'book') { /* ... */ UI.toast('Đã đặt lịch'); } },
      input: function (e) {}, change: function (e) {}, submit: function (e) { e.preventDefault(); }
    }
  };
})();
```
2. `index.html`: thêm `<script src="js/pages/dat-lich.js" defer></script>` **trước** `js/app.js`.
3. `js/app.js`: thêm `'dat-lich': 'booking'` vào `ROUTES`.
4. `js/config.js`: thêm `{ route: 'dat-lich', label: 'Đặt lịch', icon: 'calendar' }` vào `menu` (tối đa 5 mục – bỏ bớt `Thêm mới` hoặc `Tiện ích` nếu cần).

## Hàm có sẵn hay dùng
| Hàm | Dùng để |
|---|---|
| `App.data.all() / get(id) / add(obj) / update(id, patch) / remove(id)` | Đọc ghi dữ liệu (tự lưu localStorage, tự đồng bộ Firebase nếu bật) |
| `App.state.get(name, macDinh) / set(name, v)` | Lưu trạng thái phụ (giỏ hàng, lịch đặt…) |
| `App.fmt(field, value)` · `App.badge(status)` | Hiển thị đúng định dạng VN |
| `App.empty(icon, tieuDe, huongDan, nutHtml)` | Màn hình trống có hướng dẫn |
| `App.setError(id, msg)` | Báo lỗi dưới ô nhập |
| `App.deleteItem(id, sauKhiXoa)` | Xóa có xác nhận + Hoàn tác |
| `App.toastUndo(msg, hamHoanTac)` | Thông báo có nút Hoàn tác |
| `App.chart.bars([{label,value}], 'money')` · `App.chart.lines(series, labels)` | Biểu đồ SVG không cần mạng |
| `App.renderQR(el, text)` · trang Tiện ích có quét QR | +4 điểm thiết bị ngoại vi (cần link https Vercel) |
| `App.param('id')` · `App.router.go('chi-tiet?id=x')` · `App.router.refresh()` | Điều hướng |
| `UI.toast · UI.confirm · UI.esc · UI.match · UI.money · UI.date · UI.skeleton` | Từ UI kit |

## Đăng nhập (đã bật sẵn – `CONFIG.auth`)
- Có: đăng nhập email/mật khẩu, đăng ký (họ tên), quên mật khẩu (gửi email tiếng Việt), Google, **Dùng thử không cần tài khoản**, đăng xuất (avatar góc phải trên điện thoại / khối tài khoản cuối menu trái trên máy tính). Chưa đăng nhập mà vào thẳng `#/danh-sach` → chuyển sang đăng nhập rồi quay lại đúng trang đó.
- **Việc phải làm trên Firebase Console (5 phút, làm TỐI NAY):**
  1. Authentication → Get started → Sign-in method → bật **Email/Password** và **Google** (chọn email hỗ trợ).
  2. Authentication → Settings → **Authorized domains** → Add domain: tên miền Vercel, VD `ten-app.vercel.app` (localhost có sẵn).
  3. Tạo sẵn 1 tài khoản demo cho giám khảo (Authentication → Users → Add user), VD `demo@vibe.vn` / `123456`, ghi vào README.
- Đề không cần đăng nhập → `auth.enabled: false`. Muốn có đăng nhập nhưng không bắt buộc → `required: false`.
- Module Firebase **không chạy khi mở bằng file://** → dùng Live Server hoặc link Vercel. Mất mạng/Firebase lỗi: sau 6 giây trang đăng nhập hiện cảnh báo và vẫn cho "Dùng thử".
- Lấy người dùng hiện tại trong code: `App.auth.user` (`uid`, `name`, `email`, `photo`), `App.auth.displayName()`, `App.auth.guest`.

## Firebase (chỉ bật khi đề cần nhiều máy cùng thấy dữ liệu)
`config.js` → `firebase.enabled: true`, bỏ comment dòng `js/firebase.js` trong `index.html`. Firestore phải ở chế độ cho phép đọc/ghi. Mất mạng app vẫn chạy bằng localStorage.

## Trước khi nộp
- [ ] Không còn chữ "cửa hàng", "sản phẩm", "SP0…" của app mẫu (tìm toàn thư mục: `cửa hàng`, `sản phẩm`).
- [ ] Xóa file `DOI-DE.md` này; điền `README.md`.
- [ ] Test 375px & máy tính: không cuộn ngang, tab đáy/sidebar đúng, F5 ở trang chi tiết không lỗi.
- [ ] Mở link Vercel trên điện thoại: thêm → sửa → xóa → hoàn tác, tìm không dấu, quét QR.
