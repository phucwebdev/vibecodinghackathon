/* TRANG TIỆN ÍCH – nhập Excel của BTC · xuất CSV/seed.js · quét QR bằng camera · khôi phục dữ liệu */
(function () {
  'use strict';
  var C = App.config, E = C.entity, esc = UI.esc, icon = UI.icon;
  var SCAN_LIB = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
  var imp = null;        // { sheets, sheet, rows, map, items, unused }
  var scanner = null;

  /* ---------- Ghép cột Excel → trường trong CONFIG ---------- */
  function mapColumns(headers) {
    var map = {}, used = {};
    C.fields.forEach(function (f) {
      var names = [f.key, f.label].concat(f.aliases || []).map(UI.norm);
      var hit = headers.find(function (h) { return !used[h] && names.indexOf(UI.norm(h)) >= 0; }) ||
                headers.find(function (h) { return !used[h] && names.some(function (n) { return n.length > 2 && UI.norm(h).indexOf(n) >= 0; }); });
      if (hit) { map[f.key] = hit; used[hit] = true; }
    });
    return { map: map, unused: headers.filter(function (h) { return !used[h]; }) };
  }

  function toNumber(v) {
    if (typeof v === 'number') return v;
    var s = String(v).replace(/[^\d.,-]/g, '');
    if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, '').replace(',', '.');   // 25.000,5
    else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, '');                // 25,000.5
    else s = s.replace(',', '.');
    var n = Number(s);
    return s === '' || isNaN(n) ? '' : n;
  }
  function toIsoDate(v) {
    if (v instanceof Date && !isNaN(v)) {          // làm tròn về ngày gần nhất để tránh lệch múi giờ
      var d = new Date(Math.round(v.getTime() / 864e5) * 864e5);
      return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
    }
    if (typeof v === 'number' && v > 20000 && v < 80000) return UI.isoDate(new Date(Math.round((v - 25569) * 864e5)));
    var m = /^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/.exec(String(v));
    if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
    m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v));
    return m ? m[0] : String(v);
  }
  function toStatus(v) {
    var n = UI.norm(v);
    var s = C.statuses.find(function (x) { return UI.norm(x.value) === n || UI.norm(x.label) === n; });
    return s ? s.value : String(v).trim();
  }

  function convert(rows, map) {
    var now = Date.now();
    return rows.map(function (r, i) {
      var x = { id: UI.uid(E.idPrefix), _updated: now - i };
      C.fields.forEach(function (f) {
        var raw = map[f.key] ? r[map[f.key]] : '';
        if (raw === '' || raw == null) { x[f.key] = ''; return; }
        if (f.type === 'money' || f.type === 'number') x[f.key] = toNumber(raw);
        else if (f.type === 'date') x[f.key] = toIsoDate(raw);
        else if (f.type === 'status') x[f.key] = toStatus(raw);
        else x[f.key] = String(raw).trim();
      });
      return x;
    }).filter(function (x) { return C.fields.some(function (f) { return x[f.key] !== ''; }); });
  }

  function prepare(sheetName) {
    var rows = imp.sheets[sheetName] || [];
    var headers = rows.length ? Object.keys(rows[0]) : [];
    var m = mapColumns(headers);
    imp.sheet = sheetName; imp.map = m.map; imp.unused = m.unused;
    imp.items = convert(rows, m.map);
  }

  /* ---------- Giao diện nhập ---------- */
  function importHtml() {
    if (!imp) {
      return '<label class="dropzone" for="file">' + icon('upload', 28) +
        '<span class="h4">Chọn file Excel hoặc CSV</span><span class="small muted">Hỗ trợ .xlsx, .xls, .csv · cột được tự ghép theo tên</span>' +
        '<input id="file" type="file" accept=".xlsx,.xls,.csv" class="sr-only"></label>';
    }
    var names = Object.keys(imp.sheets);
    var mapped = Object.keys(imp.map).length;
    var sheetSel = names.length > 1
      ? '<div class="field"><label class="label" for="sheet">Trang tính</label><select id="sheet" class="select">' +
        names.map(function (n) { return '<option' + (n === imp.sheet ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('') + '</select></div>'
      : '';
    var preview = imp.items.slice(0, 5).map(function (x) {
      return '<li class="item"><div class="item-main"><p class="item-title">' + esc(App.title(x)) + '</p>' +
        '<div class="item-meta">' + C.fields.filter(function (f) { return imp.map[f.key] && f.key !== E.titleField; }).slice(0, 4)
          .map(function (f) { return '<span>' + App.fmt(f, x[f.key]) + '</span>'; }).join('<span aria-hidden="true">·</span>') + '</div></div></li>';
    }).join('');
    var mapList = C.fields.map(function (f) {
      return '<li>' + (imp.map[f.key] ? icon('check-circle', 16) : icon('x', 16)) + '<span><strong>' + esc(f.label) + '</strong> ← ' +
        (imp.map[f.key] ? '“' + esc(imp.map[f.key]) + '”' : '<span class="muted">không có cột phù hợp</span>') + '</span></li>';
    }).join('');

    return '<div class="stack">' + sheetSel +
      '<div class="info-box">' + icon('info') + '<p>Đọc được <strong>' + UI.number(imp.items.length) + ' dòng</strong> từ “' + esc(imp.sheet) + '”, ghép ' + mapped + '/' + C.fields.length + ' cột.</p></div>' +
      '<details class="details"><summary class="small">Xem cách ghép cột</summary><ul class="maplist">' + mapList + '</ul>' +
        (imp.unused.length ? '<p class="small muted">Các cột chưa dùng: ' + esc(imp.unused.join(', ')) + '</p>' : '') + '</details>' +
      (imp.items.length ? '<p class="label">Xem trước 5 dòng đầu</p><ul class="list">' + preview + '</ul>' : App.empty('alert-circle', 'Không có dòng nào đọc được', 'Kiểm tra lại trang tính hoặc dòng tiêu đề của file.')) +
      '<div class="form-actions">' +
        '<button type="button" class="btn btn-primary" data-action="import-replace"' + (imp.items.length ? '' : ' disabled') + '>Dùng dữ liệu này</button>' +
        '<button type="button" class="btn btn-secondary" data-action="import-append"' + (imp.items.length ? '' : ' disabled') + '>Thêm vào dữ liệu hiện có</button>' +
        '<button type="button" class="btn btn-text" data-action="import-cancel">Chọn file khác</button>' +
      '</div></div>';
  }

  function refreshImport() {
    var el = document.getElementById('import-box');
    if (el) el.innerHTML = importHtml();
  }

  /* ---------- Xuất ---------- */
  function csv() {
    var cell = function (v) { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var lines = [C.fields.map(function (f) { return cell(f.label); }).join(',')];
    App.data.all().forEach(function (x) {
      lines.push(C.fields.map(function (f) { return cell(f.type === 'status' ? App.status(x[f.key]).label : x[f.key]); }).join(','));
    });
    return '﻿' + lines.join('\r\n');
  }
  function seedJs(list) {
    var clean = list.map(function (x) { var o = Object.assign({}, x); delete o._updated; return o; });
    return '/* Dữ liệu mẫu – xuất từ app ngày ' + UI.date(new Date()) + ' */\nwindow.SEED = ' + JSON.stringify(clean, null, 2) + ';\n';
  }

  /* ---------- Quét QR ---------- */
  function stopScan() {
    if (scanner) { var s = scanner; scanner = null; s.stop().catch(function () {}).then(function () { try { s.clear(); } catch (e) { /* bỏ qua */ } }); }
    var btn = document.getElementById('scan-btn');
    if (btn) btn.innerHTML = icon('camera', 18) + 'Mở camera quét mã';
  }
  function onScan(text) {
    stopScan();
    var hash = text.indexOf('#/') >= 0 ? text.slice(text.indexOf('#/')) : '';
    if (hash) { location.hash = hash; return; }
    var n = UI.norm(text);
    var hit = App.data.all().find(function (x) { return E.searchFields.some(function (k) { return UI.norm(x[k]) === n; }); });
    if (hit) App.router.go('chi-tiet?id=' + encodeURIComponent(hit.id));
    else UI.toast('Không tìm thấy ' + E.one + ' khớp với mã “' + text + '”.', 'error');
  }
  function startScan() {
    var btn = document.getElementById('scan-btn');
    if (scanner) { stopScan(); return; }
    btn.innerHTML = icon('clock', 18) + 'Đang mở camera…';
    App.loadScript(SCAN_LIB).then(function () {
      scanner = new window.Html5Qrcode('reader');
      return scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 220, height: 220 } }, onScan, function () {});
    }).then(function () {
      btn.innerHTML = icon('x', 18) + 'Tắt camera';
    }).catch(function () {
      scanner = null;
      btn.innerHTML = icon('camera', 18) + 'Mở camera quét mã';
      UI.toast('Không mở được camera. Hãy cho phép quyền camera và dùng đường dẫn https.', 'error');
    });
  }

  App.pages.tools = {
    title: 'Tiện ích',
    render: function () {
      return '' +
        '<section class="page-head"><div><h2 class="h3">Tiện ích</h2><p class="small muted">Nhập, xuất dữ liệu và quét mã QR.</p></div></section>' +
        '<div class="grid-2">' +
          '<section class="card stack"><div><h3 class="h4">Nhập dữ liệu từ Excel</h3><p class="small muted">Dùng file dữ liệu mẫu để có ngay danh sách ' + esc(E.one) + '.</p></div>' +
            '<div id="import-box">' + importHtml() + '</div></section>' +
          '<div class="stack">' +
            '<section class="card stack"><div><h3 class="h4">Quét mã QR</h3><p class="small muted">Quét mã trên ' + esc(E.one) + ' để mở trang chi tiết.</p></div>' +
              '<div id="reader" class="reader"></div>' +
              '<button type="button" class="btn btn-primary btn-block" id="scan-btn" data-action="scan">' + icon('camera', 18) + 'Mở camera quét mã</button></section>' +
            '<section class="card stack"><div><h3 class="h4">Xuất dữ liệu</h3><p class="small muted">Có ' + UI.number(App.data.all().length) + ' ' + esc(E.one) + ' đang lưu trên máy này.</p></div>' +
              '<div class="form-actions">' +
                '<button type="button" class="btn btn-secondary" data-action="export-csv">' + icon('download', 18) + 'Tải file Excel (CSV)</button>' +
                '<button type="button" class="btn btn-secondary" data-action="export-seed">' + icon('download', 18) + 'Tải file seed.js</button>' +
              '</div></section>' +
            '<section class="card stack"><div><h3 class="h4">Khôi phục</h3><p class="small muted">Đưa dữ liệu về trạng thái ban đầu.</p></div>' +
              '<button type="button" class="btn btn-secondary btn-danger-text" data-action="reset">' + icon('refresh', 18) + 'Khôi phục dữ liệu mẫu</button></section>' +
          '</div>' +
        '</div>';
    },
    leave: stopScan,
    on: {
      change: function (e) {
        if (e.target.id === 'file' && e.target.files[0]) {
          var file = e.target.files[0];
          document.getElementById('import-box').innerHTML = UI.skeleton(2);
          UI.readSheet(file).then(function (sheets) {
            imp = { sheets: sheets };
            var first = Object.keys(sheets).find(function (n) { return sheets[n].length; }) || Object.keys(sheets)[0];
            prepare(first);
            refreshImport();
          }).catch(function () {
            imp = null; refreshImport();
            UI.toast('Không đọc được file. Hãy chọn file .xlsx, .xls hoặc .csv còn nguyên vẹn.', 'error');
          });
        }
        if (e.target.id === 'sheet') { prepare(e.target.value); refreshImport(); }
      },
      click: function (e, btn, action) {
        if (action === 'scan') startScan();
        if (action === 'import-cancel') { imp = null; refreshImport(); }
        if (action === 'import-append') {
          App.data.append(imp.items);
          UI.toast('Đã thêm ' + UI.number(imp.items.length) + ' ' + E.one + ' từ file');
          imp = null; App.router.go('danh-sach');
        }
        if (action === 'import-replace') {
          UI.confirm({ title: 'Thay toàn bộ dữ liệu?', message: 'Dữ liệu hiện có sẽ được thay bằng ' + imp.items.length + ' dòng từ file.', confirmText: 'Thay dữ liệu', danger: true })
            .then(function (ok) {
              if (!ok) return;
              App.data.replaceAll(imp.items);
              UI.toast('Đã nhập ' + UI.number(imp.items.length) + ' ' + E.one + ' từ file');
              imp = null; App.router.go('danh-sach');
            });
        }
        if (action === 'export-csv') { App.download('du-lieu-' + UI.isoDate(new Date()) + '.csv', csv(), 'text/csv;charset=utf-8'); UI.toast('Đã tải file CSV'); }
        if (action === 'export-seed') { App.download('seed.js', seedJs(App.data.all()), 'text/javascript;charset=utf-8'); UI.toast('Đã tải seed.js – chép đè vào thư mục data/'); }
        if (action === 'reset') {
          UI.confirm({ title: 'Khôi phục dữ liệu mẫu?', message: 'Mọi thay đổi trên máy này sẽ được thay bằng dữ liệu ban đầu.', confirmText: 'Khôi phục', danger: true })
            .then(function (ok) {
              if (!ok) return;
              App.data.reset(); App.router.refresh();
              UI.toast('Đã khôi phục dữ liệu mẫu', 'info');
            });
        }
      }
    }
  };
})();
