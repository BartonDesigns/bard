import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { sleeveEase, waistbandEase, armT, bendAngle, foldAmount, sleeveHang, isRibbed, isShirted, looseness, SLEEVE_END, SLEEVE_POSE_GLSL } from '../src/people/garment-shape.js';
import { torsoField, necklineRing, hoodGeometry, collarGeometry, carrierGeometry } from '../src/people/garment-kit.js';
import { TRIGGER_OFF, TRIGGER_ON } from '../src/people/motion.js';

const tee = { kind: 'tee', fit: 'regular', sleeves: 'short' };
const hoodie = { kind: 'hoodie', fit: 'oversized', sleeves: 'long', fab: 'fleece' };
const shirt = { kind: 'shirt', fit: 'regular', sleeves: 'long' };
const jacket = { kind: 'jacket', fit: 'regular', sleeves: 'long' };

test('a long sleeve has room at the bicep, narrows down the forearm and closes at a cuff', () => {
	for (const g of [hoodie, shirt, jacket]) {
		const bicep = sleeveEase(g, 0.5, 0.3), fore = sleeveEase(g, 1.6, 0.15), cuff = sleeveEase(g, 1.88, 0.01);
		assert.ok(bicep > fore, `${g.kind}: bicep ${bicep} > forearm ${fore}`);
		assert.ok(fore > cuff, `${g.kind}: forearm ${fore} > cuff ${cuff}`);
		assert.ok(sleeveEase(g, 0.02, 0.5) < bicep, `${g.kind}: the armhole is set in snug`);
	}
	// a knit's rib hugs the wrist, the spare length stacks above it
	assert.ok(sleeveEase(hoodie, 1.88, 0.02) < 0.0035);
	assert.ok(sleeveEase(hoodie, 1.6, 0.085) > sleeveEase(hoodie, 1.6, 0.2));
	// a shirt cuff is a firm band, looser than a rib
	assert.ok(sleeveEase(shirt, 1.88, 0.02) > sleeveEase(hoodie, 1.88, 0.02));
	// a jacket over a top stands further off than the same cut worn alone
	assert.ok(sleeveEase(jacket, 0.5, 0.3, true) > sleeveEase(jacket, 0.5, 0.3));
});

test('short, rolled and tight sleeves', () => {
	assert.ok(sleeveEase(tee, 0.55, 0.01) > sleeveEase(tee, 0.1, 0.15), 'a short sleeve opens toward its hem');
	const rolled = { ...shirt, sleeves: 'rolled' };
	assert.ok(sleeveEase(rolled, 1.28, 0.01) > sleeveEase(rolled, 1.1, 0.12), 'the roll is thicker than the sleeve above it');
	assert.equal(sleeveEase({ kind: 'tech', fit: 'tight', sleeves: 'long' }, 1, 0.2), 0.004);
	for (const g of [tee, hoodie, shirt, jacket, rolled]) for (let t = 0; t <= 2; t += 0.1) for (const dc of [0, 0.03, 0.08, 0.3]) {
		const k = sleeveEase(g, t, dc);
		assert.ok(Number.isFinite(k) && k > 0 && k <= 0.05, `${g.kind} ${t} ${dc} ${k}`);
	}
	assert.ok(SLEEVE_END.short < SLEEVE_END.elbow && SLEEVE_END.elbow < SLEEVE_END.rolled && SLEEVE_END.rolled < SLEEVE_END.long);
	assert.ok(looseness({ fit: 'oversized' }) > looseness({ fit: 'regular' }) && looseness({ fit: 'regular' }) > looseness({ fit: 'slim' }));
});

test('ribbed waistbands draw in at the hips and blouse above', () => {
	assert.ok(isRibbed(hoodie) && !isRibbed(tee) && isShirted(shirt) && !isShirted(hoodie));
	assert.ok(waistbandEase(hoodie, 0.02) < 0.7);
	assert.ok(waistbandEase(hoodie, 0.1) > 1.2);
	assert.equal(waistbandEase(tee, 0.02), 1);
});

test('arm position: shoulder 0, elbow 1, wrist 2, on both sides', () => {
	const cut = { arm: { L: { s: [0.18, 1.4, 0], e: [0.25, 1.12, 0], w: [0.3, 0.88, 0.02] }, R: { s: [-0.18, 1.4, 0], e: [-0.25, 1.12, 0], w: [-0.3, 0.88, 0.02] } } };
	for (const sx of [1, -1]) {
		assert.ok(Math.abs(armT([0.18 * sx + 0.03 * sx, 1.4, 0], cut)) < 0.12);
		assert.ok(Math.abs(armT([0.25 * sx + 0.03 * sx, 1.12, 0], cut) - 1) < 0.12);
		assert.ok(Math.abs(armT([0.3 * sx + 0.025 * sx, 0.88, 0.02], cut) - 2) < 0.12);
		assert.ok(armT([0.27 * sx, 1.0, 0.01], cut) > 1 && armT([0.27 * sx, 1.0, 0.01], cut) < 2);
	}
});

