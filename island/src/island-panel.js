// The SETTINGS panel (the ☀ button), moved out of main.js's createIslandWorld: full screen, in
// tabs: you (your hero, aim, the controls), the world (the clock, the weather, the month, the
// sky), sound (the music, the world's sounds, the kinetic rig), graphics, your account and
// what the site keeps on this device. Made again whenever one of them changes; the tab you were
// on and how far down it you were are kept.
// The rest of what it uses from main.js's createIslandWorld comes from iw at the top, once per
// call; none of it changes after the world is set up. A name not yet there needs a getter in
// main.js's iw (island/tools/split-contexts.test.mjs checks).
// What changes as the game runs it reaches through iw: origin, panelClock, quality, world. It sets
// panelClock, quality.

import { saveAimSensitivity } from './aim-sensitivity.js';
import { GPU_LITE, clearLite } from './world/gpulite.js';
import { worldLevel } from './world/soundbus.js';
import { monthPicked, pickMonth } from './calendar.js';
import { storagePanel } from './storage.js';
import { touchLookRows } from './ui/touch-look.js';
import { scrollable } from './ui/scroll.js';
import { ULTRA } from './world/device.js';

const TAB_KEY = 'l99-settings-tab';
const TABS = [['player', 'Player'], ['world', 'World'], ['sound', 'Sound'], ['graphics', 'Graphics'], ['account', 'Account'], ['storage', 'Storage']];
const CSS = `
.l99-set{display:flex;flex-direction:column;height:100%;max-width:760px;margin:0 auto;gap:12px;}
.l99-set-head{display:flex;align-items:center;gap:12px;flex:none;}
.l99-set-head b{flex:1;font:700 20px/1.25 system-ui;letter-spacing:.02em;color:#fff;}
.l99-set-x{width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.8);font:16px system-ui;cursor:pointer;flex:none;}
.l99-set-tabs{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:4px;flex:none;border-bottom:1px solid rgba(255,255,255,.1);}
.l99-set-tab{min-height:44px;padding:8px 6px;border:0;border-bottom:3px solid transparent;background:none;color:rgba(255,255,255,.7);font:600 13px system-ui;cursor:pointer;touch-action:manipulation;}
.l99-set-tab[aria-selected="true"]{color:#fff;border-bottom-color:#01a982;}
.l99-set-tab:focus-visible,.l99-set-x:focus-visible{outline:2px solid #01a982;outline-offset:2px;}
.l99-set-body{flex:1;min-height:0;overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,330px),1fr));gap:12px;align-content:start;padding-bottom:12px;}
.l99-set-card{background:#1a1a1a;border:1px solid rgba(255,255,255,.1);border-radius:12px;padding:14px;min-width:0;}
.l99-set-card>h3{margin:0 0 10px;font:600 11px system-ui;letter-spacing:.12em;text-transform:uppercase;color:#a5f6e2;}
.l99-set-note{font:12px/1.5 system-ui;color:rgba(255,255,255,.7);margin:0 0 10px;}
.l99-set-go{width:100%;min-height:44px;border:0;border-radius:8px;background:linear-gradient(135deg,#01a982 0%,#10b981 100%);color:#fff;font:600 14px system-ui;cursor:pointer;box-shadow:0 4px 12px rgba(1,169,130,.3);}
`;

let tab = (() => { try { const t = localStorage.getItem(TAB_KEY); return TABS.some(([k]) => k === t) ? t : 'player'; } catch { return 'player'; } })();

