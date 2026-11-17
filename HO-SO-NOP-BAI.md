# HỒ SƠ NỘP BÀI – Đội AIFUS – Bảng Kỹ thuật

Sản phẩm: **Thẻ thành viên 2 đầu (Thành viên & Quầy)**

## 1. Link demo (2 điểm)

https://aifus-vibe-coding-2026.vercel.app

Cách mở: dùng Chrome hoặc Safari trên điện thoại hoặc máy tính, không cần tài khoản.
Thử nhanh: **Thể lệ → Nạp dữ liệu mẫu** → bấm **Quầy** ở thanh trên → nhập hoặc quét mã `KT-004`.

## 2. Source code (3 điểm)

https://github.com/phucwebdev/vibecodinghackathon (nhánh `main`, thư mục `frontend/` là sản phẩm, khớp bản demo)

## 3. README (2 điểm)

https://github.com/phucwebdev/vibecodinghackathon/blob/main/README.md
Gồm: tính năng theo đề, quy tắc đội công bố, công nghệ, cách chạy, dữ liệu mẫu, phần chuẩn bị trước.

## 4. Minh chứng tại thời điểm chốt (2 điểm)

Đính kèm thư mục ảnh `minh-chung/` (ảnh màn hình sản phẩm ở khổ điện thoại 375px và máy tính 1366px).
Đội tự chụp thêm lúc chốt:
- [ ] Trang Deployments của Vercel, thấy bản mới nhất ở trạng thái Ready và giờ deploy
- [ ] Trang commit cuối trên GitHub, thấy giờ commit
- [ ] Một ảnh điện thoại thật đang mở app (màn Thẻ có QR)
- [ ] Bản ghi màn hình OBS (nếu có)

## Ca kiểm tra của Ban tổ chức – kết quả tự kiểm

| Ca | Thao tác | Kết quả |
|---|---|---|
| TC-KT-01 | Quầy: KT-008, 1.000.000đ, mã TX-NEW-001 | Cộng 100 điểm, số dư 0 → 100 |
| TC-KT-02 | Quầy: KT-002, mã TX-KT-002 | Báo trùng, vẫn 1.450 điểm |
| TC-KT-03 | Thành viên KT-005 đổi Voucher 20.000đ | Còn 5.300 điểm, voucher vào ví |
| TC-KT-04 | Thành viên KT-008 đổi Voucher 20.000đ | Từ chối, số dư vẫn 0 |
| TC-KT-05 | Quầy: quét QR KT-004 | Đọc đúng KT-004, mở hồ sơ Dũng Phạm |

## Kịch bản trình bày 2 phút

1. **Vấn đề (15 giây):** thẻ tích điểm giấy hay mất, khách không biết mình còn bao nhiêu điểm, quán không kiểm soát được việc cộng điểm.
2. **Giải pháp (15 giây):** một app, hai chế độ. Khách có thẻ trên điện thoại; nhân viên cộng điểm trong vài giây và không thể cộng trùng.
3. **Demo (70 giây), theo đúng thứ tự:**
   - Thể lệ → Nạp dữ liệu mẫu.
   - Thành viên: mở thẻ KT-004, chỉ vào màu hạng, QR, thanh tiến độ lên hạng.
   - Quầy → Quét QR KT-004 → hồ sơ Dũng Phạm hiện ra → nhập 20.000.000đ → cộng điểm, lên hạng Vàng có hiệu ứng.
   - Bấm cộng lại cùng mã giao dịch → bị chặn.
   - Thành viên → Ưu đãi → đổi voucher → voucher vào ví, có QR.
   - Quầy → Dùng ưu đãi → nhập mã voucher → xác nhận; nhập lại → bị từ chối.
   - Quầy → Thành viên → thống kê, Xuất Excel.
4. **Điểm khác biệt (20 giây):** chạy được khi mất mạng; hai cửa sổ cập nhật tức thì; voucher dùng một lần có QR; xuất Excel cho chủ quán.

## Câu hỏi phản biện dự kiến

- **Không đăng nhập thì bảo mật thế nào?** Đề yêu cầu không cần phân quyền thật. Khách mở thẻ bằng số điện thoại hoặc mã; bản thật sẽ xác thực bằng OTP và chế độ Quầy có mã PIN nhân viên.
- **Chống cộng trùng làm thế nào?** Mỗi mã giao dịch được lưu trong sổ; trước khi cộng, app tra mã (không phân biệt hoa thường), đã có thì từ chối và không đổi điểm.
- **Mất mạng thì sao?** Dữ liệu ở localStorage, thư viện QR và Excel nằm sẵn trong app, service worker lưu các tệp của app sau lần mở đầu.
- **Dữ liệu chỉ ở một máy, mở rộng thế nào?** Bước tiếp theo là đồng bộ lên máy chủ, giữ localStorage làm bản dự phòng khi mất mạng.
- **Chống chèn mã độc?** Mọi dữ liệu người dùng nhập đều được mã hóa ký tự trước khi hiển thị.
- **Phần nào chuẩn bị trước, AI hỗ trợ ở đâu?** Bộ giao diện chung chuẩn bị trước, không có chức năng của đề. Toàn bộ nghiệp vụ làm trong giờ thi với công cụ AI; đội kiểm tra bằng 5 ca của Ban tổ chức trên điện thoại.
- **Vì sao hạng tính theo điểm hiện có?** Khớp với bộ dữ liệu mẫu (thành viên đổi điểm xong về hạng thấp hơn) và được công bố ở trang Thể lệ.
