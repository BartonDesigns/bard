// The marks a fight leaves on a wall: a round's pock (a dark hole with the plaster knocked off
// round it), a heavy round's chip (a ragged crater, the grey core showing), a blast's scorch
// (soot thrown out in streaks from where it burst), on a wall or on the ground. One instanced
// mesh with a small drawn atlas, a fixed pool (the oldest goes first), kept by building so
// they go when it is put right.

import * as THREE from 'three';

const M4 = new THREE.Matrix4(), QT = new THREE.Quaternion(), P3 = new THREE.Vector3(), S3 = new THREE.Vector3(), N3 = new THREE.Vector3(), Z3 = new THREE.Vector3(0, 0, 1), EU = new THREE.Euler();
const HIDE = new THREE.Matrix4().makeScale(0, 0, 0);
export const POCK = 0, CHIP = 1, SCORCH = 2, CRATER = 3;

// the atlas: four cells, drawn once
function atlas() {
	const S = 256, cv = document.createElement('canvas');
	cv.width = cv.height = S * 2;
	const g = cv.getContext('2d');
	const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
	const blob = (cx, cy, r, n, jag) => { g.beginPath(); for (let i = 0; i <= n; i++) { const a = i / n * Math.PI * 2, k = r * (1 - jag + rnd() * jag * 2); if (i) g.lineTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k); else g.moveTo(cx + Math.cos(a) * k, cy + Math.sin(a) * k); } g.closePath(); g.fill(); };
	// a round's pock: plaster knocked off in a ring, the hole dark at its heart
	{
		const cx = S / 2, cy = S / 2;
		g.fillStyle = 'rgba(150,146,138,0.85)'; blob(cx, cy, 70, 22, 0.35);
		g.fillStyle = 'rgba(96,92,86,0.95)'; blob(cx, cy, 40, 16, 0.3);
		g.fillStyle = 'rgba(14,13,12,1)'; blob(cx, cy, 16, 10, 0.25);
		g.strokeStyle = 'rgba(40,38,35,0.7)'; g.lineWidth = 2;
		for (let i = 0; i < 7; i++) { const a = rnd() * 6.28; g.beginPath(); g.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); g.lineTo(cx + Math.cos(a + 0.2) * (70 + rnd() * 40), cy + Math.sin(a + 0.2) * (70 + rnd() * 40)); g.stroke(); }
	}
	// a heavy round's chip: a deep ragged crater, the core grey, soot round its lip
	{
		const cx = S * 1.5, cy = S / 2;
		const r0 = g.createRadialGradient(cx, cy, 30, cx, cy, 120); r0.addColorStop(0, 'rgba(30,28,26,0.75)'); r0.addColorStop(1, 'rgba(30,28,26,0)');
		g.fillStyle = r0; blob(cx, cy, 122, 26, 0.2);
		g.fillStyle = 'rgba(120,116,108,1)'; blob(cx, cy, 82, 20, 0.35);
		g.fillStyle = 'rgba(78,75,70,1)'; blob(cx, cy, 58, 16, 0.35);
		g.fillStyle = 'rgba(22,20,19,1)'; blob(cx, cy, 30, 12, 0.4);
		for (let i = 0; i < 18; i++) { g.fillStyle = `rgba(${60 + rnd() * 60},${58 + rnd() * 55},${54 + rnd() * 50},1)`; blob(cx + (rnd() - 0.5) * 110, cy + (rnd() - 0.5) * 110, 4 + rnd() * 9, 6, 0.4); }
	}
	// a blast's scorch: soot thrown out in streaks, thick at the heart
	{
		const cx = S / 2, cy = S * 1.5;
		const r0 = g.createRadialGradient(cx, cy, 10, cx, cy, 125); r0.addColorStop(0, 'rgba(8,7,6,0.95)'); r0.addColorStop(0.5, 'rgba(14,12,10,0.6)'); r0.addColorStop(1, 'rgba(20,18,16,0)');
		g.fillStyle = r0; g.beginPath(); g.arc(cx, cy, 126, 0, 6.29); g.fill();
		g.strokeStyle = 'rgba(10,9,8,0.45)';
		for (let i = 0; i < 40; i++) { const a = rnd() * 6.28, l = 50 + rnd() * 75; g.lineWidth = 2 + rnd() * 7; g.beginPath(); g.moveTo(cx + Math.cos(a) * 20, cy + Math.sin(a) * 20); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke(); }
	}
	// a crater in the ground: the scorch with broken paving at its heart
	{
		const cx = S * 1.5, cy = S * 1.5;
		const r0 = g.createRadialGradient(cx, cy, 20, cx, cy, 126); r0.addColorStop(0, 'rgba(10,9,8,0.95)'); r0.addColorStop(0.6, 'rgba(18,16,14,0.55)'); r0.addColorStop(1, 'rgba(20,18,16,0)');
		g.fillStyle = r0; g.beginPath(); g.arc(cx, cy, 126, 0, 6.29); g.fill();
		g.fillStyle = 'rgba(44,41,38,1)'; blob(cx, cy, 52, 18, 0.35);
		for (let i = 0; i < 26; i++) { g.fillStyle = `rgba(${70 + rnd() * 50},${68 + rnd() * 45},${62 + rnd() * 40},1)`; blob(cx + (rnd() - 0.5) * 120, cy + (rnd() - 0.5) * 120, 3 + rnd() * 10, 5, 0.4); }
	}
	const t = new THREE.CanvasTexture(cv);
	t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
	return t;
}

