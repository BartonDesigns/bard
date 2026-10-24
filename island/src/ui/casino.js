// The casino's games, played for your credits at the machine or the table you walked up to (a
// Strip resort's casino floor: interiors/resort-fitout.js; its slot machines, blackjack and
// roulette tables are perks, interiors/office-perks.js, that open this): the slot machine's three
// reels, the blackjack table's cards, the roulette wheel and its board, by the house's rules
// (gameplay/casino-rules.js). What you bet comes out of your credits as you bet it, what you win
// goes back in as it is paid (gameplay/arms.js, a trade with the house). While it is open it has
// the screen: the walking and looking stop (island-frame.js inputBlocked), Esc or ✕ gets up.
// The sounds of it are the room's: the reels' whirr and their stops, the bells of a win, the
// cards on the felt, the chips, the ball running round the wheel and dropping into its pocket.

import { spinSlots, REEL, slotPay, createBlackjack, handTotal, spinRoulette, WHEEL, pocketName, pocketColour, ROULETTE_BETS } from '../gameplay/casino-rules.js';
import { soundBus, noise } from '../world/soundbus.js';

const GAMES = {
	slots: { title: 'Slots', sub: 'Three reels · pays up to 1,000 to 1', chips: [1, 5, 25, 100] },
	blackjack: { title: 'Blackjack', sub: 'Dealer stands on 17 · blackjack pays 3 to 2 · min 5, max 500', chips: [5, 25, 100, 500], max: 500 },
	roulette: { title: 'Roulette', sub: 'Double zero · straight up pays 35 to 1 · table max 1,000', chips: [1, 5, 25, 100], max: 1000 },
};
const CSS = `
.cz{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:60;background:rgba(5,3,8,.55);backdrop-filter:blur(3px);font:14px var(--bard-body,system-ui,sans-serif);color:#f4ecd8}
.cz.on{display:flex}
.cz-card{width:min(460px,94vw);max-height:92dvh;overflow:auto;border-radius:16px;background:linear-gradient(180deg,#1b0f16,#0d080c);border:1px solid rgba(255,207,112,.35);box-shadow:0 20px 60px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.06);padding:14px 14px 12px}
.cz-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.cz-title{font-size:18px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#ffd166;text-shadow:0 0 12px rgba(255,170,40,.45)}
.cz-cr{margin-left:auto;font-weight:700;background:rgba(255,209,102,.12);border:1px solid rgba(255,209,102,.3);border-radius:999px;padding:4px 10px;white-space:nowrap}
.cz-x{width:44px;height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font-size:18px;cursor:pointer}
.cz-sub{font-size:12px;opacity:.65;margin:-4px 0 10px}
.cz-msg{min-height:22px;text-align:center;font-weight:700;margin:8px 0;color:#ffe9b0}
.cz-msg.win{color:#39ff88;text-shadow:0 0 10px rgba(57,255,136,.5)}
.cz-row{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.cz-b{min-height:44px;min-width:44px;padding:0 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.07);color:#fff;font-weight:700;font-size:14px;cursor:pointer}
.cz-b:disabled{opacity:.35;cursor:default}
.cz-b.go{background:linear-gradient(180deg,#e0303f,#9b1020);border-color:#ff7a85;min-width:110px;letter-spacing:.08em}
.cz-b.chip{border-radius:50%;width:48px;height:48px;padding:0;border:3px dashed rgba(255,255,255,.65);font-size:13px}
.cz-b.chip.sel{outline:3px solid #ffd166;outline-offset:2px}
.cz-bet{text-align:center;margin:6px 0;font-weight:700}
.cz-reels{position:relative;display:flex;gap:8px;justify-content:center;padding:12px;border-radius:14px;background:linear-gradient(180deg,#5a0b16,#2a050b);border:2px solid #d4a63a;box-shadow:inset 0 0 24px rgba(0,0,0,.6)}
.cz-reel{width:31%;height:186px;overflow:hidden;border-radius:8px;background:linear-gradient(180deg,#8d8d8d,#fff 30%,#fff 70%,#8d8d8d);position:relative}
.cz-strip{position:absolute;left:0;right:0;top:0;will-change:transform}
.cz-sym{height:62px;display:flex;align-items:center;justify-content:center;font-weight:900;color:#111}
.cz-sym .s7{font-size:46px;color:#d00000;-webkit-text-stroke:1.5px #ffcf3a;font-family:Georgia,serif}
.cz-sym .bars{display:flex;flex-direction:column;gap:2px;align-items:center}
.cz-sym .bars i{font-style:normal;font-size:12px;line-height:13px;background:#111;color:#fff;padding:0 7px;border-radius:3px;letter-spacing:.1em}
.cz-sym .em{font-size:36px}
.cz-line{position:absolute;left:6px;right:6px;top:50%;height:2px;background:rgba(255,0,110,.75);box-shadow:0 0 8px #ff006e;pointer-events:none}
.cz-pays{display:grid;grid-template-columns:1fr auto;gap:2px 12px;font-size:12px;opacity:.75;margin:10px 4px 0}
.cz-table{border-radius:120px 120px 16px 16px;background:radial-gradient(ellipse at 50% 0%,#17784c,#0b4a2e 70%);border:6px solid #3a1e10;padding:12px 10px 14px;min-height:210px}
.cz-hand{display:flex;gap:6px;justify-content:center;min-height:78px;align-items:center;flex-wrap:wrap}
.cz-hand.cur{filter:drop-shadow(0 0 8px rgba(255,209,102,.7))}
.cz-c{width:50px;height:72px;border-radius:7px;background:#fffdf7;color:#111;display:flex;flex-direction:column;align-items:center;justify-content:center;font-weight:800;font-size:20px;box-shadow:0 3px 8px rgba(0,0,0,.45);animation:czIn .22s ease-out}
.cz-c small{font-size:22px;line-height:20px}
.cz-c.red{color:#c1121f}
.cz-c.back{background:repeating-linear-gradient(45deg,#9b1020 0 6px,#6a0b16 6px 12px);border:3px solid #fff}
.cz-tot{text-align:center;font-size:12px;opacity:.85;margin:2px 0 8px}
@keyframes czIn{from{transform:translateY(-18px) rotate(-6deg);opacity:0}to{transform:none;opacity:1}}
.cz-wheel{display:block;margin:0 auto 8px;width:200px;height:200px}
.cz-board{display:grid;grid-template-columns:repeat(13,1fr);gap:2px;margin:6px 0}
.cz-n{position:relative;height:32px;border-radius:5px;border:1px solid rgba(255,255,255,.2);color:#fff;font-weight:700;font-size:12px;cursor:pointer;padding:0}
.cz-n.red{background:#b3121f}.cz-n.black{background:#151515}.cz-n.green{background:#0b6e3a}
.cz-n b{position:absolute;right:-4px;top:-6px;background:#ffd166;color:#111;border-radius:999px;font-size:10px;padding:1px 4px}
.cz-n.hit{outline:2px solid #39ff88}
.cz-out{display:grid;grid-template-columns:repeat(3,1fr);gap:4px}
`;

