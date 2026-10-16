// Magic, gathered: your spells and fabric (magic/spells.js, kept between visits), the aether in
// the world (magic/aether.js), the spells at work (magic/caster.js), how they look and sound
// (magic/fx.js), the bar and the spellbook (magic/hud.js), and the weapons on the keys 1 to 5
// (combat/hotbar.js), which share the bar.
//
// Keys: 1 to 5 your weapons (again: put it away), 6 to 0 your spells (a beam is held), N the
// spellbook, Shift with Mark and Recall marks anew. The fight takes a spell's harm as its own
// (combat.deal), and lends its door for blows at you to the wards (combat.hooks.shield) and its
// eyes to the cloak (combat.hooks.cloak). Life taken gives a thread of dark fabric, mercy shown
// a thread or two of light.

import { createMagicState, saveMagic, weave, bind, gather, SPELL, SLOTS } from './spells.js';
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

// world(): the world (player, island, sky); light(): the sun's height (-1 .. 1); busy(): anything
// that has the controls (driving, a menu)
export function createMagic({ scene, camera, mount, combat, arms, world, light, heavens = () => null, hint = () => {}, busy = () => false, isPhone = false, isTouch = false }) {
	let saved = null;
	try { saved = JSON.parse(store.get(KEY) || 'null'); } catch { saved = null; }
	const state = createMagicState(saved);
	let dirty = false, saveT = 5;
	const fx = createMagicFx(scene, { isPhone });
	const W = () => world();
	const worldKey = () => combat.worldKey?.() || 'here';
	const seed = () => (W() ? seedOf(worldKey()) : null);
	const caster = createCaster({ camera, combat, player: () => W()?.player, state, fx, light, heavens, hint, sky: { get state() { return W()?.sky?.state; } }, worldKey, seed, isPhone });
	combat.hooks.shield = (blow) => caster.shieldBlow(blow);
	combat.hooks.cloak = () => caster.cloaked();
	const aether = createAether({
		fx, light, seed, state, isPhone,
		ground: (x, z) => combat.ground(x, z, camera.position.y + 40),
		heightAt: (x, z) => { const I = W()?.island; return I ? I.heightAt(x, z) : NaN; },
		onGather: (m, n) => {
			gather(state, m.strand, n); dirty = true;
			magicSound('gather', 0.1);
			hint(m.well ? `An aether well: +${n} ${m.strand} fabric. You will know the way back to it.` : `+${n} ${m.strand} aether fabric`, m.well ? 3500 : 1200);
		},
	});
	const active = () => !!W()?.player && !busy() && !mount.inert && mount.style.display !== 'none' && !hud?.isOpen() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && !window._KEYS_PLAY_ON;
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
	const hud = createMagicHud({
		mount, state, hotbar, isTouch,
		onCast: (i, o) => { if (castSlot(i, o) && SPELL[state.binds[i]]?.kind === 'beam') heldTap.set(state.binds[i], performance.now() + 2500); },
		onPress: (i) => hotbar.press(i),
		onWeave: (id) => { if (weave(state, id)) { dirty = true; magicSound(SPELL[id].school, 0.14); hint(`You have woven ${SPELL[id].name}.`, 2200); } },
		onBind: (i, id) => { bind(state, i, id); dirty = true; },
	});
	// (a beam is cast while its key is held; a tap on the bar holds it for a moment)
	const keysDown = new Set(), heldTap = new Map();
	const keysHeld = (id) => { for (const c of keysDown) if (state.binds[SPELL_KEYS[c]] === id) return true; return (heldTap.get(id) || 0) > performance.now(); };
	function onKey(e) {
		if (e.code === 'KeyN' && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !window._KEYS_PLAY_ON && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && mount.style.display !== 'none' && W()?.player && !busy()) { hud.toggle(); e.preventDefault(); return; }
		if (e.key === 'Escape' && hud.isOpen()) { hud.close(); return; }
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
		if (e.kind === 'spare') { gather(state, 'light', 2); dirty = true; hint('Mercy shown: +2 light aether fabric', 1600); }
		else if (e.kind === 'kill' || e.kind === 'kill-surrendered') { gather(state, 'dark', e.kind === 'kill' ? 1 : 3); dirty = true; }
	});
	let player = null, lastH = 0;
	function update(dt) {
		const Wd = W();
		if (!Wd?.player) return;
		// (a new world's player: told of the mouse's mode)
		if (player !== Wd.player) { player = Wd.player; player.state.onLookMode = (m) => hud.setMode(m); hud.setMode(player.state.lookMode); caster.clear(); aether.rescan(); }
		caster.update(dt, keysHeld);
		aether.update(dt, camera.position);
		fx.update(dt, caster.sighting());
		if (innerHeight !== lastH) { lastH = innerHeight; fx.resize(innerHeight, camera.fov); }
		hud.show(!busy());
		hud.update(performance.now() / 1000);
		saveT -= dt;
		if (saveT <= 0) { saveT = 5; if (dirty) { dirty = false; store.set(KEY, JSON.stringify(saveMagic(state))); } }
	}
	function dispose() { removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('pointermove', onMove); removeEventListener('blur', clearKeys); unMoral?.(); hotbar.dispose(); hud.dispose(); fx.dispose(); combat.hooks.shield = combat.hooks.cloak = null; }
	// for the console and the tests: Crysis.magic
	const api = {
		update, dispose, state, caster, hud, hotbar, exposure: () => caster.exposure(),
		info: () => ({ known: state.known.length, binds: [...state.binds], fabric: { ...state.fabric }, affinity: { ...state.affinity }, wells: state.wells.length, near: aether.near().length, shown: aether.shown().length, ...caster.info() }),
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
