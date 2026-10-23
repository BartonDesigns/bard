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

import { createMagicState, saveMagic, weave, weaveCost, bind, gather, manaMax, aetherShare, grantMoonlit, SPELL, SLOTS } from './spells.js';
import { ELEMENTS } from './elements.js';
import { sanitizeSkills, addUse, addXp, takePerk, pointsOf, rankOf, useFor, refreshMods, RANK_MAX, MASTERY, PAGES, PERKS, PERK, spellBlock, addMastery, feedSpell, masteryLevel, NUMERAL, MASTERY_GIFT } from './skills.js';
import { refreshStats, statSheet, BASE_LIFE } from './stats.js';
import { mealSig } from '../cooking/meals.js';
import { attunement, infuseStrands, isWeaponId, XP_PER_FABRIC } from '../gameplay/gear-magic.js';
import { MAX_LEVEL, xpToMax } from '../gameplay/gear-levels.js';
import { createSkillsMenu } from './skills-ui.js';
import { createMagicFx, magicSound } from './fx.js';
import { startSpellSound } from './sound.js';
import { createAether, seedOf } from './aether.js';
import { createCaster } from './caster.js';
import { createMagicHud } from './hud.js';
import { createHotbar } from '../combat/hotbar.js';
import { createCastHands } from './hands.js';
import { createBeams, CHARGE } from './beam.js';
import { encodeSpell, decodeSpell, SPELL_STYLE } from './net.js';
import { GLOW } from './fx.js';
import { createLens } from './lens.js';
import { pveHonor, pvpWin, addHonor, rankOf as honorRank, titleOf, honorSheet } from '../combat/honor.js';

const KEY = 'l99-magic', TEST_KEY = 'l99-magic-test';
const store = {
	get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
	set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};
const SPELL_KEYS = { Digit6: 0, Digit7: 1, Digit8: 2, Digit9: 3, Digit0: 4 };
const WEAK = new Set(['head', 'neck', 'weak', 'eye', 'heart']);

