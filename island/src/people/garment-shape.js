// How a garment stands off the arm, and how it moves with the pose. A sleeve is not the arm
// pushed out: it is cut with room at the bicep and the armhole, narrows down the forearm, and
// ends in a cuff that hugs the wrist (a knit rib, a buttoned shirt cuff, a jacket's open end),
// with the spare length bunched just above it; a short sleeve opens a little at its hem; a
// rolled one ends in a thick roll below the elbow. Pure numbers here (tested in
// tools/garment-shape.test.mjs); garment.js bakes them into the cloth mesh, and the vertex
// shader below folds and hangs the sleeves by the live bone angles (no cloth simulation).

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const bump = (x, c, w) => Math.exp(-Math.pow((x - c) / w, 2));

// where each sleeve length ends, along the arm: 0 the shoulder joint, 1 the elbow, 2 the wrist
export const SLEEVE_END = { none: 0, cap: 0.25, short: 0.6, elbow: 1, rolled: 1.3, long: 1.9 };
// knits whose cuffs and waistband are ribbed and gathered
const RIBBED = /^(hoodie|sweat|halfzip|track|fleece|knit|puffer|bomber)$/;
// woven tops with a buttoned shirt cuff
const SHIRTED = /^(shirt|flannel|oxford|blouse|utility|denim|chambray)$/;
export const isRibbed = (g) => !!g && (RIBBED.test(g.kind || '') || g.fab === 'fleece' || g.rib === true);
export const isShirted = (g) => !!g && (SHIRTED.test(g.kind || '') || g.pat === 'oxford' || g.pat === 'chambray');
// how loose a fit is, as a share of a regular fit's room
export const looseness = (g) => !g ? 1 : g.fit === 'tight' ? 0 : g.fit === 'fitted' || g.fit === 'slim' ? 0.55 : g.fit === 'oversized' ? 1.9 : g.fit === 'baggy' ? 1.7 : g.fit === 'straight' ? 1.1 : 1;

// The stand-off (metres) of a sleeve at t along the arm (0 shoulder .. 2 wrist), dc metres
// above its cuff edge (from the cuff plane); outerLayer for a jacket over a top. Regular
// room: about 13 mm at the bicep, 9 mm down the forearm, a cuff of 3 to 7 mm. A tight
// garment keeps to the skin.
export function sleeveEase(g, t, dc, outerLayer = false) {
	const L = looseness(g);
	if (L === 0) return 0.004;
	const end = SLEEVE_END[g?.sleeves || 'short'] ?? 0.6;
	const outer = outerLayer ? 0.006 : 0;
	// the armhole snug, opening to the bicep
	let k = 0.004 + (0.009 * L + outer) * smooth(t / 0.45);
	if (end <= 1.05) {
		// short sleeves: the hem stands open a little and hangs (the shader adds the hang)
		k += (0.004 + 0.006 * L) * smooth(t / Math.max(0.2, end));
		return Math.min(k, 0.05);
	}
	// down the forearm the sleeve narrows
	if (t > 1) k *= 1 - 0.28 * smooth((t - 1) / 0.75);
	if (g?.sleeves === 'rolled') {
		// the roll: several turns of cloth, thick and firm, just below the elbow
		const roll = 1 - smooth((dc - 0.035) / 0.02);
		return k * (1 - roll) + (0.012 + 0.003 * L) * roll;
	}
	const ribbed = isRibbed(g), shirted = isShirted(g);
	// the spare length stacks just above the cuff (more on a loose knit)
	const stack = ribbed ? 0.008 * Math.max(0.6, L) : shirted ? 0.004 * L : 0.002 * L;
	k += stack * bump(dc, 0.085, 0.045);
	// the cuff itself
	const band = ribbed ? 0.06 : shirted ? 0.055 : 0;
	if (band && dc < band) {
		const cuff = ribbed ? 0.0028 : 0.0065 + 0.0015 * L;
		const w = smooth((band - dc) / 0.018);
		k = k * (1 - w) + cuff * w;
	} else if (!band) k *= 1 - 0.15 * smooth((0.05 - dc) / 0.05);
	return Math.min(k, 0.05);
}

// The waistband of a ribbed top: the rib hugs the hips and the body bloused just above it.
// h: metres above the hem. Returns a multiplier on the torso's stand-off.
export function waistbandEase(g, h) {
	if (!isRibbed(g) || g.crop) return 1;
	if (h < 0.06) return 0.35 + 0.25 * smooth(h / 0.06);
	return 1 + 0.35 * bump(h, 0.1, 0.05);
}

// How far along the arm a rest-pose point lies: 0 the shoulder joint, 1 the elbow, 2 the
// wrist (beyond either end it carries on a little), from the joints landmarks() keeps (cut.arm)
export function armT(v, cut) {
	const A = cut.arm?.[v[0] >= 0 ? 'L' : 'R'];
	if (!A) return 0;
	const along = (a, b) => {
		const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l2 = dx * dx + dy * dy + dz * dz || 1;
		const t = ((v[0] - a[0]) * dx + (v[1] - a[1]) * dy + (v[2] - a[2]) * dz) / l2, c = clamp(t);
		return { t, d: Math.hypot(v[0] - a[0] - dx * c, v[1] - a[1] - dy * c, v[2] - a[2] - dz * c) };
	};
	const u = along(A.s, A.e), f = along(A.e, A.w);
	if (u.t <= 1 && (u.d <= f.d || f.t < 0)) return Math.max(-0.3, u.t);
	return Math.min(2.2, 1 + Math.max(0, f.t));
}

