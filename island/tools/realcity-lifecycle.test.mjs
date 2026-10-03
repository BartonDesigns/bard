import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import * as THREE from 'three';
import { createRealCity, REAL_U } from '../src/bay/realcity.js';
import { toWorld } from '../src/bay/geo.js';
import { REAL_REGIONS } from '../src/bay/realtiles.js';

const original = { fetch: globalThis.fetch, document: globalThis.document, createImageBitmap: globalThis.createImageBitmap };
const cities = [];
afterEach(() => {
	for (const city of cities.splice(0)) city.dispose();
	Object.assign(globalThis, original);
});
const city = (renderer = {}) => { const c = createRealCity(renderer); cities.push(c); return c; };
const camera = (lat, lon, y = 10) => ({ position: { ...toWorld(lat, lon), y } });
const flush = () => new Promise((resolve) => setTimeout(resolve, 20));
const fixture = (url) => {
	if (url.endsWith('.json')) {
		const name = url.split('/real/')[1].slice(0, -5), r = REAL_REGIONS.find((r) => r[0] === name);
		const a = toWorld(r[4], r[1]), b = toWorld(r[2], r[3]);
		return new Response(JSON.stringify({ origin: [0, 0], geo: [0, -122.788], unit: 1, bounds: [a.x, a.z, b.x, b.z], sections: Object.fromEntries(['roads', 'boxes', 'paths', 'pools', 'trees'].map((k) => [k, [0, 0]])), map: { w: 1, h: 1, step: 8 }, attribution: 'test' }));
	}
	return new Response(url.endsWith('.gz') ? gzipSync(new Uint8Array(0)) : new Uint8Array(0));
};
const browser = (onClose = () => {}) => {
	globalThis.createImageBitmap = async () => ({ width: 1, height: 1, close: onClose });
	globalThis.document = { createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }) }) }) };
};

test('nearby tiles still load, and teardown releases their combined map', async () => {
	let closed = 0;
	browser(() => closed++);
	globalThis.fetch = async (url) => fixture(url);
	const c = city();
	c.update(camera(37.78, -122.45));
	await flush();
	assert.equal(c.info().live.length, 2);
	assert.equal(c.info().pending, 0);
	assert.equal(c.loaded(), true);
	assert.equal(closed, 2);
	const map = REAL_U.uRealMap.value;
	let releases = 0;
	map.addEventListener('dispose', () => releases++);
	c.dispose();
	assert.equal(releases, 1);
	assert.equal(REAL_U.uRealR.value.w, 0);
	assert.notEqual(REAL_U.uRealMap.value, map);
});

test('a bad tile response aborts its sibling files', async () => {
	const calls = [];
	globalThis.fetch = (url, { signal }) => {
		calls.push({ url, signal });
		if (url.endsWith('.json')) return Promise.resolve(new Response('', { status: 503 }));
		return new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true }));
	};
	const warn = console.warn;
	console.warn = () => {};
	try {
		const c = city();
		c.update(camera(37.78, -122.45));
		await flush();
		assert.ok(calls.every((q) => q.signal.aborted));
		assert.equal(c.info().pending, 0);
		assert.equal(c.info().failed.length, 2);
	} finally { console.warn = warn; }
});

test('travel cancels old tile files and immediately starts the destination', async () => {
	const calls = [];
	globalThis.fetch = (url, { signal }) => new Promise((resolve, reject) => {
		calls.push({ url, signal, resolve });
		signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
	});
	const c = city();
	c.update(camera(37.78, -122.45));
	assert.equal(c.info().pending, 2);
	const old = calls.slice();
	c.update(camera(37.8, -122.26));
	assert.ok(old.every((q) => q.signal.aborted));
	assert.equal(c.info().pending, 2);
	await flush();
	assert.deepEqual(c.info().failed, []);
	assert.equal(c.info().pending, 2);
	assert.equal(c.info().cancelled, 2);
});

test('departing vertically cancels requests even without horizontal movement', async () => {
	const calls = [];
	globalThis.fetch = (url, { signal }) => new Promise((resolve, reject) => {
		calls.push(signal);
		signal.addEventListener('abort', () => reject(new DOMException('Cancelled', 'AbortError')), { once: true });
	});
	const c = city();
	c.update(camera(37.78, -122.45));
	c.update(camera(37.78, -122.45, 7000));
	assert.equal(c.info().pending, 0);
	assert.ok(calls.every((s) => s.aborted));
	await flush();
	assert.deepEqual(c.info().failed, []);
	c.update(camera(37.78, -122.45));
	assert.equal(c.info().pending, 2);
});