export function createMarks(scene, { isPhone = false } = {}) {
	const CAP = isPhone ? 90 : 260;
	const geo = new THREE.PlaneGeometry(1, 1);
	const aCell = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 2), 2);
	geo.setAttribute('aCell', aCell);
	const mat = new THREE.MeshStandardMaterial({ map: atlas(), transparent: true, depthWrite: false, roughness: 0.95, metalness: 0, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
	mat.onBeforeCompile = (sh) => {
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aCell;').replace('#include <uv_vertex>', '#include <uv_vertex>\n\tvMapUv = vMapUv * 0.5 + aCell;');
	};
	const mesh = new THREE.InstancedMesh(geo, mat, CAP);
	mesh.count = CAP; mesh.frustumCulled = false; mesh.renderOrder = 1; mesh.receiveShadow = true; mesh.name = 'structures-marks';
	for (let i = 0; i < CAP; i++) mesh.setMatrixAt(i, HIDE);
	scene.add(mesh);
	const slots = Array.from({ length: CAP }, () => ({ id: undefined, x: 0, z: 0 }));
	let next = 0;
	// a mark of kind k at p (world), facing n (outward), size s, owned by building id (or null)
	function add(k, p, n, s, id = null) {
		const i = next; next = (next + 1) % CAP;
		N3.set(n.x, n.y ?? 0, n.z).normalize();
		QT.setFromUnitVectors(Z3, N3);
		// (turned about its own normal, so no two look alike)
		QT.multiply(new THREE.Quaternion().setFromEuler(EU.set(0, 0, Math.random() * 6.28)));
		mesh.setMatrixAt(i, M4.compose(P3.set(p.x + N3.x * 0.02, p.y + N3.y * 0.02, p.z + N3.z * 0.02), QT, S3.set(s, s, 1)));
		aCell.setXY(i, k & 1 ? 0.5 : 0, k & 2 ? 0.5 : 0);
		Object.assign(slots[i], { id: id ?? '', x: p.x, z: p.z });
		mesh.instanceMatrix.needsUpdate = true; aCell.needsUpdate = true;
	}
	// a building put right: its marks go
	function clear(id) {
		let any = false;
		for (let i = 0; i < CAP; i++) if (slots[i].id === id) { slots[i].id = undefined; mesh.setMatrixAt(i, HIDE); any = true; }
		if (any) mesh.instanceMatrix.needsUpdate = true;
	}
	const count = () => slots.filter((s) => s.id !== undefined).length;
	return { mesh, add, clear, count, cap: CAP };
}
