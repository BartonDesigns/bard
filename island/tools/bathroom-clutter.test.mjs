import assert from 'node:assert/strict';
import { bathroomMessProfile, groupBoxes, planHouse } from '../src/bay/houseplan.js';

function profileRatio() {
	let messy = 0;
	for (let seed = 0; seed < 10000; seed++) if (bathroomMessProfile(seed).enabled) messy++;
	return messy / 10000;
}

function syntheticHouse(x, z = 0) {
	const boxes = [{ x, z, w: 12, d: 12, a: 0, wallH: 5, roofH: 5, kind: 0, door: 0.5 }];
	groupBoxes(boxes);
	return planHouse(boxes);
}

function overlaps(a, b) {
	return a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
}

function doorClearance(plan, roomId) {
	const out = [];
	for (const w of plan.walls) {
		for (const o of w.open) {
			if (o.type === 'window') continue;
			const d = o.type === 'garage' ? 3.0 : o.type === 'wide' ? 0.9 : 1.05;
			const a = o.s0 - 0.1, b = o.s1 + 0.1;
			const box = w.axis === 'x' ? [a, w.pos - d, b, w.pos + d] : [w.pos - d, a, w.pos + d, b];
			// The room check below handles the side; keeping all door clearances is a
			// stronger regression guard for small bathrooms and shared hall doors.
			if (w.ra === roomId || w.rb === roomId || w.room === roomId) out.push(box);
		}
	}
	return out;
}

assert.ok(profileRatio() > 0.72 && profileRatio() < 0.78, 'messy-house gate should remain near 75%');

const first = syntheticHouse(20);
const second = syntheticHouse(20);
assert.ok(first && second, 'synthetic mapped house should plan');
assert.deepEqual(first.bathroomMess, second.bathroomMess, 'bathroom profile is stable for a house seed');
assert.deepEqual(
	first.items.map(({ type, room, level, x, z, w, d, h, rot, variant, style, v }) => ({ type, room, level, x, z, w, d, h, rot, variant, style, v })),
	second.items.map(({ type, room, level, x, z, w, d, h, rot, variant, style, v }) => ({ type, room, level, x, z, w, d, h, rot, variant, style, v })),
	'lived-in bathroom placement is stable for a house seed',
);

const clutter = first.items.filter((it) => it.type.startsWith('bathroom'));
if (first.bathroomMess.enabled) {
	assert.ok(clutter.length > 0, 'messy houses receive bathroom clutter');
	assert.ok(clutter.length <= first.rooms.filter((r) => r.cells.length && ['bath', 'mbath', 'powder'].includes(r.type)).length * 3, 'clutter remains bounded per bathroom');
}
for (const it of clutter) {
	assert.ok(Number.isFinite(it.scale || 1) && (it.scale || 1) >= 0.68 && (it.scale || 1) <= 1.2, 'prop scale is bounded');
	assert.ok(it.box.every(Number.isFinite), 'clutter has a finite placement box');
	if (it.type !== 'bathroomFloorClutter') continue;
	for (const box of doorClearance(first, it.room)) assert.ok(!overlaps(it.box, box), 'floor clutter does not block a bathroom doorway');
}

console.log('bathroom-clutter: ok', { messyRatio: profileRatio(), clutter: clutter.length });
