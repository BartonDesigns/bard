// The frame readout (?perf) and the loading screen's black box, read on a phone.
//   node island/tools/perfmeter.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { perfWanted, frameStats, lostLine } from '../src/ui/perfmeter.js';

const memory = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) }; };

test('?perf turns the readout on for this device, ?perf=0 off', () => {
	const s = memory();
	assert.equal(perfWanted('', s), false);
	assert.equal(perfWanted('?perf', s), true);
	assert.equal(perfWanted('', s), true, 'kept on the device');
	assert.equal(perfWanted('?x=1&perf=0', s), false);
	assert.equal(perfWanted('', s), false);
	assert.equal(perfWanted('?perf=1', null), true, 'private mode still shows it');
});

test('a second of frames: per second, the average and the slowest', () => {
	assert.deepEqual(frameStats([]), { fps: 0, avg: 0, worst: 0 });
	assert.deepEqual(frameStats(Array(60).fill(1000 / 60)), { fps: 60, avg: 16.7, worst: 17 });
	assert.deepEqual(frameStats([20, 20, 60]), { fps: 30, avg: 33.3, worst: 60 });
});

test('where the last lost load stopped, with what the graphics held', () => {
	assert.equal(lostLine([]), '');
	assert.equal(lostLine(null), '');
	const lost = [{ stages: [[0, 'Opening your world', null, 40], [12.4, 'Shaping the landscape', 210, 90]], now: [41.2, 380, 120], hidden: false }];
	assert.equal(lostLine(lost), 'last load lost: "Shaping the landscape" at 41 s, 380 MB');
	assert.equal(lostLine([{ stages: [[3, 'Lighting the world', 120, null]], hidden: true }]), 'last load lost: "Lighting the world" at 3 s, 120 MB (in background)');
});
