// The casino's games by a Strip casino's own rules, for ui/casino.js to play with your credits.
// Every game is the house's: it keeps its edge, as the real ones do.
//   slots:     three reels of 32 stops each, sevens, bars, bells, cherries and blanks; the pay
//              table pays about 92 in every 100 credits played (a Strip reel machine's), the
//              sevens a thousand to one
//   blackjack: six decks, the dealer stands on all 17s, blackjack pays 3 to 2, double on any
//              first two cards, split a pair once (split aces take one card each)
//   roulette:  the double-zero wheel (0 and 00), the inside and outside bets at their usual odds
// rand(): a number in [0, 1), Math.random unless a test gives its own.

// ---------- the slot machine ----------
export const SYMBOLS = ['7', 'BAR3', 'BAR2', 'BAR', 'BELL', 'CHERRY', 'BLANK'];
// how many of each on a reel's 32 stops (the same on every reel)
const STOPS = { '7': 1, BAR3: 2, BAR2: 3, BAR: 5, BELL: 4, CHERRY: 4, BLANK: 13 };
export const REEL = Object.entries(STOPS).flatMap(([s, n]) => Array(n).fill(s));
// (the strip as it turns: the stops spread round it, not in their runs)
for (let i = REEL.length - 1, seed = 7; i > 0; i--) { seed = (seed * 1103515245 + 12345) >>> 0; const j = seed % (i + 1); [REEL[i], REEL[j]] = [REEL[j], REEL[i]]; }
const BARS = new Set(['BAR3', 'BAR2', 'BAR']);
// what three symbols on the line pay, for each credit bet (0: nothing), and its name
export function slotPay([a, b, c]) {
	if (a === b && b === c) {
		const P = { '7': [1000, 'Three sevens'], BAR3: [150, 'Three triple bars'], BAR2: [80, 'Three double bars'], BAR: [35, 'Three bars'], BELL: [40, 'Three bells'], CHERRY: [25, 'Three cherries'] }[a];
		if (P) return { pays: P[0], name: P[1] };
	}
	if (BARS.has(a) && BARS.has(b) && BARS.has(c)) return { pays: 9, name: 'Any three bars' };
	const cherries = [a, b, c].filter((s) => s === 'CHERRY').length;
	if (cherries === 2) return { pays: 5, name: 'Two cherries' };
	if (cherries === 1 && a === 'CHERRY') return { pays: 1, name: 'A cherry on the first reel' };
	return { pays: 0, name: '' };
}
// one pull: where each reel stops, the symbols on the line, what it pays for `bet`
export function spinSlots(bet, rand = Math.random) {
	const stops = [0, 1, 2].map(() => Math.floor(rand() * REEL.length) % REEL.length), line = stops.map((i) => REEL[i]);
	const { pays, name } = slotPay(line);
	return { stops, line, win: pays * bet, name };
}
// what the machine pays back of what it is fed, worked out over every one of its 32,768 lines
export function slotReturn() {
	let paid = 0;
	for (const a of REEL) for (const b of REEL) for (const c of REEL) paid += slotPay([a, b, c]).pays;
	return paid / REEL.length ** 3;
}

// ---------- blackjack ----------
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'], SUITS = ['♠', '♥', '♦', '♣'];
export const cardValue = (c) => (c.r === 'A' ? 11 : ['10', 'J', 'Q', 'K'].includes(c.r) ? 10 : +c.r);
// a hand's total, the aces counted 1 where 11 would bust it; soft: an ace still counted 11
export function handTotal(cards) {
	let t = 0, aces = 0;
	for (const c of cards) { t += cardValue(c); if (c.r === 'A') aces++; }
	while (t > 21 && aces) { t -= 10; aces--; }
	return { total: t, soft: aces > 0 };
}
export const isBlackjack = (cards) => cards.length === 2 && handTotal(cards).total === 21;

export function createShoe(decks = 6, rand = Math.random) {
	let cards = [], dealt = 0;
	function shuffle() {
		cards = [];
		for (let d = 0; d < decks; d++) for (const s of SUITS) for (const r of RANKS) cards.push({ r, s });
		for (let i = cards.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [cards[i], cards[j]] = [cards[j], cards[i]]; }
		dealt = 0;
	}
	shuffle();
	// (the cut card three quarters of the way in: a new shoe before the next round)
	return { draw: () => cards[dealt++], due: () => dealt > cards.length * 0.75, shuffle, left: () => cards.length - dealt };
}

