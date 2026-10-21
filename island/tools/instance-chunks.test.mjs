// The city's buildings, roofs and skylines drawn in chunks a sector at a time (world/instancechunks.js):
// every item gets a slot while there is room for the city's cap, a chunk is never left out while
// any of what it holds could be in the view (or in the sun's box), the store's slots and buffers
// are what the chunks draw, and a phone's view at street level draws a fraction of the city.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SECTORS, MID, sectorOf, orderBySector, chunkStore, chunkSlots, supportPolygon, chunkedMesh, chunkInView } from '../src/world/instancechunks.js';
import { REACH_BANDS, bandOf } from '../src/world/shadowreach.js';

let seed = 23;
const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const half = (o) => Math.hypot(o.w, o.d) / 2 + 2;
// a city round (0, 0): mostly near, thinning out, a few towers
const city = (n, R) => Array.from({ length: n }, (_, i) => { const r = R * Math.pow(rnd(), 1.6), a = rnd() * 6.283; return { i, x: Math.cos(a) * r, z: Math.sin(a) * r, y: rnd() * 60, w: 4 + rnd() * (rnd() < 0.05 ? 80 : 20), d: 4 + rnd() * 30, h: 3 + rnd() * (rnd() < 0.05 ? 250 : 15), a: rnd() * 6.283 }; });
const Y = [-100, 1600];
function viewFrustum(x, y, z, yaw, pitch) {
	const cam = new THREE.PerspectiveCamera(60, 682 / 1162, 0.2, 30000);
	cam.position.set(x, y, z); cam.rotation.order = 'YXZ'; cam.rotation.set(pitch, yaw, 0);
	cam.updateMatrixWorld();
	return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
}
// the sun as world/sky.js has it: 200 m back along the light from you, a 110 m box 400 m deep
function sunFrustum(px, pz, el, az) {
	const L = new THREE.DirectionalLight(0xffffff, 1), sc = L.shadow.camera;
	sc.left = -55; sc.right = 55; sc.top = 55; sc.bottom = -55; sc.near = 1; sc.far = 400; sc.updateProjectionMatrix();
	L.target.position.set(px, 0, pz); L.position.set(px + Math.cos(el) * Math.cos(az) * 200, Math.sin(el) * 200, pz + Math.cos(el) * Math.sin(az) * 200);
	L.updateMatrixWorld(); L.target.updateMatrixWorld(); L.shadow.updateMatrices(L);
	return { sc, F: new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(sc.projectionMatrix, sc.matrixWorldInverse)) };
}
// a city written into a chunked store as bay/city.js writes it
function build(L, cx, cz, ch, cap) {
	const store = new THREE.InstancedMesh(new THREE.InstancedBufferGeometry().copy(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), new THREE.MeshBasicMaterial(), chunkStore(cap, ch));
	store.geometry.setAttribute('aKind', new THREE.InstancedBufferAttribute(new Float32Array(store.instanceMatrix.count), 1));
	store.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(store.instanceMatrix.count * 3), 3);
	const parent = new THREE.Group(), C = chunkedMesh(store, ch, { parent, Y });
	const O = orderBySector(L, cx, cz, half);
	const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
	C.begin(cx, cz);
	for (let i = 0; i < L.length; i++) {
		const o = L[i], n = C.put(O.sec[i], O.band[i], o.x, o.z, Math.hypot(o.w, o.d) / 2 + 0.5, o.y - 36, o.y + o.h + 0.5);
		o.slot = n;
		if (n < 0) continue;
		store.setMatrixAt(n, m.compose(new THREE.Vector3(o.x, o.y, o.z), q.setFromAxisAngle(up, -o.a), new THREE.Vector3(o.w, o.h, o.d)));
		store.geometry.attributes.aKind.array[n] = o.i;
	}
	store.instanceMatrix.needsUpdate = true; store.geometry.attributes.aKind.needsUpdate = true;
	C.end();
	parent.updateMatrixWorld(true);
	return { store, C, parent, O };
}
// points over a building's box (and a metre round it), for seeing whether any of it is in a frustum
function anyIn(F, o) {
	const c = Math.cos(o.a), s = Math.sin(o.a), p = new THREE.Vector3();
	for (let u = -1; u <= 1; u += 0.25) for (let v = -1; v <= 1; v += 0.25) for (let t = 0; t <= 1; t += 0.25) {
		const lx = u * (o.w / 2 + 0.4), lz = v * (o.d / 2 + 0.4);
		if (F.containsPoint(p.set(o.x + c * lx - s * lz, o.y + t * o.h, o.z + s * lx + c * lz))) return true;
	}
	return false;
}

