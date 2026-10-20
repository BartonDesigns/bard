// Cooking, gathered: your larder (cooking/larder.js), the kitchens of the houses you walk into and
// what is in their fridges and cupboards (cooking/kitchens.js), the grocers, butchers and fish
// markets that sell you the rest and buy your catch, real recipes cooked step by step
// (cooking/recipes.js), and the meals' strength on you for the rest of your day, deaths and all
// (cooking/meals.js, folded into your stats by magic/stats.js).
//
// Where the food comes from: a fish you land (fishing.js) kept instead of let go, as fillets; game
// you shoot in the open (bay/wildlife.js deer, nature/smalllife.js turkeys and quail: combat's
// shots ask hooks.quarry first), dressed where it fell; a family's kitchen, which is their food
// (what you take thins their week: people/food.js, and you can leave them money for it, or stock
// their fridge from your own catch); and the shops, whose takings go to the business
// (economy/payroll.js).
//
// And the house's people: cook in someone's kitchen and they may well walk in on you. It is
// awkward, and funny, and they let you carry on (a plate for them goes a long way). Everyone gets
// hungry (cooking/hunger.js): what they say shows it.
//
// One prompt (E, or its button): keep the fish in your hand, dress the game at your feet, the
// kitchen, the shop. The places menu has "🍲 Meals and larder".

import * as THREE from 'three';
import { INGREDIENTS, filletGrams, fishMeat, gameMeat, CARRY_G, amountText, STORE_OF } from './ingredients.js';
import { RECIPE, cook as cookRecipe, check } from './recipes.js';
import { active, eat, MAX_MEALS } from './meals.js';
import { createLarder, saveLarder, stow, take, settle, plate, freshPlates, takePlate, note, LARDER_KEY } from './larder.js';
import { kitchenStock, createKitchenLog, rollDay, tookFrom, owed, pantryLoss, shelves, shopKind, worth, hashKey, KITCHENS_KEY, SHOPS } from './kitchens.js';
import { hungerAt, hungerWord, hungerLine } from './hunger.js';
import { createCookingPanel } from './ui.js';
import { assess, recordDeed } from '../people/food.js';
import { describe as describeHousehold, mouths } from '../people/households.js';
import { loadPeopleAssets, buildPerson, personDNA, freeBody } from '../people/body.js';
import { createMotion } from '../people/motion.js';
import { fadePerson } from '../people/fade.js';
import { safeSocialStep } from '../people/social-actors.js';
import { payroll } from '../economy/payroll.js';

