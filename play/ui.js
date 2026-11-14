// 隨機投胎的畫面：開始 → 抽國家、出生登記 → 一年一年過 → 結局 → 回到某個抉擇走另一條。
(function () {
'use strict';
const E = window.PlayEngine, T = window.PlayText;
const $ = id => document.getElementById(id);
const SPEEDS = [900, 450, 180], SPEED_LABEL = ['1×', '2×', '4×'];
const EDU = ['中學以下', '中學', '技職', '大學'];
let D = null, index = null, cache = {};
let S = null;   // 這一局：{seed, age, iso, C, L, picks:[], peak, timer, speed, paused, lastLog, lastYr}

// ---------- 資料 ----------
// 資料檔帶版本號：重新打包後舊快取的資料不會配上新程式
const DATA_V = '20261115f';  // 資料包重新打包時才換
// 分享連結帶的版本＝資料版本＋引擎版本，任一個換了，朋友打開時會提示可能不一樣
const SHARE_V = () => DATA_V + '-' + E.ENGINE_V;
// 漏斗：網址上的 from 合格就沿用（例如分享進來的 share），不然是 play；連結一律用 URL 物件組
const FROM = (() => { const f = new URLSearchParams(location.search).get('from'); return f && /^[a-z]{1,12}$/.test(f) ? f : 'play'; })();
function beginLink() { const u = new URL('../begin.html', location.href); u.searchParams.set('from', FROM); return u.href; }
const j = u => fetch(u + '?v=' + DATA_V).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
function boot() {
  return Promise.all([j('data/rules.json'), j('data/vdem.json'), j('data/index.json')]).then(([rules, vdem, idx]) => { D = { rules, vdem }; index = idx; E.config(idx); });
}
function country(iso) { return cache[iso] ? Promise.resolve(cache[iso]) : j('data/c/' + iso + '.json').then(c => (cache[iso] = c)); }
const newLife = (C, age, seed, extra) => E.Life(Object.assign({}, D), C, Object.assign({ age, seed }, extra || {}));

// ---------- 小工具 ----------
// 螢幕閱讀器：逐年那一串不念（feed 沒有 aria-live），只在出生、抉擇、結局、分岔時念一句
function announce(t) { const r = $('sr'); r.textContent = ''; setTimeout(() => { r.textContent = t; }, 50); }
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
// 偏好（住的國家、略過可怕的情節）只存在這台瀏覽器；讀寫失敗（無痕、封鎖）就用預設值
const pref = {
  get: (k, d) => { try { const v = localStorage.getItem('play.' + k); return v == null ? d : v; } catch (e) { return d; } },
  set: (k, v) => { try { localStorage.setItem('play.' + k, v); } catch (e) { /* 存不了就算了 */ } }
};
// 畫面上的句子：打開「略過可怕的情節」時用輕描淡寫版（只換字，結果不變）
const say = e => S && S.soft && e.soft ? e.soft : e.text;
const famLabel = p => p.parentEdu === 2 ? '爸媽都念過大學' : p.parentEdu === 1 ? '爸媽念到中學' : '爸媽的學歷在中學以下';
const jobLabel = p => p.retired ? '退休' : p.job ? p.job.name : p.inSchool ? '還在念書' : p.age < 18 ? '還是小孩' : '沒有工作';
const jobFinal = p => p.inSchool ? '還在念書' : p.job ? '最後一份工作：' + p.job.name + (p.retired ? '（已退休）' : '') : (p.retired ? '退休' : '沒有工作');
const shortLife = p => !p.alive && p.age < 5;   // 5 歲前走的局（分享文字、落地提示共用）
const famNow = p => (p.married ? '結婚' : '沒結婚') + '，' + (p.kids.length ? p.kids.length + ' 個小孩' : '沒有小孩');

// ---------- 1. 開始 ----------
function start(age, fixedSeed, shared) {
  const seed = fixedSeed != null ? fixedSeed >>> 0 : (Math.random() * 4294967296) >>> 0;
  S = { seed, age, picks: [], peak: 0, timer: null, speed: 0, paused: false, lastLog: 0, lastYr: null, games: (S ? S.games : 0) + 1, skipRoll: false, shared: !!shared,
    home: $('home').value || 'TWN', soft: $('soft').checked };
  const r = E.rng(seed ^ 0xC0FFEE);
  S.iso = E.pickCountry(index, E.NOW - age, r);
  show('s-born'); $('birth').hidden = true; $('roll').classList.remove('landed'); $('roll-label').textContent = '抽一個國家⋯';
  $('b-skiproll').hidden = S.games < 2;   // 第一局保留懸念，第二局起可以跳過
  // 住的國家載入失敗不擋遊戲，出生卡就只列出生的國家
  Promise.all([country(S.iso), country(S.home).catch(() => null)]).then(([C, H]) => { S.C = C; S.H = H; roll(() => birthCard()); }).catch(fail);
}
function roll(done) {
  const names = index.countries.map(c => c.name), out = $('roll');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let n = 0; const total = reduce ? 1 : 16;
  (function tick() {
    if (S.skipRoll) n = total;
    if (n++ >= total) { out.textContent = S.C.name; out.classList.add('landed'); $('roll-label').textContent = (E.NOW - S.age) + ' 年，你出生在'; return setTimeout(done, reduce ? 0 : 350); }
    out.textContent = names[Math.floor(Math.random() * names.length)];
    setTimeout(tick, 40 + n * n * 1.1);
  })();
}
function birthCard() {
  S.L = newLife(S.C, S.age, S.seed);
  const p = S.L.p, C = S.C, lv = Math.min(10, Math.floor(p.wealthU * 10) + 1);
  // 名字用另一條亂數（不動人生的運氣）：同一個種子永遠同一個名字
  S.name = window.PlayNames ? window.PlayNames.nameFor(C, p.sex, E.rng((S.seed ^ 0x4E414D45) >>> 0)) : '';
  const rows = [
    ['名字', S.name],
    ['出生', (E.NOW - S.age) + ' 年，' + C.name + (p.urban ? '的城市' : '的鄉下')],
    ['性別', p.sex === 'F' ? '女生' : '男生'],
    ['家境', '第 ' + lv + ' 級（共 10 級，10 最富裕）'],
    ['兄弟姊妹', p.sibs ? p.sibs + ' 個' : '沒有，獨生'],
    ['爸媽', famLabel(p)]
  ].filter(([, v]) => v);
  $('birth-dl').innerHTML = rows.map(([k, v]) => '<div><dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd></div>').join('');
  const by = E.NOW - S.age, y0 = index.birthYears[0], early = by < y0, pct = births(S.iso, by);
  // 出生權重只有 y0 年以後的，更早出生的用 y0 年估算（抽國家也是）
  const odds = pct >= 1 ? '每 100 個有 ' + Math.round(pct) + ' 個' : pct >= 0.1 ? '每 100 個有 ' + pct.toFixed(1) + ' 個' : pct * 100 >= 1 ? '每 1 萬個有 ' + Math.round(pct * 100) + ' 個' : '每 1 萬個不到 1 個';
  $('birth-odds').textContent = (early ? '以 ' + y0 + ' 年出生的嬰兒估算：' : '跟你同一年出生的嬰兒，') + odds + '生在' + C.name + '。';
  // 跟你住的國家並排比（住的國家就是出生的國家時只列一欄）
  const H = S.H && S.H.iso !== C.iso ? S.H : null, cols = H ? [C, H] : [C];
  const per = iso => { const v = births(iso, by); return v >= 1 ? Math.round(v) + ' 個' : v >= 0.1 ? v.toFixed(1) + ' 個' : v >= 0.01 ? v.toFixed(2) + ' 個' : '不到 0.01 個'; };
  const cmpRows = [
    ['照現在的死亡率算，平均活到', X => Math.round(X.p.life_exp || 70) + ' 歲'],
    ['現在 25 歲以上有大學學歷', X => X.p.edu_tertiary != null ? Math.round(X.p.edu_tertiary) + '%' : '沒有資料'],
    ['每 100 個同年出生的嬰兒，生在這裡的', X => per(X.iso)]
  ];
  $('birth-cmp').innerHTML = '<table class="cmp-t"><thead><tr><th scope="col"><span class="sr-only">項目</span></th>' +
    cols.map((X, k) => '<th scope="col">' + esc(X.name) + '<small>' + (k ? '住的地方' : H ? '出生地' : '出生地，也是住的地方') + '</small></th>').join('') + '</tr></thead><tbody>' +
    cmpRows.map(([k, f]) => '<tr><th scope="row">' + esc(k) + '</th>' + cols.map(X => '<td>' + esc(f(X)) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
  $('birth-money').textContent = '之後畫面上的錢都「折台幣」：照' + C.name + '當地的物價，換成在台灣大約等於多少，不是匯率。';
  $('birth').hidden = false; $('b-skiproll').hidden = true;
  // 分享進來的第一局：說明這是朋友的一生（5 歲前走的局換一句，不先講結局細節）
  const sh = $('shared-note');
  const first = S.shared && S.games === 1;
  $('dv-note').hidden = !(first && S.dvOld);
  if (first) {
    // 5 歲前走的局：先試跑一份（5 歲前沒有抉擇，結果一定一樣）；界線跟分享文字一樣用 age < 5
    const T0 = newLife(S.C, S.age, S.seed); while (T0.p.alive && T0.p.age < 5) T0.step();
    sh.hidden = false; sh.textContent = shortLife(T0.p) ? '分享的這一生很短，孩子在幼年就走了。' : '這是朋友分享的出生。之後的抉擇換你選，結局可能跟朋友不一樣；看完可以抽你自己的。';
  } else sh.hidden = true;
  $('b-live').focus({ preventScroll: true });
  announce((sh.hidden ? '' : sh.textContent) + ($('dv-note').hidden ? '' : $('dv-note').textContent) + (E.NOW - S.age) + ' 年，你出生在' + C.name + (S.name ? '，名字是' + S.name : '') + '。' + $('birth-odds').textContent);
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
    S.lastYr.querySelector('ul').appendChild(el('li', kind, esc(say(e))));
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
  box.innerHTML = '<h3>' + esc(c.title) + '</h3><p class="desc">' + esc(S.soft && c.soft ? c.soft : c.desc) + '</p>' + (c.stat ? '<p class="stat">' + esc(c.stat) + '</p>' : '') +
    '<div class="opts">' + c.opts.map(o => '<button class="opt" data-k="' + esc(o.k) + '"><b>' + esc(o.label) + '</b>' + (o.hint ? '<span>' + esc(o.hint) + '</span>' : '') + '</button>').join('') + '</div>';
  box.hidden = false;
  announce('要做選擇了：' + c.title);
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
  return { age: p.age, year: p.year, cause: T.causes[p.cause] || '', end: last ? say(last) : '', peak: money(L, Math.max(peak, 0)), left: money(L, Math.max(p.savings, 0)),
    edu: EDU[p.edu] || '', job: jobFinal(p), fam: famNow(p), peakN: Math.max(peak, 0), leftN: Math.max(p.savings, 0) };
}
function end() {
  clearTimeout(S.timer);
  const p = S.L.p, s = summary(S.L, p.peak || 0), C = S.C;
  show('s-end');
  $('e-where').textContent = (S.name ? S.name + '，' : '') + (E.NOW - S.age) + ' 年生在' + C.name + (p.urban ? '城市' : '鄉下') + '的' + (p.sex === 'F' ? '女生' : '男生');
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
  $('e-h').setAttribute('tabindex', '-1'); $('e-h').focus({ preventScroll: true });
  announce('這一生結束了：' + s.end);
  // 2 分享框每局重來
  $('share-msg').textContent = ''; $('share-url').hidden = true; $('share-url').value = '';
}

// ---------- 4. 另一條路 ----------
const LUCK_RUNS = 50;   // 分岔時用幾種不同的個人運氣，兩條路各跑一次（配對比較）
// 回到第 i 個抉擇，改選 k；salt 是 null 時照原本的運氣往下跑，有數字時從那個抉擇起換一條個人運氣
function runPath(i, k, salt) {
  const pk = S.picks[i], prefer = {}, all = S.L.p.picks;
  all.forEach(x => { (prefer[x.id] = prefer[x.id] || []).push(x.k); });
  // 分岔的那一次換成新選項：它是這種抉擇的第幾次出現
  const at = all.findIndex(x => !x.auto && x.id === pk.id && x.year === pk.year && x.k === pk.k);
  if (at >= 0) prefer[pk.id][all.slice(0, at).filter(x => x.id === pk.id).length] = k; else prefer[pk.id] = [k];
  const L = newLife(S.C, S.age, S.seed, { prefer });
  let q = 0, out = L.step(), guard = 0;
  while (L.p.alive && guard++ < 600) {
    if (out && out.choice) {
      let kk;
      if (q < i) kk = S.picks[q].k; else { if (salt != null) L.reseed(salt); kk = k; L.setAuto(true); }
      if (!out.choice.opts.some(o => o.k === kk)) kk = out.choice.opts[0].k;
      q++; out = L.choose(kk); continue;
    }
    out = L.step();
  }
  return L;
}
const median = a => { const b = a.slice().sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
// 50 次裡兩條路逐項比：同一組運氣出發，A、B 各跑一遍，看每一項是不是這個選擇改變的（2026-11-15 用戶選的理念：只說改變了什麼，不判斷哪個比較好）
// 每一項三種判斷：same＝兩邊完全一樣；chg＝一面倒地偏高或偏低，而且差得夠多；none＝看不出是選擇造成的
function signTest(a, b) {   // 配對比較：B 比 A 高幾次、低幾次；差距大於 2.5×√（不一樣的次數）才算一面倒
  let w = 0, l = 0;
  a.forEach((x, k) => { if (b[k] > x) w++; else if (b[k] < x) l++; });
  return { w, l, same: w + l === 0, lopsided: w + l >= 5 && Math.abs(w - l) >= 2.5 * Math.sqrt(w + l) };
}
const GROUP = ['沒有工作', '主管', '專業人員', '技術員', '事務', '服務銷售', '農林漁', '技藝', '機械操作', '基層勞動'];
function luckStats(i, alt) {
  const pk = S.picks[i], A = [], B = [];
  for (let s = 0; s < LUCK_RUNS; s++) { A.push(runPath(i, pk.k, s)); B.push(runPath(i, alt.k, s)); }
  const f = (arr, fn) => arr.map(L => fn(L.p));
  const mean = a => a.length ? a.reduce((u, v) => u + v, 0) / a.length : 0;
  const q = (a, x) => { const b = a.slice().sort((u, v) => u - v); return b[Math.min(b.length - 1, Math.floor(b.length * x))]; };
  // 差得多又一面倒＝選擇改變的；差得多但這次高下次低＝時高時低（多半是運氣）；本來就沒差多少＝差不多
  const judge = (t, bigEnough) => t.same ? 'same' : !bigEnough ? 'none' : t.lopsided ? 'chg' : 'mixed';
  // 工作：分岔後各自擲骰，連換工作都會抽到不同職業，所以比兩邊「最後一份工作」職業大類的分布差多少（0～1；同選項換運氣時 99% 在 0.28 以下）
  const grp = p => p.job ? p.job.g || 0 : 0;
  const gA = f(A, grp), gB = f(B, grp);
  const dist = arr => { const c = {}; arr.forEach(g => { c[g] = (c[g] || 0) + 1 / arr.length; }); return c; };
  const dA = dist(gA), dB = dist(gB), keys = [...new Set([...Object.keys(dA), ...Object.keys(dB)])];
  const jobDiff = keys.reduce((t, g) => t + Math.abs((dA[g] || 0) - (dB[g] || 0)), 0) / 2;
  const top = gs => { const c = {}; gs.forEach(g => { c[g] = (c[g] || 0) + 1; }); return Object.entries(c).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([g, n]) => [GROUP[g], n]); };
  // 收入：最後一份工作的年收入；中位數差 10% 以上才算差得夠多
  const inc = [f(A, p => p.lastInc || 0), f(B, p => p.lastInc || 0)], mi = inc.map(v => median(v));
  // 失業：平均差 0.2 次以上；家庭：結婚比例差 10 個百分點或小孩差 0.3 個以上；壽命：中位數差 1 歲以上（老年時 1 年就是大差別）
  const loss = [f(A, p => p.jobLosses || 0), f(B, p => p.jobLosses || 0)];
  const mar = [f(A, p => p.married ? 1 : 0), f(B, p => p.married ? 1 : 0)], kid = [f(A, p => p.kids.length), f(B, p => p.kids.length)];
  const age = [f(A, p => p.age), f(B, p => p.age)];
  // 晚年存款用完：只算活到退休的人
  const ret = [A.filter(L => L.p.retired), B.filter(L => L.p.retired)];
  const broke = ret.map(arr => arr.map(L => L.p.flags.broke ? 1 : 0));
  const pairedBroke = [f(A, p => p.retired ? (p.flags.broke ? 1 : 0) : 0), f(B, p => p.retired ? (p.flags.broke ? 1 : 0) : 0)];
  const famJ = (() => { const t1 = signTest(mar[0], mar[1]), t2 = signTest(kid[0], kid[1]);
    if (t1.same && t2.same) return 'same';
    const big = Math.abs(mean(mar[0]) - mean(mar[1])) >= 0.1 || Math.abs(mean(kid[0]) - mean(kid[1])) >= 0.3;
    return (t1.lopsided && Math.abs(mean(mar[0]) - mean(mar[1])) >= 0.1) || (t2.lopsided && Math.abs(mean(kid[0]) - mean(kid[1])) >= 0.3) ? 'chg' : big ? 'mixed' : 'none'; })();
  const brokeJ = !ret[0].length && !ret[1].length ? 'noret' : judge(signTest(pairedBroke[0], pairedBroke[1]), Math.abs(mean(broke[0]) - mean(broke[1])) >= 0.1);
  return {
    L0: A[0],
    rows: [
      { k: '最後一份工作（看職業大類）', a: top(gA), b: top(gB), j: gA.every((g, k) => g === gB[k]) ? 'same' : jobDiff >= 0.35 ? 'chg' : 'none', kind: 'job' },
      { k: '最後一份工作的年收入（折台幣）', a: inc[0], b: inc[1], j: judge(signTest(inc[0], inc[1]), Math.abs(mi[1] - mi[0]) >= 0.1 * Math.max(mi[0], mi[1], 1)), kind: 'money', q },
      { k: '被裁員或失業', a: mean(loss[0]), b: mean(loss[1]), j: judge(signTest(loss[0], loss[1]), Math.abs(mean(loss[0]) - mean(loss[1])) >= 0.2), kind: 'times' },
      { k: '家庭（結婚、小孩）', a: [mean(mar[0]), mean(kid[0])], b: [mean(mar[1]), mean(kid[1])], j: famJ, kind: 'family' },
      { k: '活到幾歲', a: median(age[0]), b: median(age[1]), j: judge(signTest(age[0], age[1]), Math.abs(median(age[0]) - median(age[1])) >= 1), kind: 'age' },
      { k: '晚年存款用完（活到退休的人裡）', a: ret[0].length ? mean(broke[0]) : null, b: ret[1].length ? mean(broke[1]) : null, j: brokeJ, kind: 'pct' }
    ]
  };
}
function branch(i, alt) {
  const pk = S.picks[i];
  show('s-branch');
  $('br-where').textContent = '回到 ' + pk.age + ' 歲：' + pk.title;
  $('br-h').textContent = '如果當初選了「' + alt.label + '」';
  $('br-luck').innerHTML = '<p class="luck-main">計算中⋯</p>'; $('br-cmp').innerHTML = ''; $('br-diff').innerHTML = '';
  setTimeout(() => branchCalc(i, alt), 30);   // 101 局在手機上可能要半秒，先讓畫面換過來
}
function branchCalc(i, alt) {
  const pk = S.picks[i];
  // 兩欄用同一種跑法：都用你原本的運氣出發，選完之後系統代選（左欄不用你實際那一生，免得把你後來的選擇算成這個抉擇的差別）
  const LA = runPath(i, pk.k, null), L = runPath(i, alt.k, null);
  const a = summary(LA, LA.p.peak || 0), b = summary(L, L.p.peak || 0);
  // 運氣重抽 50 次，兩條路各走一遍：每一項一張小卡（判斷標籤＋原本／改選兩條橫條），說明收進「怎麼算的」（2026-11-15 用戶：文字太多，多用表格圖表）
  const r = luckStats(i, alt), n = LUCK_RUNS, L0 = r.L0;
  const pct = v => Math.round(v * 100) + '%';
  const JL = { chg: '選擇改變的', mixed: '時高時低', none: '差不多', same: '兩邊一樣', noret: '沒有人活到退休' };
  // 每一項：兩邊要畫的數值（橫條長度）和要寫的字
  const viz = x => {
    if (x.kind === 'job') {
      const s = v => [null, v.length ? v.map(([g, c]) => esc(g) + ' ' + pct(c / n)).join('、') : '—'];   // 不同類別的比例不能比長度，只寫字
      return [s(x.a), s(x.b)];
    }
    if (x.kind === 'money') { const ma = median(x.a), mb = median(x.b); return [[ma, esc(money(L0, ma))], [mb, esc(money(L0, mb))]]; }
    if (x.kind === 'times') return [[x.a, x.a.toFixed(1) + ' 次'], [x.b, x.b.toFixed(1) + ' 次']];
    if (x.kind === 'family') return [[x.a[0], '結婚 ' + pct(x.a[0]) + '・' + x.a[1].toFixed(1) + ' 個小孩'], [x.b[0], '結婚 ' + pct(x.b[0]) + '・' + x.b[1].toFixed(1) + ' 個小孩']];
    if (x.kind === 'age') return [[x.a, x.a + ' 歲'], [x.b, x.b + ' 歲']];
    return [[x.a || 0, x.a == null ? '—' : pct(x.a)], [x.b || 0, x.b == null ? '—' : pct(x.b)]];
  };
  const title = { job: '最常做的工作', money: '最後一份工作的年收入', times: '被裁員或失業（平均）', family: '家庭', age: '活到幾歲（中位數）', pct: '晚年存款用完' };
  const cards = r.rows.map(x => {
    const [[va, ta], [vb, tb]] = viz(x), mx = Math.max(va || 0, vb || 0) || 1;
    const bar = (cls, lab, v, t) => v == null ? '<div class="lk-bar nobar ' + cls + '"><span class="lk-lab">' + lab + '</span><span class="lk-val">' + t + '</span></div>'
      : '<div class="lk-bar ' + cls + '"><span class="lk-lab">' + lab + '</span><span class="lk-track"><i style="width:' + Math.max(2, Math.round(v / mx * 100)) + '%"></i></span><span class="lk-val">' + t + '</span></div>';
    return '<div class="lk-card ' + x.j + '"><div class="lk-h"><span>' + title[x.kind] + '</span><em>' + JL[x.j] + '</em></div>' +
      bar('a', '原本', va, ta) + bar('b', '改選', vb, tb) + '</div>';
  }).join('');
  const changed = r.rows.filter(x => x.j === 'chg').map(x => title[x.kind].replace(/（.*）/, ''));
  const verdict = changed.length ? '這個選擇改變的是：' + changed.join('、') : '看不出這個選擇改變了什麼';
  const rng = x => esc(money(L0, x.q(x.a, 0.1))) + '～' + esc(money(L0, x.q(x.a, 0.9))) + '（原本）、' + esc(money(L0, x.q(x.b, 0.1))) + '～' + esc(money(L0, x.q(x.b, 0.9))) + '（改選）';
  const inc = r.rows.find(x => x.kind === 'money');
  $('br-luck').innerHTML = '<h3>運氣重抽 ' + n + ' 次，兩條路各走一遍</h3>' +
    '<p class="lk-legend"><span class="a">原本「' + esc(pk.label) + '」</span><span class="b">改選「' + esc(alt.label) + '」</span></p>' +
    '<p class="luck-main">' + esc(verdict) + '</p>' +
    '<div class="lk-grid">' + cards + '</div>' +
    '<p class="luck-cta"><a class="link" href="' + beginLink() + '">現實裡卡住的事也一樣：先分清楚哪些靠選擇、哪些看運氣。寫下來，免費幫你整理</a></p>' +
    '<details class="lk-more"><summary>怎麼算的</summary>' +
    '<p class="luck-note">每一次，兩條路從同一組運氣出發；你選的那一刻之後，抉擇都交給系統。改選之後，某一項差得多而且一面倒地偏高或偏低，才標「選擇改變的」；差得多但這次高、下次低，標「時高時低」，多半是運氣；本來就沒差多少標「差不多」；50 次完全一樣標「兩邊一樣」。這裡只看這個選擇改變了什麼，不判斷哪個比較好：那要看你最在乎的是什麼。這是示意，不是預測。壽命照生命表校準過：平均活到幾歲、5 歲前和 60 歲前走的比例、15／40／65 歲的平均餘命，都跟生命表很接近（數字在資料來源頁）。</p>' +
    '<p class="luck-note">收入是中位數（折台幣）；十次裡有八次落在 ' + rng(inc) + '。工作是最後一份工作的職業大類。晚年存款用完只算活到退休的人。</p></details>';
  // 下面兩欄不標哪邊比較好（2026-11-15 複審：跟「不判斷哪個比較好」矛盾）
  // 選擇帶出來的差異放上面；壽命和怎麼走的含運氣，分開放下面並標出來
  const col = (s, other, cls, head) => '<div class="' + cls + '"><h4>' + head + '</h4><dl>' +
    '<dt>學歷・工作</dt><dd>' + esc(s.age < 18 ? '還沒成年' : s.edu + '・' + s.job) + '</dd>' +
    '<dt>家庭</dt><dd>' + esc(s.fam) + '</dd>' +
    '<dt>存款最多（折台幣）</dt><dd>' + esc(s.peak) + '</dd>' +
    '<dt>留下的錢（折台幣）</dt><dd>' + esc(s.left) + '</dd>' +
    '</dl><dl class="luck"><dt>活到（這一次）</dt><dd>' + s.age + ' 歲</dd>' +
    '<dt>怎麼走的（這一次）</dt><dd>' + esc(s.end) + '</dd></dl></div>';
  $('br-cmp').innerHTML = col(a, b, 'me', '原本的選擇<b>「' + esc(pk.label) + '」</b><small>之後的抉擇系統代選</small>') + col(b, a, 'alt', '改選<b>「' + esc(alt.label) + '」</b><small>之後的抉擇系統代選</small>');
  const evs = (LL, from) => LL.p.log.filter(e => e.age >= from && e.kind !== 'news' && e.kind !== 'note' && e.kind !== 'pick');
  const key = e => e.age + '|' + e.text;
  const ma = evs(LA, pk.age), mb = evs(L, pk.age), sa = new Set(ma.map(key)), sb = new Set(mb.map(key));
  const list = arr => '<ul>' + (arr.length ? arr.slice(0, 10).map(e => '<li><b>' + e.age + ' 歲</b>' + esc(say(e)) + '</li>').join('') : '<li>沒有不一樣的事</li>') + '</ul>';
  $('br-diff').innerHTML = '<div><h4>只在原本的選擇發生</h4>' + list(ma.filter(e => !sb.has(key(e)))) + '</div><div class="alt"><h4>只在另一條發生</h4>' + list(mb.filter(e => !sa.has(key(e)))) + '</div>';
  announce('另一條路：如果當初選了「' + alt.label + '」。' + verdict);
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
$('b-skiproll').onclick = () => { S.skipRoll = true; };
// 分享的那句話（文字、圖卡共用）：5 歲前走的局不寫年齡和死因，也不接「你會生在哪裡？」
function shareText(born) {
  const nm = S.name ? '，叫' + S.name : '';
  return shortLife(S.L.p) ? born + nm + '，這一生很短。' : born + nm + '。' + say(S.L.p.log[S.L.p.log.length - 1]) + '你會生在哪裡？';
}
// 分享：連結帶年紀、種子和資料版本，朋友點開會生成同一個人；手機叫系統分享選單，電腦複製連結
function shareUrl() {
  const u = new URL(location.pathname, location.origin);
  u.searchParams.set('age', S.age); u.searchParams.set('seed', S.seed); u.searchParams.set('dv', SHARE_V()); u.searchParams.set('from', 'share');
  return u.href;
}
$('b-share').onclick = () => {
  const url = shareUrl(), born = (E.NOW - S.age) + ' 年，我出生在' + S.C.name;
  const text = shareText(born);
  const btn = $('b-share'), box = $('share-url');
  const ok = () => { btn.textContent = '已複製'; announce('連結已經複製，貼給朋友就好。'); $('share-msg').textContent = '連結已經複製，貼給朋友就好。'; box.hidden = true; setTimeout(() => { btn.textContent = '分享這一生'; }, 2500); };
  const manual = () => { box.hidden = false; box.value = url; box.focus(); box.select(); $('share-msg').textContent = '沒辦法自動複製，網址在下面，長按或 Ctrl+C 複製。'; announce('沒辦法自動複製，網址在下面。'); };
  // 系統分享選單只在觸控裝置用；電腦一律複製。分享失敗（不是使用者自己取消）就退到手動網址框
  if (navigator.share && matchMedia('(pointer: coarse)').matches) navigator.share({ title: '再活一次', text, url }).catch(e => { if (!e || e.name !== 'AbortError') manual(); });
  else if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text + ' ' + url).then(ok, manual);
  else manual();
};

// 分享圖卡（2026-11-15）：直式 1080×1350。手機能帶圖就叫系統分享，不然存成檔案
function wrapLines(g, s, maxW, maxN) {
  const out = []; let cur = '';
  for (const ch of s) { if (g.measureText(cur + ch).width > maxW && cur) { out.push(cur); cur = ch.trim() ? ch : ''; } else cur += ch; }
  if (cur) out.push(cur);
  if (out.length > maxN) { out.length = maxN; out[maxN - 1] = out[maxN - 1].slice(0, -1) + '⋯'; }
  return out;
}
function cardBlob() {
  const W = 1080, H = 1350, X = 96, MW = W - 2 * X, p = S.L.p, born = E.NOW - S.age, short = shortLife(p);
  const serif = '"Noto Serif TC", serif', sans = '"Noto Sans TC", sans-serif';
  const end = short ? '這一生很短。' : say(p.log[p.log.length - 1]).replace(new RegExp('^' + p.age + ' 歲，'), '').replace(/^這一生在 \d+ 歲結束了。$/, '這一生結束了。');
  const all = '再活一次年我出生在名字活到歲你會生在哪裡？' + born + S.C.name + S.name + end + p.age + location.host;
  // 字型是網頁字型，先載入這張圖會用到的字；載不到就用系統字（最多等 2.5 秒）
  const fonts = document.fonts ? Promise.race([Promise.all(['700 64px ' + serif, '500 40px ' + sans, '400 32px ' + sans].map(f => document.fonts.load(f, all))), new Promise(r => setTimeout(r, 2500))]).catch(() => {}) : Promise.resolve();
  return fonts.then(() => new Promise((res, rej) => {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const g = cv.getContext('2d'); g.textBaseline = 'alphabetic';
    g.fillStyle = '#FBF8F3'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#6E1A34'; g.fillRect(0, 0, W, 20);
    g.fillStyle = '#6B5A5F'; g.font = '500 38px ' + sans; g.fillText('再活一次', X, 150);
    g.fillStyle = '#2B2125'; g.font = '700 64px ' + serif; g.fillText(born + ' 年，我出生在', X, 300);
    let fs = 128; g.font = '700 ' + fs + 'px ' + serif; while (g.measureText(S.C.name).width > MW && fs > 60) { fs -= 8; g.font = '700 ' + fs + 'px ' + serif; }
    g.fillStyle = '#6E1A34'; g.fillText(S.C.name, X, 450);
    let y = 540;
    if (S.name) { g.fillStyle = '#6B5A5F'; g.font = '500 40px ' + sans; g.fillText('名字：' + S.name, X, y); y += 40; }
    g.fillStyle = '#E2C27A'; g.fillRect(X, y + 40, 120, 8); y += 150;
    g.fillStyle = '#2B2125';
    if (!short) { g.font = '700 96px ' + serif; g.fillText('活到 ' + p.age + ' 歲', X, y); y += 90; }
    g.font = '500 44px ' + sans;
    wrapLines(g, end, MW, 4).forEach(l => { g.fillText(l, X, y); y += 66; });
    g.fillStyle = '#E8DED6'; g.fillRect(X, 1120, MW, 2);
    g.fillStyle = '#2B2125'; g.font = '700 52px ' + serif; g.fillText('你會生在哪裡？', X, 1210);
    g.fillStyle = '#6B5A5F'; g.font = '400 32px ' + sans; g.fillText((location.host + location.pathname).replace(/index\.html$/, '').replace(/\/$/, ''), X, 1268);
    cv.toBlob(b => b ? res(b) : rej(new Error('toBlob')), 'image/png');
  }));
}
$('b-img').onclick = () => {
  const btn = $('b-img'), msg = t => { $('share-msg').textContent = t; announce(t); };
  const save = blob => { const a = document.createElement('a'), u = URL.createObjectURL(blob); a.href = u; a.download = '再活一次.png'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); msg('圖片存好了，在下載的資料夾。'); };
  btn.disabled = true;
  cardBlob().then(blob => {
    const f = typeof File === 'function' ? new File([blob], '再活一次.png', { type: 'image/png' }) : null;
    const born = (E.NOW - S.age) + ' 年，我出生在' + S.C.name;
    if (f && navigator.canShare && matchMedia('(pointer: coarse)').matches && navigator.canShare({ files: [f] }))
      return navigator.share({ files: [f], text: shareText(born) + ' ' + shareUrl() }).catch(e => { if (!e || e.name !== 'AbortError') save(blob); });
    save(blob);
  }).catch(() => msg('圖片做不出來，可以改用「分享這一生」傳連結。')).then(() => { btn.disabled = false; });
};

$('home').onchange = () => pref.set('home', $('home').value);
$('soft').onchange = () => { pref.set('soft', $('soft').checked ? '1' : '0'); };
// 住的國家：照中文名排，預設台灣，上次選的記在瀏覽器
function fillHome() {
  const sel = $('home'), h = pref.get('home', 'TWN');
  const cs = index.countries.slice().sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant-TW'));
  sel.innerHTML = cs.map(c => '<option value="' + esc(c.iso) + '">' + esc(c.name) + '</option>').join('');
  sel.value = cs.some(c => c.iso === h) ? h : 'TWN';
  $('soft').checked = pref.get('soft', '0') === '1';
}

document.querySelectorAll('a[data-begin]').forEach(a => { a.href = beginLink(); });

boot().then(() => {
  // ?age= 從首頁帶過來；?seed= 指定同一個人生。不合格的值一律不理，留在開始的表單
  fillHome();
  const q = E.parseQuery(location.search);
  const dv = new URLSearchParams(location.search).get('dv');
  // 從分享連結打開：出生卡上方說這是朋友的一生；網站更新過要提示
  const shared = !!(q && q.seed != null && (dv || FROM === 'share'));
  if (q) { $('age').value = q.age; start(q.age, q.seed, shared); S.dvOld = !!(shared && dv && dv !== SHARE_V()); }
}).catch(fail);
})();
