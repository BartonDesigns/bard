// Talking with someone out loud, face to face, without the chat panel: what they say runs
// as a subtitle with their name, what you say shows as you say it ("You: ..."), and while the
// microphone is on a small line says who is listening to you. The microphone is the browser's
// own speech recognition, hands-free: it listens, hears a whole sentence, sends it, and steps
// aside while the person answers (so it never hears their voice as yours), then listens again.
//
//   createTalkLive({ mount, touch, onHeard(text), onType(), onBye(), onChoices(), speaking() })
//     open(name)   close()   you(text, final)   line(name, text)   note(text)
//     mic(on?)     toggleMic()   micOn()   choices(on)   isOpen()   hearing()
// Keys (main.js and guide.js): M the microphone, Enter to type, Esc to say goodbye.

const Rec = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
export const canListen = () => !!Rec;

const STYLE = `
.l99-live{position:absolute;left:50%;transform:translateX(-50%);width:min(640px,calc(100vw - 24px));display:none;flex-direction:column;align-items:center;gap:6px;pointer-events:none;z-index:6;font:15px/1.45 var(--bard-body,system-ui,sans-serif);color:#fff;text-align:center;}
.l99-live.on{display:flex;}
.l99-live.desk{bottom:calc(92px + env(safe-area-inset-bottom));}
.l99-live.touch{top:calc(var(--l99-top, env(safe-area-inset-top)) + 64px);}
.l99-live .lv-you{max-width:100%;padding:6px 12px;border-radius:10px;background:rgba(6,10,14,.72);border:1px solid rgba(95,240,198,.22);display:none;}
.l99-live .lv-you b{color:#5ff0c6;font-weight:600;margin-right:6px;}
.l99-live .lv-you.interim span{color:rgba(255,255,255,.72);font-style:italic;}
.l99-live .lv-ear{display:none;align-items:center;gap:8px;padding:3px 10px;border-radius:9px;background:rgba(6,10,14,.6);font:12px var(--bard-body,system-ui,sans-serif);color:rgba(255,255,255,.78);}
.l99-live .lv-ear.on{display:inline-flex;}
.l99-live .lv-dot{width:8px;height:8px;border-radius:50%;background:#01a982;box-shadow:0 0 8px rgba(1,169,130,.8);}
.l99-live .lv-bars{display:inline-flex;align-items:flex-end;gap:2px;height:12px;}
.l99-live .lv-bars i{display:block;width:3px;height:12px;border-radius:1px;background:#10b981;transform-origin:bottom;transform:scaleY(.25);}
.l99-live .lv-ear.hot .lv-bars i{animation:l99-lvbar .7s ease-in-out infinite;}
.l99-live .lv-bars i:nth-child(2){animation-delay:.12s!important}.l99-live .lv-bars i:nth-child(3){animation-delay:.24s!important}.l99-live .lv-bars i:nth-child(4){animation-delay:.36s!important}.l99-live .lv-bars i:nth-child(5){animation-delay:.48s!important}
@keyframes l99-lvbar{0%,100%{transform:scaleY(.25)}50%{transform:scaleY(1)}}
.l99-live .lv-line{max-width:100%;padding:8px 14px;border-radius:12px;background:rgba(6,10,14,.78);border:1px solid rgba(255,255,255,.1);text-shadow:0 1px 2px rgba(0,0,0,.9);display:none;}
.l99-live .lv-line b{color:#f5c76b;font-weight:600;margin-right:6px;font-family:var(--bard-display,system-ui,sans-serif);letter-spacing:.02em;}
.l99-live .lv-note{font:12px var(--bard-body,system-ui,sans-serif);color:#9fe8d0;max-width:100%;display:none;text-shadow:0 1px 2px #000;}
.l99-live .lv-row{display:flex;gap:6px;flex-wrap:wrap;justify-content:center;pointer-events:auto;}
.l99-live .lv-row button{min-height:40px;min-width:44px;padding:6px 12px;border-radius:10px;border:1px solid rgba(255,255,255,.22);background:rgba(8,20,26,.72);color:#eafaf6;font:600 13px var(--bard-display,system-ui,sans-serif);cursor:pointer;touch-action:manipulation;}
.l99-live .lv-row button.mic-on{border-color:#01a982;background:rgba(1,169,130,.32);}
.l99-live .lv-row button.lv-pick{border-color:#f5c76b;color:#f5c76b;}
.l99-live .lv-row button:focus-visible{outline:2px solid #01a982;outline-offset:2px;}
@media (prefers-reduced-motion: reduce){.l99-live .lv-ear.hot .lv-bars i{animation:none;transform:scaleY(.7);}}
`;

