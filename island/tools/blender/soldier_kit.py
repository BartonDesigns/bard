# The soldiers' head kit as real models: a high-cut ballistic helmet (shell, rubber edge
# trim, side rails, the front shroud, loop panels), night vision stowed up on its mount with
# the battery pouch behind and its cable, a strobe, and an electronic headset hung from the
# rails; and the plate carrier's kit (magazine pouches and magazines, admin pouch, dangler,
# radio, push-to-talk, medical pouch, tourniquet, back panel, drag handle, buckles), each in
# its own frame for the game to lay on the carrier. Each piece is modelled twice: a light game mesh with its own UVs in one shared atlas,
# and a detailed copy (bevels, slots, screw heads, ribbed rings, grit, weave) baked down onto
# it: normals, colour, roughness, metal, how much of the wearer's colour it takes, and
# ambient occlusion. The game fits it to each head (people/kit-models.js).
#
# Made to the reference head (ref-head.obj, the kit frame: game metres, origin at the skull's
# centre at eye height, +y up, +z forward). Needs Blender as a Python module:
#   python3.13 -m venv v && v/bin/pip install bpy
#   v/bin/python island/tools/blender/soldier_kit.py <out dir> [atlas size] [ao samples] [preview]
# then node island/tools/bake-soldier-kit.mjs <out dir> to pack it into island/assets/kit.

