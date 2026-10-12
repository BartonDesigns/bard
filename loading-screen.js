/* Shared by the faceplate door and the world: present before the engine downloads. */
(function () {
	'use strict';
	if (window.L99Loading) return;
	const source = document.currentScript?.src;
	const base = source ? new URL('assets/loading/', source) : new URL(location.pathname.includes('/island/') ? '../assets/loading/' : './assets/loading/', document.baseURI);
	const stories = [
		{ image: 'horizon', position: '50% 50%', zoom: 1, chapter: 'Beyond the horizon', title: 'Follow the unheard.', tag: 'TRAVEL', hint: 'A sky without a ceiling', text: 'Climb from the surface into orbit. Keep your departure point: Earth remembers where you left.', caption: 'Gargantua · the event ring' },
		{ image: 'resonance', position: '55% 48%', chapter: 'The world listens', title: 'Leave an echo.', tag: 'MUSIC & DISCOVERY', hint: 'Listen before you move on', text: 'Cave instruments answer your touch. Explore their notes and watch for a response in the world around you.', caption: 'Resonance cavern · gameplay capture' },
		{ image: 'settlement', position: '38% 45%', chapter: 'Somewhere to belong', title: 'Every place has a story.', tag: 'PEOPLE & PLACES', hint: 'Begin with a conversation', text: 'Ask a resident to follow, scout or warn others in your own words. Your journal keeps the people you meet.', caption: 'Terran settlement · gameplay capture' },
		{ image: 'beyond', position: '50% 45%', chapter: 'A hidden world', title: 'Find the held note.', tag: 'SECRETS & SOUND', hint: 'Listen beyond the horizon', text: 'Seven held voices wait beyond Gargantua’s horizon. The white fountain marks your way back.', caption: 'The Held Note · gameplay capture' },
	];
	let view, current = null, serial = 0, storyIndex = 0, imageSerial = 0, timer, slowTimer, restore = [], previousFocus, backgroundObserver;
	const reduced = matchMedia('(prefers-reduced-motion: reduce)');
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
#bard-loading .bl-shell{min-height:100%;min-height:100dvh;display:flex;flex-direction:column;padding:max(32px,env(safe-area-inset-top)) max(5.6vw,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(5.6vw,env(safe-area-inset-left));gap:26px}
#bard-loading .bl-top,#bard-loading .bl-nav,#bard-loading .bl-status-row,#bard-loading .bl-footer{display:flex;align-items:center;justify-content:space-between;gap:16px}
#bard-loading .bl-brand{font:500 24px/1 Georgia,serif;letter-spacing:.24em}#bard-loading .bl-brand small{display:block;font:9px/1.5 system-ui;letter-spacing:.23em;color:#d4d7ce;margin-top:10px}
#bard-loading .bl-back{background:#09151c70;border:1px solid #f5f1e745;border-radius:24px;color:inherit;padding:9px 17px;min-height:44px;font-size:12px;backdrop-filter:blur(8px)}
#bard-loading .bl-content{margin-top:auto;padding-top:clamp(90px,24vh,280px);display:grid;grid-template-columns:minmax(0,1.4fr) minmax(230px,.7fr);align-items:end;gap:8vw}
#bard-loading .bl-eyebrow{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:#e1c58e;margin:0 0 20px}
#bard-loading h1{font:400 clamp(44px,5.8vw,88px)/1.03 Georgia,serif;letter-spacing:-.045em;margin:0;max-width:720px;text-wrap:balance}
#bard-loading .bl-caption{font-size:10px;color:#aebbbd;letter-spacing:.035em;margin:22px 0 0}
#bard-loading .bl-note{padding-left:23px;border-left:1px solid #d3b77780;max-width:400px}#bard-loading .bl-tag{font-size:9px;letter-spacing:.2em;color:#e1c58e}
#bard-loading h2{font-size:17px;font-weight:500;line-height:1.35;margin:11px 0}#bard-loading .bl-tip{font-size:13px;color:#d6dfde;line-height:1.65;margin:0}
#bard-loading .bl-footer{margin-top:20px;border-top:1px solid #ffffff30;padding-top:22px;align-items:end}#bard-loading .bl-state{flex:1;max-width:500px}
#bard-loading .bl-status{font-size:13px;color:#f5f1e7}#bard-loading .bl-counter{font-size:10px;letter-spacing:.16em;color:#b4c4c4;white-space:nowrap}
#bard-loading .bl-track{height:2px;background:#ffffff26;margin:13px 0 10px;overflow:hidden}#bard-loading .bl-fill{height:100%;width:24%;background:#e1c58e;animation:bl-search 2.8s ease-in-out infinite}
#bard-loading .bl-sub{font-size:11px;color:#aebbbd;min-height:17px;margin:0}#bard-loading .bl-nav{gap:8px;flex-shrink:0}
#bard-loading .bl-icon{height:44px;width:44px;display:grid;place-items:center;border-radius:50%;background:#09151c80;color:#f5f1e7;border:1px solid #ffffff36;font-size:17px}
#bard-loading .bl-count{font-size:10px;letter-spacing:.13em;width:56px;text-align:center;color:#dfddd4}#bard-loading .bl-enter{min-height:48px;padding:12px 25px;border:1px solid #e8d19e;background:#e8d19e;color:#121c20;border-radius:3px;font-size:13px;font-weight:650;min-width:155px}
#bard-loading .bl-enter[hidden]{display:none}#bard-loading button:focus-visible,#bard-loading:focus-visible{outline:2px solid #f5dfac;outline-offset:4px}
#bard-loading[data-state=ready] .bl-fill{width:100%;animation:none}#bard-loading[data-state=error] .bl-fill{width:100%;animation:none;background:#deae96}
@keyframes bl-search{0%{transform:translateX(-110%)}100%{transform:translateX(520%)}}
@media(max-width:650px){#bard-loading .bl-shell{padding: max(22px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));gap:20px}#bard-loading .bl-brand{font-size:20px}#bard-loading .bl-brand small{font-size:8px;letter-spacing:.12em}#bard-loading .bl-back{font-size:11px;padding:8px 13px}#bard-loading .bl-content{grid-template-columns:1fr;gap:27px;padding-top:24vh}#bard-loading h1{font-size:clamp(36px,10.5vw,54px);max-width:370px}#bard-loading .bl-eyebrow{font-size:9px;margin-bottom:12px}#bard-loading .bl-caption{font-size:9px;margin-top:14px}#bard-loading .bl-note{padding-left:15px}#bard-loading h2{font-size:15px;margin:7px 0}#bard-loading .bl-tip{font-size:12px;line-height:1.5}#bard-loading .bl-footer{flex-wrap:wrap;gap:12px;margin-top:0;padding-top:17px}#bard-loading .bl-state{flex-basis:100%;max-width:none}#bard-loading .bl-enter{margin-left:auto;min-width:112px;padding:11px 12px}#bard-loading .bl-count{display:none}#bard-loading .bl-counter{font-size:9px}#bard-loading .bl-status{font-size:12px}}
#bard-loading .bl-art img[data-scene=horizon]{filter:saturate(.85) contrast(1.05) brightness(.9)}
@media(max-width:650px){#bard-loading .bl-art img[data-scene=horizon]{height:auto;top:max(80px,10vh);bottom:auto;mask-image:linear-gradient(#000 65%,transparent);-webkit-mask-image:linear-gradient(#000 65%,transparent)}}
@media(max-height:700px) and (max-width:650px){#bard-loading .bl-content{padding-top:6vh;gap:18px}#bard-loading .bl-shell{gap:16px}#bard-loading h1{font-size:36px}}
@media(max-height:500px) and (min-width:651px){#bard-loading .bl-shell{padding:16px max(28px,env(safe-area-inset-right)) 16px max(28px,env(safe-area-inset-left));gap:14px}#bard-loading .bl-content{padding-top:20px;gap:40px}#bard-loading h1{font-size:40px}#bard-loading .bl-eyebrow{margin-bottom:9px}#bard-loading .bl-caption{margin-top:12px}#bard-loading .bl-footer{margin-top:0;padding-top:12px}#bard-loading .bl-tip{font-size:11px}#bard-loading h2{font-size:14px}#bard-loading .bl-brand small{display:none}}
@media(prefers-reduced-motion:reduce){#bard-loading *{animation:none!important;transition:none!important}#bard-loading .bl-fill{width:35%}}
`;
		document.head.appendChild(style);
		const root = element('section', ''); root.id = 'bard-loading'; root.hidden = true;
		root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Preparing your Bard world'); root.tabIndex = -1;
		const art = element('div', 'bl-art', '', root); art.setAttribute('aria-hidden', 'true');
		const images = [element('img', '', '', art), element('img', '', '', art)]; images.forEach(img => { img.alt = ''; img.decoding = 'async'; });
		const shell = element('div', 'bl-shell', '', root), top = element('header', 'bl-top', '', shell);
		const brand = element('div', 'bl-brand', 'BARD', top); element('small', '', 'A WORLD PLAYED BY EAR', brand);
		const back = element('button', 'bl-back', 'Back to Bard', top); back.type = 'button';
		const content = element('div', 'bl-content', '', shell), hero = element('div', 'bl-hero', '', content);
		const chapter = element('p', 'bl-eyebrow', '', hero), title = element('h1', '', '', hero), caption = element('p', 'bl-caption', '', hero);
		const note = element('aside', 'bl-note', '', content), tag = element('span', 'bl-tag', '', note), hint = element('h2', '', '', note), tip = element('p', 'bl-tip', '', note);
		const footer = element('footer', 'bl-footer', '', shell), state = element('div', 'bl-state', '', footer), row = element('div', 'bl-status-row', '', state);
		const status = element('span', 'bl-status', '', row); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
		const counter = element('span', 'bl-counter', 'WORLD PREPARATION', row);
		const track = element('div', 'bl-track', '', state); track.setAttribute('aria-hidden', 'true'); element('div', 'bl-fill', '', track);
		const sub = element('p', 'bl-sub', '', state), nav = element('nav', 'bl-nav', '', footer); nav.setAttribute('aria-label', 'Loading screen stories');
		const prev = element('button', 'bl-icon', '←', nav), count = element('span', 'bl-count', '', nav), next = element('button', 'bl-icon', '→', nav), pause = element('button', 'bl-icon', 'Ⅱ', nav);
		prev.setAttribute('aria-label', 'Previous scene'); next.setAttribute('aria-label', 'Next scene'); pause.setAttribute('aria-label', 'Pause scenes');
		for (const button of [prev, next, pause]) button.type = 'button';
		const enter = element('button', 'bl-enter', 'Enter world', footer); enter.type = 'button'; enter.hidden = true;
		view = { root, images, chapter, title, caption, tag, hint, tip, status, counter, sub, count, enter, back, pause };
		prev.onclick = () => { showStory(storyIndex - 1); rotate(); };
		next.onclick = () => { showStory(storyIndex + 1); rotate(); };
		pause.onclick = () => { if (current) { current.paused = !current.paused; rotate(); } };
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
	function showStory(index) {
		storyIndex = (index + stories.length) % stories.length;
		const story = stories[storyIndex], token = ++imageSerial, img = view.images[token % 2];
		view.chapter.textContent = `${String(storyIndex + 1).padStart(2, '0')} / ${story.chapter}`;
		view.title.textContent = story.title; view.caption.textContent = story.caption;
		view.tag.textContent = story.tag; view.hint.textContent = story.hint; view.tip.textContent = story.text;
		view.count.textContent = `${String(storyIndex + 1).padStart(2, '0')} / 04`;
		img.classList.remove('loaded'); img.dataset.scene = story.image; img.style.objectPosition = story.position; img.style.transform = `scale(${story.zoom || 1.22})`;
		img.onload = () => { if (token !== imageSerial) return; view.images.forEach(other => other.classList.toggle('loaded', other === img)); };
		img.onerror = () => { if (token === imageSerial) view.images.forEach(other => other.classList.remove('loaded')); };
		img.src = new URL(`${story.image}.webp`, base).href;
	}
	function rotate() {
		clearInterval(timer);
		const paused = !current || current.paused || reduced.matches;
		view.pause.hidden = reduced.matches; view.pause.textContent = paused ? '▷' : 'Ⅱ'; view.pause.setAttribute('aria-label', paused ? 'Play scenes' : 'Pause scenes'); view.pause.setAttribute('aria-pressed', String(paused));
		if (!paused && active()) timer = setInterval(() => { if (!document.hidden) showStory(storyIndex + 1); }, 10000);
	}
	function show() {
		previousFocus = document.activeElement; restore = [];
		const lock = sibling => { if (sibling.nodeType === 1 && sibling !== view.root && !['SCRIPT', 'STYLE'].includes(sibling.tagName)) { if (!restore.some(([el]) => el === sibling)) restore.push([sibling, sibling.inert]); sibling.inert = true; } };
		for (const sibling of document.body.children) lock(sibling);
		backgroundObserver = new MutationObserver(records => { for (const record of records) for (const sibling of record.addedNodes) lock(sibling); });
		backgroundObserver.observe(document.body, { childList: true });
		view.root.hidden = false; view.root.dataset.state = 'loading'; view.enter.hidden = true;
		view.sub.textContent = 'Controls unlock when your world is ready.'; view.counter.textContent = 'WORLD PREPARATION';
		view.root.focus({ preventScroll: true }); window.dispatchEvent(new Event('blur'));
		showStory(current.options.scene ?? storyIndex); rotate();
		clearTimeout(slowTimer); slowTimer = setTimeout(() => { if (active() && !current.settled) view.sub.textContent = 'First visits can take longer. Your world is still preparing.'; }, 25000);
	}
	function hide() {
		clearInterval(timer); clearTimeout(slowTimer); imageSerial++; backgroundObserver?.disconnect();
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
		const session = current = { id: ++serial, task, options, settled: false, cancelled: false, paused: false };
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
			clearTimeout(slowTimer); view.root.dataset.state = 'ready'; view.status.textContent = 'Your world is ready'; view.counter.textContent = 'READY';
			view.sub.textContent = 'Step in whenever you are ready.'; view.enter.hidden = false; view.enter.textContent = 'Enter world';
			return result;
		} catch (error) {
			if (current !== session) return false;
			session.settled = true; session.error = error;
			if (session.cancelled) return false;
			clearTimeout(slowTimer); view.root.dataset.state = 'error'; view.status.textContent = 'The world could not finish loading'; view.counter.textContent = 'PAUSED';
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
	reduced.addEventListener?.('change', () => { if (view) rotate(); });
})();
