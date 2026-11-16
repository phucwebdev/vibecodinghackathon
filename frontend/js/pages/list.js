/* TRANG DANH SÁCH – tìm không dấu, lọc trạng thái, sắp xếp, bảng (máy tính) / thẻ (điện thoại) */
(function () {
  'use strict';
  var C = App.config, E = C.entity, esc = UI.esc, icon = UI.icon;
  var PAGE = 20;
  var ui = { q: '', status: 'all', sort: C.sorts[0].value, limit: PAGE };

  function filtered() {
    var sort = C.sorts.find(function (s) { return s.value === ui.sort; }) || C.sorts[0];
    return App.data.all().filter(function (x) {
      if (E.statusField && ui.status !== 'all' && x[E.statusField] !== ui.status) return false;
      return UI.match(ui.q, E.searchFields.map(function (k) { return x[k]; }).join(' '));
    }).sort(function (a, b) {
      var va = a[sort.by], vb = b[sort.by];
      if (typeof va === 'number' || typeof vb === 'number') return ((Number(va) || 0) - (Number(vb) || 0)) * sort.dir;
      return String(va || '').localeCompare(String(vb || ''), 'vi') * sort.dir;
    });
  }

  function chips() {
    if (!E.statusField) return '';
    var all = App.data.all();
    var opts = [{ value: 'all', label: 'Tất cả' }].concat(C.statuses);
    return opts.map(function (o) {
      var n = all.filter(function (x) { return o.value === 'all' || x[E.statusField] === o.value; }).length;
      return '<button type="button" class="chip" data-action="status" data-value="' + esc(o.value) + '" aria-pressed="' + (ui.status === o.value) + '">' +
        esc(o.label) + ' · ' + n + '</button>';
    }).join('');
  }

  function delBtn(x) {
    return '<button type="button" class="btn-icon is-danger" data-action="delete" data-id="' + esc(x.id) + '" aria-label="Xóa ' + esc(App.title(x)) + '">' + icon('trash') + '</button>';
  }

  function results() {
    var list = filtered();
    if (!App.data.all().length) {
      return App.empty('inbox', 'Chưa có ' + E.one + ' nào', 'Thêm ' + E.one + ' đầu tiên hoặc nhập từ file Excel.',
        '<a class="btn btn-primary btn-sm" href="#/them">' + icon('plus') + 'Thêm ' + esc(E.one) + '</a>');
    }
    if (!list.length) {
      return App.empty('search', 'Không tìm thấy kết quả phù hợp', 'Thử từ khóa khác hoặc bỏ bộ lọc.',
        '<button type="button" class="btn btn-secondary btn-sm" data-action="clear">Xóa bộ lọc</button>');
    }
    var shown = list.slice(0, ui.limit);
    var cols = C.fields.filter(function (f) { return f.table; });
    var head = cols.map(function (f) { return '<th scope="col">' + esc(f.label) + '</th>'; }).join('');
    var rows = shown.map(function (x) {
      return '<tr>' + cols.map(function (f) {
        var v = App.fmt(f, x[f.key]);
        if (f.key === E.titleField) return '<td class="cell-strong"><a href="#/chi-tiet?id=' + encodeURIComponent(x.id) + '">' + v + '</a></td>';
        return '<td' + (f.type === 'money' || f.type === 'number' ? ' class="num"' : '') + '>' + v + '</td>';
      }).join('') + '<td class="cell-actions">' + delBtn(x) + '</td></tr>';
    }).join('');

    var cardFields = C.fields.filter(function (f) { return f.card && f.key !== E.statusField; });
    var cards = shown.map(function (x) {
      return '<li class="item item-link"><div class="item-main">' +
        '<a class="item-title stretched" href="#/chi-tiet?id=' + encodeURIComponent(x.id) + '">' + esc(App.title(x)) + '</a>' +
        (E.subtitleField ? '<p class="item-sub">' + esc(x[E.subtitleField] || '') + '</p>' : '') +
        '<div class="item-meta">' + (E.statusField ? App.badge(x[E.statusField]) : '') +
          cardFields.map(function (f) { return '<span>' + App.fmt(f, x[f.key]) + '</span>'; }).join('<span aria-hidden="true">·</span>') +
        '</div></div>' + delBtn(x) + '</li>';
    }).join('');

    return '<p class="small muted" role="status">Có ' + UI.number(list.length) + ' ' + esc(E.one) + '</p>' +
      '<div class="table-wrap only-desktop"><table class="table"><thead><tr>' + head +
        '<th scope="col"><span class="sr-only">Thao tác</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
      '<ul class="list only-mobile">' + cards + '</ul>' +
      (list.length > shown.length ? '<button type="button" class="btn btn-secondary btn-block" data-action="more">Xem thêm ' + Math.min(PAGE, list.length - shown.length) + ' ' + esc(E.one) + '</button>' : '');
  }

  function refresh() {
    var c = document.getElementById('chips'), r = document.getElementById('results');
    if (c) c.innerHTML = chips();
    if (r) r.innerHTML = results();
  }

  /* Xóa có xác nhận + Hoàn tác – dùng chung cho trang chi tiết */
  App.deleteItem = function (id, after) {
    var x = App.data.get(id);
    if (!x) return;
    UI.confirm({
      title: 'Xóa “' + App.title(x) + '”?',
      message: 'Bạn vẫn có thể hoàn tác trong vài giây sau khi xóa.',
      confirmText: 'Xóa ' + E.one,
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      var snap = App.data.remove(id);
      if (after) after();
      App.toastUndo('Đã xóa “' + App.title(x) + '”', function () {
        App.data.restore(snap);
        App.router.refresh();
        UI.toast('Đã khôi phục “' + App.title(x) + '”', 'info');
      });
    });
  };

  App.pages.list = {
    title: (C.menu.find(function (m) { return m.route === 'danh-sach'; }) || { label: 'Danh sách' }).label,
    render: function () {
      var sorts = C.sorts.map(function (s) {
        return '<option value="' + s.value + '"' + (ui.sort === s.value ? ' selected' : '') + '>' + esc(s.label) + '</option>';
      }).join('');
      return '' +
        '<section class="page-head"><div><h2 class="h3">' + esc(this.title) + '</h2><p class="small muted">Chạm vào một ' + esc(E.one) + ' để xem chi tiết.</p></div>' +
          '<a class="btn btn-primary only-desktop-flex" href="#/them">' + icon('plus') + 'Thêm ' + esc(E.one) + '</a></section>' +
        '<div class="stack">' +
          '<div class="toolbar">' +
            '<div class="search"><label for="q" class="sr-only">Tìm kiếm</label>' + icon('search') +
              '<input id="q" class="input" type="search" placeholder="Tìm theo tên, mã… (không cần dấu)" value="' + esc(ui.q) + '" autocomplete="off"></div>' +
            '<div class="field"><label for="sort" class="sr-only">Sắp xếp</label><select id="sort" class="select">' + sorts + '</select></div>' +
          '</div>' +
          (E.statusField ? '<div class="chips" id="chips" role="group" aria-label="Lọc theo trạng thái">' + chips() + '</div>' : '') +
        '</div>' +
        '<div class="stack" id="results">' + results() + '</div>' +
        '<a class="fab only-mobile" href="#/them" aria-label="Thêm ' + esc(E.one) + '">' + icon('plus', 24) + '</a>';
    },
    on: {
      click: function (e, btn, action) {
        if (action === 'status') { ui.status = btn.getAttribute('data-value'); ui.limit = PAGE; refresh(); }
        if (action === 'clear') { ui.q = ''; ui.status = 'all'; var q = document.getElementById('q'); if (q) q.value = ''; refresh(); }
        if (action === 'more') { ui.limit += PAGE; refresh(); }
        if (action === 'delete') App.deleteItem(btn.getAttribute('data-id'), refresh);
      },
      input: function (e) { if (e.target.id === 'q') { ui.q = e.target.value; ui.limit = PAGE; refresh(); } },
      change: function (e) { if (e.target.id === 'sort') { ui.sort = e.target.value; refresh(); } }
    }
  };
})();
