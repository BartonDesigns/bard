// What is built for the heroes (people/garment.js trouserHull, people/garment-kit.js boots, a
// belt, cargo pockets, a compact carrier): pure geometry over a body's points.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { trouserHull } from '../src/people/garment.js';
import { bootGeometry, beltGeometry, cargoPocketGeometry, carrierGeometry } from '../src/people/garment-kit.js';

// a leg as rings of points: radius r(y, angle), centred at x = cx
function legPoints(cx, r, { y0 = 0.1, y1 = 0.9, rings = 81, around = 48 } = {}) {
	const pts = [];
	for (let j = 0; j < rings; j++) { const y = y0 + (y1 - y0) * j / (rings - 1); for (let i = 0; i < around; i++) { const a = i / around * 2 * Math.PI; const rr = r(y, a); pts.push([cx + Math.cos(a) * rr, y, Math.sin(a) * rr]); } }
	return pts;
}
const attr = (pts) => ({ count: pts.length, getX: (i) => pts[i][0], getY: (i) => pts[i][1], getZ: (i) => pts[i][2] });

test('trousers are laid over the leg: hollows bridged, hung from above, tapering, never past the middle', () => {
	// a leg 9 cm round at the thigh narrowing to 4 at the ankle, with a hollow behind the knee
	const knee = 0.5, r = (y, a) => 0.04 + 0.05 * Math.max(0, (y - 0.1) / 0.8) - (Math.abs(y - knee) < 0.04 && Math.sin(a) < -0.6 ? 0.015 : 0);
	const L = legPoints(0.1, r), R = legPoints(-0.1, r), pts = [...L, ...R];
	const SL = pts.map(() => 22), src = pts.map((_, i) => i);
	const cut = { hip: 0.98, knee };
	const K = trouserHull(attr(pts), SL, src, cut, { taper: 0.05, ease: 0.004, knee: 0 });
	const at = (y, a) => { let best = 0, bd = 1e9; L.forEach((p, i) => { const d = Math.abs(p[1] - y) * 10 + Math.abs(Math.atan2(p[2], p[0] - 0.1) - a); if (d < bd) { bd = d; best = i; } }); return K[best]; };
	// (the hollow behind the knee is bridged: much more room there than beside it)
	assert.ok(at(knee, -Math.PI / 2) > at(knee, 0) + 0.008, 'the back of the knee bridged');
	// (hung from above: at the ankle the cloth stands off further than the leg's own narrowing gives)
	assert.ok(at(0.12, 0) > 0.004 + 0.005, 'hung from the calf, tapering');
	assert.ok(at(0.85, 0) < 0.008, 'close at the thigh');
	// (never past the body's middle: the inner side of each leg held off x = 0)
	L.forEach((p, i) => { if (p[0] < 0.1 && p[1] > 0.8) assert.ok(p[0] - K[i] > -0.001, 'not past the middle'); });
});

