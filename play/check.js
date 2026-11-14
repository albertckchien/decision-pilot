// 隨機投胎的自我檢查：node check.js [局數]
// 看：會不會報錯、缺不缺句子、壽命和國家分布對不對得上資料、每局停下來幾次、同一個種子重跑一不一樣，
// 加上 2026-11-14 嚴審第 5 條：真實國名、V-Dem 數值、網址參數、年份邊界、FIELDS.json 欄位比對。
// 結束代碼 0＝全過。
const fs = require('fs'), path = require('path');
const E = require('./engine.js'), T = require('./text.js');
const MODE = process.argv[2];   // calibrate＝重校 MORT_K；snapshot＝更新結局快照；數字＝局數
const N = /^\d+$/.test(MODE || '') ? +MODE : 1000;
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
// out 另外帶回：5 歲前、60 歲前走的機率，和 15／40／65 歲還活著時的平均餘命（照同一張表）
function cohortE0(C, birthYear, sex, out) {
  let l = 1, e = 0; const L = [1];
  for (let a = 0; a <= 110 && l > 1e-6; a++) { const q = Math.min(1, E.qx(C, birthYear + a, a, sex)); e += l * (1 - q / 2); l *= 1 - q; L[a + 1] = l; if (a === 4 && out) out.u5 = 1 - l; if (a === 59 && out) out.u60 = 1 - l; }
  if (out) for (const x of [15, 40, 65]) { let s = 0; for (let a = x; a < L.length - 1; a++) s += (L[a] + L[a + 1]) / 2; out['e' + x] = L[x] ? s / L[x] : 0; out['l' + x] = L[x] || 0; }
  return e;
}
const yIdx = by => Math.max(0, Math.min(index.countries[0].b.length - 1, by - index.birthYears[0]));
const totW = by => index.countries.reduce((s, c) => s + (c.b[yIdx(by)] || 0), 0);
const otherNames = iso => index.countries.filter(c => c.iso !== iso).map(c => c.name);
const ALL_NAMES = index.countries.map(c => ({ iso: c.iso, name: c.name }));

// ---------- 重校死亡率：node check.js calibrate ----------
if (MODE === 'calibrate') {
  const cur = E.MORT_K;
  for (const k of [0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9, 1]) {
    E.setMortK(k); let a = 0, e = 0;
    for (let i = 0; i < 3000; i++) {
      const seed = 1000 + i * 7919, age = [10, 20, 25, 30, 35, 40][i % 6], r = E.rng(seed ^ 0xC0FFEE), iso = E.pickCountry(index, E.NOW - age, r), C = load(iso);
      const L = E.Life(Object.assign({}, D0), C, { age, seed, auto: true }); while (L.p.alive) L.step();
      a += L.p.age; e += cohortE0(C, E.NOW - age, L.p.sex);
    }
    console.log(`MORT_K ${k}：遊戲平均 ${(a / 3000).toFixed(2)} 歲，生命表 ${(e / 3000).toFixed(2)} 歲，差 ${((a - e) / 3000).toFixed(2)}`);
  }
  console.log(`現在用的是 ${cur}。挑差最接近 0 的填回 engine.js 的 MORT_K，升 ENGINE_V，再跑 node check.js snapshot 和 node check.js 1000。`);
  process.exit(0);
}

