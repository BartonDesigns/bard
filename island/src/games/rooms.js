// The rooms indoor games are played in, and the backdrop an outdoor game falls back on.
// A room is a closed box around the stage (floor, four walls, a ceiling with its lights),
// every surface facing in, so the camera sees only the room: the street, its trees and the
// houses outside are gone while you play. Each has its venue's look:
//   alley: a bowling alley, a neighbouring lane either side with its pins racked, the
//     masking units glowing across the back wall, lights in rows overhead;
//   arcade: the Musée Mécanique, cabinets along the walls with lit screens and marquees,
//     a patterned carpet, the neon sign;
//   pub: a pub's dartboard wall, wood panelling and wallpaper, the bar along one side with
//     its bottles, pendant lamps, the chalk scoreboard;
//   cage: a batting cage, turf, netting, concrete and floodlights.
// A backdrop is a painted dome and a ground disc around an outdoor game that found no
// clear spot to set up in: a park at the edge of the world (meadow), or open sea.

// a painted texture that repeats every `per` metres over a surface
function tiled(K, w, h, per, draw) {
	const t = K.canvas(256, 256, draw);
	t.wrapS = t.wrapT = K.THREE.RepeatWrapping;
	t.repeat.set(Math.max(1, w / per), Math.max(1, h / per));
	return t;
}
const LOOK = {
	alley: { floor: ['#2a2238', (g) => { g.fillStyle = '#2a2238'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 40; i++) { g.fillStyle = ['#e84a8a', '#3ad0ff', '#ffd23f'][i % 3]; g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 6, 0, 7); g.fill(); } }], wall: ['#1c2442', (g) => { g.fillStyle = '#1c2442'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#e84a8a'; g.fillRect(0, 150, 256, 6); g.fillStyle = '#3ad0ff'; g.fillRect(0, 164, 256, 3); }], ceil: '#15151c', per: 3 },
	arcade: { floor: ['#1a1030', (g) => { g.fillStyle = '#1a1030'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 60; i++) { g.strokeStyle = ['#ff5ab4', '#39d0ff', '#ffd23f', '#6bd66b'][i % 4]; g.lineWidth = 3; g.beginPath(); const x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y); g.lineTo(x + 14, y + 8); g.stroke(); } }], wall: ['#3a2418', (g) => { g.fillStyle = '#3a2418'; g.fillRect(0, 0, 256, 256); g.fillStyle = '#2e1c12'; for (let x = 0; x < 256; x += 32) g.fillRect(x, 0, 3, 256); g.fillStyle = '#6a4a2a'; g.fillRect(0, 170, 256, 8); }], ceil: '#1a1412', per: 2.5 },
	pub: { floor: ['#5a3a22', (g) => { for (let i = 0; i < 8; i++) { g.fillStyle = `hsl(28,${40 + (i % 3) * 5}%,${22 + (i % 4) * 3}%)`; g.fillRect(0, i * 32, 256, 31); } }], wall: ['#2e4a3a', (g) => { g.fillStyle = '#2e4a3a'; g.fillRect(0, 0, 256, 256); g.fillStyle = 'rgba(255,255,255,.06)'; for (let x = 0; x < 256; x += 24) for (let y = 0; y < 150; y += 24) { g.beginPath(); g.arc(x + 12, y + 12, 5, 0, 7); g.fill(); } g.fillStyle = '#4a2e1a'; g.fillRect(0, 160, 256, 96); g.fillStyle = '#6a4424'; g.fillRect(0, 158, 256, 6); }], ceil: '#3a2a1e', per: 2.6 },
	cage: { floor: ['#2f6a34', (g) => { g.fillStyle = '#2f6a34'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(20,${70 + Math.random() * 60},30,.5)`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 5); } }], wall: ['#5a5c60', (g) => { g.fillStyle = '#4e5054'; g.fillRect(0, 0, 256, 256); g.strokeStyle = 'rgba(20,20,20,.9)'; g.lineWidth = 2; for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(256, x); g.stroke(); } }], ceil: '#26282c', per: 3 },
};

// room: { w, z0 (far wall), z1 (near wall, behind the camera), h, style }
export function buildRoom(K, { w, z0, z1, h = 3.2, style = 'arcade' }) {
	const { THREE } = K, L = LOOK[style] || LOOK.arcade, d = z1 - z0, cz = (z0 + z1) / 2;
	const room = K.group();
	room.userData.venue = true;
	const floor = K.mesh(new THREE.PlaneGeometry(w, d), K.mat('#ffffff', { map: tiled(K, w, d, L.per, L.floor[1]), rough: 0.9, glow: 0.3 }), 0, 0.003, cz, room);
	floor.rotation.x = -Math.PI / 2;
	const ceil = K.mesh(new THREE.PlaneGeometry(w, d), K.mat(L.ceil, { rough: 1, glow: 0.4 }), 0, h, cz, room);
	ceil.rotation.x = Math.PI / 2;
	// the walls, each facing into the room
	const wall = (len) => K.mat('#ffffff', { map: tiled(K, len, h, L.per, L.wall[1]), rough: 0.85, glow: 0.35 });
	K.mesh(new THREE.PlaneGeometry(w, h), wall(w), 0, h / 2, z0, room);
	K.mesh(new THREE.PlaneGeometry(w, h), wall(w), 0, h / 2, z1, room).rotation.y = Math.PI;
	K.mesh(new THREE.PlaneGeometry(d, h), wall(d), -w / 2, h / 2, cz, room).rotation.y = Math.PI / 2;
	K.mesh(new THREE.PlaneGeometry(d, h), wall(d), w / 2, h / 2, cz, room).rotation.y = -Math.PI / 2;
	// the lights overhead, in rows
	const lamp = K.mat('#fff6dc', { glow: 1.2 });
	for (let z = z1 - 1.5; z > z0 + 0.5; z -= 3) for (const x of w > 6 ? [-w / 4, w / 4] : [0]) K.box(0.9, 0.04, 0.4, lamp, x, h - 0.03, z, room);
	if (style === 'alley') alley(K, room, w, z0, z1, h);
	else if (style === 'arcade') arcade(K, room, w, z0, z1, h);
	else if (style === 'pub') pub(K, room, w, z0, z1, h);
	else if (style === 'cage') cage(K, room, w, z0, z1, h);
	return room;
}

// neighbouring lanes: boards, gutters, the pin deck with its ten pins, the masking units
function alley(K, room, w, z0, z1, h) {
	const { THREE } = K;
	const wood = K.canvas(64, 512, (g) => { for (let i = 0; i < 16; i++) { g.fillStyle = `hsl(35,${48 + (i % 3) * 6}%,${68 - (i % 4) * 3}%)`; g.fillRect(i * 4, 0, 4, 512); } });
	const len = z1 - z0 - 5;
	const pinMat = K.mat('#f7f4ee', { rough: 0.35, glow: 0.3 }), stripe = K.mat('#c62828');
	for (const x of [-2.3, 2.3]) {
		const lane = K.mesh(new THREE.PlaneGeometry(1.07, len), K.mat('#ffffff', { map: wood, rough: 0.3, glow: 0.3 }), x, 0.12, z0 + 2 + len / 2, room);
		lane.rotation.x = -Math.PI / 2;
		K.box(1.07, 0.12, len, '#b08a5a', x, 0.058, z0 + 2 + len / 2, room);
		for (const s of [-1, 1]) K.box(0.23, 0.02, len, K.mat('#8a9096', { metal: 0.6, rough: 0.3 }), x + s * 0.65, 0.03, z0 + 2 + len / 2, room);
		K.box(0.08, 0.3, len, '#3b3f55', x + (x < 0 ? -0.83 : 0.83), 0.15, z0 + 2 + len / 2, room);
		for (let row = 0; row < 4; row++) for (let k = 0; k <= row; k++) {
			const px = x + (k - row / 2) * 0.305, pz = z0 + 2.7 - row * 0.264;
			K.cyl(0.035, 0.05, 0.38, pinMat, px, 0.31, pz, room, 10);
			K.cyl(0.036, 0.036, 0.03, stripe, px, 0.42, pz, room, 10);
		}
	}
	// the masking units across the back, lit
	const band = K.canvas(512, 64, (g) => { const gr = g.createLinearGradient(0, 0, 512, 0); gr.addColorStop(0, '#e84a8a'); gr.addColorStop(0.5, '#3a2a8a'); gr.addColorStop(1, '#3ad0ff'); g.fillStyle = gr; g.fillRect(0, 0, 512, 64); g.fillStyle = '#fff'; g.font = 'bold 34px system-ui'; g.textAlign = 'center'; for (const x of [90, 256, 422]) g.fillText('★', x, 44); });
	K.box(w - 0.1, 0.7, 0.3, K.mat('#ffffff', { map: band, glow: 0.8 }), 0, 1.9, z0 + 1.2, room);
	K.box(w - 0.1, 0.9, 0.2, '#101014', 0, 0.45, z0 + 0.3, room);
	// the scoring monitors hanging over the approaches
	const screen = K.canvas(128, 64, (g) => { g.fillStyle = '#0a1a3a'; g.fillRect(0, 0, 128, 64); g.fillStyle = '#ffd23f'; g.font = 'bold 18px system-ui'; for (let i = 0; i < 5; i++) g.fillText(['X', '9/', '8-', 'X', '7/'][i], 6 + i * 24, 40); });
	for (const x of [-2.3, 0, 2.3]) K.box(0.9, 0.5, 0.06, K.mat('#ffffff', { map: screen, glow: 0.9 }), x, h - 0.6, z1 - 3.2, room);
}

// the arcade: cabinets along both walls, and the sign over the far wall
function arcade(K, room, w, z0, z1, h) {
	const cols = ['#b83a2a', '#2a6fd1', '#6a2a8a', '#1f8a3a', '#d8a22a', '#8a2a4a'];
	let n = 0;
	for (const s of [-1, 1]) for (let z = z1 - 1.4; z > z0 + 0.8; z -= 1.15) {
		const cab = K.group(room);
		cab.position.set(s * (w / 2 - 0.42), 0, z);
		cab.rotation.y = -s * Math.PI / 2;
		const c = cols[n++ % cols.length];
		K.box(0.72, 1.75, 0.7, c, 0, 0.875, 0, cab);
		const scr = K.canvas(64, 64, (g) => { g.fillStyle = '#05050a'; g.fillRect(0, 0, 64, 64); for (let i = 0; i < 12; i++) { g.fillStyle = cols[(i + n) % cols.length]; g.fillRect(Math.random() * 56, Math.random() * 56, 8, 8); } });
		K.mesh(new K.THREE.PlaneGeometry(0.5, 0.42), K.mat('#ffffff', { map: scr, glow: 1.0 }), 0, 1.3, 0.352, cab);
		K.box(0.72, 0.22, 0.1, K.mat(c, { glow: 0.9 }), 0, 1.66, 0.32, cab);
		K.box(0.72, 0.08, 0.3, '#15151a', 0, 0.95, 0.45, cab);
	}
	const sign = K.canvas(512, 96, (g) => { g.fillStyle = '#120a1a'; g.fillRect(0, 0, 512, 96); g.fillStyle = '#ff5ab4'; g.font = 'bold 50px Georgia,serif'; g.textAlign = 'center'; g.fillText('MUSÉE MÉCANIQUE', 256, 66); });
	K.box(Math.min(w - 0.4, 4), 0.6, 0.05, K.mat('#ffffff', { map: sign, glow: 1.0 }), 0, h - 0.5, z0 + 0.03, room);
}

// the pub: the bar down the left wall with bottles behind, lamps, and the scoreboard
function pub(K, room, w, z0, z1, h) {
	const x = -w / 2 + 0.5, len = z1 - z0 - 1.5, cz = (z0 + z1) / 2 + 0.3;
	K.box(0.6, 1.05, len, '#4a2a16', x + 0.1, 0.525, cz, room);
	K.box(0.7, 0.05, len, '#6a3a1e', x + 0.1, 1.07, cz, room);
	K.box(0.25, 0.04, len, '#3a2212', -w / 2 + 0.13, 1.55, cz, room);
	for (let i = 0; i < 16; i++) K.cyl(0.035, 0.04, 0.26, K.mat(['#2a6a3a', '#8a4a1a', '#c8c0a0', '#3a1a1a'][i % 4], { opacity: 0.85, rough: 0.1 }), -w / 2 + 0.13, 1.7, cz - len / 2 + 0.3 + i * (len - 0.6) / 15, room, 8);
	for (const z of [z1 - 1.2, cz, z0 + 1.4]) { K.cyl(0.005, 0.005, 0.6, '#222', 0, h - 0.3, z, room, 4); K.ball(0.1, K.mat('#ffd890', { glow: 1.2 }), 0, h - 0.65, z, room); }
	const chalk = K.canvas(128, 160, (g) => { g.fillStyle = '#1a1e1a'; g.fillRect(0, 0, 128, 160); g.strokeStyle = '#6a4a2a'; g.lineWidth = 8; g.strokeRect(0, 0, 128, 160); g.fillStyle = '#e8e8e0'; g.font = '18px Georgia,serif'; g.fillText('DARTS', 32, 30); g.fillText('501', 14, 60); g.fillText('501', 74, 60); g.fillText('441', 14, 88); g.fillText('380', 74, 88); });
	K.box(0.6, 0.75, 0.03, K.mat('#ffffff', { map: chalk, glow: 0.4 }), 1.1, 1.55, z0 + 0.03, room);
	const pic = K.canvas(96, 72, (g) => { g.fillStyle = '#c9b89a'; g.fillRect(0, 0, 96, 72); g.strokeStyle = '#c0362c'; g.lineWidth = 4; g.beginPath(); g.moveTo(8, 50); g.quadraticCurveTo(48, 20, 88, 50); g.stroke(); g.fillStyle = '#c0362c'; g.fillRect(24, 18, 5, 40); g.fillRect(66, 18, 5, 40); });
	K.mesh(new K.THREE.PlaneGeometry(0.6, 0.45), K.mat('#ffffff', { map: pic, glow: 0.3 }), w / 2 - 0.02, 1.8, (z0 + z1) / 2, room).rotation.y = -Math.PI / 2;
}

// the batting cage: the net hung in from the walls, the floodlights
function cage(K, room, w, z0, z1, h) {
	const net = K.canvas(128, 128, (g) => { g.clearRect(0, 0, 128, 128); g.strokeStyle = 'rgba(10,10,10,.85)'; g.lineWidth = 2; for (let x = 0; x <= 128; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); g.beginPath(); g.moveTo(0, x); g.lineTo(128, x); g.stroke(); } });
	net.wrapS = net.wrapT = K.THREE.RepeatWrapping; net.repeat.set((z1 - z0) / 1.2, h / 1.2);
	const m = new K.THREE.MeshBasicMaterial({ map: net, transparent: true, side: K.THREE.DoubleSide, depthWrite: false });
	for (const s of [-1, 1]) K.mesh(new K.THREE.PlaneGeometry(z1 - z0, h - 0.3), m, s * (w / 2 - 0.4), (h - 0.3) / 2, (z0 + z1) / 2, room).rotation.y = Math.PI / 2;
	for (const s of [-1, 1]) K.box(0.3, 0.3, 0.3, K.mat('#fffbe8', { glow: 1.4 }), s * (w / 2 - 0.3), h - 0.3, z1 - 2, room);
}

// an outdoor game's backdrop: a painted dome (sky, a far horizon) and a ground disc
export function buildBackdrop(K, { kind = 'meadow', r = 60, night = false, hole = 0 }) {
	const { THREE } = K;
	const sky = K.canvas(16, 512, (g) => {
		const gr = g.createLinearGradient(0, 0, 0, 512);
		if (night) { gr.addColorStop(0, '#050a1c'); gr.addColorStop(0.48, '#1a2440'); } else { gr.addColorStop(0, '#4a86c8'); gr.addColorStop(0.48, '#cfe2ef'); }
		gr.addColorStop(0.5, kind === 'sea' ? (night ? '#0e1a24' : '#3a7a96') : (night ? '#0e1410' : '#6a8a5a'));
		gr.addColorStop(1, kind === 'sea' ? (night ? '#08121a' : '#24506a') : (night ? '#0a100a' : '#4a6a3a'));
		g.fillStyle = gr; g.fillRect(0, 0, 16, 512);
		// a far line of hills (or the sea's horizon) at the equator
		if (kind !== 'sea') { g.fillStyle = night ? '#0c140e' : '#5a7a58'; g.fillRect(0, 236, 16, 20); }
	});
	const set = K.group();
	set.userData.venue = true;
	// (it writes depth like any wall: whatever stands beyond it is hidden)
	K.mesh(new THREE.SphereGeometry(r, 32, 16), new THREE.MeshBasicMaterial({ map: sky, side: THREE.BackSide, fog: false }), 0, 0, 0, set);
	// (a ring, where the game is sunk into the ground, like a rock pool)
	const ground = K.mesh(hole ? new THREE.RingGeometry(hole, r * 0.99, 48, 1) : new THREE.CircleGeometry(r * 0.99, 48), K.mat(kind === 'sea' ? '#d9c7a0' : '#557a3e', { rough: 1, glow: 0.15 }), 0, -0.03, 0, set);
	ground.rotation.x = -Math.PI / 2;
	return set;
}
