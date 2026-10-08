// Family life in the world: the households of the streets round you (households.js) living
// their days (schedules.js) and eating as well as they can (food.js), and the moments of it
// you can see. Only those near you get bodies, a few at a time:
//   the school run: parents walking the little ones to the gate, the drop-off line, the
//     crossing guard with her sign, the yellow bus, the bell; at three the same in reverse;
//   teens after school and in the evening: on a low wall with their phones, a skateboard, a
//     ball, an instrument case, talking;
//   a parent carrying the groceries home, a child with the light bag;
//   a family at dinner, seen through the window;
//   the food bank's table under its canopy and the line (anyone may come), or the farmers'
//     market's stalls.
// Everyone walking the streets (people.js) is given a home too: their household, their
// day, how they are eating; it shows in their step and in what they say (persona.js).
//
// And the player's part: stock a family's kitchen, give to the food bank, fund a community
// garden, cook for a gathering, bring in fish or game for a village, help at the school
// crossing. Each is recorded on the morality compass (combat/morality.js) when it is there.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA } from './body.js';
import { createMotion } from './motion.js';
import { fadePerson } from './fade.js';
import { makeTeen } from './teens.js';
import { makeHousehold, makeHouseholds, describe, minorsOf, rng } from './households.js';
import { planDay, whereAt } from './schedules.js';
import { foodFor, liveDay, questsFor, recordDeed, helpStock, donate, makeFoodBank, makeGarden, fundGarden, feedVillage, cookFor, summary, storyOf, wellOf, mannerOf, ACCESS } from './food.js';
import { placeAt } from './wardrobe.js';
import { soundBus } from '../world/soundbus.js';
import { today } from '../calendar.js';
import { freeBody } from './social-actors.js';

