// Far land: islands and headlands stacked in the haze, and on one of them a
// different people: a white-and-terracotta hill town with a lighthouse whose
// beam sweeps the sea after dark.

import * as THREE from 'three';
import { makeNoise, mulberry32 } from '../noise.js';
import { glow } from './textures.js';

function landmass(seed, radius, height) {
	const nz = makeNoise(seed), g = new THREE.CircleGeometry(1, 64, 0, Math.PI * 2);
	// build a domed height field over a disc of rings
	const rings = 18, seg = 72, P = [], C = [], I = [];
	P.push(0, height, 0); C.push(0.30, 0.38, 0.2);
	for (let k = 1; k <= rings; k++) {
		const t = k / rings;
		for (let s = 0; s < seg; s++) {
			const a = s / seg * Math.PI * 2;
			const edge = 0.75 + nz.fbm(Math.cos(a) * 2 + 5, Math.sin(a) * 2, 3) * 0.5;
			const rr = t * radius * edge;
			const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
			const dome = Math.pow(1 - t, 1.4) * height * (0.65 + nz.ridged(x * 0.004 + 3, z * 0.004, 4) * 0.7);
			const y = t >= 0.999 ? -6 : dome + (1 - t) * 4 - 1;
			P.push(x, y, z);
			const rock = t < 0.35 ? 0.4 : 0;
			const sand = t > 0.9 ? 1 : 0;
			C.push(sand ? 0.78 : 0.22 + rock * 0.2, sand ? 0.72 : 0.33 + rock * 0.08, sand ? 0.56 : 0.16 + rock * 0.15);
		}
	}
	for (let s = 0; s < seg; s++) I.push(0, 1 + s, 1 + (s + 1) % seg);
	for (let k = 1; k < rings; k++) for (let s = 0; s < seg; s++) {
		const a = 1 + (k - 1) * seg + s, b = 1 + (k - 1) * seg + (s + 1) % seg, c = a + seg, d = b + seg;
		I.push(a, c, b, b, c, d);
	}
	g.dispose();
	const geo = new THREE.BufferGeometry();
	geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
	geo.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
	geo.setIndex(I);
	geo.computeVertexNormals();
	return geo;
}

export function createDistant(island, shared, scene) {
	const r = mulberry32(island.seed ^ 0xfa4);
	const group = new THREE.Group();
	group.name = 'distant';
	const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: false });
	const lands = [];
	const baseA = Math.atan2(island.village.seaDir.z, island.village.seaDir.x);
	for (let i = 0; i < 5; i++) {
		// place them across the village's sea view so the horizon always has depth
		const a = baseA + (i - 2) * 0.55 + (r() - 0.5) * 0.3, d = 4200 + r() * 3800;
		const rad = 500 + r() * 900, h = 140 + r() * 320;
		const m = new THREE.Mesh(landmass(island.seed + i * 17, rad, h), mat);
		m.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
		m.rotation.y = r() * 6.28;
		group.add(m);
		lands.push({ mesh: m, a, d, rad, h });
	}
	// the neighbours: a hill town on the nearest far island
	const home = lands.slice().sort((a, b) => a.d - b.d)[0];
	const town = new THREE.Group();
	const white = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.9 });
	const terra = new THREE.MeshStandardMaterial({ color: 0xb35a3a, roughness: 0.9 });
	const houseGeo = new THREE.BoxGeometry(1, 1, 1);
	const walls = new THREE.InstancedMesh(houseGeo, white, 160), roofs = new THREE.InstancedMesh(new THREE.ConeGeometry(0.75, 0.6, 4), terra, 160);
	const lights = [];
	const m4 = new THREE.Matrix4();
	let n = 0;
	for (let i = 0; i < 160; i++) {
		const a = r() * 6.28, rr = Math.sqrt(r()) * home.rad * 0.45;
		const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
		const t = rr / home.rad, y = Math.pow(1 - t, 1.4) * home.h * 0.8 + (1 - t) * 4;
		const s = 9 + r() * 10;
		m4.makeScale(s, s * 0.8, s).setPosition(x, y + s * 0.4, z);
		walls.setMatrixAt(n, m4);
		m4.makeScale(s * 0.95, s * 0.7, s * 0.95).setPosition(x, y + s * 0.8 + s * 0.3, z);
		roofs.setMatrixAt(n, m4);
		lights.push(x, y + s * 0.5, z);
		n++;
	}
	walls.count = roofs.count = n;
	town.add(walls, roofs);
	const lightGeo = new THREE.BufferGeometry();
	lightGeo.setAttribute('position', new THREE.Float32BufferAttribute(lights, 3));
	const lightMat = new THREE.PointsMaterial({ map: glow(), color: 0xffc680, size: 26, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
	town.add(new THREE.Points(lightGeo, lightMat));
	// lighthouse on the shore facing us
	const toUs = Math.atan2(-home.mesh.position.z, -home.mesh.position.x) - home.mesh.rotation.y;
	const lh = new THREE.Group();
	const tower = new THREE.Mesh(new THREE.CylinderGeometry(6, 9, 60, 12), white);
	tower.position.y = 30;
	const band = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 7.2, 10, 12), terra);
	band.position.y = 38;
	const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color: 0xfff1c0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
	lamp.position.y = 64; lamp.scale.set(90, 90, 1);
	const beamGeo = new THREE.ConeGeometry(40, 900, 16, 1, true);
	beamGeo.translate(0, -450, 0); beamGeo.rotateX(-Math.PI / 2);
	const beam = new THREE.Mesh(beamGeo, new THREE.MeshBasicMaterial({ color: 0xfff0c8, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
	beam.position.y = 64;
	lh.add(tower, band, lamp, beam);
	lh.position.set(Math.cos(toUs) * home.rad * 0.78, 0, Math.sin(toUs) * home.rad * 0.78);
	town.add(lh);
	home.mesh.add(town);
	scene.add(group);

	function update(t, night) {
		lightMat.opacity = night * 0.9;
		lamp.material.opacity = 0.25 + night * 0.75;
		beam.material.opacity = night * 0.12;
		beam.rotation.y = t * 0.6;
	}
	return { group, lands, update };
}