import bpy, bmesh, math, os, sys, json, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, 'out')
SIZE = int(sys.argv[2]) if len(sys.argv) > 2 else 2048
AO_SAMPLES = int(sys.argv[3]) if len(sys.argv) > 3 else 64
PREVIEW = len(sys.argv) > 4 and sys.argv[4] == 'preview'
os.makedirs(OUT, exist_ok=True)
T0 = time.time()
def log(*a): print('[kit %5.1fs]' % (time.time() - T0), *a, flush=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene
TAU, PI = math.tau, math.pi

# game (x, y up, z forward) to Blender (x, -y forward, z up); the glTF export turns it back
def G(p): return Vector((p[0], -p[2], p[1]))
def GAME(p): return Vector((p[0], p[2], -p[1]))
def V3(x, y, z): return Vector((x, y, z))
def clamp(x, a=0.0, b=1.0): return max(a, min(b, x))
def ss(u): u = clamp(u); return u * u * (3 - 2 * u)
def wrap(a): return math.atan2(math.sin(a), math.cos(a))

# ---------- the reference head ----------
def load_head():
	V, F, meta = [], [], None
	for line in open(os.path.join(HERE, 'ref-head.obj')):
		if line.startswith('# meta '): meta = json.loads(line[7:])
		elif line.startswith('v '): V.append(V3(*map(float, line.split()[1:4])))
		elif line.startswith('f '): F.append([int(s) - 1 for s in line.split()[1:4]])
	me = bpy.data.meshes.new('ref-head'); me.from_pydata([G(v) for v in V], [], F); me.update()
	for p in me.polygons: p.use_smooth = True
	ob = bpy.data.objects.new('ref-head', me); SC.collection.objects.link(ob)
	return ob, BVHTree.FromPolygons(V, F), meta
HEAD, BVH, META = load_head()
# how far out from the head a point is (negative inside it), along the way out from its middle
def clearance(p):
	d = V3(p.x, p.y + 0.01, p.z); d = d.normalized() if d.length > 1e-6 else V3(0, 0, 1)
	hit = BVH.ray_cast(V3(0, -0.01, 0) + d * 0.4, -d, 0.45)
	return (p - V3(0, -0.01, 0)).length - (hit[0] - V3(0, -0.01, 0)).length if hit[0] is not None else 1.0

# ---------- the shell's surface ----------
# its outer face, a radius out from a centre at eye height by angle round (th, 0 at the front,
# +pi/2 at the left ear) and up (ph): the head's own radius there, smoothed, and stood off it
# on the pads
C = V3(0, -0.01, 0)
STAND = 0.0215
def dirOf(th, ph): return V3(math.cos(ph) * math.sin(th), math.sin(ph), math.cos(ph) * math.cos(th))
NT, NP, PH0 = 128, 72, -0.75
def build_table():
	R = np.zeros((NP, NT))
	for j in range(NP):
		ph = PH0 + (PI / 2 - PH0) * j / (NP - 1)
		for i in range(NT):
			d = dirOf(-PI + TAU * i / NT, ph)
			hit = BVH.ray_cast(C + d * 0.4, -d, 0.45)
			R[j, i] = (hit[0] - C).length if hit[0] is not None else np.nan
	# (holes: the neighbours' mean)
	for _ in range(8):
		m = np.isnan(R)
		if not m.any(): break
		Rp = np.where(m, 0, R); W = (~m).astype(float)
		S = sum(np.roll(Rp, k, 1) for k in (-1, 1)) + np.vstack([Rp[1:], Rp[-1:]]) + np.vstack([Rp[:1], Rp[:-1]])
		N = sum(np.roll(W, k, 1) for k in (-1, 1)) + np.vstack([W[1:], W[-1:]]) + np.vstack([W[:1], W[:-1]])
		R = np.where(m & (N > 0), S / np.maximum(N, 1), R)
	# (the ears and the brow's bumps eased out: a helmet does not follow them)
	for _ in range(10):
		R = (R + np.roll(R, 1, 1) + np.roll(R, -1, 1) + np.vstack([R[1:], R[-1:]]) + np.vstack([R[:1], R[:-1]])) / 5
		R[-1, :] = R[-1, :].mean()
	return R
TAB = build_table()
def headR(th, ph):
	u = ((th + PI) % TAU) / TAU * NT; v = clamp((ph - PH0) / (PI / 2 - PH0)) * (NP - 1)
	i0 = int(math.floor(u)) % NT; i1 = (i0 + 1) % NT; fu = u - math.floor(u)
	j0 = min(NP - 2, int(v)); fv = v - j0
	a = TAB[j0, i0] * (1 - fu) + TAB[j0, i1] * fu; b = TAB[j0 + 1, i0] * (1 - fu) + TAB[j0 + 1, i1] * fu
	return a * (1 - fv) + b * fv

# where the shell is cut, by angle round: just over the brow at the front, up high over the
# ears (high-cut), down to the nape behind
KNOTS = [(0, .041), (.62, .038), (1.02, .03), (1.3, .05), (2.0, .048), (2.45, .006), (PI, -.024)]
def rimY(th):
	f = min(PI, abs(wrap(th))); k = 1
	while k < len(KNOTS) - 1 and KNOTS[k][0] < f: k += 1
	(a0, y0), (a1, y1) = KNOTS[k - 1], KNOTS[k]
	return y0 + (y1 - y0) * ss((f - a0) / (a1 - a0))

# the shell's radius: stood off the head, its crown a little fuller as the moulds are, the
# edge flared out just above the cut (more over the ears)
def shellR(th, ph):
	r = headR(th, ph) + STAND
	r += 0.004 * math.exp(-((ph - 0.95) / 0.35) ** 2)
	y = C.y + r * math.sin(ph); h = y - rimY(th)
	side = math.exp(-((abs(wrap(th)) - 1.65) / 0.45) ** 2)
	r += (0.0028 + 0.0022 * side) * (1 - ss(h / 0.016))
	return r
def P(th, ph, off=0.0): return C + dirOf(th, ph) * (shellR(th, ph) + off)
def phAt(th, y):
	lo, hi = PH0, PI / 2
	for _ in range(40):
		m = (lo + hi) / 2
		if P(th, m).y < y: lo = m
		else: hi = m
	return (lo + hi) / 2
def nrm(th, ph):
	e = 1e-3; a = P(th + e, ph) - P(th - e, ph); b = P(th, min(PI / 2 - 1e-4, ph + e)) - P(th, ph - e)
	n = b.cross(a)
	if n.length < 1e-9: return V3(0, 1, 0)
	n.normalize()
	return n if n.dot(dirOf(th, ph)) > 0 else -n
# a point on the shell by angle round and height (in the kit frame), and its normal
def surf(th, y, off=0.0):
	ph = phAt(th, y); n = nrm(th, ph); return P(th, ph) + n * off, n
def frame_at(n, up=V3(0, 1, 0)):
	z = n.normalized(); y = (up - z * up.dot(z)).normalized(); x = y.cross(z); return x, y, z

# ---------- building meshes ----------
# a mesh in the making: its points, its faces with their corners' UVs (in metres; None: the
# piece is unwrapped by Blender) and material slots
class MB:
	def __init__(s): s.V, s.F, s.U, s.Mi = [], [], [], []
	def v(s, p): s.V.append(V3(*p)); return len(s.V) - 1
	def f(s, idx, uv=None, m=0): s.F.append(idx); s.U.append(uv); s.Mi.append(m)
	def obj(s, name, mats, smooth=True, sharp=0.6, uvscale=1.0):
		me = bpy.data.meshes.new(name)
		me.from_pydata([G(v) for v in s.V], [], s.F)
		for m in mats: me.materials.append(M(m))
		for p, mi in zip(me.polygons, s.Mi): p.material_index = mi; p.use_smooth = smooth
		ob = bpy.data.objects.new(name, me); SC.collection.objects.link(ob)
		ob['uvs'] = all(u is not None for u in s.U)
		if ob['uvs']:
			uvl = me.uv_layers.new(name='UV')
			for p, uv in zip(me.polygons, s.U):
				for k, li in enumerate(p.loop_indices): uvl.data[li].uv = (uv[k][0] * uvscale, uv[k][1] * uvscale)
		me.validate(); me.update()
		if smooth and sharp: me.set_sharp_from_angle(angle=sharp)
		return ob
# a section swept along a path: pts and their normals (the way out), prof [(across, out)]
# anticlockwise; capped at the ends unless closed; its UVs along and round, in segs pieces
def sweep(mb, pts, ns, prof, closed=False, cap=True, m=0, segs=1):
	n, k = len(pts), len(prof); idx = []
	for i in range(n):
		a = pts[(i - 1) % n if closed else max(0, i - 1)]; b = pts[(i + 1) % n if closed else min(n - 1, i + 1)]
		T = (b - a).normalized(); N = (ns[i] - T * ns[i].dot(T)).normalized(); S = N.cross(T)
		idx.append([mb.v(pts[i] + S * u + N * v) for u, v in prof])
	L = [0.0]
	for i in range(1, n): L.append(L[-1] + (pts[i] - pts[i - 1]).length)
	tot = L[-1] + ((pts[0] - pts[-1]).length if closed else 0)
	pl = [0.0]
	for j in range(1, k): pl.append(pl[-1] + math.dist(prof[j], prof[j - 1]))
	ptot = pl[-1] + math.dist(prof[0], prof[-1])
	nf = n if closed else n - 1; sl = math.ceil(nf / segs)
	for i in range(nf):
		i1 = (i + 1) % n; s0 = (i // sl) * sl; u0 = L[i] - L[s0]; u1 = (L[i1] if i1 > i else tot) - L[s0]
		off = (i // sl) * (ptot + 0.004)
		for j in range(k):
			j1 = (j + 1) % k; v0 = pl[j] + off; v1 = (pl[j1] if j1 > j else ptot) + off
			mb.f([idx[i][j], idx[i][j1], idx[i1][j1], idx[i1][j]], [(u0, v0), (u0, v1), (u1, v1), (u1, v0)], m)
	if cap and not closed:
		mb.f(idx[0][::-1], [(-u - 0.02, v) for u, v in prof[::-1]], m)
		mb.f(idx[-1], [(u - 0.02, v + 0.03) for u, v in prof], m)
def ring(r, n=12, sx=1.0, sy=1.0): return [(math.cos(TAU * i / n) * r * sx, math.sin(TAU * i / n) * r * sy) for i in range(n)]
def rprof(w, h, rad, n=2, base=0.0):
	# a rounded rectangle w wide, h high, standing on base (anticlockwise)
	pts = []
	for cx, cy, a0 in ((w / 2 - rad, base + h - rad, 0), (-w / 2 + rad, base + h - rad, PI / 2), (-w / 2 + rad, base + rad, PI), (w / 2 - rad, base + rad, 1.5 * PI)):
		for i in range(n + 1): a = a0 + (PI / 2) * i / n; pts.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad))
	return pts
def catmull(P0, per=6):
	out = []
	for i in range(len(P0) - 1):
		p0, p1, p2, p3 = P0[max(0, i - 1)], P0[i], P0[i + 1], P0[min(len(P0) - 1, i + 2)]
		for k in range(per):
			t = k / per; t2, t3 = t * t, t * t * t
			out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
	out.append(P0[-1].copy()); return out
# a patch laid on the shell: a rounded outline (half-sizes a along, b up, in metres, its
# corners squared by power n), centred at angle th0 and height y0, stood off by off, thick;
# rings in to its middle so its edge is clean; its top edge eased by bevel
def patch(mb, th0, y0, a, b, off, thick, n=4.0, K=32, rings=3, bevel=0.0, m=0, dome=0.0):
	# (laid out by angle up and round, in metres along the shell, so it holds near the crown)
	ph0 = phAt(th0, y0); r0 = shellR(th0, ph0)
	def at(u, v, o):
		ph = ph0 + v / r0; th = th0 + u / (r0 * max(0.2, math.cos(ph)))
		return P(th, ph) + nrm(th, ph) * (off + o)
	out = []
	for i in range(K):
		t = TAU * i / K; c, s = math.cos(t), math.sin(t)
		out.append((math.copysign(abs(c) ** (2 / n), c) * a, math.copysign(abs(s) ** (2 / n), s) * b))
	top = []
	for r in range(rings):
		f = 1 - r / rings; e = (1 - bevel / max(a, b)) if r == 0 and bevel else 1.0
		top.append([mb.v(at(u * f * e, v * f * e, thick + dome * (1 - f * f))) for u, v in out])
	mid = mb.v(at(0, 0, thick + dome))
	uvo = lambda u, v: (u, v)
	for r in range(rings - 1):
		f0, f1 = 1 - r / rings, 1 - (r + 1) / rings
		for i in range(K):
			i1 = (i + 1) % K
			mb.f([top[r][i], top[r][i1], top[r + 1][i1], top[r + 1][i]], [uvo(out[i][0] * f0, out[i][1] * f0), uvo(out[i1][0] * f0, out[i1][1] * f0), uvo(out[i1][0] * f1, out[i1][1] * f1), uvo(out[i][0] * f1, out[i][1] * f1)], m)
	f1 = 1 / rings
	for i in range(K):
		i1 = (i + 1) % K; mb.f([top[-1][i], top[-1][i1], mid], [uvo(out[i][0] * f1, out[i][1] * f1), uvo(out[i1][0] * f1, out[i1][1] * f1), (0, 0)], m)
	# (the side, down to the shell)
	ring1 = [mb.v(at(u, v, thick - bevel * 0.7)) for u, v in out] if bevel else None
	ring2 = [mb.v(at(u, v, -0.0006)) for u, v in out]
	per = [0.0]
	for i in range(1, K + 1): per.append(per[-1] + math.dist(out[i % K], out[i - 1]))
	ox = 2 * a + 0.01
	rows = [top[0]] + ([ring1] if ring1 else []) + [ring2]
	hs = [0.0] + ([bevel] if ring1 else []) + [thick + (bevel * 0.3 if ring1 else 0)]
	for rr in range(len(rows) - 1):
		for i in range(K):
			i1 = (i + 1) % K
			mb.f([rows[rr][i], rows[rr + 1][i], rows[rr + 1][i1], rows[rr][i1]], [(ox + hs[rr], per[i]), (ox + hs[rr + 1], per[i]), (ox + hs[rr + 1], per[i + 1]), (ox + hs[rr], per[i + 1])], m)
def cyl(mb, c, axis, r, h, n=16, r2=None, cap=True, ax=None, m=0, prof=None):
	# a cylinder (or a cone, or a lathe of prof [(r, t)]) round axis, centred at c
	axis = axis.normalized(); ax = (ax or (V3(1, 0, 0) if abs(axis.x) < 0.9 else V3(0, 1, 0)))
	ax = (ax - axis * ax.dot(axis)).normalized(); ay = axis.cross(ax)
	prof = prof or [(r, -h / 2), (r2 if r2 is not None else r, h / 2)]
	# (a row of no radius is one point: the faces to it are triangles)
	rows = [[mb.v(c + axis * t)] * n if rr < 1e-6 else [mb.v(c + axis * t + (ax * math.cos(TAU * i / n) + ay * math.sin(TAU * i / n)) * rr) for i in range(n)] for rr, t in prof]
	for a, b in zip(rows, rows[1:]):
		for i in range(n):
			i1 = (i + 1) % n; q = [a[i], a[i1], b[i1], b[i]]
			q = [x for k, x in enumerate(q) if x not in q[:k]]
			mb.f(q, None, m)
	if cap:
		if prof[0][0] > 1e-5: mb.f(rows[0][::-1], None, m)
		if prof[-1][0] > 1e-5: mb.f(rows[-1], None, m)
	return rows
def box(mb, c, ax, ay, az, sx, sy, sz, m=0):
	V = [mb.v(c + ax * (k[0] * sx) + ay * (k[1] * sy) + az * (k[2] * sz)) for k in ((-1, -1, -1), (1, -1, -1), (1, 1, -1), (-1, 1, -1), (-1, -1, 1), (1, -1, 1), (1, 1, 1), (-1, 1, 1))]
	for f in ([0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]): mb.f([V[i] for i in f], None, m)

# ---------- materials, for the bake ----------
# every material puts out the same few things from its nodes: colour, roughness, metal, how
# much of the wearer's own colour it takes (the tint: 1 on the painted shell), and a height
# for the fine relief; the bake reads one at a time
MATS = {}
def mat(kind):
	if kind in MATS: return MATS[kind]
	m = bpy.data.materials.new(kind)
	nt = m.node_tree; N = nt.nodes; L = nt.links; N.clear()
	out = N.new('ShaderNodeOutputMaterial'); bsdf = N.new('ShaderNodeBsdfPrincipled'); emit = N.new('ShaderNodeEmission')
	tc = N.new('ShaderNodeTexCoord'); geo = N.new('ShaderNodeNewGeometry')
	def noise(scale, detail=4.0, rough=0.55):
		n = N.new('ShaderNodeTexNoise'); n.inputs['Scale'].default_value = scale; n.inputs['Detail'].default_value = detail; n.inputs['Roughness'].default_value = rough
		L.new(tc.outputs['Object'], n.inputs['Vector']); return n.outputs['Fac']
	def op(o, a, b=None, cl=False):
		n = N.new('ShaderNodeMath'); n.operation = o; n.use_clamp = cl
		for k, x in enumerate((a, b)):
			if x is None: continue
			if isinstance(x, (int, float)): n.inputs[k].default_value = x
			else: L.new(x, n.inputs[k])
		return n.outputs[0]
	def mix(fac, a, b):
		n = N.new('ShaderNodeMix'); n.data_type = 'RGBA'
		for sock, x in ((n.inputs[0], fac), (n.inputs[6], a), (n.inputs[7], b)):
			if isinstance(x, (int, float, tuple)): sock.default_value = x
			else: L.new(x, sock)
		return n.outputs[2]
	def rgb(*c): return tuple(c) + (1.0,)
	def val(x): n = N.new('ShaderNodeValue'); n.outputs[0].default_value = x; return n.outputs[0]
	ao = N.new('ShaderNodeAmbientOcclusion'); ao.samples = 8; ao.inputs['Distance'].default_value = 0.008
	# (a worn edge: how convex it is, broken up; a recess: how shut in)
	edge = op('MULTIPLY', op('SUBTRACT', geo.outputs['Pointiness'], 0.52), 20.0, True)
	worn = op('MULTIPLY', edge, op('ADD', noise(160), 0.1), True)
	cav = op('SUBTRACT', 1.0, ao.outputs['AO'])
	col = rough = metal = tint = height = None
	if kind in ('paint', 'nylonT'):
		if kind == 'paint':
			# a gritty moulded finish, mottled, scuffed through to the light base at the
			# edges, dirt settled in the corners
			base = mix(noise(24, 6), rgb(0.74, 0.74, 0.72), rgb(0.9, 0.9, 0.88))
			col = mix(op('MULTIPLY', cav, 0.8), base, rgb(0.4, 0.38, 0.34))
			col = mix(op('MULTIPLY', worn, 0.7), col, rgb(0.96, 0.95, 0.92))
			rough = op('ADD', op('MULTIPLY', noise(60), 0.12), 0.56)
			tint = op('SUBTRACT', 1.0, op('MULTIPLY', worn, 0.4))
			height = op('ADD', op('MULTIPLY', noise(1500, 2), 0.7), op('MULTIPLY', noise(240, 3), 0.3))
		else:
			# a pouch in the helmet's own colour: a coarse weave, dust, its edges rubbed
			w = N.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = 700; L.new(tc.outputs['Object'], w.inputs['Vector'])
			w2 = N.new('ShaderNodeTexWave'); w2.inputs['Scale'].default_value = 700; w2.bands_direction = 'Y'; L.new(tc.outputs['Object'], w2.inputs['Vector'])
			col = mix(noise(90), rgb(0.66, 0.66, 0.64), rgb(0.8, 0.8, 0.78))
			col = mix(op('MULTIPLY', cav, 0.8), col, rgb(0.3, 0.29, 0.27))
			col = mix(op('MULTIPLY', worn, 0.5), col, rgb(0.92, 0.9, 0.86))
			rough = val(0.9); tint = val(1.0); height = op('ADD', w.outputs['Fac'], w2.outputs['Fac'])
	elif kind in ('nylonD', 'webbing', 'elastic', 'thread'):
		# the darker bound edges, the webbing, the elastic and the stitching, all in the
		# wearer's colour: tighter weaves, the elastic ribbed across, the webbing in bands
		w = N.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = {'nylonD': 900, 'webbing': 520, 'elastic': 260, 'thread': 2200}[kind]; L.new(tc.outputs['Object'], w.inputs['Vector'])
		if kind == 'elastic': w.bands_direction = 'X'
		w2 = N.new('ShaderNodeTexWave'); w2.inputs['Scale'].default_value = 900; w2.bands_direction = 'Y'; L.new(tc.outputs['Object'], w2.inputs['Vector'])
		lo, hi_ = {'nylonD': (0.46, 0.56), 'webbing': (0.5, 0.6), 'elastic': (0.4, 0.5), 'thread': (0.36, 0.42)}[kind]
		col = mix(noise(120), rgb(lo, lo, lo * 0.97), rgb(hi_, hi_, hi_ * 0.97))
		col = mix(op('MULTIPLY', cav, 0.8), col, rgb(0.22, 0.21, 0.2))
		col = mix(op('MULTIPLY', worn, 0.5), col, rgb(0.8, 0.78, 0.74))
		rough = val(0.92); tint = val(1.0)
		height = w.outputs['Fac'] if kind in ('elastic', 'thread') else op('ADD', w.outputs['Fac'], op('MULTIPLY', w2.outputs['Fac'], 0.6))
	elif kind == 'cordura':
		# a boot's nylon quarters in the wearer's colour: a fine grain (no woven bands, which
		# run as stripes over a curved upper), dust in the creases, the edges rubbed
		col = mix(noise(150), rgb(0.6, 0.6, 0.58), rgb(0.72, 0.72, 0.69))
		col = mix(op('MULTIPLY', cav, 0.8), col, rgb(0.3, 0.29, 0.27))
		col = mix(op('MULTIPLY', worn, 0.4), col, rgb(0.86, 0.85, 0.8))
		rough = val(0.9); tint = val(1.0); height = op('ADD', noise(3200, 2), op('MULTIPLY', noise(900, 3), 0.4))
	elif kind == 'suede':
		# suede in the wearer's colour: a brushed nap, mottled where it lies different ways,
		# darker in the creases and polished pale on the edges
		col = mix(noise(55, 5, 0.6), rgb(0.5, 0.5, 0.48), rgb(0.66, 0.66, 0.63))
		col = mix(op('MULTIPLY', cav, 0.9), col, rgb(0.24, 0.23, 0.21))
		col = mix(op('MULTIPLY', worn, 0.35), col, rgb(0.8, 0.79, 0.75))
		rough = val(0.97); tint = val(1.0); height = noise(2600, 6, 0.75)
	elif kind == 'pmag':
		# a polymer magazine in the colour it is issued in: a fine moulded grain, worn pale on
		# its corners
		# its corners only lightly (small pieces read as all edge to the wear)
		col = mix(op('MULTIPLY', worn, 0.2), rgb(0.6, 0.6, 0.58), rgb(0.8, 0.79, 0.76))
		col = mix(op('MULTIPLY', cav, 0.7), col, rgb(0.3, 0.3, 0.28))
		rough = op('ADD', op('MULTIPLY', noise(80), 0.08), 0.62); tint = op('SUBTRACT', 1.0, op('MULTIPLY', worn, 0.06)); height = noise(1800, 3)
	elif kind == 'redtab':
		col = mix(op('MULTIPLY', worn, 0.5), rgb(0.32, 0.035, 0.03), rgb(0.5, 0.12, 0.1))
		rough = val(0.75); tint = val(0.0); height = noise(1400, 2)
	elif kind == 'patch':
		# a subdued patch: an embroidered fill in two greys, its threads running across
		w = N.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = 1600; w.wave_profile = 'SAW'; L.new(tc.outputs['Object'], w.inputs['Vector'])
		col = mix(op('GREATER_THAN', noise(70, 2), 0.5), rgb(0.12, 0.12, 0.11), rgb(0.22, 0.22, 0.2))
		rough = val(0.85); tint = val(0.0); height = w.outputs['Fac']
	elif kind == 'loop':
		col = mix(noise(400, 3), rgb(0.58, 0.58, 0.56), rgb(0.7, 0.7, 0.68))
		col = mix(op('MULTIPLY', cav, 0.6), col, rgb(0.3, 0.29, 0.27))
		rough = val(0.96); tint = val(1.0); height = noise(2600, 6, 0.7)
	elif kind == 'polymer':
		col = mix(op('MULTIPLY', worn, 0.25), rgb(0.034, 0.035, 0.032), rgb(0.1, 0.1, 0.095))
		col = mix(op('MULTIPLY', cav, 0.6), col, rgb(0.018, 0.018, 0.017))
		rough = op('ADD', op('MULTIPLY', noise(90), 0.1), op('SUBTRACT', 0.64, op('MULTIPLY', worn, 0.12))); tint = val(0.0); height = noise(900, 2)
	elif kind == 'tpr':
		# moulded rubber in the wearer's colour, darker than the cloth and with a dull sheen (a
		# glove's knuckle guard and pads: tinted like the cloth round them, so no pale seam
		# shows where the tint changes)
		col = mix(noise(200, 3), rgb(0.36, 0.36, 0.35), rgb(0.42, 0.42, 0.41))
		col = mix(op('MULTIPLY', cav, 0.7), col, rgb(0.2, 0.2, 0.19))
		col = mix(op('MULTIPLY', worn, 0.3), col, rgb(0.55, 0.55, 0.53))
		rough = op('ADD', op('MULTIPLY', noise(70), 0.08), 0.5); tint = val(1.0); height = noise(1600, 2)
	elif kind == 'rubber':
		col = mix(op('MULTIPLY', worn, 0.5), rgb(0.03, 0.03, 0.029), rgb(0.1, 0.1, 0.095))
		rough = val(0.8); tint = val(0.0); height = noise(1400, 2)
	elif kind == 'alu':
		# black anodised aluminium, worn to the bright metal at the corners
		w = op('MULTIPLY', worn, 1.5, True)
		col = mix(w, rgb(0.03, 0.03, 0.032), rgb(0.6, 0.6, 0.58))
		rough = op('SUBTRACT', 0.42, op('MULTIPLY', w, 0.12)); metal = op('ADD', op('MULTIPLY', w, 0.6), 0.35); tint = val(0.0); height = noise(800, 2)
	elif kind == 'plate':
		# a gauntlet's forged steel: mottled from the forge and the hammer, rubbed bright on its
		# edges and ridges, grime gone brown in the laps and round the rivets
		col = mix(noise(40, 5), rgb(0.44, 0.45, 0.46), rgb(0.54, 0.55, 0.56))
		col = mix(op('MULTIPLY', cav, 1.4, True), col, rgb(0.1, 0.08, 0.06))
		col = mix(op('MULTIPLY', worn, 0.6, True), col, rgb(0.66, 0.66, 0.66))
		rough = op('ADD', op('MULTIPLY', noise(25), 0.08), op('SUBTRACT', op('ADD', 0.3, op('MULTIPLY', cav, 0.4)), op('MULTIPLY', worn, 0.1)))
		metal = op('SUBTRACT', 1.0, op('MULTIPLY', cav, 0.5)); tint = val(0.0)
		height = op('ADD', op('MULTIPLY', noise(260, 2), 0.6), op('MULTIPLY', noise(2400, 2), 0.15))
	elif kind == 'tlea':
		# the gauntlet's glove: leather in the wearer's leather colour, a pebbled grain, darker
		# in its creases, burnished on the edges
		col = mix(noise(70, 4), rgb(0.5, 0.5, 0.49), rgb(0.62, 0.62, 0.6))
		col = mix(op('MULTIPLY', cav, 0.9), col, rgb(0.25, 0.25, 0.24))
		col = mix(op('MULTIPLY', worn, 0.4), col, rgb(0.78, 0.78, 0.76))
		rough = op('ADD', op('MULTIPLY', noise(50), 0.1), op('SUBTRACT', 0.66, op('MULTIPLY', worn, 0.2))); tint = val(1.0)
		height = op('ADD', noise(2000, 3, 0.6), op('MULTIPLY', noise(300, 2), 0.3))
	elif kind == 'steel':
		col = rgb(0.4, 0.4, 0.39); rough = val(0.36); metal = val(1.0); tint = val(0.0); height = noise(900, 2)
	elif kind == 'foam':
		col = mix(noise(120), rgb(0.045, 0.045, 0.043), rgb(0.08, 0.08, 0.075))
		rough = val(1.0); tint = val(0.0); height = noise(900, 5, 0.7)
	elif kind == 'nylon':
		w = N.new('ShaderNodeTexWave'); w.inputs['Scale'].default_value = 900; L.new(tc.outputs['Object'], w.inputs['Vector'])
		col = mix(noise(150), rgb(0.05, 0.05, 0.047), rgb(0.085, 0.085, 0.08))
		col = mix(op('MULTIPLY', worn, 0.5), col, rgb(0.17, 0.17, 0.16))
		rough = val(0.9); tint = val(0.0); height = w.outputs['Fac']
	elif kind == 'lens':
		col = rgb(0.03, 0.09, 0.07); rough = val(0.04); metal = val(0.9); tint = val(0.0); height = val(0.5)
	elif kind == 'skin':
		col = rgb(0.55, 0.38, 0.3); rough = val(0.5); tint = val(0.0); height = val(0.5)
	if metal is None: metal = val(0.0)
	if isinstance(col, tuple): col = mix(0.0, col, col)
	bump = N.new('ShaderNodeBump')
	bump.inputs['Strength'].default_value = {'plate': 0.18, 'tlea': 0.45, 'cordura': 0.4, 'suede': 0.5, 'loop': 0.9, 'paint': 0.4, 'foam': 0.8, 'nylon': 0.5, 'nylonT': 0.6, 'nylonD': 0.6, 'webbing': 0.7, 'elastic': 0.8, 'thread': 0.6, 'patch': 0.7, 'pmag': 0.3}.get(kind, 0.25)
	bump.inputs['Distance'].default_value = {'plate': 0.0003, 'tlea': 0.0003, 'loop': 0.0006, 'paint': 0.00025, 'foam': 0.0008, 'nylon': 0.0003, 'nylonT': 0.0004, 'nylonD': 0.0004, 'webbing': 0.0005, 'elastic': 0.0006, 'thread': 0.0002, 'patch': 0.0003}.get(kind, 0.0002)
	L.new(height, bump.inputs['Height'])
	L.new(col, bsdf.inputs['Base Color']); L.new(rough, bsdf.inputs['Roughness']); L.new(metal, bsdf.inputs['Metallic'])
	L.new(bump.outputs['Normal'], bsdf.inputs['Normal'])
	L.new(bsdf.outputs[0], out.inputs['Surface'])
	MATS[kind] = (m, {'col': col, 'rough': rough, 'metal': metal, 'tint': tint}, emit, bsdf, out)
	return MATS[kind]
def M(kind): return mat(kind)[0]
def show(channel):
	# each material shows one thing for the bake: its colour or a value as light, or its
	# surface (for the normals)
	for kind, (m, ch, emit, bsdf, out) in MATS.items():
		L = m.node_tree.links
		for l in list(out.inputs['Surface'].links): L.remove(l)
		for l in list(emit.inputs['Color'].links): L.remove(l)
		if channel == 'normal': L.new(bsdf.outputs[0], out.inputs['Surface']); continue
		L.new(ch[channel], emit.inputs['Color']); emit.inputs['Strength'].default_value = 1.0
		L.new(emit.outputs[0], out.inputs['Surface'])

# ---------- pieces ----------
# each piece: its game mesh (low), the detailed copies baked onto it (highs), the group it
# goes out in (helmet, nvg, headset)
PIECES = []
def piece(low, highs, group):
	low['group'] = group; PIECES.append((low, highs)); return low
def apply_all(ob):
	bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = ob; ob.select_set(True)
	for md in list(ob.modifiers): bpy.ops.object.modifier_apply(modifier=md.name)
def hi(low, subsurf=0, bevel=0.0, segs=3, angle=0.6):
	h = low.copy(); h.data = low.data.copy(); h.name = low.name + '.hi'; SC.collection.objects.link(h)
	if bevel:
		b = h.modifiers.new('bev', 'BEVEL'); b.width = bevel; b.segments = segs; b.limit_method = 'ANGLE'; b.angle_limit = angle
	if subsurf:
		s = h.modifiers.new('sub', 'SUBSURF'); s.levels = subsurf; s.render_levels = subsurf
	if bevel or subsurf: apply_all(h)
	return h
def lowbevel(ob, w, segs=1, angle=0.6):
	# the game mesh's own corners eased (one or two cuts), so its outline is not a hard box
	b = ob.modifiers.new('bev', 'BEVEL'); b.width = w; b.segments = segs; b.limit_method = 'ANGLE'; b.angle_limit = angle; b.harden_normals = True
	apply_all(ob); return ob
def cutter(build):
	mb = MB(); build(mb); return mb.obj('cut', ['steel'], smooth=False, sharp=0)
def boolean(target, cut, operation='DIFFERENCE'):
	md = target.modifiers.new('bool', 'BOOLEAN'); md.operation = operation; md.solver = 'EXACT'; md.object = cut
	apply_all(target); bpy.data.objects.remove(cut)
def join(obs, name):
	bpy.ops.object.select_all(action='DESELECT')
	for o in obs: o.select_set(True)
	bpy.context.view_layer.objects.active = obs[0]; bpy.ops.object.join(); obs[0].name = name; obs[0].data.name = name; return obs[0]
# a ribbed ring (a focus ring, a knob's grip): only in the detailed copy
def ribbed(c, axis, r, h, ribs=28, depth=0.0009, n=112, kind='rubber'):
	mb = MB(); prof = [(r - depth, -h / 2), (r, -h / 2 + depth)]
	rows_t = [-h / 2, -h / 2 + depth, h / 2 - depth, h / 2]
	axis = axis.normalized(); ax = (V3(1, 0, 0) if abs(axis.x) < 0.9 else V3(0, 1, 0)); ax = (ax - axis * ax.dot(axis)).normalized(); ay = axis.cross(ax)
	rows = []
	for k, t in enumerate(rows_t):
		row = []
		for i in range(n):
			a = TAU * i / n; rib = 0.5 + 0.5 * math.cos(a * ribs)
			rr = (r - depth) + (depth * rib ** 0.5 if 0 < k < 3 else 0)
			row.append(mb.v(c + axis * t + (ax * math.cos(a) + ay * math.sin(a)) * rr))
		rows.append(row)
	for a, b in zip(rows, rows[1:]):
		for i in range(n): i1 = (i + 1) % n; mb.f([a[i], a[i1], b[i1], b[i]], None)
	mb.f(rows[0][::-1], None); mb.f(rows[-1], None)
	return mb.obj('rib', [kind], sharp=0.8)

def helmet():
	log('helmet')
	# the shell: rings from the cut up to the crown and a cap, its inside a lighter ring of
	# the same faces turned in (padding); UVs an equal-area map down from the crown
	def uvOf(th, ph, s=1.0):
		rho = 2 * 0.12 * math.sin((PI / 2 - ph) / 2) * s; return (rho * math.sin(th), rho * math.cos(th))
	mb = MB()
	for side, NC, NR, off in ((1, 64, 14, 0.0), (-1, 32, 7, -0.0075)):
		rows = []
		for r in range(NR):
			u = 1 - (1 - r / (NR - 1)) ** 1.35; row = []
			for i in range(NC):
				th = -PI + TAU * i / NC; ph0 = phAt(th, rimY(th)); ph = ph0 + (1.45 - ph0) * u
				p = P(th, ph) + nrm(th, ph) * off if off else P(th, ph)
				row.append((mb.v(p), uvOf(th, ph, 1.0 if side > 0 else 0.5)))
			rows.append(row)
		pole = (mb.v(P(0, PI / 2) + V3(0, off, 0)), (0.0, 0.0))
		mi = 0 if side > 0 else 1
		for r in range(NR - 1):
			for i in range(NC):
				q = [rows[r][i], rows[r][(i + 1) % NC], rows[r + 1][(i + 1) % NC], rows[r + 1][i]]
				if side < 0: q = q[::-1]
				mb.f([a for a, _ in q], [b for _, b in q], mi)
		for i in range(NC):
			q = [rows[-1][i], rows[-1][(i + 1) % NC], pole]
			if side < 0: q = q[::-1]
			mb.f([a for a, _ in q], [b for _, b in q], mi)
	shell = mb.obj('shell', ['paint', 'foam'], sharp=0)
	piece(shell, [hi(shell, subsurf=2)], 'helmet')
	# the edge trim: a rubber channel over the cut edge
	mb = MB(); pts, ns = [], []
	for i in range(96):
		th = -PI + TAU * i / 96; ph = phAt(th, rimY(th)); n = nrm(th, ph)
		pts.append(P(th, ph) - n * 0.0036); ns.append(n)
	sweep(mb, pts, ns, ring(0.0052, 8, 1.15, 1.0), closed=True, segs=4)
	trim = mb.obj('trim', ['rubber'], sharp=0)
	piece(trim, [hi(trim, subsurf=1)], 'helmet')
	# the rails: a polymer channel each side, following the cut, bolted through; windows
	# along them for the clips
	for s in (-1, 1):
		mb = MB(); pts, ns = [], []
		for i in range(21):
			th = s * (PI / 2 - 0.86 + 1.72 * i / 20); p, n = surf(th, rimY(th) + 0.0205, -0.0008); pts.append(p); ns.append(n)
		sweep(mb, pts, ns, rprof(0.022, 0.0068, 0.0018, 2))
		rail = mb.obj('rail' + ('L' if s > 0 else 'R'), ['polymer'], sharp=0.5)
		hr = hi(rail, bevel=0.0007, segs=2)
		def windows(mb):
			for k in range(9):
				th = s * (PI / 2 - 0.56 + 1.12 * k / 8); p, n = surf(th, rimY(th) + 0.0205, 0.0062); x, y, z = frame_at(n)
				box(mb, p, x, y, z, 0.0034, 0.0042, 0.003)
		boolean(hr, cutter(windows))
		piece(rail, [hr], 'helmet')
		for th in (s * (PI / 2 - 0.66), s * (PI / 2 + 0.66), s * (PI / 2)):
			p, n = surf(th, rimY(th) + 0.0205, 0.0062)
			mb = MB(); cyl(mb, p + n * 0.0008, n, 0.0034, 0.0022, 12, r2=0.003); b = mb.obj('bolt', ['steel'], sharp=0.7)
			hb = hi(b, bevel=0.0004, segs=2); boolean(hb, cutter(lambda mb: cyl(mb, p + n * 0.0022, n, 0.0014, 0.002, 6))); piece(b, [hb], 'helmet')
	# the shroud at the brow: a curved plate on three bolts, the socket the mount locks into
	sy = rimY(0) + 0.024
	mb = MB(); patch(mb, 0, sy, 0.031, 0.021, 0.0004, 0.0042, n=5.0, bevel=0.0012)
	shroud = mb.obj('shroud', ['alu'], sharp=0.7)
	hs = hi(shroud, bevel=0.0005, segs=2)
	p0, n0 = surf(0, sy, 0.0046); x, y, z = frame_at(n0)
	boolean(hs, cutter(lambda mb: box(mb, p0 + y * 0.0005, x, y, z, 0.0125, 0.0068, 0.0028)))
	piece(shroud, [hs], 'helmet')
	r0 = shellR(0, phAt(0, sy))
	for (u, v) in ((-0.021, 0.012), (0.021, 0.012), (0, -0.013)):
		p, n = surf(u / r0, sy + v, 0.0046)
		mb = MB(); cyl(mb, p + n * 0.0009, n, 0.0031, 0.0018, 10, r2=0.0027); b = mb.obj('sbolt', ['steel'], sharp=0.7)
		hb = hi(b, bevel=0.0004, segs=2); boolean(hb, cutter(lambda mb: cyl(mb, p + n * 0.0019, n, 0.0012, 0.002, 6))); piece(b, [hb], 'helmet')
	# the loop panels: over the crown at the front, and on the back
	for th0, y0, a, b in ((0, rimY(0) + 0.073, 0.045, 0.02), (PI, rimY(PI) + 0.072, 0.05, 0.026)):
		mb = MB(); patch(mb, th0, y0, a, b, 0.0002, 0.0016, n=6.0, bevel=0.0004)
		lp = mb.obj('loop', ['loop'], sharp=0.7); piece(lp, [hi(lp)], 'helmet')
	return sy

def nvg(sy):
	log('night vision')
	# the frame at the shroud's socket: x across (to the left), y up the helmet, z out of it
	p0, n0 = surf(0, sy, 0.0046); X, Y, Z = frame_at(n0)
	L = lambda x, y, z: p0 + X * x + Y * y + Z * z
	# the mount: a block locked in the socket, its arm and the hinge barrel with a knob each end
	mb = MB(); box(mb, L(0, 0.004, 0.006), X, Y, Z, 0.0125, 0.0105, 0.006); box(mb, L(0, 0.02, 0.012), X, Y, Z, 0.011, 0.012, 0.0055)
	mount = lowbevel(mb.obj('mount', ['alu'], sharp=0.5), 0.0016, 1)
	hm = hi(mount, bevel=0.0005, segs=2)
	boolean(hm, cutter(lambda mb: [box(mb, L(s * 0.0128, 0.02, 0.012), X, Y, Z, 0.0016, 0.006, 0.0062) for s in (-1, 1)]))
	piece(mount, [hm], 'nvg')
	mb = MB(); cyl(mb, L(0, 0.031, 0.022), X, 0.0068, 0.04, 14); barrel = mb.obj('barrel', ['alu'], sharp=0.8)
	piece(barrel, [hi(barrel, bevel=0.0004, segs=2)], 'nvg')
	for s in (-1, 1):
		mb = MB(); cyl(mb, L(s * 0.0235, 0.031, 0.022), X, 0.0086, 0.007, 14); k = mb.obj('knob', ['rubber'], sharp=0.8)
		piece(k, [hi(k, bevel=0.0006, segs=2), ribbed(L(s * 0.0235, 0.031, 0.022), X, 0.0087, 0.0068, ribs=18, depth=0.0006, n=72)], 'nvg')
	# the binocular turned up: its bridge across the top of the mount with the battery cap
	# in it; on each side a housing looking up the helmet, its objective at the top behind a
	# ribbed focus ring and the lens set back in the barrel; the rubber eyecups at the bottom
	B0 = L(0, 0.047, 0.032)
	mb = MB(); box(mb, B0, X, Y, Z, 0.042, 0.0105, 0.012)
	bridge = lowbevel(mb.obj('bridge', ['polymer'], sharp=0.5), 0.005, 2)
	hb = hi(bridge, bevel=0.0006, segs=2)
	piece(bridge, [hb], 'nvg')
	mb = MB(); cyl(mb, B0 + X * 0.011 + Y * 0.0095 + Z * 0.004, X, 0.0088, 0.03, 16); bt = mb.obj('battery', ['polymer'], sharp=0.8)
	piece(bt, [hi(bt, bevel=0.0005, segs=2)], 'nvg')
	mb = MB(); cyl(mb, B0 + X * 0.0295 + Y * 0.0095 + Z * 0.004, X, 0.0097, 0.007, 16); cap = mb.obj('cap', ['rubber'], sharp=0.8)
	piece(cap, [hi(cap, bevel=0.0006, segs=2), ribbed(B0 + X * 0.0295 + Y * 0.0095 + Z * 0.004, X, 0.0098, 0.0068, ribs=22, depth=0.0006, n=88)], 'nvg')
	mb = MB(); cyl(mb, B0 - X * 0.011 - Y * 0.004 + Z * 0.013, Z, 0.0052, 0.008, 12); kn = mb.obj('gain', ['rubber'], sharp=0.8)
	piece(kn, [hi(kn, bevel=0.0005, segs=2)], 'nvg')
	D = (Y * 0.94 - Z * 0.34).normalized()
	for s in (-1, 1):
		c = B0 + X * (s * 0.031) - Y * 0.004 + Z * 0.004
		at = lambda t: c + D * t
		mb = MB(); cyl(mb, at(0.0235), D, 0.0156, 0.047, 18, ax=X); h = mb.obj('housing', ['polymer'], sharp=0.8)
		hh = hi(h, bevel=0.0012, segs=3)
		# (a flat on the outer side with its seam and screws)
		boolean(hh, cutter(lambda mb: box(mb, at(0.026) + X * (s * 0.0172), X, D, D.cross(X), 0.0024, 0.017, 0.012)))
		piece(h, [hh], 'nvg')
		mb = MB(); cyl(mb, at(-0.0045), D, 0, 0, 18, ax=X, prof=[(0.0118, -0.0055), (0.0168, -0.0035), (0.0176, 0.0035), (0.0146, 0.0055), (0.0126, 0.004)], cap=False)
		cup = mb.obj('eyecup', ['rubber'], sharp=0)
		piece(cup, [hi(cup, subsurf=1)], 'nvg')
		mb = MB(); cyl(mb, at(0.0565), D, 0.0158, 0.013, 18, ax=X); fr = mb.obj('focus', ['rubber'], sharp=0.8)
		piece(fr, [ribbed(at(0.0565), D, 0.0159, 0.013, ribs=30, depth=0.0009, n=120)], 'nvg')
		mb = MB(); cyl(mb, at(0.067), D, 0, 0, 18, ax=X, prof=[(0.0148, -0.0045), (0.0152, 0.0035), (0.0138, 0.0048), (0.0126, 0.004), (0.0124, 0.0005)], cap=False)
		ob = mb.obj('objective', ['polymer'], sharp=0)
		piece(ob, [hi(ob, subsurf=1)], 'nvg')
		mb = MB(); cyl(mb, at(0.0672), D, 0.0125, 0.0008, 18, ax=X); ln = mb.obj('lens', ['lens'], sharp=0.8)
		piece(ln, [hi(ln)], 'nvg')
		mb = MB(); cyl(mb, at(-0.0062), D, 0.0119, 0.0008, 18, ax=X); ln = mb.obj('ocular', ['lens'], sharp=0.8)
		piece(ln, [hi(ln)], 'nvg')
	# the battery pouch behind as a counterweight, in the helmet's colour, and its cable
	# round the left side under the rail to the mount, held in two clips; a strobe on the back
	py = rimY(PI) + 0.046
	mb = MB(); patch(mb, PI, py, 0.043, 0.026, 0.0004, 0.024, n=4.5, K=32, rings=3, bevel=0.007, dome=0.003)
	pouch = mb.obj('pouch', ['nylonT'], sharp=0.9)
	hp = hi(pouch, subsurf=1)
	piece(pouch, [hp], 'nvg')
	mb = MB(); patch(mb, PI, py + 0.019, 0.04, 0.009, 0.0004 + 0.0235, 0.0025, n=4.0, K=24, rings=2, bevel=0.0015)
	flap = mb.obj('flap', ['nylonT'], sharp=0.9); piece(flap, [hi(flap, subsurf=1)], 'nvg')
	way = [surf(PI - 0.36, py + 0.012, 0.012)[0]]
	for th, h in ((PI - 0.62, 0.05), (PI / 2 + 0.55, 0.0485), (PI / 2 + 0.2, 0.046), (PI / 2 - 0.2, 0.046), (PI / 2 - 0.62, 0.044), (0.62, 0.036)):
		way.append(surf(th, rimY(th) + h, 0.0045)[0])
	way.append(L(0.018, 0.034, 0.016)); way.append(L(0.0145, 0.04, 0.026))
	pts = catmull(way, 5); ns = []
	for p in pts:
		th = math.atan2(p.x, p.z); ns.append(surf(th, p.y)[1])
	mb = MB(); sweep(mb, pts, ns, ring(0.0031, 8)); cable = mb.obj('cable', ['rubber'], sharp=0)
	piece(cable, [hi(cable, subsurf=1)], 'nvg')
	for th, h in ((PI / 2 + 0.55, 0.0485), (PI / 2 - 0.62, 0.044)):
		p, n = surf(th, rimY(th) + h, 0.0045); x, y, z = frame_at(n)
		mb = MB(); box(mb, p, x, y, z, 0.0055, 0.0052, 0.0042); cl = lowbevel(mb.obj('clip', ['polymer'], sharp=0.5), 0.0012, 1)
		piece(cl, [hi(cl, bevel=0.0004, segs=2)], 'nvg')
	sp, sn = surf(PI * 0.8, 0.094, 0.0); x, y, z = frame_at(sn)
	mb = MB(); box(mb, sp + z * 0.009, x, y, z, 0.015, 0.015, 0.009); st = lowbevel(mb.obj('strobe', ['polymer'], sharp=0.5), 0.004, 2)
	piece(st, [hi(st, bevel=0.0005, segs=2)], 'nvg')
	mb = MB(); cyl(mb, sp + z * 0.0185, z, 0.0085, 0.002, 14, r2=0.0075); sl = mb.obj('strobelens', ['lens'], sharp=0.8)
	piece(sl, [hi(sl, bevel=0.0004, segs=2)], 'nvg')

def headset():
	log('headset')
	# on each side: an arm from a clip on the rail down to a yoke round the cup; the cup a
	# moulded oval shell, its cushion sealed round the ear; buttons on the left cup and the
	# boom from it to the mouth with its windscreen; the volume knobs on the right
	ear = V3(abs(META['ear'][0]), META['ear'][1] + 0.024, META['ear'][2] - 0.004)
	for s in (1, -1):
		th = s * PI / 2
		rp, rn = surf(th, rimY(th) + 0.0205, 0.0069)
		cx = ear.x + 0.0165; cc = V3(s * cx, ear.y, ear.z)
		ax = V3(s, 0, 0)
		# (the cushion and the cup: a lathe of an oval section, the cup's crown proud)
		def oval(mb, prof, n=24, kind=0):
			rows = []
			for rr, t in prof:
				row = []
				for i in range(n):
					a = TAU * i / n; row.append(mb.v(cc + ax * t + V3(0, math.cos(a) * rr * 1.18, math.sin(a) * rr * 0.92)))
				rows.append(row)
			for a, b in zip(rows, rows[1:]):
				for i in range(n):
					i1 = (i + 1) % n; q = [a[i], a[i1], b[i1], b[i]]
					mb.f(q if s > 0 else q[::-1], None, kind)
			return rows
		mb = MB(); rows = oval(mb, [(0.0255, -0.0045), (0.0315, -0.001), (0.0335, 0.004), (0.031, 0.0095), (0.0275, 0.012)])
		cush = mb.obj('cushion', ['rubber'], sharp=0)
		piece(cush, [hi(cush, subsurf=2)], 'headset')
		mb = MB(); rows = oval(mb, [(0.0285, 0.0105), (0.0312, 0.013), (0.0318, 0.02), (0.0298, 0.03), (0.024, 0.0375), (0.014, 0.0408), (0.0, 0.0418)], 28)
		cup = mb.obj('cup', ['polymer'], sharp=0)
		hc = hi(cup, subsurf=2)
		# (a raised badge on the crown, a seam round the shell)
		boolean(hc, cutter(lambda mb: cyl(mb, cc + ax * 0.0408, ax, 0.0102, 0.0016, 32, r2=0.0098)), 'UNION')
		boolean(hc, cutter(lambda mb: cyl(mb, cc + ax * 0.0215, ax, 0.0322, 0.0007, 64, cap=False, prof=[(0.0345, -0.00035), (0.0345, 0.00035), (0.0306, 0.00035), (0.0306, -0.00035)])))
		piece(cup, [hc], 'headset')
		# the yoke: a band round the cup's top from front to back, on pivots
		pts, ns = [], []
		for i in range(13):
			a = -0.15 + (PI + 0.3) * i / 12
			p = cc + ax * 0.0215 + V3(0, math.sin(a) * 0.0375 * 1.08, math.cos(a) * 0.0375 * 0.86)
			pts.append(p); ns.append((p - cc - ax * 0.0215).normalized())
		mb = MB(); sweep(mb, pts, ns, rprof(0.0062, 0.0028, 0.0009, 1, -0.0008)); yoke = mb.obj('yoke', ['polymer'], sharp=0.6)
		piece(yoke, [hi(yoke, bevel=0.0004, segs=2)], 'headset')
		for z in (1, -1):
			pv = cc + ax * 0.0215 + V3(0, -0.0055, z * 0.0375 * 0.86 + z * 0.0016)
			mb = MB(); cyl(mb, pv, V3(0, 0, z), 0.0045, 0.004, 12); pvo = mb.obj('pivot', ['polymer'], sharp=0.8)
			piece(pvo, [hi(pvo, bevel=0.0005, segs=2)], 'headset')
		# the arm: a flat steel band from the rail clip down to the yoke's top
		top = cc + ax * 0.0215 + V3(0, 0.0375 * 1.08 + 0.002, 0)
		clip = rp + rn * 0.004
		way = [clip + V3(0, -0.006, 0), clip + rn * 0.004 + V3(0, -0.016, 0), top + ax * 0.004 + V3(0, 0.012, 0), top + V3(0, 0.002, 0)]
		pts = catmull(way, 5); ns = [ax.copy() for _ in pts]
		mb = MB(); sweep(mb, pts, ns, rprof(0.0072, 0.0022, 0.0007, 1, -0.0011)); arm = mb.obj('arm', ['alu'], sharp=0.6)
		piece(arm, [hi(arm, bevel=0.0003, segs=2)], 'headset')
		x, y, z = frame_at(rn)
		mb = MB(); box(mb, clip, x, y, z, 0.0125, 0.0135, 0.0045); ck = lowbevel(mb.obj('railclip', ['polymer'], sharp=0.5), 0.0016, 1)
		hk = hi(ck, bevel=0.0004, segs=2)
		boolean(hk, cutter(lambda mb: box(mb, clip + z * 0.0045, x, y, z, 0.006, 0.0015, 0.0012)))
		piece(ck, [hk], 'headset')
		if s > 0:
			# (the push-to-talk buttons on the left cup, and the boom)
			for k, (dy, dz) in enumerate(((-0.006, 0.019), (0.006, 0.019), (0.0, -0.022))):
				mb = MB(); cyl(mb, cc + ax * 0.0325 + V3(0, dy, dz), (ax + V3(0, 0, 0.6 * (1 if dz > 0 else -1))).normalized(), 0.0042, 0.006, 12); bt = mb.obj('button', ['rubber'], sharp=0.8)
				piece(bt, [hi(bt, bevel=0.0007, segs=2)], 'headset')
			root = cc + ax * 0.014 + V3(0, -0.018, 0.026)
			way = [root, root + V3(-0.004, -0.012, 0.022), V3(0.062, -0.074, 0.086), V3(0.04, -0.079, 0.104), V3(0.027, -0.08, 0.108)]
			# (kept clear of the face)
			for i, w in enumerate(way):
				for _ in range(30):
					if clearance(w) >= 0.022: break
					d = V3(w.x, 0, w.z).normalized(); w += d * 0.002
			pts = catmull(way, 7); ns = []
			for i, p in enumerate(pts):
				t = (pts[min(len(pts) - 1, i + 1)] - pts[max(0, i - 1)]).normalized(); n = V3(0, 1, 0) - t * t.y; ns.append(n.normalized())
			mb = MB(); sweep(mb, pts, ns, ring(0.0021, 8)); boom = mb.obj('boom', ['rubber'], sharp=0)
			piece(boom, [hi(boom, subsurf=1)], 'headset')
			tip = pts[-1]; tdir = (pts[-1] - pts[-3]).normalized()
			mb = MB(); cyl(mb, tip + tdir * 0.009, tdir, 0, 0, 12, prof=[(0.0, -0.011), (0.0045, -0.0095), (0.0068, -0.005), (0.0072, 0.002), (0.0058, 0.0085), (0.0, 0.0105)], cap=False)
			wind = mb.obj('windscreen', ['foam'], sharp=0)
			piece(wind, [hi(wind, subsurf=1)], 'headset')
			mb = MB(); cyl(mb, root, (root - cc).normalized(), 0.0052, 0.008, 12); bj = mb.obj('boomjoint', ['polymer'], sharp=0.8)
			piece(bj, [hi(bj, bevel=0.0006, segs=2)], 'headset')
		else:
			for dz in (0.012, -0.012):
				c0 = cc + ax * 0.0352 + V3(0, 0.012, dz)
				mb = MB(); cyl(mb, c0, ax, 0.0054, 0.007, 14); kn = mb.obj('volume', ['rubber'], sharp=0.8)
				piece(kn, [hi(kn, bevel=0.0006, segs=2), ribbed(c0, ax, 0.0055, 0.0068, ribs=16, depth=0.0005, n=64)], 'headset')

# ---------- the plate carrier's kit ----------
# each piece in its own frame, as the game lays it on the carrier (garment.js putPart): its
# back on the surface at the origin, +z out from the body, +y up; laid out apart from the
# head and from each other for the bake (each over a backing of its own for the occlusion),
# and brought back to its origin for the export
X, Y, Z = V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)
GEAR, BACKS = [], []
def gear(group, back=True):
	# (the pieces made since the last call go out as group, laid out in the next slot)
	k = len(GEAR); off = V3(0.5 + (k % 4) * 0.32, -(k // 4) * 0.36, 0.0)
	mine = [(l, hs) for l, hs in PIECES if l.get('group') == group]
	for l, hs in mine:
		for o in [l] + hs: o.location = G(off)
	if back:
		mb = MB(); box(mb, V3(0, 0, -0.0015), X, Y, Z, 0.15, 0.17, 0.001); b = mb.obj('back-' + group, ['nylonT'], smooth=False, sharp=0)
		b.location = G(off); b.hide_render = True; BACKS.append(b)
	GEAR.append((group, off))
def rrect(w, h, r, n=4, c=V3(0, 0, 0)):
	# a rounded rectangle's outline round c in the x-y plane, anticlockwise
	pts = []
	for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, PI / 2), (-w / 2 + r, -h / 2 + r, PI), (w / 2 - r, -h / 2 + r, 1.5 * PI)):
		for i in range(n + 1): a = a0 + (PI / 2) * i / n; pts.append(c + V3(cx + math.cos(a) * r, cy + math.sin(a) * r, 0))
	return pts
