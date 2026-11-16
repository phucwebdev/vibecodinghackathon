/* TRANG CHI TIẾT – #/chi-tiet?id=... : thông tin đầy đủ + mã QR + sửa/xóa */
(function () {
  'use strict';
  var C = App.config, E = C.entity, esc = UI.esc, icon = UI.icon;
  var QR_LIB = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';

  App.itemUrl = function (id) {
    return location.href.split('#')[0] + '#/chi-tiet?id=' + encodeURIComponent(id);
  };

  /* Vẽ QR vào phần tử el (nạp thư viện khi cần) */
  App.renderQR = function (el, text) {
    App.loadScript(QR_LIB).then(function () {
      var qr = window.qrcode(0, 'M');
      qr.addData(text); qr.make();
      el.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
      var svg = el.querySelector('svg');
      if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Mã QR mở trang chi tiết'); }
    }).catch(function () {
      el.classList.add('is-error');
      el.innerHTML = '<p class="small muted">Chưa tạo được mã QR do mất mạng. Vui lòng thử lại sau.</p>';
    });
  };

  App.pages.detail = {
    title: 'Chi tiết',
    parent: 'danh-sach',
    render: function () {
      var x = App.data.get(App.param('id'));
      if (!x) {
        return App.empty('search', 'Không tìm thấy ' + E.one, 'Có thể ' + E.one + ' này đã bị xóa.',
          '<a class="btn btn-secondary btn-sm" href="#/danh-sach">Về danh sách</a>');
      }
      var rows = C.fields.filter(function (f) { return f.key !== E.titleField; }).map(function (f) {
        return '<div class="dl-row"><dt>' + esc(f.label) + '</dt><dd>' + App.fmt(f, x[f.key]) + '</dd></div>';
      }).join('');
      return '' +
        '<a class="btn btn-text back-link" href="#/danh-sach">' + icon('arrow-left', 18) + 'Về danh sách</a>' +
        '<section class="page-head"><div>' +
          (E.subtitleField ? '<p class="eyebrow">' + esc(x[E.subtitleField] || '') + '</p>' : '') +
          '<h2 class="h2">' + esc(App.title(x)) + '</h2>' +
          (E.statusField ? '<div style="margin-top:8px">' + App.badge(x[E.statusField]) + '</div>' : '') +
        '</div></section>' +
        '<div class="detail-grid">' +
          '<section class="card"><dl class="dl">' + rows + '</dl>' +
            '<p class="small muted" style="margin-top:16px">Cập nhật lúc ' + (x._updated ? UI.date(new Date(x._updated)) : '—') + '</p></section>' +
          '<section class="card qr-card"><h3 class="h4">Mã QR</h3><p class="small muted">Quét để mở nhanh trang này trên điện thoại khác.</p>' +
            '<div class="qr-box" id="qr">' + UI.skeleton(1) + '</div>' +
            '<button type="button" class="btn btn-secondary btn-sm" data-action="copy-link">' + icon('link', 18) + 'Sao chép liên kết</button></section>' +
        '</div>' +
        '<div class="action-bar">' +
          '<a class="btn btn-primary" href="#/sua?id=' + encodeURIComponent(x.id) + '">' + icon('edit', 18) + 'Chỉnh sửa</a>' +
          '<button type="button" class="btn btn-secondary btn-danger-text" data-action="delete" data-id="' + esc(x.id) + '">' + icon('trash', 18) + 'Xóa</button>' +
        '</div>';
    },
    mount: function () {
      var el = document.getElementById('qr');
      if (el) App.renderQR(el, App.itemUrl(App.param('id')));
    },
    on: {
      click: function (e, btn, action) {
        if (action === 'delete') App.deleteItem(btn.getAttribute('data-id'), function () { App.router.go('danh-sach'); });
        if (action === 'copy-link') {
          var url = App.itemUrl(App.param('id'));
          (navigator.clipboard ? navigator.clipboard.writeText(url) : Promise.reject())
            .then(function () { UI.toast('Đã sao chép liên kết'); })
            .catch(function () { UI.toast('Không sao chép được. Hãy giữ lâu vào thanh địa chỉ để sao chép.', 'error'); });
        }
      }
    }
  };
})();
