// What a gathering looks like: the crowd drifting in to its place, standing round the focus
// (a small stage with a drummer for a concert, a blanket for a picnic), swaying and chatting,
// moving to the Bard's beat when the player plays, then walking away. The crowd is two
// instanced crowds (crowd.js), one walking and one standing, so even 25 people are a handful
// of draw calls. Everything follows from the saved gathering and the game clock.
import * as THREE from 'three';
import { createCrowd } from './crowd.js';
import { loadPeopleAssets, buildPerson, personDNA } from './body.js';
import { createMotion } from './motion.js';
import { freeBody, worldPosition } from './social-actors.js';
import { F } from '../earth/globeframe.js';
import { HOURS, LEAVE, gatheringStage, memberWant, crowdLayout, seededRandom } from './gatherings.js';

const WALK = 1.3, NEAR = 80, SHOW = 500, OUT = 34;
// member modes
const AWAY = 0, COMING = 1, HERE = 2, GOING = 3, GONE = 4;

export function createGatheringScene({ scene, world, camera, book, bodyKey }) {
	let show = null, scan = 0;
	const W = () => world();
	function groundAt(x, z) {
		const w = W(), I = w?.island; if (!I) return 0;
		const h = (I.drawnAt ?? I.heightAt)(x, z);
		const f = w.player?.floorAt?.(x, z, h);
		return Number.isFinite(f) ? f : h;
	}
	function pick() {
		const key = bodyKey(), t = book.clock();
		let best = null, bestD = SHOW;
		for (const a of book.list(key)) {
			if (!a.gathering || a.status === 'cancelled' || a.status === 'proposed') continue;
			const stage = gatheringStage(a, t);
			if (stage === 'before' || stage === 'over') continue;
			const q = worldPosition(W(), a.place.pos); if (!q) continue;
			const d = Math.hypot(q.x - camera.position.x, q.z - camera.position.z);
			if (d < bestD) { best = a; bestD = d; }
		}
		return best;
	}
	function build(a) {
		const q = worldPosition(W(), a.place.pos), g = a.gathering, n = g.size;
		const r = seededRandom(g.seed ^ 0x51ab);
		const H = r() * Math.PI * 2, c = Math.cos(H), s = Math.sin(H);
		// a concert's stage stands behind the crowd's middle, which is the agreed spot
		const back = g.kind === 'concert' ? 6.5 : 0;
		const fx = q.x - s * back, fz = q.z - c * back, fy = groundAt(fx, fz);
		const lay = crowdLayout(g.kind, n, g.seed);
		const S = {
			id: a.id, a, n, H, fx, fz, fy, kind: g.kind, epoch: F.epoch,
			sx: new Float32Array(n), sz: new Float32Array(n), sy: new Float32Array(n), syaw: new Float32Array(n),
			ox: new Float32Array(n), oz: new Float32Array(n), px: new Float32Array(n), pz: new Float32Array(n),
			mode: new Uint8Array(n), ok: new Uint8Array(n), off: new Float32Array(n),
			group: new THREE.Group(), stand: createCrowd(n, { kind: 'stand', place: 'suburb', seed: g.seed }), walk: createCrowd(n, { kind: 'walk', place: 'suburb', seed: g.seed }),
			props: [], performer: null, cheer: -1, energy: 0, dead: false,
		};
		S.group.name = 'gathering';
		S.group.add(S.stand.group, S.walk.group);
		for (let i = 0; i < n; i++) {
			const lx = lay[i * 3], lz = lay[i * 3 + 1];
			const x = fx + lx * c + lz * s, z = fz - lx * s + lz * c, y = groundAt(x, z);
			S.sx[i] = x; S.sz[i] = z; S.sy[i] = y; S.syaw[i] = lay[i * 3 + 2] + H; S.off[i] = r() * 0.15;
			// on dry ground and near the focus' level, or left out
			S.ok[i] = Number.isFinite(y) && y > 0.3 && Math.abs(y - fy) < 4 ? 1 : 0;
			// where they come from and go back to: out along the line from the focus
			const dx = x - fx, dz = z - fz, d = Math.hypot(dx, dz) || 1, a2 = (r() - 0.5) * 0.6;
			const ux = (dx / d) * Math.cos(a2) + (dz / d) * Math.sin(a2), uz = (dz / d) * Math.cos(a2) - (dx / d) * Math.sin(a2);
			let ox = x + ux * OUT, oz = z + uz * OUT;
			if (!(groundAt(ox, oz) > 0.3)) { ox = x + ux * 8; oz = z + uz * 8; }
			S.ox[i] = ox; S.oz[i] = oz;
			S.stand.place(i, x, y, z, 0, 0); S.walk.place(i, x, y, z, 0, 0);
		}
		if (g.kind === 'concert') stage(S, r); else if (g.kind === 'picnic') blanket(S);
		scene.add(S.group);
		return S;
	}
	function addProp(S, geo, mat, x, y, z, yaw = 0) {
		const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = yaw; m.castShadow = m.receiveShadow = true;
		S.group.add(m); S.props.push(m); return m;
	}
	// a low wooden stage, a stool and a hand drum, and a drummer who plays them
	function stage(S, r) {
		const wood = new THREE.MeshStandardMaterial({ color: 0x8a5a36, roughness: 0.8 }), dark = new THREE.MeshStandardMaterial({ color: 0x3a2a20, roughness: 0.6 });
		const top = S.fy + 0.45, H = S.H, c = Math.cos(H), s = Math.sin(H);
		addProp(S, new THREE.BoxGeometry(4.2, 1.4, 3), wood, S.fx, top - 0.7, S.fz, H);
		addProp(S, new THREE.CylinderGeometry(0.2, 0.22, 0.48, 10), dark, S.fx, top + 0.24, S.fz, 0);
		const dx = S.fx + s * 0.42, dz = S.fz + c * 0.42;
		addProp(S, new THREE.CylinderGeometry(0.17, 0.12, 0.5, 12), dark, dx, top + 0.25, dz, 0);
		S.stageTop = top;
		const token = S;
		loadPeopleAssets().then((A) => {
			if (token.dead || show !== token) return;
			const P = buildPerson(A, personDNA((S.a.gathering.seed * 31 + 7) >>> 0, { age: 22 + r() * 20 }));
			const M = createMotion(P, () => top);
			M.place(S.fx, top, S.fz, H); M.sit(0.48, true); M.act('drum', 0);
			P.root.visible = false;
			S.group.add(P.root); S.performer = { P, M };
		}).catch(() => {});
	}
	function blanket(S) {
		const cloth = new THREE.MeshStandardMaterial({ color: 0xb8433a, roughness: 0.95 });
		addProp(S, new THREE.BoxGeometry(2.4, 0.04, 2.4), cloth, S.fx, S.fy + 0.02, S.fz, S.H);
	}
	function teardown() {
		if (!show) return;
		show.dead = true;
		show.stand.dispose(); show.walk.dispose();
		const seen = new Set();
		for (const m of show.props) { if (!seen.has(m.geometry)) { m.geometry.dispose(); seen.add(m.geometry); } if (!seen.has(m.material)) { m.material.dispose(); seen.add(m.material); } }
		if (show.performer) freeBody(show.performer.P);
		show.group.removeFromParent();
		show = null;
	}
	function step(S, i, tx, tz, dt) {
		const dx = tx - S.px[i], dz = tz - S.pz[i], d = Math.hypot(dx, dz), m = WALK * dt;
		if (d <= m) { S.px[i] = tx; S.pz[i] = tz; return true; }
		S.px[i] += dx / d * m; S.pz[i] += dz / d * m;
		S.walk.place(i, S.px[i], groundAt(S.px[i], S.pz[i]), S.pz[i], Math.atan2(dx, dz), 1);
		return false;
	}
	function update(dt, time, enabled = true) {
		scan -= dt;
		if (scan <= 0) {
			scan = 1;
			const a = enabled ? pick() : null;
			if (show && (!a || a.id !== show.id || show.epoch !== F.epoch)) teardown();
			if (a && !show) show = build(a);
		}
		const S = show; if (!S) return;
		S.group.visible = !!enabled;
		if (!enabled) return;
		const t = book.clock(), cam = camera.position, stageNow = gatheringStage(S.a, t);
		// the music: the Bard's beat and loudness when the player plays, else the drummer's own
		const perf = W()?.music?.performance;
		const e = perf ? Math.max(perf.bass || 0, (perf.mid || 0) * 0.8, (perf.high || 0) * 0.6) : 0;
		S.energy += (e - S.energy) * Math.min(1, dt * 4);
		const playing = S.energy > 0.04, beat = playing ? perf.beat : time * 100 / 60;
		const lively = S.kind === 'concert' || S.kind === 'party';
		const amp = playing ? 0.03 + S.energy * 0.14 : lively ? 0.02 : 0.006;
		const cheer = playing && lively ? Math.round(Math.min(1, S.energy * 1.8) * 10) / 10 : 0;
		if (cheer !== S.cheer) { S.cheer = cheer; S.stand.cheer(cheer); }
		let standing = 0, walking = 0;
		for (let i = 0; i < S.n; i++) {
			if (!S.ok[i]) continue;
			const want = memberWant(S.a, i, t);
			let mode = S.mode[i];
			const far = Math.hypot(S.sx[i] - cam.x, S.sz[i] - cam.z) > NEAR;
			if (want === 1 && mode === AWAY) {
				// out of sight they are simply there; in sight they walk in
				if (far) mode = HERE; else { mode = COMING; S.px[i] = S.ox[i]; S.pz[i] = S.oz[i]; }
			}
			if (want === 2 && (mode === HERE || mode === COMING)) {
				if (far) mode = GONE; else { mode = GOING; if (S.mode[i] === HERE) { S.px[i] = S.sx[i]; S.pz[i] = S.sz[i]; } }
			}
			if (want === 0 && mode !== AWAY) mode = AWAY; // the clock went back
			if (mode === COMING && step(S, i, S.sx[i], S.sz[i], dt)) mode = HERE;
			if (mode === GOING && step(S, i, S.ox[i], S.oz[i], dt)) mode = GONE;
			if (mode !== S.mode[i] || mode === HERE) {
				if (mode === HERE) {
					// standing: a nod to the beat and a gentle sway
					const bob = amp * Math.abs(Math.sin(Math.PI * (beat + S.off[i]))), sway = Math.sin(time * 0.8 + i * 1.7) * (playing ? 0.12 : 0.06);
					S.stand.place(i, S.sx[i], S.sy[i] + bob, S.sz[i], S.syaw[i] + sway, 1);
				} else S.stand.place(i, 0, 0, 0, 0, 0);
				if (mode !== COMING && mode !== GOING) S.walk.place(i, 0, 0, 0, 0, 0);
			}
			S.mode[i] = mode;
			if (mode === HERE) standing++; else if (mode === COMING || mode === GOING) walking++;
		}
		S.stand.group.visible = standing > 0; S.walk.group.visible = walking > 0;
		S.stand.update(time); S.walk.update(time);
		S.here = standing; S.walking = walking;
		// the drummer plays from just before the hour until the end, in time with the beat
		const P = S.performer;
		if (P) {
			const on = stageNow === 'on' || (stageNow === 'arriving' && t > S.a.due - 0.25);
			P.P.root.visible = on;
			const d = Math.hypot(S.fx - cam.x, S.fz - cam.z);
			if (on && d < 160) { P.M.act('drum', ((beat / 2) % 1 + 1) % 1); P.M.update(Math.min(dt, 0.05), time, cam); P.P.lod?.(d); }
		}
		for (const m of S.props) m.visible = stageNow !== 'dispersing' || t < S.a.due + HOURS + LEAVE * 0.5;
	}
	return {
		update, dispose: teardown,
		info: () => show ? { id: show.id, kind: show.kind, size: show.n, here: show.here || 0, walking: show.walking || 0, energy: +show.energy.toFixed(3), performer: !!show.performer?.P.root.visible, focus: [+show.fx.toFixed(1), +show.fz.toFixed(1)], stage: gatheringStage(show.a, book.clock()) } : null,
		positions: () => show ? [...show.mode].map((m, i) => [m, +(m === HERE ? show.sx[i] : show.px[i]).toFixed(1), +(m === HERE ? show.sz[i] : show.pz[i]).toFixed(1)]) : [],
	};
}