test('pose folds: elbow bend and the hang across the arm', () => {
	assert.equal(bendAngle(0, -1, 0, 0, -1, 0), 0);
	assert.ok(Math.abs(bendAngle(0, -1, 0, 0, 0, 1) - Math.PI / 2) < 1e-9);
	assert.equal(foldAmount(0), 0);
	assert.ok(foldAmount(Math.PI / 2) > 0.85);
	// an arm held out level: the cloth under it falls, the top is drawn in
	assert.ok(sleeveHang(0, 0, 1, 0, -1, 0) > 0.7);
	assert.ok(sleeveHang(0, 0, 1, 0, 1, 0) < 0);
	// an arm hanging straight down: nothing to hang across
	assert.equal(sleeveHang(0, -1, 0, 1, 0, 0), 0);
	// the shader reads the capsules the cloth contact poses, and only on sleeves
	assert.match(SLEEVE_POSE_GLSL, /uClothA\[iu\]/);
	assert.match(SLEEVE_POSE_GLSL, /sleeve\.x > -0\.5/);
	for (let j = 0; j < 3; j++) assert.ok(TRIGGER_ON[j] > TRIGGER_OFF[j]);
});

// a stand-in torso: an elliptic cylinder of points from the waist to the neck
function torso() {
	const cut = { waist: 1.0, chest: 1.25, neck: 1.45, shoulder: 1.4, shoulderX: 0.2, waistX: 0.16, frontZ: 0.11, backZ: -0.1 };
	const pts = [];
	for (let y = 0.8; y <= 1.55; y += 0.01) for (let a = 0; a < Math.PI * 2; a += 0.05) pts.push([Math.sin(a) * 0.17, y, 0.005 + Math.cos(a) * 0.11]);
	return { cut, field: torsoField(cut, pts) };
}

test('the torso field gives the clothed front and back', () => {
	const { field } = torso();
	assert.ok(Math.abs(field.front(0, 1.2) - 0.115) < 0.01);
	assert.ok(Math.abs(field.back(0, 1.2) + 0.105) < 0.01);
	assert.ok(field.front(0.12, 1.2) < field.front(0, 1.2));
	assert.ok(Math.abs(field.half(1.2) - 0.17) < 0.02);
});

test('a carrier lies on the body: plates clear of the clothes, nothing inside them', () => {
	const { cut, field } = torso();
	for (const police of [false, true]) for (const lo of [false, true]) {
		const pieces = carrierGeometry(cut, field, { police, lo });
		assert.ok(pieces.some((p) => p.part === 'plate') && pieces.some((p) => p.part === 'band') && pieces.filter((p) => p.part === 'strap').length === 2);
		if (police) assert.ok(pieces.some((p) => p.part === 'tape'));
		else assert.ok(pieces.filter((p) => p.part === 'pouch').length >= 3);
		for (const { geo, part } of pieces) {
			const pa = geo.attributes.position;
			for (let i = 0; i < pa.count; i++) {
				const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i);
				assert.ok([x, y, z].every(Number.isFinite));
				// (inside the torso's outline at its height, nothing of the carrier)
				if (part !== 'strap' && y > 0.85 && y < 1.5 && Math.abs(x) < 0.12) assert.ok(z > field.front(x, y) - 0.002 || z < field.back(x, y) + 0.002, `${part} at ${x} ${y} ${z}`);
			}
		}
		// the front plate's outer face looks out
		const plate = pieces[0].geo; plate.computeVertexNormals();
		let top = 0; for (let i = 0; i < plate.attributes.position.count; i++) if (plate.attributes.position.getZ(i) > plate.attributes.position.getZ(top)) top = i;
		assert.ok(plate.attributes.normal.getZ(top) > 0.5);
	}
});

test('a hood, its drawstrings and a collar are finite and sit round the neck', () => {
	const { cut, field } = torso();
	const ring = necklineRing(null, cut);
	assert.equal(ring.length, 24);
	const { hood, roll, strings } = hoodGeometry(cut, field, ring);
	for (const g of [hood, roll, ...strings, collarGeometry(cut, ring), collarGeometry(cut, ring, { polo: true, lo: true })]) {
		const pa = g.attributes.position;
		for (let i = 0; i < pa.count; i++) assert.ok([pa.getX(i), pa.getY(i), pa.getZ(i)].every(Number.isFinite));
	}
	// the hood hangs down the back, behind the body
	const hp = hood.attributes.position;
	let low = Infinity, lowZ = 0;
	for (let i = 0; i < hp.count; i++) if (hp.getY(i) < low) { low = hp.getY(i); lowZ = hp.getZ(i); }
	assert.ok(low < cut.neck - 0.12 && lowZ < field.back(0, low));
	const box = new THREE.Box3().setFromBufferAttribute(collarGeometry(cut, ring).attributes.position);
	assert.ok(box.min.y > cut.neck - 0.08 && box.max.y < cut.neck + 0.1);
});