export function createTalkLive({ mount, touch = false, onHeard = () => {}, onType = () => {}, onBye = () => {}, onChoices = () => {}, speaking = () => false } = {}) {
	const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };
	if (!document.getElementById('l99-live-style')) { const st = el('style'); st.id = 'l99-live-style'; st.textContent = STYLE; document.head.append(st); }
	const wrap = el('div', 'l99-live ' + (touch ? 'touch' : 'desk'));
	wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Conversation');
	const you = el('div', 'lv-you'), youB = el('b', '', 'You:'), youT = el('span');
	you.append(youB, youT);
	const ear = el('div', 'lv-ear'), dot = el('span', 'lv-dot'), bars = el('span', 'lv-bars'), earT = el('span');
	for (let i = 0; i < 5; i++) bars.append(el('i'));
	ear.append(dot, earT, bars);
	const line = el('div', 'lv-line'), lineB = el('b'), lineT = el('span');
	line.append(lineB, lineT);
	line.setAttribute('aria-live', 'polite');
	const note = el('div', 'lv-note');
	const row = el('div', 'lv-row');
	const micB = el('button', '', ''), typeB = el('button', '', touch ? '⌨ Type' : '⌨ Type · Enter'), pickB = el('button', 'lv-pick', 'Choices ▸'), byeB = el('button', '', touch ? 'Bye' : 'Bye · Esc');
	for (const b of [micB, typeB, pickB, byeB]) b.type = 'button';
	micB.setAttribute('aria-label', 'Microphone'); typeB.setAttribute('aria-label', 'Type instead'); byeB.setAttribute('aria-label', 'End the conversation'); pickB.setAttribute('aria-label', 'Open the choices');
	pickB.hidden = true;
	if (!Rec) micB.hidden = true;
	row.append(micB, typeB, pickB, byeB);
	wrap.append(you, ear, line, note, row);
	mount.append(wrap);
	// (taps and keys on the controls stay out of the game's own controls)
	for (const ev of ['pointerdown', 'touchstart', 'keydown']) row.addEventListener(ev, (e) => e.stopPropagation());
	micB.onclick = () => { toggleMic(); micB.blur(); };
	typeB.onclick = () => { typeB.blur(); onType(); };
	byeB.onclick = () => { byeB.blur(); onBye(); };
	pickB.onclick = () => { pickB.blur(); onChoices(); };

	let open = false, name = '', want = false, rec = null, held = false, heldT = 0, timer = 0, interim = '', fails = 0, noteT = 0;
	const drawMic = () => {
		micB.textContent = want ? (touch ? '🎙 Mic on' : '🎙 Mic on · M') : (touch ? '🎙 Mic off' : '🎙 Mic off · M');
		micB.classList.toggle('mic-on', want);
		micB.setAttribute('aria-pressed', String(want));
		ear.classList.toggle('on', want);
		earT.textContent = held ? `${name} is speaking…` : `Listening… (to ${name})`;
		ear.classList.toggle('hot', want && !held);
	};
	function start() {
		if (!Rec || rec || !want || held || !open) return;
		try {
			rec = new Rec();
			rec.lang = navigator.language || 'en-US';
			rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
			rec.onresult = (e) => {
				if (held) return;
				let fin = '', mid = '';
				for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) fin += r[0].transcript; else mid += r[0].transcript; }
				if (mid.trim()) { interim = mid.trim(); showYou(interim, false); }
				if (fin.trim()) { interim = ''; fails = 0; const t = fin.trim(); showYou(t, true); hold(true); onHeard(t); }
			};
			rec.onerror = (e) => {
				// (said no to the microphone, or there isn't one: off, and say so)
				if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture') { want = false; drawMic(); showNote(e.error === 'audio-capture' ? 'No microphone found. Type instead.' : 'The microphone is blocked for this page. Allow it in the browser, or type instead.'); }
				else if (e.error !== 'no-speech' && e.error !== 'aborted') fails++;
			};
			rec.onend = () => {
				rec = null;
				// a quiet spell ends a session on some browsers: listen again, unless it keeps failing
				if (want && !held && open) { if (fails > 4) { want = false; drawMic(); showNote('Listening stopped. Press M to try again.'); return; } clearTimeout(timer); timer = setTimeout(start, 250); }
			};
			rec.start();
		} catch { rec = null; }
	}
	function stop() { clearTimeout(timer); if (rec) { const r = rec; rec = null; r.onend = null; try { r.abort(); } catch { /* gone */ } } }
	// the person is answering: the microphone steps aside until their voice has finished
	function hold(on) {
		held = on; heldT = 0;
		if (on) stop();
		drawMic();
		if (!on) start();
	}
	// (watched a few times a second while held: speaking() is their voice still going)
	setInterval(() => {
		if (!open || !held) return;
		if (speaking()) { heldT = 0; return; }
		heldT += 1;
		if (heldT >= 2 && !busy) hold(false);
	}, 200);
	let busy = false;
	function showYou(t, final) {
		you.style.display = t ? 'block' : 'none';
		you.classList.toggle('interim', !final);
		youT.textContent = t.length > 200 ? '…' + t.slice(-200) : t;
	}
	function showNote(t) {
		clearTimeout(noteT);
		note.textContent = t; note.style.display = t ? 'block' : 'none';
		if (t) noteT = setTimeout(() => { note.style.display = 'none'; }, 7000);
	}
	function mic(on = !want) {
		want = !!on && !!Rec && open;
		if (!want) { stop(); interim = ''; }
		else { fails = 0; start(); }
		drawMic();
		return want;
	}
	function toggleMic() { return mic(!want); }
	return {
		open(n, { listen = false } = {}) {
			name = n || 'them'; open = true; held = false; busy = false;
			wrap.classList.add('on');
			showYou('', true); showNote(''); line.style.display = 'none'; pickB.hidden = true;
			drawMic();
			if (listen) mic(true);
		},
		close() { open = false; want = false; held = false; stop(); wrap.classList.remove('on'); drawMic(); },
		isOpen: () => open,
		you: (t, final = true) => { if (open) showYou(String(t || ''), final); },
		line(who, t) {
			if (!open) return;
			const s = String(t || '');
			line.style.display = s ? 'block' : 'none';
			lineB.textContent = (who || name) + ':';
			lineT.textContent = s.length > 320 ? '…' + s.slice(-320) : s;
		},
		note: (t) => { if (open) showNote(String(t || '')); },
		// a reply on its way: the microphone waits for it, then for the voice to finish
		thinking(on) { busy = !!on; if (on && !held) hold(true); },
		mic, toggleMic, micOn: () => want,
		hearing: () => want && !held,
		choices(on) { pickB.hidden = !on; },
	};
}