const store = {
	get: (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
	set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
};
// how long each step of a recipe takes at the stove, seconds
const STEP_S = 2.4;
// how near a fridge or counter you need to be to use the kitchen, metres
const REACH = 2.4;

// world(): the world; arms: the arms runtime (credits); magic(): createMagic's (setMeals);
// families: people/family-life.js (areaAt); fishing: fishing.js; combat: its hooks take quarry;
// addTalkers / talkTo: people.js's talkers and the guide's talk; doorNear(): a door's prompt
// has E; morality(): the compass; hours(): the sky's
export function createCooking({ scene, camera, mount, button, hint = () => {}, isPhone = false, world, arms, magic = () => null, families = null, fishing = null, combat = null, addTalkers = null, talkTo = null, doorNear = () => false, morality = () => null, hours = () => 12 }) {
	const L = createLarder(store.get(LARDER_KEY));
	const K = createKitchenLog(store.get(KITCHENS_KEY));
	const pending = [];
	let dirty = false, saveT = 0, txN = 0;
	const save = () => { dirty = false; store.set(LARDER_KEY, saveLarder(L)); store.set(KITCHENS_KEY, K); };
	const touch = () => { dirty = true; saveT = Math.min(saveT, 1.5); };
	const credits = () => arms?.state?.()?.credits ?? 0;
	const txId = (k) => `food-${k}-${Date.now().toString(36)}-${(txN++).toString(36)}`;
	const earn = (n, peer) => n > 0 && !!arms?.apply?.({ id: txId('earn'), kind: 'trade', peer, give: { credits: 0, items: [] }, get: { credits: Math.round(n), items: [] } })?.ok;
	const spend = (n, kind) => n <= 0 || !!arms?.spendCredits?.(Math.round(n), { id: txId(kind), kind });

	// ---------- the meals on you ----------
	function applyMeals() { L.meals = active(L.meals); magic()?.setMeals?.(L.meals); }
	let mealsT = 0;
	function eatPlate(id) {
		const p = takePlate(L, id);
		if (!p) return false;
		const r = eat(L.meals, p.id, p.q);
		L.meals = r.meals;
		applyMeals();
		const R = RECIPE[p.id];
		hint(r.topped ? `${R.name}: topped up. ${R.buff.name} lasts the rest of your day.` : `${R.name}. ${R.buff.name} until 4 am, through every fight${r.replaced ? `; ${RECIPE[r.replaced.id].buff.name} has worn off` : ''}.`, 5000);
		note(L, `Ate ${R.name}`);
		touch(); drawMenu();
		return true;
	}

	// ---------- where you are: a kitchen, a shop ----------
	let here = null, hereT = 0, sites = [], sitesT = 0;
	function householdAt(x, z) {
		const a = families?.areaAt?.(x, z);
		return a?.households?.find((hh) => hh.home && Math.hypot(hh.home.x - x, hh.home.z - z) < 1.5) || null;
	}
	function kitchenHere() {
		const W = world(), pos = camera.position;
		if (!W) return null;
		// a house (bay/houses.js): its fridge and counters on your floor
		const H = W.houses?.inside?.(pos);
		if (H) {
			const h = H.h, items = h.plan?.items || [];
			let best = null;
			for (const it of items) {
				if ((it.type !== 'fridge' && it.type !== 'counter') || (it.level || 0) !== H.level) continue;
				const x = h.M.x + h.ca * it.x - h.sa * it.z, z = h.M.z + h.sa * it.x + h.ca * it.z;
				const d = Math.hypot(x - pos.x, z - pos.z) - (it.type === 'counter' ? Math.min(1.5, (it.w || 1) / 2) : 0);
				if (d < REACH && (!best || d < best.d)) best = { d, x, z, y: it.y || 0 };
			}
			if (!best) return null;
			const key = `h:${Math.round(h.cx)},${Math.round(h.cz)}`, hh = householdAt(h.cx, h.cz);
			return { kind: 'kitchen', key, hh, place: hh?.food?.place || 'suburb', at: best, house: h, floorY: h.floorY + best.y, name: hh ? 'A family kitchen' : 'Kitchen', line: hh ? `Home of ${describeHousehold(hh)}.` : 'Somebody lives here.' };
		}
		// a row house, a flat, a shop (interiors/index.js)
		const I = W.interiors?.inside?.(pos);
		if (I) {
			const B = I.B, P = B.P;
			const sk = shopKind(P.estab?.type || P.estab?.fit || (I.use === 'store' ? 'grocer' : ''));
			if (sk) return { kind: 'shop', shop: sk, key: `s:${B.key}`, at: { x: pos.x, z: pos.z }, name: P.estab?.name || SHOPS[sk].name, place: 'suburb' };
			if (P.estab) return null;
			const F = W.interiors.frame?.(B.o);
			if (!F) return null;
			let best = null;
			for (const it of P.items || []) {
				if (it.type !== 'fridge' && it.type !== 'counter') continue;
				if ((P.rooms?.[it.room]?.k ?? I.level) !== I.level) continue;
				const [x, z] = F.w(it.x, it.z), d = Math.hypot(x - pos.x, z - pos.z) - (it.type === 'counter' ? Math.min(1.5, (it.w || 1) / 2) : 0);
				if (d < REACH && (!best || d < best.d)) best = { d, x, z };
			}
			if (!best) return null;
			return { kind: 'kitchen', key: `b:${B.key}`, hh: null, place: 'suburb', at: best, name: I.use === 'apt' ? 'A flat\'s kitchen' : 'Kitchen', line: 'Somebody lives here.' };
		}
		return null;
	}
	function shopHere() {
		const W = world(), pos = camera.position;
		if (sitesT <= 0) { sitesT = 3; try { sites = (W?.worldSites?.() || []).filter((S) => S.kind === 'supermarket'); } catch { sites = []; } }
		let best = null;
		for (const S of sites) {
			const d = Math.hypot(S.x - pos.x, S.z - pos.z);
			if (d < 9 && (!best || d < best.d)) best = { d, S };
		}
		if (!best) return null;
		const S = best.S;
		// (a hardware store sells no food)
		if (S.stock?.length) return null;
		return { kind: 'shop', shop: 'grocer', key: `s:${S.id}`, at: { x: S.x, z: S.z }, name: S.name || 'Supermarket', place: 'suburb' };
	}
	function carcassHere() {
		const pos = camera.position;
		for (const Q of world()?.wildlife?.quarry?.() || []) if (Q.A.dead && !Q.A.gone && Math.hypot(Q.x - pos.x, Q.z - pos.z) < 2.6) return { kind: 'dress', Q };
		return null;
	}
	function find() {
		if (fishing?.holding?.()) return { kind: 'fish', c: fishing.holding() };
		const P = world()?.player?.state;
		if (!P || P.flying) return null;
		return carcassHere() || kitchenHere() || shopHere();
	}

	// ---------- the kitchen's stock ----------
	function stockOf(k) {
		rollDay(K);
		return kitchenStock({ seed: hashKey(k.key), pantry: k.hh?.food?.pantry || null, rural: k.hh?.food?.place === 'rural' || k.hh?.food?.place === 'island', taken: K.houses[k.key] });
	}
	// a house's pantry, changed by what you took (or gave): people/food.js counts it in days
	function pantryChange(k, items, sign = -1) {
		const hh = k.hh;
		if (!hh?.food?.pantry) return;
		const loss = pantryLoss(items, mouths(hh), hh.food.place);
		for (const key of Object.keys(loss)) hh.food.pantry[key] = Math.max(0, hh.food.pantry[key] + sign * loss[key]);
		assess(hh);
	}
	function takeFrom(which, id) {
		const k = here?.kind === 'kitchen' ? here : null;
		if (!k) return;
		const S = stockOf(k)[which], n = S?.[id] || 0;
		if (!n) return;
		const put = stow(L, id, n);
		if (put <= 0) { hint('Your cool box has no room for more of that.', 2200); return; }
		tookFrom(K, k.key, id, put);
		pantryChange(k, { [id]: put });
		touch();
	}
	// your own food into their fridge: a gift to the house (stocking a family's kitchen)
	function putBack(id) {
		const k = here?.kind === 'kitchen' ? here : null;
		if (!k) return;
		const n = L.have[id] || 0, wild = Math.min(n, L.wild[id] || 0);
		if (!n) return;
		take(L, id, n);
		tookFrom(K, k.key, id, -n);
		pantryChange(k, { [id]: n }, +1);
		if (k.hh && (INGREDIENTS[id].meat || n >= INGREDIENTS[id].pack * 0.5)) {
			recordDeed(morality(), 'feed-family', { target: `a family (${describeHousehold(k.hh)})`, place: 'the neighbourhood', given: amountText(id, n), wild: wild > 0 }, pending);
			hint(`You left ${amountText(id, n)} in their fridge. That's a week's dinners easier for them.`, 3500);
		}
		touch();
	}
	function pay() {
		const k = here?.kind === 'kitchen' ? here : null;
		if (!k) return;
		const c = owed(K, k.key, k.place);
		if (c <= 0 || !spend(c, 'kitchen')) return;
		K.paid[k.key] = (K.paid[k.key] || 0) + c;
		if (k.hh?.food) { k.hh.food.gift = (k.hh.food.gift || 0) + c; assess(k.hh); }
		hint(`You left ${c} credits on the counter for what you used.`, 2600);
		touch();
	}

	// ---------- cooking ----------
	let job = null;
	// the stores a dish draws on: your larder first, then this kitchen's fridge and cupboards
	function stores() {
		const k = here?.kind === 'kitchen' ? here : null;
		if (!k) return [L.have];
		const S = stockOf(k);
		return [L.have, { ...S.fridge, ...S.cupboard }];
	}
	function startCook(id) {
		const r = RECIPE[id];
		if (!r || here?.kind !== 'kitchen' || !check(r, stores()).ok) return null;
		job = { id, t: 0, T: r.steps.length * STEP_S, done: false, plates: r.serves - 1, quality: 1, key: here.key, note: '' };
		walkInMaybe(here);
		return job;
	}
	function finish() {
		const k = here?.kind === 'kitchen' && here.key === job.key ? here : null;
		const r = RECIPE[job.id];
		if (!k) { job.note = 'You walked away from the stove and it all went cold.'; job.done = true; job.failed = true; return; }
		const kit = stores()[1] || {}, before = { ...kit };
		const res = cookRecipe(r, [L.have, kit], { wild: L.wild });
		if (!res) { job.note = 'Something you needed is gone. Nothing to plate up.'; job.done = true; job.failed = true; return; }
		settle(L);
		// what came out of their kitchen
		const used = {};
		for (const id of Object.keys(before)) { const d = before[id] - (kit[id] || 0); if (d > 1e-6) used[id] = d; }
		for (const [id, n] of Object.entries(used)) tookFrom(K, k.key, id, n);
		pantryChange(k, used);
		job.quality = res.quality; job.done = true;
		plate(L, r.id, res.quality, r.serves);
		note(L, `Cooked ${r.name}`);
		if (owner && owner.share) { const p = takePlate(L, r.id); if (p) feedOwner(); }
		touch();
		hint(`${r.name} is ready: ${r.serves} plates.`, 2500);
	}
	function cancel() { job = null; }

	// ---------- the shops ----------
	function shopNow() {
		if (here?.kind !== 'shop') return null;
		const short = here.hh ? 0 : districtShort();
		const list = shelves(here.shop, { seed: hashKey(here.key), place: here.place, short });
		return { name: here.name, shelves: list, offer: (id, n) => Math.round(worth(id, n, here.place) * 0.55) };
	}
	// how many houses round about are going short this week (their shelves empty first)
	function districtShort() {
		const a = families?.areaAt?.(camera.position.x, camera.position.z);
		const H = a?.households || [];
		return H.length ? H.filter((h) => h.food?.security === 'short').length / H.length : 0;
	}
	function buy(id) {
		const S = shopNow(), it = S?.shelves.find((q) => q.id === id);
		if (!it || it.out) return;
		const I = INGREDIENTS[id];
		if ((L.have[id] || 0) + it.pack > { g: 12000, ml: 6000, each: 60 }[I.unit]) { hint('Your cool box has no room for another of those.', 2200); return; }
		if (!spend(it.price, 'groceries')) { hint('Not enough credits.', 1800); return; }
		stow(L, id, it.pack);
		payroll.sale?.({ x: here.at.x, z: here.at.z }, it.price, null);
		touch();
	}
	function sell(id) {
		const S = shopNow(), n = L.wild[id] || 0, c = S?.offer(id, n) || 0;
		if (!c) return;
		take(L, id, n);
		if (earn(c, 'grocer')) hint(`Sold ${amountText(id, n)} of your own for ${c} credits.`, 2600);
		touch();
	}

	// ---------- your catch and your kill ----------
	function keepFish() {
		const c = fishing?.keep?.();
		if (!c) return;
		const M = fishMeat(c.fish), g = filletGrams(c.fish, c.lb), put = stow(L, M.id, g, { wild: true });
		hint(put > 0 ? `You fillet the ${c.fish}: ${amountText(M.id, put)} into your cool box.` : 'Your cool box is full: you let it go.', 3200);
		touch();
	}
	function dress(Q) {
		const G = gameMeat(Q.kind);
		Q.A.gone = true;
		if (!G) return;
		const keep = Math.min(G.g, CARRY_G), put = stow(L, G.id, keep, { wild: true });
		const rest = (G.g - put) / 1000;
		let shared = '';
		if (rest >= 1 && families?.help) { const msg = families.help('catch', { kg: Math.round(rest) }); if (!/first/.test(msg)) shared = ` The rest (${Math.round(rest)} kg) goes to families round about.`; }
		hint(`You dress the ${G.name}: ${amountText(G.id, put)} into your pack.${shared}`, 4200);
		touch();
	}
	// a shot along dir from o, up to maxT: the distance to the game it took, or -1
	const _c = new THREE.Vector3();
	function quarry(o, dir, maxT) {
		let best = -1, hitQ = null;
		for (const Q of world()?.wildlife?.quarry?.() || []) {
			if (Q.A.dead || Q.A.gone) continue;
			_c.set(Q.x - o.x, Q.y - o.y, Q.z - o.z);
			const along = _c.dot(dir);
			if (along < 0 || along > maxT) continue;
			const off2 = _c.lengthSq() - along * along;
			if (off2 > Q.r * Q.r) continue;
			if (best < 0 || along < best) { best = along; hitQ = Q; }
		}
		if (hitQ) {
			hitQ.A.dead = true;
			hint(`Clean shot: the ${hitQ.kind} is down. Walk up to it to dress it.`, 3000);
		}
		return best;
	}
	if (combat?.hooks) combat.hooks.quarry = quarry;

	// ---------- the one prompt ----------
	const act = button('🍳 Kitchen', 'Kitchen (E)', 'display:none;', 'prompt 57');
	mount.appendChild(act);
	for (const ev of ['pointerdown', 'touchstart']) act.addEventListener(ev, (e) => e.stopPropagation());
	function useHere() {
		if (!here) return;
		if (here.kind === 'fish') keepFish();
		else if (here.kind === 'dress') dress(here.Q);
		else if (here.kind === 'kitchen') panel.open('kitchen');
		else if (here.kind === 'shop') panel.open('shop');
		hereT = 0;
	}
	act.addEventListener('click', (e) => { e.stopPropagation(); useHere(); });
	addEventListener('keydown', (e) => {
		if ((e.key !== 'e' && e.key !== 'E') || !here || e.repeat || e.metaKey || e.ctrlKey || panel.isOpen()) return;
		if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '') || window._KEYS_PLAY_ON) return;
		if (doorNear() && here.kind !== 'fish' && here.kind !== 'dress') return;
		e.preventDefault(); useHere();
	});
	function label(h) {
		const key = isPhone ? '' : ' (E)';
		if (h.kind === 'fish') return `🐟 Keep the ${h.c.fish}${key}`;
		if (h.kind === 'dress') return `🔪 Dress the ${h.Q.kind}${key}`;
		if (h.kind === 'kitchen') return job ? `🍳 Cooking ${RECIPE[job.id].name}${key}` : `🍳 Kitchen${key}`;
		return `🛒 ${h.name}${key}`;
	}

	// ---------- the panel ----------
	const panel = createCookingPanel({ mount, isPhone, api: {
		context: () => {
			const k = here?.kind === 'kitchen' ? here : null;
			const stock = k ? stockOf(k) : null;
			return {
				job, credits: credits(), larder: L, meals: active(L.meals), plates: freshPlates(L),
				stores: stores(), shop: shopNow(), canGive: !!owner?.near,
				kitchen: k && { name: k.name, line: k.line, stock, owed: owed(K, k.key, k.place), owner: owner?.first || null },
			};
		},
		take: takeFrom, putBack, pay, buy, sell, eatPlate, cancel, clearJob: () => { if (job?.done) job = null; },
		cook: (id) => startCook(id),
		givePlate: () => { if (takePlate(L)) feedOwner(); touch(); },
		closed: () => { drawMenu(); },
	} });

	// ---------- someone walks in ----------
	// (the body kit is only asked for once someone is coming: nothing more held on a phone till then)
	let A = null, owner = null, loadingA = null;
	const assets = () => { if (!A && !loadingA) loadingA = loadPeopleAssets().then((x) => { A = x; }).catch(() => {}).finally(() => { loadingA = null; }); };
	function walkInMaybe(k) {
		if (owner || !k.house) return;
		const h = hours(), chance = h > 17 && h < 21.5 ? 0.6 : h > 6.5 && h < 17 ? 0.35 : 0.25;
		if (Math.random() > chance) return;
		const hh = k.hh, adults = hh ? hh.members.filter((m) => m.age >= 18) : [];
		const m = adults.length ? adults[Math.floor(Math.random() * adults.length)] : { seed: (Math.random() * 2 ** 31) >>> 0, age: 30 + Math.random() * 35, male: Math.random() < 0.5 };
		owner = { k, m, hh, due: 3 + Math.random() * 4, state: 'due', t: 0, first: null };
		assets();
	}
	function spawnOwner() {
		const o = owner, k = o.k, h = k.house, pos = camera.position;
		// from somewhere in the house behind you, a few steps off, with a clear line to you
		const yaw = world()?.player?.state?.yaw || 0;
		let from = null;
		for (const a of [Math.PI, Math.PI * 0.75, -Math.PI * 0.75, Math.PI / 2, -Math.PI / 2, 0]) {
			for (const d of [4.5, 3.5, 2.6]) {
				const x = pos.x - Math.sin(yaw + a) * d, z = pos.z - Math.cos(yaw + a) * d;
				if (!insideHouse(h, x, z) || !clearLine(h, x, z, pos.x, pos.z)) continue;
				from = [x, z]; break;
			}
			if (from) break;
		}
		if (!from) { owner = null; return; }
		const ctx = { hours: hours(), place: 'suburb', activity: 'walk' };
		let d = personDNA(o.m.seed >>> 0, { age: Math.min(80, Math.max(18, o.m.age)), ancestry: o.m.ancestry, ctx });
		for (let i = 1; o.m.male !== undefined && d.male !== o.m.male && i < 48; i++) d = personDNA((o.m.seed + Math.imul(i, 0x9e3779b9)) >>> 0, { age: Math.min(80, Math.max(18, o.m.age)), ancestry: o.m.ancestry, ctx });
		const P = buildPerson(A, d);
		const fy = k.floorY;
		const M = createMotion(P, () => fy, { constrain(to, fromV) { const s = safeSocialStep(world()?.island, fromV, to, world()?.player); if (s) to.set(s.x, s.y, s.z); else to.copy(fromV); } });
		M.setGround?.(() => fy);
		scene.add(P.root);
		if (isPhone) P.root.traverse((q) => { q.castShadow = false; });
		M.place(from[0], fy, from[1], Math.atan2(pos.x - from[0], pos.z - from[1]));
		fadePerson(P, 0.02);
		const body = { P, M, active: true, fade: 0, source: 'cooking', talk: { open: () => talkOpen(), reply: () => null } };
		if (o.hh) P.home = { household: o.hh, member: o.m };
		o.body = body; o.state = 'walk'; o.t = 0;
	}
	function insideHouse(h, x, z) { const dx = x - h.M.x, dz = z - h.M.z, lx = h.ca * dx + h.sa * dz, lz = -h.sa * dx + h.ca * dz, c = h.plan.cellAt?.(lx, lz); return c >= 0 && h.plan.occ?.[c] >= 0; }
	function clearLine(h, x0, z0, x1, z1) { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.3); for (let i = 1; i < n; i++) if (!insideHouse(h, x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n)) return false; return true; }
	// what they say: caught off guard in their own kitchen, then won over
	const OPEN = [
		'Oh! Uh. Hi? You\'re... in my kitchen. With my pan.',
		'I came down for a glass of water and there\'s a stranger making dinner. Okay. Okay.',
		'Sorry, I think you have the wrong... no, you\'re definitely cooking. In my house.',
		'Is that my good knife? Who are you?',
		'I smelled garlic from the driveway and thought: I didn\'t buy garlic.',
	];
	const LET = [
		'You know what, it smells too good to stop now. Carry on, chef.',
		'Fine. Fine! But you\'re washing up.',
		'I\'m not even mad, I\'m impressed. Keep going.',
		'Honestly I wasn\'t going to cook tonight anyway. Go on.',
	];
	const pick = (a) => a[Math.floor(Math.random() * a.length)];
	function talkOpen() {
		const o = owner;
		if (!o) return null;
		const x = o.hh ? hungerAt(hours(), { seed: o.m.seed, quality: o.hh.food?.quality ?? 0.6, security: o.hh.food?.security }) : 0.5;
		o.hunger = x;
		const r = job ? RECIPE[job.id] : null;
		const tail = hungerWord(x) === 'fed' ? '' : ` ${hungerLine(x, o.m.seed)}`;
		return {
			say: `${pick(OPEN)}${r ? ` Is that ${r.name.toLowerCase()}?` : ''}${tail}`,
			choices: [
				{ label: 'Sorry! I was starving. I\'ll pay for what I use.', fn: () => { const c = Math.max(5, owed(K, o.k.key, o.k.place) + (r ? 15 : 5)); if (spend(c, 'kitchen')) { K.paid[o.k.key] = (K.paid[o.k.key] || 0) + c; if (o.hh?.food) { o.hh.food.gift = (o.hh.food.gift || 0) + c; assess(o.hh); } touch(); return { say: `${c} credits? ...Deal. ${pick(LET)}` }; } return { say: 'With what money? Ha. Look, just finish it. ' + pick(LET) }; } },
				{ label: r ? `Want a plate? It serves ${r.serves}.` : 'Want something to eat?', fn: () => { o.share = true; if (!job || job.done) feedOwner(); return { say: x > 0.5 ? 'Oh thank god, yes. I haven\'t eaten since lunch. Carry on, I\'ll set the table.' : 'You\'re cooking for me now? In my kitchen? ...Yes. Obviously yes.' }; } },
				{ label: 'I\'m a friend of your cousin.', fn: () => ({ say: 'I don\'t have a cousin. ...Is that rosemary? Okay, you can stay. Just this once.' }) },
				{ label: 'This isn\'t what it looks like.', fn: () => ({ say: 'It looks like you\'re making dinner in my house. ' + pick(LET) }) },
			],
		};
	}
	function feedOwner() {
		const o = owner;
		if (!o) return;
		o.share = false; o.fed = true;
		if (o.hh?.well) for (const m of o.hh.members) { const w = o.hh.well[m.id]; if (w) w.mood = Math.min(1, w.mood + 0.15); }
		recordDeed(morality(), 'feed-family', { target: `a family (${o.hh ? describeHousehold(o.hh) : 'a household'})`, place: 'the neighbourhood', cooked: true }, pending);
		o.body?.M?.feel?.('joy', 0.7); o.body?.M?.gesture?.('nod');
		hint('They take the plate and sit down to eat. You\'ve made a friend.', 3200);
	}
	if (addTalkers) addTalkers(() => (owner?.body && owner.state !== 'gone' ? [owner.body] : []));
	function stepOwner(dt, t) {
		const o = owner;
		if (!o) return;
		o.t += dt;
		if (o.state === 'due') { if (o.t > o.due && (A || o.t > o.due + 20)) { if (A && here?.kind === 'kitchen' && here.key === o.k.key) spawnOwner(); else owner = null; } return; }
		const B = o.body;
		if (!B) { owner = null; return; }
		const S = B.M.S, pos = camera.position, d = Math.hypot(pos.x - S.pos.x, pos.z - S.pos.z);
		o.near = d < 4;
		if (o.state === 'walk') {
			if (d > 1.4 && o.t < 8) { B.M.want.heading = Math.atan2(pos.x - S.pos.x, pos.z - S.pos.z); B.M.want.speed = Math.min(1.2, d); }
			else { B.M.want.speed = 0; S.look.target = pos; o.state = 'talk'; o.t = 0; B.M.feel?.('surprise', 0.85); B.M.gesture?.('shake'); talkTo?.(B); }
		} else if (o.state === 'talk') {
			B.M.want.speed = 0; S.look.target = pos;
			// (they stay while you cook, and go once it's done or you've left)
			if ((!job && o.t > 20) || (job?.done && o.t > 12) || d > 12 || here?.key !== o.k.key && o.t > 6) { o.state = 'leave'; o.t = 0; }
		} else if (o.state === 'leave') {
			B.M.want.speed = 0;
			B.fade = Math.max(0, (B.fade ?? 1) - dt / 2.5); fadePerson(B.P, B.fade);
			if (B.fade <= 0) { B.active = false; B.P.root.removeFromParent(); freeBody(B.P); o.state = 'gone'; owner = null; return; }
		}
		if (o.state !== 'leave') { B.fade = Math.min(1, (B.fade || 0) + dt * 1.5); fadePerson(B.P, B.fade); }
		B.M.update(dt, t, pos);
		// (on a phone the close-up detail stays off: one body, kept light)
		B.P.lod?.(isPhone ? Math.max(d, 15) : d);
	}

	// ---------- the places menu: your meals and larder ----------
	let menuBtn = null;
	function drawMenu() {
		if (!menuBtn) return;
		const n = active(L.meals).length, p = freshPlates(L).length;
		menuBtn.textContent = `🍲 Meals and larder${n ? ` · ${n} of ${MAX_MEALS} on you` : ''}${p ? ` · ${p} plate${p > 1 ? 's' : ''}` : ''}`;
	}
	function addMenu(menu) {
		if (!menu || menuBtn) return;
		menuBtn = document.createElement('button');
		menuBtn.type = 'button';
		menuBtn.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(94,234,212,.35);background:rgba(1,169,130,.12);color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;';
		for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) menuBtn.addEventListener(ev, (x) => x.stopPropagation());
		menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = 'none'; panel.open(here?.kind === 'kitchen' ? 'kitchen' : 'larder'); });
		menu.insertBefore(menuBtn, menu.children[1] || null);
		drawMenu();
	}

	// ---------- each frame ----------
	let lastQ = -1, t = 0;
	applyMeals();
	function update(dt) {
		t += dt;
		hereT -= dt; sitesT -= dt; saveT -= dt; mealsT -= dt;
		if (hereT <= 0) {
			hereT = 0.2;
			here = find();
			const show = !!here && !panel.isOpen();
			act.style.display = show ? '' : 'none';
			if (show) { const s = label(here); if (act.textContent !== s) act.textContent = s; }
		}
		if (job && !job.done) {
			job.t += dt;
			const q = Math.floor(job.t * 4);
			if (job.t >= job.T) { finish(); panel.refresh(); }
			else if (q !== lastQ && panel.isOpen()) { lastQ = q; panel.refresh(); }
		}
		// (a dish ready with the panel shut: its plates are in your larder)
		if (job?.done && !panel.isOpen()) job = null;
		stepOwner(dt, t);
		// (a meal wearing off at 4 am, and the stats made anew)
		if (mealsT <= 0) { mealsT = 30; if (active(L.meals).length !== L.meals.length) { applyMeals(); drawMenu(); touch(); } }
		if (dirty && saveT <= 0) { saveT = 5; save(); }
	}
	addEventListener('pagehide', () => { if (dirty) save(); });

	return {
		update, addMenu, open: (v) => panel.open(v || 'larder'), close: () => panel.close(), isOpen: () => panel.isOpen(),
		// (for a look: Crysis.cooking.give('venison', 900), .info(), .eat('chili'))
		give: (id, n) => { const put = stow(L, id, n); touch(); return put; },
		eat: (id) => { plate(L, id, 1, 1); return eatPlate(id); },
		info: () => ({ here: here?.kind || null, larder: { ...L.have }, wild: { ...L.wild }, plates: freshPlates(L).map((p) => p.id), meals: active(L.meals).map((m) => ({ id: m.id, q: m.q, until: new Date(m.until).toString() })), job: job && { id: job.id, t: +job.t.toFixed(1), T: job.T, done: job.done }, owner: owner && { state: owner.state }, pendingDeeds: pending.length }),
		quarry, keepFish, stock: () => (here?.kind === 'kitchen' ? stockOf(here) : null),
		hunger: (h, o) => hungerAt(h, o), STORE_OF,
	};
}
