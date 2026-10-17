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
//
// Your statistics (magic/stats.js): seven attributes from your ranks, your level and what you
// wear and hold, and the gear's own magic (gameplay/gear-magic.js), all folded into state.mods
// whenever any of them changes. The weapon in hand's magic rides its hits (combat.hooks.power):
// a share of the harm, then what it carries (a status, an arc, a ward, mending, fleet feet,
// mana), time off its school's cooldowns, and every few hits a spell of its own. What you wear
// and hold learns as you go (gear experience, counted every few seconds), and takes aether
// fabric of its school's strand to grow faster (infuse).

import { createMagicState, saveMagic, weave, weaveCost, bind, gather, manaMax, SPELL, SLOTS } from './spells.js';
import { sanitizeSkills, addUse, addXp, takePerk, pointsOf, rankOf, PAGES, PERK, spellBlock } from './skills.js';
import { refreshStats, statSheet, BASE_LIFE } from './stats.js';
import { attunement, infuseStrands, isWeaponId, XP_PER_FABRIC } from '../gameplay/gear-magic.js';
import { MAX_LEVEL, xpToMax } from '../gameplay/gear-levels.js';
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
	// ---------- your statistics: what you wear and hold, your ranks and level ----------
	const gearNow = () => [...Object.values(arms.worn?.() || {}), arms.held?.()].filter(Boolean);
	let statSig = '', statT = 0;
	// (made anew when any of what feeds them has changed; force: now, whatever)
	function restat(force = false) {
		const g = gearNow();
		const sig = `${g.map((x) => `${x.u}:${x.l}:${x.t}`).join(',')}|${state.level}|${state.perks.length}|${PAGES.map((k) => rankOf(state.use[k] || 0)).join('.')}`;
		if (!force && sig === statSig) return false;
		statSig = sig; state.gear = g;
		refreshStats(state);
		combat.setLifeMax?.(BASE_LIFE + (state.mods.life || 0));
		return true;
	}
	restat(true);
	// experience for what you wear and hold, gathered and counted every few seconds
	const gearXp = {};
	let gearT = 8;
	const gainGear = (uid, n) => { if (uid && n > 0) gearXp[uid] = (gearXp[uid] || 0) + n; };
	function announce(up) {
		for (const x of up) {
			const woke = x.awake.at(-1);
			hint(`${x.name} reached level ${x.to}.${woke ? ` ${woke.name}: ${woke.desc}` : ''}`, woke ? 6000 : 3500);
			if (woke) magicSound('level', 0.12);
		}
		if (up.length) restat(true);
	}
	function flushGear() {
		const gains = {};
		for (const [u, n] of Object.entries(gearXp)) {
			if (!arms.instance?.(u)) { delete gearXp[u]; continue; }
			if (n >= 1) { gains[u] = Math.floor(n); gearXp[u] -= gains[u]; }
		}
		if (Object.keys(gains).length) announce(arms.trainMany?.(gains) || []);
	}
	const fx = createMagicFx(scene, { isPhone });
	const W = () => world();
	const worldKey = () => combat.worldKey?.() || 'here';
	const seed = () => (W() ? seedOf(worldKey()) : null);
	const track = (kind, a, b) => {
		if (kind === 'cast' && b > 0) {
			learnt(addUse(state, a.school, b));
			// (garments learn from the weave they carry, twice as fast for their own school)
			for (const g of Object.values(arms.worn?.() || {})) gainGear(g.u, b / 6 * (attunement(g) === a.school ? 2 : 1));
		} else if (kind === 'hurt' && a > 0) {
			learnt(addUse(state, 'resilience', a / 2));
			const w = arms.worn?.() || {};
			gainGear(w.body?.u, a / 4); gainGear(w.head?.u, a / 6);
		}
	};
	const caster = createCaster({ camera, combat, player: () => W()?.player, state, fx, light, hint, sky: { get state() { return W()?.sky?.state; } }, worldKey, seed, isPhone, track });
	combat.hooks.shield = (blow) => caster.shieldBlow(blow);
	combat.hooks.cloak = () => caster.cloaked();
	// your weapons' blows, as your Marksman perks and Precision shape them; their harm ranks
	// Marksman up, and teaches the weapon. The weapon in hand's own magic (gear-magic.js) rides
	// its own shots at those who fight you: never a fist, never a bystander.
	const hitQ = [];
	let shots = 0, shotUid = null;
	combat.hooks.power = (T, blow) => {
		const M = state.mods, H = blow.melee ? null : arms.held?.();
		const foe = T?.kind === 'hostile' || T?.kind === 'boss';
		const GW = foe && H && M?.gearWeapon?.uid === H.u ? M.gearWeapon : null;
		const k = 1 + (M?.weapon || 0) + (WEAK.has(blow.part) ? M?.weak || 0 : 0) + (T?.kind === 'boss' ? M?.boss || 0 : 0) + (GW?.infuse?.harm || 0);
		if (M?.manaOnHit) state.mana = Math.min(state.mana + M.manaOnHit, 9999);
		learnt(addUse(state, 'marksman', Math.min(60, blow.amount * k) / 3));
		if (H && isWeaponId(H.i)) gainGear(H.u, Math.min(4, blow.amount * k / 20));
		// (what the hit carries is done after it lands, in update: no harm dealt inside a blow)
		if (GW && hitQ.length < 32) hitQ.push({ T, amount: blow.amount * k, GW });
		return k === 1 ? blow : { ...blow, amount: blow.amount * k };
	};
	function afterHits() {
		while (hitQ.length) {
			const { T, amount, GW } = hitQ.shift(), I = GW.infuse;
			if (GW.strike) caster.strike(GW.school, GW.strike);
			if (I) {
				if (I.status) caster.hexOn(T, I.status);
				if (I.arc) caster.arc(T, amount * I.arc, I.hop);
				if (I.ward) caster.ward(I.ward, I.wardMax);
				if (I.leech) combat.mend(amount * I.leech);
				if (I.haste) caster.fleet(I.haste, I.t);
				if (I.mana) state.mana = Math.min(manaMax(state), state.mana + I.mana);
			}
			// (Spellshot: every few hits, a spell of its own along your aim)
			if (GW.shot) {
				if (shotUid !== GW.uid) { shotUid = GW.uid; shots = 0; }
				if (++shots >= GW.shot.every) { shots = 0; caster.cast(GW.shot.spell, { free: true, quiet: true }); }
			}
		}
	}
	// aether fabric woven into a weapon or garment: XP_PER_FABRIC experience a thread, of its
	// school's strand (either strand for a twilight school), no more than it can use
	function infuse(uid, strand, n = 10) {
		const x = arms.instance?.(uid);
		if (!x || !attunement(x)) return { ok: false, message: 'Only weapons and garments take the weave.' };
		const can = infuseStrands(x);
		if (!can.includes(strand)) return { ok: false, message: `It takes ${can.join(' or ')} fabric.` };
		if (x.l >= MAX_LEVEL) return { ok: false, message: 'It is at its highest level.' };
		// (gear is held still while a trade is open: the fabric would be spent for nothing)
		if (arms.locked?.()) return { ok: false, message: 'Finish the pending trade first.' };
		n = Math.min(Math.floor(+n || 0), state.fabric[strand], Math.ceil(xpToMax(x) / XP_PER_FABRIC));
		if (n < 1) return { ok: false, message: `You have no ${strand} fabric to weave in.` };
		state.fabric[strand] -= n; dirty = true;
		const up = [];
		// (a training step is at most 1000 experience)
		for (let left = n * XP_PER_FABRIC; left > 0; left -= 1000) up.push(...(arms.trainMany?.({ [uid]: Math.min(1000, left) }) || []));
		learnt(addXp(state, n));
		magicSound(attunement(x), 0.12);
		announce(up.length ? [{ ...up[0], to: up.at(-1).to, awake: up.flatMap((u) => u.awake) }] : []);
		return { ok: true, spent: n, level: arms.instance?.(uid)?.l || x.l, message: `${n} ${strand} fabric woven in: +${n * XP_PER_FABRIC} experience.` };
	}
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
			if (spellBlock(state, SPELL[id]) || !weave(state, id)) return false;
			dirty = true; magicSound(SPELL[id].school, 0.14);
			learnt(addUse(state, SPELL[id].school, c.light + c.dark));
			return true;
		},
		onPerk: (id) => {
			if (!takePerk(state, id)) return false;
			dirty = true; magicSound(PERK[id].page, 0.14);
			restat(true);
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
			if (d < 25 * Math.max(dt, 0.016)) { walked += d; if (walked >= 15) { learnt(addUse(state, 'athletics', 1)); gainGear(arms.worn?.().feet?.u, 1); walked -= 15; } }
		}
		lastPos.x = ps.pos.x; lastPos.z = ps.pos.z;
		// (your statistics kept up with what you wear and hold, and with your ranks)
		statT -= dt;
		if (statT <= 0) { statT = 0.25; if (restat() && skills?.isOpen()) skills.refresh(); }
		gearT -= dt;
		if (gearT <= 0) { gearT = 8; flushGear(); }
		afterHits();
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
		info: () => ({ known: state.known.length, binds: [...state.binds], fabric: { ...state.fabric }, affinity: { ...state.affinity }, wells: state.wells.length, near: aether.near().length, shown: aether.shown().length, level: state.level, xp: state.xp, points: pointsOf(state), perks: [...state.perks], life: BASE_LIFE + (state.mods?.life || 0), gear: state.gear.map((x) => ({ i: x.i, l: x.l, t: x.t, school: attunement(x) })), ...caster.info() }),
		// your statistics as a sheet (the Character view, ui/gear.js), and fabric into gear
		stats: () => statSheet(state, { light: light() }),
		infuse, restat: () => restat(true),
		// (the console: experience, and a perk)
		xp: (n = 100) => { learnt(addXp(state, n)); return { level: state.level, xp: state.xp, points: pointsOf(state) }; },
		perk: (id) => { const ok = takePerk(state, id); if (ok) { dirty = true; restat(true); } skills.refresh(); return ok; },
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