def slab(name, kind, c, hw, hh, hd, r, segs=2):
	# a rounded block (half sizes), its corners eased in the game mesh too
	mb = MB(); box(mb, c, X, Y, Z, hw, hh, hd); ob = mb.obj(name, [kind], sharp=0.5)
	return lowbevel(ob, r, segs) if r else ob
def bound(c, w, h, r, z, kind='nylonD', t=0.0022):
	# the binding tape round a front's edge: a rolled section along its outline
	pts = [p + V3(0, 0, z) for p in rrect(w, h, r, 4, c)]
	mb = MB(); sweep(mb, pts, [Z.copy() for _ in pts], ring(t, 8, 1.0, 1.3), closed=True)
	return mb.obj('binding', [kind], sharp=0)
def stitches(pts, n, step=0.0034, ln=0.0022, kind='thread'):
	# a row of stitches along a polyline, each a little proud of what it is sewn into
	mb = MB()
	for a, b in zip(pts, pts[1:]):
		d = b - a; L0 = d.length
		if L0 < 1e-6: continue
		t = d / L0; s = n.cross(t)
		for k in range(int(L0 / step)):
			box(mb, a + t * (step * (k + 0.5)), t, s, n, ln / 2, 0.00045, 0.00035)
	return mb.obj('stitch', [kind], smooth=False, sharp=0)
