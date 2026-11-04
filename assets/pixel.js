// 8-bit 像素場景（用戶 2026-11-03：照 1in8b 的像素風）。邏輯解析度 160×90，用 CSS 放大、像素不模糊。
(function () {
  var W = 160, H = 90;
  // 人物點陣：. 透明、H 頭髮、S 皮膚、E 眼睛、B 衣服、b 衣服暗部、P 褲子、K 鞋、C 拐杖、R 嘴
  var ADULT_M = [
    '....HHHHH...', '...HHHHHHH..', '...HSSSSSH..', '...SESSSES..', '...SSSRSSS..', '....SSSSS...',
    '..bBBBBBBBb.', '.bBBBBBBBBBb', '.SBBBBBBBBBS', '.SBBBBBBBBBS', '.SBBBBBBBBBS', '..BBBBBBBBB.',
    '..PPPPPPPPP.', '..PPPP.PPPP.', '..PPPP.PPPP.', '..PPPP.PPPP.', '..PPPP.PPPP.', '.KKKKK.KKKKK'];
  var ADULT_F = [
    '...HHHHHHH..', '..HHHHHHHHH.', '..HHSSSSSHH.', '..HSESSSESH.', '..HSSSRSSSH.', '..HHSSSSSHH.',
    '..bBBBBBBBb.', '.bBBBBBBBBBb', '.SBBBBBBBBBS', '.SBBBBBBBBBS', '.SBBBBBBBBBS', '..BBBBBBBBB.',
    '..BBBBBBBBB.', '...SSS.SSS..', '...SSS.SSS..', '...SSS.SSS..', '...SSS.SSS..', '..KKKK.KKKK.'];
  var KID = [
    '..HHHHH..', '.HHHHHHH.', '.HSSSSSH.', '.SESSSES.', '.SSSRSSS.', '..bBBBb..', '.SBBBBBS.', '.SBBBBBS.',
    '..PPPPP..', '..PP.PP..', '..PP.PP..', '.KKK.KKK.'];
  var BABY = ['.HHH.', 'HSSSH', 'SESES', '.BBB.', 'SBBBS', '.P.P.'];

  function sprite(ctx, rows, x, y, pal, bob) {
    for (var r = 0; r < rows.length; r++) for (var c = 0; c < rows[r].length; c++) {
      var k = rows[r][c]; if (k === '.') continue;
      var col = pal[k]; if (!col) continue;
      ctx.fillStyle = col; ctx.fillRect(x + c, y + r + (bob && r >= rows.length - 6 && (c % 2) ? 0 : 0), 1, 1);
    }
  }
  function hairOf(age) { return age >= 75 ? '#e8e8e8' : age >= 62 ? '#b9b9b9' : age >= 52 ? '#6d6d6d' : '#2b2118'; }
  function person(ctx, x, y, age, female, shirt, frame) {
    var rows = female ? ADULT_F : ADULT_M;
    var pal = { H: hairOf(age), S: '#f1c9a5', E: '#222', R: '#c0705a', B: shirt, b: shade(shirt), P: female ? shirt : '#2e3a5c', K: '#3a2a20' };
    var stoop = age >= 70 ? 1 : 0, lift = frame % 2;
    // 走路：兩格交替抬腳
    var r2 = rows.slice();
    if (lift) { r2[r2.length - 1] = r2[r2.length - 1].replace(/K/g, (m, i) => (i < 6 ? '.' : 'K')); }
    sprite(ctx, r2.slice(0, 6), x + stoop, y, pal);
    sprite(ctx, r2.slice(6), x, y + 6, pal);
    if (age >= 72) { ctx.fillStyle = '#7a5530'; ctx.fillRect(x + 12, y + 9, 1, 9); ctx.fillRect(x + 11, y + 9, 1, 1); }
  }
  function kid(ctx, x, y, age, female, shirt) {
    if (age < 3) { sprite(ctx, BABY, x, y + 6, { H: '#2b2118', S: '#f1c9a5', E: '#222', B: shirt, P: '#555' }); return; }
    if (age >= 15) { person(ctx, x - 1, y - 6, 20, female, shirt, 0); return; }
    sprite(ctx, KID, x, y, { H: '#2b2118', S: '#f1c9a5', E: '#222', R: '#c0705a', B: shirt, b: shade(shirt), P: female ? shirt : '#3d4a6b', K: '#3a2a20' });
  }
  function shade(hex) { var n = parseInt(hex.slice(1), 16), r = (n >> 16) * 0.75, g = ((n >> 8) & 255) * 0.75, b = (n & 255) * 0.75; return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')'; }

  function rect(ctx, c, x, y, w, h) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }
  function sky(ctx, top, bottom) { for (var i = 0; i < 6; i++) rect(ctx, i < 3 ? top : bottom, 0, i * 10, W, 10); }
  function clouds(ctx, t) {
    var x = (t * 0.15) % (W + 40) - 40;
    [[x, 10], [x + 70, 18], [x + 130, 8]].forEach(function (p) { var cx = ((p[0] % (W + 40)) + W + 40) % (W + 40) - 20; rect(ctx, '#ffffff', cx, p[1], 14, 3); rect(ctx, '#ffffff', cx + 3, p[1] - 2, 8, 2); });
  }
  function city(ctx) {
    var bs = [[2, 28], [14, 36], [26, 24], [38, 40], [50, 30], [62, 22], [74, 34], [86, 44], [98, 26], [110, 38], [122, 30], [134, 42], [146, 26]];
    bs.forEach(function (b, i) { rect(ctx, i % 3 === 0 ? '#8a8fa8' : i % 3 === 1 ? '#7c829e' : '#959ab2', b[0], 62 - b[1], 11, b[1]); for (var y = 62 - b[1] + 3; y < 60; y += 5) { rect(ctx, '#d9dcee', b[0] + 2, y, 2, 2); rect(ctx, '#d9dcee', b[0] + 7, y, 2, 2); } });
  }
  function taipei(ctx) {
    var bs = [[4, 30], [16, 24], [26, 34], [40, 20], [52, 28], [96, 26], [108, 36], [120, 22], [134, 30], [146, 24]];
    bs.forEach(function (b, i) { rect(ctx, i % 2 ? '#8892b0' : '#7a84a6', b[0], 62 - b[1], 10, b[1]); for (var y = 62 - b[1] + 3; y < 60; y += 5) { rect(ctx, '#c9d3f0', b[0] + 2, y, 2, 2); rect(ctx, '#c9d3f0', b[0] + 6, y, 2, 2); } });
    // 101：一節一節往上
    var x = 72; for (var s = 0; s < 8; s++) rect(ctx, '#5b6a8f', x + 1, 58 - s * 6, 12, 6), rect(ctx, '#6f7fa6', x, 58 - s * 6, 14, 1);
    rect(ctx, '#5b6a8f', x + 4, 6, 6, 6); rect(ctx, '#5b6a8f', x + 6, 1, 2, 5);
  }
  function singapore(ctx) {
    var bs = [[4, 26], [18, 32], [30, 22], [118, 30], [132, 24], [146, 34]];
    bs.forEach(function (b, i) { rect(ctx, i % 2 ? '#7f9a96' : '#6f8a86', b[0], 62 - b[1], 11, b[1]); for (var y = 62 - b[1] + 3; y < 60; y += 5) rect(ctx, '#d5ece7', b[0] + 3, y, 5, 2); });
    // 濱海灣金沙：三棟加頂上的船
    [56, 74, 92].forEach(function (x) { rect(ctx, '#4f6f6a', x, 28, 9, 34); rect(ctx, '#5f807b', x + 1, 30, 2, 30); });
    rect(ctx, '#3f5a56', 50, 25, 56, 3); rect(ctx, '#3f5a56', 104, 26, 4, 2);
  }
  function park(ctx) {
    [[14, 0], [40, 1], [118, 0], [144, 1]].forEach(function (t) { rect(ctx, '#6b4a2b', t[0] + 4, 44, 3, 18); rect(ctx, t[1] ? '#3f7a3a' : '#4f8a46', t[0], 30, 11, 15); rect(ctx, '#5c9a52', t[0] + 2, 27, 7, 4); });
    rect(ctx, '#8a6a44', 96, 54, 16, 2); rect(ctx, '#6b4a2b', 97, 56, 2, 6); rect(ctx, '#6b4a2b', 109, 56, 2, 6);
  }
  function ground(ctx, kind) {
    rect(ctx, kind === 'park' ? '#7fae6a' : '#9aa59a', 0, 62, W, 28);
    rect(ctx, kind === 'park' ? '#6f9e5a' : '#8a958a', 0, 62, W, 2);
    for (var x = 0; x < W; x += 8) rect(ctx, kind === 'park' ? '#8fbe7a' : '#a9b4a9', x, 70 + (x % 16 ? 6 : 0), 4, 1);
  }

  window.PixelScene = function (canvas) {
    var ctx = canvas.getContext('2d'); canvas.width = W; canvas.height = H; ctx.imageSmoothingEnabled = false;
    var state = { city: '台灣', age: 40, retired: false, spouse: true, spouseFemale: true, kids: [], female: false }, t = 0, raf = null;
    function draw() {
      t++;
      var old = state.age >= 63, kind = old ? 'park' : state.city === '新加坡' ? 'sg' : state.city === '台灣' ? 'tw' : 'gen';
      if (kind === 'sg') sky(ctx, '#bfe3dc', '#d8efe9'); else if (kind === 'park') sky(ctx, '#f2dfc2', '#f7ead6'); else sky(ctx, '#b9c9ee', '#d3ddf6');
      clouds(ctx, t);
      if (kind === 'tw') taipei(ctx); else if (kind === 'sg') singapore(ctx); else if (kind === 'gen') city(ctx); else park(ctx);
      ground(ctx, kind === 'park' ? 'park' : 'city');
      var frame = Math.floor(t / 20), x = 62;
      person(ctx, x, 46, state.age, state.female, '#1a4be0', frame);
      if (state.spouse) person(ctx, x + 15, 46, state.age - 2, state.spouseFemale, '#c2504a', frame + 1);
      state.kids.forEach(function (k, i) { if (k.age < 25) kid(ctx, x + 32 + i * 11, 52, k.age, k.female, i ? '#e0a43a' : '#3a9a6a'); });
      raf = requestAnimationFrame(draw);
    }
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) draw(); else { t = 0; draw(); cancelAnimationFrame(raf); }
    return { set: function (s) { Object.assign(state, s); if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { cancelAnimationFrame(raf); draw(); cancelAnimationFrame(raf); } }, stop: function () { cancelAnimationFrame(raf); } };
  };
})();
