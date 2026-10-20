# A creature model made from its own concept sheet.
#
# The sheet's orthographic views (front, side, back) are the reference: the body's shape is cut
# from them and its paint is laid on from them, so what goes into the game is the painting
# itself, turned into a solid.
#
#   1. Shape. Each bone of the rig (specs/<name>.json, joints read off the sheet in pixels) owns
#      the part of the front silhouette nearest it, and a band of the side silhouette along its
#      own line. A bone's solid is where both hold (a visual hull per bone, so a limb is as deep
#      as the limb, not as deep as the body behind it); the bones' solids together, softened,
#      are the body (marching cubes), decimated in Blender to the budget.
#   2. Paint. Each texel of the unwrapped body looks at the views that can see it (a depth test
#      against the hull), weighted by how squarely it faces each, and takes their colour, the
#      painted relief (as a normal map) and the glow (an emissive map). The painted light is
#      partly taken out (the game lights it again), and the painted outlines are kept off.
#   3. Rig. The bones become an armature; every vertex is weighted to the bones whose solids it
#      came from, softened across the joints.
#   4. Export: a skinned GLB with its maps (tools/monsters/pack.mjs then packs it for the game).
#
#   python build.py <name> [--tris N] [--tex N] [--out dir]

import argparse
import json
import math
import os
import sys

import cv2
import numpy as np
from scipy import ndimage
from scipy.spatial import cKDTree
from skimage import measure

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from segment import segment, segment_box  # noqa: E402


def seg_dist(P, a, b, cap=1.0):
	"""distance from points P (N,2) to segment a-b, and the parameter along it; cap > 1 makes
	the reach past either end count for more (a chest stops at the neck, not round the jaw)"""
	a = np.asarray(a, np.float32)
	b = np.asarray(b, np.float32)
	ab = b - a
	L2 = max(float(ab @ ab), 1e-6)
	tr = ((P - a) @ ab) / L2
	t = np.clip(tr, 0, 1)
	Q = a + t[:, None] * ab
	if cap != 1.0:
		L = np.sqrt(L2)
		past = np.abs(tr - t) * L
		perp = np.sqrt(np.maximum(((P - Q) ** 2).sum(1) - past ** 2, 0))
		return np.sqrt(perp ** 2 + (cap * past) ** 2), t
	return np.sqrt(((P - Q) ** 2).sum(1)), t


class View:
	"""one view of the sheet: its pixels, its mask (only the creature's part inside its box)"""

	def __init__(self, img, mask, spec, simg=None):
		x0, y0, x1, y1 = spec['box']
		self.x0, self.y0 = x0, y0
		self.img = img[y0:y1, x0:x1].astype(np.float32) / 255.0
		m = segment((img if simg is None else simg)[y0:y1, x0:x1], spec.get('tol', 14.0)) if mask is None else mask[y0:y1, x0:x1].copy()
		# things the other views do not show (a pick held only in the side view): cut out by hand
		for poly in spec.get('cut', []):
			cv2.fillPoly(m, [np.array(poly, np.int32) - [x0, y0]], 0)
		# and a part drawn turned away in this view (a head looking off to one side): its shape
		# as it would be from here, by hand (paint it from the other views: nopaint)
		for poly in spec.get('add', []):
			cv2.fillPoly(m, [np.array(poly, np.int32) - [x0, y0]], 1)
		# thin guide lines drawn across the sheet: opened away
		if spec.get('open'):
			k = int(spec['open'])
			m = cv2.morphologyEx(m, cv2.MORPH_OPEN, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k)))
		n, lab, stats, cent = cv2.connectedComponentsWithStats(m, connectivity=8)
		if n > 1:
			# the figure: the biggest piece, and the pieces of some size that sit inside its box
			# (a loose tatter, a knife); not a neighbouring figure reaching into the box
			bi = 1 + int(np.argmax(stats[1:, 4]))
			bx0, by0, bw, bh = stats[bi, :4]
			keep = [bi] + [i for i in range(1, n) if i != bi and stats[i, 4] > stats[bi, 4] * 0.01 and bx0 <= cent[i, 0] <= bx0 + bw and by0 <= cent[i, 1] <= by0 + bh]
			m = np.isin(lab, keep).astype(np.uint8)
		# card-grey paint the card test took for card (pale skin through a face): holes filled by a seed
		if spec.get('fill'):
			n2, lab2 = cv2.connectedComponents((m == 0).astype(np.uint8), connectivity=4)
			for sx, sy in spec['fill']:
				k = lab2[int(sy - y0), int(sx - x0)]
				if k > 0:
					m[lab2 == k] = 1
		# cut away the floor line under the feet
		g = spec.get('ground')
		if g is not None:
			m[int(g - y0) + 2:] = 0
		self.mask = m > 0
		# paint the other views give better (a pick's handle across a thigh): kept out of the bake
		self.paint = np.ones(self.mask.shape, np.float32)
		for poly in spec.get('nopaint', []):
			cv2.fillPoly(self.paint, [np.array(poly, np.int32) - [x0, y0]], 0)
		self.paint = cv2.GaussianBlur(self.paint, (0, 0), 2)
		self.h, self.w = self.mask.shape
		self.dt = ndimage.distance_transform_edt(self.mask)

	def sample(self, arr, u, v):
		"""bilinear sample of arr at sheet pixel coords (u, v); outside -> 0"""
		u = u - self.x0
		v = v - self.y0
		inside = (u >= 0) & (v >= 0) & (u < self.w - 1) & (v < self.h - 1)
		u = np.clip(u, 0, self.w - 1.001)
		v = np.clip(v, 0, self.h - 1.001)
		iu = np.floor(u).astype(int)
		iv = np.floor(v).astype(int)
		fu = (u - iu)
		fv = (v - iv)
		if arr.ndim == 3:
			fu = fu[:, None]
			fv = fv[:, None]
		a = arr[iv, iu] * (1 - fu) + arr[iv, iu + 1] * fu
		b = arr[iv + 1, iu] * (1 - fu) + arr[iv + 1, iu + 1] * fu
		out = a * (1 - fv) + b * fv
		if arr.ndim == 3:
			out = out * inside[:, None]
		else:
			out = out * inside
		return out, inside