def zip_teeth(a, b, n, kind='polymer'):
	# a zip's teeth, alternating either side of its line, on a strip of tape
	mb = MB(); d = b - a; L0 = d.length; t = d / L0; s = n.cross(t)
	for k in range(int(L0 / 0.0021)):
		c = a + t * (0.0021 * (k + 0.5)) + s * (0.0007 if k % 2 else -0.0007)
		box(mb, c + n * 0.0006, t, s, n, 0.0007, 0.0016, 0.0007)
	return mb.obj('teeth', [kind], smooth=False, sharp=0)
def puller(c, kind='rubber'):
	# a zip's slider and its pull: a cord loop through it, a moulded grip on the end
	mb = MB(); box(mb, c, X, Y, Z, 0.0035, 0.0045, 0.0018); sl = lowbevel(mb.obj('slider', ['alu'], sharp=0.5), 0.0008, 1)
	pts = catmull([c + V3(0, -0.002, 0.0016), c + V3(0.0005, -0.009, 0.0028), c + V3(0, -0.016, 0.0024)], 4)
	mb = MB(); sweep(mb, pts, [Z.copy() for _ in pts], ring(0.0012, 6)); cord = mb.obj('cord', [kind], sharp=0)
	mb = MB(); cyl(mb, c + V3(0, -0.019, 0.0024), Y, 0.0026, 0.007, 10); grip = mb.obj('grip', [kind], sharp=0.7)
	return sl, cord, grip
def bartacks(pts, n):
	# the bar tacks that fix webbing down: a short dense zigzag, read as a raised bar
	mb = MB()
	for p in pts: box(mb, p + n * 0.0003, Y, X, n, 0.006, 0.0011, 0.0004)
	return mb.obj('tack', ['thread'], smooth=False, sharp=0)

def magazine():
	log('magazine')
	# a polymer rifle magazine standing out of its pouch, base plate up: the body ribbed
	# across, the plate flared with a grip ridge, a dot moulded in its side
	d = 0.036
	mag = slab('mag', 'pmag', V3(0, 0.0, d / 2), 0.031, 0.03, 0.0115, 0.002)
	hm = hi(mag, bevel=0.0006, segs=2)
	def ribs(mb):
		for y in (0.006, 0.013, 0.02):
			for z in (d / 2 + 0.0115, d / 2 - 0.0115): box(mb, V3(0, y, z), X, Y, Z, 0.033, 0.0012, 0.0006)
	boolean(hm, cutter(ribs))
	piece(mag, [hm], 'mag')
	plate = slab('plate', 'pmag', V3(0, 0.0345, d / 2), 0.0335, 0.0045, 0.0135, 0.0022)
	hp = hi(plate, bevel=0.0008, segs=2)
	boolean(hp, cutter(lambda mb: [box(mb, V3(x, 0.039, d / 2), X, Y, Z, 0.0011, 0.0012, 0.012) for x in (-0.012, -0.006, 0, 0.006, 0.012)]))
	piece(plate, [hp], 'mag')
	gear('mag')

def magpouch():
	log('mag pouch')
	# a sewn pouch open at the top, its edges bound, a band of elastic across its front, the
	# shock cord over the magazine's base plate down to a pull tab
	w, h, d = 0.066, 0.11, 0.036
	body = slab('mpouch', 'nylonT', V3(0, -h / 2, d / 2), w / 2, h / 2, d / 2, 0.0065, 2)
	hb = hi(body, subsurf=2)
	piece(body, [hb, bound(V3(0, -h / 2, 0), w - 0.002, h - 0.002, 0.0062, d - 0.0012),
		stitches([V3(-w / 2 + 0.0065, -0.006, d + 0.0002), V3(-w / 2 + 0.0065, -h + 0.0075, d + 0.0002), V3(w / 2 - 0.0065, -h + 0.0075, d + 0.0002), V3(w / 2 - 0.0065, -0.006, d + 0.0002)], Z)], 'magpouch')
	band = slab('elastic', 'elastic', V3(0, -h * 0.58, d + 0.0006), w / 2 + 0.001, 0.008, 0.0022, 0.0012, 1)
	piece(band, [hi(band, bevel=0.0004, segs=2)], 'magpouch')
	pts = catmull([V3(0, 0.022, 0.002), V3(0, 0.0408, 0.007), V3(0, 0.0412, 0.03), V3(0, 0.03, 0.0392), V3(0, 0.004, 0.0392)], 5)
	ns = []
	for i, p in enumerate(pts):
		t = (pts[min(len(pts) - 1, i + 1)] - pts[max(0, i - 1)]).normalized(); ns.append((X.cross(t)).normalized())
	mb = MB(); sweep(mb, pts, ns, ring(0.0017, 6)); cord = mb.obj('shockcord', ['rubber'], sharp=0)
	piece(cord, [hi(cord, subsurf=1)], 'magpouch')
	tab = slab('pulltab', 'rubber', V3(0, -0.006, d + 0.0032), 0.008, 0.012, 0.002, 0.0015, 1)
	ht = hi(tab, bevel=0.0005, segs=2)
	boolean(ht, cutter(lambda mb: [box(mb, V3(0, y, d + 0.0052), X, Y, Z, 0.0065, 0.0007, 0.0006) for y in (-0.012, -0.008, -0.004)]))
	piece(tab, [ht], 'magpouch')
	gear('magpouch')

def admin():
	log('admin pouch')
	# a flat pouch across the chest: a loop field with a subdued patch on it, a zip along its
	# top with its pull, the edges bound
	body = slab('admin', 'nylonT', V3(0, 0, 0.012), 0.085, 0.045, 0.012, 0.006, 2)
	piece(body, [hi(body, subsurf=1), bound(V3(0, 0, 0), 0.168, 0.088, 0.006, 0.0232)], 'admin')
	lp = slab('loop', 'loop', V3(-0.03, 0.004, 0.0245), 0.042, 0.025, 0.0012, 0.0008, 1)
	piece(lp, [hi(lp), bound(V3(-0.03, 0.004, 0), 0.084, 0.05, 0.003, 0.0255, 'nylonD', 0.0011)], 'admin')
	pt = slab('patch', 'patch', V3(-0.03, 0.004, 0.0262), 0.025, 0.015, 0.0008, 0.0006, 1)
	piece(pt, [hi(pt), bound(V3(-0.03, 0.004, 0), 0.05, 0.03, 0.002, 0.027, 'patch', 0.0009)], 'admin')
	zp = slab('zip', 'polymer', V3(0, 0.04, 0.0236), 0.075, 0.0024, 0.0008, 0)
	piece(zp, [hi(zp), zip_teeth(V3(-0.075, 0.04, 0.0238), V3(0.075, 0.04, 0.0238), Z)], 'admin')
	sl, cord, grip = puller(V3(0.06, 0.04, 0.0252))
	for o in (sl, cord, grip): piece(o, [hi(o, bevel=0.0003, segs=1) if o is sl else hi(o, subsurf=1)], 'admin')
	gear('admin')

def dangler():
	log('dangler')
	# the pouch hung under the front plate: deep and rounded, zipped along its top, seamed
	# round its front
	body = slab('dangler', 'nylonT', V3(0, 0, 0.022), 0.1, 0.04, 0.022, 0.014, 3)
	seam = rrect(0.186, 0.066, 0.009, 4, V3(0, 0, 0.0442)); seam.append(seam[0])
	piece(body, [hi(body, subsurf=2), stitches(seam, Z)], 'dangler')
	zp = slab('zip', 'polymer', V3(0, 0.03, 0.0428), 0.085, 0.0024, 0.0008, 0)
	piece(zp, [hi(zp), zip_teeth(V3(-0.085, 0.03, 0.043), V3(0.085, 0.03, 0.043), Z)], 'dangler')
	sl, cord, grip = puller(V3(0.075, 0.03, 0.0444))
	for o in (sl, cord, grip): piece(o, [hi(o, bevel=0.0003, segs=1) if o is sl else hi(o, subsurf=1)], 'dangler')
	gear('dangler')

def radio():
	log('radio')
	# a handheld radio in its pouch: the pouch with an elastic band, the radio's top standing
	# out of it, gripped with ribs, two knobs and the antenna's socket
	body = slab('rpouch', 'nylonT', V3(0, 0, 0.02), 0.033, 0.06, 0.02, 0.007, 2)
	piece(body, [hi(body, subsurf=2), bound(V3(0, 0, 0), 0.064, 0.118, 0.007, 0.039)], 'radio')
	band = slab('elastic', 'elastic', V3(0, -0.012, 0.0406), 0.034, 0.008, 0.0022, 0.0012, 1)
	piece(band, [hi(band, bevel=0.0004, segs=2)], 'radio')
	rb = slab('radio', 'polymer', V3(0, 0.062, 0.02), 0.028, 0.025, 0.015, 0.005, 2)
	hr = hi(rb, bevel=0.0008, segs=2)
	boolean(hr, cutter(lambda mb: [box(mb, V3(x, 0.06, 0.035), X, Y, Z, 0.0011, 0.018, 0.0008) for x in (-0.02, -0.016, -0.012, 0.012, 0.016, 0.02)]))
	piece(rb, [hr], 'radio')
	for x, r in ((-0.012, 0.0065), (0.012, 0.005)):
		mb = MB(); cyl(mb, V3(x, 0.093, 0.02), Y, r, 0.012, 14); kn = mb.obj('knob', ['rubber'], sharp=0.8)
		piece(kn, [hi(kn, bevel=0.0006, segs=2), ribbed(V3(x, 0.093, 0.02), Y, r + 0.0002, 0.011, ribs=18, depth=0.0005, n=72)], 'radio')
	mb = MB(); cyl(mb, V3(0, 0.0885, 0.024), Y, 0.0045, 0.006, 12); sk = mb.obj('socket', ['alu'], sharp=0.8)
	piece(sk, [hi(sk, bevel=0.0005, segs=2)], 'radio')
	gear('radio')

def ptt():
	log('talk switch')
	# the push-to-talk on the shoulder strap: a moulded housing, a big ribbed button, the
	# cable's gland out of its foot
	body = slab('ptt', 'polymer', V3(0, 0, 0.009), 0.017, 0.02, 0.009, 0.006, 2)
	piece(body, [hi(body, bevel=0.001, segs=3)], 'ptt')
	mb = MB(); cyl(mb, V3(0, 0.002, 0.0195), Z, 0.011, 0.004, 24); bt = mb.obj('button', ['rubber'], sharp=0.8)
	piece(bt, [hi(bt, bevel=0.0012, segs=3), ribbed(V3(0, 0.002, 0.0195), Z, 0.0112, 0.0036, ribs=36, depth=0.0005, n=144)], 'ptt')
	mb = MB(); cyl(mb, V3(0, -0.022, 0.009), Y, 0.004, 0.006, 10); gl = mb.obj('gland', ['rubber'], sharp=0.8)
	piece(gl, [hi(gl, bevel=0.0005, segs=2)], 'ptt')
	gear('ptt')

def medpouch():
	log('med pouch')
	# the medical pouch: its flap folded over the top with a red pull tab, a loop field on
	# its front, its edges bound
	body = slab('med', 'nylonT', V3(0, 0, 0.025), 0.0475, 0.055, 0.025, 0.012, 3)
	piece(body, [hi(body, subsurf=2), bound(V3(0, 0, 0), 0.093, 0.108, 0.012, 0.0488)], 'med')
	fl = slab('flap', 'nylonT', V3(0, 0.038, 0.046), 0.0495, 0.021, 0.006, 0.005, 2)
	piece(fl, [hi(fl, subsurf=1), bound(V3(0, 0.038, 0), 0.097, 0.04, 0.005, 0.0515)], 'med')
	lp = slab('loop', 'loop', V3(0, -0.014, 0.0502), 0.028, 0.02, 0.0012, 0.0008, 1)
	piece(lp, [hi(lp)], 'med')
	tb = slab('redtab', 'redtab', V3(0, 0.06, 0.0525), 0.015, 0.013, 0.0025, 0.002, 1)
	ht = hi(tb, bevel=0.0005, segs=2)
	boolean(ht, cutter(lambda mb: [box(mb, V3(0, y, 0.0552), X, Y, Z, 0.012, 0.0008, 0.0007) for y in (0.054, 0.059, 0.064)]))
	piece(tb, [ht], 'med')
	gear('med')

