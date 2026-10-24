// The offices, the places to play and the tattoo parlours fitted out for what they are
// (bay/venuefit.js, bay/commercial.js): each builds a few steps a frame, its doorway clear and
// everyone's place inside its walls; an office's coffee, water, vending machine and first-aid
// box, a cinema's concession stand and the lanes' snack bar are yours to use
// (interiors/office-perks.js); every machine in an arcade and every lane is a game to play
// where it stands (arcade.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCommercial } from '../src/bay/commercial.js';
import { officeKind } from '../src/bay/venuefit.js';
import { venueOf } from '../src/economy/venue.js';
import { GAMES } from '../src/games/index.js';

// (the crowds keep the calendar, offices near empty at weekends: people/flow.js isWeekend reads
// today's date. The day these run on is pinned, a Wednesday unless a test says otherwise, so
// the test does not hang on the day it is run)
const RealDate = Date, WEDNESDAY = RealDate.UTC(2026, 9, 21, 12), SATURDAY = RealDate.UTC(2026, 9, 24, 12);
let today = WEDNESDAY;
globalThis.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [today])); } };
const on = (day, fn) => { today = day; try { return fn(); } finally { today = WEDNESDAY; } };

const OFFICES = ['tech', 'law', 'design', 'finance', 'agency', 'realtor', 'clinic', 'dental', 'insurance', 'hospital'];
const place = (venue, type, o = {}) => {
	const b = { x: 12, z: 0, w: 15, d: 18, a: 0.3, wallH: 4.6, kind: venue === 'office' ? 5 : 6, h: 4.6, door: 0.5, biz: { type, name: type + ' place', sign: { bg: '#1d3557', fg: '#ffffff' } }, ...o };
	while (venueOf(b) !== venue) b.x += 7;
	b.grp = [b]; b.grp.biz = true;
	return b;
};
function built(b) {
	const C = createCommercial({ add() {} }, { heightAt: () => 0 }, null, { procBiz: () => [b], setNear() {} }, {});
	const cam = { position: { x: b.x, y: 2, z: b.z } };
	let frames = 0;
	while (!C.count() && frames < 300) { C.update(cam, 0.016, 12, 0); frames++; }
	return { C, frames, L: C.list()[0] };
}
const frameOf = (b) => { const ca = Math.cos(b.a), sa = Math.sin(b.a); return { W: (lx, lz) => ({ x: b.x + ca * lx - sa * lz, z: b.z + sa * lx + ca * lz }), L: (x, z) => { const dx = x - b.x, dz = z - b.z; return [ca * dx + sa * dz, -sa * dx + ca * dz]; } }; };

// each at a few sizes and with its door at either end of its front
const CASES = [
	...OFFICES.flatMap((t, i) => [place('office', t, { w: 12 + (i % 3) * 5, d: 14 + (i % 4) * 4, door: i % 2 ? 0.2 : 0.8 }), ...(i < 3 ? [place('office', t, { w: 8, d: 11, door: 0.5 })] : [])]),
	place('arcade', 'arcade', { w: 14, d: 20, door: 0.3 }), place('arcade', 'arcade', { w: 11, d: 25, door: 0.8 }),
	// (a bowling alley or a cinema is a big box: economy/venue.js)
	place('bowling', 'bowling', { w: 30, d: 34, door: 0.7 }), place('bowling', 'bowling', { w: 40, d: 26, door: 0.2 }), place('bowling', 'bowling', { w: 30, d: 40, door: 0.5 }),
	place('cinema', 'cinema', { w: 32, d: 30, door: 0.3 }), place('cinema', 'cinema', { w: 34, d: 36, door: 0.8 }),
	place('tattoo', 'tattoo', { w: 9, d: 14, door: 0.5 }), place('tattoo', 'tattoo', { w: 14, d: 18, door: 0.15 }),
];
const what = (b) => `${venueOf(b)} ${b.biz.type} ${b.w}x${b.d}`;

test('every office, arcade, bowling alley, cinema and tattoo parlour builds in a few frames', () => {
	for (const b of CASES) {
		const { C, frames, L } = built(b);
		assert.equal(C.count(), 1, what(b) + ' built');
		assert.ok(frames >= 1 && frames < 120, `${what(b)}: built over a few frames (${frames})`);
		const v = venueOf(b);
		assert.equal(L.trade, v === 'office' ? officeKind(b.biz.type) : v, what(b));
		assert.ok(L.seats > 2, `${what(b)}: places to sit or stand (${L.seats})`);
		// (its posters, marquees, shoes, inks and menus on the goods' sheet)
		let goods = 0;
		C.group.traverse((o) => { if (o.name === 'goods') goods += o.geometry.attributes.position.count; });
		assert.ok(goods > 20, `${what(b)}: its printed things (${goods})`);
	}
});

