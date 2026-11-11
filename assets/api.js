// 跟 Apps Script 後台說話。用 text/plain 送 JSON，避免瀏覽器先送預檢請求（Apps Script 不回應 OPTIONS）。
window.pilotApi = function (action, payload) {
  var url = window.PILOT && window.PILOT.API_URL;
  if (!url) return Promise.reject(new Error('網站還沒接上後台（config.js 的 API_URL 是空的）'));
  var body = JSON.stringify(Object.assign({ action: action }, payload || {}));
  // 60 秒沒回應就停，不讓按鈕一直卡在「處理中」
  var ctl = window.AbortController ? new AbortController() : null;
  var timer = ctl ? setTimeout(function () { ctl.abort(); }, 60000) : null;
  return fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: body, redirect: 'follow', signal: ctl ? ctl.signal : undefined })
    .catch(function (e) { throw new Error(e && e.name === 'AbortError' ? '等太久沒有回應，請再按一次' : '連不上後台，請檢查網路後再試'); })
    .then(function (r) { if (timer) clearTimeout(timer); if (!r.ok) throw new Error('連線失敗（' + r.status + '）'); return r.json(); })
    .then(function (j) { if (!j.ok) throw new Error(j.error || '後台回了錯誤'); return j; });
};

// 讀檔變 base64（不含 data: 開頭）
window.fileToBase64 = function (file) {
  return new Promise(function (resolve, reject) {
    var fr = new FileReader();
    fr.onload = function () { resolve(String(fr.result).split(',')[1]); };
    fr.onerror = function () { reject(new Error('讀不到檔案：' + file.name)); };
    fr.readAsDataURL(file);
  });
};

// 瀏覽器儲存可能被擋，包起來
window.safeStore = {
  get: function (k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
  set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del: function (k) { try { localStorage.removeItem(k); } catch (e) {} }
};
