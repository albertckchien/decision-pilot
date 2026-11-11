/**
 * 擇路 Pathwise：帳號、點數、問題卡（Haiku）、初階報告。跟 Code.gs 放在同一個 Apps Script 專案。
 *
 * 要先設的 Script Properties（專案設定 → 指令碼屬性）：
 *   ACCOUNTS_SHEET_ID   帳號表（Google 試算表）的 ID，第一列標題見 HEAD
 *   ANTHROPIC_API_KEY   Claude API 金鑰（只放這裡，不進 git、不給前端）
 *   CARD_DAILY_CAP      全站每天最多整理幾張問題卡（沒設就是 200）
 *
 * 另外要把本機產出的兩個檔貼進同一個專案（不放公開 repo）：
 *   初階報告_引擎.gs     規則引擎（Overview）
 *   初階報告_資料.gs     段落庫、國家快照、工具標籤、問題卡提示詞（OV_LIB、OV_QLIB、OV_SNAP、OV_TOOLS、OV_VOCAB、CARD_PROMPT）
 */
var HEAD = ['email', 'pass_hash', 'salt', 'points', 'status', 'kind', 'created', 'card_uses', 'note'];
var SIGNUP_POINTS = 10;       // 新帳號只送一次（intake_form.md 點數表）
var OVERVIEW_POINTS = 10;     // 初階報告的點數
var CARD_USES_MAX = 3;        // 一般帳號最多整理 3 次問題卡（試跑帳號不限）
var SESSION_DAYS = 7;
var HAIKU = 'claude-haiku-5-5';

// Code.gs 的 doPost 認得的動作，加上這幾個（在 Code.gs 的 fn 表裡也要列：見 docs/部署說明.md）
function accountActions_() {
  return { signupStart: signupStart_, signupFinish: signupFinish_, login: login_, me: me_, card: card_, overview: overview_ };
}

// ---------- 帳號表 ----------
function sheet_() {
  var sh = SpreadsheetApp.openById(props_().getProperty('ACCOUNTS_SHEET_ID')).getSheets()[0];
  if (sh.getLastRow() === 0) sh.appendRow(HEAD);
  return sh;
}
function normEmail_(e) {
  e = String(e || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) throw new Error('Email 格式不對');
  return e;
}
function findRow_(email) {
  var sh = sheet_(), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) if (v[i][0] === email) {
    var o = { row: i + 1 }; HEAD.forEach(function (h, j) { o[h] = v[i][j]; }); return o;
  }
  return null;
}
function setCell_(row, col, val) { sheet_().getRange(row, HEAD.indexOf(col) + 1).setValue(val); }
function hash_(pw, salt) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + pw, Utilities.Charset.UTF_8);
  for (var k = 0; k < 2000; k++) b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, b.concat(Utilities.newBlob(salt).getBytes()));
  return Utilities.base64Encode(b);
}
function checkPassword_(pw) {
  pw = String(pw || '');
  if (pw.length < 8 || pw.length > 100) throw new Error('密碼要 8 到 100 個字');
  return pw;
}

// ---------- 試跑帳號（只從 Apps Script 編輯器手動執行，網站叫不到） ----------
// 改下面兩行再按「執行」：每個 Email 開一個試跑帳號、存 TEST_POINTS 點，密碼只印在執行紀錄裡，抄到本機的帳密清單（不進 git）
var TEST_EMAILS = ['someone@example.com'];
var TEST_POINTS = 150;
function adminCreateTestAccounts() {
  TEST_EMAILS.forEach(function (raw) {
    var email = normEmail_(raw);
    if (findRow_(email)) { console.log(email + ' 已經有帳號，跳過'); return; }
    var pw = Utilities.getUuid().replace(/-/g, '').slice(0, 12), salt = Utilities.getUuid();
    sheet_().appendRow([email, hash_(pw, salt), salt, TEST_POINTS, '啟用', '試跑', new Date().toISOString(), 0, '讀書會試跑']);
    console.log(email + '　密碼：' + pw + '　點數：' + TEST_POINTS);
  });
}
// 試跑結束：所有「試跑」帳號改成停用，已登入的也會在下一個動作被擋下
function adminDisableTestAccounts() {
  var sh = sheet_(), v = sh.getDataRange().getValues(), n = 0;
  for (var i = 1; i < v.length; i++) if (v[i][5] === '試跑' && v[i][4] === '啟用') { sh.getRange(i + 1, 5).setValue('停用'); n++; }
  console.log('停用了 ' + n + ' 個試跑帳號');
}

