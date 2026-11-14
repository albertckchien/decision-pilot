// 隨機投胎引擎 v0.1（2026-11-12）：瀏覽器和 node 都能用。
// 國家層照 data/rules.json（＋vdem.json）每年擲骰；1996～2025 用真實歷史；1996 年以前只跑個人。
// 個人層的機率有兩種：國家參數（data/c/*.json 的 p）和遊戲設定（GS 開頭的常數，不是資料算的）。
(function (root) {
'use strict';
const T = (typeof module !== 'undefined' && module.exports) ? require('./text.js') : root.PlayText;
// 年份從資料包讀（config(index)），沒呼叫時用 2026 年版的預設值
let NOW = 2026, HIST0 = 1996, HIST1 = 2025;
const MAX_ASK = 9, MAX_AGE = 90;
// 死亡率校準（只用在 15 歲以上；15 歲以前完全照生命表，嬰幼兒死亡率不打折）。
// 重病、戰爭會讓人比生命表早走，15 歲以上的死亡率乘這個數拉回來。
// 2026-11-15 第二次：健康係數扣掉自然老化之後，乘 1 就對上（3000 局：平均差 −0.29 歲；60 歲前 20.1%／19.9%；15、40、65 歲餘命 64.5／64.8、41.6／41.9、20.6／20.8）。
// 第一次（老化重複算時）要乘 0.7 才對上平均，但年輕人走太少、老人走太多。check.js（1000 局以上）會檢查差在 max(1.2 歲, 2.5 倍標準誤) 以內。
// 什麼時候要重校：改了死亡、重病、戰爭、健康的算法，或每週資料更新後 check.js 的壽命檢查沒過。
// 怎麼重校：node play/check.js calibrate（試幾個值、印出差多少），把最接近 0 的那個填回這裡，再跑 check.js 1000。
let MORT_K = 1;
// 引擎版本：任何會改變「同一個年紀＋種子跑出來的結果」的改動都要升（分享連結帶著它，check.js 的結局快照也看它）
const ENGINE_V = 'e20261115h';
function config(index) {
  if (index && index.birthYears) { NOW = index.birthYears[1]; HIST0 = index.birthYears[0]; }
  if (index && index.histYears) { HIST0 = index.histYears[0]; HIST1 = index.histYears[1]; } else HIST1 = NOW - 1;
}
// 網址參數：只收範圍內的整數，不合格就回 null（畫面回到開始的表單）
function parseQuery(search) {
  const q = new URLSearchParams(search || ''), a = q.get('age'), sd = q.get('seed');
  if (a === null || !/^\d{1,3}$/.test(a) || +a > MAX_AGE) return null;
  const out = { age: +a, seed: null };
  if (sd !== null) { if (!/^\d{1,10}$/.test(sd) || +sd > 4294967295) return null; out.seed = +sd; }
  return out;
}
const TIERS = ['低所得', '中低所得', '中高所得', '高所得'];
const BANDS = ['<2%', '2–5%', '5–10%', '10–20%', '20–40%', '≥40%'];

// ---------- 亂數 ----------
function rng(seed) {
  let a = seed >>> 0;
  return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function normal(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
function wpick(r, ws) { const s = ws.reduce((a, b) => a + b, 0); let u = r() * s; for (let i = 0; i < ws.length; i++) { u -= ws[i]; if (u <= 0) return i; } return ws.length - 1; }
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const logit = p => Math.log(p / (1 - p)), sig = x => 1 / (1 + Math.exp(-x));
function shiftP(p, d) { p = clamp(p, 0.001, 0.999); return sig(logit(p) + d); }
function invNorm(p) { // Acklam 近似
  const a = [-39.6968, 220.9461, -275.9285, 138.3578, -30.6648, 2.5066], b = [-54.4761, 161.5858, -155.6990, 66.8013, -13.2807];
  const q = p - 0.5; if (Math.abs(q) > 0.47) { const s = Math.sqrt(-2 * Math.log(q < 0 ? p : 1 - p)); const v = (2.9384 + s * (4.3742 + s * -2.5497)) / (1 + s * (2.4436 + s * 0.3755)); return q < 0 ? -v * 0.97 : v * 0.97; }
  const r = q * q; return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

// ---------- 規則查表 ----------
function lookup(rule, st) {
  const keys = rule.keys || [];
  for (let n = keys.length; n >= 0; n--) {
    const want = keys.slice(0, n);
    const row = rule.rows.find(r => r.from === undefined && Object.keys(r.keys).length === n && want.every(k => r.keys[k] === st[k]));
    if (row) return row.p;
  }
  return 0;
}
function markov(rule, from, st) {
  const keys = rule.keys || [];
  for (let n = keys.length; n >= 0; n--) {
    const want = keys.slice(0, n);
    const row = rule.rows.find(r => r.from === from && Object.keys(r.keys).length === n && want.every(k => r.keys[k] === st[k]));
    if (row) return row.p;
  }
  const p = []; p[from] = 1; return p;
}
function fromQ(qs, vals, u) {
  if (u <= qs[0]) return vals[0];
  for (let i = 1; i < qs.length; i++) if (u <= qs[i]) return vals[i - 1] + (vals[i] - vals[i - 1]) * (u - qs[i - 1]) / (qs[i] - qs[i - 1]);
  return vals[vals.length - 1];
}
const tierOf = l => l <= 1000 ? 0 : l <= 4150 ? 1 : l <= 13250 ? 2 : 3;
function muOf(curve, l) {
  const x = Math.log(l), pts = curve.map(p => [Math.log(p.center_2015usd), p.mu]);
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
  return pts[pts.length - 1][1];
}

// ---------- 抽國家 ----------
function pickCountry(index, birthYear, r) {
  const i = clamp(birthYear, index.birthYears[0], index.birthYears[1]) - index.birthYears[0];
  const c = index.countries[wpick(r, index.countries.map(x => x.b[i] || 0))];
  return c.iso;
}

// ---------- 國家一年 ----------
// 回傳 {year, lvl, tier, infl, band, events:[...], war, viol, real:true/false/null}
function Country(D, C, birthYear, r) {
  const R = D.rules.rules, V = D.vdem, s = C.start;
  const st = { lvl: s.lvl, cur: s.cur, curRun: s.cur_run, rec: s.rec, recRun: s.rec_run, dev: s.m || 0, band: s.band, hiRun: s.hiband_run, hiRecent: s.hi_recent,
    war: s.war, viol: s.viol, def: 0, defRun: 0, recentDef: s.recent_def, recentWar: s.recent_war, recentViol: s.recent_viol,
    coupYears: s.recent_coup ? [NOW - 3] : [], regime: V.regime_start[C.iso] ?? 1, gtype: 'normal', analog: '2009' };
  const tier = () => tierOf(st.lvl);
  const firstL = (C.hist[HIST0] && C.hist[HIST0].l) || s.lvl;
  function histYear(y) {
    const h = C.hist[y] || {}, e = h.e || [];
    const lvl = h.l || firstL;
    const ev = [];
    let war = 0, viol = 0;
    const prevE = (C.hist[y - 1] && C.hist[y - 1].e) || [];
    for (const t of e) {
      if (t === 'war') war = Math.max(war, 1); else if (t === 'war2') war = 2;
      else if (t === 'viol') viol = 1;
      else if (t === 'attack' || t === 'coup' || !prevE.includes(t)) ev.push(t);   // 連續幾年的同一件事只在第一年播
    }
    if (war && !(C.hist[y - 1] && (C.hist[y - 1].e || []).some(t => t.startsWith('war')))) ev.push(war === 2 ? 'war_start2' : 'war_start');
    // 資料包只放通膨級距（不放數值），這裡取每一級的代表值
    const band = h.b ?? 1, infl = [1, 3.5, 7, 14, 28, 120][band];   // 第 5 級（40% 以上）取 120，存款一年縮到上限 60%，跟推估年份的惡性通膨口徑接近
    // 貨幣危機：資料只在開始那年標 cur，那一年存款跟推估年份一樣打折
    return { year: y, lvl, tier: tierOf(lvl), infl, band, events: ev, war, viol, cur: e.includes('cur') ? 1 : 0, real: true };
  }
  function simYear(y) {
    const ev = [], ti = tier(), region = C.region;
    // 世界
    if (st.gtype === 'global') st.gtype = 'rebound';
    else st.gtype = D.world(y);
    if (st.gtype === 'global') { st.analog = D.analog(y); ev.push('glob'); }
    // 政變（V-Dem）
    const recentCoup = st.coupYears.some(c => y - c <= 10) ? 1 : 0, recentCoup5 = st.coupYears.some(c => y - c <= 5) ? 1 : 0;
    if (r() < lookup(V['coup.onset'], { recent_coup: recentCoup, tier: ti, region })) {
      st.coupYears.push(y); ev.push('coup'); st.regime = wpick(r, V['regime.after_coup'].p);
    } else {
      const old = st.regime; st.regime = wpick(r, markov(V['regime.markov'], st.regime, { recent_coup5: recentCoup5 }));
      if (st.regime < old && old >= 2 && st.regime <= 1) ev.push('autocracy'); else if (st.regime >= 2 && old <= 1) ev.push('democracy');
    }
    // 衝突
    const ow = st.war;
    st.war = wpick(r, markov(R['war.markov'], st.war, { recent_war: st.recentWar, tier: ti, region }));
    if (st.war && !ow) { ev.push(st.war === 2 ? 'war_start2' : 'war_start'); if (r() < R['war.interstate_share'].p) ev.push('interstate'); }
    if (st.war === 2 && ow === 1) ev.push('war_escalate');
    if (!st.war && ow) ev.push('war_end');
    if (st.war) st.recentWar = 1;
    st.viol = wpick(r, markov(R['violence.markov'], st.viol, { recent_viol: st.recentViol, tier: ti, region }));
    if (st.viol) st.recentViol = 1;
    if (r() < lookup(R['attack.onset'], { tier: ti, region })) ev.push('attack');
    // 貨幣危機
    const wasCur = st.cur;
    st.cur = wasCur ? (r() < lookup(R['currency.continue'], { dur: Math.min(3, st.curRun) }) ? 1 : 0) : (r() < lookup(R['currency.onset'], { tier: ti, infl_hi: st.band >= 3 ? 1 : 0 }) ? 1 : 0);
    st.curRun = st.cur ? st.curRun + 1 : 0;
    if (st.cur && !wasCur) ev.push('cur');
    // 通膨級距
    st.band = wpick(r, markov(R['inflation.band'], st.band, { cur: st.cur, hi_run: Math.min(3, st.hiRun), hi_recent: st.hiRecent, tier: ti, region }));
    st.hiRun = st.band === 5 ? st.hiRun + 1 : 0; if (st.band === 5) { st.hiRecent = 1; if (st.hiRun === 1) ev.push('hinf'); }
    const iv = R['inflation.values'];
    const infl = fromQ(iv.quantiles, iv.by_band[BANDS[st.band]].q, r());
    // 倒債
    const wasDef = st.def; let defSize = -1;
    if (wasDef) st.def = r() < lookup(R['default.continue'], { dur: Math.min(4, st.defRun) }) ? 1 : 0;
    else if (r() < lookup(R['default.onset'], { recent_def: st.recentDef, cur: st.cur, tier: ti, region })) { st.def = 1; defSize = wpick(r, lookup(R['default.size'], {})); ev.push('def' + defSize); st.recentDef = 1; }
    st.defRun = st.def ? st.defRun + 1 : 0;
    // 成長
    const mu = muOf(R['growth.normal'].curve, st.lvl);
    let g, rec = 0;
    if (st.gtype !== 'normal') {
      const a = R['world.analog'].analogs[st.analog][st.gtype === 'global' ? '全球衰退年' : '隔年（反彈）'][TIERS[ti]];
      g = mu + fromQ(R['world.analog'].quantiles, a.q, r()); rec = g <= -3 ? 1 : 0;
    } else {
      const p = st.rec ? lookup(R['recession.continue'], { dur: Math.min(3, st.recRun), tier: ti }) : lookup(R['recession.onset'], { cur: st.cur, war2: st.war === 2 ? 1 : 0, def_big: defSize === 2 ? 1 : 0 });
      if (r() < p) { const rq = R['growth.recession_year'].by_tier[TIERS[ti]]; g = fromQ(R['growth.recession_year'].quantiles, rq.q, r()); rec = 1; }
      else if (st.rec) { const aq = R['growth.after_recession']; g = mu + fromQ(aq.quantiles, aq.q, r()); }
      else { const gn = R['growth.normal']; for (let i = 0; i < 20; i++) { g = mu + gn.rho[TIERS[ti]].rho * st.dev + fromQ(gn.quantiles, gn.resid[TIERS[ti]].q, r()); if (g > -3) break; } }
    }
    if (rec && !st.rec) ev.push(g <= -10 ? 'dep' : 'rec');
    st.recRun = rec ? st.recRun + 1 : 0; st.rec = rec; st.dev = g - mu; st.lvl *= 1 + g / 100;
    // 天災
    const h = C.haz;
    if (r() < h.eq65_p) ev.push('quake_big'); else if (r() < h.eq55_p * 0.35) ev.push('quake');
    if (r() < h.tc64_p * 0.5) ev.push('typhoon_big');
    return { year: y, lvl: st.lvl, tier: tierOf(st.lvl), infl, band: st.band, events: ev, war: st.war, viol: st.viol, cur: st.cur, real: false, regime: st.regime };
  }
  return {
    year(y) {
      if (y < HIST0) return { year: y, lvl: firstL * Math.pow(0.98, HIST0 - y), tier: tierOf(firstL * Math.pow(0.98, HIST0 - y)), infl: 3, band: 1, events: [], war: 0, viol: 0, real: null };
      if (y <= HIST1) { const o = histYear(y); if (y === HIST1) st.lvl = s.lvl; return o; }
      return simYear(y);
    }
  };
}

// ---------- 生命表 ----------
function qx(C, year, age, sex) {
  const Y = C.lifeYears, y = clamp(year, Y[0], Y[Y.length - 1]), a = Math.min(100, age);
  let i = Math.min(Y.length - 2, Math.floor((y - Y[0]) / 5));
  const t = (y - Y[i]) / 5, A = C.life[sex + Y[i]], B = C.life[sex + Y[i + 1]];
  return (A[a] * (1 - t) + B[a] * t) / 100000;
}

// ---------- 一個人 ----------
// opts: {age 現在幾歲, seed, auto 交給系統}
function Life(D, C, opts) {
  const seed = opts.seed >>> 0, birthYear = NOW - opts.age;
  let pr = rng(seed ^ 0x9E3779B9);              // 個人（分岔多跑時可以換一條，見 reseed）
  const wr = rng(seed ^ 0x51ED270B);            // 世界（全球衰退）
  const cr = rng(seed ^ 0x2545F491);            // 國家
  const glob = {};
  D.world = y => { if (!(y in glob)) glob[y] = wr() < D.rules.rules['world.global_recession'].p ? 'global' : 'normal'; return glob[y]; };
  D.analog = () => wr() < 0.5 ? '2009' : '2020';
  const country = Country(D, C, birthYear, cr);
  const P = C.p;
  const sex = pr() < 0.512 ? 'M' : 'F';
  // 推估年份不先呼叫 year()（會多擲一次骰子），起點級距直接用資料包的起點所得
  const t0 = birthYear > HIST1 ? { tier: tierOf(C.start.lvl), lvl: C.start.lvl } : country.year(birthYear);
  const urbanP = [0.35, 0.45, 0.65, 0.8][t0.tier];   // GS：城鄉比例照所得級距粗估
  const urban = pr() < urbanP;
  const wealthU = pr();                               // 家境分位 0～1
  const gini = (P.gini || 38) / 100, sigma = Math.SQRT2 * invNorm((gini + 1) / 2);
  const wz = invNorm(clamp(wealthU, 0.001, 0.999));
  const famMult = Math.exp(sigma * wz - sigma * sigma / 2);
  const sibs = Math.max(0, Math.round((P.tfr || 2) - 1 + normal(pr) * 0.8));
  const parentEdu = (() => { const tert = (P.edu_tertiary || 10) / 100, sec = (P.edu_secondary || 40) / 100;
    const u = clamp(pr() * 0.6 + wealthU * 0.4, 0, 1); return u > 1 - tert * 0.8 ? 2 : u > 1 - sec * 0.9 ? 1 : 0; })();
  const p = {
    sex, urban, wealthU, famMult, sibs, parentEdu, birthYear, iso: C.iso,
    age: 0, year: birthYear, alive: true, stats: { health: 70 + normal(pr) * 8, happy: 60 + normal(pr) * 8, know: 40 + normal(pr) * 8, social: 55 + normal(pr) * 8 },
    trait: { drive: pr(), care: pr(), risk: pr() },
    school: 0, inSchool: false, edu: 0, job: null, income: 0, savings: 0, married: false, partnerAge: null, kids: [], parentsAlive: 2,
    focus: null, asked: 0, seen: {}, cash: 'local', fled: false, sick: 0, retired: false, flags: {}, log: [], picks: [], decisions: 0, countryLog: [], yearsWar: 0
  };
  if (P.undernourish > 15 && wealthU < 0.4) p.stats.health -= 6;
  const feelK = 0.63 * 31 * 1.3 / (P.price_level || 0.5); // 2015 美元 → 現在的體感新臺幣（GS）
  p.feel = usd => Math.round(usd * feelK / 1000) * 1000;
  const queue = [];   // 等玩家選的抉擇
  let pending = null, cy = t0;

  function say(key, vars, kind) {
    const v = Object.assign({ who: p, c: C }, vars || {}), s = T.fmt(key, v);
    if (s) { const e = { age: p.age, year: p.year, kind: kind || 'life', text: s }, so = T.soft(key, v); if (so && so !== s) e.soft = so; p.log.push(e); }   // soft：「略過可怕的情節」用，不影響結果
    return s;
  }
  function stat(k, d) { p.stats[k] = clamp(p.stats[k] + d, 0, 100); }
  function ask(id, ctx) { queue.push({ id, ctx: ctx || {} }); }

  // ----- 收入 -----
  function earn() {
    // GS：做公職或公司滿 10 年，退休金＝最後一份公職或公司薪水的四成；其他人照該國老年年金覆蓋率（ILOSTAT），領到的是人均所得的 15% 左右的基本年金
    if (p.retired) return (p.formalYears || 0) >= 10 ? (p.lastFormalInc || 0) * 0.4 : p.basicPension ? cy.lvl * 0.15 : 0;
    if (!p.job) return 0;
    const base = cy.lvl * 0.75 * famMult ** 0.35;   // GS：個人收入≈人均 GDP×家境的一部分
    // 收入看做的是哪種工作（text.js 的 jobPay：該國這類職業的收入比），不另外乘學歷倍數；學歷影響的是能做哪些工作
    return base * p.job.mult * (0.85 + p.stats.know / 300);
  }

  // ----- 一年 -----
  function yearCountry() {
    cy = country.year(p.year);
    const evs = cy.events;
    if (cy.real === null && p.age === 0) say('noHist', { y0: HIST0 }, 'note');
    if (p.year === HIST1 + 1) say('simStart', {}, 'note');
    const news = e => {
      const s = say('n_' + e, { y: p.year, infl: cy.infl.toFixed(0) }, 'news');
      if (s) { p.countryLog.push({ year: p.year, e, real: cy.real }); if (e === 'quake' || e === 'quake_big') p.lastQuakeNews = p.year; if (e === 'quake_big') p.lastBigQuakeNews = p.year; }
    };
    for (const e of evs) {
      // 地震新聞 3 年內只報一次（美國、印尼、日本幾乎年年有，一直重複）；只是不寫進紀錄，結果不變（2026-11-14）。
      // 強烈地震只被前一則強烈地震擋，小地震不能把它壓掉（獨立重審第 4 條）；只看國家事件，分岔的兩條路一樣
      if (e === 'quake' && p.lastQuakeNews != null && p.year - p.lastQuakeNews < 3) continue;
      if (e === 'quake_big' && p.lastBigQuakeNews != null && p.year - p.lastBigQuakeNews < 3) continue;
      news(e);
    }
    // 打到身上
    const hit = cy.war ? pr() < C.zone * (p.flags.abroad ? 0 : p.fled ? 0.3 : 1) : false;
    if (cy.war) p.yearsWar++;
    if (hit && cy.war === 2) { stat('happy', -8); stat('health', -4); if (p.age >= 18 && p.age <= 40 && p.sex === 'M' && pr() < 0.25 && !p.flags.draft) { p.flags.draft = 1; say('draft'); stat('health', -6); } }
    if (hit && p.age >= 6 && p.age <= 17 && pr() < 0.5) { say('schoolClosed'); stat('know', -5); }
    if (evs.includes('war_start2') || (cy.war === 2 && hit && !p.flags.warAsk)) { p.flags.warAsk = 1; if (p.age >= 16) ask('war'); }
    if (cy.viol && pr() < 0.12) { say('violNear'); stat('happy', -4); }
    if (evs.includes('cur') && p.age >= 20 && p.savings > 0 && !p.flags.curAsked) { p.flags.curAsked = 1; ask('currency'); }
    if (cy.band >= 4 && p.savings > 0 && p.cash === 'local') { p.savings *= 1 - Math.min(0.6, cy.infl / 200); if (cy.band === 5) say('inflBite'); }
    if (cy.cur && p.cash === 'local' && p.savings > 0) p.savings *= 0.8;
    if (evs.includes('def2') && p.savings > 0) { p.savings *= 0.75; say('defBite'); }
    if ((evs.includes('quake_big') || evs.includes('typhoon_big')) && pr() < 0.15) {
      // 受損那句自己寫明是哪場天災：地震新聞可能被 3 年冷卻壓掉，不能靠前一句（嚴審 2026-11-14 第 2 條）。
      // 不補寫新聞：受損是個人運氣，補寫會讓分岔的兩條路國家大事不一樣
      say(evs.includes('typhoon_big') ? 'disasterStorm' : 'disasterQuake'); p.savings *= 0.85; stat('happy', -5); }
    if (evs.includes('coup') && p.job && p.job.kind === 'gov' && pr() < 0.3) { say('coupJob'); stat('happy', -6); }
    if ((evs.includes('rec') || evs.includes('dep') || (evs.includes('glob') && cy.tier >= 2)) && p.job && !p.retired) {
      const lay = (evs.includes('dep') ? 0.2 : 0.08) * (p.job.kind === 'gov' ? 0.3 : p.job.kind === 'risky' ? 1.6 : 1);
      if (pr() < lay && (p.flags.layoffs || 0) >= 2 && !p.flags.layoffCap) { p.flags.layoffCap = 1; say('layoffCap', {}, 'pick'); }
      else if (pr() < lay && (p.flags.layoffs || 0) < 2) { p.flags.laid = 1; p.flags.layoffs = (p.flags.layoffs || 0) + 1; if (p.job.kind === 'risky') ask('bizFail'); else if (p.job.kind === 'informal' || p.job.kind === 'farm') { say('jobLost'); p.jobLosses = (p.jobLosses || 0) + 1; p.job = null; p.flags.unemp = 1; p.flags.laid = 0; } else ask('layoff'); }
    }
  }

  function childhood() {
    const a = p.age;
    if (a === 0) { say('born'); if (p.sibs) say('sibs', { n: p.sibs }); say(['pe0', 'pe1', 'pe2'][p.parentEdu]); }
    if (a === 3 && pr() < 0.3) say(pick(pr, ['kid1', 'kid2', 'kid3', 'kid4']));
    if (a === 6) {
      const pPrim = shiftP(clamp(0.55 + (P.edu_secondary || 40) / 150 + 0.1, 0.3, 0.995), (wealthU - 0.5) * 2 + (urban ? 0.5 : -0.3));
      if (pr() < pPrim) { p.inSchool = true; p.school = 1; say('schoolStart'); } else { say('noSchool'); p.flags.noSchool = 1; }
    }
    if (a === 12 && p.inSchool) {
      const pSec = shiftP(clamp((P.edu_secondary || 40) / 100 + 0.12, 0.05, 0.98), (wealthU - 0.5) * 2.4 + (p.stats.know - 50) / 25 + p.parentEdu * 0.4 + (urban ? 0.3 : -0.3));
      if (pr() < pSec || (P.edu_secondary || 0) > 85) { p.school = 2; say('secStart'); } else { p.inSchool = false; p.edu = 0; p.flags.dropout = 1; say('dropout'); }
    }
    if (a >= 10 && a <= 14 && !p.inSchool && !p.flags.childWork && wealthU < 0.5 && pr() < (P.vuln_emp || 20) / 150) { p.flags.childWork = 1; say('childWork'); stat('know', -3); }
    if (p.sex === 'F' && a >= 15 && a <= 17 && !p.married && pr() < ((P.child_marriage || 0) / 100) / 3 * (wealthU < 0.5 ? 1.5 : 0.5)) { p.married = true; p.flags.childMarriage = 1; say('childMarriage'); stat('happy', -8); if (p.inSchool && pr() < 0.6) { p.inSchool = false; say('leftSchool'); } }
    if (a === 15 && p.inSchool && p.school === 2 && wealthU < 0.35 && !p.flags.childMarriage) ask('stayInSchool');
    if (a >= 6 && a <= 17 && pr() < 0.06) say(pick(pr, ['ch1', 'ch2', 'ch3', 'ch4', 'ch5', 'ch6']));
    if (a >= 15 && a < 18 && p.flags.leftToWork && !p.job) startJob('informal');
    if (a === 18) {
      if (p.inSchool) { p.edu = 1; say('secDone'); ask('after18'); }
      else if (!p.job) { p.edu = p.school >= 2 ? 1 : 0; startJob(null); }
    }
  }

  function startJob(kind) {
    const P2 = P.informal || 30;
    if (!kind) kind = pr() < P2 / 100 * (p.edu >= 2 ? 0.4 : 1) ? (!p.urban && pr() < 0.5 ? 'farm' : 'informal') : pr() < 0.2 ? 'gov' : 'private';
    // 工作種類：公職略低但穩、自己做的變化大、非正式和務農比受僱的同類工作再少一些（職業的收入差已經在 jobPay 裡，這裡只放種類的差）
    const mult = { gov: 0.95, private: 1.0, risky: 0.8 + pr() * 1.6, informal: 0.85, farm: 0.8 }[kind];
    const lv = p.flags.retrained && p.edu < 1 ? 1 : p.edu;   // 進修過：中學以下的人可以應徵中學那一級的工作，學歷照實際念的
    const pool = T.jobs[kind][Math.min(lv, 3)] || T.jobs[kind][0];
    const job = pick(pr, pool);
    // 同一份工作也有人賺得多、有人賺得少（個人差異，GS）
    p.job = { kind, mult: mult * T.jobPay(job, C) * Math.exp(normal(pr) * 0.2), name: job[0], g: job[1] };
    say('jobStart', { job: p.job.name });
  }

  function adult() {
    const a = p.age;
    // 學業結束
    if (p.inSchool && p.school === 3 && a >= 22) { p.inSchool = false; p.edu = p.flags.voc ? 2 : 3; say(p.flags.voc ? 'vocDone' : 'uniDone'); ask('firstJob'); }
    // 失業
    if (p.job && !p.retired && !p.flags.laid && pr() < (P.unemp || 6) / 100 * 0.25) { say('jobLost'); p.job = null; p.flags.unemp = 1; p.jobLosses = (p.jobLosses || 0) + 1; }
    if (!p.job && !p.inSchool && !p.retired && a >= 60 && !queue.length) { p.retired = true; say('retireEarly'); }
    if (!p.job && !p.inSchool && !p.retired && a >= 18 && a < 60 && !queue.length) { if (p.flags.unemp && pr() < 0.6) { p.flags.unemp = 0; startJob(null); } else if (!p.flags.unemp) startJob(null); }
    // 戀愛結婚
    const smam = P.smam_f || 25;
    if (!p.married && !p.flags.single && a >= 18 && a <= 45 && (p.flags.marryWait || 0) <= a) {
      const peak = smam + (p.sex === 'M' ? 2.5 : 0);
      const pm = 0.22 * Math.exp(-((a - peak) ** 2) / 60) * (0.8 + p.stats.social / 125);
      if (pr() < pm) { p.flags.marryAsks = (p.flags.marryAsks || 0) + 1; if (p.flags.marryAsks > 2) { p.flags.single = 1; say('marryCap', {}, 'pick'); } else ask('marry'); }
    }
    // 生小孩
    if (p.married && a >= 18 && a <= (p.sex === 'F' ? 44 : 55) && p.kids.length < 8 && !p.flags.noKids) {
      const pk = clamp((P.tfr || 2) / 18, 0.03, 0.45) * (p.kids.length === 0 ? 1.3 : 1) * (p.flags.wantMore ? 1.4 : 0.6);
      if (pr() < pk) { if (p.kids.length === 0 && !p.flags.kidAsked) { p.flags.kidAsked = 1; ask('kids'); } else { p.kids.push(p.year); say('kidBorn', { n: p.kids.length }); stat('happy', 4); p.savings -= cy.lvl * 0.2; } }
    }
    // 父母
    if (p.parentsAlive > 0 && a >= 30) {
      const parentAge = a + 27;
      if (pr() < qx(C, p.year, parentAge, 'M') * 1.1) { p.parentsAlive--; say(p.parentsAlive ? 'parentDied1' : 'parentDied2'); stat('happy', -10); }
      else if (!p.flags.care && parentAge >= 72 && pr() < 0.12) { p.flags.care = 1; ask('care'); }
    }
    // 病
    if (a >= 40 && !p.sick && pr() < 0.006 * Math.exp((a - 40) / 12) * (1.3 - p.stats.health / 100)) { p.sick = 1; ask('illness'); }
    // 退休
    if (a === 65 && p.job && !p.retired) ask('retire');
    if (a === 72 && !p.retired) { p.retired = true; say('retireLate'); }
    if (pr() < 0.05 && a >= 19) say(pick(pr, ['ad1', 'ad2', 'ad3', 'ad4', 'ad5', 'ad6', 'ad7', 'ad8']));
    if (a === 50 && p.kids.length && pr() < 0.6) say('kidsGrown');
  }

  function money() {
    const inc = earn();
    p.income = inc;
    if (p.retired && p.basicPension === undefined) p.basicPension = (p.formalYears || 0) < 10 && pr() < (P.pension_old ?? 50) / 100;
    if (p.job && !p.retired) { p.lastInc = inc; if (p.job.kind === 'gov' || p.job.kind === 'private') { p.formalYears = (p.formalYears || 0) + 1; p.lastFormalInc = inc; } }
    const living = cy.lvl * 0.25 * famMult ** 0.4;
    // 退休後的花費照這個人原本的收入水準（最後收入的 45%），不是全國一個數；最低是人均所得的一成（2026-11-15 複審：不然學歷低的人晚年幾乎都欠債）
    const retiredSpend = Math.max(cy.lvl * 0.1, (p.lastInc || living / 0.72) * 0.45);
    // 養小孩：每個小孩每年取「人均所得的 6%」和「家裡收入的 8%」的低者（收入低的家庭花得少；不然窮國的家庭一輩子都在欠債）
    const kidCost = Math.min(cy.lvl * 0.06, (inc || living) * 0.08);
    const spend = (p.job && !p.retired ? inc * 0.72 : p.retired ? retiredSpend : living) + p.kids.filter(k => p.year - k < 22).length * kidCost;
    if (p.age >= 18) p.savings += inc - spend;
    // 退休後存款用完就停在 0，不再借錢過日子：沒有退休金的長輩多半靠家人接濟、過得很省（GS）
    if (p.retired && p.savings < 0) { p.savings = 0; if (!p.flags.broke) { p.flags.broke = 1; say(p.kids.length ? 'brokeKids' : 'brokeAlone'); } }
    if (p.savings > 0) p.savings *= 1 + (p.cash === 'local' ? 0.01 : 0.02);
    if (p.savings < -cy.lvl * 3) p.savings = -cy.lvl * 3;
    if (p.age >= 18 && p.savings > (p.peak || 0)) p.peak = p.savings;
  }

  function focusEffect() {
    if (p.age < 6) return;
    const opts = T.focusFor(p);
    const f = p.focusPick && opts.includes(p.focusPick) ? p.focusPick : autoFocus(opts);
    p.focus = f;
    const e = T.focus[f].e;
    for (const k in e) stat(k, e[k]);
    // 50 歲以後健康自然下降（畫面上的健康值）；記下下降了多少，死亡率要扣掉這部分（生命表已經照年齡算過一次，不能再罰一次）
    { const before = p.stats.health; stat('health', p.age > 50 ? -(p.age - 50) / 12 : 0); p.agedLoss = (p.agedLoss || 0) + (before - p.stats.health); }
    if (f === 'study' && p.inSchool) p.flags.studyYears = (p.flags.studyYears || 0) + 1;
  }
  function autoFocus(opts) {
    const w = opts.map(f => { const x = T.focus[f]; return 1 + (x.drive || 0) * p.trait.drive * 2 + (x.care || 0) * p.trait.care * 2 + (f === 'health' && p.stats.health < 45 ? 2 : 0) + (f === 'rest' && p.stats.happy < 35 ? 2 : 0); });
    return opts[wpick(pr, w)];
  }

  function death() {
    let q = qx(C, p.year, p.age, p.sex);
    // GS：15 歲以上，健康高的人機率低一點（2026-11-15 實測平均約 0.75），再乘 MORT_K 校準
    // 健康係數只看年紀以外的差異（生活習慣、生病、受傷）：健康值加回自然老化扣掉的部分（2026-11-15：老化重複算兩次，老人走太多、年輕人走太少）
    const hm = clamp(1.6 - Math.min(100, p.stats.health + (p.agedLoss || 0)) / 80, 0.55, 1.8);
    if (p.age >= 15) { q *= hm * MORT_K; p.hmSum = (p.hmSum || 0) + hm; p.hmN = (p.hmN || 0) + 1; }
    if (p.sick === 1) q = q * 2 + 0.03;
    if (cy.real === false && cy.war === 2 && !p.fled) q += 0.004 * C.zone * 3;   // 推估年份的戰爭另加（真實年份的生命表已含）
    if (pr() < q) {
      p.alive = false;
      const cause = (cy.real === false && cy.war === 2 && pr() < 0.4 && p.age >= 15) ? 'war' : T.cause(p, pr);
      p.cause = cause; say('death', { cause: T.causes[cause] });
      return true;
    }
    return false;
  }

  // ----- 抉擇 -----
  function options(c) { return T.choices[c.id].opts.filter(o => !o.when || o.when(p, cy)); }
  function autoChoose(c) {
    const os = options(c);
    // 分岔重跑：之後遇到同一種抉擇，沿用玩家原本的選法（選得到的話）
    // prefer[id] 是陣列時照出現順序：這種抉擇第 n 次出現就用第 n 次的選法，超過就用最後一次的
    const pv = opts.prefer && T.choices[c.id].size !== 'small' ? opts.prefer[c.id] : null;
    const want = Array.isArray(pv) ? pv[Math.min((p.seen[c.id] || 0), pv.length - 1)] : pv;
    if (want && os.some(o => o.k === want)) return want;
    const w = os.map(o => Math.max(0.05, (o.w ? o.w(p, cy) : 1)));
    return os[wpick(pr, w)].k;
  }
  function apply(c, k) {
    const ch = T.choices[c.id], o = ch.opts.find(x => x.k === k);
    p.decisions++; p.picks.push({ age: p.age, year: p.year, id: c.id, k, auto: !!c.auto }); p.seen[c.id] = (p.seen[c.id] || 0) + 1;
    const res = o.do(p, { pr, cy, stat, say, startJob, C });
    say('picked', { q: ch.title, a: o.label, auto: c.auto, why: c.why }, 'pick');
    if (res) say(res);
  }

  function step() {
    if (!p.alive) return null;
    if (pending) return { choice: pending };
    p.year = birthYear + p.age;
    yearCountry();
    if (p.age <= 18) childhood(); else adult();
    focusEffect(); money();
    return flush();
  }
  function flush() {
    while (queue.length) {
      const c = queue.shift();
      if (!options(c).length) continue;
      // 一局最多停 MAX_ASK 次，超過交給系統（玩家看得到「交給系統」）
      if (opts.auto || T.choices[c.id].size === 'small' || p.asked >= MAX_ASK) {
        c.auto = true; c.why = opts.prefer ? '分岔之後都交給系統，遇到原本選過的就照原本的選' : opts.auto ? '' : '這一局已經問了很多次'; apply(c, autoChoose(c)); continue;
      }
      p.asked++; pending = c; return { choice: describe(c) };
    }
    const dead = death();
    const out = { age: p.age, year: p.year, dead, country: cy };
    if (!dead) p.age++;
    if (p.age > 110) { p.alive = false; }
    return out;
  }
  function describe(c) { return { id: c.id, title: T.choices[c.id].title, desc: T.fmt(T.choices[c.id].desc, { who: p, c: C }), soft: T.choices[c.id].softDesc ? T.fmt(T.choices[c.id].softDesc, { who: p, c: C }) : '', stat: T.choices[c.id].stat ? T.fmt(T.choices[c.id].stat, { who: p, c: C }) : '', opts: options(c).map(o => ({ k: o.k, label: o.label, hint: o.hint || '' })) }; }
  function choose(k) { if (!pending) return; const c = pending; pending = null; apply(c, k); return flush(); }
  function setFocus(f) { p.focusPick = f; }
  function setAuto(v) { opts.auto = v; }
  // 換一條個人運氣（世界和國家的亂數不動）：分岔頁拿同一組 salt 跑兩條路，比的是同一種運氣下選擇的差別
  function reseed(salt) { pr = rng((seed ^ 0x9E3779B9 ^ Math.imul(salt + 1, 0x85EBCA6B)) >>> 0); }

  return { p, C, step, choose, setFocus, setAuto, reseed, birthYear, get pending() { return pending ? describe(pending) : null; } };
}

const api = { rng, pickCountry, Life, qx, config, parseQuery, MAX_AGE, ENGINE_V, setMortK: k => { MORT_K = k; }, get MORT_K() { return MORT_K; }, get NOW() { return NOW; }, get HIST0() { return HIST0; }, get HIST1() { return HIST1; } };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PlayEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
