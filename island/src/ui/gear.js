// Your gear: what you carry (gameplay/arms.js, kept in this browser), each item with its level and
// quality tier, the item in your hand, the shops near you (buy, sell back, upgrade at an
// outfitter), combining two of a kind into a better one, and trading with a friend in your room
// (gameplay/trade.js, in the trade window: ui/trade-window.js). The sheet is reached from the
// rail's 🎒 button, the places menu or I; it scrolls, and its buttons are thumb-sized.
//
// Trades work at any distance between friends in the same room: friends often wander apart,
// and Go to is one tap away. The window says how far they are, or that they are on another world.

import { ARMS_CATALOG, upgradePrice } from '../gameplay/arms.js';
import { TIERS, MAX_LEVEL, UPGRADE_MATERIAL, canCombine, groupInstances, statsOf, xpNeed } from '../gameplay/gear-levels.js';
import { OPEN, accept, cancel, editSide, finished, holdLeft, newTradeId, receive, relayed, startTrade, tick, tradeWhy, worthKeeping } from '../gameplay/trade.js';
import { createHand, weaponOf } from '../crysis/held-items.js';
import { createViewmodel } from '../crysis/viewmodel.js';
import { createStudio } from './gear-studio.js';
import { createTradeWindow } from './trade-window.js';
import { bar, btn, coins, el, hideTip, nameOf, showTip, slot, sound, tierColor, tierName, tipContent, useStyle, xpFrac } from './gear-look.js';

