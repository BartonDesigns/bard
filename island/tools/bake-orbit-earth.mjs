// A small orbital map from the same elevation, land and climate cells as the walkable
// globe. Broad climate fields are filtered so authored regional borders never become
// visible stripes in space. No additional provider, download or runtime dependency.
import fs from 'node:fs';
import { PNG } from 'pngjs';

const root = new URL('../assets/', import.meta.url), n = 120, width = n * 12, height = n * 6;
const map = new PNG({ width, height });
const land = new Float32Array(width * height), elevation = land.slice(), rain = land.slice(), temperature = land.slice();
for (let row = 0; row < 6; row++) for (let col = 0; col < 12; col++) {
	const tile = PNG.sync.read(fs.readFileSync(new URL(`globe/g${row}-${col}.png`, root)));
	for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
		const q = (Math.floor((y + .5) * 300 / n) * 300 + Math.floor((x + .5) * 300 / n)) * 4;
		const k = (row * n + y) * width + col * n + x, climate = q + 300 * 300 * 4 * 6;
		land[k] = tile.data[q + 2] / 255;
		elevation[k] = Math.max(0, (tile.data[q] * 256 + tile.data[q + 1]) / 2 - 11000);
		temperature[k] = tile.data[climate] / 4 - 30;
		rain[k] = (tile.data[climate + 1] / 4) ** 2;
	}
}
function soften(src, radius) {
	const out = src.slice(), tmp = src.slice(), span = radius * 2 + 1;
	for (let y = 0; y < height; y++) {
		let sum = 0;
		for (let d = -radius; d <= radius; d++) sum += src[y * width + (d + width) % width];
		for (let x = 0; x < width; x++) {
			tmp[y * width + x] = sum / span;
			sum += src[y * width + (x + radius + 1) % width] - src[y * width + (x - radius + width) % width];
		}
	}
	for (let x = 0; x < width; x++) {
		let sum = 0;
		for (let d = -radius; d <= radius; d++) sum += tmp[Math.max(0, d) * width + x];
		for (let y = 0; y < height; y++) {
			out[y * width + x] = sum / span;
			sum += tmp[Math.min(height - 1, y + radius + 1) * width + x] - tmp[Math.max(0, y - radius) * width + x];
		}
	}
	return out;
}
const wet = soften(soften(rain, 10), 10), temp = soften(temperature, 10);
const clamp = x => Math.max(0, Math.min(1, x));
for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
	const k = y * width + x, lat = Math.abs(90 - y / height * 180);
	const dry = clamp((850 - wet[k]) / 850), mountain = clamp((elevation[k] - 1400) / 3600);
	const snow = clamp((lat - 68) / 15 + (elevation[k] - 3200) / 3800 + Math.max(0, -temp[k] - 5) / 35);
	for (let c = 0; c < 3; c++) {
		let color = [72, 96, 55][c] * (1 - dry) + [168, 150, 109][c] * dry;
		color = color * (1 - mountain * .65) + [126, 122, 110][c] * mountain * .65;
		color = color * (1 - snow) + [216, 228, 235][c] * snow;
		map.data[k * 4 + c] = Math.round([16, 42, 67][c] * (1 - land[k]) + color * land[k]);
	}
	map.data[k * 4 + 3] = Math.round(land[k] * 255);
}
const file = new URL('orbit-earth.png', root);
fs.writeFileSync(file, PNG.sync.write(map));
console.log(`Orbital Earth: ${width} × ${height}, ${fs.statSync(file).size} bytes`);
