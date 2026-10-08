// Your gear: what you carry (gameplay/arms.js, kept in this browser), the item in your hand,
// the shops near you, and trading with a friend in your room (gameplay/trade.js). One sheet in
// the HUD's dark glass, reached from the rail's 🎒 button, the places menu or I; it scrolls,
// and its buttons are thumb-sized.
//
// Trades work at any distance between friends in the same room: friends often wander apart,
// and Go to is one tap away. The sheet says how far they are, or that they are on another world.

import { ARMS_CATALOG } from '../gameplay/arms.js';
import { OPEN, accept, cancel, editSide, finished, newTradeId, receive, relayed, startTrade, tick, tradeWhy, worthKeeping } from '../gameplay/trade.js';
import { createHand, iconOf } from '../crysis/held-items.js';

const KEEP_KEY = 'l99-trades';
// how near a shop must be to buy and sell there (metres)
export const SHOP_REACH = 60;
const SHEET = 'position:absolute;right:calc(var(--l99-menu-r, 64px) + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));width:min(360px,calc(100vw - var(--l99-menu-r, 64px) - 16px));box-sizing:border-box;padding:12px;border-radius:14px;background:rgba(8,20,26,.88);border:1px solid rgba(255,255,255,.18);color:#e6f6f2;font:13px system-ui;display:none;flex-direction:column;gap:10px;max-height:calc(100% - 64px - var(--l99-low, 88px) - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:7;';
const BTN = 'min-height:44px;min-width:44px;padding:8px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:rgba(1,169,130,.18);color:#eafaf6;font:600 13px system-ui;cursor:pointer;touch-action:manipulation;';
const QUIET = 'background:transparent;';
const MENU = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;';
const BAG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8.5a6 6 0 0 1 12 0V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20z"/><path d="M9.5 5.2V4a2.5 2.5 0 0 1 5 0v1.2"/><path d="M9 13h6v4H9z"/></svg>';
const stop = (el) => { for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation()); return el; };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const nameOf = (id) => ARMS_CATALOG[id]?.name || id;
const metres = (d) => (!Number.isFinite(d) ? '' : d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);
// a side of a trade in words
export function describeSide(side) {
	const parts = Object.entries(side?.items || {}).map(([id, n]) => `${n} × ${nameOf(id)}`);
	if (side?.credits) parts.unshift(`${side.credits.toLocaleString()} credits`);
	return parts.length ? parts.join(', ') : 'nothing';
}