// ---------- 註冊：先寄驗證碼，再設密碼 ----------
function signupStart_(req) {
  var email = normEmail_(req.email);
  if (findRow_(email)) throw new Error('這個 Email 已經註冊過了，請直接登入');
  var cache = CacheService.getScriptCache();
  var sent = Number(cache.get('VS_' + email) || 0);
  if (sent >= 3) throw new Error('驗證碼寄太多次了，請一小時後再試');
  var code = String(Math.floor(100000 + Math.random() * 900000));
  cache.put('VC_' + email, code, 600);
  cache.put('VS_' + email, String(sent + 1), 3600);
  MailApp.sendEmail(email, '【擇路 Pathwise】你的驗證碼', '你的驗證碼是 ' + code + '，10 分鐘內有效。\n\n如果不是你本人申請，不用理會這封信。\n\n擇路 Pathwise');
  return { ok: true };
}
function signupFinish_(req) {
  var email = normEmail_(req.email), pw = checkPassword_(req.password);
  var cache = CacheService.getScriptCache();
  var code = cache.get('VC_' + email);
  if (!code || String(req.code || '').trim() !== code) throw new Error('驗證碼不對或已經過期');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (findRow_(email)) throw new Error('這個 Email 已經註冊過了，請直接登入');
    var salt = Utilities.getUuid();
    sheet_().appendRow([email, hash_(pw, salt), salt, SIGNUP_POINTS, '啟用', '一般', new Date().toISOString(), 0, '']);
  } finally { lock.releaseLock(); }
  cache.remove('VC_' + email);
  return { ok: true, session: newSession_(email), points: SIGNUP_POINTS };
}

// ---------- 登入和工作階段 ----------
function login_(req) {
  var email = normEmail_(req.email), a = findRow_(email);
  if (!a || hash_(String(req.password || ''), a.salt) !== a.pass_hash) throw new Error('Email 或密碼不對');
  if (a.status !== '啟用') throw new Error('這個帳號已經停用');
  return { ok: true, session: newSession_(email), points: Number(a.points) };
}
function newSession_(email) {
  var t = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
  props_().setProperty('S_' + t, JSON.stringify({ email: email, exp: Date.now() + SESSION_DAYS * 864e5 }));
  return t;
}
function account_(req) {
  var t = String(req.session || '');
  if (!/^[a-f0-9]{64}$/.test(t)) throw new Error('請先登入');
  var s = props_().getProperty('S_' + t);
  if (!s) throw new Error('請重新登入');
  s = JSON.parse(s);
  if (s.exp < Date.now()) { props_().deleteProperty('S_' + t); throw new Error('登入過期了，請重新登入'); }
  var a = findRow_(s.email);
  if (!a || a.status !== '啟用') throw new Error('這個帳號已經停用');
  return a;
}
function me_(req) { var a = account_(req); return { ok: true, email: a.email, points: Number(a.points), cardUses: Number(a.card_uses), kind: a.kind }; }

// ---------- 問題卡：一次 Haiku ----------
var CARD_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['重述', '要決定的事', '兩難型態', '第0級', 'A', 'A的代價', 'B', 'B的代價', '要決定的時間', '你最擔心的事', '缺的資料'],
  properties: {
    '重述': { type: 'string' }, '要決定的事': { type: 'string' },
    '兩難型態': { type: 'string', enum: ['走還是留', '擴大還是守住', '縮小或收掉', '錢和夥伴', '人和交棒', '都不是'] },
    '第0級': { type: 'string' }, 'A': { type: 'string' }, 'A的代價': { type: 'string' },
    'B': { type: 'string' }, 'B的代價': { type: 'string' }, '要決定的時間': { type: 'string' },
    '你最擔心的事': { type: 'string' }, '缺的資料': { type: 'array', items: { type: 'string' } }
  }
};
var CARD_LIMITS = { '重述': 150, '要決定的事': 60, 'A': 40, 'A的代價': 60, 'B': 40, 'B的代價': 60, '要決定的時間': 40, '你最擔心的事': 80 };

