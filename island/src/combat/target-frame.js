// The target frame (Josh 2026-10-23: when I target an enemy I see their health, and their mana
// if they have any). Whoever you have marked or locked on (combat/target-focus.js) shows at the
// top of the screen: who they are and what sort (a Nightborn, a bystander, a friend in PvP),
// how far, their rank if they have one (Elite, Rare Elite), their life as a bar with its
// points, the armour still on them as a thin line under it, and a caster's mana as a blue bar.
// The name is red for one fighting you, gold for one who is not, green for one of yours. Each
// blow shows as a pale piece of the bar draining after it (combat/vitals.js chipStep). One that
// falls stays a moment at nothing before the frame goes.
//
// One small panel. On a phone, centred between the corner buttons, and under the boss's bar
// while a boss is up. With a mouse and keyboard (Josh 2026-10-24: smaller, top left) a compact
// one in the top left corner beside ◀ Bard, clear of the column under it and of the boss's bar.
// Hidden with display:none when nobody is targeted (no idle layer over the world: hud.js).

import { vitalsOf, chipStep, rankOf, RANK_LABEL, plainName, lifeText, sortOf, reactionOf } from './vitals.js';

const ICON = {
	creature: '<path d="M6.5 3.5c2.2 4.4 3 9.3 1.8 15.5M11.8 2.8c2 5 2.4 10.6 1 17.4M17 4c1.8 4.2 2.2 8.8 1 14.2"/>',
	person: '<circle cx="12" cy="8" r="3.6"/><path d="M4.8 20.5c.9-4.2 3.7-6.6 7.2-6.6s6.3 2.4 7.2 6.6"/>',
	vehicle: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.4"/><path d="M12 4v5.6M4.9 15.6l4.9-2.4M19.1 15.6l-4.9-2.4"/>',
	remote: '<path d="M4 4l11 11M20 4L9 15M6.5 15.5l2 2M17.5 15.5l-2 2M5 19l2.5-2.5M19 19l-2.5-2.5"/>',
	boss: '<path d="M12 3c-4.4 0-7.5 3-7.5 7 0 2.4 1.1 4 2.6 5v3h9.8v-3c1.5-1 2.6-2.6 2.6-5 0-4-3.1-7-7.5-7z"/><circle cx="9.2" cy="10.6" r="1.6"/><circle cx="14.8" cy="10.6" r="1.6"/><path d="M10 18v3M14 18v3"/>',
};
export const iconOf = (T) => (T?.ref?.cr ? 'creature' : T?.kind === 'remote' ? 'remote' : T?.kind === 'vehicle' || T?.kind === 'car' ? 'vehicle' : T?.kind === 'boss' ? 'boss' : 'person');
const RC = { hostile: '#ff8a72', neutral: '#ffd27a', friendly: '#9ff0d4' };
const HP = { hostile: 'linear-gradient(180deg,#ff7a5a,#c8302a)', neutral: 'linear-gradient(180deg,#ffd77a,#cf922a)', friendly: 'linear-gradient(180deg,#86f0c6,#2fae7e)' };

