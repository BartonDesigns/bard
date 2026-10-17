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
import { createCastHands } from './hands.js';
import { createBeams, CHARGE } from './beam.js';
import { encodeSpell, decodeSpell, SPELL_STYLE } from './net.js';
import { GLOW } from './fx.js';

const KEY = 'l99-magic';
const store = {
	get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
	set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const SPELL_KEYS = { Digit6: 0, Digit7: 1, Digit8: 2, Digit9: 3, Digit0: 4 };

// world(): the world (player, island, sky); light(): the sun's height (-1 .. 1); busy(): anything
// that has the controls (driving, a menu); me(): your body (people/avatar.js me: { P, M });
// third(): whether you are seen in third person (people/self.js)
export function createMagic({ scene, camera, mount, combat, arms, world, light, hint = () => {}, busy = () => false, isPhone = false, isTouch = false, me = () => null, third = () => false }) {
	let saved = null;
	try { saved = JSON.parse(store.get(KEY) || 'null'); } catch { saved = null; }
	const state = createMagicState(saved);
	let dirty = false, saveT = 5;
	const fx = createMagicFx(scene, { isPhone });
	const W = () => world();
	const worldKey = () => combat.worldKey?.() || 'here';
	const seed = () => (W() ? seedOf(worldKey()) : null);
	// your hands casting (first person), your body (third), and friends in the room told
	const hands = createCastHands({ camera, fx, isPhone });
	const beams = createBeams(scene, fx, { isPhone });
	function onCast(spell, from, to, pulse = false) {
		if (!pulse) {
			// (a beam: both hands out for as long as it pours, magic/hands.js when in your own eyes)
			if (spell.kind === 'beam') { if (third()) me()?.M?.gesture?.('beam', spell.t + CHARGE + 0.5); }
			else if (third()) me()?.M?.gesture?.(spell.tier >= 4 ? 'cast2' : 'cast');
			else if (!arms.held?.()) hands.cast(combat.melee?.state?.item ? 'L' : 'R', GLOW[spell.school], spell.tier >= 4);
		}
		const e = encodeSpell(spell.id, from, to);
		if (e) combat.sendFx?.(e.a, e.b, SPELL_STYLE, pulse ? 1 : 0);
	}
	const caster = createCaster({ camera, combat, player: () => W()?.player, state, fx, light, hint, sky: { get state() { return W()?.sky?.state; } }, worldKey, seed, isPhone, onCast, beams, third });
	combat.hooks.casting = () => hands.busy();
	// a friend's spell, seen: its light along its way, or bursting where it went
	const remote = [];
	combat.hooks.remoteSpell = (a, b, pulse, who) => {
		const sp = decodeSpell(b);
		if (!sp) return;
		const c = GLOW[sp.type === 'frost' ? 'frost' : sp.school];
		const d = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
		// (a friend's beam: gathering when cast, then pouring while its pulses keep coming)
		if (sp.kind === 'beam') { beams.show(`net:${who}`, a, b, c, pulse ? { ttl: 0.45 } : { charging: true, ttl: CHARGE + 0.1 }); return; }
		if (sp.kind === 'chain') { fx.line(a, b, c, 0.6, 0.25, 0.25, 1.4); return; }
		if (sp.kind === 'bolt' || sp.kind === 'orb') { remote.push({ a, b, c, t: 0, T: Math.max(0.05, d / (sp.speed || 40)), big: sp.kind === 'orb' }); return; }
		if (d > 1 && ['blink', 'recall', 'gate', 'rewind'].includes(sp.kind)) { fx.burst(a, c, 30, 2.5, 0.6, 0.3, 0); fx.burst(b, c, 30, 2.5, 0.6, 0.3, 0); return; }
		if (d > 1) { fx.burst(b, c, 50, 4, 0.7, 0.4, 1); fx.ring(b, sp.r || 4, c, 36, 0.5, 0.35); if (sp.kind === 'strike' || sp.kind === 'storm') fx.line({ x: b.x, y: b.y + 40, z: b.z }, b, c, 0.9, 0.3, 0.45, sp.kind === 'storm' ? 3 : 0.3); return; }
		// (cast on themselves or about them)
		fx.burst({ x: a.x, y: a.y - 0.6, z: a.z }, c, 30, 2, 0.7, 0.25, 0.8);
		if (sp.r) fx.ring({ x: a.x, y: a.y - 1.6, z: a.z }, sp.r, c, 36, 0.5, 0.3);
	};
	function stepRemote(dt) {
		for (let i = remote.length - 1; i >= 0; i--) {
			const R = remote[i];
			R.t += dt;
			const u = Math.min(1, R.t / R.T);
			const x = R.a.x + (R.b.x - R.a.x) * u, y = R.a.y + (R.b.y - R.a.y) * u, z = R.a.z + (R.b.z - R.a.z) * u;
			fx.emit(x, y, z, 0, 0, 0, 0.25, R.big ? 0.6 : 0.3, 0.05, R.c, 1, 0, 0);
			if (u >= 1) { fx.burst(R.b, R.c, 16, 3, 0.4, 0.22, 0.6); remote.splice(i, 1); }
		}
	}
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
	const hotbar = createHotbar({ arms, melee: () => combat.melee, store, ok: () => active(), hint });
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
	let player = null, lastH = 0, wasBeam = false;
	function update(dt) {
		const Wd = W();
		if (!Wd?.player) return;
		// (a new world's player: told of the mouse's mode)
		if (player !== Wd.player) { player = Wd.player; player.state.onLookMode = (m) => hud.setMode(m); hud.setMode(player.state.lookMode); caster.clear(); aether.rescan(); }
		caster.update(dt, keysHeld);
		beams.update(dt);
		// (your hands: your own, once your body is made; the beam's from the right one; none in third person)
		const body = me();
		if (body?.P) hands.setBody(body.P);
		const bs = caster.beaming(), beam = !third() && !arms.held?.() && bs ? GLOW[bs] : null;
		// (let go of a beam: the body's arms come down)
		if (wasBeam && !bs) body?.M?.ungesture?.('beam');
		wasBeam = !!bs;
		if (third()) hands.root.visible = false; else hands.update(dt, beam);
		stepRemote(dt);
		aether.update(dt, camera.position);
		fx.update(dt, caster.sighting());
		if (innerHeight !== lastH) { lastH = innerHeight; fx.resize(innerHeight, camera.fov); }
		hud.show(!busy());
		hud.update(performance.now() / 1000);
		saveT -= dt;
		if (saveT <= 0) { saveT = 5; if (dirty) { dirty = false; store.set(KEY, JSON.stringify(saveMagic(state))); } }
	}
	function dispose() { removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('pointermove', onMove); removeEventListener('blur', clearKeys); unMoral?.(); hotbar.dispose(); hud.dispose(); beams.dispose(); fx.dispose(); hands.dispose(); combat.hooks.shield = combat.hooks.cloak = combat.hooks.casting = combat.hooks.remoteSpell = null; }
	// for the console and the tests: Crysis.magic
	const api = {
		update, dispose, state, caster, hud, hotbar, exposure: () => caster.exposure(),
		// (the tests: your body, for its gestures)
		body: () => me(),
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