def tourniquet():
	log('tourniquet')
	# a tourniquet carried folded: its band wound flat, the windlass rod along its front in
	# its clip, the red tab at the top
	band = slab('tqband', 'nylon', V3(0, 0, 0.012), 0.016, 0.05, 0.012, 0.006, 2)
	piece(band, [hi(band, subsurf=2), stitches([V3(-0.0125, -0.046, 0.0242), V3(-0.0125, 0.046, 0.0242)], Z), stitches([V3(0.0125, -0.046, 0.0242), V3(0.0125, 0.046, 0.0242)], Z)], 'tq')
	mb = MB(); cyl(mb, V3(0, -0.004, 0.0262), Y, 0.0045, 0.08, 10); rod = mb.obj('windlass', ['polymer'], sharp=0.8)
	piece(rod, [hi(rod, bevel=0.0006, segs=2)], 'tq')
	cl = slab('clip', 'polymer', V3(0, 0.035, 0.0262), 0.012, 0.006, 0.0058, 0.002, 1)
	piece(cl, [hi(cl, bevel=0.0006, segs=2)], 'tq')
	tb = slab('redtab', 'redtab', V3(0, 0.055, 0.016), 0.01, 0.008, 0.003, 0.0018, 1)
	piece(tb, [hi(tb, bevel=0.0005, segs=2)], 'tq')
	gear('tq')

def backpanel():
	log('back panel')
	# the zip-on panel on the back plate: rows of webbing across it, a loop field at its top,
	# the zips down its sides, its edges bound (the game sizes it to the plate)
	W, H, D = 0.21, 0.28, 0.034
	body = slab('back', 'nylonT', V3(0, 0, D / 2), W / 2, H / 2, D / 2, 0.014, 3)
	rows = []
	for r in range(5):
		y = 0.06 - r * 0.038; rows.append(slab('web', 'webbing', V3(0, y, D + 0.0008), 0.09, 0.0125, 0.0009, 0.0005, 1))
	tacks = bartacks([V3(x, 0.06 - r * 0.038, D + 0.0016) for r in range(5) for x in (-0.09, -0.054, -0.018, 0.018, 0.054, 0.09)], Z)
	piece(body, [hi(body, subsurf=2), bound(V3(0, 0, 0), W - 0.002, H - 0.002, 0.014, D - 0.0012)] + rows + [tacks], 'back')
	lp = slab('loop', 'loop', V3(0, 0.106, D + 0.0012), 0.06, 0.022, 0.0012, 0.0008, 1)
	piece(lp, [hi(lp)], 'back')
	for x in (-0.1008, 0.1008):
		zp = slab('zip', 'polymer', V3(x, 0, 0.0298), 0.0024, 0.126, 0.0008, 0)
		n = V3(math.copysign(0.7, x), 0, 0.71).normalized()
		piece(zp, [hi(zp), zip_teeth(V3(x, -0.126, 0.03), V3(x, 0.126, 0.03), n)], 'back')
	gear('back')

def handle():
	log('drag handle')
	# the drag handle: a loop of webbing laid flat over the top of the back, a rubber grip
	# sleeved over its middle
	pts = [V3(math.cos(PI * i / 16) * 0.03, 0.004 + math.sin(PI * i / 16) * 0.03, 0.004) for i in range(17)]
	mb = MB(); sweep(mb, pts, [Z.copy() for _ in pts], rprof(0.02, 0.0034, 0.0011, 1, -0.0017)); lp = mb.obj('handle', ['nylon'], sharp=0.6)
	piece(lp, [hi(lp, bevel=0.0004, segs=2)], 'handle')
	gp = [V3(math.cos(a) * 0.03, 0.004 + math.sin(a) * 0.03, 0.004) for a in [PI / 3 + (PI / 3) * i / 6 for i in range(7)]]
	mb = MB(); sweep(mb, gp, [Z.copy() for _ in gp], ring(0.0072, 12, 1.0, 0.62)); gr = mb.obj('grip', ['rubber'], sharp=0)
	hg = hi(gr, subsurf=1)
	piece(gr, [hg], 'handle')
	gear('handle')

def buckle():
	log('buckle')
	# the ladder lock that adjusts a shoulder strap: a polymer frame, its two slots
	bk = slab('buckle', 'polymer', V3(0, 0, 0.0), 0.025, 0.008, 0.003, 0.0015, 1)
	hb = hi(bk, bevel=0.0005, segs=2)
	boolean(hb, cutter(lambda mb: [box(mb, V3(0, y, 0), X, Y, Z, 0.02, 0.0016, 0.004) for y in (-0.003, 0.003)]))
	piece(bk, [hb], 'buckle')
	gear('buckle')

# ---------- the combat boot ----------
# made round the reference foot (ref-foot.obj, the foot frame: origin at the ankle joint, +y
# up, +z along the foot, +x out to the side; a left boot, the game mirrors it for the right):
# the foot and ankle closed, stood off, remeshed and smoothed into one volume, cut at the top
# of the shaft and at the sole; a moulded sole round its outline with lugs under it and blocks
# round its wall; a rubber rand over the toe, suede over the toe and the heel, the quarters in
# nylon, a tongue, eyelets and laces up the front, a padded collar and a pull loop at the back
def load_foot():
	V, F, meta = [], [], None
	for line in open(os.path.join(HERE, 'ref-foot.obj')):
		if line.startswith('# meta '): meta = json.loads(line[7:])
		elif line.startswith('v '): V.append(V3(*map(float, line.split()[1:4])))
		elif line.startswith('f '): F.append([int(s) - 1 for s in line.split()[1:4]])
	me = bpy.data.meshes.new('ref-foot'); me.from_pydata([G(v) for v in V], [], F); me.update()
	ob = bpy.data.objects.new('ref-foot', me); SC.collection.objects.link(ob)
	return ob, meta
FOOT_STAND, SHAFT = 0.017, 0.11
# (the toe cap's edge: in front of it from this far along the foot at height h over the sole;
# the heel counter's: behind it)
TOEB = lambda h: FOOT_TOE - 0.085 + 0.35 * h
HEELB = lambda h: FOOT_HEEL + 0.07 - 0.9 * h
FOOT_TOE = FOOT_HEEL = 0.0
# (the rand's top edge over the toe: (along the foot, height over the sole), set in boot(); and
# its height at z, straight between them as the cut is)
RAND = []
def randH(z):
	if z >= RAND[-1][0]: return RAND[-1][1]
	for (za, ha), (zb, hb) in zip(RAND, RAND[1:]):
		if za <= z < zb: return ha + (hb - ha) * (z - za) / (zb - za)
	return 0.0
