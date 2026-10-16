import { positionFor, worldPosition } from './social-actors.js';
import { communityProjectSpot } from '../guide/community-project-marks.js';

const hash = value => { let h = 2166136261; for (const c of String(value)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
const siteId = raw => { const s = String(raw || ''); return s.length <= 96 ? s : 'site:' + hash(s); };
// Only discovered geography and registered sources enter this adapter. A language
// model receives IDs from the result, never a geometry or terrain-write API.
export function createCommunityProjectSites({ world, position, targets, activities, projects = () => [], clock = () => Date.now() }) {
	let cache = [], expires = 0, lastWorld = null, epoch = null, projectSignature = '', prior = { x: Infinity, z: Infinity };
	function list() {
		const W = world(), at = position(); if (!W?.island || !at) return [];
		const existing = (projects() || []).filter(p => p.world === W.body?.key && p.anchor && p.siteId);
		const signature = JSON.stringify(existing.map(p => [p.siteId, p.kind, p.anchor]));
		if (W === lastWorld && epoch === W.globe?.frame?.epoch && signature === projectSignature && clock() < expires && Math.hypot(at.x-prior.x,at.z-prior.z)<20) return cache;
		projectSignature = signature;
		lastWorld = W; epoch = W.globe?.frame?.epoch; expires = clock()+5000; prior = {x:at.x,z:at.z};
		const raw = [];
		for (const q of activities() || []) if (q.siteId && q.siteAnchor) raw.push({ id: q.siteId, name: q.place, ...q.siteAnchor, source: 'living-request', requestId: q.id, npcId: q.beneficiaryId, npcName: q.requesterName });
		for (const t of targets() || []) if (!t.under && !t.caveEntrance && !String(t.id).startsWith('home:')) raw.push({ ...t, source: 'place' });
		for (const t of W.worldSites?.() || []) if (!t.virtual) raw.push({ ...t, source: 'business' });
		const seen = new Set(), result = [];
		const fertile = W.body?.key === 'earth' || ['TERRAN','TROPICAL','FOREST','LUSH'].includes(W.body?.type);
		for (const t of raw.filter(t=>t.id && t.name && Number.isFinite(t.x) && Number.isFinite(t.z) && Math.hypot(t.x-at.x,t.z-at.z)<180)
			.sort((a,b)=>Math.hypot(a.x-at.x,a.z-at.z)-Math.hypot(b.x-at.x,b.z-at.z)).slice(0,16)) {
			const id = siteId(t.id); if (seen.has(id)) continue; seen.add(id);
			const ground = W.island.drawnAt || W.island.heightAt, y = ground.call(W.island,t.x,t.z);
			if (!Number.isFinite(y)) continue;
			const record = { id, siteId:id, name:String(t.name).slice(0,120), world:W.body?.key, status:'surveying', anchor:{x:t.x,y,z:t.z,...positionFor(W,{x:t.x,y,z:t.z})} };
			const priorProject = existing.find(p=>p.siteId === id);
			const allowed = ['path', ...(fertile?['garden']:[]), 'gathering','resonance'];
			const available = priorProject ? allowed.filter(kind=>kind===priorProject.kind) : allowed;
			let spot = null;
			for (const kind of available) {
				spot = priorProject ? communityProjectSpot(W,{...record,kind,anchor:priorProject.anchor},{exact:worldPosition(W,priorProject.anchor)}) : communityProjectSpot(W,{...record,kind});
				if(spot)break;
			}
			if (!spot) continue;
			if(existing.some(p=>p.siteId!==id && (()=>{const a=worldPosition(W,p.anchor);return a&&Math.hypot(a.x-spot.x,a.z-spot.z)<12;})()))continue;
			const anchor = priorProject ? {...priorProject.anchor,x:spot.x,y:spot.y,z:spot.z} : {x:spot.x,y:spot.y,z:spot.z,...positionFor(W,spot)};
			const fits = available.filter(kind=>communityProjectSpot(W,{...record,kind,anchor},{exact:spot}));
			if (!fits.length) continue;
			result.push({id,siteId:id,name:record.name,anchor,kinds:fits,source:t.source,
				...(t.requestId?{requestId:t.requestId}:{}),...(t.npcId?{npcId:t.npcId,npcName:t.npcName||'A resident'}:{})});
			if(result.length>=8) break;
		}
		cache=result; return cache;
	}
	function situation(projects=[]) {
		const W=world(), blockedSites=[]; let hazard=0;
		try { hazard=W?.structures?.cataclysm?.()?1:0; } catch { /* optional system */ }
		const damage=[]; W?.structures?.store?.each?.((id,r)=>{if(r&&(r.c>0||r.m?.length)&&Number.isFinite(r.x)&&Number.isFinite(r.z))damage.push(r);});
		for(const p of projects){const a=worldPosition(W,p.anchor);if(a&&damage.some(d=>Math.hypot(a.x-d.x,a.z-d.z)<18))blockedSites.push(p.siteId);}
		return {hazard,blockedSites};
	}
	return {list,situation};
}
