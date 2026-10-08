// Playing with friends. The host taps Invite friends and shares a link (?room=CODE); friends
// who open it land where the host is and see each other walk, run, fly, swim and drive. The
// host's hour and weather are everyone's, and the meetings and gatherings the host arranges
// show for guests too (read only, with a pin; a gathering's crowd comes for everyone, from the
// same seed). Tap a friend to follow them or go to them.
//
// Nothing here runs without a rooms server (net/config.js). What is said to townsfolk is never
// sent: only poses, spots, the hour and weather, and the plain facts of a meeting.

import * as THREE from 'three';
import { roomsURL } from './config.js';
import { createRoomClient } from './client.js';
import { createRemotes } from './remotes.js';
import { followStep, besideOf, BREAK_S } from './follow.js';
import { cleanCode, cleanName } from './protocol.js';
import { pack, unpack } from '../share.js';
import { createAppointments, formatClock } from '../people/appointments.js';
import { createGatheringScene } from '../people/gathering-scene.js';
import { worldPosition } from '../people/social-actors.js';
import { toLL } from '../earth/globeframe.js';
import { createWaypoint } from '../ui/waypoint.js';

const ID_KEY = 'l99-mp-id', NAME_KEY = 'crysis-name', ME_KEY = 'l99-me';
const EYE = 1.68;
const BTN = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;';
const SMALL = 'padding:6px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(1,169,130,.18);color:#eafaf6;font:12px system-ui;min-height:32px;cursor:pointer;';
const stop = (el) => { for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation()); return el; };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

// one id a tab (kept over a reload), so two tabs in one browser are two players
function myId() {
	let id = null;
	try { id = sessionStorage.getItem(ID_KEY); } catch { /* private mode */ }
	if (!/^[A-Za-z0-9_-]{8,40}$/.test(id || '')) {
		const b = new Uint8Array(12); crypto.getRandomValues(b);
		id = 'p' + [...b].map((x) => x.toString(36).padStart(2, '0')).join('').slice(0, 20);
		try { sessionStorage.setItem(ID_KEY, id); } catch { /* this visit only */ }
	}
	return id;
}

