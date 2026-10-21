// While the world loads: your character, what you carry and your account, on the loading screen
// (loading-screen.js draws the tabs; this fills them). A look only, built of plain page elements
// from what is already in memory: no thumbnails (gear-studio.js has its own WebGL renderer), no
// avatar, nothing for the GPU, so a phone's load costs the same with a tab open. Wearing,
// holding and trading wait for the world (ui/gear.js). Signing in is the account panel itself
// (ui/account.js embed), so a saved game loaded from here restarts the page before you enter.

import { GARMENT_SLOTS } from '../gameplay/arms.js';
import { groupInstances } from '../gameplay/gear-levels.js';
import { ATTRS, ATTR_IDS } from '../magic/stats.js';
import { coins, el, slot, tierColor, tipContent, useStyle } from './gear-look.js';

const SLOT_NAMES = { head: 'Head', body: 'Top', legs: 'Legs', hands: 'Hands', feet: 'Feet' };
const SLOT_MARKS = { head: '⛑️', body: '🧥', legs: '👖', hands: '🧤', feet: '🥾' };
const CSS = `
#bard-loading .g99-slot{touch-action:manipulation}
.lt-who{display:flex;flex-direction:column;gap:3px}
.lt-name{font:500 24px/1.15 var(--bard-display,Georgia,serif);letter-spacing:.02em;color:#f5f1e7;overflow-wrap:anywhere}
.lt-line{font:600 12px var(--bard-display,Georgia,serif);letter-spacing:.06em;color:#e8d19e}
.lt-quiet{font-size:12px;color:#b9c6c6;line-height:1.45}
.lt-doll{display:grid;grid-template-columns:auto minmax(96px,150px) auto;justify-content:center;align-items:center;gap:6px 14px;padding:6px 0 2px}
.lt-side{display:flex;flex-direction:column;gap:10px}
.lt-cell{display:flex;flex-direction:column;align-items:center;gap:3px}
.lt-cell .g99-label{font-size:9px}
.lt-fig{width:100%;height:auto;display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6))}
.lt-fig .p{fill:rgba(232,209,158,.08);stroke:rgba(232,209,158,.45);stroke-width:1.2;stroke-linejoin:round;transition:fill .3s,stroke .3s}
.lt-tiles{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.lt-tile{border:1px solid rgba(232,209,158,.18);border-radius:10px;padding:8px 6px;text-align:center;background:rgba(0,0,0,.28)}
.lt-tile b{display:block;font:600 19px/1.2 var(--bard-display,Georgia,serif)}
.lt-tile span{font:700 9px var(--bard-display,system-ui,sans-serif);letter-spacing:.1em;text-transform:uppercase;color:#b89a62}
.lt-attr{display:grid;grid-template-columns:104px 26px 1fr;align-items:center;gap:8px;font-size:12px}
.lt-attr .nm{font:600 12px var(--bard-display,system-ui,sans-serif)}
.lt-attr b{font:600 14px var(--bard-display,Georgia,serif);text-align:right}
.lt-grid{display:grid;grid-template-columns:repeat(auto-fill,56px);gap:6px;justify-content:start;--slot:56px}
.lt-pick{outline:2px solid #e8d19e;outline-offset:2px}
.lt-detail{border:1px solid rgba(232,209,158,.22);border-radius:10px;padding:10px 12px;background:rgba(0,0,0,.3);font-size:12px;line-height:1.5;color:#e8e0cc}
.lt-detail b{font:600 15px var(--bard-display,Georgia,serif)}
.lt-tag{display:inline-block;margin-left:6px;padding:1px 8px;border-radius:10px;font:700 9px var(--bard-display,system-ui,sans-serif);letter-spacing:.1em;text-transform:uppercase;color:#121c20;background:#e8d19e;vertical-align:middle}
@media(max-width:400px){.lt-tiles{grid-template-columns:repeat(2,1fr)}.lt-doll{gap:6px 8px}.lt-attr{grid-template-columns:96px 24px 1fr}}
`;