test('sectors: by bearing round the centre, every one in range, the middle its own', () => {
	assert.equal(sectorOf(-1000, -1e-9, 0, 0), 0);
	assert.equal(sectorOf(-1000, 1e-9, 0, 0), SECTORS - 1);
	assert.equal(sectorOf(1000, 0, 0, 0), SECTORS / 2);
	assert.equal(sectorOf(MID - 1, 0, 0, 0), SECTORS);
	assert.equal(sectorOf(MID + 5, 0, 0, 0, 10), SECTORS, 'within the middle by its half-size');
	assert.equal(sectorOf(MID + 5, 0, 0, 0, 1), SECTORS / 2);
	for (let i = 0; i < 2000; i++) { const k = sectorOf((rnd() - 0.5) * 3000, (rnd() - 0.5) * 3000, 0, 0); assert.ok(k >= 0 && k <= SECTORS); }
});

test('ordering keeps every item, sector by sector, nearest band first in each, each band in its own order', () => {
	const L = city(5000, 2000), ids = new Set(L.map((o) => o.i)), props = { trees: [1] };
	Object.assign(L, props);
	const O = orderBySector(L, 80, -30, half);
	assert.equal(L.length, 5000); assert.deepEqual(new Set(L.map((o) => o.i)), ids); assert.equal(L.trees, props.trees);
	for (let i = 0; i < L.length; i++) {
		const o = L[i];
		assert.equal(O.sec[i], sectorOf(o.x, o.z, 80, -30, half(o))); assert.equal(O.band[i], bandOf(Math.hypot(o.x - 80, o.z + 30) - half(o)));
		if (!i) continue;
		assert.ok(O.sec[i] > O.sec[i - 1] || (O.sec[i] === O.sec[i - 1] && O.band[i] >= O.band[i - 1]), 'sector-major, then band');
		if (O.sec[i] === O.sec[i - 1] && O.band[i] === O.band[i - 1]) assert.ok(L[i - 1].i < L[i].i, 'stable within a band');
	}
});

test('the store always has room for the cap, however the sectors fall', () => {
	for (const [cap, ch] of [[32000, 2048], [6000, 512], [1000, 64]]) {
		for (let run = 0; run < 20; run++) {
			const n = Math.floor(cap * (0.5 + rnd() * 0.5)), S = chunkSlots(ch, chunkStore(cap, ch) / ch), seen = new Set();
			// sectors in order, unevenly filled (some empty, some a few, some most of the city)
			const w = Array.from({ length: SECTORS + 1 }, () => (rnd() < 0.3 ? 0 : Math.pow(rnd(), 3)));
			const tot = w.reduce((a, b) => a + b, 0) || 1;
			let k = 0;
			for (let s = 0; s <= SECTORS; s++) {
				const m = s === SECTORS ? n - k : Math.min(n - k, Math.round(n * w[s] / tot));
				for (let i = 0; i < m; i++, k++) { const slot = S.next(s); assert.ok(slot >= 0, `room for item ${k} of ${n} (cap ${cap})`); assert.ok(!seen.has(slot)); seen.add(slot); }
			}
		}
	}
	const S = chunkSlots(4, 3);
	assert.deepEqual([S.next(0), S.next(0), S.next(1), S.next(1), S.next(1), S.next(1), S.next(1), S.next(2)], [0, 1, 4, 5, 6, 7, 8, -1]);
});

test('the polygon round a set of discs holds every one', () => {
	for (let run = 0; run < 50; run++) {
		const D = Array.from({ length: 1 + Math.floor(rnd() * 60) }, () => [rnd() * 900 - 450, rnd() * 300 + 200, 1 + rnd() * 40]);
		const s = new Float64Array(16).fill(-Infinity);
		for (const [x, z, r] of D) for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; s[k] = Math.max(s[k], x * Math.cos(a) + z * Math.sin(a) + r); }
		const P = supportPolygon(s);
		for (const [x, z, r] of D) for (let t = 0; t < 12; t++) {
			const px = x + Math.cos(t / 12 * 6.283) * r * 0.999, pz = z + Math.sin(t / 12 * 6.283) * r * 0.999;
			for (let k = 0; k < P.length; k += 2) { const j = (k + 2) % P.length; assert.ok((P[j] - P[k]) * (pz - P[k + 1]) - (P[j + 1] - P[k + 1]) * (px - P[k]) >= -1e-6, 'inside'); }
		}
	}
});

