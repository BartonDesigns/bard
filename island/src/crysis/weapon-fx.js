// A held item's moment of use, as light and a few particles (crysis/viewmodel.js and the
// third-person hand in crysis/held-items.js): a brief star of light at the muzzle (or a ring for
// the energy kit), and a puff of glowing vent sparks. Textures drawn once; each effect is one
// sprite or one points draw, only while it shows.

import * as THREE from 'three';

const tex = {};
function canvasTex(key, draw) {
	if (tex[key]) return tex[key];
	const c = document.createElement('canvas'); c.width = c.height = 64;
	draw(c.getContext('2d'));
	return (tex[key] = new THREE.CanvasTexture(c));
}
const flashTex = () => canvasTex('flash', (g) => {
	const r = g.createRadialGradient(32, 32, 0, 32, 32, 30);
	r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,230,180,.8)'); r.addColorStop(1, 'rgba(255,160,60,0)');
	g.fillStyle = r; g.fillRect(0, 0, 64, 64);
	g.globalCompositeOperation = 'lighter';
	for (let k = 0; k < 5; k++) {
		const a = k / 5 * Math.PI * 2 + 0.3;
		g.beginPath(); g.moveTo(32, 32); g.lineTo(32 + Math.cos(a - 0.12) * 12, 32 + Math.sin(a - 0.12) * 12); g.lineTo(32 + Math.cos(a) * 31, 32 + Math.sin(a) * 31); g.lineTo(32 + Math.cos(a + 0.12) * 12, 32 + Math.sin(a + 0.12) * 12);
		g.fillStyle = 'rgba(255,220,160,.55)'; g.fill();
	}
});
const ringTex = () => canvasTex('ring', (g) => {
	const r = g.createRadialGradient(32, 32, 4, 32, 32, 30);
	r.addColorStop(0, 'rgba(255,255,255,.9)'); r.addColorStop(0.35, 'rgba(255,255,255,.15)'); r.addColorStop(0.7, 'rgba(255,255,255,.85)'); r.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});
const dotTex = () => canvasTex('dot', (g) => {
	const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
	r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.5, 'rgba(255,255,255,.4)'); r.addColorStop(1, 'rgba(255,255,255,0)');
	g.fillStyle = r; g.fillRect(0, 0, 64, 64);
});

// the star (or ring) of light at a muzzle; size in the parent's units
export function createFlash(parent) {
	const m = new THREE.SpriteMaterial({ map: flashTex(), color: 0xffd2a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
	const s = new THREE.Sprite(m);
	s.visible = false; s.renderOrder = 3; s.frustumCulled = false;
	parent.add(s);
	let t = 0, T = 1, size = 0.1;
	return {
		sprite: s,
		fire(kind, tint, sz) {
			m.map = kind === 'pulse' ? ringTex() : flashTex();
			m.color.set(tint); m.rotation = Math.random() * Math.PI * 2;
			t = T = kind === 'pulse' ? 0.09 : 0.05; size = sz * (0.85 + Math.random() * 0.3);
			s.visible = true;
		},
		update(dt) {
			if (!s.visible) return;
			t -= dt;
			if (t <= 0) { s.visible = false; return; }
			const k = t / T;
			m.opacity = k; s.scale.setScalar(size * (1.4 - k * 0.4));
		},
	};
}

// glowing vent sparks, flung out and falling (in the parent's space)
export function createSparks(parent, n = 28) {
	const pos = new Float32Array(n * 3).fill(1e4), vel = new Float32Array(n * 3), life = new Float32Array(n);
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
	const m = new THREE.PointsMaterial({ map: dotTex(), color: 0xffc070, size: 0.006, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
	const p = new THREE.Points(g, m);
	p.frustumCulled = false; p.visible = false; p.renderOrder = 3;
	parent.add(p);
	let next = 0, alive = 0;
	return {
		points: p,
		emit(at, dir, count, tint) {
			m.color.set(tint);
			for (let i = 0; i < count; i++) {
				const j = next; next = (next + 1) % n;
				pos.set([at.x, at.y, at.z], j * 3);
				const s = 0.5 + Math.random() * 0.9;
				vel.set([dir.x * s + (Math.random() - 0.5) * 0.4, dir.y * s + Math.random() * 0.5, dir.z * s + (Math.random() - 0.5) * 0.4], j * 3);
				life[j] = 0.25 + Math.random() * 0.3;
			}
			alive = 0.6; p.visible = true;
		},
		update(dt) {
			if (!p.visible) return;
			alive -= dt;
			for (let j = 0; j < n; j++) {
				if (life[j] <= 0) continue;
				life[j] -= dt;
				if (life[j] <= 0) { pos[j * 3 + 2] = 1e4; continue; }
				vel[j * 3 + 1] -= 2.2 * dt;
				for (let c = 0; c < 3; c++) pos[j * 3 + c] += vel[j * 3 + c] * dt;
			}
			g.attributes.position.needsUpdate = true;
			if (alive <= 0) p.visible = false;
		},
	};
}
