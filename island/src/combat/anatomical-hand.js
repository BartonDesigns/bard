import * as THREE from 'three';
import { handFrame } from '../crysis/held-items.js';
import { armTriangles, refineHandSurface, closeHandMaterial } from '../people/hand-surface.js';

// An independent copy of the player's finger rig. Combat never changes the avatar's
// action, weapon grip, world bones, or skin material to pose these first-person hands.
export function createAnatomicalHand(P, side) {
	const triangles = armTriangles(P, side);
	if (!triangles.length) return null;
	const geometry = refineHandSurface(P.skin.geometry, triangles, 1);
	const bones = P.bones.map(b => { const c = new THREE.Bone(); c.name = b.name; return c; });
	const holder = new THREE.Group(), joints = [];
	for (let i = 0; i < bones.length; i++) {
		const parent = P.bones.indexOf(P.bones[i].parent);
		bones[i].position.copy(P.rest.heads[i]);
		if (parent >= 0) { bones[i].position.sub(P.rest.heads[parent]); bones[parent].add(bones[i]); } else holder.add(bones[i]);
	}
	const n = P.rest.heads[P.map['finger2-1.' + side]].clone().sub(P.rest.heads[P.map['wrist.' + side]])
		.cross(P.rest.heads[P.map['finger5-1.' + side]].clone().sub(P.rest.heads[P.map['wrist.' + side]])).normalize();
	if (n.x * (side === 'R' ? -1 : 1) > 0) n.negate();
	for (let f = 1; f <= 5; f++) for (let j = 1; j <= 3; j++) {
		const i = P.map[`finger${f}-${j}.${side}`];
		if (i != null) joints.push({ i, f, j, axis: P.rest.dirs[i].clone().cross(n).normalize() });
	}
	const renderBones = bones.map(() => { const b = new THREE.Bone(); b.matrixAutoUpdate = b.matrixWorldAutoUpdate = false; return b; });
	const skeleton = new THREE.Skeleton(renderBones, P.skeleton.boneInverses.map(m => m.clone()));
	const mesh = new THREE.SkinnedMesh(geometry, closeHandMaterial(P));
	mesh.name = 'anatomical-hand-' + side; mesh.bindMode = 'detached'; mesh.bind(skeleton, new THREE.Matrix4()); mesh.frustumCulled = false;
	const target = new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 0, -1), new THREE.Vector3(side === 'R' ? -1 : 1, 0, 0), new THREE.Vector3(0, -1, 0)).setPosition(0, -.012, .022);
	const frame = new THREE.Matrix4(), x = new THREE.Matrix4(), fore = new THREE.Matrix4(), tmp = new THREE.Matrix4();
	const wrist = new THREE.Vector3(), elbow = new THREE.Vector3(), q = new THREE.Quaternion(), back = new THREE.Vector3(0, 0, 1);
	let last = '';
	function pose(mode = 'fist') {
		if (mode === last) return; last = mode;
		for (const { i, f, j, axis } of joints) {
			// Four separately curled fingers and a thumb laid outside the index finger.
			const angles = mode === 'open' ? [.18, .22, .16] : mode === 'grip' ? [.86, 1.16, .72] : [1.32, 1.65, .88];
			const angle = f === 1 ? [mode === 'open' ? .12 : 1.05, mode === 'open' ? .18 : .90, mode === 'open' ? .12 : .65][j - 1] : angles[j - 1] + (f - 3) * .025;
			bones[i].quaternion.setFromAxisAngle(axis, angle);
		}
		holder.updateMatrixWorld(true);
		if (mode === 'fist') {
			// Opposition at the thumb saddle joint brings the pad over the folded
			// index/middle fingers instead of leaving it pointing into the wrist.
			const baseI = P.map['finger1-1.' + side], tipI = P.map['finger1-3.' + side];
			if (baseI != null && tipI != null) {
				const base = new THREE.Vector3().setFromMatrixPosition(bones[baseI].matrixWorld);
				const tipLocal = (P.rest.tails[tipI] || P.rest.heads[tipI].clone().addScaledVector(P.rest.dirs[tipI], .02)).clone().sub(P.rest.heads[tipI]);
				const index = new THREE.Vector3().setFromMatrixPosition(bones[P.map['finger2-3.' + side]].matrixWorld);
				const middle = new THREE.Vector3().setFromMatrixPosition(bones[P.map['finger3-3.' + side]].matrixWorld);
				const goal = index.lerp(middle, .45).addScaledVector(n, .012), wanted = goal.distanceTo(base);
				const joint = joints.find(j => j.f === 1 && j.j === 2);
				let best = .9, error = Infinity;
				// Choose a natural MCP bend for this avatar's thumb length, then aim
				// its saddle joint at the outside of the folded fingers.
				for (let angle = .2; angle <= 1.41; angle += .1) {
					bones[joint.i].quaternion.setFromAxisAngle(joint.axis, angle); holder.updateMatrixWorld(true);
					const d = Math.abs(tipLocal.clone().applyMatrix4(bones[tipI].matrixWorld).distanceTo(base) - wanted);
					if (d < error) { error = d; best = angle; }
				}
				bones[joint.i].quaternion.setFromAxisAngle(joint.axis, best); holder.updateMatrixWorld(true);
				const tip = tipLocal.clone().applyMatrix4(bones[tipI].matrixWorld);
				bones[baseI].quaternion.premultiply(new THREE.Quaternion().setFromUnitVectors(tip.sub(base).normalize(), goal.sub(base).normalize()));
				holder.updateMatrixWorld(true);
			}
		}
		handFrame(P, side, frame, i => bones[i].matrixWorld);
		x.multiplyMatrices(target, frame.invert());
		wrist.setFromMatrixPosition(bones[P.map['wrist.' + side]].matrixWorld).applyMatrix4(x);
		elbow.setFromMatrixPosition(bones[P.map['lowerarm01.' + side]].matrixWorld).applyMatrix4(x).sub(wrist).normalize();
		q.setFromUnitVectors(elbow, back);
		fore.makeTranslation(...wrist.toArray()).multiply(tmp.makeRotationFromQuaternion(q)).multiply(tmp.makeTranslation(-wrist.x, -wrist.y, -wrist.z)).multiply(x);
		for (let i = 0; i < bones.length; i++) renderBones[i].matrixWorld.multiplyMatrices(/^(lowerarm|upperarm)/.test(bones[i].name) ? fore : x, bones[i].matrixWorld);
		skeleton.update();
	}
	pose();
	return { mesh, pose, dispose() { geometry.dispose(); mesh.material.dispose(); skeleton.dispose(); mesh.removeFromParent(); } };
}
