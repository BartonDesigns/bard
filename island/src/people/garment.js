// The clothes on a body (body.js): every garment a person wears is cut from the body's own
// cloth cage into one skinned mesh, each triangle knowing which garment it belongs to (the
// top, the layer over it, the bottoms, the shoes), and painted by one shader: the colours,
// the cloth (knit, twill, denim, nylon, fleece), and the pattern (stripes, plaid, colour
// blocks, a print on the chest, a team's number on the back), with the seams, hems and
// pockets drawn in. Silhouettes come from how far each garment stands off the body:
// fitted or oversized, straight, wide or baggy legs, a skirt's flare, a puffer's loft.
// The small things (caps, beanies, glasses, headphones, bags, a hood) are one more
// mesh, each piece riding the bone it sits on. One cloth mesh and one accessory mesh a
// person keeps the draw calls down, and every program is shared.

import * as THREE from 'three';

// ---------- the painting ----------
// pattern ids (the shader's)
export const PAT = { plain: 0, stripe: 1, breton: 1, pinstripe: 2, plaid: 3, check: 4, block: 5, graphic: 6, band: 7, ringer: 8, quilt: 9, fleece: 10, fleeceblock: 11, rib: 12, denim: 13, chambray: 14, cargo: 15, track: 16, jersey: 17, dots: 18, dye: 19, oxford: 20, hem: 21, mail: 22, hazmat: 23, heat: 24, pleat: 25, hoops: 26, sash: 27 };
// cloth: 0 knit, 1 twill, 2 canvas, 3 nylon, 4 fleece, 5 leather, 6 metal
const FAB = { knit: 0, twill: 1, canvas: 2, nylon: 3, fleece: 4, leather: 5, metal: 6, tech: 3, linen: 2, wool: 2 };

