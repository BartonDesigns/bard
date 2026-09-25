# Crysis civilization engine, part one: learn how real places are laid out.
# Reads the baked real-map regions (assets/bayarea/real/*.{json,bin.gz,png}, see
# bake-realcity.py), the San Ramon height level, and, when present, the raw Overture
# land use for the East Bay, and writes a few KB of statistics to
# src/crysis/civstats.json. src/crysis/civgen.js grows new towns from them.
#   python3 tools/learn-civ.py [raw overture dir, default /tmp/claude-0/ov2]
# Distances are metres; "p" lists are the 10th, 25th, 50th, 75th and 90th percentiles.
import sys, os, json, gzip, math, struct, re
from collections import Counter, defaultdict
import numpy as np
from PIL import Image
from shapely.geometry import LineString, Point, Polygon
from shapely.strtree import STRtree
from shapely.ops import unary_union, polygonize

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
REAL = os.path.join(ROOT, 'assets/bayarea/real')
RAW = sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/ov2'
REGIONS = ['eastbay', 'tam', 'missionpeak']
DRIVE = {'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'unknown'}
STREET = {'residential', 'unclassified', 'living_street'}
ART = {'primary', 'secondary', 'trunk'}
PCT = [10, 25, 50, 75, 90]
def pct(a, nd=1):
	a = np.asarray(a, dtype=float)
	return [round(float(v), nd) for v in np.percentile(a, PCT)] if len(a) else []
def hist(vals, edges):
	h, _ = np.histogram(vals, bins=edges)
	return [round(float(v), 3) for v in h / max(1, h.sum())]

# ---------- read a baked region ----------
def load(name):
	H = json.load(open(f'{REAL}/{name}.json'))
	b = gzip.open(f'{REAL}/{name}.bin.gz').read()
	OX, OZ = H['origin']; U = H['unit']; S = H['sections']
	roads = []
	o = S['roads'][0]
	for _ in range(S['roads'][1]):
		c, f, nm, k = struct.unpack_from('<BBHH', b, o); o += 6
		p = np.frombuffer(b, '<i2', k * 2, o).reshape(-1, 2).astype(float) * U + (OX, OZ); o += 4 * k
		roads.append({'cls': H['classes'][c], 'w': H['widths'][c], 'name': H['names'][nm - 1] if nm else '', 'bridge': f & 1, 'link': f & 2, 'end0': f & 4, 'end1': f & 8, 'div': f & 16, 'p': p})
	def arr(sec, n16):
		o, n = S[sec]
		return np.frombuffer(b, '<i2', n * n16, o).reshape(-1, n16).astype(float)
	bx = arr('boxes', 9)
	boxes = {'x': bx[:, 0] * U + OX, 'z': bx[:, 1] * U + OZ, 'w': bx[:, 2] / 20, 'd': bx[:, 3] / 20, 'a': bx[:, 4] / 1e4, 'wallH': bx[:, 5] / 20, 'roofH': bx[:, 6] / 20, 'kind': bx[:, 7].astype(int) & 255}
	pa = arr('paths', 5)
	paths = {'ax': pa[:, 0] * U + OX, 'az': pa[:, 1] * U + OZ, 'bx': pa[:, 2] * U + OX, 'bz': pa[:, 3] * U + OZ, 'w': pa[:, 4] / 20}
	po = arr('pools', 5)
	tr = arr('trees', 4)
	trees = {'x': tr[:, 0] * U + OX, 'z': tr[:, 1] * U + OZ, 'h': tr[:, 2] / 20}
	im = np.asarray(Image.open(f'{REAL}/{name}.png').convert('RGBA'))
	lu = np.round(im[:, :, 1] / 16).astype(int)
	x0, z0 = H['bounds'][0], H['bounds'][1]
	step = H['map']['step']
	def luAt(x, z):
		i = np.clip(((np.asarray(x) - x0) / step).astype(int), 0, lu.shape[1] - 1)
		j = np.clip(((np.asarray(z) - z0) / step).astype(int), 0, lu.shape[0] - 1)
		return lu[j, i]
	return {'name': name, 'H': H, 'roads': roads, 'boxes': boxes, 'paths': paths, 'npools': len(po), 'trees': trees, 'lu': lu, 'step': step, 'x0': x0, 'z0': z0, 'luAt': luAt}

regs = [load(n) for n in REGIONS]
print('loaded', [(r['name'], len(r['roads']), len(r['boxes']['x'])) for r in regs])
out = {'source': 'Overture Maps (OSM, Microsoft, Google) for San Ramon/Danville/Mt Diablo/Clayton, Mt Tam/Mill Valley and the Fremont foothills; baked by bake-realcity.py, learned by learn-civ.py', 'pct': PCT}

# ---------- roads: class mix, widths, the street graph ----------
km = Counter()
for R in regs:
	for r in R['roads']:
		if r['cls'] in DRIVE: km[r['cls']] += float(np.sum(np.hypot(*np.diff(r['p'], axis=0).T))) / 1000
tot = sum(km.values())
out['roadMix'] = {c: round(v / tot, 3) for c, v in km.most_common()}
out['roadKm'] = round(tot)
H0 = regs[0]['H']
out['widths'] = {c: w for c, w in zip(H0['classes'], H0['widths']) if c in DRIVE}
out['dividedShare'] = {c: round(sum(1 for R in regs for r in R['roads'] if r['cls'] == c and r['div']) / max(1, sum(1 for R in regs for r in R['roads'] if r['cls'] == c)), 2) for c in ('primary', 'secondary', 'tertiary')}

# the graph of drivable streets: junctions are points shared by two or more segments
def graph(R):
	cnt = Counter()
	key = lambda p: (round(p[0] * 2), round(p[1] * 2))
	rs = [r for r in R['roads'] if r['cls'] in DRIVE and r['cls'] != 'service']
	for r in rs:
		ks = [key(p) for p in r['p']]
		for i, k in enumerate(ks): cnt[k] += 2 if 0 < i < len(ks) - 1 else 1      # an interior point counts both ways
	# edges: runs between junctions (deg != 2)
	edges = []
	for r in rs:
		ks = [key(p) for p in r['p']]
		s = 0
		for i in range(1, len(ks)):
			if i == len(ks) - 1 or cnt[ks[i]] != 2:
				edges.append((r, r['p'][s:i + 1], ks[s], ks[i])); s = i
	return cnt, edges
lens, sinu, turn, deadL, deg = [], [], [], [], Counter()
cul, streetKm = 0, 0
for R in regs:
	cnt, edges = graph(R)
	for k, v in cnt.items(): deg[min(v, 5)] += 1
	for r, p, a, b in edges:
		if r['cls'] not in STREET: continue
		seg = np.hypot(*np.diff(p, axis=0).T); L = float(seg.sum())
		if L < 3: continue
		# only streets in town (land use at the midpoint)
		m = p[len(p) // 2]
		if R['luAt'](m[0], m[1]) not in (1, 7): continue
		streetKm += L / 1000
		lens.append(L)
		chord = float(np.hypot(*(p[-1] - p[0])))
		if L > 40: sinu.append(L / max(chord, 1))
		if len(p) > 2 and L > 40:
			d = np.diff(p, axis=0); ang = np.arctan2(d[:, 1], d[:, 0]); da = np.diff(ang); da = (da + np.pi) % (2 * np.pi) - np.pi
			turn.append(float(np.degrees(np.abs(da).sum())) / L * 100)
		if cnt[a] == 1 or cnt[b] == 1:
			cul += 1; deadL.append(L)
dsum = sum(deg[k] for k in deg if k != 2)
out['street'] = {
	'segLen': pct(lens), 'sinuosity': pct(sinu, 3), 'turnPer100m': pct(turn),
	'junctionDeg': {str(k): round(deg[k] / dsum, 3) for k in (1, 3, 4, 5) if deg[k]},
	'culPerKm': round(cul / streetKm, 2), 'culDepth': pct(deadL), 'culShare': round(cul / len(lens), 3),
	'segLenHist': {'edges': [0, 40, 80, 120, 160, 220, 300, 400, 600], 'p': hist(lens, [0, 40, 80, 120, 160, 220, 300, 400, 600])},
}
print('street', out['street'])

# ---------- how far a house is from the collectors and arterials ----------
def spacing(R):
	lines = {k: [LineString(r['p']) for r in R['roads'] if r['cls'] in cl] for k, cl in (('art', ART), ('col', {'tertiary'}), ('any', DRIVE - {'service'}))}
	trees = {k: STRtree(v) for k, v in lines.items() if v}
	B = R['boxes']; hs = np.where(np.isin(B['kind'], [0, 1, 2]))[0]
	rng = np.random.default_rng(1); hs = rng.choice(hs, min(4000, len(hs)), replace=False)
	d = defaultdict(list)
	for i in hs:
		pt = Point(B['x'][i], B['z'][i])
		if R['luAt'](pt.x, pt.y) != 1: continue
		for k, t in trees.items():
			j = t.nearest(pt); d[k].append(lines[k][j].distance(pt))
	return d
sp = defaultdict(list)
for R in regs:
	for k, v in spacing(R).items(): sp[k] += v
out['houseTo'] = {'arterial': pct(sp['art'], 0), 'collector': pct(sp['col'], 0)}
# on a square grid of spacing S the median distance to the nearest line is (1 - 1/sqrt 2)/2 S,
# about 0.146 S: so the arterial grid, and the grid of arterials and collectors together
out['arterialSpacing'] = round(float(np.median(sp['art'])) / 0.146 / 50) * 50
out['collectorSpacing'] = round(float(np.median(np.minimum(sp['art'], sp['col']))) / 0.146 / 50) * 50

# ---------- blocks: the faces of the street network ----------
blk = []
for R in regs:
	ls = [LineString(r['p']) for r in R['roads'] if r['cls'] in DRIVE and r['cls'] != 'service']
	for P in polygonize(unary_union(ls)):
		c = P.representative_point()
		if R['luAt'](c.x, c.y) != 1: continue
		a = P.area
		if 2000 < a < 400000: blk.append((a, P.length / (2 * math.sqrt(math.pi * a))))
out['blocks'] = {'areaHa': pct([a / 1e4 for a, _ in blk], 2), 'compactness': pct([c for _, c in blk], 2)}
print('blocks', out['blocks'])

# ---------- buildings ----------
KIND = {0: 'house', 1: 'house', 2: 'house', 3: 'garage', 4: 'wing', 5: 'office', 6: 'retail', 7: 'school', 8: 'apartments', 9: 'industrial', 10: 'shed'}
bk = defaultdict(lambda: defaultdict(list))
for R in regs:
	B = R['boxes']
	for i in range(len(B['x'])):
		k = KIND[B['kind'][i]]
		w, d = B['w'][i], B['d'][i]
		bk[k]['w'].append(w); bk[k]['d'].append(d); bk[k]['area'].append(w * d); bk[k]['wallH'].append(B['wallH'][i]); bk[k]['roofH'].append(B['roofH'][i])
nb = sum(len(v['w']) for v in bk.values())
out['buildings'] = {k: {'share': round(len(v['w']) / nb, 3), 'w': pct(v['w']), 'd': pct(v['d']), 'area': pct(v['area'], 0), 'wallH': pct(v['wallH']), 'roofH': pct(v['roofH'])} for k, v in bk.items()}
# houses with their garage on the front: kinds 1/2 against a separate garage wing (3)
hk = Counter(int(k) for R in regs for k in R['boxes']['kind'] if k in (0, 1, 2, 3))
out['garage'] = {'attached': round((hk[1] + hk[2]) / max(1, hk[0] + hk[1] + hk[2]), 3), 'wing': round(hk[3] / max(1, hk[0] + hk[1] + hk[2]), 3)}
# whole footprints from the raw data: area and height of the houses (not split into boxes)
raw = {}
if os.path.exists(f'{RAW}/buildings.json'):
	LAT0, LON0 = 37.76, -122.78
	KX, KZ = 111320 * math.cos(LAT0 * math.pi / 180), 110996
	A, Hh = [], []
	for b in json.load(open(f'{RAW}/buildings.json')):
		pts = [((x - LON0) * KX, -(y - LAT0) * KZ) for x, y in b['p']]
		if len(pts) < 3: continue
		a = Polygon(pts).area
		if 60 < a < 700: A.append(a); Hh.append(b['h'] or 0)
	Hh = [h for h in Hh if h > 2]
	raw['houseFootprint'] = pct(A, 0); raw['houseHeight'] = pct(Hh); raw['twoStorey'] = round(float(np.mean(np.array(Hh) > 6.2)), 3)
	out['raw'] = raw
	print('raw', raw)

# ---------- lots: setbacks and frontage along the residential streets ----------
setb, front, depth = [], [], []
drv = wlk = hn = 0
for R in regs:
	rs = [r for r in R['roads'] if r['cls'] in STREET]
	ls = [LineString(r['p']) for r in rs]; t = STRtree(ls)
	B = R['boxes']
	idx = np.where(np.isin(B['kind'], [0, 1, 2]))[0]
	rows = defaultdict(list)
	for i in idx:
		x, z, a, d = B['x'][i], B['z'][i], B['a'][i], B['d'][i]
		if R['luAt'](x, z) != 1: continue
		hn += 1
		fx, fz = -math.sin(a), math.cos(a)
		fp = Point(x + fx * d / 2, z + fz * d / 2)
		j = t.nearest(fp); L = ls[j]
		s = L.distance(fp) - rs[j]['w'] / 2
		if 0 < s < 40: setb.append(s)
		tt = L.project(Point(x, z)); q = L.interpolate(tt)
		side = 1 if (x - q.x) * (L.interpolate(min(L.length, tt + 1)).y - q.y) - (z - q.y) * (L.interpolate(min(L.length, tt + 1)).x - q.x) > 0 else -1
		rows[(j, side)].append(tt)
	for v in rows.values():
		v.sort()
		for a_, b_ in zip(v, v[1:]):
			if 6 < b_ - a_ < 60: front.append(b_ - a_)
	P = R['paths']
	drv += int(np.sum(P['w'] >= 4)); wlk += int(np.sum(P['w'] < 4))
out['lots'] = {'setback': pct(setb), 'frontage': pct(front), 'drivewayPerHouse': round(drv / max(1, hn), 2), 'walkPerHouse': round(wlk / max(1, hn), 2), 'poolPerHouse': round(sum(R['npools'] for R in regs) / max(1, hn), 3)}
print('lots', out['lots'])

# ---------- land use: shares, adjacency, trees, where commercial sits ----------
LU = {0: 'wild', 1: 'residential', 2: 'park', 3: 'golf', 4: 'pitch', 5: 'playground', 6: 'school', 7: 'commercial', 8: 'industrial', 9: 'bunker', 10: 'water', 11: 'farm', 12: 'reserve'}
cells = Counter(); adj = Counter()
for R in regs:
	lu = R['lu']
	for k, v in zip(*np.unique(lu, return_counts=True)): cells[int(k)] += int(v) * R['step'] ** 2
	for A_, B_ in ((lu[:, 1:], lu[:, :-1]), (lu[1:, :], lu[:-1, :])):
		m = A_ != B_
		for a, b in zip(A_[m], B_[m]):
			if a and b: adj[tuple(sorted((int(a), int(b))))] += 1
town = sum(v for k, v in cells.items() if 1 <= k <= 8)
out['landUse'] = {LU[k]: round(v / town, 3) for k, v in sorted(cells.items()) if 1 <= k <= 8}
ta = sum(adj.values())
out['adjacency'] = {f'{LU[a]}-{LU[b]}': round(v / ta, 3) for (a, b), v in adj.most_common(12)}
td = Counter(); ta2 = Counter()
for R in regs:
	T = R['trees']; l = R['luAt'](T['x'], T['z'])
	for k, v in zip(*np.unique(l, return_counts=True)): td[int(k)] += int(v)
out['treesPerHa'] = {LU[k]: round(td[k] / (cells[k] / 1e4), 1) for k in sorted(td) if cells[k] > 1e5}
out['treeHeight'] = pct(np.concatenate([R['trees']['h'] for R in regs]))
out['housesPerHa'] = round(hn / (cells[1] / 1e4), 2)
# commercial: its distance to an arterial, and to a crossing of two
com = []
for R in regs:
	arts = [r for r in R['roads'] if r['cls'] in ART | {'tertiary'}]
	if not arts: continue
	t = STRtree([LineString(r['p']) for r in arts]); ls = [LineString(r['p']) for r in arts]
	j, i = np.where(R['lu'] == 7)
	rng = np.random.default_rng(2); pick = rng.choice(len(i), min(3000, len(i)), replace=False)
	for k in pick:
		p = Point(R['x0'] + (i[k] + 0.5) * R['step'], R['z0'] + (j[k] + 0.5) * R['step'])
		com.append(ls[t.nearest(p)].distance(p))
out['commercialToArterial'] = pct(com, 0)
out['commercialWithin150'] = round(float(np.mean(np.array(com) < 150)), 3)
# sites from the raw land use: how big schools, parks and shopping centres are
if os.path.exists(f'{RAW}/landuse.json'):
	LAT0, LON0 = 37.76, -122.78
	KX, KZ = 111320 * math.cos(LAT0 * math.pi / 180), 110996
	site = defaultdict(list)
	for l in json.load(open(f'{RAW}/landuse.json')):
		k = {'school': 'school', 'park': 'park', 'commercial': 'commercial', 'retail': 'commercial', 'pitch': 'pitch', 'playground': 'playground', 'residential': 'residential'}.get(l['c'])
		if not k: continue
		P = Polygon([((x - LON0) * KX, -(y - LAT0) * KZ) for x, y in l['p']])
		if P.is_valid and P.area > 50: site[k].append(P.area / 1e4)
	out['siteHa'] = {k: pct(v, 2) for k, v in site.items()}
	hsum = sum(1 for R in regs[:1] for k in R['boxes']['kind'] if k in (0, 1, 2))
	out['sitesPer1000Houses'] = {k: round(len(site[k]) / hsum * 1000, 2) for k in ('school', 'park', 'commercial', 'playground')}

# ---------- the ground: how steep the built land gets (San Ramon's 10 m heights) ----------
try:
	Hm = np.asarray(Image.open(os.path.join(ROOT, 'assets/bayarea/h3.png')).convert('RGBA')).astype(float)
	hgt = (Hm[:, :, 0] * 256 + Hm[:, :, 1]) / 20 - 1000
	LAT0, LON0 = 37.76, -122.78
	KX, KZ = 111320 * math.cos(LAT0 * math.pi / 180), 110996
	hx0, hz0, hs = (-122.02 - LON0) * KX, -(37.83 - LAT0) * KZ, 10
	gz, gx = np.gradient(hgt, hs)
	slope = np.hypot(gx, gz)
	def slopeAt(x, z):
		i = ((np.asarray(x) - hx0) / hs).astype(int); j = ((np.asarray(z) - hz0) / hs).astype(int)
		ok = (i > 0) & (j > 0) & (i < slope.shape[1] - 1) & (j < slope.shape[0] - 1)
		return slope[j[ok], i[ok]]
	R = regs[0]; B = R['boxes']
	hs_ = np.isin(B['kind'], [0, 1, 2])
	out['slope'] = {'houses': pct(slopeAt(B['x'][hs_], B['z'][hs_]), 3), 'commercial': pct(slopeAt(B['x'][B['kind'] == 6], B['z'][B['kind'] == 6]), 3)}
	pts = np.concatenate([r['p'] for r in R['roads'] if r['cls'] in STREET])
	out['slope']['streets'] = pct(slopeAt(pts[:, 0], pts[:, 1]), 3)
	print('slope', out['slope'])
except Exception as e: print('no slope', e)

# ---------- street names: the words and what a street is called by its shape ----------
suf = defaultdict(Counter); first = Counter()
SUF = {'Way', 'Court', 'Drive', 'Place', 'Road', 'Lane', 'Circle', 'Street', 'Avenue', 'Boulevard', 'Terrace', 'Loop', 'Parkway', 'Trail', 'Commons', 'Common', 'Square', 'Row', 'Plaza', 'Path', 'Ridge', 'Glen', 'View', 'Point'}
for R in regs:
	for r in R['roads']:
		n = r['name']
		if r['cls'] not in DRIVE or not n: continue
		w = n.split()
		if len(w) < 2 or w[-1] not in SUF: continue
		kind = 'cul' if r['cls'] in STREET and (r['end0'] or r['end1']) else 'art' if r['cls'] in ART else 'col' if r['cls'] == 'tertiary' else 'street' if r['cls'] in STREET else None
		if kind: suf[kind][w[-1]] += 1
		if r['cls'] in STREET: first[' '.join(w[:-1])] += 1
out['suffix'] = {k: {s: round(v / sum(c.values()), 3) for s, v in c.most_common(9)} for k, c in suf.items()}
# the commonest words in real names, for flavour (nature words: trees, birds, hills)
words = Counter()
for n, c in first.items():
	for w in re.findall(r'[A-Z][a-z]{3,}', n): words[w] += c
# (leaving out the real places' own names: a new town should not borrow them)
PLACE = {'Blackhawk', 'Dublin', 'Alamo', 'Diablo', 'Mission', 'Arbolado', 'Pintado', 'Parkmeadow', 'Mountaire', 'Roundhill', 'Starr', 'Saint', 'Indian', 'Santa', 'Linda', 'Club', 'South', 'North', 'East', 'West', 'Mount', 'Danville', 'Ramon', 'Clayton', 'Fremont', 'Tamalpais', 'Mill', 'Valley', 'Country', 'Stagecoach', 'Gate'}
out['nameWords'] = [w for w, _ in words.most_common(120) if w not in PLACE][:64]

dst = os.path.join(ROOT, 'src/crysis/civstats.json')
json.dump(out, open(dst, 'w'), separators=(',', ':'))
print('wrote', dst, os.path.getsize(dst), 'bytes')
