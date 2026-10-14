// A source-backed journal for the people doing things around you. The reducer can
// advance intentions while away; only the original request source can settle a job.
// Local evidence never masquerades as an authoritative multiplayer completion.
import { createLivingWorldState, reduceLivingWorld, livingWorldView, livingWorldKey } from './living-world-core.js';

export const LIVING_FEATURE = 'living-world-v1';
const TERMINAL = new Set(['completed', 'failed']);
const SIMPLE = new Set(['go', 'pickup', 'deliver', 'talk', 'wait']);
const SCHEDULING_CHOICES = [{ id: 'priority', label: 'Make this a priority', effect: 'prioritize' }, { id: 'defer', label: 'Wait for a safer moment', effect: 'defer' }, { id: 'resume', label: 'Resume the work', effect: 'resume' }];
const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0).toString(36); };
const shortId = (id) => String(id || '').length <= 96 ? String(id || '') : 'source:' + hash(id);
const cleanAt = (at) => at && Number.isFinite(at.x) && Number.isFinite(at.z) ? { x: at.x, z: at.z, ...(Number.isFinite(at.y) ? { y: at.y } : {}), name: String(at.name || '').slice(0, 160), establishmentId: at.establishmentId || null } : null;
const serialRequest = (q) => ({ id: q.id, title: q.title, kind: q.kind, source: q.source || 'economy', giver: { ...q.giver, ref: undefined }, steps: (q.steps || []).map(s => ({ do: s.do, at: cleanAt(s.at?.who?.M?.S?.pos ? { ...s.at, ...s.at.who.M.S.pos } : s.at), item: s.item ? { name: s.item.name, shape: s.item.shape } : null })), reward: q.reward, deeds: q.deeds, region: q.region, expires: q.expires, choices: q.choices || [], requiredSkills: Array.isArray(q.requiredSkills) ? q.requiredSkills : [], tags: Array.isArray(q.tags) ? q.tags : null, allowNpc: q.allowNpc !== false, completionMode: q.completionMode || 'physical' });
const xyDistance = (a, b) => a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity;
export function livingActorId(p) {
	let resident = null; try { resident = p?.resident?.()?.id; } catch { /* optional authored resident */ }
	const authored = [p?.npcId, p?.residentId, resident].find(id => String(id || '').startsWith('colony:'));
	return authored || (p?.P?.dna?.seed != null ? `npc:${p.P.dna.seed >>> 0}` : p?.npcId || p?.residentId || resident || p?.id) || null;
}
const safeStorage = () => { try { return globalThis.localStorage; } catch { return null; } };

