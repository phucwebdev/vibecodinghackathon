/* TRANG TỔNG QUAN – 3–4 con số + 1 biểu đồ + việc cần làm + lối tắt */
(function () {
  'use strict';
  var C = App.config, esc = UI.esc, icon = UI.icon;

  function stat(s, items) {
    var v = s.value(items);
    var cls = s.tone === 'danger' ? (v ? 'text-danger' : '') : s.tone === 'primary' ? 'text-primary' : '';
    /* Tiền lớn rút gọn (12,5 tr ₫) để vừa ô số liệu trên điện thoại; rê chuột xem số đầy đủ */
    var shown = (s.format === 'money' && Math.abs(v) >= 1e6) ? App.short(v, 'money') + ' ₫' : App.fmtValue(s.format, v);
    return '<div class="stat"><p class="stat-value ' + cls + '" title="' + esc(App.fmtValue(s.format, v)) + '">' + shown + '</p>' +
      '<p class="stat-label">' + esc(s.label) + '</p></div>';
  }

  function chartData(items) {
    var ch = C.chart, groups = {};
    var f = App.field(ch.groupBy);
    items.forEach(function (x) {
      var k = x[ch.groupBy] || 'Khác';
      if (f && f.type === 'status') k = App.status(k).label;
      groups[k] = (groups[k] || 0) + (ch.value ? ch.value(x) : 1);
    });
    return Object.keys(groups).map(function (k) { return { label: k, value: groups[k] }; })
      .sort(function (a, b) { return b.value - a.value; });
  }

  function row(x) {
    var sub = C.entity.subtitleField ? x[C.entity.subtitleField] : '';
    return '<li class="item item-link"><div class="item-main">' +
      '<a class="item-title stretched" href="#/chi-tiet?id=' + encodeURIComponent(x.id) + '">' + esc(App.title(x)) + '</a>' +
      (sub ? '<p class="item-sub">' + esc(sub) + '</p>' : '') + '</div>' +
      (C.entity.statusField ? App.badge(x[C.entity.statusField]) : '') + icon('chevron-right') + '</li>';
  }

  App.pages.home = {
    title: 'Tổng quan',
    render: function () {
      var items = App.data.all();
      var now = new Date();
      var att = items.filter(C.attention.filter);
      var addBtn = '<a class="btn btn-primary" href="#/them">' + icon('plus') + 'Thêm ' + esc(C.entity.one) + '</a>';

      return '' +
        '<section class="page-head">' +
          '<div><p class="eyebrow">' + UI.weekday(now) + ', ' + UI.date(now) + '</p><h2 class="h2">' + esc(C.greeting) + '</h2>' +
          '<p class="small muted">' + esc(C.tagline) + '</p></div>' +
          '<div class="only-desktop-flex">' + addBtn + '</div>' +
        '</section>' +

        '<div class="stat-grid">' + C.stats.map(function (s) { return stat(s, items); }).join('') + '</div>' +

        '<div class="only-mobile">' + addBtn.replace('class="btn btn-primary"', 'class="btn btn-primary btn-block"') + '</div>' +

        '<div class="grid-2">' +
          '<section class="card">' +
            '<div class="section-head"><h3 class="h4">' + esc(C.chart.title) + '</h3><span class="badge badge-neutral">Dữ liệu mẫu</span></div>' +
            App.chart.bars(chartData(items), C.chart.format) +
          '</section>' +
          '<section>' +
            '<div class="section-head"><h3 class="h4">' + esc(C.attention.title) + (att.length ? ' <span class="badge badge-danger">' + att.length + '</span>' : '') + '</h3>' +
            '<a class="btn btn-text" href="#/danh-sach">Xem tất cả</a></div>' +
            (att.length
              ? '<ul class="list">' + att.slice(0, 5).map(row).join('') + '</ul>'
              : App.empty('check-circle', 'Không có việc cần xử lý', C.attention.emptyText)) +
          '</section>' +
        '</div>' +

        (items.length ? '' : App.empty('inbox', 'Chưa có ' + C.entity.one + ' nào', 'Thêm ' + C.entity.one + ' đầu tiên hoặc nhập từ file Excel.',
          '<div class="row" style="justify-content:center">' + addBtn + '<a class="btn btn-secondary" href="#/tien-ich">' + icon('upload') + 'Nhập từ Excel</a></div>'));
    }
  };
})();