// the desktop frame: its left edge (clear of ◀ Bard, 12 + 74 px wide) and width, in px
const DESK_LEFT = 100, DESK_W = 236;
const CSS = `
.tf{position:absolute;left:50%;top:calc(46px + var(--l99-top, env(safe-area-inset-top)));transform:translateX(-50%);width:min(320px,calc(100% - 156px));box-sizing:border-box;display:none;align-items:center;gap:9px;padding:7px 11px 7px 7px;border-radius:14px;background:rgba(10,18,22,.74);box-shadow:0 0 0 1px rgba(255,255,255,.12),0 4px 16px rgba(0,0,0,.35);z-index:5;pointer-events:none;font:600 13px/1.2 var(--bard-display,system-ui,sans-serif);color:#eef6f4;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.tf.boss{top:calc(128px + var(--l99-top, env(safe-area-inset-top)))}
.tf .em{flex:0 0 40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:var(--rc);background:radial-gradient(circle at 50% 32%,#1f3a44,#0a1418 72%);box-shadow:inset 0 0 0 2px var(--ring),0 0 9px var(--glow)}
.tf .em svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
.tf .co{flex:1;min-width:0}
.tf .hd{display:flex;align-items:center;gap:6px}
.tf .nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--rc);letter-spacing:.3px}
.tf .rk{display:none;flex:none;font:700 9px/1 var(--bard-display,system-ui,sans-serif);letter-spacing:1px;text-transform:uppercase;color:#ffd257;padding:3px 5px 2px;border-radius:6px;box-shadow:inset 0 0 0 1px rgba(255,210,87,.6);text-shadow:none}
.tf .br{position:relative;height:12px;margin-top:4px;border-radius:4px;background:rgba(0,0,0,.5);overflow:hidden;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.tf .br i{position:absolute;left:0;top:0;bottom:0;width:100%;transform-origin:left}
.tf .br .c{background:rgba(255,236,214,.88)}
.tf .br b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:700 9.5px/1 var(--bard-body,system-ui,sans-serif);letter-spacing:.4px;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.9)}
.tf .ar{display:none;height:2px;margin-top:2px;border-radius:1px;background:rgba(0,0,0,.45);overflow:hidden}
.tf .ar i{display:block;height:100%;width:100%;transform-origin:left;background:#7fc8ff}
.tf .mn{display:none;height:8px;margin-top:3px}
.tf .mn .f{background:linear-gradient(180deg,#8aa6ff,#3e5ee0)}
.tf .mn b{font-size:7.5px}
.tf .sb{margin-top:4px;font:500 10.5px/1.2 var(--bard-body,system-ui,sans-serif);opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#l99-island-mount:not(.l99-touch) .tf,#l99-island-mount:not(.l99-touch) .tf.boss{left:calc(${DESK_LEFT}px + env(safe-area-inset-left));top:calc(12px + var(--l99-top, env(safe-area-inset-top)));transform:none;width:${DESK_W}px;gap:7px;padding:5px 9px 5px 5px;border-radius:11px;font-size:11.5px}
#l99-island-mount:not(.l99-touch) .tf .em{flex-basis:30px;height:30px}
#l99-island-mount:not(.l99-touch) .tf .em svg{width:16px;height:16px}
#l99-island-mount:not(.l99-touch) .tf .rk{font-size:8px;padding:2px 4px 1px}
#l99-island-mount:not(.l99-touch) .tf .br{height:10px;margin-top:3px}
#l99-island-mount:not(.l99-touch) .tf .br b{font-size:8.5px}
#l99-island-mount:not(.l99-touch) .tf .mn{height:7px}
#l99-island-mount:not(.l99-touch) .tf .mn b{font-size:6.5px}
#l99-island-mount:not(.l99-touch) .tf .sb{margin-top:2px;font-size:9.5px}
`;
const STYLE_ID = 'tf-style';
// how long one that fell stays on the frame at nothing, in s
const FALL_HOLD = 1.1;