const GLSL_HEAD = /* glsl */`
uniform vec3 uCol[16];
uniform vec4 uPat[4];
uniform vec4 uCutA;
uniform vec4 uCutB;
uniform vec4 uMisc;
uniform vec4 uHem;
uniform sampler2D uKnit;
uniform sampler2D uCanvas;
varying vec3 vBind;
varying vec3 vBN;
flat varying float vSlot;
flat varying float vLimb;
float gRough = 0.9, gMetal = 0.0, gFab = 0.0, gNorm = 0.35;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float band(float x, float a, float b, float s) { return smoothstep(a - s, a, x) * (1.0 - smoothstep(b, b + s, x)); }
float line(float x, float w) { return 1.0 - smoothstep(0.0, w, abs(x)); }
// seven segments: a number on a shirt
float seg(vec2 q, int d) {
	int m = d == 0 ? 63 : d == 1 ? 6 : d == 2 ? 91 : d == 3 ? 79 : d == 4 ? 102 : d == 5 ? 109 : d == 6 ? 125 : d == 7 ? 7 : d == 8 ? 127 : 111;
	float t = 0.24, o = 0.0;
	if ((m & 1) != 0) o = max(o, band(q.x, t, 1.0 - t, 0.02) * band(q.y, 2.0 - t, 2.0, 0.02));
	if ((m & 2) != 0) o = max(o, band(q.x, 1.0 - t, 1.0, 0.02) * band(q.y, 1.0, 2.0, 0.02));
	if ((m & 4) != 0) o = max(o, band(q.x, 1.0 - t, 1.0, 0.02) * band(q.y, 0.0, 1.0, 0.02));
	if ((m & 8) != 0) o = max(o, band(q.x, t, 1.0 - t, 0.02) * band(q.y, 0.0, t, 0.02));
	if ((m & 16) != 0) o = max(o, band(q.x, 0.0, t, 0.02) * band(q.y, 0.0, 1.0, 0.02));
	if ((m & 32) != 0) o = max(o, band(q.x, 0.0, t, 0.02) * band(q.y, 1.0, 2.0, 0.02));
	if ((m & 64) != 0) o = max(o, band(q.x, t, 1.0 - t, 0.02) * band(q.y, 1.0 - t * 0.5, 1.0 + t * 0.5, 0.02));
	return o;
}
// a number (1..99) in a box: w wide, from the bottom-left corner
float number(vec2 q, float n, float w) {
	int tens = int(n) / 10, ones = int(n) - tens * 10;
	float h = w * (tens > 0 ? 0.9 : 1.0);
	if (tens > 0) {
		vec2 a = q / vec2(w * 0.45, h * 0.5), b = (q - vec2(w * 0.55, 0.0)) / vec2(w * 0.45, h * 0.5);
		float o = 0.0;
		if (a.x > 0.0 && a.x < 1.0 && a.y > 0.0 && a.y < 2.0) o = seg(a, tens);
		if (b.x > 0.0 && b.x < 1.0 && b.y > 0.0 && b.y < 2.0) o = max(o, seg(b, ones));
		return o;
	}
	vec2 c = (q - vec2(w * 0.2, 0.0)) / vec2(w * 0.6, h * 0.5);
	return c.x > 0.0 && c.x < 1.0 && c.y > 0.0 && c.y < 2.0 ? seg(c, ones) : 0.0;
}
// a print on the chest: shapes and colour, no words and nothing borrowed
vec3 print(vec3 base, vec3 a, vec3 b, vec2 g, float kind, float fade) {
	float r = length(g), an = atan(g.y, g.x), m = 0.0;
	vec3 c = a;
	int k = int(kind);
	if (k == 0) { m = 1.0 - smoothstep(0.42, 0.45, r); float ray = step(0.55, r) * (1.0 - step(0.8, r)) * step(0.5, fract(an * 1.9099)); if (ray > 0.5) { m = 1.0; c = b; } }
	else if (k == 1) { for (int i = 0; i < 3; i++) { float y = g.y + 0.35 - float(i) * 0.35 - sin(g.x * 7.0) * 0.08; if (abs(y) < 0.07 && abs(g.x) < 0.8) { m = 1.0; c = i == 1 ? b : a; } } }
	else if (k == 2) { if (g.y > -0.5 && g.y < 0.25 - abs(g.x + 0.25) * 1.3) { m = 1.0; c = a; } if (g.y > -0.5 && g.y < 0.05 - abs(g.x - 0.35) * 1.2) { m = 1.0; c = b; } if (length(g - vec2(0.35, 0.5)) < 0.2) { m = 1.0; c = mix(a, vec3(1.0, 0.85, 0.4), 0.6); } }
	else if (k == 3) { float pet = 0.35 + 0.22 * cos(an * 6.0); if (r < pet) { m = 1.0; c = r < 0.18 ? b : a; } }
	else if (k == 4) { for (int i = 0; i < 3; i++) { float rr = 0.75 - float(i) * 0.18; if (g.y > -0.2 && abs(r - rr) < 0.08) { m = 1.0; c = i == 0 ? a : i == 1 ? b : mix(a, b, 0.5); } } }
	else if (k == 5) { float st = 0.28 + 0.2 * smoothstep(-1.0, 1.0, cos(an * 5.0 + 1.571)); if (r < st + 0.08) { m = 1.0; c = a; } }
	else if (k == 6) { for (int i = 0; i < 4; i++) { float y = 0.45 - float(i) * 0.3; float w = i == 0 ? 0.75 : 0.35 + h21(vec2(float(i), 3.0)) * 0.4; if (abs(g.y - y) < 0.09 && abs(g.x) < w) { m = 1.0; c = i == 0 ? b : a; } } }
	else if (k == 7) { vec2 hq = vec2(abs(g.x), g.y); float hh = length(hq - vec2(0.25, 0.18)) - 0.3; float tri = hq.y + hq.x * 1.1 + 0.25; if (hh < 0.0 || (tri > 0.0 && g.y < 0.18 && g.y > -0.75 && hq.x < (g.y + 0.75) * 0.95)) { m = 1.0; c = a; } }
	else { float ec = abs(r - 0.55); if (ec < 0.1) { m = 1.0; c = a; } if (r < 0.34) { m = 1.0; c = b; } if (abs(g.y + 0.05) < 0.05 && abs(g.x) < 0.9) { m = 1.0; c = a; } }
	// a little worn: screen print on cotton
	m *= 1.0 - fade * smoothstep(0.35, 0.8, vn(g * 9.0 + 3.1));
	return mix(base, c, m);
}

// the colour of garment slot s at this point of the body (bind pose, metres)
vec3 garment(int s, vec3 P, vec3 N) {
	vec4 pat = uPat[s];
	int k = int(pat.x + 0.5);
	vec3 base = uCol[s * 4], a = uCol[s * 4 + 1], b = uCol[s * 4 + 2], x = uCol[s * 4 + 3];
	float neck = uCutA.x, chest = uCutA.y, waist = uCutA.z, hip = uCutA.w, knee = uCutB.x, ankle = uCutB.y;
	gFab = pat.w;
	int fab = int(gFab + 0.5);
	gRough = fab == 0 ? 0.92 : fab == 1 ? 0.88 : fab == 2 ? 0.85 : fab == 3 ? 0.48 : fab == 4 ? 0.97 : fab == 5 ? 0.5 : 0.38;
	gMetal = fab == 6 ? 0.7 : 0.0;
	// flat across the front and back, round the sides: a planar coordinate for checks and plaid
	float hz = abs(N.z) > abs(N.x) ? P.x : P.z;
	vec2 pl = vec2(hz, P.y);
	float side = 1.0 - smoothstep(0.0, 0.07, abs(N.z));
	float arm = step(0.5, vLimb) * (1.0 - step(1.5, vLimb));
	float front = step(uMisc.y, P.z);
	vec3 c = base;
	if (k == 1) c = mix(base, a, step(0.62, fract(P.y * pat.y)));
	else if (k == 2) c = mix(base, a, line(fract(hz * 30.0) - 0.5, 0.05) * 0.8);
	else if (k == 3 || k == 4) {
		float sx = step(0.5, fract(pl.x * pat.y)), sy = step(0.5, fract(pl.y * pat.y));
		if (k == 3) { c = mix(base, a, (sx + sy) * 0.42); c = mix(c, b, line(fract(pl.x * pat.y * 2.0 + 0.25) - 0.5, 0.04) * 0.7); c = mix(c, b, line(fract(pl.y * pat.y * 2.0 + 0.25) - 0.5, 0.04) * 0.7); }
		else c = mix(base, a, (sx + sy) * 0.33);
	}
	else if (k == 5) {
		// colour blocks: the sleeves in one, a yoke across the chest in another
		if (arm > 0.5) c = a;
		else if (P.y > chest + 0.03) c = b;
		if (s == 2) c = P.x > 0.0 ? base : a;
	}
	else if (k == 6 || k == 7) {
		if (front > 0.5 && arm < 0.5) {
			float sc = k == 7 ? 0.12 : 0.085;
			c = print(base, a, b, vec2(P.x, P.y - chest + (k == 7 ? 0.06 : 0.02)) / sc, k == 7 ? 7.0 + mod(uMisc.z, 2.0) : uMisc.z, k == 7 ? 0.7 : 0.25);
		}
	}
	else if (k == 8) { if (P.y > neck - 0.035 || (arm > 0.5 && P.y < uHem.y + 0.03)) c = a; }
	else if (k == 9) {
		// the baffles of a puffer: stitched lines and the loft between them
		float f = fract(P.y * 11.0);
		c = base * (0.82 + 0.22 * sin(f * 3.1416)) * (1.0 - line(f - 0.02, 0.04) * 0.35);
	}
	else if (k == 10 || k == 11) {
		c = base * (0.9 + 0.2 * vn(P.xy * 300.0 + P.z * 170.0));
		if (k == 11 && (P.y > chest + 0.02 || arm > 0.5 && P.y > chest - 0.05)) c = a * (0.9 + 0.2 * vn(P.xy * 300.0));
		if (k == 11 && front > 0.5 && P.x > 0.05 && P.x < 0.12 && P.y > chest - 0.05 && P.y < chest + 0.04 && arm < 0.5) c = mix(c, a, 0.8);
	}
	else if (k == 12) c = base * (0.86 + 0.14 * abs(sin(hz * 280.0)));
	else if (k == 13 || k == 14) {
		// denim: a twill of blue on white, faded on the thighs and the seat, darker in the creases
		float tw = sin((pl.x + pl.y) * 900.0) * 0.5 + 0.5, slub = vn(vec2(pl.x * 60.0, pl.y * 700.0));
		c = base * (0.86 + tw * 0.1 + slub * 0.1);
		if (k == 13 && s == 2) {
			float thigh = band(P.y, knee + 0.08, hip - 0.06, 0.08) * (P.z > 0.0 ? 1.0 : 0.6);
			c = mix(c, c * 1.55 + 0.05, thigh * 0.35 * vn(vec2(P.x * 20.0, P.y * 6.0)));
			c *= 1.0 - band(P.y, knee - 0.03, knee + 0.03, 0.03) * step(P.z, 0.0) * 0.25;
			// the waistband, the stitching down the side, the back pockets
			if (P.y > uHem.z - 0.035) c *= 0.85;
			c = mix(c, vec3(0.78, 0.5, 0.2), side * line(fract(P.y * 40.0) - 0.5, 0.3) * 0.6);
			vec2 pk = vec2(abs(P.x) - 0.075, P.y - (hip + 0.02));
			if (P.z < uMisc.w - 0.03 && abs(pk.x) < 0.045 && pk.y > -0.05 && pk.y < 0.06) { float e = min(0.045 - abs(pk.x), min(pk.y + 0.05, 0.06 - pk.y)); c = e < 0.006 ? mix(c, vec3(0.78, 0.5, 0.2), 0.7) : c * 0.94; }
		}
		if (k == 13 && s != 2) c = mix(c, vec3(0.78, 0.5, 0.2), side * 0.5);
	}
	else if (k == 15) {
		// cargo pockets on the outer thigh, with their flaps
		float outer = step(0.55, N.x * sign(P.x));
		float py = P.y - (knee + 0.05);
		if (outer > 0.5 && py > 0.0 && py < 0.2 && abs(P.z - uMisc.w) < 0.06) c = base * (py > 0.16 ? 0.8 : 0.93);
		c = mix(c, c * 0.7, side * 0.5);
	}
	else if (k == 16) {
		// a stripe down the side of the leg (or the sleeve)
		float st = s == 2 || arm > 0.5 ? (1.0 - smoothstep(0.1, 0.16, abs(N.z))) * step(0.0, N.x * sign(P.x)) : 0.0;
		c = mix(base, a, st);
	}
	else if (k == 17 || k == 26 || k == 27) {
		// a team's shirt: hoops or a sash, trim at the collar and cuffs, side panels, the number
		if (k == 26) c = mix(base, a, step(0.5, fract(P.y * 8.0)));
		if (k == 27 && abs(P.y - chest + P.x * 1.2) < 0.06) c = a;
		if (k == 17) c = mix(base, a, side * 0.9);
		if (P.y > neck - 0.03 || (arm > 0.5 && P.y < uHem.y + 0.025)) c = b;
		if (uMisc.x > 0.5) {
			vec3 inkc = dot(c, vec3(0.3, 0.6, 0.1)) > 0.45 ? a * 0.35 : vec3(0.96);
			if (dot(inkc - c, inkc - c) < 0.05) inkc = b;
			float n = 0.0;
			if (front < 0.5) n = number(vec2(-P.x + 0.11, P.y - chest + 0.17), uMisc.x, 0.22);
			else if (arm < 0.5) n = number(vec2(P.x + 0.04, P.y - chest + 0.02), uMisc.x, 0.08);
			c = mix(c, inkc, n);
		}
	}
	else if (k == 18) { vec2 q = fract(pl * pat.y) - 0.5; c = mix(base, a, 1.0 - smoothstep(0.18, 0.22, length(q))); }
	else if (k == 19) {
		// tie-dye: a spiral of three colours out from the chest
		vec2 q = vec2(P.x, P.y - chest);
		float t = atan(q.y, q.x) / 6.2832 + length(q) * 6.0 + vn(q * 12.0) * 0.4;
		float f = fract(t * 3.0);
		c = f < 0.33 ? base : f < 0.66 ? a : b;
		c = mix(c, vec3(1.0), 0.12);
	}
	else if (k == 20) c = base * (0.92 + 0.08 * h21(floor(pl * 420.0)));
	else if (k == 21) { if ((P.y < uHem.x + 0.045 && P.y > uHem.x + 0.02) || (arm > 0.5 && P.y < uHem.y + 0.04)) c = a; }
	else if (k == 22) {
		// mail: rows of rings
		vec2 q = vec2(pl.x * 140.0 + step(0.5, fract(pl.y * 70.0)) * 0.5, pl.y * 140.0);
		float ring = abs(length(fract(q) - 0.5) - 0.3);
		c = base * (0.55 + 0.6 * smoothstep(0.14, 0.02, ring));
		gMetal = 0.75; gRough = 0.42;
	}
	else if (k == 23) {
		// a hazmat suit: taped seams at the waist, wrists and ankles, a zip
		if (abs(P.y - waist) < 0.03 || (arm > 0.5 && P.y < uHem.y + 0.05) || (s == 2 && P.y < ankle + 0.1) || (P.z > 0.0 && abs(P.x) < 0.012 && P.y > waist - 0.2)) c = a;
		c *= 0.92 + 0.08 * vn(P.xy * 40.0);
	}
	else if (k == 24) {
		// a heat suit: silvered, with reflective bands
		c = mix(base, vec3(0.9), 0.3 * (0.5 + 0.5 * sin(P.y * 40.0 + P.x * 10.0)));
		if (band(fract(P.y * 3.0), 0.45, 0.55, 0.02) > 0.5) c = a;
		gMetal = 0.6; gRough = 0.35;
	}
	else if (k == 25) c = base * (0.82 + 0.18 * abs(sin(atan(P.x, P.z) * 18.0)));
	// the open front of a jacket or vest, and a zip down a closed one
	if (s == 1) {
		if (uPat[1].z < 0.5 && front > 0.5 && abs(P.x) < 0.006 && arm < 0.5) c = mix(c, a, 0.6);
		// a collar round the neck
		if (P.y > neck - 0.04 && k != 9) c *= 0.88;
	}
	// hems: a stitched line near the bottom of tops, a turned cuff on joggers
	if (s == 0 && abs(P.y - uHem.x - 0.018) < 0.003 && arm < 0.5) c *= 0.82;
	if (s == 2 && uPat[2].z > 0.5 && P.y < uHem.w + 0.05) c *= 0.88 - 0.1 * abs(sin(atan(P.x, P.z) * 30.0));
	// shoes: soles, a toe cap, laces; socks above the shoe
	if (s == 3) {
		float fy = P.y;
		if (fy > ankle + 0.02) { c = x; gFab = 0.0; gRough = 0.95; }
		else {
			gRough = 0.6;
			if (fy < pat.y) c = a;
			else if (P.z > 0.08 && fy < pat.y + 0.035) c = mix(c, a, 0.4);
			if (N.y > 0.5 && fy > pat.y + 0.03) c = mix(c, b, 0.8);
			else if (abs(N.x) > 0.6 && fy > pat.y + 0.02 && fy < ankle - 0.02 && pat.z > 0.5) c = mix(c, b, 0.85);
		}
	}
	return c;
}
`;

