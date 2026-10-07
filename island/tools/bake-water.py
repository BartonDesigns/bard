# Bakes the Bay Area's rivers, creeks, canals, lakes and reservoirs (from
# tools/overture-fetch.py ... water: Overture Maps' base/water, built from OpenStreetMap,
# ODbL) for Crysis:
#   assets/bayarea/water.bin.gz   the lines by 2 km tile, then every lake and its dams
#   assets/bayarea/water.json     the header: tiles, names, sections, attribution
# The hydrology is worked out here, once, against the same survey the game walks on
# (assets/bayarea/h*.png, blended as bay/terrain.js does): each stream's water level runs
# downhill along the way it flows (OSM draws waterways downstream), never rising, meeting
# the stream it joins and the lake it runs into; its width comes from the mapped width,
# the riverbank it runs between, or how much of the network drains into it. Each lake's
# level is where the survey's water lies (the low middle of what it holds, no higher than
# most of its shore). Dams are where the ground falls away steeply outside a reservoir.
#   python3 tools/bake-water.py <overture dir> [release]
import sys, os, json, math, struct, gzip, re
import numpy as np
from PIL import Image
import shapely
from shapely.geometry import Polygon, LineString, Point
from shapely.strtree import STRtree

src = sys.argv[1]
release = sys.argv[2] if len(sys.argv) > 2 else ''
LAT0, LON0 = 37.76, -122.57                 # must match src/bay/geo.js
KX, KZ = 111320 * math.cos(LAT0 * math.pi / 180), 110996
def world(lon, lat): return ((lon - LON0) * KX, -(lat - LAT0) * KZ)
TILE = 2048

# ---------- the survey, as bay/terrain.js blends it (heightAt on the CPU) ----------
LEVELS = [
	('h0', (36.93, 38.87), (-123.6, -121.45), 120), ('h1', (37.2, 38.12), (-122.62, -121.75), 60),
	('h2', (37.7, 37.93), (-122.56, -122.36), 15), ('h3', (37.715, 37.83), (-122.02, -121.87), 10),
	('h4', (37.82, 37.95), (-122.02, -121.84), 12), ('h5', (37.87, 37.96), (-122.66, -122.53), 10),
	('h6', (37.48, 37.55), (-121.95, -121.84), 10), ('h7', (37.43, 37.71), (-122.53, -122.42), 12),
	('h8', (37.87, 37.93), (-122.735, -122.64), 10), ('h9', (37.08, 37.46), (-122.46, -122.27), 16),
	('h10', (38.02, 38.16), (-122.65, -122.48), 15),
]
DEM = []
for name, lat, lon, step in LEVELS:
	a = np.asarray(Image.open(f'assets/bayarea/{name}.png').convert('RGBA')).astype(np.float64)
	h = (a[:, :, 0] * 256 + a[:, :, 1]) / 20 - 1000
	x0 = (lon[0] - LON0) * KX; zN = -(lat[1] - LAT0) * KZ
	DEM.append((x0, zN, step, h))
def sstep(t): t = np.clip(t, 0, 1); return t * t * (3 - 2 * t)
def levelH(L, x, z):
	x0, zN, step, H = L; Hh, Ww = H.shape
	fx = np.clip((x - x0) / step, 0, Ww - 1.001); fz = np.clip((z - zN) / step, 0, Hh - 1.001)
	i = np.floor(fx).astype(int); j = np.floor(fz).astype(int); u = fx - i; v = fz - j
	return (H[j, i] * (1 - u) + H[j, i + 1] * u) * (1 - v) + (H[j + 1, i] * (1 - u) + H[j + 1, i + 1] * u) * v
def levelIn(L, x, z, m):
	x0, zN, step, H = L; Hh, Ww = H.shape
	fx = (x - x0) / step; fz = (z - zN) / step
	d = np.minimum(np.minimum(fx, Ww - 1 - fx), np.minimum(fz, Hh - 1 - fz)) * step
	return sstep(np.clip(d / m, 0, 1))
def height(x, z):
	x = np.asarray(x, dtype=np.float64); z = np.asarray(z, dtype=np.float64)
	h = levelH(DEM[0], x, z)
	for k in range(1, len(DEM)):
		m = 1500 if k == 1 else 500 if k == 2 else 400
		w = levelIn(DEM[k], x, z, m)
		if np.any(w > 0): h = h + (levelH(DEM[k], x, z) - h) * w
	return h

