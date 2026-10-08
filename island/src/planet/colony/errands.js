// The colony's errands, in the world: the director's dead relay, the Kestrel's recorder, the
// earthrise watch, and a few smaller favours (crew.js QUESTS). People offer them when you
// talk (a gold ! over their heads), and say thanks or nag when you come back (?). What you
// carry goes through the inventory (crysis/arms-runtime.js) when it is there: you hold the
// part, you hand it over, the credits are paid in. The guide's journal lists the errands and
// its pin shows the way (guide.js asks mark() and journal()); terminals add what can be done
// at them (life.js); the earthrise watch is a real gathering (people/appointments.js), kept
// or missed by the game clock like any other meeting.
//
// What you have done is kept in this browser, per world.

import { CAST, byId, QUESTS, ITEMS, NEWS, REACT, stateOf, stepOf, step, errandFor, offerable, holds, inWindow } from './crew.js';
import { makeGathering, gatheringStage } from '../../people/gatherings.js';
import { formatClock, formatReal, realSecondsFor } from '../../people/appointments.js';
import * as THREE from 'three';
import { frame } from '../alienkit.js';

const YES = /^(yes|yeah|yep|sure|ok(ay)?|of course|absolutely|i('| wi)ll (do it|go|come|help|be there)|count me in|happy to|on my way|deal)\b/i;
const NO = /^(no|nope|not now|maybe later|later|sorry)\b/i;
const ASK = /\b(any (work|job|jobs|errands?|tasks?)|need (a hand|help|anything)|can i help|anything (i can do|to do)|what can i do|give me (a )?(job|task|quest)|quest|errand|favou?r)\b/i;
const TRANSCRIPT = [
	'Kestrel, Tranquility. Descent nominal, gear down… [static]',
	'…lost the number two engine, coming in long. Tell the ground crew to stand clear of the ridge.',
	'…we are down. Everyone is fine. Tell them the view was worth it. [laughter] Kestrel out.',
];

export function createErrands(o) {
	const { plan, X, crew, hint, isPhone, mount } = o;
	const KEY = `crysis-colony-${plan.seed}`;
	const S = load();
	function load() {
		let s = null;
		try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* nothing kept */ }
		return Object.assign({ v: 1, q: {}, items: {}, credits: 0, track: null, heard: {}, meet: null, played: null, log: [] }, s && s.v === 1 ? s : {});
	}
	function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or off */ } }
	const first = (id) => byId[id].name.split(' ')[0];
	const note = (text) => { S.log.push({ at: Date.now(), text }); S.log = S.log.slice(-40); };

	// ---------- the places errands happen ----------
	const outer = (kind) => (plan.outer || []).find((q) => q.kind === kind) || null;
	const terminal = (key) => X.terminals.find((T) => (key === 'depot' ? T.kind === 'depot' : outer(key) && T.name === outer(key).name + ' terminal')) || null;
	const wreck = outer('wreck'), wreckAt = wreck ? frame(wreck.x, wreck.y, wreck.z, wreck.yaw).p(0, 0, 2) : null;
	// what the errands show out there: the relay's fault light (red, blinking, until the
	// board is in), the Kestrel's recorder beacon (blinking amber till it is taken)
	const lamps = new THREE.Group();
	lamps.name = 'colony:errand-lamps';
	o.scene?.add(lamps);
	const lampGeo = new THREE.SphereGeometry(0.09, 10, 8);
	const lamp = (p, c) => { const m = new THREE.Mesh(lampGeo, new THREE.MeshBasicMaterial({ color: c })); m.position.copy(p); lamps.add(m); return m; };
	const relayO = outer('relay');
	const fault = relayO ? lamp(frame(relayO.x, relayO.y, relayO.z, relayO.yaw).p(0.7, 2.3, -6.9), 0xff2a1a) : null;
	const beacon = wreckAt ? lamp(new THREE.Vector3(wreckAt.x + 0.5, wreck.y + 0.35, wreckAt.z + 0.4), 0xffa020) : null;
	function placeOf(st) {
		if (!st) return null;
		const who = st.to || st.by;
		if (who) { const p = crew.where(who); return p && { x: p.x, y: p.y, z: p.z, label: byId[who].name, radius: 3 }; }
		if (st.term) { const T = terminal(st.term); return T && { x: T.x, y: T.y, z: T.z, label: T.name, radius: 3 }; }
		if (st.site === 'wreck' && wreckAt) return { x: wreckAt.x, y: wreck.y, z: wreckAt.z, label: wreck.name, radius: 8 };
		return null;
	}
	// the outer site an errand's step leads to (a rover goes there)
	function siteOf(st) {
		if (!st) return null;
		const kind = st.term && st.term !== 'depot' ? st.term : st.site || byId[st.to || st.by]?.at;
		return outer(kind)?.name || null;
	}

	// ---------- what you carry ----------
	const arms = () => o.arms || null;
	const has = (item) => (arms()?.state().items?.[item] || 0) > 0 || (S.items[item] || 0) > 0;
	function give(item, qid) {
		const A = arms();
		if (A) { const r = A.apply({ id: `colony:${plan.seed}:${qid}:get:${item}`, kind: 'trade', peer: 'colony', give: { items: {}, credits: 0 }, get: { items: { [item]: 1 }, credits: 0 } }); if (r.ok) { A.hold(item); return; } }
		S.items[item] = (S.items[item] || 0) + 1;
	}
	function take(item, qid) {
		const A = arms();
		if (A && (A.state().items?.[item] || 0) > 0) { const r = A.apply({ id: `colony:${plan.seed}:${qid}:give:${item}`, kind: 'trade', peer: 'colony', give: { items: { [item]: 1 }, credits: 0 }, get: { items: {}, credits: 0 } }); if (r.ok) return; }
		if (S.items[item]) S.items[item]--;
	}
	function pay(credits, qid) {
		const A = arms();
		if (A) { const r = A.apply({ id: `colony:${plan.seed}:${qid}:reward`, kind: 'trade', peer: 'colony', give: { items: {}, credits: 0 }, get: { items: {}, credits } }); if (r.ok) return; }
		S.credits += credits;
	}
	const itemFor = (qid, when) => Object.entries(ITEMS).find(([, v]) => v.quest === qid && v[when] === stepOf(S, qid)?.id)?.[0] || null;

	// ---------- the errands moving on ----------
	const social = () => o.social?.() || null;
	function resident(id) {
		const SO = social(), W = o.world?.();
		if (!SO || !W) return null;
		const p = crew.where(id) || o.C.work[id];
		try { return SO.state.meet({ id: 'colony:' + id, bodyKey: SO.bodyKey(), home: SO.positionFor(W, o.C.work[id] || p), position: SO.positionFor(W, p), dna: {}, persona: { name: byId[id].name, first: first(id) }, source: 'colony' }); } catch { return null; }
	}
	const remember = (id, text) => { const r = resident(id); if (r) social().state.remember(r.id, 'event', text); };
	function accept(qid) {
		const Q = QUESTS[qid];
		if (!offerable(S, qid)) return null;
		step(S, qid, 'accept');
		S.track = qid;
		if (Q.start) give(Q.start, qid);
		note(`Took on “${Q.title}” for ${byId[Q.giver].name}.`);
		remember(Q.giver, `The traveller agreed to help: ${Q.title}. Next: ${Q.steps[0].text}.`);
		save();
		hint?.(`New errand: ${Q.title}\n${Q.steps[0].text}`, 5000);
		if (qid === 'earthrise') return meetUp();
		return { say: `[[mood: happy]] [[gesture: nod]] Thank you. ${Q.steps[0].text}.` };
	}
	function next(qid, why) {
		const Q = QUESTS[qid], st = step(S, qid, 'next');
		if (st.s === 'done') return done(qid);
		note(why || `${Q.title}: ${Q.steps[st.k - 1].text}. Done.`);
		save();
		hint?.(`${Q.title}\n${Q.steps[st.k].text}`, 4500);
		return null;
	}
	function done(qid) {
		const Q = QUESTS[qid];
		S.q[qid] = { s: 'done', k: Q.steps.length };
		pay(Q.reward.credits, qid);
		if (S.track === qid) S.track = Object.keys(QUESTS).find((k) => stateOf(S, k).s === 'active') || null;
		note(`Finished “${Q.title}”: +${Q.reward.credits} credits.`);
		remember(Q.giver, `The traveller finished ${Q.title}. You are grateful.`);
		save();
		hint?.(`Errand done: ${Q.title}\n+${Q.reward.credits} credits`, 5000);
		return { say: `[[mood: happy]] [[gesture: bow]] ${Q.thanks}` };
	}

	// ---------- the earthrise watch: a gathering in the observation lounge ----------
	function meetUp() {
		const SO = social(), W = o.world?.(), r = resident('historian');
		if (!SO || !W || !r || !o.C.watch) return { say: '[[mood: thoughtful]] I will send word when we are ready. Come to the observation lounge after supper.' };
		const hours = W.sky.state.hours, due = Math.ceil(hours + 1.2), delta = due - hours;
		const gathering = makeGathering({ kind: 'watch', placeName: 'the observation lounge', phone: !!isPhone, seed: (plan.seed * 31 + due) >>> 0 });
		const made = SO.appointments.make({ bodyKey: SO.bodyKey(), npcId: r.id, npcName: byId.historian.name, place: { name: 'the observation lounge', pos: SO.positionFor(W, o.C.watch), radius: 7 }, hours, delta, by: 'player', gathering });
		if (!made.ok) return { say: `[[mood: sad]] ${made.error}` };
		S.meet = made.appointment.id; S.played = null; save();
		const real = formatReal(realSecondsFor(delta, hours, W.sky.state));
		SO.state.remember(r.id, 'event', `You invited the traveller to the earthrise watch in the observation lounge at ${formatClock(due % 24)}; they said they would come.`);
		return { say: `[[mood: happy]] [[gesture: open]] Wonderful. ${formatClock(due % 24)} in the observation lounge, then. I will bring the recorder.`, note: `📍 Earthrise watch · the observation lounge at ${formatClock(due % 24)} (${real}). It is in your Quests, and a pin marks the place.` };
	}
	const meeting = () => { const SO = social(); return S.meet && SO ? SO.appointments.list(SO.bodyKey()).find((a) => a.id === S.meet) || null : null; };

	// ---------- talking ----------
	const choice = (label, fn) => ({ label, fn });
	// what someone adds when you come up to them: an offer, thanks, a nudge, the colony's news
	function talkOpen(id) {
		const e = errandFor(S, id);
		if (id === 'traffic') { const r = rideOffer(); if (r && (!e || e.kind === 'nag')) return r; }
		if (!e) {
			for (const [qid, lines] of Object.entries(REACT)) if (stateOf(S, qid).s === 'done' && lines[id] && !S.heard[id + ':' + qid]) { S.heard[id + ':' + qid] = 1; save(); return { say: `[[mood: happy]] ${lines[id]}` }; }
			return null;
		}
		const Q = QUESTS[e.id], st = stepOf(S, e.id);
		if (e.kind === 'offer') { S.pending = e.id; return { say: `[[mood: thoughtful]] [[gesture: explain]] ${Q.offer}`, choices: [choice('I\'ll do it', () => accept(e.id)), choice('Not now', () => ({ say: '[[mood: calm]] [[gesture: shrug]] Another time, then.' }))] }; }
		if (e.kind === 'hand') return { say: `[[mood: happy]] [[gesture: open]] ${Q.hand.say}`, choices: [choice('Take it', () => { give(Q.hand.item, e.id); next(e.id, `${first(id)} handed over: ${ITEMS[Q.hand.item].name}.`); return { say: '[[mood: calm]] [[gesture: nod]] Mind how you go.' }; })] };
		if (e.kind === 'nag') {
			if (e.id === 'earthrise') {
				const a = meeting();
				if (!a || a.status === 'missed' || a.status === 'cancelled') return { say: `[[mood: sad]] ${a ? Q.missed : 'Shall we set a time for the earthrise watch?'}`, choices: [choice('Gather again', () => meetUp()), choice('Not now', () => ({ say: '[[mood: calm]] Whenever you are ready.' }))] };
				return { say: `[[mood: happy]] ${Q.nag} ${formatClock(a.due % 24)}.` };
			}
			return { say: `[[mood: calm]] ${Q.nag}`, note: st ? `Next: ${st.text}` : null };
		}
		// a step that ends with this person: hand something over, or simply report
		const item = itemFor(e.id, 'taken');
		if (item && !has(item)) return { say: `[[mood: thoughtful]] Have you got the ${ITEMS[item].name.toLowerCase()}? ${Q.nag}` };
		const label = item ? `Hand over the ${ITEMS[item].name.toLowerCase()}` : 'It is done';
		return { say: `[[mood: happy]] ${st.id === 'report' ? 'Well?' : 'Is that it?'}`, choices: [choice(label, () => { if (item) take(item, e.id); return next(e.id) || { say: '[[mood: happy]] Thank you.' }; })] };
	}
	// Tomas sends a rover where your errand is going
	function rideOffer() {
		const qid = S.track && stateOf(S, S.track).s === 'active' ? S.track : Object.keys(QUESTS).find((k) => stateOf(S, k).s === 'active');
		const site = qid && siteOf(stepOf(S, qid));
		if (!site || !o.ride) return null;
		return { say: `[[mood: calm]] [[gesture: point]] Heading out to ${site}? I have a rover warming up at the airlock.`, choices: [choice(`Rover to ${site}`, () => { setTimeout(() => o.ride(site), 600); return { say: '[[mood: happy]] [[gesture: wave]] Rover\'s yours. Suit sealed, mind the dust.' }; }), choice('Not yet', () => ({ say: '[[mood: calm]] Say the word.' }))] };
	}
	// what was said: yes or no to an offer, or asking for something to do
	function talkReply(id, text) {
		const t = text.trim();
		const e = errandFor(S, id);
		if (S.pending && QUESTS[S.pending]?.giver === id && offerable(S, S.pending)) {
			if (YES.test(t)) { const qid = S.pending; S.pending = null; return accept(qid); }
			if (NO.test(t)) { S.pending = null; return { say: '[[mood: calm]] [[gesture: shrug]] Another time, then.' }; }
		}
		if (ASK.test(t)) {
			if (e?.kind === 'offer') { S.pending = e.id; return { say: `[[mood: thoughtful]] [[gesture: explain]] ${QUESTS[e.id].offer}`, choices: [choice('I\'ll do it', () => accept(e.id)), choice('Not now', () => ({ say: '[[mood: calm]] Another time, then.' }))] }; }
			if (e) return talkOpen(id);
			const other = CAST.find((c) => c.id !== id && errandFor(S, c.id)?.kind === 'offer');
			return { say: other ? `[[mood: thoughtful]] [[gesture: point]] Not from me just now, but ${other.name} was looking for a hand.` : '[[mood: happy]] You have done plenty for us already. Go and enjoy the view.' };
		}
		if (id === 'traffic' && /\b(rover|ride|lift|take me|send me|maglev)\b/i.test(t)) return rideOffer() || { say: '[[mood: calm]] [[gesture: point]] Any terminal will send a rover anywhere on the network. Pick a site and go.' };
		return null;
	}

	// ---------- at the terminals ----------
	function buttons(T) {
		const out = [];
		const s1 = stepOf(S, 'relay');
		if (T.kind === 'depot' && s1?.id === 'fetch') out.push({ id: 'relay:draw', label: 'Draw a relay transceiver board (for Helena)' });
		if (terminal('relay') === T && s1?.id === 'carry') out.push({ id: 'relay:fit', label: has('relay-transceiver-board') ? 'Fit the transceiver board' : 'Fit the board (you have none: draw one at the depot)', off: !has('relay-transceiver-board') });
		if (terminal('observatory') === T && stepOf(S, 'dish')?.id === 'align') out.push({ id: 'dish:align', label: 'Align the dish on Kenji\'s quasar (21:00–23:00)' });
		return out;
	}
	function act(key) {
		const hours = o.world?.()?.sky?.state?.hours ?? 12;
		if (key === 'relay:draw' && stepOf(S, 'relay')?.id === 'fetch') { give('relay-transceiver-board', 'relay'); next('relay', 'Drew a relay transceiver board at the depot.'); return 'Hannah signs out a transceiver board. You are holding it.'; }
		if (key === 'relay:fit' && stepOf(S, 'relay')?.id === 'carry' && has('relay-transceiver-board')) { take('relay-transceiver-board', 'relay'); next('relay', 'Fitted the transceiver board at Far Side Relay.'); return 'The board clicks home. The dishes swing, and six green lights come up one by one.'; }
		if (key === 'dish:align' && stepOf(S, 'dish')?.id === 'align') {
			if (!inWindow(QUESTS.dish.window, hours)) return `The target is still behind the crater rim (now ${formatClock(hours)}). Come back between 21:00 and 23:00.`;
			next('dish', 'Set the Daedalus dish on the quasar.');
			return 'The great dish turns, slow as a sunflower, and locks. A thin line climbs out of the noise on the screen.';
		}
		return null;
	}

	// ---------- the things done with your hands out on the regolith ----------
	const doBtn = mount ? document.createElement('button') : null;
	let doing = null;
	if (doBtn) {
		doBtn.type = 'button';
		doBtn.style.cssText = 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(140px + env(safe-area-inset-bottom));display:none;min-height:44px;padding:9px 14px;border-radius:20px;border:1px solid rgba(226,191,106,.7);background:rgba(8,20,26,.82);color:#eafaf6;font:600 13px system-ui;cursor:pointer;z-index:4;';
		for (const ev of ['pointerdown', 'touchstart', 'keydown']) doBtn.addEventListener(ev, (e) => e.stopPropagation());
		doBtn.addEventListener('click', (e) => { e.stopPropagation(); doBtn.blur(); doing?.(); });
		mount.append(doBtn);
	}
	const onKey = (e) => { if ((e.key === 'e' || e.key === 'E') && doing && !e.repeat && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') && !o.terminalNear?.()) { e.preventDefault(); doing(); } };
	if (doBtn) addEventListener('keydown', onKey);
	function recover() {
		if (stepOf(S, 'kestrel')?.id !== 'find') return;
		give('kestrel-flight-recorder', 'kestrel');
		next('kestrel', 'Recovered the Kestrel\'s flight recorder from the wreck.');
		hint?.('Under a buckled panel in the tail: an orange box, still blinking. The Kestrel\'s flight recorder.', 5000);
	}

	// ---------- each moment ----------
	let clock = 0, blink = 0;
	function update(dt) {
		blink += dt;
		const fixed = stateOf(S, 'relay').s === 'done' || ['report'].includes(stepOf(S, 'relay')?.id);
		if (fault) { fault.material.color.setHex(fixed ? 0x30ff60 : 0xff2a1a); fault.visible = fixed || Math.sin(blink * 6) > 0; }
		if (beacon) beacon.visible = stateOf(S, 'kestrel').s === 'none' || stepOf(S, 'kestrel')?.id === 'find' ? Math.sin(blink * 4) > 0.3 : false;
		clock -= dt;
		if (clock > 0) return;
		clock = 0.3;
		const P = o.player?.(), cam = o.camera.position;
		// by the wreck with the recorder still in it
		const want = !!P && !P.flying && stepOf(S, 'kestrel')?.id === 'find' && wreckAt && Math.hypot(cam.x - wreckAt.x, cam.z - wreckAt.z) < 9;
		doing = want ? recover : null;
		if (doBtn) { const d = want ? 'block' : 'none'; if (doBtn.style.display !== d) doBtn.style.display = d; if (want) doBtn.textContent = `🛠 Recover the flight recorder${o.isTouch ? '' : ' (E)'}`; }
		// the earthrise watch: the recording played while you are there; kept or missed
		const a = stateOf(S, 'earthrise').s === 'active' ? meeting() : null;
		if (a) {
			const SO = social(), t = SO.appointments.clock(), here = Math.hypot(cam.x - o.C.watch.x, cam.z - o.C.watch.z) < 8;
			if (gatheringStage(a, t) === 'on' && here && S.played !== a.id) {
				S.played = a.id; save();
				TRANSCRIPT.forEach((line, i) => setTimeout(() => hint?.(`Kestrel flight recorder\n“${line}”`, 4200), 1500 + i * 4600));
				setTimeout(() => hint?.('Over the rim of the world, slow and blue, Earth rises.', 5000), 1500 + TRANSCRIPT.length * 4600);
			}
			if (a.status === 'kept') done('earthrise');
		}
	}
	// a pin and a chip for the errand you follow (guide.js waypointMark)
	function mark() {
		const qid = S.track && stateOf(S, S.track).s === 'active' ? S.track : null;
		const st = qid && stepOf(S, qid);
		if (!st || st.meet) return null;
		const p = placeOf(st);
		if (!p) return null;
		return { x: p.x, y: p.y, z: p.z, radius: p.radius, title: `${QUESTS[qid].title} · ${p.label}`, detail: st.text };
	}
	// the errands for the guide's journal
	function journal() {
		const list = [];
		for (const [qid, Q] of Object.entries(QUESTS)) {
			const st = stateOf(S, qid);
			if (st.s === 'none') { if (offerable(S, qid) && Q.main === 1) list.push({ text: `○ ${Q.title}\nAsk ${byId[Q.giver].name} (${byId[Q.giver].job}).`, active: false }); continue; }
			if (st.s === 'done') { list.push({ text: `✓ ${Q.title} · +${Q.reward.credits} credits`, active: false }); continue; }
			const s = Q.steps[st.k], item = Object.keys(ITEMS).find((k) => ITEMS[k].quest === qid && has(k));
			list.push({ text: `${S.track === qid ? '◆' : '•'} ${Q.title}${Q.main ? ` · part ${Q.main} of 3` : ''}\n${s.text}${item ? `\nCarrying: ${ITEMS[item].name}` : ''}`, active: true, track: s.meet ? null : () => { S.track = qid; save(); } });
		}
		return { title: `COLONY ERRANDS · ${plan.name.toUpperCase()}`, list, log: S.log.slice(-6).map((l) => l.text) };
	}
	// what the colony has heard, for anyone's conversation
	const news = () => Object.keys(NEWS).filter((k) => stateOf(S, k).s === 'done').slice(-2).map((k) => 'news: ' + NEWS[k]);
	// one line on someone's own errand, for their conversation
	function questLine(id) {
		const e = errandFor(S, id);
		if (!e) return '';
		const Q = QUESTS[e.id], st = stepOf(S, e.id);
		if (e.kind === 'offer') return `wants to ask the player a favour: ${Q.title} (the game offers it; never claim it is already accepted)`;
		if (e.kind === 'hand') return `is ready to hand the player something for ${Q.title}`;
		return `asked the player to help with ${Q.title}; it is underway, next: ${st?.text || 'nearly done'}`;
	}
	// the earthrise watch: who goes, while it is arriving or on
	function watching(id) {
		const a = meeting();
		if (!a || !['agreed', 'kept'].includes(a.status)) return false;
		const stage = gatheringStage(a, social().appointments.clock());
		if (stage !== 'arriving' && stage !== 'on') return false;
		return ['historian', 'director', 'cook', 'hydro', 'medic', 'quartermaster', 'mechanic'].slice(0, isPhone ? 4 : 7).includes(id) && !holds(S, id);
	}
	function dispose() {
		if (doBtn) { removeEventListener('keydown', onKey); doBtn.remove(); }
		lamps.removeFromParent(); lampGeo.dispose();
		for (const m of lamps.children) m.material.dispose();
	}
	return {
		S, talkOpen, talkReply, buttons, act, update, mark, journal, news, questLine, watching, dispose,
		holds: (id) => holds(S, id),
		markFor: (id) => { const e = errandFor(S, id); return !e ? null : e.kind === 'offer' ? 'offer' : e.kind === 'nag' ? null : 'ready'; },
		site: () => siteOf(stepOf(S, S.track)),
		info: () => Object.fromEntries(Object.entries(QUESTS).map(([id]) => { const st = stateOf(S, id); return [id, { s: st.s, step: stepOf(S, id)?.id || null }]; })),
		debug: { accept, act, set: (id, s, k = 0) => { S.q[id] = { s, k }; save(); }, reset: () => { try { localStorage.removeItem(KEY); } catch { /* storage off */ } } },
	};
}
