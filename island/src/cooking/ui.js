// The kitchen, the shop and your meals, as one panel (cooking/index.js drives it): at a stove, the
// recipes you could make with what is in your larder and this kitchen, the fridge and the
// cupboards to take from, and the cooking itself, step by step; at a shop, its aisles to buy from
// and a counter that buys your catch; anywhere, your larder, your plates and the meals on you
// today. Real buttons throughout, so a pad or a keyboard can walk them (Tab, Enter).

import { INGREDIENTS, KEEPS, amountText } from './ingredients.js';
import { RECIPE, rank, buffText, optionsOf } from './recipes.js';
import { leftText, MAX_MEALS } from './meals.js';

const CSS = `
.ck-root{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:30;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);font:14px var(--bard-body,system-ui,sans-serif);color:#fff}
.ck-card{width:min(620px,94vw);max-height:min(86vh,860px);display:flex;flex-direction:column;background:#141414;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.8);overflow:hidden}
.ck-phone .ck-card{width:100%;height:100%;max-height:none;border-radius:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}
.ck-head{display:flex;align-items:center;gap:10px;padding:14px 16px 10px}
.ck-title{font:700 18px inherit;flex:1;line-height:1.25}
.ck-sub{font-size:12px;color:rgba(255,255,255,.6);margin-top:2px;font-weight:400}
.ck-x{min-width:44px;min-height:44px;border-radius:10px;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.75);font-size:18px;cursor:pointer}
.ck-tabs{display:flex;gap:4px;padding:0 12px;border-bottom:1px solid rgba(255,255,255,.08);overflow-x:auto}
.ck-tab{padding:10px 14px;border:0;border-bottom:3px solid transparent;background:none;color:rgba(255,255,255,.65);font:600 13px inherit;cursor:pointer;white-space:nowrap;min-height:44px}
.ck-tab.on{color:#fff;border-bottom-color:#01a982}
.ck-body{padding:12px 16px 16px;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;flex:1}
.ck-row{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.04);margin-bottom:6px}
.ck-row .n{flex:1;min-width:0}
.ck-row .a{font-size:12px;color:rgba(255,255,255,.6)}
.ck-btn{min-height:40px;padding:8px 14px;border-radius:8px;border:none;background:linear-gradient(135deg,#01a982,#10b981);color:#fff;font:600 13px inherit;cursor:pointer;white-space:nowrap;box-shadow:0 4px 12px rgba(1,169,130,.3)}
.ck-btn.g{background:transparent;border:1px solid rgba(255,255,255,.2);color:rgba(255,255,255,.85);box-shadow:none}
.ck-btn:disabled{opacity:.4;cursor:default;box-shadow:none}
.ck-btn:focus-visible,.ck-tab:focus-visible,.ck-x:focus-visible{outline:2px solid #01a982;outline-offset:2px}
.ck-h{font:600 12px inherit;letter-spacing:.06em;text-transform:uppercase;color:rgba(255,255,255,.5);margin:14px 0 6px}
.ck-rec{border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:12px;margin-bottom:10px;background:#1a1a1a}
.ck-rec.ok{border-color:rgba(1,169,130,.45)}
.ck-rec h4{margin:0;font:700 15px inherit}
.ck-meta{font-size:12px;color:rgba(255,255,255,.6);margin:2px 0 6px}
.ck-buff{display:inline-flex;gap:6px;align-items:center;padding:4px 10px;border-radius:16px;background:rgba(1,169,130,.18);color:#5eead4;font:600 12px inherit;margin:4px 0 8px}
.ck-ing{display:grid;grid-template-columns:1fr;gap:2px;font-size:13px;margin:6px 0 10px}
.ck-ing .y{color:#cfe}
.ck-ing .y:before{content:'✓ ';color:#10b981}
.ck-ing .m{color:#fca5a5}
.ck-ing .m:before{content:'✗ ';color:#ef4444}
.ck-ing .o{color:rgba(255,255,255,.45)}
.ck-ing .o:before{content:'○ '}
.ck-bar{height:8px;background:rgba(255,255,255,.1);border-radius:4px;overflow:hidden;margin:10px 0}
.ck-fill{height:100%;width:0;background:linear-gradient(135deg,#01a982,#10b981);transition:width .3s ease}
.ck-step{font-size:15px;line-height:1.5;min-height:3em}
.ck-pill{display:inline-block;padding:2px 8px;border-radius:10px;font:600 11px inherit;background:rgba(59,130,246,.2);color:#93c5fd;margin-left:6px}
.ck-pill.w{background:rgba(245,158,11,.2);color:#fcd34d}
.ck-note{font-size:12px;color:rgba(255,255,255,.6);margin:6px 0}
.ck-foot{display:flex;gap:8px;flex-wrap:wrap;padding:10px 16px;border-top:1px solid rgba(255,255,255,.08);align-items:center}
.ck-foot .s{flex:1;font-size:12px;color:rgba(255,255,255,.6)}
`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createCookingPanel({ mount, isPhone = false, api }) {
	if (!document.getElementById('ck-css')) { const st = document.createElement('style'); st.id = 'ck-css'; st.textContent = CSS; document.head.appendChild(st); }
	const root = document.createElement('div');
	root.className = 'ck-root' + (isPhone ? ' ck-phone' : '');
	root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Kitchen');
	root.innerHTML = '<div class="ck-card"><div class="ck-head"><div class="ck-title"></div><button type="button" class="ck-x" aria-label="Close">✕</button></div><div class="ck-tabs" role="tablist"></div><div class="ck-body"></div><div class="ck-foot"></div></div>';
	mount.appendChild(root);
	const $ = (s) => root.querySelector(s);
	const title = $('.ck-title'), tabs = $('.ck-tabs'), body = $('.ck-body'), foot = $('.ck-foot');
	// (the game's keys stay out while it is open; Escape closes it)
	for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup', 'wheel', 'click', 'contextmenu']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') close(); });
	$('.ck-x').addEventListener('click', () => close());
	root.addEventListener('click', (e) => { if (e.target === root) close(); });
	let where = 'larder', tab = 'larder', open_ = false;

	const TABS = {
		kitchen: [['cook', 'Cook'], ['fridge', 'Fridge'], ['cupboard', 'Cupboards'], ['larder', 'Your larder']],
		shop: [['shop', 'Shelves'], ['sell', 'Sell your catch'], ['larder', 'Your larder']],
		larder: [['larder', 'Your larder'], ['meals', 'Meals today'], ['book', 'Recipes']],
	};
	function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
	function btn(label, fn, cls = 'ck-btn', disabled = false) { const b = el('button', cls); b.type = 'button'; b.textContent = label; b.disabled = disabled; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); return b; }

	function draw() {
		if (!open_) return;
		const K = api.context();
		const head = where === 'kitchen' ? `${K.kitchen?.name || 'Kitchen'}` : where === 'shop' ? `${K.shop?.name || 'Shop'}` : 'Your larder and meals';
		const sub = where === 'kitchen' ? (K.kitchen?.line || '') : where === 'shop' ? `${K.credits} credits to spend` : `${K.meals.length} of ${MAX_MEALS} meals on you today`;
		title.innerHTML = `${esc(head)}<div class="ck-sub">${esc(sub)}</div>`;
		tabs.innerHTML = '';
		for (const [id, label] of TABS[where]) {
			const b = btn(label, () => { tab = id; draw(); }, 'ck-tab' + (tab === id ? ' on' : ''));
			b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', tab === id ? 'true' : 'false');
			tabs.appendChild(b);
		}
		body.innerHTML = ''; foot.innerHTML = '';
		if (K.job && where === 'kitchen') return drawJob(K, K.job);
		({ cook: drawCook, fridge: () => drawStore(K, 'fridge'), cupboard: () => drawStore(K, 'cupboard'), larder: drawLarder, meals: drawMeals, book: drawBook, shop: drawShop, sell: drawSell })[tab]?.(K);
		drawFoot(K);
	}
	function drawFoot(K) {
		if (where === 'kitchen' && K.kitchen) {
			const s = el('div', 's', K.kitchen.owed > 0 ? `You've used about ${K.kitchen.owed} credits of their food today.` : K.kitchen.owner ? `${esc(K.kitchen.owner)}'s kitchen.` : 'Somebody\'s kitchen.');
			foot.appendChild(s);
			if (K.kitchen.owed > 0) foot.appendChild(btn(`Leave ${K.kitchen.owed} credits`, () => { api.pay(); draw(); }, 'ck-btn g', K.credits < K.kitchen.owed));
		} else foot.appendChild(el('div', 's', `${K.credits} credits · ${K.meals.length ? K.meals.map((m) => RECIPE[m.id].buff.name).join(', ') : 'no meal on you yet'}`));
	}
	// the recipes: those you can make first, each with what it needs (✓ have, ✗ missing, ○ optional)
	function recipeCard(r, c, { cookable = true } = {}) {
		const card = el('div', 'ck-rec' + (c.ok ? ' ok' : ''));
		card.innerHTML = `<h4>${esc(r.name)}</h4><div class="ck-meta">${esc(r.from)} · serves ${r.serves} · about ${r.minutes} min in a real kitchen</div><div class="ck-note">${esc(r.line)}</div><div class="ck-buff">✦ ${esc(r.buff.name)}: ${esc(buffText(r.buff.mods))}</div>`;
		const ing = el('div', 'ck-ing');
		for (const l of c.lines) {
			const id = l.id || optionsOf(l.line)[0], alt = optionsOf(l.line).length > 1 && !l.id ? ` (or ${optionsOf(l.line).slice(1).map((x) => INGREDIENTS[x].name).join(', ')})` : '';
			ing.appendChild(el('div', l.id ? 'y' : l.optional ? 'o' : 'm', esc(amountText(id, l.need) + alt + (l.optional ? ', if you have it' : ''))));
		}
		card.appendChild(ing);
		if (cookable) card.appendChild(btn(c.ok ? `Cook ${r.name}` : `Missing ${c.missing.length}`, () => { api.cook(r.id); draw(); }, 'ck-btn', !c.ok));
		return card;
	}
	function drawCook(K) {
		body.appendChild(el('div', 'ck-note', 'What you carry is used first, then what is in this kitchen. Herbs and extras marked ○ make it better if they are here.'));
		for (const { r, c } of rank(K.stores)) body.appendChild(recipeCard(r, c));
	}
	function drawBook(K) {
		body.appendChild(el('div', 'ck-note', 'Every dish you can cook, with what you carry now. Cook at any kitchen: a house, a flat, a cottage.'));
		for (const { r, c } of rank([K.larder.have])) body.appendChild(recipeCard(r, c, { cookable: false }));
	}
	function drawStore(K, which) {
		const S = K.kitchen?.stock?.[which] || {};
		const ids = Object.keys(S).sort((a, b) => INGREDIENTS[a].keep.localeCompare(INGREDIENTS[b].keep) || INGREDIENTS[a].name.localeCompare(INGREDIENTS[b].name));
		body.appendChild(el('div', 'ck-note', which === 'fridge' ? `${KEEPS.fridge.line} ${KEEPS.freezer.line}` : `${KEEPS.cupboard.line} ${KEEPS.spices.line} ${KEEPS.counter.line}`));
		if (!ids.length) body.appendChild(el('div', 'ck-note', which === 'fridge' ? 'The fridge is bare: a light, a jar of something, and that is all.' : 'The cupboards are bare.'));
		let keep = '';
		for (const id of ids) {
			const I = INGREDIENTS[id];
			if (I.keep !== keep) { keep = I.keep; body.appendChild(el('div', 'ck-h', esc(KEEPS[keep].name))); }
			const row = el('div', 'ck-row', `<div class="n">${esc(I.name)}<div class="a">${esc(amountText(id, S[id]).replace(I.name, '').trim() || '')}</div></div>`);
			row.appendChild(btn('Take', () => { api.take(which, id); draw(); }, 'ck-btn g'));
			body.appendChild(row);
		}
	}
	function drawLarder(K) {
		const L = K.larder;
		if (K.plates.length) {
			body.appendChild(el('div', 'ck-h', 'Plates you kept'));
			for (const p of K.plates) {
				const r = RECIPE[p.id], row = el('div', 'ck-row', `<div class="n">${esc(r.name)}<div class="a">✦ ${esc(r.buff.name)} · good ${esc(leftText(p))}</div></div>`);
				row.appendChild(btn('Eat', () => { api.eatPlate(p.id); draw(); }));
				if (K.canGive) row.appendChild(btn('Give', () => { api.givePlate(p.id); draw(); }, 'ck-btn g'));
				body.appendChild(row);
			}
		}
		body.appendChild(el('div', 'ck-h', 'Food you carry'));
		const ids = Object.keys(L.have).sort((a, b) => INGREDIENTS[a].keep.localeCompare(INGREDIENTS[b].keep) || INGREDIENTS[a].name.localeCompare(INGREDIENTS[b].name));
		if (!ids.length) body.appendChild(el('div', 'ck-note', 'Nothing yet. Keep a fish you catch, dress game you take down, take from a kitchen or buy at a grocer.'));
		for (const id of ids) {
			const own = L.wild[id] ? '<span class="ck-pill">your own</span>' : '';
			const row = el('div', 'ck-row', `<div class="n">${esc(INGREDIENTS[id].name)}${own}<div class="a">${esc(amountText(id, L.have[id]))}</div></div>`);
			if (where === 'kitchen') row.appendChild(btn('Leave it in their kitchen', () => { api.putBack(id); draw(); }, 'ck-btn g'));
			body.appendChild(row);
		}
	}
	function drawMeals(K) {
		body.appendChild(el('div', 'ck-note', `A meal's strength lasts until ${4} am, through every fight and every death. Up to ${MAX_MEALS} different meals count at once; the same dish twice only tops it up.`));
		if (!K.meals.length) body.appendChild(el('div', 'ck-note', 'No meal on you yet today.'));
		for (const m of K.meals) {
			const r = RECIPE[m.id];
			body.appendChild(el('div', 'ck-row', `<div class="n">${esc(r.name)}<div class="a">✦ ${esc(r.buff.name)}: ${esc(buffText(r.buff.mods, m.q))} · ${esc(leftText(m))}</div></div>`));
		}
	}
	function drawShop(K) {
		const S = K.shop;
		if (!S) return;
		let aisle = '';
		for (const it of S.shelves) {
			if (it.aisle !== aisle) { aisle = it.aisle; body.appendChild(el('div', 'ck-h', esc(aisle))); }
			const row = el('div', 'ck-row', `<div class="n">${esc(it.name)}${it.out ? '<span class="ck-pill w">sold out today</span>' : ''}<div class="a">${esc(amountText(it.id, it.pack))}</div></div>`);
			row.appendChild(btn(`Buy · ${it.price}`, () => { api.buy(it.id); draw(); }, 'ck-btn', it.out || K.credits < it.price));
			body.appendChild(row);
		}
	}
	function drawSell(K) {
		const S = K.shop, L = K.larder;
		body.appendChild(el('div', 'ck-note', 'The counter buys fish and game you brought in yourself, by weight, at a little over half what it sells for.'));
		const ids = Object.keys(L.wild).filter((id) => INGREDIENTS[id].meat && L.wild[id] > 0);
		if (!ids.length) body.appendChild(el('div', 'ck-note', 'You have nothing of your own catch to sell.'));
		for (const id of ids) {
			const offer = S?.offer?.(id, L.wild[id]) || 0;
			const row = el('div', 'ck-row', `<div class="n">${esc(INGREDIENTS[id].name)}<div class="a">${esc(amountText(id, L.wild[id]))}</div></div>`);
			row.appendChild(btn(`Sell · ${offer}`, () => { api.sell(id); draw(); }, 'ck-btn g', !offer));
			body.appendChild(row);
		}
	}
	// cooking: each step of the method, one after another, the bar filling
	function drawJob(K, job) {
		const r = RECIPE[job.id], k = Math.min(1, job.t / job.T), i = Math.min(r.steps.length - 1, Math.floor(k * r.steps.length));
		body.appendChild(el('div', 'ck-h', job.done ? 'Ready' : `Step ${i + 1} of ${r.steps.length}`));
		body.appendChild(el('div', 'ck-step', esc(job.done ? (job.failed ? r.name : `${r.name} is ready. ${job.plates > 0 ? `You plate up ${job.plates + 1}: one for you now, ${job.plates} kept for later or for your crew.` : ''}`) : r.steps[i])));
		const bar = el('div', 'ck-bar'), fill = el('div', 'ck-fill'); fill.style.width = `${Math.round(k * 100)}%`; bar.appendChild(fill); body.appendChild(bar);
		if (job.note) body.appendChild(el('div', 'ck-note', esc(job.note)));
		if (job.done && job.failed) foot.appendChild(btn('Back to the recipes', () => { api.clearJob(); tab = 'cook'; draw(); }, 'ck-btn g'));
		else if (job.done) {
			body.appendChild(el('div', 'ck-buff', `✦ ${esc(r.buff.name)}: ${esc(buffText(r.buff.mods, job.quality))}`));
			foot.appendChild(btn('Eat now', () => { api.eatPlate(r.id); api.clearJob(); tab = 'larder'; draw(); }));
			foot.appendChild(btn('Keep it for later', () => { api.clearJob(); tab = 'larder'; draw(); }, 'ck-btn g'));
		} else foot.appendChild(btn('Stop cooking', () => { api.cancel(); draw(); }, 'ck-btn g'));
	}

	function open(view = 'larder', first = null) {
		where = view; tab = first || TABS[view][0][0]; open_ = true;
		root.style.display = 'flex';
		draw();
		root.querySelector('.ck-tab.on, .ck-btn')?.focus?.({ preventScroll: true });
	}
	function close() { open_ = false; root.style.display = 'none'; api.closed?.(); }
	return { open, close, isOpen: () => open_, refresh: draw, root };
}
