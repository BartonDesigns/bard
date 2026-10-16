// Magic, gathered: your spells and fabric (magic/spells.js, kept between visits), the aether in
// the world (magic/aether.js), the spells at work (magic/caster.js), how they look and sound
// (magic/fx.js), the bar (magic/hud.js), your level, skill points and perks (magic/skills.js)
// and the skills and magic menu (magic/skills-ui.js), and the weapons on the keys 1 to 5
// (combat/hotbar.js), which share the bar.
//
// Keys: 1 to 5 your weapons (again: put it away), 6 to 0 your spells (a beam is held), Tab (or
// N, or the places menu, or a tap on your fabric) the skills and magic menu, Shift with Mark and
// Recall marks anew. What you do teaches you: casting, weaving and gathering, your weapons'
// hits, the harm you live through and the ground you cover all rank up their skill and give
// experience; each level a skill point to spend on a perk. The fight takes a spell's harm as its own
// (combat.deal), and lends its door for blows at you to the wards (combat.hooks.shield) and its
// eyes to the cloak (combat.hooks.cloak). Life taken gives a thread of dark fabric, mercy shown
// a thread or two of light.

import { createMagicState, saveMagic, weave, weaveCost, bind, gather, SPELL, SLOTS } from './spells.js';
import { sanitizeSkills, addUse, addXp, takePerk, pointsOf, PERK } from './skills.js';
import { createSkillsMenu } from './skills-ui.js';
import { createMagicFx, magicSound } from './fx.js';
import { createAether, seedOf } from './aether.js';
import { createCaster } from './caster.js';
import { createMagicHud } from './hud.js';
import { createHotbar } from '../combat/hotbar.js';