function card_(req) {
  var a = account_(req);
  var story = String(req.story || '').trim();
  if (story.length < 50) throw new Error('請多寫一點，至少 50 個字');
  if (story.length > 1000) throw new Error('請縮到 1,000 字以內');
  if (a.kind !== '試跑' && Number(a.card_uses) >= CARD_USES_MAX) throw new Error('這個帳號整理問題卡的次數用完了');
  dailyCap_();
  var card = callHaiku_(story, req.profileText || '');
  setCell_(a.row, 'card_uses', Number(a.card_uses) + 1);   // 呼叫成功才算一次
  if (card['第0級'] && card['第0級'] !== '否') {
    return { ok: true, declined: true, message: '這件事我們目前沒辦法替你整理。' };   // 第 0 級：不點名、不附專線（intake_form.md 四級界線）
  }
  return { ok: true, card: card, usesLeft: a.kind === '試跑' ? null : CARD_USES_MAX - Number(a.card_uses) - 1 };
}
function dailyCap_() {
  var p = props_(), day = Utilities.formatDate(new Date(), 'Asia/Taipei', 'yyyyMMdd');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var n = Number(p.getProperty('CARDS_' + day) || 0);
    if (n >= Number(p.getProperty('CARD_DAILY_CAP') || 200)) throw new Error('今天的名額滿了，請明天再來');
    p.setProperty('CARDS_' + day, String(n + 1));
  } finally { lock.releaseLock(); }
}
function callHaiku_(story, profileText) {
  var key = props_().getProperty('ANTHROPIC_API_KEY');
  if (!key) throw new Error('後台還沒設定好，請稍後再試');
  var body = {
    model: HAIKU, max_tokens: 2000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: CARD_SCHEMA } },
    system: CARD_PROMPT,   // 在 初階報告_資料.gs
    messages: [{ role: 'user', content: '<用戶寫的描述>\n' + story + '\n</用戶寫的描述>\n<個人檔案>\n' + profileText + '\n</個人檔案>' }]
  };
  var last;
  for (var attempt = 0; attempt < 2; attempt++) {
    var res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
      method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { 'x-api-key': key, 'anthropic-version': '2026-10-21' },
      payload: JSON.stringify(body)
    });
    var code = res.getResponseCode();
    if (code === 429 || code >= 500) { last = 'API ' + code; Utilities.sleep(1500 * (attempt + 1)); continue; }
    if (code !== 200) { console.error('Claude API ' + code + ' ' + res.getContentText().slice(0, 300)); throw new Error('整理的時候出了問題，這次不算次數，請再試一次'); }
    var msg = JSON.parse(res.getContentText());
    if (msg.stop_reason === 'refusal') return { '第0級': '範圍外' };
    if (msg.stop_reason === 'max_tokens') { last = 'max_tokens'; continue; }
    var text = (msg.content || []).filter(function (b) { return b.type === 'text'; }).map(function (b) { return b.text; }).join('');
    var card = JSON.parse(text);
    var bad = Object.keys(CARD_LIMITS).filter(function (k) { return String(card[k] || '').length > CARD_LIMITS[k]; });
    if (bad.length && attempt === 0) { last = '太長：' + bad.join('、'); continue; }   // 太長重來一次；第二次還太長就照給，用戶可以改
    return card;
  }
  console.error('Haiku 兩次都沒成功：' + last);
  throw new Error('整理的時候出了問題，這次不算次數，請再試一次');
}

// ---------- 初階報告：扣 10 點，照規則產生 ----------
function overview_(req) {
  var a = account_(req);
  var card = req.card || {}, answers = req.answers || {}, profile = req.profile || {};
  if (!card['兩難型態']) throw new Error('缺問題卡');
  var res = { lib: OV_LIB, qlib: OV_QLIB, snap: OV_SNAP, tools: OV_TOOLS, vocab: OV_VOCAB };
  var o = Overview.build({ type: card['兩難型態'], answers: answers, profile: profile }, res);
  if (!o.ok) return { ok: true, notReady: true, text: o.text };   // 還沒做的型態：不扣點
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var left;
  try {
    var fresh = findRow_(a.email);
    if (Number(fresh.points) < OVERVIEW_POINTS) throw new Error('點數不夠，初階報告要 ' + OVERVIEW_POINTS + ' 點');
    left = Number(fresh.points) - OVERVIEW_POINTS;
    setCell_(fresh.row, 'points', left);
  } finally { lock.releaseLock(); }
  var md = Overview.toMarkdown(card, o, OV_QLIB.macro) +
    '\n\n---\n這份初階報告的問題整理由 AI 協助，內容由規則產生，經規則和資料檢核，沒有針對你的情況做判斷。';
  return { ok: true, report: md, points: left };
}
