/**
 * 擇路 Pathwise（讀書會試跑）後台。貼進 Google Apps Script，發布成網頁應用程式（執行身分：我；存取：所有人）。
 * Script Properties 要設：ROOT_FOLDER_ID（存資料的私人資料夾 ID）、INVITE（邀請碼）、OWNER_EMAIL（新件通知寄給誰）、SITE_URL（前台網址，結尾不要斜線）。
 * 每份一個資料夾 P01_xxxxxxxx，裡面的檔案名稱見 docs/部署說明.md「資料夾裡有什麼」。
 */
var MAX_B64 = 11500000; // 約 8MB 的檔案
var STAGES = ['received', 'card', 'questions', 'making', 'done', 'declined'];

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    var fn = {
      submit: submit_, upload: upload_, get: get_, confirmCard: confirmCard_,
      answer: answer_, feedback: feedback_, download: download_
    }[req.action];
    if (!fn) return out_({ ok: false, error: '不認得的動作' });
    return out_(fn(req));
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message || err) });
  }
}
function doGet() { return out_({ ok: true, hello: '擇路試跑後台' }); }
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function props_() { return PropertiesService.getScriptProperties(); }

// ---------- 送出申請 ----------
function submit_(req) {
  var p = props_();
  if (!req.consent) throw new Error('要先勾同意');
  if (String(req.invite || '').trim() !== String(p.getProperty('INVITE') || '').trim()) throw new Error('邀請碼不對');
  var f = req.form || {};
  if (!f.name || !f.email || !f.story) throw new Error('稱呼、Email 和描述都要填');
  if (String(f.story).length > 20000) throw new Error('描述太長了，請縮到 2 萬字以內');

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  var n;
  try { n = Number(p.getProperty('COUNTER') || 0) + 1; p.setProperty('COUNTER', String(n)); } finally { lock.releaseLock(); }
  var caseId = 'P' + ('0' + n).slice(-2);
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  var root = DriveApp.getFolderById(p.getProperty('ROOT_FOLDER_ID'));
  var folder = root.createFolder(caseId + '_' + token.slice(0, 8));
  folder.createFolder('附件'); folder.createFolder('交付');
  var comp = folder.createFolder('公司調查區');

  write_(folder, '00_用戶描述.md', '# 用戶寫的描述（原文）\n\n## 你卡在哪裡\n\n' + f.story + '\n\n## 多久內要決定\n\n' + (f.deadline || '') + '\n\n## 想要哪一種報告\n\n' + (f.kind || '') + '\n');
  write_(folder, '個人檔案.md', '# 個人檔案\n\n' + table_([
    ['年齡', f.age], ['所在國家和城市', f.place], ['角色', f.role], ['公司名稱', f.company], ['公司官網', f.website], ['職稱', f.title], ['產業', f.industry],
    ['家庭狀況', (f.family || []).join('、')], ['人生目標第一名', f.goal1], ['人生目標第二名', f.goal2], ['人生目標第三名', f.goal3],
    ['決策習慣', f.habit], ['風險承受度', f.risk], ['你有什麼別人比較少有的', f.edge], ['你同時懂哪兩邊', f.twoSides],
    ['個人存款大約多少', f.savings], ['每月固定支出大約多少', f.spend],
    ['員工數', f.staff], ['成立幾年', f.years], ['年營收級距', f.revenue], ['現在有沒有賺錢', f.profit], ['公司現金大約多少', f.cash],
    ['每月營收和每月支出', f.flow], ['客戶主要是企業還是個人', f.b2b], ['是不是家族企業', f.familyBiz]
  ]));
  write_(folder, '聯絡.md', '# 聯絡（只給 Albert，不給任何 AI 步驟）\n\n' + table_([['稱呼', f.name], ['Email', f.email], ['LINE', f.line]]));
  write_(comp, '公司.md', '# 公司調查的輸入\n\n' + table_([['公司名稱', f.company], ['公司官網', f.website], ['產業', f.industry]]));
  writeJson_(folder, '狀態.json', { stage: 'received', message: '', notified: 'received', email: f.email, name: f.name, createdAt: new Date().toISOString() });

  p.setProperty('T_' + token, folder.getId());
  var owner = p.getProperty('OWNER_EMAIL');
  if (owner) MailApp.sendEmail(owner, '【擇路 Pathwise】新的一份：' + caseId, caseId + '（' + f.name + '）送出了。資料夾：' + folder.getUrl());
  return { ok: true, caseId: caseId, token: token };
}

