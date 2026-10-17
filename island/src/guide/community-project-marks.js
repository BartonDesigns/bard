import * as THREE from 'three';
import { toXZ } from '../earth/globeframe.js';
import { BLOCKS, toGrid } from '../bay/styles.js';
import { createKineticVoices } from '../music/kinetic-model.js';
import { stepResonance } from '../music/performance.js';

// These are small additions to an existing place, never terrain edits or buildings.
// The input stage is authoritative: elapsed client time cannot finish a project.
export const COMMUNITY_PROJECT_FOOTPRINTS = Object.freeze({ path: [9, 3.6], garden: [5, 4], gathering: [6, 6], resonance: [6, 6] });
const STAGES = new Set(['surveying', 'preparing', 'building', 'completed']);
const finite = Number.isFinite;
const clamp = (n, a, b) => finite(n) ? Math.max(a, Math.min(b, n)) : a;
const hash = value => { let n = 2166136261; for (const c of String(value)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
const body = W => W?.body?.key;
const stage = p => p?.stage || p?.status;

export function communityProjectAnchor(W, project) {
	const a = project?.anchor;
	if (!W || !a || project.world !== body(W) || !finite(a.y)) return null;
	if (W.globe && finite(a.lat) && finite(a.lon) && Math.abs(a.lat) <= 90 && Math.abs(a.lon) <= 180) return { ...toXZ(a.lat, a.lon), y: a.y };
	// Earth records saved in a floating frame must include their geographic anchor.
	if (W.globe && !W.globe.frame?.bay && (!finite(a.lat) || !finite(a.lon))) return null;
	return finite(a.x) && finite(a.z) ? { x: a.x, y: a.y, z: a.z } : null;
}

function segmentDistance(x, z, points) {
	let d = Infinity;
	for (let i = 0; i + 1 < (points?.length || 0); i++) {
		const a = points[i], b = points[i + 1], ax = a[0] ?? a.x, az = a[1] ?? a.z, bx = b[0] ?? b.x, bz = b[1] ?? b.z;
		if (![ax, az, bx, bz].every(finite)) continue;
		const dx = bx - ax, dz = bz - az, len = dx * dx + dz * dz;
		const t = len ? clamp(((x - ax) * dx + (z - az) * dz) / len, 0, 1) : 0;
		d = Math.min(d, Math.hypot(x - ax - dx * t, z - az - dz * t));
	}
	return d;
}

function blockedAt(W, x, z, y, boxes, roads, probe) {
	if (W.globe?.regional?.settlements?.blocked?.(x, z, .5, true) || W.globe?.roads?.onRoad?.(x, z, .5) || W.globe?.lanes?.onRoad?.(x, z, .5)) return true;
	if (boxes.some(b => finite(b.x) && finite(b.z) && Math.hypot(x - b.x, z - b.z) < Math.hypot(b.w || 0, b.d || 0) * .5 + .65)) return true;
	if (roads.some(r => segmentDistance(x, z, r.pts) < (r.w || 4) * .5 + .65)) return true;
	if ((W.real?.landAt?.(x, z)?.road || 0) > .25) return true;
	const U = W.bayArea?.urbanAt?.(x, z);
	if (U?.u > .3 && !W.real?.inside?.(x, z)) {
		const [bx, bz, width] = BLOCKS[U.s] || BLOCKS[3], [gx, gz] = toGrid(x, z, U.a, U.s);
		const lx = ((gx % bx) + bx) % bx, lz = ((gz % bz) + bz) % bz;
		if (lx < width + .65 || lz < width + .65 || lx > bx - .65 || lz > bz - .65) return true;
	}
	if ((W.vegetation?.obstacles?.(x, z, .6) || []).length) return true;
	if (W.player?.pushOut) {
		probe.set(x, y + 1.68, z); W.player.pushOut(probe);
		if (Math.hypot(probe.x - x, probe.z - z) > .04) return true;
	}
	return false;
}

// Stable, conservative placement relative to the saved site, independent of camera.
// Every lifecycle stage reserves the completed footprint. No ocean-level assumption
// is made for dry moons, whose ground can legitimately be below zero.
export function communityProjectSpot(W, project, { exact = null } = {}) {
	const anchor = communityProjectAnchor(W, project), extent = COMMUNITY_PROJECT_FOOTPRINTS[project?.kind];
	if (!anchor || !extent || !STAGES.has(stage(project))) return null;
	const I = W.island, ground = I?.drawnAt || I?.heightAt;
	if (!ground) return null;
	const angle = hash(project.siteId || project.id) / 4294967296 * Math.PI * 2;
	const yaw = angle;
	const c = Math.cos(yaw), s = Math.sin(yaw), [width, depth] = extent, nx = Math.ceil(width), nz = Math.ceil(depth), probe = new THREE.Vector3();
	const boxes = [...(W.real?.near?.('boxes', anchor.x, anchor.z, 40) || []), ...(W.village?.footprints || []), ...(W.city?.nearList?.() || [])].filter(b => finite(b.x) && finite(b.z) && Math.hypot(b.x - anchor.x, b.z - anchor.z) < 40 + Math.hypot(b.w || 0, b.d || 0) * .5);
	const roads = W.real?.near?.('roads', anchor.x, anchor.z, 40) || [];
	const candidates = exact ? [exact] : [{ x: anchor.x, z: anchor.z }, ...[7, 13, 19].flatMap(r => [0, 1, 2, 3].map(i => ({ x: anchor.x + Math.cos(angle + i * Math.PI / 2) * r, z: anchor.z + Math.sin(angle + i * Math.PI / 2) * r })))];
	for (const candidate of candidates) {
		let lo = Infinity, hi = -Infinity, clear = true;
		for (let i = 0; i <= nx && clear; i++) for (let j = 0; j <= nz; j++) {
			const u = (i / nx - .5) * width, v = (j / nz - .5) * depth, x = candidate.x + c * u + s * v, z = candidate.z - s * u + c * v;
			const y = ground.call(I, x, z), floor = W.player?.floorAt?.(x, z, y), water = I.waterAt?.(x, z) ?? W.water?.waterAt?.(x, z) ?? W.globe?.waterAt?.(x, z);
			if (!finite(y) || Math.abs(y - anchor.y) > 3 || (I.hasOcean !== false && y < .4) || (finite(water) && y < water + .25) || I.inWater?.(x, z) || (finite(floor) && Math.abs(floor - y) > .35) || blockedAt(W, x, z, y, boxes, roads, probe)) { clear = false; break; }
			lo = Math.min(lo, y); hi = Math.max(hi, y);
			if (hi - lo > .45) { clear = false; break; }
		}
		if (clear) return { x: candidate.x, y: ground.call(I, candidate.x, candidate.z), z: candidate.z, yaw, radius: Math.hypot(width, depth) * .5 };
	}
	return null;
}

export function createCommunityProjectMarks({ scene, world, camera, projects, signal, host = globalThis.window || {}, maxVisible = 8 } = {}) {
	const group = new THREE.Group(); group.name = 'Community places'; scene.add(group);
	const geometry = { box: new THREE.BoxGeometry(1, 1, 1), stone: new THREE.IcosahedronGeometry(1, 0), stem: new THREE.CylinderGeometry(1, 1, 1, 5), bloom: new THREE.OctahedronGeometry(1), ring: new THREE.TorusGeometry(1, .055, 4, 12) };
	const material = {
		wood: new THREE.MeshStandardMaterial({ color: 0x796047, roughness: .92 }), pale: new THREE.MeshStandardMaterial({ color: 0xc8b58c, roughness: .85 }),
		stone: new THREE.MeshStandardMaterial({ color: 0x657770, roughness: .92 }), soil: new THREE.MeshStandardMaterial({ color: 0x443e2c, roughness: 1 }),
		leaf: new THREE.MeshStandardMaterial({ color: 0x6a8353, roughness: .85 }), flower: new THREE.MeshStandardMaterial({ color: 0xd4a56b, roughness: .75 }),
		glass: new THREE.MeshStandardMaterial({ color: 0x90d1c2, roughness: .4, emissive: 0x3c9b82, emissiveIntensity: .35 }),
	};
	const voices = createKineticVoices(host, { maxVoices: 4 }), marks = new Map(), failed = new Map();
	const limit = Math.round(clamp(maxVisible, 1, 8));
	let dead = false, time = 0, scan = 0, priorWorld = null, priorBody = null, epoch = null, lastCamera = new THREE.Vector3(Infinity, Infinity, Infinity);
	const currentWorld = () => typeof world === 'function' ? world() : world;
	function remove(mark) { mark.root.traverse(o => { if (o.isInstancedMesh) o.dispose(); }); mark.root.removeFromParent(); }
	function reset() { for (const mark of marks.values()) remove(mark); marks.clear(); failed.clear(); group.removeFromParent(); voices.silence(); scan = 0; }
	function create(project, spot, W) {
		const root = new THREE.Group(), detail = new THREE.Group(); root.add(detail); root.position.set(spot.x, spot.y, spot.z); root.rotation.y = spot.yaw;
		root.name = `${project.kind} ${stage(project)} ${project.id}`; root.userData.communityProject = { id: project.id, stage: stage(project), kind: project.kind, world: project.world, shared: project.shared === true };
		const batches = new Map(), matrix = new THREE.Matrix4(), quat = new THREE.Quaternion(), scale = new THREE.Vector3(), pos = new THREE.Vector3(), Euler = new THREE.Euler();
		const c = Math.cos(spot.yaw), s = Math.sin(spot.yaw), I = W.island;
		const h = (x, z) => (I.drawnAt || I.heightAt).call(I, spot.x + c * x + s * z, spot.z - s * x + c * z) - spot.y;
		function add(shape, mat, x, y, z, sx, sy, sz, turn = 0, near = false) {
			const key = [shape, mat, near].join(':'); if (!batches.has(key)) batches.set(key, { shape, mat, near, matrices: [] });
			quat.setFromEuler(Euler.set(0, turn, 0)); matrix.compose(pos.set(x, h(x, z) + y, z), quat, scale.set(sx, sy, sz)); batches.get(key).matrices.push(matrix.clone());
		}
		const plank = (x, y, z, sx, sy, sz, near = false) => add('box', 'wood', x, y, z, sx, sy, sz, 0, near);
		const notice = () => { plank(-1.8, .65, 1.3, .1, 1.3, .1); add('box', 'pale', -1.8, 1.05, 1.3, .7, .35, .06); add('box', 'stone', -1.8, 1.08, 1.34, .42, .035, .015, 0, true); };
		const current = stage(project);
		if (current !== 'completed') {
			const [width, depth] = COMMUNITY_PROJECT_FOOTPRINTS[project.kind];
			for (const x of [-width / 2 + .35, width / 2 - .35]) for (const z of [-depth / 2 + .35, depth / 2 - .35]) { plank(x, .3, z, .07, .6, .07); add('box', 'pale', x + .11, .53, z, .23, .09, .035); }
			notice();
			if (current === 'preparing' || current === 'building') {
				add('box', 'wood', -.65, .3, .45, .8, .6, .6); add('box', 'pale', -.65, .31, .45, .84, .08, .64, 0, true);
				for (let i = 0; i < 3; i++) plank(.6, .1 + i * .09, .55, 1.1, .075, .17);
			}
			if (current === 'building') {
				for (const x of [-1.15, 1.15]) { plank(x, .65, -.65, .1, 1.3, .1); plank(x, .65, .65, .1, 1.3, .1); }
				plank(0, 1.25, -.65, 2.4, .1, .1); plank(0, .08, -1, 2.5, .16, .14);
			}
		} else if (project.kind === 'path') {
			for (const x of [-3.6, 3.6]) { plank(x, .65, -.95, .12, 1.3, .12); add('box', 'pale', x, 1.1, -.95, .85, .2, .08); add('stone', 'stone', x, .13, -.95, .3, .15, .3); }
			for (let i = 0; i < 9; i++) { const x = -3.6 + i * .9; add('stone', i % 3 ? 'stone' : 'pale', x, .035, .3 * Math.sin(i), .33, .055, .26, i * .7); }
		} else if (project.kind === 'garden') {
			for (const x of [-1.1, 1.1]) {
				add('box', 'soil', x, .07, 0, 1.5, .14, 2.4);
				for (const dx of [-.8, .8]) plank(x + dx, .12, 0, .1, .24, 2.55);
				for (const z of [-1.22, 1.22]) plank(x, .12, z, 1.7, .24, .1);
				for (let i = 0; i < 12; i++) { const px = x + (i % 3 - 1) * .42, pz = (Math.floor(i / 3) - 1.5) * .53, h = .3 + hash(project.id + i) % 5 * .035; add('stem', 'leaf', px, h / 2 + .15, pz, .025, h, .025, 0, true); add('stone', 'leaf', px + .045, .26, pz, .16, .07, .09); add('bloom', 'flower', px, h + .15, pz, .11, .07, .11, i, true); }
			}
		} else if (project.kind === 'gathering') {
			for (const z of [-1.6, 1.6]) {
				plank(0, .47, z, 2.4, .12, .56); plank(0, .85, z + Math.sign(z) * .3, 2.4, .35, .08);
				for (const x of [-.85, .85]) { plank(x, .23, z, .13, .46, .5); plank(x, .7, z + Math.sign(z) * .3, .1, .7, .1); }
			}
			for (const x of [-2.4, 2.4]) { plank(x, 1, 0, .1, 2, .1); add('box', 'glass', x, 1.82, 0, .22, .32, .22); add('box', 'stone', x, 2.03, 0, .36, .06, .36, 0, true); }
		}
		const stones = [];
		if (project.kind === 'resonance' && current === 'completed') for (let i = 0; i < 5; i++) {
			const a = i / 5 * Math.PI * 2, x = Math.cos(a) * 1.65, z = Math.sin(a) * 1.65, y = h(x, z) + .44;
			add('stone', 'stone', x, .13, z, .65, .18, .6);
			const mesh = new THREE.Mesh(geometry.stone, material.stone), ring = new THREE.Mesh(geometry.ring, material.glass);
			mesh.position.set(x, y, z); mesh.scale.set(.34, .55 + i * .06, .35); mesh.rotation.y = a; root.add(mesh);
			ring.position.set(x, y, z); ring.rotation.x = Math.PI / 2; ring.scale.setScalar(.43); detail.add(ring);
			stones.push({ mesh, ring, y, motion: { y: 0, v: 0 }, index: i });
		}
		for (const batch of batches.values()) { const mesh = new THREE.InstancedMesh(geometry[batch.shape], material[batch.mat], batch.matrices.length); batch.matrices.forEach((m, i) => mesh.setMatrixAt(i, m)); mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.receiveShadow = true; (batch.near ? detail : root).add(mesh); }
		group.add(root); return { root, detail, stones, project, spot, checked: time, pulse: 0, lastPlay: -Infinity };
	}
	function refresh(W) {
		const incoming = typeof projects === 'function' ? projects() : projects;
		const list = Array.isArray(incoming) ? incoming : [], seen = new Set(), candidates = [];
		for (const p of list.slice(0, 256)) {
			if (!p || typeof p.id !== 'string' || !p.id || seen.has(p.id) || !COMMUNITY_PROJECT_FOOTPRINTS[p.kind] || !STAGES.has(stage(p))) continue;
			seen.add(p.id); const anchor = communityProjectAnchor(W, p); if (!anchor) continue;
			const distance = Math.hypot(anchor.x - camera.position.x, anchor.z - camera.position.z);
			if (distance > 180 || Math.abs(anchor.y - camera.position.y) > 40) continue;
			candidates.push({ p, distance });
		}
		candidates.sort((a, b) => a.distance - b.distance || a.p.id.localeCompare(b.p.id));
		const keep = new Set(), occupied = [];
		for (const { p } of candidates.slice(0, limit * 2)) {
			if (keep.size >= limit) break;
			let mark = marks.get(p.id); const signature = JSON.stringify([p.kind, stage(p), p.anchor, p.siteId]);
			if (mark && mark.signature !== signature) { remove(mark); marks.delete(p.id); mark = null; }
			if (!mark && (failed.get(p.id)?.until || 0) > time && failed.get(p.id).signature === signature) continue;
			let spot = mark?.spot;
			if (!mark || time - mark.checked > 4) {
				// The shared anchor is the finished place, never an invitation to move
				// the structure when a streamed building or hazard obstructs it.
				spot = communityProjectSpot(W, p, { exact: communityProjectAnchor(W, p) });
				if (mark) mark.checked = time;
			}
			if (!spot) { if (mark) { remove(mark); marks.delete(p.id); } failed.set(p.id, { until: time + 8, signature }); continue; }
			if (occupied.some(other => Math.hypot(spot.x - other.x, spot.z - other.z) < spot.radius + other.radius + 1)) continue;
			if (!mark) { mark = create(p, spot, W); mark.signature = signature; marks.set(p.id, mark); failed.delete(p.id); }
			mark.project = p; mark.root.position.set(spot.x, spot.y, spot.z); mark.root.visible = true; keep.add(p.id); occupied.push(spot);
		}
		for (const [id, mark] of marks) if (!keep.has(id)) { remove(mark); marks.delete(id); }
		for (const [id, retry] of failed) if (time > retry.until + 30 || failed.size > 64) failed.delete(id);
	}
	function update(dt = 0) {
		if (dead) return;
		const W = currentWorld(); time += clamp(dt, 0, .25); scan -= clamp(dt, 0, .25);
		if (W !== priorWorld || priorBody !== body(W) || epoch !== W?.globe?.frame?.epoch) { reset(); priorWorld = W; priorBody = body(W); epoch = W?.globe?.frame?.epoch; }
		if (!W || W.orbit?.active?.()) { group.visible = false; voices.silence(); return; }
		group.visible = true; if (group.parent !== scene) scene.add(group);
		if (scan <= 0 || lastCamera.distanceTo(camera.position) > 12) { scan = 1; lastCamera.copy(camera.position); refresh(W); }
		const sound = (typeof signal === 'function' ? signal() : signal) || W.music?.performance || {};
		material.glass.emissiveIntensity = .35 + clamp(sound.mid, 0, 1) * 1.1;
		for (const mark of marks.values()) {
			const d = mark.root.position.distanceTo(camera.position); mark.root.visible = d < 180; mark.detail.visible = d < 65;
			mark.pulse = Math.max(0, mark.pulse - clamp(dt, 0, .25) * 1.8);
			for (const stone of mark.stones) {
				stepResonance(stone.motion, dt, d < 65 ? clamp(sound.held, 0, 1) * .7 : 0, d < 65 ? clamp(sound.kick, 0, 1) * .35 + mark.pulse * .045 : 0);
				stone.mesh.position.y = stone.y + stone.motion.y * .12; stone.ring.position.y = stone.mesh.position.y;
				stone.ring.scale.setScalar(.43 + mark.pulse * .06 + clamp(sound.high, 0, 1) * .025);
			}
		}
	}
	function nearest(position = camera.position, range = 4) {
		const W = currentWorld();
		if (dead || !group.visible || W !== priorWorld || priorBody !== body(W) || epoch !== W?.globe?.frame?.epoch || W?.orbit?.active?.()) return null;
		let closest = null;
		for (const mark of marks.values()) if (mark.stones.length && mark.root.visible) {
			const distance = mark.root.position.distanceTo(position);
			if (distance <= range && (!closest || distance < closest.distance)) closest = { id: mark.project.id, distance, name: mark.project.name || 'Resonance stones' };
		}
		return closest;
	}
	// Call only from an explicit tap/key gesture. This never creates/resumes AudioContext.
	function playNearest(position = camera.position, index = 0) {
		const hit = nearest(position), mark = hit && marks.get(hit.id);
		if (!mark || time - mark.lastPlay < .12) return { ok: false, reason: 'Come closer to completed resonance stones.' };
		const note = Math.round(clamp(index, 0, 4));
		if (!voices.note(note * 4 + 2, .8, { distance: hit.distance })) return { ok: false, reason: 'Start the faceplate audio, then play the stones.' };
		mark.lastPlay = time; mark.pulse = 1; mark.stones[note].motion.v += 2.2;
		return { ok: true, projectId: hit.id, note };
	}
	return { update, reset, nearest, playNearest, info: () => ({ visible: [...marks.values()].filter(m => m.root.visible && group.visible).length, maxVisible: limit, projects: [...marks.values()].map(m => ({ id: m.project.id, kind: m.project.kind, stage: stage(m.project), position: m.root.position.toArray(), shared: m.project.shared === true })), voices: voices.count }), dispose() { if (dead) return; dead = true; reset(); voices.dispose(); for (const g of Object.values(geometry)) g.dispose(); for (const m of Object.values(material)) m.dispose(); } };
}
