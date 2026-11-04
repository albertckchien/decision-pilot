// 進度頁：用網址裡的 t（專屬亂碼）跟後台要這一份的狀態和內容。
(function () {
  var STAGES = [
    ['received', '收到了'],
    ['card', '確認問題卡'],
    ['questions', '回答追問'],
    ['making', '製作中'],
    ['done', '報告好了']
  ];
  var params = new URLSearchParams(location.search);
  var saved = window.safeStore.get('pilot-case');
  var token = params.get('t') || (saved && saved.token);
  var main = document.getElementById('case');
  var stagesEl = document.getElementById('stages');

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function md(s) {
    if (!s) return '';
    if (window.marked && window.DOMPurify) return window.DOMPurify.sanitize(window.marked.parse(s));
    return '<pre>' + esc(s) + '</pre>';
  }
  function drawStages(stage) {
    var ix = STAGES.findIndex(function (s) { return s[0] === stage; });
    stagesEl.innerHTML = STAGES.map(function (s, i) {
      return '<li class="' + (i < ix ? 'done' : i === ix ? 'now' : '') + '"' + (i === ix ? ' aria-current="step"' : '') + '>' + s[1] + '</li>';
    }).join('');
  }

  if (!token) {
    document.querySelector('.mylink').hidden = true;
    main.innerHTML = '<div class="card"><h2 class="head">找不到你的進度</h2><p>請用送出後拿到的專屬連結打開這一頁，或到 <a class="link" href="start.html">開始填寫</a>。</p></div>';
    return;
  }
  window.safeStore.set('pilot-case', { token: token });
  document.getElementById('mylink').value = location.origin + location.pathname + '?t=' + encodeURIComponent(token);

  function load() {
    main.innerHTML = '<p>讀取中…</p>';
    window.pilotApi('get', { token: token }).then(show).catch(function (e) {
      main.innerHTML = '<div class="card"><h2 class="head">現在讀不到</h2><p>' + esc(e.message) + '</p><div class="actions"><button class="btn" id="retry">再試一次</button></div></div>';
      document.getElementById('retry').addEventListener('click', load);
    });
  }

  function show(r) {
    drawStages(r.stage === 'declined' ? 'making' : r.stage);
    var h = '';
    if (r.message) h += '<div class="notice"><p>' + esc(r.message) + '</p></div>';
    if (r.stage === 'received') h += '<div class="card"><h2 class="head">收到了，謝謝你</h2><p>我們會先把你寫的整理成一張問題卡，好了會寄 Email 通知你回到這一頁確認。這個連結請收好，之後都從這裡看進度。</p></div>';
    if (r.stage === 'card') h += cardHtml(r);
    if (r.stage === 'questions') h += questionsHtml(r);
    if (r.stage === 'making') h += '<div class="card"><h2 class="head">報告製作中</h2><p>資料都齊了。我們正在比較你的選項、找另一條路、跑人生模擬，好了會寄 Email 通知你。</p></div>';
    if (r.stage === 'declined') h += '<div class="card"><h2 class="head">這次沒辦法製作</h2><p>' + esc(r.declineReason || '這份描述有些內容超出我們報告能處理的範圍，所以這次不製作。') + '</p></div>';
    if (r.stage === 'done') h += reportHtml(r);
    main.innerHTML = h;
    bind(r);
  }

  function cardHtml(r) {
    return '<div class="card"><h2 class="head">我們這樣理解你的處境，對嗎？</h2><p>這張問題卡是寫報告的依據。哪裡不對、漏了什麼，直接寫在下面，我們照你的改。</p></div>' +
      '<article class="card md">' + md(r.card) + '</article>' +
      '<div class="card"><div class="field"><label for="card-edit">要改或補充的地方</label><p class="hint" id="card-edit-h">沒有要改就空著，直接按確認</p><textarea id="card-edit" class="short" aria-describedby="card-edit-h"></textarea></div>' +
      '<div class="actions"><button class="btn" id="card-ok">確認問題卡</button></div><p class="small" id="card-status" aria-live="polite"></p></div>';
  }

  function questionsHtml(r) {
    var qs = r.questions || [];
    return '<div class="card"><h2 class="head">還想多問你幾件事</h2><p>這些答案會讓報告準很多。不知道的寫「不知道」也可以。</p></div>' +
      '<div class="card"><div class="fields">' + qs.map(function (q, i) {
        return '<div class="field"><label for="q-' + i + '">' + esc(q) + '</label><textarea id="q-' + i + '" class="short"></textarea></div>';
      }).join('') + '</div><div class="actions"><button class="btn" id="q-ok">送出回答</button></div><p class="small" id="q-status" aria-live="polite"></p></div>';
  }

  function reportHtml(r) {
    var h = '<div class="card"><h2 class="head">你的報告好了</h2><p>先看第 1 章的結論，再看比較表和另一條路。看完請花 3 分鐘填最下面的回饋。</p><div class="actions">' +
      (r.downloads || []).map(function (d) { return '<button class="btn quiet" data-dl="' + esc(d) + '">下載 ' + esc(d) + '</button>'; }).join('') + '</div></div>';
    if (r.pilotNote) h += '<div class="notice"><p>' + esc(r.pilotNote) + '</p></div>';
    h += '<article class="card md report">' + md(r.report) + '</article>';
    if (r.sim) h += '<section class="card" id="sim-root" aria-labelledby="sim-h"><h2 class="head" id="sim-h">每條路的人生模擬</h2></section>';
    if (r.quote) h += '<section class="card quote" aria-label="一句話"><blockquote><p class="lead">' + esc(r.quote.text) + '</p>' +
      (r.quote.original ? '<p class="small muted">' + esc(r.quote.original) + '</p>' : '') + '<footer class="small muted">' + esc(r.quote.source || '') + '</footer></blockquote></section>';
    h += feedbackHtml(r);
    return h;
  }

  function feedbackHtml(r) {
    if (r.feedbackDone) return '<div class="card"><h2 class="head">謝謝你的回饋</h2></div>';
    function scale(k, label) {
      return '<fieldset class="field"><legend>' + label + '</legend><div class="choices">' + [1, 2, 3, 4, 5].map(function (n) { return '<label><input type="radio" name="' + k + '" value="' + n + '"> ' + n + '</label>'; }).join('') + '</div></fieldset>';
    }
    function pick(k, label, opts) {
      return '<fieldset class="field"><legend>' + label + '</legend><div class="choices">' + opts.map(function (o) { return '<label><input type="radio" name="' + k + '" value="' + esc(o) + '"> ' + esc(o) + '</label>'; }).join('') + '</div></fieldset>';
    }
    return '<section class="card" aria-labelledby="fb-h"><h2 class="head" id="fb-h">看完了，跟我們說說</h2><div class="fields">' +
      pick('before', '看報告之前，你比較想選哪個？', ['A', 'B', '還沒想法', '其他']) +
      pick('after', '看完之後，你現在想選哪個？', ['A', 'B', '報告提的另一條路', '還沒想法', '其他']) +
      scale('accurate', '報告把你的處境寫得準不準？（1 很不準，5 很準）') +
      '<div class="field"><label for="fb-wrong">有沒有寫錯的事實？寫在哪裡？</label><textarea id="fb-wrong" class="short"></textarea></div>' +
      scale('useful', '整份報告對你做決定有沒有用？') +
      scale('third', '「你可能沒想過的路」有沒有讓你想到原本沒想到的？') +
      pick('doable', '那條路你覺得做得到嗎？', ['做得到', '要再想想', '做不到', '太空泛']) +
      scale('human', '讀起來像真人寫的嗎？（1 很像 AI，5 像真人）') +
      '<div class="field"><label for="fb-best">哪一段最有用？哪一段最沒用？</label><textarea id="fb-best" class="short"></textarea></div>' +
      pick('pay', '如果要付錢買這份報告，你最多願意付多少？', ['不會付', '100 元以內', '100–300 元', '300–500 元', '500–1,000 元', '1,000 元以上']) +
      '<div class="field"><label for="fb-more">還有什麼想說的？</label><textarea id="fb-more" class="short"></textarea></div>' +
      '</div><div class="actions"><button class="btn" id="fb-ok">送出回饋</button></div><p class="small" id="fb-status" aria-live="polite"></p></section>';
  }

  function bind(r) {
    var b;
    if ((b = document.getElementById('card-ok'))) b.addEventListener('click', function () {
      send(b, 'confirmCard', { edits: document.getElementById('card-edit').value }, 'card-status');
    });
    if ((b = document.getElementById('q-ok'))) b.addEventListener('click', function () {
      var answers = (r.questions || []).map(function (q, i) { return { q: q, a: document.getElementById('q-' + i).value }; });
      send(b, 'answer', { answers: answers }, 'q-status');
    });
    if ((b = document.getElementById('fb-ok'))) b.addEventListener('click', function () {
      var f = {};
      ['before', 'after', 'accurate', 'useful', 'third', 'doable', 'human', 'pay'].forEach(function (k) { var x = document.querySelector('input[name="' + k + '"]:checked'); f[k] = x ? x.value : ''; });
      ['wrong', 'best', 'more'].forEach(function (k) { f[k] = document.getElementById('fb-' + k).value; });
      send(b, 'feedback', { feedback: f }, 'fb-status');
    });
    document.querySelectorAll('[data-dl]').forEach(function (btn) {
      btn.addEventListener('click', function () { download(btn, btn.dataset.dl); });
    });
    if (r.sim && window.renderSim) window.renderSim(document.getElementById('sim-root'), r.sim);
  }

  function send(btn, action, payload, statusId) {
    btn.disabled = true;
    var st = document.getElementById(statusId); st.textContent = '送出中…';
    window.pilotApi(action, Object.assign({ token: token }, payload)).then(function () { load(); })
      .catch(function (e) { btn.disabled = false; st.textContent = '沒送出去：' + e.message; });
  }

  function download(btn, name) {
    btn.disabled = true;
    window.pilotApi('download', { token: token, name: name }).then(function (r) {
      var bin = atob(r.data), arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([arr], { type: r.mime }));
      var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
      btn.disabled = false;
    }).catch(function (e) { btn.disabled = false; alert('下載失敗：' + e.message); });
  }

  document.getElementById('copy').addEventListener('click', function () {
    var i = document.getElementById('mylink'); i.select();
    (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(function () {
      document.getElementById('copy').textContent = '複製好了';
    }).catch(function () { document.execCommand && document.execCommand('copy'); });
  });

  load();
})();
