// What this site keeps on the device, by kind, and a way to remove each:
//   the on-device voices: the language models' weights and runtimes (WebLLM keeps them in
//     the browser's Cache Storage: hundreds of megabytes each), listed per model
//   your progress: quests, field notes, your home, settings (a few kilobytes)
//   the game's own files: terrain, map data, textures (the browser's ordinary cache;
//     only the browser can clear it)

const MB = (b) => (b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : (b / 1e6).toFixed(b < 1e7 ? 1 : 0) + ' MB');

// every cached request, grouped by the model it belongs to
async function modelFiles() {
	const out = new Map();
	if (!('caches' in window)) return out;
	for (const name of await caches.keys()) {
		const c = await caches.open(name);
		for (const req of await c.keys()) {
			const m = /mlc-ai\/([^/]+)\//.exec(req.url) || /\/([A-Za-z0-9.]+-[0-9.]+[BM]-[A-Za-z-]*?q4f\d+_\d)[^/]*\.wasm/.exec(req.url);
			const id = m ? m[1].replace(/-MLC$/, '') : (/webllm|mlc/i.test(name) ? 'runtime' : null);
			if (!id) continue;
			const res = await c.match(req);
			const size = +(res?.headers.get('content-length') || 0);
			let g = out.get(id);
			if (!g) out.set(id, g = { id, size: 0, items: [] });
			g.size += size; g.items.push([name, req]);
		}
	}
	return out;
}

// on a phone, where space is short and one voice is used at a time: remove every
// downloaded model but the one in use (a model left behind by a switch is hundreds of MB)
export async function pruneModels(keepId) {
	const keep = keepId.replace(/-MLC$/, '');
	let freed = 0;
	for (const g of (await modelFiles()).values()) {
		if (g.id === 'runtime' || keep.startsWith(g.id)) continue;
		for (const [name, req] of g.items) { try { await (await caches.open(name)).delete(req); } catch { /* gone already */ } }
		freed += g.size;
	}
	return freed;
}

export function storagePanel(host, { activeModel, onModelRemoved } = {}) {
	const box = document.createElement('div');
	box.style.cssText = 'margin-top:10px;padding-top:8px;border-top:1px solid rgba(255,255,255,.15);font:12px system-ui;line-height:1.4;';
	host.appendChild(box);
	const btn = (label, fn) => { const b = document.createElement('button'); b.textContent = label; b.style.cssText = 'margin-left:auto;min-height:30px;padding:0 10px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:transparent;color:#fff;font:11px system-ui;cursor:pointer;flex:none;'; b.onclick = async (e) => { e.stopPropagation(); b.disabled = true; await fn(); draw(); }; return b; };
	const row = (text, sub, action) => { const r = document.createElement('div'); r.style.cssText = 'display:flex;align-items:center;gap:8px;margin:5px 0;'; const t = document.createElement('div'); t.innerHTML = `<div>${text}</div>${sub ? `<div style="opacity:.55">${sub}</div>` : ''}`; r.append(t); if (action) r.append(action); box.append(r); };
	async function draw() {
		box.innerHTML = '<div style="font-weight:700;letter-spacing:.06em;margin-bottom:4px;">STORAGE ON THIS DEVICE</div><div style="opacity:.6">Measuring…</div>';
		const est = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null;
		const models = await modelFiles().catch(() => new Map());
		box.innerHTML = '<div style="font-weight:700;letter-spacing:.06em;margin-bottom:4px;">STORAGE ON THIS DEVICE</div>';
		if (est) row(`In use by this site: <b>${MB(est.usage || 0)}</b>`, est.quota ? `the browser allows up to ${MB(est.quota)}` : '');
		// the voices, one row per model
		const active = activeModel?.();
		let unused = [];
		for (const g of [...models.values()].sort((a, b) => b.size - a.size)) {
			const inUse = active && active.startsWith(g.id.replace(/-MLC$/, ''));
			if (!inUse && g.id !== 'runtime') unused.push(g);
			row(`Voices: ${g.id === 'runtime' ? 'model runtime' : g.id}${inUse ? ' <span style="color:#01a982">(in use)</span>' : ''}`, g.size ? MB(g.size) : `${g.items.length} files`,
				btn('Remove', async () => { for (const [name, req] of g.items) { try { (await caches.open(name)).delete(req); } catch { /* gone already */ } } if (inUse) onModelRemoved?.(); }));
		}
		if (!models.size) row('Voices: none downloaded', 'people use the simple replies until a model is loaded (✦ › ⚙)');
		if (unused.length > 1 || (unused.length && models.size > 1)) row(`Models not in use: ${unused.length}`, MB(unused.reduce((s, g) => s + g.size, 0)), btn('Remove all', async () => { for (const g of unused) for (const [name, req] of g.items) { try { (await caches.open(name)).delete(req); } catch { /* gone already */ } } }));
		// progress and settings
		const keys = Object.keys(localStorage).filter((k) => /^crysis|^l99|^L99/.test(k));
		const bytes = keys.reduce((s, k) => s + k.length + (localStorage.getItem(k) || '').length, 0) * 2;
		row('Your progress and settings', `${keys.length} items, ${MB(bytes)} (quests, field notes, home, choices)`, btn('Clear', async () => { if (confirm('Clear your quests, field notes, home and settings?')) for (const k of keys) localStorage.removeItem(k); }));
		// the game's own files
		row('Game files (terrain, maps, textures)', 'kept by the browser and checked, not downloaded again, on later visits. To clear them: iPhone Settings › Apps › Safari › Advanced › Website Data › level99bard.com', null);
	}
	// measured on request (walking the caches takes a moment, and the panel is built at start)
	box.innerHTML = '<div style="font-weight:700;letter-spacing:.06em;margin-bottom:4px;">STORAGE ON THIS DEVICE</div>';
	row('Voices, progress and game files', 'see what is kept here and remove it by kind', btn('Check', async () => {}));
	return { refresh: draw };
}