# ---------- what is left out ----------
def box(lat0, lat1, lon0, lon1):
	a = world(lon0, lat1); b = world(lon1, lat0)
	return (a[0], a[1], b[0], b[1])
# the lower San Lorenzo, its mouth, the Boardwalk and the wharf are bay/boardwalk.js's
SKIP = [box(36.955, 36.995, -122.035, -122.005),
	# Lake Annabel at Bishop Ranch is bay/lake.js's
	box(37.7630, 37.7664, -121.9676, -121.9622)]
def skipped(x, z): return any(b[0] <= x <= b[2] and b[1] <= z <= b[3] for b in SKIP)

W = json.load(open(f'{src}/water.json'))
print('features', len(W))
NAMES = {}
def nix(n):
	if not n: return 0
	if n not in NAMES: NAMES[n] = len(NAMES) + 1
	return NAMES[n]
def num(s):
	m = re.match(r'\s*([\d.]+)\s*(ft|\'|m)?', s or '')
	if not m: return None
	try: v = float(m.group(1))
	except ValueError: return None
	return v * 0.3048 if m.group(2) in ('ft', "'") else v
UNDER = { 'culvert', 'yes', 'pipe', 'covered', 'passage', 'flooded', 'siphon' }

# ---------- the lakes ----------
LAKE_KINDS = { ('lake', 'lake'): 0, ('lake', 'lagoon'): 0, ('lake', 'oxbow'): 0, ('reservoir', 'reservoir'): 1, ('reservoir', 'basin'): 2,
	('pond', 'pond'): 3, ('pond', 'fishpond'): 3, ('water', 'water'): 3, ('human_made', 'reflecting_pool'): 4, ('canal', 'canal'): 3 }
BANKS = { ('river', 'river'), ('stream', 'stream'), ('canal', 'drain'), ('water', 'tidal_channel') }
lakes, banks = [], []
for f in W:
	if f['g'] != 'a': continue
	# (the salt marshes and ponds are the bay's; a tidal lake in town is a lake: Lake Merritt)
	if f['salt'] and not (f['c'] in ('lagoon', 'lake') and (f['n'] or '').startswith('Lake ')): continue
	t = f['t']
	if t.get('covered') == 'yes' or t.get('location') == 'underground': continue
	ring = [world(x, y) for x, y in f['p']]
	if len(ring) < 3: continue
	holes = [[world(x, y) for x, y in h] for h in f.get('h', []) if len(h) >= 3]
	try: P = Polygon(ring, holes).buffer(0)
	except Exception: continue
	if P.is_empty: continue
	if P.geom_type == 'MultiPolygon': P = max(P.geoms, key=lambda g: g.area)
	key = (f['s'], f['c'])
	if key in BANKS: banks.append((P, f['n'])); continue
	if key not in LAKE_KINDS: continue
	kind = LAKE_KINDS[key]
	# (tiny ponds are noise, unless someone named them; dry detention basins stay grass)
	if P.area < (3000 if kind == 2 else 400) and not f['n']: continue
	c = P.representative_point()
	if skipped(c.x, c.y): continue
	lakes.append({ 'P': P, 'n': f['n'], 'kind': kind, 'int': f['i'] })
print('lakes', len(lakes), 'riverbanks', len(banks))
bankTree = STRtree([b[0] for b in banks])

