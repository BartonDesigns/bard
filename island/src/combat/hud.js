// The fight on screen, kept small: a thin health bar (armour above it), the magazine and reserve
// with the fire mode, a crosshair that opens with the spread and flashes a hit marker, wedges
// round it pointing to where a blow came from, a boss's bar across the top with its phase, the
// wanted stars, short call-outs, and on a touch screen Fire, Reload and Mode buttons by the
// thumb. Shown only when it matters (a weapon in hand, a fight on, a recent hit).

const CSS = `
.cb-hud{position:absolute;inset:0;pointer-events:none;z-index:5;font:600 13px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;color:#eef6f4;text-shadow:0 1px 2px rgba(0,0,0,.6)}
.cb-x{position:absolute;left:50%;top:50%;width:0;height:0;transition:opacity .15s}
.cb-x i{position:absolute;background:rgba(240,250,248,.92);box-shadow:0 0 2px rgba(0,0,0,.7)}
.cb-x i.h{width:9px;height:2px;top:-1px}.cb-x i.v{width:2px;height:9px;left:-1px}
.cb-x b{position:absolute;left:-1.5px;top:-1.5px;width:3px;height:3px;border-radius:50%;background:rgba(240,250,248,.9)}
.cb-hit{position:absolute;left:50%;top:50%;width:26px;height:26px;margin:-13px 0 0 -13px;opacity:0;transition:opacity .12s}
.cb-hit i{position:absolute;left:12px;top:0;width:2px;height:8px;background:#fff;box-shadow:0 0 3px rgba(0,0,0,.6)}
.cb-dmg{position:absolute;left:50%;top:50%;width:0;height:0}
.cb-dmg i{position:absolute;left:-34px;top:-118px;width:68px;height:22px;border-radius:50% 50% 0 0/100% 100% 0 0;border-top:4px solid rgba(255,90,60,.9);opacity:0;transform-origin:34px 118px;filter:drop-shadow(0 0 4px rgba(255,60,30,.7))}
.cb-edge{position:absolute;inset:0;opacity:0;background:radial-gradient(ellipse at center,rgba(0,0,0,0) 55%,rgba(150,30,20,.55) 100%);transition:opacity .25s}
.cb-hp{position:absolute;left:50%;bottom:calc(var(--l99-low,88px) + 86px + env(safe-area-inset-bottom));transform:translateX(-50%);width:min(260px,52vw);opacity:0;transition:opacity .4s}
.cb-bar{height:5px;border-radius:3px;background:rgba(10,16,20,.55);overflow:hidden;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
.cb-bar>div{height:100%;width:100%;transform-origin:left;transition:transform .12s}
.cb-hp .cb-arm{height:3px;margin-bottom:3px}.cb-hp .cb-arm>div{background:#7fc8ff}.cb-hp .cb-life>div{background:linear-gradient(90deg,#4fe0a8,#b8f5d6)}
.cb-hp.low .cb-life>div{background:linear-gradient(90deg,#ff6a4a,#ffb08a)}
.cb-ammo{position:absolute;right:calc(84px + env(safe-area-inset-right));bottom:calc(var(--l99-low,88px) + 14px + env(safe-area-inset-bottom));text-align:right;opacity:0;transition:opacity .3s}
.cb-ammo .n{font:700 30px/1 system-ui,sans-serif;letter-spacing:.5px}.cb-ammo .r{font-size:15px;opacity:.75;margin-left:4px}
.cb-ammo .w{font-size:11px;opacity:.75;letter-spacing:.6px;text-transform:uppercase;margin-top:3px}
.cb-ammo.low .n{color:#ffb08a}.cb-ammo .rl{font-size:12px;color:#ffd27a;height:14px}
.cb-boss{position:absolute;left:50%;top:calc(58px + env(safe-area-inset-top));transform:translateX(-50%);width:min(560px,78vw);opacity:0;transition:opacity .5s;text-align:center}
.cb-boss .t{font:700 15px/1.3 system-ui,sans-serif;letter-spacing:1.5px;text-transform:uppercase}
.cb-boss .p{font-size:11px;opacity:.8;letter-spacing:1px;margin-bottom:4px;text-transform:uppercase}
.cb-boss .cb-bar{height:8px;position:relative}.cb-boss .cb-bar>div{background:linear-gradient(90deg,#ff7a4a,#ffd07a)}
.cb-boss .cb-bar>s{position:absolute;top:0;bottom:0;width:2px;background:rgba(0,0,0,.6)}
.cb-boss .ph{font:700 22px/1.3 system-ui,sans-serif;letter-spacing:2px;color:#ffd07a;opacity:0;transition:opacity .4s;margin-top:10px;text-transform:uppercase}
.cb-star{position:absolute;right:calc(70px + env(safe-area-inset-right));top:calc(16px + env(safe-area-inset-top));font-size:18px;letter-spacing:2px;opacity:0;transition:opacity .4s}
.cb-star .on{color:#ffd24a;text-shadow:0 0 6px rgba(255,180,40,.8)}.cb-star .off{color:rgba(255,255,255,.25)}
.cb-calls{position:absolute;left:calc(14px + env(safe-area-inset-left));top:40%;display:flex;flex-direction:column;gap:4px;max-width:46vw}
.cb-calls div{background:rgba(10,16,20,.5);padding:4px 8px;border-radius:6px;font-weight:500;transition:opacity .6s}
.cb-ko{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(6,10,14,.55);opacity:0;transition:opacity .5s;font:700 22px system-ui,sans-serif;letter-spacing:2px}
.cb-ko small{font:500 13px system-ui,sans-serif;letter-spacing:0;opacity:.8;margin-top:8px}
.cb-btn{position:absolute;pointer-events:auto;border-radius:50%;border:1px solid rgba(255,255,255,.28);background:rgba(10,16,20,.45);color:#eafaf6;display:none;align-items:center;justify-content:center;touch-action:none;font:700 12px system-ui,sans-serif;user-select:none;-webkit-user-select:none}
.cb-btn.on{background:rgba(255,120,80,.45)}
`;
const STYLE_ID = 'cb-hud-style';

