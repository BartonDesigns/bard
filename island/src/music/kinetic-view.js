import * as THREE from 'three';

// Authored flight rig silhouettes, in one local frame. Repeated bodies use shared
// geometry and instancing; the six pool ripples own opacity but share one torus.
// All resources are descendants of group so the world can dispose them together.
export function createKineticView(model) {
	const group = new THREE.Group(); group.name = `kinetic-${model.kind}`;
	const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), euler = new THREE.Euler();
	const point = new THREE.Vector3(), size = new THREE.Vector3(), direction = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), color = new THREE.Color();
	const wood = new THREE.MeshStandardMaterial({ color: 0x30231a, roughness: .8 });
	const metal = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .35, metalness: .3 });
	const glow = hex => new THREE.MeshBasicMaterial({ color: hex });
	const cylinder = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n);
	const sphere = radius => new THREE.SphereGeometry(radius, 8, 6);
	function mesh(geometry, material, x = 0, y = 0, z = 0, name = '') {
		const m = new THREE.Mesh(geometry, material); m.position.set(x, y, z); m.name = name; group.add(m); return m;
	}
	function instances(geometry, material, n, name) {
		const m = new THREE.InstancedMesh(geometry, material, n); m.name = name; m.frustumCulled = false; group.add(m); return m;
	}
	function place(m, i, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
		point.set(x, y, z); size.set(sx, sy, sz); quaternion.setFromEuler(euler.set(rx, ry, rz, 'YXZ'));
		matrix.compose(point, quaternion, size); m.setMatrixAt(i, matrix);
	}
	function paint(m, hue, saturation = .8, lightness = .55) {
		for (let i = 0; i < m.count; i++) m.setColorAt(i, color.setHSL(hue(i), saturation, lightness));
		if (m.instanceColor) m.instanceColor.needsUpdate = true;
	}
	function frame(width, height, thickness) {
		mesh(new THREE.BoxGeometry(width, thickness, thickness), wood, 0, height, 0, 'frame-beam');
		const posts = instances(cylinder(thickness * .47, thickness * .6, height, 7), wood, 2, 'frame-posts');
		place(posts, 0, -width / 2 + .1, height / 2, 0); place(posts, 1, width / 2 - .1, height / 2, 0);
		posts.instanceMatrix.needsUpdate = true;
	}
	let moving, strings = null, ripples = null;
	const count = model.bodies.length, kind = model.kind;
	if (kind === 'garden') {
		moving = instances(sphere(.11), metal, count, 'garden-balls');
		paint(moving, i => .24 - model.bodies[i].ring / 24 * .1, .85);
		mesh(cylinder(8, 8.6, .6, 36), new THREE.MeshStandardMaterial({ color: 0x5a2430, roughness: .8 }), 0, .3, 0, 'garden-dais');
	} else if (kind === 'pendulum' || kind === 'cradle') {
		const cradle = kind === 'cradle'; frame(cradle ? 3.2 : Math.max(6, count * .63) + 1, cradle ? 2.6 : 5.2, cradle ? .16 : .3);
		moving = instances(sphere(cradle ? .21 : .22), metal, count, `${kind}-bobs`);
		if (cradle) metal.color.setHex(0xd7dde3); else paint(moving, i => .24 - i / count * .14, .85);
		strings = instances(cylinder(.02, .02, 1, 4), glow(0x888888), count, `${kind}-strings`);
	} else if (kind === 'dominoes') {
		moving = instances(new THREE.BoxGeometry(.5, 1, .14), metal, count, 'domino-tiles');
		paint(moving, i => i / count * .3 + .05);
	} else if (kind === 'chimes') {
		mesh(cylinder(.10, .16, 3.6, 7), wood, 0, 1.8, 0, 'chime-stem');
		mesh(new THREE.TorusGeometry(1.15, .05, 5, 22), wood, 0, 3.5, 0, 'chime-arm').rotation.x = Math.PI / 2;
		metal.color.setHex(0xcfd6dd); moving = instances(cylinder(.05, .05, 1, 6), metal, count, 'chime-tubes');
		const cords = instances(cylinder(.012, .012, .15, 4), glow(0x888888), count, 'chime-cords');
		model.bodies.forEach((b, i) => place(cords, i, b.anchorX, 3.425, b.anchorZ)); cords.instanceMatrix.needsUpdate = true;
	} else if (kind === 'droplets') {
		mesh(cylinder(2.6, 2.9, .35, 24), new THREE.MeshStandardMaterial({ color: 0x14405a, roughness: .2, metalness: .2 }), 0, .18, 0, 'droplet-pool');
		mesh(new THREE.TorusGeometry(1.9, .07, 6, 26), glow(0x7ce0c3), 0, 4.2, 0, 'droplet-halo').rotation.x = Math.PI / 2;
		moving = instances(sphere(.07), glow(0xaee6ff), count, 'water-drops');
		const ringGeometry = new THREE.TorusGeometry(1, .02, 4, 18);
		ripples = model.ripples.map(() => {
			const material = new THREE.MeshBasicMaterial({ color: 0x9fd8e8, transparent: true, opacity: 0, depthWrite: false });
			const m = mesh(ringGeometry, material, 0, .38, 0, 'pool-ripple'); m.rotation.x = Math.PI / 2; return m;
		});
	} else if (kind === 'harp') {
		mesh(new THREE.SphereGeometry(.42, 14, 10), glow(0xffd98a), 0, 2.6, 0, 'harp-core');
		moving = instances(sphere(.16), metal, count, 'harp-orbs'); paint(moving, i => .55 + i / count * .4, .8, .6);
	} else if (kind === 'stairs') {
		const steps = instances(new THREE.BoxGeometry(1, .18, .55), metal, model.steps.length, 'spiral-steps');
		model.steps.forEach((b, i) => place(steps, i, b.x, b.surfaceY - .09, b.z, 1, 1, 1, 0, b.yaw));
		paint(steps, i => .3 - i / steps.count * .25); steps.instanceMatrix.needsUpdate = true;
		moving = instances(sphere(.17), glow(0xbdc73c), count, 'stair-ball');
	} else if (kind === 'fountain') {
		mesh(cylinder(.22, .34, .9, 8), new THREE.MeshStandardMaterial({ color: 0x2a3442, roughness: .4 }), 0, .45, 0, 'fountain-nozzle');
		const pads = instances(cylinder(.55, .6, .16, 10), metal, model.pads.length, 'fountain-pads');
		model.pads.forEach((b, i) => place(pads, i, b.x, b.surfaceY - .08, b.z));
		paint(pads, i => i / pads.count * .35 + .02, .8, .5); pads.instanceMatrix.needsUpdate = true;
		moving = instances(sphere(.11), glow(0xaee6ff), count, 'fountain-shots');
	} else if (kind === 'wavebars') {
		moving = instances(new THREE.BoxGeometry(.28, 1, .28), metal, count, 'wave-bars'); paint(moving, i => .5 + i / count * .3, .75);
	}
	// Materials unused by a given silhouette never enter the graph; release them now.
	const used = new Set(); group.traverse(o => { if (o.material) used.add(o.material); });
	if (!used.has(wood)) wood.dispose(); if (!used.has(metal)) metal.dispose();
	function refresh() {
		model.bodies.forEach((b, i) => {
			const visible = b.visible !== false;
			place(moving, i, b.x, b.y, b.z, visible ? 1 : 0, visible ? (kind === 'chimes' ? b.length : kind === 'wavebars' ? b.height : 1) : 0, visible ? 1 : 0,
				kind === 'dominoes' ? b.angle : 0, kind === 'dominoes' ? b.yaw : 0, kind === 'chimes' ? b.angle : 0);
			if (strings) {
				const ax = b.anchorX ?? b.x, ay = b.anchorY ?? 5.05, az = b.anchorZ ?? 0;
				direction.set(b.x - ax, b.y - ay, b.z - az); const length = direction.length();
				quaternion.setFromUnitVectors(up, direction.normalize()); size.set(1, length, 1); point.set((ax + b.x) / 2, (ay + b.y) / 2, (az + b.z) / 2);
				matrix.compose(point, quaternion, size); strings.setMatrixAt(i, matrix);
			}
		});
		moving.instanceMatrix.needsUpdate = true; if (strings) strings.instanceMatrix.needsUpdate = true;
		if (ripples) model.ripples.forEach((r, i) => {
			const m = ripples[i]; m.visible = r.visible; m.position.set(r.x, r.y, r.z); m.scale.set(r.size, r.size, 1); m.material.opacity = r.opacity;
		});
	}
	return { group, refresh };
}
