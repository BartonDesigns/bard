// Plans the real houses round a place and prints their floors as text:
//   node tools/houseplan-test.mjs 37.7700 -121.9380 [radius] [count]
import fs from 'fs';
import zlib from 'zlib';
import { planHouse, groupBoxes, mainOf } from '../src/bay/houseplan.js';

const H = JSON.parse(fs.readFileSync(new URL('../assets/bayarea/real/eastbay.json', import.meta.url)));
const bin = zlib.gunzipSync(fs.readFileSync(new URL('../assets/bayarea/real/eastbay.bin.gz', import.meta.url)));
const dv = new DataView(bin.buffer, bin.byteOffset, bin.byteLength);
const LAT0 = 37.76, LON0 = -122.57, KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110996;
const OX = H.origin[0] + ((H.geo ? H.geo[1] : -122.78) - LON0) * KX, OZ = H.origin[1], U = H.unit;
const [lat, lon, rad = 60, count = 3] = process.argv.slice(2).map(Number);
const cx = (lon - LON0) * KX, cz = -(lat - LAT0) * KZ;
const boxes = [];
let o = H.sections.boxes[0];
for (let n = 0; n < H.sections.boxes[1]; n++, o += 18) {
	const kh = dv.getInt16(o + 14, true);
	boxes.push({ x: dv.getInt16(o, true) * U + OX, z: dv.getInt16(o + 2, true) * U + OZ, w: dv.getInt16(o + 4, true) / 20, d: dv.getInt16(o + 6, true) / 20, a: dv.getInt16(o + 8, true) / 1e4, wallH: dv.getInt16(o + 10, true) / 20, roofH: dv.getInt16(o + 12, true) / 20, kind: kh & 255, hip: kh >> 8, door: dv.getInt16(o + 16, true) / 1000 });
}
groupBoxes(boxes);
const seen = new Set(), plans = [];
let t0 = performance.now(), n = 0;
for (const b of boxes) {
	if (!b.grp || seen.has(b.grp) || Math.hypot(b.x - cx, b.z - cz) > rad) continue;
	seen.add(b.grp);
	if (!mainOf(b.grp)) continue;
	const p = planHouse(b.grp);
	n++;
	if (p) plans.push(p);
}
console.log(n, 'houses planned in', (performance.now() - t0).toFixed(0), 'ms');
const CH = { garage: 'G', entry: 'E', hall: 'H', living: 'L', dining: 'D', kitchen: 'K', family: 'F', powder: 'p', laundry: 'u', master: 'M', bed: 'B', bath: 'b', mbath: 'm', closet: 'c', office: 'O', loft: 'l' };
for (const p of plans.slice(0, count)) {
	console.log('\nhouse', p.M.x.toFixed(1), p.M.z.toFixed(1), 'kind', p.M.kind, 'blocks', p.rects.length, 'stairs', !!p.stairs, 'rooms', p.rooms.filter((r) => r.cells.length).map((r) => r.type + r.level + ':' + r.area.toFixed(1)).join(' '));
	console.log('doors', p.conns.filter((c) => c.kind !== 'open').map((c) => p.rooms[c.a].type + '-' + p.rooms[c.b].type + ':' + c.kind + (c.wall ? '' : '(no wall!)')).join(' '));
	console.log('items', p.items.map((i) => i.type).join(' '));
	for (const L of [0, 1]) {
		if (L && !p.up) continue;
		console.log('level', L, '(front at the bottom)');
		// half-metre raster, front (+z) at the bottom
		const x0 = p.X[0], x1 = p.X[p.nx], z0 = p.Z[0], z1 = p.Z[p.nz];
		for (let z = z0 + 0.25; z < z1; z += 0.5) {
			let row = '';
			for (let x = x0 + 0.25; x < x1; x += 0.5) {
				const c = p.cellAt(x, z), id = c >= 0 ? p.labels[L][c] : -1;
				let ch = id >= 0 ? CH[p.rooms[id].type] : ' ';
				if (p.stairs && x > p.stairs.x0 && x < p.stairs.x1 && z < p.stairs.zb && z > p.stairs.zt) ch = L ? '#' : '=';
				if (Math.abs(z - p.door.z) < 0.3 && Math.abs(x - p.door.x) < 0.5) ch = '^';
				row += ch;
			}
			console.log('   ' + row);
		}
	}
}
