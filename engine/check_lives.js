// 人生模擬的自我檢查：跑幾組亂數，把「不合理」的地方一條一條找出來。用法：node check_lives.js [組數]
// 每一條都是 2026-11-05 嚴審時抓過的低級錯誤；改引擎後跑一次，0 條才算過。
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path');
const N = +(process.argv[2] || 5);
const issues = {}, wedAges = new Set(), worstAll = [], globalWorst = [];
// 第 2 個參數可以指定別的參數檔（試跑的案件），沒給就用範例
const PARF = path.resolve(process.argv[3] || path.join(__dirname, 'example_派駐新加坡.json'));
const PAR = JSON.parse(fs.readFileSync(PARF, 'utf8'));
const ladder = PAR.titles;
// 能讓職稱往上的只有：引擎的升遷（「升上…」開頭）和參數裡帶 title 的好事
const promoTexts = PAR.options.flatMap(o => o.events.filter(e => e.effect && e.effect.title && e.kind === 'big').map(e => e.text));
// 壞事不能帶 title（2026-11-05 複審：「升處長的保證沒了」反而讓人升處長）
PAR.options.forEach(o => o.events.forEach(e => { if (e.effect && e.effect.title && e.kind !== 'big') (issues['壞事帶了升遷'] = issues['壞事帶了升遷'] || []).push(e.text); }));
let lives = 0;
const tmp = path.join(__dirname, '_check_tmp.json');
const note = (k, s) => { (issues[k] = issues[k] || []).push(s); };

