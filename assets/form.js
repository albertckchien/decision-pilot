// 填寫流程：一步一頁，欄位照 decision-report/pilot/表單題目.md 和 templates/intake_form.md 第二步。
(function () {
  var AGES = ['25 以下', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60 以上'];
  var ROLES = ['上班族', '高階主管', '老闆或創業者', '自由工作者', '待業', '學生', '退休'];
  var STEPS = [
    { id: 'consent', title: '先說好怎麼用你的資料', fields: [
      { k: 'invite', label: '讀書會邀請碼', type: 'text', req: true, hint: window.PILOT.INVITE_HINT },
      { k: 'consent', label: '我看過上面的說明，同意照這些方式使用我的資料', type: 'check', req: true }
    ] },
    { id: 'contact', title: '怎麼聯絡你', fields: [
      { k: 'name', label: '稱呼', type: 'text', req: true, hint: '暱稱就好，報告裡不會出現你的全名' },
      { k: 'email', label: 'Email', type: 'email', req: true, hint: '問題卡、追問和報告好了都會寄到這裡' },
      { k: 'line', label: 'LINE ID', type: 'text', hint: '選填，比較急的追問會用 LINE 問你' }
    ] },
    { id: 'you', title: '關於你', fields: [
      { k: 'age', label: '年齡', type: 'select', opts: AGES, req: true },
      { k: 'place', label: '所在國家和城市', type: 'text', req: true, hint: '例如「台灣 台北」，寫到城市就好' },
      { k: 'role', label: '角色', type: 'radio', opts: ROLES, req: true },
      { k: 'company', label: '公司名稱', type: 'text', hint: '我們會上網查這家公司的公開資訊，讓報告更準；待業的寫前一份' },
      { k: 'website', label: '公司官網', type: 'url', hint: '網址，例如 https://example.com' },
      { k: 'title', label: '職稱', type: 'text', hint: '照你平常的寫法' },
      { k: 'industry', label: '產業', type: 'text', req: true, hint: '例如「醫療器材」「餐飲」「軟體」' },
      { k: 'family', label: '家庭狀況', type: 'checks', opts: ['有學齡前或學齡的小孩', '要照顧父母', '有房貸', '配偶沒有收入', '自己或家人需要長期照顧', '都沒有'], hint: '不用寫原因' }
    ] },
    { id: 'goals', title: '你最在乎的三件事', fields: [
      { k: 'goal1', label: '第一名', type: 'text', req: true, hint: '用自己的話寫一句，例如「小孩上小學前全家在一起」' },
      { k: 'goal2', label: '第二名', type: 'text', req: true },
      { k: 'goal3', label: '第三名', type: 'text', req: true },
      { k: 'habit', label: '你做決定的習慣', type: 'radio', opts: ['先做再說', '想清楚再做', '問過身邊的人才做'], req: true },
      { k: 'risk', label: '能承受多少風險', type: 'radio', opts: ['低', '中', '高'], req: true },
      { k: 'edge', label: '你有什麼別人比較少有的', type: 'area', small: true, hint: '經驗、人脈、資料、資源，列 1～3 樣' },
      { k: 'twoSides', label: '你同時懂哪兩邊', type: 'area', small: true, hint: '例如兩個國家、兩個產業、兩種人；沒有就空著' },
      { k: 'savings', label: '個人存款大約多少', type: 'select', opts: ['不想說', '50 萬以下', '50–200 萬', '200–500 萬', '500–1,000 萬', '1,000 萬以上'] },
      { k: 'spend', label: '每月固定支出大約多少', type: 'text', hint: '例如 6 萬' }
    ] },
    { id: 'biz', title: '公司的狀況', when: function (d) { return d.role === '高階主管' || d.role === '老闆或創業者'; }, fields: [
      { k: 'staff', label: '員工數', type: 'text' },
      { k: 'years', label: '成立幾年', type: 'text' },
      { k: 'revenue', label: '年營收級距', type: 'select', opts: ['不想說', '1,000 萬以下', '1,000 萬–5,000 萬', '5,000 萬–2 億', '2 億–10 億', '10 億以上'] },
      { k: 'profit', label: '現在有沒有賺錢', type: 'radio', opts: ['有', '打平', '還在虧'] },
      { k: 'cash', label: '公司現金大約多少', type: 'text' },
      { k: 'flow', label: '每月營收和每月支出', type: 'text', hint: '例如「營收 95 萬、支出 145 萬」' },
      { k: 'b2b', label: '客戶主要是企業還是個人', type: 'radio', opts: ['企業', '個人', '都有'] },
      { k: 'familyBiz', label: '是不是家族企業', type: 'radio', opts: ['是', '不是'] }
    ] },
    { id: 'problem', title: '你卡在哪裡', fields: [
      { k: 'story', label: '把卡住的事寫下來', type: 'area', req: true, min: 120, hint: '照你跟朋友講的方式寫：在考慮哪幾個選項、各自要付出什麼、你擔心什麼、身邊的人怎麼說。建議 300～1,500 字，寫得越具體報告越準。' },
      { k: 'deadline', label: '多久內要決定', type: 'radio', opts: ['1 週內', '1 個月內', '3 個月內', '半年內', '沒有期限'], req: true },
      { k: 'kind', label: '想要哪一種報告', type: 'radio', opts: ['分析報告（約 5～6 頁）', '完整報告（約 10 頁，多了執行計畫和檢查點）'], req: true }
    ] },
    { id: 'files', title: '有文件可以給我們看嗎', fields: [
      { k: 'files', label: '附件', type: 'files', hint: '合約、offer、財報、企劃書都可以。最多 3 個、每個 8MB 以內，PDF、Word、Excel、圖片。上傳前請先遮掉身分證字號、帳號、別人的全名。' }
    ] }
  ];
  var MAX_FILES = 3, MAX_BYTES = 8 * 1024 * 1024;
  var OK_TYPES = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|heic|webp|txt|md)$/i;

  var data = window.safeStore.get('pilot-draft') || {};
  var files = [];
  var stepIx = 0;
  var root = document.getElementById('steps');
  var bar = document.getElementById('progress');
  var countEl = document.getElementById('step-count');

  function visible() { return STEPS.filter(function (s) { return !s.when || s.when(data); }); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function fieldHtml(f) {
    var id = 'f-' + f.k, v = data[f.k], hint = f.hint ? '<p class="hint" id="' + id + '-h">' + esc(f.hint) + '</p>' : '';
    var desc = f.hint ? ' aria-describedby="' + id + '-h ' + id + '-e"' : ' aria-describedby="' + id + '-e"';
    var req = f.req ? ' required' : '';
    var label = esc(f.label) + (f.req ? '' : '<span class="opt">（選填）</span>');
    var err = '<p class="err" id="' + id + '-e" aria-live="polite"></p>';
    if (f.type === 'check') return '<div class="field"><label class="checkline"><input type="checkbox" id="' + id + '" data-k="' + f.k + '"' + (v ? ' checked' : '') + req + desc + '> ' + esc(f.label) + '</label>' + err + '</div>';
    if (f.type === 'radio' || f.type === 'checks') {
      var t = f.type === 'radio' ? 'radio' : 'checkbox';
      var items = f.opts.map(function (o) {
        var on = f.type === 'radio' ? v === o : (v || []).indexOf(o) >= 0;
        return '<label><input type="' + t + '" name="' + id + '" value="' + esc(o) + '" data-k="' + f.k + '"' + (on ? ' checked' : '') + '> ' + esc(o) + '</label>';
      }).join('');
      return '<fieldset class="field"' + desc + '><legend>' + label + '</legend>' + hint + '<div class="choices">' + items + '</div>' + err + '</fieldset>';
    }
    if (f.type === 'select') {
      var o = '<option value="">請選擇</option>' + f.opts.map(function (x) { return '<option' + (v === x ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('');
      return '<div class="field"><label for="' + id + '">' + label + '</label>' + hint + '<select id="' + id + '" data-k="' + f.k + '"' + req + desc + '>' + o + '</select>' + err + '</div>';
    }
    if (f.type === 'area') return '<div class="field"><label for="' + id + '">' + label + '</label>' + hint + '<textarea id="' + id + '" data-k="' + f.k + '"' + (f.small ? ' class="short"' : '') + req + desc + '>' + esc(v || '') + '</textarea>' + (f.min ? '<p class="hint count" id="' + id + '-c">' + (v || '').length + ' 字</p>' : '') + err + '</div>';
    if (f.type === 'files') return '<div class="field"><label for="' + id + '">' + label + '<span class="opt">（選填）</span></label>' + hint + '<input type="file" id="' + id + '" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.heic,.webp,.txt,.md"' + desc + '><ul class="filelist" id="filelist"></ul>' + err + '</div>';
    return '<div class="field"><label for="' + id + '">' + label + '</label>' + hint + '<input type="' + f.type + '" id="' + id + '" data-k="' + f.k + '" value="' + esc(v || '') + '"' + req + desc + '>' + err + '</div>';
  }

  function render() {
    var vs = visible(), s = vs[stepIx];
    var intro = s.id === 'consent' ? document.getElementById('consent-text').innerHTML : '';
    var review = s.id === 'files' ? '<div class="review"><h3>送出前看一下</h3>' + summary() + '</div>' : '';
    root.innerHTML = '<section class="step" aria-labelledby="step-title"><h2 id="step-title" class="head" tabindex="-1">' + esc(s.title) + '</h2>' + intro +
      '<div class="fields">' + s.fields.map(fieldHtml).join('') + '</div>' + review +
      '<div class="nav-row">' + (stepIx > 0 ? '<button type="button" class="btn quiet" id="back">上一步</button>' : '<span></span>') +
      '<button type="button" class="btn" id="next">' + (stepIx === vs.length - 1 ? '送出' : '下一步') + '</button></div></section>';
    bar.style.setProperty('--p', ((stepIx + 1) / vs.length * 100).toFixed(1) + '%');
    countEl.textContent = '第 ' + (stepIx + 1) + ' 步，共 ' + vs.length + ' 步';
    root.querySelector('#step-title').focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
    root.querySelectorAll('[data-k]').forEach(function (el) { el.addEventListener('input', collect); el.addEventListener('change', collect); });
    var fi = root.querySelector('input[type=file]');
    if (fi) { fi.addEventListener('change', addFiles); drawFiles(); }
    document.getElementById('next').addEventListener('click', next);
    var b = document.getElementById('back'); if (b) b.addEventListener('click', function () { stepIx--; render(); });
  }

  function collect(e) {
    var el = e.target, k = el.dataset.k;
    if (el.type === 'checkbox' && el.name) { data[k] = Array.prototype.map.call(root.querySelectorAll('input[name="' + el.name + '"]:checked'), function (x) { return x.value; }); }
    else if (el.type === 'checkbox') data[k] = el.checked;
    else if (el.type === 'radio') { var on = root.querySelector('input[name="' + el.name + '"]:checked'); data[k] = on ? on.value : ''; }
    else data[k] = el.value;
    var c = document.getElementById('f-' + k + '-c'); if (c) c.textContent = el.value.length + ' 字';
    var saved = Object.assign({}, data); delete saved.invite;
    window.safeStore.set('pilot-draft', saved);
  }

  function validate(s) {
    var ok = true, first = null;
    s.fields.forEach(function (f) {
      var e = document.getElementById('f-' + f.k + '-e'); if (!e) return;
      var v = data[f.k], msg = '';
      if (f.req && (v === undefined || v === '' || v === false || (Array.isArray(v) && !v.length))) msg = '這一題要填';
      else if (f.type === 'email' && v && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg = 'Email 的格式不對';
      else if (f.type === 'url' && v && !/^https?:\/\/\S+\.\S+/.test(v)) msg = '網址要用 http:// 或 https:// 開頭';
      else if (f.min && v && v.length < f.min) msg = '再多寫一點，至少 ' + f.min + ' 字，報告才有東西可以分析';
      e.textContent = msg;
      if (msg) { ok = false; if (!first) first = document.getElementById('f-' + f.k) || root.querySelector('[name="f-' + f.k + '"]'); }
    });
    if (first) first.focus();
    return ok;
  }

  function addFiles(e) {
    var err = document.getElementById('f-files-e'); err.textContent = '';
    Array.prototype.forEach.call(e.target.files, function (f) {
      if (files.length >= MAX_FILES) { err.textContent = '最多 3 個檔案'; return; }
      if (!OK_TYPES.test(f.name)) { err.textContent = f.name + '：這種檔案收不了'; return; }
      if (f.size > MAX_BYTES) { err.textContent = f.name + '：超過 8MB'; return; }
      files.push(f);
    });
    e.target.value = '';
    drawFiles();
  }
  function drawFiles() {
    var ul = document.getElementById('filelist'); if (!ul) return;
    ul.innerHTML = files.map(function (f, i) { return '<li><span>' + esc(f.name) + '（' + (f.size / 1048576).toFixed(1) + 'MB）</span><button type="button" class="link" data-rm="' + i + '">拿掉</button></li>'; }).join('');
    ul.querySelectorAll('[data-rm]').forEach(function (b) { b.addEventListener('click', function () { files.splice(+b.dataset.rm, 1); drawFiles(); }); });
  }

  function summary() {
    var rows = [['稱呼', data.name], ['Email', data.email], ['角色', data.role], ['公司', data.company], ['產業', data.industry], ['最在乎的三件事', [data.goal1, data.goal2, data.goal3].filter(Boolean).join('、')], ['多久內要決定', data.deadline], ['報告', data.kind]];
    return '<dl>' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl>';
  }

  function next() {
    var vs = visible(), s = vs[stepIx];
    if (!validate(s)) return;
    if (stepIx < vs.length - 1) { stepIx++; render(); return; }
    submit();
  }

  function submit() {
    var btn = document.getElementById('next'); btn.disabled = true; btn.textContent = '送出中…';
    var status = document.getElementById('submit-status');
    var payload = Object.assign({}, data); delete payload.invite; delete payload.consent;
    window.pilotApi('submit', { invite: data.invite, consent: !!data.consent, form: payload })
      .then(function (r) {
        var chain = Promise.resolve();
        files.forEach(function (f, i) {
          chain = chain.then(function () {
            status.textContent = '上傳附件 ' + (i + 1) + '／' + files.length + '：' + f.name;
            return window.fileToBase64(f).then(function (b64) { return window.pilotApi('upload', { token: r.token, name: f.name, mime: f.type, data: b64 }); });
          });
        });
        return chain.then(function () { return r; });
      })
      .then(function (r) {
        window.safeStore.del('pilot-draft');
        window.safeStore.set('pilot-case', { id: r.caseId, token: r.token });
        location.href = 'case.html?t=' + encodeURIComponent(r.token);
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = '再送一次';
        status.textContent = '沒送出去：' + e.message + '。你填的內容還在，可以再按一次。';
      });
  }

  render();
})();
