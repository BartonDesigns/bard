// The dead that do not rest: old bones held together by nothing kind, down in the barrow
// and the crypt. They stand swaying until someone comes near, then shamble after them and
// swing. A blow knocks one back; three and it falls apart and goes to dust. Nothing more.
//
// Each is a small rig of bone shapes (skull, ribcage, spine, pelvis, limbs), moved by hand.

import * as THREE from 'three';
import { Kit, M } from './kit.js';

const BONE = [0.82, 0.78, 0.66];

function part(build) { const k = new Kit(); build(k); return k.build(); }
// the shapes, made once
let SHAPES = null;
function shapes() {
	if (SHAPES) return SHAPES;
	const limb = (len, r) => part((k) => { k.lathe([[r * 1.5, -len], [r, -len + 0.06], [r * 0.8, -len * 0.5], [r, -0.06], [r * 1.5, 0]], 6, M.BONE, BONE); });
	SHAPES = {
		skull: part((k) => {
			k.lathe([[0.05, 0.0], [0.085, 0.03], [0.1, 0.08], [0.095, 0.14], [0.06, 0.19], [0.001, 0.2]], 10, M.BONE, BONE);
			// the jaw and the dark of the eyes
			k.box(-0.055, -0.05, 0.0, 0.055, 0.0, 0.09, M.BONE, BONE);
			for (const s of [-1, 1]) k.face([[s * 0.045 - 0.022, 0.08, 0.093], [s * 0.045 + 0.022, 0.08, 0.093], [s * 0.045 + 0.022, 0.115, 0.086], [s * 0.045 - 0.022, 0.115, 0.086]], [0, 0, 1], M.PLAIN, [0.02, 0.02, 0.02]);
			k.face([[-0.012, 0.045, 0.098], [0.012, 0.045, 0.098], [0, 0.07, 0.095]], [0, 0, 1], M.PLAIN, [0.02, 0.02, 0.02]);
		}),
		ribs: part((k) => {
			for (let i = 0; i < 6; i++) {
				const y = -0.05 - i * 0.055, r = 0.14 - Math.abs(i - 2) * 0.012;
				for (let j = 0; j < 10; j++) {
					const a0 = -2.6 + j / 10 * 5.2, a1 = -2.6 + (j + 1) / 10 * 5.2;
					k.beam([Math.sin(a0) * r, y, Math.cos(a0) * r * 0.75], [Math.sin(a1) * r, y - 0.012, Math.cos(a1) * r * 0.75], 0.018, 0.012, M.BONE, BONE);
				}
			}
			k.beam([0, 0, -0.1], [0, -0.42, -0.1], 0.035, 0.035, M.BONE, BONE);
			k.beam([0, -0.02, 0.1], [0, -0.26, 0.11], 0.03, 0.012, M.BONE, BONE);
			for (const s of [-1, 1]) k.beam([s * 0.02, 0.02, 0.06], [s * 0.18, 0.0, -0.02], 0.02, 0.02, M.BONE, BONE);
		}),
		pelvis: part((k) => {
			k.lathe([[0.1, -0.08], [0.15, 0], [0.13, 0.05]], 10, M.BONE, BONE);
			k.beam([0, 0.2, -0.08], [0, 0.0, -0.08], 0.035, 0.035, M.BONE, BONE);
		}),
		upper: limb(0.42, 0.028), lower: limb(0.42, 0.022), arm: limb(0.3, 0.022), fore: limb(0.27, 0.018),
		blade: part((k) => {
			k.box(-0.022, -0.1, -0.006, 0.022, 0.62, 0.006, M.IRON, [0.42, 0.38, 0.34]);
			k.box(-0.08, -0.12, -0.015, 0.08, -0.08, 0.015, M.IRON, [0.3, 0.26, 0.22]);
			k.box(-0.018, -0.3, -0.018, 0.018, -0.12, 0.018, M.PLANK, [0.3, 0.22, 0.14]);
		}),
	};
	return SHAPES;
}

// one: a group standing at its feet, parts hung off it
function makeBones(mat) {
	const S = shapes();
	const root = new THREE.Group();
	const mesh = (g, parent, x, y, z) => { const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); m.castShadow = false; parent.add(m); return m; };
	const hips = new THREE.Group(); hips.position.y = 0.95; root.add(hips);
	mesh(S.pelvis, hips, 0, 0, 0);
	const chest = new THREE.Group(); chest.position.y = 0.52; hips.add(chest);
	mesh(S.ribs, chest, 0, 0, 0);
	const head = new THREE.Group(); head.position.set(0, 0.08, 0.02); chest.add(head);
	mesh(S.skull, head, 0, 0.02, 0);
	const legs = [], arms = [];
	for (const s of [-1, 1]) {
		const th = new THREE.Group(); th.position.set(s * 0.1, -0.05, 0); hips.add(th);
		mesh(S.upper, th, 0, 0, 0);
		const sh = new THREE.Group(); sh.position.y = -0.42; th.add(sh);
		mesh(S.lower, sh, 0, 0, 0);
		legs.push({ th, sh });
		const up = new THREE.Group(); up.position.set(s * 0.2, -0.02, -0.02); chest.add(up);
		mesh(S.arm, up, 0, 0, 0);
		const fo = new THREE.Group(); fo.position.y = -0.3; up.add(fo);
		mesh(S.fore, fo, 0, 0, 0);
		arms.push({ up, fo });
	}
	// a rusty blade in the right hand
	const blade = mesh(S.blade, arms[1].fo, 0, -0.27, 0.02);
	blade.rotation.x = Math.PI / 2;
	return { root, hips, chest, head, legs, arms, blade };
}

