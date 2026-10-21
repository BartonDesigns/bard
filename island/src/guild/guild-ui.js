// The guild panel: full screen on a phone, a tall card on a laptop, in four tabs. Guild
// (found one, its banner and colours, invitations to you), Townsfolk (who walks with you,
// asking someone near you, each member's calling, level, spells and rest), Players (the
// players in it, invitations, ranks) and Alliances (allied guilds, offers made and received).
// Its way in is ⚑ Your guild in the places menu. The workings: guild/index.js.

import { COLOURS, ROLES, NPC_MAX, xpToNext, nextSpell, tagFrom, cleanTag, guildLine, LEVEL_MAX } from './guild-rules.js';
import { SPELL } from '../magic/spells.js';

const CSS = `
.gld{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:21;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:16px;font:14px/1.45 var(--bard-body,system-ui,sans-serif);color:#fff}
.gld.on{display:flex}
.gld-card{width:min(820px,100%);height:min(88vh,900px);background:#1a1a1a;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.8);display:flex;flex-direction:column;overflow:hidden}
.gld-top{display:flex;align-items:center;gap:12px;padding:16px 20px 12px}
.gld-tag{flex:none;min-width:48px;height:48px;padding:0 10px;border-radius:12px;display:flex;align-items:center;justify-content:center;font:700 16px/1 ui-monospace,Menlo,monospace;letter-spacing:.04em;border:2px solid}
.gld-title{flex:1;min-width:0}
.gld-title b{display:block;font-size:20px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-family:var(--bard-display,Georgia,serif)}
.gld-title span{font-size:13px;color:rgba(255,255,255,.7)}
.gld-x{flex:none;width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.7);font-size:16px;cursor:pointer}
.gld-tabs{display:flex;gap:2px;padding:0 12px;border-bottom:1px solid rgba(255,255,255,.1);overflow-x:auto;scrollbar-width:none}
.gld-tab{flex:1;min-width:96px;padding:12px 8px;border:0;border-bottom:3px solid transparent;background:none;color:rgba(255,255,255,.7);font:600 14px var(--bard-display,system-ui,sans-serif);cursor:pointer;min-height:44px;white-space:nowrap}
.gld-tab.cur{color:#fff;border-bottom-color:#01a982}
.gld-tab i{font-style:normal;margin-left:6px;padding:1px 7px;border-radius:10px;background:rgba(1,169,130,.25);color:#5eead4;font-size:12px}
.gld-body{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding:16px 20px 24px;display:flex;flex-direction:column;gap:14px}
.gld h3{margin:6px 0 0;font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.5);font-family:var(--bard-display,Georgia,serif)}
.gld label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,.7)}
.gld input{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:12px 14px;color:#fff;font:16px var(--bard-body,system-ui,sans-serif);outline:none;min-width:0}
.gld input:focus{border-color:#01a982;background:rgba(255,255,255,.08);box-shadow:0 0 0 3px rgba(1,169,130,.2)}
.gld-go{background:linear-gradient(135deg,#01a982 0%,#10b981 100%);color:#fff;border:0;border-radius:8px;padding:12px 20px;font:600 15px var(--bard-display,system-ui,sans-serif);cursor:pointer;box-shadow:0 4px 12px rgba(1,169,130,.3);min-height:44px}
.gld-alt{background:transparent;color:#01a982;border:2px solid #01a982;border-radius:8px;padding:8px 16px;font:600 14px var(--bard-display,system-ui,sans-serif);cursor:pointer;min-height:44px}
.gld-ghost{background:transparent;color:rgba(255,255,255,.75);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:8px 14px;font:13px var(--bard-body,system-ui,sans-serif);cursor:pointer;min-height:40px}
.gld-ghost.warn{color:#fca5a5;border-color:rgba(239,68,68,.45)}
.gld button:disabled{opacity:.5;cursor:default}
.gld button:focus-visible,.gld input:focus-visible{outline:2px solid #01a982;outline-offset:2px}
.gld-note{font-size:13px;color:rgba(255,255,255,.7)}
.gld-err{font-size:13px;color:#ef4444}
.gld-ok{font-size:13px;color:#5eead4}
.gld-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.gld-row>input{flex:1}
.gld-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:12px}
.gld-c{background:#2a2a2a;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:8px;transition:border-color .3s ease}
.gld-c:hover{border-color:rgba(255,255,255,.2)}
.gld-c.out{border-color:rgba(1,169,130,.55)}
.gld-ch{display:flex;align-items:flex-start;gap:10px}
.gld-ch b{flex:1;font-size:15px;line-height:1.3}
.gld-ch small{display:block;font-size:12px;font-weight:400;color:rgba(255,255,255,.6)}
.gld-lv{flex:none;font:700 13px var(--bard-display,system-ui,sans-serif);padding:4px 10px;border-radius:16px;background:rgba(59,130,246,.2);color:#93c5fd}
.gld-bar{height:8px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden}
.gld-bar i{display:block;height:100%;background:linear-gradient(135deg,#01a982 0%,#10b981 100%);transition:width .5s ease}
.gld-pills{display:flex;gap:6px;flex-wrap:wrap}
.gld-pill{padding:3px 10px;border-radius:16px;font-size:12px;font-weight:600;background:rgba(139,92,246,.2);color:#c4b5fd;font-family:var(--bard-display,Georgia,serif)}
.gld-pill.role{background:rgba(16,185,129,.2);color:#6ee7b7}
.gld-pill.rest{background:rgba(245,158,11,.2);color:#fcd34d}
.gld-pill.down{background:rgba(239,68,68,.2);color:#fca5a5}
.gld-sw{display:flex;gap:8px;flex-wrap:wrap}
.gld-sw button{width:36px;height:36px;border-radius:50%;border:2px solid rgba(255,255,255,.15);cursor:pointer;padding:0}
.gld-sw button.cur{border-color:#fff;box-shadow:0 0 0 3px rgba(1,169,130,.5)}
.gld-li{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#2a2a2a;border:1px solid rgba(255,255,255,.08);flex-wrap:wrap}
.gld-li>span{flex:1;min-width:140px}
.gld-li small{color:rgba(255,255,255,.6);font-size:12px;margin-left:6px}
@media (max-width:640px){.gld{padding:0}.gld-card{width:100%;height:100%;border-radius:0;border:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}.gld-top{padding:12px 16px 8px}.gld-body{padding:14px 16px 24px}.gld-grid{grid-template-columns:1fr}.gld-tabs{padding:0 4px;gap:0}.gld-tab{min-width:0;padding:12px 2px;font-size:13px}.gld-tab i{margin-left:4px;padding:1px 5px}}
`;

