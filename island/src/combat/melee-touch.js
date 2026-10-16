// The fight under your right thumb on a touch screen, when your hands are empty. One big
// Strike button (a quick punch on press, the string follows on) and a separate Heavy
// button, a separate Heavy button (hold to charge, release to throw), and, once a fight is on, Block (hold it; raised just as a blow comes in it
// parries), Dodge (the way the stick points, or back) and Grab (a tap grabs, a second tap
// throws; it becomes Takedown, lit, when someone close has their back to you). They take the
// weapon's places round the primary button (Fire, Aim, Reload, Mode), which are hidden while
// you are unarmed; ui/touch-skin.js sets the places and the look, icons only. Hidden while the
// controls menu is open, driving, or holding a weapon.

const CSS = `
#l99-island-mount .mc-btn{position:absolute;display:none;align-items:center;justify-content:center;box-sizing:border-box;width:52px;height:52px;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(8,20,26,.5);color:#eafaf6;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;padding:0;z-index:6}
#l99-island-mount .mc-btn svg{width:22px;height:22px;pointer-events:none}
#l99-island-mount.l99-tools-open .mc-btn{visibility:hidden}`;
const ICON = {
	strike: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M7 11V8.5a1.5 1.5 0 0 1 3 0V11m0-2.5V7a1.5 1.5 0 0 1 3 0v4m0-3a1.5 1.5 0 0 1 3 0v3.5m0-2a1.5 1.5 0 0 1 3 0V14a6 6 0 0 1-6 6h-1.5A5.5 5.5 0 0 1 5 14.5V13a2 2 0 0 1 2-2h3"/></svg>',
	block: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/></svg>',
	dodge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 12h11M11 7l5 5-5 5M19 5v14"/></svg>',
	grab: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12m0-6.5a1.5 1.5 0 0 1 3 0V12m0-5a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7H9a5 5 0 0 1-4.6-3l-1.2-2.8a1.4 1.4 0 0 1 2.4-1.4L8 15"/></svg>',
};

// on: { strike(down: bool), block(down: bool), dodge(), grab() }
export function createMeleeTouch({ mount, on }) {
	const style = document.createElement('style');
	style.textContent = CSS;
	mount.appendChild(style);
	// (no words on the buttons: the name is for screen readers and the desktop's tooltip)
	const named = (b, n) => { if (b.getAttribute('aria-label') !== n) { b.setAttribute('aria-label', n); b.title = n; } };
	function make(cls, name) {
		const b = document.createElement('button');
		b.type = 'button'; b.className = 'mc-btn ' + cls; named(b, name);
		b.innerHTML = ICON[cls.slice(3)];
		// (the thumb's touches are the button's own, never a look or a move)
		b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
		mount.appendChild(b);
		return b;
	}
	const strike = make('mc-strike', 'Strike'), block = make('mc-block', 'Block'), dodge = make('mc-dodge', 'Dodge'), grab = make('mc-grab', 'Grab'), heavy = make('mc-heavy', 'Heavy strike');
	heavy.innerHTML = ICON.strike;
	const held = (b, fn, cancel = () => fn(false)) => {
		let id = null;
		b.addEventListener('pointerdown', (e) => { if (id !== null) return; e.stopPropagation(); e.preventDefault(); id = e.pointerId; try { b.setPointerCapture?.(id); } catch {} b.classList.add('on'); fn(true); });
		const up = (e) => { if (id === null || e.pointerId !== id) return; e.stopPropagation(); id = null; b.classList.remove('on'); e.type === 'pointerup' ? fn(false) : cancel(); };
		b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
	};
	held(strike, (d) => on.strike(d), () => on.cancel?.());
	held(heavy, (d) => on.heavy(d), () => on.cancel?.());
	held(block, (d) => on.block(d));
	const tap = (b, fn) => b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 120); fn(); });
	tap(dodge, () => on.dodge());
	tap(grab, () => on.grab());
	const state = { show: false, fight: false, take: false, holding: false, item: null };
	const vis = (b, v) => { const d = v ? 'flex' : 'none'; if (b.style.display !== d) b.style.display = d; };
	return {
		// show: unarmed and free to fight; fight: a fight is on (the rest of the cluster);
		// take: a takedown is there for the taking; holding: someone is held (Grab throws)
		update(show, fight, take, holding, item) {
			if (show === state.show && fight === state.fight && take === state.take && holding === state.holding && item === state.item) return;
			Object.assign(state, { show, fight, take, holding, item });
			vis(strike, show); vis(heavy, show); vis(block, show && fight); vis(dodge, show && fight); vis(grab, show && (fight || take || holding));
			named(grab, take ? 'Takedown' : holding ? 'Throw' : 'Grab');
			grab.classList.toggle('lit', take);
			// (a blade slashes; a bat, a pipe or a bottle swings)
			named(strike, item === 'knife' || item === 'machete' ? 'Slash' : item ? 'Swing' : 'Strike');
		},
		dispose() { for (const b of [strike, block, dodge, grab, heavy, style]) b.remove(); },
		buttons: { strike, block, dodge, grab, heavy },
	};
}