# a lake's level: the low middle of what the survey holds there, no higher than most of its shore
lakeTree = STRtree([L['P'] for L in lakes])
for L in lakes:
	P = L['P']; A = P.area
	sp = max(4.0, math.sqrt(A) / 14)
	x0, z0, x1, z1 = P.bounds
	gx, gz = np.meshgrid(np.arange(x0 + sp / 2, x1, sp), np.arange(z0 + sp / 2, z1, sp))
	gx = gx.ravel(); gz = gz.ravel()
	inside = shapely.contains_xy(P, gx, gz)
	edge = P.exterior
	n = max(8, int(edge.length / 8))
	bp = [edge.interpolate(i / n, normalized=True) for i in range(n)]
	bh = height([p.x for p in bp], [p.y for p in bp])
	lvl = np.percentile(bh, 25)
	if inside.sum() >= 3: lvl = min(lvl, np.percentile(height(gx[inside], gz[inside]), 50))
	L['level'] = max(0.1, float(lvl) - 0.05)
	# dams: stretches of shore where the ground outside falls well below the water
	if L['kind'] <= 1 and A > 30000:
		Po = shapely.geometry.polygon.orient(P, 1.0)
		ex = Po.exterior; n = max(8, int(ex.length / 10))
		pts = [ex.interpolate(i / n, normalized=True) for i in range(n + 1)]
		cand = []
		for i in range(n):
			a, b = pts[i], pts[i + 1]; dx, dz = b.x - a.x, b.y - a.y; l = math.hypot(dx, dz) or 1
			# (counter-clockwise: outward is to the right of the way round)
			nx, nz = dz / l, -dx / l
			g = height([a.x + nx * 60, a.x + nx * 120], [a.y + nz * 60, a.y + nz * 120])
			cand.append(L['level'] - float(g[0]) > 8 and L['level'] - float(g[1]) > 11)
		runs, cur = [], []
		for i in range(n):
			if cand[i]: cur.append(i)
			elif cur: runs.append(cur); cur = []
		if cur: runs.append(cur)
		L['dams'] = []
		for r in runs:
			if not 3 <= len(r) <= 150: continue
			L['dams'].append([(pts[i].x, pts[i].y) for i in r] + [(pts[r[-1] + 1].x, pts[r[-1] + 1].y)])

def lakeAt(x, z):
	for i in lakeTree.query(Point(x, z)):
		if lakes[i]['P'].contains(Point(x, z)): return i
	return -1

# ---------- the lines ----------
CLS = ['river', 'stream', 'canal', 'drain', 'ditch', 'tidal']
feats = []
for f in W:
	if f['g'] != 'l': continue
	c = f['c']
	if c == 'tidal_channel': c = 'tidal'
	if c not in CLS: continue
	t = f['t']
	if t.get('tunnel') in UNDER or t.get('location') == 'underground' or t.get('covered') == 'yes': continue
	if c == 'ditch' and not f['n']: continue
	pts = [world(x, y) for x, y in f['p']]
	if len(pts) < 2: continue
	feats.append({ 'c': c, 'n': f['n'], 'int': f['i'] or t.get('intermittent') == 'yes' or t.get('seasonal') == 'yes', 'w': num(t.get('width')), 'p': pts })
print('lines', len(feats))

# cut out what runs under a lake (its water is the lake's), in a skipped box, or out in the bay
pieces = []
for f in feats:
	p = f['p']
	ls = LineString(p)
	hits = [i for i in lakeTree.query(ls) if lakes[i]['P'].intersects(ls)]
	# dense enough to cut cleanly at a lake's edge
	dense = [p[0]]
	for a, b in zip(p, p[1:]):
		n = max(1, int(math.hypot(b[0] - a[0], b[1] - a[1]) / (5 if hits else 1e9)))
		for k in range(1, n + 1): dense.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n))
	if not hits: dense = p
	g = height([q[0] for q in dense], [q[1] for q in dense])
	cur, start, prevOut = [], None, False
	def flush(end):
		global cur
		if len(cur) >= 2: pieces.append({ **f, 'p': cur, 'from': start, 'to': end })
		cur = []
	for i, q in enumerate(dense):
		lk = -1
		for li in hits:
			if lakes[li]['P'].contains(Point(q)): lk = li; break
		out = lk >= 0 or skipped(q[0], q[1]) or g[i] < -0.5
		if out:
			if cur: flush(('lake', lk) if lk >= 0 else None)
			start = ('lake', lk) if lk >= 0 else None
		else:
			if not cur and not prevOut: start = None
			cur.append(q)
		prevOut = out
	flush(None)
print('pieces', len(pieces))

# ---------- the network: what flows into what ----------
def key(q): return (round(q[0] * 2), round(q[1] * 2))
at = {}
for pi, P in enumerate(pieces):
	for vi, q in enumerate(P['p']): at.setdefault(key(q), []).append((pi, vi))
