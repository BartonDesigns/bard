// Favours in passing (the words and rules in errands-core.js): someone you walk by asks for
// help, you say yes with the talk control, and the errand plays out right there. The people in
// it are held in the world until it ends; the pin shows the way; the reward is credits in your
// inventory and a good deed on the compass. One errand at a time.
import * as THREE from 'three';
import { offerFor, lineFor, rewardFor, step, milestone, relativeDir } from './errands-core.js';

const OFFER_FOR = 15, OFFER_REACH = 12, PICK = 1.4, HAND = 2.3, AWAY = 220;
const LIMIT = { search: 360, bring: 360, chase: 150, carry: 300 };
const STORE = 'crysis-favours-v1';
const _v = new THREE.Vector3();

export function createErrands({ scene, camera, world, people, chatter, persona, arms, morality, hint, driving, isPhone, worldKey = () => world()?.body?.key || 'here', placeName = () => '' }) {
	let E = null, n = 0, cool = 40, prop = null, gT = 0, clock = 0;
	let tally = { done: 0, kept: 0 };
	try { tally = { ...tally, ...JSON.parse(localStorage.getItem(STORE) || '{}') }; } catch { /* private mode */ }
	const save = () => { try { localStorage.setItem(STORE, JSON.stringify(tally)); } catch { /* private mode */ } };

	// ---------- the people in it, held ----------
	function hold(p, mode) {
		p.held = true;
		const mine = (q, dt, cam) => {
			if (mode === 'walk') return false;            // a friend walking on: their own way, kept about
			const S = q.M.S, dx = cam.x - S.pos.x, dz = cam.z - S.pos.z, d = Math.hypot(dx, dz);
			if (q.route?.kind === 'seat') return false;   // sitting: stays sat
			q.M.want.speed = 0;
			if (d < 16) { q.M.want.heading = Math.atan2(dx, dz); if (!S.remark) S.look.target = cam; }
			else if (!S.remark) S.look.target = null;
			q.M.setPose(q.idlePose || 'rest');
			return true;
		};
		p.override = mine; p.heldBy = mine;
	}
	function release(p) {
		if (!p) return;
		if (p.override === p.heldBy) p.override = null;
		p.held = false; p.heldBy = null;
	}
	const lost = (p) => !p || !p.active || p.override !== p.heldBy || p.P?.ragdoll;
	const pos = (p) => p.M.S.pos;
	const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
	const you = () => { const P = world()?.player?.state; return P && !P.flying ? P.pos : camera.position; };
	const feet = () => { const q = you(); return { x: q.x, y: q.y - (q === camera.position ? 1.7 : 0), z: q.z }; };

	// ---------- the ground, for a dropped thing ----------
	function groundAt(x, z) {
		const W = world(), h = W?.island?.heightAt?.(x, z);
		if (!Number.isFinite(h) || h < 0.6) return null;
		const L = W.real?.landAt?.(x, z);
		if (L && L.roof > 0.5) return null;                      // not on a roof, not inside
		const f = W.player?.floorAt?.(x, z, h);
		return Number.isFinite(f) ? f : h;
	}
	function dropSpot(from) {
		for (let k = 0; k < 24; k++) {
			const a = Math.random() * Math.PI * 2, d = 12 + Math.random() * 26;
			let x = from.x + Math.cos(a) * d, z = from.z + Math.sin(a) * d;
			const sw = people.sidewalk?.(x, z);
			if (sw && Math.hypot(sw[0] - x, sw[1] - z) < 9) { x = sw[0]; z = sw[1]; }
			const y = groundAt(x, z);
			if (y === null || Math.abs(y - from.y) > 5) continue;
			return { x, y, z };
		}
		return null;
	}

	// ---------- the thing on the ground: small, with a glint so it can be found ----------
	let glintTex = null;
	function glint() {
		if (glintTex) return glintTex;
		const c = document.createElement('canvas'); c.width = c.height = 64;
		const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
		r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,246,214,.75)'); r.addColorStop(1, 'rgba(255,240,200,0)');
		g.fillStyle = r; g.fillRect(0, 0, 64, 64);
		g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(30, 2, 4, 60); g.fillRect(2, 30, 60, 4);
		return (glintTex = new THREE.CanvasTexture(c));
	}
	const SHAPES = {
		keys: [['torus', 0x9aa0a6, [0.035, 0.008], [0, 0.01, 0], [Math.PI / 2, 0, 0]], ['box', 0xc8a24a, [0.05, 0.008, 0.016], [0.05, 0.008, 0]], ['box', 0xb8bcc2, [0.045, 0.006, 0.014], [0.03, 0.006, 0.03]]],
		phone: [['box', 0x15181c, [0.075, 0.01, 0.15], [0, 0.005, 0]]],
		wallet: [['box', 0x4a2e1e, [0.11, 0.02, 0.09], [0, 0.01, 0]]],
		glasses: [['torus', 0x1b1b1b, [0.025, 0.004], [-0.03, 0.006, 0], [Math.PI / 2, 0, 0]], ['torus', 0x1b1b1b, [0.025, 0.004], [0.03, 0.006, 0], [Math.PI / 2, 0, 0]]],
		earbud: [['box', 0xf2f2f2, [0.018, 0.018, 0.03], [0, 0.009, 0]]],
		ticket: [['box', 0xe7d26a, [0.14, 0.003, 0.06], [0, 0.002, 0]]],
		scarf: [['box', 0xa8323a, [0.5, 0.02, 0.12], [0, 0.01, 0]]],
	};
	function placeProp(shape, at) {
		const g = new THREE.Group(), geos = [];
		for (const [kind, col, dims, off, rot] of SHAPES[shape] || SHAPES.keys) {
			const geo = kind === 'torus' ? new THREE.TorusGeometry(dims[0], dims[1], 6, 18) : new THREE.BoxGeometry(...dims);
			const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, roughness: 0.5, metalness: shape === 'keys' ? 0.7 : 0.1 }));
			m.position.set(...off); if (rot) m.rotation.set(...rot); g.add(m); geos.push(m);
		}
		const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glint(), color: 0xfff3cf, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
		s.position.y = 0.12; s.scale.setScalar(0.5); g.add(s);
		g.position.set(at.x, at.y + 0.02, at.z); g.rotation.y = Math.random() * 6.28;
		scene.add(g);
		return { g, s };
	}
	function clearProp() {
		if (!prop) return;
		prop.g.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
		prop.g.removeFromParent(); prop = null;
	}

	// ---------- asking ----------
	// chatter asks whether this passer-by wants a favour instead of a word in passing
	function maybeAsk(p, { afraid = false, force = false } = {}) {
		if (E || (cool > 0 && !force) || afraid || !p || p.leaving || p.P.dna.child || p.P.dna.minor || p.role === 'jog' || p.engaged || p.override || p.held) return null;
		if (driving() || world()?.player?.state?.flying) return null;
		if (!force && Math.random() > (tally.done < 2 ? 0.3 : 0.18)) return null;
		const W = world(); if (!W) return null;
		const me = pos(p), cam = camera.position, f = camera.getWorldDirection(_v);
		// someone to be the friend: walking off (catch), or waiting about (pass)
		const others = people.pool.filter((q) => q !== p && q.active && !q.leaving && !q.P.dna.child && !q.P.dna.minor && !q.engaged && !q.override && !q.held && q.demo === undefined);
		const walking = others.filter((q) => q.role === 'walk' && (q.route?.kind === 'street' || q.route?.kind === 'loop' || q.route?.kind === 'wander') && flat(pos(q), me) > 16 && flat(pos(q), me) < 60);
		const waiting = others.filter((q) => (q.route?.kind === 'seat' || q.role === 'wait' || q.role === 'chat') && flat(pos(q), me) > 20 && flat(pos(q), me) < 75);
		const kinds = ['lost'], who = persona(p);
		if (walking.length) kinds.push('catch');
		if (waiting.length) kinds.push('pass');
		const kind = kinds[(n + (p.P.dna.seed | 0)) % kinds.length];
		const friend = kind === 'catch' ? walking[(n * 7) % walking.length] : kind === 'pass' ? waiting[(n * 5) % waiting.length] : null;
		const dir = friend ? relativeDir(pos(friend).x - cam.x, pos(friend).z - cam.z, f.x, f.z) : 'over there';
		const offer = offerFor({ who: { first: who.first, seed: p.P.dna.seed }, n: n++, kinds: [kind], friend: friend ? { first: persona(friend).first } : null, dir });
		if (!offer) return null;
		let drop = null;
		if (offer.kind === 'lost') { drop = dropSpot(me); if (!drop) return null; }
		E = { ...offer, stage: 'offered', giver: p, giverName: who.first, friendP: friend, drop, t: 0, from: { x: me.x, z: me.z }, centre: drop && { x: drop.x + (Math.random() - 0.5) * 9, y: drop.y, z: drop.z + (Math.random() - 0.5) * 9 } };
		hold(p, 'stand');
		if (friend) hold(friend, kind === 'catch' ? 'walk' : 'stand');
		if (tally.done < 2) hint(isPhone ? `${who.first} is asking for help. Walk up and tap Help to say yes.` : `${who.first} is asking for help. Walk up and press Enter to say yes.`, 5000);
		return { text: offer.ask, gesture: offer.kind === 'lost' ? 'open' : 'point', feel: { surprise: 0.3, sad: offer.kind === 'lost' ? 0.3 : 0 } };
	}

	// ---------- moving it on ----------
	let lastEnd = '';
	function go(ev) {
		const r = step(E, ev);
		if (!r.out) return;
		lastEnd = `${E.stage} > ${ev}`;
		E = { ...r.E, giver: E.giver, friendP: E.friendP, t: 0 };
		const o = r.out;
		if (o.say === 'accept' && E.giver.active) chatter.say(E.giver, { text: lineFor('accept', { kind: E.kind, n }), gesture: 'nod', feel: { joy: 0.5 } }, null);
		if (o.say === 'found') { clearProp(); hint(`Found ${E.item.the}. Bring ${E.item.id === 'keys' || E.item.id === 'glasses' ? 'them' : 'it'} back to ${E.giverName}.`, 3500); }
		if (o.done) finish(o.say);
		else if (o.kept) keep(o.cash);
		else if (o.failed) end(o.say ? lineFor(o.say, {}) : null);
		else if (o.declined) end(null);
	}
	function finish(say) {
		const to = E.kind === 'lost' ? E.giver : E.friendP;
		const metres = E.kind === 'lost' ? flat(E.drop, E.from) * 2 : flat(pos(to), E.from);
		const credits = rewardFor(E.kind, metres);
		if (to?.active) {
			chatter.say(to, { text: lineFor(say, { kind: E.kind, item: E.item, friend: E.giverName, n }), gesture: say === 'caught' ? 'laugh' : 'wave', feel: { joy: 1, surprise: say === 'caught' ? 0.6 : 0.2 } }, null);
			to.M.S.feel.joy = 1;
		}
		const paid = arms()?.apply?.({ id: `favour:${E.giverName}:${Date.now()}`, kind: 'trade', peer: 'favour', give: { credits: 0, items: [] }, get: { credits, items: [] } });
		morality()?.record?.({ kind: 'favour', target: E.giverName, world: worldKey(), place: placeName() });
		tally.done++; save();
		const m = milestone(tally.done);
		hint(`${paid?.ok === false ? 'Favour done' : `+${credits} credits`}: ${E.title}.${m ? ' ' + m : ''}`, m ? 6000 : 3500);
		end(null, 7);
	}
	function keep(cash) {
		arms()?.apply?.({ id: `kept:${E.giverName}:${Date.now()}`, kind: 'trade', peer: 'found', give: { credits: 0, items: [] }, get: { credits: cash, items: [] } });
		morality()?.record?.({ kind: 'kept-wallet', target: E.giverName, world: worldKey(), place: placeName() });
		tally.kept++; save();
		hint(`You kept the wallet: ${cash} credits. ${E.giverName} is still looking for it.`, 5000);
		end(null);
	}
	// over: the people go back to their day (after a moment, if they are speaking)
	let releaseAt = [];
	function end(say, after = 0) {
		const g = E?.giver, f = E?.friendP;
		if (say && g?.active) chatter.say(g, { text: say, gesture: 'shrug', feel: { sad: 0.3 } }, null);
		for (const p of [g, f]) if (p) releaseAt.push([p, clock + (after || (say ? 4 : 0))]);
		clearProp();
		E = null; cool = isPhone ? 90 : 60;
	}

	// ---------- the talk control says Help while someone is asking ----------
	const asking = (p) => !!E && E.stage === 'offered' && E.giver === p;
	function accept() { if (E?.stage === 'offered') go('accept'); }

	function update(dt) {
		cool = Math.max(0, cool - dt); clock += dt;
		if (releaseAt.length) releaseAt = releaseAt.filter(([p, t]) => { if (clock < t) return true; release(p); return false; });
		if (prop) { gT += dt; prop.s.material.opacity = 0.55 + 0.45 * Math.max(0, Math.sin(gT * 3.1)); prop.s.scale.setScalar(0.35 + 0.2 * Math.max(0, Math.sin(gT * 3.1 + 1))); }
		if (!E) return;
		E.t += dt;
		const me = feet(), g = E.giver, f = E.friendP;
		// the people in it carried off by something else (a fight, a crowd thinning): it ends
		if (lost(g) && E.stage !== 'chase' && E.stage !== 'carry') { go('lost-them'); return; }
		if (f && lost(f) && (E.stage === 'chase' || E.stage === 'carry' || E.stage === 'offered')) { go('lost-them'); return; }
		if (E.stage === 'offered') {
			if (E.t > OFFER_FOR || flat(me, pos(g)) > OFFER_REACH + 4) go('decline');
			return;
		}
		if (E.t > (LIMIT[E.stage] || 300)) { go('timeout'); return; }
		if (E.stage === 'search') {
			if (!prop) prop = placeProp(E.item.shape, E.drop);
			if (flat(me, E.drop) < PICK && Math.abs(me.y - E.drop.y) < 2.2 && !driving()) go('pickup');
			else if (flat(me, E.from) > AWAY) go('away');
			return;
		}
		if (E.stage === 'bring') {
			if (flat(me, pos(g)) < HAND) go('reach');
			else if (flat(me, E.from) > AWAY) go('away');
			return;
		}
		if (E.stage === 'chase' || E.stage === 'carry') {
			if (flat(me, pos(f)) < HAND && Math.abs(me.y - pos(f).y) < 2.5) {
				// the friend stops to take it
				hold(f, 'stand');
				go('reach');
			} else if (flat(me, pos(f)) > AWAY + 30) go('away');
		}
	}

	// the pin and the chip (guide.js asks every second)
	function mark() {
		if (!E || E.stage === 'offered') return null;
		if (E.stage === 'search') return { ...E.centre, radius: 9, title: E.title, detail: 'search the marked patch' };
		if (E.stage === 'bring') { const q = pos(E.giver); return { x: q.x, y: q.y, z: q.z, radius: 2, title: `Bring ${E.item.the} back to ${E.giverName}`, detail: E.item.cash ? 'or keep it' : 'they are waiting' }; }
		const q = pos(E.friendP);
		return { x: q.x, y: q.y, z: q.z, radius: 2, title: E.title, detail: E.stage === 'chase' ? 'catch up with them' : `from ${E.giverName}` };
	}
	// what a person in an errand knows, for a conversation with them
	function factFor(p) {
		if (!E || (p !== E.giver && p !== E.friendP)) return null;
		if (p === E.giver) return E.stage === 'offered' ? `Just asked the player for help: ${E.ask}` : E.stage === 'search' ? `Waiting while the player searches for ${E.item.mine || E.item.the}.` : E.stage === 'bring' ? `The player found ${E.item.the} and has not given it back yet.` : `Asked the player to take ${E.item.the} to ${E.friend}.`;
		return E.stage === 'chase' ? `Walking on, unaware they left ${E.item.the} with ${E.giverName}.` : `Waiting here; ${E.giverName} sent something over with the player.`;
	}
	// (for the console and the tests: the nearest grown-up asks now; their words go through chatter)
	function askNearest() {
		const c = camera.position, q = people.pool.filter((p) => p.active && !p.P.dna.child && !p.P.dna.minor).sort((a, b) => flat(pos(a), c) - flat(pos(b), c))[0];
		const line = q && maybeAsk(q, { force: true });
		if (line) chatter.say(q, line, null);
		return line ? E.title : 'nobody near to ask';
	}
	function cancel() { if (E) go(E.stage === 'offered' ? 'decline' : 'timeout'); }
	function dispose() { if (E) { for (const p of [E.giver, E.friendP]) release(p); E = null; } for (const [p] of releaseAt) release(p); releaseAt = []; clearProp(); glintTex?.dispose(); glintTex = null; }
	function info() { return { errand: E && { kind: E.kind, stage: E.stage, title: E.title, giver: E.giverName, friend: E.friend || null, t: Math.round(E.t), drop: E.drop && [E.drop.x, E.drop.y, E.drop.z].map((v) => Math.round(v * 10) / 10) }, cool: Math.round(cool), last: lastEnd, ...tally }; }
	return { maybeAsk, askNearest, asking, accept, update, mark, factFor, cancel, dispose, info, active: () => !!E && E.stage !== 'offered' };
}
