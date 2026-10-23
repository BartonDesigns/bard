// The suburbs' gas stations and corner stores (src/bay/siteplan.js): on a town of real-shaped
// streets, a station only where two arterials meet and a corner store only where a through
// street of houses meets one, each lot clear of every street and sidewalk, the houses it stands
// on taken off and its store put there as a shop, its drives reaching the kerb, its paving laid
// without asphalt over concrete; the same plan every time; none on a terrace's corner.
import test from 'node:test';
import assert from 'node:assert/strict';
import { planSites, planSitesSteps, LOTS, GROUND } from '../src/bay/siteplan.js';

const ART = new Set(['primary', 'secondary', 'tertiary']);
// a 1.6 km square of streets 200 m apart, every fourth an arterial (the middle ones secondary),
// each with a point at every crossing as the map's ways have; houses along every block's sides;
// a few short courts off the arterials
function suburb({ flat = false } = {}) {
	const roads = [], boxes = [], N = 9, G = 200;
	const along = (fix, ax) => { const p = [-40]; for (let k = 0; k < N; k++) p.push(k * G); p.push((N - 1) * G + 40); return Float32Array.from(p.flatMap((v) => (ax ? [fix, v] : [v, fix]))); };
	for (let i = 0; i < N; i++) {
		const art = i % 4 === 0, cls = art ? (i === 4 ? 'secondary' : 'tertiary') : 'residential', w = art ? 14 : 10;
		roads.push({ cls, w, name: `${i} Avenue`, walked: true, pts: along(i * G, true) });
		roads.push({ cls, w, name: `${i} Street`, walked: true, pts: along(i * G, false) });
	}
	// (the courts: 150 m stubs off the arterials, a house or two at their mouths)
	for (const [x, z] of [[100, 800], [900, 800], [1500, 800]]) roads.push({ cls: 'residential', w: 9, name: `${x} Court`, walked: true, pts: Float32Array.of(x, z, x, z + 150) });
	const house = (x, z, a) => { const b = { x, z, w: 12, d: 10, a, wallH: 3, roofH: flat ? 0 : 1.6, kind: 0, hip: 0, door: 0.5 }; b.grp = [b]; boxes.push(b); };
	for (let i = 0; i < N - 1; i++) for (let j = 0; j < N - 1; j++) {
		const X = i * G, Z = j * G;
		for (let k = 0; k < 8; k++) {
			house(X + 25 + k * 21, Z + 19, Math.PI); house(X + 25 + k * 21, Z + G - 19, 0);
			if (k > 0 && k < 7) { house(X + 19, Z + 25 + k * 21, Math.PI / 2); house(X + G - 19, Z + 25 + k * 21, -Math.PI / 2); }
		}
	}
	return { roads, boxes };
}
const frame = (L) => { const ca = Math.cos(L.a), sa = Math.sin(L.a); return { w: (lx, lz) => [L.x + ca * lx - sa * lz, L.z + sa * lx + ca * lz], l: (x, z) => { const dx = x - L.x, dz = z - L.z; return [ca * dx + sa * dz, -sa * dx + ca * dz]; } }; };
const segDist = (p, x, z) => { let best = 1e9; for (let i = 0; i + 3 < p.length; i += 2) { const ax = p[i], az = p[i + 1], dx = p[i + 2] - ax, dz = p[i + 3] - az, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)); best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t)); } return best; };
const plan = (opts) => { const T = suburb(opts); const S = planSites(T, { bounds: [-200, -200, 1800, 1800] }); return { T, S }; };

test('stations only where two arterials meet, corner stores only where a through street meets one', () => {
	const { T, S } = plan();
	const fuel = S.sites.filter((s) => s.kind === 'fuel'), corner = S.sites.filter((s) => s.kind === 'corner');
	assert.ok(fuel.length >= 1, 'a station: ' + fuel.length);
	assert.ok(corner.length >= 1, 'a corner store: ' + corner.length);
	for (const s of fuel) assert.ok(ART.has(s.roads.aCls) && ART.has(s.roads.bCls), s.id + ' ' + JSON.stringify(s.roads));
	for (const s of corner) {
		const res = ART.has(s.roads.aCls) ? s.roads.b : s.roads.a;
		assert.ok(ART.has(s.roads.aCls) !== ART.has(s.roads.bCls), s.id + ' one arterial');
		assert.ok(!/Court/.test(res), s.id + ' not on a court: ' + res);
		for (const f of fuel) assert.ok(Math.hypot(f.x - s.x, f.z - s.z) >= 400, s.id + ' far from ' + f.id);
	}
	// (and fewer than every corner: the occasional one)
	assert.ok(S.sites.length <= 12, 'only some corners: ' + S.sites.length);
	assert.ok(T.boxes.length > 1000);
});

