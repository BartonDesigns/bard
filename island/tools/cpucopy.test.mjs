// world/cpucopy.js: a texture's picture let go once uploaded, and asked back when the graphics are lost
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { shedImage, refillShed, keepImage, shedInfo } from '../src/world/cpucopy.js';

const original = { document: globalThis.document, ImageBitmap: globalThis.ImageBitmap, HTMLCanvasElement: globalThis.HTMLCanvasElement };
// the browser's bits the module touches: 1x1 canvases, bitmaps that close
class FakeCanvas { constructor() { this.width = 300; this.height = 150; } getContext() { return { clearRect() {}, drawImage() {}, fillRect() {}, getImageData: () => ({ data: new Uint8ClampedArray([10, 20, 30, 255]) }), imageSmoothingEnabled: true, imageSmoothingQuality: 'low', fillStyle: '' }; } }
class FakeBitmap { constructor(w = 512, h = 512) { this.width = w; this.height = h; this.closed = false; } close() { this.closed = true; } }
beforeEach(() => {
	globalThis.document = { createElement: (tag) => { assert.equal(tag, 'canvas'); return new FakeCanvas(); } };
	globalThis.ImageBitmap = FakeBitmap;
	globalThis.HTMLCanvasElement = FakeCanvas;
});
afterEach(() => { Object.assign(globalThis, original); });

// a texture as three sees it: image through its source, onUpdate called after each upload
function texture(image) {
	const t = { isTexture: true, name: 'test', version: 1, source: { data: image }, onUpdate: null, needsUpdate: false };
	Object.defineProperty(t, 'image', { get() { return t.source.data; }, set(v) { t.source.data = v; } });
	Object.defineProperty(t, 'needsUpdate', { get() { return t._nu || false; }, set(v) { if (v) { t._nu = true; t.version++; } } });
	t.upload = () => { t.onUpdate?.(t); };   // what WebGLTextures does once the picture is on the card
	return t;
}

test('the picture is let go after the upload, and only then', () => {
	const bm = new FakeBitmap(), t = texture(bm);
	let reloads = 0;
	shedImage(t, () => { reloads++; return Promise.resolve(new FakeBitmap()); });
	assert.equal(t.image, bm, 'nothing happens before the upload');
	t.upload();
	assert.notEqual(t.image, bm, 'the image is replaced after the upload');
	assert.equal(t.image.width, 1); assert.equal(t.image.height, 1);
	assert.ok(bm.closed, 'the bitmap is closed');
	assert.equal(reloads, 0, 'no reload without a loss');
	keepImage(t);
});

test('a canvas is emptied, and a shed texture keeps its version (nothing to upload)', () => {
	const cv = new FakeCanvas(); cv.width = 512; cv.height = 512;
	const t = texture(cv), v = t.version;
	shedImage(t, () => Promise.resolve(new FakeCanvas()));
	t.upload();
	assert.equal(cv.width, 0); assert.equal(cv.height, 0);
	assert.equal(t.version, v, 'the source version is untouched: three sees nothing to upload');
	assert.equal(t.needsUpdate, false);
	keepImage(t);
});

test('a loss asks the picture back, marks it for upload, and the next upload sheds it again', async () => {
	const t = texture(new FakeBitmap());
	const fresh = new FakeBitmap(512, 512);
	let reloads = 0;
	shedImage(t, () => { reloads++; return Promise.resolve(fresh); });
	t.upload();
	await refillShed();
	assert.equal(reloads, 1);
	assert.equal(t.image, fresh, 'the picture is back');
	assert.equal(t.needsUpdate, true, 'and marked for upload');
	t.upload();
	assert.ok(fresh.closed, 'uploaded again, shed again');
	assert.equal(t.image.width, 1);
	keepImage(t);
});

test('a texture still holding its picture is not reloaded; one shed twice is one entry; off leaves it alone', async () => {
	const t = texture(new FakeBitmap()), u = texture(new FakeBitmap());
	let reloads = 0;
	shedImage(t, () => { reloads++; return Promise.resolve(new FakeBitmap()); });
	shedImage(t, () => { reloads += 100; return Promise.resolve(new FakeBitmap()); });
	shedImage(u, () => { reloads += 1000; return Promise.resolve(new FakeBitmap()); }, { on: false });
	await refillShed();
	assert.equal(reloads, 0, 'not uploaded yet: its picture is still there');
	t.upload(); u.upload();
	assert.equal(u.image.width, 512, 'off: the picture stays');
	await refillShed();
	assert.equal(reloads, 1, 'the first reload wins, the texture is one entry');
	assert.equal(shedInfo().shed, 1);
	keepImage(t); keepImage(u);
});

test('an existing onUpdate still runs, and a failed reload is only a warning', async () => {
	const t = texture(new FakeBitmap());
	let ran = 0;
	t.onUpdate = () => { ran++; };
	shedImage(t, () => Promise.reject(new Error('offline')));
	t.upload();
	assert.equal(ran, 1);
	const warn = console.warn; let warned = 0; console.warn = () => { warned++; };
	try { await refillShed(); } finally { console.warn = warn; }
	assert.equal(warned, 1);
	assert.equal(t.image.width, 1, 'still the placeholder');
	keepImage(t);
});
