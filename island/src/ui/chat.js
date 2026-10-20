// Chat: everyone online (World), everyone in your region of the world (Region) and your group
// (Group), by text or by voice (hold the mic to talk, or tap it to start and tap again to send).
// People finds who is online and keeps your group: invite someone, ask to join theirs, let in
// those who ask, hand over the lead, and Play together (the group's room, net/multiplayer.js).
//
// Its way in is the 💬 button under ◀ Bard (Enter on a keyboard). The latest lines show for a
// moment at the left while it is closed. On a phone it opens full screen; on a computer it is a
// panel down the left side, the game still in view.
//
// Names: a signed-in player's is their account's (☁, changed once in 30 days) with a tick; two
// people of one name talking at the same time, or in one group, show their own three-digit
// number; honor shows in the name: its title from Sentinel, bold from Vanguard, and gold dust
// at Exalted (combat/honor.js). The wire and the hub: net/chat-client.js, net/chat-protocol.js,
// server/multiplayer/src/chat.js.

import { createChatClient } from '../net/chat-client.js';
import { clashes, whoLabel, nameStyle, personKey, titleOf, TEXT_MAX, VOICE_MS, VOICE_B64_MAX, GROUP_MAX } from '../net/chat-protocol.js';

const MUTE_KEY = 'l99-chat-muted', NAME_KEY = 'crysis-name', TAB_KEY = 'l99-chat-tab', AUTO_KEY = 'l99-chat-autoplay';
// people who spoke within this long count as "talking at the same time" (for the numbers)
const NOW_MS = 15 * 60 * 1000;
const FEED_MS = 12000, FEED_LINES = 4;
const TABS = [['world', 'World'], ['region', 'Region'], ['group', 'Group'], ['people', 'People']];
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };

const CSS = `
.chat{position:absolute;z-index:19;display:none;flex-direction:column;background:rgba(14,16,18,.94);border:1px solid rgba(255,255,255,.1);box-shadow:0 20px 60px rgba(0,0,0,.6);color:#fff;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.chat.on{display:flex}
.chat.desk{left:calc(12px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top));bottom:calc(16px + env(safe-area-inset-bottom));width:min(400px,calc(100% - 24px));border-radius:16px}
.chat.full{inset:0;border-radius:0;border:0;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
.chat button{font:inherit;color:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.chat-head{display:flex;align-items:center;gap:10px;padding:12px 14px 8px}
.chat-head b{font-size:18px;font-weight:600}
.chat-head .chat-on{flex:1;font-size:12px;color:rgba(255,255,255,.55)}
.chat-x{width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.75)!important;font-size:16px!important}
.chat-tabs{display:flex;border-bottom:1px solid rgba(255,255,255,.1);padding:0 6px}
.chat-tab{flex:1;position:relative;padding:12px 2px 10px;border:0;border-bottom:3px solid transparent;background:none;color:rgba(255,255,255,.6)!important;font-weight:600!important;font-size:13px!important;min-height:44px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chat-tab.cur{color:#fff!important;border-bottom-color:#01a982}
.chat-dot{display:inline-block;min-width:16px;height:16px;padding:0 4px;margin-left:4px;border-radius:8px;background:#01a982;color:#fff;font:700 10px/16px system-ui;vertical-align:1px;box-sizing:border-box}
.chat-body{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding:10px 14px;display:flex;flex-direction:column;gap:6px}
.chat-where{font-size:12px;color:rgba(255,255,255,.55);padding-bottom:4px}
.chat-empty{margin:auto;text-align:center;color:rgba(255,255,255,.55);font-size:13px;max-width:280px;display:flex;flex-direction:column;gap:12px;align-items:center}
.chat-line{display:flex;gap:6px;align-items:baseline;word-break:break-word}
.chat-line .chat-t{flex:1;min-width:0}
.chat-line time{flex:none;font-size:11px;color:rgba(255,255,255,.35)}
.chat-sys{font-size:12px;color:rgba(255,255,255,.55);font-style:italic}
.chat-n{border:0;background:none;padding:0;font-weight:600!important;color:var(--c,#8fe9cf)!important}
.chat-n.bold{font-weight:800!important}
.chat-n.exalted{font-weight:800!important;position:relative;color:#f4dc95!important;background:linear-gradient(100deg,#e6c46a 0%,#fff3c9 42%,#f0cf73 50%,#d7ac45 100%);background-size:220% 100%;-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;-webkit-text-stroke:.35px rgba(255,226,140,.55);filter:drop-shadow(0 0 3px rgba(240,200,90,.55)) drop-shadow(0 0 9px rgba(240,200,90,.22));animation:chatGold 5s linear infinite}
.chat-n.exalted::after{content:'';position:absolute;inset:-5px -7px;pointer-events:none;background:radial-gradient(circle at 12% 30%,rgba(255,228,150,.85) 0 .8px,transparent 1.3px),radial-gradient(circle at 34% 88%,rgba(255,228,150,.7) 0 .7px,transparent 1.2px),radial-gradient(circle at 63% 12%,rgba(255,236,170,.8) 0 .8px,transparent 1.3px),radial-gradient(circle at 88% 70%,rgba(255,228,150,.7) 0 .7px,transparent 1.2px),radial-gradient(circle at 50% 50%,rgba(255,220,120,.10),transparent 70%);animation:chatDust 3.2s ease-in-out infinite alternate}
@keyframes chatGold{to{background-position:-220% 0}}
@keyframes chatDust{from{opacity:.45;transform:translateY(.5px)}to{opacity:1;transform:translateY(-.8px)}}
@media (prefers-reduced-motion:reduce){.chat-n.exalted,.chat-n.exalted::after{animation:none}}
.chat-v{color:#5eead4;font-size:11px;margin-left:2px}
.chat-title{display:inline-block;margin-left:4px;padding:0 6px;border-radius:8px;background:rgba(233,207,147,.12);color:#e9cf93;font-size:10px;font-weight:600;letter-spacing:.02em;vertical-align:1px}
.chat-r{font-size:11px;color:rgba(255,255,255,.4);margin-left:4px}
.chat-play{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:16px;border:1px solid rgba(94,234,212,.35);background:rgba(1,169,130,.14);min-height:32px;font-size:13px!important}
.chat-play i{display:block;width:60px;height:4px;border-radius:2px;background:rgba(255,255,255,.18);overflow:hidden;font-style:normal}
.chat-play i b{display:block;height:100%;width:0;background:#5eead4}
.chat-comp{display:flex;gap:8px;align-items:center;padding:10px 12px;border-top:1px solid rgba(255,255,255,.1)}
.chat-comp input{flex:1;min-width:0;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:22px;padding:11px 16px;color:#fff;font:16px system-ui;outline:none}
.chat-comp input:focus{border-color:#01a982;box-shadow:0 0 0 3px rgba(1,169,130,.2)}
.chat-send,.chat-mic{flex:none;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.06);font-size:18px!important;display:flex;align-items:center;justify-content:center;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
.chat-send{background:linear-gradient(135deg,#01a982,#10b981);border:0}
.chat-mic.rec{background:#ef4444;border-color:#ef4444;animation:chatRec 1s ease-in-out infinite}
@keyframes chatRec{50%{box-shadow:0 0 0 6px rgba(239,68,68,.25)}}
.chat-rec{display:none;align-items:center;gap:10px;padding:8px 14px;font-size:13px;color:#fca5a5}
.chat-rec.on{display:flex}
.chat-rec span{flex:1}
.chat-btn{padding:8px 14px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;min-height:40px;font-size:13px!important}
.chat-btn.go{background:linear-gradient(135deg,#01a982,#10b981);border:0;color:#fff!important;font-weight:600!important;box-shadow:0 4px 12px rgba(1,169,130,.3)}
.chat-btn.alt{border:2px solid #01a982;color:#5eead4!important;font-weight:600!important}
.chat-btn.sm{padding:5px 10px;min-height:32px;font-size:12px!important}
.chat-sec{font:700 11px system-ui;letter-spacing:.08em;color:rgba(255,255,255,.5);text-transform:uppercase;margin-top:8px}
.chat-card{display:flex;flex-direction:column;gap:8px;padding:12px;border-radius:12px;background:#1d1f21;border:1px solid rgba(255,255,255,.1)}
.chat-row{display:flex;align-items:center;gap:8px;min-height:40px}
.chat-row .chat-who{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chat-row .chat-acts{display:flex;gap:6px;flex:none}
.chat-on-dot{width:8px;height:8px;border-radius:50%;flex:none;background:rgba(255,255,255,.25)}
.chat-on-dot.on{background:#10b981;box-shadow:0 0 6px rgba(16,185,129,.6)}
.chat-search{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:10px 12px;color:#fff;font:16px system-ui;outline:none;width:100%;box-sizing:border-box}
.chat-pop{position:absolute;z-index:3;min-width:200px;max-width:calc(100% - 28px);padding:12px;border-radius:12px;background:#24272a;border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 32px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:6px}
.chat-pop .chat-btn{text-align:left}
.chat-feed{position:absolute;left:calc(12px + env(safe-area-inset-left));bottom:calc(16px + env(safe-area-inset-bottom));width:min(360px,calc(100% - 120px));display:flex;flex-direction:column;gap:4px;pointer-events:none;z-index:4}
.chat-feed.touch{bottom:calc(214px + env(safe-area-inset-bottom));width:min(300px,calc(100% - 112px - env(safe-area-inset-left) - env(safe-area-inset-right)))}
.chat-feed>div{align-self:flex-start;max-width:100%;padding:4px 10px;border-radius:10px;background:rgba(10,12,14,.55);color:#fff;font:13px/1.35 system-ui;text-shadow:0 1px 2px rgba(0,0,0,.6);transition:opacity .8s;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
.chat-feed .chat-ch{font-size:10px;font-weight:700;letter-spacing:.06em;margin-right:4px;color:rgba(255,255,255,.5)}
.chat-toast{position:absolute;left:50%;top:calc(76px + env(safe-area-inset-top));transform:translateX(-50%);z-index:21;width:min(360px,calc(100% - 24px));box-sizing:border-box;padding:12px 14px;border-radius:14px;background:rgba(20,22,24,.96);border:1px solid rgba(94,234,212,.4);box-shadow:0 12px 32px rgba(0,0,0,.6);color:#fff;font:14px system-ui;display:flex;flex-direction:column;gap:10px}
.chat-toast .chat-row{min-height:0;justify-content:flex-end}
[data-chat-badge]{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;padding:0 5px;border-radius:9px;background:#ef4444;color:#fff;font:700 11px/18px system-ui;box-sizing:border-box;pointer-events:none;display:none!important}
[data-chat-badge].on{display:block!important}
`;