def boot():
	log('boot')
	FO, FM = load_foot()
	sole, toe, heel = FM['sole'], FM['toe'], FM['heel']
	global FOOT_TOE, FOOT_HEEL
	FOOT_TOE, FOOT_HEEL = toe, heel
	RAND[:] = [(toe - 0.085 + 0.05 * i / 6, 0.032 * ss(i / 6)) for i in range(7)]
	# the volume
	sh = FO.copy(); sh.data = FO.data.copy(); sh.name = 'boot-vol'; SC.collection.objects.link(sh)
	bm = bmesh.new(); bm.from_mesh(sh.data)
	bmesh.ops.holes_fill(bm, edges=[e for e in bm.edges if e.is_boundary], sides=0)
	bmesh.ops.triangulate(bm, faces=bm.faces)
	bmesh.ops.recalc_face_normals(bm, faces=bm.faces); bm.normal_update()
	for v in bm.verts: v.co += v.normal * FOOT_STAND
	bm.to_mesh(sh.data); bm.free()
	md = sh.modifiers.new('re', 'REMESH'); md.mode = 'VOXEL'; md.voxel_size = 0.003; apply_all(sh)
	md = sh.modifiers.new('sm', 'LAPLACIANSMOOTH'); md.lambda_factor = 1.2; md.iterations = 12; md.use_volume_preserve = True; apply_all(sh)
	# (the toes smoothed away into a roomy toe box, the front eased out a little)
	vg = sh.vertex_groups.new(name='front')
	for v in sh.data.vertices:
		z = -v.co.y; w = ss((z - (toe - 0.1)) / 0.06)
		if w > 0: vg.add([v.index], w, 'REPLACE')
	md = sh.modifiers.new('sm2', 'LAPLACIANSMOOTH'); md.lambda_factor = 1.5; md.iterations = 40; md.use_volume_preserve = True; md.vertex_group = 'front'; apply_all(sh)
	md = sh.modifiers.new('sm3', 'SMOOTH'); md.factor = 0.8; md.iterations = 60; md.vertex_group = 'front'; apply_all(sh)
	sh.data.update()
	for v in sh.data.vertices:
		z = -v.co.y; w = ss((z - (toe - 0.06)) / 0.05)
		if w > 0: v.co += v.normal * 0.004 * w
	# (cut at the top of the shaft and just over the sole; Blender's z is the game's y)
	bm = bmesh.new(); bm.from_mesh(sh.data)
	ysole = sole - FOOT_STAND * 0.2 + 0.006
	for co, no in (((0, 0, SHAFT), (0, 0, 1)), ((0, 0, ysole), (0, 0, -1))):
		r = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, clear_outer=True)
	# (the zones' edges cut into the faces, so each runs clean rather than stepped along them;
	# a plane in the game's frame through co, cutting only the faces whose middle keep allows)
	def cut(co, no, keep=None):
		fs = [f for f in bm.faces if keep is None or keep(GAME(f.calc_center_median()))]
		if not fs: return
		es = list({e for f in fs for e in f.edges}); vs = list({v for f in fs for v in f.verts})
		bmesh.ops.bisect_plane(bm, geom=vs + es + fs, plane_co=G(co), plane_no=G(no))
	z0 = toe - 0.085
	for (za, ha), (zb, hb) in zip(RAND, RAND[1:]):
		cut(V3(0, sole + ha, za), V3(0, zb - za, ha - hb), lambda c, za=za, zb=zb: za <= c.z < zb)
	cut(V3(0, sole + RAND[-1][1], 0), V3(0, 1, 0), lambda c: c.z >= RAND[-1][0])
	cut(V3(0, sole, z0), V3(0, -0.35, 1), lambda c: c.y - sole < 0.085)
	cut(V3(0, sole + 0.075, 0), V3(0, 1, 0), lambda c: c.z > TOEB(0.075) - 0.012)
	cut(V3(0, sole, heel + 0.07), V3(0, 0.9, 1))
	for x in (-0.019, 0.015): cut(V3(x, 0, 0), V3(1, 0, 0), lambda c: c.z > -0.01 and c.y > sole + 0.035)
	cut(V3(0, sole + 0.045, 0), V3(0, 1, 0), lambda c: abs(c.x + 0.002) < 0.025 and c.z > -0.01)
	cut(V3(0, SHAFT - 0.016, 0), V3(0, 1, 0))
	bm.to_mesh(sh.data); bm.free()
	for p in sh.data.polygons: p.use_smooth = True
	upper_hi = sh
	# (the material zones on the detailed upper: rand, toe cap, heel counter, tongue, collar)
	for k in ('cordura', 'suede', 'rubber', 'nylonD'): upper_hi.data.materials.append(M(k))
	# (finer faces first, so the zones' edges are smooth; each overlay stands a little proud)
	md = upper_hi.modifiers.new('sub', 'SUBSURF'); md.subdivision_type = 'SIMPLE'; md.levels = 1; md.render_levels = 1; apply_all(upper_hi)
	def zone(c):
		x, y, z = c.x, c.z, -c.y
		h = y - sole
		if z > toe - 0.085 and h < randH(z): return 2
		if z > TOEB(h) and h < 0.075: return 1
		if z < HEELB(h): return 1
		if abs(x + 0.002) < 0.017 and z > 0.0 and y > sole + 0.045: return 3
		if y > SHAFT - 0.016: return 3
		return 0
	for p in upper_hi.data.polygons: p.material_index = zone(p.center)
	# (each overlay a sheet of its own along its edge, stood off and closed down to what it
	# lies on by a clean lip, so the step runs as straight as the cut)
	LIFT = (0.0, 0.0007, 0.0011, 0.0)
	me = upper_hi.data; me.update()
	co = [v.co.copy() for v in me.vertices]; nv = [v.normal.copy() for v in me.vertices]
	F = [list(p.vertices) for p in me.polygons]; Z = [p.material_index for p in me.polygons]; sm = [p.use_smooth for p in me.polygons]
	low_at = [9.0] * len(co)
	for f, z in zip(F, Z):
		for vi in f: low_at[vi] = min(low_at[vi], LIFT[z])
	P, at = [], {}
	def vert(vi, l):
		# the point vi stood off by l: the vertex itself at the least lift round it, else a copy
		k = vi if l == low_at[vi] else (vi, l)
		if k not in at: at[k] = len(P); P.append(co[vi] + nv[vi] * l)
		return at[k]
	edge = {}
	for fi, f in enumerate(F):
		for a_, b_ in zip(f, f[1:] + f[:1]): edge[(a_, b_)] = fi
	F2, Z2, S2 = [], [], []
	for fi, (f, z) in enumerate(zip(F, Z)):
		l = LIFT[z]; F2.append([vert(vi, l) for vi in f]); Z2.append(z); S2.append(sm[fi])
		for a_, b_ in zip(f, f[1:] + f[:1]):
			gi = edge.get((b_, a_))
			if gi is None or LIFT[Z[gi]] >= l: continue
			lo = LIFT[Z[gi]]
			F2.append([vert(b_, l), vert(a_, l), vert(a_, lo), vert(b_, lo)]); Z2.append(z); S2.append(True)
	me2 = bpy.data.meshes.new('boot-upper'); me2.from_pydata(P, [], F2)
	for m in me.materials: me2.materials.append(m)
	for p, z, s_ in zip(me2.polygons, Z2, S2): p.material_index = z; p.use_smooth = s_
	me2.validate(); me2.update(); upper_hi.data = me2
	# the game's upper: the same, decimated
	low = upper_hi.copy(); low.data = upper_hi.data.copy(); low.name = 'boot'; SC.collection.objects.link(low)
	low.data.materials.clear(); low.data.materials.append(M('nylonT'))
	md = low.modifiers.new('dec', 'DECIMATE'); md.ratio = 1100 / max(1, len(low.data.polygons) * 2); md.use_collapse_triangulate = True; apply_all(low)
	low['uvs'] = False
	bvh = BVHTree.FromObject(upper_hi, bpy.context.evaluated_depsgraph_get())
	def onto(p_out, d_in, off=0.0):
		# a point on the upper's surface: cast from p_out (game) inward along d_in, stood off by off
		hit = bvh.ray_cast(G(p_out), G(d_in).normalized(), 0.12)
		if hit[0] is None: return None, None
		pg = V3(hit[0].x, hit[0].z, -hit[0].y); ng = V3(hit[1].x, hit[1].z, -hit[1].y)
		return pg + ng * off, ng
	highs = [upper_hi]
	# the lacing: a guide up the front from the toe cap to the top; eyelets each side, the lace
	# crossing between them, a stitch line down each side of the eyestay
	guide = []
	for i in range(8):
		t = i / 7; h = sole + 0.052 + t * (SHAFT - 0.022 - sole - 0.052)
		zf = (toe - 0.1) * (1 - t) ** 1.6 + 0.026 * (1 - (1 - t) ** 1.6)
		guide.append((h, zf))
	eye = {1: [], -1: []}
	for h, zf in guide:
		for s in (1, -1):
			p, n = onto(V3(s * 0.017 - 0.002, h, zf + 0.12), V3(0, -0.15, -1), 0.0)
			if p is None: continue
			eye[s].append((p, n))
	mb = MB()
	for s in (1, -1):
		for p, n in eye[s]:
			cyl(mb, p + n * 0.0008, n, 0, 0, 12, prof=[(0.0019, -0.0008), (0.0034, -0.0008), (0.0036, 0.0006), (0.0026, 0.0012), (0.0019, 0.0004)], cap=False)
	eyelets = mb.obj('eyelets', ['alu'], sharp=0.7); highs.append(eyelets)
	mb = MB()
	n0 = min(len(eye[1]), len(eye[-1]))
	# (each run of lace laid over the tongue between its eyelets, not cut straight through it)
	def lace(a, b):
		pts, ns = [], []
		for k in range(9):
			t = k / 8; q = a[0].lerp(b[0], t); n = a[1].lerp(b[1], t).normalized()
			p, nn = onto(q + n * 0.04, -n, 0.0017 + 0.0006 * math.sin(PI * t))
			if p is not None: pts.append(p); ns.append(nn)
		if len(pts) > 2: sweep(mb, pts, ns, ring(0.0017, 6, 1.0, 0.75))
	for i in range(n0 - 1):
		lace(eye[1][i], eye[-1][i + 1]); lace(eye[-1][i], eye[1][i + 1])
	if n0: lace(eye[1][0], eye[-1][0])
	laces = mb.obj('laces', ['thread'], sharp=0); highs.append(laces)
	# (stitching round the toe cap and the heel counter, and down each eyestay)
	def stitch_curve(gpts):
		pts, ns = [], []
		for po, d in gpts:
			p, n = onto(po, d, 0.0003)
			if p is not None: pts.append(p); ns.append(n)
		mb = MB()
		for (a, na), (b, nb) in zip(zip(pts, ns), list(zip(pts, ns))[1:]):
			dd = b - a; L0 = dd.length
			if L0 < 1e-6 or L0 > 0.02: continue
			t = dd / L0; nn = (na + nb).normalized(); s2 = nn.cross(t)
			for k in range(int(L0 / 0.0032)): box(mb, a + t * (0.0032 * (k + 0.5)), t, s2, nn, 0.0011, 0.00045, 0.00035)
		return mb.obj('stitch', ['thread'], smooth=False, sharp=0)
	for off in (0.0, 0.004):
		toeline = []
		for i in range(41):
			a = -PI / 2 + PI * i / 40; h = 0.03 + 0.045 * math.cos(a) ** 2
			z = TOEB(h) - off
			toeline.append((V3(math.sin(a) * 0.12, sole + h, z), V3(-math.sin(a), 0, -0.3 * math.cos(a))))
		highs.append(stitch_curve(toeline))
	# (the heel counter's edge: a slanted line round the back, found on the surface by a few
	# guesses each way round)
	heelline = []
	for i in range(31):
		a = PI / 2 + PI * i / 30; d = V3(math.sin(a), 0, math.cos(a)); h = 0.03
		for _ in range(5):
			p, n = onto(V3(0, sole + h, heel + 0.05) + d * 0.12, -d, 0.0)
			if p is None: break
			h = max(0.008, min(0.078, (heel + 0.07 - p.z) / 0.9))
		heelline.append((V3(0, sole + h, heel + 0.05) + d * 0.12, -d))
	highs.append(stitch_curve(heelline))
	for s in (1, -1):
		line = []
		for k in range(31):
			t = k / 30; h = sole + 0.052 + t * (SHAFT - 0.022 - sole - 0.052); zf = (toe - 0.1) * (1 - t) ** 1.6 + 0.026 * (1 - (1 - t) ** 1.6)
			line.append((V3(s * 0.025 - 0.002, h, zf + 0.12), V3(0, -0.15, -1)))
		highs.append(stitch_curve(line))
	low['cage'] = 0.004
	piece(low, highs, 'boot')
	# the padded collar round the top, and the pull loop at the back
	bm = bmesh.new(); bm.from_mesh(upper_hi.data)
	top = [v for v in bm.verts if v.is_boundary and v.co.z > SHAFT - 0.004]
	ring_pts = sorted([V3(v.co.x, v.co.z, -v.co.y) for v in top], key=lambda p: math.atan2(p.x, p.z - 0.0))
	bm.free()
	if len(ring_pts) > 12:
		step = max(1, len(ring_pts) // 36); rp = ring_pts[::step]
		ctr = sum(rp, V3(0, 0, 0)) / len(rp)
		ns = [V3(p.x - ctr.x, 0, p.z - ctr.z).normalized() for p in rp]
		pts = [p - n * 0.002 + V3(0, 0.001, 0) for p, n in zip(rp, ns)]
		mb = MB(); sweep(mb, pts, ns, ring(0.0055, 8, 1.0, 1.25), closed=True); col_lo = mb.obj('collar', ['nylonD'], sharp=0)
		piece(col_lo, [hi(col_lo, subsurf=1)], 'boot')
		bk = min(rp, key=lambda p: p.z)
		lp = [bk + V3(0, -0.012, -0.004), bk + V3(0, 0.006, -0.009), bk + V3(0, 0.018, -0.006), bk + V3(0, 0.02, 0.0), bk + V3(0, 0.008, 0.002)]
		pts = catmull(lp, 4); mb = MB(); sweep(mb, pts, [V3(0, 0, -1) for _ in pts], rprof(0.014, 0.0026, 0.0009, 1, -0.0013)); loop_lo = mb.obj('pull', ['webbing'], sharp=0.6)
		piece(loop_lo, [hi(loop_lo, bevel=0.0004, segs=2)], 'boot')
	# the sole: the upper's bottom outline, eased out, a moulded slab under it with a toe spring;
	# lugs under it and blocks round its wall in the detailed copy
	bm = bmesh.new(); bm.from_mesh(upper_hi.data)
	bot = [V3(v.co.x, v.co.z, -v.co.y) for v in bm.verts if v.is_boundary and v.co.z < ysole + 0.002]
	bm.free()
	cx = sum(p.x for p in bot) / len(bot); cz = sum(p.z for p in bot) / len(bot)
	K = 64; outline = []
	for i in range(K):
		a = TAU * i / K
		best = None
		for p in bot:
			ang = math.atan2(p.x - cx, p.z - cz)
			if abs((ang - a + PI) % TAU - PI) < 0.12:
				rr = math.hypot(p.x - cx, p.z - cz); best = rr if best is None or rr > best else best
		outline.append(best)
	for i in range(K):
		if outline[i] is None: outline[i] = outline[i - 1] or 0.05
	sm = [(outline[i - 1] + 2 * outline[i] + outline[(i + 1) % K]) / 4 for i in range(K)]
	pts2 = [(cx + math.sin(TAU * i / K) * (sm[i] + 0.004), cz + math.cos(TAU * i / K) * (sm[i] + 0.004)) for i in range(K)]
	y0, y1 = sole - 0.011, ysole + 0.014
	def spring(z): return 0.009 * ss((z - (toe - 0.06)) / 0.07)
	def slab(name, inset, lo_y, hi_y, kind='rubber'):
		mb = MB(); bot_i, top_i = [], []
		for (x, z) in pts2:
			dx, dz = x - cx, z - cz; l = math.hypot(dx, dz) or 1; xi, zi = x - dx / l * inset, z - dz / l * inset
			bot_i.append(mb.v(V3(xi, lo_y + spring(zi), zi))); top_i.append(mb.v(V3(xi, hi_y + spring(zi) * 0.5, zi)))
		for i in range(K):
			j = (i + 1) % K; mb.f([bot_i[i], bot_i[j], top_i[j], top_i[i]], None)
		mb.f(top_i, None); mb.f(bot_i[::-1], None)
		return mb.obj(name, [kind], sharp=0.7)
	sole_lo = lowbevel(slab('sole', 0.0, y0, y1), 0.003, 2)
	sole_hi = lowbevel(slab('sole.hi', 0.0025, y0 + 0.003, y1 - 0.0005), 0.003, 2)
	# (the lugs: blocks under it in a chevron pattern, and round its wall)
	mb = MB()
	for zz in [heel - 0.004 + k * 0.018 for k in range(16)]:
		for xx in (-0.03, -0.012, 0.006, 0.024):
			xs = xx + (0.006 if int((zz - heel) / 0.018) % 2 else 0)
			box(mb, V3(xs, y0 + 0.0015 + spring(zz), zz), V3(0.94, 0, 0.34 * (1 if xs > 0 else -1)).normalized(), Y, V3(0.94, 0, 0.34 * (1 if xs > 0 else -1)).normalized().cross(Y) * -1, 0.007, 0.0016, 0.0035)
	for i in range(K):
		x, z = pts2[i]; dx, dz = x - cx, z - cz; l = math.hypot(dx, dz) or 1; nx, nz = dx / l, dz / l
		c = V3(x - nx * 0.0012, y0 + 0.0055 + spring(z), z - nz * 0.0012)
		box(mb, c, V3(-nz, 0, nx), Y, V3(nx, 0, nz), 0.0024, 0.0035, 0.0012)
	lugs = mb.obj('lugs', ['rubber'], smooth=False, sharp=0)
	piece(sole_lo, [sole_hi, lugs], 'boot')
	bpy.data.objects.remove(FO)
	return FM

# ---------- glove ----------
# made on the reference operator's left hand (ref-hand.obj: game axes, metres, the wrist at the
# origin; the body's own faces, so the game lays the atlas on any hand's skin face by face). The
# game's glove is that skin stood off GLOVE_PROUD; baked onto it: a stretch back, a synthetic
# suede palm and fingertips, a ribbed cuff, a moulded knuckle guard and pads over the fingers'
# middle joints, a hook-and-loop strap round the wrist with its tab, and the seams stitched.
# The right glove is the left mirrored: the same texels, face for face (meta 'rmap').
GLOVE_PROUD = 0.0035
def load_hand():
	V, F, meta = [], [], None
	for line in open(os.path.join(HERE, 'ref-hand.obj')):
		if line.startswith('# meta '): meta = json.loads(line[7:])
		elif line.startswith('v '): V.append(V3(*map(float, line.split()[1:4])))
		elif line.startswith('f '): F.append([int(s) - 1 for s in line.split()[1:4]])
	return V, F, meta
def shell_normals(V, F):
	# as the game makes them (garment.js gloveShell): the faces' areas summed at each point,
	# turned to point away from the middle
	N = [V3(0, 0, 0) for _ in V]; ctr = V3(0, 0, 0)
	for v in V: ctr += v
	ctr /= len(V)
	for a, b, c in F:
		e = (V[b] - V[a]).cross(V[c] - V[a])
		for v in (a, b, c): N[v] += e
	s = 1.0 if sum(n.dot(V[i] - ctr) for i, n in enumerate(N)) >= 0 else -1.0
	return [n.normalized() * s for n in N], s
def iso_cut(P, N, fields, F, key, level):
	# every triangle that fields[key] crosses `level` in split along that line (straight across
	# it, the points on its edges where the field meets level), so a zone's edge runs clean;
	# returns the new triangles and the cut's pieces as pairs of points
	f = fields[key]; at = {}; out, segs = [], []
	def mid(a, b):
		k = (min(a, b), max(a, b))
		if k not in at:
			t = (level - f[a]) / (f[b] - f[a])
			P.append(P[a].lerp(P[b], t)); N.append(N[a].lerp(N[b], t).normalized())
			for g in fields.values(): g.append(g[a] + (g[b] - g[a]) * t)
			at[k] = len(P) - 1
		return at[k]
	for tri in F:
		up = [f[v] >= level for v in tri]
		if all(up) or not any(up): out.append(tri); continue
		# (turned so the one on its own side comes first, the winding kept)
		k = [i for i in range(3) if up.count(up[i]) == 1][0]
		a, b, c = tri[k], tri[(k + 1) % 3], tri[(k + 2) % 3]
		ab, ac = mid(a, b), mid(a, c)
		out += [[a, ab, ac], [ab, b, c], [ab, c, ac]]; segs.append((ab, ac))
	return out, segs
def chains(segs):
	# the cut's pieces joined end to end into lines
	nb = {}
	for a, b in segs: nb.setdefault(a, []).append(b); nb.setdefault(b, []).append(a)
	seen, lines = set(), []
	for s in [v for v in nb if len(nb[v]) == 1] + list(nb):
		if s in seen: continue
		line = [s]; seen.add(s)
		while True:
			nx = [v for v in nb[line[-1]] if v not in seen]
			if not nx: break
			line.append(nx[0]); seen.add(nx[0])
		if len(line) > 2: lines.append(line)
	return lines
def stitch_line(mb, pts, ns, step=0.0032, lift=0.0003):
	# a row of stitches along points on a surface, each lying along the line
	acc = 0.0
	for (a, na), (b, nb_) in zip(zip(pts, ns), list(zip(pts, ns))[1:]):
		d = b - a; L0 = d.length
		if L0 < 1e-7: continue
		t = d / L0; s0 = acc
		while s0 < L0:
			p = a + t * s0; n = na.lerp(nb_, s0 / L0).normalized(); s2 = n.cross(t).normalized(); tt = s2.cross(n)
			box(mb, p + n * lift, tt, s2, n, 0.0011, 0.00045, 0.00035); s0 += step
		acc = s0 - L0
class NS:
	def __init__(s, **k): s.__dict__.update(k)
HAND_META = None
def hand_shell(name, proud, kind, cage):
	# the game's glove made as the game makes it: the reference hand's skin stood off proud,
	# smooth, one material; with what a glove's detail is laid out by: the hand's bones, a ray
	# onto the shell (hit, cast) and each point's nearest finger bone
	global HAND_META
	V, F, HM = load_hand(); F0 = [list(f) for f in F]; HAND_META = dict(HM, F=F0)
	B = {k: V3(*v) for k, v in HM['bones'].items()}
	N, sgn = shell_normals(V, F)
	if sgn < 0: F = [[a, c, b] for a, b, c in F]
	P = [v + n * proud for v, n in zip(V, N)]
	me = bpy.data.meshes.new(name); me.from_pydata([G(p) for p in P], [], F)
	me.materials.append(M(kind))
	for p in me.polygons: p.use_smooth = True
	me.validate(); me.update()
	low = bpy.data.objects.new(name, me); SC.collection.objects.link(low)
	low['uvs'] = False; low['cage'] = cage; low['table'] = name; low['proud'] = proud
	bvh = BVHTree.FromPolygons([G(p) for p in P], F)
	def hit(o, d):
		# the glove's surface from o (game) along d, else the nearest point to o
		h = bvh.ray_cast(G(o), G(d).normalized(), 0.1)
		if h[0] is None: h = bvh.find_nearest(G(o))
		if h[0] is None: return None, None
		return GAME(h[0]), GAME(h[1]).normalized()
	def cast(o, d):
		# from inside the hand out along d: where it meets the shell, its normal facing d
		h = bvh.ray_cast(G(o), G(d).normalized(), 0.06)
		if h[0] is None: return None, None
		n = GAME(h[1]).normalized()
		return GAME(h[0]), (n if n.dot(d) > 0 else -n)
	# (the hand's frame: its back faces out from the body; each finger's back is the hand's
	# turned square to that finger; the thumb's nail faces round toward the index)
	F_ = lambda k, j: B['finger%d-%d.L' % (k, j)]
	K = (F_(2, 1) + F_(5, 1)) / 2; d = (K - B['wrist.L']).normalized(); a = (F_(5, 1) - F_(2, 1)).normalized()
	nb = d.cross(a).normalized()
	if nb.x < 0: nb = -nb
	fore = (B['wrist.L'] - B['lowerarm01.L']).normalized()
	segs = [(B['wrist.L'], K, nb, 0)]
	for k in range(1, 6):
		p1, p2, p3 = F_(k, 1), F_(k, 2), F_(k, 3); tip = p3 + (p3 - p2) * 0.85
		back = (nb * 0.4 - a).normalized() if k == 1 else nb
		for j, (s0, s1) in enumerate(((p1, p2), (p2, p3), (p3, tip))): segs.append((s0, s1, back, k * 10 + j + 1))
	def nearest(p):
		best = None
		for s0, s1, bk, tag in segs:
			u = s1 - s0; t = clamp((p - s0).dot(u) / u.length_squared); q = s0 + u * t; dd = (p - q).length
			if best is None or dd < best[0]: best = (dd, s0, s1, bk, tag, t)
		return best
	return NS(V=V, F=F, F0=F0, HM=HM, B=B, N=N, P=P, low=low, hit=hit, cast=cast, F_=F_, K=K, d=d, a=a, nb=nb, fore=fore, segs=segs, nearest=nearest)
def glove():
	log('glove')
	h = hand_shell('glove', GLOVE_PROUD, 'cordura', 0.005)
	V, F, F0, HM, B, N, P, low, hit = h.V, h.F, h.F0, h.HM, h.B, h.N, h.P, h.low, h.hit
	F_, K, d, a, nb, fore, nearest = h.F_, h.K, h.d, h.a, h.nb, h.fore, h.nearest
	fields = {'back': [], 'tip': [], 'up': []}
	for p, n in zip(P, N):
		_, s0, s1, bk, tag, t = nearest(p); u = (s1 - s0).normalized()
		fields['back'].append(n.dot((bk - u * bk.dot(u)).normalized()))
		fields['tip'].append((p - s0).dot(u) - 0.007 if tag % 10 == 3 else -1.0)
		fields['up'].append((B['wrist.L'] - p).dot(fore))
	P2, N2, F2 = list(P), list(N), [list(f) for f in F]
	F2, seam = iso_cut(P2, N2, fields, F2, 'back', 0.12)
	F2, tipc = iso_cut(P2, N2, fields, F2, 'tip', 0.0)
	F2, cuffc = iso_cut(P2, N2, fields, F2, 'up', -0.006)
	# the detailed glove: the same surface in its zones
	ZM = ['cordura', 'suede', 'elastic']
	def zone(tri):
		g = lambda k: sum(fields[k][v] for v in tri) / 3
		if g('up') > -0.006: return 2
		if g('tip') > 0 or g('back') < 0.12: return 1
		return 0
	mh = bpy.data.meshes.new('glove-hi'); mh.from_pydata([G(p) for p in P2], [], F2)
	for k in ZM: mh.materials.append(M(k))
	for p, tri in zip(mh.polygons, F2): p.material_index = zone(tri); p.use_smooth = True
	mh.validate(); mh.update()
	base = bpy.data.objects.new('glove-hi', mh); SC.collection.objects.link(base)
	highs = [base]
	# (the seams: along the back's edge where it is not under the cuff, round the tips, and
	# where the cuff starts)
	mb = MB()
	for line in chains(seam) + chains(tipc) + chains(cuffc):
		# (only where they are not under the cuff)
		run = []
		for v in line + [None]:
			if v is not None and fields['up'][v] <= -0.0055: run.append(v); continue
			if len(run) > 1: stitch_line(mb, [P2[q] for q in run], [N2[q] for q in run])
			run = []
	highs.append(mb.obj('glove-stitch', ['thread'], smooth=False, sharp=0))
	# a moulded pad on the glove: rings out from its middle o, across u and along v, a
	# superellipse hu by hv, the top standing T off with a rounded shoulder to its edge;
	# bump(x, y) adds to that (the knuckles), groove(x, y) takes away (where it flexes)
	def pad(name, o, u, v, n, hu, hv, T, bump=None, groove=None, kind='rubber', rings=10, sectors=48, smooth=0):
		# (the surface under it found first, then smoothed so the pad bridges the hand's own
		# bumps; its rim stays on the surface)
		base, xy = [], []
		for r in range(1, rings + 1):
			rho = r / rings; row, rxy = [], []
			for s_ in range(sectors):
				th = TAU * s_ / sectors; c, sn = math.cos(th), math.sin(th)
				x = hu * rho * math.copysign(abs(c) ** 0.5, c); y = hv * rho * math.copysign(abs(sn) ** 0.5, sn)
				p, nn = hit(o + u * x + v * y + n * 0.03, -n)
				if p is None: p, nn = o + u * x + v * y, n
				row.append((p, nn)); rxy.append((x, y))
			base.append(row); xy.append(rxy)
		p, nn = hit(o + n * 0.03, -n); mid_ = (p if p is not None else o, nn if nn is not None else n)
		orig = [list(r_) for r_ in base]
		for _ in range(smooth):
			nxt = [list(r_) for r_ in base]
			for r in range(rings - 1):
				for s_ in range(sectors):
					inner = base[r - 1][s_] if r else mid_
					q = [base[r][(s_ - 1) % sectors], base[r][(s_ + 1) % sectors], base[r + 1][s_], inner]
					nxt[r][s_] = (sum((a_[0] for a_ in q), V3(0, 0, 0)) / 4, sum((a_[1] for a_ in q), V3(0, 0, 0)).normalized())
			mid_ = (sum((b_[0] for b_ in nxt[0]), V3(0, 0, 0)) / sectors, sum((b_[1] for b_ in nxt[0]), V3(0, 0, 0)).normalized())
			base = nxt
		# (never under the surface it was smoothed from)
		for r in range(rings):
			for s_ in range(sectors):
				(p, nn), (q, _) = base[r][s_], orig[r][s_]
				base[r][s_] = (p + nn * max(0.0, (q - p).dot(nn)), nn)
		mb = MB(); rows = []
		for r in range(rings):
			rho = (r + 1) / rings; row = []
			for s_ in range(sectors):
				(p, nn), (x, y) = base[r][s_], xy[r][s_]
				h = T if rho <= 0.8 else T * math.sqrt(max(0.0, 1 - ((rho - 0.8) / 0.2) ** 2))
				if bump: h += bump(x, y) * min(1.0, (1 - rho) / 0.2)
				if groove: h *= 1 - groove(x, y)
				row.append(mb.v(p + nn * (0.0003 + h)))
			rows.append(row)
		c0 = mb.v(mid_[0] + mid_[1] * (0.0003 + T + (bump(0, 0) if bump else 0)))
		for s_ in range(sectors): mb.f([c0, rows[0][s_], rows[0][(s_ + 1) % sectors]])
		for r in range(rings - 1):
			for s_ in range(sectors):
				s1 = (s_ + 1) % sectors; mb.f([rows[r][s_], rows[r + 1][s_], rows[r + 1][s1], rows[r][s1]])
		ob = mb.obj(name, [kind], sharp=0)
		# (its winding to face out the way n does)
		ob.data.update()
		if sum(p.normal.dot(G(n)) for p in ob.data.polygons) < 0: ob.data.flip_normals()
		return ob
	# the knuckle guard: over the four knuckles, a rise on each, flexing between them
	kv = (d - nb * d.dot(nb)).normalized(); ku = kv.cross(nb).normalized()
	o, _ = hit(K + nb * 0.04 - kv * 0.0115, -nb)
	ks = [((F_(k, 1) - o).dot(ku), (F_(k, 1) - o).dot(kv)) for k in (2, 3, 4, 5)]
	span = max(abs(x) for x, _ in ks)
	knob = lambda x, y: sum(0.0016 * math.exp(-((x - kx) / 0.0065) ** 2 - ((y - ky) / 0.008) ** 2) for kx, ky in ks)
	flex = lambda x, y: sum(0.45 * math.exp(-((x - (ks[i][0] + ks[i + 1][0]) / 2) / 0.0012) ** 2) for i in range(3)) * (1 if y > -0.004 else 0.3)
	highs.append(pad('knuckle', o, ku, kv, nb, span + 0.011, 0.0155, 0.0026, knob, flex, kind='tpr', rings=14, sectors=72, smooth=10))
	# pads over each finger's middle joint and the thumb's
	for k in range(1, 6):
		p2 = F_(k, 3) if k == 1 else F_(k, 2); df = ((F_(k, 3) - F_(k, 2)) if k == 1 else (F_(k, 3) - p2)).normalized()
		bk = (nb * 0.4 - a).normalized() if k == 1 else nb; bf = (bk - df * bk.dot(df)).normalized()
		o2, _ = hit(p2 + bf * 0.03, -bf)
		if o2 is None: continue
		highs.append(pad('knuckle-%d' % k, o2, df.cross(bf).normalized(), df, bf, 0.0062, 0.0085, 0.002, kind='tpr', rings=6, sectors=32, smooth=3))
	# the strap round the wrist, its tab over the back of the wrist
	def facing_out(ob):
		# (wound to face away from the forearm's axis)
		ob.data.update(); w = B['wrist.L']
		out = sum(p.normal.dot(G((GAME(p.center) - w) - fore * fore.dot(GAME(p.center) - w))) for p in ob.data.polygons)
		if out < 0: ob.data.flip_normals()
		return ob
	e1 = (nb - fore * nb.dot(fore)).normalized(); e2 = fore.cross(e1)
	W0, W1, ns_ = -0.004, 0.022, 64
	acr = [W0, W0 + 0.0008, W0 + 0.002] + [W0 + (W1 - W0) * i / 8 for i in range(2, 7)] + [W1 - 0.002, W1 - 0.0008, W1]
	hgt = [0.0002, 0.0012, 0.0019] + [0.002] * 5 + [0.0019, 0.0012, 0.0002]
	mb = MB(); grid = []
	for s in range(ns_):
		th = TAU * s / ns_; rad = e1 * math.cos(th) + e2 * math.sin(th); col = []
		for w, h in zip(acr, hgt):
			c = B['wrist.L'] - fore * w
			p, nn = hit(c + rad * 0.06, -rad)
			col.append(mb.v(p + nn * (0.0003 + h)))
		grid.append(col)
	for s in range(ns_):
		s1 = (s + 1) % ns_
		for j in range(len(acr) - 1): mb.f([grid[s][j], grid[s1][j], grid[s1][j + 1], grid[s][j + 1]])
	highs.append(facing_out(mb.obj('strap', ['webbing'], sharp=0)))
	# (the tab: hook-and-loop lying on the strap from the back of the wrist round toward the
	# thumb, its end rounded, a rubber pull moulded on it)
	mb = MB(); tw = (W1 - W0) * 0.42; mid_w = (W0 + W1) / 2; rows = []
	for i in range(25):
		ang = -0.25 + 1.1 * i / 24; row = []
		end = 1.0 if i < 20 else math.sqrt(max(0.0, 1 - ((i - 20) / 4.4) ** 2))
		for j in range(7):
			w = mid_w + tw * end * (j / 3 - 1)
			rad = e1 * math.cos(ang) + e2 * math.sin(ang); c = B['wrist.L'] - fore * w
			p, nn = hit(c + rad * 0.06, -rad)
			h = 0.0034 if 0 < j < 6 else 0.0024
			row.append(mb.v(p + nn * (0.0003 + h)))
		rows.append(row)
	for i in range(24):
		for j in range(6): mb.f([rows[i][j], rows[i + 1][j], rows[i + 1][j + 1], rows[i][j + 1]])
	highs.append(facing_out(mb.obj('tab', ['webbing'], sharp=0)))
	ang = 0.62; rad = e1 * math.cos(ang) + e2 * math.sin(ang)
	po, _ = hit(B['wrist.L'] - fore * mid_w + rad * 0.06, -rad)
	if po is not None:
		tu = (e2 * math.cos(ang) - e1 * math.sin(ang)).normalized()
		highs.append(pad('pull', po, tu, -fore, rad, 0.007, 0.0065, 0.0042, kind='tpr', rings=5, sectors=28))
	# stitches round the strap's edges and the tab's
	mb = MB()
	for w in (W0 + 0.0024, W1 - 0.0024):
		pts, nrm = [], []
		for s in range(ns_ + 1):
			th = TAU * s / ns_; rad = e1 * math.cos(th) + e2 * math.sin(th)
			p, nn = hit(B['wrist.L'] - fore * w + rad * 0.06, -rad)
			pts.append(p + nn * 0.0022); nrm.append(nn)
		stitch_line(mb, pts, nrm)
	highs.append(mb.obj('strap-stitch', ['thread'], smooth=False, sharp=0))
	piece(low, highs, 'glove')

# ---------- gauntlet ----------
# the knight's steel gauntlet, made like the combat glove on the reference hand's skin (a table
# of its own: the same body faces, its own texels): a glove of leather; over the back of the
# hand a fluted plate with its wrist end rolled, a knuckle plate with a boss over each knuckle,
# scales down the back of every finger overlapping toward the tip, pointed caps on the tips,
# rivets. Where the plates are the game's shell stands further off (the table's lift at each
# corner), so the gauntlet has their bulk and not only their look.
GAUNT_PROUD = 0.003
def gauntlet():
	log('gauntlet')
	h = hand_shell('gauntlet', GAUNT_PROUD, 'tlea', 0.005)
	P, N, F, low, hit, cast, B = h.P, h.N, h.F, h.low, h.hit, h.cast, h.B
	F_, K, d, a, nb, fore = h.F_, h.K, h.d, h.a, h.nb, h.fore
	W = B['wrist.L']
	# the leather glove: the shell itself, stitched down each side where the back meets the palm
	back = []
	for p, n in zip(P, N):
		_, s0, s1, bk, tag, t = h.nearest(p); u = (s1 - s0).normalized()
		back.append(n.dot((bk - u * bk.dot(u)).normalized()))
	fields = {'back': back}
	P2, N2 = list(P), list(N)
	F2, seam = iso_cut(P2, N2, fields, [list(f) for f in F], 'back', 0.0)
	mh = bpy.data.meshes.new('gauntlet-hi'); mh.from_pydata([G(p) for p in P2], [], F2); mh.materials.append(M('tlea'))
	for p in mh.polygons: p.use_smooth = True
	mh.validate(); mh.update()
	base = bpy.data.objects.new('gauntlet-hi', mh); SC.collection.objects.link(base)
	highs, plates = [base], []
	mb = MB()
	for line in chains(seam):
		# (past the cuff, which covers the wrist)
		run = []
		for v in line + [None]:
			if v is not None and (W - P2[v]).dot(fore) <= -0.01: run.append(v); continue
			if len(run) > 1: stitch_line(mb, [P2[q] for q in run], [N2[q] for q in run])
			run = []
	highs.append(mb.obj('gauntlet-stitch', ['thread'], smooth=False, sharp=0))
	def rim(rho, T, w):
		# a plate's edge: flat to 1 - w, then rounded down to the glove
		return T if rho <= 1 - w else T * math.sqrt(max(0.0, 1 - ((rho - (1 - w)) / w) ** 2))
	def plate(name, o, u, v, n, hu, hv, prof, cells=64, smooth=6, sq=6.0):
		# a plate on the glove: a grid across u and along v, bent from a square onto a rounded
		# rectangle (sq: how square) hu(y) by hv, standing prof(x, y, rho) off the glove (rho: 0
		# in its middle, 1 at its edge, its rows closer toward the edge); smoothed into a sheet
		# over the hand's own bumps but never sunk under them
		g = [0.35 * (2 * i / cells - 1) + 0.65 * math.sin(math.pi / 2 * (2 * i / cells - 1)) for i in range(cells + 1)]
		base, xy = [], []
		for t_ in g:
			row, rxy = [], []
			for s_ in g:
				m = max(abs(s_), abs(t_)); r = (abs(s_) ** sq + abs(t_) ** sq) ** (1 / sq)
				k = m / r if r > 1e-9 else 0.0
				y = hv * t_ * k; x = (hu(y) if callable(hu) else hu) * s_ * k
				p, nn = hit(o + u * x + v * y + n * 0.03, -n)
				if p is None: p, nn = o + u * x + v * y, n
				row.append((p, nn)); rxy.append((x, y, m))
			base.append(row); xy.append(rxy)
		orig = [list(r_) for r_ in base]; C = cells
		for _ in range(smooth):
			nxt = [list(r_) for r_ in base]
			for i in range(1, C):
				for j in range(1, C):
					q = (base[i - 1][j], base[i + 1][j], base[i][j - 1], base[i][j + 1])
					nxt[i][j] = (sum((a_[0] for a_ in q), V3(0, 0, 0)) / 4, sum((a_[1] for a_ in q), V3(0, 0, 0)).normalized())
			base = nxt
			for i in range(C + 1):
				for j in range(C + 1):
					(p, nn), (q, _) = base[i][j], orig[i][j]
					base[i][j] = (p + nn * max(0.0, (q - p).dot(nn)), nn)
		mb = MB(); rows = []
		for i in range(C + 1):
			rows.append([mb.v(base[i][j][0] + base[i][j][1] * (0.0003 + prof(*xy[i][j]))) for j in range(C + 1)])
		for i in range(C):
			for j in range(C): mb.f([rows[i][j], rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]])
		ob = mb.obj(name, ['plate'], sharp=0)
		ob.data.update()
		if sum(p.normal.dot(G(n)) for p in ob.data.polygons) < 0: ob.data.flip_normals()
		plates.append(ob); return ob
	def lame(name, s0, s1, bk, t0, t1, ang, T, cap=False, rows=16, cols=24, ridge=0.00035, rivets=False, outside=False):
		# a scale over the back of a finger from t0 to t1 along the bone s0 to s1, ang either
		# side of its back: the glove found by rays out from the bone; rounded at its edges,
		# rising toward its far end (where it laps over the next), a ridge down its middle; a
		# cap narrows to a rounded point
		u = s1 - s0; u = u / u.length
		bk = (bk - u * bk.dot(u)).normalized(); sd = u.cross(bk)
		mb = MB(); grid = []
		def at(t, phi, r0=None):
			# (a ray that misses, or runs on to another finger or the palm, is put back at the
			# finger's own reach r0)
			r = bk * math.cos(phi) + sd * math.sin(phi); c = s0 + u * t
			# (outside: found from outside, in toward the bone, for a bone that does not run down
			# the middle of its finger, the thumb's)
			p, nn = hit(c + r * 0.03, -r) if outside else cast(c, r)
			if outside: return p, nn, (p - c).length
			if r0 and (p is None or (p - c).length > r0 * 1.35): p, nn = c + r * r0, r
			if p is None: p, nn = c + r * 0.008, r
			return p, nn, (p - c).length
		r0 = at((t0 + t1) / 2, 0.0)[2]
		for i in range(rows + 1):
			f = (1 - math.cos(math.pi * i / rows)) / 2; t = t0 + (t1 - t0) * f
			ae = ang if not cap or f < 0.5 else ang * math.sqrt(max(0.0, 1 - ((f - 0.5) / 0.5) ** 2))
			row = []
			for j in range(cols + 1):
				phi = ae * math.sin(math.pi * (j / cols - 0.5))
				p, nn, rad = at(t, phi, r0)
				e = max(0.0, min(rad * (ae - abs(phi)), t - t0, 1.0 if cap else t1 - t))
				hh = (T + 0.0006 * f) * math.sqrt(min(1.0, e / 0.0009)) + ridge * math.exp(-(phi / 0.3) ** 2) * min(1.0, e / 0.0015)
				row.append(mb.v(p + nn * (0.0003 + hh)))
			grid.append(row)
		for i in range(rows):
			for j in range(cols): mb.f([grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]])
		ob = mb.obj(name, ['plate'], sharp=0)
		# (wound to face out from the bone)
		ob.data.update()
		out = 0.0
		for p in ob.data.polygons:
			pc = GAME(p.center); ax = s0 + u * (pc - s0).dot(u); out += p.normal.dot(G(pc - ax))
		if out < 0: ob.data.flip_normals()
		plates.append(ob)
		spots = []
		if rivets:
			for sg in (-1, 1):
				p, nn, _ = at((t0 + t1) / 2, sg * ang * 0.72, r0); spots.append((ob, p, nn))
		return spots
	# the plate over the back of the hand, from past the cuff to under the knuckle plate, wider
	# toward the knuckles, three flutes fanning down it, its wrist end rolled
	kv = (d - nb * d.dot(nb)).normalized(); ku = kv.cross(nb).normalized()
	ks = [(F_(k, 1) - K).dot(ku) for k in (2, 3, 4, 5)]
	span = max(abs(x) for x in ks)
	L0 = (K - W).dot(kv); y0, y1 = 0.012, L0 - 0.004; hvm = (y1 - y0) / 2
	om, _ = hit(W + kv * ((y0 + y1) / 2) + nb * 0.04, -nb)
	hum = lambda y: 0.027 + (span + 0.008 - 0.027) * clamp((y + hvm) / (2 * hvm))
	def back_prof(x, y, rho):
		# (each flute a sharp crest, dying out toward the wrist and before the edge)
		fl = sum(math.exp(-(abs(x / hum(y) - c) / 0.07) ** 1.3) for c in (-0.45, 0.0, 0.45)) * 0.0011 * ss((0.85 - rho) / 0.2) * ss((y / hvm + 0.9) / 0.6)
		roll = 0.0014 * math.exp(-((rho - 0.91) / 0.03) ** 2) * ss((-y / hvm - 0.3) / 0.4)
		return rim(rho, 0.0018, 0.07) + fl + roll
	spots = []
	bp = plate('back', om, ku, kv, nb, hum, hvm, back_prof, smooth=12)
	for sx_ in (-1, 1):
		for sy_ in (-1, 1):
			y = sy_ * hvm * 0.8; x = sx_ * hum(y) * 0.8
			p, nn = hit(om + ku * x + kv * y + nb * 0.03, -nb)
			if p is not None: spots.append((bp, p, nn))
	# the knuckle plate, a stiff sheet over the knuckles: a boss over each, higher at its near
	# edge than the back plate it laps over
	ok, _ = hit(K + nb * 0.04 - kv * 0.004, -nb)
	knob = lambda x, y: sum(0.0024 * math.exp(-((x - kx) / 0.0055) ** 2 - ((y - 0.004) / 0.0062) ** 2) for kx in ks)
	kp = plate('knuckles', ok, ku, kv, nb, span + 0.009, 0.011, lambda x, y, rho: rim(rho, 0.0026 - 0.0005 * y / 0.011, 0.12) + knob(x, y) * ss((1 - rho) / 0.25), smooth=60, sq=8.0)
	for sx_ in (-1, 1):
		p, nn = hit(ok + ku * sx_ * (span + 0.009) * 0.84 + nb * 0.03, -nb)
		if p is not None: spots.append((kp, p, nn))
	# the fingers' scales: two over the first bone, one over the second, a cap on the tip
	for k in range(2, 6):
		p1, p2, p3 = F_(k, 1), F_(k, 2), F_(k, 3); tip = p3 + (p3 - p2) * 0.85
		l1, l2, l3 = (p2 - p1).length, (p3 - p2).length, (tip - p3).length
		spots += lame('f%da' % k, p1, p2, nb, 0.006, l1 * 0.56, 1.2, 0.0016, rivets=True)
		lame('f%db' % k, p1, p2, nb, l1 * 0.5, l1 + 0.002, 1.2, 0.0016)
		lame('f%dc' % k, p2, p3, nb, -0.002, l2 + 0.002, 1.15, 0.0015)
		lame('f%dd' % k, p3, tip, nb, -0.002, l3 * 0.82, 1.1, 0.0015, cap=True)
	# the thumb's: two over its first bone, a cap
	tb = (nb * 0.4 - a).normalized()
	p2, p3 = F_(1, 2), F_(1, 3); tip = p3 + (p3 - p2) * 0.85; l2 = (p3 - p2).length
	spots += lame('t1', p2, p3, tb, l2 * 0.05, l2 * 0.56, 1.0, 0.0017, rivets=True, outside=True)
	lame('t2', p2, p3, tb, l2 * 0.5, l2 + 0.002, 1.0, 0.0016, outside=True)
	lame('t3', p3, tip, tb, -0.002, (tip - p3).length * 0.72, 0.95, 0.0015, cap=True, outside=True)
	# rivets: domes on the plates' tops
	rv = MB()
	for ob, p, n in spots:
		bv = BVHTree.FromPolygons([v.co.copy() for v in ob.data.vertices], [list(q.vertices) for q in ob.data.polygons])
		hh = bv.ray_cast(G(p + n * 0.03), G(-n), 0.05)
		if hh[0] is None: continue
		c = GAME(hh[0]); e1 = n.orthogonal().normalized(); e2 = n.cross(e1)
		ringv = []
		for k in range(4):
			ang = (k / 4) * math.pi / 2
			ringv.append([rv.v(c + n * (0.0009 * math.sin(ang) - 0.0002) + (e1 * math.cos(TAU * s_ / 12) + e2 * math.sin(TAU * s_ / 12)) * 0.0014 * math.cos(ang)) for s_ in range(12)])
		top_ = rv.v(c + n * 0.0007)
		for k in range(3):
			for s_ in range(12): rv.f([ringv[k][s_], ringv[k][(s_ + 1) % 12], ringv[k + 1][(s_ + 1) % 12], ringv[k + 1][s_]])
		for s_ in range(12): rv.f([ringv[3][s_], ringv[3][(s_ + 1) % 12], top_])
	rob = rv.obj('gauntlet-rivets', ['plate'], sharp=0)
	rob.data.update()
	if sum(p.normal.dot(G(GAME(p.center) - W)) for p in rob.data.polygons) < 0: rob.data.flip_normals()
	highs += plates + [rob]
	# the game's shell lifted where the plates are, a little under their tops, eased between
	pv, pf = [], []
	for ob in plates:
		o0 = len(pv); pv += [v.co.copy() for v in ob.data.vertices]; pf += [[o0 + i for i in q.vertices] for q in ob.data.polygons]
	pb = BVHTree.FromPolygons(pv, pf)
	lift = []
	for p, n in zip(P, N):
		# (only a plate over this point, facing the way it does: not a neighbouring finger's)
		hh = pb.ray_cast(G(p + n * 0.008), G(-n), 0.0085)
		ok = hh[0] is not None and hh[1].dot(G(n)) > 0.3
		lift.append(max(0.0, (0.008 - hh[3]) - 0.0005) * 0.85 if ok else 0.0)
	nbr = [set() for _ in P]
	for f in F:
		for v in f: nbr[v].update(x for x in f if x != v)
	for _ in range(2): lift = [(lift[v] + sum(lift[w] for w in nbr[v]) / max(1, len(nbr[v]))) / 2 for v in range(len(P))]
	lift = [min(0.006, x) for x in lift]
	for v, (p, n) in enumerate(zip(P, N)): low.data.vertices[v].co = G(p + n * lift[v])
	low.data.update()
	# (its normals the unlifted shell's, as the game keeps them)
	low.data.normals_split_custom_set_from_vertices([G(n).normalized() for n in N])
	low['lift'] = lift
	log('gauntlet lift max %.4f, %d of %d points lifted' % (max(lift), sum(1 for x in lift if x > 0.0003), len(lift)))
	piece(low, highs, 'gauntlet')

