// Where you are, to share or to come back to. A spot is a small record: which world
// (Earth, or a planet by its seed, type and flight record), where in it to the
// centimetre, which way you face, and the building you are in (a tower's floor too).
// A link carries a spot to a friend (?at=...); homes are spots kept in this browser.

import * as THREE from 'three';
import { toWorld, toLatLon } from './bay/geo.js';
import { toLL, bayKm } from './earth/globeframe.js';
import { atlasReady, citiesNear, regionAt } from './earth/atlas.js';
import { PLACES, ZONES } from './bay/places.js';

const V = 1;
const HOMES_KEY = 'crysis-homes', LEGACY_KEY = 'crysis-home', NAME_KEY = 'crysis-name';
// public landmarks to name a spot by, beyond the map's towns and zones
const LANDMARKS = [
	['Lands End', 37.7876, -122.5050, 'San Francisco'], ['Sutro Baths', 37.7804, -122.5137, 'San Francisco'], ['Ocean Beach', 37.7594, -122.5107, 'San Francisco'],
	['Golden Gate Park', 37.7694, -122.4862, 'San Francisco'], ['Baker Beach', 37.7936, -122.4837, 'San Francisco'], ['Fort Point', 37.8106, -122.4771, 'San Francisco'],
	['Crissy Field', 37.8039, -122.4640, 'San Francisco'], ['Palace of Fine Arts', 37.8029, -122.4484, 'San Francisco'], ['Coit Tower', 37.8024, -122.4058, 'San Francisco'],
	['the Ferry Building', 37.7955, -122.3937, 'San Francisco'], ['Dolores Park', 37.7596, -122.4269, 'San Francisco'], ['Alcatraz Island', 37.8267, -122.4230, 'San Francisco Bay'],
	['Treasure Island', 37.8235, -122.3706, 'San Francisco Bay'], ['Point Bonita Lighthouse', 37.8158, -122.5297, 'the Marin Headlands'], ['Muir Woods', 37.8970, -122.5811, 'Marin County'],
];
const KIND = { house: 'House', tower: 'Tower', shop: 'Shop', hut: 'Village house', cave: 'Cave hut' };
const SHOP = { cafe: 'Café', restaurant: 'Restaurant', shop: 'Shop', office: 'Office', arcade: 'Arcade', bowling: 'Bowling alley', cinema: 'Cinema' };
const BTN = 'flex:none;touch-action:pan-y;text-align:left;padding:8px 12px;border-radius:9px;border:1px solid rgba(255,255,255,.15);background:transparent;color:#eafaf6;font:13px system-ui;min-height:36px;cursor:pointer;';
const r2 = Math.round;