const KEY = 'l99-magic';
const store = {
	get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
	set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const SPELL_KEYS = { Digit6: 0, Digit7: 1, Digit8: 2, Digit9: 3, Digit0: 4 };
const WEAK = new Set(['head', 'weak', 'eye', 'heart']);

// world(): the world (player, island, sky); light(): the sun's height (-1 .. 1); busy(): anything
// that has the controls (driving, a menu); menu: the places menu, which gets a way in
export function createMagic({ scene, camera, mount, combat, arms, world, light, hint = () => {}, busy = () => false, menu = null, isPhone = false, isTouch = false }) {
	let saved = null;
	try { saved = JSON.parse(store.get(KEY) || 'null'); } catch { saved = null; }
	const state = sanitizeSkills(createMagicState(saved));
	let dirty = false, saveT = 5, hud = null, skills = null;
	// what you did, as experience: a level gained is announced
	function learnt(r) {
		dirty = true;
		const levels = typeof r === 'number' ? r : r?.levels || 0;
		if (levels > 0) { hud?.levelUp(state.level, pointsOf(state)); magicSound('level', 0.16); skills?.refresh(); }
	}
	const fx = createMagicFx(scene, { isPhone });
	const W = () => world();
	const worldKey = () => combat.worldKey?.() || 'here';
	const seed = () => (W() ? seedOf(worldKey()) : null);
	const track = (kind, a, b) => {
		if (kind === 'cast' && b > 0) learnt(addUse(state, a.school, b));
		else if (kind === 'hurt' && a > 0) learnt(addUse(state, 'resilience', a / 2));
	};
	const caster = createCaster({ camera, combat, player: () => W()?.player, state, fx, light, hint, sky: { get state() { return W()?.sky?.state; } }, worldKey, seed, isPhone, track });
	combat.hooks.shield = (blow) => caster.shieldBlow(blow);
	combat.hooks.cloak = () => caster.cloaked();
	// your weapons' blows, as your Marksman perks shape them; their harm ranks Marksman up
	combat.hooks.power = (T, blow) => {
		const M = state.mods;
		const k = 1 + (M?.weapon || 0) + (WEAK.has(blow.part) ? M?.weak || 0 : 0) + (T?.kind === 'boss' ? M?.boss || 0 : 0);
		if (M?.manaOnHit) state.mana = Math.min(state.mana + M.manaOnHit, 9999);
		learnt(addUse(state, 'marksman', Math.min(60, blow.amount * k) / 3));
		return k === 1 ? blow : { ...blow, amount: blow.amount * k };
	};
	const aether = createAether({
		fx, light, seed, state, isPhone,
		ground: (x, z) => combat.ground(x, z, camera.position.y + 40),
		heightAt: (x, z) => { const I = W()?.island; return I ? I.heightAt(x, z) : NaN; },
		onGather: (m, n0) => {
			const n = Math.round(n0 * (1 + (state.mods?.fabric?.[m.strand] || 0)));
			gather(state, m.strand, n); dirty = true;
			learnt(addXp(state, n * 2));
			magicSound('gather', 0.1);
			hint(m.well ? `An aether well: +${n} ${m.strand} fabric. You will know the way back to it.` : `+${n} ${m.strand} aether fabric`, m.well ? 3500 : 1200);
		},
	});
	const active = () => !!W()?.player && !busy() && !mount.inert && mount.style.display !== 'none' && !skills?.isOpen() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && !window._KEYS_PLAY_ON;
	const hotbar = createHotbar({ arms, store, ok: () => active(), hint });
	function castSlot(i, o = {}) {
		const id = state.binds[i];
		if (!id) { hint(`Nothing bound to ${['6', '7', '8', '9', '0'][i]}. Bind a spell in the spellbook (N).`, 1800); return false; }
		if (!active() && !o.tap) return false;
		if (combat.vitals?.().ko) return false;
		const ok = caster.cast(id, o);
		if (ok) dirty = true;
		return ok;
	}
	// the skills and magic menu: weave a spell, take a perk, slot a spell to a key
	skills = createSkillsMenu({
		mount, state, light, isTouch, isPhone,
		sound: (k, v) => magicSound(k, v),
		onWeave: (id) => {
			const c = weaveCost(SPELL[id]);
			if (!weave(state, id)) return false;
			dirty = true; magicSound(SPELL[id].school, 0.14);
			learnt(addUse(state, SPELL[id].school, c.light + c.dark));
			return true;
		},
		onPerk: (id) => {
			if (!takePerk(state, id)) return false;
			dirty = true; magicSound(PERK[id].page, 0.14);
			return true;
		},
		onBind: (i, id) => { bind(state, i, id); dirty = true; },
	});
	// (it opens where it was left; not while driving, flying a craft or in another screen)
	const openSkills = (k) => { if (!W()?.player) return; if (busy()) { hint('Skills and magic open once you are on your feet.', 1600); return; } skills.open(k); };
	hud = createMagicHud({
		mount, state, hotbar, isTouch,
		onCast: (i, o) => { if (castSlot(i, o) && SPELL[state.binds[i]]?.kind === 'beam') heldTap.set(state.binds[i], performance.now() + 2500); },
		onPress: (i) => hotbar.press(i),
		onBook: () => openSkills(),
		bookOpen: () => skills.isOpen(),
	});
	// a way in from the places menu, at its top
	let menuBtn = null;
	if (menu) {
		menuBtn = document.createElement('button');
		menuBtn.type = 'button';
		menuBtn.textContent = '✦ Skills and magic';
		menuBtn.title = 'Skills and magic (Tab or N)';
		menuBtn.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(94,234,212,.35);background:rgba(1,169,130,.12);color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;';
		for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) menuBtn.addEventListener(ev, (x) => x.stopPropagation());
		menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = 'none'; openSkills(); });
		menu.insertBefore(menuBtn, menu.firstChild);
	}
	// (a beam is cast while its key is held; a tap on the bar holds it for a moment)
	const keysDown = new Set(), heldTap = new Map();
	const keysHeld = (id) => { for (const c of keysDown) if (state.binds[SPELL_KEYS[c]] === id) return true; return (heldTap.get(id) || 0) > performance.now(); };
	function onKey(e) {
		// (Tab, or N as the spellbook was: the menu; while it is open it takes the keys itself)
		if ((e.code === 'Tab' || e.code === 'KeyN') && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !window._KEYS_PLAY_ON && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && mount.style.display !== 'none' && W()?.player && !busy()) { openSkills(); e.preventDefault(); return; }
		const i = SPELL_KEYS[e.code];
		if (i === undefined || e.repeat || e.metaKey || e.ctrlKey || e.altKey || !active()) return;
		keysDown.add(e.code);
		if (castSlot(i, { shift: e.shiftKey })) e.preventDefault();
	}
	function onKeyUp(e) { if (SPELL_KEYS[e.code] !== undefined) { keysDown.delete(e.code); const id = state.binds[SPELL_KEYS[e.code]]; if (id) caster.release(id); } }
	function onMove(e) { if (e.pointerType !== 'mouse' || W()?.player?.state?.lookMode !== 'camera') return; const r = mount.getBoundingClientRect(); caster.setCursor({ x: (e.clientX - r.left) / r.width * 2 - 1, y: -((e.clientY - r.top) / r.height * 2 - 1) }); }
	const clearKeys = () => { keysDown.clear(); };
	addEventListener('keydown', onKey); addEventListener('keyup', onKeyUp); addEventListener('pointermove', onMove); addEventListener('blur', clearKeys);
	// mercy and its opposite, in the fabric (combat/morality.js's events)
	const unMoral = combat.morality?.on?.((e) => {
		if (e.kind === 'spare') { gather(state, 'light', 2); dirty = true; hint('Mercy shown: +2 light aether fabric', 1600); learnt(addXp(state, 25)); }
		else if (e.kind === 'kill' || e.kind === 'kill-surrendered') { gather(state, 'dark', e.kind === 'kill' ? 1 : 3); dirty = true; learnt(addXp(state, 10)); }
	});
	let player = null, lastH = 0, walked = 0;
	const lastPos = { x: NaN, z: NaN };
	function update(dt) {
		const Wd = W();
		if (!Wd?.player) return;
		// (a new world's player: told of the mouse's mode)
		if (player !== Wd.player) { player = Wd.player; player.state.onLookMode = (m) => hud.setMode(m); hud.setMode(player.state.lookMode); caster.clear(); aether.rescan(); lastPos.x = NaN; }
		// the ground you cover on foot ranks Athletics up (a step at a time: a jump across the
		// world, a flight or a ride does not count)
		const ps = Wd.player.state;
		if (!ps.flying && !busy() && Number.isFinite(lastPos.x)) {
			const d = Math.hypot(ps.pos.x - lastPos.x, ps.pos.z - lastPos.z);
			if (d < 25 * Math.max(dt, 0.016)) { walked += d; if (walked >= 15) { learnt(addUse(state, 'athletics', 1)); walked -= 15; } }
		}
		lastPos.x = ps.pos.x; lastPos.z = ps.pos.z;
		caster.update(dt, keysHeld);
		aether.update(dt, camera.position);
		fx.update(dt, caster.sighting());
		if (innerHeight !== lastH) { lastH = innerHeight; fx.resize(innerHeight, camera.fov); }
		hud.show(!busy());
		hud.update(performance.now() / 1000);
		saveT -= dt;
		if (saveT <= 0) { saveT = 5; if (dirty) { dirty = false; store.set(KEY, JSON.stringify(saveMagic(state))); } }
	}
	function dispose() { removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('pointermove', onMove); removeEventListener('blur', clearKeys); unMoral?.(); hotbar.dispose(); hud.dispose(); skills.dispose(); menuBtn?.remove(); fx.dispose(); combat.hooks.shield = combat.hooks.cloak = combat.hooks.power = null; }
	// for the console and the tests: Crysis.magic
	const api = {
		update, dispose, state, caster, hud, hotbar, skills, exposure: () => caster.exposure(),
		// (the menu open: the fight holds; fully over the world: it need not be drawn, main.js)
		menuOpen: () => skills.isOpen(),
		covering: () => skills.covering(),
		info: () => ({ known: state.known.length, binds: [...state.binds], fabric: { ...state.fabric }, affinity: { ...state.affinity }, wells: state.wells.length, near: aether.near().length, shown: aether.shown().length, level: state.level, xp: state.xp, points: pointsOf(state), perks: [...state.perks], ...caster.info() }),
		// (the console: experience, and a perk)
		xp: (n = 100) => { learnt(addXp(state, n)); return { level: state.level, xp: state.xp, points: pointsOf(state) }; },
		perk: (id) => { const ok = takePerk(state, id); if (ok) dirty = true; skills.refresh(); return ok; },
		use: (k, n = 100) => { learnt(addUse(state, k, n)); skills.refresh(); return state.use[k]; },
		cast: (id, o) => caster.cast(id, o || {}),
		learn: (id) => weave(state, id),
		// (the console: fabric of a strand, every spell known)
		give: (strand = 'light', n = 100) => { gather(state, strand, n); dirty = true; return { ...state.fabric }; },
		all: () => { for (const id of Object.keys(SPELL)) if (!state.known.includes(id)) state.known.push(id); state.affinity.light = state.affinity.dark = Math.max(400, state.affinity.light); dirty = true; return state.known.length; },
		bind: (i, id) => { const ok = bind(state, i, id); dirty = true; return ok; },
		slots: SLOTS,
	};
	return api;
}
