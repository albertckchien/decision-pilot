// 初階報告的流程：註冊或登入 → 寫下卡住的事 → 問題卡（Haiku 整理，可以改）→ 補幾題 → 用 10 點看初階報告。
// 後台動作在 backend/Account.gs；初階報告的句子和規則都在後台，這裡只收答案、顯示結果。
(function () {
  var view = document.getElementById('view'), statusEl = document.getElementById('status');
  var who = document.getElementById('who'), bar = document.getElementById('progress');
  var S = { session: (window.safeStore.get('pw_session') || null), email: '', points: 0, card: null, story: '' };

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function md(s) {  // 只處理初階報告會出現的格式
    return esc(s).split('\n').map(function (l) {
      if (/^## /.test(l)) return '<h2>' + l.slice(3) + '</h2>';
      if (/^- /.test(l)) return '<p class="li">' + l.slice(2) + '</p>';
      if (/^\d+\. /.test(l)) return '<p class="li">' + l + '</p>';
      if (/^---/.test(l)) return '<hr>';
      return l ? '<p>' + l + '</p>' : '';
    }).join('').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }
  function say(t) { statusEl.textContent = t || ''; }
  function step(n) { bar.style.setProperty('--p', (n * 20) + '%'); }
  function call(btn, action, payload) {
    if (btn) { btn.disabled = true; btn.dataset.t = btn.textContent; btn.textContent = '處理中…'; }
    say('');
    return window.pilotApi(action, Object.assign({ session: S.session }, payload || {})).catch(function (e) {
      if (/登入/.test(e.message)) { S.session = null; window.safeStore.del('pw_session'); }
      say(e.message); throw e;
    }).finally(function () { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.t; } });
  }
  function head() { who.textContent = S.email ? S.email + '｜' + S.points + ' 點' : ''; }
  function field(id, label, html, hint) {
    return '<div class="field"><label for="' + id + '">' + label + '</label>' + (hint ? '<p class="hint">' + hint + '</p>' : '') + html + '</div>';
  }
  function radios(name, label, opts) {
    return '<fieldset class="field"><legend>' + label + '</legend><div class="choices">' + opts.map(function (o, i) {
      return '<label><input type="radio" name="' + name + '" value="' + esc(o[0]) + '"' + (i === 0 ? '' : '') + '> ' + esc(o[1]) + '</label>';
    }).join('') + '</div></fieldset>';
  }
  function checks(name, label, opts) {
    return '<fieldset class="field"><legend>' + label + '</legend><div class="choices">' + opts.map(function (o) {
      return '<label><input type="checkbox" name="' + name + '" value="' + esc(o[0]) + '"> ' + esc(o[1]) + '</label>';
    }).join('') + '</div></fieldset>';
  }
  function val(name) { var x = document.querySelector('input[name="' + name + '"]:checked'); return x ? x.value : ''; }
  function vals(name) { return [].map.call(document.querySelectorAll('input[name="' + name + '"]:checked'), function (x) { return x.value; }); }
  function num(id) { var v = parseFloat((document.getElementById(id) || {}).value); return isNaN(v) ? undefined : v; }

  // ---------- 1. 註冊或登入 ----------
  function auth(mode) {
    step(0); head();
    var signup = mode !== 'login';
    view.innerHTML = '<section class="step"><h2 class="head" tabindex="-1">' + (signup ? '先開一個帳號' : '登入') + '</h2>' +
      (signup ? '<p>新帳號送一次 10 點，剛好夠看一份初階報告。一個 Email 只能開一個帳號。</p>' : '') +
      '<div class="fields">' + field('em', 'Email', '<input type="email" id="em" autocomplete="email">') +
      (signup ? '<div id="code-box" hidden>' + field('code', '信箱收到的 6 位數驗證碼', '<input type="text" id="code" inputmode="numeric" maxlength="6">') + '</div>' : '') +
      '<div id="pw-box"' + (signup ? ' hidden' : '') + '>' + field('pw', signup ? '設一個密碼（8 個字以上）' : '密碼', '<input type="password" id="pw" autocomplete="' + (signup ? 'new-password' : 'current-password') + '">') + '</div></div>' +
      '<div class="nav-row"><button type="button" class="btn quiet" id="switch">' + (signup ? '我已經有帳號' : '我要開新帳號') + '</button>' +
      '<button type="button" class="btn" id="go">' + (signup ? '寄驗證碼' : '登入') + '</button></div>' +
      (signup ? '<p class="small"><button type="button" class="link" id="have-code">我已經收到驗證碼</button></p>' : '') + '</section>';
    document.getElementById('switch').onclick = function () { auth(signup ? 'login' : 'signup'); };
    var go = document.getElementById('go'), sent = false;
    var hc = document.getElementById('have-code');
    if (hc) hc.onclick = function () {
      sent = true; document.getElementById('code-box').hidden = false; document.getElementById('pw-box').hidden = false;
      go.textContent = go.dataset.t = '開帳號'; hc.parentNode.hidden = true; say('填信裡最新那一封的驗證碼。');
    };
    go.onclick = function () {
      var email = document.getElementById('em').value;
      if (!signup) return call(go, 'login', { email: email, password: document.getElementById('pw').value }).then(loggedIn(email));
      if (!sent) return call(go, 'signupStart', { email: email }).then(function () {
        sent = true; document.getElementById('code-box').hidden = false; document.getElementById('pw-box').hidden = false;
        go.textContent = go.dataset.t = '開帳號'; say('驗證碼寄出了，10 分鐘內有效。');
      });
      call(go, 'signupFinish', { email: email, code: document.getElementById('code').value, password: document.getElementById('pw').value }).then(loggedIn(email));
    };
  }
  function loggedIn(email) {
    return function (r) { S.session = r.session; S.email = email; S.points = r.points; window.safeStore.set('pw_session', r.session); write(); };
  }

  // ---------- 2. 寫下卡住的事 ----------
  function write() {
    step(1); head();
    view.innerHTML = '<section class="step"><h2 class="head" tabindex="-1">把你卡住的事寫下來</h2>' +
      '<p>寫你在兩條路之間猶豫什麼、各自擔心什麼、什麼時候要決定。不用寫得很工整，50 到 1,000 字。不要寫別人的全名。</p>' +
      '<div class="fields">' + field('story', '你卡住的事', '<textarea id="story" maxlength="1000">' + esc(S.story) + '</textarea><p class="hint count" id="cnt">0 字</p>') + '</div>' +
      '<div class="nav-row"><span></span><button type="button" class="btn" id="go">整理成問題卡</button></div></section>';
    var ta = document.getElementById('story'), cnt = document.getElementById('cnt');
    var upd = function () { cnt.textContent = ta.value.length + ' 字'; }; ta.oninput = upd; upd();
    document.getElementById('go').onclick = function () {
      S.story = ta.value;
      call(this, 'card', { story: ta.value }).then(function (r) {
        if (r.declined) { view.innerHTML = '<div class="card"><p>' + esc(r.message) + '</p></div>'; return; }
        S.card = r.card; card(r.usesLeft);
      });
    };
  }

  // ---------- 3. 問題卡 ----------
  var CARD_FIELDS = [['要決定的事', '你要決定的事'], ['A', '選項 A'], ['A的代價', '選 A 會失去什麼'], ['B', '選項 B'], ['B的代價', '選 B 會失去什麼']];
  function card(left) {
    step(2);
    var c = S.card;
    view.innerHTML = '<section class="step"><h2 class="head" tabindex="-1">我們這樣理解你的處境</h2>' +
      '<div class="card"><p>' + esc(c['重述']) + '</p><p class="small">這是「' + esc(c['兩難型態']) + '」的兩難' + (c['要決定的時間'] && c['要決定的時間'] !== '看不出來' ? '，' + esc(c['要決定的時間']) : '') + '。</p></div>' +
      '<p>哪裡寫得不對，直接改。</p><div class="fields">' + CARD_FIELDS.map(function (f) {
        return field('cf-' + f[0], f[1], '<input type="text" id="cf-' + f[0] + '" value="' + esc(c[f[0]]) + '">');
      }).join('') + '</div>' +
      (c['缺的資料'] && c['缺的資料'].length ? '<div class="notice"><p><strong>你還沒寫、但會影響結論的：</strong></p>' + c['缺的資料'].map(function (x) { return '<p class="li">' + esc(x) + '</p>'; }).join('') + '<p class="small">初階報告用不到這些；之後要做分析報告時會再問你。</p></div>' : '') +
      '<div class="nav-row"><button type="button" class="btn quiet" id="back">重寫描述' + (left != null ? '（還能整理 ' + left + ' 次）' : '') + '</button><button type="button" class="btn" id="go">對，下一步</button></div></section>';
    document.getElementById('back').onclick = write;
    document.getElementById('go').onclick = function () {
      CARD_FIELDS.forEach(function (f) { c[f[0]] = document.getElementById('cf-' + f[0]).value; });
      questions();
    };
  }

  // ---------- 4. 補幾題 ----------
  var COUNTRIES = [['TWN', '台灣'], ['SGP', '新加坡'], ['JPN', '日本'], ['USA', '美國'], ['CHN', '中國'], ['HKG', '香港'], ['MYS', '馬來西亞'], ['VNM', '越南'], ['THA', '泰國'], ['AUS', '澳洲'], ['CAN', '加拿大'], ['GBR', '英國'], ['DEU', '德國']];
  var GOALS = ['收入', '成長', '家庭時間', '穩定', '自由', '健康', '做大'];
  function sel(id, opts, empty) { return '<select id="' + id + '">' + (empty ? '<option value="">' + empty + '</option>' : '') + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>'; }
  function questions() {
    step(3);
    var t = S.card['兩難型態'], supported = t === '走還是留' || t === '擴大還是守住';
    if (!supported) {
      view.innerHTML = '<div class="card"><p>「' + esc(t) + '」這一類的初階報告還在準備中，這次先涵蓋「走還是留」和「擴大還是守住」。這次沒有扣點。</p></div>';
      return;
    }
    var biz = t === '擴大還是守住', h = '';
    if (!biz) {
      h += radios('kind', '這次是哪一種', [['J1', '同產業換公司'], ['J2', '轉行'], ['J3', '去國外工作']]);
      h += checks('reasons', '想走的主要原因（可以多選）', [['J4', '薪水'], ['J5', '成長空間'], ['J6', '主管或文化'], ['J7', '工時和健康'], ['J8', '公司前景'], ['J9', '怕被裁員'], ['J10', '家庭因素'], ['J11', '興趣改變'], ['J12', '地點']]);
      h += radios('offer', '手上有沒有 offer', [['1', '有'], ['0', '還沒有']]);
      h += field('skill', '新工作要的技能，你大概有幾成', sel('skill', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return [n, n + ' 成']; }), '請選'));
      h += radios('strength', '你的強項帶不帶得走', [['帶得走', '帶得走'], ['一部分', '一部分'], ['綁在現在的地方', '綁在現在的地方']]);
      h += radios('people', '新的領域有沒有認識的人', [['1', '有'], ['0', '沒有']]);
    } else {
      h += radios('dir', '擴張的方向', [['E1', '同樣的產品進新市場'], ['E2', '新產品賣給老客戶'], ['E3', '新產品進新市場'], ['E4', '往上下游整合']]);
      h += radios('method', '打算怎麼做', [['E5', '自己設點'], ['E6', '併購'], ['E7', '合資'], ['E8', '授權或加盟'], ['E9', '找代理經銷'], ['E10', '策略聯盟']]);
      h += checks('motives', '為什麼想擴張（可以多選）', [['E11', '成長'], ['E12', '分散風險'], ['E13', '客戶要求'], ['E14', '政府補助'], ['E15', '地緣政治']]);
      h += radios('adv', '你在本業贏的優勢，到新地方還在嗎', [['在', '在'], ['一部分', '一部分'], ['不在', '不在']]);
      h += radios('person', '有沒有對的人可以帶新的那一塊', [['1', '有'], ['0', '沒有']]);
      h += radios('share', '這次要投的錢，占公司資產大約幾成', [['0.2', '三成以下'], ['0.4', '三到五成'], ['0.6', '五成以上']]);
      h += radios('core', '本業照現在的樣子撐得了多久', [['0', '兩年以上'], ['1', '撐不到兩年']]);
      h += radios('stop', '有沒有想好虧到多少就停', [['1', '有'], ['0', '還沒有']]);
      h += field('cash', '公司現金大約多少（萬元）', '<input type="number" id="cash" min="0" inputmode="decimal">');
      h += field('out', '每月要付出去的錢大約多少（萬元）', '<input type="number" id="out" min="0" inputmode="decimal">', '還在虧錢就填每月淨流出；有賺錢就填每月固定支出。');
      h += field('staff', '員工幾人', '<input type="number" id="staff" min="0" inputmode="numeric">');
    }
    h += radios('when', '多久內要決定', [['1', '1 個月內'], ['3', '3 個月內'], ['6', '半年以上']]);
    h += radios('habit', '你做決定的習慣', [['先做再說', '先做再說'], ['想清楚再做', '想清楚再做'], ['看情況', '看情況']]);
    if (!biz) {
      h += field('sav', '存款大約多少（萬元）', '<input type="number" id="sav" min="0" inputmode="decimal">');
      h += field('exp', '每月固定支出大約多少（萬元）', '<input type="number" id="exp" min="0" inputmode="decimal">');
    }
    h += checks('fam', '家裡的限制（有的都勾）', [['kids', '有小孩要照顧'], ['elder', '要照顧長輩'], ['debt', '房貸或大筆負債'], ['spouse', '另一半的工作綁在這裡'], ['health', '自己或家人的健康']]);
    h += field('ctry', '你現在在哪個國家', sel('ctry', COUNTRIES));
    h += field('tgt', '要去的國家（不換國家就不用選）', sel('tgt', COUNTRIES, '不換國家'));
    h += field('g1', '你最在乎的三件事', [1, 2, 3].map(function (i) { return sel('g' + i, GOALS.map(function (g) { return [g, g]; }), '第 ' + i + ' 名'); }).join(' '));
    view.innerHTML = '<section class="step"><h2 class="head" tabindex="-1">再補幾題</h2><p>都是選擇題，大約 2 分鐘。不知道的可以跳過。</p><div class="fields">' + h + '</div>' +
      '<div class="nav-row"><button type="button" class="btn quiet" id="back">回到問題卡</button><button type="button" class="btn" id="go">用 10 點看初階報告</button></div></section>';
    document.getElementById('back').onclick = function () { card(null); };
    document.getElementById('go').onclick = function () {
      var fam = vals('fam'), a = {}, p = { familyLimits: fam.length, hasSpouseOrKids: fam.indexOf('kids') >= 0,
        goals: [1, 2, 3].map(function (i) { return document.getElementById('g' + i).value; }).filter(Boolean),
        country: document.getElementById('ctry').value, target: document.getElementById('tgt').value || undefined };
      if (!biz) {
        a = { kind: val('kind') || undefined, reasons: vals('reasons'), hasOffer: val('offer') === '1',
          skillPct: num('skill'), strength: val('strength') || undefined,
          knowPeople: val('people') === '' ? undefined : val('people') === '1' };
        p.savings = num('sav') !== undefined ? num('sav') * 1e4 : undefined;
        p.monthlyExpense = num('exp') !== undefined ? num('exp') * 1e4 : undefined;
      } else {
        a = { direction: val('dir') || undefined, method: val('method') || undefined, motives: vals('motives'),
          advantage: val('adv') || undefined, rightPerson: val('person') === '' ? undefined : val('person') === '1',
          capitalShare: val('share') ? parseFloat(val('share')) : undefined, coreUnder2y: val('core') === '1',
          hasStopLoss: val('stop') === '' ? undefined : val('stop') === '1' };
        p.isCompany = true; p.cash = num('cash') !== undefined ? num('cash') * 1e4 : undefined;
        p.monthlyOut = num('out') !== undefined ? num('out') * 1e4 : undefined; p.employees = num('staff');
      }
      if (val('when')) a.decideWithinMonths = Number(val('when'));
      if (val('habit') && val('habit') !== '看情況') a.habit = val('habit');
      call(this, 'overview', { card: S.card, answers: a, profile: p }).then(function (r) {
        if (r.notReady) { view.innerHTML = '<div class="card"><p>' + esc(r.text) + '</p></div>'; return; }
        S.points = r.points; report(r.report);
      });
    };
  }

  // ---------- 5. 初階報告 ----------
  function report(text) {
    step(5); head();
    view.innerHTML = '<article class="card md">' + md(text) + '</article>' +
      '<div class="card"><h2>想知道該選哪一個？</h2><p>分析報告會比較至少三個選項、反過來想、寫出什麼情況下該改變主意，也會試著找一條你可能沒想過的路（找不到站得住的會照實說）。分析報告 50 點、完整報告 100 點。</p>' +
      '<p class="small">付費版還在準備，開放時會寄信到你註冊的信箱。</p><div class="actions"><button class="btn quiet" id="print">存成 PDF 或列印</button></div></div>';
    document.getElementById('print').onclick = function () { window.print(); };
  }

  // 開場：有登入就直接寫，沒有就先開帳號
  if (S.session) {
    window.pilotApi('me', { session: S.session }).then(function (r) { S.email = r.email; S.points = r.points; write(); })
      .catch(function () { S.session = null; window.safeStore.del('pw_session'); auth('signup'); });
  } else auth('signup');
})();