// The bend at a joint, in radians, from two bone directions (0 straight)
export function bendAngle(ax, ay, az, bx, by, bz) {
	const la = Math.hypot(ax, ay, az) || 1, lb = Math.hypot(bx, by, bz) || 1;
	return Math.acos(clamp((ax * bx + ay * by + az * bz) / (la * lb), -1, 1));
}
// How much an elbow bend folds the sleeve: 0 straight .. 1 sharply bent (as the shader)
export const foldAmount = (bend) => smooth((bend - 0.25) / 1.35);

// The hang of a sleeve: the slack falls toward the ground across the arm. For a radial
// direction (rx, ry, rz) round an arm along (dx, dy, dz) (both unit), how far it moves down
// (+) or is drawn in on top (-), per metre of slack (as the shader)
export function sleeveHang(dx, dy, dz, rx, ry, rz) {
	// gravity across the arm
	let gx = dx * dy, gy = -1 + dy * dy, gz = dz * dy;
	const gl = Math.hypot(gx, gy, gz);
	if (gl < 0.05) return 0;
	gx /= gl; gy /= gl; gz /= gl;
	const under = rx * gx + ry * gy + rz * gz;
	return gl * (under > 0 ? 0.8 * Math.pow(under, 1.5) : -0.35 * -under);
}

// The sleeve's pose response in the cloth's vertex shader (after skinning, in the mesh's
// bind space, before the body contact pushes anything back out). `sleeve` is (t along the
// arm, slack in metres); uClothA/B hold each arm's posed capsules (cloth-collide.js: 4, 5 the
// left upper arm and forearm, 8, 9 the right). uPoseK.x scales it all (0: off, for phones and
// for people far off). The spare cloth hangs under the arm; a bent elbow gathers folds on its
// inside and draws the sleeve taut over its point; a raised arm gathers the cloth on top of
// the shoulder. vFold carries the fold (x: at the joint, y: the elbow's bend, for drag lines
// down the whole sleeve) to the fragment's creases.
export const SLEEVE_POSE_GLSL = /* glsl */`
vFold = vec2(0.0); vSleeveT = sleeve.x;
if (uPoseK.x > 0.01 && sleeve.x > -0.5 && mod(slot, 10.0) < 1.5) {
	int iu = position.x >= 0.0 ? 4 : 8;
	vec3 ua = uClothA[iu].xyz, ub = uClothB[iu], fa = uClothA[iu + 1].xyz, fb = uClothB[iu + 1];
	vec3 U = normalize(ub - ua), F = normalize(fb - fa);
	bool onFore = sleeve.x > 1.0;
	vec3 a0 = onFore ? fa : ua, D = onFore ? F : U;
	vec3 r = transformed - (a0 + D * dot(transformed - a0, D));
	float rl = length(r);
	if (rl > 1e-4) {
		vec3 rn = r / rl;
		float slack = clamp(sleeve.y, 0.0, 0.035) * uPoseK.x;
		// the cloth is not a round tube: a few soft lobes round the arm where the slack lies,
		// drifting along it (none at the armhole, where the sleeve is set in)
		vec3 b1 = normalize(cross(D, vec3(0.0, 0.0, 1.0))), b2 = cross(D, b1);
		float ang = atan(dot(rn, b2), dot(rn, b1));
		float lobe = sin(ang * 3.0 + sleeve.x * 2.3 + float(iu)) * 0.6 + sin(ang * 5.0 - sleeve.x * 3.1) * 0.4;
		transformed += rn * slack * 0.7 * lobe * smoothstep(0.1, 0.45, sleeve.x);
		// the hang: grows away from the armhole
		vec3 g = vec3(0.0, -1.0, 0.0) - D * (-D.y);
		float gl = length(g);
		if (gl > 0.05) {
			g /= gl;
			float under = dot(rn, g), from = smoothstep(0.05, 0.5, sleeve.x);
			transformed += g * slack * 0.8 * gl * from * pow(max(under, 0.0), 1.5);
			transformed -= rn * slack * 0.35 * gl * from * max(-under, 0.0);
		}
		// the elbow
		float bend = acos(clamp(dot(U, F), -1.0, 1.0)), fk = smoothstep(0.25, 1.6, bend);
		vFold.y = fk;
		float near = exp(-pow((sleeve.x - 1.0) / 0.3, 2.0));
		if (fk * near > 0.01) {
			vec3 inside = onFore ? -U + F * dot(U, F) : F - U * dot(U, F);
			float il = length(inside);
			if (il > 1e-3) {
				float side = dot(rn, inside / il);
				float room = min(slack + 0.004, 0.013);
				float ripple = 0.5 + 0.5 * sin(sleeve.x * 34.0 + side * 2.0);
				float inner = smoothstep(-0.1, 0.6, side), outer = smoothstep(0.1, 0.8, -side);
				transformed += rn * fk * near * room * (inner * (0.35 + 0.65 * ripple) - outer * 0.8);
				vFold.x = fk * near * inner;
			}
		}
		// the shoulder raised: cloth gathered on top, pulled under the arm
		float raise = smoothstep(0.7, 1.6, acos(clamp(-U.y, -1.0, 1.0)));
		float cap = exp(-pow(sleeve.x / 0.3, 2.0));
		if (raise * cap > 0.01) {
			float top = max(0.0, rn.y);
			transformed += rn * raise * cap * (0.006 * top * (0.5 + 0.5 * sin(sleeve.x * 40.0 + rn.z * 3.0)) - 0.004 * max(0.0, -rn.y));
			vFold.x = max(vFold.x, raise * cap * top);
		}
	}
}
`;
