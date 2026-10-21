/* Shared by the faceplate door and the world: present before the engine downloads. */
(function () {
	'use strict';
	if (window.L99Loading) return;
	const source = document.currentScript?.src;
	const base = source ? new URL('assets/loading/', source) : new URL(location.pathname.includes('/island/') ? '../assets/loading/' : './assets/loading/', document.baseURI);
	brandFonts(new URL('../fonts/', base));
	// The world's two typefaces, self-hosted (assets/fonts, SIL OFL): a display face for titles,
	// tabs, buttons and labels, and a reading face for body text and numbers. Every world UI asks
	// for them by var(--bard-display) and var(--bard-body); the faceplate keeps its own lettering.
	// Latin only, so other scripts fall through to the system font. size-adjust matches each face
	// to the system font it replaced, so panels keep their measure.
	function brandFonts(dir) {
		if (document.getElementById('bard-fonts')) return;
		const latin = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
		const face = (family, file, weight, adjust, range = latin) => `@font-face{font-family:'${family}';src:url(${new URL(file, dir).href}) format('woff2');font-weight:${weight};font-style:normal;font-display:swap;size-adjust:${adjust};unicode-range:${range}}`;
		// Cinzel's 1 reads as a capital I, so the display face borrows the reading face's figures.
		const digits = 'U+0030-0039', noDigits = latin.replace('U+0000-00FF', 'U+0000-002F,U+003A-00FF');
		const style = document.createElement('style'); style.id = 'bard-fonts';
		// (each figure face shares its weight range with a Cinzel face, so the browser joins them)
		style.textContent = face('Bard Display', 'cinzel-var.woff2', '400 599', '96%', noDigits)
			+ face('Bard Display', 'cinzel-var.woff2', '600 900', '96%', noDigits)
			+ face('Bard Display', 'alegreya-sans-500.woff2', '400 599', '105%', digits)
			+ face('Bard Display', 'alegreya-sans-700.woff2', '600 900', '105%', digits)
			+ face('Bard Body', 'alegreya-sans-400.woff2', '100 400', '112%')
			+ face('Bard Body', 'alegreya-sans-500.woff2', '500', '112%')
			+ face('Bard Body', 'alegreya-sans-700.woff2', '600 900', '112%')
			+ `:root{--bard-display:'Bard Display',Georgia,'Times New Roman',serif;--bard-body:'Bard Body',system-ui,-apple-system,'Segoe UI',sans-serif}`;
		(document.head || document.documentElement).appendChild(style);
	}
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
	let view, current = null, serial = 0, tabs = [], tabOpen = null, tabDone = null, storyIndex = -1, imageSerial = 0, slideTimer, paused = false, slowTimer, restore = [], previousFocus, backgroundObserver;
	const reduced = matchMedia('(prefers-reduced-motion: reduce)');
	function rotation() {
		clearInterval(slideTimer);
		if (active() && !paused && !reduced.matches) slideTimer = setInterval(() => showStory(pickStory()), 10000);
	}
	reduced.addEventListener('change', rotation);
	function element(tag, cls, text, parent) {
		const el = document.createElement(tag); el.className = cls;
		if (text) el.textContent = text;
		parent?.appendChild(el); return el;
	}
	function create() {
		if (view) return;
		const style = element('style', '');
		style.textContent = `
#bard-loading{position:fixed;inset:0;z-index:2147483000;isolation:isolate;box-sizing:border-box;background:#070e12;color:#f5f1e7;font:15px/1.5 var(--bard-body,system-ui,sans-serif);overflow:auto;overscroll-behavior:contain;touch-action:pan-y;color-scheme:dark}
#bard-loading[hidden],#bard-loading [hidden]{display:none!important}#bard-loading *{box-sizing:border-box}#bard-loading button{font:600 12px var(--bard-display,Georgia,serif);letter-spacing:.04em;cursor:pointer;touch-action:manipulation}
#bard-loading .bl-art{position:absolute;inset:0;overflow:hidden;z-index:-3;background:radial-gradient(ellipse at 70% 30%,#43432f,#102b31 44%,#060d12 80%)}
#bard-loading .bl-art img{width:100%;height:100%;object-fit:cover;transform:scale(1.22);filter:saturate(.78) contrast(1.08) brightness(.82);opacity:0;transition:opacity 1.1s ease;position:absolute;inset:0}
#bard-loading .bl-art img.loaded{opacity:1}#bard-loading:before{content:'';position:absolute;inset:0;z-index:-2;background:linear-gradient(90deg,#061015a6,transparent 70%),linear-gradient(0deg,#060d12 2%,#060d12e8 18%,#060d1280 45%,transparent 76%);pointer-events:none}
#bard-loading:after{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;opacity:.16;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.86' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Cpath fill='%23fff' filter='url(%23n)' opacity='.33' d='M0 0h160v160H0z'/%3E%3C/svg%3E")}
#bard-loading .bl-shell{min-height:100%;min-height:100dvh;display:flex;flex-direction:column;padding:max(30px,env(safe-area-inset-top)) max(5.6vw,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(5.6vw,env(safe-area-inset-left));gap:24px}
#bard-loading .bl-top,#bard-loading .bl-footer{display:flex;align-items:center;justify-content:space-between;gap:20px}
#bard-loading .bl-brand{font:500 23px/1 var(--bard-display,Georgia,serif);letter-spacing:.24em}
#bard-loading .bl-back{background:#09151c70;border:1px solid #f5f1e745;border-radius:24px;color:inherit;padding:9px 17px;min-height:44px;font-size:12px}
#bard-loading .bl-content{margin-top:auto;padding-top:32vh;max-width:720px}
#bard-loading h1{font:500 clamp(34px,4.6vw,66px)/1.08 var(--bard-display,Georgia,serif);letter-spacing:.01em;margin:0;text-wrap:balance}
#bard-loading .bl-tip{font-size:14px;color:#d6dfde;line-height:1.5;margin:16px 0 0;max-width:460px}
#bard-loading .bl-footer{border-top:1px solid #ffffff30;padding-top:18px;align-items:end}
#bard-loading .bl-state{flex:1;max-width:480px}#bard-loading .bl-status{font-size:12px}
#bard-loading .bl-track{height:2px;background:#ffffff26;margin:12px 0 0;overflow:hidden}#bard-loading .bl-fill{height:100%;width:24%;background:#e1c58e;animation:bl-search 2.8s ease-in-out infinite}
#bard-loading .bl-sub{font-size:11px;color:#b9c6c6;line-height:1.4;margin:9px 0 0}#bard-loading .bl-sub:empty{display:none}
#bard-loading .bl-enter{min-height:48px;padding:12px 22px;border:1px solid #e8d19e;background:#e8d19e;color:#121c20;border-radius:3px;font:700 13px var(--bard-display,Georgia,serif);letter-spacing:.06em;flex-shrink:0}
#bard-loading button:focus-visible,#bard-loading:focus-visible{outline:2px solid #f5dfac;outline-offset:4px}
#bard-loading[data-state=ready] .bl-fill{width:100%;animation:none}#bard-loading[data-state=error] .bl-fill{width:100%;animation:none;background:#deae96}
#bard-loading .bl-chips{display:flex;flex-wrap:wrap;gap:8px;margin:22px 0 0}#bard-loading .bl-chips:empty{display:none}
#bard-loading .bl-chip{display:inline-flex;align-items:center;gap:8px;background:#09151c8c;border:1px solid #e8d19e59;border-radius:24px;color:#f5f1e7;padding:9px 17px;min-height:44px;-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);transition:border-color .2s,background .2s}
#bard-loading .bl-chip:hover{border-color:#e8d19e;background:#0d1d24b3}#bard-loading .bl-chip i{width:6px;height:6px;border-radius:50%;background:#e8d19e;box-shadow:0 0 6px #e8d19e;flex:none}
#bard-loading .bl-panel{display:flex;flex-direction:column;min-height:0;background:linear-gradient(180deg,#0c171df5,#071014f5);border:1px solid #e8d19e47;border-radius:14px;box-shadow:inset 0 1px 0 #ffe9b51f,0 24px 60px #000000a6;overflow:hidden;animation:bl-rise .28s ease-out}
#bard-loading .bl-panel-head{display:flex;align-items:stretch;gap:2px;padding:4px 6px 0 8px;border-bottom:1px solid #ffffff1f;flex:none}
#bard-loading .bl-ptab{flex:1;background:none;border:0;border-bottom:2px solid transparent;color:#b9c6c6;padding:12px 6px 10px;min-height:46px;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#bard-loading .bl-ptab[aria-selected=true]{color:#f5f1e7;border-bottom-color:#e8d19e}
#bard-loading .bl-pclose{flex:none;width:44px;min-height:44px;margin:1px 0 3px;background:none;border:1px solid transparent;border-radius:50%;color:#d6dfde;font-size:16px}#bard-loading .bl-pclose:hover{border-color:#f5f1e745}
#bard-loading .bl-pbody{flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;padding:16px 18px 20px;display:flex;flex-direction:column;gap:12px}
#bard-loading .bl-pbody.bl-flush{padding:0;overflow:hidden}
#bard-loading.bl-open .bl-shell{height:100%;height:100dvh;min-height:0}
#bard-loading.bl-open .bl-content{flex:1;min-height:0;margin-top:0;padding-top:0;max-width:none;display:flex;align-items:flex-end;gap:5vw}
#bard-loading.bl-open .bl-hero{flex:1;min-width:0;max-width:620px}#bard-loading.bl-open .bl-chips{display:none}
#bard-loading.bl-open .bl-panel{width:min(440px,46vw);align-self:stretch;margin-left:auto}
@keyframes bl-rise{0%{opacity:0;transform:translateY(12px)}100%{opacity:1;transform:none}}
@keyframes bl-search{0%{transform:translateX(-110%)}100%{transform:translateX(520%)}}
#bard-loading .bl-art img[data-scene=horizon]{filter:saturate(.85) contrast(1.05) brightness(.9)}
@media(max-width:650px){#bard-loading .bl-shell{padding:max(22px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(22px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));gap:24px}#bard-loading .bl-brand{font-size:20px}#bard-loading .bl-content{padding-top:35vh}#bard-loading h1{font-size:clamp(34px,10vw,46px)}#bard-loading .bl-tip{font-size:13px;margin-top:12px}#bard-loading .bl-footer{flex-wrap:wrap;gap:14px}#bard-loading .bl-state{flex-basis:100%}#bard-loading .bl-enter{margin-left:auto}#bard-loading.bl-open .bl-hero{display:none}#bard-loading.bl-open .bl-panel{width:100%}#bard-loading .bl-chips{margin-top:18px}#bard-loading .bl-chip{padding:9px 14px}}
@media(max-width:650px){#bard-loading .bl-art img:is([data-scene=horizon],[data-scene=earth],[data-scene=terran]){height:auto;top:12vh;mask-image:linear-gradient(#000 75%,transparent);-webkit-mask-image:linear-gradient(#000 75%,transparent)}}
@media(max-height:600px){#bard-loading .bl-shell{gap:16px;padding-top:max(16px,env(safe-area-inset-top));padding-bottom:max(16px,env(safe-area-inset-bottom))}#bard-loading .bl-content{padding-top:10vh}#bard-loading h1{font-size:36px}#bard-loading .bl-tip{margin-top:8px}#bard-loading .bl-footer{padding-top:12px}#bard-loading .bl-chips{margin-top:12px}#bard-loading.bl-open .bl-tip{display:none}}
@media(prefers-reduced-motion:reduce){#bard-loading *{animation:none!important;transition:none!important}#bard-loading .bl-fill{width:35%}}
`;
		document.head.appendChild(style);
		const root = element('section', ''); root.id = 'bard-loading'; root.hidden = true;
		root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Preparing your Bard world'); root.tabIndex = -1;
		const art = element('div', 'bl-art', '', root); art.setAttribute('aria-hidden', 'true');
		const images = [element('img', '', '', art)]; images.forEach(img => { img.alt = ''; img.decoding = 'async'; });
		const shell = element('div', 'bl-shell', '', root), top = element('header', 'bl-top', '', shell);
		element('div', 'bl-brand', 'BARD', top);
		const pause = element('button', 'bl-back', 'Pause', top); pause.type = 'button'; pause.setAttribute('aria-label', 'Pause slideshow');
		pause.onclick = () => { paused = !paused; pause.textContent = paused ? 'Play' : 'Pause'; pause.setAttribute('aria-label', paused ? 'Play slideshow' : 'Pause slideshow'); rotation(); };
		const back = element('button', 'bl-back', 'Back to Bard', top); back.type = 'button';
		const content = element('div', 'bl-content', '', shell), hero = element('div', 'bl-hero', '', content);
		const title = element('h1', '', '', hero), tip = element('p', 'bl-tip', '', hero);
		// a look at your character, what you carry and your account while the world builds:
		// the tabs come from the world's engine (island ui/loading-tabs.js) once it is running
		const chips = element('div', 'bl-chips', '', hero);
		const panel = element('section', 'bl-panel', '', content); panel.hidden = true; panel.setAttribute('aria-label', 'Your character');
		const panelHead = element('div', 'bl-panel-head', '', panel); panelHead.setAttribute('role', 'tablist');
		const panelBody = element('div', 'bl-pbody', '', panel); panelBody.setAttribute('role', 'tabpanel');
		const footer = element('footer', 'bl-footer', '', shell), state = element('div', 'bl-state', '', footer), row = element('div', 'bl-status-row', '', state);
		const status = element('span', 'bl-status', '', row); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
		const track = element('div', 'bl-track', '', state); track.setAttribute('aria-hidden', 'true'); element('div', 'bl-fill', '', track);
		const sub = element('p', 'bl-sub', '', state);
		const enter = element('button', 'bl-enter', 'Enter world', footer); enter.type = 'button'; enter.hidden = true;
		view = { root, pause, images, title, tip, status, sub, enter, back, chips, panel, panelHead, panelBody };
		back.onclick = event => { event.stopPropagation(); if (!current) return; const session = current; session.cancelled = true; finish('backed out'); hide(); session.options.exit?.(); if (session.settled) current = null; };
		enter.onclick = event => {
			event.stopPropagation();
			if (current?.error?.code === 'GRAPHICS_RELOAD_REQUIRED') { location.reload(); return; }
			if (!current?.settled) return;
			const session = current;
			if (session.error) { current = null; run(session.task, session.options); return; }
			current = null; finish('entered'); hide(); session.options.enter?.();
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
		view.sub.textContent = ''; closeTab(); drawChips();
		view.root.focus({ preventScroll: true }); window.dispatchEvent(new Event('blur'));
		showStory(pickStory());
		paused = false; view.pause.textContent = 'Pause'; view.pause.setAttribute('aria-label', 'Pause slideshow'); rotation();
		clearTimeout(slowTimer); slowTimer = setTimeout(() => { if (active() && !current.settled) view.sub.textContent = 'First visits can take longer. Your world is still preparing.'; }, 25000);
	}
	function hide() {
		clearInterval(slideTimer); clearTimeout(slowTimer); imageSerial++; backgroundObserver?.disconnect(); closeTab();
		view.root.hidden = true; restore.forEach(([el, inert]) => { el.inert = inert; }); restore = [];
		window.dispatchEvent(new Event('blur')); previousFocus?.focus?.({ preventScroll: true });
	}
	// ---------- your character, inventory and account, while you wait ----------
	// tabs: [{ id, label() (its name now), render(host) -> optional cleanup }], set by the engine.
	// Plain page elements only: nothing here draws with the GPU, so a phone's load is untouched.
	const tabLabel = tab => { try { return String(tab.label?.() || tab.id); } catch { return tab.id; } };
	function setTabs(list) { tabs = Array.isArray(list) ? list.filter(t => t?.id && typeof t.render === 'function') : []; if (view) { drawChips(); if (tabOpen && !tabs.some(t => t.id === tabOpen)) closeTab(); } }
	function drawChips() {
		if (!view) return;
		view.chips.replaceChildren();
		for (const tab of tabs) {
			const b = element('button', 'bl-chip', '', view.chips); b.type = 'button';
			element('i', '', '', b); b.append(tabLabel(tab));
			b.onclick = event => { event.stopPropagation(); openTab(tab.id); };
		}
		if (tabOpen) drawTabBar();
	}
	function drawTabBar() {
		view.panelHead.replaceChildren();
		for (const tab of tabs) {
			const b = element('button', 'bl-ptab', tabLabel(tab), view.panelHead); b.type = 'button';
			b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(tab.id === tabOpen)); b.dataset.tab = tab.id;
			b.onclick = event => { event.stopPropagation(); if (tab.id !== tabOpen) openTab(tab.id); };
		}
		const x = element('button', 'bl-pclose', '✕', view.panelHead); x.type = 'button'; x.setAttribute('aria-label', 'Close');
		x.onclick = event => { event.stopPropagation(); closeTab(true); };
	}
	function openTab(id) {
		const tab = tabs.find(t => t.id === id);
		if (!view || !tab) return;
		endTab(); tabOpen = id;
		view.root.classList.add('bl-open'); view.panel.hidden = false;
		view.panelBody.className = 'bl-pbody'; view.panelBody.replaceChildren(); view.panelBody.scrollTop = 0;
		drawTabBar();
		try { const done = tab.render(view.panelBody); tabDone = typeof done === 'function' ? done : null; }
		catch (error) { console.warn('[world loading] tab', id, error); view.panelBody.replaceChildren(element('p', 'bl-tip', 'This can’t be shown right now. It will be there once you are in the world.')); }
		(view.panelHead.querySelector('[aria-selected=true]') || view.panelHead.firstChild)?.focus({ preventScroll: true });
	}
	function endTab() { const done = tabDone; tabDone = null; try { done?.(); } catch (error) { console.warn('[world loading] tab', error); } }
	function closeTab(refocus) {
		if (!view || !tabOpen) return;
		endTab(); tabOpen = null;
		view.root.classList.remove('bl-open'); view.panel.hidden = true; view.panelBody.replaceChildren(); view.panelHead.replaceChildren();
		drawChips();
		if (refocus) (view.chips.firstChild || view.root).focus({ preventScroll: true });
	}
	function active() { return !!view && !view.root.hidden; }
	function stage(text) { if (active() && current && !current.settled && !current.failure) { view.status.textContent = text; mark(text); } }
	// The black box: every load's stages as they pass, with what the graphics and the script heap
	// held at each, written to the device as they happen and sampled every two seconds between.
	// A page that went mid-load without a goodbye (a phone closing it for memory, a crash) leaves
	// its trail behind; the next visit keeps the last five (L99Loading.trail(), ?perf on screen).
	const TRAIL_KEY = 'l99-load-trail', LOST_KEY = 'l99-load-lost';
	const keep = { get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } }, put(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
	let lostLoads = keep.get(LOST_KEY) || [], trail = null, trailTimer = 0;
	{
		const last = keep.get(TRAIL_KEY);
		if (last && !last.end) {
			lostLoads = [...lostLoads, last].slice(-5); keep.put(LOST_KEY, lostLoads);
			console.warn('[world loading] the last load went without a goodbye at "' + (last.stages?.at(-1)?.[1] || '?') + '"', JSON.stringify(last));
		}
	}
	// what the graphics (island gpumeter.js, once the engine is up) and the script heap hold, MB
	const heldMB = () => { const heap = performance.memory?.usedJSHeapSize; let gpu = null; try { gpu = window.L99GpuMB?.() ?? null; } catch { /* not yet */ } return [gpu, heap ? Math.round(heap / 1048576) : null]; };
	const secs = () => +((performance.now() - trail.t0) / 1000).toFixed(1);
	const saveTrail = () => { const { t0, ...out } = trail; keep.put(TRAIL_KEY, out); };
	function mark(text) {
		if (!trail || trail.end) return;
		trail.stages.push([secs(), text, ...heldMB()]);
		if (trail.stages.length > 40) trail.stages.splice(1, 1);
		saveTrail();
	}
	function begin(label) {
		clearInterval(trailTimer);
		trail = { at: new Date().toISOString(), page: location.pathname + location.search, phone: matchMedia?.('(pointer: coarse)').matches || false, dpr: devicePixelRatio, t0: performance.now(), stages: [], hidden: false };
		mark(label);
		trailTimer = setInterval(() => { if (!trail || trail.end) return clearInterval(trailTimer); trail.now = [secs(), ...heldMB()]; saveTrail(); }, 2000);
	}
	function finish(end) { if (!trail || trail.end) return; mark(end); trail.end = end; clearInterval(trailTimer); saveTrail(); }
	addEventListener('pagehide', () => finish('left'));
	document.addEventListener('visibilitychange', () => { if (trail && !trail.end && document.hidden) { trail.hidden = true; saveTrail(); } });
	const trailInfo = () => ({ now: trail ? (({ t0, ...t }) => t)(trail) : null, lost: lostLoads });
	function errorView(error) {
		clearTimeout(slowTimer); view.root.dataset.state = 'error'; finish('failed: ' + String(error?.message || error).slice(0, 120));
		const graphics = error?.code === 'GRAPHICS_RELOAD_REQUIRED';
		view.status.textContent = graphics ? 'Graphics need a fresh start' : 'The world could not finish loading';
		view.sub.textContent = graphics ? error.message : /graphics|webgl|context|renderer/i.test(String(error?.message)) ? 'Your browser could not prepare 3D graphics. Return to Bard, then reload this tab.' : 'Check your connection, then retry. You can also return to Bard.';
		view.enter.hidden = false; view.enter.textContent = graphics ? 'Reload game' : 'Try again';
	}
	function fail(error, options = {}) {
		if (active() && current) { current.failure = current.error = error; errorView(error); }
		else run(() => { throw error; }, options);
	}
	async function run(task, options = {}) {
		create();
		// Nested engine/arrival work belongs to the door's existing loading session.
		if (current && !current.settled && !current.cancelled) return task();
		if (current && !current.settled && current.cancelled && !options.entry) return false;
		// Reopening after Back must be visible, but cannot race the cancelled build.
		const previous = current && !current.settled ? current.done : null;
		// (one load straight after another keeps the tab you were looking at)
		const keepTab = active() ? tabOpen : null;
		if (active()) hide();
		const session = current = { id: ++serial, task, options, settled: false, cancelled: false };
		session.done = new Promise(resolve => { session.finish = resolve; });
		show();
		if (keepTab) openTab(keepTab); begin(options.label || 'Opening your world'); stage(options.label || 'Opening your world');
		try {
			if (previous) await previous;
			// Let the image/text paint before synchronous terrain construction begins.
			await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
			if (session.cancelled) return false;
			const result = await task();
			if (session.failure) throw session.failure;
			if (current !== session) return result;
			session.settled = true;
			if (session.cancelled) return result;
			clearTimeout(slowTimer); view.root.dataset.state = 'ready'; view.status.textContent = 'Your world is ready'; mark('ready');
			view.sub.textContent = ''; view.enter.hidden = false; view.enter.textContent = 'Enter world';
			return result;
		} catch (error) {
			error = session.failure || error;
			if (current !== session) return false;
			session.settled = true; session.error = error;
			if (session.cancelled) return false;
			errorView(error);
			console.warn('[world loading]', error); return false;
		} finally {
			session.settled = true;
			if (session.cancelled) finish('backed out');
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
				if (type === 'keydown' && event.key === 'Escape' && tabOpen) { event.preventDefault(); event.stopImmediatePropagation(); closeTab(true); return; }
				if (type === 'keydown' && event.key === 'Tab') {
					const buttons = [...view.root.querySelectorAll('button, input, select, textarea')].filter(b => !b.hidden && !b.disabled && b.getClientRects().length);
					const i = buttons.indexOf(document.activeElement), n = (i + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length;
					event.preventDefault(); event.stopImmediatePropagation(); buttons[n].focus(); return;
				}
				// (typing in a field here, such as signing in: the keys type, and reach nothing behind)
				if (inside && (type === 'keydown' || type === 'keyup') && /^(INPUT|TEXTAREA|SELECT)$/.test(event.target.tagName)) { event.stopImmediatePropagation(); return; }
				if (inside && (!(type === 'keydown' || type === 'keyup') || ['Enter', ' '].includes(event.key) && event.target.tagName === 'BUTTON')) return;
				if (event.cancelable) event.preventDefault(); event.stopImmediatePropagation();
			}, { capture: true, passive: false });
	}
	window.L99Loading = { run, stage, fail, active, trail: trailInfo, get pending() { return !!current && !current.settled; },
		// the engine's tabs (island ui/loading-tabs.js); relabel() after a label changes (signed in)
		tabs: setTabs, relabel: () => { if (view) drawChips(); }, openTab: id => openTab(id), closeTab: () => closeTab(), get tabOpen() { return tabOpen; } };
})();