const KEEP_KEY = 'l99-trades';
// how near a shop must be to buy, sell or upgrade there (metres)
export const SHOP_REACH = 60;
const SHEET = 'position:absolute;right:calc(var(--l99-menu-r, 64px) + env(safe-area-inset-right));top:calc(64px + env(safe-area-inset-top));width:min(380px,calc(100vw - var(--l99-menu-r, 64px) - 16px));padding:12px;display:none;flex-direction:column;gap:10px;max-height:calc(100% - 64px - var(--l99-low, 88px) - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;z-index:7;';
const MENU = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;';
const BAG = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8.5a6 6 0 0 1 12 0V20a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 20z"/><path d="M9.5 5.2V4a2.5 2.5 0 0 1 5 0v1.2"/><path d="M9 13h6v4H9z"/></svg>';
const stopAll = (e) => { for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) e.addEventListener(ev, (x) => x.stopPropagation()); return e; };
const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } } };
const metres = (d) => (!Number.isFinite(d) ? '' : d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`);
const fmt = (v, unit) => `${v}${unit === '%' ? '%' : unit ? ' ' + unit : ''}`;
// a side of a trade in words
export function describeSide(side) {
	const parts = groupInstances(side?.items || []).map((g) => `${g.list.length > 1 ? g.list.length + ' × ' : ''}${tierName(g.t)} ${nameOf(g.i)} (level ${g.l})`);
	if (side?.credits) parts.unshift(`${side.credits.toLocaleString()} credits`);
	return parts.length ? parts.join(', ') : 'nothing';
}

export function createGear({ arms, multiplayer, mount, menu, button, hint, world, camera, scene, renderer = null, avatar, self, busy = () => false, isPhone = false }) {
	useStyle();
	const hand = createHand(scene, { lod: 'low' });
	const vm = createViewmodel({ camera, avatar, mount, canvas: renderer?.domElement || null, isPhone });
	// (for checks: hold something without owning it, aim)
	let preview = null;
	const thirdNow = () => !!(self?.state?.third && avatar?.me);
	const studio = createStudio();
	const P = () => world()?.player?.state;
	const where = () => { const p = P()?.pos; return p ? { x: p.x, y: p.y, z: p.z } : null; };
	const near = (sh) => !!sh && (!Number.isFinite(sh.distance) || sh.distance <= SHOP_REACH);
	let thirdAimHeld = false, thirdAimTap = false;
	const canvas = renderer?.domElement;
	const setAim = (on) => { thirdAimTap = !!on; hand.aim(on); vm.aim(on); };
	addEventListener('pointerdown', (e) => { if (e.button === 2 && e.target === canvas && thirdNow() && !busy() && !shown() && !win.shown()) { thirdAimHeld = true; e.preventDefault(); } });
	addEventListener('pointerup', (e) => { if (e.button === 2) thirdAimHeld = false; });
	addEventListener('blur', () => { thirdAimHeld = false; });
	addEventListener('contextmenu', (e) => { if (e.target === canvas && thirdNow() && weaponOf((preview || arms.held())?.i)) e.preventDefault(); });
	const thirdAimBtn = (isPhone || globalThis.matchMedia?.('(pointer: coarse)')?.matches) ? button('Aim', 'Aim held item', 'display:none;', 'thumb mode 20') : null;
	if (thirdAimBtn) { stopAll(thirdAimBtn); thirdAimBtn.onclick = () => setAim(!thirdAimTap); mount.appendChild(thirdAimBtn); }


	// ---------- the sheet ----------
	const sheet = stopAll(el('div', 'g99-frame'));
	sheet.style.cssText = SHEET;
	sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', 'Gear');
	mount.appendChild(sheet);
	const railBtn = button('', 'Gear and trade (I)', 'width:44px;padding:6px 10px;align-items:center;justify-content:center;display:none;', 'rail 55');
	railBtn.innerHTML = BAG;
	stopAll(railBtn);
	railBtn.addEventListener('click', (e) => { e.stopPropagation(); toggle(); });
	mount.appendChild(railBtn);
	const menuBtn = el('button', '', '🎒 Gear and trade');
	menuBtn.type = 'button'; menuBtn.style.cssText = MENU;
	menuBtn.onclick = (e) => { e.stopPropagation(); menu.style.display = 'none'; open('gear'); };
	stopAll(menuBtn);
	menu.insertBefore(menuBtn, menu.firstChild);
	addEventListener('keydown', (e) => {
		if ((e.key === 'i' || e.key === 'I') && !e.metaKey && !e.ctrlKey && !window._KEYS_PLAY_ON && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '') && mount.style.display !== 'none' && P()) { e.preventDefault(); toggle(); }
	});

	let view = 'gear', shopId = null, itemUid = null, sig = '', stopSpin = null;
	function open(v = 'gear', id = null) {
		view = v;
		if (v === 'shop') shopId = id;
		if (v === 'item') itemUid = id;
		sheet.style.display = 'flex'; sig = ''; draw();
	}
	function close() { sheet.style.display = 'none'; stopSpin?.(); stopSpin = null; hideTip(); }
	function toggle() { if (sheet.style.display === 'none') open(view === 'item' && !arms.state().instances?.[itemUid] ? 'gear' : view); else close(); }
	const shown = () => sheet.style.display !== 'none';

	function head(title, back) {
		const h = el('div'); h.style.cssText = 'display:flex;align-items:center;gap:8px;';
		if (back) h.append(btn('←', back, 'quiet', 'Back'));
		const t = el('div', 'g99-title', title); t.style.cssText += 'flex:1;min-width:0;';
		h.append(t, btn('✕', close, 'quiet', 'Close'));
		return h;
	}
	const label = (t) => el('div', 'g99-label', t);
	const note = (t) => { const n = el('div', '', t); n.style.cssText = 'opacity:.72;line-height:1.4;'; return n; };
	const pic = (x) => studio.thumb(x.i, x.l, x.t);
	const hover = (s, inst) => {
		s.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showTip(tipContent(inst), e.clientX, e.clientY); });
		s.addEventListener('pointerleave', hideTip);
		return s;
	};
	const shopsHere = () => arms.shops(where());
	const outfitter = () => shopsHere().find((sh) => sh.sourceId === 'npc-trader' && near(sh)) || null;
	const anyShop = () => shopsHere().find(near) || null;

	function drawGear() {
		const s = arms.state(), held = s.hand ? s.instances[s.hand] : null;
		sheet.append(head('Gear'), el('div', 'g99-rule'), coins(s.credits || 0));
		sheet.append(label('In your hand'));
		const hr = el('div'); hr.style.cssText = 'display:flex;align-items:center;gap:10px;';
		const hs = held ? hover(slot(held, { thumb: pic(held) }), held) : slot(null);
		hs.style.setProperty('--slot', '58px');
		if (held) hs.onclick = (e) => { e.stopPropagation(); hideTip(); open('item', held.u); };
		const hn = el('div', '', held ? `${tierName(held.t)} ${nameOf(held.i)} · level ${held.l}` : 'Hands free. Open an item to hold it.');
		hn.style.cssText = `flex:1;${held ? 'color:' + tierColor(held.t) + ';font-weight:600;' : 'opacity:.7;'}`;
		hr.append(hs, hn);
		if (held) hr.append(btn('Put away', () => { arms.hold(null); draw(); }));
		sheet.append(hr, label('Carrying'));
		const list = Object.values(s.instances || {});
		if (!list.length) sheet.append(note('Nothing yet. Outfitters, ranger camps and supermarkets sell gear.'));
		else {
			const g = el('div', 'g99-grid'); g.style.setProperty('--cols', '5'); g.style.setProperty('--slot', '56px');
			for (const G of groupInstances(list)) {
				const inst = G.list[0], sl = hover(slot(inst, { thumb: pic(inst), count: G.list.length, held: G.list.some((x) => x.u === s.hand) }), inst);
				sl.onclick = (e) => { e.stopPropagation(); hideTip(); open('item', inst.u); };
				g.append(sl);
			}
			sheet.append(g);
		}
		sheet.append(label('Shops nearby'));
		const shops = shopsHere();
		if (!shops.length) sheet.append(note('No shops nearby.'));
		for (const sh of shops.slice(0, 6)) { const b = btn(`🏪 ${sh.name}${Number.isFinite(sh.distance) ? ' · ' + metres(sh.distance) : ''}`, () => open('shop', sh.id), 'quiet'); b.style.textAlign = 'left'; sheet.append(b); }
		if (multiplayer?.available && multiplayer.status?.() === 'on') {
			sheet.append(label('Trade with a friend'));
			const fr = multiplayer.friends();
			if (!fr.length) sheet.append(note('No one else is in your room yet.'));
			for (const f of fr) {
				const row = el('div'); row.style.cssText = 'display:flex;align-items:center;gap:8px;';
				const n = el('span', '', `${f.name}${f.here ? ' · ' + metres(f.d) : ' · another world'}`); n.style.cssText = 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
				row.append(n, btn('Trade', () => ask(f.id)));
				sheet.append(row);
			}
		}
	}

	// one item: turning, its stats, level, value, and what can be done with it
	function drawItem() {
		const s = arms.state(), x = s.instances?.[itemUid];
		if (!x) { view = 'gear'; drawGear(); return; }
		const item = ARMS_CATALOG[x.i], T = TIERS[x.t];
		sheet.append(head(nameOf(x.i), () => open('gear')));
		const sub = el('div', '', `${T.name} · Level ${x.l}${x.l >= MAX_LEVEL ? ' (max)' : ''}`); sub.style.cssText = `color:${T.color};font:600 13px system-ui;text-shadow:0 0 ${4 + T.glow * 10}px ${T.color}55;`;
		sheet.append(sub, el('div', 'g99-rule'));
		const box = el('div'); box.style.cssText = `border-radius:12px;background:radial-gradient(circle at 50% 45%,${T.color}22,rgba(0,0,0,.35) 70%);box-shadow:inset 0 0 30px rgba(0,0,0,.7);min-height:200px;display:flex;align-items:center;justify-content:center;`;
		sheet.append(box);
		stopSpin = studio.turntable(box, x.i, x.l, x.t, 200);
		if (!box.firstChild) { const f = el('div', '', ''); f.append(slot(x)); box.append(f); }
		// the level and experience
		const lv = el('div'); lv.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
		lv.append(el('div', '', x.l >= MAX_LEVEL ? 'Highest level' : `Experience ${x.x} / ${xpNeed(x.l)} to level ${x.l + 1}`), bar(xpFrac(x)));
		sheet.append(lv, label('Stats'));
		const tbl = el('div'); tbl.style.cssText = 'display:grid;grid-template-columns:1fr auto auto;gap:4px 10px;align-items:center;';
		for (const r of statsOf(x)) {
			const nx = el('span', 'g99-up', x.l < MAX_LEVEL && r.next !== r.value ? `→ ${fmt(r.next, r.unit)}` : '');
			nx.style.fontSize = '12px';
			tbl.append(el('span', '', r.label), el('b', '', fmt(r.value, r.unit)), nx);
		}
		sheet.append(tbl);
		if (item?.use) { const u = note(item.use); u.style.fontStyle = 'italic'; sheet.append(u); }
		// what can be done
		const acts = el('div'); acts.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;';
		acts.append(s.hand === x.u ? btn('Put away', () => { arms.hold(null); draw(); }) : btn('Hold', () => { arms.hold(x.u); sound('place'); draw(); }, 'go'));
		sheet.append(label('Improve'), acts);
		const of = outfitter(), cost = upgradePrice(x), mats = Object.values(s.instances).filter((y) => y.i === UPGRADE_MATERIAL && y.u !== x.u).length;
		const upRow = el('div'); upRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
		const up = btn(x.l >= MAX_LEVEL ? 'Max level' : `Upgrade to ${x.l + 1}`, () => { const r = arms.upgrade(x.u, of.id, where()); hint(r.message, 2600); if (r.ok) sound('done'); draw(); }, '');
		up.disabled = x.l >= MAX_LEVEL || !of || (s.credits || 0) < cost || !mats;
		const matName = nameOf(UPGRADE_MATERIAL);
		const why = x.l >= MAX_LEVEL ? '' : !of ? 'at an outfitter, ranger camp or trader' : !mats ? `needs a ${matName}` : (s.credits || 0) < cost ? 'not enough credits' : '';
		const cw = el('span', '', x.l >= MAX_LEVEL ? '' : `${cost} credits + 1 ${matName}${why ? ` (${why})` : ''}`); cw.style.cssText = 'font-size:12px;opacity:.8;flex:1;min-width:140px;';
		upRow.append(up, cw);
		sheet.append(upRow);
		const twin = Object.values(s.instances).filter((y) => canCombine(x, y)).sort((a, b) => a.l - b.l)[0];
		const cbRow = el('div'); cbRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;';
		const cb = btn(x.t >= 4 ? 'Legendary' : `Combine → ${TIERS[x.t + 1].name}`, () => { const r = arms.combine(x.u, twin.u); hint(r.message, 2600); if (r.ok) sound('done'); draw(); });
		cb.disabled = !twin;
		const cbw = el('span', '', x.t >= 4 ? 'The finest there is.' : twin ? `with your other ${T.name} ${nameOf(x.i)} (level ${twin.l}); the better level is kept` : `needs another ${T.name} ${nameOf(x.i)}`); cbw.style.cssText = 'font-size:12px;opacity:.8;flex:1;min-width:140px;';
		cbRow.append(cb, cbw);
		sheet.append(cbRow);
		const sh = anyShop(), sheetShop = sh && arms.shopSheet(sh.id, where()), sale = sheetShop?.sell.find((r) => r.uid === x.u);
		if (sale) sheet.append(btn(`Sell at ${sh.name} for ${sale.price}`, () => { const r = arms.sell(sh.id, x.u, where()); hint(r.message, 2200); sound('remove'); open('gear'); }, 'quiet'));
		// the others of the same kind, to switch between
		const others = Object.values(s.instances).filter((y) => y.i === x.i && y.u !== x.u);
		if (others.length) {
			sheet.append(label(`Your other ${nameOf(x.i)}s`));
			const g = el('div', 'g99-grid'); g.style.setProperty('--cols', '6'); g.style.setProperty('--slot', '48px');
			for (const y of others.sort((a, b) => b.t - a.t || b.l - a.l)) { const sl = hover(slot(y, { thumb: pic(y), held: y.u === s.hand }), y); sl.onclick = (e) => { e.stopPropagation(); hideTip(); open('item', y.u); }; g.append(sl); }
			sheet.append(g);
		}
	}

	function drawShop() {
		const sh = arms.shopSheet(shopId, where());
		if (!sh) { view = 'gear'; drawGear(); return; }
		const here = near(sh);
		sheet.append(head(`🏪 ${sh.name}`, () => open('gear')), el('div', 'g99-rule'), coins(sh.credits));
		if (!here) sheet.append(note(`${metres(sh.distance)} away: walk closer to buy and sell here.`));
		if (sh.upgrades) sheet.append(note('Upgrades are done here: open an item in your gear.'));
		sheet.append(label('For sale (new, Common, level 1)'));
		for (const o of sh.buy) {
			const row = el('div'); row.style.cssText = 'display:flex;align-items:center;gap:10px;';
			const x = { u: 'shop-' + o.itemId, i: o.itemId, l: 1, t: 0, x: 0 };
			const n = el('div', '', `${nameOf(o.itemId)}${o.owned ? ` · you have ${o.owned}` : ''}`); n.style.flex = '1';
			const b = btn(`Buy ${o.price}`, () => { const r = arms.buy(sh.id, o.itemId, where()); hint(r.message, 2200); if (r.ok) sound('place'); draw(); }, '', `Buy for ${o.price} credits`);
			b.disabled = !here || sh.credits < o.price;
			row.append(hover(slot(x, { thumb: pic(x) }), x), n, b);
			sheet.append(row);
		}
		if (sh.sell.length) {
			sheet.append(label('Sell back (half its worth)'));
			for (const o of sh.sell) {
				const x = arms.state().instances[o.uid];
				if (!x) continue;
				const row = el('div'); row.style.cssText = 'display:flex;align-items:center;gap:10px;';
				const n = el('div', '', `${tierName(x.t)} ${nameOf(x.i)} · ${x.l}`); n.style.cssText = `flex:1;color:${tierColor(x.t)};`;
				const b = btn(`Sell ${o.price}`, () => { const r = arms.sell(sh.id, o.uid, where()); hint(r.message, 2200); if (r.ok) sound('remove'); draw(); }, '', `Sell for ${o.price} credits`);
				b.disabled = !here;
				row.append(hover(slot(x, { thumb: pic(x) }), x), n, b);
				sheet.append(row);
			}
		}
	}

	function draw() {
		if (!shown()) return;
		stopSpin?.(); stopSpin = null;
		sheet.replaceChildren();
		if (view === 'shop') drawShop(); else if (view === 'item') drawItem(); else drawGear();
	}

	// ---------- trading ----------
	const trades = new Map();
	let activeId = null, invite = null;
	const active = () => (activeId && trades.get(activeId)) || null;
	try { for (const T of JSON.parse(store.get(KEEP_KEY) || '[]')) if (T?.id && Array.isArray(T.sides?.a?.items)) trades.set(T.id, T); } catch { /* none kept */ }
	let keptSig = null;
	function keep() { const now = Date.now(), kept = [...trades.values()].filter((T) => worthKeeping(T, now)), sig = JSON.stringify(kept); if (sig === keptSig) return; keptSig = sig; store.set(KEEP_KEY, sig); arms.lockTrades?.(kept.map((T) => T.id)); }
	keep();
	const send = (T, list) => { for (const m of list || []) multiplayer.send({ t: 'trade', to: T.peer, ...m }); };
	const ctxFor = (peer) => ({ now: Date.now(), apply: (tx) => arms.apply(tx), applied: (id) => arms.applied(id), peer, peerName: multiplayer.friend(peer)?.name || '' });
	// a step of a trade: kept, its messages sent, and its outcome said
	function step(res, peer) {
		const T = res.T;
		if (T) trades.set(T.id, T);
		if (T) send(T, res.send); else if (peer) for (const m of res.send || []) multiplayer.send({ t: 'trade', to: peer, ...m });
		if (T && res.note) said(T, res.note);
		keep();
		drawTrade(true);
		return T;
	}
	function said(T, n) {
		const who = T.peerName || 'Your friend';
		if (n === 'done') hint(`${T.why === 'late' ? tradeWhy(T) + ' ' : ''}Trade done: you got ${describeSide(T.sides[T.role === 'a' ? 'b' : 'a'])}.`, 4500);
		else if (n === 'failed' || n === 'cancelled' || (n === 'changed' && T.status === 'cancelled') || ['server', 'peer', 'gone'].includes(n)) hint(tradeWhy(T) || 'The trade ended.', 4500);
		else if (n === 'open' && T.role === 'a') hint(`${who} is looking at your trade.`, 2500);
		else if (n === 'invited') showInvite(T);
	}
	const win = createTradeWindow({
		mount, studio,
		onEdit: (side) => { const T = active(); if (T) step(editSide(T, side, Date.now())); },
		onAccept: () => { const T = active(); if (T) step(accept(T, ctxFor(T.peer))); },
		onCancel: () => { const T = active(); if (T) step(cancel(T, 'cancelled', Date.now())); },
		onClose: () => { const T = active(); if (T && OPEN.includes(T.status)) step(cancel(T, 'cancelled', Date.now())); win.close(); },
	});
	let winSig = '';
	function drawTrade(force = false) {
		const T = active();
		if (!T || !win.shown()) return;
		const s = arms.state(), f = multiplayer.friend(T.peer), who = T.peerName || f?.name || 'Your friend';
		const k = JSON.stringify([T.status, T.v, T.ok, T.sides, s.revision, f && Math.round(f.d / 5), !!T.sealAt]);
		if (!force && k === winSig) return;
		winSig = k;
		const mine = T.sides[T.role];
		const short = mine.credits > (s.credits || 0) || mine.items.some((x) => { const y = s.instances?.[x.u]; return !y || y.l !== x.l || y.t !== x.t; });
		win.render({
			T, me: { credits: s.credits || 0, instances: Object.values(s.instances || {}), hand: s.hand }, peerName: who, short,
			where: f ? (f.here ? `${who} is ${metres(f.d)} away.` : `${who} is on another world; the trade still works.`) : `${who} is not in the room.`,
			holdLeft: holdLeft(T, Date.now()), why: tradeWhy(T),
		});
	}
	function openTrade() { close(); win.open(); winSig = ''; drawTrade(true); }
	function ask(peer) {
		const cur = active();
		if (cur && OPEN.includes(cur.status)) { if (cur.peer === peer) { openTrade(); return; } step(cancel(cur, 'cancelled', Date.now())); }
		const f = multiplayer.friend(peer);
		if (!f) return;
		const T = startTrade({ id: newTradeId(), peer, peerName: f.name, now: Date.now() }).T;
		activeId = T.id;
		step({ T, send: [{ op: 'propose', id: T.id }] });
		openTrade();
	}
	function showInvite(T) {
		invite?.remove();
		invite = stopAll(el('div', 'g99-frame'));
		invite.style.cssText = 'position:absolute;left:50%;top:calc(80px + env(safe-area-inset-top));transform:translateX(-50%);width:min(340px,90vw);padding:12px;z-index:15;display:flex;flex-direction:column;gap:8px;';
		const t = el('div', 'g99-title', `${T.peerName || 'A friend'} wants to trade`);
		const row = el('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
		row.append(btn('No thanks', () => { step(cancel(trades.get(T.id), 'cancelled', Date.now())); invite?.remove(); invite = null; }, 'quiet'), btn('Open', () => { activeId = T.id; invite?.remove(); invite = null; openTrade(); }, 'go'));
		invite.append(t, row);
		mount.appendChild(invite);
		sound('accept');
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
			for (const T of trades.values()) if (T.status === 'committing') trades.set(T.id, { ...T, sentAt: 0 });
		} else if (t === 'closed' || (t === 'status' && v.status === 'off')) {
			for (const T of trades.values()) if (OPEN.includes(T.status)) trades.set(T.id, { ...T, status: 'cancelled', why: 'gone', endedAt: now });
			drawTrade(true);
		}
	}

	// ---------- each frame ----------
	let slow = 0, last = null;
	function update(dt) {
		const Ps = P(), on = !!Ps && !busy(), time = performance.now() / 1000;
		const d = Ps ? 'flex' : 'none';
		if (railBtn.style.display !== d) railBtn.style.display = d;
		if (!Ps && shown()) close();
		// the item in hand: on your body in third person, low in the view in first
		const H = preview || arms.held();
		hand.set(H?.i || null, H?.l || 1, H?.t || 0);
		const me = avatar?.me, third = !!(self?.state?.third && me);
		const canAim = third && on && !shown() && !win.shown() && !Ps.swimming && !arms.locked?.() && !!weaponOf(H?.i);
		if (!third || !on) thirdAimHeld = thirdAimTap = false;
		hand.aim(canAim && (thirdAimHeld || thirdAimTap)); hand.aimPitch(Ps?.pitch || 0);
		if (thirdAimBtn) { thirdAimBtn.style.display = canAim ? 'flex' : 'none'; thirdAimBtn.setAttribute('aria-pressed', String(thirdAimHeld || thirdAimTap)); }
		if (third) hand.follow(me.P, Math.atan2(-Math.sin(Ps?.yaw || 0), -Math.cos(Ps?.yaw || 0)), on && !Ps.swimming, me.M, time, dt);
		else hand.hide();
		if (Ps) vm.update(dt, H, Ps, on && !third && !Ps.swimming && !win.shown(), world(), time);
		// carrying it about on foot is experience for it
		if (Ps && H && on && !Ps.flying && !Ps.swimming) {
			const metresWalked = last ? Math.hypot(Ps.pos.x - last.x, Ps.pos.z - last.z) : 0;
			arms.carry(dt, metresWalked < 20 ? metresWalked : 0);
		}
		last = Ps ? { x: Ps.pos.x, z: Ps.pos.z } : null;
		// the trade's hold, counted down
		const T = active();
		if (T && win.shown()) { const left = holdLeft(T, Date.now()); if (left > 0) win.tickHold(left); }
		slow -= dt;
		if (slow > 0) return;
		slow = 0.25;
		const now = Date.now();
		for (const X of [...trades.values()]) {
			if (finished(X, now)) { trades.delete(X.id); if (activeId === X.id) activeId = null; continue; }
			const res = tick(X, now, ctxFor(X.peer));
			if (res.T !== X) step(res);
		}
		keep();
		drawTrade();
		// the sheet, redrawn when what it shows changes (never under a finger in a field)
		if (shown()) {
			const s = arms.state();
			const k = JSON.stringify([view, shopId, itemUid, s.revision, s.credits, multiplayer?.friends?.().map((f) => [f.id, Math.round(f.d / 5)]), view !== 'item' ? arms.shops(where()).map((x) => [x.id, Math.round(x.distance / 5)]) : outfitter()?.id || '']);
			if (k !== sig) { sig = k; draw(); }
		}
	}

	const api = {
		update, open, close, heard, suspend: () => { close(); win.close(); thirdAimHeld = thirdAimTap = false; hand.dispose(); vm.aim(false); if (P()) vm.update(0, null, P(), false, world(), performance.now() / 1000); if (thirdAimBtn) thirdAimBtn.style.display = 'none'; }, busy: () => shown() || win.shown(),
		held: () => arms.held(),
		// beside each friend in the room panel and on their tag
		actions: (r) => [['Trade', () => ask(r.id)]],
		info: () => { const T = active(); return { open: shown(), view, item: itemUid, held: arms.held(), viewmodel: vm.info(), window: win.shown(), trade: T && { id: T.id, role: T.role, status: T.status, why: T.why, sides: T.sides, v: T.v, ok: T.ok, peer: T.peer, hold: holdLeft(T, Date.now()) }, kept: [...trades.values()].map((x) => ({ id: x.id, status: x.status })) }; },
		trade: ask, sheet, window: win.el, studio,
		// the held item in use, for the combat systems (crysis/viewmodel.js documents it)
		weapon: {
			fire: () => (thirdNow() ? hand.fire(3) : vm.fire()),
			reload: (done) => (thirdNow() ? hand.reload(done, 3) : vm.reload(done)),
			bow: (state) => { hand.bow?.(state); vm.bow?.(state); },
			cancel: () => { hand.cancel?.(); vm.cancel?.(); },
			aim: setAim,
			equip: (id) => { preview = null; return arms.hold(id); },
			holster: () => { preview = null; return arms.hold(null); },
			muzzle: () => (thirdNow() ? hand.muzzle() : vm.muzzle()),
			data: (id) => weaponOf(id || (preview || arms.held())?.i),
			state: () => { const H = preview || arms.held(); return { held: H?.i || null, third: thirdNow(), reloading: thirdNow() ? hand.reloading : vm.reloading, aiming: thirdNow() ? hand.aiming : vm.aiming, ready: !!H && (thirdNow() ? !hand.reloading : vm.shown && !vm.reloading) }; },
		},
		// the held item and your hands, drawn over the frame (main.js, after the world)
		post: (renderer) => vm.render(renderer, scene),
		// Crysis.viewmodel({ hold: [id, level, tier], aim: true }): a look without owning it
		viewmodel: (o = {}) => { if (o.hold !== undefined) preview = o.hold ? { i: o.hold[0], l: o.hold[1] || 1, t: o.hold[2] || 0 } : null; if (o.aim !== undefined) setAim(o.aim); const me = avatar?.me, yaw = P()?.yaw || 0; return { ...vm.info(), third: me && self?.state?.third ? hand.info(me.P, Math.atan2(-Math.sin(yaw), -Math.cos(yaw))) : null }; },
	};
	multiplayer?.link?.(api);
	return api;
}