export function createFoes({ scene, list, material, camera, where, dust, onHit, onFall }) {
	const group = new THREE.Group();
	group.name = 'medieval-foes';
	scene.add(group);
	const foes = list.map((f, i) => {
		const B = makeBones(material);
		B.root.position.set(f.x, f.y, f.z);
		B.root.rotation.y = f.yaw;
		group.add(B.root);
		return { ...f, i, B, hp: 3, state: 'idle', t: Math.random() * 5, kb: new THREE.Vector3(), swing: 0, cool: 0, fall: 0, heading: f.yaw, alive: true, seen: false, spd: 0, phase: Math.random() * 6 };
	});
	const tmp = new THREE.Vector3();
	function update(dt, t, P) {
		const cam = camera.position;
		for (const f of foes) {
			const B = f.B;
			if (!f.alive) {
				// falling apart: the bones drop and scatter, then are gone
				f.fall += dt;
				const k = Math.min(1, f.fall / 0.8);
				B.hips.position.y = 0.95 * (1 - k) + 0.12 * k;
				B.hips.rotation.x = k * (f.i % 2 ? 1.3 : -1.3);
				B.chest.rotation.z = k * 0.8;
				B.head.position.y = 0.08 - k * 0.3;
				for (const L of B.legs) L.th.rotation.x = -k * 1.2;
				for (const A of B.arms) A.up.rotation.z = k * (A === B.arms[0] ? -1.4 : 1.4);
				if (f.fall > 2.2) {
					const s = Math.max(0, 1 - (f.fall - 2.2) / 1.2);
					B.root.scale.setScalar(Math.max(0.001, s));
					if (s <= 0) B.root.visible = false;
				}
				continue;
			}
			const dx = cam.x - f.x, dz = cam.z - f.z, d = Math.hypot(dx, dz), dy = Math.abs(cam.y - 1.6 - f.y);
			const near = d < 11 && dy < 2.5 && P && !P.flying;
			f.t += dt;
			f.cool -= dt;
			// knocked back
			if (f.kb.lengthSq() > 1e-4) {
				const step = Math.min(1, dt * 7);
				tmp.copy(f.kb).multiplyScalar(step);
				const nx = f.x + tmp.x, nz = f.z + tmp.z, g = where(nx, nz, f.y);
				if (g != null && Math.abs(g - f.y) < 0.8) { f.x = nx; f.z = nz; f.y = g; }
				f.kb.multiplyScalar(1 - step);
			}
			if (near) {
				f.seen = true;
				const want = Math.atan2(dx, dz);
				let dh = want - f.heading; while (dh > Math.PI) dh -= Math.PI * 2; while (dh < -Math.PI) dh += Math.PI * 2;
				f.heading += dh * Math.min(1, dt * 3);
				if (d > 1.3 && f.swing <= 0) {
					f.spd += (1.25 - f.spd) * Math.min(1, dt * 2);
					const nx = f.x + Math.sin(f.heading) * f.spd * dt, nz = f.z + Math.cos(f.heading) * f.spd * dt, g = where(nx, nz, f.y);
					if (g != null && Math.abs(g - f.y) < 0.6) { f.x = nx; f.z = nz; f.y = g; } else f.spd = 0;
				} else f.spd *= 0.8;
				// a swing: raised, then brought down; it lands if you are still in reach
				if (d < 1.7 && f.cool <= 0 && f.swing <= 0) { f.swing = 1.0; f.cool = 1.9 + Math.random() * 0.6; }
			} else f.spd *= 0.9;
			if (f.swing > 0) {
				const was = f.swing;
				f.swing -= dt * 1.4;
				if (was > 0.35 && f.swing <= 0.35 && d < 2.0 && dy < 2) onHit?.(f);
			}
			// the rig: a shamble, a sway at rest, the arm raised and brought down
			f.phase += dt * (2 + f.spd * 5);
			const w = Math.min(1, f.spd), sw = Math.sin(f.phase);
			B.root.position.set(f.x, f.y, f.z);
			B.root.rotation.y = f.heading;
			B.hips.position.y = 0.95 + Math.abs(Math.cos(f.phase)) * 0.03 * w;
			B.hips.rotation.z = sw * 0.05 * w + Math.sin(f.t * 0.7 + f.i) * 0.03;
			B.chest.rotation.x = 0.18 + Math.sin(f.t * 1.1 + f.i) * 0.04;
			B.head.rotation.z = Math.sin(f.t * 0.9 + f.i * 2) * 0.15;
			B.head.rotation.y = near ? 0 : Math.sin(f.t * 0.4 + f.i) * 0.5;
			B.legs[0].th.rotation.x = sw * 0.45 * w; B.legs[1].th.rotation.x = -sw * 0.45 * w;
			B.legs[0].sh.rotation.x = Math.max(0, -sw) * 0.6 * w; B.legs[1].sh.rotation.x = Math.max(0, sw) * 0.6 * w;
			const lift = f.swing > 0.35 ? Math.sin((1 - f.swing) / 0.65 * Math.PI / 2) : f.swing > 0 ? 1 - (0.35 - f.swing) / 0.35 * 1.2 : 0;
			B.arms[1].up.rotation.x = -0.2 - lift * 2.2 + (f.swing > 0 ? 0 : -sw * 0.3 * w);
			B.arms[1].fo.rotation.x = -0.4 - lift * 0.3;
			B.arms[0].up.rotation.x = 0.1 + sw * 0.3 * w - (near ? 0.6 : 0);
			B.arms[0].fo.rotation.x = -0.3 - (near ? 0.5 : 0);
		}
	}
	// a blow from the player at pos, facing yaw: the foes in reach are struck
	function strike(pos, yaw) {
		const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
		let hit = 0;
		for (const f of foes) {
			if (!f.alive) continue;
			const dx = f.x - pos.x, dz = f.z - pos.z, d = Math.hypot(dx, dz);
			if (d > 2.6 || Math.abs(pos.y - 1.6 - f.y) > 2) continue;
			if ((dx * fx + dz * fz) / (d || 1) < 0.35) continue;
			f.hp -= 1; hit++;
			f.kb.set(dx / (d || 1) * 1.8, 0, dz / (d || 1) * 1.8);
			f.swing = 0; f.cool = Math.max(f.cool, 0.8);
			dust?.(f.x, f.y + 1.1, f.z, 0.4);
			if (f.hp <= 0) { f.alive = false; f.fall = 0; dust?.(f.x, f.y + 0.6, f.z, 1.6); onFall?.(f); }
		}
		return hit;
	}
	const nearest = (pos, reach) => { let best = null, bd = reach; for (const f of foes) { if (!f.alive) continue; const d = Math.hypot(f.x - pos.x, f.z - pos.z); if (d < bd && Math.abs(pos.y - 1.6 - f.y) < 2.5) { bd = d; best = f; } } return best; };
	function dispose() { scene.remove(group); }
	return { update, strike, nearest, foes, group, dispose };
}

