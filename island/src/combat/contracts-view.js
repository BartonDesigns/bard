import * as T from 'three';
import { contractFor, createFieldContract, advanceContract, contractReward, contractPoint, contractSteps, contractCursor, FIELD_ROLES } from './field-contracts.js';

function cacheModel(tier) {
	const root = new T.Group(), lid = new T.Group();
	const metal = new T.MeshStandardMaterial({ color: 0x33464b, metalness: .65, roughness: .4 });
	const trim = new T.MeshStandardMaterial({ color: 0x879c9e, metalness: .8, roughness: .3 });
	const dark = new T.MeshStandardMaterial({ color: 0x101a20, roughness: .85 });
	const light = new T.MeshStandardMaterial({ color: 0xffb95e, emissive: 0xff9c38, emissiveIntensity: .5 });
	function box(parent, w, h, d, x, y, z, mat) {
		const shape = new T.Shape(); shape.moveTo(-w / 2, -h / 2); shape.lineTo(w / 2, -h / 2); shape.lineTo(w / 2, h / 2); shape.lineTo(-w / 2, h / 2); shape.closePath();
		const geo = new T.ExtrudeGeometry(shape, { depth: d, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .025, bevelThickness: .025 }); geo.translate(0, 0, -d / 2);
		const m = new T.Mesh(geo, mat); m.position.set(x, y, z); parent.add(m); return m;
	}
	box(root, 1.7, .13, .8, 0, .12, 0, metal);
	box(root, 1.65, .28, .07, 0, .32, -.39, metal); box(root, 1.65, .28, .07, 0, .32, .39, metal);
	for (const side of [-1, 1]) { box(root, .08, .28, .8, side * .82, .32, 0, metal); box(root, .13, .37, .09, side * .65, .28, .43, trim); }
	box(root, 1.45, .05, .61, 0, .22, 0, dark);
	lid.position.set(0, .49, -.42); root.add(lid); box(lid, 1.72, .11, .86, 0, 0, .42, metal);
	for (let i = -3; i <= 3; i++) box(lid, .08, .03, .7, i * .21, .07, .42, trim);
	box(lid, 1.48, .035, .65, 0, -.09, .42, dark);
	for (const x of [-.57, .57]) box(lid, .065, .023, .59, x, -.12, .42, trim);
	for (let i = -5; i <= 5; i++) box(root, .055, .012, .5, i * .12, .264, 0, dark);
	for (const x of [-.87, .87]) {
		const handle = new T.Mesh(new T.TorusGeometry(.12, .018, 12, 32, Math.PI), trim); handle.rotation.y = Math.PI / 2; handle.rotation.z = Math.PI / 2; handle.position.set(x, .32, 0); root.add(handle);
		for (const z of [-.14, .14]) box(root, .055, .09, .08, x, .31, z, trim);
	}
	const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
	const c = canvas.getContext('2d'); c.fillStyle = '#acbec2'; c.font = 'bold 38px monospace'; c.fillText('FRONTIER', 22, 51); c.font = '22px monospace'; c.fillText('FIELD SUPPLY / RECOVERY KIT', 22, 91);
	const label = new T.Mesh(new T.PlaneGeometry(.96, .24), new T.MeshStandardMaterial({ map: new T.CanvasTexture(canvas), transparent: true, roughness: .85, depthWrite: false }));
	label.rotation.x = Math.PI / 2; label.position.set(0, -.145, .42); lid.add(label);
	for (const x of [-.6, .6]) { const h = new T.Mesh(new T.CylinderGeometry(.045, .045, .25, 24), trim); h.rotation.z = Math.PI / 2; h.position.set(x, .49, -.42); root.add(h); }
	box(root, .28, .06, .04, 0, .34, .45, light);
	// An embossed rank plate and recessed strips, separate from the functional status light.
	for (let i = 0; i <= tier; i++) box(root, .035, .09, .025, (i - tier / 2) * .075, .32, .485, trim);
	return { root, lid, light };
}
// Field contracts are ordinary quests: the guide's Quests list offers the next one and tracks the
// one under way (guide/guide-screens.js), and the waypoint, marker and trail show where its
// current step happens (mark(), read by guide/guide.js). Nothing here stays on screen.
// how close counts as there, per stage (the same distances update() checks)
const REACH = { travel: 10, survey: 3, secure: 14, hold: 12, recover: 3, return: 5 };
export function createContracts({ group, arms, squads, recovery, eye, ground, site, eligible, blocked = () => null, where = () => 'open ground away from towns', active, down, hint, audio, store }) {
	let completed = 0, recoveredBefore = false, told = false;
	try { const saved = JSON.parse(store.get('l99-field-contracts') || '{}'); completed = Math.max(0, Math.min(1000, saved.completed | 0)); recoveredBefore = !!saved.recovered; told = !!saved.told || completed > 0; } catch {}
	const save = () => store.set('l99-field-contracts', JSON.stringify({ completed, recovered: recoveredBefore, told }));
	let mission = null, cache = null, members = [], pending = false, waveDelay = 0, epoch = 0, unlocked = false, dropId = null;
	function dispose(o) { if (!o) return; o.removeFromParent(); const gs = new Set(), ms = new Set(); o.traverse((n) => { if (n.geometry) gs.add(n.geometry); for (const m of [n.material].flat().filter(Boolean)) ms.add(m); }); gs.forEach((g) => g.dispose()); ms.forEach((m) => { m.map?.dispose(); m.dispose(); }); }
	function cleanup() {
		epoch++; for (const h of members) if (!h.gone) squads.release(h);
		members = []; pending = false; waveDelay = 0; dispose(cache?.root); cache = null;
		if (dropId) recovery.remove(dropId); dropId = null; unlocked = false;
	}
	function abort(reason) { if (mission) advanceContract(mission, 'abandon'); cleanup(); mission = null; if (reason) hint(reason, 4000, 1); }
	// accepting from Quests: { ok, id } or { ok: false, error } saying what to do first
	function accept() {
		if (mission) return { ok: false, error: `${mission.def.name} is already under way.` };
		if (!eligible()) return { ok: false, error: `Field contracts are offered on ${where()}. Head there, then accept.` };
		const why = blocked(); if (why) return { ok: false, error: `${why} Then accept the contract.` };
		if (!active()) return { ok: false, error: 'Not right now. Try again in a moment.' };
		const at = site(); if (!at) return { ok: false, error: 'Find open, fairly level ground outside town, face across it, then try again.' };
		const p = eye(), id = `mc${completed.toString(36).padStart(5, '0')}`;
		mission = createFieldContract({ id, completed, site: at, rally: { x: p.x, y: ground(p.x, p.z, p.y), z: p.z } });
		cache = cacheModel(mission.def.tier); cache.root.position.set(at.x, at.y, at.z); group.add(cache.root);
		audio.play('accept'); hint(`${mission.def.name}: follow the marker to the supply cache.`, 4000, 1);
		return { ok: true, id };
	}
	const start = () => accept().ok;
	function abandon() { if (!mission) return false; abort('Contract abandoned. Collected gear stays in your bag.'); return true; }
	function spawnWave() {
		if (!mission || pending || waveDelay > 0) return;
		const m = mission, token = epoch, roles = m.def.waves[m.wave]; if (!roles) return;
		pending = true; audio.play('wave'); hint(`${roles.map((r) => FIELD_ROLES[r].name).join(' + ')} approaching. Defeat or drive them off.`, 4500, 1);
		const dx = m.site.x - m.rally.x, dz = m.site.z - m.rally.z, len = Math.hypot(dx, dz) || 1;
		squads.squad('ashfang', m.site.x + dx / len * 16, m.site.z + dz / len * 16, roles.length, { roles, alert: true, spread: 6, level: m.def.level, tier: Math.max(0, m.def.tier - 1) }).then((sq) => {
			if (token !== epoch) { for (const h of sq.members) squads.release(h); return; }
			pending = false; members = [...sq.members];
			if (members.length !== roles.length) abort('Too much activity here. Contract cancelled; try another clearing.');
		}).catch(() => { if (token === epoch) abort('The encounter could not load. Try again in another clearing.'); });
	}
	function unlock() {
		if (unlocked || !mission) return;
		const m = mission;
		if (recoveredBefore) { advanceContract(m, 'collected'); hint('You already recovered this contract’s kit. Follow the marker back to the rally point for payment.', 4000, 1); return; }
		dropId = recovery.addCache({ id: `${m.id}c`, source: m.id, name: m.def.name, pos: m.site, weapon: { i: m.def.weapon, l: m.def.level, t: m.def.tier } });
		if (!dropId) { abort('The cache could not open. Please try again.'); return; }
		unlocked = true; cache.light.color.setHex(0x7ce5be); cache.light.emissive.setHex(0x39bf8b); audio.play('cache'); hint('Cache unlocked. Approach and press E, or tap Take. Then return to the rally point for your payment.', 5000, 1);
	}
	function recovered(source) { if (mission && source === mission.id && advanceContract(mission, 'collected')) { recoveredBefore = true; save(); audio.play('accept'); hint('Supplies recovered. Follow the marker back to the rally point.', 3500, 1); } }
	const distance = (a) => Math.hypot(eye().x - a.x, eye().z - a.z);
	const standing = () => members.filter((h) => !h.dead && !h.surrendered && !h.fleeing && !h.restrained).length;
	// the step under way, in a few words, with what changes as you play it
	function objective(m) {
		if (m.stage === 'survey') return `Inspect perimeter point ${m.checkpoint + 1} of ${m.def.checkpoints}`;
		if (m.stage === 'hold') return `Hold the clearing · ${Math.ceil(Math.max(0, m.def.holdSeconds - m.hold))} s`;
		if (m.stage === 'secure') return members.length && !pending ? `Drive off the guards · ${standing()} left` : pending || !waveDelay ? 'Secure the cache · squad incoming' : `Secure the cache · squad in ${Math.ceil(waveDelay)} s`;
		return { travel: 'Reach the supply cache', recover: 'Take the cache’s weapon', return: 'Return to the rally point' }[m.stage] || m.def.name;
	}
	// where the current step happens, as the waypoint draws it (ui/waypoint.js)
	function mark() {
		const m = mission; if (!m || !REACH[m.stage]) return null;
		const at = contractPoint(m), steps = contractSteps(m.def), i = Math.min(steps.length - 1, contractCursor(m));
		return { key: 'contract:' + m.id, x: at.x, y: ground(at.x, at.z, at.y + 2), z: at.z, radius: REACH[m.stage], title: objective(m), detail: `${m.def.name} · step ${i + 1} of ${steps.length}` };
	}
	// for the Quests list: the contract under way, else the next one on offer
	function journal() {
		const d = mission?.def || contractFor(completed), cursor = mission ? contractCursor(mission) : -1;
		return {
			completed, active: !!mission, id: mission?.id || null, offered: !mission && eligible(), where: where(),
			name: d.name, brief: d.brief, credits: d.credits, cursor: Math.max(0, cursor),
			steps: contractSteps(d).map((s, i) => ({ text: s.text, state: i < cursor ? 'done' : i === cursor ? 'now' : 'next' })),
			mark: mark(),
		};
	}
	function update(dt) {
		// (said once: where to find them, the first time you stand where they are offered)
		if (!mission && !told && active() && eligible()) { told = true; save(); hint('Field contracts are offered out here. Open the Guide, then Quests, to take one.', 6000, 1); }
		if (!mission) return;
		const m = mission;
		if (down() || distance(m.site) > 220) { abort(down() ? 'Contract interrupted. Recover and accept another from Quests when ready.' : 'You left the contract area. Collected gear remains yours.'); return; }
		if (active()) {
			if (m.stage === 'travel' && distance(m.site) < 11) { advanceContract(m, 'arrive'); if (m.stage === 'secure') { waveDelay = 4; audio.play('wave'); } }
			if (m.stage === 'survey') {
				const at = contractPoint(m);
				if (distance(at) < 3 && Math.abs(eye().y - ground(at.x, at.z, at.y + 2) - 1.68) < 3) {
					advanceContract(m, 'inspected'); audio.play('accept');
					if (m.stage === 'secure') waveDelay = 3;
				}
			}
			if (m.stage === 'hold') {
				if (distance(m.site) < 12 && Math.abs(eye().y - m.site.y - 1.68) < 3) m.hold += dt;
				else m.hold = 0;
				advanceContract(m, 'held');
			}
			if (m.stage === 'secure') {
				waveDelay = Math.max(0, waveDelay - dt);
				if (!pending && !members.length && !waveDelay) spawnWave();
				else if (!pending && members.length && members.every((h) => h.dead || h.surrendered || h.fleeing || h.restrained)) {
					// Fallen bodies and recovery loot remain; their normal pools own cleanup.
					members = []; advanceContract(m, 'cleared'); if (m.stage === 'secure') waveDelay = 5;
				} else if (!pending && members.some((h) => h.gone)) { abort('The guards left the encounter area. Contract cancelled.'); return; }
			}
			if (m.stage === 'recover') unlock();
			if (m.stage === 'return' && distance(m.rally) < 5 && Math.abs(eye().y - m.rally.y - 1.68) < 3) {
				const result = arms.apply(contractReward(m));
				if (result.ok) { advanceContract(m, 'paid'); completed++; recoveredBefore = false; save(); audio.play('complete'); cleanup(); mission = null; hint(`${m.def.name} complete · +${m.def.credits} credits. The next contract is in Quests.`, 5000, 2); }
			}
		}
		if (cache) cache.lid.rotation.x += ((unlocked ? -1.85 : 0) - cache.lid.rotation.x) * Math.min(1, dt * 4);
	}
	return { update, accept, start, abandon, recovered, mark, journal, clear: () => abort(), info: () => ({ completed, mission, pending, waveDelay, enemies: members.map((h) => ({ id: h.id, role: h.specialty?.name, dead: !!h.dead, surrendered: !!h.surrendered })), unlocked }) };
}
