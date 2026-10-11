import * as T from 'three';
import { contractFor, createFieldContract, advanceContract, contractReward, FIELD_ROLES } from './field-contracts.js';

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
export function createContracts({ group, mount, arms, squads, recovery, eye, camera, ground, site, eligible, active, down, hint, audio, store }) {
	let completed = 0, recoveredBefore = false;
	try { const saved = JSON.parse(store.get('l99-field-contracts') || '{}'); completed = Math.max(0, Math.min(1000, saved.completed | 0)); recoveredBefore = !!saved.recovered; } catch {}
	const save = () => store.set('l99-field-contracts', JSON.stringify({ completed, recovered: recoveredBefore }));
	let mission = null, cache = null, rally = null, members = [], pending = false, waveDelay = 0, epoch = 0, unlocked = false, dropId = null, expanded = false, elapsed = 0, message = '';
	const panel = document.createElement('section'); panel.dataset.fieldContract = '';
	panel.setAttribute('aria-label', 'Field contract');
	panel.style.cssText = 'display:none;position:absolute;left:14px;top:88px;width:min(280px,calc(100% - 105px));padding:10px;box-sizing:border-box;border:1px solid #6b878b;border-radius:10px;background:#102129ed;color:#e8f1f0;font:12px/1.45 system-ui;z-index:5;';
	const title = document.createElement('strong'), text = document.createElement('div'), buttons = document.createElement('div');
	text.style.cssText = 'margin:5px 0;white-space:pre-line'; buttons.style.cssText = 'display:flex;gap:6px';
	const make = (label, action) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'min-height:40px;flex:1;border:1px solid #638a93;border-radius:6px;background:#23424b;color:#fff;cursor:pointer;font:600 12px system-ui;touch-action:manipulation'; b.onclick = action; buttons.append(b); return b; };
	const accept = make('Field contracts', () => { if (!active()) return; if (!expanded) { expanded = true; render(); } else start(); });
	const cancel = make('Close', () => { if (mission) abort('Contract abandoned. Collected gear stays in your bag.'); else expanded = false; render(); });
	panel.append(title, text, buttons); mount.append(panel);
	for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown']) panel.addEventListener(ev, (e) => e.stopPropagation());
	function dispose(o) { if (!o) return; o.removeFromParent(); const gs = new Set(), ms = new Set(); o.traverse((n) => { if (n.geometry) gs.add(n.geometry); for (const m of [n.material].flat().filter(Boolean)) ms.add(m); }); gs.forEach((g) => g.dispose()); ms.forEach((m) => { m.map?.dispose(); m.dispose(); }); }
	function cleanup() {
		epoch++; for (const h of members) if (!h.gone) squads.release(h);
		members = []; pending = false; waveDelay = 0; dispose(cache?.root); dispose(rally); cache = rally = null;
		if (dropId) recovery.remove(dropId); dropId = null; unlocked = false;
	}
	function abort(reason) { if (mission) advanceContract(mission, 'abandon'); cleanup(); mission = null; expanded = false; message = reason || ''; if (reason) hint(reason, 4000, 1); }
	function start() {
		if (mission || !active() || !eligible()) return false;
		const at = site(); if (!at) { message = 'Find open, fairly level ground outside town, then try again.'; render(); return false; }
		const p = eye(), id = `mc${completed.toString(36).padStart(5, '0')}`;
		mission = createFieldContract({ id, completed, site: at, rally: { x: p.x, y: ground(p.x, p.z, p.y), z: p.z } });
		cache = cacheModel(mission.def.tier); cache.root.position.set(at.x, at.y, at.z); group.add(cache.root);
		rally = new T.Mesh(new T.RingGeometry(1.2, 1.35, 64), new T.MeshBasicMaterial({ color: 0x78dbb2, side: T.DoubleSide, transparent: true, opacity: .8 })); rally.rotation.x = -Math.PI / 2; rally.position.set(p.x, mission.rally.y + .06, p.z); group.add(rally); rally.visible = false;
		message = ''; expanded = true; audio.play('accept'); hint(`${mission.def.name}: follow the contract bearing to the supply cache.`, 4000, 1); render(); return true;
	}
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
		if (recoveredBefore) { advanceContract(m, 'collected'); hint('You already recovered this contract’s kit. Return to the rally marker for payment.', 4000, 1); return; }
		dropId = recovery.addCache({ id: `${m.id}c`, source: m.id, name: m.def.name, pos: m.site, weapon: { i: m.def.weapon, l: m.def.level, t: m.def.tier } });
		if (!dropId) { abort('The cache could not open. Please try again.'); return; }
		unlocked = true; cache.light.color.setHex(0x7ce5be); cache.light.emissive.setHex(0x39bf8b); audio.play('cache'); hint('Cache unlocked. Approach and press E, or tap Take. Return to the rally point for your contract payment.', 5000, 1);
	}
	function recovered(source) { if (mission && source === mission.id && advanceContract(mission, 'collected')) { recoveredBefore = true; save(); audio.play('accept'); hint('Supplies recovered. Return to the green rally marker.', 3500, 1); } }
	const distance = (a) => Math.hypot(eye().x - a.x, eye().z - a.z);
	function bearing(a) { const f = camera.getWorldDirection(new T.Vector3()), dx = a.x - eye().x, dz = a.z - eye().z; const angle = Math.atan2(f.x * dz - f.z * dx, f.x * dx + f.z * dz); return Math.abs(angle) < .5 ? 'Ahead' : Math.abs(angle) > 2.5 ? 'Behind' : angle > 0 ? 'Right' : 'Left'; }
	function render() {
		panel.style.display = active() && (mission || eligible()) ? 'block' : 'none';
		if (!mission) {
			const d = contractFor(completed); title.textContent = expanded ? d.name : 'Frontier fieldwork';
			text.textContent = expanded ? `${d.brief}\nReward: ${d.credits} credits + repair supplies.\n${message}` : message;
			accept.textContent = expanded ? 'Accept contract' : `Field contracts · ${completed} completed`; accept.style.display = ''; cancel.style.display = expanded ? '' : 'none'; cancel.textContent = 'Close'; return;
		}
		const m = mission, target = m.stage === 'return' ? m.rally : m.site;
		title.textContent = m.def.name;
		const remaining = members.filter((h) => !h.dead && !h.surrendered && !h.fleeing && !h.restrained).length;
		const objective = { travel: 'Locate the supply cache', secure: `Secure the cache · wave ${m.wave + 1}/${m.def.waves.length}${pending ? ' · incoming' : waveDelay > 0 ? ` · ${Math.ceil(waveDelay)}s` : ` · ${remaining} guards`}`, recover: 'Open cache: approach and take its weapon', return: 'Return to the rally marker' }[m.stage];
		text.textContent = `${objective}\n${bearing(target)} · ${Math.round(distance(target))} m\nPayment: ${m.def.credits} credits + repair supplies`;
		accept.style.display = 'none'; cancel.style.display = ''; cancel.textContent = 'Abandon';
	}
	function update(dt) {
		elapsed += dt;
		if (mission) {
			const m = mission;
			if (down() || distance(m.site) > 220) { abort(down() ? 'Contract interrupted. Recover and accept another when ready.' : 'You left the contract area. Collected gear remains yours.'); render(); return; }
			if (active()) {
				if (m.stage === 'travel' && distance(m.site) < 11) { advanceContract(m, 'arrive'); if (m.stage === 'secure') { waveDelay = 4; audio.play('wave'); } }
				if (m.stage === 'secure') {
					waveDelay = Math.max(0, waveDelay - dt);
					if (!pending && !members.length && !waveDelay) spawnWave();
					else if (!pending && members.length && members.every((h) => h.dead || h.surrendered || h.fleeing || h.restrained)) {
						// Fallen bodies and recovery loot remain; their normal pools own cleanup.
						members = []; advanceContract(m, 'cleared'); if (m.stage === 'secure') waveDelay = 5;
					} else if (!pending && members.some((h) => h.gone)) { abort('The guards left the encounter area. Contract cancelled.'); render(); return; }
				}
				if (m.stage === 'recover') unlock();
				if (m.stage === 'return' && distance(m.rally) < 5 && Math.abs(eye().y - m.rally.y - 1.68) < 3) {
					const result = arms.apply(contractReward(m));
					if (result.ok) { advanceContract(m, 'paid'); completed++; recoveredBefore = false; save(); audio.play('complete'); cleanup(); mission = null; expanded = false; message = `${m.def.name} complete · +${m.def.credits} credits. Next contract unlocked.`; hint(message, 5000, 2); }
				}
			}
			if (cache) cache.lid.rotation.x += ((unlocked ? -1.85 : 0) - cache.lid.rotation.x) * Math.min(1, dt * 4);
			if (rally) { rally.visible = mission?.stage === 'return'; rally.material.opacity = .65 + Math.sin(elapsed * 2) * .15; }
		}
		render();
	}
	return { update, start, recovered, clear: () => { abort(); message = ''; panel.style.display = 'none'; }, info: () => ({ completed, mission, pending, waveDelay, enemies: members.map((h) => ({ id: h.id, role: h.specialty?.name, dead: !!h.dead, surrendered: !!h.surrendered })), unlocked }) };
}
