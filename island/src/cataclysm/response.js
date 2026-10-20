// Who answers a catastrophe, and what the people about do. The services as they already work:
// the hurt told to the nearest hospital (services.injury: an ambulance, or walked in), fires
// set by the quake answered by an engine from the nearest station (combat's fires, which call
// services.dispatchFire), engines sent to a wildfire's front, a police cruiser to the scene
// (military/police.js) and the Meridian Guard's trucks and a helicopter (military/dispatch.js,
// a 'disaster' in military/rules.js FORCES). The people near you: in a quake they drop where
// they are and cover their heads while it shakes, then get away from the buildings and walk to
// a shelter (the nearest park, else open ground), where a relief station is put up; from a
// fire they get out of its way. Some are hurt (the nearest hospital hears), and the good-
// hearted among them stay to help the hurt: those needs are offered to people/npc-quests.js as
// a source, so whoever takes one is chosen by their own disposition, and their good deed goes
// on their compass and their region's like any other. When it is over everyone is let go.

import * as THREE from 'three';
import { isBuilding } from '../structures/overlap.js';
import { srgbToLinear as lin } from '../world/srgb.js';

const CALLS = {
	quake: ['Get away from the buildings!', 'Is everyone okay?', 'Stay down, stay down!', 'Over to the park, everyone!', 'Watch the glass!', 'My phone has no signal.'],
	wildfire: ['The fire is coming this way!', 'Go, go, get to the park!', 'I can smell the smoke from here.', 'They said to leave now!'],
	eruption: ['Cover your mouth, the ash!', 'Get inside or get to the shelter!', 'Look at the sky...'],
};
const HURT = ['Ah, my leg... I cannot walk on it.', 'Help... something hit me.', 'I need a doctor.', 'I am okay, I am okay... no, I am not.'];

// the relief station: two canopies on poles, cots, a table of water, a generator and a light
function reliefStation(x, y, z, yaw) {
	const P = [];
	const box = (lx, ly, lz, w, h, d, c) => {
		const g = new THREE.BoxGeometry(w, h, d).toNonIndexed();
		g.translate(lx, ly + h / 2, lz); g.rotateY(yaw); g.translate(x, y, z);
		const n = g.attributes.position.count, a = new Float32Array(n * 3), L = lin(c);
		for (let i = 0; i < n; i++) a.set(L, i * 3);
		g.setAttribute('color', new THREE.BufferAttribute(a, 3)); g.deleteAttribute('uv');
		P.push(g);
	};
	const WHITE = [0.93, 0.93, 0.9], STEEL = [0.55, 0.57, 0.6], BLUE = [0.16, 0.32, 0.62], GREEN = [0.24, 0.42, 0.26], DARK = [0.1, 0.1, 0.11], ORANGE = [0.95, 0.5, 0.1];
	for (const cx of [-3.3, 3.3]) {
		box(cx, 2.6, 0, 6, 0.12, 6, cx < 0 ? WHITE : BLUE);
		box(cx, 2.45, 2.98, 6, 0.3, 0.04, cx < 0 ? BLUE : WHITE);
		for (const [px, pz] of [[-2.9, -2.9], [2.9, -2.9], [2.9, 2.9], [-2.9, 2.9]]) box(cx + px, 0, pz, 0.07, 2.6, 0.07, STEEL);
		for (let i = 0; i < 3; i++) { box(cx - 1.8 + i * 1.8, 0.35, -1, 0.75, 0.08, 1.9, GREEN); box(cx - 1.8 + i * 1.8, 0, -1, 0.05, 0.35, 0.05, STEEL); }
	}
	box(0, 0.75, 2.2, 2.2, 0.06, 0.8, WHITE); box(-0.9, 0, 2.2, 0.06, 0.75, 0.6, STEEL); box(0.9, 0, 2.2, 0.06, 0.75, 0.6, STEEL);
	for (let i = 0; i < 6; i++) box(-0.8 + (i % 3) * 0.32, 0.81 + Math.floor(i / 3) * 0.3, 2.2, 0.28, 0.28, 0.28, [0.3, 0.55, 0.85]);
	box(7.2, 0, 1, 1.2, 0.9, 0.8, ORANGE); box(7.2, 0, -1.5, 0.12, 4.2, 0.12, DARK); box(7.2, 4.2, -1.5, 0.9, 0.3, 0.3, [1, 0.95, 0.75]);
	// (the sign: a white board with a cross of blue on it, and a stand)
	box(-7, 0, 2.5, 0.08, 1.4, 0.08, STEEL); box(-7, 1.4, 2.5, 1.4, 0.9, 0.06, WHITE); box(-7, 1.7, 2.47, 0.8, 0.22, 0.04, BLUE); box(-7, 1.55, 2.47, 0.22, 0.52, 0.04, BLUE);
	let n = 0;
	for (const g of P) n += g.attributes.position.count;
	const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
	let k = 0;
	for (const g of P) { pos.set(g.attributes.position.array, k * 3); nor.set(g.attributes.normal.array, k * 3); col.set(g.attributes.color.array, k * 3); k += g.attributes.position.count; g.dispose(); }
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
	geo.computeBoundingSphere();
	return geo;
}

