/* =========================================================
   UI KIT – các hàm dùng chung (không phụ thuộc đề bài)
   Dùng qua đối tượng toàn cục: UI.toast(...), UI.confirm(...), ...
   ========================================================= */
(function () {
  'use strict';

  var UI = {};

  /* ---------- Chuỗi & định dạng ---------- */
  UI.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  /* Bỏ dấu tiếng Việt để tìm kiếm: "Hà Nội" -> "ha noi" */
  UI.norm = function (s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase().trim();
  };

  UI.match = function (query, text) {
    var q = UI.norm(query);
    return !q || UI.norm(text).indexOf(q) !== -1;
  };

  var nf = new Intl.NumberFormat('vi-VN');
  UI.number = function (n) { return nf.format(Number(n) || 0); };
  UI.money = function (n) { return nf.format(Math.round(Number(n) || 0)) + ' ₫'; };
  UI.percent = function (n, digits) { return (Number(n) || 0).toFixed(digits == null ? 0 : digits).replace('.', ',') + '%'; };

  function pad(n) { return ('0' + n).slice(-2); }
  UI.toDate = function (d) {
    if (d instanceof Date) return d;
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(d));
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(d);
  };
  UI.date = function (d) {
    d = UI.toDate(d);
    if (isNaN(d)) return '';
    return pad(d.getDate()) + '/' + pad(d.getMonth() + 1) + '/' + d.getFullYear();
  };
  /* Ngày theo giờ địa phương dạng YYYY-MM-DD (không dùng toISOString vì lệch múi giờ) */
  UI.isoDate = function (d) {
    d = d instanceof Date ? d : new Date(d);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };
  UI.addDays = function (d, days) {
    var x = new Date(d);
    x.setDate(x.getDate() + days);
    return x;
  };
  UI.weekday = function (d) {
    return ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][new Date(d).getDay()];
  };

  UI.uid = function (prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  };

  /* ---------- Icon (dùng sprite trong index.html) ---------- */
  UI.icon = function (name, size) {
    var s = size || 20;
    return '<svg class="icon" width="' + s + '" height="' + s + '" style="width:' + s + 'px;height:' + s + 'px" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  };

  /* ---------- Lưu trữ cục bộ (an toàn khi trình duyệt chặn) ---------- */
  UI.store = {
    get: function (key, fallback) {
      try {
        var raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : clone(fallback);
      } catch (e) { return clone(fallback); }
    },
    set: function (key, value) {
      try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { localStorage.removeItem(key); } catch (e) { /* bỏ qua */ }
    }
  };
  function clone(v) { return v == null ? v : JSON.parse(JSON.stringify(v)); }

  /* ---------- Thông báo nhỏ (toast) ---------- */
  var TOAST_ICON = { success: 'check-circle', error: 'alert-circle', info: 'info' };
  UI.toast = function (message, type) {
    type = type || 'success';
    var root = document.getElementById('toast-root');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = UI.icon(TOAST_ICON[type] || 'info') + '<span>' + UI.esc(message) + '</span>';
    root.appendChild(el);
    while (root.children.length > 3) root.removeChild(root.firstChild);
    setTimeout(function () {
      el.classList.add('is-leaving');
      setTimeout(function () { el.remove(); }, 200);
    }, 2800);
  };

  /* ---------- Hộp thoại xác nhận (trả về Promise<boolean>) ---------- */
  UI.confirm = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var root = document.getElementById('modal-root');
      var lastFocus = document.activeElement;
      var wrap = document.createElement('div');
      wrap.className = 'modal-backdrop';
      wrap.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" aria-describedby="modal-text">' +
          '<h2 id="modal-title" class="modal-title">' + UI.esc(opts.title || 'Bạn chắc chắn chứ?') + '</h2>' +
          (opts.message ? '<p id="modal-text" class="modal-text">' + UI.esc(opts.message) + '</p>' : '') +
          '<div class="modal-actions">' +
            '<button type="button" class="btn ' + (opts.danger ? 'btn-danger' : 'btn-primary') + '" data-ok>' + UI.esc(opts.confirmText || 'Đồng ý') + '</button>' +
            '<button type="button" class="btn btn-secondary" data-cancel>' + UI.esc(opts.cancelText || 'Hủy') + '</button>' +
          '</div>' +
        '</div>';

      function close(result) {
        document.removeEventListener('keydown', onKey);
        wrap.remove();
        if (lastFocus && lastFocus.focus) lastFocus.focus();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') close(false);
        if (e.key === 'Tab') { /* giữ focus trong hộp thoại */
          var f = wrap.querySelectorAll('button');
          var first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
      wrap.addEventListener('click', function (e) {
        if (e.target === wrap || e.target.closest('[data-cancel]')) close(false);
        else if (e.target.closest('[data-ok]')) close(true);
      });
      document.addEventListener('keydown', onKey);
      root.appendChild(wrap);
      wrap.querySelector(opts.danger ? '[data-cancel]' : '[data-ok]').focus();
    });
  };

  /* ---------- Điều hướng theo #/duong-dan (không cần server) ---------- */
  UI.router = function (config) {
    var view = document.getElementById('view');
    var titleEl = document.getElementById('page-title');
    var current = null;

    function routeKey() {
      var key = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
      return config.routes[key] ? key : config.defaultRoute;
    }

    /* Thứ tự mục menu → biết đang đi "tới" (trượt từ phải) hay "lùi" (trượt từ trái) */
    function navIndex(key) {
      var links = document.querySelectorAll('.tabbar [data-route]');
      for (var i = 0; i < links.length; i++) if (links[i].getAttribute('data-route') === key) return i;
      return -1;
    }

    /* Thanh chỉ báo trượt tuyến tính tới mục menu đang chọn (sidebar + tab đáy) */
    function moveIndicators(instant) {
      document.querySelectorAll('.sidebar-nav, .tabbar').forEach(function (nav) {
        var links = nav.querySelectorAll('[data-route]');
        if (!links.length) return;
        var ind = nav.querySelector('.nav-indicator');
        if (!ind) {
          ind = document.createElement('span');
          ind.className = 'nav-indicator no-anim';
          ind.setAttribute('aria-hidden', 'true');
          nav.appendChild(ind);
          instant = true;
        }
        var idx = -1;
        links.forEach(function (a, i) { if (idx < 0 && a.getAttribute('aria-current') === 'page') idx = i; });
        ind.classList.toggle('no-anim', !!instant);
        ind.classList.toggle('is-hidden', idx < 0);
        ind.style.setProperty('--n', links.length);
        if (idx >= 0) ind.style.setProperty('--i', idx);
        if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { ind.classList.remove('no-anim'); }); });
      });
    }

    function render(keepScroll) {
      var key = routeKey();
      var route = config.routes[key];
      var changed = key !== current;
      var from = navIndex(current), to = navIndex(key);
      view.setAttribute('data-dir', from >= 0 && to >= 0 && from !== to ? (to > from ? 'forward' : 'back') : 'fade');
      var first = current === null;
      current = key;
      try {
        view.innerHTML = '<div class="page' + (changed ? '' : ' is-static') + '">' + route.render() + '</div>';
        if (route.mount) route.mount(view);
      } catch (err) {
        console.error(err);
        view.innerHTML = '<div class="page"><div class="empty"><div class="empty-icon">' + UI.icon('alert-circle') +
          '</div><p class="empty-title">Không tải được trang</p><p class="empty-text">Vui lòng tải lại trang hoặc thử lại sau ít phút.</p>' +
          '<button class="btn btn-secondary" onclick="location.reload()">Tải lại trang</button></div></div>';
      }
      if (titleEl) titleEl.textContent = route.title;
      document.title = route.title + ' · ' + config.appName;
      document.querySelectorAll('[data-route]').forEach(function (a) {
        if (a.getAttribute('data-route') === key) a.setAttribute('aria-current', 'page');
        else a.removeAttribute('aria-current');
      });
      if (changed && !keepScroll) {
        window.scrollTo(0, 0);
        view.focus({ preventScroll: true });
      }
      /* chờ các listener khác (VD: sáng mục menu cha) chạy xong rồi mới trượt chỉ báo */
      setTimeout(function () { moveIndicators(first); }, 0);
    }

    window.addEventListener('resize', function () { moveIndicators(true); });

    window.addEventListener('hashchange', function () { render(false); });
    render(false);

    return {
      go: function (key) { location.hash = '#/' + key; },
      refresh: function () { render(true); },
      current: function () { return current; }
    };
  };

  /* ---------- Đọc file Excel/CSV (cần SheetJS trong index.html) ----------
     UI.readSheet(file) -> Promise<{ TenSheet: [ {cot: giaTri}, ... ] }>      */
  UI.readSheet = function (file) {
    return new Promise(function (resolve, reject) {
      if (!window.XLSX) { reject(new Error('Chưa tải được thư viện đọc Excel.')); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
          var out = {};
          wb.SheetNames.forEach(function (name) {
            out[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
          });
          resolve(out);
        } catch (err) { reject(err); }
      };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  };

  /* Đọc file dữ liệu mẫu đặt sẵn trong thư mục data/ (cần chạy qua http, không phải file://) */
  UI.fetchSheet = function (url) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('Không tải được ' + url);
      return r.arrayBuffer();
    }).then(function (buf) {
      var wb = XLSX.read(new Uint8Array(buf), { type: 'array', cellDates: true });
      var out = {};
      wb.SheetNames.forEach(function (name) {
        out[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
      });
      return out;
    });
  };

  /* Khung chờ khi đang tải */
  UI.skeleton = function (rows) {
    var html = '';
    for (var i = 0; i < (rows || 3); i++) html += '<div class="skeleton" style="height:72px"></div>';
    return '<div class="stack" aria-hidden="true">' + html + '</div><p class="sr-only" role="status">Đang tải dữ liệu…</p>';
  };

  window.UI = UI;
})();
