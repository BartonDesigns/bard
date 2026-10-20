/* Music from a link: paste or drop a YouTube or Spotify link (or ♫ LINK on the faceplate, or
   the map pin menu in the world) and its own player floats over the faceplate and the world.
   Neither service lets a page hear its sound: YouTube's terms keep the player visible (at least
   200 x 200) and its audio whole, Spotify's policy keeps its songs out of games and visuals. So
   the world hears the music the honest way, by listening to this tab's sound, shared through
   the browser's own picker ("Also share tab audio" in Chrome; iOS 27's Safari has the picker
   too). Never the microphone: it hears the room and drops the phone into call-quality sound.
   Where a browser can't share its sound, the switch says so. What it hears feeds the same
   bass/mid/high that the faceplate's own music drives (L99Continuity.sample), so the trees,
   the grass, the sea, the sky, the fireflies and the whale answer it as they answer the Bard.
   API: L99MusicLink.open(url) -> true when it is a link we can play, .ask() the card empty,
   .close(), .listen(on), .parse(url), .state(). Events: 'l99-musiclink' { open, playing, listening }. */
(function () {
	'use strict';
	if (window.L99MusicLink) return;

	const KEY = 'l99-music-link';
	const UA = navigator.userAgent || '';
	const PHONE = /iPhone|iPad|iPod|Android/i.test(UA) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(UA));
	// tab sound needs the share picker (getDisplayMedia): Chrome on a computer gives a tab's sound;
	// Safari on iOS 27 has the picker too; older iPhones and Chrome on Android have none
	const CAN_SHARE = !!navigator.mediaDevices?.getDisplayMedia;

	function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (_) { return {}; } }
	function save(v) { try { localStorage.setItem(KEY, JSON.stringify(Object.assign(load(), v))); } catch (_) { /* private mode: not kept */ } }

	// ---------- links ----------
	const SPOTIFY_KINDS = ['playlist', 'album', 'track', 'artist', 'episode', 'show'];
	function seconds(t) {
		if (!t) return 0;
		if (/^\d+$/.test(t)) return +t;
		const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(t);
		return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
	}
	// a link we can play: { service, ... }, { service, problem } for one we know but cannot, or null
	function parse(text) {
		const word = String(text || '').trim().split(/\s+/).find((w) => /youtu|spotify/i.test(w));
		if (!word) return null;
		const uri = /^spotify:(playlist|album|track|artist|episode|show):([A-Za-z0-9]{10,40})$/.exec(word);
		if (uri) return { service: 'spotify', kind: uri[1], id: uri[2] };
		let u;
		try { u = new URL(/^https?:\/\//i.test(word) ? word : 'https://' + word); } catch (_) { return null; }
		const host = u.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
		const path = u.pathname.split('/').filter(Boolean);
		if (host === 'open.spotify.com' || host === 'play.spotify.com') {
			const p = path.filter((s) => !/^intl-/.test(s) && s !== 'embed' && s !== 'user');
			const at = p.findIndex((s) => SPOTIFY_KINDS.includes(s));
			if (at >= 0 && /^[A-Za-z0-9]{10,40}$/.test(p[at + 1] || '')) return { service: 'spotify', kind: p[at], id: p[at + 1] };
			return { service: 'spotify', problem: 'That Spotify link is not a playlist, album, song, artist or podcast.' };
		}
		if (host === 'spotify.link' || host === 'spotify.app.link') return { service: 'spotify', problem: 'Short Spotify links can\'t be opened here. Open it once, then copy the open.spotify.com link from the address bar.' };
		if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'youtu.be') {
			const ID = /^[\w-]{11}$/, LIST = /^[\w-]{10,80}$/;
			let video = u.searchParams.get('v'), list = u.searchParams.get('list');
			if (host === 'youtu.be') video = path[0];
			else if (['shorts', 'embed', 'live', 'v'].includes(path[0])) video = path[1] === 'videoseries' ? null : path[1];
			video = ID.test(video || '') ? video : null;
			list = LIST.test(list || '') ? list : null;
			if (!video && !list) return { service: 'youtube', problem: 'That YouTube link is not a video or a playlist.' };
			return { service: 'youtube', video, list, start: seconds(u.searchParams.get('t') || u.searchParams.get('start')) };
		}
		return null;
	}

	// ---------- the card ----------
	const style = document.createElement('style');
	style.id = 'l99-music-link-style';
	style.textContent = [
		'#l99-ml{position:fixed;z-index:1000;width:min(380px,calc(100vw - 16px));box-sizing:border-box;background:rgba(20,22,24,.94);border:1px solid rgba(255,255,255,.12);border-radius:12px;',
		'box-shadow:0 12px 36px rgba(0,0,0,.55);color:#eafaf6;font:13px/1.35 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;touch-action:none;user-select:none;-webkit-user-select:none;overflow:hidden;}',
		'#l99-ml[hidden],#l99-ml [hidden]{display:none!important}',
		'#l99-ml *{box-sizing:border-box}',
		'#l99-ml .ml-head{display:flex;align-items:center;gap:8px;padding:6px 6px 6px 12px;cursor:grab;min-height:44px}',
		'#l99-ml .ml-head:active{cursor:grabbing}',
		'#l99-ml .ml-title{flex:1;min-width:0;font-weight:600;letter-spacing:.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
		'#l99-ml .ml-title i{font-style:normal;color:#5eead4;margin-right:6px}',
		'#l99-ml button{font:inherit;color:inherit;cursor:pointer;border-radius:8px;min-height:36px}',
		'#l99-ml .ml-x{width:36px;background:transparent;border:1px solid transparent;font-size:16px;color:rgba(255,255,255,.7)}',
		'#l99-ml .ml-x:hover{border-color:rgba(255,255,255,.2);color:#fff}',
		'#l99-ml .ml-body{padding:0 10px 10px;display:flex;flex-direction:column;gap:8px}',
		'#l99-ml form{display:flex;gap:6px}',
		'#l99-ml input{flex:1;min-width:0;min-height:40px;padding:8px 12px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#fff;font:16px system-ui,sans-serif;user-select:text;-webkit-user-select:text}',
		'#l99-ml input:focus{outline:none;border-color:#01a982;box-shadow:0 0 0 3px rgba(1,169,130,.25)}',
		'#l99-ml .ml-go{padding:0 14px;border:none;background:linear-gradient(135deg,#01a982,#10b981);color:#fff;font-weight:600}',
		'#l99-ml .ml-frame{position:relative;border-radius:8px;overflow:hidden;background:#000}',
		'#l99-ml .ml-frame iframe,#l99-ml .ml-frame>div{display:block;width:100%;height:100%;border:0}',
		'#l99-ml .ml-listen{display:flex;align-items:center;gap:10px;width:100%;padding:8px 12px;background:rgba(1,169,130,.1);border:1px solid rgba(94,234,212,.35);text-align:left}',
		'#l99-ml .ml-listen:hover{background:rgba(1,169,130,.18)}',
		'#l99-ml .ml-listen.on{background:rgba(1,169,130,.24);border-color:#01a982}',
		'#l99-ml .ml-listen:disabled{opacity:.55;cursor:default;background:transparent;border-color:rgba(255,255,255,.15)}',
		'#l99-ml .ml-listen b{flex:1;font-weight:600}',
		'#l99-ml .ml-meter{display:flex;align-items:flex-end;gap:3px;height:18px}',
		'#l99-ml .ml-meter span{width:5px;height:3px;border-radius:2px;background:#5eead4;transition:height .08s linear}',
		'#l99-ml .ml-note{color:rgba(255,255,255,.62);font-size:12px}',
		'#l99-ml .ml-note a{color:#5eead4}',
		'#l99-ml .ml-note button{background:none;border:none;padding:0;min-height:0;color:#5eead4;text-decoration:underline}',
		'#l99-ml.ml-drop{outline:2px dashed #01a982;outline-offset:-2px}',
		// a phone held upright: narrow, the player at its least (200 x 200); held sideways: the notes only when something is wrong
		'@media (max-width:520px){#l99-ml{width:264px}}',
		'@media (max-height:520px){#l99-ml .ml-note:not(.ml-alert){display:none}}',
		'#l99-ml :focus-visible{outline:2px solid #01a982;outline-offset:2px}',
	].join('\n');

	let root = null, head = null, titleEl = null, body = null, form = null, input = null, frameBox = null, listenBtn = null, listenLabel = null, meter = null, note = null;
	let link = null, player = null, playing = false, another = false;

	function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

	function build() {
		if (root) return;
		document.head.appendChild(style);
		root = el('div');
		root.id = 'l99-ml';
		root.hidden = true;
		root.setAttribute('role', 'dialog');
		root.setAttribute('aria-label', 'Music from a link');
		// nothing typed or tapped here reaches the faceplate's keys or the game underneath
		for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'mouseup', 'keydown', 'keyup', 'keypress', 'wheel', 'click', 'contextmenu', 'paste']) root.addEventListener(ev, (e) => {
			e.stopPropagation();
			if (ev === 'keydown' && e.key === 'Escape' && !link) close();
		});
		head = el('div', 'ml-head');
		titleEl = el('div', 'ml-title');
		const x = el('button', 'ml-x', '✕');
		x.type = 'button';
		x.title = 'Stop and close';
		x.setAttribute('aria-label', 'Stop the music and close');
		x.addEventListener('click', () => close());
		head.append(titleEl, x);
		body = el('div', 'ml-body');
		form = el('form');
		input = el('input');
		input.type = 'url';
		input.name = 'music-link';
		input.id = 'l99-ml-input';
		input.placeholder = 'Paste a YouTube or Spotify link';
		input.setAttribute('aria-label', 'YouTube or Spotify link');
		input.autocomplete = 'off';
		input.autocapitalize = 'none';
		input.spellcheck = false;
		input.enterKeyHint = 'go';
		const go = el('button', 'ml-go', 'Play');
		go.type = 'submit';
		form.append(input, go);
		form.addEventListener('submit', (e) => {
			e.preventDefault();
			if (!open(input.value)) { input.focus(); input.select(); }
		});
		frameBox = el('div', 'ml-frame');
		listenBtn = el('button', 'ml-listen');
		listenBtn.type = 'button';
		listenLabel = el('b');
		meter = el('span', 'ml-meter');
		meter.setAttribute('aria-hidden', 'true');
		for (let i = 0; i < 3; i++) meter.appendChild(el('span'));
		listenBtn.append(el('span', '', '🎧'), listenLabel, meter);
		listenBtn.addEventListener('click', () => listen(!heard.on));
		note = el('div', 'ml-note');
		note.setAttribute('aria-live', 'polite');
		note.addEventListener('click', (e) => {
			const b = e.target.closest('button');
			if (!b) return;
			if (b.hasAttribute('data-another')) { another = true; draw(); input.value = ''; input.focus(); }
		});
		body.append(form, frameBox, listenBtn, note);
		root.append(head, body);
		document.body.appendChild(root);
		drag();
		addEventListener('resize', () => place());
	}

	// ---------- where it sits: dragged by its header, kept on screen, remembered ----------
	function place(x, y) {
		if (!root || root.hidden) return;
		const w = root.offsetWidth, h = root.offsetHeight, vw = innerWidth, vh = innerHeight;
		if (x == null) {
			const p = load().pos;
			if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) { x = p.x * vw; y = p.y * vh; }
			// first time: top centre on a phone (clear of the thumbs), the right-hand side on a computer
			else if (vw < 700) { x = (vw - w) / 2; y = 64; }
			else if (vh < 520) { x = (vw - w) / 2; y = 8; }
			else { x = vw - w - 16; y = 120; }
		}
		x = Math.max(8, Math.min(vw - w - 8, x));
		y = Math.max(8, Math.min(vh - Math.min(h, vh - 16) - 8, y));
		root.style.left = Math.round(x) + 'px';
		root.style.top = Math.round(y) + 'px';
	}
	function drag() {
		let from = null;
		head.addEventListener('pointerdown', (e) => {
			if (e.target.closest('button')) return;
			from = { id: e.pointerId, dx: e.clientX - root.offsetLeft, dy: e.clientY - root.offsetTop };
			try { head.setPointerCapture(e.pointerId); } catch (_) { /* an older browser */ }
		});
		head.addEventListener('pointermove', (e) => { if (from && e.pointerId === from.id) place(e.clientX - from.dx, e.clientY - from.dy); });
		const end = (e) => {
			if (!from || e.pointerId !== from.id) return;
			from = null;
			save({ pos: { x: root.offsetLeft / innerWidth, y: root.offsetTop / innerHeight } });
		};
		head.addEventListener('pointerup', end);
		head.addEventListener('pointercancel', end);
	}

	function say(html, alert) { if (note) { note.innerHTML = html || ''; note.classList.toggle('ml-alert', !!alert); } }
	function emit() { dispatchEvent(new CustomEvent('l99-musiclink', { detail: state() })); }
	function setPlaying(v) { if (playing !== v) { playing = v; emit(); } }

	// ---------- the players ----------
	let ytApi = null;
	function youtubeApi() {
		if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
		if (ytApi) return ytApi;
		ytApi = new Promise((resolve, reject) => {
			const prev = window.onYouTubeIframeAPIReady;
			window.onYouTubeIframeAPIReady = function () { try { prev && prev(); } catch (_) { /* someone else's */ } resolve(window.YT); };
			const s = document.createElement('script');
			s.src = 'https://www.youtube.com/iframe_api';
			s.async = true;
			s.onerror = () => { ytApi = null; reject(new Error('YouTube player did not load')); };
			document.head.appendChild(s);
			setTimeout(() => reject(new Error('YouTube player timed out')), 9000);
		});
		return ytApi;
	}
	function frameSize(L) {
		// YouTube: the player itself never under 200 x 200 (its terms); Spotify's compact player
		const w = Math.max(200, root.clientWidth - 20);
		if (L.service === 'youtube') return { w, h: Math.max(200, Math.round(w * 9 / 16)) };
		return { w, h: 152 };
	}
	function plainFrame(src, L) {
		const f = document.createElement('iframe');
		f.src = src;
		f.title = L.service === 'youtube' ? 'YouTube player' : 'Spotify player';
		f.allow = 'autoplay; encrypted-media; picture-in-picture; clipboard-write; fullscreen';
		f.setAttribute('allowfullscreen', '');
		// YouTube's embeds need to know which site they are on
		f.referrerPolicy = 'strict-origin-when-cross-origin';
		f.loading = 'eager';
		return f;
	}
	function youtubeSrc(L) {
		const q = new URLSearchParams({ autoplay: '1', playsinline: '1', rel: '0', enablejsapi: '1', origin: location.origin });
		if (L.start) q.set('start', String(L.start));
		if (L.list) q.set('list', L.list);
		return 'https://www.youtube.com/embed/' + (L.video || 'videoseries') + '?' + q;
	}
	function startYoutube(L, serial) {
		const holder = el('div');
		frameBox.appendChild(holder);
		youtubeApi().then((YT) => {
			if (serial !== loads) return;
			const vars = { autoplay: 1, playsinline: 1, rel: 0, origin: location.origin };
			if (L.start) vars.start = L.start;
			if (L.list) { vars.list = L.list; if (!L.video) vars.listType = 'playlist'; }
			let skips = 0;
			player = new YT.Player(holder, {
				width: '100%', height: '100%', videoId: L.video || undefined, playerVars: vars,
				events: {
					onReady: (e) => { try { e.target.playVideo(); } catch (_) { /* the phone wants a tap on the player */ } },
					onStateChange: (e) => {
						setPlaying(e.data === 1 || e.data === 3);
						if (e.data === 1 && skips) { skips = 0; say(listenHint()); }
					},
					onError: (e) => {
						// a song its owner keeps on YouTube only: in a playlist, on to the next
						if (L.list && skips < 6) { skips++; say('One song here only plays on YouTube itself; skipping to the next.'); setTimeout(() => { try { player.nextVideo(); } catch (_) { /* gone */ } }, 700); return; }
						say(e.data === 101 || e.data === 150 ? 'Its owner only lets this play on YouTube itself. <a href="' + watchUrl(L) + '" target="_blank" rel="noopener">Open on YouTube</a>, then turn on Listen.' : 'YouTube could not play this one.', true);
						setPlaying(false);
					},
				},
			});
			const f = player.getIframe?.();
			if (f) f.title = 'YouTube player';
		}).catch(() => {
			// the API script did not come: the plain player still plays, we just can't skip for it
			if (serial !== loads) return;
			holder.replaceWith(plainFrame(youtubeSrc(L), L));
			setPlaying(true);
		});
	}
	function watchUrl(L) {
		return L.video ? 'https://www.youtube.com/watch?v=' + L.video + (L.list ? '&list=' + L.list : '') : 'https://www.youtube.com/playlist?list=' + L.list;
	}
	function spotifyUrl(L) { return 'https://open.spotify.com/' + L.kind + '/' + L.id; }
	function listenHint() {
		if (heard.on) return '';
		return CAN_SHARE ? 'The world can\'t hear the player by itself: turn on <b>Let the world hear it</b>.' : 'This browser can\'t share its sound, so the world can\'t hear the player here.';
	}

	let loads = 0;
	function stopPlayer() {
		loads++;
		try { player && player.destroy && player.destroy(); } catch (_) { /* already gone */ }
		player = null;
		if (frameBox) frameBox.textContent = '';
		link = null;
		setPlaying(false);
	}

	function show() {
		build();
		const was = root.hidden;
		root.hidden = false;
		draw();
		if (was) { place(); emit(); }
	}
	function draw() {
		if (!root) return;
		titleEl.innerHTML = link ? '<i>♫</i>' + (link.service === 'youtube' ? 'YouTube' : 'Spotify') + (link.kind ? ' ' + link.kind : link.list ? ' playlist' : '') : '<i>♫</i>Music from a link';
		form.hidden = !!link && !another;
		frameBox.hidden = !link;
		if (link) { const s = frameSize(link); frameBox.style.height = s.h + 'px'; }
		listenLabel.textContent = heard.on ? 'The world hears this tab' : CAN_SHARE ? 'Let the world hear it' : 'This browser can\'t share its sound';
		listenBtn.disabled = !CAN_SHARE;
		listenBtn.classList.toggle('on', heard.on);
		listenBtn.setAttribute('aria-pressed', String(heard.on));
		listenBtn.title = heard.on ? 'Stop listening' : CAN_SHARE ? 'Share this tab\'s sound with the world (tick "Also share tab audio")' : 'This browser has no way to share a tab\'s sound';
		place(root.offsetLeft || null, root.offsetTop || null);
	}

	// ---------- open / close ----------
	function open(text) {
		const L = typeof text === 'object' && text ? text : parse(text);
		show();
		if (!L) { say('That isn\'t a YouTube or Spotify link.', true); return false; }
		if (L.problem) { say(L.problem, true); return false; }
		stopPlayer();
		link = L;
		another = false;
		const serial = loads;
		draw();
		if (L.service === 'youtube') startYoutube(L, serial);
		else {
			const f = plainFrame('https://open.spotify.com/embed/' + L.kind + '/' + L.id + '?utm_source=generator', L);
			frameBox.appendChild(f);
			// (we don't read Spotify's player: its policy keeps its songs away from games and visuals)
			setPlaying(true);
		}
		say((L.service === 'spotify' ? 'Full songs when you\'re signed in to Spotify in this browser, 30-second clips otherwise. ' : '') + listenHint()
			+ ' <a href="' + (L.service === 'youtube' ? watchUrl(L) : spotifyUrl(L)) + '" target="_blank" rel="noopener">Open in ' + (L.service === 'youtube' ? 'YouTube' : 'Spotify') + '</a> · <button type="button" data-another>Another link</button>');
		save({ last: L.service === 'youtube' ? watchUrl(L) : spotifyUrl(L) });
		emit();
		return true;
	}
	function ask() {
		show();
		if (!link) {
			say(listenHint() + ' Or drop a link anywhere on Bard.');
			const last = load().last;
			if (last && !input.value) input.value = last;
			if (!PHONE) setTimeout(() => { try { input.focus(); input.select(); } catch (_) { /* hidden */ } }, 30);
		}
	}
	function close() {
		stopPlayer();
		listen(false);
		if (root) root.hidden = true;
		say('');
		emit();
	}

	// ---------- listening: this tab's sound, shared through the browser's picker ----------
	const heard = { on: false, kind: null, stream: null, src: null, gain: null, analyser: null, raf: 0, bins: null, own: null, pending: false };
	function audioContext() {
		try { if (typeof initAudio === 'function') initAudio(); } catch (_) { /* the faceplate's engine is not up */ }
		// eslint-disable-next-line no-undef
		try { if (typeof masterGain !== 'undefined' && masterGain && masterGain.context) return masterGain.context; } catch (_) { /* not on this page */ }
		if (!heard.own) { try { heard.own = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) { return null; } }
		return heard.own;
	}
	async function capture() {
		const s = await navigator.mediaDevices.getDisplayMedia({
			// the picture is asked for only because the picker needs it: as little of it as it allows
			video: { frameRate: { ideal: 1, max: 5 }, width: { ideal: 320 } },
			audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false },
			preferCurrentTab: true, selfBrowserSurface: 'include', systemAudio: 'include', surfaceSwitching: 'exclude', monitorTypeSurfaces: 'exclude',
		});
		if (!s.getAudioTracks().length) { s.getTracks().forEach((t) => t.stop()); throw Object.assign(new Error('no audio'), { name: 'NoAudio' }); }
		// only the sound is wanted: a computer's Chrome keeps the sound when the picture stops; a
		// phone's share may end with it, so there the picture is only switched off
		s.getVideoTracks().forEach((t) => { if (PHONE) t.enabled = false; else t.stop(); });
		return s;
	}
	async function listen(on) {
		if (!on) {
			if (!heard.on && !heard.stream) return false;
			cancelAnimationFrame(heard.raf);
			try { heard.stream && heard.stream.getTracks().forEach((t) => t.stop()); } catch (_) { /* stopped */ }
			try { heard.src && heard.src.disconnect(); } catch (_) { /* gone */ }
			try { heard.gain && heard.gain.disconnect(); } catch (_) { /* gone */ }
			Object.assign(heard, { on: false, kind: null, stream: null, src: null, gain: null });
			window._linkListen = false;
			if (meter) for (const b of meter.children) b.style.height = '3px';
			draw();
			emit();
			return false;
		}
		if (heard.on || heard.pending) return heard.on;
		if (!CAN_SHARE) { say(PHONE ? 'This phone\'s browser can\'t share its sound yet (Safari on iOS 27 can; older iPhones and Chrome on Android can\'t). On a computer, Chrome can.' : 'This browser can\'t share a tab\'s sound. Chrome or Edge on a computer can.', true); return false; }
		const ctx = audioContext();
		if (!ctx) { say('Sound isn\'t available here.', true); return false; }
		// asked for first, while the tap still counts (Chrome's share picker needs it)
		const asked = capture();
		try { if (ctx.state !== 'running') ctx.resume().catch(() => {}); } catch (_) { /* resumes on the next tap */ }
		let stream;
		heard.pending = true;
		try { stream = await asked; } catch (e) {
			heard.pending = false;
			say(e.name === 'NoAudio' ? (PHONE ? 'The share came without sound: this phone\'s browser can share its screen but not its sound.' : 'No sound was shared. Try again and tick <b>Also share tab audio</b> (Chrome or Edge; Safari and Firefox share no sound).')
				: PHONE && e.name === 'NotAllowedError' ? 'Not shared. If no picker showed, this phone\'s browser can\'t share its sound yet.' : 'Not shared. Tap again to try once more.', true);
			return false;
		}
		heard.pending = false;
		const src = ctx.createMediaStreamSource(stream);
		const gain = ctx.createGain();
		if (!heard.analyser || heard.analyser.context !== ctx) {
			heard.analyser = ctx.createAnalyser();
			heard.analyser.fftSize = 2048;
			heard.analyser.smoothingTimeConstant = 0.7;
		}
		// to the analyser only, never to the speakers: no echo, no feedback
		src.connect(gain);
		gain.connect(heard.analyser);
		Object.assign(heard, { on: true, kind: 'tab', stream, src, gain });
		window._linkAnalyser = heard.analyser;
		window._linkListen = true;
		stream.getAudioTracks().forEach((t) => t.addEventListener('ended', () => listen(false)));
		say('Listening to this tab. The browser shows that it\'s sharing; stop it here or there.');
		draw();
		emit();
		tick();
		return true;
	}
	// the little meter on the switch: what the world is hearing, low, middle, high
	function tick() {
		cancelAnimationFrame(heard.raf);
		if (!heard.on || !heard.analyser) return;
		const A = heard.analyser;
		if (!heard.bins || heard.bins.length !== A.frequencyBinCount) heard.bins = new Uint8Array(A.frequencyBinCount);
		A.getByteFrequencyData(heard.bins);
		const hz = A.context.sampleRate / A.fftSize, cuts = [1, Math.round(250 / hz), Math.round(2000 / hz), heard.bins.length];
		for (let b = 0; b < 3; b++) {
			let s = 0;
			for (let i = cuts[b]; i < cuts[b + 1]; i++) s += heard.bins[i];
			const v = s / Math.max(1, cuts[b + 1] - cuts[b]) / 255;
			if (meter && !root.hidden) meter.children[b].style.height = Math.round(3 + Math.min(1, v * 1.6) * 15) + 'px';
		}
		heard.raf = requestAnimationFrame(tick);
	}

	function state() {
		return { open: !!root && !root.hidden, link: link ? Object.assign({}, link) : null, playing, listening: heard.on, kind: heard.kind };
	}

	// ---------- paste or drop a link anywhere ----------
	const typing = (t) => t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || ''));
	document.addEventListener('paste', (e) => {
		if (typing(e.target) || typing(document.activeElement)) return;
		const text = e.clipboardData && e.clipboardData.getData('text');
		const L = parse(text);
		if (!L) return;
		e.preventDefault();
		open(L);
	});
	const dropText = (dt) => dt && Array.from(dt.types || []).some((t) => t === 'text/uri-list' || t === 'text/plain') && !Array.from(dt.types || []).includes('Files');
	addEventListener('dragover', (e) => {
		if (!dropText(e.dataTransfer)) return;
		e.preventDefault();
		if (root && !root.hidden) root.classList.add('ml-drop');
	}, true);
	addEventListener('dragleave', (e) => { if (root && !e.relatedTarget) root.classList.remove('ml-drop'); }, true);
	addEventListener('drop', (e) => {
		if (root) root.classList.remove('ml-drop');
		if (!dropText(e.dataTransfer) || typing(e.target)) return;
		const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
		// (a link dropped on a page would otherwise take the browser away from Bard)
		e.preventDefault();
		const L = parse(text);
		if (L) { e.stopPropagation(); open(L); } else if (/^\s*https?:\/\//i.test(text)) { show(); say('Only YouTube and Spotify links play here.', true); }
	}, true);
	// a page that loses the tab stops the capture with it
	addEventListener('pagehide', () => listen(false));

	// ---------- the faceplate's button ----------
	function wire() {
		const b = document.getElementById('btn-music-link');
		if (!b || b._ml) return;
		b._ml = true;
		b.addEventListener('click', (e) => { e.stopPropagation(); if (root && !root.hidden) close(); else ask(); });
		addEventListener('l99-musiclink', () => { const s = state(); b.classList.toggle('active', s.open); b.setAttribute('aria-pressed', String(s.open)); });
	}
	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();

	window.L99MusicLink = { open, ask, close, listen, parse, state, get analyser() { return heard.analyser; } };
})();
