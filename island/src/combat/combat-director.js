// What starts a fight, moved out of combat/combat.js's createCombat: the director that sends
// trouble your way, bosses, creatures, and hold-ups when you aim at someone.
// What it uses from combat.js's createCombat comes from cb: what is set up before it can run, once
// at the top of each call; the rest (aimAt, aimT, bountyT, creatureSeen, creatureT, directorT,
// lastAttackT, playT, policeT, wobble, worldKey) as cb.name at each use, and it sets aimAt, aimT, bountyT,
// creatureSeen, creatureT, directorT, playT, policeT (lastAttackT and wobble through cb.attacked()). A name not yet there needs a
// getter in createCombat's cb.

import { responseFor } from './heat.js';
import { createBoss } from './bosses.js';
import { BOSSES } from './boss-defs.js';
import { ATTACK, FACTIONS, attackGap } from './factions.js';
import { speciesFor, pickSpecies, SPECIES } from '../creatures/catalog.js';

export function combatSpawnBoss(cb, kind, at = null, id = null) {
	const { _v, bosses, call, camera, ctx, eye, fogMotherSpot, ground, group, hooks, hud, net,
		props } = cb;
	if (!BOSSES[kind]) return null;
	const e = eye();
	const c = at || (kind === 'fogmother' ? fogMotherSpot() : null) || (() => { camera.getWorldDirection(_v); _v.y = 0; _v.normalize(); const d = kind === 'walker' ? 70 : kind === 'leviathan' ? 14 : 30; const x = e.x + _v.x * d, z = e.z + _v.z * d; return { x, y: ground(x, z, e.y), z }; })();
	const bid = id || 'boss:' + kind;
	if (bosses.has(bid)) return bosses.get(bid);
	const B0 = createBoss(ctx, kind, c, { id: bid });
	group.add(B0.group);
	bosses.set(bid, B0);
	if (kind === 'walker' || kind === 'gunship') props.camp(e.x, e.z, 'arena', (x, z) => ground(x, z, e.y));
	hud.phase(B0.def.phases[0].name);
	call(`${B0.def.name} — ${B0.def.where}`, 'boss');
	hooks.event?.({ kind: 'boss', x: c.x, z: c.z, severity: 3, name: B0.def.name });
	net.boss(B0, true, c);
	return B0;
}

export function combatDirector(cb, dt) {
	const { call, camp, campsNear, contracts, drive, eye, ground, hatesMe, hooks, isEarth, isPhone, me,
		morality, P, populated, props, rnd, settings, shared, spotAhead, spotHidden, squads, W, wanted,
		zone } = cb;
	cb.directorT -= dt; cb.bountyT -= dt; cb.policeT -= dt; cb.playT += dt;
	const p = P();
	if (!p || p.flying || p.swimming || drive?.active?.() || me.ko) return;
	// the patrol answering a wanted level
	if (isEarth() && wanted.stars > 0 && cb.policeT <= 0) {
		cb.policeT = 8;
		const R = responseFor(wanted.stars), have = squads.alive().filter((h) => h.fid === 'patrol' || h.fid === 'police').length;
		// the police answer in their cruisers (military/police.js); on foot if nobody took the call
		if (have < R.officers && !hooks.police?.(wanted.stars, R, have)) { const s = spotHidden(50, 90); if (s) squads.squad('police', s.x, s.z, Math.min(2, R.officers - have), { alert: true, armour: R.armour }); call('Dispatch: units responding.', 'Harbour Police'); }
	}
	// contract hunters, for a bounty
	// (only where there are people or businesses about: not out in the empty country)
	if (cb.bountyT <= 0 && isEarth() && !populated(eye())) cb.bountyT = 30;
	// (a raid, and a rare one: factions.js ATTACK)
	if (cb.bountyT <= 0 && cb.playT - cb.lastAttackT < ATTACK.raid + cb.wobble) cb.bountyT = 60;
	if (cb.bountyT <= 0) { cb.bountyT = rnd(240, 400); const b = morality.reactions().bounty; if (b > 0 && settings.ambient) { const s = spotHidden(60, 100); if (s) { cb.attacked(); squads.squad('halcyon', s.x, s.z, 1 + b, { alert: true }); call('Halcyon Contractors: Target located. Collecting the bounty.', ''); } } }
	if (!settings.ambient || cb.directorT > 0 || contracts.info().mission) return;
	cb.directorT = rnd(70, 130);
	if (squads.info().squads.length >= (isPhone ? 2 : 3)) return;
	const z = zone(), s = spotAhead(z === 'deep' ? 18 : 70, z === 'deep' ? 30 : 110);
	if (!s) return;
	// the law's own trouble on Earth's streets (gangs by their territory, militia only out of town)
	if (hooks.ambient?.(z, s)) return;
	const two = (a, b, n = 3) => { squads.squad(a, s.x - 9, s.z, n, {}); squads.squad(b, s.x + 9, s.z + 4, n, {}).then((sq) => { for (const h of sq.members) { h.target = null; } }); call(`Gunfire ahead: ${FACTIONS[a].name} and ${FACTIONS[b].name}.`, ''); if (FACTIONS[a].kind === 'gang') hooks.event?.({ kind: 'gang', x: s.x, z: s.z, severity: 1 }); };
	// a side that has it in for you comes for you only when its turn is due (factions.js
	// ATTACK); otherwise this round brings nobody. The Deep keeps its crawlers as they are.
	const due = (...fids) => {
		const foes = fids.filter(hatesMe);
		if (!foes.length || z === 'deep') return true;
		if (foes.some((f) => cb.playT - cb.lastAttackT < attackGap(FACTIONS[f], z, cb.wobble))) return false;
		cb.attacked();
		return true;
	};
	// a militia only at its own compound (never roaming): the nearest one within reach, if any
	const compound = () => { const c = campsNear(eye().x, eye().z).filter((q) => Math.hypot(q.x - eye().x, q.z - eye().z) < 260)[0]; if (!c || !due('ridgeback')) return false; props.clearTag('camp'); props.camp(c.x, c.z, 'camp', (x, z) => ground(x, z, eye().y + 2)); squads.squad('ridgeback', c.x, c.z, isPhone ? 3 : 4, { post: { kind: 'compound', x: c.x, z: c.z, r: c.r, loop: [[c.x - 14, c.z - 14], [c.x + 14, c.z - 14], [c.x + 14, c.z + 14], [c.x - 14, c.z + 14]] } }); return true; };
	const one = (fid, n) => { if (due(fid)) squads.squad(fid, s.x, s.z, n, {}); };
	const roll = Math.random();
	if (z === 'deep') squads.squad('gloom', s.x, s.z, 3, {});
	else if (z === 'earth-urban') { if (roll < 0.5) { if (due('copperline', 'glasshouse')) two('copperline', 'glasshouse'); } else one(roll < 0.75 ? 'copperline' : 'glasshouse', 3); }
	else if (z === 'earth-coast') { if (roll < 0.5 && populated(s)) { if (due('saltjack', 'patrol')) two('saltjack', 'patrol', 2); } else one('saltjack', 3); }
	else if (z === 'earth-rural') { if (roll > 0.5 || !compound()) one('rangers', 3); }
	else if (z === 'village') {
		// a raid: raiders come for the houses, the Hearthguard turn out
		const vf = W().village.footprints.find((f) => !f.fence);
		const raiders = shared.planet?.type === 'ARID' && roll < 0.5 ? 'dunecutters' : 'ashfang';
		if (!due(raiders)) return;
		squads.squad(raiders, s.x, s.z, isPhone ? 3 : 4, { raid: true, dest: { x: vf.x, z: vf.z } });
		squads.squad('hearthguard', vf.x, vf.z, isPhone ? 2 : 3, {});
		call(`${FACTIONS[raiders].name} are raiding the village!`, '');
	} else if (z === 'arid') { if (roll < 0.5) { if (due('ashfang', 'dunecutters')) two('ashfang', 'dunecutters'); } else if (roll < 0.8) { if (due('ashfang')) camp('ashfang', s); } else one('rogue', 2); }
	else if (roll < 0.45) { if (due('ashfang')) camp('ashfang', s); }
	else if (roll < 0.7 || !compound()) one('rogue', 2);
}

