// The account panel: make a username and password so your progress is saved to the cloud, log
// in on another device to bring it back, and set a new password with your recovery code. Its
// way in is the first row of the places menu (☁), which also says when you last saved.
// The rules and the talking to the server: persistence/cloud-save.js.

const NUDGE_KEY = 'l99-account-nudge';
const CSS = `
.acct{position:absolute;inset:0;display:none;align-items:center;justify-content:center;z-index:20;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);padding:16px;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#fff}
.acct.on{display:flex}
.acct-card{width:min(380px,100%);max-height:100%;overflow-y:auto;background:#1a1a1a;border:1px solid rgba(255,255,255,.1);border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.8);padding:20px;display:flex;flex-direction:column;gap:12px}
.acct-head{display:flex;align-items:center;gap:10px}
.acct-head b{flex:1;font-size:18px;font-weight:600}
.acct-x{width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,.2);background:transparent;color:rgba(255,255,255,.7);font-size:15px;cursor:pointer}
.acct-tabs{display:flex;gap:4px;border-bottom:1px solid rgba(255,255,255,.1)}
.acct-tab{flex:1;padding:10px 4px;border:0;border-bottom:3px solid transparent;background:none;color:rgba(255,255,255,.7);font:600 13px system-ui;cursor:pointer}
.acct-tab.cur{color:#fff;border-bottom-color:#01a982}
.acct label{display:flex;flex-direction:column;gap:4px;font-size:12px;color:rgba(255,255,255,.7)}
.acct input{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:12px 14px;color:#fff;font:16px system-ui;outline:none}
.acct input:focus{border-color:#01a982;background:rgba(255,255,255,.08);box-shadow:0 0 0 3px rgba(1,169,130,.2)}
.acct-go{background:linear-gradient(135deg,#01a982 0%,#10b981 100%);color:#fff;border:0;border-radius:8px;padding:12px 20px;font:600 15px system-ui;cursor:pointer;box-shadow:0 4px 12px rgba(1,169,130,.3);min-height:44px}
.acct-go:disabled{opacity:.5;cursor:default}
.acct-alt{background:transparent;color:#01a982;border:2px solid #01a982;border-radius:8px;padding:10px 18px;font:600 14px system-ui;cursor:pointer;min-height:44px}
.acct-ghost{background:transparent;color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.2);border-radius:8px;padding:8px 14px;font:13px system-ui;cursor:pointer;min-height:40px}
.acct-note{font-size:13px;color:rgba(255,255,255,.7)}
.acct-err{font-size:13px;color:#ef4444;min-height:0}
.acct-err:empty{display:none}
.acct-code{font:700 22px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.06em;text-align:center;padding:14px;border-radius:12px;background:rgba(1,169,130,.12);border:1px solid rgba(1,169,130,.5);user-select:all;-webkit-user-select:all}
.acct-row{display:flex;gap:8px;flex-wrap:wrap}
.acct-row>*{flex:1}
.acct-save{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border-radius:12px;background:#2a2a2a;border:1px solid rgba(255,255,255,.1)}
.acct-save b{font-size:15px}
`;

