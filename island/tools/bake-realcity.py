# Bakes a region of the real map (from tools/overture-fetch.py) for Crysis:
#   assets/bayarea/real/<name>.bin   roads, building boxes, driveways, walks, pools, trees
#   assets/bayarea/real/<name>.png   an 8 m map: R roads, G land use, B roofs, A the region
#   assets/bayarea/real/<name>.json  the header: origin, extents, counts, street names
# Buildings are split into boxes offline: a footprint is squared to its minimum rotated
# rectangle, and if its sides run square, cut into the fewest rectangles (the house, its
# garage wing, an L or a T), each carrying the height Overture gives and a hip roof; the
# front faces the nearest street, where the door, garage doors, driveway and walk go.
#   python3 tools/bake-realcity.py <overture dir> <name> <west> <south> <east> <north> [map step]
import sys, os, json, math, struct, random
import numpy as np
from shapely.geometry import Polygon, LineString, Point, box
from shapely.strtree import STRtree
from shapely.ops import unary_union, nearest_points
from shapely import affinity
from PIL import Image, ImageDraw

src, name = sys.argv[1], sys.argv[2]
LAT0, LON0 = 37.76, -122.57                 # must match src/bay/geo.js
KX, KZ = 111320 * math.cos(LAT0 * math.pi / 180), 110996
W_, S_, E_, N_ = map(float, sys.argv[3:7])
def world(lon, lat): return ((lon - LON0) * KX, -(lat - LAT0) * KZ)
x0, zN = world(W_, N_); x1, zS = world(E_, S_)
OX, OZ = round((x0 + x1) / 2), round((zN + zS) / 2)
# coordinates are int16 offsets from the region's centre: pick the finest unit that still
# reaches its corners (quarter metres for a small region, half or whole for a big one)
# (set from the data's real extent just before writing; roads can run past the box)
Q = 4
def q(v):
	n = int(round(v * Q))
	assert -32767 <= n <= 32767, 'coordinate out of range for int16 at this unit'
	return n
rnd = random.Random(7)

