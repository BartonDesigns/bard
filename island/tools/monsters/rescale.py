# A sheet whose side and back views are drawn smaller than its front: everything right of x0
# scaled by k about (x0, ground), so all views share one scale (build.py assumes it).
#   python rescale.py <sheet.jpg> <out.jpg> x0 k ground
import sys

import cv2
import numpy as np

src, out = sys.argv[1], sys.argv[2]
x0, k, g = int(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
img = cv2.imread(src)
h, w = img.shape[:2]
right = img[:, x0:]
W = int(round((w - x0) * k))
# the card's grey, from the sheet's top corners, under what scaling leaves uncovered
card = np.median(np.concatenate([img[:20, x0:x0 + 40].reshape(-1, 3), img[:20, -40:].reshape(-1, 3)]), 0)
M = np.float32([[k, 0, 0], [0, k, g - g * k]])
big = cv2.warpAffine(right, M, (W, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_CONSTANT, borderValue=card.tolist())
cv2.imwrite(out, np.hstack([img[:, :x0], big]), [cv2.IMWRITE_JPEG_QUALITY, 92])
