// 人生模擬引擎（v1.1）：每個選項跑 N 次，照用戶排的三個目標打分，挑第 80、20 百分位附近當運氣好、運氣差。
// 每年 5～15 件事，一路到過世；事件裡的人都有名字（names.js）。人生選擇一律保守，好壞只來自外在的運氣。
// 用法：node simulate.js <人生模擬參數.json> <人生模擬.json> [--runs 500] [--seed 1]
const fs = require('fs');
const W = require('./world.js');
const T = require('./texts.js');
const NM = require('./names.js');

// 可以調的假設都放這裡，不散在流程裡（嚴審 2026-11-05）
const CFG = {
  careerDeclineAfter55: 0.5,   // 55 歲後事業數值每年少多少
  careYears: 6, careCostYear: 30,  // 照顧爸媽：每人最多幾年、一年多少萬
  wedNever: 0.15, wedFrom: 27, wedSpan: 9,  // 小孩一成五不結婚，27～35 歲結婚
  noBaby: 0.2, babyAfterWed: [1, 4],        // 婚後兩成不生，1～4 年生
  realReturn: 0.02, realReturnSpread: 0.04  // 存款的實質報酬和上下幅度
};

function rng(seed) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const clamp = (v, lo = 3, hi = 100) => Math.max(lo, Math.min(hi, v));
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
// 地名：200 國資料的中文名（countries.csv 的 name_zh），找不到才用代碼
const CITY = (() => {
  const p = require('path').resolve(__dirname, '..', '..', '1in8b-research', 'country-data', 'data', 'countries.csv');
  const out = { TWN: '台灣', SGP: '新加坡' };
  try {
    const lines = fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, '').split('\n');
    const head = lines[0].split(','), iI = head.indexOf('iso3'), iZ = head.indexOf('name_zh');
    lines.slice(1).forEach(l => { const c = l.split(','); if (c[iI] && c[iZ] && !out[c[iI]]) out[c[iI]] = c[iZ]; });
  } catch (e) { /* 沒有資料檔就只有台灣、新加坡 */ }
  return out;
})();
function phaseAt(opt, t) { return opt.phases.find(p => t >= p.from && t < p.to) || opt.phases[opt.phases.length - 1]; }