# ---------- UVs, bake, maps, export ----------
def area3(o):
	return sum(p.area for p in o.data.polygons)
def uv_area(o):
	uv = o.data.uv_layers.active.data; a = 0.0
	for p in o.data.polygons:
		li = list(p.loop_indices)
		for k in range(1, len(li) - 1):
			(x0, y0), (x1, y1), (x2, y2) = uv[li[0]].uv, uv[li[k]].uv, uv[li[k + 1]].uv
			a += abs((x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0)) / 2
	return a
def uv_and_pack(lows):
	need = [o for o in lows if not o['uvs']]
	bpy.ops.object.select_all(action='DESELECT')
	for o in need: o.select_set(True)
	bpy.context.view_layer.objects.active = need[0]
	bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
	bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.002, area_weight=0.0, scale_to_bounds=False)
	bpy.ops.object.mode_set(mode='OBJECT')
	# (the projected ones brought to metres like the rest)
	for o in need:
		k = math.sqrt(area3(o) / max(1e-12, uv_area(o)))
		for d in o.data.uv_layers.active.data: d.uv = d.uv * k
	# (one UV layer of one name on every piece, so the pieces of a group join into one map)
	for o in lows:
		assert len(o.data.uv_layers) == 1, o.name
		o.data.uv_layers[0].name = 'UV'
	bpy.ops.object.select_all(action='DESELECT')
	for o in lows: o.select_set(True)
	bpy.context.view_layer.objects.active = lows[0]
	bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.uv.select_all(action='SELECT')
	bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, scale=True, margin_method='FRACTION', margin=0.005, shape_method='CONCAVE')
	bpy.ops.object.mode_set(mode='OBJECT')
	tot3 = sum(area3(o) for o in lows); totuv = sum(uv_area(o) for o in lows)
	log('atlas: %.0f px per cm at %d' % (math.sqrt(totuv / tot3) * SIZE / 100, SIZE))

