// node island/tools/multiplayer.test.mjs: the multiplayer client's pure parts (no browser)
import { followStep, besideOf, RADIUS } from '../src/net/follow.js';
// The render module imports the sound bus; initialize only its browser event boundary.
globalThis.addEventListener ||= () => {};
globalThis.window ||= globalThis;
const { sample } = await import('../src/net/remotes.js');
import { createRoomClient } from '../src/net/client.js';
import { keptRoom, keepRoom, shouldRejoin, ROOM_KEY, REJOIN_MS } from '../src/net/rejoin.js';

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) pass++; else { fail++; console.log('  FAIL', msg); } };

// ---------- follow ----------
{
	const me = { x: 0, y: 1.7, z: 0, yaw: 0 };
	const near = followStep(me, { x: 2, y: 1.7, z: 2 });
	ok(near.mx === 0 && near.mz === 0, 'inside the ring: no carry');
	// leader 20 m ahead (-z is forward at yaw 0)
	const ahead = followStep(me, { x: 0, y: 1.7, z: -20 });
	ok(ahead.mz < -0.9 && Math.abs(ahead.mx) < 1e-9 && ahead.run, 'ahead: forward, running when far');
	// the follower looking the other way is still carried toward the leader
	const back = followStep({ ...me, yaw: Math.PI }, { x: 0, y: 1.7, z: -20 });
	ok(back.mz > 0.9, 'looking away: carried backward toward them');
	const right = followStep(me, { x: 10, y: 1.7, z: 0 });
	ok(right.mx > 0.9 && Math.abs(right.mz) < 1e-9, 'to the right: strafes right');
	ok(followStep(me, { x: 400, y: 0, z: 0 }).jump, 'far away: put beside them');
	const fly = followStep(me, { x: 0, y: 40, z: -10, fly: true });
	ok(fly.fly && fly.up && !fly.down, 'a flying leader: fly, and climb to them');
	// simulate: a walker at 5 m/s, a follower at up to 10 m/s, stays within the radius + a little
	const L = { x: 0, y: 0, z: 0, yaw: 0 }, F = { x: 3, y: 0, z: 3, yaw: 1 };
	let worst = 0;
	for (let i = 0; i < 600; i++) {
		const dt = 1 / 30;
		L.z -= 5.2 * dt; if (i > 300) L.x += 5.2 * dt;
		const s = followStep(F, L);
		const fx = -Math.sin(F.yaw), fz = -Math.cos(F.yaw), rx = Math.cos(F.yaw), rz = -Math.sin(F.yaw);
		const sp = s.run ? 10 : 5.2;
		F.x += (fx * -s.mz + rx * s.mx) * sp * dt; F.z += (fz * -s.mz + rz * s.mx) * sp * dt;
		F.yaw += 0.01;
		if (i > 60) worst = Math.max(worst, Math.hypot(L.x - F.x, L.z - F.z));
	}
	ok(worst < RADIUS + 2.5, `a walking leader is kept within reach (worst ${worst.toFixed(1)} m)`);
	const b = besideOf({ x: 0, z: 0, yaw: 0 });
	ok(b.z > 0 && Math.abs(b.x) < 1e-9, 'put down behind the leader');
}

// ---------- interpolation ----------
{
	const buf = [{ t: 0, p: [0, 0, 0], y: 0, a: 'walk' }, { t: 0.1, p: [1, 0, 0], y: 0.2, a: 'walk' }, { t: 0.2, p: [2, 0, 0], y: 0.4, a: 'run' }];
	const s = sample(buf, 0.05);
	ok(Math.abs(s[0] - 0.5) < 1e-9 && Math.abs(s.y - 0.1) < 1e-9 && Math.abs(s.speed - 10) < 1e-6, 'between two poses');
	const x = sample(buf, 0.3);
	ok(Math.abs(x[0] - 3) < 1e-9, 'a little past the last: carried on');
	const h = sample(buf, 2);
	ok(Math.abs(h[0] - 4.5) < 1e-9 && h.speed === 0, 'long past: held');
	const wrap = sample([{ t: 0, p: [0, 0, 0], y: 3.1 }, { t: 1, p: [0, 0, 0], y: -3.1 }], 0.5);
	ok(Math.abs(Math.abs(wrap.y) - Math.PI) < 0.01, 'the heading turns the short way');
}

