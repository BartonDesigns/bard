// The fight under your right thumb on a touch screen, when your hands are empty. One big
// Strike button (tap for a quick punch, the string follows on; hold for a heavy one, released
// to throw it), and, once a fight is on, a Block to its left (hold it; raised just as a blow
// comes in it parries), Dodge above that (the way the stick points, or back) and Grab above
// Strike (a tap grabs, a second tap throws; it reads Takedown, lit, when someone close has
// their back to you). They sit where the weapon's Fire, Aim and Reload sit, which are hidden
// while you are unarmed, above the jump, so nothing overlaps; the cluster rides up with the
// thumb's stack (--l99-low) when more buttons show there. Hidden while the controls menu is
// open, driving, or holding a weapon.

const CSS = `
#l99-island-mount .mc-btn{position:absolute;display:none;align-items:center;justify-content:center;flex-direction:column;gap:1px;box-sizing:border-box;border-radius:50%;border:1px solid rgba(255,255,255,.3);background:rgba(8,20,26,.5);color:#eafaf6;font:600 11px/1.1 system-ui,sans-serif;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);transition:background .12s,transform .08s,opacity .2s;padding:0;z-index:6}
#l99-island-mount .mc-btn.on{background:rgba(255,150,90,.45);transform:scale(.94)}
#l99-island-mount .mc-btn.lit{background:rgba(120,200,170,.5);border-color:rgba(190,255,230,.8)}
#l99-island-mount .mc-btn svg{width:22px;height:22px;pointer-events:none}
#l99-island-mount .mc-strike{right:calc(14px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 96px) + 6px + env(safe-area-inset-bottom));width:76px;height:76px;font-size:12px}
#l99-island-mount .mc-strike svg{width:28px;height:28px}
#l99-island-mount .mc-block{right:calc(102px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 96px) + 18px + env(safe-area-inset-bottom));width:62px;height:62px}
#l99-island-mount .mc-dodge{right:calc(92px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 96px) + 92px + env(safe-area-inset-bottom));width:52px;height:52px}
#l99-island-mount .mc-grab{right:calc(26px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 96px) + 96px + env(safe-area-inset-bottom));width:52px;height:52px}
#l99-island-mount.l99-tools-open .mc-btn{visibility:hidden}
@media (orientation:landscape) and (max-height:540px){
#l99-island-mount .mc-strike{bottom:calc(var(--l99-low, 96px) - 4px + env(safe-area-inset-bottom))}
#l99-island-mount .mc-block{right:calc(100px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 96px) + 2px + env(safe-area-inset-bottom))}
#l99-island-mount .mc-dodge{right:calc(166px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 96px) + 10px + env(safe-area-inset-bottom))}
#l99-island-mount .mc-grab{right:calc(24px + env(safe-area-inset-right));bottom:calc(var(--l99-low, 96px) + 80px + env(safe-area-inset-bottom))}
}`;
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
	const label = {};
	function make(cls, name, text) {
		const b = document.createElement('button');
		b.type = 'button'; b.className = 'mc-btn ' + cls; b.setAttribute('aria-label', name); b.title = name;
		b.innerHTML = ICON[cls.slice(3)] + '<span></span>';
		label[cls] = b.lastChild; label[cls].textContent = text;
		// (the thumb's touches are the button's own, never a look or a move)
		b.addEventListener('touchstart', (e) => e.stopPropagation(), { passive: true });
		mount.appendChild(b);
		return b;
	}
	const strike = make('mc-strike', 'Strike', 'Strike'), block = make('mc-block', 'Block', 'Block'), dodge = make('mc-dodge', 'Dodge', 'Dodge'), grab = make('mc-grab', 'Grab', 'Grab');
	const held = (b, fn) => {
		let id = null;
		b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); id = e.pointerId; b.setPointerCapture?.(id); b.classList.add('on'); fn(true); });
		const up = (e) => { if (id === null || e.pointerId !== id) return; e.stopPropagation(); id = null; b.classList.remove('on'); fn(false); };
		b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
	};
	held(strike, (d) => on.strike(d));
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
			vis(strike, show); vis(block, show && fight); vis(dodge, show && fight); vis(grab, show && (fight || take || holding));
			const g = take ? 'Takedown' : holding ? 'Throw' : 'Grab';
			if (label['mc-grab'].textContent !== g) { label['mc-grab'].textContent = g; grab.setAttribute('aria-label', g); }
			grab.classList.toggle('lit', take);
			const s = item ? 'Swing' : 'Strike';
			if (label['mc-strike'].textContent !== s) label['mc-strike'].textContent = s;
		},
		dispose() { for (const b of [strike, block, dodge, grab, style]) b.remove(); },
		buttons: { strike, block, dodge, grab },
	};
}