const femaleP = path.join(__dirname, '_check_female.json');
const famF = Object.assign({}, PAR.family); delete famF.spouse_gender;
fs.writeFileSync(femaleP, JSON.stringify(Object.assign({}, PAR, { gender: PAR.gender === 'F' ? 'M' : 'F', family: famF })));
// 原本的參數跑一次，再把主角換成另一個性別跑一次
for (const [variant, pf] of [[PAR.gender === 'F' ? '女' : '男', PARF], [PAR.gender === 'F' ? '男' : '女', femaleP]])
for (let seed = 1; seed <= N; seed++) {
  execFileSync('node', [path.join(__dirname, 'simulate.js'), pf, tmp, '--seed', String(seed), '--runs', '200']);
  const d = JSON.parse(fs.readFileSync(tmp, 'utf8'));
  const fam = Object.fromEntries(d.family);
  const seenNames = new Map();
  for (const o of d.options) for (const k of ['good', 'bad']) {
    const L = o[k], tag = `${variant}seed${seed} ${o.id}${k === 'good' ? '好' : '壞'}`;
    let laidOff = false;
    let prevTitleRank = -1, spDeadAt = null, prevAge = null;
    lives++;
    L.years.forEach((y, i) => {
      const p = y.profile, txt = y.events.map(e => e[0]).join('｜');
      if (prevAge !== null && y.age !== prevAge + 1) note('年紀不連續', `${tag} ${prevAge}→${y.age}`);
      prevAge = y.age;
      const n = y.events.length - (i === L.years.length - 1 ? 1 : 0);
      if (n < 5 || n > 15) note('每年事件數不在 5～15', `${tag} ${y.age} 歲 ${n} 件`);
      if (new Set(y.events.map(e => e[0])).size !== y.events.length) note('同一年重複的事', `${tag} ${y.age} 歲`);
      const r = ladder.indexOf(p.title);
      if (r >= 0 && prevTitleRank >= 0 && r < prevTitleRank && !/位子沒了|裁員/.test(txt)) note('職稱沒被裁員卻降級', `${tag} ${y.age} 歲 ${ladder[prevTitleRank]}→${p.title}`);
      if (r >= 0 && prevTitleRank >= 0 && r > prevTitleRank && !y.events.some(e => e[0].startsWith('升上') || promoTexts.includes(e[0]))) note('職稱變了卻沒有升遷的事', `${tag} ${y.age} 歲 ${p.title}：${txt.slice(0, 60)}`);
      if (y.events.some(e => typeof e[2] !== 'number')) note('事件少了權重', `${tag} ${y.age} 歲`);
      if (r >= 0 && prevTitleRank >= 0 && r - prevTitleRank >= 2) note('同一年連升兩級', `${tag} ${y.age} 歲`);
      // 參數裡標了 below_title 的事，職稱已經到了還發生，就是矛盾
      PAR.options.forEach(oo => oo.events.filter(e => e.below_title).forEach(e => { if (txt.includes(e.text) && prevTitleRank >= ladder.indexOf(e.below_title)) note('已經是那個職稱，還發生「還沒升」的事', `${tag} ${y.age} 歲 ${e.text}`); }));
      // 只看之前的年頭被裁過（同一年先調回、後被裁是合理的順序）；只認你自己被裁，新聞講裁員不算
      if (laidOff && /回到原來的部門|照合約/.test(txt)) note('被裁員換公司後，還寫回原公司', `${tag} ${y.age} 歲`);
      if (/你的位子沒了|你也在名單上/.test(txt)) laidOff = true;
      if (variant === '女' && /「阿公」/.test(txt)) note('女主角被叫阿公', tag);
      if (r >= 0) prevTitleRank = r;
      if (p.sp && p.sp.status === '已過世' && spDeadAt === null) spDeadAt = y.age;
      if (spDeadAt !== null && y.age > spDeadAt && txt.includes(fam['另一半'])) note('另一半過世後還出現在事件裡', `${tag} ${y.age} 歲`);
      p.parents.forEach(pp => { const nm = fam[pp.id === 'father' ? '爸爸' : '媽媽']; if (pp.status === '已過世' && txt.includes(nm) && !/送走了/.test(txt)) note('爸媽過世後還出現', `${tag} ${y.age} 歲 ${nm}`); });
      if (y.stats.m < 0 && p.title === '退休') note('退休後存款是負的', `${tag} ${y.age} 歲`);
      if (p.title === '退休' && /主管|同事|專案|報表|客戶|會議/.test(txt) && !/退休了/.test(txt)) note('退休後還有上班的事', `${tag} ${y.age} 歲`);
      if (/到新公司報到/.test(txt) && i > 0 && L.years[i - 1].city !== y.city && !/位子沒了|裁員/.test(txt)) note('換國家被寫成換公司', `${tag} ${y.age} 歲`);
      p.kids.forEach((kd, j) => { const prev = i ? L.years[i - 1].profile.kids[j] : null; if (prev && kd.age !== prev.age + 1) note('小孩年紀不連續', tag); });
      [p.boss, ...p.cws, ...p.friends].filter(Boolean).forEach(nm => { const owner = seenNames.get(nm); if (owner && owner !== tag) note('不同人生撞名', `${nm}：${owner}／${tag}`); seenNames.set(nm, tag); });
    });
    // 每個小孩都剛好 30 歲結婚、32 歲生小孩，太整齊
    // 記小孩自己結婚的年紀，不是你的年紀
    L.years.forEach(y => y.events.filter(e => /結婚了$/.test(e[0])).forEach(e => { const j = d.family.filter(f => /^老|^小孩/.test(f[0])).findIndex(f => e[0].startsWith(f[1])); if (j >= 0) wedAges.add(y.profile.kids[j].age); }));
    if (L.years[L.years.length - 1].events.some(e => e[1] === 'end') === false) note('最後一年沒有過世', tag);
    if (!d.family.every(f => f[2] === 'M' || f[2] === 'F') || !d.gender) note('家人少了性別', tag);
    // 女兒的小孩跟女婿姓
    L.years.forEach(y => y.events.forEach(e => { const mm = e[0].match(/^(\S+?)的小孩(\S+?)出生了/); if (!mm) return; const kid = d.family.find(f => f[1] === mm[1]); const wedE = L.years.flatMap(z => z.events).find(z => z[0].startsWith(mm[1] + '和')); const sp = wedE && wedE[0].slice(mm[1].length + 1).replace('結婚了', ''); if (kid && kid[2] === 'F' && sp && mm[2][0] !== sp[0]) note('女兒的小孩沒跟女婿姓', `${tag} ${e[0]}`); }));
    worstAll.push(L.card.worst);
    if (variant === '女') d.family.filter(f => /^老|^小孩/.test(f[0])).forEach(f => { if (f[1][0] !== d.family[0][1][0]) note('女主角的小孩沒跟另一半姓', `${tag} ${f[1]}／${d.family[0][1]}`); });
    if (variant === '女' && d.family[0][2] !== 'M') note('女主角的另一半不是男生（沒給 spouse_gender 時）', tag);
    const bigAges = L.card.big.map(s => parseInt(s));
    if (bigAges.length >= 3 && L.years.length >= 30 && Math.max(...bigAges) - Math.min(...bigAges) < 15) note('結局卡的大事都擠在一起', `${tag} ${L.card.big.map(s => parseInt(s)).join('、')} 歲`);
    // 最難的一年看整年加總，景氣差加上別的壞事可能比家人過世那年（同年也有好事）更重，所以只在超過一成時算錯
    if (/全世界一起景氣變差/.test(L.card.worst) && L.years.some(y => y.events.some(e => /走了，你學著|送走了/.test(e[0])))) globalWorst.push(tag);
  }
}
fs.unlinkSync(tmp); fs.unlinkSync(femaleP);
if (globalWorst.length > lives / 10) note('最難的一年挑了景氣，沒挑家人過世（超過一成）', globalWorst.slice(0, 3).join('；'));
if (wedAges.size < 3) note('小孩結婚的年紀太整齊', [...wedAges].join('、'));
const g = worstAll.filter(w => /景氣/.test(w)).length; if (g > worstAll.length / 2) note('最難的一年一半以上都是景氣', `${g}/${worstAll.length}`);
console.log(`檢查了 ${N} 組亂數、${lives} 段人生，小孩結婚的年紀有：${[...wedAges].sort().join('、')}`);
const keys = Object.keys(issues);
keys.forEach(k => console.log(`${k}：${issues[k].length} 處，例如 ${issues[k].slice(0, 3).join('；')}`));
console.log(keys.filter(k => !k.startsWith('（觀察）')).length ? '有問題' : '0 條，過');
