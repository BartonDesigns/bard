// The Guide: a companion you talk to, by text or by voice. It always knows where you
// are and what is around you (the world describes itself to it each turn), keeps a
// journal of the things there are to find (the vent, the lava tube, the sea caves,
// the whale, the Golden Gate, Alcatraz, Mount Diablo, home...), suggests what to do
// next, answers questions about the places, and can act: take you somewhere, change
// the hour, put you in the air. A conversational model on your own device gives it
// its voice; with no model it still answers from the world itself.

import { createLLM, WEBLLM_MODELS, hasWebGPU, crashedBefore } from './llm.js';
import { buildSocialIntentContext, buildSocialIntentMessages, decodeSocialIntent, offlineSocialIntent } from '../people/social-intent.js';
import { createStoryQuests, questPrompt, fallbackQuest } from './story-quests.js';
import { parseSocialIntent } from '../people/social-state.js';
import { worldPosition } from '../people/social-actors.js';
import { parseGameTime, realSecondsFor, formatClock, formatReal, talksOfMeeting, placePhrases, MEET_TAG_RE, EARLY, GRACE } from '../people/appointments.js';
import { gatherRequest, defaultGatherTime, makeGathering, HOURS as GATHER_HOURS } from '../people/gatherings.js';
import { createDialogueArchive } from './dialogue-archive.js';
import { normalizeDialogueStyle, dialogueTokenLimit, dialogueStylePrompt } from '../people/dialogue-style.js';
import { chooseGuideModel } from './preferences.js';
import { travelRequest, resolveTravel } from './travel.js';
import { loadAtlas, atlasReady, cities, regions } from '../earth/atlas.js';
import { pruneModels } from '../storage.js';
import { DISCOVERY_URL } from '../earth/config.js';
import { PLACES, ZONES } from '../bay/places.js';
import { toWorld } from '../bay/geo.js';
import { personaFor, personaPrompt, personaOffline, bodyFor, TAG_RE } from '../people/persona.js';

// facts the Guide can rely on (a small model should not have to remember them)
const LANDMARKS = [
	['Golden Gate Bridge', 37.8199, -122.4783, 'opened 1937; 1,280 m main span; towers 227 m above the water; painted International Orange'],
	['Ferry Building', 37.7955, -122.3937, 'opened 1898; 75 m clock tower; a food hall and the ferry terminal on the Embarcadero'],
	['San Francisco City Hall', 37.7793, -122.4193, 'finished 1915; its dome rises 94 m, higher than the US Capitol\'s'],
	['Palace of Fine Arts', 37.8029, -122.4484, 'built for the 1915 Panama-Pacific Exposition; a rotunda by a lagoon'],
	['Alcatraz Island', 37.8267, -122.4230, 'federal prison 1934-1963; the first lighthouse on the West Coast (1854)'],
	['Coit Tower', 37.8024, -122.4058, '1933, 64 m, on Telegraph Hill; murals inside'],
	['Transamerica Pyramid', 37.7952, -122.4028, '1972, 260 m'],
	['Salesforce Tower', 37.7898, -122.3969, '2018, 326 m, the tallest building in San Francisco'],
	['Sutro Tower', 37.7552, -122.4528, '1973, 298 m broadcast mast on Mount Sutro'],
	['Fort Point', 37.8106, -122.4771, 'brick fort of 1861 under the bridge\'s south end'],
	['Oracle Park', 37.7786, -122.3893, 'the Giants\' ballpark on McCovey Cove, 2000'],
	['Twin Peaks', 37.7544, -122.4477, 'about 280 m, the view over the whole city'],
	['Bay Bridge', 37.7983, -122.3778, 'opened 1936; San Francisco to Oakland by way of Yerba Buena Island'],
	['Oakland City Hall', 37.8053, -122.2724, '1914, 98 m'],
	['Port of Oakland', 37.8000, -122.3200, 'container cranes along the Outer and Middle Harbors'],
	['Sather Tower', 37.8721, -122.2578, 'the Campanile at UC Berkeley, 1914, 94 m'],
	['Hoover Tower', 37.4275, -122.1668, 'Stanford University, 1941, 87 m'],
	['Hangar One', 37.4155, -122.0496, '1933, built for the airship USS Macon at Moffett Field; 345 m long'],
	['Levi\'s Stadium', 37.4033, -121.9694, 'home of the San Francisco 49ers, Santa Clara'],
	['Mount Diablo', 37.8816, -121.9142, 'summit 1,173 m; on a clear day you see the Sierra Nevada'],
	['Mount Tamalpais', 37.9235, -122.5965, '784 m, over Marin and the Golden Gate'],
	['Lick Observatory', 37.3414, -121.6429, 'on Mount Hamilton, 1888'],
	['Bishop Ranch', 37.7700, -121.9650, 'San Ramon\'s business park beside I-680'],
	['City Center Bishop Ranch', 37.7672, -121.9600, 'San Ramon\'s downtown: shops and a plaza under a long canopy'],
	['San Ramon Central Park', 37.7650, -121.9522, 'lawns, the community center and the library'],
	['Iron Horse Trail', 37.7687, -121.9640, 'the old Southern Pacific line, now a trail through the San Ramon Valley'],
	['Lake Chabot', 37.7246, -122.1066, 'reservoir of 1875 in the hills above Castro Valley, ringed by a regional park'],
	['Saint Mary\'s College', 37.8405, -122.1094, 'Mission-style campus of 1928 in the Moraga valley'],
	['Rosie the Riveter Memorial', 37.9100, -122.3540, 'Richmond\'s Marina Bay, where Kaiser\'s shipyards built 747 ships in the Second World War'],
	['Mission Santa Clara', 37.3491, -121.9420, 'mission church at the heart of Santa Clara University'],
	['Hamilton Field', 38.0585, -122.5133, 'the old Army airfield at Novato, its Spanish-style hangars now homes and offices'],
];

