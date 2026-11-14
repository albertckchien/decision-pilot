// 初階報告的流程：註冊或登入 → 寫下卡住的事 → 問題卡（Haiku 整理，可以改）→ 補幾題 → 用 10 點看初階報告。
// 後台動作在 backend/Account.gs；初階報告的句子和規則都在後台，這裡只收答案、顯示結果。
(function () {
  var view = document.getElementById('view'), statusEl = document.getElementById('status');
  var who = document.getElementById('who'), bar = document.getElementById('progress');
  var S = { session: (window.safeStore.get('pw_session') || null), email: '', points: 0, card: null, story: '' };
  // 漏斗：從哪裡來（例如遊戲的 ?from=play），只收小寫英文 1～12 字，記在這台瀏覽器，註冊時一起送出
  // 規則：存的時候記日期，超過 30 天當作沒有；註冊成功後清掉（2026-11-15 嚴審第 4 條）
  var FROM = (function () {
    var f = new URLSearchParams(location.search).get('from');
    if (f && /^[a-z]{1,12}$/.test(f)) { window.safeStore.set('pw_from', { v: f, t: Date.now() }); return f; }
    var o = window.safeStore.get('pw_from');
    if (o && typeof o.v === 'string' && /^[a-z]{1,12}$/.test(o.v) && Date.now() - (+o.t || 0) < 30 * 864e5) return o.v;
    window.safeStore.del('pw_from'); return '';
  })();

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
      call(go, 'signupFinish', { email: email, code: document.getElementById('code').value, password: document.getElementById('pw').value, from: FROM }).then(function (r) { window.safeStore.del('pw_from'); return loggedIn(email)(r); });
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
        S.card = r.card; S.sub = undefined; card(r.usesLeft);
      });
    };
  }

  // ---------- 3. 問題卡 ----------
  var CARD_FIELDS = [['要決定的事', '你要決定的事'], ['A', '選項 A'], ['A的代價', '選 A 會失去什麼'], ['B', '選項 B'], ['B的代價', '選 B 會失去什麼']];
  function card(left) {
    step(2);
    var c = S.card, when = String(c['要決定的時間'] || '').replace(/[。．.\s]+$/, '');
    if (when === '看不出來') when = '';
    view.innerHTML = '<section class="step"><h2 class="head" tabindex="-1">我們這樣理解你的處境</h2>' +
      '<div class="card"><p>' + esc(c['重述']) + '</p><p class="small">這是「' + esc(c['兩難型態']) + ((c['預填'] || {})['擴大種類'] === '加碼現有業務' && c['兩難型態'] === '擴大還是守住' ? '：加碼現有業務' : '') + '」的兩難' + (when ? '，' + esc(when) : '') + '。</p></div>' +
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
  // Haiku 在問題卡的「預填」先從描述找答案（後台 Account.gs 的 PREFILL_ONE、PREFILL_MULTI），找到的收進一個區塊、可以改；
  // 看不出來的才問。每題都有「不確定」「不適用」，選了就當沒答，不算進報告。
  var COUNTRIES = [['TWN', '台灣'], ['SGP', '新加坡'], ['JPN', '日本'], ['USA', '美國'], ['CHN', '中國'], ['HKG', '香港'], ['MYS', '馬來西亞'], ['VNM', '越南'], ['THA', '泰國'], ['AUS', '澳洲'], ['CAN', '加拿大'], ['GBR', '英國'], ['DEU', '德國']];
  var GOALS = ['收入', '成長', '家庭時間', '穩定', '自由', '健康', '做大'];
  var NOPE = [['?', '不確定'], ['na', '不適用']];
  var YESNO = [['1', '有'], ['0', '沒有']];
  // n 名稱、t 題型（r 單選、c 多選）、l 題目、o 選項、pre 對到預填的欄位
  var Q_LEAVE = [
    { n: 'kind', t: 'r', l: '這次是哪一種', o: [['J1', '同產業換公司'], ['J2', '轉行'], ['J3', '去國外工作']], pre: '走留種類' },
    { n: 'reasons', t: 'c', l: '想走的主要原因（可以多選）', o: [['J4', '薪水'], ['J5', '成長空間'], ['J6', '主管或文化'], ['J7', '工時和健康'], ['J8', '公司前景'], ['J9', '怕被裁員'], ['J10', '家庭因素'], ['J11', '興趣改變'], ['J12', '地點']], pre: '想走原因' },
    { n: 'offer', t: 'r', l: '手上有沒有 offer', o: YESNO, pre: '有offer' },
    { n: 'skill', t: 'r', l: '新工作要的技能，你大概有幾成', o: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (n) { return [String(n), n + ' 成']; }), pre: '技能幾成' },
    { n: 'strength', t: 'r', l: '你的強項帶不帶得走', o: [['帶得走', '帶得走'], ['一部分', '一部分'], ['綁在現在的地方', '綁在現在的地方']], pre: '強項帶不帶得走' },
    { n: 'people', t: 'r', l: '新的領域有沒有認識的人', o: YESNO, pre: '新領域有認識的人' }
  ];
  var Q_XKIND = { n: 'xkind', t: 'r', l: '這次是哪一種擴大', o: [['加碼', '加碼現有業務（加預算、加廣告、加人、加產能）'], ['開新', '開新點、進新市場、做新產品']], pre: '擴大種類', noNope: true };
  var Q_NEW = [
    { n: 'dir', t: 'r', l: '擴張的方向', o: [['E1', '同樣的產品進新市場'], ['E2', '新產品賣給老客戶'], ['E3', '新產品進新市場'], ['E4', '往上下游整合']], pre: '擴張方向' },
    { n: 'method', t: 'r', l: '打算怎麼做', o: [['E5', '自己設點'], ['E6', '併購'], ['E7', '合資'], ['E8', '授權或加盟'], ['E9', '找代理經銷'], ['E10', '策略聯盟']], pre: '擴張方式' },
    { n: 'motives', t: 'c', l: '為什麼想擴張（可以多選）', o: [['E11', '成長'], ['E12', '分散風險'], ['E13', '客戶要求'], ['E14', '政府補助'], ['E15', '地緣政治']], pre: '擴張動機' },
    { n: 'adv', t: 'r', l: '你在本業贏的優勢，到新地方還在嗎', o: [['在', '在'], ['一部分', '一部分'], ['不在', '不在']], pre: '優勢帶得過去' },
    { n: 'person', t: 'r', l: '有沒有對的人可以帶新的那一塊', o: YESNO, pre: '有對的人帶' },
    { n: 'share', t: 'r', l: '這次要投的錢，占公司資產大約幾成', o: [['0.2', '三成以下（含三成）'], ['0.4', '超過三成、不到五成'], ['0.6', '五成以上']] },
    { n: 'core', t: 'r', l: '本業照現在的樣子撐得了多久', o: [['0', '兩年以上'], ['1', '撐不到兩年']] },
    { n: 'stop', t: 'r', l: '有沒有想好虧到多少就停', o: YESNO, pre: '想好停損點' }
  ];
  var Q_MORE = [
    { n: 'what', t: 'r', l: '這次想加碼的是什麼', o: [['X1', '加廣告或行銷預算'], ['X2', '加人'], ['X3', '加產能或設備'], ['X4', '降價或加碼優惠']], pre: '加碼什麼' },
    { n: 'xmot', t: 'c', l: '為什麼想加碼（可以多選）', o: [['X5', '趕在年底、旺季或期限前'], ['X6', '團隊士氣或留住關鍵的人'], ['X7', '衝業績目標'], ['X8', '對手在加碼']], pre: '加碼原因' },
    { n: 'effect', t: 'r', l: '多投的錢能換回多少，你知道嗎', o: [['知道', '有過去加碼或調整時的實際數字'], ['大概知道', '只有平常的平均數字'], ['不知道', '完全沒有數字']], pre: '知不知道多投能換回多少' },
    { n: 'handle', t: 'r', l: '多出來的量（名單、訂單、客人），現在的人手接得住嗎', o: [['接得住', '接得住'], ['要再加人或設備', '要再加人或設備'], ['接不住', '接不住']], pre: '多的量接不接得住' },
    { n: 'share', t: 'r', l: '這次多花的錢（整段加碼期間加起來），占公司現金大約幾成', o: [['0.2', '三成以下（含三成）'], ['0.4', '超過三成、不到五成'], ['0.6', '五成以上']] },
    { n: 'profit', t: 'r', l: '加碼會不會讓今年的獲利變差', o: [['1', '會'], ['0', '不會']], pre: '會壓到今年獲利' },
    { n: 'back', t: 'r', l: '加了之後，收不收得回來', o: [['隨時可以停', '隨時可以停或調得快（例如廣告）'], ['要等合約到期', '要等合約到期'], ['很難收回', '很難收回（例如請進來的人）']], pre: '加了收不收得回來' },
    { n: 'stop', t: 'r', l: '有沒有想好成效差到多少就收手', o: YESNO, pre: '想好停損點' }
  ];
  var Q_COMMON = [
    { n: 'when', t: 'r', l: '多久內要決定', o: [['1', '1 個月內'], ['3', '3 個月內'], ['6', '半年以上']], pre: '多久內要決定' },
    { n: 'habit', t: 'r', l: '你做決定的習慣', o: [['先做再說', '先做再說'], ['想清楚再做', '想清楚再做'], ['看情況', '看情況']] }
  ];
  // 預填的值是選項文字或選項代碼，兩種都認
  function preOf(q) {
    var P = S.card['預填'] || {}, v = q.pre ? P[q.pre] : undefined;
    var match = function (x) { var hit = q.o.filter(function (o) { return o[0] === String(x) || o[1] === String(x); })[0]; return hit ? hit[0] : null; };
    if (q.t === 'c') { var arr = (Array.isArray(v) ? v : []).map(match).filter(Boolean); return arr.length ? arr : null; }
    if (v === undefined || v === '看不出來') return null;
    if (q.n === 'xkind') return v === '加碼現有業務' ? '加碼' : v === '開新點進新市場' ? '開新' : null;
    return match(v);
  }
  function ask(q, chosen) {
    var opts = q.noNope ? q.o : q.o.concat(NOPE), type = q.t === 'c' ? 'checkbox' : 'radio';
    var picked = function (v) { return chosen == null ? false : q.t === 'c' ? chosen.indexOf(v) >= 0 : chosen === v; };
    return '<fieldset class="field"><legend>' + esc(q.l) + '</legend><div class="choices">' + opts.map(function (o) {
      return '<label' + (o[0] === '?' || o[0] === 'na' ? ' class="nope"' : '') + '><input type="' + type + '" name="' + q.n + '" value="' + esc(o[0]) + '"' + (picked(o[0]) ? ' checked' : '') + '> ' + esc(o[1]) + '</label>';
    }).join('') + '</div></fieldset>';
  }
  function answerText(q, chosen) {
    var lab = function (v) { return (q.o.filter(function (o) { return o[0] === v; })[0] || [v, v])[1]; };
    return q.t === 'c' ? chosen.map(lab).join('、') : lab(chosen);
  }
  function sel(id, opts, empty) { return '<select id="' + id + '">' + (empty ? '<option value="">' + empty + '</option>' : '') + opts.map(function (o) { return '<option value="' + o[0] + '">' + o[1] + '</option>'; }).join('') + '</select>'; }
  function v1(name) { var x = val(name); return x === '' || x === '?' || x === 'na' ? undefined : x; }
  function vs(name) { return vals(name).filter(function (x) { return x !== '?' && x !== 'na'; }); }
  function yn(name) { var x = v1(name); return x === undefined ? undefined : x === '1'; }
  function questions() {
    step(3);
    var t = S.card['兩難型態'], supported = t === '走還是留' || t === '擴大還是守住';
    if (!supported) {
      view.innerHTML = '<div class="card"><p>「' + esc(t) + '」這一類的初階報告還在準備中，這次先涵蓋「走還是留」和「擴大還是守住」。這次沒有扣點。</p></div>';
      return;
    }
    var biz = t === '擴大還是守住';
    if (biz && S.sub === undefined) S.sub = preOf(Q_XKIND);
    var list = !biz ? Q_LEAVE : [Q_XKIND].concat(S.sub === '加碼' ? Q_MORE : S.sub === '開新' ? Q_NEW : []);
    if (!biz || S.sub) list = list.concat(Q_COMMON);
    var got = [], open = '';
    list.forEach(function (q) {
      var p = preOf(q);
      if (q.n === 'xkind' && S.sub) p = S.sub;
      if (p) got.push({ q: q, p: p }); else open += ask(q, null);
    });
    var h = '';
    if (got.length) {
      h += '<details class="notice prefilled"><summary><strong>我們從你的描述先猜了 ' + got.length + ' 題</strong>，請看一遍，不對就點開改：' +
        esc(got.map(function (g) { return g.q.l.replace(/（.*?）/g, '') + '：' + answerText(g.q, g.p); }).join('；')) + '</summary>' +
        got.map(function (g) { return ask(g.q, g.p); }).join('') + '</details>';
    }
    h += open;
    if (biz && !S.sub) {
      view.innerHTML = '<section class="step"><h2 class="head" tabindex="-1">再補幾題</h2><p>先選這次是哪一種擴大，題目會跟著換。</p><div class="fields">' + h + '</div>' +
        '<div class="nav-row"><button type="button" class="btn quiet" id="back">回到問題卡</button><span></span></div></section>';
    } else {
      if (biz) {
        h += field('cash', '公司現金大約多少（萬元）', '<input type="number" id="cash" min="0" inputmode="decimal">');
        h += field('out', '每月要付出去的錢大約多少（萬元）', '<input type="number" id="out" min="0" inputmode="decimal">', '還在虧錢就填每月淨流出；有賺錢就填每月固定支出。');
        h += field('staff', '員工幾人', '<input type="number" id="staff" min="0" inputmode="numeric">');
      } else {
        h += field('sav', '存款大約多少（萬元）', '<input type="number" id="sav" min="0" inputmode="decimal">');
        h += field('exp', '每月固定支出大約多少（萬元）', '<input type="number" id="exp" min="0" inputmode="decimal">');
      }
      h += checks('fam', '家裡的限制（有的都勾，沒有就不用勾）', [['kids', '有小孩要照顧'], ['elder', '要照顧長輩'], ['debt', '房貸或大筆負債'], ['spouse', '另一半的工作綁在這裡'], ['health', '自己或家人的健康']]);
      h += field('ctry', '你現在在哪個國家', sel('ctry', COUNTRIES));
      if (S.sub !== '加碼') h += field('tgt', '要去的國家（不換國家就不用選）', sel('tgt', COUNTRIES, '不換國家'));
      h += field('g1', '你最在乎的三件事', [1, 2, 3].map(function (i) { return sel('g' + i, GOALS.map(function (g) { return [g, g]; }), '第 ' + i + ' 名'); }).join(' '));
      view.innerHTML = '<section class="step"><h2 class="head" tabindex="-1">再補幾題</h2><p>都是選擇題。看不懂題目、或真的想不出答案，就選「不確定」；跟你的情況無關就選「不適用」。這兩種不會當成你的狀況，但如果因此有格子沒辦法判斷，報告會寫出來。</p><div class="fields">' + h + '</div>' +
        '<div class="nav-row"><button type="button" class="btn quiet" id="back">回到問題卡</button><button type="button" class="btn" id="go">用 10 點看初階報告</button></div></section>';
    }
    document.getElementById('back').onclick = function () { card(null); };
    // 描述裡寫了的數字和家庭限制，先填進去（用戶可以改）
    var P = S.card['預填'] || {};
    [['sav', '存款萬元'], ['exp', '每月固定支出萬元'], ['cash', '公司現金萬元'], ['out', '每月付出萬元'], ['staff', '員工人數']].forEach(function (m) {
      var el = document.getElementById(m[0]), n = parseFloat(String(P[m[1]] || '').replace(/,/g, ''));
      if (el && !isNaN(n)) el.value = n;
    });
    var FAM = { '有小孩要照顧': 'kids', '要照顧長輩': 'elder', '房貸或大筆負債': 'debt', '另一半的工作綁在這裡': 'spouse', '自己或家人的健康': 'health' };
    (P['家裡的限制'] || []).forEach(function (l) { var el = document.querySelector('input[name="fam"][value="' + FAM[l] + '"]'); if (el) el.checked = true; });
    [].forEach.call(document.querySelectorAll('input[name="xkind"]'), function (x) {
      x.onchange = function () { S.sub = x.value; questions(); };
    });
    var go = document.getElementById('go');
    if (go) go.onclick = function () {
      var fam = vals('fam'), a = {}, p = { familyLimits: fam.length, hasSpouseOrKids: fam.indexOf('kids') >= 0,
        goals: [1, 2, 3].map(function (i) { return document.getElementById('g' + i).value; }).filter(Boolean),
        country: document.getElementById('ctry').value, target: (document.getElementById('tgt') || {}).value || undefined };
      var share = v1('share');
      if (!biz) {
        var sk = v1('skill');
        a = { kind: v1('kind'), reasons: vs('reasons'), hasOffer: yn('offer'), skillPct: sk === undefined ? undefined : Number(sk),
          strength: v1('strength'), knowPeople: yn('people') };
        p.savings = num('sav') !== undefined ? num('sav') * 1e4 : undefined;
        p.monthlyExpense = num('exp') !== undefined ? num('exp') * 1e4 : undefined;
      } else {
        if (S.sub === '加碼') {
          a = { expandKind: '加碼', what: v1('what'), motives: vs('xmot'), knowEffect: v1('effect'), canHandle: v1('handle'),
            capitalShare: share === undefined ? undefined : parseFloat(share), hurtsProfit: yn('profit'), reversible: v1('back'), hasStopLoss: yn('stop') };
        } else {
          var core = v1('core');
          a = { expandKind: '開新', direction: v1('dir'), method: v1('method'), motives: vs('motives'),
            advantage: v1('adv'), rightPerson: yn('person'), capitalShare: share === undefined ? undefined : parseFloat(share),
            coreUnder2y: core === undefined ? undefined : core === '1', hasStopLoss: yn('stop') };
        }
        p.isCompany = true; p.cash = num('cash') !== undefined ? num('cash') * 1e4 : undefined;
        p.monthlyOut = num('out') !== undefined ? num('out') * 1e4 : undefined; p.employees = num('staff');
      }
      var cp = (S.card['預填'] || {})['有要談的對象'];
      if (cp === '有' || cp === '沒有') a.counterparty = cp === '有';
      if (v1('when')) a.decideWithinMonths = Number(v1('when'));
      if (v1('habit') && v1('habit') !== '看情況') a.habit = v1('habit');
      var FAML = { kids: '有小孩要照顧', elder: '要照顧長輩', debt: '房貸或大筆負債', spouse: '另一半的工作綁在這裡', health: '自己或家人的健康' };
      S.lastAnswers = a; S.lastProfile = p; S.famLabels = fam.map(function (x) { return FAML[x]; });
      call(this, 'overview', { card: S.card, answers: a, profile: p }).then(function (r) {
        if (r.notReady) { view.innerHTML = '<div class="card"><p>' + esc(r.text) + '</p></div>'; return; }
        S.points = r.points; report(r.report);
      });
    };
  }

  // ---------- 5. 初階報告 ----------
  // 升級的點數照 intake_form.md 點數表（概述升分析 40、概述升完整 90）；後台 Account.gs 的 UPGRADE 要一致
  var UPGRADE = [['分析報告', 40, '比較至少三個選項、反過來想、寫出什麼情況下該改變主意，也會試著找一條你可能沒想過的路（找不到站得住的會照實說）。約 5～6 頁。'],
                 ['完整報告', 90, '分析報告的內容，再加上執行計畫和檢查點。約 10 頁。']];
  function report(text) {
    step(5); head();
    S.reportText = text;
    view.innerHTML = '<article class="card md">' + md(text) + '</article>' +
      '<div class="card"><h2>想知道該選哪一個？</h2><p>初階報告只告訴你準備好了沒、最大的風險、先確認什麼。要比較選項、知道該選哪一個，可以升級：</p>' +
      UPGRADE.map(function (u) { return '<p><strong>' + u[0] + '：' + u[1] + ' 點</strong>　' + esc(u[2]) + '</p>'; }).join('') +
      '<p class="small">你現在有 ' + S.points + ' 點。</p>' +
      '<div class="actions">' + UPGRADE.map(function (u, i) { return '<button class="btn' + (i ? ' quiet' : '') + '" data-up="' + i + '">升級成' + u[0] + '（' + u[1] + ' 點）</button>'; }).join('') +
      '<button class="btn quiet" id="print">存成 PDF 或列印</button></div></div>';
    document.getElementById('print').onclick = function () { window.print(); };
    [].forEach.call(view.querySelectorAll('[data-up]'), function (b) { b.onclick = function () { upgrade(UPGRADE[Number(b.dataset.up)]); }; });
  }

  // ---------- 6. 升級：補幾個報告要用的欄位、確認扣點 ----------
  var AGES = ['25 以下', '25–29', '30–34', '35–39', '40–44', '45–49', '50–54', '55–59', '60 以上'];
  var ROLES = ['上班族', '高階主管', '老闆或創業者', '自由工作者', '待業', '學生', '退休'];
  function upgrade(u) {
    step(4);
    var enough = S.points >= u[1];
    var t = function (id, label, hint, req) { return field('u-' + id, esc(label) + (req ? '' : '<span class="opt">（選填）</span>'), '<input type="text" id="u-' + id + '">', hint); };
    var r = function (id, label, opts, req) { return radios('u-' + id, esc(label) + (req ? '' : '<span class="opt">（選填）</span>'), opts.map(function (o) { return [o, o]; })); };
    var h = t('name', '稱呼', '暱稱就好，報告裡不會出現你的全名', true) +
      field('u-age', '年齡', sel('u-age', AGES.map(function (x) { return [x, x]; }), '請選擇')) +
      t('place', '所在國家和城市', '例如「台灣 台北」', true) +
      r('role', '角色', ROLES, true) +
      t('industry', '產業', '例如「醫療器材」「餐飲」「軟體」', true) +
      t('company', '公司名稱', '我們會上網查這家公司的公開資訊，讓報告更準') +
      t('website', '公司官網', '網址，例如 https://example.com') +
      t('title', '職稱') +
      r('risk', '能承受多少風險', ['低', '中', '高'], true) +
      field('u-edge', '你有什麼別人比較少有的<span class="opt">（選填）</span>', '<textarea id="u-edge" class="short"></textarea>', '經驗、人脈、資料、資源，列 1～3 樣') +
      field('u-two', '你同時懂哪兩邊<span class="opt">（選填）</span>', '<textarea id="u-two" class="short"></textarea>', '例如兩個國家、兩個產業、兩種人；沒有就空著') +
      '<div id="u-biz" hidden>' + r('years', '公司成立幾年', ['不到 3 年', '3–10 年', '10 年以上']) +
      r('revenue', '年營收級距', ['不想說', '1,000 萬以下', '1,000 萬–5,000 萬', '5,000 萬–2 億', '2 億–10 億', '10 億以上']) +
      r('profit', '現在有沒有賺錢', ['有', '打平', '還在虧']) + r('b2b', '客戶主要是企業還是個人', ['企業', '個人', '都有']) +
      r('familyBiz', '是不是家族企業', ['是', '不是']) + '</div>' +
      t('line', 'LINE ID', '比較急的追問會用 LINE 問你') +
      field('u-files', '附件<span class="opt">（選填）</span>', '<input type="file" id="u-files" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.heic,.webp,.txt,.md"><ul class="filelist" id="u-filelist"></ul>',
        '合約、offer、財報、企劃書都可以。最多 3 個、每個 8MB 以內。上傳前請先遮掉身分證字號、帳號、別人的全名。') +
      field('u-links', '比較大的檔案，貼雲端連結<span class="opt">（選填）</span>', '<textarea id="u-links" class="short"></textarea>', 'Google 雲端硬碟或 Dropbox 的分享連結，權限設成「知道連結的人可以檢視」，一行一個');
    view.innerHTML = '<section class="step"><h2 class="head" tabindex="-1">升級成' + u[0] + '</h2>' +
      '<div class="card"><p><strong>你卡在</strong>：' + esc(S.card['要決定的事']) + '</p><p class="small">問題卡、補題的答案和初階報告會一起帶過去，不用重填。下面是' + u[0] + '還需要的幾個基本資料。</p></div>' +
      '<div class="fields">' + h + '</div>' +
      '<div class="notice"><p><strong>確認後扣 ' + u[1] + ' 點</strong>（你現在有 ' + S.points + ' 點）。報告好了會寄信到 ' + esc(S.email) + '，信裡只有連結，報告在網站上看和下載。</p>' +
      '<p class="small">試跑期間由工作人員製作，目標 12 小時內交付；中間如果要多問你幾件事，會寄信請你回來回答。做不出站得住的報告會全額退點。</p></div>' +
      (enough ? '' : '<p class="err">點數不夠：' + u[0] + '要 ' + u[1] + ' 點。試跑期間還不能買點，請聯絡邀請你的人。</p>') +
      '<div class="nav-row"><button type="button" class="btn quiet" id="back">回到初階報告</button><button type="button" class="btn" id="go"' + (enough ? '' : ' disabled') + '>確認，扣 ' + u[1] + ' 點</button></div></section>';
    document.getElementById('back').onclick = function () { report(S.reportText); };
    // 附件：跟讀書會表單同樣的限制（後台 Code.gs 的 upload_ 收 8MB 以內、最多 3 個）
    var files = [], MAXF = 3, MAXB = 8 * 1024 * 1024, OKT = /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|heic|webp|txt|md)$/i;
    var drawFiles = function () {
      var ul = document.getElementById('u-filelist');
      ul.innerHTML = files.map(function (f, i) { return '<li><span>' + esc(f.name) + '（' + (f.size / 1048576).toFixed(1) + 'MB）</span><button type="button" class="link" data-rm="' + i + '">拿掉</button></li>'; }).join('');
      [].forEach.call(ul.querySelectorAll('[data-rm]'), function (b) { b.onclick = function () { files.splice(+b.dataset.rm, 1); drawFiles(); }; });
    };
    document.getElementById('u-files').onchange = function (e) {
      say('');
      [].forEach.call(e.target.files, function (f) {
        if (files.length >= MAXF) { say('最多 3 個檔案'); return; }
        if (!OKT.test(f.name)) { say(f.name + '：這種檔案收不了'); return; }
        if (f.size > MAXB) { say(f.name + '：超過 8MB，請改貼雲端連結'); return; }
        files.push(f);
      });
      e.target.value = ''; drawFiles();
    };
    var bizBox = document.getElementById('u-biz');
    [].forEach.call(document.querySelectorAll('input[name="u-role"]'), function (x) {
      x.onchange = function () { bizBox.hidden = !(x.value === '高階主管' || x.value === '老闆或創業者'); };
    });
    document.getElementById('go').onclick = function () {
      var g = function (id) { var el = document.getElementById('u-' + id); return el ? el.value.trim() : ''; };
      var p = S.lastProfile || {}, a = S.lastAnswers || {};
      var wan = function (n) { return n ? '約 ' + Math.round(n / 1e4) + ' 萬' : ''; };
      var f = { name: g('name'), age: g('age'), place: g('place'), role: val('u-role'), industry: g('industry'), company: g('company'),
        website: g('website'), title: g('title'), risk: val('u-risk'), edge: g('edge'), twoSides: g('two'), line: g('line'),
        years: val('u-years'), revenue: val('u-revenue'), profit: val('u-profit'), b2b: val('u-b2b'), familyBiz: val('u-familyBiz'),
        family: S.famLabels || [], goal1: (p.goals || [])[0], goal2: (p.goals || [])[1], goal3: (p.goals || [])[2], habit: a.habit,
        savings: wan(p.savings), spend: wan(p.monthlyExpense), cash: wan(p.cash), staff: p.employees != null ? String(p.employees) : '',
        flow: p.monthlyOut ? '每月要付出去約 ' + Math.round(p.monthlyOut / 1e4) + ' 萬' : '' };
      var miss = [['name', '稱呼'], ['age', '年齡'], ['place', '所在國家和城市'], ['role', '角色'], ['industry', '產業'], ['risk', '能承受多少風險']]
        .filter(function (m) { return !f[m[0]]; }).map(function (m) { return m[1]; });
      if (miss.length) { say('還沒填：' + miss.join('、')); return; }
      f.links = g('links');
      var btn = this;
      call(btn, 'order', { kind: u[0], card: S.card, story: S.story, answers: a, profile: p, report: S.reportText, form: f }).then(function (r) {
        if (r.points != null) S.points = r.points;
        var go = function () { location.href = 'case.html?t=' + encodeURIComponent(r.token); };
        if (!files.length || r.again) return go();
        btn.disabled = true;
        var chain = Promise.resolve();
        files.forEach(function (fl, i) {
          chain = chain.then(function () {
            say('點數已扣，上傳附件 ' + (i + 1) + '／' + files.length + '：' + fl.name);
            return window.fileToBase64(fl).then(function (b64) { return window.pilotApi('upload', { token: r.token, name: fl.name, mime: fl.type, data: b64 }); });
          });
        });
        chain.then(go, function (e) { say('點數已扣、報告會照常做，但附件沒傳上去（' + e.message + '）。之後回信給我們就好。'); setTimeout(go, 4000); });
      });
    };
  }

  // 開場：有登入就直接寫，沒有就先開帳號
  if (S.session) {
    window.pilotApi('me', { session: S.session }).then(function (r) { S.email = r.email; S.points = r.points; write(); })
      .catch(function () { S.session = null; window.safeStore.del('pw_session'); auth('signup'); });
  } else auth('signup');
})();