export function combatCreatures(cb, dt) {
	const { contracts, drive, hint, isPhone, me, P, rnd, settings, spotForest, spotHidden, squads, W,
		zone } = cb;
	cb.creatureT -= dt;
	if (cb.creatureT > 0) return;
	cb.creatureT = rnd(50, 100);
	const p = P();
	if (!p || p.flying || p.swimming || drive?.active?.() || me.ko || !settings.ambient || contracts.info().mission || W()?.orbit?.active?.()) return;
	const z = zone(), night = W()?.sky?.uniforms?.uNight?.value ?? 0;
	const kinds = speciesFor(z, night);
	if (!kinds.length) return;
	if (squads.alive().filter((h) => h.cr).length >= (isPhone ? 2 : 4)) return;
	const id = pickSpecies(kinds), S = SPECIES[id];
	const s = S.lurk ? spotForest(40, 110) || spotHidden(45, 80) : spotHidden(z === 'deep' ? 25 : 45, z === 'deep' ? 40 : 80);
	if (!s) return;
	const [a, b] = S.where.pack, n = Math.min(isPhone ? 2 : 4, a + Math.floor(Math.random() * (b - a + 1)));
	// (on the Moon, in its moon look where it has one: the hounds there are white)
	squads.squad(S.faction, s.x, s.z, n, { species: id, spread: 2.5, look: z === 'moon' ? S.moon || null : null });
	if (!cb.creatureSeen && S.where.night) { cb.creatureSeen = true; hint('Something is moving out there in the dark.', 3200, 1); }
}

export function combatHoldUps(cb, dt) {
	const { _v, active, arms, camera, civilians, crime, held, hint, layer, me, ME, morality, notice,
		people, placeName, rules, view, witnesses } = cb;
	if (!active() || me.ko || !view.state()?.aiming || !held()) { cb.aimT = 0; cb.aimAt = null; return; }
	camera.getWorldDirection(_v);
	const hit = layer.cast(camera.position, _v, 10, ME, rules);
	const T = hit && !hit.ward && hit.T.kind === 'person' ? hit.T : null;
	if (T !== cb.aimAt) { cb.aimAt = T; cb.aimT = 0; }
	if (!T) return;
	cb.aimT += dt;
	if (cb.aimT < 1) return;
	cb.aimT = -999;
	const p = (people?.()?.pool || []).find((q) => q.P === T.P);
	const r = p && civilians.holdUp(p);
	if (!r) return;
	if (r.first && r.credits) {
		notice('robbery',T.bound,'held someone up at gunpoint');
		crime('robbery', T.bound, witnesses(T.bound) > 1);
		arms?.apply?.({ id: `rob-${Date.now().toString(36)}`, kind: 'trade', peer: 'held-up', give: { credits: 0, items: [] }, get: { credits: r.credits, items: [] } });
		hint(`They raise their hands and hand over ${r.credits} credits.`, 2500, 1);
		morality.record({ kind: 'robbery', target: T.name, place: placeName(), world: cb.worldKey, ctx: { rich: r.rich, poor: !r.rich, witnessed: witnesses(T.bound) > 1, ...T.moral?.() } });
	}
}
