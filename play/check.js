// 隨機投胎的自我檢查：node check.js [局數]
// 看：會不會報錯、缺不缺句子、壽命和國家分布對不對得上資料、每局停下來幾次、同一個種子重跑一不一樣，
// 加上 2026-11-14 嚴審第 5 條：真實國名、V-Dem 數值、網址參數、年份邊界、FIELDS.json 欄位比對。
// 結束代碼 0＝全過。
const fs = require('fs'), path = require('path');
const E = require('./engine.js'), T = require('./text.js');
const N = +(process.argv[2] || 1000);
const dir = path.join(__dirname, 'data');
const rd = f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const D0 = { rules: rd('rules.json'), vdem: rd('vdem.json') };
const index = rd('index.json');
E.config(index);
const cache = {}; const load = iso => cache[iso] || (cache[iso] = rd('c/' + iso + '.json'));
const fails = [];   // 任何一條進來，結束代碼就是 1
const fail = s => fails.push(s);

// 缺句子：fmt 拿到不認得的英文 key 會回空字串。抉擇的 stat 是函式，故意回空字串（例如男生的結婚卡）不算缺
const missing = new Set(), origFmt = T.fmt;
T.fmt = (k, v) => { const s = origFmt(k, v); if (typeof k !== 'function' && !s && !/^[一-鿿]/.test(k)) missing.add(k); if (/\{\w+\}|undefined|NaN/.test(s)) missing.add(String(k).slice(0, 30) + ' → ' + s); return s; };

// 互動模式：抉擇照 chooser 選；回傳整局
function play(seed, age, chooser, extra) {
  const r = E.rng(seed ^ 0xC0FFEE), iso = E.pickCountry(index, E.NOW - age, r);
  const L = E.Life(Object.assign({}, D0), load(iso), Object.assign({ age, seed }, extra || {}));
  let asked = 0, guard = 0, out = L.step();
  while (L.p.alive && guard++ < 500) {
    if (out && out.choice) { asked++; L.p.log.push({ age: L.p.age, year: L.p.year, kind: 'card', text: out.choice.desc + ' ' + out.choice.stat }); const ch = chooser(out.choice, L); out = L.choose(ch); continue; }
    out = L.step();
  }
  return { L, iso, asked };
}
// 照引擎同一張生命表、同樣的年份算「這個人照生命表平均活幾歲」（不含健康係數和抉擇），用來校壽命
function cohortE0(C, birthYear, sex) {
  let l = 1, e = 0;
  for (let a = 0; a <= 110 && l > 1e-6; a++) { const q = Math.min(1, E.qx(C, birthYear + a, a, sex)); e += l * (1 - q / 2); l *= 1 - q; }
  return e;
}
const yIdx = by => Math.max(0, Math.min(index.countries[0].b.length - 1, by - index.birthYears[0]));
const totW = by => index.countries.reduce((s, c) => s + (c.b[yIdx(by)] || 0), 0);
const otherNames = iso => index.countries.filter(c => c.iso !== iso).map(c => c.name);
const ALL_NAMES = index.countries.map(c => ({ iso: c.iso, name: c.name }));

