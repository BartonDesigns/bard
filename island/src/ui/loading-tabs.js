// While the world loads: your character, what you carry and your account, on the loading screen
// (loading-screen.js draws the tabs; this fills them). A look only, built of plain page elements
// from what is already in memory: no thumbnails (gear-studio.js has its own WebGL renderer), no
// avatar, nothing for the GPU, so a phone's load costs the same with a tab open. Wearing,
// holding and trading wait for the world (ui/gear.js). Signing in is the account panel itself
// (ui/account.js embed), so a saved game loaded from here restarts the page before you enter.

import { GARMENT_SLOTS } from '../gameplay/arms.js';
import { groupInstances } from '../gameplay/gear-levels.js';
import { ATTRS, ATTR_IDS } from '../magic/stats.js';
import { setHeroChoice } from '../people/hero.js';
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
.lt-heroes{display:flex;justify-content:center;gap:6px}
.lt-heroes button{min-width:92px;min-height:36px;padding:6px 14px;border-radius:18px;border:1px solid rgba(232,209,158,.3);background:rgba(0,0,0,.3);color:#d8cfb8;font:600 11px var(--bard-display,system-ui,sans-serif);letter-spacing:.1em;text-transform:uppercase;cursor:pointer;touch-action:manipulation}
.lt-heroes button[aria-pressed="true"]{background:#e8d19e;border-color:#e8d19e;color:#121c20}
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

// you, as a figure: each part lit in the colour of the tier you wear there. Your hero or
// heroine as a hero stands: planted, fists on the hips with the elbows out, the chest up, the
// head lifted to look up and away; broad shoulders over a narrow waist (the lines on it, .ln, are
// the muscle's and the brow's, drawn but never filled)
const FIGURES = {
	male: `<svg class="lt-fig" viewBox="0 0 120 240" role="img" aria-label="Your hero">
<defs><radialGradient id="lt-glow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#e8d19e" stop-opacity=".16"/><stop offset="1" stop-color="#e8d19e" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="60" cy="112" rx="58" ry="108" fill="url(#lt-glow)"/>
<ellipse cx="60" cy="220" rx="40" ry="5" fill="rgba(0,0,0,.45)"/>
<g data-part="legs"><path class="p" d="M50.9 110.5C47.3 109.9 41.4 111.1 39.1 115.4C36.8 119.8 37.3 129.3 37.1 136.6C36.9 143.9 38 153.1 37.6 159.2C37.3 165.3 35.5 168.1 35.1 173.3C34.8 178.5 35.5 185.1 35.5 190.5C35.5 195.9 34.5 202.5 35.1 205.6C35.7 208.6 37.8 208.5 39.2 208.6C40.7 208.8 42.7 209.3 43.9 206.4C45.1 203.6 45.5 196.8 46.5 191.5C47.5 186.2 49.2 179.8 49.9 174.7C50.5 169.6 49.2 166.7 50.4 160.8C51.5 154.9 55.1 146.4 56.9 139.4C58.7 132.3 61.9 123.4 60.9 118.6C59.9 113.7 54.6 111 50.9 110.5Z"/><path class="p" d="M69.1 110.5C65.4 111 60.1 113.7 59.1 118.6C58.1 123.4 61.3 132.3 63.1 139.4C64.9 146.4 68.5 154.9 69.6 160.8C70.8 166.7 69.5 169.6 70.1 174.7C70.8 179.8 72.5 186.2 73.5 191.5C74.5 196.8 74.9 203.6 76.1 206.4C77.3 209.3 79.3 208.8 80.8 208.6C82.2 208.5 84.3 208.6 84.9 205.6C85.5 202.5 84.5 195.9 84.5 190.5C84.5 185.1 85.2 178.5 84.9 173.3C84.5 168.1 82.7 165.3 82.4 159.2C82 153.1 83.1 143.9 82.9 136.6C82.7 129.3 83.2 119.8 80.9 115.4C78.6 111.1 72.7 109.9 69.1 110.5Z"/><path class="p" d="M44 104C47.2 102.6 54.7 105.5 60 105.5C65.3 105.5 72.8 102.6 76 104C79.2 105.4 78.7 111 79 114C79.3 117 81.2 120.2 78 122C74.8 123.8 66 125 60 125C54 125 45.2 123.8 42 122C38.8 120.2 40.7 117 41 114C41.3 111 40.8 105.4 44 104Z"/></g>
<g data-part="feet"><path class="p" d="M34.5 204H44.5L46 214Q45 219 40 219H28Q27 213 34.5 204Z"/><path class="p" d="M75.5 204H85.5Q93 213 92 219H80Q75 219 74 214Z"/></g>
<g data-part="body"><path class="p" d="M31.6 50.9C29.3 49.5 25 48.7 22.2 50.7C19.5 52.8 17.6 58.5 15.1 63.2C12.6 67.9 8.1 75.4 7.3 79C6.4 82.6 8.6 83.8 10.2 84.8C11.8 85.8 13.8 87.3 16.7 85C19.6 82.7 24.4 75.4 27.6 71.1C30.8 66.8 35.1 62.6 35.8 59.3C36.4 55.9 33.8 52.4 31.6 50.9Z"/><path class="p" d="M88.4 50.9C86.2 52.4 83.6 55.9 84.2 59.3C84.9 62.6 89.2 66.8 92.4 71.1C95.6 75.4 100.4 82.7 103.3 85C106.2 87.3 108.2 85.8 109.8 84.8C111.4 83.8 113.6 82.6 112.7 79C111.9 75.4 107.4 67.9 104.9 63.2C102.4 58.5 100.5 52.8 97.8 50.7C95 48.7 90.7 49.5 88.4 50.9Z"/><path class="p" d="M52 40C48.7 40.6 43.7 42 40.2 43C36.7 44 33.8 44.5 31.2 46C28.6 47.5 25.7 49.7 24.5 52C23.3 54.3 23.3 57.5 24 60C24.7 62.5 26.7 64.7 28.5 67C30.3 69.3 33.3 70.8 35 74C36.8 77.2 37.7 82 39 86C40.3 90 42 94.5 43 98C44 101.5 42.2 105.3 45 107C47.8 108.8 55 108.5 60 108.5C65 108.5 72.2 108.8 75 107C77.8 105.3 76 101.5 77 98C78 94.5 79.7 90 81 86C82.3 82 83.3 77.2 85 74C86.8 70.8 89.7 69.3 91.5 67C93.3 64.7 95.3 62.5 96 60C96.7 57.5 96.7 54.3 95.5 52C94.3 49.7 91.4 47.5 88.8 46C86.2 44.5 83.3 44 79.8 43C76.3 42 71.3 40.6 68 40C64.7 39.4 62.7 39.5 60 39.5C57.3 39.5 55.3 39.4 52 40Z"/><path class="p ln" d="M60 52V100M45 60Q52 66 60 63Q68 66 75 60M51 78H69M52 90H68"/><path class="p" d="M9.3 79.8C8.1 81.3 7 84.2 8.4 86.5C9.7 88.9 13 90.6 17.5 93.9C22 97.2 31.6 104.5 35.4 106.3C39.1 108.1 39.1 105.7 40 104.6C40.8 103.5 43.2 103 40.6 99.7C38.1 96.4 28.9 88.5 24.7 84.8C20.6 81.1 18.2 78.3 15.6 77.5C13.1 76.7 10.5 78.3 9.3 79.8Z"/><path class="p" d="M110.7 79.8C109.5 78.3 106.9 76.7 104.4 77.5C101.8 78.3 99.4 81.1 95.3 84.8C91.1 88.5 81.9 96.4 79.4 99.7C76.8 103 79.2 103.5 80 104.6C80.9 105.7 80.9 108.1 84.6 106.3C88.4 104.5 98 97.2 102.5 93.9C107 90.6 110.3 88.9 111.6 86.5C113 84.2 111.9 81.3 110.7 79.8Z"/></g>
<g data-part="head"><g transform="rotate(-16 60 40)"><path class="p" d="M60 8.5C68.625 8.5 71.5 15.25 71.5 21C71.5 26.4 69.2 31.125 65.175 33.825L60 36.5L54.825 33.825C50.8 31.125 48.5 26.4 48.5 21C48.5 15.25 51.375 8.5 60 8.5Z"/><path class="p ln" d="M53.5 20L58.5 21.6M66.5 20L61.5 21.6"/></g><path class="p" d="M54.5 33.5H65.5L68 42H52Z"/></g>
<g data-part="hands"><path class="p" d="M37 101.5C38.4 100.7 42.4 100.3 44 101C45.6 101.8 46.5 104.3 46.5 106C46.5 107.7 45.5 110.3 44 111C42.5 111.8 38.9 111.3 37.5 110.5C36.1 109.7 35.6 107.5 35.5 106C35.4 104.5 35.6 102.3 37 101.5Z"/><path class="p" d="M75 101.5C76.4 100.7 80.4 100.3 82 101C83.6 101.8 84.5 104.3 84.5 106C84.5 107.7 83.5 110.3 82 111C80.5 111.8 76.9 111.3 75.5 110.5C74.1 109.7 73.6 107.5 73.5 106C73.4 104.5 73.6 102.3 75 101.5Z"/></g>
</svg>`,
	female: `<svg class="lt-fig" viewBox="0 0 120 240" role="img" aria-label="Your heroine">
<defs><radialGradient id="lt-glow" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#e8d19e" stop-opacity=".16"/><stop offset="1" stop-color="#e8d19e" stop-opacity="0"/></radialGradient></defs>
<ellipse cx="60" cy="112" rx="58" ry="108" fill="url(#lt-glow)"/>
<ellipse cx="60" cy="220" rx="40" ry="5" fill="rgba(0,0,0,.45)"/>
<g data-part="legs"><path class="p" d="M50.9 110.8C47.4 110.3 41.8 111.2 39.6 115.5C37.4 119.8 37.9 129.4 37.7 136.7C37.5 144 38.5 153.2 38.2 159.3C38 165.4 36.3 168.2 35.9 173.4C35.6 178.6 36.1 185.2 36.1 190.5C36 195.9 35.1 202.6 35.6 205.6C36.2 208.6 38 208.2 39.3 208.3C40.6 208.5 42.3 209.2 43.4 206.4C44.5 203.6 45 196.8 45.9 191.5C46.9 186.2 48.4 179.8 49.1 174.6C49.7 169.5 48.5 166.6 49.8 160.7C51 154.8 54.5 146.3 56.3 139.3C58.1 132.3 61.3 123.2 60.4 118.5C59.5 113.7 54.4 111.3 50.9 110.8Z"/><path class="p" d="M69.1 110.8C65.6 111.3 60.5 113.7 59.6 118.5C58.7 123.2 61.9 132.3 63.7 139.3C65.5 146.3 69 154.8 70.2 160.7C71.5 166.6 70.3 169.5 70.9 174.6C71.6 179.8 73.1 186.2 74.1 191.5C75 196.8 75.5 203.6 76.6 206.4C77.7 209.2 79.4 208.5 80.7 208.3C82 208.2 83.8 208.6 84.4 205.6C84.9 202.6 84 195.9 83.9 190.5C83.9 185.2 84.4 178.6 84.1 173.4C83.7 168.2 82 165.4 81.8 159.3C81.5 153.2 82.5 144 82.3 136.7C82.1 129.4 82.6 119.8 80.4 115.5C78.2 111.2 72.6 110.3 69.1 110.8Z"/><path class="p" d="M46.5 104C49.9 102.6 55.5 105.5 60 105.5C64.5 105.5 70.1 102.6 73.5 104C76.9 105.4 79.5 111 80.5 114C81.5 117 82.9 120.2 79.5 122C76.1 123.8 66.5 125 60 125C53.5 125 43.9 123.8 40.5 122C37.1 120.2 38.5 117 39.5 114C40.5 111 43.1 105.4 46.5 104Z"/></g>
<g data-part="feet"><path class="p" d="M34.5 204H44.5L46 214Q45 219 40 219H28Q27 213 34.5 204Z"/><path class="p" d="M75.5 204H85.5Q93 213 92 219H80Q75 219 74 214Z"/></g>
<g data-part="body"><path class="p" d="M37.1 51.6C35.2 50.5 31.9 49.4 29.4 51.5C27 53.6 25 59.4 22.4 64.1C19.9 68.8 15.3 76.3 14.3 79.7C13.3 83 15.4 83.5 16.6 84.2C17.8 85 19.1 86.7 21.7 84.3C24.3 82 29.1 74.5 32.3 70.2C35.4 65.9 39.8 61.6 40.6 58.5C41.4 55.4 39 52.8 37.1 51.6Z"/><path class="p" d="M82.9 51.6C81 52.8 78.6 55.4 79.4 58.5C80.2 61.6 84.6 65.9 87.7 70.2C90.9 74.5 95.7 82 98.3 84.3C100.9 86.7 102.2 85 103.4 84.2C104.6 83.5 106.7 83 105.7 79.7C104.7 76.3 100.1 68.8 97.6 64.1C95 59.4 93 53.6 90.6 51.5C88.1 49.4 84.8 50.5 82.9 51.6Z"/><path class="p" d="M52 40C49.3 40.6 46.2 42 43.5 43C40.8 44 38.2 44.5 36 46C33.8 47.5 31.5 49.7 30.5 52C29.5 54.3 29.3 57.5 30 60C30.7 62.5 32.7 64.7 34.5 67C36.3 69.3 39.8 70.8 41 74C42.2 77.2 40.8 82 41.5 86C42.3 90 44.5 94.5 45.5 98C46.5 101.5 45.1 105.3 47.5 107C49.9 108.8 55.8 108.5 60 108.5C64.2 108.5 70.1 108.8 72.5 107C74.9 105.3 73.5 101.5 74.5 98C75.5 94.5 77.8 90 78.5 86C79.3 82 77.8 77.2 79 74C80.2 70.8 83.7 69.3 85.5 67C87.3 64.7 89.3 62.5 90 60C90.7 57.5 90.5 54.3 89.5 52C88.5 49.7 86.2 47.5 84 46C81.8 44.5 79.2 44 76.5 43C73.8 42 70.8 40.6 68 40C65.3 39.4 62.7 39.5 60 39.5C57.3 39.5 54.8 39.4 52 40Z"/><path class="p ln" d="M45 58Q52 68 60 62Q68 68 75 58M60 76V100"/><path class="p" d="M16 80.1C14.9 81.2 13.8 83.2 14.9 85.4C16 87.5 18.7 89.5 22.6 92.9C26.5 96.2 34.9 103.6 38.1 105.6C41.4 107.5 41.2 105.3 42 104.4C42.8 103.6 45 103.5 42.9 100.4C40.7 97.3 32.8 89.5 29.2 85.8C25.5 82.2 23.3 79.6 21.1 78.6C18.9 77.7 17 79 16 80.1Z"/><path class="p" d="M104 80.1C103 79 101.1 77.7 98.9 78.6C96.7 79.6 94.5 82.2 90.8 85.8C87.2 89.5 79.3 97.3 77.1 100.4C75 103.5 77.2 103.6 78 104.4C78.8 105.3 78.6 107.5 81.9 105.6C85.1 103.6 93.5 96.2 97.4 92.9C101.3 89.5 104 87.5 105.1 85.4C106.2 83.2 105.1 81.2 104 80.1Z"/></g>
<g data-part="head"><g transform="rotate(-16 60 40)"><path class="p" d="M55 9.5C54.5 8.3 60.7 8.2 63 8.5C65.3 8.8 67 10.4 69 11.5C71 12.6 72.8 13.4 75 15C77.2 16.6 80 18.5 82 21C84 23.5 86.1 26.8 87 30C87.9 33.2 88 39.3 87.5 40C87 40.7 85.4 36.2 84 34C82.6 31.8 81 29.2 79 27C77 24.8 74.2 22.9 72 21C69.8 19.1 68.8 17.4 66 15.5C63.2 13.6 55.5 10.7 55 9.5Z"/><path class="p" d="M60 9.2C67.875 9.2 70.5 15.6 70.5 21C70.5 26.12 68.4 30.6 64.725 33.16L60 35.8L55.275 33.16C51.6 30.6 49.5 26.12 49.5 21C49.5 15.6 52.125 9.2 60 9.2Z"/><path class="p ln" d="M54.5 20.5L58.5 21.2M65.5 20.5L61.5 21.2"/></g><path class="p" d="M55.8 33.5H64.2L66.7 42H53.3Z"/></g>
<g data-part="hands"><path class="p" d="M40.1 102.2C41.3 101.5 44.7 101.1 46.1 101.8C47.4 102.4 48.2 104.6 48.2 106C48.2 107.4 47.3 109.6 46.1 110.3C44.8 110.9 41.7 110.5 40.5 109.8C39.3 109.1 38.9 107.3 38.8 106C38.8 104.7 38.9 102.9 40.1 102.2Z"/><path class="p" d="M73.1 102.2C74.3 101.5 77.7 101.1 79.1 101.8C80.4 102.4 81.2 104.6 81.2 106C81.2 107.4 80.3 109.6 79.1 110.3C77.8 110.9 74.7 110.5 73.5 109.8C72.3 109.1 71.9 107.3 71.8 106C71.8 104.7 71.9 102.9 73.1 102.2Z"/></g>
</svg>`,
};

// arms: gameplay/arms.js's state; magic(): magic/index.js (stats, honor, info); account: the
// account panel (ui/account.js); name(): the name this device goes by; avatar: your body
// (people/avatar.js), whose hero can be swapped here
export function linkLoadingTabs({ arms, magic = () => null, account = null, name = () => '', avatar = null }) {
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

	// the hero chosen, and a new one: kept at once (people/hero.js); a body already made is made
	// again only once the loading screen is gone (no new body, no new shaders while it loads)
	let pending = null;
	const heroNow = () => pending || safe(() => avatar?.hero, 'male');
	function pickHero(sex) {
		if (!avatar.me) { avatar.setHero(sex).catch(() => {}); return; }
		setHeroChoice(sex);
		if (pending) { pending = sex; return; }
		pending = sex;
		const t = setInterval(() => {
			if (L.active?.()) return;
			clearInterval(t);
			const s = pending; pending = null;
			avatar.setHero(s).catch(() => {});
		}, 500);
	}

	function character(host) {
		const st = safe(() => magic()?.stats?.()), hn = safe(() => magic()?.honor?.()), pts = safe(() => magic()?.info?.()?.points, 0);
		const box = el('div', 'lt-who');
		box.append(el('div', 'lt-name', who()));
		const line = [st ? `Level ${st.level}` : '', hn ? `${hn.title} · ${hn.pts} honor` : ''].filter(Boolean).join(' · ');
		if (line) box.append(el('div', 'lt-line', line));
		if (pts) box.append(el('div', 'lt-quiet', `${pts} skill point${pts > 1 ? 's' : ''} waiting to spend in the world.`));
		host.append(box);
		// your hero or heroine, swapped here and shown at once
		const hero = heroNow();
		if (avatar) {
			const row = el('div', 'lt-heroes');
			row.setAttribute('role', 'group'); row.setAttribute('aria-label', 'Your hero');
			for (const [sex, label] of [['male', 'Male'], ['female', 'Female']]) {
				const b = el('button', '', label);
				b.type = 'button'; b.setAttribute('aria-pressed', String(hero === sex));
				b.onclick = () => { if (heroNow() === sex) return; pickHero(sex); host.replaceChildren(); character(host); };
				row.append(b);
			}
			host.append(row);
		}
		// the doll: head, top and legs to the left, hands, feet and what you hold to the right
		const worn = safe(() => arms.worn?.(), {}), held = safe(() => arms.held?.());
		const doll = el('div', 'lt-doll'), left = el('div', 'lt-side'), right = el('div', 'lt-side'), fig = el('div');
		// (your hero as last pictured on this device, ui/hero-portrait.js; the drawn figure until then)
		const pic = keptPortrait(hero);
		if (pic) { const im = el('img', 'lt-pic'); im.src = pic; im.alt = `Your ${hero === 'female' ? 'heroine' : 'hero'}, in what you wear`; fig.append(im); } else fig.innerHTML = FIGURES[hero] || FIGURES.male;
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
		if (!list.length) { host.append(el('div', 'lt-quiet', 'Take a field contract from Quests on open ground outside town for a first weapon cache. You can also buy at outfitters or recover fallen fighters’ equipment.')); return; }
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

	const tabs = [
		{ id: 'character', label: () => 'Character', render: (host) => { character(host); } },
		{ id: 'inventory', label: () => 'Inventory', render: (host) => { inventory(host); } },
	];
	if (account?.embed) tabs.push({
		id: 'account', label: () => 'Account',
		render: (host) => {
			host.classList.add('bl-flush');
			return account.embed(host, {});
		},
	});
	L.tabs(tabs);
	return { tabs, names: () => tabs.map((t) => t.label()) };
}
