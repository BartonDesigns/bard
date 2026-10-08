#!/usr/bin/env python3
# Where the real city stands, for the ground: a mask over every mapped region (realtiles.js),
# 1 wherever a roof or a street lies within a cell or so, easing to 0 beyond. The engine's
# rills (earth/baydetail.js) keep off it, so the ground under and round the buildings is
# as level as the survey; it ships with the survey levels, so every device has it before a
# single building stands. Run after tools/bake-realcity.py:
#   python3 tools/bake-built.py   ->  assets/bayarea/built.png (and the numbers for terrain.js)
import glob, json, math, os
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REAL = os.path.join(HERE, '..', 'assets', 'bayarea', 'real')
OUT = os.path.join(HERE, '..', 'assets', 'bayarea', 'built.png')
LAT0, LON0, LON0_LEGACY = 37.76, -122.57, -122.78
KX = 111320 * math.cos(LAT0 * math.pi / 180)
CELL = 48

maps = []
for f in sorted(glob.glob(os.path.join(REAL, '*.json')) + glob.glob(os.path.join(REAL, 't', '*.json'))):
	png = f[:-5] + '.png'
	if not os.path.exists(png):
		continue
	H = json.load(open(f))
	M = H['map']
	shift = ((H['geo'][1] if H.get('geo') else LON0_LEGACY) - LON0) * KX
	x0 = M.get('x0', H['bounds'][0]) + shift
	z0 = M.get('z0', H['bounds'][1])
	maps.append((x0, z0, M['step'], png))

X0 = math.floor(min(m[0] for m in maps) / CELL) * CELL - 2 * CELL
Z0 = math.floor(min(m[1] for m in maps) / CELL) * CELL - 2 * CELL
X1 = max(m[0] + Image.open(m[3]).size[0] * m[2] for m in maps) + 2 * CELL
Z1 = max(m[1] + Image.open(m[3]).size[1] * m[2] for m in maps) + 2 * CELL
W, Hh = int(math.ceil((X1 - X0) / CELL)), int(math.ceil((Z1 - Z0) / CELL))
grid = np.zeros((Hh, W), np.uint8)

for x0, z0, step, png in maps:
	px = np.asarray(Image.open(png).convert('RGBA'))
	# (R: street cover, B: roof cover, A: mapped)
	built = (px[:, :, 3] > 0) & ((px[:, :, 2] > 24) | (px[:, :, 0] > 128))
	jj, ii = np.nonzero(built)
	if not len(ii):
		continue
	gi = ((x0 + (ii + 0.5) * step - X0) // CELL).astype(int)
	gj = ((z0 + (jj + 0.5) * step - Z0) // CELL).astype(int)
	grid[gj, gi] = 1

# a cell's reach either side, then eased out over the next
g = grid.astype(np.float32)
d = g.copy()
for dj in (-1, 0, 1):
	for di in (-1, 0, 1):
		d = np.maximum(d, np.roll(np.roll(g, dj, 0), di, 1))
s = np.zeros_like(d)
for dj in (-1, 0, 1):
	for di in (-1, 0, 1):
		s += np.roll(np.roll(d, dj, 0), di, 1)
v = np.maximum(d, s / 9)
Image.fromarray(np.clip(v * 255 + 0.5, 0, 255).astype(np.uint8), 'L').save(OUT, optimize=True)
print(f'built.png {W} x {Hh}, cell {CELL} m, x0 {X0}, zN {Z0}, {os.path.getsize(OUT)} bytes, {int(grid.sum())} cells built')
