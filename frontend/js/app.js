/* =========================================================
   APP – khai báo route, chặn trang khi chưa đăng nhập, chuyển sự kiện tới trang đang mở
   Thêm trang mới: tạo js/pages/ten.js (App.pages.ten = {title, render, mount?, on?, leave?})
   → nạp trong index.html → thêm 1 dòng vào ROUTES dưới đây → thêm vào CONFIG.menu nếu cần.
   ========================================================= */
(function () {
  'use strict';

  var ROUTES = {
    '':           'home',
    'danh-sach':  'list',
    'chi-tiet':   'detail',
    'them':       'add',
    'sua':        'edit',
    'kinh-doanh': 'business',
    'tien-ich':   'tools',
    'dang-nhap':  'login'
  };
  var LOGIN = 'dang-nhap';
  var AUTH_WAIT_MS = 6000;          // quá thời gian này chưa có phản hồi Firebase → cho dùng thử

  App.buildShell();

  var routes = {}, blocked = false;
  Object.keys(ROUTES).forEach(function (key) {
    var p = App.pages[ROUTES[key]];
    if (!p) return;
    routes[key] = {
      get title() { return p.title; },
      render: function () {
        var gate = guard(key);
        blocked = !!gate;
        document.body.classList.toggle('auth-page', key === LOGIN && !gate);
        return gate || p.render();
      },
      mount: function (view) { if (!blocked && p.mount) p.mount(view); }
    };
  });

  /* ---------- Chặn trang: trả về HTML chờ nếu chưa được vào ---------- */
  function guard(key) {
    var au = App.auth;
    if (!au.enabled) return key === LOGIN ? wait() + redirect('') : '';
    if (key === LOGIN) return au.ready && au.isIn() ? wait() + redirect(nextRoute()) : (au.ready ? '' : wait());
    if (au.guest) return '';                     // khách dùng thử: vào ngay, không chờ Firebase
    if (!au.ready) return wait();
    if (!au.isIn()) return wait() + redirect(LOGIN + '?next=' + encodeURIComponent(currentFull()));
    return '';
  }
  function wait() { return '<div class="auth-wait">' + UI.skeleton(3) + '</div>'; }
  function redirect(to) { setTimeout(function () { location.replace('#/' + to); }, 0); return ''; }
  function currentFull() { return (location.hash || '').replace(/^#\/?/, ''); }
  function nextRoute() {
    var n = App.param('next');
    return n && n.indexOf(LOGIN) !== 0 ? n : '';
  }

  var last = null;
  function page() { return App.pages[ROUTES[App.router.current()]]; }

  /* Trang con (chi tiết, sửa) vẫn sáng mục menu cha */
  function markParent(key, p) {
    var inMenu = App.config.menu.some(function (m) { return m.route === key; });
    if (inMenu || !p || !p.parent) return;
    document.querySelectorAll('[data-route="' + p.parent + '"]').forEach(function (a) { a.setAttribute('aria-current', 'page'); });
  }

  App.router = UI.router({ appName: App.config.appName, defaultRoute: '', routes: routes });

  /* Rời trang → gọi leave() (VD: tắt camera) */
  window.addEventListener('hashchange', function () {
    var cur = page();
    if (last && last !== cur && last.leave) last.leave();
    last = cur;
    markParent(App.router.current(), cur);
  });

  last = page();
  markParent(App.router.current(), page());
  var refresh = App.router.refresh;
  App.router.refresh = function () { refresh(); markParent(App.router.current(), page()); };

  /* =======================================================
     Người dùng: nút avatar ở thanh trên + khối tài khoản ở menu trái
     ======================================================= */
  function avatar(size) {
    var u = App.auth.user;
    return u && u.photo
      ? '<img class="avatar" src="' + UI.esc(u.photo) + '" alt="" width="' + size + '" height="' + size + '" referrerpolicy="no-referrer">'
      : '<span class="avatar" style="width:' + size + 'px;height:' + size + 'px" aria-hidden="true">' + UI.esc(App.auth.initials()) + '</span>';
  }

  function renderUser() {
    var au = App.auth, top = document.getElementById('topbar-user'), side = document.getElementById('sidebar-user');
    var show = au.enabled && au.isIn() && (au.user || au.guest);
    if (top) top.innerHTML = show
      ? '<button type="button" class="avatar-btn" data-action="account" aria-label="Tài khoản: ' + UI.esc(au.displayName()) + '">' + avatar(32) + '</button>' : '';
    if (side) side.innerHTML = show
      ? '<div class="user-card">' + avatar(36) + '<div class="user-main"><p class="user-name">' + UI.esc(au.displayName()) + '</p>' +
        '<p class="user-sub">' + UI.esc(au.user ? au.user.email : 'Dữ liệu lưu trên máy này') + '</p></div>' +
        '<button type="button" class="btn-icon" data-action="logout" aria-label="Đăng xuất">' + UI.icon('log-out') + '</button></div>' : '';
  }

  function askLogout() {
    var au = App.auth;
    UI.confirm({
      title: au.user ? 'Đăng xuất khỏi ' + au.displayName() + '?' : 'Thoát chế độ dùng thử?',
      message: au.user ? (au.user.email || '') + ' · Bạn có thể đăng nhập lại bất cứ lúc nào.' : 'Dữ liệu dùng thử vẫn được giữ trên máy này.',
      confirmText: au.user ? 'Đăng xuất' : 'Thoát'
    }).then(function (ok) {
      if (!ok) return;
      au.signOut().then(function () { UI.toast('Đã đăng xuất', 'info'); });
    });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-action="account"], [data-action="logout"]');
    if (btn && !btn.closest('#view')) askLogout();
  });

  /* Đổi trạng thái đăng nhập → cập nhật giao diện + chuyển trang phù hợp */
  App.auth.onChange(function () {
    renderUser();
    var key = App.router.current();
    if (key === LOGIN && App.auth.isIn()) location.replace('#/' + nextRoute());
    else if (key !== LOGIN && App.auth.enabled && App.auth.ready && !App.auth.isIn()) {
      var cur = currentFull();
      if (cur.indexOf(LOGIN) === 0) return;       // đang chuyển tới trang đăng nhập rồi
      location.replace('#/' + LOGIN + (cur ? '?next=' + encodeURIComponent(cur) : ''));
    }
    else App.router.refresh();
  });
  renderUser();

  /* Firebase không phản hồi (mất mạng, mở bằng file://) → vẫn cho vào bằng "Dùng thử" */
  if (App.auth.enabled && !App.auth.ready) setTimeout(function () { App.auth.fail(); }, AUTH_WAIT_MS);

  /* ---------- Ủy quyền sự kiện: mỗi trang tự xử lý qua page.on ---------- */
  var view = document.getElementById('view');
  ['click', 'input', 'change', 'submit'].forEach(function (type) {
    view.addEventListener(type, function (e) {
      var p = page();
      if (!p || !p.on || !p.on[type]) return;
      try {
        if (type === 'click') {
          var btn = e.target.closest('[data-action]');
          if (!btn || btn.disabled) return;
          p.on.click(e, btn, btn.getAttribute('data-action'));
        } else {
          p.on[type](e);
        }
      } catch (err) {
        console.error(err);
        UI.toast('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
      }
    });
  });
})();
