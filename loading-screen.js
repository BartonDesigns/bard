/* Shared by the faceplate door and the world: present before the engine downloads. */
(function () {
	'use strict';
	if (window.L99Loading) return;
	const source = document.currentScript?.src;
	const base = source ? new URL('assets/loading/', source) : new URL(location.pathname.includes('/island/') ? '../assets/loading/' : './assets/loading/', document.baseURI);
	const stories = [
  {
    "image": "horizon",
    "title": "Follow the unheard.",
    "text": "Fly into orbit. Return where you left.",
    "position": "50% 50%",
    "zoom": 1
  },
  {
    "image": "resonance",
    "title": "Leave an echo.",
    "text": "Play the stones. Watch the cavern respond.",
    "position": "55% 48%",
    "zoom": 1.22
  },
  {
    "image": "settlement",
    "title": "Find your people.",
    "text": "Ask a resident to follow, scout or help.",
    "position": "38% 45%",
    "zoom": 1.22
  },
  {
    "image": "beyond",
    "title": "The held note.",
    "text": "Listen for seven voices beyond the horizon.",
    "position": "50% 45%",
    "zoom": 1.22
  },
  {
    "image": "island",
    "title": "Start anywhere.",
    "text": "Walk, fly or follow the shoreline.",
    "position": "50% 48%",
    "zoom": 1.22
  },
  {
    "image": "discovery",
    "title": "Look closer.",
    "text": "Small places hold their own discoveries.",
    "position": "42% 50%",
    "zoom": 1.22
  },
  {
    "image": "deep",
    "title": "Go deeper.",
    "text": "Listen at the Deep Gate.",
    "position": "50% 53%",
    "zoom": 1.22
  },
  {
    "image": "interior",
    "title": "A room with a view.",
    "text": "Step inside the places you discover.",
    "position": "50% 48%",
    "zoom": 1.22
  },
  {
    "image": "earth",
    "title": "Find your way home.",
    "text": "Earth remembers your point of departure.",
    "position": "50% 50%",
    "zoom": 1
  },
  {
    "image": "terran",
    "title": "Another world awaits.",
    "text": "Every planet has a different landscape.",
    "position": "50% 50%",
    "zoom": 1
  },
  {
    "image": "atmosphere",
    "title": "Keep climbing.",
    "text": "The surface gives way to the stars.",
    "position": "50% 50%",
    "zoom": 1
  },
  {
    "image": "sun",
    "title": "Into the light.",
    "text": "Explore beyond the familiar planets.",
    "position": "50% 50%",
    "zoom": 1
  },
  {
    "image": "streets",
    "title": "Take the long way.",
    "text": "Follow streets into new neighborhoods.",
    "position": "50% 50%",
    "zoom": 1.22
  },
  {
    "image": "crew",
    "title": "You are not alone.",
    "text": "Talk to the people you meet.",
    "position": "50% 45%",
    "zoom": 1.22
  }
];
	let view, current = null, serial = 0, storyIndex = -1, imageSerial = 0, slowTimer, restore = [], previousFocus, backgroundObserver;
	function element(tag, cls, text, parent) {
		const el = document.createElement(tag); el.className = cls;
		if (text) el.textContent = text;
		parent?.appendChild(el); return el;
	}
	function create() {
		if (view) return;
		const style = element('style', '');
		style.textContent = `
#bard-loading{position:fixed;inset:0;z-index:2147483000;isolation:isolate;box-sizing:border-box;background:#070e12;color:#f5f1e7;font:15px/1.5 system-ui,-apple-system,sans-serif;overflow:auto;overscroll-behavior:contain;touch-action:pan-y;color-scheme:dark}
#bard-loading[hidden],#bard-loading [hidden]{display:none!important}#bard-loading *{box-sizing:border-box}#bard-loading button{font:inherit;cursor:pointer;touch-action:manipulation}
#bard-loading .bl-art{position:absolute;inset:0;overflow:hidden;z-index:-3;background:radial-gradient(ellipse at 70% 30%,#43432f,#102b31 44%,#060d12 80%)}
#bard-loading .bl-art img{width:100%;height:100%;object-fit:cover;transform:scale(1.22);filter:saturate(.78) contrast(1.08) brightness(.82);opacity:0;transition:opacity 1.1s ease;position:absolute;inset:0}
#bard-loading .bl-art img.loaded{opacity:1}#bard-loading:before{content:'';position:absolute;inset:0;z-index:-2;background:linear-gradient(90deg,#061015a6,transparent 70%),linear-gradient(0deg,#060d12 2%,#060d12e8 18%,#060d1280 45%,transparent 76%);pointer-events:none}
#bard-loading:after{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.16;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.86' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23fff' filter='url(%23n)' opacity='.33' d='M0 0h160v160H0z'/%3E%3C/svg%3E")}
#bard-loading .bl-shell{min-height:100%;min-height:100dvh;display:flex;flex-direction:column;padding:max(30px,env(safe-area-inset-top)) max(5.6vw,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(5.6vw,env(safe-area-inset-left));gap:24px}
#bard-loading .bl-top,#bard-loading .bl-footer{display:flex;align-items:center;justify-content:space-between;gap:20px}
#bard-loading .bl-brand{font:500 23px/1 Georgia,serif;letter-spacing:.24em}
#bard-loading .bl-back{background:#09151c70;border:1px solid #f5f1e745;border-radius:24px;color:inherit;padding:9px 17px;min-height:44px;font-size:12px}
#bard-loading .bl-content{margin-top:auto;padding-top:32vh;max-width:720px}
#bard-loading h1{font:400 clamp(36px,5vw,72px)/1.05 Georgia,serif;letter-spacing:-.035em;margin:0;text-wrap:balance}
#bard-loading .bl-tip{font-size:14px;color:#d6dfde;line-height:1.5;margin:16px 0 0;max-width:460px}
#bard-loading .bl-footer{border-top:1px solid #ffffff30;padding-top:18px;align-items:end}
#bard-loading .bl-state{flex:1;max-width:480px}#bard-loading .bl-status{font-size:12px}
#bard-loading .bl-track{height:2px;background:#ffffff26;margin:12px 0 0;overflow:hidden}#bard-loading .bl-fill{height:100%;width:24%;background:#e1c58e;animation:bl-search 2.8s ease-in-out infinite}
#bard-loading .bl-sub{font-size:11px;color:#b9c6c6;line-height:1.4;margin:9px 0 0}#bard-loading .bl-sub:empty{display:none}
#bard-loading .bl-enter{min-height:48px;padding:12px 22px;border:1px solid #e8d19e;background:#e8d19e;color:#121c20;border-radius:3px;font-size:13px;font-weight:650;flex-shrink:0}
#bard-loading button:focus-visible,#bard-loading:focus-visible{outline:2px solid #f5dfac;outline-offset:4px}
#bard-loading[data-state=ready] .bl-fill{width:100%;animation:none}#bard-loading[data-state=error] .bl-fill{width:100%;animation:none;background:#deae96}
@keyframes bl-search{0%{transform:translateX(-110%)}100%{transform:translateX(520%)}}
#bard-loading .bl-art img[data-scene=horizon]{filter:saturate(.85) contrast(1.05) brightness(.9)}
@media(max-width:650px){#bard-loading .bl-shell{padding:max(22px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));gap:24px}#bard-loading .bl-brand{font-size:20px}#bard-loading .bl-content{padding-top:35vh}#bard-loading h1{font-size:clamp(34px,10vw,46px)}#bard-loading .bl-tip{font-size:13px;margin-top:12px}#bard-loading .bl-footer{flex-wrap:wrap;gap:14px}#bard-loading .bl-state{flex-basis:100%}#bard-loading .bl-enter{margin-left:auto}}
@media(max-width:650px){#bard-loading .bl-art img:is([data-scene=horizon],[data-scene=earth],[data-scene=terran]){height:auto;top:12vh;mask-image:linear-gradient(#000 75%,transparent);-webkit-mask-image:linear-gradient(#000 75%,transparent)}}
@media(max-height:600px){#bard-loading .bl-shell{gap:16px;padding-top:max(16px,env(safe-area-inset-top));padding-bottom:max(16px,env(safe-area-inset-bottom))}#bard-loading .bl-content{padding-top:10vh}#bard-loading h1{font-size:36px}#bard-loading .bl-tip{margin-top:8px}#bard-loading .bl-footer{padding-top:12px}}
@media(prefers-reduced-motion:reduce){#bard-loading *{animation:none!important;transition:none!important}#bard-loading .bl-fill{width:35%}}
`;
		document.head.appendChild(style);
		const root = element('section', ''); root.id = 'bard-loading'; root.hidden = true;
		root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Preparing your Bard world'); root.tabIndex = -1;
		const art = element('div', 'bl-art', '', root); art.setAttribute('aria-hidden', 'true');
		const images = [element('img', '', '', art)]; images.forEach(img => { img.alt = ''; img.decoding = 'async'; });
		const shell = element('div', 'bl-shell', '', root), top = element('header', 'bl-top', '', shell);
		element('div', 'bl-brand', 'BARD', top);
		const back = element('button', 'bl-back', 'Back to Bard', top); back.type = 'button';
		const content = element('div', 'bl-content', '', shell), hero = element('div', 'bl-hero', '', content);
		const title = element('h1', '', '', hero), tip = element('p', 'bl-tip', '', hero);
		const footer = element('footer', 'bl-footer', '', shell), state = element('div', 'bl-state', '', footer), row = element('div', 'bl-status-row', '', state);
		const status = element('span', 'bl-status', '', row); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
		const track = element('div', 'bl-track', '', state); track.setAttribute('aria-hidden', 'true'); element('div', 'bl-fill', '', track);
		const sub = element('p', 'bl-sub', '', state);
		const enter = element('button', 'bl-enter', 'Enter world', footer); enter.type = 'button'; enter.hidden = true;
		view = { root, images, title, tip, status, sub, enter, back };
		back.onclick = event => { event.stopPropagation(); if (!current) return; const session = current; session.cancelled = true; hide(); session.options.exit?.(); if (session.settled) current = null; };
		enter.onclick = event => {
			event.stopPropagation();
			if (!current?.settled) return;
			const session = current;
			if (session.error) { current = null; run(session.task, session.options); return; }
			current = null; hide(); session.options.enter?.();
		};
		document.body.appendChild(root);
		for (const type of inputEvents) root.addEventListener(type, event => { if (active()) event.stopPropagation(); });
	}
	function pickStory() {
		let last = storyIndex;
		try { const saved = Number.parseInt(sessionStorage.getItem('bard-loading-last-scene'), 10); if (Number.isInteger(saved)) last = saved; } catch {}
		const skip = last >= 0 && last < stories.length;
		let next = Math.floor(Math.random() * (stories.length - (skip ? 1 : 0)));
		if (skip && next >= last) next++;
		try { sessionStorage.setItem('bard-loading-last-scene', String(next)); } catch {}
		return next;
	}
	function showStory(index) {
		storyIndex = index;
		const story = stories[index], token = ++imageSerial, img = view.images[0];
		view.title.textContent = story.title; view.tip.textContent = story.text;
		img.classList.remove('loaded'); img.dataset.scene = story.image; img.style.objectPosition = story.position; img.style.transform = `scale(${story.zoom})`;
		img.onload = () => { if (token === imageSerial) img.classList.add('loaded'); };
		img.onerror = () => { if (token === imageSerial) img.classList.remove('loaded'); };
		img.src = new URL(`${story.image}.webp`, base).href;
	}
	function show() {
		previousFocus = document.activeElement; restore = [];
		const lock = sibling => { if (sibling.nodeType === 1 && sibling !== view.root && !['SCRIPT', 'STYLE'].includes(sibling.tagName)) { if (!restore.some(([el]) => el === sibling)) restore.push([sibling, sibling.inert]); sibling.inert = true; } };
		for (const sibling of document.body.children) lock(sibling);
		backgroundObserver = new MutationObserver(records => { for (const record of records) for (const sibling of record.addedNodes) lock(sibling); });
		backgroundObserver.observe(document.body, { childList: true });
		view.root.hidden = false; view.root.dataset.state = 'loading'; view.enter.hidden = true;
		view.sub.textContent = '';
		view.root.focus({ preventScroll: true }); window.dispatchEvent(new Event('blur'));
		showStory(pickStory());
		clearTimeout(slowTimer); slowTimer = setTimeout(() => { if (active() && !current.settled) view.sub.textContent = 'First visits can take longer. Your world is still preparing.'; }, 25000);
	}
	function hide() {
		clearTimeout(slowTimer); imageSerial++; backgroundObserver?.disconnect();
		view.root.hidden = true; restore.forEach(([el, inert]) => { el.inert = inert; }); restore = [];
		window.dispatchEvent(new Event('blur')); previousFocus?.focus?.({ preventScroll: true });
	}
	function active() { return !!view && !view.root.hidden; }
	function stage(text) { if (active() && current && !current.settled) view.status.textContent = text; }
	async function run(task, options = {}) {
		create();
		// Nested engine/arrival work belongs to the door's existing loading session.
		if (current && !current.settled && !current.cancelled) return task();
		if (current && !current.settled && current.cancelled && !options.entry) return false;
		// Reopening after Back must be visible, but cannot race the cancelled build.
		const previous = current && !current.settled ? current.done : null;
		if (active()) hide();
		const session = current = { id: ++serial, task, options, settled: false, cancelled: false };
		session.done = new Promise(resolve => { session.finish = resolve; });
		show(); stage(options.label || 'Opening your world');
		try {
			if (previous) await previous;
			// Let the image/text paint before synchronous terrain construction begins.
			await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
			if (session.cancelled) return false;
			const result = await task();
			if (current !== session) return result;
			session.settled = true;
			if (session.cancelled) return result;
			clearTimeout(slowTimer); view.root.dataset.state = 'ready'; view.status.textContent = 'Your world is ready';
			view.sub.textContent = ''; view.enter.hidden = false; view.enter.textContent = 'Enter world';
			return result;
		} catch (error) {
			if (current !== session) return false;
			session.settled = true; session.error = error;
			if (session.cancelled) return false;
			clearTimeout(slowTimer); view.root.dataset.state = 'error'; view.status.textContent = 'The world could not finish loading';
			view.sub.textContent = /graphics|webgl|context|renderer/i.test(String(error?.message)) ? 'Your browser could not prepare 3D graphics. Return to Bard, then reload this tab.' : 'Check your connection, then retry. You can also return to Bard.';
			view.enter.hidden = false; view.enter.textContent = 'Try again';
			console.warn('[world loading]', error); return false;
		} finally {
			session.settled = true;
			try {
				if (session.cancelled) { options.exit?.(); if (current === session) current = null; }
			} finally { session.finish(); }
		}
	}
	// Register before the faceplate or world attaches its keyboard/combat handlers.
	const inputEvents = ['pointerdown', 'pointerup', 'pointermove', 'pointercancel', 'touchstart', 'touchend', 'touchmove', 'click', 'wheel', 'contextmenu', 'keydown', 'keyup'];
	for (const type of inputEvents) {
			window.addEventListener(type, event => {
				if (!active()) return;
				const inside = view.root.contains(event.target);
				if (type === 'keydown' && event.key === 'Tab') {
					const buttons = [...view.root.querySelectorAll('button')].filter(b => !b.hidden && !b.disabled);
					const i = buttons.indexOf(document.activeElement), n = (i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
					event.preventDefault(); event.stopImmediatePropagation(); buttons[n].focus(); return;
				}
				if (inside && (!(type === 'keydown' || type === 'keyup') || ['Enter', ' '].includes(event.key) && event.target.tagName === 'BUTTON')) return;
				if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation();
			}, { capture: true, passive: false });
	}
	window.L99Loading = { run, stage, active, get pending() { return !!current && !current.settled; } };
})();