// the program is shared by every body; each body's material holds its own uniforms
export function garmentMaterial(A, o, cut, number = 0) {
	const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, normalMap: A.fabric.twill, normalScale: new THREE.Vector2(0.35, 0.35), side: THREE.DoubleSide });
	const U = {
		uCol: { value: Array.from({ length: 16 }, () => new THREE.Color()) },
		uPat: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
		uCutA: { value: new THREE.Vector4(cut.neck, cut.chest, cut.waist, cut.hip) },
		uCutB: { value: new THREE.Vector4(cut.knee, cut.ankle, cut.elbow, cut.wrist) },
		uMisc: { value: new THREE.Vector4(number, (cut.backZ + cut.frontZ) / 2, 0, (cut.hipZ[0] + cut.hipZ[1]) / 2) },
		uHem: { value: new THREE.Vector4(cut.waist, cut.wrist, cut.waist, cut.ankle) },
		uKnit: { value: A.fabric.knit }, uCanvas: { value: A.fabric.canvas },
	};
	m.userData.U = U;
	m.onBeforeCompile = (sh) => {
		Object.assign(sh.uniforms, U);
		sh.vertexShader = sh.vertexShader
			.replace('#include <common>', '#include <common>\nattribute float slot;\nvarying vec3 vBind;\nvarying vec3 vBN;\nflat varying float vSlot;\nflat varying float vLimb;')
			.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBind = position; vBN = normal; vSlot = mod(slot, 10.0); vLimb = floor(slot / 10.0 + 0.01);');
		sh.fragmentShader = sh.fragmentShader
			.replace('#include <common>', '#include <common>\n' + GLSL_HEAD)
			.replace('#include <color_fragment>', '#include <color_fragment>\n{ int s = int(vSlot + 0.5); vec3 N = normalize(vBN);\n if (s == 1 && uPat[1].z > 0.5 && vBind.z > uMisc.y && abs(vBind.x) < 0.035 + max(0.0, uCutA.y - vBind.y) * 0.12 && vBind.y > uCutA.z - 0.3) s = 0;\n diffuseColor.rgb *= garment(s, vBind, N); }')
			.replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nroughnessFactor = gRough; metalnessFactor = gMetal;')
			.replace('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;', 'int fb = int(gFab + 0.5);\n\tvec3 mapN = (fb == 0 || fb == 4 ? texture2D( uKnit, vNormalMapUv ) : fb == 1 ? texture2D( normalMap, vNormalMapUv ) : texture2D( uCanvas, vNormalMapUv )).xyz * 2.0 - 1.0;\n\tmapN.xy *= fb == 3 || fb >= 5 ? 0.3 : fb == 4 ? 1.6 : 1.0;');
	};
	m.customProgramCacheKey = () => 'crysis-garment-1';
	paint(m, o);
	return m;
}

