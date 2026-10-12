// The morality compass on screen (K, or the places menu): your four axes, what the world calls
// you, how it treats you (greetings, prices, bounty, the songs and the graffiti), what you did
// lately, where you stand with each faction, and whether fights break out in the world on their
// own. The numbers come from combat/morality.js and combat/factions.js; nothing is decided here.

import { AXES, AXIS_NAMES } from './morality.js';
import { FACTIONS } from './factions.js';

const CSS = `
.cb-cmp{position:absolute;left:50%;top:calc(56px + env(safe-area-inset-top));transform:translateX(-50%);width:min(420px,calc(100vw - 24px));max-height:calc(100% - 72px - var(--l99-low,88px));overflow-y:auto;background:rgba(10,16,20,.86);border:1px solid rgba(255,255,255,.14);border-radius:14px;padding:14px 16px;color:#eef6f4;font:13px/1.35 system-ui,sans-serif;z-index:8;display:none;touch-action:pan-y;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px)}
.cb-cmp h3{margin:0 0 2px;font:700 16px system-ui;letter-spacing:.5px}.cb-cmp .ti{opacity:.85;margin-bottom:10px;color:#ffd07a}
.cb-cmp .ax{display:grid;grid-template-columns:76px 1fr 76px;gap:6px;align-items:center;margin:5px 0;font-size:11px}
.cb-cmp .ax span:last-child{text-align:right}.cb-cmp .tr{height:8px;border-radius:4px;background:linear-gradient(90deg,#ff7a5a33,#ffffff14 50%,#5fe0b033);position:relative}
.cb-cmp .tr i{position:absolute;top:-3px;width:4px;height:14px;border-radius:2px;background:#fff;box-shadow:0 0 6px #fff;transform:translateX(-2px)}
.cb-cmp .tr b{position:absolute;top:-2px;width:3px;height:12px;border-radius:2px;background:#9ab;opacity:.6;transform:translateX(-1px)}
.cb-cmp h4{margin:12px 0 4px;font:600 11px system-ui;letter-spacing:1px;text-transform:uppercase;opacity:.7}
.cb-cmp ul{margin:0;padding-left:16px}.cb-cmp li{margin:2px 0}
.cb-cmp .fs{display:grid;grid-template-columns:1fr auto;gap:2px 8px;font-size:12px}
.cb-cmp .st{font-size:10px;padding:1px 6px;border-radius:8px}.st.hostile{background:#ff5a3a44;color:#ffb39f}.st.allied{background:#5fe0b044;color:#b8f5d6}.st.neutral{background:#ffffff1a}
.cb-cmp button{margin-top:10px;min-height:34px;padding:6px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.2);background:transparent;color:#eafaf6;font:13px system-ui;cursor:pointer}
.cb-cmp .lg{font-size:11px;opacity:.7;margin-top:8px}
`;

export function createCompass({ mount, menu, morality, relations, worldKey, settings }) {
	if (!document.getElementById('cb-cmp-style')) { const s = document.createElement('style'); s.id = 'cb-cmp-style'; s.textContent = CSS; document.head.appendChild(s); }
	const el = document.createElement('div');
	el.className = 'cb-cmp'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Morality compass');
	for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation());
	mount.appendChild(el);
	const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
	const pct = (v) => `${50 + v / 2}%`;
	function draw() {
		const I = morality.info(worldKey()), R = I.reactions, W = I.world;
		const stand = relations.player();
		el.innerHTML = `<h3>Morality compass</h3><div class="ti">Known as ${esc(R.title)} · reputation ${R.reputation}</div>
			${AXES.map((a) => `<div class="ax"><span>${AXIS_NAMES[a][0]}</span><div class="tr"><b style="left:${pct(W[a])}" title="this world"></b><i style="left:${pct(I.me[a])}" title="you"></i></div><span>${AXIS_NAMES[a][1]}</span></div>`).join('')}
			<div class="lg">White: you, everywhere. Grey: how this world remembers you.</div>
			<h4>How the world treats you</h4><ul><li>“${esc(R.greet[0])}”</li><li>Prices ${R.priceK > 1 ? 'up' : R.priceK < 1 ? 'down' : 'as usual'} (×${R.priceK})</li><li>${R.bounty ? `A bounty: level ${R.bounty}. Contract hunters are looking for you.` : 'No bounty on you.'}</li>${R.song ? `<li>${esc(R.song)}</li>` : ''}${R.graffiti ? `<li>On the walls: “${esc(R.graffiti)}”</li>` : ''}</ul>
			<h4>Lately</h4><ul>${I.recent.length ? I.recent.slice().reverse().map((l) => `<li>${esc(l)}</li>`).join('') : '<li>Nothing yet.</li>'}</ul>
			<h4>Standing</h4><div class="fs">${Object.entries(stand).filter(([f]) => FACTIONS[f].kind !== 'machines' && FACTIONS[f].kind !== 'creatures').map(([f, v]) => `<span>${esc(FACTIONS[f].name)}</span><span class="st ${v <= -30 ? 'hostile' : v >= 30 ? 'allied' : 'neutral'}">${v <= -30 ? 'hostile' : v >= 30 ? 'allied' : 'neutral'} ${v > 0 ? '+' : ''}${v}</span>`).join('')}</div>
			<div class="lg">The young carry the Spark until they come of age: no harm reaches them.</div>`;
		const b = document.createElement('button');
		b.textContent = `Fights in the world: ${settings.ambient ? 'on' : 'off'}`;
		b.onclick = () => { settings.ambient = !settings.ambient; settings.save(); draw(); };
		const c = document.createElement('button'); c.textContent = 'Close'; c.style.marginLeft = '8px'; c.onclick = () => toggle(false);
		el.append(b, c);
	}
	function toggle(on = el.style.display === 'none' || !el.style.display) { el.style.display = on ? 'block' : 'none'; if (on) draw(); }
	addEventListener('keydown', (e) => { if ((e.key === 'k' || e.key === 'K') && !e.repeat && !e.metaKey && !e.ctrlKey && !window._KEYS_PLAY_ON && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName || '')) { e.preventDefault(); toggle(); } });
	if (menu) {
		const m = document.createElement('button');
		m.type = 'button'; m.textContent = '🧭 Morality compass';
		m.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;';
		m.onclick = (e) => { e.stopPropagation(); menu.style.display = 'none'; toggle(true); };
		for (const ev of ['pointerdown', 'touchstart']) m.addEventListener(ev, (e) => e.stopPropagation());
		menu.insertBefore(m, menu.children[1] || null);
	}
	return { toggle, draw, shown: () => el.style.display === 'block', el };
}