export function createGear({ arms, multiplayer, mount, menu, button, hint, world, camera, scene, avatar, self, busy = () => false }) {
	const hand = createHand(scene);
	const el = (tag, style = '', text = '') => { const e = document.createElement(tag); if (style) e.style.cssText = style; if (text) e.textContent = text; return e; };
	const btn = (label, fn, style = '', title = '') => { const b = el('button', BTN + style, label); b.type = 'button'; if (title) b.title = title; b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); }; return b; };
	const P = () => world()?.player?.state;
	const where = () => { const p = P()?.pos; return p ? { x: p.x, y: p.y, z: p.z } : null; };

	// ---------- the screen ----------
	const sheet = stop(el('div', SHEET));
	sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Gear');
	mount.appendChild(sheet);
	const railBtn = button('', 'Gear and trade (I)', 'width:44px;padding:6px 10px;align-items:center;justify-content:center;display:none;', 'rail 55');
	railBtn.innerHTML = BAG;
	stop(railBtn);
	railBtn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
	mount.appendChild(railBtn);
	const menuBtn = el('button', MENU, '🎒 Gear and trade');
	menuBtn.type = 'button';
	menuBtn.onclick = (e) => { e.stopPropagation(); menu.style.display = 'none'; open('gear'); };
	stop(menuBtn);
	menu.insertBefore(menuBtn, menu.firstChild);
	addEventListener('keydown', (e) => {
		if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey && !window._KEYS_PLAY_ON && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') && mount.style.display !== 'none' && P()) { e.preventDefault(); toggle(); }
	});

	let view = 'gear', shopId = null, sig = '';
	function open(v = 'gear', id = null) { view = v; if (v === 'shop') shopId = id; sheet.style.display = 'flex'; sig = ''; draw(); }
	function close() { sheet.style.display = 'none'; }
	function toggle() { if (sheet.style.display === 'none') open(view === 'trade' && !active() ? 'gear' : view); else close(); }
	const shown = () => sheet.style.display !== 'none';

	function head(title, back) {
		const h = el('div', 'display:flex;align-items:center;gap:8px;');
		if (back) h.append(btn('←', back, QUIET, 'Back'));
		const t = el('b', 'flex:1;font-size:15px;min-width:0;', title);
		h.append(t, btn('✕', close, QUIET, 'Close'));
		return h;
	}
	const label = (t) => el('div', 'font:700 11px system-ui;letter-spacing:.08em;opacity:.6;margin-top:2px;', t);
	const credits = (n) => el('div', 'font:600 15px system-ui;color:#9ff0d8;', `◎ ${n.toLocaleString()} credits`);
	function card(id, line, buttons = [], desc = true) {
		const row = el('div', 'display:flex;gap:10px;align-items:flex-start;padding:8px;border-radius:10px;background:rgba(255,255,255,.05);');
		const ic = el('div', 'font-size:26px;line-height:32px;width:34px;text-align:center;flex:none;', iconOf(id));
		const mid = el('div', 'flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;');
		mid.append(el('div', 'font-weight:600;', line));
		if (desc && ARMS_CATALOG[id]?.use) mid.append(el('div', 'opacity:.72;font-size:12px;line-height:1.35;', ARMS_CATALOG[id].use));
		const side = el('div', 'display:flex;flex-direction:column;gap:6px;flex:none;');
		side.append(...buttons);
		row.append(ic, mid, side);
		return row;
	}
	const note = (t) => el('div', 'opacity:.72;line-height:1.4;', t);

	function drawGear() {
		const s = arms.state(), held = s.equipped?.hand || null;
		sheet.append(head('🎒 Gear'), credits(s.credits || 0));
		sheet.append(label('IN YOUR HAND'));
		if (held) sheet.append(card(held, nameOf(held), [btn('Put away', () => { arms.hold(null); draw(); })], false));
		else sheet.append(note('Hands free. Tap Hold on an item to carry it.'));
		sheet.append(label('CARRYING'));
		const items = Object.entries(s.items || {});
		if (!items.length) sheet.append(note('Nothing yet. Outfitters, ranger camps and supermarkets sell gear.'));
		for (const [id, n] of items) sheet.append(card(id, `${nameOf(id)}${n > 1 ? ` × ${n}` : ''}`, [held === id ? btn('Put away', () => { arms.hold(null); draw(); }) : btn('Hold', () => { arms.hold(id); draw(); })]));
		sheet.append(label('SHOPS NEARBY'));
		const shops = arms.shops(where());
		if (!shops.length) sheet.append(note('No shops nearby.'));
		for (const sh of shops.slice(0, 6)) sheet.append(btn(`🏪 ${sh.name}${Number.isFinite(sh.distance) ? ' · ' + metres(sh.distance) : ''}`, () => open('shop', sh.id), 'text-align:left;' + QUIET));
		if (multiplayer?.available && multiplayer.status?.() === 'on') {
			sheet.append(label('TRADE WITH A FRIEND'));
			const fr = multiplayer.friends();
			if (!fr.length) sheet.append(note('No one else is in your room yet.'));
			for (const f of fr) {
				const row = el('div', 'display:flex;align-items:center;gap:8px;');
				row.append(el('span', 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;', `${f.name}${f.here ? ' · ' + metres(f.d) : ' · another world'}`), btn('Trade', () => ask(f.id)));
				sheet.append(row);
			}
		}
	}

	function drawShop() {
		const sh = arms.shopSheet(shopId, where());
		if (!sh) { view = 'gear'; drawGear(); return; }
		const near = !Number.isFinite(sh.distance) || sh.distance <= SHOP_REACH;
		sheet.append(head(`🏪 ${sh.name}`, () => open('gear')), credits(sh.credits));
		if (!near) sheet.append(note(`${metres(sh.distance)} away: walk closer to buy and sell here.`));
		sheet.append(label('FOR SALE'));
		for (const o of sh.buy) {
			const b = btn(`Buy ${o.price}`, () => { const r = arms.buy(sh.id, o.itemId, where()); hint(r.message, 2200); draw(); }, '', `Buy for ${o.price} credits`);
			b.disabled = !near || sh.credits < o.price;
			if (b.disabled) b.style.opacity = '.45';
			sheet.append(card(o.itemId, `${nameOf(o.itemId)}${o.owned ? ` · you have ${o.owned}` : ''}`, [b]));
		}
		if (sh.sell.length) {
			sheet.append(label('SELL BACK (HALF PRICE)'));
			for (const o of sh.sell) {
				const b = btn(`Sell ${o.price}`, () => { const r = arms.sell(sh.id, o.itemId, where()); hint(r.message, 2200); draw(); }, '', `Sell one for ${o.price} credits`);
				b.disabled = !near;
				if (b.disabled) b.style.opacity = '.45';
				sheet.append(card(o.itemId, `${nameOf(o.itemId)} × ${o.quantity}`, [b], false));
			}
		}
	}

	// ---------- trading ----------
	const trades = new Map();
	let activeId = null, invite = null;
	const active = () => (activeId && trades.get(activeId)) || null;
	try { for (const T of JSON.parse(store.get(KEEP_KEY) || '[]')) if (T?.id) trades.set(T.id, T); } catch { /* none kept */ }
	function keep() { const now = Date.now(); store.set(KEEP_KEY, JSON.stringify([...trades.values()].filter((T) => worthKeeping(T, now)))); }
	const send = (T, list) => { for (const m of list || []) multiplayer.send({ t: 'trade', to: T.peer, ...m }); };
	const ctxFor = (peer) => ({ now: Date.now(), apply: (tx) => arms.apply(tx), applied: (id) => arms.applied(id), peer, peerName: multiplayer.friend(peer)?.name || '' });
	// a step of a trade: kept, its messages sent, and its outcome said
	function step(res, peer) {
		const T = res.T;
		if (T) trades.set(T.id, T);
		if (T) send(T, res.send); else if (peer) for (const m of res.send || []) multiplayer.send({ t: 'trade', to: peer, ...m });
		if (T && res.note) said(T, res.note);
		keep();
		if (shown() && view === 'trade') draw();
		return T;
	}
	function said(T, n) {
		const who = T.peerName || 'Your friend';
		if (n === 'done') hint(`${T.why === 'late' ? tradeWhy(T) + ' ' : ''}Trade done: you got ${describeSide(T.sides[T.role === 'a' ? 'b' : 'a'])}.`, 4500);
		else if (n === 'failed' || n === 'cancelled' || n === 'changed' && T.status === 'cancelled' || ['server', 'peer', 'gone'].includes(n)) hint(tradeWhy(T) || 'The trade ended.', 4500);
		else if (n === 'open' && T.role === 'a') hint(`${who} is looking at your trade.`, 2500);
		else if (n === 'invited') showInvite(T);
	}
	function ask(peer) {
		const cur = active();
		if (cur && OPEN.includes(cur.status)) { if (cur.peer === peer) { open('trade'); return; } step(cancel(cur, 'cancelled', Date.now())); }
		const f = multiplayer.friend(peer);
		if (!f) return;
		const T = step(startTrade({ id: newTradeId(), peer, peerName: f.name, now: Date.now() }));
		activeId = T.id;
		open('trade');
	}
	function showInvite(T) {
		invite?.remove();
		invite = stop(el('div', 'position:absolute;left:50%;top:calc(80px + env(safe-area-inset-top));transform:translateX(-50%);width:min(340px,90vw);box-sizing:border-box;padding:12px;border-radius:14px;background:rgba(8,20,26,.94);border:1px solid rgba(95,240,198,.4);color:#eafaf6;font:13px system-ui;z-index:12;display:flex;flex-direction:column;gap:8px;'));
		invite.append(el('div', 'font-weight:600;', `🤝 ${T.peerName || 'A friend'} wants to trade.`));
		const row = el('div', 'display:flex;gap:8px;justify-content:flex-end;');
		row.append(btn('No thanks', () => { step(cancel(trades.get(T.id), 'cancelled', Date.now())); invite?.remove(); invite = null; }, QUIET), btn('Open', () => { activeId = T.id; invite?.remove(); invite = null; open('trade'); }));
		invite.append(row);
		mount.appendChild(invite);
		setTimeout(() => { if (invite && trades.get(T.id)?.status !== 'invited') { invite.remove(); invite = null; } }, 30000);
	}
	// what the room says (net/multiplayer.js passes everything here)
	function heard(t, v) {
		const now = Date.now();
		if (t === 'trade') {
			const T = trades.get(v.id);
			if (T && T.peer !== v.from) return;
			const cur = active();
			if (v.op === 'propose' && !T && cur && OPEN.includes(cur.status)) { multiplayer.send({ t: 'trade', to: v.from, op: 'cancel', id: v.id, why: 'busy' }); return; }
			const N = step(receive(T, v, ctxFor(v.from)), v.from);
			if (v.op === 'propose' && N) activeId = N.id;
		} else if (t === 'trade-ack') {
			const T = trades.get(v.id);
			if (T && v.op === 'propose') step(relayed(T, v.there, now));
		} else if (t === 'leave') {
			for (const T of trades.values()) if (T.peer === v.id && OPEN.includes(T.status)) step({ T: { ...T, status: 'cancelled', why: 'gone', endedAt: now }, note: 'gone' });
		} else if (t === 'join' || t === 'welcome') {
			// a friend back (or us): say again any commit they have not answered
			for (const T of trades.values()) if (T.status === 'committing') trades.set(T.id, { ...T, sentAt: 0 });
		} else if (t === 'closed' || (t === 'status' && v.status === 'off')) {
			for (const T of trades.values()) if (OPEN.includes(T.status)) trades.set(T.id, { ...T, status: 'cancelled', why: 'gone', endedAt: now });
			if (shown() && view === 'trade') draw();
		}
	}
	// your own side, changed
	function edit(fn) {
		const T = active();
		if (!T) return;
		const mine = T.sides[T.role], side = { credits: mine.credits, items: { ...mine.items } };
		fn(side);
		step(editSide(T, side, Date.now()));
	}

	function drawTrade() {
		const T = active();
		if (!T) { view = 'gear'; drawGear(); return; }
		const f = multiplayer.friend(T.peer), who = T.peerName || f?.name || 'Your friend';
		const mineK = T.role, theirsK = T.role === 'a' ? 'b' : 'a', mine = T.sides[mineK], theirs = T.sides[theirsK];
		const s = arms.state(), key = `${T.v.a}.${T.v.b}`;
		sheet.append(head(`🤝 Trade with ${who}`, () => open('gear')));
		sheet.append(note(f ? (f.here ? `${who} is ${metres(f.d)} away.` : `${who} is on another world; the trade still works.`) : `${who} is not in the room.`));
		const live = OPEN.includes(T.status);
		const status = {
			asking: `Asking ${who}…`, invited: `${who} asked to trade. Add what you give, then confirm.`, open: 'Build the offer, then both confirm.',
			committing: 'Done on your side; waiting for their game to confirm…', done: 'Trade done.', cancelled: tradeWhy(T) || 'Cancelled.', failed: tradeWhy(T) || 'The trade did not go through.',
		}[T.status];
		sheet.append(el('div', 'padding:8px 10px;border-radius:10px;background:rgba(95,240,198,.1);', status));
		// your side
		sheet.append(label('YOU GIVE'));
		const cr = el('div', 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;');
		cr.append(el('span', 'flex:1;min-width:90px;', `◎ ${mine.credits.toLocaleString()} credits`));
		for (const d of [-100, -10, 10, 100]) {
			const b = btn(d > 0 ? `+${d}` : String(d), () => edit((x) => { x.credits = Math.max(0, Math.min(s.credits || 0, x.credits + d)); }), 'padding:8px 6px;' + QUIET);
			b.disabled = !live || (d > 0 ? mine.credits >= (s.credits || 0) : mine.credits <= 0);
			if (b.disabled) b.style.opacity = '.4';
			cr.append(b);
		}
		sheet.append(cr);
		const owned = Object.entries(s.items || {});
		if (!owned.length && live) sheet.append(note('You carry no items to offer.'));
		for (const [id, have] of owned) {
			const n = mine.items[id] || 0;
			const minus = btn('−', () => edit((x) => { if (x.items[id] > 1) x.items[id]--; else delete x.items[id]; }), QUIET, 'Offer one fewer');
			const plus = btn('+', () => edit((x) => { x.items[id] = Math.min(have, (x.items[id] || 0) + 1); }), '', 'Offer one more');
			minus.disabled = !live || !n; plus.disabled = !live || n >= have;
			for (const b of [minus, plus]) if (b.disabled) b.style.opacity = '.4';
			const row = card(id, `${nameOf(id)} · ${n} of ${have}`, [], false);
			const pm = el('div', 'display:flex;gap:6px;'); pm.append(minus, plus);
			row.lastChild.append(pm);
			sheet.append(row);
		}
		// theirs
		sheet.append(label(`${who.toUpperCase()} GIVES`));
		sheet.append(note(describeSide(theirs)));
		// the summary, and who has confirmed this version
		const sum = el('div', 'padding:10px;border-radius:10px;border:1px solid rgba(95,240,198,.35);display:flex;flex-direction:column;gap:4px;line-height:1.4;');
		sum.append(el('b', '', 'Summary'), el('div', '', `You give: ${describeSide(mine)}`), el('div', '', `You get: ${describeSide(theirs)}`));
		const meOk = T.ok[mineK] === key, themOk = T.ok[theirsK] === key;
		sum.append(el('div', 'opacity:.85;', `${meOk ? '✓ You confirmed' : '○ You have not confirmed'} · ${themOk ? `✓ ${who} confirmed` : `○ ${who} has not confirmed`}`));
		sheet.append(sum);
		const short = mine.credits > (s.credits || 0) || Object.entries(mine.items).some(([id, n]) => (s.items?.[id] || 0) < n);
		if (short && live) sheet.append(note('You no longer have everything you offered: change your side.'));
		const row = el('div', 'display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;');
		if (live) {
			const empty = !mine.credits && !Object.keys(mine.items).length && !theirs.credits && !Object.keys(theirs.items).length;
			const ok = btn(meOk ? 'Confirmed' : 'Confirm trade', () => step(accept(active(), ctxFor(T.peer))), 'border-color:rgba(95,240,198,.6);');
			ok.disabled = meOk || empty || short || T.status === 'asking';
			if (ok.disabled) ok.style.opacity = '.45';
			row.append(btn('Cancel', () => step(cancel(active(), 'cancelled', Date.now())), QUIET), ok);
		} else row.append(btn('Back to gear', () => { activeId = null; open('gear'); }));
		sheet.append(row);
	}

	function draw() {
		if (!shown()) return;
		sheet.replaceChildren();
		if (view === 'shop') drawShop(); else if (view === 'trade') drawTrade(); else drawGear();
	}

	// ---------- each frame ----------
	let slow = 0;
	function update(dt) {
		const Ps = P(), on = !!Ps && !busy();
		const d = Ps ? 'flex' : 'none';
		if (railBtn.style.display !== d) railBtn.style.display = d;
		if (!Ps && shown()) close();
		// the item in hand: on your body in third person, low in the view in first
		hand.set(arms.held());
		const me = avatar?.me;
		if (self?.state?.third && me) hand.follow(me.P, Math.atan2(-Math.sin(Ps?.yaw || 0), -Math.cos(Ps?.yaw || 0)), on && !Ps.swimming);
		else hand.view(camera, on && !Ps.swimming);
		slow -= dt;
		if (slow > 0) return;
		slow = 0.5;
		const now = Date.now();
		for (const T of [...trades.values()]) {
			if (finished(T, now)) { trades.delete(T.id); if (activeId === T.id) activeId = null; continue; }
			const res = tick(T, now);
			if (res.T !== T) step(res);
		}
		// the sheet, redrawn when what it shows changes (never under a finger in a field)
		if (shown()) {
			const s = arms.state(), T = active();
			const k = JSON.stringify([view, shopId, s.revision, s.credits, T && [T.status, T.v, T.ok], multiplayer?.friends?.().map((f) => [f.id, Math.round(f.d / 5)]), view === 'gear' || view === 'shop' ? arms.shops(where()).map((x) => [x.id, Math.round(x.distance / 5)]) : 0]);
			if (k !== sig) { sig = k; draw(); }
		}
	}

	const api = {
		update, open, close, heard, held: () => arms.held(),
		// beside each friend in the room panel and on their tag
		actions: (r) => [['Trade', () => ask(r.id)]],
		info: () => { const T = active(); return { open: shown(), view, held: arms.held(), trade: T && { id: T.id, role: T.role, status: T.status, why: T.why, sides: T.sides, v: T.v, ok: T.ok, peer: T.peer }, kept: [...trades.values()].map((x) => ({ id: x.id, status: x.status })) }; },
		trade: ask, sheet,
	};
	multiplayer?.link?.(api);
	return api;
}