// the things there are to find: [id, title, how the world knows you did it]
const QUESTS = [
	['shell', 'Pick up a shell on the beach', 'the village'],
	['summit', 'Climb to the top of the island', 'the island peak'],
	['dive', 'Dive the reef in the bay', 'the reef'],
	['vent', 'Find the volcanic vent in the heart of the bay', 'the volcanic vent'],
	['tube', 'Swim through the lava tube', 'the lava tube'],
	['cave', 'Swim through a sea cave', 'sea cave 1'],
	['whale', 'Get close to the humpback whale', 'the whale'],
	['boat', 'Take the village boat out', 'the village'],
	['night', 'See the Milky Way at night'],
	['gate', 'Cross the Golden Gate Bridge', 'Golden Gate Bridge'],
	['alcatraz', 'Stand on Alcatraz', 'Alcatraz Island'],
	['sf', 'Reach downtown San Francisco', 'Ferry Building'],
	['diablo', 'Stand on the summit of Mount Diablo', 'Mount Diablo'],
	['home', 'Go home', 'home'],
	['beyond', 'Cross the dark star’s horizon'],
	['chord', 'Gather the seven held voices beyond the horizon'],
];

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const dirTo = (dx, dz) => COMPASS[Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360) / 45) % 8];
const fmtDist = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export function createGuide(mount, api) {
	// api: { world(), camera, shared, hint(text) }
	const llm = createLLM();
	// The atlas is intentionally lazy, but starting its small data module here means a
	// global request can become a real destination while the player is still talking.
	loadAtlas().catch(() => {});
	const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: nothing persists */ } } };
	const journal = store.get('crysis-journal', {});
	const archive = createDialogueArchive();
	let dialogueStyle = normalizeDialogueStyle(store.get('crysis-dialogue-style', {}));
	let view = 'guide', viewEpoch = 0;
	const guideMeta = {id:'guide',name:'The Guide',kind:'guide',bodyKey:''};
	function threadMeta(P) { return {id:P.id || P.threadId,name:P.persona.name,bodyKey:api.social?.bodyKey() || '',kind:'npc'}; }
	function archiveTurn(meta,role,text) { archive.append(meta,role,text); }
	function importConversations() { for(const r of api.social?.state.list() || []) archive.importHistory({id:r.id,name:r.persona.name,bodyKey:r.bodyKey,kind:'npc'},r.history); }
	function resetView(next) { busy?.abort(); viewEpoch++; view=next; log.replaceChildren(); input.value=''; settings.style.display='none'; log.style.display='flex'; tabs.style.display='flex'; archiveControls.style.display='none'; bar.style.display='flex'; }
	function renderGuide() { resetView('guide'); for(const t of archive.thread('guide')?.turns.slice(-30) || []) say(t.content,t.role==='user'?'me':'guide'); }

	// ---------- where things are ----------
	function targets() {
		const W = api.world(), out = [];
		if (W?.body?.earth || W?.bayArea || W?.globe) for (const [n, lat, lon, fact] of LANDMARKS) out.push({ name: n, ...toWorld(lat, lon), fact, kind: 'landmark' });
		if (W?.body?.earth || W?.bayArea || W?.globe) for (const z of ZONES) out.push({ name: z[0], ...toWorld(z[1], z[2]), fact: z[3], kind: 'area' });
		if (W?.body?.earth || W?.bayArea || W?.globe) for (const p of PLACES) out.push({ name: p[0], ...toWorld(p[1], p[2]), fact: p[3], kind: p[5] ? 'neighbourhood' : 'town' });
		if (W) {
			const I = W.island, B = I.village.bay;
			out.push({ name: 'the village', x: I.village.x, z: I.village.z, fact: 'the fishing village on the island', kind: 'island' });
			out.push({ name: 'the island peak', x: I.peak.x, z: I.peak.z, fact: `the island's summit, ${Math.round(I.peak.h)} m`, kind: 'island' });
			if (B) out.push({ name: 'the reef', x: B.x + B.r * 0.5, z: B.z, fact: 'coral heads on the rim of the drowned crater', kind: 'island', under: true });
			if (B) out.push({ name: 'the volcanic vent', x: B.x, z: B.z, fact: 'a live vent erupting embers in the heart of the drowned crater', kind: 'island', under: true });
			if (W.magma?.tube) { const t = W.magma.tube[Math.floor(W.magma.tube.length / 2)]; out.push({ name: 'the lava tube', x: t.x, z: t.z, y: t.y + 1.5, fact: 'a rock tunnel carrying a molten stream from the vent', kind: 'island', under: true }); }
			(W.caverns?.tunnels || []).forEach((t, i) => { const m = t[Math.floor(t.length / 2)]; out.push({ name: `sea cave ${i + 1}`, x: t[0].x, z: t[0].z, y: t[0].y + 2, fact: 'a swim-through lava cave with glowing walls', kind: 'island', under: true, mid: m }); });
			(W.underworld?.entrances || []).forEach((e, i) => out.push({ ...e, caveEntrance: i, kind: 'island', fact: 'a walkable hillside mouth into this world’s connected underground; walk down the tunnel and return by the same route' }));
			// (reached through the caves: the way there is the mouth nearest it, then the passage on)
			const dg = W.deep?.gate, dv = dg?.via;
			if (dg) out.push({ name: 'The Deep Gate', x: dv ? dv.x : dg.x, z: dv ? dv.z : dg.z, y: dv?.y, kind: 'island', fact: `a carved hall at the far end of the caves beneath the summit, ${Math.round(Math.hypot(dg.x - (dv?.x ?? dg.x), dg.z - (dv?.z ?? dg.z)))} m on underground from ${dv ? dv.name : 'the nearest cave mouth'}: go in at the mouth and keep to the passage that runs on toward the summit. Five singing stones stand round a sealed shaft; play back their phrase and a rope goes down into a cave with no known bottom` });
			if (W.whale?.whale?.position) out.push({ name: 'the whale', x: W.whale.whale.position.x, z: W.whale.whale.position.z, fact: 'a humpback in the bay', kind: 'island' });
			// an off-world colony's sites (planet/colony/)
			for (const s of W.colony?.sites?.() || []) out.push({ name: s.name, x: s.x, z: s.z, y: s.y, fact: s.far ? 'an outpost of the colony, out along the rover tracks' : 'part of the colony', kind: 'colony' });
			const home = store.get('crysis-home', null);
			if (home) out.push({ name: home.name || 'home', ...toWorld(home.lat, home.lon), fact: 'your home', kind: 'home' });
		}
		return out;
	}
	function find(name) {
		const q = norm(name).replace(/^(the|to) /, '');
		if (!q) return null;
		const all = targets();
		if (/^(?:cave|caves|nearest cave|cave entrance)$/.test(q)) return all.filter(t => t.caveEntrance !== undefined).sort((a,b) => Math.hypot(a.x-api.camera.position.x,a.z-api.camera.position.z)-Math.hypot(b.x-api.camera.position.x,b.z-api.camera.position.z))[0] || null;
		let best = null, score = 0;
		for (const t of all) {
			const n = norm(t.name).replace(/^the /, '');
			let s = n === q ? 100 : n.startsWith(q) ? 60 : n.includes(q) ? 40 : q.includes(n) && n.length > 3 ? 30 : 0;
			if (s && t.kind === 'landmark') s += 5;
			if (s > score) { score = s; best = t; }
		}
		if (best) return best;
		const resolved = resolveTravel(name, { cities: atlasReady() ? cities() : [], regions: atlasReady() ? regions() : [], local: all });
		if (resolved.kind !== 'destination' || !resolved.place) return null;
		const p = resolved.place;
		return Number.isFinite(p.lat) && Number.isFinite(p.lon)
			? { ...p, kind: 'global', global: true, broad: !!resolved.broad, region: resolved.region || p.regionName || p.country }
			: p;
	}

	// ---------- the world, described ----------
	function snapshot() {
		const W = api.world(), cam = api.camera.position;
		if (!W) return null;
		const onIsland = Math.max(Math.abs(cam.x), Math.abs(cam.z)) < W.island.half;
		const g = W.island.heightAt(cam.x, cam.z);
		const where = W.labels?.where(cam.x, cam.z, cam.y, onIsland);
		const P = W.player.state, hours = W.sky.state.hours;
		const near = targets().filter((t) => t.kind !== 'neighbourhood').map((t) => ({ ...t, d: Math.hypot(t.x - cam.x, t.z - cam.z) })).sort((a, b) => a.d - b.d).slice(0, 6);
		const arms = api.arms?.snapshot?.(cam);
		return {
			place: (W.underworld?.inside() || 0) > .35 ? 'the connected caves beneath '+(api.shared.planet?.name || 'this world') : onIsland ? (W.bayArea || W.globe ? 'the island (in the Gulf of the Farallones, 25 km west of the Golden Gate)' : api.shared.planet?.name || 'the island') : where ? `${where.name} (${where.sub})` : 'the open world',
			onIsland, underwater: cam.y < 0 && g < 0, depth: Math.max(0, -cam.y), height: Math.round(cam.y - Math.max(g, 0)), flying: !!P.flying, diving: !!P.diving, boat: !!W.boat?.boarded?.(),
			time: `${Math.floor(hours)}:${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}`, night: hours < 6 || hours > 19.5, wind: +(api.shared.uWind.value).toFixed(2),
			facing: dirTo(-Math.sin(P.yaw), -Math.cos(P.yaw)),
			near: near.map((t) => ({ name: t.name, dist: fmtDist(t.d), dir: dirTo(t.x - cam.x, t.z - cam.z), fact: t.fact })),
			done: QUESTS.filter((q) => journal[q[0]]).map((q) => q[1]), todo: [...quests.filter((q) => !q.done).map((q) => q.title), ...QUESTS.filter((q) => !journal[q[0]] && (q[0] !== 'home' || store.get('crysis-home', null))).map((q) => q[1])],
			land: W.land?.profile?.thesis, sea: W.eco?.profile?.thesis,
			arms: arms ? { inventory: arms.inventory, nearby: arms.nearby } : null,
		};
	}

	// ---------- quests people give you, and the places you discover ----------
	const quests = store.get('crysis-quests', []);
	const found = store.get('crysis-places', {});
	const savedCaveVisits = store.get('crysis-cave-visits-v1', {});
	const caveVisits = savedCaveVisits && typeof savedCaveVisits === 'object' && !Array.isArray(savedCaveVisits) ? savedCaveVisits : {};
	const QUEST_RE = /\[\[\s*quest\s*:\s*([^\]]+)\]\]/gi;
	function giveQuest(placeName, from) {
		const t = find(placeName);
		if (!t || quests.some((q) => !q.done && q.place === t.name)) return null;
		const q = { place: t.name, from, x: t.x, z: t.z, title: `Visit ${t.name}${from ? ` (${from}'s tip)` : ''}`, at: Date.now() };
		quests.push(q); while (quests.length > 30) quests.shift();
		store.set('crysis-quests', quests);
		api.hint('Journal: ' + q.title, 3500);
		return q;
	}
	// Models propose intentions and stories; saved game state decides what can happen.
	const stories = createStoryQuests();
	function residentKey(id) {
		let hash = 14695981039346656037n;
		for (const c of id) hash = BigInt.asUintN(64, (hash ^ BigInt(c.charCodeAt(0))) * 1099511628211n);
		return 'person-' + hash.toString(36);
	}
	function storyContext(resident = null) {
		const W = api.world(), S = api.social, bodyKey = S?.bodyKey() || '';
		if (!W || !bodyKey) return { bodyKey, targets: [], npcs: [] };
		const cam = api.camera.position;
		const places = targets().filter(t => !t.under && t.name !== 'the whale' && (t.kind === 'island' || W.globe || W.bayArea?.loaded()))
			.map(t => ({ ...t, id: 'place-' + norm(t.name).replace(/ /g, '-'), bodyKey, y: t.caveEntrance !== undefined ? t.y : W.player.floorAt(t.x,t.z,W.island.heightAt(t.x,t.z)), radius: t.caveEntrance !== undefined ? 6 : 14 }))
			.filter(t => Number.isFinite(t.y) && t.y >= .3 && Math.hypot(t.x-cam.x,t.z-cam.z) < 5000)
			.sort((a,b) => Math.hypot(a.x-cam.x,a.z-cam.z)-Math.hypot(b.x-cam.x,b.z-cam.z)).slice(0,10);
		const residents = S.state.list(bodyKey);
		const npcs = residents.map(r => ({ id: residentKey(r.id), name: r.persona.name, bodyKey }));
		for (const r of residents) {
			const home = worldPosition(W, r.home);
			if (home) places.push({id:'home:'+residentKey(r.id), name:r.persona.first+"'s meeting place", ...home, bodyKey, radius:8, fact:'the place where you first met '+r.persona.name});
		}
		if (resident) { const actor=S.actors.all().find(p=>p.residentId===resident.id); if(actor) for(const t of places) t.scoutable=Math.hypot(t.x-actor.M.S.pos.x,t.z-actor.M.S.pos.z)<=180 && S.scoutNearby(actor,[t])?.id===t.id; }
		const context = stories.context({ bodyKey, targets: places, npcs });
		return { ...context, speaker: resident ? residentKey(resident.id) : null, persona: resident ? {name:resident.persona.name,job:resident.persona.job,hobby:resident.persona.hobby} : null };
	}
	function questNotice(result) {
		if (result?.ok === false) return result.error || 'That quest cannot be changed right now.';
		return stories.status().error ? 'Updated for this session, but this browser could not save your quest progress.' : null;
	}
	async function planChat(messages, signal, planning) {
		if (llm.kind() === 'none' || !llm.status.ready || !llm.supportsPlanning?.(planning.kind)) return null;
		const request = new AbortController(), abort = () => request.abort();
		signal?.addEventListener('abort', abort, {once:true});
		const timer = setTimeout(abort, 15000);
		try { const reply=await llm.chat(messages, () => {}, request.signal, {json:true,temperature:planning.kind==='story_quest'?.7:.1,maxTokens:480,planning,npc:partner?npcFor(partner.persona,snapshot()):null}); return request.signal.aborted?null:reply; }
		catch { return null; }
		finally { clearTimeout(timer); signal?.removeEventListener('abort',abort); }
	}
	function questChanged(q, announce=true) {
		if (announce) api.hint(q.status==='complete'?`Quest complete: ${q.title}`:`Quest updated: ${q.title}`,3500);
		if (q.status!=='complete') return;
		const resident=api.social?.state.list(q.bodyKey).find(r=>residentKey(r.id)===q.offeredBy);
		if (!resident || resident.storyCompletions?.includes(q.id)) return;
		resident.storyCompletions=[...(resident.storyCompletions || []),q.id].slice(-64);
		api.social.state.remember(resident.id,'event',`You and the traveller completed "${q.title}" together. ${q.premise}`);
	}
	function storySummary(q) {
		const context = storyContext(), label = step => context.targets.find(t=>t.id===step.targetId)?.name || context.npcs.find(n=>n.id===step.npcId)?.name || 'the marked place';
		return `${q.title}\n${q.premise}\n` + q.steps.map((s,i)=>`${i+1}. ${s.type==='talk'?'Speak to':s.type==='scout'?'Ask someone to scout':s.type==='return'?'Return to':'Explore'} ${label(s)}`).join('\n');
	}
	async function offerStory(resident, text, signal) {
		const context = storyContext(resident);
		const compact={...context,targets:[...context.targets.filter(t=>!t.id.startsWith('home:')).slice(0,5),...context.targets.filter(t=>t.id==='home:'+residentKey(resident.id))],npcs:context.npcs.filter(n=>n.id===residentKey(resident.id)),previous:context.previous.slice(-2).map(q=>({title:q.title,status:q.status,steps:q.steps.map(s=>({type:s.type,targetId:s.targetId,npcId:s.npcId}))})),request:text.slice(0,300)};
		const raw = await planChat([{role:'system',content:questPrompt(compact)},{role:'user',content:text}],signal,{kind:'story_quest',context:compact});
		if (signal.aborted || !partner || partner.id!==resident.id || api.social.bodyKey()!==context.bodyKey) return null;
		let proposed = raw && stories.propose(raw,context);
		if (!proposed?.ok) proposed = stories.propose(fallbackQuest(context,{npcId:residentKey(resident.id),position:api.camera.position,persona:resident.persona}),context);
		if (!proposed.ok) return 'I do not have a reachable quest here yet. Let us meet near a village or another landmark.';
		const q = proposed.quest;
		return `${storySummary(q)}\nInterested? Say “I’m in”, or open Quests to accept or decline.${questNotice(proposed) ? '\n'+questNotice(proposed) : ''}`;
	}
	function storyReply(text) {
		const bodyKey = api.social.bodyKey(), qs=stories.list(bodyKey), offered=qs.filter(q=>q.status==='offered' && (!q.offeredBy || q.offeredBy===residentKey(partner?.id || ''))).at(-1);
		if (/^(?:yes[,.! ]*)?(?:i['’]?m in|i am in|let['’]?s do it|sounds good|i accept|accept(?: the quest)?|sign me up)[.! ]*$/i.test(text.trim()) && offered) {
			const result=stories.accept(offered.id,bodyKey); return questNotice(result) || `Agreed. ${offered.title} is in your Quests journal. Your first objective is ready.`;
		}
		if (/^(?:no thanks|decline(?: the quest)?|not now)[.! ]*$/i.test(text.trim()) && offered) { stories.cancel(offered.id,bodyKey); return 'No problem. We can find a different adventure another time.'; }
		if (/^(?:quest status|my quests|what(?:’s|'s| is) (?:my|the) next (?:step|objective)|how is my quest going)[?! .]*$/i.test(text.trim())) {
			const active=qs.find(q=>q.status==='active'); return active ? storySummary(active) : 'You have no active story quest. Ask me for an adventure.';
		}
		return null;
	}

	// ---------- meetings: an arrangement made in conversation is kept by the game ----------
	// A resident never agrees to meet in words alone. A named place and time become a saved
	// appointment (journal, pin, the resident walking there); anything vaguer is said to be
	// unsettled, so no promise is left hanging.
	const book = () => api.social?.appointments;
	let meetDraft = null, tracked = null;
	const cap = t => t ? t[0].toUpperCase() + t.slice(1) : t;
	const AFFIRM = /^(?:yes|yeah|yep|yup|sure|ok(?:ay)?|deal|sounds good|sounds great|perfect|great|it'?s a date|see you (?:then|there)|i'?ll be there|count me in|definitely|absolutely|works for me)\b/i;
	const REFUSE = /^(?:no|nah|nope|can'?t|cannot|not (?:then|today|tonight)|maybe another time|another time|sorry)\b/i;
	function meetPlace(phrases, p, resident) {
		const W = api.world(); if (!W || !p) return null;
		const at = (x, z, name, radius = 12) => { const y = W.player.floorAt?.(x, z, W.island.heightAt(x, z)) ?? W.island.heightAt(x, z); return Number.isFinite(y) && y > 0.2 ? { name, x, y, z, radius, pos: api.social.positionFor(W, { x, y, z }) } : null; };
		for (const ph of phrases) {
			if (ph === 'here') { const near = snapshot()?.near?.[0]?.name; return at(p.M.S.pos.x, p.M.S.pos.z, near ? `this spot near ${near}` : 'this spot', 10); }
			if (ph === 'npc-home') { const h = worldPosition(W, resident?.home); if (h) return at(h.x, h.z, `${resident.persona.first}'s place`, 10); continue; }
			const t = find(ph);
			if (t && !t.under && Math.hypot(t.x - p.M.S.pos.x, t.z - p.M.S.pos.z) < 8000) return at(t.x, t.z, t.name, t.caveEntrance !== undefined ? 6 : 14);
		}
		return null;
	}
	function meetWhen(a) {
		const B = book(), S = api.world()?.sky?.state; if (!B || !S) return '';
		const now = B.clock(S.hours), day = Math.floor(a.due / 24) - Math.floor(now / 24);
		const real = formatReal(realSecondsFor(a.due - now, S.hours, S));
		return `${formatClock(a.due % 24)} ${day <= 0 ? 'today' : day === 1 ? 'tomorrow' : `in ${day} days`}${a.due > now ? ` (${real} from now)` : ''}`;
	}
	function meetMake(resident, p, { place, time, by }) {
		const W = api.world(), B = book();
		if (!W || !B || !place || !time) return null;
		if ((resident.dna?.age ?? resident.persona?.age ?? 18) < 18) return { error: "[[mood: thoughtful]] I'd have to ask my parents first. Maybe we just hang out around here?" };
		const r = B.make({ bodyKey: resident.bodyKey, npcId: resident.id, npcName: resident.persona.name, place, hours: W.sky.state.hours, delta: time.delta, by });
		if (!r.ok) return { error: r.error };
		const a = r.appointment;
		if (a.status === 'agreed') { api.social.state.remember(resident.id, 'event', `You agreed to meet the traveller at ${a.place.name} at ${formatClock(a.due % 24)}.`); tracked = a.id; }
		return { appointment: a };
	}
	function meetNote(a) {
		if (a.gathering) return `📍 Added to Quests: ${gatherTitle(a)} · ${meetWhen(a).replace(/ \((.*)\)$/, ' · $1')}. A pin marks the place.`;
		return a.status === 'agreed'
			? `📍 Added to Quests: meet ${a.npcName.split(' ')[0]} at ${a.place.name}, ${meetWhen(a)}. A pin marks the place.`
			: `${a.npcName.split(' ')[0]} suggests ${a.place.name}, ${meetWhen(a)}. Say yes to put it in your Quests, or no.`;
	}
	// ---------- gatherings: "gather people for a concert at the park" ----------
	// The resident agrees and the game makes it real: a saved gathering (journal, pin) that
	// the resident and a crowd of townsfolk attend at the time, with or without the player.
	const gatherTitle = a => `${a.gathering.title} at ${a.place.name}`;
	function gatheringReply(text, resident, p) {
		const B = book(), W = api.world(); if (!B || !W || !resident) return null;
		const ask = gatherRequest(text); if (!ask) return null;
		if ((resident.dna?.age ?? resident.persona?.age ?? 18) < 18) return { reply: "[[mood: thoughtful]] I'm too young to organise that. Ask one of the grown-ups." };
		const hours = W.sky.state.hours, phrases = placePhrases(text);
		const place = meetPlace(phrases, p, resident) || meetPlace(['here'], p, resident);
		if (!place) return { reply: '[[mood: thoughtful]] Where should we hold it? Name a place nearby.' };
		const time = parseGameTime(text, hours, W.sky.state.sun) || defaultGatherTime(hours);
		const seed = (Math.floor(Math.random() * 1e9) ^ resident.id.length * 7919) >>> 0;
		const gathering = makeGathering({ kind: ask.kind, placeName: place.name, phone: !!api.social.isPhone, seed });
		const r = B.make({ bodyKey: resident.bodyKey, npcId: resident.id, npcName: resident.persona.name, place, hours, delta: time.delta, by: 'player', gathering });
		if (!r.ok) return { reply: `[[mood: sad]] ${r.error}` };
		const a = r.appointment, what = `${a.gathering.title.toLowerCase()} at ${a.place.name}`;
		api.social.state.remember(resident.id, 'event', `The traveller asked you to gather people for a ${what} at ${formatClock(a.due % 24)}. You agreed to organise it.`);
		tracked = a.id;
		const unknown = phrases.length && !phrases.includes('here') && /^this spot/.test(place.name) ? `I don't know ${phrases[0]}, so let's hold it here. ` : '';
		return { reply: `[[mood: happy]] [[gesture: nod]] ${unknown}A ${what}? Yes! I'll round people up. ${formatClock(a.due % 24)}, be there.`, note: meetNote(a) };
	}
	// After a gathering the organiser tells the player how it went, once.
	function gatheringRecap(resident) {
		const B = book(); if (!B || !resident) return null;
		const a = B.list(resident.bodyKey).filter(x => x.gathering && x.npcId === resident.id && !x.mentioned && (x.status === 'kept' || x.status === 'missed')).at(-1);
		if (!a) return null;
		B.mention(a.id);
		const what = `${a.gathering.title.toLowerCase()} at ${a.place.name}`;
		return a.status === 'kept' ? `[[mood: happy]] Thanks for coming to the ${what}. People are still talking about it.`
			: `[[mood: sad]] We held the ${what} without you. A shame you missed it; it was a good one.`;
	}
	// What the player said: agreeing to a suggestion, or arranging a meeting themselves.
	function meetingReply(text, resident, p) {
		const B = book(), W = api.world(); if (!B || !W || !resident) return null;
		const t = text.trim(), sun = W.sky.state.sun;
		const pending = B.pendingFrom(resident.id, resident.bodyKey);
		if (pending && AFFIRM.test(t) && !talksOfMeeting(t.replace(AFFIRM, ''))) {
			const r = B.agree(pending.id); if (!r.ok) return null;
			api.social.state.remember(resident.id, 'event', `You agreed to meet the traveller at ${pending.place.name} at ${formatClock(pending.due % 24)}.`); tracked = pending.id;
			return { reply: `[[mood: happy]] [[gesture: nod]] Great. ${cap(pending.place.name)}, ${formatClock(pending.due % 24)}. I'll be there.`, note: meetNote(r.appointment) };
		}
		if (pending && REFUSE.test(t)) { B.cancel(pending.id); return { reply: '[[mood: calm]] [[gesture: shrug]] No worries. Another time.' }; }
		const agreed = B.agreedWith(resident.id, resident.bodyKey);
		if (agreed && /\b(when|where|what time)\b.*\b(meet|meeting|see you|concert|party|picnic|meet-?up|gathering)\b/i.test(t)) return { reply: `[[mood: calm]] ${cap(agreed.place.name)}, ${formatClock(agreed.due % 24)}. Don't be late.`, note: `Meeting: ${meetWhen(agreed)}.` };
		if (agreed && /\b(cancel|call off|can'?t make)\b.*\b(meet|meeting|it|plans?|concert|party|picnic|meet-?up|gathering)\b/i.test(t)) { B.cancel(agreed.id); api.social.state.remember(resident.id, 'event', `The traveller called off your meeting at ${agreed.place.name}.`); return { reply: '[[mood: sad]] Oh, okay. Some other time then.', note: 'Meeting cancelled.' }; }
		const time = parseGameTime(t, W.sky.state.hours, sun);
		// Finishing an arrangement begun a moment ago: "the pier" → "at six".
		if (meetDraft?.residentId === resident.id && performance.now() - meetDraft.at < 120000) {
			const place = meetDraft.place || meetPlace(placePhrases(t), p, resident), when = meetDraft.time || time;
			if (place && when) {
				meetDraft = null;
				const made = meetMake(resident, p, { place, time: when, by: 'player' });
				if (made?.error) return { reply: made.error };
				if (made) return { reply: `[[mood: happy]] [[gesture: nod]] ${cap(place.name)} at ${formatClock(made.appointment.due % 24)}. See you there.`, note: meetNote(made.appointment) };
			}
		}
		if (!talksOfMeeting(t)) return null;
		const place = meetPlace(placePhrases(t), p, resident);
		if (!place && !time) return null; // "let's meet up sometime": the conversation goes on
		if (!time) { meetDraft = { residentId: resident.id, place, at: performance.now() }; return { reply: `[[mood: happy]] Sure, ${place.name}. What time? Something like 6 pm, or sunset.` }; }
		if (!place) {
			meetDraft = { residentId: resident.id, time, at: performance.now() };
			const named = t.match(/\b(sunset|dusk|sunrise|dawn)\b/i)?.[1];
			return { reply: `[[mood: thoughtful]] ${named ? `${named[0].toUpperCase() + named.slice(1).toLowerCase()}, so about ${formatClock(time.hours)}` : formatClock(time.hours)} works. Where? Here, or somewhere you can name?` };
		}
		const made = meetMake(resident, p, { place, time, by: 'player' });
		if (made?.error) return { reply: made.error };
		return made && { reply: `[[mood: happy]] [[gesture: nod]] ${cap(place.name)} at ${formatClock(made.appointment.due % 24)}. I'll be there.`, note: meetNote(made.appointment) };
	}
	// What the resident said: a tagged or plainly worded suggestion becomes a real proposal.
	function meetingFromReply(reply, text, resident, p) {
		const B = book(), W = api.world(); if (!B || !W || !resident) return null;
		const sun = W.sky.state.sun, hours = W.sky.state.hours;
		let place = null, time = null;
		for (const m of reply.matchAll(MEET_TAG_RE)) { place = meetPlace([...placePhrases('at ' + m[1], 'npc'), m[1]], p, resident); time = parseGameTime('at ' + m[2], hours, sun) || parseGameTime(m[2], hours, sun); if (place && time) break; }
		const spoken = reply.replace(MEET_TAG_RE, '').replace(TAG_RE, '');
		if (!(place && time) && talksOfMeeting(spoken)) {
			time = time || parseGameTime(spoken, hours, sun) || parseGameTime(text, hours, sun);
			place = place || meetPlace(placePhrases(spoken, 'npc'), p, resident) || meetPlace(placePhrases(text), p, resident);
			if (time && !place) place = meetPlace(['here'], p, resident);
		}
		if (place && time) {
			// The player asked to meet and the resident named the place and time: that is agreement.
			const made = meetMake(resident, p, { place, time, by: talksOfMeeting(text) ? 'player' : 'npc' });
			return made?.appointment ? meetNote(made.appointment) : null;
		}
		if (talksOfMeeting(spoken) && !B.agreedWith(resident.id, resident.bodyKey)) return `Nothing is settled yet. Agree a place and a time with ${resident.persona.first} to put it in your Quests.`;
		return null;
	}
	// The journal's marker: the meeting you are tracking, else the soonest, else a quest's next place.
	function waypointMark() {
		const W = api.world(), S = W?.sky?.state, B = book(), key = api.social?.bodyKey();
		if (!W || !S || !key) return null;
		const open = (B?.list(key) || []).filter(a => a.status === 'agreed').sort((a, b) => a.due - b.due);
		const a = open.find(x => x.id === tracked) || open[0];
		if (a) {
			const q = worldPosition(W, a.place.pos); if (!q) return null;
			const now = B.clock(S.hours), late = now > a.due + EARLY;
			if (a.gathering) return { x: q.x, y: W.player.floorAt?.(q.x, q.z, W.island.heightAt(q.x, q.z)) ?? q.y, z: q.z, radius: a.place.radius, title: `${a.gathering.title} · ${a.place.name}`, detail: now > a.due ? `on now, until ${formatClock((a.due + GATHER_HOURS) % 24)}` : meetWhen(a) };
			return { x: q.x, y: W.player.floorAt?.(q.x, q.z, W.island.heightAt(q.x, q.z)) ?? q.y, z: q.z, radius: a.place.radius, title: `Meet ${a.npcName.split(' ')[0]} · ${a.place.name}`, detail: late ? `waiting for you until ${formatClock((a.due + GRACE) % 24)}` : meetWhen(a) };
		}
		// a world's own errands (planet/colony/errands.js)
		const own = W.colony?.crew?.mark?.();
		if (own) return own;
		const quest = stories.list(key).find(q => q.status === 'active' && ['visit', 'return'].includes(q.steps[q.cursor]?.type));
		if (quest) {
			const t = storyContext().targets.find(t => t.id === quest.steps[quest.cursor].targetId);
			if (t) return { x: t.x, y: t.y, z: t.z, radius: t.radius, title: `${quest.steps[quest.cursor].type === 'return' ? 'Return to' : 'Explore'} ${t.name}`, detail: quest.title };
		}
		return null;
	}

	let noteBusy = false, lastNote = 0;
	async function discover(name, sub) {
		if (!name || found[name]) return;
		found[name] = Date.now(); store.set('crysis-places', found);
		const t = find(name), now = performance.now();
		let note = t?.fact ? `${name}: ${t.fact}.` : null;
		// a field note in the guide's own words, when the model is free
		if (llm.kind() !== 'none' && llm.status.ready && !noteBusy && !busy && now - lastNote > 45000) {
			noteBusy = true; lastNote = now;
			try {
				const r = await llm.chat([{ role: 'system', content: 'You write one-sentence field notes for an explorer\'s journal: vivid, specific, calm, under 25 words. Use only the facts given; if there are none, describe the setting plainly.' }, { role: 'user', content: `Place: ${name} (${sub}). Facts: ${t?.fact || 'none'}. Time: ${snapshot()?.time}.` }], () => {}, null);
				if (r) note = r.replace(/^["\s]+|["\s]+$/g, '');
			} catch { /* the plain fact will do */ }
			noteBusy = false;
		}
		if (note) { if(view==='guide') say('📍 ' + note, 'note'); api.hint('📍 ' + note, 5000); }
	}

	// ---------- the journal: noticed as you play ----------
	let tick = 0, lastPlace = '';
	function watch(dt) {
		tick += dt;
		if (tick < 1) return;
		tick = 0;
		const W = api.world(); if (!W) return;
		const cam = api.camera.position, P = W.player.state, g = W.island.heightAt(cam.x, cam.z), hours = W.sky.state.hours;
		api.waypoint?.set(waypointMark());
		const questWorld=storyContext();
		for (const q of stories.list(questWorld.bodyKey)) if(q.status==='complete') questChanged(q,false);
		for (const q of stories.update({bodyKey:questWorld.bodyKey,position:cam,targets:questWorld.targets})) questChanged(q);
		for (const r of api.social?.state.list(questWorld.bodyKey) || []) if (r.task?.status==='completed' && r.task.targetId && Number.isFinite(r.task.completedAt)) {
			for(const q of stories.event({id:r.task.id,type:'scout',bodyKey:questWorld.bodyKey,npcId:residentKey(r.id),targetId:r.task.targetId,taskId:r.task.id,status:'completed',completedAt:r.task.completedAt})) questChanged(q);
		}
		if ((W.underworld?.inside() || 0) > .55 && !P.flying && questWorld.bodyKey && !caveVisits[questWorld.bodyKey]) {
			caveVisits[questWorld.bodyKey] = Date.now();
			const keys = Object.keys(caveVisits); if (keys.length > 128) delete caveVisits[keys[0]];
			store.set('crysis-cave-visits-v1', caveVisits);
			api.hint('Journal: explored this world’s underground. Tap the resonant stones to restore its lights.', 5000);
		}
		const near = (lat, lon, r) => { const p = toWorld(lat, lon); return Math.hypot(cam.x - p.x, cam.z - p.z) < r; };
		const B = W.island.village.bay;
		const hit = (id) => { if (journal[id]) return; journal[id] = Date.now(); store.set('crysis-journal', journal); const q = QUESTS.find((x) => x[0] === id); api.hint('Journal: ' + q[1] + ' ✓', 3500); say(`${q[1]}: done.`, 'note'); };
		if (W.shells?.holding?.()) hit('shell');
		if (cam.y > W.island.peak.h * 0.92 && Math.hypot(cam.x - W.island.peak.x, cam.z - W.island.peak.z) < 60 && !P.flying) hit('summit');
		if (B && cam.y < -2 && Math.hypot(cam.x - B.x, cam.z - B.z) < B.r) hit('dive');
		if (B && cam.y < -1 && Math.hypot(cam.x - B.x, cam.z - B.z) < 30) hit('vent');
		if (W.magma?.tube?.some((t, i) => i > 4 && i < W.magma.tube.length - 4 && Math.hypot(cam.x - t.x, cam.z - t.z) < 3 && Math.abs(cam.y - t.y - 1.5) < 3)) hit('tube');
		if ((W.caverns?.tunnels || []).some((t) => t.some((q, i) => i > 3 && i < t.length - 4 && Math.hypot(cam.x - q.x, cam.z - q.z) < 3 && cam.y < 0))) hit('cave');
		if (W.whale?.whale?.position && Math.hypot(cam.x - W.whale.whale.position.x, cam.z - W.whale.whale.position.z) < 60) hit('whale');
		if (W.boat?.boarded?.()) hit('boat');
		{ const BY = W.beyond?.state(); if (BY?.found) hit('beyond'); if (BY?.chord) hit('chord'); }
		if ((hours < 5 || hours > 20.5) && cam.y > -0.5 && P.pitch > 0.5) hit('night');
		if (W.bridge && W.bridge.deckFloor(cam.x, cam.z, cam.y) > -Infinity && !P.flying) hit('gate');
		if (near(37.8267, -122.4230, 350) && g > 1 && cam.y - g < 5) hit('alcatraz');
		if (near(37.7925, -122.3990, 700) && cam.y - g < 60) hit('sf');
		if (near(37.8816, -121.9142, 150) && cam.y - g < 8) hit('diablo');
		const home = store.get('crysis-home', null);
		if (home && near(home.lat, home.lon, 40) && cam.y - g < 10) hit('home');
		// people's tips: done when you get there
		for (const q of quests) {
			if (q.done || Math.hypot(cam.x - q.x, cam.z - q.z) > 140 || cam.y - Math.max(g, 0) > 80) continue;
			q.done = Date.now(); store.set('crysis-quests', quests);
			api.hint(`Journal: ${q.title} ✓`, 3500); say(`${q.title}: done.`, 'note');
		}
		// a place you have not been before
		const onIsland = Math.max(Math.abs(cam.x), Math.abs(cam.z)) < W.island.half;
		const w = W.labels?.where(cam.x, cam.z, cam.y, onIsland);
		if (w && w.name !== lastPlace) { lastPlace = w.name; discover(w.name, w.sub); }
	}

	// ---------- acting in the world ----------
	function goTo(t) {
		const W = api.world(), P = W.player.state;
		if (t.global && Number.isFinite(t.lat) && Number.isFinite(t.lon)) {
			const result = api.goTo?.(t.lat, t.lon, t.broad ? 1200 : 700);
			return typeof result === 'string' && /Earth only|not ready/i.test(result) ? result : null;
		}
		if (!W.bayArea?.loaded() && Math.max(Math.abs(t.x), Math.abs(t.z)) > W.island.half) return 'The Bay Area is still loading. Ask again in a moment.';
		const g = W.island.heightAt(t.x, t.z);
		if (t.under) { P.flying = false; P.diving = true; P.pos.set(t.x - 6, t.y ?? Math.max(g + 2, -6), t.z - 6); }
		else { P.flying = true; P.diving = false; const up = t.kind === 'town' ? 220 : t.kind === 'area' ? 160 : t.kind === 'landmark' ? 150 : 80; P.pos.set(t.x - up * 0.6, Math.max(g, 0) + up, t.z + up * 0.6); }
		P.yaw = Math.atan2(-(t.x - P.pos.x), -(t.z - P.pos.z)); P.pitch = t.under ? 0 : -0.35;
		P.vel?.set?.(0, 0, 0);
		return null;
	}
	function act(cmd, arg) {
		const W = api.world(); if (!W) return;
		cmd = cmd.toLowerCase();
		if (cmd === 'arms' || cmd === 'weapon' || cmd === 'purchase' || cmd === 'secure' || cmd === 'hunt') {
			const request = cmd === 'arms' || cmd === 'weapon' ? arg : `${cmd} ${arg || ''}`;
			const result = api.arms?.command?.(request, { position: api.camera.position });
			return result?.kind && result.kind !== 'none' ? result.message : null;
		}
		if (cmd === 'go' || cmd === 'goto') { const t = find(arg); if (!t) return `I could not find "${arg}".`; return goTo(t) || `→ ${t.name}`; }
		if (cmd === 'time') { const h = parseFloat(arg); if (Number.isFinite(h)) { W.sky.state.hours = ((h % 24) + 24) % 24; return `→ ${Math.floor(W.sky.state.hours)}:00`; } }
		if (cmd === 'fly') { W.player.state.flying = !/off|land|no/.test(arg || ''); return W.player.state.flying ? '→ flying' : '→ landing'; }
		if (cmd === 'wind') { const v = parseFloat(arg); if (Number.isFinite(v)) { api.shared.uWind.value = Math.max(0, Math.min(1.5, v)); return `→ wind ${v}`; } }
		if (cmd === 'face' || cmd === 'look') { const t = find(arg); if (t) { const P = W.player.state; P.yaw = Math.atan2(-(t.x - P.pos.x), -(t.z - P.pos.z)); return `→ facing ${t.name}`; } }
		return null;
	}
	const ACTION_RE = /\[\[\s*(go|goto|time|fly|wind|face|look|arms|weapon|purchase|secure|hunt)\s*:?\s*([^\]]*)\]\]/gi;

	// ---------- the built-in guide (no model) ----------
	function offline(text) {
		const s = snapshot(), q = norm(text);
		if (!s) return 'The world is still waking up.';
		let m;
		const arms = api.arms?.command?.(text, { position: api.camera.position });
		if (arms?.kind && arms.kind !== 'none') return arms.message;
		if (/\b(cave|caves|underground|cavern)\b/.test(q) && !/^(take me|go|fly|bring me|teleport me|travel)/.test(q)) {
			const t = find('nearest cave'), cam = api.camera.position;
			return t ? `${t.name} is ${fmtDist(Math.hypot(t.x-cam.x,t.z-cam.z))} ${dirTo(t.x-cam.x,t.z-cam.z)}. Walk into its hillside mouth and follow the sloping passage. Strike the three resonant stones in an alcove (look at one and press E, or tap it) to restore its guiding lights. The tunnel leads back to the surface; Quests lists the entrances.` : 'I have no mapped land-cave entrance on this surface yet.';
		}
		const travel = travelRequest(text);
		if (travel) {
			const resolved = resolveTravel(travel, { cities: atlasReady() ? cities() : [], regions: atlasReady() ? regions() : [], local: targets() });
			if (resolved.kind === 'destination' && resolved.place) {
				const t = Number.isFinite(resolved.place.lat) && Number.isFinite(resolved.place.lon)
					? { ...resolved.place, kind: 'global', global: true, broad: !!resolved.broad, region: resolved.region || resolved.place.regionName || resolved.place.country }
					: resolved.place;
				const lead = resolved.broad && resolved.region ? `${resolved.region.replace(/^the\s+/i, '')} is broad, so I’ll start you in ${t.name}.` : `Let’s go to ${t.name}.`;
				return `${lead} [[go: ${t.name}]]`;
			}
			if (resolved.kind === 'clarify') return resolved.message;
		}
		if ((m = q.match(/^(?:take me|go|fly|bring me|teleport me|travel)(?: to)? (.+)$/))) { const t = find(m[1]); return t ? `Let's go to ${t.name}. [[go: ${t.name}]]` : `I don't know a place called "${m[1]}". Try a city, a landmark, or something on the island like "the vent".`; }
		if ((m = q.match(/(?:make it|set (?:the )?time(?: to)?|skip to) (night|midnight|sunset|sunrise|dawn|noon|morning|evening|\d+)/))) { const h = { night: 22.5, midnight: 0, sunset: 18.6, sunrise: 6.2, dawn: 5.8, noon: 12, morning: 9, evening: 19.5 }[m[1]] ?? +m[1]; return `As you wish. [[time: ${h}]]`; }
		if (/where am i|where are we/.test(q)) return `You're at ${s.place}${s.underwater ? `, ${Math.round(s.depth)} m under water` : s.height > 20 ? `, ${s.height} m up` : ''}. Nearby: ${s.near.slice(0, 3).map((n) => `${n.name} (${n.dist} ${n.dir})`).join(', ')}.`;
		if (/what (is|s) (near|around)|nearby|around here/.test(q)) return 'Around you: ' + s.near.map((n) => `${n.name}, ${n.dist} ${n.dir}`).join('; ') + '.';
		if (/what (should|can) i do|what now|what next|bored|quest|journal|goal/.test(q)) {
			if (!s.todo.length) return 'You have found everything on my list. Try the night sky from Twin Peaks, or the view from Mount Diablo at sunset.';
			const next = s.todo[0], q = QUESTS.find((x) => x[1] === next), t = q && q[2] ? find(q[2]) : null;
			const cam = api.camera.position;
			return `Still to find: ${s.todo.slice(0, 4).join('; ')}. Start with "${next}"${t ? ` — ${t.name} is ${fmtDist(Math.hypot(t.x - cam.x, t.z - cam.z))} ${dirTo(t.x - cam.x, t.z - cam.z)}; say "take me to ${t.name}"` : q && q[0] === 'night' ? ' — say "make it night" and look up' : ''}.`;
		}
		if ((m = q.match(/(?:what|tell me about|who built|when was) (?:is |was |the )*(.+)/))) { const t = find(m[1]); if (t) return `${t.name}: ${t.fact}.`; }
		if (/species|fish|animals|coral|life|ecology/.test(q)) return `${s.sea || ''} ${s.land || ''} Crysis.ecology() in the console lists every species.`.trim();
		if (/help|how|controls/.test(q)) return 'Ask me where you are, what is nearby, what to do next, about any landmark, or say "take me to" a place. "Make it night" changes the hour.';
		return `I'm the guide${llm.kind() === 'none' ? ' (running without a model — load one in ⚙ for real conversation)' : ''}. Ask me where you are, what to do next, or say "take me to" somewhere.`;
	}

	// ---------- the conversation ----------
	const history = (archive.thread('guide')?.turns || []).filter(t=>t.role==='user'||t.role==='assistant').slice(-12).map(t=>({role:t.role,content:t.content}));
	function systemPrompt() {
		const s = snapshot();
		return `You are the Guide in Crysis, a calm, warm companion inside a realistic world: a tropical island in the Gulf of the Farallones and, beyond it, the real San Francisco Bay Area at true scale. ${dialogueStylePrompt(dialogueStyle, 32)} Speak briefly unless asked for more, plainly, like a local friend. Never invent facts about places: use the facts given here, or say you are not sure.
You can act in the world by writing a command in double brackets at the end of your reply:
[[go: PLACE]] takes the player there (any town, landmark, area, or: the vent, the lava tube, sea cave 1, the reef, the village, the island peak, the whale, home). Understand natural paraphrases such as “take me east toward Japan”, “bring us over to the Far East”, “head somewhere snowy”, or “I want to see Kyoto”. Broad regions resolve to an authored atlas city and should be named as the starting point; do not invent coordinates.
[[time: HOUR]] sets the hour (0-24). [[fly: on]] or [[fly: off]]. [[face: PLACE]] turns the player toward a place. [[wind: 0-1.5]].
For game-only gear actions, use [[arms: purchase rifle]], [[arms: secure shotgun at the police station]], or [[arms: hunt with the bow]] only when the player clearly asks. Never provide real-world weapon instructions; the arms system resolves availability, inventory and local consequences. Nearby sources and current gear are in WORLD NOW.
Only use a command when the player asks for it or clearly agrees. Suggest things to do from the player's journal. To add something to the player's journal, write [[quest: PLACE]].
THE WORLD NOW: ${JSON.stringify(s)}`;
	}
	let busy = null;
	// ---------- talking with the people you meet ----------
	// partner: { p (the person), persona, history } while you are talking with someone
	let partner = null;
	const people = new WeakMap();
	function whereKind() {
		const W = api.world(), cam = api.camera.position;
		if (Math.max(Math.abs(cam.x), Math.abs(cam.z)) < W.island.half) return { kind: 'island', name: 'the village' };
		const w = W.labels?.where(cam.x, cam.z, cam.y, false), U = W.bayArea?.urbanAt(cam.x, cam.z), L = W.real?.landAt?.(cam.x, cam.z);
		const kind = L && (L.lu === 0 || L.lu >= 11) && (!U || U.u < 0.3) ? 'nature' : U && (U.s === 0 || U.d > 0.2) ? 'city' : 'suburb';
		return { kind, name: w?.name || 'the Bay Area' };
	}
	function talkTo(p) {
		if (!p) return;
		busy?.abort();
		if (partner && partner.p !== p) endTalk();
		const resident = api.social?.meet(p, whereKind());
		if (resident) p = api.social.actors.all().find(a => a.residentId === resident.id) || p;
		let rec = people.get(p);
		if (resident) { rec = { persona: resident.persona, history: resident.history, id: resident.id, met: resident.history.length > 0 }; }
		else if (!rec || rec.seed !== p.P.dna.seed) rec = { persona: personaFor(p.P, whereKind()), history: [], seed: p.P.dna.seed };
		people.set(p, rec);
		partner = { p, ...rec, threadId:rec.id || 'npc:'+api.social?.bodyKey()+':'+p.P.dna.seed };
		archive.importHistory(threadMeta(partner),rec.history);
		resetView('npc');
		api.people?.engage(p);
		if (resident) for (const q of stories.event({id:'talk:'+Date.now()+':'+resident.id,type:'talk',bodyKey:resident.bodyKey,npcId:residentKey(resident.id)})) questChanged(q);
		title.textContent = partner.persona.name.toUpperCase();
		input.placeholder = `Say something to ${partner.persona.first}`;
		show(true);
		for (const turn of archive.thread(threadMeta(partner).id)?.turns.slice(-30) || []) if (turn.role === 'user' || turn.role === 'assistant') say(turn.content, turn.role === 'user' ? 'me' : 'guide');
		if (archive.status().error) say('Conversation archive could not save. Use Conversations → Export before leaving this session.','note');
		if (resident) say((api.social.state.status().error ? 'Memory is available this session, but your browser could not save it. ' : 'Remembered in this browser. ') + 'Tell me what you need in your own words, or ask me for an adventure.', 'note');
		if (resident && llm.kind()==='cloud' && !llm.supportsPlanning?.()) say('This shared voice can chat, but flexible actions are not available yet. Common requests still work; an on-device model in ⚙ can interpret more.', 'note');
		if (!rec.met) { rec.met = true; perform(personaOffline(partner.persona, 'hi', snapshot()), true); }
		else say(`${partner.persona.first} turns back to you.`, 'note');
		const recap = resident && gatheringRecap(resident);
		if (recap) perform(recap, true);
		offer(p.talk?.open?.());
	}
	// a world's own people can have more to say and to offer (planet/colony/errands.js):
	// a line, a note, and choices that answer with the next of the same
	function offer(o) {
		if (!o || !partner) return;
		const P2 = partner;
		if (o.say) { perform(o.say, true); if (P2.id) api.social.state.remember(P2.id, 'assistant', o.say.replace(TAG_RE, '').trim()); }
		if (o.note) say(o.note, 'note');
		if (!o.choices?.length) return;
		const row = el('div', 'display:flex;gap:8px;flex-wrap:wrap;');
		for (const c of o.choices) {
			const b = el('button', btnCss, c.label);
			b.onclick = () => { row.remove(); if (partner !== P2) return; say(c.label, 'me'); archiveTurn(threadMeta(P2), 'user', c.label); offer(c.fn?.()); };
			row.append(b);
		}
		log.append(row); scroll();
	}
	function endTalk() {
		if (!partner) return;
		busy?.abort();
		api.people?.release(partner.p);
		partner = null;
		if ('speechSynthesis' in window) speechSynthesis.cancel();
		renderGuide();
		title.textContent = 'THE GUIDE';
		input.placeholder = 'Ask anything, or "take me to Alcatraz"';
	}
	// a person's reply, shown and acted: each finished sentence moves them
	function bodySync(p, text, from) {
		const done = text.slice(from), parts = done.split(/(?<=[.!?])\s+/);
		if (parts.length < 2 && !/[.!?]$/.test(done)) return from;
		let used = from;
		const whole = /[.!?]$/.test(done) ? parts : parts.slice(0, -1);
		for (const sentence of whole) {
			const b = bodyFor(sentence, p.P.dna.temper);
			for (const g of b.gestures) p.M.gesture(g);
			if (b.feel) p.M.feel(b.feel[0], b.feel[1]);
			used += sentence.length + 1;
		}
		// they speak for about as long as the words take to say
		p.speakUntil = Math.max(p.speakUntil || 0, performance.now() + 400 + (text.length - from) * 55);
		return Math.min(used, text.length);
	}
	function perform(reply, speakIt) {
		const p = partner.p, clean = reply.replace(TAG_RE, '').replace(ACTION_RE, '').replace(QUEST_RE, '').trim();
		say(clean, 'guide');
		archiveTurn(threadMeta(partner),'assistant',clean);
		bodySync(p, reply + (/[.!?]$/.test(reply) ? '' : '.'), 0);
		if (speakIt && voiceOut) speak(clean);
	}
	// a person as the shared voice needs them (server/discovery talk.js): who they are and a few
	// short facts, never a prompt of our own
	function npcFor(pp, world) {
		const near = (world?.near || []).slice(0, 6).map((n) => (typeof n === 'string' ? n : n?.name)).filter(Boolean);
		const facts = [
			`has lived around here about ${pp.years} years`, `right now: ${pp.errand}, feeling ${pp.mood}`, `likes ${pp.hobby}`,
			...(partner?.id ? [api.social.describe(api.social.state.get(partner.id)), ...(api.social.state.get(partner.id)?.memories || []).slice(-6).map(m => m.content)] : []),
			...(pp.facts || []), ...(pp.tattoos || []).slice(0, 2).map((t) => 'a tattoo: ' + t),
			world?.time ? 'the time: ' + world.time : '', near.length ? 'nearby: ' + near.join(', ') : '',
			...(partner?.id && api.social.appointments?.agreedWith(partner.id, api.social.bodyKey()) ? [(a => a.gathering ? `is hosting a ${a.gathering.title.toLowerCase()} at ${a.place.name} at ${formatClock(a.due % 24)} and has invited the player` : `has agreed to meet the player at ${a.place.name} at ${formatClock(a.due % 24)}`)(api.social.appointments.agreedWith(partner.id, api.social.bodyKey()))] : []),
			'when arranging to meet, always names one exact place and a clock time, never a vague promise',
			'when asked to gather people, or to host a concert, party, picnic or meet-up, the game organises it for real',
		].filter(Boolean);
		return { name: pp.name, age: pp.age, job: pp.job, place: pp.place, region: pp.region || '', lang: pp.lang || '', temper: pp.style, facts, places: near, dialogueStyle:normalizeDialogueStyle(dialogueStyle,pp.age) };
	}
	async function askPerson(text) {
		const P2 = partner, p = P2.p;
		archiveTurn(threadMeta(P2),'user',text);
		busy?.abort();
		say(text, 'me');
		if (P2.id) api.social.state.remember(P2.id, 'user', text);
		else { P2.history.push({ role: 'user', content: text }); while (P2.history.length > 10) P2.history.shift(); }
		const bubble = say('…', 'guide');
		const ctrl = new AbortController(); busy = ctrl;
		let reply = null, from = 0;
		const world = snapshot();
		const resident = P2.id && api.social?.state.get(P2.id);
		// Gear requests are resolved by the authoritative world adapter before social
		// intent or the language model. This lets “could you find us a hunting rifle?”
		// work conversationally while ordinary dialogue remains non-mutating.
		// a world's own people answer their own errands first (planet/colony/errands.js)
		const own = p.talk?.reply?.(text);
		if (own?.say) reply = own.say;
		const armsResult = reply ? null : api.arms?.command?.(text, { position: p.M.S.pos, speaker: P2.persona });
		if (armsResult?.ok && armsResult.kind && armsResult.kind !== 'none') reply = armsResult.message;
		if (resident) {
			api.social.state.setPosition(resident.id, api.social.positionFor(api.world(), p.M.S.pos));
			const named = text.match(/(?:scout|check out|investigate)\s+(.+?)[.!?]*$/i)?.[1]?.trim().replace(/[, ]*please$/i, '').trim();
			let target = named && !/^(nearby|ahead|around here|the area)$/i.test(named.trim()) ? find(named) : null;
			if (!named || /^(nearby|ahead|around here|the area)$/i.test(named.trim())) {
				target = api.social.scoutNearby(p, targets());
			}
			// A gear action has already been validated by the arms adapter. Keep that
			// response instead of letting the social intent layer reinterpret it as a
			// generic order for the resident.
			if (!reply) reply = api.social.command(resident, text, { target, quest: quests.find(q => !q.done) });
			if (reply && parseSocialIntent(text)==='scout' && resident.mode==='scout' && resident.task && target?.name) api.social.state.setMode(resident.id,'scout',{...resident.task,targetId:'place-'+norm(target.name).replace(/ /g,'-')});
		}
		let meetNoteText = null, meetHandled = false;
		if (resident && !reply) {
			const meet = gatheringReply(text, resident, p) || meetingReply(text, resident, p);
			if (meet) { reply = meet.reply; meetNoteText = meet.note || null; meetHandled = true; }
		}
		if (resident && !reply) {
			reply = storyReply(text);
			if (!reply) {
				const context=storyContext(resident), destinations=context.targets.slice(0,8).map(t=>({...t,distance:Math.hypot(t.x-p.M.S.pos.x,t.z-p.M.S.pos.z)}));
				const currentOffer=stories.list(context.bodyKey).filter(q=>q.status==='offered' && q.offeredBy===residentKey(resident.id)).at(-1);
				const options={text:text.slice(0,600),resident,destinations,history:resident.history.slice(-3).map(m=>({role:m.role,content:m.content.slice(0,180)})),questContext:(currentOffer?'Current offer from this person: '+currentOffer.title+'. ':'No current quest offer. ')+stories.list(context.bodyKey).filter(q=>q.status==='active').map(q=>q.title).join('; ')};
				let intention=offlineSocialIntent(text,{destinations,hasQuestOffer:!!currentOffer});
				if (intention.reason!=='not-an-order') {
					const raw=await planChat(buildSocialIntentMessages(options),ctrl.signal,{kind:'social_intent',context:buildSocialIntentContext(options)});
					if (raw) { intention=decodeSocialIntent(raw,{text,destinations,hasQuestOffer:!!currentOffer}); if(intention.kind==='none' && !['conversation','not-an-order'].includes(intention.reason)) reply='I could not work out a supported action from that. Could you clarify what you want me to do?'; }
				}
				if (ctrl.signal.aborted || partner!==P2 || api.social.bodyKey()!==context.bodyKey) { if(busy===ctrl) busy=null; return; }
				if (intention.kind==='clarify') reply=intention.question;
				if (intention.kind==='quest_request') reply=await offerStory(resident,text,ctrl.signal);
				if (['quest_accept','quest_decline'].includes(intention.kind)) reply=currentOffer?storyReply(intention.kind==='quest_accept'?"I'm in":'no thanks'):'Which quest would you like to discuss?';
				if (intention.kind==='action') {
					const target=intention.targetId==='nearby'?api.social.scoutNearby(p,targets()):destinations.find(t=>t.id===intention.targetId);
					reply=api.social.command(resident,intention.command,{target,quest:stories.list(context.bodyKey).find(q=>q.status==='active') || quests.find(q=>!q.done)});
					if (intention.intent==='scout' && resident.mode==='scout' && resident.task && target?.id) api.social.state.setMode(resident.id,'scout',{...resident.task,targetId:target.id});
				}
			}
		}

		try {
			if (!reply && llm.kind() !== 'none' && llm.status.ready) {
				reply = await llm.chat([{ role: 'system', content: personaPrompt(P2.persona, { dialogueStyle, place: world?.place, time: world?.time, near: world?.near?.slice(0, 4), rememberedStatus: resident ? api.social.describe(resident) : null, memories: resident?.memories?.slice(-6).map(m => m.content) }) + '\nOnly describe your current saved status as fact. Physical requests and structured quest offers are handled by the game. If a request could not be interpreted, ask one short clarifying question instead of agreeing to do it. Do not invent a quest or emit quest tags in ordinary dialogue. If you suggest meeting up later, name one place from the list (or here, or your place) and a clock time, and end with [[meet: PLACE @ TIME]], for example [[meet: the pier @ 6 pm]]; the player must still agree. Never promise to meet without a place and time. Never claim to have performed a delivery, fight, purchase or other action that is not in that status.' }, ...(resident ? api.social.state.get(P2.id).history : P2.history).filter(turn => turn.role === 'user' || turn.role === 'assistant')], (t) => {
					if (ctrl.signal.aborted || partner !== P2) return;
					bubble.textContent = t.replace(TAG_RE, '').replace(ACTION_RE, '').replace(QUEST_RE, '').replace(MEET_TAG_RE, '').replace(/\[\[\s*meet[^\]]*$/i, '').trim(); scroll();
					from = bodySync(p, t, from);
				}, ctrl.signal, { npc: npcFor(P2.persona, world), maxTokens:dialogueTokenLimit(dialogueStyle,P2.persona.age) });
			}
		} catch { reply = null; }
		if (ctrl.signal.aborted || partner !== P2) { if (busy === ctrl) busy = null; return; }
		if (!reply) { reply = personaOffline(P2.persona, text, world); from = 0; }
		bodySync(p, reply + (/[.!?]$/.test(reply.trim()) ? '' : '.'), from);
		if (!resident) reply.replace(QUEST_RE, (_, pl) => { giveQuest(pl.trim(), P2.persona.first); return ''; });
		if (resident && !meetHandled) meetNoteText = meetingFromReply(reply, text, resident, p);
		const clean = reply.replace(TAG_RE, '').replace(ACTION_RE, '').replace(QUEST_RE, '').replace(MEET_TAG_RE, '').trim();
		bubble.textContent = clean || '…';
		if (meetNoteText) { say(meetNoteText, 'note'); if (meetNoteText.startsWith('📍')) api.hint(meetNoteText.replace(/ A pin marks the place\.$/, ''), 5000); }
		if (own && (own.note || own.choices)) offer({ ...own, say: null });
		archiveTurn(threadMeta(P2),'assistant',clean);
		if (archive.status().error) say('Conversation archive could not save. Use Conversations → Export before leaving this session.','note');
		if (P2.id) api.social.state.remember(P2.id, 'assistant', clean); else P2.history.push({ role: 'assistant', content: clean });
		if (voiceOut) speak(clean, P2.persona);
		if (busy === ctrl) busy = null;
		scroll();
		if (/\b(bye|goodbye|take care|see you)\b/i.test(text)) setTimeout(() => { if (partner === P2) { endTalk(); show(false); } }, meetNoteText ? 4000 : 1800);
	}
	async function ask(text) {
		if (!text.trim()) return;
		if (partner) return askPerson(text);
		if (view!=='guide') renderGuide();
		const requestEpoch=viewEpoch;
		archiveTurn(guideMeta,'user',text);
		say(text, 'me');
		const bubble = say('…', 'guide');
		// the world's secrets answer for themselves (surprises.js)
		const secret = api.secret?.(text);
		if (secret) { bubble.textContent = secret; archiveTurn(guideMeta,'assistant',secret); scroll(); return; }
		if (busy) busy.abort();
		const ctrl = new AbortController(); busy = ctrl;
		let reply = null;
		try {
			if (llm.kind() !== 'none' && llm.status.ready) {
				history.push({ role: 'user', content: text });
				while (history.length > 12) history.shift();
				reply = await llm.chat([{ role: 'system', content: systemPrompt() }, ...history], (t) => { if(ctrl.signal.aborted || requestEpoch!==viewEpoch || partner) return; bubble.textContent = t.replace(ACTION_RE, '').trim(); scroll(); }, ctrl.signal);
				if (reply && !ctrl.signal.aborted && requestEpoch===viewEpoch && !partner) history.push({ role: 'assistant', content: reply });
			}
		} catch (e) { if(ctrl.signal.aborted || requestEpoch!==viewEpoch || partner) return; reply = null; say('(The model did not answer: ' + e.message + '. The built-in guide answers instead.)', 'note'); }
		if(ctrl.signal.aborted || requestEpoch!==viewEpoch || partner) { if(busy===ctrl)busy=null;return; }
		if (!reply) reply = offline(text);
		const acts = [];
		reply.replace(ACTION_RE, (_, c, a) => { acts.push([c, a.trim()]); return ''; });
		reply.replace(QUEST_RE, (_, pl) => { giveQuest(pl.trim(), null); return ''; });
		const clean = reply.replace(ACTION_RE, '').replace(QUEST_RE, '').trim();
		bubble.textContent = clean || '…';
		archiveTurn(guideMeta,'assistant',clean);
		for (const [c, a] of acts) { const r = act(c, a); if (r) say(r, 'note'); }
		if (voiceOut) speak(clean);
		if (busy === ctrl) busy = null;
		scroll();
	}

	// ---------- voice ----------
	let voiceOut = store.get('crysis-guide-voice', false);
	function speak(t, who) {
		if (!('speechSynthesis' in window) || !t) return;
		speechSynthesis.cancel();
		const u = new SpeechSynthesisUtterance(t);
		u.rate = 1.02; u.pitch = 1;
		const all = speechSynthesis.getVoices().filter((x) => /^en/.test(x.lang));
		let v = all.find((x) => /en[-_](US|GB)/.test(x.lang) && /natural|samantha|google|premium/i.test(x.name)) || all[0];
		// a person gets a voice of their own: picked from their seed, pitched by age and build
		if (who && all.length) {
			const d = partner?.p?.P?.dna, fem = all.filter((x) => /female|samantha|victoria|karen|moira|tessa|zira|susan|fiona|allison|ava|serena/i.test(x.name)), mal = all.filter((x) => /male|daniel|alex|fred|david|mark|tom|oliver|aaron|rishi/i.test(x.name) && !/female/i.test(x.name));
			const pool = d && !d.male ? (fem.length ? fem : all) : (mal.length ? mal : all);
			v = pool[(d?.seed ?? 0) % pool.length];
			u.pitch = d ? (d.male ? 0.9 : 1.1) - (d.age - 40) * 0.004 : 1;
			u.rate = 0.95 + (who.temper?.outgoing ?? 0.5) * 0.15;
		}
		if (v) u.voice = v;
		speechSynthesis.speak(u);
	}
	const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
	let rec = null;
	function listen() {
		if (!Rec) { say('This browser cannot listen; type instead.', 'note'); return; }
		if (rec) { rec.stop(); return; }
		rec = new Rec(); rec.lang = 'en-US'; rec.interimResults = true;
		mic.style.background = 'rgba(1,169,130,.45)';
		rec.onresult = (e) => { const r = e.results[e.results.length - 1]; input.value = r[0].transcript; if (r.isFinal) { const t = input.value; input.value = ''; ask(t); } };
		rec.onend = () => { rec = null; mic.style.background = ''; };
		rec.onerror = () => { rec = null; mic.style.background = ''; };
		rec.start();
	}

	// ---------- the panel ----------
	const css = (el, s) => { el.style.cssText = s; return el; };
	const el = (tag, s, text) => { const e = document.createElement(tag); if (s) css(e, s); if (text) e.textContent = text; return e; };
	const btnCss = 'min-width:40px;min-height:40px;padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#eafaf6;font:600 13px system-ui;cursor:pointer;';
	const open = el('button', 'position:absolute;width:44px;min-height:44px;border-radius:12px;border:1px solid rgba(1,169,130,.7);background:rgba(8,20,26,.55);color:#9fe8d0;font:600 18px system-ui;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer;', '✦');
	open.dataset.hud = 'rail 40';
	open.title = 'Talk to the guide (G)'; open.setAttribute('aria-label', 'Talk to the guide');
	const panel = el('div', 'position:absolute;left:calc(12px + env(safe-area-inset-left));bottom:calc(12px + env(safe-area-inset-bottom));width:min(420px,calc(100vw - 24px));max-height:min(80vh,560px);display:none;flex-direction:column;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(10,14,18,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 20px 60px rgba(0,0,0,.6);color:#f2f5f4;font:14px/1.45 system-ui;z-index:5;');
	panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'The Guide');
	const head = el('div', 'flex-shrink:0;display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);');
	const title = el('div', 'flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:600 13px system-ui;letter-spacing:.06em;color:#9fe8d0;', 'THE GUIDE');
	const statusEl = el('div', 'font:11px system-ui;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;');
	const gearB = el('button', btnCss, '⚙'); gearB.title = 'Model settings'; gearB.setAttribute('aria-label', 'Model settings');
	const closeB = el('button', btnCss, '✕'); closeB.setAttribute('aria-label', 'Close the guide');
	const residentsB = el('button', btnCss, 'People'); residentsB.setAttribute('aria-label', 'Remembered people');
	head.append(title, statusEl, gearB, closeB);
	const questB = el('button', btnCss, 'Quests'); questB.setAttribute('aria-label','Story quests');
	const tabs = el('div','display:flex;flex-shrink:0;gap:8px;padding:4px 12px;'); const archiveB=el('button',btnCss,'Conversations');archiveB.setAttribute('aria-label','Conversation archive');tabs.append(residentsB,questB,archiveB);
	const archiveControls=el('div','display:none;flex-shrink:0;padding:6px 12px;gap:6px;flex-wrap:wrap;');
	const archiveSearch=el('input','min-width:0;flex:1;padding:8px;background:#172225;border:1px solid #586567;border-radius:8px;color:#fff;');archiveSearch.type='search';archiveSearch.placeholder='Search every conversation';archiveSearch.setAttribute('aria-label','Search conversations');
	const archiveExport=el('button',btnCss,'Export'); archiveControls.append(archiveSearch,archiveExport);
	const settings = el('div', 'display:none;max-height:45vh;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);font:12px system-ui;color:rgba(255,255,255,.8);');
	const log = el('div', 'flex:1;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-height:0;');
	log.setAttribute('aria-live', 'polite');
	const bar = el('div', 'flex-shrink:0;display:flex;gap:6px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);');
	const input = el('input', 'flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font:14px system-ui;outline:none;');
	input.placeholder = 'Ask anything, or "take me to Alcatraz"'; input.setAttribute('aria-label', 'Message the guide');
	const mic = el('button', btnCss, '🎙'); mic.title = 'Speak'; mic.setAttribute('aria-label', 'Speak to the guide');
	const spk = el('button', btnCss, voiceOut ? '🔊' : '🔈'); spk.title = 'Read replies aloud'; spk.setAttribute('aria-label', 'Read replies aloud');
	const send = el('button', btnCss + 'background:linear-gradient(135deg,#01a982,#10b981);border:none;', '➤'); send.setAttribute('aria-label', 'Send');
	bar.append(input, mic, spk, send);
	panel.append(head, tabs, archiveControls, settings, log, bar);
	// (the guide has no button in the sidebar any more; G still opens it)
	open.hidden = true;
	mount.append(open, panel);
	// keep typing and taps out of the game's controls
	for (const ev of ['keydown', 'keyup', 'pointerdown', 'touchstart', 'wheel']) { panel.addEventListener(ev, (e) => e.stopPropagation()); open.addEventListener(ev, (e) => e.stopPropagation()); }

	function say(text, who) {
		const b = el('div', who === 'me' ? 'align-self:flex-end;max-width:85%;padding:8px 11px;border-radius:12px 12px 4px 12px;background:rgba(1,169,130,.22);border:1px solid rgba(1,169,130,.35);'
			: who === 'note' ? 'align-self:center;font:12px system-ui;color:rgba(255,255,255,.55);' : 'align-self:flex-start;max-width:90%;padding:8px 11px;border-radius:12px 12px 12px 4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);', text);
		b.style.whiteSpace = 'pre-line';
		log.append(b); scroll();
		return b;
	}
	const scroll = () => { log.scrollTop = log.scrollHeight; };
	const show = (on) => { panel.style.display = on ? 'flex' : 'none'; open.style.display = 'none'; if (on) { setTimeout(() => input.focus(), 30); if (!log.children.length && view==='guide') greet(); } else input.blur(); };
	function greet() {
		const s = snapshot();
		say(s ? `Hello. You're on ${s.place}. Ask me anything — where to go, what something is, or what to do next.` : 'Hello.', 'guide');
		if (llm.kind() === 'none') say('Running without a model. ⚙ loads one on this device for real conversation.', 'note');
	}
	function showPeople() {
		endTalk(); resetView('journal'); show(true);
		const S = api.social, records = S?.state.list(S.bodyKey()) || [];
		say('REMEMBERED PEOPLE', 'note');
		if (!records.length) say('Talk to someone nearby to remember them and their home area.', 'note');
		for (const r of records) say(`${r.persona.name} · ${r.persona.place || 'Met nearby'}\n${S.describe(r)}`, 'note');
		const status = S?.state.status();
		if (status?.error) say('Your browser could not save the latest NPC progress. Keep this session open and free storage.', 'note');
	}
	let archiveScope=null, archivePage=0;
	function showArchive(query='',threadId=null) {
		endTalk(); resetView('archive'); importConversations();
		archiveScope=threadId; archivePage=0; archiveSearch.value=query;
		archiveControls.style.display='flex'; bar.style.display='none'; show(true); input.blur();
		archiveSearch.placeholder=threadId?'Search this conversation':'Search every conversation';
		renderArchive();
	}
	function renderArchive() {
		log.replaceChildren();
		const query=archiveSearch.value.trim(), thread=archiveScope && archive.thread(archiveScope);
		const heading=el('div','color:#9fe8d0;font-weight:600;',thread?thread.name+' · conversation':'ALL CONVERSATIONS');log.append(heading);
		if (archiveScope) { const all=el('button',btnCss,'All conversations');all.onclick=()=>showArchive();log.append(all); }
		const rows=thread && !query ? thread.turns.slice(archivePage*30,archivePage*30+31).map((turn,index)=>({threadId:thread.id,name:thread.name,turn,index})) : archive.search(query,{threadId:archiveScope || undefined,offset:archivePage*30,limit:31});
		if (!rows.length) say(query?'No matching messages.':'No saved messages yet. New conversations are kept here.', 'note');
		for (const hit of rows.slice(0,30)) {
			const item=el('div','padding:8px;border:1px solid #455255;border-radius:8px;');
			const label=el('button',btnCss,hit.name+' · '+(hit.turn.role==='user'?'You':hit.name));label.onclick=()=>showArchive('',hit.threadId);
			item.append(label,el('div','white-space:pre-wrap;overflow-wrap:anywhere;padding-top:6px;',hit.turn.content));log.append(item);
		}
		const pages=el('div','display:flex;gap:8px;');
		if (archivePage>0) {const prev=el('button',btnCss,'Previous');prev.onclick=()=>{archivePage--;renderArchive();};pages.append(prev);}
		if (rows.length>30) {const next=el('button',btnCss,'Next');next.onclick=()=>{archivePage++;renderArchive();};pages.append(next);}
		log.append(pages);
		if (archive.status().error) say('The latest messages could not be saved. Export your conversations before leaving this session. '+archive.status().error,'note');
		log.scrollTop=0;
	}
	archiveSearch.addEventListener('input',()=>{archivePage=0;renderArchive();});
	archiveExport.onclick=()=>{const url=URL.createObjectURL(new Blob([archive.exportJSON()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bard-conversations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

	function showQuests() {
		endTalk(); resetView('journal'); show(true);
		const bodyKey=api.social?.bodyKey(), list=stories.list(bodyKey);
		const meetings=(book()?.list(bodyKey) || []).filter(a=>a.status!=='cancelled').sort((a,b)=>b.due-a.due).slice(0,8), openM=meetings.filter(a=>a.status==='agreed'||a.status==='proposed');
		if (meetings.length) {
			say('MEETINGS', 'note');
			const cam=api.camera.position, W=api.world();
			for (const a of meetings) {
				const q=worldPosition(W,a.place.pos), far=q?` · ${fmtDist(Math.hypot(q.x-cam.x,q.z-cam.z))} ${dirTo(q.x-cam.x,q.z-cam.z)}`:'';
				const state=a.status==='agreed'?(a.id===tracked || (!tracked && a===openM.filter(x=>x.status==='agreed').at(-1))?'◆ MARKED':'AGREED'):a.status==='proposed'?'SUGGESTED':a.status==='kept'?'✓ KEPT':'MISSED';
				say(a.gathering ? `${a.status==='kept'?'✓ ATTENDED':state} · ${gatherTitle(a)} · hosted by ${a.npcName}\n${a.status==='agreed'?meetWhen(a).replace(/ \((.*)\)$/, ' · $1')+far:formatClock(a.due%24)}` : `${state} · Meet ${a.npcName} at ${a.place.name}\n${a.status==='agreed'||a.status==='proposed'?meetWhen(a)+far:formatClock(a.due%24)}`, a.status==='agreed'||a.status==='proposed'?'guide':'note');
				if (a.status==='agreed'||a.status==='proposed') {
					const row=el('div','display:flex;gap:8px;flex-wrap:wrap;');
					if (a.status==='proposed') { const ok=el('button',btnCss,'Agree'); ok.onclick=()=>{ if(book().agree(a.id).ok){ tracked=a.id; api.social.state.remember(a.npcId,'event',`You agreed to meet the traveller at ${a.place.name} at ${formatClock(a.due%24)}.`);} showQuests(); }; row.append(ok); }
					else { const mark=el('button',btnCss,'Show the way'); mark.onclick=()=>{ tracked=a.id; api.waypoint?.set(waypointMark()); if(q && W){ const P=W.player.state; P.yaw=Math.atan2(-(q.x-P.pos.x),-(q.z-P.pos.z)); } show(false); api.hint(`Follow the pin to ${a.place.name}.`,4000); }; row.append(mark); }
					const no=el('button',btnCss,a.status==='proposed'?'Decline':'Cancel'); no.onclick=()=>{ book().cancel(a.id); if(a.status==='agreed') api.social.state.remember(a.npcId,'event',`The traveller called off your meeting at ${a.place.name}.`); showQuests(); }; row.append(no);
					log.append(row);
				}
			}
			if (book().status().error) say(book().status().error,'note');
		}
		const own = api.world()?.colony?.crew?.journal?.();
		if (own) {
			say(own.title, 'note');
			for (const e of own.list) {
				say(e.text, e.active ? 'guide' : 'note');
				if (e.track) { const b = el('button', btnCss, 'Show the way'); b.onclick = () => { e.track(); api.waypoint?.set(waypointMark()); show(false); }; log.append(b); }
			}
			for (const l of own.log) say(l, 'note');
		}
		say('STORY QUESTS', 'note');
		if (!list.length) say('Ask someone nearby for an adventure. They can suggest a story rooted in this world.', 'note');
		for (const q of list.slice().reverse()) {
			say(`${q.status.toUpperCase()} · ${q.cursor}/${q.steps.length} objectives\n${storySummary(q)}`, 'guide');
			if (q.status==='offered' || q.status==='active') {
				const row=el('div','display:flex;gap:8px;');
				if (q.status==='offered') { const accept=el('button',btnCss,'Accept quest'); accept.onclick=()=>{const result=stories.accept(q.id,bodyKey);showQuests();if(questNotice(result))say(questNotice(result),'note');};row.append(accept); }
				const cancel=el('button',btnCss,q.status==='offered'?'Decline':'Cancel quest');cancel.onclick=()=>{const result=stories.cancel(q.id,bodyKey);showQuests();if(questNotice(result))say(questNotice(result),'note');};row.append(cancel);log.append(row);
			}
		}
		if (stories.status().error) say(stories.status().error,'note');
		say('EXPLORATION', 'note');
		for (const q of QUESTS.filter(q => !q[2] || find(q[2]))) say(`${journal[q[0]] ? '✓' : '○'} ${q[1]}`, 'note');
		const caves = el('button', btnCss, 'Cave entrances and discoveries'); caves.onclick = showCaves; log.append(caves);
	}
	function showCaves() {
		endTalk(); resetView('journal'); show(true);
		const W = api.world(), cam = api.camera.position;
		say('CAVE EXPLORATION', 'note');
		say('Walk through a hillside mouth into the underground. Strike the three resonant stones in an alcove (look at one and press E, or tap it) to restore guiding lights. You can walk back to the surface at any time.', 'guide');
		const caves = targets().filter(t => t.caveEntrance !== undefined).sort((a,b) => Math.hypot(a.x-cam.x,a.z-cam.z)-Math.hypot(b.x-cam.x,b.z-cam.z));
		if (!caves.length) say('There are no mapped land-cave entrances on this surface.', 'note');
		for (const t of caves) {
			say(`${t.name} · ${fmtDist(Math.hypot(t.x-cam.x,t.z-cam.z))} ${dirTo(t.x-cam.x,t.z-cam.z)}`, 'guide');
			const face = el('button', btnCss, 'Look toward '+t.name);
			face.onclick = () => { const P = W.player.state; P.yaw = Math.atan2(-(t.x-P.pos.x),-(t.z-P.pos.z)); P.pitch = -.08; show(false); api.hint(`${t.name}: follow this bearing to the hillside mouth.`, 5000); };
			log.append(face);
		}
		if (caveVisits[api.social?.bodyKey()]) say('✓ You have explored this world’s underground.', 'note');
		const stats = W?.underworld?.elements?.stats();
		if (stats) say(`${stats.completed} of ${stats.sites} resonance alcoves restored. ${stats.saveError || 'Progress is saved on this device.'}`, 'note');
		const deep = W?.deep?.info();
		if (deep) say(deep.open ? `The Deep Gate is open. Deepest reached: ${deep.deepest} m; ${deep.waystones} waystone${deep.waystones === 1 ? '' : 's'} touched; ${deep.alcoves} deep alcove${deep.alcoves === 1 ? '' : 's'} restored.` : `The Deep Gate is sealed. It lies at the end of the caves beneath the summit${W.deep.gate.via ? ', in from ' + W.deep.gate.via.name : ''}: strike one of its five stones, listen, and play the phrase back.`, 'note');
	}
	archiveB.onclick=()=>showArchive();
	questB.onclick=showQuests;
	residentsB.onclick = showPeople;
	open.onclick = () => show(true);
	closeB.onclick = () => { endTalk(); show(false); };
	send.onclick = () => { const t = input.value; input.value = ''; ask(t); };
	input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send.onclick(); } if (e.key === 'Escape') { endTalk(); show(false); } });
	mic.onclick = listen;
	spk.onclick = () => { voiceOut = !voiceOut; store.set('crysis-guide-voice', voiceOut); spk.textContent = voiceOut ? '🔊' : '🔈'; if (!voiceOut && 'speechSynthesis' in window) speechSynthesis.cancel(); };
	addEventListener('keydown', (e) => { if ((e.key === 'g' || e.key === 'G') && !window._KEYS_PLAY_ON && !e.metaKey && !e.ctrlKey && document.activeElement?.tagName !== 'INPUT' && mount.style.display !== 'none') { e.preventDefault(); show(panel.style.display === 'none'); } });

	// settings: which model
	// the model is part of the game: where the browser can run one (WebGPU), a small one
	// loads by itself in the background on first launch and is cached from then on; phones
	// get the smallest. Choosing "Built-in guide" in ⚙ turns it off for good.
	const phone = /iPhone|iPad|Android|Mobile/i.test(navigator.userAgent);
	const saved = store.get('crysis-guide-model', null);
	const offlineMode = /(?:^|[?&])offline(?:=1|&|$)/i.test(location.search || '');
	// Defaults are chosen for this run. A deliberate saved provider is preserved, while a
	// prior GPU failure or offline link cannot erase the player's preference.
	const choice = chooseGuideModel(saved, { cloudURL: DISCOVERY_URL, phone, webGPU: hasWebGPU(), crashed: crashedBefore(), offline: offlineMode });
	if (crashedBefore() && choice.kind === 'none' && (!saved || saved.auto === true)) setTimeout(() => say('The on-device voice stopped last time, so the built-in guide is active for this run. You can choose another voice in ⚙.', 'note'), 4000);
	// the phone keeps only the voice it uses (after the world has loaded)
	if (phone) setTimeout(() => { pruneModels('(none)').then((b) => { if (b > 5e7) say(`Freed ${(b / 1e9).toFixed(2)} GB on this device: removed a voice model no longer in use.`, 'note'); }).catch(() => {}); }, 20000);
	function drawSettings() {
		settings.innerHTML = '';
		const row = (label, node) => { const r = el('label', 'display:flex;align-items:center;gap:8px;margin:6px 0;'); r.append(el('span', 'width:74px;color:rgba(255,255,255,.6);', label), node); settings.append(r); return r; };
		const styleSelect=(label,key,options)=>{const control=el('select','flex:1;min-width:0;padding:8px;background:#1a1a1a;color:#fff;border:1px solid #555;border-radius:8px;');control.setAttribute('aria-label',label);for(const [value,text] of options){const o=el('option',null,text);o.value=value;control.append(o);}control.value=dialogueStyle[key];control.onchange=()=>{dialogueStyle=normalizeDialogueStyle({...dialogueStyle,[key]:control.value});store.set('crysis-dialogue-style',dialogueStyle);};row(label,control);};
		styleSelect('Language','tone',[['clean','Clean'],['mature','Mature · natural profanity and adult themes']]);
		styleSelect('Personality','vividness',[['restrained','Understated'],['bold','Bold · strong opinions and vivid storytelling']]);
		styleSelect('Replies','response',[['brief','Brief'],['balanced','Balanced'],['rich','Rich · more detail']]);
		settings.append(el('div','color:rgba(255,255,255,.65);margin:6px 0;','Tone follows each character. Mature themes apply to adult NPCs; model and provider limits still apply.'));
		const sel = el('select', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);');
		const opts = phone ? [['none', 'Built-in guide (models are off on phones)']] : [['none', 'Built-in guide (no model)'], ['webllm', 'On this device (WebGPU)'], ['ollama', 'Ollama on this computer']];
		// the shared voice, once the discovery server is deployed (earth/config.js): phones too
		if (DISCOVERY_URL) opts.push(['cloud', 'Free cloud voice (people only)']);
		for (const [v, t] of opts) { const o = el('option', null, t); o.value = v; sel.append(o); }
		sel.value = choice.kind;
		row('Voice', sel);
		if (choice.kind === 'webllm') {
			const m = el('select', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);');
			for (const x of WEBLLM_MODELS) { const o = el('option', null, x.label); o.value = x.id; m.append(o); }
			m.value = choice.id; m.onchange = () => { choice.id = m.value; };
			row('Model', m);
			settings.append(el('div', 'color:rgba(255,255,255,.5);margin:4px 0 8px;', hasWebGPU() ? 'Downloads once, then runs offline. Nothing you say leaves this device.' : 'This browser has no WebGPU (try Chrome or Edge on desktop or Android), or use Ollama.'));
		}
		if (choice.kind === 'cloud') settings.append(el('div', 'color:rgba(255,255,255,.5);margin:4px 0 8px;', 'People answer from a small model on the game\'s own server, inside a free daily allowance. What you say to them is sent there to answer and is not kept. When the day\'s share is used, they use their own lines.'));
		if (choice.kind === 'ollama') {
			const u = el('input', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);'); u.value = choice.url; u.onchange = () => { choice.url = u.value; };
			const n = el('input', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);'); n.value = choice.name; n.onchange = () => { choice.name = n.value; };
			row('Address', u); row('Model', n);
			settings.append(el('div', 'color:rgba(255,255,255,.5);margin:4px 0 8px;', `Install Ollama, "ollama pull ${choice.name}", then start it with OLLAMA_ORIGINS=${location.origin} ollama serve`));
		}
		const go = el('button', btnCss + 'width:100%;margin-top:4px;background:linear-gradient(135deg,#01a982,#10b981);border:none;', choice.kind === 'none' ? 'Use the built-in guide' : 'Load and use');
		go.onclick = () => connect(true);
		settings.append(go);
		sel.onchange = () => { choice.kind = sel.value; drawSettings(); };
	}
	async function connect(user) {
		if (user) { delete choice.auto; store.set('crysis-guide-model', choice); }
		try {
			if (choice.kind === 'webllm') await llm.useWebLLM(choice.id);
			else if (choice.kind === 'ollama') await llm.useOllama(choice.url, choice.name);
			else if (choice.kind === 'cloud' && DISCOVERY_URL) await llm.useCloud(DISCOVERY_URL);
			else llm.useNone();
			if (user) { settings.style.display = 'none'; log.style.display='flex'; tabs.style.display='flex'; bar.style.display=view==='archive'?'none':'flex'; archiveControls.style.display=view==='archive'?'flex':'none'; say(llm.status.text + ' — ready.', 'note'); }
		} catch { if (user) say(llm.status.text, 'note'); }
	}
	gearB.onclick = () => { const on=settings.style.display==='none'; settings.style.display=on?'block':'none'; settings.style.flex='1'; settings.style.minHeight='0'; settings.style.maxHeight='none'; log.style.display=on?'none':'flex'; tabs.style.display=on?'none':'flex'; bar.style.display=on || view==='archive'?'none':'flex'; archiveControls.style.display=!on && view==='archive'?'flex':'none'; if(on)drawSettings(); };
	llm.onStatus((st) => { statusEl.textContent = st.ready ? st.text : `${st.text}`.slice(0, 80); });
	// a model chosen before comes back by itself when it was downloaded already (Ollama
	// always); a first download only ever starts from the button
	if (choice.kind === 'ollama' || (choice.kind === 'cloud' && DISCOVERY_URL)) connect(false);
	else if (choice.kind === 'webllm') setTimeout(() => connect(false), store.get('crysis-guide-loaded', false) ? 1500 : 9000);   // after the world is up
	// a quiet progress pill while the model downloads the first time
	const pill = el('div', 'position:absolute;right:calc(var(--l99-menu-r, 64px) + env(safe-area-inset-right));top:calc(72px + env(safe-area-inset-top));padding:5px 10px;border-radius:10px;background:rgba(8,20,26,.6);color:#9fe8d0;font:11px system-ui;pointer-events:none;display:none;');
	mount.append(pill);
	llm.onStatus((st) => {
		if (llm.kind() !== 'webllm') { pill.style.display = 'none'; return; }
		if (/could not load|no WebGPU/i.test(st.text)) { pill.textContent = '✦ people will use simple replies'; pill.style.display = ''; setTimeout(() => { pill.style.display = 'none'; }, 4000); llm.useNone(); return; }
		if (!st.ready && st.progress < 1) { pill.style.display = ''; pill.textContent = `✦ voices loading ${Math.round((st.progress || 0) * 100)}%`; }
		else if (st.ready) { pill.textContent = '✦ people can talk now'; setTimeout(() => { pill.style.display = 'none'; }, 3500); }
	});
	llm.onStatus((st) => { if (st.ready && llm.kind() === 'webllm') store.set('crysis-guide-loaded', true); });

	return { update: watch, ask, act, snapshot, show, showPeople, showQuests, showCaves, showArchive, archive, stories, storyContext, say, llm, talkTo, endTalk, partner: () => partner, quests: () => quests.slice(), giveQuest, journal: () => ({ ...journal }), find, waypointMark };
}