// set a body's garment colours and patterns (no rebuilding: the uniforms only)
const PRINTS = 9;
export function paint(m, o) {
	const U = m.userData.U;
	const slots = [o.top, o.outer, o.bottom, o.shoes];
	slots.forEach((g, s) => {
		if (!g) return;
		const c = U.uCol.value;
		c[s * 4].set(g.col || '#888888');
		c[s * 4 + 1].set(g.acc || g.col || '#888888');
		c[s * 4 + 2].set(g.acc2 || g.acc || g.col || '#888888');
		c[s * 4 + 3].set(s === 3 ? (g.socks || o.bottom?.socks || g.col || '#888888') : s === 2 && g.socks ? g.socks : '#000000');
		let pat = PAT[g.pat] ?? 0;
		let scale = g.pat === 'breton' ? 14 : g.pat === 'stripe' ? (g.kind === 'boardshorts' ? 6 : 12) : g.pat === 'plaid' ? 7 : g.pat === 'check' ? 16 : g.pat === 'dots' ? 11 : 10;
		let flag = 0;
		if (s === 1) flag = g.open ? 1 : 0;
		if (s === 2) flag = g.cuff ? 1 : 0;
		if (s === 3) { scale = g.kind === 'chunky' ? 0.045 : g.kind === 'boot' ? 0.03 : g.kind === 'trail' ? 0.035 : 0.022; flag = g.kind === 'runner' || g.kind === 'trail' || g.kind === 'chunky' ? 1 : 0; }
		if (g.pat === 'denim' && s !== 2) pat = PAT.denim;
		const fab = FAB[g.fab] ?? (s === 3 ? FAB.leather : g.pat === 'denim' || g.pat === 'chambray' || g.kind === 'chinos' || g.kind === 'khakis' || g.kind === 'trousers' || g.kind === 'slacks' || g.kind === 'cargo' ? FAB.twill : g.kind === 'jersey' || g.kind === 'tech' || g.kind === 'runshorts' || g.kind === 'leggings' || g.kind === 'swim' || g.kind === 'bikini' ? FAB.nylon : s === 1 ? FAB.canvas : FAB.knit);
		U.uPat.value[s].set(pat, scale, flag, fab);
	});
	U.uMisc.value.x = o.top?.number || 0;
	U.uMisc.value.z = (o.printKind ?? 0) % PRINTS;
}

// ---------- the cut: which garment each cage triangle belongs to ----------
// the body's landmarks: joint heights, the girth of the hips, the skull
export function landmarks(A, p, heads, map, height) {
	const Y = (n) => heads[map[n]].y;
	const cut = { neck: Y('neck01') - 0.02, chest: Y('spine01'), waist: Y('spine04') + 0.02, hip: Y('upperleg01.L'), elbow: Y('lowerarm01.L'), wrist: Y('wrist.L') + 0.03, knee: Y('lowerleg01.L'), ankle: Y('foot.L') + 0.02, shoulder: Y('upperarm01.L'), shoulderX: Math.abs(heads[map['upperarm01.L']].x), height };
	// the skull and the torso's front and back, from the vertices the head and spine carry
	const n = A.ids.length / 4, hb = map.head;
	const sk = { x0: 1e9, x1: -1e9, y0: 1e9, y1: -1e9, z0: 1e9, z1: -1e9 };
	let backZ = 1e9, frontZ = -1e9, hipX = 0, hipZ0 = 1e9, hipZ1 = -1e9, waistX = 0;
	const part = partOf(A);
	for (let v = 0; v < n; v++) {
		let sum = 0, hw = 0;
		for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; sum += w; if (A.ids[v * 4 + q] === hb) hw += w; }
		const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
		if (sum && hw / sum > 0.85) { sk.x0 = Math.min(sk.x0, x); sk.x1 = Math.max(sk.x1, x); sk.y0 = Math.min(sk.y0, y); sk.y1 = Math.max(sk.y1, y); sk.z0 = Math.min(sk.z0, z); sk.z1 = Math.max(sk.z1, z); }
		if (part[v] !== 0) continue;
		if (Math.abs(y - cut.chest) < 0.03 && Math.abs(x) < 0.08) { backZ = Math.min(backZ, z); frontZ = Math.max(frontZ, z); }
		if (Math.abs(y - (cut.hip - 0.04)) < 0.03) { hipX = Math.max(hipX, Math.abs(x)); hipZ0 = Math.min(hipZ0, z); hipZ1 = Math.max(hipZ1, z); }
		if (Math.abs(y - cut.waist) < 0.03) waistX = Math.max(waistX, Math.abs(x));
	}
	cut.skull = sk; cut.backZ = backZ; cut.frontZ = frontZ; cut.hipX = hipX; cut.hipZ = [hipZ0, hipZ1]; cut.waistX = waistX;
	return cut;
}