for pi, P in enumerate(pieces):
	P['into'] = None
	if P['to'] is not None: continue
	best = None
	for (qi, vi) in at.get(key(P['p'][-1]), []):
		if qi == pi: continue
		# (a continuation, starting where this ends, or a stream it joins partway)
		if best is None or vi == 0: best = (qi, vi)
	P['into'] = best
feed = [[] for _ in pieces]
for pi, P in enumerate(pieces):
	if P['into']: feed[P['into'][0]].append((pi, P['into'][1]))
# upstream first (Kahn's order; loops in braided channels are broken where they close)
indeg = [len(f) for f in feed]
order, q = [], [i for i in range(len(pieces)) if indeg[i] == 0]
done = [False] * len(pieces)
while q or len(order) < len(pieces):
	if not q:
		rest = [i for i in range(len(pieces)) if not done[i]]
		q = [min(rest, key=lambda i: indeg[i])]
	i = q.pop()
	if done[i]: continue
	done[i] = True; order.append(i)
	if pieces[i]['into']:
		j = pieces[i]['into'][0]; indeg[j] -= 1
		if indeg[j] <= 0 and not done[j]: q.append(j)

# drainage (the length of stream upstream, km) and width at each vertex
def bankWidth(P, x, z):
	for i in bankTree.query(Point(x, z)):
		B, bn = banks[i]
		if (bn is None or bn == P['n'] or P['c'] in ('river', 'canal', 'tidal')) and B.contains(Point(x, z)):
			return min(900.0, 2 * B.exterior.distance(Point(x, z)))
	return None
for i in order:
	P = pieces[i]; p = P['p']; n = len(p)
	up = np.zeros(n)
	for (j, vi) in feed[i]:
		if 'up' in pieces[j]: up[vi:] += pieces[j]['up'][-1]
	s = np.concatenate([[0], np.cumsum([math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(p, p[1:])])])
	P['s'] = s; P['up'] = up + s / 1000
	c = P['c']; u = P['up']
	# (a river's width from its network: the San Lorenzo, about 300 km of it, runs some 25 m
	# across in its gorge; the broad ones have their riverbanks mapped)
	if c == 'river': w = np.clip(5 + 4 * np.log2(1 + u / 5), 8, 60)
	elif c == 'stream': w = np.clip(1.1 + 1.25 * np.log2(1 + u), 1.2, 14) * (0.75 if P['int'] else 1)
	elif c == 'canal': w = np.full(n, 8.0 if P['n'] else 5.0)
	elif c == 'drain': w = np.clip(3 + 1.2 * np.log2(1 + u), 3, 14)
	elif c == 'tidal': w = np.full(n, 8.0)
	else: w = np.full(n, 1.6)
	if P['w'] and 0.5 < P['w'] < 1000: w = np.full(n, P['w'])
	else:
		for k in range(n):
			bw = bankWidth(P, p[k][0], p[k][1])
			if bw: w[k] = max(w[k], bw)
	P['wd'] = w

# ---------- the water's level along each, downhill ----------
STEP = 8.0
for i in order:
	P = pieces[i]; p = P['p']; s = P['s']; w = P['wd']
	L = s[-1]
	m = max(2, int(L / STEP) + 1)
	ss = np.linspace(0, L, m)
	xs = np.interp(ss, s, [q[0] for q in p]); zs = np.interp(ss, s, [q[1] for q in p]); ws = np.interp(ss, s, w)
	tx = np.gradient(xs); tz = np.gradient(zs); tl = np.hypot(tx, tz) + 1e-9; nx, nz = -tz / tl, tx / tl
	a = np.clip(ws * 0.6 + 6, 6, 60)
	g = np.full(m, np.inf)
	for o in (-1, -0.5, 0, 0.5, 1): g = np.minimum(g, height(xs + nx * a * o, zs + nz * a * o))
	g = g - (0.15 + np.minimum(ws, 20) * 0.03)
	# where it starts: under what feeds it, or a lake's level at an outlet
	top = np.inf
	for (j, vi) in feed[i]:
		if vi == 0 and 'lv' in pieces[j]: top = min(top, pieces[j]['lv'][-1])
	if P['from'] and P['from'][0] == 'lake': top = min(top, lakes[P['from'][1]]['level'])
	if np.isfinite(top): g[0] = min(g[0], top)
	lv = np.minimum.accumulate(g)
	# smoothed, still falling
	if m > 4:
		k = 5
		sm = np.convolve(np.pad(lv, (k, k), mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), mode='valid')
		lv = np.minimum.accumulate(np.minimum(sm, lv + 0.6))
	P['ds'] = ss; P['lv'] = np.maximum(lv, 0.1)
