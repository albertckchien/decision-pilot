// 人生模擬播放器：讀引擎產出的 人生模擬.json（engine/simulate.js），8-bit 像素場景（pixel.js）。
// case.js 有 人生模擬.json 時呼叫 window.renderSim(root, data)。
window.renderSim = function (root, data) {
  if (!data || !data.options || !data.options.length) return;
  var cur = 0, step = 0, maxStep = 0, timer = null, speed = 1, SPEEDS = [1, 2, 4, 8], scenes = {};
  var FAM = {}; (data.family || []).forEach(function (p) { FAM[p[0]] = p[1]; });
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  root.insertAdjacentHTML('beforeend',
    '<div class="sim-opts" role="group" aria-label="選一個選項">' + data.options.map(function (o, i) { return '<button class="sim-opt" data-i="' + i + '" aria-pressed="' + (i === 0) + '"><strong>' + esc(o.id + '　' + o.name) + '</strong><span>' + esc(o.sub || '') + '</span></button>'; }).join('') + '</div>' +
    '<div class="sim-ctrl"><button class="go sim-play">播放</button><button class="sim-spd">速度 1×</button><button class="sim-skip">跳到結局</button><span class="sp"></span><button class="sim-only-m" data-one="good" aria-pressed="true">運氣好</button><button class="sim-only-m" data-one="bad" aria-pressed="false">運氣差</button></div>' +
    '<div class="sim-stages" data-one="good"><section class="sim-stage good" aria-label="運氣好的那一段"></section><section class="sim-stage bad" aria-label="運氣差的那一段"></section></div>' +
    '<p class="sim-note">每條路跑了 ' + data.runs + ' 次，挑出排在前兩成和後兩成附近的兩段。人生選擇一律保守，好壞只來自外在的運氣。金額都換算成今天的錢；數字是示意，不是預測。</p>');
  var Q = function (s) { return root.querySelector(s); };

  function profileHtml(y) {
    var p = y.profile || {}, kidF = (data.family || []).filter(function (f) { return /小的|大的|小孩/.test(f[0]); });
    var me = [['年紀', y.age + ' 歲，住' + y.city], ['工作', (p.title || '') + (p.income ? '，年收入約 ' + p.income + ' 萬' : '')], ['存款', y.stats.m + ' 萬'], ['身體', p.health || '']];
    var fam = [];
    if (p.sp) fam.push(['另一半', FAM['另一半'] + '，' + (p.sp.status === '已過世' ? '已過世' : p.sp.age + ' 歲，' + p.sp.status)]);
    (p.kids || []).forEach(function (k, i) { var f = kidF[i]; fam.push([f ? f[0].replace(/（.*）/, '') : '小孩', (f ? f[1] + '，' : '') + k.age + ' 歲，' + k.status]); });
    (p.parents || []).forEach(function (pp) { var lab = pp.id === 'father' ? '爸爸' : '媽媽'; fam.push([lab, FAM[lab] + '，' + (pp.status === '已過世' ? '已過世' : pp.age + ' 歲，' + pp.status)]); });
    var near = [];
    if (p.boss) near.push(['主管', p.boss]);
    if (p.cws && p.cws.length) near.push(['同事', p.cws.join('、')]);
    if (p.friends && p.friends.length) near.push(['好朋友', p.friends.join('、')]);
    function dl(title, r) { return '<div><h4>' + title + '</h4><dl>' + r.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl></div>'; }
    return dl('你', me) + dl('家人', fam) + (near.length ? dl('身邊的人', near) : '');
  }

  function build(k) {
    var L = data.options[cur][k], st = Q('.sim-stage.' + k), y0 = L.years[0];
    if (scenes[k]) scenes[k].stop();
    st.innerHTML = '<h3><span class="' + (k === 'good' ? 'sim-good-t' : '') + '">' + (k === 'good' ? '運氣好的那一段' : '運氣差的那一段') + '</span><small>不是最' + (k === 'good' ? '好' : '慘') + '的那次</small></h3>' +
      '<div class="sim-scene"><canvas class="sim-px" aria-hidden="true"></canvas><span class="sim-place">' + esc(y0.city) + '</span><div class="sim-age">' + y0.age + '<small>' + y0.year + '</small></div><div class="sim-pop" aria-live="polite"></div></div>' +
      '<div class="sim-profile">' + profileHtml(y0) + '</div>' +
      '<div class="sim-bars"><span>存款</span><div class="sim-bar money"><i></i></div><b class="v-m"></b><span>健康</span><div class="sim-bar"><i></i></div><b class="v-h"></b><span>家庭</span><div class="sim-bar"><i></i></div><b class="v-f"></b><span>事業</span><div class="sim-bar"><i></i></div><b class="v-c"></b></div>' +
      '<ol class="sim-feed" aria-live="off"></ol><div class="sim-map">' + L.map.map(function () { return '<span></span>'; }).join('') + '</div><div class="sim-maplab"><span>' + y0.age + ' 歲</span><span>人生地圖：一格一年，越藍越順、越黑越難</span><span>' + L.end + ' 歲</span></div><div class="sim-card"></div>';
    st._peak = Math.max(1, L.card.peak);
    scenes[k] = window.PixelScene ? window.PixelScene(st.querySelector('.sim-px')) : null;
    setScene(k, y0);
    bars(st, y0.stats);
  }
  function setScene(k, y) {
    if (!scenes[k]) return;
    var p = y.profile || {};
    scenes[k].set({ city: y.city, age: y.age, spouse: !!(p.sp && p.sp.status !== '已過世'), spouseFemale: true,
      kids: (p.kids || []).map(function (kd, i) { return { age: kd.age, female: i % 2 === 0 }; }) });
  }
  function bars(st, s) {
    var b = st.querySelectorAll('.sim-bar i');
    b[0].style.width = Math.max(2, Math.min(100, s.m / st._peak * 100)) + '%'; b[1].style.width = s.h + '%'; b[2].style.width = s.f + '%'; b[3].style.width = s.c + '%';
    st.querySelector('.v-m').textContent = s.m + ' 萬'; st.querySelector('.v-h').textContent = s.h; st.querySelector('.v-f').textContent = s.f; st.querySelector('.v-c').textContent = s.c;
  }
  function paint(st, L, upto) {
    var cells = st.querySelectorAll('.sim-map span');
    for (var i = 0; i <= upto && i < L.map.length; i++) { var v = L.map[i]; cells[i].style.background = v > 2 ? '#1a4be0' : v > 0.5 ? '#7f9cf0' : v > -1 ? '#bfbfbf' : '#111'; }
  }
  function pop(st, text, kind) { var p = st.querySelector('.sim-pop'); p.className = 'sim-pop' + (kind ? ' ' + kind : ''); p.textContent = text; void p.offsetWidth; p.classList.add('show'); }
  function feed(st, html, cls) { var f = st.querySelector('.sim-feed'), li = document.createElement('li'); li.className = cls || ''; li.innerHTML = html; f.prepend(li); while (f.children.length > 14) f.lastChild.remove(); }
  function apply(k, i, quick) {
    var L = data.options[cur][k], st = Q('.sim-stage.' + k), n = L.years.length;
    if (i < n) {
      var y = L.years[i];
      st.querySelector('.sim-age').innerHTML = y.age + '<small>' + y.year + '</small>';
      st.querySelector('.sim-place').textContent = y.age >= 63 ? y.city + '・公園' : y.city;
      setScene(k, y);
      st.querySelector('.sim-profile').innerHTML = profileHtml(y);
      var gap = quick ? 0 : Math.min(160, 1100 / speed / Math.max(1, y.events.length));
      y.events.forEach(function (e, j) { var go = function () { feed(st, '<span class="y">' + y.age + ' 歲</span><span>' + esc(e[0]) + '</span>', e[1]); }; if (gap) setTimeout(go, j * gap); else go(); });
      var main = y.events.find(function (e) { return e[1] === 'big' || e[1] === 'hit' || e[1] === 'end'; }) || y.events[0];
      if (main && !quick) pop(st, main[0], main[1]); else if (quick) st.querySelector('.sim-pop').className = 'sim-pop';
      bars(st, y.stats); paint(st, L, i);
    } else if (i === n) card(st, L, k);
  }
  function card(st, L, k) {
    var c = L.card, el = st.querySelector('.sim-card');
    el.innerHTML = '<h4>' + (k === 'good' ? '運氣好的這一生' : '運氣差的這一生') + '</h4><div class="row"><div><b>' + c.end + ' 歲</b><span>活到</span></div><div><b>' + c.peak + ' 萬</b><span>存款最高的時候</span></div><div><b>' + c.left + ' 萬</b><span>走的時候留下的</span></div></div><ul>' + c.big.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '<li>最順的一年：' + esc(c.best) + '</li><li>最難的一年：' + esc(c.worst) + '</li></ul><button class="again">再看一次</button>';
    el.classList.add('show');
    el.querySelector('.again').onclick = reset;
  }
  function reset() { stop(); step = 0; build('good'); build('bad'); maxStep = Math.max(data.options[cur].good.years.length, data.options[cur].bad.years.length) + 1; }
  function tick(quick) { apply('good', step, quick); apply('bad', step, quick); step++; if (step >= maxStep) stop(); }
  function stop() { clearInterval(timer); timer = null; Q('.sim-play').textContent = step > 0 && step < maxStep ? '繼續' : '播放'; }
  function play() { if (timer) { stop(); return; } if (step >= maxStep) reset(); Q('.sim-play').textContent = '暫停'; timer = setInterval(function () { tick(false); }, 2000 / speed); }
  Q('.sim-play').onclick = play;
  Q('.sim-spd').onclick = function () { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; this.textContent = '速度 ' + speed + '×'; if (timer) { stop(); play(); } };
  Q('.sim-skip').onclick = function () { stop(); while (step < maxStep) tick(true); };
  root.querySelectorAll('.sim-opt').forEach(function (b) { b.onclick = function () { cur = +b.dataset.i; root.querySelectorAll('.sim-opt').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); reset(); }; });
  root.querySelectorAll('[data-one]').forEach(function (b) { b.onclick = function () { Q('.sim-stages').dataset.one = b.dataset.one; root.querySelectorAll('[data-one]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }; });
  reset();
};
