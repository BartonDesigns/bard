// The Guide: a companion you talk to, by text or by voice. It always knows where you
// are and what is around you (the world describes itself to it each turn), keeps a
// journal of the things there are to find (the vent, the lava tube, the sea caves,
// the whale, the Golden Gate, Alcatraz, Mount Diablo, home...), suggests what to do
// next, answers questions about the places, and can act: take you somewhere, change
// the hour, put you in the air. A conversational model on your own device gives it
// its voice; with no model it still answers from the world itself.

import { createLLM, WEBLLM_MODELS, hasWebGPU, crashedBefore } from './llm.js';
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
];

const COMPASS = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
const dirTo = (dx, dz) => COMPASS[Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360) / 45) % 8];
const fmtDist = (m) => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10000 ? 1 : 0)} km`;
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();

export function createGuide(mount, api) {
	// api: { world(), camera, shared, hint(text) }
	const llm = createLLM();
	const store = { get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private mode: nothing persists */ } } };
	const journal = store.get('crysis-journal', {});

	// ---------- where things are ----------
	function targets() {
		const W = api.world(), out = [];
		for (const [n, lat, lon, fact] of LANDMARKS) out.push({ name: n, ...toWorld(lat, lon), fact, kind: 'landmark' });
		for (const z of ZONES) out.push({ name: z[0], ...toWorld(z[1], z[2]), fact: z[3], kind: 'area' });
		for (const p of PLACES) out.push({ name: p[0], ...toWorld(p[1], p[2]), fact: p[3], kind: p[5] ? 'neighbourhood' : 'town' });
		if (W) {
			const I = W.island, B = I.village.bay;
			out.push({ name: 'the village', x: I.village.x, z: I.village.z, fact: 'the fishing village on the island', kind: 'island' });
			out.push({ name: 'the island peak', x: I.peak.x, z: I.peak.z, fact: `the island's summit, ${Math.round(I.peak.h)} m`, kind: 'island' });
			if (B) out.push({ name: 'the reef', x: B.x + B.r * 0.5, z: B.z, fact: 'coral heads on the rim of the drowned crater', kind: 'island', under: true });
			if (B) out.push({ name: 'the volcanic vent', x: B.x, z: B.z, fact: 'a live vent erupting embers in the heart of the drowned crater', kind: 'island', under: true });
			if (W.magma?.tube) { const t = W.magma.tube[Math.floor(W.magma.tube.length / 2)]; out.push({ name: 'the lava tube', x: t.x, z: t.z, y: t.y + 1.5, fact: 'a rock tunnel carrying a molten stream from the vent', kind: 'island', under: true }); }
			(W.caverns?.tunnels || []).forEach((t, i) => { const m = t[Math.floor(t.length / 2)]; out.push({ name: `sea cave ${i + 1}`, x: t[0].x, z: t[0].z, y: t[0].y + 2, fact: 'a swim-through lava cave with glowing walls', kind: 'island', under: true, mid: m }); });
			if (W.whale?.whale?.position) out.push({ name: 'the whale', x: W.whale.whale.position.x, z: W.whale.whale.position.z, fact: 'a humpback in the bay', kind: 'island' });
			const home = store.get('crysis-home', null);
			if (home) out.push({ name: home.name || 'home', ...toWorld(home.lat, home.lon), fact: 'your home', kind: 'home' });
		}
		return out;
	}
	function find(name) {
		const q = norm(name).replace(/^(the|to) /, '');
		if (!q) return null;
		const all = targets();
		let best = null, score = 0;
		for (const t of all) {
			const n = norm(t.name).replace(/^the /, '');
			let s = n === q ? 100 : n.startsWith(q) ? 60 : n.includes(q) ? 40 : q.includes(n) && n.length > 3 ? 30 : 0;
			if (s && t.kind === 'landmark') s += 5;
			if (s > score) { score = s; best = t; }
		}
		return best;
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
		return {
			place: onIsland ? 'the island (in the Gulf of the Farallones, 25 km west of the Golden Gate)' : where ? `${where.name} (${where.sub})` : 'the Bay Area',
			onIsland, underwater: cam.y < 0 && g < 0, depth: Math.max(0, -cam.y), height: Math.round(cam.y - Math.max(g, 0)), flying: !!P.flying, diving: !!P.diving, boat: !!W.boat?.boarded?.(),
			time: `${Math.floor(hours)}:${String(Math.floor((hours % 1) * 60)).padStart(2, '0')}`, night: hours < 6 || hours > 19.5, wind: +(api.shared.uWind.value).toFixed(2),
			facing: dirTo(-Math.sin(P.yaw), -Math.cos(P.yaw)),
			near: near.map((t) => ({ name: t.name, dist: fmtDist(t.d), dir: dirTo(t.x - cam.x, t.z - cam.z), fact: t.fact })),
			done: QUESTS.filter((q) => journal[q[0]]).map((q) => q[1]), todo: [...quests.filter((q) => !q.done).map((q) => q.title), ...QUESTS.filter((q) => !journal[q[0]] && (q[0] !== 'home' || store.get('crysis-home', null))).map((q) => q[1])],
			land: W.land?.profile?.thesis, sea: W.eco?.profile?.thesis,
		};
	}

	// ---------- quests people give you, and the places you discover ----------
	const quests = store.get('crysis-quests', []);
	const found = store.get('crysis-places', {});
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
			} catch (e) { /* the plain fact will do */ }
			noteBusy = false;
		}
		if (note) { say('📍 ' + note, 'note'); api.hint('📍 ' + note, 5000); }
	}

	// ---------- the journal: noticed as you play ----------
	let tick = 0, lastPlace = '';
	function watch(dt) {
		tick += dt;
		if (tick < 1) return;
		tick = 0;
		const W = api.world(); if (!W) return;
		const cam = api.camera.position, P = W.player.state, g = W.island.heightAt(cam.x, cam.z), hours = W.sky.state.hours;
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
		if (cmd === 'go' || cmd === 'goto') { const t = find(arg); if (!t) return `I could not find "${arg}".`; return goTo(t) || `→ ${t.name}`; }
		if (cmd === 'time') { const h = parseFloat(arg); if (Number.isFinite(h)) { W.sky.state.hours = ((h % 24) + 24) % 24; return `→ ${Math.floor(W.sky.state.hours)}:00`; } }
		if (cmd === 'fly') { W.player.state.flying = !/off|land|no/.test(arg || ''); return W.player.state.flying ? '→ flying' : '→ landing'; }
		if (cmd === 'wind') { const v = parseFloat(arg); if (Number.isFinite(v)) { api.shared.uWind.value = Math.max(0, Math.min(1.5, v)); return `→ wind ${v}`; } }
		if (cmd === 'face' || cmd === 'look') { const t = find(arg); if (t) { const P = W.player.state; P.yaw = Math.atan2(-(t.x - P.pos.x), -(t.z - P.pos.z)); return `→ facing ${t.name}`; } }
		return null;
	}
	const ACTION_RE = /\[\[\s*(go|goto|time|fly|wind|face|look)\s*:?\s*([^\]]*)\]\]/gi;

	// ---------- the built-in guide (no model) ----------
	function offline(text) {
		const s = snapshot(), q = norm(text);
		if (!s) return 'The world is still waking up.';
		let m;
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
	const history = [];
	function systemPrompt() {
		const s = snapshot();
		return `You are the Guide in Crysis, a calm, warm companion inside a realistic world: a tropical island in the Gulf of the Farallones and, beyond it, the real San Francisco Bay Area at true scale. Speak briefly (one to three sentences unless asked for more), plainly, like a local friend. Never invent facts about places: use the facts given here, or say you are not sure.
You can act in the world by writing a command in double brackets at the end of your reply:
[[go: PLACE]] takes the player there (any town, landmark, area, or: the vent, the lava tube, sea cave 1, the reef, the village, the island peak, the whale, home).
[[time: HOUR]] sets the hour (0-24). [[fly: on]] or [[fly: off]]. [[face: PLACE]] turns the player toward a place. [[wind: 0-1.5]].
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
		if (partner && partner.p !== p) endTalk();
		let rec = people.get(p);
		if (!rec) { rec = { persona: personaFor(p.P, whereKind()), history: [] }; people.set(p, rec); }
		partner = { p, ...rec };
		api.people?.engage(p);
		title.textContent = partner.persona.name.toUpperCase();
		input.placeholder = `Say something to ${partner.persona.first}`;
		show(true);
		if (!rec.met) { rec.met = true; perform(personaOffline(partner.persona, 'hi', snapshot()), true); }
		else say(`${partner.persona.first} turns back to you.`, 'note');
	}
	function endTalk() {
		if (!partner) return;
		api.people?.release(partner.p);
		partner = null;
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
		bodySync(p, reply + (/[.!?]$/.test(reply) ? '' : '.'), 0);
		if (speakIt && voiceOut) speak(clean);
	}
	async function askPerson(text) {
		const P2 = partner, p = P2.p;
		say(text, 'me');
		const bubble = say('…', 'guide');
		const ctrl = new AbortController(); busy = ctrl;
		let reply = null, from = 0;
		const world = snapshot();
		try {
			if (llm.kind() !== 'none' && llm.status.ready) {
				P2.history.push({ role: 'user', content: text });
				while (P2.history.length > 10) P2.history.shift();
				reply = await llm.chat([{ role: 'system', content: personaPrompt(P2.persona, { place: world?.place, time: world?.time, near: world?.near?.slice(0, 4) }) }, ...P2.history], (t) => {
					bubble.textContent = t.replace(TAG_RE, '').replace(ACTION_RE, '').replace(QUEST_RE, '').trim(); scroll();
					from = bodySync(p, t, from);
				}, ctrl.signal);
				if (reply) P2.history.push({ role: 'assistant', content: reply });
			}
		} catch (e) { reply = null; }
		if (!reply) { reply = personaOffline(P2.persona, text, world); from = 0; }
		bodySync(p, reply + (/[.!?]$/.test(reply.trim()) ? '' : '.'), from);
		reply.replace(QUEST_RE, (_, pl) => { giveQuest(pl.trim(), P2.persona.first); return ''; });
		const clean = reply.replace(TAG_RE, '').replace(ACTION_RE, '').replace(QUEST_RE, '').trim();
		bubble.textContent = clean || '…';
		if (voiceOut) speak(clean, P2.persona);
		if (busy === ctrl) busy = null;
		scroll();
		if (/\b(bye|goodbye|take care|see you)\b/i.test(text)) setTimeout(() => { if (partner === P2) { endTalk(); show(false); } }, 1800);
	}
	async function ask(text) {
		if (!text.trim()) return;
		if (partner) return askPerson(text);
		say(text, 'me');
		const bubble = say('…', 'guide');
		if (busy) busy.abort();
		const ctrl = new AbortController(); busy = ctrl;
		let reply = null;
		try {
			if (llm.kind() !== 'none' && llm.status.ready) {
				history.push({ role: 'user', content: text });
				while (history.length > 12) history.shift();
				reply = await llm.chat([{ role: 'system', content: systemPrompt() }, ...history], (t) => { bubble.textContent = t.replace(ACTION_RE, '').trim(); scroll(); }, ctrl.signal);
				if (reply) history.push({ role: 'assistant', content: reply });
			}
		} catch (e) { reply = null; say('(The model did not answer: ' + e.message + '. The built-in guide answers instead.)', 'note'); }
		if (!reply) reply = offline(text);
		const acts = [];
		reply.replace(ACTION_RE, (_, c, a) => { acts.push([c, a.trim()]); return ''; });
		reply.replace(QUEST_RE, (_, pl) => { giveQuest(pl.trim(), null); return ''; });
		const clean = reply.replace(ACTION_RE, '').replace(QUEST_RE, '').trim();
		bubble.textContent = clean || '…';
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
	const open = el('button', 'position:absolute;right:calc(12px + env(safe-area-inset-right));top:calc(116px + env(safe-area-inset-top));width:44px;min-height:44px;border-radius:12px;border:1px solid rgba(1,169,130,.7);background:rgba(8,20,26,.55);color:#9fe8d0;font:600 18px system-ui;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);cursor:pointer;', '✦');
	open.title = 'Talk to the guide (G)'; open.setAttribute('aria-label', 'Talk to the guide');
	const panel = el('div', 'position:absolute;left:calc(12px + env(safe-area-inset-left));bottom:calc(12px + env(safe-area-inset-bottom));width:min(420px,calc(100vw - 24px));max-height:min(62vh,560px);display:none;flex-direction:column;border-radius:16px;border:1px solid rgba(255,255,255,.12);background:rgba(10,14,18,.86);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);box-shadow:0 20px 60px rgba(0,0,0,.6);color:#f2f5f4;font:14px/1.45 system-ui;z-index:5;');
	panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'The Guide');
	const head = el('div', 'display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);');
	const title = el('div', 'flex:1;font:600 13px system-ui;letter-spacing:.06em;color:#9fe8d0;', 'THE GUIDE');
	const statusEl = el('div', 'font:11px system-ui;color:rgba(255,255,255,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:190px;');
	const gearB = el('button', btnCss, '⚙'); gearB.title = 'Model settings'; gearB.setAttribute('aria-label', 'Model settings');
	const closeB = el('button', btnCss, '✕'); closeB.setAttribute('aria-label', 'Close the guide');
	head.append(title, statusEl, gearB, closeB);
	const settings = el('div', 'display:none;padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.08);font:12px system-ui;color:rgba(255,255,255,.8);');
	const log = el('div', 'flex:1;overflow-y:auto;padding:10px 12px;display:flex;flex-direction:column;gap:8px;min-height:120px;');
	log.setAttribute('aria-live', 'polite');
	const bar = el('div', 'display:flex;gap:6px;padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);');
	const input = el('input', 'flex:1;min-width:0;padding:10px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font:14px system-ui;outline:none;');
	input.placeholder = 'Ask anything, or "take me to Alcatraz"'; input.setAttribute('aria-label', 'Message the guide');
	const mic = el('button', btnCss, '🎙'); mic.title = 'Speak'; mic.setAttribute('aria-label', 'Speak to the guide');
	const spk = el('button', btnCss, voiceOut ? '🔊' : '🔈'); spk.title = 'Read replies aloud'; spk.setAttribute('aria-label', 'Read replies aloud');
	const send = el('button', btnCss + 'background:linear-gradient(135deg,#01a982,#10b981);border:none;', '➤'); send.setAttribute('aria-label', 'Send');
	bar.append(input, mic, spk, send);
	panel.append(head, settings, log, bar);
	mount.append(open, panel);
	// keep typing and taps out of the game's controls
	for (const ev of ['keydown', 'keyup', 'pointerdown', 'touchstart', 'wheel']) { panel.addEventListener(ev, (e) => e.stopPropagation()); open.addEventListener(ev, (e) => e.stopPropagation()); }

	function say(text, who) {
		const b = el('div', who === 'me' ? 'align-self:flex-end;max-width:85%;padding:8px 11px;border-radius:12px 12px 4px 12px;background:rgba(1,169,130,.22);border:1px solid rgba(1,169,130,.35);'
			: who === 'note' ? 'align-self:center;font:12px system-ui;color:rgba(255,255,255,.55);' : 'align-self:flex-start;max-width:90%;padding:8px 11px;border-radius:12px 12px 12px 4px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);', text);
		log.append(b); scroll();
		return b;
	}
	const scroll = () => { log.scrollTop = log.scrollHeight; };
	const show = (on) => { panel.style.display = on ? 'flex' : 'none'; open.style.display = on ? 'none' : ''; if (on) { setTimeout(() => input.focus(), 30); if (!log.children.length) greet(); } else input.blur(); };
	function greet() {
		const s = snapshot();
		say(s ? `Hello. You're on ${s.place}. Ask me anything — where to go, what something is, or what to do next.` : 'Hello.', 'guide');
		if (llm.kind() === 'none') say('Running without a model. ⚙ loads one on this device for real conversation.', 'note');
	}
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
	const autoId = phone ? 'SmolLM2-360M-Instruct-q4f16_1-MLC' : 'Llama-3.2-1B-Instruct-q4f16_1-MLC';
	let saved = store.get('crysis-guide-model', null);
	// the page died while the model was working last time: people use the simple replies
	// until you turn the model back on (⚙)
	if (crashedBefore()) { saved = { kind: 'none', id: autoId, url: 'http://localhost:11434', name: 'llama3.2' }; store.set('crysis-guide-model', saved); setTimeout(() => say('The on-device voices stopped last time (the device ran short of memory), so people are using simple replies. You can turn the model back on in ⚙.', 'note'), 4000); }
	// a phone that had the larger model by default moves to the small one
	if (saved?.kind === 'webllm' && phone && saved.id === 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC' && saved.auto !== false) saved.id = autoId;
	const choice = saved || { kind: hasWebGPU() && !navigator.connection?.saveData ? 'webllm' : 'none', id: autoId, url: 'http://localhost:11434', name: 'llama3.2', auto: true };
	function drawSettings() {
		settings.innerHTML = '';
		const row = (label, node) => { const r = el('label', 'display:flex;align-items:center;gap:8px;margin:6px 0;'); r.append(el('span', 'width:74px;color:rgba(255,255,255,.6);', label), node); settings.append(r); return r; };
		const sel = el('select', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);');
		for (const [v, t] of [['none', 'Built-in guide (no model)'], ['webllm', 'On this device (WebGPU)'], ['ollama', 'Ollama on this computer']]) { const o = el('option', null, t); o.value = v; sel.append(o); }
		sel.value = choice.kind;
		row('Voice', sel);
		if (choice.kind === 'webllm') {
			const m = el('select', 'flex:1;padding:8px;border-radius:8px;background:#1a1a1a;color:#fff;border:1px solid rgba(255,255,255,.2);');
			for (const x of WEBLLM_MODELS) { const o = el('option', null, x.label); o.value = x.id; m.append(o); }
			m.value = choice.id; m.onchange = () => { choice.id = m.value; };
			row('Model', m);
			settings.append(el('div', 'color:rgba(255,255,255,.5);margin:4px 0 8px;', hasWebGPU() ? 'Downloads once, then runs offline. Nothing you say leaves this device.' : 'This browser has no WebGPU (try Chrome or Edge on desktop or Android), or use Ollama.'));
		}
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
			else llm.useNone();
			if (user) { settings.style.display = 'none'; say(llm.status.text + ' — ready.', 'note'); }
		} catch (e) { if (user) say(llm.status.text, 'note'); }
	}
	gearB.onclick = () => { const on = settings.style.display === 'none'; settings.style.display = on ? 'block' : 'none'; if (on) drawSettings(); };
	llm.onStatus((st) => { statusEl.textContent = st.ready ? st.text : `${st.text}`.slice(0, 80); });
	// a model chosen before comes back by itself when it was downloaded already (Ollama
	// always); a first download only ever starts from the button
	if (choice.kind === 'ollama') connect(false);
	else if (choice.kind === 'webllm') setTimeout(() => connect(false), store.get('crysis-guide-loaded', false) ? 1500 : 9000);   // after the world is up
	// a quiet progress pill while the model downloads the first time
	const pill = el('div', 'position:absolute;right:calc(64px + env(safe-area-inset-right));top:calc(124px + env(safe-area-inset-top));padding:5px 10px;border-radius:10px;background:rgba(8,20,26,.6);color:#9fe8d0;font:11px system-ui;pointer-events:none;display:none;');
	mount.append(pill);
	llm.onStatus((st) => {
		if (llm.kind() !== 'webllm') { pill.style.display = 'none'; return; }
		if (/could not load|no WebGPU/i.test(st.text)) { pill.textContent = '✦ people will use simple replies'; pill.style.display = ''; setTimeout(() => { pill.style.display = 'none'; }, 4000); llm.useNone(); return; }
		if (!st.ready && st.progress < 1) { pill.style.display = ''; pill.textContent = `✦ voices loading ${Math.round((st.progress || 0) * 100)}%`; }
		else if (st.ready) { pill.textContent = '✦ people can talk now'; setTimeout(() => { pill.style.display = 'none'; }, 3500); }
	});
	llm.onStatus((st) => { if (st.ready && llm.kind() === 'webllm') store.set('crysis-guide-loaded', true); });

	return { update: watch, ask, act, snapshot, show, llm, talkTo, endTalk, partner: () => partner, quests: () => quests.slice(), giveQuest, journal: () => ({ ...journal }), find };
}