// dust: a puff of grey motes, blown out and settling
export function createDust(scene, shared) {
	const N = 400, pos = new Float32Array(N * 3), vel = new Float32Array(N * 3), life = new Float32Array(N);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	g.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
	const m = new THREE.ShaderMaterial({
		uniforms: { uPx: { value: 1 }, uTime: shared.uTime },
		vertexShader: 'attribute float aLife; varying float vL; uniform float uPx; void main(){ vL = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (aLife > 0.0 ? (1.2 - aLife) * 90.0 + 20.0 : 0.0) * uPx / max(1.0, -mv.z); }',
		fragmentShader: 'varying float vL; void main(){ vec2 p = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.1, length(p)) * clamp(vL, 0.0, 1.0) * 0.45; gl_FragColor = vec4(vec3(0.62, 0.58, 0.5), a); }',
		transparent: true, depthWrite: false,
	});
	const pts = new THREE.Points(g, m);
	pts.frustumCulled = false;
	scene.add(pts);
	let next = 0;
	return {
		puff(x, y, z, k = 1) {
			for (let i = 0; i < 40 * k; i++) {
				const j = next++ % N;
				pos[j * 3] = x + (Math.random() - 0.5) * 0.4; pos[j * 3 + 1] = y + (Math.random() - 0.5) * 0.8; pos[j * 3 + 2] = z + (Math.random() - 0.5) * 0.4;
				vel[j * 3] = (Math.random() - 0.5) * 1.6 * k; vel[j * 3 + 1] = Math.random() * 0.8; vel[j * 3 + 2] = (Math.random() - 0.5) * 1.6 * k;
				life[j] = 1;
			}
		},
		update(dt) {
			let any = false;
			for (let i = 0; i < N; i++) {
				if (life[i] <= 0) continue;
				any = true;
				life[i] -= dt * 0.55;
				pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
				vel[i * 3] *= 0.96; vel[i * 3 + 1] = vel[i * 3 + 1] * 0.96 - dt * 0.3; vel[i * 3 + 2] *= 0.96;
			}
			if (any) { g.attributes.position.needsUpdate = true; g.attributes.aLife.needsUpdate = true; }
			pts.visible = any;
		},
		dispose() { scene.remove(pts); g.dispose(); m.dispose(); },
	};
}
