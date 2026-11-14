// 「跟你同一年出生的 100 個嬰兒」點陣圖（2026-11-15）：首頁和「再活一次」開始頁共用。
// 照遊戲同一份出生人數（play/data/index.json，聯合國《世界人口展望 2024》），跟著「你今年幾歲」換年份。
// <figure data-babies data-src="…/index.json" data-age="輸入框 id" [data-home="住的國家選單 id"]>
(function () {
  'use strict';
  const fig = document.querySelector('[data-babies]');
  if (!fig) return;
  const ageEl = document.getElementById(fig.dataset.age), homeEl = fig.dataset.home ? document.getElementById(fig.dataset.home) : null;
  const COLORS = ['#6E1A34', '#D6B163', '#B5596F', '#8A7166', '#E3AEB9'], OTHER = '#DCCDC4', TOP = 5, N = 100;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const homeIso = () => { if (homeEl && homeEl.value) return homeEl.value; try { return localStorage.getItem('play.home') || 'TWN'; } catch (e) { return 'TWN'; } };
  let idx = null, last = '';

  // 100 個點照比例分：先取整數，剩下的照小數大小補（最大餘數法），合起來剛好 100
  function allocate(shares) {
    const raw = shares.map(s => s.p * N), n = raw.map(Math.floor);
    let left = N - n.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - n[i], i]).sort((a, b) => b[0] - a[0]).slice(0, left).forEach(([, i]) => { n[i]++; });
    return n;
  }
  const perHome = p => p * N >= 1 ? '每 100 個有 ' + Math.round(p * N) + ' 個' : p * 1e4 >= 1 ? '每 1 萬個只有 ' + Math.round(p * 1e4) + ' 個' : '每 1 萬個不到 1 個';

  function render() {
    if (!idx) return;
    const now = idx.birthYears[1], y0 = idx.birthYears[0], len = idx.countries[0].b.length;
    const v = Number(ageEl && ageEl.value), age = Number.isFinite(v) && ageEl.value !== '' ? Math.max(0, Math.min(90, Math.round(v))) : 30;
    const by = now - age, k = Math.max(0, Math.min(len - 1, by - y0)), home = homeIso(), key = k + '|' + home;
    if (key === last) return; last = key;
    const tot = idx.countries.reduce((s, c) => s + (c.b[k] || 0), 0);
    const all = idx.countries.map(c => ({ iso: c.iso, name: c.name, p: (c.b[k] || 0) / tot })).sort((a, b) => b.p - a.p);
    const top = all.slice(0, TOP), rest = all.slice(TOP), restP = rest.reduce((s, c) => s + c.p, 0);
    const n = allocate(top.concat([{ p: restP }]));
    const dots = [];
    top.forEach((c, i) => { for (let j = 0; j < n[i]; j++) dots.push('<i style="--c:' + COLORS[i] + '" title="' + esc(c.name) + '"></i>'); });
    for (let j = 0; j < n[TOP]; j++) dots.push('<i style="--c:' + OTHER + '" title="其他國家"></i>');
    const h = all.find(c => c.iso === home);
    const legend = top.map((c, i) => '<li><i style="--c:' + COLORS[i] + '"></i>' + esc(c.name) + '<b>' + n[i] + '</b></li>').join('') +
      '<li><i style="--c:' + OTHER + '"></i>其他 ' + rest.length + ' 國<b>' + n[TOP] + '</b></li>';
    const yr = Math.max(y0, by);
    fig.innerHTML = '<figcaption class="bb-h">' + yr + ' 年出生的 100 個嬰兒</figcaption>' +
      '<div class="bb-grid" role="img" aria-label="' + esc(yr + ' 年出生的 100 個嬰兒：' + top.map((c, i) => c.name + ' ' + n[i] + ' 個').join('、') + '，其他 ' + rest.length + ' 國 ' + n[TOP] + ' 個') + '">' + dots.join('') + '</div>' +
      '<ul class="bb-legend">' + legend + '</ul>' +
      (h && top.every(c => c.iso !== h.iso) ? '<p class="bb-home">' + esc((homeEl ? '你住的' : '') + h.name + '：' + perHome(h.p)) + '</p>' : '') +
      '<p class="bb-note">' + (by < y0 ? '你出生那年沒有資料，用 ' + y0 + ' 年的出生人數。' : '') + '照聯合國《世界人口展望 2024》各國出生人數' + (by >= 2024 ? '（推估）' : '') + '。遊戲就照這個比例抽。</p>';
  }

  fetch(fig.dataset.src, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(j => { idx = j; render(); fig.classList.add('on'); })
    .catch(() => { fig.hidden = true; });
  if (ageEl) ageEl.addEventListener('input', render);
  if (homeEl) homeEl.addEventListener('change', render);
  // 住的國家選單是遊戲載入資料後才填的，填好時再畫一次
  if (homeEl) new MutationObserver(render).observe(homeEl, { childList: true });
})();