export function createLivingWorld({
	worldKey = () => 'here', region = () => ({ id: 'here', name: 'here' }), placeName = () => '',
	position = () => null, requests = () => null, npcQuests = null, actors = () => [],
	world = () => null, structures = () => null, persona = () => null, utcOffsetMinutes = () => 0, employerOf = () => null, soul = null, url = '',
	request = globalThis.fetch?.bind(globalThis), storage = safeStorage(), clock = () => Date.now(),
	onContact = () => null, hint = () => {}, onComplete = () => {},
} = {}) {
	const actorSignatures = new Map();
	let state = null, records = {}, archives = {}, scope = null, board = null, boardOff = null, dirty = false;
	let readBlocked = false;
	let savedLocally = !!storage, error = '', stopped = false, nextScan = 0, nextSave = 0, nextSync = 0;
	let syncCursor = 0, actorCursor = 0;
	let remote = null, remoteYou = null, capability = null, mode = 'local', inFlight = null, actionFlight = null, opSequence = 0;
	const nonce = `${Math.round(clock()).toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	const credential = () => { try { return soul?.credentials?.() || ''; } catch { return ''; } };
	const owner = () => credential() ? 'soul:' + hash(credential()) : 'device';
	let identitySeen = credential();
	const storageKey = () => 'l99-living-world-v1:' + scope.key;
	const currentBoard = () => typeof requests === 'function' ? requests() : requests;
	function save() {
		if (readBlocked) return false;
		if (!state || !scope || !dirty) return true;
		if (!storage) { savedLocally = false; return false; }
		try { storage.setItem(storageKey(), JSON.stringify({ version: 1, state, records, archives })); dirty = false; savedLocally = true; return true; }
		catch { savedLocally = false; error = 'Activity could not be saved on this device. Completed rewards will not be issued without a saved source receipt.'; return false; }
	}
	function apply(command) {
		const result = reduceLivingWorld(state, { now: clock(), ...command });
		if (!result.error && result.state !== state) { state = result.state; dirty = true; }
		return result;
	}
	function ensureScope() {
		if (stopped || !world()) return false;
		if (identitySeen !== credential()) { identitySeen = credential(); remote = null; remoteYou = null; mode = 'local'; nextSync = 0; }
		const r = region() || {}, body = String(worldKey() || 'here'), regionId = String(r.id || r || 'here');
		const key = livingWorldKey(body, regionId);
		if (scope?.key !== key) {
			save(); actorSignatures.clear(); scope = { world: body, region: regionId, name: r.name || placeName() || regionId, key };
			state = createLivingWorldState({ world: body, region: regionId, now: clock() }); records = {}; archives = {}; remote = null; remoteYou = null; mode = 'local'; readBlocked = false; error = '';
			try {
				const old = JSON.parse(storage?.getItem(storageKey()) || 'null');
				if (old?.version === 1 && old.state?.version === 1 && old.state?.key === key && old.state?.actors && old.state?.requests && Array.isArray(old.state.events) && Number.isFinite(old.state.lastAdvancedAt)) { const restored = old.state;
					if (Object.values(restored.actors).some(a => !a || !a.id || !a.sites || !a.disposition || !Array.isArray(a.skills)) || Object.values(restored.requests).some(q => !q || !q.id || !Array.isArray(q.participants) || !Array.isArray(q.proposals) || !Array.isArray(q.choices) || !Array.isArray(q.tags) || !Array.isArray(q.requiredSkills))) throw Error('Invalid activity records.');
					if (!old.records || typeof old.records !== 'object' || Object.values(old.records).some(r => !r?.q?.giver || !Array.isArray(r.q.steps))) throw Error('Invalid activity source records.');
					const checked = reduceLivingWorld(restored, { type: 'advance', now: Math.max(clock(), restored.updatedAt) });
					if (checked.error) throw Error(checked.error);
					state = restored; records = old.records; archives = old.archives || {};
				}
				else if (old != null) throw Error('Unsupported activity save.');
			} catch { readBlocked = true; savedLocally = false; error = 'The saved activity journal could not be read. Its original data has been retained; reservations and rewards are paused until it is recovered.'; }
			nextSync = 0; nextScan = 0; dirty = true;
			// Catch-up only advances known intentions. It neither pays nor completes a source.
			apply({ type: 'advance', situation: situation() });
		}
		const b = currentBoard();
		if (b !== board) { boardOff?.(); board?.setClaimGuard?.(null); board = b; boardOff = board?.onChange?.(onBoard) || null; }
		board?.setScope?.(scope.key);
		board?.setClaimGuard?.(canTake);
		return true;
	}
	function person(p) {
		const seed = p?.P?.dna?.seed, id = livingActorId(p);
		if (!id || p?.P?.dna?.child || p?.P?.dna?.minor || p?.P?.dna?.teen || p?.active === false) return null;
		let d = p.disposition; try { d ||= seed != null ? npcQuests?.disposition?.(seed) : null; } catch { /* neutral available facts */ }
		let name = p.name || p.first; if (!name) { try { const who = persona(p); name = who?.first || who?.name; } catch { /* an unseen resident */ } }
		const sites = { ...(state?.actors?.[shortId(id)]?.sites || {}), ...(p.sites || {}) }; let employer = null; try { employer = employerOf(id, p); } catch { /* no employer */ }
		if (!sites.work && employer) sites.work = employer;
		else if (!sites.work && Number.isFinite(p.workSpot?.x) && Number.isFinite(p.workSpot?.z)) sites.work = `work:${Math.round(p.workSpot.x)}:${Math.round(p.workSpot.z)}`;
		return { id: shortId(id), name: name || 'A resident', disposition: d || { helpful: 0.5, reliable: 0.6, nerve: 0.5 }, skills: p.skills || [], sites, utcOffsetMinutes: p.utcOffsetMinutes ?? utcOffsetMinutes() };
	}
	function observeActor(a) {
		if (!a) return;
		const signature = JSON.stringify(a); if (actorSignatures.get(a.id) === signature && state.actors[a.id]) return;
		const result = apply({ type: 'register-actor', actor: a }); if (!result.error) actorSignatures.set(a.id, signature);
	}
	function archiveFinished() {
		if (!storage || Object.keys(state.requests).length < 96) return;
		const terminal = Object.values(state.requests).filter(q => TERMINAL.has(q.status)).sort((a, b) => (a.completedAt || a.updatedAt) - (b.completedAt || b.updatedAt));
		// Persist the full old receipt and associated history first. Tombstones prevent
		// repeated registry observations from reopening old jobs after compaction.
		for (const q of terminal.slice(0, Math.max(0, terminal.length - 24))) {
			try {
				storage.setItem(storageKey() + ':archive:' + encodeURIComponent(q.id), JSON.stringify({ request: q, record: records[q.id], history: state.events.filter(e => e.requestId === q.id) }));
				archives[q.id] = q.completedAt || q.updatedAt;
				delete state.requests[q.id]; delete records[q.id]; dirty = true;
			} catch { savedLocally = false; error = 'Activity storage is full. Older receipts were retained; new work may wait until storage is available.'; break; }
		}
	}
	function observeRequest(raw) {
		if (!raw?.id || !raw.giver?.id || !raw.steps?.length) return null;
		const q = serialRequest(raw), id = shortId(q.id);
		if (archives[id]) return null;
		archiveFinished();
		const old = records[id];
		if (!old && Object.keys(records).length >= 128) { error = 'This region has 128 tracked activities. Finish or release existing work before adding more.'; return null; }
		if (old && old.q.giver.id !== q.giver.id) return null;
		if (!old) records[id] = { q, step: 0, observedAt: clock(), owner: null, activeScene: false };
		else if (!old.finished) old.q = q;
		const giverId = shortId(q.giver.id), siteId = shortId(q.steps.find(s => s.at?.establishmentId)?.at.establishmentId || `${q.source}:${q.giver.id}`);
		// A registered business is a real giver, not an invented walking citizen.
		if (!state.actors[giverId]) observeActor({ id: giverId, name: q.giver.name || 'The requester', disposition: { helpful: q.giver.type === 'business' ? 0 : 0.5, reliable: 0.6, nerve: 0.5 } });
		if (!state.requests[id]) apply({ type: 'register-request', request: { id, title: q.title, kind: q.kind, giverId, source: q.source, siteId, siteName: q.giver.name, durationMs: Math.max(300000, q.steps.length * 120000), requiredSkills: q.requiredSkills, tags: q.tags || (q.completionMode === 'social' ? ['social'] : ['work']), completionMode: q.completionMode, choices: q.choices?.length ? q.choices : SCHEDULING_CHOICES, allowNpc: q.allowNpc } });
		dirty = true; return id;
	}
	function situation() {
		const s = { hazard: 0, blockedSites: [], destroyedSites: [], unavailableActors: [] };
		let system = null; try { system = structures(); s.hazard = system?.cataclysm?.() ? 1 : 0; } catch { /* no damage layer on this body */ }
		const damage = [];
		try { system?.store?.each?.((id, rec) => { if (rec?.c > 0 || rec?.m?.length) damage.push({ id, ...rec }); }); } catch { /* retain the cataclysm state */ }
		for (const [id, rec] of Object.entries(records)) {
			const sites = rec.q.steps.map(step => step.at).filter(Boolean);
			// Existing damage records have actual world coordinates. Conservatively pause
			// work near that structure; never claim that this journal repaired it.
			if (damage.some(d => Number.isFinite(d.x) && Number.isFinite(d.z) && sites.some(p => xyDistance(p, d) < 18))) {
				const site = state?.requests?.[id]?.siteId; if (site) s.blockedSites.push(site);
			}
		}
		try { for (const p of actors() || []) { if (p?.P?.ragdoll && p.P.dna?.seed != null) s.unavailableActors.push(`npc:${p.P.dna.seed >>> 0}`); } } catch { /* actor pool unloaded */ }
		return s;
	}
	function canTake(raw, taker) {
		if (!ensureScope() || readBlocked) return false;
		const id = observeRequest({ ...raw, source: raw.source || 'economy' });
		if (!id) return false;
		const q = remote?.requests?.find(a => a.id === id) || state.requests[id];
		if (!q || TERMINAL.has(q.status) || q.blockedReason && q.blockedReason !== 'player-reserved') return false;
		if (q.playerOwner) return taker === 'player' && q.playerOwner === (remote ? remoteYou : 'player');
		if (taker === 'player') return true;
		if (mode === 'offline') return false; // Stale shared reservations must not be stolen.
		return !q.actorId || q.actorId === taker;
	}
	function onBoard(event) {
		if (!scope || event.scope !== scope.key) return;
		const q = event.request, id = observeRequest({ ...q, source: 'economy' }); if (!id) return;
		const record = records[id];
		if (event.type === 'completed' && record.sourceFinished && record.receiptId === (q.receiptId || `source:${id}:${q.status}`)) return;
		if (event.type === 'taken' && q.taker === 'player') { record.owner = owner(); apply({ type: 'reserve', requestId: id, playerId: 'player' }); }
		if (event.type === 'completed') {
			record.sourceFinished = true; record.outcome = q.status === 'done' ? 'completed' : 'failed'; record.receiptId = q.receiptId || `source:${id}:${q.status}`; record.completedAt = q.completedAt || clock(); record.completedBy = q.taker; nextSync = 0;
			const confirmation = apply({ type: 'confirm', requestId: id, evidenceId: shortId(record.receiptId), outcome: q.status === 'done' ? 'completed' : 'failed', ...(q.taker === 'player' ? { playerId: 'player' } : { actorId: q.taker }) });
			record.pendingAck = confirmation.error === 'player-confirmation-required'; record.finished = !confirmation.error;
			if (record.pendingAck) record.note = 'The helper finished the physical work. Acknowledge their result to close your participation; this does not earn a personal service discount.';
			if (q.status === 'done' && q.taker === 'player') { try { onComplete({ id, request: q, receiptId: record.receiptId }); } catch { /* source already settled */ } }
		}
		dirty = true; save();
	}
	function onNpc(event) {
		if (!ensureScope()) return;
		const q = { ...event.request, source: event.request?.source || 'npc-scene' }, id = observeRequest(q); if (!id) return;
		const rec = records[id];
		if (event.npcId) { const actorId = shortId(event.npcId); observeActor({ ...(state.actors[actorId] || {}), id: actorId, name: event.npcName || state.actors[actorId]?.name || 'A resident' }); }
		rec.npcId = event.npcId; rec.npcName = event.npcName; rec.step = event.step || 0; rec.lastObserved = clock();
		if (event.type === 'started') { rec.activeScene = true; rec.interrupted = false; apply({ type: 'observe-start', requestId: id, actorId: shortId(event.npcId) }); }
		if (event.type === 'interrupted') { rec.activeScene = false; rec.interrupted = true; rec.note = event.reason; }
		if (event.type === 'finished') {
			rec.activeScene = false;
			// Real seen completion (including a favour with no economy source), not an
			// out-of-sight legacy estimate. No extra money is issued here.
			if (event.observed && ['done', 'own'].includes(event.outcome) && !rec.pendingAck) {
				rec.finished = true; rec.outcome = 'completed'; nextSync = 0; rec.completedBy = event.npcId; rec.receiptId ||= `scene:${scope.key}:${id}:${rec.lastObserved}`;
				apply({ type: 'confirm', requestId: id, evidenceId: shortId(rec.receiptId), outcome: 'completed', actorId: shortId(event.npcId) });
			} else if (['abandon', 'betray'].includes(event.outcome)) apply({ type: 'confirm', requestId: id, evidenceId: `scene:${id}:${event.outcome}`, outcome: 'failed', actorId: shortId(event.npcId) });
		}
		dirty = true; save();
	}
	const npcOff = npcQuests?.onActivity?.(onNpc);
	npcQuests?.setLivingAdapter?.({ canTake });
	function socialOpportunities(available) {
		// A small authored opportunity rule, using people and sites actually observed
		// together. This is abstract social life, not physical work or a player reward.
		const day = Math.floor(clock() / 86400000);
		let posted = 0;
		for (const p of available) {
			if (posted >= 2) break;
			const a = person(p), at = cleanAt(p?.workSpot || p?.home);
			if (!a || !at || !(a.sites.work || a.sites.home) || p.P?.ragdoll) continue;
			const companion = available.find(other => other !== p && person(other) && xyDistance(other.M?.S?.pos || other.position, p.M?.S?.pos || p.position || at) < 30);
			if (!companion) continue;
			const site = a.sites.work || a.sites.home;
			observeRequest({ id: `checkin:${a.id}:${day}`, title: `Check in with ${a.name}`, kind: 'checkin', source: 'resident-checkin', completionMode: 'social',
				giver: { id: a.id, type: 'person', name: a.name, x: at.x, z: at.z }, steps: [{ do: 'talk', at: { ...at, name: at.name || 'their usual place', establishmentId: site } }],
				reward: { credits: 0, from: null }, deeds: {}, expires: (day + 1) * 86400000 });
			posted++;
		}
	}
	function scan() {
		if (!ensureScope()) return;
		let available = []; try { available = actors() || []; } catch { /* no people */ }
		for (const a of available.slice(0, 48)) observeActor(person(a));
		socialOpportunities(available.slice(0, 48));
		const pos = position();
		if (pos) { try { for (const q of (board?.near?.(pos.x, pos.z, 650) || []).slice(0, 32)) observeRequest({ ...q, source: 'economy' }); } catch { /* registry may be swapping */ } }
		for (const event of npcQuests?.activities?.() || []) observeRequest({ ...event.request, source: event.request?.source || 'npc-scene' });
		// A source receipt survives a reload even if the UI save happened just before it.
		for (const q of board?.list?.() || []) {
			if (q.status === 'done' || q.status === 'failed' || q.status === 'betrayed') onBoard({ type: 'completed', request: q, scope: scope.key });
			else if (q.status === 'taken') {
				const id = observeRequest({ ...q, source: 'economy' }), rec = records[id];
				if (rec && q.taker !== 'player' && !rec.activeScene && rec.interrupted) {
					const danger = situation();
					if (!danger.hazard && !danger.blockedSites.includes(state.requests[id]?.siteId)) npcQuests?.resumeRequest?.({ ...q, source: 'economy' }, q.taker, rec.step);
				}
			}
		}
		apply({ type: 'situation', situation: situation() });
		if (Math.floor(clock() / 300000) > Math.floor(state.lastAdvancedAt / 300000)) apply({ type: 'advance' });
	}
	function publicRequest(id) { return remote?.requests?.find(q => q.id === id) || state?.requests?.[id]; }
	function instruction(record) {
		const s = record.q.steps[record.step];
		if (!s) return 'Return to the requester to confirm the completed work.';
		if (!SIMPLE.has(s.do)) return `This ${s.do} needs the corresponding physical gameplay system to confirm it.`;
		return `${s.do === 'go' ? 'Go to' : s.do === 'pickup' ? 'Collect ' + (s.item?.name || 'the goods') + ' at' : s.do === 'deliver' ? 'Deliver the carried goods to' : s.do === 'wait' ? 'Work at' : 'Speak at'} ${s.at?.name || record.q.giver.name}.`;
	}
	function snapshot() {
		if (!ensureScope()) return { activities: [], history: [], scope: null, error, catchup: null, routines: [] };
		const local = livingWorldView(state, { limit: 100 });
		const view = remote ? { ...remote, requests: [...new Map([...local.requests, ...remote.requests].map(q => [q.id, q])).values()], actors: [...new Map([...local.actors, ...remote.actors].map(a => [a.id, a])).values()] } : local;
		const activities = view.requests.map(q => {
			const rec = records[q.id], personId = q.actorId || q.giverId, actor = view.actors.find(a => a.id === personId);
			const raw = rec?.q, source = raw && board?.get?.(raw.id), mine = source?.taker === 'player' && rec?.owner === owner();
			const finished = !!rec?.finished;
			return { id: q.id, title: q.title, reason: rec?.note || q.blockedReason || 'Requested by ' + (raw?.giver.name || view.actors.find(a => a.id === q.giverId)?.name || 'a resident'),
				state: rec?.pendingAck ? 'awaiting your acknowledgement' : finished ? (remote && !TERMINAL.has(remote.requests.find(s => s.id === q.id)?.status) ? (rec.outcome || 'completed') + ' locally; shared confirmation pending' : rec.outcome || 'completed') : q.status,
				npcId: personId, npcName: actor?.name || rec?.npcName || 'A resident', place: q.siteName || scope.name,
				choices: q.choices || [], history: view.events.filter(e => e.requestId === q.id).slice(-8),
				canJoin: !finished && !TERMINAL.has(q.status) && (!q.playerOwner || q.playerOwner === (remote ? remoteYou : 'player')),
				canContact: !!personId, canIntervene: !finished && !!q.choices?.length,
				canProgress: (mine || !!rec?.pendingAck) && !finished, pendingAck: !!rec?.pendingAck,
				canLeave: !finished && ((q.participants || []).includes(remote ? remoteYou : 'player') || mine && rec.step === 0 && !rec.agreementId), currentStep: rec ? raw.steps[rec.step] || null : null,
				instruction: rec ? instruction(rec) : 'This activity was reported elsewhere. Visit its source before taking physical steps.',
				progress: { done: rec?.step || 0, total: raw?.steps.length || 0 }, source: q.source,
			};
		});
		const history = [...view.events];
		if (remote) for (const e of local.events) if (e.type === 'request-confirmed') history.push({ ...e, text: e.text + ' (Local source confirmation; not a shared receipt.)' });
		return { activities, history: history.sort((a, b) => a.at - b.at).slice(-100), scope: { ...scope }, catchup: history.findLast(e => e.type === 'catch-up-limited') || null, error, routines: view.actors.filter(a => a.id.startsWith('npc:') || a.id.startsWith('colony:')), mode, savedLocally };
	}
	async function http(path, body, identity = credential()) {
		const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
		try {
			const headers = body ? { 'content-type': 'application/json' } : {};
			if (path !== '/status') headers.authorization = 'Bearer ' + identity;
			const response = await request(url.replace(/\/$/, '') + path, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: controller.signal });
			const data = await response.json(); if (!response.ok) throw Error(data.error || `Activity server returned ${response.status}.`); return data;
		} finally { clearTimeout(timer); }
	}
	const pathFor = (s) => `/living/${encodeURIComponent(s.world)}/${encodeURIComponent(s.region)}`;
	const operationId = () => `living-${nonce}-${++opSequence}`;
	function receive(data, key) {
		if (!scope || scope.key !== key || data.world !== scope.world || data.region !== scope.region) return false;
		if (!Array.isArray(data.view?.requests) || !Array.isArray(data.view?.actors)) throw Error('Incomplete shared activity response.');
		remote = data.view; remoteYou = data.you; mode = 'shared'; error = ''; return true;
	}
	async function sync() {
		if (inFlight) return inFlight;
		if (!ensureScope() || readBlocked || !url || !request || !credential()) return false;
		const observedScope = { ...scope }, identity = credential();
		inFlight = (async () => {
			try {
				if (capability !== true) {
					const status = await http('/status', undefined, identity);
					if (!ensureScope() || credential() !== identity || scope.key !== observedScope.key || stopped) return false;
					capability = status.features?.includes(LIVING_FEATURE) || status.feature === LIVING_FEATURE;
					if (!capability) { mode = 'local'; error = 'Shared living-world support is not deployed yet. This activity is saved on this device.'; return false; }
				}
				const data = await http(pathFor(observedScope), undefined, identity);
				if (credential() !== identity || !receive(data, observedScope.key)) return false;
				const all = livingWorldView(state, { limit: 1 });
				const pendingReports = all.requests.filter(q => records[q.id]?.finished && !records[q.id]?.sharedReported);
				const active = all.requests.filter(q => !TERMINAL.has(q.status) && !pendingReports.includes(q));
				const rotated = active.length ? active.slice(syncCursor % active.length).concat(active.slice(0, syncCursor % active.length)) : [];
				const selected = [], wanted = new Set();
				for (const q of [...pendingReports, ...rotated]) {
					const ids = [q.giverId, q.actorId, records[q.id]?.npcId, records[q.id]?.completedBy].filter(id => id && id !== 'player');
					if (new Set([...wanted, ...ids]).size > 12) continue;
					selected.push(q); ids.forEach(id => wanted.add(id)); if (selected.length >= 12) break;
				}
				syncCursor += Math.max(1, selected.length);
				const otherActors = all.actors.filter(a => !wanted.has(a.id));
				const rotatedActors = otherActors.length ? otherActors.slice(actorCursor % otherActors.length).concat(otherActors.slice(0, actorCursor % otherActors.length)) : [];
				const actorList = all.actors.filter(a => wanted.has(a.id)).concat(rotatedActors).slice(0, 16); actorCursor += 4;
				const known = new Set(actorList.map(a => a.id));
				const result = await http(pathFor(observedScope), { id: operationId(), op: 'register', actors: actorList, requests: selected.filter(q => known.has(q.giverId)), situation: situation() }, identity);
				if (credential() !== identity) return false;
				if (!receive(result, observedScope.key)) return false;
				for (const candidate of selected) {
					const rec = records[candidate.id];
					const heldSource = rec && board?.get?.(rec.q.id), shared = remote.requests.find(q => q.id === candidate.id);
					if (rec?.owner === owner() && !rec.finished && heldSource?.taker === 'player' && shared && !TERMINAL.has(shared.status) && !shared.playerOwner) {
						const held = await http(pathFor(observedScope), { id: operationId(), op: 'reserve', requestId: candidate.id }, identity);
						if (credential() !== identity || !receive(held, observedScope.key)) return false;
					}
				}
				for (const candidate of selected) {
					const rec = records[candidate.id];
					if (!rec?.finished || rec.sharedReported || !rec.receiptId) continue;
					let shared = remote.requests.find(q => q.id === candidate.id);
					if (!shared) continue;
					if (TERMINAL.has(shared.status)) { rec.sharedReported = true; dirty = true; continue; }
					// Re-establish this Soul's original local reservation after an offline
					// completion. Another player's claim is never overridden.
					if ((rec.completedBy === 'player' || rec.playerAcknowledged) && !shared.playerOwner && !shared.participants?.includes(remoteYou)) {
						const held = await http(pathFor(observedScope), { id: operationId(), op: 'reserve', requestId: candidate.id }, identity);
						if (credential() !== identity || !receive(held, observedScope.key)) return false;
					}
					const report = await http(pathFor(observedScope), { id: operationId(), op: 'report-source', requestId: candidate.id,
						source: candidate.source, evidenceId: shortId(rec.receiptId), outcome: rec.outcome || 'completed',
						...(rec.completedBy && rec.completedBy !== 'player' && !rec.playerAcknowledged ? { actorId: shortId(rec.completedBy) } : {}) }, identity);
					if (credential() !== identity || !receive(report, observedScope.key)) return false;
					rec.sharedReported = true; dirty = true;
				}
				save(); return true;
			} catch (e) { if (scope?.key === observedScope.key) { mode = remote ? 'offline' : 'local'; error = e.message; } return false; }
			finally { inFlight = null; nextSync = clock() + 30000; }
		})(); return inFlight;
	}
	async function sharedAction(op, id, args = {}, expected = null) {
		const startKey = expected?.key || scope?.key, startIdentity = expected?.identity ?? credential();
		if (inFlight) await inFlight;
		if (!ensureScope() || scope.key !== startKey || credential() !== startIdentity) return { ok: false, message: 'Your location or identity changed. Choose the activity again in the current region.' };
		if (mode === 'offline') return { ok: false, message: 'Reconnect before changing a shared reservation.' };
		if (!remote) return { ok: true, local: true };
		const key = scope.key, identity = credential();
		try {
			if (!remote.requests.some(q => q.id === id) && state.requests[id]) {
				const task = state.requests[id], ids = new Set([task.giverId, task.actorId].filter(Boolean));
				const registered = await http(pathFor(scope), { id: operationId(), op: 'register', actors: Object.values(state.actors).filter(a => ids.has(a.id)), requests: [task], situation: situation() }, identity);
				if (credential() !== identity || !receive(registered, key)) return { ok: false, message: 'Your location or identity changed; choose the activity again.' };
			}
			const data = await http(pathFor(scope), { id: operationId(), op, requestId: id, ...args }, identity);
			if (identity !== credential() || !receive(data, key)) return { ok: false, message: 'Your location or identity changed; try again here.' };
			return { ok: true };
		} catch (e) { error = e.message; mode = 'offline'; return { ok: false, message: e.message }; }
	}
	async function perform(id, operation, args = {}) {
		if (operation === 'acknowledge') operation = 'progress';
		if (!ensureScope()) return { ok: false, message: 'Enter a world first.' };
		const context = { key: scope.key, identity: credential() };
		const validContext = () => ensureScope() && scope.key === context.key && credential() === context.identity;
		const changed = () => ({ ok: false, message: 'Your location or identity changed. Choose the activity again here.' });
		const shared = async (op, task, values = {}) => {
			if (!validContext()) return changed();
			const result = await sharedAction(op, task, values, context);
			return validContext() ? result : changed();
		};
		if (readBlocked && operation !== 'contact') return { ok: false, message: error };
		const q = publicRequest(id), rec = records[id];
		if (!q) return { ok: false, message: 'That request is no longer known here.' };
		if (operation === 'cancel-agreement') {
			if (rec?.owner === owner() && rec.releasedAgreementId === args.agreementId) return { ok: true, message: 'The original work reward was already restored.' };
			if (!rec || rec.owner !== owner() || rec.agreementId !== args.agreementId) return { ok: false, message: 'That agreement does not belong to this task.' };
			if (!board?.clearAgreement?.(rec.q.id, 'player', args.agreementId)) return { ok: false, message: 'The source could not restore the original work reward.' };
			rec.rewardMode = 'cash'; rec.releasedAgreementId = args.agreementId; rec.agreementId = null; dirty = true; save();
			return { ok: true, message: 'The item agreement was removed. The original cash reward for this work applies again.' };
		}
		if (operation === 'contact') {
			const actorId = q.actorId || q.giverId;
			const result = await onContact(actorId, { request: rec?.q, activity: q });
			if (!validContext()) return changed();
			if (result) return typeof result === 'object' ? { ok: true, ...result } : { ok: true, message: 'The conversation is open.' };
			const actor = npcQuests?.actor?.(actorId), at = actor?.M?.S?.pos || rec?.q.giver;
			return { ok: false, message: at ? `Visit ${rec?.q.giver.name || 'the requester'} near ${Math.round(at.x)}, ${Math.round(at.z)} in ${scope.name}. They are not in conversation range.` : 'Visit this region and find the requester. Remote conversation is not available.', at: cleanAt(at) };
		}
		if (operation === 'intervene') {
			if (!args.choiceId) return { ok: true, choices: q.choices || [], message: q.choices?.length ? 'Choose a proposal to discuss with the requester.' : 'This source has not offered alternate outcomes. Contact the requester.' };
			if (!q.choices?.some(c => c.id === args.choiceId)) return { ok: false, message: 'That alternative is not offered by this request.' };
			const cloud = await shared('influence', id, { choiceId: args.choiceId, reason: String(args.reason || '').slice(0, 300) }); if (!cloud.ok) return cloud;
			const result = apply({ type: 'influence', requestId: id, playerId: 'player', choiceId: args.choiceId, reason: args.reason }); save();
			const decision = publicRequest(id)?.proposals?.find(p => p.playerId === (remote ? remoteYou : 'player'));
			return { ok: !result.error, message: result.error || (decision?.status === 'accepted' ? 'The requester agreed. ' + (decision.decisionReason || 'Their schedule has changed.') : decision?.status === 'rejected' ? 'The requester declined. ' + (decision.decisionReason || 'Their other commitments take priority.') : 'Your proposal is recorded. The requester still needs to agree; no money or ownership changed.') };
		}
		if (rec?.q.completionMode === 'social' && (operation === 'join' || operation === 'release')) {
			const cloud = await shared(operation, id); if (!cloud.ok) return cloud;
			const result = apply({ type: operation, requestId: id, playerId: 'player' }); if (!result.error) { rec.owner = operation === 'join' ? owner() : null; dirty = true; } save();
			return { ok: !result.error, message: result.error || (operation === 'join' ? 'You joined this check-in. Meet the resident to talk; it will not silently finish while you participate.' : 'You left this check-in available to the residents.') };
		}
		if (!rec || rec.q.source !== 'economy') return { ok: false, message: 'This is a live scene. Meet its participants and use the existing interaction to help; it cannot be claimed from a distant journal.' };
		if (operation === 'progress' && rec.pendingAck) {
			const receipt = board?.get?.(rec.q.id);
			if (!receipt || receipt.status !== 'done' || receipt.taker === 'player' || !receipt.receiptId || !state.requests[id]?.participants.includes('player')) return { ok: false, message: 'The source has not provided a completed helper receipt to acknowledge.' };
			const result = apply({ type: 'confirm', requestId: id, evidenceId: shortId(receipt.receiptId), outcome: 'completed', playerId: 'player' });
			if (result.error) return { ok: false, message: result.error };
			rec.finished = true; rec.pendingAck = false; rec.playerAcknowledged = true; nextSync = 0; dirty = true; save();
			return { ok: true, message: 'You acknowledged the helper’s completed work. Their reward remains theirs.' };
		}
		if (TERMINAL.has(q.status) || rec.finished) return { ok: false, message: 'This request is already settled.' };
		const source = board?.get?.(rec.q.id);
		if (!source) return { ok: false, message: 'Visit the original request source before proceeding.' };
		if (operation === 'join') {
			if (url && request && credential() && capability !== false && !remote) await sync();
			if (!validContext()) return changed();
			if (url && credential() && capability !== false && !remote) return { ok: false, message: 'Connect to the shared activity service before reserving this request.' };
			const reserved = source.status === 'taken' && source.taker === 'player';
			if (reserved && rec.owner && rec.owner !== owner()) return { ok: false, message: 'This device has the task reserved for a different Soul. Recover that identity to continue its work.' };
			const cooperative = source.status === 'taken' && source.taker !== 'player';
			if (cooperative && args.rewardMode === 'discount') return { ok: false, message: 'That work already belongs to another helper and cannot earn your service discount.' };
			const cloud = await shared(cooperative ? 'join' : 'reserve', id); if (!cloud.ok) return cloud;
			if (cooperative) { apply({ type: 'join', requestId: id, playerId: 'player' }); save(); return { ok: true, message: 'You joined the existing helper. Contact them or follow their progress; their completed work will not count as your personal service.' }; }
			const result = apply({ type: 'reserve', requestId: id, playerId: 'player' });
			if (result.error) return { ok: false, message: result.error };
			if (!reserved && !board.take(rec.q.id, 'player')) { apply({ type: 'release', requestId: id, playerId: 'player' }); await shared('release', id); return { ok: false, message: 'The source could not reserve this request. It may have expired or already been taken.' }; }
			if (args.rewardMode === 'discount' && !board.agreeReward?.(rec.q.id, 'player', args)) return { ok: false, message: 'The service discount could not be recorded, or this work already backs another agreement.' };
			rec.rewardMode = source.rewardMode || 'cash'; rec.agreementId = source.agreementId || null;
			rec.owner = owner(); rec.startedAt ||= clock(); dirty = true; save();
			return { ok: true, message: `Reserved${remote ? '' : ' on this device'}. ${instruction(rec)}` };
		}
		if (operation === 'release') {
			if (rec.agreementId) return { ok: false, message: 'This work backs a shop agreement. Resolve that agreement before handing the task off.' };
			if (rec.step > 0) return { ok: false, message: 'You have started carrying out this request. Return to its source before handing it off.' };
			const cloud = await shared('release', id); if (!cloud.ok) return cloud;
			board.release?.(rec.q.id, 'player'); apply({ type: 'release', requestId: id, playerId: 'player' }); rec.owner = null; dirty = true; save(); return { ok: true, message: 'The request is available again.' };
		}
		if (operation !== 'progress') return { ok: false, message: 'That action is not supported.' };
		if (source.status !== 'taken' || source.taker !== 'player' || rec.owner !== owner()) return { ok: false, message: 'Reserve this task for yourself before advancing its objectives.' };
		if (remote && q.playerOwner && q.playerOwner !== remoteYou) return { ok: false, message: 'Another player holds the shared reservation. This local task cannot settle it.' };
		const danger = situation();
		if (danger.hazard || danger.blockedSites.includes(q.siteId)) return { ok: false, message: 'Work is paused while this area is unsafe or inaccessible.' };
		const step = rec.q.steps[rec.step];
		if (!step) return finish(id, rec);
		if (!SIMPLE.has(step.do)) return { ok: false, message: instruction(rec) };
		const at = position();
		if (xyDistance(at, step.at) > 6 || (Number.isFinite(step.at?.y) && Number.isFinite(at?.y) && Math.abs(at.y - step.at.y) > 6)) return { ok: false, message: instruction(rec) + ' Move within six metres first.', at: step.at };
		if (step.do === 'deliver' && rec.q.steps.some(s => s.do === 'pickup') && !rec.carrying) return { ok: false, message: 'Collect the requested goods before delivering them.' };
		if (step.do === 'wait') {
			if ((rec.waitMs || 0) < 30000) return { ok: false, message: 'Remain at the work location for 30 seconds of active play before finishing this step.' };
		}
		if (step.do === 'pickup') rec.carrying = step.item?.name || 'quest goods';
		if (step.do === 'deliver') rec.carrying = null;
		rec.step++; rec.waitMs = 0; dirty = true;
		if (!save()) return { ok: false, message: error || 'Could not save objective progress.' };
		return rec.step >= rec.q.steps.length ? finish(id, rec) : { ok: true, message: instruction(rec) };
	}
	function finish(id, rec) {
		const result = board.complete(rec.q.id, 'player', 'done');
		if (!result.ok) return { ok: false, message: result.reason || 'The source has not confirmed completion.' };
		return { ok: true, message: `The requester confirmed your work.${result.paid ? ' Your agreed reward was paid.' : ''}${remote ? ' The source receipt will be shared when connected.' : ''}`, receiptId: result.receiptId, paid: result.paid || 0 };
	}
	function action(id, operation, args = {}) {
		if (actionFlight) return Promise.resolve({ ok: false, message: 'Your previous activity action is still being checked.' });
		actionFlight = perform(id, operation, args).finally(() => { actionFlight = null; }); return actionFlight;
	}
	function completionEvidence(id) {
		if (!ensureScope()) return null;
		const rec = records[shortId(id)], source = rec && board?.get?.(rec.q.id);
		return rec?.finished && rec.owner === owner() && source?.status === 'done' && source.taker === 'player' && source.receiptId ? {
			id: source.receiptId, receiptId: source.receiptId, serviceId: shortId(id), revision: 1, completed: true, verified: true,
			status: 'completed', actorId: 'player', playerId: 'player', source: 'economy', giverId: source.giver.id,
			beneficiaryId: source.giver.id, completedAt: source.completedAt, worldId: scope.world, world: scope.world,
			region: scope.region, authority: 'local-source', rewardMode: source.rewardMode || 'cash', agreementId: source.agreementId || null,
		} : null;
	}
	function servicesFor(giverId) {
		if (!ensureScope()) return [];
		scan();
		return Object.entries(records).filter(([, rec]) => rec.q.source === 'economy' && rec.q.giver.id === giverId && rec.q.steps.every(s => SIMPLE.has(s.do))).map(([id, rec]) => {
			const source = board?.get?.(rec.q.id), sourceStatus = source?.status || 'unavailable';
			return { id, title: rec.q.title, label: rec.q.title, revision: 1, source: 'economy', giverId, beneficiaryId: giverId,
				creditValue: rec.q.reward?.credits || 0, credits: rec.q.reward?.credits || 0, requestId: rec.q.id,
				status: sourceStatus === 'done' ? 'completed' : sourceStatus === 'betrayed' ? 'failed' : sourceStatus,
				expiresAt: rec.q.expires || 0, assigneeId: source?.taker || null, available: sourceStatus === 'open',
				worldId: scope.world, world: scope.world, region: scope.region, rewardMode: source?.rewardMode || 'cash', agreementId: source?.agreementId || null };
		});
	}
	function update(dt = 0) {
		if (!ensureScope()) return;
		const now = clock();
		if (now >= nextScan) { nextScan = now + 5000; scan(); }
		// Waiting is actual active play at the location, never a browser clock shortcut.
		const pos = position();
		for (const rec of Object.values(records)) if (rec.owner === owner() && !rec.finished && rec.q.steps[rec.step]?.do === 'wait') {
			const step = rec.q.steps[rec.step];
			if (xyDistance(pos, step.at) <= 6 && !state.situation.hazard) rec.waitMs = Math.min(30000, (rec.waitMs || 0) + Math.max(0, Math.min(0.25, dt)) * 1000);
			else rec.waitMs = 0;
			dirty = true;
		}
		if (now >= nextSave) { nextSave = now + 10000; save(); }
		if (now >= nextSync) { nextSync = now + 30000; void sync(); }
	}
	return { update, snapshot, list: () => snapshot().activities, action, sync, servicesFor, completionEvidence,
		archived: (id) => { if (!ensureScope() || !archives[id]) return null; try { return JSON.parse(storage.getItem(storageKey() + ':archive:' + encodeURIComponent(id))); } catch { return null; } },
		archiveIndex: () => { ensureScope(); return { ...archives }; },
		clearAgreement: (id, agreementId) => action(id, 'cancel-agreement', { agreementId }),
		status: () => ({ mode, feature: LIVING_FEATURE, savedLocally, error, scope: scope && { ...scope }, capability }),
		conversationObserved(p) {
			if (!ensureScope() || readBlocked) return 0;
			const id = livingActorId(p);
			if (!id || xyDistance(position(), p?.M?.S?.pos || p?.position) > 8 || p?.active === false) return 0;
			let completed = 0;
			for (const [taskId, rec] of Object.entries(records)) {
				if (rec.q.completionMode !== 'social' || rec.q.giver.id !== id || rec.finished || rec.owner !== owner() || !state.requests[taskId]?.participants.includes('player')) continue;
				const receiptId = `conversation:${nonce}:${taskId}:${clock()}`;
				const result = apply({ type: 'confirm', requestId: taskId, evidenceId: shortId(receiptId), outcome: 'completed', playerId: 'player' });
				if (result.error) continue;
				Object.assign(rec, { finished: true, sourceFinished: true, completedBy: 'player', completedAt: clock(), outcome: 'completed', receiptId });
				completed++; dirty = true; nextSync = 0;
			}
			save(); return completed;
		},
		factsFor(p) {
			if (!ensureScope()) return [];
			const id = livingActorId(p);
			if (!id) return [];
			return snapshot().activities.filter(a => a.npcId === id || records[a.id]?.q.giver.id === id).slice(0, 3).map(a =>
				`Public local activity: ${a.title}. State: ${a.state}. ${a.reason}. ${a.history.at(-1)?.text || ''}`);
		},
		mark: () => { if (!ensureScope()) return null; const rec = Object.values(records).find(r => r.owner === owner() && !r.finished); const step = rec?.q.steps[rec.step]; return step?.at ? { ...step.at, bodyKey: scope.world, radius: 6, title: rec.q.title, detail: instruction(rec) } : null; },
		dispose() { stopped = true; save(); npcOff?.(); boardOff?.(); board?.setClaimGuard?.(null); npcQuests?.setLivingAdapter?.(null); },
	};
}
