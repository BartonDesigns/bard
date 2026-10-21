// Music from a link, in the world: its way in from the map pin menu, and the auto music
// making way while a link plays. The player itself lives on the page (../../music-link.js),
// over the faceplate and the world alike; what it hears reaches the world through
// L99Continuity.sample, the same bands the faceplate's own music drives.

export function createMusicLinkEntry({ menu, autoMusic, hint }) {
	let btn = null, hushed = false;
	const ML = () => window.L99MusicLink;
	if (menu) {
		btn = document.createElement('button');
		btn.type = 'button';
		btn.style.cssText = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px var(--bard-body,system-ui,sans-serif);min-height:36px;cursor:pointer;';
		for (const ev of ['pointerdown', 'touchstart', 'keydown', 'wheel']) btn.addEventListener(ev, (x) => x.stopPropagation());
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			menu.style.display = 'none';
			if (!ML()) { hint?.('Music from a link is not on this page.', 3000); return; }
			ML().ask();
		});
		menu.insertBefore(btn, menu.firstChild);
	}
	function drawBtn(s = ML()?.state?.() || {}) {
		if (!btn) return;
		btn.textContent = s.link ? `♫ Playing from ${s.link.service === 'youtube' ? 'YouTube' : 'Spotify'}${s.listening ? ' · the world hears it' : ''}` : '♫ Play a YouTube or Spotify link';
		btn.title = 'Play a playlist from a link and let the world hear it (or paste or drop a link anywhere)';
	}
	// the auto music steps aside while a link plays, and comes back after (not saved: it is
	// still on the next time)
	function onLink(e) {
		const s = e.detail || {};
		drawBtn(s);
		const busy = !!s.link && s.playing;
		if (busy && !hushed && autoMusic?.on?.()) { hushed = true; autoMusic.auto(false, true); }
		else if (!busy && hushed) { hushed = false; if (!autoMusic?.on?.()) autoMusic?.auto(true, true); }
	}
	addEventListener('l99-musiclink', onLink);
	drawBtn();
	return { dispose() { removeEventListener('l99-musiclink', onLink); btn?.remove(); } };
}