test('a boot is built over the foot: a lofted upper with its toe box, sole, panels, tongue, laces, collar', () => {
	// a synthetic foot (an ellipse, the instep rising to the back) and a shin above it
	const foot = [], shin = [];
	for (let i = 0; i < 400; i++) { const a = i / 400 * 2 * Math.PI, z = Math.sin(a) * 0.13, x = 0.1 + Math.cos(a) * 0.045 * (1 - 0.3 * (z < -0.06)); for (const y of [0.005, 0.03, 0.06]) foot.push(x, y + (y > 0.05 && z < 0 ? -z * 0.4 : 0), z); }
	for (let j = 0; j < 30; j++) for (let i = 0; i < 24; i++) { const a = i / 24 * 2 * Math.PI, y = 0.08 + j * 0.01; shin.push(0.1 + Math.cos(a) * 0.04, y, -0.04 + Math.sin(a) * 0.045); }
	const parts = bootGeometry(foot, shin, { top: 0.25, ankle: 0.09, off: 0.02 });
	const kinds = new Set(parts.map((p) => p.part));
	for (const k of ['upper', 'cap', 'counter', 'sole', 'mid', 'tongue', 'lace', 'eyelet', 'collar']) assert.ok(kinds.has(k), k);
	const box = (k) => { const g = parts.find((p) => p.part === k).geo; g.computeBoundingBox(); return g.boundingBox; };
	const sole = box('sole'), upper = box('upper');
	assert.ok(sole.min.y >= 0 && sole.max.y < 0.03, 'the sole on the ground, its heel the tallest');
	assert.ok(sole.max.z - sole.min.z > 0.27, 'longer than the foot');
	assert.ok(upper.min.y > 0.01 && upper.max.y > 0.249 && upper.max.y < 0.26, 'the upper from the sole to the top of the shaft');
	assert.ok(upper.max.z > 0.13 + 0.015, 'round the toes, standing off them');
	// (the toe box: the upper over the forefoot stands at its own height, well above the toes')
	const g = parts.find((p) => p.part === 'upper').geo, P = g.attributes.position;
	let toeTop = 0;
	for (let i = 0; i < P.count; i++) if (P.getZ(i) > 0.06 && P.getZ(i) < 0.1) toeTop = Math.max(toeTop, P.getY(i));
	assert.ok(toeTop > 0.05, 'a toe box, not toes in a sock: ' + toeTop.toFixed(3));
	assert.ok(parts.filter((p) => p.part === 'lace').length >= 8, 'laced up');
	// (the laces lie on the upper's front, not off it)
	const lace = parts.filter((p) => p.part === 'lace').map((p) => { p.geo.computeBoundingBox(); return p.geo.boundingBox; });
	const I = g.index.array, tri = new THREE.Triangle(), q = new THREE.Vector3(), v = (i) => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i));
	for (const b of lace) {
		const c = new THREE.Vector3((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
		let d = Infinity;
		for (let t = 0; t < I.length; t += 3) { tri.set(v(I[t]), v(I[t + 1]), v(I[t + 2])); d = Math.min(d, tri.closestPointToPoint(c, q).distanceTo(c)); }
		assert.ok(d < 0.01, 'a lace on the upper: ' + d.toFixed(3));
	}
});

test('a belt goes round the waistband with its loops and a buckle; pockets sit on the outer thighs', () => {
	const field = { front: () => 0.12, back: () => -0.1, half: () => 0.16 };
	const belt = beltGeometry({ waist: 1.0 }, field, { y: 1.0 });
	assert.equal(belt.filter((p) => p.part === 'loop').length, 5);
	assert.equal(belt.filter((p) => p.part === 'buckle').length, 1);
	const b = belt.find((p) => p.part === 'buckle').geo; b.computeBoundingBox();
	assert.ok(b.boundingBox.min.z > 0.12, 'the buckle in front, outside the waistband');
	const thigh = [];
	for (let j = 0; j < 40; j++) for (let i = 0; i < 40; i++) { const a = i / 40 * 2 * Math.PI, y = 0.5 + j * 0.01; thigh.push(0.1 + Math.cos(a) * 0.08, y, Math.sin(a) * 0.08); }
	const P = cargoPocketGeometry(thigh, 1, { y: 0.7 });
	assert.deepEqual(P.map((p) => p.part).sort(), ['flap', 'pocket']);
	const g = P[0].geo; g.computeBoundingBox();
	assert.ok(g.boundingBox.min.x > 0.1 + 0.08 * 0.5, 'on the outer side');
});

test('a compact carrier is shorter than the full one, scooped at the neck, webbed front and back', () => {
	const field = { front: (x) => 0.13 - x * x, back: (x) => -0.11 + x * x, half: () => 0.17 };
	const cut = { chest: 1.3, waist: 1.05, neck: 1.5, shoulder: 1.42, shoulderX: 0.18 };
	const full = carrierGeometry(cut, field), compact = carrierGeometry(cut, field, { compact: true });
	const box = (parts) => { const b = new THREE.Box3(); for (const p of parts) if (p.part === 'plate') { p.geo.computeBoundingBox(); b.union(p.geo.boundingBox); } return b; };
	assert.ok(box(compact).min.y > box(full).min.y + 0.04, 'it ends above the waist');
	assert.ok(compact.filter((p) => p.part === 'web').length >= 8, 'webbing front and back, and a handle');
	assert.ok(compact.some((p) => p.part === 'patch'));
	// (the straps lie lower over the shoulders than the full carrier's)
	const top = (parts) => Math.max(...parts.filter((p) => p.part === 'strap').map((p) => { p.geo.computeBoundingBox(); return p.geo.boundingBox.max.y; }));
	assert.ok(top(compact) < top(full) - 0.015, 'straps along the shoulders');
});