test('every building lands in a slot of the store, and the chunks draw them from it', () => {
	const L = city(9000, 2200), { store, C, O } = build(L, 30, 60, 512, 9000);
	const used = new Set();
	for (const o of L) { assert.ok(o.slot >= 0); assert.ok(!used.has(o.slot)); used.add(o.slot); }
	let total = 0;
	for (let j = 0; j < C.nch; j++) {
		const im = C.meshes[j], n = im.count;
		total += n;
		assert.equal(im.visible, n > 0);
		// (a chunk's views are the store's memory, its first n slots filled, one sector's run)
		assert.equal(im.instanceMatrix.array.buffer, store.instanceMatrix.array.buffer);
		assert.equal(im.instanceMatrix.array.byteOffset, j * 512 * 16 * 4);
		assert.equal(im.geometry.attributes.aKind.array.byteOffset, j * 512 * 4);
		assert.equal(im.geometry.attributes.position, store.geometry.attributes.position);
		assert.equal(im.userData.copyOf, store);
		const sec = new Set(L.filter((o) => (o.slot / 512 | 0) === j).map((o) => O.sec[L.indexOf(o)]));
		assert.ok(sec.size <= 1);
		// (written nearest first: the shadow pass's bands count them)
		if (n) assert.equal(C.meta[j].R.ends.at(-1), n);
	}
	assert.equal(total, L.length);
	// the store written (damage.js hiding one, a house built): the chunk holding it is sent up again
	const o = L[1234], j = o.slot / 512 | 0, v = C.meshes[j].instanceMatrix.version;
	store.setMatrixAt(o.slot, new THREE.Matrix4().makeScale(0, 0, 0)); store.instanceMatrix.needsUpdate = true;
	C.sync();
	assert.ok(C.meshes[j].instanceMatrix.version > v);
	assert.equal(C.meshes[j].instanceMatrix.array[(o.slot - j * 512) * 16], 0, 'the chunk sees the store\'s write');
	assert.deepEqual(C.meshes[j].instanceMatrix.updateRanges.at(-1), { start: 0, count: C.meshes[j].count * 16 });
});

test('a chunk is never left out while any of it could be in view, and a street-level view leaves most out', () => {
	let drawn = 0, all = 0;
	for (let run = 0; run < 6; run++) {
		const cx = (rnd() - 0.5) * 400, cz = (rnd() - 0.5) * 400, L = city(6000, 2200).map((o) => ({ ...o, x: o.x + cx, z: o.z + cz }));
		const { C } = build(L, cx, cz, 512, 6000);
		for (let v = 0; v < 8; v++) {
			// you within 320 m of where the city was laid out, standing, up a tower, or flying; looking any way
			const a = rnd() * 6.283, r = rnd() * 320, h = [1.7, 1.7, 1.7, 40, 300][Math.floor(rnd() * 5)];
			const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r, F = viewFrustum(x, h + 30, z, rnd() * 6.283, (rnd() - 0.6) * (h > 2 ? 2.2 : 0.5));
			for (let j = 0; j < C.nch; j++) {
				const im = C.meshes[j];
				if (!im.count) continue;
				all++;
				if (im.intersectsFrustum(F)) { drawn++; continue; }
				for (const o of L) if ((o.slot / 512 | 0) === j) assert.ok(!anyIn(F, o), `building ${o.i} in a chunk left out, but in view`);
			}
		}
	}
	assert.ok(drawn / all < 0.55, `most chunks out of a phone's view (${(drawn / all * 100).toFixed(0)}% drawn)`);
});

test('in the sun\'s pass a chunk out of the box is left out, one in it draws only the bands the box can reach', () => {
	let drawn = 0, all = 0;
	for (let run = 0; run < 6; run++) {
		const L = city(6000, 2200), { C } = build(L, 0, 0, 512, 6000);
		for (let s = 0; s < 6; s++) {
			const a = rnd() * 6.283, r = rnd() * 320, { sc, F } = sunFrustum(Math.cos(a) * r, Math.sin(a) * r, 0.08 + rnd() * 1.4, rnd() * 6.283);
			for (let j = 0; j < C.nch; j++) {
				const im = C.meshes[j], n = im.count;
				if (!n) continue;
				all += n;
				const of = L.filter((o) => (o.slot / 512 | 0) === j).sort((p, q) => p.slot - q.slot);
				if (!im.intersectsFrustum(F)) { for (const o of of) assert.ok(!anyIn(F, o), 'left out but in the box'); continue; }
				im.onBeforeShadow(null, im, null, sc);
				const k = im.count;
				im.onAfterShadow();
				assert.equal(im.count, n, 'the count comes back');
				drawn += k;
				for (const o of of.slice(k)) assert.ok(!anyIn(F, o), 'past the bands drawn, but in the box');
			}
		}
	}
	assert.ok(drawn / all < 0.3, `a few of the city's buildings in the shadow pass (${(drawn / all * 100).toFixed(0)}%)`);
});

test('a chunk moved, turned or scaled is drawn; the shared footprint serves only chunks within its heights', () => {
	const L = city(2000, 1500), { C, parent } = build(L, 0, 0, 512, 2000);
	const F = viewFrustum(0, 2, 0, 0, 0);
	parent.rotation.y = 0.3; parent.updateMatrixWorld(true);
	for (const im of C.meshes) if (im.count) assert.equal(im.intersectsFrustum(F), true);
	// (a polygon far behind you, but standing taller than the shared heights: tested on its own)
	const hull = new Float64Array([-10, 500, 10, 500, 10, 520, -10, 520]);
	assert.equal(chunkInView(hull, 0, 0, 0, 30, viewFrustum(0, 2, 0, 0, 0).planes, Y), false);
	assert.equal(chunkInView(hull, 0, 0, 0, 3000, viewFrustum(0, 2, 0, 0, 0).planes, Y), false);
	assert.equal(chunkInView(hull, 0, -1000, 0, 30, viewFrustum(0, 2, 0, 0, 0).planes, Y), true);
	assert.ok(REACH_BANDS.length > 0);
});
