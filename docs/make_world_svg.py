"""畫首頁的點陣世界地圖（assets/img/world-dots.svg）：陸地是一格一格的小點，200 國資料裡的每個國家一個圓，越大人口越多。
資料：Natural Earth 1:50m 國界（1in8b-research/country-data/raw/geo），人口：country-data/data/countries.csv 的 pop_2024_k。
用法：python -X utf8 docs/make_world_svg.py"""
import csv, io, math, os, zipfile
import shapefile  # pyshp

HERE = os.path.dirname(os.path.abspath(__file__))
CD = os.path.normpath(os.path.join(HERE, '..', '..', '1in8b-research', 'country-data'))
OUT = os.path.join(HERE, '..', 'assets', 'img', 'world-dots.svg')

z = zipfile.ZipFile(os.path.join(CD, 'raw', 'geo', 'ne_50m_admin_0_countries.zip'))
names = z.namelist()
get = lambda ext: io.BytesIO(z.read([n for n in names if n.lower().endswith(ext)][0]))
sf = shapefile.Reader(shp=get('.shp'), shx=get('.shx'), dbf=get('.dbf'), encoding='utf-8')
fields = [f[0] for f in sf.fields[1:]]

# 每個國家的多邊形（只取外環）和標籤點
polys, label = [], {}
for sr in sf.iterShapeRecords():
    rec = dict(zip(fields, sr.record))
    iso = rec.get('ISO_A3_EH') or rec.get('ISO_A3') or rec.get('ADM0_A3')
    if iso in ('-99', None):
        iso = rec.get('ADM0_A3')
    pts, parts = sr.shape.points, list(sr.shape.parts) + [len(sr.shape.points)]
    for a, b in zip(parts[:-1], parts[1:]):
        ring = pts[a:b]
        if len(ring) < 4:
            continue
        xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
        polys.append((min(xs), max(xs), min(ys), max(ys), ring))
    if rec.get('LABEL_X') is not None:
        label[iso] = (rec['LABEL_X'], rec['LABEL_Y'])


def inside(x, y, ring):
    c, j = False, len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-12) + xi:
            c = not c
        j = i
    return c


def land(x, y):
    return any(a <= x <= b and c <= y <= d and inside(x, y, r) for a, b, c, d, r in polys)


W, H = 1200, 560
LON0, LON1, LAT0, LAT1 = -170, 190, 78, -58
proj = lambda lon, lat: ((lon - LON0) / (LON1 - LON0) * W, (LAT0 - lat) / (LAT0 - LAT1) * H)
STEP = 2.4  # 度
dots = []
lat = LAT0
while lat > LAT1:
    lon = LON0
    while lon < LON1:
        L = lon - 360 if lon > 180 else lon
        if land(L, lat):
            dots.append(proj(lon, lat))
        lon += STEP
    lat -= STEP

pop = {}
with open(os.path.join(CD, 'data', 'countries.csv'), encoding='utf-8-sig') as f:
    for r in csv.DictReader(f):
        try:
            pop[r['iso3']] = float(r['pop_2024_k'])
        except (ValueError, KeyError):
            pass
circles = []
for iso, p in pop.items():
    if iso in label:
        lon, la = label[iso]
        if lon < LON0:
            lon += 360
        x, y = proj(lon, la)
        r = 1.5 + 2.4 * math.log10(p + 1)  # 用對數：大國不會大到蓋掉整片，小國也看得到
        circles.append((r, x, y, iso))
circles.sort(reverse=True)  # 大的先畫，小的疊在上面

svg = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" role="img" aria-label="點陣世界地圖：{len(circles)} 個國家各一個圓，越大人口越多">']
svg.append('<g fill="#D9C9BE">' + ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="1.6"/>' for x, y in dots) + '</g>')
svg.append('<g fill="#6E1A34" fill-opacity="0.78" stroke="#FBF8F3" stroke-width="1">' + ''.join(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r:.1f}"><title>{iso}</title></circle>' for r, x, y, iso in circles) + '</g>')
svg.append('</svg>')
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, 'w', encoding='utf-8').write(''.join(svg))
print('陸地點', len(dots), '國家', len(circles), '→', OUT, os.path.getsize(OUT) // 1024, 'KB')