const CELL = 300, NEAR = 160;
const hash = (a, b) => { let h = Math.imul(Math.floor(a) | 0, 374761393) ^ Math.imul(Math.floor(b) | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const HIVIS = '#d8f03a';

// ---------- the small things they carry and the things that stand about ----------
const M = {};
function mat(key, col, o = {}) { return (M[key] ||= new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, ...o })); }
function box(w, h, d, m, x = 0, y = 0, z = 0) { const q = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); q.position.set(x, y, z); q.castShadow = true; return q; }
function textPlane(text, w, h, bg = '#1f5f3a', fg = '#ffffff') {
	const c = document.createElement('canvas'); c.width = 512; c.height = Math.round(512 * h / w);
	const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, c.width, c.height);
	g.fillStyle = fg; g.font = `bold ${Math.round(c.height * 0.38)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
	const lines = text.split('\n'); lines.forEach((t, i) => g.fillText(t, c.width / 2, c.height * (i + 0.5) / lines.length, c.width * 0.92));
	const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
	return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7, side: THREE.DoubleSide }));
}
// a hand-held thing: { mesh, at: offset from the wrist (in the body's facing frame) }
function carried(kind) {
	const g = new THREE.Group();
	if (kind === 'bag') {
		g.add(box(0.3, 0.34, 0.16, mat('bag', 0xd8c7a0), 0, -0.2, 0));
		const greens = mat('greens', 0x4f8a2e); for (let i = 0; i < 3; i++) g.add(box(0.07, 0.12, 0.07, greens, -0.08 + i * 0.08, -0.01, 0));
		g.add(box(0.06, 0.16, 0.06, mat('baguette', 0xc89a5a), 0.1, 0.0, 0.03));
	} else if (kind === 'phone') g.add(box(0.07, 0.14, 0.01, mat('phone', 0x15161a, { roughness: 0.3 }), 0, -0.02, 0.04));
	else if (kind === 'skateboard') { g.add(box(0.2, 0.02, 0.78, mat('deck', 0x2c2c30), 0, -0.12, 0)); for (const z of [-0.26, 0.26]) g.add(box(0.2, 0.05, 0.05, mat('wheel', 0xe8e0c0), 0, -0.15, z)); g.rotation.z = 1.4; }
	else if (kind === 'ball') { const b = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), mat('ball', 0xd2662a)); b.castShadow = true; g.add(b); }
	else if (kind === 'guitar') { g.add(box(0.36, 0.95, 0.12, mat('case', 0x1b1b1d), 0, 0, 0)); }
	else if (kind === 'violin') { g.add(box(0.24, 0.62, 0.11, mat('vcase', 0x3a2a4a), 0, -0.1, 0)); }
	else if (kind === 'books') { g.add(box(0.22, 0.05, 0.3, mat('book1', 0x2354c7), 0, -0.03, 0.05)); g.add(box(0.21, 0.04, 0.29, mat('book2', 0xb3162b), 0, 0.01, 0.05)); }
	else if (kind === 'stop') { g.add(box(0.03, 1.1, 0.03, mat('pole', 0xcfcfcf), 0, 0.3, 0)); const s = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.02, 8).rotateX(Math.PI / 2).rotateZ(Math.PI / 8), mat('stopred', 0xc8102e)); s.position.y = 0.92; g.add(s); const t = textPlane('STOP', 0.3, 0.12, '#c8102e'); t.position.set(0, 0.92, 0.012); g.add(t); }
	return g;
}
// on the back: a guitar case, slung
const ON_BACK = new Set(['guitar']);

// a yellow school bus (a plain one: a long box with its windows and wheels)
function schoolBus() {
	const g = new THREE.Group(), y = mat('busyellow', 0xf2b705), dk = mat('busglass', 0x1d2630, { roughness: 0.2, metalness: 0.3 }), blk = mat('tyre', 0x161616);
	g.add(box(2.45, 2.2, 10.5, y, 0, 1.55, 0));
	g.add(box(2.4, 1.0, 1.4, y, 0, 1.0, 5.9));
	for (let i = 0; i < 8; i++) for (const s of [-1, 1]) g.add(box(0.02, 0.6, 0.9, dk, s * 1.235, 2.05, -4.4 + i * 1.18));
	g.add(box(2.2, 0.8, 0.02, dk, 0, 2.05, 5.26));
	g.add(box(2.46, 0.08, 10.5, blk, 0, 1.2, 0));
	for (const [x, z] of [[-1.1, 3.7], [1.1, 3.7], [-1.1, -3.3], [1.1, -3.3]]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.3, 14).rotateZ(Math.PI / 2), blk); w.position.set(x, 0.5, z); g.add(w); }
	const t = textPlane('SCHOOL BUS', 1.8, 0.3, '#f2b705', '#111111'); t.position.set(0, 2.5, 5.27); g.add(t);
	return g;
}
// a canopy over a folding table, its crates of produce and a sign
function stall(col, sign) {
	const g = new THREE.Group(), pole = mat('pole', 0xcfcfcf);
	for (const [x, z] of [[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]]) g.add(box(0.05, 2.3, 0.05, pole, x, 1.15, z));
	g.add(box(3.1, 0.08, 3.1, mat('canopy' + col, col), 0, 2.32, 0));
	g.add(box(2.6, 0.05, 0.8, mat('table', 0xe8e6e0), 0, 0.74, 0.4));
	for (const x of [-1.2, 1.2]) for (const z of [0.1, 0.7]) g.add(box(0.04, 0.72, 0.04, pole, x, 0.36, z));
	const produce = [0x4f8a2e, 0xc8322c, 0xf07a28, 0xe8c840, 0x7a3a8a, 0x9aa58a];
	for (let i = 0; i < 5; i++) {
		const x = -1.0 + i * 0.5;
		g.add(box(0.42, 0.18, 0.34, mat('crate', 0x9a7046), x, 0.86, 0.4));
		const fm = mat('fruit' + i, produce[(i + col) % produce.length]);
		for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), fm); f.position.set(x - 0.12 + (k % 3) * 0.12, 0.98, 0.33 + Math.floor(k / 3) * 0.13); g.add(f); }
	}
	if (sign) { const s = textPlane(sign, 2.6, 0.5, '#1f5f3a'); s.position.set(0, 2.05, 1.56); g.add(s); }
	return g;
}
// a table set for dinner, with chairs round it: the seats [{ x, z, heading }] in its frame
function dinnerTable(n) {
	const g = new THREE.Group(), wood = mat('dtable', 0x7a5236), plate = mat('plate', 0xf3f2ee, { roughness: 0.4 }), food = mat('dinner', 0xc0803a);
	const L = Math.max(1.2, Math.ceil(n / 2) * 0.62);
	g.add(box(0.9, 0.04, L, wood, 0, 0.75, 0));
	for (const [x, z] of [[-0.4, -L / 2 + 0.05], [0.4, -L / 2 + 0.05], [-0.4, L / 2 - 0.05], [0.4, L / 2 - 0.05]]) g.add(box(0.05, 0.74, 0.05, wood, x, 0.37, z));
	const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.12, 14), mat('pot', 0xb04a2a)); pot.position.set(0, 0.83, 0); g.add(pot);
	const seats = [];
	for (let i = 0; i < n; i++) {
		const side = i % 2 ? 1 : -1, row = Math.floor(i / 2), z = -L / 2 + 0.31 + row * 0.62;
		const x = side * 0.62;
		seats.push({ x, z, heading: side > 0 ? -Math.PI / 2 : Math.PI / 2 });
		g.add(box(0.42, 0.04, 0.42, wood, x, 0.45, z)); g.add(box(0.04, 0.5, 0.42, wood, x + side * 0.2, 0.7, z));
		for (const [a, b] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) g.add(box(0.03, 0.45, 0.03, wood, x + a, 0.22, z + b));
		const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.02, 16), plate); p.position.set(side * 0.25, 0.78, z); g.add(p);
		const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 6).scale(1, 0.4, 1), food); f.position.set(side * 0.25, 0.8, z); g.add(f);
	}
	return { g, seats };
}
// a room seen from the street: the back and side walls, a floor and ceiling, and the front
// wall with a wide window (for a family's dinner where no house is built for real)
function windowRoom(W, D) {
	const g = new THREE.Group(), wall = mat('wallpaint', 0xe8dcc4), out = mat('stucco', 0xc9b79a), floor = mat('floorwood', 0x8a6040);
	g.add(box(W, 0.1, D, floor, 0, -0.05, 0));
	g.add(box(W + 0.4, 0.15, D + 0.4, out, 0, 2.75, 0));
	g.add(box(W, 2.7, 0.15, wall, 0, 1.35, -D / 2));
	for (const s of [-1, 1]) g.add(box(0.15, 2.7, D, wall, s * W / 2, 1.35, 0));
	// the front: under and over the window, and beside it
	g.add(box(W + 0.3, 0.9, 0.2, out, 0, 0.45, D / 2));
	g.add(box(W + 0.3, 0.55, 0.2, out, 0, 2.43, D / 2));
	for (const s of [-1, 1]) g.add(box(0.5, 1.25, 0.2, out, s * (W / 2 - 0.1), 1.53, D / 2));
	const frame = mat('frame', 0xf3f2ee);
	g.add(box(W - 0.8, 0.06, 0.24, frame, 0, 0.92, D / 2)); g.add(box(0.06, 1.25, 0.24, frame, 0, 1.53, D / 2));
	const lamp = new THREE.PointLight(0xffd29a, 6, 7, 1.6); lamp.position.set(0, 2.3, 0); g.add(lamp);
	const shade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.2, 16, 1, true), mat('shade', 0xf7e7c0, { emissive: 0xffd29a, emissiveIntensity: 0.6, side: THREE.DoubleSide })); shade.position.set(0, 2.25, 0); g.add(shade);
	return g;
}

export function createFamilyLife({ scene, world, camera, people = null, isPhone = false, morality = () => null, wallet = null }) {
	const root = new THREE.Group(); root.name = 'family-life';
	scene.add(root);
	const W = () => world();
	const CAP = isPhone ? 5 : 12;
	let A = null, loading = null;
	const areas = new Map();
	const pending = [];                       // food deeds the compass does not know yet
	const banks = new Map(), gardens = new Map();
	let day = today().getDay(), lastH = null, scanT = 0, adoptT = 0, bellT = -1, guardT = 0, guarded = -1;
	const live = [];                          // the moments being shown
	// credits for good works: the game's wallet when given one, else a small purse kept here
	const purse = wallet || (() => {
		let n = 250;
		try { n = +(localStorage.getItem('l99-food-credits') ?? 250); } catch { /* private mode */ }
		return { credits: () => n, spend: (c) => { if (c > n) return false; n -= c; try { localStorage.setItem('l99-food-credits', String(n)); } catch { /* private mode */ } return true; } };
	})();

	const hours = () => W()?.sky?.state?.hours ?? 13;
	function ground(x, z) { const w = W(), g = (w.island.drawnAt ?? w.island.heightAt)(x, z), f = w.island.extraFloor?.(x, z, g + 1.2) ?? -1e9; return f > g && f < g + 2.5 ? f : g; }

	// ---------- the households round you (data only) ----------
	function areaAt(x, z) {
		const i = Math.floor(x / CELL), j = Math.floor(z / CELL), key = i + ',' + j;
		let a = areas.get(key);
		if (a) return a;
		const cx = (i + 0.5) * CELL, cz = (j + 0.5) * CELL;
		const w = W(), U = w?.bayArea?.urbanAt?.(cx, cz);
		const onIsland = w?.island && Math.max(Math.abs(cx), Math.abs(cz)) < w.island.half;
		let place = onIsland ? 'island' : placeAt(cx, cz, U && U.u > 0.2 ? (U.d > 0.35 ? 'downtown' : 'neighbourhood') : 'trail');
		if (!onIsland && (!U || U.u < 0.2)) place = 'rural';
		// some places have no supermarket in reach (one cell in seven in the city)
		const desert = (place === 'oakland' || place === 'sf') && hash(i * 7 + 1, j * 13 + 5) < 0.15;
		const seed = (Math.imul(i, 73856093) ^ Math.imul(j, 19349663)) >>> 0;
		const homes = [];
		const real = w?.houses?.houses;
		if (real) for (const h of real.values()) if (Math.floor(h.cx / CELL) === i && Math.floor(h.cz / CELL) === j) homes.push({ x: h.cx, z: h.cz, kind: 'house' });
		const n = onIsland ? 14 : 28;
		for (let k = homes.length; k < n; k++) homes.push({ x: cx + (hash(seed, k) - 0.5) * CELL, z: cz + (hash(k, seed) - 0.5) * CELL, kind: place === 'sf' ? 'flat' : 'house' });
		const camps = !onIsland && (place === 'oakland' || place === 'sf' || place === 'office') && hash(i * 3 + 7, j * 5 + 1) < 0.25 ? [{ x: cx, z: cz, kind: 'camp' }] : [];
		const H = makeHouseholds(seed, homes, { camps, rural: place === 'rural' || onIsland });
		const access = desert ? ACCESS['food-desert'] : onIsland ? ACCESS.island : ACCESS[place] || ACCESS.suburb;
		for (const h of H) foodFor(h, place, { access });
		a = { key, i, j, cx, cz, place, desert, households: H, bank: null, garden: null, plans: new Map(), planDay: -1 };
		a.bank = banks.get(key) || makeFoodBank('bank-' + key, { x: cx, z: cz }); banks.set(key, a.bank);
		a.garden = gardens.get(key) || makeGarden('garden-' + key, { x: cx, z: cz }); gardens.set(key, a.garden);
		// a few days lived already, so the houses are where their lives have them
		for (let d = 0; d < 7; d++) { const wd = (day + d + 1) % 7; for (const h of H) liveDay(h, planDay(h, wd), wd); }
		areas.set(key, a);
		if (areas.size > 16) { const first = areas.keys().next().value; areas.delete(first); }
		return a;
	}
	function plansOf(a) {
		if (a.planDay !== day) { a.plans.clear(); a.planDay = day; }
		for (const h of a.households) if (!a.plans.has(h.id)) a.plans.set(h.id, planDay(h, day));
		return a.plans;
	}
	// a new day: every house round you lives it
	function newDay() {
		day = (day + 1) % 7;
		for (const a of areas.values()) for (const h of a.households) liveDay(h, planDay(h, day), day);
	}

	// ---------- a home for everyone walking about ----------
	// each person on the street (people.js) gets a household: one of the area's whose member
	// fits (their age and sex, and out at this hour), or one of their own
	function adopt() {
		const pool = people?.pool;
		if (!pool) return;
		const h = hours();
		for (const p of pool) {
			if (!p.active || p.demo !== undefined || p.P.home) continue;
			const d = p.P.dna, a = areaAt(p.M.S.pos.x, p.M.S.pos.z), plans = plansOf(a);
			let best = null;
			for (const hh of a.households) {
				if (hh.taken >= hh.members.length) continue;
				for (const m of hh.members) {
					if (m.embodied || m.male !== d.male || Math.abs(m.age - d.age) > 5) continue;
					const w = whereAt(plans.get(hh.id), m.id, h);
					if (w.at === 'home' && w.act === 'sleep') continue;
					best = [hh, m]; break;
				}
				if (best) break;
			}
			if (!best) {
				const hh = makeHousehold(d.seed ^ 0x40e, null, d.child || d.teen ? { kind: 'two-parent' } : {});
				foodFor(hh, a.place, { access: a.desert ? ACCESS['food-desert'] : undefined });
				let m = hh.members.reduce((q, x) => (Math.abs(x.age - d.age) < Math.abs(q.age - d.age) ? x : q), hh.members[0]);
				m.age = d.age; m.male = d.male;
				best = [hh, m];
			}
			const [hh, m] = best;
			m.embodied = true; hh.taken = (hh.taken || 0) + 1;
			p.P.home = { household: hh, member: m, area: a.key };
			// how they are shows in their step
			const man = mannerOf(hh.well?.[m.id]);
			if (d.gait) { d.gait.basePace ??= d.gait.pace; d.gait.pace = d.gait.basePace * man.pace; d.gait.posture = (d.gait.posture || 0) + man.slump * 0.5; }
			if (p.persona) p.persona = null;
		}
	}

	// ---------- bodies for a moment ----------
	async function assets() { if (A) return A; loading ||= loadPeopleAssets().then((x) => (A = x)).catch(() => null); return loading; }
	function body(spec) {
		const ctx = { hours: hours(), place: spec.place || 'suburb', activity: 'walk' };
		const teen = spec.age >= 13 && spec.age < 18;
		let d = personDNA(spec.seed >>> 0, { age: teen ? 18 : spec.age, ancestry: spec.ancestry, ctx });
		if (spec.male !== undefined && d.male !== spec.male) { d = personDNA((spec.seed ^ 0x9e3779b9) >>> 0, { age: teen ? 18 : spec.age, ancestry: spec.ancestry, ctx }); }
		if (teen) makeTeen(d, spec.age, { cold: 0.35, uniform: spec.uniform, sport: spec.sport, school: spec.school });
		if (spec.style) { const keep = d.style; d.style = { ...spec.style, hair: keep.hair, printKind: keep.printKind, acc: [...(spec.style.acc || [])] }; d.styleSig = JSON.stringify(d.outfit); }
		if (spec.acc) d.style.acc = [...(d.style.acc || []), ...spec.acc];
		const P = buildPerson(A, d);
		const Mo = createMotion(P, (x, z) => ground(x, z));
		root.add(P.root);
		return { P, M: Mo, spec, props: [], fade: 0 };
	}
	function attach(a, kind, side = 'R') {
		const g = carried(kind);
		root.add(g);
		a.props.push({ g, side, kind, back: ON_BACK.has(kind) });
		if (!ON_BACK.has(kind) && kind !== 'stop') a.M.grip(side, 1);
		return g;
	}
	const wv = new THREE.Vector3();
	function placeProps(a, t) {
		const S = a.M.S, h = S.heading, fx = Math.sin(h), fz = Math.cos(h);
		for (const q of a.props) {
			if (q.back) { q.g.position.set(S.pos.x - fx * 0.2, S.pos.y + a.P.height * 0.6, S.pos.z - fz * 0.2); q.g.rotation.set(0, h, 0.35); continue; }
			const i = a.P.map['wrist.' + q.side];
			a.P.bones[i].getWorldPosition(wv);
			q.g.position.copy(wv);
			if (q.kind === 'ball' && a.bounce) q.g.position.y = S.pos.y + 0.12 + Math.abs(Math.sin(t * 3.2 + a.P.dna.seed)) * (wv.y - S.pos.y - 0.12);
			q.g.rotation.set(0, h, q.kind === 'skateboard' ? 1.4 : 0);
		}
	}

	// ---------- the moments ----------
	// each: { kind, x, z, h, group, actors: [{ P, M, path, follow, sit, ... }], t }
	function frameOf(x, z, h) { const fx = Math.sin(h), fz = Math.cos(h), sx = Math.cos(h), sz = -Math.sin(h); return (f, s) => [x + fx * f + sx * s, z + fz * f + sz * s]; }
	function actor(V, spec, at, heading, o = {}) {
		if (V.actors.length >= CAP) return null;
		const a = body(spec);
		a.M.place(at[0], o.y ?? ground(at[0], at[1]), at[1], heading);
		Object.assign(a, o);
		// (on a floor of its own: the room's, a house's)
		if (o.y !== undefined) a.M.setGround(() => o.y);
		if (o.pose) a.M.setPose(o.pose);
		if (o.sit) { a.M.sit(o.sit, true); a.M.setPose(o.pose || 'table'); }
		if (o.carry) for (const c of [].concat(o.carry)) attach(a, ...[].concat(c));
		fadePerson(a.P, 0.02);
		V.actors.push(a);
		return a;
	}
	const memberSpec = (m, place, extra = {}) => ({ seed: m.seed, age: Math.max(2.5, m.age), male: m.male, ancestry: m.ancestry, place, ...extra });
	function family(a, want = (h) => minorsOf(h).some((m) => m.age < 11), r = Math.random) {
		const L = a.households.filter(want);
		return L.length ? L[Math.floor(r() * L.length)] : null;
	}
	const HIVIS_STYLE = { gen: 'x', top: { kind: 'longsleeve', col: '#1f2a44', pat: 'plain', fit: 'regular', sleeves: 'long' }, outer: { kind: 'pufferVest', col: HIVIS, acc: '#c9ccd0', pat: 'block', fit: 'regular', sleeves: 'none', open: false, fab: 'nylon' }, bottom: { kind: 'trousers', col: '#1f2a44', pat: 'plain', legs: 'long', fit: 'straight' }, shoes: { kind: 'runner', col: '#1b1b1d', sole: '#1b1b1d' }, acc: [{ kind: 'cap', col: HIVIS, acc: '#1b1b1d' }] };

	async function stage(kind, o = {}) {
		await assets();
		if (!A) return 'people assets failed';
		const cam = camera.position, w = W(), P = w?.player?.state;
		const yaw = o.heading ?? (P ? P.yaw + Math.PI : 0);
		const dist = o.dist ?? 9;
		let x = o.x ?? cam.x + Math.sin(yaw) * dist, z = o.z ?? cam.z + Math.cos(yaw) * dist, h = o.h ?? (kind === 'dinner' ? yaw + Math.PI : yaw + Math.PI / 2);
		// on the nearest pavement, along it; the side away from the street toward the place
		// itself (the school's gate, the stall's table)
		if (o.sidewalk !== false && people?.sidewalk && (o.x === undefined || o.sidewalk)) {
			const s = people.sidewalk(x, z);
			if (s && Math.hypot(s[0] - x, s[1] - z) < (o.sidewalk ? 150 : 25)) {
				const tx = x, tz = z;
				x = s[0]; z = s[1]; h = s[2];
				const away = o.sidewalk ? (tx - x) * Math.cos(h) - (tz - z) * Math.sin(h) : (x - cam.x) * Math.cos(h) - (z - cam.z) * Math.sin(h);
				if (away < 0) h += Math.PI;
			}
		}
		clear();
		const V = { kind, x, z, h, group: new THREE.Group(), actors: [], t: 0, seed: (o.seed ?? Math.floor(x * 13 + z * 7)) >>> 0 };
		root.add(V.group);
		const a = areaAt(x, z), r = rng(V.seed), F = frameOf(x, z, h), y0 = ground(x, z), place = a.place;
		const put = (obj, f, s, rot = 0, y = null) => { const [px, pz] = F(f, s); obj.position.set(px, y ?? ground(px, pz), pz); obj.rotation.y = h + rot; V.group.add(obj); return obj; };
		if (kind === 'school-run' || kind === 'dismissal') {
			const out = kind === 'dismissal';
			// the gate and its sign, the bus at the kerb, the crossing guard
			const sign = textPlane(o.name || 'Lincoln Elementary\nAll welcome', 2.4, 0.8, '#1f3f6a'); put(sign, 2, 3.75, -Math.PI / 2, y0 + 2.1);
			for (const s of [-0.9, 0.9]) put(box(0.15, 1.8, 0.15, mat('gate', 0x3a3a3a)), s + 2, 3.6, 0, y0 + 0.9);
			put(schoolBus(), 16, -3.6, 0);
			const g = actor(V, { seed: V.seed ^ 0x6a1d, age: 58 + r() * 10, male: r() < 0.5, place, style: HIVIS_STYLE }, F(0, -2.2), h - Math.PI / 2, { role: 'guard', carry: [['stop', 'R']], pose: 'rest' });
			if (g) g.M.S.look.target = new THREE.Vector3(...[F(-6, 0)[0], y0 + 1.4, F(-6, 0)[1]]);
			// families walking up (or out), the parents with the little ones by the hand
			for (let k = 0; k < 4 && V.actors.length < CAP - 1; k++) {
				const hh = family(a, (q) => minorsOf(q).some((m) => m.age >= 4 && m.age < 11), r);
				if (!hh) break;
				const kid = minorsOf(hh).find((m) => m.age >= 4 && m.age < 11), par = hh.members.find((m) => m.age >= 18) || hh.members[0];
				const f0 = out ? 2.5 - k * 0.4 : -10 - k * 4.5, s0 = out ? 3 : 0.4;
				const pa = actor(V, memberSpec(par, place), F(f0, s0), out ? h + Math.PI : h, { role: 'parent', path: out ? [F(2.5, 0.4), F(-30, 0.4)] : [F(1.2, 0.4), F(2, 2.6)], wait: out ? 4 + k * 3 : k * 1.2, speed: 1.15 });
				const ch = actor(V, memberSpec(kid, place, { acc: [{ kind: 'backpack', col: ['#2354c7', '#e43b86', '#b8e04a', '#f07a28'][k % 4], acc: '#1b1b1d' }] }), F(f0, s0 + 0.45), out ? h + Math.PI : h, { role: 'child', follow: pa, side: 0.45, hold: true });
				if (!pa || !ch) break;
			}
			// a few teens on their way, in a knot
			for (let k = 0; k < 3 && V.actors.length < CAP; k++) actor(V, { seed: V.seed + 77 * k, age: 13 + r() * 4, place, uniform: o.uniform }, F(-6 - k * 0.8, -0.6 + k * 0.7), h, { role: 'teen', path: [F(2, 0), F(2, 2.8)], speed: 1.2, wait: 2, carry: k === 1 ? [['phone', 'R']] : [] });
			bell();
		} else if (kind === 'teens') {
			// a low wall to sit on, and friends round it
			put(box(4.2, 0.48, 0.45, mat('wall', 0xb7b0a2)), 0, 1.2, Math.PI / 2, y0 + 0.24);
			const acts = [['wall', 'phone'], ['wall', null], ['stand', 'skateboard'], ['stand', 'ball'], ['stand', 'guitar']];
			acts.forEach(([how, c], k) => {
				const sp = { seed: V.seed + k * 7919, age: 13 + r() * 4.9, place };
				if (how === 'wall') actor(V, sp, F(-0.8 + k * 1.1, 0.95), h - Math.PI / 2, { role: 'teen', sit: 0.48, pose: c === 'phone' ? 'phone' : 'lap', carry: c ? [[c, 'R']] : [] });
				else actor(V, sp, F(-1.4 + (k - 2) * 1.3, -0.4 - (k % 2) * 0.5), h + Math.PI / 2 + (k - 3) * 0.4, { role: 'teen', pose: c === 'skateboard' ? 'rest' : 'pockets', carry: [[c, 'R']], bounce: c === 'ball' });
			});
		} else if (kind === 'groceries') {
			const hh = family(a, (q) => q.members.some((m) => m.age >= 18) && !q.unhoused, r) || a.households[0];
			const par = hh.members.find((m) => m.age >= 18) || hh.members[0], kid = minorsOf(hh).find((m) => m.age >= 5 && m.age < 13);
			const pa = actor(V, memberSpec(par, place), F(-8, 0), h, { role: 'shopper', path: [F(20, 0)], speed: 1.05, carry: [['bag', 'R'], ['bag', 'L']] });
			if (kid && pa) actor(V, memberSpec(kid, place), F(-8, 0.5), h, { role: 'child', follow: pa, side: 0.55, carry: [['bag', 'R']] });
			V.household = hh;
		} else if (kind === 'dinner') {
			const hh = o.household || family(a, (q) => q.members.length >= 3 && !q.unhoused, r) || a.households[0];
			const n = Math.min(hh.members.length, isPhone ? 4 : 6);
			// a real house's dining table if one is built near (bay/houses.js), else a room
			// with its window to the street
			const T = dinnerTable(n);
			const real = !o.room && realTable(x, z);
			// a point of the table's frame in the world, and a heading
			const lw = (px, pz, py, th, q) => ({ x: px + q.x * Math.cos(th) + q.z * Math.sin(th), z: pz - q.x * Math.sin(th) + q.z * Math.cos(th), y: py, heading: q.heading + th });
			let seat;
			if (real) {
				const th = real.it.rot ? 0 : Math.PI / 2;
				real.house.root.add(T.g); T.g.position.set(real.it.x, real.it.y, real.it.z); T.g.rotation.y = th; V.table = T.g;
				T.g.updateMatrixWorld(true);
				seat = (q) => { const v = new THREE.Vector3(q.x, 0, q.z); T.g.localToWorld(v); const e = new THREE.Euler().setFromQuaternion(T.g.getWorldQuaternion(new THREE.Quaternion()), 'YXZ'); return { x: v.x, z: v.z, y: v.y, heading: q.heading + e.y }; };
			} else {
				put(windowRoom(5, 4), 0, 0, 0, y0);
				const [tx, tz] = F(-0.3, 0);
				put(T.g, -0.3, 0, Math.PI / 2, y0);
				seat = (q) => lw(tx, tz, y0, h + Math.PI / 2, q);
			}
			hh.members.slice(0, n).forEach((m, k) => { const q = seat(T.seats[k]); actor(V, memberSpec(m, place), [q.x, q.z], q.heading, { role: 'diner', sit: 0.47, pose: 'table', y: q.y, talky: true }); });
			V.household = hh;
		} else if (kind === 'foodbank' || kind === 'market') {
			const bank = kind === 'foodbank';
			const cols = bank ? [0x2f6f4a, 0x2f6f4a] : [0xc8322c, 0x2354c7, 0xe8a32a];
			cols.forEach((c, k) => put(stall(c, bank ? (k === 0 ? 'COMMUNITY FOOD BANK\nfree, all welcome' : 'Fresh produce today') : ['Valley Farm', 'Bay Greens', 'Orchard Fruit'][k]), (k - (cols.length - 1) / 2) * 3.6, 2.6, -Math.PI / 2));
			// volunteers or growers behind the tables
			cols.forEach((c, k) => actor(V, { seed: V.seed + 31 * k, age: 22 + r() * 50, place, acc: bank ? [{ kind: 'cap', col: '#2f6f4a', acc: '#ffffff' }] : [] }, F((k - (cols.length - 1) / 2) * 3.6, 3.0), h - Math.PI / 2, { role: 'volunteer', pose: 'rest', talky: true }));
			// the line, or the shoppers: neighbours of every kind (the encampment's too)
			const L = a.households.slice().sort(() => r() - 0.5);
			const camp = a.households.find((q) => q.unhoused);
			if (camp && bank) L.unshift(camp);
			for (let k = 0; V.actors.length < CAP && k < L.length; k++) {
				const hh = L[k], m = hh.members.find((q) => q.age >= 18) || hh.members[0];
				// (the line faces the table, one behind another; the market's shoppers browse)
				const at = bank ? F(-1.8 + (k % 2) * 0.25, 1.3 - k * 0.95) : F(-5 + r() * 10, 0.6 + r() * 1.2);
				actor(V, memberSpec(m, place), at, bank ? h + Math.PI / 2 : h + Math.PI / 2 + (r() - 0.5) * 1.5, { role: bank ? 'line' : 'shopper', pose: k % 3 === 2 ? 'phone' : 'rest', carry: (bank ? k === 0 : k % 2) ? [['bag', 'R']] : [] });
			}
			V.bank = a.bank;
		} else if (kind === 'lineup') {
			// for scale: a child, two teens and a grown-up side by side, facing you
			const face = Math.atan2(cam.x - x, cam.z - z), sx = Math.cos(face), sz = -Math.sin(face);
			[8, 13.5, 16.5, 38].forEach((age, k) => { const off = (k - 1.5) * 0.85; actor(V, { seed: V.seed + k * 104729, age, place, male: o.male ?? k % 2 === 0 }, [x + sx * off, z + sz * off], face, { role: 'lineup', pose: 'rest' }); });
		} else { root.remove(V.group); return 'unknown: lineup, school-run, dismissal, teens, groceries, dinner, foodbank, market'; }
		live.push(V);
		return { kind, x: +x.toFixed(1), z: +z.toFixed(1), h: +h.toFixed(3), actors: V.actors.length, area: a.key, place, household: V.household ? describe(V.household) : null };
	}
	// a dining table in a house built near (bay/houses.js): where it is and its chairs
	function realTable(x, z) {
		const H = W()?.houses?.houses;
		if (!H) return null;
		let best = null, bd = 60;
		for (const house of H.values()) {
			const d = Math.hypot(house.cx - x, house.cz - z);
			if (d > bd || !house.root) continue;
			const it = house.plan.items.find((q) => q.type === 'diningTable' && !q.level);
			if (it) { best = { house, it }; bd = d; }
		}
		if (!best) return null;
		return best;
	}
	function clear(kind = null) {
		// (a table set in a real house goes with the moment)
		for (const V of live) if ((!kind || V.kind === kind) && V.table) V.table.removeFromParent();
		for (let i = live.length - 1; i >= 0; i--) {
			const V = live[i];
			if (kind && V.kind !== kind) continue;
			for (const a of V.actors) { root.remove(a.P.root); for (const q of a.props) root.remove(q.g); freeBody(a.P); }
			V.group.removeFromParent();
			live.splice(i, 1);
		}
	}
	// the bell: two soft rings
	function bell() {
		const b = soundBus(); if (!b) return;
		const { ctx, out } = b, t = ctx.currentTime;
		for (const [k, f] of [[0, 1318], [0.45, 1046]]) {
			const o = ctx.createOscillator(), g = ctx.createGain();
			o.type = 'sine'; o.frequency.value = f;
			g.gain.setValueAtTime(0, t + k); g.gain.linearRampToValueAtTime(0.08, t + k + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + k + 1.4);
			o.connect(g).connect(out); o.start(t + k); o.stop(t + k + 1.5);
		}
	}

	function steer(V, a, dt) {
		const S = a.M.S;
		if (a.follow) {
			const L = a.follow.M.S, hh = L.heading, tx = L.pos.x + Math.cos(hh) * a.side, tz = L.pos.z - Math.sin(hh) * a.side;
			const ex = tx - S.pos.x, ez = tz - S.pos.z, d = Math.hypot(ex, ez), pv = Math.max(0, L.speed.v);
			let vx = Math.sin(hh) * pv + ex * 1.2, vz = Math.cos(hh) * pv + ez * 1.2; const v = Math.hypot(vx, vz);
			if (v > 2) { vx *= 2 / v; vz *= 2 / v; }
			if (v < 0.3 && d < 0.4) { a.M.want.speed = 0; a.M.want.heading = hh; } else { a.M.want.speed = Math.min(v, 2); a.M.want.heading = Math.atan2(vx, vz); }
			const holding = a.hold && d < 0.8;
			a.M.hold('R', holding); a.follow.M.hold('L', holding);
			return;
		}
		if (a.path) {
			if ((a.wait -= dt) > 0) { a.M.want.speed = 0; return; }
			a.leg ??= 0;
			const p = a.path[a.leg];
			if (!p) { a.M.want.speed = 0; return; }
			const ex = p[0] - S.pos.x, ez = p[1] - S.pos.z, d = Math.hypot(ex, ez);
			if (d < 0.5) { a.leg++; return; }
			a.M.want.heading = Math.atan2(ex, ez); a.M.want.speed = Math.min(a.speed || 1.2, d * 1.5);
			return;
		}
		a.M.want.speed = 0;
	}

	// ---------- the world's own moments: what the hour and the place call for ----------
	function schoolNear(x, z) {
		const w = W(), real = w?.real;
		if (real?.landAt) {
			let best = null, bd = 260;
			for (let dz = -240; dz <= 240; dz += 24) for (let dx = -240; dx <= 240; dx += 24) {
				const L = real.landAt(x + dx, z + dz), d = Math.hypot(dx, dz);
				if (L && L.lu === 6 && d < bd) { bd = d; best = { x: x + dx, z: z + dz }; }
			}
			if (best) return best;
		}
		for (const b of w?.interiors?.info?.().list || []) if (b.use === 'school' && Math.hypot(b.x - x, b.z - z) < 260) return { x: b.x, z: b.z };
		return null;
	}
	function auto() {
		const h = hours(), wk = day === 0 || day === 6, cam = camera.position, w = W();
		if (!w || cam.y - ground(cam.x, cam.z) > 60) return;
		// (only where people live: the Bay's towns and the island's village, not the far worlds)
		if (!w.bayArea?.urbanAt && !w.village?.footprints?.length) return;
		if (live.length) {
			// a moment ends when its hour is over or you have gone
			const V = live[0], far = Math.hypot(V.x - cam.x, V.z - cam.z) > NEAR, over = V.until !== undefined && (h > V.until || h < V.from);
			if (far || over) clear();
			return;
		}
		const a = areaAt(cam.x, cam.z), r = rng((a.i * 31 + a.j * 17 + Math.floor(h * 2) + day * 101) >>> 0);
		const at = (kind, from, until, o = {}) => stage(kind, { ...o, dist: o.dist ?? 28 + r() * 12, heading: o.heading ?? (w.player?.state?.yaw ?? 0) + Math.PI + (r() - 0.5) * 1.6 }).then((res) => { const V = live.find((q) => q.kind === kind); if (V) { V.from = from; V.until = until; V.auto = true; } return res; });
		if (!wk && ((h > 7.55 && h < 8.3) || (h > 14.9 && h < 15.6))) {
			const S = schoolNear(cam.x, cam.z);
			if (S) { const mo = h < 12; at(mo ? 'school-run' : 'dismissal', mo ? 7.55 : 14.9, mo ? 8.3 : 15.6, { x: S.x, z: S.z, sidewalk: true, dist: 0 }); return; }
		}
		const zone = a.place;
		if (((!wk && h > 15.3 && h < 21) || (wk && h > 11 && h < 21)) && r() < 0.35) { at('teens', h, Math.min(21, h + 1.5)); return; }
		if (((!wk && h > 16.5 && h < 19.5) || (wk && h > 10 && h < 14)) && zone !== 'rural' && r() < 0.35) { at('groceries', h, h + 0.5); return; }
		if (h > 17.8 && h < 19.8 && w.houses?.houses?.size && r() < 0.5) { at('dinner', 17.8, 19.8, { sidewalk: false }); return; }
		if ([2, 4, 6].includes(day) && h > 10 && h < 14 && (zone === 'oakland' || zone === 'sf' || a.desert) && r() < 0.4) { at('foodbank', 10, 14); return; }
		if ([3, 6].includes(day) && h > 8 && h < 13 && zone !== 'rural' && r() < 0.3) at('market', 8, 13);
	}

	// ---------- each frame ----------
	function update(dt, t, enabled = true) {
		root.visible = enabled;
		if (!enabled || !W()?.island) return;
		const h = hours();
		if (lastH !== null && h < lastH - 12) newDay();
		lastH = h;
		// the school bell at eight and at three, when you are at a school run
		const V0 = live.find((q) => q.kind === 'school-run' || q.kind === 'dismissal');
		if (V0) {
			const ring = (h >= 8 && h < 8.05) || (h >= 15 && h < 15.05);
			if (ring && bellT < 0) { bell(); bellT = 1; } else if (!ring) bellT = -1;
			// helping at the crossing: a good deed once a day
			const cam = camera.position, g = V0.actors.find((a) => a.role === 'guard');
			if (g && Math.hypot(g.M.S.pos.x - cam.x, g.M.S.pos.z - cam.z) < 6) { guardT += dt; if (guardT > 45 && guarded !== day) { guarded = day; recordDeed(morality(), 'protect-school-run', { place: 'the school crossing' }, pending); } } else guardT = 0;
		}
		if ((scanT -= dt) < 0) { scanT = 2.5; if (!live.some((q) => !q.auto)) auto(); }
		if ((adoptT -= dt) < 0) { adoptT = 1; adopt(); }
		const cam = camera.position;
		for (const V of live) {
			V.t += dt;
			for (const a of V.actors) {
				steer(V, a, dt);
				if (a.talky) { a.M.S.talk = Math.sin(t * 0.8 + a.P.dna.seed) > 0.5 ? 1 : 0; }
				a.M.update(dt, t, cam);
				a.fade = Math.min(1, a.fade + dt * 1.5); fadePerson(a.P, a.fade);
				a.P.lod?.(Math.hypot(a.M.S.pos.x - cam.x, a.M.S.pos.z - cam.z));
				placeProps(a, t);
			}
		}
	}

	// ---------- the player's part ----------
	const here = () => areaAt(camera.position.x, camera.position.z);
	function pay(c) { return c > 0 && purse.spend(c); }
	const deed = (kind, d) => recordDeed(morality(), kind, d, pending);
	function help(kind, arg = {}) {
		const a = here(), name = a.place === 'island' ? 'the village' : 'the neighbourhood';
		if (kind === 'stock') {
			const hh = (arg.id && a.households.find((q) => q.id === arg.id)) || a.households.filter((q) => !q.unhoused && q.food).sort((p, q) => wellOf(p) - wellOf(q))[0];
			const c = Math.round(arg.credits ?? 80);
			if (!hh || !pay(c)) return 'Not enough credits (or nobody here to help).';
			const used = helpStock(hh, c);
			deed('feed-family', { target: `a family (${describe(hh)})`, place: name });
			return `You stocked the kitchen of ${describe(hh)}: ${used} credits of good food. ${storyOf(hh, null, 1)}`;
		}
		if (kind === 'donate') { const c = Math.round(arg.credits ?? 50); if (!pay(c)) return 'Not enough credits.'; const d = donate(a.bank, c); deed('food-bank', { place: name }); return `The food bank thanks you: ${d} more days of food for a family of four.`; }
		if (kind === 'garden') { const c = Math.round(arg.credits ?? 300); if (!pay(c)) return 'Not enough credits.'; const n = fundGarden(a.garden, c, a.households); deed('community-garden', { place: name }); return `The community garden has ${n} plots now; the houses round it eat fresh from it.`; }
		if (kind === 'cook') { const c = Math.round(arg.credits ?? 60); if (!pay(c)) return 'Not enough credits.'; const dish = cookFor(arg.gathering || null, c); deed('cook-gathering', { place: arg.place || name }); return `You cooked ${dish} for everyone.`; }
		if (kind === 'catch') { const days = feedVillage(a.households, +arg.kg || 5); deed('feed-village', { place: name }); return `${arg.kg || 5} kg brought in: about ${days} meals shared out round ${name}.`; }
		return 'help(kind): stock, donate, garden, cook, catch';
	}
	function info() {
		const a = here(), plans = plansOf(a), h = hours();
		const busy = {};
		for (const hh of a.households) for (const m of hh.members) { const k = whereAt(plans.get(hh.id), m.id, h).act; busy[k] = (busy[k] || 0) + 1; }
		return { area: a.key, place: a.place, foodDesert: a.desert, day, hours: +h.toFixed(2), food: summary(a.households), doing: busy, moments: live.map((V) => ({ kind: V.kind, actors: V.actors.length, auto: !!V.auto })), bank: { stock: +a.bank.stock.toFixed(1) }, garden: a.garden.plots, credits: purse.credits(), pendingDeeds: pending.length, adopted: (people?.pool || []).filter((p) => p.P.home).length };
	}
	function household(id) {
		const a = here(), hh = id ? a.households.find((q) => q.id === id) : a.households.find((q) => minorsOf(q).length);
		if (!hh) return null;
		const plan = plansOf(a).get(hh.id);
		return { id: hh.id, kind: hh.kind, describe: describe(hh), members: hh.members.map((m) => ({ id: m.id, role: m.role, age: m.age, job: m.job?.kind || null, school: m.school, now: whereAt(plan, m.id, hours()) })), notes: plan.notes, food: { budget: hh.food.budget, need: hh.food.need, security: hh.food.security, quality: +hh.food.quality.toFixed(2), plan: hh.food.plan }, well: +wellOf(hh).toFixed(2), story: storyOf(hh) };
	}
	return { update, stage, clear, info, household, help, quests: () => questsFor(here().households, here().place === 'island' ? 'the village' : 'the community centre'), pending: () => pending.slice(), areaAt, group: root, bell };
}
