/* TRANG THÊM / SỬA – form tự sinh từ CONFIG.fields, kiểm tra khi gửi, báo lỗi dưới ô */
(function () {
  'use strict';
  var C = App.config, E = C.entity, esc = UI.esc, icon = UI.icon;

  function control(f, val) {
    var id = 'f-' + f.key;
    var common = ' id="' + id + '" name="' + f.key + '" aria-describedby="' + id + '-err' + (f.hint || isNum(f) ? ' ' + id + '-hint' : '') + '"' + (f.required ? ' aria-required="true"' : '');
    var v = val == null ? '' : val;
    switch (f.type) {
      case 'textarea':
        return '<textarea class="textarea"' + common + ' placeholder="' + esc(f.placeholder || '') + '">' + esc(v) + '</textarea>';
      case 'select':
      case 'status':
        var opts = f.type === 'status' ? C.statuses.slice() : (f.options || []).map(function (o) { return { value: o, label: o }; });
        /* Giá trị nhập từ Excel không có trong danh sách → vẫn giữ để không mất dữ liệu khi sửa */
        if (v !== '' && !opts.some(function (o) { return String(o.value) === String(v); })) opts.push({ value: v, label: f.type === 'status' ? App.status(v).label : v });
        return '<select class="select"' + common + '><option value="">Chọn ' + esc(f.label.toLowerCase()) + '</option>' +
          opts.map(function (o) { return '<option value="' + esc(o.value) + '"' + (String(v) === String(o.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('') +
          '</select>';
      case 'money':
      case 'number':
        return '<input class="input" type="number" inputmode="' + (f.type === 'money' ? 'numeric' : 'decimal') + '"' + common +
          (f.min != null ? ' min="' + f.min + '"' : '') + (f.max != null ? ' max="' + f.max + '"' : '') +
          ' step="any" placeholder="' + esc(f.placeholder || '') + '" value="' + esc(v) + '">';
      case 'date':
        return '<input class="input" type="date"' + common + ' value="' + esc(v) + '">';
      case 'tel':
        return '<input class="input" type="tel" inputmode="tel" autocomplete="tel"' + common + ' placeholder="' + esc(f.placeholder || '') + '" value="' + esc(v) + '">';
      case 'email':
        return '<input class="input" type="email" inputmode="email" autocomplete="email"' + common + ' placeholder="' + esc(f.placeholder || '') + '" value="' + esc(v) + '">';
      default:
        return '<input class="input" type="text" autocomplete="off"' + common + ' placeholder="' + esc(f.placeholder || '') + '" value="' + esc(v) + '">';
    }
  }
  function isNum(f) { return f.type === 'money' || f.type === 'number'; }

  function hintText(f, v) {
    if (f.type === 'money' && v !== '' && !isNaN(v)) return '= ' + UI.money(v);
    if (f.type === 'number' && f.unit) return 'Đơn vị: ' + f.unit;
    return f.hint || '';
  }

  function fieldHtml(f, val) {
    var id = 'f-' + f.key;
    var wide = f.type === 'textarea' ? ' field-wide' : '';
    var hint = hintText(f, val == null ? '' : val);
    return '<div class="field' + wide + '">' +
      '<label class="label" for="' + id + '">' + esc(f.label) + (f.required ? '' : ' <span class="optional">(không bắt buộc)</span>') + '</label>' +
      control(f, val) +
      '<p class="field-hint" id="' + id + '-hint"' + (hint ? '' : ' hidden') + '>' + esc(hint) + '</p>' +
      '<p class="field-error" id="' + id + '-err" hidden></p></div>';
  }

  function readForm(form) {
    var out = {};
    C.fields.forEach(function (f) {
      var el = form.elements[f.key];
      if (!el) return;
      var v = el.value.trim();
      out[f.key] = isNum(f) ? (v === '' ? '' : Number(v)) : v;
    });
    return out;
  }

  function validate(data, editingId) {
    var errors = {};
    C.fields.forEach(function (f) {
      var v = data[f.key];
      if (f.required && (v === '' || v == null)) { errors[f.key] = 'Vui lòng ' + (f.type === 'select' || f.type === 'status' ? 'chọn ' : 'nhập ') + f.label.toLowerCase() + '.'; return; }
      if (v === '' || v == null) return;
      if (isNum(f) && isNaN(v)) errors[f.key] = f.label + ' phải là số.';
      else if (isNum(f) && f.min != null && v < f.min) errors[f.key] = f.label + ' không được nhỏ hơn ' + UI.number(f.min) + '.';
      else if (isNum(f) && f.max != null && v > f.max) errors[f.key] = f.label + ' không được lớn hơn ' + UI.number(f.max) + '.';
      else if (f.type === 'email' && !/^\S+@\S+\.\S+$/.test(v)) errors[f.key] = 'Email chưa đúng định dạng, ví dụ: ten@gmail.com.';
      else if (f.type === 'tel' && !/^(0|\+84)\d{9,10}$/.test(v.replace(/[\s.]/g, ''))) errors[f.key] = 'Số điện thoại gồm 10 số, ví dụ: 0912345678.';
      else if (f.unique && App.data.all().some(function (x) { return x.id !== editingId && UI.norm(x[f.key]) === UI.norm(v); })) {
        errors[f.key] = f.label + ' “' + v + '” đã tồn tại. Vui lòng nhập giá trị khác.';
      }
    });
    return errors;
  }

  function page(mode) {
    return {
      title: mode === 'add' ? 'Thêm ' + E.one : 'Chỉnh sửa',
      parent: mode === 'add' ? 'them' : 'danh-sach',
      render: function () {
        var x = mode === 'edit' ? App.data.get(App.param('id')) : null;
        if (mode === 'edit' && !x) {
          return App.empty('search', 'Không tìm thấy ' + E.one, 'Có thể ' + E.one + ' này đã bị xóa.', '<a class="btn btn-secondary btn-sm" href="#/danh-sach">Về danh sách</a>');
        }
        var defaults = {};
        if (!x) C.fields.forEach(function (f) {
          if (f.type === 'date') defaults[f.key] = UI.isoDate(new Date());
          if (f.type === 'status' && C.statuses[0]) defaults[f.key] = C.statuses[0].value;
        });
        var src = x || defaults;
        return '' +
          (x ? '<a class="btn btn-text back-link" href="#/chi-tiet?id=' + encodeURIComponent(x.id) + '">' + icon('arrow-left', 18) + 'Quay lại</a>' : '') +
          '<section class="page-head"><div><h2 class="h3">' + (x ? 'Chỉnh sửa “' + esc(App.title(x)) + '”' : 'Thêm ' + esc(E.one)) + '</h2>' +
          '<p class="small muted">Các ô không ghi “không bắt buộc” cần được điền.</p></div></section>' +
          '<form class="card form" id="item-form" novalidate data-mode="' + mode + '"' + (x ? ' data-id="' + esc(x.id) + '"' : '') + '>' +
            '<div class="form-grid">' + C.fields.map(function (f) { return fieldHtml(f, src[f.key]); }).join('') + '</div>' +
            '<div class="form-actions">' +
              '<button type="submit" class="btn btn-primary">' + (x ? 'Lưu thay đổi' : 'Thêm ' + esc(E.one)) + '</button>' +
              '<a class="btn btn-secondary" href="' + (x ? '#/chi-tiet?id=' + encodeURIComponent(x.id) : '#/danh-sach') + '">Hủy</a>' +
            '</div>' +
          '</form>';
      },
      on: {
        input: function (e) {
          var name = e.target.name, f = name && App.field(name);
          if (!f) return;
          App.setError('f-' + name, '');
          var hint = document.getElementById('f-' + name + '-hint');
          if (hint && isNum(f)) { var t = hintText(f, e.target.value); hint.textContent = t; hint.hidden = !t; }
        },
        change: function (e) { if (e.target.name) App.setError('f-' + e.target.name, ''); },
        submit: function (e) {
          if (e.target.id !== 'item-form') return;
          e.preventDefault();
          var form = e.target, id = form.getAttribute('data-id');
          var data = readForm(form);
          var errors = validate(data, id);
          var first = null;
          C.fields.forEach(function (f) {
            App.setError('f-' + f.key, errors[f.key] || '');
            if (errors[f.key] && !first) first = 'f-' + f.key;
          });
          if (first) {
            document.getElementById(first).focus();
            UI.toast('Vui lòng kiểm tra lại các ô được đánh dấu đỏ.', 'error');
            return;
          }
          var saved = id ? App.data.update(id, data) : App.data.add(data);
          UI.toast(id ? 'Đã lưu thay đổi' : 'Đã thêm “' + App.title(saved) + '”');
          App.router.go('chi-tiet?id=' + encodeURIComponent(saved.id));
        }
      }
    };
  }

  App.pages.add = page('add');
  App.pages.edit = page('edit');
})();