// body parts by dominant bone: 0 torso/head, 1 upper arm, 2 forearm, 3 hand, 4 thigh, 5 shin, 6 foot
let partCache = null;
export function partOf(A) {
	if (partCache) return partCache;
	const kind = A.bones.map((b) => /^(upperarm|shoulder|clavicle)/.test(b.name) ? (b.name.startsWith('upperarm') ? 1 : 0) : /^lowerarm/.test(b.name) ? 2 : /^(wrist|metacarpal|finger)/.test(b.name) ? 3 : /^upperleg/.test(b.name) ? 4 : /^lowerleg/.test(b.name) ? 5 : /^foot/.test(b.name) ? 6 : 0);
	const n = A.ids.length / 4, out = new Uint8Array(n);
	for (let v = 0; v < n; v++) { let best = 0, bw = -1; for (let q = 0; q < 4; q++) { const w = A.weights[v * 4 + q]; if (w > bw) { bw = w; best = A.ids[v * 4 + q]; } } out[v] = kind[best] || 0; }
	partCache = out;
	return out;
}

// the regions of an outfit, as tests on a triangle (its centre c, what it is on k, a margin m)
export function regions(o, cut) {
	const T = o.top, J = o.outer, B = o.bottom, F = o.shoes;
	const sleeveOK = (s, c, k, m) => {
		if (k.fore) return s === 'long' && c[1] > cut.wrist + m;
		if (k.arm) return s === 'long' || s === 'elbow' || (s === 'short' && c[1] > cut.elbow + 0.1 + m) || (s === 'cap' && c[1] > cut.shoulder - 0.07 + m);
		return true;
	};
	const hemOf = (g, outer) => !g ? 0 : g.crop ? cut.waist + 0.07 : g.kind === 'bikini' ? cut.chest - 0.085 : g.kind === 'tunic' ? cut.knee + 0.12 : g.long || g.kind === 'coverup' ? cut.knee + (g.long ? 0.02 : 0.2) : g.kind === 'puffer' && o.gen === 'z' ? cut.waist + 0.01 : g.tuck ? cut.waist - 0.02 : g.fit === 'oversized' || g.kind === 'hoodie' || g.kind === 'suit' ? cut.hip - 0.02 : cut.waist - (outer ? 0.07 : 0.04);
	const topHem = hemOf(T, false), outHem = hemOf(J, true);
	const inTorsoGarment = (g, hem, c, k, m) => {
		if (!g || k.hand || k.foot || k.shin) return false;
		if (g.kind === 'bikini') return !k.arm && !k.fore && !k.thigh && c[1] > cut.chest - 0.085 + m && c[1] < cut.chest + 0.05 - m;
		if (g.onepiece) return !k.arm && !k.fore && !k.thigh && c[1] < cut.chest + 0.06 - m && c[1] > cut.hip - 0.1 + m;
		if (!sleeveOK(g.sleeves || 'short', c, k, m)) return false;
		if (k.thigh) return hem < cut.hip - 0.05 && c[1] > hem + m;
		const scoop = (g.kind === 'crop' || g.kind === 'tank' || g.kind === 'tee' && o.gen === 'z') && c[2] > 0.02 ? 0.045 : 0;
		return c[1] > hem + m && c[1] < cut.neck - scoop - m && !(g.sleeves === 'none' && Math.abs(c[0]) > cut.shoulderX - 0.02 && c[1] > cut.chest);
	};
	const legEnd = B ? ({ long: cut.ankle + (B.fit === 'wide' || B.fit === 'baggy' ? 0.005 : 0.02), capri: cut.knee - 0.17, bermuda: cut.knee - 0.03, jorts: cut.knee - 0.04, board: cut.knee + 0.01, shorts: cut.knee + 0.1, short: cut.knee + 0.2, bike: cut.knee + 0.07, knicker: cut.knee - 0.1, skirt: B.len === 'mini' ? cut.knee + 0.18 : 1e9, brief: cut.hip - 0.06 })[B.legs || 'long'] ?? cut.ankle : 0;
	const rise = B && (B.fit === 'wide' || B.kind === 'skirt' || B.fit === 'baggy') ? 0.05 : 0.02;
	const R = {
		topHem, outHem, legEnd,
		top: (c, tri, k, m = 0) => inTorsoGarment(T, topHem, c, k, m),
		outer: (c, tri, k, m = 0) => inTorsoGarment(J, outHem, c, k, m),
		bottom: (c, tri, k, m = 0) => {
			if (!B || k.arm || k.fore || k.hand || k.foot) return false;
			if (B.legs === 'brief') return (k.thigh ? c[1] > cut.hip - 0.07 + m : c[1] < cut.hip + 0.06 - m) && !k.shin;
			if (k.shin) return c[1] > legEnd + m;
			if (k.thigh) return c[1] > legEnd + m;
			return c[1] < cut.waist + rise - m;
		},
		// (socks on the shins under shorts, as part of the shoe)
		shoes: (c, tri, k, m = 0) => {
			if (!F || F.kind === 'barefoot') return false;
			if (F.kind === 'sandal') return k.foot > 1 && c[1] < 0.022 - m;
			const socks = F.socks || B?.socks;
			if (socks && k.shin && c[1] < cut.knee - 0.06 - m && (B?.legs !== 'long')) return true;
			const top = F.kind === 'boot' ? cut.ankle + 0.09 : F.kind === 'trail' ? cut.ankle + 0.01 : cut.ankle - 0.02;
			return k.foot > 1 || c[1] < top - m;
		},
	};
	R.skirtShell = B && B.legs === 'skirt' && B.len !== 'mini';
	return R;
}

// how far each garment stands off the skin
function offsets(o) {
	const T = o.top, J = o.outer, B = o.bottom, F = o.shoes;
	const fitOff = (g) => !g ? 0.01 : g.fit === 'tight' ? 0.004 : g.fit === 'fitted' ? 0.007 : g.fit === 'oversized' ? 0.022 : g.fit === 'baggy' ? 0.02 : 0.011;
	const top = fitOff(T) + (T?.kind === 'knit' || T?.kind === 'hoodie' ? 0.003 : 0);
	const puffy = J && (J.pat === 'quilt') ? 0.022 : J?.fab === 'fleece' ? 0.006 : 0.002;
	return { top, outer: J ? Math.max(top, fitOff(J)) + 0.012 + puffy : 0, bottom: fitOff(B), shoes: F?.kind === 'chunky' ? 0.02 : F?.kind === 'boot' ? 0.014 : F?.kind === 'sandal' ? 0.004 : 0.012 };
}