// ---------- the link ----------
const b64 = (str) => { let bin = ''; for (const c of new TextEncoder().encode(str)) bin += String.fromCharCode(c); return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64 = (b) => new TextDecoder().decode(Uint8Array.from(atob(b.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

// a spot, packed small: positions in cm, angles in milliradians, the hour in tenths
export function pack(s) {
	const o = { v: V, w: s.earth ? 'e' : 'p', p: [r2(s.x * 100), r2(s.y * 100), r2(s.z * 100)], a: [r2(Math.atan2(Math.sin(s.yaw), Math.cos(s.yaw)) * 1000), r2(s.pitch * 1000)] };
	if (s.earth) o.ll = [+s.lat.toFixed(7), +s.lon.toFixed(7)];
	if (s.seed != null && !(s.earth && s.seed === 1337)) o.s = s.seed;
	if (!s.earth) { o.t = s.type; if (s.id) o.i = s.id; }
	if (s.origin) { const g = s.origin; o.o = { i: g.id, s: g.seed, t: g.type, n: g.name, a: (g.colorA || []).map((v) => +(+v).toFixed(3)), b: (g.colorB || []).map((v) => +(+v).toFixed(3)) }; }
	if (s.fly) o.f = 1;
	if (Number.isFinite(s.hours)) o.h = r2(s.hours * 10);
	if (s.bld) { const b = s.bld; o.b = { k: b.k, id: b.id, n: b.n, x: r2(b.cx), z: r2(b.cz) }; if (b.key) { o.b.key = b.key; o.b.l = b.i; } }
	if (s.by) o.by = String(s.by).slice(0, 40);
	return b64(JSON.stringify(o));
}
export function unpack(code) {
	try {
		const o = JSON.parse(unb64(String(code || '').trim()));
		const num = (v, lim) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;
		if (!o || o.v !== V || (o.w !== 'e' && o.w !== 'p') || !Array.isArray(o.p) || o.p.length !== 3 || !o.p.every((v) => num(v, 5e7))) return null;
		const a = Array.isArray(o.a) ? o.a : [0, 0];
		const s = { v: V, earth: o.w === 'e', x: o.p[0] / 100, y: o.p[1] / 100, z: o.p[2] / 100, yaw: num(a[0], 1e5) ? a[0] / 1000 : 0, pitch: num(a[1], 2000) ? a[1] / 1000 : 0, fly: !!o.f };
		if (s.earth && Array.isArray(o.ll) && num(o.ll[0], 90) && num(o.ll[1], 180)) { s.lat = o.ll[0]; s.lon = o.ll[1]; const p = toWorld(s.lat, s.lon); s.x = p.x; s.z = p.z; }
		s.seed = num(o.s, 4294967295) ? o.s >>> 0 : (s.earth ? 1337 : null);
		if (!s.earth) {
			if (s.seed == null || typeof o.t !== 'string' || !/^[A-Za-z_]{2,20}$/.test(o.t)) return null;
			s.type = o.t;
			if (o.i != null) s.id = String(o.i).slice(0, 80);
		}
		if (o.o && typeof o.o === 'object') {
			const g = o.o, col = (c) => (Array.isArray(c) && c.length === 3 && c.every((v) => num(v, 10)) ? c : [0.5, 0.5, 0.5]);
			s.origin = { id: String(g.i || s.id || 'planet').slice(0, 80), seed: num(g.s, 1e12) ? g.s : 0, type: String(g.t || s.type || 'TERRAN').slice(0, 20), name: String(g.n || 'this world').slice(0, 40), colorA: col(g.a), colorB: col(g.b) };
		}
		if (num(o.h, 240)) s.hours = o.h / 10;
		if (o.b && typeof o.b === 'object' && KIND[o.b.k]) {
			s.bld = { k: o.b.k, id: String(o.b.id || '').slice(0, 60), n: String(o.b.n || KIND[o.b.k]).slice(0, 80), cx: num(o.b.x, 5e5) ? o.b.x : s.x, cz: num(o.b.z, 5e5) ? o.b.z : s.z };
			if (typeof o.b.key === 'string' && num(o.b.l, 400)) { s.bld.key = o.b.key.slice(0, 30); s.bld.i = o.b.l | 0; }
		}
		if (typeof o.by === 'string' && o.by.trim()) s.by = o.by.trim().slice(0, 40);
		return s;
	} catch { return null; }
}

// ---------- naming a spot ----------
const PL = PLACES.map((p) => ({ name: p[0], ...toWorld(p[1], p[2]), county: p[3], hood: !!p[5], r: p[5] ? 700 : Math.max(650, 380 * Math.pow(p[4], 0.45)) }));
const ZN = ZONES.filter((z) => z[4] > 0).map((z) => ({ name: z[0], ...toWorld(z[1], z[2]), sub: z[3], r: z[4] }));
function town(x, z) {
	let best = null, bd = 15000;
	for (const p of PL) { if (p.hood) continue; const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p; } }
	return best?.name || '';
}
// Earth: the place a friend would know it by
function earthPlace(x, z, extra) {
	let best = null, bd = 700;
	for (const [name, lat, lon, area] of [...LANDMARKS, ...extra]) {
		if (typeof lat !== 'number') continue;
		const p = toWorld(lat, lon), d = Math.hypot(p.x - x, p.z - z);
		if (d < bd) { bd = d; best = { name, area: typeof area === 'string' ? area : /,/.test(name) ? '' : town(p.x, p.z) }; }
	}
	if (best) return best;
	for (const q of ZN) if (Math.hypot(q.x - x, q.z - z) < q.r) return { name: q.name, area: q.sub.split(' · ')[0] };
	let near = null, nd = 1e9;
	for (const p of PL) { const d = Math.hypot(p.x - x, p.z - z) / p.r; if (d < nd) { nd = d; near = p; } }
	if (near && nd < 1) return { name: near.name, area: near.hood ? town(near.x, near.z) : near.county };
	if (near && nd < 8) return { name: 'near ' + near.name, area: near.county };
	return { name: 'out on the land', area: 'the Bay Area' };
}
// the street a building stands on (its name only)
function streetAt(W, x, z) {
	let best = '', bd = 80;
	for (const r of W?.real?.near?.('roads', x, z, 80) || []) {
		if (!r?.name || !r.pts) continue;
		const p = r.pts;
		for (let i = 0; i + 3 < p.length; i += 2) {
			const dx = p[i + 2] - p[i], dz = p[i + 3] - p[i + 1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - p[i]) * dx + (z - p[i + 1]) * dz) / l2));
			const d = Math.hypot(x - p[i] - dx * t, z - p[i + 1] - dz * t);
			if (d < bd) { bd = d; best = r.name.split(' · ').pop(); }
		}
	}
	return best;
}

