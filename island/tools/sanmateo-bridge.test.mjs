import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sanMateoLayout, createSanMateoBridge, ROAD_W, DECK_W, GAP, BARRIER_H, LAMP_D } from '../src/bay/sanmateo.js';

const Lay = sanMateoLayout(() => -6);
const at = (s, t) => { const f = Lay.frame(s); return [Lay.O.x + f.x + f.nx * t, Lay.O.z + f.z + f.nz * t]; };

test('the San Mateo Bridge spans Foster City to Hayward on its real ends', () => {
	const a = at(0, 0), b = at(Lay.L, 0);
	assert.ok(Math.hypot(a[0] - Lay.A.x, a[1] - Lay.A.z) < 1, 'west end on the Foster City shore');
	assert.ok(Math.hypot(b[0] - Lay.B.x, b[1] - Lay.B.z) < 1, 'east end on the Hayward shore');
	assert.ok(Lay.L > 10300 && Lay.L < 10800, `about 10.5 km over the water (${Lay.L})`);
});

test('a low trestle, then the high-rise climbing to 41 m over the channel', () => {
	assert.ok(Math.abs(Lay.roadY(6000) - 8.5) < 0.01, 'the trestle runs low and level');
	const peak = Math.max(...Array.from({ length: 300 }, (_, i) => Lay.roadY(i * 10)));
	assert.ok(peak > 45 && peak < 48, `the high-rise tops out over the channel (${peak})`);
	// (no grade steeper than a freeway's)
	for (let s = 0; s < Lay.L - 10; s += 10) assert.ok(Math.abs(Lay.roadY(s + 10) - Lay.roadY(s)) / 10 < 0.06, `grade at ${s}`);
	assert.equal(Lay.gap(1000), 0, 'one girder on the high-rise');
	assert.equal(Lay.gap(6000), GAP, 'twin trestles with water between');
});

test('the decks are floors: the lanes, the barriers, not the gap between the trestles', () => {
	const B = createSanMateoBridge(new THREE.Scene(), { heightAt: () => -6 });
	const s = 6000, y = Lay.roadY(s);
	const cW = Lay.deckT(s, 1), cE = Lay.deckT(s, -1);
	assert.equal(B.floor(...at(s, cW), y + 1), y, 'westbound lanes');
	assert.equal(B.floor(...at(s, cE), y + 1), y, 'eastbound lanes');
	assert.equal(B.floor(...at(s, cW + ROAD_W / 2 + 0.2), y + 2), y + BARRIER_H, 'on the barrier');
	assert.equal(B.floor(...at(s, 0), y + 1), -Infinity, 'the gap is open water');
	assert.equal(B.floor(...at(s, cW + DECK_W), y + 1), -Infinity, 'off the edge');
	assert.equal(B.floor(...at(s, cW), y - 10), -Infinity, 'a boat under the deck stays on the water');
	assert.equal(B.floor(Lay.O.x + 20000, Lay.O.z, 5), -Infinity, 'far away');
	const st = B.stats();
	assert.ok(Math.abs(st.lamps - 2 * Math.floor((Lay.L - 30) / LAMP_D + 0.5)) <= 2, `a lamp each side every ${LAMP_D.toFixed(1)} m (${st.lamps})`);
	assert.ok(st.towers > 25 && st.towers < 40, `the power line's towers (${st.towers})`);
	assert.ok(st.tris < 260000, `kept cheap (${st.tris} triangles)`);
	// (five draws: concrete, deck, lamps, towers, wires; the glow by night a sixth)
	const draws = []; B.group.traverse((o) => { if (o.isMesh || o.isLine || o.isPoints) draws.push(o); });
	assert.equal(draws.length, 6);
});
