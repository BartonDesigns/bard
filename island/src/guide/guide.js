// The Guide: a companion you talk to, by text or by voice. It always knows where you
// are and what is around you (the world describes itself to it each turn), keeps a
// journal of the things there are to find (the vent, the lava tube, the sea caves,
// the whale, the Golden Gate, Alcatraz, Mount Diablo, home...), suggests what to do
// next, answers questions about the places, and can act: take you somewhere, change
// the hour, put you in the air. A conversational model on your own device gives it
// its voice; with no model it still answers from the world itself.

import { awarenessContext } from '../people/world-awareness.js';
import { createLLM, hasWebGPU, crashedBefore } from './llm.js';
import { buildNegotiationContext, buildNegotiationMessages, decodeNegotiationIntent, offlineNegotiationIntent } from './negotiation-intent.js';
import { agreementTerms } from './living-activity-view.js';
import { buildCommunityProjectContext, buildCommunityProjectMessages, decodeCommunityProjectIntent, offlineCommunityProjectIntent, communityProjectRelevant } from './community-project-intent.js';
import { projectKindLabel, communityProjectFacts } from './community-project-view.js';
import { livingActorId } from '../people/living-world.js';
import { createStoryQuests, questPrompt, fallbackQuest } from './story-quests.js';
import { createQuestChronicle, soulScope, reportRequest } from './quest-chronicle.js';
import { createRouteMarks, routeMarkSpot } from './route-marks.js';
import { worldPosition } from '../people/social-actors.js';
import { parseGameTime, realSecondsFor, formatClock, formatReal, talksOfMeeting, placePhrases, MEET_TAG_RE, EARLY, GRACE } from '../people/appointments.js';
import { gatherRequest, defaultGatherTime, makeGathering, HOURS as GATHER_HOURS } from '../people/gatherings.js';
import { createDialogueArchive } from './dialogue-archive.js';
import { normalizeDialogueStyle, dialogueStylePrompt } from '../people/dialogue-style.js';
import { createLocalSpeech } from './local-speech.js';
import { deviceVoiceFor } from './local-speech-plan.js';
import { voiceShape } from '../people/chatter-lines.js';
import { chooseGuideModel, voiceMode } from './preferences.js';
import { travelRequest, resolveTravel } from './travel.js';
import { loadAtlas, atlasReady, cities, regions } from '../earth/atlas.js';
import { pruneModels } from '../storage.js';
import { DISCOVERY_URL } from '../earth/config.js';
import { PLACES, ZONES } from '../bay/places.js';
import { toWorld } from '../bay/geo.js';
import { personaFor, bodyFor, TAG_RE } from '../people/persona.js';
import { guideArchive, guideTrackButton, guideTrackingCard, guideQuestCard, guideQuests, guideCommunityProjects, guideLivingActivity, guideStory, guideCaves, guideSettings } from './guide-screens.js';
import { guideTalkTo, guideAskPerson, guideAsk } from './guide-ask.js';

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
	// The guide's shared state for the modules its screens and conversations moved to
	// (guide-screens.js, guide-ask.js). Each getter and setter reaches the binding of that name here.
	const gd = {
		get act() { return act; }, get ACTION_RE() { return ACTION_RE; }, get api() { return api; },
		get archive() { return archive; },
		get archivePage() { return archivePage; }, set archivePage(next) { archivePage = next; },
		get archiveScope() { return archiveScope; }, get archiveSearch() { return archiveSearch; },
		get archiveTurn() { return archiveTurn; }, get askPerson() { return askPerson; },
		get bearing() { return bearing; }, get bodySync() { return bodySync; }, get book() { return book; },
		get btnCss() { return btnCss; }, get busy() { return busy; }, set busy(next) { busy = next; },
		get caveVisits() { return caveVisits; }, get choice() { return choice; },
		get chronicle() { return chronicle; },
		get communityPage() { return communityPage; }, set communityPage(next) { communityPage = next; },
		get communityPageScope() { return communityPageScope; }, set communityPageScope(next) { communityPageScope = next; },
		get communityScope() { return communityScope; }, get connect() { return connect; },
		get dialogueStyle() { return dialogueStyle; }, set dialogueStyle(next) { dialogueStyle = next; },
		get dirTo() { return dirTo; }, get drawSettings() { return drawSettings; }, get el() { return el; },
		get endTalk() { return endTalk; }, get explorePlace() { return explorePlace; }, get find() { return find; },
		get fmtDist() { return fmtDist; }, get folded() { return folded; },
		get gatheringRecap() { return gatheringRecap; }, get gatheringReply() { return gatheringReply; },
		get gatherTitle() { return gatherTitle; }, get giveQuest() { return giveQuest; },
		get guideMeta() { return guideMeta; }, get history() { return history; }, get input() { return input; },
		get journal() { return journal; },
		get livingActivityPage() { return livingActivityPage; }, set livingActivityPage(next) { livingActivityPage = next; },
		get livingActivityScope() { return livingActivityScope; }, set livingActivityScope(next) { livingActivityScope = next; },
		get livingContact() { return livingContact; }, set livingContact(next) { livingContact = next; },
		get llm() { return llm; }, get localSpeech() { return localSpeech; }, get log() { return log; },
		get meetingFromReply() { return meetingFromReply; }, get meetingReply() { return meetingReply; },
		get meetWhen() { return meetWhen; }, get negotiate() { return negotiate; }, get norm() { return norm; },
		get npcFor() { return npcFor; }, get offer() { return offer; }, get offerStory() { return offerStory; },
		get offline() { return offline; }, get partner() { return partner; }, set partner(next) { partner = next; },
		get people() { return people; }, get perform() { return perform; },
		get personContext() { return personContext; }, get phone() { return phone; },
		get pinned() { return pinned; }, get planChat() { return planChat; },
		get progressBar() { return progressBar; }, get projectConversation() { return projectConversation; },
		get projectProgressView() { return projectProgressView; }, set projectProgressView(next) { projectProgressView = next; },
		get QC() { return QC; }, get qcss() { return qcss; }, get qel() { return qel; },
		get QUEST_RE() { return QUEST_RE; }, get questCard() { return questCard; },
		get questChanged() { return questChanged; }, get questLive() { return questLive; },
		get questNotice() { return questNotice; }, get questPill() { return questPill; },
		get quests() { return quests; }, get QUESTS() { return QUESTS; },
		get readyReports() { return readyReports; }, get renderArchive() { return renderArchive; },
		get renderGuide() { return renderGuide; }, get reportStory() { return reportStory; },
		get resetView() { return resetView; }, get residentKey() { return residentKey; }, get say() { return say; },
		get scroll() { return scroll; }, get section() { return section; }, get setPinned() { return setPinned; },
		get settings() { return settings; }, get setWayPrefs() { return setWayPrefs; }, get show() { return show; },
		get showAgreement() { return showAgreement; }, get showArchive() { return showArchive; },
		get showCaves() { return showCaves; }, get showCommunityProjects() { return showCommunityProjects; },
		get showLivingActivity() { return showLivingActivity; },
		get showProjectReview() { return showProjectReview; }, get showQuests() { return showQuests; },
		get showRouteChoice() { return showRouteChoice; }, get showScheduleReview() { return showScheduleReview; },
		get showStory() { return showStory; }, get snapshot() { return snapshot; }, get speak() { return speak; },
		get speechMode() { return speechMode; }, set speechMode(next) { speechMode = next; },
		get speechStatusEl() { return speechStatusEl; }, get stepPlace() { return stepPlace; },
		get stepRow() { return stepRow; }, get stepWords() { return stepWords; }, get store() { return store; },
		get stories() { return stories; }, get storyContext() { return storyContext; },
		get storyReply() { return storyReply; }, get systemPrompt() { return systemPrompt; },
		get talkTo() { return talkTo; }, get targets() { return targets; }, get threadMeta() { return threadMeta; },
		get title() { return title; }, get toggle() { return toggle; }, get trackButton() { return trackButton; },
		get tracked() { return tracked; }, set tracked(next) { tracked = next; },
		get trackingCard() { return trackingCard; }, get updateProjectProgress() { return updateProjectProgress; },
		get view() { return view; }, get viewEpoch() { return viewEpoch; }, get voiceOut() { return voiceOut; },
		get waypointMark() { return waypointMark; }, get wayPrefs() { return wayPrefs; },
		get whereKind() { return whereKind; },
	};
	const llm = createLLM();
	// The atlas is intentionally lazy, but starting its small data module here means a
	// global request can become a real destination while the player is still talking.
	loadAtlas().catch(() => {});
	const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode: nothing persists */ } } };
	const journal = store.get('crysis-journal', {});
	const archive = createDialogueArchive();
	let dialogueStyle = normalizeDialogueStyle(store.get('crysis-dialogue-style', {}));
	let view = 'guide', viewEpoch = 0, projectProgressView = null;
	const guideMeta = {id:'guide',name:'The Guide',kind:'guide',bodyKey:''};
	function threadMeta(P) { return {id:P.id || P.threadId,name:P.persona.name,bodyKey:api.social?.bodyKey() || '',kind:'npc'}; }
	function archiveTurn(meta,role,text) { archive.append(meta,role,text); }
	function importConversations() { for(const r of api.social?.state.list() || []) archive.importHistory({id:r.id,name:r.persona.name,bodyKey:r.bodyKey,kind:'npc'},r.history); }
	function resetView(next) { busy?.abort(); viewEpoch++; view=next; projectProgressView=null; questLive=[]; markTab(next); log.replaceChildren(); input.value=''; settings.style.display='none'; log.style.display='flex'; tabs.style.display='flex'; archiveControls.style.display='none'; bar.style.display='flex'; }
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
		const arms = api.arms?.snapshot?.(cam), field = api.combat?.contracts?.journal?.();
		return {
			place: (W.underworld?.inside() || 0) > .35 ? 'the connected caves beneath '+(api.shared.planet?.name || 'this world') : onIsland ? (W.bayArea || W.globe ? 'the island (in the Gulf of the Farallones, 25 km west of the Golden Gate)' : api.shared.planet?.name || 'the island') : where ? `${where.name} (${where.sub})` : 'the open world',
			onIsland, underwater: cam.y < 0 && g < 0, depth: Math.max(0, -cam.y), height: Math.round(cam.y - Math.max(g, 0)), flying: !!P.flying, diving: !!P.diving, boat: !!W.boat?.boarded?.(),
			time: `${Math.floor(hours)}:${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}`, night: hours < 6 || hours > 19.5, wind: +(api.shared.uWind.value).toFixed(2),
			facing: dirTo(-Math.sin(P.yaw), -Math.cos(P.yaw)),
			near: near.map((t) => ({ name: t.name, dist: fmtDist(t.d), dir: dirTo(t.x - cam.x, t.z - cam.z), fact: t.fact })),
			done: QUESTS.filter((q) => journal[q[0]]).map((q) => q[1]), todo: [...(field?.active ? [`Field contract: ${field.name}, ${field.steps[field.cursor]?.text}`] : field?.offered ? [`Field contract on offer in Quests: ${field.name}`] : []), ...quests.filter((q) => !q.done).map((q) => q.title), ...QUESTS.filter((q) => !journal[q[0]] && (q[0] !== 'home' || store.get('crysis-home', null))).map((q) => q[1])],
			land: W.land?.profile?.thesis, sea: W.eco?.profile?.thesis,
			arms: arms ? { inventory: arms.inventory, nearby: arms.nearby } : null,
			community:communityProjectFacts(api.communityProjects?.snapshot?.()),
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
	const chronicle = createQuestChronicle({ scope: () => ({ id:soulScope(api.soul?.credentials?.() || 'local'), ...api.combat?.morality?.info() }) });
	const routeMarks = api.scene ? createRouteMarks({scene:api.scene,world:api.world,camera:api.camera,chronicle}) : null;
	let appointmentHistory = false;
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
		places.unshift(...(W.towers?.questTargets?.() || []).map(t=>({...t,bodyKey})));
		const residents = S.state.list(bodyKey);
		const npcs = residents.map(r => ({ id: residentKey(r.id), name: r.persona.name, bodyKey }));
		for (const r of residents) {
			const home = worldPosition(W, r.home);
			if (home) places.push({id:'home:'+residentKey(r.id), name:r.persona.first+"'s meeting place", ...home, bodyKey, radius:8, fact:'the place where you first met '+r.persona.name});
		}
		if (resident) { const actor=S.actors.all().find(p=>p.residentId===resident.id); if(actor) for(const t of places) t.scoutable=Math.hypot(t.x-actor.M.S.pos.x,t.z-actor.M.S.pos.z)<=180 && S.scoutNearby(actor,[t])?.id===t.id; }
		const context = stories.context({ bodyKey, targets: places, npcs });
		return { ...context, speaker: resident ? residentKey(resident.id) : null, arc:resident?chronicle.brief(bodyKey,residentKey(resident.id)):null, relationship:resident?chronicle.relationship(bodyKey,residentKey(resident.id)):null, workplace:resident?.workContext || null, persona: resident ? {name:resident.persona.name,job:resident.persona.job,hobby:resident.persona.hobby} : null };
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
		const owner=api.social?.state.list(q.bodyKey).find(r=>residentKey(r.id)===q.offeredBy);
		chronicle.observe(q,owner?.persona.name);
		if (announce) api.hint(q.status==='complete'?`Quest complete: ${q.title}`:`Quest updated: ${q.title}`,3500);
		if (q.status!=='complete') return;
		if(q.reward && !q.rewardPaid) {const paid=stories.claimReward(q.id,q.bodyKey,tx=>api.arms?.apply(tx)); if(paid.ok && !paid.already) api.hint(`Quest reward: ${paid.credits} credits added to your inventory.`,4500);else if(!paid.ok && announce) api.hint(`Quest complete. ${paid.error}`,6000);}
		const resident=api.social?.state.list(q.bodyKey).find(r=>residentKey(r.id)===q.offeredBy);
		if (!resident) return;
		api.multiplayer?.reportQuest?.(q,resident);
		if (resident.storyCompletions?.includes(q.id)) return;
		api.combat?.morality?.record({ id: 'quest:' + q.id, kind: 'favour', target: resident.persona.name, world: api.multiplayer?.worldKey?.() || q.bodyKey });
		resident.storyCompletions=[...(resident.storyCompletions || []),q.id].slice(-64);
		api.social.state.remember(resident.id,'event',`You and the traveller completed "${q.title}" together. ${q.premise}`);
	}
	function storySummary(q) {
		const context = storyContext(), label = step => context.targets.find(t=>t.id===step.targetId)?.name || context.npcs.find(n=>n.id===step.npcId)?.name || step.targetName || step.npcName || 'the marked place';
		return `${q.chapter ? `Chapter ${q.chapter} of 3 · ` : ''}${q.title}\n${q.premise}\n${q.chapter ? 'What lasts: trust, a shared story'+(q.chapter===2?' and a choice about the route.':'.')+'\n' : q.reward ? `Reward: ${q.reward.credits} inventory credits${q.rewardPaid?' · paid':q.status==='complete'?' · pending':' · on completion'}\n` : ''}` + q.steps.map((s,i)=>`${i<q.cursor?'✓':i===q.cursor?'→':'○'} ${s.type==='talk'?'Report to':s.type==='scout'?'Ask someone to scout':s.type==='return'?'Return to':'Explore'} ${label(s)}`).join('\n');
	}
	async function offerStory(resident, text, signal) {
		const context = storyContext(resident);
		if (chronicle.pending(context.bodyKey,context.speaker).length) { showRouteChoice(resident); return 'Before we start something else: should we mark the route for others, or keep it quiet?'; }
		const unfinished=stories.list(context.bodyKey).find(q=>q.offeredBy===context.speaker&&['offered','active'].includes(q.status));
		if (unfinished) return `Let’s finish what we already discussed.\n${storySummary(unfinished)}`;
		const compact={...context,targets:[...context.targets.filter(t=>!t.id.startsWith('home:')).slice(0,5),...context.targets.filter(t=>t.id==='home:'+residentKey(resident.id))],npcs:context.npcs.filter(n=>n.id===residentKey(resident.id)),previous:context.previous.slice(-2).map(q=>({title:q.title,status:q.status,steps:q.steps.map(s=>({type:s.type,targetId:s.targetId,npcId:s.npcId}))})),request:text.slice(0,300)};
		const raw = await planChat([{role:'system',content:questPrompt(compact)},{role:'user',content:text}],signal,{kind:'story_quest',context:compact});
		if (signal.aborted || !partner || partner.id!==resident.id || api.social.bodyKey()!==context.bodyKey) return null;
		let proposed = raw && stories.propose(raw,context);
		if (!proposed?.ok) proposed = stories.propose(fallbackQuest(context,{npcId:residentKey(resident.id),position:api.camera.position,persona:resident.persona}),context);
		if (!proposed.ok) return 'I do not have a reachable quest here yet. Let us meet near a village or another landmark.';
		const q = proposed.quest;
		const landmarks=q.steps.filter(s=>s.targetId&&!s.targetId.startsWith('home:')&&!s.targetId.startsWith('workplace:')).map(s=>context.targets.find(t=>t.id===s.targetId)).filter(t=>t&&!t.under&&t.y>.3).map(t=>{const pos=routeMarkSpot(api.world(),t);return {id:t.id,name:t.name,pos:api.social.positionFor(api.world(),pos || t),markerEligible:!!pos};});
		chronicle.register(q,resident.persona.name,landmarks);
		return `${storySummary(q)}\nInterested? Say “I’m in”, or open Quests to accept or decline.${questNotice(proposed) ? '\n'+questNotice(proposed) : ''}`;
	}
	function storyReply(text) {
		const bodyKey = api.social.bodyKey(), qs=stories.list(bodyKey), offered=qs.filter(q=>q.status==='offered' && (!q.offeredBy || q.offeredBy===residentKey(partner?.id || ''))).at(-1);
		if (reportRequest(text) && (readyReports().length || qs.some(q=>q.status==='active'&&q.offeredBy===residentKey(partner?.id||'')))) return reportStory(text);
		if (/^(?:yes[,.! ]*)?(?:i['’]?m in|i am in|let['’]?s do it|sounds good|i accept|accept(?: the quest)?|sign me up)[.! ]*$/i.test(text.trim()) && offered) {
			const result=stories.accept(offered.id,bodyKey); if(result.ok)questChanged(result.quest,false); return questNotice(result) || `Come back and tell me what stood out. ${offered.title} is in your journal.`;
		}
		if (/^(?:no thanks|decline(?: the quest)?|not now)[.! ]*$/i.test(text.trim()) && offered) { const r=stories.cancel(offered.id,bodyKey);if(r.ok)questChanged(r.quest,false); return 'No problem. We can find a different adventure another time.'; }
		if (/^(?:quest status|my quests|what(?:’s|'s| is) (?:my|the) next (?:step|objective)|how is my quest going)[?! .]*$/i.test(text.trim())) {
			const active=qs.find(q=>q.status==='active'); return active ? storySummary(active) : 'You have no active story quest. Ask me for an adventure.';
		}
		return null;
	}
	function readyReports(resident=partner?.id && api.social?.state.get(partner.id)) {
		if(!resident)return [];
		return stories.list(resident.bodyKey).filter(q=>q.status==='active'&&q.steps[q.cursor]?.type==='talk'&&q.steps[q.cursor].npcId===residentKey(resident.id));
	}
	function reportStory(text, requestedId=null) {
		const at=partner?.p?.M?.S?.pos,cam=api.camera.position;
		if(!at || Math.hypot(at.x-cam.x,at.z-cam.z)>8 || Math.abs(at.y+1.7-cam.y)>3) return 'Come back so we can talk about it in person. I want to hear what you noticed.';
		const ready=readyReports(), selected=requestedId?ready.find(q=>q.id===requestedId):ready.find(q=>text.toLowerCase().includes(q.title.toLowerCase())) || (ready.length===1?ready[0]:null);
		if (!selected) return ready.length>1?'Which of our walks are you reporting on? Tell me its title.':'We still have something to check before we can call that finished. Your journal shows what remains.';
		const completed=stories.event({id:'report:'+Date.now()+':'+selected.id,type:'talk',bodyKey:selected.bodyKey,npcId:residentKey(partner.id),questId:selected.id});
		for(const q of completed)questChanged(q);
		const q=completed[0]; if(!q)return 'Let’s check where we left off.';
		api.social.state.remember(partner.id,'event',`The traveller returned in person to discuss “${q.title}”. Their own report, not independently verified observations: ${text.slice(0,320)}`);
		showRouteChoice(api.social.state.get(partner.id));
		return q.status==='complete'?`You came back and kept your word. That matters to me.${q.chapter===2?' Now, do we put markers at the surveyed stops, or leave the route quiet?':q.chapter===3?' We have a story here now, not just another place we passed through.':' Next time, I’d like to build on what we found.'}`:`Thanks for checking in. ${storySummary(q)}`;
	}
	function showRouteChoice(resident) {
		if(!resident || partner?.id!==resident.id)return;
		const pending=chronicle.pending(resident.bodyKey,residentKey(resident.id))[0];if(!pending)return;
		const canMark=pending.landmarks.some(t=>t.markerEligible!==false);
		if(!canMark)say('There isn’t a level, dry place for a sign at these stops. Let’s keep this route in the journal.','guide');
		const row=el('div','display:flex;gap:8px;flex-wrap:wrap;');
		for(const [choice,label]of [['marked','Mark the route'],['quiet','Keep it quiet']]) {
			const b=el('button',btnCss,label);if(choice==='marked'&&!canMark){b.disabled=true;b.style.opacity='.45';}
			b.onclick=()=>{
				if(partner?.id!==resident.id)return;
				const r=chronicle.decide(pending.id,choice);if(!r.ok){say(r.error,'note');return;}row.remove();if(r.already)return;routeMarks?.update();
				const line=choice==='marked'?'Then let’s leave a sign for the next person. Your route markers are in place at the surveyed stops.':'Then we leave it as we found it. The route stays in your journal, without signs in the landscape.';
				api.social.state.remember(resident.id,'event',line);perform(line,true);if(r.persisted===false)say(chronicle.status().error,'note');
			};row.append(b);
		}log.append(row);
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
	// The journal's marker: what you chose to track (Quests ▸ Track), else the meeting you are
	// tracking, else the soonest, else a quest's next place.
	let livingContact = null;
	// what you chose to follow: { kind: 'story'|'explore'|'meeting'|'crew'|'contract', id }; null follows
	// the nearest thing due. Kept across visits, like the pin and trail settings.
	let pinned = store.get('bard-tracked', null);
	const wayPrefs = { waypoint: true, wayfinder: true, ...store.get('bard-waypoint-prefs', {}) };
	let wayPrefsSent = false;
	function setPinned(next) { pinned = next; store.set('bard-tracked', next); }
	function setWayPrefs(next) { Object.assign(wayPrefs, next); store.set('bard-waypoint-prefs', wayPrefs); api.waypoint?.setOptions?.(wayPrefs); }
	const floorY = (W, x, z) => { const g = W.island.heightAt(x, z); return W.player.floorAt?.(x, z, g) ?? g; };
	function meetingMark(a) {
		const W = api.world(), S = W?.sky?.state, B = book();
		const q = worldPosition(W, a.place.pos); if (!q || !S) return null;
		const now = B.clock(S.hours), late = now > a.due + EARLY, key = 'meeting:' + a.id;
		if (a.gathering) return { key, x: q.x, y: floorY(W, q.x, q.z) ?? q.y, z: q.z, radius: a.place.radius, title: `${a.gathering.title} · ${a.place.name}`, detail: now > a.due ? `on now, until ${formatClock((a.due + GATHER_HOURS) % 24)}` : meetWhen(a) };
		return { key, x: q.x, y: floorY(W, q.x, q.z) ?? q.y, z: q.z, radius: a.place.radius, title: `Meet ${a.npcName.split(' ')[0]} · ${a.place.name}`, detail: late ? `waiting for you until ${formatClock((a.due + GRACE) % 24)}` : meetWhen(a) };
	}
	// where a story quest's step happens: the place, or (to talk, or to ask for a scouting) the
	// person, where they are now if they are about, else where you met them
	function stepName(step, context = storyContext()) {
		return context.targets.find(t => t.id === step.targetId)?.name || context.npcs.find(n => n.id === step.npcId)?.name || step.targetName || step.npcName || 'the marked place';
	}
	function stepPlace(step, context = storyContext()) {
		const W = api.world(); if (!W || !step) return null;
		if (step.type === 'talk' || step.type === 'scout') {
			const actor = api.social?.actors.all().find(p => p.residentId && residentKey(p.residentId) === step.npcId), at = actor?.M?.S?.pos;
			if (at && [at.x, at.z].every(Number.isFinite)) return { x: at.x, y: Number.isFinite(at.y) ? at.y : floorY(W, at.x, at.z), z: at.z, radius: 4 };
			const home = context.targets.find(t => t.id === 'home:' + step.npcId);
			if (home) return { x: home.x, y: home.y, z: home.z, radius: home.radius || 8 };
			if (step.type === 'talk') return null;
		}
		let t = context.targets.find(t => t.id === step.targetId);
		if (!t && step.targetName) { const f = find(step.targetName); if (f) t = { ...f, radius: 14 }; }
		if (!t) return null;
		return { x: t.x, y: Number.isFinite(t.y) ? t.y : floorY(W, t.x, t.z), z: t.z, radius: t.radius || 14 };
	}
	const STEP_VERB = { visit: 'Explore', return: 'Return to', talk: 'Talk to' };
	function stepWords(step, context = storyContext()) {
		return step.type === 'scout' ? `Ask ${step.npcName || stepName({ npcId: step.npcId }, context)} to scout ${step.targetName || stepName({ targetId: step.targetId }, context)}` : `${STEP_VERB[step.type] || 'Go to'} ${stepName(step, context)}`;
	}
	function storyMark(quest, context = storyContext()) {
		const step = quest?.status === 'active' && quest.steps[quest.cursor];
		const at = step && stepPlace(step, context);
		return at && { ...at, key: 'story:' + quest.id, title: stepWords(step, context), detail: `${quest.title} · step ${quest.cursor + 1} of ${quest.steps.length}` };
	}
	function explorePlace(id) {
		const W = api.world(), q = QUESTS.find(q => q[0] === id), t = W && q?.[2] ? find(q[2]) : null;
		if (!t) return null;
		return { x: t.x, y: Number.isFinite(t.y) ? t.y : t.under ? W.island.heightAt(t.x, t.z) : floorY(W, t.x, t.z), z: t.z, radius: t.under ? 18 : 14, name: t.name };
	}
	function exploreMark(id) {
		const q = QUESTS.find(q => q[0] === id), at = !journal[id] && explorePlace(id);
		return at && { ...at, key: 'explore:' + id, title: q[1], detail: 'Exploration' };
	}
	// the mark for your own choice; a finished or cancelled one lets go (the nearest thing due
	// takes over), one that is only out of reach for now (another world, a person not about) waits
	function pinnedMark(W, key) {
		if (!pinned) return null;
		if (pinned.kind === 'story') {
			const q = stories.list(key).find(q => q.id === pinned.id);
			if (!q) return null;
			if (q.status !== 'active') { setPinned(null); return null; }
			return storyMark(q);
		}
		if (pinned.kind === 'explore') {
			if (journal[pinned.id] || !QUESTS.some(q => q[0] === pinned.id)) { setPinned(null); return null; }
			return exploreMark(pinned.id);
		}
		if (pinned.kind === 'meeting') {
			const a = (book()?.list(key) || []).find(a => a.id === pinned.id);
			if (!a) return null;
			if (a.status !== 'agreed') { setPinned(null); return null; }
			return meetingMark(a);
		}
		if (pinned.kind === 'crew') { const m = W.colony?.crew?.mark?.(); return m && { ...m, key: 'crew:' + (m.key || m.title) }; }
		if (pinned.kind === 'contract') {
			const C = api.combat?.contracts;
			if (!C) return null;
			if (C.info().mission?.id !== pinned.id) { setPinned(null); return null; }
			return C.mark();
		}
		return null;
	}
	function waypointMark() {
		// a catastrophe: someone trapped, hurt, a fire to fight (cataclysm/quests.js) comes first
		const emergency = api.cataclysm?.mark?.();
		if (emergency) return emergency;
		const W = api.world(), S = W?.sky?.state, B = book(), key = api.social?.bodyKey();
		if (!W || !S || !key) return null;
		const chosen = pinnedMark(W, key);
		if (chosen) return chosen;
		// a field contract under way: out in the open, and over if you wander off (combat/contracts-view.js)
		const contract = api.combat?.contracts?.mark?.();
		if (contract) return contract;
		if(livingContact){
			if(livingContact.bodyKey!==key || Math.hypot(livingContact.x-api.camera.position.x,livingContact.z-api.camera.position.z)<4)livingContact=null;
			else return livingContact;
		}
		const living=api.livingWorld?.mark?.();
		if(living && (!living.bodyKey || living.bodyKey===key))return living;
		const open = (B?.list(key) || []).filter(a => a.status === 'agreed').sort((a, b) => a.due - b.due);
		const a = open.find(x => x.id === tracked) || open[0];
		if (a) return meetingMark(a);
		// a fare in the car, or someone hailing you (vehicles/fares.js)
		const fare = api.fares?.mark?.();
		if (fare) return fare;
		// a favour under way for someone you passed (people/errands.js)
		const fav = api.errands?.mark?.();
		if (fav) return fav;
		// a theft out of your sight to follow up: where it happened, or the thief (people/npc-leads.js)
		const lead = api.npcQuests?.mark?.();
		if (lead) return lead;
		// a world's own errands (planet/colony/errands.js)
		const own = W.colony?.crew?.mark?.();
		if (own) return own;
		const active = stories.list(key).filter(q => q.status === 'active'), context = active.length ? storyContext() : null;
		for (const quest of active) {
			const m = storyMark(quest, context);
			if (m) return m;
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
	let tick = 0, lastPlace = '', projectProgressTick = 0;
	function watch(dt) {
		projectProgressTick+=Math.max(0,Number(dt)||0);
		if(projectProgressTick>=.2 || dt===0){projectProgressTick=0;updateProjectProgress();updateQuestLive();}
		if (!wayPrefsSent && api.waypoint?.setOptions) { wayPrefsSent = true; api.waypoint.setOptions(wayPrefs); }
		tick += dt;
		if (tick < 1) return;
		tick = 0;
		const W = api.world(); if (!W) return;
		if (!appointmentHistory && api.social) { appointmentHistory=true; api.social.onAppointment(e=>chronicle.meeting(e.appointment,e.type,residentKey(e.appointment.npcId))); }
		for(const p of api.social?.actors.all() || []) if(p.residentId) {const r=api.social.state.get(p.residentId);if(r)for(const e of p.awarenessEvents || [])chronicle.witness(r.bodyKey,residentKey(r.id),r.persona.name,e,api.combat?.morality.info().cleansedAt || 0);}
		routeMarks?.update();
		const cam = api.camera.position, P = W.player.state, g = W.island.heightAt(cam.x, cam.z), hours = W.sky.state.hours;
		api.waypoint?.set(waypointMark());
		const questWorld=storyContext();
		for (const q of stories.list(questWorld.bodyKey)) if(q.status==='complete') questChanged(q,false);
		for (const q of stories.update({bodyKey:questWorld.bodyKey,position:{x:cam.x,y:cam.y-1.7,z:cam.z},targets:questWorld.targets})) questChanged(q);
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
Community projects have their own review and work controls. Discuss only their saved status in WORLD NOW; never claim to construct, complete, purchase or change ownership through conversation. A proposal, survey or pending work is not a completed improvement.
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
	function personContext(p=partner?.p,resident=partner?.id && api.social?.state.get(partner.id)) {
		const completed=stories.list(api.social?.bodyKey()).filter(q=>q.status==='complete' && q.offeredBy===residentKey(resident?.id||'')).map(q=>q.title);
		const relationship=resident?chronicle.relationship(resident.bodyKey,residentKey(resident.id)):null;
		const c=awarenessContext({...api.combat?.perception?.(p),relationship,work:p?.workContext || resident?.workContext,completed,known:(resident?.metCount||0)>1,visit:resident?.metCount || 0,seed:p?.P?.dna?.seed || 0});
		const promised=resident&&stories.list(resident.bodyKey).find(q=>q.offeredBy===residentKey(resident.id)&&q.status==='active');
		if(promised)c.facts.push(`The traveller promised to help with “${promised.title}”. ${readyReports(resident).some(q=>q.id===promised.id)?'They have reached the report-back step; ask what they noticed, do not declare it finished yet.':'The next objective is still unfinished. Ask how it is going, without assuming failure or inventing a deadline.'}`);
		// (a favour under way with this person: they know what they asked, errands.js)
		const fav=api.errands?.factFor?.(p); if(fav) c.facts=[...c.facts,fav].slice(0,7);
		// (what they did or saw lately, and their money talk: people/npc-quests.js)
		const own=api.npcQuests?.factsFor?.(p)||[]; if(own.length) c.facts=[...c.facts,...own].slice(0,8);
		const living=api.livingWorld?.factsFor?.(p)||[]; if(living.length)c.facts=[...c.facts,...living].slice(-10);
		const community=communityProjectFacts(api.communityProjects?.snapshot?.());if(community.length)c.facts=[...c.facts,...community].slice(-10);
		const market=api.negotiation?.contextFor?.(p);
		if(market?.sellerId)c.facts=[...c.facts,`Trade: ${market.reason || 'Only the current quoted terms are binding.'}${market.pendingOffer ? ' Current offer: '+market.pendingOffer.itemName+' for '+market.pendingOffer.price+' credits; '+market.pendingOffer.status+'.' : ''}`].slice(-10);
		return c;
	}

	function talkTo(p) { return guideTalkTo(gd, p); }
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
		localSpeech.cancel();
		if ('speechSynthesis' in window) speechSynthesis.cancel();
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
			...personContext().facts,
			`has lived around here about ${pp.years} years`, `right now: ${pp.errand}, feeling ${pp.mood}`, `likes ${pp.hobby}`,
			...(partner?.id ? [api.social.describe(api.social.state.get(partner.id)), ...(api.social.state.get(partner.id)?.memories || []).slice(-6).map(m => m.content)] : []),
			...(pp.facts || []), ...(pp.tattoos || []).slice(0, 2).map((t) => 'a tattoo: ' + t),
			world?.time ? 'the time: ' + world.time : '', near.length ? 'nearby: ' + near.join(', ') : '',
			...(partner?.id && api.social.appointments?.agreedWith(partner.id, api.social.bodyKey()) ? [(a => a.gathering ? `is hosting a ${a.gathering.title.toLowerCase()} at ${a.place.name} at ${formatClock(a.due % 24)} and has invited the player` : `has agreed to meet the player at ${a.place.name} at ${formatClock(a.due % 24)}`)(api.social.appointments.agreedWith(partner.id, api.social.bodyKey()))] : []),
			'when arranging to meet, always names one exact place and a clock time, never a vague promise',
			'when asked to gather people, or to host a concert, party, picnic or meet-up, the game organises it for real',
		].filter(Boolean);
		return { name: pp.name, age: pp.age, job: pp.job, place: pp.place, region: pp.region || '', lang: pp.lang || '', temper: pp.style, facts:facts.slice(0,10), places: near, dialogueStyle:normalizeDialogueStyle(dialogueStyle,pp.age) };
	}
	function showAgreement(offer, P2 = partner) {
		const terms = agreementTerms(offer);
		if (!terms || partner !== P2) return;
		say(terms.line, 'note');
		if (!terms.action) return;
		const row = el('div', 'display:flex;gap:8px;flex-wrap:wrap;');
		const agree = el('button', btnCss, terms.label), cancel = el('button', btnCss, 'Leave this offer');
		async function run(action) {
			if (partner !== P2) return;
			const current = api.negotiation?.contextFor?.(P2.p)?.pendingOffer;
			if (!current || current.id !== offer.id) { row.remove(); say('That offer is no longer current. Ask for the latest terms.', 'note'); return; }
			agree.disabled = cancel.disabled = true;
			const decision=action==='cancel'?'Leave this offer.':`${action==='confirm'?'Confirm the terms for':'Complete the agreed exchange for'} ${offer.itemName} at ${offer.price} credits${offer.condition?.label ? ', with this condition: '+offer.condition.label : ''}.`;
			say(decision,'me');archiveTurn(threadMeta(P2),'user',decision);if(P2.id)api.social.state.remember(P2.id,'user',decision);
			try {
				const result = await api.negotiation?.[action]?.(P2.p, offer.id);
				if (partner !== P2) return;
				row.remove();
				const message = result?.message || result?.error || 'No exchange was made.';
				perform(message, true); if(P2.id)api.social.state.remember(P2.id, 'assistant', message);
				if (action !== 'cancel') showAgreement(result?.offer || api.negotiation?.contextFor?.(P2.p)?.pendingOffer, P2);
			} catch { if(partner===P2){say('The agreement could not be checked. Please try again.', 'note');agree.disabled=cancel.disabled=false;} }
		}
		agree.onclick=()=>run(terms.action); cancel.onclick=()=>run('cancel'); row.append(agree,cancel);log.append(row);
	}
	async function negotiate(text, P2, signal) {
		const context = api.negotiation?.contextFor?.(P2.p);
		if (!context) return null;
		let local=offlineNegotiationIntent(text,context);
		// The older gear parser knows catalog aliases such as "get a rifle". It
		// may select a quote, but must never bypass this explicit-consent boundary.
		const gear=api.arms?.parse?.(text);
		if(gear?.kind==='purchase' && gear.item && local.kind==='none')local=context.stock?.some(s=>s.id===gear.item)?{kind:'quote',itemId:gear.item,amount:null,confidence:1}:{kind:'clarify',question:'Which of this seller’s available items would you like a quote for?'};
		if(context.available===false || !context.sellerId || !context.stock?.length&&!context.pendingOffer)return local.kind!=='none'?{message:context.reason||'I do not have available stock to make that offer.'}:null;
		const options = {context,text,history:P2.id ? api.social.state.get(P2.id)?.history : P2.history};
		let intent = local;
		// Unusual language is classified against actual seller stock, not a list of
		// magic phrases. This is a proposal only, never authority to buy or pay.
		if (intent.kind === 'none' && intent.reason === 'unrecognized' || intent.kind === 'clarify') {
			const raw = await planChat(buildNegotiationMessages(options), signal, {kind:'negotiation_intent',context:buildNegotiationContext(options)});
			if (raw) intent = decodeNegotiationIntent(raw, options);
		}
		if (signal.aborted || partner !== P2 || api.negotiation?.contextFor?.(P2.p)?.bodyKey !== context.bodyKey) return null;
		if (intent.kind === 'none') return null;
		if (intent.kind === 'clarify') return {message:intent.question};
		if (['review','status'].includes(intent.kind)) return {message:'Here are the current terms. You choose whether to proceed.',offer:context.pendingOffer};
		if (intent.kind === 'decline') return await api.negotiation?.cancel?.(P2.p,context.pendingOffer?.id) || {message:'We can leave that offer for now.'};
		try { return await api.negotiation.propose(P2.p,intent); }
		catch { return {message:'I cannot check a reliable offer right now. No exchange was made.'}; }
	}
	const communityScope = snapshot => snapshot?.scope?.key || [snapshot?.scope?.world || api.social?.bodyKey?.(),snapshot?.scope?.region || snapshot?.scope?.id].filter(Boolean).join(':');
	async function projectConversation(text, P2, signal) {
		const snapshot=api.communityProjects?.snapshot?.();
		if(!snapshot)return null;
		const scope=communityScope(snapshot), context={bodyKey:snapshot.scope?.world || api.social?.bodyKey?.(),scopeKey:scope,candidates:snapshot.candidates.filter(c=>!snapshot.projects.some(p=>p.siteId===(c.siteId || c.id))),projects:snapshot.projects};
		const options={context,text,history:P2 ? (P2.id ? api.social.state.get(P2.id)?.history : P2.history) : history};
		let intent=offlineCommunityProjectIntent(text,context);
		if(intent.kind==='none' && intent.reason==='unrecognized' && communityProjectRelevant(text) || intent.kind==='clarify') {
			const raw=await planChat(buildCommunityProjectMessages(options),signal,{kind:'community_project_intent',context:buildCommunityProjectContext(options)});
			if(raw)intent=decodeCommunityProjectIntent(raw,options);
		}
		if(signal.aborted || partner!==P2 || communityScope(api.communityProjects.snapshot())!==scope)return null;
		if(intent.kind==='none')return null;
		if(intent.kind==='clarify')return {message:intent.question};
		if(intent.kind==='status')return {message:'The community journal shows what people are working on, who has helped, and what is still needed.',open:true};
		const candidate=snapshot.candidates.find(c=>c.id===intent.candidateId);
		return {message:`A ${projectKindLabel(intent.projectKind).toLowerCase()} at ${candidate.name} could make a lasting difference. Review the site first. It needs a survey and three contributions of work, followed by about a day to take shape.`,review:{candidateId:candidate.id,kind:intent.projectKind,scope}};
	}
	function showProjectReview(review, P2=partner) {
		if(partner!==P2)return;
		const epoch=viewEpoch, snapshot=api.communityProjects?.snapshot?.(), candidate=snapshot?.candidates?.find(c=>c.id===review.candidateId);
		if(!candidate || !candidate.kinds.includes(review.kind) || communityScope(snapshot)!==review.scope)return;
		if(snapshot.projects.some(p=>p.siteId===(candidate.siteId || candidate.id))){say('This site already has a community project. Open Story to check its progress.','note');return;}
		say(`${projectKindLabel(review.kind)} · ${candidate.name}\nSurvey here for 5 seconds, then contribute three 30-second sessions of work. Once the work is accepted, the improvement takes about 24 hours to settle in. No money or ownership changes are part of this proposal.`,'note');
		const row=el('div','display:flex;gap:8px;flex-wrap:wrap;'), confirm=el('button',btnCss,'Propose '+projectKindLabel(review.kind).toLowerCase()), cancel=el('button',btnCss,'Leave this idea');
		confirm.onclick=async()=>{
			if(partner!==P2 || viewEpoch!==epoch)return;
			if(communityScope(api.communityProjects.snapshot())!==review.scope){row.remove();say('You have moved to another area. Review a site here first.','note');return;}
			confirm.disabled=cancel.disabled=true;
			const decision=`Propose a ${projectKindLabel(review.kind).toLowerCase()} at ${candidate.name}.`;say(decision,'me');archiveTurn(P2?threadMeta(P2):guideMeta,'user',decision);if(P2?.id)api.social.state.remember(P2.id,'user',decision);
			try {
				const result=await api.communityProjects.action(review.candidateId,'propose',{kind:review.kind});
				if(partner!==P2 || viewEpoch!==epoch)return;
				row.remove();const message=result?.message || result?.error || 'The proposal could not be saved.';
				if(P2){perform(message,true);if(P2.id)api.social.state.remember(P2.id,'assistant',message);}
				else {say(message,'note');archiveTurn(guideMeta,'assistant',message);}
				if(result?.ok){const open=el('button',btnCss,'Open community projects');open.onclick=showStory;log.append(open);}
			}catch{if(viewEpoch===epoch && partner===P2){say('The proposal could not be checked. Please try again.','note');confirm.disabled=cancel.disabled=false;}}
		};
		cancel.onclick=()=>row.remove();row.append(confirm,cancel);log.append(row);scroll();
	}
	function showScheduleReview(intent,P2) {
		if(partner!==P2)return;
		const epoch=viewEpoch, scope=api.livingWorld?.snapshot?.().scope?.key, row=el('div','display:flex;gap:8px;flex-wrap:wrap;');
		const button=el('button',btnCss,intent.label), leave=el('button',btnCss,'Leave things as they are');
		button.onclick=async()=>{
			if(partner!==P2 || viewEpoch!==epoch)return;
			const current=api.livingWorld.snapshot();
			if(current.scope?.key!==scope || !current.activities.some(a=>a.id===intent.requestId && a.npcId===livingActorId(P2.p) && a.canIntervene && a.choices.some(c=>c.id===intent.choiceId && c.effect===intent.effect))){row.remove();say('That activity has changed. Ask me about the current work.','note');return;}
			button.disabled=leave.disabled=true;
			const decision=`${intent.label}: ${intent.title}.`;say(decision,'me');archiveTurn(threadMeta(P2),'user',decision);if(P2.id)api.social.state.remember(P2.id,'user',decision);
			try{const result=await api.livingWorld.action(intent.requestId,'intervene',{choiceId:intent.choiceId});if(partner!==P2 || viewEpoch!==epoch)return;row.remove();const message=result?.message || result?.error || 'No change was agreed.';perform(message,true);if(P2.id)api.social.state.remember(P2.id,'assistant',message);}
			catch{if(partner===P2 && viewEpoch===epoch){say('The request could not be checked. Please try again.','note');button.disabled=leave.disabled=false;}}
		};
		leave.onclick=()=>row.remove();row.append(button,leave);log.append(row);
	}
	function askPerson(text) { return guideAskPerson(gd, text); }
	function ask(text) { return guideAsk(gd, text); }

	// ---------- voice ----------
	let voiceOut = store.get('crysis-guide-voice', true);
	// Voices: best available, device only, or local always (preferences.js voiceMode)
	let speechMode = voiceMode(store.get('crysis-voices', null), store.get('crysis-speech-mode', null));
	let speechStatus = '';
	const localSpeech = createLocalSpeech({ onStatus: text => { speechStatus = text; speechStatusEl.textContent = text; }, fallback: deviceSpeak, mode: () => speechMode });
	mount.addEventListener('pointerdown', () => { if (voiceOut && speechMode !== 'device') localSpeech.unlock(); }, { capture: true });
	// keyboard players never tap: the first key unlocks the voices too
	addEventListener('keydown', () => { if (voiceOut && speechMode !== 'device') localSpeech.unlock(); }, { capture: true, once: true });
	function speak(t, who) {
		if (!t) return;
		if ('speechSynthesis' in window) speechSynthesis.cancel();
		const dna = partner?.p?.P?.dna;
		if (speechMode === 'device') deviceSpeak(t, who);
		else {
			// the same voice, pitch and pace the person has when they speak in passing
			const shape = dna ? voiceShape(dna) : { pitch: 1, rate: 1 };
			localSpeech.speak(t, { ...who, seed: dna?.seed ?? 0, male: dna?.male ?? true, rate: who?.voice?.rate || shape.rate, pitch: shape.pitch });
		}
	}
	function deviceSpeak(t, who) {
		if (!('speechSynthesis' in window) || !t) return;
		speechSynthesis.cancel();
		const u = new SpeechSynthesisUtterance(t);
		u.rate = 1.02; u.pitch = 1;
		const all = speechSynthesis.getVoices().filter((x) => /^en/.test(x.lang));
		let v = all.find((x) => /en[-_](US|GB)/.test(x.lang) && /natural|samantha|google|premium/i.test(x.name)) || all[0];
		// a person gets a voice of their own: the nearest the device has to their local one, by
		// sex and seed, pitched and paced like it (local-speech-plan.js)
		const d = partner?.p?.P?.dna;
		if (who && d && all.length) {
			const near = deviceVoiceFor({ ...voiceShape(d), seed: d.seed ?? 0, male: d.male ?? true }, all);
			v = near.voice; u.pitch = near.pitch; u.rate = near.rate;
			// (a teen's own voice: teens.js voiceFor)
			if (who.voice) { u.pitch = who.voice.pitch; u.rate = who.voice.rate; }
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
	const btnCss = 'min-width:40px;min-height:40px;max-width:100%;white-space:normal;overflow-wrap:anywhere;padding:6px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#eafaf6;font:600 13px var(--bard-display,system-ui,sans-serif);cursor:pointer;';
	const open = el('button', 'position:absolute;width:44px;min-height:44px;border-radius:12px;border:1px solid rgba(1,169,130,.7);background:rgba(8,20,26,.55);color:#9fe8d0;font:600 18px var(--bard-display,system-ui,sans-serif);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer;', '✦');
	open.dataset.hud = 'rail 40';
	open.title = 'Talk to the guide (G)'; open.setAttribute('aria-label', 'Talk to the guide');
	const panel = el('div', 'position:absolute;left:calc(12px + env(safe-area-inset-left));bottom:calc(12px + env(safe-area-inset-bottom));width:min(420px,calc(100vw - 24px));max-height:min(80vh,560px);display:none;flex-direction:column;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(10,14,18,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 20px 60px rgba(0,0,0,.6);color:#f2f5f4;font:14px/1.45 var(--bard-body,system-ui,sans-serif);z-index:5;');
	// (a dialog: over the touch HUD's buttons while it is open, so none sits on its close button)
	if (mount.classList?.contains('l99-touch')) panel.style.zIndex = '16';
	panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'The Guide');
	const head = el('div', 'flex-shrink:0;display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);');
	const title = el('div', 'flex:1;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font:600 13px var(--bard-display,system-ui,sans-serif);letter-spacing:.06em;color:#9fe8d0;', 'THE GUIDE');
	const statusEl = el('div', 'font:11px var(--bard-body,system-ui,sans-serif);color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;');
	const speechStatusEl = el('div', 'font:11px var(--bard-body,system-ui,sans-serif);color:#a5cfc0;padding:0 12px 6px;', speechStatus);
	speechStatusEl.setAttribute('role', 'status');
	const gearB = el('button', btnCss, '⚙'); gearB.title = 'Model settings'; gearB.setAttribute('aria-label', 'Model settings');
	const closeB = el('button', btnCss, '✕'); closeB.setAttribute('aria-label', 'Close the guide');
	const residentsB = el('button', btnCss, 'People'); residentsB.setAttribute('aria-label', 'Remembered people');
	head.append(title, statusEl, gearB, closeB);
	const questB = el('button', btnCss, 'Quests'); questB.setAttribute('aria-label','Story quests');
	const tabs = el('div','display:flex;flex-wrap:wrap;flex-shrink:0;gap:8px;padding:4px 12px;'); const archiveB=el('button',btnCss,'Conversations');archiveB.setAttribute('aria-label','Conversation archive');const storyB=el('button',btnCss,'Story');storyB.setAttribute('aria-label','Your story: local activity, standing, favours and fares');tabs.append(residentsB,questB,storyB,archiveB);
	const archiveControls=el('div','display:none;flex-shrink:0;padding:6px 12px;gap:6px;flex-wrap:wrap;');
	const archiveSearch=el('input','min-width:0;flex:1;padding:8px;background:#172225;border:1px solid #586567;border-radius:8px;color:#fff;');archiveSearch.type='search';archiveSearch.name='conversation-search';archiveSearch.placeholder='Search every conversation';archiveSearch.setAttribute('aria-label','Search conversations');
	const archiveExport=el('button',btnCss,'Export'); archiveControls.append(archiveSearch,archiveExport);
	const settings = el('div', 'display:none;max-height:45vh;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);font:12px var(--bard-body,system-ui,sans-serif);color:rgba(255,255,255,.8);');
	const log = el('div', 'flex:1;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-height:0;');
	log.setAttribute('aria-live', 'polite');
	const bar = el('div', 'flex-shrink:0;display:flex;gap:6px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);');
	const input = el('input', 'flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font:14px var(--bard-body,system-ui,sans-serif);outline:none;');
	input.name = 'guide-message'; input.placeholder = 'Ask anything, or "take me to Alcatraz"'; input.setAttribute('aria-label', 'Message the guide');
	const mic = el('button', btnCss, '🎙'); mic.title = 'Speak'; mic.setAttribute('aria-label', 'Speak to the guide');
	const spk = el('button', btnCss, voiceOut ? '🔊' : '🔈'); spk.setAttribute('aria-pressed', String(voiceOut)); spk.title = 'Read replies aloud'; spk.setAttribute('aria-label', 'Read replies aloud');
	const send = el('button', btnCss + 'background:linear-gradient(135deg,#01a982,#10b981);border:none;', '➤'); send.setAttribute('aria-label', 'Send');
	bar.append(input, mic, spk, send);
	panel.append(head, tabs, archiveControls, settings, log, bar);
	panel.append(speechStatusEl);
	// (the guide has no button in the sidebar any more; G still opens it)
	open.hidden = true;
	mount.append(open, panel);
	// keep typing and taps out of the game's controls
	for (const ev of ['keydown', 'keyup', 'pointerdown', 'touchstart', 'wheel']) { panel.addEventListener(ev, (e) => e.stopPropagation()); open.addEventListener(ev, (e) => e.stopPropagation()); }

	function say(text, who) {
		const b = el('div', who === 'me' ? 'align-self:flex-end;max-width:85%;padding:8px 11px;border-radius:12px 12px 4px 12px;background:rgba(1,169,130,.22);border:1px solid rgba(1,169,130,.35);'
			: who === 'note' ? 'align-self:center;font:12px var(--bard-body,system-ui,sans-serif);color:rgba(255,255,255,.55);' : 'align-self:flex-start;max-width:90%;padding:8px 11px;border-radius:12px 12px 12px 4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);', text);
		b.style.whiteSpace = 'pre-line';
		b.style.overflowWrap='anywhere';b.style.boxSizing='border-box';if(who==='note')b.style.maxWidth='100%';
		log.append(b); scroll();
		return b;
	}
	const scroll = () => { log.scrollTop = log.scrollHeight; };
	const show = (on) => { panel.style.display = on ? 'flex' : 'none'; open.style.display = 'none'; if (on) { if (view !== 'quests') setTimeout(() => input.focus(), 30); if (!log.children.length && view==='guide') greet(); } else { input.blur(); localSpeech.cancel(); if ('speechSynthesis' in window) speechSynthesis.cancel(); } };
	function greet() {
		const s = snapshot();
		say(s ? `Hello. You're on ${s.place}. Ask me anything — where to go, what something is, or what to do next.` : 'Hello.', 'guide');
		if (llm.kind() === 'none') say('Running without a model. ⚙ loads one on this device for real conversation.', 'note');
	}
	function showPeople() {
		endTalk(); resetView('people'); show(true);
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
	function renderArchive() { return guideArchive(gd); }
	archiveSearch.addEventListener('input',()=>{archivePage=0;renderArchive();});
	archiveExport.onclick=()=>{const url=URL.createObjectURL(new Blob([archive.exportJSON()],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='bard-conversations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};

	// ---------- Quests: what you are doing, what is next, and the way there ----------
	// (cards, not lines of chat: the step you are on stands out, the done ones step back, and
	// each place says how far and which way, and can be tracked: pin, marker and trail)
	const QC = { teal: '#5ff0c6', green: '#10b981', amber: '#f59e0b', grey: 'rgba(255,255,255,.45)' };
	const qcss = {
		section: 'display:flex;align-items:baseline;gap:8px;margin:10px 2px 0;font:700 11px/1.2 var(--bard-display,system-ui,sans-serif);letter-spacing:.09em;text-transform:uppercase;color:#9fe8d0;',
		count: 'margin-left:auto;font:600 11px var(--bard-display,system-ui,sans-serif);letter-spacing:.02em;text-transform:none;color:rgba(255,255,255,.5);',
		card: 'display:flex;flex-direction:column;gap:8px;padding:12px 12px 12px 14px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.1);box-sizing:border-box;',
		title: 'font:600 15px/1.3 var(--bard-display,system-ui,sans-serif);color:#fff;overflow-wrap:anywhere;',
		body: 'font:13px/1.45 var(--bard-body,system-ui,sans-serif);color:rgba(255,255,255,.7);overflow-wrap:anywhere;',
		meta: 'font:500 12px/1.35 var(--bard-body,system-ui,sans-serif);color:rgba(255,255,255,.55);',
		row: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;',
		primary: btnCss + 'background:linear-gradient(135deg,#01a982,#10b981);border-color:transparent;color:#fff;padding:6px 14px;',
		ghost: btnCss + 'background:transparent;color:rgba(255,255,255,.75);',
	};
	let questLive = [];
	const qel = (tag, style, text) => el(tag, style, text);
	function markTab(next) {
		const on = { people: residentsB, quests: questB, story: storyB, archive: archiveB }[next];
		for (const b of [residentsB, questB, storyB, archiveB]) {
			const active = b === on;
			b.setAttribute('aria-pressed', String(active));
			b.style.background = active ? 'rgba(1,169,130,.22)' : 'rgba(255,255,255,.06)';
			b.style.borderColor = active ? 'rgba(1,169,130,.7)' : 'rgba(255,255,255,.22)';
		}
	}
	function questPill(text, color) {
		const p = qel('span', `display:inline-flex;align-items:center;padding:2px 8px;border-radius:999px;font:700 10.5px/1.5 var(--bard-display,system-ui,sans-serif);letter-spacing:.07em;text-transform:uppercase;color:${color};background:color-mix(in srgb, ${color} 18%, transparent);border:1px solid color-mix(in srgb, ${color} 40%, transparent);white-space:nowrap;`, text);
		return p;
	}
	function section(label, count) {
		const h = qel('div', qcss.section, label);
		h.setAttribute('role', 'heading'); h.setAttribute('aria-level', '3');
		if (count) h.append(qel('span', qcss.count, count));
		log.append(h); return h;
	}
	const SHORT = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
	const shortDir = (dx, dz) => SHORT[Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360) / 45) % 8];
	// how far and which way: an arrow turned to where you look, the distance and the bearing
	// (kept current while Quests is open)
	function bearing(at, big = false) {
		const b = qel('span', `display:inline-flex;align-items:center;gap:6px;font:600 ${big ? 13 : 12}px/1.2 var(--bard-display,system-ui,sans-serif);color:${QC.teal};white-space:nowrap;font-variant-numeric:tabular-nums;`);
		const a = qel('span', `display:inline-flex;width:${big ? 18 : 15}px;height:${big ? 18 : 15}px;align-items:center;justify-content:center;`);
		a.innerHTML = `<svg width="${big ? 15 : 13}" height="${big ? 15 : 13}" viewBox="0 0 24 24" fill="${QC.teal}" aria-hidden="true"><path d="M12 2 20 21l-8-4.5L4 21z"/></svg>`;
		const t = qel('span', '');
		b.append(a, t);
		questLive.push({ at, arrow: a, text: t });
		paintBearing(questLive.at(-1));
		return b;
	}
	function paintBearing(r) {
		const cam = api.camera.position, dx = r.at.x - cam.x, dz = r.at.z - cam.z, d = Math.hypot(dx, dz);
		// (where you look: the camera's forward, the negated third column of its world matrix)
		const e = api.camera.matrixWorld.elements;
		r.arrow.style.transform = `rotate(${Math.atan2(dx, -dz) - Math.atan2(-e[8], e[10])}rad)`;
		const words = d < (r.at.radius || 10) ? 'You are here' : `${fmtDist(d)} · ${shortDir(dx, dz)}`;
		if (r.text.textContent !== words) r.text.textContent = words;
	}
	function updateQuestLive() {
		if (view !== 'quests' || panel.style.display === 'none') return;
		for (const r of questLive) {
			if (r.at.live) { const m = api.waypoint?.mark?.(); if (m) { r.at.x = m.x; r.at.z = m.z; r.at.radius = m.radius; if (r.title && r.title.textContent !== m.title) r.title.textContent = m.title; } }
			paintBearing(r);
		}
	}
	// Track: this is the one to follow. The panel closes and you turn to face it.
	function trackButton(follow, kind, id) { return guideTrackButton(gd, follow, kind, id); }
	function toggle(label, hintText, on, set) {
		const b = qel('button', btnCss + 'display:inline-flex;align-items:center;gap:8px;padding:6px 10px 6px 8px;');
		b.setAttribute('role', 'switch'); b.setAttribute('aria-checked', String(on)); b.title = hintText;
		const track = qel('span', `position:relative;flex-shrink:0;width:30px;height:18px;border-radius:9px;background:${on ? '#01a982' : 'rgba(255,255,255,.18)'};transition:background .2s ease;`);
		const knob = qel('span', `position:absolute;top:2px;left:${on ? 14 : 2}px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.4);transition:left .2s ease;`);
		track.append(knob);
		b.append(track, qel('span', `color:${on ? '#fff' : 'rgba(255,255,255,.6)'};`, label));
		b.onclick = () => { set(!on); showQuests(); };
		return b;
	}
	function trackingCard() { return guideTrackingCard(gd); }
	// a step of a quest: done (a green tick, stepped back), the one you are on (bright, with the
	// way there), or still to come (plain)
	function stepRow(state, words, at) {
		const r = qel('div', `display:flex;align-items:flex-start;gap:10px;padding:${state === 'now' ? '8px 10px' : '2px 10px'};border-radius:8px;${state === 'now' ? 'background:rgba(1,169,130,.12);' : ''}`);
		const dot = qel('span', 'flex-shrink:0;width:18px;height:18px;margin-top:1px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-sizing:border-box;' + (state === 'done' ? `background:${QC.green};` : state === 'now' ? `border:2px solid ${QC.teal};box-shadow:0 0 8px rgba(95,240,198,.5);` : 'border:1.5px solid rgba(255,255,255,.35);'));
		if (state === 'done') dot.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5 10 17 19 7"/></svg>';
		else if (state === 'now') dot.append(qel('span', `width:8px;height:8px;border-radius:50%;background:${QC.teal};`));
		const text = qel('div', 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;');
		text.append(qel('span', state === 'done' ? 'font:13px/1.35 var(--bard-body,system-ui,sans-serif);color:rgba(255,255,255,.45);' : state === 'now' ? 'font:600 14px/1.35 var(--bard-body,system-ui,sans-serif);color:#fff;' : 'font:13px/1.35 var(--bard-body,system-ui,sans-serif);color:rgba(255,255,255,.72);', words));
		if (at) text.append(bearing(at));
		r.append(dot, text);
		r.setAttribute('aria-label', `${state === 'done' ? 'Done' : state === 'now' ? 'Current' : 'To come'}: ${words}`);
		return r;
	}
	function progressBar(done, total, color = QC.teal) {
		const wrap = qel('div', 'display:flex;align-items:center;gap:8px;');
		const bar = qel('div', 'flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,.1);overflow:hidden;');
		bar.append(qel('div', `height:100%;width:${Math.round(100 * done / Math.max(1, total))}%;background:${color};border-radius:2px;`));
		wrap.append(bar, qel('span', qcss.meta + 'font-variant-numeric:tabular-nums;', `${done} of ${total}`));
		wrap.setAttribute('aria-label', `${done} of ${total} done`);
		return wrap;
	}
	function questCard(q, bodyKey, context) { return guideQuestCard(gd, q, bodyKey, context); }
	function folded(label, count) {
		const d = qel('details', 'border-radius:10px;');
		const s = qel('summary', 'cursor:pointer;padding:8px 2px;font:600 12px var(--bard-display,system-ui,sans-serif);color:rgba(255,255,255,.6);list-style-position:inside;', `${label} (${count})`);
		const inner = qel('div', 'display:flex;flex-direction:column;gap:8px;padding-top:4px;');
		d.append(s, inner); log.append(d);
		return inner;
	}
	function showQuests() { return guideQuests(gd); }
	// your story so far: who the world takes you for, and what you have done for it
	let livingActivityPage=0,livingActivityScope=null,communityPage=0,communityPageScope=null;
	function updateProjectProgress() {
		const record=projectProgressView;
		if(!record || record.epoch!==viewEpoch || view!=='story' || panel.style.display==='none')return;
		const snapshot=api.communityProjects?.progress?.() || api.communityProjects?.snapshot?.(), active=snapshot?.active;
		if(communityScope(snapshot)!==record.scope || !active || active.projectId!==record.projectId || active.kind!==record.kind){record.line.textContent='Work stopped. Return to the site and start again.';record.finish.disabled=true;record.resume.hidden=false;return;}
		const elapsed=Math.max(0,Number(active.elapsedMs)||0), duration=Math.max(1,Number(active.durationMs)||1), ready=elapsed>=duration;
		record.line.textContent=ready?'Your contribution is ready to record.':`${active.kind==='survey'?'Surveying':'Working'} · ${Math.min(Math.floor(elapsed/1000),Math.ceil(duration/1000))}/${Math.ceil(duration/1000)} seconds. Stay here until finished.`;
		record.progress.value=Math.min(1,elapsed/duration);record.finish.disabled=!ready || record.pending;record.finish.style.opacity=record.finish.disabled?'.45':'1';record.resume.hidden=true;
	}
	function showCommunityProjects() { return guideCommunityProjects(gd); }
	function showLivingActivity() { return guideLivingActivity(gd); }
	function showStory() { return guideStory(gd); }
	function showCaves() { return guideCaves(gd); }
	archiveB.onclick=()=>showArchive();
	questB.onclick=showQuests;
	storyB.onclick=showStory;
	residentsB.onclick = showPeople;
	open.onclick = () => show(true);
	closeB.onclick = () => { endTalk(); show(false); };
	send.onclick = () => { const t = input.value; input.value = ''; ask(t); };
	input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { send.onclick(); } if (e.key === 'Escape') { endTalk(); show(false); } });
	mic.onclick = listen;
	spk.onclick = () => { voiceOut = !voiceOut; store.set('crysis-guide-voice', voiceOut); spk.textContent = voiceOut ? '🔊' : '🔈'; spk.setAttribute('aria-pressed', String(voiceOut)); if (!voiceOut) { localSpeech.cancel(); if ('speechSynthesis' in window) speechSynthesis.cancel(); } else if (speechMode !== 'device') localSpeech.unlock(); };
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
	function drawSettings() { return guideSettings(gd); }
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
	const pill = el('div', 'position:absolute;right:calc(var(--l99-menu-r, 64px) + env(safe-area-inset-right));top:calc(72px + var(--l99-top, env(safe-area-inset-top)));padding:5px 10px;border-radius:10px;background:rgba(8,20,26,.6);color:#9fe8d0;font:11px var(--bard-body,system-ui,sans-serif);pointer-events:none;display:none;');
	mount.append(pill);
	llm.onStatus((st) => {
		if (llm.kind() !== 'webllm') { pill.style.display = 'none'; return; }
		if (/could not load|no WebGPU/i.test(st.text)) { pill.textContent = '✦ people will use simple replies'; pill.style.display = ''; setTimeout(() => { pill.style.display = 'none'; }, 4000); llm.useNone(); return; }
		if (!st.ready && st.progress < 1) { pill.style.display = ''; pill.textContent = `✦ voices loading ${Math.round((st.progress || 0) * 100)}%`; }
		else if (st.ready) { pill.textContent = '✦ people can talk now'; setTimeout(() => { pill.style.display = 'none'; }, 3500); }
	});
	llm.onStatus((st) => { if (st.ready && llm.kind() === 'webllm') store.set('crysis-guide-loaded', true); });

	// the same voices for what people say in passing (people/chatter.js): never over a conversation
	const voice = {
		on: () => voiceOut, mode: () => speechMode, talking: () => !!partner || localSpeech.busy() && !voice.remarking,
		remarking: false,
		remark(text, dna, place) {
			const ok = localSpeech.remark(text, { seed: dna.seed ?? 0, male: dna.male ?? true, ...voiceShape(dna) }, { ...place, done: (played) => { voice.remarking = false; place.done?.(played); } });
			if (ok) voice.remarking = true;
			return ok;
		},
		place: (p, f) => localSpeech.place(p, f),
		unlock: () => localSpeech.unlock(), warm: () => localSpeech.warm(), ready: () => localSpeech.ready(),
		// a phone loads the local voices only once the world has been calm a while
		tick: (dt, state) => localSpeech.tick(dt, state),
		// let the local model go (the quality governor, when a phone is short of memory: main.js)
		unload: () => localSpeech.unload(),
		// the device's nearest voice to a person's own, for the device-only setting
		device: (dna) => deviceVoiceFor({ seed: dna.seed ?? 0, male: dna.male ?? true, ...voiceShape(dna) }, 'speechSynthesis' in window ? speechSynthesis.getVoices() : []),
	};
	// the name and character a passer-by has, the same one a conversation with them will use
	function personaOf(p) {
		let rec = people.get(p);
		if (!rec || rec.seed !== p.P.dna.seed) { rec = { persona: personaFor(p.P, whereKind()), history: [], seed: p.P.dna.seed }; people.set(p, rec); }
		return rec.persona;
	}
	return { voice, personaOf, chronicle, routeMarks, relationshipFor:p=>p?.residentId?chronicle.relationship(api.social.bodyKey(),residentKey(p.residentId)):null, showStory, update: watch, ask, act, snapshot, show, showPeople, showQuests, showCaves, showArchive, archive, stories, storyContext, say, llm, talkTo, endTalk, partner: () => partner, quests: () => quests.slice(), giveQuest, journal: () => ({ ...journal }), find, waypointMark };
}
