#!/usr/bin/env python3
"""The trailer's type, drawn with Pillow (no browser needed).

Draws the opening title (transparent, laid over the first shot), a place caption per shot
(transparent, lower left; the words come from CAPTIONS in shots.mjs) and the end card
(opaque), as PNGs at the trailer's size.

    python3 trailer/cards.py [--w 1920] [--h 1080] [--out /tmp/claude-0/trailer/cards]
"""
import argparse
import json
import os
import subprocess

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument('--w', type=int, default=1920)
ap.add_argument('--h', type=int, default=1080)
ap.add_argument('--out', default='/tmp/claude-0/trailer/cards')
A = ap.parse_args()
W, H, S = A.w, A.h, A.h / 1080
os.makedirs(A.out, exist_ok=True)

FONTS = '/usr/share/fonts/truetype/'
SERIF_B = [FONTS + 'liberation/LiberationSerif-Bold.ttf', FONTS + 'dejavu/DejaVuSerif-Bold.ttf']
SERIF = [FONTS + 'liberation/LiberationSerif-Regular.ttf', FONTS + 'dejavu/DejaVuSerif.ttf']
SANS = [FONTS + 'liberation/LiberationSans-Regular.ttf', FONTS + 'dejavu/DejaVuSans.ttf']


def font(paths, size):
	for p in paths:
		if os.path.exists(p):
			return ImageFont.truetype(p, round(size * S))
	return ImageFont.load_default()


def spaced(draw, xy, text, f, fill, track, anchor='m'):
	"""Letter-spaced text; anchor 'm' centres the line on x, 'l' starts it there."""
	x, y = xy
	ws = [draw.textlength(c, font=f) for c in text]
	total = sum(ws) + track * S * (len(text) - 1)
	if anchor == 'm':
		x -= total / 2
	for c, w in zip(text, ws):
		draw.text((x, y), c, font=f, fill=fill, anchor='ls')
		x += w + track * S


def layer():
	return Image.new('RGBA', (W, H), (0, 0, 0, 0))


def shadowed(text_layer, blur=14, alpha=150):
	"""A soft dark halo under the type, so it reads over any shot."""
	a = text_layer.split()[3]
	sh = Image.new('RGBA', (W, H), (0, 0, 0, 0))
	sh.putalpha(a.filter(ImageFilter.GaussianBlur(blur * S)).point(lambda v: min(255, v * alpha // 100)))
	return Image.alpha_composite(sh, text_layer)


def rule(draw, cx, y, width, color, thick=1.5):
	"""A hairline that fades out at both ends."""
	for i in range(int(width * S)):
		k = i / (width * S)
		a = int(255 * (1 - abs(k - 0.5) * 2) ** 0.7)
		x = cx - width * S / 2 + i
		draw.line([(x, y), (x, y + max(1, thick * S) - 1)], fill=color + (a,))


def title():
	t = layer()
	d = ImageDraw.Draw(t)
	spaced(d, (W / 2, H / 2 + 20 * S), 'LEVEL 99 BARD', font(SERIF_B, 124), (255, 248, 236, 255), 34)
	rule(d, W / 2, H / 2 + 62 * S, 380, (255, 226, 176))
	spaced(d, (W / 2, H / 2 + 118 * S), 'AN INSTRUMENT THE SIZE OF A WORLD', font(SERIF, 30), (255, 233, 201, 255), 12)
	# a gentle darkening behind the words
	v = layer()
	vd = ImageDraw.Draw(v)
	vd.ellipse([W * 0.2, H * 0.3, W * 0.8, H * 0.72], fill=(0, 0, 0, 90))
	v = v.filter(ImageFilter.GaussianBlur(120 * S))
	return Image.alpha_composite(v, shadowed(t, 16, 170))


def end():
	bg = Image.new('RGBA', (W, H), (5, 6, 8, 255))
	glow = layer()
	gd = ImageDraw.Draw(glow)
	gd.ellipse([W * 0.12, H * 0.05, W * 0.88, H * 0.9], fill=(29, 36, 51, 255))
	bg = Image.alpha_composite(bg, glow.filter(ImageFilter.GaussianBlur(200 * S)))
	d = ImageDraw.Draw(bg)
	spaced(d, (W / 2, H / 2 - 10 * S), 'LEVEL 99 BARD', font(SERIF_B, 132), (255, 244, 224, 255), 37)
	rule(d, W / 2, H / 2 + 36 * S, 440, (232, 184, 106))
	spaced(d, (W / 2, H / 2 + 104 * S), 'level99bard.com', font(SANS, 40), (232, 184, 106, 255), 6)
	spaced(d, (W / 2, H / 2 + 160 * S), 'PLAY IN YOUR BROWSER', font(SANS, 22), (154, 163, 181, 255), 9)
	return bg


def caption(a, b):
	t = layer()
	d = ImageDraw.Draw(t)
	x, y = 96 * S, H - 150 * S
	spaced(d, (x, y), a, font(SERIF, 46), (255, 248, 236, 255), 3.5, 'l')
	d.rectangle([x, y + 18 * S, x + 64 * S, y + 20 * S], fill=(232, 184, 106, 255))
	if b:
		spaced(d, (x, y + 58 * S), b.upper(), font(SANS, 22), (255, 233, 201, 255), 5, 'l')
	return shadowed(t, 10, 160)


caps = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', "import { CAPTIONS } from './shots.mjs'; console.log(JSON.stringify(CAPTIONS));"], cwd=HERE))
title().save(os.path.join(A.out, 'title.png'))
end().convert('RGB').save(os.path.join(A.out, 'end.png'))
for sid, (a, b) in caps.items():
	caption(a, b).save(os.path.join(A.out, f'cap-{sid}.png'))
print('cards:', A.out, ', '.join(['title', 'end'] + list(caps)))