// ---------- the cloth mesh ----------
export function clothGeometry(A, p, o, cut, R) {
	const part = partOf(A), faces = A.cage;
	const V = [], T = [], SI = [], SW = [], SL = [], I = [], key = new Map(), src = [];
	const kinds = (tri) => { const k = { arm: 0, fore: 0, hand: 0, thigh: 0, shin: 0, foot: 0 }; for (const v of tri) { const q = part[v]; if (q === 1) k.arm++; else if (q === 2) k.fore++; else if (q === 3) k.hand++; else if (q === 4) k.thigh++; else if (q === 5) k.shin++; else if (q === 6) k.foot++; } return k; };
	const tests = [R.top, R.outer, R.bottom, R.shoes];
	const c = [0, 0, 0];
	for (let i = 0; i < faces.length; i += 6) {
		const tri = [faces[i], faces[i + 2], faces[i + 4]];
		for (let ax = 0; ax < 3; ax++) c[ax] = (p[tri[0] * 3 + ax] + p[tri[1] * 3 + ax] + p[tri[2] * 3 + ax]) / 3;
		const k = kinds(tri);
		for (let s = 0; s < 4; s++) {
			if (!tests[s](c, tri, k)) continue;
			for (let j = 0; j < 6; j += 2) {
				const id = faces[i + j], u = faces[i + j + 1], k0 = (s * 32768 + id) * 32768 + u;
				let q = key.get(k0);
				if (q === undefined) {
					q = V.length / 3; key.set(k0, q); src.push(s * 32768 + id);
					V.push(p[id * 3], p[id * 3 + 1], p[id * 3 + 2]);
					T.push((Math.atan2(p[id * 3], p[id * 3 + 2]) + Math.PI) * 1.6, p[id * 3 + 1] * 20);
					let sum = 0; for (let w = 0; w < 4; w++) sum += A.weights[id * 4 + w];
					for (let w = 0; w < 4; w++) { SI.push(A.ids[id * 4 + w]); SW.push(A.weights[id * 4 + w] / (sum || 1)); }
					SL.push(s + 10 * (part[id] >= 1 && part[id] <= 3 ? 1 : part[id] >= 4 ? 2 : 0));
				}
				I.push(q);
			}
		}
	}
	// a skirt below the knee: a flared shell hung from the hips (the legs swing inside it)
	if (R.skirtShell) {
		const B = o.bottom, hem = B.len === 'maxi' ? cut.ankle + 0.03 : (cut.knee + cut.ankle) / 2 + 0.02, flare = B.len === 'maxi' ? 1.55 : 1.4;
		const hx = cut.hipX + 0.02, hz = (cut.hipZ[1] - cut.hipZ[0]) / 2 + 0.025, zc = (cut.hipZ[0] + cut.hipZ[1]) / 2;
		const prof = [[0.9, cut.waist + 0.03], [1.02, cut.hip + 0.02], [1.12, cut.hip - 0.1], [(1.12 + flare) / 2, (cut.hip - 0.1 + hem) / 2], [flare, hem]];
		const seg = 20, base = V.length / 3, rootI = A.bones.findIndex((b) => b.name === 'root');
		for (let j = 0; j < prof.length; j++) for (let a = 0; a <= seg; a++) {
			const t = a / seg * Math.PI * 2, [r, y] = prof[j];
			V.push(Math.sin(t) * r * hx, y, zc + Math.cos(t) * r * hz);
			T.push(t * 1.6, y * 20);
			SI.push(rootI, 0, 0, 0); SW.push(1, 0, 0, 0); SL.push(22); src.push(-1 - (base + j * (seg + 1) + a));
		}
		for (let j = 0; j < prof.length - 1; j++) for (let a = 0; a < seg; a++) { const q = base + j * (seg + 1) + a, n = q + seg + 1; I.push(q, n, q + 1, q + 1, n, n + 1); }
	}
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(V, 3));
	g.setAttribute('uv', new THREE.Float32BufferAttribute(T, 2));
	g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4));
	g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
	g.setAttribute('slot', new THREE.Float32BufferAttribute(SL, 1));
	g.setIndex(I);
	g.computeVertexNormals();
	// smooth normals across UV seams: averaged by source vertex (within a garment)
	const n = g.attributes.normal, acc = new Map();
	for (let i = 0; i < src.length; i++) { if (src[i] < 0) continue; const a = acc.get(src[i]) || [0, 0, 0]; a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i); acc.set(src[i], a); }
	for (let i = 0; i < src.length; i++) { if (src[i] < 0) continue; const a = acc.get(src[i]), l = Math.hypot(...a) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
	// then each garment stood off the skin: fitted or loose, legs straight, wide or baggy
	const off = offsets(o), P = g.attributes.position, B = o.bottom, knee = cut.knee;
	const legFlare = B?.fit === 'wide' ? 0.075 : B?.fit === 'baggy' ? 0.06 : B?.legs === 'board' ? 0.03 : 0;
	const tuck = o.top?.tuck;
	for (let i = 0; i < P.count; i++) {
		if (src[i] < 0) continue;
		const s = SL[i] % 10, y = P.getY(i), x = P.getX(i), z = P.getZ(i);
		let k = s === 0 ? off.top : s === 1 ? off.outer : s === 2 ? off.bottom : off.shoes;
		if (s === 2) {
			if (tuck && y > cut.waist - 0.06) k = Math.max(k, off.top + 0.004);
			if (legFlare && y < cut.hip - 0.05) k += Math.min(0.06, Math.max(0, knee + 0.2 - y) * legFlare * 1.2) + (B.fit === 'baggy' ? 0.012 : 0);
			if (B?.legs === 'skirt') k = 0.02 + Math.max(0, 0.6 - y) * 0.12;
		}
		if (s === 3 && o.shoes?.kind === 'chunky' && y < 0.04) k += 0.012;
		if (s === 3 && y > cut.ankle + 0.02) k = 0.004;
		const loose = s === 1 || (s === 0 && o.top?.fit === 'oversized') || (s === 2 && (legFlare || B?.legs === 'skirt'));
		k *= 1 + (loose ? 0.35 : 0.2) * Math.sin(y * 70 + x * 30 + z * 25);
		P.setXYZ(i, x + n.getX(i) * k, y + n.getY(i) * k * 0.3, z + n.getZ(i) * k);
	}
	g.computeVertexNormals();
	g.computeBoundingSphere();
	return g;
}

