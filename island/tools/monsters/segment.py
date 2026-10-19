# Cut a concept sheet into what is creature and what is the grey card behind it.
#
# The sheets are painted on a flat (slightly graded) grey. A pixel is card when it sits close to
# a smooth model of the card's colour (a low-order fit to the sheet's border) and is joined to
# the outside through other card pixels: the painted outlines stop the fill, so a grey creature
# on a grey card still comes out whole. Small specks and holes are cleaned away.
#
#   python segment.py <sheet.jpg> <out-prefix>   -> <prefix>-mask.png, <prefix>-boxes.json, <prefix>-debug.jpg

import json
import sys

import cv2
import numpy as np


def card_model(img, band=None):
	h, w = img.shape[:2]
	ys, xs = np.mgrid[0:h, 0:w]
	if band is None:
		band = np.zeros((h, w), bool)
		b = 12
		band[:b] = band[-b:] = True
		band[:, :b] = band[:, -b:] = True
	sub = max(1, int(band.sum() // 200000))
	band = band & ((xs + ys) % sub == 0)
	bx, by = xs[band] / w, ys[band] / h
	X = np.stack([np.ones(band.sum()), bx, by, bx ** 2, by ** 2, bx * by], 1)
	full = np.stack([np.ones(h * w), xs.ravel() / w, ys.ravel() / h, (xs.ravel() / w) ** 2, (ys.ravel() / h) ** 2, (xs * ys).ravel() / (w * h)], 1)
	vals = img[band].astype(np.float32)
	keep = np.ones(len(vals), bool)
	# a trimmed fit: whatever on the band is not card (a foot, a floor line) is dropped and fitted again
	for _ in range(4):
		coef, *_ = np.linalg.lstsq(X[keep], vals[keep], rcond=None)
		res = np.abs(X @ coef - vals).max(1)
		lim = max(4.0, float(np.percentile(res[keep], 75)) * 2.0)
		keep = res < lim
	out = (full @ coef).reshape(h, w, 3).astype(np.float32)
	return out


def segment(img, tol=14.0, grad_tol=10.0, refit=2, big=0.004):
	f = img.astype(np.float32)
	lap = cv2.GaussianBlur(f, (0, 0), 1.2)
	gx = cv2.Sobel(lap, cv2.CV_32F, 1, 0)
	gy = cv2.Sobel(lap, cv2.CV_32F, 0, 1)
	g = np.sqrt((gx ** 2 + gy ** 2).sum(-1)) / 8
	bg = card_model(img)
	for it in range(refit + 1):
		d = np.sqrt(((f - bg) ** 2).sum(-1))
		cardlike = (d < tol) & (g < grad_tol)
		if it < refit:
			# fit the card again to everything that now reads as card (it may be graded)
			bg = card_model(img, cv2.erode(cardlike.astype(np.uint8), np.ones((5, 5), np.uint8)) > 0)
	cardlike = cv2.morphologyEx(cardlike.astype(np.uint8), cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
	# the card is what is card-like and connected to the border
	# (or a big patch of it shut in by a floor line between the legs)
	n, lab, st, _ = cv2.connectedComponentsWithStats(cardlike, connectivity=4)
	border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
	border |= {i for i in range(1, n) if st[i, 4] > cardlike.size * big}
	card = np.isin(lab, list(border))
	fg = (~card).astype(np.uint8)
	fg = cv2.morphologyEx(fg, cv2.MORPH_CLOSE, np.ones((5, 5), np.uint8))
	fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
	# fill the small holes (specks of card-like paint inside the body); a big enclosed patch of
	# card (between an arm, a leg and a floor line) stays card
	inv = (1 - fg).astype(np.uint8)
	n, lab, st, _ = cv2.connectedComponentsWithStats(inv, connectivity=4)
	small = [i for i in range(1, n) if st[i, 4] < inv.size * 0.0015]
	fg[np.isin(lab, small)] = 1
	return fg


def segment_box(img, lo=3.0):
	"""the creature inside one view's box: what a smooth fill from the box's edge cannot reach
	(the card may be graded or panelled; the fill follows it pixel to pixel and stops at the
	painted outline)"""
	h, w = img.shape[:2]
	sm = cv2.GaussianBlur(img, (0, 0), 1.0)
	ff = np.zeros((h + 2, w + 2), np.uint8)
	flags = 4 | cv2.FLOODFILL_MASK_ONLY | (255 << 8)
	seeds = [(x, 0) for x in range(0, w, 7)] + [(x, h - 1) for x in range(0, w, 7)] + [(0, y) for y in range(0, h, 7)] + [(w - 1, y) for y in range(0, h, 7)]
	for x, y in seeds:
		if ff[y + 1, x + 1]:
			continue
		cv2.floodFill(sm, ff, (x, y), 0, (lo,) * 3, (lo,) * 3, flags)
	fg = (ff[1:-1, 1:-1] == 0).astype(np.uint8)
	fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
	inv = (1 - fg).astype(np.uint8)
	n, lab = cv2.connectedComponents(inv, connectivity=4)
	border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]])))
	fg[~np.isin(lab, list(border)) & (inv > 0)] = 1
	return fg


def boxes(fg, min_area=1500):
	n, lab, stats, cent = cv2.connectedComponentsWithStats(fg, connectivity=8)
	out = []
	for i in range(1, n):
		x, y, w, h, a = stats[i]
		if a >= min_area:
			out.append({'id': int(i), 'box': [int(x), int(y), int(x + w), int(y + h)], 'area': int(a)})
	out.sort(key=lambda b: (b['box'][1] // 300, b['box'][0]))
	return out, lab


if __name__ == '__main__':
	src, pre = sys.argv[1], sys.argv[2]
	img = cv2.imread(src)
	fg = segment(img)
	bx, lab = boxes(fg)
	cv2.imwrite(pre + '-mask.png', fg * 255)
	json.dump(bx, open(pre + '-boxes.json', 'w'), indent=1)
	dbg = img.copy()
	dbg[fg == 0] = (dbg[fg == 0] * 0.35).astype(np.uint8)
	for b in bx:
		x0, y0, x1, y1 = b['box']
		cv2.rectangle(dbg, (x0, y0), (x1, y1), (0, 255, 255), 3)
		cv2.putText(dbg, str(b['id']), (x0 + 6, y0 + 40), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 255, 255), 3)
	cv2.imwrite(pre + '-debug.jpg', cv2.resize(dbg, (dbg.shape[1] // 2, dbg.shape[0] // 2)))
	print(len(bx), 'parts')
