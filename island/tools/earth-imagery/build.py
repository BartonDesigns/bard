# The orbital Earth from the stitched Sentinel-2 grid (fetch.py) over NASA's Blue Marble, cut to
# Natural Earth's coastline (landmask.py): a base texture for the whole globe, and two levels of
# detail tiles where there is imagery. Run: python3 build.py out
import numpy as np, os, sys, time, json
from PIL import Image, ImageFilter
from multiprocessing import Pool
from scipy.ndimage import gaussian_filter
Image.MAX_IMAGE_PIXELS = None
OUT = sys.argv[1] if len(sys.argv) > 1 else 'out'
H, W = 32400, 64800

def s2(): return np.load('s2.npy', mmap_mode='r')
def landgrid(): return np.load('land.npy', mmap_mode='r')

# a Sentinel pixel counts where it has data, is not cloud, and is on land (the mosaic's sea is
# striped by the satellite's passes, so the sea is Blue Marble's)
def usable(a, L, r0):
	mn = a.min(-1)
	lat = 90 - (r0 + np.arange(a.shape[0]) + .5) / 180
	cloud = (mn > 225) & (np.abs(lat) < 55)[:, None]
	return (mn > 4) & ~cloud & (L > 0)

# ---- 1. the grid at Blue Marble's 1/15 degree: mean colour, how much is usable, how much is land
def lowres():
	if os.path.exists('lo2.npz'): z = np.load('lo2.npz'); return z['c'], z['k'], z['l']
	S, L = s2(), landgrid(); f = 12
	c = np.zeros((H // f, W // f, 3), np.float32); k = np.zeros((H // f, W // f), np.float32); l = np.zeros_like(k)
	for r in range(H // f):
		a = np.asarray(S[r * f:(r + 1) * f]); m = np.asarray(L[r * f:(r + 1) * f])
		v = usable(a, m, r * f).reshape(f, W // f, f); a = a.reshape(f, W // f, f, 3).astype(np.float32)
		n = v.sum((0, 2)); k[r] = n / (f * f); l[r] = m.reshape(f, W // f, f).mean((0, 2))
		c[r] = (a * v[..., None]).sum((0, 2)) / np.maximum(n, 1)[:, None]
	np.savez('lo2.npz', c=c, k=k, l=l); return c, k, l

def smooth(x, lo, hi): t = np.clip((x - lo) / (hi - lo), 0, 1); return t * t * (3 - 2 * t)

def blue_marble(c, k, l):
	bm = np.asarray(Image.open('bmng.jpg').convert('RGB')).astype(np.float32)
	snow = smooth(bm.min(-1), 150, 215)[..., None]
	# land: Blue Marble toned to the Sentinel look (fitted on well-covered land), so the two meet
	# without a seam; snow and ice keep their own white
	m = (k > 0.95) & (snow[..., 0] < .01)
	fit = []
	for ch in range(3):
		x, y = bm[..., ch][m], c[..., ch][m]
		g, o = np.linalg.lstsq(np.vstack([x, np.ones_like(x)]).T, y, rcond=None)[0]; fit.append((float(g), float(o)))
	print('fit', fit)
	bml = np.stack([np.clip(bm[..., i] * fit[i][0] + fit[i][1], 0, 255) for i in range(3)], -1)
	bml = bml * (1 - snow) + bm * snow
	# sea: Blue Marble's, carried under the coasts so no land colour bleeds into it
	sea = (l < .01).astype(np.float32)
	bmo = bm.copy()
	for s in (3, 12, 48):
		num = np.stack([gaussian_filter(bm[..., i] * sea, s, mode=('nearest', 'wrap')) for i in range(3)], -1)
		den = gaussian_filter(sea, s, mode=('nearest', 'wrap'))[..., None]
		fill = (sea[..., None] < .5) & (den > .02)
		bmo = np.where(fill, num / np.maximum(den, 1e-6), bmo); sea = np.maximum(sea, (den[..., 0] > .02).astype(np.float32))
	# Blue Marble's sea floor relief stops at 60 S: the far south fades to the ocean colour above it
	rows = slice((90 + 45) * 15, (90 + 59) * 15)
	ref = np.median(bmo[rows][l[rows] < .01], 0)
	lat = 90 - (np.arange(bmo.shape[0]) + .5) / 15
	t = smooth(-lat, 55, 60.5)[:, None, None]
	bmo = bmo * (1 - t) + ref * t
	return bml, bmo

def feather(valid, r=6):
	im = Image.fromarray((valid * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(r))
	w = np.asarray(im).astype(np.float32) / 255
	return np.clip(w * 1.8 - 0.4, 0, 1) * valid

# ---- 3. tiles: level 1 (6 degrees, 1/60) and level 2 (2 degrees, 1/180), 360 px
def tile(args):
	lv, r, cl = args
	f = 3 if lv == 1 else 1
	n = 360; pad = 24
	S, L = s2(), landgrid()
	bml, bmo = np.load('bml.npy', mmap_mode='r'), np.load('bmo.npy', mmap_mode='r')
	R0, C0 = r * n * f, cl * n * f
	rr0, rr1 = max(0, R0 - pad * f), min(H, R0 + (n + pad) * f)
	cc0, cc1 = max(0, C0 - pad * f), min(W, C0 + (n + pad) * f)
	a = np.asarray(S[rr0:rr1, cc0:cc1]); m = np.asarray(L[rr0:rr1, cc0:cc1])
	v = usable(a, m, rr0)
	y0, x0 = (R0 - rr0) // f, (C0 - cc0) // f
	core = v[y0 * f:(y0 + n) * f, x0 * f:(x0 + n) * f]
	if core.mean() < 0.002: return None
	hh, ww = a.shape[0] // f, a.shape[1] // f
	if f > 1:
		a = a[:hh * f, :ww * f].reshape(hh, f, ww, f, 3).astype(np.float32)
		vv = v[:hh * f, :ww * f].reshape(hh, f, ww, f); nv = vv.sum((1, 3))
		a = (a * vv[..., None]).sum((1, 3)) / np.maximum(nv, 1)[..., None]
		vf = nv / (f * f); lf = m[:hh * f, :ww * f].reshape(hh, f, ww, f).mean((1, 3))
	else:
		a = a.astype(np.float32); vf = v.astype(np.float32); lf = m.astype(np.float32)
	# feather only into gaps in the imagery, never at the coast
	wv = vf * feather(((vf > 0) | (lf < .5)).astype(np.float32))
	g = 12 // f
	br0, br1 = rr0 // 12, min(2700, (rr1 + 11) // 12 + 1); bc0, bc1 = cc0 // 12, min(5400, (cc1 + 11) // 12 + 1)
	oy, ox = (rr0 // f) - br0 * g, (cc0 // f) - bc0 * g
	def up(B):
		bi = Image.fromarray(np.asarray(B[br0:br1, bc0:bc1])).resize(((bc1 - bc0) * g, (br1 - br0) * g), Image.BICUBIC)
		return np.asarray(bi).astype(np.float32)[oy:oy + hh, ox:ox + ww]
	comp = a * wv[..., None] + up(bml) * np.clip(lf - wv, 0, 1)[..., None] + up(bmo) * (1 - lf)[..., None]
	out = comp[y0:y0 + n, x0:x0 + n]
	if out.shape[:2] != (n, n): return None
	d = f'{OUT}/l{lv}/{r}'; os.makedirs(d, exist_ok=True)
	p = f'{d}/{cl}.webp'
	Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).save(p, quality=72, method=4)
	return os.path.getsize(p)

if __name__ == '__main__':
	c, k, l = lowres()
	bml, bmo = blue_marble(c, k, l)
	np.save('bml.npy', bml.astype(np.uint8)); np.save('bmo.npy', bmo.astype(np.uint8))
	# ---- 2. the base: whole globe, area-weighted (imagery, Blue Marble land, sea); alpha = land
	base = c * k[..., None] + bml * np.clip(l - k, 0, 1)[..., None] + bmo * (1 - l)[..., None]
	os.makedirs(OUT, exist_ok=True)
	alpha = Image.fromarray((l * 255).astype(np.uint8))
	for name, size in (('earth-4k', (4096, 2048)), ('earth-2k', (2048, 1024))):
		im = Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).resize(size, Image.LANCZOS).convert('RGBA')
		im.putalpha(alpha.resize(size, Image.BILINEAR))
		im.save(f'{OUT}/{name}.webp', quality=86, method=6, exact=True)  # exact: keep the sea's colour under alpha 0
		print(name, os.path.getsize(f'{OUT}/{name}.webp'))
	Image.fromarray(np.clip(base, 0, 255).astype(np.uint8)).save('preview-base.jpg', quality=85)
	if '--base' in sys.argv: sys.exit()
	jobs = [(1, r, cl) for r in range(30) for cl in range(60)] + [(2, r, cl) for r in range(90) for cl in range(180)]
	t = time.time(); tot = {1: [0, 0], 2: [0, 0]}
	have = {1: [['0'] * 60 for _ in range(30)], 2: [['0'] * 180 for _ in range(90)]}
	with Pool(4) as p:
		for j, s in zip(jobs, p.imap(tile, jobs, chunksize=8)):
			if s: tot[j[0]][0] += 1; tot[j[0]][1] += s; have[j[0]][j[1]][j[2]] = '1'
	json.dump({'l1': [''.join(x) for x in have[1]], 'l2': [''.join(x) for x in have[2]]}, open(f'{OUT}/tiles.json', 'w'), separators=(',', ':'))
	print('tiles', tot, round(time.time() - t))
