// The action boundary between conversation, saved residents and streamed bodies.
// Dialogue models describe outcomes; only these validated player requests change state.
import { createSocialState, parseSocialIntent, socialDistance } from './social-state.js';
import { createSocialActors, positionFor, worldPosition, safeSocialStep } from './social-actors.js';
import { personaFor } from './persona.js';
import { createAppointments, formatClock } from './appointments.js';
import { createGatheringScene } from './gathering-scene.js';

export function createNpcSocial({ scene, world, camera, people, isPhone, hint }) {
	const state = createSocialState();
	const bodyKey = () => world()?.body?.key || '';
	const actors = createSocialActors({ scene, world, camera, state, people, isPhone, hint, bodyKey });
	const appointments = createAppointments();
	const listeners = new Set();
	const gatherings = createGatheringScene({ scene, world, camera, book: appointments, bodyKey });
	// Agreed meetings move residents: they set off ahead of time, are at the place by the
	// hour (out of sight they travel there directly), and remember whether you came.
	function keepAppointments() {
		const W = world(), hours = W?.sky?.state?.hours;
		if (!W || !Number.isFinite(hours)) return;
		const events = appointments.tick({ hours, bodyKey: bodyKey(), player: positionFor(W, camera.position) });
		for (const e of events) {
			if (e.appointment.gathering) { keepGathering(W, e); for (const fn of listeners) fn(e); continue; }
			const a = e.appointment, r = state.get(a.npcId), name = r?.persona?.first || a.npcName;
			const actor = actors.all().find(p => p.residentId === a.npcId && p.active);
			const task = { id: a.id, type: 'meet', status: 'outbound', target: a.place.pos, label: a.place.name, due: a.due };
			if (r && e.type === 'go' && !['follow', 'quest'].includes(r.mode)) state.setMode(r.id, 'meet', task);
			if (r && e.type === 'due' && !['follow', 'quest'].includes(r.mode)) arrive(W, r, a, task, actor);
			if (r && e.type === 'kept') {
				state.remember(r.id, 'event', `The traveller met you at ${a.place.name} at ${formatClock(a.due % 24)}, as you had agreed.`);
				if (r.mode === 'meet') state.setMode(r.id, 'wait', null);
				hint(`${name} is here: you kept your meeting at ${a.place.name}.`, 5000);
			}
			if (r && e.type === 'missed') {
				state.remember(r.id, 'event', `You waited for the traveller at ${a.place.name} at ${formatClock(a.due % 24)}, but they never came. You went home.`);
				if (r.mode === 'meet') state.setMode(r.id, 'home', null);
				hint(`You missed your meeting with ${name} at ${a.place.name}.`, 5000);
			}
			for (const fn of listeners) fn(e);
		}
	}
	// at the place by the hour: out of the player's sight a resident travels there directly
	function arrive(W, r, a, task, actor) {
		const q = worldPosition(W, task.target), far = !actor || actor.M.S.pos.distanceTo(camera.position) > 60;
		if (far) { state.setMode(r.id, 'meet', { ...task, status: 'waiting' }); state.setPosition(r.id, task.target); if (actor && q) actor.M.place(q.x, q.y, q.z, actor.M.S.heading); }
		else if (r.mode !== 'meet') state.setMode(r.id, 'meet', task);
	}
	// A gathering: the organiser goes first, a few other residents living nearby come too
	// (the crowd itself is drawn by gathering-scene.js), and it ends whether or not you came.
	function keepGathering(W, e) {
		const a = e.appointment, g = a.gathering, what = `the ${g.title.toLowerCase()} at ${a.place.name}`;
		const r = state.get(a.npcId), name = r?.persona?.first || a.npcName;
		const free = x => x && !['follow', 'quest', 'scout'].includes(x.mode) && !(x.mode === 'meet' && x.task?.id !== a.id);
		const center = worldPosition(W, a.place.pos);
		const spot = (k) => { if (!center || !k) return a.place.pos; const ang = k * 2.1; return positionFor(W, { x: center.x + Math.sin(ang) * 3, y: center.y, z: center.z + Math.cos(ang) * 3 }); };
		const guests = () => state.list(bodyKey()).filter(x => x.id !== a.npcId && x.mode === 'meet' && x.task?.id === a.id);
		if (e.type === 'go') {
			if (free(r)) state.setMode(r.id, 'meet', { id: a.id, type: 'gathering', status: 'outbound', target: a.place.pos, label: what, due: a.due });
			const near = state.list(bodyKey()).filter(x => x.id !== a.npcId && free(x) && x.mode !== 'meet' && (x.dna?.age ?? 18) >= 12 && x.position && socialDistance(x.position, a.place.pos) < 300).slice(0, isPhone ? 2 : 4);
			near.forEach((x, k) => state.setMode(x.id, 'meet', { id: a.id, type: 'gathering', status: 'outbound', target: spot(k + 1), label: what, due: a.due }));
		}
		if (e.type === 'due') {
			for (const x of [r, ...guests()]) if (x && x.mode === 'meet' && x.task?.id === a.id) arrive(W, x, a, x.task, actors.all().find(p => p.residentId === x.id && p.active));
		}
		if (e.type === 'joined') {
			if (r) state.remember(r.id, 'event', `The traveller came to ${what} you organised.`);
			hint(`You joined ${what}. Play your Bard and the crowd will move to it.`, 6000);
		}
		if (e.type === 'kept' || e.type === 'missed') {
			if (r) state.remember(r.id, 'event', e.type === 'kept'
				? `You held ${what} at ${formatClock(a.due % 24)} and the traveller came. It went well.`
				: `You held ${what} at ${formatClock(a.due % 24)}. It went ahead without the traveller, who never came.`);
			for (const x of [r, ...guests()]) if (x && x.mode === 'meet' && x.task?.id === a.id) state.setMode(x.id, 'home', null);
			hint(e.type === 'kept' ? `The ${g.title.toLowerCase()} is over. People are heading home.` : `${name}'s ${g.title.toLowerCase()} at ${a.place.name} went ahead without you.`, 5000);
		}
	}
	function meet(p, where) {
		const W = world();
		if (!W || !p?.P?.dna || !p.M?.S?.pos) return null;
		let record = p.residentId && state.get(p.residentId);
		if (record && record.bodyKey !== bodyKey()) record = null;
		const position = positionFor(W, p.M.S.pos), caveMeta=p.caveMeta || p.P.caveMeta;
		if(caveMeta) p.P.caveMeta=caveMeta;
		// a world's own named people (planet/colony/crew-life.js): a fixed id and who they are
		const own = p.resident?.();
		record = state.meet(record ? { id: record.id, bodyKey: bodyKey() } : {
			id: own?.id || caveMeta?.id, bodyKey: bodyKey(), home: position, position, dna: p.P.dna,
			persona: own?.persona || personaFor(p.P, where), source: own ? own.source : caveMeta ? 'cave' : 'ambient',
		});
		if (!record) return null;
		if (own) { record.persona = JSON.parse(JSON.stringify(own.persona)); record.dna = p.P.dna; }
		actors.adopt(p, record);
		return record;
	}
	function scoutNearby(p, candidates = []) {
		const W = world(), origin = p?.M?.S?.pos;
		if (!W?.island || !origin) return null;
		const underground=W.island.underFloor?.(origin.x,origin.z,origin.y)!=null;
		const options = candidates.filter(q => (!q.under || underground) && Math.hypot(q.x-origin.x,q.z-origin.z) >= 4 && Math.hypot(q.x-origin.x,q.z-origin.z) <= 120)
			.sort((a,b) => Math.hypot(a.x-origin.x,a.z-origin.z)-Math.hypot(b.x-origin.x,b.z-origin.z));
		for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; options.push({x:origin.x+Math.cos(a)*12,z:origin.z+Math.sin(a)*12,name:'the nearby clearing'}); }
		for (const target of options) {
			const n = Math.ceil(Math.hypot(target.x-origin.x,target.z-origin.z)/0.3);
			let at = {x:origin.x,y:origin.y,z:origin.z};
			for (let i = 1; i <= n && at; i++) at = safeSocialStep(W.island, at, {x:origin.x+(target.x-origin.x)*i/n,z:origin.z+(target.z-origin.z)*i/n}, W.player);
			if (at && (!Number.isFinite(target.y) || Math.abs(at.y-target.y)<3)) return target;
		}
		return null;
	}
	function command(record, text, { target = null, quest = null } = {}) {
		const intent = parseSocialIntent(text);
		if (!intent) return null;
		if (!record || record.bodyKey !== bodyKey()) return 'We need to be on the same world to arrange that.';
		const current = state.get(record.id);
		if (!current || current.bodyKey !== bodyKey()) return 'I could not keep that request. Please try again.';
		if (intent === 'status') return result(describe(current));
		const actor = actors.all().find(p => p.residentId === current.id && p.active);
		if (!actor) return 'I need to be here with you before I can take that task. Come back to my area and speak to me again.';
		if (['follow', 'quest', 'scout'].includes(intent) && (current.dna?.age ?? current.persona?.age ?? 18) < 18) return 'I need to stay here with my family. Ask one of the adults to help.';
		state.setPosition(current.id, positionFor(world(), actor.M.S.pos));
		if (intent === 'warn' || intent === 'calm') {
			const reaction = intent === 'warn' ? state.warn(current.id) : state.calm(current.id);
			if (!reaction.ok) return reaction.reason || 'Give me a moment before I pass another message along.';
			return result(intent === 'warn' ? "I'll warn the people nearby. The warning stays in this area." : "I'll reassure the people nearby. Let's help everyone settle down.");
		}
		if (intent === 'follow' || intent === 'quest') {
			const party = state.list(bodyKey()).filter(r => r.id !== current.id && ['follow', 'quest'].includes(r.mode));
			if (party.length >= (isPhone ? 3 : 6)) return 'Your group is full. Ask someone to wait or head home first.';
			state.setMode(current.id, intent, intent === 'quest' ? {
				id: `quest:${Date.now()}`, type: 'quest', status: 'active', title: quest?.title || 'Explore together',
				questId: quest?.id || quest?.place || null,
			} : null);
			return result(intent === 'quest' ? "I'll travel with you as your quest companion. Close the conversation and lead the way; I'll wait if a route is blocked." : "I'll follow you on foot. Close the conversation and lead the way; ask me to wait or head home whenever you like.");
		}
		if (intent === 'scout') {
			if (!target) return 'Name a nearby place for me to scout, or ask me to scout nearby.';
			const W = world(), origin = worldPosition(W, current.position);
			if (!origin || !W?.island?.heightAt || !Number.isFinite(target.x) || !Number.isFinite(target.z)) return 'I cannot locate a safe route there. Choose another nearby place.';
			const distance = Math.hypot(target.x - origin.x, target.z - origin.z);
			if (!Number.isFinite(distance) || distance > 180 || distance < 3) return 'Choose a place between 3 and 180 metres away. I can scout a local route and return with a report.';
			const underground=W.island.underFloor?.(origin.x,origin.z,origin.y)!=null;
			let y = W.island.heightAt(target.x, target.z);
			if (underground) {
				const steps=Math.ceil(distance/.3); let at=origin;
				for(let i=1;i<=steps && at;i++) at=safeSocialStep(W.island,at,{x:origin.x+(target.x-origin.x)*i/steps,z:origin.z+(target.z-origin.z)*i/steps},W.player);
				if(!at || Number.isFinite(target.y) && Math.abs(at.y-target.y)>3) return 'That passage is blocked. I need a walkable route with room to stand.';
				y=at.y;
			} else if (!Number.isFinite(y) || y < 0.3 || target.under) return 'I need a reachable place on dry ground to scout.';
			state.setMode(current.id, 'scout', { id: `scout:${Date.now()}`, type: 'scout', status: 'outbound',
				target: positionFor(W, { x: target.x, y, z: target.z }), label: target.name || 'the nearby area' });
			return result(`I'll scout ${target.name || 'the nearby area'}, then return to my home area. Close the conversation so I can set off; ask me for a report when I get back.`);
		}
		if (intent === 'wait' || intent === 'cancel') {
			state.setMode(current.id, 'wait', null);
			return result(intent === 'wait' ? "I'll wait here for you." : "I've cancelled that job. I'll wait here.");
		}
		if (intent === 'home') { state.setMode(current.id, 'home', null); return result("I'll head back to the place where we met."); }
		return null;
	}
	function result(text) { return state.status().error ? `${text} This browser could not save the change; it lasts only for this session.` : text; }
	function describe(r) {
		if (r.task?.report) return r.task.report;
		if (r.mode === 'meet' && r.task?.type === 'gathering') return r.task?.status === 'waiting' ? `I'm at ${r.task.label}. Come and join us.` : `I'm on my way to ${r.task.label}.`;
		if (r.mode === 'meet') return r.task?.status === 'waiting' ? `I'm waiting for you at ${r.task.label}, as we agreed.` : `I'm on my way to ${r.task?.label || 'our meeting'} to meet you.`;
		const modes = { idle: 'staying in my home area', follow: 'following you', wait: 'waiting here', home: 'heading home', scout: `scouting ${r.task?.label || 'nearby'}`, quest: `travelling with you for ${r.task?.title || 'our quest'}` };
		return `I'm ${modes[r.mode] || 'here'}.${r.task?.status === 'blocked' ? ' The route is blocked, so I am waiting safely.' : ''}`;
	}
	return { state, actors, appointments, gatherings, isPhone: !!isPhone, meet, command, scoutNearby, describe, bodyKey, positionFor,
		onAppointment(fn) { listeners.add(fn); return () => listeners.delete(fn); },
		update(dt, time, enabled) { state.tick(); keepAppointments(); actors.update(dt, time, enabled); gatherings.update(dt, time, enabled); },
		reset() { actors.reset(); gatherings.dispose(); state.flush(); },
		flush() { actors.flush(); },
	};
}