test('the doorway and a few steps in are clear, and everyone stands inside the walls', (t) => {
	// (on a weekday: the offices are all but empty at the weekend, people/flow.js)
	t.mock.timers.enable({ apis: ['Date'], now: new Date(2026, 9, 21, 11) });
	for (const b of CASES) {
		const { C, L } = built(b), F = frameOf(b);
		for (const dz of [0.5, 1.4, 2.0]) {
			const p = F.W(L.doorX, L.hd - 0.3 - dz), q = { ...p };
			C.push(q, L.y);
			assert.ok(Math.hypot(q.x - p.x, q.z - p.z) < 0.05, `${what(b)}: ${dz} m inside the door is clear`);
		}
		const v = C.venue({ x: b.x, z: b.z }, venueOf(b) === 'office' ? 11 : 20);
		assert.ok(v?.areas?.length, what(b) + ': people in');
		for (const q of v.areas[0].seats) {
			const [lx, lz] = F.L(q.x, q.z);
			assert.ok(Math.abs(lx) < L.hw - 0.3 && Math.abs(lz) < L.hd - 0.3, `${what(b)}: a place out of the room at ${lx.toFixed(2)}, ${lz.toFixed(2)}`);
		}
		// someone behind the desk or the counter
		assert.ok(v.areas[0].seats.some((s) => s.staff), what(b) + ': a place for the staff');
	}
});

test('at the weekend the offices are near empty, and the places to play no quieter', () => {
	const office = place('office', 'tech', { w: 17, d: 18 }), arcade = place('arcade', 'arcade', { w: 14, d: 20, door: 0.3 });
	const inAt = (b, h, day) => { const { C } = built(b); return on(day, () => C.venue({ x: b.x, z: b.z }, h))?.n || 0; };
	const week = inAt(office, 11, WEDNESDAY), weekend = inAt(office, 11, SATURDAY);
	assert.ok(week > 0 && weekend < week / 2, `an office on a Wednesday (${week}) and on a Saturday (${weekend})`);
	assert.ok(inAt(arcade, 20, SATURDAY) >= inAt(arcade, 20, WEDNESDAY), 'an arcade on a Saturday night');
});

test("an office's coffee, water, vending machine and first-aid box, the cinema's popcorn and the lanes' snack bar are yours", () => {
	const want = { office: ['coffee', 'water', 'vending', 'firstaid'], care: ['water', 'vending'], cinema: ['popcorn'], bowling: ['snackbar'] };
	for (const b of CASES) {
		const v = venueOf(b), k = v === 'office' && officeKind(b.biz.type) === 'care' ? 'care' : v;
		if (!want[k]) continue;
		const { C, L } = built(b);
		// (looked for from the middle of the place, with a reach as wide as it is)
		const all = C.amenities({ x: b.x, y: L.y + 1.6, z: b.z }, Math.hypot(L.hw, L.hd) + 1);
		for (const kind of want[k]) {
			const q = all.find((p) => p.kind === kind);
			assert.ok(q, `${what(b)}: a ${kind}`);
			// (and found from right by it, inside the walls)
			const near = C.amenities({ x: q.x, y: L.y + 1.6, z: q.z }, 1.2);
			assert.ok(near.some((p) => p.kind === kind && p.d < 0.05), `${what(b)}: the ${kind} found where it is`);
			const [lx, lz] = frameOf(b).L(q.x, q.z);
			assert.ok(Math.abs(lx) < L.hw - 0.3 && Math.abs(lz) < L.hd - 0.3, `${what(b)}: the ${kind} inside`);
		}
		// (and not from the next street)
		assert.equal(C.amenities({ x: b.x + 200, y: L.y + 1.6, z: b.z }, 2.2).length, 0);
	}
});

test("an arcade's machines and the lanes are games to play where they stand", () => {
	const ids = new Set(GAMES.map((G) => G.id));
	for (const b of CASES) {
		const v = venueOf(b);
		if (v !== 'arcade' && v !== 'bowling') continue;
		const { C, L } = built(b), spots = C.gameSpots(b.x, b.z);
		const games = new Set(spots.map((s) => s.game));
		if (v === 'arcade') for (const g of ['pinball', 'skeeball', 'airhockey', 'claw', 'darts']) assert.ok(games.has(g), `${what(b)}: ${g}`);
		else assert.ok(spots.filter((s) => s.game === 'bowling').length >= 4, `${what(b)}: its lanes (${spots.length})`);
		for (const s of spots) {
			assert.ok(ids.has(s.game), s.game + ' is a game');
			assert.ok(s.name.includes(b.biz.name) && s.r > 0.3, s.name);
			// (where you stand to play it: inside the walls, and not inside the machine)
			const [lx, lz] = frameOf(b).L(s.x, s.z);
			assert.ok(Math.abs(lx) < L.hw - 0.3 && Math.abs(lz) < L.hd - 0.3, `${what(b)}: ${s.name} inside`);
			const q = { x: s.x, z: s.z };
			C.push(q, L.y);
			assert.ok(Math.hypot(q.x - s.x, q.z - s.z) < s.r, `${what(b)}: ${s.name} can be stood at`);
		}
		// (far away: none)
		assert.equal(C.gameSpots(b.x + 5000, b.z, 100).length, 0);
	}
});
