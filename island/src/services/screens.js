// The war room's map table and the screens on the walls: canvases drawn from the world as it
// is. The table shows the streets and buildings round the place it stands in, turned the way
// the building faces, with you on it, the services near and what is happening (a fire, an
// ambulance on its way). The wall screens show the duty board: the units and their states,
// the calls, the clock. Redrawn a few times a second while you are in the room.

import * as THREE from 'three';

function canvasMesh(w, h, px) {
	const cv = document.createElement('canvas');
	cv.width = px; cv.height = Math.max(64, Math.round(px * h / w));
	const tex = new THREE.CanvasTexture(cv);
	tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
	const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
	const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
	return { cv, g: cv.getContext('2d'), tex, mesh, dispose: () => { mesh.geometry.dispose(); mat.dispose(); tex.dispose(); } };
}

// the map table. frame: { l(x, z) -> [lx, lz] } the building's; table { x, z, w, d, y };
// R metres from the middle to the table's long edge
export function mapTable(table, frame, R = 360) {
	const C = canvasMesh(table.w - 0.12, table.d - 0.12, 1024);
	C.mesh.rotation.x = -Math.PI / 2;
	C.mesh.position.set(table.x, table.y + 0.006, table.z);
	const S = C.cv.width, T = C.cv.height, Rz = R * T / S;
	const px = (lx) => (lx + R) / (2 * R) * S, pz = (lz) => (lz + Rz) / (2 * Rz) * T;
	let base = null;
	// the streets and buildings (drawn once into a canvas of their own: they do not move)
	function drawBase(roads, blocks, at) {
		base = document.createElement('canvas'); base.width = S; base.height = T;
		const g = base.getContext('2d');
		g.fillStyle = '#16231f'; g.fillRect(0, 0, S, T);
		// a grid of 100 m squares
		g.strokeStyle = 'rgba(120,190,170,0.12)'; g.lineWidth = 1;
		for (let m = -R; m <= R; m += 100) { g.beginPath(); g.moveTo(px(m), 0); g.lineTo(px(m), T); g.stroke(); }
		for (let m = -Rz; m <= Rz; m += 100) { g.beginPath(); g.moveTo(0, pz(m)); g.lineTo(S, pz(m)); g.stroke(); }
		g.fillStyle = 'rgba(150,170,160,0.35)';
		for (const b of blocks) {
			const ca = Math.cos(b.a), sa = Math.sin(b.a);
			g.beginPath();
			[[-1, -1], [1, -1], [1, 1], [-1, 1]].forEach(([u, v], i) => { const wx = b.x + ca * u * b.w / 2 - sa * v * b.d / 2, wz = b.z + sa * u * b.w / 2 + ca * v * b.d / 2, [lx, lz] = frame.l(wx, wz); if (i) g.lineTo(px(lx), pz(lz)); else g.moveTo(px(lx), pz(lz)); });
			g.closePath(); g.fill();
		}
		g.lineCap = 'round'; g.lineJoin = 'round';
		for (const pass of [0, 1]) for (const r of roads) {
			const p = r.pts;
			if (!p || p.length < 4) continue;
			const major = /motorway|trunk|primary|secondary/.test(r.cls || '');
			g.strokeStyle = pass ? (major ? '#e7d79a' : '#cfd8d2') : 'rgba(0,0,0,0.5)';
			g.lineWidth = (major ? 7 : 4) + (pass ? 0 : 3);
			g.beginPath();
			for (let i = 0; i < p.length; i += 2) { const [lx, lz] = frame.l(p[i], p[i + 1]); if (i) g.lineTo(px(lx), pz(lz)); else g.moveTo(px(lx), pz(lz)); }
			g.stroke();
		}
		// this building, and north
		const [hx, hz] = frame.l(at.x, at.z);
		g.fillStyle = '#7fd1b9'; g.fillRect(px(hx) - 7, pz(hz) - 7, 14, 14);
		const [nx, nz] = frame.l(at.x, at.z - 100);
		const ang = Math.atan2(pz(nz) - pz(hz), px(nx) - px(hx));
		g.save(); g.translate(S - 60, 60); g.rotate(ang + Math.PI / 2);
		g.fillStyle = '#e7d79a'; g.beginPath(); g.moveTo(0, -26); g.lineTo(10, 10); g.lineTo(-10, 10); g.closePath(); g.fill();
		g.font = '700 22px Arial'; g.textAlign = 'center'; g.fillText('N', 0, 34); g.restore();
	}
	// marks: [{ x, z, kind: 'you' | 'hospital' | 'police' | 'fire' | 'armory' | 'unit' | 'fireCall' | 'call', yaw, label }]
	function draw(marks, t) {
		if (!base) return;
		const g = C.g;
		g.drawImage(base, 0, 0);
		for (const m of marks) {
			const [lx, lz] = frame.l(m.x, m.z);
			if (Math.abs(lx) > R || Math.abs(lz) > Rz) continue;
			const x = px(lx), y = pz(lz);
			if (m.kind === 'you') {
				const pulse = 10 + 4 * Math.sin(t * 5);
				g.strokeStyle = '#43e08f'; g.lineWidth = 3; g.beginPath(); g.arc(x, y, pulse, 0, 6.283); g.stroke();
				g.fillStyle = '#43e08f'; g.beginPath(); g.arc(x, y, 6, 0, 6.283); g.fill();
			} else if (m.kind === 'fireCall' || m.kind === 'call') {
				g.fillStyle = m.kind === 'fireCall' ? (Math.floor(t * 3) % 2 ? '#ff5a2a' : '#ffb02a') : '#ff3b6b';
				g.beginPath(); g.moveTo(x, y - 14); g.lineTo(x + 12, y + 9); g.lineTo(x - 12, y + 9); g.closePath(); g.fill();
			} else if (m.kind === 'unit') {
				g.fillStyle = '#ffffff'; g.fillRect(x - 5, y - 5, 10, 10);
			} else {
				const c = { hospital: '#3b8fe6', police: '#5068c8', fire: '#e0452c', armory: '#9aa86a' }[m.kind] || '#cccccc';
				g.fillStyle = c; g.beginPath(); g.arc(x, y, 11, 0, 6.283); g.fill();
				g.fillStyle = '#fff'; g.font = '700 14px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
				g.fillText({ hospital: 'H', police: 'P', fire: 'F', armory: 'A' }[m.kind] || '?', x, y + 1);
			}
		}
		g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, T - 34, S, 34);
		g.fillStyle = '#cfe9df'; g.font = '600 20px Arial'; g.textAlign = 'left'; g.textBaseline = 'middle';
		g.fillText(`GRID ${(2 * R / 1000).toFixed(1)} KM   SQUARES 100 M`, 14, T - 17);
		C.tex.needsUpdate = true;
	}
	return { mesh: C.mesh, drawBase, draw, ready: () => !!base, dispose: C.dispose };
}