// ---------- 1000 局 ----------
const errs = [], picks = {}, askedHist = {}, byIso = {}, uni = {};
let sumAsked = 0, under5 = 0, hmS = 0, hmN = 0, foreignName = [];
for (let i = 0; i < N; i++) {
  const seed = 1000 + i * 7919, age = [10, 20, 25, 30, 35, 40][i % 6];
  try {
    const { L, iso, asked } = play(seed, age, c => { const k = c.opts[(seed >> 3) % c.opts.length].k; (picks[c.id] = picks[c.id] || {})[k] = (picks[c.id][k] || 0) + 1; return k; });
    const p = L.p, C = load(iso), by = E.NOW - age;
    const b = byIso[iso] = byIso[iso] || { n: 0, age: 0, exp: 0, w: 0, name: C.name };
    b.n++; b.age += p.age; b.exp += cohortE0(C, by, p.sex);
    sumAsked += asked; askedHist[asked] = (askedHist[asked] || 0) + 1;
    if (p.age < 5) under5++;
    hmS += p.hmSum || 0; hmN += p.hmN || 0;
    if (p.alive) errs.push(`${iso} seed ${seed} 沒死`);
    if (!Number.isFinite(p.savings)) errs.push(`${iso} seed ${seed} 存款不是數字`);
    // 真實國名：句子裡只准出現自己的國名（國家間戰爭的對手用代稱）
    // 先拿掉自己的國名（南蘇丹裡有蘇丹、幾內亞比索裡有幾內亞），再找別國的
    for (const e of p.log) { const t = e.text.split(C.name).join(''); for (const c of ALL_NAMES) if (c.iso !== iso && t.includes(c.name)) { foreignName.push(`${C.name} ${e.age} 歲：${e.text}`); break; } }
    // 考上大學的比例（模擬出來的）
    const pk = p.picks.find(x => x.id === 'after18' && x.k === 'uni');
    if (pk) { const u = uni[iso] = uni[iso] || { n: 0, in: 0, name: C.name, rate: C.p.edu_tertiary }; u.n++; if (p.log.some(e => e.text === T.fmt('uniIn', { who: p, c: C }))) u.in++; }
  } catch (e) { errs.push(`seed ${seed}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
}
// 抽樣的期望值：每一局用自己出生年的權重
for (let i = 0; i < N; i++) {
  const age = [10, 20, 25, 30, 35, 40][i % 6], by = E.NOW - age, t = totW(by);
  for (const c of index.countries) { const w = (c.b[yIdx(by)] || 0) / t; if (!w) continue; (byIso[c.iso] = byIso[c.iso] || { n: 0, age: 0, exp: 0, w: 0, name: c.name }).w += w; }
}
if (errs.length) fail(`報錯／異常 ${errs.length} 條：` + errs.slice(0, 5).join('；'));
if (missing.size) fail(`缺的句子 ${missing.size} 條：` + [...missing].slice(0, 10).join('、'));
if (foreignName.length) fail(`句子裡出現別國國名 ${foreignName.length} 條：` + foreignName.slice(0, 5).join('；'));

// ---------- 程式裡不准引用 V-Dem 數值、不准把 V-Dem 放到畫面 ----------
// ui.js 只准在載入資料那一行碰到 vdem（交給引擎），其他地方都不准
for (const f of ['text.js', 'ui.js']) { const src = fs.readFileSync(path.join(__dirname, f), 'utf8').split(/\r?\n/).filter(l => !(f === 'ui.js' && l.includes("j('data/vdem.json')"))).join(' '); if (/vdem|regime/i.test(src)) fail(`${f} 引用了 V-Dem（vdem/regime）`); }

// ---------- 網址參數 ----------
const bad = ['', '?age=abc', '?age=-1', '?age=99999', '?age=30.5', '?age=%3Cscript%3E', '?age=30&seed=99999999999', '?age=30&seed=-5', '?age=30&seed=1e5', '?age=91', '?seed=15'];
const good = [['?age=0', 0, null], ['?age=90', 90, null], ['?age=30&seed=15', 30, 15], ['?age=30&seed=4294967295', 30, 4294967295]];
for (const q of bad) if (E.parseQuery(q) !== null) fail(`parseQuery 應該擋下：${q}`);
for (const [q, a, s] of good) { const r = E.parseQuery(q); if (!r || r.age !== a || r.seed !== s) fail(`parseQuery 應該通過：${q} → ${JSON.stringify(r)}`); }

// ---------- 年份邊界 ----------
function edge(label, ages, n) {
  for (let i = 0; i < n; i++) for (const age of ages) {
    try { const { L } = play(777 + i * 31, age, c => c.opts[0].k); if (L.p.alive) fail(`${label} ${age} 歲 seed ${777 + i * 31} 沒死`); }
    catch (e) { fail(`${label} ${age} 歲：${e.message}`); }
  }
}
edge('邊界', [0, E.MAX_AGE], 50);
E.config({ birthYears: [index.birthYears[0], index.birthYears[1] + 1], histYears: index.histYears });   // 資料包比引擎預設新一年（NOW 取資料包的最後一年，不看電腦時鐘）
edge('資料新一年', [0, 30, E.MAX_AGE], 30);
E.config(index);

// ---------- FIELDS.json：白名單從它產生，data/ 實際的欄位多出沒登記的就失敗 ----------
const F = rd('FIELDS.json');
const allowed = file => Object.keys(F[file] || {});
const keysOk = (obj, file, prefix, where) => Object.keys(obj).forEach(k => { if (!allowed(file).includes(prefix + k)) fail(`${where} 有沒登記的欄位 ${prefix + k}`); });
for (const file of ['index.json', 'rules.json', 'vdem.json', 'c/<ISO>.json']) {
  if (!F[file]) fail('FIELDS.json 少了 ' + file);
  else Object.entries(F[file]).forEach(([k, v]) => { if (!v || !v['來源'] || !v['授權'] || typeof v['逐年'] !== 'boolean' || v['公開'] !== true) fail(`FIELDS.json ${file} ${k} 少了來源／授權／逐年／公開`); });
}
keysOk(index, 'index.json', '', 'index.json');
index.countries.forEach(c => keysOk(c, 'index.json', 'countries.', 'index.json'));
keysOk(rd('rules.json'), 'rules.json', '', 'rules.json');
keysOk(D0.vdem, 'vdem.json', '', 'vdem.json');
for (const f of fs.readdirSync(path.join(dir, 'c'))) {
  const c = rd('c/' + f), W = 'c/<ISO>.json';
  keysOk(c, W, '', 'c/' + f);
  keysOk(c.start, W, 'start.', 'c/' + f);
  keysOk(c.haz, W, 'haz.', 'c/' + f);
  keysOk(c.p, W, 'p.', 'c/' + f);
  if (c.start.lvl != null && String(Math.round(c.start.lvl)).replace(/0+$/, '').length > 2) fail(`c/${f} start.lvl 不是 2 位有效數字：${c.start.lvl}`);
  for (const [y, h] of Object.entries(c.hist)) {
    keysOk(h, W, 'hist.', 'c/' + f + ' ' + y);
    if (h.l != null && String(h.l).replace(/0+$/, '').length > 2) fail(`c/${f} hist ${y} 的 l 不是 2 位有效數字：${h.l}`);
    if (h.b != null && !(Number.isInteger(h.b) && h.b >= 0 && h.b <= 5)) fail(`c/${f} hist ${y} 的 b 不是 0～5：${h.b}`);
  }
}

// ---------- 重跑：同種子同選擇要一模一樣；分岔後國家大事要一樣 ----------
let replayBad = 0, branchWorldBad = 0;
for (let j = 0; j < 30; j++) {
  const seed = 50000 + j * 104729, age = 25;
  const a = play(seed, age, c => c.opts[c.opts.length - 1].k);
  const seq = a.L.p.picks.filter(x => !x.auto).map(x => x.k); let q = 0;
  const b = play(seed, age, () => seq[q++]);
  if (JSON.stringify(a.L.p.log) !== JSON.stringify(b.L.p.log)) replayBad++;
  if (seq.length) {
    let first = true;
    const c = play(seed, age, ch => { if (first) { first = false; return ch.opts.find(o => o.k !== seq[0]).k; } return ch.opts[0].k; });
    const news = L => L.p.log.filter(x => x.kind === 'news').map(x => x.year + x.text);
    const until = Math.min(a.L.p.year, c.L.p.year), cut = arr => arr.filter(s => +s.slice(0, 4) <= until);
    if (JSON.stringify(cut(news(a.L))) !== JSON.stringify(cut(news(c.L)))) branchWorldBad++;
  }
}
if (replayBad) fail(`同種子同選擇重跑不一樣 ${replayBad}／30`);
if (branchWorldBad) fail(`分岔後國家大事不一樣 ${branchWorldBad}／30`);

// ---------- 報表 ----------
const rows = Object.entries(byIso);
const totN = rows.reduce((s, [, b]) => s + b.n, 0), totAge = rows.reduce((s, [, b]) => s + b.age, 0), totExp = rows.reduce((s, [, b]) => s + b.exp, 0);
console.log(`跑了 ${N} 局；5 歲前走的 ${(under5 / N * 100).toFixed(1)}%；健康係數平均 ${(hmS / hmN).toFixed(3)}（1 表示跟生命表一樣）`);
console.log(`壽命：平均活到 ${(totAge / totN).toFixed(1)} 歲；照同國、同出生年、同性別的生命表應該是 ${(totExp / totN).toFixed(1)} 歲`);
console.log('  差最多的 10 國（至少 8 局）：' + rows.filter(([, b]) => b.n >= 8).map(([, b]) => [b.name, b.age / b.n - b.exp / b.n, b.n]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 10).map(([nm, d, n]) => `${nm} ${d > 0 ? '+' : ''}${d.toFixed(1)}（${n} 局）`).join('、'));
console.log('抽樣：差最多的 10 國（實際局數／每局用自己出生年權重的期望）：' + rows.map(([, b]) => [b.name, b.n, b.w]).sort((x, y) => Math.abs(y[1] - y[2]) - Math.abs(x[1] - x[2])).slice(0, 10).map(([nm, a, w]) => `${nm} ${a}/${w.toFixed(1)}`).join('、'));
console.log(`每局停下來問 ${(sumAsked / N).toFixed(1)} 次；分布 ${Object.entries(askedHist).sort((a, b) => a[0] - b[0]).map(([k, v]) => k + ':' + v).join(' ')}`);
console.log('各抉擇出現次數：' + Object.entries(picks).map(([k, v]) => k + ' ' + Object.values(v).reduce((a, b) => a + b, 0)).join('、'));
console.log('選了考大學的人，模擬考上的比例（25 歲以上大學學歷比例 × ' + T.UNI_SCALE + ' 再調整）：' + Object.values(uni).filter(u => u.n >= 5).sort((a, b) => b.n - a.n).slice(0, 8).map(u => `${u.name} ${u.in}/${u.n}（資料 ${Math.round(u.rate)}%）`).join('、'));
console.log(`重跑一致 ${30 - replayBad}／30；分岔後國家大事一致 ${30 - branchWorldBad}／30`);
console.log(fails.length ? `\n沒過 ${fails.length} 條：\n  ` + fails.slice(0, 30).join('\n  ') : '\n全部通過');
process.exit(fails.length ? 1 : 0);
