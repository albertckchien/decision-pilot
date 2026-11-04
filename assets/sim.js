// 人生模擬播放器：讀引擎產出的 人生模擬.json（engine/simulate.js），8-bit 像素場景（pixel.js）。
// case.js 有 人生模擬.json 時呼叫 window.renderSim(root, data)。
window.renderSim = function (root, data) {
  if (!data || !data.options || !data.options.length) return;
  var cur = 0, step = 0, maxStep = 0, timer = null, speed = 1, SPEEDS = [1, 2, 4, 8], scenes = {};
  var FAM = {}, SEX = {}; (data.family || []).forEach(function (p) { FAM[p[0]] = p[1]; SEX[p[0]] = p[2]; });
  var KIDS = (data.family || []).filter(function (f) { return /^老|^小孩/.test(f[0]); });
  var mobile = window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  // 金額都走這裡（嚴審 F12、F13）：負的寫負債，一萬萬以上寫億，其他加千分位
  function money(m) {
    m = Math.round(m);
    var a = Math.abs(m), t = a >= 10000 ? (a / 10000).toFixed(a >= 100000 ? 0 : 1) + ' 億' : a.toLocaleString('zh-TW') + ' 萬';
    return m < 0 ? '負債 ' + t : t;
  }

  root.insertAdjacentHTML('beforeend',
    '<p class="sim-lead">每條路各跑了 ' + data.runs + ' 次人生，國家的景氣、匯率、天災照真實資料擲骰，壽命照生命表。下面挑出運氣好、運氣差各一段並排播放。人生選擇一律保守，好壞只來自外在的運氣。<strong>這是示意，不是預測，也不是理財建議。</strong>按「播放」開始。</p>' +
    '<div class="sim-opts" role="group" aria-label="選一個選項">' + data.options.map(function (o, i) { return '<button class="sim-opt" data-i="' + i + '" aria-pressed="' + (i === 0) + '"><strong>' + esc(o.id + '　' + o.name) + '</strong><span>' + esc(o.sub || '') + '</span></button>'; }).join('') + '</div>' +
    '<div class="sim-ctrl"><button class="go sim-play">播放</button><button class="sim-spd">速度 1×</button><button class="sim-skip">跳到結局</button><span class="sp"></span><button class="sim-only-m" data-one="good" aria-pressed="true">運氣好</button><button class="sim-only-m" data-one="bad" aria-pressed="false">運氣差</button></div>' +
    '<div class="sim-stages" data-one="good"><section class="sim-stage good" aria-label="運氣好的那一段"></section><section class="sim-stage bad" aria-label="運氣差的那一段"></section></div>' +
    '<p class="sim-note">金額都換算成今天的錢。算進去的：薪水、另一半的收入、生活費、小孩念大學、照顧爸媽、退休年金、存款的報酬；沒算進去的：房貸、保險、外派的津貼和額外花費。數字是示意，判斷請看報告前面的分析。</p>');
  var Q = function (s) { return root.querySelector(s); };

  function profileHtml(y) {
    var p = y.profile || {};
    var me = [['年紀', y.age + ' 歲，住' + y.city], p.pension ? ['收入', '退休，年金約 ' + money(p.income) + '／年'] : ['工作', (p.title || '') + (p.income ? '，年收入約 ' + money(p.income) : '')], [y.stats.m < 0 ? '負債' : '存款', money(y.stats.m).replace('負債 ', '')], ['身體', p.health || '']];
    var fam = [];
    if (p.sp) fam.push(['另一半', FAM['另一半'] + '，' + (p.sp.status === '已過世' ? '已過世' : p.sp.age + ' 歲，' + p.sp.status)]);
    (p.kids || []).forEach(function (k, i) { var f = KIDS[i]; fam.push([f ? f[0] : '小孩', (f ? f[1] + '，' : '') + k.age + ' 歲，' + k.status]); });
    (p.parents || []).forEach(function (pp) { var lab = pp.id === 'father' ? '爸爸' : '媽媽'; fam.push([lab, FAM[lab] + '，' + (pp.status === '已過世' ? '已過世' : pp.age + ' 歲，' + pp.status)]); });
    var near = [];
    if (p.boss) near.push(['主管', p.boss]);
    if (p.cws && p.cws.length) near.push(['同事', p.cws.join('、')]);
    if (p.friends && p.friends.length) near.push(['好朋友', p.friends.join('、')]);
    function dl(title, r) { return '<div><h4>' + title + '</h4><dl>' + r.map(function (x) { return '<dt>' + esc(x[0]) + '</dt><dd>' + esc(x[1]) + '</dd>'; }).join('') + '</dl></div>'; }
    return dl('你', me) + dl('家人', fam) + (near.length ? dl('身邊的人', near) : '');
  }

  function build(k) {
    var O = data.options[cur], L = O[k], st = Q('.sim-stage.' + k), y0 = L.years[0];
    if (scenes[k]) scenes[k].stop();
    var rank = L.pct != null ? '在 ' + data.runs + ' 次裡排第 ' + L.pct + ' 百分位' : (k === 'good' ? '不是最好的那次' : '不是最慘的那次');
    // 順序（嚴審 F9）：場景、今年的事、數值，個人資訊收在可以展開的區塊，手機上預設收起
    st.innerHTML = '<h3><span class="' + (k === 'good' ? 'sim-good-t' : '') + '">' + (k === 'good' ? '運氣好的那一段' : '運氣差的那一段') + '</span><small>' + rank + '</small></h3>' +
      '<div class="sim-scene"><canvas class="sim-px" aria-hidden="true"></canvas><span class="sim-place">' + esc(y0.city) + '</span><div class="sim-age">' + y0.age + '<small>' + y0.year + '</small></div><div class="sim-pop"></div></div>' +
      '<ol class="sim-feed" aria-live="off"></ol>' +
      '<div class="sim-bars"><span>存款</span><div class="sim-bar money"><i></i></div><b class="v-m"></b><span>健康</span><div class="sim-bar"><i></i></div><b class="v-h"></b><span>家庭</span><div class="sim-bar"><i></i></div><b class="v-f"></b><span>事業</span><div class="sim-bar"><i></i></div><b class="v-c"></b></div>' +
      '<details class="sim-pd"' + (mobile ? '' : ' open') + '><summary>你和身邊的人</summary><div class="sim-profile">' + profileHtml(y0) + '</div></details>' +
      '<div class="sim-map">' + L.map.map(function () { return '<span></span>'; }).join('') + '</div><div class="sim-maplab"><span>' + y0.age + ' 歲</span><span>人生地圖：一格一年，看那年好事和壞事的分量。藍色是好事比較重，越深越好；灰黑色是壞事比較重，越黑越難；淺灰是平常、或好壞剛好抵銷的一年</span><span>' + L.end + ' 歲</span></div><div class="sim-card"></div>';
    st._peak = Math.max(1, L.card.peak);
    scenes[k] = window.PixelScene ? window.PixelScene(st.querySelector('.sim-px')) : null;
    setScene(k, y0);
    bars(st, y0.stats);
  }
  // 畫面的性別讀引擎給的，不自己猜（嚴審 F6）
  function setScene(k, y) {
    if (!scenes[k]) return;
    var p = y.profile || {};
    scenes[k].set({ city: y.city, age: y.age, female: data.gender === 'F', spouse: !!(p.sp && p.sp.status !== '已過世'), spouseFemale: SEX['另一半'] !== 'M',
      kids: (p.kids || []).map(function (kd, i) { return { age: kd.age, female: KIDS[i] ? KIDS[i][2] === 'F' : false }; }) });
  }
  function bars(st, s) {
    var b = st.querySelectorAll('.sim-bar i');
    b[0].style.width = Math.max(2, Math.min(100, s.m / st._peak * 100)) + '%'; b[1].style.width = s.h + '%'; b[2].style.width = s.f + '%'; b[3].style.width = s.c + '%';
    st.querySelector('.v-m').textContent = money(s.m); st.querySelector('.v-h').textContent = s.h; st.querySelector('.v-f').textContent = s.f; st.querySelector('.v-c').textContent = s.c;
  }
  function paint(st, L, upto) {
    var cells = st.querySelectorAll('.sim-map span');
    for (var i = 0; i <= upto && i < L.map.length; i++) { var v = L.map[i]; cells[i].style.background = v >= 3 ? '#1a4be0' : v > 0 ? '#7f9cf0' : v === 0 ? '#d4d4d4' : v > -3 ? '#666' : '#111'; cells[i].title = L.years[i].age + ' 歲'; }
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
      var main = y.events.filter(function (e) { return e[1] === 'end'; })[0] || y.events.slice().sort(function (a, b) { return Math.abs(b[2] || 0) - Math.abs(a[2] || 0); })[0];
      if (main && !quick) pop(st, main[0], main[1]); else if (quick) st.querySelector('.sim-pop').className = 'sim-pop';
      bars(st, y.stats); paint(st, L, i);
    } else if (i === n) card(st, L, k);
  }
  function card(st, L, k) {
    var c = L.card, D = data.options[cur].dist, el = st.querySelector('.sim-card');
    el.innerHTML = '<h4>' + (k === 'good' ? '運氣好的這一生' : '運氣差的這一生') + '</h4><div class="row"><div><b>' + c.end + ' 歲</b><span>活到</span></div><div><b>' + money(c.peak) + '</b><span>存款最多的時候</span></div><div><b>' + money(c.left) + '</b><span>走的時候留下的</span></div></div>' +
      (D ? '<p class="dist">這條路跑的 ' + data.runs + ' 次裡：一半的人活到 ' + D.medEnd + ' 歲以上，' + D.over80 + '% 活過 80 歲；留下的錢中位數約 ' + money(D.medLeft) + '。</p>' : '') +
      '<ul>' + c.big.map(function (b) { return '<li>' + esc(b) + '</li>'; }).join('') + '<li>最順的一年：' + esc(c.best) + '</li><li>最難的一年：' + esc(c.worst) + '</li></ul>' +
      '<p class="dist">這是示意，不是預測，也不是理財建議。這兩段讓你感受這條路走下去的樣子，要怎麼選，請回到報告前面的比較和建議。</p><button class="again">再看一次</button>';
    el.classList.add('show');
    el.querySelector('.again').onclick = function () { reset(); play(); };
  }
  function reset() { stop(); step = 0; build('good'); build('bad'); maxStep = Math.max(data.options[cur].good.years.length, data.options[cur].bad.years.length) + 1; }
  function tick(quick) { apply('good', step, quick); apply('bad', step, quick); step++; if (step >= maxStep) stop(); }
  function stop() { clearInterval(timer); timer = null; Q('.sim-play').textContent = step > 0 && step < maxStep ? '繼續' : '播放'; }
  // 按下去當下就推進第一年，不用等 2 秒（嚴審 F8）
  function play() { if (timer) { stop(); return; } if (step >= maxStep) reset(); Q('.sim-play').textContent = '暫停'; tick(false); if (step < maxStep) timer = setInterval(function () { tick(false); }, 2000 / speed); else stop(); }
  Q('.sim-play').onclick = play;
  Q('.sim-spd').onclick = function () { speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]; this.textContent = '速度 ' + speed + '×'; if (timer) { clearInterval(timer); timer = setInterval(function () { tick(false); }, 2000 / speed); } };
  Q('.sim-skip').onclick = function () { stop(); while (step < maxStep) tick(true); };
  root.querySelectorAll('.sim-opt').forEach(function (b) { b.onclick = function () { cur = +b.dataset.i; root.querySelectorAll('.sim-opt').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); reset(); }; });
  root.querySelectorAll('[data-one]').forEach(function (b) { b.onclick = function () { Q('.sim-stages').dataset.one = b.dataset.one; root.querySelectorAll('[data-one]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }; });
  reset();
};
