// The SKY & WORLD panel, moved out of main.js's createIslandWorld: your hero, the music, the
// kinetic rig, the weather, the constellation lines, the quality and the rest, made again whenever
// one of them changes.
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
import { ULTRA } from './world/device.js';

export function islandPanel(iw) {
	const { applyQuality, autoMusic, avatar, buildPanel, css, dom, guide, hint, isPhone, legacyLaunch,
		placeKinetic, replayKinetic, shared, slider } = iw;
	const p = dom.panel;
	p.replaceChildren();
	const title = css(document.createElement('div'), 'font-weight:700;letter-spacing:.06em;margin-bottom:8px;');
	title.textContent = 'SKY & WORLD';
	p.appendChild(title);
	// your hero: a man or a woman (people/hero.js), made again where you stand
	const heroL = css(document.createElement('div'), 'opacity:.9;margin-bottom:4px;'); heroL.textContent = 'Your hero';
	const heroRow = css(document.createElement('div'), 'display:flex;gap:6px;margin-bottom:12px;');
	heroRow.setAttribute('role', 'group'); heroRow.setAttribute('aria-label', 'Your hero');
	for (const [sex, label] of [['male', 'Male'], ['female', 'Female']]) {
		const on = avatar.hero === sex;
		const b = css(document.createElement('button'), 'flex:1;min-height:44px;border-radius:9px;border:1px solid ' + (on ? '#01a982' : 'rgba(255,255,255,.25)') + ';background:' + (on ? '#01a982' : 'transparent') + ';color:#fff;font:600 13px system-ui;cursor:pointer;');
		b.textContent = label; b.setAttribute('aria-pressed', String(on));
		b.onclick = () => { if (avatar.hero === sex) return; avatar.setHero(sex).catch(() => {}); hint(`Your hero: ${label.toLowerCase()}. Friends see the change the next time you join a room.`, 2600, 1); buildPanel(); };
		heroRow.appendChild(b);
	}
	p.append(heroL, heroRow);
	const combatHelp = document.createElement('p'); combatHelp.style.cssText = 'font:12px/1.5 system-ui;opacity:.85'; combatHelp.textContent = 'Combat: click or Q strikes immediately. Shift + click/Q charges a heavy; release to strike. J grabs or throws. Touch: Strike or hold Heavy. L or middle mouse locks a target; Shift + L cycles. Tap Lock / Next on touch. Target markers do not steer your aim. Hold C to crouch (lower, harder to hit); C while sprinting slides. Keys 1 to 5 take up your weapons (again puts it away), 6 to 0 cast your spells, N opens the spellbook. Alt / Option frees the mouse to look about by dragging; a double tap of Alt / Option returns to aiming.'; p.appendChild(combatHelp);
	const aim = slider(p, 'Aim sensitivity', 50, 200, 5,
		() => Math.round(shared.aimSensitivity * 100),
		(percent) => { shared.aimSensitivity = saveAimSensitivity(percent / 100); },
		(percent) => `${percent}%`);
	aim.input.setAttribute('aria-label', 'Aim sensitivity');
	aim.input.style.minHeight = '44px';
	aim.input.style.touchAction = 'none';
	const aimNote = css(document.createElement('div'), 'font-size:12px;opacity:.75;margin:-6px 0 12px;');
	aimNote.textContent = 'Mouse and touch · Default 115%';
	p.appendChild(aimNote);
	// a touch screen: invert up and down, and the gyro (ui/touch-look.js)
	if (dom.mount.classList.contains('l99-touch')) touchLookRows(p, () => css(document.createElement('button'), 'width:100%;min-height:44px;margin-bottom:8px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#eafaf6;font:13px system-ui;cursor:pointer;'));
	if (iw.origin) {
		const galaxy = css(document.createElement('button'), 'width:100%;min-height:38px;margin-bottom:10px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#eafaf6;font:13px system-ui;cursor:pointer;');
		galaxy.textContent = 'Explore galaxy';
		galaxy.onclick = () => { dom.panel.style.display = 'none'; legacyLaunch(); };
		p.appendChild(galaxy);
	}
	const musicMode = css(document.createElement('button'), 'width:100%;min-height:38px;margin-bottom:10px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#eafaf6;font:13px system-ui;cursor:pointer;');
	const on = !!window.L99Continuity?.musicMode?.();
	musicMode.textContent = `Music guides wildlife: ${on ? 'on' : 'off'}`;
	musicMode.setAttribute('aria-pressed', String(on));
	musicMode.onclick = () => { window.L99Continuity?.musicMode?.(!on); buildPanel(); };
	p.appendChild(musicMode);
	const rigTitle = css(document.createElement('div'), 'margin:8px 0;font-weight:600;');
	rigTitle.textContent = 'Kinetic instruments'; p.appendChild(rigTitle);
	const rig = iw.world.kinetic.state();
	const kinds = [['garden', 'Bounce garden'], ['pendulum', 'Pendulum wave'], ['dominoes', 'Domino spiral'], ['chimes', 'Chime tree'], ['cradle', 'Newton’s cradle'], ['droplets', 'Droplet pool'], ['harp', 'Gravity harp'], ['stairs', 'Plinko staircase'], ['fountain', 'Ball fountain'], ['wavebars', 'Kinetic wave']];
	const choice = css(document.createElement('select'), 'width:100%;min-height:38px;border-radius:9px;background:#16332e;color:#eafaf6;padding:5px;margin-bottom:6px;');
	choice.name = 'kinetic-instrument'; choice.setAttribute('aria-label', 'Kinetic instrument');
	for (const [value, label] of kinds) { const o = document.createElement('option'); o.value = value; o.textContent = label; choice.appendChild(o); }
	choice.value = iw.world.kineticChoice || rig.kind || 'garden';
	choice.onchange = () => { iw.world.kineticChoice = choice.value; };
	p.appendChild(choice);
	const rigRow = css(document.createElement('div'), 'display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;');
	for (const [label, action] of [['Place instrument', () => placeKinetic(choice.value)], ...(rig.kind ? [['Replay', replayKinetic], ['Stop', () => iw.world.kinetic.silence()], ['Clear', () => iw.world.kinetic.clear()]] : [])]) {
		const b = css(document.createElement('button'), 'flex:1;min-height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#eafaf6;font:12px system-ui;cursor:pointer;padding:5px;');
		b.textContent = label; b.onclick = () => { action(); buildPanel(); }; rigRow.appendChild(b);
	}
	p.appendChild(rigRow);
	if (rig.kind) {
		const playing = css(document.createElement('div'), 'opacity:.85;font-size:12px;margin:4px 0 8px;');
		playing.textContent = `${kinds.find(([k]) => k === rig.kind)?.[1] || rig.kind} · ${rig.running ? 'playing' : 'stopped'}`;
		p.appendChild(playing);
		const scale = css(document.createElement('select'), 'width:100%;min-height:36px;border-radius:9px;background:#16332e;color:#eafaf6;padding:5px;margin-bottom:6px;');
		scale.name = 'kinetic-scale'; scale.setAttribute('aria-label', 'Instrument scale');
		for (const [value, label] of [['faceplate', 'Current Bard scale'], ['0', 'Minor pentatonic'], ['1', 'Major pentatonic'], ['2', 'Dorian'], ['3', 'Whole tone']]) { const o = document.createElement('option'); o.value = value; o.textContent = label; scale.appendChild(o); }
		scale.value = String(rig.scale); scale.onchange = () => { iw.world.kinetic.configure({ scale: scale.value === 'faceplate' ? 'faceplate' : +scale.value }); buildPanel(); }; p.appendChild(scale);
		if (rig.scale !== 'faceplate') slider(p, 'Pitch offset', -12, 12, 1, () => iw.world.kinetic.state().root, v => iw.world.kinetic.configure({ root: v }), v => `${v > 0 ? '+' : ''}${v} semitones`);
	}
	if (rig.kind === 'garden') {
		slider(p, 'Gravity', .1, 20, .1, () => iw.world.kinetic.state().gravity, v => iw.world.kinetic.configure({ gravity: v }), v => v.toFixed(1));
		slider(p, 'Bounce', 0, .98, .01, () => iw.world.kinetic.state().restitution, v => iw.world.kinetic.configure({ restitution: v }), v => Math.round(v * 100) + '%');
		slider(p, 'Drop height on replay', .1, 4, .1, () => iw.world.kinetic.state().drop, v => iw.world.kinetic.configure({ drop: v }), v => v.toFixed(1));
	}
	if (rig.kind === 'droplets') slider(p, 'Droplet density', .2, 3, .1, () => iw.world.kinetic.state().rain, v => iw.world.kinetic.configure({ rain: v }), v => v.toFixed(1) + '×');
	if (rig.kind === 'garden' || rig.kind === 'dominoes') {
		slider(p, 'Cascade tempo', 30, 240, 1, () => iw.world.kinetic.state().bpm, v => iw.world.kinetic.configure({ bpm: v }), v => `${Math.round(v)} BPM`);
		const sync = css(document.createElement('button'), 'min-height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#eafaf6;margin-bottom:8px;');
		sync.textContent = 'Use track tempo'; sync.onclick = () => { iw.world.kinetic.configure({ bpm: iw.world.music.performance.bpm }); buildPanel(); }; p.appendChild(sync);
	}
	const S = iw.world.sky.state;
	const fmtH = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 60)).padStart(2, '0')}`;
	const t = slider(p, 'Time of day', 0, 23.99, 0.05, () => S.hours, (v) => { S.hours = v; }, fmtH);
	// steps: paused, real time, then 0.1× to 4× of the game clock
	slider(p, 'Time speed', 0, 41, 1, () => S.real ? 1 : S.speed === 0 ? 0 : Math.round(S.speed * 10) + 1,
		(v) => { S.real = v === 1; S.speed = v === 0 ? 0 : v === 1 ? 1 : (v - 1) / 10; },
		(v) => v === 0 ? 'paused' : v === 1 ? 'real time' : ((v - 1) / 10).toFixed(1) + '×');
	// the weather: follow the clock, or hold it; moving a slider holds that one thing
	const WX = iw.world.weather;
	const wrow = css(document.createElement('div'), 'display:flex;gap:4px;margin:4px 0 8px;');
	for (const mode of ['auto', 'clear', 'fair', 'showers', 'storm']) {
		const b = css(document.createElement('button'), 'flex:1;min-height:34px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (WX.state.mode === mode ? '#01a982' : 'transparent') + ';color:#fff;font:11px system-ui;padding:0 2px;');
		b.textContent = mode[0].toUpperCase() + mode.slice(1);
		b.onclick = () => { WX.set(mode); buildPanel(); };
		wrow.appendChild(b);
	}
	const wl = css(document.createElement('div'), 'opacity:.9;margin-top:4px;'); wl.textContent = 'Weather';
	p.append(wl, wrow);
	slider(p, 'Rain', 0, 1, 0.01, () => WX.state.pin.rain ?? WX.state.rainHere, (v) => { WX.pin('rain', v); }, (v) => v < 0.02 ? 'dry' : v < 0.3 ? 'drizzle' : v < 0.7 ? 'shower' : 'downpour');
	slider(p, 'Cloud cover', 0, 1, 0.01, () => iw.world.sky.uniforms.uCloud.value, (v) => { WX.pin('cover', v); iw.world.sky.uniforms.uCloud.value = v; }, (v) => Math.round(v * 100) + '%');
	slider(p, 'Waves', 0, 2, 0.05, () => shared.uWave.value, (v) => { shared.uWave.value = v; iw.world.ocean.userData.uniforms.uWave.value = v; }, (v) => v.toFixed(2));
	// the world's sounds (nature, the city, footsteps, the wolves) under the music: world/soundbus.js
	slider(p, 'World sounds', 0, 1.5, 0.05, () => worldLevel(), (v) => worldLevel(v), (v) => Math.round(v * 100) + '%');
	slider(p, 'Wind', 0, 1.5, 0.05, () => shared.uWind.value, (v) => { WX.pin('wind', v); shared.uWind.value = v; }, (v) => v.toFixed(2));
	// the month the world keeps: today's, or one picked (the hills, the flowers, the leaves, the
	// snow, the sun's path, the birds, the fish, what people wear); remembered
	const ml = css(document.createElement('div'), 'opacity:.9;margin-top:8px;'); ml.textContent = 'Month';
	const sel = css(document.createElement('select'), 'width:100%;min-height:36px;margin-top:4px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:#1a1a1a;color:#fff;padding:0 10px;font:inherit;');
	sel.name = 'world-month'; sel.setAttribute('aria-label', 'Month');
	['Live (today)', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].forEach((t, i) => { const o = document.createElement('option'); o.value = String(i); o.textContent = t; sel.appendChild(o); });
	sel.value = String(monthPicked());
	sel.onchange = () => pickMonth(+sel.value);
	p.append(ml, sel);
	// the constellations' lines drawn faintly among the stars (the real sky has none; off by default)
	const conB = css(document.createElement('button'), 'margin-top:8px;width:100%;min-height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (iw.world.sky.lines() ? '#01a982' : 'transparent') + ';color:#fff;font:600 13px system-ui;cursor:pointer;');
	conB.textContent = iw.world.sky.lines() ? 'CONSTELLATION LINES: ON' : 'CONSTELLATION LINES: OFF';
	conB.onclick = () => { const on = !iw.world.sky.lines(); iw.world.sky.lines(on); try { localStorage.setItem('l99-conlines', on ? '1' : ''); } catch { /* private mode */ } buildPanel(); };
	p.appendChild(conB);
	const q = css(document.createElement('div'), 'display:flex;gap:6px;margin-top:6px;');
	// High or Ultra (phones only: the desktop's full graphics, which a computer has on High). Which
	// meshes and shaders are built is settled at load, so going into or out of Ultra reloads the page.
	for (const mode of isPhone ? ['high', 'ultra'] : []) {
		const b = css(document.createElement('button'), 'flex:1;min-height:36px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (iw.quality === mode ? '#01a982' : 'transparent') + ';color:#fff;font:12px system-ui;');
		b.textContent = mode.toUpperCase();
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
	if (isPhone) p.appendChild(q);
	// the credits the data and the assets ask for where they are shown (OpenStreetMap, CC BY)
	const credit = css(document.createElement('div'), 'margin-top:8px;font:11px system-ui;opacity:.6;line-height:1.35;');
	credit.textContent = 'Terrain: USGS 3DEP, NOAA via AWS Terrain Tiles. Streets, buildings and land use (San Francisco, the East Bay, the Peninsula, Marin and the South Bay): Overture Maps Foundation (CC BY 4.0), © OpenStreetMap contributors (ODbL), Microsoft and Google building footprints. Hair and beards: the MakeHuman team, culturalibre and Rehman Polanski (CC0); Elvaerwyn (CC BY 4.0), via the MakeHuman community.';
	p.appendChild(credit);
	// what the site keeps on this device, by kind, each removable
	storagePanel(p, { activeModel: () => (guide.llm.kind() === 'webllm' ? guide.llm.model() : ''), onModelRemoved: () => guide.llm.useNone() });
	const TM = window.L99TouchMusic175;
	if (TM) {
		const b = css(document.createElement('button'), 'margin-top:10px;width:100%;min-height:38px;border-radius:9px;border:1px solid rgba(255,255,255,.25);background:' + (TM.enabled ? '#01a982' : 'transparent') + ';color:#fff;font:12px system-ui;');
		b.textContent = TM.enabled ? 'PLAY SURFACES: ON' : 'PLAY SURFACES: OFF';
		b.onclick = () => { TM.set(!TM.enabled); buildPanel(); };
		p.appendChild(b);
	}
	autoMusic.panel(p);
	iw.panelClock = t;
}
