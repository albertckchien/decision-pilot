// 首頁：進場動畫、挑一個人看兩條路（engine/demo/*.json，simulate.js 先算好）。
(function () {
  var els = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('in'); });
  }

  // 挑一個人：換人就重畫播放器；同一份資料只抓一次
  var root = document.getElementById('sim-root'), btns = document.querySelectorAll('.who'), cache = {}, want = null;
  if (!root || !btns.length || !window.renderSim || !window.fetch) return;
  function show(k, scroll) {
    want = k;
    btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.who === k)); });
    var got = cache[k] ? Promise.resolve(cache[k]) : fetch('engine/demo/' + k + '.json?v=20261114a').then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); });
    got.then(function (d) {
      cache[k] = d; if (want !== k) return;
      root.innerHTML = ''; window.renderSim(root, d, { mode: 'paths' });
      if (scroll) root.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }).catch(function () { root.innerHTML = '<p>這段人生暫時載入不了，重新整理一次試試。</p>'; });
  }
  btns.forEach(function (b) { b.onclick = function () { show(b.dataset.who, true); }; });
  show(btns[0].dataset.who, false);
})();
