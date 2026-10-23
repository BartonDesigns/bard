// Law and order on Earth: the escalation ladder (law/ladder.js) run against the fight
// (combat/), the police (military/police.js) and the bases (military/dispatch.js), the gangs'
// corners (law/gangs.js) and the street tactics (law/tactics.js).
//
//   crimes      every offence comes here first (combat.hooks.crime). An officer who sees it
//               counts it at once; passers-by who see it phone it in after a while; one nobody
//               saw is nobody's business; gunfire only heard is reported as shots fired at a
//               place (a car goes to look, nobody is after you). Trouble among others (a
//               brawl, a gang's gunfire) is called in the same way (combat.hooks.event).
//   response    every two seconds the level's plan: patrol cars to where you were last seen,
//               a roadblock across the road ahead of you at three, the tactical van at four,
//               the military from the nearest base only at five. Officers hold their fire and
//               close in to arrest unless you are armed (a warning first) or have fired.
//   arrest      unarmed and standing still near an officer, or hands up (H, or the Surrender
//               button on a touch screen), and they cuff you; downed with officers near is an
//               arrest too. Booked at the nearest police station and fined: the fine is taken
//               from your credits (arms.spendCredits), owed if you cannot pay, and paid into
//               the station's account through the money adapter (HOOKS.npcMoney) when there is
//               one. Running from officers who have you is an offence of its own.
//   gangs       corner crews on the streets a gang holds (by region: its trouble and its
//               morality tally), more in the evening and where the region has gone wrong, a
//               recruit now and then; they drift off when a patrol car pulls up, square up to a
//               rival crew, and a war starts mostly where two gangs' ground meets. Militia only
//               out of town (combat.hooks.campOk).
//   tactics     a squad that is losing and outnumbered falls back; the fallen wait for an
//               ambulance from the nearest hospital (services.injury), which takes them away.
//   the force   whose police they are: the force of the ground you stand on (law/force.js: San
//               Francisco Police, the county sheriff, the Garda), looked at every two seconds. A
//               chase keeps the force that started it: the change waits until none of its
//               cruisers, officers or its helicopter is about and nobody is after you (or you
//               have come far, as by air), then the radio, the name tags and the cruisers'
//               doors all take the new one.
//
// Phones: one corner crew, fewer cars and a smaller tactical team. Nothing here allocates per
// frame but for the crimes and calls themselves.

import { createLadder, witness, dueReports, pending, responsePlan, routeTrouble, complying, arrestable, fineFor, LEVELS } from './ladder.js';
import { territoryAt, cornerSize, recruits, junctions, pickCorners, gangStance, warChance, militiaAllowed, GANGS } from './gangs.js';
import { roadblockSpot, inCone, squadMorale } from './tactics.js';
import { FACTIONS } from '../combat/factions.js';
import { localForce, setLocalForce, forceAtXZ } from './force.js';