test('late callbacks from an earlier visit cannot clear a new visit to the same tile', async () => {
	browser();
	const calls = [];
	// A decoder or cache may settle after cancellation; deliberately ignore the signal here.
	globalThis.fetch = (url, { signal }) => new Promise((resolve) => calls.push({ url, signal, resolve }));
	const c = city();
	c.update(camera(37.78, -122.45));
	const old = calls.slice();
	c.update(camera(37.8, -122.26));
	c.update(camera(37.78, -122.45));
	assert.equal(c.info().pending, 2);
	for (const q of old) q.resolve(fixture(q.url));
	await flush();
	assert.equal(c.info().pending, 2);
	assert.deepEqual(c.info().live, []);
	assert.deepEqual(c.info().failed, []);
});

test('teardown aborts downloads and rejects late tile insertion', async () => {
	let closed = 0;
	browser(() => closed++);
	const calls = [];
	globalThis.fetch = (url, { signal }) => new Promise((resolve) => calls.push({ url, signal, resolve }));
	const c = city();
	c.update(camera(37.78, -122.45));
	c.dispose();
	assert.ok(calls.every((q) => q.signal.aborted));
	for (const q of calls) q.resolve(fixture(q.url));
	await flush();
	assert.equal(closed, 2);
	assert.equal(c.info().pending, 0);
	assert.deepEqual(c.info().live, []);
	assert.deepEqual(c.info().failed, []);
	assert.equal(c.loaded(), false);
	const n = calls.length;
	c.update(camera(37.8, -122.26));
	assert.equal(calls.length, n);
});

test('repeated world entry releases all three road targets, town maps and drawing resources', () => {
	globalThis.fetch = () => { throw new Error('Unexpected tile request'); };
	for (let run = 0; run < 3; run++) {
		const targets = new Set(), geometries = new Set(), materials = new Set(), counts = new Map();
		const watch = (o, set) => { if (!set.has(o)) { set.add(o); counts.set(o, 0); o.addEventListener('dispose', () => counts.set(o, counts.get(o) + 1)); } };
		const renderer = { getRenderTarget: () => null, getClearColor: (c) => c.set(0), getClearAlpha: () => 1, setClearColor() {}, clear() {}, setRenderTarget(t) { if (t) watch(t, targets); }, render(s) { for (const m of s.children) { watch(m.geometry, geometries); watch(m.material, materials); } } };
		const c = city(renderer);
		const G = c.addRegion({ name: 'fixture', bounds: [0, 0, 100, 100], roads: [], boxes: [], paths: [], pools: [], trees: [], map: { px: new Uint8Array(4), w: 1, h: 1, step: 100, x0: 0, z0: 0 } });
		let townDisposals = 0;
		G.tex.addEventListener('dispose', () => townDisposals++);
		c.update({ position: { x: 50, y: 10, z: 50 } });
		c.update({ position: { x: 50, y: 10, z: 50 } });
		assert.equal(targets.size, 3);
		c.dispose(); c.dispose();
		assert.equal(townDisposals, 1);
		for (const o of [...targets, ...geometries, ...materials]) assert.equal(counts.get(o), 1);
		assert.equal(REAL_U.uRealR.value.w, 0);
		assert.equal(REAL_U.uRoadR.value.w, 0);
		assert.equal(REAL_U.uRoadR2.value.w, 0);
		assert.notEqual(REAL_U.uRealMap.value, G.tex);
		assert.deepEqual(c.R.regions, []);
	}
});

test('phone road maps avoid multisample attachments and use a quarter of the pixels', () => {
	const mobile = createRealCity({}, { isPhone: true });cities.push(mobile);
	const desktop = city();
	assert.equal(mobile.rt.width, 1024);assert.equal(mobile.rt.height, 1024);
	assert.equal(mobile.rt.samples, 0);
	assert.equal(desktop.rt.width, 2048);assert.equal(desktop.rt.samples, 4);
	assert.equal(mobile.rt.depthBuffer, false);
});