def delight(img, mask, k=0.3, sigma=28):
	"""take out some of the painted light: divide by the broad shading, softly"""
	L = img @ np.array([0.114, 0.587, 0.299], np.float32)
	m = mask.astype(np.float32)
	num = cv2.GaussianBlur(L * m, (0, 0), sigma)
	den = cv2.GaussianBlur(m, (0, 0), sigma) + 1e-4
	broad = num / den
	mean = float((L * m).sum() / max(m.sum(), 1))
	f = (mean / np.maximum(broad, 0.05)) ** k
	out = img * f[..., None]
	# the painted highlights (the painter's own sheen) are pressed down: the game adds its own
	Lo = out @ np.array([0.114, 0.587, 0.299], np.float32)
	knee = mean * 1.25
	over = np.maximum(Lo - knee, 0)
	scale = np.where(Lo > knee, (knee + over * 0.35) / np.maximum(Lo, 1e-4), 1.0)
	return np.clip(out * scale[..., None], 0, 1)


def relief(img, sigma=2.5):
	"""the painted relief: the luminance's fine detail (a height, roughly)"""
	L = img @ np.array([0.114, 0.587, 0.299], np.float32)
	return L - cv2.GaussianBlur(L, (0, 0), sigma * 3)


def glow_mask(img, g):
	hsv = cv2.cvtColor((img * 255).astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
	h0, h1 = g['hue']
	hue_ok = (hsv[..., 0] >= h0) & (hsv[..., 0] <= h1)
	s = np.clip((hsv[..., 1] - g['sat']) / 60, 0, 1)
	v = np.clip((hsv[..., 2] - g['val']) / 60, 0, 1)
	return cv2.GaussianBlur((hue_ok * s * v).astype(np.float32), (0, 0), 1.5)


def build(name, tris=14000, tex=1024, out=None, vox_px=3):
	spec = json.load(open(os.path.join(HERE, 'specs', name + '.json')))
	img = cv2.imread(os.path.join(HERE, 'sheets', spec['sheet']))
	if spec.get('floor'):
		# a sheet whose lower panel is a lighter grey (a floor under the turnaround): brought to
		# the card's grey above it, so the card fit has no step to break on
		y = int(spec['floor'])
		up = np.median(img[y - 10:y - 3].reshape(-1, 3).astype(np.float32), 0)
		dn = np.median(img[y + 3:y + 10].reshape(-1, 3).astype(np.float32), 0)
		segimg = img.astype(np.float32)
		segimg[y:] += up - dn
		segimg = np.clip(segimg, 0, 255).astype(np.uint8)
	else:
		segimg = img
	mask = None
	F = View(img, mask, spec['front'], segimg)
	S = View(img, mask, spec['side'], segimg)
	B = View(img, mask, spec['back'], segimg) if spec.get('back') else None
	# a top view (a long body seen from above: a salamander, a moth with its wings spread): with
	# the side view it makes the hull (front and back are then only paint), its bones drawn in it
	# as t lines
	TV = View(img, mask, spec['top'], segimg) if spec.get('top') else None
	fs, ss = spec['front'], spec['side']
	H = float(spec['height'])
	top = int(np.where(F.mask.any(1))[0].min()) + F.y0
	px = H / (fs['ground'] - top)  # metres per sheet pixel
	if spec.get('mpp'):
		# (a sheet whose front is drawn at another scale than its side and top: the side's)
		px = float(spec['mpp'])
	cx, gy, cz, gys = fs['cx'], fs['ground'], ss['cz'], ss['ground']
	sdir = 1 if ss.get('faces', 'left') == 'left' else -1
	# sheet pixel -> model metres
	fx = lambda u: (u - cx) * px
	fy = lambda v: (gy - v) * px
	sz = lambda u: (cz - u) * px * sdir
	sy = lambda v: (gys - v) * px
	bones = spec['bones']
	nb = len(bones)
	# back view registration: its own centre and the same scale
	if B:
		bs = spec['back']
		bys, bxs = np.nonzero(B.mask)
		btop = bys.min() + B.y0
		bground = bs.get('ground', bys.max() + B.y0)
		bpx = H / (bground - btop)
		if 'cx' in bs:
			bcx = bs['cx']
		else:
			# centre: line the back silhouette up with the mirrored front one
			fprof = F.mask.sum(0).astype(np.float32)
			fprof_m = fprof[::-1]
			bprof = B.mask.sum(0).astype(np.float32)
			# resample front profile into back pixel scale
			sc = px / bpx
			fx_idx = np.arange(int(len(fprof_m) * sc)) / sc
			fprof_r = np.interp(fx_idx, np.arange(len(fprof_m)), fprof_m) * sc
			cc = np.correlate(bprof, fprof_r, 'full')
			shift = int(np.argmax(cc)) - (len(fprof_r) - 1)
			# front centre in the mirrored, resampled profile
			fc_m = (F.w - 1 - (cx - F.x0)) * sc
			bcx = B.x0 + shift + fc_m
		print('back centre', round(float(bcx), 1), 'scale', round(px / bpx, 3))


	# ---------- front: each pixel to its nearest bone (by distance over the bone's radius) ----------
	ys, xs = np.nonzero(F.mask)
	P = np.stack([xs + F.x0, ys + F.y0], 1).astype(np.float32)
	best = np.full(len(P), np.inf, np.float32)
	flab = np.full(len(P), -1, np.int32)
	for i, b in enumerate(bones):
		if 'f' not in b:
			continue
		d, _ = seg_dist(P, b['f'][0], b['f'][1], float(spec.get('cap', 1.0)))
		far = d > b.get('fmax', np.inf)  # past its reach (wisps of hair round a skull)
		d = d / b.get('r', 40)
		w = (d < best) & ~far
		best[w] = d[w]
		flab[w] = i
	FL = np.full(F.mask.shape, -1, np.int32)
	FL[ys, xs] = flab
	# ---------- side: each bone's band along its own line ----------
	ys2, xs2 = np.nonzero(S.mask)
	P2 = np.stack([xs2 + S.x0, ys2 + S.y0], 1).astype(np.float32)
	SM = np.zeros((nb,) + S.mask.shape, bool)
	ally, allx = np.mgrid[0:S.h, 0:S.w]
	Pall = np.stack([allx.ravel() + S.x0, ally.ravel() + S.y0], 1).astype(np.float32)
	long_ = bool(spec.get('long'))
	seam = int(spec.get('seam', 0))
	if long_:
		# a long body (four legs, a serpent): the side view is the one that tells its bones apart
		# (the front sees the head, the chest and the haunches stacked up), so here each side pixel
		# goes to its nearest bone, and bones drawn on one line (a left and a right leg) share it
		Dn = np.full((nb, len(P2)), np.inf, np.float32)
		for i, b in enumerate(bones):
			if not b.get('free') and not b.get('sideband'):
				Dn[i] = seg_dist(P2, b['s'][0], b['s'][1], float(spec.get('cap', 1.0)))[0] / b.get('rs', b.get('r', 40) * 1.2)
		sbest = Dn.min(0)
		# (pixels of the tube limbs: the trunk's overlap at its borders keeps off them)
		stube = np.zeros(S.mask.shape, bool)
		tb_ = np.array([bool(b.get('tube')) for b in bones])
		if tb_.any():
			own = tb_[np.argmin(Dn, 0)]
			stube[ys2[own], xs2[own]] = True
	for i, b in enumerate(bones):
		r = b.get('rs', b.get('r', 40) * 1.2)
		if b.get('sideband'):
			# a wing spread flat (the side view shows it folded, or edge-on): a thin level band
			# through the line's height, the whole length of the side view
			yy = (b['s'][0][1] + b['s'][1][1]) / 2 - S.y0
			SM[i, max(0, int(yy - r)):int(yy + r) + 1, :] = True
			continue
		if long_ and not b.get('free'):
			w = Dn[i] <= sbest * 1.0001 + 1e-6
			SM[i, ys2[w], xs2[w]] = True
			if seam:
				# (the parts overlap a little at their borders: the side's and the top's borders
				# between two parts never quite agree, and where they differ there would be a gap)
				SM[i] = ndimage.binary_dilation(SM[i], iterations=seam) & S.mask & ~stube
			continue
		if b.get('free'):
			# a thing the side view does not show (a spade held out to the side): a plain band
			d, _ = seg_dist(Pall, b['s'][0], b['s'][1])
			SM[i] = (d <= r).reshape(S.h, S.w)
			continue
		d, _ = seg_dist(P2, b['s'][0], b['s'][1])
		w = d <= r
		SM[i, ys2[w], xs2[w]] = True
	if os.environ.get('MDEBUG'):
		# label maps for checking a spec by eye: front labels, and each side band
		rng = np.random.default_rng(3)
		pal = rng.integers(60, 255, (nb + 1, 3)).astype(np.uint8)
		fimg = np.where((FL >= 0)[..., None], pal[FL], 0).astype(np.uint8)
		simg = np.zeros(S.mask.shape + (3,), np.uint8)
		for i in range(nb):
			simg[SM[i]] = pal[i]
		for i, b in enumerate(bones):
			for img_, key, x0, y0 in ((fimg, 'f', F.x0, F.y0), (simg, 's', S.x0, S.y0)):
				if key in b:
					c = tuple(int(v) for v in pal[i])
					p0 = (int(b[key][0][0] - x0), int(b[key][0][1] - y0))
					p1 = (int(b[key][1][0] - x0), int(b[key][1][1] - y0))
					cv2.line(img_, p0, p1, (255, 255, 255), 2)
					cv2.putText(img_, b['name'], p1, cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255, 255, 255), 1)
		cv2.imwrite(os.path.join(out or '.', 'labels-front.png'), fimg)
		cv2.imwrite(os.path.join(out or '.', 'labels-side.png'), simg)
		if os.environ['MDEBUG'] == 'labels':
			return

	# ---------- the voxel grid ----------
	vs = px * vox_px
	xmin, xmax = fx(F.x0), fx(F.x0 + F.w)
	if TV:
		ts = spec['top']
		tcx, tcz = ts['cx'], ts['cz']
		# facing left, the sheet's down is the body's left (+x); facing right, its right
		tdir = 1 if ts.get('faces', 'left') == 'left' else -1
		if ts.get('mirror'):
			# its two sides drawn in different poses (a leg forward one side, back the other):
			# the side the side view shows (the near one) taken for both, so the two views agree
			c0 = tcx - TV.y0
			near_down = (ts.get('faces', 'left') == 'left') == (ss.get('faces', 'left') == 'left')
			for r_ in range(TV.h):
				r2 = int(round(2 * c0 - r_))
				if 0 <= r2 < TV.h and ((r_ < c0) if near_down else (r_ > c0)):
					TV.mask[r_] = TV.mask[r2]
					TV.img[r_] = TV.img[r2]
					TV.paint[r_] = TV.paint[r2]
			TV.dt = ndimage.distance_transform_edt(TV.mask)
		tx = sorted([(TV.y0 - tcx) * px * tdir, (TV.y0 + TV.h - tcx) * px * tdir])
		xmin, xmax = min(xmin, tx[0]), max(xmax, tx[1])
	zlo, zhi = sorted([sz(S.x0), sz(S.x0 + S.w)])
	X = np.arange(xmin, xmax, vs)
	Y = np.arange(0, H * 1.04, vs)
	Z = np.arange(zlo, zhi, vs)
	print(f'grid {len(X)}x{len(Y)}x{len(Z)} voxel {vs * 100:.2f} cm')
	# front pixel per (x, y), side pixel per (z, y)
	fu = np.round(X / px + cx - F.x0).astype(int)
	fv = np.round(gy - Y / px - F.y0).astype(int)
	su = np.round(cz - Z / (px * sdir) - S.x0).astype(int)
	sv = np.round(gys - Y / px - S.y0).astype(int)
	okfu = (fu >= 0) & (fu < F.w)
	okfv = (fv >= 0) & (fv < F.h)
	oksu = (su >= 0) & (su < S.w)
	oksv = (sv >= 0) & (sv < S.h)
	fuc, fvc, suc, svc = np.clip(fu, 0, F.w - 1), np.clip(fv, 0, F.h - 1), np.clip(su, 0, S.w - 1), np.clip(sv, 0, S.h - 1)
	frontL = FL[fvc][:, fuc].T  # (x, y)
	frontL[~okfu] = -1
	frontL[:, ~okfv] = -1
	occ = np.zeros((len(X), len(Y), len(Z)), np.float32)
	# the things it holds are solids of their own (a spade must not be webbed to the foot it
	# stands by): their own grid and labels, their own surface
	occp = np.zeros_like(occ)
	labp = np.full(occ.shape, -1, np.int16)
	lab = np.full((len(X), len(Y), len(Z)), -1, np.int16)
	# a bone's cross-section is rounded, not the box two silhouettes make: how far in from its
	# edge a pixel is (over the most it gets there) in each view, s in 0..1, and a voxel is in
	# where (1 - s_front)^p + (1 - s_side)^p <= 1 (an ellipse for p = 2)
	pw = float(spec.get('round', 2.0))
	if TV:
		# top pixel per (x, z), and each top pixel to its nearest bone (as the long side view)
		tu = np.round(tcz - Z / (px * tdir) - TV.x0).astype(int)
		tv = np.round(tcx + X / (px * tdir) - TV.y0).astype(int)
		oktu, oktv = (tu >= 0) & (tu < TV.w), (tv >= 0) & (tv < TV.h)
		tuc, tvc = np.clip(tu, 0, TV.w - 1), np.clip(tv, 0, TV.h - 1)
		tys_, txs_ = np.nonzero(TV.mask)
		Pt_ = np.stack([txs_ + TV.x0, tys_ + TV.y0], 1).astype(np.float32)
		Dt = np.full((nb, len(Pt_)), np.inf, np.float32)
		for i, b in enumerate(bones):
			if 't' in b and not b.get('tube'):
				Dt[i] = seg_dist(Pt_, b['t'][0], b['t'][1], float(spec.get('cap', 1.0)))[0] / b.get('rt', b.get('r', 40))
		tbest = Dt.min(0)
		ttube = np.zeros(TV.mask.shape, bool)
		tb_ = np.array([bool(b.get('tube')) for b in bones])
		if tb_.any():
			own = tb_[np.argmin(Dt, 0)]
			ttube[tys_[own], txs_[own]] = True
	for i, b in enumerate(bones):
		r = b.get('r', 40)
		rs = b.get('rs', r * 1.2)
		tsv = None
		if TV is not None and 't' in b:
			wt = Dt[i] <= tbest * 1.0001 + 1e-6
			treg = np.zeros(TV.mask.shape, bool)
			treg[tys_[wt], txs_[wt]] = True
			if seam:
				treg = ndimage.binary_dilation(treg, iterations=seam) & TV.mask & ~ttube
			lm = ndimage.maximum_filter(TV.dt * treg, size=int(2.5 * b.get('rt', r)) + 1)
			sT = np.where(treg, TV.dt / np.maximum(lm, 1), 0).astype(np.float32)
			tsv = sT[tvc][:, tuc]  # (x, z)
			tsv[~oktv] = 0
			tsv[:, ~oktu] = 0
		elif 'fb' in b:
			# a part only the back view shows (a cloak behind the body): its band in the back view
			bys_, bxs_ = np.nonzero(B.mask)
			Pb = np.stack([bxs_ + B.x0, bys_ + B.y0], 1).astype(np.float32)
			d, _ = seg_dist(Pb, b['fb'][0], b['fb'][1])
			wb = d <= r
			breg = np.zeros(B.mask.shape, bool)
			breg[bys_[wb], bxs_[wb]] = True
			lm = ndimage.maximum_filter(B.dt * breg, size=int(2.5 * r) + 1)
			sB = np.where(breg, B.dt / np.maximum(lm, 1), 0).astype(np.float32)
			bu = np.round(bcx - X / bpx - B.x0).astype(int)
			bv = np.round(bground - Y / bpx - B.y0).astype(int)
			okb = ((bu >= 0) & (bu < B.w))[:, None] & ((bv >= 0) & (bv < B.h))[None, :]
			sF_v = sB[np.clip(bv, 0, B.h - 1)][:, np.clip(bu, 0, B.w - 1)].T * okb
			fm_v = sF_v > 0
		else:
			reg = FL == i
			if b.get('band') or long_:
				# a held thing partly behind the body (a haft in a fist, a shield's rim over the
				# hand): all of the drawing within its reach is its own as well
				fy_, fx_ = np.mgrid[0:F.h, 0:F.w]
				d, _ = seg_dist(np.stack([fx_.ravel() + F.x0, fy_.ravel() + F.y0], 1).astype(np.float32), b['f'][0], b['f'][1])
				reg = (F.mask & (d <= r).reshape(F.mask.shape)) | (reg if not long_ else False)
			if not reg.any():
				continue
			lm = ndimage.maximum_filter(F.dt * reg, size=int(2.5 * r) + 1)
			sF = np.where(reg, F.dt / np.maximum(lm, 1), 0).astype(np.float32)
		sreg = SM[i]
		# (a long body's bones split one trunk between them: depth from the whole outline, so the
		# trunk stays one smooth piece across the seams instead of each part rounding off)
		sdt = S.dt * sreg if long_ and not b.get('sideband') else ndimage.distance_transform_edt(sreg)
		slm = ndimage.maximum_filter(sdt, size=int(2.5 * rs) + 1)
		sS = np.where(sreg, sdt / np.maximum(slm, 1), 0).astype(np.float32)
		if tsv is not None:
			pass
		elif 'fb' in b:
			fm, sfv = fm_v, sF_v
		else:
			fm = reg[fvc][:, fuc].T.copy()
			fm[~okfu] = False
			fm[:, ~okfv] = False
			sfv = sF[fvc][:, fuc].T  # (x, y)
		ssv = sS[svc][:, suc]  # (y, z)
		ssv[~oksv] = 0
		ssv[:, ~oksu] = 0
		if tsv is not None and b.get('tube'):
			# a thin limb that reaches out and down at once (a salamander's leg): a tube along its
			# own line in 3D, cut by both outlines, so it follows the diagonal neither view shows
			a3 = np.array([(b['t'][0][1] - tcx) * px * tdir, sy(b['s'][0][1]), sz(b['s'][0][0])], np.float32)
			b3 = np.array([(b['t'][1][1] - tcx) * px * tdir, sy(b['s'][1][1]), sz(b['s'][1][0])], np.float32)
			R3 = max(b.get('rt', r), rs) * px
			lo, hi = np.minimum(a3, b3) - R3, np.maximum(a3, b3) + R3
			ix = np.nonzero((X >= lo[0]) & (X <= hi[0]))[0]
			iy = np.nonzero((Y >= lo[1]) & (Y <= hi[1]))[0]
			iz = np.nonzero((Z >= lo[2]) & (Z <= hi[2]))[0]
			if not len(ix) or not len(iy) or not len(iz):
				continue
			xs_, ys_, zs_ = slice(ix[0], ix[-1] + 1), slice(iy[0], iy[-1] + 1), slice(iz[0], iz[-1] + 1)
			G = np.stack(np.meshgrid(X[xs_], Y[ys_], Z[zs_], indexing='ij'), -1).reshape(-1, 3)
			ab = b3 - a3
			tt = np.clip(((G - a3) @ ab) / max(float(ab @ ab), 1e-9), 0, 1)
			dd = np.linalg.norm(G - (a3 + tt[:, None] * ab), axis=1).reshape(len(ix), len(iy), len(iz))
			# (the outlines eased out by the seam: the two drawings of a limb never quite line up)
			tm_ = ndimage.binary_dilation(TV.mask, iterations=seam) if seam else TV.mask
			sm_ = ndimage.binary_dilation(S.mask, iterations=seam) if seam else S.mask
			tmk = tm_[tvc][:, tuc] & oktv[:, None] & oktu[None]
			smk = sm_[svc][:, suc] & oksv[:, None] & oksu[None]
			vol = (dd <= R3) & tmk[xs_, zs_][:, None, :] & smk[ys_, zs_][None]
			sub = occ[xs_, ys_, zs_]
			sub[vol] = 1
			lsub = lab[xs_, ys_, zs_]
			lsub[vol] = i
			continue
		if tsv is not None:
			xi = np.nonzero((tsv > 0).any(1))[0]
			zi = np.nonzero((ssv > 0).any(0) & (tsv > 0).any(0))[0]
		else:
			xi = np.nonzero(fm.any(1))[0]
			zi = np.nonzero((ssv > 0).any(0))[0]
		if not len(xi) or not len(zi):
			continue
		xs_, zs_ = slice(xi.min(), xi.max() + 1), slice(zi.min(), zi.max() + 1)
		c = (1 - ssv[:, zs_]) ** pw
		if tsv is not None:
			# from above and from the side: (x, z) by (y, z)
			a = (1 - tsv[xs_, zs_]) ** pw
			vol = (tsv[xs_, zs_] > 0)[:, None, :] & (ssv[:, zs_] > 0)[None] & ((a[:, None, :] + c[None]) <= 1.0)
		else:
			a = (1 - sfv[xs_]) ** pw
			vol = fm[xs_][:, :, None] & (ssv[:, zs_] > 0)[None] & ((a[:, :, None] + c[None]) <= 1.0)
		sub = (occp if b.get('free') else occ)[xs_, :, zs_]
		sub[vol] = 1
		lsub = (labp if b.get('free') else lab)[xs_, :, zs_]
		lsub[vol] = i
	print('solid voxels', int(occ.sum()))
	if os.environ.get('MDEBUG'):
		cnt = np.bincount(lab[lab >= 0].ravel(), minlength=nb)
		print('voxels per bone', {b['name']: int(c) for b, c in zip(bones, cnt)})
	# an empty margin all round, so a body touching its box (a nose at the side view's edge)
	# still closes instead of leaving a hole where the grid ends
	pad = 3
	vl, fl = [], []
	for o in (occ, occp):
		if o.max() < 1:
			continue
		v_, f_, _, _ = measure.marching_cubes(ndimage.gaussian_filter(np.pad(o, pad), 1.0), 0.5)
		fl.append(f_ + sum(len(x) for x in vl))
		vl.append(v_)
	verts = np.concatenate(vl) - pad
	faces = np.concatenate(fl)
	verts = np.stack([X[0] + verts[:, 0] * vs, verts[:, 1] * vs, Z[0] + verts[:, 2] * vs], 1).astype(np.float32)
	# voxel labels for weights: every labelled voxel, by its centre
	li = np.argwhere(lab >= 0)
	lpts = np.stack([X[li[:, 0]], Y[li[:, 1]], Z[li[:, 2]]], 1)
	llab = lab[li[:, 0], li[:, 1], li[:, 2]]
	pi_ = np.argwhere(labp >= 0)
	ppts = np.stack([X[pi_[:, 0]], Y[pi_[:, 1]], Z[pi_[:, 2]]], 1)
	plab = labp[pi_[:, 0], pi_[:, 1], pi_[:, 2]]
	# ---------- Blender: decimate, unwrap ----------
	import bpy
	bpy.ops.wm.read_factory_settings(use_empty=True)
	me = bpy.data.meshes.new(name)
	me.from_pydata(verts.tolist(), [], faces[:, ::-1].tolist() if False else faces.tolist())
	me.update()
	ob = bpy.data.objects.new(name, me)
	bpy.context.scene.collection.objects.link(ob)
	bpy.context.view_layer.objects.active = ob
	ob.select_set(True)
	# make normals point out
	bpy.ops.object.mode_set(mode='EDIT')
	bpy.ops.mesh.select_all(action='SELECT')
	bpy.ops.mesh.normals_make_consistent(inside=False)
	bpy.ops.object.mode_set(mode='OBJECT')
	sm_ = ob.modifiers.new('smooth', 'CORRECTIVE_SMOOTH')
	sm_.iterations = 6
	sm_.smooth_type = 'SIMPLE'
	sm_.use_only_smooth = True
	bpy.ops.object.modifier_apply(modifier='smooth')
	n0 = len(me.polygons)
	if n0 > tris:
		dec = ob.modifiers.new('dec', 'DECIMATE')
		dec.ratio = tris / n0
		dec.use_collapse_triangulate = True
		bpy.ops.object.modifier_apply(modifier='dec')
	bpy.ops.object.mode_set(mode='EDIT')
	bpy.ops.mesh.select_all(action='SELECT')
	bpy.ops.mesh.quads_convert_to_tris()
	bpy.ops.uv.smart_project(angle_limit=math.radians(55), island_margin=0.006, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
	bpy.ops.object.mode_set(mode='OBJECT')
	for p in me.polygons:
		p.use_smooth = True
	me.update()
	V = np.array([v.co[:] for v in me.vertices], np.float32)
	VN = np.array([v.normal[:] for v in me.vertices], np.float32)
	T = np.array([p.vertices[:] for p in me.polygons], np.int32)
	uvl = me.uv_layers.active.data
	TUV = np.array([[uvl[li].uv[:] for li in p.loop_indices] for p in me.polygons], np.float32)  # (t, 3, 2)
	print('mesh', len(V), 'verts', len(T), 'tris')

	# depth maps for the visibility test, from the finished mesh (the smoothing and decimation
	# pull the surface in from the voxels; a texel tested against the voxels' depth would fail)
	def zbuf(ai, bi, di, A, Bv, far):
		out = np.full((len(A), len(Bv)), -np.inf if far > 0 else np.inf, np.float32)
		Q = np.stack([(V[:, ai] - A[0]) / vs, (V[:, bi] - Bv[0]) / vs, V[:, di]], 1)
		for tri in T:
			q = Q[tri]
			a0, b0 = np.floor(q[:, :2].min(0)).astype(int)
			a1, b1 = np.ceil(q[:, :2].max(0)).astype(int)
			a0, b0, a1, b1 = max(a0, 0), max(b0, 0), min(a1, len(A) - 1), min(b1, len(Bv) - 1)
			if a1 < a0 or b1 < b0:
				continue
			ga, gb = np.meshgrid(np.arange(a0, a1 + 1), np.arange(b0, b1 + 1), indexing='ij')
			v0, v1 = q[1, :2] - q[0, :2], q[2, :2] - q[0, :2]
			den = v0[0] * v1[1] - v1[0] * v0[1]
			if abs(den) < 1e-9:
				continue
			pa, pb = ga - q[0, 0], gb - q[0, 1]
			l1 = (pa * v1[1] - v1[0] * pb) / den
			l2 = (v0[0] * pb - pa * v0[1]) / den
			ins = (l1 >= -0.05) & (l2 >= -0.05) & (l1 + l2 <= 1.05)
			if not ins.any():
				continue
			d = q[0, 2] + l1 * (q[1, 2] - q[0, 2]) + l2 * (q[2, 2] - q[0, 2])
			sub = out[a0:a1 + 1, b0:b1 + 1]
			if far > 0:
				np.maximum(sub, np.where(ins, d, -np.inf), out=sub)
			else:
				np.minimum(sub, np.where(ins, d, np.inf), out=sub)
		return out
	zfront = zbuf(0, 1, 2, X, Y, 1)
	zback = zbuf(0, 1, 2, X, Y, -1)
	xside = zbuf(1, 2, 0, Y, Z, 1)
	xside_n = zbuf(1, 2, 0, Y, Z, -1)
	ytop = zbuf(0, 2, 1, X, Z, 1) if TV else None

	# ---------- paint ----------
	Fa = delight(F.img, F.mask)
	Sa = delight(S.img, S.mask)
	Ba = delight(B.img, B.mask) if B else None
	Fr, Sr = relief(F.img), relief(S.img)
	Br = relief(B.img) if B else None
	g = spec.get('glow')
	Fg = glow_mask(F.img, g) if g else None
	Sg = glow_mask(S.img, g) if g else None
	Bg = glow_mask(B.img, g) if (g and B) else None
	Tn = tex
	pos = np.zeros((Tn, Tn, 3), np.float32)
	nor = np.zeros((Tn, Tn, 3), np.float32)
	cov = np.zeros((Tn, Tn), bool)
	VNn = VN / np.maximum(np.linalg.norm(VN, axis=1, keepdims=True), 1e-6)
	for t in range(len(T)):
		uv = TUV[t] * Tn
		uv[:, 1] = Tn - uv[:, 1]
		x0, y0 = np.floor(uv.min(0)).astype(int)
		x1, y1 = np.ceil(uv.max(0)).astype(int)
		x0, y0 = max(x0, 0), max(y0, 0)
		x1, y1 = min(x1, Tn - 1), min(y1, Tn - 1)
		if x1 < x0 or y1 < y0:
			continue
		gx, gy_ = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
		a, b, c = uv
		v0, v1 = b - a, c - a
		den = v0[0] * v1[1] - v1[0] * v0[1]
		if abs(den) < 1e-9:
			continue
		px_ = gx - a[0]
		py_ = gy_ - a[1]
		l1 = (px_ * v1[1] - v1[0] * py_) / den
		l2 = (v0[0] * py_ - px_ * v0[1]) / den
		l0 = 1 - l1 - l2
		e = -0.02
		ins = (l0 >= e) & (l1 >= e) & (l2 >= e)
		if not ins.any():
			continue
		iy, ix = np.nonzero(ins)
		L = np.stack([l0[ins], l1[ins], l2[ins]], 1)
		tri = T[t]
		pos[iy + y0, ix + x0] = L @ V[tri]
		nor[iy + y0, ix + x0] = L @ VNn[tri]
		cov[iy + y0, ix + x0] = True
	p = pos[cov]
	n = nor[cov]
	n = n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-6)
	tol = vs * 2.5

	def grid_lookup(arr, A, a, Bv, b):
		ia = np.clip(np.round((a - A[0]) / vs).astype(int), 0, len(A) - 1)
		ib = np.clip(np.round((b - Bv[0]) / vs).astype(int), 0, len(Bv) - 1)
		return arr[ia, ib]

	cols = np.zeros((len(p), 3), np.float32)
	rel = np.zeros(len(p), np.float32)
	glo = np.zeros(len(p), np.float32)
	wsum = np.zeros(len(p), np.float32)
	edge = lambda view, u, v: np.clip(view.sample(view.dt, u, v)[0] / 6.0, 0, 1)
	# front
	u = cx + p[:, 0] / px
	v = gy - p[:, 1] / px
	vis = p[:, 2] >= grid_lookup(zfront, X, p[:, 0], Y, p[:, 1]) - tol
	w = np.clip(n[:, 2], 0, 1) ** 2 * vis * edge(F, u, v) * F.sample(F.paint, u, v)[0]
	c, _ = F.sample(Fa, u, v)
	cols += c * w[:, None]
	rel += F.sample(Fr, u, v)[0] * w
	if Fg is not None:
		glo += F.sample(Fg, u, v)[0] * w
	wsum += w
	# back
	if B:
		u = bcx - p[:, 0] / bpx
		v = bground - p[:, 1] / bpx
		vis = p[:, 2] <= grid_lookup(zback, X, p[:, 0], Y, p[:, 1]) + tol
		w = np.clip(-n[:, 2], 0, 1) ** 2 * vis * edge(B, u, v) * B.sample(B.paint, u, v)[0]
		cols += B.sample(Ba, u, v)[0] * w[:, None]
		rel += B.sample(Br, u, v)[0] * w
		if Bg is not None:
			glo += B.sample(Bg, u, v)[0] * w
		wsum += w
	# side, both flanks (the sheet shows one; the other is its mirror)
	u = cz - p[:, 2] / (px * sdir)
	v = gys - p[:, 1] / px
	for sign, depth in ((1, xside), (-1, xside_n)):
		ylk = grid_lookup(depth, Y, p[:, 1], Z, p[:, 2])
		vis = (p[:, 0] >= ylk - tol) if sign > 0 else (p[:, 0] <= ylk + tol)
		w = np.clip((n[:, 0] * sign - 0.5) / 0.35, 0, 1) ** 2 * vis * np.clip(S.sample(S.dt, u, v)[0] / 22.0, 0, 1) * S.sample(S.paint, u, v)[0]
		cols += S.sample(Sa, u, v)[0] * w[:, None]
		rel += S.sample(Sr, u, v)[0] * w
		if Sg is not None:
			glo += S.sample(Sg, u, v)[0] * w
		wsum += w
	# top
	if TV:
		Ta, Tr = delight(TV.img, TV.mask), relief(TV.img)
		Tg = glow_mask(TV.img, g) if g else None
		u = tcz - p[:, 2] / (px * tdir)
		v = tcx + p[:, 0] / (px * tdir)
		vis = p[:, 1] >= grid_lookup(ytop, X, p[:, 0], Z, p[:, 2]) - tol
		w = np.clip(n[:, 1], 0, 1) ** 2 * vis * edge(TV, u, v) * TV.sample(TV.paint, u, v)[0]
		cols += TV.sample(Ta, u, v)[0] * w[:, None]
		rel += TV.sample(Tr, u, v)[0] * w
		if Tg is not None:
			glo += TV.sample(Tg, u, v)[0] * w
		wsum += w
	have = wsum > 1e-3
	cols[have] /= wsum[have, None]
	rel[have] /= wsum[have]
	glo[have] /= wsum[have]
	print('texels', len(p), 'painted', round(float(have.mean()) * 100, 1), '%')
	# texels no view sees: nearest painted texel in 3D
	if (~have).any() and have.any():
		kd = cKDTree(p[have])
		_, j = kd.query(p[~have])
		cols[~have] = cols[have][j]
		# a texel no view sees straight on but the front view covers (the back of a spade, a
		# lantern's far side): the front's paint goes through it, as it would on a thin thing
		u = cx + p[:, 0] / px
		v = gy - p[:, 1] / px
		fin = (F.sample(F.mask.astype(np.float32), u, v)[0] > 0.5) & (F.sample(F.paint, u, v)[0] > 0.5)
		thru = ~have & fin
		cols[thru] = F.sample(Fa, u[thru], v[thru])[0]
		if os.environ.get('MDEBUG') == 'paint':
			cols[~have & ~fin] = (1, 0, 1)
		rel[~have] = 0
		glo[~have] = glo[have][j]
	albedo = np.zeros((Tn, Tn, 3), np.float32)
	height = np.zeros((Tn, Tn), np.float32)
	emis = np.zeros((Tn, Tn), np.float32)
	albedo[cov] = cols
	height[cov] = rel
	emis[cov] = glo

	# grow the islands outward so mips and filtering do not bleed the background in
	def dilate(img, m, it=12):
		img = img.copy()
		m = m.copy()
		k = np.ones((3, 3), np.uint8)
		for _ in range(it):
			grown = cv2.dilate(m.astype(np.uint8), k) > 0
			ring = grown & ~m
			if not ring.any():
				break
			if img.ndim == 3:
				s = cv2.blur(img * m[..., None], (3, 3))
				c = cv2.blur(m.astype(np.float32), (3, 3))[..., None]
			else:
				s = cv2.blur(img * m, (3, 3))
				c = cv2.blur(m.astype(np.float32), (3, 3))
			img[ring] = (s / np.maximum(c, 1e-6))[ring]
			m = grown
		return img

	# AgX takes some colour out; give it back so the game matches the painting
	sat = float(spec.get('sat', 1.18))
	gray = albedo.mean(-1, keepdims=True)
	albedo = np.clip(gray + (albedo - gray) * sat, 0, 1)
	albedo = dilate(albedo, cov)
	height = dilate(height, cov)
	emis = dilate(emis, cov)
	# normal map from the painted relief, in texture space (three uses the uv derivatives)
	hs = spec.get('relief', 1.6)
	hh = cv2.GaussianBlur(height, (0, 0), 0.8)
	dx = cv2.Sobel(hh, cv2.CV_32F, 1, 0, ksize=3) * hs
	dy = cv2.Sobel(hh, cv2.CV_32F, 0, 1, ksize=3) * hs
	nm = np.stack([-dx, dy, np.ones_like(dx)], -1)
	nm /= np.linalg.norm(nm, axis=-1, keepdims=True)
	normal_img = ((nm * 0.5 + 0.5) * 255).astype(np.uint8)  # rgb
	out = out or os.path.join(HERE, 'out', name)
	os.makedirs(out, exist_ok=True)
	alb8 = (np.clip(albedo, 0, 1) * 255).astype(np.uint8)  # bgr
	cv2.imwrite(os.path.join(out, 'albedo.png'), alb8)
	cv2.imwrite(os.path.join(out, 'normal.png'), normal_img[..., ::-1])
	gcol = np.array(g['color'] if g else [0, 0, 0], np.float32)
	em8 = (np.clip(emis[..., None] * gcol[None, None, ::-1], 0, 1) * 255).astype(np.uint8)
	cv2.imwrite(os.path.join(out, 'emissive.png'), em8)

	# ---------- rig ----------
	j3 = []
	for b in bones:
		if TV is not None and 't' in b:
			h_ = [(b['t'][0][1] - tcx) * px * tdir, sy(b['s'][0][1]), sz(b['s'][0][0])]
			t_ = [(b['t'][1][1] - tcx) * px * tdir, sy(b['s'][1][1]), sz(b['s'][1][0])]
		elif 'fb' in b:
			h_ = [(bcx - b['fb'][0][0]) * bpx, (bground - b['fb'][0][1]) * bpx, sz(b['s'][0][0])]
			t_ = [(bcx - b['fb'][1][0]) * bpx, (bground - b['fb'][1][1]) * bpx, sz(b['s'][1][0])]
		else:
			h_ = [fx(b['f'][0][0]), fy(b['f'][0][1]), sz(b['s'][0][0])]
			t_ = [fx(b['f'][1][0]), fy(b['f'][1][1]), sz(b['s'][1][0])]
		j3.append((h_, t_))
	# a voxel far from its own bone's line (a robe's hem behind a shin: the shin's hull reaches
	# back into the robe the side view shows) follows the bone it lies nearest, by distance over
	# radius, so the hem does not swing with the leg like a tail
	def seg3(Pt, a, b):
		a, b = np.asarray(a, np.float32), np.asarray(b, np.float32)
		ab = b - a
		t = np.clip(((Pt - a) @ ab) / max(float(ab @ ab), 1e-9), 0, 1)
		return np.linalg.norm(Pt - (a + t[:, None] * ab), axis=1)
	rad = np.array([max(b.get('r', 40), b.get('rs', b.get('r', 40) * 1.2)) * px for b in bones], np.float32)
	reach = float(spec.get('reach', 1.6))
	D3 = np.stack([seg3(lpts, *j3[i]) / rad[i] if not bones[i].get('free') else np.full(len(lpts), np.inf, np.float32) for i in range(nb)], 1)
	own = D3[np.arange(len(llab)), llab]
	stray = own > reach
	llab = np.where(stray, np.argmin(D3, 1), llab).astype(llab.dtype)
	print('voxels relabelled', round(float(stray.mean()) * 100, 1), '%')
	# weights: bones whose solids the vertex came from, softened along the surface
	kd = cKDTree(lpts)
	K = 8
	dd, jj = kd.query(V, k=K)
	W = np.zeros((len(V), nb), np.float32)
	for k in range(K):
		W[np.arange(len(V)), llab[jj[:, k]]] += 1.0 / (1 + dd[:, k] / vs)
	# smooth over the mesh (edges)
	edges = np.concatenate([T[:, [0, 1]], T[:, [1, 2]], T[:, [2, 0]]])
	adj_n = np.bincount(edges[:, 0], minlength=len(V)) + np.bincount(edges[:, 1], minlength=len(V))
	for _ in range(spec.get('weight_smooth', 6)):
		acc = np.zeros_like(W)
		np.add.at(acc, edges[:, 0], W[edges[:, 1]])
		np.add.at(acc, edges[:, 1], W[edges[:, 0]])
		W = 0.5 * W + 0.5 * acc / np.maximum(adj_n, 1)[:, None]
	# a held thing (a spade, a lantern) is rigid: its pieces of surface (the ones nearer its
	# solid than the body's) go wholly to it, and the body never follows it
	free = [i for i, b in enumerate(bones) if b.get('free')]
	if free and len(ppts):
		from scipy.sparse import coo_matrix
		from scipy.sparse.csgraph import connected_components
		g_ = coo_matrix((np.ones(len(edges)), (edges[:, 0], edges[:, 1])), shape=(len(V), len(V)))
		nc, comp = connected_components(g_, directed=False)
		db, _ = kd.query(V)
		kdp = cKDTree(ppts)
		dp, jp = kdp.query(V)
		nearer = np.bincount(comp, weights=(dp < db).astype(np.float64), minlength=nc) / np.maximum(np.bincount(comp, minlength=nc), 1)
		isp = nearer[comp] > 0.5
		dom = np.argmax(W, 1)
		W[:, free] = 0
		# a body vertex the prop's weight had all of (a palm round the handle): to the holding bone
		lost = ~isp & (W.sum(1) < 1e-6)
		names = [b['name'] for b in bones]
		W[np.nonzero(lost)[0], [names.index(bones[d]['parent']) if bones[d]['parent'] else d for d in dom[lost]]] = 1
		W[isp] = 0
		W[np.nonzero(isp)[0], plab[jp[isp]]] = 1
		print('prop vertices', int(isp.sum()))
	# keep the four strongest
	order = np.argsort(-W, 1)
	keep = np.zeros_like(W, bool)
	np.put_along_axis(keep, order[:, :4], True, 1)
	W = W * keep
	W /= np.maximum(W.sum(1, keepdims=True), 1e-6)

	arm = bpy.data.armatures.new(name + '-rig')
	rig = bpy.data.objects.new(name + '-rig', arm)
	bpy.context.scene.collection.objects.link(rig)
	bpy.context.view_layer.objects.active = rig
	bpy.ops.object.mode_set(mode='EDIT')
	eb = {}
	# blender is z-up: model (x, y, z) -> blender (x, -z, y), and the glTF exporter turns it back
	tob = lambda q: (q[0], -q[2], q[1])
	for i, b in enumerate(bones):
		e = arm.edit_bones.new(b['name'])
		e.head = tob(j3[i][0])
		e.tail = tob(j3[i][1])
		if b['parent']:
			e.parent = eb[b['parent']]
		eb[b['name']] = e
	bpy.ops.object.mode_set(mode='OBJECT')
	# the mesh into blender's frame too
	for i, vtx in enumerate(me.vertices):
		x, y, z = V[i]
		vtx.co = (x, -z, y)
	me.update()
	for i, b in enumerate(bones):
		vg = ob.vertex_groups.new(name=b['name'])
		idx = np.nonzero(W[:, i] > 1e-4)[0]
		for vi in idx:
			vg.add([int(vi)], float(W[vi, i]), 'REPLACE')
	ob.parent = rig
	mod = ob.modifiers.new('rig', 'ARMATURE')
	mod.object = rig

	# ---------- material ----------
	mat = bpy.data.materials.new(name + '-mat')
	mat.use_nodes = True
	nt = mat.node_tree
	bsdf = nt.nodes['Principled BSDF']

	def teximg(path, colour):
		im = bpy.data.images.load(path)
		im.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
		nd = nt.nodes.new('ShaderNodeTexImage')
		nd.image = im
		return nd

	ta = teximg(os.path.join(out, 'albedo.png'), True)
	nt.links.new(ta.outputs['Color'], bsdf.inputs['Base Color'])
	tn = teximg(os.path.join(out, 'normal.png'), False)
	nmn = nt.nodes.new('ShaderNodeNormalMap')
	nt.links.new(tn.outputs['Color'], nmn.inputs['Color'])
	nt.links.new(nmn.outputs['Normal'], bsdf.inputs['Normal'])
	if g:
		te = teximg(os.path.join(out, 'emissive.png'), True)
		nt.links.new(te.outputs['Color'], bsdf.inputs['Emission Color'])
		bsdf.inputs['Emission Strength'].default_value = float(g.get('strength', 1.0))
	bsdf.inputs['Roughness'].default_value = float(spec.get('rough', 0.6))
	bsdf.inputs['Metallic'].default_value = 0.0
	me.materials.append(mat)
	glb = os.path.join(out, name + '.glb')
	bpy.ops.object.select_all(action='SELECT')
	bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_yup=True, export_apply=False, export_tangents=False, export_image_format='AUTO')
	meta = {'name': spec['name'], 'height': H, 'bones': [b['name'] for b in bones], 'rig': spec.get('rig'), 'joints': {b['name']: j3[i] for i, b in enumerate(bones)}}
	# how it moves (creatures/motion.js): its hunch, its striking hand, the things it holds
	for k in ('stalk', 'strikeSide', 'strikeTime'):
		if k in spec:
			meta[k] = spec[k]
	meta['props'] = [b['name'] for b in bones if b.get('free')]
	# each bone's thickness, for its hit zone (creatures/models.js): the thinner of its two views
	meta['radii'] = {b['name']: round(min(b.get('r', 40), b.get('rs', b.get('r', 40) * 1.2)) * px, 3) for b in bones}
	meta['hang'] = [b['name'] for b in bones if b.get('hang')]
	json.dump(meta, open(os.path.join(out, 'meta.json'), 'w'), indent=1)
	print('wrote', glb, os.path.getsize(glb) // 1024, 'KB')


if __name__ == '__main__':
	ap = argparse.ArgumentParser()
	ap.add_argument('name')
	ap.add_argument('--tris', type=int, default=14000)
	ap.add_argument('--tex', type=int, default=1024)
	ap.add_argument('--out')
	ap.add_argument('--vox', type=float, default=3)
	a = ap.parse_args()
	build(a.name, a.tris, a.tex, a.out, a.vox)
