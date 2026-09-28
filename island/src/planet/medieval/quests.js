// Errands for the realm's people. Some of them have something to ask (a mark over their
// heads says so): a ring lost in the crypt, the restless dead of the barrow, bread for the
// miller, the beacons to be lit on the watchtowers, a child lost in the caves. Speak with
// them, say yes, and the quest goes in the log; the tracker at the top points the way.
// Rewards are gold, a keepsake, and for the barrow the realm's own banner.
//
// Fighting is kept simple: a strike (the button, or Q) knocks the dead back, and three
// blows lay one to dust. They hit back; if your strength runs out you wake at the inn,
// where the innkeeper sets you right again.
//
// What you have done is kept in this browser, per world.

import * as THREE from 'three';
import { scrollable } from '../../ui/scroll.js';

const ICON = {
	scroll: '<path d="M7 4h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9"/><path d="M7 4a2 2 0 0 0-2 2v2h4V6a2 2 0 0 0-2-2z"/><path d="M9 20a2 2 0 0 1-2-2V8"/><path d="M11 9h5M11 12h5M11 15h3"/>',
	coin: '<circle cx="12" cy="12" r="8"/><path d="M12 7.5v9M9.5 9.5c0-1 1-1.6 2.5-1.6s2.5.7 2.5 1.7-1 1.4-2.5 1.6-2.5.7-2.5 1.8 1 1.7 2.5 1.7 2.5-.6 2.5-1.6"/>',
	heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
	speak: '<path d="M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-7l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"/><path d="M8 9.5h8M8 12.5h5"/>',
	sword: '<path d="M14.5 3.5 20 3.5 20 9 9.5 19.5 4.5 14.5z"/><path d="M4 20l3-3M7.5 13 11 16.5M3 15l6 6"/>',
	hand: '<path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V11M11 10V5a1.5 1.5 0 0 1 3 0v6M14 10.5V7a1.5 1.5 0 0 1 3 0v7a6 6 0 0 1-6 6h-.5A5.5 5.5 0 0 1 6 17.2L4.5 14a1.6 1.6 0 0 1 2.7-1.6L8 13.5"/>',
	flame: '<path d="M12 21c-3.3 0-6-2.4-6-5.8 0-3.6 3-5.2 3.5-9.2 2.6 1.6 4 4 4 6.2 1-.8 1.6-2 1.8-3.2C17.5 10.8 18 13 18 15.2 18 18.6 15.3 21 12 21z"/>',
	chest: '<rect x="3.5" y="10" width="17" height="9" rx="1"/><path d="M3.5 10V8a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v2M12 12v3M3.5 13h17"/>',
	lever: '<path d="M5 19h14M8 19v-3h8v3M12 16 16 6"/><circle cx="16.5" cy="5" r="1.6"/>',
	arrow: '<path d="M12 3 18 17 12 13.5 6 17z"/>',
	bed: '<path d="M3 18v-8M3 14h18v4M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.8"/>',
	close: '<path d="M6 6l12 12M18 6 6 18"/>',
	banner: '<path d="M7 3v18M7 4h11l-2.5 4L18 12H7"/>',
};
const svg = (k, s = 20) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;
const css = (el, s) => { el.style.cssText = s; return el; };
const GOLD = '#e2bf6a';
const PANEL = 'background:rgba(8,20,26,.84);border:1px solid rgba(255,255,255,.18);color:#e6f6f2;font:13px system-ui;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);';
const BTN = 'min-height:44px;padding:8px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.28);background:rgba(8,20,26,.62);color:#eafaf6;font:600 13px system-ui;touch-action:manipulation;cursor:pointer;display:inline-flex;align-items:center;gap:8px;';
const guard = (el) => { for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) el.addEventListener(ev, (e) => e.stopPropagation(), { passive: true }); return el; };

