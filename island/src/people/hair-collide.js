// What long hair falls over: a few capsules round the neck, the shoulders, the upper back
// and chest and the upper arms, each riding its bone, grown by how far the clothes stand
// off the body there (a tee hardly at all, a puffer's collar a good way). The hair's vertex
// shader (hairkit.js) pushes any hair inside one out to its surface, so locs, braids, an
// afro or a ponytail drape over the collar and the jacket instead of cutting into them.
//
// The capsules are set out once in the body's rest frame and posed each frame with the
// same bone transforms the skinning uses, so they sit where the skinned hair does.

import * as THREE from 'three';

export const CAPSULES = 6;
// the capsules for a body P dressed in o (its style), with loft: how far the clothes stand off
export function hairCapsules(P, o, loft = 0) {
	const cut = P.cut, map = P.map, H = (n) => P.rest.heads[map[n]];
	if (!cut || map.neck01 === undefined) return [];
	const zc = (cut.frontZ + cut.backZ) / 2, hz = (cut.frontZ - cut.backZ) / 2;
	// a collar, a hood or a puffer stand further off at the neck and shoulders
	const neckLoft = loft + (o?.top?.collar || o?.outer?.collar ? 0.012 : 0) + ((o?.acc || []).some((a) => a.kind === 'hood') ? 0.035 : 0);
	const n = H('neck01'), out = [];
	const cap = (bone, a, b, r) => { if (map[bone] !== undefined) out.push({ bone: map[bone], a, b, r }); };
	cap('neck01', new THREE.Vector3(0, cut.neck - 0.03, n.z - 0.005), new THREE.Vector3(0, cut.neck + 0.05, n.z - 0.01), 0.058 + neckLoft * 0.8);
	cap('spine01', new THREE.Vector3(-cut.shoulderX * 0.95, cut.shoulder + 0.01, zc - 0.01), new THREE.Vector3(cut.shoulderX * 0.95, cut.shoulder + 0.01, zc - 0.01), 0.07 + neckLoft);
	for (const sx of [-1, 1]) cap('spine01', new THREE.Vector3(sx * 0.055, cut.chest - 0.28, zc), new THREE.Vector3(sx * 0.055, cut.shoulder - 0.02, zc), hz + 0.006 + loft);
	for (const s of ['L', 'R']) { const a = H('upperarm01.' + s), b = H('lowerarm01.' + s); if (a && b) cap('upperarm01.' + s, a.clone(), a.clone().lerp(b, 0.7), 0.05 + loft); }
	return out.slice(0, CAPSULES);
}
// pose them into the hair's uniforms (uCapA: a and the radius; uCapB: b), in the skinned
// vertices' own space: the bone's world matrix by its inverse bind, as the skinning does,
// back into the hair mesh's frame
const M = new THREE.Matrix4(), va = new THREE.Vector3(), vb = new THREE.Vector3();
export function poseCapsules(P, caps, U, mesh) {
	const sk = P.skeleton, A = U.uCapA.value, B = U.uCapB.value;
	for (let i = 0; i < CAPSULES; i++) {
		const c = caps[i];
		if (!c) { A[i].set(0, 0, 0, 0); continue; }
		M.multiplyMatrices(sk.bones[c.bone].matrixWorld, sk.boneInverses[c.bone]).premultiply(mesh.bindMatrixInverse);
		va.copy(c.a).applyMatrix4(M); vb.copy(c.b).applyMatrix4(M);
		A[i].set(va.x, va.y, va.z, c.r); B[i].copy(vb);
	}
}