# the mouths: a stream comes down to the level of what it runs into
for i in reversed(order):
	P = pieces[i]
	tgt = None
	if P['to'] and P['to'][0] == 'lake': tgt = lakes[P['to'][1]]['level']
	elif P['into']:
		j, vi = P['into']; Q = pieces[j]
		if 'lv' in Q: tgt = float(np.interp(Q['s'][vi], Q['ds'], Q['lv']))
	if tgt is None: continue
	ss, lv = P['ds'], P['lv']
	P['lv'] = np.maximum(0.1, np.minimum(lv, tgt + (ss[-1] - ss) * 0.08))

# ---------- simplified: few vertices, but every bend and every fall kept ----------
def dp(pts, tol):
	keep = np.zeros(len(pts), bool); keep[0] = keep[-1] = True
	st = [(0, len(pts) - 1)]
	while st:
		a, b = st.pop()
		if b <= a + 1: continue
		A, B = pts[a], pts[b]; d = B - A; l2 = float(d @ d) or 1e-9
		t = np.clip(((pts[a + 1:b] - A) @ d) / l2, 0, 1)
		e = np.linalg.norm(pts[a + 1:b] - (A + t[:, None] * d), axis=1)
		k = int(np.argmax(e))
		if e[k] > tol: keep[a + 1 + k] = True; st += [(a, a + 1 + k), (a + 1 + k, b)]
	return keep
