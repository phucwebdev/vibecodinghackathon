/* =========================================================
   CẤU HÌNH APP – FILE SỬA ĐẦU TIÊN KHI CÓ ĐỀ
   Đổi tên app, màu, menu và "lược đồ dữ liệu" ở đây.
   Trang Danh sách / Thêm mới / Chi tiết / Nhập Excel tự sinh theo FIELDS.
   ========================================================= */
window.CONFIG = {
  /* ---------- 1. Nhận diện ---------- */
  appName: 'Quản lý cửa hàng',
  tagline: 'Theo dõi sản phẩm, tồn kho và doanh thu của cửa hàng.',
  brandIcon: 'store',              // tên icon trong sprite (index.html)
  theme: 'xanh-duong',             // xanh-duong | teal | xanh-la | navy | cam | tim
  greeting: 'Xin chào, chủ cửa hàng',
  storageKey: 'vibe.template.v1',  // đổi khi đổi đề để không dính dữ liệu cũ

  /* ---------- 2. Thực thể chính ---------- */
  entity: {
    one: 'sản phẩm',               // "Thêm sản phẩm", "Xóa sản phẩm"
    titleField: 'name',            // trường làm tiêu đề thẻ
    subtitleField: 'category',     // dòng phụ dưới tiêu đề
    statusField: 'status',         // trường trạng thái (chip lọc + badge), để '' nếu không có
    searchFields: ['name', 'category', 'code'],
    idPrefix: 'sp'
  },

  /* ---------- 3. Lược đồ dữ liệu ----------
     type: text | textarea | number | money | date | select | status | tel | email
     required: bắt buộc · unique: không trùng · table: hiện cột ở bảng máy tính · card: hiện ở thẻ điện thoại
     aliases: tên cột có thể gặp trong file Excel của BTC (để tự ghép cột khi nhập)  */
  fields: [
    { key: 'code', label: 'Mã sản phẩm', type: 'text', required: true, unique: true, table: true, placeholder: 'VD: SP001', aliases: ['ma', 'ma sp', 'sku', 'id'] },
    { key: 'name', label: 'Tên sản phẩm', type: 'text', required: true, table: true, placeholder: 'VD: Cà phê sữa đá', aliases: ['ten', 'ten san pham', 'san pham', 'name'] },
    { key: 'category', label: 'Danh mục', type: 'select', required: true, table: true,
      options: ['Đồ uống', 'Đồ ăn', 'Bánh ngọt', 'Khác'], aliases: ['loai', 'nhom', 'danh muc'] },
    { key: 'price', label: 'Giá bán', type: 'money', required: true, table: true, card: true, min: 0, placeholder: 'VD: 25000', aliases: ['gia', 'don gia', 'gia ban'] },
    { key: 'stock', label: 'Tồn kho', type: 'number', required: true, table: true, card: true, min: 0, unit: 'sp', placeholder: 'VD: 40', aliases: ['so luong', 'ton', 'ton kho', 'sl'] },
    { key: 'sold', label: 'Đã bán tháng này', type: 'number', min: 0, unit: 'sp', placeholder: 'VD: 120', aliases: ['da ban', 'luot ban'] },
    { key: 'date', label: 'Ngày nhập hàng', type: 'date', table: true, aliases: ['ngay', 'ngay nhap'] },
    { key: 'status', label: 'Trạng thái', type: 'status', required: true, table: true, card: true, aliases: ['tinh trang', 'trang thai'] },
    { key: 'note', label: 'Ghi chú', type: 'textarea', placeholder: 'VD: Bán chạy buổi sáng', aliases: ['ghi chu', 'mo ta'] }
  ],

  /* Trạng thái: value lưu trong dữ liệu → nhãn + màu (success | info | warning | danger | neutral) */
  statuses: [
    { value: 'dang-ban', label: 'Đang bán', tone: 'success' },
    { value: 'sap-het', label: 'Sắp hết', tone: 'warning' },
    { value: 'het-hang', label: 'Hết hàng', tone: 'danger' },
    { value: 'tam-ngung', label: 'Tạm ngưng', tone: 'neutral' }
  ],

  /* Sắp xếp ở trang Danh sách */
  sorts: [
    { value: 'new', label: 'Mới cập nhật', by: '_updated', dir: -1 },
    { value: 'name', label: 'Tên A → Z', by: 'name', dir: 1 },
    { value: 'price-desc', label: 'Giá cao → thấp', by: 'price', dir: -1 },
    { value: 'stock-asc', label: 'Tồn kho ít nhất', by: 'stock', dir: 1 }
  ],

  /* ---------- 4. Tổng quan: 3–4 con số + 1 biểu đồ ---------- */
  stats: [
    { label: 'Sản phẩm', value: function (items) { return items.length; } },
    { label: 'Sắp hết / hết hàng', tone: 'danger', value: function (items) {
        return items.filter(function (x) { return x.status === 'sap-het' || x.status === 'het-hang'; }).length; } },
    { label: 'Doanh thu tháng', format: 'money', tone: 'primary', value: function (items) {
        return items.reduce(function (s, x) { return s + (Number(x.price) || 0) * (Number(x.sold) || 0); }, 0); } }
  ],
  chart: {
    title: 'Doanh thu theo danh mục',
    groupBy: 'category',                       // nhóm theo trường nào
    value: function (x) { return (Number(x.price) || 0) * (Number(x.sold) || 0); }, // null = đếm số lượng
    format: 'money'
  },
  /* Danh sách "cần chú ý" ở trang chủ */
  attention: {
    title: 'Cần nhập thêm hàng',
    filter: function (x) { return x.status === 'sap-het' || x.status === 'het-hang'; },
    emptyText: 'Mọi sản phẩm đều còn đủ hàng.'
  },

  /* ---------- 5. Menu (3–5 mục). Bỏ 'kinh-doanh' nếu là bảng Kỹ thuật ---------- */
  menu: [
    { route: '', label: 'Tổng quan', icon: 'home' },
    { route: 'danh-sach', label: 'Sản phẩm', icon: 'list' },
    { route: 'them', label: 'Thêm mới', icon: 'plus-circle' },
    { route: 'kinh-doanh', label: 'Kinh doanh', icon: 'trending' },
    { route: 'tien-ich', label: 'Tiện ích', icon: 'grid' }
  ],

  /* ---------- 6. Mô hình kinh doanh (bảng Kinh tế) ----------
     Mỗi giả định có nguồn → giám khảo hỏi "số này ở đâu ra" là trả lời được */
  business: {
    unitLabel: 'đơn',
    assumptions: [
      { key: 'price', group: 'Doanh thu', label: 'Giá trị trung bình mỗi đơn', type: 'money', value: 45000, source: 'Trung bình giá bán từ dữ liệu mẫu' },
      { key: 'orders', group: 'Doanh thu', label: 'Số đơn tháng đầu', type: 'number', value: 1200, unit: 'đơn', source: 'Ước tính 40 đơn/ngày × 30 ngày' },
      { key: 'growth', group: 'Doanh thu', label: 'Tăng trưởng số đơn mỗi tháng', type: 'percent', value: 5, source: 'Giả định thận trọng cho cửa hàng mới' },
      { key: 'varCost', group: 'Chi phí', label: 'Chi phí biến đổi (% giá bán)', type: 'percent', value: 45, source: 'Nguyên liệu + bao bì + phí thanh toán' },
      { key: 'fixedCost', group: 'Chi phí', label: 'Chi phí cố định mỗi tháng', type: 'money', value: 18000000, source: 'Mặt bằng 8tr + 2 nhân viên 10tr' },
      { key: 'invest', group: 'Chi phí', label: 'Vốn đầu tư ban đầu', type: 'money', value: 60000000, source: 'Thiết bị + sửa sang + vốn lưu động' },
      { key: 'discount', group: 'Ưu đãi', label: 'Mức giảm giá cho khách dùng ưu đãi', type: 'percent', value: 10, source: 'Mã giảm cho khách mới / thành viên' },
      { key: 'discountShare', group: 'Ưu đãi', label: 'Tỷ lệ đơn dùng ưu đãi', type: 'percent', value: 30, source: 'Giả định 3/10 khách dùng mã' }
    ],
    scenarios: [
      { key: 'than-trong', label: 'Thận trọng', orders: 0.7, growth: 0.5, tone: 'warning' },
      { key: 'co-so', label: 'Cơ sở', orders: 1, growth: 1, tone: 'info' },
      { key: 'lac-quan', label: 'Lạc quan', orders: 1.3, growth: 1.5, tone: 'success' }
    ],
    months: 12
  },

  /* ---------- 7. Đăng nhập (Firebase Authentication) ----------
     Cần bật Email/Password + Google trong Firebase Console → Authentication → Sign-in method,
     và thêm tên miền *.vercel.app vào Authentication → Settings → Authorized domains.  */
  auth: {
    enabled: true,                // false = bỏ hẳn đăng nhập
    required: true,               // true = phải đăng nhập (hoặc dùng thử) mới vào app
    email: true,                  // đăng nhập bằng email + mật khẩu (có đăng ký, quên mật khẩu)
    google: true,                 // nút "Tiếp tục với Google"
    allowGuest: true,             // nút "Dùng thử không cần tài khoản" – dự phòng khi mạng/Firebase lỗi, giám khảo vào nhanh
    welcome: 'Đăng nhập để quản lý cửa hàng của bạn.',
    /* Cột giới thiệu bên trái màn hình đăng nhập (chỉ hiện trên máy tính) – SỬA theo đề */
    headline: 'Quản lý cửa hàng gọn trong một màn hình',
    features: [
      { icon: 'list', text: 'Theo dõi sản phẩm và tồn kho' },
      { icon: 'trending', text: 'Xem doanh thu, lợi nhuận theo kịch bản' },
      { icon: 'camera', text: 'Quét mã QR để tra cứu nhanh' }
    ]
  },

  /* ---------- 8. Đồng bộ Firebase (tùy chọn) ---------- */
  firebase: {
    enabled: false,               // bật true + thêm <script type="module" src="js/firebase.js"> trong index.html
    collection: 'items'
  }
};