export function createResponse(ctx) {
	const { scene, world, hooks, people, isPhone } = ctx;
	const W = () => world();
	const MAX = isPhone ? 10 : 26;
	const tracked = new Map();        // person -> state
	const needs = [];                 // the hurt: { id, p, name, x, z, kind: 'hurt'|'trapped'|'carry', sev, taken, done, by }
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0.05 });
	let ev = null, shelter = null, station = null, scanT = 0, callT = 8, phase = '', seq = 0, unsource = null, sent = { police: false, guard: false };
	const pos = (p) => p.M.S.pos;
	const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
	const adult = (p) => !(p?.P?.dna?.child || p?.P?.dna?.minor);
	const name = (p) => { try { return ctx.persona?.(p)?.first || ctx.persona?.(p)?.name || ''; } catch { return ''; } };
	const ground = (x, z) => { const w = W(); const h = w?.island?.heightAt?.(x, z) ?? 0; const f = w?.player?.floorAt?.(x, z, h + 2); return Number.isFinite(f) ? Math.max(h, f) : h; };
	const say = (p, text, gesture = 'shake', feel = { surprise: 0.6 }) => { try { if (p?.active && flat(pos(p), ctx.camera.position) < 30) hooks.chatter?.say?.(p, { text, gesture, feel }, null); } catch { /* the voices are not up */ } };

	// ---------- the shelter: the nearest park, else open ground away from the trouble ----------
	function findShelter(at, from) {
		const w = W(), parks = w?.parks;
		let best = null, bd = 1e9;
		if (parks?.parkAt) for (const r of [120, 260, 420, 620]) for (let k = 0; k < 12; k++) {
			const a = k / 12 * Math.PI * 2, x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r, P = parks.parkAt(x, z);
			if (!P || !Number.isFinite(P.x)) continue;
			const d = Math.hypot(P.x - at.x, P.z - at.z) + Math.max(0, 140 - Math.hypot(P.x - from.x, P.z - from.z)) * 2;
			if (d < bd) { bd = d; best = { x: P.x, z: P.z, name: P.name || 'the park', park: true }; }
		}
		if (best && bd < 900) return best;
		// open ground: away from the trouble, no building within 25 m, not water, not steep
		const away = Math.atan2(at.z - from.z, at.x - from.x);
		for (let k = 0; k < 28; k++) {
			const a = away + (k % 7 - 3) * 0.35, r = 70 + Math.floor(k / 7) * 60, x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
			const h = w?.island?.heightAt?.(x, z) ?? 0;
			if (h < 0.8 || Math.abs((w?.island?.heightAt?.(x + 6, z) ?? h) - h) > 2.5) continue;
			if ((w?.city?.lotsNear?.(x, z, 25) || []).some(isBuilding)) continue;
			return { x, z, name: 'open ground', park: false };
		}
		return { x: at.x + Math.cos(away) * 120, z: at.z + Math.sin(away) * 120, name: 'open ground', park: false };
	}
	function putStation(S) {
		dropStation();
		const y = ground(S.x, S.z), yaw = Math.random() * Math.PI * 2;
		station = new THREE.Mesh(reliefStation(S.x, y, S.z, yaw), mat);
		station.castShadow = !isPhone; station.receiveShadow = true;
		station.name = 'cataclysm-relief';
		scene.add(station);
	}
	function dropStation() { if (station) { scene.remove(station); station.geometry.dispose(); station = null; } }

	// ---------- the people near you ----------
	function steer(p, S) {
		const fn = (q, dt) => act(q, S, dt);
		S.fn = fn; p.override = fn; p.held = true;
	}
	function release(p) {
		const S = tracked.get(p);
		if (!S) return;
		tracked.delete(p);
		if (p.override === S.fn) { p.override = null; p.M.act?.(null); }
		if (!p.heldBy) p.held = false;
	}
	function act(p, S, dt) {
		if (p.leaving || !p.active) { release(p); return false; }
		const M = p.M, at = pos(p);
		S.t += dt;
		if (S.mode === 'cover') {
			M.want.speed = 0; M.act?.('crouch', 0);
			return true;
		}
		if (S.mode === 'hurt' || S.mode === 'trapped') {
			M.want.speed = 0; M.act?.('crouch', 0);
			if (S.face) M.want.heading = Math.atan2(S.face.x - at.x, S.face.z - at.z);
			return true;
		}
		if (S.mode === 'follow') {
			// helped along by you (a quest): a step behind, limping
			const c = ctx.camera.position, d = Math.hypot(c.x - at.x, c.z - at.z);
			M.act?.(null);
			if (d > 2.2) { M.want.heading = Math.atan2(c.x - at.x, c.z - at.z); M.want.speed = Math.min(d > 12 ? 3.2 : 1.6, d); M.want.run = d > 12 ? 1 : 0; } else M.want.speed = 0;
			return true;
		}
		M.act?.(null);
		if (S.mode === 'flee') {
			let ax = at.x - S.from.x, az = at.z - S.from.z;
			const l = Math.hypot(ax, az) || 1; ax /= l; az /= l;
			M.want.heading = Math.atan2(ax + az * S.side, az - ax * S.side);
			M.want.speed = adult(p) ? 3.4 : 1.8; M.want.run = adult(p) ? 1 : 0;
			M.S.look.target = null;
			if (S.t > S.until) { S.mode = shelter ? 'walk' : 'gather'; S.t = 0; }
			return true;
		}
		if (S.mode === 'walk') {
			const T = S.spot;
			const d = Math.hypot(T.x - at.x, T.z - at.z);
			if (d < 2) { S.mode = 'gather'; S.t = 0; M.want.speed = 0; return true; }
			M.want.heading = Math.atan2(T.x - at.x, T.z - at.z);
			M.want.speed = d > 60 ? 2.2 : 1.5; M.want.run = 0;
			// (stuck, or too long about it: they are there as far as anyone can tell)
			if (S.t > 240) { S.mode = 'gather'; S.t = 0; }
			return true;
		}
		// gathered: standing about, looking back towards it, now and then a word
		M.want.speed = 0;
		if (S.t % 9 < dt && ev) M.want.heading = Math.atan2(ev.x - at.x, ev.z - at.z) + (Math.random() - 0.5) * 1.2;
		M.setPose?.(S.pose);
		return true;
	}
	function track(p, mode, extra = {}) {
		let S = tracked.get(p);
		if (!S) {
			if (tracked.size >= MAX && mode !== 'hurt' && mode !== 'trapped') return null;
			S = { mode, t: 0, until: 6 + Math.random() * 8, side: Math.random() < 0.5 ? -0.35 : 0.35, from: { x: ev?.x ?? 0, z: ev?.z ?? 0 }, spot: null, pose: Math.random() < 0.5 ? 'crossed' : 'rest' };
			tracked.set(p, S);
		}
		Object.assign(S, { mode, t: 0 }, extra);
		if (!S.spot && shelter) { const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * 18; S.spot = { x: shelter.x + Math.cos(a) * r, z: shelter.z + Math.sin(a) * r }; }
		steer(p, S);
		return S;
	}
	const pool = () => people?.pool || [];
	// everyone near you takes cover (a quake) or gets out of the way (a fire), a share of the
	// good-hearted left free to help
	function scan() {
		const c = ctx.camera.position;
		for (const p of pool()) {
			if (!p.active || p.leaving || p.P?.ragdoll || p.demo !== undefined) continue;
			if (tracked.has(p)) continue;
			if (p.heldBy || (p.override && !p.override.npcq)) continue;
			const q = pos(p);
			if (Math.hypot(q.x - c.x, q.z - c.z) > 110) continue;
			if (phase === 'shaking') { track(p, Math.random() < 0.75 ? 'cover' : 'flee'); continue; }
			// the helpers stay free (npc-quests matches them with the hurt)
			if (adult(p) && helper(p) && needs.some((n) => !n.taken && !n.done)) continue;
			track(p, 'flee', { from: fromFor(q), until: 3 + Math.random() * 6 });
		}
	}
	function helper(p) {
		const seed = p.P?.dna?.seed >>> 0;
		try { const d = hooks.npcQuests?.disposition?.(seed); return !!d && d.protect + d.mercy > 0.45; } catch { return false; }
	}
	// where to run from: a fire's nearest flames, a quake's broken buildings or its heart
	function fromFor(q) { const f = ctx.threat?.(q.x, q.z); return f || { x: ev?.x ?? q.x, z: ev?.z ?? q.z }; }

	// ---------- the hurt ----------
	// p hurt with severity sev; kind 'hurt' (the services told), 'trapped' or 'carry' (yours to help)
	function injure(p, sev = 0.5, kind = 'hurt', face = null) {
		if (!p || needs.some((n) => n.p === p)) return null;
		const q = pos(p);
		const nm = name(p) || (adult(p) ? 'Someone' : 'A child');
		const N = { id: `cat:${++seq}`, p, name: nm, x: q.x, z: q.z, kind, sev, taken: null, done: false };
		needs.push(N);
		track(p, kind === 'trapped' ? 'trapped' : 'hurt', { face });
		say(p, kind === 'trapped' ? 'Help! I am stuck, I cannot get out!' : HURT[seq % HURT.length], 'shake', { sad: 0.6, surprise: 0.4 });
		if (kind === 'hurt') tell(N);
		return N;
	}
	// the nearest hospital told (an ambulance, or walked in), the hurt then theirs
	function tell(N) {
		try { W()?.services?.injury?.(N.p, ctx.cause?.() || 'the disaster', N.sev); } catch { /* no services here */ }
	}
	// a need met: by you (quests.js) or someone near (npc-quests.js); the hurt may walk again
	function met(N, by = 'player') {
		if (N.done) return;
		N.done = true; N.by = by;
		const p = N.p;
		if (N.kind === 'trapped' || N.sev > 0.45) { if (by !== 'player-carry') tell(N); return; }
		if (p?.active) track(p, shelter ? 'walk' : 'gather');
	}
	// the hurt, as quests for the people about (people/npc-quests.js sources)
	const source = {
		id: 'cataclysm',
		near(x, z, r) {
			const out = [];
			const region = hooks.npcQuests?.regionNow?.()?.id || '';
			for (const N of needs) {
				if (N.taken || N.done || N.kind === 'carry' || !N.p?.active || Math.hypot(N.x - x, N.z - z) > r) continue;
				const at = { x: N.x, z: N.z, name: N.name, who: N.p };
				out.push({ id: N.id, kind: 'cataclysm.help', title: N.kind === 'trapped' ? `Get ${N.name} out` : `Help ${N.name}`, giver: { type: 'person', id: 'npc:' + ((N.p.P?.dna?.seed ?? 0) >>> 0), name: N.name, x: N.x, z: N.z },
					steps: [{ do: 'go', at }, { do: 'wait', at }], reward: { credits: 0 }, deeds: { done: 'disaster-help' }, tempt: 0.02, region });
			}
			return out;
		},
		take(id, who) { const N = needs.find((n) => n.id === id); if (!N || N.taken || N.done) return false; N.taken = who; return true; },
		complete(id, who, outcome) { const N = needs.find((n) => n.id === id); if (!N) return; if (outcome === 'done') met(N, who); else N.taken = null; },
	};

	// ---------- the units ----------
	function sendUnits(at, severity) {
		const M = hooks.military;
		// (the police through law and order's call line, combat.hooks.event (law/): it is reported and
		// a unit goes; with nobody about to call it in, straight to the police)
		if (!sent.police) { try { const e = { kind: 'disaster', x: at.x, z: at.z, severity: 1 + Math.round(severity * 2) }; sent.police = !!(hooks.combat?.hooks?.event?.(e) || M?.police?.event?.(e)); } catch { /* no police here */ } }
		if (!sent.guard && severity > 0.35) { try { sent.guard = !!M?.dispatch?.event?.({ kind: 'disaster', x: at.x, z: at.z, severity: 1 + Math.round(severity * 2) }); } catch { /* no bases here */ } }
	}
	// an engine to a fire front: crew(x, z) is where its crew is put down (their hose: ctx.hose)
	let engineN = 0;
	function engineTo(x, z) {
		const S = W()?.services;
		if (!S?.dispatchFire) return false;
		const id = `cat-front:${++engineN}`;
		try { return S.dispatchFire({ id, x, z }, (cx, cz) => ctx.hose?.(cx, cz, x, z)); } catch { return false; }
	}

	// ---------- the event's course ----------
	function start(e) {
		ev = e; phase = ''; needs.length = 0; sent = { police: false, guard: false };
		shelter = findShelter(ctx.camera.position, e);
		putStation(shelter);
		unsource = hooks.npcQuests?.addSource?.(source) || null;
		return shelter;
	}
	function setPhase(ph) {
		phase = ph;
		if (ph === 'aftermath' || ph === 'burning' || ph === 'ash') {
			// up from cover, and away
			for (const [p, S] of tracked) if (S.mode === 'cover') { S.mode = 'flee'; S.t = 0; S.from = fromFor(pos(p)); S.until = 4 + Math.random() * 6; }
		}
	}
	function update(dt) {
		if (!ev) return;
		if ((scanT -= dt) <= 0) {
			scanT = 0.6;
			scan();
			// (someone else took hold of one: theirs until they let go, then ours again)
			for (const [p, S] of tracked) { if (!p.active || p.leaving) { release(p); continue; } if (p.override !== S.fn && !p.heldBy) steer(p, S); }
			for (const N of needs) if (!N.done && (!N.p?.active || N.p.leaving)) { N.done = true; N.by = N.p?.leaving ? 'services' : 'gone'; }
		}
		if ((callT -= dt) <= 0 && tracked.size) {
			callT = 7 + Math.random() * 9;
			const list = [...tracked.keys()].filter((p) => adult(p) && tracked.get(p).mode !== 'hurt' && tracked.get(p).mode !== 'trapped');
			const p = list[Math.floor(Math.random() * list.length)], L = CALLS[ev.kind] || CALLS.quake;
			if (p) say(p, L[Math.floor(Math.random() * L.length)], 'point', { surprise: 0.7 });
		}
	}
	function end() {
		for (const p of [...tracked.keys()]) release(p);
		needs.length = 0;
		unsource?.(); unsource = null;
		ev = null; phase = '';
	}
	// the relief station comes down once the crews have it in hand
	function strike() { dropStation(); shelter = null; }
	function info() {
		const modes = {};
		for (const S of tracked.values()) modes[S.mode] = (modes[S.mode] || 0) + 1;
		return { shelter: shelter && { name: shelter.name, at: [Math.round(shelter.x), Math.round(shelter.z)] }, people: modes, needs: needs.map((n) => ({ id: n.id, kind: n.kind, name: n.name, done: n.done, by: n.by || (n.taken ? `taken by ${n.taken}` : null) })), units: { ...sent } };
	}
	return { start, setPhase, update, end, strike, injure, met, track, release, sendUnits, engineTo, tracked, needs, info, shelter: () => shelter, station: () => station };
}
