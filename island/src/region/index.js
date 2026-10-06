// The regional kit, run: out on the globe, the place round you takes its look, its
// buildings, its people, its sounds and its talk from one regional profile (kits.js),
// chosen from the atlas region, its culture and its climate (choose.js). This keeps that
// profile current (here.js, which the people, the sounds and the music read), finds the
// places to build round you and hands them to the settlements (settle.js): the real towns
// the kit claims from the town generator, the villages and camps of the open country, the
// farmsteads of the valleys, the landmarks real and legendary (landmarks.js). It also runs
// the region's own layers: the sea ice, the aurora, the plants, the air (ice.js, flora.js,
// air.js), the people out and about (folk.js) and the sounds (sound.js).
//
// globe.js makes it (createRegional) and calls update() every frame; globetowns.js asks
// claims(city) before growing a town; the walls are solid through island.extraPush.

import { loadAtlas, atlasReady, regionAt, citiesNear, palette, km } from '../earth/atlas.js';
import { createSettlements } from './settle.js';
import { createFolk } from './folk.js';
import { createIce } from './ice.js';
import { createFlora } from './flora.js';
import { createAir } from './air.js';
import { createRegionalSound } from './sound.js';
import { kitAt, kitPick } from './choose.js';
import { KITS } from './kits.js';
import { REAL, REAL_BUILD, loreFor, shrineOf } from './landmarks.js';
import { climateNow } from './climate.js';
import { here } from './here.js';
import { today } from '../calendar.js';
import { gridSnap } from '../earth/globelanes.js';

const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const hash2 = (a, b, k) => (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(k, 83492791)) >>> 0;
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
export const bearingWord = (dx, dz) => DIRS[Math.round(((Math.atan2(dx, -dz) / (Math.PI * 2)) * 8 + 8)) % 8];
// how often the open country has a village, by kit (per cell of about 5.5 km)
const RATE = { polar: 0.06, station: 0.004, snow: 0.3, alpine: 0.55, himalaya: 0.35, andes: 0.35, village: 0.6, farm: 0, outback: 0.06, mediterranean: 0.5, desert: 0.14, pueblo: 0.15, bazaar: 0.15, steppe: 0.4, savanna: 0.45, sahel: 0.4, jungle: 0.32, island: 0.5, eastvillage: 0.6, eastcity: 0.6, southasia: 0.75, southcity: 0.75 };
// the places the regional kit builds whole (the town generator keeps the rest)
const CLAIM_ALL = new Set(['bazaar', 'eastcity', 'southcity']);
// ...and the biggest size class each other kit builds itself (the farm country's towns are the generator's)
const CLAIM_MAX = { polar: 2, station: 2, snow: 0, alpine: 1, himalaya: 2, andes: 2, village: 0, farm: -1, outback: 0, pueblo: 0, mediterranean: 1, desert: 2, sahel: 2, savanna: 1, jungle: 2, island: 1, steppe: 1, eastvillage: 2, southasia: 2 };
// how far round a real landmark the generated places keep clear (m), by its builder
const CLEAR = { pyramid: 170, palace: 160, khmer: 170, stupamound: 90, registan: 90, potala: 200, colosseum: 110, monolith: 2000, mausoleum: 90, goldtemple: 90, roundtemple: 60, greektemple: 60, rockfacade: 60, sails: 110, greatwall: 0, torii: 30 };