// ---------- 結局快照：同一個年紀＋種子的結局變了，ENGINE_V 一定要升（分享連結靠它） ----------
const SNAP = path.join(__dirname, 'snapshots.json');
// 資料版本：ui.js 的 DATA_V；資料雜湊：data/ 所有 json 的內容（資料變了但 DATA_V 沒升，靠它抓）
const DATA_V = (fs.readFileSync(path.join(__dirname, 'ui.js'), 'utf8').match(/const DATA_V = '([^']+)'/) || [])[1];
const dataHash = (() => { const h = require('crypto').createHash('sha1'); const walk = d => fs.readdirSync(d).sort().forEach(f => { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (f.endsWith('.json')) h.update(f).update(fs.readFileSync(p)); }); walk(dir); return h.digest('hex').slice(0, 12); })();
const snapNow = () => [[30, 15], [30, 1], [30, 3], [0, 42], [25, 7], [40, 99], [10, 2024], [90, 5]].map(([age, seed]) => {
  const L = E.Life(Object.assign({}, D0), load(E.pickCountry(index, E.NOW - age, E.rng(seed ^ 0xC0FFEE))), { age, seed, auto: true });
  while (L.p.alive) L.step();
  return { age, seed, iso: L.C.iso, end: L.p.age, last: L.p.log[L.p.log.length - 1].text, saved: Math.round(L.p.savings) };
});
if (MODE === 'snapshot') { fs.writeFileSync(SNAP, JSON.stringify({ engine: E.ENGINE_V, dataV: DATA_V, dataHash, lives: snapNow() }, null, 1)); console.log('快照已更新（' + E.ENGINE_V + '、' + DATA_V + '、' + dataHash + '）'); process.exit(0); }
{
  let old = null; try { old = JSON.parse(fs.readFileSync(SNAP, 'utf8')); } catch (e) { fail('沒有 snapshots.json，先跑 node check.js snapshot'); }
  if (old) {
    const now = JSON.stringify(snapNow()), was = JSON.stringify(old.lives);
    // 資料變了但 DATA_V 沒升 → 升 DATA_V；資料和 DATA_V 都沒變、結局卻變了 → 是引擎改了，升 ENGINE_V
    if (old.dataHash !== dataHash && old.dataV === DATA_V) fail(`data/ 的內容變了，但 ui.js 的 DATA_V 還是 ${DATA_V}：升 DATA_V，再跑 node check.js snapshot`);
    else if (old.dataHash === dataHash && old.engine === E.ENGINE_V && now !== was) fail(`資料沒變、同一個年紀＋種子的結局卻變了，ENGINE_V 還是 ${E.ENGINE_V}：升 engine.js 的 ENGINE_V，再跑 node check.js snapshot`);
    else if (old.engine !== E.ENGINE_V || old.dataV !== DATA_V) fail(`版本換了（${E.ENGINE_V}、${DATA_V}），快照還是舊的（${old.engine}、${old.dataV}）：跑 node check.js snapshot 更新`);
  }
}

// ---------- 可重現：同一個選項、同一個 salt 跑兩次要一模一樣（只檢查可重現，不代表兩條路的骰子對齊；選不同選項後各自擲骰） ----------
{
  let bad = 0;
  for (let s = 0; s < 20; s++) {
    const run = () => { const L = E.Life(Object.assign({}, D0), load('CHN'), { age: 30, seed: 15 }); let o = L.step(); while (L.p.alive) { if (o && o.choice) { L.reseed(s); L.setAuto(true); o = L.choose(o.choice.opts[0].k); continue; } o = L.step(); } return JSON.stringify(L.p.log); };
    if (run() !== run()) bad++;
  }
  if (bad) fail(`同一個選項、同一個 salt 重跑不一樣 ${bad}／20`);
}

