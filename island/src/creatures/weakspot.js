// A big monster's weak point: a place on its body where a blow does more (catalog.js `weak`:
// its bones, what it is, its glow), shown as a light in the flesh there, pulsing slow while it
// lives (drawn over the body, a glow in the flesh), flaring when struck, out when it is dead. The Burnt Giant's ember heart, the hollow
// under the Hollow King's crown, the Drain King's swollen gut, the Saltmarsh Mother's throat,
// the cold light in the Fog Wight, the Cinderkin's magma vent, the gap between the Brute's helm
// and its plates, the Undertow's gills, the Moonturned's heart. The hit zones themselves are
// models.js's: it marks the bones named here as part 'vital' (health.js PARTS: 1.5x).
//
//   weakSpot(c, W) -> { update(dt, { dead, still }), flash() }; hung on the body's bones

import * as THREE from 'three';
import { GFX_PHONE } from '../world/device.js';

let GEO = null;
const geo = () => GEO || (GEO = new THREE.SphereGeometry(1, GFX_PHONE ? 8 : 12, GFX_PHONE ? 6 : 9));

export function weakSpot(c, W) {
	const marks = [];
	const san = (n) => n.replace(/[\s.[\]:/]/g, '');
	let skel = null;
	c.root.traverse((o) => { if (o.isSkinnedMesh && !skel) skel = o.skeleton; });
	for (const name of W.bones) {
		const b = skel?.bones.find((q) => q.name === san(name) || q.name === name), j = c.meta.joints?.[name];
		if (!b || !j) continue;
		// (two lights, one in the other: the core, and the glow of it in the flesh round it)
		const at = b.worldToLocal(new THREE.Vector3(...j[1]).applyMatrix4(c.root.matrixWorld)).multiplyScalar(W.along ?? 0.5);
		const s = 1 / ((b.getWorldScale(new THREE.Vector3()).x || 1));
		const core = new THREE.Mesh(geo(), new THREE.MeshBasicMaterial({ color: W.glow, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false }));
		const halo = new THREE.Mesh(geo(), new THREE.MeshBasicMaterial({ color: W.glow, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false, side: THREE.BackSide }));
		for (const m of [core, halo]) { m.position.copy(at); m.frustumCulled = false; m.castShadow = false; m.receiveShadow = false; m.renderOrder = 4; b.add(m); }
		core.scale.setScalar(W.r * s * 0.55); halo.scale.setScalar(W.r * s);
		marks.push({ core, halo, r: W.r * s });
	}
	let t = Math.random() * 7, flashT = 0;
	return {
		name: W.name,
		update(dt, { dead = false, still = false } = {}) {
			t += dt;
			flashT = Math.max(0, flashT - dt);
			const breath = 0.6 + 0.4 * Math.sin(t * 2.2) * (0.5 + 0.5 * Math.sin(t * 0.37));
			const k = dead ? 0 : (still ? 0.25 : 1) * breath + flashT * 3;
			for (const m of marks) {
				m.core.material.opacity = Math.min(1, 0.9 * k); m.halo.material.opacity = Math.min(0.6, 0.25 * k);
				m.core.scale.setScalar(m.r * (0.55 + flashT * 0.6)); m.halo.scale.setScalar(m.r * (1 + flashT * 1.2));
				m.core.visible = m.halo.visible = k > 0.01;
			}
		},
		// struck there: it flares
		flash() { flashT = 0.35; },
		dispose() { for (const m of marks) { m.core.removeFromParent(); m.halo.removeFromParent(); m.core.material.dispose(); m.halo.material.dispose(); } marks.length = 0; },
	};
}
