// 隨機投胎的畫面：開始 → 抽國家、出生登記 → 一年一年過 → 結局 → 回到某個抉擇走另一條。
(function () {
'use strict';
const E = window.PlayEngine, T = window.PlayText;
const $ = id => document.getElementById(id);
const SPEEDS = [900, 450, 180], SPEED_LABEL = ['1×', '2×', '4×'];
const EDU = ['沒念完中學', '中學', '技職', '大學'];
let D = null, index = null, cache = {};
let S = null;   // 這一局：{seed, age, iso, C, L, picks:[], peak, timer, speed, paused, lastLog, lastYr}

// ---------- 資料 ----------
// 資料檔帶版本號：重新打包後舊快取的資料不會配上新程式
const DATA_V = '20261114h';
const j = u => fetch(u + '?v=' + DATA_V).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
function boot() {
  return Promise.all([j('data/rules.json'), j('data/vdem.json'), j('data/index.json')]).then(([rules, vdem, idx]) => { D = { rules, vdem }; index = idx; E.config(idx); });
}
function country(iso) { return cache[iso] ? Promise.resolve(cache[iso]) : j('data/c/' + iso + '.json').then(c => (cache[iso] = c)); }
const newLife = (C, age, seed, extra) => E.Life(Object.assign({}, D), C, Object.assign({ age, seed }, extra || {}));

// ---------- 小工具 ----------
function show(id) { document.querySelectorAll('.scr').forEach(s => { s.hidden = s.id !== id; }); window.scrollTo(0, 0); }
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function money(L, usd) {
  const n = L.p.feel(usd), a = Math.abs(n), sg = n < 0 ? '負 ' : '';
  if (a >= 1e8) return sg + (a / 1e8).toFixed(1) + ' 億';
  if (a >= 1e4) return sg + Math.round(a / 1e4).toLocaleString('zh-TW') + ' 萬';
  return a ? sg + a.toLocaleString('zh-TW') + ' 元' : '0';
}
function births(iso, birthYear) {
  const i = Math.max(0, Math.min(index.countries[0].b.length - 1, birthYear - index.birthYears[0]));
  const tot = index.countries.reduce((s, c) => s + (c.b[i] || 0), 0), me = index.countries.find(c => c.iso === iso);
  return me ? (me.b[i] || 0) / tot * 100 : 0;
}
const famLabel = p => p.parentEdu === 2 ? '爸媽都念過大學' : p.parentEdu === 1 ? '爸媽念到中學' : '爸媽沒念完中學';
const jobLabel = p => p.retired ? '退休' : p.job ? p.job.name : p.inSchool ? '還在念書' : p.age < 18 ? '還是小孩' : '沒有工作';
const jobFinal = p => p.inSchool ? '還在念書' : p.job ? '最後一份工作：' + p.job.name + (p.retired ? '（已退休）' : '') : (p.retired ? '退休' : '沒有工作');
const famNow = p => (p.married ? '結婚' : '沒結婚') + '，' + (p.kids.length ? p.kids.length + ' 個小孩' : '沒有小孩');

// ---------- 1. 開始 ----------
function start(age, fixedSeed) {
  const seed = fixedSeed != null ? fixedSeed >>> 0 : (Math.random() * 4294967296) >>> 0;
  S = { seed, age, picks: [], peak: 0, timer: null, speed: 0, paused: false, lastLog: 0, lastYr: null };
  const r = E.rng(seed ^ 0xC0FFEE);
  S.iso = E.pickCountry(index, E.NOW - age, r);
  show('s-born'); $('birth').hidden = true; $('roll').classList.remove('landed'); $('roll-label').textContent = '抽一個國家⋯';
  country(S.iso).then(C => { S.C = C; roll(() => birthCard()); }).catch(fail);
}
function roll(done) {
  const names = index.countries.map(c => c.name), out = $('roll');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let n = 0; const total = reduce ? 1 : 16;
  (function tick() {
    if (n++ >= total) { out.textContent = S.C.name; out.classList.add('landed'); $('roll-label').textContent = (E.NOW - S.age) + ' 年，你出生在'; return setTimeout(done, reduce ? 0 : 350); }
    out.textContent = names[Math.floor(Math.random() * names.length)];
    setTimeout(tick, 40 + n * n * 1.1);
  })();
}
function birthCard() {
  S.L = newLife(S.C, S.age, S.seed);
  const p = S.L.p, C = S.C, lv = Math.min(10, Math.floor(p.wealthU * 10) + 1);
  const rows = [
    ['出生', (E.NOW - S.age) + ' 年，' + C.name + (p.urban ? '的城市' : '的鄉下')],
    ['性別', p.sex === 'F' ? '女生' : '男生'],
    ['家境', '第 ' + lv + ' 級（共 10 級，10 最富裕）'],
    ['兄弟姊妹', p.sibs ? p.sibs + ' 個' : '沒有，獨生'],
    ['爸媽', famLabel(p)],
    ['照' + C.name + '現在的死亡率算，平均活到', Math.round(C.p.life_exp || 70) + ' 歲']
  ];
  $('birth-dl').innerHTML = rows.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('');
  const by = E.NOW - S.age, y0 = index.birthYears[0], early = by < y0, pct = births(S.iso, by);
  // 出生權重只有 y0 年以後的，更早出生的用 y0 年估算（抽國家也是）
  const odds = pct >= 1 ? '每 100 個有 ' + Math.round(pct) + ' 個' : pct >= 0.1 ? '每 100 個有 ' + pct.toFixed(1) + ' 個' : pct * 100 >= 1 ? '每 1 萬個有 ' + Math.round(pct * 100) + ' 個' : '每 1 萬個不到 1 個';
  $('birth-odds').textContent = (early ? '以 ' + y0 + ' 年出生的嬰兒估算：' : '跟你同一年出生的嬰兒，') + odds + '生在' + C.name + '。';
  $('birth-money').textContent = '之後畫面上的錢都「折台幣」：照' + C.name + '當地的物價，換成在台灣大約等於多少，不是匯率。';
  $('birth').hidden = false;
  $('b-live').focus({ preventScroll: true });
}

// ---------- 2. 過一生 ----------
function live() {
  show('s-life'); $('feed').innerHTML = ''; $('choice').hidden = true;
  S.paused = false; $('b-pause').textContent = '暫停';
  hud(); next();
}
// 有事的年份停久一點，沒事的年份很快帶過（小時候常常好幾年沒事）
function next(quiet) { clearTimeout(S.timer); if (!S.paused) S.timer = setTimeout(tick, quiet ? 90 : SPEEDS[S.speed]); }
function tick() {
  const n0 = S.L.p.log.length, out = S.L.step();
  after(out, S.L.p.log.length === n0);
}
function after(out, quiet) {
  render();
  if (out && out.choice) return ask(out.choice);
  if (!S.L.p.alive) return setTimeout(end, S.picks.length ? 900 : 1800);
  next(quiet);
}
function render() {
  const p = S.L.p, feed = $('feed'), log = p.log;
  for (; S.lastLog < log.length; S.lastLog++) {
    const e = log[S.lastLog];
    if (!S.lastYr || S.lastYr.dataset.age !== String(e.age)) {
      S.lastYr = el('li', 'yr', '<div class="yr-a">' + e.age + '<small>' + e.year + '</small></div><ul></ul>');
      S.lastYr.dataset.age = e.age; feed.appendChild(S.lastYr);
    }
    const kind = !p.alive && S.lastLog === log.length - 1 ? 'end' : e.kind;
    S.lastYr.querySelector('ul').appendChild(el('li', kind, esc(e.text)));
  }
  hud();
  const nearBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 320;
  if (nearBottom && S.lastYr) S.lastYr.scrollIntoView({ block: 'end' });
}
function hud() {
  const p = S.L.p;
  $('h-age').textContent = p.year - S.L.birthYear;
  $('h-year').textContent = p.year + ' 年・' + S.C.name;
  $('h-who').innerHTML = '<b>' + esc(jobLabel(p)) + '</b>' + (p.age >= 18 ? '・' + esc(famNow(p)) : '');
  const st = p.stats, bar = v => '<div class="bar-m"><i style="width:' + Math.round(v) + '%"></i></div>';
  $('h-stats').innerHTML = [['健康', st.health], ['快樂', st.happy], ['知識', st.know], ['人際', st.social]].map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + Math.round(v) + '</dd>' + bar(v) + '</div>').join('') +
    '<div class="st-money"><dt>存款</dt><dd title="折合台幣">' + money(S.L, p.savings) + '</dd></div>';
}
function ask(c) {
  clearTimeout(S.timer);
  const box = $('choice');
  box.innerHTML = '<h3>' + esc(c.title) + '</h3><p class="desc">' + esc(c.desc) + '</p>' + (c.stat ? '<p class="stat">' + esc(c.stat) + '</p>' : '') +
    '<div class="opts">' + c.opts.map(o => '<button class="opt" data-k="' + esc(o.k) + '"><b>' + esc(o.label) + '</b>' + (o.hint ? '<span>' + esc(o.hint) + '</span>' : '') + '</button>').join('') + '</div>';
  box.hidden = false;
  box.querySelectorAll('.opt').forEach(b => { b.onclick = () => {
    const k = b.dataset.k, o = c.opts.find(x => x.k === k);
    S.picks.push({ age: S.L.p.age, year: S.L.p.year, id: c.id, title: c.title, k, label: o.label, opts: c.opts });
    box.hidden = true;
    after(S.L.choose(k));
  }; });
  setTimeout(() => box.scrollIntoView({ block: 'center' }), 30);
  box.querySelector('.opt').focus({ preventScroll: true });
}
function skip() {
  if (!$('choice').hidden || !S.L.p.alive) return;
  clearTimeout(S.timer);
  let out, n = 0;
  do { out = S.L.step(); } while (out && !out.choice && S.L.p.alive && n++ < 200);
  after(out);
}

// ---------- 3. 結局 ----------
function summary(L, peak) {
  const p = L.p, last = p.log[p.log.length - 1];
  return { age: p.age, year: p.year, cause: T.causes[p.cause] || '', end: last ? last.text : '', peak: money(L, Math.max(peak, 0)), left: money(L, Math.max(p.savings, 0)),
    edu: EDU[p.edu] || '', job: jobFinal(p), fam: famNow(p), peakN: peak, leftN: p.savings };
}
function end() {
  clearTimeout(S.timer);
  const p = S.L.p, s = summary(S.L, p.peak || 0), C = S.C;
  show('s-end');
  $('e-where').textContent = (E.NOW - S.age) + ' 年生在' + C.name + (p.urban ? '城市' : '鄉下') + '的' + (p.sex === 'F' ? '女生' : '男生');
  $('e-h').textContent = s.end;
  const kid = s.age < 18;
  $('e-facts').innerHTML = (kid ? [['活到', s.age + ' 歲'], ['照' + C.name + '現在的死亡率算，平均活到', Math.round(C.p.life_exp || 70) + ' 歲']] : [['活到', s.age + ' 歲'], ['存款最多（折台幣）', s.peak], ['留下的錢（折台幣）', s.left], ['學歷', s.edu], ['工作', s.job], ['家庭', s.fam]])
    .map(([k, v]) => '<div><dt>' + k + '</dt><dd>' + esc(v) + '</dd></div>').join('');
  // 同一年有好幾種衰退標籤只算一次；1996 年以前沒有國家大事的資料，要講清楚
  const cl = p.countryLog, yrs = es => new Set(cl.filter(x => es.includes(x.e)).map(x => x.year)).size;
  const bits = [];
  if (p.yearsWar) bits.push(p.yearsWar + ' 年戰亂');
  if (yrs(['rec', 'dep', 'glob'])) bits.push(yrs(['rec', 'dep', 'glob']) + ' 次經濟衰退');
  if (yrs(['cur'])) bits.push(yrs(['cur']) + ' 次貨幣大貶');
  if (yrs(['def', 'def0', 'def1', 'def2'])) bits.push(yrs(['def', 'def0', 'def1', 'def2']) + ' 次政府倒債');
  if (yrs(['hinf'])) bits.push(yrs(['hinf']) + ' 次惡性通膨');
  if (yrs(['coup'])) bits.push(yrs(['coup']) + ' 次政變');
  const born = E.NOW - S.age, y0 = E.HIST0, from = born < y0 ? y0 + ' 年以後，' : '這一生，';
  $('e-world').textContent = p.year < y0 ? '這段年份的國家大事這裡沒有資料。' : bits.length ? from + C.name + '經歷了 ' + bits.join('、') + '。' : from + C.name + '沒有遇到戰亂和大的經濟危機。';
  const box = $('e-picks'); box.innerHTML = '';
  // 停 0 次的局（多半是小時候就走了）：不列空清單、不出報告的鉤子，主按鈕是再出生一次
  const none = !S.picks.length;
  $('e-picks-wrap').hidden = none; $('e-bridge').hidden = none; $('e-none').hidden = !none;
  $('e-none').textContent = p.age < 18 ? '這一生太短，沒來得及做選擇。' : '這一生沒有遇到要你拿主意的時刻，都交給了命運和系統。';
  $('b-again').className = none ? 'btn' : 'btn quiet';
  const autos = p.picks.filter(x => x.auto);
  $('e-auto').textContent = autos.length ? '另外有 ' + autos.length + ' 個選擇交給系統決定：' + autos.map(x => x.age + ' 歲「' + T.choices[x.id].title + '」選了「' + T.choices[x.id].opts.find(o => o.k === x.k).label + '」').join('；') + '。' : '';
  S.picks.forEach((pk, i) => {
    const li = el('li', 'pk', '<span class="pk-a">' + pk.age + ' 歲</span><span class="pk-q">' + esc(pk.title) + '</span><span class="pk-me">你選了「' + esc(pk.label) + '」</span>');
    const alt = el('div', 'pk-alt');
    pk.opts.filter(o => o.k !== pk.k).forEach(o => { const b = el('button', '', '改成「' + esc(o.label) + '」'); b.onclick = () => branch(i, o); alt.appendChild(b); });
    li.appendChild(alt); box.appendChild(li);
  });
  $('e-h').focus && $('e-h').setAttribute('tabindex', '-1');
}

// ---------- 4. 另一條路 ----------
function branch(i, alt) {
  const pk = S.picks[i], prefer = {};
  S.picks.forEach(x => { if (!(x.id in prefer)) prefer[x.id] = x.k; });
  prefer[pk.id] = alt.k;
  const L = newLife(S.C, S.age, S.seed, { prefer });
  let q = 0, out = L.step(), guard = 0;
  while (L.p.alive && guard++ < 600) {
    if (out && out.choice) {
      let k;
      if (q < i) k = S.picks[q].k; else { k = alt.k; L.setAuto(true); }
      if (!out.choice.opts.some(o => o.k === k)) k = out.choice.opts[0].k;
      q++; out = L.choose(k); continue;
    }
    out = L.step();
  }
  const a = summary(S.L, S.L.p.peak || 0), b = summary(L, L.p.peak || 0);
  show('s-branch');
  $('br-where').textContent = '回到 ' + pk.age + ' 歲：' + pk.title;
  $('br-h').textContent = '如果當初選了「' + alt.label + '」';
  const better = (x, y, hi) => (hi ? x > y : x < y) ? ' class="up"' : '';
  // 選擇帶出來的差異放上面；壽命和怎麼走的含運氣，分開放下面並標出來
  const col = (s, other, cls, head) => '<div class="' + cls + '"><h4>' + head + '</h4><dl>' +
    '<dt>學歷・工作</dt><dd>' + esc(s.edu + '・' + s.job) + '</dd>' +
    '<dt>家庭</dt><dd>' + esc(s.fam) + '</dd>' +
    '<dt>存款最多（折台幣）</dt><dd' + better(s.peakN, other.peakN, true) + '>' + esc(s.peak) + '</dd>' +
    '<dt>留下的錢（折台幣）</dt><dd' + better(s.leftN, other.leftN, true) + '>' + esc(s.left) + '</dd>' +
    '</dl><dl class="luck"><dt>活到（含運氣）</dt><dd>' + s.age + ' 歲</dd>' +
    '<dt>怎麼走的（含運氣）</dt><dd>' + esc(s.end) + '</dd></dl></div>';
  $('br-cmp').innerHTML = col(a, b, 'me', '你走過的<b>「' + esc(pk.label) + '」</b>') + col(b, a, 'alt', '另一條<b>「' + esc(alt.label) + '」</b>');
  const evs = (LL, from) => LL.p.log.filter(e => e.age >= from && e.kind !== 'news' && e.kind !== 'note' && e.kind !== 'pick');
  const key = e => e.age + '|' + e.text;
  const ma = evs(S.L, pk.age), mb = evs(L, pk.age), sa = new Set(ma.map(key)), sb = new Set(mb.map(key));
  const list = arr => '<ul>' + (arr.length ? arr.slice(0, 10).map(e => '<li><b>' + e.age + ' 歲</b>' + esc(e.text) + '</li>').join('') : '<li>沒有不一樣的事</li>') + '</ul>';
  $('br-diff').innerHTML = '<div><h4>只在你走過的這條發生</h4>' + list(ma.filter(e => !sb.has(key(e)))) + '</div><div class="alt"><h4>只在另一條發生</h4>' + list(mb.filter(e => !sa.has(key(e)))) + '</div>';
}

function fail(e) { console.error(e); $('err').hidden = false; }

// ---------- 事件 ----------
$('f-start').onsubmit = ev => { ev.preventDefault(); const v = Number($('age').value); const a = Math.max(0, Math.min(E.MAX_AGE, Math.round(Number.isFinite(v) && $('age').value !== '' ? v : 30))); start(a); };
$('b-reborn').onclick = () => start(S.age);
$('b-live').onclick = live;
$('b-pause').onclick = () => { S.paused = !S.paused; $('b-pause').textContent = S.paused ? '繼續' : '暫停'; if (!S.paused && $('choice').hidden) next(); else clearTimeout(S.timer); };
$('b-speed').onclick = () => { S.speed = (S.speed + 1) % SPEEDS.length; $('b-speed').textContent = '速度 ' + SPEED_LABEL[S.speed]; };
$('b-skip').onclick = skip;
$('b-again').onclick = $('b-again2').onclick = () => start(S.age);
$('b-back').onclick = () => show('s-end');

boot().then(() => {
  // ?age= 從首頁帶過來；?seed= 指定同一個人生。不合格的值一律不理，留在開始的表單
  const q = E.parseQuery(location.search);
  if (q) { $('age').value = q.age; start(q.age, q.seed); }
}).catch(fail);
})();