export function createQuests(R) {
	const { realm, mount, isPhone, hint, camera } = R;
	const KEY = `crysis-realm-${realm.seed}`;
	const S = load();
	function load() {
		let s = null;
		try { s = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* nothing kept */ }
		return Object.assign({ v: 1, gold: 0, hp: 100, items: [], q: {}, beacons: [], opened: {}, lever: false, track: null, cleared: {} }, s || {});
	}
	function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* storage full or off */ } }

	// ---------- the quests this realm can offer ----------
	const D = (id) => R.dungeons.find((d) => d.D.id === id);
	const Q = {};
	const ringIn = D('crypt') || D('cellar') || D('barrow');
	if (ringIn?.props.chest && R.folk.cast.some((c) => c.id === 'widow')) Q.ring = {
		title: 'The Widow\'s Ring', giver: 'widow', where: ringIn,
		offer: `My Aldred's ring. When we laid him down in ${ringIn.D.name.replace(/^The /, 'the ')}, it slipped from my hand into the dark among the old stones, and my knees will not take me down those stairs. Would you look for it? There is an iron-bound chest in the last vault; the sexton said he put what he found in it.`,
		steps: { active: `Find Edith's ring in ${ringIn.D.name}`, ready: 'Bring the ring back to Edith' },
		thanks: 'Oh, you found it. You have given me back a piece of him. Take this, and bless you.',
		reward: { gold: 30, item: 'Silver brooch' },
	};
	const clearIn = D('barrow') || D('crypt') || D('cellar');
	if (clearIn && R.foesIn(clearIn.D.id).length && R.folk.cast.some((c) => c.id === 'captain')) Q.clear = {
		title: 'The Restless Barrow', giver: 'captain', where: clearIn,
		offer: `There is something wrong in ${clearIn.D.name.replace(/^The /, 'the ')}. The shepherds hear bones knocking at night, and a lad swears he saw them walking. My men will not go near. You have the look of someone who will. Drive them out; three good blows and they fall to dust, or so the old songs say.`,
		steps: { active: `Lay the restless dead of ${clearIn.D.name} to rest`, ready: 'Tell Sir Roland it is done' },
		thanks: `Then they sleep again. ${realm.lord} will want to know your name. Here is your purse, and this: our banner, to hang in your own hall.`,
		reward: { gold: 50, item: `The banner of ${realm.name}`, banner: true },
	};
	const deliverTo = R.folk.cast.some((c) => c.id === 'miller') ? 'miller' : 'innkeeper';
	if (R.folk.cast.some((c) => c.id === 'baker')) Q.bread = {
		title: 'Bread for the Mill', giver: 'baker', to: deliverTo,
		offer: deliverTo === 'miller' ? 'Hugh up at the windmill has been grinding since before dawn and will not come down to eat. Would you carry this loaf up to him? It is still warm.' : 'Bess at the inn is short of bread tonight. Would you carry this loaf over to her?',
		steps: { active: deliverTo === 'miller' ? 'Bring the warm loaf to Hugh at the windmill' : 'Bring the loaf to Bess at the inn' },
		thanks: deliverTo === 'miller' ? 'Bread! Mary never forgets me. Here, for your trouble, and a sack of flour to take back down.' : 'Bless her. Here, for your trouble.',
		reward: { gold: 15, item: 'Sack of flour' },
	};
	if (R.beacons.length && R.folk.cast.some((c) => c.id === 'steward')) Q.beacons = {
		title: 'Light the Beacons', giver: 'steward',
		offer: `${realm.lord} returns tonight. When the lord is home the beacons burn on the watchtowers, so every farm in the realm knows it. The watch is short-handed. Would you ride out and light them? There are ${R.beacons.length} of them, on the heights.`,
		steps: { active: 'Light the beacons on the watchtowers', ready: 'Tell Master Osbert the beacons are lit' },
		thanks: 'I saw them from the keep roof, every one. Well done. Take this horn; blow it if you ever need the watch.',
		reward: { gold: 40, item: 'Hunting horn' },
	};
	if (R.lostSpot && R.folk.cast.some((c) => c.id === 'mother')) Q.lost = {
		title: 'Lost in the Dark', giver: 'mother',
		offer: `Have you seen my Wat? He is nine, all elbows. He went off after the others to see ${R.lostSpot.via}, and they came back without him. The old passages run on into the caves under the hill. Please, find him.`,
		steps: { active: `Find Wat in the caves beyond ${R.lostSpot.via}`, lead: 'Bring Wat home to Alys', ready: 'Bring Wat home to Alys' },
		thanks: 'Wat! Oh, you wretched boy, come here. Thank you, thank you. Take this; his father carved it.',
		reward: { gold: 35, item: 'Carved wooden charm' },
	};
	const state = (id) => S.q[id]?.s || 'none';
	const set = (id, s, extra) => { S.q[id] = { ...(S.q[id] || {}), s, ...(extra || {}) }; save(); refresh(); };

	// ---------- the DOM ----------
	const hud = guard(css(document.createElement('div'), 'position:absolute;left:calc(12px + env(safe-area-inset-left));top:calc(64px + env(safe-area-inset-top));display:flex;align-items:center;gap:8px;z-index:4;'));
	const logBtn = css(document.createElement('button'), BTN + 'width:44px;padding:0;justify-content:center;');
	logBtn.type = 'button'; logBtn.title = 'Quest log'; logBtn.setAttribute('aria-label', 'Quest log'); logBtn.innerHTML = svg('scroll', 22);
	const purse = css(document.createElement('div'), 'display:flex;align-items:center;gap:5px;padding:6px 10px;border-radius:12px;' + PANEL + `color:${GOLD};font:600 13px system-ui;`);
	const health = css(document.createElement('div'), 'display:none;align-items:center;gap:6px;padding:6px 10px;border-radius:12px;' + PANEL);
	const hbar = css(document.createElement('div'), 'width:64px;height:7px;border-radius:4px;background:rgba(255,255,255,.14);overflow:hidden;');
	const hfill = css(document.createElement('div'), 'height:100%;width:100%;background:linear-gradient(90deg,#b84a3a,#e0735e);transition:width .25s;');
	hbar.appendChild(hfill);
	health.innerHTML = `<span style="color:#e0735e;display:flex">${svg('heart', 16)}</span>`;
	health.appendChild(hbar);
	hud.append(logBtn, purse, health);
	// the tracker: where the quest you follow is, from here
	const tracker = guard(css(document.createElement('div'), 'position:absolute;left:50%;top:calc(12px + env(safe-area-inset-top));transform:translateX(-50%);display:none;align-items:center;gap:8px;padding:6px 12px;border-radius:14px;max-width:min(calc(100vw - 236px),420px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none;z-index:3;' + PANEL));
	const tArrow = css(document.createElement('span'), `display:flex;color:${GOLD};transition:transform .15s;`);
	tArrow.innerHTML = svg('arrow', 16);
	const tText = css(document.createElement('span'), 'overflow:hidden;text-overflow:ellipsis;');
	tracker.append(tArrow, tText);
	// the buttons that come and go: speak, do, strike
	const speakBtn = guard(css(document.createElement('button'), BTN + 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(150px + env(safe-area-inset-bottom));display:none;z-index:4;'));
	const doBtn = guard(css(document.createElement('button'), BTN + `position:absolute;left:50%;transform:translateX(-50%);bottom:calc(204px + env(safe-area-inset-bottom));display:none;z-index:4;border-color:${GOLD};`));
	const strikeBtn = guard(css(document.createElement('button'), BTN + 'position:absolute;right:calc(90px + env(safe-area-inset-right));bottom:calc(100px + env(safe-area-inset-bottom));width:64px;height:64px;border-radius:50%;padding:0;justify-content:center;display:none;z-index:4;border-color:rgba(226,191,106,.7);'));
	strikeBtn.type = speakBtn.type = doBtn.type = 'button';
	strikeBtn.innerHTML = svg('sword', 28); strikeBtn.title = 'Strike (Q)'; strikeBtn.setAttribute('aria-label', 'Strike');
	// the dialogue card
	const card = guard(css(document.createElement('div'), 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(18px + env(safe-area-inset-bottom));width:min(440px,calc(100vw - 24px));box-sizing:border-box;padding:14px 16px 12px;border-radius:16px;display:none;z-index:6;box-shadow:0 8px 30px rgba(0,0,0,.35);' + PANEL));
	// the log
	const log = guard(scrollable(css(document.createElement('div'), 'position:absolute;left:calc(12px + env(safe-area-inset-left));top:calc(116px + env(safe-area-inset-top));width:min(320px,calc(100vw - 24px));box-sizing:border-box;max-height:calc(100dvh - 200px - env(safe-area-inset-top) - env(safe-area-inset-bottom));overflow-y:auto;touch-action:pan-y;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:12px 14px;border-radius:14px;display:none;z-index:5;' + PANEL)));
	// a dark pulse at the edges when struck, and the black of fainting
	const hurt = css(document.createElement('div'), 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity .35s;background:radial-gradient(ellipse at 50% 50%,rgba(0,0,0,0) 55%,rgba(60,10,6,.55));z-index:2;');
	const faint = css(document.createElement('div'), 'position:absolute;inset:0;pointer-events:none;opacity:0;transition:opacity 1.1s;background:#000;z-index:7;');
	mount.append(hud, tracker, speakBtn, doBtn, strikeBtn, card, log, hurt, faint);

	logBtn.addEventListener('click', (e) => { e.stopPropagation(); logBtn.blur(); log.style.display = log.style.display === 'none' ? 'block' : 'none'; if (log.style.display === 'block') drawLog(); });
	function refresh() {
		purse.innerHTML = `${svg('coin', 16)}<span>${S.gold}</span>`;
		hfill.style.width = `${Math.max(0, S.hp)}%`;
		if (log.style.display === 'block') drawLog();
	}
	function drawLog() {
		const act = [], done = [];
		for (const [id, q] of Object.entries(Q)) { const s = state(id); if (s === 'done') done.push([id, q]); else if (s !== 'none') act.push([id, q]); }
		const row = (h) => `<div style="margin:8px 0;padding:10px;border-radius:11px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.04)">${h}</div>`;
		let h = `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><b style="letter-spacing:.06em">QUESTS · ${realm.name.toUpperCase()}</b><button data-close type="button" aria-label="Close" style="${BTN}min-height:34px;padding:4px 8px">${svg('close', 16)}</button></div>`;
		if (!act.length && !done.length) h += `<div style="opacity:.75;line-height:1.45;margin:8px 0">No quests yet. Look for people with a <span style="color:${GOLD}">gold mark</span> over their heads, and speak with them.</div>`;
		for (const [id, q] of act) {
			const s = state(id), tr = S.track === id;
			const n = id === 'clear' ? ` (${R.foesIn(q.where.D.id).filter((f) => !f.alive).length}/${R.foesIn(q.where.D.id).length})` : id === 'beacons' ? ` (${S.beacons.filter(Boolean).length}/${R.beacons.length})` : '';
			h += row(`<div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b style="color:${GOLD}">${q.title}</b><button data-track="${id}" type="button" style="${BTN}min-height:32px;padding:4px 10px;font-size:12px;${tr ? 'background:#01a982;' : ''}">${tr ? 'Tracking' : 'Track'}</button></div><div style="margin-top:6px;line-height:1.4;opacity:.92">${(q.steps[s] || q.steps.active) + n}</div>`);
		}
		if (done.length) h += `<div style="margin:12px 0 4px;opacity:.7;letter-spacing:.05em;font-size:12px">DONE</div>`;
		for (const [, q] of done) h += row(`<div style="opacity:.7"><b>${q.title}</b> · ${q.reward.gold} gold${q.reward.item ? ', ' + q.reward.item : ''}</div>`);
		h += `<div style="margin:12px 0 4px;opacity:.7;letter-spacing:.05em;font-size:12px">CARRYING</div><div style="display:flex;align-items:center;gap:6px;color:${GOLD}">${svg('coin', 16)} ${S.gold} gold</div>`;
		h += S.items.length ? S.items.map((it) => `<div style="margin-top:5px;display:flex;gap:6px;align-items:center">${it.startsWith('The banner') ? svg('banner', 15) : '·'} ${it}</div>`).join('') : '<div style="opacity:.6;margin-top:5px">Nothing else.</div>';
		log.innerHTML = h;
		log.querySelector('[data-close]').onclick = (e) => { e.stopPropagation(); log.style.display = 'none'; };
		for (const b of log.querySelectorAll('[data-track]')) b.onclick = (e) => { e.stopPropagation(); S.track = b.dataset.track; save(); drawLog(); };
	}
	// a card: a name, some words, and choices
	function say(p, text, choices = [{ label: 'Farewell' }]) {
		card.innerHTML = '';
		const head = css(document.createElement('div'), 'display:flex;align-items:baseline;gap:8px;margin-bottom:6px;');
		head.innerHTML = `<b style="font-size:15px">${p.name}</b><span style="opacity:.65">${p.title}</span>`;
		const body = css(document.createElement('div'), 'line-height:1.45;font-size:14px;margin-bottom:10px;');
		body.textContent = text;
		const row = css(document.createElement('div'), 'display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;');
		for (const c of choices) {
			const b = css(document.createElement('button'), BTN + (c.main ? `background:#01a982;border-color:#01a982;` : ''));
			b.type = 'button';
			b.innerHTML = (c.icon ? svg(c.icon, 16) : '') + `<span>${c.label}</span>`;
			b.onclick = (e) => { e.stopPropagation(); b.blur(); if (c.fn) c.fn(); else close(); };
			row.appendChild(b);
		}
		card.append(head, body, row);
		card.style.display = 'block';
		talking = p;
		p.talking = 60;
	}
	let talking = null;
	function close() { card.style.display = 'none'; if (talking) talking.talking = 0; talking = null; }

	// ---------- speaking with people ----------
	const CHAT = {
		smith: ['Mind the sparks. Horseshoes all morning, and a gate hinge for the castle after.', `Good iron comes up from the hills past ${realm.castleName.replace('Castle ', '')}. Good iron, poor roads.`],
		priest: ['Peace be with you, traveller. The crypt is old; older than the chapel over it.', 'The bell is rung at dusk. You will hear it across the fields.'],
		guard1: ['Keep to the road, friend.', `${realm.lord} keeps a fair peace here.`], guard2: ['Nothing gets past this gate that we do not see.', 'Cold night coming.'], guard3: ['Drill at dawn, drill at noon. My arms ache.'],
		walker1: ['Wool to the market, grain to the mill, and back again.'], walker2: ['Have you tried Mary\'s honey cakes? You must.'],
		kid1: ['Race you to the well!', 'Wat said there are ghosts in the old cellars.'], kid2: ['Do you have a sword? Can I hold it?', 'I found a shiny stone by the river.'],
		trader1: ['Cheese! Hard cheese, soft cheese, cheese that walks on its own.'], trader2: ['Jugs and bowls, fresh from the kiln.'],
		farmer0: ['Good soil, this. Too many stones, mind.'], farmer1: ['Rain by evening, you mark me.'],
		miller: ['The sails are turning well today.'], innkeeper: ['Ale, bread and a bed. What more does anyone need?'],
		steward: [`${realm.lord} is away on the lord's business. I keep the keys.`], captain: ['Stand straight when you pass the gate.'],
		mother: ['Good day.'], widow: ['The chapel is peaceful at this hour.'], baker: ['Fresh bread! Still warm!'],
	};
	function speak(p) {
		const id = p.id;
		const sayq = (qid) => {
			const q = Q[qid], s = state(qid);
			if (s === 'none') return say(p, q.offer, [{ label: 'I will do it', main: true, icon: 'scroll', fn: () => accept(qid) }, { label: 'Not now' }]);
			if (s === 'ready' || (qid === 'lost' && s === 'lead' && R.childNear(p))) return finish(qid, p);
			return say(p, { ring: 'Have you been down to the crypt yet? The chest in the last vault.', clear: 'Are they still walking? Go carefully.', beacons: 'The beacons, friend. The lord will be home soon.', lost: 'Please, find my boy.', bread: 'Hurry, before it cools!' }[qid] || 'Well?');
		};
		for (const [qid, q] of Object.entries(Q)) if (q.giver === id && state(qid) !== 'done') return sayq(qid);
		// a delivery arriving
		if (Q.bread && Q.bread.to === id && state('bread') === 'active') return finish('bread', p);
		if (id === 'innkeeper') {
			return say(p, S.hp < 100 ? 'You look done in. Sit down; here is broth and bread, and a bed upstairs if you need it.' : 'Ale, bread and a bed. What more does anyone need?', [...(S.hp < 100 ? [{ label: 'Rest a while', main: true, icon: 'bed', fn: () => { S.hp = 100; save(); refresh(); close(); hint('You rest by the fire. Your strength comes back.', 3000); } }] : []), { label: 'Farewell' }]);
		}
		const lines = CHAT[id] || ['Good day to you.'];
		say(p, lines[Math.floor(Math.random() * lines.length)]);
	}
	function accept(qid) {
		const q = Q[qid];
		set(qid, 'active');
		S.track = qid; save();
		if (qid === 'bread') { S.items.push('Warm loaf'); save(); }
		if (qid === 'lost') R.spawnChild();
		close();
		hint(`New quest: ${q.title}\n${q.steps.active}`, 5000);
		refresh();
	}
	function finish(qid, p) {
		const q = Q[qid];
		say(p, q.thanks, [{ label: 'Thank you', main: true, fn: () => {
			set(qid, 'done');
			S.gold += q.reward.gold;
			if (q.reward.item) S.items.push(q.reward.item);
			if (qid === 'ring') S.items = S.items.filter((x) => x !== 'Edith\'s ring');
			if (qid === 'bread') S.items = S.items.filter((x) => x !== 'Warm loaf');
			if (qid === 'lost') R.childHome();
			if (q.reward.banner) {
				// the realm's banner, kept with this browser's keepsakes (for hanging at home)
				try {
					const t = JSON.parse(localStorage.getItem('crysis-trophies') || '[]');
					if (!t.some((x) => x.kind === 'banner' && x.seed === realm.seed)) t.push({ kind: 'banner', seed: realm.seed, realm: realm.name, arms: realm.arms, at: Date.now() });
					localStorage.setItem('crysis-trophies', JSON.stringify(t));
				} catch { /* storage off */ }
			}
			if (S.track === qid) S.track = Object.keys(Q).find((k) => !['none', 'done'].includes(state(k))) || null;
			save(); refresh(); close();
			hint(`Quest done: ${q.title}\n+${q.reward.gold} gold${q.reward.item ? ' · ' + q.reward.item : ''}`, 5000);
		} }]);
	}

	// ---------- the world's side: what is near, what to do ----------
	let doAct = null, speakP = null, t0 = 0, fainting = 0, hurtT = 0;
	speakBtn.addEventListener('click', (e) => { e.stopPropagation(); speakBtn.blur(); if (speakP) speak(speakP); });
	doBtn.addEventListener('click', (e) => { e.stopPropagation(); doBtn.blur(); doAct?.fn(); });
	strikeBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); R.strike(); });
	addEventListener('keydown', (e) => {
		if (mount.style.display === 'none' || document.activeElement?.tagName === 'INPUT') return;
		if ((e.key === 'q' || e.key === 'Q') && R.armed()) { R.strike(); }
		else if ((e.key === 'e' || e.key === 'E') && doAct) { doAct.fn(); }
		else if (e.key === 'Enter' && speakP && card.style.display === 'none') { speak(speakP); }
		else if (e.key === 'Escape' && card.style.display !== 'none') close();
	});
	// things done with the hands
	function actions() {
		const pos = camera.position;
		const nearTo = (o, r) => o && Math.hypot(o.x - pos.x, o.z - pos.z) < r && Math.abs((o.y ?? pos.y - 1.6) - (pos.y - 1.6)) < 2.2;
		if (Q.ring && state('ring') === 'active' && !S.opened.ring && nearTo(Q.ring.where.props.chest, 2.4)) return { label: 'Open the chest', icon: 'chest', fn: () => { S.opened.ring = true; S.items.push('Edith\'s ring'); set('ring', 'ready'); R.openChest(Q.ring.where); hint('Under a mouldering cloak, a gold ring set with a small red stone. Edith\'s ring.', 5000); } };
		for (const d of R.dungeons) { const L = d.props.lever; if (L && !L.pulled && nearTo(L, 2.2)) return { label: 'Pull the lever', icon: 'lever', fn: () => { L.pulled = true; S.lever = true; save(); R.openGate(d); hint('Chains rattle somewhere ahead. The portcullis grinds upward.', 3500); } }; }
		if (Q.beacons && state('beacons') === 'active') for (let i = 0; i < R.beacons.length; i++) {
			if (S.beacons[i] || !nearTo(R.beacons[i].door, 5)) continue;
			return { label: 'Light the beacon', icon: 'flame', fn: () => {
				S.beacons[i] = true; save(); R.lightBeacon(i);
				if (R.beacons.every((q, j) => S.beacons[j])) { set('beacons', 'ready'); hint('The last beacon catches. Far off, the others answer.', 4500); } else hint(`The beacon roars up. ${S.beacons.filter(Boolean).length} of ${R.beacons.length}.`, 3500);
				refresh();
			} };
		}
		if (Q.lost && state('lost') === 'active' && R.child() && nearTo(R.child(), 2.8)) return { label: 'Take Wat\'s hand', icon: 'hand', fn: () => { set('lost', 'lead'); R.leadChild(); hint('Wat takes your hand. "I wasn\'t scared," he says, and holds on tight.', 4500); } };
		return null;
	}
	// the way to what you are after
	function target() {
		const id = S.track, q = Q[id];
		if (!q) return null;
		const s = state(id);
		const inD = R.inDungeon();
		const via = (d, obj, label) => (inD === d.D.id ? { ...obj, label } : { x: d.D.x, z: d.D.z, label: d.D.name });
		if (s === 'ready' || (id === 'lost' && s === 'lead')) { const g = R.folk.byId[q.giver]; return g ? { x: g.M.S.pos.x, z: g.M.S.pos.z, label: g.name } : R.personAt(q.giver); }
		if (id === 'ring') return via(q.where, q.where.props.chest, 'the iron-bound chest');
		if (id === 'clear') { const f = R.foesIn(q.where.D.id).find((x) => x.alive); return f ? via(q.where, f, 'the restless dead') : null; }
		if (id === 'bread') { const g = R.folk.byId[q.to]; return g ? { x: g.M.S.pos.x, z: g.M.S.pos.z, label: g.name } : R.personAt(q.to); }
		if (id === 'beacons') { let best = null, bd = 1e9; R.beacons.forEach((b, i) => { if (S.beacons[i]) return; const d = Math.hypot(b.door.x - camera.position.x, b.door.z - camera.position.z); if (d < bd) { bd = d; best = { x: b.door.x, z: b.door.z, label: 'a watchtower' }; } }); return best; }
		if (id === 'lost') { const c = R.child(), L = R.lostSpot; if (!c) return null; if (R.inCave() || inD === L.dungeon?.D.id) return { x: c.x, z: c.z, label: 'Wat' }; return L.dungeon ? { x: L.dungeon.D.x, z: L.dungeon.D.z, label: L.via } : { x: L.x, z: L.z, label: L.via }; }
		return null;
	}
	function update(dt, P) {
		t0 += dt;
		// the marks over heads: what each has to ask or to hear
		for (const [qid, q] of Object.entries(Q)) {
			const s = state(qid);
			R.mark(q.giver, s === 'none' ? 'offer' : s === 'ready' || (qid === 'lost' && s === 'lead') ? 'ready' : null, qid);
			if (qid === 'bread') R.mark(q.to, s === 'active' ? 'ready' : null, 'bread-to');
		}
		// every few frames: who can be spoken with, what can be done, the tracker
		if (t0 > 0.15) {
			t0 = 0;
			const busy = card.style.display !== 'none' || !P || P.flying;
			speakP = busy ? null : R.folk.facing(camera.position, P.yaw);
			const sd = speakP ? 'inline-flex' : 'none';
			if (speakBtn.style.display !== sd) speakBtn.style.display = sd;
			if (speakP) speakBtn.innerHTML = `${svg('speak', 18)}<span>Speak with ${speakP.name}${isPhone ? '' : ' (Enter)'}</span>`;
			doAct = busy ? null : actions();
			doBtn.style.display = doAct ? 'inline-flex' : 'none';
			if (doAct) doBtn.innerHTML = `${svg(doAct.icon, 18)}<span>${doAct.label}${isPhone ? '' : ' (E)'}</span>`;
			// walking away ends a conversation
			if (talking && Math.hypot(talking.M.S.pos.x - camera.position.x, talking.M.S.pos.z - camera.position.z) > 6) close();
			const T = target();
			if (T && !P?.flying) {
				const dx = T.x - camera.position.x, dz = T.z - camera.position.z, d = Math.hypot(dx, dz);
				// (turned from straight ahead: + to the right)
				const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw), rel = Math.atan2(dx * -fz + dz * fx, dx * fx + dz * fz);
				tArrow.style.transform = `rotate(${rel}rad)`;
				tText.textContent = `${Q[S.track].title} · ${T.label} · ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`;
				tracker.style.display = 'flex';
			} else tracker.style.display = 'none';
			const hd = S.hp < 100 || R.armed() ? 'flex' : 'none';
			if (health.style.display !== hd) health.style.display = hd;
			const sb = R.armed() && !P?.flying ? 'inline-flex' : 'none';
			if (strikeBtn.style.display !== sb) strikeBtn.style.display = sb;
			// the dead of a quest's dungeon all gone
			if (Q.clear && state('clear') === 'active' && R.foesIn(Q.clear.where.D.id).every((f) => !f.alive)) { set('clear', 'ready'); hint('The last of them crumbles. The barrow is quiet at last.', 4500); }
			// Wat home
			if (Q.lost && state('lost') === 'lead' && card.style.display === 'none' && R.childNear(R.folk.byId.mother)) { const m = R.folk.byId.mother; if (m) finish('lost', m); }
			// resting by the inn door
			if (S.hp < 100 && R.nearInn() && card.style.display === 'none' && !fainting) { S.hp = Math.min(100, S.hp + 25); save(); refresh(); if (S.hp >= 100) hint('Bess waves you in by the fire. You feel yourself again.', 3000); }
		}
		if (hurtT > 0) { hurtT -= dt; if (hurtT <= 0) hurt.style.opacity = '0'; }
		if (fainting > 0) {
			fainting -= dt;
			if (fainting < 1.2 && !update.moved) { update.moved = true; R.wakeAtInn(); S.hp = 100; save(); refresh(); }
			if (fainting <= 0) { faint.style.opacity = '0'; update.moved = false; hint('You wake by the fire at the inn. Bess has patched you up. "Go easier next time."', 5500); }
		}
	}
	// struck by one of the dead
	function hurtBy() {
		if (fainting > 0) return;
		S.hp = Math.max(0, S.hp - 12);
		hurt.style.opacity = '1'; hurtT = 0.35;
		refresh(); save();
		if (S.hp <= 0) { fainting = 2.6; faint.style.opacity = '1'; }
	}
	refresh();
	function dispose() { for (const el of [hud, tracker, speakBtn, doBtn, strikeBtn, card, log, hurt, faint]) el.remove(); }
	return {
		update, hurtBy, dispose, Q, S, state,
		busy: () => card.style.display !== 'none',
		info: () => Object.fromEntries(Object.entries(Q).map(([id, q]) => [id, { title: q.title, state: state(id), step: q.steps[state(id)] || null }])),
		// for looking at in tests: accept a quest, open the log, speak with someone
		debug: { accept: (id) => accept(id), openLog: () => { log.style.display = 'block'; drawLog(); }, speak: (id) => { const p = R.folk.byId[id]; if (p) speak(p); return !!p; }, set: (id, s) => set(id, s), gold: (n) => { S.gold = n; save(); refresh(); }, reset: () => { localStorage.removeItem(KEY); } },
	};
}

// the marks over heads: a gold diamond with ! (something to ask) or ? (come back to me)
export function markTexture(kind) {
	const cv = document.createElement('canvas');
	cv.width = cv.height = 128;
	const g = cv.getContext('2d');
	g.translate(64, 64);
	g.fillStyle = kind === 'offer' ? '#e2bf6a' : '#d8e4e0';
	g.strokeStyle = 'rgba(40,24,6,.8)'; g.lineWidth = 6;
	g.beginPath(); g.moveTo(0, -54); g.lineTo(40, 0); g.lineTo(0, 54); g.lineTo(-40, 0); g.closePath(); g.fill(); g.stroke();
	g.fillStyle = '#2a1a06'; g.font = 'bold 64px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
	g.fillText(kind === 'offer' ? '!' : '?', 0, 4);
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace;
	return t;
}
