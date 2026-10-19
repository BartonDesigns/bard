// A phone whose page the browser closed (while it loaded, or after) comes back lighter: off Ultra
// if it was on (world/device.js), else on the light ground (world/gpulite.js). Each case loads the modules
// fresh in their own process, with a phone's navigator and the storage the last visit left.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const src = new URL('../src/world/', import.meta.url).href;
function boot({ phone = true, stored = {} } = {}) {
	const script = `
		const m = new Map(Object.entries(${JSON.stringify(stored)}));
		globalThis.localStorage = { getItem: (k) => m.has(k) ? m.get(k) : null, setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
		Object.defineProperty(globalThis, 'navigator', { value: { userAgent: ${JSON.stringify(phone ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)' : 'Mozilla/5.0 (Macintosh)')}, platform: 'iPhone', maxTouchPoints: 5 }, configurable: true });
		globalThis.location = { search: '' };
		const d = await import(${JSON.stringify(src + 'device.js')});
		const g = await import(${JSON.stringify(src + 'gpulite.js')});
		console.log(JSON.stringify({ ULTRA: d.ULTRA, GFX_PHONE: d.GFX_PHONE, dropped: d.ULTRA_DROPPED, lite: g.GPU_LITE, crashed: d.LAST_VISIT_CRASHED, store: Object.fromEntries(m) }));`;
	return JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' }).trim());
}
const crashedRecord = JSON.stringify({ ceiling: 0, at: 0, crashes: [], live: Date.now() - 5000 });

test('Ultra on a phone stays on after a visit that said goodbye', () => {
	const r = boot({ stored: { 'l99-quality': 'ultra', 'l99-governor': JSON.stringify({ live: 0 }) } });
	assert.equal(r.ULTRA, true); assert.equal(r.GFX_PHONE, false); assert.equal(r.dropped, false); assert.equal(r.lite, false);
	assert.equal(r.store['l99-quality'], 'ultra');
});

test('a phone on Ultra whose page closed while loading comes back on Auto with phone graphics', () => {
	const r = boot({ stored: { 'l99-quality': 'ultra', 'l99-governor': crashedRecord } });
	assert.equal(r.ULTRA, false); assert.equal(r.GFX_PHONE, true); assert.equal(r.dropped, true);
	assert.equal(r.store['l99-quality'], 'auto');
	// (the phone's own graphics are tried before the light ground)
	assert.equal(r.lite, false);
});

test('a phone not on Ultra whose page closed while loading takes the light ground', () => {
	const r = boot({ stored: { 'l99-governor': crashedRecord } });
	assert.equal(r.crashed, true); assert.equal(r.lite, true); assert.equal(r.GFX_PHONE, true);
	assert.ok(+r.store['l99-gpu-lite3'] > 0);
});

test('a phone whose last visit said goodbye keeps the full ground', () => {
	const r = boot({ stored: { 'l99-governor': JSON.stringify({ live: 0 }) } });
	assert.equal(r.crashed, false); assert.equal(r.lite, false); assert.equal(r.ULTRA, false); assert.equal(r.GFX_PHONE, true);
});

test('a computer whose page closed keeps the full ground', () => {
	const r = boot({ phone: false, stored: { 'l99-governor': crashedRecord } });
	assert.equal(r.crashed, true); assert.equal(r.lite, false);
});
