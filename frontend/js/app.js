/* THẺ THÀNH VIÊN 2 ĐẦU (Thành viên & Quầy)
 * Toàn bộ dữ liệu lưu localStorage → chạy được khi mất mạng.
 * Quy tắc (công bố ở trang Thể lệ): 10.000đ = 1 điểm · Đồng < 1.000 · Bạc 1.000–4.999 · Vàng ≥ 5.000
 */
(function () {
  'use strict';
  var esc = UI.esc, icon = UI.icon, num = UI.number;

  /* ---------- Quy tắc ---------- */
  var RULES = {
    vndPerPoint: 10000,
    tiers: [
      { key: 'dong', name: 'Đồng', min: 0, color: '#9A5B2E' },
      { key: 'bac', name: 'Bạc', min: 1000, color: '#64748B' },
      { key: 'vang', name: 'Vàng', min: 5000, color: '#B7791F' }
    ]
  };
  /* 3 ưu đãi của Ban tổ chức + 2 ưu đãi đội thêm (ghi rõ ở Thể lệ). Mỗi ưu đãi có hình minh họa do đội tự vẽ. */
  var REWARDS = window.SEED.rewards.concat([
    { id: 'TV-QUA-01', name: 'Cà phê miễn phí', desc: 'Một ly cỡ vừa tùy chọn', cost: 300 },
    { id: 'TV-QUA-02', name: 'Bánh ngọt tặng kèm', desc: 'Một phần bánh trong ngày', cost: 800 }
  ]).sort(function (a, b) { return a.cost - b.cost; });
  var ART = {
    'TV-QUA-01': { c1: '#0F766E', c2: '#134E4A', svg: '<path d="M38 44h44l-5 52a6 6 0 0 1-6 5H49a6 6 0 0 1-6-5z" fill="#fff"/><path d="M40 58h40l-2 20H42z" fill="#F59E0B"/><rect x="34" y="36" width="52" height="9" rx="4.5" fill="#fff"/><path d="M52 28c-4-5 4-8 0-13M66 28c-4-5 4-8 0-13" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".8"/>' },
    'KT-VCH-01': { c1: '#2563EB', c2: '#1E3A8A', svg: '<rect x="20" y="38" width="80" height="44" rx="8" fill="#fff"/><circle cx="20" cy="60" r="7" fill="#1E3A8A"/><circle cx="100" cy="60" r="7" fill="#1E3A8A"/><text x="60" y="68" text-anchor="middle" font-size="22" font-weight="700" fill="#1E3A8A" font-family="inherit">20K</text>' },
    'TV-QUA-02': { c1: '#DB2777', c2: '#831843', svg: '<path d="M26 84 60 40l34 44z" fill="#fff"/><path d="M26 84h68v10a4 4 0 0 1-4 4H30a4 4 0 0 1-4-4z" fill="#FBCFE8"/><path d="M38 70h44" stroke="#F472B6" stroke-width="5" stroke-linecap="round"/><circle cx="60" cy="32" r="8" fill="#FDE68A"/>' },
    'KT-VCH-02': { c1: '#7C3AED', c2: '#4C1D95', svg: '<rect x="20" y="38" width="80" height="44" rx="8" fill="#fff"/><circle cx="20" cy="60" r="7" fill="#4C1D95"/><circle cx="100" cy="60" r="7" fill="#4C1D95"/><text x="60" y="68" text-anchor="middle" font-size="22" font-weight="700" fill="#4C1D95" font-family="inherit">50K</text>' },
    'KT-VCH-03': { c1: '#D97706', c2: '#92400E', svg: '<rect x="30" y="52" width="60" height="44" rx="5" fill="#fff"/><rect x="24" y="40" width="72" height="16" rx="5" fill="#FEF3C7"/><rect x="54" y="40" width="12" height="56" fill="#F59E0B"/><path d="M60 40c-6-16-24-12-16-2 4 4 16 2 16 2zm0 0c6-16 24-12 16-2-4 4-16 2-16 2z" fill="#fff"/>' }
  };
  function artHtml(id) {
    var a = ART[id] || ART['KT-VCH-03'];
    return '<div class="art" style="--c1:' + a.c1 + ';--c2:' + a.c2 + '" aria-hidden="true"><svg viewBox="0 0 120 120">' + a.svg + '</svg></div>';
  }
  function titleCase(s) {
    return String(s).toLocaleLowerCase('vi').replace(/(^|[\s\-])(\S)/g, function (m, a, b) { return a + b.toLocaleUpperCase('vi'); });
  }
  function tierOf(points) {
    var t = RULES.tiers[0];
    RULES.tiers.forEach(function (x) { if (points >= x.min) t = x; });
    return t;
  }
  function nextTier(points) {
    for (var i = 0; i < RULES.tiers.length; i++) if (points < RULES.tiers[i].min) return RULES.tiers[i];
    return null;
  }

  /* ---------- Dữ liệu (localStorage) ---------- */
  var KEY = 'the-thanh-vien.v1';
  var db = UI.store.get(KEY, null) || { members: [], txs: [], wallet: [], current: null, role: 'member', seq: 0 };
  /* Vai và thẻ đang mở là của riêng từng cửa sổ → mở 2 cửa sổ (Thành viên + Quầy) cạnh nhau được */
  try {
    var ss = JSON.parse(sessionStorage.getItem(KEY + '.tab') || 'null');
    if (ss) { db.role = ss.role; db.current = ss.current; }
  } catch (e) { /* bỏ qua */ }
  function save() {
    UI.store.set(KEY, db);
    try { sessionStorage.setItem(KEY + '.tab', JSON.stringify({ role: db.role, current: db.current })); } catch (e) { /* bỏ qua */ }
  }
  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms || 80); } catch (e) { /* bỏ qua */ } }
  function normCode(s) { return String(s || '').trim().toUpperCase(); }
  function findMember(code) {
    var c = normCode(code);
    if (!c) return null;
    return db.members.filter(function (m) { return m.id === c || m.phone === c; })[0] || null;
  }
  function currentMember() { return db.current ? findMember(db.current) : null; }
  function txExists(code) { var c = normCode(code); return db.txs.some(function (t) { return t.id === c; }); }
  function nowIso() { return new Date().toISOString(); }
  function fmtTime(s) {
    var d = new Date(s);
    if (isNaN(d)) return '';
    function p(n) { return ('0' + n).slice(-2); }
    return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }
  function newMemberId() {
    var id;
    do { db.seq += 1; id = 'TV-' + ('000' + db.seq).slice(-4); } while (findMember(id));
    return id;
  }
  function suggestTx() {
    var d = new Date();
    function p(n) { return ('0' + n).slice(-2); }
    return 'GD-' + p(d.getDate()) + p(d.getMonth() + 1) + '-' + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  /* ---------- Nghiệp vụ ---------- */
  function register(name, phone) {
    name = titleCase(String(name || '').trim().replace(/\s+/g, ' '));
    phone = String(phone || '').replace(/[\s.\-]/g, '');
    if (name.length < 2) return { error: 'Vui lòng nhập họ tên (ít nhất 2 ký tự).', field: 'name' };
    if (!/^0\d{9}$/.test(phone)) return { error: 'Số điện thoại gồm 10 chữ số, bắt đầu bằng 0.', field: 'phone' };
    if (db.members.some(function (m) { return m.phone === phone; })) return { error: 'Số điện thoại này đã có thẻ. Hãy mở thẻ bằng số điện thoại ở bên dưới.', field: 'phone' };
    var m = { id: newMemberId(), name: name, phone: phone, points: 0, joined: nowIso() };
    db.members.push(m); db.current = m.id; save();
    return { member: m };
  }
  function earn(memberCode, amount, txCode) {
    var m = findMember(memberCode);
    if (!m) return { error: 'Không tìm thấy thành viên có mã này.', field: 'member' };
    amount = Math.floor(Number(amount));
    if (!(amount > 0)) return { error: 'Vui lòng nhập số tiền giao dịch lớn hơn 0.', field: 'amount' };
    var code = normCode(txCode);
    if (!code) return { error: 'Vui lòng nhập mã giao dịch.', field: 'tx' };
    if (txExists(code)) return { error: 'Mã giao dịch ' + code + ' đã được cộng điểm trước đó. Không cộng lại.', field: 'tx', duplicate: true };
    var pts = Math.floor(amount / RULES.vndPerPoint);
    if (pts < 1) return { error: 'Giao dịch dưới ' + num(RULES.vndPerPoint) + 'đ chưa đủ để cộng điểm.', field: 'amount' };
    var before = tierOf(m.points);
    m.points += pts;
    var after = tierOf(m.points);
    db.txs.push({ id: code, type: 'earn', memberId: m.id, time: nowIso(), amount: amount, points: pts, balance: m.points });
    save();
    return { member: m, points: pts, tierUp: after.key !== before.key ? after : null };
  }
  function redeem(rewardId) {
    var m = currentMember();
    var r = REWARDS.filter(function (x) { return x.id === rewardId; })[0];
    if (!m || !r) return { error: 'Không thực hiện được. Vui lòng thử lại.' };
    if (m.points < r.cost) return { error: 'Bạn cần thêm ' + num(r.cost - m.points) + ' điểm để đổi ưu đãi này.' };
    m.points -= r.cost;
    var id = 'DOI-' + Date.now().toString(36).toUpperCase();
    db.txs.push({ id: id, type: 'redeem', memberId: m.id, time: nowIso(), amount: 0, points: -r.cost, balance: m.points, note: r.name });
    db.wallet.push({ id: 'VC-' + Math.random().toString(36).slice(2, 8).toUpperCase(), memberId: m.id, rewardId: r.id, name: r.name, desc: r.desc, time: nowIso() });
    save();
    return { reward: r, member: m };
  }
  function findVoucher(code) {
    var c = normCode(code);
    return db.wallet.filter(function (w) { return w.id === c; })[0] || null;
  }
  function useVoucher(code) {
    var w = findVoucher(code);
    if (!w) return { error: 'Không tìm thấy ưu đãi có mã này.' };
    if (w.used) return { error: 'Ưu đãi này đã dùng lúc ' + fmtTime(w.used) + '. Không dùng lại được.' };
    w.used = nowIso(); save();
    return { voucher: w };
  }
  function loadSample() {
    var S = window.SEED;
    S.members.forEach(function (sm) {
      var m = db.members.filter(function (x) { return x.id === sm.id; })[0];
      if (m) { m.name = sm.name; m.phone = sm.phone; m.points = sm.points; m.joined = sm.joined; }
      else db.members.push(JSON.parse(JSON.stringify(sm)));
    });
    /* bỏ giao dịch cũ của các thành viên mẫu để điểm khớp đúng file BTC, rồi nạp sổ mẫu (không cộng điểm lại) */
    var ids = S.members.map(function (m) { return m.id; });
    db.txs = db.txs.filter(function (t) { return ids.indexOf(t.memberId) < 0; });
    db.wallet = db.wallet.filter(function (w) { return ids.indexOf(w.memberId) < 0; });
    S.txs.forEach(function (t) { db.txs.push(JSON.parse(JSON.stringify(t))); });
    db.current = 'KT-004';
    save();
  }

  /* ---------- Thành phần giao diện ---------- */
  function qrSvg(text) {
    try {
      var q = window.qrcode(0, 'M'); q.addData(text); q.make();
      return q.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
    } catch (e) { return ''; }
  }
  function cardHtml(m) {
    var t = tierOf(m.points);
    return '<div class="mcard tier-' + t.key + '" aria-label="Thẻ thành viên hạng ' + t.name + '">' +
      '<div class="mcard-pattern" aria-hidden="true"></div><div class="mcard-shine" aria-hidden="true"></div>' +
      '<div class="mcard-top"><span class="mcard-brand">' + icon('card', 18) + 'Thẻ thành viên</span><span class="tier-badge">' + icon('star', 16) + 'Hạng ' + t.name + '</span></div>' +
      '<div><div class="mcard-name">' + esc(m.name) + '</div><div class="mcard-label">Điểm hiện có</div><div class="mcard-points" data-points="' + m.points + '">' + num(m.points) + '</div></div>' +
      '<div class="mcard-body"><div><div class="mcard-label">Mã thành viên</div><div class="mcard-code">' + esc(m.id) + '</div></div>' +
      '<div class="mcard-qr" role="img" aria-label="Mã QR của thẻ ' + esc(m.id) + '">' + qrSvg(m.id) + '</div></div>' +
    '</div>';
  }
  function progressHtml(m) {
    var n = nextTier(m.points);
    if (!n) return '<p class="small muted" style="text-align:center">Bạn đang ở hạng cao nhất. Cảm ơn bạn đã gắn bó!</p>';
    var cur = tierOf(m.points), pct = Math.round((m.points - cur.min) / (n.min - cur.min) * 100);
    return '<div class="stack" style="gap:8px"><div class="row" style="justify-content:space-between"><span class="small">Còn <strong>' + num(n.min - m.points) + ' điểm</strong> nữa lên hạng ' + n.name + '</span><span class="small muted">' + pct + '%</span></div>' +
      '<div class="progress" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div></div>';
  }
  function emptyHtml(ic, title, text, btn) {
    return '<div class="empty"><div class="empty-icon">' + icon(ic) + '</div><p class="empty-title">' + title + '</p><p class="empty-text">' + text + '</p>' + (btn || '') + '</div>';
  }
  function needMember() {
    return emptyHtml('card', 'Bạn chưa mở thẻ', 'Đăng ký thẻ thành viên để tích điểm và đổi ưu đãi.', '<a class="btn btn-primary" href="#/the">Đăng ký thẻ</a>');
  }
  function txRow(t, showMember) {
    var earnT = t.type === 'earn';
    var m = showMember ? findMember(t.memberId) : null;
    return '<div class="item"><div class="item-main"><div class="item-title">' + (earnT ? 'Cộng điểm' : 'Đổi điểm') +
      (t.note ? ' · ' + esc(t.note) : '') + (m ? ' · ' + esc(m.name) : '') + '</div>' +
      '<div class="item-sub">' + fmtTime(t.time) + ' · Mã ' + esc(t.id) + (earnT && t.amount ? ' · ' + UI.money(t.amount) : '') + '</div></div>' +
      '<div class="item-meta" style="text-align:right"><div class="' + (earnT ? 'pts-plus' : 'pts-minus') + '">' + (t.points > 0 ? '+' : '−') + num(Math.abs(t.points)) + '</div>' +
      '<div class="small muted">Còn ' + num(t.balance) + '</div></div></div>';
  }
  function fieldError(form, name, msg) {
    form.querySelectorAll('.field-error').forEach(function (e) { e.remove(); });
    form.querySelectorAll('.is-invalid').forEach(function (e) { e.classList.remove('is-invalid'); e.removeAttribute('aria-invalid'); });
    if (!msg) return;
    var input = form.querySelector('[name="' + name + '"]');
    if (!input) { UI.toast(msg, 'error'); return; }
    input.classList.add('is-invalid'); input.setAttribute('aria-invalid', 'true');
    var p = document.createElement('p'); p.className = 'field-error'; p.setAttribute('role', 'alert'); p.textContent = msg;
    (input.closest('.field') || input.parentNode).appendChild(p);
    input.focus();
  }

  /* ---------- TRANG: Thẻ của tôi (Thành viên) ---------- */
  function pageCard() {
    var m = currentMember();
    if (m) {
      return '<div class="narrow stack"><div><p class="eyebrow muted">Xin chào</p><h2 class="h2">' + esc(m.name) + '</h2></div>' + cardHtml(m) + progressHtml(m) +
        '<div class="grid-2"><a class="btn btn-primary" href="#/uu-dai">' + icon('gift') + 'Đổi ưu đãi</a>' +
        '<a class="btn btn-secondary" href="#/lich-su">' + icon('clock') + 'Lịch sử điểm</a></div>' +
        '<p class="small muted" style="text-align:center">Đưa mã QR hoặc đọc mã thành viên cho nhân viên tại quầy để tích điểm.</p>' +
        '<button type="button" class="btn btn-text" data-action="leave">Mở thẻ khác</button></div>';
    }
    return '<div class="narrow stack">' +
      '<div class="page-head"><div><h2 class="h2">Đăng ký thẻ thành viên</h2><p class="muted">Tích điểm mỗi lần mua hàng, đổi điểm lấy ưu đãi.</p></div></div>' +
      '<form class="card stack" id="f-register" novalidate>' +
        '<div class="field"><label for="r-name">Họ và tên</label><input class="input" id="r-name" name="name" autocomplete="name" placeholder="VD: Nguyễn Minh An"></div>' +
        '<div class="field"><label for="r-phone">Số điện thoại</label><input class="input" id="r-phone" name="phone" inputmode="numeric" autocomplete="tel" placeholder="VD: 0912345678"></div>' +
        '<button class="btn btn-primary btn-block" type="submit">Đăng ký thẻ</button>' +
      '</form>' +
      '<form class="card stack" id="f-open" novalidate>' +
        '<div class="field"><label for="o-code">Đã có thẻ? Nhập mã thành viên hoặc số điện thoại</label>' +
        '<div class="input-row"><input class="input" id="o-code" name="code" placeholder="VD: KT-004" autocapitalize="characters"><button class="btn btn-secondary" type="submit">Mở thẻ</button></div></div>' +
      '</form>' +
      '<button type="button" class="btn btn-text" data-action="sample">' + icon('download') + 'Nạp dữ liệu mẫu của Ban tổ chức</button>' +
    '</div>';
  }

  /* ---------- TRANG: Ưu đãi + ví ---------- */
  function pageRewards() {
    var m = currentMember();
    if (!m) return needMember();
    var mine = db.wallet.filter(function (w) { return w.memberId === m.id; }).reverse();
    return '<div class="narrow stack">' +
      '<div class="member-mini"><div><div class="small muted">Điểm hiện có</div><div class="h3">' + num(m.points) + ' điểm</div></div><span class="badge badge-neutral">Hạng ' + tierOf(m.points).name + '</span></div>' +
      '<div class="section-head"><h2 class="h4">Đổi điểm lấy ưu đãi</h2></div>' +
      '<div class="rw-grid">' + REWARDS.map(function (r) {
        var ok = m.points >= r.cost;
        return '<div class="rw' + (ok ? '' : ' is-locked') + '">' + artHtml(r.id) +
          '<div class="rw-body"><div class="item-title">' + esc(r.name) + '</div><div class="small muted">' + esc(r.desc) + '</div>' +
          '<div class="rw-foot"><span class="rw-cost">' + icon('star', 14) + num(r.cost) + ' điểm</span>' +
          '<button type="button" class="btn btn-sm ' + (ok ? 'btn-primary' : 'btn-secondary') + '" data-action="redeem" data-id="' + r.id + '">' + (ok ? 'Đổi' : 'Thiếu ' + num(r.cost - m.points)) + '</button></div></div></div>';
      }).join('') + '</div>' +
      '<div class="section-head"><h2 class="h4">Ví ưu đãi của tôi</h2><span class="badge badge-neutral">' + mine.length + '</span></div>' +
      (mine.length ? '<div class="stack" style="gap:8px">' + mine.map(function (w) {
        return '<div class="voucher ticket' + (w.used ? ' is-used' : '') + '">' + artHtml(w.rewardId) + '<div class="voucher-main"><div class="item-title">' + esc(w.name) + '</div>' +
          '<div class="small muted">' + esc(w.desc || '') + ' · Đổi lúc ' + fmtTime(w.time) + '</div>' +
          '<div class="row" style="gap:8px;margin-top:6px"><span class="badge ' + (w.used ? 'badge-neutral' : 'badge-success') + '">' + (w.used ? 'Đã dùng ' + fmtTime(w.used) : 'Chưa dùng') + '</span><code>' + esc(w.id) + '</code></div>' +
          (w.used ? '' : '<details class="voucher-qr"><summary>Hiện mã QR để dùng tại quầy</summary><div class="mcard-qr" role="img" aria-label="Mã QR ưu đãi ' + esc(w.id) + '">' + qrSvg(w.id) + '</div></details>') +
          '</div></div>';
      }).join('') + '</div>' : emptyHtml('gift', 'Ví chưa có ưu đãi', 'Đổi điểm ở danh sách phía trên, ưu đãi sẽ nằm ở đây.')) +
    '</div>';
  }

  /* ---------- TRANG: Lịch sử ---------- */
  function pageHistory() {
    var m = currentMember();
    if (!m) return needMember();
    var list = db.txs.filter(function (t) { return t.memberId === m.id; }).sort(function (a, b) { return a.time < b.time ? 1 : -1; });
    return '<div class="narrow stack"><div class="page-head"><div><h2 class="h2">Lịch sử điểm</h2><p class="muted">' + esc(m.name) + ' · ' + esc(m.id) + '</p></div></div>' +
      (list.length ? '<div class="list">' + list.map(function (t) { return txRow(t); }).join('') + '</div>'
        : emptyHtml('clock', 'Chưa có biến động điểm', 'Mua hàng và đọc mã thành viên tại quầy để được cộng điểm.')) + '</div>';
  }

  /* ---------- TRANG: Quầy – cộng điểm ---------- */
  var lastResult = null, scanner = null, prefill = '';
  function memberMini(code) {
    var m = findMember(code);
    if (!normCode(code)) return '';
    if (!m) return '<p class="small muted">Chưa tìm thấy thành viên có mã này.</p>';
    return '<div class="member-mini"><div><div class="item-title">' + esc(m.name) + '</div><div class="small muted">' + esc(m.id) + ' · ' + esc(m.phone) + '</div></div>' +
      '<div style="text-align:right"><div class="h4">' + num(m.points) + ' điểm</div><span class="badge badge-neutral">Hạng ' + tierOf(m.points).name + '</span></div></div>';
  }
  function resultHtml(r) {
    var t = tierOf(r.member.points);
    var confetti = '';
    if (r.tierUp) {
      var colors = ['#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'];
      for (var i = 0; i < 24; i++) confetti += '<i style="left:' + (i * 4.2) + '%;background:' + colors[i % 5] + ';animation-delay:' + (i % 6) * 80 + 'ms"></i>';
      confetti = '<div class="confetti" aria-hidden="true">' + confetti + '</div>';
    }
    return '<div class="result" role="status">' + confetti +
      '<div class="small muted">Đã cộng cho ' + esc(r.member.name) + ' (' + esc(r.member.id) + ')</div>' +
      '<div class="result-points">+' + num(r.points) + ' điểm</div>' +
      '<div>Số dư mới: <strong>' + num(r.member.points) + ' điểm</strong> · Hạng ' + t.name + '</div>' +
      (r.tierUp ? '<div class="tierup" style="background:' + r.tierUp.color + '">' + icon('star', 18) + 'Lên hạng ' + r.tierUp.name + '!</div>' : '') +
    '</div>';
  }
  function pageCounter() {
    var code = prefill; prefill = '';
    return '<div class="narrow stack">' +
      '<div class="page-head"><div><h2 class="h2">Cộng điểm tại quầy</h2><p class="muted">' + num(RULES.vndPerPoint) + 'đ = 1 điểm. Mỗi mã giao dịch chỉ cộng một lần.</p></div></div>' +
      '<div id="counter-result">' + (lastResult ? resultHtml(lastResult) : '') + '</div>' +
      '<form class="card stack" id="f-earn" novalidate>' +
        '<div class="field"><label for="e-member">Mã thành viên</label>' +
          '<div class="input-row"><input class="input" id="e-member" name="member" placeholder="VD: KT-004" autocapitalize="characters" autocomplete="off" value="' + esc(code) + '">' +
          '<button type="button" class="btn btn-secondary" data-action="scan">' + icon('qr') + 'Quét QR</button></div></div>' +
        '<div id="scan-box" hidden class="stack" style="gap:8px"><div id="qr-reader"></div>' +
          '<div class="row" style="justify-content:center;gap:8px"><label class="btn btn-secondary btn-sm">' + icon('upload', 16) + 'Chọn ảnh QR<input type="file" accept="image/*" id="qr-file" hidden></label>' +
          '<button type="button" class="btn btn-text btn-sm" data-action="scan-stop">Đóng máy quét</button></div></div>' +
        '<div id="member-mini">' + memberMini(code) + '</div>' +
        '<div class="field"><label for="e-amount">Số tiền giao dịch (đ)</label><input class="input" id="e-amount" name="amount" inputmode="numeric" placeholder="VD: 1.000.000" autocomplete="off">' +
          '<p class="field-hint" id="pts-preview">Nhập số tiền để xem số điểm sẽ cộng.</p></div>' +
        '<div class="field"><label for="e-tx">Mã giao dịch</label><input class="input" id="e-tx" name="tx" autocapitalize="characters" autocomplete="off" value="' + suggestTx() + '">' +
          '<p class="field-hint">Mã trên hóa đơn. Có thể sửa mã gợi ý sẵn.</p></div>' +
        '<button class="btn btn-primary btn-block" type="submit">' + icon('plus-circle') + 'Cộng điểm</button>' +
      '</form></div>';
  }
  var lastUsed = null;
  function voucherMini(code) {
    if (!normCode(code)) return '';
    var w = findVoucher(code);
    if (!w) return '<p class="small muted">Chưa tìm thấy ưu đãi có mã này.</p>';
    var m = findMember(w.memberId);
    return '<div class="member-mini"><div><div class="item-title">' + esc(w.name) + '</div><div class="small muted">' + (m ? esc(m.name) + ' · ' + esc(m.id) : '') + '</div></div>' +
      '<span class="badge ' + (w.used ? 'badge-danger' : 'badge-success') + '">' + (w.used ? 'Đã dùng' : 'Dùng được') + '</span></div>';
  }
  function pageUse() {
    return '<div class="narrow stack">' +
      '<div class="page-head"><div><h2 class="h2">Dùng ưu đãi tại quầy</h2><p class="muted">Quét mã QR trong ví của khách hoặc nhập mã ưu đãi. Mỗi ưu đãi chỉ dùng một lần.</p></div></div>' +
      (lastUsed ? '<div class="result" role="status"><div class="small muted">Đã xác nhận cho khách</div><div class="result-points" style="font-size:1.5rem">' + esc(lastUsed.name) + '</div><div>Mã ' + esc(lastUsed.id) + ' · dùng lúc ' + fmtTime(lastUsed.used) + '</div></div>' : '') +
      '<form class="card stack" id="f-use" novalidate>' +
        '<div class="field"><label for="v-code">Mã ưu đãi</label>' +
          '<div class="input-row"><input class="input" id="v-code" name="code" placeholder="VD: VC-AB12CD" autocapitalize="characters" autocomplete="off">' +
          '<button type="button" class="btn btn-secondary" data-action="scan">' + icon('qr') + 'Quét QR</button></div></div>' +
        '<div id="scan-box" hidden class="stack" style="gap:8px"><div id="qr-reader"></div>' +
          '<div class="row" style="justify-content:center;gap:8px"><label class="btn btn-secondary btn-sm">' + icon('upload', 16) + 'Chọn ảnh QR<input type="file" accept="image/*" id="qr-file" hidden></label>' +
          '<button type="button" class="btn btn-text btn-sm" data-action="scan-stop">Đóng máy quét</button></div></div>' +
        '<div id="voucher-mini"></div>' +
        '<button class="btn btn-primary btn-block" type="submit">' + icon('check-circle') + 'Xác nhận đã dùng</button>' +
      '</form></div>';
  }
  function stopScan() {
    var s = scanner; scanner = null;
    if (s) { try { s.stop().then(function () { s.clear(); }).catch(function () {}); } catch (e) { /* bỏ qua */ } }
    var box = document.getElementById('scan-box'); if (box) box.hidden = true;
  }
  function onScanned(text) {
    var code = normCode(text);
    stopScan(); buzz(80);
    var vInput = document.getElementById('v-code');
    if (vInput) {
      vInput.value = code; document.getElementById('voucher-mini').innerHTML = voucherMini(code);
      UI.toast(findVoucher(code) ? 'Đã đọc mã ưu đãi ' + code : 'Mã ' + code + ' không phải mã ưu đãi', findVoucher(code) ? 'success' : 'error');
      return;
    }
    var input = document.getElementById('e-member');
    if (input) { input.value = code; document.getElementById('member-mini').innerHTML = memberMini(code); }
    var m = findMember(code);
    UI.toast(m ? 'Đã đọc mã ' + code + ' – ' + m.name : 'Đã đọc mã ' + code + ' nhưng chưa có thành viên này', m ? 'success' : 'error');
    var amount = document.getElementById('e-amount'); if (m && amount) amount.focus();
  }
  function startScan() {
    var box = document.getElementById('scan-box');
    if (!box) return;
    box.hidden = false;
    if (!window.Html5Qrcode) { UI.toast('Không mở được máy quét. Hãy nhập mã thành viên bằng tay.', 'error'); return; }
    if (scanner) return;
    scanner = new window.Html5Qrcode('qr-reader');
    scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, onScanned, function () {})
      .catch(function () {
        scanner = null;
        UI.toast('Không dùng được camera. Hãy cấp quyền camera, chọn ảnh QR hoặc nhập mã bằng tay.', 'error');
      });
  }
  function scanFile(file) {
    if (!file || !window.Html5Qrcode) return;
    var live = scanner; scanner = null;
    var run = function () {
      var s = new window.Html5Qrcode('qr-reader');
      s.scanFile(file, false).then(function (text) { s.clear(); onScanned(text); })
        .catch(function () { UI.toast('Không đọc được mã QR trong ảnh. Hãy thử ảnh rõ hơn.', 'error'); });
    };
    if (live) live.stop().then(function () { live.clear(); run(); }).catch(run); else run();
  }

  /* ---------- TRANG: Quầy – thành viên & thống kê ---------- */
  var memberQuery = '';
  function membersListHtml() {
    var list = db.members.filter(function (m) { return UI.match(memberQuery, m.name + ' ' + m.id + ' ' + m.phone); })
      .sort(function (a, b) { return b.points - a.points; });
    if (!list.length) return emptyHtml('users', memberQuery ? 'Không tìm thấy thành viên' : 'Chưa có thành viên', memberQuery ? 'Thử tìm bằng tên, mã hoặc số điện thoại khác.' : 'Nạp dữ liệu mẫu ở trang Thể lệ hoặc đăng ký thẻ ở chế độ Thành viên.');
    return '<div class="list">' + list.map(function (m) {
      var t = tierOf(m.points);
      return '<button type="button" class="item item-link" data-action="pick" data-id="' + esc(m.id) + '" style="width:100%;text-align:left">' +
        '<div class="item-main"><div class="item-title">' + esc(m.name) + '</div><div class="item-sub">' + esc(m.id) + ' · ' + esc(m.phone) + '</div></div>' +
        '<div class="item-meta" style="text-align:right"><div><strong>' + num(m.points) + '</strong> điểm</div><span class="small"><span class="dot" style="background:' + t.color + '"></span>' + t.name + '</span></div></button>';
    }).join('') + '</div>';
  }
  function pageMembers() {
    var issued = db.txs.reduce(function (s, t) { return s + (t.type === 'earn' ? t.points : 0); }, 0);
    var recent = db.txs.slice().sort(function (a, b) { return a.time < b.time ? 1 : -1; }).slice(0, 5);
    return '<div class="stack">' +
      '<div class="stat-grid">' +
        '<div class="stat"><div class="stat-value">' + num(db.members.length) + '</div><div class="stat-label">Thành viên</div></div>' +
        '<div class="stat"><div class="stat-value">' + num(issued) + '</div><div class="stat-label">Điểm đã phát</div></div>' +
        '<div class="stat"><div class="stat-value">' + num(db.wallet.length) + '</div><div class="stat-label">Ưu đãi đã đổi</div></div>' +
      '</div>' +
      '<div class="field"><label for="m-q" class="sr-only">Tìm thành viên</label><input class="input" id="m-q" type="search" placeholder="Tìm theo tên, mã hoặc số điện thoại" value="' + esc(memberQuery) + '"></div>' +
      '<div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap"><p class="small muted">Chạm vào một thành viên để cộng điểm.</p>' +
        '<button type="button" class="btn btn-secondary btn-sm" data-action="export">' + icon('download', 16) + 'Xuất Excel</button></div>' +
      '<div id="members-list">' + membersListHtml() + '</div>' +
      (recent.length ? '<div class="section-head"><h2 class="h4">Giao dịch gần đây</h2></div><div class="list">' + recent.map(function (t) { return txRow(t, true); }).join('') + '</div>' : '') +
    '</div>';
  }

  /* Xuất toàn bộ dữ liệu ra tệp Excel (3 trang tính) để chủ quán quản lý */
  function exportExcel() {
    if (!window.XLSX) { UI.toast('Chưa tải được công cụ xuất Excel. Vui lòng tải lại trang.', 'error'); return; }
    if (!db.members.length) { UI.toast('Chưa có dữ liệu để xuất. Hãy nạp dữ liệu mẫu trước.', 'error'); return; }
    var X = window.XLSX, wb = X.utils.book_new();
    function sheet(name, rows, widths) {
      var ws = rows.length ? X.utils.json_to_sheet(rows) : X.utils.aoa_to_sheet([['Chưa có dữ liệu']]);
      ws['!cols'] = widths.map(function (w) { return { wch: w }; });
      X.utils.book_append_sheet(wb, ws, name);
    }
    sheet('ThanhVien', db.members.slice().sort(function (a, b) { return b.points - a.points; }).map(function (m) {
      return { 'Mã thành viên': m.id, 'Họ tên': m.name, 'Số điện thoại': m.phone, 'Điểm hiện có': m.points, 'Hạng': tierOf(m.points).name, 'Ngày tham gia': fmtTime(m.joined).slice(0, 10) };
    }), [16, 24, 16, 14, 10, 14]);
    sheet('LichSuDiem', db.txs.slice().sort(function (a, b) { return a.time < b.time ? 1 : -1; }).map(function (t) {
      var m = findMember(t.memberId);
      return { 'Mã giao dịch': t.id, 'Loại': t.type === 'earn' ? 'Cộng điểm' : 'Đổi điểm', 'Mã thành viên': t.memberId, 'Họ tên': m ? m.name : '', 'Thời gian': fmtTime(t.time), 'Giá trị giao dịch (đ)': t.amount || 0, 'Thay đổi điểm': t.points, 'Số dư sau': t.balance, 'Ghi chú': t.note || '' };
    }), [18, 12, 16, 24, 18, 20, 14, 12, 22]);
    sheet('UuDaiDaDoi', db.wallet.map(function (w) {
      var m = findMember(w.memberId);
      return { 'Mã ưu đãi': w.id, 'Tên ưu đãi': w.name, 'Mã thành viên': w.memberId, 'Họ tên': m ? m.name : '', 'Đổi lúc': fmtTime(w.time), 'Trạng thái': w.used ? 'Đã dùng' : 'Chưa dùng', 'Dùng lúc': w.used ? fmtTime(w.used) : '' };
    }), [14, 22, 16, 24, 18, 12, 18]);
    var d = new Date();
    function p2(n) { return ('0' + n).slice(-2); }
    var file = 'the-thanh-vien-' + d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()) + '-' + p2(d.getHours()) + p2(d.getMinutes()) + '.xlsx';
    try { X.writeFile(wb, file); UI.toast('Đã xuất tệp ' + file, 'success'); }
    catch (e) { UI.toast('Không xuất được tệp. Vui lòng thử lại.', 'error'); }
  }

  /* ---------- TRANG: Thể lệ ---------- */
  function pageRules() {
    var T = RULES.tiers;
    return '<div class="narrow stack">' +
      '<div class="card stack"><h2 class="h4">Cách tích điểm</h2><p>Mỗi <strong>' + num(RULES.vndPerPoint) + 'đ</strong> trên hóa đơn = <strong>1 điểm</strong> (làm tròn xuống). Nhân viên cộng điểm tại quầy bằng mã thành viên và mã giao dịch. Mỗi mã giao dịch chỉ được cộng một lần.</p></div>' +
      '<div class="card stack"><h2 class="h4">Hạng thành viên</h2><p class="small muted">Hạng tự đổi theo số điểm hiện có, thẻ đổi màu theo hạng.</p>' +
        '<div class="tier-gallery">' + T.map(function (t) {
          return '<div class="mcard mini tier-' + t.key + '"><div class="mcard-pattern" aria-hidden="true"></div><div class="mcard-top"><span class="mcard-brand">' + icon('card', 14) + 'Thẻ</span></div><div class="mcard-name">' + t.name + '</div></div>';
        }).join('') + '</div>' +
        '<table class="rule-table"><tr><th>Hạng</th><th>Mốc điểm</th></tr>' +
        '<tr><td><span class="dot" style="background:' + T[0].color + '"></span>Đồng</td><td>Dưới ' + num(T[1].min) + ' điểm</td></tr>' +
        '<tr><td><span class="dot" style="background:' + T[1].color + '"></span>Bạc</td><td>Từ ' + num(T[1].min) + ' đến ' + num(T[2].min - 1) + ' điểm</td></tr>' +
        '<tr><td><span class="dot" style="background:' + T[2].color + '"></span>Vàng</td><td>Từ ' + num(T[2].min) + ' điểm trở lên</td></tr></table></div>' +
      '<div class="card stack"><h2 class="h4">Đổi điểm lấy ưu đãi</h2><table class="rule-table"><tr><th>Ưu đãi</th><th>Điểm cần đổi</th></tr>' +
        REWARDS.map(function (r) { return '<tr><td>' + esc(r.name) + '</td><td>' + num(r.cost) + ' điểm</td></tr>'; }).join('') + '</table>' +
        '<p class="small muted">Điểm bị trừ ngay khi đổi; ưu đãi nằm trong Ví ưu đãi của thành viên. Ba mức voucher và quà tặng lấy từ bộ dữ liệu của Ban tổ chức; hai mức còn lại do đội bổ sung (dữ liệu mô phỏng).</p></div>' +
      '<div class="card stack"><h2 class="h4">Dữ liệu mẫu</h2><p class="small muted">Nạp 8 thành viên, 7 giao dịch và 3 ưu đãi do Ban tổ chức cung cấp. Điểm của thành viên mẫu trở về đúng số trong bộ dữ liệu; thẻ bạn tự đăng ký được giữ nguyên. Dữ liệu lưu trên máy này và dùng được khi mất mạng.</p>' +
        '<button type="button" class="btn btn-primary" data-action="sample">' + icon('download') + 'Nạp dữ liệu mẫu</button>' +
        '<button type="button" class="btn btn-text" data-action="reset">Xóa toàn bộ dữ liệu trên máy này</button></div>' +
    '</div>';
  }

  /* ---------- Điều hướng theo vai ---------- */
  var MENUS = {
    member: [
      { key: 'the', label: 'Thẻ', icon: 'card' },
      { key: 'uu-dai', label: 'Ưu đãi', icon: 'gift' },
      { key: 'lich-su', label: 'Lịch sử', icon: 'clock' },
      { key: 'the-le', label: 'Thể lệ', icon: 'info' }
    ],
    counter: [
      { key: 'quay', label: 'Cộng điểm', icon: 'plus-circle' },
      { key: 'dung-uu-dai', label: 'Dùng ưu đãi', icon: 'gift' },
      { key: 'thanh-vien', label: 'Thành viên', icon: 'users' },
      { key: 'the-le', label: 'Thể lệ', icon: 'info' }
    ]
  };
  function renderNav() {
    var menu = MENUS[db.role] || MENUS.member;
    document.querySelector('.sidebar-nav').innerHTML = menu.map(function (m) {
      return '<a class="side-link" href="#/' + m.key + '" data-route="' + m.key + '">' + icon(m.icon) + '<span>' + m.label + '</span></a>';
    }).join('');
    document.querySelector('.tabbar').innerHTML = menu.map(function (m) {
      return '<a class="tab" href="#/' + m.key + '" data-route="' + m.key + '"><span class="tab-pill">' + icon(m.icon, 22) + '</span><span>' + m.label + '</span></a>';
    }).join('');
    var sw = document.getElementById('role-switch');
    sw.style.setProperty('--seg-i', db.role === 'counter' ? 1 : 0);
    sw.querySelectorAll('[data-role]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-role') === db.role)); });
    var su = document.getElementById('sidebar-user');
    if (su) su.innerHTML = '<div class="small muted">Đang ở chế độ</div><strong>' + (db.role === 'counter' ? 'Quầy (nhân viên)' : 'Thành viên') + '</strong>';
  }
  function setRole(role) {
    if (db.role === role) return;
    db.role = role; save(); lastResult = null; lastUsed = null; stopScan();
    renderNav();
    var target = role === 'counter' ? 'quay' : 'the';
    if (router.current() === target) router.refresh(); else router.go(target);
  }

  document.querySelectorAll('[data-app-name]').forEach(function (e) { e.textContent = 'Thẻ thành viên'; });
  document.querySelectorAll('[data-brand-icon]').forEach(function (e) { e.innerHTML = icon('card', 20); });
  renderNav();

  function wrap(fn) { return function () { stopScan(); return fn(); }; }
  /* Thẻ: số điểm chạy từ giá trị đã thấy lần trước tới giá trị mới; lên hạng thì báo + thẻ nháy sáng */
  var seen = {};
  function animateCard(view) {
    var el = view.querySelector('.mcard-points'); var m = currentMember();
    if (!el || !m) return;
    var from = seen[m.id], to = m.points;
    seen[m.id] = to;
    if (from == null || from === to) return;
    if (tierOf(from).key !== tierOf(to).key && to > from) {
      var card = view.querySelector('.mcard'); if (card) card.classList.add('tier-flash');
      UI.toast('Chúc mừng! Bạn vừa lên hạng ' + tierOf(to).name, 'success'); buzz(200);
    }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var t0 = null, dur = 700;
    function step(ts) {
      if (t0 == null) t0 = ts;
      var k = Math.min(1, (ts - t0) / dur);
      el.textContent = num(Math.round(from + (to - from) * k));
      if (k < 1) requestAnimationFrame(step);
    }
    el.textContent = num(from); requestAnimationFrame(step);
  }
  var router = UI.router({
    appName: 'Thẻ thành viên',
    defaultRoute: db.role === 'counter' ? 'quay' : 'the',
    routes: {
      'the': { title: 'Thẻ của tôi', render: wrap(pageCard), mount: animateCard },
      'dung-uu-dai': { title: 'Dùng ưu đãi', render: wrap(pageUse) },
      'uu-dai': { title: 'Ưu đãi', render: wrap(pageRewards) },
      'lich-su': { title: 'Lịch sử điểm', render: wrap(pageHistory) },
      'quay': { title: 'Quầy', render: wrap(pageCounter) },
      'thanh-vien': { title: 'Thành viên', render: wrap(pageMembers) },
      'the-le': { title: 'Thể lệ', render: wrap(pageRules) }
    }
  });
  /* Mở trang thuộc vai khác (VD: bấm link) → tự chuyển vai cho khớp menu */
  function syncRole() {
    var k = router.current();
    var inRole = (MENUS[db.role] || []).some(function (m) { return m.key === k; });
    if (!inRole) {
      db.role = db.role === 'counter' ? 'member' : 'counter'; save(); renderNav(); router.refresh();
    }
  }
  window.addEventListener('hashchange', function () { setTimeout(syncRole, 0); });
  syncRole();

  /* ---------- Sự kiện ---------- */
  document.getElementById('role-switch').addEventListener('click', function (e) {
    var b = e.target.closest('[data-role]'); if (b) setRole(b.getAttribute('data-role'));
  });

  var view = document.getElementById('view');
  view.addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, r;
    if (f.id === 'f-register') {
      r = register(f.name.value, f.phone.value);
      if (r.error) return fieldError(f, r.field, r.error);
      UI.toast('Đã tạo thẻ ' + r.member.id + ' cho ' + r.member.name, 'success');
      router.refresh();
    } else if (f.id === 'f-open') {
      var m = findMember(f.code.value);
      if (!m) return fieldError(f, 'code', 'Không tìm thấy thẻ với mã hoặc số điện thoại này.');
      db.current = m.id; save(); router.refresh();
    } else if (f.id === 'f-use') {
      if (!normCode(f.code.value)) return fieldError(f, 'code', 'Vui lòng nhập hoặc quét mã ưu đãi.');
      r = useVoucher(f.code.value);
      if (r.error) return fieldError(f, 'code', r.error);
      lastUsed = r.voucher; buzz(80);
      UI.toast('Đã xác nhận dùng ' + r.voucher.name, 'success');
      router.refresh(); window.scrollTo(0, 0);
    } else if (f.id === 'f-earn') {
      var amount = String(f.amount.value).replace(/[^\d]/g, '');
      r = earn(f.member.value, amount, f.tx.value);
      if (r.error) { fieldError(f, r.field, r.error); if (r.duplicate) UI.toast('Mã giao dịch bị trùng – không cộng điểm', 'error'); return; }
      lastResult = r; buzz(r.tierUp ? 200 : 80);
      UI.toast('Đã cộng ' + num(r.points) + ' điểm cho ' + r.member.name + (r.tierUp ? ' – lên hạng ' + r.tierUp.name + '!' : ''), 'success');
      prefill = '';
      router.refresh();
      window.scrollTo(0, 0);
    }
  });

  view.addEventListener('input', function (e) {
    var t = e.target;
    if (t.id === 'e-member') document.getElementById('member-mini').innerHTML = memberMini(t.value);
    if (t.id === 'e-amount') {
      var raw = t.value.replace(/[^\d]/g, '');
      t.value = raw ? num(Number(raw)) : '';
      var pts = Math.floor(Number(raw) / RULES.vndPerPoint);
      document.getElementById('pts-preview').innerHTML = raw ? 'Sẽ cộng <strong>' + num(pts) + ' điểm</strong>' : 'Nhập số tiền để xem số điểm sẽ cộng.';
    }
    if (t.id === 'v-code') document.getElementById('voucher-mini').innerHTML = voucherMini(t.value);
    if (t.id === 'm-q') { memberQuery = t.value; document.getElementById('members-list').innerHTML = membersListHtml(); }
    if (t.classList.contains('is-invalid')) { t.classList.remove('is-invalid'); var er = (t.closest('.field') || t.parentNode).querySelector('.field-error'); if (er) er.remove(); }
  });
  view.addEventListener('change', function (e) {
    if (e.target.id === 'qr-file') { scanFile(e.target.files[0]); e.target.value = ''; }
  });

  view.addEventListener('click', function (e) {
    var b = e.target.closest('[data-action]'); if (!b) return;
    var a = b.getAttribute('data-action');
    if (a === 'sample') {
      loadSample(); renderNav();
      UI.toast('Đã nạp dữ liệu mẫu: 8 thành viên, 7 giao dịch', 'success');
      router.refresh();
    } else if (a === 'reset') {
      UI.confirm({ title: 'Xóa toàn bộ dữ liệu?', message: 'Mọi thành viên, điểm và ưu đãi lưu trên máy này sẽ bị xóa. Không hoàn tác được.', confirmText: 'Xóa dữ liệu', danger: true })
        .then(function (ok) {
          if (!ok) return;
          db = { members: [], txs: [], wallet: [], current: null, role: db.role, seq: 0 }; save(); lastResult = null;
          UI.toast('Đã xóa dữ liệu', 'success'); router.refresh();
        });
    } else if (a === 'leave') {
      db.current = null; save(); router.refresh();
    } else if (a === 'redeem') {
      var r0 = REWARDS.filter(function (x) { return x.id === b.getAttribute('data-id'); })[0];
      var m = currentMember();
      if (m && r0 && m.points < r0.cost) { UI.toast('Chưa đủ điểm: cần thêm ' + num(r0.cost - m.points) + ' điểm để đổi ' + r0.name, 'error'); return; }
      UI.confirm({ title: 'Đổi ' + r0.name + '?', message: 'Trừ ' + num(r0.cost) + ' điểm. Số dư còn lại: ' + num(m.points - r0.cost) + ' điểm.', confirmText: 'Đổi ưu đãi' })
        .then(function (ok) {
          if (!ok) return;
          var r = redeem(r0.id);
          if (r.error) { UI.toast(r.error, 'error'); return; }
          UI.toast('Đã đổi ' + r.reward.name + '. Ưu đãi nằm trong ví của bạn.', 'success');
          router.refresh();
        });
    } else if (a === 'export') { exportExcel(); }
    else if (a === 'scan') { startScan(); }
    else if (a === 'scan-stop') { stopScan(); }
    else if (a === 'pick') { prefill = b.getAttribute('data-id'); lastResult = null; router.go('quay'); }
  });

  /* Cửa sổ khác (VD: Quầy) vừa đổi dữ liệu → cửa sổ này cập nhật ngay, không cần tải lại */
  window.addEventListener('storage', function (e) {
    if (e.key !== KEY) return;
    var fresh = UI.store.get(KEY, null); if (!fresh) return;
    var me = currentMember(), before = me ? me.points : null;
    fresh.role = db.role; fresh.current = db.current; db = fresh;
    var now = currentMember();
    if (db.role === 'member' && now && before != null && now.points !== before) {
      var d = now.points - before;
      UI.toast(d > 0 ? 'Bạn vừa được cộng ' + num(d) + ' điểm' : 'Điểm của bạn vừa thay đổi: −' + num(-d), d > 0 ? 'success' : 'info');
    }
    var a = document.activeElement;
    var typing = a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && view.contains(a);
    if (!typing && !scanner) router.refresh();
  });

  /* Chạy được khi mất mạng: lưu sẵn tệp của app */
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})();