// mount: the game's screen; arms: the wallet (credits(), spendCredits, apply); hint(text, ms)
export function createCasino({ mount, arms, hint = () => {}, isPhone = false }) {
	if (typeof document !== 'undefined' && !document.getElementById('cz-css')) {
		const st = document.createElement('style'); st.id = 'cz-css'; st.textContent = CSS; document.head.appendChild(st);
	}
	const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
	const root = el('div', 'cz'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', 'Casino game');
	const card = el('div', 'cz-card'), head = el('div', 'cz-head'), title = el('b', 'cz-title'), cr = el('span', 'cz-cr'), x = el('button', 'cz-x', '✕');
	x.setAttribute('aria-label', 'Leave the game'); x.title = 'Leave (Esc)';
	const sub = el('div', 'cz-sub'), body = el('div'), msg = el('div', 'cz-msg'), foot = el('div');
	head.append(title, cr, x); card.append(head, sub, body, msg, foot); root.appendChild(card);
	for (const ev of ['pointerdown', 'touchstart', 'wheel', 'mousedown']) root.addEventListener(ev, (e) => e.stopPropagation());
	root.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') close(); });
	mount?.appendChild(root);
	x.onclick = () => close();

	let game = null, at = null, txN = 0, stopGame = null;
	const credits = () => arms?.state?.().credits ?? 0;
	const fmt = (n) => Math.round(n).toLocaleString('en-US');
	const showCredits = () => { cr.textContent = `💰 ${fmt(credits())} cr`; };
	const say = (t, win = false) => { msg.textContent = t; msg.classList.toggle('win', win); };
	const id = (k) => `casino:${k}:${Date.now().toString(36)}:${(txN++).toString(36)}`.slice(0, 80);
	// the house takes the bet as it is made, and pays what is won
	const take = (n) => { const ok = !!arms?.spendCredits?.(n, { id: id('bet'), kind: 'casino' }); showCredits(); if (!ok) say(`You need ${fmt(n)} credits for that.`); return ok; };
	const pay = (n) => { if (n > 0) arms?.apply?.({ id: id('pay'), kind: 'trade', peer: 'casino', give: { credits: 0, items: [] }, get: { credits: Math.round(n), items: [] } }); showCredits(); };

	// ---------- the room's sounds ----------
	function sound(kind, k = 1) {
		const B = soundBus();
		if (!B) return;
		const c = B.ctx, t = c.currentTime, out = c.createGain();
		out.gain.value = 0.9; out.connect(B.out);
		const tone = (f, t0, dur, type = 'sine', amp = 0.2) => { const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(amp, t0 + 0.006); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); o.connect(g).connect(out); o.start(t0); o.stop(t0 + dur + 0.05); };
		const hiss = (t0, dur, f, q, amp, colour = 'white') => { const s = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise(c, colour); bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; g.gain.setValueAtTime(amp, t0); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur); s.connect(bp).connect(g).connect(out); s.start(t0, Math.random() * 2); s.stop(t0 + dur + 0.05); };
		if (kind === 'spin') { for (let i = 0; i < 14 * k; i++) hiss(t + i * 0.07, 0.04, 2400, 3, 0.12); tone(70, t, 0.5, 'sine', 0.25); }
		else if (kind === 'stop') { tone(90, t, 0.25, 'sine', 0.45); hiss(t, 0.08, 900, 1.5, 0.35); }
		else if (kind === 'win') { const big = k >= 50; [523.3, 659.3, 784, 1046.5].forEach((f, i) => { for (let r = 0; r < (big ? 4 : 1); r++) { tone(f, t + i * 0.09 + r * 0.42, 0.9, 'triangle', 0.16); tone(f / 2, t + i * 0.09 + r * 0.42, 1.2, 'sine', 0.12); } }); }
		else if (kind === 'card') hiss(t, 0.06, 3200, 0.9, 0.3);
		else if (kind === 'chip') { tone(2600, t, 0.05, 'square', 0.04); hiss(t, 0.05, 5200, 2, 0.25); tone(1800, t + 0.03, 0.05, 'square', 0.03); }
		else if (kind === 'roll') { for (let i = 0; i < 40; i++) hiss(t + i * (0.04 + i * 0.0025), 0.05, 1800 - i * 20, 2, 0.08 + i * 0.002); tone(55, t, 3.2, 'sine', 0.15); }
		else if (kind === 'drop') { for (let i = 0; i < 5; i++) { hiss(t + i * 0.09, 0.05, 2200, 2, 0.3 / (i + 1)); tone(1400 + i * 120, t + i * 0.09, 0.05, 'square', 0.03); } }
		else if (kind === 'lose') tone(110, t, 0.4, 'sine', 0.2);
	}

	// ---------- chips: the bet you make ----------
	function chips(list, cur, onPick) {
		const row = el('div', 'cz-row');
		const colours = ['#e8e8e8', '#c1121f', '#1f7a3f', '#1b1b1b', '#5a189a'];
		list.forEach((v, i) => {
			const b = el('button', 'cz-b chip' + (v === cur ? ' sel' : ''), String(v));
			b.style.background = colours[i % colours.length]; b.style.color = i ? '#fff' : '#111';
			b.onclick = () => { for (const q of row.children) q.classList.remove('sel'); b.classList.add('sel'); sound('chip'); onPick(v); };
			row.appendChild(b);
		});
		return row;
	}

	// ---------- the slot machine ----------
	const CELL = 62, LOOPS = 4;
	const symHTML = (s) => s === '7' ? '<span class="s7">7</span>' : s.startsWith('BAR') ? `<span class="bars">${'<i>BAR</i>'.repeat(s === 'BAR3' ? 3 : s === 'BAR2' ? 2 : 1)}</span>` : s === 'BELL' ? '<span class="em">🔔</span>' : s === 'CHERRY' ? '<span class="em">🍒</span>' : '';
	function slots() {
		let bet = 1, spinning = false, pos = [0, 0, 0];
		const wrap = el('div', 'cz-reels'), strips = [];
		for (let r = 0; r < 3; r++) {
			const reel = el('div', 'cz-reel'), strip = el('div', 'cz-strip');
			strip.innerHTML = Array.from({ length: REEL.length * LOOPS }, (_, i) => `<div class="cz-sym">${symHTML(REEL[i % REEL.length])}</div>`).join('');
			reel.appendChild(strip); wrap.appendChild(reel); strips.push(strip);
			pos[r] = Math.floor(Math.random() * REEL.length);
			strip.style.transform = `translateY(${-(pos[r] - 1) * CELL}px)`;
		}
		wrap.appendChild(el('div', 'cz-line'));
		const pays = el('div', 'cz-pays', [['7 7 7', '1,000'], ['Triple bars ×3', '150'], ['Double bars ×3', '80'], ['Bells ×3', '40'], ['Bars ×3', '35'], ['Cherries ×3', '25'], ['Any three bars', '9'], ['Two cherries', '5'], ['Cherry on the first reel', '1']].map(([a, b]) => `<span>${a}</span><b>${b}×</b>`).join(''));
		body.replaceChildren(wrap, pays);
		const go = el('button', 'cz-b go', 'SPIN'), betLine = el('div', 'cz-bet');
		const showBet = () => { betLine.textContent = `Bet ${bet} a pull`; };
		foot.replaceChildren(betLine, chips(GAMES.slots.chips, bet, (v) => { bet = v; showBet(); }), el('div', 'cz-row'));
		foot.lastChild.appendChild(go); showBet();
		say('Pick your bet and pull.');
		let timer = null, result = null;
		function land() {
			if (!result) return;
			const R = result; result = null; spinning = false; go.disabled = false;
			if (R.win) { pay(R.win); say(`${R.name}! You win ${fmt(R.win)} credits.`, true); sound('win', R.win / R.bet); }
			else say('No win. Pull again?');
		}
		go.onclick = () => {
			if (spinning || !take(bet)) return;
			spinning = true; go.disabled = true; say('');
			const R = spinSlots(bet);
			result = { ...R, bet };
			sound('spin', 1.4);
			R.stops.forEach((k, r) => {
				const s = strips[r];
				// (from where it stands in the first loop round to its stop in the third)
				s.style.transition = 'none'; s.style.transform = `translateY(${-(pos[r] - 1) * CELL}px)`; void s.offsetHeight;
				const dur = 0.9 + r * 0.35;
				s.style.transition = `transform ${dur}s cubic-bezier(.15,.75,.3,1.02)`;
				s.style.transform = `translateY(${-(k + REEL.length * 2 - 1) * CELL}px)`;
				pos[r] = k;
				setTimeout(() => { if (game === 'slots') sound('stop'); }, dur * 1000);
			});
			timer = setTimeout(land, (0.9 + 2 * 0.35) * 1000 + 80);
		};
		// (leaving with the reels still turning: the pull is paid as it stopped)
		return () => { clearTimeout(timer); land(); };
	}

	// ---------- blackjack ----------
	function blackjack() {
		const T = createBlackjack({ take, pay });
		let bet = 25;
		const table = el('div', 'cz-table'), dealer = el('div', 'cz-hand'), dTot = el('div', 'cz-tot'), you = el('div');
		table.append(dealer, dTot, you);
		body.replaceChildren(table);
		const betLine = el('div', 'cz-bet'), acts = el('div', 'cz-row');
		const B = (label, fn) => { const b = el('button', 'cz-b', label); b.onclick = () => { fn(); draw(); }; return b; };
		const deal = el('button', 'cz-b go', 'DEAL');
		deal.onclick = () => { if (T.deal(bet)) { sound('card'); draw(); } };
		const hit = B('Hit', () => { T.hit(); sound('card'); }), stand = B('Stand', () => T.stand()), dbl = B('Double', () => { if (T.double()) sound('chip'); }), spl = B('Split', () => { if (T.split()) sound('chip'); });
		acts.append(deal, hit, stand, dbl, spl);
		const chipRow = chips(GAMES.blackjack.chips, bet, (v) => { bet = v; showBet(); });
		const showBet = () => { betLine.textContent = `Your bet: ${bet}`; };
		foot.replaceChildren(betLine, chipRow, acts); showBet();
		const cardHTML = (c, hidden) => hidden ? '<div class="cz-c back"></div>' : `<div class="cz-c ${c.s === '♥' || c.s === '♦' ? 'red' : ''}">${c.r}<small>${c.s}</small></div>`;
		let seen = 0;
		function draw() {
			const S = T.state(), play = S.phase === 'play';
			dealer.innerHTML = S.dealer.map((c, i) => cardHTML(c, play && i === 1)).join('');
			dTot.textContent = S.dealer.length ? (play ? `Dealer shows ${S.dealer[0].r}` : `Dealer ${handTotal(S.dealer).total}`) : 'Place your bet';
			you.replaceChildren(...S.hands.map((h, i) => {
				const w = el('div'), hh = el('div', 'cz-hand' + (play && i === S.at ? ' cur' : ''), h.cards.map((c) => cardHTML(c)).join(''));
				const t = handTotal(h.cards);
				w.append(hh, el('div', 'cz-tot', `${S.hands.length > 1 ? `Hand ${i + 1}: ` : 'You: '}${t.soft && t.total < 21 ? 'soft ' : ''}${t.total} · bet ${h.bet}${h.out ? ' · ' + ({ blackjack: 'Blackjack!', win: 'win', lose: 'lose', push: 'push', bust: 'bust' })[h.out] : ''}`));
				return w;
			}));
			deal.style.display = play ? 'none' : ''; chipRow.style.display = play ? 'none' : '';
			for (const b of [hit, stand]) b.style.display = play ? '' : 'none';
			dbl.style.display = play && T.canDouble() ? '' : 'none'; spl.style.display = play && T.canSplit() ? '' : 'none';
			const n = S.dealer.length + S.hands.reduce((a, h) => a + h.cards.length, 0);
			if (n > seen + 1 && !play) sound('card');
			seen = n;
			if (S.phase === 'done') {
				const put = S.hands.reduce((a, h) => a + h.bet, 0), net = S.back - put;
				if (S.hands.some((h) => h.out === 'blackjack')) { say(`Blackjack! You win ${fmt(net)}.`, true); sound('win', 3); }
				else if (net > 0) { say(handTotal(S.dealer).total > 21 ? `Dealer busts. You win ${fmt(net)}.` : `You win ${fmt(net)}.`, true); sound('win', 2); }
				else if (net === 0) say('Push. Your bet comes back.');
				else { say(S.hands.every((h) => h.out === 'bust') ? 'Bust.' : `Dealer has ${handTotal(S.dealer).total}. The house wins.`); sound('lose'); }
			} else if (play) say(T.canSplit() ? 'A pair: split it, or play it.' : '');
			showCredits();
		}
		say('Place your bet and deal.');
		draw();
		// (leaving in the middle of a hand: it is left on the table, lost)
		return () => { if (T.state().phase === 'play') hint('You leave your hand on the table.', 2200); };
	}

	// ---------- roulette ----------
	function roulette() {
		let chip = 5, bets = new Map(), spinning = false, angle = 0, last = null;
		const cv = el('canvas', 'cz-wheel'), dpr = Math.min(2, window.devicePixelRatio || 1);
		cv.width = cv.height = 200 * dpr;
		const g = cv.getContext('2d');
		function wheel(rot, ball, ballR) {
			g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, 200, 200);
			g.fillStyle = '#3a1e10'; g.beginPath(); g.arc(100, 100, 98, 0, Math.PI * 2); g.fill();
			const N = WHEEL.length, step = Math.PI * 2 / N;
			for (let i = 0; i < N; i++) {
				const a0 = rot + i * step, n = WHEEL[i], col = pocketColour(n);
				g.fillStyle = col === 'red' ? '#b3121f' : col === 'green' ? '#0b6e3a' : '#111';
				g.beginPath(); g.moveTo(100, 100); g.arc(100, 100, 88, a0, a0 + step); g.closePath(); g.fill();
				g.save(); g.translate(100, 100); g.rotate(a0 + step / 2); g.fillStyle = '#fff'; g.font = 'bold 8px sans-serif'; g.textAlign = 'center'; g.fillText(pocketName(n), 78, 3); g.restore();
			}
			g.fillStyle = '#5a3a1a'; g.beginPath(); g.arc(100, 100, 52, 0, Math.PI * 2); g.fill();
			g.fillStyle = '#d4a63a'; g.beginPath(); g.arc(100, 100, 12, 0, Math.PI * 2); g.fill();
			for (let k = 0; k < 4; k++) { const a = rot + k * Math.PI / 2; g.strokeStyle = '#d4a63a'; g.lineWidth = 3; g.beginPath(); g.moveTo(100, 100); g.lineTo(100 + Math.cos(a) * 40, 100 + Math.sin(a) * 40); g.stroke(); }
			if (ball != null) { g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.6)'; g.shadowBlur = 3; g.beginPath(); g.arc(100 + Math.cos(ball) * ballR, 100 + Math.sin(ball) * ballR, 4.2, 0, Math.PI * 2); g.fill(); g.shadowBlur = 0; }
		}
		wheel(angle, null);
		const board = el('div', 'cz-board'), cells = new Map();
		const key = (b) => b.kind === 'straight' ? 'n' + b.n : b.kind;
		const cell = (label, b, cls) => {
			const c = el('button', 'cz-n ' + cls, label);
			c.onclick = () => { if (spinning) return; const k = key(b), cur = bets.get(k); const total = [...bets.values()].reduce((a, q) => a + q.amount, 0); if (total + chip > GAMES.roulette.max) { say('That is the table maximum.'); return; } bets.set(k, { ...b, amount: (cur?.amount || 0) + chip }); sound('chip'); mark(); };
			cells.set(key(b), c);
			return c;
		};
		// (the zeros at the head of the board, then the numbers three to a column, as they lie)
		const zeros = el('div'); zeros.style.cssText = 'grid-row:span 3;display:flex;flex-direction:column;gap:2px';
		const z0 = cell('0', { kind: 'straight', n: 0 }, 'green'), z00 = cell('00', { kind: 'straight', n: 37 }, 'green');
		z0.style.height = z00.style.height = '49px'; zeros.append(z0, z00); board.appendChild(zeros);
		for (let row = 0; row < 3; row++) for (let col = 0; col < 12; col++) { const n = col * 3 + (3 - row); board.appendChild(cell(String(n), { kind: 'straight', n }, pocketColour(n))); }
		const outs = el('div', 'cz-out');
		for (const [label, kind, cls] of [['1st 12', 'dozen1', 'black'], ['2nd 12', 'dozen2', 'black'], ['3rd 12', 'dozen3', 'black'], ['1–18', 'low', 'black'], ['Even', 'even', 'black'], ['Red', 'red', 'red'], ['Black', 'black', 'black'], ['Odd', 'odd', 'black'], ['19–36', 'high', 'black']]) { const c = cell(label, { kind }, cls); c.style.height = '40px'; outs.appendChild(c); }
		body.replaceChildren(cv, board, outs);
		function mark() {
			for (const [k, c] of cells) { c.querySelector('b')?.remove(); const b = bets.get(k); if (b) c.appendChild(el('b', '', String(b.amount))); c.classList.toggle('hit', !!last && (k === 'n' + last.n || (ROULETTE_BETS[k] && ROULETTE_BETS[k].covers(last.n, {})))); }
			const total = [...bets.values()].reduce((a, q) => a + q.amount, 0);
			betLine.textContent = total ? `On the board: ${total}` : 'Tap the board to place chips';
			go.disabled = spinning || !total;
		}
		const betLine = el('div', 'cz-bet'), go = el('button', 'cz-b go', 'SPIN'), clearB = el('button', 'cz-b', 'Clear');
		clearB.onclick = () => { if (!spinning) { bets = new Map(); mark(); } };
		const acts = el('div', 'cz-row'); acts.append(clearB, go);
		foot.replaceChildren(betLine, chips(GAMES.roulette.chips, chip, (v) => { chip = v; }), acts);
		let raf = 0, done = null;
		go.onclick = () => {
			const list = [...bets.values()], total = list.reduce((a, q) => a + q.amount, 0);
			if (spinning || !total || !take(total)) return;
			spinning = true; last = null; mark(); say('No more bets.');
			const R = spinRoulette(list), N = WHEEL.length, step = Math.PI * 2 / N, t0 = performance.now(), D = 3600;
			// (the wheel turning one way, the ball the other, slowing, to drop at its pocket at the top)
			const a1 = angle + Math.PI * 2 * 3, ballEnd = -Math.PI / 2, wheelEnd = ballEnd - (R.at * step + step / 2) + Math.PI * 2 * Math.ceil((a1 - angle) / (Math.PI * 2));
			sound('roll');
			done = () => {
				cancelAnimationFrame(raf); raf = 0; done = null;
				angle = wheelEnd % (Math.PI * 2); wheel(angle, ballEnd, 70);
				spinning = false; last = R; sound('drop');
				const name = `${pocketName(R.n)} ${pocketColour(R.n)}`;
				if (R.back) { pay(R.back); say(`${name}. You win ${fmt(R.back - total)}.`, R.back > total); if (R.back > total) sound('win', R.back / total); }
				else { say(`${name}. The house wins.`); sound('lose'); }
				bets = new Map(); mark();
			};
			const frame = (now) => {
				const u = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - u, 3);
				const wa = angle + (wheelEnd - angle) * e, ba = ballEnd + Math.PI * 2 * 5 * (1 - e) * -1, br = 86 - 16 * Math.max(0, (u - 0.6) / 0.4);
				wheel(wa, ba, br);
				if (u < 1) raf = requestAnimationFrame(frame); else done?.();
			};
			raf = requestAnimationFrame(frame);
		};
		say('Pick a chip, tap the board, spin.');
		mark();
		// (leaving mid-spin: the ball drops all the same and the bets are settled)
		return () => { done?.(); };
	}

	function open(kind, q = null) {
		if (kind === 'cage') { hint(`The cashier counts it out: you hold ${fmt(credits())} credits. Your winnings are in them already.`, 3200); return; }
		const G = GAMES[kind];
		if (!G) return;
		if (game) close();
		game = kind; at = q;
		title.textContent = G.title; sub.textContent = G.sub; say('');
		showCredits();
		stopGame = kind === 'slots' ? slots() : kind === 'blackjack' ? blackjack() : roulette();
		root.classList.add('on');
		try { document.exitPointerLock?.(); } catch { /* none */ }
		setTimeout(() => root.querySelector('.cz-b.go')?.focus?.(), 30);
	}
	function close() {
		if (!game) return;
		stopGame?.(); stopGame = null;
		game = null; at = null;
		root.classList.remove('on');
	}
	// walked away from it (perks see you leave its reach)
	function update(eye) {
		if (game && at && Math.hypot(eye.x - at.x, eye.z - at.z) > 4) close();
	}
	addEventListener('keydown', (e) => { if (game && e.key === 'Escape') close(); });
	return { open, close, update, active: () => !!game, info: () => ({ game, credits: credits() }), pays: slotPay };
}