# ---------- roads ----------
CLS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'footway', 'path', 'track', 'cycleway', 'steps', 'pedestrian', 'unknown']
WIDTH = { 'motorway': 14, 'trunk': 13, 'primary': 13, 'secondary': 12, 'tertiary': 11, 'residential': 10.5, 'unclassified': 9, 'living_street': 8, 'service': 5.5, 'footway': 1.8, 'path': 1.6, 'track': 3.2, 'cycleway': 2.4, 'steps': 2, 'pedestrian': 4, 'unknown': 6 }
DRIVE = { 'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'unknown' }
roads = []
for r in json.load(open(f'{src}/roads.json')):
	if r['c'] not in CLS: continue
	if any(f in r['f'] for f in ('is_tunnel', 'is_indoor', 'is_abandoned', 'is_under_construction')): continue
	pts = [world(x, y) for x, y in r['p']]
	if len(pts) < 2: continue
	roads.append({ 'c': r['c'], 'n': r['n'], 'bridge': 'is_bridge' in r['f'], 'link': 'is_link' in r['f'], 'p': pts })
# dead ends of residential streets get a turning circle
def key(p): return (round(p[0] * 2), round(p[1] * 2))
deg = {}
for r in roads:
	if r['c'] in DRIVE: [deg.__setitem__(key(p), deg.get(key(p), 0) + 1) for p in (r['p'][0], r['p'][-1])]
for r in roads:
	r['end0'] = r['c'] in ('residential', 'unclassified', 'living_street') and deg.get(key(r['p'][0]), 0) == 1 and len(r['p']) > 1
	r['end1'] = r['c'] in ('residential', 'unclassified', 'living_street') and deg.get(key(r['p'][-1]), 0) == 1
# divided roads: a same-named segment running alongside, close and parallel
byname = {}
for r in roads:
	if r['n'] and r['c'] in ('motorway', 'trunk', 'primary', 'secondary', 'tertiary'): byname.setdefault(r['n'], []).append(r)
for nm, rs in byname.items():
	for r in rs:
		L = LineString(r['p']); m = L.interpolate(0.5, normalized=True)
		d0 = np.subtract(r['p'][-1], r['p'][0]); d0 = d0 / (np.linalg.norm(d0) + 1e-9)
		for o in rs:
			if o is r: continue
			Lo = LineString(o['p'])
			# side by side, not end to end: the midpoint must project inside the other
			# carriageway, some metres across from it
			t = Lo.project(m)
			if 6 < Lo.distance(m) < 40 and 3 < t < Lo.length - 3:
				d1 = np.subtract(o['p'][-1], o['p'][0]); d1 = d1 / (np.linalg.norm(d1) + 1e-9)
				if abs(np.dot(d0, d1)) > 0.8: r['div'] = True; break
names = sorted({r['n'] for r in roads if r['n']})
nix = { n: i + 1 for i, n in enumerate(names) }
driveLines = [LineString(r['p']) for r in roads if r['c'] in DRIVE and r['c'] != 'service']
driveRoads = [r for r in roads if r['c'] in DRIVE and r['c'] != 'service']
tree_idx = STRtree(driveLines)

# ---------- buildings ----------
def rect_decomp(poly):
	"""the footprint as a few rectangles in its own frame: (cx, cz, w, d) and the frame angle"""
	mrr = poly.minimum_rotated_rectangle
	c = list(mrr.exterior.coords)
	e0 = np.subtract(c[1], c[0]); ang = math.atan2(e0[1], e0[0])
	ctr = poly.centroid
	loc = affinity.rotate(affinity.translate(poly, -ctr.x, -ctr.y), -ang, origin=(0, 0), use_radians=True)
	pts = list(loc.exterior.coords)
	square = all(min(abs(math.atan2(b[1] - a[1], b[0] - a[0])) % (math.pi / 2), math.pi / 2 - abs(math.atan2(b[1] - a[1], b[0] - a[0])) % (math.pi / 2)) < 0.2 for a, b in zip(pts, pts[1:]) if math.dist(a, b) > 0.8)
	def snap(vals):
		out = []
		for v in sorted(vals):
			if not out or v - out[-1] > 0.6: out.append(v)
		return out
	xs, zs = snap([p[0] for p in pts]), snap([p[1] for p in pts])
	if not square or len(xs) > 10 or len(zs) > 10 or len(xs) < 2 or len(zs) < 2:
		b = loc.bounds
		return ang, ctr, [((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, b[2] - b[0], b[3] - b[1])]
	inside = [[loc.contains(Point((xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2)) for i in range(len(xs) - 1)] for j in range(len(zs) - 1)]
	strips = []
	for j, row in enumerate(inside):
		i = 0
		while i < len(row):
			if row[i]:
				k = i
				while k + 1 < len(row) and row[k + 1]: k += 1
				strips.append([i, k, j, j]); i = k + 1
			else: i += 1
	merged = []
	for s in strips:
		for m in merged:
			if m[0] == s[0] and m[1] == s[1] and m[3] == s[2] - 1: m[3] = s[2]; break
		else: merged.append(list(s))
	rects = []
	for i0, i1, j0, j1 in merged:
		w, d = xs[i1 + 1] - xs[i0], zs[j1 + 1] - zs[j0]
		if w < 1.4 or d < 1.4: continue
		rects.append(((xs[i0] + xs[i1 + 1]) / 2, (zs[j0] + zs[j1 + 1]) / 2, w, d))
	if not rects:
		b = loc.bounds
		rects = [((b[0] + b[2]) / 2, (b[1] + b[3]) / 2, b[2] - b[0], b[3] - b[1])]
	return ang, ctr, rects

# kinds for the runtime: 0 house, 1 house with its garage on the left of the front, 2 on
# the right, 3 garage wing, 4 wing (no door), 5 office/commercial, 6 retail, 7 school,
# 8 apartments, 9 industrial, 10 shed or carport
BOX = []; DRIVES = []; WALKS = []; POOLS = []
blds = json.load(open(f'{src}/buildings.json'))
bpolys = []
for b in blds:
	pts = [world(x, y) for x, y in b['p']]
	if len(pts) < 3: continue
	poly = Polygon(pts)
	if not poly.is_valid: poly = poly.buffer(0)
	if poly.geom_type != 'Polygon' or poly.area < 8: continue
	bpolys.append(poly)
	cls = b['c'] or ''
	area = poly.area
	ang, ctr, rects = rect_decomp(poly)
	ux, uz = math.cos(ang), math.sin(ang)          # the frame's x axis in the world
	vx, vz = -math.sin(ang), math.cos(ang)         # its z axis
	# the nearest street decides the front
	near = tree_idx.nearest(ctr)
	rp = nearest_points(driveLines[near], ctr)[0]
	fdx, fdz = rp.x - ctr.x, rp.y - ctr.y
	fl = math.hypot(fdx, fdz) or 1; fdx /= fl; fdz /= fl
	cand = [((ux, uz), 'u+'), ((-ux, -uz), 'u-'), ((vx, vz), 'v+'), ((-vx, -vz), 'v-')]
	(fx, fz), fa = max(cand, key=lambda c: c[0][0] * fdx + c[0][1] * fdz)
	yaw = math.atan2(-fx, fz)                        # local +z faces the street (see city.js upload)
	across = fa[0] == 'v'                            # the front is along the frame's z: box width runs along u
	big = area > 700 or cls in ('commercial', 'retail', 'office', 'industrial', 'school', 'warehouse', 'hospital', 'church', 'civic', 'public', 'university', 'college', 'supermarket', 'hotel')
	h = b['h'] or (4.6 if area < 260 else 7.4)
	if cls in ('shed', 'carport', 'garage', 'garages', 'roof') or area < 22: h = min(h, 3.2)
	kind0 = 6 if cls in ('retail', 'supermarket') else 7 if cls in ('school', 'university', 'college') else 9 if cls in ('industrial', 'warehouse') else 8 if cls in ('apartments',) and area > 400 else 5
	main = max(range(len(rects)), key=lambda k: rects[k][2] * rects[k][3])
	boxes = []
	for k, (cx, cz, rw, rd) in enumerate(rects):
		wx, wz = ctr.x + cx * ux + cz * vx, ctr.y + cx * uz + cz * vz
		w, d = (rw, rd) if across else (rd, rw)
		boxes.append([wx, wz, w, d])
	# the frontmost small wing of a house is its garage
	garage = -1
	if not big and len(boxes) > 1:
		fr = sorted(range(len(boxes)), key=lambda k: -(boxes[k][0] * fx + boxes[k][1] * fz))
		for k in fr[:2]:
			if k != main and 5 <= boxes[k][2] <= 10.5 and 25 <= boxes[k][2] * boxes[k][3] <= 95: garage = k; break
	for k, (wx, wz, w, d) in enumerate(boxes):
		if big:
			roofH, wallH, kind = 0, max(3.5, h), (8 if kind0 == 8 else kind0)
			if kind0 == 8: roofH = min(3.5, min(w, d) * 0.22); wallH = max(5.5, h - roofH)
		else:
			roofH = max(1.0, min(3.2, min(w, d) * 0.25))
			wallH = max(2.6, h - roofH)
			if k != main and w * d < 0.45 * boxes[main][2] * boxes[main][3]: wallH = min(wallH, 3.1)
			kind = 10 if h <= 3.2 and area < 40 else 3 if k == garage else 4 if k != main else 0
			if k == main and garage < 0 and w >= 11 and h > 3.3: kind = 1 if rnd.random() < 0.5 else 2
			if k == garage: wallH = 3.0; roofH = min(roofH, 1.6)
		door = rnd.random() * 0.6 + 0.2
		if kind in (1, 2): door = rnd.random() * 0.3 + (0.55 if kind == 1 else 0.15)
		BOX.append((wx, wz, w, d, yaw, wallH, roofH, kind, door, 1 if (rnd.random() < 0.55 or kind == 3) else 0))
		# the driveway from the garage to the street, the front walk from the door
		front = (wx + fx * d / 2, wz + fz * d / 2)
		ax, az = fz, -fx                                   # the box's local +x in the world
		if not big and kind in (1, 2, 3):
			gx = 0 if kind == 3 else (-1 if kind == 1 else 1) * (w / 2 - 3.0)
			sx, sz = front[0] + ax * gx, front[1] + az * gx
			p = nearest_points(driveLines[tree_idx.nearest(Point(sx, sz))], Point(sx, sz))[0]
			if math.hypot(p.x - sx, p.y - sz) < 40: DRIVES.append((sx, sz, p.x, p.y, 5.6 if kind == 3 and w > 7.5 else 5.0))
		if not big and kind in (0, 1, 2):
			dx = (door - 0.5) * (w - 2.5)
			sx, sz = front[0] + ax * dx, front[1] + az * dx
			p = nearest_points(driveLines[tree_idx.nearest(Point(sx, sz))], Point(sx, sz))[0]
			if math.hypot(p.x - sx, p.y - sz) < 35: WALKS.append((sx, sz, p.x, p.y, 1.2))
			# a pool out back now and then
			if rnd.random() < 0.18 and area > 120:
				bx, bz = wx - fx * (d / 2 + 6), wz - fz * (d / 2 + 6)
				POOLS.append((bx, bz, 4 + rnd.random() * 1.5, 8 + rnd.random() * 3, yaw + (rnd.random() - 0.5) * 0.2))
print('buildings', len(bpolys), 'boxes', len(BOX), 'drives', len(DRIVES), 'walks', len(WALKS), 'pools', len(POOLS))

# ---------- land use ----------
LU = { 'residential': 1, 'grass': 2, 'park': 2, 'recreation_ground': 2, 'dog_park': 2, 'garden': 2, 'village_green': 2, 'cemetery': 2,
	'golf_course': 3, 'fairway': 3, 'rough': 3, 'tee': 4, 'green': 4, 'pitch': 4, 'playground': 5, 'school': 6, 'schoolyard': 6, 'university': 6, 'college': 6,
	'commercial': 7, 'retail': 7, 'industrial': 8, 'parking': 7, 'bunker': 9, 'water_hazard': 10, 'meadow': 11, 'farmland': 11, 'farmyard': 11, 'orchard': 11, 'nature_reserve': 12, 'religious': 6 }
ORDER = [1, 12, 11, 7, 8, 6, 2, 3, 5, 4, 9, 10]
lus = []
for l in json.load(open(f'{src}/landuse.json')):
	c = LU.get(l['c']) or LU.get(l['s'])
	if not c: continue
	pts = [world(x, y) for x, y in l['p']]
	if len(pts) >= 3: lus.append((c, pts))
lus.sort(key=lambda t: ORDER.index(t[0]))

# ---------- trees: yard trees, street trees, park trees ----------
res = [Polygon(p).buffer(0) for c, p in lus if c == 1]
parks = [Polygon(p).buffer(0) for c, p in lus if c in (2, 3, 6)]            # wild land is grown at run time from the terrain
blocked = unary_union([p.buffer(2.5) for p in bpolys] + [LineString(r['p']).buffer(WIDTH[r['c']] / 2 + (2.2 if r['c'] in DRIVE else 0.6)) for r in roads] + [Polygon([(a, b) for a, b in [(p[0] - p[2] / 2, p[1] - p[3] / 2), (p[0] + p[2] / 2, p[1] - p[3] / 2), (p[0] + p[2] / 2, p[1] + p[3] / 2), (p[0] - p[2] / 2, p[1] + p[3] / 2)]]).buffer(1.5) for p in POOLS])
blocked_idx = blocked
TREES = []
def scatter(polys, per_m2, hmin, hmax, conifer):
	from shapely.prepared import prep
	pb = prep(blocked)
	for P in polys:
		if P.is_empty: continue
		n = int(P.area * per_m2 + rnd.random())
		if n == 0: continue
		pp = prep(P)
		b = P.bounds
		tries = 0
		while n > 0 and tries < n * 6 + 20:
			tries += 1
			x, z = rnd.uniform(b[0], b[2]), rnd.uniform(b[1], b[3])
			pt = Point(x, z)
			if not pp.contains(pt) or pb.contains(pt): continue
			TREES.append((x, z, rnd.uniform(hmin, hmax), 1 if rnd.random() < conifer else 0)); n -= 1
scatter(res, 1 / 140, 6, 15, 0.22)
scatter(parks, 1 / 450, 7, 16, 0.2)
# street trees along the residential streets, behind the sidewalk
for r in roads:
	if r['c'] not in ('residential', 'tertiary', 'secondary', 'living_street'): continue
	L = LineString(r['p'])
	off = WIDTH[r['c']] / 2 + 3.0
	for side in (-1, 1):
		try: o = L.parallel_offset(off, 'left' if side > 0 else 'right')
		except Exception: continue
		if o.is_empty or o.geom_type != 'LineString': continue
		s = rnd.uniform(3, 12)
		while s < o.length:
			p = o.interpolate(s)
			if rnd.random() < 0.7 and not blocked.contains(p): TREES.append((p.x, p.y, rnd.uniform(7, 13), 0))
			s += rnd.uniform(11, 19)
print('trees', len(TREES))

# ---------- the coarse map ----------
PX = float(sys.argv[7]) if len(sys.argv) > 7 else 8
MW, MH = int((x1 - x0) / PX) + 1, int((zS - zN) / PX) + 1
def pix(p): return ((p[0] - x0) / PX, (p[1] - zN) / PX)
R = Image.new('L', (MW, MH), 0); G = Image.new('L', (MW, MH), 0); B = Image.new('L', (MW, MH), 0)
dr, dg, db = ImageDraw.Draw(R), ImageDraw.Draw(G), ImageDraw.Draw(B)
for c, pts in lus: dg.polygon([pix(p) for p in pts], fill=c * 16)
for r in roads:
	if r['c'] in ('footway', 'path', 'track', 'steps', 'cycleway'): continue
	dr.line([pix(p) for p in r['p']], fill=255, width=max(1, round(WIDTH[r['c']] / PX + 0.4)))
for P in bpolys: db.polygon([pix(p) for p in P.exterior.coords], fill=255)
A = Image.new('L', (MW, MH), 255)
Image.merge('RGBA', (R, G, B, A)).save(f'assets/bayarea/real/{name}.png', optimize=True)

# ---------- the binary ----------
HALF = max([abs(v) for r in roads for p in r['p'] for v in (p[0] - OX, p[1] - OZ)] + [abs(b[0] - OX) for b in BOX] + [abs(b[1] - OZ) for b in BOX] + [max(x1 - x0, zS - zN) / 2]) + 100
Q = 4 if HALF * 4 < 32000 else 2 if HALF * 2 < 32000 else 1 if HALF < 32000 else 0.5
print('extent', round(HALF), 'm, unit', 1 / Q, 'm')
out = bytearray()
def i16(*v): return struct.pack('<' + 'h' * len(v), *v)
def u16(*v): return struct.pack('<' + 'H' * len(v), *v)
secs = {}
start = len(out)
for r in roads:
	fl = (1 if r['bridge'] else 0) | (2 if r['link'] else 0) | (4 if r['end0'] else 0) | (8 if r['end1'] else 0) | (16 if r.get('div') else 0)
	pts = r['p']
	out += struct.pack('<BBHH', CLS.index(r['c']), fl, nix.get(r['n'], 0), len(pts))
	for p in pts: out += i16(q(p[0] - OX), q(p[1] - OZ))
secs['roads'] = [start, len(roads)]
while len(out) % 2: out += b'\0'
start = len(out)
for (wx, wz, w, d, yaw, wallH, roofH, kind, door, hip) in BOX:
	out += i16(q(wx - OX), q(wz - OZ), int(round(w * 20)), int(round(d * 20)), int(round(yaw * 10000)), int(round(wallH * 20)), int(round(roofH * 20)), kind | (hip << 8), int(round(door * 1000)))
secs['boxes'] = [start, len(BOX)]
start = len(out)
for (ax, az, bx, bz, w) in DRIVES + WALKS: out += i16(q(ax - OX), q(az - OZ), q(bx - OX), q(bz - OZ), int(round(w * 20)))
secs['paths'] = [start, len(DRIVES) + len(WALKS)]
start = len(out)
for (px, pz, w, d, yaw) in POOLS: out += i16(q(px - OX), q(pz - OZ), int(round(w * 20)), int(round(d * 20)), int(round(yaw * 10000)))
secs['pools'] = [start, len(POOLS)]
start = len(out)
for (tx, tz, h, con) in TREES: out += i16(q(tx - OX), q(tz - OZ), int(round(h * 20)), con)
secs['trees'] = [start, len(TREES)]
open(f'assets/bayarea/real/{name}.bin', 'wb').write(out)
json.dump({ 'name': name, 'geo': [LAT0, LON0], 'origin': [OX, OZ], 'unit': 1 / Q, 'bounds': [x0, zN, x1, zS], 'map': { 'step': PX, 'w': MW, 'h': MH },
	'classes': CLS, 'widths': [WIDTH[c] for c in CLS], 'sections': secs, 'names': names,
	'attribution': 'Map data: Overture Maps Foundation (CC BY 4.0 / ODbL), incl. © OpenStreetMap contributors, Microsoft and Google building footprints' },
	open(f'assets/bayarea/real/{name}.json', 'w'))
print('bin', len(out), 'bytes; map', MW, 'x', MH)
