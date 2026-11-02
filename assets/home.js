// 首頁：進場動畫、權重倒過來的小比較表。
(function () {
  // 進場：每個區塊進到畫面才出現一次
  var els = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  } else {
    els.forEach(function (el) { el.classList.add('in'); });
  }

  // 權重倒過來：點一個目標把它排第一，權重照順序 3、2、1
  var names = ['事業', '家庭', '財務'];
  var opts = ['全家外派', '留在台灣', '先談條件再簽'];
  var scores = [[5, 2, 4], [2, 4, 5], [4, 4, 4]];
  var order = [0, 1, 2];
  var buttons = document.querySelectorAll('.goal');
  var rows = document.querySelectorAll('.w-table tbody tr');
  var heads = document.querySelectorAll('.w-table .g-h');
  var verdict = document.querySelector('.w-verdict');
  if (!buttons.length) return;

  function render() {
    var w = [0, 0, 0];
    order.forEach(function (g, i) { w[g] = 3 - i; });
    heads.forEach(function (h, g) { h.textContent = names[g] + '×' + w[g]; });
    var totals = scores.map(function (s) { return s[0] * w[0] + s[1] * w[1] + s[2] * w[2]; });
    var best = Math.max.apply(null, totals);
    rows.forEach(function (r, i) {
      r.querySelector('.tot').textContent = totals[i];
      r.classList.toggle('win', totals[i] === best);
    });
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(+b.dataset.goal === order[0])); });
    var winners = opts.filter(function (o, i) { return totals[i] === best; });
    verdict.textContent = '照「' + order.map(function (g) { return names[g]; }).join('、') + '」的順序，「' + winners.join('」和「') + '」最高。';
  }
  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      var g = +b.dataset.goal;
      order = [g].concat(order.filter(function (x) { return x !== g; }));
      render();
    });
  });
  render();
})();
