// 人生模擬引擎（v1.1）：每個選項跑 N 次，照用戶排的三個目標打分，挑第 80、20 百分位附近當運氣好、運氣差。
// 每年 5～15 件事，一路到過世；事件裡的人都有名字（names.js）。人生選擇一律保守，好壞只來自外在的運氣。
// 用法：node simulate.js <人生模擬參數.json> <人生模擬.json> [--runs 500] [--seed 1]
const fs = require('fs');
const W = require('./world.js');
const T = require('./texts.js');
const NM = require('./names.js');

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const clamp = (v, lo = 3, hi = 100) => Math.max(lo, Math.min(hi, v));
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
const CITY = { TWN: '台灣', SGP: '新加坡' };
function phaseAt(opt, t) { return opt.phases.find(p => t >= p.from && t < p.to) || opt.phases[opt.phases.length - 1]; }

// 一段人生：角色用代號記（cw3、boss2、fr1…），挑出要給人看的那幾段才換成名字
function runOnce(D, P, opt, seed) {
  const rnd = rng(seed);
  const isos = [...new Set([P.home, ...opt.phases.map(p => p.country)])];
  const countries = {}; isos.forEach(i => { countries[i] = W.initCountry(D, i); });
  const world = { type: 'normal' }, fam = P.family || {};
  const roles = {}; let nid = 0;
  const newRole = (kind, style) => { const id = kind + (++nid); roles[id] = { kind, style, g: rnd() < 0.5 ? 'M' : 'F' }; return id; };
  let age = P.age, m = P.savings, h = clamp(88 - Math.max(0, age - 30) * 0.4), f = 70, c = 50;
  let careerMult = 1, extraSpend = 0, extraSpendYears = 0, retired = false;
  let boss = null, cws = [], jobCountry = null;
  const friends = [newRole('fr', 'TW'), newRole('fr', 'TW'), newRole('fr', 'TW')];
  const kids = (fam.kids || []).map((a, i) => ({ id: 'kid' + i, age0: a, ks: null, gk: null }));
  const parents = fam.parents_age ? [{ id: 'father', age: fam.parents_age + 2, alive: true }, { id: 'mother', age: fam.parents_age, alive: true }] : [];
  const spouse = fam.spouse === false ? null : { age: P.age + (fam.spouse_age_gap || -2), alive: true };
  const done = new Set(), years = [], recent = [];
  const styleOf = cc => (cc === 'SGP' ? 'SG' : 'TW');
  const newJob = cc => { jobCountry = cc; boss = newRole('boss', styleOf(cc)); cws = [0, 1, 2].map(() => newRole('cw', styleOf(cc))); };
  newJob(phaseAt(opt, 0).country);
  for (let t = 0; t < 75; t++) {
    const year = P.start_year + t, ph = phaseAt(opt, t);
    W.stepWorld(D, world, rnd);
    Object.values(countries).forEach(cc => W.stepCountry(D, cc, world, rnd));
    const cty = countries[ph.country], ev = [], usedT = new Set();
    const alivePa = () => parents.filter(p => p.alive);
    const fill = s => s.replace('{cw}', '{' + pick(cws.length ? cws : friends, rnd) + '}').replace('{boss}', '{' + (boss || pick(friends, rnd)) + '}')
      .replace('{fr}', '{' + pick(friends, rnd) + '}').replace('{pa}', '{' + ((pick(alivePa(), rnd) || { id: 'mother' }).id) + '}');
    const add = (text, kind = '', eff = {}) => {
      ev.push([text, kind]);
      m += eff.m || 0; h = clamp(h + (eff.h || 0)); f = clamp(f + (eff.f || 0)); c = clamp(c + (eff.c || 0));
      if (eff.income) careerMult *= 1 + eff.income;
    };
    const fromPool = (pool, kind = '', eff = {}) => {
      for (let i = 0; i < 6; i++) { const tpl = pick(pool, rnd); if (usedT.has(tpl) || recent.includes(tpl)) continue; usedT.add(tpl); add(fill(tpl), kind, eff); return true; }
      return false;
    };
    if (!retired && ph.country !== jobCountry) { newJob(ph.country); add(fill(T.work.newJob)); }
    // 國家大事
    if (world.type === 'global') add(T.world.global, 'hit', { c: -3 });
    cty.events.forEach(e => {
      if (e === 'recession') add(retired ? T.world.recessionRetired(CITY[ph.country]) : T.world.recession(CITY[ph.country]), 'hit', retired ? { m: -5 } : { c: -2 });
      if (e === 'currency') { add(T.world.currency(CITY[ph.country]), 'hit'); m *= 0.88; }
      if (e === 'quake' && rnd() < 0.25) fromPool(T.world.quake);
      if (e === 'quake_big') { if (rnd() < 0.06) add(T.world.quakeDamage, 'hit', { m: -15 }); else fromPool(T.world.quake); }
      if ((e === 'typhoon' || e === 'typhoon_big') && rnd() < 0.3) fromPool(T.world.typhoon);
    });
    // 選項自己的事（寫報告那一步照報告內容填機率和影響）
    (opt.events || []).forEach(e => {
      if (t < e.at[0] || t > e.at[1] || (e.once && done.has(e.text)) || (e.group && done.has('g:' + e.group))) return;
      if (rnd() < e.p) { add(fill(e.text), e.kind || '', e.effect || {}); done.add(e.text); if (e.group) done.add('g:' + e.group); }
    });
    // 工作和收入
    if (!retired && age >= (P.retire_age || 63)) { retired = true; boss = null; cws = []; add(T.life.retire, 'big', { c: -10 }); }
    let income = 0;
    if (!retired) {
      if (rnd() < (cty.rec ? 0.06 : 0.015)) { add(cty.rec ? T.work.layoffRec : T.work.layoff, 'hit', { c: -8, h: -3 }); careerMult *= 0.92; income -= ph.income * careerMult * 0.4; newJob(ph.country); add(fill(T.work.newJob)); }
      const raise = 0.015 + Math.max(-0.03, cty.growth / 200) + (rnd() - 0.5) * 0.02 + (age < 50 ? 0.01 : 0);
      careerMult *= 1 + raise;
      if (raise > 0.045) fromPool(T.work.raise, '', { c: 2 });
      if (rnd() < 0.08) cws[Math.floor(rnd() * cws.length)] = newRole('cw', styleOf(ph.country));
      income += ph.income * careerMult;
      c = clamp(c + (age < 55 ? 1 : -0.5));
    } else income = (P.pension_monthly || 2.5) * 12;
    const spouseIncome = retired || !spouse || !spouse.alive ? 0 : (ph.spouse_income || 0);
    const kidsUni = kids.filter(k => k.age0 + t >= 18 && k.age0 + t <= 21).length * 25;
    // 金額一律用今天的錢算（實質）：收入、年金、開銷都不乘物價，存款的報酬也用扣掉通膨後的
    let spend = P.monthly_spend * 12 * (1 + Math.max(0, Math.min(age, 60) - P.age) * 0.01) + extraSpend * 12 + kidsUni;
    if (extraSpendYears > 0 && --extraSpendYears === 0) extraSpend = 0;
    if (retired) spend *= age >= 80 ? 0.65 : age >= 72 ? 0.75 : 0.85;  // 退休後花得少，越老越少
    const net = (income + spouseIncome) * (retired ? 1 : 0.85);
    // 存款見底就省著過：開銷壓到收入以內，不會一路欠到幾千萬
    if (m <= 0) { spend = Math.min(spend, net); if (!done.has('broke')) { add(T.life.broke, 'hit', { h: -2, f: -2 }); done.add('broke'); } }
    // 實質報酬約 2%，上下 2%；通膨超過 6% 的年頭存款被吃掉，貨幣危機那年再吃一成
    const realRet = 0.02 + (rnd() - 0.5) * 0.04 - Math.max(0, cty.infl - 6) / 100 - (cty.cur ? 0.1 : 0);
    m += net - spend + Math.max(0, m) * realRet;
    // 家人：里程碑、照顧、離世（生命表）
    kids.forEach(k => {
      const a = k.age0 + t;
      if (a >= 29 && !k.ks) k.ks = newRole('ks', 'TW');
      if (a >= 31 && !k.gk) k.gk = newRole('gk', 'TW');
      const ms = T.family.milestone[a];
      if (ms) add(ms[0].replace('{kid}', '{' + k.id + '}').replace('{ks}', '{' + (k.ks || 'fr1') + '}').replace('{gk}', '{' + (k.gk || 'fr1') + '}'), ms[1], { f: 3 });
    });
    parents.forEach(p => {
      if (!p.alive) return;
      const pa = p.age + t;
      if (!p.care && pa >= 74 && rnd() < (pa - 70) * 0.01) { p.care = true; add(T.family.parentCare.replace('{pa}', '{' + p.id + '}'), 'hit', { f: -3, h: -2 }); extraSpend = 2.5; extraSpendYears = 6; }
      if (rnd() < W.deathP(D, P.home, year, pa)) { p.alive = false; add(T.family.parentGone.replace('{pa}', '{' + p.id + '}'), 'hit', { f: -4 }); }
    });
    if (spouse && spouse.alive && rnd() < W.deathP(D, P.home, year, spouse.age + t)) { spouse.alive = false; add(T.family.spouseGone, 'hit', { f: -15, h: -5 }); }
    if (age > 70 && rnd() < 0.04) { const i = Math.floor(rnd() * friends.length); add(T.family.friendGone.replace('{fr}', '{' + friends[i] + '}'), 'hit', { f: -1 }); friends[i] = newRole('fr', 'TW'); }
    if (ph.family_together === false) { f = clamp(f - 5); fromPool(T.family.apart.map(s => s.replace('{kid}', '{' + (kids[0] ? kids[0].id : 'fr1') + '}'))); }
    // 健康
    h = clamp(h - (age < 50 ? 0.4 : age < 65 ? 0.9 : 1.6));
    if (rnd() < (age < 45 ? 0.05 : age < 60 ? 0.1 : 0.18)) { const big = rnd() < (age < 60 ? 0.15 : 0.3); fromPool(big ? T.health.big : T.health.small, big ? 'hit' : '', { h: big ? -12 : -4, m: big ? -10 : -1 }); }
    // 每年 5～15 件：照人生階段從各類事件補
    const target = 5 + Math.floor(rnd() * 11), pools = [];
    if (!retired) pools.push([T.work.pool, 4]);
    if (spouse && spouse.alive) pools.push([T.family.spouse, 2]);
    kids.forEach(k => {
      const a = k.age0 + t, sub = s => s.replace(/\{kid\}/g, '{' + k.id + '}').replace('{ks}', '{' + (k.ks || 'fr1') + '}');
      if (a < 7) pools.push([T.family.kidYoung.map(sub), 2]); else if (a < 13) pools.push([T.family.kidSchool.map(sub), 2]);
      else if (a < 19) pools.push([T.family.kidTeen.map(sub), 1.5]); else if (a < 45) pools.push([T.family.kidAdult.map(sub), 0.8]);
      if (k.gk && a >= 32 && a < 50) pools.push([T.family.gk.map(s => s.replace('{gk}', '{' + k.gk + '}')), 1]);
    });
    if (alivePa().length) pools.push([T.family.parent, 1]);
    pools.push([age < 68 ? T.family.friend : T.family.friendOld, 1.2], [T.life.small, 2], [T.health.good, age < 75 ? 0.5 : 0.1]);
    if (retired) pools.push([T.life.retired, 3]);
    if (age >= 75) pools.push([T.life.old.map(s => s.replace('{kid}', '{' + (kids[0] ? kids[0].id : 'fr1') + '}')), 2]);
    const tot = pools.reduce((s, p) => s + p[1], 0);
    for (let guard = 0; ev.length < target && guard < 40; guard++) {
      let r = rnd() * tot, pool = pools[0][0];
      for (const p of pools) { if ((r -= p[1]) <= 0) { pool = p[0]; break; } }
      fromPool(pool, '', pool === T.health.good ? { h: 2 } : pool === T.family.spouse ? { f: 1 } : {});
    }
    recent.splice(0, recent.length, ...usedT);
    const ladder = P.titles || ['專員', '主任', '經理', '處長', '協理', '副總'];
    const ti = Math.max(0, Math.min(ladder.length - 1, (P.title_index ?? 2) + Math.floor((c - 50) / 18)));
    const stage = a => a < 3 ? '在家' : a < 6 ? '念幼兒園' : a < 12 ? '念小學' : a < 15 ? '念國中' : a < 18 ? '念高中' : a < 22 ? '念大學' : '上班';
    const profile = {
      title: retired ? '退休' : ladder[ti], income: Math.round(retired ? income : income + 0), health: h >= 75 ? '很好' : h >= 55 ? '還不錯' : h >= 35 ? '常常不舒服' : '需要人照顧',
      sp: spouse ? { age: spouse.age + t, status: !spouse.alive ? '已過世' : retired ? '退休' : (ph.spouse_income || 0) > 0 ? '上班' : '在家' } : null,
      kids: kids.map(k => { const ka = k.age0 + t; return { age: ka, status: ka >= 30 && k.ks ? '已婚，另一半是{' + k.ks + '}' : stage(ka) }; }),
      parents: parents.map(pp => ({ id: pp.id, age: pp.age + t, status: !pp.alive ? '已過世' : pp.care ? '需要照顧' : pp.age + t >= 80 ? '身體還行' : '身體健康' })),
      boss: boss ? '{' + boss + '}' : '', cws: cws.map(x => '{' + x + '}'), friends: friends.map(x => '{' + x + '}')
    };
    if (retired) m = Math.max(0, m);
    years.push({ age, year, city: CITY[ph.country] || ph.country, events: ev, profile, stats: { m: Math.round(retired ? Math.max(0, m) : m), h: Math.round(h), f: Math.round(f), c: Math.round(c) } });
    if (rnd() < W.deathP(D, ph.country, year, age) * (h < 30 ? 1.6 : 1)) { years[years.length - 1].events.push([T.life.end(age), 'end']); break; }
    age++;
  }
  return { years, roles };
}