// ---------- the small things: caps, glasses, headphones, bags ----------
// one geometry for all of them, each vertex bound whole to the bone it rides
export function accessoryGeometry(A, P0, o, cut, hairCol) {
	const { map, heads, eyes } = P0;
	const out = { pos: [], nor: [], col: [], si: [], gl: [] };
	const colour = new THREE.Color();
	const put = (geo, bone, c, gloss = 0) => {
		geo.computeVertexNormals();
		const g = geo.index ? geo.toNonIndexed() : geo;
		const pa = g.attributes.position, na = g.attributes.normal, bi = map[bone] ?? 0;
		colour.set(c);
		for (let i = 0; i < pa.count; i++) {
			out.pos.push(pa.getX(i), pa.getY(i), pa.getZ(i)); out.nor.push(na.getX(i), na.getY(i), na.getZ(i));
			out.col.push(colour.r, colour.g, colour.b); out.si.push(bi); out.gl.push(gloss);
		}
	};
	const sk = cut.skull, cx = (sk.x0 + sk.x1) / 2, cz = (sk.z0 + sk.z1) / 2 - 0.005, rx = (sk.x1 - sk.x0) / 2, rz = (sk.z1 - sk.z0) / 2, top = sk.y1;
	const eyeY = eyes ? (eyes[0].y + eyes[1].y) / 2 : top - 0.1, eyeZ = eyes ? Math.max(eyes[0].z, eyes[1].z) : sk.z1 - 0.03;
	// a dome over the skull: from `from` (0 crown .. 1 the rim) down `deep` metres, a little proud of the hair
	const dome = (deep, grow, seg = 16, cutFront = 0) => {
		const prof = [];
		for (let i = 0; i <= 8; i++) { const t = i / 8, a = t * Math.PI / 2; prof.push(new THREE.Vector2(Math.max(0.0005, Math.sin(a)), top + grow - deep + Math.cos(a) * deep)); }
		const g = new THREE.LatheGeometry(prof, seg, cutFront ? cutFront : 0, cutFront ? Math.PI * 2 - cutFront * 2 : Math.PI * 2);
		g.scale(rx + grow, 1, rz + grow); g.translate(cx, 0, cz);
		return g;
	};
	for (const q of o.acc || []) {
		const c = q.col || '#333333', a2 = q.acc || c;
		if (q.kind === 'cap' || q.kind === 'visor') {
			const rim = eyeY + 0.045;
			if (q.kind === 'cap') put(dome(top + 0.012 - rim, 0.012), 'head', c);
			else { const band = new THREE.CylinderGeometry(1, 1, 0.035, 18, 1, true); band.scale(rx + 0.012, 1, rz + 0.012); band.translate(cx, rim + 0.02, cz); put(band, 'head', c); }
			// the bill, out over the eyes (on a few worn backwards)
			const bill = new THREE.CylinderGeometry(0.1, 0.1, 0.008, 14, 1, false, -Math.PI / 2, Math.PI);
			bill.scale(0.95, 1, 0.75); bill.rotateX(-0.12); bill.translate(cx, rim + 0.008, cz + rz * 0.72);
			put(bill, 'head', q.faded ? new THREE.Color(a2).lerp(new THREE.Color(c), 0.5).getHex() : q.kind === 'visor' ? a2 : c);
		} else if (q.kind === 'beanie' || q.kind === 'hood' || q.kind === 'helmet' || q.kind === 'hazhood') {
			const deep = q.kind === 'beanie' ? top - eyeY - 0.03 : q.kind === 'helmet' ? top - eyeY + 0.03 : top - eyeY + 0.08;
			const grow = q.kind === 'beanie' ? 0.016 : q.kind === 'helmet' ? 0.03 : 0.035;
			put(dome(deep, grow, 18, q.kind === 'hood' || q.kind === 'hazhood' ? 0.62 : 0), 'head', c, q.kind === 'helmet' ? 0.7 : 0);
			if (q.kind === 'beanie') { const cuff = new THREE.CylinderGeometry(1, 1.02, 0.05, 18, 1, true); cuff.scale(rx + 0.024, 1, rz + 0.024); cuff.translate(cx, eyeY + 0.055, cz); put(cuff, 'head', c); }
			if (q.kind === 'helmet' && q.cage) for (let k = 0; k < 3; k++) { const bar = new THREE.CylinderGeometry(0.006, 0.006, rx * 1.6, 6); bar.rotateZ(Math.PI / 2); bar.translate(cx, eyeY - 0.05 - k * 0.035, sk.z1 + 0.045); put(bar, 'head', '#d8d8d8', 0.6); }
			if (q.kind === 'helmet' && q.visor) { const v = new THREE.SphereGeometry(1, 16, 8, -0.9, 1.8, 1.2, 0.6); v.scale(rx + 0.035, 0.12, rz + 0.035); v.translate(cx, eyeY + 0.01, cz); put(v, 'head', q.visor, 1); }
			if (q.kind === 'hazhood') { const v = new THREE.SphereGeometry(1, 14, 8, -0.7, 1.4, 1.1, 0.75); v.scale(rx + 0.04, 0.2, rz + 0.04); v.translate(cx, eyeY - 0.01, cz); put(v, 'head', a2, 1); }
		} else if (q.kind === 'bucket' || q.kind === 'sunhat') {
			const rim = eyeY + 0.055;
			put(dome(top + 0.015 - rim, 0.016), 'head', c);
			const w = q.kind === 'sunhat' ? 0.1 : 0.05;
			const brim = new THREE.CylinderGeometry(1, 1 + w * 12, w * 0.5, 20, 1, true);
			brim.scale(rx + 0.018, 1, rz + 0.018); brim.translate(cx, rim - w * 0.25, cz);
			put(brim, 'head', c);
			if (q.kind === 'sunhat') { const b = new THREE.CylinderGeometry(1, 1, 0.018, 20, 1, true); b.scale(rx + 0.019, 1, rz + 0.019); b.translate(cx, rim + 0.012, cz); put(b, 'head', a2); }
		} else if (q.kind === 'glasses' || q.kind === 'sunglasses') {
			if (!eyes) continue;
			const sun = q.kind === 'sunglasses', slim = q.slim;
			for (const e of eyes) {
				const w = slim ? 0.024 : 0.028, h = slim ? 0.013 : sun ? 0.022 : 0.019;
				const fr = new THREE.TorusGeometry(1, 0.12, 5, 16); fr.scale(w, h, 0.03); fr.translate(e.x, e.y, eyeZ + 0.016);
				put(fr, 'head', c, 0.6);
				if (sun) { const lens = new THREE.CircleGeometry(1, 16); lens.scale(w, h, 1); lens.translate(e.x, e.y, eyeZ + 0.015); put(lens, 'head', '#141418', 1); }
				// the arm back to the ear
				const armG = new THREE.BoxGeometry(0.004, 0.004, 0.1); armG.translate(e.x + Math.sign(e.x) * (w + 0.004), e.y + 0.004, eyeZ - 0.035); put(armG, 'head', c, 0.6);
			}
			const br = new THREE.BoxGeometry(Math.abs(eyes[0].x - eyes[1].x) - 0.05, 0.004, 0.004); br.translate((eyes[0].x + eyes[1].x) / 2, eyes[0].y + 0.004, eyeZ + 0.018); put(br, 'head', c, 0.6);
		} else if (q.kind === 'headphones') {
			const band = new THREE.TorusGeometry(1, 0.035, 6, 20, Math.PI); band.scale(rx + 0.03, top - eyeY + 0.06, 0.35); band.translate(cx, eyeY - 0.02, cz - 0.01);
			put(band, 'head', c, 0.4);
			for (const s of [-1, 1]) { const cup = new THREE.CylinderGeometry(0.038, 0.038, 0.03, 16); cup.rotateZ(Math.PI / 2); cup.translate(cx + s * (rx + 0.018), eyeY - 0.03, cz - 0.01); put(cup, 'head', c, 0.4); }
		} else if (q.kind === 'backpack') {
			const w = q.slim ? 0.28 : 0.31, h = q.slim ? 0.4 : 0.44, d = q.slim ? 0.1 : 0.15;
			const bag = new THREE.BoxGeometry(w, h, d, 2, 2, 2);
			const pa = bag.attributes.position;
			for (let i = 0; i < pa.count; i++) { const x = pa.getX(i), y = pa.getY(i), z = pa.getZ(i); pa.setXYZ(i, x * (1 - Math.abs(y / h) * 0.12), y, z * (z > 0 ? 1 : 0.6) * (1 - Math.abs(y / h) * 0.25)); }
			bag.translate(0, cut.chest - 0.08, cut.backZ - d / 2 - 0.035);
			put(bag, 'spine01', c);
			const pocket = new THREE.BoxGeometry(w * 0.7, h * 0.35, 0.04); pocket.translate(0, cut.chest - 0.2, cut.backZ - d - 0.045); put(pocket, 'spine01', a2);
			for (const s of [-1, 1]) {
				const st = new THREE.BoxGeometry(0.045, 0.012, 0.3); st.rotateX(0.6); st.translate(s * 0.09, cut.shoulder + 0.03, (cut.backZ + cut.frontZ) / 2 - 0.02); put(st, 'spine01', '#1b1b1d');
				const fr = new THREE.BoxGeometry(0.04, 0.26, 0.01); fr.translate(s * 0.1, cut.chest - 0.02, cut.frontZ + 0.028); put(fr, 'spine01', '#1b1b1d');
			}
		} else if (q.kind === 'tote') {
			// carried in the left hand: the bag hangs from the fist
			const w = heads[map['wrist.L']];
			const bag = new THREE.BoxGeometry(0.06, 0.34, 0.32); bag.translate(w.x + 0.03, w.y - 0.27, w.z); put(bag, 'wrist.L', c);
			const strap = new THREE.BoxGeometry(0.012, 0.1, 0.012); strap.translate(w.x + 0.03, w.y - 0.07, w.z + 0.06); put(strap, 'wrist.L', c);
			const strap2 = strap.clone(); strap2.translate(0, 0, -0.12); put(strap2, 'wrist.L', c);
			const print = new THREE.CircleGeometry(0.06, 12); print.rotateY(Math.PI / 2); print.translate(w.x + 0.061, w.y - 0.25, w.z); put(print, 'wrist.L', a2);
		} else if (q.kind === 'crossbody') {
			const bag = new THREE.BoxGeometry(0.2, 0.12, 0.06); bag.translate(0.09, cut.waist - 0.02, cut.frontZ + 0.02); put(bag, 'spine04', c);
			// the strap across the chest, from the right shoulder to the left hip
			const s0 = new THREE.Vector3(-cut.shoulderX * 0.55, cut.shoulder + 0.05, (cut.backZ + cut.frontZ) / 2), s1 = new THREE.Vector3(-0.06, cut.chest, cut.frontZ + 0.02), s2 = new THREE.Vector3(0.12, cut.waist + 0.03, cut.frontZ + 0.01);
			for (const [a, b, bone] of [[s0, s1, 'spine01'], [s1, s2, 'spine02']]) {
				const L = a.distanceTo(b), st = new THREE.BoxGeometry(0.03, L, 0.008);
				const qn = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(b, a).normalize());
				st.applyQuaternion(qn); st.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
				put(st, bone, '#1b1b1d');
			}
		} else if (q.kind === 'gloves' || q.kind === 'mitt') {
			for (const s of q.kind === 'mitt' ? ['L'] : ['L', 'R']) {
				const wi = map['wrist.' + s], w = heads[wi], dir = P0.rest.dirs[wi];
				const big = q.kind === 'mitt' ? 1.35 : 1.1;
				const box = new THREE.BoxGeometry(0.085 * big, 0.2 * big, 0.045 * big, 1, 2, 1);
				box.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir));
				const cen = w.clone().addScaledVector(dir, 0.085 * big);
				box.translate(cen.x, cen.y, cen.z);
				put(box, 'wrist.' + s, c);
				if (q.kind === 'gloves') { const cuff = new THREE.CylinderGeometry(0.042, 0.045, 0.05, 10); cuff.translate(w.x, w.y + 0.01, w.z); put(cuff, 'wrist.' + s, q.acc || c); }
			}
		}
	}
	// a hood lying at the back of a hoodie's neck, and its drawstrings
	if (o.top?.kind === 'hoodie' && !(o.outer && o.outer.sleeves !== 'none' && !o.outer.open)) {
		const hood = new THREE.TorusGeometry(0.1, 0.035, 8, 14, Math.PI * 1.15);
		hood.scale(1.1, 0.8, 0.7); hood.rotateX(Math.PI / 2 - 0.3); hood.rotateZ(Math.PI * -0.075); hood.rotateY(Math.PI);
		hood.translate(0, cut.neck + 0.005, (cut.backZ + cut.frontZ) / 2 - 0.035);
		put(hood, 'spine01', o.top.col);
		for (const s of [-1, 1]) { const st = new THREE.CylinderGeometry(0.004, 0.004, 0.14, 5); st.translate(s * 0.03, cut.neck - 0.1, cut.frontZ + 0.028); put(st, 'spine01', '#f3f2ee'); }
	}
	// the bun of hair worn up, and a headscarf
	if (o.hair?.bun && hairCol) { const bun = new THREE.SphereGeometry(0.05, 12, 8); bun.translate(cx, top - 0.02, sk.z0 + 0.01); put(bun, 'head', hairCol); }
	if (o.hair?.scarf) {
		put(dome(top - eyeY + 0.2, 0.018, 18, 0.72), 'head', o.hair.scarf);
		const drape = new THREE.CylinderGeometry(0.075, 0.13, 0.12, 18, 1, true); drape.translate(0, cut.neck + 0.01, (cut.backZ + cut.frontZ) / 2); put(drape, 'spine01', o.hair.scarf);
	}
	if (!out.pos.length) return null;
	const g = new THREE.BufferGeometry();
	g.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
	g.setAttribute('normal', new THREE.Float32BufferAttribute(out.nor, 3));
	g.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
	g.setAttribute('gloss', new THREE.Float32BufferAttribute(out.gl, 1));
	const n = out.si.length, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
	for (let i = 0; i < n; i++) { si[i * 4] = out.si[i]; sw[i * 4] = 1; }
	g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4));
	g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
	g.computeBoundingSphere();
	return g;
}
// one material for every accessory of every person
let accMat = null;
export function accessoryMaterial() {
	if (accMat) return accMat;
	accMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide });
	accMat.onBeforeCompile = (sh) => {
		sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float gloss;\nvarying float vGloss;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGloss = gloss;');
		sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vGloss;').replace('#include <metalnessmap_fragment>', '#include <metalnessmap_fragment>\nroughnessFactor = mix(0.8, 0.12, vGloss); metalnessFactor = vGloss * 0.3;');
	};
	accMat.customProgramCacheKey = () => 'crysis-acc-1';
	accMat.userData.shared = true;
	return accMat;
}

