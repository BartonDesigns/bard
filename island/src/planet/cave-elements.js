// Native Crysis cave interactions recovered from the legacy cave's musical objects
// and roosting wildlife. No alternate scene, renderer, audio context, or timer.
import * as THREE from 'three';
import { mulberry32, clamp } from '../noise.js';

export function createCaveElements({ plan, group, shared = {}, profile = {}, seed = 0, bodyKey, camera, floor, isPhone = false, hint, storage, onStrike } = {}) {
	const root = new THREE.Group();
	root.name = 'cave-resonance-and-roosts';
	group.add(root);
	const pickables = [], sites = [], bats = [], geometries = new Set(), materials = new Set();
	const ownGeo = g => (geometries.add(g), g), ownMat = m => (materials.add(m), m);
	const random = mulberry32((seed >>> 0) ^ 0xba715eed);
	const field = plan?.field;
	const cw = profile.caves || {};
	const color = new THREE.Color(...(cw.glow || [0.4, 0.9, 0.7]));
	const variant = cw.lava > 0.5 ? 'Basalt' : cw.ice > 0.6 ? 'Frost' : cw.crystals > 0.5 ? 'Prismatic' : 'Echo';
	// Flight identity is independent of the terrain seed: different bodies can share
	// a landscape seed and cave material. Never use the visual variant as identity.
	const identity = typeof bodyKey === 'string' && bodyKey ? ['body', bodyKey, seed >>> 0, profile.type || 'unknown'] : ['terrain', profile.type || 'unknown', seed >>> 0];
	const key = `crysis-cave-resonance-v2:${JSON.stringify(identity)}`;
	let saved = {}, saveError = '', readBlocked = false, disposed = false, clock = 0;
	try {
		if (storage === undefined) storage = globalThis.localStorage;
		const raw = storage?.getItem(key);
		if (raw) {
			const data = JSON.parse(raw);
			if (!data || data.version !== 1 || !data.sites || typeof data.sites !== 'object' || Array.isArray(data.sites)) throw Error('Unrecognized cave progress');
			saved = data.sites;
		}
	} catch { readBlocked = true; saveError = 'Existing cave progress could not be read; it has been preserved.'; }
	const save = () => {
		if (readBlocked) return false;
		try {
			if (!storage) throw Error('Storage unavailable');
			const next = { ...saved, ...Object.fromEntries(sites.map(s => [s.id, s.mask])) };
			storage.setItem(key, JSON.stringify({ version: 1, sites: next }));
			saved = next;
			saveError = ''; return true;
		} catch { saveError = 'Cave changes last for this visit only: device storage is unavailable or full.'; return false; }
	};
	const safe = (x, y, z, margin = 0.7) => !field || field.cave(x, y, z) < -margin;
	const floorAt = (x, z, y) => floor?.(x, z, y) ?? null;
	const stoneGeo = ownGeo(new THREE.CylinderGeometry(0.32, 0.46, 1, 7));
	const beadGeo = ownGeo(new THREE.IcosahedronGeometry(0.15, 0));
	const ringGeo = ownGeo(new THREE.TorusGeometry(0.39, 0.045, 4, 12));
	// Small side alcoves only: village/ruin furniture, pools and central walking routes stay clear.
	for (const [index, c] of (plan?.chambers || []).entries()) {
		if (sites.length >= (isPhone ? 3 : 5) || c.kind === 'village' || c.kind === 'ruins') continue;
		let spot = null;
		for (let attempt = 0; attempt < 12; attempt++) {
			const a = random() * Math.PI * 2, x = c.x + Math.cos(a) * c.rx * 0.48, z = c.z + Math.sin(a) * c.rz * 0.48;
			if (c.pools?.some(p => Math.hypot(p.x - x, p.z - z) < p.r + 2.2)) continue;
			const y = floorAt(x, z, c.fy + 3);
			if (!Number.isFinite(y) || !safe(x, y + 2.5, z, 1.8)) continue;
			spot = { x, y, z }; break;
		}
		if (!spot) continue;
		const id = `${index}:${Math.round(c.x)}:${Math.round(c.z)}`;
		const site = { id, name: `${variant} chorus`, ...spot, mask: Number.isInteger(saved[id]) ? saved[id] & 7 : 0, stones: [], beacons: [], light: null, flash: 0, lastStrike: -1, announced: false };
		const mat = ownMat(new THREE.MeshStandardMaterial({ color: new THREE.Color(...(cw.rock || [0.3, 0.28, 0.26])), roughness: cw.ice > 0.6 ? 0.25 : 0.8, emissive: color, emissiveIntensity: 0.1 }));
		for (let i = 0; i < 3; i++) {
			const x = spot.x + (i - 1) * 0.95, z = spot.z;
			const y = floorAt(x, z, c.fy + 3);
			if (!Number.isFinite(y) || !safe(x, y + 1.6, z, 0.5)) break;
			const h = 0.9 + i * 0.23;
			const stone = new THREE.Mesh(stoneGeo, mat);
			stone.position.set(x, y + h / 2, z); stone.scale.y = h;
			stone.userData.material175 = cw.ice > 0.6 || cw.crystals > 0.5 ? 'crystal' : 'stone';
			stone.userData.caveResonator = { siteId: id, note: i, name: site.name };
			stone.userData.onCaveStrike = hit => strike(hit);
			const ringMat = ownMat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.25 }));
			const ring = new THREE.Mesh(ringGeo, ringMat); ring.rotation.x = Math.PI / 2; ring.position.set(x, y + h + 0.06, z);
			root.add(stone, ring); site.stones.push({ stone, ring, y: ring.position.y });
		}
		if (site.stones.length !== 3) { for (const s of site.stones) { root.remove(s.stone, s.ring); } continue; }
		// Completed choruses light their alcove and mark its approach. Beads are emissive,
		// with at most one real light across ALL sites, selected by distance each frame.
		for (let j = 0; j < 9; j++) {
			const q = j / 8, x = spot.x + (c.x - spot.x) * q, z = spot.z + (c.z - spot.z) * q;
			if (c.pools?.some(p => Math.hypot(p.x - x, p.z - z) < p.r + 0.4)) continue;
			const y = floorAt(x, z, c.fy + 3);
			if (!Number.isFinite(y) || !safe(x, y + 0.25, z, 0.05)) continue;
			const bead = new THREE.Mesh(beadGeo, ownMat(new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.08 })));
			bead.position.set(x, y + 0.22, z); root.add(bead); site.beacons.push(bead);
		}
		sites.push(site); pickables.push(...site.stones.map(s => s.stone));
	}
	const light = new THREE.PointLight(color, 0, 16, 1.5); root.add(light);
	function strike(hit) {
		if (disposed || !hit?.object || !pickables.includes(hit.object)) return false;
		const data = hit.object.userData.caveResonator, site = sites.find(s => s.id === data.siteId);
		if (!site || (camera && camera.position.distanceTo(hit.object.position) > 10)) return false;
		// A held pointer can strike frequently; every note still plays in touchmusic,
		// while progress, hints and storage writes happen only on a newly tuned stone.
		site.flash = 1;
		const bit = 1 << data.note;
		if (!(site.mask & bit)) {
			site.mask |= bit;
			const persisted = save();
			hint?.(site.mask === 7 ? `${site.name} restored. Its approach now glows.${persisted ? '' : ' ' + saveError}` : `${site.name}: ${[1, 2, 4].filter(b => site.mask & b).length}/3 stones tuned. Play the other stones.`, 5000);
			onStrike?.({ siteId: site.id, complete: site.mask === 7, persistent: persisted, tuned: site.mask });
		}
		return true;
	}
	// Three instanced draws for a whole colony, with rigid wing hinges and bounded
	// orbital paths. Never generate wildlife in hot lava chambers or frozen worlds.
	const batGeo = ownGeo(new THREE.SphereGeometry(1, 5, 4));
	const wingGeo = ownGeo(new THREE.BufferGeometry());
	wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0, 0.58,0,-0.13, 0.44,0,0.24, 0,0,0, 0.44,0,0.24, 0.16,0,0.17], 3));
	wingGeo.computeVertexNormals();
	const batMat = ownMat(new THREE.MeshStandardMaterial({ color: 0x39312f, roughness: 0.95, side: THREE.DoubleSide }));
	if (!(cw.lava > 0.5) && !(cw.ice > 0.6) && profile.flora !== 'barren') for (const c of (plan?.chambers || []).slice(0, isPhone ? 2 : 4)) {
		for (let i = 0; i < (isPhone ? 3 : 5); i++) {
			const angle = random() * Math.PI * 2, radius = Math.min(c.rx, c.rz) * (0.12 + random() * 0.12);
			let roof = c.fy + 3;
			while (roof < c.fy + c.h && safe(c.x, roof + 0.3, c.z, 0.25)) roof += 0.3;
			const x = c.x + Math.cos(angle) * radius, z = c.z + Math.sin(angle) * radius;
			// A near-vault point that is still fully inside air is a stable hanging roost.
			let y = roof - 0.65;
			while (y > c.fy + 4 && !safe(x, y, z, 0.65)) y -= 0.25;
			if (y <= c.fy + 4 || !safe(x, y, z, 0.65)) continue;
			bats.push({ c, x, y, z, radius, phase: angle, cycle: random() * 24, pos: new THREE.Vector3(x, y, z) });
		}
	}
	const bodies = new THREE.InstancedMesh(batGeo, batMat, bats.length), left = new THREE.InstancedMesh(wingGeo, batMat, bats.length), right = new THREE.InstancedMesh(wingGeo, batMat, bats.length);
	for (const mesh of [bodies, left, right]) { mesh.frustumCulled = false; root.add(mesh); }
	const dummy = new THREE.Object3D(), pivot = new THREE.Object3D(), wing = new THREE.Object3D(); pivot.add(wing);
	function update(dt, t) {
		if (disposed) return;
		dt = Number.isFinite(dt) ? clamp(dt, 0, 0.1) : 0;
		clock = Number.isFinite(t) ? t : clock + dt;
		const band = clamp((shared.uBass?.value || 0) * 0.65 + (shared.uMid?.value || 0) * 0.35, 0, 1);
		let closest = null, best = Infinity;
		for (const s of sites) {
			const distance = camera ? ((camera.position.x - s.x) ** 2 + (camera.position.y - s.y - 1) ** 2 + (camera.position.z - s.z) ** 2) : 0;
			s.flash *= Math.exp(-dt * 3);
			for (const [i, o] of s.stones.entries()) {
				const tuned = !!(s.mask & (1 << i));
				o.ring.material.opacity = tuned ? 0.7 + band * 0.3 : 0.18 + s.flash * 0.6;
				o.ring.position.y = o.y + Math.sin(clock * 2 + i) * (0.012 + band * 0.07 + s.flash * 0.08);
			}
			for (const bead of s.beacons) bead.material.opacity = s.mask === 7 ? 0.75 + band * 0.25 : 0.06;
			if (distance < 64 && !s.announced && s.mask !== 7) { s.announced = true; hint?.(`${s.name}: tap each of the three banded stones to light this alcove.`, 5500); }
			if (distance > 225) s.announced = false;
			if ((s.mask === 7 || s.flash > 0.05) && distance < best) { best = distance; closest = s; }
		}
		light.intensity = closest && best < 1600 ? (closest.mask === 7 ? 3.2 : closest.flash * 2) * (1 + band * 0.15) : 0;
		if (closest) light.position.set(closest.x, closest.y + 2.2, closest.z);
		for (const [i, b] of bats.entries()) {
			const cycle = (clock + b.cycle) % 28, flying = cycle > 9;
			const envelope = flying ? Math.min(1, (cycle - 9) / 2, (28 - cycle) / 2) : 0;
			const angle = b.phase + (cycle - 9) * 0.55;
			const x = b.x + (Math.cos(angle) - Math.cos(b.phase)) * b.radius * envelope;
			const z = b.z + (Math.sin(angle) - Math.sin(b.phase)) * b.radius * envelope;
			const y = b.y - envelope * (1.2 + 0.3 * Math.sin(angle * 2));
			if (safe(x, y, z, 0.7)) b.pos.set(x, y, z); else b.pos.set(b.x, b.y, b.z);
			dummy.position.copy(b.pos); dummy.rotation.set(Math.PI * (1 - envelope), -angle, 0); dummy.scale.set(0.1, 0.18, 0.11); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
			pivot.position.copy(b.pos); pivot.rotation.set(Math.PI * (1 - envelope), -angle, 0); pivot.updateMatrixWorld();
			for (const side of [-1, 1]) {
				wing.position.set(side * 0.07, 0, 0); wing.rotation.set(0, 0, side * (flying ? Math.sin(clock * 17 + b.phase) * 0.65 : 1.3)); wing.scale.set(side, 1, 1); pivot.updateMatrixWorld(true);
				(side < 0 ? left : right).setMatrixAt(i, wing.matrixWorld);
			}
		}
		for (const mesh of [bodies, left, right]) mesh.instanceMatrix.needsUpdate = true;
	}
	function dispose() {
		if (disposed) return;
		disposed = true; group.remove(root); pickables.length = 0;
		for (const geo of geometries) geo.dispose();
		for (const mat of materials) mat.dispose();
		for (const mesh of [bodies, left, right]) mesh.dispose();
		root.clear();
	}
	update(0, 0);
	return { root, pickables, strike, update, dispose, stats: () => ({ sites: sites.length, stones: pickables.length, bats: bats.length, completed: sites.filter(s => s.mask === 7).length, saveError, disposed }) };
}
