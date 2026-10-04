// Photo-inspired Fort Baker details. Static geometry joins the museum's material batches;
// entrances remain open and every approach step uses the same floor model as the porch.
import * as THREE from 'three';

export function museumPorch({ B, F, W, H, hd, zc, doors, mat, boxIn, add, ground, inFrame }) {
	const edge = zc + hd + 2.6, hw = W / 2;
	const segment = (left, right) => {
		if (right - left < 0.12) return;
		const center = (left + right) / 2;
		for (const y of [0.35, 0.78]) boxIn(F, mat.trim, right - left, 0.17, 0.10, center, y, edge - 0.12);
		boxIn(F, mat.trim, right - left, 0.09, 0.24, center, 1.0, edge - 0.12);
		// One low collision volume per panel, with the full doorway gap left free.
		B.col.push({ F, x0: left, x1: right, z0: edge - 0.24, z1: edge,
			y0: F.y, y1: F.y + 1.1 });
	};
	let left = -hw;
	for (const dx of doors) { segment(left, dx - 1.1); left = dx + 1.1; }
	segment(left, hw);
	for (const dx of doors) {
		for (const side of [-1, 1]) boxIn(F, mat.trim, 0.18, 1.12, 0.18, dx + side * 1.1, 0, edge - 0.12);
		// The mapped terrain can slope across a footprint. Extend the stair until its
		// bottom meets that terrain, rather than assuming the porch is 0.5m above it.
		let count = 3;
		for (let pass = 0; pass < 8; pass++) {
			const at = inFrame(F, dx, edge + count * 0.34);
			const next = Math.max(1, Math.min(64, Math.ceil(Math.max(0, F.y - ground(at.x, at.z)) / 0.17)));
			if (next === count) break;
			count = next;
		}
		const toe = inFrame(F, dx, edge + count * 0.34), low = Math.min(F.y, ground(toe.x, toe.z));
		const rise = (F.y - low) / count, steps = [];
		for (let i = 0; i < count; i++) {
			const top = F.y - rise * i, z0 = edge + i * 0.34, z1 = z0 + 0.34;
			boxIn(F, mat.porch, 2.05, 0.12, 0.35, dx, top - F.y - 0.12, (z0 + z1) / 2);
			const step = { F, x0: dx - 1.025, x1: dx + 1.025, z0, z1, y: top };
			B.floors.push(step); steps.push(step);
		}
		B.entrances.push({ F, x: dx, doorZ: zc + hd, porchZ: edge, toeZ: edge + count * 0.34, steps, rise });
		// Small sea-green enamel wall lights and brown shutter leaves beside the doors.
		boxIn(F, mat.shutter, 0.48, 2.4, 0.07, dx - 1.23, 0, zc + hd + 0.04);
		boxIn(F, mat.shade, 0.045, 0.35, 0.045, dx - 1.28, 2.5, zc + hd + 0.30);
		boxIn(F, mat.shade, 0.045, 0.045, 0.34, dx - 1.28, 2.82, zc + hd + 0.18);
		const lamp = new THREE.ConeGeometry(0.21, 0.18, 10, 1, true).translate(dx - 1.28, 2.52, zc + hd + 0.36);
		lamp.applyMatrix4(F.m); add(mat.enamel, lamp);
	}
	// Corner boards and the gutter / downspout read clearly on a long cream facade.
	for (const x of [-hw + 0.08, hw - 0.08]) {
		boxIn(F, mat.trim, 0.18, H, 0.10, x, 0, zc + hd + 0.03);
		boxIn(F, mat.trim, 0.065, H > 5 ? 6.6 : 3.4, 0.065, x, 0, edge - 0.26);
	}
	boxIn(F, mat.trim, W + 0.3, 0.15, 0.12, 0, H > 5 ? 6.55 : 3.35, edge + 0.03);
}

export function museumStroller({ F, x, z, mat, boxIn, add, color = 0 }) {
	const place = (m, geo) => { geo.translate(x, 0, z); geo.applyMatrix4(F.m); add(m, geo); };
	for (const sx of [-0.28, 0.28]) {
		for (const sz of [-0.38, 0.38]) place(mat.net, new THREE.CylinderGeometry(0.13, 0.13, 0.075, 10).rotateZ(Math.PI / 2).translate(sx, 0.14, sz));
		place(mat.steel, new THREE.CylinderGeometry(0.022, 0.022, 0.91, 5).rotateX(-0.48).translate(sx, 0.49, -0.02));
		place(mat.steel, new THREE.CylinderGeometry(0.022, 0.022, 0.69, 5).rotateX(0.65).translate(sx, 0.40, 0.06));
	}
	boxIn(F, mat.steel, 0.61, 0.035, 0.035, x, 0.94, z - 0.23);
	boxIn(F, mat.cloth[color % mat.cloth.length], 0.49, 0.10, 0.50, x, 0.46, z);
	place(mat.cloth[color % mat.cloth.length], new THREE.BoxGeometry(0.49, 0.48, 0.07).rotateX(-0.22).translate(0, 0.71, -0.20));
	place(mat.cloth[color % mat.cloth.length], new THREE.CylinderGeometry(0.32, 0.32, 0.55, 10, 1, true, 0, Math.PI / 2).rotateZ(Math.PI / 2).rotateY(Math.PI / 2).translate(0, 0.83, -0.12));
}

export function museumFlagpole({ F, mat, boxIn, add }) {
	boxIn(F, mat.trim, 0.10, 7, 0.10, -3.4, 0, 1);
	boxIn(F, mat.trim, 3.2, 0.09, 0.09, -3.4, 6.6, 1);
	for (const side of [-1, 1]) {
		boxIn(F, mat.net, 0.015, 5.7, 0.015, -3.4 + side * 1.45, 0.9, 1);
		for (let i = 0; i < 7; i++) {
			const geo = new THREE.PlaneGeometry(0.48, 0.29).rotateY(side * 0.32).translate(-3.4 + side * 1.22, 6.1 - i * 0.65, 1.03);
			geo.applyMatrix4(F.m); add(mat.flags[(i + (side > 0 ? 2 : 0)) % mat.flags.length], geo);
		}
	}
}