// (the first is called out in the force's own word: 'Police!', 'Sheriff's Office!', 'Garda!')
const ARREST = ['{shout}! Stop right there!', 'Get on the ground! Hands where I can see them!', 'Do not move! Stay where you are!', 'Hands behind your head!'];
const DROP = ['Drop the weapon! Drop it now!', 'Put it down! Put the gun down!', 'Weapon on the ground, now!'];
const STAY = ['Stay down! Keep your hands up!', 'Don\'t move. We\'re coming to you.', 'Keep those hands where I can see them.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export function createLaw({ world, combat, military, people = () => null, services = () => null, money = () => null, arms = null, hint = () => {}, isPhone = false, region = () => null, hours = () => 12, mount = null, touch = false }) {
	const W = () => world();
	const P = () => W()?.player?.state || null;
	const police = military?.police || null, dispatch = military?.dispatch || null;
	const L = createLadder();
	const S = { crimes: 0, calls: 0, arrests: 0, fines: 0, owed: 0, blocks: 0, swat: 0, military: 0, medics: 0, corners: 0, wars: 0, dispersed: 0 };
	let t = 0, planT = 0, cornerT = 0, moraleT = 0, milT = -999, blockT = -999, lowT = 0, sayT = 0, shotsT = -99, firedT = -99, regionT = 0, warT = 0;
	let custody = null, here = null, plan = responsePlan(0), planAt = -1, lastLevel = 0;
	const me = { stillT: 0, handsUp: false, grabT: 0, fleeT: 0, evaded: false, vx: 0, vz: 0, px: null, pz: null, speed: 0 };
	const corners = [], leavers = [], medics = [];
	const eye = () => P()?.pos || null;
	const earth = () => !!W()?.bayArea && !W()?.deep?.active?.();
	const lawful = (h) => { const F = FACTIONS[h.fid]; return !!F?.lawful && F.kind !== 'military'; };
	const force = () => localForce().name;
	function say(line, who = force(), gap = 4) { if (t < sayT) return; sayT = t + gap; combat.call?.(line.replace('{shout}', localForce().shout), who); }
	// the eye and the way it looks: what you can see is where nothing may appear or vanish
	const viewDir = { x: 0, z: -1 };
	function view() { const p = P(); if (!p) return null; viewDir.x = -Math.sin(p.yaw); viewDir.z = -Math.cos(p.yaw); return { eye: p.pos, dir: viewDir }; }
	function seen(x, z, r = 200) { const v = view(); if (!v) return false; const d = Math.hypot(x - v.eye.x, z - v.eye.z); return d < 25 || (d < r && inCone(v.eye, v.dir, x, z, 1.0)); }

	// ---------- who saw it ----------
	const _a = { x: 0, y: 0, z: 0 }, _b = { x: 0, y: 0, z: 0 };
	function clear(ax, ay, az, bx, by, bz) { _a.x = ax; _a.y = ay; _a.z = az; _b.x = bx; _b.y = by; _b.z = bz; return !combat.blocked(_a, _b); }
	// passers-by with a clear sight of the place (children never count as witnesses here)
	function witnessCount(at, r = 40) {
		let n = 0, checks = 0;
		for (const p of people()?.pool || []) {
			if (!p.active || !p.P?.root?.visible || p.P.ragdoll || p.P.dna?.child || p.P.dna?.minor) continue;
			const q = p.M?.S?.pos;
			if (!q || Math.abs(q.x - at.x) > r || Math.abs(q.z - at.z) > r || Math.hypot(q.x - at.x, q.z - at.z) > r) continue;
			if (++checks > 8) break;
			if (clear(q.x, q.y + 1.5, q.z, at.x, (at.y ?? q.y) + 1, at.z)) n++;
			if (n >= 4) break;
		}
		return n;
	}
	// officers (not soldiers) with a clear sight of the place
	function officersSee(at, r = 70) {
		for (const h of combat.squads.list) {
			if (h.dead || !lawful(h) || h.recall) continue;
			if (Math.hypot(h.pos.x - at.x, h.pos.z - at.z) > r) continue;
			if (clear(h.pos.x, h.pos.y + 1.5, h.pos.z, at.x, (at.y ?? h.pos.y) + 1, at.z)) return true;
		}
		return false;
	}
	const near = { h: null, d: Infinity };
	function nearestOfficer() {
		const e = eye();
		let best = null, bd = Infinity;
		near.h = null; near.d = Infinity;
		if (!e) return near;
		for (const h of combat.squads.list) {
			if (h.dead || !lawful(h) || h.recall || h.surrendered) continue;
			const d = Math.hypot(h.pos.x - e.x, h.pos.z - e.z);
			if (d < bd) { bd = d; best = h; }
		}
		near.h = best; near.d = bd;
		return near;
	}

	// ---------- crimes: yours, and others' trouble ----------
	function crime(kind, at, flag = true) {
		if (custody || !earth()) return combat.wantedLevel();
		if (kind === 'shots') { firedT = t; if (t - shotsT < 2) return combat.wantedLevel(); shotsT = t; }
		S.crimes++;
		const byOfficer = officersSee(at), n = byOfficer ? 0 : witnessCount(at, kind === 'shots' ? 50 : 40);
		// (gunfire carries to someone only where people live or work: not out in the empty country)
		const r = witness(L, { kind, at, t, police: byOfficer, witnesses: n, heard: kind === 'shots' && flag !== null && combat.populated?.(at) !== false });
		if (r === 'now') {
			combat.report(kind === 'shots' && combat.wantedLevel() < 2 ? 'gunfire' : kind, at);
			say(kind === 'shots' ? 'Shots fired! Shots fired!' : kind === 'hitPolice' || kind === 'downPolice' ? 'Officer down! All units!' : pick(ARREST), force(), 2);
		}
		return combat.wantedLevel();
	}
	function incident(e) {
		if (!e || !earth()) return null;
		if (e.kind === 'boss' || e.kind === 'invasion' || e.kind === 'riot' || e.kind === 'wanted') { if (routeTrouble(e) === 'military') S.military++; return dispatch?.event?.(e) || null; }
		// a fight or gunfire among others: someone has to call it in
		const n = witnessCount(e, 60);
		// (you fired on first, a gang's gunfire: heard where people live or work, not out in the empty country)
		const r = witness(L, { kind: e.kind === 'brawl' ? 'brawl' : e.kind === 'gang' ? 'gang' : e.kind, at: e, t, witnesses: n, heard: (e.kind === 'gang' || e.kind === 'defence') && combat.populated?.(e) !== false, severity: e.severity || 1, ev: e });
		return r ? 'reported' : null;
	}
	// the calls coming through
	function calls() {
		const due = dueReports(L, t);
		for (let i = 0; i < due.length; i++) {
			const q = due[i];
			S.calls++;
			if (q.ev) {
				const ev = { ...q.ev, severity: q.severity };
				const route = routeTrouble(ev);
				if (route === 'military') { S.military++; dispatch?.event?.(ev); }
				else { if (route === 'swat') S.swat++; police?.event?.(ev, { swat: route === 'swat' }); }
				continue;
			}
			if (q.seen) {
				// a shooting with a description; a sustained one, twice over
				const kind = q.call === 'shots' ? 'gunfire' : q.kind;
				combat.report(kind, q.at);
				if (q.call === 'shots' && q.weight >= 3) combat.report(kind, q.at);
				say(`Dispatch: ${({ assault: 'an assault', robbery: 'an armed robbery', arson: 'a fire set', damage: 'damage to property', shots: 'shots fired' })[q.call] || 'a disturbance'} reported, suspect described. Units respond.`, force(), 1);
			} else if (q.call === 'shots') {
				police?.event?.({ kind: 'shots', x: q.at.x, z: q.at.z });
			}
		}
	}

	// ---------- the response ----------
	function planNow() {
		if (t - planAt < 0.5 && planAt >= 0) return plan;
		planAt = t;
		plan = responsePlan(combat.wantedLevel(), { phone: isPhone, armed: combat.armed(), fired: t - firedT < 30 });
		return plan;
	}
	// officers hold their fire while the plan has them holstered, and give a warning first when
	// it is only that you are armed
	function holdFire(h) {
		if (!lawful(h)) return false;
		const pl = planNow();
		if (!pl.level) return true;
		if (!pl.lethal) { if (Math.hypot(h.pos.x - (eye()?.x ?? 0), h.pos.z - (eye()?.z ?? 0)) < 35) say(pick(ARREST)); return true; }
		if (t - firedT > 30 && pl.level < 4) {
			if (!h.warnAt) { h.warnAt = t; say(pick(DROP), force(), 2); }
			return t - h.warnAt < 2.5;
		}
		return false;
	}
	function respond() {
		const level = combat.wantedLevel(), e = eye();
		if (!police || !e) return;
		if (level > 0) {
			const pl = planNow(), at = combat.lastSeen() || e;
			police.need(pl, at);
			// a roadblock across the road ahead of where you are heading
			if (pl.blocks && t - blockT > 30 && police.cruisers.filter((c) => c.why === 'block' && c.state === 'blocking').length < pl.blocks * 2) {
				const dir = me.speed > 2 ? { x: me.vx, z: me.vz } : viewDir;
				const roads = W().real?.loaded?.() ? W().real.near('roads', e.x, e.z, 300) : [];
				const spot = roadblockSpot(roads, e, dir, { min: me.speed > 8 ? 220 : 140, max: me.speed > 8 ? 380 : 260 });
				if (spot && police.block(spot, e, pl.lethal)) { blockT = t; S.blocks++; }
			}
			// the military only at the very top
			if (pl.military && t - milT > 240) { milT = t; S.military++; dispatch?.event?.({ kind: 'wanted', x: at.x, z: at.z, severity: 3 }); say('Dispatch: requesting military support.', force(), 1); }
			// ...and the police helicopter up over you
			if (pl.military && dispatch?.policeAir?.(at)) S.air = (S.air || 0) + 1;
		}
		if (level !== lastLevel) {
			if (level > lastLevel && level >= 2) hint(`Wanted: ${LEVELS[level]}${level >= 3 ? ' (roadblocks ahead)' : ''}${level >= 4 ? ', the tactical team is out' : ''}.`, 2500, 1);
			if (level === 0 && lastLevel > 0) hint('The police have lost you. Units are returning to the station.', 3000, 1);
			lastLevel = level;
		}
	}

	// ---------- giving up, arrests, booking ----------
	function arrest(downed = false, resisted = false) {
		if (custody) return;
		const ws = combat.wantedState();
		custody = { t: 0, fine: fineFor({ points: ws.points, peak: ws.peak, resisted: resisted || me.evaded }), downed };
		S.arrests++;
		me.handsUp = false;
		if (!downed) {
			const p = P();
			if (p) p.locked = true;
			say('You are under arrest. Anything you say can be used against you.', force(), 0);
			hint('Arrested. You are cuffed and put in the back of a cruiser.', 4000, 2);
		} else hint('You are down. Officers move in and cuff you.', 4000, 2);
	}
	function book() {
		const C = custody;
		if (!C) return null;
		custody = null;
		const e = eye() || { x: 0, z: 0 }, st = services()?.stationAt?.(e.x, e.z, 8000);
		const at = st ? { x: st.x, y: st.y + 1.68, z: st.z, yaw: st.yaw } : null;
		let paid = false;
		try { paid = !!arms?.spendCredits?.(C.fine, { kind: 'fine' }); } catch { paid = false; }
		if (!paid && !arms?.spendCredits) { try { paid = money()?.spend?.('player', C.fine, 'fine', 'police') != null; } catch { paid = false; } }
		// (into the station's account at the bank: economy/bank.js through the money adapter)
		const acct = 'biz:police-' + String(st?.name || 'harbour').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
		try { if (paid) money()?.earn?.(acct, C.fine, 'fine', 'player'); } catch { /* no ledger */ }
		S.fines += paid ? C.fine : 0; S.owed += paid ? 0 : C.fine;
		combat.clearWanted();
		L.reports.length = 0;
		police?.standDown();
		me.evaded = false; me.fleeT = 0;
		hint(`Booked at ${st?.name || 'the station'} and released. Fine: ${C.fine} credits${paid ? '' : ' (owed)'}.`, 6000, 2);
		if (!C.downed) {
			const p = P();
			if (p) { if (at) { p.pos.set(at.x, at.y, at.z); p.vel?.set?.(0, 0, 0); if (Number.isFinite(at.yaw)) p.yaw = at.yaw; } p.locked = false; }
		}
		return at;
	}
	function compliance(dt) {
		const level = combat.wantedLevel();
		if (!level || custody) { me.stillT = 0; me.grabT = 0; me.fleeT = 0; if (!level) me.handsUp = false; return; }
		const off = nearestOfficer(), armed = combat.armed();
		me.stillT = me.speed < 0.5 ? me.stillT + dt : 0;
		if (me.handsUp && me.speed > 1.2) me.handsUp = false;
		const gives = complying({ armed, speed: me.speed, stillT: me.stillT, officerD: off.d, handsUp: me.handsUp });
		if (gives && off.d < 30) say(pick(STAY), force(), 5);
		if (gives && off.d < 2.8) { arrest(false); return; }
		// an officer at arm's length while they hold fire and you are unarmed: taken down and cuffed
		if (!armed && off.h && off.d < 1.9 && holdFire(off.h)) { me.grabT += dt; if (me.grabT > 1.4) { arrest(false, me.speed > 1); return; } } else me.grabT = 0;
		// running from officers who have you in sight: evading, an offence of its own (once)
		if (!me.evaded && off.d < 25 && me.speed > 3.2 && off.h?.los) { me.fleeT += dt; if (me.fleeT > 5) { me.evaded = true; combat.report('evade', eye()); say('Suspect is fleeing on foot!', force(), 1); } } else me.fleeT = Math.max(0, me.fleeT - dt * 0.5);
	}
	// surrender: H on a keyboard, a button on a touch screen, while the police are after you
	function surrender() {
		if (!combat.wantedLevel() || custody) return false;
		if (combat.armed()) { hint('Put your weapon away first.', 2000, 1); return false; }
		me.handsUp = true;
		hint('Hands up. Stay still and let them come to you.', 2500, 1);
		return true;
	}
	addEventListener('keydown', (e) => {
		if (e.repeat || e.metaKey || e.ctrlKey || (e.key !== 'h' && e.key !== 'H') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) return;
		if (combat.wantedLevel() > 0 && nearestOfficer().d < 60) surrender();
	});
	let btn = null;
	if (touch && mount) {
		btn = document.createElement('button');
		btn.type = 'button'; btn.textContent = '✋ Surrender'; btn.title = 'Surrender (H)'; btn.setAttribute('aria-label', 'Surrender');
		// (ui/touch-skin.js gives it its place by the thumb and its icon)
		btn.style.cssText = 'position:absolute;right:calc(16px + env(safe-area-inset-right));bottom:calc(200px + env(safe-area-inset-bottom));z-index:30;display:none;min-height:44px;padding:0 14px;border-radius:22px;border:1px solid #ffffff55;background:#1c2540cc;color:#fff;font:600 14px var(--bard-display,system-ui,sans-serif)';
		btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); surrender(); });
		mount.appendChild(btn);
	}

	// ---------- the gangs ----------
	function regionNow() {
		if (here && t - regionT < 3) return here;
		regionT = t;
		let R = null;
		try { R = region(); } catch { R = null; }
		here = R || { id: 'here', tally: null, situation: null };
		return here;
	}
	function territory(x, z) {
		const R = regionNow(), w = W();
		let u = 1;
		try { u = w.bayArea?.urbanAt?.(x, z)?.u ?? 1; } catch { u = 1; }
		// (the street is a town street when there are buildings about, whatever the coarse map says)
		if (u < 0.3 && w.real?.loaded?.() && w.real.near('boxes', x, z, 60).length > 6) u = 0.5;
		return territoryAt(R.id, x, z, { trouble: R.situation?.trouble ?? 0.3, tally: R.tally, urban: u });
	}
	function stepCorners() {
		const e = eye(), p = P();
		// let go: crews far behind you, or gone
		for (let i = corners.length - 1; i >= 0; i--) {
			const c = corners[i];
			const alive = (c.members || []).filter((h) => !h.dead && !h.gone);
			const d = Math.hypot(c.x - e.x, c.z - e.z);
			if ((c.sq && !alive.length) || (d > 240 && !seen(c.x, c.z, 400))) { for (const h of alive) combat.squads.release(h); corners.splice(i, 1); }
		}
		if (!earth() || p.flying || combat.zone() !== 'earth-urban') return;
		const R = regionNow(), want = isPhone ? 1 : 2;
		// each crew: grows, holds, drifts off when a patrol pulls up
		for (const c of corners) {
			if (!c.sq || c.state !== 'hold') continue;
			const alive = c.members.filter((h) => !h.dead && !h.gone);
			const T = territory(c.x, c.z);
			const max = cornerSize(T, { phone: isPhone, hour: hours() }) + 1;
			const n = recruits(c.size, Math.min(isPhone ? 3 : 5, max), T?.low || 0, 3);
			if (n > c.size && !seen(c.x, c.z, 160)) { c.size = n; combat.squads.spawn(c.gang, c.x + 2, c.z + 1, c.sq, { post: c.post }).then((h) => { if (h) { h.corner = true; S.recruits = (S.recruits || 0) + 1; } }); }
			let policeNear = 0, rivals = 0;
			for (const h of combat.squads.alive()) {
				const d = Math.hypot(h.pos.x - c.x, h.pos.z - c.z);
				if (d > 50) continue;
				if (lawful(h)) policeNear++;
				else if (FACTIONS[h.fid]?.kind === 'gang' && h.fid !== c.gang) rivals++;
			}
			for (const k of police?.cruisers || []) if ((k.state === 'arrived' || k.state === 'responding') && Math.hypot(k.pos.x - c.x, k.pos.z - c.z) < 60) policeNear++;
			const provoked = alive.some((h) => h.provoked), alert = alive.some((h) => h.alert && h.target);
			const stance = gangStance({ provoked, alert, rivalsNear: rivals, policeNear, outnumbered: policeNear > alive.length + 1 });
			if (stance === 'disperse' || stance === 'scatter') {
				c.state = 'leaving'; S.dispersed++;
				for (const h of alive) {
					if (stance === 'scatter' && h.alert) continue;
					const a = Math.atan2(h.pos.x - (e.x + c.x) / 2, h.pos.z - (e.z + c.z) / 2) + (Math.random() - 0.5);
					h.recall = true; h.alert = 0; h.target = null; h.goal = null;
					h.post = { kind: 'leave', x: c.x + Math.sin(a) * 90, z: c.z + Math.cos(a) * 90, r: 10 };
					leavers.push({ h, at: t, from: { x: c.x, z: c.z } });
				}
			} else if (stance === 'fight' && !c.called) {
				c.called = true;
				incident({ kind: 'gang', x: c.x, z: c.z, severity: 1 });
			}
		}
		const T = territory(e.x, e.z);
		if (corners.filter((c) => c.state === 'hold').length >= want || !T?.gang || t - cornerT < 15) return;
		const roads = W().real?.loaded?.() ? W().real.near('roads', e.x, e.z, 200) : [];
		for (const j of pickCorners(junctions(roads), R.id, e, { min: 70, max: 170, n: 5 })) {
			if (corners.some((c) => Math.hypot(c.x - j.x, c.z - j.z) < 60) || seen(j.x, j.z, 190)) continue;
			const Tj = territory(j.x, j.z);
			if (!Tj?.gang) continue;
			cornerT = t;
			placeCorner(j, Tj.gang, cornerSize(Tj, { phone: isPhone, hour: hours() }));
			break;
		}
	}
	function placeCorner(j, gang, size) {
		const e = eye();
		// standing about the corner, facing the street
		const post = { kind: 'corner', x: j.x, z: j.z, yaw: Math.atan2(e.x - j.x, e.z - j.z) + (Math.random() - 0.5), r: 25 };
		const c = { id: 'k' + (++S.corners), gang, x: j.x, z: j.z, size, post, state: 'hold', members: [], sq: null, called: false, at: t };
		corners.push(c);
		combat.squads.squad(gang, j.x, j.z, size, { post, tag: 'corner:' + c.id, spread: 2.5 }).then((sq) => { c.sq = sq; c.members = sq.members; for (const h of sq.members) h.corner = true; });
		return c;
	}
	// (for the console and the pictures: a crew on the nearest corner now, whoever holds it)
	function forceCorner() {
		const e = eye();
		if (!e || !W()?.real?.loaded?.()) return null;
		const J = junctions(W().real.near('roads', e.x, e.z, 150)).map((j) => ({ ...j, d: Math.hypot(j.x - e.x, j.z - e.z) })).filter((j) => j.d > 20 && j.d < 140).sort((a, b) => a.d - b.d);
		if (!J.length) return null;
		const T = territory(J[0].x, J[0].z);
		return placeCorner(J[0], T?.gang || GANGS[0], isPhone ? 3 : 4).id;
	}
	// a crew walking off: let go once out of your sight or far enough
	function stepLeavers() {
		for (let i = leavers.length - 1; i >= 0; i--) {
			const q = leavers[i], h = q.h;
			if (h.dead || h.gone) { leavers.splice(i, 1); continue; }
			const far = Math.hypot(h.pos.x - q.from.x, h.pos.z - q.from.z) > 70;
			if ((far || t - q.at > 12) && !seen(h.pos.x, h.pos.z, 180)) { combat.squads.release(h); leavers.splice(i, 1); }
			else if (t - q.at > 60) { combat.squads.release(h); leavers.splice(i, 1); }
		}
	}
	// the world's own trouble in town (combat's director asks): gangs by their ground
	function ambient(zone) {
		if (!earth()) return false;
		if (zone !== 'earth-urban') return false;
		const e = eye(), T = territory(e.x, e.z);
		if (!T?.gang || t - warT < 240 || Math.random() > warChance(T)) return true;
		const s = combat.spotHidden?.(90, 150);
		if (!s) return true;
		warT = t; S.wars++;
		const other = GANGS.find((g) => g !== T.gang);
		// (each crew heads for the other's corner: out of sight when made, in sight soon after)
		combat.squads.squad(T.gang, s.x - 9, s.z, isPhone ? 2 : 3, { dest: { x: s.x + 9, z: s.z + 4 } });
		combat.squads.squad(other, s.x + 9, s.z + 4, isPhone ? 2 : 3, { dest: { x: s.x - 9, z: s.z } });
		incident({ kind: 'gang', x: s.x, z: s.z, severity: 1 });
		return true;
	}
	function campOk(c) {
		const w = W(), bay = w?.bayArea;
		let u = 0, townD = Infinity;
		try { u = bay?.urbanAt?.(c.x, c.z)?.u || 0; } catch { u = 0; }
		for (const T of bay?.towns || []) townD = Math.min(townD, Math.hypot(T.x - c.x, T.z - c.z) - (T.r || 0));
		const built = w.real?.loaded?.() ? w.real.near('boxes', c.x, c.z, 300).length : 0;
		return militiaAllowed({ urban: u, built, townD });
	}
	// corner crews mind their own business with a patrol about; officers leave them be unless
	// they are fighting
	function ignore(h, o) {
		if (h.corner && !h.alert && !h.provoked && FACTIONS[o.fid]?.lawful) return true;
		if (lawful(h) && o.corner && !o.alert && !o.provoked) return true;
		return false;
	}

	// ---------- tactics: nerve, and the fallen ----------
	function stepMorale() {
		for (const sq of combat.squads.squads.values()) {
			if (sq.fid === 'fire' || sq.post?.kind === 'tower') continue;
			const alive = sq.members.filter((h) => !h.dead && !h.surrendered && !h.recall);
			sq.start = Math.max(sq.start || 0, sq.members.length);
			if (!alive.length || !alive.some((h) => h.alert && h.target)) continue;
			const a = alive[0], F = FACTIONS[sq.fid];
			let enemies = 0, hurt = 0;
			for (const h of combat.squads.alive()) if (!h.surrendered && h.fid !== sq.fid && combat.relations.hostile(sq.fid, h.fid) && Math.hypot(h.pos.x - a.pos.x, h.pos.z - a.pos.z) < 70) enemies++;
			if (alive.some((h) => h.target?.id === 'me')) enemies++;
			for (const h of alive) hurt += 1 - h.H.hp / h.H.max;
			const m = squadMorale({ alive: alive.length, start: sq.start, enemies, hurt: hurt / alive.length, kind: F?.kind });
			if (m === 'hold') continue;
			for (const h of alive) if (h.role !== 'fallback' && h.post?.kind !== 'tower') { h.role = 'fallback'; h.goalT = 0; }
			if (!sq.fellBack) { sq.fellBack = true; if (Math.hypot(a.pos.x - (eye()?.x ?? 0), a.pos.z - (eye()?.z ?? 0)) < 60) combat.call?.(m === 'rout' ? 'Run! Get out of here!' : 'Fall back! Fall back!', F?.name || ''); }
		}
	}
	function death(h) {
		if (!h.body || !earth() || custody) return;
		const Sv = services();
		if (!Sv?.injury || medics.filter((q) => !q.h.collected && t - q.at < 150).length >= (isPhone ? 2 : 4)) return;
		h.awaitMedic = true;
		// the ambulance takes them: services/ marks whoever it carries off as leaving
		const casualty = { M: h.body.M, P: h.body.P, persona: { name: h.T?.name || 'a casualty' }, leaveT: 0, set leaving(v) { if (v) h.collected = true; }, get leaving() { return !!h.collected; } };
		try { Sv.injury(casualty, lawful(h) ? 'an officer shot' : 'a gunshot wound', 0.85); S.medics++; medics.push({ h, at: t }); } catch { h.awaitMedic = false; }
		if (medics.length > 12) medics.splice(0, medics.length - 12);
	}

	// ---------- each frame ----------
	let lastW = null;
	// ---------- whose police ----------
	// (the force here; taken on once the last one's people are gone, or at once after a long move)
	let forceT = 0, forceFrom = null;
	function policeAbout(e) {
		if (combat.wantedLevel() > 0 || custody) return true;
		for (const c of police?.cruisers || []) if (c.pos && Math.hypot(c.pos.x - e.x, c.pos.z - e.z) < 260) return true;
		for (const h of combat.squads.alive()) if (FACTIONS[h.fid]?.kind === 'police' && Math.hypot(h.pos.x - e.x, h.pos.z - e.z) < 200) return true;
		return (dispatch?.patrols || []).some((q) => q.side === 'police' && q.state !== 'done');
	}
	function stepForce() {
		const e = eye();
		if (!e) return;
		const F = forceAtXZ(e.x, e.z);
		if (!F || F.id === localForce().id) { if (F) forceFrom = { x: e.x, z: e.z }; return; }
		const far = !forceFrom || Math.hypot(e.x - forceFrom.x, e.z - forceFrom.z) > 15000;
		if (far || !policeAbout(e)) { setLocalForce(F); forceFrom = { x: e.x, z: e.z }; }
	}

	function update(dt) {
		const w = W(), p = P();
		if (!w || !p) return;
		if (w !== lastW) { reset(); lastW = w; forceFrom = null; forceT = 0; }
		if (!earth()) { if (btn) btn.style.display = 'none'; return; }
		t += dt;
		if ((forceT -= dt) <= 0) { forceT = 2; stepForce(); }
		// how you move (for compliance, fleeing and where a roadblock goes)
		if (me.px !== null) { const k = Math.min(1, dt * 4), vx = (p.pos.x - me.px) / Math.max(dt, 1e-3), vz = (p.pos.z - me.pz) / Math.max(dt, 1e-3); me.vx += (vx - me.vx) * k; me.vz += (vz - me.vz) * k; me.speed = Math.hypot(me.vx, me.vz); }
		me.px = p.pos.x; me.pz = p.pos.z;
		calls();
		if (custody) { custody.t += dt; if (!custody.downed && custody.t > 4) book(); }
		else compliance(dt);
		if ((planT -= dt) <= 0) { planT = 2; respond(); }
		if (combat.wantedLevel() < 3) { lowT += dt; if (lowT > 20) police?.clearBlocks(); } else lowT = 0;
		if ((moraleT -= dt) <= 0) { moraleT = 1; stepMorale(); stepLeavers(); }
		if (Math.floor(t / 3) !== Math.floor((t - dt) / 3)) stepCorners();
		if (btn) { const show = combat.wantedLevel() > 0 && !custody && !me.handsUp && near.d < 40 ? 'block' : 'none'; if (btn.style.display !== show) btn.style.display = show; }
	}
	function reset() {
		L.reports.length = 0; custody = null; me.handsUp = false; me.evaded = false; me.px = null;
		for (const c of corners) for (const h of c.members || []) if (!h.dead && !h.gone) combat.squads.release(h);
		corners.length = 0; leavers.length = 0; medics.length = 0; lastLevel = 0; planAt = -1;
	}

	// wired into the fight and the police
	const hooks = combat.hooks;
	hooks.crime = crime;
	hooks.event = incident;
	hooks.police = () => true;
	hooks.holdFire = holdFire;
	hooks.ignore = ignore;
	hooks.cover = (x, z, r) => police?.cover?.(x, z, r) || null;
	hooks.arrest = () => { const off = nearestOfficer(); if (!arrestable({ level: combat.wantedLevel(), downed: true, officerD: off.d })) return false; arrest(true); return true; };
	hooks.booked = () => book();
	hooks.death = death;
	hooks.ambient = ambient;
	hooks.campOk = campOk;
	if (police) { police.law.last = () => combat.lastSeen(); police.law.view = view; }

	function info() {
		const e = eye(), T = e && earth() ? territory(e.x, e.z) : null, ws = combat.wantedState();
		return {
			level: ws.stars, stage: LEVELS[ws.stars], points: Math.round(ws.points), seen: ws.seen, searching: !ws.seen && ws.stars > 0 ? Math.round(ws.quiet) : 0, last: ws.last && [Math.round(ws.last.x), Math.round(ws.last.z)],
			plan: planNow(), reports: L.reports.filter((q) => !q.done).map((q) => ({ call: q.call, in: Math.max(0, Math.round(q.due - t)), seen: q.seen, weight: q.weight })), pending: pending(L),
			custody: custody && { t: +custody.t.toFixed(1), fine: custody.fine, downed: custody.downed }, handsUp: me.handsUp,
			force: (() => { const F = localForce(), H = e ? forceAtXZ(e.x, e.z) : null; return { name: F.name, word: F.word, sub: F.sub, officer: F.officer, station: F.station, here: H && H.id !== F.id ? H.name : null }; })(),
			region: here && { id: here.id, trouble: here.situation?.trouble ?? null }, territory: T,
			corners: corners.map((c) => ({ id: c.id, gang: c.gang, state: c.state, n: (c.members || []).filter((h) => !h.dead && !h.gone).length, km: e ? +(Math.hypot(c.x - e.x, c.z - e.z) / 1000).toFixed(2) : null })),
			roadblocks: (police?.cruisers || []).filter((c) => c.why === 'block' && c.state === 'blocking').length / 2,
			police: police?.info?.() || [], stats: { ...S },
		};
	}
	return { update, info, reset, crime, incident, surrender, arrest: () => arrest(false), book, territory, corner: forceCorner, corners, hooks: { holdFire, ignore, ambient, campOk } };
}
