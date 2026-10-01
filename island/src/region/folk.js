// The people of a regional place, when you are in it: a few at a time round you, each built
// as someone from here (their ancestry by the culture's mix, cultures.js; dressed for the
// place and the weather, dress.js) and about the day's work and life by the kit's roles: a
// stallholder at the souk, a tea seller, people sitting on the doorstep or talking, someone
// fishing at the shore or through the ice, a herder going out, a farmer in the field, a
// monk walking to the temple, people going from house to house. You can stop any of them
// and talk (people.js addTalkers; persona.js gives them who they are here).
//
// Bodies and motion are the people system's (people/); a body is rebuilt for the next
// region rather than re-dressed, one at a time, so nothing stalls.

import * as THREE from 'three';
import { loadPeopleAssets, buildPerson, personDNA, rng } from '../people/body.js';
import { hairFor } from '../people/wardrobe.js';
import { createMotion } from '../people/motion.js';
import { addTalkers } from '../people/people.js';
import { regionalDress } from './dress.js';
import { ancestryFor } from './cultures.js';
import { coldOf } from './climate.js';
import { here } from './here.js';

const wpick = (r, L) => { let x = r() * L.reduce((a, b) => a + b[1], 0); for (const [k, w] of L) { if ((x -= w) < 0) return k; } return L[0][0]; };
const NEAR = 140;
// what a role wants: a seat (sit), a stand (stand), or to walk
const ROLE = {
	stall: { at: /stall|souk/, pose: 'table', seat: 0 }, tea: { at: /teahouse|chai|banyan|fale|longhouse/, pose: 'lap', seat: 0.45 },
	sit: { at: /door|bench|banyan|fale|longhouse/, pose: 'lap', seat: 0.42 }, weave: { at: /door/, pose: 'lap', seat: 0.42 },
	talk: { at: /door/, pose: 'pockets' }, chop: { at: /door/, pose: 'cook' }, farm: { at: /door/, pose: 'cook', out: 30 },
	fish: { at: /door/, pose: 'fish', seat: 0.35, out: 45 }, walk: { walk: 1 }, carry: { walk: 1, pose: 'push' }, sled: { walk: 1, pose: 'push' },
	herd: { walk: 0.7, pose: 'behind', out: 60 }, monk: { walk: 0.6, pose: 'behind' },
};

