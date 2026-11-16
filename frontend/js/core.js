/* =========================================================
   CORE – lớp dữ liệu + tiện ích dùng chung cho các trang
   Thường KHÔNG cần sửa file này. Mọi thứ theo đề nằm ở config.js.
   ========================================================= */
(function () {
  'use strict';

  var C = window.CONFIG;
  var esc = UI.esc;
  var App = window.App = { pages: {}, config: C };

  /* ---------- Màu chủ đạo theo chủ đề (đã kiểm tra chữ trắng ≥ 4.5:1) ---------- */
  var THEMES = {
    'xanh-duong': ['#2563EB', '#1D4ED8', '#1E40AF', '#DBEAFE', '#EFF6FF'],
    'teal':       ['#0F766E', '#115E59', '#134E4A', '#CCFBF1', '#F0FDFA'],
    'xanh-la':    ['#15803D', '#166534', '#14532D', '#DCFCE7', '#F0FDF4'],
    'navy':       ['#1E3A8A', '#1E3070', '#172554', '#DBEAFE', '#EFF6FF'],
    'cam':        ['#C2410C', '#9A3412', '#7C2D12', '#FFEDD5', '#FFF7ED'],
    'tim':        ['#7C3AED', '#6D28D9', '#5B21B6', '#EDE9FE', '#F5F3FF']
  };
  (function applyTheme() {
    var t = THEMES[C.theme] || THEMES['xanh-duong'];
    var r = document.documentElement.style;
    ['--primary', '--primary-600', '--primary-700', '--primary-100', '--primary-50'].forEach(function (k, i) { r.setProperty(k, t[i]); });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t[0]);
  })();

  /* ---------- Dựng tên app + menu từ config (sidebar + tab đáy) ---------- */
  App.buildShell = function () {
    document.querySelectorAll('[data-app-name]').forEach(function (el) { el.textContent = C.appName; });
    document.querySelectorAll('[data-brand-icon]').forEach(function (el) { el.innerHTML = UI.icon(C.brandIcon, 18); });
    var side = document.querySelector('.sidebar-nav');
    var tab = document.querySelector('.tabbar');
    side.innerHTML = C.menu.map(function (m) {
      return '<a class="side-link" href="#/' + m.route + '" data-route="' + m.route + '">' + UI.icon(m.icon) + esc(m.label) + '</a>';
    }).join('');
    tab.innerHTML = C.menu.map(function (m) {
      return '<a class="tab" href="#/' + m.route + '" data-route="' + m.route + '"><span class="tab-pill">' + UI.icon(m.icon, 22) + '</span>' + esc(m.label) + '</a>';
    }).join('');
  };

  /* =======================================================
     DỮ LIỆU: localStorage là nguồn chính, Firebase (nếu bật) đồng bộ thêm
     ======================================================= */
  var KEY = C.storageKey;
  var items = UI.store.get(KEY + '.items', null);
  if (!Array.isArray(items)) items = seedCopy();

  function seedCopy() {
    var now = Date.now();
    return (window.SEED || []).map(function (x, i) { return Object.assign({ _updated: now - i * 60000 }, x); });
  }
  function persist() { UI.store.set(KEY + '.items', items); }
  function remote(method, arg) {
    if (!window.Remote || !C.firebase.enabled) return;
    try {
      Promise.resolve(window.Remote[method](arg)).catch(function () {
        UI.toast('Chưa đồng bộ được lên máy chủ. Dữ liệu vẫn được lưu trên máy này.', 'info');
      });
    } catch (e) { /* giữ dữ liệu cục bộ */ }
  }

  App.data = {
    all: function () { return items.slice(); },
    get: function (id) { return items.find(function (x) { return x.id === id; }) || null; },
    add: function (obj) {
      var item = Object.assign({}, obj, { id: UI.uid(C.entity.idPrefix), _updated: Date.now() });
      items.unshift(item); persist(); remote('upsert', item);
      return item;
    },
    update: function (id, patch) {
      var out = null;
      items = items.map(function (x) {
        if (x.id !== id) return x;
        out = Object.assign({}, x, patch, { id: id, _updated: Date.now() });
        return out;
      });
      persist(); if (out) remote('upsert', out);
      return out;
    },
    remove: function (id) {
      var idx = items.findIndex(function (x) { return x.id === id; });
      if (idx < 0) return null;
      var removed = items.splice(idx, 1)[0];
      persist(); remote('remove', id);
      return { item: removed, index: idx };
    },
    restore: function (snap) {
      items.splice(Math.min(snap.index, items.length), 0, snap.item);
      persist(); remote('upsert', snap.item);
    },
    replaceAll: function (list) { items = list.slice(); persist(); remote('replaceAll', items); },
    append: function (list) { items = list.concat(items); persist(); remote('replaceAll', items); },
    reset: function () { items = seedCopy(); persist(); remote('replaceAll', items); },
    /* Gọi từ firebase.js khi tải xong dữ liệu trên máy chủ */
    loadRemote: function (list) {
      if (!Array.isArray(list) || !list.length) return;
      items = list; persist();
      if (App.router) App.router.refresh();
    }
  };

  /* Lưu trạng thái phụ (giả định kinh doanh, bộ lọc...) */
  App.state = {
    get: function (name, fallback) { return UI.store.get(KEY + '.' + name, fallback); },
    set: function (name, value) { UI.store.set(KEY + '.' + name, value); }
  };

  /* =======================================================
     Lược đồ & định dạng
     ======================================================= */
  App.field = function (key) { return C.fields.find(function (f) { return f.key === key; }); };
  App.title = function (x) { return x[C.entity.titleField] || '(Chưa đặt tên)'; };

  App.status = function (value) {
    return C.statuses.find(function (s) { return s.value === value; }) || { value: value, label: value || 'Chưa rõ', tone: 'neutral' };
  };
  App.badge = function (value) {
    var s = App.status(value);
    return '<span class="badge badge-' + s.tone + '">' + esc(s.label) + '</span>';
  };

  /* Hiển thị 1 giá trị theo kiểu trường – luôn đã escape */
  App.fmt = function (f, v) {
    if (v === '' || v == null) return '<span class="muted">—</span>';
    switch (f.type) {
      case 'money': return UI.money(v);
      case 'number': return UI.number(v) + (f.unit ? ' ' + esc(f.unit) : '');
      case 'percent': return UI.percent(v, 1);
      case 'date': return UI.date(v);
      case 'status': return App.badge(v);
      case 'textarea': return esc(v).replace(/\n/g, '<br>');
      default: return esc(v);
    }
  };
  App.fmtValue = function (format, v) {
    if (format === 'money') return UI.money(v);
    if (format === 'percent') return UI.percent(v, 1);
    return UI.number(v);
  };
  /* Rút gọn tiền cho biểu đồ: 1,2 tr · 3,4 tỷ */
  App.short = function (n, format) {
    var a = Math.abs(n), s;
    if (a >= 1e9) s = (n / 1e9).toFixed(1).replace('.', ',') + ' tỷ';
    else if (a >= 1e6) s = (n / 1e6).toFixed(1).replace('.', ',') + ' tr';
    else if (a >= 1e3 && format === 'money') s = Math.round(n / 1e3) + 'k';
    else s = UI.number(n);
    return s.replace(',0 ', ' ');
  };

  /* Tham số trên hash: #/chi-tiet?id=abc → App.param('id') = 'abc' */
  App.param = function (name) {
    var q = (location.hash.split('?')[1] || '');
    var m = new RegExp('(?:^|&)' + name + '=([^&]*)').exec(q);
    return m ? decodeURIComponent(m[1]) : '';
  };

  /* =======================================================
     Thành phần giao diện dùng chung
     ======================================================= */
  App.empty = function (iconName, title, text, actionHtml) {
    return '<div class="empty"><div class="empty-icon">' + UI.icon(iconName) + '</div>' +
      '<p class="empty-title">' + esc(title) + '</p><p class="empty-text">' + esc(text) + '</p>' + (actionHtml || '') + '</div>';
  };

  App.setError = function (id, msg) {
    var input = document.getElementById(id);
    var err = document.getElementById(id + '-err');
    if (!input || !err) return;
    input.classList.toggle('is-invalid', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    err.textContent = msg || '';
    err.hidden = !msg;
  };

  /* Toast có nút Hoàn tác (dùng sau khi xóa) */
  App.toastUndo = function (message, onUndo) {
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast toast-success';
    el.setAttribute('role', 'status');
    el.innerHTML = UI.icon('check-circle') + '<span style="flex:1">' + esc(message) + '</span>' +
      '<button type="button" class="toast-action">Hoàn tác</button>';
    root.appendChild(el);
    var timer = setTimeout(close, 5000);
    function close() {
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 200);
    }
    el.querySelector('.toast-action').addEventListener('click', function () {
      clearTimeout(timer); close(); onUndo();
    });
  };

  /* Nạp thư viện CDN khi cần (QR...) để trang mở nhanh */
  var loaded = {};
  App.loadScript = function (src) {
    if (!loaded[src]) {
      loaded[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = resolve;
        s.onerror = function () { delete loaded[src]; reject(new Error('Không tải được thư viện')); };
        document.head.appendChild(s);
      });
    }
    return loaded[src];
  };

  App.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  };

  /* =======================================================
     BIỂU ĐỒ SVG nhẹ (không cần CDN → không bao giờ trắng)
     ======================================================= */
  App.chart = {
    /* data: [{label, value}] – thanh ngang, dễ đọc trên điện thoại */
    bars: function (data, format) {
      if (!data.length) return App.empty('chart', 'Chưa có số liệu', 'Thêm dữ liệu để xem biểu đồ.');
      var max = Math.max.apply(null, data.map(function (d) { return d.value; })) || 1;
      return '<ul class="hbars" role="list">' + data.map(function (d) {
        var w = Math.max(2, Math.round(d.value / max * 100));
        return '<li class="hbar"><div class="hbar-head"><span>' + esc(d.label) + '</span><strong>' + App.fmtValue(format, d.value) + '</strong></div>' +
          '<div class="hbar-track"><div class="hbar-fill" style="width:' + w + '%"></div></div></li>';
      }).join('') + '</ul>';
    },
    /* series: [{label, tone, values[]}] – đường, có trục 0 */
    lines: function (series, labels, format) {
      var narrow = window.innerWidth < 600;
      var W = narrow ? 360 : 640, H = narrow ? 220 : 240, pl = 52, pr = 12, pt = 12, pb = 28;
      var all = [].concat.apply([0], series.map(function (s) { return s.values; }));
      var min = Math.min.apply(null, all), max = Math.max.apply(null, all);
      if (max === min) max = min + 1;
      var x = function (i) { return pl + (W - pl - pr) * (labels.length < 2 ? 0 : i / (labels.length - 1)); };
      var y = function (v) { return pt + (H - pt - pb) * (1 - (v - min) / (max - min)); };
      var ticks = [min, (min + max) / 2, max, 0].filter(function (v, i, a) { return a.indexOf(v) === i; });
      var grid = ticks.map(function (t) {
        return '<line x1="' + pl + '" x2="' + (W - pr) + '" y1="' + y(t) + '" y2="' + y(t) + '" class="' + (t === 0 ? 'axis0' : 'gridl') + '"/>' +
          '<text x="' + (pl - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + esc(App.short(t, format)) + '</text>';
      }).join('');
      var xl = labels.map(function (l, i) {
        return (i % Math.ceil(labels.length / 6) === 0 || i === labels.length - 1) ? '<text x="' + x(i) + '" y="' + (H - 8) + '" text-anchor="middle">' + esc(l) + '</text>' : '';
      }).join('');
      var paths = series.map(function (s) {
        var d = s.values.map(function (v, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1); }).join(' ');
        return '<path d="' + d + '" class="line tone-' + s.tone + '"/>';
      }).join('');
      var legend = '<div class="legend">' + series.map(function (s) {
        return '<span><i class="dot tone-' + s.tone + '"></i>' + esc(s.label) + '</span>';
      }).join('') + '</div>';
      return '<svg class="linechart" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Biểu đồ đường">' + grid + xl + paths + '</svg>' + legend;
    }
  };
  /* =======================================================
     ĐĂNG NHẬP – trạng thái dùng chung. js/auth.js (module Firebase) gọi App.auth.setUser()
     ======================================================= */
  var A = C.auth || { enabled: false };
  App.auth = {
    enabled: !!A.enabled,
    user: null,                                   // { uid, name, email, photo }
    ready: !A.enabled,                            // đã biết trạng thái đăng nhập chưa
    unavailable: false,                           // Firebase không tải được (mất mạng, file://)
    guest: !!App.state.get('guest', false),
    isIn: function () { return !A.enabled || !A.required || !!this.user || this.guest; },
    displayName: function () {
      if (this.user) return this.user.name || (this.user.email || '').split('@')[0] || 'Người dùng';
      return this.guest ? 'Khách dùng thử' : '';
    },
    initials: function () {
      var parts = this.displayName().trim().split(/\s+/);
      return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    },
    setUser: function (u) {
      this.user = u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', photo: u.photoURL || '' } : null;
      if (this.user) this.setGuest(false);
      this.ready = true;
      this.emit();
    },
    setGuest: function (on) { this.guest = !!on; App.state.set('guest', this.guest); },
    fail: function () { if (this.ready) return; this.ready = true; this.unavailable = true; this.emit(); },
    signOut: function () {
      this.setGuest(false);
      var done = function () { App.auth.user = null; App.auth.emit(); };
      if (window.Auth && this.user) return window.Auth.signOut().then(done, done);
      done(); return Promise.resolve();
    },
    _subs: [],
    onChange: function (fn) { this._subs.push(fn); },
    emit: function () { this._subs.forEach(function (fn) { try { fn(); } catch (e) { console.error(e); } }); }
  };

  /* Thông báo lỗi Firebase Auth bằng tiếng Việt, kèm cách khắc phục */
  App.authError = function (err) {
    var code = (err && err.code) || '';
    var map = {
      'auth/invalid-email': 'Email chưa đúng định dạng, ví dụ: ten@gmail.com.',
      'auth/missing-password': 'Vui lòng nhập mật khẩu.',
      'auth/invalid-credential': 'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.',
      'auth/invalid-login-credentials': 'Email hoặc mật khẩu chưa đúng. Vui lòng thử lại.',
      'auth/wrong-password': 'Mật khẩu chưa đúng. Vui lòng thử lại.',
      'auth/user-not-found': 'Chưa có tài khoản với email này. Hãy chọn "Đăng ký".',
      'auth/user-disabled': 'Tài khoản này đã bị khóa.',
      'auth/email-already-in-use': 'Email này đã có tài khoản. Hãy chọn "Đăng nhập".',
      'auth/weak-password': 'Mật khẩu cần ít nhất 6 ký tự.',
      'auth/too-many-requests': 'Bạn thử quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.',
      'auth/network-request-failed': 'Không có kết nối mạng. Kiểm tra mạng hoặc chọn "Dùng thử".',
      'auth/popup-closed-by-user': 'Bạn đã đóng cửa sổ đăng nhập Google.',
      'auth/cancelled-popup-request': 'Bạn đã đóng cửa sổ đăng nhập Google.',
      'auth/popup-blocked': 'Trình duyệt chặn cửa sổ đăng nhập. Đang chuyển sang trang Google…',
      'auth/operation-not-allowed': 'Cách đăng nhập này chưa được bật. Vui lòng chọn cách khác.',
      'auth/unauthorized-domain': 'Trang web này chưa được phép đăng nhập. Vui lòng chọn "Dùng thử".'
    };
    return map[code] || 'Chưa đăng nhập được. Vui lòng thử lại sau ít phút.';
  };
})();