export function createRegional({ scene, shared = null, island, globe, hint = () => {}, isPhone = false, F, toLL, toXZ, bayKm, bayWildKm = 180, roads = null, lanes = null }) {
	const height = globe.height;
	const ground = (x, z) => island.heightAt(x, z);
	const wet = (x, z) => { const h = height.at(x, z); return h < 0.4 || height.out.land <= 0; };
	const S = createSettlements({ scene, ground, wet, isPhone, toXZ, F, lanes });
	const ice = createIce(scene, { height, toXZ, toLL, isPhone });
	const flora = createFlora(scene, { ground, wet, blocked: (x, z, m) => S.vegetationBlocked(x, z, m) || !!roads?.onRoad(x, z, m), isPhone, toLL, shared, extra: () => S.trees() });
	const air = createAir(scene, { isPhone });
	// (the people stand on the ground as drawn, or on the ice)
	const folk = createFolk(scene, { settlements: S, ground: (x, z) => Math.max((island.drawnAt || island.heightAt)(x, z), ice.floor(x, z)), wet, onIce: (x, z) => ice.floor(x, z) > -1e8, isPhone });
	const sound = createRegionalSound();
	let callSaid = -1;
	let time = 0;
	const env = { month: 0, night: 0 };
	const told = new Set();
	let scanAt = null, scanEpoch = -1, hereT = 0, lastKit = null;

	// the atlas's view of a point, with its kit
	function kitHere(lat, lon, pop = -1, elev = 0) { const at = regionAt(lat, lon); return at ? { at, K: kitAt(at, { pop, elev }) } : null; }
	// the options a place's buildings take from its region and culture
	function optsFor(at, K) {
		const id = at.id, C = K.culture;
		const mosque = /^as\.tr/.test(id) ? 'ottoman' : /^af\.maghreb|^af\.sahara/.test(id) ? 'maghreb' : /^as\.(iran|afpak\.af)/.test(id) ? 'persian' : /^as\.(central|cn\.xinjiang)/.test(id) ? 'central' : 'arab';
		return { mosque, faith: C.faith, japan: C.key === 'japanese', blueDome: /^eu\.gr/.test(id), shrine: shrineOf(K.id, C), city: K.id === 'eastcity' };
	}
	// the centre building by the place's faith (the kit's own unless the faith says otherwise)
	function centreFor(kit, C, pop, id = '') {
		const f = C.faith, k = kit.id;
		if (k === 'bazaar' || k === 'eastcity' || k === 'southcity' || k === 'steppe' || k === 'farm' || k === 'outback') return null;
		if (f === 'mosque') return k === 'sahel' ? 'mudmosque' : pop >= 1 ? 'mosque' : 'mosque-small';
		if (f === 'mandir') return 'mandir';
		if (f === 'wat') return 'wat';
		if (f === 'gompa') return k === 'himalaya' ? 'gompa' : 'chorten';
		if (f === 'temple' && k !== 'eastvillage') return 'templehall';
		if (f === 'orthodox' && (k === 'village' || k === 'snow')) return /^as\.caucasus/.test(id) ? 'church-stone' : 'church-wood';
		return null;
	}
	function addSettlement(key, kind, lat, lon, K, at, { pop = -1, name = '', char = '', align = null } = {}) {
		const kit = K.kit, C = K.culture, centre = centreFor(kit, C, pop, at.id);
		let k2 = centre ? { ...kit, build: { ...kit.build, centre: [centre, ...kit.build.centre.slice(1)] } } : kit;
		// a research station is its modules and its huts (the Antarctic's, Ny-Ålesund, Resolute)
		if (K.id === 'polar' && /research|station/i.test(char + ' ' + name)) k2 = { ...k2, build: { ...k2.build, houses: [['station', 4], ['arctic', 1.5], ['shed', 1.5]], centre: ['hall'], props: [['fueltank', 3], ['sledge', 1], ['shed', 1]] } };
		const ex = toXZ(lat, lon), elev = ground(ex.x, ex.z), C2 = climateNow(at, env.month, elev);
		return S.add({ key, kind, lat, lon, kit: kit.id, kitObj: k2, pop, name, regionId: at.id, culture: C, palette: palette(at.id), opts: optsFor(at, K), env: { snow: C2.snow }, kitId: kit.id, align });
	}
	// the real towns the kit builds itself
	function claims(city) {
		if (!atlasReady()) return false;
		const at = regionAt(city.lat, city.lon);
		if (!at) return false;
		const K = kitAt(at, { pop: city.pop });
		if (!K) return false;
		if (CLAIM_ALL.has(K.id)) return true;
		const max = CLAIM_MAX[K.id] ?? 1;
		return city.pop <= (K.id === 'snow' && Math.abs(city.lat) > 60 ? max + 1 : max);
	}

	// ---------- finding the places round you ----------
	function scan(lat, lon) {
		const cosL = Math.max(0.05, Math.cos(lat * Math.PI / 180));
		// the real landmarks within 10 km
		for (let n = 0; n < REAL.length; n++) {
			const [name, la, lo, type, sc, rot, about, args] = REAL[n];
			if (km(lat, lon, la, lo) > (type === 'monolith' ? 30 : 12)) continue;
			const at = regionAt(la, lo), fn = REAL_BUILD[type];
			if (!fn || !at) continue;
			let site = null;
			// (the ground in the landmark's own frame: turned as settle.js turns the lot)
			const fr = (rot || 0) * Math.PI / 180 + Math.PI, fc = Math.cos(fr), fs = Math.sin(fr);
			const build = (B, L, P, r) => fn(B, sc, args, r, (x, z) => ground(site.x + x * fc + z * fs, site.z - x * fs + z * fc) - ground(site.x, site.z));
			site = S.add({ key: 'real:' + n, kind: 'real', clear: (CLEAR[type] ?? 45) * sc, lat: la, lon: lo, kit: kitAt(at, { pop: 3 }).id, pop: -1, name, tale: about, regionId: at.id, culture: kitAt(at, {}).culture, palette: palette(at.id), opts: {}, env: { snow: 0 }, lots: [{ type, build, x: 0, z: 0, rot: (rot || 0) * Math.PI / 180, w: 30, d: 30, role: 'centre' }] });
		}
		// the claimed towns: the atlas's own, within 6 km
		for (const c of citiesNear(lat, lon, 8, 12)) {
			if (!claims(c)) continue;
			const at = regionAt(c.lat, c.lon), K = kitAt(at, { pop: c.pop });
			addSettlement('town:' + c.id, 'town', c.lat, c.lon, K, at, { pop: c.pop, name: c.name, char: c.char });
		}
		// the villages of the open country
		const G = 0.05, gi = Math.floor(lat / G), gj = Math.floor(lon / (G / cosL));
		for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
			const i = gi + a, j = gj + b, r = rng(hash2(i, j, 1));
			const vl = (i + r()) * G, vn = (j + r()) * (G / cosL);
			if (km(lat, lon, vl, vn) > 6) continue;
			const p = toXZ(vl, vn);
			if (F.bay && bayKm(vl, vn) < bayWildKm) continue;
			const h = ground(p.x, p.z);
			if (h < 2 || wet(p.x, p.z)) continue;
			const e = 40, s = Math.max(Math.abs(ground(p.x + e, p.z) - ground(p.x - e, p.z)), Math.abs(ground(p.x, p.z + e) - ground(p.x, p.z - e))) / (2 * e);
			if (s > 0.18) continue;
			const KH = kitHere(vl, vn, -1, h);
			if (!KH?.at.land) continue;
			const kit = kitPick(KH.K, r());
			const dens = 0.35 + (KH.at.mix.density || 0) * 1.3;
			if (r() > (RATE[kit.id] ?? 0.3) * dens) continue;
			if (citiesNear(vl, vn, 3, 1).length) continue;
			addSettlement('vil:' + i + ':' + j, 'village', vl, vn, { ...KH.K, id: kit.id, kit }, KH.at, { pop: -1, name: '' });
		}
		// the farmsteads of the open valleys
		const FG = 0.02, fi = Math.floor(lat / FG), fj = Math.floor(lon / (FG / cosL));
		for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) {
			const i = fi + a, j = fj + b, r = rng(hash2(i, j, 2));
			if (r() > 0.4) continue;
			const vl = (i + r()) * FG, vn = (j + r()) * (FG / cosL);
			if (km(lat, lon, vl, vn) > 3.5 || (F.bay && bayKm(vl, vn) < bayWildKm)) continue;
			const p = toXZ(vl, vn), h = ground(p.x, p.z);
			if (h < 2 || wet(p.x, p.z)) continue;
			const e = 50, s = Math.max(Math.abs(ground(p.x + e, p.z) - ground(p.x - e, p.z)), Math.abs(ground(p.x, p.z + e) - ground(p.x, p.z - e))) / (2 * e);
			if (s > 0.06) continue;
			const KH = kitHere(vl, vn, -1, h);
			if (!KH?.at.land || !/^(farm|village|mediterranean|southasia|eastvillage|alpine|savanna|sahel)$/.test(KH.K.id) || (KH.at.mix.rain || 0) < 300) continue;
			const farmKit = KH.K.id === 'farm' ? KITS.farm : { ...KH.K.kit, build: { ...KH.K.kit.build, count: [1, 3], spread: 50, fields: KH.K.kit.build.fields || 'strip' } };
			// where the land was surveyed in squares, the farms string out along the section roads
			const g = KH.K.id === 'farm' ? gridSnap(vl, vn) : null;
			addSettlement('farm:' + i + ':' + j, 'farm', g ? g.lat : vl, g ? g.lon : vn, { ...KH.K, kit: farmKit, id: KH.K.id }, KH.at, { pop: -1, align: g ? { axis: g.axis } : null });
		}
		// the landmarks of the place's stories
		const LG = 0.1, li = Math.floor(lat / LG), lj = Math.floor(lon / (LG / cosL));
		for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
			const i = li + a, j = lj + b, r = rng(hash2(i, j, 3));
			if (r() > 0.45) continue;
			const cl = (i + 0.5) * LG, cn = (j + 0.5) * (LG / cosL);
			if (km(lat, lon, cl, cn) > 9 || (F.bay && bayKm(cl, cn) < bayWildKm)) continue;
			const KH = kitHere(cl, cn, -1, 0);
			if (!KH) continue;
			const kit = KH.K.kit, sea = !KH.at.land;
			let kind = sea ? (Math.abs(cl) > 60 ? 'shipwreck' : null) : kit.lore[Math.floor(r() * kit.lore.length)];
			if (kind === 'shipwreck' && Math.abs(cl) < 55) kind = 'reefwreck';
			if (!kind) continue;
			// where: a high place for a tower or a shrine, the shore or the ice for a wreck, flat ground for the rest
			const high = /watchtower|passshrine|ruin|hermitage|inuksuk|ovoo|stonecross|chapelrock|incaruin/.test(kind), shore = /shipwreck|reefwreck|lighthouse|whalers/.test(kind);
			let best = null, bs = -1e9;
			for (let k = 0; k < 14; k++) {
				const ql = (i + 0.1 + r() * 0.8) * LG, qn = (j + 0.1 + r() * 0.8) * (LG / cosL), p = toXZ(ql, qn), h = ground(p.x, p.z);
				const w = wet(p.x, p.z);
				let sc;
				if (shore) sc = kind === 'shipwreck' && Math.abs(cl) > 60 ? (h < 0 && h > -40 ? 10 - Math.abs(h + 3) * 0.2 : -1e9) : h > 1 && h < 25 && wet(p.x + 60, p.z) + wet(p.x - 60, p.z) + wet(p.x, p.z + 60) + wet(p.x, p.z - 60) ? 20 - h : -1e9;
				else if (w || h < 2) sc = -1e9;
				else { const e = 20, s = Math.max(Math.abs(ground(p.x + e, p.z) - ground(p.x - e, p.z)), Math.abs(ground(p.x, p.z + e) - ground(p.x, p.z - e))) / (2 * e); sc = s > 0.35 ? -1e9 : high ? h : -s * 100; }
				if (sc > bs) { bs = sc; best = [ql, qn]; }
			}
			if (!best || bs <= -1e8) continue;
			const L = loreFor(kind, KH.K.culture, hash2(i, j, 4), shrineOf(KH.K.id, KH.K.culture));
			const s = S.add({ key: 'lore:' + i + ':' + j, kind: 'lore', lat: best[0], lon: best[1], kit: KH.K.id, pop: -1, name: L.name, tale: L.tale, lore: kind, regionId: KH.at.id, culture: KH.K.culture, palette: palette(KH.at.id), opts: optsFor(KH.at, KH.K), env: { snow: climateNow(KH.at, env.month, 0).snow }, lots: [{ type: kind, x: 0, z: 0, rot: r() * Math.PI * 2, w: 12, d: 12, role: 'centre' }] });
			s.kitId = KH.K.id;
		}
	}

	// ---------- the profile of where you are ----------
	const coastAt = { x: Infinity, z: Infinity };
	function updateHere(lat, lon, cam) {
		const elev = ground(cam.position.x, cam.position.z);
		const KH = kitHere(lat, lon, -1, elev);
		if (!KH) { here.on = false; return; }
		const { at, K } = KH;
		const hours = (globe.world?.()?.sky?.state?.hours) ?? 13;
		here.on = true; here.lat = lat; here.lon = lon;
		here.region = at.profile; here.regionId = at.id; here.regionName = at.name; here.country = at.profile.country || '';
		here.weights = K.weights; here.culture = { ...K.culture, id: at.id };
		// the sea within about 15 km: sampled again only after moving a few km
		if (!(Math.hypot(cam.position.x - coastAt.x, cam.position.z - coastAt.z) < 3000)) {
			coastAt.x = cam.position.x; coastAt.z = cam.position.z;
			let sea = false;
			for (let k = 0; k < 16 && !sea; k++) { const a = k / 8 * Math.PI, d = k < 8 ? 6000 : 15000; sea = wet(cam.position.x + Math.sin(a) * d, cam.position.z + Math.cos(a) * d); }
			here.coast = sea;
		}
		here.climate = climateNow(at, env.month, elev, hours);
		const Wx = globe.world?.()?.weather?.state;
		here.wx = { rain: Wx?.rainHere || 0, cover: Wx?.cover ?? 0.4 };
		// the settlement you are in, or the nearest; its kit is the one you are in
		const N = S.nearest(cam.position.x, cam.position.z, ['town', 'village', 'farm']);
		here.town = N && N.d < 2500 ? { name: N.site.name || '', kind: N.site.kind, km: Math.round(N.d / 100) / 10, kit: N.site.kitId, pop: N.site.pop } : null;
		here.kit = here.town && N.d < 400 ? KITS[here.town.kit] : K.kit;
		// the nearest landmark with a story
		const L = S.nearest(cam.position.x, cam.position.z, ['lore', 'real']);
		here.landmark = L && L.d < 9000 ? { name: L.site.name, tale: L.site.tale, km: Math.round(L.d / 100) / 10, dir: bearingWord(L.site.x - cam.position.x, L.site.z - cam.position.z), real: L.site.kind === 'real' } : null;
		// the road onward: the next real town that is not this one
		const near6 = citiesNear(lat, lon, 160, 6);
		// the landmarks the nearest real town is known for (the atlas's list)
		here.known = near6[0] && near6[0].km < 40 ? { town: near6[0].name, landmarks: near6[0].landmarks || [] } : null;
		const on = near6.find((c) => c.km > 4 && c.name !== here.town?.name);
		if (on) { const p = toXZ(on.lat, on.lon); here.onward = { name: on.name, km: Math.round(on.km), dir: bearingWord(p.x - cam.position.x, p.z - cam.position.z) }; } else here.onward = null;
		// the nearest minaret (the call to prayer comes from there)
		let mb = null, md = 3000;
		for (const s of S.sites.values()) if (s.minaret) { const d = Math.hypot(s.minaret[0] - cam.position.x, s.minaret[2] - cam.position.z); if (d < md) { md = d; mb = s.minaret; } }
		here.minaret = mb;
		if (here.kit && here.kit !== lastKit) lastKit = here.kit;
	}

	// ---------- each frame ----------
	function wrapSolid() {
		const op = island.extraPush;
		if (!op?.regional) {
			const f = op ? (p, footY) => { op(p, footY); S.push(p, footY); ice.push(p, footY); } : (p, footY) => { S.push(p, footY); ice.push(p, footY); };
			f.regional = true;
			island.extraPush = f;
		}
		const of = island.extraFloor;
		if (!of?.regional) {
			const f = of ? (x, z, y) => Math.max(of(x, z, y), ice.floor(x, z)) : (x, z) => ice.floor(x, z);
			f.regional = true;
			island.extraFloor = f;
		}
	}
	function update(dt, cam, { night = 0, wind = null, out = true } = {}) {
		const d = today(), month = d.getMonth() + (d.getDate() - 1) / 30;
		if (month !== env.month) hereT = 0;
		env.month = month; env.night = night;
		const ll = toLL(cam.position.x, cam.position.z);
		const far = !F.bay || bayKm(ll.lat, ll.lon) > bayWildKm - 20;
		if (!atlasReady()) { loadAtlas().catch(() => {}); return; }
		time += dt;
		if (!far || !out) {
			here.on = false; sound.pause(); S.update(dt, cam, { night, wind, budget: 1 }); folk.update(dt, time, cam);
			ice.update(dt, cam, { month: env.month, night, lat: ll.lat, on: false }); flora.update(cam, { on: false }); air.update(dt, cam, { on: false });
			return;
		}
		wrapSolid();
		if (scanEpoch !== F.epoch || !scanAt || km(ll.lat, ll.lon, scanAt[0], scanAt[1]) > 1.2) {
			if (scanEpoch !== F.epoch) { coastAt.x = Infinity; coastAt.z = Infinity; }
			scan(ll.lat, ll.lon); scanAt = [ll.lat, ll.lon]; scanEpoch = F.epoch; hereT = 0;
		}
		hereT -= dt;
		if (hereT <= 0) { hereT = 0.5; updateHere(ll.lat, ll.lon, cam); tell(cam); }
		S.update(dt, cam, { night, wind });
		folk.update(dt, time, cam);
		ice.update(dt, cam, { month: env.month, night, cover: here.wx?.cover ?? 0.4, lat: ll.lat, on: true, epoch: F.epoch });
		flora.update(cam, { kit: here.on ? here.kit : null, climate: here.climate, culture: here.culture?.key, on: here.on, epoch: F.epoch + ':' + S.version() + ':' + S.treesVersion() + ':' + (roads?.version() || 0) });
		air.update(dt, cam, { kit: here.kit, climate: here.climate, wx: here.wx, night, on: here.on, fog: scene.fog, wind });
		const W = globe.world?.(), hours = W?.sky?.state?.hours ?? 12;
		const churchy = /church|orthodox/.test(here.culture?.faith || '') && /village|alpine|mediterranean|snow|andes|island|farm/.test(here.kit?.id || '');
		sound.update(dt, here, {
			cam, night, hours, alt: cam.position.y - ground(cam.position.x, cam.position.z), rain: here.wx?.rain || 0, wind: Math.hypot(wind?.x || 0, wind?.y || 0),
			church: churchy && here.town ? here.town.km * 1000 + 50 : null,
			onCall: () => { const d = new Date().getDate(); if (callSaid !== d) { callSaid = d; hint('The call to prayer drifts over the rooftops.', 4000); } },
		});
	}
	// coming up to a landmark with a story, or into a town: its name, a line of it
	function tell(cam) {
		for (const s of S.sites.values()) {
			if (told.has(s.key) || !s.planned) continue;
			const d = Math.hypot(s.x - cam.position.x, s.z - cam.position.z);
			if ((s.kind === 'lore' || s.kind === 'real') && d < 160) { told.add(s.key); hint(`${s.name}\n${firstSentence(s.tale)}`, 7000); }
			else if (s.kind === 'town' && d < Math.min(500, s.planned.reach)) {
				told.add(s.key);
				const R = here.region?.say, g = R?.greet?.[0], mean = meaningOf(g, R?.words);
				hint(`${s.name} · ${KITS[s.kitId]?.name || ''}${g ? `\n${g}${mean ? ` (${mean})` : ''}` : ''}`, 5000);
			}
		}
	}
	const info = () => ({ sound: sound.debug(), folk: folk.info(), ice: ice.info(), flora: flora.info(), kit: here.kit?.id, region: here.regionId, culture: here.culture?.key, climate: here.climate, town: here.town, landmark: here.landmark?.name, onward: here.onward, ...S.info() });
	function pause() { sound.pause(); }
	function dispose() { sound.dispose(); folk.dispose(); ice.dispose(); flora.dispose(); air.dispose(); S.dispose(); here.on = false; }
	return { update, claims, info, pause, dispose, settlements: S, folk, ice, flora, air, sound, here, kitHere };
}

const firstSentence = (t = '') => (t.match(/^.*?[.!?](\s|$)/)?.[0] || t).trim();
// a greeting's meaning from the atlas's glossary ('merhaba: hello')
export function meaningOf(g, words) {
	if (!g || !words?.length) return '';
	const w = g.replace(/\(.*?\)/g, '').replace(/[!?.,¡¿]/g, '').trim().toLowerCase();
	for (const e of words) { const [k, v] = e.split(':'); if (k && v && (w === k.trim().toLowerCase() || w.startsWith(k.trim().toLowerCase()))) return v.trim(); }
	return '';
}