// multiplayer: net/multiplayer.js (its player id, rooms); cloud: persistence/cloud-save.js;
// region() {id, name}; rank(): honor's rank; canKey(): Enter may open chat now
export function createChat({ url, multiplayer, mount, cloud = null, hint = () => {}, isTouch = false, region = () => null, rank = () => 0, canKey = () => true, openAccount = () => {} }) {
	if (!url || !multiplayer?.available || !multiplayer.me) return { available: false, update() {}, open() {}, close() {}, info: () => ({ available: false }) };
	if (!document.getElementById('chat-css')) { const s = document.createElement('style'); s.id = 'chat-css'; s.textContent = CSS; document.head.appendChild(s); }
	const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
	const btn = (label, cls, fn, title) => { const b = el('button', cls, label); b.type = 'button'; if (title) { b.title = title; b.setAttribute('aria-label', title); } b.onclick = (e) => { e.stopPropagation(); fn(e); }; return b; };
	const guard = (e) => { for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup', 'wheel', 'click', 'contextmenu']) e.addEventListener(ev, (x) => x.stopPropagation()); return e; };

	const id = multiplayer.me();
	const localName = () => (store.get(NAME_KEY) || '').trim() || 'Player ' + id.slice(1, 4).toUpperCase();
	let tab = TABS.some(([k]) => k === store.get(TAB_KEY)) ? store.get(TAB_KEY) : 'world';
	let muted = new Set();
	try { muted = new Set(JSON.parse(store.get(MUTE_KEY) || '[]')); } catch { /* none */ }
	let autoplay = store.get(AUTO_KEY) !== 'off';
	const unread = { world: 0, region: 0, group: 0, people: 0 };
	let who = { q: '', players: [] }, pop = null, toast = null;

	const client = createChatClient({ url, id, name: localName, region, rank, on: (t, v) => heard(t, v) });

	// ---------- the HUD: the button, its badge, the feed ----------
	const open = el('button', '', '💬 Chat');
	open.type = 'button'; open.title = 'Chat (Enter)'; open.setAttribute('aria-label', 'Chat');
	open.dataset.hud = 'left 1';
	open.style.cssText = 'position:absolute;min-width:44px;min-height:44px;padding:8px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.28);background:rgba(8,20,26,.55);color:#eafaf6;font:600 15px system-ui;touch-action:manipulation;cursor:pointer;';
	const badge = el('span'); badge.dataset.chatBadge = '';
	open.append(badge);
	for (const ev of ['pointerdown', 'touchstart']) open.addEventListener(ev, (e) => e.stopPropagation());
	open.addEventListener('click', (e) => { e.stopPropagation(); open.blur(); toggle(); });
	mount.appendChild(open);
	const feed = el('div', 'chat-feed' + (isTouch ? ' touch' : ''));
	feed.setAttribute('aria-live', 'polite');
	mount.appendChild(feed);

	// ---------- the panel ----------
	const root = guard(el('div', 'chat'));
	root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Chat');
	const head = el('div', 'chat-head'), onl = el('span', 'chat-on');
	head.append(el('b', '', 'Chat'), onl, btn('✕', 'chat-x', () => close(), 'Close chat'));
	const tabs = el('div', 'chat-tabs'); tabs.setAttribute('role', 'tablist');
	const body = el('div', 'chat-body');
	const recBar = el('div', 'chat-rec'), recWords = el('span');
	recBar.append(el('b', '', '●'), recWords, btn('Cancel', 'chat-btn sm', () => rec.end(false)));
	const comp = el('form', 'chat-comp');
	const input = el('input');
	input.name = 'chat-message'; input.setAttribute('aria-label', 'Message'); input.maxLength = TEXT_MAX; input.autocomplete = 'off'; input.enterKeyHint = 'send';
	const send = el('button', 'chat-send', '➤'); send.type = 'submit'; send.title = 'Send'; send.setAttribute('aria-label', 'Send');
	const mic = el('button', 'chat-mic', '🎤'); mic.type = 'button'; mic.title = 'Hold to talk, or tap to start and tap again to send'; mic.setAttribute('aria-label', 'Talk');
	comp.append(input, mic, send);
	comp.addEventListener('submit', (e) => { e.preventDefault(); say(); });
	input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { input.blur(); close(); } });
	root.append(head, tabs, body, recBar, comp);
	root.addEventListener('keydown', (e) => { if (e.key === 'Escape' && e.target !== input) close(); });
	mount.appendChild(root);
	const layout = () => { const full = isTouch || innerWidth < 720; root.classList.toggle('full', full); root.classList.toggle('desk', !full); };

	const isOpen = () => root.classList.contains('on');
	function show() {
		layout();
		root.classList.add('on');
		try { document.exitPointerLock?.(); } catch { /* none */ }
		feed.replaceChildren();
		client.start();
		if (tab === 'people') client.who(who.q);
		draw(true);
		if (!isTouch && tab !== 'people') setTimeout(() => input.focus(), 30);
	}
	function close() { root.classList.remove('on'); pop?.remove(); pop = null; input.blur(); rec.end(false); }
	function toggle() { if (isOpen()) close(); else show(); }

	// ---------- names ----------
	const hue = (w) => `hsl(${(w.n * 47) % 360} 70% 74%)`;
	// whose names need their numbers: those in view who share one
	function clashIn(ch) {
		const now = Date.now(), P = [];
		if (ch !== 'people') for (const m of client.log[ch] || []) if (m.from && now - m.at < NOW_MS) P.push(m.from);
		if (ch === 'group' || ch === 'people') P.push(...(client.group?.members || []));
		if (client.me) P.push(client.me);
		return clashes(P);
	}
	function nameEl(w, clash, { tap = true } = {}) {
		const s = nameStyle(w), b = el(tap ? 'button' : 'span', 'chat-n' + (s ? ' ' + s : ''), whoLabel(w, clash));
		if (tap) { b.type = 'button'; b.onclick = (e) => { e.stopPropagation(); card(w, b); }; }
		if (s !== 'exalted') b.style.setProperty('--c', hue(w));
		b.title = `${whoLabel(w, clash)}${w.v ? ' · signed in' : ''}${w.k ? ' · ' + titleOf(w.k) : ''}`;
		const f = document.createDocumentFragment();
		f.append(b);
		if (w.v) { const v = el('span', 'chat-v', '✓'); v.title = 'Signed-in player'; f.append(v); }
		if ((w.k || 0) >= 2) f.append(el('span', 'chat-title', titleOf(w.k)));
		return f;
	}
	const mine = (w) => !!w && (w.id === id || (client.me && personKey(w) === personKey(client.me)));
	const mutedW = (w) => !!w && muted.has(personKey(w));
	const ago = (t) => { const s = (Date.now() - t) / 1000; return s < 60 ? 'now' : s < 3600 ? Math.floor(s / 60) + 'm' : s < 86400 ? Math.floor(s / 3600) + 'h' : new Date(t).toLocaleDateString([], { month: 'short', day: 'numeric' }); };

	// ---------- what is said ----------
	function lineEl(m, clash) {
		if (!m.from) return el('div', 'chat-sys', m.text);
		const row = el('div', 'chat-line'), t = el('div', 'chat-t');
		t.append(nameEl(m.from, clash));
		if (m.ch === 'region' && m.r && m.r !== client.region?.name) t.append(el('span', 'chat-r', m.r));
		t.append(document.createTextNode(' '));
		if (m.voice) t.append(playEl(m)); else t.append(document.createTextNode(m.text));
		const tm = el('time', '', ago(m.at)); tm.dateTime = new Date(m.at).toISOString();
		row.append(t, tm);
		return row;
	}
	function drawTabs() {
		tabs.replaceChildren(...TABS.map(([k, label]) => {
			const words = k === 'region' && client.region?.name ? client.region.name : label;
			const n = unread[k] + (k === 'people' ? client.invites.length + (client.leads() ? client.group?.asks.length || 0 : 0) : 0);
			const b = btn(words, 'chat-tab' + (tab === k ? ' cur' : ''), () => { tab = k; store.set(TAB_KEY, k); pop?.remove(); pop = null; if (k === 'people') client.who(who.q); draw(true); });
			b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(tab === k));
			if (k === 'region') b.title = 'Everyone in ' + (client.region?.name || 'your region');
			if (n && tab !== k) b.append(el('span', 'chat-dot', n > 9 ? '9+' : String(n)));
			return b;
		}));
	}
	function draw(bottom = false) {
		if (!isOpen()) return;
		unread[tab] = 0;
		drawBadge();
		const st = client.status;
		onl.textContent = st === 'on' ? `${client.online} online` : st === 'reconnecting' ? 'Reconnecting…' : st === 'connecting' ? 'Connecting…' : 'Offline';
		drawTabs();
		const near = body.scrollHeight - body.scrollTop - body.clientHeight < 60;
		comp.style.display = tab === 'people' || (tab === 'group' && !client.group) ? 'none' : '';
		input.placeholder = tab === 'world' ? 'Message everyone online' : tab === 'region' ? `Message everyone in ${client.region?.name || 'your region'}` : `Message ${client.group?.name || 'your group'}`;
		if (tab === 'people') { drawPeople(); return; }
		body.replaceChildren();
		if (tab === 'region') body.append(el('div', 'chat-where', client.region ? `Everyone in ${client.region.name}` : 'Your region is found once you are out in the world.'));
		if (tab === 'group' && client.group) body.append(el('div', 'chat-where', `${client.group.name} · ${client.group.members.filter((m) => m.on).length} of ${client.group.members.length} online`));
		const clash = clashIn(tab), L = (client.log[tab] || []).filter((m) => !mutedW(m.from));
		for (const m of L) body.append(lineEl(m, clash));
		if (!L.length) {
			const e = el('div', 'chat-empty');
			if (tab === 'group' && !client.group) {
				e.append(el('div', '', 'You are not in a group yet. Make one and invite people, or ask to join someone else’s from People.'));
				const row = el('div', 'chat-row');
				row.append(btn('Make a group', 'chat-btn go', () => client.makeGroup()), btn('Find people', 'chat-btn alt', () => { tab = 'people'; client.who(''); draw(true); }));
				e.append(row);
			} else e.append(el('div', '', st === 'on' ? (tab === 'world' ? 'Say hello to everyone playing.' : tab === 'region' ? 'No one has said anything here yet.' : 'Say something to your group.') : 'Connecting to chat…'));
			body.append(e);
		}
		if (bottom || near) body.scrollTop = body.scrollHeight;
	}

	// ---------- someone tapped: what you can do with them ----------
	function card(w, at) {
		pop?.remove();
		pop = guard(el('div', 'chat-pop'));
		const t = el('div', '');
		t.append(nameEl(w, null, { tap: false }));
		pop.append(t);
		if (w.k >= 1) pop.append(el('div', 'chat-r', `${titleOf(w.k)} · honor rank ${w.k}`));
		const done = () => { pop?.remove(); pop = null; };
		if (!mine(w)) {
			const g = client.group;
			if (!g?.members.some((m) => m.id === w.id)) pop.append(btn(g ? `Invite to ${g.name}` : 'Invite to a group', 'chat-btn', () => { client.invite(w.id); done(); }));
			if (!g) pop.append(btn('Ask to join their group', 'chat-btn', () => { client.ask(w.id); done(); }));
			const m = mutedW(w);
			pop.append(btn(m ? 'Unmute' : 'Mute', 'chat-btn', () => { const k = personKey(w); if (m) muted.delete(k); else muted.add(k); store.set(MUTE_KEY, JSON.stringify([...muted].slice(-200))); done(); draw(); }));
		} else pop.append(el('div', 'chat-r', 'This is you.'));
		pop.append(btn('Close', 'chat-btn', done));
		root.append(pop);
		const R = root.getBoundingClientRect(), A = at.getBoundingClientRect();
		pop.style.left = Math.max(8, Math.min(A.left - R.left, R.width - pop.offsetWidth - 8)) + 'px';
		pop.style.top = Math.max(8, Math.min(A.bottom - R.top + 6, R.height - pop.offsetHeight - 8)) + 'px';
	}

	// ---------- People: your group, invites, who is online, your name ----------
	const search = el('input', 'chat-search');
	search.name = 'chat-find'; search.type = 'search'; search.placeholder = 'Find someone by name'; search.setAttribute('aria-label', 'Find someone by name'); search.autocomplete = 'off'; search.maxLength = 24;
	let searchT = 0;
	search.addEventListener('input', () => { clearTimeout(searchT); searchT = setTimeout(() => { who.q = search.value.trim(); client.who(who.q); }, 300); });
	function row(dot, whoNode, acts) {
		const r = el('div', 'chat-row');
		if (dot != null) { const d = el('span', 'chat-on-dot' + (dot ? ' on' : '')); d.title = dot ? 'Online' : 'Away'; r.append(d); }
		const w = el('div', 'chat-who'); w.append(whoNode);
		const a = el('div', 'chat-acts'); a.append(...acts);
		r.append(w, a);
		return r;
	}
	function drawPeople() {
		const keep = document.activeElement === search;
		body.replaceChildren();
		const g = client.group, lead = client.leads(), clash = clashIn('people');
		// invites to you
		for (const v of client.invites) {
			const c = el('div', 'chat-card');
			const from = cleanFrom(v.from);
			const t = el('div', '');
			if (from) t.append(nameEl(from, clash), document.createTextNode(` invited you to ${v.name} (${v.n}/${GROUP_MAX})`)); else t.textContent = `An invite to ${v.name}`;
			const r = el('div', 'chat-row');
			r.append(btn('Join', 'chat-btn go', () => client.accept(v.gid)), btn('No thanks', 'chat-btn', () => client.decline(v.gid)));
			c.append(t, r);
			body.append(c);
		}
		// your group
		body.append(el('div', 'chat-sec', 'Your group'));
		if (!g) {
			const c = el('div', 'chat-card');
			c.append(el('div', 'chat-r', 'Make a group and invite people below, or tap someone and ask to join theirs. Up to 8 play together.'));
			c.append(btn('Make a group', 'chat-btn go', () => client.makeGroup()));
			body.append(c);
		} else {
			const c = el('div', 'chat-card');
			const top = el('div', 'chat-row');
			const nm = el('b', 'chat-who', g.name);
			top.append(nm);
			if (lead) top.append(btn('Rename', 'chat-btn sm', () => { const n = prompt('Name your group', g.name); if (n && n.trim()) client.nameGroup(n.trim()); }));
			c.append(top);
			for (const m of g.members) {
				const acts = [];
				if (lead && m.id !== id) acts.push(btn('Lead', 'chat-btn sm', () => client.lead(m.id), `Make ${m.name} the leader`), btn('Remove', 'chat-btn sm', () => { if (confirm(`Remove ${m.name} from the group?`)) client.kick(m.id); }, `Remove ${m.name}`));
				const f = document.createDocumentFragment();
				f.append(nameEl(m, clash));
				if (m.id === g.leader) f.append(el('span', 'chat-title', '★ Leader'));
				if (m.r) f.append(el('span', 'chat-r', m.r));
				c.append(row(m.on, f, acts));
			}
			if (lead) for (const a of g.asks) {
				const f = document.createDocumentFragment();
				f.append(nameEl(a, clash), document.createTextNode(' asks to join'));
				c.append(row(null, f, [btn('Let in', 'chat-btn sm go', () => client.letIn(a.id)), btn('No', 'chat-btn sm', () => client.refuse(a.id))]));
			}
			const r = el('div', 'chat-row');
			r.style.flexWrap = 'wrap';
			const mp = multiplayer.info?.() || {};
			if (g.room && mp.code !== g.room) r.append(btn('Play together', 'chat-btn go', () => { close(); multiplayer.join(g.room); }, 'Join the group’s room'));
			else if (!g.room && lead) r.append(btn('Play together', 'chat-btn go', async () => { if (await multiplayer.invite()) shareRoom(); }, 'Open a room for the group'));
			else if (g.room && mp.code === g.room) r.append(el('span', 'chat-r', 'You are playing together.'));
			else r.append(el('span', 'chat-r', 'When the leader opens a room, Play together shows here.'));
			r.append(btn('Leave group', 'chat-btn', () => { if (confirm(`Leave ${g.name}?`)) client.leaveGroup(); }));
			c.append(r);
			body.append(c);
		}
		// who is online
		body.append(el('div', 'chat-sec', `Online now · ${client.online}`));
		body.append(search);
		const list = who.players.filter((p) => !g?.members.some((m) => m.id === p.id));
		for (const p of list) {
			const acts = [];
			if (!g || g.members.length < GROUP_MAX) acts.push(btn('Invite', 'chat-btn sm', () => client.invite(p.id), `Invite ${p.name} to your group`));
			if (!g && p.g) acts.push(btn('Ask to join', 'chat-btn sm', () => client.ask(p.id), `Ask to join ${p.name}’s group`));
			const f = document.createDocumentFragment();
			f.append(nameEl(p, clash));
			if (p.r) f.append(el('span', 'chat-r', p.near ? `${p.r} · near you` : p.r));
			body.append(row(true, f, acts));
		}
		if (!list.length) body.append(el('div', 'chat-r', who.q ? `No one online called “${who.q}”.` : client.status === 'on' ? 'No one else is online right now.' : 'Connecting to chat…'));
		// your name, and voice
		body.append(el('div', 'chat-sec', 'You'));
		const you = el('div', 'chat-card');
		if (client.me) {
			const t = el('div', ''); t.append(nameEl(client.me, null, { tap: false }));
			you.append(t, el('div', 'chat-r', 'Your account’s name. You can change it once every 30 days.'), btn('Change name', 'chat-btn', () => { close(); openAccount(); }));
		} else {
			const inp = el('input', 'chat-search'); inp.name = 'chat-name'; inp.value = localName(); inp.maxLength = 24; inp.setAttribute('aria-label', 'Your name');
			const r = el('div', 'chat-row'); r.append(inp, btn('Save', 'chat-btn', () => { const n = inp.value.trim(); if (n.length < 2) return; store.set(NAME_KEY, n); client.rename(n); hint('Name saved.', 2000); }));
			you.append(r, el('div', 'chat-r', 'Sign in (☁ Save your progress) to keep your name, get a ✓ beside it, and keep your group on any device.'), btn('Sign in or make an account', 'chat-btn alt', () => { close(); openAccount(); }));
		}
		const ap = btn(`Play group voice by itself: ${autoplay ? 'on' : 'off'}`, 'chat-btn', () => { autoplay = !autoplay; store.set(AUTO_KEY, autoplay ? 'on' : 'off'); draw(); });
		ap.setAttribute('aria-pressed', String(autoplay));
		you.append(ap);
		if (muted.size) you.append(btn(`Unmute everyone (${muted.size})`, 'chat-btn', () => { muted.clear(); store.set(MUTE_KEY, '[]'); draw(); }));
		body.append(you);
		if (keep) search.focus();
	}
	const cleanFrom = (f) => (f && typeof f.id === 'string' && typeof f.name === 'string' ? { id: f.id, name: f.name.slice(0, 24), n: +f.n || 100, ...(f.v ? { v: 1 } : {}), ...(f.k ? { k: f.k | 0 } : {}) } : null);

	// ---------- saying it ----------
	function channel() { return tab === 'people' ? (client.group ? 'group' : 'world') : tab; }
	function say() {
		const text = input.value.trim();
		if (!text) return;
		if (client.status !== 'on') { hint('Chat is not connected yet.', 2500); return; }
		if (client.say(channel(), text)) input.value = '';
	}

	// ---------- voice: hold to talk, or tap to start and tap again ----------
	const rec = (() => {
		let R = null, stream = null, chunks = [], size = 0, t0 = 0, cap = 0, keep = false, tick = 0, ch = 'world';
		const pick = () => ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/aac'].find((t) => globalThis.MediaRecorder?.isTypeSupported?.(t)) || '';
		async function begin() {
			if (R) return;
			if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) { hint('This browser cannot record voice. Typing works.', 3500); return; }
			if (client.status !== 'on') { hint('Chat is not connected yet.', 2500); return; }
			ch = channel();
			try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } }); } catch { hint('Voice needs the microphone. Allow it in the browser to talk.', 4000); return; }
			// (held through the browser's question and let go: nothing was said yet)
			if (!pressT && !tapMode) { for (const t of stream.getTracks()) t.stop(); stream = null; hint('The microphone is ready. Hold the mic to talk.', 3000); return; }
			const mime = pick();
			try { R = new MediaRecorder(stream, { ...(mime ? { mimeType: mime } : {}), audioBitsPerSecond: 24000 }); } catch { R = new MediaRecorder(stream); }
			chunks = []; size = 0; keep = true;
			R.ondataavailable = (e) => { if (e.data?.size) { chunks.push(e.data); size += e.data.size; if (size * 1.37 > VOICE_B64_MAX - 2000) end(true); } };
			R.onstop = finish;
			R.start(500);
			t0 = performance.now();
			cap = setTimeout(() => end(true), VOICE_MS);
			mic.classList.add('rec'); recBar.classList.add('on');
			const label = ch === 'group' ? client.group?.name || 'your group' : ch === 'region' ? client.region?.name || 'your region' : 'everyone';
			const show = () => { recWords.textContent = `Talking to ${label} · ${Math.max(0, Math.ceil((VOICE_MS - (performance.now() - t0)) / 1000))} s left`; };
			show(); tick = setInterval(show, 250);
		}
		function end(send = true) {
			if (!R) return;
			keep = send;
			clearTimeout(cap); clearInterval(tick);
			try { if (R.state !== 'inactive') R.stop(); else finish(); } catch { finish(); }
		}
		async function finish() {
			const r = R, ms = Math.round(performance.now() - t0);
			R = null;
			// (the microphone let go at once: on a phone it otherwise holds the speaker too)
			for (const t of stream?.getTracks() || []) t.stop();
			stream = null;
			mic.classList.remove('rec'); recBar.classList.remove('on');
			if (!keep || !r) return;
			if (ms < 400) { hint('Hold the mic to talk, or tap it once to start and again to send.', 3500); return; }
			const blob = new Blob(chunks, { type: r.mimeType || chunks[0]?.type || 'audio/webm' });
			const data = await new Promise((done) => { const f = new FileReader(); f.onload = () => done(String(f.result).split(',')[1] || ''); f.onerror = () => done(''); f.readAsDataURL(blob); });
			if (!data || data.length > VOICE_B64_MAX) { hint('That was too long to send. Keep it under 15 seconds.', 3500); return; }
			if (!client.voice(ch, { mime: (blob.type || 'audio/webm').toLowerCase().replace(/\s+/g, ''), ms: Math.min(ms, VOICE_MS), data })) hint('Chat is not connected yet.', 2500);
		}
		return { begin, end, on: () => !!R };
	})();
	// (held past this long, letting go sends; a shorter press is a tap: tap again to send)
	let pressT = 0, tapMode = false;
	mic.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); if (rec.on()) { if (tapMode) { tapMode = false; rec.end(true); } return; } pressT = performance.now(); tapMode = false; rec.begin(); try { mic.setPointerCapture(e.pointerId); } catch { /* fine */ } });
	mic.addEventListener('pointerup', (e) => { e.stopPropagation(); if (!pressT) return; const held = performance.now() - pressT; pressT = 0; if (held < 350) tapMode = true; else rec.end(true); });
	mic.addEventListener('pointercancel', () => { if (pressT) { pressT = 0; rec.end(false); } });
	mic.addEventListener('contextmenu', (e) => e.preventDefault());

	// ---------- playing voice ----------
	const playing = { a: null, mid: '', bar: null, url: '' };
	const queue = [];
	function playEl(m) {
		const b = el('button', 'chat-play'), bar = el('b');
		const i = el('i'); i.append(bar);
		const can = canPlay(m.voice.mime);
		b.type = 'button';
		b.append(document.createTextNode(can ? '▶' : '🔇'), i, document.createTextNode(`${Math.max(1, Math.round(m.voice.ms / 1000))} s`));
		b.title = can ? 'Play' : 'This voice clip’s format does not play on this device';
		b.setAttribute('aria-label', can ? `Play voice message, ${Math.round(m.voice.ms / 1000)} seconds` : 'Voice message this device cannot play');
		b.dataset.mid = m.mid;
		b.onclick = (e) => { e.stopPropagation(); if (can) play(m, true); };
		if (playing.mid === m.mid) playing.bar = bar;
		return b;
	}
	function canPlay(mime) { try { return !!document.createElement('audio').canPlayType(mime.split(';')[0]); } catch { return false; } }
	function play(m, now = false) {
		if (!canPlay(m.voice.mime)) return;
		if (!now && playing.a) { if (queue.length < 6) queue.push(m); return; }
		stopPlay();
		const bin = atob(m.voice.data), u8 = new Uint8Array(bin.length);
		for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
		playing.url = URL.createObjectURL(new Blob([u8], { type: m.voice.mime.split(';')[0] }));
		const a = new Audio(playing.url);
		playing.a = a; playing.mid = m.mid;
		playing.bar = root.querySelector(`[data-mid="${m.mid}"] b`);
		a.ontimeupdate = () => { if (playing.bar) playing.bar.style.width = Math.min(100, (a.currentTime / Math.max(0.1, m.voice.ms / 1000)) * 100) + '%'; };
		a.onended = a.onerror = () => { stopPlay(); const next = queue.shift(); if (next) play(next); };
		a.play().catch(() => { stopPlay(); if (!now) hint(`${m.from.name} sent a voice message: open Chat to play it.`, 3000); });
	}
	function stopPlay() { if (playing.a) { playing.a.onended = playing.a.onerror = null; try { playing.a.pause(); } catch { /* gone */ } } if (playing.url) URL.revokeObjectURL(playing.url); if (playing.bar) playing.bar.style.width = '0'; playing.a = null; playing.mid = ''; playing.url = ''; playing.bar = null; }

	// ---------- the feed, the badge, the toasts ----------
	function feedLine(m) {
		if (isOpen() || !m.from || mutedW(m.from) || mine(m.from)) return;
		const d = el('div');
		d.append(el('span', 'chat-ch', m.ch === 'world' ? 'WORLD' : m.ch === 'region' ? 'REGION' : 'GROUP'));
		const n = nameEl(m.from, clashIn(m.ch), { tap: false });
		d.append(n, document.createTextNode(': ' + (m.voice ? '🎤 voice message' : m.text)));
		feed.append(d);
		while (feed.children.length > FEED_LINES) feed.firstChild.remove();
		setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 900); }, FEED_MS);
	}
	function drawBadge() {
		const n = unread.world + unread.region + unread.group + client.invites.length + (client.leads() ? client.group?.asks.length || 0 : 0);
		badge.textContent = n > 9 ? '9+' : String(n);
		badge.classList.toggle('on', n > 0 && !isOpen());
	}
	function toastInvite(v) {
		toast?.remove();
		toast = guard(el('div', 'chat-toast'));
		const from = cleanFrom(v.from), t = el('div', '');
		if (from) t.append(nameEl(from, null, { tap: false }), document.createTextNode(` invited you to ${v.name}.`)); else t.textContent = `You are invited to ${v.name}.`;
		const r = el('div', 'chat-row');
		const gone = () => { toast?.remove(); toast = null; };
		r.append(btn('No thanks', 'chat-btn', () => { client.decline(v.gid); gone(); }), btn('Join', 'chat-btn go', () => { client.accept(v.gid); gone(); }));
		toast.append(t, r);
		mount.appendChild(toast);
		setTimeout(() => { if (toast?.contains(t)) gone(); }, 20000);
	}

	// ---------- what the hub says ----------
	let seenInvites = new Set(), seenAsks = new Set(), signedIn = '';
	function heard(t, v) {
		if (t === 'welcome') {
			// (signed in: known by the account's name, checked by the hub)
			signedIn = '';
			account();
			if (client.leads() && client.group) shareRoom();
		} else if (t === 'said' || t === 'voice') {
			const self = mine(v.from);
			if (!self && !mutedW(v.from) && !(isOpen() && tab === v.ch)) unread[v.ch]++;
			feedLine(v);
			if (t === 'voice' && !self && v.ch === 'group' && autoplay && !mutedW(v.from)) play(v);
		} else if (t === 'who') who = v;
		else if (t === 'note') hint(v, 3500);
		else if (t === 'invites') {
			for (const i of v) if (!seenInvites.has(i.gid)) { seenInvites.add(i.gid); toastInvite(i); }
		} else if (t === 'group') {
			const asks = v && client.leads() ? v.asks : [];
			for (const a of asks) if (!seenAsks.has(a.id)) { seenAsks.add(a.id); hint(`${a.name} asks to join your group: Chat, People.`, 4000); }
			if (!v) unread.group = 0;
		} else if (t === 'acct') {
			if (v.ok && v.me?.name) { store.set(NAME_KEY, v.me.name); }
		} else if (t === 'status' && v.why) hint(v.why, 3500);
		drawBadge();
		if (isOpen()) draw(t === 'welcome');
	}
	function account() {
		const c = cloud?.credentials?.();
		const key = c ? c.u + ':' + (cloud.info().name || '') : '';
		if (key === signedIn || client.status !== 'on') return;
		signedIn = key;
		if (c) client.account(c);
		// (signed out: back as a guest, under this device's name)
		else if (client.me) { client.me = null; client.stop(); client.start(); }
	}
	// the leader's room is the group's
	function shareRoom() {
		const mp = multiplayer.info?.() || {};
		if (!client.leads() || !client.group) return;
		const code = mp.status === 'on' ? mp.code || '' : '';
		if (code !== client.group.room) client.shareRoom(code);
	}

	// ---------- keys ----------
	addEventListener('keydown', (e) => {
		if (e.defaultPrevented || e.repeat || e.key !== 'Enter' || e.altKey || e.ctrlKey || e.metaKey) return;
		const a = document.activeElement;
		if (a && (/INPUT|TEXTAREA|SELECT/.test(a.tagName) || a.isContentEditable)) return;
		if (mount.style.display === 'none' || !canKey()) return;
		e.preventDefault();
		if (!isOpen()) show();
		if (tab === 'people') { tab = client.group ? 'group' : 'world'; draw(true); }
		input.focus();
	});
	addEventListener('resize', () => { if (isOpen()) layout(); });

	// ---------- each frame (cheap: the work is every two seconds) ----------
	let slow = 0, started = false;
	function update(dt) {
		if ((slow -= dt) > 0) return;
		slow = 2;
		// (connected once you are in the world; nothing before)
		if (!started) { started = true; client.start(); }
		client.track();
		account();
		shareRoom();
		if (isOpen()) { const t = body.querySelectorAll('time'); const L = (client.log[tab] || []).filter((m) => !mutedW(m.from)); if (t.length === L.length) t.forEach((x, i) => { x.textContent = ago(L[i].at); }); }
	}

	return {
		available: true, update, open: show, close, toggle, isOpen,
		info: () => ({ available: true, status: client.status, online: client.online, tab, region: client.region, group: client.group, invites: client.invites, me: client.me, unread: { ...unread }, log: Object.fromEntries(Object.entries(client.log).map(([k, L]) => [k, L.map((m) => ({ from: m.from?.name || null, text: m.text || (m.voice ? '[voice]' : ''), at: m.at }))])) }),
		client,
	};
}