export function islandPanel(iw) {
	const { applyQuality, autoMusic, avatar, buildPanel, css, dom, guide, hint, HOOKS, isPhone, legacyLaunch,
		placeKinetic, replayKinetic, shared, slider } = iw;
	const p = dom.panel;
	if (!document.getElementById('l99-set-css')) { const s = document.createElement('style'); s.id = 'l99-set-css'; s.textContent = CSS; document.head.appendChild(s); }
	// (rebuilt on the same tab: back where you were in it)
	const was = p.querySelector('.l99-set-body');
	const keep = was && was.dataset.tab === tab ? was.scrollTop : 0;
	p.replaceChildren();
	iw.panelClock = null;
	const close = () => { p.style.display = 'none'; };
	const frame = css(document.createElement('div'), '');
	frame.className = 'l99-set';
	const head = document.createElement('div'); head.className = 'l99-set-head';
	const title = document.createElement('b'); title.textContent = 'Settings'; title.id = 'l99-set-title';
	const x = document.createElement('button'); x.type = 'button'; x.className = 'l99-set-x'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close settings');
	x.onclick = (e) => { e.stopPropagation(); close(); };
	head.append(title, x);
	const tabs = document.createElement('div'); tabs.className = 'l99-set-tabs';
	tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-labelledby', 'l99-set-title');
	const pick = (k) => { tab = k; try { localStorage.setItem(TAB_KEY, k); } catch { /* private mode */ } buildPanel(); p.querySelector(`[data-set-tab="${k}"]`)?.focus(); };
	TABS.forEach(([k, label], i) => {
		const b = document.createElement('button');
		b.type = 'button'; b.className = 'l99-set-tab'; b.textContent = label; b.dataset.setTab = k;
		b.id = 'l99-set-tab-' + k; b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'l99-set-body');
		b.setAttribute('aria-selected', String(tab === k)); b.tabIndex = tab === k ? 0 : -1;
		b.onclick = (e) => { e.stopPropagation(); if (tab !== k) pick(k); };
		// (the arrow keys move along the tabs)
		b.onkeydown = (e) => { const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0; if (d) { e.preventDefault(); pick(TABS[(i + d + TABS.length) % TABS.length][0]); } };
		tabs.appendChild(b);
	});
	const body = scrollable(document.createElement('div'));
	body.className = 'l99-set-body'; body.id = 'l99-set-body'; body.dataset.tab = tab;
	body.setAttribute('role', 'tabpanel'); body.setAttribute('aria-labelledby', 'l99-set-tab-' + tab);
	frame.append(head, tabs, body);
	p.appendChild(frame);
	// a card in the tab, under its heading: what the controls are appended to
	const card = (heading) => {
		const c = document.createElement('section'); c.className = 'l99-set-card';
		if (heading) { const h = document.createElement('h3'); h.textContent = heading; c.appendChild(h); }
		body.appendChild(c);
		return c;
	};
	const note = (host, text) => { const n = document.createElement('p'); n.className = 'l99-set-note'; n.textContent = text; host.appendChild(n); return n; };
	const ghost = (extra = '') => css(document.createElement('button'), 'width:100%;min-height:44px;margin-bottom:8px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#eafaf6;font:13px system-ui;cursor:pointer;' + extra);
	({ player, world, sound, graphics, account, storage })[tab]();
	body.scrollTop = keep;

	function player() {
		// your hero: a man or a woman (people/hero.js), made again where you stand
		const c = card('Your hero');
		const heroRow = css(document.createElement('div'), 'display:flex;gap:6px;');
		heroRow.setAttribute('role', 'group'); heroRow.setAttribute('aria-label', 'Your hero');
		for (const [sex, label] of [['male', 'Male'], ['female', 'Female']]) {
			const on = avatar.hero === sex;
			const b = css(document.createElement('button'), 'flex:1;min-height:44px;border-radius:9px;border:1px solid ' + (on ? '#01a982' : 'rgba(255,255,255,.25)') + ';background:' + (on ? '#01a982' : 'transparent') + ';color:#fff;font:600 13px system-ui;cursor:pointer;');
			b.textContent = label; b.setAttribute('aria-pressed', String(on));
			b.onclick = () => { if (avatar.hero === sex) return; avatar.setHero(sex).catch(() => {}); hint(`Your hero: ${label.toLowerCase()}. Friends see the change the next time you join a room.`, 2600, 1); buildPanel(); };
			heroRow.appendChild(b);
		}
		c.append(heroRow);
		const look = card('Aim and look');
		const aim = slider(look, 'Aim sensitivity', 50, 200, 5,
			() => Math.round(shared.aimSensitivity * 100),
			(percent) => { shared.aimSensitivity = saveAimSensitivity(percent / 100); },
			(percent) => `${percent}%`);
		aim.input.setAttribute('aria-label', 'Aim sensitivity');
		aim.input.style.minHeight = '44px';
		aim.input.style.touchAction = 'none';
		const aimNote = css(document.createElement('div'), 'font-size:12px;opacity:.75;margin:-6px 0 12px;');
		aimNote.textContent = 'Mouse and touch · Default 115%';
		look.appendChild(aimNote);
		// a touch screen: invert up and down, and the gyro (ui/touch-look.js)
		if (dom.mount.classList.contains('l99-touch')) touchLookRows(look, () => ghost());
		const help = card('Combat controls');
		note(help, 'Combat: click or Q strikes immediately. Shift + click/Q charges a heavy; release to strike. J grabs or throws. Touch: Strike, or hold Heavy strike (the fist with the lines beside it) to charge one. L or middle mouse locks a target; Shift + L cycles. Tap Lock / Next on touch. Target markers do not steer your aim. Hold C to crouch (lower, harder to hit); C while sprinting slides. Keys 1 to 5 take up your weapons (again puts it away), 6 to 0 cast your spells, N opens the spellbook. Alt / Option frees the mouse to look about by dragging; a double tap of Alt / Option returns to aiming.');
	}

	function world() {
		if (iw.origin) {
			const g = card('Beyond the world');
			const galaxy = ghost('margin-bottom:0;');
			galaxy.textContent = 'Explore galaxy';
			galaxy.onclick = () => { close(); legacyLaunch(); };
			g.appendChild(galaxy);
		}
		const S = iw.world.sky.state;
		const clock = card('Time');
		const fmtH = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
		const t = slider(clock, 'Time of day', 0, 23.99, 0.05, () => S.hours, (v) => { S.hours = v; }, fmtH);
		// steps: paused, real time, then 0.1× to 4× of the game clock
		slider(clock, 'Time speed', 0, 41, 1, () => S.real ? 1 : S.speed === 0 ? 0 : Math.round(S.speed * 10) + 1,
			(v) => { S.real = v === 1; S.speed = v === 0 ? 0 : v === 1 ? 1 : (v - 1) / 10; },
			(v) => v === 0 ? 'paused' : v === 1 ? 'real time' : ((v - 1) / 10).toFixed(1) + '×');
		// the month the world keeps: today's, or one picked (the hills, the flowers, the leaves, the
		// snow, the sun's path, the birds, the fish, what people wear); remembered
		const ml = css(document.createElement('div'), 'opacity:.9;margin-top:8px;'); ml.textContent = 'Month';
		const sel = css(document.createElement('select'), 'width:100%;min-height:44px;margin-top:4px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:#2a2a2a;color:#fff;padding:0 10px;font:inherit;');
		sel.name = 'world-month'; sel.setAttribute('aria-label', 'Month');
		['Live (today)', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].forEach((m, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = m; sel.appendChild(o); });
		sel.value = String(monthPicked());
		sel.onchange = () => pickMonth(+sel.value);
		clock.append(ml, sel);
		iw.panelClock = t;
		// the weather: follow the clock, or hold it; moving a slider holds that one thing
		const WX = iw.world.weather;
		const wx = card('Weather');
		const wrow = css(document.createElement('div'), 'display:flex;gap:4px;margin:0 0 8px;');
		for (const mode of ['auto', 'clear', 'fair', 'showers', 'storm']) {
			const b = css(document.createElement('button'), 'flex:1;min-height:44px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (WX.state.mode === mode ? '#01a982' : 'transparent') + ';color:#fff;font:11px system-ui;padding:0 2px;');
			b.textContent = mode[0].toUpperCase() + mode.slice(1);
			b.setAttribute('aria-pressed', String(WX.state.mode === mode));
			b.onclick = () => { WX.set(mode); buildPanel(); };
			wrow.appendChild(b);
		}
		wx.append(wrow);
		slider(wx, 'Rain', 0, 1, 0.01, () => WX.state.pin.rain ?? WX.state.rainHere, (v) => { WX.pin('rain', v); }, (v) => v < 0.02 ? 'dry' : v < 0.3 ? 'drizzle' : v < 0.7 ? 'shower' : 'downpour');
		slider(wx, 'Cloud cover', 0, 1, 0.01, () => iw.world.sky.uniforms.uCloud.value, (v) => { WX.pin('cover', v); iw.world.sky.uniforms.uCloud.value = v; }, (v) => Math.round(v * 100) + '%');
		slider(wx, 'Waves', 0, 2, 0.05, () => shared.uWave.value, (v) => { shared.uWave.value = v; iw.world.ocean.userData.uniforms.uWave.value = v; }, (v) => v.toFixed(2));
		slider(wx, 'Wind', 0, 1.5, 0.05, () => shared.uWind.value, (v) => { WX.pin('wind', v); shared.uWind.value = v; }, (v) => v.toFixed(2));
		// the constellations' lines drawn faintly among the stars (the real sky has none; off by default)
		const sky = card('Night sky');
		const conB = css(document.createElement('button'), 'width:100%;min-height:44px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (iw.world.sky.lines() ? '#01a982' : 'transparent') + ';color:#fff;font:600 13px system-ui;cursor:pointer;');
		conB.textContent = iw.world.sky.lines() ? 'CONSTELLATION LINES: ON' : 'CONSTELLATION LINES: OFF';
		conB.setAttribute('aria-pressed', String(iw.world.sky.lines()));
		conB.onclick = () => { const on = !iw.world.sky.lines(); iw.world.sky.lines(on); try { localStorage.setItem('l99-conlines', on ? '1' : ''); } catch { /* private mode */ } buildPanel(); };
		sky.appendChild(conB);
	}

	function sound() {
		const mix = card('Music and sounds');
		// the world's sounds (nature, the city, footsteps, the wolves) under the music: world/soundbus.js
		slider(mix, 'World sounds', 0, 1.5, 0.05, () => worldLevel(), (v) => worldLevel(v), (v) => Math.round(v * 100) + '%');
		const musicMode = ghost();
		const on = !!window.L99Continuity?.musicMode?.();
		musicMode.textContent = `Music guides wildlife: ${on ? 'on' : 'off'}`;
		musicMode.setAttribute('aria-pressed', String(on));
		musicMode.onclick = () => { window.L99Continuity?.musicMode?.(!on); buildPanel(); };
		mix.appendChild(musicMode);
		const TM = window.L99TouchMusic175;
		if (TM) {
			const b = css(document.createElement('button'), 'width:100%;min-height:44px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (TM.enabled ? '#01a982' : 'transparent') + ';color:#fff;font:12px system-ui;');
			b.textContent = TM.enabled ? 'PLAY SURFACES: ON' : 'PLAY SURFACES: OFF';
			b.setAttribute('aria-pressed', String(!!TM.enabled));
			b.onclick = () => { TM.set(!TM.enabled); buildPanel(); };
			mix.appendChild(b);
		}
		autoMusic.panel(card('Auto music'));
		kinetic(card('Kinetic instruments'));
	}

	function kinetic(k) {
		const rig = iw.world.kinetic.state();
		const kinds = [['garden', 'Bounce garden'], ['pendulum', 'Pendulum wave'], ['dominoes', 'Domino spiral'], ['chimes', 'Chime tree'], ['cradle', 'Newton’s cradle'], ['droplets', 'Droplet pool'], ['harp', 'Gravity harp'], ['stairs', 'Plinko staircase'], ['fountain', 'Ball fountain'], ['wavebars', 'Kinetic wave']];
		const choice = css(document.createElement('select'), 'width:100%;min-height:44px;border-radius:9px;background:#2a2a2a;color:#eafaf6;padding:5px;margin-bottom:6px;');
		choice.name = 'kinetic-instrument'; choice.setAttribute('aria-label', 'Kinetic instrument');
		for (const [value, label] of kinds) { const o = document.createElement('option'); o.value = value; o.textContent = label; choice.appendChild(o); }
		choice.value = iw.world.kineticChoice || rig.kind || 'garden';
		choice.onchange = () => { iw.world.kineticChoice = choice.value; };
		k.appendChild(choice);
		const rigRow = css(document.createElement('div'), 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;');
		for (const [label, action] of [['Place instrument', () => placeKinetic(choice.value)], ...(rig.kind ? [['Replay', replayKinetic], ['Stop', () => iw.world.kinetic.silence()], ['Clear', () => iw.world.kinetic.clear()]] : [])]) {
			const b = css(document.createElement('button'), 'flex:1;min-height:44px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#eafaf6;font:12px system-ui;cursor:pointer;padding:5px;');
			b.textContent = label; b.onclick = () => { action(); buildPanel(); }; rigRow.appendChild(b);
		}
		k.appendChild(rigRow);
		if (rig.kind) {
			const playing = css(document.createElement('div'), 'opacity:.85;font-size:12px;margin:4px 0 8px;');
			playing.textContent = `${kinds.find(([id]) => id === rig.kind)?.[1] || rig.kind} · ${rig.running ? 'playing' : 'stopped'}`;
			k.appendChild(playing);
			const scale = css(document.createElement('select'), 'width:100%;min-height:44px;border-radius:9px;background:#2a2a2a;color:#eafaf6;padding:5px;margin-bottom:6px;');
			scale.name = 'kinetic-scale'; scale.setAttribute('aria-label', 'Instrument scale');
			for (const [value, label] of [['faceplate', 'Current Bard scale'], ['0', 'Minor pentatonic'], ['1', 'Major pentatonic'], ['2', 'Dorian'], ['3', 'Whole tone']]) { const o = document.createElement('option'); o.value = value; o.textContent = label; scale.appendChild(o); }
			scale.value = String(rig.scale); scale.onchange = () => { iw.world.kinetic.configure({ scale: scale.value === 'faceplate' ? 'faceplate' : +scale.value }); buildPanel(); }; k.appendChild(scale);
			if (rig.scale !== 'faceplate') slider(k, 'Pitch offset', -12, 12, 1, () => iw.world.kinetic.state().root, v => iw.world.kinetic.configure({ root: v }), v => `${v > 0 ? '+' : ''}${v} semitones`);
		}
		if (rig.kind === 'garden') {
			slider(k, 'Gravity', .1, 20, .1, () => iw.world.kinetic.state().gravity, v => iw.world.kinetic.configure({ gravity: v }), v => v.toFixed(1));
			slider(k, 'Bounce', 0, .98, .01, () => iw.world.kinetic.state().restitution, v => iw.world.kinetic.configure({ restitution: v }), v => Math.round(v * 100) + '%');
			slider(k, 'Drop height on replay', .1, 4, .1, () => iw.world.kinetic.state().drop, v => iw.world.kinetic.configure({ drop: v }), v => v.toFixed(1));
		}
		if (rig.kind === 'droplets') slider(k, 'Droplet density', .2, 3, .1, () => iw.world.kinetic.state().rain, v => iw.world.kinetic.configure({ rain: v }), v => v.toFixed(1) + '×');
		if (rig.kind === 'garden' || rig.kind === 'dominoes') {
			slider(k, 'Cascade tempo', 30, 240, 1, () => iw.world.kinetic.state().bpm, v => iw.world.kinetic.configure({ bpm: v }), v => `${Math.round(v)} BPM`);
			const sync = css(document.createElement('button'), 'min-height:44px;padding:0 14px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#eafaf6;margin-bottom:8px;');
			sync.textContent = 'Use track tempo'; sync.onclick = () => { iw.world.kinetic.configure({ bpm: iw.world.music.performance.bpm }); buildPanel(); }; k.appendChild(sync);
		}
	}

	function graphics() {
		const g = card('Graphics');
		if (!isPhone) { note(g, 'This computer always draws the full graphics (High).'); return; }
		note(g, 'High is the phone’s own graphics. Ultra draws the computer’s full graphics: sharper and busier, and it needs more of the phone’s memory. Switching in or out of Ultra reloads the game.');
		const q = css(document.createElement('div'), 'display:flex;gap:6px;');
		q.setAttribute('role', 'group'); q.setAttribute('aria-label', 'Graphics quality');
		// High or Ultra (phones only: the desktop's full graphics, which a computer has on High). Which
		// meshes and shaders are built is settled at load, so going into or out of Ultra reloads the page.
		for (const mode of ['high', 'ultra']) {
			const b = css(document.createElement('button'), 'flex:1;min-height:44px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (iw.quality === mode ? '#01a982' : 'transparent') + ';color:#fff;font:600 13px system-ui;');
			b.textContent = mode.toUpperCase();
			b.setAttribute('aria-pressed', String(iw.quality === mode));
			b.onclick = () => {
				iw.quality = mode;
				try { localStorage.setItem('l99-quality', mode); } catch { /* private mode */ }
				if ((mode === 'ultra') !== ULTRA) {
					if (mode === 'ultra' && GPU_LITE) clearLite();
					const u = new URL(location.href); u.searchParams.delete('lite');
					location.replace(u.href);
					return;
				}
				// high on a device left on the light ground (after a graphics loss): try the full one again
				if (mode === 'high' && GPU_LITE) {
					clearLite();
					const u = new URL(location.href); u.searchParams.delete('lite');
					location.replace(u.href);
					return;
				}
				applyQuality(); buildPanel();
			};
			q.appendChild(b);
		}
		g.appendChild(q);
	}

	// your account (ui/account.js): what is saved, and the way into its panel
	function account() {
		const a = card('Your account');
		const A = HOOKS.account, I = A?.info?.();
		if (!A || !I?.available) { note(a, 'Accounts are not available here. Your progress is kept on this device.'); return; }
		if (I.user) note(a, I.conflict ? `Logged in as ${I.user}. Your account holds progress this device has not loaded yet.` : `Logged in as ${I.user}. Progress saved ${A.ago(I.savedAt)}; it saves by itself every minute while you play.`);
		else note(a, 'Make an account with a username and password. Your skills, honor, gear, quests and home are saved to the cloud, so clearing the browser or changing phones loses nothing.');
		const go = document.createElement('button');
		go.type = 'button'; go.className = 'l99-set-go';
		go.textContent = I.user ? (I.conflict ? 'Load or keep progress' : 'Open your account') : '☁ Save your progress';
		go.onclick = (e) => { e.stopPropagation(); close(); A.open(); };
		a.appendChild(go);
		note(a, 'The ☁ button on screen opens this too.').style.margin = '10px 0 0';
	}

	function storage() {
		// what the site keeps on this device, by kind, each removable
		storagePanel(card(), { activeModel: () => (guide.llm.kind() === 'webllm' ? guide.llm.model() : ''), onModelRemoved: () => guide.llm.useNone() });
		// the credits the data and the assets ask for where they are shown (OpenStreetMap, CC BY)
		const credit = card('Credits');
		note(credit, 'Terrain: USGS 3DEP, NOAA via AWS Terrain Tiles. Streets, buildings and land use (San Francisco, the East Bay, the Peninsula, Marin and the South Bay): Overture Maps Foundation (CC BY 4.0), © OpenStreetMap contributors (ODbL), Microsoft and Google building footprints. Hair and beards: the MakeHuman team, culturalibre and Rehman Polanski (CC0); Elvaerwyn (CC BY 4.0), via the MakeHuman community.').style.margin = '0';
	}
}