def bake_all():
	SC.render.engine = 'CYCLES'; SC.cycles.device = 'CPU'; SC.cycles.samples = 1
	SC.render.bake.margin = 12; SC.render.bake.margin_type = 'EXTEND'
	lows = [l for l, _ in PIECES]; highs = [h for _, hs in PIECES for h in hs]
	imgs = {}
	for k in ('normal', 'col', 'rough', 'metal', 'tint', 'ao'):
		im = bpy.data.images.new('bake-' + k, SIZE, SIZE, alpha=False, float_buffer=True)
		im.colorspace_settings.name = 'Non-Color'; im.generated_color = (0, 0, 0, 1); imgs[k] = im
	# each low piece bakes into the image through a texture node of its own
	targets = []
	for o in lows:
		o['mats'] = [m.name for m in o.data.materials]
		m = bpy.data.materials.new('target-' + o.name)
		tn = m.node_tree.nodes.new('ShaderNodeTexImage'); m.node_tree.nodes.active = tn; targets.append(tn)
		mi = [p.material_index for p in o.data.polygons]; o['mi'] = mi
		o.data.materials.clear(); o.data.materials.append(m)
		for p in o.data.polygons: p.material_index = 0
	def set_img(k):
		for tn in targets: tn.image = imgs[k]
	for k in ('normal', 'col', 'rough', 'metal', 'tint'):
		# (a few samples a texel: the finest weave and grit averaged, not aliased)
		show(k); set_img(k); log('bake', k); SC.cycles.samples = 2
		for low, hs in PIECES:
			bpy.ops.object.select_all(action='DESELECT')
			for h in hs: h.select_set(True)
			low.select_set(True); bpy.context.view_layer.objects.active = low
			# (no margin: a piece's margin would run over the pieces baked before it; the
			# islands are grown out once, after, in save)
			bpy.ops.object.bake(type='NORMAL' if k == 'normal' else 'EMIT', use_selected_to_active=True, cage_extrusion=low.get('cage', 0.0025), max_ray_distance=0.012, normal_space='TANGENT', use_clear=False, margin=0)
	# (the occlusion from the game meshes themselves and the head under them)
	log('bake ao'); SC.cycles.samples = AO_SAMPLES; set_img('ao')
	for h in highs: h.hide_render = True
	HEAD.hide_render = False
	for b in BACKS: b.hide_render = False
	bpy.ops.object.select_all(action='DESELECT')
	for o in lows: o.select_set(True)
	bpy.context.view_layer.objects.active = lows[0]
	SC.world = SC.world or bpy.data.worlds.new('w'); SC.world.light_settings.distance = 0.025
	bpy.ops.object.bake(type='AO', use_selected_to_active=False, use_clear=False, margin=12)
	return imgs

def save(imgs):
	px = {k: np.array(im.pixels[:], dtype=np.float32).reshape(SIZE, SIZE, 4) for k, im in imgs.items()}
	# (every island grown out over the empty texels round it, each from its own edge, so the
	# smaller mips do not draw in the background or the next island; the normals' blue says
	# where anything was baked)
	have = px['normal'][..., 2] > 0.25
	for _ in range(24):
		edge = ~have & (np.roll(have, 1, 0) | np.roll(have, -1, 0) | np.roll(have, 1, 1) | np.roll(have, -1, 1))
		if not edge.any(): break
		for k, a in px.items():
			acc = np.zeros_like(a); cnt = np.zeros(have.shape, np.float32)
			for ax, sh in ((0, 1), (0, -1), (1, 1), (1, -1)):
				h = np.roll(have, sh, ax); acc += np.roll(a, sh, ax) * h[..., None]; cnt += h
			a[edge] = acc[edge] / np.maximum(cnt[edge], 1)[:, None]
		have |= edge
	px['normal'][~have] = (0.5, 0.5, 1.0, 1.0)
	def srgb(x): x = np.clip(x, 0, 1); return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)
	one = np.ones((SIZE, SIZE, 1), np.float32)
	alb = np.dstack([srgb(px['col'][..., :3]), one])
	# (blue: the metal and the tint in one, as they never meet: 0.5 neither, down to 0 all
	# metal, up to 1 all the wearer's colour)
	t, mt = px['tint'][..., :1], px['metal'][..., :1]
	blue = np.where(t > 0.02, 0.5 + 0.5 * t, 0.5 - 0.5 * mt)
	orm = np.dstack([px['ao'][..., :1], px['rough'][..., :1], blue, one])
	nor = px['normal'].copy(); nor[..., 3] = 1
	saved = {}
	for name, a in (('albedo', alb), ('orm', orm), ('normal', nor)):
		im = bpy.data.images.new('out-' + name, SIZE, SIZE, alpha=False, float_buffer=False)
		im.colorspace_settings.name = 'Non-Color'
		im.pixels.foreach_set(np.clip(a, 0, 1).astype(np.float32).ravel())
		im.filepath_raw = os.path.join(OUT, 'kit-' + name + '.png'); im.file_format = 'PNG'; im.save()
		saved[name] = im
	log('saved maps')
	return saved

def preview(saved):
	# the game meshes in their baked maps on the reference head, rendered from a few sides
	m = bpy.data.materials.new('preview'); nt = m.node_tree; N = nt.nodes; L = nt.links
	bs = N['Principled BSDF']; uv = N.new('ShaderNodeUVMap')
	ta, tn, to = (N.new('ShaderNodeTexImage') for _ in range(3))
	ta.image, tn.image, to.image = saved['albedo'], saved['normal'], saved['orm']
	saved['albedo'].colorspace_settings.name = 'sRGB'
	for t in (ta, tn, to): L.new(uv.outputs[0], t.inputs[0])
	sep = N.new('ShaderNodeSeparateColor'); L.new(to.outputs[0], sep.inputs[0])
	tint = N.new('ShaderNodeMath'); tint.operation = 'MULTIPLY_ADD'; tint.use_clamp = True; L.new(sep.outputs[2], tint.inputs[0]); tint.inputs[1].default_value = 2; tint.inputs[2].default_value = -1
	metal = N.new('ShaderNodeMath'); metal.operation = 'MULTIPLY_ADD'; metal.use_clamp = True; L.new(sep.outputs[2], metal.inputs[0]); metal.inputs[1].default_value = -2; metal.inputs[2].default_value = 1
	col = N.new('ShaderNodeMix'); col.data_type = 'RGBA'; L.new(tint.outputs[0], col.inputs[0]); L.new(ta.outputs[0], col.inputs[6])
	mul = N.new('ShaderNodeMix'); mul.data_type = 'RGBA'; mul.blend_type = 'MULTIPLY'; mul.inputs[0].default_value = 1; L.new(ta.outputs[0], mul.inputs[6]); mul.inputs[7].default_value = (0.5, 0.47, 0.34, 1)
	L.new(mul.outputs[2], col.inputs[7])
	L.new(col.outputs[2], bs.inputs['Base Color']); L.new(sep.outputs[1], bs.inputs['Roughness']); L.new(metal.outputs[0], bs.inputs['Metallic'])
	nm = N.new('ShaderNodeNormalMap'); L.new(tn.outputs[0], nm.inputs['Color']); L.new(nm.outputs[0], bs.inputs['Normal'])
	for low, hs in PIECES:
		low.data.materials.clear(); low.data.materials.append(m)
		for h in hs: h.hide_render = True
	HEAD.data.materials.clear(); HEAD.data.materials.append(M('skin')); show('normal'); HEAD.hide_render = False
	for b in BACKS: b.hide_render = True
	SC.cycles.samples = 48; SC.render.resolution_x = SC.render.resolution_y = 900
	w = SC.world; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.45, 0.5, 0.56, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.6
	sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 3.5; sun.rotation_euler = (0.7, 0.2, 0.9); SC.collection.objects.link(sun)
	cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.lens = 85; SC.collection.objects.link(cam); SC.camera = cam
	for name, (az, el, dist) in {'front': (0.5, 0.25, 0.75), 'side': (1.57, 0.12, 0.75), 'back': (2.6, 0.35, 0.75), 'top': (0.3, 0.9, 0.75)}.items():
		d = dirOf(az, el); p = V3(0, 0.03, 0) + d * dist
		cam.location = G(p); look = G(V3(0, 0.03, 0)) - cam.location
		cam.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()
		SC.render.filepath = os.path.join(OUT, 'preview-' + name + '.png'); bpy.ops.render.render(write_still=True)
	# (the carrier's kit as laid out for the bake, from the front and from above to one side)
	shots = {'gear': (V3(0.98, -0.36, 3.0), V3(0.98, -0.36, 0)), 'gear-side': (V3(0.35, 0.5, 1.2), V3(0.82, -0.12, 0))}
	for g, off in GEAR:
		if g == 'boot':
			c = off + V3(0, -0.02, 0.06)
			shots.update({'boot': (off + V3(0.3, 0.12, 0.42), c), 'boot-side': (off + V3(0.55, 0.02, 0.06), c), 'boot-back': (off + V3(-0.25, 0.15, -0.35), c)})
		if g in ('glove', 'gauntlet'):
			c = off + V3(0.03, -0.045, 0.06)
			shots.update({g: (off + V3(0.42, 0.05, 0.12), c), g + '-palm': (off + V3(-0.38, -0.02, 0.2), c), g + '-wrist': (off + V3(0.3, 0.25, -0.12), off + V3(0.01, -0.01, 0.02))})
	for name, (p, look) in shots.items():
		HEAD.hide_render = name.startswith(('boot', 'glove', 'gauntlet'))
		cam.location = G(p); cam.rotation_euler = (G(look) - cam.location).to_track_quat('-Z', 'Y').to_euler()
		SC.render.filepath = os.path.join(OUT, 'preview-' + name + '.png'); bpy.ops.render.render(write_still=True)
	log('previews')

def glove_table(o):
	# the atlas at each corner of each of the body's faces under the glove, in the game's corner
	# order (glTF's v), the right hand's from the left's mirror; and how much further each
	# corner stands off (lift, in twentieths of a millimetre), if it does
	import base64
	uvl = o.data.uv_layers[0].data; L = []
	for p, tri in zip(o.data.polygons, HAND_META['F']):
		at = {o.data.loops[li].vertex_index: uvl[li].uv for li in p.loop_indices}
		L.append([(at[v][0], 1 - at[v][1]) for v in tri])
	mirror = lambda T: [[T[k][ca], T[k][cb], T[k][cc]] for k, ca, cb, cc in HAND_META['rmap']]
	q = lambda T: base64.b64encode(np.clip(np.round(np.array(T, np.float64).reshape(-1) * 65535), 0, 65535).astype('<u2').tobytes()).decode()
	ids = lambda f: base64.b64encode(np.array(f, '<u4').tobytes()).decode()
	out = {'L': {'faces': ids(HAND_META['faces']), 'uv': q(L)}, 'R': {'faces': ids(HAND_META['right']), 'uv': q(mirror(L))}, 'proud': o['proud']}
	if 'lift' in o:
		lf = list(o['lift']); LL = [[lf[v] for v in tri] for tri in HAND_META['F']]
		b8 = lambda T: base64.b64encode(np.clip(np.round(np.array(T, np.float64).reshape(-1) / 0.00005), 0, 255).astype('u1').tobytes()).decode()
		out['L']['lift'] = b8(LL); out['R']['lift'] = b8(mirror(LL))
	return out
def export(lows):
	TABLES = {o['table']: glove_table(o) for o in lows if o.get('table')}
	lows = [o for o in lows if not o.get('table')]
	for o in lows:
		o.data.materials.clear(); o.location = (0, 0, 0)
	for o in list(SC.objects):
		if o not in lows: bpy.data.objects.remove(o)
	groups = {}
	for o in lows: groups.setdefault(o['group'], []).append(o)
	outs = [join(obs, g) for g, obs in groups.items()]
	bpy.ops.object.select_all(action='DESELECT')
	for o in outs: o.select_set(True)
	if outs: bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'soldier-kit.glb'), export_format='GLB', use_selection=True, export_texcoords=True, export_normals=True,
		export_materials='NONE', export_yup=True, export_apply=True)
	info = {o.name: {'tris': sum(len(p.vertices) - 2 for p in o.data.polygons), 'verts': len(o.data.vertices)} for o in outs}
	json.dump({'meta': META, 'foot': FOOT_META, 'glove': TABLES.get('glove'), 'gauntlet': TABLES.get('gauntlet'), 'stand': STAND, 'groups': info, 'size': SIZE}, open(os.path.join(OUT, 'soldier-kit.json'), 'w'), indent=1)
	log('exported', info)

# (KIT_ONLY=boot, glove or gauntlet: build only that, for a quick look)
ONLY = os.environ.get('KIT_ONLY')
sy = helmet() if not ONLY else rimY(0) + 0.024
if not ONLY: nvg(sy); headset()
for build in (magazine, magpouch, admin, dangler, radio, ptt, medpouch, tourniquet, backpanel, handle, buckle):
	if not ONLY: build()
FOOT_META = None
if ONLY in (None, 'boot'): FOOT_META = boot(); gear('boot', back=False)
if ONLY in (None, 'glove'): glove(); gear('glove', back=False)
if ONLY in (None, 'gauntlet'): gauntlet(); gear('gauntlet', back=False)
lows = [l for l, _ in PIECES]
log('pieces', len(lows), 'tris', sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in lows))
uv_and_pack(lows)
imgs = bake_all()
saved = save(imgs)
if PREVIEW: preview(saved)
export(lows)