function scoreRun(years, goals) {
  const ten = years.slice(0, 10), last = ten[ten.length - 1].stats;
  const val = { career: ten.reduce((s, y) => s + y.stats.c, 0) / ten.length, family: ten.reduce((s, y) => s + y.stats.f, 0) / ten.length, wealth: last.m, health: last.h, life: years.length };
  return goals.map(g => val[g.metric] ?? 0).concat([val.life]);
}

// 換名字：現有的家人整份報告同一組（用戶 2026-11-03 同意）；之後認識的人，整份報告不重複
function nameLife(run, family, used, rnd) {
  const map = Object.assign({}, family);
  Object.entries(run.roles).forEach(([id, r]) => { map[id] = NM.make(r.style, r.g, rnd, used, r.kind === 'gk' ? family.__sur : null); });
  const sub = s => s.replace(/\{([a-z]+\d*)\}/g, (_, id) => map[id] || '家人');
  run.years.forEach(y => {
    y.events = y.events.map(e => [sub(e[0]), e[1]]);
    const pr = y.profile; pr.boss = sub(pr.boss); pr.cws = pr.cws.map(sub); pr.friends = pr.friends.map(sub);
    pr.kids.forEach(k => { k.status = sub(k.status); });
  });
}

function summarize(run) {
  const years = run.years;
  const mood = y => y.events.reduce((s, e) => s + (e[1] === 'big' ? 2 : e[1] === 'hit' || e[1] === 'end' ? -2 : 0.15), 0);
  const ys = years.map(y => ({ ...y, mood: Math.round(mood(y) * 10) / 10 }));
  const allEv = years.flatMap(y => y.events.map(e => [y.age, e[0], e[1]]));
  const best = ys.reduce((a, b) => (b.mood > a.mood ? b : a)), worst = ys.reduce((a, b) => (b.mood < a.mood ? b : a));
  const end = years[years.length - 1].age;
  return {
    end, years: ys, map: ys.map(y => y.mood),
    card: { end, peak: Math.max(...years.map(y => y.stats.m)), left: years[years.length - 1].stats.m, big: allEv.filter(e => e[2] === 'big').slice(0, 5).map(e => e[0] + ' 歲：' + e[1]),
      best: best.age + ' 歲：' + (best.events.find(e => e[1] === 'big') || best.events[0])[0],
      worst: worst.age + ' 歲：' + (worst.events.find(e => e[1] === 'hit' || e[1] === 'end') || worst.events[0])[0] }
  };
}