export function createTargetFrame({ mount, target, hostile = () => false, eye }) {
	if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
	const el = document.createElement('div'); el.className = 'tf';
	el.setAttribute('role', 'status'); el.setAttribute('aria-label', 'Target');
	el.innerHTML = '<div class="em"><svg viewBox="0 0 24 24" aria-hidden="true"></svg></div><div class="co"><div class="hd"><span class="nm"></span><span class="rk"></span></div>'
		+ '<div class="br hp"><i class="c"></i><i class="f"></i><b></b></div><div class="ar"><i></i></div><div class="br mn"><i class="c"></i><i class="f"></i><b></b></div><div class="sb"></div></div>';
	const q = (s) => el.querySelector(s);
	const E = { em: q('.em'), icon: q('.em svg'), name: q('.nm'), rank: q('.rk'), hp: q('.hp'), hpChip: q('.hp .c'), hpFill: q('.hp .f'), hpText: q('.hp b'), ar: q('.ar'), arFill: q('.ar i'), mn: q('.mn'), mnChip: q('.mn .c'), mnFill: q('.mn .f'), mnText: q('.mn b'), sub: q('.sb') };
	mount.appendChild(el);
	const k = {};
	const set = (key, v, fn) => { if (k[key] !== v) { k[key] = v; fn(v); } };
	let shownT = null, fallen = 0, hpChip = {}, mnChip = {};
	// (on a narrow screen the feed of who fell to whom, top right, would run under the frame:
	// it drops below it while the frame is up, combat/hud.js --l99-feed-top)
	const feedTop = (v) => { if (mount.style.getPropertyValue('--l99-feed-top') !== v) { if (v) mount.style.setProperty('--l99-feed-top', v); else mount.style.removeProperty('--l99-feed-top'); } };
	function hide() { shownT = null; fallen = 0; set('on', false, () => { el.style.display = 'none'; feedTop(''); k.feed = ''; }); }
	function update(dt, { show = true, boss = false } = {}) {
		let T = show ? target?.() || null : null;
		if (T) fallen = 0;
		// (the one you had, fallen: held a moment at nothing)
		else if (shownT && show && fallen < FALL_HOLD) {
			const v = vitalsOf(shownT);
			if (shownT.ref?.dead || (v && v.hp <= 0)) { fallen += dt; T = shownT; }
		}
		if (!T || fallen >= FALL_HOLD) { hide(); return; }
		if (T !== shownT) { hpChip = {}; mnChip = {}; shownT = T; }
		set('on', true, () => { el.style.display = 'flex'; });
		set('boss', boss, (b) => el.classList.toggle('boss', b));
		set('feed', innerWidth < 760 ? (boss ? '200px' : '118px') : '', feedTop);
		const dead = fallen > 0, re = reactionOf(T, hostile), rank = rankOf(T), v = vitalsOf(T);
		set('re', re, (r) => { el.style.setProperty('--rc', RC[r]); E.hpFill.style.background = HP[r]; });
		set('ring', rank ? 'rank' : re, (r) => { el.style.setProperty('--ring', r === 'rank' ? '#ffd257' : RC[r] + 'aa'); el.style.setProperty('--glow', r === 'rank' ? 'rgba(255,210,87,.45)' : 'transparent'); });
		set('icon', iconOf(T), (i) => { E.icon.innerHTML = ICON[i]; });
		set('name', plainName(T.name), (s) => { E.name.textContent = s; });
		set('rank', rank ? RANK_LABEL[rank] || '' : '', (s) => { E.rank.textContent = s; E.rank.style.display = s ? 'inline-block' : 'none'; });
		const e = eye(), d = Math.round(Math.hypot(T.bound.x - e.x, T.bound.y - e.y, T.bound.z - e.z));
		set('sub', [sortOf(T), dead ? 'Fallen' : `${d} m`].filter(Boolean).join(' · '), (s) => { E.sub.textContent = s; });
		// life: the bar, its pale lag, its points
		set('hasHp', !!v, (h) => { E.hp.style.display = h ? '' : 'none'; });
		const f = dead ? 0 : v ? v.frac : 0;
		if (v) {
			set('hpF', f.toFixed(3), (s) => { E.hpFill.style.transform = `scaleX(${s})`; });
			set('hpC', chipStep(hpChip, f, dt).toFixed(3), (s) => { E.hpChip.style.transform = `scaleX(${s})`; });
			set('hpT', dead ? (v.pct ? '0%' : `0 / ${Math.round(v.max).toLocaleString('en-US')}`) : lifeText(v), (s) => { E.hpText.textContent = s; });
		}
		// armour still on them
		const ar = v && v.armourMax > 0 && !dead;
		set('hasAr', !!ar, (a) => { E.ar.style.display = a ? 'block' : 'none'; });
		if (ar) set('arF', (v.armour / v.armourMax).toFixed(3), (s) => { E.arFill.style.transform = `scaleX(${s})`; });
		// a caster's mana
		const mn = v && v.manaMax > 0;
		set('hasMn', !!mn, (m) => { E.mn.style.display = m ? 'block' : 'none'; });
		if (mn) {
			const mf = dead ? 0 : v.mana / v.manaMax;
			set('mnF', mf.toFixed(3), (s) => { E.mnFill.style.transform = `scaleX(${s})`; });
			set('mnC', chipStep(mnChip, mf, dt).toFixed(3), (s) => { E.mnChip.style.transform = `scaleX(${s})`; });
			set('mnT', v.pct ? `${Math.round(mf * 100)}%` : `${Math.floor(dead ? 0 : v.mana)} / ${Math.round(v.manaMax)}`, (s) => { E.mnText.textContent = s; });
		}
	}
	return {
		update, hide, el,
		info: () => ({ shown: k.on === true, name: k.name || null, rank: k.rank || null, reaction: k.re || null, sub: k.sub || null, life: k.hasHp ? +k.hpF : null, lifeText: k.hasHp ? k.hpT : null, armour: k.hasAr ? +k.arF : null, mana: k.hasMn ? +k.mnF : null, manaText: k.hasMn ? k.mnT : null, belowBoss: !!k.boss }),
		dispose() { el.remove(); },
	};
}
