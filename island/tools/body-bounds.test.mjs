import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { fitBones, boundBody, cullPosed, BOUND_PAD } from '../src/people/body-bounds.js';

// a stand-in body, 1.75 m: the joints where a MakeHuman rig puts them (rest, body space), and
// points on its surface each carried by a bone (the crown and a big hat over the head, the toes
// past the ankle, a belly, the fingertips past the last knuckle, a coat's hem)
const JOINTS = {
	root: [null, 0, 0.95, 0], spine: ['root', 0, 1.2, 0], neck: ['spine', 0, 1.5, 0], head: ['neck', 0, 1.6, 0],
	shoulderL: ['spine', 0.2, 1.45, 0], elbowL: ['shoulderL', 0.48, 1.45, 0], wristL: ['elbowL', 0.74, 1.45, 0], fingerL: ['wristL', 0.88, 1.45, 0],
	shoulderR: ['spine', -0.2, 1.45, 0], elbowR: ['shoulderR', -0.48, 1.45, 0], wristR: ['elbowR', -0.74, 1.45, 0], fingerR: ['wristR', -0.88, 1.45, 0],
	hipL: ['root', 0.1, 0.9, 0], kneeL: ['hipL', 0.1, 0.5, 0], ankleL: ['kneeL', 0.1, 0.08, 0],
	hipR: ['root', -0.1, 0.9, 0], kneeR: ['hipR', -0.1, 0.5, 0], ankleR: ['kneeR', -0.1, 0.08, 0],
};
const SURFACE = [
	['head', 0, 1.6 + 0.3, 0], ['head', 0.14, 1.75, 0], ['head', 0, 1.7, 0.16], ['spine', 0, 1.15, 0.24], ['spine', 0, 1.15, -0.18],
	['fingerL', 0.95, 1.45, 0], ['fingerR', -0.95, 1.45, 0], ['ankleL', 0.1, 0, 0.22], ['ankleR', -0.1, 0, 0.22], ['ankleL', 0.1, 0, -0.08],
	['kneeL', 0.3, 0.4, 0.1], ['kneeR', -0.3, 0.4, -0.1], ['shoulderL', 0.3, 1.5, 0.1], ['root', 0, 0.95, -0.2],
];

function makeBody() {
	const root = new THREE.Group(), body = new THREE.Group(), bones = {}, list = [];
	root.add(body);
	for (const [name, [parent, x, y, z]] of Object.entries(JOINTS)) {
		const b = new THREE.Bone(); b.name = name;
		const at = new THREE.Vector3(x, y, z);
		if (parent) { const p = JOINTS[parent]; at.sub(new THREE.Vector3(p[1], p[2], p[3])); bones[parent].add(b); } else body.add(b);
		b.position.copy(at); bones[name] = b; list.push(b);
	}
	root.updateMatrixWorld(true);
	// each surface point in its bone's own space
	const pts = SURFACE.map(([bone, x, y, z]) => ({ bone: bones[bone], local: new THREE.Vector3(x, y, z).applyMatrix4(bones[bone].matrixWorld.clone().invert()) }));
	const P = { root, body, bones: list };
	return { P, bones, pts, surface: () => pts.map((q) => q.local.clone().applyMatrix4(q.bone.matrixWorld)) };
}

// the poses the bodies take: standing, arms up, reaching, sitting, lying in bed, climbing, and
// a ragdoll's tangle (every joint turned anyhow)
const POSES = {
	stand() {},
	armsUp(b) { b.shoulderL.rotation.z = 1.5; b.shoulderR.rotation.z = -1.5; },
	reach(b) { b.shoulderR.rotation.z = -1.4; b.elbowR.rotation.z = -0.2; b.spine.rotation.z = 0.25; },
	sit(b) { b.hipL.rotation.x = -1.5; b.hipR.rotation.x = -1.5; b.kneeL.rotation.x = 1.5; b.kneeR.rotation.x = 1.5; b.root.position.y -= 0.45; },
	lie(b, P) { P.root.rotation.x = -Math.PI / 2; P.root.position.set(0, 0.55, 0.95); },
	lieCurled(b, P) { P.root.rotation.z = Math.PI / 2; P.root.position.set(0.95, 0.5, 0); b.hipL.rotation.x = -1.2; b.hipR.rotation.x = -0.9; b.kneeL.rotation.x = 1.8; b.shoulderL.rotation.y = 1.2; },
	climb(b) { b.shoulderL.rotation.z = 1.3; b.shoulderR.rotation.z = -0.9; b.hipL.rotation.x = -1.2; b.kneeL.rotation.x = 1.6; },
	ragdoll(b, P, r) { for (const bone of P.bones) bone.rotation.set((r() - 0.5) * 3, (r() - 0.5) * 3, (r() - 0.5) * 3); P.root.position.set(2, 0.3, -1); },
};
const rnd = (s) => () => ((s = Math.imul(s ^ (s >>> 15), 2246822507) + 0x6d2b79f5 >>> 0) / 4294967296);