// ---------- 1000 局 ----------
const errs = [], picks = {}, askedHist = {}, byIso = {}, uni = {};
const lifeDiffs = [];
const dist = { u60: 0, u60e: 0, t15: 0, t40: 0, t65: 0, w15: 0, w40: 0, w65: 0, s15: 0, s40: 0, s65: 0, n15: 0, n40: 0, n65: 0 };
let u5exp = 0, sumAsked = 0, under5 = 0, hmS = 0, hmN = 0, foreignName = [];
for (let i = 0; i < N; i++) {
  const seed = 1000 + i * 7919, age = [10, 20, 25, 30, 35, 40][i % 6];
  try {
    const { L, iso, asked } = play(seed, age, c => { const k = c.opts[(seed >> 3) % c.opts.length].k; (picks[c.id] = picks[c.id] || {})[k] = (picks[c.id][k] || 0) + 1; return k; });
    const p = L.p, C = load(iso), by = E.NOW - age;
    sumAsked += asked; askedHist[asked] = (askedHist[asked] || 0) + 1;
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
// 壽命和國家抽樣：另外跑一組系統代選的局（跟 calibrate 同一套跑法）。上面那組為了測到每種選項會故意輪流選，
// 包括比較不利的選法（保守治療、戰火中留下），壽命會系統性偏短，不拿來校準
for (let i = 0; i < N; i++) {
  const seed = 1000 + i * 7919, age = [10, 20, 25, 30, 35, 40][i % 6], by = E.NOW - age;
  const iso = E.pickCountry(index, by, E.rng(seed ^ 0xC0FFEE)), C = load(iso);
  const L = E.Life(Object.assign({}, D0), C, { age, seed, auto: true }); while (L.p.alive) L.step();
  const p = L.p, b = byIso[iso] = byIso[iso] || { n: 0, age: 0, exp: 0, w: 0, name: C.name };
  // 家裡受損那句要自己寫明是哪場天災（地震新聞有 3 年冷卻，不能靠前一句；嚴審 2026-11-14 第 2 條）
  p.log.forEach(e => { if (/家裡.*損失慘重/.test(e.text) && !/^一場強烈(地震|颱風)/.test(e.text)) fail(`seed ${seed} ${e.year} 年受損那句沒自己寫明是哪場天災`); });
    const o5 = {}, ex = cohortE0(C, by, p.sex, o5); b.n++; b.age += p.age; b.exp += ex; u5exp += o5.u5; lifeDiffs.push(p.age - ex);
    dist.u60 += p.age < 60 ? 1 : 0; dist.u60e += o5.u60;
    // 表那邊照活到 x 歲的機率 l(x) 加權（高死亡率國家活到 65 歲的人少，不能跟其他國家等權平均）
    for (const x of [15, 40, 65]) { dist['t' + x] += o5['e' + x] * o5['l' + x]; dist['w' + x] += o5['l' + x]; if (p.age >= x) { dist['s' + x] += p.age - x; dist['n' + x]++; } }
  if (p.age < 5) under5++;
  hmS += p.hmSum || 0; hmN += p.hmN || 0;
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

// ---------- 名字：每一國都要對到名字組（區域名稱改過時會整區掉到英文名字，2026-11-15 審出阿拉伯 18 國） ----------
{ const NM = require('./names.js'); const off = index.countries.filter(c => !NM.known(c)); if (off.length) fail(`沒對到名字組的國家 ${off.length} 個：` + off.slice(0, 8).map(c => c.name + '（' + c.region + '）').join('、')); }

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
  if (!Array.isArray(c.occ) || c.occ.length !== 9 || c.occ.some(v => !(v > 0))) fail(`c/${f} 的 occ 不是 9 個正數（沒有的話所有工作收入一樣）`);
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
console.log(`跑了 ${N} 局；5 歲前走的 ${(under5 / N * 100).toFixed(1)}%（生命表 ${(u5exp / N * 100).toFixed(1)}%）；15 歲以上的健康係數平均 ${(hmS / hmN).toFixed(3)}（再乘 MORT_K ${E.MORT_K}）`);
console.log(`壽命：平均活到 ${(totAge / totN).toFixed(1)} 歲；照同國、同出生年、同性別的生命表應該是 ${(totExp / totN).toFixed(1)} 歲`);
// 分布：只校準平均還不夠，60 歲前走的比例、15／40／65 歲時的平均餘命也要對得上（2026-11-15 嚴審第 5 條）
// 平均餘命那幾條：遊戲裡的每局都從自己的出生年起算，餘命只看活過那個年紀的人，表的那一邊是每局自己那張表的平均
const distRows = [['60 歲前走的比例', dist.u60 / N * 100, dist.u60e / N * 100, 3, '%'], ...[15, 40, 65].map(x => [x + ' 歲時的平均餘命', dist['s' + x] / dist['n' + x], dist['t' + x] / dist['w' + x], x === 65 ? 1.5 : 2.5, ' 年'])];
console.log('壽命分布（遊戲／生命表）：' + distRows.map(([k, a, b, tol, u]) => `${k} ${a.toFixed(1)}${u}／${b.toFixed(1)}${u}`).join('、'));
// 分布沒過時，畫面要有「壽命只校準過平均」的註記才放行（法官 2026-11-15 第 5 條）；註記拿掉、分布又沒過就擋
const noted = fs.readFileSync(path.join(__dirname, 'ui.js'), 'utf8').split(/\r?\n/).some(l => l.includes("'<p class=\"luck-note\">") && l.includes('壽命只校準過平均'));
distRows.forEach(([k, a, b, tol]) => { if (Math.abs(a - b) > tol) { if (noted) console.log(`  ${k} 差 ${(a - b).toFixed(1)}，超過 ${tol}；畫面已註明「壽命只校準過平均」`); else fail(`${k} 遊戲 ${a.toFixed(1)}、生命表 ${b.toFixed(1)}，差超過 ${tol}，畫面也沒註明「壽命只校準過平均」`); } });
if (Math.abs(under5 - u5exp) / N > 0.015) fail(`5 歲前走的比例跟生命表差超過 1.5 個百分點`);
// 容許範圍照樣本誤差：一個人的壽命差可以到幾十歲，1000 局的平均本身就會晃 0.6 歲上下，所以取 1.2 歲和 2.5 倍標準誤的大者
const dMean = lifeDiffs.reduce((a, b) => a + b, 0) / lifeDiffs.length, dSe = Math.sqrt(lifeDiffs.reduce((a, b) => a + (b - dMean) ** 2, 0) / (lifeDiffs.length - 1) / lifeDiffs.length), lifeTol = Math.max(1.2, 2.5 * dSe);
console.log(`  差 ${dMean.toFixed(2)} 歲，標準誤 ${dSe.toFixed(2)}，容許 ±${lifeTol.toFixed(2)}（要更準用 node check.js calibrate，3000 局）`);
if (N >= 1000 && Math.abs(dMean) > lifeTol) fail(`壽命跟生命表差 ${dMean.toFixed(1)} 歲，超過 ±${lifeTol.toFixed(1)}（跑 node check.js calibrate 重校 MORT_K）`);
console.log('  差最多的 10 國（至少 8 局）：' + rows.filter(([, b]) => b.n >= 8).map(([, b]) => [b.name, b.age / b.n - b.exp / b.n, b.n]).sort((x, y) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 10).map(([nm, d, n]) => `${nm} ${d > 0 ? '+' : ''}${d.toFixed(1)}（${n} 局）`).join('、'));
console.log('抽樣：差最多的 10 國（實際局數／每局用自己出生年權重的期望）：' + rows.map(([, b]) => [b.name, b.n, b.w]).sort((x, y) => Math.abs(y[1] - y[2]) - Math.abs(x[1] - x[2])).slice(0, 10).map(([nm, a, w]) => `${nm} ${a}/${w.toFixed(1)}`).join('、'));
console.log(`每局停下來問 ${(sumAsked / N).toFixed(1)} 次；分布 ${Object.entries(askedHist).sort((a, b) => a[0] - b[0]).map(([k, v]) => k + ':' + v).join(' ')}`);
console.log('各抉擇出現次數：' + Object.entries(picks).map(([k, v]) => k + ' ' + Object.values(v).reduce((a, b) => a + b, 0)).join('、'));
console.log('選了考大學的人，模擬考上的比例（25 歲以上大學學歷比例 × ' + T.UNI_SCALE + ' 再調整）：' + Object.values(uni).filter(u => u.n >= 5).sort((a, b) => b.n - a.n).slice(0, 8).map(u => `${u.name} ${u.in}/${u.n}（資料 ${Math.round(u.rate)}%）`).join('、'));
console.log(`重跑一致 ${30 - replayBad}／30；分岔後國家大事一致 ${30 - branchWorldBad}／30`);
// 公開的「遊戲跑出來的 vs 真實統計」（sources.html 讀這個檔）：只在 1000 局以上、全部通過時更新
if (!fails.length && N >= 1000 && MODE !== 'calibrate' && MODE !== 'snapshot') {
  const r1 = v => Math.round(v * 10) / 10, totB = rows.reduce((s, [, b]) => s + b.w, 0);
  const M = 20000, cnt = {};
  for (let i = 0; i < M; i++) { const age = [10, 20, 25, 30, 35, 40][i % 6], iso = E.pickCountry(index, E.NOW - age, E.rng((900000 + i * 7919) ^ 0xC0FFEE)); cnt[iso] = (cnt[iso] || 0) + 1; }
  const top = rows.map(([iso, b]) => [iso, b]).sort((a, b) => b[1].w - a[1].w).slice(0, 10).map(([iso, b]) => ({ name: b.name, game: r1((cnt[iso] || 0) / M * 100), real: r1(b.w / totB * 100) }));
  const d0 = new Date(), stats = { date: d0.getFullYear() + '-' + String(d0.getMonth() + 1).padStart(2, '0') + '-' + String(d0.getDate()).padStart(2, '0'),   // 本地日期（toISOString 是 UTC，台灣早上會差一天）
    engine: E.ENGINE_V, data: DATA_V, runs: N,
    life: { game: r1(totAge / totN), real: r1(totExp / totN) }, u5: { game: r1(under5 / N * 100), real: r1(u5exp / N * 100) },
    dist: distRows.map(([k, a, b, , u]) => ({ k, game: r1(a), real: r1(b), u: u.trim() })), births: top, birthDraws: M };
  fs.writeFileSync(path.join(__dirname, 'stats.json'), JSON.stringify(stats, null, 1));
  console.log('已更新 stats.json（資料來源頁的「遊戲 vs 真實統計」）');
}
console.log(fails.length ? `\n沒過 ${fails.length} 條：\n  ` + fails.slice(0, 30).join('\n  ') : '\n全部通過');
process.exit(fails.length ? 1 : 0);
