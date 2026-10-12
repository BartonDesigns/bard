// Things that break: crates, barrels (the red ones burst and burn), fence runs, glass panes,
// and the designated glass fronts on buildings near you (a shop's window, a bus shelter's
// panels). Each is a simple box in the combat layer and a mesh from a few shared shapes; when
// it breaks it is swapped for flying pieces (combat/fx.js) and gone. Building walls themselves
// never break. Props also give the squads something to take cover behind.

import * as THREE from 'three';
import { createHealth, applyDamage } from './health.js';

const KINDS = {
	crate: { hp: 60, h: [0.5, 0.5, 0.5], surface: 'wood', cover: true, fuel: 0.6 },
	barrel: { hp: 40, h: [0.32, 0.45, 0.32], surface: 'metal', cover: true, blast: 4, fuel: 1 },
	drum: { hp: 70, h: [0.32, 0.45, 0.32], surface: 'metal', cover: true },
	fence: { hp: 35, h: [1.5, 0.6, 0.05], surface: 'wood', cover: true, fuel: 0.5 },
	glass: { hp: 8, h: [1.5, 1.2, 0.03], surface: 'glass', cover: false },
	sandbags: { hp: 400, h: [1.2, 0.45, 0.35], surface: 'ground', cover: true },
};

let M = null;
function mats() {
	if (M) return M;
	M = {
		crate: new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.85 }),
		barrel: new THREE.MeshStandardMaterial({ color: 0xa8321e, roughness: 0.5, metalness: 0.4 }),
		drum: new THREE.MeshStandardMaterial({ color: 0x4a5a3a, roughness: 0.55, metalness: 0.35 }),
		fence: new THREE.MeshStandardMaterial({ color: 0x7d6a52, roughness: 0.9 }),
		glass: new THREE.MeshStandardMaterial({ color: 0xbfe0ea, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }),
		frame: new THREE.MeshStandardMaterial({ color: 0x2c3034, roughness: 0.5, metalness: 0.6 }),
		sandbags: new THREE.MeshStandardMaterial({ color: 0x9a8a68, roughness: 1 }),
		box: new THREE.BoxGeometry(1, 1, 1),
		cyl: new THREE.CylinderGeometry(1, 1, 1, 14),
	};
	return M;
}
function meshOf(kind) {
	const m = mats(), H = KINDS[kind].h, g = new THREE.Group();
	if (kind === 'barrel' || kind === 'drum') {
		const b = new THREE.Mesh(m.cyl, m[kind]); b.scale.set(H[0], H[1] * 2, H[2]); g.add(b);
		for (const y of [-0.28, 0.28]) { const r = new THREE.Mesh(m.cyl, m.frame); r.scale.set(H[0] * 1.03, 0.03, H[2] * 1.03); r.position.y = y; g.add(r); }
	} else if (kind === 'fence') {
		for (let i = -2; i <= 2; i++) { const p = new THREE.Mesh(m.box, m.fence); p.scale.set(0.12, 1.2, 0.06); p.position.x = i * 0.7; g.add(p); }
		for (const y of [-0.3, 0.3]) { const r = new THREE.Mesh(m.box, m.fence); r.scale.set(3, 0.1, 0.05); r.position.set(0, y, 0.05); g.add(r); }
	} else if (kind === 'glass') {
		const p = new THREE.Mesh(m.box, m.glass); p.scale.set(H[0] * 2, H[1] * 2, 0.02); p.renderOrder = 3; g.add(p);
		const f = new THREE.Mesh(m.box, m.frame); f.scale.set(H[0] * 2 + 0.08, 0.08, 0.08); f.position.y = -H[1]; g.add(f);
		const t = f.clone(); t.position.y = H[1]; g.add(t);
	} else {
		const b = new THREE.Mesh(m.box, m[kind]); b.scale.set(H[0] * 2, H[1] * 2, H[2] * 2); g.add(b);
		if (kind === 'crate') for (const s of [-1, 1]) { const e = new THREE.Mesh(m.box, m.frame); e.scale.set(H[0] * 2.02, 0.06, 0.06); e.position.set(0, s * H[1] * 0.85, H[2] + 0.005); g.add(e); }
	}
	for (const c of g.children) { c.castShadow = false; c.receiveShadow = true; }
	return g;
}