// menu: the places menu; cloud: createCloudSave's; hint(text, ms)
export function createAccountPanel({ mount, menu, cloud, hint = () => {} }) {
	if (!document.getElementById('acct-css')) { const s = document.createElement('style'); s.id = 'acct-css'; s.textContent = CSS; document.head.appendChild(s); }
	const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
	const root = el('div', 'acct');
	root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', 'Your account');
	// (nothing typed or tapped here reaches the game underneath)
	for (const ev of ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'keydown', 'keyup', 'wheel', 'click', 'contextmenu']) root.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.key === 'Escape') close(); });
	root.addEventListener('click', (e) => { if (e.target === root) close(); });
	const card = el('div', 'acct-card');
	root.append(card);
	mount.appendChild(root);
	let view = 'signup', note = null, busy = false;

	const ago = (t) => {
		if (!t) return 'not yet';
		const s = Math.max(0, (Date.now() - t) / 1000);
		return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : new Date(t).toLocaleDateString();
	};
	const when = (t) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

	// ---------- its way in ----------
	let btn = null;
	if (menu) {
		btn = el('button');
		btn.type = 'button';
		btn.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(94,234,212,.35);background:rgba(1,169,130,.12);color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;';
		for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) btn.addEventListener(ev, (x) => x.stopPropagation());
		btn.addEventListener('click', (e) => { e.stopPropagation(); menu.style.display = 'none'; open(); });
		menu.insertBefore(btn, menu.firstChild);
	}
	function drawBtn() {
		if (!btn) return;
		const I = cloud.info();
		btn.textContent = I.user ? `☁ ${I.user} · ${I.conflict ? 'saved progress waiting' : `saved ${ago(I.savedAt)}`}` : '☁ Save your progress';
		btn.title = I.user ? 'Your account: progress saved to the cloud' : 'Make an account so clearing the browser never loses your progress';
	}

	// ---------- the views ----------
	function head(title) {
		const h = el('div', 'acct-head'), x = el('button', 'acct-x', '✕');
		x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = () => close();
		h.append(el('b', '', title), x);
		return h;
	}
	function field(label, name, type, auto, extra = {}) {
		const l = el('label', '', label), i = el('input');
		i.name = name; i.id = 'acct-' + name; i.type = type; i.autocomplete = auto; i.required = true;
		Object.assign(i, extra);
		if (type !== 'password') { i.autocapitalize = 'none'; i.spellcheck = false; }
		l.append(i);
		return [l, i];
	}
	function tabs() {
		const t = el('div', 'acct-tabs');
		t.setAttribute('role', 'tablist');
		for (const [k, label] of [['signup', 'Create account'], ['login', 'Log in'], ['reset', 'Forgot password']]) {
			const b = el('button', 'acct-tab' + (view === k ? ' cur' : ''), label);
			b.type = 'button'; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', String(view === k));
			b.onclick = () => { view = k; note = null; draw(); };
			t.append(b);
		}
		return t;
	}
	// a form whose button runs fn(values); errors shown under it
	function form(fields, label, fn) {
		const f = el('form'), err = el('div', 'acct-err'), go = el('button', 'acct-go', label);
		go.type = 'submit';
		f.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
		f.append(...fields.map((x) => x[0]), err, go);
		f.addEventListener('submit', async (e) => {
			e.preventDefault();
			if (busy) return;
			busy = true; go.disabled = true; err.textContent = '';
			try { await fn(fields.map((x) => x[1].value)); } catch (x) { err.textContent = x.message || 'That did not work. Try again.'; } finally { busy = false; go.disabled = false; }
		});
		return f;
	}
	function savedCard(s) {
		const c = el('div', 'acct-save');
		c.append(el('b', '', `Level ${s.level || 1}${s.honor ? ` · ${s.honor} honor` : ''}`), el('span', 'acct-note', `Saved ${when(s.at)}`));
		return c;
	}
	function draw() {
		card.replaceChildren();
		const I = cloud.info();
		if (!I.available) { card.append(head('Your account'), el('div', 'acct-note', 'Accounts are not available here.')); return; }
		// the recovery code, shown once
		if (note?.recovery) {
			card.append(head('Keep this code safe'), el('div', 'acct-note', 'It is the only way to set a new password if you forget yours. Write it down or save it somewhere private. You will not see it again.'), el('div', 'acct-code', note.recovery));
			const row = el('div', 'acct-row'), cp = el('button', 'acct-alt', 'Copy'), ok = el('button', 'acct-go', 'I saved it');
			cp.type = ok.type = 'button';
			cp.onclick = async () => { try { await navigator.clipboard.writeText(note.recovery); cp.textContent = 'Copied'; } catch { cp.textContent = 'Select and copy it'; } };
			ok.onclick = () => { const next = note.then; note = next || null; draw(); };
			row.append(cp, ok); card.append(row);
			return;
		}
		// just logged in, with progress in the cloud: which to keep
		if (note?.saved) {
			const s = note.saved;
			card.append(head(`Welcome back, ${I.user}`), el('div', 'acct-note', 'Your saved progress:'), savedCard(s), el('div', 'acct-note', 'Loading it replaces the progress on this device. The game starts again to bring it in.'));
			const go = el('button', 'acct-go', 'Load my saved progress'), keepHere = el('button', 'acct-ghost', 'Keep this device’s progress instead');
			go.type = keepHere.type = 'button';
			go.onclick = async () => { go.disabled = true; go.textContent = 'Loading…'; try { await cloud.load(); } catch (e) { go.disabled = false; go.textContent = 'Load my saved progress'; hint(e.message, 4000); } };
			keepHere.onclick = async () => { if (!confirm('Save this device’s progress over the one in the cloud? The cloud one will be gone.')) return; const r = await cloud.save({ force: true, over: true }); note = null; draw(); drawBtn(); hint(r.ok ? 'This device’s progress is saved to your account.' : r.error || 'Could not save.', 3500); };
			card.append(go, keepHere);
			return;
		}
		if (I.user) {
			card.append(head('Your account'));
			const who = el('div', 'acct-save');
			who.append(el('b', '', I.user), el('span', 'acct-note', I.conflict ? 'Your account holds progress this device has not loaded yet.' : `Progress saved ${ago(I.savedAt)}. It saves by itself every minute while you play.`));
			card.append(who);
			if (I.error && !I.conflict) card.append(el('div', 'acct-err', I.error));
			if (I.conflict) {
				const go = el('button', 'acct-go', 'Load my saved progress'), keepHere = el('button', 'acct-ghost', 'Keep this device’s progress');
				go.type = keepHere.type = 'button';
				go.onclick = async () => { go.disabled = true; try { await cloud.load(); } catch (e) { go.disabled = false; hint(e.message, 4000); } };
				keepHere.onclick = async () => { if (!confirm('Save this device’s progress over the newer one? The newer one will be gone.')) return; await cloud.save({ force: true, over: true }); draw(); drawBtn(); };
				card.append(go, keepHere);
			} else {
				const now = el('button', 'acct-go', 'Save now');
				now.type = 'button';
				now.onclick = async () => { now.disabled = true; now.textContent = 'Saving…'; const r = await cloud.save({ force: true }); draw(); drawBtn(); if (r.conflict) hint('Newer progress was saved on another device.', 3500); };
				card.append(now);
			}
			const out = el('button', 'acct-ghost', 'Log out');
			out.type = 'button';
			out.onclick = async () => { out.disabled = true; await cloud.logout(); view = 'login'; draw(); drawBtn(); hint('Logged out. Your progress stays on this device too.', 3000); };
			card.append(out);
			return;
		}
		card.append(head(view === 'reset' ? 'Set a new password' : 'Save your progress'), tabs());
		if (view === 'signup') {
			card.append(el('div', 'acct-note', 'Pick a username and password. Your skills, honor, gear, quests and home are saved to the cloud, so clearing the browser or changing phones loses nothing.'));
			const u = field('Username', 'username', 'text', 'username', { maxLength: 20, placeholder: '3 to 20 letters or digits' }), p = field('Password', 'new-password', 'password', 'new-password', { minLength: 8, maxLength: 128, placeholder: 'At least 8 characters' });
			card.append(form([u, p], 'Create account', async ([a, b]) => { const r = await cloud.signup(a, b); note = { recovery: r.recovery }; draw(); drawBtn(); hint('Account made: your progress is saved.', 3000); }));
		} else if (view === 'login') {
			const u = field('Username', 'username', 'text', 'username', { maxLength: 20 }), p = field('Password', 'current-password', 'password', 'current-password', { maxLength: 128 });
			card.append(form([u, p], 'Log in', async ([a, b]) => { const r = await cloud.login(a, b); await afterLogin(r.saved); }));
		} else {
			card.append(el('div', 'acct-note', 'Type the 16-character recovery code you were given when you made your account.'));
			const u = field('Username', 'username', 'text', 'username', { maxLength: 20 }), c = field('Recovery code', 'recovery-code', 'text', 'one-time-code', { maxLength: 24, placeholder: 'XXXX-XXXX-XXXX-XXXX' }), p = field('New password', 'new-password', 'password', 'new-password', { minLength: 8, maxLength: 128 });
			card.append(form([u, c, p], 'Set new password', async ([a, b, d]) => { const r = await cloud.reset(a, b, d); note = { recovery: r.recovery, then: r.saved ? { saved: r.saved } : null }; if (!r.saved) await cloud.save({ force: true }); draw(); drawBtn(); }));
		}
	}
	// logged in: the cloud's progress offered, or (none yet) this device's saved up
	async function afterLogin(saved) {
		if (saved) { note = { saved }; draw(); drawBtn(); return; }
		await cloud.save({ force: true });
		draw(); drawBtn();
		hint('Logged in: this device’s progress is saved to your account.', 3000);
	}

	function open() { note = null; view = cloud.info().user ? view : view || 'signup'; draw(); root.classList.add('on'); setTimeout(() => card.querySelector('input')?.focus(), 50); }
	function close() { root.classList.remove('on'); note = null; drawBtn(); }
	cloud.start();
	drawBtn();
	const tick = setInterval(drawBtn, 30000);
	// a word, once a day, after a while of play without an account
	const nudge = setTimeout(() => {
		if (cloud.info().user || !cloud.info().available) return;
		const today = new Date().toDateString();
		try { if (localStorage.getItem(NUDGE_KEY) === today) return; localStorage.setItem(NUDGE_KEY, today); } catch { return; }
		hint('Make an account so you never lose your progress: ☁ Save your progress, in the map pin menu.', 6000);
	}, 8 * 60 * 1000);
	return {
		open, close, isOpen: () => root.classList.contains('on'), refresh: drawBtn,
		dispose() { clearInterval(tick); clearTimeout(nudge); cloud.stop(); root.remove(); btn?.remove(); },
	};
}