// you, as a figure: each part lit in the colour of the tier you wear there
const FIGURE = `<svg class="lt-fig" viewBox="0 0 120 240" role="img" aria-label="Your character">
<defs><radialGradient id="lt-glow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#e8d19e" stop-opacity=".16"/><stop offset="1" stop-color="#e8d19e" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="60" cy="112" rx="58" ry="108" fill="url(#lt-glow)"/>
<ellipse cx="60" cy="224" rx="32" ry="5" fill="rgba(0,0,0,.45)"/>
<g data-part="head"><ellipse class="p" cx="60" cy="21" rx="11" ry="13"/><path class="p" d="M55 33h10v10H55z"/></g>
<path data-part="body" class="p" d="M50 42H70Q84 44 90 50Q96 54 97 64L101 96 103 122 95 123 91 98 87 70 84 74Q82 92 78 112H42Q38 92 36 74L33 70 29 98 25 123 17 122 19 96 23 64Q24 54 30 50Q36 44 50 42Z"/>
<g data-part="hands"><ellipse class="p" cx="21" cy="131" rx="5" ry="7"/><ellipse class="p" cx="99" cy="131" rx="5" ry="7"/></g>
<path data-part="legs" class="p" d="M42 114H78L80 134 76 206H64L61 140H59L56 206H44L40 134Z"/>
<g data-part="feet"><path class="p" d="M44 209H57L58 220H37Q37 212 44 209Z"/><path class="p" d="M63 209H76Q83 212 83 220H62Z"/></g>
</svg>`;

