# Stitch the Sentinel-2 L2A 120 m mosaic (s3://sentinel-s2-l2a-mosaic-120, read at 480 m overviews)
# into one equirectangular grid at 1/180 degree. North of the equator: June; south: January.
import rasterio, numpy as np, time, sys, os, re, urllib.request, urllib.parse, concurrent.futures as cf, threading
from rasterio.env import Env
from rasterio.warp import reproject, Resampling, transform_bounds
from rasterio.transform import from_origin
RES = 1 / 180; W, H = 64800, 32400
B = 'https://sentinel-s2-l2a-mosaic-120.s3.eu-central-1.amazonaws.com'
rgb = np.lib.format.open_memmap('s2.npy', mode='r+' if os.path.exists('s2.npy') else 'w+', dtype=np.uint8, shape=(H, W, 3))
done_f = 'done.txt'; done = set(open(done_f).read().split()) if os.path.exists(done_f) else set()
lock = threading.Lock()
def zones(period):
	keys, tok = [], None
	while True:
		u = f'{B}/?list-type=2&max-keys=1000&prefix={period}/' + (f'&continuation-token={urllib.parse.quote(tok, safe="")}' if tok else '')
		t = urllib.request.urlopen(u, timeout=60).read().decode()
		keys += re.findall(r'<Key>(.*?)</Key>', t)
		m = re.search(r'<NextContinuationToken>(.*?)</NextContinuationToken>', t)
		if not m: break
		tok = m.group(1)
	return sorted(set(k.split('/')[3] for k in keys if k.endswith('B04.tif')))
def tone(a):
	r = a.astype(np.float32) / 10000.
	r = 1 - np.exp(-r * 4.0)
	return np.clip(r, 0, 1) ** (1 / 1.12)
def one(period, z):
	tag = f'{period}/{z}'
	if tag in done: return
	bands = []
	with Env(GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR', CURL_CA_BUNDLE='/root/.ccr/ca-bundle.crt', GDAL_HTTP_MAX_RETRY='4', GDAL_HTTP_RETRY_DELAY='2'):
		for b in ('B04', 'B03', 'B02'):
			with rasterio.open(f'/vsicurl/{B}/{period}/{z}/{b}.tif') as s:
				a = s.read(1, out_shape=(max(1, s.height // 4), max(1, s.width // 4)))
				tr = s.transform * s.transform.scale(s.width / a.shape[1], s.height / a.shape[0]); crs = s.crs; bounds = s.bounds
			bands.append(a)
	src = np.stack(bands)
	l0, b0, l1, t0 = transform_bounds(crs, 'EPSG:4326', *bounds, densify_pts=41)
	if l1 - l0 > 30 or l1 <= l0:  # across the antimeridian: use the zone's own longitudes
		n = int(z[:2]); l0 = -180 + (n - 1) * 6 - 1; l1 = l0 + 8
	l0 = max(-180, l0); l1 = min(180, l1); b0 = max(-90, b0); t0 = min(90, t0)
	c0 = int(np.floor((l0 + 180) / RES)); c1 = int(np.ceil((l1 + 180) / RES)); r0 = int(np.floor((90 - t0) / RES)); r1 = int(np.ceil((90 - b0) / RES))
	c1 = min(W, c1); r1 = min(H, r1)
	dst = np.zeros((3, r1 - r0, c1 - c0), np.uint16)
	reproject(src, dst, src_transform=tr, src_crs=crs, dst_transform=from_origin(-180 + c0 * RES, 90 - r0 * RES, RES, RES), dst_crs='EPSG:4326', resampling=Resampling.average, src_nodata=0, dst_nodata=0)
	valid = (dst > 0).all(0)
	out = (tone(dst) * 254 + 1).astype(np.uint8)  # 0 stays 'no data'
	with lock:
		view = rgb[r0:r1, c0:c1]
		m = valid
		view[m] = np.moveaxis(out, 0, -1)[m]
		with open(done_f, 'a') as f: f.write(tag + '\n')
north = sys.argv[1] if len(sys.argv) > 1 else '2020/6/12'
south = sys.argv[2] if len(sys.argv) > 2 else '2020/1/11'
jobs = [(north, z) for z in zones(north) if z[2] >= 'N'] + [(south, z) for z in zones(south) if z[2] < 'N']
print(len(jobs), 'zones', flush=True)
t = time.time(); n = 0
with cf.ThreadPoolExecutor(8) as ex:
	futs = {ex.submit(one, p, z): (p, z) for p, z in jobs}
	for f in cf.as_completed(futs):
		n += 1
		try: f.result()
		except Exception as e: print('FAIL', futs[f], e, flush=True)
		if n % 25 == 0: print(n, round(time.time() - t), flush=True)
rgb.flush()
print('done', round(time.time() - t))