// a wall screen: lines of text on the duty board. s: { x, z, rot, w, y0, h } in the plan
export function dutyScreen(s) {
	const C = canvasMesh(s.w - 0.04, s.h - 0.04, 768);
	const r = s.rot, [fx, fz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][r];
	C.mesh.position.set(s.x + fx * 0.068, s.y0 + s.h / 2, s.z + fz * 0.068);
	C.mesh.rotation.y = Math.atan2(fx, fz);
	function draw(title, rows, t) {
		const g = C.g, W = C.cv.width, H = C.cv.height;
		g.fillStyle = '#071214'; g.fillRect(0, 0, W, H);
		g.fillStyle = '#123a33'; g.fillRect(0, 0, W, 52);
		g.fillStyle = '#9ff2d4'; g.font = '700 28px Arial'; g.textAlign = 'left'; g.textBaseline = 'middle';
		g.fillText(title, 18, 27);
		const clock = new Date(t * 1000).toISOString().slice(11, 19);
		g.textAlign = 'right'; g.fillText(clock, W - 18, 27);
		g.font = '500 24px Arial'; g.textAlign = 'left';
		rows.slice(0, Math.floor((H - 70) / 34)).forEach((row, i) => {
			g.fillStyle = row.alert ? '#ff8a6a' : '#d9efe8';
			g.fillText(row.text, 18, 80 + i * 34);
			if (row.state) { g.textAlign = 'right'; g.fillStyle = row.alert ? '#ffb38a' : '#7fd1b9'; g.fillText(row.state, W - 18, 80 + i * 34); g.textAlign = 'left'; }
		});
		C.tex.needsUpdate = true;
	}
	return { mesh: C.mesh, draw, dispose: C.dispose };
}

// a sign in the rooms (EMERGENCY, PHARMACY, CELLS...): one plane, its words lit
export function roomSign(text, w, h, colour = '#1d5fa8') {
	const C = canvasMesh(w, h, 512), g = C.g, W = C.cv.width, H = C.cv.height;
	g.fillStyle = colour; g.fillRect(0, 0, W, H);
	g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
	let fs = Math.floor(H * 0.6);
	g.font = `700 ${fs}px Arial`;
	while (g.measureText(text).width > W * 0.9 && fs > 10) { fs -= 2; g.font = `700 ${fs}px Arial`; }
	g.fillText(text, W / 2, H / 2 + 2);
	C.tex.needsUpdate = true;
	return { mesh: C.mesh, dispose: C.dispose };
}