const TABS = [['guild', 'Guild'], ['folk', 'Townsfolk'], ['players', 'Players'], ['allies', 'Alliances']];
const RANK = { leader: 'Leader', officer: 'Officer', member: 'Member' };

export function createGuildPanel({ mount, menu, hint = () => {} }) {
	if (!document.getElementById('gld-css')) { const s = document.createElement('style'); s.id = 'gld-css'; s.textContent = CSS; document.head.appendChild(s); }
	const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
	const button = (cls, text, fn) => { const b = el('button', cls, text); b.type = 'button'; if (fn) b.onclick = fn; return b; };
	const root = el('div', 'gld');
	root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Your guild');
	for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'touchmove', 'keydown', 'keyup', 'wheel', 'click', 'contextmenu']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') close(); }, { passive: ev !== 'keydown' && ev !== 'click' && ev !== 'contextmenu' });
	root.addEventListener('click', (e) => { if (e.target === root) close(); });
	const card = el('div', 'gld-card'), top = el('div', 'gld-top'), tabs = el('div', 'gld-tabs'), body = el('div', 'gld-body');
	tabs.setAttribute('role', 'tablist');
	card.append(top, tabs, body); root.append(card); mount.appendChild(root);
	let api = null, tab = 'guild', note = null, busy = false, ticker = null, unsub = null, found = { name: '', tag: '', tagSet: false, colours: [COLOURS[0], COLOURS[6]] }, people = null;

	// ---------- its way in ----------
	let btn = null;
	if (menu) {
		btn = el('button');
		btn.type = 'button';
		btn.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px var(--bard-body,system-ui,sans-serif);min-height:36px;cursor:pointer;';
		for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) btn.addEventListener(ev, (x) => x.stopPropagation());
		btn.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = 'none'; open(); });
		// (just under the account's row, the menu's first)
		menu.insertBefore(btn, menu.firstChild?.nextSibling || null);
	}
	function drawBtn() {
		if (!btn || !api) return;
		const g = api.get();
		btn.textContent = g ? `⚑ ${g.name} [${g.tag}]` : '⚑ Your guild';
		btn.title = g ? 'Your guild: its townsfolk, players and alliances' : 'Found a guild, and ask people to join it';
	}

	// ---------- pieces ----------
	function say(kind, text) { note = { kind, text }; draw(); }
	// an action: the buttons held while it runs, its error shown, the panel drawn again
	async function run(fn, done) {
		if (busy) return;
		busy = true; note = null;
		for (const b of body.querySelectorAll('button')) b.disabled = true;
		try { const r = await fn(); if (done) say('ok', typeof done === 'function' ? done(r) : done); } catch (e) { say('err', e.message || 'That did not work. Try again.'); } finally { busy = false; draw(); }
	}
	function tagChip(g, size = 48) {
		const t = el('div', 'gld-tag', g ? g.tag : '⚑');
		const [a, b] = g?.colours || [COLOURS[0], COLOURS[6]];
		t.style.cssText = `background:${a}33;border-color:${a};color:${b};min-width:${size}px;height:${size}px;`;
		return t;
	}
	function swatches(cur, set) {
		const w = el('div', 'gld-sw');
		w.setAttribute('role', 'radiogroup');
		for (const c of COLOURS) {
			const b = button(c === cur ? 'cur' : '', '', () => set(c));
			b.style.background = c; b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', String(c === cur)); b.setAttribute('aria-label', 'Colour ' + c);
			w.append(b);
		}
		return w;
	}
	const head = (t) => el('h3', '', t);
	const needServer = (what) => {
		const S = api.server(), c = el('div', 'gld-c');
		if (!api.signedIn()) c.append(el('b', '', 'Make an account to share your guild'), el('div', 'gld-note', `${what} need an account, so your guild is kept on the server. Open ☁ Save your progress in the map pin menu, then come back here.`));
		else if (!S.deployed) c.append(el('b', '', 'Coming once the server is updated'), el('div', 'gld-note', `${what} arrive as soon as the rooms server is updated. Your guild and its townsfolk work on this device in the meantime.`));
		else if (S.error) c.append(el('b', '', 'Could not reach the server'), el('div', 'gld-note', S.error), button('gld-alt', 'Try again', () => run(() => api.sync())));
		else c.append(el('b', '', 'Share your guild'), el('div', 'gld-note', `${what} need your guild on the server.`), button('gld-go', 'Share my guild with other players', () => run(() => api.share(), 'Your guild is on the server now.')));
		return c;
	}
	const ago = (t) => { const s = Math.max(0, (Date.now() - t) / 1000); return s < 3600 ? `${Math.max(1, Math.round(s / 60))} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(t).toLocaleDateString(); };

	// ---------- the tabs ----------
	function guildTab(g) {
		const S = api.server();
		if (!g) {
			body.append(el('div', 'gld-note', 'A guild is yours to name. Found one, then ask the people you meet to join it: they fight beside you, level up and learn magic as they go. With an account, other players can join it too, and other guilds can ally with yours.'));
			const c = el('div', 'gld-c');
			const [ln, name] = field('Guild name', 'text', { maxLength: 24, placeholder: 'The Bay Bards', value: found.name });
			const [lt, tag] = field('Tag (2 to 4 letters or digits)', 'text', { maxLength: 4, placeholder: 'BB', value: found.tag });
			tag.style.textTransform = 'uppercase';
			name.oninput = () => { found.name = name.value; if (!found.tagSet) { found.tag = name.value.trim().length > 2 ? tagFrom(name.value) : ''; tag.value = found.tag; } };
			tag.oninput = () => { found.tag = cleanTag(tag.value); found.tagSet = !!tag.value; tag.value = found.tag; };
			c.append(ln, lt, el('div', 'gld-note', 'Banner'), swatches(found.colours[0], (x) => { found.colours[0] = x; draw(); }), el('div', 'gld-note', 'Lettering'), swatches(found.colours[1], (x) => { found.colours[1] = x; draw(); }));
			c.append(button('gld-go', 'Found the guild', () => run(async () => { await api.found({ name: found.name, tag: found.tag, colours: found.colours }); tab = 'folk'; }, (r) => `${api.get()?.name} is founded. Ask people near you, or talk to anyone and ask them to join.`)));
			body.append(c);
		} else {
			const c = el('div', 'gld-c');
			c.append(el('div', 'gld-note', g.id ? `Kept on the server. You are its ${RANK[g.rank] || 'member'}.` : 'Kept on this device.'));
			if (['leader', 'officer'].includes(g.rank)) {
				const set = (i) => (x) => run(() => api.colour(i, x));
				c.append(el('div', 'gld-note', 'Banner'), swatches(g.colours[0], set(0)), el('div', 'gld-note', 'Lettering'), swatches(g.colours[1], set(1)));
			}
			body.append(c);
			if (!g.id) body.append(needServer('Players and alliances'));
			const row = el('div', 'gld-row');
			if (g.id) row.append(button('gld-ghost warn', 'Leave the guild', () => { if (confirm(`Leave ${g.name}? Your townsfolk stay with you.`)) run(() => api.act('leave'), 'You left the guild. Your townsfolk are still with you.'); }));
			else row.append(button('gld-ghost warn', 'Disband the guild', () => { if (confirm(`Disband ${g.name}? Its townsfolk go home.`)) run(async () => api.disband(), 'The guild is disbanded.'); }));
			body.append(row);
		}
		if (S.invites?.length) {
			body.append(head('Invitations to you'));
			for (const i of S.invites) {
				const li = el('div', 'gld-li');
				li.append(tagChip(i, 36), el('span', '', `${i.name}`), button('gld-go', 'Join', () => { if (!g?.id || confirm(`Leave ${g.name} and join ${i.name}?`)) run(async () => { if (g?.id) await api.act('leave'); await api.act('join', { id: i.id }); }, `You joined ${i.name}. Your townsfolk come with you.`); }), button('gld-ghost', 'No thanks', () => run(() => api.act('decline', { id: i.id }))));
				body.append(li);
			}
		}
	}
	function folkTab(g) {
		if (!g) { body.append(el('div', 'gld-note', 'Found a guild first (the Guild tab). Then anyone grown up you meet can be asked to join it.')); return; }
		const C = api.companions, out = g.npcs.filter((m) => m.follow && !(m.downUntil > Date.now())).length;
		const top = el('div', 'gld-row');
		top.append(el('span', 'gld-note', C.max ? `${g.npcs.length} of ${NPC_MAX} townsfolk · ${Math.min(out, C.max)} of ${C.max} walk with you at once` : `${g.npcs.length} of ${NPC_MAX} townsfolk · on a phone they wait at home for now, and walk with you when you play on a computer`));
		top.style.justifyContent = 'space-between';
		if (C.max) top.append(button('gld-ghost', C.held() ? 'Call them out again' : 'Send them all home for now', () => { api.hold(!C.held()); draw(); }));
		body.append(top);
		// asking
		body.append(head('Ask someone near you'));
		people ||= api.candidates();
		if (!people.length) body.append(el('div', 'gld-note', 'Nobody grown up is near you. Walk up to people, or talk to anyone and ask them to join from the conversation.'));
		for (const c of people) {
			const li = el('div', 'gld-li');
			li.append(el('span', '', c.name), el('small', '', `${Math.round(c.d)} m${c.job ? ` · ${c.job}` : ''}`));
			li.append(button('gld-alt', 'Ask to join', () => { const r = api.ask(c.p); people = null; say(r.ok ? 'ok' : 'err', r.text); }));
			body.append(li);
		}
		const re = button('gld-ghost', 'Look again', () => { people = null; draw(); });
		body.append(re);
		if (!g.npcs.length) return;
		body.append(head('Your townsfolk'));
		const grid = el('div', 'gld-grid'), now = Date.now();
		for (const m of g.npcs) {
			const R = ROLES[m.role], down = m.downUntil > now, c = el('div', 'gld-c' + (m.follow && !down && !C.held() ? ' out' : ''));
			const h = el('div', 'gld-ch'), name = el('b', '', m.name);
			name.append(el('small', '', m.job || R.line));
			h.append(name, el('span', 'gld-lv', `Lv ${m.level}`));
			const pills = el('div', 'gld-pills');
			pills.append(el('span', 'gld-pill role', `${R.glyph} ${R.name}`), el('span', 'gld-pill', m.strand === 'dark' ? '☾ Dark aether' : '☀ Light aether'));
			if (down) pills.append(el('span', 'gld-pill down', `Resting · ${Math.ceil((m.downUntil - now) / 1000)} s`));
			else if (!m.follow) pills.append(el('span', 'gld-pill rest', 'At home'));
			const need = xpToNext(m.level), bar = el('div', 'gld-bar'), fill = el('i');
			fill.style.width = m.level >= LEVEL_MAX ? '100%' : `${Math.round(100 * (m.xp || 0) / need)}%`;
			bar.append(fill); bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'Experience'); bar.setAttribute('aria-valuenow', String(Math.round(m.xp || 0))); bar.setAttribute('aria-valuemax', String(need));
			const xp = el('div', 'gld-note', m.level >= LEVEL_MAX ? 'At the top of their craft' : `${Math.round(m.xp || 0)} / ${need} to level ${m.level + 1} · ${m.kills || 0} foes felled`);
			const spells = el('div', 'gld-pills');
			for (const id of m.spells) spells.append(el('span', 'gld-pill', `${SPELL[id]?.glyph || '✦'} ${SPELL[id]?.name || id}`));
			const nx = nextSpell(m);
			const learn = el('div', 'gld-note', nx ? `Learns ${SPELL[nx.id]?.name || nx.id} at level ${nx.level}` : m.spells.length ? 'Knows every spell of their path' : '');
			const row = el('div', 'gld-row');
			row.append(button(m.follow ? 'gld-ghost' : 'gld-alt', m.follow ? 'Send home' : 'Walk with me', () => { api.setFollow(m.id, !m.follow); draw(); }));
			row.append(button('gld-ghost warn', 'Let go', () => { if (confirm(`Let ${m.first} go from the guild? They go back to their life.`)) { api.dismiss(m.id); say('ok', `${m.first} has left the guild.`); } }));
			c.append(h, pills, bar, xp, spells);
			if (learn.textContent) c.append(learn);
			c.append(row);
			grid.append(c);
		}
		body.append(grid);
	}
	function playersTab(g) {
		if (!g) { body.append(el('div', 'gld-note', 'Found a guild first (the Guild tab).')); return; }
		if (!g.id) { body.append(needServer('Other players in your guild')); return; }
		const boss = g.rank === 'leader', may = boss || g.rank === 'officer';
		body.append(head(`Players · ${g.players.length}`));
		for (const p of g.players) {
			const li = el('div', 'gld-li');
			li.append(el('span', '', p.me ? `${p.name} (you)` : p.name), el('small', '', `${RANK[p.rank]} · joined ${ago(p.joined)}`));
			const me = !!p.me;
			if (boss && !me && p.rank !== 'leader') {
				li.append(button('gld-ghost', p.rank === 'officer' ? 'Make member' : 'Make officer', () => run(() => api.act('rank', { id: p.id, rank: p.rank === 'officer' ? 'member' : 'officer' }))));
				li.append(button('gld-ghost', 'Hand over', () => { if (confirm(`Make ${p.name} the leader? You become an officer.`)) run(() => api.act('rank', { id: p.id, rank: 'leader' })); }));
			}
			if (may && p.rank !== 'leader' && (boss || p.rank === 'member') && !me) li.append(button('gld-ghost warn', 'Remove', () => { if (confirm(`Remove ${p.name} from the guild?`)) run(() => api.act('kick', { id: p.id })); }));
			body.append(li);
		}
		if (g.others?.length) {
			body.append(head('Everyone\'s townsfolk'));
			body.append(el('div', 'gld-note', g.others.map((m) => `${m.name} (${ROLES[m.role]?.name || m.role}, Lv ${m.level})`).join(' · ')));
		}
		if (!may) return;
		body.append(head('Invite a player'));
		const u = el('input');
		u.type = 'text'; u.maxLength = 20; u.placeholder = 'Their username'; u.autocapitalize = 'none'; u.spellcheck = false; u.setAttribute('aria-label', 'Their username');
		const row = el('div', 'gld-row');
		row.append(u, button('gld-go', 'Invite', () => run(() => api.act('invite', { to: u.value.trim() }), `Invited ${u.value.trim()}. They see it in their guild panel.`)));
		body.append(row);
		for (const i of g.invites || []) {
			const li = el('div', 'gld-li');
			li.append(el('span', '', i.name), el('small', '', `invited ${ago(i.at)}`), button('gld-ghost', 'Withdraw', () => run(() => api.act('uninvite', { id: i.id }))));
			body.append(li);
		}
	}
	let guildList = null;
	function alliesTab(g) {
		if (!g) { body.append(el('div', 'gld-note', 'Found a guild first (the Guild tab).')); return; }
		if (!g.id) { body.append(needServer('Alliances with other guilds')); return; }
		const may = ['leader', 'officer'].includes(g.rank);
		const list = (title, L, buttons) => {
			if (!L?.length) return;
			body.append(head(title));
			for (const o of L) { const li = el('div', 'gld-li'); li.append(tagChip(o, 36), el('span', '', o.name), el('small', '', guildLine({ players: { length: o.members }, npcs: { length: o.npcs } }))); if (may) li.append(...buttons(o)); body.append(li); }
		};
		if (!g.allies?.length && !g.asks?.length && !g.offered?.length) body.append(el('div', 'gld-note', 'Allied guilds stand together. Offer an alliance by a guild\'s tag; it holds once they accept.'));
		list(`Allies · ${g.allies?.length || 0}`, g.allies, (o) => [button('gld-ghost warn', 'End', () => { if (confirm(`End the alliance with ${o.name}?`)) run(() => api.act('unally', { id: o.id })); })]);
		list('Offered to you', g.asks, (o) => [button('gld-go', 'Accept', () => run(() => api.act('ally', { tag: o.tag }), `Allied with ${o.name}.`)), button('gld-ghost', 'Turn down', () => run(() => api.act('unally', { id: o.id })))]);
		list('Your offers, waiting', g.offered, (o) => [button('gld-ghost', 'Withdraw', () => run(() => api.act('unally', { id: o.id })))]);
		if (!may) return;
		body.append(head('Offer an alliance'));
		const t = el('input');
		t.type = 'text'; t.maxLength = 4; t.placeholder = 'Their tag'; t.style.textTransform = 'uppercase'; t.setAttribute('aria-label', 'Their guild\'s tag');
		const row = el('div', 'gld-row');
		row.append(t, button('gld-go', 'Offer', () => run(() => api.act('ally', { tag: t.value }), 'Offered. The alliance holds once they accept.')));
		body.append(row);
		body.append(head('Guilds'));
		if (!guildList) { guildList = []; api.act('list').then((r) => { guildList = r.guilds || []; draw(); }).catch(() => {}); }
		for (const o of guildList.filter((x) => x.id !== g.id && !g.allies?.some((a) => a.id === x.id)).slice(0, 20)) {
			const li = el('div', 'gld-li');
			li.append(tagChip(o, 36), el('span', '', o.name), el('small', '', guildLine({ players: { length: o.members }, npcs: { length: o.npcs } })));
			if (!g.offered?.some((x) => x.id === o.id)) li.append(button('gld-alt', 'Offer alliance', () => run(() => api.act('ally', { tag: o.tag }), `Offered to ${o.name}.`)));
			body.append(li);
		}
	}
	function field(label, type, extra = {}) {
		const l = el('label', '', label), i = el('input');
		i.type = type; Object.assign(i, extra);
		l.append(i);
		return [l, i];
	}

	function draw() {
		if (!api || !root.classList.contains('on')) return;
		const g = api.get(), keep = body.scrollTop, focus = document.activeElement;
		const typing = focus && body.contains(focus) && focus.tagName === 'INPUT';
		// (redrawn under the fingers only when nothing is being typed)
		if (typing && !busy && !note) return;
		top.replaceChildren(tagChip(g), (() => { const t = el('div', 'gld-title'); t.append(el('b', '', g ? g.name : 'Your guild'), el('span', '', g ? guildLine(g) : 'Found a guild, and ask people to join it')); return t; })(), button('gld-x', '✕', close));
		top.lastChild.setAttribute('aria-label', 'Close');
		tabs.replaceChildren();
		for (const [k, label] of TABS) {
			const b = button('gld-tab' + (tab === k ? ' cur' : ''), label, () => { tab = k; note = null; people = null; body.scrollTop = 0; draw(); });
			b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(tab === k));
			const n = k === 'folk' ? g?.npcs.length : k === 'players' ? (g?.id ? g.players.length : 0) : k === 'allies' ? (g?.asks?.length || 0) + (g?.allies?.length || 0) : api.server().invites?.length;
			if (n) b.append(el('i', '', String(n)));
			tabs.append(b);
		}
		body.replaceChildren();
		if (note) body.append(el('div', note.kind === 'err' ? 'gld-err' : 'gld-ok', note.text));
		({ guild: guildTab, folk: folkTab, players: playersTab, allies: alliesTab })[tab](g);
		body.scrollTop = keep;
		drawBtn();
	}
	function open(t) {
		if (t) tab = t;
		note = null; people = null; guildList = null;
		root.classList.add('on');
		api?.sync();
		draw();
		clearInterval(ticker);
		ticker = setInterval(() => { if (!busy) draw(); }, 1000);
	}
	function close() { root.classList.remove('on'); clearInterval(ticker); note = null; }
	return {
		open, close, isOpen: () => root.classList.contains('on'),
		bind(a) { api = a; unsub = api.subscribe(() => { drawBtn(); if (!busy) draw(); }); drawBtn(); },
		dispose() { clearInterval(ticker); unsub?.(); root.remove(); btn?.remove(); },
	};
}
