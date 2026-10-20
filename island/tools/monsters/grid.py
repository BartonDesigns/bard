# A crop of a sheet with a labelled pixel grid over it, for reading joint positions by eye.
#   python grid.py <sheet.jpg> x0 y0 x1 y1 <out.jpg> [step]
import sys

import cv2

src, x0, y0, x1, y1, out = sys.argv[1], *map(int, sys.argv[2:6]), sys.argv[6]
step = int(sys.argv[7]) if len(sys.argv) > 7 else 50
img = cv2.imread(src)[y0:y1, x0:x1].copy()
h, w = img.shape[:2]
for x in range((x0 // step + 1) * step, x1, step):
	c = (0, 255, 255) if x % (step * 2) == 0 else (0, 160, 255)
	cv2.line(img, (x - x0, 0), (x - x0, h), c, 1)
	if x % (step * 2) == 0:
		cv2.putText(img, str(x), (x - x0 + 2, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
for y in range((y0 // step + 1) * step, y1, step):
	c = (255, 255, 0) if y % (step * 2) == 0 else (255, 160, 0)
	cv2.line(img, (0, y - y0), (w, y - y0), c, 1)
	if y % (step * 2) == 0:
		cv2.putText(img, str(y), (2, y - y0 - 3), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 0), 1)
cv2.imwrite(out, img)
