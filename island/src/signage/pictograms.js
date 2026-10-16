// Pictograms, drawn here as vectors: one family, one stroke. Figures are built from a round
// head and limbs of one weight with round ends and joins (the weight a twelfth of the box),
// so a walker, a wheelchair user, a child and a workman read as the same hand at a glance and
// at distance. Each draws into a square box of side s centred on (cx, cy) in the colour given.
// No borrowed marks: the access figure, the transit and recycling symbols are drawn fresh.

const TAU = Math.PI * 2;
function limbs(g, s, pts, w = 1 / 12) {
	g.lineWidth = s * w; g.lineCap = 'round'; g.lineJoin = 'round';
	for (const p of pts) { g.beginPath(); g.moveTo(p[0] * s, p[1] * s); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * s, p[i + 1] * s); g.stroke(); }
}
const head = (g, s, x, y, r = 0.075) => { g.beginPath(); g.arc(x * s, y * s, r * s, 0, TAU); g.fill(); };

export const PICTO = {
	// a person walking, mid stride
	walk(g, s) { head(g, s, 0.04, -0.36); limbs(g, s, [[0.0, -0.24, -0.04, 0.06], [-0.04, 0.06, -0.16, 0.22, -0.2, 0.4], [-0.04, 0.06, 0.08, 0.2, 0.18, 0.4], [0.0, -0.2, 0.12, -0.04, 0.2, 0.06], [0.0, -0.2, -0.12, -0.06, -0.18, 0.04]]); },
	// a wheelchair user leaning forward, the chair a ring and a frame (drawn fresh)
	access(g, s) {
		head(g, s, 0.02, -0.38);
		limbs(g, s, [[0.0, -0.26, -0.06, 0.04, 0.16, 0.04, 0.24, 0.3, 0.32, 0.28], [-0.02, -0.16, 0.16, -0.12, 0.22, -0.2]]);
		g.lineWidth = s / 14; g.beginPath(); g.arc(-0.05 * s, 0.2 * s, 0.2 * s, -0.5, Math.PI * 1.45); g.stroke();
	},
	// a child and a grown-up hand in hand (school)
	school(g, s) { head(g, s, -0.14, -0.3); head(g, s, 0.16, -0.16, 0.062); limbs(g, s, [[-0.14, -0.18, -0.14, 0.08], [-0.14, 0.08, -0.24, 0.38], [-0.14, 0.08, -0.04, 0.38], [-0.14, -0.12, 0.02, -0.02, 0.16, -0.06], [0.16, -0.06, 0.16, 0.14], [0.16, 0.14, 0.1, 0.36], [0.16, 0.14, 0.24, 0.36]]); },
	// a workman with his shovel in a heap
	worker(g, s) {
		head(g, s, -0.06, -0.3);
		limbs(g, s, [[-0.08, -0.18, -0.02, 0.06], [-0.02, 0.06, -0.16, 0.36], [-0.02, 0.06, 0.08, 0.36], [-0.06, -0.12, 0.14, -0.02], [0.14, -0.02, 0.3, 0.3]]);
		g.beginPath(); g.moveTo(0.12 * s, 0.4 * s); g.quadraticCurveTo(0.3 * s, 0.14 * s, 0.46 * s, 0.4 * s); g.fill();
	},
	// a person through a doorway (exit)
	exit(g, s) { g.lineWidth = s / 16; g.strokeRect(0.08 * s, -0.42 * s, 0.34 * s, 0.84 * s); head(g, s, -0.18, -0.3); limbs(g, s, [[-0.18, -0.18, -0.14, 0.04], [-0.14, 0.04, -0.3, 0.16, -0.36, 0.36], [-0.14, 0.04, -0.02, 0.2, 0.04, 0.38], [-0.18, -0.12, -0.04, -0.02, 0.06, 0.02], [-0.18, -0.12, -0.32, -0.02]]); },
	// restroom: a man and a woman, a rule between
	restroom(g, s) {
		head(g, s, -0.22, -0.32, 0.065); head(g, s, 0.22, -0.32, 0.065);
		limbs(g, s, [[-0.22, -0.2, -0.22, 0.1], [-0.26, 0.1, -0.26, 0.38], [-0.18, 0.1, -0.18, 0.38], [-0.3, -0.18, -0.34, 0.06], [-0.14, -0.18, -0.1, 0.06]], 1 / 14);
		g.beginPath(); g.moveTo(0.22 * s, -0.22 * s); g.lineTo(0.36 * s, 0.14 * s); g.lineTo(0.08 * s, 0.14 * s); g.closePath(); g.fill();
		limbs(g, s, [[0.18, 0.14, 0.18, 0.38], [0.26, 0.14, 0.26, 0.38]], 1 / 14);
		g.fillRect(-0.015 * s, -0.42 * s, 0.03 * s, 0.84 * s);
	},
	// a cigarette and its smoke (the ring and slash are the caller's)
	cigarette(g, s) { g.fillRect(-0.36 * s, 0.02 * s, 0.56 * s, 0.1 * s); g.fillRect(0.24 * s, 0.02 * s, 0.1 * s, 0.1 * s); g.lineWidth = s / 22; g.beginPath(); g.moveTo(0.3 * s, -0.04 * s); g.bezierCurveTo(0.22 * s, -0.16 * s, 0.38 * s, -0.24 * s, 0.3 * s, -0.36 * s); g.stroke(); },
	// parking: the letter, set heavy
	parking(g, s) { g.font = `bold ${Math.round(s * 0.82)}px "Liberation Sans", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', 0, s * 0.04); },
	bike(g, s) { g.lineWidth = s / 16; for (const x of [-0.24, 0.24]) { g.beginPath(); g.arc(x * s, 0.16 * s, 0.17 * s, 0, TAU); g.stroke(); } limbs(g, s, [[-0.24, 0.16, -0.06, -0.12, 0.14, -0.12, 0.24, 0.16], [-0.06, -0.12, 0.02, 0.16, 0.14, -0.12], [0.1, -0.2, 0.16, -0.24]], 1 / 16); head(g, s, 0.0, -0.36, 0.055); },
	// a bus head on: the windscreen, the destination band, the wheels
	bus(g, s) { g.beginPath(); g.roundRect(-0.3 * s, -0.4 * s, 0.6 * s, 0.7 * s, 0.08 * s); g.fill(); g.save(); g.globalCompositeOperation = 'destination-out'; g.fillRect(-0.24 * s, -0.24 * s, 0.48 * s, 0.26 * s); g.fillRect(-0.22 * s, -0.36 * s, 0.44 * s, 0.07 * s); for (const x of [-0.17, 0.17]) { g.beginPath(); g.arc(x * s, 0.16 * s, 0.05 * s, 0, TAU); g.fill(); } g.restore(); g.fillRect(-0.26 * s, 0.3 * s, 0.12 * s, 0.1 * s); g.fillRect(0.14 * s, 0.3 * s, 0.12 * s, 0.1 * s); },
	tram(g, s) { PICTO.bus(g, s * 0.9); g.lineWidth = s / 24; g.beginPath(); g.moveTo(-0.12 * s, -0.36 * s); g.lineTo(0, -0.48 * s); g.lineTo(0.12 * s, -0.36 * s); g.stroke(); },
	// three arrows chasing round a triangle (recycling)
	recycle(g, s) {
		for (let k = 0; k < 3; k++) {
			g.save(); g.rotate(k * TAU / 3);
			g.lineWidth = s / 11; g.lineCap = 'butt'; g.beginPath(); g.moveTo(-0.2 * s, 0.2 * s); g.lineTo(0.08 * s, 0.2 * s); g.stroke();
			g.beginPath(); g.moveTo(0.08 * s, 0.1 * s); g.lineTo(0.2 * s, 0.2 * s); g.lineTo(0.08 * s, 0.3 * s); g.closePath(); g.fill();
			g.restore();
		}
	},
	// warning: an exclamation in a heavy triangle
	hazard(g, s) { g.lineWidth = s / 12; g.lineJoin = 'round'; g.beginPath(); g.moveTo(0, -0.38 * s); g.lineTo(0.42 * s, 0.34 * s); g.lineTo(-0.42 * s, 0.34 * s); g.closePath(); g.stroke(); g.fillRect(-0.035 * s, -0.16 * s, 0.07 * s, 0.28 * s); g.beginPath(); g.arc(0, 0.22 * s, 0.045 * s, 0, TAU); g.fill(); },
	flame(g, s) { g.beginPath(); g.moveTo(0, -0.4 * s); g.bezierCurveTo(0.34 * s, -0.08 * s, 0.3 * s, 0.38 * s, 0, 0.38 * s); g.bezierCurveTo(-0.3 * s, 0.38 * s, -0.3 * s, 0.0, -0.1 * s, -0.12 * s); g.bezierCurveTo(-0.06 * s, 0.04 * s, 0.06 * s, 0.04 * s, 0, -0.4 * s); g.fill(); },
	info(g, s) { g.beginPath(); g.arc(0, -0.28 * s, 0.07 * s, 0, TAU); g.fill(); g.fillRect(-0.06 * s, -0.14 * s, 0.12 * s, 0.48 * s); g.fillRect(-0.12 * s, -0.14 * s, 0.08 * s, 0.06 * s); g.fillRect(-0.14 * s, 0.28 * s, 0.28 * s, 0.06 * s); },
	hospital(g, s) { g.font = `bold ${Math.round(s * 0.8)}px "Liberation Sans", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 0, s * 0.04); },
	// a heart with a pulse through it (the ambulances' mark, drawn fresh)
	pulse(g, s) {
		g.beginPath(); g.moveTo(0, 0.34 * s); g.bezierCurveTo(-0.5 * s, 0.0, -0.3 * s, -0.42 * s, 0, -0.16 * s); g.bezierCurveTo(0.3 * s, -0.42 * s, 0.5 * s, 0.0, 0, 0.34 * s); g.fill();
		g.save(); g.globalCompositeOperation = 'destination-out'; limbs(g, s, [[-0.4, 0.0, -0.14, 0.0, -0.06, -0.16, 0.04, 0.16, 0.12, 0.0, 0.4, 0.0]], 1 / 18); g.restore();
	},
	// a phone held to a reader (contactless, drawn as a hand and phone, not anyone's mark)
	tap(g, s) { g.lineWidth = s / 14; g.beginPath(); g.roundRect(-0.12 * s, -0.36 * s, 0.24 * s, 0.46 * s, 0.05 * s); g.stroke(); for (const r of [0.2, 0.3]) { g.beginPath(); g.arc(0.14 * s, -0.12 * s, r * s, -0.6, 0.6); g.stroke(); } g.fillRect(-0.3 * s, 0.24 * s, 0.6 * s, 0.1 * s); },
	camera(g, s) { g.beginPath(); g.roundRect(-0.34 * s, -0.16 * s, 0.5 * s, 0.26 * s, 0.04 * s); g.fill(); g.beginPath(); g.moveTo(0.16 * s, -0.06 * s); g.lineTo(0.36 * s, -0.16 * s); g.lineTo(0.36 * s, 0.1 * s); g.lineTo(0.16 * s, 0.0); g.fill(); g.fillRect(-0.12 * s, 0.1 * s, 0.06 * s, 0.24 * s); },
	cart(g, s) { limbs(g, s, [[-0.4, -0.3, -0.28, -0.3, -0.18, 0.12, 0.3, 0.12, 0.38, -0.16, -0.24, -0.16]], 1 / 14); for (const x of [-0.12, 0.24]) { g.beginPath(); g.arc(x * s, 0.28 * s, 0.06 * s, 0, TAU); g.fill(); } },
	dog(g, s) { g.beginPath(); g.ellipse(0, 0.02 * s, 0.26 * s, 0.11 * s, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(0.3 * s, -0.12 * s, 0.09 * s, 0, TAU); g.fill(); limbs(g, s, [[-0.18, 0.08, -0.2, 0.32], [0.16, 0.08, 0.18, 0.32], [-0.24, -0.02, -0.38, -0.16]], 1 / 16); },
	tent(g, s) { g.beginPath(); g.moveTo(0, -0.34 * s); g.lineTo(0.4 * s, 0.3 * s); g.lineTo(-0.4 * s, 0.3 * s); g.closePath(); g.fill(); g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, -0.02 * s); g.lineTo(0.12 * s, 0.3 * s); g.lineTo(-0.12 * s, 0.3 * s); g.fill(); g.restore(); },
	fire(g, s) { PICTO.flame(g, s); },
};

// an arrow of the family: shaft and head, pointing along angle a (0 right, -PI/2 up)
export function arrow(g, cx, cy, s, a, col) {
	g.save(); g.translate(cx, cy); g.rotate(a); g.fillStyle = col;
	g.beginPath();
	g.moveTo(0.42 * s, 0); g.lineTo(0.04 * s, -0.32 * s); g.lineTo(0.04 * s, -0.12 * s); g.lineTo(-0.4 * s, -0.12 * s);
	g.lineTo(-0.4 * s, 0.12 * s); g.lineTo(0.04 * s, 0.12 * s); g.lineTo(0.04 * s, 0.32 * s); g.closePath(); g.fill();
	g.restore();
}
// draw a pictogram by name into box s at (cx, cy)
export function picto(g, name, cx, cy, s, col) {
	const f = PICTO[name];
	if (!f) return;
	g.save(); g.translate(cx, cy); g.fillStyle = col; g.strokeStyle = col; f(g, s); g.restore();
}