test('a lot is clear of every street and its sidewalk, and of every house left standing', () => {
	const { T, S } = plan();
	for (const s of S.sites) {
		const F = frame(s);
		for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 1], [1, 0], [-1, 0], [0, -1], [0, 0]]) {
			const [x, z] = F.w(u * s.w / 2, v * s.d / 2);
			for (const r of T.roads) assert.ok(segDist(r.pts, x, z) >= r.w / 2 + 1.5, `${s.id} corner ${u},${v} on ${r.name}`);
		}
		for (const b of T.boxes) {
			if (b === s.store) continue;
			const [lx, lz] = F.l(b.x, b.z);
			assert.ok(Math.abs(lx) > s.w / 2 || Math.abs(lz) > s.d / 2, `${s.id}: a house left on the lot at ${b.x},${b.z}`);
		}
	}
});

test('its store is a shop on the lot, the houses it took are gone', () => {
	const T = suburb(), n0 = T.boxes.length, S = planSites(T, { bounds: [-200, -200, 1800, 1800] });
	const removed = S.sites.reduce((n, s) => n + s.removed, 0);
	assert.equal(T.boxes.length, n0 - removed + S.sites.length);
	for (const s of S.sites) {
		const b = s.store, L = LOTS[s.kind].store, [lx, lz] = frame(s).l(b.x, b.z);
		assert.ok(T.boxes.includes(b));
		assert.equal(b.kind, 6); assert.equal(b.store, s.kind); assert.ok(b.grp?.biz); assert.equal(b.site, s);
		assert.ok(Math.abs(lx - L.x * s.side) < 0.01 && Math.abs(lz - L.z) < 0.01, 'store where the layout puts it');
		assert.ok(s.homes >= 1 || s.kind === 'fuel');
		assert.ok(S.clear(s.x, s.z) && !S.clear(s.x + 60, s.z + 60));
	}
});

test('its drives reach the kerb, its paving keeps asphalt off the concrete, its cars stand on it', () => {
	const { T, S } = plan();
	for (const s of S.sites) {
		assert.ok(s.aprons.length >= 1, s.id + ' drives');
		for (const q of s.aprons) {
			const r = T.roads.filter((r) => r.name === s.roads.a || r.name === s.roads.b);
			assert.ok(r.some((r) => segDist(r.pts, q.bx, q.bz) <= r.w / 2 + 0.01), s.id + ' a drive short of the street');
			assert.ok(q.w >= 6 && q.made);
		}
		for (const [x, z] of s.cars) { const [lx, lz] = frame(s).l(x, z); assert.ok(Math.abs(lx) < s.w / 2 && Math.abs(lz) < s.d / 2, s.id + ' car off the lot'); }
		assert.equal(s.ground.length, GROUND[s.kind].length);
	}
	for (const kind of ['fuel', 'corner']) {
		const L = LOTS[kind], R = GROUND[kind];
		for (const [k, x0, z0, x1, z1] of R) assert.ok(x0 < x1 && z0 < z1 && x0 >= -L.w / 2 && x1 <= L.w / 2 && z0 >= -L.d / 2 && z1 <= L.d / 2, kind + ' paving off the lot');
		for (const A of R) for (const C of R) if (A[0] === 0 && C[0] === 1) assert.ok(A[3] <= C[1] || C[3] <= A[1] || A[4] <= C[2] || C[4] <= A[2], `${kind}: asphalt ${A} over concrete ${C}`);
	}
});

test('the same plan every time, a slice at a time or at once; none on a terrace corner', () => {
	const a = plan().S.sites.map((s) => s.id), T = suburb(), it = planSitesSteps(T, { bounds: [-200, -200, 1800, 1800], ms: 0 });
	let r, n = 0;
	for (r = it.next(); !r.done; r = it.next()) n++;
	assert.deepEqual(r.value.sites.map((s) => s.id), a);
	assert.ok(n > 10, 'sliced: ' + n);
	assert.equal(plan({ flat: true }).S.sites.length, 0);
});
