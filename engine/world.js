// 國家這一年怎麼了：照 1in8b-research/country-data/estimated/trends 的規則擲骰。
// v1 做：全球衰退、衰退和成長、貨幣危機、通膨、天災、生命表。還沒做：戰爭、政變、組織性暴力、倒債（之後照 rules.md 補）。
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const crypto = require('crypto');
const DATA = path.resolve(__dirname, '..', '..', '1in8b-research', 'country-data', 'estimated', 'trends');
// 付費報告用過的資料版本存這裡（不公開的研究 repo，不放公開的 decision-pilot）。2026-11-14 用戶：同一個客人改條件重跑時，
// 差距只能來自他改的地方，不能混進每週資料更新。
const VERS = path.resolve(__dirname, '..', '..', '1in8b-research', 'country-data', 'report_versions');
// 鎖住的檔：[存檔名, 最新資料的位置]。countries.csv 是事件句裡的地名。生命表 23MB、一年才換一次，只記雜湊
const PINNED = [['rules.json', path.join(DATA, 'rules.json')], ['country_hazards.csv', path.join(DATA, 'country_hazards.csv')],
  ['start_state.csv', path.join(DATA, 'start_state.csv')], ['countries.csv', path.resolve(DATA, '..', '..', 'data', 'countries.csv')]];
const LIFE = path.join(DATA, 'life_tables.csv.gz');
const h = buf => crypto.createHash('sha256').update(buf).digest('hex');
// 版本號：每個檔先各算雜湊，再把「檔名:雜湊」串起來算（檔案之間有分隔，搬動內容不會撞號）
const idOf = bufs => h(Buffer.from(PINNED.map(([f], i) => f + ':' + h(bufs[i])).join('\n'))).slice(0, 12);
const lifeHash = () => h(fs.readFileSync(LIFE)).slice(0, 12);
// 引擎本身（程式、句庫）也記雜湊：兩份報告之間程式改過的話，重跑時提醒
function engineHash() {
  const files = ['world.js', 'simulate.js', 'texts.js', 'names.js'].map(f => path.join(__dirname, f))
    .concat(fs.readdirSync(path.join(__dirname, 'quotes')).sort().map(f => path.join(__dirname, 'quotes', f)));
  return h(Buffer.from(files.map(f => path.basename(f) + ':' + h(fs.readFileSync(f))).join('\n'))).slice(0, 12);
}
function readMeta(dir) { try { return JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8')); } catch (e) { return null; } }
// 存起來的那份三四個檔有沒有被改過：重算版本號，對不上就停（不能拿被改過的資料掛舊版本號出報告）
function checkDir(dir, id) {
  const bufs = PINNED.map(([f]) => fs.readFileSync(path.join(dir, f)));
  if (idOf(bufs) !== id) throw new Error('資料版本 ' + id + ' 的檔案內容跟版本號對不上（被改過或換行被轉了），不能用：' + dir);
}

// 現在的資料是哪一版。第一次遇到就整份存起來：先寫到暫存資料夾，寫完才改名，中途失敗不會留下半套
function pinCurrent() {
  const bufs = PINNED.map(([, p]) => fs.readFileSync(p));
  const id = idOf(bufs), dir = path.join(VERS, id), meta = readMeta(dir);
  if (meta) { checkDir(dir, id); return { id, isNew: false }; }
  const tmp = dir + '.tmp-' + process.pid;
  fs.rmSync(tmp, { recursive: true, force: true }); fs.mkdirSync(tmp, { recursive: true });
  PINNED.forEach(([f], i) => fs.writeFileSync(path.join(tmp, f), bufs[i]));
  let ver = {}; try { ver = JSON.parse(fs.readFileSync(path.join(DATA, '..', 'VERSION.json'), 'utf8')); } catch (e) { /* 沒有就算了 */ }
  fs.writeFileSync(path.join(tmp, 'meta.json'), JSON.stringify({ id, saved: new Date().toISOString().slice(0, 10), data_version: ver.version || null,
    rules_version: JSON.parse(bufs[0].toString('utf8')).rules_version || null, life_tables: lifeHash() }, null, 1));
  fs.rmSync(dir, { recursive: true, force: true });   // meta.json 壞掉或半套的舊資料夾，整份換掉
  fs.renameSync(tmp, dir);
  return { id, isNew: true };
}
// 指定版本（重跑舊報告用）：讀存起來的那一份，先驗內容沒被改過
function versionDir(id) {
  if (!/^[0-9a-f]{12}$/.test(id || '')) throw new Error('資料版本號要是 12 碼小寫英數（0-9、a-f）：' + id);
  const dir = path.join(VERS, id);
  if (!readMeta(dir)) throw new Error('找不到資料版本 ' + id + '（' + dir + '）');
  checkDir(dir, id);
  return dir;
}

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

// dataId：不給就用現在的資料（並存一份）；給了就用存起來的那一版
function load(isos, dataId) {
  const p = dataId ? { id: dataId, isNew: false } : pinCurrent(), id = p.id, SRC = versionDir(id);
  const meta = readMeta(SRC), warnings = [];
  const lt = lifeHash(), eng = engineHash();
  if (meta.life_tables && meta.life_tables !== lt) warnings.push('生命表在這版之後換過（聯合國新版），壽命相關的結果可能跟當時差一點');
  if (p.isNew) console.log('新存了資料版本 ' + id + '（1in8b-research/country-data/report_versions/），記得 commit 1in8b-research');
  const rules = JSON.parse(fs.readFileSync(path.join(SRC, 'rules.json'), 'utf8'));
  const R = {}; rules.rules.forEach(r => { R[r.id] = r; });
  const start = {}; csv(path.join(SRC, 'start_state.csv')).forEach(r => { if (isos.includes(r.iso3)) start[r.iso3] = r; });
  const haz = {}; csv(path.join(SRC, 'country_hazards.csv')).forEach(r => { if (isos.includes(r.iso3)) haz[r.iso3] = r; });
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
  warnings.forEach(m => console.warn('提醒：' + m));
  return { R, start, haz, life, dataId: id, rulesVersion: rules.rules_version || null, lifeTables: lt, engine: eng, warnings,
    countriesFile: path.join(SRC, 'countries.csv') };
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

// 生命表：照性別取；沒給性別才取男女平均（嚴審 2026-11-05：性別只定一次，壽命也讀它）
function deathP(D, iso, year, age, sex) {
  const y = String(Math.min(2100, Math.max(1950, year)));
  const a = Math.min(100, age);
  const m = D.life[iso + '|' + y + '|M'], f = D.life[iso + '|' + y + '|F'];
  if (!m || !f) return 0.01;
  return sex === 'M' ? m[a] : sex === 'F' ? f[a] : (m[a] + f[a]) / 2;
}

module.exports = { load, initCountry, stepWorld, stepCountry, deathP, tierOf };