// world(): the world (player, island, sky); light(): the sun's height (-1 .. 1); busy(): anything
// that has the controls (driving, a menu); menu: the places menu, which gets a way in; me(): your
// body (people/avatar.js me: { P, M }); third(): whether you are seen in third person (people/self.js);
// heavens(): { sun, moon }, the directions toward each
export function createMagic({ scene, camera, mount, combat, arms, world, light, heavens = () => null, hint = () => {}, busy = () => false, menu = null, isPhone = false, isTouch = false, me = () => null, third = () => false, cover = () => {} }) {
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
		const sig = `${g.map((x) => `${x.u}:${x.l}:${x.t}`).join(',')}|${state.level}|${state.perks.length}|${PAGES.map((k) => rankOf(state.use[k] || 0)).join('.')}|${honorRank(state.honor.pts)}|${mealSig(state.fed)}`;
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
	const lens = createLens();
	const W = () => world();
	const worldKey = () => combat.worldKey?.() || 'here';
	const seed = () => (W() ? seedOf(worldKey()) : null);
	const track = (kind, a, b) => {
		if (kind === 'cast' && b > 0) {
			learnt(addUse(state, a.school, b));
			mastered(a.id, addMastery(state, a.id, b));
			// (garments learn from the weave they carry, twice as fast for their own school)
			for (const g of Object.values(arms.worn?.() || {})) gainGear(g.u, b / 6 * (attunement(g) === a.school ? 2 : 1));
		} else if (kind === 'hurt' && a > 0) {
			learnt(addUse(state, 'resilience', a / 2));
			const w = arms.worn?.() || {};
			gainGear(w.body?.u, a / 4); gainGear(w.head?.u, a / 6);
		}
	};
	// a spell's mastery risen: told, and what it opens named
	function mastered(id, up) {
		if (!up) return;
		dirty = true;
		const L = masteryLevel(state.mastery[id]), gift = MASTERY_GIFT[id]?.[L];
		if (!skills?.isOpen()) hint(`${SPELL[id].name}: mastery ${NUMERAL[L - 1]}${gift ? `. ${gift.name}: ${gift.text}` : '. It strikes harder.'}`, gift ? 4200 : 2200);
		magicSound('level', 0.12);
		skills?.refresh();
	}
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
	const caster = createCaster({ camera, combat, player: () => W()?.player, state, fx, light, hint, sky: { get state() { return W()?.sky?.state; } }, worldKey, seed, isPhone, track, onCast, beams, third, heavens });
	// the spells' sound (magic/sound.js), heard from your eye, left or right of where you look
	// (the way you look, from the camera's own axes: its -z column is forward)
	const spellSound = startSpellSound({ eye: () => camera.position, yaw: () => { const m = camera.matrixWorld.elements; return Math.atan2(m[8], m[10]); }, isPhone });
	const warmSound = () => spellSound.warm([...new Set(state.binds.filter(Boolean).map((id) => SPELL[id]?.school).filter(Boolean))].flatMap((s) => [s, `${s}-hit`, `${s}-blast`]));
	combat.hooks.casting = () => hands.busy();
	// (the crosshair to aim a spell by, as with a gun: up whenever a spell is bound and you are free to cast it,
	// full while your hands are casting; Ryan found spells far easier to aim with a reticle up)
	combat.hooks.spellAim = () => !active() || !state.binds.some(Boolean) ? 0 : hands.busy() ? 1 : 0.7;
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
		if (sp.kind === 'lances') { caster.seeLances(b); return; }
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
			// (more of the strand your name leans to, less of the other; and what your perks and gear add)
			const share = aetherShare(m.strand, combat.morality?.reactions?.()?.reputation || 0), n = Math.max(1, Math.round(n0 * share * (1 + (state.mods?.fabric?.[m.strand] || 0))));
			gather(state, m.strand, n); dirty = true;
			learnt(addXp(state, n * 2));
			magicSound('gather', 0.1);
			hint(m.well ? `An aether well: +${n} ${m.strand} fabric. You will know the way back to it.` : `+${n} ${m.strand} aether fabric${share > 1.15 ? ' (your name draws it)' : share < 0.85 ? ' (it shies from your name)' : ''}`, m.well ? 3500 : 1200);
		},
	});
	const active = () => !!W()?.player && !busy() && !mount.inert && mount.style.display !== 'none' && !skills?.isOpen() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') && !window._KEYS_PLAY_ON;
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
	// the skills and magic menu: weave a spell, take a perk, slot a spell to a key
	skills = createSkillsMenu({
		mount, state, light, isTouch, isPhone, elements: ELEMENTS, cover,
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
		onBind: (i, id) => { bind(state, i, id); dirty = true; warmSound(); },
		// aether poured into a spell you know: n points of its mastery
		onFeed: (id, n) => {
			const r = feedSpell(state, id, n);
			if (!r.fed) return r;
			dirty = true;
			learnt(addXp(state, r.fed));
			if (r.levels) mastered(id, r.levels);
			return r;
		},
	});
	// (it opens where it was left; not while driving, flying a craft or in another screen)
	const openSkills = (k) => { if (!W()?.player) return; if (busy()) { hint('Skills and magic open once you are on your feet.', 1600); return; } skills.open(k); };
	hud = createMagicHud({
		mount, state, hotbar, isTouch,
		onCast: (i, o) => { if (castSlot(i, o) && SPELL[state.binds[i]]?.kind === 'beam') heldTap.set(state.binds[i], performance.now() + 2500); },
		onPress: (i) => hotbar.press(i),
		onBook: () => openSkills(),
		bookOpen: () => skills.isOpen(),
		hint: (t, ms) => hint(t, ms),
	});
	// a way in from the places menu, at its top
	let menuBtn = null;
	if (menu) {
		menuBtn = document.createElement('button');
		menuBtn.type = 'button';
		menuBtn.textContent = '✦ Skills and magic';
		menuBtn.title = 'Skills and magic (Tab or N)';
		menuBtn.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(94,234,212,.35);background:rgba(1,169,130,.12);color:#eafaf6;font:13px var(--bard-body,system-ui,sans-serif);min-height:36px;cursor:pointer;';
		for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) menuBtn.addEventListener(ev, (x) => x.stopPropagation());
		menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = 'none'; openSkills(); });
		menu.insertBefore(menuBtn, menu.firstChild);
	}
	// ---------- test mode (a button in the places menu, under the one above) ----------
	// Everything open for trying spells without the climb: every spell known and mastered, every
	// skill at its top rank, every perk taken, and mana, aether and cooldowns never running out.
	// What you had is kept as it was saved and comes back when it is turned off; nothing earned
	// while it is on is saved.
	let testOn = false, testBtn = null;
	const FULL = 99999;
	function unlockAll() {
		for (const id of Object.keys(SPELL)) if (!state.known.includes(id)) state.known.push(id);
		state.affinity.light = Math.max(state.affinity.light, 400); state.affinity.dark = Math.max(state.affinity.dark, 400);
		for (const k of PAGES) state.use[k] = useFor(RANK_MAX);
		for (const id of state.known) state.mastery[id] = MASTERY[MASTERY.length - 1];
		state.level = Math.max(state.level, PERKS.length);
		// (perks in as many passes as their hanging from one another needs)
		for (let pass = 0, took = true; took && pass < 20; pass++) { took = false; for (const p of PERKS) if (takePerk(state, p.id)) took = true; }
		refreshMods(state);
	}
	function topUp() { state.mana = manaMax(state); state.fabric.light = state.fabric.dark = FULL; state.cds = {}; }
	function setTest(on) {
		on = !!on;
		if (on === testOn) return testOn;
		if (on) { store.set(KEY, JSON.stringify(saveMagic(state))); dirty = false; testOn = true; unlockAll(); topUp(); }
		else {
			testOn = false;
			let saved = null;
			try { saved = JSON.parse(store.get(KEY) || 'null'); } catch { saved = null; }
			const back = sanitizeSkills(createMagicState(saved));
			// (only what is saved comes back: what else the state carries, the gear, stays as it is)
			Object.assign(state, back);
			state.cds = {};
		}
		try { store.set(TEST_KEY, on ? '1' : ''); } catch { /* private mode */ }
		if (testBtn) { testBtn.textContent = on ? '∞ Test mode: on' : '∞ Test mode: off'; testBtn.style.borderColor = on ? 'rgba(245,158,11,.7)' : 'rgba(255,255,255,.15)'; }
		skills?.refresh?.();
		hint(on ? 'Test mode: every spell, skill and perk open; mana, aether and cooldowns endless.' : 'Test mode off: your own spells and skills are back.', 2600);
		return testOn;
	}
	if (menu) {
		testBtn = document.createElement('button');
		testBtn.type = 'button';
		testBtn.textContent = '∞ Test mode: off';
		testBtn.title = 'Every spell and skill unlocked, endless mana and aether (nothing is saved while on)';
		testBtn.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px var(--bard-body,system-ui,sans-serif);min-height:36px;cursor:pointer;';
		for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) testBtn.addEventListener(ev, (x) => x.stopPropagation());
		testBtn.addEventListener('click', (e) => { e.stopPropagation(); setTest(!testOn); });
		menu.insertBefore(testBtn, menuBtn.nextSibling);
	}
	if (store.get(TEST_KEY) === '1') setTest(true);
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
	// ---------- honor (combat/honor.js): earned in fair fights, PvE and PvP ----------
	// Each rank lifts combat, health and defence (magic/stats.js folds it into state.mods).
	// What it is given: { n, from, to } (addHonor's); why: a few words for the hint
	function honored(r, why = '', quiet = false) {
		if (!r?.n) return;
		dirty = true;
		if (r.n > 0) learnt(addXp(state, r.n));
		if (r.to !== r.from) {
			restat(true);
			if (r.to > r.from) { hint(`Honor rank ${r.to}: ${titleOf(r.to)}. Your combat, health and defence rise.`, 5000, 2); magicSound('level', 0.16); }
			else hint(`Honor lost: you are ${titleOf(r.to)} again.`, 4000, 1);
		} else if (!quiet) hint(`${r.n > 0 ? '+' : '−'}${Math.abs(r.n)} honor${why ? `: ${why}` : ''}`, 1800);
	}
	const HONOR_WHY = { 'boss-slain': 'a great foe brought down', 'defend-village': 'the village held', spare: 'mercy shown', 'kill-surrendered': 'they had surrendered' };
	combat.hooks.honorRank = () => honorRank(state.honor.pts);
	// (your mana, for a friend's target frame in PvP: combat.js vitals)
	combat.hooks.mana = () => ({ mana: state.mana, max: manaMax(state) });
	combat.hooks.pvpWin = (v) => honored(pvpWin(state.honor, v.from, v.r), `you beat ${v.name}`);
	// mercy and its opposite, in the fabric (combat/morality.js's events), and the honor in them
	// (a great foe falls once, though its fall is told twice: by the blow and by the fight's end)
	let bossFell = { target: '', t: 0 };
	const unMoral = combat.morality?.on?.((e) => {
		const again = e.kind === 'boss-slain' && e.target === bossFell.target && Date.now() - bossFell.t < 30000;
		if (e.kind === 'boss-slain') bossFell = { target: e.target, t: Date.now() };
		const h = again ? 0 : pveHonor(e);
		// (mercy says its honor in its own line)
		if (h) honored(addHonor(state.honor, h, 'pve'), HONOR_WHY[e.kind] || (h < 0 ? 'no honor in that' : ''), e.kind === 'spare');
		if (e.kind === 'spare') { gather(state, 'light', 2); dirty = true; hint(`Mercy shown: +2 light aether fabric${h ? `, +${h} honor` : ''}`, 1600); learnt(addXp(state, 25)); }
		else if (e.kind === 'kill' || e.kind === 'kill-surrendered') { gather(state, 'dark', e.kind === 'kill' ? 1 : 3); dirty = true; learnt(addXp(state, 10)); }
	});
	let player = null, lastH = 0, walked = 0, wasBeam = false;
	const lastPos = { x: NaN, z: NaN };
	// (a hard hit near you is felt: the view kicks and the edges of the screen flare in its colour,
	// both scaled by how hard it struck and how near; fx.flash keeps the hardest of each frame)
	const pulse = document.createElement('div');
	pulse.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;opacity:0;mix-blend-mode:screen';
	mount.appendChild(pulse);
	let pulseA = 0;
	function feel(dt) {
		const f = fx.takeFlash();
		if (f) {
			const d = Math.hypot(f.x - camera.position.x, f.y - camera.position.y, f.z - camera.position.z);
			const k = f.k * Math.max(0, Math.min(1, 1.15 - d / 45));
			if (k > 0.06) {
				combat.shake?.(0.3 * k);
				if (0.7 * k > pulseA) {
					pulseA = 0.7 * k;
					const [r, g, b] = f.c.map((v) => Math.round(Math.min(1, v) * 255));
					pulse.style.background = `radial-gradient(ellipse at center, rgba(${r},${g},${b},0) 45%, rgba(${r},${g},${b},0.9) 100%)`;
				}
			}
		}
		if (pulseA > 0) { pulseA = Math.max(0, pulseA - dt * 1.8); pulse.style.opacity = pulseA.toFixed(3); }
	}
	let warmed = false;
	function update(dt) {
		if (!warmed && W()?.player) { warmed = true; warmSound(); }
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
		// (gathered where you are, not where the camera is: Explore and the third person film you from a way off)
		aether.update(dt, ps.pos);
		fx.update(dt, caster.sighting());
		feel(dt);
		if (innerHeight !== lastH) { lastH = innerHeight; fx.resize(innerHeight, camera.fov); }
		hud.show(!busy());
		hud.update(performance.now() / 1000);
		if (testOn) topUp();
		saveT -= dt;
		if (saveT <= 0) { saveT = 5; if (dirty && !testOn) { dirty = false; store.set(KEY, JSON.stringify(saveMagic(state))); } }
	}
	function dispose() { removeEventListener('keydown', onKey); removeEventListener('keyup', onKeyUp); removeEventListener('pointermove', onMove); removeEventListener('blur', clearKeys); unMoral?.(); hotbar.dispose(); hud.dispose(); skills.dispose(); menuBtn?.remove(); testBtn?.remove(); beams.dispose(); fx.dispose(); lens.dispose(); hands.dispose(); pulse.remove(); combat.hooks.shield = combat.hooks.cloak = combat.hooks.power = combat.hooks.casting = combat.hooks.spellAim = combat.hooks.remoteSpell = combat.hooks.honorRank = combat.hooks.pvpWin = combat.hooks.mana = null; }
	// for the console and the tests: Crysis.magic
	const api = {
		update, dispose, state, caster, hud, hotbar, skills, exposure: () => caster.exposure(),
		// (the menu open: the fight holds; fully over the world: it need not be drawn, main.js)
		// (Gargantua putting out the sky: how much the world's daylight should dim, 0 to 1)
		darkness: () => fx.darkness(),
		// (Solar Flare channels the moon by night: the skills side grants this; here for the console)
		moonlit: (id = 'solar-flare') => { const ok = grantMoonlit(state, id); if (ok) dirty = true; return ok; },
		menuOpen: () => skills.isOpen(),
		// the aether showing now, not yet gathered (Explore goes after it: explore.js)
		motes: () => aether.shown(),
		// (test mode: Crysis.magic.test(true / false), as the button in the places menu)
		test: (on) => (on === undefined ? testOn : setTest(on)),
		// (the tests: your casting hands, for their palm light; the screen edge's flash)
		hands: () => hands.root,
		edge: () => +pulse.style.opacity || 0,
		// (the tests: your body, for its gestures)
		body: () => me(),
		covering: () => skills.covering(),
		// after the frame is drawn (main.js): the light round Gargantua's rim bent, and its ending's grade (magic/lens.js)
		post: (renderer) => lens.post(renderer, camera, fx.lenses(), performance.now() / 1000, fx.grade()),
		info: () => ({ known: state.known.length, binds: [...state.binds], fabric: { ...state.fabric }, affinity: { ...state.affinity }, wells: state.wells.length, near: aether.near().length, shown: aether.shown().length, level: state.level, xp: state.xp, points: pointsOf(state), perks: [...state.perks], mastery: { ...state.mastery }, moonlit: [...(state.moonlit || [])], life: BASE_LIFE + (state.mods?.life || 0), gear: state.gear.map((x) => ({ i: x.i, l: x.l, t: x.t, school: attunement(x) })), ...caster.info() }),
		// your statistics as a sheet (the Character view, ui/gear.js), and fabric into gear
		stats: () => statSheet(state, { light: light() }),
		// your honor: rank, title, the way to the next, and what it lifts (the Character view)
		honor: () => honorSheet(state.honor, combat.pvpFlag?.()),
		// (the console and the tests: honor given, n < 0 taken; way 'pve' or 'pvp')
		giveHonor: (n = 50, way = 'pve') => { honored(addHonor(state.honor, n, way)); return honorSheet(state.honor, combat.pvpFlag?.()); },
		infuse, restat: () => restat(true),
		// the meals on you today (cooking/meals.js), folded into your stats
		setMeals: (list) => { state.fed = Array.isArray(list) ? list.slice() : []; restat(); skills?.refresh?.(); },
		// (the console: experience, and a perk)
		xp: (n = 100) => { learnt(addXp(state, n)); return { level: state.level, xp: state.xp, points: pointsOf(state) }; },
		perk: (id) => { const ok = takePerk(state, id); if (ok) { dirty = true; restat(true); } skills.refresh(); return ok; },
		use: (k, n = 100) => { learnt(addUse(state, k, n)); skills.refresh(); return state.use[k]; },
		master: (id, n = 100) => { mastered(id, addMastery(state, id, n)); skills.refresh(); return state.mastery[id]; },
		cast: (id, o) => caster.cast(id, o || {}),
		// (a beam cast and held for ms, as a tap on the bar holds it)
		hold: (id, ms = 2500) => { const ok = caster.cast(id, {}); if (ok) heldTap.set(id, performance.now() + ms); return ok; },
		learn: (id) => weave(state, id),
		// (the console: fabric of a strand, every spell known)
		give: (strand = 'light', n = 100) => { gather(state, strand, n); dirty = true; return { ...state.fabric }; },
		all: () => { for (const id of Object.keys(SPELL)) if (!state.known.includes(id)) state.known.push(id); state.affinity.light = state.affinity.dark = Math.max(400, state.affinity.light); dirty = true; return state.known.length; },
		bind: (i, id) => { const ok = bind(state, i, id); dirty = true; return ok; },
		slots: SLOTS,
	};
	return api;
}