out_lines = {}
nverts = 0
for i in order:
	P = pieces[i]
	ss, lv = P['ds'], P['lv']
	s, p, w = P['s'], P['p'], P['wd']
	# the dense line (the mapped vertices, and the profile's own steps between them)
	S = np.unique(np.concatenate([s, ss]))
	xs = np.interp(S, s, [q[0] for q in p]); zs = np.interp(S, s, [q[1] for q in p])
	ls = np.interp(S, ss, lv); ws = np.interp(S, s, w)
	# (the headwater gullies, mapped but dry and nameless most of the year, are left to the
	# ground's own folds: only what drains a few kilometres or carries a name is kept)
	if not P['n'] and P['c'] == 'stream' and P['up'][-1] < (3.0 if P['int'] else 0.8): continue
	tol = float(np.clip(1.8 + np.median(ws) * 0.15, 2.0, 8.0))
	keep = dp(np.stack([xs, zs, ls * tol / 0.35], 1), tol)
	# (no longer than 150 m a segment)
	idx = np.nonzero(keep)[0]
	fin = [idx[0]]
	for a, b in zip(idx, idx[1:]):
		n = int(math.ceil((S[b] - S[a]) / 150))
		for k in range(1, n): fin.append(int(np.searchsorted(S, S[a] + (S[b] - S[a]) * k / n)))
		fin.append(b)
	fin = sorted(set(fin))
	V = [(float(xs[k]), float(zs[k]), float(ls[k]), float(ws[k])) for k in fin]
	# split at the tile lines
	cur = [V[0]]
	def tileOf(q): return (math.floor(q[0] / TILE), math.floor(q[1] / TILE))
	segs = []
	for a, b in zip(V, V[1:]):
		ta, tb = tileOf(a), tileOf(b)
		if ta == tb: cur.append(b); continue
		# the crossings, in order along the segment
		cuts = []
		for ax in (0, 1):
			lo, hi = sorted((a[ax], b[ax]))
			for g in range(math.floor(lo / TILE) + 1, math.floor(hi / TILE) + 1):
				t = (g * TILE - a[ax]) / (b[ax] - a[ax]); cuts.append(t)
		for t in sorted(cuts):
			c = tuple(a[k] + (b[k] - a[k]) * t for k in range(4))
			cur.append(c); segs.append(cur); cur = [c]
		cur.append(b)
	segs.append(cur)
	for sg in segs:
		if len(sg) < 2: continue
		mx = (sg[0][0] + sg[-1][0]) / 2; mz = (sg[0][1] + sg[-1][1]) / 2
		mid = sg[len(sg) // 2] if len(sg) > 2 else (mx, mz)
		# (the tile that holds most of it: its middle vertex's)
		t = tileOf(((sg[0][0] + sg[1][0]) / 2, (sg[0][1] + sg[1][1]) / 2)) if len(sg) == 2 else tileOf(mid)
		out_lines.setdefault(t, []).append((P, sg))
		nverts += len(sg)
print('line vertices', nverts, 'tiles', len(out_lines))

# ---------- the binary ----------
out = bytearray()
U = 0.125                                    # line coordinates: eighths of a metre from the tile's centre
def i16(v): return struct.pack('<h', max(-32767, min(32767, int(round(v)))))
tiles = {}
for (ti, tj), L in sorted(out_lines.items()):
	cx, cz = (ti + 0.5) * TILE, (tj + 0.5) * TILE
	start = len(out)
	for P, sg in L:
		fl = (1 if P['int'] else 0)
		out += struct.pack('<BBHH', CLS.index(P['c']), fl, nix(P['n']), len(sg))
		# (each vertex from the last: small numbers, which pack well)
		px, pz, pl = 0, 0, 0
		for (x, z, l, w) in sg:
			qx, qz, ql = int(round((x - cx) / U)), int(round((z - cz) / U)), int(round(l * 20))
			out += i16(qx - px) + i16(qz - pz) + i16(ql - pl) + struct.pack('<H', min(65535, int(round(w * 10))))
			px, pz, pl = qx, qz, ql
	tiles[f'{ti},{tj}'] = [start, len(L)]
while len(out) % 4: out += b'\0'
lakeStart = len(out)
nl = 0
for L in lakes:
	P = shapely.geometry.polygon.orient(L['P'], 1.0)
	A = P.area
	tol = float(np.clip(math.sqrt(A) * 0.004, 0.6, 8))
	P = P.simplify(tol, preserve_topology=True)
	if P.is_empty or P.geom_type != 'Polygon': continue
	rings = [list(P.exterior.coords)[:-1]] + [list(h.coords)[:-1] for h in P.interiors if Polygon(h).area > 200]
	rings = [r for r in rings if len(r) >= 3]
	c = P.centroid
	span = max(max(abs(x - c.x), abs(z - c.y)) for r in rings for x, z in r)
	u = 0.25 if span < 8000 else 0.5 if span < 16000 else 1.0
	dams = L.get('dams', [])
	out += struct.pack('<BBHhHffBB', L['kind'], (1 if L['int'] else 0), nix(L['n']), int(round(L['level'] * 20)), len(rings), c.x, c.y, int(u * 8), len(dams))
	for r in rings:
		out += struct.pack('<H', len(r))
		for x, z in r: out += i16((x - c.x) / u) + i16((z - c.y) / u)
	for d in dams:
		out += struct.pack('<H', len(d))
		for x, z in d: out += i16((x - c.x) / u) + i16((z - c.y) / u)
	while len(out) % 4: out += b'\0'
	nl += 1
names = [None] * len(NAMES)
for n, i in NAMES.items(): names[i - 1] = n
os.makedirs('assets/bayarea', exist_ok=True)
gz = gzip.compress(bytes(out), 9)
open('assets/bayarea/water.bin.gz', 'wb').write(gz)
json.dump({ 'name': 'water', 'geo': [LAT0, LON0], 'tile': TILE, 'unit': U, 'classes': CLS, 'lakeKinds': ['lake', 'reservoir', 'basin', 'pond', 'pool'],
	'tiles': tiles, 'lakes': [lakeStart, nl], 'names': names, 'skip': SKIP,
	'attribution': 'Water: Overture Maps Foundation' + (f' ({release})' if release else '') + ', base/water (ODbL), incl. © OpenStreetMap contributors' },
	open('assets/bayarea/water.json', 'w'), separators=(',', ':'))
print('bin', len(out), 'bytes, gz', len(gz), 'lakes', nl, 'names', len(names))
