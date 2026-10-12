// The trade window: your offer and your friend's side by side (stacked on a phone), each a grid
// of item slots with its coins beneath, your bag below to drag or tap items from, a tooltip with
// each item's stats against what you hold or would give up, and a big Accept for each side. An
// accepted side glows; any change clears both, with a flash; once both accept there is a short
// hold, still cancellable, before the trade goes through. Only the screen: gameplay/trade.js
// keeps the state and ui/gear.js carries the messages.

import { groupInstances, statsOf } from '../gameplay/gear-levels.js';
import { HOLD_MS, OPEN, keyOf } from '../gameplay/trade.js';
import { btn, coins, el, hideTip, nameOf, showTip, slot, sound, tierName, tipContent, useStyle } from './gear-look.js';

const SLOTS = 12;
const stop = (e) => e.stopPropagation();

export function createTradeWindow({ mount, studio, onEdit, onAccept, onCancel, onClose }) {
	useStyle();
	const win = el('div', 'g99-frame');
	win.setAttribute('role', 'dialog'); win.setAttribute('aria-label', 'Trade');
	const BASE = 'position:absolute;z-index:14;flex-direction:column;gap:8px;padding:12px;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;';
	win.style.cssText = BASE + 'display:none;';
	for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) win.addEventListener(ev, stop);
	mount.appendChild(win);
	const phone = () => (mount.clientWidth || innerWidth) < 700;
	function place() {
		win.style.cssText = BASE + 'display:flex;' + (phone()
			? 'left:calc(6px + env(safe-area-inset-left));right:calc(6px + env(safe-area-inset-right));top:calc(6px + env(safe-area-inset-top));bottom:calc(6px + env(safe-area-inset-bottom));'
			: 'left:50%;top:50%;transform:translate(-50%,-50%);width:min(780px,96vw);max-height:92%;');
	}
	let view = null, prevKey = '', prevOk = { a: '', b: '', status: '' }, bagOpen = true, countdown = null, holdBar = null, flashing = 0;

	const pic = (x) => studio?.thumb(x.i, x.l, x.t) || '';
	// slots for a list of instances, stacked by item, level and tier; fn(inst) on a tap
	function grid(list, { cols, size, empty = 0, zone, onTap, compare }) {
		const g = el('div', 'g99-grid');
		g.style.setProperty('--cols', cols); g.style.setProperty('--slot', size + 'px');
		g.dataset.zone = zone;
		const groups = groupInstances(list);
		for (const G of groups) {
			const inst = G.list[0], s = slot(inst, { thumb: pic(inst), count: G.list.length, held: G.list.some((x) => x.u === view.me.hand), fresh: !seen.has(zone + inst.u) });
			seen.add(zone + inst.u);
			wire(s, inst, zone, onTap, compare);
			g.append(s);
		}
		for (let k = groups.length; k < empty; k++) g.append(slot(null));
		return g;
	}
	const seen = new Set();
	// a slot's touch and mouse: tap moves it, a drag carries it, a long press or hover explains it
	function wire(s, inst, zone, onTap, compare) {
		let down = null, timer = 0, ghost = null, pressed = false;
		const tip = (x, y) => { const [vs, label] = compare(inst); showTip(tipContent(inst, vs, label), x, y); };
		s.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !down) tip(e.clientX, e.clientY); });
		s.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !ghost) hideTip(); });
		s.addEventListener('pointerdown', (e) => {
			e.stopPropagation();
			down = { x: e.clientX, y: e.clientY }; pressed = false;
			try { s.setPointerCapture(e.pointerId); } catch { /* fine */ }
			clearTimeout(timer);
			timer = setTimeout(() => { if (down && !ghost) { pressed = true; tip(down.x, down.y); } }, 450);
		});
		s.addEventListener('pointermove', (e) => {
			if (!down || !onTap) return;
			if (!ghost && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 8) {
				clearTimeout(timer); hideTip();
				ghost = s.cloneNode(true); ghost.classList.add('g99-ghost'); document.body.appendChild(ghost);
			}
			if (ghost) { ghost.style.left = e.clientX + 'px'; ghost.style.top = e.clientY + 'px'; highlight(e.clientX, e.clientY, zone); }
		});
		const end = (e) => {
			clearTimeout(timer);
			if (!down) return;
			const was = down; down = null;
			if (ghost) {
				ghost.remove(); ghost = null; highlight(-1, -1, zone);
				const to = zoneAt(e.clientX, e.clientY);
				// dropped on the other side: moved; anywhere else from the offer: taken back
				if (onTap && ((zone === 'bag' && to === 'offer') || (zone === 'offer' && to !== 'offer'))) onTap(inst);
				return;
			}
			if (pressed) { setTimeout(hideTip, 1600); return; }
			if (e.type === 'pointerup' && Math.hypot(e.clientX - was.x, e.clientY - was.y) < 10) { if (onTap) { hideTip(); onTap(inst); } else tip(e.clientX, e.clientY); }
		};
		s.addEventListener('pointerup', end);
		s.addEventListener('pointercancel', end);
		s.addEventListener('contextmenu', (e) => e.preventDefault());
	}
	function zoneAt(x, y) { const t = document.elementFromPoint(x, y); return t?.closest?.('[data-zone]')?.dataset.zone || ''; }
	function highlight(x, y, from) {
		const z = x < 0 ? '' : zoneAt(x, y);
		for (const g of win.querySelectorAll('[data-zone]')) g.classList.toggle('drop', !!z && g.dataset.zone === z && z !== from && (z === 'offer' || z === 'bag'));
	}

	function render(v) {
		view = v;
		if (win.style.display === 'none') return;
		hideTip();
		const { T, me, peerName } = v, mine = T.sides[T.role], theirs = T.sides[T.role === 'a' ? 'b' : 'a'];
		const meK = T.role, themK = T.role === 'a' ? 'b' : 'a', key = keyOf(T);
		const live = OPEN.includes(T.status), meOk = T.ok[meK] === key, themOk = T.ok[themK] === key;
		// a change that cleared an accept: a flash and a low note
		if (prevKey && key !== prevKey && (prevOk.a || prevOk.b) && live) { flashing = performance.now(); sound('flash'); }
		if (themOk && prevOk[themK] !== key && live) sound('accept');
		if (T.status === 'done' && prevOk.status !== 'done') sound('done');
		prevKey = key; prevOk = { a: T.ok.a, b: T.ok.b, status: T.status };
		const ph = phone(), size = ph ? 46 : 54, cols = ph ? 6 : 4;
		win.replaceChildren();
		place();
		// the head
		const head = el('div'); head.style.cssText = 'display:flex;align-items:center;gap:8px;';
		const ttl = el('div', 'g99-title', `Trade with ${peerName}`); ttl.style.flex = '1';
		head.append(ttl, btn('✕', () => onClose(), 'quiet', 'Close'));
		win.append(head, el('div', 'g99-rule'));
		const sub = el('div', '', v.where || ''); sub.style.cssText = 'opacity:.7;font-size:12px;';
		win.append(sub);
		// the two offers
		const offers = el('div'); offers.style.cssText = ph ? 'display:flex;flex-direction:column;gap:8px;' : 'display:grid;grid-template-columns:1fr 1fr;gap:10px;';
		const mineBest = (id) => me.instances.filter((x) => x.i === id && !mine.items.some((y) => y.u === x.u)).sort((a, b) => b.t - a.t || b.l - a.l)[0] || null;
		const theirBest = (id) => theirs.items.filter((x) => x.i === id).sort((a, b) => b.t - a.t || b.l - a.l)[0] || null;
		const panel = (title, side, ok, zone, opts) => {
			const p = el('div', 'g99-panel' + (ok ? ' ok' : '') + (performance.now() - flashing < 700 ? ' flash' : ''));
			const h = el('div', 'g99-label', title); h.style.marginBottom = '6px';
			p.append(h);
			if (ok) p.append(el('span', 'check', '✓ Accepted'));
			p.append(grid(side.items, { cols, size, empty: SLOTS, zone, ...opts }));
			const c = el('div'); c.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap;min-height:44px;';
			c.append(coins(side.credits));
			if (zone === 'offer' && live) {
				const f = el('input'); f.type = 'number'; f.min = '0'; f.max = String(me.credits); f.step = '10'; f.value = String(side.credits); f.inputMode = 'numeric';
				f.setAttribute('aria-label', 'Credits you give');
				f.style.cssText = 'width:84px;min-height:40px;padding:6px 8px;border-radius:8px;border:1px solid #7a6136;background:rgba(0,0,0,.45);color:#f3d27a;font:700 14px system-ui;';
				f.addEventListener('change', () => setCredits(+f.value || 0));
				f.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') f.blur(); });
				const spacer = el('span'); spacer.style.flex = '1';
				if (!ph) c.append(spacer, btn('−10', () => setCredits(side.credits - 10), 'quiet'));
				c.append(f, btn('+10', () => setCredits(side.credits + 10), 'quiet'), btn('+100', () => setCredits(side.credits + 100), 'quiet'));
			}
			p.append(c);
			return p;
		};
		const setCredits = (n) => { const c = Math.max(0, Math.min(me.credits, Math.round(n))); if (c !== mine.credits) { sound('place'); onEdit({ credits: c, items: mine.items }); } };
		const take = (inst) => { if (!live) return; sound('remove'); onEdit({ credits: mine.credits, items: mine.items.filter((x) => x.u !== inst.u) }); };
		const give = (inst) => {
			if (!live) return;
			if (mine.items.length >= SLOTS) return;
			// (a stack moves one at a time: the next of its kind not yet offered)
			const pick = me.instances.find((x) => x.i === inst.i && x.l === inst.l && x.t === inst.t && !mine.items.some((y) => y.u === x.u));
			if (!pick) return;
			sound('place'); onEdit({ credits: mine.credits, items: [...mine.items, pick] });
		};
		offers.append(
			panel('Your offer', mine, meOk, 'offer', { onTap: live ? take : null, compare: (x) => { const b = theirBest(x.i); return b ? [b, 'compared with theirs'] : [null, '']; } }),
			panel(`${peerName}'s offer`, theirs, themOk, 'theirs', { onTap: null, compare: (x) => { const b = mineBest(x.i); return b ? [b, `compared with your best (${tierName(b.t)}, level ${b.l})`] : [null, 'New to you']; } }),
		);
		win.append(offers);
		// the summary of gains, item by item, for what you would get
		const gains = theirs.items.map((x) => { const b = mineBest(x.i); if (!b) return `${nameOf(x.i)}: new to you`; const s = statsOf(x)[0], o = statsOf(b)[0]; const d = Math.round((s.value - o.value) * 10) / 10; return `${nameOf(x.i)}: ${s.label} ${d >= 0 ? '+' : ''}${d} on your best`; });
		if (gains.length) { const g = el('div', '', gains.slice(0, 3).join(' · ')); g.style.cssText = 'font-size:12px;opacity:.8;'; win.append(g); }
		// the status, the hold, and the buttons
		const left = v.holdLeft;
		const status = el('div');
		status.style.cssText = 'text-align:center;min-height:20px;font:600 13px system-ui;color:#e9cf93;';
		status.textContent = left > 0 ? `Both accepted: trading in ${(left / 1000).toFixed(1)} s…` : {
			asking: `Asking ${peerName}…`, invited: 'Add what you give, then accept.', open: meOk && themOk ? 'Both accepted: completing…' : meOk && !themOk ? `Waiting for ${peerName} to accept…` : !meOk && themOk ? `${peerName} accepted: your turn.` : 'Drag or tap items into your offer, then accept.',
			committing: 'Done on your side; waiting for their game…', done: '✓ Trade complete.', cancelled: v.why || 'Cancelled.', failed: v.why || 'The trade did not go through.',
		}[T.status] || '';
		countdown = status;
		win.append(status);
		holdBar = el('div', 'g99-bar'); const hb = el('i'); holdBar.append(hb);
		hb.style.width = left > 0 ? `${Math.round((1 - left / HOLD_MS) * 100)}%` : '0%';
		holdBar.style.visibility = left > 0 ? 'visible' : 'hidden';
		win.append(holdBar);
		const row = el('div'); row.style.cssText = 'display:flex;gap:8px;';
		if (live) {
			const short = v.short;
			const acc = btn(meOk ? '✓ Accepted' : 'Accept', () => { sound('accept'); onAccept(); }, 'go');
			acc.style.flex = '2'; acc.style.minHeight = '52px';
			acc.disabled = meOk || short || T.status === 'asking' || (!mine.credits && !mine.items.length && !theirs.credits && !theirs.items.length);
			const no = btn('Cancel', () => onCancel(), '');
			no.style.flex = '1'; no.style.minHeight = '52px';
			row.append(no, acc);
			if (short) { const w = el('div', '', 'You no longer have everything you offered: change your offer.'); w.style.cssText = 'color:#ff9a8a;font-size:12px;text-align:center;'; win.append(w); }
		} else { const c = btn('Close', () => onClose(), 'go'); c.style.flex = '1'; row.append(c); }
		win.append(row);
		// your bag: what you could still offer
		if (live) {
			const bag = me.instances.filter((x) => !mine.items.some((y) => y.u === x.u));
			const bh = el('button', 'g99-label', `${bagOpen ? '▾' : '▸'} Your bag (${bag.length})`);
			bh.type = 'button'; bh.style.cssText = 'background:none;border:0;text-align:left;min-height:36px;cursor:pointer;padding:0;';
			bh.onclick = (e) => { e.stopPropagation(); bagOpen = !bagOpen; render(view); };
			win.append(el('div', 'g99-rule'), bh);
			if (bagOpen) {
				const p = el('div', 'g99-panel');
				if (!bag.length) p.append(el('div', '', 'Nothing more to offer.'));
				else p.append(grid(bag, { cols: ph ? 6 : 8, size, zone: 'bag', onTap: give, compare: (x) => { const b = theirBest(x.i); return b ? [b, 'compared with theirs'] : [null, '']; } }));
				win.append(p);
				const hint = el('div', '', ph ? 'Tap to move an item; press and hold for its stats.' : 'Drag or click to move an item; hover for its stats.');
				hint.style.cssText = 'font-size:11px;opacity:.6;text-align:center;';
				win.append(hint);
			}
		}
	}
	// the hold's countdown, every frame while it runs
	function tickHold(left) {
		if (!countdown || !holdBar) return;
		if (left > 0) { countdown.textContent = `Both accepted: trading in ${(left / 1000).toFixed(1)} s…`; holdBar.style.visibility = 'visible'; holdBar.firstChild.style.width = `${Math.round((1 - left / HOLD_MS) * 100)}%`; }
	}
	return {
		el: win, render, tickHold,
		open: () => { win.style.display = 'flex'; seen.clear(); prevKey = ''; if (view) render(view); else place(); },
		close: () => { win.style.display = 'none'; hideTip(); },
		shown: () => win.style.display !== 'none',
	};
}