// a table: one round at a time. phase 'bet' (waiting for a bet), 'play' (your hands, one at a
// time), 'done' (settled: each hand's outcome and what came back to you).
// What you bet is taken as you bet it (take(n) -> bool); what comes back is paid at the end.
export function createBlackjack({ rand = Math.random, take = () => true, pay = () => {} } = {}) {
	const shoe = createShoe(6, rand);
	let S = { phase: 'bet', hands: [], dealer: [], at: 0, note: '' };
	const card = () => shoe.draw();
	function deal(bet) {
		if (S.phase === 'play' || !(bet > 0) || !take(bet)) return false;
		if (shoe.due()) shoe.shuffle();
		S = { phase: 'play', hands: [{ cards: [card()], bet, done: false, doubled: false, split: false }], dealer: [card()], at: 0, note: '' };
		S.hands[0].cards.push(card()); S.dealer.push(card());
		// (a blackjack, yours or the dealer's under its ace or ten, ends the round there)
		if (isBlackjack(S.hands[0].cards) || isBlackjack(S.dealer)) finish();
		return true;
	}
	const hand = () => S.hands[S.at];
	function next() {
		const h = hand();
		if (h && (h.done || handTotal(h.cards).total >= 21)) { h.done = true; S.at++; }
		// (the second of a split pair, dealt its second card as it comes up)
		const n = hand();
		if (n && n.cards.length === 1) { n.cards.push(card()); if (n.aces || handTotal(n.cards).total >= 21) n.done = true; return next(); }
		if (S.at >= S.hands.length) finish();
	}
	function hit() { if (S.phase !== 'play') return false; hand().cards.push(card()); next(); return true; }
	function stand() { if (S.phase !== 'play') return false; hand().done = true; next(); return true; }
	const canDouble = () => S.phase === 'play' && hand()?.cards.length === 2 && !hand().aces;
	function double() {
		const h = hand();
		if (!canDouble() || !take(h.bet)) return false;
		h.bet *= 2; h.doubled = true; h.cards.push(card()); h.done = true; next();
		return true;
	}
	const canSplit = () => { const h = hand(); return S.phase === 'play' && S.hands.length === 1 && h?.cards.length === 2 && cardValue(h.cards[0]) === cardValue(h.cards[1]); };
	function split() {
		const h = hand();
		if (!canSplit() || !take(h.bet)) return false;
		const aces = h.cards[0].r === 'A';
		S.hands = [{ cards: [h.cards[0], card()], bet: h.bet, done: aces, split: true, aces }, { cards: [h.cards[1]], bet: h.bet, done: false, split: true, aces }];
		S.at = 0;
		if (aces || handTotal(S.hands[0].cards).total >= 21) { S.hands[0].done = true; next(); }
		return true;
	}
	// the dealer's turn (but against only busted hands), then every hand settled
	function finish() {
		const bjOnly = S.hands.length === 1 && isBlackjack(S.hands[0].cards), live = !bjOnly && S.hands.some((h) => handTotal(h.cards).total <= 21);
		if (live && !isBlackjack(S.dealer)) while (handTotal(S.dealer).total < 17) S.dealer.push(card());
		const d = handTotal(S.dealer).total, dbj = isBlackjack(S.dealer);
		let back = 0;
		for (const h of S.hands) {
			const t = handTotal(h.cards).total, bj = !h.split && isBlackjack(h.cards);
			if (bj && !dbj) { h.out = 'blackjack'; h.back = h.bet + Math.floor(h.bet * 1.5); }
			else if (bj && dbj) { h.out = 'push'; h.back = h.bet; }
			else if (t > 21) { h.out = 'bust'; h.back = 0; }
			else if (dbj) { h.out = 'lose'; h.back = 0; }
			else if (d > 21 || t > d) { h.out = 'win'; h.back = h.bet * 2; }
			else if (t === d) { h.out = 'push'; h.back = h.bet; }
			else { h.out = 'lose'; h.back = 0; }
			back += h.back;
		}
		S.phase = 'done'; S.back = back;
		if (back) pay(back);
	}
	return { deal, hit, stand, double, split, canDouble, canSplit, state: () => S, shoe };
}

// ---------- roulette ----------
// the wheel's pockets in their order round it (the American, double-zero wheel); 37 is 00
export const WHEEL = [0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const pocketName = (n) => (n === 37 ? '00' : String(n));
export const pocketColour = (n) => (n === 0 || n === 37 ? 'green' : RED.has(n) ? 'red' : 'black');
// a bet: { kind, n? } -> the pockets it covers and what it pays to one
export const ROULETTE_BETS = {
	straight: { pays: 35, covers: (n, b) => n === b.n },
	red: { pays: 1, covers: (n) => RED.has(n) },
	black: { pays: 1, covers: (n) => n >= 1 && n <= 36 && !RED.has(n) },
	odd: { pays: 1, covers: (n) => n >= 1 && n <= 36 && n % 2 === 1 },
	even: { pays: 1, covers: (n) => n >= 1 && n <= 36 && n % 2 === 0 },
	low: { pays: 1, covers: (n) => n >= 1 && n <= 18 },
	high: { pays: 1, covers: (n) => n >= 19 && n <= 36 },
	dozen1: { pays: 2, covers: (n) => n >= 1 && n <= 12 },
	dozen2: { pays: 2, covers: (n) => n >= 13 && n <= 24 },
	dozen3: { pays: 2, covers: (n) => n >= 25 && n <= 36 },
	col1: { pays: 2, covers: (n) => n >= 1 && n <= 36 && n % 3 === 1 },
	col2: { pays: 2, covers: (n) => n >= 1 && n <= 36 && n % 3 === 2 },
	col3: { pays: 2, covers: (n) => n >= 1 && n <= 36 && n % 3 === 0 },
};
// the ball's pocket, and what the bets [{ kind, n, amount }] bring back (stake and winnings)
export function spinRoulette(bets, rand = Math.random) {
	const at = Math.floor(rand() * WHEEL.length) % WHEEL.length, n = WHEEL[at];
	let back = 0;
	const wins = [];
	for (const b of bets) {
		const B = ROULETTE_BETS[b.kind];
		if (B && B.covers(n, b)) { back += b.amount * (B.pays + 1); wins.push(b); }
	}
	return { n, at, back, wins };
}