export function createHud({ mount, touch = false }) {
	if (!document.getElementById(STYLE_ID)) { const s = document.createElement('style'); s.id = STYLE_ID; s.textContent = CSS; document.head.appendChild(s); }
	const el = (cls, html = '', parent = root) => { const e = document.createElement('div'); e.className = cls; e.innerHTML = html; parent.appendChild(e); return e; };
	const root = document.createElement('div');
	root.className = 'cb-hud';
	mount.appendChild(root);
	const edge = el('cb-edge');
	const cross = el('cb-x', '<i class="h"></i><i class="h"></i><i class="v"></i><i class="v"></i><b></b>');
	const arms = [...cross.querySelectorAll('i')];
	const hit = el('cb-hit', [45, 135, 225, 315].map((a) => `<i style="transform:rotate(${a}deg);transform-origin:1px 13px"></i>`).join(''));
	const dmg = el('cb-dmg', '<i></i><i></i><i></i><i></i>');
	const wedges = [...dmg.querySelectorAll('i')].map((e) => ({ e, t: 0, a: 0 }));
	const hp = el('cb-hp', '<div class="cb-bar cb-arm"><div></div></div><div class="cb-bar cb-life"><div></div></div>');
	const hpArm = hp.querySelector('.cb-arm>div'), hpLife = hp.querySelector('.cb-life>div'), hpArmBar = hp.querySelector('.cb-arm');
	const ammo = el('cb-ammo', '<div class="rl"></div><span class="n">0</span><span class="r">/ 0</span><div class="w"></div>');
	const aN = ammo.querySelector('.n'), aR = ammo.querySelector('.r'), aW = ammo.querySelector('.w'), aRl = ammo.querySelector('.rl');
	const boss = el('cb-boss', '<div class="t"></div><div class="p"></div><div class="cb-bar"><div></div></div><div class="ph"></div>');
	const bT = boss.querySelector('.t'), bP = boss.querySelector('.p'), bBar = boss.querySelector('.cb-bar'), bFill = bBar.querySelector('div'), bPh = boss.querySelector('.ph');
	const star = el('cb-star');
	const calls = el('cb-calls');
	const ko = el('cb-ko', 'KNOCKED OUT<small></small>');
	const koSmall = ko.querySelector('small');

	// touch: Fire under the right thumb, Reload and Mode beside it
	const btns = {};
	const mkBtn = (name, label, css) => {
		const b = document.createElement('button');
		b.type = 'button'; b.className = 'cb-btn'; b.textContent = label; b.setAttribute('aria-label', name);
		b.style.cssText = css;
		mount.appendChild(b);
		btns[name] = b;
		return b;
	};
	if (touch) {
		mkBtn('Fire', '', 'right:calc(16px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + 160px + env(safe-area-inset-bottom));width:72px;height:72px;');
		btns.Fire.innerHTML = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2.5" fill="currentColor"/></svg>';
		mkBtn('Reload', 'R', 'right:calc(96px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + 176px + env(safe-area-inset-bottom));width:44px;height:44px;');
		mkBtn('Mode', 'AUTO', 'right:calc(96px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 88px) + 226px + env(safe-area-inset-bottom));width:44px;height:44px;font-size:9px;');
	}

	let hitT = 0, kill = false, edgeT = 0, shownHp = 0, bossPhT = 0, lastStars = -1;
	const callList = [];
	return {
		root, btns,
		// a hit landed: kill true for the last one
		hit(k = false) { hitT = 0.22; kill = k; },
		// struck: from the angle (radians, 0 ahead, clockwise) and how hard (0..1)
		hurt(angle, k = 0.5) {
			const w = wedges.reduce((a, b) => (a.t < b.t ? a : b));
			w.t = 1.2; w.a = angle; w.k = k;
			edgeT = Math.max(edgeT, 0.35 + k * 0.6);
		},
		call(text, ms = 2600) {
			const d = document.createElement('div'); d.textContent = text; calls.appendChild(d);
			callList.push({ d, t: ms / 1000 });
			while (callList.length > 4) callList.shift().d.remove();
		},
		phase(name) { bPh.textContent = name; bossPhT = 2.8; },
		// once a frame: S = { show, spread (px), health: { hp, max, armour, armourMax }, weapon: {
		// name, mag, reserve, mode, reloading }, boss: { name, phase, frac, notches }, stars, ko }
		update(dt, S) {
			root.style.display = S.show ? '' : 'none';
			const vis = S.show && !S.ko;
			cross.style.opacity = vis && S.weapon && !S.aiming ? '1' : vis && S.weapon ? '0.35' : '0';
			const g = Math.max(3, Math.min(60, S.spread || 4));
			arms[0].style.left = `${-g - 9}px`; arms[1].style.left = `${g}px`; arms[2].style.top = `${-g - 9}px`; arms[3].style.top = `${g}px`;
			hitT = Math.max(0, hitT - dt);
			hit.style.opacity = hitT > 0 ? '1' : '0';
			for (const i of hit.children) i.style.background = kill ? '#ff8a5a' : '#fff';
			hit.style.transform = `scale(${1 + hitT * (kill ? 2.4 : 1.2)})`;
			for (const w of wedges) {
				w.t = Math.max(0, w.t - dt);
				w.e.style.opacity = String(Math.min(1, w.t) * (0.5 + 0.5 * (w.k || 0.5)));
				w.e.style.transform = `rotate(${w.a}rad)`;
			}
			edgeT = Math.max(0, edgeT - dt * 0.8);
			const H = S.health;
			const low = H && H.hp / H.max < 0.3;
			edge.style.opacity = String(Math.min(0.9, edgeT + (low && !S.ko ? 0.25 + 0.15 * Math.sin(performance.now() / 260) : 0)));
			const showHp = !!H && vis && (S.weapon || H.hp < H.max || S.boss || S.stars > 0);
			shownHp += ((showHp ? 1 : 0) - shownHp) * Math.min(1, dt * 4);
			hp.style.opacity = shownHp.toFixed(2);
			if (H) {
				hpLife.style.transform = `scaleX(${Math.max(0, H.hp / H.max).toFixed(3)})`;
				hpArmBar.style.display = H.armourMax > 0 ? '' : 'none';
				if (H.armourMax > 0) hpArm.style.transform = `scaleX(${Math.max(0, H.armour / H.armourMax).toFixed(3)})`;
				hp.classList.toggle('low', !!low);
			}
			const W = S.weapon;
			ammo.style.opacity = vis && W ? '1' : '0';
			if (W) {
				aN.textContent = W.mag; aR.textContent = `/ ${W.reserve}`;
				aW.textContent = `${W.name}${W.modes > 1 ? ' · ' + W.mode : ''}`;
				ammo.classList.toggle('low', W.mag <= Math.ceil(W.max * 0.25));
				aRl.textContent = W.reloading ? 'Reloading…' : W.mag === 0 ? (W.reserve ? (touch ? 'Tap R to reload' : 'Press R to reload') : 'No ammo · buy a box at a shop') : '';
				if (btns.Mode) { btns.Mode.textContent = W.mode.toUpperCase(); btns.Mode.style.display = vis && W.modes > 1 ? 'flex' : 'none'; }
			}
			if (btns.Fire) { const on = vis && !!W; btns.Fire.style.display = btns.Reload.style.display = on ? 'flex' : 'none'; if (!on && btns.Mode) btns.Mode.style.display = 'none'; }
			const B = S.boss;
			boss.style.opacity = B && !S.ko ? '1' : '0';
			if (B) {
				if (bT.textContent !== B.name) { bT.textContent = B.name; bBar.querySelectorAll('s').forEach((s) => s.remove()); for (const n of B.notches || []) { const s = document.createElement('s'); s.style.left = `${n * 100}%`; bBar.appendChild(s); } }
				bP.textContent = B.phase;
				bFill.style.transform = `scaleX(${Math.max(0, B.frac).toFixed(3)})`;
			}
			bossPhT = Math.max(0, bossPhT - dt);
			bPh.style.opacity = bossPhT > 0 ? String(Math.min(1, bossPhT)) : '0';
			if (S.stars !== lastStars) { lastStars = S.stars; star.innerHTML = [1, 2, 3, 4, 5].map((i) => `<span class="${i <= S.stars ? 'on' : 'off'}">★</span>`).join(''); }
			star.style.opacity = S.stars > 0 && !S.ko ? '1' : '0';
			for (let i = callList.length - 1; i >= 0; i--) { const c = callList[i]; c.t -= dt; c.d.style.opacity = String(Math.min(1, c.t * 2)); if (c.t <= 0) { c.d.remove(); callList.splice(i, 1); } }
			ko.style.opacity = S.ko ? '1' : '0';
			if (S.ko) koSmall.textContent = S.koText || '';
		},
		dispose() { root.remove(); for (const b of Object.values(btns)) b.remove(); },
	};
}
