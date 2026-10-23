# Measures each brand mark on its emblem sheet (island/assets/signage/brands-<family>-v1-mobile.webp,
# 4 x 2 cells) and writes island/src/signage/brand-marks.js: where in its cell the mark's ink is
# (so a packet can fit the mark itself, not its empty square) and its two main inks (so the
# packet can be printed in its maker's colours).
#
#   python3 island/tools/bake-brand-marks.py
import json, os
from collections import Counter
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets', 'signage')
OUT = os.path.join(HERE, '..', 'src', 'signage', 'brand-marks.js')

def families():
    src = open(os.path.join(HERE, '..', 'src', 'signage', 'brand-catalog.js')).read()
    start = src.index('BRAND_COLLECTIONS = Object.freeze(') + len('BRAND_COLLECTIONS = Object.freeze(')
    end = src.index('});', start) + 1
    return list(json.loads(src[start:end]).keys())

def hexc(c):
    return '#%02x%02x%02x' % c

def measure(img, cx, cy, cw, ch):
    cell = img.crop((cx, cy, cx + cw, cy + ch))
    a = cell.getchannel('A')
    box = a.point(lambda v: 255 if v > 48 else 0).getbbox() or (0, 0, cw, ch)
    inks = Counter()
    for (r, g, b, al) in cell.getdata():
        if al > 230:
            inks[(r >> 4, g >> 4, b >> 4)] += 1
    top = inks.most_common()
    main = top[0][0] if top else (2, 2, 2)
    second = main
    for q, n in top[1:]:
        if n < top[0][1] * 0.08:
            break
        if sum(abs(q[i] - main[i]) for i in range(3)) > 9:
            second = q
            break
    to = lambda q: tuple(min(255, v * 16 + 8) for v in q)
    return [round(box[0] / cw, 3), round(box[1] / ch, 3), round(box[2] / cw, 3), round(box[3] / ch, 3), hexc(to(main)), hexc(to(second))]

rows = []
for fam in families():
    img = Image.open(os.path.join(ASSETS, 'brands-%s-v1-mobile.webp' % fam)).convert('RGBA')
    cw, ch = img.width // 4, img.height // 2
    marks = [measure(img, (i % 4) * cw, (i // 4) * ch, cw, ch) for i in range(8)]
    rows.append('\t%s: [%s],' % (json.dumps(fam), ', '.join(json.dumps(m, separators=(',', ':')) for m in marks)))

with open(OUT, 'w') as f:
    f.write('// Where each brand mark\'s ink is in its cell of its family\'s emblem sheet (4 x 2 cells), as\n')
    f.write('// fractions of the cell [x0, y0, x1, y1], and its two main inks. Measured from the sheets by\n')
    f.write('// tools/bake-brand-marks.py (run it again when a sheet changes).\n')
    f.write('export const BRAND_MARKS = Object.freeze({\n')
    f.write('\n'.join(rows) + '\n')
    f.write('});\n')
    f.write('// a mark: { x0, y0, x1, y1, ink, ink2 }, or null\n')
    f.write('export function brandMark(family, i) {\n')
    f.write('\tconst m = BRAND_MARKS[String(family).replace(/^brands-/, \'\')]?.[i];\n')
    f.write('\treturn m ? { x0: m[0], y0: m[1], x1: m[2], y1: m[3], ink: m[4], ink2: m[5] } : null;\n')
    f.write('}\n')
print('wrote', OUT, len(rows), 'families')
