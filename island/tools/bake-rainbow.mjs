// Bakes the rainbow table (src/world/rainbow.js) into assets/rainbow.png: angle across
// (25-60 degrees from the antisolar point), drop size down, sqrt-encoded linear RGB,
// scaled so the brightest value is 1. node tools/bake-rainbow.mjs
import fs from 'fs';
import { PNG } from 'pngjs';
import { bowTable, BOW } from '../src/world/rainbow.js';
const rows = bowTable(), W = BOW.W, H = rows.length;
let mx = 0;
for (const r of rows) for (const v of r) mx = Math.max(mx, v);
const png = new PNG({ width: W, height: H });
rows.forEach((r, y) => { for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; for (let j = 0; j < 3; j++) png.data[i + j] = Math.round(Math.sqrt(r[x * 3 + j] / mx) * 255); png.data[i + 3] = 255; } });
fs.writeFileSync(new URL('../assets/rainbow.png', import.meta.url), PNG.sync.write(png));
console.log('rainbow.png', W, 'x', H, 'max', mx.toFixed(3), '(the shader multiplies back by this)');