export function createFolk(scene, { settlements, ground, wet = () => false, onIce = () => false, isPhone = false }) {
	const group = new THREE.Group();
	group.name = 'regional folk';
	scene.add(group);
	const MAXB = isPhone ? 4 : 8;
	const bodies = [];                       // { P, M, key, busy, task, spot, ... }
	let A = null, failed = false, building = false, castT = 0, castKey = '', seedN = 1;
	const stopTalk = addTalkers(() => bodies.filter((b) => b.busy));
	// a fishing rod held out over the water (a short jigging rod on the ice)
	const rodMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.5 });
	const rodGeo = new THREE.CylinderGeometry(0.006, 0.014, 2.4, 5).translate(0, 1.2, 0), shortGeo = new THREE.CylinderGeometry(0.005, 0.012, 0.8, 5).translate(0, 0.4, 0);
	function rod(b, on, ice) {
		if (!on) { if (b.rod) b.rod.visible = false; return; }
		if (!b.rod) { b.rod = new THREE.Mesh(rodGeo, rodMat); b.P.root.add(b.rod); }
		b.rod.geometry = ice ? shortGeo : rodGeo;
		b.rod.position.set(-0.08, b.P.height * (ice ? 0.32 : 0.55), 0.3); b.rod.rotation.set(ice ? 1.3 : 0.9, 0, 0);
		b.rod.visible = true;
	}

	async function ensure() { if (A || failed) return; try { A = await loadPeopleAssets(); } catch (e) { failed = true; console.warn('[regional folk]', e); } }
	// the kind of person this place has now (bodies of another place are let go and rebuilt)
	const keyNow = () => `${here.culture?.key}|${here.kit?.folk?.dress}|${Math.round(coldOf(here.climate) * 3)}`;
	function grow() {
		if (building || !A || bodies.length >= MAXB || !here.kit) return;
		building = true;
		try {
			const seed = (Math.imul(seedN++, 2654435761) ^ (Math.round(here.lat * 1000) * 7919)) >>> 0;
			const r = rng(seed ^ 0x51ede), C = here.culture, kit = here.kit;
			const d = personDNA(seed, { age: 18 + Math.pow(r(), 1.2) * 58, ancestry: ancestryFor(C, r, kit.build?.dense ? 0.12 : 0.04) });
			const task = wpick(r, kit.folk?.roles || [['walk', 1]]);
			const { outfit, head } = regionalDress(r, d, kit, C, { cold: coldOf(here.climate), role: task, id: here.regionId });
			outfit.gen = outfit.gen || 'x';
			d.style = outfit; d.style.printKind = Math.floor(r() * 9);
			d.style.hair = hairFor(r, d, d.style);
			if (head.scarf) d.style.hair.scarf = head.scarf;
			if (task === 'monk') { d.style.hair.buzz = true; d.style.hair.scarf = null; }
			d.styleSig = JSON.stringify(d.outfit);
			const P = buildPerson(A, d);
			const M = createMotion(P, (x, z) => ground(x, z));
			P.root.visible = false;
			group.add(P.root);
			P.job = jobFor(kit, task, r); P.errand = null;
			bodies.push({ P, M, key: keyNow(), busy: false, task, active: true });
		} catch (e) { console.warn('[regional folk]', e); } finally { building = false; }
	}
	// the work that goes with what they are doing
	function jobFor(kit, task, r) {
		const J = kit.folk?.jobs || [];
		const m = { stall: /sell|merchant|smith|stall|shop|market|carpet|spice|baker|fruit|tailor/, tea: /tea|chai|café|cafe/, fish: /fish/, herd: /herd|cattle|yak|llama|horse|camel|goat|cow|dairy/, farm: /grow|farm|rice|tea|olive|date|millet|garden|terrace/, monk: /temple|monastery/ }[task];
		const L = m ? J.filter((j) => m.test(j)) : [];
		if (task === 'monk') return 'a monk at the monastery';
		return (L.length ? L : J)[Math.floor(r() * (L.length ? L.length : J.length))] || null;
	}
	function free(b) { group.remove(b.P.root); b.P.root.traverse((o) => { o.geometry?.dispose?.(); }); }

	// ---------- casting: who is where ----------
	function cast(camera) {
		for (const b of bodies) if (!b.engaged) { b.busy = false; b.P.root.visible = false; b.spot = null; b.M.S.talk = 0; b.M.S.look.target = null; rod(b, false); }
		const cam = camera.position, spots = settlements.spotsNear(cam.x, cam.z, NEAR);
		if (!spots.length) return;
		const used = new Set();
		const near = (re) => { let best = null, bd = 1e9; for (const q of spots) { if (used.has(q) || !re.test(q.kind)) continue; const d = Math.hypot(q.x - cam.x, q.z - cam.z) + Math.random() * 30; if (d < bd) { bd = d; best = q; } } return best; };
		for (const b of bodies) {
			if (b.engaged) continue;
			const R = ROLE[b.task] || ROLE.walk;
			let q = near(R.at || /door/);
			if (!q && b.task !== 'walk') { b.task = 'walk'; q = near(/door/); }
			if (!q) continue;
			used.add(q);
			b.spot = q; b.busy = true; b.P.root.visible = true; b.t = 0;
			let x = q.x, z = q.z, yaw = q.yaw;
			if (b.task === 'fish') {
				// to the water's edge, or out onto the ice, facing the water
				let best = null;
				for (let k = 0; k < 16 && !best; k++) { const a = k / 16 * Math.PI * 2 + Math.random() * 0.3; for (let dd = 8; dd <= 90; dd += 6) { const px = q.x + Math.sin(a) * dd, pz = q.z + Math.cos(a) * dd; if (wet(px, pz)) { best = onIce(px + Math.sin(a) * 15, pz + Math.cos(a) * 15) ? [px + Math.sin(a) * 15, pz + Math.cos(a) * 15, a] : [px - Math.sin(a) * 2, pz - Math.cos(a) * 2, a]; break; } } }
				if (best) { [x, z, yaw] = best; } else { b.task = 'sit'; }
				rod(b, b.task === 'fish', b.task === 'fish' && onIce(x, z));
			} else if (R.out) { const a = Math.random() * Math.PI * 2; x += Math.sin(a) * R.out * 0.5; z += Math.cos(a) * R.out * 0.5; yaw = a; }
			b.M.place(x, ground(x, z), z, yaw);
			if (R.seat) b.M.sit(R.seat + (q.y > ground(q.x, q.z) + 0.3 ? q.y - ground(q.x, q.z) : 0), true); else { b.M.stand(); b.M.S.sitK.v = 0; }
			b.M.setPose(R.pose || (Math.random() < 0.5 ? 'rest' : 'pockets'));
			if (R.walk) { b.route = { goal: null, pause: Math.random() * 3 }; }
			// someone to talk with: the next free body stands facing them
			if (b.task === 'talk') {
				const o = bodies.find((c) => !c.busy && !c.engaged);
				if (o) { const fx = Math.sin(yaw), fz = Math.cos(yaw), ox = x + fx * 1.3, oz = z + fz * 1.3; o.busy = true; o.P.root.visible = true; o.task = 'talk2'; o.spot = q; o.M.place(ox, ground(ox, oz), oz, yaw + Math.PI); o.M.stand(); o.M.setPose('rest'); b.other = o; o.other = b; }
			}
		}
	}

	// ---------- the living ----------
	const head = (b) => new THREE.Vector3(b.M.S.pos.x, b.M.S.pos.y + b.P.height * (b.M.S.sitK.v > 0.5 ? 0.62 : 0.93), b.M.S.pos.z);
	function live(dt, t, cam) {
		for (const b of bodies) {
			if (!b.busy) continue;
			const S = b.M.S, R = ROLE[b.task] || {};
			b.t = (b.t || 0) + dt;
			if (b.engaged) {
				// stopped to talk: face you, speak while the words last
				S.want.speed = 0; b.M.want.speed = 0;
				const dx = cam.position.x - S.pos.x, dz = cam.position.z - S.pos.z;
				b.M.want.heading = Math.atan2(dx, dz);
				S.look.target = cam.position.clone();
				S.talk = (b.speakUntil || 0) > performance.now() ? 1 : 0;
			} else if (R.walk && b.route) {
				const Rt = b.route;
				if (Rt.pause > 0) { Rt.pause -= dt; b.M.want.speed = 0; }
				else {
					if (!Rt.goal) { const sp = settlements.spotsNear(S.pos.x, S.pos.z, R.walk < 1 ? 160 : 90).filter((q) => q.kind === 'door'); const q = sp[Math.floor(Math.random() * sp.length)]; Rt.goal = q ? { x: q.x + (Math.random() - 0.5) * 3, z: q.z + (Math.random() - 0.5) * 3 } : { x: S.pos.x + (Math.random() - 0.5) * 30, z: S.pos.z + (Math.random() - 0.5) * 30 }; }
					const dx = Rt.goal.x - S.pos.x, dz = Rt.goal.z - S.pos.z, d = Math.hypot(dx, dz);
					if (d < 1.2 || b.t > 90) { Rt.goal = null; Rt.pause = 2 + Math.random() * 8; b.t = 0; }
					else { b.M.want.heading = Math.atan2(dx, dz); b.M.want.speed = (R.walk || 1) * 1.15; }
				}
				// (walls are walls for them too)
				settlements.push(S.pos, S.pos.y);
			} else if (b.task === 'talk' || b.task === 'talk2') {
				const o = b.other;
				if (o?.busy) { S.look.target = head(o); const turn = Math.sin(b.t * 0.33 + (b.task === 'talk' ? 0 : 3)) > 0; S.talk = turn && Math.sin(b.t * 1.1) > -0.3 ? 1 : 0; b.gT = (b.gT ?? Math.random() * 3) - dt; if (b.gT < 0) { b.gT = 2 + Math.random() * 4; if (Math.random() < 0.5) b.M.gesture((turn ? ['explain', 'open', 'shrug'] : ['nod', 'laugh', 'nod'])[Math.floor(Math.random() * 3)]); } }
			} else {
				// at their work or their seat: a glance up, a gesture now and then
				b.gT = (b.gT ?? 3 + Math.random() * 6) - dt;
				if (b.gT < 0) { b.gT = 5 + Math.random() * 10; if (Math.random() < 0.3) b.M.gesture(b.task === 'stall' ? 'open' : 'think'); }
				S.look.target = Math.hypot(cam.position.x - S.pos.x, cam.position.z - S.pos.z) < 8 && Math.sin(t * 0.2 + b.P.dna.seed) > 0.2 ? cam.position.clone() : null;
			}
			b.M.update(dt, t, cam);
		}
	}

	function update(dt, t, cam) {
		const on = here.on && here.kit && here.town && here.town.km < 0.4;
		if (!on) { for (const b of bodies) if (b.busy && !b.engaged) { b.busy = false; b.P.root.visible = false; } return; }
		if (!A && !failed) ensure();
		// people of another place go; people of this place come, one at a time
		const k = keyNow();
		const stale = bodies.findIndex((b) => b.key !== k && !b.engaged);
		if (stale >= 0 && !building) { free(bodies[stale]); bodies.splice(stale, 1); }
		else if (A && bodies.length < MAXB) grow();
		castT -= dt;
		const cell = Math.round(cam.position.x / 80) + ',' + Math.round(cam.position.z / 80) + ':' + bodies.length;
		if (castT <= 0 && cell !== castKey) { castT = 3; castKey = cell; cast(cam); }
		live(dt, t, cam);
	}
	function dispose() { rodMat.dispose(); rodGeo.dispose(); shortGeo.dispose(); stopTalk(); for (const b of bodies) free(b); bodies.length = 0; scene.remove(group); }
	return { update, dispose, bodies, info: () => ({ bodies: bodies.length, busy: bodies.filter((b) => b.busy).length, roles: bodies.filter((b) => b.busy).map((b) => b.task) }) };
}