// 一段人生：角色用代號記（cw3、boss2、fr1…），挑出要給人看的那幾段才換成名字
function runOnce(D, P, opt, seed) {
  const rnd = rng(seed);
  const isos = [...new Set([P.home, ...opt.phases.map(p => p.country)])];
  const countries = {}; isos.forEach(i => { countries[i] = W.initCountry(D, i); });
  const world = { type: 'normal' }, fam = P.family || {};
  const roles = {}; let nid = 0;
  const newRole = (kind, style) => { const id = kind + (++nid); roles[id] = { kind, style, g: rnd() < 0.5 ? 'M' : 'F' }; return id; };
  // 性別只定一次（嚴審 2026-11-05）：你、另一半、爸媽照參數，壽命、稱謂、畫面都讀它
  const sexMe = P.gender || 'M', sexSp = fam.spouse_gender || (sexMe === 'M' ? 'F' : 'M');
  let age = P.age, m = P.savings, h = clamp(88 - Math.max(0, age - 30) * 0.4), f = 70, c = 50;
  let careerMult = 1, retired = false;
  const ladder = P.titles || ['專員', '主任', '經理', '處長', '協理', '副總'];
  let tIdx = Math.min(ladder.length - 1, P.title_index ?? 2);
  let boss = null, cws = [], jobCountry = null;
  const friends = [newRole('fr', 'TW'), newRole('fr', 'TW'), newRole('fr', 'TW')];
  // 小孩什麼時候結婚、生小孩，每段人生各抽一次（假設：27～35 歲結婚，一成五不結婚；婚後 1～4 年生，兩成不生）
  const kids = (fam.kids || []).map((a, i) => {
    const wed = rnd() < CFG.wedNever ? null : CFG.wedFrom + Math.floor(rnd() * CFG.wedSpan);
    const [b0, b1] = CFG.babyAfterWed;
    return { id: 'kid' + i, sex: (P.__kidSex || [])[i], age0: a, ks: null, gk: null, wed, baby: wed && rnd() >= CFG.noBaby ? wed + b0 + Math.floor(rnd() * (b1 - b0 + 1)) : null };
  });
  const parents = fam.parents_age ? [{ id: 'father', sex: 'M', age: fam.parents_age + 2, alive: true, careYears: 0 }, { id: 'mother', sex: 'F', age: fam.parents_age, alive: true, careYears: 0 }] : [];
  const spouse = fam.spouse === false ? null : { age: P.age + (fam.spouse_age_gap || -2), alive: true };
  const done = new Set(), years = [], recent = [];
  let sameCompany = true;  // 被裁員換過公司，就不再是當初那家公司（調回、合約裡的升遷都跟著失效）
  // 選項自己有寫升遷的事時，那段期間引擎不另外隨機升遷，免得「剛升處長，隔年又說升處長的保證沒了」
  const promoWindowEnd = Math.max(-1, ...(opt.events || []).filter(e => e.effect && e.effect.title).map(e => e.at[1]));
  const styleOf = NM.styleOf;
  // 自己做生意：沒有主管、不會被裁員、不隨機升遷（職稱只跟著選項自己的事變），一起做事的人放在 cws
  const SELF = P.work_type === 'self', TW = SELF ? T.self : T.work;
  const newJob = cc => { jobCountry = cc; boss = SELF ? null : newRole('boss', styleOf(cc)); cws = [0, 1, 2].map(() => newRole('cw', styleOf(cc))); };
  newJob(phaseAt(opt, 0).country);
  for (let t = 0; t < 75; t++) {
    const year = P.start_year + t, ph = phaseAt(opt, t);
    W.stepWorld(D, world, rnd);
    Object.values(countries).forEach(cc => W.stepCountry(D, cc, world, rnd));
    const cty = countries[ph.country], ev = [], usedT = new Set();
    let promotedThisYear = false;
    const alivePa = () => parents.filter(p => p.alive);
    const fill = s => s.replace('{cw}', '{' + pick(cws.length ? cws : friends, rnd) + '}').replace('{boss}', '{' + (boss || pick(friends, rnd)) + '}')
      .replace('{fr}', '{' + pick(friends, rnd) + '}').replace('{pa}', '{' + ((pick(alivePa(), rnd) || { id: 'mother' }).id) + '}').replace('{grand}', sexMe === 'F' ? '阿嬤' : '阿公');
    const add = (text, kind = '', eff = {}, w) => {
      ev.push([text, kind, w ?? (kind === 'big' ? 2 : kind === 'hit' ? -2 : 0)]);
      m += eff.m || 0; h = clamp(h + (eff.h || 0)); f = clamp(f + (eff.f || 0)); c = clamp(c + (eff.c || 0));
      if (eff.income) careerMult *= 1 + eff.income;
      if (eff.title && ladder.indexOf(eff.title) > tIdx) { tIdx = ladder.indexOf(eff.title); promotedThisYear = true; }
    };
    const fromPool = (pool, kind = '', eff = {}) => {
      for (let i = 0; i < 6; i++) { const tpl = pick(pool, rnd); if (usedT.has(tpl) || recent.includes(tpl)) continue; usedT.add(tpl); add(fill(tpl), kind, eff); return true; }
      return false;
    };
    // 換國家是同一家公司調派，不是換公司（嚴審 F2）
    if (!retired && ph.country !== jobCountry) { newJob(ph.country); add(fill(SELF ? T.self.move(CITY[ph.country] || ph.country) : !sameCompany ? T.work.newJob : ph.country === P.home ? T.work.transferHome(CITY[ph.country] || ph.country) : T.work.transfer(CITY[ph.country] || ph.country)), '', {}, 0); }
    // 國家大事
    if (world.type === 'global') add(T.world.global, 'hit', { c: -3 }, -1.5);
    cty.events.forEach(e => {
      if (e === 'recession') add(retired ? T.world.recessionRetired(CITY[ph.country]) : (SELF ? T.self : T.world).recession(CITY[ph.country]), 'hit', retired ? { m: -5 } : { c: -2 }, -1);
      if (e === 'currency') { add(T.world.currency(CITY[ph.country]), 'hit', {}, -2); m *= 0.88; }
      if (e === 'quake' && rnd() < 0.25) fromPool(T.world.quake);
      if (e === 'quake_big') { if (rnd() < 0.06) add(T.world.quakeDamage, 'hit', { m: -15 }, -2); else fromPool(T.world.quake); }
      if ((e === 'typhoon' || e === 'typhoon_big') && rnd() < 0.3) fromPool(T.world.typhoon);
    });
    // 選項自己的事（寫報告那一步照報告內容填機率和影響）
    (opt.events || []).forEach(e => {
      if (t < e.at[0] || t > e.at[1] || (e.once && done.has(e.text)) || (e.group && done.has('g:' + e.group))) return;
      // 參數可以加條件：same_company 只有還在原公司才會發生；below_title 只有職稱還沒到那一級才會發生
      if (e.same_company && !sameCompany) return;
      if (e.below_title && tIdx >= ladder.indexOf(e.below_title)) return;
      if (rnd() < e.p) { add(fill(e.text), e.kind || '', e.effect || {}); done.add(e.text); if (e.group) done.add('g:' + e.group); }
    });
    // 工作和收入
    if (!retired && age >= (P.retire_age || 63)) { retired = true; boss = null; cws = []; add(T.life.retire, 'big', { c: -10 }, 1); }
    let income = 0;
    if (!retired) {
      if (SELF && rnd() < (cty.rec ? 0.06 : 0.015)) { add(cty.rec ? T.self.slumpRec : T.self.slump, 'hit', { c: -8, h: -3 }, -4); careerMult *= 0.92; income -= ph.income * careerMult * 0.4; }
      else if (!SELF && rnd() < (cty.rec ? 0.06 : 0.015)) { sameCompany = false; add(cty.rec ? T.work.layoffRec : T.work.layoff, 'hit', { c: -8, h: -3 }, -4); careerMult *= 0.92; income -= ph.income * careerMult * 0.4; newJob(ph.country); add(fill(T.work.newJob)); }
      const raise = 0.015 + Math.max(-0.03, cty.growth / 200) + (rnd() - 0.5) * 0.02 + (age < 50 ? 0.01 : 0);
      careerMult *= 1 + raise;
      if (raise > 0.045) fromPool(TW.raise, '', { c: 2 });
      // 升遷機率看事業數值，職位越高越難升
      if (!SELF && t > promoWindowEnd && !promotedThisYear && tIdx < ladder.length - 1 && rnd() < (Math.max(0, (c - 60) / 400) + (age < 55 ? 0.02 : 0.005)) / (tIdx + 1)) { tIdx++; add(T.work.promote(ladder[tIdx]), 'big', { c: 3, income: 0.1 }, 3); }
      if (rnd() < 0.08) cws[Math.floor(rnd() * cws.length)] = newRole('cw', styleOf(ph.country));
      income += ph.income * careerMult;
      c = clamp(c + (age < 55 ? 1 : -CFG.careerDeclineAfter55));
    } else income = (P.pension_monthly || 2.5) * 12;
    const spouseIncome = retired || !spouse || !spouse.alive ? 0 : (ph.spouse_income || 0);
    const kidsUni = kids.filter(k => k.age0 + t >= 18 && k.age0 + t <= 21).length * 25;
    // 照顧爸媽的開銷：每人最多 6 年，人走了就停（嚴審 F17）
    const careCost = parents.reduce((s, p) => { if (p.alive && p.careYears > 0) { p.careYears--; return s + CFG.careCostYear; } return s; }, 0);
    // 金額一律用今天的錢算（實質）：收入、年金、開銷都不乘物價，存款的報酬也用扣掉通膨後的
    let spend = P.monthly_spend * 12 * (1 + Math.max(0, Math.min(age, 60) - P.age) * 0.01) + careCost + kidsUni;
    if (retired) spend *= age >= 80 ? 0.65 : age >= 72 ? 0.75 : 0.85;  // 退休後花得少，越老越少
    const net = (income + spouseIncome) * (retired ? 1 : 0.85);
    // 存款見底就省著過：開銷壓到收入以內，不會一路欠到幾千萬
    if (m <= 0) { spend = Math.min(spend, net); if (!done.has('broke')) { add(T.life.broke, 'hit', { h: -2, f: -2 }, -3); done.add('broke'); } }
    // 實質報酬約 2%，上下 2%；通膨超過 6% 的年頭存款被吃掉，貨幣危機那年再吃一成
    const realRet = CFG.realReturn + (rnd() - 0.5) * CFG.realReturnSpread - Math.max(0, cty.infl - 6) / 100 - (cty.cur ? 0.1 : 0);
    m += net - spend + Math.max(0, m) * realRet;
    // 家人：里程碑、照顧、離世（生命表）
    kids.forEach(k => {
      const a = k.age0 + t;
      if (k.wed && a >= k.wed - 2 && !k.ks) { k.ks = newRole('ks', 'TW'); roles[k.ks].g = k.sex === 'F' ? 'M' : 'F'; }
      if (k.baby && a >= k.baby && !k.gk) { k.gk = newRole('gk', 'TW'); roles[k.gk].kid = k; }
      const ms = T.family.milestone[a];
      if (ms) add(ms[0].replace('{kid}', '{' + k.id + '}'), ms[1], { f: 3 });
      if (k.wed === a) add(T.family.wed.replace('{kid}', '{' + k.id + '}').replace('{ks}', '{' + k.ks + '}'), 'big', { f: 3 }, 3);
      if (k.baby === a) add(T.family.baby.replace('{kid}', '{' + k.id + '}').replace('{gk}', '{' + k.gk + '}'), 'big', { f: 4 }, 3);
    });
    parents.forEach(p => {
      if (!p.alive) return;
      const pa = p.age + t;
      if (!p.care && pa >= 74 && rnd() < (pa - 70) * 0.01) { p.care = true; p.careYears = CFG.careYears; add(T.family.parentCare.replace('{pa}', '{' + p.id + '}'), 'hit', { f: -3, h: -2 }, -2); }
      if (rnd() < W.deathP(D, P.home, year, pa, p.sex)) { p.alive = false; add(T.family.parentGone.replace('{pa}', '{' + p.id + '}'), 'hit', { f: -4 }, -5); }
    });
    if (spouse && spouse.alive && rnd() < W.deathP(D, P.home, year, spouse.age + t, sexSp)) { spouse.alive = false; add(T.family.spouseGone, 'hit', { f: -15, h: -5 }, -8); }
    if (age > 70 && rnd() < 0.04) { const i = Math.floor(rnd() * friends.length); add(T.family.friendGone.replace('{fr}', '{' + friends[i] + '}'), 'hit', { f: -1 }, -1.5); friends[i] = newRole('fr', 'TW'); }
    if (ph.family_together === false) { f = clamp(f - 5); fromPool(T.family.apart.map(s => s.replace('{kid}', '{' + (kids[0] ? kids[0].id : 'fr1') + '}'))); }
    // 健康
    h = clamp(h - (age < 50 ? 0.4 : age < 65 ? 0.9 : 1.6));
    if (rnd() < (age < 45 ? 0.05 : age < 60 ? 0.1 : 0.18)) { const big = rnd() < (age < 60 ? 0.15 : 0.3); const got = fromPool(big ? T.health.big : T.health.small, big ? 'hit' : '', { h: big ? -12 : -4, m: big ? -10 : -1 }); if (big && got) ev[ev.length - 1][2] = -4; }
    // 每年 5～15 件：照人生階段從各類事件補
    const target = 5 + Math.floor(rnd() * 11), pools = [];
    if (!retired) pools.push([TW.pool, 4]);
    if (spouse && spouse.alive) pools.push([T.family.spouse, 2]);
    kids.forEach(k => {
      const a = k.age0 + t, sub = s => s.replace(/\{kid\}/g, '{' + k.id + '}').replace('{ks}', '{' + k.ks + '}');
      if (a < 7) pools.push([T.family.kidYoung.map(sub), 2]); else if (a < 13) pools.push([T.family.kidSchool.map(sub), 2]);
      else if (a < 19) pools.push([T.family.kidTeen.map(sub), 1.5]); else if (a < 45) pools.push([T.family.kidAdult.filter(s => k.ks || !s.includes('{ks}')).map(sub), 0.8]);
      if (k.gk && a > k.baby && a < k.baby + 18) pools.push([T.family.gk.map(s => s.replace('{gk}', '{' + k.gk + '}')), 1]);
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
    const stage = a => a < 3 ? '在家' : a < 6 ? '念幼兒園' : a < 12 ? '念小學' : a < 15 ? '念國中' : a < 18 ? '念高中' : a < 22 ? '念大學' : '上班';
    const profile = {
      title: retired ? '退休' : ladder[tIdx], income: Math.round(income), pension: retired, health: h >= 75 ? '很好' : h >= 55 ? '還不錯' : h >= 35 ? '常常不舒服' : '需要人照顧',
      sp: spouse ? { age: spouse.age + t, status: !spouse.alive ? '已過世' : retired ? '退休' : (ph.spouse_income || 0) > 0 ? '上班' : '在家' } : null,
      kids: kids.map(k => { const ka = k.age0 + t; return { age: ka, status: k.wed && ka >= k.wed ? '已婚，另一半是{' + k.ks + '}' + (k.baby && ka >= k.baby ? '，有一個小孩' : '') : stage(ka) }; }),
      parents: parents.map(pp => ({ id: pp.id, age: pp.age + t, status: !pp.alive ? '已過世' : pp.care ? '需要照顧' : pp.age + t >= 80 ? '身體還行' : '身體健康' })),
      boss: boss ? '{' + boss + '}' : '', cwl: SELF ? '一起做事的人' : '', cws: cws.map(x => '{' + x + '}'), friends: friends.map(x => '{' + x + '}')
    };
    if (retired) m = Math.max(0, m);
    years.push({ age, year, city: CITY[ph.country] || ph.country, events: ev, profile, stats: { m: Math.round(retired ? Math.max(0, m) : m), h: Math.round(h), f: Math.round(f), c: Math.round(c) } });
    if (rnd() < W.deathP(D, ph.country, year, age, sexMe) * (h < 30 ? 1.6 : 1)) { years[years.length - 1].events.push([T.life.end(age), 'end', 0]); break; }
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
  Object.entries(run.roles).filter(([, r]) => r.kind !== 'gk').forEach(([id, r]) => { map[id] = NM.make(r.style, r.g, rnd, used, null); });
  Object.entries(run.roles).filter(([, r]) => r.kind === 'gk').forEach(([id, r]) => { map[id] = NM.make('TW', r.g, rnd, used, r.kid.sex === 'F' && r.kid.ks ? map[r.kid.ks][0] : family.__sur); });
  const sub = s => s.replace(/\{([a-z]+\d*)\}/g, (_, id) => map[id] || '家人');
  run.years.forEach(y => {
    y.events = y.events.map(e => [sub(e[0]), e[1], e[2]]);
    const pr = y.profile; pr.boss = sub(pr.boss); pr.cws = pr.cws.map(sub); pr.friends = pr.friends.map(sub);
    pr.kids.forEach(k => { k.status = sub(k.status); });
  });
}

function summarize(run) {
  const years = run.years;
  // 一年順不順只看大事的權重（普通的事是 0），事多的年不會因此看起來比較順
  const mood = y => y.events.reduce((s, e) => s + (e[2] || 0), 0);
  const ys = years.map(y => ({ ...y, mood: Math.round(mood(y) * 10) / 10 }));
  const end = years[years.length - 1].age;
  // 大事：每 10 年挑權重最高的一件，再補最重的，最多 5 件，照年紀排
  const goods = years.flatMap(y => y.events.filter(e => e[2] > 0).map(e => ({ age: y.age, text: e[0], w: e[2] })));
  const byDec = {}; goods.forEach(g => { const d = Math.floor(g.age / 10); if (!byDec[d] || g.w > byDec[d].w) byDec[d] = g; });
  let big = Object.values(byDec).sort((a, b) => b.w - a.w).slice(0, 5);
  goods.slice().sort((a, b) => b.w - a.w).forEach(g => { if (big.length < 5 && !big.includes(g)) big.push(g); });
  big = big.sort((a, b) => a.age - b.age).map(g => g.age + ' 歲：' + g.text);
  const best = ys.reduce((a, b) => (b.mood > a.mood ? b : a)), worst = ys.reduce((a, b) => (b.mood < a.mood ? b : a));
  const top = (y, sign) => y.events.slice().sort((a, b) => sign * ((b[2] || 0) - (a[2] || 0)))[0];
  return {
    end, years: ys, map: ys.map(y => y.mood),
    card: { end, peak: Math.max(...years.map(y => y.stats.m)), left: years[years.length - 1].stats.m, big,
      best: best.age + ' 歲：' + top(best, 1)[0], worst: worst.age + ' 歲：' + top(worst, -1)[0] }
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
  const sexMe = P.gender || 'M', sexSp = fam.spouse_gender || (sexMe === 'M' ? 'F' : 'M');
  const family = { sp: NM.make('TW', sexSp, nr, used), father: NM.make('TW', 'M', nr, used, sur), mother: NM.make('TW', 'F', nr, used) };
  // 小孩跟爸爸姓：你是男生就是你的姓（=你爸爸的姓），你是女生就是另一半的姓
  family.__sur = sexMe === 'M' ? sur : family.sp[0];
  const kidSex = (fam.kids || []).map(() => (nr() < 0.5 ? 'M' : 'F'));
  kidSex.forEach((g, i) => { family['kid' + i] = NM.make('TW', g, nr, used, family.__sur); });
  P.__kidSex = kidSex;
  // 小孩的稱呼照年紀排：老大、老二、老三…（嚴審 F7）
  const order = (fam.kids || []).map((a, i) => i).sort((x, y) => fam.kids[y] - fam.kids[x]);
  const kidLabel = i => (fam.kids.length === 1 ? '小孩' : ['老大', '老二', '老三', '老四', '老五'][order.indexOf(i)] || '小孩');
  // 記下用的是哪一版國家資料（每週資料管線會換規則，例如 2026-11-14 地震改成只算淺層），客人問「怎麼跟上次不一樣」查得到
  const EST = require('path').resolve(__dirname, '..', '..', '1in8b-research', 'country-data', 'estimated');
  const readJ = f => { try { return JSON.parse(fs.readFileSync(require('path').join(EST, f), 'utf8')); } catch (e) { console.warn('讀不到 ' + f + '，報告的資料版本會記成 null'); return {}; } };
  // rules_version 直接讀模擬實際用的 rules.json；version 讀 VERSION.json（整份資料的發布號）
  const ver = { version: readJ('VERSION.json').version, rules_version: readJ('trends/rules.json').rules_version };
  const out = { case: P.case, generated: new Date().toISOString().slice(0, 10), runs: N, start_age: P.age, kids: fam.kids || [], gender: sexMe,
    data_version: ver.version || null, rules_version: ver.rules_version || null,
    family: [['另一半', family.sp, sexSp], ...(fam.kids || []).map((a, i) => [kidLabel(i), family['kid' + i], kidSex[i]]), ['爸爸', family.father, 'M'], ['媽媽', family.mother, 'F']],
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
      const hit = best || [mid, s[mid]]; return { run: hit[1].run, pct: Math.round(hit[0] / (s.length - 1) * 100) }; };
    const good = pick(0.8, r => r.run.years.length >= lifeMed), bad = pick(0.2, r => r.run.years.length <= good.run.years.length);
    [['good', good], ['bad', bad]].forEach(([k, g]) => { nameLife(g.run, family, used, nr); o[k] = summarize(g.run); o[k].pct = g.pct; });
    // 500 次的分布，給畫面寫「中位數」「活到 80 歲以上的有幾成」
    const ends = o.runs.map(r => r.run.years[r.run.years.length - 1].age).sort((a, b) => a - b);
    const lefts = o.runs.map(r => r.run.years[r.run.years.length - 1].stats.m).sort((a, b) => a - b);
    o.dist = { medEnd: ends[ends.length >> 1], medLeft: Math.round(lefts[lefts.length >> 1]), over80: Math.round(ends.filter(a => a >= 80).length / ends.length * 100) };
    o.median_score = Math.round(medians[medians.length - 1] * 100) / 100;
    delete o.runs;
  });
  out.quote_kind = Math.max(...medians) - Math.min(...medians) < 0.6 ? 'A1' : 'A2';
  // 播完之後的三句話（quotes/句子規格.md 第一節）：A1 或 A2 一句、B 或 C 一句、D 或 E 一句。
  // 參數 sensitive（重病、喪親、離婚、債務、失業）時不出 A1、E；危機情況根本不會跑到這裡（第 0 級不做模擬）。
  const Qd = require('path').join(__dirname, 'quotes');
  const lines = k => fs.readFileSync(require('path').join(Qd, k + '.md'), 'utf8').split('\n').map(l => l.replace('\r', '').split('｜'))
    .filter(c => /^[A-E]\d?-\d+$/.test(c[0]) && c[4] !== '不適合脆弱的人').map(c => ({ id: c[0], text: c[1] }));
  const qr = rng(seed0 * 31 + 7), qpick = k => { const L = lines(k); return Object.assign({ kind: k }, L[Math.floor(qr() * L.length)]); };
  const kA = P.sensitive && out.quote_kind === 'A1' ? 'C' : out.quote_kind;
  const kB = kA === 'C' ? 'B' : (qr() < 0.5 ? 'B' : 'C');
  const kD = P.sensitive ? 'D' : (P.has_actions === false || out.quote_kind === 'A1') ? 'E' : 'D';
  out.quotes = [qpick(kA), qpick(kB), qpick(kD)];
  fs.writeFileSync(outf, JSON.stringify(out));
  console.log('寫好', outf, out.options.map(o => o.id + ' 好 ' + o.good.end + ' 歲／壞 ' + o.bad.end + ' 歲').join('；'), out.quote_kind);
}
main();
