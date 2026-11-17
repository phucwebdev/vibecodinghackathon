/* DỮ LIỆU MẪU – Ban tổ chức Vibe Coding cung cấp (Bảng Kỹ thuật).
   Nguồn: Du_lieu_mau_Vibe_Coding_bangA.xlsx – sheet KT_ThanhVien, KT_GiaoDich, KT_UuDai, KT_LichSuDiem.
   Điểm hiện tại ĐÃ gồm giao dịch mẫu → khi nạp không cộng lại. Tên, số điện thoại là hư cấu. */
window.SEED = {
  members: [
    { id: 'KT-001', name: 'An Nguyễn', phone: '0900001001', points: 250, joined: '2026-09-05' },
    { id: 'KT-002', name: 'Bình Trần', phone: '0900001002', points: 1450, joined: '2026-08-17' },
    { id: 'KT-003', name: 'Chi Lê', phone: '0900001003', points: 800, joined: '2026-07-22' },
    { id: 'KT-004', name: 'Dũng Phạm', phone: '0900001004', points: 3200, joined: '2026-06-14' },
    { id: 'KT-005', name: 'Hà Võ', phone: '0900001005', points: 5800, joined: '2026-04-09' },
    { id: 'KT-006', name: 'Minh Đỗ', phone: '0900001006', points: 12500, joined: '2026-02-28' },
    { id: 'KT-007', name: 'Ngọc Bùi', phone: '0900001007', points: 4700, joined: '2026-03-11' },
    { id: 'KT-008', name: 'Phúc Hoàng', phone: '0900001008', points: 0, joined: '2026-10-10' }
  ],
  txs: [
    { id: 'TX-KT-001', type: 'earn', memberId: 'KT-001', time: '2026-10-03T09:15', amount: 500000, points: 50, balance: 250 },
    { id: 'TX-KT-002', type: 'earn', memberId: 'KT-002', time: '2026-10-04T11:40', amount: 1500000, points: 150, balance: 1450 },
    { id: 'TX-KT-003', type: 'redeem', memberId: 'KT-003', time: '2026-10-05T14:05', amount: 0, points: -200, balance: 800, note: 'Đổi ưu đãi' },
    { id: 'TX-KT-004', type: 'earn', memberId: 'KT-004', time: '2026-10-06T18:20', amount: 2000000, points: 200, balance: 3200 },
    { id: 'TX-KT-005', type: 'earn', memberId: 'KT-005', time: '2026-10-08T10:30', amount: 8000000, points: 800, balance: 5800 },
    { id: 'TX-KT-006', type: 'earn', memberId: 'KT-006', time: '2026-10-09T16:10', amount: 5000000, points: 500, balance: 12500 },
    { id: 'TX-KT-007', type: 'earn', memberId: 'KT-007', time: '2026-10-11T12:55', amount: 7000000, points: 700, balance: 4700 }
  ],
  rewards: [
    { id: 'KT-VCH-01', name: 'Voucher 20.000đ', desc: 'Giảm giá đơn hàng', cost: 500 },
    { id: 'KT-VCH-02', name: 'Voucher 50.000đ', desc: 'Giảm giá đơn hàng', cost: 1100 },
    { id: 'KT-VCH-03', name: 'Quà tặng đặc biệt', desc: 'Quà tặng mô phỏng', cost: 2000 }
  ]
};
