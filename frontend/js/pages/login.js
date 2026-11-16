/* TRANG ĐĂNG NHẬP – #/dang-nhap  (đăng nhập / đăng ký / quên mật khẩu / Google / dùng thử)
   Giao diện toàn màn hình: ẩn menu, tab đáy (class body.auth-page) */
(function () {
  'use strict';
  var C = App.config, A = C.auth || {}, esc = UI.esc, icon = UI.icon;
  var mode = 'login';               // login | register | reset
  var draft = { email: '', name: '' };
  var busy = false;

  var GOOGLE = '<svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';

  function field(id, label, type, placeholder, value, extra) {
    return '<div class="field"><label class="label" for="' + id + '">' + label + '</label>' +
      '<div class="input-icon">' + extra.icon +
      '<input class="input" id="' + id + '" name="' + id + '" type="' + type + '" placeholder="' + esc(placeholder) + '" value="' + esc(value || '') + '"' +
      ' autocomplete="' + extra.ac + '"' + (extra.attrs || '') + ' aria-describedby="' + id + '-err">' + (extra.after || '') + '</div>' +
      '<p class="field-error" id="' + id + '-err" hidden></p></div>';
  }

  function pwField(id, label, ac) {
    return field(id, label, 'password', ac === 'new-password' ? 'Ít nhất 6 ký tự' : 'Nhập mật khẩu', '', {
      icon: icon('lock', 18), ac: ac,
      after: '<button type="button" class="btn-icon pw-toggle" data-action="toggle-pw" data-for="' + id + '" aria-label="Hiện mật khẩu">' + icon('eye', 18) + '</button>'
    });
  }

  function formHtml() {
    var email = field('email', 'Email', 'email', 'VD: ten@gmail.com', draft.email, { icon: icon('mail', 18), ac: 'email', attrs: ' inputmode="email"' });
    if (mode === 'reset') {
      return '<form class="form" id="auth-form" novalidate>' +
        '<p class="small muted">Nhập email đã đăng ký, chúng tôi sẽ gửi liên kết đặt lại mật khẩu.</p>' + email +
        '<button type="submit" class="btn btn-primary btn-block">Gửi liên kết đặt lại</button>' +
        '<button type="button" class="btn btn-text" data-action="mode" data-value="login">' + icon('arrow-left', 18) + 'Quay lại đăng nhập</button></form>';
    }
    var reg = mode === 'register';
    return '<form class="form" id="auth-form" novalidate>' +
      (reg ? field('name', 'Họ và tên', 'text', 'VD: Nguyễn Minh An', draft.name, { icon: icon('user', 18), ac: 'name' }) : '') +
      email +
      pwField('password', 'Mật khẩu', reg ? 'new-password' : 'current-password') +
      (reg ? '' : '<div class="row" style="justify-content:flex-end;margin-top:-8px"><button type="button" class="btn btn-text" data-action="mode" data-value="reset">Quên mật khẩu?</button></div>') +
      '<button type="submit" class="btn btn-primary btn-block">' + (reg ? 'Tạo tài khoản' : 'Đăng nhập') + '</button></form>';
  }

  function cardHtml() {
    var tabs = mode === 'reset' || !A.email ? '' :
      '<div class="segmented has-thumb" role="group" aria-label="Chọn cách vào" style="--seg-i:' + (mode === 'register' ? 1 : 0) + '">' +
        '<button type="button" class="segment" data-action="mode" data-value="login" aria-pressed="' + (mode === 'login') + '">Đăng nhập</button>' +
        '<button type="button" class="segment" data-action="mode" data-value="register" aria-pressed="' + (mode === 'register') + '">Đăng ký</button></div>';
    var offline = App.auth.unavailable
      ? '<div class="alert alert-warning">' + icon('alert-circle') + '<p>Chưa kết nối được dịch vụ đăng nhập. Bạn vẫn có thể <strong>dùng thử</strong> với dữ liệu trên máy này.</p></div>' : '';
    var google = A.google && mode !== 'reset'
      ? '<button type="button" class="btn btn-secondary btn-block" data-action="google"' + (App.auth.unavailable ? ' disabled' : '') + '>' + GOOGLE + 'Tiếp tục với Google</button>' : '';
    var guest = A.allowGuest && mode !== 'reset'
      ? '<button type="button" class="btn btn-text guest-btn" data-action="guest">Dùng thử không cần tài khoản</button>' : '';
    var divider = A.email && (google || guest) && mode !== 'reset' ? '<div class="divider"><span>hoặc</span></div>' : '';
    return offline + tabs + (A.email ? formHtml() : '') + divider + google + guest;
  }

  /* Đổi chế độ: nội dung mới hiện dần (tuyến tính), "ngón trượt" của nút chọn đoạn trượt từ vị trí cũ sang */
  function refresh(prevMode) {
    var el = document.getElementById('auth-card-body');
    if (!el) return;
    el.innerHTML = cardHtml();
    el.classList.remove('auth-swap'); void el.offsetWidth; el.classList.add('auth-swap');
    var seg = el.querySelector('.segmented.has-thumb');
    if (seg && prevMode && prevMode !== mode && prevMode !== 'reset') {
      var to = mode === 'register' ? 1 : 0;
      seg.style.setProperty('--seg-i', prevMode === 'register' ? 1 : 0);
      requestAnimationFrame(function () { requestAnimationFrame(function () { seg.style.setProperty('--seg-i', to); }); });
    }
  }

  /* Cột giới thiệu – chỉ hiện trên máy tính (desktop.css) */
  function heroHtml() {
    var feats = A.features || C.menu.slice(0, 3).map(function (m) { return { icon: m.icon, text: m.label }; });
    return '<aside class="auth-hero" aria-hidden="true">' +
      '<div class="auth-hero-brand"><span class="brand-mark">' + icon(C.brandIcon, 20) + '</span>' + esc(C.appName) + '</div>' +
      '<div><h2>' + esc(A.headline || C.appName) + '</h2><p class="lead">' + esc(C.tagline) + '</p>' +
        '<ul class="auth-feats">' + feats.map(function (f) { return '<li>' + icon(f.icon) + esc(f.text) + '</li>'; }).join('') + '</ul></div>' +
      '<p class="auth-hero-foot">Số liệu hiển thị là dữ liệu mẫu.</p>' +
    '</aside>';
  }

  function setBusy(on, label) {
    busy = on;
    document.querySelectorAll('#auth-card-body button').forEach(function (b) { b.disabled = on; });
    var btn = document.querySelector('#auth-form [type=submit]');
    if (btn) {
      if (on) { btn.dataset.label = btn.textContent; btn.textContent = label; }
      else if (btn.dataset.label) btn.textContent = btn.dataset.label;
    }
  }

  function needAuth() {
    if (!window.Auth) { UI.toast('Dịch vụ đăng nhập chưa sẵn sàng. Vui lòng thử lại hoặc chọn "Dùng thử".', 'error'); return false; }
    return true;
  }

  function submit(form) {
    var email = form.elements.email.value.trim();
    var pw = form.elements.password ? form.elements.password.value : '';
    var name = form.elements.name ? form.elements.name.value.trim() : '';
    var errs = {};
    if (mode === 'register' && !name) errs.name = 'Vui lòng nhập họ và tên.';
    if (!email) errs.email = 'Vui lòng nhập email.';
    else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = 'Email chưa đúng định dạng, ví dụ: ten@gmail.com.';
    if (mode !== 'reset') {
      if (!pw) errs.password = 'Vui lòng nhập mật khẩu.';
      else if (mode === 'register' && pw.length < 6) errs.password = 'Mật khẩu cần ít nhất 6 ký tự.';
    }
    var first = null;
    ['name', 'email', 'password'].forEach(function (k) {
      App.setError(k, errs[k] || '');
      if (errs[k] && !first) first = k;
    });
    if (first) { document.getElementById(first).focus(); return; }
    if (!needAuth()) return;

    var job, label;
    if (mode === 'login') { job = window.Auth.signIn(email, pw); label = 'Đang đăng nhập…'; }
    else if (mode === 'register') { job = window.Auth.signUp(email, pw, name); label = 'Đang tạo tài khoản…'; }
    else { job = window.Auth.resetPassword(email); label = 'Đang gửi…'; }
    setBusy(true, label);
    job.then(function () {
      setBusy(false);
      if (mode === 'reset') {
        UI.toast('Đã gửi liên kết đặt lại mật khẩu tới ' + email + '. Hãy kiểm tra hộp thư (cả mục Spam).', 'info');
        var prev = mode; mode = 'login'; refresh(prev);
      } else {
        UI.toast(mode === 'register' ? 'Đã tạo tài khoản. Chào mừng bạn!' : 'Đăng nhập thành công');
      }
    }).catch(function (err) {
      setBusy(false);
      var msg = App.authError(err);
      var target = /password|credential/.test(err && err.code || '') ? 'password' : /email|user-not-found/.test(err && err.code || '') ? 'email' : '';
      if (target && document.getElementById(target)) { App.setError(target, msg); document.getElementById(target).focus(); }
      else UI.toast(msg, 'error');
    });
  }

  App.pages.login = {
    title: 'Đăng nhập',
    render: function () {
      return '<div class="auth-wrap">' + heroHtml() +
        '<div class="auth-main"><div class="auth-card card">' +
          '<div class="auth-brand"><span class="brand-mark">' + icon(C.brandIcon, 22) + '</span>' +
            '<h2 class="h3">' + esc(mode === 'register' ? 'Tạo tài khoản' : mode === 'reset' ? 'Quên mật khẩu' : 'Chào mừng trở lại') + '</h2>' +
            '<p class="small muted">' + esc(A.welcome || C.tagline) + '</p></div>' +
          '<div class="stack" id="auth-card-body">' + cardHtml() + '</div>' +
        '</div><p class="small muted auth-foot">Thông tin đăng nhập được bảo vệ bởi Firebase Authentication.</p></div>' +
      '</div>';
    },
    mount: function () {
      var el = document.getElementById(A.email ? 'email' : '');
      if (el && window.matchMedia('(min-width: 768px)').matches) el.focus();
    },
    refresh: refresh,
    on: {
      click: function (e, btn, action) {
        if (busy) return;
        if (action === 'mode') {
          var em = document.getElementById('email'), nm = document.getElementById('name');
          if (em) draft.email = em.value; if (nm) draft.name = nm.value;
          var prev = mode;
          mode = btn.getAttribute('data-value'); refresh(prev);
          var title = document.querySelector('.auth-brand .h3');
          if (title) title.textContent = mode === 'register' ? 'Tạo tài khoản' : mode === 'reset' ? 'Quên mật khẩu' : 'Chào mừng trở lại';
          var first = document.getElementById(mode === 'register' ? 'name' : 'email');
          if (first) first.focus();
        }
        if (action === 'toggle-pw') {
          var input = document.getElementById(btn.getAttribute('data-for'));
          var show = input.type === 'password';
          input.type = show ? 'text' : 'password';
          btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
          btn.innerHTML = icon(show ? 'eye-off' : 'eye', 18);
        }
        if (action === 'google') {
          if (!needAuth()) return;
          setBusy(true);
          window.Auth.signInGoogle().then(function () { setBusy(false); UI.toast('Đăng nhập thành công'); })
            .catch(function (err) { setBusy(false); if (err && err.code !== 'auth/redirecting') UI.toast(App.authError(err), 'error'); });
        }
        if (action === 'guest') {
          App.auth.setGuest(true);
          App.auth.emit();
          UI.toast('Bạn đang dùng thử – dữ liệu chỉ lưu trên máy này', 'info');
        }
      },
      input: function (e) { if (e.target.name) App.setError(e.target.name, ''); },
      submit: function (e) { if (e.target.id === 'auth-form') { e.preventDefault(); if (!busy) submit(e.target); } }
    }
  };
})();
