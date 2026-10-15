// What you can do while it lasts: get someone trapped under the rubble out, help someone hurt
// to the hospital yourself (the ambulances are all out), get water on a fire (a block alight
// after the quake, or a wildfire's front beside the crews). The nearest is marked (the guide's
// pin and chip, ui/waypoint.js); you do it by going there and staying at it (lifting, holding
// the hose), shown on the alert's bar, so it works the same with a keyboard or a thumb. Each
// done is a good deed on the compass (combat/morality.js: disaster-rescue, disaster-carry,
// disaster-fire), a little relief money, and counts towards today's goal of patching someone
// up. What is left when it is over is the crews' to finish.

const REACH = { rescue: 2.8, carry: 2.6, fire: 13, hose: 16 };
const WORK = { rescue: 4.5, carry: 1.4, fire: 26, hose: 22 };
const PAY = { rescue: 120, carry: 150, fire: 110, hose: 100 };
const DEED = { rescue: 'disaster-rescue', carry: 'disaster-carry', fire: 'disaster-fire', hose: 'disaster-fire' };

export function createQuests(ctx) {
	const { hooks, world, camera, isPhone } = ctx;
	const W = () => world();
	const list = [];
	let seq = 0, active = null, done = 0, chunkT = 0, sprayT = 0, riding = null;
	const me = () => { const p = W()?.player?.state?.pos; return p || camera.position; };
	const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
	const driving = () => !!hooks.drive?.active?.();
	const ground = (x, z) => W()?.island?.heightAt?.(x, z) ?? 0;

	function offer(kind, o) {
		const q = { id: `cq:${++seq}`, kind, state: 'open', t: 0, work: 0, ...o };
		list.push(q);
		return q;
	}
	// the nearest hospital's door, for someone carried there
	function hospital(at) {
		const S = W()?.services;
		let best = null, bd = 1e9;
		for (const F of S?.list?.() || []) { if (F.kind !== 'hospital') continue; const d = Math.hypot(F.x - at.x, F.z - at.z); if (d < bd) { bd = d; best = F; } }
		return best && bd < 3200 ? { x: best.x, z: best.z, name: best.name || 'the hospital' } : null;
	}
	function pay(q) {
		try { hooks.arms?.apply?.({ id: `relief:${q.id}:${Date.now().toString(36)}`, kind: 'trade', peer: 'relief', give: { credits: 0, items: [] }, get: { credits: PAY[q.kind], items: [] } }); } catch { /* no inventory */ }
	}
	function deed(q, target) {
		try {
			hooks.morality?.record?.({ kind: DEED[q.kind], target, place: hooks.combat?.placeName?.() || '', world: hooks.combat?.worldKey?.() || 'here', ctx: { witnessed: true } });
		} catch { /* no compass */ }
		if (q.kind === 'rescue' || q.kind === 'carry') { try { hooks.daily?.note?.('tend'); } catch { /* no goals */ } }
	}
	function finish(q, line) {
		q.state = 'done'; done++;
		pay(q);
		ctx.hud?.progress(null);
		ctx.hud?.say(`${line} +${PAY[q.kind]} credits`);
		ctx.onDone?.(q);
		if (active === q) active = null;
	}

	// ---------- each frame ----------
	function step(q, dt) {
		const p = me();
		if (q.kind === 'rescue') {
			const N = q.need;
			if (!N.p?.active || N.done) { q.state = 'gone'; return; }
			q.at = { x: N.p.M.S.pos.x, z: N.p.M.S.pos.z };
			if (driving() || flat(p, q.at) > REACH.rescue) { q.work = Math.max(0, q.work - dt * 0.5); return; }
			q.work += dt;
			ctx.hud?.progress(q.work / WORK.rescue, `Lifting the rubble off ${N.name}...`);
			// (the broken pieces heaved aside, the dust)
			if ((chunkT -= dt) <= 0) { chunkT = 0.7; ctx.heave?.(q.at); }
			if (q.work >= WORK.rescue) {
				ctx.response.met(N, 'player');
				deed(q, N.name);
				ctx.say?.(N.p, 'Thank you. Thank you, I thought nobody was coming.', 'nod', { joy: 0.5, sad: 0.4 });
				finish(q, `You got ${N.name} out.`);
				// badly hurt: to the hospital next, if you will
				if (N.sev > 0.45 && hospital(q.at)) offer('carry', { need: N, title: `Get ${N.name} to the hospital`, at: q.at, chained: true });
			}
			return;
		}
		if (q.kind === 'carry') {
			const N = q.need;
			if (!N.p?.active || N.p.leaving) { q.state = 'gone'; release(); return; }
			if (q.state === 'open') {
				q.at = { x: N.p.M.S.pos.x, z: N.p.M.S.pos.z };
				if (driving() || flat(p, q.at) > REACH.carry) { q.work = 0; return; }
				q.work += dt;
				ctx.hud?.progress(q.work / WORK.carry, `Helping ${N.name} up...`);
				if (q.work >= WORK.carry) {
					q.state = 'carrying'; q.to = hospital(q.at);
					if (!q.to) { q.state = 'gone'; ctx.response.met(N, 'player'); return; }
					N.done = true; N.by = 'player';
					ctx.response.track(N.p, 'follow');
					ctx.hud?.progress(null);
					ctx.hud?.say(`Get ${N.name} to ${q.to.name}. They will follow you; in a car, they ride with you.`);
				}
				return;
			}
			// carrying: they keep up (riding along while you drive)
			const P = N.p, inCar = driving();
			if (inCar) { riding = P; P.P.root.visible = false; P.M.place?.(p.x, ground(p.x, p.z), p.z, P.M.S.heading); }
			else if (riding === P) { P.P.root.visible = true; P.M.place?.(p.x + 1.2, ground(p.x + 1.2, p.z), p.z, P.M.S.heading); riding = null; }
			if (flat(p, q.to) < 38 && (inCar || flat(P.M.S.pos, p) < 14)) {
				release();
				try { W()?.services?.admit?.('hospital', { who: 'npc:' + ((P.P?.dna?.seed ?? 0) >>> 0), name: N.name, minor: !!(P.P?.dna?.child || P.P?.dna?.minor), severity: N.sev, cause: ctx.cause?.() || 'the disaster', by: 'you' }); } catch { /* the ward is not built */ }
				ctx.response.release(P);
				P.leaving = true; P.leaveT = 3;
				deed(q, N.name);
				finish(q, `${N.name} is in good hands at ${q.to.name}.`);
			}
			return;
		}
		if (q.kind === 'fire') {
			const C = hooks.combat, F = (C?.firesNear?.(q.at.x, q.at.z, 6) || []).find((f) => f.id === q.fire);
			if (!F) { if (q.work > 2) { deed(q, 'a burning building'); finish(q, 'The fire is out.'); } else q.state = 'gone'; return; }
			if (driving() || flat(p, q.at) > REACH.fire + (q.r || 0)) return;
			q.work += dt;
			C.douse?.(q.fire, dt * 2.2);
			ctx.hud?.progress(Math.min(0.98, q.work / WORK.fire + (1 - F.heat) * 0.3), 'Water on the fire...');
			if ((sprayT -= dt) <= 0) { sprayT = isPhone ? 0.08 : 0.04; ctx.spray?.(p, { x: q.at.x, y: ground(q.at.x, q.at.z) + 3, z: q.at.z }); }
			if (q.work >= WORK.fire * 2) { deed(q, 'a burning building'); finish(q, 'You held the fire until it died.'); }
			return;
		}
		if (q.kind === 'hose') {
			const front = ctx.front?.();
			if (!front) { q.state = 'gone'; return; }
			// the marker keeps to the flames near where it was set
			const c = front.near(q.at.x, q.at.z, 60);
			if (!c.length) { if (q.work > 4) { deed(q, 'the fire line'); finish(q, 'That stretch of the line is held.'); } else q.state = 'gone'; return; }
			let best = c[0], bd = 1e9;
			for (const k of c) { const d = flat(k, p); if (d < bd) { bd = d; best = k; } }
			if (driving() || bd > REACH.hose) { q.at = { x: best.x, z: best.z }; return; }
			q.work += dt;
			const out = front.douse(p.x, p.z, 18, dt * 0.55);
			q.out = (q.out || 0) + out;
			ctx.hud?.progress(q.work / WORK.hose, `Holding the hose on the flames... ${q.out} put out`);
			if ((sprayT -= dt) <= 0) { sprayT = isPhone ? 0.08 : 0.04; ctx.spray?.(p, { x: best.x, y: ground(best.x, best.z) + 0.6, z: best.z }); }
			if (q.work >= WORK.hose) { deed(q, 'the fire line'); finish(q, `You held the line: ${q.out} patches of fire put out.`); }
		}
	}
	function release() { if (riding) { riding.P.root.visible = true; riding = null; } }
	function update(dt) {
		for (let i = list.length - 1; i >= 0; i--) if (list[i].state === 'done' || list[i].state === 'gone') { if (active === list[i]) { active = null; ctx.hud?.progress(null); } list.splice(i, 1); }
		// the one you are on: whatever is under way, else the nearest open
		if (!active || active.state !== 'carrying') {
			const p = me();
			let best = null, bd = 1e9;
			for (const q of list) { if (q.state === 'carrying') { best = q; break; } const d = flat(q.at, p) - (q.work > 0 ? 50 : 0); if (d < bd) { bd = d; best = q; } }
			if (best !== active) { if (active) ctx.hud?.progress(null); active = best; }
		}
		if (active) { active.t += dt; step(active, dt); }
	}
	// the guide's pin and chip
	function mark() {
		const q = active;
		if (!q) return null;
		const T = q.state === 'carrying' ? q.to : q.at;
		if (!T) return null;
		const y = ground(T.x, T.z);
		const left = list.filter((x) => x.state === 'open').length;
		const detail = q.state === 'carrying' ? `${q.need.name} is with you` : q.kind === 'rescue' ? 'stay by them to lift the rubble' : q.kind === 'carry' ? 'help them up, then lead the way' : q.kind === 'fire' ? 'stand close and keep the water on it' : 'stay by the flames with the hose';
		return { x: T.x, y, z: T.z, radius: q.kind === 'hose' || q.kind === 'fire' ? 8 : 2.5, title: q.state === 'carrying' ? `Get ${q.need.name} to ${q.to.name}` : q.title, detail: left > 1 ? `${detail} · ${left - 1} more need help` : detail };
	}
	function clear() {
		release();
		const left = list.filter((q) => q.state === 'open' || q.state === 'carrying');
		for (const q of left) if (q.state === 'carrying' && q.need?.p) ctx.response.release(q.need.p);
		list.length = 0; active = null;
		ctx.hud?.progress(null);
		return left.length;
	}
	function info() { return { active: active && { id: active.id, kind: active.kind, title: active.title, state: active.state, work: +active.work.toFixed(1) }, open: list.map((q) => ({ id: q.id, kind: q.kind, title: q.title, state: q.state, at: q.at && [Math.round(q.at.x), Math.round(q.at.z)] })), done }; }
	return { offer, update, mark, clear, info, list, done: () => done, active: () => active };
}
