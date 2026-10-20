// Personal history is evidence, not something dialogue may invent or award.
// Quests, relationships and route projects stay on this device; the soul ledger is separate.

import { jsonCopy as copy } from '../persistence/json-copy.js';

export const CHRONICLE_KEY = 'crysis-quest-chronicle-v1';
const text = (x, n = 160) => String(x || '').slice(0, n);
const key = (body, npc) => JSON.stringify([body, npc]);
const object = v => v && typeof v==='object' && !Array.isArray(v);
const validPos = p => p && Number.isFinite(p.y) && ([p.x,p.z].every(Number.isFinite) || [p.lat,p.lon].every(Number.isFinite));
function valid(data) {
	if(data?.version!==1 || !object(data.souls) || !Array.isArray(data.projects))return false;
	for(const s of Object.values(data.souls)) {
		if(!object(s)||!object(s.bonds)||!object(s.quests)||!object(s.receipts))return false;
		if(Object.values(s.bonds).some(b=>!b || typeof b.body!=='string'||typeof b.npc!=='string'||!object(b.trust)||Object.values(b.trust).some(v=>!Number.isFinite(v))||!Array.isArray(b.recent)||b.recent.some(e=>!e||typeof e.line!=='string'||!Number.isFinite(e.at)||!Number.isInteger(e.epoch)||!Number.isFinite(e.delta))||!Number.isInteger(b.chapters)||!Number.isInteger(b.complete)))return false;
		if(Object.values(s.quests).some(q=>!q||typeof q.id!=='string'||typeof q.body!=='string'||typeof q.npc!=='string'||!Array.isArray(q.landmarks)||q.landmarks.some(t=>!t||!validPos(t.pos))))return false;
	}
	return data.projects.every(p=>p&&typeof p.body==='string'&&['marked','quiet'].includes(p.choice)&&Array.isArray(p.landmarks)&&p.landmarks.every(t=>t&&typeof t.id==='string'&&validPos(t.pos)));
}
export function soulScope(token = 'local') {
	let n = 14695981039346656037n;
	for (const c of token) n = BigInt.asUintN(64, (n ^ BigInt(c.charCodeAt(0))) * 1099511628211n);
	return n.toString(36); // A local namespace, never a credential or authentication proof.
}
export function createQuestChronicle({ storage, scope = () => ({ id: 'local', epoch: 0 }), now = Date.now } = {}) {
	if (storage === undefined) { try { storage = globalThis.localStorage; } catch { storage = null; } }
	let data = { version: 1, souls: {}, projects: [], owners: {} }, error = '', blocked = false;
	try { const raw = storage?.getItem(CHRONICLE_KEY); if (raw) { const s = JSON.parse(raw); if (raw.length > 2000000 || !valid(s)) throw Error('bad save'); data = s; } }
	catch { error = 'Your relationship journal could not be read and has been preserved.'; blocked = true; }
	function save() { if (blocked) return false; try { const raw = JSON.stringify(data); if (!storage || raw.length > 2000000) throw Error('storage'); storage.setItem(CHRONICLE_KEY, raw); error = ''; return true; } catch { error = 'Your relationship changes are available this session, but could not be saved.'; return false; } }
	function soul() { const id = scope().id; return data.souls[id] ||= { bonds: {}, quests: {}, receipts: {} }; }
	function bond(body, npc, name) { const s = soul(), k = key(body, npc); return s.bonds[k] ||= { body, npc, name: text(name), chapters: 0, complete: 0, trust: {}, recent: [] }; }
	function note(body, npc, name, receipt, delta, line, at = now()) {
		if (blocked || !npc || !Number.isFinite(at)) return false;
		const s = soul(); if (Object.hasOwn(s.receipts, receipt)) return false;
		const b = bond(body, npc, name), epoch = at <= (scope().cleansedAt || 0) ? -1 : scope().epoch || 0;
		s.receipts[receipt] = at; b.trust[epoch] = (b.trust[epoch] || 0) + delta;
		b.recent.push({ line: text(line, 360), at, epoch, delta }); b.recent = b.recent.slice(-8); return true;
	}
	function register(q, name, landmarks = []) {
		if (blocked || !q?.offeredBy) return false;
		data.owners ||= {}; if (data.owners[q.id] && data.owners[q.id] !== scope().id) return false;
		data.owners[q.id] = scope().id;
		const s = soul();
		if (!s.quests[q.id]) { s.quests[q.id] = { id:q.id, body:q.bodyKey, npc:q.offeredBy, name:text(name), title:q.title, chapter:q.chapter || 0, status:q.status, landmarks:copy(landmarks.filter(t=>t&&validPos(t.pos)).slice(0,2)), outcome:null }; save(); }
		return true;
	}
	function observe(q, name) {
		if (blocked || !q?.offeredBy) return false;
		if (!register(q, name)) return false; const s = soul(), r = s.quests[q.id]; r.status = q.status;
		let changed = false;
		if (q.acceptedAt != null) changed = note(q.bodyKey, q.offeredBy, name, q.id+':accepted', 0, `You promised to help with “${q.title}”.`, q.acceptedAt) || changed;
		if (q.status === 'complete') {
			if (note(q.bodyKey,q.offeredBy,name,q.id+':complete',3,`You kept your word and finished “${q.title}”.`,q.finishedAt)) {
				const b = bond(q.bodyKey,q.offeredBy,name); b.complete++; if (q.chapter) b.chapters = Math.max(b.chapters,q.chapter); changed = true;
			}
		} else if (q.status === 'cancelled' && q.acceptedAt != null) changed = note(q.bodyKey,q.offeredBy,name,q.id+':cancelled',-2,`You called off “${q.title}” after agreeing to help.`,q.finishedAt) || changed;
		if (changed) save(); return changed;
	}
	function meeting(a, outcome, npc) {
		if (!['kept','missed'].includes(outcome)) return false;
		const changed = note(a.bodyKey,npc,a.npcName,'meeting:'+a.id+':'+outcome,outcome==='kept'?1:-1,outcome==='kept'?`You kept your meeting at ${a.place.name}.`:`You missed your agreed meeting at ${a.place.name}.`);
		if (changed) save(); return changed;
	}
	function witness(body, npc, name, event, cleansedAt = 0) {
		if (!event || !event.id || !Number.isFinite(event.at) || event.bodyKey!==body || event.actorId!=='player' || event.at<=cleansedAt || !['assault','vehicle-impact','robbery','arson','ward'].includes(event.kind)) return false;
		const changed = note(body,npc,name,'witness:'+npc+':'+event.id,-5,`Personally witnessed you: ${event.line}.`,event.at); if(changed) save(); return changed;
	}
	function relationship(body, npc) {
		const b = soul().bonds[key(body,npc)], epoch = scope().epoch || 0, trust = b?.trust[epoch] || 0;
		const recent = (b?.recent || []).filter(e=>e.epoch===epoch);
		return { name:b?.name || '', trust, complete:b?.complete || 0, chapters:b?.chapters || 0,
			label:trust<=-4?'Trust damaged':trust<0?'Uncertain':trust>=9?'Trusted friend':trust>=6?'Reliable ally':trust>=3?'A promise kept':epoch?'A fresh start':'Getting acquainted',
			last:recent.at(-1)?.line || '', wound:recent.filter(e=>e.delta<0).at(-1)?.line || '',
			facts:recent.slice(-2).map(e=>e.line) };
	}
	function brief(body, npc) {
		const r = relationship(body,npc); if (r.chapters >= 3) return null;
		const previous = Object.values(soul().quests).filter(q=>q.body===body&&q.npc===npc&&q.chapter&&q.status==='complete').sort((a,b)=>b.chapter-a.chapter)[0];
		const chapter = r.chapters + 1;
		return { chapter, previous:previous?.title || '', outcome:previous?.outcome || '',
			goal:chapter===1?'Find a place you would want another traveller to discover. Ask why it matters to this resident, then visit and report back.':chapter===2?'Build on your earlier walk: compare a different nearby place. On your return you can choose visible route markers or a private route in your journal.':'Follow through on the route you chose together. Visit a new stop, return, and discuss what should be remembered about it.', relationship:r.label };
	}
	function pending(body, npc) { return copy(Object.values(soul().quests).filter(q=>q.body===body&&(!npc||q.npc===npc)&&q.chapter===2&&q.status==='complete'&&!q.outcome)); }
	function decide(id, choice) {
		if (blocked || !['marked','quiet'].includes(choice)) return { ok:false, error:error || 'Choose a marked or quiet route.' };
		const r = soul().quests[id];
		if (!r || r.chapter!==2 || r.status!=='complete') return {ok:false,error:'Finish this chapter before deciding.'};
		if (r.outcome) return {ok:r.outcome===choice,already:true,outcome:r.outcome};
		if (choice==='marked' && !r.landmarks.some(t=>t.markerEligible!==false)) return {ok:false,error:'No safe outdoor stops were recorded for this route. You can keep the route in your journal.'};
		r.outcome = choice;
		data.projects.push({id:scope().id+':'+id,body:r.body,name:r.title,npc:r.name,choice,landmarks:copy(choice==='marked'?r.landmarks.filter(t=>t.markerEligible!==false):r.landmarks),at:now()});
		note(r.body,r.npc,r.name,id+':outcome',0,choice==='marked'?'You chose to mark your route together. The markers stand at the surveyed stops.':'You chose to leave the landscape untouched and keep the route in your journal.');
		const persisted=save(); return {ok:true,outcome:choice,persisted};
	}
	return { register,observe,meeting,witness,relationship,brief,pending,decide,save,
		projects:body=>copy(data.projects.filter(p=>!body||p.body===body)),
		bonds:body=>Object.values(soul().bonds).filter(b=>!body||b.body===body).map(b=>({...relationship(b.body,b.npc),npc:b.npc,body:b.body})),
		status:()=>({error,blocked}) };
}

export function reportRequest(text) {
	const q=String(text||'').trim().toLowerCase();
	if (/\b(?:not|never|didn't|haven't|don't|if|imagine|pretend|would|could)\b|["“”]/.test(q)) return false;
	return /\b(?:report(?:ing)? back|here(?:'s| is) (?:my|the) report|i (?:went|visited|checked|saw|found|finished|looked|explored)|i(?:'m| am) back|back from|got back|done with|finished (?:the|that) (?:walk|route|visit|quest))\b/.test(q);
}
