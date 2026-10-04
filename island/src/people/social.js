// The action boundary between conversation, saved residents and streamed bodies.
// Dialogue models describe outcomes; only these validated player requests change state.
import { createSocialState, parseSocialIntent } from './social-state.js';
import { createSocialActors, positionFor, worldPosition } from './social-actors.js';
import { personaFor } from './persona.js';

export function createNpcSocial({ scene, world, camera, people, isPhone, hint }) {
	const state = createSocialState();
	const bodyKey = () => world()?.body?.key || '';
	const actors = createSocialActors({ scene, world, camera, state, people, isPhone, hint, bodyKey });
	function meet(p, where) {
		const W = world();
		if (!W || !p?.P?.dna || !p.M?.S?.pos) return null;
		let record = p.residentId && state.get(p.residentId);
		if (record && record.bodyKey !== bodyKey()) record = null;
		const position = positionFor(W, p.M.S.pos);
		record = state.meet(record ? { id: record.id, bodyKey: bodyKey() } : {
			bodyKey: bodyKey(), home: position, position, dna: p.P.dna,
			persona: personaFor(p.P, where), source: 'ambient',
		});
		if (!record) return null;
		actors.adopt(p, record);
		return record;
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
			const y = W.island.heightAt(target.x, target.z);
			if (!Number.isFinite(y) || y < 0.3 || target.under) return 'I need a reachable place on dry ground to scout.';
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
		const modes = { idle: 'staying in my home area', follow: 'following you', wait: 'waiting here', home: 'heading home', scout: `scouting ${r.task?.label || 'nearby'}`, quest: `travelling with you for ${r.task?.title || 'our quest'}` };
		return `I'm ${modes[r.mode] || 'here'}.${r.task?.status === 'blocked' ? ' The route is blocked, so I am waiting safely.' : ''}`;
	}
	return { state, actors, meet, command, describe, bodyKey, positionFor,
		update(dt, time, enabled) { state.tick(); actors.update(dt, time, enabled); },
		reset() { actors.reset(); state.flush(); },
		flush() { actors.flush(); },
	};
}
