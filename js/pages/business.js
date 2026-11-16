/* TRANG MÔ HÌNH KINH DOANH (bảng Kinh tế)
   Giả định chỉnh được + nguồn · 3 kịch bản · hòa vốn · hoàn vốn · biên lợi nhuận sau ưu đãi
   Bảng Kỹ thuật không cần: xóa mục 'kinh-doanh' trong CONFIG.menu là xong. */
(function () {
  'use strict';
  var C = App.config, B = C.business, esc = UI.esc, icon = UI.icon;

  function defaults() {
    var o = {};
    B.assumptions.forEach(function (a) { o[a.key] = a.value; });
    return o;
  }
  var A = Object.assign(defaults(), App.state.get('business', {}));

  /* ---------- Tính toán ---------- */
  function unitEconomics() {
    var discountAvg = (A.discount / 100) * (A.discountShare / 100);     // giảm giá bình quân trên mọi đơn
    var netPrice = A.price * (1 - discountAvg);
    var unitCost = A.price * (A.varCost / 100);
    return { netPrice: netPrice, unitCost: unitCost, margin: netPrice - unitCost,
      marginDiscounted: A.price * (1 - A.discount / 100) - unitCost };
  }

  function simulate(sc) {
    var u = unitEconomics();
    var orders = [], revenue = [], profit = [], cumulative = [];
    var cum = -A.invest, payback = 0;
    for (var m = 0; m < B.months; m++) {
      var o = A.orders * sc.orders * Math.pow(1 + (A.growth / 100) * sc.growth, m);
      var rev = o * u.netPrice;
      var p = o * u.margin - A.fixedCost;
      cum += p;
      if (!payback && cum >= 0) payback = m + 1;
      orders.push(o); revenue.push(rev); profit.push(p); cumulative.push(cum);
    }
    var sum = function (a) { return a.reduce(function (s, v) { return s + v; }, 0); };
    return {
      sc: sc, orders: orders, revenue: revenue, profit: profit, cumulative: cumulative,
      totalRevenue: sum(revenue), totalProfit: sum(profit), payback: payback,
      breakEven: u.margin > 0 ? A.fixedCost / u.margin : Infinity
    };
  }

  /* ---------- Giao diện ---------- */
  function input(a) {
    var id = 'a-' + a.key;
    var suffix = a.type === 'percent' ? '%' : a.type === 'money' ? '₫' : (a.unit || '');
    return '<div class="field">' +
      '<label class="label" for="' + id + '">' + esc(a.label) + '</label>' +
      '<div class="input-suffix"><input class="input" type="number" inputmode="decimal" step="any" min="0" id="' + id + '" name="' + a.key + '" value="' + esc(A[a.key]) + '" aria-describedby="' + id + '-hint ' + id + '-err">' +
      (suffix ? '<span aria-hidden="true">' + esc(suffix) + '</span>' : '') + '</div>' +
      '<p class="field-hint" id="' + id + '-hint">Nguồn: ' + esc(a.source) + '</p>' +
      '<p class="field-error" id="' + id + '-err" hidden></p></div>';
  }

  function assumptionsHtml() {
    var groups = [];
    B.assumptions.forEach(function (a) { if (groups.indexOf(a.group) < 0) groups.push(a.group); });
    return groups.map(function (g) {
      return '<fieldset class="fieldset"><legend class="h4">' + esc(g) + '</legend><div class="form-grid">' +
        B.assumptions.filter(function (a) { return a.group === g; }).map(input).join('') + '</div></fieldset>';
    }).join('');
  }

  function short(v) { return App.short(v, 'money') + (Math.abs(v) >= 1e6 ? ' ₫' : ''); }

  function results() {
    var u = unitEconomics();
    var sims = B.scenarios.map(simulate);
    var base = sims.find(function (s) { return s.sc.key === 'co-so'; }) || sims[0];
    var unit = B.unitLabel;

    var warn = u.marginDiscounted <= 0
      ? '<div class="alert alert-danger">' + icon('alert-circle') + '<p><strong>Ưu đãi đang làm lỗ:</strong> đơn có giảm giá chỉ thu ' + UI.money(A.price * (1 - A.discount / 100)) +
        ' nhưng chi phí là ' + UI.money(u.unitCost) + '. Hãy giảm mức ưu đãi hoặc chi phí biến đổi.</p></div>'
      : '<div class="alert alert-success">' + icon('check-circle') + '<p>Ưu đãi vẫn có lãi: mỗi ' + esc(unit) + ' giảm giá còn lãi <strong>' + UI.money(u.marginDiscounted) +
        '</strong>; lãi bình quân mỗi ' + esc(unit) + ' là <strong>' + UI.money(u.margin) + '</strong>.</p></div>';

    var cards = sims.map(function (s) {
      var be = isFinite(s.breakEven)
        ? UI.number(Math.ceil(s.breakEven)) + ' ' + esc(unit) + '/tháng <span class="muted">(~' + UI.number(Math.ceil(s.breakEven / 30)) + '/ngày)</span>'
        : '<span class="text-danger">Không đạt</span>';
      return '<article class="card scenario scenario-' + s.sc.tone + '">' +
        '<div class="section-head"><h3 class="h4">' + esc(s.sc.label) + '</h3><span class="badge badge-' + s.sc.tone + '">×' + String(s.sc.orders).replace('.', ',') + ' số ' + esc(unit) + '</span></div>' +
        '<dl class="dl dl-compact">' +
          '<div class="dl-row"><dt>Doanh thu năm đầu</dt><dd>' + short(s.totalRevenue) + '</dd></div>' +
          '<div class="dl-row"><dt>Lợi nhuận năm đầu</dt><dd class="' + (s.totalProfit < 0 ? 'text-danger' : 'text-success') + '">' + short(s.totalProfit) + '</dd></div>' +
          '<div class="dl-row"><dt>Điểm hòa vốn</dt><dd>' + be + '</dd></div>' +
          '<div class="dl-row"><dt>Hoàn vốn đầu tư</dt><dd>' + (s.payback ? 'Tháng thứ ' + s.payback : '<span class="text-danger">Sau ' + B.months + ' tháng</span>') + '</dd></div>' +
        '</dl></article>';
    }).join('');

    var labels = base.orders.map(function (_, i) { return 'T' + (i + 1); });
    var chart = App.chart.lines(sims.map(function (s) { return { label: s.sc.label, tone: s.sc.tone, values: s.cumulative }; }), labels, 'money');

    var rows = base.orders.map(function (o, i) {
      return '<tr><td>T' + (i + 1) + '</td><td class="num">' + UI.number(Math.round(o)) + '</td><td class="num">' + short(base.revenue[i]) +
        '</td><td class="num ' + (base.profit[i] < 0 ? 'text-danger' : '') + '">' + short(base.profit[i]) + '</td></tr>';
    }).join('');

    return warn +
      '<div class="scenario-grid">' + cards + '</div>' +
      '<section class="card"><div class="section-head"><h3 class="h4">Dòng tiền lũy kế (sau khi trừ vốn đầu tư)</h3><span class="badge badge-neutral">Mô phỏng</span></div>' + chart +
        '<p class="small muted">Đường cắt trục 0 là thời điểm hoàn vốn.</p></section>' +
      '<details class="card details"><summary class="h4">Chi tiết theo tháng – kịch bản ' + esc(base.sc.label.toLowerCase()) + '</summary>' +
        '<div class="table-wrap" style="margin-top:12px"><table class="table"><thead><tr><th scope="col">Tháng</th><th scope="col" class="num">Số ' + esc(unit) +
        '</th><th scope="col" class="num">Doanh thu</th><th scope="col" class="num">Lợi nhuận</th></tr></thead><tbody>' + rows + '</tbody></table></div></details>';
  }

  function refresh() {
    var r = document.getElementById('biz-results');
    if (r) r.innerHTML = results();
  }

  App.pages.business = {
    title: 'Mô hình kinh doanh',
    render: function () {
      return '' +
        '<section class="page-head"><div><h2 class="h3">Mô hình kinh doanh</h2>' +
          '<p class="small muted">Chỉnh giả định, kết quả 3 kịch bản cập nhật ngay.</p></div>' +
          '<button type="button" class="btn btn-secondary btn-sm" data-action="reset-biz">' + icon('refresh', 18) + 'Về giả định ban đầu</button></section>' +
        '<div class="biz-layout">' +
          '<form class="card form" id="biz-form" novalidate><h3 class="h4">Giả định <span class="badge badge-neutral">Dữ liệu mẫu</span></h3>' + assumptionsHtml() + '</form>' +
          '<div class="stack" id="biz-results" aria-live="polite">' + results() + '</div>' +
        '</div>';
    },
    on: {
      input: function (e) {
        var key = e.target.name;
        if (!key || !(key in A)) return;
        var v = e.target.value === '' ? NaN : Number(e.target.value);
        if (isNaN(v) || v < 0) { App.setError('a-' + key, 'Vui lòng nhập số không âm.'); return; }
        App.setError('a-' + key, '');
        A[key] = v;
        App.state.set('business', A);
        refresh();
      },
      submit: function (e) { e.preventDefault(); },
      click: function (e, btn, action) {
        if (action !== 'reset-biz') return;
        A = defaults();
        App.state.set('business', A);
        App.router.refresh();
        UI.toast('Đã khôi phục giả định ban đầu', 'info');
      }
    }
  };
})();