function main() {
  const [pf, outf] = process.argv.slice(2);
  const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? +process.argv[i + 1] : d; };
  const N = arg('--runs', 500), seed0 = arg('--seed', 1);
  const P = JSON.parse(fs.readFileSync(pf, 'utf8'));
  const D = W.load([...new Set([P.home, ...P.options.flatMap(o => o.phases.map(p => p.country))])]);
  const nr = rng(seed0 * 7 + 3), used = new Set(), fam = P.family || {};
  const sur = NM.TW_SUR[Math.floor(nr() * NM.TW_SUR.length)];
  const family = { __sur: sur, sp: NM.make('TW', fam.spouse_gender || 'F', nr, used), father: NM.make('TW', 'M', nr, used, sur), mother: NM.make('TW', 'F', nr, used) };
  (fam.kids || []).forEach((a, i) => { family['kid' + i] = NM.make('TW', nr() < 0.5 ? 'M' : 'F', nr, used, sur); });
  const out = { case: P.case, generated: new Date().toISOString().slice(0, 10), runs: N, start_age: P.age, kids: fam.kids || [],
    family: [['另一半', family.sp], ...(fam.kids || []).map((a, i) => [(fam.kids.length > 1 ? (i === 0 ? '小的' : '大的') : '小孩') + '（' + a + ' 歲）', family['kid' + i]]), ['爸爸', family.father], ['媽媽', family.mother]],
    options: [] };
  const all = [];
  P.options.forEach((opt, oi) => {
    const runs = [];
    for (let r = 0; r < N; r++) { const run = runOnce(D, P, opt, seed0 * 100000 + oi * 10000 + r); runs.push({ run, raw: scoreRun(run.years, P.goals) }); }
    out.options.push({ id: opt.id, name: opt.name, sub: opt.sub || '', runs }); all.push(...runs);
  });
  const weights = [3, 2, 1];
  [...P.goals, { metric: 'life' }].forEach((g, gi) => {
    const sorted = all.map(r => r.raw[gi]).sort((a, b) => a - b);
    all.forEach(r => { r.pct = r.pct || []; r.pct[gi] = sorted.findIndex(v => v >= r.raw[gi]) / sorted.length; });
  });
  // 壽命占 3，和最重要的目標一樣重（用戶 2026-11-03：運氣好的那段不該比較短命）
  all.forEach(r => { r.score = r.pct.reduce((s, p, i) => s + p * (i < 3 ? weights[i] : 3), 0); });
  const medians = [];
  out.options.forEach(o => {
    const s = o.runs.slice().sort((a, b) => a.score - b.score), at = q => s[Math.round(q * (s.length - 1))];
    medians.push(at(0.5).score);
    // 在前後 5% 的範圍裡挑：好的那段活得不短於中位數，壞的那段不比好的那段長命；找不到就用正中那次
    const lifeMed = s.map(r => r.run.years.length).sort((a, b) => a - b)[s.length >> 1];
    const pick = (q, ok) => { const lo = Math.round((q - 0.05) * (s.length - 1)), hi = Math.round((q + 0.05) * (s.length - 1)), mid = Math.round(q * (s.length - 1));
      let best = null; for (let i = lo; i <= hi; i++) if (ok(s[i]) && (!best || Math.abs(i - mid) < Math.abs(best[0] - mid))) best = [i, s[i]];
      return (best ? best[1] : s[mid]).run; };
    const good = pick(0.8, r => r.run.years.length >= lifeMed), bad = pick(0.2, r => r.run.years.length <= good.years.length);
    [['good', good], ['bad', bad]].forEach(([k, run]) => { nameLife(run, family, used, nr); o[k] = summarize(run); });
    o.median_score = Math.round(medians[medians.length - 1] * 100) / 100;
    delete o.runs;
  });
  out.quote_kind = Math.max(...medians) - Math.min(...medians) < 0.6 ? 'A1' : 'A2';
  fs.writeFileSync(outf, JSON.stringify(out));
  console.log('寫好', outf, out.options.map(o => o.id + ' 好 ' + o.good.end + ' 歲／壞 ' + o.bad.end + ' 歲').join('；'), out.quote_kind);
}
main();