// ---------- the connection ----------
{
	const made = [];
	class FakeWS {
		constructor(u) { this.url = u; this.readyState = 0; this.sent = []; made.push(this); }
		send(m) { this.sent.push(m); }
		close(code = 1000) { this.readyState = 3; this.onclose?.({ code }); }
		open(msg) { this.readyState = 1; this.onmessage?.({ data: JSON.stringify(msg) }); }
	}
	const seen = [];
	const timers = [];
	const realSet = globalThis.setTimeout;
	globalThis.setTimeout = (fn, ms) => { timers.push(ms); return realSet(fn, 0); };
	const C = createRoomClient({ url: 'https://rooms.test', id: 'me-123456', name: () => 'Me', seed: 5, WS: FakeWS, on: (t, v) => seen.push([t, v]) });
	ok(C.join('abc-def') === true && made.length === 1, 'joins with a cleaned code');
	ok(/^wss:\/\/rooms\.test\/rooms\/ABCDEF\/ws\?id=me-123456&name=Me&seed=5$/.test(made[0].url), 'the address carries the hello');
	made[0].open({ t: 'welcome', you: 'me-123456', host: 'me-123456', code: 'ABCDEF', players: [{ id: 'me-123456' }, { id: 'f-1234567', name: 'F' }] });
	ok(C.status === 'on' && C.isHost() && C.players.size === 1, 'welcomed as host, with one friend');
	ok(C.send({ t: 'pose', p: [0, 0, 0] }) && made[0].sent.length === 1, 'sends when open');
	made[0].close(1006);
	ok(C.status === 'reconnecting', 'a dropped line reconnects');
	await new Promise((r) => realSet(r, 10));
	ok(made.length === 2 && timers.at(-1) >= 800 && timers.at(-1) <= 1200, 'after about a second');
	made[1].close(1006);
	await new Promise((r) => realSet(r, 10));
	ok(timers.at(-1) >= 1600, 'backing off');
	made[2].open({ t: 'welcome', you: 'me-123456', host: 'f-1234567', code: 'ABCDEF', players: [] });
	ok(C.status === 'on' && !C.isHost(), 'back in, as a guest now');
	made[2].close(4000);
	await new Promise((r) => realSet(r, 10));
	ok(C.status === 'off' && made.length === 3 && seen.some(([t, v]) => t === 'closed' && v.code === 4000), 'an ended room does not reconnect');
	globalThis.setTimeout = realSet;
}

console.log(`${pass} passed, ${fail} failed`);
// ---------- back into the room you were in (net/rejoin.js) ----------
{
	const mem = new Map(), store = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
	ok(keptRoom(store, 1000) === null, 'nothing kept: nothing to go back to');
	keepRoom(store, 'qqjzf3', 1000);
	ok(keptRoom(store, 1000 + 60000) === 'QQJZF3', 'a room joined is kept, cleaned to its code');
	ok(keptRoom(store, 1000 + REJOIN_MS + 1) === null, 'an old one is let go');
	ok(shouldRejoin(store, '?room=ABCDEF', 2000) === null, 'a room link in the address is the join instead');
	ok(shouldRejoin(store, '?at=xyz', 2000) === 'QQJZF3', 'another link leaves the kept room to go back to');
	keepRoom(store, null, 3000);
	ok(keptRoom(store, 3000) === null && !mem.has(ROOM_KEY), 'leaving forgets it');
	keepRoom(store, 'not a code', 3000);
	ok(!mem.has(ROOM_KEY), 'a bad code keeps nothing');
	mem.set(ROOM_KEY, '{bad json');
	ok(keptRoom(store, 3000) === null, 'a spoilt entry is nothing');
	const broken = { getItem: () => { throw new Error('off'); }, setItem: () => { throw new Error('off'); }, removeItem: () => {} };
	keepRoom(broken, 'QQJZF3');
	ok(keptRoom(broken) === null, 'storage off: quietly nothing');
}

process.exit(fail ? 1 : 0);
