// 檢查 人生模擬參數.json（格式見 參數格式.md）。有「錯」就不准跑模擬；「注意」要人看一下。
// 用法：node check_params.js <人生模擬參數.json> [對照用的檔 ...]
// 對照用的檔（問題卡、個人檔案、工作區、報告）：參數裡的錢，要在這些檔或 assumptions 裡找得到。
const fs = require('fs'), path = require('path');
const [pf, ...refs] = process.argv.slice(2);
if (!pf) { console.log('用法：node check_params.js <人生模擬參數.json> [對照用的檔 ...]'); process.exit(1); }
const err = [], warn = [];
let P;
try { P = JSON.parse(fs.readFileSync(pf, 'utf8')); } catch (e) { console.log('錯：不是合法的 JSON：' + e.message); process.exit(1); }

const isNum = v => typeof v === 'number' && isFinite(v);
const need = (k, ok, msg) => { if (!(k in P)) err.push(`少了 ${k}`); else if (ok && !ok(P[k])) err.push(`${k} ${msg}`); };
need('case'); need('start_year', v => isNum(v) && v >= 2024 && v <= 2040, '要是今年的西元年');
need('age', v => isNum(v) && v >= 16 && v <= 95, '要在 16～95');
need('gender', v => v === 'M' || v === 'F', '要是 M 或 F');
need('savings', isNum, '要是數字（萬）'); need('monthly_spend', v => isNum(v) && v > 0 && v < 500, '要是每月幾萬（0～500）');
need('family', v => v && typeof v === 'object', '要是物件');
need('goals', v => Array.isArray(v) && v.length >= 1 && v.length <= 3 && v.every(g => g.name && ['career', 'family', 'wealth', 'health'].includes(g.metric)), '要 1～3 個，metric 只能是 career、family、wealth、health');
need('titles', v => Array.isArray(v) && v.length >= 2 && v.length <= 8, '要 2～8 個職稱');
need('title_index', v => isNum(v) && Number.isInteger(v) && P.titles && v >= 0 && v < P.titles.length, '要是 titles 裡的位置');
need('sensitive', v => typeof v === 'boolean', '要是 true 或 false'); need('has_actions', v => typeof v === 'boolean', '要是 true 或 false');
need('assumptions', v => Array.isArray(v), '要是文字陣列');
need('options', v => Array.isArray(v) && v.length >= 2 && v.length <= 4, '要 2～4 個選項');

// 國家要在 200 國資料裡
const DATA = path.resolve(__dirname, '..', '..', '1in8b-research', 'country-data', 'estimated', 'trends', 'start_state.csv');
const isos = new Set(fs.existsSync(DATA) ? fs.readFileSync(DATA, 'utf8').split('\n').slice(1).map(l => l.split(',')[0]) : []);
const okIso = c => isos.size === 0 || isos.has(c);
if (P.home && !okIso(P.home)) err.push(`home 的國家代碼 ${P.home} 不在 200 國資料裡`);

const ids = new Set();
(P.options || []).forEach((o, oi) => {
  const tag = `選項 ${o.id || oi + 1}`;
  if (!o.id || ids.has(o.id)) err.push(`${tag}：id 空的或重複`); ids.add(o.id);
  if (!o.name) err.push(`${tag}：少了 name`);
  const ph = o.phases || [];
  if (!ph.length) err.push(`${tag}：少了 phases`);
  let t = 0;
  ph.forEach((p, i) => {
    if (p.from !== t) err.push(`${tag}：第 ${i + 1} 段從第 ${p.from} 年開始，應該接著第 ${t} 年`);
    if (!(p.to > p.from)) err.push(`${tag}：第 ${i + 1} 段的 to 要大於 from`);
    if (!okIso(p.country)) err.push(`${tag}：國家代碼 ${p.country} 不在 200 國資料裡`);
    if (!isNum(p.income) || p.income < 0) err.push(`${tag}：第 ${i + 1} 段的 income 要是 0 以上的數字（萬）`);
    if (p.income > 3000) warn.push(`${tag}：年收入 ${p.income} 萬，確認單位是萬`);
    t = p.to;
  });
  if (ph.length && t < 99) err.push(`${tag}：最後一段的 to 要寫 99`);
  (o.events || []).forEach((e, ei) => {
    const et = `${tag} 第 ${ei + 1} 件事「${(e.text || '').slice(0, 12)}」`;
    if (!e.text) err.push(`${et}：少了 text`);
    if (!isNum(e.p) || e.p < 0 || e.p > 1) err.push(`${et}：p 要在 0～1`);
    if (!Array.isArray(e.at) || e.at.length !== 2 || e.at[0] > e.at[1] || e.at[0] < 0) err.push(`${et}：at 要是 [起, 止]`);
    if (!['big', 'hit', ''].includes(e.kind || '')) err.push(`${et}：kind 只能是 big、hit 或空的`);
    const eff = e.effect || {};
    if (eff.title && e.kind !== 'big') err.push(`${et}：只有好事（big）可以帶 title`);
    if (eff.title && P.titles && !P.titles.includes(eff.title)) err.push(`${et}：title「${eff.title}」不在 titles 裡`);
    if (e.below_title && P.titles && !P.titles.includes(e.below_title)) err.push(`${et}：below_title 不在 titles 裡`);
    if (/他|她/.test(e.text || '')) warn.push(`${et}：用了他／她`);
    if (/選了|決定要|你選擇/.test(e.text || '')) warn.push(`${et}：像是在寫人生選擇（模擬只放外在運氣）`);
  });
});

// 錢對得回資料：savings、monthly_spend、各段收入，在對照的檔或 assumptions 裡要找得到這個數字
if (refs.length) {
  const text = refs.filter(f => fs.existsSync(f)).map(f => fs.readFileSync(f, 'utf8')).join('\n') + '\n' + (P.assumptions || []).join('\n');
  const plain = text.replace(/,/g, '');
  const has = n => plain.includes(String(n)) || plain.includes(String(n * 10000)) || plain.includes(String(Math.round(n / 12 * 10) / 10));
  const money = [['savings', P.savings], ['monthly_spend', P.monthly_spend]];
  (P.options || []).forEach(o => (o.phases || []).forEach((p, i) => { money.push([`選項 ${o.id} 第 ${i + 1} 段 income`, p.income]); if (p.spouse_income) money.push([`選項 ${o.id} 第 ${i + 1} 段 spouse_income`, p.spouse_income]); }));
  money.forEach(([k, v]) => { if (isNum(v) && v !== 0 && !has(v)) err.push(`${k} = ${v}：在對照的檔和 assumptions 裡都找不到這個數字`); });
}

err.forEach(e => console.log('錯：' + e));
warn.forEach(w => console.log('注意：' + w));
console.log(err.length ? `有 ${err.length} 個錯，不准跑模擬` : `格式對${warn.length ? `，有 ${warn.length} 個要人看一下` : ''}`);
process.exit(err.length ? 1 : 0);