// arms: gameplay/arms.js's state; magic(): magic/index.js (stats, honor, info); account: the
// account panel (ui/account.js); name(): the name this device goes by
export function linkLoadingTabs({ arms, magic = () => null, account = null, name = () => '' }) {
	const L = window.L99Loading;
	if (!L?.tabs) return null;
	useStyle();
	if (!document.getElementById('lt-css')) { const s = document.createElement('style'); s.id = 'lt-css'; s.textContent = CSS; document.head.appendChild(s); }
	const safe = (f, fallback = null) => { try { return f() ?? fallback; } catch { return fallback; } };
	const label = (t) => el('div', 'g99-label', t);
	const who = () => safe(() => account?.info?.().name) || name() || 'Traveller';

	// one thing you have, in words: its name in its tier's colour, its stats, worn or held
	function detail(inst, where = '') {
		const d = el('div', 'lt-detail');
		d.append(tipContent(inst));
		if (where) d.firstChild.firstChild?.after?.(el('span', 'lt-tag', where));
		return d;
	}
	// a worn slot (or the hand) on the doll; a tap shows what it is below
	function cell(slotId, inst, show) {
		const c = el('div', 'lt-cell');
		const s = inst ? slot(inst) : slot(null);
		s.style.setProperty('--slot', '52px');
		if (inst) s.onclick = (e) => { e.stopPropagation(); show(inst, slotId === 'hand' ? 'In hand' : 'Worn'); };
		else { s.classList.add('bare'); s.textContent = slotId === 'hand' ? '✋' : SLOT_MARKS[slotId] || ''; s.setAttribute('aria-label', `${slotId === 'hand' ? 'Hand' : SLOT_NAMES[slotId]}: nothing`); s.tabIndex = -1; }
		c.append(s, label(slotId === 'hand' ? 'Hand' : SLOT_NAMES[slotId] || slotId));
		return c;
	}

	function character(host) {
		const st = safe(() => magic()?.stats?.()), hn = safe(() => magic()?.honor?.()), pts = safe(() => magic()?.info?.()?.points, 0);
		const box = el('div', 'lt-who');
		box.append(el('div', 'lt-name', who()));
		const line = [st ? `Level ${st.level}` : '', hn ? `${hn.title} · ${hn.pts} honor` : ''].filter(Boolean).join(' · ');
		if (line) box.append(el('div', 'lt-line', line));
		if (pts) box.append(el('div', 'lt-quiet', `${pts} skill point${pts > 1 ? 's' : ''} waiting to spend in the world.`));
		host.append(box);
		// the doll: head, top and legs to the left, hands, feet and what you hold to the right
		const worn = safe(() => arms.worn?.(), {}), held = safe(() => arms.held?.());
		const doll = el('div', 'lt-doll'), left = el('div', 'lt-side'), right = el('div', 'lt-side'), fig = el('div');
		fig.innerHTML = FIGURE;
		for (const k of GARMENT_SLOTS) {
			const x = worn[k];
			if (!x) continue;
			const c = tierColor(x.t);
			for (const p of fig.querySelectorAll(`[data-part="${k}"] .p, [data-part="${k}"].p`)) { p.style.fill = c + '30'; p.style.stroke = c; p.style.filter = `drop-shadow(0 0 4px ${c}88)`; }
		}
		const more = el('div');
		const show = (inst, where) => { more.replaceChildren(detail(inst, where)); };
		for (const k of ['head', 'body', 'legs']) left.append(cell(k, worn[k] || null, show));
		for (const k of ['hands', 'feet']) right.append(cell(k, worn[k] || null, show));
		right.append(cell('hand', held || null, show));
		doll.append(left, fig, right);
		host.append(doll, more);
		if (st) {
			const tiles = el('div', 'lt-tiles');
			for (const [k, v, c] of [['Life', st.life, '#ff8a8a'], ['Mana', Math.round(st.mana), '#8fb0ff'], ['Harm taken', `${st.harmTaken}%`, '#d8c49a'], ['Load', `${st.load} kg`, '#c9c2a2']]) {
				const t = el('div', 'lt-tile'), b = el('b', '', String(v));
				b.style.color = c; b.style.textShadow = `0 0 10px ${c}55`;
				t.append(b, el('span', '', k)); tiles.append(t);
			}
			host.append(tiles, label('Attributes'));
			const top = Math.max(40, ...ATTR_IDS.map((k) => st.attrs?.[k]?.total || 0));
			for (const k of ATTR_IDS) {
				const A = ATTRS[k], n = st.attrs?.[k]?.total || 0, r = el('div', 'lt-attr');
				const nm = el('span', 'nm', `${A.glyph} ${A.name}`); nm.style.color = A.color;
				const bar = el('div', 'g99-bar'), i = el('i'); i.style.cssText = `width:${Math.round(n / top * 100)}%;background:linear-gradient(90deg,${A.color}66,${A.color});`; bar.append(i);
				r.append(nm, el('b', '', String(n)), bar); host.append(r);
			}
		}
		host.append(el('div', 'lt-quiet', 'Change what you wear and hold from Gear once you are in the world.'));
	}

	function inventory(host) {
		const s = safe(() => arms.state(), {}), list = Object.values(s.instances || {});
		const top = el('div'); top.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;';
		top.append(coins(s.credits || 0), el('span', 'lt-quiet', list.length ? `${list.length} thing${list.length > 1 ? 's' : ''} carried` : 'Nothing carried'));
		host.append(top);
		if (!list.length) { host.append(el('div', 'lt-quiet', 'Start Field contracts on open Terran or arid ground for a first weapon cache. You can also buy at outfitters or recover fallen fighters’ equipment.')); return; }
		const wornU = new Set(Object.values(s.worn || {}));
		const where = (G) => (G.list.some((x) => x.u === s.hand) ? 'In hand' : G.list.some((x) => wornU.has(x.u)) ? 'Worn' : '');
		// worn and held first, then the best
		const groups = groupInstances(list).sort((a, b) => (where(b) ? 1 : 0) - (where(a) ? 1 : 0) || b.t - a.t || b.list[0].l - a.list[0].l);
		const grid = el('div', 'lt-grid'), more = el('div');
		let picked = null;
		for (const G of groups) {
			const inst = G.list.find((x) => x.u === s.hand) || G.list.find((x) => wornU.has(x.u)) || G.list[0];
			const sl = slot(inst, { count: G.list.length, held: G.list.some((x) => x.u === s.hand), worn: G.list.some((x) => wornU.has(x.u)) });
			sl.onclick = (e) => {
				e.stopPropagation();
				picked?.classList.remove('lt-pick'); picked = sl; sl.classList.add('lt-pick');
				more.replaceChildren(detail(inst, where(G)));
			};
			grid.append(sl);
		}
		host.append(grid, more, el('div', 'lt-quiet', 'Tap something to see it. Wear, hold, sell and trade from Gear once you are in the world.'));
	}

	let lastLabel = '';
	const accountLabel = () => { const I = safe(() => account.info(), {}); return I.user ? (I.name || I.user) : 'Sign in'; };
	const tabs = [
		{ id: 'character', label: () => 'Character', render: (host) => { character(host); } },
		{ id: 'inventory', label: () => 'Inventory', render: (host) => { inventory(host); } },
	];
	if (account?.embed) tabs.push({
		id: 'account', label: () => (lastLabel = accountLabel()),
		render: (host) => {
			host.classList.add('bl-flush');
			return account.embed(host, { changed: () => { if (accountLabel() !== lastLabel) L.relabel?.(); } });
		},
	});
	L.tabs(tabs);
	return { tabs, names: () => tabs.map((t) => t.label()) };
}