export function createShare(ctx) {
	const { camera, hint, mount, menu } = ctx;
	const W = () => ctx.world();
	let busy = false;

	// ---------- the building you are in, or at the door of ----------
	function building(pos, named = false) {
		const w = W();
		if (!w) return null;
		const eye = pos.y - 1.7;
		let b = null;
		const t = w.towers?.here?.(pos);
		if (t) b = { k: 'tower', id: 't' + t.key, key: t.key, i: t.i, cx: t.x, cz: t.z, label: t.label, lvl: t.kind };
		if (!b) {
			const h = w.houses?.inside(pos)?.h;
			if (h) b = { k: 'house', id: 'h' + r2(h.cx) + ':' + r2(h.cz), cx: h.cx, cz: h.cz, at: 'in' };
		}
		if (!b) {
			const B = w.commercial?.inside(pos);
			if (B) b = { k: 'shop', id: 's' + r2(B.b.x) + ':' + r2(B.b.z), cx: B.b.x, cz: B.b.z, type: B.type, at: 'in' };
		}
		// at the door: close by, on the same level
		if (!b && w.houses?.houses) for (const h of w.houses.houses.values()) {
			if (h && Math.hypot(pos.x - h.cx, pos.z - h.cz) < h.r && Math.abs(eye - h.floorY) < 2) { b = { k: 'house', id: 'h' + r2(h.cx) + ':' + r2(h.cz), cx: h.cx, cz: h.cz, at: 'door' }; break; }
		}
		if (!b && w.commercial?.list) for (const B of w.commercial.list()) {
			if (Math.hypot(pos.x - B.x, pos.z - B.z) < Math.max(B.hw, B.hd) + 2.5 && Math.abs(eye - B.y) < 2) { b = { k: 'shop', id: 's' + r2(B.x) + ':' + r2(B.z), cx: B.x, cz: B.z, type: B.type, at: 'door' }; break; }
		}
		// a planet's cave village, and the island's own village (on every world)
		const vil = w.underworld?.village?.();
		if (!b && vil?.houses) for (const h of vil.houses) {
			if (Math.hypot(pos.x - h.x, pos.z - h.z) < (h.info?.r || 3) + 2 && Math.abs(eye - h.y) < 3) { b = { k: 'cave', id: 'c' + r2(h.x) + ':' + r2(h.z), cx: h.x, cz: h.z }; break; }
		}
		if (!b && w.village?.footprints) for (const f of w.village.footprints) {
			if (!f.fence && f.w && Math.hypot(pos.x - f.x, pos.z - f.z) < Math.max(f.w, f.d) / 2 + 2 && Math.abs(eye - f.y) < 3) { b = { k: 'hut', id: 'v' + r2(f.x) + ':' + r2(f.z), cx: f.x, cz: f.z }; break; }
		}
		if (b && named) {
			const st = w.bayArea ? streetAt(w, b.cx, b.cz) : '';
			const on = st ? ` on ${st}` : '';
			b.n = b.k === 'tower' ? `${b.label.replace(/^(\d+) · /, 'Floor $1 · ')} · tower${on}` : b.k === 'house' ? `House${on}` : b.k === 'shop' ? `${SHOP[b.type] || 'Shop'}${on}` : b.k === 'cave' ? 'Hut in the cave village' : 'House in the village';
		}
		return b;
	}

	// ---------- a spot, from where you are ----------
	function capture() {
		const w = W();
		if (!w) return null;
		const P = w.player.state, st = ctx.state, o = ctx.origin();
		const s = { v: V, earth: !!st.earth, seed: st.seed, x: P.pos.x, y: P.pos.y, z: P.pos.z, yaw: P.yaw, pitch: P.pitch, fly: !!P.flying, hours: w.sky?.state?.hours };
		if (s.earth) Object.assign(s, toLL(P.pos.x, P.pos.z));        // (the globe's frame: the Bay's near it)
		else {
			s.type = String(st.biome || shared().type || 'TERRAN');
			if (o) { s.origin = { id: o.id, seed: o.seed, type: o.type, name: o.name, colorA: o.colorA, colorB: o.colorB }; s.id = o.id; }
		}
		const b = building(P.pos, true);
		if (b) s.bld = { k: b.k, id: b.id, n: b.n, cx: b.cx, cz: b.cz, ...(b.key ? { key: b.key, i: b.i } : {}) };
		return s;
	}
	const shared = () => ctx.shared.planet || {};
	const worldName = (s) => (s.earth ? 'Earth' : s.origin?.name && s.origin.name !== 'this world' ? s.origin.name : `World ${(s.seed >>> 0).toString(36).toUpperCase()}`);

	// what to call it: a place for a person, and the coordinates for the record
	function describe(s) {
		const w = W();
		if (s.earth) {
			const ll = s.lat != null ? s : toLatLon(s.x, s.z), far = bayKm(ll.lat, ll.lon) > 250, island = !far && w && Math.max(Math.abs(s.x), Math.abs(s.z)) < (w.island?.half || 0);
			const pl = island ? { name: 'the island', area: 'off the Golden Gate' } : far ? farPlace(ll) : earthPlace(s.x, s.z, ctx.places || []);
			const where = `${pl.name}${pl.area && !pl.name.includes(pl.area) ? ', ' + pl.area : ''}`;
			const b = s.bld, what = !b ? '' : b.k === 'tower' ? (b.i ? `in a tower (${(b.n || '').split(' · ').slice(0, 2).join(', ')})` : 'in a tower lobby') : b.k === 'shop' ? `at a ${(b.n || 'shop').split(' on ')[0].toLowerCase()}` : 'at a house';
			return { place: where, text: what ? `Meet me ${what} near ${where}` : `Meet me at ${where}`, coords: `${ll.lat.toFixed(6)}, ${ll.lon.toFixed(6)} · ${Math.round(s.y - 1.7)} m` };
		}
		const prof = shared(), typeName = s.origin?.type && !prof.name ? s.origin.type.toLowerCase() : (prof.name || String(s.type).toLowerCase() + ' world');
		let where = '';
		if (s.bld?.k === 'cave') where = 'in a hut in the cave village';
		else if (s.bld?.k === 'hut') where = 'in the village';
		else if (w && ctx.state.seed === s.seed) {
			const g = w.island.heightAt(s.x, s.z), cave = w.underworld?.floor?.(s.x, s.z, s.y - 1.7);
			where = cave != null && s.y < g - 3 ? 'down in the caves' : s.fly ? 'up in the sky' : g < 0.5 ? 'out on the water' : g < 4 ? 'on the shore' : g > 70 ? (/MAGMA/i.test(s.type) ? 'by the crater rim' : 'up on the heights') : 'in the hills';
		}
		const name = worldName(s);
		const km = (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(2) + ' km' : Math.round(v) + ' m');
		const coords = `${name} · ${typeName} · ${km(Math.abs(s.x))} ${s.x >= 0 ? 'E' : 'W'}, ${km(Math.abs(s.z))} ${s.z <= 0 ? 'N' : 'S'}, ${Math.round(s.y - 1.7)} m up`;
		return { place: `${name} (${typeName})`, text: `Meet me on ${name} (${typeName})${where ? ', ' + where : ''}`, coords };
	}

	// far from the Bay: the nearest of the atlas's towns, and its region (earth/atlas.js)
	function farPlace(ll) {
		if (!atlasReady()) return { name: `${ll.lat.toFixed(2)}, ${ll.lon.toFixed(2)}`, area: '' };
		const c = citiesNear(ll.lat, ll.lon, 120, 1)[0], R = regionAt(ll.lat, ll.lon);
		return c ? { name: c.km < 8 ? c.name : `near ${c.name}`, area: R?.name || '' } : { name: R?.name || `${ll.lat.toFixed(2)}, ${ll.lon.toFixed(2)}`, area: '' };
	}

	const base = () => { try { return new URL('../../', import.meta.url).href; } catch { return location.origin + '/'; } };
	function link(s) { return `${base()}?at=${pack(s)}`; }

	// ---------- share ----------
	async function share(opts = {}) {
		const s = capture();
		if (!s) return null;
		let by = opts.from;
		if (by == null) try { by = localStorage.getItem(NAME_KEY) || ''; } catch { by = ''; }
		if (by) s.by = by;
		const d = describe(s), url = link(s), text = `${d.text}\n${d.coords}`;
		const out = { url, text: d.text, coords: d.coords, spot: s };
		if (opts.silent) return out;
		if (navigator.share) {
			try { await navigator.share({ title: 'Level 99 Bard', text, url }); return out; } catch (e) { if (e?.name === 'AbortError') return out; }
		}
		let copied = false;
		try { await navigator.clipboard.writeText(`${text}\n${url}`); copied = true; } catch { /* no clipboard here */ }
		if (copied) hint(`Link copied: send it to a friend.\n${d.text}`, 5000, 2);
		else showLink(url, d);
		return out;
	}
	// no share sheet, no clipboard: the link to copy by hand
	let box = null;
	function showLink(url, d) {
		box?.remove();
		box = document.createElement('div');
		box.style.cssText = 'position:absolute;left:50%;top:30%;transform:translateX(-50%);width:min(420px,86vw);padding:14px;border-radius:14px;background:rgba(8,20,26,.92);border:1px solid rgba(255,255,255,.2);color:#eafaf6;font:13px system-ui;z-index:12;display:flex;flex-direction:column;gap:8px;';
		const t = document.createElement('div'); t.textContent = `${d.text}\n${d.coords}`; t.style.whiteSpace = 'pre-line';
		const inp = document.createElement('input'); inp.readOnly = true; inp.value = url;
		inp.style.cssText = 'width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:rgba(0,0,0,.35);color:#eafaf6;font:12px ui-monospace,monospace;';
		const ok = document.createElement('button'); ok.type = 'button'; ok.textContent = 'Done'; ok.style.cssText = BTN + 'text-align:center;';
		ok.onclick = (e) => { e.stopPropagation(); box.remove(); box = null; };
		box.append(t, inp, ok);
		for (const ev of ['pointerdown', 'touchstart', 'keydown']) box.addEventListener(ev, (e) => e.stopPropagation());
		mount.appendChild(box);
		inp.focus(); inp.select();
	}

	// ---------- going to a spot (across worlds if need be) ----------
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	async function until(fn, ms) { const t0 = performance.now(); while (performance.now() - t0 < ms) { try { if (fn()) return true; } catch { /* not ready */ } await sleep(200); } return false; }
	async function go(s, { msg = '', time = false } = {}) {
		if (busy || !s) return false;
		busy = true;
		try {
			const st = ctx.state;
			let w = W();
			const same = w && (s.earth ? st.earth === true && st.seed === s.seed : st.earth === false && st.seed === s.seed && String(st.biome) === String(s.type));
			if (!same || !ctx.visible()) await ctx.enter(s.earth ? { seed: s.seed, earth: true } : { seed: s.seed, biome: s.type, earth: false, origin: s.origin || null });
			w = W();
			if (!w) return false;
			// the globe: a place far off moves the frame there first (earth/globe.js)
			if (s.earth && s.lat != null && w.globe) { const p = w.globe.place(s.lat, s.lon); s.x = p.x; s.z = p.z; await p.ready; }
			ctx.beforeMove?.();
			if (w.boat?.boarded?.()) w.boat.leave();
			const P = w.player.state;
			const put = (y, fly) => { P.pos.set(s.x, y, s.z); P.vel.set(0, 0, 0); P.yaw = s.yaw; P.pitch = s.pitch; P.flying = fly; P.diving = false; P.boost = false; camera.position.copy(P.pos); };
			const yOf = () => (s.y != null ? s.y : w.island.heightAt(s.x, s.z) + (s.agl || 60));
			if (w.bayArea) {
				// Earth: hover there while the land, the streets and the building come in
				hint('Finding the spot…', 60000, 2);
				put(yOf(), true);
				await until(() => w.bayArea.loaded() && w.bridge && w.real?.loaded(), 180000);
				const b = s.bld;
				if (b?.k === 'tower' && b.key) {
					// a tower is found from the street, then the floor is built
					put(w.island.heightAt(s.x, s.z) + 2, true);
					if (await until(() => w.towers?.key() === b.key, 90000)) w.towers.raise(b.i);
				} else {
					put(yOf(), true);
					const at = new THREE.Vector3(s.x, yOf(), s.z);
					if (b?.k === 'house') await until(() => w.houses?.inside(at) || [...(w.houses?.houses?.values() || [])].some((h) => h && Math.hypot(h.cx - b.cx, h.cz - b.cz) < 2), 60000);
					else if (b?.k === 'shop') await until(() => w.commercial?.inside(at), 60000);
				}
				await sleep(250);
			} else if (s.bld?.k === 'cave' && w.underworld) {
				// the cave village is made as you come near it
				put(yOf(), false);
				w.underworld.settle?.();
				await until(() => w.underworld.village?.() && w.underworld.inside?.(), 30000);
			}
			if (W() !== w) return false;
			put(yOf(), !!s.fly);
			// the tower's floor, if it went while you were being put there
			const tb = s.bld?.k === 'tower' && s.bld.key ? s.bld : null;
			if (tb && w.towers?.key() === tb.key && w.towers.here(P.pos)?.i !== tb.i) { w.towers.raise(tb.i); put(yOf(), !!s.fly); }
			// and keep it there while the tower settles in around you
			keep = tb ? { key: tb.key, i: tb.i, y: yOf(), t: 20 } : null;
			w.underworld?.settle?.();
			if (time && Number.isFinite(s.hours) && w.sky?.state) w.sky.state.hours = s.hours;
			const d = describe(s);
			hint(msg && !msg.includes(d.place) ? `${msg}\n${d.place}` : msg || d.place, 6000, 2);
			return true;
		} finally { busy = false; }
	}
	async function openAt(code, opts = {}) {
		const s = unpack(code);
		// a reload starts fresh, not back at the link
		try { const u = new URL(location.href); if (u.searchParams.has('at')) { u.searchParams.delete('at'); history.replaceState(history.state, '', u.pathname + u.search + u.hash); } } catch { /* keep the address */ }
		if (!s) {
			await ctx.enter({ seed: 1337, earth: true });
			hint('That link has no place in it, so here is the island.', 4000, 2);
			return false;
		}
		if (opts.resume) return go(s, { msg: 'Back where you left off.', time: true });
		return go(s, { msg: s.by ? `You're where ${s.by} was.` : 'You\'re where your friend was.', time: true });
	}

	// ---------- carrying on: where you are is kept every few seconds (and as the page
	// goes away), so after a crash or a reload the visualizer opens right back here ----------
	const RESUME_KEY = 'crysis-resume';
	let keptT = 0, arrived = null;
	function keepPlace(force) {
		if (busy || (!force && performance.now() - keptT < 4000)) return;
		keptT = performance.now();
		const s = capture();
		if (!s || !Number.isFinite(s.x)) return;
		// a fresh arrival (a world just built, a spawn) is not a place you chose: keep the
		// last one until you have moved off from where you came in
		const key = s.earth + ':' + s.seed;
		if (!arrived || arrived.key !== key) arrived = { key, x: s.x, z: s.z, moved: false };
		if (!arrived.moved && Math.hypot(s.x - arrived.x, s.z - arrived.z) < 3) return;
		arrived.moved = true;
		delete s.by;
		try { localStorage.setItem(RESUME_KEY, pack(s)); } catch { /* storage off */ }
	}
	addEventListener('pagehide', () => keepPlace(true));
	document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') keepPlace(true); });
	// (not straight after the graphics were lost there: start somewhere safe instead of looping)
	const resumeCode = () => { try { return Date.now() - (+localStorage.getItem('l99-gl-lost') || 0) < 15 * 60000 ? null : localStorage.getItem(RESUME_KEY); } catch { return null; } };

	// ---------- homes ----------
	function homes() {
		let L = [];
		try { L = JSON.parse(localStorage.getItem(HOMES_KEY) || '[]'); } catch { L = []; }
		if (!Array.isArray(L)) L = [];
		L = L.filter((h) => h && h.s && typeof h.name === 'string');
		// the console's Crysis.setHome(lat, lon): a home seen from the air above it
		try {
			const h = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
			if (h && Number.isFinite(h.lat) && Number.isFinite(h.lon) && !L.some((q) => q.id === 'legacy')) {
				const p = toWorld(h.lat, h.lon);
				L.push({ id: 'legacy', name: String(h.name || 'Home'), s: { v: V, earth: true, seed: 1337, lat: h.lat, lon: h.lon, x: p.x - 40, z: p.z + 40, y: null, agl: 60, yaw: Math.atan2(-40, 40), pitch: -0.5, fly: true } });
			}
		} catch { /* nothing stored */ }
		return L;
	}
	function store(L) {
		try { localStorage.setItem(HOMES_KEY, JSON.stringify(L.filter((h) => h.id !== 'legacy'))); return true; } catch { hint('This browser would not keep it (storage is off).', 3500, 2); return false; }
	}
	function addHome(name) {
		const s = capture();
		if (!s) return null;
		const d = describe(s);
		const h = { id: 'h' + Date.now().toString(36), name: String(name || s.bld?.n || d.place).slice(0, 60), s, at: Date.now() };
		const L = homes();
		L.push(h);
		if (!store(L)) return null;
		hint(`Home saved: ${h.name}\nFind it any time under ⊙ Homes.`, 4000, 2);
		refresh(); markers.dirty = true;
		return h;
	}
	function renameHome(id, name) {
		const L = homes(), h = L.find((q) => q.id === id);
		if (!h || !String(name).trim()) return false;
		h.name = String(name).trim().slice(0, 60);
		if (id === 'legacy') { try { localStorage.setItem(LEGACY_KEY, JSON.stringify({ lat: h.s.lat, lon: h.s.lon, name: h.name })); } catch { /* storage off */ } } else store(L);
		refresh(); markers.dirty = true;
		return true;
	}
	function removeHome(id) {
		if (id === 'legacy') { try { localStorage.removeItem(LEGACY_KEY); } catch { /* storage off */ } } else store(homes().filter((q) => q.id !== id));
		refresh(); markers.dirty = true;
		return true;
	}
	function goHome(which = 0) {
		const L = homes(), h = typeof which === 'number' ? L[which] : L.find((q) => q.id === which || q.name === which);
		if (!h) return Promise.resolve(false);
		ctx.closeMenu?.();
		return go(h.s, { msg: `Home: ${h.name}` });
	}
	const sameWorld = (s) => { const st = ctx.state; return s.earth ? st.earth === true : st.earth === false && st.seed === s.seed && String(st.biome) === String(s.type); };

	// ---------- the menu: share, and the homes ----------
	const sec = document.createElement('div');
	sec.style.cssText = 'display:flex;flex-direction:column;gap:4px;flex:none;min-width:230px;';
	menu.prepend(sec);
	const mk = (label, title, fn, extra = '') => {
		const b = document.createElement('button');
		b.type = 'button'; b.textContent = label; b.title = title; b.setAttribute('aria-label', title);
		b.style.cssText = BTN + extra;
		b.onclick = (e) => { e.stopPropagation(); b.blur(); fn(); };
		return b;
	};
	function refresh() {
		sec.replaceChildren();
		sec.appendChild(mk('📍 Share my location', 'Send a friend a link to exactly where you are', () => { ctx.closeMenu?.(); share(); }, 'border-color:rgba(1,169,130,.6);'));
		const L = homes();
		if (L.length) {
			const head = document.createElement('div');
			head.textContent = 'HOMES';
			head.style.cssText = 'font:700 11px system-ui;letter-spacing:.08em;opacity:.6;padding:6px 4px 0;';
			sec.appendChild(head);
		}
		for (const h of L) {
			const row = document.createElement('div');
			row.style.cssText = 'display:flex;gap:4px;align-items:stretch;flex:none;';
			const badge = h.s.earth ? '🌍' : '🪐';
			const go1 = mk(`${badge} ${h.name}`, `Go to ${h.name} (${worldName(h.s)})`, () => goHome(h.id), 'flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;');
			if (!h.s.earth) { const w = document.createElement('span'); w.textContent = ` · ${worldName(h.s)}`; w.style.opacity = '.6'; go1.appendChild(w); }
			const ren = mk('✎', `Rename ${h.name}`, () => {
				const inp = document.createElement('input');
				inp.value = h.name; inp.maxLength = 60;
				inp.style.cssText = 'flex:1;min-width:0;padding:6px 8px;border-radius:9px;border:1px solid rgba(1,169,130,.7);background:rgba(0,0,0,.35);color:#eafaf6;font:13px system-ui;';
				const done = () => { if (inp.isConnected) { if (!renameHome(h.id, inp.value)) refresh(); } };
				inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') done(); if (e.key === 'Escape') refresh(); });
				inp.addEventListener('blur', done);
				row.replaceChild(inp, go1);
				inp.focus(); inp.select();
			}, 'padding:8px 10px;');
			const del = mk('✕', `Remove ${h.name}`, () => {
				if (del.dataset.sure) removeHome(h.id);
				else { del.dataset.sure = '1'; del.textContent = 'Remove?'; setTimeout(() => { if (del.isConnected) { del.textContent = '✕'; delete del.dataset.sure; } }, 3000); }
			}, 'padding:8px 10px;');
			row.append(go1, ren, del);
			sec.appendChild(row);
		}
		const hr = document.createElement('div');
		hr.style.cssText = 'height:1px;background:rgba(255,255,255,.15);margin:4px 2px;flex:none;';
		sec.appendChild(hr);
	}
	refresh();

	// ---------- "Make this my home", in and at buildings ----------
	const homeBtn = document.createElement('button');
	homeBtn.type = 'button';
	homeBtn.dataset.hud = 'left 10';
	homeBtn.style.cssText = 'position:absolute;min-height:44px;padding:6px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.22);background:rgba(8,20,26,.5);color:#eafaf6;font:600 12px system-ui;backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);touch-action:manipulation;cursor:pointer;display:none;opacity:.9;';
	for (const ev of ['pointerdown', 'touchstart', 'keydown']) homeBtn.addEventListener(ev, (e) => e.stopPropagation());
	mount.appendChild(homeBtn);
	let here = null, mine = null, watchT = 0, keep = null;
	homeBtn.addEventListener('click', (e) => {
		e.stopPropagation(); homeBtn.blur();
		if (mine) { ctx.openMenu?.(); return; }
		addHome();
	});

	// ---------- a small warm tag over each home nearby ----------
	const markers = { list: [], dirty: true, key: '' };
	function tag(name) {
		const c = document.createElement('canvas'), g = c.getContext('2d');
		c.width = 256; c.height = 64;
		g.font = '600 26px system-ui';
		const w = Math.min(236, g.measureText(name).width + 52);
		g.fillStyle = 'rgba(8,20,26,.62)';
		g.beginPath(); g.roundRect?.((256 - w) / 2, 8, w, 46, 23); g.fill();
		const grd = g.createRadialGradient((256 - w) / 2 + 24, 31, 0, (256 - w) / 2 + 24, 31, 14);
		grd.addColorStop(0, 'rgba(255,214,140,1)'); grd.addColorStop(1, 'rgba(255,160,60,0)');
		g.fillStyle = grd; g.fillRect((256 - w) / 2 + 8, 15, 32, 32);
		g.fillStyle = '#ffe9c4'; g.textBaseline = 'middle';
		g.fillText(name.length > 16 ? name.slice(0, 15) + '…' : name, (256 - w) / 2 + 42, 32);
		const tex = new THREE.CanvasTexture(c);
		tex.colorSpace = THREE.SRGBColorSpace;
		const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false, fog: false, toneMapped: false }));
		sp.scale.set(0.16, 0.04, 1);
		sp.renderOrder = 8;
		return sp;
	}
	function syncMarkers() {
		const w = W(), key = w ? `${ctx.state.seed}:${ctx.state.earth}:${ctx.state.biome}` : '';
		if (!markers.dirty && key === markers.key && markers.list.every((m) => m.sp.parent)) return;
		markers.dirty = false; markers.key = key;
		for (const m of markers.list) { m.sp.parent?.remove(m.sp); m.sp.material.map.dispose(); m.sp.material.dispose(); }
		markers.list = [];
		if (!w) return;
		for (const h of homes()) {
			if (!h.s.bld || !sameWorld(h.s) || h.s.bld.k === 'tower') continue;
			const sp = tag(h.name);
			sp.visible = false;
			ctx.scene.add(sp);
			markers.list.push({ sp, h, x: h.s.bld.cx, z: h.s.bld.cz, y: h.s.y - 1.7 + (h.s.bld.k === 'house' ? 8.5 : h.s.bld.k === 'shop' ? 7 : 4.5) });
		}
	}

	function update(dt) {
		watchT += dt;
		if (watchT < 0.3) return;
		watchT = 0;
		const w = W(), P = w?.player.state;
		if (keep && P && (keep.t -= 0.3) > 0 && Math.abs(P.pos.y - keep.y) < 1.5) {
			if (w.towers?.key() === keep.key && w.towers.here(P.pos)?.i !== keep.i) w.towers.raise(keep.i);
		} else keep = null;
		syncMarkers();
		for (const m of markers.list) {
			const d = Math.hypot(camera.position.x - m.x, camera.position.z - m.z);
			m.sp.visible = d > 6 && d < 350 && camera.position.y - m.y < 300;
			if (m.sp.visible) { m.sp.position.set(m.x, m.y, m.z); m.sp.material.opacity = Math.min(1, (350 - d) / 120); }
		}
		here = P && !P.flying && !busy ? building(P.pos) : null;
		mine = here ? homes().find((h) => h.s.bld?.id === here.id && sameWorld(h.s)) : null;
		const show = here ? '' : 'none';
		if (homeBtn.style.display !== show) homeBtn.style.display = show;
		if (here) {
			const t = mine ? `🏠 ${mine.name}` : '🏠 Make this my home';
			if (homeBtn.textContent !== t) { homeBtn.textContent = t; homeBtn.title = mine ? 'Your home: rename or remove it under ⊙ Homes' : 'Save this building as a home you can come back to'; homeBtn.setAttribute('aria-label', homeBtn.title); }
		}
	}

	return {
		update, refresh, share, openAt, go, capture, keep: keepPlace, resumeCode, describe, link, pack, unpack, building,
		homes, addHome, renameHome, removeHome, goHome,
		busy: () => busy,
		setName: (n) => { try { localStorage.setItem(NAME_KEY, String(n || '').slice(0, 40)); } catch { /* storage off */ } return n; },
	};
}
