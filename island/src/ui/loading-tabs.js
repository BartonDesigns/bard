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
import { keptPortrait } from './hero-portrait.js';

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
.lt-pic{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:12px;border:1px solid rgba(232,209,158,.3);box-shadow:0 10px 26px rgba(0,0,0,.55)}
.lt-fig{width:100%;height:auto;display:block;filter:drop-shadow(0 6px 14px rgba(0,0,0,.6))}
.lt-fig .p{fill:rgba(232,209,158,.08);stroke:rgba(232,209,158,.45);stroke-width:1.2;stroke-linejoin:round;transition:fill .3s,stroke .3s}
.lt-fig .ln{fill:none!important;stroke-width:.8;stroke-linecap:round;opacity:.55}
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

// you, as a figure: each part lit in the colour of the tier you wear there. A fighter, squared up
// in a wide, low stance, the guard up and a scowl: broad shoulders over a narrow waist, full arms
// and thighs (the lines on it, .ln, are the muscle's and the brow's, drawn but never filled)
const FIGURE = `<svg class="lt-fig" viewBox="0 0 120 240" role="img" aria-label="Your character">
<defs><radialGradient id="lt-glow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#e8d19e" stop-opacity=".16"/><stop offset="1" stop-color="#e8d19e" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="60" cy="112" rx="58" ry="108" fill="url(#lt-glow)"/>
<ellipse cx="62" cy="220" rx="46" ry="5" fill="rgba(0,0,0,.45)"/>
<g data-part="legs"><path class="p" d="M52.1 110.7C48.6 109.6 42.7 109.5 39.6 113.5C36.5 117.6 34.9 127.7 33.4 135C32 142.4 31.9 151.6 30.9 157.7C30 163.7 28.5 165.9 27.9 171.1C27.4 176.4 28 183.7 27.9 189.4C27.9 195.2 27.2 202.4 27.8 205.6C28.5 208.8 30.4 208.4 31.8 208.5C33.2 208.6 35 209.4 36.2 206.4C37.4 203.4 37.9 196.2 39.1 190.6C40.2 185 42.4 177.9 43.1 172.9C43.7 167.8 41.5 165.7 43.1 160.3C44.6 155 49.7 147.6 52.6 141C55.4 134.3 60.5 125.5 60.4 120.5C60.4 115.4 55.6 111.9 52.1 110.7Z"/><path class="p" d="M67.5 110.9C64.1 112.2 59.6 116.1 59.8 121.1C60 126 65.4 134.2 68.6 140.5C71.8 146.8 77.2 153.6 79 158.7C80.9 163.8 79.2 165.9 80 171.1C80.8 176.2 82.9 183.6 83.9 189.5C85 195.3 85.2 203.1 86.3 206.2C87.4 209.4 89.3 208.6 90.6 208.5C92 208.4 94 209.1 94.7 205.8C95.4 202.4 95 194.7 95.1 188.5C95.1 182.4 95.7 174.5 95 168.9C94.3 163.4 92.2 161.2 91 155.3C89.7 149.4 89.2 140.6 87.4 133.5C85.6 126.4 83.5 116.7 80.2 112.9C76.9 109.1 71 109.5 67.5 110.9Z"/><path class="p" d="M45 104C48.2 102.6 55 105.5 60 105.5C65 105.5 71.8 102.6 75 104C78.2 105.4 78.5 111 79 114C79.5 117 81.2 120.2 78 122C74.8 123.8 66 125 60 125C54 125 45.2 123.8 42 122C38.8 120.2 40.5 117 41 114C41.5 111 41.8 105.4 45 104Z"/></g>
<g data-part="feet"><path class="p" d="M27 204H37L39 214Q38 219 33 219H20Q19 213 27 204Z"/><path class="p" d="M85.5 204H95.5Q103 211 104 219H90Q85 219 84.5 214Z"/></g>
<g data-part="body"><path class="p" d="M31 50.7C28.6 49.5 24.4 48.8 21.8 51.6C19.1 54.4 16.6 62 14.9 67.3C13.2 72.6 11.5 79.7 11.8 83.3C12 86.8 14.5 87.9 16.5 88.4C18.4 89 21.1 89.3 23.2 86.7C25.4 84.1 26.9 77.4 29.1 72.7C31.3 68 35.9 62.1 36.2 58.4C36.6 54.7 33.4 51.8 31 50.7Z"/><path class="p" d="M88.3 51C86.1 52.5 83.7 56.2 84.3 59.4C85 62.7 90 66.6 92.2 70.4C94.5 74.2 95.8 79.8 97.8 82C99.9 84.1 102.8 84.1 104.7 83.4C106.6 82.7 109 81.3 109.2 78C109.4 74.7 107.7 68.2 105.8 63.6C103.9 59 100.6 52.7 97.7 50.6C94.7 48.5 90.6 49.5 88.3 51Z"/><path class="p" d="M52 40C48.8 40.6 44.5 42 41 43C37.5 44 33.8 44.5 31 46C28.3 47.5 25.7 49.7 24.5 52C23.3 54.3 23.3 57.5 24 60C24.7 62.5 26.7 64.7 28.5 67C30.3 69.3 33.3 70.8 35 74C36.8 77.2 37.7 82 39 86C40.3 90 42 94.5 43 98C44 101.5 42.2 105.3 45 107C47.8 108.8 55 108.5 60 108.5C65 108.5 72.2 108.8 75 107C77.8 105.3 76 101.5 77 98C78 94.5 79.7 90 81 86C82.3 82 83.3 77.2 85 74C86.8 70.8 89.7 69.3 91.5 67C93.3 64.7 95.3 62.5 96 60C96.7 57.5 96.7 54.3 95.5 52C94.3 49.7 91.8 47.5 89 46C86.3 44.5 82.5 44 79 43C75.5 42 71.2 40.6 68 40C64.8 39.4 62.7 39.5 60 39.5C57.3 39.5 55.2 39.4 52 40Z"/><path class="p ln" d="M60 52V100M45 60Q52 66 60 63Q68 66 75 60M51 78H69M52 90H68"/><path class="p" d="M14 83.6C13.3 85.5 13.6 89 15.2 90.8C16.8 92.5 20.7 93.5 23.8 93.9C26.8 94.2 31.6 93.8 33.8 92.9C35.9 92 36.6 90.1 36.6 88.6C36.7 87.2 36 85.2 34.2 84.1C32.5 83 28.7 82.9 26.2 82.1C23.8 81.3 21.8 79 19.8 79.2C17.8 79.5 14.8 81.7 14 83.6Z"/><path class="p" d="M104.7 83.5C106.7 82.8 109.6 81.6 109.4 78C109.2 74.4 106 66.9 103.6 61.8C101.2 56.6 97.3 49.7 95 47.1C92.7 44.6 91.2 46 89.9 46.6C88.6 47.2 86.6 47.6 87 50.9C87.4 54.1 90.7 61.1 92.4 66.2C94.2 71.4 95.6 79.1 97.6 82C99.7 84.9 102.8 84.2 104.7 83.5Z"/></g>
<g data-part="head"><path class="p" d="M60 8C67.5 8 71.5 13.5 71.5 20.5C71.5 25.5 70 29.5 67.5 32.5L63.5 36H56.5L52.5 32.5C50 29.5 48.5 25.5 48.5 20.5C48.5 13.5 52.5 8 60 8Z"/><path class="p" d="M55 34.5H65L67.5 42H52.5Z"/><path class="p ln" d="M53.5 21L58.5 23.2M66.5 21L61.5 23.2"/></g>
<g data-part="hands"><path class="p" d="M34 82.5C35.5 81.3 39.3 81.2 41 82C42.7 82.8 43.9 85.6 44 87.5C44.1 89.4 43 92.4 41.5 93.5C40 94.6 36.6 94.8 35 94C33.4 93.3 32.2 90.9 32 89C31.8 87.1 32.5 83.7 34 82.5Z"/><path class="p" d="M85 39C86.3 37.8 90.3 37.3 92 38C93.8 38.7 95.2 41.1 95.5 43C95.8 44.9 95.3 48.2 94 49.5C92.7 50.8 89.2 51.7 87.5 51C85.8 50.3 84.4 47.5 84 45.5C83.6 43.5 83.7 40.3 85 39Z"/></g>
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
		// (your hero as last pictured on this device, ui/hero-portrait.js; the drawn figure until then)
		const pic = keptPortrait();
		if (pic) { const im = el('img', 'lt-pic'); im.src = pic; im.alt = 'Your hero, in what you wear'; fig.append(im); } else fig.innerHTML = FIGURE;
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
