// The economy's reading of the streets by a building (economy/roadsat.js): sorted once per cell,
// it must give exactly what walking every street within reach gave, point for point; let its
// cells go when the city's own roads change; and ask the other sources afresh every time.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoadsAt, roadsAtOnce } from '../src/economy/roadsat.js';

function rng(seed) { let h = seed >>> 0; return () => { h = (Math.imul(h, 1664525) + 1013904223) >>> 0; return h / 4294967296; }; }
const CLS = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'residential', 'unclassified', 'living_street', 'service', 'footway', 'path'];
const NAMES = ['Market St', 'Pine St', 'Bush St', 'Battery St', 'Sansome St', ''];
function street(r, cls, x, z, n = 2 + Math.floor(r() * 6)) {
	const pts = new Float32Array(n * 2);
	let px = x, pz = z;
	for (let k = 0; k < n; k++) { pts[k * 2] = px; pts[k * 2 + 1] = pz; px += (r() - 0.5) * 220; pz += (r() - 0.5) * 220; }
	return { cls, name: NAMES[Math.floor(r() * NAMES.length)], w: 8, pts };
}
// a fake real city: its own roads (versioned) and the sources' (not), found by brute force
function city(seed, n = 400) {
	const r = rng(seed), own = [], extra = [];
	for (let k = 0; k < n; k++) own.push(street(r, CLS[Math.floor(r() * CLS.length)], r() * 3000 - 1500, r() * 3000 - 1500));
	for (let k = 0; k < 40; k++) extra.push(street(r, CLS[Math.floor(r() * 5)], r() * 3000 - 1500, r() * 3000 - 1500));
	// (a street with a point not a number, and one with no points at all)
	const odd = street(r, 'primary', 0, 0); odd.pts[3] = NaN; own.push(odd, { cls: 'primary', name: 'Nowhere' });
	const asked = { own: 0 };
	const box = (q) => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; const p = q.pts || []; for (let i = 0; i < p.length; i += 2) { a = Math.min(a, p[i]); c = Math.max(c, p[i]); b = Math.min(b, p[i + 1]); d = Math.max(d, p[i + 1]); } return [a, b, c, d]; };
	const within = (list, x, z, rad, out) => { for (const q of list) { const [a, b, c, d] = box(q); if (!q.pts || (c >= x - rad && a <= x + rad && d >= z - rad && b <= z + rad)) out.push(q); } return out; };
	const R = {
		v: 0, own, extra,
		roadVersion: () => R.v,
		nearOwn: (kind, x, z, rad) => { asked.own++; return kind === 'roads' ? within(own, x, z, rad, []) : []; },
		nearSources: (kind, x, z, rad, out = []) => (kind === 'roads' ? within(extra, x, z, rad, out) : out),
		near: (kind, x, z, rad) => R.nearSources(kind, x, z, rad, R.nearOwn(kind, x, z, rad)),
	};
	return { R, r, asked };
}

test('the cells give exactly what walking every street gave', () => {
	let busy = 0, corner = 0, highway = 0, n = 0;
	for (let seed = 1; seed <= 4; seed++) {
		const { R, r } = city(seed), at = createRoadsAt(R);
		for (let k = 0; k < 1500; k++) {
			// (points scattered, and clustered in a few cells as a block's buildings are)
			const x = k % 3 ? r() * 2400 - 1200 : 300 + r() * 40, z = k % 3 ? r() * 2400 - 1200 : -200 + r() * 40;
			const want = roadsAtOnce(R, x, z);
			assert.deepEqual(at(x, z), want, `${x}, ${z}`);
			busy += !!want.busy; corner += want.corner; highway += want.highway; n++;
		}
	}
	// (all three answers seen both ways)
	for (const c of [busy, corner, highway]) assert.ok(c > 50 && c < n - 50, `${busy} ${corner} ${highway} of ${n}`);
});

test('the cells are let go when the city\'s own roads change, and the sources are asked afresh', () => {
	const { R, asked } = city(7), at = createRoadsAt(R);
	const x = 120, z = 80;
	at(x, z); at(x + 3, z + 2);
	assert.equal(asked.own, 1);
	// a freeway laid by a source, with no word: found at once
	R.extra.push({ cls: 'motorway', name: 'I-80', w: 11, pts: new Float32Array([x - 500, z + 10, x + 500, z + 10]) });
	assert.equal(at(x, z).highway, true);
	assert.deepEqual(at(x, z), roadsAtOnce(R, x, z));
	// a street of the city's own, with the version moved on: the cell made again
	R.own.push({ cls: 'primary', name: 'New St', w: 9, pts: new Float32Array([x - 30, z - 5, x + 30, z - 5]) }, { cls: 'secondary', name: 'Old St', w: 9, pts: new Float32Array([x - 5, z - 30, x - 5, z + 30]) });
	R.v++;
	const was = asked.own, now = at(x, z);
	assert.equal(asked.own, was + 1);
	assert.deepEqual(now, roadsAtOnce(R, x, z));
	assert.equal(now.busy, 2);
	assert.equal(now.corner, true);
});

test('the cells kept are bounded', () => {
	const { R, asked } = city(11, 20), at = createRoadsAt(R);
	for (let k = 0; k < 5000; k++) at(k * 130, 0);
	const before = asked.own;
	// (past the bound the cells are let go: the first asked again)
	at(0, 0);
	assert.equal(asked.own, before + 1);
});
