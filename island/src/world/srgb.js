// An sRGB colour ([r, g, b], 0 to 1) in the linear space the renderer lights in, as a new array
// each time (callers may change it).

import * as THREE from 'three';

export const srgbToLinear = (c) => { const k = new THREE.Color().setRGB(c[0], c[1], c[2], THREE.SRGBColorSpace); return [k.r, k.g, k.b]; };
