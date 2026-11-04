// 首頁：進場動畫、開頭那一格會動的人生、如果人生的播放器（讀範例情境 engine/example_out.json）。
(function () {
  // 進場：每個區塊進到畫面才出現一次；沒有 JS 時內容照樣看得到
  var els = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('in'); });
  }

  // 開頭大字裡那一格：一家人在城市裡走，慢慢變老（每 1.2 秒一年）
  var slot = document.querySelector('.slot-px');
  if (slot && window.PixelScene) {
    var sc = window.PixelScene(slot), age = 38, reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var draw = function () { sc.set({ city: age < 63 ? '台灣' : '台灣', age: age, spouse: true, spouseFemale: true, kids: [{ age: age - 31, female: true }, { age: age - 34, female: false }] }); };
    draw();
    if (!reduce) setInterval(function () { age = age >= 88 ? 38 : age + 1; draw(); }, 1200);
  }

  // 如果人生：範例情境
  var root = document.getElementById('sim-root');
  if (root && window.renderSim && window.fetch) {
    fetch('engine/example_out.json').then(function (r) { return r.json(); }).then(function (d) { window.renderSim(root, d); })
      .catch(function () { root.insertAdjacentHTML('beforeend', '<p>範例模擬暫時載入不了，重新整理一次試試。</p>'); });
  }
})();
