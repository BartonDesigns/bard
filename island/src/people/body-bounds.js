// A body's bounds as it is posed now. Three culls a mesh by the sphere round its geometry, and a
// skinned body's geometry is its rest pose where it was bound: a walk, a fall, a bed or a car
// carries it away from that, so the bodies were left unculled, drawn and skinned (and cast into
// the sun's shadow map) wherever they were, in view or not. Instead each body keeps one sphere
// round its own bones where they are now, in the world, with room past the joints for the flesh,
// the hair and a hat; its skinned meshes (skin, clothes, the small things, hair, beard, brows)
// are culled by that, in the view and in the shadow pass alike. (And three only works out the
// skinning, the bone matrices it uploads, for a mesh that passed: an unseen body's are skipped.)
import * as THREE from 'three';

// (past the joints: the crown above the head bone, big hair or a hat, the toes beyond the ankle,
// a belly, a coat's hem; the box round the bones already spans whatever the arms and legs reach.
// Measured over every posed vertex of the people in a Mission street and a FiDi firefight, the
// furthest came within 1.5 cm of a 0.45 m pad: so more, for what was not seen)
export const BOUND_PAD = 0.6;

// the sphere round where the bones are now (world), padded; into out. A bone gone wild (NaN)
// leaves it unbounded, so the body is never culled for it
export function fitBones(bones, out, pad = BOUND_PAD) {
	let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity, wild = false;
	for (let i = 0; i < bones.length; i++) {
		const e = bones[i].matrixWorld.elements, x = e[12], y = e[13], z = e[14];
		if (x !== x || y !== y || z !== z) wild = true;
		if (x < x0) x0 = x; if (x > x1) x1 = x;
		if (y < y0) y0 = y; if (y > y1) y1 = y;
		if (z < z0) z0 = z; if (z > z1) z1 = z;
	}
	// (the pad grows with the body if something scales it)
	const k = bones.length ? bones[0].matrixWorld.getMaxScaleOnAxis() : 1;
	out.center.set((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
	out.radius = Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 2 + pad * k;
	if (wild || !Number.isFinite(out.radius + out.center.x + out.center.y + out.center.z)) { out.center.set(0, 0, 0); out.radius = Infinity; }
	return out;
}

// give a body its posed sphere, P.bound(): refitted at most once each time its matrices are
// brought up to date (the renderer does that at the start of every render, before it culls)
export function boundBody(P) {
	const sphere = new THREE.Sphere(), body = P.body, bones = P.bones, own = body.updateMatrixWorld;
	let stale = true;
	body.updateMatrixWorld = function (force) { own.call(this, force); stale = true; };
	P.bound = () => { if (stale) { fitBones(bones, sphere); stale = false; } return sphere; };
	return P;
}

// a skinned piece of the body, culled by the body's posed sphere (world space: an attached
// skinned mesh is drawn where its bones are, whatever its own matrix). Its own sphere, which
// the sort by depth and anyone else asking reads, is its rest shape's: three would otherwise
// skin every vertex on the CPU to find it, the first time it is asked
export function cullPosed(P, mesh) {
	mesh.frustumCulled = true;
	mesh.intersectsFrustum = (frustum) => frustum.intersectsSphere(P.bound());
	const g = mesh.geometry;
	if (!g.boundingSphere) g.computeBoundingSphere();
	mesh.boundingSphere = g.boundingSphere.clone();
	return mesh;
}
