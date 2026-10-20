// Your guild's townsfolk in the world: those set to walk with you come out at your back as
// fighters on your side (combat/ai-squads.js, faction 'guild': followStep, allyTarget), fight
// whoever fights you, cast the spells their calling has taught them (guild/guild-rules.js
// PATHS, SPELL_ACTS), learn from every foe that falls near them, and when struck down are
// carried off to rest a while (REST_MS) before they come out again.
//
// Their spells are drawn the way a friend's are in a room (magic/index.js remoteSpell), from
// their hands to where they went; the harm is dealt through the combat layer like any shot,
// so the Spark's ward, surrender and the rest hold for them as for everyone.

import { personDNA } from '../people/body.js';
import { SPELL } from '../magic/spells.js';
import { encodeSpell } from '../magic/net.js';
import { PLAYER } from '../combat/factions.js';
import { ROLES, SPELL_ACTS, FOLLOW_MAX, REST_MS, SHARE, statsFor, followers, giveXp, xpForKill } from './guild-rules.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const GUN_LEVEL = (L) => Math.min(10, 2 + Math.floor(L / 4)), GUN_TIER = (L) => Math.min(4, Math.floor(L / 7));

// combat: createCombat's api; guild(): your guild (guild-rules.js readGuild shape) or null;
// save(): it changed; onFoot(): you walk the world (not driving, in orbit, in a menu's world);
// yaw(): which way you face; hint(text, ms)
export function createCompanions({ combat, guild, save, onFoot = () => true, yaw = () => 0, hint = () => {}, isPhone = false }) {
	const squads = combat.squads, max = isPhone ? FOLLOW_MAX.phone : FOLLOW_MAX.desktop;
	const pending = new Set(), cds = new Map(), queued = [];
	let sq = null, scanT = 0, time = 0, off = false;

	const present = () => squads.allies();
	const byId = (id) => present().find((h) => h.ally?.id === id);
	// the squad they walk in (a world change clears every squad: a new one then)
	function squadNow() {
		if (sq && squads.squads.get(sq.id) === sq) return Promise.resolve(sq);
		const e = combat.eye();
		return squads.squad('guild', e.x, e.z, 0, {}).then((s) => (sq = s));
	}
	// a spot out of sight at your back, a little way off (or where they stood: a new member)
	function spotBehind(k) {
		const e = combat.eye(), a = yaw() || 0, fx = -Math.sin(a), fz = -Math.cos(a), side = (k % 2 ? 1 : -1) * (2 + k);
		return { x: e.x - fx * 9 + fz * side, z: e.z - fz * 9 - fx * side };
	}
	async function call(m, at = null) {
		if (!max || pending.has(m.id) || byId(m.id)) return;
		pending.add(m.id);
		try {
			const S = await squadNow();
			if (!guild()?.npcs.includes(m)) return;
			const st = statsFor(m), R = ROLES[m.role], p = at || spotBehind(S.members.length);
			const dna = m.dna || personDNA(m.seed);
			const h = await squads.spawn('guild', p.x, p.z, S, {
				ally: m, dna, id: `ga${m.id}`, yaw: at?.yaw,
				F: { name: m.first, gun: R.gun, hp: 100 * st.hpK, acc: st.acc },
				B: { dmg: 7 * st.dmgK, sight: 70 }, armour: st.armour, level: GUN_LEVEL(st.level), tier: GUN_TIER(st.level),
			});
			if (h && !guild()?.npcs.includes(m)) squads.release(h);
		} finally { pending.delete(m.id); }
	}
	// their numbers brought up to their level (a level gained mid-fight shows at once)
	function restat(h) {
		const st = statsFor(h.ally), f = h.H.hp / Math.max(1, h.H.max);
		h.H.max = 100 * st.hpK; h.H.hp = Math.max(1, h.H.max * f); h.H.armour = h.H.armourMax = st.armour;
		h.F.acc = st.acc; h.B.dmg = 7 * st.dmgK;
	}

	// who should be out, every half second: called out, or sent home
	function update(dt) {
		time += dt;
		for (let i = queued.length - 1; i >= 0; i--) if (time >= queued[i].at) { const q = queued.splice(i, 1)[0]; q.fn(); }
		if ((scanT -= dt) > 0) return;
		scanT = 0.5;
		const g = guild(), now = Date.now();
		const want = !off && g && onFoot() ? followers(g, now, max) : [];
		for (const h of present()) if (!want.includes(h.ally)) squads.release(h);
		for (const m of want) if (!byId(m.id)) call(m);
	}

	// ---------- their spells ----------
	// a foe of yours (allyTarget's reckoning, for those about the one they aim at)
	const foe = (o) => !o.dead && !o.ally && !o.surrendered && !o.crew && (o.target?.id === 'me' || !!o.target?.ref?.ally || o.provoked || combat.relations.hostile(PLAYER, o.fid));
	const near = (x, z, r) => squads.alive().filter((o) => foe(o) && Math.hypot(o.pos.x - x, o.pos.z - z) <= r);
	function draw(id, from, to, who) {
		const e = encodeSpell(id, from, to);
		if (e) combat.hooks.remoteSpell?.(e.a, e.b, 0, who);
	}
	function harm(h, o, amount, from, sp) {
		const T = o.T || o, dx = T.bound.x - from.x, dz = T.bound.z - from.z, l = Math.hypot(dx, dz) || 1;
		combat.deal(T, { amount, type: sp.type === 'fire' ? 'fire' : 'energy', part: 'chest', src: from, dir: { x: dx / l, z: dz / l }, by: h.T, spell: true }, false);
	}
	// h: one of yours; cast a spell when one is ready and it is worth casting
	function cast(h, dt) {
		if ((h.castT -= dt) > 0 || h.dead || !h.body) return;
		h.castT = 0.4;
		const m = h.ally, st = statsFor(m), vit = combat.vitals(), e = combat.eye();
		const mine = cds.get(m.id) || {}, ready = (id) => !(mine[id] > time);
		const from = { x: h.pos.x, y: h.pos.y + 1.45, z: h.pos.z }, who = `guild:${m.id}`;
		const dMe = Math.hypot(e.x - h.pos.x, e.z - h.pos.z);
		let use = null, at = null;
		// you hurt and near: mended first; then themselves, badly hurt
		const heal = m.spells.filter((id) => SPELL_ACTS[id]?.act === 'heal' && ready(id)).sort((a, b) => SPELL_ACTS[b].heal - SPELL_ACTS[a].heal)[0];
		if (heal && !vit.ko && vit.hp < vit.max * 0.65 && dMe < 25) { use = heal; at = { x: e.x, y: e.y - 0.4, z: e.z }; }
		else if (heal && h.H.hp < h.H.max * 0.45) { use = heal; at = from; }
		// a foe in sight: the strongest spell that is ready (one that strikes round them when they stand together)
		else if (h.target && h.los && h.target.id !== 'me' && h.target.bound) {
			const B = h.target.bound, crowd = near(B.x, B.z, 7).length;
			const opts = m.spells.filter((id) => SPELL_ACTS[id] && SPELL_ACTS[id].act !== 'heal' && ready(id) && (SPELL_ACTS[id].act !== 'nova' || Math.hypot(B.x - h.pos.x, B.z - h.pos.z) < SPELL_ACTS[id].r));
			opts.sort((a, b) => score(b, crowd) - score(a, crowd));
			if (opts[0]) { use = opts[0]; at = { x: B.x, y: B.y + 0.3, z: B.z }; }
		}
		if (!use) return;
		const A = SPELL_ACTS[use], sp = SPELL[use] || {};
		mine[use] = time + A.cd; cds.set(m.id, mine);
		h.castT = st.castGap * rnd(0.8, 1.25);
		h.body.M.gesture?.(A.dmg > 60 ? 'cast2' : 'cast');
		if (A.dmg > 60 || Math.random() < 0.15) combat.call(`${sp.name || 'A spell'}!`, m.first);
		const k = st.spellK;
		if (A.act === 'heal') {
			draw(use, from, at, who);
			const n = A.heal * k;
			if (at !== from || A.all) combat.mend(n);
			if (at === from || A.all) for (const q of A.all ? present() : [h]) q.H.hp = Math.min(q.H.max, q.H.hp + n);
			return;
		}
		const T0 = h.target;
		if (A.act === 'bolt') {
			draw(use, from, at, who);
			// (it lands when it gets there)
			const d = Math.hypot(at.x - from.x, at.y - from.y, at.z - from.z);
			queued.push({ at: time + Math.min(1.2, d / (sp.speed || 60)), fn: () => { if (!h.dead && T0.ref && !T0.ref.dead) harm(h, T0.ref, A.dmg * k, from, sp); } });
		} else if (A.act === 'strike') {
			draw(use, from, at, who);
			queued.push({ at: time + (sp.delay || 0.35), fn: () => { for (const o of near(at.x, at.z, A.r)) harm(h, o, A.dmg * k, at, sp); } });
		} else if (A.act === 'chain') {
			let a = from, cur = T0.ref;
			const hit = new Set();
			for (let i = 0; i < (A.n || 3) && cur; i++) {
				hit.add(cur);
				const b = { x: cur.pos.x, y: cur.pos.y + 1.2, z: cur.pos.z };
				draw(use, a, b, who); harm(h, cur, A.dmg * k * (1 - i * 0.2), a, sp);
				a = b;
				cur = near(b.x, b.z, 9).filter((o) => !hit.has(o)).sort((p, q) => Math.hypot(p.pos.x - b.x, p.pos.z - b.z) - Math.hypot(q.pos.x - b.x, q.pos.z - b.z))[0];
			}
		} else if (A.act === 'nova') {
			draw(use, from, from, who);
			for (const o of near(h.pos.x, h.pos.z, A.r)) harm(h, o, A.dmg * k, from, sp);
		}
	}
	const score = (id, crowd) => { const A = SPELL_ACTS[id]; return A.dmg * (A.act === 'strike' || A.act === 'chain' ? 1 + Math.min(2, crowd - 1) * 0.6 : 1); };

	// ---------- learning, and resting ----------
	function learned(m, r) {
		if (!r.levels) return;
		const names = r.learned.map((id) => SPELL[id]?.name).filter(Boolean);
		hint(`${m.first} reached level ${m.level}${names.length ? ` and learned ${names.join(' and ')}` : ''}.`, 3600);
		const h = byId(m.id);
		if (h) restat(h);
	}
	// a foe fell: the one of yours who felled it learns the most, the rest of you a share
	function kill(victim, blow) {
		const g = guild();
		if (!g?.npcs.length) return;
		const xp = xpForKill({ max: victim.H?.max || 100, kind: victim.kind }), by = blow?.by?.ref?.ally || null, e = combat.eye();
		let any = false;
		for (const h of present()) {
			const m = h.ally, d = Math.hypot(h.pos.x - e.x, h.pos.z - e.z);
			if (m === by) { m.kills = (m.kills || 0) + 1; learned(m, giveXp(m, xp)); any = true; }
			else if (blow?.by?.id === 'me' || by) { if (d < 80) { learned(m, giveXp(m, xp * (by ? SHARE * 0.6 : SHARE))); any = true; } }
		}
		if (any) save();
	}
	function down(h) {
		const m = h.ally;
		if (!m) return;
		m.downUntil = Date.now() + REST_MS;
		save();
		hint(`${m.first} is down. They are carried off to rest, and can come out again in ${Math.round(REST_MS / 60000)} minutes.`, 4200);
	}

	combat.hooks.guild = { cast, kill, down };
	return {
		update, call, max,
		// a new member, out at once where they stood
		joinAt: (m, at) => call(m, at),
		dismiss: (id) => { const h = byId(id); if (h) squads.release(h); },
		// all of them home for now (and back out when called)
		hold: (on) => { off = !!on; },
		held: () => off,
		present: () => present().map((h) => ({ id: h.ally.id, hp: Math.round(h.H.hp), max: Math.round(h.H.max), fighting: !!h.target, d: Math.round(Math.hypot(h.pos.x - combat.eye().x, h.pos.z - combat.eye().z)) })),
		dispose() { for (const h of present()) squads.release(h); if (combat.hooks.guild?.cast === cast) combat.hooks.guild = null; },
	};
}
