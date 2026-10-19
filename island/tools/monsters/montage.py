# Lay shots side by side (optionally after a crop of the sheet) into one image.
#   python montage.py <out.jpg> <height> img1 img2 ... (an arg "sheet:<file>:x0:y0:x1:y1" is a sheet crop)
import sys

import cv2
import numpy as np

out, H = sys.argv[1], int(sys.argv[2])
row = []
for a in sys.argv[3:]:
	if a.startswith('sheet:'):
		_, f, x0, y0, x1, y1 = a.split(':')
		im = cv2.imread(f)[int(y0):int(y1), int(x0):int(x1)]
	else:
		im = cv2.imread(a)
	s = H / im.shape[0]
	row.append(cv2.resize(im, (int(im.shape[1] * s), H), interpolation=cv2.INTER_AREA))
	row.append(np.full((H, 6, 3), 30, np.uint8))
cv2.imwrite(out, np.concatenate(row[:-1], 1), [cv2.IMWRITE_JPEG_QUALITY, 88])
