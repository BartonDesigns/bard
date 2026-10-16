import * as THREE from 'three';
import { handFrame } from '../crysis/held-items.js';
import { contactField, fingerPoints, fingerQuats, fingerRig, limitPose, solveHand } from '../crysis/finger-pose.js';
import { armTriangles, refineHandSurface, closeHandMaterial, handRefine } from '../people/hand-surface.js';
import { qualityNow } from '../world/governor.js';

// An independent copy of the player's finger rig. Combat never changes the avatar's
// action, weapon grip, world bones, or skin material to pose these first-person hands.
export function createAnatomicalHand(P, side, { phone = false } = {}) {
	const triangles = armTriangles(P, side);
	if (!triangles.length) return null;
	// (as the weapon view's arms: the fingers alone refined on a phone, none on the lowest tiers)
	const R = handRefine(P, { phone, ratio: qualityNow().ratio });
	const geometry = refineHandSurface(P.skin.geometry, triangles, R.passes, R.only);
	const bones = P.bones.map(b => { const c = new THREE.Bone(); c.name = b.name; return c; });
	const holder = new THREE.Group();
	for (let i = 0; i < bones.length; i++) {
		const parent = P.bones.indexOf(P.bones[i].parent);
		bones[i].position.copy(P.rest.heads[i]);
		if (parent >= 0) { bones[i].position.sub(P.rest.heads[parent]); bones[parent].add(bones[i]); } else holder.add(bones[i]);
	}
	const renderBones = bones.map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = b.matrixWorldAutoUpdate = false; return b; });
	const skeleton = new THREE.Skeleton(renderBones, P.skeleton.boneInverses.map(m => m.clone()));
	const mesh = new THREE.SkinnedMesh(geometry, closeHandMaterial(P));
	mesh.name = 'anatomical-hand-' + side; mesh.bindMode = 'detached'; mesh.bind(skeleton, new THREE.Matrix4()); mesh.frustumCulled = false;
	const target = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(side === 'R' ? -1 : 1, 0, 0), new THREE.Vector3(0, -1, 0)).setPosition(0, -.012, .022);
	const frame = new THREE.Matrix4(), x = new THREE.Matrix4(), fore = new THREE.Matrix4(), tmp = new THREE.Matrix4();
	const wrist = new THREE.Vector3(), elbow = new THREE.Vector3(), q = new THREE.Quaternion(), back = new THREE.Vector3(0, 0, 1);
	// The fingers are posed by the shared solver (crysis/finger-pose.js): its axes curl every
	// joint toward the palm and its ranges keep every joint, the thumb above all, from bending
	// back. A fist folds the fingers and lays the thumb over the middle of the index and middle
	// fingers; a grip closes them on the held thing's handle, the thumb wrapped over them.
	const rig = fingerRig(P, side), quats = Array.from({ length: 15 }, () => new THREE.Quaternion()), solved = new Map();
	const OPEN = [0.25, 0.12, 0.15, 0.1, 0.02, 0.18, 0.22, 0.16, 0, 0.18, 0.22, 0.16, -0.03, 0.18, 0.24, 0.16, -0.07, 0.2, 0.26, 0.18];
	const fixed = (...params) => ({ mode: 'fixed', params });
	function fist() {
		const p = [0, 0, 0, 0, 0, 1.32, 1.6, 0.88, 0, 1.34, 1.62, 0.88, 0, 1.36, 1.64, 0.9, 0, 1.38, 1.66, 0.9];
		// the thumb's pad over the folded index and middle fingers, just in front of them
		const index = fingerPoints(rig, 1, p.slice(4, 8), rig.rest)[2], middle = fingerPoints(rig, 2, p.slice(8, 12), rig.rest)[2];
		const goal = index.lerp(middle, 0.45).addScaledVector(rig.palmN, 0.012);
		const t = solveHand(rig, null, rig.rest, [{ mode: 'reach', target: goal, natural: [0.5, 0.5, 0.5, 0.4] }, fixed(0, 0, 0, 0), fixed(0, 0, 0, 0), fixed(0, 0, 0, 0), fixed(0, 0, 0, 0)], { fit: false });
		p.splice(0, 4, ...t.params.slice(0, 4));
		return { params: limitPose(Float32Array.from(p)), frame: target };
	}
	// a handle: the held thing (a mesh or group in the same parent as the hand) or a stand-in
	// cylinder of radius r across the palm (the other hand on a two-handed bat)
	const _m = new THREE.Matrix4(), axis = new THREE.Vector3();
	function grip(item) {
		const parts = [];
		let r = 0.018;
		if (typeof item === 'number' || !item) {
			r = item || r;
			const stand = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.3, 16).rotateZ(Math.PI / 2));
			stand.position.set(0, -0.013 - r, 0); stand.updateMatrix(); parts.push([stand, stand.matrix.clone()]);
		} else {
			r = item.userData.r || r;
			item.updateMatrix();
			item.traverse((o) => { if (!o.isMesh) return; _m.copy(item.matrix); if (o !== item) { o.updateMatrix(); _m.multiply(o.matrix); } parts.push([o, _m.clone()]); });
		}
		const field = contactField(parts, new THREE.Box3(new THREE.Vector3(-0.15, -0.15, -0.15), new THREE.Vector3(0.15, 0.15, 0.15)));
		// the thumb: round the far side of the handle and over the fingers, toward the index
		axis.set(side === 'R' ? -0.012 : 0.012, -0.022 - 2 * r, -0.009);
		const out = solveHand(rig, field, target, [{ mode: 'reach', target: axis.clone(), natural: [0.6, 0.4, 0.6, 0.55], tip: 0.55, soft: 0.0005 }, { mode: 'wrap' }, { mode: 'wrap' }, { mode: 'wrap' }, { mode: 'wrap' }]);
		return { params: out.params, frame: out.frame, clearanceMm: out.clearanceMm };
	}
	let last = '';
	function pose(mode = 'fist', item = null) {
		const key = mode === 'grip' ? 'grip:' + (typeof item === 'number' ? item : item?.name || '') : mode;
		if (key === last) return; last = key;
		let P2 = solved.get(key);
		if (!P2) { P2 = mode === 'open' ? { params: limitPose(Float32Array.from(OPEN)), frame: target } : mode === 'grip' ? grip(item) : fist(); solved.set(key, P2); }
		fingerQuats(rig, P2.params, quats);
		for (let f = 0; f < 5; f++) for (let j = 0; j < 3; j++) bones[rig.chains[f][j].i].quaternion.copy(quats[f * 3 + j]);
		holder.updateMatrixWorld(true);
		info.clearanceMm = P2.clearanceMm || null;
		info.params = P2.params;
		handFrame(P, side, frame, i => bones[i].matrixWorld);
		x.multiplyMatrices(P2.frame, frame.invert());
		wrist.setFromMatrixPosition(bones[P.map['wrist.' + side]].matrixWorld).applyMatrix4(x);
		elbow.setFromMatrixPosition(bones[P.map['lowerarm01.' + side]].matrixWorld).applyMatrix4(x).sub(wrist).normalize();
		q.setFromUnitVectors(elbow, back);
		fore.makeTranslation(...wrist.toArray()).multiply(tmp.makeRotationFromQuaternion(q)).multiply(tmp.makeTranslation(-wrist.x, -wrist.y, -wrist.z)).multiply(x);
		for (let i = 0; i < bones.length; i++) renderBones[i].matrixWorld.multiplyMatrices(/^(lowerarm|upperarm)/.test(bones[i].name) ? fore : x, bones[i].matrixWorld);
		skeleton.update();
	}
	const info = { clearanceMm: null, params: null };
	pose();
	return { mesh, pose, info, rig, dispose() { geometry.dispose(); mesh.material.dispose(); skeleton.dispose(); mesh.removeFromParent(); } };
}