export function createMultiplayer({ scene, camera, world, state, share, hint, mount, menu, canvas, isPhone, drive, social, enter }) {
	const url = roomsURL();
	if (!url) return { available: false, update() {}, reset() {}, join: async () => false, info: () => ({ available: false }) };

	const id = myId();
	const name = () => cleanName(store.get(NAME_KEY) || 'Player ' + id.slice(1, 4).toUpperCase());
	const seed = (+store.get(ME_KEY)) >>> 0 || 7919;
	const W = () => world();
	const remotes = createRemotes({ scene, camera, world, isPhone });
	// the host's plans, kept here for this visit only (a guest's own journal is untouched)
	const book = createAppointments({ storage: null });
	const plans = new Map();
	const crowd = createGatheringScene({ scene, world, camera, book, bodyKey: () => 'mp' });
	// the pin for a plan being shown (made when first needed, and again after a world change,
	// which clears the scene)
	let pin = null;
	function pinNow() {
		if (pin) return pin;
		pin = createWaypoint({ scene, camera, mount, onTap: () => openPanel() });
		const chip = mount.lastElementChild;
		if (chip) chip.style.top = 'calc(136px + env(safe-area-inset-top))';
		return pin;
	}
	let stopped = '', pendingState = null, hostClock = null, following = null, manualT = 0, travelling = null, tracked = null;
	const room = createRoomClient({ url, id, name, seed, on: (t, v) => heard(t, v) });
	// the gear screen (ui/gear.js), once linked: the item in your hand, trades, and its buttons
	// beside each friend
	let gear = null;

	// ---------- what the room says ----------
	function heard(t, v) {
		try { gear?.heard(t, v); } catch (e) { console.warn('[room] gear', e); }
		if (t === 'status') { chipDraw(); if (v.why) hint(v.why, 4000, 1); if (v.status === 'off') { remotes.clear(); following = null; clearAuto(); } }
		else if (t === 'welcome') {
			remotes.clear();
			for (const p of v.players) if (p.id !== id) remotes.add(p);
			if (v.state) applyState(v.state);
			for (const e of v.events || []) plan(e);
			sent.spot = ''; sent.spotT = 0; sent.stateT = 0; sent.events.clear();
			travelling?.(v);
			drawPanel(); chipDraw();
		} else if (t === 'join') { remotes.add(v); hint(`${v.name} joined.`, 2500, 1); drawPanel(); chipDraw(); }
		else if (t === 'leave') {
			const r = remotes.list.get(v.id);
			if (r) hint(`${r.name} left.`, 2500, 1);
			if (following === v.id) unfollow(`${r?.name || 'Your friend'} left, so you stopped following.`);
			remotes.remove(v.id); drawPanel(); chipDraw();
		} else if (t === 'host') { if (v.id === id) hint('You are the host now: your hour and weather are everyone\'s.', 4000, 1); sent.stateT = 0; sent.events.clear(); drawPanel(); chipDraw(); }
		else if (t === 'pose') remotes.push(v.id, v);
		else if (t === 'state') { if (!room.isHost()) applyState(v); }
		else if (t === 'event') { if (!room.isHost()) plan(v); drawPanel(); }
		else if (t === 'closed') { remotes.clear(); drawPanel(); }
	}

	// ---------- the host's world, on a guest ----------
	function applyState(s) {
		const w = W();
		if (Number.isFinite(s.clock)) hostClock = s.clock;
		if (!w?.sky) { pendingState = s; return; }
		pendingState = null;
		const S = w.sky.state, d = Math.abs(((s.hours - S.hours + 36) % 24) - 12);
		if (12 - d > 0.02) S.hours = s.hours;
		S.speed = s.speed; S.real = s.real;
		if (w.weather) {
			if (w.weather.state.mode !== s.weather.mode) w.weather.set(s.weather.mode);
			w.weather.state.day = s.weather.day;
		}
		syncPlans();
	}
	// a meeting or gathering of the host's, into this visit's book
	function plan(e) {
		const had = plans.get(e.id);
		plans.set(e.id, { ...e, local: had?.local || null });
		syncPlans();
	}
	function syncPlans() {
		const w = W();
		if (hostClock == null || !w?.sky) return;
		const hours = w.sky.state.hours;
		book.setHours(hours);
		for (const e of plans.values()) {
			if (e.status === 'cancelled') { if (e.local) book.cancel(e.local); continue; }
			if (e.local || e.status !== 'agreed') continue;
			const delta = e.due - hostClock;
			if (delta < -2) continue;
			const r = book.make({ bodyKey: 'mp', npcId: 'mp:' + e.id, npcName: e.npcName, place: e.place, hours, delta, by: 'player', status: 'agreed', gathering: e.gathering || null });
			if (r.ok) e.local = r.appointment.id;
		}
	}

	// ---------- what this player sends ----------
	const sent = { t: 0, x: 1e9, z: 0, y: 0, yaw: 0, a: '', h: '', spotT: 0, spot: '', stateT: 0, events: new Map() };
	const look = new THREE.Vector3();
	function worldKey() { return state.earth ? 'earth' : 'w' + state.seed; }
	function pose() {
		const w = W(), P = w?.player?.state;
		if (!P) return null;
		const car = !!drive?.active?.(), boat = !!w.boat?.boarded?.();
		const at = car ? camera.position : P.pos;
		const sp = Math.hypot(P.vel.x, P.vel.z);
		const a = car ? 'drive' : P.flying ? 'fly' : P.swimming ? 'swim' : sp > 6 ? 'run' : sp > 0.3 ? 'walk' : 'idle';
		if (car) camera.getWorldDirection(look);
		// (the item in hand, its level and tier)
		const H = gear?.held?.();
		return { t: 'pose', p: [at.x, at.y, at.z], y: car ? Math.atan2(-look.x, -look.z) : P.yaw, a, v: car ? 'car' : boat ? 'boat' : '', w: worldKey(), h: H?.i, hl: H?.l, ht: H?.t };
	}
	// (timed by the clock, not by frames: a slow phone still keeps to the pace)
	function sendAll() {
		if (room.status !== 'on') return;
		// (not while you are still arriving: you hang in the air behind the card meanwhile)
		const p = share.busy?.() ? null : pose(), now = performance.now();
		if (p) {
			// about ten a second while moving; when still, only a change (pings keep you in)
			const moved = Math.hypot(p.p[0] - sent.x, p.p[2] - sent.z) > 0.05 || Math.abs(p.p[1] - sent.y) > 0.05 || Math.abs(p.y - sent.yaw) > 0.03 || p.a !== sent.a || `${p.h}${p.hl}${p.ht}` !== sent.h;
			if (moved && now - sent.t >= 100) { room.send(p); sent.t = now; sent.x = p.p[0]; sent.z = p.p[2]; sent.y = p.p[1]; sent.yaw = p.y; sent.a = p.a; sent.h = `${p.h}${p.hl}${p.ht}`; }
		}
		// where you are, for a friend's Go to (and a guest's arrival): every few seconds
		if (now - sent.spotT > 4000) {
			sent.spotT = now;
			const s = share.capture?.();
			if (s) { s.by = name(); const c = pack(s); if (c !== sent.spot) { sent.spot = c; room.send({ t: 'spot', code: c }); } }
		}
		if (room.isHost() && now >= sent.stateT) {
			sent.stateT = now + 3000;
			const w = W(), soc = social?.();
			if (w?.sky) room.send({ t: 'state', s: { hours: w.sky.state.hours, speed: w.sky.state.speed, real: !!w.sky.state.real, clock: soc?.appointments?.clock?.() ?? null, weather: { mode: w.weather?.state.mode || 'auto', day: w.weather?.state.day || 0 } } });
			hostPlans(soc);
		}
	}
	// the host's own meetings and gatherings: their plain facts, as they change
	function hostPlans(soc) {
		const B = soc?.appointments, key = soc?.bodyKey?.();
		if (!B || !key) return;
		for (const a of B.list(key)) {
			if (a.status === 'proposed' || (a.endedAt && Date.now() - a.endedAt > 3600e3)) continue;
			const e = { id: a.id.replace(/[^A-Za-z0-9_:-]/g, ''), npcName: a.npcName, place: a.place, due: a.due, status: a.status, gathering: a.gathering || null };
			const k = JSON.stringify(e);
			if (sent.events.get(e.id) === k) continue;
			if (room.send({ t: 'event', e })) sent.events.set(e.id, k);
		}
	}

	// ---------- follow and go to ----------
	const clearAuto = () => { const P = W()?.player?.state; if (P?.auto?.mp) { P.auto = null; P.flyUp = P.flyDown = false; } };
	function follow(fid) {
		const r = remotes.list.get(fid);
		if (!r) return;
		following = fid; manualT = 0;
		hint(`Following ${r.name}. Move to stop.`, 3000, 1);
		const a = remotes.where(fid);
		if (!a || !Number.isFinite(a[0])) goTo(fid);
		drawPanel();
	}
	function unfollow(msg) { if (!following) return; following = null; stopped = msg || 'by hand'; clearAuto(); if (msg) hint(msg, 3000, 1); drawPanel(); }
	function goTo(fid) {
		const r = remotes.list.get(fid), w = W(), P = w?.player?.state, a = remotes.where(fid);
		if (!r) return false;
		if (P && a && Number.isFinite(a[0]) && r.d < Infinity) {
			const b = besideOf({ x: a[0], z: a[2], yaw: a.y });
			const g = w.island.heightAt(b.x, b.z);
			P.vel.set(0, 0, 0);
			P.flying = a.a === 'fly';
			P.pos.set(b.x, P.flying ? a[1] : Math.max(g, a[1] - EYE) + EYE, b.z);
			P.yaw = a.y;
			return true;
		}
		const code = room.players.get(fid)?.spot;
		if (!code) { hint(`Waiting to hear where ${r.name} is…`, 2500, 1); return false; }
		share.openAt(beside(code));
		return true;
	}
	// a spot code moved a couple of metres aside, so you don't land inside your friend
	function beside(code) {
		const s = unpack(code);
		if (!s) return code;
		const b = besideOf({ x: s.x, z: s.z, yaw: s.yaw }, 3);
		s.x = b.x; s.z = b.z;
		if (s.earth) Object.assign(s, toLL(s.x, s.z));
		return pack(s);
	}
	function steer(dt) {
		const w = W(), P = w?.player?.state;
		if (!following || !P) return;
		const r = remotes.list.get(following), a = remotes.where(following);
		if (!r || !a || r.d === Infinity || !Number.isFinite(a[0])) { clearAuto(); return; }
		// your own hand on the controls: a nudge is fine, keep at it and the follow ends
		const own = w.player.input?.();
		manualT = own && (own.mx || own.mz) ? manualT + dt : Math.max(0, manualT - dt * 2);
		if (manualT > BREAK_S) { unfollow(`You stopped following ${r.name}.`); return; }
		const s = followStep({ x: P.pos.x, y: P.pos.y, z: P.pos.z, yaw: P.yaw }, { x: a[0], y: a[1], z: a[2], yaw: a.y, fly: a.a === 'fly', speed: a.speed });
		if (s.jump) { goTo(following); return; }
		if (s.fly !== P.flying && a.a !== 'drive' && !w.orbit?.high?.()) { P.flying = s.fly; P.vel.y = 0; }
		P.auto = { x: s.mx, z: s.mz, run: s.run, mp: true };
		P.flyUp = s.up; P.flyDown = s.down;
	}

	// ---------- the room ----------
	async function invite() {
		if (room.status === 'on' && room.isHost()) { showInvite(); return true; }
		try {
			const code = await room.create();
			room.join(code);
			showInvite();
			return true;
		} catch (e) { hint(e.message || 'Could not make a room.', 4000, 1); return false; }
	}
	// joining from a link: in, then over to wherever the host is
	function join(code, { travel = true } = {}) {
		const c = cleanCode(code);
		if (!c) { hint('That is not a room code.', 3000, 1); return Promise.resolve(false); }
		if (room.status !== 'off' && room.room() === c) return Promise.resolve(true);
		if (room.status !== 'off') room.leave();
		return new Promise((done) => {
			let settled = false;
			const finish = (v) => { if (!settled) { settled = true; travelling = null; done(v); } };
			const give = setTimeout(() => finish(false), 30000);
			travelling = !travel ? null : async (welcome) => {
				clearTimeout(give);
				travelling = null;
				const hostId = welcome.host;
				if (hostId === id) { finish(true); return; }
				// the host's spot: in the welcome, or soon after
				let spot = welcome.players.find((p) => p.id === hostId)?.spot;
				for (let i = 0; !spot && i < 100; i++) { await new Promise((r) => setTimeout(r, 200)); spot = room.players.get(hostId)?.spot; }
				if (spot) await share.openAt(beside(spot));
				else if (!W()) await enter({ seed: 1337, earth: true });
				finish(true);
			};
			if (!room.join(c)) { clearTimeout(give); finish(false); }
			if (!travel) finish(true);
		});
	}
	function leave() { if (room.isHost() && room.players.size) room.send({ t: 'end' }); room.leave(); remotes.clear(); unfollow(); plans.clear(); hostClock = null; tracked = null; pin?.set(null); crowd.dispose(); drawPanel(); chipDraw(); }
	const link = () => { try { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('room', room.room()); const rq = new URLSearchParams(location.search).get('rooms'); if (rq && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)) u.searchParams.set('rooms', rq); return u.href; } catch { return '?room=' + room.room(); } };

	// ---------- the screen: menu entries, the status chip, the panel, the invite card ----------
	const sec = stop(document.createElement('div'));
	sec.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:none;';
	const first = menu.firstElementChild;
	menu.insertBefore(sec, first ? first.nextSibling : null);
	const mk = (label, title, fn, extra = '') => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.title = title; b.style.cssText = BTN + extra; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; };
	function drawMenu() {
		sec.replaceChildren();
		if (room.status === 'off') {
			sec.append(mk('👥 Invite friends', 'Make a room and send friends a link', () => { menu.style.display = 'none'; invite(); }, 'border-color:rgba(95,240,198,.5);'));
			const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:4px;';
			const inp = document.createElement('input'); inp.placeholder = 'Room code'; inp.maxLength = 8; inp.autocapitalize = 'characters';
			inp.style.cssText = 'flex:1;min-width:0;padding:6px 8px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.3);color:#eafaf6;font:13px ui-monospace,monospace;text-transform:uppercase;';
			const go = mk('Join', 'Join a friend\'s room', () => { menu.style.display = 'none'; join(inp.value); }, 'padding:8px 12px;');
			inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') go.click(); });
			row.append(inp, go);
			sec.append(row);
		} else sec.append(mk(`👥 Room ${room.room()} · ${room.players.size + 1} here`, 'Who is here: follow, go to, leave', () => { menu.style.display = 'none'; openPanel(); }, 'border-color:rgba(95,240,198,.5);'));
		const hr = document.createElement('div'); hr.style.cssText = 'height:1px;background:rgba(255,255,255,.15);margin:4px 2px;flex:none;';
		sec.append(hr);
	}

	const chip = stop(document.createElement('button'));
	chip.type = 'button';
	chip.style.cssText = 'position:absolute;left:calc(12px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top));display:none;align-items:center;gap:6px;padding:5px 10px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:rgba(8,20,26,.6);color:#eafaf6;font:600 12px system-ui;z-index:6;cursor:pointer;';
	chip.onclick = (e) => { e.stopPropagation(); openPanel(); };
	mount.appendChild(chip);
	function chipDraw() {
		const s = room.status, on = s !== 'off';
		chip.style.display = on ? 'flex' : 'none';
		const col = s === 'on' ? '#5ff0c6' : s === 'reconnecting' ? '#f0c95f' : '#9fb';
		const words = s === 'on' ? `${room.room()} · ${room.players.size + 1}${room.isHost() ? ' · host' : ''}` : s === 'reconnecting' ? 'Reconnecting…' : 'Connecting…';
		chip.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:${col}"></span>`;
		chip.append(words);
		chip.setAttribute('aria-label', `Room ${words}`);
		drawMenu();
	}

	const panel = stop(document.createElement('div'));
	panel.style.cssText = 'position:absolute;left:calc(12px + env(safe-area-inset-left));top:calc(100px + env(safe-area-inset-top));width:min(300px,82vw);max-height:60%;overflow-y:auto;padding:12px;border-radius:14px;background:rgba(8,20,26,.88);border:1px solid rgba(255,255,255,.18);color:#e6f6f2;font:13px system-ui;display:none;flex-direction:column;gap:8px;z-index:7;';
	mount.appendChild(panel);
	function openPanel() { panel.style.display = 'flex'; drawPanel(); }
	function drawPanel() {
		if (panel.style.display === 'none') return;
		panel.replaceChildren();
		const head = document.createElement('div'); head.style.cssText = 'display:flex;align-items:center;gap:8px;';
		const ttl = document.createElement('b'); ttl.style.flex = '1'; ttl.textContent = room.status === 'off' ? 'Friends' : `Room ${room.room()}`;
		head.append(ttl, button('✕', () => { panel.style.display = 'none'; }));
		panel.append(head);
		// your name, as friends see it
		const nm = document.createElement('input'); nm.value = name(); nm.maxLength = 24; nm.title = 'Your name';
		nm.style.cssText = 'padding:6px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.3);color:#eafaf6;font:13px system-ui;';
		nm.addEventListener('change', () => { store.set(NAME_KEY, cleanName(nm.value)); hint('Name saved: friends see it next time you join.', 2500, 1); });
		panel.append(nm);
		if (room.status === 'off') { panel.append(button('👥 Invite friends', () => invite())); return; }
		for (const r of remotes.list.values()) {
			const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;';
			const who = document.createElement('span'); who.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
			who.textContent = `${r.name}${room.host === r.id ? ' ★' : ''}${r.d < Infinity ? ` · ${r.d < 1000 ? Math.round(r.d) + ' m' : (r.d / 1000).toFixed(1) + ' km'}` : ''}`;
			row.append(who, ...extra(r), button(following === r.id ? 'Stop' : 'Follow', () => (following === r.id ? unfollow() : follow(r.id))), button('Go to', () => goTo(r.id)));
			panel.append(row);
		}
		if (!remotes.list.size) { const p = document.createElement('div'); p.style.opacity = '.7'; p.textContent = 'No one else yet. Send the link.'; panel.append(p); }
		// the host's plans, for guests: read only, with the way shown
		if (!room.isHost() && plans.size) {
			const h = document.createElement('div'); h.textContent = 'THE HOST\'S PLANS'; h.style.cssText = 'font:700 11px system-ui;letter-spacing:.08em;opacity:.6;';
			panel.append(h);
			for (const e of plans.values()) {
				if (e.status !== 'agreed') continue;
				const row = document.createElement('div'); row.style.cssText = 'display:flex;align-items:center;gap:6px;';
				const t = document.createElement('span'); t.style.cssText = 'flex:1;min-width:0;';
				t.textContent = `${e.gathering ? e.gathering.title : 'Meeting'} with ${e.npcName} at ${e.place.name}, ${formatClock(((e.due % 24) + 24) % 24)}`;
				row.append(t, button(tracked === e.id ? 'Hide' : 'Show the way', () => { tracked = tracked === e.id ? null : e.id; drawPanel(); }));
				panel.append(row);
			}
		}
		const foot = document.createElement('div'); foot.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;';
		foot.append(button('Copy link', () => copy()), button(room.isHost() ? 'End room' : 'Leave', () => leave()));
		panel.append(foot);
	}
	// the gear screen's buttons for a friend (Trade)
	const extra = (r, after) => (gear?.actions?.(r) || []).map(([label, fn]) => button(label, () => { after?.(); fn(); }));
	function button(label, fn) { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.style.cssText = SMALL; b.onclick = (e) => { e.stopPropagation(); fn(); }; return b; }
	async function copy() {
		const u = link(), text = `Come and play with me in Level 99 Bard: room ${room.room()}`;
		if (navigator.share) { try { await navigator.share({ title: 'Level 99 Bard', text, url: u }); return; } catch (e) { if (e?.name === 'AbortError') return; } }
		try { await navigator.clipboard.writeText(`${text}\n${u}`); hint('Link copied: send it to your friends.', 3000, 1); } catch { showInvite(); }
	}
	let card = null;
	function showInvite() {
		card?.remove();
		card = stop(document.createElement('div'));
		card.style.cssText = 'position:absolute;left:50%;top:26%;transform:translateX(-50%);width:min(380px,86vw);padding:14px;border-radius:14px;background:rgba(8,20,26,.94);border:1px solid rgba(95,240,198,.4);color:#eafaf6;font:13px system-ui;z-index:12;display:flex;flex-direction:column;gap:8px;';
		const big = document.createElement('div'); big.style.cssText = 'font:700 30px ui-monospace,monospace;letter-spacing:.2em;text-align:center;'; big.textContent = room.room();
		const t = document.createElement('div'); t.textContent = 'Your room is open. Friends who open this link come to you (up to 8 of you):';
		const inp = document.createElement('input'); inp.readOnly = true; inp.value = link();
		inp.style.cssText = 'width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#eafaf6;font:12px ui-monospace,monospace;';
		const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;justify-content:flex-end;';
		row.append(button('Share / copy', () => copy()), button('Done', () => { card.remove(); card = null; }));
		card.append(big, t, inp, row);
		mount.appendChild(card);
	}
	// a friend tapped in the world: follow or go to them
	let down = null, pop = null;
	canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
	canvas.addEventListener('pointerup', (e) => {
		if (!down || !remotes.list.size || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8 || performance.now() - down.t > 400) return;
		const R = canvas.getBoundingClientRect(), r = remotes.pick(e.clientX - R.left, e.clientY - R.top, R.width, R.height, camera);
		pop?.remove(); pop = null;
		if (!r) return;
		pop = stop(document.createElement('div'));
		pop.style.cssText = `position:absolute;left:${Math.min(e.clientX - R.left, R.width - 200)}px;top:${Math.max(8, e.clientY - R.top - 60)}px;display:flex;gap:6px;align-items:center;padding:8px;border-radius:12px;background:rgba(8,20,26,.9);border:1px solid rgba(255,255,255,.2);color:#eafaf6;font:13px system-ui;z-index:8;`;
		const n = document.createElement('b'); n.textContent = r.name;
		pop.append(n, ...extra(r, () => { pop?.remove(); pop = null; }), button(following === r.id ? 'Stop' : 'Follow', () => { pop.remove(); pop = null; following === r.id ? unfollow() : follow(r.id); }), button('Go to', () => { pop.remove(); pop = null; goTo(r.id); }));
		mount.appendChild(pop);
		setTimeout(() => { pop?.remove(); pop = null; }, 6000);
	});
	drawMenu();

	// ---------- each frame ----------
	let slowAt = 0;
	function update(dt, time) {
		if (room.status === 'off' && !remotes.list.size) return;
		const w = W(), P = w?.player?.state;
		if (pendingState && w?.sky) applyState(pendingState);
		try { sendAll(); } catch (e) { console.warn('[room] send', e); }
		remotes.update(dt, time, (p) => !!p && p.w === worldKey());
		steer(dt);
		if (performance.now() >= slowAt) {
			slowAt = performance.now() + 1000;
			if (!room.isHost() && w?.sky && plans.size) {
				syncPlans();
				book.tick({ hours: w.sky.state.hours, bodyKey: 'mp', player: P ? { x: P.pos.x, z: P.pos.z } : null });
			}
			const e = tracked && plans.get(tracked), q = e && worldPosition(w, e.place.pos);
			if (q || pin) pinNow().set(q ? { x: q.x, y: w.island.heightAt(q.x, q.z), z: q.z, title: `${e.gathering ? e.gathering.title : 'Meeting'} at ${e.place.name}`, detail: `the host's plan, ${formatClock(((e.due % 24) + 24) % 24)}`, radius: e.place.radius } : null);
			if (panel.style.display !== 'none') drawPanel();
		}
		pin?.update(dt, time, !!tracked);
		if (!room.isHost() && plans.size) crowd.update(dt, time, true);
	}
	// before a world is torn down: let go of what is in its scene
	function reset() { remotes.detach(); crowd.dispose(); clearAuto(); pin?.dispose(); pin = null; }

	return {
		available: true, update, reset, join, invite, leave, follow, unfollow, goTo,
		// for the gear screen: link it in, send it a message, and who is here and how far
		link: (g) => { gear = g; drawPanel(); }, send: (m) => room.send(m), me: () => id, status: () => room.status,
		friend: (fid) => { const r = remotes.list.get(fid); return r ? { id: r.id, name: r.name, d: r.d, here: r.d < Infinity } : null; },
		friends: () => [...remotes.list.values()].map((r) => ({ id: r.id, name: r.name, d: r.d, here: r.d < Infinity })),
		info: () => ({ available: true, status: room.status, code: room.room(), host: room.host, you: id, isHost: room.isHost(), following, stopped, players: [...remotes.list.values()].map((r) => ({ id: r.id, name: r.name, d: +r.d.toFixed?.(2), at: r.at && Number.isFinite(r.at[0]) ? [r.at[0], r.at[1], r.at[2]] : null, body: !!r.body?.P.root.visible })), plans: [...plans.values()], book: book.list('mp'), crowd: crowd.info?.() }),
	};
}
