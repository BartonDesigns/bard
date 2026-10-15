// The alert on the screen while a catastrophe lasts: a banner under the waypoint chip with the
// red EMERGENCY ALERT stripe, the headline (what, how bad, where), a line of what to do now,
// the news as it comes in (one line at a time, the local station's), and a bar while you are
// at work on something (lifting rubble, holding a hose). It folds down to a small pill after a
// while so it does not sit over the world, and opens again when there is news. Phones get the
// same in a narrower, smaller banner.

export function createAlertHud(mount, { isPhone = false } = {}) {
	const css = (el, s) => { el.style.cssText = s; return el; };
	const root = css(document.createElement('div'), `position:absolute;left:50%;top:calc(${isPhone ? 136 : 140}px + env(safe-area-inset-top));transform:translateX(-50%);width:min(${isPhone ? 340 : 480}px,calc(100vw - 32px));box-sizing:border-box;pointer-events:none;display:none;z-index:6;font-family:system-ui,-apple-system,Segoe UI,sans-serif;transition:opacity .4s;`);
	root.setAttribute('role', 'alert');
	root.setAttribute('aria-live', 'assertive');
	const card = css(document.createElement('div'), 'border-radius:12px;overflow:hidden;background:rgba(14,10,10,.84);border:1px solid rgba(255,90,70,.45);box-shadow:0 6px 24px rgba(0,0,0,.45);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);');
	const stripe = css(document.createElement('div'), `display:flex;align-items:center;gap:8px;padding:${isPhone ? '4px 10px' : '5px 12px'};background:linear-gradient(90deg,#b3170f,#e2341f);color:#fff;font:800 ${isPhone ? 10.5 : 11.5}px/1.2 system-ui;letter-spacing:.14em;`);
	const dot = css(document.createElement('span'), 'width:8px;height:8px;border-radius:50%;background:#fff;flex-shrink:0;');
	const label = document.createElement('span');
	label.textContent = 'EMERGENCY ALERT';
	const phase = css(document.createElement('span'), 'margin-left:auto;font-weight:600;letter-spacing:.06em;opacity:.9;');
	stripe.append(dot, label, phase);
	const body = css(document.createElement('div'), `padding:${isPhone ? '7px 10px 8px' : '9px 13px 10px'};color:#fff;`);
	const head = css(document.createElement('div'), `font:700 ${isPhone ? 14 : 16}px/1.25 system-ui;`);
	const what = css(document.createElement('div'), `margin-top:3px;font:500 ${isPhone ? 12 : 13}px/1.3 system-ui;color:#ffd7cf;`);
	const bar = css(document.createElement('div'), 'margin-top:7px;height:5px;border-radius:3px;background:rgba(255,255,255,.14);overflow:hidden;display:none;');
	const fill = css(document.createElement('div'), 'height:100%;width:0;background:linear-gradient(90deg,#ffb347,#ffd76a);transition:width .15s linear;');
	bar.append(fill);
	const barText = css(document.createElement('div'), `margin-top:3px;font:600 ${isPhone ? 11 : 12}px/1.2 system-ui;color:#ffe2a8;display:none;`);
	const news = css(document.createElement('div'), `margin-top:7px;padding-top:6px;border-top:1px solid rgba(255,255,255,.12);font:500 ${isPhone ? 11 : 12}px/1.3 system-ui;color:rgba(255,255,255,.78);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:opacity .35s;`);
	body.append(head, what, bar, barText, news);
	card.append(stripe, body);
	root.append(card);
	mount.append(root);

	let shown = false, open = true, openT = 0, blink = 0, queue = [], newsT = 0, lastNews = '';
	function show(headline, line = '') {
		shown = true; root.style.display = ''; root.style.opacity = '1';
		head.textContent = headline; what.textContent = line;
		unfold(14);
	}
	function unfold(s = 10) { open = true; openT = s; body.style.display = ''; }
	function say(line) { if (line && line !== what.textContent) { what.textContent = line; unfold(10); } }
	function setPhase(t) { phase.textContent = t || ''; }
	// a line of news: queued, shown one at a time for a few seconds each
	function headlineNews(line) { if (line && line !== lastNews && !queue.includes(line)) queue.push(line); }
	// work under way: k 0..1 (null hides the bar), and what it is
	function progress(k, text = '') {
		const on = k != null;
		bar.style.display = on ? '' : 'none'; barText.style.display = on ? '' : 'none';
		if (on) { fill.style.width = `${Math.round(Math.max(0, Math.min(1, k)) * 100)}%`; barText.textContent = text; unfold(4); }
	}
	function hide() { shown = false; root.style.opacity = '0'; setTimeout(() => { if (!shown) root.style.display = 'none'; }, 450); queue = []; lastNews = ''; progress(null); }
	function update(dt) {
		if (!shown) return;
		blink += dt;
		dot.style.opacity = Math.sin(blink * 6) > 0 ? '1' : '0.25';
		newsT -= dt;
		if (newsT <= 0 && queue.length) { lastNews = queue.shift(); news.textContent = `NEWS · ${lastNews}`; newsT = 6.5; unfold(7); }
		if (open && (openT -= dt) <= 0 && bar.style.display === 'none') { open = false; body.style.display = 'none'; }
	}
	function dispose() { root.remove(); }
	return { show, say, setPhase, news: headlineNews, progress, hide, update, dispose, unfold, shown: () => shown, text: () => ({ head: head.textContent, what: what.textContent, news: news.textContent, phase: phase.textContent, open }) };
}