export function createProps(ctx) {
	const { layer, fx } = ctx;
	const group = new THREE.Group(); group.name = 'combat-props';
	const list = new Map();
	let n = 0;

	// a prop at (x, y, z) turned by yaw; tag groups a set (a camp, an arena) to clear together
	function add(kind, x, y, z, yaw = 0, tag = '') {
		const K = KINDS[kind];
		if (!K) return null;
		const id = `pr${n++}`, mesh = meshOf(kind);
		mesh.position.set(x, y + K.h[1], z); mesh.rotation.y = yaw;
		group.add(mesh);
		const P = { id, kind, K, mesh, tag, pos: mesh.position, yaw, H: createHealth({ max: K.hp }) };
		P.T = { id, kind: 'prop', faction: 'world', surface: K.surface, bound: { x, y: y + K.h[1], z, r: Math.hypot(...K.h) }, shapes: [{ type: 'box', c: { x, y: y + K.h[1], z }, h: K.h, yaw, part: 'body' }], onHit: (blow) => hit(P, blow), name: kind === 'glass' ? 'a glass front' : `a ${kind}` };
		layer.add(P.T);
		list.set(id, P);
		return P;
	}
	function hit(P, blow) {
		if (!list.has(P.id)) return null;
		const r = applyDamage(P.H, blow);
		if (r.killed) breakProp(P, blow);
		else if (blow.type === 'energy' || blow.type === 'fire') ctx.heat?.(P.id, P.pos.x, P.pos.z, P.K.fuel || 0, blow.amount);
		return r;
	}
	function breakProp(P, blow) {
		const p = P.pos;
		layer.remove(P.id); list.delete(P.id); group.remove(P.mesh);
		if (P.kind === 'glass') { fx.glass(p, 22, 3.5, 0.28); ctx.sound?.('glass', p); }
		else if (P.kind === 'barrel') { fx.explosion(p, 3); ctx.blast(p, P.K.blast, 70, blow?.by || null, P.T); ctx.ignite?.(P.id, p.x, p.z, 0.8); }
		else if (P.kind === 'crate' || P.kind === 'fence') { fx.debris(p, P.kind === 'fence' ? 10 : 14, 0x8a6a45, 3.5, 0.16); fx.dust(p, 4, 0.55, 0.48, 0.4, 0.6); }
		else { fx.debris(p, 8, 0x4a5a3a, 3, 0.14); fx.sparks(p, 6); }
		ctx.onBreak?.(P, blow);
	}
	// a little camp's worth of cover round (x, z): crates, drums, sandbags, a fence, a barrel or two
	function camp(x, z, tag, ground, rand = Math.random) {
		const out = [];
		for (let i = 0; i < 9; i++) {
			const a = rand() * 6.283, r = 3 + rand() * 9, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
			const kind = i < 3 ? 'crate' : i < 5 ? 'barrel' : i < 6 ? 'drum' : i < 8 ? 'sandbags' : 'fence';
			out.push(add(kind, px, ground(px, pz), pz, a + Math.PI / 2, tag));
			if (kind === 'crate' && rand() < 0.5) out.push(add('crate', px, ground(px, pz) + 1, pz, a, tag));
		}
		return out;
	}
	// glass fronts on the nearest buildings (designated panels: the only part of a wall that breaks)
	function fronts(boxes, me, ground, tag) {
		let k = 0;
		for (const b of boxes) {
			if (k >= 6 || !(b.w > 4 && b.d > 4)) continue;
			// the face toward you, at street level
			const a = b.a || 0, c = Math.cos(a), s = Math.sin(a);
			const lx = (me.x - b.x) * c - (me.z - b.z) * s, lz = (me.x - b.x) * s + (me.z - b.z) * c;
			const alongX = Math.abs(lx) / b.w > Math.abs(lz) / b.d;
			const fx2 = alongX ? Math.sign(lx) * (b.w / 2 + 0.06) : 0, fz = alongX ? 0 : Math.sign(lz) * (b.d / 2 + 0.06);
			const wx = b.x + fx2 * c + fz * s, wz = b.z - fx2 * s + fz * c;
			const yaw = -a + (alongX ? Math.PI / 2 : 0);
			add('glass', wx, ground(wx, wz) + 0.3, wz, yaw, tag);
			k++;
		}
	}
	const clearTag = (tag) => { for (const P of [...list.values()]) if (!tag || P.tag === tag) { layer.remove(P.id); group.remove(P.mesh); list.delete(P.id); } };
	// cover near (x, z) within r: { x, z, r }
	function coverNear(x, z, r) {
		let best = null, bd = r;
		for (const P of list.values()) { if (!P.K.cover) continue; const d = Math.hypot(P.pos.x - x, P.pos.z - z); if (d < bd) { bd = d; best = { x: P.pos.x, z: P.pos.z, r: Math.max(P.K.h[0], P.K.h[2]) }; } }
		return best;
	}
	// fire's neighbours: props that can burn
	const flammable = (x, z, r) => [...list.values()].filter((P) => P.K.fuel && Math.hypot(P.pos.x - x, P.pos.z - z) < r).map((P) => ({ id: P.id, x: P.pos.x, z: P.pos.z, fuel: P.K.fuel }));
	const burnOut = (id) => { const P = list.get(id); if (P) breakProp(P, null); };
	return { group, add, camp, fronts, clearTag, coverNear, flammable, burnOut, list, info: () => ({ props: list.size, kinds: [...list.values()].reduce((o, P) => ((o[P.kind] = (o[P.kind] || 0) + 1), o), {}) }) };
}
