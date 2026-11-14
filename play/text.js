// 隨機投胎的文字庫（繁中）。引擎只認這裡的 key；句子平實、具體，不寫他、她，直接寫稱謂。
// 同一個 key 有好幾句時，照年份挑一句（不吃亂數，重跑時一樣）。
(function (root) {
'use strict';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const sig = x => 1 / (1 + Math.exp(-x)), logit = p => Math.log(p / (1 - p));
const shift = (p, d) => sig(logit(clamp(p, 0.01, 0.99)) + d);
const kidWord = n => ['', '老大', '老二', '老三', '老四', '老五', '老六', '老七', '老八'][n] || '小孩';

const L = {
  // ---------- 說明 ----------
  noHist: '{y0} 年以前的國家大事這裡不播，只看你自己的人生。',
  simStart: '從這一年起是推估：國家會發生什麼，照過去 30 年的規律擲骰。',

  // ---------- 國家大事 ----------
  n_glob: ['全世界一起景氣變差，新聞每天都在講裁員。', '全球不景氣，出口訂單少了一大截。'],
  n_rec: ['{c}這年景氣衰退，很多店收了。', '{c}經濟走下坡，找工作變難了。'],
  n_dep: '{c}經濟大崩，一年少了一成以上，街上到處是失業的人。',
  n_cur: ['{c}的錢大貶，進口的東西一下子貴很多。', '貨幣一夜之間貶了一大截，大家搶著換外幣。'],
  n_hinf: '物價一年漲了四成以上，薪水完全追不上。',
  n_def: '政府還不出外債，經濟陷入混亂。',
  n_def0: '政府跟債主談延後還款，新聞吵了好幾個月。',
  n_def1: '政府還不出外債，利息和稅都往上加。',
  n_def2: '政府倒債，銀行限制提款，存款被打了折。',
  n_coup: '{c}發生政變，軍隊上街。',
  n_autocracy: '選舉被取消，報紙開始不敢批評政府。',
  n_democracy: '{c}辦了一場真正的選舉，換了一個政府。',
  n_war_start: '{c}境內爆發武裝衝突。',
  n_war_start2: '{c}陷入戰爭，每天都有人死。',
  n_interstate: '這次是跟一個鄰國打起來。',
  n_war_escalate: '衝突越打越大，打成了戰爭。',
  n_war_end: '打了幾年的仗終於停了。',
  n_attack: '{c}發生一場死傷慘重的攻擊，全國默哀。',
  n_quake_big: '{c}一帶發生一場強烈地震。',
  n_quake: '{c}一帶發生一場地震，搖了好一陣子。',
  n_typhoon_big: '強烈颱風登陸，好幾個地方淹水。',

  // ---------- 大事打到身上 ----------
  draft: '你被徵召上前線。',
  schoolClosed: '仗打到附近，學校停課了一整年。',
  violNear: ['住的地方附近發生槍擊，晚上不太敢出門。', '鄰居被搶，家裡加裝了鐵門。'],
  inflBite: '存的錢越來越不值錢，買菜要帶一大疊鈔票。',
  defBite: '銀行限制提款，存款被打了七五折。',
  disasterQuake: '一場強烈地震，家裡損失慘重，修了好幾個月。',
  disasterStorm: '一場強烈颱風，家裡損失慘重，修了好幾個月。',
  coupJob: '政變後換了一批人，你在公家的位子被拿掉了。',

  // ---------- 小時候 ----------
  born: w => '你出生在' + w.c.name + (w.who.urban ? '的城市' : '的鄉下') + '，是' + (w.who.sex === 'F' ? '女生' : '男生') + '。',
  sibs: '家裡還有 {n} 個兄弟姊妹。',
  pe0: '爸媽的學歷都在中學以下。',
  pe1: '爸媽念到中學。',
  pe2: '爸媽都念過大學。',
  kid1: '三歲生了一場大病，好在撐過來了。',
  kid2: '開始學說話，第一個會講的詞是「吃」。',
  kid3: '每天跟在哥哥姊姊後面跑。',
  kid4: '最喜歡的玩具是一個破掉的鐵罐。',
  schoolStart: '六歲，開始上小學。',
  noSchool: '到了上學的年紀，家裡沒讓你去念書。',
  secStart: '小學畢業，繼續念中學。',
  dropout: '小學畢業就沒再念了。',
  childWork: '還沒成年就開始幫家裡賺錢。',
  childMarriage: '還沒成年就被家裡安排嫁人。',
  leftSchool: '結婚後就沒再去學校了。',
  ch1: '交到一個最好的朋友，每天一起回家。',
  ch2: '第一次考了全班第一。',
  ch3: '在學校跟人打了一架，被罰站一整天。',
  ch4: '迷上一種遊戲，天天玩到天黑。',
  ch5: '暗戀隔壁班的同學，沒說出口。',
  ch6: '家裡養了一隻狗。',
  secDone: '中學畢業了。',

  // ---------- 長大以後 ----------
  jobStart: '開始工作：{job}。',
  vocDone: '技職學校畢業了。',
  uniDone: '大學畢業了。',
  jobLost: w => w.who.job && w.who.job.kind === 'risky' ? '生意做不下去，收掉了，花了一段時間找下一份工作。' : w.who.job && ['informal', 'farm'].includes(w.who.job.kind) ? '零工接不到了，花了一段時間找下一份。' : '工作沒了，花了一段時間找下一份。',
  kidBorn: w => kidWord(w.n) + '出生了。',
  kidsGrown: '小孩都長大了，家裡突然安靜下來。',
  parentDied1: '送走了爸媽其中一位。',
  parentDied2: '爸媽都走了。',
  retireLate: '七十二歲，終於退休了。',
  ad1: '跟老朋友喝到半夜。',
  ad2: '搬了一次家。',
  ad3: '學會開車。',
  ad4: '存錢買了一台新機車。',
  ad5: '過年回老家，一桌坐滿了人。',
  ad6: '生了一場大病，休養了一個月。',
  ad7: '跟另一半大吵一架，冷戰了一個星期。',
  ad8: '第一次出遠門旅行。',

  // ---------- 抉擇的結果 ----------
  marryCap: '之後沒再遇到想結婚的人，一個人過。',
  layoffCap: '又碰上一波裁員，這次沒輪到你。',
  picked: w => (w.auto ? '（交給系統，' + (w.why || '照這個人的個性選') + '）' : '你選了：') + w.a,
  uniIn: '考上大學。',
  uniFail: '大學沒考上，開始工作。',
  vocIn: '去念技職學校，學一門專業技術。',
  workNow: '中學畢業後開始工作。',
  stayOn: '咬牙繼續念，家裡省吃儉用。',
  leftForWork: '休學去工作，幫家裡分擔。',
  married: '結婚了。',
  notYet: '還不想定下來。',
  stayingSingle: '決定一個人過。',
  kidFirst: '第一個小孩出生了。',
  noKidsPick: '決定不生小孩。',
  laidTake: '拿了資遣費，開始找下一份工作。',
  retrain: '回去進修，學新的東西。',
  brokeKids: '存款用完了，跟孩子和家人一起過日子。',
  brokeAlone: '存款用完了，日子過得很省。',
  retireEarly: '六十歲後沒再找工作，提早退休了。',
  goOwn: '自己出來做。',
  bizClosed: '把生意收了，去找一份領薪水的工作。',
  bizHeld: '咬牙撐過去，生意慢慢回來了。',
  bizLost: '撐了一年還是不行，賠掉一大筆錢才收掉。',
  stayWar: '留下來，日子照過。',
  fleeIn: '帶著能帶的東西，逃到國內比較安全的地方。',
  fleeOut: '花光大半積蓄，逃到國外。',
  keepLocal: '錢留著不動。',
  toUsd: '把存款換成美元。',
  careSelf: '自己照顧爸媽，工作做得少了。',
  careHire: '請人照顧，每個月多一大筆開銷。',
  careSib: '交給兄弟姊妹照顧，你出錢。',
  cured: '治療成功，身體慢慢恢復。',
  treatFail: '治療沒有效果，病一直拖著。',
  mildOk: '保守治療，病情穩住了。',
  mildBad: '保守治療，病情越來越重。',
  retired: '退休了。',
  workOn: '繼續工作。',

  death: w => w.who.cause === 'old' ? w.who.age + ' 歲，在睡夢中安詳地走了。' : w.who.age + ' 歲，因為' + w.cause + '走了。'
};

// 「略過可怕的情節」打開時改用這一句（2026-11-15）：只改畫面上的字，結果和統計都不變。沒列的照原句
const SOFT = {
  n_war_start2: '{c}陷入戰爭。',
  n_attack: '{c}發生一場重大的攻擊事件。',
  draft: '你被徵召入伍。',
  violNear: '住的地方治安變差，晚上不太敢出門。',
  childMarriage: '還沒成年就結婚了。',
  death: w => w.who.cause === 'old' ? w.who.age + ' 歲，在睡夢中安詳地走了。' : w.who.age < 18 || w.who.cause === 'war' || w.who.cause === 'violence' ? '這一生在 ' + w.who.age + ' 歲結束了。' : w.who.age + ' 歲，因為' + w.cause + '走了。'
};
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function fmt(key, v, tbl) {
  v = v || {}; tbl = tbl || L;
  let t = Object.prototype.hasOwnProperty.call(tbl, key) ? tbl[key] : (tbl !== L || /^[a-z]/i.test(key) && !/[一-鿿]/.test(key) ? null : key);
  if (t == null) return '';
  if (Array.isArray(t)) t = t[hash(key + (v.who ? v.who.year : '')) % t.length];
  if (typeof t === 'function') t = t(v);
  return t.replace(/\{(\w+)\}/g, (_, k) => k === 'c' ? (v.c ? v.c.name : '') : (v[k] ?? ''));
}

// ---------- 職業：jobs[kind][學歷 0 中學以下 / 1 中學 / 2 技職 / 3 大學] ----------
// 每個職業：[名稱, ISCO 大類（1 主管 2 專業 3 技術員及助理專業 4 事務 5 服務銷售 6 農林漁 7 技藝 8 機械操作 9 基層）, 台灣細項職類, 類內加成]
// 收入＝該國這一大類的平均月薪 ÷ 全體平均（ILOSTAT；台灣用勞動部，能對到細項就用細項）× 類內加成 × 工作種類 × 個人差異。
// 類內加成只給收入明顯偏離大類平均的職業（醫師、老師、創業），其他都是 1。2026-11-15 用戶：倍數要照各國資料，不能全世界一套。
const W = { clean: '清潔及家事工作人員(含建築清潔工、房務人員)', labor: '勞力工(含理貨員、行李搬運工)', shop: '商店銷售及展售人員(含門市店長)',
  moto: '機車送件駕駛人員', build: '其他營建構造人員(含鷹架工、鋁門窗及廣告招牌製作安裝)', car: '車輛維修人員(含自行車、機車、汽車、火車)',
  mach: '產業用機器維修人員', farm: '園藝及農牧業生產人員', cook: '廚師(含廚房領班)' };
const jobs = {
  gov: [[['清潔隊員', 9, W.clean], ['學校工友', 9, W.labor]],
        [['公所行政人員', 4], ['郵局櫃員', 4, '銀行、郵局櫃台事務人員'], ['軍人', 5]],
        [['護理師', 2, '護理人員'], ['消防員', 5], ['警察', 5], ['技術員', 3, '電機、電子技術員']],
        [['政策規劃人員', 2], ['老師', 2, null, 0.9]]],
  private: [[['工廠作業員', 8, '組裝(現場)人員'], ['店員', 5, W.shop], ['送貨員', 8, W.moto], ['工地工人', 9, W.labor]],
            [['工廠技術員', 3, '品管、工管及生管技術員'], ['門市店員', 5, W.shop], ['業務', 3, '工商業銷售代表(含業務員)'], ['司機', 8, '小客、貨車駕駛人員']],
            [['機電技師', 7, W.mach], ['電工', 7, '電力、電子、資通訊設備裝修人員(含水電工)'], ['廚師', 5, W.cook], ['美髮師', 5, '美髮、美容及造型設計人員'], ['護理師', 2, '護理人員'], ['會計助理', 4, '會計助理、簿記、出納']],
            [['工程師', 2, '電機、電子工程師'], ['會計', 2, '會計人員'], ['行銷企劃', 2, '廣告及行銷專業人員(含企劃)'], ['研究員', 2, '人文社會科學研究人員'], ['行政', 4, '辦公室綜合事務人員(含資料登錄、一般事務秘書)'], ['人資', 2, '人力資源管理師'], ['設計師', 2, '平面及多媒體設計師'], ['軟體工程師', 2, '資訊及通訊專業人員(含系統分析、程式設計、資料庫及網路專業人員)'], ['醫師', 2, '醫師', 2, true]]],
  risky: [[['擺攤', 9], ['跑外送', 8, W.moto]], [['開小吃店', 5, W.cook], ['做網拍', 5, W.shop]],
          [['開工作室', 3], ['自己接案', 3], ['開修車廠', 7, W.car]], [['創業', 1, null, 0.8], ['新創公司員工', 2, '資訊及通訊專業人員(含系統分析、程式設計、資料庫及網路專業人員)']]],
  informal: [[['打零工', 9, W.labor], ['路邊攤', 9], ['幫人打掃', 9, W.clean]], [['打零工', 9, W.labor], ['攤販', 9], ['臨時工', 9, W.labor]],
             [['接零工', 9, W.labor], ['攤販', 9], ['修理工', 7, W.car]], [['自己接案', 3], ['家教', 2, '補教業教師', 0.6, true]]],
  farm: [[['種田', 6, W.farm], ['放牧', 6, W.farm]], [['種田', 6, W.farm], ['養魚', 6, W.farm]], [['種田', 6, W.farm], ['農機修理', 7, W.mach]], [['農場管理', 6, W.farm, 1.3]]]
};
// 這個人在這個國家做這份工作，收入是全體平均的幾倍（不含工作種類和個人差異）
const soft = (key, v) => fmt(key, v, SOFT);
function jobPay(job, C) {
  const [, g, tw, f, inDetail] = job;
  const useTw = C.occTw && tw && C.occTw[tw];
  const r = useTw || (C.occ && C.occ[g - 1]) || 1;
  // inDetail＝台灣細項已經是這個職業本身的收入（醫師、家教），用細項時就不再乘類內加成
  return r * (useTw && inDetail ? 1 : (f || 1));
}

// ---------- 每年的重心（不讓玩家選，系統照個性分配） ----------
const focus = {
  study: { label: '讀書', e: { know: 2, happy: -0.5 }, drive: 1 },
  play: { label: '玩樂', e: { social: 1.5, happy: 1 } },
  family: { label: '家人', e: { social: 1, happy: 1 }, care: 1 },
  work: { label: '工作', e: { know: 0.5, happy: -0.5, health: -0.3 }, drive: 1 },
  health: { label: '健康', e: { health: 1.5 } },
  rest: { label: '休息', e: { happy: 1.5 } }
};
function focusFor(p) {
  if (p.age < 18) return p.inSchool ? ['study', 'play', 'family', 'health'] : ['play', 'family', 'health'];
  if (p.retired) return ['family', 'health', 'rest'];
  return p.inSchool ? ['study', 'play', 'family', 'health'] : ['work', 'family', 'health', 'rest'];
}

// ---------- 死因 ----------
const causes = {
  infant: '出生沒多久的一場病', infection: '一場感染', accident: '一場意外', violence: '一場暴力事件', war: '戰火',
  cancer: '癌症', heart: '心臟病', stroke: '中風', lung: '肺病', liver: '肝病', diabetes: '糖尿病的併發症', old: '年紀到了'
};
function cause(p, r) {
  const a = p.age, rich = p.wealthU > 0.6;
  const pickW = ws => { const ks = Object.keys(ws), s = ks.reduce((t, k) => t + ws[k], 0); let u = r() * s; for (const k of ks) { u -= ws[k]; if (u <= 0) return k; } return ks[0]; };
  if (a < 1) return 'infant';
  if (a < 15) return pickW({ infection: 5, accident: 4, violence: 0.5 });
  if (a < 40) return pickW({ accident: 5, infection: rich ? 1 : 3, violence: 1.5, cancer: 1.5, heart: 1 });
  if (a < 70) return pickW({ cancer: 5, heart: 4, stroke: 2.5, liver: 1, diabetes: 1.2, lung: 1, accident: 1, infection: 1 });
  if (a < 85) return pickW({ heart: 5, cancer: 4, stroke: 3, lung: 2, diabetes: 1, infection: 1, old: 1 });
  return pickW({ heart: 4, stroke: 2, lung: 2, infection: 1.5, cancer: 1.5, old: 5 });
}

// 考不考得上大學（遊戲設定）：25 歲以上有大學學歷的比例 × UNI_SCALE，再照知識和家境調整。check.js 會印各國模擬出來的考上比例
const UNI_SCALE = 1.4;
// 重病治好的機率（遊戲設定）：積極治療 0.25＋醫療照顧指標×0.65，保守治療是它的一半，所以積極一定比較高
const treatChance = uhc => 0.25 + uhc * 0.65;
function uniChance(p, C) { return shift((C.p.edu_tertiary || 10) / 100 * UNI_SCALE, (p.stats.know - 50) / 20 + (p.wealthU - 0.5) * 1.5); }

// ---------- 大抉擇 ----------
// opts: k、label、hint、when(p,cy) 出現的條件、w(p,cy) 交給系統時的權重、do(p,ctx) 回傳結果句的 key
const choices = {
  after18: {
    title: '中學畢業了，接下來呢？', size: 'big',
    desc: '十八歲。家裡的狀況、你的成績，都會影響接下來走得多順。',
    stat: w => '在' + w.c.name + '，25 歲以上的人大約 ' + Math.round(w.c.p.edu_tertiary || 10) + '% 有大學以上學歷。',
    opts: [
      { k: 'uni', label: '考大學', hint: '再念四年，學費較高，要考得上；醫師、工程師這類工作要學位', w: p => 0.4 + p.stats.know / 80 + p.wealthU,
        do: (p, x) => {
          const pIn = uniChance(p, x.C);
          if (x.pr() < pIn) { p.inSchool = true; p.school = 3; p.savings -= x.cy.lvl * 0.3; return 'uniIn'; }
          p.inSchool = false; p.edu = 1; x.startJob(null); return 'uniFail';
        } },
      { k: 'voc', label: '念技職', hint: '再念四年，學費比大學少；出來做護理、機電這類技術工作', w: () => 0.8,
        do: (p, x) => { p.inSchool = true; p.school = 3; p.flags.voc = 1; p.savings -= x.cy.lvl * 0.15; return 'vocIn'; } },
      { k: 'work', label: '直接工作', hint: '馬上開始賺錢、存錢；之後找的多半是不要求文憑的工作', w: p => 1.2 - p.wealthU,
        do: (p, x) => { p.inSchool = false; p.edu = 1; x.startJob(null); return 'workNow'; } }
    ]
  },
  firstJob: {
    title: '畢業了，第一份工作要找哪種？', size: 'big',
    desc: '這一步會決定你接下來十年過得穩不穩。',
    opts: [
      { k: 'gov', label: '考公職', hint: '穩定，薪水普通，不太會被裁員', w: p => 1 - p.trait.risk * 0.5, do: (p, x) => { x.startJob('gov'); } },
      { k: 'private', label: '進公司', hint: '薪水看表現，景氣差時可能被裁', w: () => 1.2, do: (p, x) => { x.startJob('private'); } },
      { k: 'risky', label: '去新創或自己做', hint: '可能賺很多，也可能很慘；沒有公司的退休金', w: p => 0.2 + p.trait.risk, do: (p, x) => { x.startJob('risky'); } }
    ]
  },
  stayInSchool: {
    title: '家裡缺錢，要不要休學？', size: 'big',
    desc: '十五歲。爸媽沒有開口，但你知道家裡快撐不住了。',
    opts: [
      { k: 'stay', label: '繼續念', hint: '家裡要再撐三年；十八歲時再決定要不要往上念', w: p => 0.5 + p.stats.know / 100,
        do: (p, x) => { x.stat('know', 3); x.stat('happy', -2); return 'stayOn'; } },
      { k: 'work', label: '休學去工作', hint: '馬上能幫家裡分擔；之後不會再回學校', w: p => 1 - p.wealthU,
        do: (p, x) => { p.inSchool = false; p.school = 1; p.edu = 0; p.flags.dropout = 1; p.flags.childWork = 1; p.flags.leftToWork = 1; x.stat('know', -2); return 'leftForWork'; } }
    ]
  },
  marry: {
    title: '有人想跟你走下去', size: 'big',
    desc: '交往一段時間了，對方問你要不要結婚。',
    // 資料只有女性初婚年齡，男生玩家不出這句
    stat: w => w.who.sex === 'F' ? '在' + w.c.name + '，女生平均 ' + Math.round(w.c.p.smam_f || 25) + ' 歲第一次結婚。' : '',
    opts: [
      { k: 'yes', label: '結婚', hint: '多一個人一起扛，也多一份牽絆', w: () => 2,
        do: (p, x) => { p.married = true; p.partnerAge = p.age + Math.round(x.pr() * 6 - 2); x.stat('happy', 6); x.stat('social', 3); return 'married'; } },
      { k: 'wait', label: '還不想', hint: '再等等；這種機會不會一直有，錯過兩次可能就一個人過', w: () => 1,
        do: (p, x) => { p.flags.marryWait = p.age + 3; x.stat('happy', -2); return 'notYet'; } },
      { k: 'single', label: '一個人過', hint: '自由，凡事自己作主', w: p => p.age >= 35 ? 0.6 : 0.1, when: p => p.age >= 28,
        do: (p, x) => { p.flags.single = 1; return 'stayingSingle'; } }
    ]
  },
  kids: {
    title: '要不要生小孩？', size: 'big',
    desc: '結婚幾年了，家裡開始有人問。',
    stat: w => '在' + w.c.name + '，一個女生一輩子平均生 ' + (w.c.p.tfr || 2).toFixed(1) + ' 個小孩。',
    opts: [
      { k: 'one', label: '生一個就好', hint: '花費和時間都還撐得住', w: () => 1.5,
        do: (p, x) => { p.kids.push(p.year); p.flags.noKids = 1; x.stat('happy', 4); p.savings -= x.cy.lvl * 0.2; return 'kidFirst'; } },
      { k: 'more', label: '想要好幾個', hint: '家裡熱鬧，錢會很緊', w: () => 0.8,
        do: (p, x) => { p.kids.push(p.year); p.flags.wantMore = 1; x.stat('happy', 4); p.savings -= x.cy.lvl * 0.2; return 'kidFirst'; } },
      { k: 'none', label: '不生', hint: '時間和錢都留給自己', w: () => 0.4,
        do: (p, x) => { p.flags.noKids = 1; return 'noKidsPick'; } }
    ]
  },
  layoff: {
    title: '公司要裁員，你在名單上', size: 'big',
    desc: '景氣不好，主管把你叫進會議室。',
    opts: [
      { k: 'take', label: '拿資遣費，找下一份', hint: '先有一筆錢，但可能要找一陣子', w: () => 1.5,
        do: (p, x) => { p.jobLosses = (p.jobLosses || 0) + 1; p.savings += x.cy.lvl * 0.3; p.job = null; p.flags.unemp = 1; p.flags.laid = 0; x.stat('happy', -5); return 'laidTake'; } },
      { k: 'retrain', label: '回去進修，換一行', hint: '花一年和一筆錢學新的技能，下一份工作可以往上找一級', w: p => p.stats.know / 60, when: p => p.age < 58,
        do: (p, x) => { p.jobLosses = (p.jobLosses || 0) + 1; p.job = null; p.flags.unemp = 1; p.flags.laid = 0; p.savings -= x.cy.lvl * 0.2; x.stat('know', 8); p.flags.retrained = 1; return 'retrain'; } },
      { k: 'own', label: '自己出來做', hint: '沒有老闆，也沒有保障', w: p => p.trait.risk,
        do: (p, x) => { p.flags.laid = 0; x.startJob('risky'); return 'goOwn'; } }
    ]
  },
  bizFail: {
    title: '生意撐不下去了', size: 'big',
    desc: '景氣不好，客人少了一大半，每個月都在賠錢。',
    opts: [
      { k: 'close', label: '收掉，去找工作', hint: '少賠一點，但要從頭開始', w: () => 1.2,
        do: (p, x) => { p.jobLosses = (p.jobLosses || 0) + 1; p.savings -= x.cy.lvl * 0.2; p.job = null; p.flags.unemp = 1; p.flags.laid = 0; x.stat('happy', -4); return 'bizClosed'; } },
      { k: 'hold', label: '咬牙撐下去', hint: '撐過了就是你的；撐不過會賠更多', w: p => 0.4 + p.trait.risk,
        do: (p, x) => { p.flags.laid = 0; if (x.pr() < 0.5) { x.stat('happy', -2); return 'bizHeld'; } p.savings -= x.cy.lvl * 0.6; p.jobLosses = (p.jobLosses || 0) + 1; p.job = null; p.flags.unemp = 1; x.stat('happy', -8); return 'bizLost'; } }
    ]
  },
  war: {
    title: '戰火打到你住的地方', size: 'big',
    desc: '每天都聽得到爆炸聲，鄰居一家一家離開。', softDesc: '仗打到附近，鄰居一家一家離開。',
    opts: [
      { k: 'stay', label: '留下來', hint: '房子和工作都在這裡，但很危險', w: () => 1,
        do: (p, x) => { x.stat('happy', -5); return 'stayWar'; } },
      { k: 'flee', label: '逃到國內安全的地方', hint: '保住命，但要從頭來過', w: () => 1.2,
        do: (p, x) => { p.fled = true; if (p.savings > 0) p.savings *= 0.7; x.stat('happy', -3); return 'fleeIn'; } },
      { k: 'abroad', label: '想辦法逃到國外', hint: '離開戰火，代價也最大：存款剩一半，朋友都在這裡', w: p => p.wealthU, when: p => p.wealthU > 0.5 || p.savings > 0,
        do: (p, x) => { p.fled = true; p.flags.abroad = 1; if (p.savings > 0) p.savings *= 0.5; x.stat('social', -8); return 'fleeOut'; } }
    ]
  },
  currency: {
    title: '錢一直變薄，存款要怎麼辦？', size: 'big',
    desc: '貨幣大貶，大家搶著換外幣。',
    opts: [
      { k: 'local', label: '放著不動', hint: '不用多花手續費，但可能繼續縮水', w: () => 1, do: () => 'keepLocal' },
      { k: 'usd', label: '換成美元', hint: '比較保值，換的時候已經虧了一截', w: p => 0.5 + p.parentEdu * 0.3, do: p => { p.cash = 'usd'; return 'toUsd'; } }
    ]
  },
  care: {
    title: '爸媽需要人照顧', size: 'big',
    desc: '爸媽年紀大了，一個人在家已經不太行。',
    opts: [
      { k: 'self', label: '自己照顧', hint: '陪在身邊，但工作和身體會被拖住', w: p => p.trait.care * 2,
        do: (p, x) => { x.stat('happy', -4); x.stat('health', -3); x.stat('social', 3); if (p.job) p.job.mult *= 0.85; return 'careSelf'; } },
      { k: 'hire', label: '請人照顧', hint: '每個月一大筆錢', w: p => p.wealthU * 2,
        do: (p, x) => { p.savings -= x.cy.lvl * 1.2; return 'careHire'; } },
      { k: 'sib', label: '交給兄弟姊妹，你出錢', hint: '省時間，家裡可能有怨言', w: () => 0.8, when: p => p.sibs > 0,
        do: (p, x) => { p.savings -= x.cy.lvl * 0.5; x.stat('social', -4); return 'careSib'; } }
    ]
  },
  illness: {
    title: '檢查出一場重病', size: 'big',
    desc: '醫生說，越早治療越好，但很花錢。',
    opts: [
      { k: 'treat', label: '積極治療', hint: '治好的機會比較大，自己要付多少錢，看這個國家的醫療照顧', w: () => 1.5,
        do: (p, x) => {
          const uhc = (x.C.p.uhc_proxy || 50) / 100;
          p.savings -= x.cy.lvl * (1.5 * (1 - uhc) + 0.1);
          if (x.pr() < treatChance(uhc)) { p.sick = 2; x.stat('health', -10); return 'cured'; }
          x.stat('health', -15); return 'treatFail';
        } },
      { k: 'mild', label: '保守治療', hint: '花得少，賭病情不要惡化', w: p => 1 - p.wealthU,
        do: (p, x) => { if (x.pr() < treatChance((x.C.p.uhc_proxy || 50) / 100) * 0.5) { p.sick = 2; x.stat('health', -12); return 'mildOk'; } x.stat('health', -20); return 'mildBad'; } }
    ]
  },
  retire: {
    title: '六十五歲，要退休了嗎？', size: 'big',
    desc: '同事陸續退休，你的體力也不比從前。',
    opts: [
      { k: 'retire', label: '退休', hint: '時間都是自己的；做公職或在公司上班才有退休金，其他靠存款', w: () => 1.5,
        do: (p, x) => { p.retired = true; x.stat('happy', 5); return 'retired'; } },
      { k: 'keep', label: '再做幾年', hint: '多存一點錢，身體會比較累', w: p => p.savings < 0 ? 2 : 0.6,
        do: (p, x) => { x.stat('health', -2); return 'workOn'; } }
    ]
  }
};

const api = { fmt, soft, jobs, jobPay, focus, focusFor, causes, cause, choices, uniChance, UNI_SCALE, lines: L };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.PlayText = api;
})(typeof window !== 'undefined' ? window : globalThis);