test('the posed sphere holds every part of the body in every pose, wherever it is', () => {
	for (const [name, pose] of Object.entries(POSES)) for (let k = 0; k < 6; k++) {
		const r = rnd(k * 977 + name.length), B = makeBody();
		pose(B.bones, B.P, r);
		// carried somewhere: across town, turned, up a building or in a car
		const carrier = new THREE.Group(); carrier.position.set((r() - 0.5) * 400, r() * 30, (r() - 0.5) * 400); carrier.rotation.y = r() * 6.3; carrier.add(B.P.root);
		carrier.updateMatrixWorld(true);
		const s = fitBones(B.P.bones, new THREE.Sphere());
		for (const p of B.surface()) assert.ok(s.distanceToPoint(p) <= 1e-9, `${name}: a point ${(s.center.distanceTo(p) - s.radius).toFixed(3)} m outside`);
		// (and not so big that it culls nothing: about a body's reach, never a room)
		assert.ok(s.radius > 1 && s.radius < 1.25 + BOUND_PAD + 0.2, `${name}: radius ${s.radius.toFixed(2)}`);
	}
});

const frustumOf = (cam) => { cam.updateMatrixWorld(true); cam.updateProjectionMatrix(); return new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); };
const look = (from, to, fov = 60) => { const c = new THREE.PerspectiveCamera(fov, 0.6, 0.1, 500); c.position.copy(from); c.lookAt(to); return frustumOf(c); };

test('a body is culled out of view, drawn whenever any of it is in view, and follows its bones', () => {
	const B = makeBody(), scene = new THREE.Scene(), mesh = new THREE.SkinnedMesh(new THREE.BufferGeometry());
	scene.add(B.P.root); boundBody(B.P); B.P.body.add(mesh); cullPosed(B.P, mesh);
	assert.equal(mesh.frustumCulled, true);
	scene.updateMatrixWorld();
	assert.equal(mesh.intersectsFrustum(look(new THREE.Vector3(0, 1.6, 10), new THREE.Vector3(0, 1, 0))), true);
	// turned away
	assert.equal(mesh.intersectsFrustum(look(new THREE.Vector3(0, 1.6, 10), new THREE.Vector3(0, 1, 30))), false);
	// only an outstretched hand at the edge of a narrow view: still drawn
	B.bones.shoulderL.rotation.z = 0; scene.updateMatrixWorld();
	const hand = B.surface()[5], cam = new THREE.PerspectiveCamera(10, 1, 0.1, 100);
	cam.position.set(hand.x + 0.3, hand.y, 6); cam.lookAt(hand.x + 0.3, hand.y, 0);
	const f = frustumOf(cam);
	assert.equal(f.containsPoint(hand), true); assert.equal(f.containsPoint(new THREE.Vector3(0, 1, 0)), false);
	assert.equal(mesh.intersectsFrustum(f), true);
	// carried off (a car, a lift): the sphere goes with the bones, not where it was bound
	B.P.root.position.set(80, 0, -40); scene.updateMatrixWorld();
	assert.equal(mesh.intersectsFrustum(look(new THREE.Vector3(0, 1.6, 10), new THREE.Vector3(0, 1, 0), 30)), false);
	assert.equal(mesh.intersectsFrustum(look(new THREE.Vector3(80, 1.6, -30), new THREE.Vector3(80, 1, -40), 30)), true);
	// lying down: the sphere lies with them (a view of the feet end of the bed, the head out of it)
	B.P.root.position.set(0, 0.5, 0); B.P.root.rotation.x = -Math.PI / 2; scene.updateMatrixWorld();
	const feet = B.surface()[7], crown = B.surface()[0], bed = look(new THREE.Vector3(feet.x, feet.y + 1.2, feet.z + 0.6), feet, 25);
	assert.ok(crown.z < feet.z - 1.5, 'lying along the bed');
	assert.equal(bed.containsPoint(feet), true); assert.equal(bed.containsPoint(crown), false);
	assert.equal(mesh.intersectsFrustum(bed), true);
	// out of the view but between the sun and it: in the shadow camera's frustum, so it casts
	const sun = new THREE.OrthographicCamera(-20, 20, 20, -20, 0.5, 200); sun.position.set(0, 60, 0); sun.lookAt(0, 0, 0);
	assert.equal(mesh.intersectsFrustum(frustumOf(sun)), true);
	// a bone gone wild never makes a body vanish
	B.bones.wristR.position.x = NaN; scene.updateMatrixWorld();
	assert.equal(mesh.intersectsFrustum(look(new THREE.Vector3(0, 1.6, 10), new THREE.Vector3(0, 1, 30))), true);
});

test('the sphere is refitted once per update of the matrices, not per mesh or pass', () => {
	const B = makeBody(), scene = new THREE.Scene();
	scene.add(B.P.root); boundBody(B.P);
	let fits = 0;
	const e = B.P.bones[0].matrixWorld.elements;
	Object.defineProperty(B.P.bones[0].matrixWorld, 'elements', { get() { fits++; return e; } });
	scene.updateMatrixWorld();
	fits = 0;
	B.P.bound(); B.P.bound(); B.P.bound();
	assert.equal(fits, 2, 'one fit (the bone read once, and once for the scale)');
	scene.updateMatrixWorld(); fits = 0; B.P.bound();
	assert.equal(fits, 2);
});

test('a body mesh answers for its own sphere from its rest shape, without skinning it', () => {
	const B = makeBody(), g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 1.8, 0, 0.4, 1, 0.2], 3));
	const mesh = new THREE.SkinnedMesh(g); boundBody(B.P); cullPosed(B.P, mesh);
	mesh.computeBoundingSphere = () => assert.fail('skinned on the CPU');
	assert.ok(mesh.boundingSphere.radius > 0.8 && mesh.boundingSphere !== g.boundingSphere);
	B.P.body.add(mesh); B.P.root.updateMatrixWorld(true);
	new THREE.Frustum().intersectsObject(mesh);
});
