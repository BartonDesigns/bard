// The neighbourhood's aid actions are available beside its real gathering.
export function createFamilyAid({ mount, help, hint = () => {} }) {
	if (!mount) return { update() {}, dispose() {} };
	const panel = document.createElement('div');
	panel.className = 'family-aid';
	panel.style.cssText = 'position:absolute;right:14px;bottom:156px;display:none;max-width:260px;padding:10px;background:#17251eee;color:#fff;border:1px solid #718475;border-radius:10px;pointer-events:auto;font:13px system-ui;z-index:31';
	const title = document.createElement('div'); title.style.cssText = 'font-weight:600;margin-bottom:7px';
	const controls = document.createElement('div'); controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px';
	panel.append(title, controls); mount.append(panel);
	for (const e of ['pointerdown', 'touchstart', 'click']) panel.addEventListener(e, (ev) => ev.stopPropagation());
	let last = '';
	return {
		update(moment, credits) {
			panel.style.display = moment ? 'block' : 'none';
			if (!moment) { last = ''; return; }
			const key = `${moment.kind}:${Math.floor(credits)}`; if (key === last) return; last = key;
			title.textContent = `Help the neighbourhood · ${Math.floor(credits)} credits`;
			controls.replaceChildren();
			const actions = moment.kind === 'foodbank' ? [['donate', 50, 'Donate food'], ['garden', 300, 'Fund garden']] : moment.kind === 'market' ? [['stock', 80, 'Stock a kitchen'], ['garden', 300, 'Fund garden']] : [['stock', 80, 'Help with groceries']];
			for (const [kind, cost, label] of actions) {
				const button = document.createElement('button'); button.type = 'button';
				button.textContent = `${label} · ${cost}`; button.disabled = credits < cost;
				button.style.cssText = 'font:inherit;color:inherit;background:#355541;border:1px solid #86a68d;border-radius:6px;padding:8px;cursor:pointer';
				button.addEventListener('click', () => { hint(help(kind, { credits: cost }), 6000); last = ''; });
				controls.append(button);
			}
		},
		dispose() { panel.remove(); },
	};
}