function upload_(req) {
  var folder = folderOf_(req.token);
  var data = String(req.data || '');
  if (data.length > MAX_B64) throw new Error('檔案超過 8MB');
  var att = sub_(folder, '附件');
  if (att.getFiles().hasNext()) { var c = 0, it = att.getFiles(); while (it.hasNext()) { it.next(); c++; } if (c >= 3) throw new Error('最多 3 個檔案'); }
  var name = String(req.name || 'file').replace(/[\\\/:*?"<>|]/g, '_').slice(0, 120);
  att.createFile(Utilities.newBlob(Utilities.base64Decode(data), req.mime || 'application/octet-stream', name));
  return { ok: true };
}

// ---------- 進度頁讀資料 ----------
function get_(req) {
  var folder = folderOf_(req.token);
  var st = readJson_(folder, '狀態.json') || { stage: 'received' };
  var r = { ok: true, stage: STAGES.indexOf(st.stage) >= 0 ? st.stage : 'received', message: st.message || '' };
  if (r.stage === 'card') r.card = read_(folder, '問題卡_給用戶.md') || read_(folder, '問題卡.md');
  if (r.stage === 'questions') r.questions = (readJson_(folder, '追問.json') || {}).questions || [];
  if (r.stage === 'declined') r.declineReason = st.declineReason || '';
  if (r.stage === 'done') {
    r.report = read_(folder, '報告_給用戶.md') || read_(folder, '分析報告.md') || read_(folder, '完整報告.md');
    r.sim = readJson_(folder, '人生模擬.json');
    r.quote = readJson_(folder, '一句話.json');
    r.pilotNote = st.pilotNote || '';
    r.downloads = [];
    var it = sub_(folder, '交付').getFiles(); while (it.hasNext()) r.downloads.push(it.next().getName());
    r.feedbackDone = !!find_(folder, '回饋.json');
  }
  return r;
}

function confirmCard_(req) {
  var folder = folderOf_(req.token);
  write_(folder, '問題卡_用戶回覆.md', '# 用戶確認問題卡（' + new Date().toISOString() + '）\n\n' + (req.edits ? '## 要改或補充的地方\n\n' + req.edits : '沒有要改。') + '\n');
  setStage_(folder, 'making', '收到你的確認。如果還有要問你的，會再寄信請你回來回答。');
  ping_(folder, '確認了問題卡');
  return { ok: true };
}

function answer_(req) {
  var folder = folderOf_(req.token);
  var n = 1; while (find_(folder, '追問答案_第' + n + '輪.md')) n++;
  var body = (req.answers || []).map(function (x) { return '## ' + x.q + '\n\n' + (x.a || '（沒有回答）'); }).join('\n\n');
  write_(folder, '追問答案_第' + n + '輪.md', '# 追問答案：第 ' + n + ' 輪\n\n' + body + '\n');
  setStage_(folder, 'making', '收到你的回答，報告製作中。');
  ping_(folder, '回答了第 ' + n + ' 輪追問');
  return { ok: true };
}

function feedback_(req) {
  var folder = folderOf_(req.token);
  writeJson_(folder, '回饋.json', Object.assign({ at: new Date().toISOString() }, req.feedback || {}));
  ping_(folder, '填了回饋');
  return { ok: true };
}

function download_(req) {
  var folder = folderOf_(req.token);
  var it = sub_(folder, '交付').getFilesByName(String(req.name || ''));
  if (!it.hasNext()) throw new Error('找不到這個檔案');
  var blob = it.next().getBlob();
  return { ok: true, mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) };
}

// ---------- 階段改了就寄信給同學（設成每 10 分鐘跑一次的觸發條件） ----------
function notifyChanges() {
  var p = props_(), site = p.getProperty('SITE_URL') || '';
  var all = p.getProperties();
  var words = { card: '問題卡整理好了，請回來確認', questions: '我們還想多問你幾件事', done: '你的報告好了', declined: '關於你送出的內容' };
  Object.keys(all).forEach(function (k) {
    if (k.indexOf('T_') !== 0) return;
    var folder = DriveApp.getFolderById(all[k]);
    var st = readJson_(folder, '狀態.json'); if (!st || !st.email) return;
    if (st.notified === st.stage || !words[st.stage]) return;
    var link = site + '/case.html?t=' + k.slice(2);
    MailApp.sendEmail(st.email, '【擇路 Pathwise】' + words[st.stage], (st.name || '你好') + '，\n\n' + words[st.stage] + '：\n' + link + '\n\n這個連結只給你，請不要轉給別人。\n\n擇路 Pathwise（讀書會試跑）');
    st.notified = st.stage; writeJson_(folder, '狀態.json', st);
  });
}

// ---------- 小工具 ----------
function folderOf_(token) {
  if (!token || !/^[a-f0-9]{40}$/.test(String(token))) throw new Error('連結不對');
  var id = props_().getProperty('T_' + token);
  if (!id) throw new Error('找不到這一份，請確認連結');
  return DriveApp.getFolderById(id);
}
function sub_(folder, name) { var it = folder.getFoldersByName(name); return it.hasNext() ? it.next() : folder.createFolder(name); }
function find_(folder, name) { var it = folder.getFilesByName(name); return it.hasNext() ? it.next() : null; }
function read_(folder, name) { var f = find_(folder, name); return f ? f.getBlob().getDataAsString('UTF-8') : ''; }
function readJson_(folder, name) { var s = read_(folder, name); try { return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function write_(folder, name, text) { var f = find_(folder, name); if (f) f.setContent(text); else folder.createFile(name, text, 'text/markdown'); }
function writeJson_(folder, name, obj) { write_(folder, name, JSON.stringify(obj, null, 2)); }
function setStage_(folder, stage, msg) { var st = readJson_(folder, '狀態.json') || {}; st.stage = stage; st.message = msg || ''; writeJson_(folder, '狀態.json', st); }
function ping_(folder, what) { var o = props_().getProperty('OWNER_EMAIL'); if (o) MailApp.sendEmail(o, '【擇路 Pathwise】' + folder.getName() + ' ' + what, folder.getUrl()); }
function table_(rows) {
  return '| 欄位 | 內容 |\n|---|---|\n' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '| ' + r[0] + ' | ' + String(r[1]).replace(/\n/g, ' ').replace(/\|/g, '／') + ' |'; }).join('\n') + '\n';
}
