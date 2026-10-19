# Natural Earth 10m land (and minor islands) on the 1/180 degree grid, as land.npy (1 = land)
import numpy as np, shapefile
from rasterio.features import rasterize
from rasterio.transform import from_origin
H, W = 32400, 64800
geoms = []
for f in ('ne/ne_10m_land', 'ne/ne_10m_minor_islands'):
	for s in shapefile.Reader(f).shapes():
		g = s.__geo_interface__; b = s.bbox  # (w, s, e, n)
		geoms.append((g, b))
print(len(geoms))
out = np.lib.format.open_memmap('land.npy', mode='w+', dtype=np.uint8, shape=(H, W))
step = 1800
for r0 in range(0, H, step):
	n, s = 90 - r0 / 180, 90 - (r0 + step) / 180
	sel = [(g, 1) for g, b in geoms if b[3] >= s and b[1] <= n]
	if sel: out[r0:r0 + step] = rasterize(sel, out_shape=(step, W), transform=from_origin(-180, n, 1 / 180, 1 / 180), dtype=np.uint8, all_touched=False)
	print(r0, len(sel), flush=True)
out.flush()
