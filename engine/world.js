// 國家這一年怎麼了：照 1in8b-research/country-data/estimated/trends 的規則擲骰。
// v1 做：全球衰退、衰退和成長、貨幣危機、通膨、天災、生命表。還沒做：戰爭、政變、組織性暴力、倒債（之後照 rules.md 補）。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const DATA = path.resolve(__dirname, '..', '..', '1in8b-research', 'country-data', 'estimated', 'trends');
const TIERS = ['低所得', '中低所得', '中高所得', '高所得'];
const BANDS = ['<2%', '2–5%', '5–10%', '10–20%', '20–40%', '≥40%'];

function csv(file) {
  const lines = fs.readFileSync(file, 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/);
  const head = lines[0].split(',');
  return lines.slice(1).map(l => {
    const cells = l.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map(c => c.replace(/,$/, '').replace(/^"|"$/g, ''));
    const o = {}; head.forEach((h, i) => { o[h] = cells[i]; }); return o;
  });
}

// 分位數之間線性內插
function fromQuantiles(qs, vals, u) {
  if (u <= qs[0]) return vals[0];
  for (let i = 1; i < qs.length; i++) if (u <= qs[i]) return vals[i - 1] + (vals[i] - vals[i - 1]) * (u - qs[i - 1]) / (qs[i] - qs[i - 1]);
  return vals[vals.length - 1];
}

// table 規則：從 keys 最多的那層找完全對得上的列，找不到就去掉最後一個 key
function lookup(rule, state) {
  const keys = rule.keys || [];
  for (let n = keys.length; n >= 0; n--) {
    const want = keys.slice(0, n);
    const row = rule.rows.find(r => Object.keys(r.keys).length === n && want.every(k => r.keys[k] === state[k]));
    if (row) return row.p;
  }
  return 0;
}

function load(isos) {
  const rules = JSON.parse(fs.readFileSync(path.join(DATA, 'rules.json'), 'utf8'));
  const R = {}; rules.rules.forEach(r => { R[r.id] = r; });
  const start = {}; csv(path.join(DATA, 'start_state.csv')).forEach(r => { if (isos.includes(r.iso3)) start[r.iso3] = r; });
  const haz = {}; csv(path.join(DATA, 'country_hazards.csv')).forEach(r => { if (isos.includes(r.iso3)) haz[r.iso3] = r; });
  const life = {};
  const text = zlib.gunzipSync(fs.readFileSync(path.join(DATA, 'life_tables.csv.gz'))).toString('utf8');
  for (const line of text.split('\n')) {
    const iso = line.slice(0, 3);
    if (!isos.includes(iso)) continue;
    const c = line.split(',');
    const key = iso + '|' + c[1] + '|' + c[2];
    life[key] = c.slice(5).map(Number);
  }
  isos.forEach(i => { if (!start[i]) throw new Error('200 國資料裡沒有 ' + i); });
  return { R, start, haz, life };
}

function tierOf(lvl) { return lvl <= 1000 ? 0 : lvl <= 4150 ? 1 : lvl <= 13250 ? 2 : 3; }
function muOf(curve, lvl) {
  const x = Math.log(lvl);
  const pts = curve.map(p => [Math.log(p.center_2015usd), p.mu]);
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * (x - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
  return pts[pts.length - 1][1];
}

// 一個國家的狀態，一年往前走一步
function initCountry(D, iso) {
  const s = D.start[iso];
  return { iso, lvl: +s.lvl, cur: +s.cur, rec: +s.rec, recRun: +s.rec_run || 0, dev: +s.m || 0, band: +s.band || 1, infl: +s.infl || 2 };
}

function stepWorld(D, w, rnd) {
  // 全球：一般年、全球衰退年、隔年反彈
  if (w.type === 'global') w.type = 'rebound';
  else w.type = rnd() < D.R['world.global_recession'].p ? 'global' : 'normal';
  if (w.type === 'global') w.analog = rnd() < 0.5 ? '2009' : '2020';
  return w;
}

function stepCountry(D, c, w, rnd) {
  const R = D.R, tier = tierOf(c.lvl), ev = [];
  // 貨幣危機
  const wasCur = c.cur;
  c.cur = wasCur ? (rnd() < lookup(R['currency.continue'], {}) ? 1 : 0) : (rnd() < lookup(R['currency.onset'], { tier, infl_hi: c.band >= 4 ? 1 : 0 }) ? 1 : 0);
  if (c.cur && !wasCur) ev.push('currency');
  // 通膨：v1 先照現在的級距，有貨幣危機升兩級；數字從分位數抽
  let band = Math.min(5, c.band + (c.cur ? 2 : 0));
  const iv = R['inflation.values'];
  c.infl = fromQuantiles(iv.quantiles, iv.by_band[BANDS[band]].q, rnd());
  // 衰退和成長（人均，%）
  const mu = muOf(R['growth.normal'].curve, c.lvl);
  let g, rec = 0;
  if (w.type === 'global' || w.type === 'rebound') {
    const a = R['world.analog'].analogs[w.analog || '2009'][w.type === 'global' ? '全球衰退年' : '隔年（反彈）'][TIERS[tier]];
    g = mu + fromQuantiles(R['world.analog'].quantiles, a.q, rnd());
    rec = g <= -3 ? 1 : 0;
  } else {
    const p = c.rec ? lookup(R['recession.continue'], { dur: Math.min(3, c.recRun), tier }) : lookup(R['recession.onset'], { cur: c.cur, war2: 0 });
    if (rnd() < p) {
      const rq = R['growth.recession_year'].by_tier[TIERS[tier]];
      g = fromQuantiles(R['growth.recession_year'].quantiles, rq.q, rnd()); rec = 1;
    } else if (c.rec) {
      const aq = R['growth.after_recession'];
      g = mu + fromQuantiles(aq.quantiles, aq.q, rnd());
    } else {
      const gn = R['growth.normal'];
      for (let i = 0; i < 20; i++) {
        g = mu + gn.rho[TIERS[tier]].rho * c.dev + fromQuantiles(gn.quantiles, gn.resid[TIERS[tier]].q, rnd());
        if (g > -3) break;
      }
    }
  }
  if (rec && !c.rec) ev.push('recession');
  c.recRun = rec ? c.recRun + 1 : 0;
  c.rec = rec; c.dev = g - mu; c.growth = g;
  c.lvl = c.lvl * (1 + g / 100);
  // 天災（每國一年至少一次的機率）
  const h = D.haz[c.iso];
  if (h) {
    if (rnd() < +h.eq65_p) ev.push('quake_big'); else if (rnd() < +h.eq55_p) ev.push('quake');
    if (rnd() < +h.tc64_p) ev.push('typhoon_big'); else if (rnd() < +h.tc34_p) ev.push('typhoon');
  }
  c.events = ev;
  return c;
}

// 生命表：沒有性別就取男女平均
function deathP(D, iso, year, age) {
  const y = String(Math.min(2100, Math.max(1950, year)));
  const a = Math.min(100, age);
  const m = D.life[iso + '|' + y + '|M'], f = D.life[iso + '|' + y + '|F'];
  if (!m || !f) return 0.01;
  return (m[a] + f[a]) / 2;
}

module.exports = { load, initCountry, stepWorld, stepCountry, deathP, tierOf };
