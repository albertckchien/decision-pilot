"""把播放器、像素場景和引擎跑出的 example_out.json 包成一個獨立的示意頁（docs/sim-demo-v5.html，另存一份到下載資料夾）。
用法：python -X utf8 docs/build_demo.py（先跑 node engine/simulate.js engine/example_派駐新加坡.json engine/example_out.json）"""
import os
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__))) + os.sep
old = open(R + 'docs/sim-demo-v5.html', encoding='utf-8').read()
head = old[:old.index('/* 人生模擬播放器')]
tail = old[old.index('</style></head>'):old.index('<script>')]
css = open(R + 'assets/sim.css', encoding='utf-8').read()
js = open(R + 'assets/pixel.js', encoding='utf-8').read() + '\n' + open(R + 'assets/sim.js', encoding='utf-8').read()
data = open(R + 'engine/example_out.json', encoding='utf-8').read()
html = head + css + tail + '<script>' + js + '\nwindow.renderSim(document.getElementById("sim"), ' + data + ');</script></body></html>'
outs = [R + 'docs/sim-demo-v5.html', os.path.expanduser('~/Downloads/人生模擬_引擎實跑_v5.html')]
for f in outs:
    open(f, 'w', encoding='utf-8').write(html)
print('寫好', *outs)
